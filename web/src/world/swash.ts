import * as THREE from 'three';
import { L } from './layout';
import { shoreAt, groundH } from './venice';
import { NOISE } from './glsl';

/**
 * The swash: what the water does on the sand. Each front that reaches the
 * beach sends a thin translucent sheet running up the slope, which stalls and
 * drains back. Different waves run up different distances, and it never does
 * the same thing all along the beach. Just the sheet: no wet stain left
 * behind and no drawn edge, so the sand shows through and the only hard white
 * line on the beach is the sea's own rim.
 *
 * A ribbon over the sand along the waterline, following the beach's bend; the
 * run-up is an analytic function of time.
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
  // Covered right now: a thin sheet of water on the sand, soft at its front.
  float covered = 1.0 - smoothstep(now - 0.4, now + 0.1, d);
  float onSand = smoothstep(-1.5, 0.5, d);   // only above the waterline; the sea covers the rest
  // A little foam riding on the sheet, thinning toward its front.
  float lace = covered * smoothstep(0.6, 0.85, vnoise2(vec2(vWorld.x * 1.3, d * 1.1 + uTime * 0.2))) * (1.0 - smoothstep(now - 1.0, now, d)) * 0.5;
  vec3 col = mix(mix(uWet, uSheen, 0.6), uFoam, lace);
  float a = covered * 0.3;
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
