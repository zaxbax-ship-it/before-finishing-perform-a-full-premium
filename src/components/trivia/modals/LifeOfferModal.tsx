'use client';

import { ChanceMeter } from '../ChanceMeter';
import { fmt, money } from '../format';
import { PublicButton, PublicModal } from '@/design/public';

/**
 * The dramatic third-life decision: buy one extra life for half the current
 * pot, or end the game with the entitled prize. Offered once per game; the
 * exact price is always shown. Maps to a native two-action alert sheet.
 */
export function LifeOfferModal({ t, cost, accept, decline }: { t: Record<string, string>; cost: number; accept: () => void; decline: () => void }) {
  return (
    <PublicModal labelledBy="life-offer-title" onDismiss={decline}>
      {(dismiss) => (
        <>
          <div className="life-offer-meter" aria-hidden="true"><ChanceMeter total={3} remaining={0} /></div>
          <h3 id="life-offer-title">{t.lifeOfferTitle}</h3>
          <p>{t.lifeOfferBody}</p>
          <div className="life-offer-cost">{fmt(t.lifeOfferCost, { price: money(cost) })}</div>
          <div className="mt-5 flex gap-3">
            <PublicButton variant="primary" className="flex-1" onClick={accept}>{t.lifeOfferAccept}</PublicButton>
            <PublicButton variant="secondary" className="flex-1" data-autofocus onClick={dismiss}>{t.lifeOfferDecline}</PublicButton>
          </div>
        </>
      )}
    </PublicModal>
  );
}
