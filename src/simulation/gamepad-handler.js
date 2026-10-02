/**
 * GamepadHandler
 * Direct W3C Gamepad API driver optimized for Xbox One (Bluetooth & USB) controllers.
 * Implements Standard Drone Mode 2:
 *  - Left Stick: Throttle (Altitude Up/Down) & Yaw (Rotation Left/Right)
 *  - Right Stick: Pitch (Forward/Back) & Roll (Bank Left/Right)
 *  - Triggers (LT/RT): Precision Throttle Descent / Ascent
 *  - Action Buttons:
 *      A: Motor Ignition / Shutdown
 *      B: Return To Home (RTH)
 *      X: Toggle Spray Pump (Sprayer Drone)
 *      Y: Toggle Camera (3rd Person / FPV)
 *      LB: Toggle Aircraft Type (Multispectral <-> Sprayer)
 *      RB: Start Grid Photogrammetry Mission
 *      Start: Toggle Telemetry Log Panel
 *      Back: Reset Position to Home Helipad
 *      D-Pad (Multispectral): Up (RGB), Left (NDVI), Right (Thermal), Down (Elevation)
 *      D-Pad (Sprayer): Up (+Flow Rate), Down (-Flow Rate), Right (Refill Tank), Left (Spray Pump)
 *  - Startup Modal Navigation:
 *      Stick/D-pad Left/Right: Switch aircraft card
 *      A Button: Confirm & launch flight
 */
export class GamepadHandler {
  constructor(telemetryStore, flightModel, camera) {
    this.store = telemetryStore;
    this.flightModel = flightModel;
    this.camera = camera;

    this.deadzone = 0.10;
    this.gamepadIndex = null;
    this.connected = false;
    this.gamepadId = '';
    this.modalSelectedType = 'multispectral';

    // Normalized control outputs [-1.0, 1.0]
    this.axes = {
      throttle: 0,
      yaw: 0,
      pitch: 0,
      roll: 0
    };

    // Track previous button states for edge detection (single-press triggers)
    this.prevButtons = new Map();

    this.initListeners();
  }

  initListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('gamepadconnected', (e) => {
      console.log(`[CEAF DroneLab] Gamepad connected at index ${e.gamepad.index}: ${e.gamepad.id}`);
      this.gamepadIndex = e.gamepad.index;
      this.connected = true;
      this.gamepadId = e.gamepad.id;
      this.store.setGamepadState(true, e.gamepad.id);
      this.rumble(0.2, 0.4, 300);
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log(`[CEAF DroneLab] Gamepad disconnected: ${e.gamepad.id}`);
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
        this.connected = false;
        this.gamepadId = '';
        this.resetAxes();
        this.store.setGamepadState(false, '');
      }
    });
  }

  getGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const gamepads = navigator.getGamepads();
    if (this.gamepadIndex !== null && gamepads[this.gamepadIndex]) {
      return gamepads[this.gamepadIndex];
    }
    // Fallback: search for first connected gamepad
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        if (!this.connected) {
          this.gamepadIndex = i;
          this.connected = true;
          this.gamepadId = gamepads[i].id;
          this.store.setGamepadState(true, gamepads[i].id);
        }
        return gamepads[i];
      }
    }
    return null;
  }

  applyDeadzone(val, threshold = this.deadzone) {
    if (Math.abs(val) < threshold) return 0.0;
    const sign = Math.sign(val);
    return sign * ((Math.abs(val) - threshold) / (1.0 - threshold));
  }

  rumble(weakMagnitude = 0.3, strongMagnitude = 0.3, duration = 200) {
    const gp = this.getGamepad();
    if (gp && gp.vibrationActuator && typeof gp.vibrationActuator.playEffect === 'function') {
      try {
        gp.vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration,
          weakMagnitude,
          strongMagnitude
        }).catch(() => {});
      } catch (err) {}
    }
  }

  resetAxes() {
    this.axes.throttle = 0;
    this.axes.yaw = 0;
    this.axes.pitch = 0;
    this.axes.roll = 0;
  }

  update() {
    const gp = this.getGamepad();
    if (!gp) {
      if (this.connected) {
        this.connected = false;
        this.resetAxes();
        this.store.setGamepadState(false, '');
      }
      return this.axes;
    }

    if (!this.connected) {
      this.connected = true;
      this.gamepadId = gp.id;
      this.store.setGamepadState(true, gp.id);
    }

    // --- 1. Mode 2 Sticks Mapping ---
    // Left Stick X (axes[0]) -> Yaw (Turn Left/Right)
    const rawYaw = gp.axes.length > 0 ? gp.axes[0] : 0;
    const yaw = this.applyDeadzone(rawYaw);

    // Left Stick Y (axes[1]) -> Throttle (Ascend / Descend). Standard: UP is -1.0, so invert it
    const rawThrottleStick = gp.axes.length > 1 ? -gp.axes[1] : 0;
    let throttle = this.applyDeadzone(rawThrottleStick);

    // Right Stick X (axes[2]) -> Roll (Bank Left/Right)
    const rawRoll = gp.axes.length > 2 ? gp.axes[2] : 0;
    const roll = this.applyDeadzone(rawRoll);

    // Right Stick Y (axes[3]) -> Pitch (Forward / Backward). Standard: UP is -1.0, so invert it
    const rawPitch = gp.axes.length > 3 ? -gp.axes[3] : 0;
    const pitch = this.applyDeadzone(rawPitch);

    // --- 2. Analog Triggers (LT: buttons[6], RT: buttons[7]) ---
    const lt = gp.buttons.length > 6 ? (typeof gp.buttons[6] === 'object' ? gp.buttons[6].value : gp.buttons[6]) : 0;
    const rt = gp.buttons.length > 7 ? (typeof gp.buttons[7] === 'object' ? gp.buttons[7].value : gp.buttons[7]) : 0;

    if (rt > 0.05) {
      throttle = Math.min(1.0, throttle + rt * 0.85);
    }
    if (lt > 0.05) {
      throttle = Math.max(-1.0, throttle - lt * 0.85);
    }

    this.axes.throttle = throttle;
    this.axes.yaw = yaw;
    this.axes.pitch = pitch;
    this.axes.roll = roll;

    // --- 3. Action Buttons with Edge Detection ---
    this.handleButtons(gp);

    return this.axes;
  }

  isButtonPressed(gp, index) {
    if (!gp.buttons || !gp.buttons[index]) return false;
    const btn = gp.buttons[index];
    return typeof btn === 'object' ? btn.pressed : btn > 0.5;
  }

  handleButtons(gp) {
    const checkEdge = (idx) => {
      const pressed = this.isButtonPressed(gp, idx);
      const wasPressed = this.prevButtons.get(idx) || false;
      this.prevButtons.set(idx, pressed);
      return pressed && !wasPressed; // Edge trigger
    };

    // --- Check if Startup Modal is Active ---
    const modal = document.getElementById('drone-selector-modal');
    const isModalOpen = modal && (modal.classList.contains('active') || modal.style.display === 'flex');

    if (isModalOpen) {
      const cardM = document.getElementById('card-select-multispectral');
      const cardS = document.getElementById('card-select-sprayer');

      // Stick or D-Pad Left: Select Multispectral
      const rawLeft = (gp.axes.length > 0 && gp.axes[0] < -0.5) || checkEdge(14);
      if (rawLeft) {
        this.modalSelectedType = 'multispectral';
        if (cardM) cardM.classList.add('active');
        if (cardS) cardS.classList.remove('active');
        this.rumble(0.1, 0.2, 100);
      }

      // Stick or D-Pad Right: Select Sprayer
      const rawRight = (gp.axes.length > 0 && gp.axes[0] > 0.5) || checkEdge(15);
      if (rawRight) {
        this.modalSelectedType = 'sprayer';
        if (cardS) cardS.classList.add('active');
        if (cardM) cardM.classList.remove('active');
        this.rumble(0.1, 0.2, 100);
      }

      // Button 0 (A): Confirm and launch
      if (checkEdge(0)) {
        if (typeof window.selectDrone === 'function') {
          window.selectDrone(this.modalSelectedType || 'multispectral');
        } else {
          this.store.setDroneType(this.modalSelectedType || 'multispectral');
          modal.classList.remove('active');
          modal.style.display = 'none';
        }
        this.rumble(0.3, 0.5, 200);
      }
      return; // Do not trigger flight commands while selecting drone in modal
    }

    // --- Check if Post-Mission Report Modal is Active ---
    const reportModal = document.getElementById('acquisition-modal');
    const isReportOpen = reportModal && reportModal.classList.contains('active');
    if (isReportOpen) {
      if (checkEdge(0) || checkEdge(1)) { // A or B button closes report
        reportModal.classList.remove('active');
        this.rumble(0.2, 0.2, 150);
      }
      return;
    }

    const currentDroneType = this.store.getDroneType();

    // Button 0 (A): Toggle Motor Power
    if (checkEdge(0)) {
      if (this.flightModel) {
        this.flightModel.toggleMotorPower();
        this.rumble(0.3, 0.5, 250);
      }
    }

    // Button 1 (B): Return To Home (RTH)
    if (checkEdge(1)) {
      if (this.flightModel) {
        this.flightModel.startRTH();
        this.rumble(0.2, 0.4, 200);
      }
    }

    // Button 2 (X): Toggle Spray Pump (Dron de Aspersión)
    if (checkEdge(2)) {
      if (currentDroneType === 'sprayer') {
        this.store.toggleSprayPump();
        this.rumble(0.4, 0.2, 180);
      }
    }

    // Button 3 (Y): Toggle Camera View (3ª Persona / FPV)
    if (checkEdge(3)) {
      if (this.camera) {
        const mode = this.camera.toggleMode();
        this.store.notify('cameraModeChange', mode);
      }
    }

    // Button 4 (LB): Toggle Aircraft Type (Multiespectral <-> Aspersión)
    if (checkEdge(4)) {
      const nextType = currentDroneType === 'multispectral' ? 'sprayer' : 'multispectral';
      this.store.setDroneType(nextType);
      this.rumble(0.2, 0.3, 150);
    }

    // Button 5 (RB): Toggle Autonomous Grid Mission
    if (checkEdge(5)) {
      if (this.flightModel) {
        this.flightModel.startGridMission();
        this.rumble(0.3, 0.3, 200);
      }
    }

    // Button 8 (Back / View): Reset Position to Home
    if (checkEdge(8)) {
      if (this.flightModel) {
        this.flightModel.resetPosition();
        this.rumble(0.5, 0.5, 300);
      }
    }

    // Button 9 (Start / Menu): Toggle Telemetry Panel
    if (checkEdge(9)) {
      this.store.notify('toggleDashboard');
    }

    // --- D-Pad Controls: Context-aware by Drone Type ---
    if (currentDroneType === 'sprayer') {
      // Sprayer Drone: D-Pad controls spraying parameters
      // D-Pad Up (12): Increase Flow Rate (+0.5 L/min)
      if (checkEdge(12)) {
        const currentRate = this.store.getFlowRate();
        this.store.setFlowRate(Math.min(12.0, currentRate + 0.5));
        this.rumble(0.1, 0.2, 100);
      }
      // D-Pad Down (13): Decrease Flow Rate (-0.5 L/min)
      if (checkEdge(13)) {
        const currentRate = this.store.getFlowRate();
        this.store.setFlowRate(Math.max(1.0, currentRate - 0.5));
        this.rumble(0.1, 0.2, 100);
      }
      // D-Pad Left (14): Toggle Spray Pump
      if (checkEdge(14)) {
        this.store.toggleSprayPump();
        this.rumble(0.3, 0.2, 150);
      }
      // D-Pad Right (15): Refill Liquid Tank
      if (checkEdge(15)) {
        this.store.refillTank();
        this.rumble(0.4, 0.4, 250);
      }
    } else {
      // Multispectral Drone: D-Pad controls optical & thermal sensors
      // D-Pad Up (12): RGB Natural
      if (checkEdge(12)) {
        this.store.setSensorMode('rgb');
        this.rumble(0.1, 0.2, 100);
      }
      // D-Pad Left (14): NDVI
      if (checkEdge(14)) {
        this.store.setSensorMode('ndvi');
        this.rumble(0.1, 0.2, 100);
      }
      // D-Pad Right (15): Thermal IR
      if (checkEdge(15)) {
        this.store.setSensorMode('thermal');
        this.rumble(0.1, 0.2, 100);
      }
      // D-Pad Down (13): Elevation LiDAR
      if (checkEdge(13)) {
        this.store.setSensorMode('elevation');
        this.rumble(0.1, 0.2, 100);
      }
    }
  }
}
