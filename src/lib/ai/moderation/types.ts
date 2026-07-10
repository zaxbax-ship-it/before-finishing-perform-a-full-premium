import type { CommunityDraft, ModerationResult } from '@/lib/community';
import type { Question } from '@/lib/types';

export type AiModerationRecommendation = 'approve' | 'reject' | 'needs_manual_review';
export type AiFactCheckStatus = 'passed' | 'uncertain' | 'failed';

/**
 * The input to the editorial pipeline. `draft` is a SEED built from the
 * contributor's low-friction submission (question + correct answer only); the
 * pipeline is responsible for generating the three incorrect answers, the
 * category and the difficulty. The seed carries the correct answer at
 * `options[correctIndex]` with the remaining option slots blank.
 */
export type AiModerationInput = {
  draft: CommunityDraft;
  existingQuestions: Question[];
  existingSubmissions: Array<{ id: string; question: string }>;
};

export type AiModerationOutput = {
  provider: 'mock-local' | 'openai';
  recommendation: AiModerationRecommendation;
  confidence: number;
  improvedQuestion: string;
  /** The improved correct answer text. */
  correctAnswer: string;
  /** Exactly three AI-generated incorrect answers (before shuffling). */
  generatedWrongAnswers: string[];
  /** The four shuffled options (correct answer + the three distractors). */
  improvedOptions: string[];
  correctIndex: number;
  /** AI-determined category (canonical, matching the question bank). */
  category: string;
  /** AI-estimated difficulty label. */
  difficulty: string;
  explanation: string;
  reasons: string[];
  factCheck: {
    status: AiFactCheckStatus;
    notes: string[];
  };
  qualitySignals: {
    duplicateRisk: number;
    spamRisk: number;
    unsafeRisk: number;
    lowQualityRisk: number;
  };
  moderation: ModerationResult;
};

export type AiModerationProvider = {
  readonly name: AiModerationOutput['provider'];
  moderate(input: AiModerationInput, options?: { signal?: AbortSignal }): Promise<AiModerationOutput>;
};
