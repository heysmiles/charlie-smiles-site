import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildProfileTexture } from './waveProfile';
import { noiseGLSL } from './glsl/noise.glsl';
import { palette } from '../lib/palette';
import { WAVE, SUN_DIR, BEND } from './constants';

const vert = /* glsl */ `
uniform sampler2D uProfile;
uniform float uFront, uBreakWidth, uWaveLen, uWaveHeight, uTime, uChop, uCamU, uBendK, uBendSlope, uBendLead;

varying float vU, vS, vP, vPhi, vCut, vEdge;
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

// How much of the cross-section is solid water. Through the standing-face
// phase the sheet stops just past the crest: the lip hangs in the air and what
// falls from it is spray, not a wall. Let the sheet run all the way to the
// trough there and every section becomes a sealed hump — the tube has no mouth.
float cutAt(float pSmooth){
  return 1.0 - 0.36 * smoothstep(0.22, 0.46, pSmooth) * (1.0 - smoothstep(0.60, 0.70, pSmooth));
}

vec3 wavePoint(float u, float s, out float pOut, out float phiOut){
  float p = phaseAt(u);
  // The cut follows the smooth phase, not the ragged one — otherwise the
  // lip's edge saw-tooths from column to column.
  float cut = cutAt(clamp((u - uFront) / uBreakWidth, 0.0, 1.0));
  s = min(s, cut);
  vec4 pr = texture2D(uProfile, vec2(s, p));
  pOut = p;
  phiOut = pr.b;

  // Taper to nothing at both ends of the mesh. Without this the strip stops
  // dead and its cut edge reads as a slab floating on the horizon.
  float taper = smoothstep(0.0, 0.10, u) * (1.0 - smoothstep(0.90, 1.0, u));

  float x = (u - 0.5) * uWaveLen;
  float y = pr.g * uWaveHeight * taper;
  float z = -pr.r * uWaveHeight * taper;

  // The wave peels away offshore ahead of the tube (see constants.ts BEND).
  float ahead = min(120.0, max(0.0, uCamU - u - uBendLead) * uWaveLen);
  z += uBendSlope * ahead + uBendK * ahead * ahead;

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

  float cut = cutAt(clamp((u - uFront) / uBreakWidth, 0.0, 1.0));
  vU = u; vS = s; vP = p; vPhi = phi;
  vCut = 1.0 - smoothstep(cut - 0.05, cut, s);
  vEdge = smoothstep(cut - 0.14, cut - 0.02, s) * step(cut, 0.99);
  vNrm = nrm;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform float uTime, uOpacity;
uniform vec3 uDeep, uMid, uFace, uLit, uFoam, uSky, uFog, uSun, uSunDir;
uniform float uFogNear, uFogFar;

varying float vU, vS, vP, vPhi, vCut, vEdge;
varying vec3 vWorld;
varying vec3 vNrm;

${noiseGLSL}

void main(){
  vec3 N = normalize(vNrm);
  vec3 V = normalize(cameraPosition - vWorld);
  bool flipped = dot(N, V) < 0.0;
  if (flipped) N = -N;

  // Water body: near-black navy in the trough, bluer up the face.
  vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.5, vS));
  col = mix(col, uFace, smoothstep(0.4, 0.86, vS));

  // Fine surface texture, running with the face.
  // Flow lines run *down* the face: dense along the wave, sparse up it.
  float ripple = fbm(vec2(vU * 560.0, vS * 11.0) + vec2(0.0, uTime * 0.25));
  float ripple2 = fbm(vec2(vU * 140.0, vS * 40.0) - uTime * 0.15);
  // Past horizontal the sheet is the roof of the tube — but the roof has two
  // sides. Seen from underneath (the tube's interior) it is dark streaked
  // water; seen from outside, the same surface is the whitewater on top of
  // the wave. The angle alone cannot tell them apart; the facing can.
  float curled = smoothstep(1.7, 3.1, vPhi);
  float inside = curled * (flipped ? 0.0 : 1.0);
  float outer = curled * (flipped ? 1.0 : 0.0);
  float roofStreak = fbm(vec2(vU * 9.0, vS * 26.0) + vec2(uTime * 0.25, 0.0));
  vec3 roof = mix(uDeep * 2.0, uMid * 1.25, 0.22 * smoothstep(0.4, 0.8, roofStreak));
  col = mix(col, roof, inside * 0.85);
  col += uSky * 0.05 * inside;

  // Backlight. The lip is thin water between the eye and a sun sitting on the
  // horizon, so it glows amber from behind — the single most important cue in
  // the reference. Strongest where the sheet is thinnest and the sun is
  // behind it.
  float thin = smoothstep(0.72, 0.98, vS) * smoothstep(0.15, 0.7, vP);
  float behind = pow(clamp(-dot(V, uSunDir) * 0.5 + 0.5, 0.0, 1.0), 4.0);
  col += uLit * thin * behind * 0.55;

  // Rim along the edge of the lip.
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  col += uLit * rim * thin * 0.3;

  // Warm key from the sun on whatever faces it — the back of a distant wave
  // is dark against the sky in the reference, but never black.
  float key = clamp(dot(N, uSunDir), 0.0, 1.0);
  col += uLit * key * 0.12 * (1.0 - inside);
  // Sky fill so the face reads as deep blue, not black, from the shoreward side.
  col += uSky * 0.07 * (1.0 - inside) * clamp(N.y * 0.5 + 0.5, 0.0, 1.0);

  // Foam.
  float grain = fbm(vec2(vU * 150.0, vS * 42.0) + uTime * 0.18);
  float fine = fbm(vec2(vU * 520.0, vS * 150.0) - uTime * 0.35);
  float lipFoam = smoothstep(0.88, 1.0, vS) * smoothstep(0.06, 0.40, vP);
  // The outside of the rolled tube is whitewater, not a dark dome: foam over
  // the top of the curl once the lip has thrown.
  float roofFoam = outer * smoothstep(0.5, 0.62, vP) * 1.2 + smoothstep(0.56, 0.66, vP) * smoothstep(0.44, 0.56, vS) * (1.0 - smoothstep(0.86, 0.96, vS)) * (1.0 - inside) * 0.6;
  float white = smoothstep(0.62, 0.92, vP);
  float streak = smoothstep(0.52, 0.88, fbm(vec2(vU * 60.0, vS * 260.0)))
               * smoothstep(0.28, 0.72, vP) * 0.6;
  // Lace of foam along the crest, just under the hanging lip.
  float lace = smoothstep(0.48, 0.66, fbm(vec2(vU * 300.0, vS * 70.0) + uTime * 0.1));
  float f = clamp(lipFoam * 1.05 + white + streak + roofFoam * (0.7 + 0.5 * lace) + vEdge * (0.35 + 0.85 * lace), 0.0, 1.0);
  f *= 0.40 + 0.75 * grain + 0.25 * fine;
  f = clamp(f * (0.75 + 0.45 * fine), 0.0, 1.0);
  // Foam facing the sun is lit cream; in the tube's shadow it goes dusky.
  float foamLit = clamp(dot(N, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
  vec3 foamCol = mix(uFoam * 0.55, uFoam, foamLit);
  col = mix(col, foamCol, f);

  // Sun glints on the face, shattered by the ripple.
  vec3 R = reflect(-V, N);
  float glint = pow(clamp(dot(R, uSunDir), 0.0, 1.0), 40.0);
  col += uSun * glint * (0.2 + 0.8 * ripple) * 0.6 * (1.0 - f);

  // Sky in glancing angles.
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.5);
  col = mix(col, uSky, fres * 0.22 * (1.0 - f * 0.8) * (1.0 - inside));

  float d = length(cameraPosition - vWorld);
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));

  float tail = 1.0 - smoothstep(0.84, 1.0, vS) * (1.0 - smoothstep(0.22, 0.48, vP));
  gl_FragColor = vec4(col, uOpacity * tail * vCut);
}
`;

export type WaveHandle = { front: number; camU: number; chop: number; opacity: number };

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
      uCamU: { value: 1 },
      uBendK: { value: BEND.k },
      uBendSlope: { value: BEND.slope },
      uBendLead: { value: BEND.lead },
      uOpacity: { value: 1 },
      uDeep: { value: new THREE.Color(palette.waterDeep) },
      uMid: { value: new THREE.Color(palette.waterMid) },
      uFace: { value: new THREE.Color(palette.waterFace) },
      uLit: { value: new THREE.Color(palette.waterLit) },
      uFoam: { value: new THREE.Color(palette.foam) },
      uSky: { value: new THREE.Color(palette.skyMid) },
      uFog: { value: new THREE.Color(palette.skyHorizon) },
      uSun: { value: new THREE.Color(palette.sun) },
      uSunDir: { value: new THREE.Vector3(...SUN_DIR).normalize() },
      uFogNear: { value: 30 },
      uFogFar: { value: 420 },
    }),
    [profile]
  );

  useFrame((_, dt) => {
    const u = mat.current.uniforms;
    u.uTime.value += dt;
    u.uFront.value = handle.current.front;
    u.uCamU.value = handle.current.camU;
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
