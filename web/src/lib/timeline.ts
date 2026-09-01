/**
 * Section one, as scroll positions. Short on purpose: scroll, the wave
 * barrels over you, you come out of the tube into the world.
 */
export const TL = {
  /** The sunset paints in over the cream landing. */
  skyIn: [0.05, 0.3] as const,
  /** Landing content fades as the water reaches it. */
  landingOut: [0.14, 0.36] as const,
  /** The break travels the wave between these. */
  breakStart: 0.02,
  breakEnd: 0.86,
  /** Out through the mouth. */
  exit: [0.84, 1.0] as const,
  landmarksIn: [0.9, 0.995] as const,
} as const;
