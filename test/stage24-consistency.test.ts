import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const css = read('src/app/globals.css');
const authShell = read('src/app/auth-ui/AuthShell.tsx');

describe('Stage 24 — public design-language consistency', () => {
  it('the leaderboard table is a flat content region inside the glass Panel (no card-in-card)', () => {
    expect(css).toContain('.app-shell:not(.admin-active):not(.game-active) .glass .leaderboard-table-card');
    const rule = css.slice(css.indexOf('.app-shell:not(.admin-active):not(.game-active) .glass .leaderboard-table-card'));
    const block = rule.slice(0, rule.indexOf('}') + 1);
    expect(block).toContain('border: none');
    expect(block).toContain('box-shadow: none');
    expect(block).toContain('background: none');
  });

  it('the auth pages render the same navy stage WITH gold particles as the rest of the product', () => {
    expect(authShell).toContain("import { Particles } from '@/components/trivia/chrome/Particles'");
    expect(authShell).toContain('<Particles />');
    // particles live inside the shared app-shell stage
    expect(authShell.indexOf('app-shell')).toBeLessThan(authShell.indexOf('<Particles />'));
  });
});
