/**
 * TelemetryStore
 * Single Source of Truth for simulation, engine, inputs, and UI.
 * Handles motor power state ('off' | 'starting' | 'running' | 'stopping'), battery drain, flight modes, and multispectral views.
 */
class TelemetryStore {
  constructor() {
    // Control Inputs
    this.inputs = {
      throttle: 0,
      yaw: 0,
      pitch: 0,
      roll: 0
    };

    // Drone Telemetry State
    this.drone = {
      position: [0.0, 0.15, 0.0],
      velocity: [0.0, 0.0, 0.0],
      rotation: [0.0, 0.0, 0.0],
      headingDeg: 0,
      speedMs: 0.0,
      altitudeM: 0.0
    };

    // Motor Power State: 'off' | 'starting' | 'running' | 'stopping'
    this.motorPower = 'off';

    // Active Sensor View Mode: 'rgb' | 'ndvi' | 'thermal' | 'elevation'
    this.activeSensorMode = 'rgb';

    // Battery State
    this.batteryPct = 100.0;
    this.batteryState = 'nominal'; // 'nominal' | 'warning' | 'critical'

    // Flight Mode & Autopilot
    this.flightMode = 'manual'; // 'manual' | 'auto_grid' | 'rth' | 'landing'
    this.homePosition = [0.0, 0.15, 0.0];
    this.waypointIndex = 0;
    this.totalWaypoints = 16;
    this.missionProgressPct = 0;

    // Sensor Telemetry Logs
    this.currentSensorReading = {
      ndvi: 0.75,
      temperatureC: 24.2,
      elevationM: 0.0,
      displayValue: '0.75',
      status: 'Saludable',
      color: '#22c55e',
      position: [0, 0]
    };
    
    this.sensorLogs = [];
    this.maxLogs = 100;

    // Subscriptions
    this.listeners = {
      inputChange: [],
      droneUpdate: [],
      sensorReading: [],
      sensorModeChange: [],
      batteryUpdate: [],
      flightModeChange: [],
      missionUpdate: [],
      motorPowerChange: [],
      cameraModeChange: [],
      logAdded: []
    };
  }

  // --- Motor Power Methods ---
  setMotorPower(state) {
    if (['off', 'starting', 'running', 'stopping'].includes(state) && this.motorPower !== state) {
      this.motorPower = state;
      this.notify('motorPowerChange', this.motorPower);
    }
  }

  getMotorPower() {
    return this.motorPower;
  }

  // --- Battery Methods ---
  updateBattery(pct) {
    this.batteryPct = Math.max(0.0, Math.min(100.0, pct));
    let newState = 'nominal';
    if (this.batteryPct <= 20.0) newState = 'critical';
    else if (this.batteryPct <= 45.0) newState = 'warning';

    this.batteryState = newState;

    this.notify('batteryUpdate', {
      pct: this.batteryPct,
      state: this.batteryState
    });
  }

  getBattery() {
    return { pct: this.batteryPct, state: this.batteryState };
  }

  // --- Flight Mode & Autopilot Methods ---
  setFlightMode(mode) {
    if (['manual', 'auto_grid', 'rth', 'landing'].includes(mode) && this.flightMode !== mode) {
      this.flightMode = mode;
      this.notify('flightModeChange', this.flightMode);
    }
  }

  getFlightMode() {
    return this.flightMode;
  }

  updateMissionProgress(waypointIdx, totalWaypoints, progressPct) {
    this.waypointIndex = waypointIdx;
    this.totalWaypoints = totalWaypoints;
    this.missionProgressPct = Math.round(progressPct);
    this.notify('missionUpdate', {
      waypointIndex: this.waypointIndex,
      totalWaypoints: this.totalWaypoints,
      progressPct: this.missionProgressPct
    });
  }

  getMissionProgress() {
    return {
      waypointIndex: this.waypointIndex,
      totalWaypoints: this.totalWaypoints,
      progressPct: this.missionProgressPct
    };
  }

  // --- Sensor Mode Methods ---
  setSensorMode(mode) {
    if (['rgb', 'ndvi', 'thermal', 'elevation'].includes(mode) && this.activeSensorMode !== mode) {
      this.activeSensorMode = mode;
      this.notify('sensorModeChange', this.activeSensorMode);
    }
  }

  getSensorMode() {
    return this.activeSensorMode;
  }

  // --- Input Methods ---
  setInput(axis, value) {
    const clamped = Math.max(-1.0, Math.min(1.0, value));
    if (this.inputs[axis] !== clamped) {
      this.inputs[axis] = clamped;
      this.notify('inputChange', this.inputs);
    }
  }

  setInputs(newInputs) {
    let changed = false;
    for (const key in newInputs) {
      const clamped = Math.max(-1.0, Math.min(1.0, newInputs[key]));
      if (this.inputs[key] !== clamped) {
        this.inputs[key] = clamped;
        changed = true;
      }
    }
    if (changed) {
      this.notify('inputChange', this.inputs);
    }
  }

  getInputs() {
    return { ...this.inputs };
  }

  // --- Drone State Methods ---
  updateDroneState(state) {
    Object.assign(this.drone, state);
    
    this.drone.altitudeM = Math.max(0.0, this.drone.position[1] - 0.15);
    const vx = this.drone.velocity[0];
    const vz = this.drone.velocity[2];
    this.drone.speedMs = Math.sqrt(vx * vx + vz * vz);
    
    let heading = (this.drone.rotation[1] * 180 / Math.PI) % 360;
    if (heading < 0) heading += 360;
    this.drone.headingDeg = Math.round(heading);

    this.notify('droneUpdate', this.drone);
  }

  getDroneState() {
    return {
      position: [...this.drone.position],
      velocity: [...this.drone.velocity],
      rotation: [...this.drone.rotation],
      headingDeg: this.drone.headingDeg,
      speedMs: this.drone.speedMs,
      altitudeM: this.drone.altitudeM
    };
  }

  // --- Sensor Log Methods ---
  addSensorReading(reading) {
    this.currentSensorReading = { ...reading };
    this.sensorLogs.push(reading);
    if (this.sensorLogs.length > this.maxLogs) {
      this.sensorLogs.shift();
    }
    this.notify('sensorReading', this.currentSensorReading);
    this.notify('logAdded', reading);
  }

  getSensorLogs() {
    return [...this.sensorLogs];
  }

  getCurrentSensorReading() {
    return { ...this.currentSensorReading };
  }

  // --- Pub/Sub Event System ---
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  notify(event, payload) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(payload));
    }
  }
}

export const telemetryStore = new TelemetryStore();
