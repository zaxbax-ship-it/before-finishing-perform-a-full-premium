'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CmsQuestionRow, QuestionStatus } from '@/lib/admin/questionCmsService';

type Editor = {
  id?: string;
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
  difficulty: string;
  explanation: string;
  status: QuestionStatus;
};

type Usage = { featuredInRecentGames: number; answers: number; correct: number; successRate: number | null; note: string };

const EMPTY_EDITOR: Editor = { question: '', options: ['', '', '', ''], correctIndex: 0, category: '', difficulty: 'בינוני', explanation: '', status: 'draft' };
const STATUS_LABEL: Record<QuestionStatus, string> = { draft: 'טיוטה', published: 'מפורסמת', archived: 'בארכיון' };
const ALL_LOCALES = ['he', 'en', 'ar', 'ru', 'am'];

/**
 * Question CMS console: server-persisted CRUD with draft/publish/archive,
 * duplicate, bulk actions, search/filters/pagination, translation coverage
 * and usage analytics from real multiplayer data.
 */
export function QuestionsClient() {
  const [rows, setRows] = useState<CmsQuestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [categories, setCategories] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [status, setStatus] = useState<'all' | QuestionStatus>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<Editor | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ search, status, page: String(page), pageSize: String(pageSize) });
    if (category) params.set('category', category);
    if (difficulty) params.set('difficulty', difficulty);
    try {
      const response = await fetch(`/api/admin/questions?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.ok) {
        setRows(data.rows);
        setTotal(data.total);
        setCategories(data.categories);
        setDifficulties(data.difficulties);
        setSelected(new Set());
        setMessage('');
        return;
      }
      setMessage(data?.error || 'טעינת השאלות נכשלה.');
    } catch {
      setMessage('טעינת השאלות נכשלה.');
    }
  }, [search, status, category, difficulty, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        setMessage(data?.error || 'הפעולה נכשלה.');
        return false;
      }
      setMessage('');
      return true;
    } catch {
      setMessage('הפעולה נכשלה.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function openEditor(id?: string) {
    setUsage(null);
    if (!id) {
      setEditor({ ...EMPTY_EDITOR, category: categories[0] || '' });
      return;
    }
    try {
      const response = await fetch(`/api/admin/questions?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.ok) {
        const question = data.question;
        setEditor({
          id: String(question.id),
          question: question.question,
          options: [...question.options],
          correctIndex: question.correctIndex,
          category: question.category,
          difficulty: question.difficulty,
          explanation: question.explanation || '',
          status: question.status || (question.isActive ? 'published' : 'archived')
        });
        setUsage(data.usage);
      } else {
        setMessage(data?.error || 'טעינת השאלה נכשלה.');
      }
    } catch {
      setMessage('טעינת השאלה נכשלה.');
    }
  }

  async function saveEditor() {
    if (!editor) return;
    const draft = {
      question: editor.question,
      options: editor.options,
      correctIndex: editor.correctIndex,
      category: editor.category,
      difficulty: editor.difficulty,
      explanation: editor.explanation,
      status: editor.status
    };
    const ok = editor.id
      ? await post({ action: 'update', id: editor.id, draft }) && (editor.status ? await post({ action: 'set_status', id: editor.id, status: editor.status }) : true)
      : await post({ action: 'create', draft });
    if (ok) {
      setEditor(null);
      await load();
    }
  }

  async function bulk(newStatus: QuestionStatus) {
    if (selected.size === 0) return;
    if (await post({ action: 'bulk', ids: [...selected], status: newStatus })) await load();
  }

  function toggle(id: string) {
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h1>ניהול שאלות</h1>
        <div className="admin-status-row">
          <span className="admin-status-pill">סה״כ: {total.toLocaleString('en-US')}</span>
          <button className="premium-button admin-row-button focus-ring" onClick={() => openEditor()}>שאלה חדשה</button>
        </div>
      </header>

      <div className="admin-toolbar">
        <input className="form-input admin-search" placeholder="חיפוש בטקסט השאלה או במזהה..." value={search}
          onChange={event => { setSearch(event.target.value); setPage(1); }} aria-label="חיפוש שאלות" />
        <select className="form-input" value={category} onChange={event => { setCategory(event.target.value); setPage(1); }} aria-label="קטגוריה">
          <option value="">כל הקטגוריות</option>
          {categories.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="form-input" value={difficulty} onChange={event => { setDifficulty(event.target.value); setPage(1); }} aria-label="קושי">
          <option value="">כל הרמות</option>
          {difficulties.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="form-input" value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(1); }} aria-label="סטטוס">
          <option value="all">כל הסטטוסים</option>
          <option value="published">מפורסמות</option>
          <option value="draft">טיוטות</option>
          <option value="archived">בארכיון</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="admin-bulkbar glass">
          <span>{selected.size} נבחרו</span>
          <button className="ghost-button admin-row-button focus-ring" disabled={busy} onClick={() => bulk('published')}>פרסום</button>
          <button className="ghost-button admin-row-button focus-ring" disabled={busy} onClick={() => bulk('draft')}>העברה לטיוטה</button>
          <button className="ghost-button admin-row-button focus-ring" disabled={busy} onClick={() => bulk('archived')}>ארכיון</button>
        </div>
      )}

      {message && <div className="form-error" role="alert">{message}</div>}

      <div className="admin-table-wrap glass">
        <table className="admin-table">
          <thead>
            <tr><th></th><th>שאלה</th><th>קטגוריה</th><th>קושי</th><th>סטטוס</th><th>תרגומים</th><th>עודכן</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`בחירת ${row.id}`} /></td>
                <td className="admin-cell-clip"><strong>{row.question}</strong></td>
                <td>{row.category}</td>
                <td>{row.difficulty}</td>
                <td>
                  <span className={`admin-tag ${row.status === 'published' ? 'is-ok' : row.status === 'draft' ? 'is-warn' : 'is-danger'}`}>
                    {STATUS_LABEL[row.status]}
                  </span>
                </td>
                <td>
                  <span className="admin-locale-row" dir="ltr">
                    {ALL_LOCALES.map(locale => (
                      <span key={locale} className={`admin-locale ${row.translations.includes(locale) ? 'is-on' : ''}`}>{locale}</span>
                    ))}
                  </span>
                </td>
                <td>{new Date(row.updatedAt).toLocaleDateString('he-IL')}</td>
                <td className="admin-row-actions">
                  <button className="ghost-button admin-row-button focus-ring" onClick={() => openEditor(row.id)}>עריכה</button>
                  <button className="ghost-button admin-row-button focus-ring" disabled={busy}
                    onClick={async () => { if (await post({ action: 'duplicate', id: row.id })) await load(); }}>שכפול</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="admin-muted">אין שאלות תואמות.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination">
        <button className="ghost-button admin-row-button focus-ring" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>הקודם</button>
        <span>עמוד {page} מתוך {pages}</span>
        <button className="ghost-button admin-row-button focus-ring" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>הבא</button>
      </div>

      {editor && (
        <div className="admin-drawer-backdrop" role="dialog" aria-modal="true" aria-label="עריכת שאלה" onClick={() => setEditor(null)}>
          <aside className="admin-drawer glass" onClick={event => event.stopPropagation()}>
            <header className="admin-drawer-header">
              <h2>{editor.id ? 'עריכת שאלה' : 'שאלה חדשה'}</h2>
              <button className="ghost-button admin-row-button focus-ring" onClick={() => setEditor(null)}>סגירה</button>
            </header>

            <label className="admin-field"><span>שאלה</span>
              <textarea className="form-input" value={editor.question} onChange={event => setEditor({ ...editor, question: event.target.value })} rows={3} />
            </label>
            {editor.options.map((option, index) => (
              <label className="admin-field admin-option-field" key={index}>
                <span>
                  <input type="radio" name="correct" checked={editor.correctIndex === index} onChange={() => setEditor({ ...editor, correctIndex: index })} aria-label={`תשובה נכונה ${index + 1}`} />
                  תשובה {index + 1}
                </span>
                <input className="form-input" value={option} onChange={event => setEditor({ ...editor, options: editor.options.map((existing, i) => i === index ? event.target.value : existing) })} />
              </label>
            ))}
            <div className="admin-field-row">
              <label className="admin-field"><span>קטגוריה</span>
                <input className="form-input" value={editor.category} list="cms-categories" onChange={event => setEditor({ ...editor, category: event.target.value })} />
                <datalist id="cms-categories">{categories.map(name => <option key={name} value={name} />)}</datalist>
              </label>
              <label className="admin-field"><span>קושי</span>
                <input className="form-input" value={editor.difficulty} list="cms-difficulties" onChange={event => setEditor({ ...editor, difficulty: event.target.value })} />
                <datalist id="cms-difficulties">{difficulties.map(name => <option key={name} value={name} />)}</datalist>
              </label>
              <label className="admin-field"><span>סטטוס</span>
                <select className="form-input" value={editor.status} onChange={event => setEditor({ ...editor, status: event.target.value as QuestionStatus })}>
                  <option value="draft">טיוטה</option>
                  <option value="published">מפורסמת</option>
                  <option value="archived">בארכיון</option>
                </select>
              </label>
            </div>
            <label className="admin-field"><span>הסבר (אופציונלי)</span>
              <textarea className="form-input" value={editor.explanation} onChange={event => setEditor({ ...editor, explanation: event.target.value })} rows={2} />
            </label>

            {usage && (
              <div className="admin-usage glass">
                <h3>סטטיסטיקות שימוש</h3>
                <div className="admin-detail-grid">
                  <div><small>הופעות במשחקים</small><strong>{usage.featuredInRecentGames}</strong></div>
                  <div><small>תשובות</small><strong>{usage.answers}</strong></div>
                  <div><small>אחוז הצלחה</small><strong>{usage.successRate != null ? `${usage.successRate}%` : '—'}</strong></div>
                </div>
                <p className="admin-muted">{usage.note}</p>
              </div>
            )}

            <div className="admin-actions-grid">
              <button className="premium-button focus-ring" disabled={busy} onClick={saveEditor}>שמירה</button>
              {editor.id && editor.status !== 'archived' && (
                <button className="ghost-button focus-ring" disabled={busy}
                  onClick={async () => { if (await post({ action: 'set_status', id: editor.id, status: 'archived' })) { setEditor(null); await load(); } }}>העברה לארכיון</button>
              )}
            </div>
            <p className="admin-muted">ניהול תמונות אינו זמין — מודל השאלה אינו כולל שדה מדיה.</p>
          </aside>
        </div>
      )}
    </section>
  );
}
