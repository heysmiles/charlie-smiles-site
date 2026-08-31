import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { smoothstep } from '../lib/anim';
import { LANDMARKS } from './Coastline';
import { TL } from '../lib/timeline';

/**
 * The five doors. They surface only once the camera has come over the wave and
 * settled on the coast — before that they would be labels floating in an ocean.
 */
export function Landmarks({ progress }: { progress: React.MutableRefObject<number> }) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useFrame(() => {
    const t = progress.current;
    const base = smoothstep(TL.landmarksIn[0], TL.landmarksIn[1], t);
    refs.current.forEach((el, i) => {
      if (!el) return;
      // Stagger them along the coast so they arrive as a sweep, not a pop.
      const k = smoothstep(0, 1, Math.min(1, Math.max(0, base * 1.6 - i * 0.12)));
      el.style.opacity = String(k);
      el.style.transform = `translateY(${(1 - k) * 14}px)`;
      el.style.pointerEvents = k > 0.9 ? 'auto' : 'none';
    });
  });

  return (
    <>
      {LANDMARKS.map((lm, i) => (
        <Html key={lm.id} position={lm.pos} center zIndexRange={[20, 10]}>
          <div
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="landmark"
          >
            <span className="landmark__dot" />
            <span className="landmark__label">{lm.label}</span>
            <span className="landmark__leads">{lm.leads}</span>
          </div>
        </Html>
      ))}
    </>
  );
}
