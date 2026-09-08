import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { fbm2, hash, smoothstep, lerp } from './math';

/**
 * Venice Beach from the water, golden hour, low-poly. Built from what the
 * place actually is when you look at it from a board off Windward:
 *
 *  - a very wide, flat beach — the widest stretch of sand on the bay — with
 *    the bike path snaking through it and the blue LA County lifeguard towers
 *    spaced along the waterline
 *  - Ocean Front Walk: a pale promenade with a dense row of low, loud
 *    buildings behind it, murals and awnings, a few taller hotels rising at
 *    Windward (the Erwin, the Venice V), tall skinny fan palms along its edge
 *  - the Recreation Center right on the sand at Windward: the skate park's
 *    concrete bowls, Muscle Beach's blue-and-white outdoor gym, the handball
 *    walls, the basketball and paddle-tennis courts
 *  - the breakwater's dark rocks in the water off Windward
 *  - the Venice Fishing Pier at Washington to the south: long, straight,
 *    concrete, on pilings, a round end
 *  - far north (screen-left): the Santa Monica Pier with its wheel under the
 *    Malibu range; far south (screen-right): the Marina del Rey towers
 *
 * Distances along the beach are compressed so all of it fits one frame from
 * the water; Windward is at x = L.veniceX.
 */
const X = L.veniceX;
const SHORE = L.shoreZ; // waterline
const WALK = SHORE - 100; // Ocean Front Walk's seaward edge
const WALK_W = 14;
const ROW1 = WALK - WALK_W - 2; // seaward face of the first building row

// One material per colour, flat-shaded, and one unlit set for the far things.
const mats = new Map<number, THREE.MeshStandardMaterial>();
const mat = (c: number) => {
  let m = mats.get(c);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.25 }); mats.set(c, m); }
  return m;
};
const farMats = new Map<number, THREE.MeshBasicMaterial>();
const farMat = (c: number) => {
  let m = farMats.get(c);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: c }); farMats.set(c, m); }
  return m;
};

const box = (g: THREE.Object3D, w: number, h: number, d: number, c: number, x: number, y: number, z: number, ry = 0, far = false) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), far ? farMat(c) : mat(c));
  m.position.set(x, y + h / 2, z); m.rotation.y = ry; g.add(m); return m;
};

/** Ground height: the beach is nearly flat, with a soft berm up to the walk, then the flat city. */
export const groundH = (x: number, z: number) => {
  const d = SHORE - z; // inland distance
  if (d < 0) return -1.5 - Math.min(-d, 60) * 0.12; // seabed
  const berm = Math.min(d, 100) * 0.018 + (fbm2(x * 0.05, z * 0.05) - 0.5) * 0.35;
  return 1.0 + berm + smoothstep(100, 118, d) * 0.4;
};

function terrain() {
  const W = 1800, D = 760;
  const geo = new THREE.PlaneGeometry(W, D, 240, 100).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  geo.translate(X, 0, SHORE + 40 - D / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const sand = new THREE.Color(P.sand), wet = new THREE.Color(P.sandWet), walk = new THREE.Color(0xd8cfc0), path = new THREE.Color(0xc9bfb0);
  const city = new THREE.Color(0x9a8f7e), sea = new THREE.Color(P.seaDeep);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, groundH(x, z));
    const d = SHORE - z;
    if (d < 0) c.copy(sea);
    else if (d < 6) c.copy(wet).lerp(sand, d / 6);
    else if (d < 100) {
      c.copy(sand).lerp(wet, (fbm2(x * 0.03, z * 0.03) - 0.5) * 0.25);
      // The bike path: a pale ribbon snaking through the sand.
      const pathZ = SHORE - 62 + Math.sin(x * 0.02) * 10 + Math.sin(x * 0.053 + 1.3) * 4;
      if (Math.abs(z - pathZ) < 2.2) c.copy(path);
    } else if (d < 100 + WALK_W) c.copy(walk);
    else c.copy(city).lerp(sand, 0.15 + fbm2(x * 0.02, z * 0.02) * 0.2);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, envMapIntensity: 0.2 }));
}

