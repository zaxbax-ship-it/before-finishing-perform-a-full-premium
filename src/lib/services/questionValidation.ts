import type { Question } from '@/lib/types';

/**
 * Strict gameplay validation boundary (regression fix). A question may only
 * reach the game screen if it is fully playable: non-empty text, EXACTLY four
 * non-empty answers, exactly one valid correct-answer index pointing at a
 * non-empty answer, and valid category metadata. Platform-neutral (no React, no
 * DOM) so the same rule guards the server question source and the client
 * game-start path — and ports directly to SwiftUI / Jetpack Compose.
 */
export type PlayableCandidate =
  | (Partial<Pick<Question, 'question' | 'options' | 'correctIndex' | 'category'>> & { answers?: unknown })
  | null
  | undefined;

export function isPlayableQuestion(candidate: PlayableCandidate): boolean {
  if (!candidate || typeof candidate !== 'object') return false;

  const text = typeof candidate.question === 'string' ? candidate.question.trim() : '';
  if (text.length === 0) return false;

  const rawAnswers = Array.isArray(candidate.options)
    ? candidate.options
    : Array.isArray((candidate as { answers?: unknown }).answers)
      ? ((candidate as { answers?: unknown[] }).answers as unknown[])
      : [];
  const answers = rawAnswers.map(answer => (typeof answer === 'string' ? answer.trim() : ''));
  if (answers.length !== 4 || answers.some(answer => answer.length === 0)) return false;

  const correctIndex = candidate.correctIndex;
  if (!Number.isInteger(correctIndex) || (correctIndex as number) < 0 || (correctIndex as number) > 3) return false;
  if (answers[correctIndex as number].length === 0) return false;

  const category = typeof candidate.category === 'string' ? candidate.category.trim() : '';
  if (category.length === 0) return false;

  return true;
}

/** Keep only playable questions (used at the server source and before gameplay). */
export function filterPlayableQuestions<T extends PlayableCandidate>(questions: T[]): T[] {
  return questions.filter(question => isPlayableQuestion(question));
}
