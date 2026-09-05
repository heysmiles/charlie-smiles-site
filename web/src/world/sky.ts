import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { hash } from './math';
import { SpritePool, softDisc } from './sprites';
import { HAZE } from './glsl';

const vert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const frag = /* glsl */ `
uniform vec3 uTop, uMid, uLow, uHorizon, uSun, uSunDir;
varying vec3 vDir;
${HAZE}
void main(){
  float h = vDir.y;
  vec3 col = uHorizon;
  col = mix(col, uLow, smoothstep(0.0, 0.08, h));
  col = mix(col, uMid, smoothstep(0.07, 0.26, h));
  col = mix(col, uTop, smoothstep(0.2, 0.55, h));
  col = mix(uHorizon * 0.6, col, smoothstep(-0.04, 0.0, h));
  float sd = max(dot(vDir, uSunDir), 0.0);
  col += uSun * (pow(sd, 36.0) * 0.9 + pow(sd, 6.0) * 0.3);
  col = mix(col, vec3(1.0, 0.97, 0.9), smoothstep(0.9993, 0.9997, sd));
  gl_FragColor = vec4(hazeTop(col), 1.0);
}`;

export function makeSky() {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(P.skyTop) },
      uMid: { value: new THREE.Color(P.skyMid) },
      uLow: { value: new THREE.Color(P.skyLow) },
      uHorizon: { value: new THREE.Color(P.horizon) },
      uSun: { value: new THREE.Color(P.sun) },
      uSunDir: { value: new THREE.Vector3(...L.sunDir).normalize() },
      uCream: { value: new THREE.Color(P.cream) },
      uRes: { value: new THREE.Vector2(1, 1) },
      uHazeLo: { value: 0.42 },
      uHazeFull: { value: 1 },
    },
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1800, 40, 20), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  g.add(dome);

  // Soft clouds: clusters of sprites, cream over the sun, pinker away from it.
  const pool = new SpritePool(260, softDisc(256, 0.05));
  const cream = new THREE.Color(P.cloud), pink = new THREE.Color(P.cloudShade), c = new THREE.Color();
  let i = 0;
  for (let k = 0; k < 24; k++) {
    const cx = -900 + hash(k, 1) * 1800;
    const cz = -300 + hash(k, 2) * 1200;
    const cy = 60 + hash(k, 3) * 80;
    const n = 6 + Math.floor(hash(k, 4) * 6);
    const spread = 40 + hash(k, 5) * 70;
    for (let m = 0; m < n && i < 260; m++) {
      pool.pos[i * 3] = cx + (hash(k, m, 1) - 0.5) * spread * 2;
      pool.pos[i * 3 + 1] = cy + (hash(k, m, 2) - 0.5) * 10;
      pool.pos[i * 3 + 2] = cz + (hash(k, m, 3) - 0.5) * spread * 0.6;
      pool.size[i] = 60 + hash(k, m, 4) * 90;
      pool.alpha[i] = 0.35 + hash(k, m, 5) * 0.3;
      c.copy(cream).lerp(pink, hash(k, 6));
      pool.color[i * 3] = c.r; pool.color[i * 3 + 1] = c.g; pool.color[i * 3 + 2] = c.b;
      i++;
    }
  }
  pool.commit();
  pool.points.renderOrder = -5;
  g.add(pool.points);
  return { group: g, dome, uniforms: mat.uniforms, clouds: pool.uniforms };
}
