/**
 * HUD
 * Renders flight metrics, multispectral readings, battery gauge, camera FPV toggle, motor ignition controls, and battery forecast estimates.
 * Clean, professional UI without emoticons.
 */
export class HUD {
  constructor(telemetryStore, flightModel, camera) {
    this.store = telemetryStore;
    this.flightModel = flightModel;
    this.camera = camera;

    // Flight Metrics DOM
    this.altEl = document.getElementById('hud-alt');
    this.speedEl = document.getElementById('hud-speed');
    this.headingEl = document.getElementById('hud-heading');
    this.posEl = document.getElementById('hud-pos');

    // Battery Forecast DOM
    this.estRthEl = document.getElementById('hud-est-rth');
    this.estMissionEl = document.getElementById('hud-est-mission');

    // System Status & Battery
    this.systemPill = document.getElementById('system-status-pill');
    this.systemText = document.getElementById('system-status-text');
    this.batteryPill = document.getElementById('battery-pill');
    this.batteryText = document.getElementById('battery-pct-text');

    // Mission Telemetry
    this.flightModeEl = document.getElementById('hud-flight-mode');
    this.missionProgressEl = document.getElementById('hud-mission-progress');

    // Sensor Card
    this.sensorTitleEl = document.getElementById('sensor-hud-title');
    this.ndviValueEl = document.getElementById('hud-ndvi-value');
    this.ndviStatusEl = document.getElementById('hud-ndvi-status');
    this.ndviBarEl = document.getElementById('hud-ndvi-bar');

    // Buttons
    this.btnMotorPower = document.getElementById('btn-motor-power');
    this.btnMotorText = document.getElementById('motor-power-text');
    this.btnCameraToggle = document.getElementById('btn-camera-toggle');
    this.btnCameraText = document.getElementById('camera-btn-text');
    this.btnAutoGrid = document.getElementById('btn-auto-grid');
    this.btnRth = document.getElementById('btn-rth');
    this.spectralBarEl = document.getElementById('spectral-bar');

    this.initListeners();
    this.initSubscriptions();
  }

  initListeners() {
    if (this.btnMotorPower) {
      this.btnMotorPower.addEventListener('click', () => {
        if (this.flightModel) this.flightModel.toggleMotorPower();
      });
    }

    if (this.btnCameraToggle) {
      this.btnCameraToggle.addEventListener('click', () => {
        if (this.camera) {
          const mode = this.camera.toggleMode();
          this.updateCameraUI(mode);
        }
      });
    }

    if (this.btnAutoGrid) {
      this.btnAutoGrid.addEventListener('click', () => {
        if (this.flightModel) this.flightModel.startGridMission();
      });
    }

    if (this.btnRth) {
      this.btnRth.addEventListener('click', () => {
        if (this.flightModel) this.flightModel.startRTH();
      });
    }

    if (this.spectralBarEl) {
      const pills = this.spectralBarEl.querySelectorAll('.spectral-pill');
      pills.forEach(pill => {
        pill.addEventListener('click', () => {
          const mode = pill.getAttribute('data-mode');
          this.store.setSensorMode(mode);
        });
      });
    }
  }

  updateCameraUI(mode) {
    if (this.btnCameraText) {
      this.btnCameraText.innerText = mode === 'first_person' ? '1ª Persona FPV' : '3ª Persona';
    }
  }

  updateMotorPowerUI(powerState) {
    if (!this.btnMotorPower || !this.btnMotorText) return;

    if (powerState === 'off') {
      this.btnMotorText.innerText = 'Encender Motores';
      this.btnMotorPower.classList.remove('active');
      if (this.systemText) this.systemText.innerText = 'APAGADO';
      if (this.flightModeEl) {
        this.flightModeEl.innerText = 'MOTORES APAGADOS';
        this.flightModeEl.style.color = 'var(--accent-amber)';
      }
    } else if (powerState === 'starting') {
      this.btnMotorText.innerText = 'Encendiendo...';
      this.btnMotorPower.classList.remove('active');
      if (this.systemText) this.systemText.innerText = 'ENCENDIENDO';
      if (this.flightModeEl) {
        this.flightModeEl.innerText = 'ENCENDIENDO MOTORES...';
        this.flightModeEl.style.color = 'var(--accent-amber)';
      }
    } else if (powerState === 'running') {
      this.btnMotorText.innerText = 'Apagar Motores';
      this.btnMotorPower.classList.add('active');
      if (this.systemText) this.systemText.innerText = 'MANUAL';
      if (this.flightModeEl) {
        this.flightModeEl.innerText = 'MOTORES ACTIVOS';
        this.flightModeEl.style.color = 'var(--accent-green)';
      }
    } else if (powerState === 'stopping') {
      this.btnMotorText.innerText = 'Apagando...';
      this.btnMotorPower.classList.remove('active');
      if (this.systemText) this.systemText.innerText = 'APAGANDO';
      if (this.flightModeEl) {
        this.flightModeEl.innerText = 'DESACELERANDO...';
        this.flightModeEl.style.color = 'var(--accent-amber)';
      }
    }
  }

