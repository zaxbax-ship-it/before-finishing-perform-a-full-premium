import { describe, expect, it } from 'vitest';
import {
  activeWeeklyObjectives,
  appendCareerEntry,
  applyGameToCareer,
  applyGameToMastery,
  applyResultToWeekly,
  applyStreakDay,
  badgeCatalogueFor,
  buildRevealQueue,
  claimDailyReward,
  claimWeeklyObjective,
  collectionCompletion,
  completeDailyQuestion,
  computeDisclosure,
  crossedCareerMilestones,
  dailyChallengeIndex,
  defaultIdentity,
  earnCollectionItem,
  emptyCareer,
  emptyCabinet,
  emptyCollection,
  emptyMastery,
  emptyStreak,
  equipCosmetic,
  equipTitle,
  evaluateBadges,
  evaluateTitles,
  grantCosmetic,
  hasEarnedMedallion,
  initWeeklyProgress,
  MAX_PINNED_BADGES,
  masteryTierForXp,
  monogramFor,
  pinBadge,
  pinTrophy,
  previousDayKey,
  recordMilestone,
  repairStreak,
  resetWeeklyIfNeeded,
  starterEntitlements,
  startDailyQuestion,
  toDayKey,
  toWeekKey,
  WEEKLY_ACTIVE_COUNT
} from '@/lib/rewards';
import type { CareerLedgerEntry, PlayerRewardContext, RewardGameResult, TimelineEvent } from '@/lib/rewards/types';

const NOW = '2026-07-10T12:00:00.000Z';

function ctx(partial: Partial<PlayerRewardContext> = {}): PlayerRewardContext {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    perfectRuns: 0,
    millionaireWins: 0,
    lifelineFreeWins: 0,
    comebackWins: 0,
    fastAnswerTotal: 0,
    multiplayerWins: 0,
    careerLifetime: 0,
    longestStreak: 0,
    currentStreak: 0,
    distinctCategoriesPlayed: 0,
    masteryTiersReached: {},
    unlockedBadgeIds: [],
    unlockedTitleIds: [],
    ownedShowcaseItemIds: [],
    ownedNonStarterCosmetics: 0,
    ...partial
  };
}

function game(partial: Partial<RewardGameResult> = {}): RewardGameResult {
  return {
    mode: 'solo',
    won: true,
    cashedOut: false,
    correctAnswers: 15,
    questionsFaced: 15,
    prize: 1_000_000,
    lifelinesUsed: 0,
    category: 'science',
    livesLostBeforeWin: 0,
    fastAnswers: 0,
    playedAt: NOW,
    ...partial
  };
}

describe('Career Earnings — accumulation, idempotency, no negative balance', () => {
  it('accumulates lifetime + aggregates across games', () => {
    let career = emptyCareer();
    career = applyGameToCareer(career, game({ prize: 20_000, correctAnswers: 5 }), 'game-1', 'e1', NOW);
    career = applyGameToCareer(career, game({ prize: 1_000_000 }), 'game-2', 'e2', NOW);
    expect(career.lifetimeTotal).toBe(1_020_000);
    expect(career.gamesPlayed).toBe(2);
    expect(career.millionaireWins).toBe(1);
    expect(career.perfectRuns).toBe(1); // the 15/15 game
    expect(career.bestSingleGame).toBe(1_000_000);
  });

  it('is idempotent — re-applying the same game changes nothing', () => {
    let career = emptyCareer();
    career = applyGameToCareer(career, game({ prize: 50_000 }), 'game-x', 'e1', NOW);
    const again = applyGameToCareer(career, game({ prize: 50_000 }), 'game-x', 'e2', NOW);
    expect(again).toEqual(career);
    expect(again.gamesPlayed).toBe(1);
  });

  it('appendCareerEntry dedupes by idempotency key and never goes negative', () => {
    const credit: CareerLedgerEntry = { id: 'a', kind: 'game-win', amount: 1000, idempotencyKey: 'k1', createdAt: NOW };
    let career = appendCareerEntry(emptyCareer(), credit);
    career = appendCareerEntry(career, { ...credit, id: 'b' }); // same key => no-op
    expect(career.ledger).toHaveLength(1);
    expect(career.spendableBalance).toBe(1000);

    const overdraw: CareerLedgerEntry = { id: 'c', kind: 'cosmetic-purchase', amount: -5000, idempotencyKey: 'k2', createdAt: NOW };
    const rejected = appendCareerEntry(career, overdraw);
    expect(rejected).toEqual(career); // debit larger than balance is rejected
    expect(rejected.spendableBalance).toBe(1000);
  });

  it('reports career milestones crossed', () => {
    expect(crossedCareerMilestones(0, 150_000)).toEqual([100_000]);
    expect(crossedCareerMilestones(100_000, 1_200_000)).toEqual([1_000_000]);
    expect(crossedCareerMilestones(2_000_000, 2_500_000)).toEqual([]);
  });
});

