'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Presentation-only animated number: eases the displayed value toward the
 * real one whenever it changes. The underlying value is never touched — the
 * animation always lands exactly on `target`, and reduced-motion users see
 * values snap instantly. On first mount the value counts up from zero when
 * positive (the reveal moment); afterwards it animates between real values
 * (pot climbing, deductions).
 *
 * Native mapping: SwiftUI `.contentTransition(.numericText())` /
 * `.animation(value:)`, Compose `animateIntAsState`.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) {
      setDisplay(target);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = Math.round(from + (target - from) * eased);
      setDisplay(progress >= 1 ? target : value);
      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    frameRef.current = window.requestAnimationFrame(tick);
    // rAF pauses in hidden tabs; this fallback guarantees the display always
    // converges on the exact real value no matter what.
    const settle = window.setTimeout(() => {
      fromRef.current = target;
      setDisplay(target);
    }, durationMs + 100);
    return () => {
      if (frameRef.current !== undefined) window.cancelAnimationFrame(frameRef.current);
      window.clearTimeout(settle);
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return display;
}
