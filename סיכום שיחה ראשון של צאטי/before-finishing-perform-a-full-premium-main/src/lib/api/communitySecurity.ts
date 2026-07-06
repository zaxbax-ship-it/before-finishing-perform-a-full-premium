import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { CommunitySubmission } from '@/lib/community';
import { createLogger } from '@/lib/infrastructure/logger';

const MAX_JSON_BODY_BYTES = 32 * 1024;

export const communityApiLogger = createLogger('community-api');

export function publicJsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function internalServerError(scope: string, error: unknown) {
  communityApiLogger.error('Community API request failed.', {
    route: scope,
    error: error instanceof Error ? error.message : 'Unknown error'
  });
  return publicJsonError('The request could not be completed right now.', 500);
}

export async function readLimitedJson<T>(request: Request): Promise<T> {
  const length = request.headers.get('content-length');
  if (length && Number(length) > MAX_JSON_BODY_BYTES) {
    throw new Error(`Request body is too large. Max size is ${MAX_JSON_BODY_BYTES} bytes.`);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_JSON_BODY_BYTES) {
    throw new Error(`Request body is too large. Max size is ${MAX_JSON_BODY_BYTES} bytes.`);
  }

  return JSON.parse(text) as T;
}

export function hashIdentity(value?: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  return createHash('sha256').update(normalized).digest('hex');
}

export function getClientIdentity(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  const userAgent = request.headers.get('user-agent')?.trim();
  const ip = forwarded || realIp || 'unknown';
  return {
    ip,
    ipHash: hashIdentity(ip),
    userAgentHash: hashIdentity(userAgent)
  };
}

export function redactSubmissionForClient(submission: CommunitySubmission): CommunitySubmission {
  return {
    ...submission,
    draft: {
      ...submission.draft,
      contributorEmail: ''
    }
  };
}
