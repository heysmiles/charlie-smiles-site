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
const SHORE = L.shoreZ; // waterline at Venice
const WALK_W = 14;
/**
 * The bay curves: north of Venice (screen-left) the shore bends seaward toward
 * Santa Monica and the range, so the coast recedes in perspective instead of
 * stopping. Mirrored in the ocean shader's foam band.
 */
export const shoreAt = (x: number) => SHORE + 95 * smoothstep(250, 1000, -(x - X));
const walkAt = (x: number) => shoreAt(x) - 100; // Ocean Front Walk's seaward edge
const row1At = (x: number) => walkAt(x) - WALK_W - 2; // seaward face of the first building row
const WALK = walkAt(X);
const ROW1 = row1At(X);

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
  const d = shoreAt(x) - z; // inland distance
  if (d < 0) return -1.5 - Math.min(-d, 60) * 0.12; // seabed
  const berm = Math.min(d, 100) * 0.018 + (fbm2(x * 0.05, z * 0.05) - 0.5) * 0.35;
  return 1.0 + berm + smoothstep(100, 118, d) * 0.4;
};

function terrain() {
  const W = 2000, D = 900;
  const geo = new THREE.PlaneGeometry(W, D, 260, 110).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  geo.translate(X - 100, 0, SHORE + 140 - D / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const sand = new THREE.Color(P.sand), wet = new THREE.Color(P.sandWet), walk = new THREE.Color(0xd8cfc0), path = new THREE.Color(0xc9bfb0);
  const city = new THREE.Color(0x9a8f7e), sea = new THREE.Color(P.seaDeep);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, groundH(x, z));
    const d = shoreAt(x) - z;
    if (d < 0) c.copy(sea);
    else if (d < 6) c.copy(wet).lerp(sand, d / 6);
    else if (d < 100) {
      c.copy(sand).lerp(wet, (fbm2(x * 0.03, z * 0.03) - 0.5) * 0.25);
      // The bike path: a pale ribbon snaking through the sand.
      const pathZ = shoreAt(x) - 62 + Math.sin(x * 0.02) * 10 + Math.sin(x * 0.053 + 1.3) * 4;
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
  let x = X - 900;
  let k = 0;
  while (x < X + 330) {
    const santaMonica = x < X - 400; // north of Venice: hotels on the bluff, taller, paler
    const w = (santaMonica ? 14 : 9) + hash(k, 1) * 14;
    let nFloors = santaMonica ? 4 + Math.floor(hash(k, 2) * 6) : hash(k, 2) < 0.55 ? 2 : hash(k, 2) < 0.9 ? 3 : 1;
    let h = nFloors * 3.6 + hash(k, 3) * 1.2;
    const depth = 16 + hash(k, 4) * 10;
    let c = santaMonica ? [0xf4efe6, 0xe9dccb, 0xf2d9cf, 0xdad3c9, 0xf7f1ea][Math.floor(hash(k, 5) * 5)] : FRONT[Math.floor(hash(k, 5) * FRONT.length)];
    const cx = x + w / 2;
    const dx = cx - X;
    // The landmarks at Windward: Hotel Erwin (terracotta, six floors, the
    // rooftop bar) and the Venice V (white with a blue band); a mid-rise
    // condo further south.
    let erwin = false, veniceV = false;
    if (Math.abs(dx + 42) < 9) { h = 21.6; nFloors = 6; c = 0xb9694a; erwin = true; }
    else if (Math.abs(dx + 60) < 7) { h = 16.2; nFloors = 4; c = 0xf4efe6; veniceV = true; }
    else if (Math.abs(dx - 120) < 10) { h = 17.5; nFloors = 5; c = 0xe6d7c3; }
    const row1 = row1At(cx);
    const gy = groundH(cx, row1);
    const zc = row1 - depth / 2;
    box(g, w - 0.8, h, depth, c, cx, groundH(cx, zc), zc);
    // Two-tone facades on some: the upper floors a second colour.
    if (!santaMonica && !erwin && !veniceV && hash(k, 13) < 0.35) box(g, w - 0.7, h * 0.5, 0.25, FRONT[Math.floor(hash(k, 14) * FRONT.length)], cx, gy + h * 0.5, row1 + 0.1);
    if (veniceV) box(g, w - 0.7, 1.2, 0.3, 0x2f6fa3, cx, gy + h - 3.0, row1 + 0.15);
    // Cornice and parapet, and a rooftop box on the taller ones.
    box(g, w - 0.4, 0.5, depth + 0.4, 0xeae2d6, cx, gy + h - 0.5, zc);
    box(g, w - 0.6, 0.5, depth, 0x7a6d63, cx, gy + h, zc);
    if (h > 12) box(g, w * 0.45, 2.2, 6, 0x6a5a54, cx, gy + h + 0.5, zc - 2);
    if (erwin) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.2, 10), mat(0x8a8078));
      tank.position.set(cx + w * 0.3, gy + h + 1.6, zc + 3); g.add(tank);
      box(g, 0.9, 6.5, 0.4, 0xe0553a, cx - w / 2 + 0.2, gy + h - 7.5, row1 + 0.3); // the vertical ERWIN sign
    }
    // Murals: a big colour panel on many Venice facades.
    if (!santaMonica && hash(k, 6) < 0.45) box(g, w * (0.5 + hash(k, 7) * 0.4), h * 0.5, 0.3, MURAL[Math.floor(hash(k, 8) * MURAL.length)], cx + (hash(k, 9) - 0.5) * w * 0.3, gy + 1.4 + hash(k, 10) * 1.5, row1 + 0.15);
    // Ground floor: the shopfront band, a door, a sign board, an awning.
    box(g, w - 1.2, 1.8, 0.4, 0x3a332f, cx, gy + 1.7, row1 + 0.2);
    box(g, 1.2, 2.4, 0.3, 0x2a2420, cx + (hash(k, 23) - 0.5) * (w - 4), gy, row1 + 0.25);
    if (!santaMonica) box(g, w * 0.6, 0.7, 0.2, hash(k, 24) < 0.5 ? 0xf1c232 : 0xe8e8e8, cx, gy + 3.55, row1 + 0.3);
    if (hash(k, 11) < 0.7) {
      const a = box(g, w - 2, 0.3, 2.6, AWNING[Math.floor(hash(k, 12) * AWNING.length)], cx, gy + 3.4, row1 + 1.4);
      a.rotation.x = 0.25;
    }
    // Upper floors: windows, a belt course between floors.
    for (let f = 1; f < nFloors; f++) {
      const fy = gy + f * 3.6;
      box(g, w - 0.6, 0.22, 0.25, 0xeae2d6, cx, fy - 0.1, row1 + 0.12);
      const n = Math.max(1, Math.floor((w - 2) / 3));
      for (let i = 0; i < n; i++) box(g, 1.4, 1.5, 0.2, 0x2f3a4a, cx - (n - 1) * 1.5 + i * 3, fy + 1.0, row1 + 0.12);
    }
    x += w; k++;
  }
}

