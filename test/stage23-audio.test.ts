import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const audio = read('src/lib/audio/index.ts');
const platform = read('src/components/TriviaPlatform.tsx');
const css = read('src/app/globals.css');

describe('Stage 23 — money-change sound effects (kept; these are SFX, not music)', () => {
  it('the SFX catalog keeps the elegant up/down reward accents', () => {
    expect(audio).toContain("| 'reward.up'");
    expect(audio).toContain("| 'reward.down'");
    expect(audio).toContain("'reward.up':");
    expect(audio).toContain("'reward.down':");
  });
  it('rising winnings play an upward accent; purchases play a downward accent', () => {
    expect(platform).toContain("playAudioEvent('reward.up')");
    expect(platform).toContain("playAudioEvent('reward.down')");
  });
});

describe('Stage 23B rollback — the dynamic background-music engine is gone', () => {
  it('no music engine module remains', () => {
    let exists = true;
    try { read('src/lib/audio/music.ts'); } catch { exists = false; }
    expect(exists).toBe(false);
  });
  it('no music symbols are referenced in gameplay code', () => {
    for (const s of ['startGameMusic', 'stopGameMusic', 'setMusicIntensity', 'musicSwell', 'setMusicEnabled', 'getAudioGraph', 'audio/music']) {
      expect(platform.includes(s)).toBe(false);
    }
  });
  it('the SFX engine drops the music bus + graph accessors', () => {
    expect(audio.includes('musicBus')).toBe(false);
    expect(audio.includes('getAudioGraph')).toBe(false);
    expect(audio.includes('isAudioEnabled')).toBe(false);
  });
  it('the pre-existing SFX engine and mute behaviour are intact', () => {
    expect(platform).toContain('setAudioEnabled(settings.sound);');
    expect(audio).toContain('export function playAudioEvent');
    expect(audio).toContain('playHaptic(event)');
    // core pre-existing cues still emitted
    expect(platform).toContain("playAudioEvent('game.start')");
    expect(platform).toContain("playAudioEvent('prize.milestone')");
  });
});

describe('Stage 23 Part 2 — money-deducted message removed (kept improvement)', () => {
  it('no "paidDeducted" notice is shown after a purchase', () => {
    expect(platform).not.toContain('t.paidDeducted');
  });
});

describe('Stage 23 Part 4 — milestone ladder size (kept improvement)', () => {
  it('rungs/amounts and the fit-guarantee clamps remain', () => {
    expect(css).toContain('.milestone-rung { min-height: clamp(32px, 7.4vh, 64px);');
    expect(css).toContain('@media (max-height: 480px)');
  });
});
