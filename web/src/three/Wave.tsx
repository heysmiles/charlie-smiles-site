import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildProfileTexture } from './waveProfile';
import { noiseGLSL } from './glsl/noise.glsl';
import { palette } from '../lib/palette';
import { WAVE } from './constants';

const vert = /* glsl */ `
uniform sampler2D uProfile;
uniform float uFront, uBreakWidth, uWaveLen, uWaveHeight, uTime, uChop;

varying float vU, vS, vP, vPhi;
varying vec3 vWorld;
varying vec3 vNrm;

${noiseGLSL}

float phaseAt(float u){
  float p = (u - uFront) / uBreakWidth;
  // A real break line is ragged, not a straight diagonal.
  p += (vnoise(u * 5.0 + 13.0) - 0.5) * 0.13;
  p += (vnoise(u * 17.0 + 3.0) - 0.5) * 0.05;
  return clamp(p, 0.0, 1.0);
}

vec3 wavePoint(float u, float s, out float pOut, out float phiOut){
  float p = phaseAt(u);
  vec4 pr = texture2D(uProfile, vec2(s, p));
  pOut = p;
  phiOut = pr.b;

  // Taper to nothing at both ends of the mesh. Without this the strip stops
  // dead and its cut edge reads as a slab floating on the horizon.
  float taper = smoothstep(0.0, 0.10, u) * (1.0 - smoothstep(0.90, 1.0, u));

  float x = (u - 0.5) * uWaveLen;
  float y = pr.g * uWaveHeight * taper;
  float z = -pr.r * uWaveHeight * taper;

  // Long-period swell riding through the whole wave.
  float swell = sin(x * 0.030 + uTime * 0.55) * 0.85
              + sin(x * 0.016 - uTime * 0.33) * 0.55;
  y += swell * mix(0.35, 1.0, s) * uChop;

  // Whitewater churn once it has collapsed.
  float churn = smoothstep(0.66, 1.0, p);
  if (churn > 0.001) {
    float n1 = vnoise2(vec2(u * 26.0, s * 12.0) + uTime * 0.8);
    float n2 = vnoise2(vec2(u * 41.0 + 7.0, s * 19.0) - uTime * 0.6);
    float n3 = vnoise2(vec2(u * 33.0 - 4.0, s * 15.0) + uTime * 0.45);
    y += (n1 - 0.5) * churn * uWaveHeight * 0.30;
    z += (n2 - 0.5) * churn * uWaveHeight * 0.34;
    x += (n3 - 0.5) * churn * uWaveHeight * 0.16;
  }

  // The lip frays as it throws.
  float lip = smoothstep(0.80, 1.0, s) * smoothstep(0.22, 0.62, p);
  float fray = (vnoise2(vec2(u * 60.0, s * 30.0 - uTime * 1.4)) - 0.5);
  y += fray * lip * uWaveHeight * 0.13;
  z += fray * lip * uWaveHeight * 0.10;

  return vec3(x, y, z);
}

void main(){
  float u = uv.x;
  float s = uv.y;
  float p, phi;
  vec3 pos = wavePoint(u, s, p, phi);

  // Normals by finite difference — the surface has no analytic derivative once
  // noise is in play, and this is cheap enough at this vertex count.
  float du = 1.0 / 320.0;
  float ds = 1.0 / 160.0;
  float tp, tphi;
  vec3 pu = wavePoint(min(u + du, 1.0), s, tp, tphi);
  vec3 pv = wavePoint(u, min(s + ds, 1.0), tp, tphi);
  vec3 nrm = normalize(cross(pv - pos, pu - pos));

  vU = u; vS = s; vP = p; vPhi = phi;
  vNrm = nrm;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform float uTime, uOpacity;
uniform vec3 uDeep, uMid, uFace, uLit, uFoam, uSky, uFog;
uniform float uFogNear, uFogFar;

varying float vU, vS, vP, vPhi;
varying vec3 vWorld;
varying vec3 vNrm;

${noiseGLSL}

void main(){
  vec3 N = normalize(vNrm);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0) N = -N;

  // Water body: dark in the trough, greener up the face.
  vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.5, vS));
  col = mix(col, uFace, smoothstep(0.38, 0.86, vS));

  // Light coming through thin water near the throwing lip — the green glow
  // that makes a barrel read as a barrel.
  float thin = smoothstep(0.52, 0.98, vS) * smoothstep(0.20, 0.72, vP);
  col = mix(col, uLit, thin * 0.9);

  // Past horizontal, the surface is the roof of the barrel. It sits in shadow,
  // but water is never black — light still comes through the sheet and bounces
  // off the wall, so shade toward deep green rather than toward nothing.
  float inside = smoothstep(1.7, 3.1, vPhi);
  vec3 roof = mix(uDeep, uLit, 0.16) * 0.72;
  col = mix(col, roof, inside * 0.7);
  // Light spilling in from the mouth of the tube.
  col += uLit * inside * smoothstep(0.55, 1.0, vS) * 0.12;

  // Foam.
  float grain = fbm(vec2(vU * 150.0, vS * 42.0) + uTime * 0.18);
  float fine = fbm(vec2(vU * 520.0, vS * 150.0) - uTime * 0.35);
  float lipFoam = smoothstep(0.88, 1.0, vS) * smoothstep(0.06, 0.40, vP);
  float white = smoothstep(0.62, 0.92, vP);
  // Foam draining down the face in streaks, rather than a wash of flat white.
  float streak = smoothstep(0.52, 0.88, fbm(vec2(vU * 60.0, vS * 260.0)))
               * smoothstep(0.28, 0.72, vP) * 0.6;
  float f = clamp(lipFoam * 1.05 + white + streak, 0.0, 1.0);
  f *= 0.40 + 0.75 * grain + 0.25 * fine;
  f = clamp(f * (0.75 + 0.45 * fine), 0.0, 1.0);
  col = mix(col, uFoam, f);

  // Fine surface texture. Without this the water reads as poured resin — a big
  // smooth shape needs high-frequency detail before the eye accepts it as
  // liquid, and the detail has to run with the face rather than across it.
  float ripple = fbm(vec2(vU * 320.0, vS * 74.0) + uTime * 0.30);
  float ripple2 = fbm(vec2(vU * 90.0, vS * 220.0) - uTime * 0.22);
  col *= 0.92 + 0.15 * ripple;
  col *= 0.96 + 0.08 * ripple2;

  // Sky in the glancing angles.
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.5);
  col = mix(col, uSky, fres * 0.30 * (1.0 - f * 0.8));

  // A soft key from high and behind, so the crest catches light, plus a
  // scattered glint that the ripple breaks up.
  vec3 L = normalize(vec3(-0.25, 0.85, -0.45));
  float key = clamp(dot(N, L), 0.0, 1.0);
  col += key * 0.10 * (1.0 - f * 0.5);
  float glint = pow(clamp(dot(reflect(-V, N), L), 0.0, 1.0), 22.0);
  col += glint * (0.2 + 0.8 * ripple) * 0.35 * (1.0 - f);

  float d = length(cameraPosition - vWorld);
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));

  // The wave is a sheet, not a solid. Where it has not broken, its leading edge
  // rests just above the open water and the camera can see under it — a black
  // strip along the horizon. Fade the last of the tail out there so it melts
  // into the ocean instead; a thrown lip stays solid, because that edge is
  // meant to be seen.
  float tail = 1.0 - smoothstep(0.84, 1.0, vS) * (1.0 - smoothstep(0.22, 0.48, vP));

  gl_FragColor = vec4(col, uOpacity * tail);
}
`;

