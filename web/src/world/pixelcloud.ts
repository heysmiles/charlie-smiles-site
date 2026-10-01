import * as THREE from 'three';
import { hash } from './math';

/**
 * Pixel-art clouds, in the sunset's light. Each cloud is a small grid of
 * cells — a union of round bumps over a flat base — rasterised to a canvas
 * and shown nearest-neighbour, so every cell is a crisp pixel. Shaded in
 * bands from the top surface down: white at the top, cream through the body,
 * peach on the underside with a sprinkle of darker pixels, like the reference
 * sheets but lit from a low sun instead of a blue sky.
 *
 * `frames(form)` returns the cloud's birth as a short sequence: the cells
 * appear from the middle outward, so a new cloud pops in pixel by pixel.
 */
export type Formation = { w: number; h: number; base: number; bumps: [number, number, number][] };

// Six formations on a cell grid: [cx, cy, r] bumps (y down), `base` the flat bottom row.
export const FORMATIONS: Formation[] = [
  // a classic cumulus: two big bumps and a shoulder
  { w: 44, h: 24, base: 21, bumps: [[16, 11, 8], [27, 9, 9], [36, 14, 6], [8, 16, 5]] },
  // a towering column
  { w: 36, h: 32, base: 29, bumps: [[18, 24, 10], [14, 15, 7], [21, 11, 7], [18, 5, 5], [9, 22, 5], [28, 22, 5]] },
  // a wide anvil
  { w: 64, h: 22, base: 19, bumps: [[32, 8, 9], [20, 12, 7], [44, 12, 7], [10, 15, 5], [54, 15, 5], [32, 15, 10]] },
  // a double cumulus: two heads over one base
  { w: 56, h: 26, base: 23, bumps: [[16, 13, 9], [38, 11, 10], [27, 17, 8], [7, 18, 5], [49, 17, 6]] },
  // a tall puff with a heavy shoulder
  { w: 40, h: 28, base: 25, bumps: [[22, 10, 9], [13, 17, 8], [30, 18, 7], [20, 20, 9]] },
];

const TOP = '#fffaf4', BODY = '#fde9d6', UNDER = '#f6c8a4', SHADE = '#e9a67c', DOT = '#e3996e';

function mask(f: Formation) {
  const m = new Uint8Array(f.w * f.h);
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    if (y > f.base) continue;
    for (const [cx, cy, r] of f.bumps) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      // slightly squashed circles read more like the reference's bumps
      if (dx * dx + dy * dy * 1.3 < r * r) { m[y * f.w + x] = 1; break; }
    }
  }
  // flat base: fill between the outermost filled cells on the base row
  let lo = -1, hi = -1;
  for (let x = 0; x < f.w; x++) if (m[f.base * f.w + x]) { if (lo < 0) lo = x; hi = x; }
  if (lo >= 0) for (let x = lo; x <= hi; x++) { m[f.base * f.w + x] = 1; if (f.base > 0 && m[(f.base - 1) * f.w + x] === 0 && (m[(f.base - 1) * f.w + Math.max(0, x - 1)] || m[(f.base - 1) * f.w + Math.min(f.w - 1, x + 1)])) m[(f.base - 1) * f.w + x] = 1; }
  return m;
}

/** Draw the cloud's cells (those with reveal <= t) to a canvas; returns the canvas. */
function draw(f: Formation, m: Uint8Array, seed: number, t: number) {
  const cv = document.createElement('canvas'); cv.width = f.w; cv.height = f.h;
  const g = cv.getContext('2d')!;
  const cx = f.w / 2, cy = f.base * 0.6;
  const maxD = Math.hypot(f.w / 2, f.h) * 0.9;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    if (!m[y * f.w + x]) continue;
    if (Math.hypot(x - cx, (y - cy) * 1.4) / maxD > t) continue;
    // depth from the cloud's top surface in this column
    let d = 0; while (y - d - 1 >= 0 && m[(y - d - 1) * f.w + x]) d++;
    const fromBase = f.base - y;
    let c = BODY;
    if (d < 2) c = TOP;
    else if (fromBase <= 1) c = SHADE;
    else if (fromBase <= 4) c = hash(seed, x, y) < 0.22 ? DOT : UNDER;
    else if (d < 5) c = hash(seed, x, y, 2) < 0.15 ? TOP : BODY;
    else if (hash(seed, x, y, 3) < 0.08) c = UNDER;
    g.fillStyle = c; g.fillRect(x, y, 1, 1);
  }
  return cv;
}

/** The birth frames of a cloud: N canvases, the cells appearing from the middle out. */
export function cloudFrames(f: Formation, seed: number, n = 7) {
  const m = mask(f);
  const out: THREE.CanvasTexture[] = [];
  for (let i = 0; i < n; i++) {
    const t = i === n - 1 ? 2 : (i + 1) / n;
    const tex = new THREE.CanvasTexture(draw(f, m, seed, t));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    out.push(tex);
  }
  return out;
}
