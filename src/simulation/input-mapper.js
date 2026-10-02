import { GamepadHandler } from './gamepad-handler.js';

/**
 * InputMapper
 * Captures keyboard states, touch joystick signals, and Xbox One Bluetooth Gamepad inputs,
 * translating them into normalized [-1.0, 1.0] TelemetryStore control axes.
 * Handles hotkeys and controller shortcuts for multispectral views (1-4), Grid Scan Mission, Return-To-Home, Camera Mode, and Motor Power.
 */
export class InputMapper {
  constructor(telemetryStore, flightModel, camera) {
    this.store = telemetryStore;
    this.flightModel = flightModel;
    this.camera = camera;

    this.keys = {
      KeyW: false, KeyS: false, KeyA: false, KeyD: false,
      ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
    };

    this.joystickState = {
      left: { x: 0, y: 0 },
      right: { x: 0, y: 0 }
    };

    // Initialize Xbox One Gamepad Driver
    this.gamepadHandler = new GamepadHandler(telemetryStore, flightModel, camera);

    this.initKeyboardListeners();
  }

  initKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.code in this.keys) {
        this.keys[e.code] = true;
        this.processInputs();
      } else if (e.code === 'KeyE' && this.flightModel) {
        this.flightModel.toggleMotorPower();
      } else if (e.code === 'Space') {
        this.store.toggleSprayPump();
      } else if (e.code === 'KeyR' && this.flightModel) {
        this.flightModel.resetPosition();
      } else if (e.code === 'KeyM' && this.flightModel) {
        this.flightModel.startGridMission();
      } else if (e.code === 'KeyG' && this.flightModel && this.flightModel.field) {
        this.flightModel.field.regenerateRandomField();
        this.store.notifyFieldRegenerated();
        if (this.store.getFlightMode() === 'auto_grid') {
          this.flightModel.startGridMission();
        }
      } else if (e.code === 'KeyH' && this.flightModel) {
        this.flightModel.startRTH();
      } else if (e.code === 'KeyC' && this.camera) {
        const mode = this.camera.toggleMode();
        this.store.notify('cameraModeChange', mode);
      } else if (e.code === 'KeyQ') {
        const btnGis = document.getElementById('btn-open-gis');
        if (btnGis) btnGis.click();
      } else if (e.code === 'KeyV') {
        const btnPipMin = document.getElementById('btn-pip-minimize');
        if (btnPipMin) btnPipMin.click();
      } else if (e.code === 'Digit1') {
        this.store.setSensorMode('rgb');
      } else if (e.code === 'Digit2') {
        this.store.setSensorMode('ndvi');
      } else if (e.code === 'Digit3') {
        this.store.setSensorMode('thermal');
      } else if (e.code === 'Digit4') {
        this.store.setSensorMode('elevation');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code in this.keys) {
        this.keys[e.code] = false;
        this.processInputs();
      }
    });
  }

  setJoystickLeft(x, y) {
    this.joystickState.left.x = x;
    this.joystickState.left.y = y;
    this.processInputs();
  }

  setJoystickRight(x, y) {
    this.joystickState.right.x = x;
    this.joystickState.right.y = y;
    this.processInputs();
  }

  update(dt) {
    if (this.gamepadHandler) {
      this.gamepadHandler.update();
      this.processInputs();
    }
  }

  processInputs() {
    let kbThrottle = 0;
    if (this.keys.ArrowUp) kbThrottle += 1.0;
    if (this.keys.ArrowDown) kbThrottle -= 1.0;

    let kbYaw = 0;
    if (this.keys.ArrowRight) kbYaw += 1.0;
    if (this.keys.ArrowLeft) kbYaw -= 1.0;

    let kbPitch = 0;
    if (this.keys.KeyW) kbPitch += 1.0;
    if (this.keys.KeyS) kbPitch -= 1.0;

    let kbRoll = 0;
    if (this.keys.KeyD) kbRoll += 1.0;
    if (this.keys.KeyA) kbRoll -= 1.0;

    const gp = this.gamepadHandler ? this.gamepadHandler.axes : { throttle: 0, yaw: 0, pitch: 0, roll: 0 };

    const throttle = Math.max(-1.0, Math.min(1.0, this.joystickState.left.y + kbThrottle + gp.throttle));
    const yaw = Math.max(-1.0, Math.min(1.0, this.joystickState.left.x + kbYaw + gp.yaw));
    const pitch = Math.max(-1.0, Math.min(1.0, this.joystickState.right.y + kbPitch + gp.pitch));
    const roll = Math.max(-1.0, Math.min(1.0, this.joystickState.right.x + kbRoll + gp.roll));

    this.store.setInputs({ throttle, yaw, pitch, roll });
  }
}
