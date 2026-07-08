import { describe, expect, it } from 'vitest';
import {
  ensureLocaleResources,
  isLocaleResourcesReady,
  localizeCategory,
  localizeDifficulty,
  localizeQuestion
} from '@/lib/localization';
import { getCommunityUi, getInfoUi, getMarketingQuestions, getTriviaUi } from '@/components/trivia/i18n';
import { getMultiplayerCopy } from '@/lib/multiplayer/localization';
import type { Locale } from '@/lib/types';

const locales: Locale[] = ['he', 'en', 'ar', 'ru', 'am'];

describe('per-locale localization modules', () => {
  it('bundles Hebrew eagerly as the base locale', () => {
    expect(isLocaleResourcesReady('he')).toBe(true);
  });

  it('loads every locale on demand', async () => {
    for (const locale of locales) {
      await ensureLocaleResources(locale);
      expect(isLocaleResourcesReady(locale)).toBe(true);
    }
  });

  it('translates categories identically to the former monolith', async () => {
    await Promise.all(locales.map(ensureLocaleResources));
    expect(localizeCategory('he', 'גאוגרפיה')).toBe('גאוגרפיה');
    expect(localizeCategory('en', 'גאוגרפיה')).toBe('Geography');
    expect(localizeCategory('ru', 'היסטוריה')).toBe('История');
    expect(localizeCategory('ar', 'מדע')).toBe('العلوم');
    expect(localizeCategory('en', 'קטגוריה-שאיננה')).toBe('קטגוריה-שאיננה');
  });

  it('translates difficulties', async () => {
    await ensureLocaleResources('en');
    expect(localizeDifficulty('en', 'קל')).toBe('Easy');
    expect(localizeDifficulty('he', 'קשה')).toBe('קשה');
  });

  it('serves UI copy from the per-locale modules', async () => {
    await Promise.all(locales.map(ensureLocaleResources));
    expect(getCommunityUi('en').submitNav).toBe('Submit Question');
    expect(getCommunityUi('he').submitNav).toBe('שליחת שאלה');
    expect(getInfoUi('en').imageAlt).toBe('Question image');
    expect(getMarketingQuestions('en').value).toBe('Endless');
    expect(getTriviaUi('he').headline).toBeTruthy();
    // Multiplayer copy still merges base + experience sections.
    const copy = getMultiplayerCopy('en');
    expect(copy.players).toBe('Players');
    expect(copy.roundWinner).toContain('{name}');
  });

  it('keeps inline question translation overrides authoritative', async () => {
    await ensureLocaleResources('en');
    const question = {
      category: 'מדע',
      difficulty: 'קל',
      question: 'שאלה בעברית?',
      options: ['א', 'ב', 'ג', 'ד'],
      correctIndex: 0,
      translations: {
        en: { question: 'A question in English?', options: ['A', 'B', 'C', 'D'] }
      }
    };
    const localized = localizeQuestion(question as never, 'en') as typeof question;
    expect(localized.question).toBe('A question in English?');
    expect(localized.options).toEqual(['A', 'B', 'C', 'D']);
    // Hebrew is a passthrough of the source fields.
    const hebrew = localizeQuestion(question as never, 'he') as typeof question;
    expect(hebrew.question).toBe('שאלה בעברית?');
  });
});
