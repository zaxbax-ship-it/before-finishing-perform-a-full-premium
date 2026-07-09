/**
 * App navigation stack — the platform-neutral model behind in-app Back.
 *
 * The web client mirrors this stack into browser history (one history entry
 * per screen, carrying `{ tqsScreen, tqsIndex }` state) so the hardware/browser
 * Back button walks the app's own screens before it can leave the site.
 * Native clients map it directly: SwiftUI `NavigationStack(path:)` and
 * Jetpack Compose `NavHost` back stacks are this exact structure.
 *
 * Pure functions only — no window, no React — so the model is testable and
 * portable as-is.
 */

/** Appends a screen; consecutive duplicates collapse (re-tapping a nav item
 *  must not create phantom Back steps). */
export function pushScreen<S extends string>(stack: readonly S[], next: S): S[] {
  if (stack[stack.length - 1] === next) return [...stack];
  return [...stack, next];
}

/** Replaces the top entry (e.g. game → result: the finished game is not a
 *  meaningful Back destination). */
export function replaceTop<S extends string>(stack: readonly S[], next: S): S[] {
  if (stack.length === 0) return [next];
  return [...stack.slice(0, -1), next];
}

export function canGoBack<S extends string>(stack: readonly S[]): boolean {
  return stack.length > 1;
}

/** Pops to the previous screen, or null when the stack is exhausted (the app
 *  has no meaningful history left — leaving is now allowed). */
export function popScreen<S extends string>(stack: readonly S[]): { screen: S; stack: S[] } | null {
  if (stack.length < 2) return null;
  const next = stack.slice(0, -1);
  return { screen: next[next.length - 1], stack: next };
}

/**
 * Validates a Back/forward target against what is currently restorable.
 * Screens whose live state cannot be safely re-entered (a game after reload,
 * the admin screen in the public app) resolve to the given fallback instead —
 * never to a broken state, never to a surprise screen.
 */
export function sanitizeTarget<S extends string>(
  target: S,
  restorable: readonly S[],
  fallback: S
): S {
  return restorable.includes(target) ? target : fallback;
}
