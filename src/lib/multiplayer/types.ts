import type { EntityId, ISODateTime } from '@/lib/domain/models';
import type { Locale } from '@/lib/types';

export type MultiplayerLobbyStatus = 'waiting' | 'ready' | 'starting' | 'in_progress' | 'finished' | 'cancelled' | 'expired';
export type MultiplayerGameStatus = 'waiting' | 'starting' | 'in_progress' | 'finished' | 'cancelled' | 'expired';
export type MultiplayerRoundStatus = 'pending' | 'active' | 'completed' | 'expired';
export type MultiplayerVisibility = 'public' | 'private';
export type MultiplayerAction = 'create' | 'quick_match' | 'join' | 'leave' | 'cancel' | 'start';
export type MultiplayerLifelineId = 'fifty_fifty' | 'audience' | 'friend';
export type MultiplayerLifelineInventory = Record<MultiplayerLifelineId, number>;
export type MultiplayerLifelineEffect =
  | { type: 'fifty_fifty'; roundId: EntityId; hiddenOptionIndexes: number[]; createdAt: ISODateTime }
  | { type: 'audience'; roundId: EntityId; poll: number[]; suggestedIndex: number; createdAt: ISODateTime }
  | { type: 'friend'; roundId: EntityId; suggestedIndex: number; confidence: number; createdAt: ISODateTime };
export type MultiplayerLifelineUse = MultiplayerLifelineEffect & {
  id: EntityId;
  gameId: EntityId;
  playerId: EntityId;
  cost: number;
};
export type MultiplayerErrorCode =
  | 'invalid_nickname'
  | 'lobby_not_found'
  | 'game_not_found'
  | 'lobby_expired'
  | 'lobby_not_accepting'
  | 'lobby_full'
  | 'nickname_taken'
  | 'player_session_invalid'
  | 'host_only'
  | 'game_already_starting'
  | 'not_enough_players'
  | 'not_enough_questions'
  | 'game_start_failed'
  | 'answer_invalid'
  | 'game_not_active'
  | 'round_invalid'
  | 'round_not_active'
  | 'round_not_started'
  | 'round_ended'
  | 'missing_identity'
  | 'missing_session'
  | 'rate_limited'
  | 'lifeline_unavailable'
  | 'lifeline_invalid'
  | 'lifeline_already_used'
  | 'insufficient_winnings'
  | 'server_error';

