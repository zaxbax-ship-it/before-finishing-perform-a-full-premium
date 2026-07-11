import { ASSETS } from '@/lib/assets';
import { money } from './format';
import { MILESTONES } from './milestones';

/**
 * The cinematic "dealing the round" interstitial shown after a category (or the
 * random game) is tapped, while the question set is prepared. The official 3D
 * one-million-dollar hero asset crowns the top of the screen, and the eight
 * prize milestones deal in one after another, elegantly stacking into a ladder
 * that climbs toward the $1,000,000 rung. Presentation only — no interaction.
 */
export function LaunchTransition({ caption }: { caption?: string }) {
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
      {caption && <p className="launch-caption">{caption}</p>}
    </div>
  );
}
