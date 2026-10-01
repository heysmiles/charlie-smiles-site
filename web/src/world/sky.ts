import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';
import { HAZE, creamRaw } from './glsl';

const vert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const frag = /* glsl */ `
uniform vec3 uTop, uMid, uLow, uHorizon, uSun, uSunDir, uPink, uLavender, uWarmLow, uWarmMid;
varying vec3 vDir;
${HAZE}
void main(){
  float h = vDir.y;
  // Away from the sun (the east, over Venice): a red horizon, the pink belt,
  // lavender above it, then the cream the page is made of.
  vec3 cool = uHorizon;
  cool = mix(cool, uLow, smoothstep(0.0, 0.045, h));
  cool = mix(cool, uPink, smoothstep(0.04, 0.15, h));
  cool = mix(cool, uLavender, smoothstep(0.14, 0.34, h));
  cool = mix(cool, uTop, smoothstep(0.32, 0.7, h));
  // Toward the sun (the west, over the sea): yellow, orange, peach, cream.
  vec3 warm = mix(uHorizon, uWarmLow, 0.6);
  warm = mix(warm, uWarmLow, smoothstep(0.0, 0.05, h));
  warm = mix(warm, uLow, smoothstep(0.04, 0.12, h));
  warm = mix(warm, uWarmMid, smoothstep(0.1, 0.26, h));
  warm = mix(warm, uTop, smoothstep(0.24, 0.6, h));
  float toward = pow(clamp(dot(normalize(vec2(vDir.x, vDir.z)), normalize(vec2(uSunDir.x, uSunDir.z))) * 0.5 + 0.5, 0.0, 1.0), 2.2);
  vec3 col = mix(cool, warm, toward);
  col = mix(uHorizon * 0.6, col, smoothstep(-0.04, 0.0, h));
  float sd = max(dot(vDir, uSunDir), 0.0);
  col += uSun * (pow(sd, 36.0) * 0.9 + pow(sd, 6.0) * 0.3);
  col = mix(col, vec3(1.0, 0.97, 0.9), smoothstep(0.9993, 0.9997, sd));
  gl_FragColor = vec4(hazeTop(col), 1.0);
}`;

export function makeSky() {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(P.skyTop) },
      uMid: { value: new THREE.Color(P.skyMid) },
      uLow: { value: new THREE.Color(P.skyLow) },
      uHorizon: { value: new THREE.Color(P.horizon) },
      uSun: { value: new THREE.Color(P.sun) },
      uSunDir: { value: new THREE.Vector3(...L.sunDir).normalize() },
      uPink: { value: new THREE.Color(P.skyPink) },
      uLavender: { value: new THREE.Color(P.skyLavender) },
      uWarmLow: { value: new THREE.Color(P.skyWarmLow) },
      uWarmMid: { value: new THREE.Color(P.skyWarmMid) },
      uCream: { value: creamRaw() },
      uRes: { value: new THREE.Vector2(1, 1) },
      uHazeLo: { value: 0.42 },
      uHazeFull: { value: 1 },
    },
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1800, 40, 20), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.userData.kind = 'sky';
  g.add(dome);

  return { group: g, dome, uniforms: mat.uniforms };
}
