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
 *   0.86-1.00  up out of the mouth and over the shoulder to rest off the
 *              beach, facing Venice — Windward straight ahead
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
  // Low through the entry: the camera passes under the falling lip, not
  // through it (the lip's underside hangs to about y 6 at the tip).
  { t: 0.52, v: [50, 4.6, -18, 34, 7, -6, 52] },
  { t: 0.62, v: [57, 4.4, -9, 18, 6, -8, 60] },
  { t: 0.74, v: [54, 5.8, -8, 12, 6, -8, 62] },
  // Out: slide shoreward beneath the lip's tip first, then rise.
  { t: 0.86, v: [43, 5.2, -10, -8, 6, -16, 58] },
  { t: 0.9, v: [wx(-124), 8, -25, wx(-130), 10, -120, 56] },
  { t: 0.93, v: [wx(-120), 15, -42, wx(-118), 9, -200, 54] },
  { t: 0.96, v: [wx(-118), 20, -68, wx(-116), 8, -260, 52] },
  { t: 1.0, v: [wx(L.endCam.pos[0]), L.endCam.pos[1], L.endCam.pos[2], wx(L.endCam.look[0]), L.endCam.look[1], L.endCam.look[2], 50] },
];

export type CamState = { pos: number[]; look: number[]; fov: number };

export function cameraAt(t: number): CamState {
  const v = spline(PATH, t);
  const f = frontAt(t);
  // Ride with the front, then ease onto the fixed frame for the shore.
  const fx = f - (f - F_HOLD) * smootherstep(RELEASE, 0.97, t);
  return { pos: [v[0] + fx, v[1], v[2]], look: [v[3] + fx, v[4], v[5]], fov: v[6] };
}
