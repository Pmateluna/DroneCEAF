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
    const sampledCHM = groundData.isPath
      ? 0.0
      : Number(Math.max(1.8, (groundData.canopyHeightM || 4.1) + noise * 1.5).toFixed(1));
    const sampledTRV = groundData.isPath
      ? 0
      : Math.round((groundData.trvM3Ha || 13500) + noise * 600);

    let displayValue;
    let color;
    let statusInfo;

    if (mode === 'thermal') {
      statusInfo = SessionLog.getThermalStatus(sampledTemp, groundData.isPath, groundData.treatment);
      displayValue = `${sampledTemp} °C`;
      color = statusInfo.color;
    } else if (mode === 'elevation') {
      if (groundData.isPath || sampledCHM < 0.5) {
        statusInfo = { status: 'Suelo / Entre-Hilera (0 m³/ha)', class: 'moderate', color: '#38bdf8' };
        displayValue = `0.0m | TRV 0`;
        color = '#38bdf8';
      } else if (sampledCHM < 3.35) {
        statusInfo = { status: `Dosel Ralo (TRV ${sampledTRV.toLocaleString('es-CL')} m³/ha)`, class: 'stressed', color: '#f59e0b' };
        displayValue = `${sampledCHM}m Copa`;
        color = '#f59e0b';
      } else if (sampledCHM >= 4.70) {
        statusInfo = { status: `Alto Volumen (TRV ${sampledTRV.toLocaleString('es-CL')} m³/ha)`, class: 'healthy', color: '#d946ef' };
        displayValue = `${sampledCHM}m Copa`;
        color = '#d946ef';
      } else {
        statusInfo = { status: `Dosel Adulto (TRV ${sampledTRV.toLocaleString('es-CL')} m³/ha)`, class: 'healthy', color: '#4ade80' };
        displayValue = `${sampledCHM}m Copa`;
        color = '#4ade80';
      }
    } else if (mode === 'rgb') {
      statusInfo = SessionLog.getCropStatus(sampledNDVI, groundData.isPath, groundData.treatment, groundData.rawNDVI);
      displayValue = `NDVI: ${sampledNDVI.toFixed(2)}`;
      color = statusInfo.color || '#38bdf8';
    } else {
      // mode === 'ndvi'
      statusInfo = SessionLog.getCropStatus(sampledNDVI, groundData.isPath, groundData.treatment, groundData.rawNDVI);
      displayValue = `${sampledNDVI.toFixed(2)}`;
      color = statusInfo.color;
    }

    const entry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: SessionLog.formatTimestamp(),
      position: [px.toFixed(1), pz.toFixed(1)],
      ndvi: sampledNDVI,
      temperatureC: sampledTemp,
      elevationM: sampledCHM,
      trvM3Ha: sampledTRV,
      displayValue,
      status: statusInfo.status,
      statusClass: statusInfo.class,
      color,
      mode
    };

    this.store.addSensorReading(entry);
  }
}