// ------------------------------------------------------------ the front row
const FRONT = [0xfaf3ea, 0xf6e7c8, 0xe8c9a0, 0xd9e6ee, 0xf2b8a2, 0xbfd8c8, 0xf0d060, 0xe9e2d6, 0xc86c4a, 0xf7c9d2, 0x9fc3d6, 0xfff7ee];
const MURAL = [0x3f7fb8, 0xe0553a, 0xf0b13c, 0x4e9c72, 0xb04f8a, 0x2c3e6b];
const AWNING = [0xd9533a, 0x3c6fae, 0xf1c232, 0x4a8b5c, 0xe8e8e8];

function frontRow(g: THREE.Group) {
  let x = X - 330;
  let k = 0;
  while (x < X + 330) {
    const w = 9 + hash(k, 1) * 14;
    const floors = hash(k, 2) < 0.55 ? 2 : hash(k, 2) < 0.9 ? 3 : 1;
    let h = floors * 3.6 + hash(k, 3) * 1.2;
    const depth = 16 + hash(k, 4) * 10;
    let c = FRONT[Math.floor(hash(k, 5) * FRONT.length)];
    const cx = x + w / 2;
    // The landmarks at Windward: Hotel Erwin (terracotta, tall for the walk,
    // rooftop bar) and the Venice V; a mid-rise condo further south.
    const dx = cx - X;
    if (Math.abs(dx + 42) < 9) { h = 21; c = 0xb9694a; }
    else if (Math.abs(dx + 60) < 7) { h = 16; c = 0xf4efe6; }
    else if (Math.abs(dx - 120) < 10) { h = 17; c = 0xe6d7c3; }
    const b = box(g, w - 0.8, h, depth, c, cx, groundH(cx, ROW1 - depth / 2), ROW1 - depth / 2);
    void b;
    const gy = groundH(cx, ROW1);
    // Parapet and a rooftop box (stair head or the Erwin's bar canopy).
    box(g, w - 0.4, 0.5, depth, 0x6f6259, cx, gy + h, ROW1 - depth / 2);
    if (h > 10) box(g, w * 0.5, 2.2, 6, 0x5a4a44, cx, gy + h + 0.5, ROW1 - depth / 2 - 2);
    // Murals: a big colour panel on many facades.
    if (hash(k, 6) < 0.45) box(g, w * (0.5 + hash(k, 7) * 0.4), h * 0.55, 0.3, MURAL[Math.floor(hash(k, 8) * MURAL.length)], cx + (hash(k, 9) - 0.5) * w * 0.3, gy + 1.2 + hash(k, 10) * 1.5, ROW1 + 0.15);
    // Ground-floor awnings and a dark shopfront band.
    box(g, w - 1.2, 1.6, 0.4, 0x3a332f, cx, gy + 1.9, ROW1 + 0.2);
    if (hash(k, 11) < 0.7) {
      const a = box(g, w - 2, 0.3, 2.6, AWNING[Math.floor(hash(k, 12) * AWNING.length)], cx, gy + 3.5, ROW1 + 1.4);
      a.rotation.x = 0.25;
    }
    // Windows: a row of dark panes per upper floor.
    for (let f = 1; f < floors; f++) {
      const n = Math.max(1, Math.floor((w - 2) / 3));
      for (let i = 0; i < n; i++) box(g, 1.4, 1.5, 0.2, 0x2f3a4a, cx - (n - 1) * 1.5 + i * 3, gy + f * 3.6 + 1.0, ROW1 + 0.12);
    }
    x += w; k++;
  }
}

