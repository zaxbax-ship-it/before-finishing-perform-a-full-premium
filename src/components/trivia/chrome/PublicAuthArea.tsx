'use client';

import { useEffect, useState } from 'react';
import { AchievementsIcon, LeaderboardIcon, LoginIcon, LogoutIcon, ProfileIcon, SettingsIcon, StatisticsIcon } from '@/lib/design/icons';
import { initialsFor, validateNickname } from '../format';
import type { LeaderboardStatus, PublicAuthUser, Screen } from '../types';
import { Avatar } from './Avatar';

export function PublicAuthArea({
  ui,
  user,
  ready,
  configured,
  nickname,
  leaderboardStatus,
  saveNickname,
  open,
  signOut
}: {
  ui: Record<string, string>;
  user: PublicAuthUser | null;
  ready: boolean;
  configured: boolean;
  nickname: string;
  leaderboardStatus: LeaderboardStatus;
  saveNickname: (value: string) => void | Promise<void>;
  open: (screen: Screen) => void;
  signOut: () => void | Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(nickname);

  useEffect(() => {
    setDraft(nickname);
  }, [nickname]);

  const displayName = nickname || user?.displayName || user?.email?.split('@')[0] || ui.guest;
  const validation = validateNickname(draft, ui);
  const shouldPromptNickname = Boolean(user && !nickname);
  const initials = initialsFor(displayName);

  if (!ready) {
    return (
      <div className="public-auth-corner" aria-label={ui.account}>
        <div className="public-auth-skeleton icon-pair" />
      </div>
    );
  }

  if (!configured || !user) {
    return (
      <nav className="public-auth-corner public-auth-actions" aria-label={ui.account}>
        <a className="auth-link-button secondary icon-only focus-ring" href="/login" aria-label={ui.signIn} title={ui.signIn}><LoginIcon size={20} aria-hidden="true" /></a>
        <a className="auth-link-button primary icon-only focus-ring" href="/signup" aria-label={ui.createAccount} title={ui.createAccount}><ProfileIcon size={20} aria-hidden="true" /></a>
      </nav>
    );
  }

  return (
    <div className="public-auth-corner public-user-menu">
      <button
        type="button"
        className="public-user-trigger focus-ring"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(value => !value)}
      >
        <Avatar user={user} initials={initials} />
        <span>
          <strong>{displayName}</strong>
          <small>{user.email || ui.account}</small>
        </span>
      </button>

      {menuOpen && (
        <div className="public-user-dropdown glass" role="menu">
          {shouldPromptNickname && (
            <section className="nickname-prompt" aria-label={ui.chooseNickname}>
              <strong>{ui.chooseNickname}</strong>
              <p>{ui.nicknamePrompt}</p>
              <input
                className="form-input"
                value={draft}
                maxLength={20}
                onChange={event => setDraft(event.target.value)}
                placeholder={ui.nicknamePlaceholder}
              />
              <small className={validation.ok ? 'nickname-valid' : 'nickname-invalid'}>{validation.message}</small>
              <button
                type="button"
                className="premium-button focus-ring w-full"
                disabled={!validation.ok || leaderboardStatus === 'saving'}
                onClick={() => void saveNickname(draft)}
              >
                {ui.saveNickname}
              </button>
            </section>
          )}
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); open('profile'); }}><ProfileIcon size={16} />{ui.profile}</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); open('profile'); }}><StatisticsIcon size={16} />{ui.stats}</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); open('profile'); }}><AchievementsIcon size={16} />{ui.achievements}</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); open('leaderboard'); }}><LeaderboardIcon size={16} />{ui.leaderboard}</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); open('settings'); }}><SettingsIcon size={16} />{ui.settings}</button>
          <button type="button" role="menuitem" className="danger" onClick={() => { setMenuOpen(false); void signOut(); }}><LogoutIcon size={16} />{ui.logout}</button>
        </div>
      )}
    </div>
  );
}
