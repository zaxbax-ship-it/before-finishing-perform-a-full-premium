import 'server-only';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import type { AdminContext } from '@/lib/auth/types';

/**
 * Player directory — the admin view over every identity the platform knows.
 *
 * The platform has three real identity sources, merged where a link exists
 * and reported honestly where one does not:
 *  1. `users`        — registered accounts (emails stored only as salted hashes,
 *                      so raw emails are not displayable by design).
 *  2. `progression`  — one row per active player key (auth user id, or the
 *                      anonymous device id for guests).
 *  3. `leaderboard`  — public nicknames; linked to a user via authUserId when
 *                      the score was submitted while signed in.
 *
 * Pure repository aggregation: no Next.js imports, contract-shaped output,
 * reusable by native admin clients through /api/admin/users.
 */

export type AdminPlayerRow = {
  /** Stable directory id: `user:<id>` | `anon:<playerKey>` | `nick:<nickname>` */
  id: string;
  kind: 'registered' | 'anonymous' | 'leaderboard-only';
  displayName: string;
  nickname?: string;
  locale?: string;
  isActive: boolean;
  isHiddenOnLeaderboard?: boolean;
  premium: boolean;
  xp?: number;
  level?: number;
  gamesPlayed?: number;
  achievements?: number;
  bestPrize?: number;
  lastActiveAt?: string;
  createdAt?: string;
};

export type AdminPlayerDetail = AdminPlayerRow & {
  achievementIds: string[];
  multiplayerGames: Array<{ lobbyId: string; nickname: string; joinedAt: string; isConnected: boolean }>;
  payments: Array<{ id: string; amount: number; currency: string; status: string; createdAt: string }>;
  entitlements: Array<{ id: string; type: string; source: string; status: string }>;
  /** Signals the platform does not record for this identity, with reasons. */
  unavailable: Record<string, string>;
};

export type ListPlayersQuery = {
  search?: string;
  status?: 'all' | 'active' | 'suspended' | 'hidden';
  kind?: 'all' | 'registered' | 'anonymous' | 'leaderboard-only';
  sort?: 'lastActive' | 'xp' | 'bestPrize' | 'created';
  page?: number;
  pageSize?: number;
};

export type ListPlayersResult = {
  rows: AdminPlayerRow[];
  total: number;
  page: number;
  pageSize: number;
};

const NOT_LINKABLE_EMAIL = 'Emails are stored as salted hashes only; raw addresses are not recoverable by design.';
const NOT_TRACKED_SESSIONS = 'Session history is not recorded; only lastSeen/updatedAt timestamps exist.';
const NOT_LINKABLE_CONTACT = 'Contact messages store the sender email, which cannot be linked to hashed account emails.';

export async function listPlayers(repositories: RepositoryProvider, query: ListPlayersQuery = {}): Promise<ListPlayersResult> {
  const rows = await buildDirectory(repositories);

  const search = query.search?.trim().toLowerCase();
  let filtered = rows;
  if (search) {
    filtered = filtered.filter(row =>
      row.displayName.toLowerCase().includes(search) ||
      row.nickname?.toLowerCase().includes(search) ||
      row.id.toLowerCase().includes(search)
    );
  }
  if (query.status && query.status !== 'all') {
    filtered = filtered.filter(row =>
      query.status === 'active' ? row.isActive && !row.isHiddenOnLeaderboard :
      query.status === 'suspended' ? !row.isActive :
      Boolean(row.isHiddenOnLeaderboard)
    );
  }
  if (query.kind && query.kind !== 'all') {
    filtered = filtered.filter(row => row.kind === query.kind);
  }

  const sort = query.sort || 'lastActive';
  filtered = [...filtered].sort((first, second) => {
    if (sort === 'xp') return (second.xp || 0) - (first.xp || 0);
    if (sort === 'bestPrize') return (second.bestPrize || 0) - (first.bestPrize || 0);
    if (sort === 'created') return time(second.createdAt) - time(first.createdAt);
    return time(second.lastActiveAt) - time(first.lastActiveAt);
  });

  const pageSize = Math.min(100, Math.max(5, query.pageSize || 25));
  const page = Math.max(1, query.page || 1);
  return {
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize
  };
}

