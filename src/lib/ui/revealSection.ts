/**
 * Reusable "reveal" behavior for dynamically opened sections.
 *
 * When a section opens on the same page (screen switch, phase change), the
 * viewport often stays where it was and the new content renders out of view.
 * This utility scrolls the section's heading into view — accounting for the
 * fixed top utility bar — and moves keyboard/screen-reader focus to it,
 * without visible focus artifacts for mouse users (the target uses
 * tabIndex={-1} and an outline-suppressing class).
 *
 * Rules implemented:
 *  - If the section top is already fully visible, no scrolling happens.
 *  - One smooth scroll only; honors prefers-reduced-motion (jumps instantly).
 *  - Focus is applied with preventScroll so it never causes a second scroll.
 */

/** Height reserved for the fixed top utility bar plus breathing room. */
const FIXED_BAR_OFFSET_PX = 84;

export function revealSection(element: HTMLElement | null) {
  if (!element || typeof window === 'undefined') return;

  // Wait one frame so the newly rendered section has a final layout.
  window.requestAnimationFrame(() => {
    const rect = element.getBoundingClientRect();
    const topIsVisible = rect.top >= 0 && rect.top <= window.innerHeight * 0.4;

    if (!topIsVisible) {
      const targetTop = Math.max(0, rect.top + window.scrollY - FIXED_BAR_OFFSET_PX);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: targetTop, behavior: reducedMotion ? 'auto' : 'smooth' });
    }

    // Focus for keyboard and screen-reader users; preventScroll avoids a
    // competing native scroll. tabIndex={-1} targets show no mouse outline.
    element.focus({ preventScroll: true });
  });
}
