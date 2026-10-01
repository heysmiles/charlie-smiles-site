import { useEffect, useRef } from 'react';
import { World } from '../world/World';
import { clamp01 } from '../world/math';
import { L } from '../world/layout';
import { Overlay } from './Overlay';
import { Vector2 } from 'three';

/**
 * The wave section: a tall scroll track with a viewport-sized sticky stage.
 * It scrolls up under the landing like any block, pins once it fills the
 * frame, and from there the scroll drives the world.
 */
export function WaveSection() {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fxCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = section.current!;
    const stage = el.firstElementChild as HTMLDivElement;
    const world = new World(canvas.current!);
    const overlay = new Overlay(fxCanvas.current!);
    (window as unknown as Record<string, unknown>).__world = world;
    let override: number | null = null;
    if (import.meta.env.DEV) { (window as unknown as Record<string, unknown>).__p = (v: number | null) => { override = v; }; (window as unknown as Record<string, unknown>).__overlay = overlay; }

    const resize = () => {
      const w = el.clientWidth, h = window.innerHeight;
      world.resize(w, h);
      overlay.resize(w, h);
    };

    // A tap on Venice: pointer down and up in the same place, quickly — so a
    // scroll or a drag never counts. The world says what was hit; the overlay
    // bursts at the cursor and, for the sky, keeps the cloud countdown.
    let down: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), held = performance.now() - down.t;
      down = null;
      if (moved > 8 || held > 400 || !world.interact.isActive) return;
      const r = stage.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      overlay.burst(x, y);
      world.interact.click(new Vector2((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1));
    };
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointerup', onUp);
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
      overlay.draw(dt);
      stage.classList.toggle('is-touchable', world.interact.isActive);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); stage.removeEventListener('pointerdown', onDown); stage.removeEventListener('pointerup', onUp); world.dispose(); };
  }, []);

  return (
    <section className="wave" ref={section} style={{ height: `${L.trackVh}vh` }}>
      <div className="wave__stage">
        <canvas ref={canvas} className="wave__canvas" />
        <canvas ref={fxCanvas} className="wave__fx" />
      </div>
    </section>
  );
}
