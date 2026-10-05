import { useEffect, useRef } from 'react';
import { StarAnim } from './star';

/**
 * The still, warm page you land on. A normal block at the top of the page;
 * the world scrolls up beneath it. The star is the original clip played from
 * a sprite sheet (see star.ts), so it needs no autoplay and has nothing
 * behind it.
 */
export function Landing() {
  const star = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = star.current!;
    const anim = new StarAnim(canvas, import.meta.env.BASE_URL);
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__star = anim;
    const ro = new ResizeObserver(() => anim.resize(canvas.clientWidth));
    ro.observe(canvas);
    // Only animate while the star is on screen and the tab is visible.
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !document.hidden) anim.start(); else anim.stop(); });
    io.observe(canvas);
    const onVis = () => { if (!document.hidden && visible) anim.start(); else anim.stop(); };
    document.addEventListener('visibilitychange', onVis);
    anim.resize(canvas.clientWidth);
    anim.start();
    return () => { ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); anim.dispose(); };
  }, []);

  return (
    <div className="landing">
      <div className="landing__inner">
        <canvas ref={star} className="landing__star" aria-hidden="true" />
        <h1 className="landing__name" aria-label="Charlie Smiles" />
        <div className="landing__cue">
          <span className="landing__tagline">surf the internet</span>
          <span className="landing__arrow" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
