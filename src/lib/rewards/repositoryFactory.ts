import 'server-only';
import { createInMemoryRewardsRepository, type RewardsRepository } from '@/lib/repositories/rewardsRepository';

/**
 * Server-only rewards repository factory. Mirrors the main provider factory: it
 * returns the local in-memory provider today (per-instance, ephemeral — the same
 * caveat the local JSON provider carries) and will return the Supabase-backed
 * provider once it is wired to the `010_rewards_progression` tables. Keeping this
 * separate from the central `RepositoryProvider` aggregate lets the rewards stack
 * land without touching the existing provider surface.
 */
let cached: RewardsRepository | undefined;

export function getRewardsRepository(): RewardsRepository {
  cached = cached ?? createInMemoryRewardsRepository();
  return cached;
}

export function resetRewardsRepositoryForTests(): void {
  cached = undefined;
}
