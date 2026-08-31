import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../lib/anim';

/**
 * A breaking wave, baked as a lookup table.
 *
 * One cross-section of a wave is a curve that starts on the flat water behind
 * the wave, climbs the back, rolls over the crest, drops down the face, and —
 * once it is breaking — keeps turning until the lip has thrown all the way over
 * into a barrel. Every one of those states is the same curve with a different
 * amount of total turn, so we can describe the whole life of a wave with a
 * single parameter.
 *
 *   p = 0    unbroken swell, still rolling
 *   p = 0.5  pitching, lip throwing forward
 *   p = 0.8  fully barrelled
 *   p = 1    collapsed into whitewater
 *
 * We integrate the curve for a ladder of p values once, up front, and store the
 * result in a float texture. The vertex shader then samples (s, p) and gets a
 * position for free — which means the wave costs nothing to animate and, more
 * importantly, is a *pure function of scroll*. Scrubbing backwards runs the wave
 * backwards exactly, with no simulation state to unwind.
 *
 * Channels: r = n (offset toward shore), g = y (height), b = phi (surface
 * angle, used for shading the barrel's underside), a = s.
 */

export const PROFILE_P = 128; // break-phase resolution
export const PROFILE_S = 96; // samples along the cross-section

/**
 * The cross-section is a single curve whose surface angle turns twice.
 *
 * Angles are measured from straight up, positive toward shore, so pi/2 is a
 * horizontal crest and anything past it is overhanging water. The curve leaves
 * the flat water at `baseAngle`, holds that straight climb up the back, then:
 *
 *   TURN 1 (crest)  — a tight sweep through horizontal. Concentrating it in a
 *     short span is what gives a peak. Spread it out and the crest flattens
 *     into a plateau, which renders as a long croissant rather than a wave.
 *   TURN 2 (throw)  — after a pause in which the lip projects forward over the
 *     trough, the sheet keeps turning until it is falling back under itself.
 *     The pause between the two turns is the barrel.
 *
 * The whole curve is then scaled so its peak equals the requested height, which
 * keeps the silhouette independent of how tall the wave is meant to be.
 */

/** Angle the back leaves the flat water at: shallow swell -> steep face. */
const baseAngle = (p: number) => 0.78 - 0.40 * smoothstep(0.0, 0.5, p);

/** Turn 1: over the crest, ending just past horizontal. */
const crestTurn = (p: number) =>
  Math.PI / 2 - baseAngle(p) + 0.1 + 0.55 * smoothstep(0.1, 0.6, p);

/** Turn 2: the throw. Small for a swell rolling over, ~3 rad for a full barrel. */
const throwTurn = (p: number) => 0.55 + 2.6 * smoothstep(0.15, 0.78, p);

/** Where along the arc each turn happens. The gap between them is the tube. */
const CREST_SPAN = [0.3, 0.52] as const;
const THROW_SPAN = [0.6, 1.0] as const;

/** Wave height: swell rises, stands up, then collapses. */
const heightAt = (p: number) =>
  0.55 + 0.5 * smoothstep(0.0, 0.4, p) - 0.65 * smoothstep(0.62, 1.0, p);

export function buildProfileTexture() {
  const data = new Float32Array(PROFILE_P * PROFILE_S * 4);
  const n: number[] = new Array(PROFILE_S);
  const y: number[] = new Array(PROFILE_S);
  const phi: number[] = new Array(PROFILE_S);

  for (let pi = 0; pi < PROFILE_P; pi++) {
    const p = pi / (PROFILE_P - 1);
    const phi0 = baseAngle(p);
    const A = crestTurn(p);
    const B = throwTurn(p);
    const H = heightAt(p);

    let cn = 0;
    let cy = 0;
    let ymax = 1e-6;
    const ds = 1 / (PROFILE_S - 1);
    for (let si = 0; si < PROFILE_S; si++) {
      const s = si / (PROFILE_S - 1);
      const a =
        phi0 +
        A * smoothstep(CREST_SPAN[0], CREST_SPAN[1], s) +
        B * smoothstep(THROW_SPAN[0], THROW_SPAN[1], s);
      n[si] = cn;
      y[si] = cy;
      phi[si] = a;
      if (cy > ymax) ymax = cy;
      cn += Math.sin(a) * ds;
      cy += Math.cos(a) * ds;
    }

    const k = H / ymax;

    // Once it has collapsed, the curve is a tight spiral, which reads as a bug
    // rather than as whitewater — blend toward a churning mound instead.
    const collapse = smoothstep(0.8, 1.0, p) * 0.9;
    for (let si = 0; si < PROFILE_S; si++) {
      const s = si / (PROFILE_S - 1);
      const moundN = s * 2.0 * H;
      const moundY = H * 1.05 * Math.sin(Math.PI * s * 0.82) * (1 - 0.25 * s);
      const idx = (pi * PROFILE_S + si) * 4;
      data[idx + 0] = lerp(n[si] * k, moundN, collapse);
      data[idx + 1] = lerp(y[si] * k, moundY, collapse);
      data[idx + 2] = phi[si];
      data[idx + 3] = s;
    }
  }

  const tex = new THREE.DataTexture(
    data,
    PROFILE_S,
    PROFILE_P,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * CPU-side twin of the shader's break-phase function, so other parts of the
 * scene (camera, surfer, spray) can ask where the wave is without guessing.
 */
export function breakPhaseAt(u: number, front: number, width: number) {
  return clamp((front - u) / width);
}

/** Where the barrel is, in [0,1] along the wave, for a given front position. */
export const barrelAt = (front: number, width: number) => front - width * 0.55;

/* ------------------------------------------------------------------ */
/* CPU-side sampling, so the camera / surfer / spray can ask the same  */
/* question the shader asks without duplicating the maths.             */
/* ------------------------------------------------------------------ */

let cachedData: Float32Array | null = null;

function profileData() {
  if (!cachedData) {
    const tex = buildProfileTexture();
    cachedData = tex.image.data as Float32Array;
  }
  return cachedData;
}

/** Bilinear sample of the profile. Returns { n, y, phi }. */
export function sampleProfile(s: number, p: number) {
  const d = profileData();
  const fs = clamp(s) * (PROFILE_S - 1);
  const fp = clamp(p) * (PROFILE_P - 1);
  const s0 = Math.floor(fs);
  const p0 = Math.floor(fp);
  const s1 = Math.min(s0 + 1, PROFILE_S - 1);
  const p1 = Math.min(p0 + 1, PROFILE_P - 1);
  const ts = fs - s0;
  const tp = fp - p0;
  const at = (si: number, pi: number, c: number) => d[(pi * PROFILE_S + si) * 4 + c];
  const mix2 = (c: number) =>
    lerp(lerp(at(s0, p0, c), at(s1, p0, c), ts), lerp(at(s0, p1, c), at(s1, p1, c), ts), tp);
  return { n: mix2(0), y: mix2(1), phi: mix2(2) };
}
