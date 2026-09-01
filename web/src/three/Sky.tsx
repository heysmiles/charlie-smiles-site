import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { noiseGLSL } from './glsl/noise.glsl';
import { palette } from '../lib/palette';
import { SUN_DIR } from './constants';

const vert = /* glsl */ `
varying vec3 vPos;
void main(){
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
uniform vec3 uTop, uMid, uLow, uHorizon, uSun, uCloud, uSunDir;
uniform float uOpacity, uTime;
varying vec3 vPos;
${noiseGLSL}

void main(){
  vec3 d = normalize(vPos);
  float h = d.y;

  // Cream at the zenith down to deep orange on the water.
  vec3 col = uHorizon;
  col = mix(col, uLow, smoothstep(0.0, 0.07, h));
  col = mix(col, uMid, smoothstep(0.06, 0.24, h));
  col = mix(col, uTop, smoothstep(0.22, 0.62, h));
  col = mix(vec3(0.03, 0.06, 0.11), col, smoothstep(-0.03, 0.0, h));

  // Streaky clouds in the middle band, stretched along the horizon.
  // atan2 has a seam at +-pi; with -d.x that seam sits behind us at +X.
  vec2 cuv = vec2(atan(d.z, -d.x) * 2.6, h * 16.0);
  float cl = fbm(cuv * vec2(1.0, 2.2) + vec2(uTime * 0.008, 0.0));
  float band = smoothstep(0.05, 0.13, h) * (1.0 - smoothstep(0.3, 0.55, h));
  float cloud = smoothstep(0.48, 0.74, cl) * band;
  col = mix(col, uCloud, cloud * 0.5);

  // The sun, and the wash of light around it.
  float sd = max(dot(d, uSunDir), 0.0);
  float disc = smoothstep(0.99935, 0.9997, sd);
  float glow = pow(sd, 30.0) * 0.9 + pow(sd, 6.0) * 0.32;
  col += uSun * glow * (1.0 - cloud * 0.5);
  col = mix(col, vec3(1.0, 0.97, 0.88), disc);

  gl_FragColor = vec4(col, uOpacity);
}
`;

export function Sky({ opacity }: { opacity: React.MutableRefObject<number> }) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(palette.skyTop) },
      uMid: { value: new THREE.Color(palette.skyMid) },
      uLow: { value: new THREE.Color(palette.skyLow) },
      uHorizon: { value: new THREE.Color(palette.skyHorizon) },
      uSun: { value: new THREE.Color(palette.sun) },
      uCloud: { value: new THREE.Color(palette.cloud) },
      uSunDir: { value: new THREE.Vector3(...SUN_DIR).normalize() },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
    }),
    []
  );

  useFrame((_, dt) => {
    mat.current.uniforms.uOpacity.value = opacity.current;
    mat.current.uniforms.uTime.value += dt;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[2400, 48, 24]} />
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        transparent
      />
    </mesh>
  );
}