export async function getPlayerDetail(repositories: RepositoryProvider, directoryId: string): Promise<AdminPlayerDetail | undefined> {
  const rows = await buildDirectory(repositories);
  const row = rows.find(candidate => candidate.id === directoryId);
  if (!row) return undefined;

  const [kind, rawKey] = splitId(directoryId);
  const identity = kind === 'user'
    ? { authUserId: await authUserIdForUser(repositories, rawKey) }
    : kind === 'anon'
      ? { anonymousId: rawKey, authUserId: rawKey }
      : {};

  const progression = kind === 'nick' ? undefined : await repositories.progression.find(playerKeyForId(kind, rawKey, identity.authUserId));
  const mpPlayers = identity.authUserId || identity.anonymousId
    ? await repositories.multiplayer.listPlayersForIdentity(identity)
    : [];
  const paymentsUserId = identity.authUserId;
  const [transactions, entitlements] = paymentsUserId
    ? await Promise.all([
        repositories.payments.listTransactionsByUserId(paymentsUserId),
        repositories.payments.listEntitlementsByUserId(paymentsUserId)
      ])
    : [[], []];

  return {
    ...row,
    achievementIds: progression?.unlockedAchievements || [],
    multiplayerGames: mpPlayers.map(player => ({
      lobbyId: player.lobbyId,
      nickname: player.nickname,
      joinedAt: player.joinedAt,
      isConnected: player.isConnected
    })),
    payments: transactions.map(tx => ({ id: tx.id, amount: tx.amount, currency: tx.currency, status: tx.status, createdAt: tx.createdAt })),
    entitlements: entitlements.map(ent => ({ id: ent.id, type: ent.type, source: ent.source, status: ent.status })),
    unavailable: {
      email: NOT_LINKABLE_EMAIL,
      sessions: NOT_TRACKED_SESSIONS,
      contactHistory: NOT_LINKABLE_CONTACT
    }
  };
}

export type PlayerAdminAction =
  | 'suspend'
  | 'unsuspend'
  | 'reset_progression'
  | 'grant_premium'
  | 'revoke_premium'
  | 'hide_leaderboard'
  | 'restore_leaderboard';

export type PlayerActionResult = { ok: true } | { ok: false; error: string };

/** Applies a moderation action and writes an audit-log entry naming the actor. */
export async function applyPlayerAction(
  repositories: RepositoryProvider,
  actor: AdminContext,
  directoryId: string,
  action: PlayerAdminAction
): Promise<PlayerActionResult> {
  const [kind, rawKey] = splitId(directoryId);
  const audit = async (details: Record<string, unknown> = {}) => {
    await repositories.auditLogs.create({
      actorLabel: actor.email,
      action: `admin_player_${action}`,
      targetType: 'player',
      targetId: directoryId,
      details
    });
  };

  if (action === 'suspend' || action === 'unsuspend') {
    if (kind !== 'user') return { ok: false, error: 'Only registered accounts can be suspended.' };
    const updated = await repositories.users.update(rawKey, { isActive: action === 'unsuspend' });
    if (!updated) return { ok: false, error: 'User was not found.' };
    await audit({ isActive: updated.isActive });
    return { ok: true };
  }

  if (action === 'reset_progression') {
    const authUserId = kind === 'user' ? await authUserIdForUser(repositories, rawKey) : undefined;
    const playerKey = playerKeyForId(kind, rawKey, authUserId);
    if (!playerKey) return { ok: false, error: 'This identity has no progression record.' };
    const existing = await repositories.progression.find(playerKey);
    if (!existing) return { ok: false, error: 'This identity has no progression record.' };
    await repositories.progression.save({ playerKey, xp: 0, level: 1, gamesPlayed: 0, unlockedAchievements: [] });
    await audit({ previousXp: existing.xp, previousLevel: existing.level });
    return { ok: true };
  }

  if (action === 'grant_premium' || action === 'revoke_premium') {
    const authUserId = kind === 'user' ? await authUserIdForUser(repositories, rawKey) : kind === 'anon' ? rawKey : undefined;
    if (!authUserId) return { ok: false, error: 'Premium entitlements require a linked account identity.' };
    const existing = (await repositories.payments.listEntitlementsByUserId(authUserId))
      .find(ent => ent.type === 'premium' && ent.source === 'admin');
    await repositories.payments.saveEntitlement({
      id: existing?.id || `ent-admin-${authUserId}`,
      userId: authUserId,
      type: 'premium',
      source: 'admin',
      status: action === 'grant_premium' ? 'active' : 'revoked'
    });
    await audit({ entitlement: 'premium', status: action === 'grant_premium' ? 'active' : 'revoked' });
    return { ok: true };
  }

  // hide_leaderboard / restore_leaderboard
  const nickname = kind === 'nick' ? rawKey : (await buildDirectory(repositories)).find(row => row.id === directoryId)?.nickname;
  if (!nickname) return { ok: false, error: 'This identity has no leaderboard nickname.' };
  const updated = await repositories.leaderboard.setHidden(nickname, action === 'hide_leaderboard');
  if (!updated) return { ok: false, error: 'Leaderboard entry was not found.' };
  await audit({ nickname, hidden: action === 'hide_leaderboard' });
  return { ok: true };
}