function backRows(g: THREE.Group) {
  // Second row: apartments and houses, lower and quieter; then sparse blocks fading inland.
  for (let k = 0; k < 110; k++) {
    const x = X - 900 + hash(k, 21) * 1230, z = row1At(x) - 40 - hash(k, 22) * 24;
    const w = 8 + hash(k, 23) * 12, h = 4 + hash(k, 24) * (x < X - 400 ? 14 : 6), d = 10 + hash(k, 25) * 8;
    box(g, w, h, d, P.houses[Math.floor(hash(k, 26) * P.houses.length)], x, groundH(x, z), z);
  }
  for (let k = 0; k < 120; k++) {
    const x = X - 950 + hash(k, 31) * 1450, z = row1At(x) - 80 - hash(k, 32) * 220;
    const w = 10 + hash(k, 33) * 18, h = 4 + hash(k, 34) * 9, d = 10 + hash(k, 35) * 14;
    const tall = hash(k, 36) < 0.08;
    box(g, w, tall ? h + 18 : h, d, tall ? 0xe6dfd3 : P.houses[Math.floor(hash(k, 37) * P.houses.length)], x, groundH(x, z), z, 0, true);
  }
}

// ------------------------------------------------------------------ palms
function palms(g: THREE.Group) {
  const trunk = new THREE.CylinderGeometry(0.22, 0.46, 1, 7);
  // A fan palm's frond: a wide fan on a short petiole, folded a little down its middle.
  const fan = new THREE.CircleGeometry(1.9, 9, -0.85, 1.7);
  fan.translate(0.35, 0, 0);
  const stem = new THREE.BoxGeometry(0.8, 0.07, 0.07);
  stem.translate(0.4, 0, 0);
  const tm = mat(0x7d6a55), tl = mat(0x8f7c66);
  const greens = [mat(0x3f6e38), mat(0x4f7a3c), mat(0x5f8e44), mat(0x7aa64e)];
  const dead = mat(0x8a6f45);
  const plant = (x: number, z: number, hgt: number, seed: number) => {
    const y = groundH(x, z);
    const lean = (hash(seed, 1) - 0.5) * 0.14, leanX = (hash(seed, 2) - 0.5) * 0.1;
    const t = new THREE.Mesh(trunk, hash(seed, 9) < 0.3 ? tl : tm);
    t.scale.set(1, hgt, 1); t.position.set(x, y + hgt / 2, z); t.rotation.set(leanX, 0, lean); g.add(t);
    const top = new THREE.Vector3(x - Math.sin(lean) * hgt, y + Math.cos(lean) * hgt, z + Math.sin(leanX) * hgt);
    const crown = new THREE.Group(); crown.position.copy(top); crown.rotation.y = hash(seed, 3) * 6.28; g.add(crown);
    // Three tiers: the top fronds stand up, the middle reach out, the lower hang.
    const tiers: [number, number, number][] = [[7, 0.95, 0.3], [11, 0.35, 0.3], [9, -0.45, 0.35]];
    for (let ti = 0; ti < tiers.length; ti++) {
      const [count, elev, spread] = tiers[ti];
      for (let i = 0; i < count; i++) {
        const f = new THREE.Group();
        f.rotation.y = (i / count) * Math.PI * 2 + hash(seed, ti, i) * 0.6;
        const isDead = ti === 2 && hash(seed, i, 6) < 0.3;
        f.rotation.z = isDead ? -1.85 : elev + (hash(seed, ti, i, 5) - 0.5) * spread;
        const blade = new THREE.Mesh(fan, isDead ? dead : greens[Math.floor(hash(seed, ti, i, 7) * greens.length)]);
        blade.rotation.x = Math.PI / 2 + (hash(seed, ti, i, 8) - 0.5) * 0.7; // the fan plane, twisted a little to catch light
        blade.rotation.z = 0.15; // fans tip up at their ends
        blade.scale.setScalar(0.85 + hash(seed, ti, i, 10) * 0.35);
        f.add(new THREE.Mesh(stem, isDead ? dead : tm)); f.add(blade);
        crown.add(f);
      }
    }
    // The shag of dead fronds under the head, and the head's heart.
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.6, 8), dead);
    skirt.position.copy(top).y -= 1.3; g.add(skirt);
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 5), greens[0]);
    heart.position.copy(top).y += 0.2; g.add(heart);
  };
  // The signature: a long line of tall fan palms along the seaward edge of the walk, running north.
  for (let x = X - 900; x < X + 360; x += 6 + hash(x, 41) * 5) plant(x + (hash(x, 42) - 0.5) * 3, walkAt(x) + 3 + (hash(x, 43) - 0.5) * 5, 14 + hash(x, 44) * 10, x);
  // A second, looser line along the back streets, showing above the roofs.
  for (let x = X - 900; x < X + 380; x += 12 + hash(x, 51) * 12) plant(x + (hash(x, 52) - 0.5) * 6, row1At(x) - 28 - hash(x, 53) * 14, 18 + hash(x, 54) * 9, x + 1000);
  // Clusters on the sand: around the Rec Center, by the pagodas, toward the pier.
  for (let k = 0; k < 40; k++) { const x = X - 110 + (hash(k, 45) - 0.5) * 120; plant(x, shoreAt(x) - 74 + hash(k, 46) * 24, 10 + hash(k, 47) * 10, k + 900); }
  for (let k = 0; k < 22; k++) { const x = X + 70 + hash(k, 48) * 150; plant(x, shoreAt(x) - 82 + hash(k, 49) * 16, 11 + hash(k, 50) * 9, k + 950); }
  for (let k = 0; k < 16; k++) { const x = X - 330 + hash(k, 55) * 120; plant(x, shoreAt(x) - 80 + hash(k, 56) * 16, 12 + hash(k, 57) * 9, k + 980); }
}

