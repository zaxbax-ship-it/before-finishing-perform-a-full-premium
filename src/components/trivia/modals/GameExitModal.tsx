'use client';

import { useRef } from 'react';
import { BackIcon, HomeIcon } from '@/lib/design/icons';
import { useDialogFocus } from '../useDialogFocus';

export function GameExitModal({ t, stay, leave }: { t: Record<string, string>; stay: () => void; leave: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(true, dialogRef, stay);
  return (
    <div className="modal-backdrop" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="exit-title">
      <div className="glass modal-card">
        <div className="text-4xl text-gold" aria-hidden="true"><HomeIcon size={34} /></div>
        <h3 id="exit-title">{t.exitTitle}</h3>
        <p>{t.exitBody}</p>
        <div className="mt-5 flex gap-3">
          <button className="premium-button focus-ring inline-flex flex-1 items-center justify-center gap-2" type="button" data-autofocus onClick={stay}>
            <BackIcon size={16} />
            {t.exitStay}
          </button>
          <button className="ghost-button focus-ring inline-flex flex-1 items-center justify-center gap-2" type="button" onClick={leave}>
            <HomeIcon size={16} />
            {t.exitLeave}
          </button>
        </div>
      </div>
    </div>
  );
}