// ---------------------------------------------------------------------------

async function buildDirectory(repositories: RepositoryProvider): Promise<AdminPlayerRow[]> {
  const [users, progression, leaderboard, subscriptions] = await Promise.all([
    repositories.users.list({ limit: 10000 }),
    repositories.progression.list({ limit: 10000 }),
    repositories.leaderboard.listAll({ limit: 5000 }),
    repositories.payments.listSubscriptions({ limit: 5000 })
  ]);

  const premiumUserIds = new Set(subscriptions.filter(sub => sub.status === 'active').map(sub => sub.userId));
  const progressionByKey = new Map(progression.map(record => [record.playerKey, record]));
  const boardByAuthUser = new Map(leaderboard.filter(entry => entry.authUserId).map(entry => [entry.authUserId as string, entry]));

  const rows: AdminPlayerRow[] = [];
  const coveredProgression = new Set<string>();
  const coveredNicknames = new Set<string>();

  for (const user of users) {
    const key = user.authUserId || user.id;
    const record = progressionByKey.get(key);
    if (record) coveredProgression.add(record.playerKey);
    const board = user.authUserId ? boardByAuthUser.get(user.authUserId) : undefined;
    if (board) coveredNicknames.add(board.nickname.toLowerCase());
    rows.push({
      id: `user:${user.id}`,
      kind: 'registered',
      displayName: user.displayName,
      nickname: board?.nickname,
      locale: user.locale,
      isActive: user.isActive,
      isHiddenOnLeaderboard: board?.isHidden,
      premium: user.authUserId ? premiumUserIds.has(user.authUserId) : false,
      xp: record?.xp,
      level: record?.level,
      gamesPlayed: record?.gamesPlayed,
      achievements: record?.unlockedAchievements.length,
      bestPrize: board?.bestPrize,
      lastActiveAt: record?.updatedAt || user.lastSeenAt || user.updatedAt,
      createdAt: user.createdAt
    });
  }

  for (const record of progression) {
    if (coveredProgression.has(record.playerKey)) continue;
    const board = boardByAuthUser.get(record.playerKey);
    if (board) coveredNicknames.add(board.nickname.toLowerCase());
    rows.push({
      id: `anon:${record.playerKey}`,
      kind: 'anonymous',
      displayName: board?.nickname || `שחקן אנונימי ${record.playerKey.slice(-6)}`,
      nickname: board?.nickname,
      isActive: true,
      isHiddenOnLeaderboard: board?.isHidden,
      premium: premiumUserIds.has(record.playerKey),
      xp: record.xp,
      level: record.level,
      gamesPlayed: record.gamesPlayed,
      achievements: record.unlockedAchievements.length,
      bestPrize: board?.bestPrize,
      lastActiveAt: record.updatedAt,
      createdAt: record.createdAt
    });
  }

  for (const entry of leaderboard) {
    if (coveredNicknames.has(entry.nickname.toLowerCase())) continue;
    if (entry.authUserId && boardByAuthUser.get(entry.authUserId) === entry && rows.some(row => row.nickname === entry.nickname)) continue;
    rows.push({
      id: `nick:${entry.nickname}`,
      kind: 'leaderboard-only',
      displayName: entry.displayName || entry.nickname,
      nickname: entry.nickname,
      isActive: true,
      isHiddenOnLeaderboard: entry.isHidden,
      premium: false,
      bestPrize: entry.bestPrize,
      gamesPlayed: entry.gamesCount,
      lastActiveAt: entry.updatedAt,
      createdAt: entry.createdAt
    });
  }

  return rows;
}

function splitId(directoryId: string): [string, string] {
  const index = directoryId.indexOf(':');
  return index === -1 ? ['', directoryId] : [directoryId.slice(0, index), directoryId.slice(index + 1)];
}

function playerKeyForId(kind: string, rawKey: string, authUserId?: string): string {
  if (kind === 'anon') return rawKey;
  if (kind === 'user') return authUserId || rawKey;
  return '';
}

async function authUserIdForUser(repositories: RepositoryProvider, userId: string): Promise<string | undefined> {
  const user = await repositories.users.findById(userId);
  return user?.authUserId || user?.id;
}

function time(iso?: string): number {
  if (!iso) return 0;
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}
