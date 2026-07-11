import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const music = read('src/lib/audio/music.ts');
const audio = read('src/lib/audio/index.ts');
const platform = read('src/components/TriviaPlatform.tsx');
const css = read('src/app/globals.css');

describe('Stage 23B — adaptive music engine architecture', () => {
  it('exposes a semantic, asset-replaceable API (no waveforms in gameplay code)', () => {
    for (const fn of ['startGameMusic', 'stopGameMusic', 'setMusicIntensity', 'musicSwell', 'setMusicEnabled']) {
      expect(music).toContain(`export function ${fn}`);
    }
  });
  it('builds independent layers: a calm bed, a bass foundation, and a tension shimmer', () => {
    expect(music).toContain('BED_CHORD');
    expect(music).toContain('TENSION_TONES');
    expect(music).toContain('bassOsc');
    expect(music).toContain('tensionGain');
  });
  it('never restarts: the graph is built once and start() is idempotent', () => {
    expect(music).toContain('if (nodes) return true;');
  });
  it('intensity ramps (tension gain + filter + tremolo rate) rather than jumping', () => {
    expect(music).toContain('exponentialRampToValueAtTime');
    expect(music).toContain('tremoloLfo.frequency');
    expect(music).toContain('function applyIntensity');
  });
  it('tears down cleanly on stop — every oscillator stopped, every node disconnected', () => {
    expect(music).toContain('function teardown');
    expect(music).toContain('osc.stop(');
    expect(music).toContain('.disconnect()');
  });
  it('the music sits on a dedicated bus UNDER the SFX master', () => {
    expect(audio).toContain('musicBus');
    expect(audio).toContain('musicBus.gain.value = 0.5');
    expect(audio).toContain('export function getAudioGraph');
  });
  it('adds elegant up/down reward accents to the SFX catalog', () => {
    expect(audio).toContain("| 'reward.up'");
    expect(audio).toContain("| 'reward.down'");
    expect(audio).toContain("'reward.up':");
    expect(audio).toContain("'reward.down':");
  });
});

describe('Stage 23B — soundtrack is wired to real gameplay events', () => {
  it('starts when a game starts and stops when leaving gameplay / unmounting', () => {
    expect(platform).toContain('startGameMusic();');
    expect(platform).toContain("if (screen !== 'game') { clearSeq(); stopGameMusic(); }");
    expect(platform).toContain('clearAdvanceTimer(); stopGameMusic();');
  });
  it('intensity is driven by the live clock + phase', () => {
    expect(platform).toContain('setMusicIntensity(level);');
    expect(platform).toContain('const progress = 1 - timer / SOLO_TIMER_SECONDS;');
  });
  it('milestone reveal triggers a premium swell', () => {
    expect(platform).toContain('musicSwell();');
  });
  it('rising winnings play an upward accent; purchases play a downward accent', () => {
    expect(platform).toContain("playAudioEvent('reward.up')");
    expect(platform).toContain("playAudioEvent('reward.down')");
  });
  it('music enablement is synced with the app sound setting', () => {
    expect(platform).toContain('setMusicEnabled(settings.sound);');
  });
});

describe('Stage 23 Part 2 — money-deducted message removed', () => {
  it('no "paidDeducted" notice is shown after a purchase', () => {
    expect(platform).not.toContain('t.paidDeducted');
    expect(platform).not.toContain('setNotice(fmt(t.paidDeducted');
  });
  it('the downward reward accent replaces the removed message', () => {
    expect(platform).toContain("// Stage 23 — no \"money deducted\" message");
  });
});

describe('Stage 23 Part 4 — milestone ladder slightly larger', () => {
  it('rungs and amounts grew while the fit-guarantee clamps remain', () => {
    expect(css).toContain('.milestone-rung { min-height: clamp(32px, 7.4vh, 64px);');
    expect(css).toContain('.milestone-rungs { max-width: min(468px, 90vw);');
    expect(css).toContain('.milestone-amount { font-size: clamp(1.05rem, 3.7vw, 1.42rem);');
  });
  it('the short/landscape compression guard is still present', () => {
    expect(css).toContain('@media (max-height: 480px)');
  });
});
