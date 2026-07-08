import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as getSubmissions } from '@/app/api/community/submissions/route';
import { PATCH as reviewSubmission } from '@/app/api/community/submissions/[id]/route';
import { adminAccessMode } from '@/lib/auth/guards';

// Drive enforcement directly; everything else uses the real modules.
vi.mock('@/lib/auth/config', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth/config')>();
  return {
    ...original,
    isAuthEnforced: vi.fn().mockReturnValue(false)
  };
});

import { isAuthEnforced } from '@/lib/auth/config';

/**
 * Production admin lockdown: when auth is not enforced (Supabase env missing
 * or AUTH_ENFORCED=false), a production runtime must fail CLOSED — no open
 * admin mode can ever reach real users. Open mode remains available only in
 * non-production runtimes as the local development fallback.
 */
describe('Admin production lockdown', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.mocked(isAuthEnforced).mockReturnValue(false);
  });

  describe('adminAccessMode()', () => {
    it('is enforced whenever auth enforcement is on, in any runtime', () => {
      vi.mocked(isAuthEnforced).mockReturnValue(true);
      expect(adminAccessMode()).toBe('enforced');

      vi.stubEnv('NODE_ENV', 'production');
      expect(adminAccessMode()).toBe('enforced');
    });

    it('is open-dev without enforcement outside production', () => {
      vi.mocked(isAuthEnforced).mockReturnValue(false);
      expect(adminAccessMode()).toBe('open-dev');
    });

    it('is locked without enforcement in a production runtime', () => {
      vi.mocked(isAuthEnforced).mockReturnValue(false);
      vi.stubEnv('NODE_ENV', 'production');
      expect(adminAccessMode()).toBe('locked');
    });
  });

  describe('admin APIs fail closed in locked mode', () => {
    it('GET /api/community/submissions returns 403 for every caller', async () => {
      vi.mocked(isAuthEnforced).mockReturnValue(false);
      vi.stubEnv('NODE_ENV', 'production');

      const response = await getSubmissions();
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    it('PATCH /api/community/submissions/[id] returns 403 for every caller', async () => {
      vi.mocked(isAuthEnforced).mockReturnValue(false);
      vi.stubEnv('NODE_ENV', 'production');

      const request = new Request('http://localhost/api/community/submissions/some-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });

      const response = await reviewSubmission(request, { params: Promise.resolve({ id: 'some-id' }) });
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.ok).toBe(false);
    });
  });

  describe('open development fallback stays available', () => {
    it('GET /api/community/submissions succeeds outside production without enforcement', async () => {
      vi.mocked(isAuthEnforced).mockReturnValue(false);

      const response = await getSubmissions();
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.ok).toBe(true);
    });
  });
});
