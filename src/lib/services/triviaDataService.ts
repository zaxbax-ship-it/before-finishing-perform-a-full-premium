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
    const sample = balancedQuestionSample(questions, options.sampleSize || INITIAL_QUESTION_SAMPLE_SIZE);
    // Non-Hebrew locales only ever play questions that carry a translation, and
    // those are rare relative to the full bank. A random seed surfaces only a
    // handful, so those locales would repeat the same few questions. Guarantee
    // every localized question ships in the initial pool (a small set) so the
    // client holds the complete playable set for each non-Hebrew locale. Hebrew
    // is unaffected: it plays the whole bank and tops up via /api/questions.
    const sampleIds = new Set(sample.map(question => String(question.id)));
    const localizedQuestions = questions.filter(
      question =>
        !sampleIds.has(String(question.id)) &&
        question.translations !== undefined &&
        Object.values(question.translations).some(Boolean)
    );
    return {
      questions: [...sample, ...localizedQuestions],
      totalAvailableQuestions: questions.length
    };
  }
}

export function createTriviaDataService(repositories = getRepositoryProvider()) {
  return new TriviaDataService(repositories);
}
