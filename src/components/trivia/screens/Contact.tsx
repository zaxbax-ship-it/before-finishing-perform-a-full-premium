'use client';

import { useState } from 'react';
import { ConfirmIcon, MailIcon } from '@/lib/design/icons';
import { Field, Panel } from '../primitives';

export function Contact({ t, sent, setSent }: { t: Record<string, string>; sent: boolean; setSent: (value: boolean) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message })
      });
      const data = await response.json();
      if (response.ok && data?.ok) {
        setStatus('idle');
        setSent(true);
        setName('');
        setEmail('');
        setMessage('');
        return;
      }
    } catch {
      // Handled below.
    }
    setStatus('error');
  }

  return (
    <Panel title={t.contact} icon={<MailIcon size={26} aria-hidden="true" />}>
      <form className="grid gap-5 max-w-xl mx-auto" onSubmit={submit}>
        <Field label={t.fullName}>
          <input className="form-input" value={name} onChange={event => setName(event.target.value)} required maxLength={80} disabled={status === 'sending'} />
        </Field>
        <Field label={t.email}>
          <input className="form-input" type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={160} disabled={status === 'sending'} />
        </Field>
        <Field label={t.message}>
          <textarea className="form-input min-h-36" value={message} onChange={event => setMessage(event.target.value)} required minLength={5} maxLength={4000} disabled={status === 'sending'} />
        </Field>
        <button type="submit" className="premium-button focus-ring w-full" disabled={status === 'sending'}>
          {t.sendMsg}
        </button>
        {status === 'error' && <div className="form-error" role="alert">{t.contactError}</div>}
        {sent && (
          <div className="mt-4 p-5 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 text-emerald-100 flex items-center justify-center gap-3" role="status">
            <span className="text-emerald-400"><ConfirmIcon size={20} /></span>
            <span className="font-bold">{t.contactSuccess}</span>
          </div>
        )}
      </form>
    </Panel>
  );
}
