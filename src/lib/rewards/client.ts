'use client';

import type { RevealItem } from '@/lib/rewards/types';

/**
 * Browser rewards client. Submits a finished game to `/api/rewards/result` and
 * returns the ordered reveal queue for the Result-screen ceremony. Fire-and-
 * forget safe: any failure resolves to an empty queue so gameplay never breaks.
 * Anonymous players are keyed by a stable device id; authenticated players are
 * keyed server-side by their verified auth id (the sent key is ignored).
 */

const ANON_KEY = 'premium-trivia-player-key-v1';

export function getAnonPlayerKey(): string {
  if (typeof window === 'undefined') return 'local-player';
  try {
    let key = localStorage.getItem(ANON_KEY);
    if (!key) {
      const raw = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      key = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      localStorage.setItem(ANON_KEY, key);
    }
    return key;
  } catch {
    return 'local-player';
  }
}

/** Minutes to ADD to UTC to get the player's local time (opposite of getTimezoneOffset). */
function utcOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

export type SubmitGamePayload = {
  gameId: string;
  mode: 'solo' | 'multiplayer';
  won: boolean;
  cashedOut: boolean;
  correctAnswers: number;
  questionsFaced: number;
  prize: number;
  lifelinesUsed: number;
  category: string;
  livesLostBeforeWin: number;
  fastAnswers?: number;
  leveledUp?: boolean;
  newLevel?: number;
};

export async function submitGameResult(payload: SubmitGamePayload): Promise<RevealItem[]> {
  try {
    const response = await fetch('/api/rewards/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, playerKey: getAnonPlayerKey(), utcOffsetMinutes: utcOffsetMinutes() })
    });
    const data = await response.json();
    if (response.ok && data?.ok && Array.isArray(data.reveals)) return data.reveals as RevealItem[];
  } catch {
    // The optional rewards service is never allowed to affect the game.
  }
  return [];
}
