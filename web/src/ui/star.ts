/**
 * The star on the landing page: the original clip — three grainy stars that
 * slide from a row into one burst and back, 5 s at 60 fps — drawn onto a
 * canvas, with a long pause in the row between gatherings.
 *
 * The clip comes from a muted, hidden `<video>` whose frames are copied to
 * the canvas every animation frame: `star.webm` (VP9 with alpha) for
 * Chrome and Firefox, `star.mov` (HEVC with alpha) for Safari and iOS. When
 * a browser will not autoplay (phones in low-power mode show a play button
 * instead) or cannot play either file, a sprite sheet of the clip's frames
 * at 15 fps stands in, so the star always runs and is always transparent.
 *
 * The loop: for a few seconds the three stars turn slowly in place, each a
 * half turn to the left, easing to rest exactly on the clip's first frame;
 * then the clip plays through; then the hold again. The turning stars are
 * cut from the clip's own resting frames. Each star has two long arms and
 * four short ones and is mirror-symmetric, and in the row the stars overlap
 * (orange under blue under green), so: the orange star is its clean left
 * half mirrored, the green its clean right half, and the blue its left half
 * with the arms that lie over the orange star rebuilt from the orange star's
 * own pixels, recoloured by radius to the blue star's gradient. The clip's
 * grain changes every other frame; the hold cycles through the resting
 * frames at that rate, so the shimmer never stops across either seam.
 */
const CLIP = 720; // the clip's frame size; the row layout below is measured in it
const ROW = { cx: [172, 360, 540], cy: 360, size: 492 }; // the stars in the clip's first frame
const TURN = -1; // half turns each star makes during the hold: to the left, the way the clip spins them together
const HOLD = 4; // seconds of slow turning before the clip runs
const SHIMMER = 1 / 30; // seconds per grain sample during the hold: the clip's own grain rate
const REST_F = [0, 2, 4, 296, 298, 299]; // the clip's resting frames (at 60 fps): one pose, six grains
// The fallback sheet: 9 columns of 15 fps frames, 480 px for larger screens, 256 px for phones.
const SHEET = { fps: 15, cols: 9, frames: 75, rest: [0, 1, 73, 74] };

const ease = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/**
 * The three stars cut from one resting frame: `src` holds the whole
 * 720-unit frame scaled to `px` pixels at `sx, sy`. Each star is a square
 * canvas centred on the star, with a soft fade at the canvas edge well
 * outside the star.
 */
