'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AchievementsIcon, CelebrationIcon, ConfirmIcon, LeaderboardIcon, PremiumIcon, WalletIcon } from '@/lib/design/icons';
import { money } from './format';
import type { RevealItem, RevealType } from '@/lib/rewards/types';

/**
 * Post-game reward ceremony (Phase 14). Plays the engine's ordered reveal queue
 * ONE at a time — never a dashboard wall — inside the Result card. Purely a
 * ceremony surface: it appears only after gameplay, adds nothing to the HUD, and
 * degrades to a calm static list under reduced motion. Minor progress never
 * reaches here (the engine already filters it), so this only celebrates
 * meaningful milestones.
 */

const ADVANCE_MS = 2000;

function headlineKey(type: RevealType): string {
  return `rewards.reveal.${type.replace(/-/g, '_')}`;
}

function iconFor(type: RevealType): ReactNode {
  switch (type) {
    case 'first-millionaire':
    case 'xp-level':
      return <PremiumIcon size={22} aria-hidden="true" />;
    case 'career-earnings':
    case 'career-milestone':
      return <WalletIcon size={22} aria-hidden="true" />;
    case 'personal-record':
    case 'streak':
      return <LeaderboardIcon size={22} aria-hidden="true" />;
    case 'mastery-tier':
      return <ConfirmIcon size={22} aria-hidden="true" />;
    case 'collection-complete':
      return <CelebrationIcon size={22} aria-hidden="true" />;
    default:
      return <AchievementsIcon size={22} aria-hidden="true" />;
  }
}

function valueFor(item: RevealItem, t: Record<string, string>): string {
  const p = item.payload;
  switch (item.type) {
    case 'career-earnings':
    case 'career-milestone':
      return typeof p.amount === 'number' ? money(p.amount) : '';
    case 'personal-record':
      return typeof p.value === 'number' ? money(p.value) : '';
    case 'xp-level':
      return typeof p.level === 'number' ? String(p.level) : '';
    case 'streak':
      return typeof p.current === 'number' ? String(p.current) : '';
    case 'title-unlock':
      return t[`rewards.title.${String(p.title)}.name`] || String(p.title ?? '');
    case 'mastery-tier':
      return t[`rewards.mastery.${String(p.tier)}`] || String(p.tier ?? '');
    default:
      return '';
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

export function RewardReveals({ t, reveals }: { t: Record<string, string>; reveals: RevealItem[] }) {
  const items = useMemo(() => reveals.filter(item => item.type !== 'result'), [reveals]);
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items]);

  useEffect(() => {
    if (reduced || items.length <= 1 || index >= items.length - 1) return;
    const id = window.setTimeout(() => setIndex(value => Math.min(items.length - 1, value + 1)), ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [index, items, reduced]);

  if (items.length === 0) return null;

  if (reduced) {
    return (
      <div className="reward-reveals is-static" role="status">
        <p className="reward-reveals-eyebrow">{t['rewards.reveal.title']}</p>
        {items.map((item, i) => (
          <div key={`${item.type}-${i}`} className="reward-reveal-row">
            <span className="reward-reveal-icon">{iconFor(item.type)}</span>
            <strong>{t[headlineKey(item.type)]}</strong>
            {valueFor(item, t) && <span className="reward-reveal-value">{valueFor(item, t)}</span>}
          </div>
        ))}
      </div>
    );
  }

  const current = items[index];
  const value = valueFor(current, t);
  return (
    <div className="reward-reveals" role="status" aria-live="polite">
      <p className="reward-reveals-eyebrow">{t['rewards.reveal.title']}</p>
      <button
        type="button"
        className={`reward-reveal-hero focus-ring reveal-${current.type}`}
        key={index}
        onClick={() => setIndex(next => Math.min(items.length - 1, next + 1))}
        aria-label={`${t[headlineKey(current.type)]}${value ? ` — ${value}` : ''}`}
      >
        <span className="reward-reveal-icon">{iconFor(current.type)}</span>
        <span className="reward-reveal-copy">
          <strong>{t[headlineKey(current.type)]}</strong>
          {value && <span className="reward-reveal-value">{value}</span>}
        </span>
      </button>
      {items.length > 1 && (
        <div className="reward-reveal-dots" aria-hidden="true">
          {items.map((item, i) => (
            <span key={`${item.type}-${i}`} className={i === index ? 'on' : i < index ? 'seen' : ''} />
          ))}
        </div>
      )}
    </div>
  );
}
