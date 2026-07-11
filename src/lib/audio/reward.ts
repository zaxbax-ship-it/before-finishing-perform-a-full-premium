'use client';

/**
 * Reward-celebration synth (Stage 25) — three original, programmatically
 * synthesized cues for the Solo prize-ladder progression. No external or
 * copyrighted assets: everything is generated live through the shared, warm
 * AudioContext (see `acquireRewardAudio`). Respects the app mute setting and
 * browser autoplay rules (the context only resumes from a user gesture, which
 * has already happened by the time a milestone is reached).
 *
 *  • cash    — a rising success chime + a subtle metallic coin/register accent
 *  • cheer   — restrained, wordless crowd applause (band-passed noise, AM'd)
 *  • confetti— a soft pop with a light sparkling tail
 *
 * Mixing: cash is primary; cheer sits clearly underneath; the confetti pop is a
 * short accent. A shared bus with headroom prevents the combined layers from
 * clipping on phone / laptop / headphone playback.
 */

import { acquireRewardAudio } from './index';
import { celebrationPlan } from '@/lib/rewards/celebration';

let noiseBuffer: AudioBuffer | null = null;
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = Math.floor(ctx.sampleRate * 1.6);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

function tone(ctx: AudioContext, dest: AudioNode, opts: { freq: number; type: OscillatorType; at: number; attack: number; hold: number; release: number; peak: number; glideTo?: number }) {
  const osc = ctx.createOscillator();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.freq, opts.at);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, opts.at + opts.hold + opts.release);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, opts.at);
  gain.gain.exponentialRampToValueAtTime(opts.peak, opts.at + opts.attack);
  gain.gain.setValueAtTime(opts.peak, opts.at + opts.attack + opts.hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.attack + opts.hold + opts.release);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(opts.at);
  osc.stop(opts.at + opts.attack + opts.hold + opts.release + 0.03);
}

/** Premium "money earned" — rising chime (primary) + metallic coin accent. ~0.75s. */
function playCash(ctx: AudioContext, dest: AudioNode) {
  const now = ctx.currentTime + 0.01;
  // Rising success chime C5-E5-G5-C6 (primary voice).
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(ctx, dest, { freq: f, type: i < 2 ? 'triangle' : 'sine', at: now + i * 0.07, attack: 0.012, hold: 0.05, release: 0.3, peak: 0.15 });
  });
  // Metallic coin/register ping — two short band-passed partials.
  [2093, 3136].forEach((f, i) => {
    const at = now + 0.02 + i * 0.045;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = 7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.045, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
    osc.connect(bp); bp.connect(g); g.connect(dest);
    osc.start(at); osc.stop(at + 0.15);
  });
  // Crisp cash-register "chk" transient (short bright noise).
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.05, now + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  src.connect(hp); hp.connect(g); g.connect(dest);
  src.start(now); src.stop(now + 0.09);
}

/** Restrained, wordless crowd cheer — band-passed noise with a hand-clap shimmer. ~1.15s. */
function playCheer(ctx: AudioContext, dest: AudioNode) {
  const now = ctx.currentTime + 0.01;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1750;
  bp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.1, now + 0.13); // quick swell (supporting level)
  g.gain.setValueAtTime(0.1, now + 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.15); // decay
  // Amplitude modulation ~ many hands, so it reads as applause not hiss.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 12;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.03;
  lfo.connect(lfoGain); lfoGain.connect(g.gain);
  src.connect(bp); bp.connect(g); g.connect(dest);
  src.start(now); src.stop(now + 1.2);
  lfo.start(now); lfo.stop(now + 1.2);
}

/** Confetti pop — a soft low pop with a light sparkling tail. ~0.6s. */
function playConfetti(ctx: AudioContext, dest: AudioNode) {
  const now = ctx.currentTime + 0.01;
  // Pop: pitched-down sine thump.
  tone(ctx, dest, { freq: 330, type: 'sine', at: now, attack: 0.006, hold: 0.02, release: 0.14, peak: 0.12, glideTo: 90 });
  // Sparkle tail: high-passed shimmering noise.
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.09, now + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  src.connect(hp); hp.connect(g); g.connect(dest);
  src.start(now + 0.02); src.stop(now + 0.55);
}

/**
 * Play the reward celebration for a given advancement number. No-op when sound
 * is muted or the platform has no audio. Never throws (audio failures stay
 * silent). Fresh nodes per call, each self-stopping — no lingering instances.
 */
export function playRewardCelebration(advancement: number): void {
  const plan = celebrationPlan(advancement);
  try {
    const audio = acquireRewardAudio();
    if (!audio) return; // muted / unsupported
    const { ctx, destination } = audio;
    const bus = ctx.createGain();
    bus.gain.value = 0.85; // headroom so combined layers never clip
    bus.connect(destination);
    if (plan.cash) playCash(ctx, bus);
    if (plan.cheer) playCheer(ctx, bus);
    if (plan.confetti) playConfetti(ctx, bus);
  } catch {
    /* audio unavailable — stay silent, no noisy errors */
  }
}
