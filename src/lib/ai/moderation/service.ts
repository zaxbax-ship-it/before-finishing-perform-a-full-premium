import type { CommunityDraft, CommunitySubmission } from '@/lib/community';
import type { Question } from '@/lib/types';
import type { AiModerationOutput, AiModerationProvider } from './types';
import { createAiModerationProvider } from './providerFactory';
import { validateAiModerationDraft, validateAiModerationOutput } from './validation';

export type AiModerationServiceInput = {
  draft: CommunityDraft;
  existingQuestions: Question[];
  existingSubmissions: CommunitySubmission[];
};

export class AiModerationService {
  constructor(private readonly provider: AiModerationProvider = createAiModerationProvider()) {}

  async moderate(input: AiModerationServiceInput): Promise<AiModerationOutput> {
    const draftValidation = validateAiModerationDraft(input.draft);
    if (!draftValidation.ok) {
      throw new Error(`Community submission failed validation: ${draftValidation.errors.join(' ')}`);
    }

    const output = await this.provider.moderate({
      draft: input.draft,
      existingQuestions: input.existingQuestions,
      existingSubmissions: input.existingSubmissions.map(submission => ({
        id: submission.id,
        question: submission.moderation.normalizedQuestion || submission.draft.question
      }))
    });
    const outputValidation = validateAiModerationOutput(output);
    if (!outputValidation.ok) {
      throw new Error(`AI moderation output failed validation: ${outputValidation.errors.join(' ')}`);
    }
    return output;
  }
}

export function createAiModerationService(provider = createAiModerationProvider()) {
  return new AiModerationService(provider);
}
