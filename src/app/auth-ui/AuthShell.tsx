'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

/** Shared premium auth layout, reusing the app's existing design tokens. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="app-shell font-hebrew premium-typography" dir="rtl">
      <section className="auth-shell">
        <div className="glass auth-card">
          <Link className="focus-ring auth-brand" href="/">
            <span className="auth-brand-badge">♕</span>
            <span>
              <strong>משחק השעשועון</strong>
              <small>אזור אישי מאובטח</small>
            </span>
          </Link>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          <div className="auth-body">{children}</div>
        </div>
      </section>
    </main>
  );
}

export function AuthField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}</span>
      {children}
    </label>
  );
}

export function AuthMessage({ tone, children }: { tone: 'error' | 'warn' | 'success'; children: ReactNode }) {
  return <div className={`auth-message ${tone}`}>{children}</div>;
}

export function GoogleButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="ghost-button focus-ring auth-google" onClick={onClick} disabled={disabled}>
      <span aria-hidden="true" className="auth-google-badge">G</span>
      {label}
    </button>
  );
}
