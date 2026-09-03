import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WAVE, CAM_P, bendZ } from './constants';
import { sampleProfile } from './waveProfile';
import { smoothstep } from '../lib/anim';

/**
 * The white wake the board drags across the face. Closed-form from the break
 * front like everything else, so it scrubs backwards cleanly.
 */
const N = 420;

export function Trail({ front }: { front: React.MutableRefObject<number> }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(N), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 600);
    return g;
  }, []);
  const seeds = useMemo(() => Float32Array.from({ length: N * 3 }, () => Math.random()), []);
  const mat = useRef<THREE.ShaderMaterial>(null!);

  useFrame(() => {
    const f = front.current;
    const camU = f + WAVE.breakWidth * CAM_P;
    const pos = geo.attributes.position.array as Float32Array;
    const al = geo.attributes.aAlpha.array as Float32Array;
    for (let i = 0; i < N; i++) {
      const d = i / N; // 0 at the board, 1 at the tail
      const p = 0.5 + d * 0.16; // the tail lies behind, where the wave is further broken
      const u = f + WAVE.breakWidth * p;
      const s = 0.2 - d * 0.14 + (seeds[i * 3] - 0.5) * 0.05;
      const prof = sampleProfile(Math.max(0.02, s), p);
      const taper = smoothstep(0, 0.1, u) * (1 - smoothstep(0.9, 1, u));
      const spread = d * 2.2;
      pos[i * 3 + 0] = (u - 0.5) * WAVE.length + (seeds[i * 3 + 1] - 0.5) * spread;
      pos[i * 3 + 1] = prof.y * WAVE.height * taper + (seeds[i * 3 + 2] - 0.5) * spread * 0.4 + 0.2;
      pos[i * 3 + 2] =
        -prof.n * WAVE.height * taper - 2.5 + (seeds[i * 3] - 0.5) * spread + bendZ(u, camU, WAVE.length);
      al[i] = (1 - d) * (1 - d) * taper * (f < 0.9 && f > 0.03 ? 1 : 0);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  });

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#fff1dd') },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    }),
    []
  );

  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          attribute float aAlpha;
          uniform float uPixelRatio;
          varying float vA;
          void main(){
            vA = aAlpha;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = min(uPixelRatio * 5.0, uPixelRatio * (0.6 + aAlpha * 1.2) * (60.0 / -mv.z));
          }`}
        fragmentShader={/* glsl */ `
          uniform vec3 uColor;
          varying float vA;
          void main(){
            vec2 d = gl_PointCoord - 0.5;
            float r = dot(d, d);
            if (r > 0.25 || vA < 0.01) discard;
            gl_FragColor = vec4(uColor, (1.0 - r * 4.0) * vA * 0.8);
          }`}
      />
    </points>
  );
}
