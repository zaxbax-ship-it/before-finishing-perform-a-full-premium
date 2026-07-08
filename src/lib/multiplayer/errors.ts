import type { MultiplayerErrorCode } from './types';

/**
 * A requested lobby or game no longer exists.
 *
 * This is an expected client condition — a stored session outlives the
 * short-lived room it points at — not a server fault. It carries a stable
 * `code` so the API layer can answer with an HTTP 404 and a typed error
 * envelope, and any client (web, future SwiftUI / Jetpack Compose) can then
 * clear its stale session and stop polling a dead resource instead of
 * retrying forever. Keeping it out of the generic 500 path also keeps
 * monitoring quiet.
 */
export class MultiplayerNotFoundError extends Error {
  constructor(
    readonly code: Extract<MultiplayerErrorCode, 'lobby_not_found' | 'game_not_found'>,
    readonly publicMessage: string,
    message?: string
  ) {
    super(message || publicMessage);
    this.name = 'MultiplayerNotFoundError';
  }
}
