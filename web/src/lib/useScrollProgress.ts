import { useEffect } from 'react';
import Lenis from 'lenis';

let instance: Lenis | null = null;
/** The page's smooth-scroll controller, for programmatic rides. */
export const getLenis = () => instance;

/** Smooth wheel scrolling for the whole page. */
export function useSmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.6, smoothWheel: true });
    instance = lenis;
    let raf = 0;
    const loop = (time: number) => { lenis.raf(time); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); instance = null; };
  }, []);
}
