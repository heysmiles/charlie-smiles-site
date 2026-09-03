import { Suspense, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { Landmarks } from './Landmarks';
import { MOUTH_YAW } from './constants';
import { palette } from '../lib/palette';

export type Landmark = {
  id: string;
  label: string;
  leads: string;
  pos: [number, number, number];
};

/**
 * Venice, as a painted plate.
 *
 * The beach is a single wide image (assets/coast/venice-sunset-plate.png,
 * generated to match the reference's rendered-game look) standing up at the
 * far end of the tube's mouth. Its sky is faded out at the top so our own
 * sunset carries through, and its water sits below our ocean so the sand meets
 * the sea. Landmarks are placed in the plate's own coordinates.
 */

/** World units. Height sets the scale: the houses come out ~20 units tall. */
const PLATE = { w: 640, h: 272, sandLine: 0.2 } as const;

/** Where the camera ends up, and the plate 150 units beyond it down the mouth. */
const F = new THREE.Vector3(-Math.cos(MOUTH_YAW), 0, -Math.sin(MOUTH_YAW));
const CAM_END = new THREE.Vector3(-344, 22, -21);
export const PLATE_POS = CAM_END.clone().addScaledVector(F, 300).setY(0);
/** Rotate so the plane's normal faces back at the camera. */
const PLATE_ROT = Math.atan2(-F.x, -F.z);

const wx = (f: number) => (f - 0.5) * PLATE.w;
const hy = (f: number) => (f - PLATE.sandLine) * PLATE.h;

export const LANDMARKS: Landmark[] = [
  { id: 'pier', label: 'Santa Monica Pier', leads: 'who am i', pos: [wx(0.2), hy(0.5), 1] },
  { id: 'breakwater', label: 'Breakwater', leads: 'photography', pos: [wx(0.34), hy(0.24), 1] },
  { id: 'skatepark', label: 'Venice Skate Park', leads: 'moving pictures', pos: [wx(0.47), hy(0.33), 1] },
  { id: 'stan', label: 'Stan', leads: 'the day job', pos: [wx(0.62), hy(0.62), 1] },
  { id: 'brooks', label: 'Brooks', leads: '275 square feet', pos: [wx(0.78), hy(0.5), 1] },
];

const vert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const frag = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uHaze;
uniform float uFogNear, uFogFar;
varying vec2 vUv;
varying vec3 vWorld;
void main(){
  vec4 c = texture2D(uMap, vUv);
  // Let our sky through above the rooftops, and never show a rectangle: fade
  // the sides into the haze too.
  float a = 1.0 - smoothstep(0.56, 0.94, vUv.y);
  a *= smoothstep(0.0, 0.1, vUv.x) * (1.0 - smoothstep(0.9, 1.0, vUv.x));
  float d = length(cameraPosition - vWorld);
  vec3 col = mix(c.rgb, uHaze, smoothstep(uFogNear, uFogFar, d) * 0.6);
  gl_FragColor = vec4(col, a);
}
`;

function Plate() {
  const tex = useLoader(THREE.TextureLoader, '/coast/venice.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const uniforms = useMemo(
    () => ({
      uMap: { value: tex },
      uHaze: { value: new THREE.Color(palette.skyLow) },
      uFogNear: { value: 200 },
      uFogFar: { value: 900 },
    }),
    [tex]
  );
  return (
    <mesh position={[0, PLATE.h * (0.5 - PLATE.sandLine), 0]} frustumCulled={false}>
      <planeGeometry args={[PLATE.w, PLATE.h]} />
      <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} />
    </mesh>
  );
}

export function Coastline({ progress }: { progress: React.MutableRefObject<number> }) {
  return (
    <group position={PLATE_POS} rotation={[0, PLATE_ROT, 0]}>
      <Suspense fallback={null}>
        <Plate />
      </Suspense>
      <Landmarks progress={progress} />
    </group>
  );
}
