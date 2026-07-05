import { NextResponse } from 'next/server';
import { checkRateLimit, type RateLimitRule } from '@/lib/infrastructure/rateLimit';
import { getDatabaseConfig, isSupabaseConfigured } from '@/lib/database/config';
import { createLogger } from '@/lib/infrastructure/logger';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import { createDatabaseRepositoryProvider } from '@/lib/repositories/providers/databaseProvider';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { getClientIdentity } from './communitySecurity';

const MAX_MULTIPLAYER_JSON_BYTES = 12 * 1024;
const multiplayerApiLogger = createLogger('multiplayer-api');

export class MultiplayerApiError extends Error {
  constructor(
    message: string,
    readonly publicMessage: string,
    readonly status: number,
    readonly stage: string
  ) {
    super(message);
  }
}

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

export function getMultiplayerRepositories(stage: string): RepositoryProvider {
  const provider = getRepositoryProvider();
  const database = getDatabaseConfig();
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && provider.kind !== 'database' && isSupabaseConfigured(database)) {
    multiplayerApiLogger.warn('Multiplayer is using the database provider because Supabase is configured in production.', {
      stage,
      configuredProvider: provider.kind,
      databaseMode: database.mode,
      hasSupabaseUrl: Boolean(database.supabaseUrl),
      hasServiceRoleKey: database.hasServiceRoleKey
    });
    return createDatabaseRepositoryProvider();
  }

  if (isProduction && provider.kind !== 'database') {
    multiplayerApiLogger.error('Multiplayer database provider is not active in production.', {
      stage,
      provider: provider.kind,
      databaseMode: database.mode,
      hasSupabaseUrl: Boolean(database.supabaseUrl),
      hasServiceRoleKey: database.hasServiceRoleKey,
      isSupabaseConfigured: isSupabaseConfigured(database)
    });

    throw new MultiplayerApiError(
      'Multiplayer requires the database provider in production.',
      'Multiplayer database is not configured.',
      503,
      stage
    );
  }

  return provider;
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

export function multiplayerApiErrorResponse(scope: string, error: unknown) {
  if (error instanceof MultiplayerApiError) {
    return NextResponse.json(
      { ok: false, error: error.publicMessage },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  multiplayerApiLogger.error('Multiplayer API request failed.', {
    scope,
    error: error instanceof Error ? error.message : 'Unknown error'
  });

  return NextResponse.json(
    { ok: false, error: 'Could not complete this multiplayer request right now.' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } }
  );
}
