'use client';

import { PublicButton, PublicModal } from '@/design/public';

export function GameExitModal({ t, stay, leave, cashOut }: { t: Record<string, string>; stay: () => void; leave: () => void; cashOut: () => void }) {
  return (
    <PublicModal labelledBy="exit-title" onDismiss={stay}>
      {(dismiss) => (
        <>
          <h3 id="exit-title">{t.exitTitle}</h3>
          <p>{t.exitBody}</p>
          <div className="mt-5 flex flex-col gap-3">
            <PublicButton variant="primary" className="w-full" data-autofocus onClick={dismiss}>{t.exitStay}</PublicButton>
            <div className="flex gap-3">
              <PublicButton variant="secondary" className="flex-1" onClick={cashOut}>{t.quit}</PublicButton>
              <PublicButton variant="secondary" className="flex-1" onClick={leave}>{t.exitLeave}</PublicButton>
            </div>
          </div>
        </>
      )}
    </PublicModal>
  );
}
