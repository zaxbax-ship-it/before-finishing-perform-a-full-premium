import type { LeaderboardEntry } from '@/lib/domain/models';
import { isRecord } from './common';

/**
 * Leaderboard entry as currently returned by the API.
 *
 * NOTE for the mobile/API evolution: the current runtime response includes the
 * full domain entry. Internal-only fields (`authUserId`, `isHidden`) SHOULD be
 * stripped in a future v-next public shape — see the docs. This contract stays
 * faithful to today's behavior and does not change it.
 */
export type LeaderboardEntryDto = LeaderboardEntry;

/** Recommended public projection for a future breaking version (documentation only). */
export type PublicLeaderboardEntry = Omit<LeaderboardEntryDto, 'authUserId' | 'isHidden'>;

/** Response of `GET /api/leaderboard`. */
export type LeaderboardResponse = {
  ok: true;
  provider: string;
  entries: LeaderboardEntryDto[];
};

/** Response of `POST /api/leaderboard` on success. */
export type LeaderboardSubmitResponse = {
  ok: true;
  status: string;
  entry: LeaderboardEntryDto;
  entries: LeaderboardEntryDto[];
};

export function isLeaderboardEntryDto(value: unknown): value is LeaderboardEntryDto {
  if (!isRecord(value)) return false;
  if (typeof value.nickname !== 'string') return false;
  if (typeof value.bestPrize !== 'number') return false;
  return typeof value.bestCorrectCount === 'number';
}

/** Runtime guard for the leaderboard listing response (used by smoke tests). */
export function isLeaderboardResponse(value: unknown): value is LeaderboardResponse {
  if (!isRecord(value) || value.ok !== true) return false;
  if (typeof value.provider !== 'string') return false;
  return Array.isArray(value.entries) && value.entries.every(isLeaderboardEntryDto);
}