describe('Timezone-safe day/week keys and streak', () => {
  it('computes local day keys per timezone offset', () => {
    // 2026-07-10T23:30Z is still the 10th in UTC but the 11th at UTC+3.
    expect(toDayKey('2026-07-10T23:30:00Z', 0)).toBe('2026-07-10');
    expect(toDayKey('2026-07-10T23:30:00Z', 180)).toBe('2026-07-11');
    expect(previousDayKey('2026-07-11')).toBe('2026-07-10');
    expect(toWeekKey('2026-07-10')).toBe('2026-W28');
  });

  it('increments once per day, dedupes same-day, resets on a gap', () => {
    let s = emptyStreak();
    s = applyStreakDay(s, '2026-07-08');
    expect(s.current).toBe(1);
    s = applyStreakDay(s, '2026-07-08'); // same day again — no double increment
    expect(s.current).toBe(1);
    s = applyStreakDay(s, '2026-07-09');
    expect(s.current).toBe(2);
    s = applyStreakDay(s, '2026-07-11'); // skipped the 10th — reset
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
  });

  it('repairs exactly one missed day, at most once per week', () => {
    // All dates below sit inside ISO week 2026-W28 (Mon 07-06 .. Sun 07-12).
    let s = emptyStreak();
    s = applyStreakDay(s, '2026-07-06'); // current 1
    s = applyStreakDay(s, '2026-07-07'); // current 2
    // Missed the 8th; return on the 9th and repair the single gap.
    const repaired = repairStreak(s, '2026-07-09');
    expect(repaired.repaired).toBe(true);
    expect(repaired.streak.current).toBe(3);
    // A second repair in the SAME ISO week is refused.
    const second = repairStreak(repaired.streak, '2026-07-11');
    expect(second.repaired).toBe(false);
  });
});

describe('Category mastery — skill-gated, monotonic, medallion', () => {
  it('gates tiers by an accuracy floor so grinding wrong answers cannot buy mastery', () => {
    // High XP but poor accuracy stays capped below the gated tiers.
    expect(masteryTierForXp(2000, 0.2)).toBe('apprentice'); // only the 0-accuracy floor passes
    expect(masteryTierForXp(2000, 0.85)).toBe('grandmaster');
    expect(masteryTierForXp(400, 0.6)).toBe('expert');
  });

  it('accumulates and never demotes', () => {
    let m = emptyMastery('science');
    // 14 perfect games = 210 correct × 10 XP = 2100 XP (>= grandmaster's 2000), accuracy 1.0.
    for (let i = 0; i < 14; i += 1) m = applyGameToMastery(m, 15, 15);
    expect(m.tier).toBe('grandmaster');
    expect(hasEarnedMedallion(m)).toBe(true);
    const before = m.tier;
    m = applyGameToMastery(m, 0, 15); // a bad game
    expect(m.tier).toBe(before); // monotonic — no demotion
  });
});

describe('Badges — unlock-once, deterministic order, rarity', () => {
  it('unlocks newly-earned badges in catalogue order and skips already-unlocked', () => {
    const first = evaluateBadges(ctx({ gamesPlayed: 1, gamesWon: 1 }), [], NOW);
    const ids = first.map(b => b.id);
    expect(ids).toContain('first_game');
    expect(ids).toContain('first_win');
    expect(ids.indexOf('first_game')).toBeLessThan(ids.indexOf('first_win')); // deterministic order
    // Re-evaluating with them already unlocked yields nothing new.
    expect(evaluateBadges(ctx({ gamesPlayed: 1, gamesWon: 1 }), ids, NOW)).toHaveLength(0);
  });

  it('projects progress toward locked badges without unlocking them', () => {
    const cat = badgeCatalogueFor(ctx({ gamesWon: 4 }), ['first_game']);
    const tenWins = cat.find(b => b.id === 'ten_wins');
    expect(tenWins?.current).toBe(4);
    expect(tenWins?.unlockedAt).toBeNull();
  });
});

describe('Titles — earned only, equip validation', () => {
  it('earns titles from context and never from purchase', () => {
    const earned = evaluateTitles(ctx({ gamesPlayed: 1 }), [], NOW).map(t => t.id);
    expect(earned).toContain('rookie');
  });

  it('equips only earned titles', () => {
    const identity = defaultIdentity('p1', 'Ada Lovelace');
    const withTitle = equipTitle(identity, 'rookie', ['rookie']);
    expect(withTitle.activeTitleId).toBe('rookie');
    const rejected = equipTitle(identity, 'grandmaster', ['rookie']); // not earned
    expect(rejected.activeTitleId).toBeNull();
  });
});

