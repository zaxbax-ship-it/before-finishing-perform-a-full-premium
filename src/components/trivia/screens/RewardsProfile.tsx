'use client';

import { useEffect, useState } from 'react';
import { AchievementsIcon, CelebrationIcon, ConfirmIcon, LeaderboardIcon, PremiumIcon, WalletIcon } from '@/lib/design/icons';
import { localizeCategory } from '@/lib/localization';
import type { Locale } from '@/lib/types';
import type { FullProfileDto } from '@/lib/api/contracts/rewards';
import {
  equipCosmeticClient,
  equipTitleClient,
  fetchProfile,
  pinBadgeClient,
  setTrophyClient
} from '@/lib/rewards/client';
import { money } from '../format';
import { Panel } from '../primitives';

/**
 * Profile — the home of identity and depth (never the HUD). One fetch of
 * /api/rewards/profile powers every section. Progressive disclosure: a section
 * appears only once the player has earned its first item, so there are never
 * empty locked grids. Dollars only; reduced-motion + RTL safe (logical layout).
 */
function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="profile-stat">
      <div className={`profile-stat-value ${gold ? 'is-gold' : ''}`}>{value}</div>
      <div className="profile-stat-label">{label}</div>
    </div>
  );
}

export function RewardsProfile({ t, locale, displayName }: { t: Record<string, string>; locale: Locale; displayName: string }) {
  const [profile, setProfile] = useState<FullProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setProfile(await fetchProfile());
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    await fn();
    await load();
    setBusy(false);
  }

  if (loading || !profile) {
    return (
      <Panel title={t['rewards.profile.title']} icon={<PremiumIcon size={26} aria-hidden="true" />}>
        <p className="journey-muted profile-centered">{t['rewards.profile.loading']}</p>
      </Panel>
    );
  }

  const { identity, career, titles, badges, trophyCabinet, showcaseItemIds, mastery, collections, cosmetics } = profile;
  const name = displayName || identity.displayName || '★';
  const monogram = identity.monogramSeed || name.slice(0, 2).toUpperCase();
  const activeTitleName = identity.activeTitleId ? t[`rewards.title.${identity.activeTitleId}.name`] || identity.activeTitleId : t['rewards.profile.title_none'];
  const badgeName = (id: string) => t[`rewards.badge.${id}.name`] || id;
  const unlockedBadges = badges.filter(b => b.unlockedAt);
  const visibleBadges = badges.filter(b => b.unlockedAt || !b.hidden);
  const pinnedIds = identity.pinnedBadgeIds;

  return (
    <Panel title={t['rewards.profile.title']} icon={<PremiumIcon size={26} aria-hidden="true" />}>
      {/* Identity card */}
      <section className="profile-identity" aria-label={t['rewards.profile.identity']}>
        <div className="profile-monogram" aria-hidden="true">{monogram}</div>
        <div className="profile-identity-main">
          <h3 className="profile-name">{name}</h3>
          <span className="profile-title">{activeTitleName}</span>
          <div className="profile-summary">
            <strong>{money(career.lifetimeTotal)}</strong>
            <span className="journey-muted">· {career.gamesPlayed} {t['rewards.profile.career_played']}</span>
          </div>
          {pinnedIds.length > 0 && (
            <div className="profile-pinned">
              {pinnedIds.map(id => <span key={id} className="profile-pin-chip"><ConfirmIcon size={12} aria-hidden="true" />{badgeName(id)}</span>)}
            </div>
          )}
        </div>
      </section>

      {/* Career Earnings */}
      <section className="profile-section">
        <h3 className="profile-section-title"><WalletIcon size={18} aria-hidden="true" />{t['rewards.profile.career']}</h3>
        <div className="profile-stat-grid">
          <Stat label={t['rewards.profile.career_lifetime']} value={money(career.lifetimeTotal)} gold />
          <Stat label={t['rewards.profile.career_best']} value={money(career.bestSingleGame)} />
          <Stat label={t['rewards.profile.career_won']} value={`${career.gamesWon}`} />
          <Stat label={t['rewards.profile.career_millionaire']} value={`${career.millionaireWins}`} />
          <Stat label={t['rewards.profile.career_perfect']} value={`${career.perfectRuns}`} />
          <Stat label={t['rewards.profile.career_played']} value={`${career.gamesPlayed}`} />
        </div>
      </section>

      {/* Titles */}
      {titles.length > 0 && (
        <section className="profile-section">
          <h3 className="profile-section-title"><AchievementsIcon size={18} aria-hidden="true" />{t['rewards.profile.titles']}</h3>
          <div className="profile-chips">
            <button className={`profile-chip focus-ring ${!identity.activeTitleId ? 'is-active' : ''}`} disabled={busy} onClick={() => act(() => equipTitleClient(null))}>{t['rewards.profile.title_none']}</button>
            {titles.map(title => (
              <button key={title.id} className={`profile-chip focus-ring ${identity.activeTitleId === title.id ? 'is-active' : ''}`} disabled={busy} onClick={() => act(() => equipTitleClient(title.id))}>
                {t[`rewards.title.${title.id}.name`] || title.id}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Badges */}
      {unlockedBadges.length > 0 && (
        <section className="profile-section">
          <h3 className="profile-section-title"><AchievementsIcon size={18} aria-hidden="true" />{t['rewards.profile.badges']}</h3>
          <div className="profile-badge-grid">
            {visibleBadges.map(badge => {
              const unlocked = Boolean(badge.unlockedAt);
              const pinned = pinnedIds.includes(badge.id);
              const canPin = unlocked && badge.showcaseEligible;
              return (
                <div key={badge.id} className={`profile-badge rarity-${badge.rarity} ${unlocked ? '' : 'is-locked'}`}>
                  <div className="profile-badge-name">{badgeName(badge.id)}</div>
                  {!unlocked && badge.target > 1 && <div className="profile-badge-progress">{badge.current}/{badge.target}</div>}
                  {canPin && (
                    <button className="profile-badge-pin focus-ring" disabled={busy} onClick={() => act(() => pinBadgeClient(badge.id, !pinned))}>
                      {pinned ? t['rewards.profile.badge_pinned'] : t['rewards.profile.badge_pin']}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Trophy Cabinet */}
      {showcaseItemIds.length > 0 && (
        <section className="profile-section">
          <h3 className="profile-section-title"><LeaderboardIcon size={18} aria-hidden="true" />{t['rewards.profile.trophy']}</h3>
          <div className="profile-trophy-grid">
            {trophyCabinet.slots.map((slot, i) => {
              const available = showcaseItemIds.filter(id => !trophyCabinet.slots.includes(id));
              return (
                <button
                  key={i}
                  className={`profile-trophy-slot focus-ring ${slot ? 'is-filled' : ''}`}
                  disabled={busy || (!slot && available.length === 0)}
                  onClick={() => act(() => (slot ? setTrophyClient(i, null) : setTrophyClient(i, available[0])))}
                >
                  {slot ? badgeName(slot) : <span className="journey-muted">{t['rewards.profile.trophy_empty']}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Category Mastery */}
      {mastery.length > 0 && (
        <section className="profile-section">
          <h3 className="profile-section-title"><ConfirmIcon size={18} aria-hidden="true" />{t['rewards.profile.mastery']}</h3>
          <div className="profile-mastery-list">
            {mastery.map(entry => (
              <div key={entry.categoryId} className="profile-mastery-row">
                <span className="profile-mastery-cat">{localizeCategory(locale, entry.categoryId)}</span>
                <span className="profile-mastery-tier">{t[`rewards.mastery.${entry.tier}`] || entry.tier}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Collections */}
      {collections.some(c => c.earnedItemIds.length > 0) && (
        <section className="profile-section">
          <h3 className="profile-section-title"><CelebrationIcon size={18} aria-hidden="true" />{t['rewards.profile.collections']}</h3>
          {collections.map(collection => (
            <div key={collection.collectionId} className="profile-collection">
              <div className="profile-collection-top">
                <strong>{t[`rewards.collection.${collection.collectionId.replace(/-/g, '_')}.name`] || collection.collectionId}</strong>
                <span className="journey-muted">{collection.earnedItemIds.length}/{collection.totalItems}</span>
              </div>
              <div className="journey-progress" role="progressbar" aria-valuenow={Math.round(collection.completion * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="journey-progress-fill" style={{ width: `${Math.round(collection.completion * 100)}%` }} />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Cosmetics */}
      <section className="profile-section">
        <h3 className="profile-section-title"><PremiumIcon size={18} aria-hidden="true" />{t['rewards.profile.cosmetics']}</h3>
        <div className="profile-chips">
          {cosmetics.map(cosmetic => (
            <button key={cosmetic.cosmeticId} className={`profile-chip focus-ring ${cosmetic.equipped ? 'is-active' : ''}`} disabled={busy} onClick={() => act(() => equipCosmeticClient(cosmetic.cosmeticId))}>
              {t[`rewards.cosmetic.${cosmetic.cosmeticId.replace(/-/g, '_')}`] || cosmetic.cosmeticId}
            </button>
          ))}
        </div>
      </section>
    </Panel>
  );
}
