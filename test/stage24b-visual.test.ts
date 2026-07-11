import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const css = read('src/app/globals.css');
const home = read('src/components/trivia/screens/Home.tsx');
const categories = read('src/components/trivia/screens/Categories.tsx');
const panel = read('src/design/public/primitives.tsx');
const dsTokens = read('src/design/public/tokens.css');
const auth = read('src/app/auth-ui/AuthShell.tsx');
const mp = read('src/components/multiplayer/MultiplayerMode.tsx');
const game = read('src/components/trivia/screens/Game.tsx');

describe('Stage 24B — shared gameplay-derived visual primitives exist', () => {
  it('defines the answer-card interactive surface + cyan lower-edge signature', () => {
    expect(dsTokens).toContain('--stage-edge-cyan:');
    expect(css).toContain('.app-shell:not(.admin-active):not(.game-active) .stage-interactive');
    // recreates the Solo answer-card navy gradient
    expect(dsTokens).toContain('rgba(16, 40, 92, 0.9), rgba(4, 10, 26, 0.78)');
  });
  it('defines the shared panel signature + is scoped away from Admin', () => {
    expect(css).toContain('.app-shell:not(.admin-active):not(.game-active) .stage-panel');
    expect(css).not.toContain('.admin-active .stage-interactive {');
  });
  it('inputs get a cyan focus edge (not the old gold focus)', () => {
    expect(css).toContain('.app-shell:not(.admin-active):not(.game-active) .form-input:focus');
    const block = css.slice(css.indexOf('.app-shell:not(.admin-active):not(.game-active) .form-input:focus'));
    expect(block.slice(0, 400)).toContain('rgba(69, 194, 255');
  });
});

describe('Stage 24B — primitives applied across public components', () => {
  it('Home play choices use the interactive answer-card class', () => {
    expect(home).toContain('is-solo focus-ring stage-interactive');
    expect(home).toContain('is-multi focus-ring stage-interactive');
  });
  it('Category tiles use the interactive answer-card class', () => {
    expect(categories).toContain('category-card focus-ring glass stage-interactive');
  });
  it('the shared Panel + Auth card + Multiplayer surfaces + dialogs use the panel signature', () => {
    expect(panel).toContain('glass stage-panel rounded-[28px]');
    expect(auth).toContain('glass auth-card stage-panel');
    expect(mp).toContain('multiplayer-hero glass stage-panel');
    expect(mp).toContain('glass multiplayer-panel stage-panel');
    expect(mp).toContain('multiplayer-lobby-card stage-interactive');
    // dialogs now render through the design-system PublicModal (the one
    // approved public dialog surface), and each still routes through it.
    expect(read('src/design/public/PublicModal.tsx')).toContain('glass modal-card stage-panel');
    for (const m of ['GameExitModal', 'LifeOfferModal', 'PaidModal']) {
      expect(read(`src/components/trivia/modals/${m}.tsx`)).toContain('PublicModal');
    }
  });
});

describe('Stage 24B — Solo Gameplay itself is untouched', () => {
  it('the gameplay stage card does not adopt the public panel/interactive classes', () => {
    expect(game).not.toContain('stage-panel');
    expect(game).not.toContain('stage-interactive');
  });
  it('the master answer-button and glass base rules are unchanged', () => {
    expect(css).toContain('.focus-ring:focus-visible{outline:3px solid hsla(41,90%,69%,.86)');
    expect(css).toContain('.answer-button.correct');
  });
});
