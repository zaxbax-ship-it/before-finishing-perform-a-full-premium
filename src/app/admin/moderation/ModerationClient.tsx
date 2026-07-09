'use client';

import { useEffect, useState } from 'react';
import type { CommunitySubmission } from '@/lib/community';

type AuditRow = { id: string; actorLabel: string; action: string; targetId?: string; createdAt: string };

/**
 * Community moderation queue — the console version of the existing admin
 * capability. Reads and writes through the same guarded endpoints
 * (/api/community/submissions*); no gameplay or contract changes.
 */
export function ModerationClient() {
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<'needs_review' | 'approved' | 'auto_approved' | 'rejected' | 'all'>('needs_review');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      const response = await fetch('/api/community/submissions', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.ok) {
        setSubmissions(data.submissions || []);
        setAuditLogs(data.auditLogs || []);
        setMessage('');
        return;
      }
      setMessage(data?.error || 'טעינת התור נכשלה.');
    } catch {
      setMessage('טעינת התור נכשלה.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function review(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
    try {
      const response = await fetch(`/api/community/submissions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await response.json();
      if (response.ok && data?.ok && data.submission) {
        setSubmissions(previous => previous.map(item => (item.id === id ? data.submission : item)));
      } else {
        setMessage(data?.error || 'הפעולה נכשלה.');
      }
    } catch {
      setMessage('הפעולה נכשלה.');
    } finally {
      setBusyId(null);
    }
  }

  const visible = submissions.filter(item => statusFilter === 'all' || item.moderation.status === statusFilter);

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h1>מודרציית קהילה</h1>
        <div className="admin-status-row" role="group" aria-label="סינון לפי סטטוס">
          {([['needs_review', 'ממתינות'], ['approved', 'אושרו'], ['auto_approved', 'אושרו אוטומטית'], ['rejected', 'נדחו'], ['all', 'הכול']] as const).map(([key, label]) => (
            <button key={key} className={`admin-filter-chip focus-ring ${statusFilter === key ? 'is-active' : ''}`} onClick={() => setStatusFilter(key)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {message && <div className="form-error" role="alert">{message}</div>}

      {visible.length === 0 ? (
        <div className="admin-empty glass">אין הגשות בסטטוס הזה.</div>
      ) : (
        <ul className="admin-list">
          {visible.map(item => (
            <li className="admin-list-row glass" key={item.id}>
              <div className="admin-list-main">
                <strong>{item.question?.question || item.draft.question}</strong>
                <small>
                  {item.draft.category} · {item.draft.difficulty} · הוגש {new Date(item.createdAt).toLocaleDateString('he-IL')} ·{' '}
                  סטטוס: {item.moderation.status === 'needs_review' ? 'ממתין לבדיקה' : item.moderation.status === 'rejected' ? 'נדחה' : item.moderation.status === 'auto_approved' ? 'אושר אוטומטית' : 'אושר'}
                </small>
              </div>
              {item.moderation.status === 'needs_review' && (
                <div className="admin-list-actions">
                  <button className="premium-button focus-ring" disabled={busyId === item.id} onClick={() => review(item.id, 'approve')}>אישור</button>
                  <button className="ghost-button focus-ring" disabled={busyId === item.id} onClick={() => review(item.id, 'reject')}>דחייה</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2 className="admin-subheading">יומן פעולות אחרון</h2>
      <ul className="admin-audit-mini">
        {auditLogs.slice(0, 12).map(log => (
          <li key={log.id}>
            <span>{log.action}</span>
            <small>{log.actorLabel} · {new Date(log.createdAt).toLocaleString('he-IL')}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
