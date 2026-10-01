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

// Six formations on a cell grid: [cx, cy, r] bumps (y down), `base` the flat
// bottom row. Every one is built up: big lobes with smaller cauliflower bumps
// riding on top, so the silhouettes are busy rather than flat.
const RAW: Formation[] = [
  // a big cumulus: three lobes, cauliflower on top, a shoulder each side
  { w: 48, h: 30, base: 27, bumps: [[16, 17, 9], [29, 14, 10], [40, 20, 7], [7, 22, 6], [12, 10, 5], [22, 7, 5], [31, 5, 5], [38, 10, 5], [26, 20, 9]] },
  // a towering cumulonimbus: a tall stack leaning a little, boiling at the top
  { w: 40, h: 40, base: 37, bumps: [[20, 30, 11], [15, 21, 8], [24, 17, 8], [18, 10, 7], [25, 6, 5], [13, 6, 4], [8, 29, 6], [33, 28, 6], [30, 12, 4]] },
  // twin heads over one base, a notch between them
  { w: 56, h: 28, base: 25, bumps: [[16, 15, 9], [12, 8, 5], [21, 7, 5], [40, 13, 10], [36, 5, 5], [45, 6, 5], [28, 20, 7], [6, 21, 5], [50, 20, 5]] },
  // a tall narrow puff with a crooked crown and a trailing wisp
  { w: 44, h: 34, base: 31, bumps: [[18, 24, 10], [14, 14, 7], [22, 10, 6], [19, 4, 4], [27, 15, 5], [9, 27, 5], [34, 27, 5], [40, 29, 3]] },
  // a wide bank with three peaks, each with its own small bumps
  { w: 64, h: 28, base: 25, bumps: [[12, 17, 8], [10, 9, 5], [17, 8, 4], [32, 13, 10], [28, 5, 5], [37, 4, 5], [52, 17, 8], [50, 9, 5], [57, 10, 4], [22, 21, 7], [42, 21, 7], [4, 22, 4], [60, 22, 4]] },
  // a big one with a small companion riding alongside
  { w: 60, h: 26, base: 23, bumps: [[16, 13, 10], [11, 5, 5], [20, 4, 5], [26, 9, 6], [7, 18, 6], [30, 18, 7], [48, 16, 7], [45, 10, 4], [52, 11, 4], [55, 19, 4]] },
];

// Twice the cells of the sketches above: finer pixels, softer shapes.
const SCALE = 2;
export const FORMATIONS: Formation[] = RAW.map((f) => ({ w: f.w * SCALE, h: f.h * SCALE, base: f.base * SCALE, bumps: f.bumps.map(([x, y, r]) => [x * SCALE, y * SCALE, r * SCALE] as [number, number, number]) }));

// The light is the town's: the low sun off to the left and a little behind
// the viewer. Sunlit faces go warm white, the body cream, the side away from
// the sun a mauve shadow, the underside gold where the low sun reaches it.
const SUN = '#fff6e2', TOP = '#fffaf4', BODY = '#fce6d5', UNDER = '#f8cf9e', UNDER_DOT = '#efb97f', SHADE_LT = '#eac3bb', SHADE = '#dba9a6', DOT = '#c8918f';

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
    // the lobe this cell belongs to: the smallest bump containing it (the
    // cauliflower bumps on top win over the big lobes beneath)
    let lobe: [number, number, number] | null = null;
    for (const b of f.bumps) { const dx = x + 0.5 - b[0], dy = y + 0.5 - b[1]; if (dx * dx + dy * dy * 1.3 < b[2] * b[2] && (!lobe || b[2] < lobe[2])) lobe = b; }
    // within the lobe: lit from the left and a little below, shadowed on the
    // right and under its belly; dithered at the boundaries so the bands blend
    let lit = 0; if (lobe) { const dx = (x + 0.5 - lobe[0]) / lobe[2], dy = (y + 0.5 - lobe[1]) / lobe[2]; lit = -dx * 0.8 - dy * 0.25; }
    const l = lit + (hash(seed, x, y, 5) - 0.5) * 0.24;
    const r = hash(seed, x, y);
    let c = BODY;
    if (fromBase <= 2) c = l > 0.1 ? UNDER : SHADE;
    else if (fromBase <= 7) c = l > 0.15 ? (r < 0.2 ? UNDER_DOT : UNDER) : (r < 0.3 ? DOT : SHADE);
    else if (d < 3) c = l > -0.2 ? TOP : BODY;
    else if (l > 0.42) c = SUN;
    else if (l > 0.14) c = TOP;
    else if (l > -0.22) c = BODY;
    else if (l > -0.52) c = r < 0.15 ? DOT : SHADE_LT;
    else c = r < 0.3 ? DOT : SHADE;
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
