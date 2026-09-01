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
// dx is measured from the barrel and z from the wave line at the camera's
// own position, so the camera rides the break rather than outrunning it. The
// wave stands up beside it on the left and throws over from left to right.
const RIG: { t: number; v: number[] }[] = [
  { t: 0.0, v: [-16, 4.0, -26, 0.44, 50] }, // low on the water, horizon at the foot of the screen
  { t: 0.14, v: [-14, 5.2, -24, 0.2, 48] },
  { t: 0.3, v: [-10, 7.0, -16, 0.08, 50] },
  { t: 0.46, v: [-4, 9.0, -10, 0.03, 56] }, // the lip comes over
  { t: 0.62, v: [2, 10.0, -8, 0.0, 62] }, // deep in the tube, eye up on the face
  { t: 0.78, v: [-3, 10.0, -8.5, 0.0, 60] },
  { t: 0.86, v: [-36, 10.0, -14, -0.01, 56] }, // heading for the mouth
  { t: 0.93, v: [-150, 16, -40, -0.035, 50] }, // out
  { t: 1.0, v: [-260, 24, -70, -0.05, 50] },
];

/** Heading: nearly down the line at first, swinging to the mouth once inside. */
const YAW_KEYS: { t: number; v: number[] }[] = [
  { t: 0.0, v: [0.0] },
  { t: 0.3, v: [-0.1] },
  { t: 0.62, v: [MOUTH_YAW] },
  { t: 1.0, v: [MOUTH_YAW] },
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
    const [yawIn] = keyframes(YAW_KEYS, t);

    const barrelU = front.current + WAVE.breakWidth * CAM_P;
    const barrelX = (barrelU - 0.5) * WAVE.length;

    const camU = barrelU + dx / WAVE.length;
    camera.position.set(barrelX + dx, y, z + bendZ(camU, barrelU, WAVE.length));

    // Forward = -X, turned toward -Z (the beach) by yawIn.
    const yaw = -Math.PI / 2 + yawIn;
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
