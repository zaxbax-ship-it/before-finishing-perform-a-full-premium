import { AdSlot } from '@/components/ads/AdSlot';
import { CategoriesIcon, QuizIcon } from '@/lib/design/icons';
import { localizeCategory, localizeCategoryDescription } from '@/lib/localization';
import type { Locale } from '@/lib/types';
import type { GameQuestion } from '../types';

export function Categories({ t, locale, categories, questions, startGame }: { t: Record<string, string>; locale: Locale; categories: string[]; questions: GameQuestion[]; startGame: (category: string) => void }) {
  return (
    <section className="mx-auto w-full max-w-[1680px] px-5 pb-16 pt-8 lg:px-8">
      <p className="mb-8 mr-auto inline-flex w-fit items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-5 py-3 text-gold"><CategoriesIcon size={14} aria-hidden="true" /> {t.catPill}</p>
      <h1 className="max-w-5xl text-6xl font-black md:text-[86px]">{t.choose}</h1>
      <p className="mt-5 max-w-4xl text-xl leading-8 text-white/72">{t.chooseText}</p>
      <AdSlot placement="categories-top" className="mt-7" />
      <button className="ghost-button focus-ring mt-8 inline-flex items-center gap-2 lg:min-w-56" onClick={() => startGame('הכול')}><QuizIcon size={16} />{t.all}</button>
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {categories.map(category => (
          <button key={category} className="category-card focus-ring glass rounded-[30px] p-6 text-right" onClick={() => startGame(category)}>
            <span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold"><CategoriesIcon size={18} aria-hidden="true" /></span>
            <strong className="block text-3xl font-black">{localizeCategory(locale, category)}</strong>
            <em className="mt-3 block not-italic text-white/65">{localizeCategoryDescription(locale, category)}</em>
            <small className="mt-6 inline-block rounded-full border border-white/15 px-4 py-2 text-white/70">{questions.filter(question => question.category === category).length} {t.available}</small>
          </button>
        ))}
      </div>
      <AdSlot placement="categories-grid-after" className="mt-8" />
    </section>
  );
}
