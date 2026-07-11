import { AdSlot } from '@/components/ads/AdSlot';
import { CelebrationIcon, ForwardIcon, LeaderboardIcon, MultiplayerIcon, PremiumIcon, SinglePlayerIcon } from '@/lib/design/icons';
import type { Locale } from '@/lib/types';
import { ASSETS } from '@/lib/assets';
import type { Screen } from '../types';

export function Home({ t, soloLabel, multiplayerLabel, journeyVisible, start, open }: { t: Record<string, string>; locale: Locale; soloLabel: string; multiplayerLabel: string; journeyVisible?: boolean; start: () => void; open: (screen: Screen) => void }) {
  return (
    <section className="home-landing mx-auto w-full max-w-[1680px] px-5 pb-16 lg:px-8">
      {/* Hero: brand statement through the two primary action cards below. */}
      <div className="home-hero-grid grid items-center lg:grid-cols-[.86fr_1fr]">
        {/* Container removed — the 3D icon + crown now float free on the page
            background, over a soft embedded premium halo. */}
        <div className="home-hero-stage">
          <div className="home-hero-million">
            {/* The official 3D one-million-dollar hero asset, used exactly as
                supplied (only scaled + positioned, never redrawn). */}
            <span className="home-hero-halo" aria-hidden="true" />
            <img src={ASSETS.million3d} alt="$1,000,000" width={1024} height={334} className="home-million-img" />
            {/* The existing crown, reused and resting naturally (slight right
                tilt, subtle overlap) on the final zero — never rigidly centred. */}
            <span className="home-million-crown" aria-hidden="true"><PremiumIcon size={34} /></span>
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-6xl font-black leading-[.92] md:text-[112px]">{t.headline}</h1>
        </div>
      </div>

      {/* Primary actions: the visual focal point. Icon-first, secondary nav lives in the header drawer. */}
      <div className="home-primary-actions">
        <button className="primary-action-card is-solo focus-ring stage-interactive" onClick={start} aria-label={soloLabel} title={soloLabel}>
          <span className="primary-action-icon"><SinglePlayerIcon size={46} aria-hidden="true" /></span>
          <span className="primary-action-label">{soloLabel}</span>
        </button>
        <button className="primary-action-card is-multi focus-ring stage-interactive" onClick={() => open('multiplayer')} aria-label={multiplayerLabel} title={multiplayerLabel}>
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