function backRows(g: THREE.Group) {
  // Second row: apartments and houses, lower and quieter; then sparse blocks fading inland.
  for (let k = 0; k < 70; k++) {
    const x = X - 360 + hash(k, 21) * 720, z = ROW1 - 40 - hash(k, 22) * 24;
    const w = 8 + hash(k, 23) * 12, h = 4 + hash(k, 24) * 6, d = 10 + hash(k, 25) * 8;
    box(g, w, h, d, P.houses[Math.floor(hash(k, 26) * P.houses.length)], x, groundH(x, z), z);
  }
  for (let k = 0; k < 90; k++) {
    const x = X - 500 + hash(k, 31) * 1000, z = ROW1 - 80 - hash(k, 32) * 220;
    const w = 10 + hash(k, 33) * 18, h = 4 + hash(k, 34) * 9, d = 10 + hash(k, 35) * 14;
    const tall = hash(k, 36) < 0.08;
    box(g, w, tall ? h + 18 : h, d, tall ? 0xe6dfd3 : P.houses[Math.floor(hash(k, 37) * P.houses.length)], x, groundH(x, z), z, 0, true);
  }
}

// ------------------------------------------------------------------ palms
function palms(g: THREE.Group) {
  const trunk = new THREE.CylinderGeometry(0.28, 0.42, 1, 6);
  const frond = new THREE.BoxGeometry(0.9, 0.12, 4.2);
  frond.translate(0, 0, 2.0);
  const tm = mat(P.trunk), fm = mat(P.frond), fl = mat(P.frondLit);
  const plant = (x: number, z: number, hgt: number, seed: number) => {
    const y = groundH(x, z);
    const t = new THREE.Mesh(trunk, tm);
    t.scale.set(1, hgt, 1); t.position.set(x, y + hgt / 2, z);
    t.rotation.z = (hash(seed, 1) - 0.5) * 0.12; t.rotation.x = (hash(seed, 2) - 0.5) * 0.1;
    g.add(t);
    const top = new THREE.Vector3(x + Math.sin(t.rotation.z) * -hgt, y + hgt, z + Math.sin(t.rotation.x) * hgt);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const f = new THREE.Mesh(frond, hash(seed, i, 3) < 0.4 ? fl : fm);
      f.position.copy(top);
      f.rotation.set(-0.35 - hash(seed, i, 4) * 0.5, (i / n) * Math.PI * 2 + hash(seed, i, 5) * 0.4, 0, 'YXZ');
      g.add(f);
    }
    // The skirt of dead fronds under the crown that fan palms carry.
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 7), mat(0x8a6a3c));
    skirt.position.copy(top).y -= 0.9; g.add(skirt);
  };
  // A line along the seaward edge of the walk — the Venice signature.
  for (let x = X - 340; x < X + 340; x += 11 + hash(x, 41) * 8) plant(x + (hash(x, 42) - 0.5) * 3, WALK + 3 + (hash(x, 43) - 0.5) * 4, 15 + hash(x, 44) * 9, x);
  // Clusters on the sand around the Rec Center and toward the pier.
  for (let k = 0; k < 26; k++) plant(X - 110 + (hash(k, 45) - 0.5) * 90, SHORE - 78 + hash(k, 46) * 20, 11 + hash(k, 47) * 9, k + 900);
  for (let k = 0; k < 14; k++) plant(X + 60 + hash(k, 48) * 120, SHORE - 84 + hash(k, 49) * 14, 12 + hash(k, 50) * 8, k + 950);
}

// ------------------------------------------------------ lifeguard towers
function towers(g: THREE.Group) {
  const blue = 0x3d7ea6, white = 0xf4f6f6, wood = 0xb08a63;
  for (let x = X - 330; x <= X + 300; x += 46) {
    const z = SHORE - 18, y = groundH(x, z);
    for (const [dx, dz] of [[-1.3, -1.2], [1.3, -1.2], [-1.3, 1.2], [1.3, 1.2]]) box(g, 0.28, 2.6, 0.28, wood, x + dx, y, z + dz);
    box(g, 3.4, 0.25, 3.0, wood, x, y + 2.6, z);
    box(g, 3.0, 2.3, 2.6, blue, x, y + 2.85, z);
    box(g, 3.0, 0.7, 2.6, white, x, y + 5.15, z); // the white band under the roof
    box(g, 3.6, 0.2, 3.2, blue, x, y + 5.85, z);
    const ramp = box(g, 1.0, 0.16, 5.5, wood, x - 0.3, y + 1.3, z - 4.2); ramp.rotation.x = -0.46;
  }
}

