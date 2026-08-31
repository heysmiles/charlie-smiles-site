import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { noiseGLSL } from './glsl/noise.glsl';
import { palette } from '../lib/palette';

const vert = /* glsl */ `
uniform float uTime, uChop;
varying vec3 vWorld;
varying vec2 vUv;
${noiseGLSL}

void main(){
  vUv = uv;
  vec3 pos = position;
  float x = pos.x, z = pos.y; // plane is rotated into place by the mesh
  float h =
      sin(x * 0.031 + uTime * 0.55) * 0.55
    + sin(z * 0.042 - uTime * 0.42) * 0.42
    + sin((x + z) * 0.019 + uTime * 0.27) * 0.7;
  h += (vnoise2(vec2(x, z) * 0.09 + uTime * 0.15) - 0.5) * 0.9;
  pos.z += h * uChop;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep, uMid, uFoam, uFog;
uniform float uFogNear, uFogFar, uOpacity;
varying vec3 vWorld;
${noiseGLSL}

void main(){
  // Shoreward of the break the water is a churned, streaky soup; seaward it is
  // clean swell.
  float shoreward = smoothstep(-20.0, -150.0, vWorld.z);
  float streak = fbm(vec2(vWorld.x * 0.05, vWorld.z * 0.16) + uTime * 0.08);
  float soup = smoothstep(0.44, 0.86, streak) * shoreward;

  vec3 col = mix(uDeep, uMid, smoothstep(-30.0, 120.0, vWorld.z) * 0.6 + 0.2);
  col = mix(col, uFoam, soup * 0.55);

  float d = length(cameraPosition - vWorld);
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));
  gl_FragColor = vec4(col, uOpacity);
}
`;

export function Ocean({ opacity }: { opacity: React.MutableRefObject<number> }) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uChop: { value: 1 },
      uOpacity: { value: 1 },
      uDeep: { value: new THREE.Color(palette.seaFar) },
      uMid: { value: new THREE.Color(palette.seaNear) },
      uFoam: { value: new THREE.Color(palette.foamDim) },
      uFog: { value: new THREE.Color(palette.skyHorizonCold) },
      uFogNear: { value: 200 },
      uFogFar: { value: 700 },
    }),
    []
  );

  useFrame((_, dt) => {
    mat.current.uniforms.uTime.value += dt;
    mat.current.uniforms.uOpacity.value = opacity.current;
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.2} frustumCulled={false}>
      <planeGeometry args={[2400, 1500, 220, 160]} />
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}
