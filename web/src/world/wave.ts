import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { clamp01, hash, lerp, smoothstep } from './math';
import { oceanH } from './ocean';
import { NOISE } from './glsl';

/**
 * The wave as a solid, smooth.
 *
 * Every cross-section is a closed polygon of water — back, crest, lip, the
 * underside of the lip, the face, the trough, and the bed underneath — run
 * through a closed spline and lofted along the wave line with shared vertices,
 * so it shades smoothly and reflects the sky like the sea it grows out of. Its
 * skirt extends into the sea and rides the same swell function the ocean uses,
 * so the two are one body of water.
 *
 * Keys are polygons in units of wave height, [n toward shore, y], keyed against
 * the break phase p (0 swell → 1 whitewater). The break front sweeps p along x.
 */
const RING = 48;
const KEYS: { p: number; r: number[][] }[] = [
  { p: 0.0, r: [[-2.4,0],[-1.1,0.16],[-0.7,0.3],[-0.35,0.38],[0,0.4],[0.2,0.39],[0.4,0.36],[0.55,0.31],[0.62,0.28],[0.7,0.25],[0.78,0.21],[0.9,0.14],[1.05,0.07],[1.2,0.02],[1.5,0],[2.0,0],[2.5,0],[2.5,-1.2],[0,-1.2],[-2.4,-1.2]] },
  { p: 0.4, r: [[-2.4,0],[-1.1,0.3],[-0.7,0.62],[-0.35,0.9],[0,1.0],[0.18,1.02],[0.34,0.98],[0.42,0.9],[0.4,0.84],[0.36,0.78],[0.34,0.7],[0.36,0.45],[0.45,0.2],[0.6,0.05],[1.0,0],[1.6,0],[2.5,0],[2.5,-1.2],[0,-1.2],[-2.4,-1.2]] },
  { p: 0.6, r: [[-2.4,0],[-1.1,0.3],[-0.7,0.62],[-0.35,0.9],[0,1.0],[0.4,1.06],[0.85,0.96],[1.25,0.58],[1.16,0.42],[0.85,0.78],[0.42,0.84],[0.3,0.5],[0.35,0.22],[0.55,0.06],[1.0,0],[1.7,0],[2.5,0],[2.5,-1.2],[0,-1.2],[-2.4,-1.2]] },
  { p: 0.82, r: [[-2.4,0],[-1.1,0.3],[-0.7,0.6],[-0.35,0.86],[0,0.95],[0.42,1.0],[0.9,0.84],[1.32,0.28],[1.2,0.1],[0.88,0.62],[0.44,0.76],[0.3,0.45],[0.35,0.2],[0.55,0.06],[1.0,0],[1.7,0],[2.5,0],[2.5,-1.2],[0,-1.2],[-2.4,-1.2]] },
  { p: 1.0, r: [[-2.4,0],[-1.1,0.1],[-0.7,0.2],[-0.35,0.28],[0,0.32],[0.3,0.34],[0.6,0.32],[0.9,0.27],[1.0,0.22],[0.9,0.19],[0.75,0.16],[0.7,0.11],[0.8,0.07],[1.0,0.04],[1.3,0.02],[1.8,0],[2.5,0],[2.5,-1.2],[0,-1.2],[-2.4,-1.2]] },
];

/** Each key polygon resampled through a closed spline to RING points. */
const SMOOTH: { p: number; r: Float32Array }[] = KEYS.map((k) => {
  const pts = k.r.map(([n, y]) => new THREE.Vector3(n, y, 0));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
  const r = new Float32Array(RING * 2);
  for (let j = 0; j < RING; j++) {
    const v = curve.getPoint(j / RING);
    r[j * 2] = v.x; r[j * 2 + 1] = v.y;
  }
  return { p: k.p, r };
});

/** Ring for a given phase, in units of wave height, into out[j*2], out[j*2+1]. */
export function ringAt(p: number, out: Float32Array) {
  p = clamp01(p);
  let i = 0;
  while (i < SMOOTH.length - 2 && p > SMOOTH[i + 1].p) i++;
  const a = SMOOTH[i], b = SMOOTH[i + 1];
  const k = smoothstep(a.p, b.p, p);
  for (let j = 0; j < RING * 2; j++) out[j] = lerp(a.r[j], b.r[j], k);
  return out;
}

export const SECTION_STEP = 2;

const cBody = new THREE.Color(P.waveBody);
const cFace = new THREE.Color(P.waveFace);
const cFaceLit = new THREE.Color(P.waveFaceLit);
const cLip = new THREE.Color(P.waveLip);
const cFoam = new THREE.Color(P.foam);
const cSea = new THREE.Color(P.seaMid);
const cRoof = new THREE.Color(P.waveBody).multiplyScalar(0.5);

/**
 * Colour by position around the ring (u in [0,1], following the key polygon:
 * 0-0.2 back, 0.2-0.35 crest and lip outside, 0.35-0.5 lip underside,
 * 0.5-0.65 face, 0.65-0.85 water ahead, 0.85-1 bed).
 */
