'use client';

import { useEffect, useState } from 'react';
import { CelebrationIcon, HintsIcon, LeaderboardIcon } from '@/lib/design/icons';
import type { Locale } from '@/lib/types';
import type { DailyChallengeDto, RewardsSummaryDto, WeeklyObjectivesDto } from '@/lib/api/contracts/rewards';
import {
  claimWeeklyObjectiveClient,
  completeDailyCheckin,
  fetchDailyChallenge,
  fetchRewardsSummary,
  fetchWeeklyObjectives
} from '@/lib/rewards/client';
import { fmt, money } from '../format';
import { Panel } from '../primitives';

/**
 * Journey / Challenges — the home of daily & weekly engagement (never the HUD).
 * Reads the rewards summary + daily + weekly from the API and lets the player
 * check in and claim, all in dollars. Progressive: empty states invite rather
 * than show locked grids. Reduced-motion + RTL safe (logical layout).
 */
export function Journey({ t }: { t: Record<string, string>; locale: Locale }) {
  const [summary, setSummary] = useState<RewardsSummaryDto | null>(null);
  const [daily, setDaily] = useState<DailyChallengeDto | null>(null);
  const [weekly, setWeekly] = useState<WeeklyObjectivesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const [s, d, w] = await Promise.all([fetchRewardsSummary(), fetchDailyChallenge(), fetchWeeklyObjectives()]);
    setSummary(s);
    setDaily(d);
    setWeekly(w);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function checkIn() {
    setBusy('daily');
    await completeDailyCheckin(true);
    await load();
    setBusy(null);
  }

  async function claim(objectiveId: string) {
    setBusy(objectiveId);
    await claimWeeklyObjectiveClient(objectiveId);
    await load();
    setBusy(null);
  }

  const streak = summary?.streak;
  const dailyAvailable = daily ? daily.available : summary?.dailyAvailable ?? true;

  return (
    <Panel title={t['rewards.journey.title']} icon={<CelebrationIcon size={26} aria-hidden="true" />}>
      <p className="journey-subtitle">{t['rewards.journey.subtitle']}</p>

      <div className="journey-grid">
        <section className="journey-card" aria-label={t['rewards.journey.streak_title']}>
          <div className="journey-card-head"><LeaderboardIcon size={18} aria-hidden="true" /><h3>{t['rewards.journey.streak_title']}</h3></div>
          {streak && streak.current > 0 ? (
            <>
              <div className="journey-streak-value">{fmt(t['rewards.journey.streak_days'], { count: streak.current })}</div>
              <div className="journey-muted">{fmt(t['rewards.journey.streak_best'], { count: streak.longest })}</div>
            </>
          ) : (
            <p className="journey-muted">{t['rewards.journey.streak_none']}</p>
          )}
        </section>

        <section className="journey-card" aria-label={t['rewards.journey.daily_title']}>
          <div className="journey-card-head"><HintsIcon size={18} aria-hidden="true" /><h3>{t['rewards.journey.daily_title']}</h3></div>
          <p className="journey-muted">{dailyAvailable ? t['rewards.journey.daily_available'] : t['rewards.journey.daily_done']}</p>
          <button className="premium-button focus-ring journey-action" disabled={!dailyAvailable || busy === 'daily'} onClick={checkIn}>
            {t['rewards.journey.daily_cta']}{daily ? ` · ${money(daily.rewardAmount)}` : ''}
          </button>
        </section>
      </div>

      <div className="journey-weekly">
        <h3 className="journey-weekly-title">{t['rewards.journey.weekly_title']}</h3>
        {loading && <p className="journey-muted">{t['rewards.journey.loading']}</p>}
        {!loading && (!weekly || weekly.objectives.length === 0) && <p className="journey-muted">{t['rewards.journey.weekly_empty']}</p>}
        <div className="journey-objectives">
          {weekly?.objectives.map(objective => {
            const pct = objective.target > 0 ? Math.min(100, Math.round((objective.progress / objective.target) * 100)) : 0;
            const complete = objective.progress >= objective.target;
            return (
              <div key={objective.objectiveId} className={`journey-objective ${complete ? 'is-complete' : ''}`}>
                <div className="journey-objective-top">
                  <strong>{t[`rewards.weekly.${objective.objectiveId}.name`] || objective.objectiveId}</strong>
                  <span className="journey-objective-reward">{money(objective.rewardAmount)}</span>
                </div>
                <p className="journey-muted journey-objective-desc">{t[`rewards.weekly.${objective.objectiveId}.desc`] || ''}</p>
                <div className="journey-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="journey-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="journey-objective-bottom">
                  <span className="journey-muted">{objective.progress}/{objective.target}</span>
                  <button
                    className="ghost-button focus-ring journey-claim"
                    disabled={!complete || objective.claimed || busy === objective.objectiveId}
                    onClick={() => claim(objective.objectiveId)}
                  >
                    {objective.claimed ? t['rewards.journey.claimed'] : t['rewards.journey.claim']}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
