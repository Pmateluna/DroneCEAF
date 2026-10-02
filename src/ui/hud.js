/**
 * HUD
 * Renders flight metrics, multispectral readings, battery gauge, camera FPV toggle, motor ignition controls, battery forecast estimates, dual-drone aircraft switcher, and Sprayer HUD controls.
 * Clean, professional UI without emoticons.
 */
export class HUD {
  constructor(telemetryStore, flightModel, camera, fieldGenerator = null) {
    this.store = telemetryStore;
    this.flightModel = flightModel;
    this.camera = camera;
    this.field = fieldGenerator;

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

    // Sensor Card (Multispectral)
    this.sensorHudPanel = document.getElementById('sensor-hud-panel');
    this.sensorTitleEl = document.getElementById('sensor-hud-title');
    this.ndviValueEl = document.getElementById('hud-ndvi-value');
    this.ndviStatusEl = document.getElementById('hud-ndvi-status');
    this.ndviBarEl = document.getElementById('hud-ndvi-bar');

    // Sprayer Card (Fitosanitario)
    this.sprayerHudPanel = document.getElementById('sprayer-hud-panel');
    this.hudTankValue = document.getElementById('hud-tank-value');
    this.hudTankBar = document.getElementById('hud-tank-bar');
    this.btnSprayPump = document.getElementById('btn-spray-pump');
    this.sprayPumpText = document.getElementById('spray-pump-text');
    this.selectFlowRate = document.getElementById('select-flow-rate');
    this.btnRefillTank = document.getElementById('btn-refill-tank');
    this.hudLiquidSprayed = document.getElementById('hud-liquid-sprayed');
    this.hudAreaCovered = document.getElementById('hud-area-covered');
    this.hudStressRecovery = document.getElementById('hud-stress-recovery');

    // Action Buttons & Top Bar
    this.btnDroneSelector = document.getElementById('btn-drone-selector');
    this.droneSelectorText = document.getElementById('drone-selector-text');
    this.btnMotorPower = document.getElementById('btn-motor-power');
    this.btnMotorText = document.getElementById('motor-power-text');
    this.btnCameraToggle = document.getElementById('btn-camera-toggle');
    this.btnCameraText = document.getElementById('camera-btn-text');
    this.btnAutoGrid = document.getElementById('btn-auto-grid');
    this.btnRandomizeZones = document.getElementById('btn-randomize-zones');
    this.btnOpenGis = document.getElementById('btn-open-gis');
    this.btnRth = document.getElementById('btn-rth');
    this.spectralBarEl = document.getElementById('spectral-bar');

    // Startup Drone Selector Modal DOM
    this.droneSelectorModal = document.getElementById('drone-selector-modal');
    this.cardMultispectral = document.getElementById('card-select-multispectral');
    this.cardSprayer = document.getElementById('card-select-sprayer');

    // CEAF GeoLab GIS (QGIS / Pix4DFields) Modal DOM
    this.modalOverlay = document.getElementById('acquisition-modal');
    this.reportCanvas = document.getElementById('report-canvas');
    this.reportFilterBar = document.getElementById('report-filter-bar');
    this.reportDescEl = document.getElementById('report-filter-description');
    this.btnCloseReport = document.getElementById('btn-close-report');
    this.btnCloseReportX = document.getElementById('btn-close-report-x');
    this.reportBadgeNdvi = document.getElementById('report-badge-ndvi');
    this.reportBadgeTemp = document.getElementById('report-badge-temp');
    this.reportBadgeDiag = document.getElementById('report-badge-diag');
    this.currentReportFilter = 'vra';
    this.selectedGisFid = null;

    // GIS Layer Tree Checkboxes
    this.chkLayerPolygons = document.getElementById('gis-layer-polygons');
    this.chkLayerLabels = document.getElementById('gis-layer-labels');
    this.chkLayerVraGrid = document.getElementById('gis-layer-vra-grid');
    this.chkLayerRoute = document.getElementById('gis-layer-route');
    this.chkLayerTrees = document.getElementById('gis-layer-trees');
    this.chkLayerUtm = document.getElementById('gis-layer-utm');

    // GIS Status Bar, VRA Calculator & Attribute Table
    this.gisStatusUtm = document.getElementById('gis-status-utm');
    this.gisStatusPixel = document.getElementById('gis-status-pixel');
    this.gisConvVolume = document.getElementById('gis-conv-volume');
    this.gisVraVolume = document.getElementById('gis-vra-volume');
    this.gisVraArea = document.getElementById('gis-vra-area');
    this.gisVraSavings = document.getElementById('gis-vra-savings');
    this.gisVraSavedLiters = document.getElementById('gis-vra-saved-liters');
    this.gisFeatureCount = document.getElementById('gis-feature-count');
    this.gisAttributeTbody = document.getElementById('gis-attribute-tbody');

    // GIS Export & Transfer Buttons
    this.btnExportGeojson = document.getElementById('btn-export-geojson');
    this.btnExportCsv = document.getElementById('btn-export-csv');
    this.btnTransferVraDrone = document.getElementById('btn-transfer-vra-drone');

    // Picture-in-Picture (PiP) Nadir Camera Monitor DOM
    this.pipCameraPanel = document.getElementById('pip-camera-panel');
    this.pipNadirCanvas = document.getElementById('pip-nadir-canvas');
    this.pipChannelBar = document.getElementById('pip-channel-bar');
    this.btnPipMinimize = document.getElementById('btn-pip-minimize');
    this.pipReadoutNdvi = document.getElementById('pip-readout-ndvi');
    this.pipReadoutTemp = document.getElementById('pip-readout-temp');
    this.pipReadoutVra = document.getElementById('pip-readout-vra');
    this.pipMode = 'ndvi';
    this.pipMinimized = false;

    this.btnConfirmMultispectral = document.getElementById('btn-confirm-multispectral');
    this.btnConfirmSprayer = document.getElementById('btn-confirm-sprayer');
    this.chkFsrToggle = document.getElementById('chk-fsr-toggle');

    // Gamepad DOM
    this.gamepadStatusPill = document.getElementById('gamepad-status-pill');
    this.gamepadStatusText = document.getElementById('gamepad-status-text');
    this.keyboardGuideRows = document.getElementById('keyboard-guide-rows');
    this.gamepadGuideRows = document.getElementById('gamepad-guide-rows');
    this.guideTitle = document.getElementById('guide-title');

    this.initListeners();
    this.initModalListeners();
    this.initSubscriptions();

    this.updateDroneTypeUI(this.store.getDroneType());
    this.updateGamepadUI(this.store.getGamepadState());
    if (typeof window !== 'undefined' && window.initialDroneType) {
      window.selectDrone(window.initialDroneType);
    }
    this.renderPiPNadirFeed(this.store.getDroneState());
  }

  randomizeOrchardZones() {
    if (!this.field || typeof this.field.regenerateRandomField !== 'function') return;
    this.field.regenerateRandomField();
    this.selectedGisFid = null;
    this.store.notifyFieldRegenerated();
    if (this.store.getFlightMode() === 'auto_grid' && this.flightModel) {
      this.flightModel.startGridMission();
    }
    if (this.modalOverlay && this.modalOverlay.classList.contains('active')) {
      this.renderReportPreview(this.currentReportFilter);
    }
    this.renderPiPNadirFeed(this.store.getDroneState());
  }

