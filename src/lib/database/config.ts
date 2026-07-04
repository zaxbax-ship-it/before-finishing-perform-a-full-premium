import type { DatabaseMode } from './schema';
import { getProductionConfig } from '@/lib/infrastructure/config';

export type DatabaseConfig = {
  mode: DatabaseMode;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  hasServiceRoleKey: boolean;
  hasDatabaseUrl: boolean;
};

export function getDatabaseConfig(): DatabaseConfig {
  const config = getProductionConfig();
  const mode: DatabaseMode = config.database.mode;

  return {
    mode,
    supabaseUrl: config.database.supabaseUrl,
    supabaseAnonKey: config.database.supabaseAnonKey,
    hasServiceRoleKey: config.database.hasServiceRoleKey,
    hasDatabaseUrl: config.database.hasDatabaseUrl
  };
}

export function isSupabaseConfigured(config = getDatabaseConfig()) {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}
