/**
 * FieldGenerator
 * Matriz de datos del huerto frutícola CEAF.
 * Incluye física térmica realista: suelo/caminos desnudos expuestos al sol se calientan (38°C - 46°C), mientras que la canopia frutal transpirando se mantiene fresca (21°C - 24°C).
 */
export class FieldGenerator {
  constructor(fieldWidth = 200, fieldLength = 200, gridResolution = 80) {
    this.fieldWidth = fieldWidth;   // X: [-100, 100]
    this.fieldLength = fieldLength; // Z: [-100, 100]
    this.gridRes = gridResolution;

    this.halfW = fieldWidth / 2;
    this.halfL = fieldLength / 2;

    this.stressZones = [
      { x: -30, z: 25, radius: 35, ndvi: 0.22, name: 'Déficit Nitrógeno Severo' },
      { x: 35, z: -30, radius: 28, ndvi: 0.18, name: 'Estrés Hídrico / Plaga de Ácaros' },
      { x: 10, z: 45, radius: 22, ndvi: 0.35, name: 'Compactación de Suelo' }
    ];

    this.grid = [];
    this.generateField();
  }

  generateField() {
    this.grid = [];
    const cellW = this.fieldWidth / this.gridRes;
    const cellL = this.fieldLength / this.gridRes;

    for (let r = 0; r <= this.gridRes; r++) {
      const row = [];
      const z = -this.halfL + r * cellL;
      for (let c = 0; c <= this.gridRes; c++) {
        const x = -this.halfW + c * cellW;

        const height = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 1.5;
        const spectral = this.calculateSpectralAt(x, height, z);

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

  calculateSpectralAt(x, height, z) {
    let baseNDVI = 0.82 + Math.sin(x * 0.2) * Math.cos(z * 0.2) * 0.04;
    let minNDVI = baseNDVI;

    for (const zone of this.stressZones) {
      const dx = x - zone.x;
      const dz = z - zone.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < zone.radius) {
        const factor = 1.0 - (dist / zone.radius);
        const smoothFactor = factor * factor * (3 - 2 * factor);
        const zoneNDVI = baseNDVI * (1 - smoothFactor) + zone.ndvi * smoothFactor;
        if (zoneNDVI < minNDVI) {
          minNDVI = zoneNDVI;
        }
      }
    }

    const ndvi = Math.max(0.1, Math.min(0.95, minNDVI));

    // Colors RGB Natural
    const isPath = Math.abs(x) < 2.5 || Math.abs(z) < 2.5;
    let rgbColor;
    if (isPath) {
      rgbColor = [0.65, 0.55, 0.40]; // Camino de tierra agrícola
    } else if (ndvi >= 0.65) {
      const t = (ndvi - 0.65) / 0.30;
      rgbColor = [0.15 + t * 0.05, 0.50 + t * 0.15, 0.20]; // Frutales verdes exuberantes
    } else {
      const t = ndvi / 0.65;
      rgbColor = [0.60 - t * 0.40, 0.45 + t * 0.10, 0.22]; // Suelo seco / follaje clorótico
    }

    // Colores NDVI (Salud vegetal)
    let ndviColor, status;
    if (ndvi >= 0.65) {
      status = 'Saludable';
      const t = (ndvi - 0.65) / 0.30;
      ndviColor = [0.10, 0.70 + t * 0.25, 0.20];
    } else if (ndvi >= 0.40) {
      status = 'Estrés Moderado';
      const t = (ndvi - 0.40) / 0.25;
      ndviColor = [0.85 - t * 0.70, 0.75 - t * 0.05, 0.15];
    } else {
      status = 'Déficit Severo';
      ndviColor = [0.90, 0.20, 0.15];
    }

    // 4. Real-world Agronomic Thermal Model:
    // Suelo desnudo / caminos expuestos al sol absorben radiación y se calientan mucho (39°C - 46°C)
    // Canopia frutal saludable transpirando se mantiene fresca (21°C - 24.5°C)
    // Cultivo con estrés hídrico reduce transpiración y se calienta (29°C - 35°C)
    let temperatureC;
    if (isPath) {
      temperatureC = 42.5 + Math.sin(x * 0.3) * 2.5; // Suelo expuesto muy caliente
    } else {
      temperatureC = 38.0 - ndvi * 17.5 + (Math.sin(x * 0.1) * 0.8);
    }

    let thermalColor;
    const normTemp = Math.max(0, Math.min(1, (temperatureC - 20.0) / 25.0));
    if (normTemp < 0.35) {
      const t = normTemp / 0.35;
      thermalColor = [0.15 + t * 0.2, 0.10 + t * 0.1, 0.75 - t * 0.2]; // Púrpura/Azul fresco (Frutales transpirando)
    } else if (normTemp < 0.70) {
      const t = (normTemp - 0.35) / 0.35;
      thermalColor = [0.45 + t * 0.45, 0.20 + t * 0.25, 0.45 - t * 0.40]; // Ámbar/Rojo (Estrés térmico)
    } else {
      const t = (normTemp - 0.70) / 0.30;
      thermalColor = [0.90 + t * 0.1, 0.55 + t * 0.40, 0.10 + t * 0.85]; // Blanco/Amarillo ardiente (Suelo radiante)
    }

    // Elevación LiDAR
    const normH = Math.max(0, Math.min(1, (height + 2.0) / 4.0));
    const elevationColor = [0.1 + normH * 0.7, 0.3 + (1 - normH) * 0.5, 0.8 - normH * 0.4];

    return {
      ndvi,
      temperatureC,
      rgbColor,
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
}
