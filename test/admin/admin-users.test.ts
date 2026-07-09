import { describe, expect, it } from 'vitest';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { applyPlayerAction, getPlayerDetail, listPlayers } from '@/lib/admin/userDirectoryService';
import type { AdminContext } from '@/lib/auth/types';

const actor: AdminContext = {
  email: 'qa-admin@example.com',
  displayName: 'QA Admin',
  roleSlugs: ['super_admin'],
  permissionSlugs: ['admin.users.manage'],
  source: 'local-open'
};

/**
 * Phase 4 — player directory over the local provider: identity merge,
 * search/pagination, moderation actions with audit logging.
 */
describe('Admin player directory', () => {
  it('merges users, progression and leaderboard identities without duplicates', async () => {
    const repositories = getRepositoryProvider();
    await repositories.progression.save({ playerKey: 'anon-qa-dir-1', xp: 350, level: 2, gamesPlayed: 3, unlockedAchievements: ['first-win'] });
    await repositories.leaderboard.submitScore({ nickname: 'DirectoryQA', prize: 1500, correctCount: 4, locale: 'he' });

    const result = await listPlayers(repositories, { pageSize: 100 });
    expect(result.total).toBeGreaterThanOrEqual(2);

    const anon = result.rows.find(row => row.id === 'anon:anon-qa-dir-1');
    expect(anon?.xp).toBe(350);
    expect(anon?.kind).toBe('anonymous');

    const nick = result.rows.find(row => row.nickname === 'DirectoryQA');
    expect(nick?.bestPrize).toBe(1500);

    const search = await listPlayers(repositories, { search: 'directoryqa' });
    expect(search.rows.some(row => row.nickname === 'DirectoryQA')).toBe(true);
  });

  it('paginates deterministically', async () => {
    const repositories = getRepositoryProvider();
    const pageOne = await listPlayers(repositories, { page: 1, pageSize: 5 });
    expect(pageOne.rows.length).toBeLessThanOrEqual(5);
    expect(pageOne.page).toBe(1);
  });

  it('resets progression and writes an audit entry naming the actor', async () => {
    const repositories = getRepositoryProvider();
    await repositories.progression.save({ playerKey: 'anon-qa-reset', xp: 900, level: 3, gamesPlayed: 5, unlockedAchievements: ['a', 'b'] });

    const result = await applyPlayerAction(repositories, actor, 'anon:anon-qa-reset', 'reset_progression');
    expect(result.ok).toBe(true);

    const after = await repositories.progression.find('anon-qa-reset');
    expect(after?.xp).toBe(0);
    expect(after?.unlockedAchievements).toEqual([]);

    const logs = await repositories.auditLogs.list({ limit: 20 });
    const entry = logs.find(log => log.action === 'admin_player_reset_progression');
    expect(entry?.actor).toBe('qa-admin@example.com');
  });

  it('hides and restores a leaderboard nickname', async () => {
    const repositories = getRepositoryProvider();
    await repositories.leaderboard.submitScore({ nickname: 'HideMeQA', prize: 800, correctCount: 3, locale: 'he' });

    const hide = await applyPlayerAction(repositories, actor, 'nick:HideMeQA', 'hide_leaderboard');
    expect(hide.ok).toBe(true);
    const hidden = (await repositories.leaderboard.listAll({ limit: 1000 })).find(entry => entry.nickname === 'HideMeQA');
    expect(hidden?.isHidden).toBe(true);

    const restore = await applyPlayerAction(repositories, actor, 'nick:HideMeQA', 'restore_leaderboard');
    expect(restore.ok).toBe(true);
  });

  it('grants and revokes an admin premium entitlement', async () => {
    const repositories = getRepositoryProvider();
    await repositories.progression.save({ playerKey: 'anon-qa-premium', xp: 10, level: 1, gamesPlayed: 1, unlockedAchievements: [] });

    const grant = await applyPlayerAction(repositories, actor, 'anon:anon-qa-premium', 'grant_premium');
    expect(grant.ok).toBe(true);
    const detail = await getPlayerDetail(repositories, 'anon:anon-qa-premium');
    expect(detail?.entitlements.some(ent => ent.type === 'premium' && ent.status === 'active')).toBe(true);

    const revoke = await applyPlayerAction(repositories, actor, 'anon:anon-qa-premium', 'revoke_premium');
    expect(revoke.ok).toBe(true);
    const after = await getPlayerDetail(repositories, 'anon:anon-qa-premium');
    expect(after?.entitlements.some(ent => ent.type === 'premium' && ent.status === 'active')).toBe(false);
  });

  it('exposes honest unavailability reasons in the detail view', async () => {
    const repositories = getRepositoryProvider();
    const detail = await getPlayerDetail(repositories, 'anon:anon-qa-premium');
    expect(detail?.unavailable.email).toMatch(/hash/i);
    expect(detail?.unavailable.sessions).toMatch(/not recorded/i);
  });

  it('rejects suspend for non-registered identities', async () => {
    const repositories = getRepositoryProvider();
    const result = await applyPlayerAction(repositories, actor, 'anon:anon-qa-premium', 'suspend');
    expect(result.ok).toBe(false);
  });
});
