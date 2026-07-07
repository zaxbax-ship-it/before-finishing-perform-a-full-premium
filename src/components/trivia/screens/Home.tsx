import { AdSlot } from '@/components/ads/AdSlot';
import {
  CategoriesIcon,
  EditIcon,
  LeaderboardIcon,
  MultiplayerIcon,
  PlayIcon,
  PremiumBadgeIcon,
  PremiumIcon,
  ProfileIcon,
  QuestionIcon,
  SettingsIcon,
  SupportIcon
} from '@/lib/design/icons';
import type { Locale } from '@/lib/types';
import { money } from '../format';
import { COMMUNITY_UI } from '../i18n';
import { Metric } from '../primitives';
import type { Screen } from '../types';

export function Home({ t, locale, questionCount, soloLabel, multiplayerLabel, start, open }: { t: Record<string, string>; locale: Locale; questionCount: number; soloLabel: string; multiplayerLabel: string; start: () => void; open: (screen: Screen) => void }) {
  const formattedQuestionCount = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : locale).format(questionCount);
  return (
    <section className="home-landing mx-auto w-full max-w-[1680px] px-5 pb-16 lg:px-8">
      {/* Hero first: intro through the single primary Start Game button. */}
      <div className="grid items-center gap-12 lg:grid-cols-[.86fr_1fr]">
        <div className="home-hero-prize-card relative min-h-[420px] overflow-hidden rounded-[36px] p-8 lg:min-h-[560px]">
          <div className="absolute inset-8 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative grid h-full place-items-center text-center">
            <div>
              <div className="mb-7 text-6xl text-gold drop-shadow-[0_0_26px_rgba(247,202,103,.55)]"><PremiumIcon size={56} aria-hidden="true" /></div>
              <div className="home-prize-amount text-6xl font-black md:text-7xl">{money(1000000)}</div>
              <p className="mt-8 text-white/65">{t.live}</p>
              <div className="mx-auto mt-8 h-2 w-80 rounded-full bg-gradient-to-l from-gold to-azure" />
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-5 py-3 text-gold shadow-gold"><PremiumBadgeIcon size={14} aria-hidden="true" /> {t.pill}</p>
          <h1 className="text-6xl font-black leading-[.92] md:text-[112px]">{t.headline}</h1>
          <p className="mt-7 max-w-4xl text-2xl font-bold leading-9 text-white/78">{t.intro}</p>
          <div className="mt-9 flex flex-wrap gap-4">
            <button className="premium-button focus-ring inline-flex items-center gap-2 text-lg" onClick={start}><PlayIcon size={18} />{soloLabel}</button>
            <button className="ghost-button focus-ring inline-flex items-center gap-2 text-lg" onClick={() => open('multiplayer')}><MultiplayerIcon size={18} />{multiplayerLabel}</button>
          </div>
        </div>
      </div>

      {/* Public navigation/actions below the hero. No admin/editor tools here. */}
      <nav className="home-actions" aria-label={t.homeActionsLabel}>
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => open('rules')}><QuestionIcon size={16} />{t.rules}</button>
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => open('categories')}><CategoriesIcon size={16} />{t.catNav}</button>
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => open('leaderboard')}><LeaderboardIcon size={16} />{t.lbNav}</button>
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => open('submit')}><EditIcon size={16} />{(COMMUNITY_UI[locale] || COMMUNITY_UI.he).submitNav}</button>
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => open('profile')}><ProfileIcon size={16} />{t.profile}</button>
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => open('contact')}><SupportIcon size={16} />{t.contact}</button>
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => open('settings')}><SettingsIcon size={16} />{t.settings}</button>
      </nav>

      <div className="mt-9 grid gap-4 md:grid-cols-3">
        <Metric value={`${formattedQuestionCount}+`} label={t.homeQuestions} />
        <Metric value="3" label={t.chancesLabel} />
        <Metric value={money(1000000)} label={t.homePrize} gold />
      </div>
      <AdSlot placement="homepage-hero-below" className="mt-4" />
      <AdSlot placement="homepage-content" className="mt-8" />
    </section>
  );
}
