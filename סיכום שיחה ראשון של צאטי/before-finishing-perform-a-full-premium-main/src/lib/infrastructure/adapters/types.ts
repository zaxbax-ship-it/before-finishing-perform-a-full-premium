export type ExternalServiceName =
  | 'supabase'
  | 'postgresql'
  | 'openai'
  | 'google-oauth'
  | 'google-adsense'
  | 'google-ad-manager'
  | 'stripe'
  | 'resend'
  | 'cloudflare-turnstile'
  | 'analytics';

export type ExternalServiceAdapter = {
  name: ExternalServiceName;
  configured: boolean;
  enabled: boolean;
  status(): { name: ExternalServiceName; configured: boolean; enabled: boolean; message: string };
};

export function unavailable(name: ExternalServiceName): never {
  throw new Error(`${name} adapter is prepared but not connected yet. Add credentials, install the provider SDK if needed, and implement the live adapter before calling it.`);
}
