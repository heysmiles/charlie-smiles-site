/**
 * The first section, as scroll positions. Everything that needs to agree about
 * *when* something happens reads it from here — keeping these in a component
 * file created an import cycle between the scene and its overlays.
 */
export const TL = {
  /** Ocean fades up as the landing sheet lifts away. */
  oceanIn: [0.05, 0.19] as const,
  /** The break travels the length of the wave between these two. */
  breakStart: 0.17,
  breakEnd: 0.82,
  /** Camera rises over the crest and swings to face the shore. */
  overTop: [0.82, 0.97] as const,
  /** Landmark labels arrive, staggered along the coast. */
  landmarksIn: [0.93, 0.995] as const,
} as const;
