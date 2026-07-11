'use client';

/**
 * Adaptive game-show music director — Stage 23B.
 *
 * This is NOT a looping track. It is a continuous, evolving cinematic bed that
 * is built ONCE when a game starts and then only *ramps* — its layers never
 * restart, so the player almost forgets the music is changing. Everything sits
 * UNDER the SFX bus (see `music` gain in `@/lib/audio`), so button, reward and
 * milestone cues always cut through.
 *
 * Architecture — independently replaceable layers:
 *   • bed      — a slow warm pad chord (calm anticipation, always present)
 *   • bass     — a low sustained foundation with a gentle swell LFO
 *   • tension  — a brighter shimmer whose gain + tremolo-rate + filter rise
 *                with `intensity` (0 calm → 1 final seconds). "More tense,
 *                not louder."
 * Each layer is its own node group behind a single gain, so a real recorded
 * stem (bed.ogg / tension.ogg …) can replace any layer later by swapping how
 * that one gain is fed — gameplay code only ever calls the semantic API below
 * (`startGameMusic`, `setMusicIntensity`, `musicSwell`, `stopGameMusic`).
 *
 * Autoplay/perf: the shared AudioContext is only created/resumed from a user
 * gesture (starting a game). Muting tears the graph down; leaving gameplay
 * stops it. No overlapping duplicates (idempotent start), no leaks (every node
 * is disconnected and every oscillator stopped on teardown).
 */

import { getAudioGraph } from './index';

type LayerNodes = {
  bedOsc: OscillatorNode[];
  bedGain: GainNode;
  bedFilter: BiquadFilterNode;
  bassOsc: OscillatorNode;
  bassGain: GainNode;
  bassLfo: OscillatorNode;
  bassLfoGain: GainNode;
  tensionOsc: OscillatorNode[];
  tensionGain: GainNode;
  tensionFilter: BiquadFilterNode;
  tremoloLfo: OscillatorNode;
  tremoloGain: GainNode;
  tremoloDepth: GainNode;
};

// C-minor-9 flavoured, warm and neutral — a "thinking" chord, never cheerful,
// never ominous. Frequencies in Hz.
const BED_CHORD = [130.81, 155.56, 196.0, 261.63]; // C3 Eb3 G3 C4
const TENSION_TONES = [523.25, 622.25]; // C5, Eb5 — a soft rising tension dyad
const BASS_HZ = 65.41; // C2

const BED_PEAK = 0.05;
const BASS_PEAK = 0.045;
const TENSION_PEAK = 0.055;

let nodes: LayerNodes | null = null;
let enabled = false;
let active = false; // a game is in progress (music should exist while enabled)
let currentIntensity = 0;

function build(): boolean {
  if (nodes) return true;
  const graph = getAudioGraph();
  if (!graph) return false;
  const { ctx, music } = graph;
  const now = ctx.currentTime;

  // ---- bed pad ----
  const bedFilter = ctx.createBiquadFilter();
  bedFilter.type = 'lowpass';
  bedFilter.frequency.value = 720;
  bedFilter.Q.value = 0.6;
  const bedGain = ctx.createGain();
  bedGain.gain.setValueAtTime(0.0001, now);
  bedGain.gain.exponentialRampToValueAtTime(BED_PEAK, now + 1.4); // calm fade-in
  bedGain.connect(bedFilter);
  bedFilter.connect(music);
  const bedOsc = BED_CHORD.map((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = i === 0 ? 'sine' : 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = (i - 1.5) * 4; // gentle chorus spread
    osc.connect(bedGain);
    osc.start(now);
    return osc;
  });

  // ---- bass foundation + slow swell ----
  const bassGain = ctx.createGain();
  bassGain.gain.setValueAtTime(0.0001, now);
  bassGain.gain.exponentialRampToValueAtTime(BASS_PEAK, now + 1.8);
  bassGain.connect(music);
  const bassOsc = ctx.createOscillator();
  bassOsc.type = 'sine';
  bassOsc.frequency.value = BASS_HZ;
  bassOsc.connect(bassGain);
  bassOsc.start(now);
  const bassLfo = ctx.createOscillator();
  bassLfo.frequency.value = 0.08; // very slow breathing
  const bassLfoGain = ctx.createGain();
  bassLfoGain.gain.value = BASS_PEAK * 0.5;
  bassLfo.connect(bassLfoGain);
  bassLfoGain.connect(bassGain.gain);
  bassLfo.start(now);

  // ---- tension shimmer (gain starts silent; rises with intensity) ----
  const tensionFilter = ctx.createBiquadFilter();
  tensionFilter.type = 'lowpass';
  tensionFilter.frequency.value = 900;
  tensionFilter.Q.value = 0.8;
  const tensionGain = ctx.createGain();
  tensionGain.gain.setValueAtTime(0.0001, now);
  tensionGain.connect(tensionFilter);
  tensionFilter.connect(music);
  const tensionOsc = TENSION_TONES.map((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = i === 0 ? -3 : 5;
    osc.connect(tensionGain);
    osc.start(now);
    return osc;
  });
  // Tremolo: modulates the tension gain; rate climbs with intensity => "pulse".
  const tremoloDepth = ctx.createGain();
  tremoloDepth.gain.value = 0.0; // depth scales with intensity
  const tremoloGain = ctx.createGain();
  tremoloGain.gain.value = 1;
  const tremoloLfo = ctx.createOscillator();
  tremoloLfo.type = 'sine';
  tremoloLfo.frequency.value = 1.4;
  tremoloLfo.connect(tremoloDepth);
  tremoloDepth.connect(tensionGain.gain);
  tremoloLfo.start(now);

  nodes = {
    bedOsc, bedGain, bedFilter,
    bassOsc, bassGain, bassLfo, bassLfoGain,
    tensionOsc, tensionGain, tensionFilter,
    tremoloLfo, tremoloGain, tremoloDepth
  };
  applyIntensity(currentIntensity, 0.4);
  return true;
}

