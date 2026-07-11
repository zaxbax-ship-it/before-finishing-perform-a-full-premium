import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from 'react';

/**
 * PUBLIC DESIGN SYSTEM — shared visual primitives.
 *
 * The Solo Gameplay screen is the Design Master. These are the ONLY approved
 * public visual primitives: each composes the canonical approved CSS layer
 * (glass / stage-panel / stage-interactive / premium-button / ghost-button /
 * form-input / modal-card / metric-tile) derived from ./tokens.css. Build every
 * new public screen/dialog from these instead of bespoke markup.
 *
 * Server-safe (no client hooks). The interactive modal lives in ./PublicModal.
 */

/** Public page container — the standard centred column + safe padding. */
export function PublicPage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-5xl px-5 pb-16 pt-6 ${className}`.trim()}>{children}</section>;
}

/** The master public surface: deep-navy glass panel + cyan lower-edge. */
export function PublicSurface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass stage-panel rounded-[28px] p-5 md:p-8 ${className}`.trim()}>{children}</div>;
}

/** A titled public page panel = page container + surface + screen heading. */
export function PublicPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PublicPage>
      <PublicSurface>
        <h2 className="public-screen-title">{title}</h2>
        {children}
      </PublicSurface>
    </PublicPage>
  );
}

/** An interactive answer-card-style surface (navy glass + azure hover edge). */
export function PublicInteractiveCard({ children, className = '', ...props }: { children: ReactNode; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`stage-interactive focus-ring ${className}`.trim()} {...props}>{children}</button>;
}

export type PublicButtonVariant = 'primary' | 'secondary' | 'danger';

/** The unified public button family. primary = premium gold CTA (the approved
 * reference primary), secondary = dark-glass ghost, danger = restrained red. */
export function PublicButton({ variant = 'primary', className = '', children, ...props }: { variant?: PublicButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = variant === 'primary' ? 'premium-button' : 'ghost-button';
  const danger = variant === 'danger'
    ? { borderColor: 'hsla(4, 92%, 62%, 0.42)', color: 'var(--danger)' }
    : undefined;
  return (
    <button type="button" className={`${base} focus-ring ${className}`.trim()} style={{ ...danger, ...props.style }} {...props}>
      {children}
    </button>
  );
}

/** Dark-glass text input (thin pale border, cyan focus edge). */
export function PublicInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`form-input ${className}`.trim()} {...props} />;
}
export function PublicTextarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`form-input ${className}`.trim()} {...props} />;
}
export function PublicSelect({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return <select className={`form-input ${className}`.trim()} {...props}>{children}</select>;
}

/** A labelled form field. */
export function PublicField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm text-white/65">{label}</span>{children}</label>;
}

/** A metric tile (navy glass + cyan edge) — gold = achievement, azure = neutral. */
export function PublicMetric({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return (
    <div className="metric-tile rounded-3xl p-5 text-center">
      <div className={`mt-2 text-3xl font-black ${gold ? 'text-gold' : 'text-azure'}`}>{value}</div>
      <div className="text-white/55">{label}</div>
    </div>
  );
}

/** Positive / success state banner. */
export function PublicSuccess({ text }: { text: string }) {
  return <div className="rounded-2xl border border-emerald-300/35 bg-emerald-300/10 p-4 font-bold text-emerald-100">{text}</div>;
}

/** An icon-only control: consistent 44/48px box, optically centred glyph. */
export function PublicIconButton({ label, onClick, children, tone = 'glass' }: { label: string; onClick?: () => void; children: ReactNode; tone?: 'glass' | 'gold' }) {
  return (
    <button type="button" className={`icon-button focus-ring${tone === 'gold' ? ' is-gold' : ''}`} aria-label={label} title={label} onClick={onClick}>
      <span className="icon-button-glyph" aria-hidden="true">{children}</span>
    </button>
  );
}
