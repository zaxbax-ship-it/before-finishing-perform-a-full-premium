import { readEnv } from './environment';

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: string }
  | { allowed: false; remaining: 0; resetAt: string; retryAfterSeconds: number };

export type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAtMs: number;
};

const buckets = new Map<string, Bucket>();

function numberEnv(name: string, fallback: number) {
  const value = Number(readEnv(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function cleanup(nowMs: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAtMs <= nowMs) buckets.delete(key);
  }
}

export function checkRateLimit(rule: RateLimitRule): RateLimitResult {
  const nowMs = Date.now();
  cleanup(nowMs);

  const existing = buckets.get(rule.key);
  const bucket = existing && existing.resetAtMs > nowMs
    ? existing
    : { count: 0, resetAtMs: nowMs + rule.windowMs };

  bucket.count += 1;
  buckets.set(rule.key, bucket);

  const resetAt = new Date(bucket.resetAtMs).toISOString();
  if (bucket.count > rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAtMs - nowMs) / 1000))
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, rule.limit - bucket.count),
    resetAt
  };
}

export function getCommunitySubmissionRateLimit() {
  return {
    limit: numberEnv('COMMUNITY_SUBMISSION_RATE_LIMIT', 8),
    windowMs: numberEnv('COMMUNITY_SUBMISSION_RATE_LIMIT_WINDOW_SECONDS', 60) * 1000
  };
}

export function getAiModerationRateLimit() {
  return {
    limit: numberEnv('AI_MODERATION_RATE_LIMIT', 20),
    windowMs: numberEnv('AI_MODERATION_RATE_LIMIT_WINDOW_SECONDS', 60) * 1000
  };
}

export function getMultiplayerLobbyRateLimit() {
  return {
    limit: numberEnv('MULTIPLAYER_LOBBY_RATE_LIMIT', 30),
    windowMs: numberEnv('MULTIPLAYER_LOBBY_RATE_LIMIT_WINDOW_SECONDS', 60) * 1000
  };
}

export function getMultiplayerAnswerRateLimit() {
  return {
    limit: numberEnv('MULTIPLAYER_ANSWER_RATE_LIMIT', 90),
    windowMs: numberEnv('MULTIPLAYER_ANSWER_RATE_LIMIT_WINDOW_SECONDS', 60) * 1000
  };
}
