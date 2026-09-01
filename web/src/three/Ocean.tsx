import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { noiseGLSL } from './glsl/noise.glsl';
import { palette } from '../lib/palette';
import { SUN_DIR } from './constants';

const vert = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
${noiseGLSL}

void main(){
  vec3 pos = position;
  float x = pos.x, z = pos.y; // plane is rotated flat by the mesh
  float h =
      sin(x * 0.028 + uTime * 0.5) * 0.5
    + sin(z * 0.04 - uTime * 0.38) * 0.4
    + sin((x + z) * 0.017 + uTime * 0.25) * 0.65;
  h += (vnoise2(vec2(x, z) * 0.11 + uTime * 0.12) - 0.5) * 1.1;
  pos.z += h;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform float uTime, uOpacity;
uniform vec3 uDeep, uMid, uFoam, uFog, uSun, uSunDir, uSkyRefl;
uniform float uFogNear, uFogFar;
varying vec3 vWorld;
${noiseGLSL}

void main(){
  // Geometric normal from the displaced surface, then broken up with fine
  // noise so the sun path shatters into glitter instead of one clean streak.
  vec3 N = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (N.y < 0.0) N = -N;
  float n1 = vnoise2(vWorld.xz * 0.9 + uTime * 0.7);
  float n2 = vnoise2(vWorld.xz * 1.3 - uTime * 0.55);
  N = normalize(N + vec3(n1 - 0.5, 0.0, n2 - 0.5) * 0.55);

  vec3 V = normalize(cameraPosition - vWorld);
  vec3 R = reflect(-V, N);

  vec3 col = mix(uDeep, uMid, smoothstep(-0.1, 0.5, N.y) * 0.5);

  // Sky in the glancing angles, warmer toward the sun.
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
  float toward = pow(clamp(dot(normalize(vec3(R.x, 0.0, R.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0, 1.0), 3.0);
  vec3 refl = mix(uSkyRefl * 0.35, uFog * 0.8, toward);
  col = mix(col, refl, fres * 0.32);

  // The sun path.
  float s = max(dot(R, uSunDir), 0.0);
  float glint = pow(s, 140.0) * 1.5 + pow(s, 18.0) * 0.35;
  col += uSun * glint;

  // Churned soup on the shoreward side of the break.
  float shoreward = smoothstep(-24.0, -120.0, vWorld.z);
  float streak = fbm(vec2(vWorld.x * 0.05, vWorld.z * 0.16) + uTime * 0.08);
  float soup = smoothstep(0.46, 0.86, streak) * shoreward;
  col = mix(col, uFoam, soup * 0.5);

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
      uOpacity: { value: 1 },
      uDeep: { value: new THREE.Color(palette.waterDeep) },
      uMid: { value: new THREE.Color(palette.waterMid) },
      uFoam: { value: new THREE.Color(palette.foamDim) },
      uFog: { value: new THREE.Color('#8e3d14') },
      uSkyRefl: { value: new THREE.Color(palette.skyMid) },
      uSun: { value: new THREE.Color(palette.sun) },
      uSunDir: { value: new THREE.Vector3(...SUN_DIR).normalize() },
      uFogNear: { value: 260 },
      uFogFar: { value: 1100 },
    }),
    []
  );

  useFrame((_, dt) => {
    mat.current.uniforms.uTime.value += dt;
    mat.current.uniforms.uOpacity.value = opacity.current;
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position={[-600, -0.2, 0]} frustumCulled={false}>
      <planeGeometry args={[3400, 1800, 260, 160]} />
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
