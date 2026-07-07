import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as getSubmissions, POST as createSubmission } from '@/app/api/community/submissions/route';
import { PATCH as reviewSubmission } from '@/app/api/community/submissions/[id]/route';

// Mock config module to allow setting config states dynamically
vi.mock('@/lib/auth/config', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth/config')>();
  return {
    ...original,
    isAuthEnforced: vi.fn().mockReturnValue(false)
  };
});

// Mock session and adminAccess modules
vi.mock('@/lib/auth/session', () => ({
  getAuthUser: vi.fn().mockResolvedValue(null)
}));

vi.mock('@/lib/auth/adminAccess', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth/adminAccess')>();
  return {
    ...original,
    resolveAdminContextForUser: vi.fn().mockResolvedValue(null),
    openLocalAdminContext: vi.fn().mockResolvedValue({
      email: 'local-admin',
      displayName: 'Local Admin (open mode)',
      roleSlugs: ['super_admin'],
      permissionSlugs: ['submissions.read', 'submissions.review'],
      source: 'local-open'
    })
  };
});

import { isAuthEnforced } from '@/lib/auth/config';
import { getAuthUser } from '@/lib/auth/session';
import { resolveAdminContextForUser } from '@/lib/auth/adminAccess';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';

describe('Admin Submissions API Endpoints Integration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Enforcement is INACTIVE (Open Local Mode)', () => {
    it('GET /api/community/submissions returns all submissions and audit logs successfully', async () => {
      vi.mocked(isAuthEnforced).mockReturnValue(false);

      const response = await getSubmissions();
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.submissions)).toBe(true);
      expect(Array.isArray(body.auditLogs)).toBe(true);
    });

    it('PATCH /api/community/submissions/[id] processes approval successfully', async () => {
      vi.mocked(isAuthEnforced).mockReturnValue(false);

      // Create a submission draft first in repositories
      const repos = getRepositoryProvider();
      const submission = await repos.submissions.create({
        draft: {
          question: 'What is the color of the sky?',
          options: ['Blue', 'Green', 'Yellow', 'Red'],
          correctIndex: 0,
          category: 'Nature',
          difficulty: 'קל',
          language: 'en',
          explanation: 'The sky is blue due to Rayleigh scattering.',
          contributorName: 'Test Contributor',
          contributorEmail: 'test@example.com'
        },
        moderation: {
          status: 'needs_review',
          confidence: 70,
          score: 70,
          reasons: [],
          normalizedQuestion: 'What is the color of the sky?',
          normalizedOptions: ['Blue', 'Green', 'Yellow', 'Red'],
          explanation: 'The sky is blue due to Rayleigh scattering.',
          moderatedAt: new Date().toISOString()
        }
      });

      const request = new Request(`http://localhost/api/community/submissions/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', note: 'Looks good.' })
      });
      const context = { params: Promise.resolve({ id: submission.id }) };

      const response = await reviewSubmission(request, context);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.submission.moderation.status).toBe('approved');
    });
  });

  describe('Enforcement is ACTIVE (Secure Mode)', () => {
    it('returns 401 when request is completely unauthenticated', async () => {
      vi.mocked(isAuthEnforced).mockReturnValue(true);
      vi.mocked(getAuthUser).mockResolvedValue(null);

      const response = await getSubmissions();
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toContain('Authentication is required');
    });

    it('returns 403 when user is authenticated but not an admin', async () => {
      vi.mocked(isAuthEnforced).mockReturnValue(true);
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'some-user', email: 'user@example.com', emailVerified: true });
      vi.mocked(resolveAdminContextForUser).mockResolvedValue(null);

      const response = await getSubmissions();
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toContain('Administrator access is required');
    });

    it('returns 403 when admin does not have correct permissions', async () => {
      vi.mocked(isAuthEnforced).mockReturnValue(true);
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'some-admin', email: 'admin@example.com', emailVerified: true });
      vi.mocked(resolveAdminContextForUser).mockResolvedValue({
        authUserId: 'some-admin',
        email: 'admin@example.com',
        displayName: 'Test Admin',
        roleSlugs: ['moderator'],
        permissionSlugs: [], // empty permissions
        source: 'db'
      });

      const response = await getSubmissions();
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toContain('Missing required permission');
    });

    it('returns 200 when admin has the correct permissions', async () => {
      vi.mocked(isAuthEnforced).mockReturnValue(true);
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'some-admin', email: 'admin@example.com', emailVerified: true });
      vi.mocked(resolveAdminContextForUser).mockResolvedValue({
        authUserId: 'some-admin',
        email: 'admin@example.com',
        displayName: 'Test Admin',
        roleSlugs: ['moderator'],
        permissionSlugs: ['submissions.read'],
        source: 'db'
      });

      const response = await getSubmissions();
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.ok).toBe(true);
    });
  });
});
