'use client';

import { useEffect, useRef } from 'react';
import { AchievementsIcon, LeaderboardIcon } from '@/lib/design/icons';

export type ProgressionToast = {
  id: string;
  kind: 'level' | 'achievement';
  text: string;
};

const TOAST_LIFETIME_MS = 4200;

/**
 * Progression celebration toasts — the visual counterpart of the existing
 * `progression.levelUp` / `progression.achievement` audio cues. Non-blocking
 * by construction: fixed top-center under the app bar, pointer-events none,
 * auto-dismissing, announced politely to screen readers. The parent schedules
 * toasts on the same timeline as the audio so sight and sound land together.
 *
 * Native mapping: a transient banner (SwiftUI overlay + task-delayed removal,
 * Compose Snackbar-style host with custom visuals).
 */
export function ProgressionToasts({ toasts, remove }: { toasts: ProgressionToast[]; remove: (id: string) => void }) {
  const removeRef = useRef(remove);
  const scheduledRef = useRef(new Set<string>());
  useEffect(() => {
    removeRef.current = remove;
  });
  useEffect(() => {
    // One dismissal timer per toast, scheduled exactly once — parent
    // re-renders and changing callback identities never reset the clock.
    for (const toast of toasts) {
      if (scheduledRef.current.has(toast.id)) continue;
      scheduledRef.current.add(toast.id);
      window.setTimeout(() => removeRef.current(toast.id), TOAST_LIFETIME_MS);
    }
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="progression-toasts" role="status" aria-live="polite">
      {toasts.map(toast => (
        <div key={toast.id} className={`progression-toast glass ${toast.kind === 'level' ? 'is-level' : 'is-achievement'}`}>
          <span className="progression-toast-icon" aria-hidden="true">
            {toast.kind === 'level' ? <LeaderboardIcon size={18} /> : <AchievementsIcon size={18} />}
          </span>
          <span>{toast.text}</span>
        </div>
      ))}
    </div>
  );
}
