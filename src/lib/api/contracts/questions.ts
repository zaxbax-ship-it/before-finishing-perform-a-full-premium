import type { Question } from '@/lib/types';
import { isRecord } from './common';

/**
 * Public question shape returned to gameplay clients. Structurally identical to
 * the domain `Question` (including per-locale `translations`), re-exported here so
 * mobile clients depend on the contract module rather than internal domain paths.
 */
export type QuestionDto = Question;

/** Response of `GET /api/questions`. */
export type QuestionsResponse = {
  ok: true;
  questions: QuestionDto[];
  totalAvailable: number;
  sampled: boolean;
  excludedApplied: number;
};

/** Runtime guard for a single question (shallow, gameplay-critical fields). */
export function isQuestionDto(value: unknown): value is QuestionDto {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' && typeof value.id !== 'number') return false;
  if (typeof value.question !== 'string' || typeof value.category !== 'string') return false;
  if (!Array.isArray(value.options) || value.options.length < 2) return false;
  return typeof value.correctIndex === 'number';
}

/** Runtime guard for the questions response (used by smoke tests). */
export function isQuestionsResponse(value: unknown): value is QuestionsResponse {
  if (!isRecord(value) || value.ok !== true) return false;
  if (!Array.isArray(value.questions) || !value.questions.every(isQuestionDto)) return false;
  if (typeof value.totalAvailable !== 'number') return false;
  if (typeof value.sampled !== 'boolean') return false;
  return typeof value.excludedApplied === 'number';
}
