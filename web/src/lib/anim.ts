export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Hermite smoothstep between two edges. */
export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6));
  return t * t * (3 - 2 * t);
}

/** Even smoother — no second-derivative kink. Good for camera moves. */
export function smootherstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Map x from [a0,a1] into [b0,b1], clamped and eased. */
export function remap(x: number, a0: number, a1: number, b0: number, b1: number) {
  return lerp(b0, b1, clamp((x - a0) / (a1 - a0 || 1e-6)));
}

/** Frame-rate independent exponential approach. */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/**
 * Piecewise keyframe interpolation with smootherstep easing between stops.
 * Keys must be sorted by `t`.
 */
export function keyframes<T extends number[]>(
  keys: { t: number; v: T }[],
  t: number,
  out: number[] = []
): number[] {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0].v.slice();
  if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const k = smootherstep(a.t, b.t, t);
  out.length = a.v.length;
  for (let j = 0; j < a.v.length; j++) out[j] = lerp(a.v[j], b.v[j], k);
  return out;
}

/** Shortest-path damping for angles. Plain damp() spins the long way at ±π. */
export function dampAngle(current: number, target: number, lambda: number, dt: number) {
  const TAU = Math.PI * 2;
  let d = (target - current) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return current + d * (1 - Math.exp(-lambda * dt));
}

/** Shortest-path interpolation between two angles. */
export function lerpAngle(a: number, b: number, t: number) {
  const TAU = Math.PI * 2;
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}
