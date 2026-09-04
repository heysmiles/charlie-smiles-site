import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { clamp01, hash, lerp, smoothstep } from './math';

/**
 * The wave as a solid.
 *
 * Every cross-section is a closed polygon of water — back, crest, lip, the
 * underside of the lip, the face, the trough, and the bed underneath — lofted
 * along the wave line. Because the lip has an outside and an underside, the
 * tube has a roof with thickness and a real open mouth. The polygon is keyed
 * against the break phase `p` (0 unbroken swell, 1 whitewater) and blended
 * between keys; the break front sweeps `p` along the wave.
 *
 * Ring point roles, in order:
 *   0-3 back   4 crest   5-7 lip outside (7 = tip)   8-10 lip underside
 *   11-13 face down to the trough   14-16 water ahead   17-19 the bed
 */
const RING = 20;
const KEYS: { p: number; r: number[][] }[] = [
  { p: 0.0, r: [[-1.5,0],[-1.1,0.16],[-0.7,0.3],[-0.35,0.38],[0,0.4],[0.2,0.39],[0.4,0.36],[0.55,0.31],[0.62,0.28],[0.7,0.25],[0.78,0.21],[0.9,0.14],[1.05,0.07],[1.2,0.02],[1.35,0],[1.5,0],[1.65,0],[1.65,-1.2],[0,-1.2],[-1.5,-1.2]] },
  { p: 0.4, r: [[-1.5,0],[-1.1,0.3],[-0.7,0.62],[-0.35,0.9],[0,1.0],[0.18,1.02],[0.34,0.98],[0.42,0.9],[0.4,0.84],[0.36,0.78],[0.34,0.7],[0.36,0.45],[0.45,0.2],[0.6,0.05],[0.85,0],[1.1,0],[1.3,0],[1.3,-1.2],[0,-1.2],[-1.5,-1.2]] },
  { p: 0.6, r: [[-1.5,0],[-1.1,0.3],[-0.7,0.62],[-0.35,0.9],[0,1.0],[0.4,1.06],[0.85,0.96],[1.25,0.58],[1.16,0.42],[0.85,0.78],[0.42,0.84],[0.3,0.5],[0.35,0.22],[0.55,0.06],[0.9,0],[1.2,0],[1.45,0],[1.45,-1.2],[0,-1.2],[-1.5,-1.2]] },
  { p: 0.82, r: [[-1.5,0],[-1.1,0.3],[-0.7,0.6],[-0.35,0.86],[0,0.95],[0.42,1.0],[0.9,0.84],[1.32,0.28],[1.2,0.1],[0.88,0.62],[0.44,0.76],[0.3,0.45],[0.35,0.2],[0.55,0.06],[0.9,0],[1.2,0],[1.5,0],[1.5,-1.2],[0,-1.2],[-1.5,-1.2]] },
  { p: 1.0, r: [[-1.5,0],[-1.1,0.14],[-0.7,0.28],[-0.35,0.37],[0,0.42],[0.3,0.44],[0.6,0.42],[0.9,0.36],[1.0,0.3],[0.9,0.26],[0.75,0.22],[0.7,0.15],[0.8,0.09],[1.0,0.05],[1.2,0.02],[1.4,0],[1.6,0],[1.6,-1.2],[0,-1.2],[-1.5,-1.2]] },
];

/** Ring for a given phase, in units of wave height: [n toward shore, y]. */
export function ringAt(p: number, out: number[][]) {
  p = clamp01(p);
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const k = smoothstep(a.p, b.p, p);
  for (let j = 0; j < RING; j++) {
    out[j][0] = lerp(a.r[j][0], b.r[j][0], k);
    out[j][1] = lerp(a.r[j][1], b.r[j][1], k);
  }
  return out;
}

export const SECTION_STEP = 4;

const cBody = new THREE.Color(P.waveBody);
const cFace = new THREE.Color(P.waveFace);
const cFaceLit = new THREE.Color(P.waveFaceLit);
const cLip = new THREE.Color(P.waveLip);
const cFoam = new THREE.Color(P.foam);
const cBed = new THREE.Color(P.seaDeep);
const cSea = new THREE.Color(P.seaMid);

