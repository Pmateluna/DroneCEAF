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

    // 1. Initialize Simulation Data & Models
    this.field = new FieldGenerator(200, 200, 80);
    this.flightModel = new FlightModel(telemetryStore);
    this.sensor = new SensorSampler(telemetryStore, this.field, 500);

    // 2. Initialize WebGL2 Engine (Zero UI imports)
    this.renderer = new Renderer('webgl-canvas', telemetryStore, this.field);

    // 3. Initialize Input Mapper with Camera reference
    this.inputMapper = new InputMapper(telemetryStore, this.flightModel, this.renderer.camera);

    // 4. Initialize UI Components (Zero Engine imports)
    this.controls = new TouchControls(this.inputMapper);
    this.hud = new HUD(telemetryStore, this.flightModel, this.renderer.camera);
    this.dashboard = new Dashboard(telemetryStore);

    // 5. Start Sensor Sampling & Render Loop
    this.sensor.start();
    requestAnimationFrame((t) => this.tick(t));
  }

  tick(currentTime) {
    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    // Step physics & update telemetry position
    this.flightModel.update(dt);

    // Render WebGL2 3D frame
    this.renderer.render(dt);

    requestAnimationFrame((t) => this.tick(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    window.app = new App();
    console.log('[CEAF DroneLab Chile] Simulator initialized successfully.');
  } catch (err) {
    console.error('[CEAF DroneLab Chile] Boot error:', err);
  }
});
