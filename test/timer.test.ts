import { describe, expect, it } from 'vitest';
import {
  TIMER_DANGER_SECONDS,
  TIMER_WARNING_SECONDS,
  timerProgress,
  timerUrgencyFor
} from '@/lib/gameplay/timer';
import { SOLO_TIMER_SECONDS } from '@/components/trivia/constants';

describe('countdown presentation model', () => {
  it('is full at the start of a question and empty exactly at expiry', () => {
    expect(timerProgress(45, 45).progress).toBe(1);
    expect(timerProgress(45, 0).progress).toBe(0);
    expect(timerProgress(45, 0).remaining).toBe(0);
  });

  it('progress is the linear remaining fraction', () => {
    expect(timerProgress(40, 20).progress).toBe(0.5);
    expect(timerProgress(45, 15).progress).toBeCloseTo(1 / 3, 5);
  });

  it('clamps out-of-range remaining values', () => {
    expect(timerProgress(45, 60).progress).toBe(1);
    expect(timerProgress(45, -5).progress).toBe(0);
    expect(timerProgress(45, -5).remaining).toBe(0);
  });

  it('urgency thresholds are deterministic', () => {
    expect(TIMER_WARNING_SECONDS).toBe(15);
    expect(TIMER_DANGER_SECONDS).toBe(8);
    expect(timerUrgencyFor(45)).toBe('calm');
    expect(timerUrgencyFor(16)).toBe('calm');
    expect(timerUrgencyFor(15)).toBe('warning');
    expect(timerUrgencyFor(9)).toBe('warning');
    expect(timerUrgencyFor(8)).toBe('danger');
    expect(timerUrgencyFor(0)).toBe('danger');
  });

  it('drives the solo duration through calm -> danger, reaching zero at expiry', () => {
    expect(timerProgress(SOLO_TIMER_SECONDS, SOLO_TIMER_SECONDS).urgency).toBe('calm');
    expect(timerProgress(SOLO_TIMER_SECONDS, 8).urgency).toBe('danger');
    expect(timerProgress(SOLO_TIMER_SECONDS, 0).progress).toBe(0);
  });
});
