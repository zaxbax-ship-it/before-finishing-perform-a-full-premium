/**
 * ChanceMeter — the game-show "mistake allowance" indicator.
 *
 * Three slanted gold segments (broadcast-meter style, matching the glass/gold
 * identity) that dim as chances are spent. Replaces the generic mobile-game
 * hearts. Direction-aware (the slant follows reading direction), compact
 * enough for the mobile top bar, and reusable wherever remaining chances are
 * communicated (game HUD, the extra-life dialog).
 *
 * Native mapping: a trivial HStack/Row of capsule shapes bound to
 * (total, remaining) — the same props this component takes.
 */
export function ChanceMeter({ total, remaining, label }: { total: number; remaining: number; label?: string }) {
  return (
    <span
      className="chance-meter"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={`chance-pip ${index < remaining ? 'is-active' : 'is-spent'}`} aria-hidden="true" />
      ))}
    </span>
  );
}
