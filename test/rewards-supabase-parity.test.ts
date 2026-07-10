import { describe, expect, it } from 'vitest';
import { createInMemoryRewardsRepository, type RewardsRepository } from '@/lib/repositories/rewardsRepository';
import {
  applyGameResult,
  claimWeekly,
  completeDaily,
  getDailyChallenge,
  getFullProfile,
  getWeekly
} from '@/lib/rewards/service';
import {
  createSupabaseRewardsRepository,
  snapshotToTableRows,
  tableRowsToSnapshot,
  type Row,
  type RewardsRestClient
} from '@/lib/rewards/supabaseRewardsRepository';
import type { RewardGameResult } from '@/lib/rewards/types';

const NOW = '2026-07-10T12:00:00.000Z';

function game(p: Partial<RewardGameResult> = {}): RewardGameResult {
  return {
    mode: 'solo',
    won: true,
    cashedOut: false,
    correctAnswers: 15,
    questionsFaced: 15,
    prize: 1_000_000,
    lifelinesUsed: 0,
    category: 'science',
    livesLostBeforeWin: 0,
    fastAnswers: 0,
    playedAt: NOW,
    ...p
  };
}

/**
 * In-memory fake of the service-role REST surface. Faithfully mimics PostgREST
 * `player_key=eq.<key>` selects and `merge-duplicates` upserts (keyed on the
 * conflict columns), with JSON cloning at the boundary to mimic the wire. This
 * lets the ENTIRE Supabase mapping run in a unit test — real local↔database parity
 * without a live database.
 */
function createFakeRestClient(): RewardsRestClient {
  const tables = new Map<string, Row[]>();
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  return {
    async selectByPlayer(table, playerKey) {
      const rows = tables.get(table) ?? [];
      return clone(rows.filter(r => r.player_key === playerKey));
    },
    async upsert(table, rows, onConflict) {
      const cols = onConflict.split(',');
      const existing = tables.get(table) ?? [];
      for (const incoming of rows) {
        const idx = existing.findIndex(r => cols.every(c => r[c] === incoming[c]));
        if (idx >= 0) existing[idx] = clone(incoming);
        else existing.push(clone(incoming));
      }
      tables.set(table, existing);
    }
  };
}

function bothRepos(): { local: RewardsRepository; db: RewardsRepository } {
  return {
    local: createInMemoryRewardsRepository(() => NOW),
    db: createSupabaseRewardsRepository(createFakeRestClient(), () => NOW)
  };
}

/** Run the identical operation against both repos and assert byte-identical results. */
async function parity<T>(fn: (repo: RewardsRepository) => Promise<T>): Promise<T> {
  const { local, db } = bothRepos();
  const a = await fn(local);
  const b = await fn(db);
  expect(JSON.parse(JSON.stringify(b))).toEqual(JSON.parse(JSON.stringify(a)));
  return a;
}

describe('supabase rewards repository — snapshot ⇄ row mapping', () => {
  it('round-trips a rich snapshot with zero loss (010 + 011 columns)', async () => {
    // Build a real, rich snapshot by running the engine on the local provider.
    const local = createInMemoryRewardsRepository(() => NOW);
    await applyGameResult(local, { playerKey: 'p1', displayName: 'Ada', result: game(), gameId: 'g1', dayKey: '2026-07-10', nowIso: NOW });
    await applyGameResult(local, { playerKey: 'p1', result: game({ prize: 40_000, category: 'history', correctAnswers: 12, questionsFaced: 15, lifelinesUsed: 0 }), gameId: 'g2', dayKey: '2026-07-11', nowIso: NOW });
    const snap = await local.load('p1');

    const byTable = snapshotToTableRows(snap);
    const restored = tableRowsToSnapshot('p1', byTable, NOW);

    expect(restored.identity).toEqual(snap.identity);
    expect({
      lifetimeTotal: restored.career.lifetimeTotal,
      spendableBalance: restored.career.spendableBalance,
      bestSingleGame: restored.career.bestSingleGame,
      millionaireWins: restored.career.millionaireWins,
      perfectRuns: restored.career.perfectRuns,
      cashOutTotal: restored.career.cashOutTotal,
      gamesWon: restored.career.gamesWon,
      gamesPlayed: restored.career.gamesPlayed
    }).toEqual({
      lifetimeTotal: snap.career.lifetimeTotal,
      spendableBalance: snap.career.spendableBalance,
      bestSingleGame: snap.career.bestSingleGame,
      millionaireWins: snap.career.millionaireWins,
      perfectRuns: snap.career.perfectRuns,
      cashOutTotal: snap.career.cashOutTotal,
      gamesWon: snap.career.gamesWon,
      gamesPlayed: snap.career.gamesPlayed
    });
    expect(restored.career.ledger.map(e => e.idempotencyKey)).toEqual(snap.career.ledger.map(e => e.idempotencyKey));
    expect(restored.career.ledger.map(e => e.amount)).toEqual(snap.career.ledger.map(e => e.amount));
    expect(restored.titles).toEqual(snap.titles);
    expect(restored.badges).toEqual(snap.badges);
    expect(restored.mastery).toEqual(snap.mastery);
    expect(restored.collections).toEqual(snap.collections);
    expect(restored.streak).toEqual(snap.streak);
    expect(restored.cosmetics).toEqual(snap.cosmetics);
    expect(restored.stats).toEqual(snap.stats);
    expect(restored.daily).toEqual(snap.daily);
    expect(restored.weekly).toEqual(snap.weekly);
    expect(restored.trophyCabinet).toEqual(snap.trophyCabinet);
    expect(restored.timeline.map(e => ({ id: e.id, type: e.type, copyKey: e.copyKey, visible: e.visible }))).toEqual(
      snap.timeline.map(e => ({ id: e.id, type: e.type, copyKey: e.copyKey, visible: e.visible }))
    );
  });
});

