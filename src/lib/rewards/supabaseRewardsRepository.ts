import 'server-only';
import { readEnv } from '@/lib/infrastructure/environment';
import {
  appendCareerEntry,
  badgeById,
  defaultIdentity,
  emptyCabinet,
  emptyCareer,
  emptyRewardStats,
  emptyStreak,
  starterEntitlements,
  titleById,
  weeklyObjectiveById
} from '@/lib/rewards';
import type {
  AchievementBadge,
  CareerEarnings,
  CareerLedgerEntry,
  CareerLedgerKind,
  CategoryMastery,
  CollectionRewardKind,
  CollectionState,
  CosmeticEntitlement,
  CosmeticSource,
  CosmeticType,
  DailyQuestionState,
  DailyStreak,
  MasteryTier,
  PlayerIdentity,
  PlayerRewardStats,
  PlayerTitle,
  TimelineEvent,
  TimelineEventType,
  TrophyCabinet,
  WeeklyObjectiveProgress
} from '@/lib/rewards/types';
import type { RewardsProfileSnapshot, RewardsRepository } from '@/lib/repositories/rewardsRepository';

/**
 * Supabase-backed rewards repository — the database provider for Stage 10B.
 *
 * Persists the full rewards snapshot across the `010_rewards_progression`
 * (+ `011_reward_stats`) tables through the service-role REST API. This is the
 * same server-authoritative pattern the main database provider uses: every write
 * goes through the server with the service-role key, so no client can ever
 * self-grant a title, badge, cosmetic or dollar (the tables are RLS
 * service-role-only).
 *
 * The REST surface is injected (`RewardsRestClient`) so the entire snapshot↔row
 * mapping is exercised against an in-memory fake in tests, giving real
 * local↔database parity WITHOUT a live database. Idempotency is inherited from
 * the pure engine (`appendCareerEntry` never double-counts a key) and backstopped
 * by the ledger's `unique (player_key, idempotency_key)` constraint.
 */

export type Row = Record<string, unknown>;

/** Minimal REST surface the repository needs. Real impl = Supabase; fake = in-memory. */
export interface RewardsRestClient {
  /** All rows for a player in a table (PostgREST `player_key=eq.<key>`). */
  selectByPlayer(table: string, playerKey: string): Promise<Row[]>;
  /** Upsert rows, merging on the given conflict columns (comma-separated PK/unique). */
  upsert(table: string, rows: Row[], onConflict: string): Promise<void>;
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : Number(v) || fallback);
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const TABLES = {
  identity: 'player_identity',
  titles: 'player_titles',
  badges: 'player_badges',
  cabinet: 'trophy_cabinet',
  mastery: 'category_mastery',
  collections: 'player_collections',
  career: 'career_earnings',
  ledger: 'career_ledger',
  streak: 'daily_streak',
  daily: 'daily_question_state',
  weekly: 'weekly_objectives',
  cosmetics: 'cosmetic_entitlements',
  timeline: 'profile_timeline'
} as const;

const ALL_TABLES = Object.values(TABLES);

/** PostgREST conflict targets — each is the table's primary key / unique constraint. */
const CONFLICT: Record<string, string> = {
  [TABLES.identity]: 'player_key',
  [TABLES.cabinet]: 'player_key',
  [TABLES.career]: 'player_key',
  [TABLES.streak]: 'player_key',
  [TABLES.titles]: 'player_key,title_id',
  [TABLES.badges]: 'player_key,badge_id',
  [TABLES.mastery]: 'player_key,category_id',
  [TABLES.collections]: 'player_key,collection_id',
  [TABLES.ledger]: 'player_key,idempotency_key',
  [TABLES.daily]: 'player_key,challenge_day',
  [TABLES.weekly]: 'player_key,week_key,objective_id',
  [TABLES.cosmetics]: 'player_key,cosmetic_id',
  [TABLES.timeline]: 'player_key,dedupe_key'
};

/* ==================== Timeline dedupe key (matches 010's unique constraint) ==================== */

