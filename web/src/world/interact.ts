import * as THREE from 'three';
import type { World } from './World';
import { VENICE, shoreAt, type Kind, type LampSet } from './venice';
import { SpritePool, softDisc } from './sprites';
import { oceanH } from './ocean';
import { hash, clamp01, lerp } from './math';
import { FORMATIONS, cloudTexture } from './pixelcloud';

/**
 * Touching Venice. Once the camera rests off the beach, a tap reaches into the
 * world: the raycaster finds what was hit by its `userData.kind`, and each kind
 * answers in its own way —
 *
 *   tower      the light inside comes on (and off again), with the warm-up
 *              flicker of a fluorescent tube, and a glow spills from the glass
 *   building   its windows light up, each its own shade, a few staying dark
 *   water      a splash: a crown of droplets thrown up and falling back, a
 *              ring spreading out across the surface
 *   palm       a gust through the crown — the fronds ruffle, the head sways,
 *              a couple of dead fronds let go and drift down
 *   ground     a puff of sand kicked up
 *   sky        a cloud is born where you tapped, puffs up, and drifts; it
 *              bounces off the sides of the frame and never leaves. One every
 *              five seconds, with a countdown in between
 *   vpier      the Venice Pier's lamps come on along its length
 *   smpier     the Santa Monica Pier lights up and the Pacific Wheel turns
 *   hills/range  a flock of birds lifts off and crosses the sky
 *
 * Everything here is driven by the same clock as the world, and nothing it
 * does depends on the scroll, so the scene keeps its state while you look.
 */

const CLOUD_Z = -900; // the sky plane the clouds live on (world z, behind the far hills)
const ACTIVE_FROM = 0.9; // progress at which Venice is "the screen"

export type ClickResult = { kind: Kind | 'cloud'; point?: THREE.Vector3 };

type Cloud = { sprite: THREE.Sprite; vx: number; born: number; width: number; bob: number; w: number; h: number; dying: number };
type Particle = { kind: 'drop' | 'sand' | 'leaf' | 'bird'; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; r: number; g: number; b: number; seed: number; sprite?: THREE.Sprite };
type Lit = { on: boolean; level: number; t: number };

export class Interact {
  private ray = new THREE.Raycaster();
  private fx: SpritePool; // droplets, sand, leaves
  private birdFrames: THREE.Texture[] = birdFrames();
  private particles: Particle[] = [];
  private ripples: { mesh: THREE.Mesh; t: number; max: number }[] = [];
  private rippleGeo = new THREE.RingGeometry(0.8, 1, 40);
  private clouds: Cloud[] = [];
  private cloudCount = 0;
  private towers: Lit[] = VENICE.towers.map(() => ({ on: false, level: 0, t: 0 }));
  private buildings: Lit[] = VENICE.buildings.map(() => ({ on: false, level: 0, t: 0 }));
  private vpier: Lit = { on: false, level: 0, t: 0 };
  private smpier: Lit = { on: false, level: 0, t: 0 };
  private wheelOmega = 0;
  private palmShakes: { ref: number; t: number }[] = [];
  private time = 0;
  private active = false;
  private tmp = new THREE.Vector3();

  private world: World;
  constructor(world: World) {
    this.world = world;
    this.fx = new SpritePool(900, softDisc(64, 0.3));
    this.fx.uniforms.uHazeFull.value = 0; this.fx.uniforms.uHazeLo.value = 1.5; this.fx.points.renderOrder = 5;
    world.scene.add(this.fx.points);
    (this.ray as unknown as { firstHitOnly: boolean }).firstHitOnly = true;
  }

  get isActive() { return this.active; }

  /** What is under the cursor, by kind. ndc in [-1,1]. */
  hit(ndc: THREE.Vector2) {
    this.ray.setFromCamera(ndc, this.world.camera);
    // A cloud under the cursor comes first: tapping one removes it.
    for (const c of this.clouds) {
      if (c.dying >= 0) continue;
      const hc = this.ray.intersectObject(c.sprite, false);
      if (hc.length) return { kind: 'cloud' as const, point: hc[0].point, ref: this.clouds.indexOf(c) };
    }
    const hits = this.ray.intersectObjects(this.world.scene.children, true);
    for (const h of hits) {
      const o = h.object as THREE.Object3D & { isMesh?: boolean };
      if (!o.isMesh) continue;
      let kind: Kind = (o.userData.kind as Kind) ?? 'none';
      // The sea floor near the sand is under water; the sand only begins where it rises through the surface.
      if (kind === 'ground' && shoreAt(h.point.x) - h.point.z < 3) kind = 'water';
      return { kind, point: h.point, ref: (o.userData.ref as number) ?? -1 };
    }
    return { kind: 'sky' as const, point: this.skyPoint(ndc), ref: -1 };
  }

