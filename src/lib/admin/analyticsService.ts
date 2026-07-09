import 'server-only';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';

/**
 * Business analytics — pure aggregation over repositories, same honesty rule
 * as the dashboard metrics: real numbers or an explicit unavailable reason.
 *
 * What IS real today:
 *  - the multiplayer funnel (lobby created → game started → game finished)
 *  - engagement from progression records (games per player, DAU/MAU)
 *  - category/prize distributions
 *  - premium conversion from subscriptions vs active players
 *  - lobby drop-off (created but expired/cancelled before starting)
 */

const NOT_TRACKED_EVENTS = 'Requires a per-event analytics log, which the platform does not record yet.';
const NOT_TRACKED_ADS = 'No ad provider is connected; ad revenue does not exist yet.';

export type AnalyticsFunnelStep = { name: string; value: number; ratioOfPrevious: number | null };

export type AdminAnalytics = {
  generatedAt: string;
  engagement: {
    dailyActivePlayers: number;
    monthlyActivePlayers: number;
    stickiness: number | null;
    averageGamesPerPlayer: number | null;
    averageXpPerPlayer: number | null;
  };
  multiplayerFunnel: AnalyticsFunnelStep[];
  lobbyDropOff: { created: number; neverStarted: number; dropOffRate: number | null };
  premium: { activePlayers: number; activeSubscriptions: number; conversionRate: number | null; completedRevenue: number };
  categoryPopularity: Array<{ name: string; value: number }>;
  prizeDistribution: Array<{ name: string; value: number }>;
  unavailable: Record<string, string>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildAdminAnalytics(repositories: RepositoryProvider, now = new Date()): Promise<AdminAnalytics> {
  const [progression, lobbies, games, leaderboard, transactions, subscriptions, questions] = await Promise.all([
    repositories.progression.list({ limit: 10000 }),
    repositories.multiplayer.listLobbies({ limit: 1000 }),
    repositories.multiplayer.listGames({ limit: 1000 }),
    repositories.leaderboard.listAll({ limit: 5000 }),
    repositories.payments.listTransactions({ limit: 5000 }),
    repositories.payments.listSubscriptions({ limit: 5000 }),
    repositories.approvedQuestions.list({})
  ]);

  const dau = progression.filter(record => now.getTime() - new Date(record.updatedAt).getTime() < DAY_MS).length;
  const mau = progression.filter(record => now.getTime() - new Date(record.updatedAt).getTime() < 30 * DAY_MS).length;
  const totalGames = progression.reduce((sum, record) => sum + record.gamesPlayed, 0);
  const totalXp = progression.reduce((sum, record) => sum + record.xp, 0);

  const started = games.filter(game => game.startedAt).length;
  const finishedGames = games.filter(game => game.status === 'finished').length;
  const funnel: AnalyticsFunnelStep[] = [
    { name: 'חדרים שנפתחו', value: lobbies.length, ratioOfPrevious: null },
    { name: 'משחקים שהתחילו', value: started, ratioOfPrevious: lobbies.length ? Math.round((started / lobbies.length) * 100) : null },
    { name: 'משחקים שהסתיימו', value: finishedGames, ratioOfPrevious: started ? Math.round((finishedGames / started) * 100) : null }
  ];

  const neverStarted = lobbies.filter(lobby => !lobby.gameId && (lobby.status === 'expired' || lobby.status === 'cancelled')).length;

  const activePlayers = Math.max(progression.length, leaderboard.length);
  const activeSubscriptions = subscriptions.filter(sub => sub.status === 'active').length;

  const categoryCounts = new Map<string, number>();
  for (const question of questions) categoryCounts.set(question.category, (categoryCounts.get(question.category) || 0) + 1);

  const buckets: Array<[string, (prize: number) => boolean]> = [
    ['$0', prize => prize === 0],
    ['עד $10K', prize => prize > 0 && prize <= 10000],
    ['עד $100K', prize => prize > 10000 && prize <= 100000],
    ['עד $500K', prize => prize > 100000 && prize <= 500000],
    ['מעל $500K', prize => prize > 500000]
  ];

  return {
    generatedAt: now.toISOString(),
    engagement: {
      dailyActivePlayers: dau,
      monthlyActivePlayers: mau,
      stickiness: mau > 0 ? Math.round((dau / mau) * 100) : null,
      averageGamesPerPlayer: progression.length ? Math.round((totalGames / progression.length) * 10) / 10 : null,
      averageXpPerPlayer: progression.length ? Math.round(totalXp / progression.length) : null
    },
    multiplayerFunnel: funnel,
    lobbyDropOff: {
      created: lobbies.length,
      neverStarted,
      dropOffRate: lobbies.length ? Math.round((neverStarted / lobbies.length) * 100) : null
    },
    premium: {
      activePlayers,
      activeSubscriptions,
      conversionRate: activePlayers ? Math.round((activeSubscriptions / activePlayers) * 1000) / 10 : null,
      completedRevenue: transactions.filter(tx => tx.status === 'completed').reduce((sum, tx) => sum + tx.amount, 0)
    },
    categoryPopularity: [...categoryCounts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12),
    prizeDistribution: buckets.map(([name, test]) => ({ name, value: leaderboard.filter(entry => test(entry.bestPrize)).length })),
    unavailable: {
      sessionDuration: NOT_TRACKED_EVENTS,
      retentionCohorts: NOT_TRACKED_EVENTS,
      screenFunnels: NOT_TRACKED_EVENTS,
      adRevenue: NOT_TRACKED_ADS
    }
  };
}
