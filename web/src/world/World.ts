import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { makeSky } from './sky';
import { makeOcean } from './ocean';
import { Wave } from './wave';
import { Foam } from './foam';
import { makeMountains } from './mountains';
import { makeVenice } from './venice';
import { makeSwash } from './swash';
import { Interact } from './interact';
import { cameraAt, frontAt } from './camera';
import { smoothstep, lerp } from './math';

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
  ocean = makeOcean();
  swash = makeSwash();
  /** Every material that takes the cream haze. */
  private hazed: { uRes: THREE.IUniform; uHazeLo: THREE.IUniform; uHazeFull: THREE.IUniform }[] = [];
  progress = 0;
  /** Touching the world once the camera rests off Venice. */
  interact!: Interact;
  private time = 0;
  private look = new THREE.Vector3();
  private smoothPos = new THREE.Vector3();
  private smoothLook = new THREE.Vector3();
  private first = true;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.5, 4000);
    this.scene.fog = new THREE.Fog(P.fog, 240, 1000);

    // The sun as a light. It sits a little higher than the sun in the sky so
    // the shadows it casts across Venice are long but not endless, and soft.
    const sun = new THREE.DirectionalLight(0xffb679, 3.0);
    const sd = new THREE.Vector3(L.sunDir[0], 0.3, L.sunDir[2]).normalize();
    sun.target.position.set(L.veniceX - 120, 0, L.shoreZ - 90);
    sun.position.copy(sun.target.position).addScaledVector(sd, 700);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 50; sun.shadow.camera.far = 1500;
    sun.shadow.camera.left = -700; sun.shadow.camera.right = 700;
    sun.shadow.camera.top = 320; sun.shadow.camera.bottom = -320;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
    sun.shadow.radius = 4;
    sun.shadow.camera.updateProjectionMatrix();
    this.scene.add(sun); this.scene.add(sun.target);
    this.scene.add(new THREE.HemisphereLight(0xf7cfae, 0x1c2b46, 0.9));
    // Fill from the shoreward side: the face of the wave points away from the
    // sun, and without this it is one flat navy slab.
    const fill = new THREE.DirectionalLight(0xffc9a0, 0.7);
    fill.position.set(-120, 160, -320);
    this.scene.add(fill);
    this.scene.add(new THREE.AmbientLight(0xffe0c0, 0.2));

    const sky = makeSky();
    this.scene.add(sky.group);
    // Bake the sky into an environment map so water and everything else
    // reflects the sunset instead of a black void.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(sky.dome.clone());
    this.scene.environment = pmrem.fromScene(envScene, 0.02, 1, 5000).texture;
    // The sky is bright and the environment is what lit materials mostly see;
    // kept low so the sun and its shadows carry the town (this scene-level
    // intensity is the control for scene.environment, not the material's).
    this.scene.environmentIntensity = 0.22;
    pmrem.dispose();
    this.scene.add(this.ocean.mesh);
    this.scene.add(this.wave.mesh);
    this.hazed = [sky.uniforms, (this.ocean.mesh.material as THREE.ShaderMaterial).uniforms, (this.wave.mesh.material as THREE.ShaderMaterial).uniforms, this.foam.pool.uniforms] as typeof this.hazed;
    this.scene.add(this.foam.points);
    this.scene.add(makeMountains());
    this.scene.add(makeVenice());
    this.scene.add(this.swash.mesh);
    this.ocean.mesh.userData.kind = 'water';
    this.wave.mesh.userData.kind = 'water';
    this.interact = new Interact(this);
  }

  /** The world's clock, for the page's overlays. */
  get clock() { return this.time; }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    for (const u of this.hazed) u.uRes.value.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Break front for a given progress: mid-break from the first scroll, never still. */
  static frontFor(t: number) { return frontAt(t); }

  update(progress: number, dt: number) {
    this.progress = progress;
    this.time += dt;
    const front = World.frontFor(progress);
    this.wave.update(front, this.time);
    this.foam.update(this.wave);
    this.ocean.tick(this.time);
    this.swash.tick(this.time);
    // Cream haze over the sky, seamless with the landing above; lifted once
    // the camera drops into the tube and the sky leaves the frame.
    // The top of the frame is the landing's cream: the sky (and clouds) haze
    // to it from mid-frame up for the whole section, so the sunset reads as the
    // same page as the landing. The water and spray haze only in the top
    // quarter and only while the stage is arriving under the landing, so the
    // stage's top edge is invisible but the roof of the tube stays dark.
    const water = lerp(0.75, 1.5, smoothstep(0.3, 0.45, progress));
    for (const u of this.hazed) u.uHazeFull.value = 0;
    this.hazed[0].uHazeLo.value = 0.42;
    this.hazed[1].uHazeLo.value = water;
    this.hazed[2].uHazeLo.value = water;
    this.hazed[3].uHazeLo.value = water;

    const cs = cameraAt(progress);
    const target = new THREE.Vector3(cs.pos[0], cs.pos[1], cs.pos[2]);
    this.look.set(cs.look[0], cs.look[1], cs.look[2]);
    // Terrain-safe: never sink below the sand when landing on the beach.
    if (this.first) { this.smoothPos.copy(target); this.smoothLook.copy(this.look); this.first = false; }
    const k = 1 - Math.exp(-dt * 10);
    this.smoothPos.lerp(target, k);
    this.smoothLook.lerp(this.look, k);
    this.camera.position.copy(this.smoothPos);
    this.camera.lookAt(this.smoothLook);
    const aspect = this.camera.aspect;
    const fov = cs.fov * (aspect < 1.5 ? 1 + (1.5 - aspect) * 0.4 : 1);
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }

    this.interact.update(dt, this.time, progress);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