// ---------------------------------------------------- the Rec Center at Windward
function recCenter(g: THREE.Group) {
  // Skate park: a concrete slab with bowls sunk into it and a snake run.
  const sx = X - 24, sz = SHORE - 74, gy = groundH(sx, sz);
  box(g, 40, 0.6, 24, 0xb9b3ab, sx, gy - 0.1, sz);
  for (const [bx, bz, r] of [[-11, -3, 6], [4, 4, 5], [13, -5, 4.2]] as const) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.7, 1.6, 14), mat(0x8f8a84));
    bowl.position.set(sx + bx, gy - 0.3, sz + bz); g.add(bowl);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(r, 0.35, 6, 18), mat(0xcfc9c0));
    lip.rotation.x = Math.PI / 2; lip.position.set(sx + bx, gy + 0.55, sz + bz); g.add(lip);
  }
  for (let i = 0; i < 12; i++) box(g, 0.12, 1.4, 0.12, 0x4d4d4d, sx - 20 + i * 3.6, gy + 0.5, sz - 12.3); // fence posts
  // Muscle Beach: the blue enclosure with white trim, and the equipment inside.
  const mx = X + 16, mz = SHORE - 86, my = groundH(mx, mz);
  box(g, 26, 1.0, 0.5, 0x2f6fa3, mx, my, mz + 7);
  box(g, 26, 1.0, 0.5, 0x2f6fa3, mx, my, mz - 7);
  box(g, 0.5, 1.0, 14, 0x2f6fa3, mx - 13, my, mz);
  box(g, 0.5, 1.0, 14, 0x2f6fa3, mx + 13, my, mz);
  box(g, 26, 0.25, 0.7, 0xf4f6f6, mx, my + 1.0, mz + 7);
  for (let i = 0; i < 6; i++) { // bars and racks
    const bx = mx - 10 + i * 4, bz = mz + (hash(i, 61) - 0.5) * 8;
    box(g, 0.18, 2.4 + hash(i, 62) * 1.2, 0.18, 0x2f6fa3, bx - 1, my, bz);
    box(g, 0.18, 2.4 + hash(i, 62) * 1.2, 0.18, 0x2f6fa3, bx + 1, my, bz);
    box(g, 2.3, 0.14, 0.14, 0xf4f6f6, bx, my + 2.4 + hash(i, 62) * 1.2, bz);
  }
  box(g, 8, 0.3, 5, 0x2f6fa3, mx + 8, my + 4.2, mz - 2); // the blue canopy
  for (const [dx, dz] of [[-3.6, -2.2], [3.6, -2.2], [-3.6, 2.2], [3.6, 2.2]]) box(g, 0.2, 4.2, 0.2, 0xf4f6f6, mx + 8 + dx, my, mz - 2 + dz);
  // Handball walls: tall concrete slabs, and the courts' green floors.
  for (let i = 0; i < 3; i++) box(g, 8, 5.2, 0.6, 0xc8c0b4, X + 52 + i * 10, groundH(X + 52, SHORE - 88), SHORE - 88);
  for (let i = 0; i < 2; i++) box(g, 15, 0.15, 26, 0x6f8a6a, X + 76 + i * 16, groundH(X + 76, SHORE - 80) - 0.05, SHORE - 80);
  for (let i = 0; i < 4; i++) box(g, 0.2, 3.4, 0.2, 0x4d4d4d, X + 70 + i * 8, groundH(X + 70, SHORE - 92), SHORE - 92); // hoops posts
  // Paddle-tennis courts with fences.
  for (let i = 0; i < 3; i++) box(g, 10, 0.12, 20, 0x5f7f60, X + 112 + i * 11, groundH(X + 112, SHORE - 80) - 0.05, SHORE - 80);
  for (let i = 0; i < 10; i++) box(g, 0.1, 2.8, 0.1, 0x4d4d4d, X + 106 + i * 3.6, groundH(X + 106, SHORE - 70), SHORE - 70);
}

