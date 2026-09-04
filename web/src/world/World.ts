import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { makeSky } from './sky';
import { makeOcean } from './ocean';
import { Wave } from './wave';
import { Foam } from './foam';
import { Surfer } from './surfer';
import { makeShore, DOORS } from './shore';
import { cameraAt } from './camera';
import { remap, smoothstep } from './math';

/**
 * Owns the whole scene. Feed it a scroll progress; it does the rest.
 * Everything that moves is a function of that progress, so scrubbing back
 * runs the wave backwards exactly.
 */
export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  wave = new Wave();
  foam = new Foam();
  surfer = new Surfer();
  ocean = makeOcean();
  progress = 0;
  private time = 0;
  private look = new THREE.Vector3();
  private smoothPos = new THREE.Vector3();
  private smoothLook = new THREE.Vector3();
  private first = true;
  doorScreen: { id: string; x: number; y: number; visible: boolean }[] = DOORS.map((d) => ({ id: d.id, x: 0, y: 0, visible: false }));

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.5, 4000);
    this.scene.fog = new THREE.Fog(P.fog, 240, 1000);

    const sun = new THREE.DirectionalLight(0xffb679, 2.6);
    sun.position.set(L.sunDir[0] * 400, L.sunDir[1] * 400, L.sunDir[2] * 400);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xf7cfae, 0x1c2b46, 1.1));
    // Fill from the shoreward side: the face of the wave points away from the
    // sun, and without this it is one flat navy slab.
    const fill = new THREE.DirectionalLight(0xffc9a0, 0.9);
    fill.position.set(-120, 160, -320);
    this.scene.add(fill);
    this.scene.add(new THREE.AmbientLight(0xffe0c0, 0.25));

    this.scene.add(makeSky());
    this.scene.add(this.ocean.mesh);
    this.scene.add(this.wave.mesh);
    this.scene.add(this.foam.mesh);
    this.scene.add(this.surfer.group);
    this.scene.add(makeShore());
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Break front for a given progress: enters from +X, crosses, holds for the dive, dies on the pan. */
  static frontFor(t: number) {
    if (t < 0.5) return remap(t, 0.04, 0.5, 74, -40);
    if (t < 0.7) return -40;
    return remap(t, 0.7, 1.0, -40, -150);
  }

  update(progress: number, dt: number) {
    this.progress = progress;
    this.time += dt;
    const front = World.frontFor(progress);
    this.wave.setFront(front);
    this.foam.update(this.wave);
    this.surfer.update(this.wave);
    this.ocean.tick(this.time);

    const cs = cameraAt(progress, front);
    const target = new THREE.Vector3(cs.pos[0], cs.pos[1], cs.pos[2]);
    this.look.set(cs.look[0], cs.look[1], cs.look[2]);
    // Terrain-safe: never sink below the sand when landing on the beach.
    if (this.first) { this.smoothPos.copy(target); this.smoothLook.copy(this.look); this.first = false; }
    const k = 1 - Math.exp(-dt * 12);
    this.smoothPos.lerp(target, k);
    this.smoothLook.lerp(this.look, k);
    this.camera.position.copy(this.smoothPos);
    this.camera.lookAt(this.smoothLook);
    const aspect = this.camera.aspect;
    const fov = cs.fov * (aspect < 1.5 ? 1 + (1.5 - aspect) * 0.4 : 1);
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }

    // Project the doors for the label layer.
    const reveal = smoothstep(0.88, 0.99, progress);
    const v = new THREE.Vector3();
    for (let i = 0; i < DOORS.length; i++) {
      v.copy(DOORS[i].pos).project(this.camera);
      const ds = this.doorScreen[i];
      ds.x = (v.x * 0.5 + 0.5);
      ds.y = (1 - (v.y * 0.5 + 0.5));
      ds.visible = reveal > 0.01 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
