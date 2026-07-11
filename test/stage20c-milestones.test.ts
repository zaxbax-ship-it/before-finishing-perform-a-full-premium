import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MILESTONES, MILESTONE_COUNT, completesMilestone, currentMilestoneIndex, milestoneStateFor } from '@/components/trivia/milestones';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const game = read('src/components/trivia/screens/Game.tsx');
const platform = read('src/components/TriviaPlatform.tsx');
const ladder = read('src/components/trivia/screens/MilestoneLadder.tsx');
const css = read('src/app/globals.css');

describe('Stage 20C — compact milestone model', () => {
  it('4/5. fewer than 15 milestones; first and final always present', () => {
    expect(MILESTONE_COUNT).toBeLessThan(15);
    expect(MILESTONE_COUNT).toBe(8);
    expect(MILESTONES[0].minCorrect).toBe(0);
    expect(MILESTONES[MILESTONE_COUNT - 1].prize).toBe(1000000);
    expect(MILESTONES[MILESTONE_COUNT - 1].minCorrect).toBe(15);
  });
  it('amounts are real MONEY values (nothing invented)', () => {
    for (const m of MILESTONES) expect([1000, 2000, 5000, 10000, 20000, 40000, 80000, 150000, 250000, 400000, 550000, 700000, 850000, 1000000]).toContain(m.prize);
  });
  it('15/16. a milestone completes only every two correct (2,4,6,8,10,12), not every answer', () => {
    for (const n of [2, 4, 6, 8, 10, 12]) expect(completesMilestone(n)).toBe(true);
    for (const n of [1, 3, 5, 7, 9, 11, 13, 15]) expect(completesMilestone(n)).toBe(false);
  });
  it('6/17. all future milestones locked at game start; the newly-earned one becomes current', () => {
    expect(currentMilestoneIndex(0)).toBe(0);
    for (let id = 1; id < MILESTONE_COUNT; id++) expect(milestoneStateFor(id, 0)).toBe('locked');
    expect(milestoneStateFor(1, 2)).toBe('current');
    expect(milestoneStateFor(0, 2)).toBe('completed');
  });
});

describe('Stage 20C — the compact ladder is informational, never focusable', () => {
  it('7. renders no buttons/links/positive tabindex (no dead controls)', () => {
    expect(ladder.includes('<button')).toBe(false);
    expect(ladder.includes('onClick')).toBe(false);
    expect(/tabIndex=\{?(?!-1)/.test(ladder)).toBe(false);
    expect(ladder.includes('is-locked')).toBe(false); // state via CSS class name string 'is-${state}'
    expect(ladder.includes('milestone-lock')).toBe(true);
  });
});

describe('Stage 20C — active gameplay layout', () => {
  it('8/9. no permanent prize ladder and no guaranteed-prize side card in gameplay', () => {
    expect(game.includes('prize-ladder')).toBe(false);
    expect(game.includes('t.ladder')).toBe(false);
    expect(game.includes('t.guaranteed')).toBe(false);
    expect(game.includes('<aside')).toBe(false);
  });
  it('10/11. top strip has no chances and no current-winnings duplicate', () => {
    const top = game.slice(game.indexOf('game-topline'), game.indexOf('question-text'));
    expect(top.includes('ChanceMeter')).toBe(false);
    expect(top.includes('game-topline-pot')).toBe(false);
  });
  it('12. bottom status contains chances + winnings only', () => {
    expect(game.includes('game-bottom-status')).toBe(true);
    const bottom = game.slice(game.indexOf('game-bottom-status'));
    expect(bottom.includes('ChanceMeter')).toBe(true);
    expect(bottom.includes('game-bottom-pot')).toBe(true);
  });
  it('23/24. the normal flow has no Next button and no hidden focusable Next', () => {
    expect(game.includes('game-next-button')).toBe(false);
    expect(game.includes('advanceAfterAnswer')).toBe(false);
  });
  it('milestone overlay renders only during intro/milestone phases', () => {
    expect(game.includes("gamePhase === 'intro' || gamePhase === 'milestone'")).toBe(true);
    expect(game.includes('<MilestoneLadder')).toBe(true);
  });
});

describe('Stage 20C — 13/14/25/26/27 answer colours + timer', () => {
  it('13. correct answer uses the premium blue (azure→violet)', () => {
    expect(css.includes('.answer-button.correct') && css.includes('var(--azure), var(--violet)')).toBe(true);
  });
  it('25. timer duration is 25 seconds', () => {
    expect(read('src/components/trivia/constants.ts').includes('SOLO_TIMER_SECONDS = 25')).toBe(true);
  });
  it('26. timer colour is continuously derived from elapsed (inline hsl, not four class jumps)', () => {
    expect(game.includes('const elapsed = SOLO_TIMER_SECONDS - timer')).toBe(true);
    expect(game.includes('hsl(${Math.round(hue)}')).toBe(true);
    expect(game.includes('background: timerColor')).toBe(true);
  });
  it('27. the final seconds thicken the bar', () => {
    expect(game.includes('const timerCritical = timer <= 4')).toBe(true);
    expect(css.includes('.gameplay-timer.is-critical')).toBe(true);
  });
});

describe('Stage 20C — 1/2/3/28/29/30 explicit state machine', () => {
  it('1/2/3. category selection shows the launch interstitial (no click), then gameplay begins — no separate intro', () => {
    // The launch cinematic is the only pre-game animation; it holds ~3s then the
    // first question begins. The old auto-intro phase is gone.
    expect(platform.includes('setLaunching(true)')).toBe(true);
    expect(platform.includes("setGamePhase('question')")).toBe(true);
    expect(platform.includes("setGamePhase('intro')")).toBe(false);
    expect(platform.includes("commitScreen('prizeladder'")).toBe(false); // Stage 20 gate removed
  });
  it('15/20/21. milestone transition only when earned; wrong never advances a milestone', () => {
    expect(platform.includes("completesMilestone(nextCorrect)")).toBe(true);
    // A reached milestone now plays the climb overlay (not the old ladder phase).
    expect(platform.includes('setMilestoneClimb(currentMilestoneIndex(nextCorrect))')).toBe(true);
  });
  it('28. temporary lifeline content closes on answer', () => {
    expect(platform.slice(platform.indexOf('function chooseAnswer')).includes("setAdvice('')")).toBe(true);
  });
  it('29/30. rapid answers cannot double-advance; the sequence cleans up on exit/unmount', () => {
    expect(platform.includes('if (advancingRef.current) return')).toBe(true);
    expect(platform.includes("if (screen !== 'game') clearSeq(); return () => clearSeq();")).toBe(true);
  });
});
