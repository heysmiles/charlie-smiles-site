/**
 * The star on the landing page, drawn live on a canvas instead of played from
 * a video: three grainy six-point stars — orange, blue, green — that sit in
 * a row turning slowly, and every so often slide into one overlapping burst,
 * spin against each other, and slide back out; a nine-second loop,
 * multiplied together like inks. The gathering is the event, so most of the
 * loop is the quiet row.
 *
 * A video needed autoplay, which phones refuse in low-power mode (a play
 * button appears instead), and its poster showed black behind. This has no
 * such life of its own: it starts when the page does, it is transparent, and
 * it is crisp at any pixel ratio.
 *
 * Each star's grain is rasterised once into a few variant textures (so the
 * grain can shimmer); every frame is then three `drawImage` calls.
 */
const COLORS: [number, number, number][] = [[232, 101, 26], [45, 111, 184], [47, 139, 60]];
const VARIANTS = 3;
const LOOP = 9; // seconds: ~3.6 s of slow turning in a row, then the gathering, then back
const SPACING = 0.56; // row spacing, as a fraction of the canvas half-size
const RADIUS = 0.34; // a star's reach, same units

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** One star's grain as a texture: a six-point star, dense at the heart, thinning to the points, stippled. */
function grain(px: number, color: [number, number, number], seed: number) {
  const c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d')!;
  const img = g.createImageData(px, px), d = img.data;
  const half = px / 2;
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    const dx = (x + 0.5 - half) / half, dy = (y + 0.5 - half) / half;
    const r = Math.hypot(dx, dy);
    if (r > 0.98) continue;
    // Six straight-edged arms, one straight up, the vertical pair reaching
    // further: each arm a triangle from the inner vertices to its tip, in the
    // arm's own coordinates (along the axis, across it).
    const a = Math.atan2(dy, dx) + Math.PI / 2;
    const sector = a / (Math.PI / 3);
    const nearest = Math.round(sector);
    const off = (sector - nearest) * (Math.PI / 3); // angle from the nearest arm's axis
    const vertical = ((nearest % 3) + 3) % 3 === 0;
    const Ro = vertical ? 0.92 : 0.8; // tip
    const Ri = 0.27; // the inner vertices, where neighbouring arms meet
    const Rb = Ri * Math.cos(Math.PI / 6), Wb = Ri * Math.sin(Math.PI / 6);
    const along = r * Math.cos(off), across = Math.abs(r * Math.sin(off));
    const hw = along <= Rb ? Wb : Wb * Math.max(0, Ro - along) / (Ro - Rb); // half-width at this point along the arm
    let dens = 0;
    if (along < Ro && along > -Ri) {
      if (across < hw) dens = Math.pow(1 - across / hw, 0.7) * (1 - 0.25 * Math.max(0, along) / Ro);
      else dens = Math.exp(-(across - hw) / 0.035) * 0.3; // the soft, grainy edge
    }
    dens += 0.45 * Math.exp(-(r * r) / (0.2 * 0.2)); // the dark heart
    dens = Math.min(1, dens);
    if (dens <= 0.02) continue;
    // Stipple: a pixel is drawn with probability tied to density, at a random weight.
    const p = rand();
    if (p > 0.4 + dens * 0.9) continue;
    const w = Math.min(1, dens * 1.25) * (0.6 + 0.4 * rand());
    const i = (y * px + x) * 4;
    d[i] = color[0]; d[i + 1] = color[1]; d[i + 2] = color[2]; d[i + 3] = Math.min(255, Math.round(w * 255));
  }
  g.putImageData(img, 0, 0);
  return c;
}

export class StarAnim {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size = 0; private dpr = 1;
  private tex: (HTMLCanvasElement | null)[][] = COLORS.map(() => Array(VARIANTS).fill(null));
  private texPx = 0;
  private raf = 0;
  private running = false;
  private t0 = performance.now();
  private still: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  resize(cssSize: number) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const size = Math.max(1, Math.round(cssSize));
    if (size === this.size && dpr === this.dpr) return;
    this.size = size; this.dpr = dpr;
    this.canvas.width = this.canvas.height = Math.round(size * dpr);
    // Grain textures a little larger than the drawn star, so they never upscale.
    const px = Math.min(768, Math.round(size * dpr * RADIUS * 1.15 * 2));
    if (px !== this.texPx) { this.texPx = px; this.tex = COLORS.map(() => Array(VARIANTS).fill(null)); }
    this.frame();
  }

  start() { if (this.running || this.still) return; this.running = true; const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  dispose() { this.stop(); }

  /** Build at most one missing texture per call, so the first paint is quick and the rest fill in over the next frames. */
  private texture(k: number, v: number) {
    const row = this.tex[k];
    if (!row[v]) {
      const missing = row.findIndex((t) => !t);
      if (missing >= 0) row[missing] = grain(this.texPx, COLORS[k], 7919 * (k + 1) + 104729 * (missing + 1));
      return row[v] ?? row.find((t) => t) ?? null;
    }
    return row[v];
  }

  private frame() {
    const g = this.ctx, S = this.canvas.width, half = S / 2;
    if (S === 0) return;
    const t = this.still ? 0 : ((performance.now() - this.t0) / 1000) % LOOP;
    const ph = (t / LOOP) * Math.PI * 2; // one turn per loop, so every wobble joins up
    // The row holds for the first stretch; then together; then back to the row.
    const spread = 1 - smooth(3.6, 4.7, t) + smooth(7.0, 8.3, t);
    const together = 1 - spread;
    const turn = smooth(3.8, 5.8, t) * (1 - smooth(6.8, 8.4, t));
    const variant = Math.floor(t * 9) % VARIANTS; // the grain shimmers
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    const R = half * RADIUS;
    for (let k = 0; k < COLORS.length; k++) {
      const tex = this.texture(k, (variant + k) % VARIANTS);
      if (!tex) continue;
      const side = k - 1;
      // The slow turn: whole sixths per loop, so the six-fold star lands where it started.
      const slow = (t / LOOP) * (Math.PI / 3) * [1, -1, 2][k];
      const x = half + side * SPACING * half * spread + [0.05, -0.03, 0.02][k] * half * together;
      const y = half + [0.04, -0.05, 0.03][k] * half * together + Math.sin(ph * 2 + k * 2.1) * half * 0.012;
      const ang = slow + side * 0.55 * turn + (k === 1 ? 0.52 * turn : 0) + [0.5, -0.4, 0.35][k] * turn * Math.sin(ph * 3 + k) * 0.25;
      const sc = 1 + 0.03 * Math.sin(ph * 4 + k * 1.4) + 0.06 * together;
      g.save();
      g.translate(x, y); g.rotate(ang); g.scale(sc, sc);
      g.globalCompositeOperation = 'multiply';
      const draw = R * 1.15;
      g.drawImage(tex, -draw, -draw, draw * 2, draw * 2);
      g.restore();
    }
    g.globalCompositeOperation = 'source-over';
  }
}
