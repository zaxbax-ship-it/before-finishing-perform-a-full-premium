import 'server-only';
import { getDatabaseConfig, isSupabaseConfigured } from '@/lib/database/config';
import { createLogger } from '@/lib/infrastructure/logger';
import { createInMemoryRewardsRepository, type RewardsRepository } from '@/lib/repositories/rewardsRepository';
import { createSupabaseRewardsRepository } from './supabaseRewardsRepository';

/**
 * Server-only rewards repository factory. Mirrors the main provider factory:
 * database mode → the Supabase-backed provider mapping to the
 * `010_rewards_progression` (+ `011_reward_stats`) tables; otherwise the local
 * in-memory provider (per-instance, ephemeral — the same caveat the local JSON
 * provider carries). Production fails loudly when database mode is requested but
 * Supabase is not fully configured, so a rewards deployment never silently runs
 * on ephemeral state.
 */
const rewardsLogger = createLogger('rewards');

let cached: RewardsRepository | undefined;

export function createRewardsRepository(): RewardsRepository {
  const config = getDatabaseConfig();

  if (config.mode === 'supabase') {
    if (isSupabaseConfigured(config)) {
      return createSupabaseRewardsRepository();
    }

    // Database mode explicitly requested but not fully configured. A silent
    // fallback to the in-memory provider would mean rewards (titles, badges,
    // Career Earnings) vanishing on every serverless recycle while looking healthy.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'NEXT_PUBLIC_DATABASE_MODE=supabase but Supabase is not fully configured for rewards. ' +
          'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example), ' +
          'or remove NEXT_PUBLIC_DATABASE_MODE to run rewards in local mode.'
      );
    }

    rewardsLogger.error('Database mode requested but Supabase is not fully configured — rewards falling back to the in-memory provider (development only).', {
      mode: config.mode,
      hasSupabaseUrl: Boolean(config.supabaseUrl),
      hasServiceRoleKey: config.hasServiceRoleKey
    });
    return createInMemoryRewardsRepository();
  }

  return createInMemoryRewardsRepository();
}

export function getRewardsRepository(): RewardsRepository {
  cached = cached ?? createRewardsRepository();
  return cached;
}

export function resetRewardsRepositoryForTests(): void {
  cached = undefined;
}