  /** A tap. Returns what it did, so the page can draw the countdown. */
  click(ndc: THREE.Vector2): ClickResult {
    if (!this.active) return { kind: 'none' };
    const h = this.hit(ndc);
    switch (h.kind) {
      case 'tower': { const s = this.towers[h.ref]; if (s) { s.on = !s.on; s.t = 0; } break; }
      case 'building': { const s = this.buildings[h.ref]; if (s) { s.on = !s.on; s.t = 0; } break; }
      case 'water': this.splash(h.point); break;
      case 'palm': this.ruffle(h.ref); break;
      case 'ground': this.sandPuff(h.point); break;
      case 'vpier': this.vpier.on = !this.vpier.on; this.vpier.t = 0; break;
      case 'smpier': this.smpier.on = !this.smpier.on; this.smpier.t = 0; break;
      case 'hills': case 'range': this.flock(h.point); break;
      case 'cloud': { const c = this.clouds[h.ref]; if (c) c.dying = this.time; break; }
      case 'sky': this.spawnCloud(this.skyPoint(ndc)); break; // always on the cloud plane, not wherever the ray met the dome
      default: break;
    }
    return { kind: h.kind, point: h.point };
  }

  /** Where a sky tap lands: the ray carried out to the cloud plane. */
  private skyPoint(ndc: THREE.Vector2) {
    this.ray.setFromCamera(ndc, this.world.camera);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    const t = d.z !== 0 ? (CLOUD_Z - o.z) / d.z : 600;
    const p = o.clone().addScaledVector(d, t > 0 ? t : 600);
    p.y = Math.max(p.y, 70);
    return p;
  }

  // ------------------------------------------------------------- reactions