  updatePillsUI(activeMode) {
    if (!this.spectralBarEl) return;
    const pills = this.spectralBarEl.querySelectorAll('.spectral-pill');
    pills.forEach(pill => {
      const mode = pill.getAttribute('data-mode');
      if (mode === activeMode) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    const modeLabels = {
      rgb: 'SENSOR ACTIVO (COLOR NATURAL RGB)',
      ndvi: 'SENSOR ACTIVO (NDVI SALUD VEGETAL)',
      thermal: 'SENSOR ACTIVO (TÉRMICO INFRARROJO)',
      elevation: 'SENSOR ACTIVO (LIDAR ELEVACIÓN DOSEL)'
    };
    if (this.sensorTitleEl) {
      this.sensorTitleEl.innerText = modeLabels[activeMode] || 'SENSOR MULTIESPECTRAL';
    }

    const chartTitleEl = document.getElementById('chart-title-text');
    if (chartTitleEl) {
      const chartTitles = {
        rgb: 'Tendencia NDVI en Tiempo Real (0.0 a 1.0)',
        ndvi: 'Tendencia del Índice NDVI Salud (0.0 a 1.0)',
        thermal: 'Temperatura de Canopia vs Suelo (°C)',
        elevation: 'Elevación de Vuelo y Dosel (m)'
      };
      chartTitleEl.innerText = chartTitles[activeMode] || 'Tendencia del Sensor';
    }
  }

  initSubscriptions() {
    this.store.on('droneUpdate', (droneState) => {
      if (this.altEl) this.altEl.innerHTML = `${droneState.altitudeM.toFixed(1)}<span class="unit">m</span>`;
      if (this.speedEl) this.speedEl.innerHTML = `${droneState.speedMs.toFixed(1)}<span class="unit">m/s</span>`;
      if (this.headingEl) this.headingEl.innerHTML = `${String(droneState.headingDeg).padStart(3, '0')}<span class="unit">°</span>`;

      const px = droneState.position[0];
      const pz = droneState.position[2];
      const py = droneState.position[1];

      if (this.posEl) this.posEl.innerText = `X: ${px.toFixed(1)} | Z: ${pz.toFixed(1)}`;

      const distToHome = Math.sqrt(px * px + pz * pz);
      const estRthPct = (distToHome * 0.08 + py * 0.12 + 1.2).toFixed(1);
      const estMissionPct = (18.5).toFixed(1);

      if (this.estRthEl) this.estRthEl.innerText = `~${estRthPct}%`;
      if (this.estMissionEl) this.estMissionEl.innerText = `~${estMissionPct}%`;
    });

    this.store.on('motorPowerChange', (powerState) => {
      this.updateMotorPowerUI(powerState);
    });

    this.store.on('cameraModeChange', (mode) => {
      this.updateCameraUI(mode);
    });

    this.store.on('batteryUpdate', (battery) => {
      if (this.batteryText) {
        this.batteryText.innerText = `${Math.round(battery.pct)}%`;
      }
      if (this.batteryPill) {
        this.batteryPill.className = `battery-pill ${battery.state}`;
      }
    });

    this.store.on('flightModeChange', (mode) => {
      const modeTags = {
        manual: 'PILOTO MANUAL',
        auto_grid: 'MISIÓN CUADRÍCULA',
        rth: 'RETORNO RTH (BASE)',
        landing: 'ATERRIZANDO'
      };
      const text = modeTags[mode] || 'MANUAL';

      if (this.systemText) this.systemText.innerText = text;
      if (this.flightModeEl) {
        this.flightModeEl.innerText = text;
        this.flightModeEl.style.color = mode === 'manual' ? 'var(--accent-cyan)' : mode === 'auto_grid' ? 'var(--accent-green)' : 'var(--accent-amber)';
      }
    });

    this.store.on('missionUpdate', (mission) => {
      if (this.missionProgressEl) {
        this.missionProgressEl.innerText = `${mission.progressPct}% (${mission.waypointIndex}/${mission.totalWaypoints})`;
      }
    });

    this.store.on('sensorModeChange', (mode) => {
      this.updatePillsUI(mode);
    });

    this.store.on('sensorReading', (reading) => {
      if (!reading) return;

      if (this.ndviValueEl) {
        this.ndviValueEl.innerText = reading.displayValue;
        this.ndviValueEl.style.color = reading.color;
      }

      if (this.ndviStatusEl) {
        this.ndviStatusEl.innerText = reading.status.toUpperCase();
        this.ndviStatusEl.className = `ndvi-status-tag ${reading.statusClass}`;
      }

      if (this.ndviBarEl) {
        let pct = Math.max(0, Math.min(100, reading.ndvi * 100));
        const mode = this.store.getSensorMode();
        if (mode === 'thermal') {
          pct = Math.max(0, Math.min(100, ((reading.temperatureC - 20) / 25) * 100));
        } else if (mode === 'elevation') {
          pct = Math.max(0, Math.min(100, (reading.elevationM / 15) * 100));
        }
        this.ndviBarEl.style.width = `${pct}%`;
      }
    });
  }
}
