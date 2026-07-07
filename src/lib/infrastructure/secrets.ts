import { readEnv } from './environment';

export type SecretName =
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'DATABASE_URL'
  | 'OPENAI_API_KEY'
  | 'GOOGLE_OAUTH_CLIENT_SECRET'
  | 'STRIPE_SECRET_KEY'
  | 'LEMON_SQUEEZY_API_KEY'
  | 'LEMON_SQUEEZY_STORE_ID'
  | 'LEMON_SQUEEZY_WEBHOOK_SECRET'
  | 'RESEND_API_KEY'
  | 'TURNSTILE_SECRET_KEY';

const SERVER_SECRET_NAMES: SecretName[] = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'OPENAI_API_KEY',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'STRIPE_SECRET_KEY',
  'LEMON_SQUEEZY_API_KEY',
  'LEMON_SQUEEZY_STORE_ID',
  'LEMON_SQUEEZY_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'TURNSTILE_SECRET_KEY'
];

export type SecretsManager = {
  has(name: SecretName): boolean;
  require(name: SecretName): string;
  summary(): Record<SecretName, boolean>;
};

export function createSecretsManager(): SecretsManager {
  return {
    has(name) {
      return Boolean(readEnv(name));
    },
    require(name) {
      const value = readEnv(name);
      if (!value) throw new Error(`Missing required server secret: ${name}`);
      return value;
    },
    summary() {
      return SERVER_SECRET_NAMES.reduce((result, name) => {
        result[name] = Boolean(readEnv(name));
        return result;
      }, {} as Record<SecretName, boolean>);
    }
  };
}
