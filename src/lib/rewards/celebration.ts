/**
 * Solo prize-ladder reward-celebration policy (Stage 25).
 *
 * Pure, side-effect-free logic shared by the audio synth and the gameplay
 * orchestrator, so the tier rules and the advancement counter are unit-testable
 * without a DOM or an AudioContext.
 *
 * An "advancement" is one successful prize-ladder progression (a milestone
 * transition). The initial ladder appearance at game start is NOT an
 * advancement and never reaches this module.
 */

export type CelebrationPlan = {
  /** The premium "money earned" cash chime — every advancement. */
  cash: boolean;
  /** A restrained crowd cheer — 2nd and 3rd advancement only. */
  cheer: boolean;
  /** The confetti pop + two-sided visual burst — 3rd advancement only. */
  confetti: boolean;
};

/**
 * Which sounds/effects a given advancement number earns:
 *   1st        -> cash only
 *   2nd        -> cash + cheer
 *   3rd        -> cash + cheer + confetti (sound + visual)
 *   4th & later -> cash only
 */
export function celebrationPlan(advancement: number): CelebrationPlan {
  return {
    cash: advancement >= 1,
    cheer: advancement === 2 || advancement === 3,
    confetti: advancement === 3
  };
}

/**
 * The per-Solo-game advancement tracker. Kept in a ref (never re-created by a
 * re-render); `reset()` runs when a genuinely new Solo game begins. `advance()`
 * is idempotent per completed-stage id: the same milestone can never count twice
 * (double transitions, restoration, re-entry), and it returns the 1-based
 * advancement number — or 0 when the stage was already counted.
 */
export function createCelebrationTracker() {
  let lastStageId: number | null = null;
  let count = 0;
  return {
    reset(): void {
      lastStageId = null;
      count = 0;
    },
    advance(stageId: number): number {
      if (lastStageId === stageId) return 0; // duplicate — already celebrated
      lastStageId = stageId;
      count += 1;
      return count;
    },
    get current(): number {
      return count;
    }
  };
}

export type CelebrationTracker = ReturnType<typeof createCelebrationTracker>;
