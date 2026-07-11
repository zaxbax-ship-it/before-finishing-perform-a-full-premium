'use client';

import { useRef } from 'react';
import { useDialogFocus } from '../useDialogFocus';
import { useDismissable } from '../useDismissable';

export function GameExitModal({ t, stay, leave, cashOut }: { t: Record<string, string>; stay: () => void; leave: () => void; cashOut: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const { closing, dismiss } = useDismissable(stay);
  useDialogFocus(true, dialogRef, dismiss);
  return (
    <div className={`modal-backdrop ${closing ? 'is-closing' : ''}`} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="exit-title">
      <div className="glass modal-card stage-panel">
        <h3 id="exit-title">{t.exitTitle}</h3>
        <p>{t.exitBody}</p>
        <div className="mt-5 flex flex-col gap-3">
          <button className="premium-button focus-ring w-full" type="button" data-autofocus onClick={dismiss}>{t.exitStay}</button>
          <div className="flex gap-3">
            <button className="ghost-button focus-ring flex-1" type="button" onClick={cashOut}>{t.quit}</button>
            <button className="ghost-button focus-ring flex-1" type="button" onClick={leave}>{t.exitLeave}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
