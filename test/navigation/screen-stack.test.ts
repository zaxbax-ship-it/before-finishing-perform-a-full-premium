import { describe, expect, it } from 'vitest';
import { canGoBack, popScreen, pushScreen, replaceTop, sanitizeTarget } from '@/lib/navigation/screenStack';

/**
 * The in-app navigation stack model behind the browser Back integration.
 * Pure and platform-neutral — the same structure a SwiftUI NavigationStack
 * path or a Compose NavHost back stack would hold.
 */
describe('Screen navigation stack', () => {
  it('pushes screens and walks back through them in order', () => {
    let stack = ['home'];
    stack = pushScreen(stack, 'categories');
    stack = pushScreen(stack, 'leaderboard');
    expect(stack).toEqual(['home', 'categories', 'leaderboard']);

    const first = popScreen(stack);
    expect(first?.screen).toBe('categories');
    const second = popScreen(first!.stack);
    expect(second?.screen).toBe('home');
    expect(popScreen(second!.stack)).toBeNull();
  });

  it('collapses consecutive duplicates so re-taps never create phantom Back steps', () => {
    let stack = ['home'];
    stack = pushScreen(stack, 'categories');
    stack = pushScreen(stack, 'categories');
    expect(stack).toEqual(['home', 'categories']);
  });

  it('replaceTop swaps the finished game for its result', () => {
    let stack = ['home', 'categories', 'game'];
    stack = replaceTop(stack, 'result');
    expect(stack).toEqual(['home', 'categories', 'result']);
    expect(popScreen(stack)?.screen).toBe('categories');
  });

  it('canGoBack is false only when no meaningful history remains', () => {
    expect(canGoBack(['home'])).toBe(false);
    expect(canGoBack(['home', 'rules'])).toBe(true);
  });

  it('sanitizes unrestorable targets to the safe fallback', () => {
    const restorable = ['home', 'categories', 'rules'];
    expect(sanitizeTarget('rules', restorable, 'categories')).toBe('rules');
    // A live game cannot be restored after reload — never re-enter broken state.
    expect(sanitizeTarget('game', restorable, 'categories')).toBe('categories');
    expect(sanitizeTarget('admin', restorable, 'categories')).toBe('categories');
  });
});
