/**
 * GLContext
 * Initializes raw WebGL2 context and handles viewport resizing.
 */
export class GLContext {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas element #${canvasId} not found.`);
    }

    this.gl = this.canvas.getContext('webgl2', {
      antialias: true,
      depth: true,
      alpha: false
    });

    if (!this.gl) {
      throw new Error('WebGL2 is not supported on this device/browser.');
    }

    this.setupState();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  setupState() {
    const gl = this.gl;
    // Warm Chilean atmospheric horizon clear color (eliminates black background voids)
    gl.clearColor(0.78, 0.68, 0.55, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  handleResize() {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.aspectRatio = width / height;
  }

  clear() {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
}
