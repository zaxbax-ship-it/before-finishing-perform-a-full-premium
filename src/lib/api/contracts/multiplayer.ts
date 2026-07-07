import type { MultiplayerLobbySummary } from '@/lib/multiplayer/types';
import { isRecord } from './common';

/**
 * Public lobby summary as returned by `GET /api/multiplayer/lobbies`.
 *
 * Only the *listing* shape is contracted here — the safest, fully public
 * multiplayer surface. The stateful action responses (join/start/answer) carry
 * per-player credentials and richer game state; contracting those is deferred to
 * a later, deliberate pass (see docs) to avoid coupling to in-flight logic.
 */
export type MultiplayerLobbySummaryDto = MultiplayerLobbySummary;

/** Response of `GET /api/multiplayer/lobbies`. */
export type ListLobbiesResponse = {
  ok: true;
  lobbies: MultiplayerLobbySummaryDto[];
};

export function isMultiplayerLobbySummaryDto(value: unknown): value is MultiplayerLobbySummaryDto {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.status !== 'string') return false;
  if (typeof value.maxPlayers !== 'number') return false;
  if (typeof value.playerCount !== 'number') return false;
  return Array.isArray(value.players);
}

/** Runtime guard for the open-lobbies listing response (used by smoke tests). */
export function isListLobbiesResponse(value: unknown): value is ListLobbiesResponse {
  if (!isRecord(value) || value.ok !== true) return false;
  return Array.isArray(value.lobbies) && value.lobbies.every(isMultiplayerLobbySummaryDto);
}
