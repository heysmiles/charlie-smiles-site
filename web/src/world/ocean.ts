import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { NOISE, HAZE, creamRaw } from './glsl';

/**
 * The open sea: summed sines with analytic normals, so it shades smoothly,
 * reflects the sky through the scene's environment, and the wave can ride the
 * very same swell (see oceanH) and be one body of water with it.
 */
export const SWELL = { a1: 0.42, f1: 0.045, s1: 0.9, a2: 0.28, f2: 0.062, s2: 1.25, a3: 0.22, f3: 0.028, s3: 0.55 };

/** Sea surface height at world (x, z), time t. Mirrors the vertex shader exactly. */
export function oceanH(x: number, z: number, t: number) {
  const W = SWELL;
  return (
    Math.sin(x * W.f1 + t * W.s1) * W.a1 +
    Math.sin(z * W.f2 - t * W.s2) * W.a2 +
    Math.sin((x + z) * W.f3 + t * W.s3) * W.a3
  );
}

const vert = /* glsl */ `
uniform float uTime, uShoreZ, uVeniceX;
uniform vec3 uA, uF, uS;
varying vec3 vWorld;
varying vec3 vNormal;
void main(){
  // Evaluate the swell in WORLD x/z — the same coordinates the wave's oceanH
  // uses — so the wave's skirt and the sea are one surface (the plane is
  // translated, so local coordinates would be offset from the wave's).
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float x = wp.x, z = wp.z;
  float h = sin(x * uF.x + uTime * uS.x) * uA.x
          + sin(z * uF.y - uTime * uS.y) * uA.y
          + sin((x + z) * uF.z + uTime * uS.z) * uA.z;
  float dhx = cos(x * uF.x + uTime * uS.x) * uA.x * uF.x + cos((x + z) * uF.z + uTime * uS.z) * uA.z * uF.z;
  float dhz = cos(z * uF.y - uTime * uS.y) * uA.y * uF.y + cos((x + z) * uF.z + uTime * uS.z) * uA.z * uF.z;
  wp.y += h;
  vWorld = wp.xyz;
  vNormal = normalize(vec3(-dhx, 1.0, -dhz));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const frag = /* glsl */ `
