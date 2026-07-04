import type { ModerationResult } from '@/lib/community';
import { readEnv } from '@/lib/infrastructure/environment';
import type { AiModerationInput, AiModerationOutput, AiModerationProvider } from '../types';
import { clampScore, trimExplanation, validateAiModerationOutput } from '../validation';

type OpenAiModerationJson = {
  recommendation: 'approve' | 'reject' | 'needs_manual_review';
  confidence: number;
  improvedQuestion: string;
  improvedOptions: string[];
  correctIndex: number;
  explanation: string;
  reasons: string[];
  factCheck: {
    status: 'passed' | 'uncertain' | 'failed';
    notes: string[];
  };
  qualitySignals: {
    duplicateRisk: number;
    spamRisk: number;
    unsafeRisk: number;
    lowQualityRisk: number;
  };
};

function parseOutputText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.map(item => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') return item.text;
    return '';
  }).join('');
}

function createModeration(input: AiModerationInput, parsed: OpenAiModerationJson): ModerationResult {
  const recommendation = parsed.recommendation;
  const status = recommendation === 'approve' ? 'auto_approved' : recommendation === 'reject' ? 'rejected' : 'needs_review';
  return {
    status,
    score: clampScore(parsed.confidence),
    recommendation,
    reasons: parsed.reasons,
    normalizedQuestion: parsed.improvedQuestion,
    normalizedOptions: parsed.improvedOptions,
    explanation: trimExplanation(parsed.explanation),
    duplicateQuestionId: input.existingQuestions.find(question => question.question === parsed.improvedQuestion)?.id,
    aiProvider: 'openai',
    aiRecommendation: recommendation,
    aiConfidence: clampScore(parsed.confidence),
    improvedQuestion: parsed.improvedQuestion,
    improvedOptions: parsed.improvedOptions,
    factCheck: parsed.factCheck,
    qualitySignals: parsed.qualitySignals
  };
}

export function createOpenAiModerationProvider(): AiModerationProvider {
  return {
    name: 'openai',
    async moderate(input): Promise<AiModerationOutput> {
      const apiKey = readEnv('OPENAI_API_KEY');
      if (!apiKey) throw new Error('OPENAI_API_KEY is missing. Use the mock-local provider until production credentials are configured.');

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: readEnv('OPENAI_MODERATION_MODEL') || 'gpt-4.1-mini',
          input: [
            {
              role: 'system',
              content: 'You are a strict production moderation and question-improvement service for a multilingual trivia platform. Return only valid JSON.'
            },
            {
              role: 'user',
              content: JSON.stringify({
                task: 'Moderate, fact-check, improve and classify this community trivia submission.',
                requiredOutput: {
                  recommendation: 'approve | reject | needs_manual_review',
                  confidence: '0-100',
                  improvedQuestion: 'clear question text',
                  improvedOptions: 'exactly four answer options',
                  correctIndex: '0-3',
                  explanation: 'up to 80 words',
                  reasons: 'short array',
                  factCheck: { status: 'passed | uncertain | failed', notes: 'array' },
                  qualitySignals: { duplicateRisk: '0-100', spamRisk: '0-100', unsafeRisk: '0-100', lowQualityRisk: '0-100' }
                },
                submission: input.draft,
                existingQuestions: input.existingQuestions.slice(0, 80).map(question => ({ id: question.id, question: question.question, correctAnswer: question.correctAnswer || question.options[question.correctIndex] })),
                existingSubmissions: input.existingSubmissions.slice(0, 80)
              })
            }
          ],
          text: {
            format: {
              type: 'json_object'
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI moderation request failed: ${response.status} ${await response.text()}`);
      }

      const json = await response.json() as { output_text?: string; output?: unknown };
      const outputText = json.output_text || parseOutputText(json.output);
      const parsed = JSON.parse(outputText) as OpenAiModerationJson;
      const moderation = createModeration(input, {
        ...parsed,
        confidence: clampScore(parsed.confidence),
        explanation: trimExplanation(parsed.explanation),
        qualitySignals: {
          duplicateRisk: clampScore(parsed.qualitySignals.duplicateRisk),
          spamRisk: clampScore(parsed.qualitySignals.spamRisk),
          unsafeRisk: clampScore(parsed.qualitySignals.unsafeRisk),
          lowQualityRisk: clampScore(parsed.qualitySignals.lowQualityRisk)
        }
      });
      const output: AiModerationOutput = {
        provider: 'openai',
        recommendation: moderation.aiRecommendation || 'needs_manual_review',
        confidence: moderation.aiConfidence || 0,
        improvedQuestion: moderation.improvedQuestion || input.draft.question,
        improvedOptions: moderation.improvedOptions || input.draft.options,
        correctIndex: parsed.correctIndex,
        explanation: moderation.explanation,
        reasons: moderation.reasons,
        factCheck: moderation.factCheck || { status: 'uncertain', notes: [] },
        qualitySignals: moderation.qualitySignals || { duplicateRisk: 0, spamRisk: 0, unsafeRisk: 0, lowQualityRisk: 0 },
        moderation
      };
      const validation = validateAiModerationOutput(output);
      if (!validation.ok) throw new Error(`OpenAI moderation output failed validation: ${validation.errors.join(' ')}`);
      return output;
    }
  };
}
