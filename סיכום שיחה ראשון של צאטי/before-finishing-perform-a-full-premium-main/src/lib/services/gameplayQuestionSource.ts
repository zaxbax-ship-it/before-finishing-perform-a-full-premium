import { createLogger } from '@/lib/infrastructure/logger';
import type { QuestionFilters, RepositoryProvider } from '@/lib/repositories/interfaces';
import { createLocalJsonRepositoryProvider } from '@/lib/repositories/providers/localJsonProvider';
import type { Question } from '@/lib/types';

const logger = createLogger('gameplay-question-source');
let fallbackProvider: RepositoryProvider | undefined;

export async function listGameplayQuestionsWithBundledFallback(
  repositories: RepositoryProvider,
  filters: QuestionFilters = {},
  context = 'public_gameplay'
): Promise<Question[]> {
  try {
    const questions = await repositories.approvedQuestions.listGameplayQuestions(filters);
    if (questions.length > 0 || repositories.kind === 'local-json') return questions;
  } catch (error) {
    if (repositories.kind === 'local-json') throw error;
    logger.warn('Active gameplay question source failed; falling back to bundled questions for public gameplay.', {
      context,
      provider: repositories.kind,
      code: 'GAMEPLAY_QUESTIONS_SOURCE_FAILED'
    });
  }

  fallbackProvider = fallbackProvider || createLocalJsonRepositoryProvider();
  const fallbackQuestions = await fallbackProvider.approvedQuestions.listGameplayQuestions(filters);

  if (fallbackQuestions.length > 0) {
    logger.warn('Using bundled gameplay question fallback because the active database returned no questions.', {
      context,
      provider: repositories.kind,
      category: filters.category ? 'filtered' : 'all',
      count: fallbackQuestions.length
    });
  }

  return fallbackQuestions;
}
