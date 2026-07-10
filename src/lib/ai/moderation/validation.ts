import type { CommunityDraft } from '@/lib/community';
import { normalizeComparable } from './editorial';
import type { AiModerationOutput } from './types';

export type AiValidationResult = {
  ok: boolean;
  errors: string[];
};

/**
 * Validates the SEED draft coming from the low-friction submission. The
 * contributor only provides a question and a correct answer, so we require just
 * those — the pipeline generates the other three options, the category and the
 * difficulty. (`options[correctIndex]` holds the correct answer.)
 */
export function validateAiModerationDraft(draft: CommunityDraft): AiValidationResult {
  const errors: string[] = [];
  if (!draft.question.trim()) errors.push('Question text is required.');
  if (draft.correctIndex < 0 || draft.correctIndex > 3) errors.push('Correct answer index must be between 0 and 3.');
  if (!draft.options?.[draft.correctIndex]?.trim()) errors.push('A correct answer is required.');
  return { ok: errors.length === 0, errors };
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

export function trimExplanation(value: string, maxWords = 80) {
  return value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, maxWords).join(' ');
}

/**
 * Validates the completed, game-ready output: four non-empty distinct options,
 * exactly three generated wrong answers, a valid correct index, a category, a
 * difficulty and an explanation. The status is never auto-approved.
 */
export function validateAiModerationOutput(output: AiModerationOutput): AiValidationResult {
  const errors: string[] = [];
  if (!['approve', 'reject', 'needs_manual_review'].includes(output.recommendation)) errors.push('Invalid AI recommendation.');
  if (output.confidence < 0 || output.confidence > 100) errors.push('Confidence must be 0-100.');
  if (!output.improvedQuestion.trim()) errors.push('Improved question is required.');
  if (output.improvedOptions.length !== 4 || output.improvedOptions.some(option => !option.trim())) errors.push('Improved options must include four non-empty values.');
  if (new Set(output.improvedOptions.map(normalizeComparable)).size !== 4) errors.push('The four options must be distinct.');
  if (!Array.isArray(output.generatedWrongAnswers) || output.generatedWrongAnswers.length !== 3) errors.push('Exactly three incorrect answers are required.');
  if (output.correctIndex < 0 || output.correctIndex > 3) errors.push('Correct index must be 0-3.');
  if (output.improvedOptions[output.correctIndex]?.trim() !== output.correctAnswer.trim()) errors.push('Correct index must point at the correct answer.');
  if (!output.category.trim()) errors.push('Category is required.');
  if (!output.difficulty.trim()) errors.push('Difficulty is required.');
  if (!output.explanation.trim()) errors.push('Explanation is required.');
  if (output.moderation.status === 'auto_approved') errors.push('AI must never auto-approve a submission.');
  return { ok: errors.length === 0, errors };
}
