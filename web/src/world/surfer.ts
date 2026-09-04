import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import type { Wave } from './wave';

/** A low-poly surfer, crouched on a board, riding the face ahead of the lip. */
export class Surfer {
  group = new THREE.Group();
  private v = new THREE.Vector3();

  constructor() {
    const skin = new THREE.MeshStandardMaterial({ color: P.surferSkin, flatShading: true, roughness: 0.9 });
    const shorts = new THREE.MeshStandardMaterial({ color: P.surferShorts, flatShading: true, roughness: 0.9 });
    const board = new THREE.MeshStandardMaterial({ color: P.board, flatShading: true, roughness: 0.6 });
    const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rz = 0, rx = 0) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, 0, rz);
      this.group.add(mesh);
      return mesh;
    };
    add(new THREE.BoxGeometry(5.4, 0.22, 1.5), board, 0, 0, 0, 0, 0);
    // legs
    add(new THREE.BoxGeometry(0.42, 1.5, 0.42), skin, -0.6, 0.75, 0.25, 0.25);
    add(new THREE.BoxGeometry(0.42, 1.5, 0.42), skin, 0.7, 0.8, -0.25, -0.3);
    // shorts + torso, leaning forward into the ride
    add(new THREE.BoxGeometry(1.1, 0.8, 0.9), shorts, 0.05, 1.7, 0, 0.2);
    add(new THREE.BoxGeometry(1.0, 1.3, 0.8), skin, -0.15, 2.65, 0, 0.55);
    // arms out
    add(new THREE.BoxGeometry(0.32, 1.3, 0.32), skin, -1.0, 2.6, 0.5, 1.2, 0.3);
    add(new THREE.BoxGeometry(0.32, 1.3, 0.32), skin, 0.6, 2.7, -0.5, -0.9, -0.3);
    // head
    add(new THREE.IcosahedronGeometry(0.42, 0), skin, -0.55, 3.55, 0, 0);
    this.group.scale.setScalar(1.6);
  }

  update(wave: Wave) {
    // On the face, just ahead of the throwing lip.
    const x = wave.frontX + L.breakLen * 0.36;
    wave.pointAt(x, 27, this.v); // mid-face
    // The face looks toward the shore (-Z); stand just off it, not inside it.
    this.group.position.set(x, this.v.y - 1.6, this.v.z - 1.0);
    // Facing -X (down the line), board pitched up the face.
    this.group.rotation.set(0, Math.PI, 0.32);
    const on = x > -L.waveLength / 2 + 30 && x < L.waveLength / 2 - 30;
    this.group.visible = on;
  }
}