let lastFoam = 0;
let foamGap = 1;
function ringColor(u: number, p: number, out: THREE.Color) {
  if (u < 0.2) out.copy(cSea).lerp(cBody, smoothstep(0.0, 0.12, u)).lerp(cFace, smoothstep(0.1, 0.2, u) * 0.5);
  else if (u < 0.35) out.copy(cFace).lerp(cLip, smoothstep(0.3, 0.35, u) * 0.6);
  else if (u < 0.5) out.copy(cLip).lerp(cRoof, smoothstep(0.35, 0.42, u));
  else if (u < 0.65) out.copy(cRoof).lerp(cFace, smoothstep(0.5, 0.55, u)).lerp(cFaceLit, smoothstep(0.55, 0.65, u) * 0.5);
  else if (u < 0.85) out.copy(cFaceLit).lerp(cSea, smoothstep(0.65, 0.75, u));
  else out.copy(cSea);
  // Foam only on the very edge of the lip as it throws (the roof of the tube
  // stays dark water), and over the whole broken section once it is whitewater.
  const tipFoam = smoothstep(0.328, 0.345, u) * (1 - smoothstep(0.355, 0.372, u)) * smoothstep(0.45, 0.65, p);
  // Whitewater: foam over the top of the broken section, water below it.
  const white = smoothstep(0.86, 0.98, p) * smoothstep(0.08, 0.2, u) * (1 - smoothstep(0.5, 0.62, u));
  lastFoam = Math.max(tipFoam, white * foamGap);
  out.lerp(cFoam, lastFoam * 0.85);
  return out;
}

const u = (j: number) => j / RING;

