import type { Locale } from '@/lib/types';
import { getLocaleResources } from '@/lib/localization';

export type MultiplayerCopy = Record<string, string>;

/**
 * Multiplayer copy facade. The per-language strings live in the code-split
 * per-locale resource modules (src/lib/localization/locales/<locale>.ts);
 * this merges the base + experience sections exactly as before.
 */
export function getMultiplayerCopy(locale: Locale): MultiplayerCopy {
  const resources = getLocaleResources(locale);
  return { ...resources.multiplayer, ...resources.multiplayerExperience };
}

export const MULTIPLAYER_OPTION_LETTERS: Record<Locale, string[]> = {
  he: ['א', 'ב', 'ג', 'ד'],
  en: ['A', 'B', 'C', 'D'],
  ar: ['أ', 'ب', 'ج', 'د'],
  ru: ['А', 'Б', 'В', 'Г']
};

export function multiplayerOptionLetter(locale: Locale, index: number): string {
  const letters = MULTIPLAYER_OPTION_LETTERS[locale] || MULTIPLAYER_OPTION_LETTERS.en;
  return letters[index] || String.fromCharCode(65 + index);
}
