import { useEffect, useRef } from 'react';
import { smoothstep } from '../lib/anim';
import { TL } from '../lib/timeline';

/**
 * The still, warm page you land on. It does not move. The ocean rises over
 * it — the canvas sits above this sheet, the sky starts transparent, and the
 * sunset's zenith is the same cream as this page, so there is no seam to
 * cross. The content simply fades as the water reaches it.
 */
export function Landing({ progress }: { progress: React.MutableRefObject<number> }) {
  const inner = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = progress.current;
      const gone = smoothstep(TL.landingOut[0], TL.landingOut[1], t);
      if (inner.current) {
        inner.current.style.opacity = String(1 - gone);
        inner.current.style.transform = `translate3d(0, ${-gone * 6}vh, 0) scale(${1 + gone * 0.04})`;
      }
      if (cue.current) cue.current.style.opacity = String(1 - smoothstep(0.0, 0.06, t));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  return (
    <div className="landing">
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
