import * as THREE from 'three';
import { L } from './layout';
import { shoreAt, groundH } from './venice';
import { NOISE } from './glsl';

/**
 * The swash: what the water does on the sand. Each front that reaches the
 * beach sends a thin sheet running up the slope — a white edge leading it —
 * which stalls, drains back, and leaves the sand dark and wet where it got
 * to; the stain takes a few seconds to melt away. Different waves run up
 * different distances, and it never does the same thing all along the beach.
 *
 * A ribbon over the sand along the waterline, following the beach's bend,
 * with a shader that keeps its own history: the run-up is an analytic
 * function of time, so "was this spot under water in the last few seconds"
 * is answered by sampling it at a handful of past moments.
 */
const vert = /* glsl */ `
varying vec3 vWorld;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const frag = /* glsl */ `
uniform float uTime, uShoreZ, uVeniceX;
uniform vec3 uFoam, uWet, uSheen;
varying vec3 vWorld;
${NOISE}
// Where the run-up has reached, measured inland from the visible waterline, at time t.
float runup(float x, float t, float jag){
  float phase = t * 0.28 + jag * 0.16;      // the ocean's front phase at the sand
  float u = fract(phase);
  float pulse = u < 0.28 ? u / 0.28 : 1.0 - (u - 0.28) / 0.72;   // a quick run-up, a slower drain
  pulse = pulse * pulse * (3.0 - 2.0 * pulse);
  float reach = 1.0 + 3.2 * vnoise2(vec2(x * 0.03, floor(phase) * 0.7)) * (0.6 + 0.4 * vnoise2(vec2(x * 0.11, floor(phase) * 1.9)));
  return reach * pulse;
}
void main(){
  float shoreZ = uShoreZ + 95.0 * smoothstep(250.0, 1000.0, -(vWorld.x - uVeniceX));
  float d = (shoreZ - vWorld.z) + 5.0;     // inland from the visible waterline
  float jag = vnoise2(vec2(vWorld.x * 0.11, uTime * 0.05)) * 3.5 + vnoise2(vec2(vWorld.x * 0.4, 7.0)) * 1.2;
  float ragged = (vnoise2(vec2(vWorld.x * 0.5, 3.0)) - 0.5) * 0.8;   // the edge is never a straight line
  float now = runup(vWorld.x, uTime, jag) + ragged;
  // Covered right now: a thin sheet of water on the sand, a white edge leading it.
  float covered = 1.0 - smoothstep(now - 0.3, now + 0.1, d);
  float edge = smoothstep(now - 0.7, now - 0.2, d) * (1.0 - smoothstep(now + 0.0, now + 0.35, d));
  // Been under water lately: the wet stain, strongest where it just drained, melting over ~3.5 s.
  float wet = 0.0;
  for (int k = 0; k < 10; k++) {
    float tk = uTime - float(k) * 0.35;
    float jk = vnoise2(vec2(vWorld.x * 0.11, tk * 0.05)) * 3.5 + vnoise2(vec2(vWorld.x * 0.4, 7.0)) * 1.2;
    float r = runup(vWorld.x, tk, jk) + ragged;
    float was = 1.0 - smoothstep(r - 0.3, r + 0.2, d);
    wet = max(wet, was * pow(1.0 - float(k) / 10.0, 1.3));
  }
  // The band just above the waterline is always damp.
  wet = max(wet, (1.0 - smoothstep(0.0, 1.2, d)) * 0.5);
  float onSand = smoothstep(-1.5, 0.5, d);   // only above the waterline; the sea covers the rest
  // Foam left behind as the sheet drains: a lace that thins out with the stain.
  float lace = wet * (1.0 - covered) * smoothstep(0.55, 0.8, vnoise2(vec2(vWorld.x * 1.3, d * 1.1 + uTime * 0.2))) * 0.5;
  vec3 col = uWet;
  float a = wet * 0.32;
  col = mix(col, uSheen, covered * 0.6); a = max(a, covered * 0.3);
  col = mix(col, uFoam, max(edge, lace)); a = max(a, max(edge * 0.7, lace * 0.45));
  // A small thing: translucent, and strongest at the waterline, bleeding away
  // to nothing up the sand so it never reads as a band laid on top.
  float fade = 1.0 - smoothstep(-0.5, 4.5, d);
  gl_FragColor = vec4(col, a * onSand * fade);
}`;

export function makeSwash() {
  const X = L.veniceX;
  const x0 = X - 980, x1 = X + 420, dx = 2.5;
  const dIn = [-10, -8, -6, -4.5, -3, -1.8, -0.8, 0, 0.8, 1.8, 3, 4.5, 6, 8, 10, 12.5, 15];
  const nx = Math.floor((x1 - x0) / dx) + 1, nz = dIn.length;
  const pos = new Float32Array(nx * nz * 3);
  const idx: number[] = [];
  for (let i = 0; i < nx; i++) {
    const x = x0 + i * dx, s = shoreAt(x);
    for (let j = 0; j < nz; j++) {
      const z = s - (dIn[j] - 5); // d (inland from the visible waterline) = shoreZ - z + 5
      const o = (i * nz + j) * 3;
      pos[o] = x; pos[o + 1] = groundH(x, z) + 0.07; pos[o + 2] = z;
      if (i < nx - 1 && j < nz - 1) { const a = i * nz + j, b = a + nz, c = b + 1, d = a + 1; idx.push(a, b, c, a, c, d); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: {
      uTime: { value: 0 }, uShoreZ: { value: L.shoreZ }, uVeniceX: { value: L.veniceX },
      uFoam: { value: new THREE.Color(0xfff6ec) }, uWet: { value: new THREE.Color(0x6a4a30) }, uSheen: { value: new THREE.Color(0xf3b48a) },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 2;
  mesh.userData.kind = 'water';
  return { mesh, tick: (t: number) => { mat.uniforms.uTime.value = t; } };
}
