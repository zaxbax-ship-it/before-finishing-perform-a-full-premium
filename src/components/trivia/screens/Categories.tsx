import { useState, type ComponentType } from 'react';
import { AdSlot } from '@/components/ads/AdSlot';
import {
  AchievementsIcon,
  CategoriesIcon,
  CelebrationIcon,
  EditIcon,
  FavoritesIcon,
  FriendsIcon,
  GlobeIcon,
  HintsIcon,
  HistoryIcon,
  LockIcon,
  PlayIcon,
  QuizIcon,
  SettingsIcon,
  ShareIcon,
  SubscriptionIcon
} from '@/lib/design/icons';

/**
 * Thematic icon per category (canonical Hebrew keys from the question bank);
 * anything unmapped keeps the generic scroll. Purely presentational.
 */
const CATEGORY_ICONS: Record<string, ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' }>> = {
  'ידע כללי': QuizIcon,
  'היסטוריה': HistoryIcon,
  'גאוגרפיה': GlobeIcon,
  'מדע': HintsIcon,
  'טכנולוגיה': SettingsIcon,
  'רפואה': FavoritesIcon,
  'ספורט': AchievementsIcon,
  'קולנוע': PlayIcon,
  'נטפליקס': SubscriptionIcon,
  'מוזיקה': CelebrationIcon,
  'רכילות': FriendsIcon,
  'רכילות ותרבות ישראלית': FriendsIcon,
  'רכילות ותרבות אמריקאית ועולמית': FriendsIcon,
  'אנגלית - בחינה עצמית': EditIcon,
  'טיקטוק': ShareIcon,
  'אינסטגרם': ShareIcon,
  'טרנדים': CelebrationIcon
};

/**
 * Categories that exist in the bank but are presented as locked ("coming soon")
 * for now, plus two brand-new topics that have no questions yet. All render as
 * disabled tiles at the very bottom of the chooser. Canonical Hebrew keys.
 */
const LOCKED_CATEGORIES = new Set(['רפואה', 'נטפליקס', 'מדע']);
const COMING_SOON_CATEGORIES = ['אינסטגרם', 'טרנדים'];

import { localizeCategory, localizeCategoryDescription } from '@/lib/localization';
import type { Locale } from '@/lib/types';

export function Categories({ t, locale, categories, startGame, startError, clearStartError }: { t: Record<string, string>; locale: Locale; categories: string[]; startGame: (category: string) => void | Promise<void>; startError?: string; clearStartError?: () => void }) {
  const [pending, setPending] = useState<string | null>(null);
  // Instant acknowledgement: the tapped card shows a quiet busy state while the
  // round is dealt (a network round-trip in Hebrew) instead of a dead pause.
  // The screen changes when startGame resolves; finally covers early returns.
  const launch = async (category: string) => {
    if (pending) return;
    clearStartError?.();
    setPending(category);
    try {
      await startGame(category);
    } finally {
      setPending(null);
    }
  };
  const activeCategories = categories.filter(category => !LOCKED_CATEGORIES.has(category));
  const lockedCategories = [...categories.filter(category => LOCKED_CATEGORIES.has(category)), ...COMING_SOON_CATEGORIES];
  return (
    <section className="mx-auto w-full max-w-[1680px] px-5 pb-16 pt-8 lg:px-8">
      {startError && <p className="category-start-error" role="alert">{startError}</p>}
      {/* Primary path: one prominent option that plays the full bank, above
          every specific category. */}
      <button className={`play-all-banner focus-ring ${pending === 'הכול' ? 'is-loading' : ''}`} onClick={() => launch('הכול')} disabled={pending !== null} aria-busy={pending === 'הכול'}>
        <span className="play-all-icon">{pending === 'הכול' ? <span className="category-launch-spinner" aria-hidden="true" /> : <QuizIcon size={22} aria-hidden="true" />}</span>
        <span className="play-all-label">{t.all}</span>
      </button>
      <AdSlot placement="categories-top" className="mt-7" />
      <div className={`category-grid mt-8 ${pending !== null ? 'is-launching' : ''}`}>
        {activeCategories.map(category => {
          const CategoryIcon = CATEGORY_ICONS[category] || CategoriesIcon;
          const loading = pending === category;
          return (
          <button key={category} className={`category-card focus-ring glass stage-interactive ${loading ? 'is-loading' : ''}`} onClick={() => launch(category)} disabled={pending !== null} aria-busy={loading} title={localizeCategoryDescription(locale, category)}>
            <span className="category-icon">{loading ? <span className="category-launch-spinner" aria-hidden="true" /> : <CategoryIcon size={22} aria-hidden="true" />}</span>
            <h3>{localizeCategory(locale, category)}</h3>
          </button>
          );
        })}
      </div>
      {/* Locked / coming-soon topics, always at the bottom, never launchable. */}
      {lockedCategories.length > 0 && (
        <div className="category-grid category-grid-locked mt-4">
          {lockedCategories.map(category => {
            const CategoryIcon = CATEGORY_ICONS[category] || CategoriesIcon;
            return (
              <button key={category} className="category-card category-locked focus-ring glass stage-interactive" disabled aria-disabled="true">
                <span className="category-lock" aria-hidden="true"><LockIcon size={16} /></span>
                <span className="category-icon"><CategoryIcon size={22} aria-hidden="true" /></span>
                <h3>{localizeCategory(locale, category)}</h3>
                <span className="category-soon">{t.soon}</span>
              </button>
            );
          })}
        </div>
      )}
      <AdSlot placement="categories-grid-after" className="mt-8" />
    </section>
  );
}