// ------------------------------------------------------ lifeguard towers
/**
 * The LA County tower as it stands on Venice: a pale aqua box with a flat,
 * overhanging roof, a railed deck across the seaward front, a long railed ramp
 * running down one side, X-braced legs, a big dark observation window, the
 * number on the side, a flag on a pole, the rescue can on the rail.
 */
function towers(g: THREE.Group) {
  const aqua = 0xa4cbc5, trim = 0xe4efec, glass = 0x233440, dark = 0x2a2a2a;
  let n = 1;
  for (let x = X - 880; x <= X + 300; x += 46, n++) {
    const z = shoreAt(x) - 18, y = groundH(x, z);
    const deckY = y + 2.7;
    // Legs and the X braces.
    for (const [dx, dz] of [[-1.7, -1.5], [1.7, -1.5], [-1.7, 1.5], [1.7, 1.5]]) box(g, 0.24, 2.7, 0.24, aqua, x + dx, y, z + dz);
    for (const dz of [-1.5, 1.5]) { const b1 = box(g, 0.14, 4.2, 0.14, aqua, x, y + 0.2, z + dz); b1.rotation.z = 0.93; const b2 = box(g, 0.14, 4.2, 0.14, aqua, x, y + 0.2, z + dz); b2.rotation.z = -0.93; }
    // The deck: the cabin sits at the back, a walk-out across the front.
    box(g, 4.8, 0.22, 4.6, aqua, x, deckY - 0.22, z);
    box(g, 3.2, 2.5, 2.9, aqua, x, deckY, z - 0.8);
    // The observation window across the front, side windows, the number.
    box(g, 2.6, 1.1, 0.12, glass, x, deckY + 1.15, z + 0.66);
    box(g, 0.12, 0.7, 0.9, glass, x + 1.62, deckY + 1.35, z - 0.9);
    box(g, 0.12, 0.7, 0.9, glass, x - 1.62, deckY + 1.35, z - 0.9);
    box(g, 0.06, 0.5, 0.7, dark, x + 1.64, deckY + 0.5, z - 1.4);
    // The flat roof, overhanging all round.
    box(g, 4.2, 0.2, 3.8, trim, x, deckY + 2.5, z - 0.8);
    box(g, 4.0, 0.14, 3.6, aqua, x, deckY + 2.7, z - 0.8);
    // Railing across the front deck and down the sides: posts, a top rail and a mid rail.
    for (const [dx, dz] of [[-2.3, 2.2], [-1.15, 2.2], [0, 2.2], [1.15, 2.2], [2.3, 2.2], [-2.3, 0.6], [2.3, 0.6]]) box(g, 0.08, 1.0, 0.08, aqua, x + dx, deckY, z + dz);
    box(g, 4.7, 0.07, 0.07, trim, x, deckY + 0.98, z + 2.2);
    box(g, 4.7, 0.06, 0.06, aqua, x, deckY + 0.55, z + 2.2);
    for (const side of [-2.3, 2.3]) { box(g, 0.07, 0.07, 1.7, trim, x + side, deckY + 0.98, z + 1.4); box(g, 0.06, 0.06, 1.7, aqua, x + side, deckY + 0.55, z + 1.4); }
    // The ramp: long, down the north side and back toward the sand, with railings both sides.
    const rl = 8.5, ang = 0.3, rx = x - 3.1;
    const cz = z + 0.6 - Math.cos(ang) * rl / 2, cy = deckY - Math.sin(ang) * rl / 2 - 0.07;
    const ramp = box(g, 1.2, 0.14, rl, aqua, rx, 0, 0); ramp.position.set(rx, cy, cz); ramp.rotation.x = -ang;
    for (const side of [-0.65, 0.65]) {
      const r1 = box(g, 0.06, 0.06, rl, trim, 0, 0, 0); r1.position.set(rx + side, cy + 1.0, cz); r1.rotation.x = -ang;
      const r2 = box(g, 0.06, 0.06, rl, aqua, 0, 0, 0); r2.position.set(rx + side, cy + 0.55, cz); r2.rotation.x = -ang;
      for (let i = 0; i <= 4; i++) { const t = -0.5 + i / 4; box(g, 0.07, 1.0, 0.07, aqua, rx + side, cy + Math.sin(ang) * rl * t, cz + Math.cos(ang) * rl * t); }
    }
    // Flag pole with the flag, and the rescue can on the rail.
    box(g, 0.07, 3.4, 0.07, trim, x + 1.6, deckY + 2.8, z - 2.2);
    box(g, 0.9, 0.5, 0.05, n % 4 === 0 ? 0xb03030 : 0xf1c232, x + 2.1, deckY + 5.5, z - 2.2);
    box(g, 0.3, 0.8, 0.3, 0xe0402a, x + 1.6, deckY + 0.2, z + 2.35);
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
  // Handball walls: tall concrete slabs, and the courts' green floors.
  for (let i = 0; i < 3; i++) box(g, 8, 5.2, 0.6, 0xc8c0b4, X + 52 + i * 10, groundH(X + 52, SHORE - 88), SHORE - 88);
  for (let i = 0; i < 2; i++) box(g, 15, 0.15, 26, 0x6f8a6a, X + 76 + i * 16, groundH(X + 76, SHORE - 80) - 0.05, SHORE - 80);
  for (let i = 0; i < 4; i++) box(g, 0.2, 3.4, 0.2, 0x4d4d4d, X + 70 + i * 8, groundH(X + 70, SHORE - 92), SHORE - 92); // hoops posts
  // Paddle-tennis courts with fences.
  for (let i = 0; i < 3; i++) box(g, 10, 0.12, 20, 0x5f7f60, X + 112 + i * 11, groundH(X + 112, SHORE - 80) - 0.05, SHORE - 80);
  for (let i = 0; i < 10; i++) box(g, 0.1, 2.8, 0.1, 0x4d4d4d, X + 106 + i * 3.6, groundH(X + 106, SHORE - 70), SHORE - 70);
}

// ----------------------------------------------------------- Venice Pier
function venicePier(g: THREE.Group) {
  const px = X + 210, y = 7.5, from = shoreAt(px) - 8, to = shoreAt(px) + 180;
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
  const sx = X - 560, y = 9, S = shoreAt(sx);
  box(g, 12, 1.2, 300, 0x9b8a78, sx, y, S - 90, 0, true);
  for (let z = S - 230; z < S + 60; z += 10) box(g, 1.4, y + 2, 1.4, 0x5a5048, sx - 4, -2, z, 0, true), box(g, 1.4, y + 2, 1.4, 0x5a5048, sx + 4, -2, z, 0, true);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(15, 0.7, 6, 24), farMat(0xe9d7c8));
  wheel.position.set(sx + 12, y + 17, S - 30); g.add(wheel);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI; const sp = box(g, 0.5, 30, 0.5, 0xe9d7c8, sx + 12, y + 2, S - 30, 0, true); sp.rotation.z = a; sp.position.y = y + 17; }
  box(g, 26, 9, 10, 0xd8c3ad, sx + 30, y + 1.2, S - 60, 0, true); // coaster's box, hump
  const hump = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 6, 12, 1, false, 0, Math.PI), farMat(0xd8c3ad));
  hump.rotation.z = Math.PI / 2; hump.rotation.y = Math.PI / 2; hump.position.set(sx + 30, y + 10, S - 60); g.add(hump);
  box(g, 18, 12, 18, 0xe6d9c8, sx - 14, y + 1.2, S - 120, 0, true); // the Hippodrome
  const roof = new THREE.Mesh(new THREE.ConeGeometry(12, 9, 4), farMat(0xb47a5a));
  roof.rotation.y = Math.PI / 4; roof.position.set(sx - 14, y + 17.7, S - 120); g.add(roof);
  // Marina del Rey's towers, far south (screen-right), white and beige.
  const tw = [0xf2ede6, 0xe9dccb, 0xdad3c9, 0xf6f1ea, 0xd9cbb8, 0xe6e0d6];
  for (let i = 0; i < 9; i++) {
    const tx = X + 470 + hash(i, 91) * 140, tz = ROW1 - 60 - hash(i, 92) * 120;
    box(g, 12 + hash(i, 93) * 8, 32 + hash(i, 94) * 26, 12 + hash(i, 95) * 8, tw[i % tw.length], tx, groundH(tx, tz), tz, 0, true);
  }
  backRange(g);
}

