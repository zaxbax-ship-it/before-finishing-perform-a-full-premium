'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/auth/supabaseBrowserClient';
import { getMultiplayerCopy } from '@/lib/multiplayer/localization';
import type {
  MultiplayerActionResult,
  MultiplayerErrorCode,
  MultiplayerLobbySummary,
  MultiplayerPlayerCredentials,
  MultiplayerPublicGameState
} from '@/lib/multiplayer/types';
import type { Locale } from '@/lib/types';

type MultiplayerModeProps = {
  locale: Locale;
  initialNickname: string;
};

const ANON_KEY = 'premium-trivia-multiplayer-anonymous-id-v1';
const SESSION_KEY = 'premium-trivia-multiplayer-session-v1';

type StoredSession = MultiplayerPlayerCredentials & {
  lobbyId?: string;
  gameId?: string;
};

export function MultiplayerMode({ locale, initialNickname }: MultiplayerModeProps) {
  const copy = getMultiplayerCopy(locale);
  const [nickname, setNickname] = useState(initialNickname || '');
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(2);
  const [lobbies, setLobbies] = useState<MultiplayerLobbySummary[]>([]);
  const [gameState, setGameState] = useState<MultiplayerPublicGameState | undefined>();
  const [credentials, setCredentials] = useState<StoredSession | undefined>();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [anonymousId, setAnonymousId] = useState('');

  const activeGameId = gameState?.game?.id || credentials?.gameId;
  const activeLobbyId = gameState?.lobby?.id || credentials?.lobbyId;
  const currentRound = gameState?.currentRound;
  const myResult = useMemo(() => {
    if (!gameState?.me) return undefined;
    return gameState.results.find(result => result.playerId === gameState.me?.id);
  }, [gameState]);

  function persistSession(session: StoredSession) {
    setCredentials(session);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  async function refreshLobbies() {
    setStatus('loading');
    try {
      const response = await fetch('/api/multiplayer/lobbies', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && Array.isArray(data?.lobbies)) {
        setLobbies(data.lobbies);
        setStatus('idle');
        return;
      }
    } catch {
      // Keep the multiplayer shell visible even if the optional API is unavailable.
    }
    setStatus('error');
    setMessage(copy.error);
  }

  async function refreshState(session: StoredSession, gameId?: string, lobbyId?: string) {
    try {
      const response = await fetch(
        gameId
          ? `/api/multiplayer/games/${encodeURIComponent(gameId)}`
          : `/api/multiplayer/lobbies/${encodeURIComponent(lobbyId || '')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ action: 'state', playerId: session.playerId, playerToken: session.playerToken })
        }
      );
      const data = await response.json();
      if (response.ok && data?.gameState) {
        setGameState(data.gameState);
        if (data.gameState.game?.id) persistSession({ ...session, gameId: data.gameState.game.id, lobbyId: data.gameState.lobby.id });
      }
    } catch {
      // The local fallback keeps the room usable even when realtime is offline.
    }
  }

  useEffect(() => {
    const storedAnonymousId = readLocal(ANON_KEY, `anon-${crypto.randomUUID()}`);
    localStorage.setItem(ANON_KEY, JSON.stringify(storedAnonymousId));
    setAnonymousId(storedAnonymousId);
    if (!nickname.trim()) setNickname(defaultNickname(storedAnonymousId));
    const storedSession = readLocal<StoredSession | undefined>(SESSION_KEY, undefined);
    if (storedSession?.playerId && storedSession.playerToken) setCredentials(storedSession);
    void refreshLobbies();
  }, []);

  useEffect(() => {
    if (!credentials?.playerId || !credentials.playerToken) return;
    if (!activeLobbyId && !activeGameId) return;

    let active = true;
    const refresh = async () => {
      if (!active) return;
      await refreshState(credentials, activeGameId, activeLobbyId);
    };
    void refresh();
    const interval = window.setInterval(refresh, 2800);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [credentials?.playerId, credentials?.playerToken, activeGameId, activeLobbyId]);

  useEffect(() => {
    if (!credentials?.playerId || !credentials.playerToken) return;
    if (!activeLobbyId && !activeGameId) return;

    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    const refresh = () => {
      void refreshState(credentials, activeGameId, activeLobbyId);
    };
    const channel = supabase.channel(`multiplayer:${activeGameId || activeLobbyId || credentials.playerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'multiplayer_lobbies', filter: activeLobbyId ? `id=eq.${activeLobbyId}` : undefined }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'multiplayer_games', filter: activeGameId ? `id=eq.${activeGameId}` : activeLobbyId ? `lobby_id=eq.${activeLobbyId}` : undefined }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'multiplayer_results', filter: activeGameId ? `game_id=eq.${activeGameId}` : undefined }, refresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [credentials, activeGameId, activeLobbyId]);

  async function createOrQuick(action: 'create' | 'quick_match') {
    if (!anonymousId) {
      setStatus('error');
      setMessage(copy.error);
      return;
    }
    const typedNickname = cleanNickname(nickname);
    const cleaned = typedNickname.length >= 3 ? typedNickname : defaultNickname(anonymousId);
    if (cleaned !== nickname) setNickname(cleaned);

    setStatus('loading');
    setMessage(copy.joining);
    try {
      const response = await fetch('/api/multiplayer/lobbies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, nickname: cleaned, anonymousId, maxPlayers, locale })
      });
      const data = await response.json() as MultiplayerActionResult;
      if (response.ok && data.ok) {
        applyActionResult(data);
        setStatus('idle');
        setMessage('');
        return;
      }
      setStatus('error');
      setMessage(multiplayerErrorMessage(data, copy));
      return;
    } catch {
      // Handled below.
    }
    setStatus('error');
    setMessage(copy.error);
  }

  async function joinLobby(lobbyId: string) {
    if (!anonymousId) return;
    const typedNickname = cleanNickname(nickname);
    const cleaned = typedNickname.length >= 3 ? typedNickname : defaultNickname(anonymousId);
    if (cleaned !== nickname) setNickname(cleaned);
    setStatus('loading');
    try {
      const response = await fetch(`/api/multiplayer/lobbies/${encodeURIComponent(lobbyId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', nickname: cleaned, anonymousId })
      });
      const data = await response.json() as MultiplayerActionResult;
      applyActionResult(data);
      setStatus(response.ok && data.ok ? 'idle' : 'error');
      if (response.ok && data.ok) setMessage('');
      if (!data.ok) setMessage(multiplayerErrorMessage(data, copy));
    } catch {
      setStatus('error');
      setMessage(copy.error);
    }
  }

  async function startGame() {
    if (!credentials?.playerId || !credentials.playerToken || !gameState?.lobby.id) return;
    setStatus('loading');
    try {
      const response = await fetch(`/api/multiplayer/lobbies/${encodeURIComponent(gameState.lobby.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', ...credentials })
      });
      const data = await response.json() as MultiplayerActionResult;
      applyActionResult(data);
      setStatus(response.ok && data.ok ? 'idle' : 'error');
      if (response.ok && data.ok) setMessage('');
      if (!data.ok) setMessage(multiplayerErrorMessage(data, copy));
    } catch {
      setStatus('error');
      setMessage(copy.error);
    }
  }

  async function submitAnswer(answerIndex: number) {
    if (!credentials?.playerId || !credentials.playerToken || !activeGameId || !currentRound || currentRound.hasAnswered) return;
    setStatus('loading');
    try {
      const response = await fetch(`/api/multiplayer/games/${encodeURIComponent(activeGameId)}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credentials, roundId: currentRound.id, answerIndex })
      });
      const data = await response.json() as MultiplayerActionResult;
      applyActionResult(data);
      setStatus(response.ok && data.ok ? 'idle' : 'error');
      if (response.ok && data.ok) setMessage('');
      if (!data.ok) setMessage(multiplayerErrorMessage(data, copy));
    } catch {
      setStatus('error');
      setMessage(copy.error);
    }
  }

  async function leave() {
    if (!credentials?.playerId || !credentials.playerToken || !activeLobbyId) return;
    try {
      await fetch(`/api/multiplayer/lobbies/${encodeURIComponent(activeLobbyId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave', ...credentials })
      });
    } catch {
      // Leaving is best-effort; local state should still clear.
    }
    localStorage.removeItem(SESSION_KEY);
    setCredentials(undefined);
    setGameState(undefined);
    setMessage('');
    await refreshLobbies();
  }

  function applyActionResult(data: MultiplayerActionResult) {
    if (data.credentials) {
      const session = {
        ...data.credentials,
        lobbyId: data.gameState?.lobby.id || data.lobby?.id,
        gameId: data.gameState?.game?.id
      };
      persistSession(session);
    }
    if (data.gameState) setGameState(data.gameState);
    if (data.lobby) {
      setGameState({
        lobby: data.lobby,
        players: [],
        answers: [],
        results: [],
        notifications: [copy.connectionReady]
      });
    }
    if (data.error) setMessage(multiplayerErrorMessage(data, copy));
  }

  const statusLabel = gameState?.lobby.status ? copy[statusKey(gameState.lobby.status)] || gameState.lobby.status : copy.waiting;

  return (
    <section className="multiplayer-shell mx-auto w-full max-w-[1680px] px-5 pb-16 pt-8 lg:px-8" aria-live="polite">
      <div className="multiplayer-hero glass">
        <div>
          <p className="multiplayer-kicker">{copy.nav}</p>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="multiplayer-status-card">
          <span>{copy.connectionReady}</span>
          <strong>{statusLabel}</strong>
        </div>
      </div>

      {!gameState && (
        <div className="multiplayer-grid">
          <section className="glass multiplayer-panel">
            <label className="block">
              <span className="mb-2 block text-sm text-white/65">{copy.nickname}</span>
              <input className="form-input" value={nickname} maxLength={20} onChange={event => setNickname(event.target.value)} />
            </label>
            <div className="multiplayer-player-count" role="group" aria-label={copy.players}>
              {([2, 3, 4] as const).map(count => (
                <button
                  key={count}
                  className={maxPlayers === count ? 'multiplayer-pill active focus-ring' : 'multiplayer-pill focus-ring'}
                  onClick={() => setMaxPlayers(count)}
                  type="button"
                >
                  {count === 2 ? copy.twoPlayers : count === 3 ? copy.threePlayers : copy.fourPlayers}
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <button className="premium-button focus-ring" disabled={status === 'loading'} onClick={() => createOrQuick('quick_match')}>
                {copy.quick}
              </button>
              <button className="ghost-button focus-ring" disabled={status === 'loading'} onClick={() => createOrQuick('create')}>
                {copy.create}
              </button>
            </div>
          </section>

          <section className="glass multiplayer-panel">
            <div className="multiplayer-panel-heading">
              <h2>{copy.openGames}</h2>
              <button className="ghost-button focus-ring" onClick={refreshLobbies}>{copy.refresh}</button>
            </div>
            <div className="multiplayer-lobby-list">
              {lobbies.length === 0 && <p className="multiplayer-empty">{copy.noGames}</p>}
              {lobbies.map(lobby => (
                <article key={lobby.id} className="multiplayer-lobby-card">
                  <div>
                    <strong>{copy.players}: {lobby.playerCount} / {lobby.maxPlayers}</strong>
                    <span>{copy[statusKey(lobby.status)] || lobby.status}</span>
                  </div>
                  <button className="ghost-button focus-ring" onClick={() => joinLobby(lobby.id)}>{copy.join}</button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {gameState && !currentRound && gameState.game?.status !== 'finished' && (
        <section className="glass multiplayer-waiting">
          <div className="multiplayer-loader" aria-hidden="true" />
          <h2>{copy.waiting}</h2>
          <p>{gameState.lobby.playerCount} / {gameState.lobby.maxPlayers} {copy.players}</p>
          <div className="multiplayer-roster">
            {gameState.lobby.players.map(player => (
              <span key={player.id}>{player.nickname}</span>
            ))}
          </div>
          <div className="multiplayer-actions">
            {gameState.lobby.playerCount >= 2 && gameState.me?.id === gameState.lobby.hostPlayerId && (
              <button className="premium-button focus-ring" onClick={startGame}>{copy.startGame}</button>
            )}
            <button className="ghost-button focus-ring" onClick={leave}>{copy.leave}</button>
          </div>
        </section>
      )}

      {gameState && currentRound && (
        <section className="glass multiplayer-game">
          <div className="multiplayer-round-meta">
            <span>{copy.questionLive}</span>
            <strong>{money(currentRound.prize)}</strong>
          </div>
          <h2>{currentRound.question.question}</h2>
          <div className="multiplayer-answer-grid">
            {currentRound.question.options.map((option, index) => (
              <button
                key={`${currentRound.id}-${index}`}
                className={currentRound.selectedAnswerIndex === index ? 'answer-button selected' : 'answer-button'}
                disabled={currentRound.hasAnswered || status === 'loading'}
                onClick={() => submitAnswer(index)}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                <span>{option}</span>
              </button>
            ))}
          </div>
          {currentRound.hasAnswered && <div className="multiplayer-toast">{copy.answered}</div>}
          <MultiplayerScoreboard copy={copy} state={gameState} />
        </section>
      )}

      {gameState?.game?.status === 'finished' && (
        <section className="glass multiplayer-results">
          <h2>{copy.results}</h2>
          <MultiplayerScoreboard copy={copy} state={gameState} />
          {myResult && (
            <div className="multiplayer-personal-result">
              <span>{copy.rank}: {myResult.rank}</span>
              <strong>{money(myResult.totalPrize)}</strong>
            </div>
          )}
          <button className="premium-button focus-ring" onClick={leave}>{copy.quick}</button>
        </section>
      )}

      {(message || status === 'error') && <div className="multiplayer-toast error">{message || copy.error}</div>}
      {gameState?.notifications.map(item => (
        <div key={item} className="multiplayer-toast">{copy.notification}: {localizeNotification(item, copy)}</div>
      ))}
    </section>
  );
}

function MultiplayerScoreboard({ copy, state }: { copy: ReturnType<typeof getMultiplayerCopy>; state: MultiplayerPublicGameState }) {
  const totals = state.players.map(player => {
    const result = state.results.find(item => item.playerId === player.id);
    const playerAnswers = state.answers.filter(answer => answer.playerId === player.id);
    const livePrize = playerAnswers.reduce((sum, answer) => sum + answer.awardedPrize, 0);
    return {
      player,
      totalPrize: result?.totalPrize ?? livePrize,
      correctAnswers: result?.correctAnswers ?? playerAnswers.filter(answer => answer.isCorrect).length,
      rank: result?.rank
    };
  }).sort((first, second) => (first.rank || 99) - (second.rank || 99) || second.totalPrize - first.totalPrize);

  return (
    <div className="multiplayer-scoreboard" role="table" aria-label={copy.results}>
      <div className="multiplayer-score-row head" role="row">
        <span role="columnheader">{copy.rank}</span>
        <span role="columnheader">{copy.players}</span>
        <span role="columnheader">{copy.prize}</span>
      </div>
      {totals.map((row, index) => (
        <div key={row.player.id} className="multiplayer-score-row" role="row">
          <span role="cell">{row.rank || index + 1}</span>
          <strong role="cell">{row.player.nickname}</strong>
          <span role="cell">{money(row.totalPrize)}</span>
        </div>
      ))}
    </div>
  );
}

function statusKey(status: string) {
  return status === 'in_progress' ? 'inProgress' : status;
}

function money(value: number) {
  return `$${new Intl.NumberFormat('en-US').format(value)}`;
}

function cleanNickname(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 20);
}

function defaultNickname(seed: string) {
  const suffix = seed.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  return `Player${suffix || Math.floor(1000 + Math.random() * 9000)}`.slice(0, 20);
}

function localizeNotification(value: string, copy: ReturnType<typeof getMultiplayerCopy>) {
  const playerCount = value.match(/(\d+)\s*\/\s*(\d+)\s*players/i);
  if (playerCount) return `${playerCount[1]} / ${playerCount[2]} ${copy.players}`;
  if (/waiting for players/i.test(value)) return copy.waiting;
  if (/player joined/i.test(value)) return copy.ready;
  if (/game is live/i.test(value)) return copy.inProgress;
  if (/winner/i.test(value)) return copy.results;
  if (/game finished/i.test(value)) return copy.finished;
  if (/question is live/i.test(value)) return copy.questionLive;
  return value;
}

function multiplayerErrorMessage(data: Pick<MultiplayerActionResult, 'error' | 'errorCode'>, copy: ReturnType<typeof getMultiplayerCopy>) {
  if (data.errorCode && copy[data.errorCode]) return copy[data.errorCode];
  return localizeKnownError(data.error || '', copy);
}

function localizeKnownError(value: string, copy: ReturnType<typeof getMultiplayerCopy>) {
  if (!value) return copy.error;
  const known: Array<[RegExp, MultiplayerErrorCode]> = [
    [/nickname must/i, 'invalid_nickname'],
    [/not found/i, 'lobby_not_found'],
    [/expired/i, 'lobby_expired'],
    [/not accepting/i, 'lobby_not_accepting'],
    [/full/i, 'lobby_full'],
    [/nickname is already/i, 'nickname_taken'],
    [/session is invalid/i, 'player_session_invalid'],
    [/only the host/i, 'host_only'],
    [/already starting/i, 'game_already_starting'],
    [/two players/i, 'not_enough_players'],
    [/not enough questions/i, 'not_enough_questions'],
    [/start the game/i, 'game_start_failed'],
    [/answer is invalid/i, 'answer_invalid'],
    [/game is not active/i, 'game_not_active'],
    [/round is invalid/i, 'round_invalid'],
    [/round is not active/i, 'round_not_active'],
    [/not started/i, 'round_not_started'],
    [/already ended/i, 'round_ended'],
    [/missing player identity/i, 'missing_identity'],
    [/missing player session/i, 'missing_session'],
    [/too many multiplayer requests/i, 'rate_limited']
  ];
  const match = known.find(([pattern]) => pattern.test(value));
  return match ? copy[match[1]] || copy.error : copy.error;
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}
