import * as THREE from 'three';
import { P } from './palette';
import { L } from './layout';

/**
 * The open sea: a plane of summed sines, shaded flat per facet in the fragment
 * shader so it reads as low-poly water, with a foam band rolling along the
 * shoreline and the sun's path shattered across it.
 */
const vert = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
void main(){
  vec3 p = position;
  float x = p.x, z = -p.y; // plane lies flat after rotation; y here is world -z
  float h = sin(x * 0.045 + uTime * 0.9) * 0.48
          + sin(z * 0.062 - uTime * 1.25) * 0.32
          + sin((x + z) * 0.028 + uTime * 0.55) * 0.24;
  p.z += h;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const frag = /* glsl */ `
uniform float uTime, uShoreZ;
uniform vec3 uDeep, uMid, uLit, uFoam, uGlint, uSunDir, uFog, uHor;
uniform float uFogNear, uFogFar;
varying vec3 vWorld;
void main(){
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;
  vec3 v = normalize(cameraPosition - vWorld);
  float lift = clamp(dot(n, normalize(vec3(0.3, 1.0, 0.4))), 0.0, 1.0);
  vec3 col = mix(uDeep, uMid, lift);
  col = mix(col, uLit, smoothstep(0.85, 1.0, lift) * 0.5);

  vec3 r = reflect(-v, n);
  float s = max(dot(r, uSunDir), 0.0);
  col += uGlint * (pow(s, 90.0) * 1.4 + pow(s, 12.0) * 0.3);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col = mix(col, uHor, fres * 0.35);

  // Foam rolling up the beach.
  float sd = vWorld.z - uShoreZ;
  float band = smoothstep(-1.0, 1.0, sd) * (1.0 - smoothstep(3.0, 9.0, sd));
  float roll = 0.5 + 0.5 * sin(sd * 0.9 - uTime * 1.2 + sin(vWorld.x * 0.13) * 1.5);
  col = mix(col, uFoam, band * smoothstep(0.55, 0.95, roll) * 0.55);

  float d = length(cameraPosition - vWorld);
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));
  gl_FragColor = vec4(col, 1.0);
}`;

export function makeOcean() {
  const geo = new THREE.PlaneGeometry(2400, 1400, 300, 175);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uTime: { value: 0 },
      uShoreZ: { value: L.shoreZ },
      uDeep: { value: new THREE.Color(P.seaDeep) },
      uMid: { value: new THREE.Color(P.seaMid) },
      uLit: { value: new THREE.Color(P.seaLit) },
      uFoam: { value: new THREE.Color(P.foam) },
      uGlint: { value: new THREE.Color(P.seaGlint) },
      uHor: { value: new THREE.Color(P.skyLow) },
      uFog: { value: new THREE.Color(P.fog) },
      uFogNear: { value: 220 },
      uFogFar: { value: 900 },
      uSunDir: { value: new THREE.Vector3(...L.sunDir).normalize() },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, -0.3, 200);
  mesh.frustumCulled = false;
  return { mesh, tick: (t: number) => { mat.uniforms.uTime.value = t; } };
}
