import type { Locale, Question } from '@/lib/types';

/**
 * Shared client-side types for the trivia web shell.
 *
 * These were previously declared inline in `TriviaPlatform.tsx`. They are kept
 * framework-agnostic (plain unions / object shapes, ISO date strings) so the
 * same contracts can guide the future native iOS (SwiftUI) and Android
 * (Jetpack Compose) clients.
 */

export type GameQuestion = Question & { answers: string[]; imageUrl?: string };

export type Screen =
  | 'home'
  | 'categories'
  | 'rules'
  | 'game'
  | 'result'
  | 'admin'
  | 'contact'
  | 'add'
  | 'profile'
  | 'settings'
  | 'submit'
  | 'leaderboard'
  | 'multiplayer';

export type EndState = 'win' | 'quit' | 'timeout' | 'lost';

export type Lifeline = 'fifty' | 'swap' | 'phone' | 'audience';

export type LeaderboardStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'taken' | 'error';

export type PublicAuthUser = {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt?: string;
};

export type Settings = {
  sound: boolean;
  effects: boolean;
  timer: string;
};

export type Stats = {
  games: number;
  bestPrize: number;
  totalMoney: number;
  correct: number;
  lifelines: number;
  achievements: string[];
};

export type { Locale };
