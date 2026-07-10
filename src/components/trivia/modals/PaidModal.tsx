'use client';

import { useRef } from 'react';
import { fmt, money } from '../format';
import type { Lifeline } from '../types';
import { useDialogFocus } from '../useDialogFocus';
import { useDismissable } from '../useDismissable';

export function PaidModal({ t, pending, pot, cancel, confirm }: { t: Record<string, string>; pending: { type: Lifeline; price: number }; pot: number; cancel: () => void; confirm: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const { closing, dismiss } = useDismissable(cancel);
  useDialogFocus(true, dialogRef, dismiss);
  return (
    <div className={`modal-backdrop ${closing ? 'is-closing' : ''}`} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="paid-title">
      <div className="glass modal-card">
        <h3 id="paid-title">{t.paidTitle}</h3>
        <div className="paid-delta" dir="ltr" aria-label={fmt(t.paidPotInfo, { pot: money(pot) })}>
          <span className="paid-delta-from">{money(pot)}</span>
          <span className="paid-delta-op">−{money(pending.price)}</span>
          <span className="paid-delta-to">{money(Math.max(0, pot - pending.price))}</span>
        </div>
        <div className="mt-5 flex gap-3">
          <button className="premium-button focus-ring flex-1" onClick={confirm}>{t.confirmPay}</button>
          <button className="ghost-button focus-ring flex-1" data-autofocus onClick={dismiss}>{t.cancelBtn}</button>
        </div>
      </div>
    </div>
  );
}
