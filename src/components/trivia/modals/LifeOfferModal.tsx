'use client';

import { useRef } from 'react';
import { CloseIcon, FavoritesIcon, PlayIcon } from '@/lib/design/icons';
import { fmt, money } from '../format';
import { useDialogFocus } from '../useDialogFocus';
import { useDismissable } from '../useDismissable';

/**
 * The dramatic third-life decision: buy one extra life for half the current
 * pot, or end the game with the entitled prize. Offered once per game; the
 * exact price is always shown. Maps to a native two-action alert sheet.
 */
export function LifeOfferModal({ t, cost, accept, decline }: { t: Record<string, string>; cost: number; accept: () => void; decline: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const { closing, dismiss } = useDismissable(decline);
  useDialogFocus(true, dialogRef, dismiss);
  return (
    <div className={`modal-backdrop ${closing ? 'is-closing' : ''}`} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="life-offer-title">
      <div className="glass modal-card">
        <div className="text-4xl text-ember" aria-hidden="true"><FavoritesIcon size={34} fill="currentColor" /></div>
        <h3 id="life-offer-title">{t.lifeOfferTitle}</h3>
        <p>{t.lifeOfferBody}</p>
        <div className="life-offer-cost">{fmt(t.lifeOfferCost, { price: money(cost) })}</div>
        <div className="mt-5 flex gap-3">
          <button className="premium-button focus-ring inline-flex flex-1 items-center justify-center gap-2" type="button" onClick={accept}>
            <PlayIcon size={16} />
            {t.lifeOfferAccept}
          </button>
          <button className="ghost-button focus-ring inline-flex flex-1 items-center justify-center gap-2" type="button" data-autofocus onClick={dismiss}>
            <CloseIcon size={16} />
            {t.lifeOfferDecline}
          </button>
        </div>
      </div>
    </div>
  );
}
