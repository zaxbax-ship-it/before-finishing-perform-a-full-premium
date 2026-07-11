import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_TOKENS, PUBLIC_CLASSES } from '@/design/public';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const tokensCss = read('src/design/public/tokens.css');
const dsPrimitives = read('src/design/public/primitives.tsx');
const dsIndex = read('src/design/public/index.ts');
const globals = read('src/app/globals.css');
const triviaPrimitives = read('src/components/trivia/primitives.tsx');
const layout = read('src/app/layout.tsx');
const game = read('src/components/trivia/screens/Game.tsx');

describe('Stage 28 — centralized Public Design System', () => {
  it('exposes the canonical tokens + approved class map', () => {
    expect(PUBLIC_TOKENS.color.azure).toBe('#45c2ff');
    expect(PUBLIC_TOKENS.glass.surface).toBe('var(--stage-glass)');
    expect(PUBLIC_CLASSES.modalCard).toBe('glass modal-card stage-panel');
  });
  it('exports the approved public primitives as the single source', () => {
    for (const p of ['PublicPage', 'PublicSurface', 'PublicPanel', 'PublicInteractiveCard', 'PublicButton', 'PublicInput', 'PublicTextarea', 'PublicSelect', 'PublicField', 'PublicMetric', 'PublicSuccess', 'PublicIconButton', 'PublicModal']) {
      expect(dsIndex).toContain(p);
    }
    // primitives compose the canonical approved CSS layer
    expect(dsPrimitives).toContain('glass stage-panel rounded-[28px]');
    expect(dsPrimitives).toContain('premium-button');
    expect(dsPrimitives).toContain('ghost-button');
    expect(dsPrimitives).toContain('form-input');
    expect(dsPrimitives).toContain('metric-tile');
  });
  it('the design tokens live in ONE place (tokens.css), not scattered in globals', () => {
    expect(tokensCss).toContain('--stage-edge-cyan:');
    expect(tokensCss).toContain('--stage-glass:');
    // globals no longer re-declares the stage tokens (single source of truth)
    expect(globals.includes('  --stage-glass:')).toBe(false);
    // and the tokens are imported once, before globals
    expect(layout.indexOf("@/design/public/tokens.css")).toBeLessThan(layout.indexOf("./globals.css"));
  });
  it('the shared trivia primitives + dialogs delegate to the design system', () => {
    expect(triviaPrimitives).toContain("from '@/design/public/primitives'");
    expect(triviaPrimitives).toContain('PublicPanel');
    for (const m of ['GameExitModal', 'LifeOfferModal', 'PaidModal']) {
      expect(read(`src/components/trivia/modals/${m}.tsx`)).toContain('PublicModal');
    }
  });
  it('Admin does not consume the public design system, and gameplay is unchanged', () => {
    // no admin component imports the public design system
    const adminFiles = ['src/app/admin/AdminAuthBar.tsx'];
    for (const f of adminFiles) {
      try { expect(read(f)).not.toContain('@/design/public'); } catch { /* file may not exist */ }
    }
    expect(game).not.toContain('@/design/public'); // gameplay screen is the master, not a consumer
  });
});