uniform float uTime, uShoreZ, uVeniceX;
uniform vec3 uDeep, uMid, uFoam, uGlint, uSunDir, uFog, uHor, uZenith;
uniform float uFogNear, uFogFar;
varying vec3 vWorld;
varying vec3 vNormal;
${NOISE}
${HAZE}
void main(){
  vec3 v = normalize(cameraPosition - vWorld);
  float d = length(cameraPosition - vWorld);
  // Ripples fade with distance so the far sea does not shimmer with aliasing.
  vec3 n = ripple(normalize(vNormal), vWorld.xz, uTime, 0.5 * (1.0 - smoothstep(120.0, 400.0, d)));
  vec3 r = reflect(-v, n);
  // Reflected sky: amber at the horizon, warmer and brighter toward the sun.
  float rh = clamp(r.y, 0.0, 1.0);
  vec3 sky = mix(uHor, uZenith, smoothstep(0.0, 0.5, rh));
  float toSun = pow(max(dot(normalize(vec3(r.x, 0.0, r.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 4.0);
  sky = mix(sky, uGlint, toSun * 0.5 * (1.0 - rh));
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 body = mix(uDeep, uMid, clamp(n.y * n.y, 0.0, 1.0) * 0.6);
  vec3 col = mix(body, sky, fres * 0.85);
  float s = max(dot(r, uSunDir), 0.0);
  col += uGlint * (pow(s, 200.0) * 1.1 + pow(s, 40.0) * 0.22 + pow(s, 10.0) * 0.06);

  // The shore break. The beach slopes up under the water (see venice.ts
  // groundH), so the water thins over wet sand toward the line where the
  // sand rises through the surface; foam fronts roll up that slope one after
  // another and spread into a lacy sheet behind each crest.
  float shoreZ = uShoreZ + 95.0 * smoothstep(250.0, 1000.0, -(vWorld.x - uVeniceX));
  float sd = vWorld.z - shoreZ; // seaward distance from the nominal waterline
  float sandH = -2.4 + 3.65 * smoothstep(-34.0, 14.0, -sd) - max(0.0, sd - 34.0) * 0.1;
  float depth = max(0.0, vWorld.y - sandH);
  float near = 1.0 - smoothstep(10.0, 26.0, sd); // only the last stretch to the sand
  float shallow = (1.0 - smoothstep(0.0, 2.6, depth)) * near;
  // Wet sand seen through thin water.
  col = mix(col, vec3(0.62, 0.45, 0.28), shallow * 0.75 * smoothstep(-2.0, 10.0, sd));
  // Fronts: successive crests marching shoreward, each a bright edge with a
  // ragged foam sheet trailing behind, only where the water is shallow.
  float jag = vnoise2(vec2(vWorld.x * 0.11, uTime * 0.05)) * 3.5 + vnoise2(vec2(vWorld.x * 0.4, 7.0)) * 1.2;
  float ph = (sd + jag) * 0.16 + uTime * 0.28;
  float f = fract(ph);
  float edge = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.05, 0.16, f));
  float sheet = (1.0 - smoothstep(0.05, 0.6, f)) * smoothstep(0.35, 0.7, vnoise2(vec2(vWorld.x * 0.9, sd * 0.9 + uTime * 0.6)) * 0.6 + vnoise2(vec2(vWorld.x * 2.4, sd * 2.4)) * 0.4);
  float zone = smoothstep(-3.0, 3.0, sd) * (1.0 - smoothstep(12.0, 30.0, sd));
  float foamAmt = clamp(edge * 0.9 + sheet * 0.55, 0.0, 1.0) * zone * (0.35 + 0.65 * shallow);
  // Breakers: here and there a crest stands up and breaks as it reaches the
  // shallows — a thicker white lip, a darker steepening face just shoreward
  // of it, a spit of spray on top. Which crests, and where along the beach,
  // drifts with time, so it never breaks everywhere at once.
  float where = smoothstep(0.5, 0.78, vnoise2(vec2(vWorld.x * 0.022 + uTime * 0.02, floor(ph) * 0.41)) * 0.7 + vnoise2(vec2(vWorld.x * 0.09, floor(ph) * 1.3)) * 0.3);
  float bzone = smoothstep(2.0, 6.0, sd) * (1.0 - smoothstep(9.0, 20.0, sd));
  float lip = smoothstep(0.0, 0.03, f) * (1.0 - smoothstep(0.05, 0.24, f));
  float face = smoothstep(0.8, 0.97, f) * (1.0 - smoothstep(0.985, 1.0, f));
  float spray = lip * step(0.62, vnoise2(vec2(vWorld.x * 5.0, sd * 4.0 + uTime * 2.0)));
  float brk = where * bzone;
  col = mix(col, uDeep * 0.55, face * brk * 0.7);
  foamAmt += (lip * 0.95 + spray * 0.6) * brk;
  // The waterline. Where the water is thinnest it is foam, always: a solid
  // white edge keyed to depth so it rides with the swell, thicker than the
  // fronts, then a ragged lace fraying back from it into the shallows.
  float rim = (1.0 - smoothstep(0.0, 0.8, depth)) * near;
  float lace = (1.0 - smoothstep(0.5, 2.6, depth)) * near * smoothstep(0.3, 0.7, vnoise2(vec2(vWorld.x * 1.6, uTime * 0.7 + sd)) * 0.7 + vnoise2(vec2(vWorld.x * 4.0, sd * 3.0)) * 0.3);
  foamAmt = max(foamAmt, rim * 0.98);
  foamAmt += lace * 0.6;
  col = mix(col, uFoam, clamp(foamAmt, 0.0, 0.98));

  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));
  gl_FragColor = vec4(hazeTop(col), 1.0);
}`;

export function makeOcean() {
  const geo = new THREE.PlaneGeometry(2400, 1400, 320, 190);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uTime: { value: 0 },
      uShoreZ: { value: L.shoreZ },
      uVeniceX: { value: L.veniceX },
      uA: { value: new THREE.Vector3(SWELL.a1, SWELL.a2, SWELL.a3) },
      uF: { value: new THREE.Vector3(SWELL.f1, SWELL.f2, SWELL.f3) },
      uS: { value: new THREE.Vector3(SWELL.s1, SWELL.s2, SWELL.s3) },
      uDeep: { value: new THREE.Color(P.seaDeep) },
      uMid: { value: new THREE.Color(P.seaMid) },
      uFoam: { value: new THREE.Color(P.foam) },
      uGlint: { value: new THREE.Color(P.seaGlint) },
      uHor: { value: new THREE.Color(P.skyLow) },
      uZenith: { value: new THREE.Color(P.skyMid) },
      uFog: { value: new THREE.Color(P.fog) },
      uFogNear: { value: 220 },
      uFogFar: { value: 900 },
      uSunDir: { value: new THREE.Vector3(...L.sunDir).normalize() },
      uCream: { value: creamRaw() },
      uRes: { value: new THREE.Vector2(1, 1) },
      uHazeLo: { value: 1.5 },
      uHazeFull: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0, 200);
  mesh.frustumCulled = false;
  return { mesh, tick: (t: number) => { mat.uniforms.uTime.value = t; } };
}
