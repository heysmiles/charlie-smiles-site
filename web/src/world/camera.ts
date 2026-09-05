import { spline } from './math';
import { L } from './layout';

/**
 * The camera's story as one continuous path over section progress [0,1].
 * Progress starts the moment the section's top edge enters the viewport
 * (the landing is still on screen), pins at L.pin, and ends on the beach.
 *
 *   0.00-0.42  side-on at the water, the wave high in frame; the break crosses
 *   0.42-0.64  swing around to the mouth of the barrel, in past the surfer
 *   0.64-0.70  inside, turning to look down the line at the surfer and the sun
 *   0.70-1.00  up out of the mouth and over to the shore as the wave runs on
 *
 * The break front holds while the camera is inside the tube, so the barrel
 * sits still at x ≈ -13 through the dive and every key can be in world space.
 */
// [x, y, z, lookX, lookY, lookZ, fov]
const PATH: { t: number; v: number[] }[] = [
  { t: 0.0, v: [8, 5, -46, -4, 4.5, 4, 42] },
  { t: L.pin, v: [3, 5.3, -47, -9, 4.8, 3, 43] },
  { t: 0.42, v: [-8, 6.5, -48, -20, 6, 2, 46] },
  { t: 0.5, v: [-26, 8, -34, -18, 8, -4, 50] },
  { t: 0.58, v: [-50, 8, -22, -22, 8, -3, 52] },
  { t: 0.64, v: [-34, 7, -9, -14, 8, -2, 58] },
  { t: 0.7, v: [-22, 7, -9, -60, 6, -8, 60] },
  { t: 0.76, v: [-44, 20, -20, -70, 7, -60, 54] },
  { t: 0.84, v: [-30, 27, -50, -40, 7, -150, 50] },
  { t: 0.92, v: [-12, 27, -72, 0, 6, -190, 50] },
  { t: 1.0, v: [0, 14, -96, 0, 4, -190, 54] },
];

export type CamState = { pos: number[]; look: number[]; fov: number };

export function cameraAt(t: number): CamState {
  const v = spline(PATH, t);
  return { pos: [v[0], v[1], v[2]], look: [v[3], v[4], v[5]], fov: v[6] };
}
