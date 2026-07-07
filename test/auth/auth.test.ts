import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '@/lib/auth/authService';
import type { SupabaseClient } from '@supabase/supabase-js';

function createMockSupabaseClient() {
  return {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn()
    }
  } as unknown as SupabaseClient;
}

describe('AuthService client wrapper', () => {
  it('returns not configured status when client is null', async () => {
    const service = new AuthService(null);
    expect(service.isConfigured).toBe(false);

    const res = await service.signInWithPassword('test@test.com', 'pwd');
    expect(res.status).toBe('error');
    expect(res.message).toContain('Authentication is not configured yet');
  });

  it('signs in with password successfully', async () => {
    const mockClient = createMockSupabaseClient();
    vi.mocked(mockClient.auth.signInWithPassword).mockResolvedValue({
      data: { user: {} },
      error: null
    } as any);

    const service = new AuthService(mockClient);
    expect(service.isConfigured).toBe(true);

    const res = await service.signInWithPassword(' Test@Test.com ', 'password123');
    expect(res.status).toBe('ok');
    expect(mockClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'password123'
    });
  });

  it('maps specific provider not enabled error strings gracefully', async () => {
    const mockClient = createMockSupabaseClient();
    vi.mocked(mockClient.auth.signInWithPassword).mockResolvedValue({
      data: null,
      error: { message: 'Provider is not enabled' }
    } as any);

    const service = new AuthService(mockClient);
    const res = await service.signInWithPassword('test@test.com', 'pwd');
    expect(res.status).toBe('error');
    expect(res.message).toContain('Google login is not enabled yet');
  });

  it('handles sign up with password verification sent state', async () => {
    const mockClient = createMockSupabaseClient();
    vi.mocked(mockClient.auth.signUp).mockResolvedValue({
      data: { user: {}, session: null },
      error: null
    } as any);

    const service = new AuthService(mockClient);
    const res = await service.signUpWithEmail('signup@test.com', 'pwd123');
    expect(res.status).toBe('verification_sent');
    expect(res.message).toContain('verification email has been sent');
  });

  it('handles sign up direct login success state', async () => {
    const mockClient = createMockSupabaseClient();
    vi.mocked(mockClient.auth.signUp).mockResolvedValue({
      data: { user: {}, session: {} },
      error: null
    } as any);

    const service = new AuthService(mockClient);
    const res = await service.signUpWithEmail('direct@test.com', 'pwd123');
    expect(res.status).toBe('ok');
  });

  it('requests password reset email successfully', async () => {
    const mockClient = createMockSupabaseClient();
    vi.mocked(mockClient.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: null
    } as any);

    const service = new AuthService(mockClient);
    const res = await service.requestPasswordReset('forgot@test.com');
    expect(res.status).toBe('reset_sent');
    expect(res.message).toContain('password reset link has been sent');
  });

  it('updates password successfully', async () => {
    const mockClient = createMockSupabaseClient();
    vi.mocked(mockClient.auth.updateUser).mockResolvedValue({
      data: { user: {} },
      error: null
    } as any);

    const service = new AuthService(mockClient);
    const res = await service.updatePassword('newpassword');
    expect(res.status).toBe('ok');
    expect(mockClient.auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword' });
  });

  it('signs out successfully', async () => {
    const mockClient = createMockSupabaseClient();
    vi.mocked(mockClient.auth.signOut).mockResolvedValue({
      error: null
    } as any);

    const service = new AuthService(mockClient);
    const res = await service.signOut();
    expect(res.status).toBe('ok');
    expect(mockClient.auth.signOut).toHaveBeenCalled();
  });
});
