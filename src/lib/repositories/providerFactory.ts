import 'server-only';
import { getDatabaseConfig, isSupabaseConfigured } from '@/lib/database/config';
import { createLogger } from '@/lib/infrastructure/logger';
import type { RepositoryProvider } from './interfaces';
import { createDatabaseRepositoryProvider } from './providers/databaseProvider';
import { createLocalJsonRepositoryProvider } from './providers/localJsonProvider';

const providerLogger = createLogger('repositories');

let cachedProvider: RepositoryProvider | undefined;

export function createRepositoryProvider(): RepositoryProvider {
  const config = getDatabaseConfig();

  if (config.mode === 'supabase') {
    if (isSupabaseConfigured(config)) {
      return createDatabaseRepositoryProvider();
    }

    // Database mode was explicitly requested but the configuration is
    // incomplete. Production fails loudly — a silent fallback to the local
    // JSON provider would mean ephemeral per-instance state (lost lobbies,
    // leaderboards and tickets) masquerading as a working deployment.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'NEXT_PUBLIC_DATABASE_MODE=supabase but Supabase is not fully configured. ' +
          'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example), ' +
          'or remove NEXT_PUBLIC_DATABASE_MODE to run in local mode.'
      );
    }

    providerLogger.error('Database mode requested but Supabase is not fully configured — falling back to the local JSON provider (development only).', {
      mode: config.mode,
      hasSupabaseUrl: Boolean(config.supabaseUrl),
      hasServiceRoleKey: config.hasServiceRoleKey
    });
    return createLocalJsonRepositoryProvider();
  }

  if (process.env.NODE_ENV === 'production') {
    // Deliberate local mode in production is allowed (single-instance/demo
    // deployments) but must never be an accident: state is per-instance and
    // does not survive serverless recycling.
    providerLogger.warn('Running the LOCAL JSON provider in production: data is ephemeral and not shared between instances.', {
      hint: 'Set NEXT_PUBLIC_DATABASE_MODE=supabase with Supabase credentials for persistent storage.'
    });
  }

  return createLocalJsonRepositoryProvider();
}

export function getRepositoryProvider(): RepositoryProvider {
  cachedProvider = cachedProvider || createRepositoryProvider();
  return cachedProvider;
}

export function resetRepositoryProviderForTests() {
  cachedProvider = undefined;
}
