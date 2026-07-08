import { describe, expect, it } from 'vitest';
import { createLocalJsonRepositoryProvider } from '@/lib/repositories/providers/localJsonProvider';
import { createMultiplayerService } from '@/lib/multiplayer/service';

/**
 * Reliability regression suite: duplicate submissions, racing double-taps and
 * purchase retries must never double-apply. Runs the real service against a
 * fresh local provider per test.
 */

async function startTwoPlayerGame() {
  const repositories = createLocalJsonRepositoryProvider();
  const service = createMultiplayerService(repositories);
  const created = await service.createLobby({ nickname: 'HostPlayer', anonymousId: `anon-host-${crypto.randomUUID()}`, locale: 'he', maxPlayers: 2 });
  expect(created.ok).toBe(true);
  const lobbyId = created.gameState?.lobby.id || created.lobby?.id;
  expect(lobbyId).toBeTruthy();
  const joined = await service.joinLobby({ lobbyId: lobbyId as string, nickname: 'GuestPlayer', anonymousId: `anon-guest-${crypto.randomUUID()}` });
  expect(joined.ok).toBe(true);
  let state = joined.gameState;
  if (!state?.game) state = await service.getLobbyState(lobbyId as string, joined.credentials);
  const gameId = state?.game?.id as string;
  expect(gameId).toBeTruthy();

  // Round 1 starts ~1.2s in the future; pull it into the playable window.
  const rounds = await repositories.multiplayer.listRounds(gameId);
  const round = rounds.find(item => item.roundNumber === 0);
  expect(round).toBeTruthy();
  await repositories.multiplayer.updateRound(round!.id, {
    startsAt: new Date(Date.now() - 1000).toISOString(),
    endsAt: new Date(Date.now() + 60000).toISOString(),
    updatedAt: new Date().toISOString()
  });
  const activeRound = await repositories.multiplayer.findRound(round!.id);
  return {
    repositories,
    service,
    gameId,
    lobbyId: lobbyId as string,
    round: activeRound!,
    host: created.credentials!,
    guest: joined.credentials!
  };
}

describe('multiplayer reliability', () => {
  it('replays a duplicate answer instead of storing it twice', async () => {
    const { repositories, service, gameId, round, host } = await startTwoPlayerGame();
    const wrongIndex = (round.questionSnapshot.correctIndex + 1) % 4;
    const otherWrongIndex = (round.questionSnapshot.correctIndex + 2) % 4;

    const first = await service.submitAnswer({ ...host, gameId, roundId: round.id, answerIndex: wrongIndex });
    expect(first.ok).toBe(true);
    // Retry (lost response, browser refresh) — acknowledged, not duplicated,
    // and the answer cannot be changed after the fact.
    const second = await service.submitAnswer({ ...host, gameId, roundId: round.id, answerIndex: otherWrongIndex });
    expect(second.ok).toBe(true);

    const answers = await repositories.multiplayer.listAnswers(gameId);
    const mine = answers.filter(answer => answer.roundId === round.id && answer.playerId === host.playerId);
    expect(mine).toHaveLength(1);
    expect(mine[0].answerIndex).toBe(wrongIndex);
  });

  it('keeps a single answer under racing double-taps', async () => {
    const { repositories, service, gameId, round, host } = await startTwoPlayerGame();
    const wrongIndex = (round.questionSnapshot.correctIndex + 1) % 4;
    const otherWrongIndex = (round.questionSnapshot.correctIndex + 2) % 4;

    const [a, b] = await Promise.all([
      service.submitAnswer({ ...host, gameId, roundId: round.id, answerIndex: wrongIndex }),
      service.submitAnswer({ ...host, gameId, roundId: round.id, answerIndex: otherWrongIndex })
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    const answers = await repositories.multiplayer.listAnswers(gameId);
    const mine = answers.filter(answer => answer.roundId === round.id && answer.playerId === host.playerId);
    expect(mine).toHaveLength(1);
  });

  it('never charges a lifeline purchase twice for the same idempotency key', async () => {
    const { repositories, service, gameId, lobbyId, round, host } = await startTwoPlayerGame();
    // Seed fictional winnings so the purchase is affordable.
    await repositories.multiplayer.createAnswer({
      id: `seed-${crypto.randomUUID()}`,
      gameId,
      roundId: round.id,
      playerId: host.playerId,
      answerIndex: round.questionSnapshot.correctIndex,
      isCorrect: true,
      responseTimeMs: 1000,
      awardedPrize: 20000,
      submittedAt: new Date().toISOString()
    });

    const key = crypto.randomUUID();
    const first = await service.buyLifeline({ ...host, gameId, lifeline: 'fifty_fifty', idempotencyKey: key });
    expect(first.ok).toBe(true);
    // Same key resubmitted (timeout retry) — acknowledged without charging.
    const second = await service.buyLifeline({ ...host, gameId, lifeline: 'fifty_fifty', idempotencyKey: key });
    expect(second.ok).toBe(true);

    const players = await repositories.multiplayer.listPlayers(lobbyId);
    const me = players.find(player => player.id === host.playerId)!;
    expect(me.spentPrize || 0).toBe(5000);
    expect((me.lifelines as Record<string, number>).fifty_fifty).toBe(2);
  });

  it('charges exactly once when the same purchase races itself', async () => {
    const { repositories, service, gameId, lobbyId, round, host } = await startTwoPlayerGame();
    await repositories.multiplayer.createAnswer({
      id: `seed-${crypto.randomUUID()}`,
      gameId,
      roundId: round.id,
      playerId: host.playerId,
      answerIndex: round.questionSnapshot.correctIndex,
      isCorrect: true,
      responseTimeMs: 1000,
      awardedPrize: 20000,
      submittedAt: new Date().toISOString()
    });

    const key = crypto.randomUUID();
    const [a, b] = await Promise.all([
      service.buyLifeline({ ...host, gameId, lifeline: 'audience', idempotencyKey: key }),
      service.buyLifeline({ ...host, gameId, lifeline: 'audience', idempotencyKey: key })
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    const players = await repositories.multiplayer.listPlayers(lobbyId);
    const me = players.find(player => player.id === host.playerId)!;
    expect(me.spentPrize || 0).toBe(5000);
    expect((me.lifelines as Record<string, number>).audience).toBe(2);
  });
});
