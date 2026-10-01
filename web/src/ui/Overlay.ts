/**
 * The 2D layer over the stage: the pixel burst at the cursor on every tap,
 * and the cloud countdown. Drawn to a canvas in CSS pixels, nearest-neighbour,
 * on a 2px grid, so it reads as pixels rather than particles.
 */
type Pixel = { x: number; y: number; vx: number; vy: number; life: number; max: number; s: number; c: string };

const INK = ['#e86a17', '#fff3e6', '#66564a', '#ffb25c', '#fff9f5'];

export class Overlay {
  private ctx: CTX;
  private px: Pixel[] = [];
  private badge: { x: number; y: number; readyAt: number; nudge: number } | null = null;
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

  /** A small pixelated explosion at (x, y), in CSS pixels. */
  burst(x: number, y: number) {
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const sp = 80 + Math.random() * 200;
      this.px.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0, max: 0.32 + Math.random() * 0.3, s: 2 + Math.floor(Math.random() * 3) * 2, c: INK[Math.floor(Math.random() * INK.length)] });
    }
  }

  /** Show (or move) the cloud countdown at (x, y) until `readyAt` (world seconds; pass `now` each draw). */
  countdown(x: number, y: number, readyAt: number, nudge = false) {
    this.badge = { x, y, readyAt, nudge: nudge ? 1 : 0 };
  }

  draw(dt: number, now: number) {
    const g = this.ctx, d = this.dpr;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.imageSmoothingEnabled = false;
    // Pixels.
    for (let i = this.px.length - 1; i >= 0; i--) {
      const p = this.px[i]; p.life += dt;
      if (p.life >= p.max) { this.px.splice(i, 1); continue; }
      p.vx *= 1 - dt * 3; p.vy = p.vy * (1 - dt * 3) + 260 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const u = p.life / p.max;
      g.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      g.fillStyle = p.c;
      const s = u > 0.5 ? Math.max(2, p.s - 2) : p.s;
      g.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, s, s);
    }
    g.globalAlpha = 1;
    // The countdown badge: a tiny pixel cloud and the seconds left.
    if (this.badge) {
      const b = this.badge, left = b.readyAt - now;
      if (left <= 0) { this.badge = null; return; }
      b.nudge = Math.max(0, b.nudge - dt * 4);
      const shake = b.nudge > 0 ? Math.sin(now * 60) * 3 * b.nudge : 0;
      const x = Math.round(b.x + shake), y = Math.round(b.y - 30);
      g.fillStyle = 'rgba(102, 86, 74, 0.82)';
      g.fillRect(x - 24, y - 12, 48, 22);
      // pixel cloud
      g.fillStyle = '#fff9f5';
      for (const [dx, dy, w, h] of [[-18, -1, 14, 6], [-15, -4, 6, 3], [-11, -6, 6, 5], [-7, -3, 4, 2]]) g.fillRect(x + dx, y + dy, w, h);
      g.font = '700 12px "Fira Code", ui-monospace, monospace';
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillText(String(Math.ceil(left)), x + 4, y);
    }
  }
}

type CTX = CanvasRenderingContext2D;
