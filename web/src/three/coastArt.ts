import * as THREE from 'three';
import { palette } from '../lib/palette';

/**
 * Venice, drawn to canvas rather than modelled.
 *
 * These are stand-ins with the right silhouette and the right parallax — enough
 * to prove the shot lands. They are meant to be replaced by real art.
 * The canvas bottom edge is the waterline in every layer.
 */

type Ctx = CanvasRenderingContext2D;

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, x: c.getContext('2d')! };
}

function toTexture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipMapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** A soft ridge line built from stacked sines. */
function ridge(x: Ctx, w: number, base: number, amp: number, seed: number, color: string) {
  x.beginPath();
  x.moveTo(0, base + amp * 2);
  for (let i = 0; i <= w; i += 4) {
    const t = i / w;
    const y =
      base -
      amp *
        (0.55 * Math.sin(t * 5.1 + seed) +
          0.28 * Math.sin(t * 11.3 + seed * 2.1) +
          0.17 * Math.sin(t * 23.7 + seed * 3.7) +
          0.5);
    x.lineTo(i, y);
  }
  x.lineTo(w, base + amp * 2);
  x.closePath();
  x.fillStyle = color;
  x.fill();
}

export function mountainLayer() {
  const W = 2048;
  const H = 512;
  const { c, x } = makeCanvas(W, H);
  const base = H * 0.93;
  // Far ridge only over the northern (left) half — Venice itself is flat.
  x.save();
  x.globalAlpha = 0.55;
  ridge(x, W, base, H * 0.30, 1.7, palette.landFar);
  x.restore();
  x.globalAlpha = 0.75;
  ridge(x, W, base, H * 0.17, 4.2, palette.landMid);
  x.globalAlpha = 1;

  // Haze that eats the base of the hills.
  const g = x.createLinearGradient(0, base - H * 0.6, 0, base);
  g.addColorStop(0, 'rgba(232,132,58,0)');
  g.addColorStop(0.5, 'rgba(232,132,58,0.12)');
  g.addColorStop(1, 'rgba(232,132,58,0.5)');
  x.fillStyle = g;
  x.fillRect(0, base - H * 0.6, W, H * 0.6);
  return toTexture(c);
}

/** x positions here must agree with LANDMARKS in Coastline.tsx. */
export function cityLayer() {
  const W = 2048;
  const H = 512;
  const { c, x } = makeCanvas(W, H);
  const base = H * 0.96;
  const ux = (worldX: number) => ((worldX + 600) / 1200) * W;

  x.fillStyle = palette.landMid;

  // --- Santa Monica Pier, at world x = -300 ---
  const pierC = ux(-260);
  const deckY = base - H * 0.085;
  const pierW = W * 0.115;
  x.fillRect(pierC - pierW / 2, deckY, pierW, H * 0.022);
  for (let i = 0; i <= 11; i++) {
    const lx = pierC - pierW / 2 + (pierW * i) / 11;
    x.fillRect(lx - 1.5, deckY, 3, base - deckY);
  }
  // ferris wheel
  const fwX = pierC + pierW * 0.16;
  const fwY = deckY - H * 0.075;
  const fwR = H * 0.072;
  x.strokeStyle = palette.landMid;
  x.lineWidth = 3;
  x.beginPath();
  x.arc(fwX, fwY, fwR, 0, Math.PI * 2);
  x.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    x.beginPath();
    x.moveTo(fwX, fwY);
    x.lineTo(fwX + Math.cos(a) * fwR, fwY + Math.sin(a) * fwR);
    x.stroke();
  }
  // roller coaster hump
  x.beginPath();
  x.moveTo(pierC - pierW * 0.42, deckY);
  x.quadraticCurveTo(pierC - pierW * 0.22, deckY - H * 0.07, pierC - pierW * 0.02, deckY);
  x.stroke();

  // --- low-rise beachfront across the whole coast ---
  let bx = 0;
  let seed = 3;
  while (bx < W) {
    seed = (seed * 9301 + 49297) % 233280;
    const r = seed / 233280;
    const bw = 14 + r * 46;
    const bh = H * (0.028 + r * 0.075);
    // leave a gap where the pier is
    if (Math.abs(bx - pierC) > pierW * 0.75) {
      x.fillRect(bx, base - bh, bw, bh);
    }
    bx += bw + 4 + r * 12;
  }

  // --- a taller block at Stanley's office, world x = +290 ---
  const stanX = ux(250);
  x.fillRect(stanX - 26, base - H * 0.235, 52, H * 0.235);
  x.fillStyle = 'rgba(255,214,150,0.55)';
  for (let r = 0; r < 7; r++)
    for (let cc = 0; cc < 3; cc++)
      x.fillRect(stanX - 18 + cc * 13, base - H * 0.222 + r * H * 0.030, 7, H * 0.016);

  return toTexture(c);
}

export function beachLayer() {
  const W = 2048;
  const H = 384;
  const { c, x } = makeCanvas(W, H);
  const base = H;
  const ux = (worldX: number) => ((worldX + 450) / 900) * W;

  // sand
  x.fillStyle = palette.landNear;
  x.fillRect(0, base - H * 0.10, W, H * 0.10);

  // --- Venice skate park bowl, world x = -20 ---
  const skX = ux(-15);
  x.beginPath();
  x.moveTo(skX - 70, base - H * 0.10);
  x.bezierCurveTo(skX - 46, base - H * 0.20, skX + 46, base - H * 0.20, skX + 70, base - H * 0.10);
  x.closePath();
  x.fillStyle = palette.landNear;
  x.fill();
  x.strokeStyle = 'rgba(255,214,150,0.35)';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(skX - 56, base - H * 0.125);
  x.bezierCurveTo(skX - 34, base - H * 0.185, skX + 34, base - H * 0.185, skX + 56, base - H * 0.125);
  x.stroke();

  // --- palms, thicker around Brooks (world x = +130) ---
  const palm = (px: number, ph: number) => {
    x.strokeStyle = palette.landNear;
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(px, base - H * 0.10);
    x.quadraticCurveTo(px + 5, base - H * 0.10 - ph * 0.6, px + 2, base - H * 0.10 - ph);
    x.stroke();
    x.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.46;
      x.beginPath();
      x.moveTo(px + 2, base - H * 0.10 - ph);
      x.quadraticCurveTo(
        px + 2 + Math.cos(a) * 16,
        base - H * 0.10 - ph + Math.sin(a) * 14,
        px + 2 + Math.cos(a) * 30,
        base - H * 0.10 - ph + Math.sin(a) * 20 + 8
      );
      x.stroke();
    }
  };
  let s = 11;
  for (let i = 0; i < 46; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    palm(r * W, H * (0.11 + r * 0.13));
  }
  palm(ux(115) - 22, H * 0.2);
  palm(ux(115) + 26, H * 0.24);

  return toTexture(c);
}
