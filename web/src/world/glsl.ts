/** GLSL shared by the water shaders. */
export const NOISE = /* glsl */ `
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise2(vec2 x){ vec2 i = floor(x), f = fract(x); float a = hash21(i), b = hash21(i + vec2(1,0)), c = hash21(i + vec2(0,1)), d = hash21(i + vec2(1,1)); vec2 u = f*f*(3.0-2.0*f); return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }
// Wind ripples as a normal perturbation, so the sun's path breaks into glitter
// instead of one clean highlight.
vec3 ripple(vec3 n, vec2 p, float t, float amp){
  vec2 q = p * 0.8;
  vec2 d1 = vec2(t * 0.4, t * 0.25), d2 = vec2(-t * 0.6, t * 0.15);
  float e = 0.3;
  float h0 = vnoise2(q + d1) + 0.5 * vnoise2(q * 2.7 + d2);
  float hx = vnoise2(q + vec2(e, 0.0) + d1) + 0.5 * vnoise2((q + vec2(e, 0.0)) * 2.7 + d2);
  float hz = vnoise2(q + vec2(0.0, e) + d1) + 0.5 * vnoise2((q + vec2(0.0, e)) * 2.7 + d2);
  return normalize(n + vec3(-(hx - h0), 0.0, -(hz - h0)) * amp);
}`;

/**
 * The landing's cream over the frame, screen-space: a band from uHazeLo (screen
 * fraction, 0 bottom) up to the top, plus a uniform amount. Every surface uses
 * the same function so the page above and the world read as one scene.
 */
export const HAZE = /* glsl */ `
uniform vec3 uCream;
uniform vec2 uRes;
uniform float uHazeLo, uHazeFull;
vec3 hazeTop(vec3 col){
  float sy = gl_FragCoord.y / uRes.y;
  // smoothstep with edge0 >= edge1 is undefined in GLSL: a band whose lower
  // edge has risen out of the frame is simply gone.
  float band = uHazeLo >= 0.999 ? 0.0 : pow(smoothstep(uHazeLo, 1.0, sy), 1.5);
  return mix(col, uCream, max(band, uHazeFull));
}`;