// ----------------------------------------------------------- the breakwater
function breakwater(g: THREE.Group) {
  const rock = new THREE.DodecahedronGeometry(1, 0);
  const rm = mat(0x4a4744), rl = mat(0x6a655f);
  const place = (x: number, z: number, s: number, k: number) => {
    const m = new THREE.Mesh(rock, hash(k, 71) < 0.4 ? rl : rm);
    m.position.set(x + (hash(k, 72) - 0.5) * 1.6, -0.9 + s * 0.55 + hash(k, 73) * 0.4, z + (hash(k, 74) - 0.5) * 1.6);
    m.scale.set(s * (0.8 + hash(k, 75) * 0.6), s * 0.6, s * (0.8 + hash(k, 76) * 0.6));
    m.rotation.set(hash(k, 77) * 3, hash(k, 78) * 3, hash(k, 79) * 3);
    g.add(m);
  };
  // The groin out from the beach off Windward, then the arm parallel to the shore.
  let k = 0;
  for (let z = SHORE - 3; z < SHORE + 30; z += 1.8) for (let j = 0; j < 2; j++) place(X - 62 + (j - 0.5) * 1.8, z, 1.3 + hash(k, 80) * 0.7, k++);
  for (let x = X - 62; x < X + 8; x += 1.9) for (let j = 0; j < 2; j++) place(x, SHORE + 31 + (j - 0.5) * 2.0, 1.4 + hash(k, 81) * 0.8, k++);
}

// ----------------------------------------------------------- Venice Pier
function venicePier(g: THREE.Group) {
  const px = X + 210, y = 7.5, from = SHORE - 8, to = SHORE + 180;
  const concrete = 0xc9c4bb, rail = 0x8b8f93, piling = 0x5a5550;
  box(g, 7.5, 0.7, to - from, concrete, px, y, (from + to) / 2);
  for (let z = from + 6; z < to; z += 12) { box(g, 0.9, y + 1.5, 0.9, piling, px - 2.6, -1.5, z); box(g, 0.9, y + 1.5, 0.9, piling, px + 2.6, -1.5, z); }
  box(g, 0.14, 1.1, to - from, rail, px - 3.6, y + 0.7, (from + to) / 2);
  box(g, 0.14, 1.1, to - from, rail, px + 3.6, y + 0.7, (from + to) / 2);
  for (let z = from + 10; z < to; z += 24) { box(g, 0.16, 4.2, 0.16, 0x3a3a3a, px + 3.2, y + 0.7, z); box(g, 0.7, 0.4, 0.7, 0xfff1c8, px + 3.2, y + 4.9, z); }
  // The round end.
  const end = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 0.7, 20), mat(concrete));
  end.position.set(px, y + 0.35, to); g.add(end);
  const endRail = new THREE.Mesh(new THREE.TorusGeometry(12.6, 0.12, 5, 40), mat(rail));
  endRail.rotation.x = Math.PI / 2; endRail.position.set(px, y + 1.5, to); g.add(endRail);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; box(g, 0.9, y + 1.5, 0.9, piling, px + Math.cos(a) * 10, -1.5, to + Math.sin(a) * 10); }
  // The bait-and-tackle shack near the land end, and the lifeguard hut.
  box(g, 5, 3, 4, 0xf2e9d8, px + 5.5, y + 0.7, from + 30);
  box(g, 5.6, 0.4, 4.6, 0x7a4b3a, px + 5.5, y + 3.7, from + 30);
}

