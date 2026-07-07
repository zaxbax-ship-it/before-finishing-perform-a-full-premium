'use client';

import { useEffect } from 'react';
import { CloseIcon, PaymentsIcon, WalletIcon } from '@/lib/design/icons';
import { fmt, money } from '../format';
import type { Lifeline } from '../types';

export function PaidModal({ t, pending, pot, cancel, confirm }: { t: Record<string, string>; pending: { type: Lifeline; price: number }; pot: number; cancel: () => void; confirm: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancel]);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="paid-title">
      <div className="glass modal-card">
        <div className="text-4xl text-gold" aria-hidden="true"><WalletIcon size={34} /></div>
        <h3 id="paid-title">{t.paidTitle}</h3>
        <p>{fmt(t.paidBody, { label: t[pending.type], price: money(pending.price) })}</p>
        <div className="rounded-2xl bg-white/[0.07] p-4 text-sm text-white/65">{fmt(t.paidPotInfo, { pot: money(pot) })}</div>
        <div className="mt-5 flex gap-3">
          <button className="premium-button focus-ring inline-flex flex-1 items-center justify-center gap-2" onClick={confirm}>
            <PaymentsIcon size={16} />
            {t.confirmPay}
          </button>
          <button className="ghost-button focus-ring inline-flex flex-1 items-center justify-center gap-2" onClick={cancel}>
            <CloseIcon size={16} />
            {t.cancelBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
