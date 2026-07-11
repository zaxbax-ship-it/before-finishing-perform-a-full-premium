/**
 * Solo gameplay economy — the single source of truth for prize money, lives
 * and purchases.
 *
 * Dependency-free and platform-neutral (like the progression engine): the web
 * client, the tests and the future SwiftUI / Jetpack Compose clients all
 * derive identical numbers from these functions. UI components never do money
 * math themselves.
 *
 * Model: the ladder is an array of rung values. `rung` is the number of
 * questions answered correctly (0-based position on the ladder). The pot a
 * player has accumulated is the value of the last secured rung; everything
 * spent in-game (paid lifeline reuses, the extra life) accumulates in
 * `deductions` and comes out of every payout. Guaranteed milestones define
 * the entitlement floor on a loss — deductions still apply, but a payout can
 * never go below zero.
 */

export const SOLO_INITIAL_LIVES = 3;
/** The extra life costs this fraction of the current (net) pot. */
export const EXTRA_LIFE_POT_FRACTION = 0.5;
/**
 * The largest prize any single game can legitimately award (the top ladder
 * rung). Server-side request validation clamps client-reported prizes to this
 * bound so a forged request can never inflate Career Earnings past it.
 */
export const MAX_GAME_PRIZE = 1_000_000;

export type SoloEndReason = 'win' | 'quit' | 'timeout' | 'lost';

/** Gross accumulated prize for a ladder position (rung 0 = nothing secured). */
export function potForRung(ladder: number[], rung: number): number {
  if (rung <= 0) return 0;
  return ladder[Math.min(rung, ladder.length) - 1] || 0;
}

/** Spendable prize right now: gross pot minus everything spent, never negative. */
export function availablePot(ladder: number[], rung: number, deductions: number): number {
  return Math.max(0, potForRung(ladder, rung) - Math.max(0, deductions));
}

/** Guaranteed milestone floor for a ladder position (existing game rule). */
export function guaranteedForRung(ladder: number[], rung: number): number {
  if (rung > 9) return ladder[9];
  if (rung > 4) return ladder[4];
  return 0;
}

/**
 * Final payout when the game ends. Entitlement follows the game rules
 * (win: top prize, quit: current pot, loss/timeout: guaranteed floor);
 * in-game spending is then settled against it.
 */
export function payoutFor(ladder: number[], rung: number, deductions: number, reason: SoloEndReason): number {
  const entitled =
    reason === 'win' ? ladder[ladder.length - 1] :
    reason === 'quit' ? potForRung(ladder, rung) :
    guaranteedForRung(ladder, rung);
  return Math.max(0, entitled - Math.max(0, deductions));
}

/** Registers an in-game purchase (paid lifeline reuse, extra life). */
export function applyPurchase(deductions: number, price: number): number {
  return Math.max(0, deductions) + Math.max(0, price);
}

/** Official rule: every lifeline can be used at most twice per game. */
export const LIFELINE_MAX_USES = 2;
/** The second use costs this fraction of the player's CURRENT pot. */
export const LIFELINE_SECOND_USE_POT_FRACTION = 0.25;

/**
 * Official lifeline pricing — the single source of truth for every client.
 * Given how many times THIS lifeline was already used:
 *   0 → first use, completely free ($0)
 *   1 → second use, 25% of the player's CURRENT pot (floored). Always
 *       confirmed via the purchase dialog, even when the pot is 0.
 *   2+ → permanently exhausted for the rest of the game; returns null
 */
export function lifelinePrice(currentPot: number, timesUsed: number): number | null {
  if (timesUsed >= LIFELINE_MAX_USES) return null;
  if (timesUsed <= 0) return 0;
  return Math.floor(Math.max(0, currentPot) * LIFELINE_SECOND_USE_POT_FRACTION);
}

/** True once a lifeline has consumed both of its allowed uses. */
export function isLifelineExhausted(timesUsed: number): boolean {
  return timesUsed >= LIFELINE_MAX_USES;
}

/** Price of the one-time extra life: half the current net pot, floored. */
export function extraLifeCost(ladder: number[], rung: number, deductions: number): number {
  return Math.floor(availablePot(ladder, rung, deductions) * EXTRA_LIFE_POT_FRACTION);
}

/**
 * Live availability of a single lifeline. Combines the per-lifeline game-level
 * counter, the pot-eligibility rule (a paid second use needs a positive pot, so
 * a $0 "purchase" can never happen), and the one-lifeline-per-question lock.
 *   'free'             → first game-level use, no cost
 *   'paid'             → second game-level use, 25% of the current pot (pot > 0)
 *   'insufficient-pot' → a second use is due but the pot is still $0, so it is
 *                        not purchasable yet; returns once prize money is earned
 *   'locked-question'  → a lifeline of ANY type was already used on THIS
 *                        question; returns next question if a game use remains
 *   'exhausted'        → both game-level uses are spent (permanent for the game)
 * Precedence: exhausted > locked-question > insufficient-pot > paid > free — a
 * tile never shows a temporary state when it is permanently spent, and the
 * per-question lock is surfaced before the pot reason when both apply.
 */
export type LifelineAvailability = 'free' | 'paid' | 'insufficient-pot' | 'locked-question' | 'exhausted';

export function lifelineAvailability(
  timesUsedThisGame: number,
  anyLifelineUsedThisQuestion: boolean,
  currentPot: number
): LifelineAvailability {
  if (isLifelineExhausted(timesUsedThisGame)) return 'exhausted';
  if (anyLifelineUsedThisQuestion) return 'locked-question';
  if (timesUsedThisGame >= 1) {
    const price = lifelinePrice(currentPot, timesUsedThisGame) ?? 0;
    return price > 0 ? 'paid' : 'insufficient-pot';
  }
  return 'free';
}

/**
 * Whether a lifeline may be activated right now. The single guard every client
 * calls before applying a lifeline: enforces the two-per-game cap, the pot
 * eligibility of a paid second use (never a $0 purchase), and the one-lifeline-
 * per-question rule. Pure, so the web client, the tests and future native
 * clients share one source of truth.
 */
export function canActivateLifeline(
  timesUsedThisGame: number,
  anyLifelineUsedThisQuestion: boolean,
  currentPot: number
): boolean {
  const availability = lifelineAvailability(timesUsedThisGame, anyLifelineUsedThisQuestion, currentPot);
  return availability === 'free' || availability === 'paid';
}
