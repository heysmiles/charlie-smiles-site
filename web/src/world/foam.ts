import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { clamp01, hash, smoothstep } from './math';
import { SpritePool, softDisc } from './sprites';
import type { Wave } from './wave';

/**
 * Spray off the lip and froth on the whitewater, as soft sprites. Each one's
 * whole life is a closed form of the break phase at its own x, so scrolling
 * back gathers the spray back into the lip.
 */
const COUNT = 1600;
const LIP_J = 15; // ring index near the lip's tip
const CREST_J = 11; // ring index on top of the crest

export class Foam {
  pool: SpritePool;
  private v = new THREE.Vector3();
  private cFoam = new THREE.Color(P.foam);
  private cWarm = new THREE.Color(P.seaGlint);
  private c = new THREE.Color();

  constructor() {
    this.pool = new SpritePool(COUNT, softDisc(128, 0.1));
  }

  get points() { return this.pool.points; }

  update(wave: Wave) {
    const { pos, size, alpha, color } = this.pool;
    for (let k = 0; k < COUNT; k++) {
      const x = -L.waveLength / 2 + hash(k, 7) * L.waveLength;
      const p = wave.phaseAt(x);
      const spray = k % 3 !== 0;
      let a = 0, s = 0;
      if (spray) {
        // Thrown up and shoreward off the lip, then down; the plume that
        // stands over a breaking wave from a distance.
        const age = clamp01((p - 0.44) / 0.5);
        if (age > 0 && age < 1) {
          wave.pointAt(x, LIP_J, this.v);
          this.v.x += (hash(k, 1) - 0.5) * 10 * age;
          this.v.y += (6 + hash(k, 2) * 12) * age - 14 * age * age + 1.5;
          this.v.z -= (2 + hash(k, 3) * 10) * age;
          a = (1 - age) * (0.3 + hash(k, 5) * 0.4) * smoothstep(0, 0.12, age);
          s = 3 + hash(k, 4) * 5 + age * 5;
        }
      } else {
        const w = smoothstep(0.82, 0.94, p);
        if (w > 0) {
          wave.pointAt(x, CREST_J, this.v);
          this.v.x += (hash(k, 1) - 0.5) * 6;
          this.v.y += hash(k, 6) * 2.2 + 0.5;
          this.v.z += (hash(k, 3) - 0.5) * 4;
          a = w * (0.4 + hash(k, 5) * 0.4);
          s = 5 + hash(k, 4) * 7;
        }
      }
      pos[k * 3] = this.v.x; pos[k * 3 + 1] = a > 0 ? this.v.y : -50; pos[k * 3 + 2] = this.v.z;
      alpha[k] = a; size[k] = s;
      this.c.copy(this.cFoam).lerp(this.cWarm, hash(k, 9) * 0.25);
      color[k * 3] = this.c.r; color[k * 3 + 1] = this.c.g; color[k * 3 + 2] = this.c.b;
    }
    this.pool.commit();
  }
}
