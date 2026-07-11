'use client';

import { useRef, type ReactNode } from 'react';
import { useDialogFocus } from '@/components/trivia/useDialogFocus';
import { useDismissable } from '@/components/trivia/useDismissable';

/**
 * PUBLIC DESIGN SYSTEM — the one approved public modal.
 *
 * Encapsulates the master dialog composition: the blurred continuous-stage
 * backdrop, the deep-navy glass card with the cyan lower-edge (glass modal-card
 * stage-panel), the closing animation, focus trap and Escape/dismiss behaviour.
 * Every public dialog/confirmation/overlay renders through this — never a
 * bespoke modal. `children` receives `dismiss` for the cancel/stay action.
 */
export function PublicModal({
  labelledBy,
  onDismiss,
  className = '',
  children
}: {
  labelledBy: string;
  onDismiss: () => void;
  className?: string;
  children: (dismiss: () => void) => ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const { closing, dismiss } = useDismissable(onDismiss);
  useDialogFocus(true, dialogRef, dismiss);
  return (
    <div className={`modal-backdrop ${closing ? 'is-closing' : ''}`} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className={`glass modal-card stage-panel ${className}`.trim()}>
        {children(dismiss)}
      </div>
    </div>
  );
}
