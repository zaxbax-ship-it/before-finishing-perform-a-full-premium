import { AdSlot } from '@/components/ads/AdSlot';
import { CelebrationIcon, ForwardIcon, LeaderboardIcon, MultiplayerIcon, PremiumIcon, SinglePlayerIcon } from '@/lib/design/icons';
import type { Locale } from '@/lib/types';
import { money } from '../format';
import type { Screen } from '../types';

export function Home({ t, soloLabel, multiplayerLabel, journeyVisible, start, open }: { t: Record<string, string>; locale: Locale; soloLabel: string; multiplayerLabel: string; journeyVisible?: boolean; start: () => void; open: (screen: Screen) => void }) {
  return (
    <section className="home-landing mx-auto w-full max-w-[1680px] px-5 pb-16 lg:px-8">
      {/* Hero: brand statement through the two primary action cards below. */}
      <div className="grid items-center gap-12 lg:grid-cols-[.86fr_1fr]">
        <div className="home-hero-prize-card relative min-h-[280px] overflow-hidden rounded-[36px] p-8 lg:min-h-[440px]">
          <div className="absolute inset-8 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative grid h-full place-items-center text-center">
            <div>
              <div className="mb-5 text-6xl text-gold drop-shadow-[0_0_26px_rgba(247,202,103,.55)]"><PremiumIcon size={56} aria-hidden="true" /></div>
              <div className="home-prize-amount text-6xl font-black md:text-7xl">{money(1000000)}</div>
            </div>
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-6xl font-black leading-[.92] md:text-[112px]">{t.headline}</h1>
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

      {/* Leaderboard lives here now (relocated from the drawer): a compact secondary
          action below the primary Play buttons, part of the game ecosystem. */}
      <button className="home-leaderboard-card focus-ring" onClick={() => open('leaderboard')} aria-label={t.lbNav} title={t.lbNav}>
        <span className="home-leaderboard-icon" aria-hidden="true"><LeaderboardIcon size={22} /></span>
        <span className="home-leaderboard-label">{t.lbNav}</span>
        <ForwardIcon size={16} aria-hidden="true" />
      </button>

      {/* Progressive disclosure: one subtle actionable entry, only after discovery. */}
      {journeyVisible && (
        <button className="home-journey-entry focus-ring" onClick={() => open('journey')}>
          <CelebrationIcon size={18} aria-hidden="true" />
          <span>{t['rewards.journey.home_cta']}</span>
          <ForwardIcon size={16} aria-hidden="true" />
        </button>
      )}

      <AdSlot placement="homepage-hero-below" className="mt-4" />
      <AdSlot placement="homepage-content" className="mt-8" />
    </section>
  );
}
