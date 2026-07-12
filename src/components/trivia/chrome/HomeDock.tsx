'use client';

import { useRef, useState } from 'react';
import {
  CloseIcon,
  EditIcon,
  MenuIcon,
  PremiumIcon,
  ProfileIcon,
  QuestionIcon,
  SettingsIcon,
  SupportIcon
} from '@/lib/design/icons';
import { playAudioEvent } from '@/lib/audio';
import type { Locale } from '@/lib/types';
import type { LeaderboardStatus, PublicAuthUser, Screen } from '../types';
import { useDialogFocus } from '../useDialogFocus';
import { useDismissable } from '../useDismissable';
import { LanguageMenu } from './LanguageMenu';
import { PublicAuthArea } from './PublicAuthArea';

/**
 * Home-only glass dock (approved depth reference). A single compact, centered
 * pill that consolidates the real controls in RTL order:
 *   crown/brand (solid gold, → home) → language → account → menu (far-left).
 *
 * It reuses the real LanguageMenu + PublicAuthArea + drawer navigation, so all
 * routing and behaviour is unchanged — only the chrome is restyled. It replaces
 * the shared top-utility-bar + Header on the Home screen (both are still used
 * verbatim on every other screen).
 */
export function HomeDock({
  t,
  authUi,
  locale,
  setLocale,
  submitLabel,
  open,
  user,
  authReady,
  authConfigured,
  nickname,
  leaderboardStatus,
  saveNickname,
  signOut
}: {
  t: Record<string, string>;
  authUi: Record<string, string>;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  submitLabel: string;
  open: (screen: Screen) => void;
  user: PublicAuthUser | null;
  authReady: boolean;
  authConfigured: boolean;
  nickname: string;
  leaderboardStatus: LeaderboardStatus;
  saveNickname: (value: string) => void | Promise<void>;
  signOut: () => void | Promise<void>;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const { closing: drawerClosing, dismiss: dismissDrawer } = useDismissable(() => setDrawerOpen(false));
  useDialogFocus(drawerOpen, drawerRef, dismissDrawer);
  const handleNav = (screen: Screen) => {
    open(screen);
    dismissDrawer();
  };

  return (
    <div className="home-dock-bar">
      <nav className="home-dock" aria-label={t.headline}>
        {/* Brand — solid gold, always returns home. */}
        <button className="home-dock-brand focus-ring" onClick={() => handleNav('home')} aria-label={t.headline} title={t.headline}>
          <PremiumIcon size={22} />
        </button>
        <span className="home-dock-sep" aria-hidden="true" />
        {/* Language — the real LanguageMenu, styled to the dock. */}
        <LanguageMenu locale={locale} setLocale={setLocale} />
        {/* Account — the real PublicAuthArea (login link or user menu). */}
        <PublicAuthArea
          ui={authUi}
          user={user}
          ready={authReady}
          configured={authConfigured}
          nickname={nickname}
          leaderboardStatus={leaderboardStatus}
          saveNickname={saveNickname}
          open={open}
          signOut={signOut}
        />
        {/* Menu — opens the same side drawer as the shared Header. */}
        <button className="home-dock-menu focus-ring" onClick={() => { playAudioEvent('ui.open'); setDrawerOpen(true); }} aria-label={t.menu || 'Menu'} title={t.menu || 'Menu'}>
          <MenuIcon size={20} />
        </button>
      </nav>

      {drawerOpen && (
        <div className={`drawer-backdrop ${drawerClosing ? 'is-closing' : ''}`} onClick={() => { playAudioEvent('ui.close'); dismissDrawer(); }}>
          <div className="drawer-panel glass" ref={drawerRef} role="dialog" aria-modal="true" aria-label={t.headline} onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <strong>{t.headline}</strong>
              <button className="icon-button focus-ring" onClick={() => { playAudioEvent('ui.close'); dismissDrawer(); }} aria-label={t.close || 'Close'} title={t.close || 'Close'}><CloseIcon size={18} /></button>
            </div>
            <div className="drawer-nav" role="navigation" aria-label={t.headline}>
              <button className="drawer-item focus-ring" onClick={() => handleNav('profile')}><ProfileIcon size={18} />{t.profile}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('rules')}><QuestionIcon size={18} />{t.rules}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('submit')}><EditIcon size={18} />{submitLabel}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('settings')}><SettingsIcon size={18} />{t.settings}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('contact')}><SupportIcon size={18} />{t.contact}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
