import { AdSlot } from '@/components/ads/AdSlot';
import { MultiplayerIcon, PremiumBadgeIcon, PremiumIcon, SinglePlayerIcon } from '@/lib/design/icons';
import type { Locale } from '@/lib/types';
import { money } from '../format';
import { getMarketingQuestions } from '../i18n';
import { Metric } from '../primitives';
import type { Screen } from '../types';

export function Home({ t, locale, soloLabel, multiplayerLabel, start, open }: { t: Record<string, string>; locale: Locale; soloLabel: string; multiplayerLabel: string; start: () => void; open: (screen: Screen) => void }) {
  // Non-numeric marketing phrase — accurate across every locale, no hard count to contradict.
  const marketingQuestions = getMarketingQuestions(locale);
  return (
    <section className="home-landing mx-auto w-full max-w-[1680px] px-5 pb-16 lg:px-8">
      {/* Hero: brand statement through the two primary action cards below. */}
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
        <div className="text-center">
          <p className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-5 py-3 text-gold shadow-gold"><PremiumBadgeIcon size={14} aria-hidden="true" /> {t.pill}</p>
          <h1 className="text-6xl font-black leading-[.92] md:text-[112px]">{t.headline}</h1>
          <p className="mx-auto mt-7 max-w-4xl text-2xl font-bold leading-9 text-white/78">{t.intro}</p>
        </div>
      </div>

      {/* Primary actions: the visual focal point. Icon-first, secondary nav lives in the header drawer. */}
      <div className="home-primary-actions">
        <button className="primary-action-card is-solo focus-ring" onClick={start} aria-label={soloLabel} title={soloLabel}>
          <span className="primary-action-icon"><SinglePlayerIcon size={46} aria-hidden="true" /></span>
          <span className="primary-action-label">{soloLabel}</span>
        </button>
        <button className="primary-action-card is-multi focus-ring" onClick={() => open('multiplayer')} aria-label={multiplayerLabel} title={multiplayerLabel}>
          <span className="primary-action-icon"><MultiplayerIcon size={46} aria-hidden="true" /></span>
          <span className="primary-action-label">{multiplayerLabel}</span>
        </button>
      </div>

      <div className="mt-9 grid gap-4 md:grid-cols-2">
        <Metric value={marketingQuestions.value} label={marketingQuestions.label} />
        <Metric value="3" label={t.chancesLabel} />
      </div>
      <AdSlot placement="homepage-hero-below" className="mt-4" />
      <AdSlot placement="homepage-content" className="mt-8" />
    </section>
  );
}
