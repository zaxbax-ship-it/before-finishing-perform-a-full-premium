import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const leaderboard = read('src/components/trivia/screens/Leaderboard.tsx');
const platform = read('src/components/TriviaPlatform.tsx');
const settings = read('src/components/trivia/screens/SettingsPanel.tsx');
const authArea = read('src/components/trivia/chrome/PublicAuthArea.tsx');
const result = read('src/components/trivia/screens/Result.tsx');
const rewardsClient = read('src/lib/rewards/client.ts');
const lbCaller = platform.slice(platform.indexOf("screen === 'leaderboard'"), platform.indexOf('/>', platform.indexOf("screen === 'leaderboard'")) + 200);

describe('Stage 17B — Leaderboard: public rankings + auth-only read-only personal best', () => {
  it('never renders a nickname input / save / validation ("looks good")', () => {
    expect(leaderboard.includes('<input')).toBe(false);
    expect(leaderboard.includes('lbSave')).toBe(false);
    expect(leaderboard.includes('setNickname')).toBe(false);
    expect(leaderboard.includes('validateNickname')).toBe(false);
    expect(leaderboard.includes('nickname-live-message')).toBe(false);
    expect(leaderboard.includes('leaderboard-profile-card')).toBe(false);
  });
  it('1/2. the personal-best card is gated ONLY on the current authenticated session', () => {
    // The only place lbYourBest appears must be inside an `isAuthenticated &&` block.
    const idx = leaderboard.indexOf('t.lbYourBest');
    expect(idx).toBeGreaterThan(0);
    const before = leaderboard.slice(0, idx);
    expect(before.lastIndexOf('isAuthenticated &&')).toBeGreaterThan(before.lastIndexOf('return ('));
    // it is NOT gated on a local nickname / cached profile / local best
    expect(leaderboard.includes('localStorage')).toBe(false);
    expect(/if\s*\(\s*nickname/.test(leaderboard)).toBe(false);
  });
  it('3/14. the personal-best card is READ-ONLY (no editable controls inside it)', () => {
    const cardStart = leaderboard.indexOf('leaderboard-you');
    const cardEnd = leaderboard.indexOf('leaderboard-table-card');
    const card = leaderboard.slice(cardStart, cardEnd);
    expect(card.includes('<input')).toBe(false);
    expect(card.includes('<button')).toBe(false);
    expect(card.includes('onClick')).toBe(false);
    expect(card.includes('t.lbYourBest')).toBe(true);
    expect(card.includes('money(myBest)')).toBe(true);
  });
  it('12/17. value is account-tied (authoritative entry / account best), gate is the session', () => {
    // visibility depends on isAuthenticated; identity match uses the account displayName
    expect(/isAuthenticated:\s*boolean/.test(leaderboard)).toBe(true);
    expect(leaderboard.includes('entries.find(entry =>')).toBe(true);
  });
  it('renders public ranking rows + loading/empty/error states', () => {
    expect(leaderboard.includes('entries.map')).toBe(true);
    expect(leaderboard.includes('t.lbEmpty')).toBe(true);
    expect(leaderboard.includes('aria-busy')).toBe(true);
    expect(leaderboard.includes('role="alert"')).toBe(true);
  });
});

describe('Stage 17B — the platform gates the personal best on authUser (not local nickname)', () => {
  it('passes isAuthenticated + account displayName, never the local nickname, to the card', () => {
    expect(lbCaller.includes('isAuthenticated={Boolean(authUser)}')).toBe(true);
    expect(lbCaller.includes("displayName={authUser?.displayName || ''}")).toBe(true);
    // the local `nickname` value is NOT passed to the Leaderboard
    expect(lbCaller.includes('nickname={nickname}')).toBe(false);
    expect(lbCaller.includes('setNickname')).toBe(false);
  });
});

describe('Stage 17B — nickname editing removed from general public screens', () => {
  it('6/7. Settings contains NO nickname editor (Stage 17 addition reverted)', () => {
    expect(settings.includes('setting-nickname')).toBe(false);
    expect(settings.includes('validateNickname')).toBe(false);
    expect(settings.includes('saveNickname')).toBe(false);
    expect(settings.includes('lbNickname')).toBe(false);
    expect(settings.includes('<input') && settings.includes('type="checkbox"')).toBe(true); // only the settings toggles/select remain
  });
  it('the platform no longer wires nickname editing into Settings', () => {
    const settingsCaller = platform.slice(platform.indexOf("screen === 'settings'"), platform.indexOf('/>}', platform.indexOf("screen === 'settings'")) + 3);
    expect(settingsCaller.includes('saveNickname')).toBe(false);
    expect(settingsCaller.includes('leaderboardStatus=')).toBe(false);
  });
  it('8. the header account area has no general/persistent nickname editor (only an auth setup prompt)', () => {
    // any nickname input in the header is gated behind an authenticated user w/o a nickname
    expect(authArea.includes('shouldPromptNickname')).toBe(true);
    expect(authArea.includes('Boolean(user && !nickname)')).toBe(true);
  });
});

describe('Stage 17B — sign-out drops the authenticated personal card immediately', () => {
  const signOutBlock = platform.slice(platform.indexOf('async function signOut'), platform.indexOf('async function signOut') + 420);
  it('8/9. clears authUser and routes to a public screen (card gate becomes false)', () => {
    expect(signOutBlock.includes('setAuthUser(null)')).toBe(true);
    expect(signOutBlock.includes("open('home')")).toBe(true);
  });
  it('10/16. profile/rewards fetches are no-store + session-keyed (no cross-user leak)', () => {
    expect(rewardsClient.includes("cache: 'no-store'")).toBe(true);
  });
});

describe('Stage 17B — post-game account-creation offer (signed-out only)', () => {
  it('Solo Result shows the guest account offer only when not authenticated', () => {
    expect(result.includes('!isAuthenticated && (')).toBe(true);
    expect(result.includes('guest-progress-cta') || result.includes('account-offer')).toBe(true);
    expect(result.includes('saveProgress') || result.includes('createAccount')).toBe(true);
  });
});

describe("Stage 17B — Multiplayer result offer (signed-out only)", () => {
  const mp = read("src/components/multiplayer/MultiplayerMode.tsx");
  it("11. Multiplayer results show the account offer only when not authenticated", () => {
    expect(mp.includes("!isAuthenticated && saveProgressLabel")).toBe(true);
  });
  it("19. reuses the same guest-progress-cta pattern as Solo (shared, not duplicated)", () => {
    expect(mp.includes("guest-progress-cta")).toBe(true);
  });
  it("the platform passes auth state + label to Multiplayer", () => {
    expect(platform.includes("isAuthenticated={Boolean(authUser)} saveProgressLabel={authT.saveProgress}")).toBe(true);
  });
});
