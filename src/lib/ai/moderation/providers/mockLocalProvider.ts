import type { AiModerationInput, AiModerationOutput, AiModerationProvider } from '../types';
import { clampScore, trimExplanation } from '../validation';
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

const unsafeTerms = ['נאצי', 'קללה', 'טיפש', 'fuck', 'shit', 'nazi', 'قتل', 'убить'];
const DIFFICULTY_LABELS = { easy: 'קל', medium: 'בינוני', hard: 'קשה', expert: 'מומחה' };
const DEFAULT_CATEGORY = 'ידע כללי';

function explanationFor(correctAnswer: string, language: string): string {
  const answer = cleanText(correctAnswer);
  if (language === 'he') return `התשובה הנכונה היא ${answer}.`;
  if (language === 'ar') return `الإجابة الصحيحة هي ${answer}.`;
  if (language === 'ru') return `Правильный ответ — ${answer}.`;
  if (language === 'am') return `ትክክለኛው መልስ ${answer} ነው።`;
  return `The correct answer is ${answer}.`;
}

/**
 * Mock editorial provider (no external API). It performs the full Stage 11
 * editorial job locally: improves wording, draws three plausible distractors
 * from the real question bank, infers a category and difficulty, shuffles, and
 * scores duplicate/safety/quality risk. It NEVER auto-approves — every result is
 * routed to human editorial review. Replace with the OpenAI provider once
 * credentials are configured; the admin edits before publishing either way.
 */
export function createMockLocalAiModerationProvider(): AiModerationProvider {
  return {
    name: 'mock-local',
    async moderate(input): Promise<AiModerationOutput> {
      const rawQuestion = input.draft.question;
      const rawCorrect = input.draft.options[input.draft.correctIndex] || '';
      const language = input.draft.language;
      const seed = normalizeComparable(rawQuestion) + '|' + normalizeComparable(rawCorrect);

      const improvedQuestion = improveQuestionWording(rawQuestion);
      const correctAnswer = improveAnswerWording(rawCorrect);
      const category = inferCategory(rawQuestion, rawCorrect, input.existingQuestions, DEFAULT_CATEGORY);
      const difficulty = inferDifficulty(rawQuestion, rawCorrect, DIFFICULTY_LABELS);
      const generatedWrongAnswers = generateWrongAnswers(correctAnswer, input.existingQuestions, category, seed);
      const { options: improvedOptions, correctIndex } = shuffleOptions(correctAnswer, generatedWrongAnswers, seed);
      const explanation = trimExplanation(explanationFor(correctAnswer, language));

      const dup = duplicateRiskFor(improvedQuestion, input.existingQuestions, input.existingSubmissions.map(s => ({ question: s.question })));
      const text = `${rawQuestion} ${rawCorrect}`.toLowerCase();
      const unsafeRisk = unsafeTerms.some(term => text.includes(term)) ? 92 : 4;
      let lowQualityRisk = 0;
      if (cleanText(rawQuestion).length < 12) lowQualityRisk += 26;
      if (cleanText(rawCorrect).length < 1) lowQualityRisk += 40;
      if (new Set(improvedOptions.map(normalizeComparable)).size !== 4) lowQualityRisk += 30;
      lowQualityRisk = clampScore(lowQualityRisk);
      const spamRisk = clampScore(Math.max(unsafeRisk, lowQualityRisk > 75 ? 60 : 6));

      const confidence = clampScore(88 - Math.round(dup.risk * 0.28) - Math.round(unsafeRisk * 0.3) - Math.round(lowQualityRisk * 0.2));
      const recommendation: AiModerationOutput['recommendation'] =
        unsafeRisk >= 85 || lowQualityRisk >= 82 ? 'reject'
          : dup.risk >= 65 || confidence < 72 ? 'needs_manual_review'
            : 'approve';

      const reasons = [
        dup.risk >= 65 ? 'Potential duplicate or very similar question detected.' : '',
        unsafeRisk >= 70 ? 'Potentially unsafe, abusive or spam-like wording detected.' : '',
        lowQualityRisk >= 60 ? 'Wording or answer quality needs an editor before publishing.' : '',
        'Mock AI editor used. Replace with OpenAI for real fact-checking and distractor generation.'
      ].filter(Boolean);

      const factCheck = {
        status: 'uncertain' as const,
        notes: ['Mock provider cannot verify facts. Confirm the answer before publishing.']
      };
      const qualitySignals = { duplicateRisk: dup.risk, spamRisk, unsafeRisk, lowQualityRisk };

      return {
        provider: 'mock-local',
        recommendation,
        confidence,
        improvedQuestion,
        correctAnswer,
        generatedWrongAnswers,
        improvedOptions,
        correctIndex,
        category,
        difficulty,
        explanation,
        reasons,
        factCheck,
        qualitySignals,
        moderation: {
          // Human review is mandatory — the AI is an editor, not a publisher.
          status: 'needs_review',
          score: confidence,
          recommendation,
          reasons,
          normalizedQuestion: improvedQuestion,
          normalizedOptions: improvedOptions,
          explanation,
          duplicateQuestionId: dup.duplicateId,
          aiProvider: 'mock-local',
          aiRecommendation: recommendation,
          aiConfidence: confidence,
          improvedQuestion,
          improvedOptions,
          factCheck,
          qualitySignals,
          original: { question: cleanText(rawQuestion), correctAnswer: cleanText(rawCorrect) }
        }
      };
    }
  };
}
