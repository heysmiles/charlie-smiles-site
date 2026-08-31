import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { clamp } from './anim';

/**
 * Scroll position as a 0..1 ref, smoothed by Lenis.
 *
 * A ref rather than state on purpose: nothing in the scene should re-render on
 * scroll. Append ?debug to the URL to scrub the timeline by hand.
 */
export function useScrollProgress() {
  const progress = useRef(0);
  const override = useRef<number | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.075,
      wheelMultiplier: 0.85,
      touchMultiplier: 1.6,
      smoothWheel: true,
    });

    // Tuning hook: window.__p(0.55) jumps the timeline, window.__p(null) releases.
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__p = (v: number | null) => {
        override.current = v;
      };
    }

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      if (override.current === null) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.current = max > 0 ? clamp(window.scrollY / max) : 0;
      } else {
        progress.current = override.current;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return { progress, override };
}