export type WaveHandle = { front: number; chop: number; opacity: number };

export function Wave({ handle }: { handle: React.MutableRefObject<WaveHandle> }) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const profile = useMemo(() => buildProfileTexture(), []);

  const uniforms = useMemo(
    () => ({
      uProfile: { value: profile },
      uFront: { value: 1.05 },
      uBreakWidth: { value: WAVE.breakWidth },
      uWaveLen: { value: WAVE.length },
      uWaveHeight: { value: WAVE.height },
      uTime: { value: 0 },
      uChop: { value: 1 },
      uOpacity: { value: 1 },
      uDeep: { value: new THREE.Color(palette.waterDeep) },
      uMid: { value: new THREE.Color(palette.waterMid) },
      uFace: { value: new THREE.Color(palette.waterFace) },
      uLit: { value: new THREE.Color(palette.waterLit) },
      uFoam: { value: new THREE.Color(palette.foam) },
      uSky: { value: new THREE.Color(palette.skyHorizonCold) },
      uFog: { value: new THREE.Color(palette.skyHorizonCold) },
      uFogNear: { value: 180 },
      uFogFar: { value: 620 },
    }),
    [profile]
  );

  useFrame((_, dt) => {
    const u = mat.current.uniforms;
    u.uTime.value += dt;
    u.uFront.value = handle.current.front;
    u.uChop.value = handle.current.chop;
    u.uOpacity.value = handle.current.opacity;
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[1, 1, WAVE.segU, WAVE.segS]} />
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        transparent
      />
    </mesh>
  );
}
