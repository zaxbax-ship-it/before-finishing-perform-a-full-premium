import type { GameSummary, PlayerProgressionState, ProgressionUpdate } from './types';
import { applyGameToProgression, emptyProgression } from './achievements';

/**
 * Browser-local progression fallback. Mirrors the app's local-mode philosophy:
 * progression always works from localStorage; server persistence (the
 * ProgressionRepository) can sync it once accounts are wired. Safe no-ops
 * outside the browser.
 */

const PROGRESSION_KEY = 'premium-trivia-progression-v1';
const LOCAL_PLAYER_KEY = 'local-player';

export function readLocalProgression(): PlayerProgressionState {
  if (typeof window === 'undefined') return emptyProgression(LOCAL_PLAYER_KEY);
  try {
    const raw = localStorage.getItem(PROGRESSION_KEY);
    if (!raw) return emptyProgression(LOCAL_PLAYER_KEY);
    const parsed = JSON.parse(raw) as Partial<PlayerProgressionState>;
    if (typeof parsed.xp !== 'number' || !Array.isArray(parsed.unlockedAchievements)) {
      return emptyProgression(LOCAL_PLAYER_KEY);
    }
    return { ...emptyProgression(LOCAL_PLAYER_KEY), ...parsed } as PlayerProgressionState;
  } catch {
    return emptyProgression(LOCAL_PLAYER_KEY);
  }
}

/** Applies a finished game locally and persists the result. */
export function applyGameToLocalProgression(summary: GameSummary): ProgressionUpdate {
  const update = applyGameToProgression(readLocalProgression(), summary);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PROGRESSION_KEY, JSON.stringify(update.state));
    } catch {
      // Storage may be unavailable (private mode); progression stays in-memory.
    }
  }
  return update;
}
