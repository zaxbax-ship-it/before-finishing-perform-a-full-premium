import { useState, type ComponentType } from 'react';
import { AdSlot } from '@/components/ads/AdSlot';
import {
  AchievementsIcon,
  CategoriesIcon,
  CelebrationIcon,
  EditIcon,
  FavoritesIcon,
  ForwardIcon,
  FriendsIcon,
  GlobeIcon,
  HintsIcon,
  HistoryIcon,
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
  'טיקטוק': ShareIcon
};
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
  return (
    <section className="mx-auto w-full max-w-[1680px] px-5 pb-16 pt-8 lg:px-8">
      <h1 className="mx-auto max-w-5xl text-center text-4xl font-black md:text-6xl">{t.choose}</h1>
      {startError && <p className="category-start-error" role="alert">{startError}</p>}
      {/* Primary path: one prominent option that plays the full bank, above
          every specific category. */}
      <button className={`play-all-banner focus-ring ${pending === 'הכול' ? 'is-loading' : ''}`} onClick={() => launch('הכול')} disabled={pending !== null} aria-busy={pending === 'הכול'}>
        <span className="play-all-icon">{pending === 'הכול' ? <span className="category-launch-spinner" aria-hidden="true" /> : <QuizIcon size={22} aria-hidden="true" />}</span>
        <span className="play-all-label">{t.all}</span>
        <ForwardIcon size={18} aria-hidden="true" />
      </button>
      <AdSlot placement="categories-top" className="mt-7" />
      <div className={`category-grid mt-8 ${pending !== null ? 'is-launching' : ''}`}>
        {categories.map(category => {
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
      <AdSlot placement="categories-grid-after" className="mt-8" />
    </section>
  );
}
