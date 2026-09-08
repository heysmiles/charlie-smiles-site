import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { fbm2, smoothstep } from './math';

/**
 * A low range down the line, about where the pier used to be: a few gentle
 * peaks that step down as they run out to sea, sitting in the fog so they
 * read as warm haze against the sunset rather than a wall of rock.
 */
export function makeMountains() {
  const W = 260, D = 1100;
  const geo = new THREE.PlaneGeometry(W, D, 30, 90).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  geo.translate(L.rangeX, 0, 60);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  // Dark mauve silhouettes, hazed a little toward the fog by hand: scene fog at
  // this distance would paint them the sky's colour.
  const haze = new THREE.Color(P.fog);
  const base = new THREE.Color(0x2a1f30).lerp(haze, 0.1), high = new THREE.Color(0x4a3546).lerp(haze, 0.18);
  const peak = (z: number, at: number, h: number, w: number) => h * Math.exp(-((z - at) * (z - at)) / (w * w));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let ridge = peak(z, -260, 26, 150) + peak(z, -60, 38, 130) + peak(z, 120, 30, 130) + peak(z, 300, 18, 120) + peak(z, 450, 10, 110);
    ridge *= 1 - smoothstep(400, 600, z);
    const across = Math.exp(-((x - L.rangeX) * (x - L.rangeX)) / (80 * 80));
    let h = ridge * across * (0.85 + fbm2(x * 0.012, z * 0.012) * 0.4) - 3;
    h += (fbm2(x * 0.03 + 7, z * 0.03) - 0.5) * 5 * across;
    pos.setY(i, h);
    const t = smoothstep(3, 34, h);
    // Lighter toward the tops and toward the sun's side, for a little form.
    c.copy(base).lerp(high, 0.35 + t * 0.65).lerp(haze, fbm2(x * 0.02, z * 0.02) * 0.15);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  // Unlit: the scene's bright sky environment would wash a lit material to
  // near white at this distance. The vertex colours are the whole look.
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  mesh.frustumCulled = false;
  return mesh;
}
