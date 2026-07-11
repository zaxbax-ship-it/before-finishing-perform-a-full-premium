import type { CommunityDraft } from '@/lib/community';
import { readBooleanEnv, readEnv } from '@/lib/infrastructure/environment';
import type { Question } from '@/lib/types';
import type { AiModerationInput, AiModerationOutput, AiModerationProvider } from './types';
import { clampScore, trimExplanation } from './validation';
import {
  cleanText,
  duplicateRiskFor,
  generateWrongAnswers,
  improveAnswerWording,
  improveQuestionWording,
  inferCategory,
  inferDifficulty,
  normalizeComparable,
  shuffleOptions
} from './editorial';

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
const DIFFICULTY_LABELS = { easy: 'קל', medium: 'בינוני', hard: 'קשה', expert: 'מומחה' };
const DEFAULT_CATEGORY = 'ידע כללי';

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

function fallbackExplanation(correctAnswer: string, language: string) {
  const answer = cleanText(correctAnswer);
  if (language === 'he') return `התשובה הנכונה היא ${answer}.`;
  if (language === 'ar') return `الإجابة الصحيحة هي ${answer}.`;
  if (language === 'ru') return `Правильный ответ — ${answer}.`;
  return `The correct answer is ${answer}.`;
}

/**
 * Safety net for a failed/timed-out/over-budget request. Still produces a
 * complete, valid, game-ready question (via the editorial helpers) so a human
 * can review it — but always as `needs_manual_review`, never auto-approved.
 */
export function createManualReviewFallback(input: { draft: CommunityDraft; existingQuestions: Question[]; existingSubmissions?: Array<{ question: string }>; reason: string; provider: AiModerationOutput['provider'] }): AiModerationOutput {
  const draft = input.draft;
  const rawQuestion = draft.question;
  const rawCorrect = draft.options[draft.correctIndex] || '';
  const seed = normalizeComparable(rawQuestion) + '|' + normalizeComparable(rawCorrect);
  const improvedQuestion = improveQuestionWording(rawQuestion);
  const correctAnswer = improveAnswerWording(rawCorrect);
  const category = inferCategory(rawQuestion, rawCorrect, input.existingQuestions, DEFAULT_CATEGORY);
  const difficulty = inferDifficulty(rawQuestion, rawCorrect, DIFFICULTY_LABELS);
  const generatedWrongAnswers = generateWrongAnswers(correctAnswer, input.existingQuestions, category, seed);
  const { options: improvedOptions, correctIndex } = shuffleOptions(correctAnswer, generatedWrongAnswers, seed);
  const explanation = trimExplanation(fallbackExplanation(correctAnswer, draft.language));
  const dup = duplicateRiskFor(improvedQuestion, input.existingQuestions, input.existingSubmissions || []);
  const confidence = clampScore(Math.min(55, 55 - Math.round(dup.risk * 0.2)));
  const reasons = [input.reason];
  const factCheck = { status: 'uncertain' as const, notes: ['A safety control prevented automatic AI processing. Human review is required.'] };
  const qualitySignals = { duplicateRisk: dup.risk, spamRisk: 0, unsafeRisk: 0, lowQualityRisk: 50 };

  return {
    provider: input.provider,
    recommendation: 'needs_manual_review',
    confidence,
    improvedQuestion,
    correctAnswer,
    generatedWrongAnswers,
    improvedOptions,
    correctIndex,
    category,
    difficulty,
    explanation,
    reasons,
    factCheck,
    qualitySignals,
    moderation: {
      status: 'needs_review',
      score: confidence,
      recommendation: 'needs_manual_review',
      reasons,
      normalizedQuestion: improvedQuestion,
      normalizedOptions: improvedOptions,
      explanation,
      duplicateQuestionId: dup.duplicateId,
      aiProvider: input.provider,
      aiRecommendation: 'needs_manual_review',
      aiConfidence: confidence,
      improvedQuestion,
      improvedOptions,
      factCheck,
      qualitySignals,
      original: { question: cleanText(rawQuestion), correctAnswer: cleanText(rawCorrect) }
    }
  };
}

/**
 * Editorial guardrails. The AI never publishes, so this only downgrades the
 * advisory recommendation and flags unsafe content for rejection — the stored
 * status stays `needs_review` for a human to decide.
 */
export function enforceHumanReviewPolicy(output: AiModerationOutput, config = getAiSafetyConfig()): AiModerationOutput {
  if (!config.enforceStrictReview) return output;

  const reviewReasons: string[] = [];
  if (output.factCheck.status !== 'passed') reviewReasons.push(`Fact-check status is ${output.factCheck.status}.`);
  if (output.qualitySignals.duplicateRisk >= config.duplicateReviewRisk) reviewReasons.push(`Duplicate risk is ${output.qualitySignals.duplicateRisk}.`);
  if (output.qualitySignals.lowQualityRisk >= config.lowQualityReviewRisk) reviewReasons.push(`Low-quality risk is ${output.qualitySignals.lowQualityRisk}.`);

  const unsafeReject = output.qualitySignals.unsafeRisk >= config.unsafeRejectRisk;
  if (!reviewReasons.length && !unsafeReject) return output;

  const recommendation = unsafeReject ? 'reject' : 'needs_manual_review';
  const reasons = [...reviewReasons, ...output.reasons];
  return {
    ...output,
    recommendation,
    reasons,
    moderation: {
      ...output.moderation,
      // Never publish automatically — the stored status is always review-gated.
      status: 'needs_review',
      recommendation,
      reasons,
      aiRecommendation: recommendation
    }
  };
}

export async function moderateWithSafety(provider: AiModerationProvider, input: AiModerationInput, config = getAiSafetyConfig()): Promise<AiModerationOutput> {
  const existingSubmissions = input.existingSubmissions.map(s => ({ question: s.question }));
  const budget = checkAndConsumeAiBudget(input, config);
  if (!budget.allowed) {
    return createManualReviewFallback({ draft: input.draft, existingQuestions: input.existingQuestions, existingSubmissions, reason: budget.reason || 'AI budget limit exceeded.', provider: provider.name });
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
  return createManualReviewFallback({ draft: input.draft, existingQuestions: input.existingQuestions, existingSubmissions, reason: message, provider: provider.name });
}
