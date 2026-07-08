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

/** Price of the one-time extra life: half the current net pot, floored. */
export function extraLifeCost(ladder: number[], rung: number, deductions: number): number {
  return Math.floor(availablePot(ladder, rung, deductions) * EXTRA_LIFE_POT_FRACTION);
}
