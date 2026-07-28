/**
 * TouchControls
 * Renders and handles dual virtual joysticks for mobile & tablet touch screens.
 * Uses Pointer Events for seamless multi-touch support.
 */
export class TouchControls {
  constructor(inputMapper) {
    this.mapper = inputMapper;

    this.leftBase = document.getElementById('joystick-left-base');
    this.leftKnob = document.getElementById('joystick-left-knob');

    this.rightBase = document.getElementById('joystick-right-base');
    this.rightKnob = document.getElementById('joystick-right-knob');

    if (this.leftBase && this.rightBase) {
      this.initJoystick(this.leftBase, this.leftKnob, (x, y) => {
        // Y inverted so dragging UP gives positive +1.0 throttle
        this.mapper.setJoystickLeft(x, -y);
      });

      this.initJoystick(this.rightBase, this.rightKnob, (x, y) => {
        // Y inverted so dragging UP gives positive +1.0 pitch forward
        this.mapper.setJoystickRight(x, -y);
      });
    }
  }

  initJoystick(baseEl, knobEl, onChange) {
    let activePointerId = null;
    let baseRect = null;
    let maxRadius = 42; // Maximum knob displacement in pixels

    const onPointerDown = (e) => {
      e.preventDefault();
      activePointerId = e.pointerId;
      baseEl.setPointerCapture(e.pointerId);
      baseRect = baseEl.getBoundingClientRect();
      updateKnob(e.clientX, e.clientY);
    };

    const onPointerMove = (e) => {
      if (e.pointerId === activePointerId && baseRect) {
        e.preventDefault();
        updateKnob(e.clientX, e.clientY);
      }
    };

    const onPointerUp = (e) => {
      if (e.pointerId === activePointerId) {
        e.preventDefault();
        activePointerId = null;
        try { baseEl.releasePointerCapture(e.pointerId); } catch (err) {}
        // Reset knob to center position
        knobEl.style.transform = `translate(0px, 0px)`;
        onChange(0, 0);
      }
    };

    const updateKnob = (clientX, clientY) => {
      const centerX = baseRect.left + baseRect.width / 2;
      const centerY = baseRect.top + baseRect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      knobEl.style.transform = `translate(${dx}px, ${dy}px)`;

      // Normalized output in [-1.0, 1.0] range
      const normX = dx / maxRadius;
      const normY = dy / maxRadius;
      onChange(normX, normY);
    };

    baseEl.addEventListener('pointerdown', onPointerDown);
    baseEl.addEventListener('pointermove', onPointerMove);
    baseEl.addEventListener('pointerup', onPointerUp);
    baseEl.addEventListener('pointercancel', onPointerUp);
  }
}
