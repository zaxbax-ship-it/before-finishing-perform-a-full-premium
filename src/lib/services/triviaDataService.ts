import type { PageDataDto } from '@/lib/domain/dtos';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { listGameplayQuestionsWithBundledFallback } from './gameplayQuestionSource';

export class TriviaDataService {
  constructor(private readonly repositories: RepositoryProvider) {}

  async getPageData(options: { allowBundledFallback?: boolean } = {}): Promise<PageDataDto> {
    const questions = options.allowBundledFallback
      ? await listGameplayQuestionsWithBundledFallback(this.repositories, { activeOnly: true }, 'page_data')
      : await this.repositories.approvedQuestions.listGameplayQuestions({ activeOnly: true });
    return {
      questions: balancedQuestionSample(questions, 1200)
    };
  }
}

export function createTriviaDataService(repositories = getRepositoryProvider()) {
  return new TriviaDataService(repositories);
}

function balancedQuestionSample<T extends { category: string }>(questions: T[], maxQuestions: number) {
  if (questions.length <= maxQuestions) return questions;
  const groups = new Map<string, T[]>();
  for (const question of questions) {
    groups.set(question.category, [...(groups.get(question.category) || []), question]);
  }
  const perCategory = Math.max(1, Math.ceil(maxQuestions / Math.max(groups.size, 1)));
  return Array.from(groups.values()).flatMap(group => group.slice(0, perCategory)).slice(0, maxQuestions);
}
