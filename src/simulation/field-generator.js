/**
 * FieldGenerator
 * Matriz de datos del huerto frutícola CEAF.
 * Genera al azar zonas con Estrés Hídrico/Fitosanitario (bajo NDVI, alta temperatura) y zonas de Alto Vigor / Alto NDVI (máxima transpiración, baja temperatura).
 * Soporta aplicación fitosanitaria e hidratación foliar en tiempo real.
 */
export class FieldGenerator {
  constructor(fieldWidth = 200, fieldLength = 200, gridResolution = 80) {
    this.fieldWidth = fieldWidth;   // X: [-100, 100]
    this.fieldLength = fieldLength; // Z: [-100, 100]
    this.gridRes = gridResolution;

    this.halfW = fieldWidth / 2;
    this.halfL = fieldLength / 2;
    this.cellW = this.fieldWidth / this.gridRes;
    this.cellL = this.fieldLength / this.gridRes;
    this.cellAreaM2 = this.cellW * this.cellL;

    this.stressZones = [];
    this.highNdviZones = [];
    this.anomalyZones = [];

    const totalVertices = (this.gridRes + 1) * (this.gridRes + 1);
    this.treatmentGrid = new Float32Array(totalVertices);
    this.initialStressedIndices = [];
    this.treatedAreaM2 = 0.0;
    this.stressRecoveryPct = 0.0;

    this.grid = [];
    this.randomizeZones();
    this.generateField();
  }

  /**
   * Genera aleatoriamente zonas de Estrés (bajo NDVI) y zonas de Alto Vigor (alto NDVI)
   * distribuidas en el huerto sin solaparse con el helipuerto central (0,0).
   */
  randomizeZones() {
    this.stressZones = [];
    this.highNdviZones = [];
    this.anomalyZones = [];

    const stressLabels = [
      'Estrés Hídrico Severo',
      'Déficit de Nitrógeno',
      'Foco de Arañita Roja',
      'Compactación Radicular',
      'Clorosis Férrica'
    ];

    const highNdviLabels = [
      'Alto Vigor Vegetativo',
      'Máxima Densidad Foliar',
      'Óptima Hidratación (Alto NDVI)'
    ];

    const placedZones = [];

    const pickPosition = (radius) => {
      for (let attempt = 0; attempt < 80; attempt++) {
        const x = (Math.random() * 144) - 72; // [-72, 72]
        const z = (Math.random() * 144) - 72; // [-72, 72]

        // Mantener despejada la zona del helipuerto central (0, 0) y los caminos centrales principales
        const distFromHome = Math.sqrt(x * x + z * z);
        if (distFromHome < 26) continue;
        if (Math.abs(x) < 8 || Math.abs(z) < 8) continue;

        let overlaps = false;
        for (const existing of placedZones) {
          const dx = x - existing.x;
          const dz = z - existing.z;
          const minDist = (radius + existing.radius) * 0.85;
          if (Math.sqrt(dx * dx + dz * dz) < minDist) {
            overlaps = true;
            break;
          }
        }

        if (!overlaps) {
          return { x: Math.round(x), z: Math.round(z) };
        }
      }
      // Fallback en caso de saturación
      const angle = Math.random() * Math.PI * 2;
      const dist = 38 + Math.random() * 32;
      return {
        x: Math.round(Math.cos(angle) * dist),
        z: Math.round(Math.sin(angle) * dist)
      };
    };

    // 1. Generar entre 3 y 4 zonas estresadas al azar
    const numStress = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numStress; i++) {
      const radius = Math.round(18 + Math.random() * 9); // 18m a 27m
      const pos = pickPosition(radius);
      const ndvi = Number((0.16 + Math.random() * 0.16).toFixed(2)); // 0.16 a 0.32
      const zone = {
        id: `stress_${i}`,
        type: 'stressed',
        x: pos.x,
        z: pos.z,
        radius,
        ndvi,
        name: stressLabels[i % stressLabels.length]
      };
      this.stressZones.push(zone);
      placedZones.push(zone);
    }

