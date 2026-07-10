import { afterEach, describe, expect, it, vi } from 'vitest';
import { HAPTIC_PATTERNS, playHaptic, resolveHapticPattern, setHapticsEnabled } from '@/lib/haptics';

describe('semantic haptics', () => {
  afterEach(() => {
    setHapticsEnabled(false);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps meaningful gameplay events to patterns', () => {
    expect(resolveHapticPattern('answer.correct')).toEqual([14, 32, 16]);
    expect(resolveHapticPattern('answer.wrong')).toEqual([46]);
    expect(resolveHapticPattern('game.victory')).toEqual(HAPTIC_PATTERNS['game.victory']);
    expect(resolveHapticPattern('lifeline.used')).toEqual([10]);
  });

  it('keeps navigation and the per-second timer intentionally silent', () => {
    expect(resolveHapticPattern('ui.tap')).toBeNull();
    expect(resolveHapticPattern('timer.tick')).toBeNull();
    expect(resolveHapticPattern('ui.notice')).toBeNull();
  });

  it('does not vibrate while the effects setting is off', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    setHapticsEnabled(false);
    playHaptic('answer.correct');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('vibrates with the event pattern when enabled and supported', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    setHapticsEnabled(true);
    playHaptic('answer.correct');
    expect(vibrate).toHaveBeenCalledWith([14, 32, 16]);
  });

  it('never vibrates for an event with no tactile meaning', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    setHapticsEnabled(true);
    playHaptic('ui.tap');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('is a safe no-op where the Vibration API is unavailable', () => {
    vi.stubGlobal('navigator', {});
    setHapticsEnabled(true);
    expect(() => playHaptic('game.victory')).not.toThrow();
  });
});
