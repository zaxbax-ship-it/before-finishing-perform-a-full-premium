'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Stage 25 — the two-sided premium confetti burst for the third prize-ladder
 * advancement. Two emitters (left + right viewport edges) spray gold-heavy
 * shards inward toward the centre and slightly up/down, keeping the middle of
 * the screen readable. It is:
 *   • deterministic per `burstId` (a re-render never reshuffles or replays),
 *   • self-cleaning (all particles unmount after the burst — no DOM build-up,
 *     no animation loop, no interaction blocking, portalled + pointer-events:none),
 *   • reduced-motion aware (far fewer particles + a much shorter, minimal spray).
 * The palette is the gameplay system: mostly gold, some azure, a little white.
 */

const COLORS = ['#f7ca67', '#f7ca67', '#f7ca67', '#e0a53a', '#45c2ff', '#7dd3ff', '#ffffff'];

/** Small deterministic PRNG so particles are stable for a given burstId. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Particle = {
  side: 'left' | 'right';
  color: string;
  top: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  rot: number;
  dur: number;
  delay: number;
};

export function RewardConfetti({ burstId }: { burstId: number }) {
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [burstId]
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!burstId) return;
    setVisible(true);
    const ms = reduced ? 600 : 1800; // auto-cleanup window
    const timer = window.setTimeout(() => setVisible(false), ms);
    return () => window.clearTimeout(timer);
  }, [burstId, reduced]);

  const particles = useMemo<Particle[]>(() => {
    if (!burstId) return [];
    const rnd = mulberry32(burstId);
    const perSide = reduced ? 5 : 16;
    const out: Particle[] = [];
    for (const side of ['left', 'right'] as const) {
      for (let i = 0; i < perSide; i++) {
        const inward = 0.35 + rnd() * 0.5;
        out.push({
          side,
          color: COLORS[Math.floor(rnd() * COLORS.length)],
          top: 18 + rnd() * 60,
          w: 5 + Math.floor(rnd() * 6),
          h: 8 + Math.floor(rnd() * 10),
          dx: (side === 'left' ? 1 : -1) * inward * (reduced ? 10 : 42),
          dy: (rnd() * 2 - 1) * (reduced ? 5 : 32),
          rot: Math.floor(rnd() * 720 - 360),
          dur: (reduced ? 0.5 : 1.1) + rnd() * 0.5,
          delay: rnd() * (reduced ? 0.04 : 0.16)
        });
      }
    }
    return out;
  }, [burstId, reduced]);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div className={`reward-confetti${reduced ? ' is-reduced' : ''}`} aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className="cf"
          style={{
            [p.side]: '0px',
            top: `${p.top}vh`,
            width: `${p.w}px`,
            height: `${p.h}px`,
            background: p.color,
            ['--dx' as string]: `${p.dx}vw`,
            ['--dy' as string]: `${p.dy}vh`,
            ['--rot' as string]: `${p.rot}deg`,
            ['--dur' as string]: `${p.dur}s`,
            ['--delay' as string]: `${p.delay}s`
          }}
        />
      ))}
    </div>,
    document.body
  );
}
