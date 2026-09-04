import { keyframes, smootherstep } from './math';
import { L } from './layout';

/**
 * The camera's story, in section scroll [0,1]:
 *   0.00-0.50  side-on from the shoreward side; the break crosses the frame
 *   0.50-0.70  dive: into the barrel, a beat looking down the line, and out
 *   0.70-1.00  rise, turn to the shore, settle on the beach town
 *
 * Positions in the dive chapter are relative to the barrel, which sits a fixed
 * distance up the wave from the break front.
 */
// [x, y, z, lookX, lookY, lookZ, fov]
const SIDE: { t: number; v: number[] }[] = [
  { t: 0.0, v: [12, 20, -74, 2, 3, 2, 48] },
  { t: 0.5, v: [-8, 19, -68, -14, 3, 2, 48] },
];
// Straight in from the shore side toward the barrel, then a beat looking
// down the line, then out over the shoulder.
const DIVE: { t: number; v: number[] }[] = [
  { t: 0.5, v: [0, 19, -68, -6, 3, 2, 48] },
  { t: 0.57, v: [-6, 9, -30, -10, 7, -8, 52] },
  { t: 0.63, v: [-2, 7, -7, -40, 6.5, -7, 60] },
  { t: 0.68, v: [-16, 9, -12, -60, 7, -18, 56] },
  { t: 0.7, v: [-30, 12, -30, -80, 8, -60, 52] },
];
const SHORE: { t: number; v: number[] }[] = [
  { t: 0.7, v: [-30, 12, -30, -80, 8, -60, 52] },
  { t: 0.84, v: [-10, 28, -70, 0, 6, -190, 50] },
  { t: 1.0, v: [0, 14, -96, 0, 4, -190, 54] },
];

export type CamState = { pos: number[]; look: number[]; fov: number };

export function cameraAt(t: number, frontX: number): CamState {
  const barrelX = frontX + L.breakLen * 0.62;
  let v: number[];
  if (t < 0.5) v = keyframes(SIDE, t);
  else if (t < 0.7) {
    v = keyframes(DIVE, t);
    // Relative to the barrel, blending in from the side-on shot's world frame.
    const rel = smootherstep(0.5, 0.57, t) * (1 - smootherstep(0.68, 0.7, t));
    v[0] += barrelX * rel; v[3] += barrelX * rel;
  } else v = keyframes(SHORE, t);
  return { pos: [v[0], v[1], v[2]], look: [v[3], v[4], v[5]], fov: v[6] };
}
