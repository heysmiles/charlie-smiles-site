/**
 * The world's fixed geography, in world units (roughly metres).
 *
 *   +X ──── along the wave line (the break travels toward -X)
 *   +Z ──── out to sea. The shore is at -Z.
 *   +Y ──── up
 *
 * The wave crest line runs along X at Z = 0. The beach begins at SHORE_Z.
 */
export const L = {
  waveLength: 320,
  waveHeight: 14,
  /** How much of the wave the break transition spans. */
  breakLen: 92,
  shoreZ: -200,
  townZ: -262,
  hillsZ: -370,
  /** Where the break front is at the first and last scroll; it never stops. */
  frontStart: -32,
  frontEnd: -190,
  /** The low range down the line, about where the pier used to stand. */
  rangeX: -480,
  /** Low over the sea, down the line: it sets over the seaward end of the range. */
  sunDir: [-0.8, 0.07, 0.45] as const,
  /** Where the camera comes to rest: seaward of the wave, facing the sea with the sun to the right. */
  endCam: { pos: [-120, 14, 70] as const, look: [-360, 60, 390] as const },
  /** Height of the wave's scroll track, in viewport heights. */
  trackVh: 560,
  /** Progress at which the stage fills the frame and pins (one viewport of slide-in). */
  pin: 100 / 560,
} as const;
