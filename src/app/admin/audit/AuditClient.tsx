'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type AuditRow = { id: string; actor: string; action: string; target: string; details: string; createdAt: string };

/**
 * Audit center — searchable, filterable view over the platform audit log.
 * Categories are derived from the real action names written by each area of
 * the system. Authentication events are not audited yet (stated below).
 */
const CATEGORIES: Array<{ key: string; label: string; test: (action: string) => boolean }> = [
  { key: 'all', label: 'הכול', test: () => true },
  { key: 'players', label: 'מודרציית שחקנים', test: action => action.startsWith('admin_player_') },
  { key: 'questions', label: 'עריכת שאלות', test: action => action.startsWith('admin_question_') },
  { key: 'moderation', label: 'מודרציית קהילה', test: action => action.includes('submission') },
  { key: 'multiplayer', label: 'מרובה משתתפים', test: action => action.startsWith('admin_multiplayer_') },
  { key: 'tickets', label: 'פניות', test: action => action.startsWith('admin_ticket_') || action.startsWith('contact_') },
  { key: 'payments', label: 'תשלומים', test: action => action.includes('payment') || action.includes('subscription') || action.includes('entitlement') }
];

const PAGE_SIZE = 30;

export function AuditClient() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/audit', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.ok) {
        setRows(data.entries);
        setMessage('');
        return;
      }
      setMessage(data?.error || 'טעינת יומן הביקורת נכשלה.');
    } catch {
      setMessage('טעינת יומן הביקורת נכשלה.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const test = CATEGORIES.find(item => item.key === category)?.test || (() => true);
    const term = search.trim().toLowerCase();
    return rows.filter(row =>
      test(row.action) &&
      (!term || row.action.toLowerCase().includes(term) || row.actor.toLowerCase().includes(term) || row.target.toLowerCase().includes(term) || row.details.toLowerCase().includes(term))
    );
  }, [rows, category, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    const header = ['createdAt', 'actor', 'action', 'target', 'details'];
    const lines = [header.join(',')].concat(filtered.map(row =>
      [row.createdAt, quote(row.actor), row.action, quote(row.target), quote(row.details)].join(',')
    ));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'audit-log.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h1>יומן ביקורת</h1>
        <div className="admin-status-row">
          <span className="admin-status-pill">{filtered.length.toLocaleString('en-US')} רשומות</span>
          <button className="ghost-button admin-row-button focus-ring" onClick={exportCsv} disabled={filtered.length === 0}>ייצוא CSV</button>
        </div>
      </header>

      <div className="admin-status-row" role="group" aria-label="סינון לפי קטגוריה">
        {CATEGORIES.map(item => (
          <button key={item.key} className={`admin-filter-chip focus-ring ${category === item.key ? 'is-active' : ''}`}
            onClick={() => { setCategory(item.key); setPage(1); }}>{item.label}</button>
        ))}
      </div>

      <input className="form-input admin-search" placeholder="חיפוש לפי פעולה, מבצע, יעד או פרטים..." value={search}
        onChange={event => { setSearch(event.target.value); setPage(1); }} aria-label="חיפוש ביומן" />

      {message && <div className="form-error" role="alert">{message}</div>}

      {visible.length === 0 ? (
        <div className="admin-empty glass">אין רשומות תואמות.</div>
      ) : (
        <div className="admin-table-wrap glass">
          <table className="admin-table">
            <thead><tr><th>זמן</th><th>מבצע</th><th>פעולה</th><th>יעד</th><th>פרטים</th></tr></thead>
            <tbody>
              {visible.map(row => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString('he-IL')}</td>
                  <td dir="ltr">{row.actor}</td>
                  <td dir="ltr"><strong>{row.action}</strong></td>
                  <td dir="ltr" className="admin-cell-clip"><span className="admin-muted">{row.target}</span></td>
                  <td className="admin-cell-clip"><span className="admin-muted">{row.details}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-pagination">
        <button className="ghost-button admin-row-button focus-ring" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>הקודם</button>
        <span>עמוד {page} מתוך {pages}</span>
        <button className="ghost-button admin-row-button focus-ring" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>הבא</button>
      </div>

      <p className="admin-muted">הערה: אירועי התחברות/הרשמה מנוהלים על ידי Supabase Auth ואינם נכתבים ליומן הזה עדיין.</p>
    </section>
  );
}

function quote(value: string): string {
  return `"${(value || '').replace(/"/g, '""')}"`;
}
