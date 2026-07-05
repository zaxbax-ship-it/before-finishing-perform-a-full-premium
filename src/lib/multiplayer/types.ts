import type { EntityId, ISODateTime } from '@/lib/domain/models';
import type { Locale } from '@/lib/types';

export type MultiplayerLobbyStatus = 'waiting' | 'ready' | 'starting' | 'in_progress' | 'finished' | 'cancelled' | 'expired';
export type MultiplayerGameStatus = 'waiting' | 'starting' | 'in_progress' | 'finished' | 'cancelled' | 'expired';
export type MultiplayerRoundStatus = 'pending' | 'active' | 'completed' | 'expired';
export type MultiplayerVisibility = 'public' | 'private';
export type MultiplayerAction = 'create' | 'quick_match' | 'join' | 'leave' | 'cancel' | 'start';

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
export type PublicMultiplayerPlayer = Pick<MultiplayerPlayer, 'id' | 'nickname' | 'position' | 'isConnected'>;
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

export type MultiplayerActionResult = {
  ok: boolean;
  error?: string;
  lobby?: MultiplayerLobbySummary;
  gameState?: MultiplayerPublicGameState;
  credentials?: MultiplayerPlayerCredentials;
};
