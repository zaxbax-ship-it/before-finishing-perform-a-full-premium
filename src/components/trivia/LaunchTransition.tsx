import type { CSSProperties } from 'react';
import { ASSETS } from '@/lib/assets';
import { money } from './format';
import { MILESTONES } from './milestones';

/**
 * The cinematic prize-ladder interstitial, in two modes:
 *
 *  • "deal"  — shown after a category (or the random game) is tapped, while the
 *    round is prepared. The 3D one-million-dollar hero crowns the screen and the
 *    eight prize milestones deal in one after another, stacking into a ladder.
 *
 *  • "climb" — shown when a milestone is reached mid-game. The full ladder is
 *    already in place (highest prize on top) and a single gold marker climbs one
 *    rung, from the previous prize to the new one. Fades in and out gently.
 *
 * Presentation only — never interactive.
 */
export function LaunchTransition({ mode = 'deal', climbTo }: { mode?: 'deal' | 'climb'; climbTo?: number }) {
  const total = MILESTONES.length;

  if (mode === 'climb') {
    const target = Math.max(1, Math.min(total - 1, climbTo ?? 1));
    const fromRow = total - 1 - (target - 1);
    const toRow = total - 1 - target;
    const rows = [...MILESTONES].reverse(); // highest prize on top
    const ladderStyle = { ['--from-row' as string]: fromRow, ['--to-row' as string]: toRow } as CSSProperties;
    return (
      <div className="launch-transition is-climb" role="status" aria-live="polite">
        <div className="launch-million">
          <span className="launch-million-halo" aria-hidden="true" />
          <img src={ASSETS.million3d} alt="$1,000,000" width={1024} height={334} className="launch-million-img" />
        </div>
        <div className="launch-ladder is-static" aria-hidden="true" style={ladderStyle}>
          {rows.map((milestone, row) => {
            const index = total - 1 - row;
            return (
              <div key={milestone.id} className={`launch-rung${index === target ? ' is-target' : ''}${index <= target ? ' is-reached' : ''}`}>
                <span className="launch-rung-index">{index + 1}</span>
                <span className="launch-rung-prize">{money(milestone.prize)}</span>
              </div>
            );
          })}
          <span className="launch-climber" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return (
    <div className="launch-transition" role="status" aria-live="polite">
      <div className="launch-million">
        <span className="launch-million-halo" aria-hidden="true" />
        <img src={ASSETS.million3d} alt="$1,000,000" width={1024} height={334} className="launch-million-img" />
      </div>
      <div className="launch-ladder" aria-hidden="true">
        {MILESTONES.map((milestone, index) => (
          <div
            key={milestone.id}
            className={`launch-rung${index === MILESTONES.length - 1 ? ' is-final' : ''}`}
            style={{ animationDelay: `${index * 150}ms`, zIndex: index + 1 }}
          >
            <span className="launch-rung-index">{index + 1}</span>
            <span className="launch-rung-prize">{money(milestone.prize)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
