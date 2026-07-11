import type { ReactNode } from 'react';

/**
 * Small presentational primitives shared across the trivia screens.
 * Extracted verbatim from `TriviaPlatform.tsx`; markup and classes unchanged.
 */

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm text-white/65">{label}</span>{children}</label>;
}

export function Panel({ title, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  // Stage 12 — one lighter shared public-screen header: compact, start-aligned,
  // no decorative icon or eyebrow. Structure comes from spacing + typography.
  return <section className="mx-auto max-w-5xl px-5 pb-16 pt-6"><div className="glass stage-panel rounded-[28px] p-5 md:p-8"><h2 className="public-screen-title">{title}</h2>{children}</div></section>;
}

export function Metric({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return <div className="metric-tile rounded-3xl p-5 text-center"><div className={`mt-2 text-3xl font-black ${gold ? 'text-gold' : 'text-azure'}`}>{value}</div><div className="text-white/55">{label}</div></div>;
}

export function Success({ text }: { text: string }) {
  return <div className="rounded-2xl border border-emerald-300/35 bg-emerald-300/10 p-4 font-bold text-emerald-100">{text}</div>;
}

/**
 * Stage 11B — the shared icon-control primitive. Every functional icon-only
 * button should route through here so it always has (1) a consistent, aligned
 * box (the .icon-button family: 48px desktop / 44px touch), (2) a required
 * localized aria-label, and (3) a line-height-safe, optically centered glyph
 * that never drifts. Decorative glyphs are aria-hidden. Native equivalents:
 * SwiftUI Button+Label(systemImage) with .accessibilityLabel; Compose
 * IconButton with contentDescription.
 */
export function IconButton({ label, onClick, children, tone = 'glass' }: { label: string; onClick?: () => void; children: ReactNode; tone?: 'glass' | 'gold' }) {
  return (
    <button type="button" className={`icon-button focus-ring${tone === 'gold' ? ' is-gold' : ''}`} aria-label={label} title={label} onClick={onClick}>
      <span className="icon-button-glyph" aria-hidden="true">{children}</span>
    </button>
  );
}
