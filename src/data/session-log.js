/**
 * SessionLog
 * Formateador y agregador de registros de telemetría frutícola CEAF.
 */
export class SessionLog {
  static formatTimestamp(date = new Date()) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    const ms = String(Math.floor(date.getMilliseconds() / 100)).padStart(1, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  }

  static getCropStatus(ndvi, isPath = false, treatment = 0.0, rawNDVI = ndvi) {
    if (isPath) {
      if (treatment >= 0.25) {
        return { status: 'Camino Húmedo', class: 'healthy', color: '#38bdf8' };
      }
      return { status: 'Suelo Desnudo', class: 'moderate', color: '#a8a29e' };
    }
    if (ndvi >= 0.85 && rawNDVI >= 0.84) {
      return { status: 'Alto Vigor (NDVI Alto)', class: 'healthy', color: '#10b981' };
    }
    if (ndvi >= 0.65) {
      if (treatment >= 0.25 && rawNDVI < 0.65) {
        return { status: 'Recuperado (Fumigado)', class: 'healthy', color: '#10b981' };
      }
      if (treatment >= 0.25) {
        return { status: 'Saludable (Tratado)', class: 'healthy', color: '#10b981' };
      }
      return { status: 'Saludable', class: 'healthy', color: '#22c55e' };
    } else if (ndvi >= 0.40) {
      if (treatment >= 0.15) {
        return { status: 'En Recuperación', class: 'moderate', color: '#34d399' };
      }
      return { status: 'Estrés Moderado', class: 'moderate', color: '#f59e0b' };
    } else {
      return { status: 'Déficit Severo', class: 'stressed', color: '#ef4444' };
    }
  }

  static getThermalStatus(tempC, isPath = false, treatment = 0.0) {
    if (isPath) {
      if (treatment >= 0.25 && tempC < 36.0) {
        return { status: 'Suelo Enfriado', class: 'healthy', color: '#38bdf8' };
      }
      return { status: 'Suelo Radiante', class: 'stressed', color: '#ea580c' };
    }
    if (tempC >= 38.0) {
      return { status: 'Suelo Radiante', class: 'stressed', color: '#ea580c' };
    } else if (tempC >= 32.5) {
      return { status: 'Estrés Térmico Severo', class: 'stressed', color: '#ef4444' };
    } else if (tempC >= 27.5) {
      return { status: 'Estrés Térmico', class: 'moderate', color: '#f59e0b' };
    } else {
      if (treatment >= 0.25) {
        return { status: 'Dosel Hidratado', class: 'healthy', color: '#06b6d4' };
      }
      return { status: 'Canopia Fresca', class: 'healthy', color: '#38bdf8' };
    }
  }

  static createEntry(x, z, ndvi) {
    const roundedX = x.toFixed(1);
    const roundedZ = z.toFixed(1);
    const roundedNdvi = Number(ndvi.toFixed(2));
    const statusInfo = this.getCropStatus(roundedNdvi);

    return {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: this.formatTimestamp(),
      position: [roundedX, roundedZ],
      ndvi: roundedNdvi,
      status: statusInfo.status,
      statusClass: statusInfo.class,
      color: statusInfo.color
    };
  }
}
