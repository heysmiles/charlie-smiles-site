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
 * Progress starts the moment the wave section's top enters the viewport, so
 * the world is already moving under the landing.
 *
 *   0.00-0.42  side-on at the water, closing in; the barrel a little left
 *   0.42-0.64  swing round to the mouth of the barrel, in past the surfer
 *   0.64-0.70  inside, turning to look down the line at the surfer and the sun
 *   0.70-1.00  up out of the mouth and over to the shore
 *
 * Until the exit, x is relative to the break front — the camera travels with
 * the wave, so the barrel (front + 0.62·breakLen) holds its place in the
 * frame while the wave keeps crashing. After the exit the frame lets go of
 * the front (blended, so the motion stays continuous) and the last keys are
 * fixed on the town.
 */
const RELEASE = 0.72;
const F_HOLD = -32 - (190 - 32) * RELEASE; // frontAt(RELEASE)
const wx = (worldX: number) => worldX - F_HOLD; // a world x, expressed for the fixed keys

// [x (relative to the front), y, z, lookX (relative), lookY, lookZ, fov]
const PATH: { t: number; v: number[] }[] = [
  { t: 0.0, v: [40, 5, -46, 28, 4.5, 4, 42] },
  { t: L.pin, v: [41, 5.3, -44, 29, 4.8, 3, 43] },
  { t: 0.42, v: [44, 6.5, -38, 34, 6, 0, 46] },
  { t: 0.5, v: [44, 8, -34, 52, 8, -4, 50] },
  { t: 0.58, v: [20, 8, -22, 48, 8, -3, 52] },
  { t: 0.64, v: [36, 7, -9, 56, 8, -2, 58] },
  { t: 0.7, v: [48, 7, -9, 10, 6, -8, 60] },
  { t: 0.76, v: [26, 20, -24, 0, 7, -100, 54] },
  { t: 0.84, v: [wx(-36), 27, -70, wx(-40), 7, L.townZ, 50] },
  { t: 0.92, v: [wx(-12), 27, -130, wx(0), 6, L.townZ - 12, 50] },
  { t: 1.0, v: [wx(0), 14, L.shoreZ + 24, wx(0), 4, L.townZ - 12, 54] },
];

export type CamState = { pos: number[]; look: number[]; fov: number };

export function cameraAt(t: number): CamState {
  const v = spline(PATH, t);
  const f = frontAt(t);
  // Ride with the front, then ease onto the fixed frame for the shore.
  const fx = f - (f - F_HOLD) * smootherstep(RELEASE, 0.9, t);
  return { pos: [v[0] + fx, v[1], v[2]], look: [v[3] + fx, v[4], v[5]], fov: v[6] };
}
