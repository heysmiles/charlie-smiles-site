import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { fbm2, smoothstep } from './math';

/**
 * A range down the line, in three ridges at different depths so it reads as
 * layered country rather than one cut-out: a near ridge that runs off to the
 * right into a low coast (you can just tell it is land), a taller ridge behind
 * it, and a far one dissolving into haze. Unlit, dark mauve, hazed by depth.
 * The seaward (left) ends step down into the sea.
 */
type Layer = { dx: number; haze: number; base: number; high: number; width: number; fade: [number, number]; peaks: [number, number, number][]; coast: number };
const LAYERS: Layer[] = [
  { dx: 0, haze: 0.1, base: 0x2a1f30, high: 0x4a3546, width: 60, fade: [360, 540], coast: 5,
    peaks: [[-560, 8, 240], [-320, 16, 150], [-110, 27, 115], [90, 24, 105], [260, 14, 95], [410, 7, 85]] },
  { dx: -130, haze: 0.26, base: 0x35283a, high: 0x574152, width: 85, fade: [430, 640], coast: 3,
    peaks: [[-640, 7, 260], [-400, 22, 170], [-160, 42, 150], [60, 36, 135], [260, 24, 125], [430, 11, 110]] },
  { dx: -290, haze: 0.44, base: 0x43303f, high: 0x67505f, width: 110, fade: [520, 760], coast: 0,
    peaks: [[-520, 12, 250], [-240, 32, 210], [20, 52, 180], [250, 38, 170], [460, 20, 150]] },
];

export function makeMountains() {
  const group = new THREE.Group();
  const haze = new THREE.Color(P.fog);
  const peak = (z: number, at: number, h: number, w: number) => h * Math.exp(-((z - at) * (z - at)) / (w * w));
  for (const layer of LAYERS) {
    const x0 = L.rangeX + layer.dx;
    const W = layer.width * 4, D = 1600;
    const geo = new THREE.PlaneGeometry(W, D, 36, 130).toNonIndexed();
    geo.rotateX(-Math.PI / 2);
    geo.translate(x0, 0, 40);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const base = new THREE.Color(layer.base).lerp(haze, layer.haze), high = new THREE.Color(layer.high).lerp(haze, layer.haze + 0.08);
    let hMax = 1;
    for (const [, h] of layer.peaks) hMax = Math.max(hMax, h);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      let ridge = 0;
      for (const [at, h, w] of layer.peaks) ridge += peak(z, at, h, w);
      // The coast: a low land line running off to the right (shoreward), never quite gone.
      ridge += layer.coast * smoothstep(-200, -600, z);
      ridge *= 1 - smoothstep(layer.fade[0], layer.fade[1], z);
      const across = Math.exp(-((x - x0) * (x - x0)) / (layer.width * layer.width));
      // Ridged detail: folded noise gives sharp crests and gullies.
      const fold = 1 - Math.abs(fbm2(x * 0.02 + 3, z * 0.02) * 2 - 1);
      let h = ridge * across * (0.7 + fold * 0.55) - 3;
      h += (fbm2(x * 0.045 + 7, z * 0.045) - 0.5) * 6 * across * smoothstep(0, 8, ridge);
      pos.setY(i, h);
      const t = smoothstep(2, hMax * 0.9, h);
      c.copy(base).lerp(high, t).lerp(haze, fbm2(x * 0.015, z * 0.015) * 0.12);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // Unlit: the scene's bright sky environment would wash a lit material to
    // near white at this distance. The vertex colours are the whole look.
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}
