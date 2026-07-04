import type { CommunityDraft, ModerationResult } from '@/lib/community';
import type { Question } from '@/lib/types';

export type AiModerationRecommendation = 'approve' | 'reject' | 'needs_manual_review';
export type AiFactCheckStatus = 'passed' | 'uncertain' | 'failed';

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
  improvedOptions: string[];
  correctIndex: number;
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
  moderate(input: AiModerationInput): Promise<AiModerationOutput>;
};
