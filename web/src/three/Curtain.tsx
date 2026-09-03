import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildProfileTexture } from './waveProfile';
import { noiseGLSL } from './glsl/noise.glsl';
import { palette } from '../lib/palette';
import { WAVE, SUN_DIR, BEND } from './constants';
import type { WaveHandle } from './Wave';

/**
 * The falling lip.
 *
 * In the reference the lip is not a sheet of water but a *curtain*: a waterfall
 * of vertical white streaks hanging from the crest to the trough, whose top
 * frays into spray strands that dissolve into the sky. The wave mesh cuts its
 * solid sheet short past the crest; this hangs from that cut edge.
 *
 * One strip along the wave. v = 0 is the spray above the lip, v = vLip is the
 * lip itself, v = 1 is the water. Everything is a function of the break front.
 */

const vert = /* glsl */ `
uniform sampler2D uProfile;
uniform float uFront, uBreakWidth, uWaveLen, uWaveHeight, uTime, uCamU, uBendK, uBendSlope, uBendLead;
varying float vU, vV, vW, vLipV;
varying vec3 vWorld;
${noiseGLSL}

float cutAt(float p){
  return 1.0 - 0.36 * smoothstep(0.22, 0.46, p) * (1.0 - smoothstep(0.60, 0.70, p));
}

void main(){
  float u = uv.x;
  float v = 1.0 - uv.y;
  float p = clamp((u - uFront) / uBreakWidth, 0.0, 1.0);

  // Where along the break the curtain exists: from the first throw through the
  // collapse. Zero elsewhere, and the strip degenerates to nothing.
  float w = smoothstep(0.5, 0.62, p) * (1.0 - smoothstep(0.8, 0.94, p));
  float taper = smoothstep(0.0, 0.10, u) * (1.0 - smoothstep(0.90, 1.0, u));
  w *= taper;

  // Hang from the crest, not the cut point: once the tube has rolled shut the
  // cut is down at the tip, and a curtain from there leaves the tube's dark
  // back exposed above it. The reference hides the tube behind the fall.
  vec4 lip = texture2D(uProfile, vec2(min(cutAt(p), 0.64), p));
  float nTop = lip.r * uWaveHeight;
  float yTop = lip.g * uWaveHeight;

  float spray = 0.42 * uWaveHeight;
  float top = yTop + spray;
  float lipV = spray / (top + 0.6);
  vLipV = lipV;

  // Fall forward toward shore as it drops; bow out a little.
  float below = clamp((v - lipV) / (1.0 - lipV), 0.0, 1.0);
  float n = nTop - 0.04 * uWaveHeight * (1.0 - v) + 0.30 * uWaveHeight * below * below * 0.9 + 0.12 * uWaveHeight * below;
  float y = mix(top, -0.6, v);

  // Frayed edge: strands don't all fall at the same place.
  n += (vnoise(u * 90.0 + 3.0) - 0.5) * 0.9;

  float x = (u - 0.5) * uWaveLen;
  float z = -n * w;
  float ahead = min(120.0, max(0.0, uCamU - u - uBendLead) * uWaveLen);
  z += uBendSlope * ahead + uBendK * ahead * ahead;

  vec3 pos = vec3(x, y * w, z);
  vU = u; vV = v; vW = w;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform float uTime, uOpacity;
uniform vec3 uColor, uLit, uFog, uSunDir;
uniform float uFogNear, uFogFar;
varying float vU, vV, vW, vLipV;
varying vec3 vWorld;
${noiseGLSL}

void main(){
  if (vW < 0.02) discard;

  // Vertical strands: high frequency along the wave, low frequency down it,
  // sliding downward. Two scales so the curtain has both threads and bulk.
  float s1 = fbm(vec2(vU * 700.0, vV * 2.4 + uTime * 0.6));
  float s2 = fbm(vec2(vU * 220.0 + 7.0, vV * 1.2 + uTime * 0.3));
  float strands = smoothstep(0.46, 0.66, s1) * 0.8 + smoothstep(0.45, 0.7, s2) * 0.4;

  // Above the lip only strands survive, and they thin to nothing at the top.
  float above = 1.0 - smoothstep(0.0, vLipV, vV);
  float sprayA = smoothstep(0.46, 0.78, s1) * (1.0 - above) * above * 4.0;
  // From the lip down the curtain is a solid fall of white water.
  float below = smoothstep(vLipV, vLipV + 0.08, vV);
  float bodyA = below * (0.9 + 0.1 * strands);
  // Per-strand gaps near the top of the fall, closing lower down.
  float gaps = smoothstep(0.3, 0.55, s1) * (1.0 - smoothstep(vLipV, vLipV + 0.4, vV));
  bodyA *= 1.0 - gaps * 0.55;

  float a = clamp(sprayA + bodyA, 0.0, 1.0) * vW;

  // Backlit by the sun through the water.
  vec3 V = normalize(cameraPosition - vWorld);
  float behind = pow(clamp(-dot(V, uSunDir) * 0.5 + 0.5, 0.0, 1.0), 2.0);
  vec3 col = mix(uColor, uLit, behind * 0.32 + 0.06);
  col *= 0.86 + 0.28 * strands;

  float d = length(cameraPosition - vWorld);
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));
  gl_FragColor = vec4(col, a * uOpacity);
}
`;

export function Curtain({ handle }: { handle: React.MutableRefObject<WaveHandle> }) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const profile = useMemo(() => buildProfileTexture(), []);
  const uniforms = useMemo(
    () => ({
      uProfile: { value: profile },
      uFront: { value: 1.06 },
      uCamU: { value: 1.06 },
      uBreakWidth: { value: WAVE.breakWidth },
      uWaveLen: { value: WAVE.length },
      uWaveHeight: { value: WAVE.height },
      uBendK: { value: BEND.k },
      uBendSlope: { value: BEND.slope },
      uBendLead: { value: BEND.lead },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color('#fff6ec') },
      uLit: { value: new THREE.Color(palette.waterLit) },
      uFog: { value: new THREE.Color(palette.skyHorizon) },
      uSunDir: { value: new THREE.Vector3(...SUN_DIR).normalize() },
      uFogNear: { value: 60 },
      uFogFar: { value: 520 },
    }),
    [profile]
  );

  useFrame((_, dt) => {
    const u = mat.current.uniforms;
    u.uTime.value += dt;
    u.uFront.value = handle.current.front;
    u.uCamU.value = handle.current.camU;
    u.uOpacity.value = handle.current.opacity;
  });

  return (
    <mesh frustumCulled={false} renderOrder={2}>
      <planeGeometry args={[1, 1, WAVE.segU, 30]} />
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