function timelineDedupeKey(e: TimelineEvent): string {
  const m = e.metadata ?? {};
  switch (e.type) {
    case 'mastery-tier': return `mastery-tier:${m.category ?? ''}:${m.tier ?? ''}`;
    case 'streak-milestone': return `streak-milestone:${m.length ?? ''}`;
    case 'career-milestone': return `career-milestone:${m.amount ?? ''}`;
    case 'title-earned': return `title-earned:${m.title ?? ''}`;
    case 'collection-complete': return `collection-complete:${m.collection ?? ''}`;
    case 'personal-record': return `personal-record:${m.kind ?? ''}`;
    default: return e.type; // one-shot lifetime events (joined, first-game, …)
  }
}

/* ==================== Snapshot -> table rows (pure, tested) ==================== */

export function snapshotToTableRows(snapshot: RewardsProfileSnapshot): Record<string, Row[]> {
  const key = snapshot.identity.playerKey;
  return {
    [TABLES.identity]: [{
      player_key: key,
      display_name: snapshot.identity.displayName,
      monogram_seed: snapshot.identity.monogramSeed,
      active_title_id: snapshot.identity.activeTitleId,
      profile_frame_id: snapshot.identity.profileFrameId,
      pinned_badge_ids: snapshot.identity.pinnedBadgeIds,
      equipped_theme_id: snapshot.identity.equippedThemeId
    }],
    [TABLES.cabinet]: [{ player_key: key, slots: snapshot.trophyCabinet.slots, max_slots: snapshot.trophyCabinet.maxSlots }],
    [TABLES.career]: [{
      player_key: key,
      lifetime_total: snapshot.career.lifetimeTotal,
      spendable_balance: snapshot.career.spendableBalance,
      best_single_game: snapshot.career.bestSingleGame,
      millionaire_wins: snapshot.career.millionaireWins,
      perfect_runs: snapshot.career.perfectRuns,
      cash_out_total: snapshot.career.cashOutTotal,
      games_won: snapshot.career.gamesWon,
      games_played: snapshot.career.gamesPlayed,
      stats: snapshot.stats // jsonb column added by migration 011
    }],
    [TABLES.streak]: [{
      player_key: key,
      current: snapshot.streak.current,
      longest: snapshot.streak.longest,
      last_qualifying_day: snapshot.streak.lastQualifyingDay,
      repair_used_week: snapshot.streak.repairUsedWeek
    }],
    [TABLES.titles]: snapshot.titles.map(t => ({ player_key: key, title_id: t.id, earned_at: t.earnedAt, equipped: t.equipped })),
    [TABLES.badges]: snapshot.badges.map(b => ({ player_key: key, badge_id: b.id, progress: b.current, unlocked_at: b.unlockedAt })),
    [TABLES.mastery]: snapshot.mastery.map(m => ({
      player_key: key,
      category_id: m.categoryId,
      mastery_xp: m.masteryXp,
      tier: m.tier,
      games_played: m.gamesPlayed,
      correct_answers: m.correctAnswers,
      questions_faced: m.questionsFaced,
      milestones: m.milestones
    })),
    [TABLES.collections]: snapshot.collections.map(c => ({
      player_key: key,
      collection_id: c.collectionId,
      earned_item_ids: c.earnedItemIds,
      completion_reward: c.completionReward,
      completed: c.completed
    })),
    [TABLES.ledger]: snapshot.career.ledger.map(e => ({
      player_key: key,
      id: e.id,
      kind: e.kind,
      amount: e.amount,
      idempotency_key: e.idempotencyKey,
      metadata: e.metadata ?? {},
      created_at: e.createdAt
    })),
    [TABLES.daily]: snapshot.daily ? [{
      player_key: key,
      challenge_day: snapshot.daily.challengeDay,
      question_id: snapshot.daily.questionId,
      completed: snapshot.daily.completed,
      correct: snapshot.daily.correct,
      reward_claimed: snapshot.daily.rewardClaimed
    }] : [],
    [TABLES.weekly]: snapshot.weekly.map(o => ({
      player_key: key,
      week_key: o.weekKey,
      objective_id: o.objectiveId,
      progress: o.progress,
      target: o.target,
      reward_amount: o.rewardAmount,
      claimed: o.claimed,
      seen_keys: o.seenKeys ?? []
    })),
    [TABLES.cosmetics]: snapshot.cosmetics.map(c => ({
      player_key: key,
      cosmetic_id: c.cosmeticId,
      type: c.type,
      source: c.source,
      unlocked_at: c.unlockedAt,
      equipped: c.equipped
    })),
    [TABLES.timeline]: snapshot.timeline.map(e => ({
      player_key: key,
      id: e.id,
      event_type: e.type,
      copy_key: e.copyKey,
      dedupe_key: timelineDedupeKey(e),
      metadata: e.metadata ?? {},
      visible: e.visible,
      occurred_at: e.timestamp
    }))
  };
}

