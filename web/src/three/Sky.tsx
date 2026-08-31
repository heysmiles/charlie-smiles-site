import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vert = /* glsl */ `
varying vec3 vPos;
void main(){
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
uniform vec3 uTop, uHorizon;
varying vec3 vPos;
void main(){
  float h = normalize(vPos).y;
  float t = smoothstep(-0.06, 0.62, h);
  gl_FragColor = vec4(mix(uHorizon, uTop, t), 1.0);
}
`;

export type SkyHandle = { top: THREE.Color; horizon: THREE.Color };

export function Sky({ handle }: { handle: React.MutableRefObject<SkyHandle> }) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#3f545c') },
      uHorizon: { value: new THREE.Color('#93a6ac') },
    }),
    []
  );

  useFrame(() => {
    mat.current.uniforms.uTop.value.copy(handle.current.top);
    mat.current.uniforms.uHorizon.value.copy(handle.current.horizon);
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[1600, 32, 20]} />
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}
