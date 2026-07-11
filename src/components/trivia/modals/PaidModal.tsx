'use client';

import { fmt, money } from '../format';
import type { Lifeline } from '../types';
import { PublicButton, PublicModal } from '@/design/public';

export function PaidModal({ t, pending, pot, cancel, confirm }: { t: Record<string, string>; pending: { type: Lifeline; price: number }; pot: number; cancel: () => void; confirm: () => void }) {
  return (
    <PublicModal labelledBy="paid-title" onDismiss={cancel}>
      {(dismiss) => (
        <>
          <h3 id="paid-title">{t.paidTitle}</h3>
          <div className="paid-delta" dir="ltr" aria-label={fmt(t.paidPotInfo, { pot: money(pot) })}>
            <span className="paid-delta-from">{money(pot)}</span>
            <span className="paid-delta-op">−{money(pending.price)}</span>
            <span className="paid-delta-to">{money(Math.max(0, pot - pending.price))}</span>
          </div>
          <div className="mt-5 flex gap-3">
            <PublicButton variant="primary" className="flex-1" onClick={confirm}>{t.confirmPay}</PublicButton>
            <PublicButton variant="secondary" className="flex-1" data-autofocus onClick={dismiss}>{t.cancelBtn}</PublicButton>
          </div>
        </>
      )}
    </PublicModal>
  );
}
