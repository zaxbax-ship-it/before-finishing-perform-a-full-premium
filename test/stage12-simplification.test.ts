import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const LOCALES = ['he', 'en', 'ar', 'ru', 'am'];

describe('Stage 12 — Home hero simplification', () => {
  const home = read('src/components/trivia/screens/Home.tsx');
  it('1. no marketing eyebrow / intro / live label / metrics remain', () => {
    expect(home.includes('t.pill')).toBe(false);
    expect(home.includes('t.intro')).toBe(false);
    expect(home.includes('t.live')).toBe(false);
    expect(home.includes('PremiumBadgeIcon')).toBe(false);
    expect(home.includes('<Metric')).toBe(false);
    expect(home.includes('getMarketingQuestions')).toBe(false);
  });
  it('2. the primary actions appear before any ad/secondary content', () => {
    const actions = home.indexOf('home-primary-actions');
    const ad = home.indexOf('<AdSlot');
    expect(actions).toBeGreaterThan(0);
    expect(actions).toBeLessThan(ad);
  });
});

describe('Stage 12 — header & footer', () => {
  it('header brand no longer shows the subtitle', () => {
    expect(read('src/components/trivia/screens/Header.tsx').includes('{t.subtitle}')).toBe(false);
  });
  it('6. footer marketing sentence is absent; legal links remain', () => {
    const footer = read('src/components/compliance/SiteFooter.tsx');
    expect(footer.includes('responsible publishing')).toBe(false);
    expect(footer.includes('/privacy-policy')).toBe(true);
    expect(footer.includes('/terms-of-service')).toBe(true);
    expect(footer.includes('/cookie-policy')).toBe(true);
  });
});

describe('Stage 12 — Categories', () => {
  const cats = read('src/components/trivia/screens/Categories.tsx');
  it('3. category card no longer renders a permanent description paragraph', () => {
    expect(cats.includes('<p>{localizeCategoryDescription(locale, category)}</p>')).toBe(false);
    // still available as a tooltip
    expect(cats.includes('title={localizeCategoryDescription(locale, category)}')).toBe(true);
  });
});

describe('Stage 12 — Result', () => {
  const result = read('src/components/trivia/screens/Result.tsx');
  it('4. the prize is not rendered as a duplicate Metric', () => {
    expect(result.includes('label={t.homePrize}')).toBe(false);
  });
  it('5. the guest CTA is one unified auth action to /login', () => {
    expect(result.includes('authUi.saveProgress')).toBe(true);
    expect(result.includes('href="/signup"')).toBe(false);
    expect(result.includes('guestCtaBody')).toBe(false);
  });
});

describe('Stage 12 — Journey / Leaderboard', () => {
  it('9. Journey subtitle is removed', () => {
    expect(read('src/components/trivia/screens/Journey.tsx').includes('journey-subtitle')).toBe(false);
  });
  it('8. Leaderboard input has no placeholder duplicating the label', () => {
    expect(read('src/components/trivia/screens/Leaderboard.tsx').includes('placeholder={t.lbNickname}')).toBe(false);
  });
});

describe('Stage 12 — Multiplayer', () => {
  const mp = read('src/components/multiplayer/MultiplayerMode.tsx');
  it('10. no permanent connection-ready status card', () => {
    // The permanent status card is gone; connection state survives only as an
    // accessible notification (spec: keep full state available to screen readers).
    expect(mp.includes('multiplayer-status-card')).toBe(false);
  });
  it('11. buy-extra action is gated on a depleted lifeline count', () => {
    expect(mp.includes('{count <= 0 && (')).toBe(true);
  });
  it('12. per-player plural role label is removed', () => {
    expect(mp.includes('isHost ? copy.host : copy.players')).toBe(false);
  });
  it('17. one champion icon; separate results heading removed', () => {
    expect(mp.includes('champion-pop')).toBe(false);
    expect(mp.includes('<h2>{copy.results}</h2>')).toBe(false);
  });
  it('notification toast has no redundant prefix', () => {
    expect(mp.includes('{copy.notification}:')).toBe(false);
  });
});

describe('Stage 12 — Settings & Contact', () => {
  it('13. Settings reset requires a confirmation step', () => {
    const settings = read('src/components/trivia/screens/SettingsPanel.tsx');
    expect(settings.includes('confirmReset')).toBe(true);
    expect(settings.includes('t.resetConfirm')).toBe(true);
  });
  it('Contact submit button has no decorative mail icon', () => {
    const contact = read('src/components/trivia/screens/Contact.tsx');
    // MailIcon still used for header, but not inside the submit button
    expect(/<button type="submit"[\s\S]*?<MailIcon/.test(contact)).toBe(false);
  });
});

describe('Stage 12 — shared header primitive', () => {
  it('14. Panel renders the lighter public-screen title and no big centered icon', () => {
    const primitives = read('src/components/trivia/primitives.tsx');
    expect(primitives.includes('public-screen-title')).toBe(true);
    expect(primitives.includes('text-4xl font-black text-white md:text-5xl')).toBe(false);
  });
});

describe('Stage 12 — locale parity for new/updated keys', () => {
  for (const key of ['saveProgress', 'resetConfirm', 'resetConfirmYes', 'resetConfirmNo']) {
    it(`"${key}" exists in all five locales`, () => {
      for (const loc of LOCALES) {
        expect(read(`src/lib/localization/locales/${loc}.ts`).includes(`"${key}"`)).toBe(true);
      }
    });
  }
});
