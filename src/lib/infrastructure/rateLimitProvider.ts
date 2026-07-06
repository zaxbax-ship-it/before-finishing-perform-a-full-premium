import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createErrorReporter } from './errorReporter';
import { readEnv } from './environment';
import { createLogger } from './logger';

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: string }
  | { allowed: false; remaining: 0; resetAt: string; retryAfterSeconds: number };

export type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitProviderKind = 'memory' | 'upstash';

export type RateLimitProviderInfo = {
  kind: RateLimitProviderKind;
  distributed: boolean;
  configured: boolean;
  reason: 'development_default' | 'explicit_memory' | 'upstash_configured' | 'upstash_missing_config' | 'upstash_runtime_error';
};

type RateLimitProvider = {
  kind: RateLimitProviderKind;
  distributed: boolean;
  check(rule: RateLimitRule): Promise<RateLimitResult>;
};

type MemoryBucket = {
  count: number;
  resetAtMs: number;
};

const logger = createLogger('rate-limit');
const errorReporter = createErrorReporter();
const memoryBuckets = new Map<string, MemoryBucket>();
const emittedWarnings = new Set<string>();
const upstashLimiters = new Map<string, Ratelimit>();

let cachedRedis: Redis | undefined;

function cleanupMemoryBuckets(nowMs: number) {
  for (const [key, bucket] of memoryBuckets.entries()) {
    if (bucket.resetAtMs <= nowMs) memoryBuckets.delete(key);
  }
}

function warnOnce(code: string, message: string, context: Record<string, unknown> = {}) {
  if (emittedWarnings.has(code)) return;
  emittedWarnings.add(code);
  logger.warn(message, {
    code,
    runtime: process.env.NODE_ENV || 'development',
    ...toLogContext(context)
  });
}

function toLogContext(context: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(context).flatMap(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === undefined) {
        return [[key, value]];
      }
      return [[key, JSON.stringify(value)]];
    })
  );
}

function checkMemoryRateLimit(rule: RateLimitRule): RateLimitResult {
  const nowMs = Date.now();
  cleanupMemoryBuckets(nowMs);

  const existing = memoryBuckets.get(rule.key);
  const bucket = existing && existing.resetAtMs > nowMs
    ? existing
    : { count: 0, resetAtMs: nowMs + rule.windowMs };

  bucket.count += 1;
  memoryBuckets.set(rule.key, bucket);

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

const memoryRateLimitProvider: RateLimitProvider = {
  kind: 'memory',
  distributed: false,
  async check(rule) {
    return checkMemoryRateLimit(rule);
  }
};

function getRateLimitProviderMode() {
  const mode = readEnv('RATE_LIMIT_PROVIDER');
  return mode === 'memory' || mode === 'upstash' ? mode : 'auto';
}

export function isUpstashRateLimitConfigured() {
  return Boolean(readEnv('UPSTASH_REDIS_REST_URL') && readEnv('UPSTASH_REDIS_REST_TOKEN'));
}

function getRuntimeRateLimitProviderInfo(): RateLimitProviderInfo {
  const mode = getRateLimitProviderMode();
  const configured = isUpstashRateLimitConfigured();
  const isProduction = process.env.NODE_ENV === 'production';

  if (mode === 'memory') {
    return {
      kind: 'memory',
      distributed: false,
      configured: true,
      reason: 'explicit_memory'
    };
  }

  if (configured) {
    return {
      kind: 'upstash',
      distributed: true,
      configured: true,
      reason: 'upstash_configured'
    };
  }

  if (isProduction || mode === 'upstash') {
    warnOnce(
      'RATE_LIMIT_DISTRIBUTED_NOT_CONFIGURED',
      'Distributed rate limiting is not configured. Falling back to in-memory limits.',
      {
        requestedProvider: mode,
        hasUpstashUrl: Boolean(readEnv('UPSTASH_REDIS_REST_URL')),
        hasUpstashToken: Boolean(readEnv('UPSTASH_REDIS_REST_TOKEN'))
      }
    );
    return {
      kind: 'memory',
      distributed: false,
      configured: false,
      reason: 'upstash_missing_config'
    };
  }

  return {
    kind: 'memory',
    distributed: false,
    configured: true,
    reason: 'development_default'
  };
}

export function getRateLimitProviderInfo(): RateLimitProviderInfo {
  return getRuntimeRateLimitProviderInfo();
}

function getUpstashRedis() {
  if (!cachedRedis) cachedRedis = Redis.fromEnv();
  return cachedRedis;
}

function getUpstashLimiter(rule: RateLimitRule) {
  const windowSeconds = Math.max(1, Math.ceil(rule.windowMs / 1000));
  const cacheKey = `${rule.limit}:${windowSeconds}`;
  const existing = upstashLimiters.get(cacheKey);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis: getUpstashRedis(),
    limiter: Ratelimit.slidingWindow(rule.limit, `${windowSeconds} s`),
    analytics: false,
    prefix: 'premium-trivia-rate-limit'
  });

  upstashLimiters.set(cacheKey, limiter);
  return limiter;
}

const upstashRateLimitProvider: RateLimitProvider = {
  kind: 'upstash',
  distributed: true,
  async check(rule) {
    const limiter = getUpstashLimiter(rule);
    const result = await limiter.limit(rule.key);
    const resetMs = typeof result.reset === 'number' ? result.reset : Date.now() + rule.windowMs;
    const resetAt = new Date(resetMs).toISOString();

    if (!result.success) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetMs - Date.now()) / 1000))
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, typeof result.remaining === 'number' ? result.remaining : rule.limit - 1),
      resetAt
    };
  }
};

function getRateLimitProvider(): RateLimitProvider {
  const info = getRuntimeRateLimitProviderInfo();
  return info.kind === 'upstash' ? upstashRateLimitProvider : memoryRateLimitProvider;
}

export async function checkRateLimit(rule: RateLimitRule): Promise<RateLimitResult> {
  const provider = getRateLimitProvider();

  try {
    return await provider.check(rule);
  } catch (error) {
    warnOnce(
      'RATE_LIMIT_PROVIDER_RUNTIME_ERROR',
      'Distributed rate limiting failed at runtime. Falling back to in-memory limits.',
      {
        provider: provider.kind,
        hasUpstashUrl: Boolean(readEnv('UPSTASH_REDIS_REST_URL')),
        hasUpstashToken: Boolean(readEnv('UPSTASH_REDIS_REST_TOKEN'))
      }
    );
    errorReporter.capture({
      error,
      severity: 'medium',
      context: {
        area: 'rate-limit',
        provider: provider.kind,
        fallbackProvider: 'memory'
      }
    });

    return memoryRateLimitProvider.check(rule);
  }
}
