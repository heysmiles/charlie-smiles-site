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
uniform float uTime;
uniform vec3 uA, uF, uS;
varying vec3 vWorld;
varying vec3 vNormal;
void main(){
  vec3 p = position;
  float x = p.x, z = -p.y; // the plane is rotated flat; local y is world -z
  float h = sin(x * uF.x + uTime * uS.x) * uA.x
          + sin(z * uF.y - uTime * uS.y) * uA.y
          + sin((x + z) * uF.z + uTime * uS.z) * uA.z;
  float dhx = cos(x * uF.x + uTime * uS.x) * uA.x * uF.x + cos((x + z) * uF.z + uTime * uS.z) * uA.z * uF.z;
  float dhz = cos(z * uF.y - uTime * uS.y) * uA.y * uF.y + cos((x + z) * uF.z + uTime * uS.z) * uA.z * uF.z;
  p.z += h;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(vec3(-dhx, 1.0, -dhz));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const frag = /* glsl */ `
uniform float uTime, uShoreZ;
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

  // Foam rolling up the beach.
  float sd = vWorld.z - uShoreZ;
  float band = smoothstep(-1.0, 1.0, sd) * (1.0 - smoothstep(3.0, 9.0, sd));
  float roll = 0.5 + 0.5 * sin(sd * 0.9 - uTime * 1.2 + sin(vWorld.x * 0.13) * 1.5);
  col = mix(col, uFoam, band * smoothstep(0.55, 0.95, roll) * 0.55);

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
      uA: { value: new THREE.Vector3(SWELL.a1, SWELL.a2, SWELL.a3) },
      uF: { value: new THREE.Vector3(SWELL.f1, SWELL.f2, SWELL.f3) },
      uS: { value: new THREE.Vector3(SWELL.s1, SWELL.s2, SWELL.s3) },
      uShoreZ: { value: L.shoreZ },
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