function cutStars(src: CanvasImageSource, sx: number, sy: number, px: number): HTMLCanvasElement[] {
  const s = px / CLIP;
  const D = Math.round(ROW.size * s * 1.3), h = D / 2;
  // The frame's pixels.
  const fc = document.createElement('canvas'); fc.width = fc.height = px;
  const fg = fc.getContext('2d', { willReadFrequently: true })!;
  fg.drawImage(src, sx, sy, px, px, 0, 0, px, px);
  const F = fg.getImageData(0, 0, px, px).data;
  // Bilinear sample of the frame at a continuous point; premultiplied result.
  const sample = (qx: number, qy: number, out: Float64Array) => {
    const x0 = Math.floor(qx - 0.5), y0 = Math.floor(qy - 0.5), fx = qx - 0.5 - x0, fy = qy - 0.5 - y0;
    let R = 0, G = 0, B = 0, A = 0;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const xx = x0 + i, yy = y0 + j;
      if (xx < 0 || yy < 0 || xx >= px || yy >= px) continue;
      const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy), q = (yy * px + xx) * 4, a = F[q + 3] * w;
      R += F[q] * a; G += F[q + 1] * a; B += F[q + 2] * a; A += a;
    }
    out[0] = R; out[1] = G; out[2] = B; out[3] = A;
  };
  // Each star's clean half, mirrored into a whole star: premultiplied floats.
  const raw: Float64Array[] = [];
  const tmp = new Float64Array(4);
  for (let k = 0; k < 3; k++) {
    const d = new Float64Array(D * D * 4);
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      const u = x + 0.5 - h, v = y + 0.5 - h;
      const edge = Math.hypot(u, v) / h;
      if (edge >= 1) continue;
      const mask = edge < 0.92 ? 1 : 1 - (edge - 0.92) / 0.08;
      const um = k === 2 ? Math.abs(u) : -Math.abs(u); // orange and blue from the left, green from the right
      sample(ROW.cx[k] * s + um, ROW.cy * s + v, tmp);
      if (tmp[3] <= 0) continue;
      const o = (y * D + x) * 4;
      d[o] = tmp[0] * mask; d[o + 1] = tmp[1] * mask; d[o + 2] = tmp[2] * mask; d[o + 3] = tmp[3] * mask;
    }
    raw.push(d);
  }
  // The blue star lies over the orange one, so its short arms are mixed with
  // orange. Measure, by radius, how the blue gradient differs from the orange
  // (on the clean long arms), and build the blue star from the orange one.
  const BIN = 2 * s, bins = Math.ceil(h / BIN) + 1;
  const prof = (d: Float64Array) => {
    const acc = new Float64Array(bins * 4);
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      const u = x + 0.5 - h, v = y + 0.5 - h, r = Math.hypot(u, v);
      if (r < 1 || Math.abs(u) / r > 0.342) continue; // within 20 degrees of the vertical arms
      const o = (y * D + x) * 4, a = d[o + 3];
      if (a < 128) continue; // solid pixels only
      const b = Math.floor(r / BIN) * 4;
      acc[b] += d[o]; acc[b + 1] += d[o + 1]; acc[b + 2] += d[o + 2]; acc[b + 3] += a;
    }
    return acc;
  };
  const pO = prof(raw[0]), pB = prof(raw[1]);
  const shift = new Float64Array(bins * 3);
  let last = [0, 0, 0];
  for (let b = 0; b < bins; b++) {
    if (pO[b * 4 + 3] > 0 && pB[b * 4 + 3] > 0) {
      last = [0, 1, 2].map((c) => pB[b * 4 + c] / pB[b * 4 + 3] - pO[b * 4 + c] / pO[b * 4 + 3]);
    }
    shift[b * 3] = last[0]; shift[b * 3 + 1] = last[1]; shift[b * 3 + 2] = last[2];
  }
  // The blue star is the orange star's pixels, shifted: the blue star's own
  // pixels are only clean along its long arms, and its grain is just grain.
  const O = raw[0], Bl = raw[1];
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const o = (y * D + x) * 4, ta = O[o + 3];
    if (ta <= 0) { Bl[o] = Bl[o + 1] = Bl[o + 2] = Bl[o + 3] = 0; continue; }
    const r = Math.hypot(x + 0.5 - h, y + 0.5 - h);
    const b = Math.min(bins - 1, Math.floor(r / BIN)) * 3;
    for (let c = 0; c < 3; c++) Bl[o + c] = Math.min(255, Math.max(0, O[o + c] / ta + shift[b + c])) * ta;
    Bl[o + 3] = ta;
  }
  // To canvases.
  return raw.map((d) => {
    const c = document.createElement('canvas'); c.width = c.height = D;
    const g = c.getContext('2d')!;
    const id = g.createImageData(D, D), p = id.data;
    for (let i = 0; i < D * D; i++) {
      const o = i * 4, a = d[o + 3];
      if (a <= 0) continue;
      p[o] = d[o] / a; p[o + 1] = d[o + 1] / a; p[o + 2] = d[o + 2] / a; p[o + 3] = a;
    }
    g.putImageData(id, 0, 0);
    return c;
  });
}

type Phase = 'hold' | 'clip';

export class StarAnim {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private base: string;
  private still: boolean;
  private small: boolean;
  private size = 0; private dpr = 1;
  private raf = 0;
  private running = false;
  // the clip: a video, or the sheet when video is not an option
  private video: HTMLVideoElement | null = null;
  private videoOk = false; // loaded, and its resting frames cut
  private sheet: HTMLImageElement | null = null;
  private px = 480; // the sheet's frame size
  private stars: HTMLCanvasElement[][] = []; // per resting frame, the three stars
  private restPending: number[] = []; // resting-frame times still to cut from the video
  // the loop
  private phase: Phase = 'hold';
  private phaseStart = performance.now();
  private sample = 0; private sampleAt = 0;

  constructor(canvas: HTMLCanvasElement, base: string) {
    this.canvas = canvas; this.base = base;
    this.ctx = canvas.getContext('2d')!;
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.small = Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches;
    this.px = this.small ? 256 : 480;
    this.setupVideo();
  }

  /** The clip as a video, in whichever alpha format this browser plays; the sheet if neither. */
  private setupVideo() {
    const v = document.createElement('video');
    const mov = v.canPlayType('video/quicktime; codecs="hvc1"'), webm = v.canPlayType('video/webm; codecs="vp9"');
    const safari = /apple/i.test(navigator.vendor) || /iP(hone|ad|od)/.test(navigator.userAgent);
    // Safari plays WebM but drops its alpha, so it must take the HEVC file.
    const src = safari ? (mov ? 'star.mov' : null) : (webm ? 'star.webm' : mov ? 'star.mov' : null);
    if (!src) { this.useSheet(); return; }
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.src = `${this.base}brand/${src}`;
    v.onerror = () => this.useSheet();
    v.onloadedmetadata = () => {
      // Cut the resting frames first (seeking through them), then prove autoplay works.
      this.restPending = REST_F.map((f) => Math.min(v.duration, (f + 0.5) / 60));
      v.onseeked = () => {
        if (!this.restPending.length) return;
        this.stars.push(cutStars(v, 0, 0, CLIP));
        this.restPending.shift();
        if (this.restPending.length) v.currentTime = this.restPending[0];
        else {
          v.onseeked = null; v.currentTime = 0;
          v.play().then(() => { v.pause(); v.currentTime = 0; this.videoOk = true; this.video = v; this.phase = 'hold'; this.phaseStart = performance.now(); this.frame(); }).catch(() => this.useSheet());
        }
      };
      v.currentTime = this.restPending[0];
    };
    this.video = v;
  }

