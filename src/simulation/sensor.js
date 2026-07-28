import { SessionLog } from '../data/session-log.js';

/**
 * SensorSampler
 * Simulates multispectral optical, thermal, and elevation sensors onboard the drone.
 * Periodically samples ground data at current drone position.
 */
export class SensorSampler {
  constructor(telemetryStore, fieldGenerator, sampleIntervalMs = 500) {
    this.store = telemetryStore;
    this.field = fieldGenerator;
    this.intervalMs = sampleIntervalMs;
    this.timerId = null;
    this.isSampling = false;
  }

  start() {
    if (this.isSampling) return;
    this.isSampling = true;
    this.timerId = setInterval(() => this.sample(), this.intervalMs);
    this.sample();
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isSampling = false;
  }

  sample() {
    const droneState = this.store.getDroneState();
    const [px, py, pz] = droneState.position;
    const mode = this.store.getSensorMode();

    const groundData = this.field.getGroundDataAt(px, pz);

    const noise = (Math.random() - 0.5) * 0.02;
    const sampledNDVI = Math.max(0.05, Math.min(0.98, groundData.ndvi + noise));
    const sampledTemp = Number((groundData.temperatureC + noise * 5.0).toFixed(1));
    const sampledAlt = Number(py.toFixed(1));

    let displayValue;
    let color;

    if (mode === 'rgb') {
      displayValue = `NDVI: ${sampledNDVI.toFixed(2)}`;
      color = '#38bdf8';
    } else if (mode === 'thermal') {
      displayValue = `${sampledTemp} °C`;
      color = sampledTemp > 30 ? '#ef4444' : sampledTemp > 26 ? '#f59e0b' : '#38bdf8';
    } else if (mode === 'elevation') {
      displayValue = `${sampledAlt} m`;
      color = '#a855f7';
    } else {
      displayValue = `${sampledNDVI.toFixed(2)}`;
      color = SessionLog.getCropStatus(sampledNDVI).color;
    }

    const statusInfo = SessionLog.getCropStatus(sampledNDVI);

    const entry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: SessionLog.formatTimestamp(),
      position: [px.toFixed(1), pz.toFixed(1)],
      ndvi: sampledNDVI,
      temperatureC: sampledTemp,
      elevationM: sampledAlt,
      displayValue,
      status: statusInfo.status,
      statusClass: statusInfo.class,
      color
    };

    this.store.addSensorReading(entry);
  }
}
