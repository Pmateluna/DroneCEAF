import { Mat4 } from './matrix.js';

/**
 * Camera
 * Supports 3rd Person Follow Camera & 1st Person FPV Gimbal Cockpit Camera.
 */
export class Camera {
  constructor(fovDeg = 55, near = 0.5, far = 2500.0) {
    this.fovRad = (fovDeg * Math.PI) / 180;
    this.near = near;
    this.far = far;

    this.position = [0, 12, -18];
    this.target = [0, 5, 0];
    this.up = [0, 1, 0];

    this.viewMatrix = Mat4.create();
    this.projMatrix = Mat4.create();

    // Mode: 'third_person' | 'first_person'
    this.mode = 'third_person';

    this.followDistance = 7.0;
    this.followHeight = 3.5;
    this.smoothSpeed = 6.0;
  }

  setMode(mode) {
    if (['third_person', 'first_person'].includes(mode)) {
      this.mode = mode;
    }
  }

  toggleMode() {
    this.mode = this.mode === 'third_person' ? 'first_person' : 'third_person';
    return this.mode;
  }

  update(dronePos, droneRotation, aspect, dt) {
    const [px, py, pz] = dronePos;
    const [pitch, yaw, roll] = droneRotation;

    if (this.mode === 'first_person') {
      // FPV Cockpit Cam: Positioned on front drone nose (gimbal)
      const cosYaw = Math.sin(yaw);
      const sinYaw = Math.cos(yaw);

      // Camera position slightly in front and above drone center
      this.position[0] = px + cosYaw * 0.5;
      this.position[1] = py + 0.2;
      this.position[2] = pz + sinYaw * 0.5;

      // Look at target 10m ahead, slightly downward (15°) for ground inspection
      const lookDist = 12.0;
      this.target[0] = this.position[0] + Math.sin(yaw) * lookDist;
      this.target[1] = this.position[1] - 3.2 + Math.sin(pitch) * lookDist;
      this.target[2] = this.position[2] + Math.cos(yaw) * lookDist;

      Mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
    } else {
      // 3rd Person Follow Cam
      const camOffsetZ = -Math.cos(yaw) * this.followDistance;
      const camOffsetX = -Math.sin(yaw) * this.followDistance;

      const targetCamX = px + camOffsetX;
      const targetCamY = py + this.followHeight;
      const targetCamZ = pz + camOffsetZ;

      const lerpT = Math.min(1.0, this.smoothSpeed * dt);
      this.position[0] += (targetCamX - this.position[0]) * lerpT;
      this.position[1] += (targetCamY - this.position[1]) * lerpT;
      this.position[2] += (targetCamZ - this.position[2]) * lerpT;

      this.target[0] += (px - this.target[0]) * lerpT;
      this.target[1] += (py + 1.0 - this.target[1]) * lerpT;
      this.target[2] += (pz - this.target[2]) * lerpT;

      Mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
    }

    Mat4.perspective(this.projMatrix, this.fovRad, aspect, this.near, this.far);
  }
}
