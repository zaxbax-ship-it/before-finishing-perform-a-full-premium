import { useEffect, useRef, useState } from 'react';
import { useCountUp } from '../useCountUp';
import { AchievementsIcon, PremiumIcon } from '@/lib/design/icons';
import { playAudioEvent } from '@/lib/audio';
import { fmt, money } from '../format';
import { RewardReveals } from '../RewardReveals';
import type { RevealItem } from '@/lib/rewards/types';
import type { EndState } from '../types';

/**
 * End-of-game screen (solo) — the approved gold depth reference
 * (design-reference/game-screens-reference.html .res): a centered gold crown +
 * gold trophy, the outcome title, the final amount as metallic-gold CSS text,
 * two stat cards, then a gold "play again" CTA + a ghost "home". Tone still
 * follows the outcome (win confetti/halo). Confetti is decorative (aria-hidden)
 * and disabled by the global prefers-reduced-motion rule.
 */
export function Result({ t, authUi, isAuthenticated, state, correctCount, elapsed, prize, reveals, start, home }: { t: Record<string, string>; authUi: Record<string, string>; isAuthenticated: boolean; state: EndState; correctCount: number; elapsed: number; prize: number; reveals?: RevealItem[]; start: () => void; home: () => void }) {
  const title = state === 'win' ? t.winTitle : state === 'quit' ? t.quitTitle : state === 'timeout' ? t.timeoutTitle : t.lostTitle;
  const tone = state === 'win' ? 'is-win' : prize > 0 ? 'is-cashout' : 'is-neutral';
  const [copied, setCopied] = useState(false);
  const animatedPrize = useCountUp(prize, 1100);
  const copiedTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  async function share() {
    const text = fmt(t.shareText, { prize: money(prize) });
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: t.headline, text });
      } catch {
        // User cancelled the share sheet — nothing to do.
      }
      return;
    }
    // Desktop / unsupported browsers: the button must still do something real.
    try {
      await navigator.clipboard.writeText(`${text} · ${window.location.origin}`);
      playAudioEvent('ui.success');
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard unavailable (permissions) — leave the button as-is.
    }
  }

  return (
    <section className="mx-auto grid min-h-[calc(100vh-104px)] max-w-xl place-items-center px-6 pb-14">
      <div className={`result-stage w-full ${tone}`}>
        {state === 'win' && (
          <div className="victory-burst" aria-hidden="true">
            {Array.from({ length: 16 }, (_, index) => <span key={index} />)}
          </div>
        )}
        {prize > 0 && <div className="result-halo" aria-hidden="true" />}
        <div className="result-sheet glass stage-panel w-full rounded-[34px] text-center">
          {/* Crown (solid gold circle) — returns home; the app-wide brand mark. */}
          <button type="button" className="result-crown focus-ring" onClick={home} aria-label={t.home} title={t.home}>
            <PremiumIcon size={24} aria-hidden="true" />
          </button>
          <div className="result-trophy" aria-hidden="true"><AchievementsIcon size={40} /></div>
          <h2 className="result-title">{title}</h2>
          {prize > 0 && <div className="result-amount" dir="ltr">{money(animatedPrize)}</div>}
          <div className="result-stats">
            <div className="result-stat"><b>{correctCount}</b><span>{t.accuracy}</span></div>
            <div className="result-stat"><b>{elapsed}s</b><span>{t.timeLabel}</span></div>
          </div>
          {reveals && reveals.length > 0 && <RewardReveals t={t} reveals={reveals} />}
          {!isAuthenticated && (
            <div className="guest-progress-cta" role="note">
              <a className="premium-button focus-ring" href="/login">{authUi.saveProgress}</a>
            </div>
          )}
          <div className="result-actions">
            <button className="result-cta focus-ring" onClick={start}>{t.playAgain}</button>
            <button className="result-ghost focus-ring" onClick={share} aria-live="polite">{copied ? t.shareCopied : t.shareBtn}</button>
            <button className="result-ghost focus-ring" onClick={home}>{t.home}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