const waveVert = /* glsl */ `
attribute float aFoam;
attribute float aLip;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vFoam, vLip;
void main(){
  vFoam = aFoam; vLip = aLip;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

/**
 * Water the way the reference lights it: near-black body, the sky in the
 * glancing angles, the sun's path as a glint, an amber glow where the low sun
 * shines through the thin lip, and matte white foam laid over the top.
 */
const waveFrag = /* glsl */ `
uniform vec3 uDeep, uMid, uLit, uFoam, uGlint, uHor, uZenith, uFog, uSunDir, uFillDir;
uniform float uFogNear, uFogFar, uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vFoam, vLip;
${NOISE}
void main(){
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  // Fine texture over the whole surface: sampled along the wave and up it,
  // so the face gets it too, not only the flat water.
  n = ripple(n, vec2(vWorld.x, vWorld.y * 0.7 + vWorld.z), uTime, 0.22 * (1.0 - vFoam));
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 r = reflect(-v, n);

  vec3 body = mix(uDeep, uMid, clamp(n.y, 0.0, 1.0) * 0.7);
  body += uLit * clamp(dot(n, uFillDir), 0.0, 1.0) * 0.35;

  float rh = clamp(r.y, 0.0, 1.0);
  vec3 sky = mix(uHor, uZenith, smoothstep(0.0, 0.5, rh));
  // Under the roof of the tube the reflection points down into the water,
  // not at the sky: keep the inside dark.
  sky = mix(uDeep * 0.7, sky, smoothstep(-0.3, 0.05, r.y));
  float fres = 0.09 + 0.91 * pow(1.0 - max(dot(n, v), 0.0), 4.5);
  vec3 col = mix(body, sky, fres * 0.6);

  float s = max(dot(r, uSunDir), 0.0);
  col += uGlint * (pow(s, 200.0) * 1.0 + pow(s, 40.0) * 0.14 + pow(s, 12.0) * 0.08);

  // Sun through the thin lip: only where the sun is behind the surface and
  // the viewer in front of it, so the roof of the tube stays dark.
  float back = clamp(-dot(n, uSunDir), 0.0, 1.0);
  float through = pow(clamp(dot(-v, uSunDir) * 0.5 + 0.5, 0.0, 1.0), 3.0) * back;
  col += uGlint * vLip * through * 0.7;
  col += uGlint * vLip * pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.3;

  // Flow lines running down the face: dense along the wave, sparse up it.
  float lines = vnoise2(vec2(vWorld.x * 2.6 + vWorld.z * 0.3, vWorld.y * 0.35)) * vnoise2(vec2(vWorld.x * 0.7 + 3.0, vWorld.y * 0.12));
  col += uLit * smoothstep(0.3, 0.65, lines) * 0.1 * (1.0 - vFoam);

  // Foam: matte, a touch shaded by facing.
  vec3 foam = uFoam * (0.72 + 0.28 * clamp(n.y * 0.5 + 0.5, 0.0, 1.0));
  col = mix(col, foam, vFoam);

  float d = length(cameraPosition - vWorld);
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));
  gl_FragColor = vec4(col, 1.0);
}`;

export class Wave {
  mesh: THREE.Mesh;
  private pos: Float32Array;
  private col: Float32Array;
  private foamAttr: Float32Array;
  private lipAttr: Float32Array;
  private geo: THREE.BufferGeometry;
  private sections: number;
  private ring = new Float32Array(RING * 2);
  private tmpC = new THREE.Color();
  frontX = 200;
  time = 0;

  constructor() {
    this.sections = Math.floor(L.waveLength / SECTION_STEP) + 1;
    const nv = this.sections * RING;
    this.pos = new Float32Array(nv * 3);
    this.col = new Float32Array(nv * 3);
    this.foamAttr = new Float32Array(nv);
    this.lipAttr = new Float32Array(nv);
    const idx: number[] = [];
    for (let i = 0; i < this.sections - 1; i++) {
      for (let j = 0; j < RING; j++) {
        const j1 = (j + 1) % RING;
        const a = i * RING + j, b = (i + 1) * RING + j, c = (i + 1) * RING + j1, d = i * RING + j1;
        idx.push(a, b, c, a, c, d);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aFoam', new THREE.BufferAttribute(this.foamAttr, 1));
    this.geo.setAttribute('aLip', new THREE.BufferAttribute(this.lipAttr, 1));
    this.geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      vertexShader: waveVert,
      fragmentShader: waveFrag,
      side: THREE.DoubleSide,
      uniforms: {
        uDeep: { value: new THREE.Color(P.waveBody) },
        uMid: { value: new THREE.Color(P.waveFace) },
        uLit: { value: new THREE.Color(P.waveFaceLit) },
        uFoam: { value: new THREE.Color(P.foam) },
        uGlint: { value: new THREE.Color(P.seaGlint) },
        // What the water reflects: the sky low over the sea, deep orange, so
        // the roof of the tube stays dark rather than washing to peach.
        uHor: { value: new THREE.Color(P.horizon) },
        uZenith: { value: new THREE.Color(P.skyLow) },
        uFog: { value: new THREE.Color(P.fog) },
        uFogNear: { value: 220 },
        uFogFar: { value: 900 },
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(...L.sunDir).normalize() },
        uFillDir: { value: new THREE.Vector3(-0.3, 0.6, -0.75).normalize() },
      },
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.build();
  }

  /** Phase at a world x for the current front. Broken side is +X. */
  phaseAt(x: number) {
    const raw = (x - this.frontX) / L.breakLen;
    return clamp01(raw + (hash(Math.floor(x / 13)) - 0.5) * 0.06);
  }

  /** World position of ring point j (0..RING) at world x. */
  pointAt(x: number, j: number, out: THREE.Vector3) {
    const p = this.phaseAt(x);
    ringAt(p, this.ring);
    const H = L.waveHeight;
    const taper = this.taper(x);
    const n = this.ring[j * 2], y = this.ring[j * 2 + 1];
    const z = -n * H * taper;
    return out.set(x, y * H * taper + oceanH(x, z, this.time) * this.seaBlend(y), z);
  }

  private taper(x: number) {
    const h = L.waveLength / 2;
    return smoothstep(-h, -h + 50, x) * (1 - smoothstep(h - 50, h, x));
  }
  /** How much of the sea's swell a ring point inherits: all of it at the waterline, little at the crest. */
  private seaBlend(y: number) { return 1 - smoothstep(0.05, 0.6, y) * 0.75; }

  update(frontX: number, time: number) {
    this.frontX = frontX;
    this.time = time;
    (this.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    this.build();
  }

  private build() {
    const H = L.waveHeight;
    const x0 = -L.waveLength / 2;
    let v = 0;
    for (let i = 0; i < this.sections; i++) {
      const x = x0 + i * SECTION_STEP;
      const p = this.phaseAt(x);
      ringAt(p, this.ring);
      const taper = this.taper(x);
      for (let j = 0; j < RING; j++) {
        const n = this.ring[j * 2], y = this.ring[j * 2 + 1];
        const z = -n * H * taper;
        const froth = smoothstep(0.86, 1, p) * (u(j) > 0.08 && u(j) < 0.55 ? 1 : 0);
        const wy = y * H * taper + oceanH(x, z, this.time) * this.seaBlend(y) + froth * (hash(i, j) - 0.5) * 2.2;
        this.pos[v] = x; this.pos[v + 1] = wy; this.pos[v + 2] = z;
        foamGap = 0.55 + 0.45 * smoothstep(0.3, 0.7, hash(i * 0.5, j * 0.5) * 0.6 + hash(i, j, 2) * 0.4);
        ringColor(j / RING, p, this.tmpC);
        this.col[v] = this.tmpC.r; this.col[v + 1] = this.tmpC.g; this.col[v + 2] = this.tmpC.b;
        this.foamAttr[i * RING + j] = lastFoam;
        // Thin water: the crest and lip, where the low sun shines through.
        this.lipAttr[i * RING + j] = smoothstep(0.3, 0.33, u(j)) * (1 - smoothstep(0.37, 0.4, u(j))) * smoothstep(0.3, 0.55, p);
        v += 3;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.aFoam.needsUpdate = true;
    this.geo.attributes.aLip.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}
