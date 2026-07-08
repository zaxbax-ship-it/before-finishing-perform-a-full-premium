/**
 * Per-locale localization resources. Each locale ships as its own module under
 * ./locales so the client bundle only ever loads the active language — the
 * same resource-per-language layout used by native iOS (.lproj / String
 * Catalogs) and Android (res/values-<lang>) apps.
 *
 * Data files are GENERATED verbatim from the original monolithic dictionary.
 * Edit translations there and regenerate, or edit carefully by hand.
 */
export type LocaleResources = {
  /** Category display names keyed by the Hebrew source name. */
  category: Record<string, string>;
  difficulty: Record<string, string>;
  /** Single-term translations (countries, cities, units...). */
  term: Record<string, string>;
  /** Question lead-in phrases; index-aligned across locales. */
  prefix: string[];
  extraTerm: Record<string, string>;
  /** Full-sentence translations keyed by the Hebrew source text. */
  manual: Record<string, string>;
  /** Exact whole-question fallbacks keyed by the Hebrew question body. */
  exactQuestion: Record<string, string>;
  cleanPrefix: string[];
  cleanCategory: Record<string, string>;
  cleanDifficulty: Record<string, string>;
  categoryDescription: Record<string, string>;
  cleanCategoryDescription: Record<string, string>;
  /** Web app-shell UI strings; the facade merges ui + uiExt. */
  ui: Record<string, string>;
  uiExt: Record<string, string>;
  authUi: Record<string, string>;
  communityUi: Record<string, string>;
  infoUi: { correct: string; wrong: string; answer: string; next: string; action: string; imageAlt: string };
  marketingQuestions: { value: string; label: string };
  /** Multiplayer copy; the facade merges multiplayer + multiplayerExperience. */
  multiplayer: Record<string, string>;
  multiplayerExperience: Record<string, string>;
};
