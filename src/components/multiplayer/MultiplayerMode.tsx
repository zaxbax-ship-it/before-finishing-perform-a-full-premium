'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/auth/supabaseBrowserClient';
import {
  AchievementsIcon,
  CelebrationIcon,
  CopyIcon,
  MultiplayerIcon,
  PhoneFriendIcon,
  PlayIcon,
  PremiumIcon,
  RefreshIcon,
  ShareIcon,
  AudienceIcon,
  FiftyFiftyIcon
} from '@/lib/design/icons';
import { getMultiplayerCopy, multiplayerOptionLetter } from '@/lib/multiplayer/localization';
import { revealSection } from '@/lib/ui/revealSection';
import { localizeCategory } from '@/lib/localization';
import type {
  MultiplayerActionResult,
  MultiplayerErrorCode,
  MultiplayerLifelineId,
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
const LIFELINE_COST = 5000;
const LIFELINES: MultiplayerLifelineId[] = ['fifty_fifty', 'audience', 'friend'];

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
  const [nowMs, setNowMs] = useState(0);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<string | undefined>();
  const shellRef = useRef<HTMLElement | null>(null);

  // Reliability guards: monotonically ordered state application (a late poll
  // response must not overwrite a newer action result), a single in-flight
  // stateful action (rapid double-taps / duplicate tabs), and a stable
  // idempotency key per logical lifeline purchase (network retry safety).
  const requestSeqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  const actionInFlightRef = useRef(false);
  const purchaseKeysRef = useRef<Partial<Record<MultiplayerLifelineId, string>>>({});

  const activeGameId = gameState?.game?.id || credentials?.gameId;
  const activeLobbyId = gameState?.lobby?.id || credentials?.lobbyId;
  const currentRound = gameState?.currentRound;
  const timer = currentRound ? roundTimer(currentRound.startsAt, currentRound.endsAt, nowMs) : undefined;
  const activeEffects = gameState?.myLifelineEffects?.filter(effect => effect.roundId === currentRound?.id) || [];
  const hiddenOptionIndexes = new Set(activeEffects.flatMap(effect => effect.type === 'fifty_fifty' ? effect.hiddenOptionIndexes : []));
  const myResult = useMemo(() => {
    if (!gameState?.me) return undefined;
    return gameState.results.find(result => result.playerId === gameState.me?.id);
  }, [gameState]);

  async function copyInvite() {
    if (!activeLobbyId) return;
    try {
      await navigator.clipboard.writeText(inviteLink(activeLobbyId));
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2200);
    } catch {
      // Clipboard can be unavailable in insecure contexts; the code is still visible.
    }
  }

  async function shareInvite() {
    if (!activeLobbyId) return;
    const url = inviteLink(activeLobbyId);
    if (navigator.share) {
      try { await navigator.share({ title: copy.title, url }); return; } catch { /* user cancelled */ }
    }
    await copyInvite();
  }

  function persistSession(session: StoredSession) {
    setCredentials(session);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  /**
   * The lobby/game this client was tracking no longer exists. Drop the stored
   * session and clear local room state so polling stops (the effects that poll
   * are gated on an active lobby/game id) and the user lands back on the
   * multiplayer hub with a clear explanation.
   */
  function abandonStaleSession() {
    localStorage.removeItem(SESSION_KEY);
    setCredentials(undefined);
    setGameState(undefined);
    setMessage(copy.sessionEnded);
    void refreshLobbies();
  }

  async function refreshLobbies() {
    setStatus('loading');
    try {
      const response = await fetch('/api/multiplayer/lobbies', { cache: 'no-store', signal: fetchTimeout(10000) });
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
    // Ordered application: a slow poll that started before a newer action
    // result must not clobber it when it finally arrives.
    const seq = ++requestSeqRef.current;
    try {
      const response = await fetch(
        gameId
          ? `/api/multiplayer/games/${encodeURIComponent(gameId)}`
          : `/api/multiplayer/lobbies/${encodeURIComponent(lobbyId || '')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          signal: fetchTimeout(10000),
          body: JSON.stringify({ action: 'state', playerId: session.playerId, playerToken: session.playerToken })
        }
      );
      const data = await response.json().catch(() => null);
      // The lobby/game this session points at is gone: abandon it and return
      // to the hub instead of retrying a dead resource on every poll.
      if (response.status === 404 || isSessionGoneCode(data?.errorCode)) {
        abandonStaleSession();
        return;
      }
      if (response.ok && data?.gameState && seq > appliedSeqRef.current) {
        appliedSeqRef.current = seq;
        setGameState(data.gameState);
        if (data.gameState.game?.id) persistSession({ ...session, gameId: data.gameState.game.id, lobbyId: data.gameState.lobby.id });
      }
    } catch {
      // Network/timeout is transient — keep the room usable and never discard
      // the session on a connectivity blip. Only an authoritative not-found
      // response (handled above) abandons the session.
    }
  }

  useEffect(() => {
    const storedAnonymousId = readLocal(ANON_KEY, `anon-${randomId()}`);
    localStorage.setItem(ANON_KEY, JSON.stringify(storedAnonymousId));
    setAnonymousId(storedAnonymousId);
    if (!nickname.trim()) setNickname(defaultNickname(storedAnonymousId));
    const storedSession = readLocal<StoredSession | undefined>(SESSION_KEY, undefined);
    if (storedSession?.playerId && storedSession.playerToken) setCredentials(storedSession);
    void refreshLobbies();
    // Invitation links (/?join=<lobbyId>) queue an auto-join that fires once
    // the anonymous identity is ready (see effect below joinLobby).
    const joinTarget = new URLSearchParams(window.location.search).get('join');
    if (joinTarget) {
      // Always strip the invite param so a stale ?join= can never hijack a
      // later load of / (e.g. pressing Back from the login page).
      // Preserve the in-app navigation state; only the query string is stripped.
      window.history.replaceState(window.history.state, '', window.location.pathname);
      if (!(storedSession?.lobbyId === joinTarget)) setPendingJoin(joinTarget);
    }
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'multiplayer_players', filter: activeLobbyId ? `lobby_id=eq.${activeLobbyId}` : undefined }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'multiplayer_results', filter: activeGameId ? `game_id=eq.${activeGameId}` : undefined }, refresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [credentials, activeGameId, activeLobbyId]);

  useEffect(() => {
    if (!currentRound) return;
    setNowMs(Date.now());
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [currentRound?.id]);

  async function createOrQuick(action: 'create' | 'quick_match') {
    if (!anonymousId) {
      setStatus('error');
      setMessage(copy.error);
      return;
    }
    const typedNickname = cleanNickname(nickname);
    const cleaned = typedNickname.length >= 3 ? typedNickname : defaultNickname(anonymousId);
    if (cleaned !== nickname) setNickname(cleaned);

    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setStatus('loading');
    setMessage(copy.joining);
    const seq = ++requestSeqRef.current;
    try {
      const response = await fetch('/api/multiplayer/lobbies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: fetchTimeout(15000),
        body: JSON.stringify({ action, nickname: cleaned, anonymousId, maxPlayers, locale })
      });
      const data = await response.json() as MultiplayerActionResult;
      if (response.ok && data.ok) {
        applyActionResult(data, seq);
        setStatus('idle');
        setMessage('');
        return;
      }
      setStatus('error');
      setMessage(multiplayerErrorMessage(data, copy));
      return;
    } catch {
      // Handled below.
    } finally {
      actionInFlightRef.current = false;
    }
    setStatus('error');
    setMessage(copy.error);
  }

  async function joinLobby(lobbyId: string) {
    if (!anonymousId) return;
    const typedNickname = cleanNickname(nickname);
    const cleaned = typedNickname.length >= 3 ? typedNickname : defaultNickname(anonymousId);
    if (cleaned !== nickname) setNickname(cleaned);
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setStatus('loading');
    const seq = ++requestSeqRef.current;
    try {
      const response = await fetch(`/api/multiplayer/lobbies/${encodeURIComponent(lobbyId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: fetchTimeout(15000),
        body: JSON.stringify({ action: 'join', nickname: cleaned, anonymousId })
      });
      const data = await response.json() as MultiplayerActionResult;
      applyActionResult(data, seq);
      setStatus(response.ok && data.ok ? 'idle' : 'error');
      if (response.ok && data.ok) setMessage('');
      if (!data.ok) setMessage(multiplayerErrorMessage(data, copy));
    } catch {
      setStatus('error');
      setMessage(copy.error);
    } finally {
      actionInFlightRef.current = false;
    }
  }

  async function startGame() {
    if (!credentials?.playerId || !credentials.playerToken || !gameState?.lobby.id) return;
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setStatus('loading');
    const seq = ++requestSeqRef.current;
    try {
      const response = await fetch(`/api/multiplayer/lobbies/${encodeURIComponent(gameState.lobby.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: fetchTimeout(15000),
        body: JSON.stringify({ action: 'start', ...credentials })
      });
      const data = await response.json() as MultiplayerActionResult;
      applyActionResult(data, seq);
      setStatus(response.ok && data.ok ? 'idle' : 'error');
      if (response.ok && data.ok) setMessage('');
      if (!data.ok) setMessage(multiplayerErrorMessage(data, copy));
    } catch {
      setStatus('error');
      setMessage(copy.error);
    } finally {
      actionInFlightRef.current = false;
    }
  }

  async function submitAnswer(answerIndex: number) {
    if (!credentials?.playerId || !credentials.playerToken || !activeGameId || !currentRound || currentRound.hasAnswered) return;
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setStatus('loading');
    const seq = ++requestSeqRef.current;
    try {
      const response = await fetch(`/api/multiplayer/games/${encodeURIComponent(activeGameId)}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: fetchTimeout(15000),
        body: JSON.stringify({ ...credentials, roundId: currentRound.id, answerIndex })
      });
      const data = await response.json() as MultiplayerActionResult;
      applyActionResult(data, seq);
      setStatus(response.ok && data.ok ? 'idle' : 'error');
      if (response.ok && data.ok) setMessage('');
      if (!data.ok) setMessage(multiplayerErrorMessage(data, copy));
    } catch {
      setStatus('error');
      setMessage(copy.error);
    } finally {
      actionInFlightRef.current = false;
    }
  }

  async function useLifeline(lifeline: MultiplayerLifelineId) {
    if (!credentials?.playerId || !credentials.playerToken || !activeGameId || !currentRound || currentRound.hasAnswered) return;
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setStatus('loading');
    const seq = ++requestSeqRef.current;
    try {
      const response = await fetch(`/api/multiplayer/games/${encodeURIComponent(activeGameId)}/lifelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: fetchTimeout(15000),
        body: JSON.stringify({ ...credentials, roundId: currentRound.id, lifeline })
      });
      const data = await response.json() as MultiplayerActionResult;
      applyActionResult(data, seq);
      setStatus(response.ok && data.ok ? 'idle' : 'error');
      if (response.ok && data.ok) setMessage('');
      if (!data.ok) setMessage(multiplayerErrorMessage(data, copy));
    } catch {
      setStatus('error');
      setMessage(copy.error);
    } finally {
      actionInFlightRef.current = false;
    }
  }

  async function buyLifeline(lifeline: MultiplayerLifelineId) {
    if (!credentials?.playerId || !credentials.playerToken || !activeGameId) return;
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    // Stable key per logical purchase: a retry after a lost response reuses
    // it, so the server acknowledges once and never charges twice.
    const idempotencyKey = purchaseKeysRef.current[lifeline] || randomId();
    purchaseKeysRef.current[lifeline] = idempotencyKey;
    setStatus('loading');
    const seq = ++requestSeqRef.current;
    try {
      const response = await fetch(`/api/multiplayer/games/${encodeURIComponent(activeGameId)}/lifelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: fetchTimeout(15000),
        body: JSON.stringify({ action: 'buy', ...credentials, lifeline, idempotencyKey })
      });
      const data = await response.json() as MultiplayerActionResult;
      if (response.ok && data.ok) delete purchaseKeysRef.current[lifeline];
      applyActionResult(data, seq);
      setStatus(response.ok && data.ok ? 'idle' : 'error');
      if (response.ok && data.ok) setMessage('');
      if (!data.ok) setMessage(multiplayerErrorMessage(data, copy));
    } catch {
      setStatus('error');
      setMessage(copy.error);
    } finally {
      actionInFlightRef.current = false;
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

  function applyActionResult(data: MultiplayerActionResult, seq: number) {
    if (data.credentials) {
      const session = {
        ...data.credentials,
        lobbyId: data.gameState?.lobby.id || data.lobby?.id,
        gameId: data.gameState?.game?.id
      };
      persistSession(session);
    }
    // Ordered application — an older response never overwrites newer state.
    if (data.gameState && seq > appliedSeqRef.current) {
      appliedSeqRef.current = seq;
      setGameState(data.gameState);
    }
    if (data.lobby && seq > appliedSeqRef.current) {
      appliedSeqRef.current = seq;
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

  // Auto-join from an invitation link, once identity + handlers are all declared.
  useEffect(() => {
    if (!pendingJoin || !anonymousId) return;
    setPendingJoin(undefined);
    void joinLobby(pendingJoin);
  }, [pendingJoin, anonymousId]);

  // Reveal the multiplayer area whenever its phase changes (entry, waiting
  // room, each round, results) — same reusable behavior as screen changes.
  const phaseKey = !gameState
    ? 'entry'
    : gameState.game?.status === 'finished'
      ? 'results'
      : currentRound
        ? `round-${currentRound.id}`
        : 'waiting';
  useEffect(() => {
    revealSection(shellRef.current);
  }, [phaseKey]);

  const statusLabel = gameState?.lobby.status ? copy[statusKey(gameState.lobby.status)] || gameState.lobby.status : copy.waiting;

  return (
    <section ref={shellRef} tabIndex={-1} className="multiplayer-shell screen-section mx-auto w-full max-w-[1680px] px-5 pb-16 pt-8 lg:px-8" aria-live="polite">
      {/* The hero only frames the entry and waiting phases; during a live round
          and on the results screen the gameplay content owns the top of the page. */}
      {!currentRound && gameState?.game?.status !== 'finished' && (
        <div className="multiplayer-hero glass">
          <div>
            <p className="multiplayer-kicker">{copy.nav}</p>
            <h1 className="inline-flex items-center gap-3"><MultiplayerIcon size={28} />{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
          <div className="multiplayer-status-card">
            <span>{copy.connectionReady}</span>
            <strong>{statusLabel}</strong>
          </div>
        </div>
      )}

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
              <button className="premium-button focus-ring inline-flex items-center justify-center gap-2" disabled={status === 'loading'} onClick={() => createOrQuick('quick_match')}>
                <PlayIcon size={16} />
                {copy.quick}
              </button>
              <button className="ghost-button focus-ring inline-flex items-center justify-center gap-2" disabled={status === 'loading'} onClick={() => createOrQuick('create')}>
                <PremiumIcon size={16} />
                {copy.create}
              </button>
            </div>
          </section>

          <section className="glass multiplayer-panel">
            <div className="multiplayer-panel-heading">
              <h2>{copy.openGames}</h2>
              <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={refreshLobbies}><RefreshIcon size={16} />{copy.refresh}</button>
            </div>
            <div className="multiplayer-lobby-list">
              {lobbies.length === 0 && status !== 'loading' && <p className="multiplayer-empty">{copy.noGames}</p>}
              {status === 'loading' && lobbies.length === 0 && (
                Array.from({ length: 3 }).map((_, index) => (
                  <article key={index} className="multiplayer-lobby-card skeleton-row" style={{ opacity: 0.8 }}>
                    <div className="multiplayer-lobby-info" style={{ width: '100%' }}>
                      <span className="skeleton-block" style={{ width: '40%', height: '1.2rem', marginBottom: '8px' }} />
                      <span className="skeleton-block" style={{ width: '60%', height: '1rem', marginBottom: '8px' }} />
                      <span className="multiplayer-lobby-tags">
                        <em className="skeleton-block" style={{ width: '60px', height: '14px', borderRadius: '4px' }} />
                        <em className="skeleton-block" style={{ width: '80px', height: '14px', borderRadius: '4px' }} />
                      </span>
                    </div>
                  </article>
                ))
              )}
              {lobbies.map(lobby => (
                <article key={lobby.id} className="multiplayer-lobby-card">
                  <div className="multiplayer-lobby-info">
                    <strong>
                      <PremiumIcon size={14} aria-hidden="true" className="lobby-host-icon" />
                      {(lobby.players.find(player => player.id === lobby.hostPlayerId) || lobby.players[0])?.nickname || copy.host}
                    </strong>
                    <span>{copy.players}: {lobby.playerCount} / {lobby.maxPlayers} · {copy[statusKey(lobby.status)] || lobby.status}</span>
                    <span className="multiplayer-lobby-tags">
                      <em>{LANGUAGE_NAMES[lobby.locale] || lobby.locale}</em>
                      <em>{lobby.category ? localizeCategory(locale, lobby.category) : copy.anyCategory}</em>
                    </span>
                  </div>
                  <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => joinLobby(lobby.id)}><PlayIcon size={16} />{copy.join}</button>
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
          <div className="multiplayer-roster grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 w-full max-w-4xl mx-auto my-6">
            {gameState.lobby.players.map(player => {
              const isHost = player.id === gameState.lobby.hostPlayerId;
              const isMe = player.id === gameState.me?.id;
              return (
                <div key={player.id} className={`roster-player-card glass p-5 rounded-[22px] flex flex-col items-center text-center relative border transition-all duration-300 ${isMe ? 'border-gold/50 shadow-gold/5' : 'border-white/10'}`}>
                  {isHost && (
                    <span className="absolute top-3 right-3 text-gold" title={copy.host}>
                      <PremiumIcon size={16} aria-hidden="true" />
                    </span>
                  )}
                  <div className="avatar-placeholder h-12 w-12 rounded-2xl bg-gold/10 text-gold flex items-center justify-center text-lg font-black mb-3">
                    {player.nickname.slice(0, 2).toUpperCase()}
                  </div>
                  <strong className="text-white block truncate w-full font-bold">{player.nickname}</strong>
                  <span className="text-xs text-white/50 mt-2 block">
                    {isHost ? copy.host : copy.players} {isMe && `(${copy.you})`}
                  </span>
                </div>
              );
            })}
          </div>
          {activeLobbyId && (
            <div className="multiplayer-invite" aria-label={copy.lobbyCode}>
              <span className="multiplayer-invite-code">{copy.lobbyCode}: <strong>{lobbyShortCode(activeLobbyId)}</strong></span>
              <div className="multiplayer-invite-actions">
                <button type="button" className="ghost-button focus-ring" onClick={copyInvite}>
                  <CopyIcon size={15} aria-hidden="true" /> {inviteCopied ? copy.inviteCopied : copy.copyInvite}
                </button>
                <button type="button" className="ghost-button focus-ring" onClick={shareInvite}>
                  <ShareIcon size={15} aria-hidden="true" /> {copy.shareInvite}
                </button>
              </div>
            </div>
          )}
          <div className="multiplayer-actions">
            {gameState.lobby.playerCount >= 2 && gameState.me?.id === gameState.lobby.hostPlayerId && (
              <button className="premium-button focus-ring inline-flex items-center justify-center gap-2" onClick={startGame}><PlayIcon size={16} />{copy.startGame}</button>
            )}
            <button className="ghost-button focus-ring inline-flex items-center justify-center gap-2" onClick={leave}><RefreshIcon size={16} />{copy.leave}</button>
          </div>
        </section>
      )}

      {gameState && currentRound && (
        <section key={currentRound.id} className="glass multiplayer-game multiplayer-round-enter">
          {/* Question first, answers immediately below — same "single frame"
              philosophy as solo gameplay. Lifelines follow as a compact toolbar. */}
          <div className="multiplayer-round-meta">
            <span>{copy.questionLive}</span>
            {timer && (
              <div className={timer.remainingMs <= 6000 ? 'multiplayer-timer urgent' : 'multiplayer-timer'} aria-label={`${copy.timer}: ${timer.seconds}`}>
                <span>{timer.seconds}{copy.secondsShort}</span>
                <i style={{ transform: `scaleX(${timer.progress})` }} />
              </div>
            )}
            <strong>{money(currentRound.prize)}</strong>
          </div>
          <h2>{currentRound.question.question}</h2>
          <div className="multiplayer-answer-grid">
            {currentRound.question.options.map((option, index) => (
              <button
                key={`${currentRound.id}-${index}`}
                className={[
                  'answer-button',
                  currentRound.selectedAnswerIndex === index ? 'selected pending' : '',
                  hiddenOptionIndexes.has(index) ? 'lifeline-hidden' : ''
                ].filter(Boolean).join(' ')}
                disabled={currentRound.hasAnswered || status === 'loading' || hiddenOptionIndexes.has(index)}
                onClick={() => submitAnswer(index)}
              >
                <span>{multiplayerOptionLetter(locale, index)}</span>
                <span>{option}</span>
              </button>
            ))}
          </div>
          <MultiplayerLifelines
            copy={copy}
            locale={locale}
            effects={activeEffects}
            lifelines={gameState.myLifelines}
            options={currentRound.question.options}
            availablePrize={gameState.myAvailablePrize || 0}
            disabled={currentRound.hasAnswered || status === 'loading'}
            onUse={useLifeline}
            onBuy={buyLifeline}
          />
          {currentRound.hasAnswered && <div className="multiplayer-toast">{copy.answered}</div>}
          {gameState.roundSummary && <RoundSummary copy={copy} locale={locale} state={gameState} />}
          <MultiplayerScoreboard copy={copy} state={gameState} />
        </section>
      )}

      {gameState?.game?.status === 'finished' && (
        <section className="glass multiplayer-results multiplayer-celebrate">
          <div className="multiplayer-champion" role="status">
            <AchievementsIcon size={44} aria-hidden="true" className="champion-trophy" />
            <div>
              <span>{copy.champion}</span>
              <strong>{[...gameState.results].sort((a, b) => (a.rank || 99) - (b.rank || 99))[0] ? gameState.players.find(player => player.id === [...gameState.results].sort((a, b) => (a.rank || 99) - (b.rank || 99))[0].playerId)?.nickname : ''}</strong>
            </div>
            <CelebrationIcon size={26} aria-hidden="true" className="champion-pop" />
          </div>
          <h2>{copy.results}</h2>
          <MultiplayerScoreboard copy={copy} state={gameState} />
          {myResult && (
            <div className="multiplayer-personal-result">
              <span>{copy.rank}: {myResult.rank}</span>
              <strong>{money(myResult.totalPrize)}</strong>
            </div>
          )}
          <button className="premium-button focus-ring inline-flex items-center justify-center gap-2" onClick={leave}><PlayIcon size={16} />{copy.playAgain}</button>
        </section>
      )}

      {(message || status === 'error') && <div className="multiplayer-toast error">{message || copy.error}</div>}
      {gameState?.notifications.map(item => (
        <div key={item} className="multiplayer-toast">{copy.notification}: {localizeNotification(item, copy)}</div>
      ))}
    </section>
  );
}

function MultiplayerLifelines({
  copy,
  locale,
  effects,
  lifelines,
  options,
  availablePrize,
  disabled,
  onUse,
  onBuy
}: {
  copy: ReturnType<typeof getMultiplayerCopy>;
  locale: Locale;
  effects: MultiplayerPublicGameState['myLifelineEffects'];
  lifelines: MultiplayerPublicGameState['myLifelines'];
  options: string[];
  availablePrize: number;
  disabled: boolean;
  onUse: (lifeline: MultiplayerLifelineId) => void;
  onBuy: (lifeline: MultiplayerLifelineId) => void;
}) {
  const counts = lifelines || { fifty_fifty: 0, audience: 0, friend: 0 };
  return (
    <section className="multiplayer-lifelines" aria-label={copy.lifelines}>
      <div className="multiplayer-lifeline-head">
        <span>{copy.lifelines}</span>
        <strong>{copy.availableWinnings}: {money(availablePrize)}</strong>
      </div>
      <div className="multiplayer-lifeline-grid">
        {LIFELINES.map(lifeline => {
          const count = counts[lifeline] || 0;
          const LifelineIcon = lifeline === 'fifty_fifty' ? FiftyFiftyIcon : lifeline === 'audience' ? AudienceIcon : PhoneFriendIcon;
          return (
            <article key={lifeline} className="multiplayer-lifeline-card">
              <button
                className="ghost-button focus-ring"
                disabled={disabled || count <= 0}
                onClick={() => onUse(lifeline)}
                type="button"
                aria-label={lifelineLabel(lifeline, copy)}
                title={lifelineLabel(lifeline, copy)}
              >
                <span className="multiplayer-lifeline-icon-shell"><LifelineIcon size={18} aria-hidden="true" /></span>
                <span className="sr-only">{lifelineLabel(lifeline, copy)}</span>
                <strong>{count}</strong>
              </button>
              <button
                className="multiplayer-buy-link focus-ring"
                disabled={availablePrize < LIFELINE_COST}
                onClick={() => onBuy(lifeline)}
                type="button"
              >
                <RefreshIcon size={14} aria-hidden="true" /> {copy.buyExtra} {money(LIFELINE_COST)}
              </button>
            </article>
          );
        })}
      </div>
      {effects?.map(effect => (
        <div key={`${effect.type}-${effect.roundId}-${effect.createdAt}`} className="multiplayer-lifeline-effect">
          {effect.type === 'fifty_fifty' && <span>{copy.hiddenOptions}: {effect.hiddenOptionIndexes.map(index => multiplayerOptionLetter(locale, index)).join(', ')}</span>}
          {effect.type === 'audience' && (
            <span>{copy.audienceThinks}: {effect.poll.map((share, index) => `${multiplayerOptionLetter(locale, index)} ${share}%`).join(' · ')}</span>
          )}
          {effect.type === 'friend' && (
            <span>{copy.friendThinks}: {multiplayerOptionLetter(locale, effect.suggestedIndex)} · {copy.confidence} {effect.confidence}% · {options[effect.suggestedIndex]}</span>
          )}
        </div>
      ))}
    </section>
  );
}

function RoundSummary({ copy, locale, state }: { copy: ReturnType<typeof getMultiplayerCopy>; locale: Locale; state: MultiplayerPublicGameState }) {
  if (!state.roundSummary) return null;
  const summary = state.roundSummary;
  const winner = summary.players.find(player => player.playerId === summary.winnerPlayerId);
  return (
    <section className="multiplayer-round-summary" aria-label={copy.roundSummary}>
      <div>
        <span>{copy.roundSummary}</span>
        <h3>{copy.correctAnswer}: {multiplayerOptionLetter(locale, summary.correctIndex)} · {summary.correctAnswer}</h3>
        {summary.explanation && <p>{summary.explanation}</p>}
      </div>
      <div className="multiplayer-round-summary-grid">
        {summary.players.map(player => (
          <article
            key={`${summary.roundId}-${player.playerId}`}
            className={[
              'multiplayer-round-player',
              player.playerId === winner?.playerId ? 'winner' : '',
              player.timedOut ? 'timeout' : player.isCorrect ? 'correct' : 'wrong'
            ].filter(Boolean).join(' ')}
          >
            <strong>{player.nickname}</strong>
            <span>{roundPlayerStatus(player, copy)}</span>
            {player.awardedPrize > 0 && <em>{money(player.awardedPrize)}</em>}
          </article>
        ))}
      </div>
    </section>
  );
}

function MultiplayerScoreboard({ copy, state }: { copy: ReturnType<typeof getMultiplayerCopy>; state: MultiplayerPublicGameState }) {
  const totals = state.players.map(player => {
    const result = state.results.find(item => item.playerId === player.id);
    const playerAnswers = state.answers.filter(answer => answer.playerId === player.id);
    const summaryPlayer = state.roundSummary?.players.find(item => item.playerId === player.id);
    const livePrize = playerAnswers.reduce((sum, answer) => sum + answer.awardedPrize, 0);
    return {
      player,
      totalPrize: result?.totalPrize ?? livePrize,
      correctAnswers: result?.correctAnswers ?? playerAnswers.filter(answer => answer.isCorrect).length,
      rank: result?.rank,
      status: summaryPlayer ? roundPlayerStatus(summaryPlayer, copy) : livePlayerStatus(player.id, state, copy)
    };
  }).sort((first, second) => (first.rank || 99) - (second.rank || 99) || second.totalPrize - first.totalPrize);

  return (
    <div className="multiplayer-scoreboard" role="table" aria-label={copy.results}>
      <div className="multiplayer-score-row head" role="row">
        <span role="columnheader">{copy.rank}</span>
        <span role="columnheader">{copy.players}</span>
        <span role="columnheader">{copy.prize}</span>
        <span role="columnheader">{copy.lifelinesRemaining}</span>
        <span role="columnheader">{copy.responseStatus}</span>
      </div>
      {totals.map((row, index) => (
        <div key={row.player.id} className="multiplayer-score-row" role="row">
          <span role="cell">{row.rank || index + 1}</span>
          <strong role="cell">{row.player.nickname}</strong>
          <span role="cell">{money(row.totalPrize)}</span>
          <span role="cell">{row.player.lifelinesRemaining ?? 0}</span>
          <span role="cell">{row.status}</span>
        </div>
      ))}
    </div>
  );
}

function statusKey(status: string) {
  return status === 'in_progress' ? 'inProgress' : status;
}

function money(value: number) {
  // Same formatting as solo gameplay for a consistent product voice.
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

const LANGUAGE_NAMES: Record<string, string> = { he: 'עברית', en: 'English', ar: 'العربية', ru: 'Русский', am: 'አማርኛ' };

function inviteLink(lobbyId: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/?join=${encodeURIComponent(lobbyId)}`;
}

function lobbyShortCode(lobbyId: string) {
  return lobbyId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
}

function lifelineLabel(lifeline: MultiplayerLifelineId, copy: ReturnType<typeof getMultiplayerCopy>) {
  if (lifeline === 'fifty_fifty') return copy.fiftyFifty;
  if (lifeline === 'audience') return copy.audience;
  return copy.friend;
}

function roundTimer(startsAt: string, endsAt: string, nowValue: number) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const total = Math.max(1, end - start);
  const remainingMs = Math.max(0, end - nowValue);
  return {
    remainingMs,
    seconds: Math.ceil(remainingMs / 1000),
    progress: Math.max(0, Math.min(1, remainingMs / total))
  };
}

function roundPlayerStatus(
  player: NonNullable<MultiplayerPublicGameState['roundSummary']>['players'][number],
  copy: ReturnType<typeof getMultiplayerCopy>
) {
  if (player.timedOut) return copy.timedOut;
  if (player.awardedPrize > 0) return copy.winner;
  return player.isCorrect ? copy.lateCorrect : copy.wrong;
}

function livePlayerStatus(playerId: string, state: MultiplayerPublicGameState, copy: ReturnType<typeof getMultiplayerCopy>) {
  if (!state.currentRound) return copy.waiting;
  const answer = state.answers.find(item => item.roundId === state.currentRound?.id && item.playerId === playerId);
  if (answer) return copy.answeredStatus;
  return copy.pending;
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
  const roundWinner = value.match(/^(.+?)\s+won the round$/i);
  if (roundWinner) return (copy.roundWinner || '{name} won the round').replace('{name}', roundWinner[1]);
  if (/player joined/i.test(value)) return copy.ready;
  if (/game is live/i.test(value)) return copy.inProgress;
  if (/winner/i.test(value)) return copy.results;
  if (/game finished/i.test(value)) return copy.finished;
  if (/question is live/i.test(value)) return copy.questionLive;
  return value;
}

/** Error codes that mean the tracked lobby/game is gone and the stored session
 *  must be abandoned. Kept as a stable list so native clients share the rule. */
function isSessionGoneCode(code: unknown): boolean {
  return code === 'lobby_not_found' || code === 'game_not_found';
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
    [/too many multiplayer requests/i, 'rate_limited'],
    [/lifeline is invalid/i, 'lifeline_invalid'],
    [/lifeline is unavailable/i, 'lifeline_unavailable'],
    [/no lifelines/i, 'lifeline_unavailable'],
    [/already used/i, 'lifeline_already_used'],
    [/not enough fictional winnings/i, 'insufficient_winnings']
  ];
  const match = known.find(([pattern]) => pattern.test(value));
  return match ? copy[match[1]] || copy.error : copy.error;
}

/** AbortSignal.timeout is Safari 15.4+; older browsers just skip the timeout
 *  instead of crashing the whole multiplayer hub. */
function fetchTimeout(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : undefined;
}

/** crypto.randomUUID is Safari 15.4+/secure-context-only; fall back to a
 *  collision-resistant-enough id for anonymous identity + idempotency keys. */
function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}