/**
 * Behind Venice the land is flat, but far inland the hills rise: low,
 * layered ridges in the pink of the eastern sky at sunset, sitting just
 * under the line of the palm crowns from the water.
 */
function backRange(g: THREE.Group) {
  const layers = [
    { z: ROW1 - 560, h: 22, base: 0x8d6e86, haze: 0.35, peaks: [[-380, 1.0, 180], [-120, 0.7, 140], [140, 1.1, 200], [420, 0.6, 160]] },
    { z: ROW1 - 720, h: 34, base: 0x9c7e97, haze: 0.5, peaks: [[-520, 0.8, 220], [-200, 1.0, 190], [90, 0.75, 170], [330, 1.05, 210], [600, 0.5, 180]] },
    { z: ROW1 - 900, h: 44, base: 0xab90a8, haze: 0.66, peaks: [[-600, 0.7, 260], [-260, 1.0, 230], [60, 0.85, 220], [420, 0.95, 250], [760, 0.6, 220]] },
  ];
  const pink = new THREE.Color(P.skyPink);
  const peak = (x: number, at: number, a: number, w: number) => a * Math.exp(-((x - at) * (x - at)) / (w * w));
  for (const layer of layers) {
    const W = 1900, D = 160;
    const geo = new THREE.PlaneGeometry(W, D, 150, 8).toNonIndexed();
    geo.rotateX(-Math.PI / 2);
    geo.translate(X + 60, 0, layer.z);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color(layer.base).lerp(pink, layer.haze), high = base.clone().lerp(pink, 0.35);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) - X - 60, z = pos.getZ(i) - layer.z;
      let ridge = 0;
      for (const [at, a, w] of layer.peaks) ridge += peak(x, at, a, w);
      const fold = 1 - Math.abs(fbm2(x * 0.012 + 5, layer.z * 0.01) * 2 - 1);
      let h = layer.h * ridge * (0.65 + fold * 0.6) * (1 - Math.abs(z) / (D / 2)) - 1;
      h += (fbm2(x * 0.03, layer.z * 0.02 + 2) - 0.5) * 5 * Math.min(1, ridge);
      pos.setY(i, Math.max(-1, h));
      c.copy(base).lerp(high, smoothstep(2, layer.h * 0.8, h));
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    m.frustumCulled = false;
    g.add(m);
  }
}

export function makeVenice() {
  const g = new THREE.Group();
  g.add(terrain());
  frontRow(g);
  backRows(g);
  palms(g);
  towers(g);
  recCenter(g);
  venicePier(g);
  farEnds(g);
  void lerp;
  return g;
}
