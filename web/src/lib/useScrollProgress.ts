import { useEffect } from 'react';
import Lenis from 'lenis';

/** Smooth wheel scrolling for the whole page. */
export function useSmoothScroll() {
  useEffect(() => {
    // A brisker wheel so the landing gives way to the wave in a few scrolls; the
    // easing (lerp) is unchanged, so a gentle scroll still moves things gently.
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1.2, touchMultiplier: 1.9, smoothWheel: true });
    let raf = 0;
    const loop = (time: number) => { lenis.raf(time); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);
}
