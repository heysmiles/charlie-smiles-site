/**
 * The site runs a temperature arc: warm paper -> cold ocean -> warm coastline.
 * Cold values are sampled from Charlie's reference surf clip
 * (assets/reference/wave-reference.mov); warm values come from the brand doc.
 */
export const palette = {
  // brand
  cream: '#fff9f5',
  ink: '#66564a',
  ember: '#e86a17',

  // sky
  skyTopCold: '#3f545c',
  skyHorizonCold: '#93a6ac',
  skyTopWarm: '#6d7f88',
  skyHorizonWarm: '#e6d2bd',

  // water
  waterDeep: '#2c4448',
  waterMid: '#4a6a66',
  waterFace: '#63887a',
  waterLit: '#a9c9b5',
  foam: '#eaf2ef',
  foamDim: '#c3d2d1',

  // shore
  seaNear: '#93a6ac',
  seaFar: '#7d9198',
  landFar: '#7b8b90',
  landMid: '#5d6b6d',
  landNear: '#46514f',
} as const;