describe('supabase rewards repository — local ⇄ database provider parity', () => {
  it('applyGameResult produces identical progression on both providers', async () => {
    await parity(async repo => {
      const first = await applyGameResult(repo, { playerKey: 'p1', displayName: 'Ada', result: game(), gameId: 'g1', dayKey: '2026-07-10', nowIso: NOW });
      const second = await applyGameResult(repo, { playerKey: 'p1', result: game({ prize: 40_000, category: 'history', correctAnswers: 12, questionsFaced: 15 }), gameId: 'g2', dayKey: '2026-07-11', nowIso: NOW });
      return { first, second };
    });
  });

  it('getFullProfile is identical after the same history', async () => {
    await parity(async repo => {
      await applyGameResult(repo, { playerKey: 'p1', displayName: 'Ada', result: game(), gameId: 'g1', dayKey: '2026-07-10', nowIso: NOW });
      await applyGameResult(repo, { playerKey: 'p1', result: game({ prize: 40_000, category: 'history', correctAnswers: 12, questionsFaced: 15 }), gameId: 'g2', dayKey: '2026-07-11', nowIso: NOW });
      return getFullProfile(repo, 'p1');
    });
  });

  it('daily challenge + streak behave identically', async () => {
    await parity(async repo => {
      await getDailyChallenge(repo, 'p1', '2026-07-10', 'q-1');
      const first = await completeDaily(repo, 'p1', '2026-07-10', true, NOW);
      const second = await completeDaily(repo, 'p1', '2026-07-10', true, NOW);
      return { first, second };
    });
  });

  it('weekly objective progress + claim behave identically', async () => {
    await parity(async repo => {
      for (let i = 0; i < 5; i += 1) {
        await applyGameResult(repo, { playerKey: 'p1', result: game({ prize: 5000, category: ['science', 'history', 'sports', 'music', 'geography'][i] }), gameId: `w${i}`, dayKey: '2026-07-10', weekKey: '2026-W28', nowIso: NOW });
      }
      const weekly = await getWeekly(repo, 'p1', '2026-W28');
      const claims = [] as Array<{ granted: number; alreadyClaimed: boolean }>;
      for (const obj of weekly.objectives) {
        if (obj.progress >= obj.target) claims.push(await claimWeekly(repo, 'p1', obj.objectiveId, NOW));
      }
      return { weekly, claims };
    });
  });
});

describe('supabase rewards repository — idempotent grants in database mode', () => {
  it('re-applying the same gameId never double-counts', async () => {
    const repo = createSupabaseRewardsRepository(createFakeRestClient(), () => NOW);
    await applyGameResult(repo, { playerKey: 'p1', result: game({ prize: 50_000, correctAnswers: 5, questionsFaced: 15, won: true }), gameId: 'g1', dayKey: '2026-07-10', nowIso: NOW });
    const second = await applyGameResult(repo, { playerKey: 'p1', result: game({ prize: 50_000, correctAnswers: 5, questionsFaced: 15, won: true }), gameId: 'g1', dayKey: '2026-07-10', nowIso: NOW });
    expect(second.career.lifetimeTotal).toBe(50_000);
    expect(second.career.gamesPlayed).toBe(1);
    expect(second.reveals.map(r => r.type)).toEqual(['result']);

    const snap = await repo.load('p1');
    const gameEntries = snap.career.ledger.filter(e => e.idempotencyKey === 'game:g1');
    expect(gameEntries).toHaveLength(1);
  });

  it('appendLedgerEntry is idempotent by idempotencyKey', async () => {
    const repo = createSupabaseRewardsRepository(createFakeRestClient(), () => NOW);
    const entry = { id: 'e1', kind: 'milestone' as const, amount: 1000, idempotencyKey: 'once', createdAt: NOW };
    const a = await repo.appendLedgerEntry('p1', entry);
    const b = await repo.appendLedgerEntry('p1', { ...entry, id: 'e2' });
    expect(a.lifetimeTotal).toBe(1000);
    expect(b.lifetimeTotal).toBe(1000);
    const snap = await repo.load('p1');
    expect(snap.career.ledger.filter(e => e.idempotencyKey === 'once')).toHaveLength(1);
  });
});
