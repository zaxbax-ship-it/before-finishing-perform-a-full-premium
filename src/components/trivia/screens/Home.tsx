import { AdSlot } from '@/components/ads/AdSlot';
import { CelebrationIcon, ForwardIcon, LockIcon, MultiplayerIcon, SinglePlayerIcon, TrophyIcon } from '@/lib/design/icons';
import type { Locale } from '@/lib/types';
import type { Screen } from '../types';

/** The AI "system challenge" robot glyph — matches the approved depth reference. */
function SystemChallengeIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="5" y="8" width="14" height="10" rx="3" />
      <path d="M12 8V5.4" />
      <circle cx="12" cy="3.6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9.6" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <path d="M3.2 12v3M20.8 12v3" />
    </svg>
  );
}

export function Home({ t, soloLabel, multiplayerLabel, journeyVisible, start, open }: { t: Record<string, string>; locale: Locale; soloLabel: string; multiplayerLabel: string; journeyVisible?: boolean; start: () => void; open: (screen: Screen) => void }) {
  return (
    // aria-label preserves the accessible name that the removed visible <h1>
    // ("game show" home title) used to provide.
    <section className="home-landing mx-auto w-full max-w-[1120px] px-5 pb-16 lg:px-8" aria-label={t.headline}>
      {/* Live gold/blue fog — sits behind everything at negative z-index. The
          rising-star field is the shared <Particles /> layer (also z<0). */}
      <div className="home-aurora" aria-hidden="true"><span /><span /><span /></div>

      {/* The million-dollar hero, now pure metallic-gold CSS text (the old 3D
          image asset is no longer used on Home). */}
      <div className="home-prize">
        <svg className="home-prize-crown" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 5l5 5 5-8 5 8 5-5-2 13H4z" /></svg>
        <div className="home-prize-amount">$1,000,000</div>
      </div>

      {/* Primary actions: the three mode cards (gold / blue / locked system). */}
      <div className="home-primary-actions">
        <button className="primary-action-card is-solo focus-ring stage-interactive" onClick={start} aria-label={soloLabel} title={soloLabel}>
          <span className="primary-action-icon"><SinglePlayerIcon size={30} aria-hidden="true" /></span>
          <span className="primary-action-label">{soloLabel}</span>
        </button>
        <button className="primary-action-card is-multi focus-ring stage-interactive" onClick={() => open('multiplayer')} aria-label={multiplayerLabel} title={multiplayerLabel}>
          <span className="primary-action-icon"><MultiplayerIcon size={30} aria-hidden="true" /></span>
          <span className="primary-action-label">{multiplayerLabel}</span>
        </button>
        {/* Locked "coming soon" card — reusable is-locked state: frosted veil +
            lock + label. Non-interactive (disabled, aria-disabled). */}
        <button className="primary-action-card is-system is-locked focus-ring" type="button" disabled aria-disabled="true" aria-label={`${t.sysChallenge} — ${t.soon}`} title={t.soon}>
          <span className="primary-action-chip">AI</span>
          <span className="primary-action-icon"><SystemChallengeIcon size={30} /></span>
          <span className="primary-action-label">{t.sysChallenge}</span>
          <span className="primary-action-lock" aria-hidden="true"><LockIcon size={18} /><em>{t.soon}</em></span>
        </button>
      </div>

      {/* Leaderboard entry — a compact secondary action below the primary cards. */}
      <button className="home-leaderboard-card focus-ring" onClick={() => open('leaderboard')} aria-label={t.lbNav} title={t.lbNav}>
        <span className="home-leaderboard-icon" aria-hidden="true"><TrophyIcon size={22} /></span>
        <span className="home-leaderboard-label">{t.lbNav}</span>
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
