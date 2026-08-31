const coarse =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820);

/** One place to tune the wave's shape and cost. */
export const WAVE = {
  /** How far the wave runs along X, in world units. */
  length: 240,
  /** Crest height at its tallest. */
  height: 13,
  /** How much of the wave the break transition spans. Smaller = tighter barrel. */
  breakWidth: 0.34,
  segU: coarse ? 150 : 300,
  segS: coarse ? 56 : 104,
} as const;

export const IS_COARSE = coarse;
