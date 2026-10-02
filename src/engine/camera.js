import { Mat4 } from './matrix.js';

/**
 * Camera
 * Supports 3rd Person Follow Camera & 1st Person FPV Gimbal Cockpit Camera.
 * Includes Free 3D Orbit Camera Control via Left Mouse Drag and Mouse Wheel Zoom In/Out.
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
    this.smoothSpeed = 8.0;

    // Free Orbit & Zoom State
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.orbitAzimuth = 0.0;
    this.orbitElevation = 0.0;
    this.zoomDistance = 7.0;

    this.initMouseListeners();
  }

  initMouseListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('mousedown', (e) => {
      // Left Mouse Button (button === 0)
      if (e.button === 0) {
        this.isDragging = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging || this.mode === 'first_person') return;

      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.orbitAzimuth += deltaX * 0.006;
      this.orbitElevation += deltaY * 0.006;

      // Clamp vertical elevation angle between -35 deg and +75 deg
      const minElev = -Math.PI / 5;
      const maxElev = Math.PI / 2.5;
      this.orbitElevation = Math.max(minElev, Math.min(maxElev, this.orbitElevation));

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    const stopDrag = () => {
      this.isDragging = false;
    };

    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('mouseleave', stopDrag);

    window.addEventListener('wheel', (e) => {
      if (this.mode === 'first_person') return;
      // Scroll wheel zoom in / out
      const zoomSensitivity = 0.004;
      this.zoomDistance += e.deltaY * zoomSensitivity;
      // Clamp zoom distance between 1.2 meters and 40 meters
      this.zoomDistance = Math.max(1.2, Math.min(40.0, this.zoomDistance));
    }, { passive: true });
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

      // Look at target 12m ahead, slightly downward (15°) for ground inspection
      const lookDist = 12.0;
      this.target[0] = this.position[0] + Math.sin(yaw) * lookDist;
      this.target[1] = this.position[1] - 3.2 + Math.sin(pitch) * lookDist;
      this.target[2] = this.position[2] + Math.cos(yaw) * lookDist;

      Mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
    } else {
      // 3rd Person Follow & Orbit Camera
      const totalYaw = yaw + this.orbitAzimuth;
      const totalDist = this.zoomDistance;
      const cosElev = Math.cos(this.orbitElevation);
      const sinElev = Math.sin(this.orbitElevation);

      const camOffsetX = -Math.sin(totalYaw) * totalDist * cosElev;
      const camOffsetY = this.followHeight * (totalDist / 7.0) + sinElev * totalDist;
      const camOffsetZ = -Math.cos(totalYaw) * totalDist * cosElev;

      const targetCamX = px + camOffsetX;
      const targetCamY = Math.max(0.15, py + camOffsetY);
      const targetCamZ = pz + camOffsetZ;

      const lerpT = Math.min(1.0, this.smoothSpeed * dt);
      this.position[0] += (targetCamX - this.position[0]) * lerpT;
      this.position[1] += (targetCamY - this.position[1]) * lerpT;
      this.position[2] += (targetCamZ - this.position[2]) * lerpT;

      this.target[0] += (px - this.target[0]) * lerpT;
      this.target[1] += (py + 0.6 - this.target[1]) * lerpT;
      this.target[2] += (pz - this.target[2]) * lerpT;

      Mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
    }

    Mat4.perspective(this.projMatrix, this.fovRad, aspect, this.near, this.far);
  }
}
