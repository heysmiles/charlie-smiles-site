/**
 * The star on the landing page: the original clip — three grainy stars that
 * slide from a row into one burst and back, 5 s at 60 fps — looping, drawn
 * onto a canvas so it is always transparent and never shows a play button.
 *
 * The clip comes from a muted, hidden `<video>` whose frames are copied to
 * the canvas every animation frame: `star.webm` (VP9 with alpha) for
 * Chrome and Firefox, `star.mov` (HEVC with alpha) for Safari and iOS. When
 * a browser will not autoplay (phones in low-power mode show a play button
 * instead) or cannot play either file, a sprite sheet of the clip's frames
 * at 15 fps stands in. Nothing is synthesized: the clip is the animation.
 */
// The fallback sheet: 9 columns of 15 fps frames, 480 px for larger screens, 256 px for phones.
const SHEET = { fps: 15, cols: 9, frames: 75 };

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
  private videoOk = false;
  private sheet: HTMLImageElement | null = null;
  private px = 480; // the sheet's frame size
  private sheetStart = performance.now();

  constructor(canvas: HTMLCanvasElement, base: string) {
    this.canvas = canvas; this.base = base;
    this.ctx = canvas.getContext('2d')!;
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.small = Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches;
    this.px = this.small ? 256 : 480;
    this.setupVideo();
  }

  /** The clip as a looping video, in whichever alpha format this browser plays; the sheet if neither. */
  private setupVideo() {
    const v = document.createElement('video');
    const mov = v.canPlayType('video/quicktime; codecs="hvc1"'), webm = v.canPlayType('video/webm; codecs="vp9"');
    const safari = /apple/i.test(navigator.vendor) || /iP(hone|ad|od)/.test(navigator.userAgent);
    // Safari plays WebM but drops its alpha, so it must take the HEVC file.
    const src = safari ? (mov ? 'star.mov' : null) : (webm ? 'star.webm' : mov ? 'star.mov' : null);
    if (!src) { this.useSheet(); return; }
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('loop', '');
    v.src = `${this.base}brand/${src}`;
    v.onerror = () => this.useSheet();
    v.oncanplay = () => {
      v.oncanplay = null;
      // Prove autoplay works; otherwise fall back to the sheet.
      const p = v.play();
      if (p) p.then(() => { this.videoOk = true; if (!this.running || this.still) v.pause(); this.frame(); }).catch(() => this.useSheet());
      else { this.videoOk = true; this.frame(); }
    };
    this.video = v;
  }

  /** The fallback: the sheet of the clip's frames. */
  private useSheet() {
    if (this.sheet) return;
    if (this.video) { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); }
    this.video = null; this.videoOk = false;
    const img = new Image(); img.decoding = 'async';
    img.src = `${this.base}brand/star-${this.px}.webp`;
    img.onload = () => { this.sheet = img; this.sheetStart = performance.now(); this.frame(); };
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
    if (this.videoOk) this.video!.play().catch(() => {});
    const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); if (this.video) this.video.pause(); }
  dispose() { this.stop(); if (this.video) { this.video.removeAttribute('src'); this.video.load(); } }

  private drawSheetFrame(f: number) {
    if (!this.sheet) return;
    const S = this.canvas.width, px = this.px;
    this.ctx.drawImage(this.sheet, (f % SHEET.cols) * px, Math.floor(f / SHEET.cols) * px, px, px, 0, 0, S, S);
  }

  frame() {
    const S = this.canvas.width;
    if (S === 0) return;
    const g = this.ctx;
    g.clearRect(0, 0, S, S);
    if (this.videoOk && this.video && this.video.readyState >= 2) { g.drawImage(this.video, 0, 0, S, S); return; }
    if (this.sheet) {
      // Reduced motion: the first frame, still.
      const f = this.still ? 0 : Math.floor(((performance.now() - this.sheetStart) / 1000) * SHEET.fps) % SHEET.frames;
      this.drawSheetFrame(f);
    }
  }
}
