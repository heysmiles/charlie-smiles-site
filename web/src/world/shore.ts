import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { fbm2, hash, smoothstep } from './math';

/**
 * Venice, low-poly: a beach that rises into a town and then into hills.
 * Everything here is geometry — sand and hills as a vertex-coloured
 * heightfield, houses as boxes with gable roofs, palms as leaning trunks with
 * faceted fronds, a lifeguard tower, a boardwalk, and the pier at the north end.
 */

export const terrainH = (x: number, z: number) => {
  const d = L.shoreZ - z; // distance inland from the waterline
  if (d < 0) return -1.2 - Math.min(-d, 60) * 0.12; // seabed
  let h = Math.min(d, 40) * 0.06 + (fbm2(x * 0.08, z * 0.08) - 0.5) * 0.9;
  if (d > 40) h += (d - 40) * 0.045 + (fbm2(x * 0.02, z * 0.02) - 0.5) * 2.5;
  h += smoothstep(150, 300, d) * (16 + fbm2(x * 0.008 + 3, z * 0.008) * 34);
  return h;
};

function makeTerrain() {
  const W = 1400, D = 520;
  const geo = new THREE.PlaneGeometry(W, D, 200, 90).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, L.shoreZ + 60 - D / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const sand = new THREE.Color(P.sand), wet = new THREE.Color(P.sandWet), grass = new THREE.Color(P.grass);
  const scrub = new THREE.Color(P.scrub), hill = new THREE.Color(P.hill), hillFar = new THREE.Color(P.hillFar), sea = new THREE.Color(P.seaDeep);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainH(x, z);
    pos.setY(i, h);
    const d = L.shoreZ - z;
    if (d < 0) c.copy(sea);
    else if (d < 7) c.copy(wet).lerp(sand, d / 7);
    else if (d < 46) c.copy(sand);
    else if (d < 160) c.copy(grass).lerp(scrub, fbm2(x * 0.05, z * 0.05));
    else c.copy(hill).lerp(hillFar, smoothstep(160, 420, d) * 0.8).lerp(grass, (1 - smoothstep(160, 240, d)) * 0.6);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
}

function gableRoof(w: number, d: number, h: number, color: number) {
  const g = new THREE.BufferGeometry();
  const hw = w / 2, hd = d / 2;
  // 6 vertices: 4 eaves + 2 ridge ends
  const v = [
    [-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [0, h, -hd], [0, h, hd],
  ];
  const tri = [
    [0, 4, 1], [3, 2, 5], // gable ends
    [0, 3, 5], [0, 5, 4], // one slope
    [1, 4, 5], [1, 5, 2], // other slope
    [0, 1, 2], [0, 2, 3], // underside
  ];
  const arr = new Float32Array(tri.length * 9);
  let i = 0;
  for (const t of tri) for (const k of t) { arr[i++] = v[k][0]; arr[i++] = v[k][1]; arr[i++] = v[k][2]; }
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, side: THREE.DoubleSide }));
}

function makeHouses(group: THREE.Group) {
  let x = -250;
  let k = 0;
  while (x < 250) {
    const w = 9 + hash(k, 1) * 8;
    const dpt = 9 + hash(k, 2) * 6;
    const floors = 1 + Math.floor(hash(k, 3) * 2.4);
    const h = 3.6 * floors + 0.8;
    const row = hash(k, 4) > 0.6 ? 1 : 0;
    const z = L.townZ - row * 22 + (hash(k, 5) - 0.5) * 6;
    const y = terrainH(x + w / 2, z);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, dpt),
      new THREE.MeshStandardMaterial({ color: P.houses[k % P.houses.length], flatShading: true, roughness: 1 })
    );
    body.position.set(x + w / 2, y + h / 2, z);
    group.add(body);
    if (hash(k, 6) > 0.35) {
      const roof = gableRoof(w + 0.8, dpt + 0.8, 2.2 + hash(k, 7) * 1.6, P.roofs[k % P.roofs.length]);
      roof.position.set(x + w / 2, y + h, z);
      if (hash(k, 8) > 0.5) roof.rotation.y = Math.PI / 2;
      group.add(roof);
    } else {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.6, dpt + 0.6), new THREE.MeshStandardMaterial({ color: P.roofs[2], flatShading: true }));
      parapet.position.set(x + w / 2, y + h + 0.3, z);
      group.add(parapet);
    }
    // balcony rail on the sea side, every other house
    if (hash(k, 9) > 0.5) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.9, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }));
      rail.position.set(x + w / 2, y + h * 0.62, z + dpt / 2 + 1.2);
      group.add(rail);
    }
    x += w + 3 + hash(k, 10) * 5;
    k++;
  }
}

