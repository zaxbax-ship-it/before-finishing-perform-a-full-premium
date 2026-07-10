import 'server-only';
import { createLogger } from '@/lib/infrastructure/logger';
import type { QuestionFilters, RepositoryProvider } from '@/lib/repositories/interfaces';
import { createLocalJsonRepositoryProvider } from '@/lib/repositories/providers/localJsonProvider';
import type { Question } from '@/lib/types';
import { isPlayableQuestion } from './questionValidation';

const logger = createLogger('gameplay-question-source');
let fallbackProvider: RepositoryProvider | undefined;

function getBundledProvider(): RepositoryProvider {
  fallbackProvider = fallbackProvider || createLocalJsonRepositoryProvider();
  return fallbackProvider;
}

/**
 * Public gameplay question source.
 *
 * REGRESSION FIX: the bundled question bank (`src/data/questions.json`, the full
 * category catalogue) is the canonical base content. Community-approved questions
 * stored in the database AUGMENT it. Previously this returned the database rows
 * verbatim whenever it had ≥1 row and only fell back to the bundle when the table
 * was empty — so a single approved community question suppressed the entire
 * 21k-question catalogue and the category screen collapsed to that one category.
 *
 * We now MERGE (deduped by id) so the full catalogue is always available in
 * database mode regardless of how few rows the table holds, while still surfacing
 * community additions. Only fully playable questions are returned. Local mode is
 * unchanged: the local provider already IS the bundled bank.
 */
export async function listGameplayQuestionsWithBundledFallback(
  repositories: RepositoryProvider,
  filters: QuestionFilters = {},
  context = 'public_gameplay'
): Promise<Question[]> {
  if (repositories.kind === 'local-json') {
    const questions = await repositories.approvedQuestions.listGameplayQuestions(filters);
    return questions.filter(isPlayableQuestion);
  }

  // Database mode: merge community/database questions with the bundled base bank.
  let databaseQuestions: Question[] = [];
  try {
    databaseQuestions = await repositories.approvedQuestions.listGameplayQuestions(filters);
  } catch (error) {
    logger.warn('Active gameplay question source failed; serving the bundled catalogue.', {
      context,
      provider: repositories.kind,
      code: 'GAMEPLAY_QUESTIONS_SOURCE_FAILED'
    });
  }

  const bundledQuestions = await getBundledProvider().approvedQuestions.listGameplayQuestions(filters);

  if (databaseQuestions.length === 0 && bundledQuestions.length > 0) {
    logger.warn('Database returned no questions; serving the bundled gameplay catalogue.', {
      context,
      provider: repositories.kind,
      category: filters.category ? 'filtered' : 'all',
      count: bundledQuestions.length
    });
  } else if (databaseQuestions.length > 0 && bundledQuestions.length > 0) {
    logger.info('Merging database questions with the bundled catalogue to preserve the full category set.', {
      context,
      provider: repositories.kind,
      databaseCount: databaseQuestions.length,
      bundledCount: bundledQuestions.length
    });
  }

  // Community/database questions first (fresher), then the bundled bank; dedupe by id.
  const seen = new Set<string>();
  const merged: Question[] = [];
  for (const question of [...databaseQuestions, ...bundledQuestions]) {
    if (!isPlayableQuestion(question)) continue;
    const id = String(question.id);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(question);
  }

  // Respect an explicit limit (page data passes none and samples afterwards).
  return typeof filters.limit === 'number' && filters.limit > 0 ? merged.slice(0, filters.limit) : merged;
}
