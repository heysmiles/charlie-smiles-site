import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { hash } from './math';

const vert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const frag = /* glsl */ `
uniform vec3 uTop, uMid, uLow, uHorizon, uSun, uSunDir;
varying vec3 vDir;
void main(){
  float h = vDir.y;
  vec3 col = uHorizon;
  col = mix(col, uLow, smoothstep(0.0, 0.08, h));
  col = mix(col, uMid, smoothstep(0.07, 0.26, h));
  col = mix(col, uTop, smoothstep(0.24, 0.7, h));
  col = mix(uHorizon * 0.6, col, smoothstep(-0.04, 0.0, h));
  float sd = max(dot(vDir, uSunDir), 0.0);
  col += uSun * (pow(sd, 36.0) * 0.9 + pow(sd, 6.0) * 0.3);
  col = mix(col, vec3(1.0, 0.97, 0.9), smoothstep(0.9993, 0.9997, sd));
  gl_FragColor = vec4(col, 1.0);
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
    },
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1800, 40, 20), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  g.add(dome);

  // Low-poly clouds: clusters of faceted blobs, lit like everything else.
  const cloudMat = new THREE.MeshStandardMaterial({ color: P.cloud, flatShading: true, roughness: 1 });
  const blob = new THREE.IcosahedronGeometry(1, 0);
  const clouds = new THREE.InstancedMesh(blob, cloudMat, 220);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  let i = 0;
  for (let c = 0; c < 26; c++) {
    const cx = -700 + hash(c, 1) * 1400;
    const cz = -500 + hash(c, 2) * 1300;
    const cy = 70 + hash(c, 3) * 60;
    const n = 5 + Math.floor(hash(c, 4) * 6);
    const spread = 18 + hash(c, 5) * 30;
    for (let k = 0; k < n && i < 220; k++) {
      pos.set(cx + (hash(c, k, 1) - 0.5) * spread * 2, cy + (hash(c, k, 2) - 0.5) * 6, cz + (hash(c, k, 3) - 0.5) * spread * 0.8);
      const r = 7 + hash(c, k, 4) * 12;
      s.set(r * 1.6, r * 0.7, r);
      q.setFromEuler(new THREE.Euler(hash(c, k, 5) * 3, hash(c, k, 6) * 3, 0));
      m.compose(pos, q, s);
      clouds.setMatrixAt(i++, m);
    }
  }
  clouds.count = i;
  clouds.instanceMatrix.needsUpdate = true;
  g.add(clouds);
  return g;
}
