/**
 * Semantic audio engine — the product's sound design in one place.
 *
 * Components emit *events* (never waveforms): `playAudioEvent('answer.correct')`.
 * The catalog below is the cross-platform contract — future SwiftUI and
 * Jetpack Compose apps map the same event names to bundled audio assets
 * (e.g. `answer.correct` -> answer_correct.caf / answer_correct.ogg), so the
 * soundscape stays identical across clients.
 *
 * Design language: soft attack / long release sine-and-triangle voices behind
 * a gentle low-pass — cinematic television production, never arcade. Volume
 * hierarchy: UI ticks are whispers (~0.04), gameplay feedback speaks (~0.09),
 * fanfares sing (~0.12). A per-event throttle prevents machine-gun repeats.
 */

import { playHaptic } from '@/lib/haptics';

export type AudioEventName =
  | 'ui.tap'              // any small interaction (navigation, buttons)
  | 'ui.open'             // drawer / menu opens
  | 'ui.close'            // drawer / menu closes
  | 'ui.success'          // generic success feedback (forms, submissions)
  | 'ui.error'            // generic error feedback
  | 'ui.notice'           // neutral notice (sent for review, etc.)
  | 'game.start'          // a round begins
  | 'answer.correct'      // correct answer reveal
  | 'answer.wrong'        // wrong answer reveal
  | 'timer.tick'          // final-seconds countdown tick
  | 'timer.expired'       // the clock ran out
  | 'prize.milestone'     // a guaranteed prize rung was secured
  | 'game.cashout'        // player walks away with the pot
  | 'game.victory'        // the million — full fanfare
  | 'game.defeat'         // out of chances
  | 'lifeline.used'       // a lifeline activates
  | 'reward.up'           // winnings increase — small elegant upward accent
  | 'reward.down'         // winnings decrease (purchase) — soft downward accent
  | 'progression.levelUp' // player level increased
  | 'progression.achievement'; // achievement unlocked

type Voice = {
  /** Frequency in Hz. */
  freq: number;
  /** Seconds after the event start. */
  at?: number;
  /** Sustain length in seconds (release is added on top). */
  hold?: number;
  type?: OscillatorType;
  /** Peak gain for this voice. */
  peak?: number;
  attack?: number;
  release?: number;
};

