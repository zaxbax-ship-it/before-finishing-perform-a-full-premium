import type { CommunityDraft } from '@/lib/community';
import type { Question } from '@/lib/types';

export type ValidationResult = {
  ok: boolean;
  errors: string[];
};

export function valid(errors: string[] = []): ValidationResult {
  return { ok: errors.length === 0, errors };
}

export function validateQuestion(question: Question): ValidationResult {
  const errors: string[] = [];

  if (!String(question.id ?? '').trim()) errors.push('Question id is required.');
  if (!question.category?.trim()) errors.push('Question category is required.');
  if (!question.difficulty?.trim()) errors.push('Question difficulty is required.');
  if (!question.question?.trim()) errors.push('Question text is required.');
  if (!Array.isArray(question.options) || question.options.length !== 4) errors.push('Exactly four options are required.');
  if (question.correctIndex < 0 || question.correctIndex > 3) errors.push('Correct index must be between 0 and 3.');

  return valid(errors);
}

export function validateCommunityDraft(draft: CommunityDraft): ValidationResult {
  const errors: string[] = [];

  if (!draft.question.trim()) errors.push('Submission question is required.');
  if (!Array.isArray(draft.options) || draft.options.length !== 4) errors.push('Submission must include four options.');
  if (draft.options.some(option => !option.trim())) errors.push('All submission options are required.');
  if (draft.correctIndex < 0 || draft.correctIndex > 3) errors.push('Submission correct index must be between 0 and 3.');
  if (!draft.category.trim()) errors.push('Submission category is required.');
  if (!draft.difficulty.trim()) errors.push('Submission difficulty is required.');

  return valid(errors);
}
