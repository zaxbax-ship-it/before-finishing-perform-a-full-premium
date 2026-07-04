import { getFeatureFlags } from './featureFlags';
import { readBooleanEnv, readEnv, validateEnvironment } from './environment';

export type ProductionConfig = {
  environment: {
    runtime: string;
    issues: ReturnType<typeof validateEnvironment>;
  };
  database: {
    mode: 'local' | 'supabase';
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    hasServiceRoleKey: boolean;
    hasDatabaseUrl: boolean;
  };
  ads: {
    enabled: boolean;
    provider: 'none' | 'adsense' | 'google-ad-manager' | 'media-net' | 'ezoic';
    placeholders: boolean;
    adsensePublisherId?: string;
    googleAdManagerNetworkCode?: string;
  };
  auth: {
    googleOAuthConfigured: boolean;
    googleClientId?: string;
    supabaseAuthConfigured: boolean;
    emailPasswordEnabled: boolean;
    enforcement: 'enforced' | 'open-local';
    adminAllowlistConfigured: boolean;
  };
  ai: {
    openAiConfigured: boolean;
    moderationEnabled: boolean;
  };
  payments: {
    stripeConfigured: boolean;
    publishableKey?: string;
  };
  email: {
    resendConfigured: boolean;
  };
  captcha: {
    turnstileConfigured: boolean;
    siteKey?: string;
  };
  analytics: {
    provider: 'none' | 'vercel' | 'ga4' | 'plausible' | 'posthog';
    gaMeasurementId?: string;
    plausibleDomain?: string;
    posthogKey?: string;
  };
  features: ReturnType<typeof getFeatureFlags>;
};

export function getProductionConfig(): ProductionConfig {
  const adProvider = readEnv('NEXT_PUBLIC_AD_PROVIDER') as ProductionConfig['ads']['provider'] | undefined;
  const analyticsProvider = readEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER') as ProductionConfig['analytics']['provider'] | undefined;
  const databaseMode = readEnv('NEXT_PUBLIC_DATABASE_MODE') === 'supabase' ? 'supabase' : 'local';
  const supabaseAuthConfigured = Boolean(readEnv('NEXT_PUBLIC_SUPABASE_URL') && readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
  const authEnforced = supabaseAuthConfigured && readEnv('AUTH_ENFORCED') !== 'false';

  return {
    environment: {
      runtime: readEnv('NODE_ENV') || 'development',
      issues: validateEnvironment()
    },
    database: {
      mode: databaseMode,
      supabaseUrl: readEnv('NEXT_PUBLIC_SUPABASE_URL'),
      supabaseAnonKey: readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      hasServiceRoleKey: Boolean(readEnv('SUPABASE_SERVICE_ROLE_KEY')),
      hasDatabaseUrl: Boolean(readEnv('DATABASE_URL'))
    },
    ads: {
      enabled: readBooleanEnv('NEXT_PUBLIC_ADS_ENABLED'),
      provider: adProvider || 'none',
      placeholders: readBooleanEnv('NEXT_PUBLIC_AD_PLACEHOLDERS', true),
      adsensePublisherId: readEnv('NEXT_PUBLIC_ADSENSE_PUBLISHER_ID'),
      googleAdManagerNetworkCode: readEnv('GOOGLE_AD_MANAGER_NETWORK_CODE')
    },
    auth: {
      googleOAuthConfigured: Boolean(readEnv('GOOGLE_OAUTH_CLIENT_ID') && readEnv('GOOGLE_OAUTH_CLIENT_SECRET')),
      googleClientId: readEnv('GOOGLE_OAUTH_CLIENT_ID'),
      supabaseAuthConfigured,
      emailPasswordEnabled: readEnv('AUTH_EMAIL_PASSWORD_ENABLED') !== 'false',
      enforcement: authEnforced ? 'enforced' : 'open-local',
      adminAllowlistConfigured: Boolean(readEnv('ADMIN_EMAILS'))
    },
    ai: {
      openAiConfigured: Boolean(readEnv('OPENAI_API_KEY')),
      moderationEnabled: readBooleanEnv('OPENAI_MODERATION_ENABLED')
    },
    payments: {
      stripeConfigured: Boolean(readEnv('STRIPE_SECRET_KEY') && readEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')),
      publishableKey: readEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
    },
    email: {
      resendConfigured: Boolean(readEnv('RESEND_API_KEY'))
    },
    captcha: {
      turnstileConfigured: Boolean(readEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY') && readEnv('TURNSTILE_SECRET_KEY')),
      siteKey: readEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY')
    },
    analytics: {
      provider: analyticsProvider || 'none',
      gaMeasurementId: readEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID'),
      plausibleDomain: readEnv('NEXT_PUBLIC_PLAUSIBLE_DOMAIN'),
      posthogKey: readEnv('NEXT_PUBLIC_POSTHOG_KEY')
    },
    features: getFeatureFlags()
  };
}