function makePalms(group: THREE.Group) {
  const N = 90;
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.55, 1, 5);
  trunkGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: P.trunk, flatShading: true, roughness: 1 }), N);
  const frondGeo = new THREE.BoxGeometry(1.5, 0.16, 5.6);
  frondGeo.translate(0, 0, 2.4);
  const fronds = new THREE.InstancedMesh(frondGeo, new THREE.MeshStandardMaterial({ color: P.frond, flatShading: true, roughness: 1, side: THREE.DoubleSide }), N * 7);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const lit = new THREE.Color(P.frondLit), dark = new THREE.Color(P.frond), c = new THREE.Color();
  let fi = 0;
  for (let i = 0; i < N; i++) {
    const x = -270 + hash(i, 11) * 540;
    if (x < -230 && hash(i, 12) > 0.3) continue;
    const z = L.shoreZ - 30 - hash(i, 13) * 80;
    const y = terrainH(x, z);
    const h = 9 + hash(i, 14) * 9;
    const lean = (hash(i, 15) - 0.5) * 0.35;
    e.set(0, hash(i, 16) * 6.28, lean);
    q.setFromEuler(e);
    s.set(1, h, 1);
    m.compose(p.set(x, y, z), q, s);
    trunks.setMatrixAt(i, m);
    // crown at the top of the leaning trunk
    const top = p.clone().add(new THREE.Vector3(Math.sin(lean) * h, Math.cos(lean) * h, 0));
    for (let f = 0; f < 7; f++) {
      e.set(-0.8 - hash(i, f, 1) * 0.5, (f / 7) * 6.28 + hash(i, f, 2) * 0.4, 0);
      q.setFromEuler(e);
      s.set(1, 1, 0.8 + hash(i, f, 3) * 0.5);
      m.compose(top, q, s);
      fronds.setMatrixAt(fi, m);
      c.copy(dark).lerp(lit, hash(i, f, 4));
      fronds.setColorAt(fi, c);
      fi++;
    }
  }
  fronds.count = fi;
  trunks.instanceMatrix.needsUpdate = true;
  fronds.instanceMatrix.needsUpdate = true;
  if (fronds.instanceColor) fronds.instanceColor.needsUpdate = true;
  group.add(trunks, fronds);
}

function makeLandmarks(group: THREE.Group) {
  const post = new THREE.MeshStandardMaterial({ color: P.post, flatShading: true, roughness: 1 });
  const deck = new THREE.MeshStandardMaterial({ color: P.deck, flatShading: true, roughness: 1 });

  // Boardwalk along the town front.
  const bw = new THREE.Mesh(new THREE.BoxGeometry(560, 0.5, 7), deck);
  bw.position.set(0, terrainH(0, L.townZ + 16) + 0.25, L.townZ + 16);
  group.add(bw);

  // Lifeguard tower.
  const tx = 60, tz = L.shoreZ - 14;
  const ty = terrainH(tx, tz);
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), post);
    leg.position.set(tx + dx, ty + 2, tz + dz);
    group.add(leg);
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.2, 4.6), new THREE.MeshStandardMaterial({ color: 0x3f8fc9, flatShading: true }));
  cabin.position.set(tx, ty + 5.6, tz);
  group.add(cabin);
  const cabinRoof = gableRoof(5.4, 5.4, 1.2, 0xffffff);
  cabinRoof.position.set(tx, ty + 7.2, tz);
  group.add(cabinRoof);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 9), deck);
  ramp.position.set(tx + 3, ty + 2.2, tz - 3);
  ramp.rotation.x = 0.5;
  group.add(ramp);

  // The pier, running out to sea at the north end.
  const px = -290;
  const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 220), deck);
  deckMesh.position.set(px, 7, L.shoreZ + 60);
  group.add(deckMesh);
  for (let z = L.shoreZ - 40; z < L.shoreZ + 170; z += 12) {
    for (const dx of [-5, 5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9, 0.9), post);
      leg.position.set(px + dx, 2.5, z);
      group.add(leg);
    }
  }
  const wheel = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(10, 0.5, 6, 18), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }));
  wheel.add(ring);
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 20, 0.4), post);
    sp.rotation.z = (i / 8) * Math.PI;
    wheel.add(sp);
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), new THREE.MeshStandardMaterial({ color: P.houses[(i + 1) % 4], flatShading: true }));
    const a = (i / 8) * Math.PI * 2;
    car.position.set(Math.cos(a) * 10, Math.sin(a) * 10, 0);
    wheel.add(car);
  }
  wheel.position.set(px, 18, L.shoreZ + 30);
  wheel.rotation.y = Math.PI / 2;
  group.add(wheel);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 24), new THREE.MeshStandardMaterial({ color: P.houses[0], flatShading: true }));
  hall.position.set(px, 10.4, L.shoreZ + 110);
  group.add(hall);
  const hallRoof = gableRoof(13, 25, 3, P.roofs[0]);
  hallRoof.position.set(px, 13.4, L.shoreZ + 110);
  group.add(hallRoof);
}

export function makeShore() {
  const g = new THREE.Group();
  g.add(makeTerrain());
  makeHouses(g);
  makePalms(g);
  makeLandmarks(g);
  return g;
}

/** Anchors for the five doors, in world space. */
export const DOORS = [
  { id: 'pier', label: 'Santa Monica Pier', leads: 'who am i', pos: new THREE.Vector3(-290, 30, L.shoreZ + 30) },
  { id: 'breakwater', label: 'Breakwater', leads: 'photography', pos: new THREE.Vector3(-150, 3, L.shoreZ + 24) },
  { id: 'skatepark', label: 'Venice Skate Park', leads: 'moving pictures', pos: new THREE.Vector3(-40, 5, L.shoreZ - 22) },
  { id: 'stan', label: 'Stan', leads: 'the day job', pos: new THREE.Vector3(120, 14, L.townZ - 22) },
  { id: 'brooks', label: 'Brooks', leads: '275 square feet', pos: new THREE.Vector3(210, 9, L.townZ) },
];