describe('Identity, pinned badges, trophy cabinet', () => {
  it('builds a complete quiet default identity', () => {
    const id = defaultIdentity('p1', 'Ada Lovelace');
    expect(monogramFor('Ada Lovelace')).toBe('AL');
    expect(id.profileFrameId).toBe('frame-classic');
    expect(id.equippedThemeId).toBe('theme-studio');
    expect(id.pinnedBadgeIds).toEqual([]);
  });

  it('enforces the three-pin limit and ownership', () => {
    let id = defaultIdentity('p1', 'Ada');
    const owned = ['perfect_game', 'millionaire', 'comeback', 'streak_30'];
    id = pinBadge(id, 'perfect_game', owned);
    id = pinBadge(id, 'millionaire', owned);
    id = pinBadge(id, 'comeback', owned);
    id = pinBadge(id, 'streak_30', owned); // 4th — refused
    expect(id.pinnedBadgeIds).toHaveLength(MAX_PINNED_BADGES);
    const unowned = pinBadge(defaultIdentity('p2', 'B'), 'first_win', owned);
    expect(unowned.pinnedBadgeIds).toEqual([]); // not owned => no pin
  });

  it('only lets earned, eligible items into cabinet slots — no duplicates', () => {
    let cab = emptyCabinet(6);
    cab = pinTrophy(cab, 0, 'millionaire', ['millionaire', 'perfect_game']);
    expect(cab.slots[0]).toBe('millionaire');
    cab = pinTrophy(cab, 1, 'millionaire', ['millionaire', 'perfect_game']); // duplicate — refused
    expect(cab.slots[1]).toBeNull();
    cab = pinTrophy(cab, 1, 'not_owned', ['millionaire']); // ineligible — refused
    expect(cab.slots[1]).toBeNull();
  });
});

describe('Collections — completion once', () => {
  it('earns items idempotently and completes when all owned', () => {
    const all = ['medallion:science', 'medallion:history'];
    let col = emptyCollection('category-medallions');
    col = earnCollectionItem(col, 'medallion:science', all, 'title');
    col = earnCollectionItem(col, 'medallion:science', all, 'title'); // dupe — no-op
    expect(col.completed).toBe(false);
    expect(collectionCompletion(col, all)).toBe(0.5);
    col = earnCollectionItem(col, 'medallion:history', all, 'title');
    expect(col.completed).toBe(true);
    expect(col.completionReward).toBe('title');
  });
});

describe('Weekly objectives — reset, progress, claim once', () => {
  it('activates at most 3 per week and resets on a new week', () => {
    const week = initWeeklyProgress('2026-W28');
    expect(week.length).toBeLessThanOrEqual(WEEKLY_ACTIVE_COUNT);
    expect(activeWeeklyObjectives('2026-W28').length).toBeLessThanOrEqual(WEEKLY_ACTIVE_COUNT);
    const kept = resetWeeklyIfNeeded(week, '2026-W28');
    expect(kept).toBe(week); // same week — unchanged reference
    const fresh = resetWeeklyIfNeeded(week, '2026-W29');
    expect(fresh[0].weekKey).toBe('2026-W29');
  });

  it('tracks progress and claims exactly once', () => {
    let week = initWeeklyProgress('2026-W28');
    const target = week.find(o => o.objectiveId === 'play_three');
    if (target) {
      for (let i = 0; i < 3; i += 1) week = applyResultToWeekly(week, game({ prize: 0, won: false }));
      const first = claimWeeklyObjective(week, 'play_three');
      expect(first.reward).toBeGreaterThan(0);
      const second = claimWeeklyObjective(first.objectives, 'play_three');
      expect(second.reward).toBe(0); // already claimed
    }
  });
});

describe('Daily question — deterministic, once per day', () => {
  it('is deterministic per day and grants the reward once', () => {
    expect(dailyChallengeIndex('2026-07-10', 100)).toBe(dailyChallengeIndex('2026-07-10', 100));
    expect(dailyChallengeIndex('2026-07-10', 100)).toBeLessThan(100);
    let state = startDailyQuestion(null, '2026-07-10', 'q-42');
    state = completeDailyQuestion(state, true);
    state = completeDailyQuestion(state, false); // second answer ignored
    expect(state.correct).toBe(true);
    const claim1 = claimDailyReward(state);
    expect(claim1.reward).toBeGreaterThan(0);
    const claim2 = claimDailyReward(claim1.state);
    expect(claim2.reward).toBe(0); // no repeat through refresh / multi-tab
  });

  it('does not restart an already-started day', () => {
    const started = startDailyQuestion(null, '2026-07-10', 'q-1');
    const again = startDailyQuestion(started, '2026-07-10', 'q-2');
    expect(again).toBe(started);
  });
});

