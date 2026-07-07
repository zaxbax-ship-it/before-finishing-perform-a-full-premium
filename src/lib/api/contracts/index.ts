/**
 * Shared API contracts — the single source of truth for public response shapes.
 *
 * Web, iOS and Android clients should import types + guards from here rather than
 * reaching into internal domain/service modules. See
 * docs/api-contracts-and-mobile-readiness.md.
 */
export {
  API_CONTRACT_VERSION,
  isApiEnvelope,
  isApiError,
  isApiOk,
  isRecord
} from './common';
export type { ApiEnvelope, ApiError, ApiOk } from './common';

export { isHealthResponse } from './health';
export type { HealthResponse } from './health';

export { isQuestionDto, isQuestionsResponse } from './questions';
export type { QuestionDto, QuestionsResponse } from './questions';

export { isLeaderboardEntryDto, isLeaderboardResponse } from './leaderboard';
export type {
  LeaderboardEntryDto,
  LeaderboardResponse,
  LeaderboardSubmitResponse,
  PublicLeaderboardEntry
} from './leaderboard';

export { isListLobbiesResponse, isMultiplayerLobbySummaryDto } from './multiplayer';
export type { ListLobbiesResponse, MultiplayerLobbySummaryDto } from './multiplayer';

export { isCheckoutSessionResponse, isEntitlementsResponse } from './payments';
export type { CheckoutSessionResponse, EntitlementsResponse } from './payments';

