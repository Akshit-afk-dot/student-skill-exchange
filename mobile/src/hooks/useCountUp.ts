import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from 0 to `target`.
 *
 * Driven by `requestAnimationFrame` and React state rather than Reanimated, deliberately:
 * Reanimated's trick for animating a number is to set `text` as an animated prop, which
 * only exists on native. A counter that renders nothing on web is worse than one that
 * costs a few re-renders, and these are one-shot animations over well under a second.
 *
 * Respects the duration and delay so it can be staggered alongside other entrances.
 */
export function useCountUp(
  target: number,
  { duration = 800, delay = 0, decimals = 0 }: { duration?: number; delay?: number; decimals?: number } = {},
): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setValue(0);
      return;
    }

    // Nothing to animate towards; skip the frame loop entirely.
    if (target === 0) {
      setValue(0);
      return;
    }

    const round = (n: number) =>
      decimals > 0 ? Number(n.toFixed(decimals)) : Math.round(n);

    const start = () => {
      const began = Date.now();

      const step = () => {
        const elapsed = Date.now() - began;
        const p = Math.min(1, elapsed / duration);
        // Cubic ease-out: fast start, gentle settle — matches the spring feel elsewhere.
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(round(target * eased));

        if (p < 1) frame.current = requestAnimationFrame(step);
        else setValue(round(target));
      };

      frame.current = requestAnimationFrame(step);
    };

    if (delay > 0) timer.current = setTimeout(start, delay);
    else start();

    /**
     * Guaranteed settle.
     *
     * `requestAnimationFrame` does not fire while the app is backgrounded or the tab is
     * not compositing. Without this, a counter that started just before the app went to
     * the background would be frozen part-way — showing 0% for a match that scored 44.
     * A timer still fires in that state, so this pins the final value regardless.
     */
    settle.current = setTimeout(() => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      setValue(round(target));
    }, delay + duration + 50);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (timer.current !== null) clearTimeout(timer.current);
      if (settle.current !== null) clearTimeout(settle.current);
    };
  }, [target, duration, delay, decimals]);

  return value;
}
