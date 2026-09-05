export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a || 1e-6));
  return t * t * (3 - 2 * t);
}
export function smootherstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a || 1e-6));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
export const remap = (x: number, a0: number, a1: number, b0: number, b1: number) =>
  lerp(b0, b1, clamp01((x - a0) / (a1 - a0 || 1e-6)));

/** Deterministic hash in [0,1). */
export function hash(x: number, y = 0, z = 0) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
/** Smooth 2D value noise in [0,1]. */
export function noise2(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm2(x: number, y: number, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * noise2(x * f, y * f); amp *= 0.5; f *= 2.03; }
  return v;
}

/** Piecewise keyframes with smootherstep easing between stops. */
export function keyframes(keys: { t: number; v: number[] }[], t: number): number[] {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0].v.slice();
  if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1];
  const k = smootherstep(a.t, b.t, t);
  return a.v.map((av, j) => lerp(av, b.v[j], k));
}

/**
 * One continuous curve through the keys (Catmull-Rom on non-uniform knots,
 * eased to rest at both ends). Unlike `keyframes`, the motion never stops at a
 * stop: velocity is continuous across every key.
 */
export function spline(keys: { t: number; v: number[] }[], t: number): number[] {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0].v.slice();
  if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const k1 = keys[i], k2 = keys[i + 1];
  const k0 = keys[Math.max(0, i - 1)], k3 = keys[Math.min(n - 1, i + 2)];
  const h = k2.t - k1.t;
  const s = (t - k1.t) / h;
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  return k1.v.map((p1, j) => {
    const p2 = k2.v[j];
    // Tangents in units per segment; zero at the ends so the path eases in and out.
    const m1 = i === 0 ? 0 : ((p2 - k0.v[j]) / (k2.t - k0.t)) * h;
    const m2 = i === n - 2 ? 0 : ((k3.v[j] - p1) / (k3.t - k1.t)) * h;
    return h00 * p1 + h10 * m1 + h01 * p2 + h11 * m2;
  });
}
