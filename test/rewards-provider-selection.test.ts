import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRewardsRepository } from '@/lib/rewards/repositoryFactory';

/**
 * Phase 1 — active provider selection, exercised through the REAL config path
 * (`getDatabaseConfig` reads `process.env` uncached). No mocks of the config
 * layer: we set env vars and assert which provider actually gets built. A `fetch`
 * spy distinguishes the Supabase provider (hits the REST API) from the in-memory
 * one (never touches the network).
 */

const ENV_KEYS = ['NEXT_PUBLIC_DATABASE_MODE', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NODE_ENV'] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('rewards provider selection (Phase 1)', () => {
  it('uses the in-memory provider in local mode — never touches the network', async () => {
    process.env.NEXT_PUBLIC_DATABASE_MODE = 'local';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const repo = createRewardsRepository();
    const snapshot = await repo.load('p1');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(snapshot.career.lifetimeTotal).toBe(0);
  });

  it('selects the Supabase provider when mode=supabase and credentials are present', async () => {
    process.env.NEXT_PUBLIC_DATABASE_MODE = 'supabase';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-service-role-key';
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => [], text: async () => '[]' }));
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

    const repo = createRewardsRepository();
    await repo.load('p1');

    expect(fetchSpy).toHaveBeenCalled();
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain('https://demo.supabase.co/rest/v1/');
    expect(url).toContain('player_key=eq.p1');
    // Service-role auth header proves server-authoritative access.
    const init = fetchSpy.mock.calls[0][1] as RequestInit | undefined;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer dummy-service-role-key');
  });

  it('fails loud in production when supabase mode is misconfigured', () => {
    process.env.NEXT_PUBLIC_DATABASE_MODE = 'supabase';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NODE_ENV = 'production';

    expect(() => createRewardsRepository()).toThrow(/not fully configured for rewards/i);
  });

  it('falls back to in-memory (development) when supabase mode is misconfigured outside production', async () => {
    process.env.NEXT_PUBLIC_DATABASE_MODE = 'supabase';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NODE_ENV = 'test';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const repo = createRewardsRepository();
    const snapshot = await repo.load('p1');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(snapshot.career.lifetimeTotal).toBe(0);
  });
});
