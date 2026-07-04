import type { DatabaseMode } from './schema';

export type DatabaseConfig = {
  mode: DatabaseMode;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  hasServiceRoleKey: boolean;
  hasDatabaseUrl: boolean;
};

function readPublicEnv(name: string) {
  return typeof process !== 'undefined' ? process.env[name] : undefined;
}

export function getDatabaseConfig(): DatabaseConfig {
  const requestedMode = readPublicEnv('NEXT_PUBLIC_DATABASE_MODE');
  const mode: DatabaseMode = requestedMode === 'supabase' ? 'supabase' : 'local';

  return {
    mode,
    supabaseUrl: readPublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: readPublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    hasServiceRoleKey: Boolean(readPublicEnv('SUPABASE_SERVICE_ROLE_KEY')),
    hasDatabaseUrl: Boolean(readPublicEnv('DATABASE_URL'))
  };
}

export function isSupabaseConfigured(config = getDatabaseConfig()) {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}
