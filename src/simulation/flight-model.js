/**
 * FlightModel
 * Handles quadcopter flight dynamics, motor ground ignition/shutdown state machine, battery drain,
 * Targeted Zone Autopilot (visiting only Stressed / High-NDVI zones), and RTH failsafe.
 */
export class FlightModel {
  constructor(telemetryStore, fieldGenerator = null) {
    this.store = telemetryStore;
    this.field = fieldGenerator;

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

    // Autopilot Targeted Zone Waypoints
    this.gridWaypoints = [];
    this.currentWaypointIdx = 0;
    this.autoFlightAltitude = 11.5;

    // RTH Parameters
    this.rthAltitude = 14.0;
    this.rthState = 'ascend';
    this.isAutoMissionCompleted = false;
  }

  /**
   * Construye la ruta óptima (Nearest-Neighbor) visitando únicamente las zonas generadas al azar:
   * - Dron de Aspersión: se dirige exclusivamente a las Zonas Estresadas y realiza pasadas locales de fumigación.
   * - Dron Multiespectral: visita todas las zonas de interés (Zonas Estresadas + Zonas de Alto NDVI).
   */
  buildTargetedWaypoints() {
    if (!this.field) {
      this.gridWaypoints = [{ x: -35, z: 25, zoneName: 'Zona 1' }, { x: 35, z: -30, zoneName: 'Zona 2' }];
      return;
    }

    const droneType = this.store.getDroneType();
    const [startX, , startZ] = this.store.getDroneState().position;

    // Seleccionar zonas objetivo según el tipo de aeronave
    let candidateZones = [];
    if (droneType === 'sprayer') {
      // Priorizar zonas estresadas aún no recuperadas al 100%
      const pendingStress = (this.field.stressZones || []).filter(z => this.field.getZoneRecoveryRatio(z) < 0.85);
      candidateZones = pendingStress.length > 0 ? [...pendingStress] : [...(this.field.stressZones || [])];
    } else {
      // El dron multiespectral inspecciona tanto zonas estresadas como zonas de alto NDVI
      candidateZones = [...(this.field.anomalyZones || [])];
    }

    // Ordenar zonas por vecino más cercano (Nearest-Neighbor TSP) desde la posición actual del dron
    const orderedZones = [];
    let currX = startX;
    let currZ = startZ;
    const remaining = [...candidateZones];

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const dx = remaining[i].x - currX;
        const dz = remaining[i].z - currZ;
        const d = dx * dx + dz * dz;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const chosen = remaining.splice(bestIdx, 1)[0];
      orderedZones.push(chosen);
      currX = chosen.x;
      currZ = chosen.z;
    }

    // Generar waypoints específicos sobre cada zona objetivo
    const waypoints = [];
    orderedZones.forEach((zone, zIdx) => {
      const zoneIndexLabel = `${zIdx + 1}/${orderedZones.length}: ${zone.name}`;
      if (droneType === 'sprayer' && zone.type === 'stressed') {
        // Barrido focalizado sobre la zona estresada para cubrir todo su radio con aspersión
        const r = Math.min(10, Math.round(zone.radius * 0.42));
        waypoints.push(
          { x: zone.x - r, z: zone.z - r, zone, zoneIndex: zIdx + 1, totalZones: orderedZones.length, label: zoneIndexLabel },
          { x: zone.x + r, z: zone.z - r, zone, zoneIndex: zIdx + 1, totalZones: orderedZones.length, label: zoneIndexLabel },
          { x: zone.x,     z: zone.z,     zone, zoneIndex: zIdx + 1, totalZones: orderedZones.length, label: zoneIndexLabel },
          { x: zone.x - r, z: zone.z + r, zone, zoneIndex: zIdx + 1, totalZones: orderedZones.length, label: zoneIndexLabel },
          { x: zone.x + r, z: zone.z + r, zone, zoneIndex: zIdx + 1, totalZones: orderedZones.length, label: zoneIndexLabel }
        );
      } else {
        // Muestreo puntual sobre el centro y borde interior de cada zona (estresada o alto NDVI)
        const r = Math.min(6, Math.round(zone.radius * 0.28));
        waypoints.push(
          { x: zone.x - r, z: zone.z, zone, zoneIndex: zIdx + 1, totalZones: orderedZones.length, label: zoneIndexLabel },
          { x: zone.x,     z: zone.z, zone, zoneIndex: zIdx + 1, totalZones: orderedZones.length, label: zoneIndexLabel },
          { x: zone.x + r, z: zone.z, zone, zoneIndex: zIdx + 1, totalZones: orderedZones.length, label: zoneIndexLabel }
        );
      }
    });