  initListeners() {
    if (this.chkFsrToggle) {
      this.chkFsrToggle.checked = this.store.getFsrEnabled ? this.store.getFsrEnabled() : false;
      this.chkFsrToggle.addEventListener('change', (e) => {
        if (this.store.setFsrEnabled) {
          this.store.setFsrEnabled(e.target.checked);
        }
      });
    }

    window.selectDrone = (type) => {
      if (type === 'sprayer') {
        if (this.cardMultispectral) this.cardMultispectral.classList.remove('active');
        if (this.cardSprayer) this.cardSprayer.classList.add('active');
        this.store.setDroneType('sprayer');
      } else {
        if (this.cardSprayer) this.cardSprayer.classList.remove('active');
        if (this.cardMultispectral) this.cardMultispectral.classList.add('active');
        this.store.setDroneType('multispectral');
      }
      if (this.droneSelectorModal) {
        this.droneSelectorModal.classList.remove('active');
        this.droneSelectorModal.style.display = 'none';
      }
    };

    if (this.btnDroneSelector) {
      this.btnDroneSelector.addEventListener('click', () => {
        if (this.droneSelectorModal) {
          this.droneSelectorModal.style.display = 'flex';
          this.droneSelectorModal.classList.add('active');
        }
      });
    }

    if (this.btnSprayPump) {
      this.btnSprayPump.addEventListener('click', () => {
        this.store.toggleSprayPump();
      });
    }

    if (this.selectFlowRate) {
      this.selectFlowRate.addEventListener('change', (e) => {
        this.store.setFlowRate(e.target.value);
      });
    }

    if (this.btnRefillTank) {
      this.btnRefillTank.addEventListener('click', () => {
        this.store.refillTank();
      });
    }

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

    if (this.btnRandomizeZones) {
      this.btnRandomizeZones.addEventListener('click', () => {
        this.randomizeOrchardZones();
      });
    }

    if (this.btnOpenGis) {
      this.btnOpenGis.addEventListener('click', () => {
        this.openAcquisitionReportModal();
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

    if (this.pipChannelBar) {
      const chBtns = this.pipChannelBar.querySelectorAll('.pip-ch-btn');
      chBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          chBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.pipMode = btn.getAttribute('data-pip-mode') || 'ndvi';
          if (this.pipMinimized) {
            this.togglePipMonitor(false);
          } else {
            this.renderPiPNadirFeed(this.store.getDroneState());
          }
        });
      });
    }

