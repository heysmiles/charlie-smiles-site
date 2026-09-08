import * as THREE from 'three';
import { L } from './layout';
import { DOORS } from './doors';
import { hash, smoothstep, clamp01 } from './math';
import { SpritePool, softDisc } from './sprites';

/**
 * The five doors as clouds: cumulus built from clusters of soft sprites, lit
 * from below by the low sun (peach undersides, cream tops), hanging in the
 * sky of the final view and drifting slowly left to right across it. They
 * exist only in the end state. The labels are DOM, placed over each cloud's
 * projected centre (World.doorScreen).
 */
const PER = 22;
const DRIFT = 2.4; // world units per second along the screen's right
const SPAN = 470; // wrap width along the screen's right

export class DoorClouds {
  pool: SpritePool;
  centers: THREE.Vector3[] = DOORS.map(() => new THREE.Vector3());
  /** Per-door fade (0..1): the end-state reveal times the edge fade. */
  fade: number[] = DOORS.map(() => 0);
  private anchor = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private local: Float32Array;
  private cTop = new THREE.Color(0xfff1e8);
  private cBottom = new THREE.Color(0xf0a070);
  private c = new THREE.Color();

  constructor() {
    this.pool = new SpritePool(DOORS.length * PER, softDisc(256, 0.06));
    // Not hazed: these have to read as solid cumulus against the pale top of the sky.
    this.pool.uniforms.uHazeFull.value = 0;
    this.pool.uniforms.uHazeLo.value = 1.5;
    // The sky of the end view: out along the look, well above it.
    const pos = new THREE.Vector3(...L.endCam.pos), look = new THREE.Vector3(...L.endCam.look);
    const dir = look.clone().sub(pos).normalize();
    this.right.crossVectors(dir, this.up).normalize();
    this.anchor.copy(pos).addScaledVector(dir, 300).addScaledVector(this.up, 48);
    // Each cloud's puffs: a flat-bottomed heap, wider than tall, denser in the middle.
    this.local = new Float32Array(DOORS.length * PER * 4); // dx (along right), dy, dz (along dir), size
    for (let i = 0; i < DOORS.length; i++) {
      for (let k = 0; k < PER; k++) {
        const o = (i * PER + k) * 4;
        const u = hash(i, k, 1), v = hash(i, k, 2), w = hash(i, k, 3);
        const dx = (u - 0.5) * 2 * 44 * (0.55 + 0.45 * Math.sqrt(v));
        const dy = Math.pow(v, 1.6) * 24 - 5 + (1 - Math.abs(u - 0.5) * 2) * 5;
        this.local[o] = dx; this.local[o + 1] = dy; this.local[o + 2] = (w - 0.5) * 28;
        this.local[o + 3] = 24 + hash(i, k, 4) * 26 + (1 - Math.abs(u - 0.5) * 2) * 10;
      }
    }
  }

  get points() { return this.pool.points; }

  update(progress: number, time: number) {
    const reveal = smoothstep(0.9, 0.97, progress);
    const { pos, size, alpha, color } = this.pool;
    const p = new THREE.Vector3(), dir = new THREE.Vector3().crossVectors(this.up, this.right).normalize();
    for (let i = 0; i < DOORS.length; i++) {
      // Spread along the screen's right, drifting, wrapping round.
      let off = ((i / DOORS.length) * SPAN + time * DRIFT + SPAN * 0.5) % SPAN - SPAN * 0.5;
      const edge = 1 - smoothstep(SPAN * 0.36, SPAN * 0.5, Math.abs(off));
      const bob = Math.sin(time * 0.3 + i) * 1.5;
      const center = this.centers[i].copy(this.anchor).addScaledVector(this.right, off).addScaledVector(this.up, bob + (i % 2) * 9);
      this.fade[i] = reveal * edge;
      for (let k = 0; k < PER; k++) {
        const j = i * PER + k, o = j * 4;
        p.copy(center).addScaledVector(this.right, this.local[o]).addScaledVector(this.up, this.local[o + 1]).addScaledVector(dir, this.local[o + 2]);
        pos[j * 3] = p.x; pos[j * 3 + 1] = p.y; pos[j * 3 + 2] = p.z;
        size[j] = this.local[o + 3];
        alpha[j] = this.fade[i] * (0.42 + hash(i, k, 5) * 0.3);
        // Lit from below by the low sun: peach undersides, cream tops.
        const t = clamp01((this.local[o + 1] + 5) / 24);
        this.c.copy(this.cBottom).lerp(this.cTop, t);
        color[j * 3] = this.c.r; color[j * 3 + 1] = this.c.g; color[j * 3 + 2] = this.c.b;
      }
    }
    this.pool.commit();
  }
}
