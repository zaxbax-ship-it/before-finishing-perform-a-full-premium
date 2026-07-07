import type { ReactNode } from 'react';

/**
 * Small presentational primitives shared across the trivia screens.
 * Extracted verbatim from `TriviaPlatform.tsx`; markup and classes unchanged.
 */

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm text-white/65">{label}</span>{children}</label>;
}

export function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="mx-auto max-w-5xl px-5 pb-16 pt-8"><div className="glass rounded-[34px] p-6 md:p-10"><div className="mb-7 flex items-center gap-4 text-gold"><span className="text-4xl">{icon}</span><h2 className="text-4xl font-black text-white md:text-5xl">{title}</h2></div>{children}</div></section>;
}

export function Metric({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return <div className="rounded-3xl bg-white/[0.08] p-5"><div className={`mt-2 text-3xl font-black ${gold ? 'text-gold' : 'text-azure'}`}>{value}</div><div className="text-white/55">{label}</div></div>;
}

export function Success({ text }: { text: string }) {
  return <div className="rounded-2xl border border-emerald-300/35 bg-emerald-300/10 p-4 font-bold text-emerald-100">{text}</div>;
}
