import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { clamp01, hash, smoothstep } from './math';
import type { Wave } from './wave';

/**
 * Whitewater and spray as faceted blobs. Each blob's whole life is a closed
 * form of the break phase at its own x, so scrolling back gathers the spray
 * back into the lip.
 */
const COUNT = 700;

export class Foam {
  mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private v = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  constructor() {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: P.foam, flatShading: true, roughness: 1 });
    this.mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    this.mesh.frustumCulled = false;
  }

  update(wave: Wave) {
    for (let k = 0; k < COUNT; k++) {
      const x = -L.waveLength / 2 + hash(k, 7) * L.waveLength;
      const p = wave.phaseAt(x);
      const spray = k % 2 === 0;
      let scale = 0;
      if (spray) {
        // Off the lip: thrown up and shoreward, then down.
        const age = clamp01((p - 0.48) / 0.4);
        if (age > 0 && age < 1) {
          wave.pointAt(x, 6, this.v);
          const a = age;
          this.v.x += (hash(k, 1) - 0.5) * 9;
          this.v.y += (7 + hash(k, 2) * 9) * a - 16 * a * a;
          this.v.z -= (3 + hash(k, 3) * 10) * a;
          scale = (0.45 + hash(k, 4) * 0.9) * (1 - a * 0.6);
        }
      } else {
        // Riding on the whitewater mound.
        const w = smoothstep(0.84, 0.94, p);
        if (w > 0) {
          const j = 4 + Math.floor(hash(k, 5) * 4);
          wave.pointAt(x, j, this.v);
          this.v.x += (hash(k, 1) - 0.5) * 4;
          this.v.y += hash(k, 6) * 1.2 + 0.4;
          scale = (0.8 + hash(k, 4) * 1.6) * w;
        }
      }
      this.s.setScalar(scale);
      this.q.setFromEuler(new THREE.Euler(hash(k, 8) * 3, hash(k, 9) * 3, 0));
      this.m.compose(scale > 0 ? this.v : this.tmp.set(0, -50, 0), this.q, this.s);
      this.mesh.setMatrixAt(k, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
