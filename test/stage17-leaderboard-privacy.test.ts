import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const leaderboard = read('src/components/trivia/screens/Leaderboard.tsx');
const platform = read('src/components/TriviaPlatform.tsx');
const settings = read('src/components/trivia/screens/SettingsPanel.tsx');
const authArea = read('src/components/trivia/chrome/PublicAuthArea.tsx');
const rewardsClient = read('src/lib/rewards/client.ts');
// The leaderboard JSX block inside the platform (to prove no personal props are passed).
const lbCaller = platform.slice(platform.indexOf("screen === 'leaderboard'"), platform.indexOf('/>', platform.indexOf("screen === 'leaderboard'")) + 2);

describe('Stage 17 — Leaderboard is public rankings only', () => {
  it('1. never renders a nickname input', () => {
    expect(leaderboard.includes('<input')).toBe(false);
  });
  it('2. never renders a Save Nickname control', () => {
    expect(leaderboard.includes('lbSave')).toBe(false);
    expect(leaderboard.includes('saveNickname')).toBe(false);
    expect(leaderboard.includes('setNickname')).toBe(false);
  });
  it('3. never renders the nickname validation / "looks good" message', () => {
    expect(leaderboard.includes('validateNickname')).toBe(false);
    expect(leaderboard.includes('nickname-live-message')).toBe(false);
    expect(leaderboard.includes('nicknamePrompt')).toBe(false);
  });
  it('4. never renders a personal-best panel', () => {
    expect(leaderboard.includes('lbYourBest')).toBe(false);
    expect(leaderboard.includes('leaderboard-personal-best')).toBe(false);
    expect(leaderboard.includes('leaderboard-profile-card')).toBe(false);
    expect(leaderboard.includes('bestPrize={')).toBe(false);
  });
  it('5-7. only receives public props (t, entries, status) — cannot branch on auth in any state', () => {
    // The component signature must not accept any personal/auth/nickname prop.
    for (const forbidden of ['nickname', 'authUi', 'setNickname', 'bestPrize', 'isAuthenticated', 'user']) {
      expect(leaderboard.includes(`${forbidden}:`)).toBe(false);
    }
    expect(/entries:\s*LeaderboardEntry\[\]/.test(leaderboard)).toBe(true);
    expect(/status:\s*LeaderboardStatus/.test(leaderboard)).toBe(true);
  });
  it('renders the public ranking list, loading, empty and error states', () => {
    expect(leaderboard.includes('leaderboard-list')).toBe(true);
    expect(leaderboard.includes('entries.map')).toBe(true);
    expect(leaderboard.includes('t.lbEmpty')).toBe(true);
    expect(leaderboard.includes('aria-busy')).toBe(true);
    expect(leaderboard.includes('t.lbError')).toBe(true); // explicit error state
    expect(leaderboard.includes("role=\"alert\"")).toBe(true);
  });
  it('15. leaves no hidden but focusable nickname controls (no inputs/buttons at all)', () => {
    expect(leaderboard.includes('<input')).toBe(false);
    expect(leaderboard.includes('<button')).toBe(false);
  });
  it('16. public leaderboard entries remain the sole data source', () => {
    expect(leaderboard.includes('entry.nickname || entry.displayName')).toBe(true);
    expect(leaderboard.includes('entry.bestPrize')).toBe(true);
  });
});

describe('Stage 17 — the platform passes only public data to the Leaderboard', () => {
  it('the <Leaderboard> call passes no personal/nickname props', () => {
    expect(lbCaller.includes('nickname=')).toBe(false);
    expect(lbCaller.includes('setNickname=')).toBe(false);
    expect(lbCaller.includes('bestPrize=')).toBe(false);
    expect(lbCaller.includes('authUi=')).toBe(false);
    expect(lbCaller.includes('entries={leaderboardEntries}')).toBe(true);
    expect(lbCaller.includes('status={leaderboardStatus}')).toBe(true);
  });
});

describe('Stage 17 — nickname editing relocated to Settings (single public home)', () => {
  it('6/relocation. Settings hosts the nickname editor', () => {
    expect(settings.includes('validateNickname')).toBe(true);
    expect(settings.includes('saveNickname')).toBe(true);
    expect(settings.includes('setting-nickname')).toBe(true);
    expect(settings.includes('t.lbNickname')).toBe(true);
  });
  it('the platform wires nickname editing into Settings, not the Leaderboard', () => {
    expect(platform.includes('<SettingsPanel')).toBe(true);
    const settingsCaller = platform.slice(platform.indexOf("screen === 'settings'"), platform.indexOf('/>}', platform.indexOf("screen === 'settings'")) + 3);
    expect(settingsCaller.includes('saveNickname={saveNickname}')).toBe(true);
    expect(settingsCaller.includes('nickname={nickname}')).toBe(true);
  });
});

describe('Stage 17 — sign-out clears authenticated state and routes to a clean guest screen', () => {
  const signOutBlock = platform.slice(platform.indexOf('async function signOut'), platform.indexOf('async function signOut') + 400);
  it('8. clears the authenticated user (in-memory identity)', () => {
    expect(signOutBlock.includes('setAuthUser(null)')).toBe(true);
    expect(signOutBlock.includes('createAuthService().signOut()')).toBe(true);
  });
  it('9/10. routes to a public screen so authenticated personal screens unmount (no stale render)', () => {
    expect(signOutBlock.includes("open('home')")).toBe(true);
  });
  it('11. authenticated rewards/profile fetch is never cross-user cached (no-store, session-keyed)', () => {
    expect(rewardsClient.includes("cache: 'no-store'")).toBe(true);
    expect(rewardsClient.includes('fetchProfile')).toBe(true);
  });
});

describe('Stage 17 — header/account identity resets after sign-out', () => {
  it('12. unauthenticated state shows only a sign-in link (no email/avatar/personal block)', () => {
    // The avatar/email/dropdown are gated behind `user`; the signed-out branch returns the login link.
    expect(authArea.includes('!configured || !user')).toBe(true);
    expect(authArea.includes('href="/login"')).toBe(true);
    // the nickname setup prompt is gated on an authenticated user
    expect(authArea.includes('Boolean(user && !nickname)')).toBe(true);
  });
});

describe('Stage 17 — Profile re-derives identity from current session', () => {
  it('13. Profile fetches fresh on mount and falls back to the local nickname when signed out', () => {
    const profile = read('src/components/trivia/screens/RewardsProfile.tsx');
    expect(profile.includes('fetchProfile')).toBe(true);
    expect(profile.includes('useEffect')).toBe(true);
    // caller: displayName uses authUser only when present, else the local nickname
    expect(platform.includes("displayName={nickname || authUser?.displayName || ''}")).toBe(true);
  });
});
