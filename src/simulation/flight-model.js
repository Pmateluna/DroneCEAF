/**
 * FlightModel
 * Handles quadcopter flight dynamics, motor ground ignition/shutdown state machine, battery drain, Lawnmower Grid Scan autopilot, and RTH failsafe.
 */
export class FlightModel {
  constructor(telemetryStore) {
    this.store = telemetryStore;

    // Dynamics Parameters
    this.maxSpeed = 16.0;
    this.maxClimbSpeed = 8.0;
    this.maxTilt = 0.35;
    this.yawRate = 2.2;
    this.damping = 3.5;
    this.verticalDamping = 4.0;
    this.tiltDamping = 8.0;

    // Ground State & Motor Power State Machine ('off' | 'starting' | 'running' | 'stopping')
    this.isGrounded = true;
    this.motorSpinPct = 0.0; // 0.0 (stopped) to 1.0 (full hover RPM)
    this.spinUpDuration = 1.5; // seconds to reach takeoff RPM

    // Autopilot Grid Scan Waypoints
    this.gridWaypoints = [
      { x: -60, z: -60 }, { x: -60, z: 60 },
      { x: -30, z: 60 },  { x: -30, z: -60 },
      { x: 0, z: -60 },    { x: 0, z: 60 },
      { x: 30, z: 60 },   { x: 30, z: -60 },
      { x: 60, z: -60 },   { x: 60, z: 60 }
    ];
    this.currentWaypointIdx = 0;
    this.autoFlightAltitude = 12.0;

    // RTH Parameters
    this.rthAltitude = 14.0;
    this.rthState = 'ascend';
  }

  toggleMotorPower() {
    const currentPower = this.store.getMotorPower();
    if (currentPower === 'off') {
      this.store.setMotorPower('starting');
    } else if (currentPower === 'running' && this.isGrounded) {
      this.store.setMotorPower('stopping');
    }
  }

