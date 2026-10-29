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
 * whole sixth of a turn, easing to rest exactly on the clip's first frame;
 * then the clip plays through; then the hold again. The turning stars are
 * cut from the clip's own resting frames (its first three and last three,
 * one pose): each star's top arm is clear of its neighbours and a six-point
 * star repeats every sixth, so every pixel is read from that one clean wedge
 * by symmetry, halo and all. Six grain samples cycle at the clip's rate
 * during the hold, so the shimmer never stops across either seam.
 */
const CLIP = 720; // the clip's frame size; the row layout below is measured in it
const ROW = { cx: [172, 360, 540], cy: 360, size: 492 }; // the stars in the clip's first frame
const TURN = -1; // sixths of a turn each star makes during the hold: to the left, the way the clip spins them together
const HOLD = 3.6; // seconds of slow turning before the clip runs
const SHIMMER = 1 / 15; // seconds per grain sample during the hold
const REST_T = (dur: number) => [0, 1 / 60, 2 / 60, dur - 3 / 60, dur - 2 / 60, dur - 1 / 60]; // the clip's resting frames, one pose
// The fallback sheet: 9 columns of 15 fps frames, 480 px for larger screens, 256 px for phones.
const SHEET = { fps: 15, cols: 9, frames: 75, rest: [0, 1, 2, 72, 73, 74] };

const ease = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/**
 * One star cut from a resting frame: `src` holds the whole 720-unit frame
 * (scaled to `px` pixels, at `sx, sy` within `src`). Every pixel of the star
 * is read from the top wedge (a sixth of a turn, centred on the upward arm)
 * by rotating its position into that wedge; only a soft fade at the canvas
 * edge, well outside the halo.
 */
function extract(src: CanvasImageSource, sx: number, sy: number, px: number, k: number) {
  const s = px / CLIP;
  const D = Math.round(ROW.size * s * 1.3), h = D / 2;
  const fr = document.createElement('canvas'); fr.width = fr.height = D;
  const fg = fr.getContext('2d')!;
  fg.drawImage(src, sx, sy, px, px, h - ROW.cx[k] * s, h - ROW.cy * s, px, px);
  const sd = fg.getImageData(0, 0, D, D).data;
  const out = document.createElement('canvas'); out.width = out.height = D;
  const og = out.getContext('2d')!;
  const id = og.createImageData(D, D), d = id.data;
  const SIXTH = Math.PI / 3, UP = -Math.PI / 2;
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const o = (y * D + x) * 4;
    const dx = x + 0.5 - h, dy = y + 0.5 - h;
    const r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    const edge = r / h;
    if (edge >= 1) continue;
    const mask = edge < 0.92 ? 1 : 1 - (edge - 0.92) / 0.08;
    const n = Math.round((th - UP) / SIXTH);
    const t2 = th - n * SIXTH;
    const qx = h + r * Math.cos(t2) - 0.5, qy = h + r * Math.sin(t2) - 0.5;
    const x0 = Math.floor(qx), y0 = Math.floor(qy), fx = qx - x0, fy = qy - y0;
    let R = 0, G = 0, B = 0, A = 0;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const xx = Math.min(D - 1, Math.max(0, x0 + i)), yy = Math.min(D - 1, Math.max(0, y0 + j));
      const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy), q = (yy * D + xx) * 4, a = sd[q + 3] * w;
      R += sd[q] * a; G += sd[q + 1] * a; B += sd[q + 2] * a; A += a;
    }
    if (A <= 0) continue;
    d[o] = R / A; d[o + 1] = G / A; d[o + 2] = B / A; d[o + 3] = A * mask;
  }
  og.putImageData(id, 0, 0);
  return out;
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
      this.restPending = REST_T(v.duration);
      v.onseeked = () => {
        if (!this.restPending.length) return;
        this.stars.push([0, 1, 2].map((k) => extract(v, 0, 0, CLIP, k)));
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
    this.stars.push([0, 1, 2].map((k) => extract(this.sheet!, (f % SHEET.cols) * px, Math.floor(f / SHEET.cols) * px, px, k)));
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

  /** The three stars in their row, each turned by `turn` sixths (0 = as in the clip's first frame), from grain sample `sample`. */
  private drawRow(turn: number, sample: number) {
    const set = this.stars[sample % this.stars.length];
    if (!set) return;
    const g = this.ctx, S = this.canvas.width, k = S / CLIP;
    const srcPx = this.videoOk ? CLIP : this.px, up = S / srcPx;
    g.save();
    g.globalCompositeOperation = 'multiply';
    set.forEach((star, i) => {
      g.save();
      g.translate(ROW.cx[i] * k, ROW.cy * k);
      g.rotate(TURN * turn * (Math.PI / 3));
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
        if (now - this.sampleAt >= SHIMMER * 1000) { const n = this.stars.length; this.sample = n > 1 ? (this.sample + 1 + Math.floor(Math.random() * (n - 1))) % n : 0; this.sampleAt = now; }
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