    if (this.btnPipMinimize) {
      this.btnPipMinimize.addEventListener('click', () => {
        this.togglePipMonitor();
      });
    }
  }

  initModalListeners() {
    if (this.reportFilterBar) {
      const tabs = this.reportFilterBar.querySelectorAll('.report-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const filter = tab.getAttribute('data-report-filter');
          this.currentReportFilter = filter;
          this.renderReportPreview(filter);
        });
      });
    }

    // Layer Tree Checkboxes
    const layerCheckboxes = [
      this.chkLayerPolygons,
      this.chkLayerLabels,
      this.chkLayerVraGrid,
      this.chkLayerRoute,
      this.chkLayerTrees,
      this.chkLayerUtm
    ];
    layerCheckboxes.forEach((chk) => {
      if (chk) {
        chk.addEventListener('change', () => {
          this.renderReportPreview(this.currentReportFilter);
        });
      }
    });

    // Interactive GIS Canvas Mouse Hover (UTM Coordinates + Pixel Inspector) & Polygon Click Selection
    if (this.reportCanvas) {
      this.reportCanvas.addEventListener('mousemove', (e) => {
        if (!this.field) return;
        const rect = this.reportCanvas.getBoundingClientRect();
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const worldX = (normX - 0.5) * 200;
        const worldZ = (normY - 0.5) * 200;

        const geo = this.field.localToGeo(worldX, worldZ);
        const cell = this.field.getGroundDataAt(worldX, worldZ);
        const vra = this.field.getVraAt(worldX, worldZ);

        if (this.gisStatusUtm) {
          this.gisStatusUtm.innerText = `${geo.utmE.toFixed(1)} E, ${geo.utmN.toFixed(1)} N (${geo.lat.toFixed(5)}°S, ${geo.lon.toFixed(5)}°W)`;
        }
        if (this.gisStatusPixel) {
          const chmStr = (cell.canopyHeightM ?? 0).toFixed(1);
          this.gisStatusPixel.innerText = `NDVI: ${cell.ndvi.toFixed(2)} | Temp: ${cell.temperatureC.toFixed(1)}°C | CHM: ${chmStr}m | VRA: ${vra.doseLHa} L/ha`;
        }
      });

      this.reportCanvas.addEventListener('click', (e) => {
        if (!this.field) return;
        const rect = this.reportCanvas.getBoundingClientRect();
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const worldX = (normX - 0.5) * 200;
        const worldZ = (normY - 0.5) * 200;

        const gis = this.field.getGISPrescriptionData();
        let clickedFid = null;
        for (const f of gis.features) {
          const dx = worldX - f.x;
          const dz = worldZ - f.z;
          if (Math.sqrt(dx * dx + dz * dz) <= f.radius) {
            clickedFid = f.fid;
            break;
          }
        }
        this.selectedGisFid = clickedFid;
        this.renderReportPreview(this.currentReportFilter);
      });
    }

    const closeHandler = () => {
      if (this.modalOverlay) {
        this.modalOverlay.classList.remove('active');
      }
    };

    if (this.btnCloseReport) this.btnCloseReport.addEventListener('click', closeHandler);
    if (this.btnCloseReportX) this.btnCloseReportX.addEventListener('click', closeHandler);

    // Export Real GeoJSON File (RFC 7946)
    if (this.btnExportGeojson) {
      this.btnExportGeojson.addEventListener('click', () => {
        if (!this.field || typeof this.field.generateGeoJSONString !== 'function') return;
        const geojsonStr = this.field.generateGeoJSONString();
        this.triggerFileDownload(
          geojsonStr,
          'CEAF_Prescripcion_VRA_Rengo_EPSG4326.geojson',
          'application/geo+json;charset=utf-8'
        );
      });
    }

    // Export Real CSV Attribute Table
    if (this.btnExportCsv) {
      this.btnExportCsv.addEventListener('click', () => {
        if (!this.field || typeof this.field.generateCSVString !== 'function') return;
        const csvStr = this.field.generateCSVString();
        this.triggerFileDownload(
          csvStr,
          'CEAF_Tabla_Atributos_QGIS_Rengo.csv',
          'text/csv;charset=utf-8'
        );
      });
    }

    // Transfer VRA Prescription to Agricultural Sprayer Drone & Launch Autonomous Spot-Spraying Flight
    if (this.btnTransferVraDrone) {
      this.btnTransferVraDrone.addEventListener('click', () => {
        closeHandler();
        if (typeof window.selectDrone === 'function') {
          window.selectDrone('sprayer');
        } else {
          this.store.setDroneType('sprayer');
        }
        if (this.store.getTankLevelLiters() < 5.0) {
          this.store.refillTank();
        }
        if (this.flightModel) {
          this.flightModel.startGridMission();
        }
      });
    }
  }

  triggerFileDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  openAcquisitionReportModal() {
    if (!this.modalOverlay || !this.reportCanvas) return;
    this.modalOverlay.classList.add('active');
    this.renderReportPreview(this.currentReportFilter);
  }

  renderGISAttributeTable(gisData) {
    if (!this.gisAttributeTbody || !gisData) return;

    if (this.gisConvVolume) {
      this.gisConvVolume.innerText = `${gisData.conventionalVolumeL.toFixed(1)} L`;
    }
    if (this.gisVraVolume) {
      this.gisVraVolume.innerText = `${gisData.vraTotalVolumeL.toFixed(1)} L`;
    }
    if (this.gisVraArea) {
      this.gisVraArea.innerText = `En ${gisData.vraPrescribedAreaHa.toFixed(2)} ha (${gisData.vraPrescribedAreaM2} m²)`;
    }
    if (this.gisVraSavings) {
      this.gisVraSavings.innerText = `${gisData.chemicalSavingsPct.toFixed(1)}% AHORRO`;
    }
    if (this.gisVraSavedLiters) {
      this.gisVraSavedLiters.innerText = `${gisData.waterSavedL.toFixed(1)} L ahorrados`;
    }
    if (this.gisFeatureCount) {
      this.gisFeatureCount.innerText = `${gisData.features.length} polígonos`;
    }

    this.gisAttributeTbody.innerHTML = '';
    gisData.features.forEach((f) => {
      const tr = document.createElement('tr');
      if (this.selectedGisFid === f.fid) {
        tr.classList.add('selected-feature');
      }

      const doseColor = f.doseLHa >= 120 ? '#f87171' : (f.doseLHa > 0 ? '#fbbf24' : '#4ade80');
      const ndviColor = f.currentNDVI < 0.40 ? '#f87171' : (f.currentNDVI < 0.65 ? '#fbbf24' : '#4ade80');
      const chmVal = f.canopyHeightM !== undefined ? f.canopyHeightM : 3.8;
      const trvVal = f.trvM3Ha !== undefined ? f.trvM3Ha : 12400;
      const chmColor = chmVal < 3.4 ? '#fbbf24' : (chmVal >= 4.7 ? '#c084fc' : '#34d399');

      tr.innerHTML = `
        <td>${f.fid}</td>
        <td><strong>${f.code}</strong></td>
        <td><span class="badge ${f.priorityBadge}">${f.name}</span></td>
        <td>${Math.round(f.utmE)}E / ${Math.round(f.utmN)}N</td>
        <td>${f.areaM2} m² (${f.areaHa.toFixed(2)} ha)</td>
        <td style="color:${ndviColor};font-weight:700;">${f.currentNDVI.toFixed(2)}</td>
        <td>${f.tempC.toFixed(1)}°C</td>
        <td style="color:${chmColor};font-weight:600;">${chmVal.toFixed(1)}m <span style="opacity:0.75;font-size:0.70rem;">(${(trvVal / 1000).toFixed(1)}k m³)</span></td>
        <td style="color:${doseColor};font-weight:700;">${f.doseLHa} L/ha</td>
        <td>${f.volumeL.toFixed(1)} L</td>
        <td>${f.type === 'stressed' ? `${f.recoveryPct}%` : 'Óptimo'}</td>
      `;

      tr.addEventListener('click', () => {
        this.selectedGisFid = f.fid;
        if (this.gisStatusUtm) {
          this.gisStatusUtm.innerText = `${f.utmE.toFixed(1)} E, ${f.utmN.toFixed(1)} N (${f.lat.toFixed(5)}°S, ${f.lon.toFixed(5)}°W)`;
        }
        if (this.gisStatusPixel) {
          this.gisStatusPixel.innerText = `[Polígono ${f.code}] NDVI: ${f.currentNDVI.toFixed(2)} | Temp: ${f.tempC.toFixed(1)}°C | CHM: ${chmVal.toFixed(1)}m (${trvVal} m³/ha) | VRA: ${f.doseLHa} L/ha`;
        }
        this.renderReportPreview(this.currentReportFilter);
      });

      this.gisAttributeTbody.appendChild(tr);
    });
  }

  renderReportPreview(filterMode) {
    if (!this.reportCanvas) return;
    const ctx = this.reportCanvas.getContext('2d');
    const w = this.reportCanvas.width;
    const h = this.reportCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const gisData = (this.field && typeof this.field.getGISPrescriptionData === 'function')
      ? this.field.getGISPrescriptionData()
      : null;

    if (gisData) {
      this.renderGISAttributeTable(gisData);
    }

    // Update Summary Badges dynamically from FieldGenerator
    if (this.field && typeof this.field.getFieldSummary === 'function') {
      const summary = this.field.getFieldSummary();
      const recPct = Math.round(summary.stressRecoveryPct || 0);

      if (this.reportBadgeNdvi) {
        const ndviState = summary.avgNDVI >= 0.72 ? 'Saludable' : 'Con Estrés';
        this.reportBadgeNdvi.innerText = `${summary.avgNDVI.toFixed(2)} (${ndviState})`;
        this.reportBadgeNdvi.className = `badge-value ${summary.avgNDVI >= 0.72 ? 'green' : 'amber'}`;
      }
      if (this.reportBadgeTemp) {
        this.reportBadgeTemp.innerText = `${summary.avgSoilTempC.toFixed(1)}°C / ${summary.avgCanopyTempC.toFixed(1)}°C`;
      }
      if (this.reportBadgeDiag) {
        if (recPct >= 70) {
          this.reportBadgeDiag.innerText = `Mitigado (${recPct}% Recuperado)`;
          this.reportBadgeDiag.className = 'badge-value green';
        } else if (recPct >= 10) {
          this.reportBadgeDiag.innerText = `En Tratamiento (${recPct}% Mitigado)`;
          this.reportBadgeDiag.className = 'badge-value amber';
        } else if (gisData) {
          this.reportBadgeDiag.innerText = `VRA: ${gisData.vraTotalVolumeL}L (${gisData.chemicalSavingsPct}% Ahorro)`;
          this.reportBadgeDiag.className = 'badge-value red';
        }
      }
    }

    const descriptions = {
      rgb: 'ORTOMOSAICO FOTOGRAMÉTRICO RGB (GSD 2.1 cm/px): Muestra la reflectancia visible del predio CEAF Rengo y la humedad superficial en las fajas intervenidas.',
      thermal: 'TERMOGRAFÍA INFRARROJA LWIR & ÍNDICE CWSI: Cuantifica la temperatura de canopia frente al suelo para detectar cierre estomático por déficit hídrico antes de que sea visible al ojo humano.',
      ndvi: 'ÍNDICE VEGETACIONAL NDVI ((NIR - RED) / (NIR + RED)): Evalúa la actividad clorofílica y biomasa fotosintética activa en cada hilera del huerto.',
      elevation: 'MODELO DIGITAL DE ALTURA DE DOSEL (CHM) Y VOLUMEN DE COPA (TRV m³/ha) — ESCANEO LIDAR: Cuantifica la estructura 3D de la canopia (DSM − DTM), detectando árboles con crecimiento deprimido por estrés crónico (~2.6 m) frente a copas vigorosas (> 4.8 m) para calibrar el caudal foliar.',
      vra: 'MAPA DE PRESCRIPCIÓN DE DOSIS VARIABLE (VRA): Zonificación agronómica generada en formato GIS que asigna 150 L/ha a focos de estrés severo, 85 L/ha a zonas de transición y 0 L/ha al resto del predio.'
    };

    if (this.reportDescEl) {
      this.reportDescEl.innerText = descriptions[filterMode] || descriptions.vra;
    }

    const showPolygons = !this.chkLayerPolygons || this.chkLayerPolygons.checked;
    const showLabels = !this.chkLayerLabels || this.chkLayerLabels.checked;
    const showVraGrid = !this.chkLayerVraGrid || this.chkLayerVraGrid.checked;
    const showRoute = !this.chkLayerRoute || this.chkLayerRoute.checked;
    const showTrees = !this.chkLayerTrees || this.chkLayerTrees.checked;
    const showUtm = !this.chkLayerUtm || this.chkLayerUtm.checked;

    // 1. Draw Base Raster Layer from FieldGenerator
    if (this.field && this.field.grid && this.field.grid.length > 0) {
      const gridRes = this.field.gridRes;
      const cellW = w / (gridRes + 1);
      const cellH = h / (gridRes + 1);

      for (let r = 0; r <= gridRes; r++) {
        for (let c = 0; c <= gridRes; c++) {
          const cell = this.field.grid[r][c];
          let col = cell.rgbColor;
          if (filterMode === 'thermal') {
            col = cell.thermalColor;
          } else if (filterMode === 'ndvi') {
            col = cell.ndviColor;
          } else if (filterMode === 'elevation') {
            col = cell.elevationColor;
          } else if (filterMode === 'vra') {
            const vraCell = this.field.getVraAt(cell.x, cell.z);
            col = vraCell.color;
          }

          const cr = Math.round(Math.max(0, Math.min(1, col[0])) * 255);
          const cg = Math.round(Math.max(0, Math.min(1, col[1])) * 255);
          const cb = Math.round(Math.max(0, Math.min(1, col[2])) * 255);

          ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
          ctx.fillRect(c * cellW, r * cellH, Math.ceil(cellW), Math.ceil(cellH));
        }
      }
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Draw 10x10m Variable Rate Prescription (VRA) Management Grid Layer
    if (showVraGrid && this.field) {
      const gridCells = 20; // 200m / 10m = 20 cells per axis
      const stepX = w / gridCells;
      const stepY = h / gridCells;

      ctx.lineWidth = 0.75;
      for (let gy = 0; gy < gridCells; gy++) {
        for (let gx = 0; gx < gridCells; gx++) {
          const wx = -100 + (gx + 0.5) * 10;
          const wz = -100 + (gy + 0.5) * 10;
          const vra = this.field.getVraAt(wx, wz);

          if (vra.doseLHa > 0) {
            ctx.fillStyle = vra.doseLHa >= 120
              ? 'rgba(239, 68, 68, 0.24)'
              : 'rgba(245, 158, 11, 0.20)';
            ctx.fillRect(gx * stepX, gy * stepY, stepX, stepY);

            ctx.strokeStyle = vra.doseLHa >= 120
              ? 'rgba(252, 165, 165, 0.55)'
              : 'rgba(253, 211, 77, 0.45)';
            ctx.strokeRect(gx * stepX, gy * stepY, stepX, stepY);

            // Dose text inside 10x10m cell when in VRA mode
            if (filterMode === 'vra') {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
              ctx.font = 'bold 8px JetBrains Mono, monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(`${vra.doseLHa}`, gx * stepX + stepX / 2, gy * stepY + stepY / 2);
            }
          } else if (filterMode === 'vra') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.strokeRect(gx * stepX, gy * stepY, stepX, stepY);
          }
        }
      }
    }

    // 3. Draw Orchard Fruit Tree Cadastre Layer (Catastro_Frutales_Hileras.shp)
    if (showTrees && this.field) {
      const gridRes = this.field.gridRes;
      for (let r = 2; r < gridRes; r += 4) {
        for (let c = 2; c < gridRes; c += 4) {
          const cell = this.field.grid[r][c];
          if (Math.abs(cell.x) < 3.5 || Math.abs(cell.z) < 3.5) continue;

          const px = ((cell.x + 100) / 200) * w;
          const py = ((cell.z + 100) / 200) * h;
          const chm = cell.canopyHeightM || 4.2;
          const radiusPx = filterMode === 'elevation'
            ? Math.max(2.6, Math.min(6.0, (chm / 4.25) * 4.3))
            : 4.2;

          ctx.beginPath();
          ctx.arc(px, py, radiusPx, 0, Math.PI * 2);

          if (filterMode === 'elevation') {
            if (chm < 3.35) {
              ctx.fillStyle = 'rgba(245, 158, 11, 0.88)';
              ctx.strokeStyle = '#78350f';
            } else if (chm >= 4.65) {
              ctx.fillStyle = 'rgba(192, 132, 252, 0.92)';
              ctx.strokeStyle = '#581c87';
            } else {
              ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
              ctx.strokeStyle = '#064e3b';
            }
          } else if (cell.ndvi < 0.42) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
            ctx.strokeStyle = '#7f1d1d';
          } else if (cell.ndvi < 0.64) {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
            ctx.strokeStyle = '#78350f';
          } else if (cell.ndvi >= 0.85) {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.90)';
            ctx.strokeStyle = '#064e3b';
          } else {
            ctx.fillStyle = 'rgba(34, 197, 94, 0.78)';
            ctx.strokeStyle = '#14532d';
          }
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // 4. Draw UTM 19S Coordinate Reticle (EPSG:32719 - 50m intervals)
    if (showUtm) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      const offsets = [-100, -50, 0, 50, 100];
      offsets.forEach((m) => {
        const px = ((m + 100) / 200) * w;
        const py = ((m + 100) / 200) * h;

        // Vertical Easting Line
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();

        // Horizontal Northing Line
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
        ctx.stroke();

        if (m > -100 && m < 100) {
          const geo = this.field ? this.field.localToGeo(m, m) : { utmE: 334800 + m, utmN: 6192400 - m };
          ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
          ctx.font = '600 9px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(geo.utmE)}E`, px, h - 6);

          ctx.textAlign = 'left';
          ctx.fillText(`${Math.round(geo.utmN)}N`, 6, py - 4);
        }
      });
      ctx.setLineDash([]);
    }

    // 5. Draw GNSS RTK Flight Trajectory & Waypoints (.gpx)
    if (showRoute && gisData && gisData.features.length > 0) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.88)';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([7, 4]);
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);

      gisData.features.forEach((f) => {
        const cx = ((f.x + 100) / 200) * w;
        const cy = ((f.z + 100) / 200) * h;
        ctx.lineTo(cx, cy);
      });
      ctx.lineTo(w / 2, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Waypoint Nodes
      gisData.features.forEach((f, idx) => {
        const cx = ((f.x + 100) / 200) * w;
        const cy = ((f.z + 100) / 200) * h;
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#bae6fd';
        ctx.font = 'bold 8px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`WP${idx + 1}`, cx, cy - 8);
      });
    }

    // 6. Draw Vector Anomaly Polygons (Poligonos_Anomalias.geojson)
    if (showPolygons && gisData && gisData.features.length > 0) {
      gisData.features.forEach((f) => {
        const cx = ((f.x + 100) / 200) * w;
        const cy = ((f.z + 100) / 200) * h;
        const rx = (f.radius / 200) * w;
        const ry = (f.radius / 200) * h;
        const isSelected = this.selectedGisFid === f.fid;

        // Draw 24-vertex GIS Polygon Ring
        const vertices = 24;
        ctx.beginPath();
        for (let i = 0; i <= vertices; i++) {
          const ang = (i / vertices) * Math.PI * 2;
          const vx = cx + Math.cos(ang) * rx;
          const vy = cy + Math.sin(ang) * ry;
          if (i === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();

        if (isSelected) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
          ctx.fill();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 3.2;
          ctx.stroke();
        } else if (f.type === 'stressed') {
          ctx.fillStyle = f.doseLHa > 0 ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)';
          ctx.fill();
          ctx.strokeStyle = f.doseLHa > 0 ? 'rgba(248, 113, 113, 0.95)' : 'rgba(52, 211, 153, 0.95)';
          ctx.lineWidth = 2.2;
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.92)';
          ctx.lineWidth = 2.0;
          ctx.stroke();
        }
      });
    }

    // 7. Draw Polygon Callout Labels (ID, NDVI / CHM & Prescribed VRA Dose)
    if (showLabels && gisData && gisData.features.length > 0) {
      gisData.features.forEach((f) => {
        const cx = ((f.x + 100) / 200) * w;
        const cy = ((f.z + 100) / 200) * h;
        const ry = (f.radius / 200) * h;

        const chmVal = f.canopyHeightM !== undefined ? f.canopyHeightM : 3.8;
        const trvVal = f.trvM3Ha !== undefined ? f.trvM3Ha : 12400;
        const labelText = filterMode === 'elevation'
          ? `${f.code} | CHM ${chmVal.toFixed(1)}m | ${(trvVal / 1000).toFixed(1)}k m³/ha`
          : `${f.code} | NDVI ${f.currentNDVI.toFixed(2)} | ${f.doseLHa} L/ha`;
        ctx.font = 'bold 9.5px JetBrains Mono, monospace';
        const textWidth = ctx.measureText(labelText).width;
        const boxW = textWidth + 10;
        const boxH = 16;
        const bx = Math.max(4, Math.min(w - boxW - 4, cx - boxW / 2));
        const by = Math.max(4, Math.min(h - boxH - 4, cy + ry + 4));

        ctx.fillStyle = 'rgba(9, 14, 23, 0.88)';
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.strokeStyle = this.selectedGisFid === f.fid
          ? '#facc15'
          : (f.type === 'stressed' ? '#f87171' : '#34d399');
        ctx.lineWidth = 1.2;
        ctx.strokeRect(bx, by, boxW, boxH);

        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, bx + boxW / 2, by + boxH / 2);
      });
    }

    // 8. Draw Central Helipad (Base RTK) & Cartographic North Arrow + Scale Bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(w / 2 - 14, h / 2 - 14, 28, 28);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(w / 2 - 14, h / 2 - 14, 28, 28);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', w / 2, h / 2);

    // North Arrow (Top-Right Corner)
    const nx = w - 28;
    const ny = 28;
    ctx.fillStyle = 'rgba(9, 14, 23, 0.82)';
    ctx.beginPath();
    ctx.arc(nx, ny, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(nx, ny - 11);
    ctx.lineTo(nx - 5, ny + 6);
    ctx.lineTo(nx, ny + 2);
    ctx.lineTo(nx + 5, ny + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('N', nx, ny - 13);

    // Metric Scale Bar (Bottom-Right Corner: 50m = 0.25 * w)
    const barW = (50 / 200) * w;
    const sx = w - barW - 14;
    const sy = h - 22;
    ctx.fillStyle = 'rgba(9, 14, 23, 0.85)';
    ctx.fillRect(sx - 6, sy - 12, barW + 12, 20);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 3);
    ctx.lineTo(sx, sy + 2);
    ctx.lineTo(sx + barW, sy + 2);
    ctx.lineTo(sx + barW, sy - 3);
    ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('50 m', sx + barW / 2, sy - 4);
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

  updateDroneTypeUI(droneType) {
    if (this.droneSelectorText) {
      this.droneSelectorText.innerText = droneType === 'sprayer' ? 'Dron: Aspersión' : 'Dron: Multiespectral';
    }

    // Keep spectral visualization bar active for both drones so pilot can locate stress zones while spraying
    if (this.spectralBarEl) {
      this.spectralBarEl.style.display = 'flex';
    }

    if (droneType === 'sprayer') {
      if (this.sensorHudPanel) this.sensorHudPanel.classList.add('hidden');
      if (this.sprayerHudPanel) this.sprayerHudPanel.classList.remove('hidden');
    } else {
      if (this.sensorHudPanel) this.sensorHudPanel.classList.remove('hidden');
      if (this.sprayerHudPanel) this.sprayerHudPanel.classList.add('hidden');
    }
    this.updateGamepadUI(this.store.getGamepadState());
  }

  updateSprayPumpUI(state) {
    if (!this.btnSprayPump || !this.sprayPumpText) return;
    if (state === 'on') {
      this.btnSprayPump.classList.add('active');
      this.sprayPumpText.innerText = 'Bomba Aspersión: ACTIVADA';
    } else {
      this.btnSprayPump.classList.remove('active');
      this.sprayPumpText.innerText = 'Bomba Aspersión: OFF';
    }
  }

  updateTankUI(data) {
    if (this.hudTankValue) {
      this.hudTankValue.innerHTML = `${data.tankLevelL.toFixed(1)} <span class="unit">L (${Math.round(data.pct)}%)</span>`;
    }
    if (this.hudTankBar) {
      this.hudTankBar.style.width = `${Math.max(0, Math.min(100, data.pct))}%`;
    }
    if (this.hudLiquidSprayed && data.totalSprayedL !== undefined) {
      this.hudLiquidSprayed.innerText = `${data.totalSprayedL.toFixed(1)} L`;
    }
    if (this.hudAreaCovered && data.areaCoveredM2 !== undefined) {
      this.hudAreaCovered.innerText = `${Math.round(data.areaCoveredM2)} m²`;
    }
    if (this.hudStressRecovery && data.stressRecoveryPct !== undefined) {
      this.hudStressRecovery.innerText = `${Math.round(data.stressRecoveryPct)}%`;
    }
  }

  updatePillsUI(mode) {
    if (this.spectralBarEl) {
      const pills = this.spectralBarEl.querySelectorAll('.spectral-pill');
      pills.forEach(pill => {
        if (pill.getAttribute('data-mode') === mode) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      });
    }
    if (this.sensorTitleEl) {
      const titles = {
        rgb: 'SENSOR ACTIVO (COLOR NATURAL RGB)',
        ndvi: 'SENSOR ACTIVO (ÍNDICE DE VIGOR NDVI)',
        thermal: 'SENSOR ACTIVO (INFRARROJO TÉRMICO IR)',
        elevation: 'SENSOR ACTIVO (ESCANEO LIDAR CHM / TRV)'
      };
      this.sensorTitleEl.innerText = titles[mode] || 'SENSOR ACTIVO';
    }
    // Sync PiP Nadir Camera channel when switching top-bar sensor mode
    if (this.pipChannelBar && ['rgb', 'ndvi', 'thermal', 'elevation'].includes(mode)) {
      this.pipMode = mode;
      const chBtns = this.pipChannelBar.querySelectorAll('.pip-ch-btn');
      chBtns.forEach(b => {
        if (b.getAttribute('data-pip-mode') === mode) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
      this.renderPiPNadirFeed(this.store.getDroneState());
    }
  }

  updateGamepadUI(gpState) {
    if (!this.gamepadStatusPill) return;

    const droneType = this.store.getDroneType();

    if (gpState && gpState.connected) {
      this.gamepadStatusPill.style.display = 'flex';
      const isXbox = gpState.id.toLowerCase().includes('xbox') || gpState.id.toLowerCase().includes('x-input') || gpState.id.includes('045e');
      if (this.gamepadStatusText) {
        this.gamepadStatusText.innerText = isXbox ? 'XBOX ONE' : 'GAMEPAD ACTIVO';
      }
      if (this.gamepadGuideRows) {
        this.gamepadGuideRows.style.display = 'flex';
        if (droneType === 'sprayer') {
          this.gamepadGuideRows.innerHTML = `
            <div class="key-row">🎮 <strong>Stick Izq:</strong> Altitud / Giro | <strong>Stick Der:</strong> Cabeceo / Alabeo | <strong>RT / LT:</strong> Acelerar / Frenar</div>
            <div class="key-row"><kbd>A</kbd> Motores | <kbd>X</kbd> Aspersión | <kbd>B</kbd> RTH | <kbd>Y</kbd> Cámara | <kbd>LB</kbd> Dron | <kbd>D-Pad ↑↓</kbd> Caudal | <kbd>D-Pad →</kbd> Recargar Tanque</div>
          `;
        } else {
          this.gamepadGuideRows.innerHTML = `
            <div class="key-row">🎮 <strong>Stick Izq:</strong> Altitud / Giro | <strong>Stick Der:</strong> Cabeceo / Alabeo | <strong>RT / LT:</strong> Acelerar / Frenar</div>
            <div class="key-row"><kbd>A</kbd> Motores | <kbd>B</kbd> RTH | <kbd>Y</kbd> Cámara | <kbd>RB</kbd> Cuadrícula | <kbd>LB</kbd> Dron | <kbd>D-Pad</kbd> Sensores (RGB/NDVI/Térmico/LiDAR)</div>
          `;
        }
      }
      if (this.keyboardGuideRows) this.keyboardGuideRows.style.display = 'none';
      if (this.guideTitle) this.guideTitle.innerText = droneType === 'sprayer' ? 'CONTROLES (XBOX - DRON DE ASPERSIÓN)' : 'CONTROLES (XBOX - DRON MULTIESPECTRAL)';
    } else {
      this.gamepadStatusPill.style.display = 'none';
      if (this.gamepadGuideRows) this.gamepadGuideRows.style.display = 'none';
      if (this.keyboardGuideRows) this.keyboardGuideRows.style.display = 'flex';
      if (this.guideTitle) this.guideTitle.innerText = 'CONTROLES (TECLADO / PANTALLA TÁCTIL)';
    }
  }

  initSubscriptions() {
    this.store.on('gamepadChange', (gpState) => {
      this.updateGamepadUI(gpState);
    });

    this.store.on('toggleDashboard', () => {
      const toggleBtn = document.getElementById('toggle-dashboard-btn');
      if (toggleBtn) toggleBtn.click();
    });

    this.store.on('droneTypeChange', (droneType) => {
      this.updateDroneTypeUI(droneType);
    });

    this.store.on('sprayPumpChange', (state) => {
      this.updateSprayPumpUI(state);
    });

    this.store.on('tankUpdate', (data) => {
      this.updateTankUI(data);
    });

    this.store.on('missionCompleted', () => {
      this.openAcquisitionReportModal();
    });

    this._lastHudTickMs = 0;
    this._lastPipX = NaN;
    this._lastPipY = NaN;
    this._lastPipZ = NaN;
    this._lastPipRoll = NaN;
    this._lastPipMode = null;

    this.store.on('droneUpdate', (droneState) => {
      const now = performance.now();
      if (now - this._lastHudTickMs < 45) return;
      this._lastHudTickMs = now;

      const altStr = `${droneState.altitudeM.toFixed(1)}<span class="unit">m</span>`;
      if (this.altEl && this._lastAltStr !== altStr) {
        this._lastAltStr = altStr;
        this.altEl.innerHTML = altStr;
      }

      const speedStr = `${droneState.speedMs.toFixed(1)}<span class="unit">m/s</span>`;
      if (this.speedEl && this._lastSpeedStr !== speedStr) {
        this._lastSpeedStr = speedStr;
        this.speedEl.innerHTML = speedStr;
      }

      const headingStr = `${String(droneState.headingDeg).padStart(3, '0')}<span class="unit">°</span>`;
      if (this.headingEl && this._lastHeadingStr !== headingStr) {
        this._lastHeadingStr = headingStr;
        this.headingEl.innerHTML = headingStr;
      }

      const px = droneState.position[0];
      const pz = droneState.position[2];
      const py = droneState.position[1];

      const fpsStr = this.store.currentFps ? ` | ${this.store.currentFps} FPS` : '';
      const posStr = `X: ${px.toFixed(1)} | Z: ${pz.toFixed(1)}${fpsStr}`;
      if (this.posEl && this._lastPosStr !== posStr) {
        this._lastPosStr = posStr;
        this.posEl.innerText = posStr;
      }

      const distToHome = Math.sqrt(px * px + pz * pz);
      const estRthPct = (distToHome * 0.08 + py * 0.12 + 1.2).toFixed(1);
      const estMissionPct = '18.5';

      if (this.estRthEl && this._lastRthStr !== estRthPct) {
        this._lastRthStr = estRthPct;
        this.estRthEl.innerText = `~${estRthPct}%`;
      }
      if (this.estMissionEl && this._lastMissionStr !== estMissionPct) {
        this._lastMissionStr = estMissionPct;
        this.estMissionEl.innerText = `~${estMissionPct}%`;
      }

      const roll = droneState.rotation?.[2] ?? 0;
      if (
        Math.abs(px - this._lastPipX) > 0.04 ||
        Math.abs(py - this._lastPipY) > 0.04 ||
        Math.abs(pz - this._lastPipZ) > 0.04 ||
        Math.abs(roll - this._lastPipRoll) > 0.008 ||
        this._lastPipMode !== this.pipMode
      ) {
        this._lastPipX = px;
        this._lastPipY = py;
        this._lastPipZ = pz;
        this._lastPipRoll = roll;
        this._lastPipMode = this.pipMode;
        this.renderPiPNadirFeed(droneState);
      }
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
        auto_grid: 'AUTÓNOMO (ZONAS)',
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
        this.missionProgressEl.innerText = `${mission.progressPct}% (Zona ${mission.waypointIndex}/${mission.totalWaypoints})`;
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
          const chm = reading.canopyHeightM !== undefined ? reading.canopyHeightM : (reading.elevationM || 0);
          pct = Math.max(0, Math.min(100, (chm / 5.5) * 100));
        }
        this.ndviBarEl.style.width = `${pct}%`;
        this.ndviBarEl.style.backgroundColor = reading.color;
        this.ndviBarEl.style.background = reading.color;
      }
    });
  }

  togglePipMonitor(forceState) {
    if (!this.pipCameraPanel) return;
    if (typeof forceState === 'boolean') {
      this.pipMinimized = forceState;
    } else {
      this.pipMinimized = !this.pipMinimized;
    }
    if (this.pipMinimized) {
      this.pipCameraPanel.classList.add('minimized');
      if (this.btnPipMinimize) this.btnPipMinimize.innerText = '+';
    } else {
      this.pipCameraPanel.classList.remove('minimized');
      if (this.btnPipMinimize) this.btnPipMinimize.innerText = '_';
      this.renderPiPNadirFeed(this.store.getDroneState());
    }
  }

  /**
   * Real-time 60 FPS Picture-in-Picture Nadir Camera (-90° Cenital) Sensor Renderer
   * Simulates MicaSense RedEdge-P / Zenmuse H20T / Zenmuse L2 LiDAR nadir view directly beneath the aircraft
   */
  renderPiPNadirFeed(droneState) {
    if (!this.pipNadirCanvas || !this.field || this.pipMinimized) return;
    const ctx = this.pipNadirCanvas.getContext('2d');
    if (!ctx) return;

    const W = this.pipNadirCanvas.width;
    const H = this.pipNadirCanvas.height;
    const px = droneState?.position?.[0] ?? 0;
    const py = droneState?.position?.[1] ?? 0.35;
    const pz = droneState?.position?.[2] ?? 0;
    const rollRad = droneState?.rotation?.[2] ?? 0;
    const agl = Math.max(0.4, droneState?.altitudeM ?? py);

    const mode = this.pipMode || 'ndvi';

    // 1. Update live center-pixel telemetry strip
    const centerSpec = this.field.calculateSpectralAt(px, 0, pz);
    const centerVra = this.field.getVraAt ? this.field.getVraAt(px, pz) : { rateLHa: 60, colorHex: '#38bdf8' };

    const cTemp = centerSpec.temperatureC ?? centerSpec.temperature ?? 22.0;
    const cChm = centerSpec.canopyHeightM ?? 0;
    const cTrv = centerSpec.trvM3Ha ?? 0;

    if (this.pipReadoutNdvi) {
      this.pipReadoutNdvi.innerText = `NDVI ${(centerSpec.ndvi ?? 0.75).toFixed(2)}`;
      this.pipReadoutNdvi.style.color = (centerSpec.ndvi ?? 0.75) < 0.45 ? '#f87171' : (centerSpec.ndvi ?? 0.75) < 0.65 ? '#facc15' : '#4ade80';
    }
    if (this.pipReadoutTemp) {
      if (mode === 'elevation') {
        this.pipReadoutTemp.innerText = cChm > 0.2 ? `CHM ${cChm.toFixed(1)}m (${(cTrv / 1000).toFixed(1)}k m³)` : 'Suelo 0.0m';
        this.pipReadoutTemp.style.color = '#c084fc';
      } else {
        this.pipReadoutTemp.innerText = `${cTemp.toFixed(1)}°C`;
        this.pipReadoutTemp.style.color = cTemp > 28.0 ? '#fb923c' : '#38bdf8';
      }
    }
    if (this.pipReadoutVra) {
      this.pipReadoutVra.innerText = `${centerVra.rateLHa} L/ha`;
      this.pipReadoutVra.style.color = centerVra.colorHex || '#fbbf24';
    }

    // 2. Compute Nadir Camera Ground Footprint (FOV scales with altitude)
    const fovW = Math.max(12.0, Math.min(68.0, agl * 1.25 + 9.5));
    const fovH = fovW * (H / W);
    const halfW = fovW * 0.5;
    const halfH = fovH * 0.5;
    const pxPerMeter = W / fovW;
    const gsdCm = ((fovW * 100) / 1280).toFixed(1);

    // 3. Render Radiometric Ground Grid within Nadir Footprint
    const cols = 29;
    const rows = 19;
    const cellW = W / cols;
    const cellH = H / rows;

    let maxTemp = -Infinity;
    let maxTempPos = null;
    let minTemp = Infinity;
    let minTempPos = null;

    for (let r = 0; r < rows; r++) {
      const wz = pz + halfH - ((r + 0.5) / rows) * fovH;
      for (let c = 0; c < cols; c++) {
        const wx = px - halfW + ((c + 0.5) / cols) * fovW;

        if (Math.abs(wx) > 100 || Math.abs(wz) > 100) {
          ctx.fillStyle = mode === 'thermal' ? '#120824' : '#0f172a';
          ctx.fillRect(c * cellW, r * cellH, cellW + 0.6, cellH + 0.6);
          continue;
        }

        const spec = this.field.calculateSpectralAt(wx, 0, wz);
        const cellTemp = spec.temperatureC ?? spec.temperature ?? 22.0;

        if (cellTemp > maxTemp) {
          maxTemp = cellTemp;
          maxTempPos = { sx: (c + 0.5) * cellW, sy: (r + 0.5) * cellH };
        }
        if (cellTemp < minTemp) {
          minTemp = cellTemp;
          minTempPos = { sx: (c + 0.5) * cellW, sy: (r + 0.5) * cellH };
        }

        if (mode === 'ndvi') {
          const [cr, cg, cb] = spec.ndviColor;
          ctx.fillStyle = `rgb(${Math.round(cr * 235)}, ${Math.round(cg * 235)}, ${Math.round(cb * 235)})`;
        } else if (mode === 'thermal') {
          const [cr, cg, cb] = spec.thermalColor;
          ctx.fillStyle = `rgb(${Math.round(cr * 245)}, ${Math.round(cg * 245)}, ${Math.round(cb * 245)})`;
        } else if (mode === 'elevation') {
          const [cr, cg, cb] = spec.elevationColor;
          ctx.fillStyle = `rgb(${Math.round(cr * 225)}, ${Math.round(cg * 225)}, ${Math.round(cb * 225)})`;
        } else if (mode === 'vra') {
          const vra = this.field.getVraAt(wx, wz);
          const [cr, cg, cb] = vra.colorRGB;
          ctx.fillStyle = `rgb(${Math.round(cr * 230)}, ${Math.round(cg * 230)}, ${Math.round(cb * 230)})`;
        } else {
          // RGB Optical Soil + Mulch Strips
          const distToRow = Math.abs(((wz % 10) + 10) % 10 - 5);
          const isMulch = distToRow > 3.7;
          const tint = spec.rgbVertexTint || [1, 1, 1];
          const baseR = isMulch ? 82 : 138;
          const baseG = isMulch ? 92 : 112;
          const baseB = isMulch ? 62 : 84;
          ctx.fillStyle = `rgb(${Math.min(255, Math.round(baseR * tint[0]))}, ${Math.min(255, Math.round(baseG * tint[1]))}, ${Math.min(255, Math.round(baseB * tint[2]))})`;
        }

        ctx.fillRect(c * cellW, r * cellH, cellW + 0.6, cellH + 0.6);
      }
    }

    // 4. Draw Orchard Inter-Row Furrows & Trees inside Nadir Footprint
    const minRowIdx = Math.max(2, Math.floor(((pz - halfH - 4) + 100) / 2.5));
    const maxRowIdx = Math.min(78, Math.ceil(((pz + halfH + 4) + 100) / 2.5));
    const minColIdx = Math.max(2, Math.floor(((px - halfW - 4) + 100) / 2.5));
    const maxColIdx = Math.min(78, Math.ceil(((px + halfW + 4) + 100) / 2.5));

    const baseTreeRadiusPx = Math.max(3.5, Math.min(24.0, 1.85 * pxPerMeter));
    const nowSec = performance.now() * 0.001;

    for (let r = 2; r < 80; r += 4) {
      if (r < minRowIdx - 4 || r > maxRowIdx + 4) continue;
      const tz = -100 + r * 2.5;
      if (tz < pz - halfH - 3 || tz > pz + halfH + 3) continue;

      for (let c = 2; c < 80; c += 4) {
        if (c < minColIdx - 4 || c > maxColIdx + 4) continue;
        const tx = -100 + c * 2.5;
        if (Math.abs(tx) < 3.5 || Math.abs(tz) < 3.5) continue;
        if (tx < px - halfW - 3 || tx > px + halfW + 3) continue;

        // Subtle wind sway in nadir view
        const swayX = Math.sin(nowSec * 1.5 + tx * 0.08 + tz * 0.05) * 0.12;
        const swayZ = Math.cos(nowSec * 1.2 + tx * 0.05 + tz * 0.07) * 0.12;

        const sx = ((tx + swayX - (px - halfW)) / fovW) * W;
        const sy = (((pz + halfH) - (tz + swayZ)) / fovH) * H;

        const tSpec = this.field.calculateSpectralAt(tx, 0, tz);
        const treeChm = tSpec.canopyHeightM || 4.25;
        const crownWidthRatio = Math.max(0.62, Math.min(1.20, 0.28 + 0.72 * (treeChm / 4.25)));
        const treeRadiusPx = baseTreeRadiusPx * crownWidthRatio;

        // Canopy ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.arc(sx + 2.0, sy + 2.0, treeRadiusPx, 0, Math.PI * 2);
        ctx.fill();

        // Canopy crown signature
        if (mode === 'rgb') {
          if (tSpec.ndvi < 0.46) {
            ctx.fillStyle = '#b47b38'; // Chlorotic stressed tree canopy
          } else if (tSpec.ndvi < 0.64) {
            ctx.fillStyle = '#658a3b';
          } else {
            ctx.fillStyle = '#2e6f30';
          }
        } else if (mode === 'ndvi') {
          const [cr, cg, cb] = tSpec.ndviColor;
          ctx.fillStyle = `rgb(${Math.min(255, Math.round(cr * 255))}, ${Math.min(255, Math.round(cg * 255))}, ${Math.min(255, Math.round(cb * 255))})`;
        } else if (mode === 'thermal') {
          const [cr, cg, cb] = tSpec.thermalColor;
          ctx.fillStyle = `rgb(${Math.min(255, Math.round(cr * 255))}, ${Math.min(255, Math.round(cg * 255))}, ${Math.min(255, Math.round(cb * 255))})`;
        } else if (mode === 'elevation') {
          const [cr, cg, cb] = tSpec.elevationColor;
          ctx.fillStyle = `rgb(${Math.min(255, Math.round(cr * 255))}, ${Math.min(255, Math.round(cg * 255))}, ${Math.min(255, Math.round(cb * 255))})`;
        } else {
          const vra = this.field.getVraAt(tx, tz);
          ctx.fillStyle = vra.colorHex;
        }

        ctx.beginPath();
        ctx.arc(sx, sy, treeRadiusPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = mode === 'elevation' ? 'rgba(216, 180, 254, 0.7)' : 'rgba(15, 23, 42, 0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Airborne LiDAR discrete laser return dots over tree crown
        if (mode === 'elevation' && treeRadiusPx > 4.5) {
          ctx.fillStyle = treeChm >= 4.6 ? '#f5d0fe' : (treeChm < 3.35 ? '#fef08a' : '#a7f3d0');
          for (let p = 0; p < 6; p++) {
            const ang = p * 1.0472 + (r * 0.3 + c * 0.7);
            const dist = treeRadiusPx * (0.35 + (p % 2) * 0.35);
            ctx.fillRect(sx + Math.cos(ang) * dist - 1, sy + Math.sin(ang) * dist - 1, 2, 2);
          }
        }

        // Computer-Vision AI Stress / Structural Anomaly Bounding Box on stressed/stunted trees in FOV
        if (tSpec.ndvi < 0.46 && sx > 14 && sx < W - 14 && sy > 14 && sy < H - 14) {
          const boxR = treeRadiusPx + 3;
          ctx.strokeStyle = mode === 'thermal' ? '#38bdf8' : (mode === 'elevation' ? '#c084fc' : '#ef4444');
          ctx.lineWidth = 1.2;
          ctx.strokeRect(sx - boxR, sy - boxR, boxR * 2, boxR * 2);

          if (fovW < 42) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(sx - boxR, sy - boxR - 11, 54, 10);
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
            const treeTemp = tSpec.temperatureC ?? tSpec.temperature ?? 22.0;
            const boxLabel = mode === 'thermal'
              ? `${treeTemp.toFixed(1)}°C`
              : (mode === 'elevation' ? `CHM ${treeChm.toFixed(1)}m` : `NDVI ${(tSpec.ndvi ?? 0.75).toFixed(2)}`);
            ctx.fillText(boxLabel, sx - boxR + 2, sy - boxR - 3);
          }
        }
      }
    }

    // 4b. LiDAR Sweeping Laser Scan Line Effect (when in elevation mode)
    if (mode === 'elevation') {
      const scanY = ((nowSec * 65) % H);
      const grad = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 2);
      grad.addColorStop(0, 'rgba(192, 132, 252, 0.0)');
      grad.addColorStop(0.8, 'rgba(192, 132, 252, 0.35)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.85)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 8, W, 10);
    }

    // 5. Active Spray Swath Ring (if Sprayer Pump is active)
    if (this.store.getDroneType() === 'sprayer' && this.store.getSprayPumpState() === 'on' && this.store.getMotorPower() !== 'off') {
      const swathM = Math.max(2.6, Math.min(5.2, agl * 0.65));
      const swathPx = swathM * pxPerMeter;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.5, swathPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 6. Thermal IR Hot-Spot / Cold-Spot Tracker (FLIR Ironbow mode)
    if (mode === 'thermal' && maxTempPos && minTempPos) {
      // Hot spot ▲
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(maxTempPos.sx, maxTempPos.sy, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.fillText(`▲${maxTemp.toFixed(1)}°C`, Math.min(W - 48, maxTempPos.sx + 7), Math.max(24, maxTempPos.sy + 3));

      // Cold spot ▼
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(minTempPos.sx, minTempPos.sy, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 7. Optical Gimbal Reticle & Artificial Horizon Overlay
    const cx = W * 0.5;
    const cy = H * 0.5;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1;
    // Crosshair
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy);
    ctx.lineTo(cx + 18, cy);
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5);
    ctx.lineTo(cx, cy + 18);
    ctx.stroke();

    // Gimbal roll horizon ticks
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-rollRad);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-36, 0);
    ctx.lineTo(-24, 0);
    ctx.moveTo(24, 0);
    ctx.lineTo(36, 0);
    ctx.stroke();
    ctx.restore();

    // Top HUD Telemetry Header inside PiP Canvas
    ctx.fillStyle = 'rgba(6, 11, 20, 0.76)';
    ctx.fillRect(0, 0, W, 17);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
    const headerModeTag = mode === 'elevation' ? 'LiDAR 240k pts/s' : `-90° NADIR`;
    ctx.fillText(`GSD: ${gsdCm}cm/px | FOV: ${fovW.toFixed(0)}×${fovH.toFixed(0)}m | ${headerModeTag}`, 6, 11.5);
  }
}
