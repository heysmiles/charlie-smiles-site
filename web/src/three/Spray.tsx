import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WAVE, IS_COARSE, CAM_P, BEND } from './constants';
import { sampleProfile } from './waveProfile';

/**
 * Spray off the throwing lip.
 *
 * Every particle's whole life is a closed-form function of how far the break
 * front has travelled past it — no integration, no stored velocities. That is
 * what lets the user scroll back up and watch the spray suck itself back into
 * the lip instead of the scene falling apart.
 */

const COUNT = IS_COARSE ? 1400 : 3600;
const LIFE = 0.17; // in break-front units

const vert = /* glsl */ `
attribute float aU;
attribute vec3 aSeed;
uniform float uFront, uWaveLen, uLipY, uLipZ, uSize, uPixelRatio, uCamU, uBendK, uBendSlope, uBendLead;
varying float vAlpha;
varying float vSeed;

void main(){
  float age = (aU - uFront) / ${LIFE.toFixed(3)};
  vAlpha = 0.0;
  float ahead = max(0.0, uCamU - aU - uBendLead) * uWaveLen;
  vec3 pos = vec3((aU - 0.5) * uWaveLen, uLipY, uLipZ + uBendSlope * ahead + uBendK * ahead * ahead);

  if (age > 0.0 && age < 1.0) {
    // Offshore wind carries the plume back over the crest (toward +Z).
    vec3 vel = vec3(
      (aSeed.x - 0.5) * 10.0,
      6.5 + aSeed.y * 15.0,
      3.0 + aSeed.z * 12.0
    );
    float t = age * 1.5;
    pos += vel * t;
    pos.y -= 9.0 * t * t;
    pos.x += sin(age * 9.0 + aSeed.z * 6.28) * 1.4;

    // Fade in fast off the lip, out slowly as it disperses.
    vAlpha = smoothstep(0.0, 0.06, age) * (1.0 - smoothstep(0.35, 1.0, age));
    vAlpha *= 0.35 + aSeed.y * 0.65;
  }

  vSeed = aSeed.x;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed.z * 1.5) * (140.0 / -mv.z);
}
`;

const frag = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying float vSeed;
void main(){
  if (vAlpha <= 0.001) discard;
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  float a = (1.0 - r * 4.0);
  gl_FragColor = vec4(uColor, a * a * vAlpha * 0.55);
}
`;

export function Spray({
  front,
  opacity,
}: {
  front: React.MutableRefObject<number>;
  opacity: React.MutableRefObject<number>;
}) {
  const mat = useRef<THREE.ShaderMaterial>(null!);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const us = new Float32Array(COUNT);
    const seeds = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      us[i] = Math.random() * 1.3 - 0.15;
      seeds[i * 3 + 0] = Math.random();
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('aU', new THREE.BufferAttribute(us, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 900);
    return g;
  }, []);

  const uniforms = useMemo(() => {
    // Where the lip sits at the moment it is throwing hardest.
    const lip = sampleProfile(0.97, 0.42);
    return {
      uFront: { value: 1 },
      uCamU: { value: 1 },
      uBendK: { value: BEND.k },
      uBendSlope: { value: BEND.slope },
      uBendLead: { value: BEND.lead },
      uWaveLen: { value: WAVE.length },
      uLipY: { value: lip.y * WAVE.height },
      uLipZ: { value: -lip.n * WAVE.height },
      uSize: { value: 1.0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uColor: { value: new THREE.Color('#ffd9a8') },
    };
  }, []);

  useFrame(() => {
    mat.current.uniforms.uFront.value = front.current;
    mat.current.uniforms.uCamU.value = front.current + WAVE.breakWidth * CAM_P;
    mat.current.visible = opacity.current > 0.02;
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}
