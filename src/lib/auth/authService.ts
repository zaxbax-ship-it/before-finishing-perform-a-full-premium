import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from './supabaseBrowserClient';
import { getAuthCallbackUrl, getPasswordResetRedirectUrl } from './config';
import type { AuthResult } from './types';

const NOT_CONFIGURED: AuthResult = {
  status: 'error',
  message: 'Authentication is not configured yet. Supabase Auth must be connected first.'
};

function authErrorMessage(message: string): string {
  if (/unsupported provider|provider is not enabled/i.test(message)) {
    return 'Google login is not enabled yet. Continue with email and password, or enable Google OAuth in Supabase first.';
  }
  return message;
}

/**
 * Reusable browser-side authentication service. Wraps the Supabase browser
 * client and returns a stable {@link AuthResult} so UI components never handle
 * raw provider errors. Server-side authorization is independent of this class.
 */
export class AuthService {
  private readonly client: SupabaseClient | null;

  constructor(client: SupabaseClient | null = createBrowserSupabaseClient()) {
    this.client = client;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    if (!this.client) return NOT_CONFIGURED;
    const { error } = await this.client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) return { status: 'error', message: authErrorMessage(error.message) };
    return { status: 'ok' };
  }

  async signUpWithEmail(email: string, password: string): Promise<AuthResult> {
    if (!this.client) return NOT_CONFIGURED;
    const { data, error } = await this.client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: getAuthCallbackUrl() }
    });
    if (error) return { status: 'error', message: authErrorMessage(error.message) };
    if (data.session) return { status: 'ok' };
    return {
      status: 'verification_sent',
      message: 'A verification email has been sent. Confirm your address to finish signing up.'
    };
  }

  async signInWithGoogle(): Promise<AuthResult> {
    if (!this.client) return NOT_CONFIGURED;
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthCallbackUrl() }
    });
    if (error) return { status: 'error', message: authErrorMessage(error.message) };
    // On success the browser is redirected to Google; nothing else to do here.
    return { status: 'ok' };
  }

  async requestPasswordReset(email: string): Promise<AuthResult> {
    if (!this.client) return NOT_CONFIGURED;
    const { error } = await this.client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: getPasswordResetRedirectUrl()
    });
    if (error) return { status: 'error', message: authErrorMessage(error.message) };
    return {
      status: 'reset_sent',
      message: 'If the address exists, a password reset link has been sent.'
    };
  }

  async updatePassword(newPassword: string): Promise<AuthResult> {
    if (!this.client) return NOT_CONFIGURED;
    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (error) return { status: 'error', message: authErrorMessage(error.message) };
    return { status: 'ok' };
  }

  async signOut(): Promise<AuthResult> {
    if (!this.client) return NOT_CONFIGURED;
    const { error } = await this.client.auth.signOut();
    if (error) return { status: 'error', message: authErrorMessage(error.message) };
    return { status: 'ok' };
  }

  async getEmail(): Promise<string | undefined> {
    if (!this.client) return undefined;
    const { data } = await this.client.auth.getUser();
    return data.user?.email ?? undefined;
  }
}

export function createAuthService(): AuthService {
  return new AuthService();
}