function applyIntensity(level: number, ramp = 0.6) {
  if (!nodes) return;
  const graph = getAudioGraph();
  if (!graph) return;
  const { ctx } = graph;
  const now = ctx.currentTime;
  const x = Math.max(0, Math.min(1, level));
  // Tension voice swells with intensity (kept modest — never louder than SFX).
  const target = Math.max(0.0001, x * TENSION_PEAK);
  nodes.tensionGain.gain.cancelScheduledValues(now);
  nodes.tensionGain.gain.setValueAtTime(Math.max(0.0001, nodes.tensionGain.gain.value), now);
  nodes.tensionGain.gain.exponentialRampToValueAtTime(target, now + ramp);
  // Brighter filter = more urgent, without extra loudness.
  nodes.tensionFilter.frequency.cancelScheduledValues(now);
  nodes.tensionFilter.frequency.linearRampToValueAtTime(900 + x * 1500, now + ramp);
  nodes.bedFilter.frequency.cancelScheduledValues(now);
  nodes.bedFilter.frequency.linearRampToValueAtTime(700 + x * 500, now + ramp);
  // Pulse quickens and deepens as time runs out.
  nodes.tremoloLfo.frequency.cancelScheduledValues(now);
  nodes.tremoloLfo.frequency.linearRampToValueAtTime(1.4 + x * 4.6, now + ramp);
  nodes.tremoloDepth.gain.cancelScheduledValues(now);
  nodes.tremoloDepth.gain.linearRampToValueAtTime(target * 0.6 * x, now + ramp);
}

function teardown(fade = 0.6) {
  const snapshot = nodes;
  nodes = null;
  if (!snapshot) return;
  const graph = getAudioGraph();
  if (!graph) return;
  const { ctx } = graph;
  const now = ctx.currentTime;
  for (const g of [snapshot.bedGain, snapshot.bassGain, snapshot.tensionGain]) {
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + fade);
  }
  const stopAt = now + fade + 0.05;
  const allOsc = [...snapshot.bedOsc, snapshot.bassOsc, snapshot.bassLfo, ...snapshot.tensionOsc, snapshot.tremoloLfo];
  for (const osc of allOsc) {
    try { osc.stop(stopAt); } catch { /* already stopped */ }
  }
  // Disconnect the whole group shortly after the fade so nothing leaks.
  window.setTimeout(() => {
    for (const osc of allOsc) { try { osc.disconnect(); } catch { /* noop */ } }
    for (const g of [snapshot.bedGain, snapshot.bassGain, snapshot.tensionGain, snapshot.bassLfoGain, snapshot.tremoloGain, snapshot.tremoloDepth]) {
      try { g.disconnect(); } catch { /* noop */ }
    }
    try { snapshot.bedFilter.disconnect(); } catch { /* noop */ }
    try { snapshot.tensionFilter.disconnect(); } catch { /* noop */ }
  }, (fade + 0.15) * 1000);
}

/** Begin (or resume) the adaptive bed. Idempotent — no overlapping duplicates. */
export function startGameMusic() {
  active = true;
  currentIntensity = 0.12;
  if (!enabled) return;
  build();
}

/** Stop the music for good (leaving gameplay / game over). Graceful fade-out. */
export function stopGameMusic() {
  active = false;
  currentIntensity = 0;
  teardown();
}

/** 0 (calm) → 1 (final-seconds tension). Smoothly ramped; never restarts. */
export function setMusicIntensity(level: number) {
  currentIntensity = Math.max(0, Math.min(1, level));
  if (!enabled || !active) return;
  if (!nodes) { build(); return; }
  applyIntensity(currentIntensity);
}

/** A brief premium orchestral rise for the milestone/prize reveal. */
export function musicSwell() {
  if (!enabled || !nodes) return;
  const graph = getAudioGraph();
  if (!graph) return;
  const { ctx, music } = graph;
  const now = ctx.currentTime;
  // Lift the bed momentarily...
  nodes.bedGain.gain.cancelScheduledValues(now);
  nodes.bedGain.gain.setValueAtTime(Math.max(0.0001, nodes.bedGain.gain.value), now);
  nodes.bedGain.gain.exponentialRampToValueAtTime(BED_PEAK * 2.1, now + 0.25);
  nodes.bedGain.gain.exponentialRampToValueAtTime(BED_PEAK, now + 1.8);
  // ...and add a short rising sweep that resolves upward.
  const sweep = ctx.createOscillator();
  sweep.type = 'triangle';
  sweep.frequency.setValueAtTime(196, now);
  sweep.frequency.exponentialRampToValueAtTime(523.25, now + 0.9);
  const sweepGain = ctx.createGain();
  sweepGain.gain.setValueAtTime(0.0001, now);
  sweepGain.gain.exponentialRampToValueAtTime(0.05, now + 0.4);
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
  sweep.connect(sweepGain);
  sweepGain.connect(music);
  sweep.start(now);
  sweep.stop(now + 1.5);
}

/** Synced from the app sound setting. Off → tear down; on mid-game → rebuild. */
export function setMusicEnabled(value: boolean) {
  enabled = value;
  if (!enabled) { teardown(0.3); return; }
  if (active) build();
}
