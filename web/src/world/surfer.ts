import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { lerp, smoothstep } from './math';
import type { Wave } from './wave';

type V = [number, number, number];
const UP = new THREE.Vector3(0, 1, 0);

/**
 * A surfer as a person, not a pile of boxes: joints placed by hand in a low,
 * down-the-line crouch (facing local +X, front foot forward, arms trailing),
 * with smooth capsules stretched between them, a head with a cap of hair, and
 * a shaped board underfoot. Built in metres; the group is scaled to the wave.
 */
export class Surfer {
  group = new THREE.Group();
  private v = new THREE.Vector3();
  private rig = new THREE.Group();

  constructor() {
    const std = (color: number, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    const skin = std(P.surferSkin, 0.8);
    const shirt = std(P.surferShirt, 0.95);
    const shorts = std(P.surferShorts, 0.9);
    const hair = std(P.surferHair, 0.95);
    const boardMat = std(P.board, 0.35);

    const rig = this.rig;
    const bone = (a: V, b: V, r: number, m: THREE.Material) => {
      const pa = new THREE.Vector3(...a), pb = new THREE.Vector3(...b);
      const dir = pb.clone().sub(pa);
      const len = dir.length();
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m);
      mesh.position.copy(pa).add(pb).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
      rig.add(mesh);
      return mesh;
    };
    const ball = (c: V, r: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m);
      mesh.position.set(...c);
      rig.add(mesh);
      return mesh;
    };
    // Split a limb at a fraction so the shorts end mid-thigh.
    const mid = (a: V, b: V, f: number): V => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

    // --- the pose ------------------------------------------------------
    const pelvis: V = [0.02, 0.86, 0];
    const chest: V = [0.3, 1.24, 0];
    const neck: V = [0.4, 1.36, 0];
    const head: V = [0.5, 1.48, 0];
    const shL: V = [0.3, 1.28, 0.2], shR: V = [0.3, 1.28, -0.2];
    const elL: V = [0.02, 1.02, 0.3], elR: V = [0.12, 1.06, -0.3];
    const haL: V = [-0.18, 0.78, 0.28], haR: V = [-0.06, 0.82, -0.3];
    const hipL: V = [0.02, 0.84, 0.11], hipR: V = [0.02, 0.84, -0.11];
    const knL: V = [0.36, 0.52, 0.16], anL: V = [0.5, 0.1, 0.18], toL: V = [0.68, 0.05, 0.18];
    const knR: V = [0.02, 0.44, -0.16], anR: V = [-0.34, 0.1, -0.15], toR: V = [-0.18, 0.05, -0.16];

    // torso: shorts at the hips, shirt up to the shoulders
    bone(mid(pelvis, chest, -0.08), mid(pelvis, chest, 0.18), 0.16, shorts);
    bone(mid(pelvis, chest, 0.14), chest, 0.17, shirt);
    bone(chest, neck, 0.11, shirt);
    bone(shL, shR, 0.09, shirt);
    bone(neck, mid(neck, head, 0.6), 0.055, skin);
    ball(head, 0.115, skin);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 12, 0, Math.PI * 2, 0, 1.75), hair);
    cap.position.set(head[0] - 0.02, head[1] + 0.025, head[2]);
    cap.rotation.z = 0.5; // tilted back: forehead and face stay skin
    rig.add(cap);

    // arms: short sleeves, then skin
    for (const [sh, el, ha] of [[shL, elL, haL], [shR, elR, haR]] as V[][]) {
      bone(sh, mid(sh, el, 0.3), 0.065, shirt);
      bone(mid(sh, el, 0.25), el, 0.05, skin);
      bone(el, ha, 0.045, skin);
      ball(ha, 0.05, skin);
      ball(el, 0.05, skin);
    }
    // legs: shorts to mid-thigh, skin below, feet flat on the board
    for (const [hip, kn, an, to] of [[hipL, knL, anL, toL], [hipR, knR, anR, toR]] as V[][]) {
      bone(hip, mid(hip, kn, 0.55), 0.085, shorts);
      bone(mid(hip, kn, 0.5), kn, 0.07, skin);
      bone(kn, an, 0.06, skin);
      ball(kn, 0.065, skin);
      bone(an, to, 0.045, skin);
    }

    // the board: pointed nose (+X), rounded tail, a little rocker via a bevel
    const shape = new THREE.Shape();
    shape.moveTo(0.95, 0);
    shape.bezierCurveTo(0.7, 0.2, 0.3, 0.26, -0.2, 0.25);
    shape.bezierCurveTo(-0.6, 0.24, -0.85, 0.2, -0.92, 0.1);
    shape.bezierCurveTo(-0.97, 0.03, -0.97, -0.03, -0.92, -0.1);
    shape.bezierCurveTo(-0.85, -0.2, -0.6, -0.24, -0.2, -0.25);
    shape.bezierCurveTo(0.3, -0.26, 0.7, -0.2, 0.95, 0);
    const boardGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 3, curveSegments: 24 });
    boardGeo.rotateX(Math.PI / 2);
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0.08, 0.04, 0);
    rig.add(board);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), std(0x2b2b2b, 0.6));
    fin.position.set(-0.7, -0.08, 0);
    fin.rotation.z = Math.PI * 0.92;
    rig.add(fin);

    this.group.add(rig);
    this.group.scale.setScalar(3.3);
  }

  update(wave: Wave, progress: number) {
    // On the face just ahead of the throwing lip; late in the tube chapter he
    // outruns the break and rides out through the mouth onto the shoulder.
    const ahead = lerp(0.3, 0.14, smoothstep(0.66, 0.9, progress));
    const x = wave.frontX + L.breakLen * ahead;
    wave.pointAt(x, 27, this.v); // mid-face
    // The face looks toward the shore (-Z); ride just off it, not inside it.
    this.group.position.set(x, this.v.y - 2.1, this.v.z - 0.35);
    // Facing -X (down the line), board pitched up the face.
    this.group.rotation.set(0, Math.PI, 0.3);
    const on = x > -L.waveLength / 2 + 30 && x < L.waveLength / 2 - 30;
    this.group.visible = on;
  }
}
