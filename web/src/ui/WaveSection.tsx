import { useEffect, useRef } from 'react';
import type React from 'react';
import { World } from '../world/World';
import { DOORS } from '../world/doors';
import { clamp01, smoothstep } from '../world/math';
import { L } from '../world/layout';

/**
 * The wave section: a tall scroll track with a viewport-sized sticky stage.
 * It scrolls up under the landing like any block, pins once it fills the
 * frame, and from there the scroll drives the world.
 */
export function WaveSection() {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const clouds = useRef<HTMLDivElement>(null);

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
      world.update(p, dt);
      // The door clouds live where the sky is at the top of the frame: the
      // side-on chapter and the rest at the end, not inside the tube.
      if (clouds.current) clouds.current.style.opacity = String(Math.min(1, 1 - smoothstep(0.4, 0.5, p) + smoothstep(0.88, 0.95, p)));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); world.dispose(); };
  }, []);

  return (
    <section className="wave" ref={section} style={{ height: `${L.trackVh}vh` }}>
      <div className="wave__stage">
        <canvas ref={canvas} className="wave__canvas" />
        <div className="wave__clouds" ref={clouds}>
          {DOORS.map((d, i) => (
            <a
              key={d.id}
              className="cloud"
              href={`#${d.id}`}
              style={{ ...({ '--i': i } as React.CSSProperties), top: `${5 + (i % 3) * 6}vh`, animationDuration: `${170 + i * 29}s`, animationDelay: `-${i * 41 + 10}s` }}
            >
              <svg className="cloud__puff" viewBox="0 0 220 96" aria-hidden="true">
                <defs><filter id={`soft-${d.id}`} x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="5" /></filter></defs>
                <g filter={`url(#soft-${d.id})`}>
                  <ellipse cx="72" cy="60" rx="62" ry="24" />
                  <ellipse cx="128" cy="52" rx="58" ry="30" />
                  <ellipse cx="100" cy="40" rx="42" ry="26" />
                  <ellipse cx="160" cy="64" rx="42" ry="20" />
                </g>
              </svg>
              <span className="cloud__text">
                <span className="cloud__label">{d.label}</span>
                <span className="cloud__leads">{d.leads}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
