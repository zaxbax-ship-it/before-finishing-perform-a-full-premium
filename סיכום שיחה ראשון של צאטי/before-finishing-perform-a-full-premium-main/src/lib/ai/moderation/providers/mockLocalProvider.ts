import { generateExplanation, runLocalModeration } from '@/lib/community';
import type { AiModerationInput, AiModerationOutput, AiModerationProvider } from '../types';
import { clampScore, trimExplanation } from '../validation';

const unsafeTerms = ['נאצי', 'קללה', 'טיפש', 'fuck', 'shit', 'nazi', 'قتل', 'убить'];

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalize(value: string) {
  return clean(value).toLowerCase().replace(/[?!.,;:"'׳״]/g, '');
}

function improveQuestion(value: string) {
  const cleaned = clean(value);
  if (!cleaned) return cleaned;
  return /[?؟]$/.test(cleaned) ? cleaned : `${cleaned}?`;
}

function improveOptions(options: string[]) {
  return options.map(option => clean(option)).map(option => option.replace(/\.$/, ''));
}

function duplicateRisk(input: AiModerationInput) {
  const question = normalize(input.draft.question);
  if (!question) return 0;
  const duplicate = input.existingQuestions.some(item => normalize(item.question) === question)
    || input.existingSubmissions.some(item => normalize(item.question) === question);
  if (duplicate) return 95;
  const near = input.existingQuestions.some(item => {
    const current = normalize(item.question);
    return current.includes(question) || question.includes(current);
  });
  return near ? 70 : 8;
}

function unsafeRisk(input: AiModerationInput) {
  const text = `${input.draft.question} ${input.draft.options.join(' ')}`.toLowerCase();
  return unsafeTerms.some(term => text.includes(term)) ? 92 : 4;
}

function lowQualityRisk(input: AiModerationInput) {
  let risk = 0;
  const question = clean(input.draft.question);
  const options = improveOptions(input.draft.options);
  if (question.length < 12) risk += 28;
  if (!/[?؟]$/.test(question)) risk += 12;
  if (new Set(options.map(normalize)).size !== 4) risk += 35;
  if (options.some(option => option.length < 2)) risk += 24;
  if (!clean(input.draft.explanation)) risk += 6;
  return clampScore(risk);
}

export function createMockLocalAiModerationProvider(): AiModerationProvider {
  return {
    name: 'mock-local',
    async moderate(input): Promise<AiModerationOutput> {
      const improvedQuestion = improveQuestion(input.draft.question);
      const improvedOptions = improveOptions(input.draft.options);
      const duplicate = duplicateRisk(input);
      const unsafe = unsafeRisk(input);
      const lowQuality = lowQualityRisk(input);
      const spam = clampScore(Math.max(unsafe, lowQuality > 75 ? 64 : 8));
      const explanation = trimExplanation(clean(input.draft.explanation) || generateExplanation({ ...input.draft, question: improvedQuestion, options: improvedOptions }));
      const localModeration = runLocalModeration({ ...input.draft, question: improvedQuestion, options: improvedOptions, explanation }, input.existingQuestions, []);
      const score = clampScore(localModeration.score - Math.round(duplicate * 0.22) - Math.round(unsafe * 0.28) - Math.round(lowQuality * 0.16));
      const recommendation = unsafe >= 85 || lowQuality >= 82
        ? 'reject'
        : duplicate >= 70 || score < 78
          ? 'needs_manual_review'
          : 'approve';
      const status = recommendation === 'approve' ? 'auto_approved' : recommendation === 'reject' ? 'rejected' : 'needs_review';
      const reasons = [
        ...localModeration.reasons,
        duplicate >= 70 ? 'Potential duplicate or very similar question detected.' : '',
        unsafe >= 70 ? 'Potential unsafe, abusive or spam-like wording detected.' : '',
        lowQuality >= 60 ? 'Question quality needs human review before publishing.' : '',
        'Mock AI provider used. Replace with OpenAI after API credentials are configured.'
      ].filter(Boolean);

      return {
        provider: 'mock-local',
        recommendation,
        confidence: score,
        improvedQuestion,
        improvedOptions,
        correctIndex: input.draft.correctIndex,
        explanation,
        reasons,
        factCheck: {
          status: recommendation === 'approve' ? 'passed' : 'uncertain',
          notes: recommendation === 'approve'
            ? ['Local checks found no obvious factual contradiction.']
            : ['A real OpenAI fact-check should verify this before final approval.']
        },
        qualitySignals: {
          duplicateRisk: duplicate,
          spamRisk: spam,
          unsafeRisk: unsafe,
          lowQualityRisk: lowQuality
        },
        moderation: {
          ...localModeration,
          status,
          score,
          recommendation,
          reasons,
          normalizedQuestion: improvedQuestion,
          normalizedOptions: improvedOptions,
          explanation,
          aiProvider: 'mock-local',
          aiRecommendation: recommendation,
          aiConfidence: score,
          improvedQuestion,
          improvedOptions,
          factCheck: {
            status: recommendation === 'approve' ? 'passed' : 'uncertain',
            notes: recommendation === 'approve'
              ? ['Local checks found no obvious factual contradiction.']
              : ['A real OpenAI fact-check should verify this before final approval.']
          },
          qualitySignals: {
            duplicateRisk: duplicate,
            spamRisk: spam,
            unsafeRisk: unsafe,
            lowQualityRisk: lowQuality
          }
        }
      };
    }
  };
}
