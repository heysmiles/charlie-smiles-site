import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { fbm2, smoothstep } from './math';

/**
 * The Malibu range, seen down the line: a low-poly headland that runs from
 * behind the town out into the sea and fizzles into the fog, so that looking
 * out of the tube you look toward mountains.
 */
export function makeMountains() {
  const W = 520, D = 1500;
  const geo = new THREE.PlaneGeometry(W, D, 40, 120).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  geo.translate(L.rangeX, 0, 120);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  // Deep mauve, so the range silhouettes against the orange sky instead of
  // fogging into it; a touch of the fog's warmth toward the tops.
  const hill = new THREE.Color(0x5e4458), far = new THREE.Color(0x7a5a6c), top = new THREE.Color(0x7a5a6c).lerp(new THREE.Color(P.fog), 0.35);
  const peak = (z: number, at: number, h: number, w: number) => h * Math.exp(-((z - at) * (z - at)) / (w * w));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    // A ridge along z, its tallest peaks where the mouth of the tube looks
    // (around z ≈ -20…+150 from the camera's line), stepping down out to sea.
    let ridge = peak(z, -380, 110, 240) + peak(z, -60, 150, 200) + peak(z, 150, 175, 190) + peak(z, 380, 120, 200) + peak(z, 600, 70, 180) + peak(z, 800, 30, 160);
    ridge *= 1 - smoothstep(650, 920, z);
    const across = Math.exp(-((x - L.rangeX) * (x - L.rangeX)) / (170 * 170));
    let h = ridge * across * (0.8 + fbm2(x * 0.01, z * 0.01) * 0.45) - 6;
    h += (fbm2(x * 0.03 + 7, z * 0.03) - 0.5) * 12 * across;
    pos.setY(i, h);
    const t = smoothstep(10, 150, h);
    c.copy(hill).lerp(far, 0.5 + t * 0.3).lerp(top, t * 0.5);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  // No scene fog: at this distance it would paint the range the sky's colour.
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, fog: false }));
  mesh.frustumCulled = false;
  return mesh;
}