  update(dt) {
    const inputs = this.store.getInputs();
    const state = this.store.getDroneState();
    let flightMode = this.store.getFlightMode();
    let motorPower = this.store.getMotorPower();
    const battery = this.store.getBattery();

    let [px, py, pz] = state.position;
    let [vx, vy, vz] = state.velocity;
    let [pitch, yaw, roll] = state.rotation;

    // --- 1. Motor Ignition & Shutdown State Machine ---
    if (motorPower === 'off') {
      this.motorSpinPct = 0.0;
      this.isGrounded = true;
      px = px; py = 0.15; pz = pz;
      vx = 0; vy = 0; vz = 0;
      pitch = 0; roll = 0;
    } else if (motorPower === 'starting') {
      this.motorSpinPct = Math.min(1.0, this.motorSpinPct + dt / this.spinUpDuration);
      px = px; py = 0.15; pz = pz;
      vx = 0; vy = 0; vz = 0;
      if (this.motorSpinPct >= 1.0) {
        this.store.setMotorPower('running');
        motorPower = 'running';
      }
    } else if (motorPower === 'stopping') {
      this.motorSpinPct = Math.max(0.0, this.motorSpinPct - (dt / this.spinUpDuration) * 1.2);
      px = px; py = 0.15; pz = pz;
      vx = 0; vy = 0; vz = 0;
      if (this.motorSpinPct <= 0.0) {
        this.store.setMotorPower('off');
        motorPower = 'off';
      }
    } else if (motorPower === 'running') {
      this.motorSpinPct = 1.0;
    }

    // Pass motor spin percentage to telemetry store for propeller animation
    this.store.motorSpinPct = this.motorSpinPct;

    // Auto ignition when starting Grid Mission or RTH
    if (flightMode !== 'manual' && motorPower === 'off') {
      this.store.setMotorPower('starting');
      motorPower = 'starting';
    }

    // --- 2. Motor Battery Drain Physics ---
    if (this.motorSpinPct > 0.05) {
      const inputMagnitude = Math.abs(inputs.throttle) + Math.abs(inputs.pitch) + Math.abs(inputs.roll);
      const drainRate = (0.10 + inputMagnitude * 0.22) * this.motorSpinPct;
      const newBattery = Math.max(0.0, battery.pct - drainRate * dt);
      this.store.updateBattery(newBattery);

      // Emergency RTH Failsafe Trigger at <= 20% Battery
      if (newBattery <= 20.0 && flightMode !== 'rth' && flightMode !== 'landing' && !this.isGrounded) {
        this.startRTH();
        flightMode = 'rth';
      }
    }

    // Pilot Override Check
    const hasPilotInput = Math.abs(inputs.throttle) > 0.15 || Math.abs(inputs.pitch) > 0.15 ||
                         Math.abs(inputs.roll) > 0.15 || Math.abs(inputs.yaw) > 0.15;

    if (hasPilotInput && flightMode !== 'manual' && battery.pct > 15.0) {
      this.store.setFlightMode('manual');
      flightMode = 'manual';
    }

    // --- 3. Flight Dynamics (Active when motors running) ---
    if (motorPower === 'running') {
      if (this.isGrounded && inputs.throttle > 0.1) {
        this.isGrounded = false; // Lift off
      }

      if (!this.isGrounded) {
        if (flightMode === 'auto_grid') {
          const targetWP = this.gridWaypoints[this.currentWaypointIdx];
          const dx = targetWP.x - px;
          const dz = targetWP.z - pz;
          const distToWP = Math.sqrt(dx * dx + dz * dz);

          const targetY = this.autoFlightAltitude;
          const dy = targetY - py;
          vy += dy * 3.0 * dt - vy * this.verticalDamping * dt;

          if (distToWP > 2.0) {
            const targetYaw = Math.atan2(dx, dz);
            yaw += (targetYaw - yaw) * Math.min(1.0, 3.0 * dt);

            const speed = 10.0;
            vx = (dx / distToWP) * speed;
            vz = (dz / distToWP) * speed;

            pitch = -0.15;
          } else {
            this.currentWaypointIdx = (this.currentWaypointIdx + 1) % this.gridWaypoints.length;
            const progressPct = ((this.currentWaypointIdx + 1) / this.gridWaypoints.length) * 100;
            this.store.updateMissionProgress(this.currentWaypointIdx, this.gridWaypoints.length, progressPct);
          }
        } else if (flightMode === 'rth') {
          const homeX = 0.0;
          const homeZ = 0.0;

          if (this.rthState === 'ascend') {
            const targetY = this.rthAltitude;
            vy += (targetY - py) * 4.0 * dt - vy * this.verticalDamping * dt;
            vx *= 0.8; vz *= 0.8;
            if (Math.abs(py - targetY) < 0.5) {
              this.rthState = 'transit';
            }
          } else if (this.rthState === 'transit') {
            const dx = homeX - px;
            const dz = homeZ - pz;
            const distToHome = Math.sqrt(dx * dx + dz * dz);

            if (distToHome > 2.0) {
              const targetYaw = Math.atan2(dx, dz);
              yaw += (targetYaw - yaw) * Math.min(1.0, 3.0 * dt);

              const speed = 12.0;
              vx = (dx / distToHome) * speed;
              vz = (dz / distToHome) * speed;
            } else {
              this.rthState = 'descent';
            }
          } else if (this.rthState === 'descent') {
            vx *= 0.8; vz *= 0.8;
            vy = -2.5;
            if (py <= 0.20) {
              py = 0.15;
              vy = 0;
              this.isGrounded = true;
              this.store.setFlightMode('manual');
            }
          }
        } else {
          // Manual Dynamics
          yaw += inputs.yaw * this.yawRate * dt;
          while (yaw > Math.PI) yaw -= Math.PI * 2;
          while (yaw < -Math.PI) yaw += Math.PI * 2;

          const targetPitch = -inputs.pitch * this.maxTilt;
          const targetRoll = inputs.roll * this.maxTilt;

          pitch += (targetPitch - pitch) * Math.min(1.0, this.tiltDamping * dt);
          roll += (targetRoll - roll) * Math.min(1.0, this.tiltDamping * dt);

          const cosYaw = Math.cos(yaw);
          const sinYaw = Math.sin(yaw);

          const forwardAcc = inputs.pitch * 28.0;
          const rightAcc = inputs.roll * 28.0;

          const ax = sinYaw * forwardAcc + cosYaw * rightAcc;
          const az = cosYaw * forwardAcc - sinYaw * rightAcc;

          const ay = inputs.throttle * 20.0;

          vx += ax * dt - vx * this.damping * dt;
          vy += ay * dt - vy * this.verticalDamping * dt;
          vz += az * dt - vz * this.damping * dt;
        }

        px += vx * dt;
        py += vy * dt;
        pz += vz * dt;

        const minAlt = 0.15;
        const maxAlt = 40.0;
        const fieldLimit = 92.0;

        if (py <= minAlt) {
          py = minAlt;
          vy = 0;
          if (inputs.throttle <= 0) {
            this.isGrounded = true; // Touchdown
          }
        } else if (py > maxAlt) {
          py = maxAlt;
          vy = 0;
        }

        if (px < -fieldLimit) { px = -fieldLimit; vx = 0; }
        if (px > fieldLimit) { px = fieldLimit; vx = 0; }
        if (pz < -fieldLimit) { pz = -fieldLimit; vz = 0; }
        if (pz > fieldLimit) { pz = fieldLimit; vz = 0; }
      }
    }

    this.store.updateDroneState({
      position: [px, py, pz],
      velocity: [vx, vy, vz],
      rotation: [pitch, yaw, roll]
    });
  }

  startGridMission() {
    this.currentWaypointIdx = 0;
    this.store.setMotorPower('starting');
    this.store.setFlightMode('auto_grid');
    this.store.updateMissionProgress(0, this.gridWaypoints.length, 0);
  }

  startRTH() {
    this.rthState = 'ascend';
    this.store.setMotorPower('starting');
    this.store.setFlightMode('rth');
  }

  resetPosition() {
    this.store.updateDroneState({
      position: [0.0, 0.15, 0.0],
      velocity: [0.0, 0.0, 0.0],
      rotation: [0.0, 0.0, 0.0]
    });
    this.isGrounded = true;
    this.motorSpinPct = 0.0;
    this.store.setMotorPower('off');
    this.store.updateBattery(100.0);
    this.store.setFlightMode('manual');
  }
}
