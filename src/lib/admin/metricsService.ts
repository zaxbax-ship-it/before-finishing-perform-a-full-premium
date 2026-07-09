import 'server-only';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import type {
  AdminBreakdown,
  AdminChart,
  AdminMetricValue,
  AdminOverviewCards,
  AdminOverviewCharts,
  AdminOverviewResponse,
  AdminSeriesPoint
} from '@/lib/api/contracts/admin';

/**
 * Admin metrics — pure aggregation over the repository layer.
 *
 * Platform-neutral by construction: repositories in, contract shapes out; no
 * Next.js, no UI, no vendor calls. The same aggregation runs against the
 * local-json provider in development and Supabase in production, and native
 * admin clients get identical numbers through /api/admin/overview.
 *
 * Honesty rule: a metric is either computed from real repository data or
 * reported as `{ available: false, reason }`. Nothing is estimated.
 */

const NOT_TRACKED_PRESENCE = 'Presence tracking is not implemented; only multiplayer connections are observable.';
const NOT_TRACKED_EVENTS = 'Requires a per-event analytics log, which the platform does not record yet.';
const NOT_TRACKED_DEVICE = 'Device/user-agent analytics are not recorded.';
const NOT_TRACKED_GEO = 'No geo/IP analytics are recorded (only salted hashes are stored).';

const DAY_MS = 24 * 60 * 60 * 1000;

function value(v: number, unit?: 'count' | 'usd' | 'xp' | 'percent'): AdminMetricValue {
  return { available: true, value: v, unit };
}

function notTracked(reason: string): AdminMetricValue {
  return { available: false, reason };
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function isToday(iso: string, now: Date): boolean {
  return dayKey(iso) === now.toISOString().slice(0, 10);
}

function withinDays(iso: string, days: number, now: Date): boolean {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && now.getTime() - time <= days * DAY_MS;
}

/** Buckets ISO timestamps into a day series over the trailing `days` window. */
export function bucketByDay(timestamps: string[], days: number, now = new Date()): AdminSeriesPoint[] {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    buckets.set(new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10), 0);
  }
  for (const iso of timestamps) {
    const key = dayKey(iso);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, value: count }));
}

function chart(points: AdminSeriesPoint[]): AdminChart {
  return { available: true, points };
}

function breakdown(items: Array<{ name: string; value: number }>): AdminBreakdown {
  return { available: true, items: items.sort((a, b) => b.value - a.value) };
}

export async function buildAdminOverview(repositories: RepositoryProvider, now = new Date()): Promise<AdminOverviewResponse> {
  const [users, progression, lobbies, games, mpPlayersSource, leaderboard, transactions, subscriptions, questions, auditLogs] = await Promise.all([
    repositories.users.list({ limit: 10000 }),
    repositories.progression.list({ limit: 10000 }),
    repositories.multiplayer.listLobbies({ limit: 1000 }),
    repositories.multiplayer.listGames({ limit: 1000 }),
    collectMultiplayerPlayers(repositories),
    repositories.leaderboard.listAll({ limit: 5000 }),
    repositories.payments.listTransactions({ limit: 5000 }),
    repositories.payments.listSubscriptions({ limit: 5000 }),
    repositories.approvedQuestions.list({}),
    repositories.auditLogs.list({ limit: 1000 })
  ]);

  // Identity note: `users` are registered accounts; `progression` rows are one
  // per active player key (auth id or anonymous device) — the closest real
  // signal this platform has for active players.
  const connectedPlayers = mpPlayersSource.filter(
    player => player.isConnected && withinDays(player.lastSeenAt, 1, now) && new Date(player.lastSeenAt).getTime() > now.getTime() - 2 * 60 * 1000
  );

  const completedRevenue = transactions.filter(tx => tx.status === 'completed');
  const contactMessages = auditLogs.filter(log => log.action === 'contact_message_received');

  const cards: AdminOverviewCards = {
    users: value(users.length),
    onlineUsers: connectedPlayers.length > 0
      ? value(connectedPlayers.length)
      : progression.length === 0 && users.length === 0
        ? notTracked(NOT_TRACKED_PRESENCE)
        : value(connectedPlayers.length),
    dailyActiveUsers: value(progression.filter(record => isToday(record.updatedAt, now)).length),
    monthlyActiveUsers: value(progression.filter(record => withinDays(record.updatedAt, 30, now)).length),
    gamesToday: value(games.filter(game => isToday(game.createdAt, now)).length),
    multiplayerGames: value(games.length),
    totalQuestionsAnswered: notTracked(NOT_TRACKED_EVENTS),
    averageScore: leaderboard.length
      ? value(Math.round(leaderboard.reduce((sum, entry) => sum + entry.bestPrize, 0) / leaderboard.length), 'usd')
      : value(0, 'usd'),
    contactRequests: value(contactMessages.length),
    revenue: value(completedRevenue.reduce((sum, tx) => sum + tx.amount, 0), 'usd'),
    premiumUsers: value(subscriptions.filter(sub => sub.status === 'active').length),
    xpEarnedToday: notTracked(NOT_TRACKED_EVENTS)
  };

  const localeCounts = new Map<string, number>();
  for (const lobby of lobbies) localeCounts.set(lobby.locale, (localeCounts.get(lobby.locale) || 0) + 1);

  const categoryCounts = new Map<string, number>();
  const difficultyCounts = new Map<string, number>();
  for (const question of questions) {
    categoryCounts.set(question.category, (categoryCounts.get(question.category) || 0) + 1);
    difficultyCounts.set(question.difficulty, (difficultyCounts.get(question.difficulty) || 0) + 1);
  }

  const charts: AdminOverviewCharts = {
    usersOverTime: chart(bucketByDay([...users.map(user => user.createdAt), ...progression.map(record => record.createdAt)], 30, now)),
    gamesOverTime: chart(bucketByDay(games.map(game => game.createdAt), 30, now)),
    revenueOverTime: chart(bucketByDay(completedRevenue.map(tx => tx.createdAt), 30, now)),
    multiplayerActivity: chart(bucketByDay(lobbies.map(lobby => lobby.createdAt), 30, now)),
    categoryPopularity: breakdown([...categoryCounts.entries()].map(([name, count]) => ({ name, value: count }))),
    questionDifficulty: breakdown([...difficultyCounts.entries()].map(([name, count]) => ({ name, value: count }))),
    languages: breakdown([...localeCounts.entries()].map(([name, count]) => ({ name, value: count }))),
    retention: { available: false, reason: NOT_TRACKED_EVENTS },
    deviceDistribution: { available: false, reason: NOT_TRACKED_DEVICE },
    countries: { available: false, reason: NOT_TRACKED_GEO }
  };

  return {
    ok: true,
    generatedAt: now.toISOString(),
    provider: repositories.kind,
    serverStatus: 'ok',
    cards,
    charts
  };
}

async function collectMultiplayerPlayers(repositories: RepositoryProvider) {
  const lobbies = await repositories.multiplayer.listLobbies({ limit: 200 });
  const active = lobbies.filter(lobby => lobby.status === 'waiting' || lobby.status === 'ready' || lobby.status === 'starting' || lobby.status === 'in_progress');
  const playersByLobby = await Promise.all(active.map(lobby => repositories.multiplayer.listPlayers(lobby.id)));
  return playersByLobby.flat();
}
