/**
 * Dashboard
 * Manages the Telemetry Log side panel, live sample table, and real-time NDVI/Spectral Canvas Chart.
 */
export class Dashboard {
  constructor(telemetryStore) {
    this.store = telemetryStore;

    this.panelEl = document.getElementById('dashboard-panel');
    this.toggleBtn = document.getElementById('toggle-dashboard-btn');
    this.closeBtn = document.getElementById('close-dashboard-btn');

    this.tableBodyEl = document.getElementById('telemetry-log-tbody');
    this.countBadgeEl = document.getElementById('log-count-badge');
    this.chartCanvas = document.getElementById('ndvi-chart-canvas');

    if (this.chartCanvas) {
      this.ctx = this.chartCanvas.getContext('2d');
    }

    this.isOpen = false;
    this.initUI();
    this.initSubscriptions();
  }

  initUI() {
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggle());
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    // Keyboard shortcut 'T' to toggle telemetry panel (avoiding conflict with 'D' roll)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyT' && !e.repeat) {
        this.toggle();
      }
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.panelEl.classList.add('open');
      this.renderChart();
    } else {
      this.panelEl.classList.remove('open');
    }
  }

  close() {
    this.isOpen = false;
    this.panelEl.classList.remove('open');
  }

  initSubscriptions() {
    this.store.on('logAdded', (newEntry) => {
      this.addTableRow(newEntry);
      if (this.isOpen) {
        this.renderChart();
      }
    });

    this.store.on('sensorModeChange', () => {
      if (this.isOpen) {
        this.renderChart();
      }
    });
  }

  addTableRow(entry) {
    if (!this.tableBodyEl || !entry) return;

    const emptyRow = this.tableBodyEl.querySelector('.empty-row');
    if (emptyRow) {
      emptyRow.remove();
    }

    const posStr = Array.isArray(entry.position) ? `(${entry.position[0]}, ${entry.position[1]})` : '-';
    const timestamp = entry.timestamp || new Date().toLocaleTimeString('es-CL');
    const displayVal = entry.displayValue || entry.message || '-';
    const color = entry.color || '#38bdf8';
    const status = entry.status || 'INFO';
    const statusClass = entry.statusClass || 'badge-cyan';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${timestamp}</td>
      <td>${posStr}</td>
      <td style="color:${color}; font-weight:700;">${displayVal}</td>
      <td class="badge-cell"><span class="badge ${statusClass}">${status}</span></td>
    `;

    this.tableBodyEl.insertBefore(tr, this.tableBodyEl.firstChild);

    if (this.tableBodyEl.children.length > 50) {
      this.tableBodyEl.removeChild(this.tableBodyEl.lastChild);
    }

    const totalLogs = this.store.getSensorLogs().length;
    if (this.countBadgeEl) {
      this.countBadgeEl.innerText = `${totalLogs} entries`;
    }
  }

  renderChart() {
    if (!this.ctx || !this.chartCanvas) return;

    const ctx = this.ctx;
    const width = this.chartCanvas.width;
    const height = this.chartCanvas.height;
    const logs = this.store.getSensorLogs();
    const mode = this.store.getSensorMode();

    ctx.clearRect(0, 0, width, height);

    const padL = 28, padR = 10, padT = 15, padB = 20;
    const graphW = width - padL - padR;
    const graphH = height - padT - padB;

    // Threshold lines at 0.40 (Stressed) and 0.65 (Healthy)
    const y040 = padT + graphH * (1 - 0.40);
    const y065 = padT + graphH * (1 - 0.65);

    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fillRect(padL, y040, graphW, padT + graphH - y040);

    ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
    ctx.fillRect(padL, padT, graphW, y065 - padT);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    [0.2, 0.4, 0.6, 0.8].forEach(val => {
      const y = padT + graphH * (1 - val);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + graphW, y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(val.toFixed(1), 4, y + 3);
    });

    ctx.setLineDash([]);

    if (logs.length < 2) return;

    const maxPoints = 40;
    const recentLogs = logs.slice(-maxPoints);
    const stepX = graphW / (maxPoints - 1);

    ctx.beginPath();
    recentLogs.forEach((log, idx) => {
      const x = padL + idx * stepX;
      // Normalize value to [0, 1] range for chart display
      let normVal = log.ndvi;
      if (mode === 'thermal') {
        normVal = Math.max(0, Math.min(1, (log.temperatureC - 20) / 25));
      } else if (mode === 'elevation') {
        const chm = log.canopyHeightM !== undefined ? log.canopyHeightM : (log.elevationM || 0);
        normVal = Math.max(0, Math.min(1, chm / 5.5));
      }
      const y = padT + graphH * (1 - Math.max(0, Math.min(1, normVal)));
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    const lineGrad = ctx.createLinearGradient(padL, 0, padL + graphW, 0);
    lineGrad.addColorStop(0, '#38bdf8');
    lineGrad.addColorStop(1, '#22c55e');

    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const lastIdx = recentLogs.length - 1;
    const lastX = padL + lastIdx * stepX;
    ctx.lineTo(lastX, padT + graphH);
    ctx.lineTo(padL, padT + graphH);
    ctx.closePath();

    const fillGrad = ctx.createLinearGradient(0, padT, 0, padT + graphH);
    fillGrad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
    fillGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    const latestLog = recentLogs[lastIdx];
    let normVal = latestLog.ndvi;
    if (mode === 'thermal') {
      normVal = Math.max(0, Math.min(1, (latestLog.temperatureC - 20) / 25));
    } else if (mode === 'elevation') {
      const chm = latestLog.canopyHeightM !== undefined ? latestLog.canopyHeightM : (latestLog.elevationM || 0);
      normVal = Math.max(0, Math.min(1, chm / 5.5));
    }
    const latestY = padT + graphH * (1 - Math.max(0, Math.min(1, normVal)));

    ctx.beginPath();
    ctx.arc(lastX, latestY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = latestLog.color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
