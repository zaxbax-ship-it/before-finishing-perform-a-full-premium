import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRepositoryProvider, resetRepositoryProviderForTests } from '@/lib/repositories/providerFactory';
import { buildStartupValidationReport, EXPECTED_MIGRATION_VERSION } from '@/lib/infrastructure/startupValidation';

vi.mock('@/lib/database/config', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/database/config')>();
  return {
    ...original,
    getDatabaseConfig: vi.fn().mockReturnValue({
      mode: 'local',
      supabaseUrl: undefined,
      supabaseAnonKey: undefined,
      hasServiceRoleKey: false,
      hasDatabaseUrl: false
    })
  };
});

import { getDatabaseConfig } from '@/lib/database/config';

function mockConfig(overrides: Partial<ReturnType<typeof getDatabaseConfig>>) {
  vi.mocked(getDatabaseConfig).mockReturnValue({
    mode: 'local',
    supabaseUrl: undefined,
    supabaseAnonKey: undefined,
    hasServiceRoleKey: false,
    hasDatabaseUrl: false,
    ...overrides
  });
}

/**
 * Phase 1 — production backend activation. The provider selection must never
 * silently fall back: requesting database mode with an invalid configuration
 * throws in production and logs loudly (with a dev-only fallback) elsewhere.
 */
describe('Repository provider activation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetRepositoryProviderForTests();
    mockConfig({});
  });

  it('uses the local provider in local mode', () => {
    mockConfig({ mode: 'local' });
    expect(createRepositoryProvider().kind).toBe('local-json');
  });

  it('uses the database provider when supabase mode is fully configured', () => {
    mockConfig({ mode: 'supabase', supabaseUrl: 'https://example.supabase.co', hasServiceRoleKey: true });
    // The provider implementation reads the raw env directly.
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test');
    expect(createRepositoryProvider().kind).toBe('database');
  });

  it('throws loudly in production when supabase mode is misconfigured', () => {
    mockConfig({ mode: 'supabase', supabaseUrl: undefined, hasServiceRoleKey: false });
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => createRepositoryProvider()).toThrow(/not fully configured/);
  });

  it('falls back to local outside production when supabase mode is misconfigured (dev convenience)', () => {
    mockConfig({ mode: 'supabase', supabaseUrl: undefined, hasServiceRoleKey: false });
    expect(createRepositoryProvider().kind).toBe('local-json');
  });
});

describe('Startup validation report', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mockConfig({});
  });

  it('reports the active provider, database mode and expected migration version', () => {
    mockConfig({ mode: 'local' });
    const report = buildStartupValidationReport();
    expect(report.activeProvider).toBe('local-json');
    expect(report.databaseMode).toBe('local');
    expect(report.databaseConfigValid).toBe(true);
    expect(report.expectedMigrationVersion).toBe(EXPECTED_MIGRATION_VERSION);
    expect(report.productionMisconfigured).toBe(false);
  });

  it('flags a misconfigured production database mode', () => {
    mockConfig({ mode: 'supabase', supabaseUrl: undefined, hasServiceRoleKey: false });
    vi.stubEnv('NODE_ENV', 'production');
    const report = buildStartupValidationReport();
    expect(report.activeProvider).toBe('local-json');
    expect(report.databaseConfigValid).toBe(false);
    expect(report.productionMisconfigured).toBe(true);
  });

  it('reports a valid database-mode deployment as database provider', () => {
    mockConfig({ mode: 'supabase', supabaseUrl: 'https://example.supabase.co', hasServiceRoleKey: true });
    const report = buildStartupValidationReport();
    expect(report.activeProvider).toBe('database');
    expect(report.databaseConfigValid).toBe(true);
    expect(report.productionMisconfigured).toBe(false);
  });
});