  private splash(p: THREE.Vector3) {
    const y = oceanH(p.x, p.z, this.time) + 0.1;
    // The crown: droplets thrown up in a ring, then straight up from the middle.
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + hash(i, 1) * 0.3, ring = i < 24;
      const sp = ring ? 2.2 + hash(i, 2) * 1.6 : hash(i, 2) * 0.8;
      this.emit('drop', p.x, y, p.z, Math.cos(a) * sp, ring ? 3.5 + hash(i, 3) * 3 : 7 + hash(i, 3) * 4, Math.sin(a) * sp, 0.9 + hash(i, 4) * 0.5, ring ? 0.35 + hash(i, 5) * 0.4 : 0.5 + hash(i, 5) * 0.5, 1, 0.96, 0.9, i);
    }
    // Rings spreading out across the surface, one after another.
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(this.rippleGeo, new THREE.MeshBasicMaterial({ color: 0xfff3e6, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.set(p.x, y + 0.08, p.z); m.scale.setScalar(0.3); m.raycast = () => {};
      this.world.scene.add(m);
      this.ripples.push({ mesh: m, t: -k * 0.25, max: 1.4 + k * 0.4 });
    }
  }

  private sandPuff(p: THREE.Vector3) {
    for (let i = 0; i < 26; i++) {
      const a = hash(i, 11) * Math.PI * 2, sp = 0.6 + hash(i, 12) * 2.2;
      this.emit('sand', p.x, p.y + 0.1, p.z, Math.cos(a) * sp, 1.5 + hash(i, 13) * 3.5, Math.sin(a) * sp, 0.6 + hash(i, 14) * 0.5, 0.3 + hash(i, 15) * 0.5, 0.94, 0.8, 0.56, i);
    }
  }

  private ruffle(ref: number) {
    const palm = VENICE.palms[ref];
    if (!palm) return;
    if (!this.palmShakes.find((s) => s.ref === ref)) this.palmShakes.push({ ref, t: 0 });
    // A couple of dead fronds let go and drift down.
    for (let i = 0; i < 3; i++) this.emit('leaf', palm.top.x + (hash(ref, i, 1) - 0.5) * 2, palm.top.y - 1, palm.top.z + (hash(ref, i, 2) - 0.5) * 2, (hash(ref, i, 3) - 0.5) * 1.5, 0.4, (hash(ref, i, 4) - 0.5) * 1.5, 3 + hash(ref, i, 5) * 1.5, 1.4 + hash(ref, i, 6) * 0.8, 0.54, 0.43, 0.27, ref * 7 + i);
  }

  private flock(p: THREE.Vector3) {
    const dir = hash(Math.round(p.x), Math.round(this.time * 7)) < 0.5 ? -1 : 1;
    for (let i = 0; i < 9; i++) {
      // A V: the leader ahead, the rest trailing on either side.
      const row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
      this.emit('bird', p.x - dir * row * 30 + (hash(i, 21) - 0.5) * 6, p.y + 50 - row * 7 + (hash(i, 22) - 0.5) * 5, p.z + side * row * 22, dir * 26, 1.6, 0, 20, 22 + hash(i, 23) * 6, 0.99, 0.97, 0.93, i);
    }
  }

  private spawnCloud(p: THREE.Vector3) {
    // A different formation each time, in a shuffled order rather than a fixed one.
    const form = FORMATIONS[(this.cloudCount++ * 5 + Math.floor(hash(Math.round(p.x), Math.round(this.time * 31)) * 3)) % FORMATIONS.length];
    const seed = Math.round(p.x * 3 + this.time * 17);
    const CELL = 1.6; // world units per pixel on the cloud plane
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(form, seed), transparent: true, depthWrite: false, fog: false, opacity: 1 }));
    sprite.position.copy(p);
    const w = form.w * CELL, h = form.h * CELL;
    sprite.scale.set(w, h, 1);
    this.world.scene.add(sprite);
    const vx = (hash(Math.round(p.x * 3), 5) < 0.5 ? -1 : 1) * (5 + hash(Math.round(p.y), 6) * 5);
    this.clouds.push({ sprite, vx, born: this.time, width: w / 2, bob: hash(Math.round(p.x), 9) * 6.28, w, h, dying: -1 });
  }

  private emit(kind: Particle['kind'], x: number, y: number, z: number, vx: number, vy: number, vz: number, max: number, size: number, r: number, g: number, b: number, seed: number) {
    const p: Particle = { kind, x, y, z, vx, vy, vz, life: 0, max, size, r, g, b, seed };
    if (kind === 'bird') {
      // Each bird is its own sprite, so its wings can be on their own beat.
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.birdFrames[2], color: new THREE.Color(r, g, b), transparent: true, depthWrite: false, fog: false }));
      sp.position.set(x, y, z); sp.scale.set(size, size, 1); sp.raycast = () => {};
      this.world.scene.add(sp); p.sprite = sp;
    }
    this.particles.push(p);
  }

  // ------------------------------------------------------------------ update

  update(dt: number, time: number, progress: number) {
    this.time = time;
    this.active = progress >= ACTIVE_FROM;

    // Lights. A tube warms up: a flicker for the first third of a second, then
    // steady; it goes out at once.
    const lit = (s: Lit) => {
      s.t += dt;
      const target = s.on ? 1 : 0;
      s.level += (target - s.level) * (1 - Math.exp(-dt * (s.on ? 7 : 14)));
      let v = s.level;
      if (s.on && s.t < 0.42) v *= hash(Math.floor(time * 40), 3) < 0.35 ? 0.25 : 1;
      return v;
    };
    VENICE.towers.forEach((tw, i) => {
      const v = lit(this.towers[i]);
      tw.glass.emissiveIntensity = v * 1.4;
      tw.glow.visible = v > 0.01; tw.glow.material.opacity = v * 0.55;
      const sz = tw.glow.userData.size as number; tw.glow.scale.set(sz * (0.6 + 0.4 * v), sz * (0.6 + 0.4 * v), 1);
    });
    VENICE.buildings.forEach((b, i) => { b.mat.emissiveIntensity = lit(this.buildings[i]) * 1.1; });
    this.lamps(VENICE.vpier, lit(this.vpier));
    const smv = lit(this.smpier);
    this.lamps(VENICE.smLamps, smv);
    // The wheel turns while the pier is lit, and coasts to a stop when it isn't.
    this.wheelOmega += ((this.smpier.on ? 0.42 : 0) - this.wheelOmega) * (1 - Math.exp(-dt * (this.smpier.on ? 0.8 : 0.5)));
    if (VENICE.smWheel) VENICE.smWheel.rotation.z += this.wheelOmega * dt;

    // Palms: a gust runs through the crown and dies away.
    for (let i = this.palmShakes.length - 1; i >= 0; i--) {
      const s = this.palmShakes[i]; s.t += dt;
      const palm = VENICE.palms[s.ref];
      const T = 1.7, decay = Math.max(0, 1 - s.t / T) ** 1.4;
      palm.crown.rotation.x = Math.sin(s.t * 15) * 0.09 * decay;
      palm.crown.rotation.z = Math.sin(s.t * 11 + 1.3) * 0.07 * decay;
      palm.trunk.rotation.z = palm.trunkZ + Math.sin(s.t * 9) * 0.012 * decay;
      palm.fronds.forEach((f, k) => { f.g.rotation.z = f.z + Math.sin(s.t * 24 + k * 1.7) * 0.2 * decay * (0.6 + hash(k, 2) * 0.6); });
      if (s.t >= T) { palm.crown.rotation.x = 0; palm.crown.rotation.z = 0; palm.trunk.rotation.z = palm.trunkZ; palm.fronds.forEach((f) => { f.g.rotation.z = f.z; }); this.palmShakes.splice(i, 1); }
    }

    // Ripples spread and fade.
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i]; r.t += dt;
      if (r.t < 0) continue;
      const k = r.t / r.max;
      r.mesh.scale.setScalar(0.3 + k * 9);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k) * (1 - k);
      r.mesh.position.y = oceanH(r.mesh.position.x, r.mesh.position.z, time) + 0.08;
      if (k >= 1) { this.world.scene.remove(r.mesh); (r.mesh.material as THREE.Material).dispose(); this.ripples.splice(i, 1); }
    }

    // Particles.
    const fx = this.fx;
    let nf = 0;
    const drop = (p: Particle) => { if (p.sprite) { this.world.scene.remove(p.sprite); p.sprite.material.dispose(); } };
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.life += dt;
      if (p.life >= p.max) { drop(p); this.particles.splice(i, 1); continue; }
      const u = p.life / p.max;
      if (p.kind === 'drop') { p.vy -= 13 * dt; p.vx *= 1 - dt * 0.6; p.vz *= 1 - dt * 0.6; }
      else if (p.kind === 'sand') { p.vy -= 11 * dt; p.vx *= 1 - dt * 2; p.vz *= 1 - dt * 2; }
      else if (p.kind === 'leaf') { p.vy = -0.9 - Math.sin(p.life * 3 + p.seed) * 0.5; p.vx += Math.sin(p.life * 2.3 + p.seed) * dt * 2.2; p.vz += Math.cos(p.life * 1.9 + p.seed) * dt * 2.2; }
      else if (p.kind === 'bird') { p.vy = 1.2 + Math.sin(p.life * 0.8 + p.seed) * 0.6; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.kind === 'bird' && p.sprite) {
        // The wingbeat: a quick downstroke, a slower upstroke, and every few
        // beats a glide with the wings held level. The body lifts on the
        // downstroke and settles on the up.
        const beats = p.life * 2.3 + p.seed * 0.7;
        const bar = Math.floor(beats / 6), inBar = beats - bar * 6;
        const glide = hash(p.seed, bar) < 0.45 && inBar > 4.2;
        let wing = 0; // -1 down … +1 up
        if (!glide) { const u = beats - Math.floor(beats); wing = u < 0.38 ? 1 - 2 * (u / 0.38) : -1 + 2 * ((u - 0.38) / 0.62); }
        const frame = Math.round((wing + 1) / 2 * (this.birdFrames.length - 1));
        const m = p.sprite.material as THREE.SpriteMaterial;
        if (m.map !== this.birdFrames[frame]) { m.map = this.birdFrames[frame]; m.needsUpdate = true; }
        const u = p.life / p.max;
        m.opacity = 0.95 * (1 - Math.max(0, u - 0.85) / 0.15);
        p.sprite.position.set(p.x, p.y + (glide ? 0 : -wing * 0.35), p.z);
        p.sprite.scale.set(p.size, p.size, 1);
        continue;
      }
      if (p.kind === 'drop' && p.y < oceanH(p.x, p.z, time) - 0.2) { this.particles.splice(i, 1); continue; }
      {
        if (nf >= 900) continue;
        const a = p.kind === 'drop' ? 0.9 * (1 - u * u) : p.kind === 'sand' ? 0.8 * (1 - u) : 0.95 * (1 - Math.max(0, u - 0.8) / 0.2);
        fx.pos[nf * 3] = p.x; fx.pos[nf * 3 + 1] = p.y; fx.pos[nf * 3 + 2] = p.z;
        fx.size[nf] = p.size; fx.alpha[nf] = a;
        fx.color[nf * 3] = p.r; fx.color[nf * 3 + 1] = p.g; fx.color[nf * 3 + 2] = p.b; nf++;
      }
    }
    for (let i = nf; i < 900; i++) fx.alpha[i] = 0;
    fx.commit();

    // Clouds: appear whole with a small settling jiggle, drift, bounce off
    // the sides of the frame; tapped again, they shrink away.
    const cam = this.world.camera;
    const show = clamp01((progress - 0.86) / 0.06);
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      const mat = c.sprite.material as THREE.SpriteMaterial;
      if (c.dying >= 0) {
        const k = (time - c.dying) / 0.28;
        if (k >= 1) { this.world.scene.remove(c.sprite); mat.map?.dispose(); mat.dispose(); this.clouds.splice(i, 1); continue; }
        const s = (1 - k) * (1 + 0.12 * Math.sin(k * 18));
        c.sprite.scale.set(c.w * s, c.h * s, 1); mat.opacity = (1 - k * k) * show;
        continue;
      }
      const age = time - c.born;
      // the jiggle: a quick decaying wobble of scale and a little bob, settling in half a second
      const jig = age < 0.55 ? Math.exp(-age * 7) * Math.sin(age * 32) : 0;
      c.sprite.scale.set(c.w * (1 + jig * 0.05), c.h * (1 - jig * 0.06), 1);
      c.sprite.position.x += c.vx * dt;
      c.sprite.position.y += Math.sin(time * 0.35 + c.bob) * dt * 0.6 + jig * 1.2 * dt * 10;
      mat.opacity = show;
      const edge = this.tmp.set(c.sprite.position.x + Math.sign(c.vx) * c.width, c.sprite.position.y, c.sprite.position.z).project(cam);
      if (Math.abs(edge.x) > 0.98 && Math.sign(edge.x) === Math.sign(c.vx)) c.vx = -c.vx;
    }
  }

  private lamps(set: LampSet | null, v: number) {
    if (!set) return;
    if (set.basic) (set.mat as THREE.MeshBasicMaterial).color.setHex(0xfff0c8).lerp(new THREE.Color(0xffe27a), v);
    else (set.mat as THREE.MeshStandardMaterial).emissiveIntensity = v * 1.6;
    for (const g of set.glows) { g.visible = v > 0.01; g.material.opacity = v * 0.5; const sz = g.userData.size as number; g.scale.set(sz * lerp(0.5, 1, v), sz * lerp(0.5, 1, v), 1); }
  }
}

