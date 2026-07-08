import { AdSlot } from '@/components/ads/AdSlot';
import { CategoriesIcon, QuizIcon } from '@/lib/design/icons';
import { localizeCategory, localizeCategoryDescription } from '@/lib/localization';
import type { Locale } from '@/lib/types';

export function Categories({ t, locale, categories, startGame }: { t: Record<string, string>; locale: Locale; categories: string[]; startGame: (category: string) => void }) {
  return (
    <section className="mx-auto w-full max-w-[1680px] px-5 pb-16 pt-8 lg:px-8">
      <p className="mx-auto mb-8 flex w-fit items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-5 py-3 text-gold"><CategoriesIcon size={14} aria-hidden="true" /> {t.catPill}</p>
      <h1 className="mx-auto max-w-5xl text-center text-6xl font-black md:text-[86px]">{t.choose}</h1>
      <p className="mx-auto mt-5 max-w-4xl text-center text-xl leading-8 text-white/72">{t.chooseText}</p>
      <AdSlot placement="categories-top" className="mt-7" />
      <button className="ghost-button focus-ring mt-8 inline-flex items-center gap-2 lg:min-w-56" onClick={() => startGame('הכול')}><QuizIcon size={16} />{t.all}</button>
      <div className="category-grid mt-8">
        {categories.map(category => (
          <button key={category} className="category-card focus-ring glass" onClick={() => startGame(category)}>
            <span className="category-icon"><CategoriesIcon size={22} aria-hidden="true" /></span>
            <h3>{localizeCategory(locale, category)}</h3>
            <p>{localizeCategoryDescription(locale, category)}</p>
          </button>
        ))}
      </div>
      <AdSlot placement="categories-grid-after" className="mt-8" />
    </section>
  );
}
