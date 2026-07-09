'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared exit-transition pattern for dialogs and the nav drawer.
 *
 * Entrances are CSS animations on mount; exits need the element to stay
 * mounted while it animates. `dismiss()` flips `closing` (the component adds
 * an `is-closing` class that runs the exit keyframes) and fires the real
 * close callback once the animation has finished. Reduced-motion users close
 * instantly. Confirm-style actions should keep calling their handlers
 * directly — immediate response reads as responsiveness there; only
 * cancellations and backdrop/Escape dismissals glide out.
 *
 * Native mapping: this is the web analogue of SwiftUI's `.transition(...)` on
 * a dismissing sheet / Compose's `AnimatedVisibility` exit spec.
 */
const EXIT_MS = 260; // slightly longer than --duration-normal so CSS finishes first

export function useDismissable(onClosed: () => void) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const onClosedRef = useRef(onClosed);

  useEffect(() => {
    onClosedRef.current = onClosed;
  });

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClosedRef.current();
      return;
    }

    setClosing(true);
    timerRef.current = window.setTimeout(() => onClosedRef.current(), EXIT_MS);
  }, []);

  return { closing, dismiss };
}