describe('Cosmetics — starter defaults, equip within a type', () => {
  it('every player owns starters with one equipped per type', () => {
    const ents = starterEntitlements(NOW);
    const theme = ents.filter(e => e.type === 'theme');
    expect(theme.some(e => e.equipped)).toBe(true);
  });

  it('grants and equips, unequipping others of the same type', () => {
    let ents = starterEntitlements(NOW);
    ents = grantCosmetic(ents, 'theme-midnight', NOW);
    ents = grantCosmetic(ents, 'theme-midnight', NOW); // dupe — no-op
    ents = equipCosmetic(ents, 'theme-midnight');
    const themes = ents.filter(e => e.type === 'theme');
    expect(themes.filter(e => e.equipped)).toHaveLength(1);
    expect(themes.find(e => e.equipped)?.cosmeticId).toBe('theme-midnight');
    const unowned = equipCosmetic(ents, 'does-not-exist');
    expect(unowned).toBe(ents); // no-op
  });
});

describe('Profile timeline — milestone dedupe', () => {
  it('records a natural key only once', () => {
    const ev: TimelineEvent = { id: '1', type: 'first-win', copyKey: 'k', timestamp: NOW, visible: true };
    let events = recordMilestone([], ev);
    events = recordMilestone(events, { ...ev, id: '2' }); // same natural key
    expect(events).toHaveLength(1);
    events = recordMilestone(events, { id: '3', type: 'mastery-tier', copyKey: 'k', timestamp: NOW, visible: true, metadata: { category: 'science', tier: 'master' } });
    events = recordMilestone(events, { id: '4', type: 'mastery-tier', copyKey: 'k', timestamp: NOW, visible: true, metadata: { category: 'science', tier: 'master' } });
    expect(events).toHaveLength(2); // distinct natural key, but its dupe ignored
  });
});

describe('Reward reveal queue — deterministic order, quiet minors', () => {
  it('always leads with result and orders meaningful moments', () => {
    const queue = buildRevealQueue({
      careerDelta: 20000,
      leveledUp: true,
      newLevel: 3,
      streakChanged: true,
      streakCurrent: 4,
      newTitleIds: ['quizmaster'],
      newBadges: [{ id: 'triple_millionaire', category: 'millionaire', rarity: 'legendary', nameKey: '', descriptionKey: '', target: 3, current: 3, unlockedAt: NOW, hidden: false, showcaseEligible: true }],
      masteryTierUps: [{ category: 'science', tier: 'master' }],
      completedCollections: ['category-medallions'],
      firstMillionaire: true
    });
    const priorities = queue.map(r => r.priority);
    expect(queue[0].type).toBe('result');
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b)); // already sorted ascending
    const types = queue.map(r => r.type);
    expect(types).toContain('first-millionaire');
    expect(types).toContain('legendary-badge');
    expect(types.indexOf('career-earnings')).toBeLessThan(types.indexOf('title-unlock'));
  });

  it('stays quiet on a nothing game', () => {
    const queue = buildRevealQueue({
      careerDelta: 0,
      leveledUp: false,
      streakChanged: false,
      newTitleIds: [],
      newBadges: [{ id: 'first_game', category: 'milestone', rarity: 'common', nameKey: '', descriptionKey: '', target: 1, current: 1, unlockedAt: NOW, hidden: false, showcaseEligible: false }],
      masteryTierUps: [],
      completedCollections: [],
      firstMillionaire: false
    });
    // Only the result — the common badge stays quiet (surfaces in the grid, not as ceremony).
    expect(queue.map(r => r.type)).toEqual(['result']);
  });
});

describe('Progressive disclosure — earned before shown', () => {
  it('reveals surfaces only once their first item exists', () => {
    const fresh = computeDisclosure(ctx({ gamesPlayed: 1 }), emptyStreak());
    expect(fresh.streakGlyphVisible).toBe(false);
    expect(fresh.masteryVisible).toBe(false);
    expect(fresh.trophyCabinetVisible).toBe(false);
    expect(fresh.journeyVisible).toBe(true); // daily/weekly are immediately actionable

    const seasoned = computeDisclosure(
      ctx({ gamesPlayed: 12, masteryTiersReached: { science: 'master' }, ownedShowcaseItemIds: ['millionaire'], careerLifetime: 500_000 }),
      { current: 5, longest: 5, lastQualifyingDay: '2026-07-10', repairUsedWeek: null }
    );
    expect(seasoned.streakGlyphVisible).toBe(true);
    expect(seasoned.masteryVisible).toBe(true);
    expect(seasoned.trophyCabinetVisible).toBe(true);
    expect(seasoned.collectionsVisible).toBe(true);
    expect(seasoned.storeVisible).toBe(true);
  });
});