/** The sound design per event: layered voices, timed like small cues. */
const EVENT_VOICES: Record<AudioEventName, Voice[]> = {
  'ui.tap': [
    { freq: 880, hold: 0.03, peak: 0.035, release: 0.08 },
    { freq: 1760, hold: 0.02, peak: 0.012, release: 0.06 }
  ],
  'ui.open': [
    { freq: 523, hold: 0.05, peak: 0.04, release: 0.14 },
    { freq: 659, at: 0.07, hold: 0.06, peak: 0.045, release: 0.18 }
  ],
  'ui.close': [
    { freq: 659, hold: 0.05, peak: 0.04, release: 0.14 },
    { freq: 523, at: 0.07, hold: 0.06, peak: 0.04, release: 0.18 }
  ],
  'ui.success': [
    { freq: 392, hold: 0.08, peak: 0.055, release: 0.25 },
    { freq: 494, at: 0.09, hold: 0.08, peak: 0.06, release: 0.28 },
    { freq: 587, at: 0.18, hold: 0.12, peak: 0.065, release: 0.4 }
  ],
  'ui.error': [
    { freq: 220, hold: 0.09, peak: 0.055, release: 0.22 },
    { freq: 196, at: 0.14, hold: 0.12, peak: 0.05, release: 0.34 }
  ],
  'ui.notice': [
    { freq: 523, hold: 0.09, peak: 0.05, release: 0.3 },
    { freq: 659, at: 0.02, hold: 0.09, peak: 0.035, release: 0.3 }
  ],
  'game.start': [
    { freq: 196, hold: 0.1, peak: 0.06, release: 0.3 },
    { freq: 294, at: 0.12, hold: 0.1, peak: 0.07, release: 0.3 },
    { freq: 392, at: 0.24, hold: 0.12, peak: 0.08, release: 0.4 },
    { freq: 494, at: 0.36, hold: 0.18, peak: 0.08, release: 0.6 }
  ],
  'answer.correct': [
    { freq: 523, hold: 0.07, peak: 0.075, release: 0.3 },
    { freq: 659, at: 0.09, hold: 0.07, peak: 0.08, release: 0.32 },
    { freq: 784, at: 0.18, hold: 0.14, peak: 0.085, release: 0.5 },
    { freq: 1568, at: 0.2, hold: 0.1, peak: 0.02, release: 0.55, type: 'triangle' }
  ],
  'answer.wrong': [
    { freq: 220, hold: 0.14, peak: 0.06, release: 0.4 },
    { freq: 175, at: 0.16, hold: 0.2, peak: 0.055, release: 0.55 }
  ],
  'timer.tick': [
    { freq: 1000, hold: 0.015, peak: 0.03, attack: 0.004, release: 0.05, type: 'triangle' }
  ],
  'timer.expired': [
    { freq: 294, hold: 0.12, peak: 0.065, release: 0.35 },
    { freq: 220, at: 0.16, hold: 0.12, peak: 0.06, release: 0.4 },
    { freq: 147, at: 0.32, hold: 0.24, peak: 0.055, release: 0.7 }
  ],
  'prize.milestone': [
    { freq: 294, hold: 0.12, peak: 0.06, release: 0.35 },
    { freq: 392, at: 0.02, hold: 0.12, peak: 0.06, release: 0.35 },
    { freq: 494, at: 0.2, hold: 0.16, peak: 0.07, release: 0.5 },
    { freq: 587, at: 0.22, hold: 0.18, peak: 0.05, release: 0.6 }
  ],
  'game.cashout': [
    { freq: 392, hold: 0.09, peak: 0.065, release: 0.3 },
    { freq: 330, at: 0.11, hold: 0.09, peak: 0.06, release: 0.3 },
    { freq: 392, at: 0.22, hold: 0.09, peak: 0.065, release: 0.32 },
    { freq: 523, at: 0.33, hold: 0.2, peak: 0.075, release: 0.6 }
  ],
  'game.victory': [
    { freq: 262, hold: 0.12, peak: 0.08, release: 0.4 },
    { freq: 392, at: 0.14, hold: 0.12, peak: 0.09, release: 0.45 },
    { freq: 523, at: 0.28, hold: 0.14, peak: 0.1, release: 0.5 },
    { freq: 659, at: 0.42, hold: 0.16, peak: 0.1, release: 0.6 },
    { freq: 784, at: 0.56, hold: 0.3, peak: 0.11, release: 0.9 },
    { freq: 1568, at: 0.6, hold: 0.24, peak: 0.025, release: 1.0, type: 'triangle' }
  ],
  'game.defeat': [
    { freq: 262, hold: 0.2, peak: 0.06, release: 0.5 },
    { freq: 196, at: 0.05, hold: 0.24, peak: 0.055, release: 0.6 },
    { freq: 131, at: 0.3, hold: 0.4, peak: 0.05, release: 1.0 }
  ],
  'lifeline.used': [
    { freq: 880, hold: 0.04, peak: 0.045, release: 0.16 },
    { freq: 1175, at: 0.06, hold: 0.04, peak: 0.045, release: 0.18 },
    { freq: 1568, at: 0.12, hold: 0.07, peak: 0.04, release: 0.3 }
  ],
  'reward.up': [
    { freq: 659, hold: 0.05, peak: 0.05, release: 0.2 },
    { freq: 988, at: 0.08, hold: 0.08, peak: 0.042, release: 0.3 }
  ],
  'reward.down': [
    { freq: 494, hold: 0.06, peak: 0.05, release: 0.22 },
    { freq: 330, at: 0.09, hold: 0.12, peak: 0.04, release: 0.36 }
  ],
  'progression.levelUp': [
    { freq: 392, hold: 0.08, peak: 0.07, release: 0.3 },
    { freq: 523, at: 0.1, hold: 0.09, peak: 0.075, release: 0.35 },
    { freq: 1047, at: 0.22, hold: 0.16, peak: 0.055, release: 0.6 }
  ],
  'progression.achievement': [
    { freq: 659, hold: 0.08, peak: 0.06, release: 0.35 },
    { freq: 880, at: 0.11, hold: 0.16, peak: 0.065, release: 0.6 },
    { freq: 1760, at: 0.13, hold: 0.1, peak: 0.018, release: 0.7, type: 'triangle' }
  ]
};

