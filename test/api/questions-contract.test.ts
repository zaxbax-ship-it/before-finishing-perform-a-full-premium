import { describe, expect, it } from 'vitest';
import { isQuestionsResponse } from '@/lib/api/contracts';
import { balancedQuestionSample, clampQuestionLimit, parseQuestionExcludeParam } from '@/lib/services/questionSampling';
import type { Question } from '@/lib/types';

function makeQuestion(id: string, category: string): Question {
  return {
    id,
    category,
    difficulty: 'בינוני',
    question: `Q ${id}`,
    options: ['a', 'b', 'c', 'd'],
    correctIndex: 0
  };
}

const bank: Question[] = [
  ...Array.from({ length: 20 }, (_, i) => makeQuestion(`geo-${i}`, 'גאוגרפיה')),
  ...Array.from({ length: 20 }, (_, i) => makeQuestion(`sci-${i}`, 'מדע')),
  ...Array.from({ length: 20 }, (_, i) => makeQuestion(`his-${i}`, 'היסטוריה'))
];

describe('questions API response contract', () => {
  it('a sampled response conforms to QuestionsResponse', () => {
    const sample = balancedQuestionSample(bank, 15);
    const response = {
      ok: true as const,
      questions: sample,
      totalAvailable: bank.length,
      sampled: true,
      excludedApplied: 0
    };
    expect(isQuestionsResponse(response)).toBe(true);
    expect(sample.length).toBe(15);
  });

  it('balanced sampling spreads across categories', () => {
    const sample = balancedQuestionSample(bank, 15);
    const categories = new Set(sample.map(question => question.category));
    expect(categories.size).toBeGreaterThan(1);
  });

  it('exclude ids are honored by the sampler', () => {
    const excludeIds = bank.slice(0, 10).map(question => String(question.id));
    const sample = balancedQuestionSample(bank, 15, { excludeIds });
    expect(sample.some(question => excludeIds.includes(String(question.id)))).toBe(false);
  });

  it('rejects a malformed response (missing correctIndex)', () => {
    const bad = {
      ok: true,
      questions: [{ id: 'x', category: 'c', question: 'q', options: ['a', 'b'] }],
      totalAvailable: 1,
      sampled: true,
      excludedApplied: 0
    };
    expect(isQuestionsResponse(bad)).toBe(false);
  });

  it('helpers parse limit and exclude params safely', () => {
    expect(clampQuestionLimit('abc')).toBeGreaterThan(0);
    expect(clampQuestionLimit('5')).toBe(5);
    expect(parseQuestionExcludeParam('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(parseQuestionExcludeParam(null)).toEqual([]);
  });
});
