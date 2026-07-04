import { readBooleanEnv, readEnv } from './environment';

export type FeatureFlags = {
  databaseProvider: 'local' | 'supabase';
  adsEnabled: boolean;
  communitySubmissionsEnabled: boolean;
  adminDashboardEnabled: boolean;
  openAiModerationEnabled: boolean;
  supabaseAuthEnabled: boolean;
  authEnforced: boolean;
  googleOAuthEnabled: boolean;
  paymentsEnabled: boolean;
  emailEnabled: boolean;
  turnstileEnabled: boolean;
  analyticsEnabled: boolean;
};

export function getFeatureFlags(): FeatureFlags {
  return {
    databaseProvider: readEnv('NEXT_PUBLIC_DATABASE_MODE') === 'supabase' ? 'supabase' : 'local',
    adsEnabled: readBooleanEnv('NEXT_PUBLIC_ADS_ENABLED'),
    communitySubmissionsEnabled: readBooleanEnv('NEXT_PUBLIC_COMMUNITY_SUBMISSIONS_ENABLED', true),
    adminDashboardEnabled: readBooleanEnv('NEXT_PUBLIC_ADMIN_DASHBOARD_ENABLED', true),
    openAiModerationEnabled: Boolean(readEnv('OPENAI_API_KEY')) && readBooleanEnv('OPENAI_MODERATION_ENABLED'),
    supabaseAuthEnabled: Boolean(readEnv('NEXT_PUBLIC_SUPABASE_URL') && readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')),
    authEnforced: Boolean(readEnv('NEXT_PUBLIC_SUPABASE_URL') && readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')) && readEnv('AUTH_ENFORCED') !== 'false',
    googleOAuthEnabled: Boolean(readEnv('GOOGLE_OAUTH_CLIENT_ID') && readEnv('GOOGLE_OAUTH_CLIENT_SECRET')),
    paymentsEnabled: Boolean(readEnv('STRIPE_SECRET_KEY') && readEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')),
    emailEnabled: Boolean(readEnv('RESEND_API_KEY')),
    turnstileEnabled: Boolean(readEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY') && readEnv('TURNSTILE_SECRET_KEY')),
    analyticsEnabled: (readEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER') || 'none') !== 'none'
  };
}
