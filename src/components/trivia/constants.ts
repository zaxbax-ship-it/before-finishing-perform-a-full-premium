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
export const SOLO_TIMER_SECONDS = 25;

// Lifeline pricing lives in src/lib/gameplay/economy.ts (lifelinePrice) — the
// single source of truth for every client. No component prices lifelines.

/**
 * Stage 22 — post-answer feedback timing (ms), defined once so the gameplay
 * screen and orchestrator agree. The player must read the blue/red verdict
 * before the next state, so the old ~0.5s/0.75s holds grow by ~1.5s. The
 * milestone transition is a calm cinematic sequence — a readable feedback beat,
 * then the ladder RISES in, HOLDS, and SINKS out — whose visible span
 * (HOLD + EXIT) is guaranteed to be at least 2.5 seconds.
 */
export const CORRECT_FEEDBACK_MS = 2000;
export const WRONG_FEEDBACK_MS = 2250;
export const MILESTONE_FEEDBACK_MS = 600;
export const MILESTONE_HOLD_MS = 1850;
export const MILESTONE_EXIT_MS = 700;
