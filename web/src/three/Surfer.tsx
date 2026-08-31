import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WAVE } from './constants';
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
    const p = 0.36;
    const u = f + WAVE.breakWidth * p;
    const prof = sampleProfile(0.34, p);

    // The wave mesh tapers to nothing at both ends; the surfer has to ride the
    // tapered surface, not the height the profile would have had, or he hangs
    // in the air where the wave has already faded out.
    const taper = smoothstep(0, 0.1, u) * (1 - smoothstep(0.9, 1, u));

    g.current.position.set(
      (u - 0.5) * WAVE.length,
      prof.y * WAVE.height * taper,
      -prof.n * WAVE.height * taper + 1.2
    );

    // Only present while there is actually a barrel to be in.
    g.current.visible = taper > 0.6 && f > 0.03;
    g.current.scale.setScalar(0.85 + taper * 0.15);
  });

  return (
    <group ref={g} rotation={[0, 0, 0.22]}>
      {/* board */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, -0.55, 0]}>
        <capsuleGeometry args={[0.16, 1.9, 3, 8]} />
        <meshBasicMaterial color="#1b2426" />
      </mesh>
      {/* crouched body */}
      <mesh position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.27, 0.72, 4, 10]} />
        <meshBasicMaterial color="#141b1d" />
      </mesh>
      {/* trailing arm */}
      <mesh position={[0.42, 0.34, 0.1]} rotation={[0, 0, -0.9]}>
        <capsuleGeometry args={[0.1, 0.6, 3, 6]} />
        <meshBasicMaterial color="#141b1d" />
      </mesh>
    </group>
  );
}
