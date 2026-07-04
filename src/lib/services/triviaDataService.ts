import type { PageDataDto } from '@/lib/domain/dtos';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';

export class TriviaDataService {
  constructor(private readonly repositories: RepositoryProvider) {}

  async getPageData(): Promise<PageDataDto> {
    return {
      questions: await this.repositories.approvedQuestions.listGameplayQuestions({ activeOnly: true })
    };
  }
}

export function createTriviaDataService(repositories = getRepositoryProvider()) {
  return new TriviaDataService(repositories);
}
