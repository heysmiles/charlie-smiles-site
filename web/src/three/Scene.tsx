import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { remap, smoothstep } from '../lib/anim';
import { TL } from '../lib/timeline';
import { Wave, type WaveHandle } from './Wave';
import { Ocean } from './Ocean';
import { Sky, type SkyHandle } from './Sky';
import { Spray } from './Spray';
import { Surfer } from './Surfer';
import { Coastline } from './Coastline';
import { Landmarks } from './Landmarks';
import { CameraRig } from './CameraRig';

const COLORS = {
  dawnTop: new THREE.Color('#bcc7c7'),
  dawnHorizon: new THREE.Color('#f2e4d4'),
  coldTop: new THREE.Color('#3f545c'),
  coldHorizon: new THREE.Color('#93a6ac'),
  landTop: new THREE.Color('#6d7f88'),
  landHorizon: new THREE.Color('#e6d2bd'),
};

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
  sky: React.MutableRefObject<SkyHandle>;
}) {
  const a = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const t = progress.current;

    const f = remap(t, TL.breakStart, TL.breakEnd, 1.06, -0.06);
    front.current = f;

    const reveal = smoothstep(TL.oceanIn[0], TL.oceanIn[1], t);
    wave.current.front = f;
    wave.current.opacity = reveal;
    wave.current.chop = 0.5 + 0.5 * reveal;
    ocean.current = reveal;

    // Warm paper -> cold water -> warm shore.
    const cold = smoothstep(0.04, 0.30, t);
    const back = smoothstep(0.78, 0.99, t);
    a.copy(COLORS.dawnTop).lerp(COLORS.coldTop, cold).lerp(COLORS.landTop, back);
    sky.current.top.copy(a);
    a.copy(COLORS.dawnHorizon).lerp(COLORS.coldHorizon, cold).lerp(COLORS.landHorizon, back);
    sky.current.horizon.copy(a);
  });

  return null;
}

export function Scene({ progress }: { progress: React.MutableRefObject<number> }) {
  const front = useRef(1.06);
  const ocean = useRef(0);
  const wave = useRef<WaveHandle>({ front: 1.06, chop: 1, opacity: 0 });
  const sky = useRef<SkyHandle>({
    top: COLORS.dawnTop.clone(),
    horizon: COLORS.dawnHorizon.clone(),
  });

  return (
    <>
      {/* Driver mounts first so every other useFrame this tick sees fresh values. */}
      <Driver progress={progress} front={front} wave={wave} ocean={ocean} sky={sky} />
      <Sky handle={sky} />
      <Coastline />
      <Ocean opacity={ocean} />
      <Wave handle={wave} />
      <Spray front={front} opacity={ocean} />
      <Surfer front={front} />
      <Landmarks progress={progress} />
      <CameraRig progress={progress} front={front} />
    </>
  );
}
