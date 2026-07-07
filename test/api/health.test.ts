import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/health/route';
import { isHealthResponse } from '@/lib/api/contracts';

/**
 * Smoke test for GET /api/health. Invokes the real route handler (no network,
 * no database) and asserts the response conforms to the shared HealthResponse
 * contract and never leaks secret values.
 */
describe('GET /api/health', () => {
  it('returns a contract-valid, secret-free health payload', async () => {
    const response = await GET();
    expect([200, 503]).toContain(response.status);

    const body = await response.json();
    expect(isHealthResponse(body)).toBe(true);
    expect(typeof body.ok).toBe('boolean');
    expect(['ok', 'degraded', 'down']).toContain(body.status);
    expect(Array.isArray(body.checks)).toBe(true);

    // No secret material must ever appear in the health payload.
    const serialized = JSON.stringify(body).toLowerCase();
    for (const forbidden of ['service_role', 'secret', 'client_secret', 'password', 'api_key', 'apikey']) {
      expect(serialized.includes(forbidden)).toBe(false);
    }
  });
});
