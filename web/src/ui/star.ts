/**
 * The star on the landing page: the original clip (three grainy stars that
 * slide from a row into one burst and back) played from a sprite sheet on a
 * canvas, not from a `<video>`. Phones in low-power mode refuse to autoplay
 * video and show a play button instead, and a video's poster showed black
 * behind the star; a sheet of frames has neither problem. It starts when the
 * page does, it is transparent, and it is the clip's own frames.
 *
 * Two sheets, both 9 columns of 15 fps frames: 480 px frames for larger
 * screens, 256 px for phones.
 *
 * The loop lingers in the row before each gathering: for a few seconds the
 * three stars turn slowly in place, easing to rest exactly on the clip's
 * first frame; then the clip runs through, and its last frame hands back to
 * the row. Each star turns a whole sixth, so it lands where it began.
 *
 * The turning stars are cut from the clip itself, so they are the clip's own
 * pixels — same softness, colour and dark heart. In the row the stars' side
 * arms overlap their neighbours' tips, but the top arm of each is clear, and
 * a six-point star repeats every sixth of a turn: so one clean wedge,
 * replicated six times, is the whole star. The clip's grain changes every
 * frame, and a frozen grain turning would read as a cut at each seam, so the
 * stars are cut from six resting frames (the clip's first three and last
 * three, which share one pose) and cycled at the clip's frame rate during
 * the hold: the shimmer never stops, and neither seam shows.
 */
const FPS = 15;
const COLS = 9;
const FRAMES = 75; // 5 s
const HOLD = 3.6; // seconds of slow turning before the clip runs
const CLIP = 720; // the clip's frame size, which the layout below is measured in
const ROW = { cx: [172, 360, 540], cy: 360, size: 492 }; // the stars in the clip's first frame
const TURN = [1, -1, 1]; // sixths of a turn each star makes during the hold
const REST = [0, 1, 2, 72, 73, 74]; // the clip's resting frames, all in the row pose: grain samples for the hold

const ease = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/**
 * One star cut from the clip's first frame: every pixel of the star is read
 * from the top wedge (a sixth of a turn, centred on the upward arm) by
 * rotating its position into that wedge — the star repeats every sixth, so
 * this is the whole star from its one clean wedge, with no edges between
 * copies. Then trimmed to the star's silhouette (the single-star artwork's
 * alpha, boosted so the faint tips survive) so nothing of the neighbours'
 * tips comes along.
 */
function extract(sheet: HTMLImageElement, px: number, silhouette: HTMLImageElement, k: number, f: number) {
  const s = px / CLIP;
  const D = Math.round(ROW.size * s * 1.3), h = D / 2;
  // The frame cell with this star centred, and the silhouette at the same scale.
  const src = document.createElement('canvas'); src.width = src.height = D;
  const sg = src.getContext('2d')!;
  sg.drawImage(sheet, (f % COLS) * px, Math.floor(f / COLS) * px, px, px, h - ROW.cx[k] * s, h - ROW.cy * s, px, px);
  const sd = sg.getImageData(0, 0, D, D).data;
  const span = 512 * s; // the artwork's 512 px spans 492 clip units
  const mk = document.createElement('canvas'); mk.width = mk.height = D;
  const mg = mk.getContext('2d')!;
  mg.drawImage(silhouette, (D - span) / 2, (D - span) / 2, span, span);
  const md = mg.getImageData(0, 0, D, D).data;
  const out = document.createElement('canvas'); out.width = out.height = D;
  const og = out.getContext('2d')!;
  const id = og.createImageData(D, D), d = id.data;
  const SIXTH = Math.PI / 3, UP = -Math.PI / 2;
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const o = (y * D + x) * 4;
    const mask = Math.min(1, md[o + 3] * 6 / 255);
    if (mask <= 0) continue;
    const dx = x + 0.5 - h, dy = y + 0.5 - h;
    const r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    const n = Math.round((th - UP) / SIXTH);
    const t2 = th - n * SIXTH;
    const sx = h + r * Math.cos(t2) - 0.5, sy = h + r * Math.sin(t2) - 0.5;
    // bilinear sample of the source
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
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

export class StarAnim {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sheet: HTMLImageElement | null = null;
  private silhouette: HTMLImageElement | null = null;
  private stars: HTMLCanvasElement[][] = []; // per resting frame, the three stars; built one frame per tick
  private px = 480;
  private size = 0; private dpr = 1;
  private raf = 0;
  private running = false;
  private t0 = performance.now();
  private still: boolean;

  constructor(canvas: HTMLCanvasElement, base: string) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches;
    this.px = small ? 256 : 480;
    const sheet = new Image(); sheet.decoding = 'async';
    sheet.src = `${base}brand/star-${this.px}.webp`;
    sheet.onload = () => { this.sheet = sheet; this.ready(); };
    const star = new Image(); star.decoding = 'async';
    star.src = `${base}brand/star.png`;
    star.onload = () => { this.silhouette = star; this.ready(); };
  }

  private ready() { this.frame(); }

  /** Cut one more resting frame's stars, if any remain; spread over ticks so the first paint is not delayed. */
  private buildOne() {
    if (!this.sheet || !this.silhouette || this.stars.length >= REST.length) return;
    const f = REST[this.stars.length];
    this.stars.push([0, 1, 2].map((k) => extract(this.sheet!, this.px, this.silhouette!, k, f)));
  }

  resize(cssSize: number) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const size = Math.max(1, Math.round(cssSize));
    if (size === this.size && dpr === this.dpr) return;
    this.size = size; this.dpr = dpr;
    this.canvas.width = this.canvas.height = Math.round(size * dpr);
    this.frame();
  }

  start() { if (this.running || this.still) return; this.running = true; const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  dispose() { this.stop(); }

  /** The three stars in their row, each turned by `turn` sixths (0 = as in the clip's first frame), from grain sample `sample`. */
  private drawRow(turn: number, sample: number) {
    const set = this.stars[sample % this.stars.length];
    if (!set) return;
    const g = this.ctx, S = this.canvas.width, k = S / CLIP, up = S / this.px;
    g.save();
    g.globalCompositeOperation = 'multiply';
    set.forEach((star, i) => {
      g.save();
      g.translate(ROW.cx[i] * k, ROW.cy * k);
      g.rotate(TURN[i] * turn * (Math.PI / 3));
      const d = star.width * up;
      g.drawImage(star, -d / 2, -d / 2, d, d);
      g.restore();
    });
    g.restore();
  }

  private drawFrame(f: number) {
    if (!this.sheet) return;
    const S = this.canvas.width, px = this.px;
    this.ctx.drawImage(this.sheet, (f % COLS) * px, Math.floor(f / COLS) * px, px, px, 0, 0, S, S);
  }

  frame() {
    const S = this.canvas.width;
    if (S === 0 || !this.sheet) return;
    const loop = HOLD + FRAMES / FPS;
    const t = this.still ? 0 : ((performance.now() - this.t0) / 1000) % loop;
    this.buildOne();
    this.ctx.clearRect(0, 0, S, S);
    if (t < HOLD) {
      if (this.stars.length) {
        // a different grain sample each clip-frame tick, never the same one twice running
        const tick = Math.floor(t * FPS);
        const n = this.stars.length, sample = n > 1 ? (tick * 7 + Math.floor(tick / n)) % n : 0;
        this.drawRow(ease(t / HOLD), sample);
      } else this.drawFrame(0);
    } else {
      this.drawFrame(Math.min(FRAMES - 1, Math.floor((t - HOLD) * FPS)));
    }
  }
}
