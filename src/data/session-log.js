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

  static getCropStatus(ndvi) {
    if (ndvi >= 0.65) {
      return { status: 'Saludable', class: 'healthy', color: '#22c55e' };
    } else if (ndvi >= 0.40) {
      return { status: 'Estrés Moderado', class: 'moderate', color: '#f59e0b' };
    } else {
      return { status: 'Déficit Severo', class: 'stressed', color: '#ef4444' };
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
