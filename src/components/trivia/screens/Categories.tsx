import type { ComponentType } from 'react';
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

export function Categories({ t, locale, categories, startGame }: { t: Record<string, string>; locale: Locale; categories: string[]; startGame: (category: string) => void }) {
  return (
    <section className="mx-auto w-full max-w-[1680px] px-5 pb-16 pt-8 lg:px-8">
      <p className="mx-auto mb-8 flex w-fit items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-5 py-3 text-gold"><CategoriesIcon size={14} aria-hidden="true" /> {t.catPill}</p>
      <h1 className="mx-auto max-w-5xl text-center text-6xl font-black md:text-[86px]">{t.choose}</h1>
      <p className="mx-auto mt-5 max-w-4xl text-center text-xl leading-8 text-white/72">{t.chooseText}</p>
      {/* Primary path: one prominent option that plays the full bank, above
          every specific category. */}
      <button className="play-all-banner focus-ring" onClick={() => startGame('הכול')}>
        <span className="play-all-icon"><QuizIcon size={22} aria-hidden="true" /></span>
        <span className="play-all-label">{t.all}</span>
        <ForwardIcon size={18} aria-hidden="true" />
      </button>
      <AdSlot placement="categories-top" className="mt-7" />
      <div className="category-grid mt-8">
        {categories.map(category => {
          const CategoryIcon = CATEGORY_ICONS[category] || CategoriesIcon;
          return (
          <button key={category} className="category-card focus-ring glass" onClick={() => startGame(category)}>
            <span className="category-icon"><CategoryIcon size={22} aria-hidden="true" /></span>
            <h3>{localizeCategory(locale, category)}</h3>
            <p>{localizeCategoryDescription(locale, category)}</p>
          </button>
          );
        })}
      </div>
      <AdSlot placement="categories-grid-after" className="mt-8" />
    </section>
  );
}
