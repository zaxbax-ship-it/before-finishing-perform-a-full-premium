import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const buttons = read('src/design/public/buttons.css');
const layout = read('src/app/layout.tsx');
const selectorLines = buttons.split(/\r?\n/).filter((l) => l.trim().startsWith('.'));

describe('Stage 30 — uniform ~70% button transparency', () => {
  it('covers every rectangular button family on the public site', () => {
    for (const cls of [
      '.premium-button',
      '.ghost-button',
      '.play-all-banner',
      '.category-card',
      '.drawer-item',
      '.primary-action-card.is-solo.stage-interactive',
      '.primary-action-card.is-multi.stage-interactive',
    ]) {
      expect(buttons).toContain(cls);
    }
  });

  it('uses a uniform ~70% opaque fill (30% transparent) across families', () => {
    // gold primary family (premium + play-all) at 0.70
    expect(buttons).toContain('rgba(255, 247, 201, 0.70)');
    // navy neutral family (ghost + category + drawer) and Home cards at 0.70
    expect(buttons).toContain('rgba(16, 40, 92, 0.70), rgba(4, 10, 26, 0.70)');
    // genuinely translucent: a frosted backdrop pulls the stage through the fill
    expect(buttons).toContain('backdrop-filter: blur(');
    // the old aggressive Home-card transparency is gone (now the uniform 0.70)
    expect(buttons).not.toContain('rgba(16, 40, 92, 0.58)');
  });

  it('every rule is public-scoped — Admin is never affected', () => {
    for (const line of selectorLines) {
      expect(line).toContain(':not(.admin-active)');
    }
  });

  it('preserves a distinct hover identity per family', () => {
    expect(buttons).toContain('.ghost-button:hover');
    expect(buttons).toContain('.drawer-item:hover');
    expect(buttons).toContain('.category-card:hover');
  });

  it('does not touch the excluded controls (round/icon, Google, in-play tiles)', () => {
    for (const cls of ['app-brand', 'language-trigger', 'icon-button', 'google-button', 'answer-button', 'lifeline']) {
      expect(selectorLines.some((l) => l.includes(cls))).toBe(false);
    }
  });

  it('is wired into the app design-system layer, after globals', () => {
    expect(layout).toContain('@/design/public/buttons.css');
    expect(layout.indexOf('./globals.css')).toBeLessThan(layout.indexOf('@/design/public/buttons.css'));
  });
});
