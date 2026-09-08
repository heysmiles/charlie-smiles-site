import { spline, smootherstep, lerp } from './math';
import { L } from './layout';

/**
 * The break front never stops: it runs from L.frontStart to L.frontEnd over
 * the whole section, so the wave is crashing the entire time.
 */
export function frontAt(t: number) {
  return lerp(L.frontStart, L.frontEnd, Math.min(1, Math.max(0, t)));
}

/**
 * The camera's story as one continuous path over section progress [0,1].
 *
 *   0.00-0.40  side-on at the water, closing in on the breaking wave
 *   0.40-0.62  straight in under the lip, the look turning once, down the line
 *   0.62-0.86  inside the tube, the exit ahead
 *   0.86-1.00  up out of the mouth, turning away from the shore to face the
 *              open ocean and the sun, and resting there
 *
 * Until the exit, x is relative to the break front — the camera travels with
 * the wave, so the tube holds its place in the frame while the wave keeps
 * crashing. After the exit the frame lets go of the front (blended, so the
 * motion stays continuous) and the last keys are fixed, facing the sea.
 */
const RELEASE = 0.86;
const F_HOLD = lerp(-32, -190, RELEASE); // frontAt(RELEASE), the fixed frame's origin
const wx = (worldX: number) => worldX - F_HOLD;

// [x (relative to the front), y, z, lookX (relative), lookY, lookZ, fov]
const PATH: { t: number; v: number[] }[] = [
  { t: 0.0, v: [40, 5, -46, 28, 6.5, 4, 42] },
  { t: L.pin, v: [41, 5.3, -44, 29, 4.8, 3, 43] },
  { t: 0.4, v: [44, 6.5, -32, 40, 6, -2, 46] },
  { t: 0.52, v: [50, 7.5, -18, 34, 7, -6, 52] },
  { t: 0.62, v: [57, 6.5, -9, 18, 6, -8, 60] },
  { t: 0.74, v: [54, 6.5, -8, 12, 6, -8, 62] },
  { t: 0.86, v: [43, 8.5, -9, -8, 6, -16, 58] },
  { t: 0.93, v: [wx(-124), 16, -22, wx(-112), 10, 40, 54] },
  { t: 1.0, v: [wx(-120), 20, -30, wx(-100), 8, 220, 50] },
];

export type CamState = { pos: number[]; look: number[]; fov: number };

export function cameraAt(t: number): CamState {
  const v = spline(PATH, t);
  const f = frontAt(t);
  // Ride with the front, then ease onto the fixed frame for the shore.
  const fx = f - (f - F_HOLD) * smootherstep(RELEASE, 0.97, t);
  return { pos: [v[0] + fx, v[1], v[2]], look: [v[3] + fx, v[4], v[5]], fov: v[6] };
}
