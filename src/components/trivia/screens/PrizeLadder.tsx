'use client';

import { MONEY, SAFE_STEPS } from '../constants';
import { money } from '../format';

/**
 * Stage 20 — the Prize Ladder gate. Shown between category selection and
 * gameplay to build the "entering the game show" anticipation. The complete
 * ladder is presented; only the first rung ($1,000) is unlocked and tappable —
 * every higher rung is blurred and locked. Tapping the first rung begins play.
 * No new visible copy: only the existing money amounts and step numbers.
 */
export function PrizeLadder({ t, onBegin }: { t: Record<string, string>; onBegin: () => void }) {
  return (
    <section className="prize-ladder-screen mx-auto w-full max-w-md px-4 pb-14 pt-6" aria-label={t.ladder}>
      <div className="prize-ladder-gate glass">
        <div className="prize-ladder-rungs">
          {MONEY.map((amount, index) => {
            const isFirst = index === 0;
            const isSafe = SAFE_STEPS.includes(index);
            const isTop = index === MONEY.length - 1;
            if (isFirst) {
              return (
                <button key={`${amount}-${index}`} type="button" className="pl-rung pl-rung-unlocked focus-ring" onClick={onBegin} aria-label={money(amount)}>
                  <span className="ladder-step">{index + 1}</span>
                  <strong className="ladder-amount">{money(amount)}</strong>
                </button>
              );
            }
            return (
              <div key={`${amount}-${index}`} className={['pl-rung', 'pl-rung-locked', isSafe ? 'safe' : '', isTop ? 'top' : ''].join(' ')} aria-hidden="true">
                <div className="pl-rung-content">
                  <span className="ladder-step">{index + 1}</span>
                  <strong className="ladder-amount">{money(amount)}</strong>
                </div>
                <span className="pl-lock" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="10" width="16" height="11" rx="2.5" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
              </div>
            );
          }).reverse()}
        </div>
      </div>
    </section>
  );
}