export type MultiplayerQuestionSnapshot = {
  id: EntityId;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

export type PublicMultiplayerQuestion = Omit<MultiplayerQuestionSnapshot, 'correctIndex'>;
export type PublicMultiplayerPlayer = Pick<MultiplayerPlayer, 'id' | 'nickname' | 'position' | 'isConnected'> & {
  lifelinesRemaining?: number;
};
export type PublicMultiplayerAnswer = Pick<
  MultiplayerAnswer,
  'id' | 'gameId' | 'roundId' | 'playerId' | 'isCorrect' | 'responseTimeMs' | 'awardedPrize' | 'submittedAt'
> & {
  answerIndex?: number;
};

export type MultiplayerLobby = {
  id: EntityId;
  status: MultiplayerLobbyStatus;
  visibility: MultiplayerVisibility;
  maxPlayers: 2 | 3 | 4;
  locale: Locale;
  category?: string;
  hostPlayerId?: EntityId;
  gameId?: EntityId;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  expiresAt: ISODateTime;
};

export type MultiplayerPlayer = {
  id: EntityId;
  lobbyId: EntityId;
  gameId?: EntityId;
  authUserId?: EntityId;
  anonymousId: EntityId;
  nickname: string;
  displayName?: string;
  connectionTokenHash: string;
  lifelines?: MultiplayerLifelineInventory;
  lifelineUses?: MultiplayerLifelineUse[];
  spentPrize?: number;
  position: number;
  isConnected: boolean;
  joinedAt: ISODateTime;
  lastSeenAt: ISODateTime;
  disconnectedAt?: ISODateTime;
};

export type MultiplayerGame = {
  id: EntityId;
  lobbyId: EntityId;
  status: MultiplayerGameStatus;
  questionIds: EntityId[];
  currentRoundIndex: number;
  startedAt?: ISODateTime;
  finishedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type MultiplayerRound = {
  id: EntityId;
  gameId: EntityId;
  roundNumber: number;
  questionId: EntityId;
  questionSnapshot: MultiplayerQuestionSnapshot;
  prize: number;
  status: MultiplayerRoundStatus;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  winnerPlayerId?: EntityId;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type MultiplayerAnswer = {
  id: EntityId;
  gameId: EntityId;
  roundId: EntityId;
  playerId: EntityId;
  answerIndex: number;
  isCorrect: boolean;
  responseTimeMs: number;
  awardedPrize: number;
  submittedAt: ISODateTime;
};

export type MultiplayerResult = {
  id: EntityId;
  gameId: EntityId;
  playerId: EntityId;
  rank: number;
  totalPrize: number;
  correctAnswers: number;
  averageResponseTimeMs: number;
  createdAt: ISODateTime;
};

export type MultiplayerLobbySummary = MultiplayerLobby & {
  playerCount: number;
  players: Array<Pick<MultiplayerPlayer, 'id' | 'nickname' | 'position' | 'isConnected'>>;
};

export type PublicMultiplayerRoundSummary = {
  roundId: EntityId;
  roundNumber: number;
  question: PublicMultiplayerQuestion;
  correctIndex: number;
  correctAnswer: string;
  explanation?: string;
  winnerPlayerId?: EntityId;
  prizeAwarded: number;
  players: Array<{
    playerId: EntityId;
    nickname: string;
    answerIndex?: number;
    isCorrect: boolean;
    timedOut: boolean;
    awardedPrize: number;
    responseTimeMs?: number;
  }>;
};

export type MultiplayerPublicGameState = {
  lobby: MultiplayerLobbySummary;
  game?: MultiplayerGame;
  currentRound?: Omit<MultiplayerRound, 'questionSnapshot'> & {
    question: PublicMultiplayerQuestion;
    hasAnswered: boolean;
    selectedAnswerIndex?: number;
  };
  players: PublicMultiplayerPlayer[];
  answers: PublicMultiplayerAnswer[];
  results: MultiplayerResult[];
  me?: PublicMultiplayerPlayer;
  myLifelines?: MultiplayerLifelineInventory;
  myLifelineEffects?: MultiplayerLifelineEffect[];
  myAvailablePrize?: number;
  roundSummary?: PublicMultiplayerRoundSummary;
  notifications: string[];
};

export type MultiplayerCreateInput = {
  nickname: string;
  anonymousId: EntityId;
  authUserId?: EntityId;
  displayName?: string;
  locale: Locale;
  maxPlayers: 2 | 3 | 4;
  category?: string;
};

export type MultiplayerJoinInput = {
  lobbyId: EntityId;
  nickname: string;
  anonymousId: EntityId;
  authUserId?: EntityId;
  displayName?: string;
};

export type MultiplayerPlayerCredentials = {
  playerId: EntityId;
  playerToken: string;
};

export type MultiplayerAnswerInput = MultiplayerPlayerCredentials & {
  gameId: EntityId;
  roundId: EntityId;
  answerIndex: number;
};

export type MultiplayerLifelineInput = MultiplayerPlayerCredentials & {
  gameId: EntityId;
  roundId: EntityId;
  lifeline: MultiplayerLifelineId;
};

export type MultiplayerBuyLifelineInput = MultiplayerPlayerCredentials & {
  gameId: EntityId;
  lifeline: MultiplayerLifelineId;
  /**
   * Optional client-generated key that makes a purchase retry-safe: the same
   * key is acknowledged once, so a resubmission after a lost response cannot
   * charge twice. Native mobile clients should send it too.
   */
  idempotencyKey?: string;
};

export type MultiplayerActionResult = {
  ok: boolean;
  error?: string;
  errorCode?: MultiplayerErrorCode;
  lobby?: MultiplayerLobbySummary;
  gameState?: MultiplayerPublicGameState;
  credentials?: MultiplayerPlayerCredentials;
};
