import type { Locale } from '@/lib/types';
import { getLocaleResources } from '@/lib/localization';

/**
 * Trivia web-app UI copy facade.
 *
 * The per-language strings (app shell, auth corner, community studio, in-game
 * feedback, marketing tile) live in the per-locale resource modules under
 * src/lib/localization/locales/<locale>.ts and are code-split per language.
 * These accessors read the active locale's resources with a Hebrew fallback
 * until that locale finishes loading (the app shell preloads before switching).
 */

/** Merged app-shell strings (former UI + UI_EXT dictionaries). */
export function getTriviaUi(locale: Locale): Record<string, string> {
  const resources = getLocaleResources(locale);
  return { ...resources.ui, ...resources.uiExt };
}

export function getAuthUi(locale: Locale): Record<string, string> {
  return getLocaleResources(locale).authUi;
}

export function getCommunityUi(locale: Locale): Record<string, string> {
  return getLocaleResources(locale).communityUi;
}

export function getInfoUi(locale: Locale) {
  return getLocaleResources(locale).infoUi;
}

export function getMarketingQuestions(locale: Locale) {
  return getLocaleResources(locale).marketingQuestions;
}

/** Maps stored achievement ids (legacy Hebrew + progression) to localized UI keys. */
export const ACHIEVEMENT_KEYS: Record<string, string> = {
  'כניסה לאולפן': 'achStudio',
  'מיליון דולר': 'achMillion',
  'שחקן בכיר': 'achSenior',
  'משחק הושלם': 'achDone',
  first_game: 'achFirstGame',
  first_win: 'achFirstWin',
  ten_games: 'achTenGames',
  fifty_games: 'achFiftyGames',
  perfect_game: 'achPerfectGame',
  millionaire: 'achMillionaire',
  multiplayer_debut: 'achMultiplayerDebut',
  level_5: 'achLevel5',
  level_10: 'achLevel10'
};
