import * as THREE from 'three';
import { hash, clamp01 } from './math';

/**
 * A miniature sandcastle, built where you tap the sand and knocked down when
 * you tap it again. Low-poly packed sand: a mound, a walled platform, four
 * corner towers with pointed tops, a keep with crenellations and a gate, a
 * little flag, and a moat scratched into the sand around it.
 *
 * Each piece is its own mesh so it can arrive on its own beat (the castle
 * goes up from the ground, piece by piece, in under a second) and fall on its
 * own when the castle crumbles: tilting over, sinking into the sand, shrinking
 * to nothing.
 */
const packed = new THREE.MeshStandardMaterial({ color: 0xd2a066, flatShading: true, roughness: 1, metalness: 0, envMapIntensity: 0.08 });
const shade = new THREE.MeshStandardMaterial({ color: 0xa87a4a, flatShading: true, roughness: 1, metalness: 0, envMapIntensity: 0.08 });
const flagMat = new THREE.MeshStandardMaterial({ color: 0xe0553a, flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
const moatMat = new THREE.MeshBasicMaterial({ color: 0xc9975c, transparent: true, opacity: 0.55, depthWrite: false });

export type Piece = { mesh: THREE.Mesh; y0: number; delay: number; fall: number; tiltX: number; tiltZ: number; drop: number };
export type Castle = { id: number; group: THREE.Group; pieces: Piece[]; born: number; dying: number };

const BUILD = 0.22; // seconds a piece takes to pop up
const CRUMBLE = 0.6; // seconds a piece takes to fall

let nextId = 1;

/** Make a castle at (x, y, z) in world space, facing +z (toward the sea). */
export function makeCastle(x: number, y: number, z: number, time: number, seed: number): Castle {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = (hash(seed, 1) - 0.5) * 0.5;
  const id = nextId++;
  const pieces: Piece[] = [];
  let order = 0;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, px: number, py: number, pz: number, fall: number, ry = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz); m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true;
    m.userData.kind = 'castle'; m.userData.ref = id;
    group.add(m);
    const k = order++;
    pieces.push({ mesh: m, y0: py, delay: k * 0.045, fall, tiltX: (hash(seed, k, 2) - 0.5) * 2.2, tiltZ: (hash(seed, k, 3) - 0.5) * 2.2, drop: 0.4 + hash(seed, k, 4) * 0.5 });
    return m;
  };
  // The moat: a ring scratched into the sand (does not fall, just fades).
  const moat = new THREE.Mesh(new THREE.RingGeometry(1.75, 2.15, 10), moatMat.clone()); // its own, so it can fade alone
  moat.rotation.x = -Math.PI / 2; moat.position.y = 0.03; moat.userData.kind = 'castle'; moat.userData.ref = id;
  group.add(moat);
  pieces.push({ mesh: moat, y0: 0.03, delay: 0, fall: 0.5, tiltX: 0, tiltZ: 0, drop: 0 });
  // The mound the castle is packed on.
  add(new THREE.CylinderGeometry(1.45, 1.75, 0.32, 9), packed, 0, 0.16, 0, 1.0);
  // The walled platform.
  add(new THREE.BoxGeometry(2.0, 0.48, 2.0), packed, 0, 0.32 + 0.24, 0, 0.85);
  // The gate on the seaward face: a dark notch.
  add(new THREE.BoxGeometry(0.34, 0.38, 0.08), shade, 0, 0.32 + 0.19, 1.0, 0.85);
  // Four corner towers with pointed tops.
  for (const [cx, cz] of [[-0.78, 0.78], [0.78, 0.78], [-0.78, -0.78], [0.78, -0.78]]) {
    add(new THREE.CylinderGeometry(0.26, 0.3, 0.9, 7), packed, cx, 0.8 + 0.45, cz, 0.3);
    add(new THREE.ConeGeometry(0.34, 0.42, 7), packed, cx, 0.8 + 0.9 + 0.21, cz, 0.2);
  }
  // The keep, its crenellations, a drip-sand spire behind.
  add(new THREE.BoxGeometry(0.92, 1.05, 0.92), packed, 0, 0.8 + 0.525, 0, 0.55);
  for (const [cx, cz] of [[-0.36, 0.36], [0.36, 0.36], [-0.36, -0.36], [0.36, -0.36], [0, 0.36], [0, -0.36], [0.36, 0], [-0.36, 0]]) {
    add(new THREE.BoxGeometry(0.17, 0.17, 0.17), packed, cx, 0.8 + 1.05 + 0.085, cz, 0.3);
  }
  // The flag: a thin pole and a little pennant.
  add(new THREE.BoxGeometry(0.04, 0.75, 0.04), shade, 0, 0.8 + 1.05 + 0.375, 0, 0.25);
  add(new THREE.BoxGeometry(0.3, 0.18, 0.02), flagMat, 0.17, 0.8 + 1.05 + 0.62, 0, 0.25);
  // Start invisible; `tick` brings the pieces up.
  for (const p of pieces) p.mesh.visible = false;
  return { id, group, pieces, born: time, dying: -1 };
}

/**
 * Advance one castle. Returns true when it is gone (crumbled away) and should
 * be removed from the scene.
 */
export function tickCastle(c: Castle, time: number) {
  if (c.dying < 0) {
    const age = time - c.born;
    for (const p of c.pieces) {
      const k = clamp01((age - p.delay) / BUILD);
      p.mesh.visible = k > 0;
      // a pop with a little overshoot, settling at 1
      const s = k >= 1 ? 1 : (k * k * (3 - 2 * k)) * (1 + 0.3 * Math.sin(k * Math.PI));
      p.mesh.scale.setScalar(Math.max(s, 0.001));
    }
    return false;
  }
  const t = time - c.dying;
  let done = true;
  for (const p of c.pieces) {
    // the high pieces go first (`fall` is a head start, 0 … 1), the mound last
    const k = clamp01((t - (1 - p.fall) * 0.35) / CRUMBLE);
    if (k < 1) done = false;
    if (p.drop === 0) { // the moat just fades
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
      continue;
    }
    const e = k * k;
    p.mesh.rotation.x = p.tiltX * e; p.mesh.rotation.z = p.tiltZ * e;
    p.mesh.position.y = p.y0 - p.drop * e * (p.y0 + 0.4);
    p.mesh.scale.setScalar(Math.max(0.001, 1 - e * 0.85));
  }
  return done;
}

export function disposeCastle(c: Castle) {
  for (const p of c.pieces) p.mesh.geometry.dispose();
  (c.pieces[0].mesh.material as THREE.Material).dispose(); // the moat's own material
}
