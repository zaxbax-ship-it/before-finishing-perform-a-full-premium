import 'server-only';
import { NextResponse } from 'next/server';
import { getClientIdentity } from './communitySecurity';
import { checkRateLimit, getRewardsWriteRateLimit } from '@/lib/infrastructure/rateLimit';

/**
 * Shared abuse guard for the rewards/progression write endpoints (and the
 * leaderboard submit). These are unauthenticated-friendly, player-keyed
 * mutations, so they are throttled per IP + player key exactly like the
 * community and multiplayer surfaces. Returns a ready 429 response when the
 * limit is exceeded, undefined otherwise.
 */
export async function enforceRewardsWriteRateLimit(
  request: Request,
  scope: string,
  identityPart = 'anonymous'
): Promise<NextResponse | undefined> {
  const client = getClientIdentity(request);
  const result = await checkRateLimit({
    key: `rewards:${scope}:${client.ipHash || 'unknown'}:${identityPart}`,
    ...getRewardsWriteRateLimit()
  });

  if (result.allowed) return undefined;

  return NextResponse.json(
    { ok: false, error: 'Too many requests. Please wait before trying again.', errorCode: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds), 'Cache-Control': 'no-store' } }
  );
}