  /** The fallback: the sheet of the clip's frames, and resting stars cut from it. */
  private useSheet() {
    if (this.sheet) return;
    this.video = null; this.videoOk = false; this.stars = [];
    const img = new Image(); img.decoding = 'async';
    img.src = `${this.base}brand/star-${this.px}.webp`;
    img.onload = () => { this.sheet = img; this.phase = 'hold'; this.phaseStart = performance.now(); this.frame(); };
  }

  private buildOneFromSheet() {
    if (!this.sheet || this.stars.length >= SHEET.rest.length) return;
    const f = SHEET.rest[this.stars.length], px = this.px;
    this.stars.push(cutStars(this.sheet, (f % SHEET.cols) * px, Math.floor(f / SHEET.cols) * px, px));
  }

  resize(cssSize: number) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const size = Math.max(1, Math.round(cssSize));
    if (size === this.size && dpr === this.dpr) return;
    this.size = size; this.dpr = dpr;
    this.canvas.width = this.canvas.height = Math.round(size * dpr);
    this.frame();
  }

  start() {
    if (this.running || this.still) return;
    this.running = true;
    if (this.phase === 'clip' && this.videoOk) this.video!.play().catch(() => {});
    const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); if (this.video) this.video.pause(); }
  dispose() { this.stop(); if (this.video) { this.video.removeAttribute('src'); this.video.load(); } }

  /** How many grain samples there are: each cut frame, upright and upside down (the stars are symmetric). */
  private samples() { return this.stars.length * 2; }

  /** The three stars in their row, each turned by `turn` half turns (0 = as in the clip's first frame), from grain sample `sample`. */
  private drawRow(turn: number, sample: number) {
    const set = this.stars[sample >> 1];
    if (!set) return;
    const flip = sample & 1 ? -1 : 1;
    const g = this.ctx, S = this.canvas.width, k = S / CLIP;
    const srcPx = this.videoOk ? CLIP : this.px, up = S / srcPx;
    g.save();
    // orange under blue under green, as the clip composites them
    set.forEach((star, i) => {
      g.save();
      g.translate(ROW.cx[i] * k, ROW.cy * k);
      g.rotate(TURN * turn * Math.PI);
      g.scale(1, flip);
      const d = star.width * up;
      g.drawImage(star, -d / 2, -d / 2, d, d);
      g.restore();
    });
    g.restore();
  }

  private drawSheetFrame(f: number) {
    if (!this.sheet) return;
    const S = this.canvas.width, px = this.px;
    this.ctx.drawImage(this.sheet, (f % SHEET.cols) * px, Math.floor(f / SHEET.cols) * px, px, px, 0, 0, S, S);
  }

  frame() {
    const S = this.canvas.width;
    if (S === 0) return;
    const g = this.ctx, now = performance.now();
    g.clearRect(0, 0, S, S);
    // Reduced motion, or nothing ready yet: the clip's first frame, still.
    if (this.still || (!this.videoOk && !this.sheet)) {
      if (this.video && this.video.readyState >= 2 && !this.restPending.length) g.drawImage(this.video, 0, 0, S, S);
      else if (this.sheet) this.drawSheetFrame(0);
      return;
    }
    if (this.sheet) this.buildOneFromSheet();
    const t = (now - this.phaseStart) / 1000;
    if (this.phase === 'hold') {
      if (t >= HOLD) {
        this.phase = 'clip'; this.phaseStart = now;
        if (this.videoOk) { this.video!.currentTime = 0; this.video!.play().catch(() => this.useSheet()); }
      } else {
        // a different grain sample each tick, never the same one twice running
        if (now - this.sampleAt >= SHIMMER * 1000) { const n = this.samples(); this.sample = n > 1 ? (this.sample + 1 + Math.floor(Math.random() * (n - 1))) % n : 0; this.sampleAt = now; }
        if (this.stars.length) this.drawRow(ease(t / HOLD), this.sample);
        else if (this.videoOk) g.drawImage(this.video!, 0, 0, S, S); else this.drawSheetFrame(0);
        return;
      }
    }
    // The clip.
    if (this.videoOk) {
      const v = this.video!;
      g.drawImage(v, 0, 0, S, S);
      if (v.ended || v.currentTime >= v.duration - 0.012) { v.pause(); this.phase = 'hold'; this.phaseStart = now; }
    } else {
      const f = Math.floor(t * SHEET.fps);
      if (f >= SHEET.frames) { this.phase = 'hold'; this.phaseStart = now; this.drawRow(0, this.sample); }
      else this.drawSheetFrame(f);
    }
  }
}
