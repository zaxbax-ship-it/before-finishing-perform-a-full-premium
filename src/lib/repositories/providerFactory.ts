import 'server-only';
import { getDatabaseConfig, isSupabaseConfigured } from '@/lib/database/config';
import type { RepositoryProvider } from './interfaces';
import { createDatabaseRepositoryProvider } from './providers/databaseProvider';
import { createLocalJsonRepositoryProvider } from './providers/localJsonProvider';

let cachedProvider: RepositoryProvider | undefined;

export function createRepositoryProvider(): RepositoryProvider {
  const config = getDatabaseConfig();

  if (config.mode === 'supabase' && isSupabaseConfigured(config)) {
    return createDatabaseRepositoryProvider();
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
