'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminPlayerDetail, AdminPlayerRow } from '@/lib/admin/userDirectoryService';

/**
 * Player directory console: search / filter / sort / paginate over every
 * identity the platform knows, a read-only ("impersonation-safe") detail
 * drawer, moderation actions and CSV export. All writes go through
 * /api/admin/users/actions and are audit-logged server-side.
 */
export function UsersClient() {
  const [rows, setRows] = useState<AdminPlayerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'suspended' | 'hidden'>('all');
  const [kind, setKind] = useState<'all' | 'registered' | 'anonymous' | 'leaderboard-only'>('all');
  const [sort, setSort] = useState<'lastActive' | 'xp' | 'bestPrize' | 'created'>('lastActive');
  const [detail, setDetail] = useState<AdminPlayerDetail | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ search, status, kind, sort, page: String(page), pageSize: String(pageSize) });
    try {
      const response = await fetch(`/api/admin/users?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.ok) {
        setRows(data.rows);
        setTotal(data.total);
        setMessage('');
        return;
      }
      setMessage(data?.error || 'טעינת המשתמשים נכשלה.');
    } catch {
      setMessage('טעינת המשתמשים נכשלה.');
    }
  }, [search, status, kind, sort, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    try {
      const response = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.ok) setDetail(data.player);
      else setMessage(data?.error || 'טעינת הפרופיל נכשלה.');
    } catch {
      setMessage('טעינת הפרופיל נכשלה.');
    }
  }

  async function act(id: string, action: string) {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/users/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) setMessage(data?.error || 'הפעולה נכשלה.');
      else {
        setMessage('');
        await load();
        if (detail?.id === id) await openDetail(id);
      }
    } catch {
      setMessage('הפעולה נכשלה.');
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const header = ['id', 'kind', 'displayName', 'nickname', 'active', 'premium', 'xp', 'level', 'gamesPlayed', 'bestPrize', 'lastActiveAt'];
    const lines = [header.join(',')].concat(
      rows.map(row => [
        row.id, row.kind, quote(row.displayName), quote(row.nickname || ''), row.isActive, row.premium,
        row.xp ?? '', row.level ?? '', row.gamesPlayed ?? '', row.bestPrize ?? '', row.lastActiveAt ?? ''
      ].join(','))
    );
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `players-page${page}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h1>ניהול משתמשים</h1>
        <div className="admin-status-row">
          <span className="admin-status-pill">סה״כ: {total.toLocaleString('en-US')}</span>
          <button className="ghost-button focus-ring" onClick={exportCsv} disabled={rows.length === 0}>ייצוא CSV</button>
        </div>
      </header>

      <div className="admin-toolbar">
        <input
          className="form-input admin-search"
          placeholder="חיפוש לפי שם, כינוי או מזהה..."
          value={search}
          onChange={event => { setSearch(event.target.value); setPage(1); }}
          aria-label="חיפוש משתמשים"
        />
        <select className="form-input" value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(1); }} aria-label="סינון לפי סטטוס">
          <option value="all">כל הסטטוסים</option>
          <option value="active">פעילים</option>
          <option value="suspended">מושעים</option>
          <option value="hidden">מוסתרים מהלוח</option>
        </select>
        <select className="form-input" value={kind} onChange={event => { setKind(event.target.value as typeof kind); setPage(1); }} aria-label="סינון לפי סוג">
          <option value="all">כל הסוגים</option>
          <option value="registered">רשומים</option>
          <option value="anonymous">אנונימיים</option>
          <option value="leaderboard-only">לוח תוצאות בלבד</option>
        </select>
        <select className="form-input" value={sort} onChange={event => setSort(event.target.value as typeof sort)} aria-label="מיון">
          <option value="lastActive">פעילות אחרונה</option>
          <option value="xp">XP</option>
          <option value="bestPrize">זכייה מובילה</option>
          <option value="created">תאריך הצטרפות</option>
        </select>
      </div>

      {message && <div className="form-error" role="alert">{message}</div>}

      <div className="admin-table-wrap glass">
        <table className="admin-table">
          <thead>
            <tr>
              <th>שחקן</th><th>סוג</th><th>סטטוס</th><th>XP</th><th>רמה</th><th>משחקים</th><th>זכייה מובילה</th><th>פעילות אחרונה</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td>
                  <strong>{row.displayName}</strong>
                  {row.nickname && row.nickname !== row.displayName && <small className="admin-muted"> · {row.nickname}</small>}
                  {row.premium && <span className="admin-tag is-gold">פרימיום</span>}
                </td>
                <td>{row.kind === 'registered' ? 'רשום' : row.kind === 'anonymous' ? 'אנונימי' : 'לוח בלבד'}</td>
                <td>
                  {!row.isActive ? <span className="admin-tag is-danger">מושעה</span>
                    : row.isHiddenOnLeaderboard ? <span className="admin-tag is-warn">מוסתר</span>
                    : <span className="admin-tag is-ok">פעיל</span>}
                </td>
                <td>{row.xp?.toLocaleString('en-US') ?? '—'}</td>
                <td>{row.level ?? '—'}</td>
                <td>{row.gamesPlayed?.toLocaleString('en-US') ?? '—'}</td>
                <td>{row.bestPrize != null ? `$${row.bestPrize.toLocaleString('en-US')}` : '—'}</td>
                <td>{row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleDateString('he-IL') : '—'}</td>
                <td><button className="ghost-button admin-row-button focus-ring" onClick={() => openDetail(row.id)}>פרופיל</button></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="admin-muted">אין תוצאות לחיפוש הזה.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination">
        <button className="ghost-button admin-row-button focus-ring" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>הקודם</button>
        <span>עמוד {page} מתוך {pages}</span>
        <button className="ghost-button admin-row-button focus-ring" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>הבא</button>
      </div>

      {detail && (
        <div className="admin-drawer-backdrop" role="dialog" aria-modal="true" aria-label={`פרופיל ${detail.displayName}`} onClick={() => setDetail(null)}>
          <aside className="admin-drawer glass" onClick={event => event.stopPropagation()}>
            <header className="admin-drawer-header">
              <h2>{detail.displayName}</h2>
              <button className="ghost-button admin-row-button focus-ring" onClick={() => setDetail(null)}>סגירה</button>
            </header>
            <p className="admin-muted">תצוגת קריאה בלבד (בטוחה להתחזות) · {detail.id}</p>

            <div className="admin-detail-grid">
              <div><small>XP</small><strong>{detail.xp?.toLocaleString('en-US') ?? '—'}</strong></div>
              <div><small>רמה</small><strong>{detail.level ?? '—'}</strong></div>
              <div><small>משחקים</small><strong>{detail.gamesPlayed?.toLocaleString('en-US') ?? '—'}</strong></div>
              <div><small>הישגים</small><strong>{detail.achievements ?? 0}</strong></div>
              <div><small>זכייה מובילה</small><strong>{detail.bestPrize != null ? `$${detail.bestPrize.toLocaleString('en-US')}` : '—'}</strong></div>
              <div><small>פרימיום</small><strong>{detail.premium ? 'כן' : 'לא'}</strong></div>
            </div>

            <h3>פעולות</h3>
            <div className="admin-actions-grid">
              {detail.kind === 'registered' && (detail.isActive
                ? <button className="ghost-button focus-ring" disabled={busy} onClick={() => act(detail.id, 'suspend')}>השעיה</button>
                : <button className="premium-button focus-ring" disabled={busy} onClick={() => act(detail.id, 'unsuspend')}>ביטול השעיה</button>)}
              {detail.nickname && (detail.isHiddenOnLeaderboard
                ? <button className="ghost-button focus-ring" disabled={busy} onClick={() => act(detail.id, 'restore_leaderboard')}>החזרה ללוח</button>
                : <button className="ghost-button focus-ring" disabled={busy} onClick={() => act(detail.id, 'hide_leaderboard')}>הסתרה מהלוח</button>)}
              {(detail.xp ?? 0) > 0 && (
                <button className="ghost-button focus-ring" disabled={busy} onClick={() => { if (window.confirm('לאפס את ההתקדמות של השחקן?')) void act(detail.id, 'reset_progression'); }}>איפוס התקדמות</button>
              )}
              {detail.kind !== 'leaderboard-only' && (detail.entitlements.some(ent => ent.type === 'premium' && ent.status === 'active')
                ? <button className="ghost-button focus-ring" disabled={busy} onClick={() => act(detail.id, 'revoke_premium')}>ביטול פרימיום</button>
                : <button className="ghost-button focus-ring" disabled={busy} onClick={() => act(detail.id, 'grant_premium')}>הענקת פרימיום</button>)}
            </div>

            <h3>היסטוריית מרובה משתתפים</h3>
            {detail.multiplayerGames.length === 0
              ? <p className="admin-muted">אין הופעות במרובה משתתפים.</p>
              : <ul className="admin-audit-mini">{detail.multiplayerGames.slice(0, 8).map(game => (
                  <li key={`${game.lobbyId}-${game.joinedAt}`}><span>{game.nickname}</span><small>{new Date(game.joinedAt).toLocaleString('he-IL')}</small></li>
                ))}</ul>}

            <h3>תשלומים</h3>
            {detail.payments.length === 0
              ? <p className="admin-muted">אין עסקאות.</p>
              : <ul className="admin-audit-mini">{detail.payments.slice(0, 8).map(payment => (
                  <li key={payment.id}><span>{payment.status} · {payment.currency} {payment.amount}</span><small>{new Date(payment.createdAt).toLocaleDateString('he-IL')}</small></li>
                ))}</ul>}

            <h3>נתונים שאינם נאספים</h3>
            <ul className="admin-unavailable">
              {Object.entries(detail.unavailable).map(([key, reason]) => (
                <li key={key}><strong>{key === 'email' ? 'אימייל' : key === 'sessions' ? 'סשנים' : 'היסטוריית פניות'}</strong><small>{reason}</small></li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </section>
  );
}

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
