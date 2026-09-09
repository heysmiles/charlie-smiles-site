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
  rangeX: -900,
  /** Low over the sea, down the line: it sets over the seaward end of the range. */
  sunDir: [-0.8, 0.07, 0.45] as const,
  /** Windward Avenue's x along the beach — the centre of Venice, under the camera's rest. */
  veniceX: -115,
  /** Where the camera comes to rest: off the beach, facing Windward. */
  endCam: { pos: [-115, 15, -96] as const, look: [-115, 8, -300] as const },
  /** Height of the wave's scroll track, in viewport heights. */
  trackVh: 560,
  /** Progress at which the stage fills the frame and pins (one viewport of slide-in). */
  pin: 100 / 560,
} as const;
