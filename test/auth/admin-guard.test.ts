import { afterEach, describe, expect, it } from 'vitest';
import { getAdminAllowlist, isAdminAllowlisted } from '@/lib/auth/config';

/**
 * Guard test for the admin bootstrap allowlist — the authorization primitive that
 * decides whether an authenticated identity may reach admin surfaces before the
 * admins table is seeded. Verifies case-insensitive, whitespace-tolerant matching.
 */
const originalAdminEmails = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe('admin allowlist guard', () => {
  it('treats nobody as admin when the allowlist is empty', () => {
    delete process.env.ADMIN_EMAILS;
    expect(getAdminAllowlist()).toEqual([]);
    expect(isAdminAllowlisted('someone@example.com')).toBe(false);
  });

  it('matches allowlisted emails case-insensitively and trims whitespace', () => {
    process.env.ADMIN_EMAILS = '  Admin@Example.com , other@x.com ';
    expect(getAdminAllowlist()).toEqual(['admin@example.com', 'other@x.com']);
    expect(isAdminAllowlisted('ADMIN@example.com')).toBe(true);
    expect(isAdminAllowlisted('other@x.com')).toBe(true);
  });

  it('rejects non-listed and empty identities', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    expect(isAdminAllowlisted('intruder@evil.com')).toBe(false);
    expect(isAdminAllowlisted(undefined)).toBe(false);
    expect(isAdminAllowlisted('')).toBe(false);
  });
});
