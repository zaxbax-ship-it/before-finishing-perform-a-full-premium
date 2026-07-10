'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CommunitySubmission } from '@/lib/community';

type AuditRow = { id: string; actorLabel?: string; actor?: string; action: string; targetId?: string; createdAt: string };
type StatusFilter = 'needs_review' | 'approved' | 'rejected' | 'all';

type EditState = {
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
  difficulty: string;
  explanation: string;
};

const DIFFICULTIES = ['קל', 'בינוני', 'קשה', 'מומחה'];

/**
 * Stage 11 — premium editorial review. Each pending submission shows the full
 * pipeline output: the original submission, the AI-improved question + answer,
 * the three generated wrong answers, difficulty, category, duplicate + confidence
 * scores and the AI recommendation. The admin can edit ANY field before
 * publishing. Nothing is ever published without an explicit admin approval.
 */
export function ModerationClient() {
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('needs_review');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, EditState>>({});

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

  useEffect(() => { void refresh(); }, []);

  function beginEdit(item: CommunitySubmission) {
    setEditing(prev => ({
      ...prev,
      [item.id]: {
        question: item.draft.question,
        options: [...item.draft.options],
        correctIndex: item.draft.correctIndex,
        category: item.draft.category,
        difficulty: item.draft.difficulty,
        explanation: item.draft.explanation
      }
    }));
  }

  function cancelEdit(id: string) {
    setEditing(prev => { const next = { ...prev }; delete next[id]; return next; });
  }

  async function review(id: string, action: 'approve' | 'reject', edited?: EditState) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/community/submissions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, edited })
      });
      const data = await response.json();
      if (response.ok && data?.ok && data.submission) {
        setSubmissions(previous => previous.map(item => (item.id === id ? data.submission : item)));
        cancelEdit(id);
        void refresh();
      } else {
        setMessage(data?.error || 'הפעולה נכשלה.');
      }
    } catch {
      setMessage('הפעולה נכשלה.');
    } finally {
      setBusyId(null);
    }
  }

  const visible = useMemo(
    () => submissions.filter(item => statusFilter === 'all' || item.moderation.status === statusFilter),
    [submissions, statusFilter]
  );

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h1>מודרציית קהילה</h1>
        <div className="admin-status-row" role="group" aria-label="סינון לפי סטטוס">
          {([['needs_review', 'ממתינות לעריכה'], ['approved', 'פורסמו'], ['rejected', 'נדחו'], ['all', 'הכול']] as const).map(([key, label]) => (
            <button key={key} className={`admin-filter-chip focus-ring ${statusFilter === key ? 'is-active' : ''}`} onClick={() => setStatusFilter(key)}>{label}</button>
          ))}
        </div>
      </header>

      {message && <div className="form-error" role="alert">{message}</div>}

      {visible.length === 0 ? (
        <div className="admin-empty glass">אין הגשות בסטטוס הזה.</div>
      ) : (
        <div className="mod-review-list">
          {visible.map(item => {
            const edit = editing[item.id];
            const correctAnswer = item.draft.options[item.draft.correctIndex] || '';
            const wrongAnswers = item.draft.options.filter((_, index) => index !== item.draft.correctIndex);
            const m = item.moderation;
            const confidence = m.aiConfidence ?? m.score;
            const duplicate = m.qualitySignals?.duplicateRisk ?? 0;
            const pending = m.status === 'needs_review';

            return (
              <article className="mod-card glass" key={item.id}>
                <div className="mod-card-head">
                  <span className="mod-badge">{item.draft.category || '—'}</span>
                  <span className="mod-badge">{item.draft.difficulty || '—'}</span>
                  <span className={`mod-badge ${duplicate >= 55 ? 'is-warn' : ''}`}>כפילות: {duplicate}</span>
                  <span className={`mod-badge ${confidence >= 75 ? 'is-good' : confidence >= 55 ? '' : 'is-warn'}`}>ביטחון: {confidence}</span>
                  <span className="mod-badge">המלצת AI: {recommendationLabel(m.aiRecommendation || m.recommendation)}</span>
                  <span className="mod-status">{pending ? 'ממתין לעריכה' : m.status === 'rejected' ? 'נדחה' : 'פורסם'}</span>
                </div>

                {m.original && (
                  <div className="mod-block">
                    <small className="mod-label">הגשה מקורית</small>
                    <p className="mod-original">{m.original.question}</p>
                    <p className="mod-original-answer">תשובה: {m.original.correctAnswer}</p>
                  </div>
                )}

                {!edit ? (
                  <>
                    <div className="mod-block">
                      <small className="mod-label">גרסת AI מוכנה למשחק</small>
                      <p className="mod-question">{item.draft.question}</p>
                    </div>
                    <div className="mod-answers">
                      <div className="mod-answer is-correct"><span>✓</span> {correctAnswer}</div>
                      {wrongAnswers.map((wrong, index) => <div className="mod-answer" key={index}>{wrong}</div>)}
                    </div>
                    {item.draft.explanation && <p className="mod-explanation">{item.draft.explanation}</p>}
                    {m.reasons?.length > 0 && <p className="mod-reasons">הערות: {m.reasons.join(' · ')}</p>}
                  </>
                ) : (
                  <div className="mod-edit">
                    <label className="mod-field"><span>שאלה</span>
                      <textarea className="form-input" value={edit.question} onChange={e => setEditing(p => ({ ...p, [item.id]: { ...edit, question: e.target.value } }))} />
                    </label>
                    {edit.options.map((option, index) => (
                      <label className="mod-field mod-field-option" key={index}>
                        <input type="radio" name={`correct-${item.id}`} checked={edit.correctIndex === index} onChange={() => setEditing(p => ({ ...p, [item.id]: { ...edit, correctIndex: index } }))} aria-label={`סמן כתשובה נכונה ${index + 1}`} />
                        <input className="form-input" value={option} onChange={e => setEditing(p => ({ ...p, [item.id]: { ...edit, options: edit.options.map((o, i) => i === index ? e.target.value : o) } }))} />
                      </label>
                    ))}
                    <div className="mod-edit-row">
                      <label className="mod-field"><span>קטגוריה</span>
                        <input className="form-input" value={edit.category} onChange={e => setEditing(p => ({ ...p, [item.id]: { ...edit, category: e.target.value } }))} />
                      </label>
                      <label className="mod-field"><span>רמת קושי</span>
                        <select className="form-input" value={edit.difficulty} onChange={e => setEditing(p => ({ ...p, [item.id]: { ...edit, difficulty: e.target.value } }))}>
                          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </label>
                    </div>
                    <label className="mod-field"><span>הסבר</span>
                      <textarea className="form-input" value={edit.explanation} onChange={e => setEditing(p => ({ ...p, [item.id]: { ...edit, explanation: e.target.value } }))} />
                    </label>
                  </div>
                )}

                {pending && (
                  <div className="mod-actions">
                    {!edit ? (
                      <>
                        <button className="premium-button focus-ring" disabled={busyId === item.id} onClick={() => review(item.id, 'approve')}>אישור ופרסום</button>
                        <button className="ghost-button focus-ring" disabled={busyId === item.id} onClick={() => beginEdit(item)}>עריכה</button>
                        <button className="ghost-button focus-ring" disabled={busyId === item.id} onClick={() => review(item.id, 'reject')}>דחייה</button>
                      </>
                    ) : (
                      <>
                        <button className="premium-button focus-ring" disabled={busyId === item.id} onClick={() => review(item.id, 'approve', edit)}>שמירה ופרסום</button>
                        <button className="ghost-button focus-ring" disabled={busyId === item.id} onClick={() => cancelEdit(item.id)}>ביטול</button>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <h2 className="admin-subheading">יומן פעולות אחרון</h2>
      <ul className="admin-audit-mini">
        {auditLogs.slice(0, 12).map(log => (
          <li key={log.id}>
            <span>{log.action}</span>
            <small>{(log.actorLabel || log.actor) ?? ''} · {new Date(log.createdAt).toLocaleString('he-IL')}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

function recommendationLabel(recommendation?: string) {
  if (recommendation === 'approve') return 'לאשר';
  if (recommendation === 'reject') return 'לדחות';
  return 'בדיקה ידנית';
}
