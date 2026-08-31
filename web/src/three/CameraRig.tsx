import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { keyframes, smootherstep, lerp, damp, dampAngle, lerpAngle } from '../lib/anim';
import { WAVE } from './constants';
import { sampleProfile } from './waveProfile';

/**
 * The camera is the narrator here, so it gets its own timeline.
 *
 * Position and field of view are keyframed against scroll. Where it *looks* is
 * not keyframed — it tracks the barrel while the wave is breaking, then swings
 * to the coastline as the wave collapses. Aiming is interpolated as angles
 * rather than as a target point, because lerping a look-at target across the
 * camera's own position makes it snap through the turn instead of sweeping.
 */

// [x, y, z, fov]
// The break peels toward -X, so the tube's open mouth faces that way. Sitting
// on the +X side would put the camera at the closed, collapsing end and the
// barrel would only ever be a dark sliver — hence the negative offsets.
const RIG: { t: number; v: number[] }[] = [
  { t: 0.0, v: [-32, 9.5, -132, 44] },
  { t: 0.2, v: [-28, 9.0, -116, 42] },
  { t: 0.42, v: [-21, 8.4, -98, 38] },
  { t: 0.58, v: [-14, 8.0, -86, 35] },
  { t: 0.72, v: [-8, 7.6, -76, 33] },
  { t: 0.8, v: [-3, 8.2, -72, 32] },
  { t: 0.86, v: [0, 17, -64, 36] },
  { t: 0.92, v: [0, 34, -30, 42] },
  { t: 0.97, v: [0, 36, 8, 47] },
  { t: 1.0, v: [0, 31, 30, 49] },
];

/**
 * The camera rides along with the break rather than watching it go past.
 * DRIFT just short of 1 leaves a little relative motion, so the barrel still
 * slides across frame instead of sitting nailed to the centre.
 */
const TRACK = 1.0;
const DRIFT = 0.85;

const COAST = new THREE.Vector3(0, 32, -430);

function yawPitchTo(cam: THREE.Vector3, tgt: THREE.Vector3) {
  const dx = tgt.x - cam.x;
  const dy = tgt.y - cam.y;
  const dz = tgt.z - cam.z;
  const horiz = Math.hypot(dx, dz) || 1e-6;
  return { yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, horiz) };
}

export function CameraRig({
  progress,
  front,
}: {
  progress: React.MutableRefObject<number>;
  front: React.MutableRefObject<number>;
}) {
  const { camera, size } = useThree();
  const smoothed = useRef({ yaw: Math.PI, pitch: 0, fov: 44 });
  const tmpCam = new THREE.Vector3();
  const tmpTgt = new THREE.Vector3();

  useFrame((_, dt) => {
    const t = progress.current;
    const [kx, ky, kz, kfov] = keyframes(RIG, t);

    // Where the barrel is right now.
    const f = front.current;
    const barrelU = f + WAVE.breakWidth * 0.4;
    const barrelX = (barrelU - 0.5) * WAVE.length;
    const prof = sampleProfile(0.58, 0.5);

    const overTheTop = smootherstep(0.82, 0.97, t);

    tmpCam.set(kx + barrelX * DRIFT * (1 - overTheTop), ky, kz);
    camera.position.copy(tmpCam);

    // Aim: barrel early, coastline late.
    tmpTgt.set(barrelX * TRACK, prof.y * WAVE.height * 0.85, -prof.n * WAVE.height);
    const near = yawPitchTo(tmpCam, tmpTgt);
    const far = yawPitchTo(tmpCam, COAST);

    // Unwrap so the swing always carries the eye across the horizon in one
    // direction rather than taking a shortcut back through the wave.
    let d = far.yaw - near.yaw;
    while (d < 0) d += Math.PI * 2;
    const yaw = near.yaw + d * overTheTop;
    const pitch = lerp(near.pitch, far.pitch, overTheTop);

    // A touch of damping keeps a fast scroll from feeling jittery without
    // letting the camera lag behind the scrubber.
    const s = smoothed.current;
    const lambda = 14;
    s.yaw = dampAngle(s.yaw, yaw, lambda, Math.min(dt, 0.05));
    s.pitch = damp(s.pitch, pitch, lambda, Math.min(dt, 0.05));

    // Damping is right for the ride, wrong for the arrival: a fraction of a
    // radian of lag is invisible mid-wave but leaves the coastline framed off
    // centre, which pushes the outer landmarks past the edge of the screen.
    // Hand the last of the turn over to the exact target.
    const settle = smootherstep(0.92, 1.0, t);
    if (settle > 0) {
      s.yaw = lerpAngle(s.yaw, yaw, settle);
      s.pitch = lerp(s.pitch, pitch, settle);
    }
    s.fov = damp(s.fov, kfov, lambda, Math.min(dt, 0.05));

    camera.rotation.order = 'YXZ';
    camera.rotation.set(s.pitch, -s.yaw, 0);

    const cam = camera as THREE.PerspectiveCamera;
    // Keep the framing honest on narrow screens. A phone in portrait sees a
    // fraction of the horizontal arc a laptop does, which would cut the outer
    // landmarks off the coastline entirely — so widen as the frame narrows.
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
