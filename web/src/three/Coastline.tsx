import { useMemo } from 'react';
import * as THREE from 'three';
import { mountainLayer, cityLayer, beachLayer } from './coastArt';
import { Landmarks } from './Landmarks';
import { MOUTH_YAW } from './constants';

export type Landmark = {
  id: string;
  label: string;
  leads: string;
  pos: [number, number, number];
};

/**
 * The coast lies straight down the line, at -X, so it is what you see through
 * the mouth of the tube. Layers are planes turned to face +X; their canvas x
 * runs along world -Z, which is screen-right for a camera looking down -X —
 * so canvas left-to-right is screen left-to-right.
 *
 * The z values here mirror the x values coastArt.ts draws against.
 */
const DEPTH = { far: -1250, mid: -1080, near: -980 } as const;

export const LANDMARKS: Landmark[] = [
  { id: 'pier', label: 'Santa Monica Pier', leads: 'who am i', pos: [DEPTH.mid, 34, 260] },
  { id: 'breakwater', label: 'Breakwater', leads: 'photography', pos: [DEPTH.mid + 40, 8, 135] },
  { id: 'skatepark', label: 'Venice Skate Park', leads: 'moving pictures', pos: [DEPTH.near, 16, 15] },
  { id: 'brooks', label: 'Brooks', leads: '275 square feet', pos: [DEPTH.near, 20, -115] },
  { id: 'stan', label: 'Stan', leads: 'the day job', pos: [DEPTH.mid, 52, -250] },
];

function Layer({ tex, w, h, x }: { tex: THREE.Texture; w: number; h: number; x: number }) {
  return (
    <mesh position={[x, h / 2 - 6, 0]} rotation={[0, Math.PI / 2, 0]} frustumCulled={false}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function Coastline({ progress }: { progress: React.MutableRefObject<number> }) {
  const mountains = useMemo(() => mountainLayer(), []);
  const city = useMemo(() => cityLayer(), []);
  const beach = useMemo(() => beachLayer(), []);

  // The whole coast is built along local -X, then the group is turned so that
  // local -X points down the tube's mouth. Landmarks live inside the group so
  // they turn with it.
  return (
    <group rotation={[0, -MOUTH_YAW, 0]}>
      <Layer tex={mountains} w={2600} h={110} x={DEPTH.far} />
      <Layer tex={city} w={1200} h={200} x={DEPTH.mid} />
      <Layer tex={beach} w={900} h={120} x={DEPTH.near} />
      <Landmarks progress={progress} />
    </group>
  );
}
