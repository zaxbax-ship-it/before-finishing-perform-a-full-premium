'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Particles } from '@/components/trivia/chrome/Particles';

/** Shared premium auth layout, reusing the app's existing design tokens. */
export function AuthShell({ title, subtitle, onBack, children }: { title: string; subtitle?: string; onBack?: () => void; children: ReactNode }) {
  return (
    <main className="app-shell font-hebrew premium-typography" dir="rtl">
      <Particles />
      <section className="auth-shell">
        <div className="glass auth-card">
          {onBack && (
            <button type="button" className="auth-back focus-ring" onClick={onBack} aria-label="חזרה" title="חזרה">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
          <Link className="focus-ring auth-brand" href="/" aria-label="משחק השעשועון">
            <span className="auth-brand-badge" aria-hidden="true">♕</span>
            <strong>משחק השעשועון</strong>
          </Link>
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
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
  return <div className={`auth-message ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

/**
 * Google sign-in control (Stage 11B). Uses the official multicolor Google "G"
 * mark on a clean high-contrast surface — the familiar, recognizable Google
 * pattern — with explicit focus, pressed, loading and disabled states and a full
 * accessible name. The logo is never recolored or distorted.
 */
export function GoogleButton({ label, onClick, disabled, loading }: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      type="button"
      className="google-button focus-ring"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      aria-busy={loading || undefined}
    >
      <span className="google-button-icon" aria-hidden="true">
        {loading ? (
          <span className="google-spinner" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z" />
          </svg>
        )}
      </span>
      <span className="google-button-label">{label}</span>
    </button>
  );
}
