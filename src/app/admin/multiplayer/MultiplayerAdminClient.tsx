'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MultiplayerAdminOverview } from '@/lib/admin/multiplayerAdminService';

const STATUS_HE: Record<string, string> = {
  waiting: 'ממתין',
  ready: 'מוכן',
  starting: 'מתחיל',
  in_progress: 'פעיל',
  finished: 'הסתיים',
  cancelled: 'בוטל',
  expired: 'פג תוקף'
};

/**
 * Live multiplayer operations console: queue metrics, lobbies with seated
 * players, running games with terminate actions, and replay metadata for
 * recently finished games. Auto-refreshes every 5 seconds.
 */
export function MultiplayerAdminClient() {
  const [overview, setOverview] = useState<MultiplayerAdminOverview | null>(null);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/multiplayer', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.ok) {
        setOverview(data);
        return;
      }
      setMessage(data?.error || 'טעינת הנתונים נכשלה.');
    } catch {
      setMessage('טעינת הנתונים נכשלה.');
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function terminate(action: 'terminate_lobby' | 'terminate_game', id: string) {
    if (!window.confirm(action === 'terminate_lobby' ? 'לסגור את החדר לכל השחקנים?' : 'לעצור את המשחק לכל השחקנים?')) return;
    setBusyId(id);
    try {
      const response = await fetch('/api/admin/multiplayer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) setMessage(data?.error || 'הפעולה נכשלה.');
      else {
        setMessage('');
        await load();
      }
    } catch {
      setMessage('הפעולה נכשלה.');
    } finally {
      setBusyId(null);
    }
  }

  if (!overview) {
    return <section className="admin-page"><div className="admin-empty glass">טוען נתוני מרובה משתתפים...</div></section>;
  }

  const queueCards: Array<{ label: string; value: string }> = [
    { label: 'חדרים פתוחים', value: String(overview.queue.openLobbies) },
    { label: 'משחקים חיים', value: String(overview.queue.liveGames) },
    { label: 'שחקנים מחוברים', value: String(overview.queue.connectedPlayers) },
    { label: 'משחקים ב־24 שעות', value: String(overview.queue.gamesLast24h) },
    { label: 'הסתיימו ב־24 שעות', value: String(overview.queue.finishedLast24h) },
    { label: 'תפוסת חדרים ממוצעת', value: overview.queue.averageFillRatio != null ? `${overview.queue.averageFillRatio}%` : '—' }
  ];

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h1>מרובה משתתפים</h1>
        <span className="admin-status-pill">עודכן: {new Date(overview.generatedAt).toLocaleTimeString('he-IL')}</span>
      </header>

      {message && <div className="form-error" role="alert">{message}</div>}

      <div className="admin-cards">
        {queueCards.map(card => (
          <div className="admin-card glass" key={card.label}>
            <small>{card.label}</small>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <h2 className="admin-subheading">חדרים</h2>
      {overview.lobbies.length === 0 ? (
        <div className="admin-empty glass">אין חדרים פעילים כרגע.</div>
      ) : (
        <div className="admin-table-wrap glass">
          <table className="admin-table">
            <thead>
              <tr><th>חדר</th><th>סטטוס</th><th>שפה</th><th>שחקנים</th><th>מחוברים</th><th>נפתח</th><th></th></tr>
            </thead>
            <tbody>
              {overview.lobbies.map(lobby => (
                <tr key={lobby.id}>
                  <td>
                    <strong>{lobby.id.slice(-8)}</strong>
                    <small className="admin-muted"> · {lobby.players.map(player => player.nickname).join(', ') || 'ריק'}</small>
                  </td>
                  <td><span className={`admin-tag ${lobby.status === 'in_progress' ? 'is-ok' : lobby.status === 'waiting' || lobby.status === 'ready' ? 'is-warn' : ''}`}>{STATUS_HE[lobby.status] || lobby.status}</span></td>
                  <td dir="ltr">{lobby.locale}</td>
                  <td>{lobby.playerCount}/{lobby.maxPlayers}</td>
                  <td>{lobby.connectedCount}</td>
                  <td>{new Date(lobby.createdAt).toLocaleTimeString('he-IL')}</td>
                  <td>
                    <button className="ghost-button admin-row-button focus-ring" disabled={busyId === lobby.id}
                      onClick={() => terminate('terminate_lobby', lobby.id)}>סגירת חדר</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="admin-subheading">משחקים חיים</h2>
      {overview.liveGames.length === 0 ? (
        <div className="admin-empty glass">אין משחקים פעילים כרגע.</div>
      ) : (
        <div className="admin-table-wrap glass">
          <table className="admin-table">
            <thead>
              <tr><th>משחק</th><th>סטטוס</th><th>סיבוב</th><th>התחיל</th><th></th></tr>
            </thead>
            <tbody>
              {overview.liveGames.map(game => (
                <tr key={game.id}>
                  <td><strong>{game.id.slice(-8)}</strong></td>
                  <td><span className="admin-tag is-ok">{STATUS_HE[game.status] || game.status}</span></td>
                  <td>{game.currentRoundIndex + 1}/{game.totalRounds}</td>
                  <td>{game.startedAt ? new Date(game.startedAt).toLocaleTimeString('he-IL') : '—'}</td>
                  <td>
                    <button className="ghost-button admin-row-button focus-ring" disabled={busyId === game.id}
                      onClick={() => terminate('terminate_game', game.id)}>עצירת משחק</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="admin-subheading">משחקים שהסתיימו (מטא־נתוני שחזור)</h2>
      {overview.recentFinishedGames.length === 0 ? (
        <div className="admin-empty glass">עדיין לא הסתיימו משחקים.</div>
      ) : (
        <ul className="admin-audit-mini">
          {overview.recentFinishedGames.map(game => (
            <li key={game.id}>
              <span>{game.id.slice(-8)} · {game.totalRounds} סיבובים{game.winner ? ` · מנצח: ${game.winner}` : ''}</span>
              <small>{game.finishedAt ? new Date(game.finishedAt).toLocaleString('he-IL') : ''}</small>
            </li>
          ))}
        </ul>
      )}

      <h2 className="admin-subheading">לא נמדד</h2>
      <ul className="admin-unavailable">
        {Object.entries(overview.unavailable).map(([key, reason]) => (
          <li key={key}><strong>{key === 'spectators' ? 'צופים' : 'קובצי שחזור מלאים'}</strong><small>{reason}</small></li>
        ))}
      </ul>
    </section>
  );
}
