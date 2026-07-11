import { MONEY } from './constants';

/**
 * Stage 20C — the compact VISUAL milestone model. The underlying game is still
 * 15 questions with the real MONEY economy; these 8 milestones simply GROUP the
 * questions into a ladder that fits one mobile viewport. Milestone amounts are
 * representative values taken directly from the official MONEY table — nothing
 * is invented. Advances happen roughly every two correct answers; the final
 * milestone is the $1,000,000 completion.
 *
 *   milestone  minCorrect  questions   displayed prize (from MONEY)
 *   M0 opening      0        (start)    MONEY[0]  = $1,000
 *   M1              2         1–2       MONEY[1]  = $2,000
 *   M2              4         3–4       MONEY[3]  = $10,000
 *   M3              6         5–6       MONEY[5]  = $40,000
 *   M4              8         7–8       MONEY[7]  = $150,000
 *   M5             10         9–10      MONEY[9]  = $400,000  (a guaranteed rung)
 *   M6             12        11–12      MONEY[11] = $700,000
 *   M7 final       15        13–15      MONEY[14] = $1,000,000
 */
export type MilestoneState = 'completed' | 'current' | 'locked';

export type Milestone = {
  id: number;
  /** Correct answers required to REACH this milestone. */
  minCorrect: number;
  /** Displayed prize, an existing MONEY value. */
  prize: number;
  /** Inclusive question range this milestone represents (1-indexed; 0 = start). */
  fromQuestion: number;
  toQuestion: number;
};

export const MILESTONES: Milestone[] = [
  { id: 0, minCorrect: 0, prize: MONEY[0], fromQuestion: 0, toQuestion: 0 },
  { id: 1, minCorrect: 2, prize: MONEY[1], fromQuestion: 1, toQuestion: 2 },
  { id: 2, minCorrect: 4, prize: MONEY[3], fromQuestion: 3, toQuestion: 4 },
  { id: 3, minCorrect: 6, prize: MONEY[5], fromQuestion: 5, toQuestion: 6 },
  { id: 4, minCorrect: 8, prize: MONEY[7], fromQuestion: 7, toQuestion: 8 },
  { id: 5, minCorrect: 10, prize: MONEY[9], fromQuestion: 9, toQuestion: 10 },
  { id: 6, minCorrect: 12, prize: MONEY[11], fromQuestion: 11, toQuestion: 12 },
  { id: 7, minCorrect: 15, prize: MONEY[14], fromQuestion: 13, toQuestion: 15 }
];

/** Fewer than the 15 rungs — the compact visible count. */
export const MILESTONE_COUNT = MILESTONES.length;

/** Index of the current milestone for a given number of correct answers. */
export function currentMilestoneIndex(correct: number): number {
  let index = 0;
  for (let i = 0; i < MILESTONES.length; i++) {
    if (correct >= MILESTONES[i].minCorrect) index = i;
  }
  return index;
}

/**
 * Does bringing the correct-answer count to `nextCorrect` complete a NEW
 * mid-game milestone (M1..M6)? The opening (M0) and the final win (M7 / 15) are
 * not mid-game transitions.
 */
export function completesMilestone(nextCorrect: number): boolean {
  return MILESTONES.some(m => m.id !== 0 && m.id !== 7 && m.minCorrect === nextCorrect);
}

export function milestoneStateFor(id: number, correct: number): MilestoneState {
  const current = currentMilestoneIndex(correct);
  if (id < current) return 'completed';
  if (id === current) return 'current';
  return 'locked';
}
