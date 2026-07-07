import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

/**
 * Accessibility helper for modal dialogs and the nav drawer.
 *
 * While `active`, it: moves focus into `containerRef` (honouring a
 * `[data-autofocus]` element if present), keeps Tab / Shift+Tab cycling inside
 * the container (focus trap), closes on Escape via `onClose`, and — on
 * deactivation/unmount — restores focus to whatever was focused before it
 * opened. Purely presentational; no effect on any business logic.
 *
 * `onClose` is read through a ref so the trap is only (re)installed when
 * `active` flips — not on every parent re-render (e.g. the game timer ticking
 * while a dialog is open), which would otherwise thrash focus.
 */
export function useDialogFocus(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose?: () => void
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
      );

    const initial =
      container.querySelector<HTMLElement>('[data-autofocus]') || getFocusable()[0] || container;
    initial.focus?.();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (activeEl === first || !container.contains(activeEl))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeEl === last || !container.contains(activeEl))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [active, containerRef]);
}
