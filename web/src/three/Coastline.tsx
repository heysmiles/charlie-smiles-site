import { useMemo } from 'react';
import * as THREE from 'three';
import { mountainLayer, cityLayer, beachLayer } from './coastArt';

export type Landmark = {
  id: string;
  label: string;
  leads: string;
  pos: [number, number, number];
};

/**
 * Five doors, arranged along a coastline. The x values here are the same ones
 * coastArt.ts draws against — move one and you must move both.
 */
export const LANDMARKS: Landmark[] = [
  { id: 'pier', label: 'Santa Monica Pier', leads: 'who am i', pos: [-260, 34, -470] },
  { id: 'breakwater', label: 'Breakwater', leads: 'photography', pos: [-135, 8, -424] },
  { id: 'skatepark', label: 'Venice Skate Park', leads: 'moving pictures', pos: [-15, 16, -380] },
  { id: 'brooks', label: 'Brooks', leads: '275 square feet', pos: [115, 20, -380] },
  { id: 'stan', label: 'Stan', leads: 'the day job', pos: [250, 52, -470] },
];

function Layer({
  tex,
  w,
  h,
  z,
}: {
  tex: THREE.Texture;
  w: number;
  h: number;
  z: number;
}) {
  return (
    <mesh position={[0, h / 2, z]} frustumCulled={false}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function Coastline() {
  const mountains = useMemo(() => mountainLayer(), []);
  const city = useMemo(() => cityLayer(), []);
  const beach = useMemo(() => beachLayer(), []);

  return (
    <group>
      <Layer tex={mountains} w={2600} h={400} z={-620} />
      <Layer tex={city} w={1200} h={200} z={-470} />
      <Layer tex={beach} w={900} h={120} z={-380} />
    </group>
  );
}
