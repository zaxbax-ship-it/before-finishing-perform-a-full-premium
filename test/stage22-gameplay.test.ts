import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CORRECT_FEEDBACK_MS,
  WRONG_FEEDBACK_MS,
  MILESTONE_FEEDBACK_MS,
  MILESTONE_HOLD_MS,
  MILESTONE_EXIT_MS
} from '@/components/trivia/constants';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const game = read('src/components/trivia/screens/Game.tsx');
const platform = read('src/components/TriviaPlatform.tsx');
const css = read('src/app/globals.css');
const multiplayer = read('src/components/multiplayer/MultiplayerMode.tsx');

describe('Stage 22 — 1/4: milestone view uses the Home stage background', () => {
  it('drops the dark scrim + blur so the app-shell Home background shows through', () => {
    expect(css).toContain('.milestone-focus {\n  background: transparent;');
    // the ladder view clears the glass card to the identical Home stage
    expect(css).toContain('.question-priority.stage-clear');
    expect(game).toContain("showLadder ? 'stage-clear' : ''");
  });
  it('no separate/new background language: the ladder just sits on the app-shell', () => {
    // the receded gameplay is fully hidden during the ladder
    expect(css).toContain('.gameplay-stage.is-receded { opacity: 0; }');
    // no bespoke panel/grid/texture was introduced for the milestone
    expect(css).not.toContain('milestone-pattern');
    expect(css).not.toContain('milestone-grid');
  });
});

describe('Stage 22 — 2: enlarged, viewport-centred ladder', () => {
  it('the overlay is a fixed full-viewport layer centred on both axes', () => {
    expect(css).toContain('.milestone-focus { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center;');
  });
  it('the rungs are enlarged (clamped) and still cap to one frame', () => {
    expect(css).toContain('.milestone-rungs { max-width: min(468px, 90vw);');
    expect(css).toContain('.milestone-rung { min-height: clamp(32px, 7.4vh, 64px);');
  });
});

describe('Stage 22 — 3: the milestone transition is a calm >= 2.5s sequence', () => {
  it('ladder stays visible (hold + exit) for at least 2.5 seconds', () => {
    expect(MILESTONE_HOLD_MS + MILESTONE_EXIT_MS).toBeGreaterThanOrEqual(2500);
  });
  it('the enter/hold/exit envelope lands ~2.6-2.8s of ladder + readable verdict', () => {
    const total = MILESTONE_FEEDBACK_MS + MILESTONE_HOLD_MS + MILESTONE_EXIT_MS;
    expect(total).toBeGreaterThanOrEqual(2500);
    expect(MILESTONE_EXIT_MS).toBeGreaterThanOrEqual(550);
    expect(MILESTONE_EXIT_MS).toBeLessThanOrEqual(700);
  });
  it('4: entrance and exit are non-abrupt (distinct rise/sink animations, no hard cut)', () => {
    expect(css).toContain('@keyframes milestone-rise');
    expect(css).toContain('@keyframes milestone-sink');
    expect(game).toContain('milestone-focus milestone-focus-${gamePhase}');
    expect(game).toContain("gamePhase === 'milestone-exit'");
  });
  it('the sequence is owned by the phase model, not scattered timeouts', () => {
    expect(platform).toContain('setGamePhase(\'milestone-exit\')');
    expect(platform).toContain('MILESTONE_HOLD_MS');
    expect(platform).toContain('MILESTONE_EXIT_MS');
    expect(platform).toContain('MILESTONE_FEEDBACK_MS');
  });
});

describe('Stage 22 — 5/6/7: gameplay header is the shared logo', () => {
  it('5: the question counter text is gone', () => {
    expect(game).not.toContain('{round + 1}/15');
    expect(game).not.toContain('game-topline-info');
  });
  it('6: the shared site logo (wordmark) is shown during gameplay', () => {
    expect(game).toContain('app-brand');
    expect(game).toContain('PremiumIcon');
    expect(game).toContain('<strong>{t.headline}</strong>');
  });
  it('7: the separate Home button is removed (no duplicate Home control)', () => {
    expect(game).not.toContain('game-topline-home');
    expect(game).not.toContain('HomeIcon');
  });
  it('8: the logo routes through the protected exit/cash-out flow', () => {
    expect(game).toContain('className="app-brand focus-ring" onClick={requestExit}');
  });
});

describe('Stage 22 — 6/7: centred chances + larger winnings below', () => {
  it('bottom status is a centred vertical stack', () => {
    expect(css).toContain('.game-bottom-status { flex-direction: column; align-items: center;');
  });
  it('the winnings render directly below the chances (DOM order) and only once', () => {
    const idxChances = game.indexOf('ChanceMeter', game.indexOf('game-bottom-status'));
    const idxPot = game.indexOf('game-bottom-pot', game.indexOf('game-bottom-status'));
    expect(idxChances).toBeGreaterThan(0);
    expect(idxPot).toBeGreaterThan(idxChances);
    expect(game.split('game-bottom-pot').length - 1).toBe(1);
  });
  it('the winnings are enlarged', () => {
    expect(css).toContain('.game-bottom-pot { font-size: clamp(1.7rem, 6vw, 2.15rem);');
  });
});

describe('Stage 22 — 8: no default gold answer border before interaction', () => {
  it('all four unanswered answers start in the identical neutral state', () => {
    expect(game).toContain("const state = selected === null ? '' :");
  });
  it('initial focus goes to the neutral question heading, never an answer', () => {
    expect(game).toContain('questionRef.current?.focus()');
    expect(game).toContain('ref={questionRef} tabIndex={-1}');
    expect(game).not.toContain('stageRef.current?.focus()');
  });
  it('keyboard focus stays accessible: answers keep their focus-ring', () => {
    expect(game).toContain('answer-button focus-ring');
  });
});

describe('Stage 22 — 9: lifeline icons optically centred in their tiles', () => {
  it('the status floats at the tile base so the icon sits at the true centre', () => {
    expect(css).toContain('.lifeline-tile { position: relative; }');
    expect(css).toContain('.lifeline-status { position: absolute; left: 0; right: 0; bottom: 7px; }');
  });
});

describe('Stage 22 — 10: post-answer feedback holds ~1.5s longer', () => {
  it('correct/wrong holds grew by ~1.5s over the old ~0.5s/0.75s', () => {
    expect(CORRECT_FEEDBACK_MS).toBe(2000);
    expect(WRONG_FEEDBACK_MS).toBe(2250);
    expect(CORRECT_FEEDBACK_MS - 500).toBeGreaterThanOrEqual(1400);
    expect(WRONG_FEEDBACK_MS - 750).toBeGreaterThanOrEqual(1400);
  });
  it('the holds are applied through the feedback phase', () => {
    expect(platform).toContain('correct ? CORRECT_FEEDBACK_MS : WRONG_FEEDBACK_MS');
  });
});

describe('Stage 22 — 11/22/23/24: state-machine & race safety preserved', () => {
  it('22: rapid answers cannot double-advance', () => {
    expect(platform).toContain('if (advancingRef.current) return');
  });
  it('23: the sequence cleans up on exit/unmount', () => {
    expect(platform).toContain("if (screen !== 'game') clearSeq(); return () => clearSeq();");
  });
  it('24: the timer never ticks during feedback/milestone phases', () => {
    expect(platform).toContain("gamePhase !== 'question'");
  });
});

describe('Stage 22 — 27: multiplayer is unaffected', () => {
  it('no milestone/solo-only ladder machinery leaked into multiplayer', () => {
    expect(multiplayer).not.toContain('milestone-focus');
    expect(multiplayer).not.toContain('MILESTONE_HOLD_MS');
  });
});
