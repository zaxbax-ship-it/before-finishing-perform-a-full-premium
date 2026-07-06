import { generateExplanation, runLocalModeration, type CommunityDraft } from '@/lib/community';
import { readBooleanEnv, readEnv } from '@/lib/infrastructure/environment';
import type { Question } from '@/lib/types';
import type { AiModerationInput, AiModerationOutput, AiModerationProvider } from './types';
import { clampScore, trimExplanation } from './validation';

type BudgetBucket = {
  count: number;
  estimatedTokens: number;
  resetAtMs: number;
};

export type AiSafetyConfig = {
  timeoutMs: number;
  retryAttempts: number;
  maxEstimatedTokensPerRequest: number;
  dailyRequestLimit: number;
  monthlyRequestLimit: number;
  dailyEstimatedTokenLimit: number;
  monthlyEstimatedTokenLimit: number;
  autoApproveMinConfidence: number;
  duplicateReviewRisk: number;
  lowQualityReviewRisk: number;
  unsafeRejectRisk: number;
  enforceStrictReview: boolean;
};

export type AiSafetyDecision = {
  allowed: boolean;
  reason?: string;
  estimatedTokens: number;
};

const budgetBuckets = new Map<string, BudgetBucket>();

function numberEnv(name: string, fallback: number) {
  const value = Number(readEnv(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getAiSafetyConfig(): AiSafetyConfig {
  return {
    timeoutMs: numberEnv('AI_MODERATION_TIMEOUT_MS', 12000),
    retryAttempts: Math.min(2, numberEnv('AI_MODERATION_RETRY_ATTEMPTS', 1)),
    maxEstimatedTokensPerRequest: numberEnv('AI_MODERATION_MAX_ESTIMATED_TOKENS_PER_REQUEST', 4500),
    dailyRequestLimit: numberEnv('AI_MODERATION_DAILY_REQUEST_LIMIT', 1000),
    monthlyRequestLimit: numberEnv('AI_MODERATION_MONTHLY_REQUEST_LIMIT', 20000),
    dailyEstimatedTokenLimit: numberEnv('AI_MODERATION_DAILY_ESTIMATED_TOKEN_LIMIT', 2500000),
    monthlyEstimatedTokenLimit: numberEnv('AI_MODERATION_MONTHLY_ESTIMATED_TOKEN_LIMIT', 50000000),
    autoApproveMinConfidence: numberEnv('AI_MODERATION_AUTO_APPROVE_MIN_CONFIDENCE', 88),
    duplicateReviewRisk: numberEnv('AI_MODERATION_DUPLICATE_REVIEW_RISK', 55),
    lowQualityReviewRisk: numberEnv('AI_MODERATION_LOW_QUALITY_REVIEW_RISK', 60),
    unsafeRejectRisk: numberEnv('AI_MODERATION_UNSAFE_REJECT_RISK', 85),
    enforceStrictReview: readBooleanEnv('AI_MODERATION_STRICT_REVIEW', true)
  };
}

export function estimateModerationTokens(input: AiModerationInput) {
  const serialized = JSON.stringify({
    draft: input.draft,
    existingQuestions: input.existingQuestions.slice(0, 80).map(question => question.question),
    existingSubmissions: input.existingSubmissions.slice(0, 80)
  });
  return Math.ceil(serialized.length / 4) + 900;
}

function getWindowBucket(key: string, windowMs: number) {
  const nowMs = Date.now();
  const bucket = budgetBuckets.get(key);
  if (bucket && bucket.resetAtMs > nowMs) return bucket;
  const fresh = { count: 0, estimatedTokens: 0, resetAtMs: nowMs + windowMs };
  budgetBuckets.set(key, fresh);
  return fresh;
}

export function checkAndConsumeAiBudget(input: AiModerationInput, config = getAiSafetyConfig()): AiSafetyDecision {
  const estimatedTokens = estimateModerationTokens(input);
  if (estimatedTokens > config.maxEstimatedTokensPerRequest) {
    return { allowed: false, estimatedTokens, reason: 'Estimated token use exceeds the per-request safety limit.' };
  }

  const day = getWindowBucket('ai-budget:daily', 24 * 60 * 60 * 1000);
  const month = getWindowBucket('ai-budget:monthly', 30 * 24 * 60 * 60 * 1000);

  if (day.count + 1 > config.dailyRequestLimit || day.estimatedTokens + estimatedTokens > config.dailyEstimatedTokenLimit) {
    return { allowed: false, estimatedTokens, reason: 'Daily AI moderation budget exceeded.' };
  }

  if (month.count + 1 > config.monthlyRequestLimit || month.estimatedTokens + estimatedTokens > config.monthlyEstimatedTokenLimit) {
    return { allowed: false, estimatedTokens, reason: 'Monthly AI moderation budget exceeded.' };
  }

  day.count += 1;
  day.estimatedTokens += estimatedTokens;
  month.count += 1;
  month.estimatedTokens += estimatedTokens;

  return { allowed: true, estimatedTokens };
}

function timeoutError(timeoutMs: number) {
  return new Error(`AI moderation timed out after ${timeoutMs}ms.`);
}

export async function runWithTimeout<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(timeoutError(timeoutMs)), timeoutMs);
  try {
    return await work(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

export function createManualReviewFallback(input: { draft: CommunityDraft; existingQuestions: Question[]; reason: string; provider: AiModerationOutput['provider'] }): AiModerationOutput {
  const explanation = trimExplanation(input.draft.explanation || generateExplanation(input.draft));
  const moderation = runLocalModeration({ ...input.draft, explanation }, input.existingQuestions, []);
  const output: AiModerationOutput = {
    provider: input.provider,
    recommendation: 'needs_manual_review',
    confidence: clampScore(Math.min(moderation.score, 55)),
    improvedQuestion: moderation.normalizedQuestion,
    improvedOptions: moderation.normalizedOptions,
    correctIndex: input.draft.correctIndex,
    explanation,
    reasons: [input.reason, ...moderation.reasons],
    factCheck: {
      status: 'uncertain',
      notes: ['A safety control prevented automatic AI approval. Human review is required.']
    },
    qualitySignals: {
      duplicateRisk: 50,
      spamRisk: 0,
      unsafeRisk: 0,
      lowQualityRisk: 50
    },
    moderation: {
      ...moderation,
      status: 'needs_review',
      score: clampScore(Math.min(moderation.score, 55)),
      recommendation: 'needs_manual_review',
      reasons: [input.reason, ...moderation.reasons],
      explanation,
      aiProvider: input.provider,
      aiRecommendation: 'needs_manual_review',
      aiConfidence: clampScore(Math.min(moderation.score, 55)),
      improvedQuestion: moderation.normalizedQuestion,
      improvedOptions: moderation.normalizedOptions,
      factCheck: {
        status: 'uncertain',
        notes: ['A safety control prevented automatic AI approval. Human review is required.']
      },
      qualitySignals: {
        duplicateRisk: 50,
        spamRisk: 0,
        unsafeRisk: 0,
        lowQualityRisk: 50
      }
    }
  };
  return output;
}

export function enforceHumanReviewPolicy(output: AiModerationOutput, config = getAiSafetyConfig()): AiModerationOutput {
  if (!config.enforceStrictReview) return output;

  const reviewReasons: string[] = [];
  if (output.confidence < config.autoApproveMinConfidence) reviewReasons.push(`Confidence below auto-approval threshold (${output.confidence}/${config.autoApproveMinConfidence}).`);
  if (output.factCheck.status !== 'passed') reviewReasons.push(`Fact-check status is ${output.factCheck.status}.`);
  if (output.qualitySignals.duplicateRisk >= config.duplicateReviewRisk) reviewReasons.push(`Duplicate risk is ${output.qualitySignals.duplicateRisk}.`);
  if (output.qualitySignals.lowQualityRisk >= config.lowQualityReviewRisk) reviewReasons.push(`Low-quality risk is ${output.qualitySignals.lowQualityRisk}.`);

  const unsafeReject = output.qualitySignals.unsafeRisk >= config.unsafeRejectRisk;
  if (!reviewReasons.length && !unsafeReject) return output;

  const recommendation = unsafeReject ? 'reject' : 'needs_manual_review';
  const status = unsafeReject ? 'rejected' : 'needs_review';
  const reasons = [...reviewReasons, ...output.reasons];
  return {
    ...output,
    recommendation,
    reasons,
    moderation: {
      ...output.moderation,
      status,
      recommendation,
      reasons,
      aiRecommendation: recommendation
    }
  };
}

export async function moderateWithSafety(provider: AiModerationProvider, input: AiModerationInput, config = getAiSafetyConfig()): Promise<AiModerationOutput> {
  const budget = checkAndConsumeAiBudget(input, config);
  if (!budget.allowed) {
    return createManualReviewFallback({ draft: input.draft, existingQuestions: input.existingQuestions, reason: budget.reason || 'AI budget limit exceeded.', provider: provider.name });
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= config.retryAttempts; attempt += 1) {
    try {
      const result = await runWithTimeout(signal => provider.moderate(input, { signal }), config.timeoutMs);
      return enforceHumanReviewPolicy(result, config);
    } catch (error) {
      lastError = error;
      if (attempt >= config.retryAttempts) break;
    }
  }

  const message = lastError instanceof Error && lastError.name === 'AbortError'
    ? 'AI moderation timed out and was routed to manual review.'
    : 'AI moderation failed and was routed to manual review.';
  return createManualReviewFallback({ draft: input.draft, existingQuestions: input.existingQuestions, reason: message, provider: provider.name });
}
