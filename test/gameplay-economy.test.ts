import { describe, expect, it } from 'vitest';
import {
  EXTRA_LIFE_POT_FRACTION,
  LIFELINE_MAX_USES,
  SOLO_INITIAL_LIVES,
  applyPurchase,
  availablePot,
  extraLifeCost,
  guaranteedForRung,
  isLifelineExhausted,
  lifelinePrice,
  payoutFor,
  potForRung
} from '@/lib/gameplay/economy';
import { MONEY, SAFE_STEPS } from '@/components/trivia/constants';

describe('solo gameplay economy', () => {
  it('derives the pot from the last secured rung', () => {
    expect(potForRung(MONEY, 0)).toBe(0);
    expect(potForRung(MONEY, 1)).toBe(1000);
    expect(potForRung(MONEY, 5)).toBe(20000);
    expect(potForRung(MONEY, 15)).toBe(1000000);
    expect(potForRung(MONEY, 99)).toBe(1000000);
  });

  it('deducts purchases from the pot and never goes negative', () => {
    expect(availablePot(MONEY, 5, 0)).toBe(20000);
    expect(availablePot(MONEY, 5, 5000)).toBe(15000);
    expect(availablePot(MONEY, 5, 999999)).toBe(0);
    expect(availablePot(MONEY, 5, -50)).toBe(20000);
  });

  it('keeps the guaranteed milestones exactly as the game defines them', () => {
    expect(guaranteedForRung(MONEY, 0)).toBe(0);
    expect(guaranteedForRung(MONEY, 4)).toBe(0);
    expect(guaranteedForRung(MONEY, 5)).toBe(MONEY[4]);
    expect(guaranteedForRung(MONEY, 9)).toBe(MONEY[4]);
    expect(guaranteedForRung(MONEY, 10)).toBe(MONEY[9]);
    expect(guaranteedForRung(MONEY, 15)).toBe(MONEY[9]);
    // sanity: milestones sit on the documented safe steps
    expect(SAFE_STEPS).toEqual([4, 9, 14]);
  });

  it('settles payouts by reason, after deductions, floored at zero', () => {
    expect(payoutFor(MONEY, 15, 0, 'win')).toBe(1000000);
    expect(payoutFor(MONEY, 15, 400000, 'win')).toBe(600000);
    expect(payoutFor(MONEY, 7, 0, 'quit')).toBe(potForRung(MONEY, 7));
    expect(payoutFor(MONEY, 7, 10000, 'quit')).toBe(potForRung(MONEY, 7) - 10000);
    expect(payoutFor(MONEY, 7, 0, 'lost')).toBe(MONEY[4]);
    expect(payoutFor(MONEY, 7, 0, 'timeout')).toBe(MONEY[4]);
    expect(payoutFor(MONEY, 7, 999999, 'lost')).toBe(0);
    expect(payoutFor(MONEY, 2, 0, 'lost')).toBe(0);
  });

  it('accumulates purchases and ignores negative prices', () => {
    expect(applyPurchase(0, 5000)).toBe(5000);
    expect(applyPurchase(5000, 8000)).toBe(13000);
    expect(applyPurchase(5000, -100)).toBe(5000);
  });

  it('prices the extra life at exactly half the net pot, floored', () => {
    expect(EXTRA_LIFE_POT_FRACTION).toBe(0.5);
    expect(extraLifeCost(MONEY, 5, 0)).toBe(10000);
    expect(extraLifeCost(MONEY, 5, 5000)).toBe(7500);
    expect(extraLifeCost(MONEY, 1, 0)).toBe(500);
    expect(extraLifeCost(MONEY, 0, 0)).toBe(0);
  });

  it('buying the extra life halves the remaining payout potential consistently', () => {
    // rung 10 secured (pot 400,000): buy life -> deduct 200,000
    const cost = extraLifeCost(MONEY, 10, 0);
    expect(cost).toBe(200000);
    const deductions = applyPurchase(0, cost);
    expect(availablePot(MONEY, 10, deductions)).toBe(200000);
    // losing afterwards keeps guaranteed(10) - deductions, floored at zero
    expect(payoutFor(MONEY, 10, deductions, 'lost')).toBe(Math.max(0, MONEY[9] - deductions));
  });

  it('exposes the initial lives constant for every client', () => {
    expect(SOLO_INITIAL_LIVES).toBe(3);
  });
});

describe('Official lifeline usage rules', () => {
  const ladder = [1000, 2000, 5000, 10000, 20000, 40000, 80000, 150000, 250000, 400000, 550000, 700000, 850000, 1000000, 1000000];

  it('first use of any lifeline is completely free', () => {
    expect(lifelinePrice(ladder, 0, 0)).toBe(0);
    expect(lifelinePrice(ladder, 7, 0)).toBe(0);
    expect(lifelinePrice(ladder, 14, 0)).toBe(0);
  });

  it('second use costs exactly 50% of the previous completed rung value', () => {
    // 4 completed rungs -> previous rung value $10,000 -> price $5,000
    expect(lifelinePrice(ladder, 4, 1)).toBe(5000);
    // 1 completed rung -> $1,000 -> $500
    expect(lifelinePrice(ladder, 1, 1)).toBe(500);
    // the documented example shape: rung worth $8,000 -> $4,000
    expect(lifelinePrice([8000], 1, 1)).toBe(4000);
    // nothing completed yet -> 50% of nothing
    expect(lifelinePrice(ladder, 0, 1)).toBe(0);
  });

  it('never prices from the current pot after deductions (rung value only)', () => {
    // Deductions do not exist in this signature by design: the price depends
    // only on the ladder and the completed rung.
    expect(lifelinePrice(ladder, 4, 1)).toBe(ladder[3] / 2);
  });

  it('a third use is never allowed', () => {
    expect(lifelinePrice(ladder, 4, 2)).toBeNull();
    expect(lifelinePrice(ladder, 14, 5)).toBeNull();
    expect(isLifelineExhausted(2)).toBe(true);
    expect(isLifelineExhausted(1)).toBe(false);
    expect(LIFELINE_MAX_USES).toBe(2);
  });

  it('usage counters are independent per lifeline (pricing is per counter)', () => {
    const uses = { fifty: 2, swap: 1, phone: 0, audience: 0 };
    expect(lifelinePrice(ladder, 4, uses.fifty)).toBeNull();       // exhausted
    expect(lifelinePrice(ladder, 4, uses.swap)).toBe(5000);        // paid second use
    expect(lifelinePrice(ladder, 4, uses.phone)).toBe(0);          // still free
    expect(lifelinePrice(ladder, 4, uses.audience)).toBe(0);       // still free
  });
});
