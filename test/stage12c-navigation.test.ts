import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('Stage 12C — drawer is exactly five intentional items', () => {
  const header = read('src/components/trivia/screens/Header.tsx');
  const drawer = header.slice(header.indexOf('drawer-nav'), header.indexOf('</div>', header.indexOf('drawer-nav')));

  it('contains exactly five drawer items', () => {
    expect((drawer.match(/drawer-item/g) || []).length).toBe(5);
  });

  it('has the exact order: profile, rules, submit, settings, contact', () => {
    const order = ['profile', 'rules', 'submit', 'settings', 'contact'].map(s => drawer.indexOf(`handleNav('${s}')`));
    expect(order.every(i => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('no longer routes to leaderboard, multiplayer, journey, or a start action from the drawer', () => {
    expect(drawer.includes("handleNav('leaderboard')")).toBe(false);
    expect(drawer.includes("handleNav('multiplayer')")).toBe(false);
    expect(drawer.includes("handleNav('journey')")).toBe(false);
    expect(drawer.includes('start()')).toBe(false);
  });
});

describe('Stage 12C — Leaderboard relocated to Home', () => {
  const home = read('src/components/trivia/screens/Home.tsx');
  it('renders a compact leaderboard card that opens the leaderboard', () => {
    expect(home.includes('home-leaderboard-card')).toBe(true);
    expect(home.includes("open('leaderboard')")).toBe(true);
    expect(home.includes('aria-label={t.lbNav}')).toBe(true);
  });
  it('places it after the primary Play actions (not competing with them)', () => {
    expect(home.indexOf('home-primary-actions')).toBeLessThan(home.indexOf('home-leaderboard-card'));
  });
});
