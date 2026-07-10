import { describe, expect, it } from 'vitest';
import { createInMemoryRewardsRepository, emptyRewardsSnapshot } from '@/lib/repositories/rewardsRepository';
import type { CareerLedgerEntry } from '@/lib/rewards/types';

const NOW = '2026-07-10T12:00:00.000Z';

describe('rewards repository — local provider (contract the DB provider must match)', () => {
  it('seeds a complete quiet default snapshot for a new player', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    const snapshot = await repo.load('anon-1', 'Ada Lovelace');
    expect(snapshot.identity.playerKey).toBe('anon-1');
    expect(snapshot.identity.monogramSeed).toBe('AL');
    expect(snapshot.titles).toEqual([]);
    expect(snapshot.trophyCabinet.slots).toHaveLength(6);
    // Starters make identity look complete, not empty.
    expect(snapshot.cosmetics.some(c => c.equipped)).toBe(true);
    expect(snapshot.career.lifetimeTotal).toBe(0);
  });

  it('round-trips a saved snapshot and isolates stored state (deep clone)', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    const loaded = await repo.load('p1', 'Grace Hopper');
    loaded.identity.activeTitleId = 'rookie';
    await repo.save(loaded);
    const again = await repo.load('p1');
    expect(again.identity.activeTitleId).toBe('rookie');
    // Mutating the returned object must not corrupt the store.
    again.identity.activeTitleId = 'hacked';
    const fresh = await repo.load('p1');
    expect(fresh.identity.activeTitleId).toBe('rookie');
  });

  it('appends ledger entries idempotently at the persistence boundary', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    const entry: CareerLedgerEntry = { id: 'a', kind: 'daily-reward', amount: 500, idempotencyKey: 'daily:2026-07-10', createdAt: NOW };
    const first = await repo.appendLedgerEntry('p1', entry);
    const second = await repo.appendLedgerEntry('p1', { ...entry, id: 'b' }); // same key
    expect(first.spendableBalance).toBe(500);
    expect(second.spendableBalance).toBe(500); // no double-credit
    expect(second.ledger).toHaveLength(1);
  });

  it('emptyRewardsSnapshot is self-consistent', () => {
    const snap = emptyRewardsSnapshot('p9', 'Solo', NOW);
    expect(snap.streak.current).toBe(0);
    expect(snap.daily).toBeNull();
    expect(snap.weekly).toEqual([]);
  });
});
