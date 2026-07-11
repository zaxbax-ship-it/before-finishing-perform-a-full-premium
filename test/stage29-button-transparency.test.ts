import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const buttons = read('src/design/public/buttons.css');
const layout = read('src/app/layout.tsx');
const selectorLines = buttons.split(/\r?\n/).filter((l) => l.trim().startsWith('.'));

describe('Stage 29 — subtle premium button transparency', () => {
  it('reduces the resting fill of the shared button families to ~78%', () => {
    expect(buttons).toContain('.premium-button');
    expect(buttons).toContain('.ghost-button');
    expect(buttons).toContain('rgba(255, 247, 201, 0.72)');
    expect(buttons).toContain('rgba(159, 100, 31, 0.74)');
    expect(buttons).toContain('hsla(0, 0%, 100%, 0.055)');
    // genuinely translucent: a frosted backdrop pulls the stage through the fill
    expect(buttons).toContain('backdrop-filter: blur(');
    // Home play cards (the buttons Stage 29 missed) are now included
    expect(buttons).toContain('.primary-action-card.is-solo.stage-interactive');
    expect(buttons).toContain('rgba(16, 40, 92, 0.58)');
  });
  it('preserves the ghost hover state exactly (azure tint unchanged)', () => {
    expect(buttons).toContain('.ghost-button:hover');
    expect(buttons).toContain('rgba(69, 194, 255, 0.16)');
  });
  it('every button rule is public-scoped — Admin is excluded', () => {
    for (const line of selectorLines) {
      if (line.includes('-button')) expect(line).toContain(':not(.admin-active)');
    }
  });
  it('is wired into the app design-system layer, after globals', () => {
    expect(layout).toContain('@/design/public/buttons.css');
    expect(layout.indexOf('./globals.css')).toBeLessThan(layout.indexOf('@/design/public/buttons.css'));
  });
  it('no rule targets the excluded controls', () => {
    for (const cls of ['app-brand', 'language-trigger', 'icon-button', 'google-button']) {
      expect(selectorLines.some((l) => l.includes(cls))).toBe(false);
    }
  });
});
