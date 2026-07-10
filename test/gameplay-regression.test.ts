import { describe, expect, it } from 'vitest';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import type { Question } from '@/lib/types';
import { createLocalJsonRepositoryProvider } from '@/lib/repositories/providers/localJsonProvider';
import { listGameplayQuestionsWithBundledFallback } from '@/lib/services/gameplayQuestionSource';
import { filterPlayableQuestions, isPlayableQuestion } from '@/lib/services/questionValidation';

const valid: Question = {
  id: 'community-1', category: 'פוליטיקה', difficulty: 'קל',
  question: 'מתי נבחר לראשונה בנימין נתניהו?', options: ['1996', '1998', '2001', '2003'],
  correctIndex: 0, correctAnswer: '1996', explanation: '', translations: {}
} as Question;

function fakeDatabase(rows: Question[]): RepositoryProvider {
  return { kind: 'supabase', approvedQuestions: { listGameplayQuestions: async () => rows } } as unknown as RepositoryProvider;
}

describe('question validation boundary', () => {
  it('8. rejects a question with empty text', () => {
    expect(isPlayableQuestion({ ...valid, question: '   ' })).toBe(false);
  });
  it('9. rejects a question with fewer than four non-empty answers', () => {
    expect(isPlayableQuestion({ ...valid, options: ['a', 'b', 'c'] })).toBe(false);
    expect(isPlayableQuestion({ ...valid, options: ['a', '', 'c', 'd'] })).toBe(false);
  });
  it('10. rejects a question with an invalid correct index', () => {
    expect(isPlayableQuestion({ ...valid, correctIndex: 5 })).toBe(false);
    expect(isPlayableQuestion({ ...valid, correctIndex: -1 })).toBe(false);
  });
  it('rejects missing category and accepts a valid question', () => {
    expect(isPlayableQuestion({ ...valid, category: '' })).toBe(false);
    expect(isPlayableQuestion(valid)).toBe(true);
    expect(isPlayableQuestion(null)).toBe(false);
  });
  it('11. filters out invalid questions', () => {
    const mixed = [valid, { ...valid, id: 'x', question: '' }, { ...valid, id: 'y', options: [] }];
    expect(filterPlayableQuestions(mixed).map(q => q.id)).toEqual(['community-1']);
  });
});

describe('gameplay question source — merged catalogue (regression fix)', () => {
  it('1. restores the full canonical category catalogue even when the database holds one question', async () => {
    const merged = await listGameplayQuestionsWithBundledFallback(fakeDatabase([valid]), { activeOnly: true }, 'test');
    const categories = new Set(merged.map(q => q.category));
    expect(merged.length).toBeGreaterThan(1000);
    expect(categories.size).toBeGreaterThanOrEqual(15);
  });

  it('2. Politics maps to a valid canonical category id present in the catalogue', async () => {
    const merged = await listGameplayQuestionsWithBundledFallback(fakeDatabase([valid]), { activeOnly: true }, 'test');
    expect(merged.some(q => q.category === 'פוליטיקה')).toBe(true);
  });

  it('3. every category in the catalogue has at least one valid playable question', async () => {
    const merged = await listGameplayQuestionsWithBundledFallback(fakeDatabase([valid]), { activeOnly: true }, 'test');
    const categories = new Set(merged.map(q => q.category));
    for (const category of categories) {
      expect(merged.some(q => q.category === category && isPlayableQuestion(q))).toBe(true);
    }
  });

  it('6 & 16. local mode and database mode expose the same category catalogue (parity)', async () => {
    const local = createLocalJsonRepositoryProvider();
    const localQuestions = await listGameplayQuestionsWithBundledFallback(local, { activeOnly: true }, 'test');
    const dbQuestions = await listGameplayQuestionsWithBundledFallback(fakeDatabase([valid]), { activeOnly: true }, 'test');
    const localCats = [...new Set(localQuestions.map(q => q.category))].sort();
    const dbCats = [...new Set(dbQuestions.map(q => q.category))].sort();
    expect(dbCats).toEqual(localCats);
  });

  it('12. falls back to the bundled catalogue when the database is empty', async () => {
    const merged = await listGameplayQuestionsWithBundledFallback(fakeDatabase([]), { activeOnly: true }, 'test');
    expect(merged.length).toBeGreaterThan(1000);
    expect(new Set(merged.map(q => q.category)).size).toBeGreaterThanOrEqual(15);
  });

  it('11 (source). malformed database rows never reach gameplay', async () => {
    const malformed = { ...valid, id: 'bad', options: ['only', 'two'] } as Question;
    const merged = await listGameplayQuestionsWithBundledFallback(fakeDatabase([malformed]), { activeOnly: true }, 'test');
    expect(merged.every(isPlayableQuestion)).toBe(true);
    expect(merged.some(q => q.id === 'bad')).toBe(false);
  });

  it('respects an explicit limit', async () => {
    const merged = await listGameplayQuestionsWithBundledFallback(fakeDatabase([valid]), { activeOnly: true, limit: 10 }, 'test');
    expect(merged.length).toBeLessThanOrEqual(10);
    // the fresh community question is surfaced first
    expect(merged[0].id).toBe('community-1');
  });
});
