import { money } from './format';
import { MILESTONES } from './milestones';

/**
 * The cinematic prize-ladder interstitial. ONE visual: the metallic-gold
 * "$1,000,000" hero over the eight prize milestones dealing in and stacking into
 * a ladder ($1,000 → $1,000,000, the top prize glowing). Shown in two moments,
 * rendered IDENTICALLY so they can never drift apart:
 *
 *  • "deal"  — when a game starts (fades in, then the game takes over).
 *  • "climb" — when a milestone is reached mid-game. The SAME ladder; the only
 *    difference is the wrapper gently fades in AND out (`.is-climb`) so it sits as
 *    a brief mid-game beat. Same size, scale, position, rungs and prize text.
 *
 * `climbTo` is accepted for call-site compatibility but no longer changes the
 * appearance. Presentation only — never interactive.
 */
export function LaunchTransition({ mode = 'deal' }: { mode?: 'deal' | 'climb'; climbTo?: number }) {
  return (
    <div className={`launch-transition${mode === 'climb' ? ' is-climb' : ''}`} role="status" aria-live="polite">
      <div className="launch-million">
        <span className="launch-million-halo" aria-hidden="true" />
        <div className="launch-million-text">$1,000,000</div>
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