/* ==================== Table rows -> snapshot (pure, tested) ==================== */

export function tableRowsToSnapshot(playerKey: string, byTable: Record<string, Row[]>, nowIso: string): RewardsProfileSnapshot {
  const get = (t: string): Row[] => byTable[t] ?? [];
  const identityRow = get(TABLES.identity)[0];
  const careerRow = get(TABLES.career)[0];
  const streakRow = get(TABLES.streak)[0];
  const cabinetRow = get(TABLES.cabinet)[0];

  const ledger: CareerLedgerEntry[] = get(TABLES.ledger).map(r => ({
    id: str(r.id),
    kind: str(r.kind, 'game-win') as CareerLedgerKind,
    amount: num(r.amount),
    idempotencyKey: str(r.idempotency_key),
    createdAt: str(r.created_at),
    metadata: (r.metadata as Record<string, string | number>) ?? undefined
  }));

  const career: CareerEarnings = careerRow
    ? {
        lifetimeTotal: num(careerRow.lifetime_total),
        spendableBalance: num(careerRow.spendable_balance),
        bestSingleGame: num(careerRow.best_single_game),
        millionaireWins: num(careerRow.millionaire_wins),
        perfectRuns: num(careerRow.perfect_runs),
        cashOutTotal: num(careerRow.cash_out_total),
        gamesWon: num(careerRow.games_won),
        gamesPlayed: num(careerRow.games_played),
        ledger
      }
    : emptyCareer();

  const stats: PlayerRewardStats = careerRow && careerRow.stats && typeof careerRow.stats === 'object'
    ? { ...emptyRewardStats(), ...(careerRow.stats as Partial<PlayerRewardStats>) }
    : emptyRewardStats();

  const identity: PlayerIdentity = identityRow
    ? {
        playerKey,
        displayName: str(identityRow.display_name),
        monogramSeed: str(identityRow.monogram_seed),
        activeTitleId: (identityRow.active_title_id as string | null) ?? null,
        profileFrameId: str(identityRow.profile_frame_id, 'frame-classic'),
        pinnedBadgeIds: list<string>(identityRow.pinned_badge_ids),
        equippedThemeId: str(identityRow.equipped_theme_id, 'theme-studio'),
        careerSummary: {
          lifetimeTotal: career.lifetimeTotal,
          bestSingleGame: career.bestSingleGame,
          gamesPlayed: career.gamesPlayed
        }
      }
    : defaultIdentity(playerKey, '');

  const badges: AchievementBadge[] = get(TABLES.badges)
    .map(r => {
      const def = badgeById(str(r.badge_id));
      if (!def) return null;
      return {
        id: def.id,
        category: def.category,
        rarity: def.rarity,
        nameKey: def.nameKey,
        descriptionKey: def.descriptionKey,
        target: def.target,
        current: num(r.progress),
        unlockedAt: (r.unlocked_at as string | null) ?? null,
        hidden: def.hidden,
        showcaseEligible: def.showcaseEligible
      } satisfies AchievementBadge;
    })
    .filter((b): b is AchievementBadge => b !== null);

  const titles: PlayerTitle[] = get(TABLES.titles).map(r => {
    const id = str(r.title_id);
    const def = titleById(id);
    return {
      id,
      nameKey: def?.nameKey ?? `rewards.title.${id}.name`,
      descriptionKey: def?.descriptionKey ?? `rewards.title.${id}.desc`,
      rarity: def?.rarity ?? 'common',
      earnedAt: (r.earned_at as string | null) ?? null,
      equipped: bool(r.equipped)
    };
  });

  const mastery: CategoryMastery[] = get(TABLES.mastery).map(r => ({
    categoryId: str(r.category_id),
    masteryXp: num(r.mastery_xp),
    tier: str(r.tier, 'none') as MasteryTier,
    gamesPlayed: num(r.games_played),
    correctAnswers: num(r.correct_answers),
    questionsFaced: num(r.questions_faced),
    milestones: list<MasteryTier>(r.milestones)
  }));

  const collections: CollectionState[] = get(TABLES.collections).map(r => ({
    collectionId: str(r.collection_id),
    earnedItemIds: list<string>(r.earned_item_ids),
    completionReward: (r.completion_reward as CollectionRewardKind | null) ?? null,
    completed: bool(r.completed)
  }));

  const streak: DailyStreak = streakRow
    ? {
        current: num(streakRow.current),
        longest: num(streakRow.longest),
        lastQualifyingDay: (streakRow.last_qualifying_day as string | null) ?? null,
        repairUsedWeek: (streakRow.repair_used_week as string | null) ?? null
      }
    : emptyStreak();

  // Daily: the most recent challenge day.
  const dailyRow = [...get(TABLES.daily)].sort((a, b) => str(b.challenge_day).localeCompare(str(a.challenge_day)))[0];
  const daily: DailyQuestionState | null = dailyRow
    ? {
        challengeDay: str(dailyRow.challenge_day),
        questionId: str(dailyRow.question_id),
        completed: bool(dailyRow.completed),
        correct: (dailyRow.correct as boolean | null) ?? null,
        rewardClaimed: bool(dailyRow.reward_claimed)
      }
    : null;

  // Weekly: only the most recent week's objectives (older weeks stay in the DB
  // as history; the engine resets to the current week on read if needed).
  const allWeekly = get(TABLES.weekly);
  const latestWeek = allWeekly.reduce((max, r) => (str(r.week_key) > max ? str(r.week_key) : max), '');
  const weekly: WeeklyObjectiveProgress[] = allWeekly
    .filter(r => latestWeek !== '' && str(r.week_key) === latestWeek)
    .map(r => {
      const objectiveId = str(r.objective_id);
      const o: WeeklyObjectiveProgress = {
        objectiveId,
        weekKey: str(r.week_key),
        progress: num(r.progress),
        target: num(r.target),
        rewardAmount: num(r.reward_amount),
        claimed: bool(r.claimed)
      };
      // Match the engine's convention (initWeeklyProgress): only set-based
      // objectives carry a seenKeys array; others leave it undefined. The
      // not-null `seen_keys` column always round-trips to `[]`, so we restore
      // the distinction from the objective definition rather than the row.
      if (weeklyObjectiveById(objectiveId)?.metric === 'distinct-categories') {
        o.seenKeys = list<string>(r.seen_keys);
      }
      return o;
    });

  const cosmeticRows = get(TABLES.cosmetics);
  const cosmetics: CosmeticEntitlement[] = cosmeticRows.length
    ? cosmeticRows.map(r => ({
        cosmeticId: str(r.cosmetic_id),
        type: str(r.type) as CosmeticType,
        source: str(r.source) as CosmeticSource,
        unlockedAt: str(r.unlocked_at),
        equipped: bool(r.equipped)
      }))
    : starterEntitlements(nowIso);

  const timeline: TimelineEvent[] = get(TABLES.timeline).map(r => ({
    id: str(r.id),
    type: str(r.event_type) as TimelineEventType,
    copyKey: str(r.copy_key),
    timestamp: str(r.occurred_at),
    metadata: (r.metadata as Record<string, string | number>) ?? undefined,
    visible: bool(r.visible, true)
  }));

  return {
    identity,
    career,
    titles,
    badges,
    trophyCabinet: cabinetFromRow(cabinetRow),
    mastery,
    collections,
    streak,
    daily,
    weekly,
    cosmetics,
    timeline,
    stats
  };
}

