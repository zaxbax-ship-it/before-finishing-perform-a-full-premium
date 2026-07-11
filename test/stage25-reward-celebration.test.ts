import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { celebrationPlan, createCelebrationTracker } from '@/lib/rewards/celebration';
import { playRewardCelebration } from '@/lib/audio/reward';
import { setAudioEnabled } from '@/lib/audio';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const platform = read('src/components/TriviaPlatform.tsx');
const reward = read('src/lib/audio/reward.ts');
const confetti = read('src/components/trivia/chrome/RewardConfetti.tsx');
const audioIdx = read('src/lib/audio/index.ts');
const mp = read('src/components/multiplayer/MultiplayerMode.tsx');

describe('Stage 25 — tiered celebration policy', () => {
  it('2. first advancement = cash only', () => {
    expect(celebrationPlan(1)).toEqual({ cash: true, cheer: false, confetti: false });
  });
  it('3. second advancement = cash + cheer', () => {
    expect(celebrationPlan(2)).toEqual({ cash: true, cheer: true, confetti: false });
  });
  it('4. third advancement = cash + cheer + confetti', () => {
    expect(celebrationPlan(3)).toEqual({ cash: true, cheer: true, confetti: true });
  });
  it('5. fourth (and later) advancement = cash only', () => {
    expect(celebrationPlan(4)).toEqual({ cash: true, cheer: false, confetti: false });
    expect(celebrationPlan(6)).toEqual({ cash: true, cheer: false, confetti: false });
  });
});

describe('Stage 25 — advancement tracker', () => {
  it('counts real advancements 1,2,3,...', () => {
    const t = createCelebrationTracker();
    expect(t.advance(2)).toBe(1);
    expect(t.advance(4)).toBe(2);
    expect(t.advance(6)).toBe(3);
  });
  it('6. the same completed stage can never trigger twice', () => {
    const t = createCelebrationTracker();
    expect(t.advance(2)).toBe(1);
    expect(t.advance(2)).toBe(0); // duplicate -> no celebration
    expect(t.advance(4)).toBe(2);
  });
  it('7. a new Solo game resets the counter', () => {
    const t = createCelebrationTracker();
    t.advance(2); t.advance(4);
    t.reset();
    expect(t.advance(2)).toBe(1);
  });
});

describe('Stage 25 — trigger wiring (event-driven, never the silent intro)', () => {
  it('1. the celebration fires inside the milestone-advancement branch, tied to the completed stage id', () => {
    expect(platform).toContain('const advancement = celebrationRef.current.advance(nextCorrect);');
    // it lives right after the ladder-progression phase is entered
    const idx = platform.indexOf("setGamePhase('milestone');");
    const trig = platform.indexOf('celebrationRef.current.advance(nextCorrect)');
    expect(trig).toBeGreaterThan(idx);
  });
  it('the intro effect never plays a reward celebration', () => {
    const introEffect = platform.slice(platform.indexOf("gamePhase !== 'intro') return"), platform.indexOf("gamePhase !== 'intro') return") + 260);
    expect(introEffect).not.toContain('playRewardCelebration');
  });
  it('7/reset. the tracker is reset when a new game starts', () => {
    expect(platform).toContain('celebrationRef.current.reset();');
    expect(platform).toContain('setConfettiBurst(0);');
  });
  it('4/visual. the two-sided confetti burst is only triggered on the 3rd advancement', () => {
    expect(platform).toContain('if (advancement === 3 && settings.effects) setConfettiBurst(Date.now());');
  });
  it('11. a backgrounded tab does not replay the celebration', () => {
    expect(platform).toContain("document.visibilityState === 'visible'");
  });
  it('10. the tracker survives re-renders (a ref) and confetti uses a timestamp key', () => {
    expect(platform).toContain('useRef(createCelebrationTracker())');
    expect(platform).toContain('burstId={confettiBurst}');
  });
});

describe('Stage 25 — audio: mute + autoplay + no noisy errors', () => {
  it('8. muted sound produces no audio and never throws', () => {
    setAudioEnabled(false);
    expect(() => playRewardCelebration(1)).not.toThrow();
    expect(() => playRewardCelebration(3)).not.toThrow();
  });
  it('the synth is gated behind the mute-aware shared-context accessor', () => {
    expect(audioIdx).toContain('export function acquireRewardAudio');
    expect(audioIdx).toContain('if (!audioEnabled) return undefined;');
    expect(reward).toContain('const audio = acquireRewardAudio();');
    expect(reward).toContain('if (!audio) return;');
    // three distinct synthesized cues, no external assets
    expect(reward).toContain('function playCash');
    expect(reward).toContain('function playCheer');
    expect(reward).toContain('function playConfetti');
    expect(reward).not.toContain('new Audio(');
  });
});

describe('Stage 25 — confetti visual + reduced motion', () => {
  it('9. reduced motion minimizes the burst', () => {
    expect(confetti).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(confetti).toContain('reduced ? 5 : 16'); // far fewer particles
    expect(confetti).toContain("reduced ? ' is-reduced' : ''");
  });
  it('is self-cleaning (auto-unmount, no loop) and two-sided (gold-heavy palette)', () => {
    expect(confetti).toContain('setTimeout(() => setVisible(false)');
    expect(confetti).toContain("['left', 'right']");
    expect(confetti).toContain("'#f7ca67'"); // gold
    expect(confetti).toContain("'#45c2ff'"); // azure
  });
});

describe('Stage 25 — Multiplayer and Admin remain unchanged', () => {
  it('12. multiplayer does not use the solo reward celebration', () => {
    expect(mp).not.toContain('playRewardCelebration');
    expect(mp).not.toContain('createCelebrationTracker');
    expect(mp).not.toContain('RewardConfetti');
  });
});
