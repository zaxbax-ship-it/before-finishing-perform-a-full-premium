'use client';

import { useState } from 'react';
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

export function Header({ t, submitLabel, multiplayerLabel, open, start }: { t: Record<string, string>; submitLabel: string; multiplayerLabel: string; open: (screen: Screen) => void; start: () => void }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const handleNav = (screen: Screen) => {
    open(screen);
    setDrawerOpen(false);
  };
  return (
    <header className="public-header relative z-20 mx-auto flex w-full max-w-[1680px] items-center justify-between gap-4 px-5 pt-5 lg:px-8">
      <button className="focus-ring flex items-center gap-3 text-right" onClick={() => handleNav('home')} aria-label={t.headline} title={t.headline}>
        <span className="grid h-12 w-12 place-items-center rounded-[18px] bg-gold text-royal shadow-gold"><PremiumIcon size={24} /></span>
        <span><strong className="block text-xl font-black">{t.headline}</strong><small className="text-white/65">{t.subtitle}</small></span>
      </button>

      {/* Desktop Navigation */}
      <nav className="hidden md:flex flex-wrap items-center gap-3">
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => handleNav('rules')}><QuestionIcon size={16} />{t.rules}</button>
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => handleNav('multiplayer')}><MultiplayerIcon size={16} />{multiplayerLabel}</button>
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => handleNav('leaderboard')}><LeaderboardIcon size={16} />{t.lbNav}</button>
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => handleNav('submit')}><EditIcon size={16} />{submitLabel}</button>
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => handleNav('contact')}><SupportIcon size={16} />{t.contact}</button>
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => handleNav('profile')}><ProfileIcon size={16} />{t.profile}</button>
        <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => handleNav('settings')}><SettingsIcon size={16} />{t.settings}</button>
        <button className="premium-button focus-ring inline-flex items-center gap-2" onClick={start}><PlayIcon size={16} />{t.start}</button>
      </nav>

      {/* Mobile Actions */}
      <div className="flex items-center gap-3 md:hidden">
        <button className="premium-button focus-ring inline-flex items-center gap-2 !min-h-[42px] !px-4" onClick={start} aria-label={t.start}><PlayIcon size={14} /></button>
        <button className="ghost-button focus-ring p-3 rounded-full !min-h-[42px]" onClick={() => setDrawerOpen(true)} aria-label="Open menu"><MenuIcon size={20} /></button>
      </div>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="drawer-panel glass" onClick={e => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <strong className="text-xl font-black text-gold">{t.headline}</strong>
              <button className="ghost-button focus-ring rounded-full !min-h-[38px] p-2" onClick={() => setDrawerOpen(false)} aria-label="Close menu"><CloseIcon size={16} /></button>
            </div>
            <nav className="flex flex-col gap-3">
              <button className="drawer-item focus-ring" onClick={() => handleNav('rules')}><QuestionIcon size={18} />{t.rules}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('multiplayer')}><MultiplayerIcon size={18} />{multiplayerLabel}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('leaderboard')}><LeaderboardIcon size={18} />{t.lbNav}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('submit')}><EditIcon size={18} />{submitLabel}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('contact')}><SupportIcon size={18} />{t.contact}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('profile')}><ProfileIcon size={18} />{t.profile}</button>
              <button className="drawer-item focus-ring" onClick={() => handleNav('settings')}><SettingsIcon size={18} />{t.settings}</button>
              <button className="premium-button focus-ring w-full mt-4" onClick={() => { setDrawerOpen(false); start(); }}><PlayIcon size={16} />{t.start}</button>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
