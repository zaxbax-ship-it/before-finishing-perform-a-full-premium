export type RuntimeEnvironment = 'development' | 'test' | 'production';

export type EnvironmentVariableSpec = {
  name: string;
  visibility: 'public' | 'server';
  requiredInProduction?: boolean;
  allowedValues?: string[];
  description: string;
};

export type EnvironmentValidationIssue = {
  name: string;
  severity: 'warning' | 'error';
  message: string;
};

export const ENVIRONMENT_SPECS: EnvironmentVariableSpec[] = [
  { name: 'NODE_ENV', visibility: 'server', allowedValues: ['development', 'test', 'production'], description: 'Runtime mode.' },
  { name: 'NEXT_PUBLIC_DATABASE_MODE', visibility: 'public', allowedValues: ['local', 'supabase'], description: 'Repository provider switch.' },
  { name: 'NEXT_PUBLIC_SUPABASE_URL', visibility: 'public', description: 'Supabase project URL.' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', visibility: 'public', description: 'Supabase browser-safe anon key.' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', visibility: 'server', description: 'Supabase server-only service role key.' },
  { name: 'DATABASE_URL', visibility: 'server', description: 'Direct PostgreSQL connection string.' },
  { name: 'OPENAI_API_KEY', visibility: 'server', description: 'OpenAI server-only API key.' },
  { name: 'GOOGLE_OAUTH_CLIENT_ID', visibility: 'server', description: 'Google OAuth client id.' },
  { name: 'GOOGLE_OAUTH_CLIENT_SECRET', visibility: 'server', description: 'Google OAuth client secret.' },
  { name: 'NEXT_PUBLIC_ADS_ENABLED', visibility: 'public', allowedValues: ['true', 'false'], description: 'Enables prepared ad slots.' },
  { name: 'NEXT_PUBLIC_AD_PROVIDER', visibility: 'public', allowedValues: ['none', 'adsense', 'google-ad-manager', 'media-net', 'ezoic'], description: 'Advertising provider.' },
  { name: 'NEXT_PUBLIC_AD_PLACEHOLDERS', visibility: 'public', allowedValues: ['true', 'false'], description: 'Show inactive ad placeholders.' },
  { name: 'NEXT_PUBLIC_ADSENSE_PUBLISHER_ID', visibility: 'public', description: 'Google AdSense publisher id.' },
  { name: 'GOOGLE_AD_MANAGER_NETWORK_CODE', visibility: 'server', description: 'Google Ad Manager network code.' },
  { name: 'STRIPE_SECRET_KEY', visibility: 'server', description: 'Stripe server secret key.' },
  { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', visibility: 'public', description: 'Stripe browser-safe publishable key.' },
  { name: 'RESEND_API_KEY', visibility: 'server', description: 'Resend server API key.' },
  { name: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', visibility: 'public', description: 'Cloudflare Turnstile site key.' },
  { name: 'TURNSTILE_SECRET_KEY', visibility: 'server', description: 'Cloudflare Turnstile server secret key.' },
  { name: 'NEXT_PUBLIC_ANALYTICS_PROVIDER', visibility: 'public', allowedValues: ['none', 'vercel', 'ga4', 'plausible', 'posthog'], description: 'Analytics provider.' },
  { name: 'NEXT_PUBLIC_GA_MEASUREMENT_ID', visibility: 'public', description: 'Google Analytics measurement id.' },
  { name: 'NEXT_PUBLIC_PLAUSIBLE_DOMAIN', visibility: 'public', description: 'Plausible domain.' },
  { name: 'NEXT_PUBLIC_POSTHOG_KEY', visibility: 'public', description: 'PostHog browser key.' }
];

export function readEnv(name: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  const value = readEnv('NODE_ENV');
  return value === 'production' || value === 'test' ? value : 'development';
}

export function readBooleanEnv(name: string, fallback = false): boolean {
  const value = readEnv(name);
  if (value === undefined) return fallback;
  return value === 'true';
}

export function validateEnvironment(): EnvironmentValidationIssue[] {
  const issues: EnvironmentValidationIssue[] = [];
  const runtime = getRuntimeEnvironment();

  for (const spec of ENVIRONMENT_SPECS) {
    const value = readEnv(spec.name);
    if (runtime === 'production' && spec.requiredInProduction && !value) {
      issues.push({ name: spec.name, severity: 'error', message: `${spec.name} is required in production.` });
    }
    if (value && spec.allowedValues && !spec.allowedValues.includes(value)) {
      issues.push({ name: spec.name, severity: 'error', message: `${spec.name} must be one of: ${spec.allowedValues.join(', ')}.` });
    }
    if (spec.visibility === 'server' && spec.name.startsWith('NEXT_PUBLIC_')) {
      issues.push({ name: spec.name, severity: 'error', message: `${spec.name} is marked server-only but is public.` });
    }
  }

  const databaseMode = readEnv('NEXT_PUBLIC_DATABASE_MODE') || 'local';
  if (databaseMode === 'supabase' && (!readEnv('NEXT_PUBLIC_SUPABASE_URL') || !readEnv('SUPABASE_SERVICE_ROLE_KEY'))) {
    issues.push({ name: 'NEXT_PUBLIC_DATABASE_MODE', severity: 'warning', message: 'Supabase mode requested without a project URL and server-only service role key. The app should fall back to local mode.' });
  }

  const adsEnabled = readBooleanEnv('NEXT_PUBLIC_ADS_ENABLED');
  const adProvider = readEnv('NEXT_PUBLIC_AD_PROVIDER') || 'none';
  if (adsEnabled && adProvider === 'adsense' && !readEnv('NEXT_PUBLIC_ADSENSE_PUBLISHER_ID')) {
    issues.push({ name: 'NEXT_PUBLIC_ADSENSE_PUBLISHER_ID', severity: 'warning', message: 'AdSense is enabled but publisher id is missing.' });
  }

  return issues;
}
