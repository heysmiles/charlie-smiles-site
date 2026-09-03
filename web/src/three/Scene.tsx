import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { remap, smoothstep } from '../lib/anim';
import { TL } from '../lib/timeline';
import { Wave, type WaveHandle } from './Wave';
import { Ocean } from './Ocean';
import { Sky } from './Sky';
import { Spray } from './Spray';
import { Surfer } from './Surfer';
import { Curtain } from './Curtain';
import { Trail } from './Trail';
import { Coastline } from './Coastline';
import { CameraRig } from './CameraRig';
import { WAVE, CAM_P } from './constants';

/**
 * Everything downstream reads from refs this fills in, so the scene never
 * re-renders on scroll — it just redraws.
 */
function Driver({
  progress,
  front,
  wave,
  ocean,
  sky,
}: {
  progress: React.MutableRefObject<number>;
  front: React.MutableRefObject<number>;
  wave: React.MutableRefObject<WaveHandle>;
  ocean: React.MutableRefObject<number>;
  sky: React.MutableRefObject<number>;
}) {
  useFrame(() => {
    const t = progress.current;
    // Starts a little way into the wave so the side-on shot has a fully
    // formed section to look at rather than the strip's tapered end.
    const f = remap(t, TL.breakStart, TL.breakEnd, 0.88, -0.06);
    front.current = f;
    wave.current.front = f;
    wave.current.camU = f + WAVE.breakWidth * CAM_P;
    wave.current.opacity = 1;
    wave.current.chop = 1;
    ocean.current = 1;
    sky.current = smoothstep(TL.skyIn[0], TL.skyIn[1], t);
  });
  return null;
}

export function Scene({ progress }: { progress: React.MutableRefObject<number> }) {
  const front = useRef(1.06);
  const ocean = useRef(1);
  const sky = useRef(0);
  const wave = useRef<WaveHandle>({ front: 1.06, camU: 1.06, chop: 1, opacity: 1 });

  return (
    <>
      {/* Driver mounts first so every other useFrame this tick sees fresh values. */}
      <Driver progress={progress} front={front} wave={wave} ocean={ocean} sky={sky} />
      <Sky opacity={sky} />
      <Coastline progress={progress} />
      <Ocean opacity={ocean} />
      <Wave handle={wave} />
      <Curtain handle={wave} />
      <Trail front={front} />
      <Spray front={front} opacity={ocean} />
      <Surfer front={front} />
      <CameraRig progress={progress} front={front} />
    </>
  );
}
