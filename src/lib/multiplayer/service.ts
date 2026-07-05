import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import type { EntityId } from '@/lib/domain/models';
import type { Locale, Question } from '@/lib/types';
import type {
  MultiplayerActionResult,
  MultiplayerAnswer,
  MultiplayerAnswerInput,
  MultiplayerCreateInput,
  MultiplayerGame,
  MultiplayerJoinInput,
  MultiplayerLobby,
  MultiplayerLobbySummary,
  MultiplayerPlayer,
  MultiplayerPlayerCredentials,
  MultiplayerPublicGameState,
  MultiplayerQuestionSnapshot,
  MultiplayerResult,
  MultiplayerRound
} from './types';

const ROUND_DURATION_MS = 30_000;
const LOBBY_TTL_MS = 12 * 60 * 1000;
const PLAYER_STALE_MS = 45_000;
const ROUND_PRIZES = [1000, 2000, 5000, 10000, 20000, 40000, 80000, 150000, 250000, 400000];
const MAX_ROUNDS = ROUND_PRIZES.length;
const NICKNAME_PATTERN = /^[\p{L}\p{N} _.-]{3,20}$/u;

const now = () => new Date();
const iso = () => now().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomUUID()}`;

export type MultiplayerServiceContext = {
  authUserId?: EntityId;
  displayName?: string;
};

export type MultiplayerService = ReturnType<typeof createMultiplayerService>;

export function createMultiplayerService(repositories: RepositoryProvider = getRepositoryProvider()) {
  async function listOpenLobbies() {
    const lobbies = await repositories.multiplayer.listOpenLobbies({ limit: 20 });
    const summaries = await Promise.all(lobbies.map(lobby => summarizeLobby(lobby)));
    return summaries.filter(lobby => lobby.status === 'waiting' || lobby.status === 'ready');
  }

  async function createLobby(input: MultiplayerCreateInput): Promise<MultiplayerActionResult> {
    const nickname = cleanNickname(input.nickname);
    if (!isValidNickname(nickname)) return fail('Nickname must be 3-20 characters.');

    const date = iso();
    const token = createPlayerToken();
    const playerId = id('mp-player');
    const lobby: MultiplayerLobby = {
      id: id('mp-lobby'),
      status: 'waiting',
      visibility: 'public',
      maxPlayers: input.maxPlayers,
      locale: input.locale,
      category: input.category,
      hostPlayerId: playerId,
      createdAt: date,
      updatedAt: date,
      expiresAt: new Date(Date.now() + LOBBY_TTL_MS).toISOString()
    };

    const player: MultiplayerPlayer = {
      id: playerId,
      lobbyId: lobby.id,
      authUserId: input.authUserId,
      anonymousId: input.anonymousId,
      nickname,
      displayName: input.displayName,
      connectionTokenHash: await hashToken(token),
      position: 1,
      isConnected: true,
      joinedAt: date,
      lastSeenAt: date
    };

    await repositories.multiplayer.createLobby(lobby);
    await repositories.multiplayer.createPlayer(player);
    await recordAudit('multiplayer_lobby_created', 'multiplayer_lobby', lobby.id, {
      maxPlayers: lobby.maxPlayers,
      locale: lobby.locale,
      playerId
    });
    return {
      ok: true,
      lobby: await summarizeLobby(lobby),
      credentials: { playerId, playerToken: token }
    };
  }

  async function quickMatch(input: MultiplayerCreateInput): Promise<MultiplayerActionResult> {
    const lobbies = await listOpenLobbies();
    const compatible = lobbies.find(lobby =>
      lobby.maxPlayers === input.maxPlayers &&
      lobby.locale === input.locale &&
      lobby.playerCount < lobby.maxPlayers
    );

    if (compatible) {
      return joinLobby({ ...input, lobbyId: compatible.id });
    }

    return createLobby(input);
  }

  async function joinLobby(input: MultiplayerJoinInput): Promise<MultiplayerActionResult> {
    const nickname = cleanNickname(input.nickname);
    if (!isValidNickname(nickname)) return fail('Nickname must be 3-20 characters.');

    const lobby = await repositories.multiplayer.findLobby(input.lobbyId);
    if (!lobby) return fail('Lobby was not found.');
    if (isExpired(lobby.expiresAt)) {
      await repositories.multiplayer.updateLobby(lobby.id, { status: 'expired', updatedAt: iso() });
      return fail('Lobby expired.');
    }
    if (lobby.status !== 'waiting' && lobby.status !== 'ready') return fail('Lobby is not accepting players.');

    const existingPlayer = await repositories.multiplayer.findPlayerByIdentity(lobby.id, {
      authUserId: input.authUserId,
      anonymousId: input.anonymousId
    });
    if (existingPlayer) {
      const token = createPlayerToken();
      await repositories.multiplayer.updatePlayer(existingPlayer.id, {
        nickname,
        displayName: input.displayName || existingPlayer.displayName,
        connectionTokenHash: await hashToken(token),
        isConnected: true,
        lastSeenAt: iso(),
        disconnectedAt: undefined
      });
      return {
        ok: true,
        lobby: await summarizeLobby(lobby),
        gameState: await getLobbyState(lobby.id, { playerId: existingPlayer.id, playerToken: token }),
        credentials: { playerId: existingPlayer.id, playerToken: token }
      };
    }

    const players = await repositories.multiplayer.listPlayers(lobby.id);
    if (players.length >= lobby.maxPlayers) return fail('Lobby is full.');
    if (players.some(player => normalizeNicknameKey(player.nickname) === normalizeNicknameKey(nickname))) {
      return fail('Nickname is already used in this lobby.');
    }

    const date = iso();
    const token = createPlayerToken();
    const player: MultiplayerPlayer = {
      id: id('mp-player'),
      lobbyId: lobby.id,
      authUserId: input.authUserId,
      anonymousId: input.anonymousId,
      nickname,
      displayName: input.displayName,
      connectionTokenHash: await hashToken(token),
      position: players.length + 1,
      isConnected: true,
      joinedAt: date,
      lastSeenAt: date
    };

    await repositories.multiplayer.createPlayer(player);
    const nextStatus = players.length + 1 >= 2 ? 'ready' : 'waiting';
    const updatedLobby = await repositories.multiplayer.updateLobby(lobby.id, { status: nextStatus, updatedAt: date }) || lobby;
    await recordAudit('multiplayer_player_joined', 'multiplayer_lobby', lobby.id, {
      playerId: player.id,
      playerCount: players.length + 1,
      maxPlayers: lobby.maxPlayers
    });

    if (players.length + 1 >= updatedLobby.maxPlayers) {
      const started = await startReadyLobby(updatedLobby, { playerId: player.id, playerToken: token });
      return { ...started, credentials: { playerId: player.id, playerToken: token } };
    }

    return {
      ok: true,
      lobby: await summarizeLobby(updatedLobby),
      gameState: await getLobbyState(updatedLobby.id, { playerId: player.id, playerToken: token }),
      credentials: { playerId: player.id, playerToken: token }
    };
  }

  async function leaveLobby(lobbyId: EntityId, credentials: MultiplayerPlayerCredentials): Promise<MultiplayerActionResult> {
    const player = await assertPlayer(credentials);
    if (!player || player.lobbyId !== lobbyId) return fail('Player session is invalid.');

    await repositories.multiplayer.updatePlayer(player.id, {
      isConnected: false,
      disconnectedAt: iso(),
      lastSeenAt: iso()
    });

    const lobby = await repositories.multiplayer.findLobby(lobbyId);
    if (lobby) {
      const connected = (await repositories.multiplayer.listPlayers(lobbyId)).filter(item => item.isConnected);
      if (connected.length === 0 && lobby.status !== 'finished') {
        await repositories.multiplayer.updateLobby(lobbyId, { status: 'cancelled', updatedAt: iso() });
      }
    }

    return { ok: true };
  }

  async function startGame(lobbyId: EntityId, credentials: MultiplayerPlayerCredentials): Promise<MultiplayerActionResult> {
    const player = await assertPlayer(credentials);
    const lobby = await repositories.multiplayer.findLobby(lobbyId);
    if (!player || !lobby || player.lobbyId !== lobbyId) return fail('Player session is invalid.');
    if (lobby.hostPlayerId !== player.id) return fail('Only the host can start this game.');
    if (lobby.status === 'in_progress' && lobby.gameId) {
      return { ok: true, gameState: await getGameState(lobby.gameId, credentials) };
    }
    if (lobby.status === 'starting') return fail('Game is already starting.');

    return startReadyLobby(lobby, credentials);
  }

  async function startReadyLobby(lobby: MultiplayerLobby, credentials: MultiplayerPlayerCredentials): Promise<MultiplayerActionResult> {
    if (lobby.gameId) return { ok: true, gameState: await getGameState(lobby.gameId, credentials) };
    const existingGame = await repositories.multiplayer.findGameByLobby(lobby.id);
    if (existingGame) {
      await repositories.multiplayer.updateLobby(lobby.id, { status: 'in_progress', gameId: existingGame.id, updatedAt: iso() });
      return { ok: true, gameState: await getGameState(existingGame.id, credentials) };
    }

    const players = (await repositories.multiplayer.listPlayers(lobby.id)).filter(isPlayerPresent);
    if (players.length < 2) return fail('At least two players are required.');

    const questions = await chooseQuestions(lobby);
    if (questions.length < 2) return fail('Not enough questions are available.');

    const date = iso();
    const game: MultiplayerGame = {
      id: id('mp-game'),
      lobbyId: lobby.id,
      status: 'in_progress',
      questionIds: questions.map(question => String(question.id)),
      currentRoundIndex: 0,
      startedAt: date,
      createdAt: date,
      updatedAt: date
    };

    const roundStart = Date.now() + 2500;
    const rounds: MultiplayerRound[] = questions.map((question, index) => ({
      id: id('mp-round'),
      gameId: game.id,
      roundNumber: index,
      questionId: String(question.id),
      questionSnapshot: toQuestionSnapshot(question),
      prize: ROUND_PRIZES[index] || ROUND_PRIZES[ROUND_PRIZES.length - 1],
      status: index === 0 ? 'active' : 'pending',
      startsAt: new Date(roundStart + index * ROUND_DURATION_MS).toISOString(),
      endsAt: new Date(roundStart + (index + 1) * ROUND_DURATION_MS).toISOString(),
      createdAt: date,
      updatedAt: date
    }));

    await repositories.multiplayer.updateLobby(lobby.id, { status: 'starting', updatedAt: date });
    try {
      await repositories.multiplayer.createGame(game);
    } catch {
      const racedGame = await repositories.multiplayer.findGameByLobby(lobby.id);
      if (racedGame) return { ok: true, gameState: await getGameState(racedGame.id, credentials) };
      await repositories.multiplayer.updateLobby(lobby.id, { status: players.length >= 2 ? 'ready' : 'waiting', updatedAt: iso() });
      return fail('Could not start the game right now.');
    }
    await repositories.multiplayer.createRounds(rounds);
    await Promise.all(players.map(item => repositories.multiplayer.updatePlayer(item.id, { gameId: game.id, lastSeenAt: date })));
    await repositories.multiplayer.updateLobby(lobby.id, { status: 'in_progress', gameId: game.id, updatedAt: date });
    await recordAudit('multiplayer_game_started', 'multiplayer_game', game.id, {
      lobbyId: lobby.id,
      players: players.length,
      rounds: rounds.length
    });

    return { ok: true, gameState: await getGameState(game.id, credentials) };
  }

  async function submitAnswer(input: MultiplayerAnswerInput): Promise<MultiplayerActionResult> {
    const player = await assertPlayer(input);
    if (!player || player.gameId !== input.gameId) return fail('Player session is invalid.');
    if (!Number.isInteger(input.answerIndex) || input.answerIndex < 0 || input.answerIndex > 3) return fail('Answer is invalid.');

    const game = await repositories.multiplayer.findGame(input.gameId);
    if (!game || game.status !== 'in_progress') return fail('Game is not active.');

    const round = await repositories.multiplayer.findRound(input.roundId);
    if (!round || round.gameId !== game.id) return fail('Round is invalid.');
    if (round.roundNumber !== game.currentRoundIndex || round.status !== 'active') return fail('Round is not active.');

    const existing = await repositories.multiplayer.findAnswer(round.id, player.id);
    if (existing) return { ok: true, gameState: await getGameState(game.id, input) };

    const submittedAt = now();
    const startsAt = new Date(round.startsAt);
    const endsAt = new Date(round.endsAt);
    if (submittedAt < startsAt) return fail('Round has not started.');
    if (submittedAt > endsAt) return fail('Round already ended.');

    const responseTimeMs = Math.max(0, submittedAt.getTime() - startsAt.getTime());
    const isCorrect = input.answerIndex === round.questionSnapshot.correctIndex;
    const answers = await repositories.multiplayer.listAnswers(game.id);
    const roundAnswers = answers.filter(answer => answer.roundId === round.id);
    const hasWinner = roundAnswers.some(answer => answer.isCorrect && answer.awardedPrize > 0) || Boolean(round.winnerPlayerId);
    const awardedPrize = isCorrect && !hasWinner ? round.prize : 0;

    const answer: MultiplayerAnswer = {
      id: id('mp-answer'),
      gameId: game.id,
      roundId: round.id,
      playerId: player.id,
      answerIndex: input.answerIndex,
      isCorrect,
      responseTimeMs,
      awardedPrize,
      submittedAt: submittedAt.toISOString()
    };

    let storedAnswer: MultiplayerAnswer;
    try {
      storedAnswer = await repositories.multiplayer.createAnswer(answer);
    } catch {
      const replay = await repositories.multiplayer.findAnswer(round.id, player.id);
      if (replay) return { ok: true, gameState: await getGameState(game.id, input) };
      storedAnswer = await repositories.multiplayer.createAnswer({ ...answer, awardedPrize: 0 });
    }
    if (storedAnswer.awardedPrize > 0) {
      await repositories.multiplayer.updateRound(round.id, { winnerPlayerId: player.id, status: 'completed', updatedAt: iso() });
    }

    const updatedAnswers = await repositories.multiplayer.listAnswers(game.id);
    const players = await repositories.multiplayer.listPlayers(game.lobbyId);
    const everyoneAnswered = players.length > 0 && players.every(item =>
      updatedAnswers.some(answerItem => answerItem.roundId === round.id && answerItem.playerId === item.id)
    );

    if (everyoneAnswered || storedAnswer.awardedPrize > 0) {
      await advanceRound(game.id);
    }

    return { ok: true, gameState: await getGameState(game.id, input) };
  }

  async function advanceRound(gameId: EntityId): Promise<MultiplayerActionResult> {
    const game = await repositories.multiplayer.findGame(gameId);
    if (!game || game.status !== 'in_progress') return fail('Game is not active.');

    const rounds = await repositories.multiplayer.listRounds(game.id);
    const currentRound = rounds.find(round => round.roundNumber === game.currentRoundIndex);
    if (currentRound && currentRound.status === 'active') {
      await repositories.multiplayer.updateRound(currentRound.id, { status: currentRound.winnerPlayerId ? 'completed' : 'expired', updatedAt: iso() });
    }

    const nextRound = rounds.find(round => round.roundNumber === game.currentRoundIndex + 1);
    if (!nextRound) {
      await finishGame(game.id);
      return { ok: true };
    }

    const startsAt = new Date(Date.now() + 1200);
    await repositories.multiplayer.updateRound(nextRound.id, {
      status: 'active',
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + ROUND_DURATION_MS).toISOString(),
      updatedAt: iso()
    });
    await repositories.multiplayer.updateGame(game.id, { currentRoundIndex: game.currentRoundIndex + 1, updatedAt: iso() });
    return { ok: true };
  }

  async function getLobbyState(lobbyId: EntityId, credentials?: MultiplayerPlayerCredentials): Promise<MultiplayerPublicGameState> {
    const lobby = await repositories.multiplayer.findLobby(lobbyId);
    if (!lobby) throw new Error('Lobby was not found.');
    if (lobby.gameId) return getGameState(lobby.gameId, credentials);

    const players = await repositories.multiplayer.listPlayers(lobby.id);
    const me = credentials ? players.find(player => player.id === credentials.playerId) : undefined;
    return {
      lobby: await summarizeLobby(lobby, players),
      players: sanitizePlayers(players),
      answers: [],
      results: [],
      me: me ? sanitizePlayer(me) : undefined,
      notifications: buildLobbyNotifications(lobby, players)
    };
  }

  async function getGameState(gameId: EntityId, credentials?: MultiplayerPlayerCredentials): Promise<MultiplayerPublicGameState> {
    const game = await repositories.multiplayer.findGame(gameId);
    if (!game) throw new Error('Game was not found.');

    const lobby = await repositories.multiplayer.findLobby(game.lobbyId);
    if (!lobby) throw new Error('Lobby was not found.');

    const [players, rounds, answers, results] = await Promise.all([
      repositories.multiplayer.listPlayers(lobby.id),
      repositories.multiplayer.listRounds(game.id),
      repositories.multiplayer.listAnswers(game.id),
      repositories.multiplayer.listResults(game.id)
    ]);

    const me = credentials ? players.find(player => player.id === credentials.playerId) : undefined;
    const activeRound = rounds.find(round => round.roundNumber === game.currentRoundIndex && round.status === 'active');
    if (activeRound && new Date(activeRound.endsAt).getTime() < Date.now()) {
      await advanceRound(game.id);
      return getGameState(game.id, credentials);
    }
    const myAnswer = activeRound && me ? answers.find(answer => answer.roundId === activeRound.id && answer.playerId === me.id) : undefined;

    return {
      lobby: await summarizeLobby(lobby, players),
      game,
      currentRound: activeRound
        ? {
            ...activeRound,
            question: publicQuestion(activeRound.questionSnapshot),
            hasAnswered: Boolean(myAnswer),
            selectedAnswerIndex: myAnswer?.answerIndex
          }
        : undefined,
      players: sanitizePlayers(players),
      answers: answers
        .filter(answer => answer.awardedPrize > 0 || answer.playerId === me?.id)
        .map(answer => sanitizeAnswer(answer, answer.playerId === me?.id)),
      results,
      me: me ? sanitizePlayer(me) : undefined,
      notifications: buildGameNotifications(game, players, answers, results)
    };
  }

  return {
    listOpenLobbies,
    createLobby,
    quickMatch,
    joinLobby,
    leaveLobby,
    startGame,
    submitAnswer,
    advanceRound,
    getLobbyState,
    getGameState
  };

  async function summarizeLobby(lobby: MultiplayerLobby, knownPlayers?: MultiplayerPlayer[]): Promise<MultiplayerLobbySummary> {
    const players = knownPlayers || await repositories.multiplayer.listPlayers(lobby.id);
    return {
      ...lobby,
      playerCount: players.filter(isPlayerPresent).length,
      players: players
        .sort((first, second) => first.position - second.position)
        .map(player => ({
          id: player.id,
          nickname: player.nickname,
          position: player.position,
          isConnected: isPlayerPresent(player)
        }))
    };
  }

  async function assertPlayer(credentials: MultiplayerPlayerCredentials) {
    const player = await repositories.multiplayer.findPlayer(credentials.playerId);
    if (!player) return undefined;
    const hash = await hashToken(credentials.playerToken);
    if (hash !== player.connectionTokenHash) return undefined;
    await repositories.multiplayer.updatePlayer(player.id, { isConnected: true, lastSeenAt: iso() });
    return player;
  }

  async function chooseQuestions(lobby: MultiplayerLobby): Promise<Question[]> {
    const questions = await repositories.approvedQuestions.listGameplayQuestions({
      category: lobby.category,
      activeOnly: true,
      limit: 220
    });
    return shuffle(questions).slice(0, Math.min(MAX_ROUNDS, questions.length));
  }

  async function finishGame(gameId: EntityId) {
    const game = await repositories.multiplayer.findGame(gameId);
    if (!game) return;
    const existingResults = await repositories.multiplayer.listResults(game.id);
    if (existingResults.length > 0) {
      await repositories.multiplayer.updateGame(game.id, { status: 'finished', finishedAt: game.finishedAt || iso(), updatedAt: iso() });
      await repositories.multiplayer.updateLobby(game.lobbyId, { status: 'finished', updatedAt: iso() });
      return;
    }

    const [players, answers] = await Promise.all([
      repositories.multiplayer.listPlayers(game.lobbyId),
      repositories.multiplayer.listAnswers(game.id)
    ]);

    const results = players.map(player => {
      const playerAnswers = answers.filter(answer => answer.playerId === player.id);
      const correctAnswers = playerAnswers.filter(answer => answer.isCorrect).length;
      const totalPrize = playerAnswers.reduce((sum, answer) => sum + answer.awardedPrize, 0);
      const averageResponseTimeMs = playerAnswers.length
        ? Math.round(playerAnswers.reduce((sum, answer) => sum + answer.responseTimeMs, 0) / playerAnswers.length)
        : 0;
      return {
        id: id('mp-result'),
        gameId: game.id,
        playerId: player.id,
        rank: 1,
        totalPrize,
        correctAnswers,
        averageResponseTimeMs,
        createdAt: iso()
      } satisfies MultiplayerResult;
    }).sort((first, second) =>
      second.totalPrize - first.totalPrize ||
      second.correctAnswers - first.correctAnswers ||
      first.averageResponseTimeMs - second.averageResponseTimeMs
    ).map((result, index) => ({ ...result, rank: index + 1 }));

    await repositories.multiplayer.createResults(results);
    await repositories.multiplayer.updateGame(game.id, { status: 'finished', finishedAt: iso(), updatedAt: iso() });
    await repositories.multiplayer.updateLobby(game.lobbyId, { status: 'finished', updatedAt: iso() });
    await recordAudit('multiplayer_game_finished', 'multiplayer_game', game.id, {
      lobbyId: game.lobbyId,
      results: results.map(result => ({
        playerId: result.playerId,
        rank: result.rank,
        totalPrize: result.totalPrize,
        correctAnswers: result.correctAnswers
      }))
    });
  }

  async function recordAudit(action: string, targetType: string, targetId: EntityId, details: Record<string, unknown>) {
    try {
      await repositories.auditLogs.create({
        actorLabel: 'multiplayer-system',
        action,
        targetType,
        targetId,
        details
      });
    } catch {
      // Gameplay must not fail because optional audit storage is unavailable.
    }
  }
}

function cleanNickname(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 20);
}

function isValidNickname(value: string) {
  return NICKNAME_PATTERN.test(value);
}

function normalizeNicknameKey(value: string) {
  return cleanNickname(value).toLocaleLowerCase('en-US');
}

function isExpired(value: string) {
  return new Date(value).getTime() < Date.now();
}

function fail(error: string): MultiplayerActionResult {
  return { ok: false, error };
}

function createPlayerToken() {
  return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

async function hashToken(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function toQuestionSnapshot(question: Question): MultiplayerQuestionSnapshot {
  return {
    id: String(question.id),
    category: question.category,
    difficulty: question.difficulty,
    question: question.question,
    options: question.options,
    correctIndex: question.correctIndex,
    explanation: question.explanation
  };
}

function publicQuestion(question: MultiplayerQuestionSnapshot) {
  const { correctIndex, ...safeQuestion } = question;
  void correctIndex;
  return safeQuestion;
}

function sanitizePlayer(player: MultiplayerPlayer) {
  return {
    id: player.id,
    nickname: player.nickname,
    position: player.position,
    isConnected: isPlayerPresent(player)
  };
}

function sanitizePlayers(players: MultiplayerPlayer[]) {
  return players.map(sanitizePlayer).sort((first, second) => first.position - second.position);
}

function sanitizeAnswer(answer: MultiplayerAnswer, includeAnswerIndex: boolean) {
  return {
    id: answer.id,
    gameId: answer.gameId,
    roundId: answer.roundId,
    playerId: answer.playerId,
    isCorrect: answer.isCorrect,
    responseTimeMs: answer.responseTimeMs,
    awardedPrize: answer.awardedPrize,
    submittedAt: answer.submittedAt,
    answerIndex: includeAnswerIndex ? answer.answerIndex : undefined
  };
}

function isPlayerPresent(player: MultiplayerPlayer) {
  return player.isConnected && Date.now() - new Date(player.lastSeenAt).getTime() <= PLAYER_STALE_MS;
}

function buildLobbyNotifications(lobby: MultiplayerLobby, players: MultiplayerPlayer[]) {
  const connected = players.filter(isPlayerPresent);
  const messages = [`${connected.length} / ${lobby.maxPlayers} players`];
  if (connected.length === 1) messages.push('Waiting for players...');
  if (connected.length >= 2) messages.push('Player joined. Ready to start.');
  return messages;
}

function buildGameNotifications(game: { status: string }, players: MultiplayerPlayer[], answers: MultiplayerAnswer[], results: MultiplayerResult[]) {
  if (game.status === 'finished') {
    const winner = results.find(result => result.rank === 1);
    const winnerPlayer = players.find(player => player.id === winner?.playerId);
    return winnerPlayer ? [`Winner: ${winnerPlayer.nickname}`] : ['Game finished'];
  }
  const latestWinner = [...answers].reverse().find(answer => answer.awardedPrize > 0);
  const winnerPlayer = players.find(player => player.id === latestWinner?.playerId);
  return winnerPlayer ? [`${winnerPlayer.nickname} won the round`] : ['Question is live'];
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}
