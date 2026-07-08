import type { Locale } from '@/lib/types';
import type { Lifeline } from './types';

/**
 * Structural game constants shared by the gameplay screen and the orchestrator.
 * Moved verbatim out of `TriviaPlatform.tsx` so the value is defined once and
 * imported by every consumer (no duplicated ladders, option letters, or pricing).
 */

export const LETTERS = ['א', 'ב', 'ג', 'ד'];

export const OPTION_LETTERS: Record<Locale, string[]> = {
  he: LETTERS,
  en: ['A', 'B', 'C', 'D'],
  ar: ['أ', 'ب', 'ج', 'د'],
  ru: ['А', 'Б', 'В', 'Г'],
  am: ['ሀ', 'ለ', 'ሐ', 'መ']
};

export const LANGUAGE_OPTIONS: Array<{ value: Locale; label: string; native: string }> = [
  { value: 'he', label: 'עברית', native: 'עברית' },
  { value: 'en', label: 'English', native: 'English' },
  { value: 'ar', label: 'Arabic', native: 'العربية' },
  { value: 'ru', label: 'Russian', native: 'Русский' },
  { value: 'am', label: 'Amharic', native: 'አማርኛ' }
];

export const MONEY = [1000, 2000, 5000, 10000, 20000, 40000, 80000, 150000, 250000, 400000, 550000, 700000, 850000, 1000000, 1000000];

export const SAFE_STEPS = [4, 9, 14];

/** Solo round timer in seconds. Presentation (the timer ring) derives its
 * progress from the same constant the game clock uses. */
export const SOLO_TIMER_SECONDS = 45;

/** Price of re-using a lifeline: a fixed ceiling capped at 25% of the current pot. */
export function priceFor(type: Lifeline, pot: number) {
  const fixed = type === 'fifty' ? 5000 : type === 'swap' ? 8000 : type === 'audience' ? 10000 : 12000;
  return Math.min(fixed, Math.max(0, Math.floor(pot * 0.25)));
}
