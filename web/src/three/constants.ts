const coarse =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820);

/** One place to tune the wave's shape and cost. */
export const WAVE = {
  /** How far the wave runs along X, in world units. */
  length: 260,
  /** Crest height at its tallest. Tall enough to put a camera inside. */
  height: 16,
  /** How much of the wave the break transition spans — this sets tube length. */
  breakWidth: 0.46,
  segU: coarse ? 160 : 320,
  segS: coarse ? 60 : 110,
} as const;

/**
 * The sun sits on the horizon in the mouth of the tube. A tube's mouth is not
 * straight down the line — it opens ahead *and toward the beach*, where the
 * lip has not come down yet — so the sun, the coast, and the camera's final
 * heading all share this diagonal.
 */
/**
 * The mouth is down the tube's axis, which follows the wave line as it bends
 * offshore (+Z) — so the look angle is negative: toward the face, not toward
 * the beach. Aim toward the beach and you stare into the falling lip.
 */
export const MOUTH_YAW = -0.24;
export const SUN_DIR: [number, number, number] = [-Math.cos(MOUTH_YAW), 0.062, -Math.sin(MOUTH_YAW)];

/** Where the camera sits along the break, as a fraction of breakWidth past the front. */
export const CAM_P = 0.62;

/**
 * Ahead of the tube the wave line runs away offshore at the peel angle. A wave
 * dead straight down the line walls off the horizon no matter how the lip is
 * shaped; one that angles away is what opens the mouth over the shoulder.
 * Mostly linear (the peel angle) with a little curve on top, in world units
 * of distance ahead of the camera.
 */
export const BEND = { slope: Math.tan(0.28), k: 0.001, lead: 0.02, max: 120 } as const;

/** CPU twin of the vertex shader's bend. */
export function bendZ(u: number, camU: number, waveLen: number) {
  const ahead = Math.min(BEND.max, Math.max(0, camU - u - BEND.lead) * waveLen);
  return BEND.slope * ahead + BEND.k * ahead * ahead;
}

export const IS_COARSE = coarse;