function cabinetFromRow(row: Row | undefined): TrophyCabinet {
  if (!row) return emptyCabinet(6);
  const maxSlots = num(row.max_slots, 6);
  const slots = list<string | null>(row.slots);
  return { slots: slots.length ? slots : Array.from({ length: maxSlots }, () => null), maxSlots };
}

function emptyBaseSnapshot(playerKey: string, displayName: string, nowIso: string): RewardsProfileSnapshot {
  return {
    identity: defaultIdentity(playerKey, displayName),
    career: emptyCareer(),
    titles: [],
    badges: [],
    trophyCabinet: emptyCabinet(6),
    mastery: [],
    collections: [],
    streak: emptyStreak(),
    daily: null,
    weekly: [],
    cosmetics: starterEntitlements(nowIso),
    timeline: [],
    stats: emptyRewardStats()
  };
}

/* ==================== Repository ==================== */

export function createSupabaseRewardsRepository(
  client: RewardsRestClient = createSupabaseRestClient(),
  nowIso: () => string = () => new Date().toISOString()
): RewardsRepository {
  async function load(playerKey: string, displayName = ''): Promise<RewardsProfileSnapshot> {
    const results = await Promise.all(ALL_TABLES.map(t => client.selectByPlayer(t, playerKey)));
    const byTable: Record<string, Row[]> = {};
    ALL_TABLES.forEach((t, i) => { byTable[t] = results[i]; });

    const hasAnyRows = results.some(rows => rows.length > 0);
    if (!hasAnyRows) return emptyBaseSnapshot(playerKey, displayName, nowIso());

    const snapshot = tableRowsToSnapshot(playerKey, byTable, nowIso());
    if (!snapshot.identity.displayName && displayName) snapshot.identity.displayName = displayName;
    return snapshot;
  }

  async function save(snapshot: RewardsProfileSnapshot): Promise<RewardsProfileSnapshot> {
    const rows = snapshotToTableRows(snapshot);
    await Promise.all(
      Object.entries(rows).map(([table, tableRows]) =>
        tableRows.length ? client.upsert(table, tableRows, CONFLICT[table]) : Promise.resolve()
      )
    );
    return snapshot;
  }

  return {
    load,
    save,
    async appendLedgerEntry(playerKey, entry) {
      const snapshot = await load(playerKey);
      const career = appendCareerEntry(snapshot.career, entry); // idempotent: dupes are a no-op
      await save({ ...snapshot, career });
      return career;
    }
  };
}

/* ==================== Real service-role REST client ==================== */

/**
 * Fetch-based PostgREST client using the service-role key — mirrors the main
 * database provider. Fails loud if the Supabase env is missing so a database
 * deployment never silently runs without persistence.
 */
export function createSupabaseRestClient(): RewardsRestClient {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase rewards provider requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  const base = url.replace(/\/$/, '');
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json'
  };

  return {
    async selectByPlayer(table, playerKey) {
      const response = await fetch(
        `${base}/rest/v1/${table}?player_key=eq.${encodeURIComponent(playerKey)}&select=*`,
        { headers, cache: 'no-store' }
      );
      if (!response.ok) throw new Error(`Supabase rewards select ${table} failed: ${response.status}`);
      return (await response.json()) as Row[];
    },
    async upsert(table, rows, onConflict) {
      if (rows.length === 0) return;
      const response = await fetch(`${base}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Supabase rewards upsert ${table} failed: ${response.status}`);
    }
  };
}
