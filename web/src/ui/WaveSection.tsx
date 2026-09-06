import { useEffect, useRef } from 'react';
import { World } from '../world/World';
import { DOORS } from '../world/shore';
import { clamp01 } from '../world/math';
import { L } from '../world/layout';
import { getLenis } from '../lib/useScrollProgress';

/**
 * The wave section: a tall scroll track with a viewport-sized sticky stage.
 * It scrolls up under the landing like any block, pins once it fills the
 * frame, and from there the scroll drives the world.
 */
export function WaveSection() {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = section.current!;
    const world = new World(canvas.current!);
    (window as unknown as Record<string, unknown>).__world = world;
    let override: number | null = null;
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__p = (v: number | null) => { override = v; };

    const resize = () => {
      const w = el.clientWidth, h = window.innerHeight;
      world.resize(w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    // The ride. You scroll yourself into the barrel; from there the page
    // carries you through it and out to the beach in one fast, eased sweep
    // (and back out again if you scroll up from the beach).
    const ENTER = 0.6, END = 1.0;
    let zone: 'before' | 'after' = 'before';
    let riding = false;
    const rideTo = (target: number) => {
      const lenis = getLenis();
      if (!lenis) return;
      const rect = el.getBoundingClientRect();
      const y = window.scrollY + rect.top - (window.innerHeight - target * el.offsetHeight);
      riding = true;
      lenis.scrollTo(y, { duration: 1.9, lock: true, easing: (t: number) => 1 - Math.pow(1 - t, 3), onComplete: () => { riding = false; } });
    };

    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const rect = el.getBoundingClientRect();
      // Layout can settle after mount (or the pane can be hidden); re-check.
      const cw = el.clientWidth, ch = window.innerHeight;
      if (cw > 0 && ch > 0 && (canvas.current!.width !== Math.round(cw * Math.min(devicePixelRatio, 2)) )) world.resize(cw, ch);
      // Progress runs from the moment the section's top edge enters the
      // viewport, so the wave is already breaking while the landing leaves.
      const p = override ?? clamp01((window.innerHeight - rect.top) / Math.max(1, el.offsetHeight));
      if (!riding && override == null) {
        if (zone === 'before' && p >= ENTER) { zone = 'after'; rideTo(END); }
        else if (zone === 'after' && p <= ENTER) zone = 'before';
        else if (zone === 'after' && p < END - 0.02) { zone = 'before'; rideTo(ENTER - 0.03); }
      }
      world.update(p, dt);
      labels.current.forEach((n, i) => {
        if (!n) return;
        const d = world.doorScreen[i];
        n.style.opacity = d.visible ? '1' : '0';
        n.style.transform = `translate(-50%, -50%) translate(${d.x * el.clientWidth}px, ${d.y * window.innerHeight}px)`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); world.dispose(); };
  }, []);

  return (
    <section className="wave" ref={section} style={{ height: `${L.trackVh}vh` }}>
      <div className="wave__stage">
        <canvas ref={canvas} className="wave__canvas" />
        <div className="wave__labels">
          {DOORS.map((d, i) => (
            <div key={d.id} className="landmark" ref={(n) => { labels.current[i] = n; }}>
              <span className="landmark__dot" />
              <span className="landmark__label">{d.label}</span>
              <span className="landmark__leads">{d.leads}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
