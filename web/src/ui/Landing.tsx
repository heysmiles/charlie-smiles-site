import { useEffect, useRef } from 'react';
import { clamp, smoothstep } from '../lib/anim';

/**
 * The still, warm page you land on. It does not fade — it lifts, carrying the
 * cream ground up and off the screen to uncover the ocean already running
 * underneath it.
 */
export function Landing({ progress }: { progress: React.MutableRefObject<number> }) {
  const sheet = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = progress.current;
      const lift = smoothstep(0.0, 0.14, t);
      const s = sheet.current;
      const i = inner.current;
      const c = cue.current;
      if (s) {
        s.style.transform = `translate3d(0, ${-lift * 108}vh, 0)`;
        s.style.pointerEvents = lift > 0.02 ? 'none' : 'auto';
      }
      if (i) {
        // Content drifts a touch slower than the sheet — a little parallax so
        // the page feels like it has depth as it leaves.
        i.style.transform = `translate3d(0, ${lift * 26}vh, 0) scale(${1 + lift * 0.06})`;
        i.style.opacity = String(1 - smoothstep(0.02, 0.11, t));
      }
      if (c) c.style.opacity = String(clamp(1 - t * 22));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  return (
    <div className="landing" ref={sheet}>
      <div className="landing__inner" ref={inner}>
        <video
          className="landing__star"
          src="/brand/star.webm"
          poster="/brand/star.png"
          autoPlay
          muted
          loop
          playsInline
        />
        <h1 className="landing__name" aria-label="Charlie Smiles" />
        <div className="landing__cue" ref={cue}>
          <span className="landing__tagline">to enter, surf the internet</span>
          <span className="landing__arrow" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
