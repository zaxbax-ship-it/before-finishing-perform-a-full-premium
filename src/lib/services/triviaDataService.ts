import 'server-only';
import type { PageDataDto } from '@/lib/domain/dtos';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { listGameplayQuestionsWithBundledFallback } from './gameplayQuestionSource';
import { balancedQuestionSample, INITIAL_QUESTION_SAMPLE_SIZE } from './questionSampling';

export class TriviaDataService {
  constructor(private readonly repositories: RepositoryProvider) {}

  async getPageData(options: { allowBundledFallback?: boolean; sampleSize?: number } = {}): Promise<PageDataDto> {
    const questions = options.allowBundledFallback
      ? await listGameplayQuestionsWithBundledFallback(this.repositories, { activeOnly: true }, 'page_data')
      : await this.repositories.approvedQuestions.listGameplayQuestions({ activeOnly: true });
    return {
      questions: balancedQuestionSample(questions, options.sampleSize || INITIAL_QUESTION_SAMPLE_SIZE),
      totalAvailableQuestions: questions.length
    };
  }
}

export function createTriviaDataService(repositories = getRepositoryProvider()) {
  return new TriviaDataService(repositories);
}