    this.gridWaypoints = waypoints;
    this.totalTargetZones = orderedZones.length;
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
      py = 0.15;
      vx = 0; vy = 0; vz = 0;
      pitch = 0; roll = 0;
    } else if (motorPower === 'starting') {
      this.motorSpinPct = Math.min(1.0, this.motorSpinPct + dt / this.spinUpDuration);
      py = 0.15;
      vx = 0; vy = 0; vz = 0;
      if (this.motorSpinPct >= 1.0) {
        this.store.setMotorPower('running');
        motorPower = 'running';
      }
    } else if (motorPower === 'stopping') {
      this.motorSpinPct = Math.max(0.0, this.motorSpinPct - (dt / this.spinUpDuration) * 1.2);
      py = 0.15;
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

    // Auto ignition when starting Autonomous Mission or RTH
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
      // Despegue automático si está en misión autónoma o si el piloto aplica acelerador
      if (this.isGrounded && (inputs.throttle > 0.1 || flightMode !== 'manual')) {
        this.isGrounded = false;
      }

      if (!this.isGrounded) {
        if (flightMode === 'auto_grid') {
          if (!this.gridWaypoints || this.gridWaypoints.length === 0) {
            this.buildTargetedWaypoints();
          }

          const targetWP = this.gridWaypoints[this.currentWaypointIdx];
          if (targetWP) {
            const dx = targetWP.x - px;
            const dz = targetWP.z - pz;
            const distToWP = Math.sqrt(dx * dx + dz * dz);

            const targetY = this.autoFlightAltitude;
            const dy = targetY - py;
            vy += dy * 3.2 * dt - vy * this.verticalDamping * dt;

            // Control inteligente de bomba de aspersión: encender SOLO sobre la zona objetivo estresada
            const droneType = this.store.getDroneType();
            if (droneType === 'sprayer' && targetWP.zone) {
              const distToZoneCenter = Math.hypot(px - targetWP.zone.x, pz - targetWP.zone.z);
              const shouldSpray = distToZoneCenter <= targetWP.zone.radius * 0.95 && py > 2.5 && this.store.tankLevelL > 0;
              this.store.setSprayPumpState(shouldSpray ? 'on' : 'off');
            }

            if (distToWP > 1.8) {
              const targetYaw = Math.atan2(dx, dz);
              let diffYaw = targetYaw - yaw;
              while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
              while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
              yaw += diffYaw * Math.min(1.0, 4.5 * dt);

              // Velocidad más pausada dentro de la zona para permitir muestreo o deposición fitosanitaria óptima
              const insideZone = targetWP.zone && Math.hypot(px - targetWP.zone.x, pz - targetWP.zone.z) <= targetWP.zone.radius;
              const speed = insideZone ? 7.5 : 12.5;
              vx = (dx / distToWP) * speed;
              vz = (dz / distToWP) * speed;

              pitch = -0.15;
              roll = 0;
            } else {
              if (this.currentWaypointIdx < this.gridWaypoints.length - 1) {
                this.currentWaypointIdx++;
                const nextWP = this.gridWaypoints[this.currentWaypointIdx];
                const progressPct = ((this.currentWaypointIdx + 1) / this.gridWaypoints.length) * 100;
                this.store.updateMissionProgress(
                  nextWP.zoneIndex || (this.currentWaypointIdx + 1),
                  nextWP.totalZones || this.gridWaypoints.length,
                  progressPct,
                  nextWP.zone ? nextWP.zone.name : ''
                );
              } else {
                // Todas las zonas objetivo completadas -> Retorno automático a base (RTH)
                this.store.updateMissionProgress(
                  this.totalTargetZones || this.gridWaypoints.length,
                  this.totalTargetZones || this.gridWaypoints.length,
                  100,
                  'Completado'
                );
                this.isAutoMissionCompleted = true;
                this.startRTH();
                flightMode = 'rth';
              }
            }
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
              let diffYaw = targetYaw - yaw;
              while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
              while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
              yaw += diffYaw * Math.min(1.0, 4.5 * dt);

              const speed = 12.5;
              vx = (dx / distToHome) * speed;
              vz = (dz / distToHome) * speed;
              pitch = -0.15;
              roll = 0;
            } else {
              this.rthState = 'descent';
            }
          } else if (this.rthState === 'descent') {
            vx *= 0.8; vz *= 0.8;
            vy = -2.5;
            pitch = 0; roll = 0;
            if (py <= 0.20) {
              py = 0.15;
              vy = 0;
              this.isGrounded = true;
              this.store.setFlightMode('manual');

              if (this.isAutoMissionCompleted) {
                this.isAutoMissionCompleted = false;
                this.store.setMotorPower('stopping');
                this.store.notifyMissionCompleted({
                  coveragePct: 100,
                  timestamp: new Date().toLocaleTimeString('es-CL')
                });
              }
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

        // Agricultural Spray Liquid Tank Consumption
        if (this.store.getDroneType() === 'sprayer' && this.store.getSprayPumpState() === 'on' && !this.isGrounded) {
          const flowRateLmin = this.store.getFlowRate();
          const consumedL = (flowRateLmin / 60.0) * dt;
          this.store.consumeLiquid(consumedL);
        }

        const minAlt = 0.15;
        const maxAlt = 40.0;
        const fieldLimit = 92.0;

        if (py <= minAlt) {
          py = minAlt;
          vy = 0;
          if (inputs.throttle <= 0 && flightMode === 'manual') {
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
    this.buildTargetedWaypoints();
    this.currentWaypointIdx = 0;
    this.store.setMotorPower('starting');
    this.store.setFlightMode('auto_grid');
    const firstWP = this.gridWaypoints[0];
    this.store.updateMissionProgress(
      1,
      this.totalTargetZones || this.gridWaypoints.length,
      0,
      firstWP && firstWP.zone ? firstWP.zone.name : ''
    );
  }

  startRTH() {
    this.rthState = 'ascend';
    if (this.store.getSprayPumpState() === 'on') {
      this.store.setSprayPumpState('off');
    }
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