/** Minimum ms between repeats of the same event (ticks pace themselves). */
const THROTTLE_MS: Partial<Record<AudioEventName, number>> = { 'timer.tick': 0 };
const DEFAULT_THROTTLE_MS = 80;

let audioEnabled = false;
let sharedContext: AudioContext | undefined;
let masterGain: GainNode | undefined;
// Stage 23B — a separate, quieter bus for the adaptive music bed so it always
// sits UNDER the SFX (buttons, rewards, milestones) through the same warm filter.
let musicBus: GainNode | undefined;
const lastPlayed = new Map<AudioEventName, number>();

/** Synced from the app's sound setting; components then just emit events. */
export function setAudioEnabled(enabled: boolean) {
  audioEnabled = enabled;
}

function ensureContext(): { ctx: AudioContext; master: GainNode; music: GainNode } | undefined {
  if (typeof window === 'undefined') return undefined;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return undefined;
  if (!sharedContext) {
    sharedContext = new Ctor();
    // One master chain: gentle low-pass keeps every cue warm, never piercing.
    const filter = sharedContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 6500;
    masterGain = sharedContext.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(filter);
    musicBus = sharedContext.createGain();
    musicBus.gain.value = 0.5; // music mixed clearly below the SFX master
    musicBus.connect(filter);
    filter.connect(sharedContext.destination);
  }
  if (sharedContext.state === 'suspended') void sharedContext.resume();
  return masterGain && musicBus ? { ctx: sharedContext, master: masterGain, music: musicBus } : undefined;
}

/** Shared audio graph for the adaptive music director (creates/resumes the
 * context — call only from a user gesture or once a game is already running). */
export function getAudioGraph(): { ctx: AudioContext; music: GainNode; sfx: GainNode } | undefined {
  const a = ensureContext();
  return a ? { ctx: a.ctx, music: a.music, sfx: a.master } : undefined;
}

/** Whether sound is currently enabled (mirrors the app sound setting). */
export function isAudioEnabled(): boolean {
  return audioEnabled;
}

/** Plays a semantic audio event (no-op when sound is off or unsupported). */
export function playAudioEvent(event: AudioEventName) {
  // Fire the matching haptic first, independent of the sound setting: a player
  // who muted audio should still feel the game (haptics ride the effects flag).
  playHaptic(event);
  if (!audioEnabled) return;
  const now = Date.now();
  const throttle = THROTTLE_MS[event] ?? DEFAULT_THROTTLE_MS;
  const last = lastPlayed.get(event) || 0;
  if (throttle > 0 && now - last < throttle) return;
  lastPlayed.set(event, now);

  const audio = ensureContext();
  if (!audio) return;
  const { ctx, master } = audio;
  const base = ctx.currentTime + 0.01;
  for (const voice of EVENT_VOICES[event]) {
    const start = base + (voice.at || 0);
    const attack = voice.attack ?? 0.015;
    const hold = voice.hold ?? 0.08;
    const release = voice.release ?? 0.2;
    const peak = voice.peak ?? 0.06;

    const oscillator = ctx.createOscillator();
    oscillator.type = voice.type || 'sine';
    oscillator.frequency.value = voice.freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.setValueAtTime(peak, start + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + attack + hold + release + 0.05);
  }
}