// ----------------------------------------------------- the far ends of the bay
function farEnds(g: THREE.Group) {
  // Santa Monica Pier, far north (screen-left), under the range: deck, the
  // Pacific Wheel, the coaster's hump, the Hippodrome's roof.
  const sx = X - 560, y = 9;
  box(g, 12, 1.2, 300, 0x9b8a78, sx, y, SHORE - 90, 0, true);
  for (let z = SHORE - 230; z < SHORE + 60; z += 10) box(g, 1.4, y + 2, 1.4, 0x5a5048, sx - 4, -2, z, 0, true), box(g, 1.4, y + 2, 1.4, 0x5a5048, sx + 4, -2, z, 0, true);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(15, 0.7, 6, 24), farMat(0xe9d7c8));
  wheel.position.set(sx + 12, y + 17, SHORE - 30); g.add(wheel);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI; const sp = box(g, 0.5, 30, 0.5, 0xe9d7c8, sx + 12, y + 2, SHORE - 30, 0, true); sp.rotation.z = a; sp.position.y = y + 17; }
  box(g, 26, 9, 10, 0xd8c3ad, sx + 30, y + 1.2, SHORE - 60, 0, true); // coaster's box, hump
  const hump = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 6, 12, 1, false, 0, Math.PI), farMat(0xd8c3ad));
  hump.rotation.z = Math.PI / 2; hump.rotation.y = Math.PI / 2; hump.position.set(sx + 30, y + 10, SHORE - 60); g.add(hump);
  box(g, 18, 12, 18, 0xe6d9c8, sx - 14, y + 1.2, SHORE - 120, 0, true); // the Hippodrome
  const roof = new THREE.Mesh(new THREE.ConeGeometry(12, 9, 4), farMat(0xb47a5a));
  roof.rotation.y = Math.PI / 4; roof.position.set(sx - 14, y + 17.7, SHORE - 120); g.add(roof);
  // Marina del Rey's towers, far south (screen-right), white and beige.
  const tw = [0xf2ede6, 0xe9dccb, 0xdad3c9, 0xf6f1ea, 0xd9cbb8, 0xe6e0d6];
  for (let i = 0; i < 9; i++) {
    const tx = X + 470 + hash(i, 91) * 140, tz = ROW1 - 60 - hash(i, 92) * 120;
    box(g, 12 + hash(i, 93) * 8, 32 + hash(i, 94) * 26, 12 + hash(i, 95) * 8, tw[i % tw.length], tx, groundH(tx, tz), tz, 0, true);
  }
  // Behind Venice the land is flat; a very low ridge far inland (the Baldwin
  // Hills) to keep the horizon from being a ruler.
  const ridge = new THREE.Mesh(new THREE.PlaneGeometry(900, 200, 60, 10).toNonIndexed(), new THREE.MeshBasicMaterial({ color: 0xc79a80 }));
  ridge.rotation.x = -Math.PI / 2;
  const rp = ridge.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < rp.count; i++) { const lx = rp.getX(i), lz = rp.getY(i); rp.setZ(i, Math.max(0, 22 * Math.exp(-((lx - 120) * (lx - 120)) / (260 * 260)) + 14 * Math.exp(-((lx + 300) * (lx + 300)) / (200 * 200)) - Math.abs(lz) * 0.12 + fbm2(lx * 0.01, lz * 0.02) * 6)); }
  ridge.geometry.computeVertexNormals();
  ridge.position.set(X + 160, 0, ROW1 - 640);
  g.add(ridge);
}

export function makeVenice() {
  const g = new THREE.Group();
  g.add(terrain());
  frontRow(g);
  backRows(g);
  palms(g);
  towers(g);
  recCenter(g);
  breakwater(g);
  venicePier(g);
  farEnds(g);
  void lerp;
  return g;
}
