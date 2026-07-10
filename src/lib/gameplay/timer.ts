/**
 * Countdown presentation model — the single source of truth for how the solo
 * question timer is *shown*, decoupled from how it is *counted*. The game still
 * owns the tick (a per-second decrement); this module turns a remaining-seconds
 * value into a normalized progress + urgency phase that any client can render
 * identically.
 *
 * Pure and dependency-free, so the web "drain" bar, the tests and future
 * SwiftUI / Jetpack Compose clients derive the same thresholds and 0..1 fill.
 * It changes nothing about the actual clock, the question duration, scoring,
 * answer evaluation or life-loss — presentation only.
 */

export type TimerUrgency = 'calm' | 'warning' | 'danger';

/**
 * Seconds-remaining thresholds for the urgency phases — the exact values the
 * former standalone ring used, now driving the Next-button progress. Kept as
 * named constants so they are deterministic and testable.
 */
export const TIMER_WARNING_SECONDS = 15;
export const TIMER_DANGER_SECONDS = 8;

export interface TimerProgressModel {
  /** The full question duration in seconds. */
  total: number;
  /** Whole seconds remaining, clamped to [0, total]. */
  remaining: number;
  /** Fraction of time remaining, 0..1 — drives the draining bar width. */
  progress: number;
  /** Colour/emphasis phase for the current remaining time. */
  urgency: TimerUrgency;
}

/** Urgency phase for a remaining-seconds value (deterministic thresholds). */
export function timerUrgencyFor(remaining: number): TimerUrgency {
  if (remaining <= TIMER_DANGER_SECONDS) return 'danger';
  if (remaining <= TIMER_WARNING_SECONDS) return 'warning';
  return 'calm';
}

/**
 * Presentation model for a countdown at `remaining` of `total` seconds. The
 * fill reaches exactly 0 when the clock expires (remaining === 0) and exactly 1
 * at the start of a question (remaining === total).
 */
export function timerProgress(total: number, remaining: number): TimerProgressModel {
  const clamped = Math.max(0, Math.min(total, remaining));
  return {
    total,
    remaining: clamped,
    progress: total > 0 ? clamped / total : 0,
    urgency: timerUrgencyFor(clamped)
  };
}
