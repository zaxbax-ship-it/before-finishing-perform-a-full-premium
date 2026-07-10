/**
 * Semantic haptics — the tactile counterpart of the audio engine.
 *
 * Components already emit semantic events for sound (`playAudioEvent`). The same
 * events drive short vibration patterns here, so a correct answer, a lifeline
 * purchase or the million-dollar win are *felt*, not just seen and heard. This
 * is the Web Vibration API (`navigator.vibrate`) — a real, progressive web
 * feature: it fires on Android/Chromium, and is a silent no-op where it is
 * unsupported (iOS Safari) or disabled. Future native clients map the same event
 * names to the Taptic Engine / Android HapticFeedback.
 *
 * Independent of the sound setting: haptics ride the app's "effects" toggle, so
 * players who mute sound can still feel the game (and vice-versa).
 */

import type { AudioEventName } from '@/lib/audio';

/**
 * Vibration pattern per event, in milliseconds. A single value is one buzz; an
 * array alternates vibrate/pause/vibrate… Only meaningful moments map to a
 * pattern — navigation ticks and the per-second timer are intentionally silent
 * so the motor never machine-guns. Unmapped events return null (no vibration).
 */
export const HAPTIC_PATTERNS: Partial<Record<AudioEventName, number[]>> = {
  'answer.correct': [14, 32, 16],   // light, confident success double-tap
  'answer.wrong': [46],             // one firm buzz
  'lifeline.used': [10],            // subtle confirmation
  'prize.milestone': [12, 28, 12, 28, 22],
  'game.cashout': [16, 30, 26],
  'game.victory': [22, 40, 22, 40, 70], // fanfare
  'game.defeat': [64, 32, 44],      // heavy
  'progression.levelUp': [12, 26, 26],
  'progression.achievement': [10, 22, 22],
  'ui.success': [12, 26, 14],
  'ui.error': [40]
};

/** Minimum ms between vibrations so rapid repeats never stack into a blur. */
const HAPTIC_THROTTLE_MS = 60;

let hapticsEnabled = false;
let lastVibratedAt = 0;

/** Synced from the app's "effects" setting; components then just emit events. */
export function setHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
}

/** The pattern for an event, or null when the event has no tactile meaning. */
export function resolveHapticPattern(event: AudioEventName): number[] | null {
  return HAPTIC_PATTERNS[event] ?? null;
}

/** True only where the browser actually exposes the Vibration API. */
function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Plays the haptic for a semantic event. No-op when disabled, unsupported, an
 * event has no pattern, or a vibration fired within the throttle window.
 */
export function playHaptic(event: AudioEventName) {
  if (!hapticsEnabled || !canVibrate()) return;
  const pattern = resolveHapticPattern(event);
  if (!pattern) return;
  const now = Date.now();
  if (now - lastVibratedAt < HAPTIC_THROTTLE_MS) return;
  lastVibratedAt = now;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw if called outside a user gesture — never let a
    // cosmetic buzz break gameplay.
  }
}