const cRoof = new THREE.Color(P.waveBody).multiplyScalar(0.55);
function roleColor(j: number, p: number, out: THREE.Color) {
  if (j >= 17) out.copy(cBed);
  else if (j <= 3) out.copy(cBody).lerp(cFace, j / 3 * 0.5); // back
  else if (j <= 6) out.copy(cFace).lerp(cLip, (j - 4) / 2 * 0.5); // crest and lip outside
  else if (j <= 8) out.copy(cLip); // the tip
  else if (j <= 10) out.copy(cRoof); // underside of the lip: the tube's dark roof
  else if (j <= 13) out.copy(cFace).lerp(cFaceLit, (13 - j) / 3 * 0.5); // the face
  else out.copy(cSea); // water ahead: the open sea's colour, so the join is quiet
  // Foam on the tip as it throws; whitewater over everything once collapsed.
  const tipFoam = (j >= 6 && j <= 8 ? 1 : j === 5 || j === 9 ? 0.5 : 0) * smoothstep(0.34, 0.6, p);
  const white = smoothstep(0.86, 0.98, p) * (j >= 17 ? 0 : 1);
  out.lerp(cFoam, Math.max(tipFoam, white));
  return out;
}

export class Wave {
  mesh: THREE.Mesh;
  private pos: Float32Array;
  private col: Float32Array;
  private geo: THREE.BufferGeometry;
  private sections: number;
  private ring: number[][] = Array.from({ length: RING }, () => [0, 0]);
  frontX = 200;

  constructor() {
    this.sections = Math.floor(L.waveLength / SECTION_STEP) + 1;
    const tris = (this.sections - 1) * RING * 2;
    this.pos = new Float32Array(tris * 9);
    this.col = new Float32Array(tris * 9);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.build();
  }

  /** Phase at a world x for the current front. Broken side is +X. */
  phaseAt(x: number) {
    const raw = (x - this.frontX) / L.breakLen;
    return clamp01(raw + (hash(Math.floor(x / 11)) - 0.5) * 0.08);
  }

  /** World position of ring point j at world x. */
  pointAt(x: number, j: number, out: THREE.Vector3) {
    const p = this.phaseAt(x);
    ringAt(p, this.ring);
    const H = L.waveHeight;
    const taper = smoothstep(-L.waveLength / 2, -L.waveLength / 2 + 40, x) * (1 - smoothstep(L.waveLength / 2 - 40, L.waveLength / 2, x));
    const swell = Math.sin(x * 0.05) * 0.35 + Math.sin(x * 0.021 + 1.3) * 0.25;
    return out.set(x, this.ring[j][1] * H * taper + swell * taper, -this.ring[j][0] * H * taper);
  }

  setFront(x: number) {
    if (x === this.frontX) return;
    this.frontX = x;
    this.build();
  }

  private build() {
    const H = L.waveHeight;
    const x0 = -L.waveLength / 2;
    const ringsPos: number[][] = [];
    const ringsCol: THREE.Color[][] = [];
    for (let i = 0; i < this.sections; i++) {
      const x = x0 + i * SECTION_STEP;
      const p = this.phaseAt(x);
      ringAt(p, this.ring);
      const taper = smoothstep(x0, x0 + 40, x) * (1 - smoothstep(-x0 - 40, -x0, x));
      const swell = Math.sin(x * 0.05) * 0.35 + Math.sin(x * 0.021 + 1.3) * 0.25;
      const rp: number[] = [];
      const rc: THREE.Color[] = [];
      for (let j = 0; j < RING; j++) {
        // Facets: every vertex gets its own nudge, larger on the lip and larger
        // still once it is whitewater, so flat shading has something to catch.
        const amp = (j >= 4 && j <= 9 ? 0.7 : j >= 13 ? 0.08 : 0.4) * (1 + 1.2 * smoothstep(0.86, 1, p)) * taper;
        const jy = (hash(i, j) - 0.5) * amp, jz = (hash(i, j, 3) - 0.5) * amp;
        rp.push(x, this.ring[j][1] * H * taper + swell * taper + jy, -this.ring[j][0] * H * taper + jz);
        rc.push(roleColor(j, p, new THREE.Color()));
      }
      ringsPos.push(rp);
      ringsCol.push(rc);
    }
    let v = 0;
    const put = (r: number, j: number) => {
      const rp = ringsPos[r];
      const c = ringsCol[r][j];
      this.pos[v] = rp[j * 3]; this.pos[v + 1] = rp[j * 3 + 1]; this.pos[v + 2] = rp[j * 3 + 2];
      this.col[v] = c.r; this.col[v + 1] = c.g; this.col[v + 2] = c.b;
      v += 3;
    };
    for (let i = 0; i < this.sections - 1; i++) {
      for (let j = 0; j < RING; j++) {
        const j1 = (j + 1) % RING;
        put(i, j); put(i + 1, j); put(i + 1, j1);
        put(i, j); put(i + 1, j1); put(i, j1);
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}
