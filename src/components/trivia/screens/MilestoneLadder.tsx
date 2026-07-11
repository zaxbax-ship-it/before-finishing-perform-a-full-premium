'use client';

import { MILESTONES, currentMilestoneIndex, milestoneStateFor } from '../milestones';
import { money } from '../format';

/**
 * Stage 20C — the compact milestone ladder. Eight rungs (highest at the top,
 * opening at the bottom) sized to fit one mobile viewport with no scrolling.
 * Locked rungs are softened, blurred and carry a lock; the current rung is
 * highlighted; completed rungs stay clearly done. Nothing here is focusable —
 * it is informational/cinematic only. An sr-only status announces the current
 * milestone amount (existing money text, no new visible copy).
 */
export function MilestoneLadder({ t, correct }: { t: Record<string, string>; correct: number }) {
  const current = currentMilestoneIndex(correct);
  return (
    <div className="milestone-ladder" role="group" aria-label={t.ladder}>
      <span className="sr-only" role="status" aria-live="polite">{money(MILESTONES[current].prize)}</span>
      <div className="milestone-rungs" aria-hidden="true">
        {[...MILESTONES].reverse().map(milestone => {
          const state = milestoneStateFor(milestone.id, correct);
          return (
            <div key={milestone.id} className={`milestone-rung is-${state}`}>
              <span className="milestone-rung-body">
                <span className="milestone-dot" />
                <strong className="milestone-amount">{money(milestone.prize)}</strong>
              </span>
              {state === 'locked' && (
                <span className="milestone-lock">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="10" width="16" height="11" rx="2.5" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
