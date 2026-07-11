import { readEnv } from './environment';
import { checkRateLimit, getRateLimitProviderInfo, isUpstashRateLimitConfigured, type RateLimitResult, type RateLimitRule } from './rateLimitProvider';

export type { RateLimitResult, RateLimitRule };

function numberEnv(name: string, fallback: number) {
  const value = Number(readEnv(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export { checkRateLimit, getRateLimitProviderInfo, isUpstashRateLimitConfigured };

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

export function getMultiplayerStateRateLimit() {
  return {
    limit: numberEnv('MULTIPLAYER_STATE_RATE_LIMIT', 240),
    windowMs: numberEnv('MULTIPLAYER_STATE_RATE_LIMIT_WINDOW_SECONDS', 60) * 1000
  };
}

export function getMultiplayerAnswerRateLimit() {
  return {
    limit: numberEnv('MULTIPLAYER_ANSWER_RATE_LIMIT', 90),
    windowMs: numberEnv('MULTIPLAYER_ANSWER_RATE_LIMIT_WINDOW_SECONDS', 60) * 1000
  };
}

export function getRewardsWriteRateLimit() {
  return {
    limit: numberEnv('REWARDS_WRITE_RATE_LIMIT', 60),
    windowMs: numberEnv('REWARDS_WRITE_RATE_LIMIT_WINDOW_SECONDS', 60) * 1000
  };
}