/**
 * A bird's wingbeat as six frames, wings from raised through level to down:
 * a small body with two wings that bend at the wrist, seen from below and
 * behind as the flock crosses the sky.
 */
function birdFrames() {
  const out: THREE.Texture[] = [];
  const N = 6;
  for (let k = 0; k < N; k++) {
    const a = 1.05 - (k / (N - 1)) * 1.75; // wing angle: +1.05 raised … -0.7 down
    const c = document.createElement('canvas'); c.width = c.height = 48;
    const x = c.getContext('2d')!;
    x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
    const bx = 24, by = 26;
    // body
    x.beginPath(); x.ellipse(bx, by, 3.2, 1.8, 0, 0, Math.PI * 2); x.fill();
    for (const s of [-1, 1]) {
      // inner wing to the wrist, then the outer wing folding a little further
      const wx = bx + s * 9 * Math.cos(a * 0.6), wy = by - 9 * Math.sin(a * 0.6);
      const tx = wx + s * 11 * Math.cos(a), ty = wy - 11 * Math.sin(a) - (a < 0 ? 1.5 : 0);
      x.lineWidth = 3.2; x.beginPath(); x.moveTo(bx + s * 2, by); x.quadraticCurveTo(bx + s * 5, by - 2.5 * Math.sin(a * 0.6) - 1, wx, wy); x.stroke();
      x.lineWidth = 2.4; x.beginPath(); x.moveTo(wx, wy); x.quadraticCurveTo(wx + s * 6 * Math.cos(a), wy - 6 * Math.sin(a) - 1.2, tx, ty); x.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    out.push(t);
  }
  return out;
}
