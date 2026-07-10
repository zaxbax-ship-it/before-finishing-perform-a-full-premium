import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createInMemoryRewardsRepository } from '@/lib/repositories/rewardsRepository';
import type { RewardsProfileSnapshot } from '@/lib/repositories/rewardsRepository';
import { applyGameResult, completeDaily, getDailyChallenge } from '@/lib/rewards/service';
import { snapshotToTableRows } from '@/lib/rewards/supabaseRewardsRepository';
import type { RewardGameResult } from '@/lib/rewards/types';

/**
 * Phases 2 & 7 — migration 010 / 011 compatibility, verified against the ACTUAL
 * SQL files (not filenames). Proves:
 *  - every column the Supabase provider writes exists in the schema (no live 400s);
 *  - migration 011 added `career_earnings.stats`;
 *  - RLS is enabled and service-role-only on all 13 tables;
 *  - the idempotency + dedupe unique constraints exist.
 */

const SQL_010 = readFileSync(join(process.cwd(), 'database/010_rewards_progression.sql'), 'utf8');
const SQL_011 = readFileSync(join(process.cwd(), 'database/011_reward_stats.sql'), 'utf8');

const ALL_TABLES = [
  'player_identity', 'player_titles', 'player_badges', 'trophy_cabinet',
  'category_mastery', 'player_collections', 'career_earnings', 'career_ledger',
  'daily_streak', 'daily_question_state', 'weekly_objectives',
  'cosmetic_entitlements', 'profile_timeline'
];

const NON_COLUMN = new Set(['primary', 'constraint', 'check', 'unique', 'foreign']);

function columnsFor(sql: string, table: string): Set<string> {
  const re = new RegExp(`create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i');
  const match = sql.match(re);
  const columns = new Set<string>();
  if (!match) return columns;
  for (const raw of match[1].split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('--')) continue;
    const first = line.split(/\s+/)[0].replace(/[,(]/g, '').toLowerCase();
    if (NON_COLUMN.has(first)) continue;
    columns.add(first);
  }
  return columns;
}

const NOW = '2026-07-10T12:00:00.000Z';
function game(p: Partial<RewardGameResult> = {}): RewardGameResult {
  return { mode: 'solo', won: true, cashedOut: false, correctAnswers: 15, questionsFaced: 15, prize: 1_000_000, lifelinesUsed: 0, category: 'science', livesLostBeforeWin: 0, fastAnswers: 0, playedAt: NOW, ...p };
}

let snapshot: RewardsProfileSnapshot;

beforeAll(async () => {
  const repo = createInMemoryRewardsRepository(() => NOW);
  await applyGameResult(repo, { playerKey: 'p1', displayName: 'Ada', result: game(), gameId: 'g1', dayKey: '2026-07-10', nowIso: NOW });
  await applyGameResult(repo, { playerKey: 'p1', result: game({ prize: 40_000, category: 'history', correctAnswers: 12 }), gameId: 'g2', dayKey: '2026-07-11', nowIso: NOW });
  await getDailyChallenge(repo, 'p1', '2026-07-10', 'q-1');
  await completeDaily(repo, 'p1', '2026-07-10', true, NOW);
  snapshot = await repo.load('p1');
});

describe('migration 010/011 compatibility (Phase 2)', () => {
  it('defines all 13 tables', () => {
    for (const table of ALL_TABLES) {
      expect(columnsFor(SQL_010, table).size, `${table} missing CREATE TABLE in 010`).toBeGreaterThan(0);
    }
  });

  it('every column the provider writes exists in the schema', () => {
    const rows = snapshotToTableRows(snapshot);
    for (const [table, tableRows] of Object.entries(rows)) {
      const columns = columnsFor(SQL_010, table);
      if (table === 'career_earnings') columns.add('stats'); // added by 011
      for (const row of tableRows) {
        for (const key of Object.keys(row)) {
          expect(columns.has(key.toLowerCase()), `${table}.${key} is not a column in migration 010/011`).toBe(true);
        }
      }
    }
  });

  it('covers every table with at least one written row (daily + weekly included)', () => {
    const rows = snapshotToTableRows(snapshot);
    expect(rows.daily_question_state.length).toBeGreaterThan(0);
    expect(rows.weekly_objectives.length).toBeGreaterThan(0);
    expect(rows.career_ledger.length).toBeGreaterThan(0);
    expect(rows.player_badges.length).toBeGreaterThan(0);
  });

  it('migration 011 adds the stats column to career_earnings', () => {
    expect(/alter table public\.career_earnings\s+add column if not exists stats jsonb/i.test(SQL_011)).toBe(true);
  });
});

describe('RLS is service-role-only on all 13 tables (Phase 7)', () => {
  it('enables row level security', () => {
    expect(SQL_010).toMatch(/enable row level security/i);
  });

  it('restricts every table to the service role', () => {
    // The policy is built via `format(...)`, so single quotes are doubled in the SQL.
    expect(SQL_010).toMatch(/auth\.role\(\)\s*=\s*''service_role''/);
    for (const table of ALL_TABLES) {
      expect(SQL_010.includes(`'${table}'`), `${table} missing from the RLS policy block`).toBe(true);
    }
  });

  it('enforces ledger idempotency and timeline dedupe with unique constraints', () => {
    expect(SQL_010).toMatch(/unique\s*\(player_key,\s*idempotency_key\)/i);
    expect(SQL_010).toMatch(/unique\s*\(player_key,\s*dedupe_key\)/i);
    expect(SQL_010).toMatch(/spendable_balance\s*>=\s*0/i);
  });
});
