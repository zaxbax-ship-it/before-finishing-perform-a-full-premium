import type { CommunityDraft } from '@/lib/community';
import type { AiModerationOutput } from './types';

export type AiValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validateAiModerationDraft(draft: CommunityDraft): AiValidationResult {
  const errors: string[] = [];
  if (!draft.question.trim()) errors.push('Question text is required.');
  if (!Array.isArray(draft.options) || draft.options.length !== 4) errors.push('Exactly four answer options are required.');
  if (draft.options.some(option => !option.trim())) errors.push('Every answer option must include text.');
  if (draft.correctIndex < 0 || draft.correctIndex > 3) errors.push('Correct answer index must be between 0 and 3.');
  if (!draft.category.trim()) errors.push('Category is required.');
  if (!draft.difficulty.trim()) errors.push('Difficulty is required.');
  return { ok: errors.length === 0, errors };
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

export function trimExplanation(value: string, maxWords = 80) {
  return value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, maxWords).join(' ');
}

export function validateAiModerationOutput(output: AiModerationOutput): AiValidationResult {
  const errors: string[] = [];
  if (!['approve', 'reject', 'needs_manual_review'].includes(output.recommendation)) errors.push('Invalid AI recommendation.');
  if (output.confidence < 0 || output.confidence > 100) errors.push('Confidence must be 0-100.');
  if (!output.improvedQuestion.trim()) errors.push('Improved question is required.');
  if (output.improvedOptions.length !== 4 || output.improvedOptions.some(option => !option.trim())) errors.push('Improved options must include four non-empty values.');
  if (output.correctIndex < 0 || output.correctIndex > 3) errors.push('Correct index must be 0-3.');
  if (!output.explanation.trim()) errors.push('Explanation is required.');
  return { ok: errors.length === 0, errors };
}
