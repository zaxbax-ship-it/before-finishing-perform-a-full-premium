import { readEnv } from '@/lib/infrastructure/environment';
import type { AiModerationInput, AiModerationOutput, AiModerationProvider } from '../types';
import { clampScore, trimExplanation, validateAiModerationOutput } from '../validation';
import {
  cleanText,
  duplicateRiskFor,
  generateWrongAnswers,
  improveAnswerWording,
  improveQuestionWording,
  inferCategory,
  inferDifficulty,
  normalizeComparable,
  shuffleOptions
} from '../editorial';

const DIFFICULTY_LABELS = { easy: 'קל', medium: 'בינוני', hard: 'קשה', expert: 'מומחה' };
const DEFAULT_CATEGORY = 'ידע כללי';

type OpenAiEditorialJson = {
  recommendation: 'approve' | 'reject' | 'needs_manual_review';
  confidence: number;
  improvedQuestion: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  category: string;
  difficulty: string;
  explanation: string;
  reasons: string[];
  factCheck: { status: 'passed' | 'uncertain' | 'failed'; notes: string[] };
  qualitySignals: { duplicateRisk: number; spamRisk: number; unsafeRisk: number; lowQualityRisk: number };
};

function parseOutputText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.map(item => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object' && 'text' in item && typeof (item as { text: unknown }).text === 'string') return (item as { text: string }).text;
    return '';
  }).join('');
}

/**
 * Production editorial provider. Sends only the contributor's question + correct
 * answer and asks the model to fact-check, improve wording, classify, and
 * generate exactly three high-quality incorrect answers. The result is prepared
 * for a human editor — status is always `needs_review`; the AI never publishes.
 */
