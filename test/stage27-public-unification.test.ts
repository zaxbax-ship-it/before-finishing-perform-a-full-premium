import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const css = read('src/app/globals.css');
const result = read('src/components/trivia/screens/Result.tsx');
const primitives = read('src/design/public/primitives.tsx');
const game = read('src/components/trivia/screens/Game.tsx');

// the Stage 27 block
const s27 = css.slice(css.indexOf('Stage 27 — final public unification'));

describe('Stage 27 — public inner surfaces adopt the gameplay navy-glass + cyan edge', () => {
  it('the listed inner surfaces are restyled together (navy quiet glass + cyan edge)', () => {
    for (const cls of ['.language-option', '.leaderboard-row', '.journey-card', '.journey-objective', '.rule-row', '.drawer-item', '.profile-chip', '.metric-tile']) {
      expect(s27).toContain(cls);
    }
    expect(s27).toContain('background: var(--stage-glass-quiet);');
    expect(s27).toContain('box-shadow: var(--stage-edge-cyan);');
  });
  it('selected/active state keeps gold identity over the navy base', () => {
    expect(s27).toContain('.language-option.active');
    expect(s27).toContain('hsla(41, 90%, 69%, 0.6)');
  });
  it('the language popover, result card and identity cards get the cyan-edge signature', () => {
    expect(s27).toContain('.language-panel');
    expect(s27).toContain('.result-stage .glass');
    expect(s27).toContain('.profile-identity');
  });
  it('every public modal (incl. in-game overlays) carries the cyan edge, modal-scoped', () => {
    expect(css).toContain('.app-shell:not(.admin-active) .modal-card {');
    const modalRule = css.slice(css.indexOf('.app-shell:not(.admin-active) .modal-card {'));
    expect(modalRule.slice(0, 160)).toContain('var(--stage-edge-cyan)');
  });
});

describe('Stage 27 — structural primitives', () => {
  it('Result card uses the shared stage-panel; Metric is a navy tile (not white glass)', () => {
    expect(result).toContain('glass stage-panel w-full rounded-[34px]');
    expect(primitives).toContain('className="metric-tile rounded-3xl p-5 text-center"');
    expect(primitives).not.toContain('bg-white/[0.08]');
  });
});

describe('Stage 27 — scoping: Admin untouched, Gameplay unchanged', () => {
  it('all Stage 27 surface rules are scoped away from Admin', () => {
    // no Stage 27 rule targets admin
    expect(s27).not.toContain('.admin-active .language-option');
    expect(s27.includes(':not(.admin-active)')).toBe(true);
  });
  it('the gameplay screen and master answer surfaces are not touched by Stage 27', () => {
    expect(game).not.toContain('stage-panel'); // gameplay card stays plain glass
    // the master answer-button base rule is untouched
    expect(css).toContain('.answer-button.correct');
    expect(css).toContain('.focus-ring:focus-visible{outline:3px solid hsla(41,90%,69%,.86)');
  });
});
