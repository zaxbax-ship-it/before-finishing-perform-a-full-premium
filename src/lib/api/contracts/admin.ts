import { isRecord } from './common';

/**
 * Admin console contracts — platform-neutral shapes served by /api/admin/*.
 *
 * Every metric is an {@link AdminMetricValue}: either a real number computed
 * from repository data, or an explicit `{ available: false, reason }` when the
 * platform does not track the underlying signal yet. Admin clients (web
 * console today, native consoles later) must render unavailable metrics as
 * honest empty states — the API never fabricates a value.
 */

export type AdminMetricValue =
  | { available: true; value: number; unit?: 'count' | 'usd' | 'xp' | 'percent' }
  | { available: false; reason: string };

export type AdminSeriesPoint = { date: string; value: number };
export type AdminNamedCount = { name: string; value: number };

export type AdminChart =
  | { available: true; points: AdminSeriesPoint[] }
  | { available: false; reason: string };

export type AdminBreakdown =
  | { available: true; items: AdminNamedCount[] }
  | { available: false; reason: string };

export type AdminOverviewCards = {
  users: AdminMetricValue;
  onlineUsers: AdminMetricValue;
  dailyActiveUsers: AdminMetricValue;
  monthlyActiveUsers: AdminMetricValue;
  gamesToday: AdminMetricValue;
  multiplayerGames: AdminMetricValue;
  totalQuestionsAnswered: AdminMetricValue;
  averageScore: AdminMetricValue;
  contactRequests: AdminMetricValue;
  revenue: AdminMetricValue;
  premiumUsers: AdminMetricValue;
  xpEarnedToday: AdminMetricValue;
};

export type AdminOverviewCharts = {
  usersOverTime: AdminChart;
  gamesOverTime: AdminChart;
  revenueOverTime: AdminChart;
  multiplayerActivity: AdminChart;
  categoryPopularity: AdminBreakdown;
  questionDifficulty: AdminBreakdown;
  languages: AdminBreakdown;
  retention: AdminChart;
  deviceDistribution: AdminBreakdown;
  countries: AdminBreakdown;
};

export type AdminOverviewResponse = {
  ok: true;
  generatedAt: string;
  provider: 'local-json' | 'database';
  serverStatus: 'ok' | 'degraded';
  cards: AdminOverviewCards;
  charts: AdminOverviewCharts;
};

export function isAdminOverviewResponse(value: unknown): value is AdminOverviewResponse {
  if (!isRecord(value) || value.ok !== true) return false;
  return isRecord(value.cards) && isRecord(value.charts) && typeof value.generatedAt === 'string';
}
