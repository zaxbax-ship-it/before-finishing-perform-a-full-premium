import { NextResponse } from 'next/server';
import { checkRateLimit, type RateLimitRule } from '@/lib/infrastructure/rateLimit';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import { getClientIdentity } from './communitySecurity';

const MAX_MULTIPLAYER_JSON_BYTES = 12 * 1024;

export async function readMultiplayerJson<T>(request: Request): Promise<T> {
  const length = request.headers.get('content-length');
  if (length && Number(length) > MAX_MULTIPLAYER_JSON_BYTES) {
    throw new Error(`Request body is too large. Max size is ${MAX_MULTIPLAYER_JSON_BYTES} bytes.`);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_MULTIPLAYER_JSON_BYTES) {
    throw new Error(`Request body is too large. Max size is ${MAX_MULTIPLAYER_JSON_BYTES} bytes.`);
  }

  return JSON.parse(text) as T;
}

export async function enforceMultiplayerRateLimit(
  request: Request,
  repositories: RepositoryProvider,
  scope: string,
  rule: Omit<RateLimitRule, 'key'>,
  identityPart = 'anonymous'
) {
  const client = getClientIdentity(request);
  const result = checkRateLimit({
    key: `multiplayer:${scope}:${client.ipHash || 'unknown'}:${identityPart}`,
    ...rule
  });

  if (result.allowed) return undefined;

  await repositories.antiSpamEvents.create({
    eventType: 'rate_limit',
    ipHash: client.ipHash,
    userAgentHash: client.userAgentHash,
    severity: 65,
    details: {
      scope: `multiplayer_${scope}`,
      retryAfterSeconds: result.retryAfterSeconds,
      resetAt: result.resetAt
    }
  });

  return NextResponse.json(
    { ok: false, error: 'Too many multiplayer requests. Please wait before trying again.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds), 'Cache-Control': 'no-store' } }
  );
}
