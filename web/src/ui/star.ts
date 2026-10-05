/**
 * The star on the landing page: the original clip (three grainy stars that
 * slide from a row into one burst and back) played from a sprite sheet on a
 * canvas, not from a `<video>`. Phones in low-power mode refuse to autoplay
 * video and show a play button instead, and a video's poster showed black
 * behind the star; a sheet of frames has neither problem. It starts when the
 * page does, it is transparent, and it is the clip's own frames.
 *
 * Two sheets, both 9 columns of 15 fps frames: 320 px frames for larger
 * screens, 224 px for phones.
 *
 * The loop lingers in the row: the first half-second (stars in a row, turning
 * slightly) is played back and forth for a few seconds before the clip runs
 * through, so the gathering happens less often and feels like the event.
 */
const FPS = 15;
const COLS = 9;
const FRAMES = 75; // 5 s
const HOLD_FRAMES = 8; // the opening stretch that is played back and forth
const HOLD_SECONDS = 3.5;

export class StarAnim {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sheet: HTMLImageElement | null = null;
  private px = 320;
  private size = 0; private dpr = 1;
  private raf = 0;
  private running = false;
  private t0 = performance.now();
  private still: boolean;
  private lastFrame = -1;

  constructor(canvas: HTMLCanvasElement, base: string) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches;
    this.px = small ? 224 : 320;
    const img = new Image();
    img.decoding = 'async';
    img.src = `${base}brand/star-${this.px}.webp`;
    img.onload = () => { this.sheet = img; this.lastFrame = -1; this.frame(); };
  }

  resize(cssSize: number) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const size = Math.max(1, Math.round(cssSize));
    if (size === this.size && dpr === this.dpr) return;
    this.size = size; this.dpr = dpr;
    this.canvas.width = this.canvas.height = Math.round(size * dpr);
    this.lastFrame = -1;
    this.frame();
  }

  start() { if (this.running || this.still) return; this.running = true; const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  dispose() { this.stop(); }

  /** Which frame of the clip to show at time t (seconds into the loop). */
  private frameAt(t: number) {
    const holdLen = HOLD_FRAMES / FPS; // one pass of the opening stretch
    if (t < HOLD_SECONDS) {
      // back and forth over the opening frames
      const u = (t % (holdLen * 2)) / holdLen;
      const f = u < 1 ? u * HOLD_FRAMES : (2 - u) * HOLD_FRAMES;
      return Math.min(HOLD_FRAMES - 1, Math.floor(f));
    }
    return Math.min(FRAMES - 1, Math.floor((t - HOLD_SECONDS) * FPS));
  }

  frame() {
    const S = this.canvas.width;
    if (!this.sheet || S === 0) return;
    const loop = HOLD_SECONDS + FRAMES / FPS;
    const t = this.still ? 0 : ((performance.now() - this.t0) / 1000) % loop;
    const f = this.frameAt(t);
    if (f === this.lastFrame) return;
    this.lastFrame = f;
    const g = this.ctx, px = this.px;
    g.clearRect(0, 0, S, S);
    g.drawImage(this.sheet, (f % COLS) * px, Math.floor(f / COLS) * px, px, px, 0, 0, S, S);
  }
}
