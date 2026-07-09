'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ContactTicket } from '@/lib/domain/models';

const STATUS_HE: Record<string, string> = { open: 'פתוחה', pending: 'בהמתנה', closed: 'סגורה' };
const PRIORITY_HE: Record<string, string> = { low: 'נמוכה', normal: 'רגילה', high: 'גבוהה', urgent: 'דחופה' };

/**
 * Contact center — professional inbox over contact-form tickets: status
 * lanes, priority, assignment, internal notes, search and CSV export. All
 * changes are audit-logged server-side.
 */
export function ContactCenterClient() {
  const [tickets, setTickets] = useState<ContactTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | ContactTicket['status']>('open');
  const [priorityFilter, setPriorityFilter] = useState<'all' | ContactTicket['priority']>('all');
  const [search, setSearch] = useState('');
  const [openTicket, setOpenTicket] = useState<ContactTicket | null>(null);
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (search.trim()) params.set('search', search.trim());
    try {
      const response = await fetch(`/api/admin/contact?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.ok) {
        setTickets(data.tickets);
        setMessage('');
        return;
      }
      setMessage(data?.error || 'טעינת הפניות נכשלה.');
    } catch {
      setMessage('טעינת הפניות נכשלה.');
    }
  }, [statusFilter, priorityFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: string, value: string) {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id, value })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        setMessage(data?.error || 'הפעולה נכשלה.');
        return;
      }
      setMessage('');
      if (openTicket?.id === id) setOpenTicket(data.ticket);
      await load();
    } catch {
      setMessage('הפעולה נכשלה.');
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const header = ['id', 'status', 'priority', 'assignee', 'requesterName', 'requesterEmail', 'subject', 'createdAt'];
    const lines = [header.join(',')].concat(tickets.map(ticket => [
      ticket.id, ticket.status, ticket.priority, quote(ticket.assigneeEmail || ''), quote(ticket.requesterName),
      quote(ticket.requesterEmail), quote(ticket.subject), ticket.createdAt
    ].join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'contact-tickets.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const counts = {
    open: tickets.filter(ticket => ticket.status === 'open').length,
    pending: tickets.filter(ticket => ticket.status === 'pending').length,
    closed: tickets.filter(ticket => ticket.status === 'closed').length
  };

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h1>מרכז פניות</h1>
        <div className="admin-status-row">
          <span className="admin-status-pill">פתוחות: {counts.open}</span>
          <span className="admin-status-pill">בהמתנה: {counts.pending}</span>
          <span className="admin-status-pill">סגורות: {counts.closed}</span>
          <button className="ghost-button admin-row-button focus-ring" onClick={exportCsv} disabled={tickets.length === 0}>ייצוא CSV</button>
        </div>
      </header>

      <div className="admin-toolbar">
        <input className="form-input admin-search" placeholder="חיפוש בנושא, בתוכן או בפרטי הפונה..." value={search}
          onChange={event => setSearch(event.target.value)} aria-label="חיפוש פניות" />
        <select className="form-input" value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="סטטוס">
          <option value="all">כל הסטטוסים</option>
          <option value="open">פתוחות</option>
          <option value="pending">בהמתנה</option>
          <option value="closed">סגורות</option>
        </select>
        <select className="form-input" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as typeof priorityFilter)} aria-label="עדיפות">
          <option value="all">כל העדיפויות</option>
          <option value="urgent">דחופה</option>
          <option value="high">גבוהה</option>
          <option value="normal">רגילה</option>
          <option value="low">נמוכה</option>
        </select>
      </div>

      {message && <div className="form-error" role="alert">{message}</div>}

      {tickets.length === 0 ? (
        <div className="admin-empty glass">אין פניות בסינון הזה.</div>
      ) : (
        <ul className="admin-list">
          {tickets.map(ticket => (
            <li className="admin-list-row glass" key={ticket.id}>
              <div className="admin-list-main">
                <strong>{ticket.subject}</strong>
                <small>
                  {ticket.requesterName} · {ticket.requesterEmail} · {new Date(ticket.createdAt).toLocaleString('he-IL')}
                  {ticket.assigneeEmail ? ` · מטופל ע"י ${ticket.assigneeEmail}` : ''}
                </small>
              </div>
              <div className="admin-list-actions">
                <span className={`admin-tag ${ticket.priority === 'urgent' ? 'is-danger' : ticket.priority === 'high' ? 'is-warn' : ''}`}>{PRIORITY_HE[ticket.priority]}</span>
                <span className={`admin-tag ${ticket.status === 'open' ? 'is-ok' : ticket.status === 'pending' ? 'is-warn' : ''}`}>{STATUS_HE[ticket.status]}</span>
                <button className="ghost-button admin-row-button focus-ring" onClick={() => { setOpenTicket(ticket); setAssignee(ticket.assigneeEmail || ''); setNote(''); }}>טיפול</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {openTicket && (
        <div className="admin-drawer-backdrop" role="dialog" aria-modal="true" aria-label={`פנייה ${openTicket.subject}`} onClick={() => setOpenTicket(null)}>
          <aside className="admin-drawer glass" onClick={event => event.stopPropagation()}>
            <header className="admin-drawer-header">
              <h2>{openTicket.subject}</h2>
              <button className="ghost-button admin-row-button focus-ring" onClick={() => setOpenTicket(null)}>סגירה</button>
            </header>
            <p className="admin-muted">{openTicket.requesterName} · <span dir="ltr">{openTicket.requesterEmail}</span> · {new Date(openTicket.createdAt).toLocaleString('he-IL')}</p>
            <div className="admin-ticket-body glass">{openTicket.body}</div>

            <div className="admin-field-row">
              <label className="admin-field"><span>סטטוס</span>
                <select className="form-input" value={openTicket.status} disabled={busy} onChange={event => act(openTicket.id, 'set_status', event.target.value)}>
                  <option value="open">פתוחה</option>
                  <option value="pending">בהמתנה</option>
                  <option value="closed">סגורה</option>
                </select>
              </label>
              <label className="admin-field"><span>עדיפות</span>
                <select className="form-input" value={openTicket.priority} disabled={busy} onChange={event => act(openTicket.id, 'set_priority', event.target.value)}>
                  <option value="low">נמוכה</option>
                  <option value="normal">רגילה</option>
                  <option value="high">גבוהה</option>
                  <option value="urgent">דחופה</option>
                </select>
              </label>
              <label className="admin-field"><span>הקצאה (אימייל)</span>
                <input className="form-input" dir="ltr" value={assignee} disabled={busy}
                  onChange={event => setAssignee(event.target.value)}
                  onBlur={() => { if (assignee !== (openTicket.assigneeEmail || '')) void act(openTicket.id, 'assign', assignee); }} />
              </label>
            </div>

            <h3>הערות פנימיות ({openTicket.notes.length})</h3>
            {openTicket.notes.length > 0 && (
              <ul className="admin-audit-mini">
                {openTicket.notes.map(item => (
                  <li key={item.id}><span>{item.body}</span><small>{item.authorEmail} · {new Date(item.createdAt).toLocaleString('he-IL')}</small></li>
                ))}
              </ul>
            )}
            <div className="admin-note-row">
              <input className="form-input" placeholder="הוספת הערה פנימית..." value={note} onChange={event => setNote(event.target.value)} disabled={busy} />
              <button className="premium-button admin-row-button focus-ring" disabled={busy || note.trim().length === 0}
                onClick={async () => { await act(openTicket.id, 'add_note', note); setNote(''); }}>הוספה</button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
