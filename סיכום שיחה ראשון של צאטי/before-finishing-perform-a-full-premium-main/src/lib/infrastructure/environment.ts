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
  { name: 'OPENAI_MODERATION_ENABLED', visibility: 'server', allowedValues: ['true', 'false'], description: 'Enables OpenAI-backed moderation when an API key exists.' },
  { name: 'OPENAI_MODERATION_MODEL', visibility: 'server', description: 'OpenAI model used by the moderation provider.' },
  { name: 'COMMUNITY_SUBMISSION_RATE_LIMIT', visibility: 'server', description: 'Maximum public community submissions per identity and window.' },
  { name: 'COMMUNITY_SUBMISSION_RATE_LIMIT_WINDOW_SECONDS', visibility: 'server', description: 'Community submission rate-limit window in seconds.' },
  { name: 'AI_MODERATION_RATE_LIMIT', visibility: 'server', description: 'Maximum AI moderation attempts per identity and window.' },
  { name: 'AI_MODERATION_RATE_LIMIT_WINDOW_SECONDS', visibility: 'server', description: 'AI moderation rate-limit window in seconds.' },
  { name: 'MULTIPLAYER_LOBBY_RATE_LIMIT', visibility: 'server', description: 'Maximum multiplayer lobby create/join/start actions per identity and window.' },
  { name: 'MULTIPLAYER_LOBBY_RATE_LIMIT_WINDOW_SECONDS', visibility: 'server', description: 'Multiplayer lobby action rate-limit window in seconds.' },
  { name: 'MULTIPLAYER_ANSWER_RATE_LIMIT', visibility: 'server', description: 'Maximum multiplayer answer submissions per identity and window.' },
  { name: 'MULTIPLAYER_ANSWER_RATE_LIMIT_WINDOW_SECONDS', visibility: 'server', description: 'Multiplayer answer rate-limit window in seconds.' },
  { name: 'AI_MODERATION_TIMEOUT_MS', visibility: 'server', description: 'Timeout for one AI moderation provider call.' },
  { name: 'AI_MODERATION_RETRY_ATTEMPTS', visibility: 'server', description: 'Safe retry attempts for provider calls before any writes occur.' },
  { name: 'AI_MODERATION_MAX_ESTIMATED_TOKENS_PER_REQUEST', visibility: 'server', description: 'Maximum estimated token budget for a single moderation request.' },
  { name: 'AI_MODERATION_DAILY_REQUEST_LIMIT', visibility: 'server', description: 'Daily AI moderation request budget.' },
  { name: 'AI_MODERATION_MONTHLY_REQUEST_LIMIT', visibility: 'server', description: 'Monthly AI moderation request budget.' },
  { name: 'AI_MODERATION_DAILY_ESTIMATED_TOKEN_LIMIT', visibility: 'server', description: 'Daily estimated token budget for moderation.' },
  { name: 'AI_MODERATION_MONTHLY_ESTIMATED_TOKEN_LIMIT', visibility: 'server', description: 'Monthly estimated token budget for moderation.' },
  { name: 'AI_MODERATION_AUTO_APPROVE_MIN_CONFIDENCE', visibility: 'server', description: 'Minimum confidence required for automatic approval.' },
  { name: 'AI_MODERATION_DUPLICATE_REVIEW_RISK', visibility: 'server', description: 'Duplicate-risk threshold that forces manual review.' },
  { name: 'AI_MODERATION_LOW_QUALITY_REVIEW_RISK', visibility: 'server', description: 'Low-quality threshold that forces manual review.' },
  { name: 'AI_MODERATION_UNSAFE_REJECT_RISK', visibility: 'server', description: 'Unsafe-content threshold that blocks automatic approval.' },
  { name: 'AI_MODERATION_STRICT_REVIEW', visibility: 'server', allowedValues: ['true', 'false'], description: 'Forces uncertain AI results into human review.' },
  { name: 'GOOGLE_OAUTH_CLIENT_ID', visibility: 'server', description: 'Google OAuth client id.' },
  { name: 'GOOGLE_OAUTH_CLIENT_SECRET', visibility: 'server', description: 'Google OAuth client secret.' },
  { name: 'NEXT_PUBLIC_SITE_URL', visibility: 'public', description: 'Absolute site origin used to build auth redirect URLs.' },
  { name: 'NEXT_PUBLIC_CONTACT_EMAIL', visibility: 'public', description: 'Public support address shown on the Contact page.' },
  { name: 'NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION', visibility: 'public', description: 'Google Search Console verification token.' },
  { name: 'NEXT_PUBLIC_BING_SITE_VERIFICATION', visibility: 'public', description: 'Bing Webmaster Tools verification token.' },
  { name: 'AUTH_ENFORCED', visibility: 'server', allowedValues: ['true', 'false'], description: 'Forces auth enforcement off when set to false; only effective once Supabase Auth is configured.' },
  { name: 'AUTH_EMAIL_PASSWORD_ENABLED', visibility: 'server', allowedValues: ['true', 'false'], description: 'Toggles the email/password sign-in option in the UI.' },
  { name: 'ADMIN_EMAILS', visibility: 'server', description: 'Comma-separated bootstrap admin emails granted super_admin before the admins table is populated.' },
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
  { name: 'NEXT_PUBLIC_GTM_ID', visibility: 'public', description: 'Google Tag Manager container id.' },
  { name: 'NEXT_PUBLIC_CLARITY_PROJECT_ID', visibility: 'public', description: 'Microsoft Clarity project id.' },
  { name: 'NEXT_PUBLIC_PLAUSIBLE_DOMAIN', visibility: 'public', description: 'Plausible domain.' },
  { name: 'NEXT_PUBLIC_POSTHOG_KEY', visibility: 'public', description: 'PostHog browser key.' },
  { name: 'NEXT_PUBLIC_CMP_PROVIDER', visibility: 'public', allowedValues: ['none', 'cookiebot', 'usercentrics', 'consentmanager'], description: 'Certified consent-management provider.' },
  { name: 'NEXT_PUBLIC_COOKIEBOT_ID', visibility: 'public', description: 'Cookiebot domain group id.' },
  { name: 'NEXT_PUBLIC_USERCENTRICS_SETTINGS_ID', visibility: 'public', description: 'Usercentrics settings id.' },
  { name: 'NEXT_PUBLIC_CONSENTMANAGER_ID', visibility: 'public', description: 'Consentmanager id.' }
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

  const analyticsProvider = readEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER') || 'none';
  if (analyticsProvider === 'ga4' && !readEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID')) {
    issues.push({ name: 'NEXT_PUBLIC_GA_MEASUREMENT_ID', severity: 'warning', message: 'GA4 analytics provider is selected but measurement id is missing.' });
  }

  const cmpProvider = readEnv('NEXT_PUBLIC_CMP_PROVIDER') || 'none';
  const cmpRequirements: Record<string, string> = {
    cookiebot: 'NEXT_PUBLIC_COOKIEBOT_ID',
    usercentrics: 'NEXT_PUBLIC_USERCENTRICS_SETTINGS_ID',
    consentmanager: 'NEXT_PUBLIC_CONSENTMANAGER_ID'
  };
  const requiredCmpVariable = cmpRequirements[cmpProvider];
  if (requiredCmpVariable && !readEnv(requiredCmpVariable)) {
    issues.push({ name: requiredCmpVariable, severity: 'warning', message: `${cmpProvider} is selected but its public account id is missing.` });
  }

  return issues;
}
