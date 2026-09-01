import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WAVE, CAM_P, bendZ } from './constants';
import { sampleProfile } from './waveProfile';
import { smoothstep } from '../lib/anim';

/**
 * One dark shape in all that water. He is deliberately small — he is scale, not
 * a character. Placed just inside the barrel, riding ahead of the collapse.
 */
export function Surfer({ front }: { front: React.MutableRefObject<number> }) {
  const g = useRef<THREE.Group>(null!);

  useFrame(() => {
    const f = front.current;
    // Sit a little way into the breaking side of the front.
    const p = 0.5;
    const u = f + WAVE.breakWidth * p;
    const prof = sampleProfile(0.14, p);

    // The wave mesh tapers to nothing at both ends; the surfer has to ride the
    // tapered surface, not the height the profile would have had, or he hangs
    // in the air where the wave has already faded out.
    const taper = smoothstep(0, 0.1, u) * (1 - smoothstep(0.9, 1, u));

    g.current.position.set(
      (u - 0.5) * WAVE.length,
      prof.y * WAVE.height * taper,
      -prof.n * WAVE.height * taper - 2.5 + bendZ(u, f + WAVE.breakWidth * CAM_P, WAVE.length)
    );

    // Only present while there is actually a barrel to be in.
    g.current.visible = taper > 0.6 && f > 0.03;
    g.current.scale.setScalar(0.85 + taper * 0.15);
  });

  return (
    <group ref={g} rotation={[0, 0, 0.22]}>
      {/* board — a thin plank, top edge catching the sun */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, -0.62, 0]} scale={[1, 1, 0.35]}>
        <capsuleGeometry args={[0.13, 1.7, 3, 8]} />
        <meshBasicMaterial color="#d9c3ad" />
      </mesh>
      {/* crouched body, backlit: dark core with a thin amber rim (inverted hull) */}
      <mesh position={[0, 0.18, 0]}>
        <capsuleGeometry args={[0.24, 0.62, 4, 10]} />
        <meshBasicMaterial color="#0e1224" />
      </mesh>
      <mesh position={[0, 0.18, 0]} scale={1.05}>
        <capsuleGeometry args={[0.24, 0.62, 4, 10]} />
        <meshBasicMaterial color="#e08a3a" side={THREE.BackSide} transparent opacity={0.8} />
      </mesh>
      {/* trailing arm */}
      <mesh position={[0.38, 0.3, 0.1]} rotation={[0, 0, -0.9]}>
        <capsuleGeometry args={[0.08, 0.55, 3, 6]} />
        <meshBasicMaterial color="#0e1224" />
      </mesh>
    </group>
  );
}
