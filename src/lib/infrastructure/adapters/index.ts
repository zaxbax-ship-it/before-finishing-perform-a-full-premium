import { getProductionConfig } from '../config';
import type { ExternalServiceAdapter, ExternalServiceName } from './types';
import { unavailable } from './types';

function createAdapter(name: ExternalServiceName, configured: boolean, enabled = configured): ExternalServiceAdapter {
  return {
    name,
    configured,
    enabled,
    status() {
      return {
        name,
        configured,
        enabled,
        message: configured ? `${name} credentials detected; live implementation pending.` : `${name} is not configured; local fallback remains active.`
      };
    }
  };
}

export type SupabaseAdapter = ExternalServiceAdapter & {
  createClient(): never;
};

export type PostgreSqlAdapter = ExternalServiceAdapter & {
  connect(): never;
};

export type OpenAiAdapter = ExternalServiceAdapter & {
  moderate(): never;
  generateExplanation(): never;
};

export type GoogleOAuthAdapter = ExternalServiceAdapter & {
  createAuthUrl(): never;
  verifyCallback(): never;
};

export type AdvertisingAdapter = ExternalServiceAdapter & {
  loadScript(): never;
};

export type PaymentCheckoutSessionResult = {
  checkoutUrl: string;
  providerOrderId?: string;
};

export type PaymentAdapter = ExternalServiceAdapter & {
  createCheckoutSession(options: {
    userId?: string;
    userEmail?: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentCheckoutSessionResult>;
  verifyWebhookSignature(rawBody: string, signature: string, secret: string): Promise<boolean>;
};

export type StripeAdapter = PaymentAdapter;
export type LemonSqueezyAdapter = PaymentAdapter;

export type ResendAdapter = ExternalServiceAdapter & {
  sendEmail(): never;
};

export type TurnstileAdapter = ExternalServiceAdapter & {
  verifyToken(): never;
};

export type AnalyticsAdapter = ExternalServiceAdapter & {
  track(): void;
};

export type ExternalAdapters = {
  supabase: SupabaseAdapter;
  postgresql: PostgreSqlAdapter;
  openai: OpenAiAdapter;
  googleOAuth: GoogleOAuthAdapter;
  googleAdSense: AdvertisingAdapter;
  googleAdManager: AdvertisingAdapter;
  stripe: StripeAdapter;
  lemonSqueezy: LemonSqueezyAdapter;
  resend: ResendAdapter;
  turnstile: TurnstileAdapter;
  analytics: AnalyticsAdapter;
};

export function createExternalAdapters(config = getProductionConfig()): ExternalAdapters {
  const supabase = createAdapter('supabase', Boolean(config.database.supabaseUrl && config.database.supabaseAnonKey), config.database.mode === 'supabase') as SupabaseAdapter;
  supabase.createClient = () => unavailable('supabase');

  const postgresql = createAdapter('postgresql', config.database.hasDatabaseUrl, config.database.mode === 'supabase') as PostgreSqlAdapter;
  postgresql.connect = () => unavailable('postgresql');

  const openai = createAdapter('openai', config.ai.openAiConfigured, config.ai.moderationEnabled) as OpenAiAdapter;
  openai.moderate = () => unavailable('openai');
  openai.generateExplanation = () => unavailable('openai');

  const googleOAuth = createAdapter('google-oauth', config.auth.googleOAuthConfigured) as GoogleOAuthAdapter;
  googleOAuth.createAuthUrl = () => unavailable('google-oauth');
  googleOAuth.verifyCallback = () => unavailable('google-oauth');

  const googleAdSense = createAdapter('google-adsense', Boolean(config.ads.adsensePublisherId), config.ads.enabled && config.ads.provider === 'adsense') as AdvertisingAdapter;
  googleAdSense.loadScript = () => unavailable('google-adsense');

  const googleAdManager = createAdapter('google-ad-manager', Boolean(config.ads.googleAdManagerNetworkCode), config.ads.enabled && config.ads.provider === 'google-ad-manager') as AdvertisingAdapter;
  googleAdManager.loadScript = () => unavailable('google-ad-manager');

  const stripe = createAdapter('stripe', config.payments.stripeConfigured) as StripeAdapter;
  stripe.createCheckoutSession = () => unavailable('stripe');
  stripe.verifyWebhookSignature = () => unavailable('stripe');

  const lemonSqueezy = createAdapter('lemon-squeezy', config.payments.lemonSqueezyConfigured) as LemonSqueezyAdapter;
  lemonSqueezy.createCheckoutSession = () => unavailable('lemon-squeezy');
  lemonSqueezy.verifyWebhookSignature = () => unavailable('lemon-squeezy');

  const resend = createAdapter('resend', config.email.resendConfigured) as ResendAdapter;
  resend.sendEmail = () => unavailable('resend');

  const turnstile = createAdapter('cloudflare-turnstile', config.captcha.turnstileConfigured) as TurnstileAdapter;
  turnstile.verifyToken = () => unavailable('cloudflare-turnstile');

  const analytics = createAdapter('analytics', config.analytics.provider !== 'none') as AnalyticsAdapter;
  analytics.track = () => undefined;

  return {
    supabase,
    postgresql,
    openai,
    googleOAuth,
    googleAdSense,
    googleAdManager,
    stripe,
    lemonSqueezy,
    resend,
    turnstile,
    analytics
  };
}
