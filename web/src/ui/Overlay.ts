/**
 * The 2D layer over the stage: the pixel burst at the cursor on every tap,
 drawn to a canvas in CSS pixels, nearest-neighbour,
 * on a 2px grid, so it reads as pixels rather than particles.
 */
type Pixel = { x: number; y: number; vx: number; vy: number; life: number; max: number; s: number; c: string };

const INK = ['#ffffff', '#fff9f5', '#fff3e6'];

export class Overlay {
  private ctx: CTX;
  private px: Pixel[] = [];
  private w = 0; private h = 0; private dpr = 1;

  private canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  resize(w: number, h: number) {
    this.w = w; this.h = h; this.dpr = Math.min(devicePixelRatio, 2);
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`;
  }

  /** A very small firework at (x, y), in CSS pixels: a dozen white pixels out and down. */
  burst(x: number, y: number) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const sp = 36 + Math.random() * 70;
      this.px.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 24, life: 0, max: 0.22 + Math.random() * 0.2, s: 2, c: INK[Math.floor(Math.random() * INK.length)] });
    }
  }

  draw(dt: number) {
    const g = this.ctx, d = this.dpr;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.imageSmoothingEnabled = false;
    // Pixels.
    for (let i = this.px.length - 1; i >= 0; i--) {
      const p = this.px[i]; p.life += dt;
      if (p.life >= p.max) { this.px.splice(i, 1); continue; }
      p.vx *= 1 - dt * 4; p.vy = p.vy * (1 - dt * 4) + 160 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const u = p.life / p.max;
      // Twinkle out: the last third blinks.
      g.globalAlpha = u < 0.66 ? 1 : (Math.floor(u * 30) % 2 ? 1 : 0.25);
      g.fillStyle = p.c;
      g.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, p.s, p.s);
    }
    g.globalAlpha = 1;
  }
}

type CTX = CanvasRenderingContext2D;
