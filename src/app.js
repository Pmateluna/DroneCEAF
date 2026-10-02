import { telemetryStore } from './data/telemetry-store.js';
import { FieldGenerator } from './simulation/field-generator.js';
import { FlightModel } from './simulation/flight-model.js';
import { SensorSampler } from './simulation/sensor.js';
import { InputMapper } from './simulation/input-mapper.js';
import { Renderer } from './engine/renderer.js';
import { TouchControls } from './ui/controls.js';
import { HUD } from './ui/hud.js';
import { Dashboard } from './ui/dashboard.js';

/**
 * CEAF DroneLab Chile - Application Bootstrapper
 */
class App {
  constructor() {
    this.lastTime = performance.now();
    this.bootSequence();
  }

  updateBootUI(pct, message, stepStates = {}) {
    const fillEl = document.getElementById('boot-progress-fill');
    const pctEl = document.getElementById('boot-progress-pct');
    const stageEl = document.getElementById('boot-stage-text');

    if (fillEl) fillEl.style.width = `${pct}%`;
    if (pctEl) pctEl.innerText = `${Math.round(pct)}%`;
    if (stageEl && message) stageEl.innerText = message;

    const stepMap = {
      terrain: 'boot-step-terrain',
      engine: 'boot-step-engine',
      drones: 'boot-step-drones',
      trees: 'boot-step-trees'
    };

    for (const [key, state] of Object.entries(stepStates)) {
      const el = document.getElementById(stepMap[key]);
      if (el) {
        el.classList.remove('active', 'done');
        if (state === 'active' || state === 'done') {
          el.classList.add(state);
        }
      }
    }
  }

  hideBootOverlay() {
    const overlay = document.getElementById('boot-loader-overlay');
    if (overlay && !overlay.classList.contains('hidden')) {
      overlay.classList.add('hidden');
      setTimeout(() => {
        if (overlay.parentNode) overlay.style.display = 'none';
      }, 600);
    }
  }

  nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 16)));
  }

  async bootSequence() {
    try {
      this.updateBootUI(14, 'Generando topografía aluvial 3D, camellones y radiometría NDVI...', {
        terrain: 'active'
      });
      await this.nextFrame();

      // 1. Initialize Simulation Data & Models
      this.field = new FieldGenerator(200, 200, 80);
      this.flightModel = new FlightModel(telemetryStore, this.field);
      this.sensor = new SensorSampler(telemetryStore, this.field, 500);

      this.updateBootUI(36, 'Inicializando motor Babylon.js 9 WebGL2, sombras 2K e iluminación IBL...', {
        terrain: 'done',
        engine: 'active'
      });
      await this.nextFrame();

      // 2. Initialize WebGL2 Engine
      this.renderer = new Renderer('webgl-canvas', telemetryStore, this.field);

      // Track async 3D GLB assets (Multispectral Drone, Sprayer Drone, 390 Thin-Instance Trees)
      let loadedCount = 0;
      const onAssetLoaded = (assetId) => {
        loadedCount++;
        if (assetId === 'drone_multi' || assetId === 'drone_sprayer') {
          const pct = Math.min(92, 55 + loadedCount * 14);
          this.updateBootUI(pct, 'Cargando aeronaves 3D (.glb) y calibrando rotores...', {
            terrain: 'done',
            engine: 'done',
            drones: loadedCount >= 2 ? 'done' : 'active',
            trees: 'active'
          });
        } else if (assetId === 'trees_glb') {
          const pct = Math.min(96, 55 + loadedCount * 14);
          this.updateBootUI(pct, 'Instanciando 390 árboles frutales 3D (Thin Instances) y nube LiDAR...', {
            terrain: 'done',
            engine: 'done',
            drones: loadedCount >= 3 ? 'done' : 'active',
            trees: 'done'
          });
        }
      };
      this.renderer.onAssetProgress = onAssetLoaded;

      this.updateBootUI(55, 'Configurando telemetría HUD, cámara Nadir PiP y estación QGIS...', {
        terrain: 'done',
        engine: 'done',
        drones: 'active',
        trees: 'active'
      });
      await this.nextFrame();

      // 3. Initialize Input Mapper with Camera reference
      this.inputMapper = new InputMapper(telemetryStore, this.flightModel, this.renderer.camera);

      // 4. Initialize UI Components
      this.controls = new TouchControls(this.inputMapper);
      this.hud = new HUD(telemetryStore, this.flightModel, this.renderer.camera, this.field);
      this.dashboard = new Dashboard(telemetryStore);

      // 5. Start Sensor Sampling & Native Babylon.js Render Loop
      this.sensor.start();
      this.lastTime = performance.now();
      this.renderer.engine.runRenderLoop(() => {
        this.tick(performance.now());
      });

      // Wait for 3D GLB assets (or max 3.5s fallback) before dismissing the loading screen
      const glbPromises = [
        this.renderer._multispectralPromise,
        this.renderer._sprayerPromise,
        this.renderer._treesPromise
      ].filter(Boolean);

      await Promise.race([
        Promise.allSettled(glbPromises),
        new Promise((resolve) => setTimeout(resolve, 3500))
      ]);

      this.updateBootUI(100, '¡Sistemas aeronáuticos y sensores listos!', {
        terrain: 'done',
        engine: 'done',
        drones: 'done',
        trees: 'done'
      });

      setTimeout(() => this.hideBootOverlay(), 260);
      console.log('[CEAF DroneLab Chile] Simulator initialized successfully.');
    } catch (err) {
      console.error('[CEAF DroneLab Chile] Boot error:', err);
      this.hideBootOverlay();
    }
  }

  tick(currentTime) {
    const rawDeltaMs = currentTime - this.lastTime;
    this.lastTime = currentTime;
    const dt = Math.min(0.1, Math.max(0.001, rawDeltaMs / 1000));

    // Use Babylon's native smoothed FPS counter (updated inside runRenderLoop -> beginFrame)
    telemetryStore.currentFps = Math.round(this.renderer.engine.getFps());

    // Poll Gamepad & process inputs
    this.inputMapper.update(dt);

    // Step physics & update telemetry position
    this.flightModel.update(dt);

    // Render WebGL2 3D frame
    this.renderer.render(dt);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});

