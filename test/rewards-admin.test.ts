import { describe, expect, it } from 'vitest';
import { createInMemoryRewardsRepository } from '@/lib/repositories/rewardsRepository';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import type { AdminContext } from '@/lib/auth/types';
import {
  getRewardsAdminOverview,
  getRewardsCatalogue,
  grantReward,
  inspectPlayerRewards,
  revokeReward
} from '@/lib/admin/rewardsAdminService';

const NOW = '2026-07-10T12:00:00.000Z';

const actor: AdminContext = {
  email: 'admin@example.com',
  displayName: 'Admin',
  roleSlugs: ['super_admin'],
  permissionSlugs: ['rewards.read', 'rewards.manage'],
  source: 'bootstrap'
};

type AuditRow = { id: string; createdAt: string; actor: string; action: string; target: string; details: string };

function fakeRepositories() {
  const entries: AuditRow[] = [];
  const repositories = {
    auditLogs: {
      async create(dto: { actorLabel: string; action: string; targetType: string; targetId?: string; details: Record<string, unknown> }) {
        const e: AuditRow = { id: `a${entries.length}`, createdAt: NOW, actor: dto.actorLabel, action: dto.action, target: dto.targetId ?? '', details: JSON.stringify(dto.details) };
        entries.unshift(e);
        return e;
      },
      async list(opts?: { limit?: number }) {
        return entries.slice(0, opts?.limit ?? entries.length);
      }
    }
  } as unknown as RepositoryProvider;
  return { repositories, entries };
}

const catalogue = getRewardsCatalogue();
const earnedCosmeticId = catalogue.cosmetics.find(c => !c.starter)!.id;
const starterCosmeticId = catalogue.cosmetics.find(c => c.starter)!.id;
const titleId = catalogue.titles[0].id;
const badgeId = catalogue.badges[0].id;

describe('rewards admin — catalogue inspection', () => {
  it('exposes the live, code-owned reward catalogue', () => {
    expect(catalogue.counts.titles).toBeGreaterThanOrEqual(10);
    expect(catalogue.counts.badges).toBeGreaterThan(0);
    expect(catalogue.counts.cosmetics).toBeGreaterThan(0);
    expect(catalogue.counts.collections).toBeGreaterThan(0);
    expect(catalogue.masteryTiers.map(t => t.tier)).toContain('grandmaster');
  });
});

describe('rewards admin — player entitlement + ledger inspection', () => {
  it('returns a quiet default for a never-seen player', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    const inspection = await inspectPlayerRewards(repo, 'new-player');
    expect(inspection.career.lifetimeTotal).toBe(0);
    expect(inspection.career.ledger).toHaveLength(0);
    expect(inspection.unlockedBadges).toHaveLength(0);
    expect(inspection.cosmetics.length).toBeGreaterThan(0); // starter entitlements
  });
});

describe('rewards admin — secure grant/revoke (audit-logged)', () => {
  it('grants a cosmetic and records an audit entry', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    const { repositories, entries } = fakeRepositories();
    const result = await grantReward(repo, repositories, actor, 'p1', { kind: 'cosmetic', cosmeticId: earnedCosmeticId }, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.inspection.cosmetics.some(c => c.cosmeticId === earnedCosmeticId)).toBe(true);
    expect(entries[0].action).toBe('admin_rewards_grant');
    expect(entries[0].actor).toBe('admin@example.com');
    expect(entries[0].target).toBe('p1');
  });

  it('grants a title and a badge', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    const { repositories } = fakeRepositories();
    const t = await grantReward(repo, repositories, actor, 'p1', { kind: 'title', titleId }, NOW);
    const b = await grantReward(repo, repositories, actor, 'p1', { kind: 'badge', badgeId }, NOW);
    expect(t.ok && b.ok).toBe(true);
    if (b.ok) {
      expect(b.inspection.titles.some(x => x.id === titleId)).toBe(true);
      expect(b.inspection.unlockedBadges.some(x => x.id === badgeId)).toBe(true);
    }
  });

  it('rejects granting a title the player already holds', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    const { repositories } = fakeRepositories();
    await grantReward(repo, repositories, actor, 'p1', { kind: 'title', titleId }, NOW);
    const again = await grantReward(repo, repositories, actor, 'p1', { kind: 'title', titleId }, NOW);
    expect(again.ok).toBe(false);
  });

  it('makes an idempotent Career-Earnings adjustment (dollars only)', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    const { repositories } = fakeRepositories();
    const first = await grantReward(repo, repositories, actor, 'p1', { kind: 'career-adjustment', amount: 100_000, reason: 'goodwill', idempotencyKey: 'k1' }, NOW);
    const second = await grantReward(repo, repositories, actor, 'p1', { kind: 'career-adjustment', amount: 100_000, reason: 'goodwill', idempotencyKey: 'k1' }, NOW);
    expect(first.ok && second.ok).toBe(true);
    if (second.ok) {
      expect(second.inspection.career.lifetimeTotal).toBe(100_000);
      expect(second.inspection.career.ledger.filter(e => e.kind === 'adjustment')).toHaveLength(1);
    }
  });

  it('revokes a title and clears it if it was active', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    const { repositories } = fakeRepositories();
    await grantReward(repo, repositories, actor, 'p1', { kind: 'title', titleId }, NOW);
    // Equip it, then revoke — active title must clear.
    const snap = await repo.load('p1');
    await repo.save({ ...snap, identity: { ...snap.identity, activeTitleId: titleId } });
    const revoke = await revokeReward(repo, repositories, actor, 'p1', { kind: 'title', titleId }, NOW);
    expect(revoke.ok).toBe(true);
    if (revoke.ok) {
      expect(revoke.inspection.titles.some(t => t.id === titleId)).toBe(false);
      expect(revoke.inspection.identity.activeTitleId).toBeNull();
    }
  });

  it('refuses to revoke a starter cosmetic', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    const { repositories } = fakeRepositories();
    const revoke = await revokeReward(repo, repositories, actor, 'p1', { kind: 'cosmetic', cosmeticId: starterCosmeticId }, NOW);
    expect(revoke.ok).toBe(false);
  });
});

describe('rewards admin — health / observability', () => {
  it('reports the dollars-only economy and recent admin actions', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    const { repositories } = fakeRepositories();
    await grantReward(repo, repositories, actor, 'p1', { kind: 'title', titleId }, NOW);
    const overview = await getRewardsAdminOverview(repositories);
    expect(overview.economy.currency).toBe('USD');
    expect(overview.economy.alternateCurrencies).toBe(0);
    expect(overview.catalogue.titles).toBe(catalogue.counts.titles);
    expect(overview.recentAdminActions.some(a => a.action === 'admin_rewards_grant')).toBe(true);
  });
});
