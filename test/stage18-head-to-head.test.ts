import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLocalJsonRepositoryProvider } from '@/lib/repositories/providers/localJsonProvider';
import { createMultiplayerService } from '@/lib/multiplayer/service';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
function newService() {
  const repositories = createLocalJsonRepositoryProvider();
  return { repositories, service: createMultiplayerService(repositories) };
}
const anon = (p: string) => `anon-${p}-${crypto.randomUUID()}`;
const create = (service: ReturnType<typeof createMultiplayerService>) =>
  service.createLobby({ nickname: 'Host', anonymousId: anon('h'), locale: 'he', maxPlayers: 2 });
const lobbyIdOf = (r: Awaited<ReturnType<ReturnType<typeof createMultiplayerService>['createLobby']>>) =>
  (r.gameState?.lobby.id || r.lobby?.id) as string;

describe('Stage 18 — strict head-to-head (server-authoritative, two players max)', () => {
  it('1/2. a created lobby has capacity 2 with the host in the first seat', async () => {
    const { service } = newService();
    const created = await create(service);
    expect(created.ok).toBe(true);
    expect(created.gameState?.lobby.maxPlayers ?? created.lobby?.maxPlayers).toBe(2);
    expect(created.gameState?.players.length ?? 1).toBe(1);
  });

  it('7. the game cannot start with only one player', async () => {
    const { service } = newService();
    const created = await create(service);
    expect(Boolean(created.gameState?.game)).toBe(false);
  });

  it('3/8. exactly one opponent joins and the match becomes ready/active with two', async () => {
    const { service } = newService();
    const created = await create(service);
    const lobbyId = lobbyIdOf(created);
    const joined = await service.joinLobby({ lobbyId, nickname: 'Guest', anonymousId: anon('g') });
    expect(joined.ok).toBe(true);
    const state = joined.gameState ?? await service.getLobbyState(lobbyId, joined.credentials!);
    expect(state?.players.length).toBe(2);
    expect(Boolean(state?.game)).toBe(true);
  });

  it('4/5. a third player cannot join a two-player match (rejected server-side)', async () => {
    const { repositories, service } = newService();
    const created = await create(service);
    const lobbyId = lobbyIdOf(created);
    await service.joinLobby({ lobbyId, nickname: 'Guest', anonymousId: anon('g') });
    const third = await service.joinLobby({ lobbyId, nickname: 'Intruder', anonymousId: anon('x') });
    expect(third.ok).toBe(false);
    const players = await repositories.multiplayer.listPlayers(lobbyId);
    expect(players.length).toBe(2);
  });

  it('13/14. duplicate and extra join attempts never create a third seat', async () => {
    const { repositories, service } = newService();
    const created = await create(service);
    const lobbyId = lobbyIdOf(created);
    const guest = anon('g');
    await service.joinLobby({ lobbyId, nickname: 'Guest', anonymousId: guest });
    await service.joinLobby({ lobbyId, nickname: 'Guest', anonymousId: guest }); // same identity again
    await service.joinLobby({ lobbyId, nickname: 'Intruder', anonymousId: anon('x') }); // a different one
    const players = await repositories.multiplayer.listPlayers(lobbyId);
    expect(players.length).toBe(2);
  });

  it('16. a legacy lobby whose stored maxPlayers > 2 is still capped at two joins', async () => {
    const { repositories, service } = newService();
    const created = await create(service);
    const lobbyId = lobbyIdOf(created);
    await repositories.multiplayer.updateLobby(lobbyId, { maxPlayers: 4 as unknown as 2 });
    await service.joinLobby({ lobbyId, nickname: 'Guest', anonymousId: anon('g') });
    const third = await service.joinLobby({ lobbyId, nickname: 'Intruder', anonymousId: anon('x') });
    expect(third.ok).toBe(false);
    const players = await repositories.multiplayer.listPlayers(lobbyId);
    expect(players.length).toBe(2);
  });
});

describe('Stage 18 — capacity is fixed at two across API, UI and types', () => {
  it('6/18. the API collapses any requested maxPlayers to exactly 2', () => {
    const route = read('src/app/api/multiplayer/lobbies/route.ts');
    expect(/function maxPlayersValue\([^)]*\):\s*2\s*\{/.test(route)).toBe(true);
    expect(route.includes('value === 3 || value === 4')).toBe(false);
  });
  it('9. the multiplayer UI has no 3rd/4th seat selector', () => {
    const mp = read('src/components/multiplayer/MultiplayerMode.tsx');
    expect(mp.includes('[2, 3, 4]')).toBe(false);
    expect(mp.includes('multiplayer-player-count')).toBe(false);
    expect(mp.includes('const maxPlayers = 2 as const')).toBe(true);
  });
  it('17. the type system fixes lobby capacity at two', () => {
    const types = read('src/lib/multiplayer/types.ts');
    expect(types.includes('maxPlayers: 2 | 3 | 4')).toBe(false);
    expect(types.includes('maxPlayers: 2;')).toBe(true);
  });
});

describe('Stage 18 — Multiplayer shares the Solo game-show visual language', () => {
  const mp = read('src/components/multiplayer/MultiplayerMode.tsx');
  const css = read('src/app/globals.css');
  it('1/2/10. waiting room renders exactly two seats — no roster grid, no third seat', () => {
    expect(mp.includes('multiplayer-versus')).toBe(true);
    expect(mp.includes('([0, 1] as const).map')).toBe(true);
    expect(mp.includes('multiplayer-roster')).toBe(false);
    expect(mp.includes('grid-cols-3')).toBe(false);
    expect(mp.includes('grid-cols-4')).toBe(false);
  });
  it('3. live round renders answers with the shared .answer-button primitive', () => {
    expect(mp.includes('multiplayer-answer-grid')).toBe(true);
    expect(mp.includes("'answer-button'")).toBe(true);
  });
  it('5. multiplayer answer cards carry the shared cyan under-glow', () => {
    expect(css.includes('.multiplayer-answer-grid .answer-button:not(.correct):not(.wrong)')).toBe(true);
    expect(css.includes('hsla(203, 92%, 60%, 0.42)')).toBe(true);
  });
  it('6. correct/wrong states override the neutral cyan glow (scoped :not)', () => {
    expect(css.includes('.multiplayer-answer-grid .answer-button:not(.correct):not(.wrong)')).toBe(true);
  });
  it('two players read as a balanced versus block, using only existing copy', () => {
    expect(mp.includes('versus-seat')).toBe(true);
    expect(mp.includes('copy.host')).toBe(true);
    expect(mp.includes('copy.you')).toBe(true);
  });
  it('17/18. signed-out MP result keeps the account CTA; authenticated hides it', () => {
    expect(mp.includes('!isAuthenticated && saveProgressLabel')).toBe(true);
  });
});

describe('Stage 18 — additive head-to-head DB migration', () => {
  const sql = read('database/012_multiplayer_head_to_head.sql');
  it('8/9/16. default drops to 2 and a NOT VALID cap preserves legacy rows', () => {
    expect(sql.includes('set default 2')).toBe(true);
    expect(sql.includes('check (max_players <= 2) not valid')).toBe(true);
  });
});

describe('Stage 18 — Solo unchanged; Admin untouched', () => {
  const css = read('src/app/globals.css');
  it('19/24. Solo keeps its game-active cyan under-glow rule', () => {
    expect(css.includes('.game-active .answer-button:not(.correct):not(.wrong)')).toBe(true);
  });
});
