import { useEffect, useRef, useState } from 'react';
import { useCountUp } from '../useCountUp';
import { AchievementsIcon } from '@/lib/design/icons';
import { playAudioEvent } from '@/lib/audio';
import { fmt, money } from '../format';
import { Metric } from '../primitives';
import { RewardReveals } from '../RewardReveals';
import type { RevealItem } from '@/lib/rewards/types';
import type { EndState } from '../types';

/**
 * End-of-game screen with a tone that matches the outcome: the million-dollar
 * win gets a one-time gold confetti burst and halo (the visual counterpart of
 * the `game.victory` fanfare), a cash-out gets a softer halo, and a loss stays
 * calm and encouraging. The prize is the hero whenever money was won.
 * Confetti is decorative (aria-hidden) and disabled by the global
 * prefers-reduced-motion rule.
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
    <section className="mx-auto grid min-h-[calc(100vh-104px)] max-w-5xl place-items-center px-6 pb-14">
      <div className={`result-stage w-full ${tone}`}>
        {state === 'win' && (
          <div className="victory-burst" aria-hidden="true">
            {Array.from({ length: 16 }, (_, index) => <span key={index} />)}
          </div>
        )}
        {prize > 0 && <div className="result-halo" aria-hidden="true" />}
        <div className="glass stage-panel w-full rounded-[34px] p-8 text-center md:p-12">
          {(state === 'win' || prize > 0) && (
            <div className="result-icon mx-auto mb-4 text-gold">
              <AchievementsIcon size={40} aria-hidden="true" />
            </div>
          )}
          <h2 className="text-5xl font-black">{title}</h2>
          {prize > 0 && <div className="result-prize-hero" dir="ltr">{money(animatedPrize)}</div>}
          <div className="mt-8 grid gap-4 md:grid-cols-2"><Metric value={`${correctCount}/15`} label={t.accuracy} /><Metric value={`${elapsed}s`} label={t.timeLabel} /></div>
          {reveals && reveals.length > 0 && <RewardReveals t={t} reveals={reveals} />}
          {!isAuthenticated && (
            <div className="guest-progress-cta" role="note">
              <a className="premium-button focus-ring" href="/login">{authUi.saveProgress}</a>
            </div>
          )}
          <div className="mt-8 flex flex-col justify-center gap-4 md:flex-row">
            <button className="premium-button focus-ring" onClick={start}>{t.playAgain}</button>
            <button className="ghost-button focus-ring" onClick={share} aria-live="polite">{copied ? t.shareCopied : t.shareBtn}</button>
            <button className="ghost-button focus-ring" onClick={home}>{t.home}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
