'use client';

import { useRef, useState } from 'react';
import {
  CloseIcon,
  EditIcon,
  LeaderboardIcon,
  MenuIcon,
  MultiplayerIcon,
  PlayIcon,
  PremiumIcon,
  ProfileIcon,
  QuestionIcon,
  SettingsIcon,
  SupportIcon
} from '@/lib/design/icons';
import type { Screen } from '../types';
import { useDialogFocus } from '../useDialogFocus';

export function Header({ t, submitLabel, multiplayerLabel, open, start }: { t: Record<string, string>; submitLabel: string; multiplayerLabel: string; open: (screen: Screen) => void; start: () => void }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(drawerOpen, drawerRef, () => setDrawerOpen(false));
  const handleNav = (screen: Screen) => {
    open(screen);
    setDrawerOpen(false);
  };
  return (
    <header className="public-header app-header relative z-20 mx-auto flex w-full max-w-[1680px] items-center justify-between gap-4 px-5 lg:px-8">
      {/* Brand — always returns home. */}
      <button className="app-brand focus-ring" onClick={() => handleNav('home')} aria-label={t.headline} title={t.headline}>
        <span className="app-brand-mark"><PremiumIcon size={24} /></span>
        <span className="app-brand-text"><strong>{t.headline}</strong><small>{t.subtitle}</small></span>
      </button>

      {/* Single menu button opens the side drawer (app-style, no wrapped rows). */}
      <button className="icon-button focus-ring" onClick={() => setDrawerOpen(true)} aria-label={t.menu || 'Menu'} title={t.menu || 'Menu'}>
        <MenuIcon size={22} />
      </button>

      {drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="drawer-panel glass" ref={drawerRef} role="dialog" aria-modal="true" aria-label={t.headline} onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <strong>{t.headline}</strong>
              <button className="icon-button focus-ring" onClick={() => setDrawerOpen(false)} aria-label={t.close || 'Close'} title={t.close || 'Close'}><CloseIcon size={18} /></button>
            </div>
            <div className="drawer-nav" role="navigation" aria-label={t.headline}>
              <button className="drawer-item focus-ring" onClick={() => { setDrawerOpen(false); start(); }}><PlayIcon size={18} />{t.start}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('rules')}><QuestionIcon size={18} />{t.rules}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('multiplayer')}><MultiplayerIcon size={18} />{multiplayerLabel}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('leaderboard')}><LeaderboardIcon size={18} />{t.lbNav}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('submit')}><EditIcon size={18} />{submitLabel}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('profile')}><ProfileIcon size={18} />{t.profile}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('contact')}><SupportIcon size={18} />{t.contact}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('settings')}><SettingsIcon size={18} />{t.settings}</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
