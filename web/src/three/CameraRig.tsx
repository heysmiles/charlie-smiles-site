import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { keyframes, damp } from '../lib/anim';
import { WAVE, MOUTH_YAW, CAM_P, bendZ } from './constants';

/**
 * The camera is a surfer.
 *
 * It looks down the line the whole way — toward the sun, toward the mouth of
 * the tube, toward the coast — and its position is keyed *relative to the
 * barrel*, so it rides along with the break instead of watching it go past.
 * Being inside a wave is the one camera move in the sequence; everything else
 * is how it gets in and how it gets out.
 */

// [x offset from the barrel, y, z, pitch, fov]
// dx is measured from the barrel and z from the wave line at the camera's own
// position, so the camera rides the break. Three chapters: side-on from the
// shoreward side (the reference wave shot), a dolly in toward the surfer as
// the lip closes over, and the ride inside the tube — then out to the beach.
const RIG: { t: number; v: number[] }[] = [
  { t: 0.0, v: [-5, 8.0, -58, 0.42, 46] }, // horizon at the foot of the landing
  { t: 0.12, v: [-5, 8.2, -56, 0.2, 46] },
  { t: 0.26, v: [-5, 8.5, -52, -0.02, 46] }, // the side-on shot: curtain left, surfer right
  { t: 0.4, v: [-4, 8.8, -34, -0.02, 48] }, // dolly in toward the surfer
  { t: 0.52, v: [-5, 9.5, -20, 0.0, 55] }, // under the lip as it closes
  { t: 0.64, v: [2, 10.0, -8, 0.0, 62] }, // inside the tube
  { t: 0.78, v: [-3, 10.0, -8.5, 0.0, 60] },
  { t: 0.86, v: [-36, 10.0, -14, -0.01, 56] }, // heading for the mouth
  { t: 0.93, v: [-150, 16, -40, -0.04, 50] }, // out
  { t: 1.0, v: [-260, 22, -70, -0.06, 50] },
];

/**
 * Heading, absolute. pi faces the wave from the shoreward side; the tube is
 * looked at down its axis. Keys are unwrapped so the turn is one clean sweep.
 */
const MOUTH_ABS = -Math.PI / 2 + MOUTH_YAW + Math.PI * 2;
const YAW_KEYS: { t: number; v: number[] }[] = [
  { t: 0.0, v: [Math.PI] },
  { t: 0.36, v: [Math.PI] },
  { t: 0.52, v: [Math.PI + (MOUTH_ABS - Math.PI) * 0.55] },
  { t: 0.64, v: [MOUTH_ABS] },
  { t: 1.0, v: [MOUTH_ABS] },
];

export function CameraRig({
  progress,
  front,
}: {
  progress: React.MutableRefObject<number>;
  front: React.MutableRefObject<number>;
}) {
  const { camera, size } = useThree();
  const smoothed = useRef({ fov: 50 });

  useFrame((_, dt) => {
    const t = progress.current;
    const [dx, y, z, pitch, kfov] = keyframes(RIG, t);
    const [yawAbs] = keyframes(YAW_KEYS, t);

    const barrelU = front.current + WAVE.breakWidth * CAM_P;
    const barrelX = (barrelU - 0.5) * WAVE.length;

    const camU = barrelU + dx / WAVE.length;
    camera.position.set(barrelX + dx, y, z + bendZ(camU, barrelU, WAVE.length));

    const yaw = yawAbs;
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch, -yaw, 0);

    // Dev: window.__eye = [x, y, z, yaw, pitch] parks the camera anywhere.
    const eye = (window as unknown as { __eye?: number[] }).__eye;
    if (import.meta.env.DEV && eye) {
      camera.position.set(eye[0], eye[1], eye[2]);
      camera.rotation.set(eye[4], -eye[3], 0);
    }

    const s = smoothed.current;
    s.fov = damp(s.fov, kfov, 14, Math.min(dt, 0.05));

    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const fovAdjust = aspect < 1.5 ? 1 + (1.5 - aspect) * 0.42 : 1;
    const nextFov = s.fov * fovAdjust;
    if (Math.abs(cam.fov - nextFov) > 0.01) {
      cam.fov = nextFov;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}