    // 2. Generar entre 2 y 3 zonas de Alto NDVI al azar
    const numHigh = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numHigh; i++) {
      const radius = Math.round(16 + Math.random() * 8); // 16m a 24m
      const pos = pickPosition(radius);
      const ndvi = Number((0.90 + Math.random() * 0.06).toFixed(2)); // 0.90 a 0.96
      const zone = {
        id: `high_ndvi_${i}`,
        type: 'high_ndvi',
        x: pos.x,
        z: pos.z,
        radius,
        ndvi,
        name: highNdviLabels[i % highNdviLabels.length]
      };
      this.highNdviZones.push(zone);
      placedZones.push(zone);
    }

    this.anomalyZones = [...this.stressZones, ...this.highNdviZones];
  }

  /**
   * Regenera todo el huerto con nuevas zonas aleatorias y reinicia el mapa de tratamiento
   */
  regenerateRandomField() {
    this.treatmentGrid.fill(0.0);
    this.treatedAreaM2 = 0.0;
    this.stressRecoveryPct = 0.0;
    this.randomizeZones();
    this.generateField();
    return this.anomalyZones;
  }

  generateField() {
    this.grid = [];
    this.initialStressedIndices = [];
    const stride = this.gridRes + 1;

    for (let r = 0; r <= this.gridRes; r++) {
      const row = [];
      const z = -this.halfL + r * this.cellL;
      for (let c = 0; c <= this.gridRes; c++) {
        const x = -this.halfW + c * this.cellW;

        const maxCoord = Math.max(Math.abs(x), Math.abs(z));
        const edgeFade = maxCoord > 75 ? Math.max(0, (100 - maxCoord) / 25) : 1.0;
        const height = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 1.5 * edgeFade;
        const spectral = this.calculateSpectralAt(x, height, z);

        if (!spectral.isPath && spectral.rawNDVI < 0.60) {
          this.initialStressedIndices.push(r * stride + c);
        }

        row.push({
          x,
          y: height,
          z,
          ...spectral
        });
      }
      this.grid.push(row);
    }
  }

  /**
   * Obtiene el nivel de tratamiento fitosanitario/hidratación [0.0 a 1.0] interpolado bilinealmente en (x, z)
   */
  getTreatmentAt(x, z) {
    if (!this.treatmentGrid) return 0.0;

    const clampedX = Math.max(-this.halfW, Math.min(this.halfW, x));
    const clampedZ = Math.max(-this.halfL, Math.min(this.halfL, z));

    const u = ((clampedX + this.halfW) / this.fieldWidth) * this.gridRes;
    const v = ((clampedZ + this.halfL) / this.fieldLength) * this.gridRes;

    const c0 = Math.max(0, Math.min(this.gridRes, Math.floor(u)));
    const r0 = Math.max(0, Math.min(this.gridRes, Math.floor(v)));
    const c1 = Math.min(this.gridRes, c0 + 1);
    const r1 = Math.min(this.gridRes, r0 + 1);

    const tx = u - c0;
    const tz = v - r0;

    const stride = this.gridRes + 1;
    const v00 = this.treatmentGrid[r0 * stride + c0];
    const v10 = this.treatmentGrid[r0 * stride + c1];
    const v01 = this.treatmentGrid[r1 * stride + c0];
    const v11 = this.treatmentGrid[r1 * stride + c1];

    const top = v00 * (1.0 - tx) + v10 * tx;
    const bottom = v01 * (1.0 - tx) + v11 * tx;
    return top * (1.0 - tz) + bottom * tz;
  }

  /**
   * Calcula el porcentaje de recuperación [0 a 1] de una zona de estrés específica
   */
  getZoneRecoveryRatio(zone) {
    if (!zone || zone.type !== 'stressed') return 1.0;
    return this.getTreatmentAt(zone.x, zone.z);
  }

  /**
   * Aplica aspersión fitosanitaria sobre el terreno en torno a (px, pz).
   */
  applySprayAt(px, pz, altitude, flowRateLmin, dt) {
    if (altitude < 0.2 || altitude > 25.0) {
      return { modified: false, swathRadius: 0, treatedAreaM2: this.treatedAreaM2, stressRecoveryPct: this.stressRecoveryPct };
    }

    const swathRadius = Math.max(4.0, Math.min(11.0, 2.6 + altitude * 0.48));
    const doseRate = (flowRateLmin / 4.5) * 0.95 * dt;

    const cMin = Math.max(0, Math.floor(((px - swathRadius + this.halfW) / this.fieldWidth) * this.gridRes));
    const cMax = Math.min(this.gridRes, Math.ceil(((px + swathRadius + this.halfW) / this.fieldWidth) * this.gridRes));
    const rMin = Math.max(0, Math.floor(((pz - swathRadius + this.halfL) / this.fieldLength) * this.gridRes));
    const rMax = Math.min(this.gridRes, Math.ceil(((pz + swathRadius + this.halfL) / this.fieldLength) * this.gridRes));

    const stride = this.gridRes + 1;
    let modified = false;

    for (let r = rMin; r <= rMax; r++) {
      const cellZ = -this.halfL + r * this.cellL;
      const dz = cellZ - pz;
      for (let c = cMin; c <= cMax; c++) {
        const cellX = -this.halfW + c * this.cellW;
        const dx = cellX - px;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= swathRadius) {
          const f = 1.0 - dist / swathRadius;
          const smoothKernel = f * f * (3.0 - 2.0 * f);
          const idx = r * stride + c;
          const prev = this.treatmentGrid[idx];

          if (prev < 1.0) {
            const next = Math.min(1.0, prev + doseRate * smoothKernel);
            if (next - prev > 0.0005) {
              this.treatmentGrid[idx] = next;
              modified = true;

              if (this.grid[r] && this.grid[r][c]) {
                const y = this.grid[r][c].y;
                const updatedSpectral = this.calculateSpectralAt(cellX, y, cellZ);
                Object.assign(this.grid[r][c], updatedSpectral);
              }
            }
          }
        }
      }
    }

    if (modified) {
      this.recalculateTreatmentStats();
    }

    return {
      modified,
      swathRadius,
      treatedAreaM2: this.treatedAreaM2,
      stressRecoveryPct: this.stressRecoveryPct
    };
  }

  recalculateTreatmentStats() {
    let coveredCells = 0.0;
    const totalLen = this.treatmentGrid.length;
    for (let i = 0; i < totalLen; i++) {
      const t = this.treatmentGrid[i];
      if (t > 0.03) {
        coveredCells += Math.min(1.0, t / 0.35);
      }
    }
    this.treatedAreaM2 = coveredCells * this.cellAreaM2;

    if (this.initialStressedIndices.length > 0) {
      let recoveredSum = 0.0;
      for (let i = 0; i < this.initialStressedIndices.length; i++) {
        const idx = this.initialStressedIndices[i];
        const t = this.treatmentGrid[idx];
        recoveredSum += 1.0 - Math.pow(1.0 - t, 1.8);
      }
      this.stressRecoveryPct = Math.min(100.0, (recoveredSum / this.initialStressedIndices.length) * 100.0);
    }
  }

  calculateSpectralAt(x, height, z) {
    const isPath = Math.abs(x) < 2.5 || Math.abs(z) < 2.5;
    const treatment = this.getTreatmentAt(x, z);

    // Vigor base del huerto estándar (~0.74)
    let baseNDVI = 0.74 + Math.sin(x * 0.2) * Math.cos(z * 0.2) * 0.03;
    let currentNDVI = baseNDVI;
    let isHighNdviZone = false;

    // 1. Evaluar Zonas de Estrés (reducen NDVI)
    for (const zone of this.stressZones) {
      const dx = x - zone.x;
      const dz = z - zone.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < zone.radius) {
        const factor = 1.0 - (dist / zone.radius);
        const smoothFactor = factor * factor * (3 - 2 * factor);
        const zoneNDVI = baseNDVI * (1 - smoothFactor) + zone.ndvi * smoothFactor;
        if (zoneNDVI < currentNDVI) {
          currentNDVI = zoneNDVI;
        }
      }
    }

    // 2. Evaluar Zonas de Alto NDVI (incrementan NDVI hacia 0.90 - 0.96)
    for (const zone of this.highNdviZones) {
      const dx = x - zone.x;
      const dz = z - zone.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < zone.radius) {
        const factor = 1.0 - (dist / zone.radius);
        const smoothFactor = factor * factor * (3 - 2 * factor);
        const zoneNDVI = currentNDVI * (1 - smoothFactor) + zone.ndvi * smoothFactor;
        if (zoneNDVI > currentNDVI) {
          currentNDVI = zoneNDVI;
          if (smoothFactor > 0.25) isHighNdviZone = true;
        }
      }
    }

    const rawNDVI = Math.max(0.1, Math.min(0.97, currentNDVI));
    let ndvi = rawNDVI;

    if (isPath) {
      ndvi = 0.14 + treatment * 0.04;
    } else if (treatment > 0.0) {
      // Recuperación agronómica progresiva al aplicar tratamiento fitosanitario
      const recoveryCurve = 1.0 - Math.pow(1.0 - treatment, 1.8);
      const targetHealthyNDVI = Math.max(rawNDVI, 0.82);
      ndvi = Math.min(0.95, rawNDVI + (targetHealthyNDVI - rawNDVI) * recoveryCurve);
    }

    // Colors RGB Natural (para reportes 2D)
    let rgbColor;
    if (isPath) {
      rgbColor = [0.65 - treatment * 0.18, 0.55 - treatment * 0.12, 0.40 - treatment * 0.06];
    } else if (ndvi >= 0.85) {
      rgbColor = [0.08, 0.68, 0.28]; // Alto vigor verde intenso
    } else if (ndvi >= 0.65) {
      const t = (ndvi - 0.65) / 0.20;
      rgbColor = [0.15 + t * 0.04, 0.50 + t * 0.14, 0.20 + treatment * 0.12];
    } else {
      const t = ndvi / 0.65;
      rgbColor = [0.62 - t * 0.40, 0.44 + t * 0.10, 0.22];
    }

    // Vertex Color Tint para terreno 3D en vista RGB Natural
    let tintR = 1.0;
    let tintG = 1.0;
    let tintB = 1.0;
    if (!isPath && rawNDVI < 0.58) {
      const stressAmt = Math.max(0, (0.58 - rawNDVI) / 0.40) * (1.0 - treatment);
      tintR += stressAmt * 0.16;
      tintG -= stressAmt * 0.11;
      tintB -= stressAmt * 0.26;
    } else if (!isPath && rawNDVI >= 0.84) {
      const highAmt = Math.min(1.0, (rawNDVI - 0.84) / 0.12);
      tintR -= highAmt * 0.16;
      tintG += highAmt * 0.14;
      tintB -= highAmt * 0.08;
    }
    if (treatment > 0.0) {
      const wetFactor = Math.min(1.0, treatment);
      tintR = tintR * (1.0 - wetFactor * 0.36);
      tintG = tintG * (1.0 - wetFactor * 0.03) + wetFactor * 0.04;
      tintB = tintB * (1.0 - wetFactor * 0.08) + wetFactor * 0.10;
    }
    const rgbVertexTint = [tintR, tintG, tintB];

    // Colores NDVI (Salud vegetal)
    let ndviColor, status;
    if (isPath) {
      status = treatment >= 0.25 ? 'Camino Húmedo' : 'Suelo Desnudo';
      ndviColor = [
        0.72 - treatment * 0.22,
        0.45 + treatment * 0.10,
        0.25 + treatment * 0.20
      ];
    } else if (ndvi >= 0.85) {
      status = 'Alto Vigor (NDVI Alto)';
      const t = Math.min(1.0, (ndvi - 0.85) / 0.12);
      // Verde esmeralda-turquesa intenso para destacar zonas de Alto NDVI
      ndviColor = [0.02, 0.88 + t * 0.10, 0.38 + t * 0.18];
    } else if (ndvi >= 0.65) {
      status = (treatment >= 0.25 && rawNDVI < 0.65) ? 'Recuperado (Fumigado)' : (treatment >= 0.25 ? 'Saludable (Tratado)' : 'Saludable');
      const t = (ndvi - 0.65) / 0.20;
      ndviColor = [0.10, 0.68 + t * 0.18, 0.18 + treatment * 0.14];
    } else if (ndvi >= 0.40) {
      status = treatment >= 0.15 ? 'En Recuperación' : 'Estrés Moderado';
      const t = (ndvi - 0.40) / 0.25;
      ndviColor = [0.85 - t * 0.70, 0.75 - t * 0.05, 0.15];
    } else {
      status = 'Déficit Severo';
      ndviColor = [0.92, 0.18, 0.14];
    }

    // Modelo Térmico Agronómico Realista
    let rawTempC;
    if (isPath) {
      rawTempC = 42.5 + Math.sin(x * 0.3) * 2.5;
    } else {
      rawTempC = 38.0 - rawNDVI * 18.2 + (Math.sin(x * 0.1) * 0.8);
    }

    let temperatureC = rawTempC;
    if (treatment > 0.0) {
      const coolCurve = 1.0 - Math.pow(1.0 - treatment, 1.6);
      if (isPath) {
        temperatureC = rawTempC - 13.0 * coolCurve;
      } else {
        temperatureC = rawTempC - (rawTempC - 21.0) * coolCurve;
      }
    }

    let thermalColor;
    const normTemp = Math.max(0, Math.min(1, (temperatureC - 19.5) / 25.5));
    if (normTemp < 0.35) {
      const t = normTemp / 0.35;
      thermalColor = [0.12 + t * 0.22, 0.10 + t * 0.12, 0.82 - t * 0.24];
    } else if (normTemp < 0.70) {
      const t = (normTemp - 0.35) / 0.35;
      thermalColor = [0.45 + t * 0.45, 0.20 + t * 0.25, 0.45 - t * 0.40];
    } else {
      const t = (normTemp - 0.70) / 0.30;
      thermalColor = [0.90 + t * 0.1, 0.55 + t * 0.40, 0.10 + t * 0.85];
    }

    // Modelo Digital de Dosel LiDAR (CHM - Canopy Height Model) y Volumen de Hilera (TRV m³/ha)
    // En fruticultura de precisión (O'Higgins), el vigor estructural determina la altura de copa (m)
    // y el Tree Row Volume (TRV = Alto_Copa * Ancho_Copa * 10000 / Distancia_Entre_Hileras).
    let canopyHeightM = 0.0;
    let trvM3Ha = 0;

    if (!isPath) {
      // Variación micro-estructural natural entre árboles de la hilera
      const structWave = Math.sin(x * 0.35 + z * 0.25) * 0.18;
      if (rawNDVI < 0.45) {
        // Zonas con estrés hídrico/radicular crónico: menor desarrollo de brotes (2.3m - 3.2m)
        const t = Math.max(0, (rawNDVI - 0.15) / 0.30);
        canopyHeightM = Number(Math.max(2.1, 2.35 + t * 0.90 + structWave).toFixed(2));
      } else if (rawNDVI >= 0.84) {
        // Zonas de alto vigor vegetativo: copas dominantes y densas (4.8m - 5.5m)
        const t = Math.min(1.0, (rawNDVI - 0.84) / 0.12);
        canopyHeightM = Number((4.75 + t * 0.65 + structWave).toFixed(2));
      } else {
        // Dosel adulto estándar del huerto (3.8m - 4.6m)
        const t = (rawNDVI - 0.45) / 0.39;
        canopyHeightM = Number((3.65 + t * 0.95 + structWave).toFixed(2));
      }

      // Ancho efectivo de copa (m) proporcional al desarrollo vertical y vigor foliar
      const canopyWidthM = Math.max(1.6, canopyHeightM * 0.72);
      const rowSpacingM = 10.0; // Marco de plantación de 10m en el modelo 3D
      trvM3Ha = Math.round((canopyHeightM * canopyWidthM * 10000) / (rowSpacingM * 0.95));
    }

    // Paleta Hipsométrica LiDAR CHM (Azul Suelo -> Cian -> Verde -> Amarillo -> Magenta Cúspide)
    let elevationColor;
    if (isPath || canopyHeightM < 0.5) {
      const groundNorm = Math.max(0, Math.min(1, (height + 1.5) / 3.0));
      elevationColor = [0.08 + groundNorm * 0.06, 0.16 + groundNorm * 0.12, 0.48 + groundNorm * 0.20];
    } else {
      const normCHM = Math.max(0, Math.min(1, (canopyHeightM - 2.0) / 3.5));
      if (normCHM < 0.35) {
        // Dosel bajo / ralo (2.0m - 3.2m): Cian a Amarillo-Ámbar
        const t = normCHM / 0.35;
        elevationColor = [0.15 + t * 0.75, 0.72 + t * 0.12, 0.88 - t * 0.68];
      } else if (normCHM < 0.72) {
        // Dosel adulto estándar (3.2m - 4.5m): Verde Esmeralda / Lima LiDAR
        const t = (normCHM - 0.35) / 0.37;
        elevationColor = [0.20 + t * 0.25, 0.86 - t * 0.08, 0.28 + t * 0.22];
      } else {
        // Dosel dominante / máximo TRV (> 4.5m): Violeta / Magenta Láser
        const t = (normCHM - 0.72) / 0.28;
        elevationColor = [0.68 + t * 0.28, 0.28 - t * 0.10, 0.88 + t * 0.10];
      }
    }

    return {
      isPath,
      isHighNdviZone,
      rawNDVI,
      ndvi,
      treatment,
      temperatureC,
      canopyHeightM,
      trvM3Ha,
      rgbColor,
      rgbVertexTint,
      ndviColor,
      thermalColor,
      elevationColor,
      status
    };
  }

  getGroundDataAt(x, z) {
    const clampedX = Math.max(-this.halfW, Math.min(this.halfW, x));
    const clampedZ = Math.max(-this.halfL, Math.min(this.halfL, z));
    return this.calculateSpectralAt(clampedX, 0, clampedZ);
  }

  getFieldSummary() {
    let ndviSum = 0;
    let cropCount = 0;
    let canopyTempSum = 0;
    let pathTempSum = 0;
    let pathCount = 0;

    for (let r = 0; r <= this.gridRes; r++) {
      for (let c = 0; c <= this.gridRes; c++) {
        const cell = this.grid[r][c];
        if (cell.isPath) {
          pathTempSum += cell.temperatureC;
          pathCount++;
        } else {
          ndviSum += cell.ndvi;
          canopyTempSum += cell.temperatureC;
          cropCount++;
        }
      }
    }

    return {
      avgNDVI: cropCount > 0 ? ndviSum / cropCount : 0.78,
      avgCanopyTempC: cropCount > 0 ? canopyTempSum / cropCount : 23.5,
      avgSoilTempC: pathCount > 0 ? pathTempSum / pathCount : 42.1,
      treatedAreaM2: this.treatedAreaM2,
      stressRecoveryPct: this.stressRecoveryPct,
      stressZoneCount: this.stressZones.length,
      highNdviZoneCount: this.highNdviZones.length
    };
  }

  /**
   * Convierte coordenadas locales del huerto (x, z en metros, [-100, 100])
   * a coordenadas geodésicas reales del predio experimental CEAF en Rengo, Región de O'Higgins:
   * - Proyección UTM Zona 19S (EPSG:32719): Centro en 334,800m E, 6,192,400m N
   * - Coordenadas Geográficas WGS84 (EPSG:4326): -34.405400° S, -70.858200° W
   */
  localToGeo(x, z) {
    const utmE = 334800.0 + x;
    const utmN = 6192400.0 - z;
    const baseLat = -34.405400;
    const baseLon = -70.858200;
    const lat = baseLat - (z / 111132.0);
    const lon = baseLon + (x / (111320.0 * Math.cos(Math.abs(baseLat) * Math.PI / 180.0)));
    return {
      utmE: Number(utmE.toFixed(1)),
      utmN: Number(utmN.toFixed(1)),
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6))
    };
  }

  /**
   * Calcula la prescripción de Dosis Variable (VRA) puntual en (x, z)
   */
  getVraAt(x, z) {
    const data = this.getGroundDataAt(x, z);
    if (data.isPath) {
      return {
        doseLHa: 0,
        rateLHa: 0,
        vraClass: 'CAMINO / EXCLUSIÓN',
        color: [0.22, 0.26, 0.32],
        colorRGB: [0.22, 0.26, 0.32],
        hex: '#334155',
        colorHex: '#334155',
        cwsi: 0.0
      };
    }

    // Índice de Estrés Hídrico del Cultivo (CWSI) estimado de temperatura foliar y NDVI
    const cwsi = Math.max(0.0, Math.min(1.0, (data.temperatureC - 20.5) / 16.5));

    if (data.ndvi < 0.36) {
      return {
        doseLHa: 150,
        rateLHa: 150,
        vraClass: 'ALTA PRIORIDAD (150 L/ha)',
        color: [0.94, 0.27, 0.27],
        colorRGB: [0.94, 0.27, 0.27],
        hex: '#ef4444',
        colorHex: '#ef4444',
        cwsi
      };
    } else if (data.ndvi < 0.62) {
      return {
        doseLHa: 85,
        rateLHa: 85,
        vraClass: 'DOSIS MEDIA (85 L/ha)',
        color: [0.96, 0.62, 0.04],
        colorRGB: [0.96, 0.62, 0.04],
        hex: '#f59e0b',
        colorHex: '#f59e0b',
        cwsi
      };
    } else if (data.ndvi >= 0.85) {
      return {
        doseLHa: 0,
        rateLHa: 0,
        vraClass: 'EXENTO - ALTO VIGOR (0 L/ha)',
        color: [0.06, 0.72, 0.50],
        colorRGB: [0.06, 0.72, 0.50],
        hex: '#10b981',
        colorHex: '#10b981',
        cwsi
      };
    } else {
      return {
        doseLHa: 0,
        rateLHa: 0,
        vraClass: 'EXENTO - VIGOR ÓPTIMO (0 L/ha)',
        color: [0.13, 0.55, 0.28],
        colorRGB: [0.13, 0.55, 0.28],
        hex: '#22c55e',
        colorHex: '#22c55e',
        cwsi
      };
    }
  }

  /**
   * Genera la tabla de atributos GIS por polígono y el balance de ahorro VRA (estilo QGIS / Pix4DFields)
   */
  getGISPrescriptionData() {
    const features = [];
    let stressCounter = 1;
    let highCounter = 1;
    let vraPrescribedAreaM2 = 0;
    let vraTotalVolumeL = 0;

    this.anomalyZones.forEach((zone, idx) => {
      const isStress = zone.type === 'stressed';
      const code = isStress
        ? `Z-EST-0${stressCounter++}`
        : `Z-VIG-0${highCounter++}`;

      const centerData = this.getGroundDataAt(zone.x, zone.z);
      const geo = this.localToGeo(zone.x, zone.z);
      const areaM2 = Math.round(Math.PI * zone.radius * zone.radius * 0.92);
      const areaHa = Number((areaM2 / 10000).toFixed(3));

      const treatmentRatio = isStress ? this.getZoneRecoveryRatio(zone) : 0.0;
      const recoveryPct = isStress ? Math.round((1.0 - Math.pow(1.0 - treatmentRatio, 1.8)) * 100) : 100;

      // Determinar Dosis VRA según el NDVI actual del polígono
      let doseLHa = 0;
      let vraClass = 'EXENTO (0 L/ha)';
      let priorityBadge = 'healthy';

      if (isStress) {
        if (centerData.ndvi < 0.36) {
          doseLHa = 150;
          vraClass = 'ALTA (150 L/ha)';
          priorityBadge = 'stressed';
        } else if (centerData.ndvi < 0.64) {
          doseLHa = 85;
          vraClass = 'MEDIA (85 L/ha)';
          priorityBadge = 'moderate';
        } else {
          doseLHa = 0;
          vraClass = 'MITIGADO (0 L/ha)';
          priorityBadge = 'healthy';
        }
      } else {
        doseLHa = 0;
        vraClass = 'RESERVA VIGOR (0 L/ha)';
        priorityBadge = 'healthy';
      }

      const volumeL = Number((areaHa * doseLHa).toFixed(1));
      if (doseLHa > 0) {
        vraPrescribedAreaM2 += areaM2;
        vraTotalVolumeL += volumeL;
      }

      const cwsi = Number(Math.max(0.05, Math.min(0.98, (centerData.temperatureC - 20.0) / 16.5)).toFixed(2));

      features.push({
        fid: idx + 1,
        id: zone.id,
        code,
        type: zone.type,
        name: zone.name,
        x: zone.x,
        z: zone.z,
        radius: zone.radius,
        utmE: geo.utmE,
        utmN: geo.utmN,
        lat: geo.lat,
        lon: geo.lon,
        areaM2,
        areaHa,
        initialNDVI: zone.ndvi,
        currentNDVI: Number(centerData.ndvi.toFixed(2)),
        tempC: Number(centerData.temperatureC.toFixed(1)),
        canopyHeightM: Number((centerData.canopyHeightM || 4.2).toFixed(1)),
        trvM3Ha: centerData.trvM3Ha || 13500,
        cwsi,
        doseLHa,
        volumeL,
        vraClass,
        priorityBadge,
        recoveryPct
      });
    });

    const totalFieldAreaM2 = this.fieldWidth * this.fieldLength; // 40,000 m² (4.00 ha)
    const totalFieldAreaHa = totalFieldAreaM2 / 10000;
    const conventionalDoseLHa = 150;
    const conventionalVolumeL = totalFieldAreaHa * conventionalDoseLHa; // 600.0 L en aplicación tradicional total
    const waterSavedL = Math.max(0, conventionalVolumeL - vraTotalVolumeL);
    const chemicalSavingsPct = conventionalVolumeL > 0
      ? Number(((waterSavedL / conventionalVolumeL) * 100).toFixed(1))
      : 0;

    return {
      crs: 'EPSG:32719 (WGS 84 / UTM zone 19S - Rengo, O\'Higgins)',
      totalFieldAreaM2,
      totalFieldAreaHa,
      conventionalDoseLHa,
      conventionalVolumeL: Number(conventionalVolumeL.toFixed(1)),
      vraPrescribedAreaM2,
      vraPrescribedAreaHa: Number((vraPrescribedAreaM2 / 10000).toFixed(2)),
      vraTotalVolumeL: Number(vraTotalVolumeL.toFixed(1)),
      waterSavedL: Number(waterSavedL.toFixed(1)),
      chemicalSavingsPct,
      features
    };
  }

  /**
   * Exporta las capas vectoriales de anomalías, prescripción VRA y ruta de vuelo en estándar RFC 7946 GeoJSON
   * compatible directamente con QGIS, ArcGIS Pro y Pix4DFields.
   */
  generateGeoJSONString() {
    const gis = this.getGISPrescriptionData();
    const geoFeatures = [];

    // 1. Polígonos de Zonificación y Prescripción VRA
    gis.features.forEach((f) => {
      const ring = [];
      const segments = 24;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const px = f.x + Math.cos(angle) * f.radius;
        const pz = f.z + Math.sin(angle) * f.radius;
        const ptGeo = this.localToGeo(px, pz);
        ring.push([ptGeo.lon, ptGeo.lat]);
      }

      geoFeatures.push({
        type: 'Feature',
        id: f.fid,
        properties: {
          FID: f.fid,
          CODIGO_POLIGONO: f.code,
          TIPO_ZONA: f.type === 'stressed' ? 'DEFICIT_HIDRICO_NUTRICIONAL' : 'ALTO_VIGOR_NDVI',
          DIAGNOSTICO: f.name,
          CRS_ORIGEN: 'EPSG:32719',
          UTM_ESTE_M: f.utmE,
          UTM_NORTE_M: f.utmN,
          AREA_M2: f.areaM2,
          AREA_HA: f.areaHa,
          NDVI_INICIAL: f.initialNDVI,
          NDVI_ACTUAL: f.currentNDVI,
          TEMP_DOSEL_C: f.tempC,
          ALTURA_DOSEL_CHM_M: f.canopyHeightM,
          VOLUMEN_COPA_TRV_M3_HA: f.trvM3Ha,
          INDICE_CWSI: f.cwsi,
          CLASE_PRESCRIPCION_VRA: f.vraClass,
          DOSIS_PRESCRITA_L_HA: f.doseLHa,
          VOLUMEN_REQUERIDO_L: f.volumeL,
          MITIGACION_PCT: f.recoveryPct
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ring]
        }
      });
    });

    // 2. Línea Vectorial de Ruta de Vuelo GNSS RTK
    const routeCoords = [];
    const homeGeo = this.localToGeo(0, 0);
    routeCoords.push([homeGeo.lon, homeGeo.lat]);
    gis.features.forEach((f) => {
      routeCoords.push([f.lon, f.lat]);
    });
    routeCoords.push([homeGeo.lon, homeGeo.lat]);

    geoFeatures.push({
      type: 'Feature',
      id: 999,
      properties: {
        FID: 999,
        CAPA: 'TRAYECTORIA_VUELO_GNSS_RTK',
        MODO_VUELO: 'AUTONOMO_DIRIGIDO_ZONAS',
        AHORRO_INSUMOS_VRA_PCT: gis.chemicalSavingsPct
      },
      geometry: {
        type: 'LineString',
        coordinates: routeCoords
      }
    });

    const geojson = {
      type: 'FeatureCollection',
      name: 'CEAF_DroneLab_Prescripcion_VRA_Rengo_OHiggins',
      crs: {
        type: 'name',
        properties: {
          name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
        }
      },
      metadata: {
        generatedBy: 'CEAF DroneLab Chile - GeoLab GIS v3.4',
        location: 'Estación Experimental CEAF, Rengo, Región de O\'Higgins, Chile',
        projectedCRS: gis.crs,
        totalAreaHa: gis.totalFieldAreaHa,
        prescribedAreaHa: gis.vraPrescribedAreaHa,
        conventionalVolumeL: gis.conventionalVolumeL,
        vraVolumeL: gis.vraTotalVolumeL,
        savingsPct: gis.chemicalSavingsPct,
        timestamp: new Date().toISOString()
      },
      features: geoFeatures
    };

    return JSON.stringify(geojson, null, 2);
  }

  /**
   * Exporta la Tabla de Atributos GIS en formato CSV compatible con QGIS / Excel
   */
  generateCSVString() {
    const gis = this.getGISPrescriptionData();
    const headers = [
      'FID',
      'CODIGO_ZONA',
      'CLASIFICACION',
      'DIAGNOSTICO_AGRONOMICO',
      'UTM_19S_ESTE',
      'UTM_19S_NORTE',
      'LATITUD_WGS84',
      'LONGITUD_WGS84',
      'RADIO_M',
      'AREA_M2',
      'AREA_HA',
      'NDVI_INICIAL',
      'NDVI_ACTUAL',
      'TEMP_DOSEL_C',
      'ALTURA_CHM_M',
      'VOLUMEN_TRV_M3_HA',
      'CWSI',
      'DOSIS_VRA_L_HA',
      'VOLUMEN_CALDO_L',
      'MITIGACION_PCT'
    ];

    const rows = gis.features.map((f) => [
      f.fid,
      f.code,
      f.type === 'stressed' ? 'ESTRES_HIDRICO' : 'ALTO_VIGOR',
      `"${f.name}"`,
      f.utmE,
      f.utmN,
      f.lat,
      f.lon,
      f.radius,
      f.areaM2,
      f.areaHa,
      f.initialNDVI,
      f.currentNDVI,
      f.tempC,
      f.canopyHeightM,
      f.trvM3Ha,
      f.cwsi,
      f.doseLHa,
      f.volumeL,
      f.recoveryPct
    ].join(','));

    return '\uFEFF' + headers.join(',') + '\n' + rows.join('\n') + '\n';
  }
}