export function createOpenAiModerationProvider(): AiModerationProvider {
  return {
    name: 'openai',
    async moderate(input, options): Promise<AiModerationOutput> {
      const apiKey = readEnv('OPENAI_API_KEY');
      if (!apiKey) throw new Error('OPENAI_API_KEY is missing. Use the mock-local provider until production credentials are configured.');

      const rawQuestion = input.draft.question;
      const rawCorrect = input.draft.options[input.draft.correctIndex] || '';
      const language = input.draft.language;
      const seed = normalizeComparable(rawQuestion) + '|' + normalizeComparable(rawCorrect);

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: options?.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: readEnv('OPENAI_MODERATION_MODEL') || 'gpt-4.1-mini',
          input: [
            {
              role: 'system',
              content: 'You are a strict editorial service for a multilingual trivia platform. You verify facts, improve wording, classify, and write high-quality distractors. You never approve for publishing — a human always reviews. Return only valid JSON.'
            },
            {
              role: 'user',
              content: JSON.stringify({
                task: 'Fact-check, improve and complete this trivia submission into a game-ready question.',
                language,
                instructions: [
                  'Verify the correct answer is factually correct.',
                  'Improve the wording of the question and the correct answer.',
                  'Normalize spelling and grammar in the submission language.',
                  'Generate exactly three plausible but clearly incorrect answers in the same language and style.',
                  'Determine the best category and an estimated difficulty.',
                  'Estimate duplicate risk against the existing questions.'
                ],
                requiredOutput: {
                  recommendation: 'approve | reject | needs_manual_review',
                  confidence: '0-100',
                  improvedQuestion: 'clear question text',
                  correctAnswer: 'improved correct answer',
                  incorrectAnswers: 'exactly three incorrect answers',
                  category: 'category name',
                  difficulty: 'easy | medium | hard | expert (localized ok)',
                  explanation: 'up to 80 words',
                  reasons: 'short array',
                  factCheck: { status: 'passed | uncertain | failed', notes: 'array' },
                  qualitySignals: { duplicateRisk: '0-100', spamRisk: '0-100', unsafeRisk: '0-100', lowQualityRisk: '0-100' }
                },
                submission: { question: rawQuestion, correctAnswer: rawCorrect },
                existingQuestions: input.existingQuestions.slice(0, 80).map(q => ({ id: q.id, question: q.question, category: q.category, correctAnswer: q.correctAnswer || q.options[q.correctIndex] })),
                existingSubmissions: input.existingSubmissions.slice(0, 80)
              })
            }
          ],
          text: { format: { type: 'json_object' } }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI moderation request failed: ${response.status} ${await response.text()}`);
      }

      const json = await response.json() as { output_text?: string; output?: unknown };
      const parsed = JSON.parse(json.output_text || parseOutputText(json.output)) as OpenAiEditorialJson;

      const improvedQuestion = improveQuestionWording(parsed.improvedQuestion || rawQuestion);
      const correctAnswer = improveAnswerWording(parsed.correctAnswer || rawCorrect);
      const category = cleanText(parsed.category) || inferCategory(rawQuestion, rawCorrect, input.existingQuestions, DEFAULT_CATEGORY);
      const difficulty = cleanText(parsed.difficulty) || inferDifficulty(rawQuestion, rawCorrect, DIFFICULTY_LABELS);

      let wrong = Array.isArray(parsed.incorrectAnswers) ? parsed.incorrectAnswers.map(improveAnswerWording).filter(Boolean) : [];
      const seen = new Set<string>([normalizeComparable(correctAnswer)]);
      wrong = wrong.filter(w => { const key = normalizeComparable(w); if (seen.has(key)) return false; seen.add(key); return true; });
      if (wrong.length < 3) {
        for (const filler of generateWrongAnswers(correctAnswer, input.existingQuestions, category, seed)) {
          const key = normalizeComparable(filler);
          if (!seen.has(key)) { seen.add(key); wrong.push(filler); }
          if (wrong.length >= 3) break;
        }
      }
      wrong = wrong.slice(0, 3);
      const { options: improvedOptions, correctIndex } = shuffleOptions(correctAnswer, wrong, seed);
      const explanation = trimExplanation(parsed.explanation || `${correctAnswer}.`);
      const dup = duplicateRiskFor(improvedQuestion, input.existingQuestions, input.existingSubmissions.map(s => ({ question: s.question })));
      const qualitySignals = {
        duplicateRisk: clampScore(parsed.qualitySignals?.duplicateRisk ?? dup.risk),
        spamRisk: clampScore(parsed.qualitySignals?.spamRisk ?? 0),
        unsafeRisk: clampScore(parsed.qualitySignals?.unsafeRisk ?? 0),
        lowQualityRisk: clampScore(parsed.qualitySignals?.lowQualityRisk ?? 0)
      };
      const confidence = clampScore(parsed.confidence);
      const recommendation = ['approve', 'reject', 'needs_manual_review'].includes(parsed.recommendation) ? parsed.recommendation : 'needs_manual_review';
      const factCheck = parsed.factCheck && ['passed', 'uncertain', 'failed'].includes(parsed.factCheck.status)
        ? { status: parsed.factCheck.status, notes: Array.isArray(parsed.factCheck.notes) ? parsed.factCheck.notes : [] }
        : { status: 'uncertain' as const, notes: [] };
      const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.filter(Boolean) : [];

      const output: AiModerationOutput = {
        provider: 'openai',
        recommendation,
        confidence,
        improvedQuestion,
        correctAnswer,
        generatedWrongAnswers: wrong,
        improvedOptions,
        correctIndex,
        category,
        difficulty,
        explanation,
        reasons,
        factCheck,
        qualitySignals,
        moderation: {
          status: 'needs_review',
          score: confidence,
          recommendation,
          reasons,
          normalizedQuestion: improvedQuestion,
          normalizedOptions: improvedOptions,
          explanation,
          duplicateQuestionId: dup.duplicateId,
          aiProvider: 'openai',
          aiRecommendation: recommendation,
          aiConfidence: confidence,
          improvedQuestion,
          improvedOptions,
          factCheck,
          qualitySignals,
          original: { question: cleanText(rawQuestion), correctAnswer: cleanText(rawCorrect) }
        }
      };
      const validation = validateAiModerationOutput(output);
      if (!validation.ok) throw new Error(`OpenAI moderation output failed validation: ${validation.errors.join(' ')}`);
      return output;
    }
  };
}
