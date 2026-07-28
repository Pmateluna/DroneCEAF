/**
 * MeshLoader
 * Procedural geometry generators for Sky Dome, Continuous 3D Andes Mountain Cordillera, Terrain Grid, 3D Orchard Fruit Trees, Drone Body, Spin Propellers, and Sensor Scanning Cone.
 */
export class MeshLoader {
  /**
   * Builds Sky Dome Inverted Sphere VAO (Radius ~600m)
   */
  static createSkyDomeVAO(gl) {
    const positions = [];
    const indices = [];

    const stacks = 20;
    const slices = 40;
    const radius = 600;

    for (let i = 0; i <= stacks; i++) {
      const phi = (i / stacks) * Math.PI * 0.5;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      for (let j = 0; j <= slices; j++) {
        const theta = (j / slices) * Math.PI * 2;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        const x = radius * sinPhi * cosTheta;
        const y = radius * cosPhi;
        const z = radius * sinPhi * sinTheta;

        positions.push(x, y, z);
      }
    }

    for (let i = 0; i < stacks; i++) {
      for (let j = 0; j < slices; j++) {
        const first = i * (slices + 1) + j;
        const second = first + slices + 1;

        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    addVBO(gl, 0, new Float32Array(positions), 3);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return {
      vao,
      indexCount: indices.length
    };
  }

  /**
   * Builds Continuous 3D Andes Mountains Cordillera Mesh (Multi-octave noise heightmap belt)
   */
  static createAndesMountainsVAO(gl) {
    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];

    const azimuthSteps = 96;  // 96 slices around the horizon
    const radialSteps = 16;   // 16 concentric rings extending back
    const innerRadius = 140; // Starts right outside orchard
    const outerRadius = 550; // Extends into far horizon sky

    // Function to calculate multi-octave Andes Mountain elevation
    function getAndesHeight(angle, rNorm) {
      // Primary Andes ridge mountain chain
      const h1 = Math.sin(angle * 3.0) * 55.0;
      const h2 = Math.cos(angle * 7.0 + 0.8) * 32.0;
      const h3 = Math.sin(angle * 15.0 + 1.5) * 18.0;
      const h4 = Math.cos(angle * 29.0) * 8.0;

      let baseH = Math.max(0.0, h1 + h2 + h3 + h4 + 35.0);

      // Radial profile: rises from ground at inner radius to peak, then slopes down
      const radialProfile = Math.sin(rNorm * Math.PI);
      return baseH * radialProfile;
    }

    // Build grid vertices
    for (let r = 0; r <= radialSteps; r++) {
      const rNorm = r / radialSteps;
      const radius = innerRadius + rNorm * (outerRadius - innerRadius);

      for (let a = 0; a <= azimuthSteps; a++) {
        const aNorm = a / azimuthSteps;
        const angle = aNorm * Math.PI * 2;

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = getAndesHeight(angle, rNorm);

        positions.push(x, y, z);

        // Approximate smooth surface normals
        const deltaAngle = 0.05;
        const yL = getAndesHeight(angle - deltaAngle, rNorm);
        const yR = getAndesHeight(angle + deltaAngle, rNorm);
        const yF = getAndesHeight(angle, Math.min(1.0, rNorm + 0.05));
        const yB = getAndesHeight(angle, Math.max(0.0, rNorm - 0.05));

        const dx = (yR - yL) * 2.0;
        const dz = (yF - yB) * 2.0;
        const norm = normalizeVec3([-dx, 4.0, -dz]);
        normals.push(norm[0], norm[1], norm[2]);

        // Color mapping: Granite base -> Slate stone -> Snow caps
        let color;
        if (y > 46.0) {
          const snowT = Math.min(1.0, (y - 46.0) / 24.0);
          color = [
            0.35 + snowT * 0.61, // R: 0.35 -> 0.96
            0.38 + snowT * 0.60, // G: 0.38 -> 0.98
            0.42 + snowT * 0.58  // B: 0.42 -> 1.00 (Pure Andes Snow)
          ];
        } else if (y > 22.0) {
          const stoneT = (y - 22.0) / 24.0;
          color = [
            0.32 + stoneT * 0.12,
            0.35 + stoneT * 0.12,
            0.38 + stoneT * 0.12
          ]; // Slate stone ridge
        } else {
          color = [0.38, 0.34, 0.28]; // Foothills dry granite soil
        }

        colors.push(color[0], color[1], color[2]);
      }
    }

    // Generate indexed quads for mountain mesh ring
    for (let r = 0; r < radialSteps; r++) {
      for (let a = 0; a < azimuthSteps; a++) {
        const i0 = r * (azimuthSteps + 1) + a;
        const i1 = r * (azimuthSteps + 1) + (a + 1);
        const i2 = (r + 1) * (azimuthSteps + 1) + a;
        const i3 = (r + 1) * (azimuthSteps + 1) + (a + 1);

        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    addVBO(gl, 0, new Float32Array(positions), 3);
    addVBO(gl, 1, new Float32Array(normals), 3);
    addVBO(gl, 2, new Float32Array(colors), 3);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return {
      vao,
      indexCount: indices.length
    };
  }

  /**
   * Builds 3D Fruit Tree Orchard Mesh
   */
  static createOrchardTreesVAO(gl, fieldGrid) {
    const rows = fieldGrid.length;
    const cols = fieldGrid[0].length;

    const positions = [];
    const normals = [];
    const colorsRGB = [];
    const colorsNDVI = [];
    const colorsThermal = [];
    const colorsElevation = [];
    const indices = [];

    let vertexOffset = 0;
    const trunkColor = [0.45, 0.30, 0.18];

    function addTreeBox(cx, cy, cz, sx, sy, sz, normVec, spectralColors) {
      const hx = sx / 2, hy = sy / 2, hz = sz / 2;
      const boxVerts = [
        { pos: [cx - hx, cy - hy, cz + hz], norm: [0, 0, 1] },
        { pos: [cx + hx, cy - hy, cz + hz], norm: [0, 0, 1] },
        { pos: [cx + hx, cy + hy, cz + hz], norm: [0, 0, 1] },
        { pos: [cx - hx, cy + hy, cz + hz], norm: [0, 0, 1] },
        { pos: [cx + hx, cy - hy, cz - hz], norm: [0, 0, -1] },
        { pos: [cx - hx, cy - hy, cz - hz], norm: [0, 0, -1] },
        { pos: [cx - hx, cy + hy, cz - hz], norm: [0, 0, -1] },
        { pos: [cx + hx, cy + hy, cz - hz], norm: [0, 0, -1] },
        { pos: [cx - hx, cy + hy, cz + hz], norm: [0, 1, 0] },
        { pos: [cx + hx, cy + hy, cz + hz], norm: [0, 1, 0] },
        { pos: [cx + hx, cy + hy, cz - hz], norm: [0, 1, 0] },
        { pos: [cx - hx, cy + hy, cz - hz], norm: [0, 1, 0] },
        { pos: [cx - hx, cy - hy, cz - hz], norm: [0, -1, 0] },
        { pos: [cx + hx, cy - hy, cz - hz], norm: [0, -1, 0] },
        { pos: [cx + hx, cy - hy, cz + hz], norm: [0, -1, 0] },
        { pos: [cx - hx, cy - hy, cz + hz], norm: [0, -1, 0] },
        { pos: [cx + hx, cy - hy, cz + hz], norm: [1, 0, 0] },
        { pos: [cx + hx, cy - hy, cz - hz], norm: [1, 0, 0] },
        { pos: [cx + hx, cy + hy, cz - hz], norm: [1, 0, 0] },
        { pos: [cx + hx, cy + hy, cz + hz], norm: [1, 0, 0] },
        { pos: [cx - hx, cy - hy, cz - hz], norm: [-1, 0, 0] },
        { pos: [cx - hx, cy - hy, cz + hz], norm: [-1, 0, 0] },
        { pos: [cx - hx, cy + hy, cz + hz], norm: [-1, 0, 0] },
        { pos: [cx - hx, cy + hy, cz - hz], norm: [-1, 0, 0] }
      ];

      for (let i = 0; i < boxVerts.length; i++) {
        positions.push(...boxVerts[i].pos);
        normals.push(...boxVerts[i].norm);

        colorsRGB.push(...spectralColors.rgb);
        colorsNDVI.push(...spectralColors.ndvi);
        colorsThermal.push(...spectralColors.thermal);
        colorsElevation.push(...spectralColors.elevation);
      }

      for (let f = 0; f < 6; f++) {
        const base = vertexOffset + f * 4;
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }

      vertexOffset += 24;
    }

    for (let r = 3; r < rows - 3; r += 3) {
      for (let c = 3; c < cols - 3; c += 3) {
        const cell = fieldGrid[r][c];

        if (Math.abs(cell.x) < 4.0 || Math.abs(cell.z) < 4.0) continue;

        const tx = cell.x;
        const ty = cell.y;
        const tz = cell.z;

        const specTrunk = {
          rgb: trunkColor, ndvi: trunkColor, thermal: trunkColor, elevation: trunkColor
        };

        const specFoliage = {
          rgb: cell.rgbColor,
          ndvi: cell.ndviColor,
          thermal: cell.thermalColor,
          elevation: cell.elevationColor
        };

        addTreeBox(tx, ty + 0.8, tz, 0.4, 1.6, 0.4, [0, 1, 0], specTrunk);
        addTreeBox(tx, ty + 2.0, tz, 2.2, 1.4, 2.2, [0, 1, 0], specFoliage);
        addTreeBox(tx, ty + 3.0, tz, 1.5, 1.0, 1.5, [0, 1, 0], specFoliage);
      }
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    addVBO(gl, 0, new Float32Array(positions), 3);
    addVBO(gl, 1, new Float32Array(normals), 3);
    addVBO(gl, 2, new Float32Array(colorsRGB), 3);
    addVBO(gl, 3, new Float32Array(colorsNDVI), 3);
    addVBO(gl, 4, new Float32Array(colorsThermal), 3);
    addVBO(gl, 5, new Float32Array(colorsElevation), 3);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return {
      vao,
      indexCount: indices.length
    };
  }

  /**
   * Builds Terrain Grid VAO
   */
  static createTerrainVAO(gl, fieldGrid) {
    const rows = fieldGrid.length;
    const cols = fieldGrid[0].length;

    const positions = [];
    const normals = [];
    const colorsRGB = [];
    const colorsNDVI = [];
    const colorsThermal = [];
    const colorsElevation = [];
    const indices = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = fieldGrid[r][c];
        positions.push(cell.x, cell.y, cell.z);

        colorsRGB.push(...cell.rgbColor);
        colorsNDVI.push(...cell.ndviColor);
        colorsThermal.push(...cell.thermalColor);
        colorsElevation.push(...cell.elevationColor);

        const dx = (c < cols - 1 ? fieldGrid[r][c + 1].y : cell.y) - (c > 0 ? fieldGrid[r][c - 1].y : cell.y);
        const dz = (r < rows - 1 ? fieldGrid[r + 1][c].y : cell.y) - (r > 0 ? fieldGrid[r - 1][c].y : cell.y);
        const norm = normalizeVec3([-dx, 2.0, -dz]);
        normals.push(norm[0], norm[1], norm[2]);
      }
    }

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const i0 = r * cols + c;
        const i1 = r * cols + (c + 1);
        const i2 = (r + 1) * cols + c;
        const i3 = (r + 1) * cols + (c + 1);

        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    addVBO(gl, 0, new Float32Array(positions), 3);
    addVBO(gl, 1, new Float32Array(normals), 3);
    addVBO(gl, 2, new Float32Array(colorsRGB), 3);
    addVBO(gl, 3, new Float32Array(colorsNDVI), 3);
    addVBO(gl, 4, new Float32Array(colorsThermal), 3);
    addVBO(gl, 5, new Float32Array(colorsElevation), 3);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return {
      vao,
      indexCount: indices.length
    };
  }

  /**
   * Builds Drone Body Chassis VAO
   */
  static createDroneChassisVAO(gl) {
    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];

    let vertexOffset = 0;

    function addBox(cx, cy, cz, sx, sy, sz, color) {
      const hx = sx / 2, hy = sy / 2, hz = sz / 2;
      const boxVerts = [
        { pos: [cx - hx, cy - hy, cz + hz], norm: [0, 0, 1] },
        { pos: [cx + hx, cy - hy, cz + hz], norm: [0, 0, 1] },
        { pos: [cx + hx, cy + hy, cz + hz], norm: [0, 0, 1] },
        { pos: [cx - hx, cy + hy, cz + hz], norm: [0, 0, 1] },
        { pos: [cx + hx, cy - hy, cz - hz], norm: [0, 0, -1] },
        { pos: [cx - hx, cy - hy, cz - hz], norm: [0, 0, -1] },
        { pos: [cx - hx, cy + hy, cz - hz], norm: [0, 0, -1] },
        { pos: [cx + hx, cy + hy, cz - hz], norm: [0, 0, -1] },
        { pos: [cx - hx, cy + hy, cz + hz], norm: [0, 1, 0] },
        { pos: [cx + hx, cy + hy, cz + hz], norm: [0, 1, 0] },
        { pos: [cx + hx, cy + hy, cz - hz], norm: [0, 1, 0] },
        { pos: [cx - hx, cy + hy, cz - hz], norm: [0, 1, 0] },
        { pos: [cx - hx, cy - hy, cz - hz], norm: [0, -1, 0] },
        { pos: [cx + hx, cy - hy, cz - hz], norm: [0, -1, 0] },
        { pos: [cx + hx, cy - hy, cz + hz], norm: [0, -1, 0] },
        { pos: [cx - hx, cy - hy, cz + hz], norm: [0, -1, 0] },
        { pos: [cx + hx, cy - hy, cz + hz], norm: [1, 0, 0] },
        { pos: [cx + hx, cy - hy, cz - hz], norm: [1, 0, 0] },
        { pos: [cx + hx, cy + hy, cz - hz], norm: [1, 0, 0] },
        { pos: [cx + hx, cy + hy, cz + hz], norm: [1, 0, 0] },
        { pos: [cx - hx, cy - hy, cz - hz], norm: [-1, 0, 0] },
        { pos: [cx - hx, cy - hy, cz + hz], norm: [-1, 0, 0] },
        { pos: [cx - hx, cy + hy, cz + hz], norm: [-1, 0, 0] },
        { pos: [cx - hx, cy + hy, cz - hz], norm: [-1, 0, 0] }
      ];

      for (let i = 0; i < boxVerts.length; i++) {
        positions.push(...boxVerts[i].pos);
        normals.push(...boxVerts[i].norm);
        colors.push(...color);
      }

      for (let f = 0; f < 6; f++) {
        const base = vertexOffset + f * 4;
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }

      vertexOffset += 24;
    }

    function addCylinder(cx, cy, cz, radius, height, color) {
      const segments = 12;
      const topY = cy + height / 2;
      const botY = cy - height / 2;

      for (let i = 0; i < segments; i++) {
        const theta1 = (i / segments) * Math.PI * 2;
        const theta2 = ((i + 1) / segments) * Math.PI * 2;

        const x1 = cx + Math.cos(theta1) * radius;
        const z1 = cz + Math.sin(theta1) * radius;
        const x2 = cx + Math.cos(theta2) * radius;
        const z2 = cz + Math.sin(theta2) * radius;

        const n1 = [Math.cos(theta1), 0, Math.sin(theta1)];
        const n2 = [Math.cos(theta2), 0, Math.sin(theta2)];

        positions.push(x1, botY, z1, x2, botY, z2, x2, topY, z2, x1, topY, z1);
        normals.push(...n1, ...n2, ...n2, ...n1);
        colors.push(...color, ...color, ...color, ...color);

        const base = vertexOffset;
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        vertexOffset += 4;
      }
    }

    const darkBodyColor = [0.12, 0.15, 0.20];
    const cyanAccentColor = [0.22, 0.74, 0.97];
    const armColor = [0.25, 0.28, 0.35];
    const frontArrowColor = [0.95, 0.25, 0.25];

    addBox(0, 0, 0, 0.8, 0.3, 1.0, darkBodyColor);
    addBox(0, 0.16, 0, 0.6, 0.08, 0.8, cyanAccentColor);

    const armDist = 0.85;
    addBox(-armDist / 2, 0, armDist / 2, 0.9, 0.1, 0.1, armColor);
    addBox(armDist / 2, 0, armDist / 2, 0.9, 0.1, 0.1, armColor);
    addBox(-armDist / 2, 0, -armDist / 2, 0.9, 0.1, 0.1, armColor);
    addBox(armDist / 2, 0, -armDist / 2, 0.9, 0.1, 0.1, armColor);

    const corners = [
      [armDist, 0, armDist],
      [-armDist, 0, armDist],
      [armDist, 0, -armDist],
      [-armDist, 0, -armDist]
    ];

    corners.forEach(([mx, my, mz]) => {
      addCylinder(mx, my + 0.1, mz, 0.14, 0.2, darkBodyColor);
    });

    addBox(0, 0.18, 0.6, 0.25, 0.12, 0.35, frontArrowColor);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    addVBO(gl, 0, new Float32Array(positions), 3);
    addVBO(gl, 1, new Float32Array(normals), 3);
    addVBO(gl, 2, new Float32Array(colors), 3);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return {
      vao,
      indexCount: indices.length
    };
  }

  /**
   * Builds Standalone Propeller Blade VAO
   */
  static createPropellerVAO(gl) {
    const positions = [
      -0.05, 0.0, -0.04,  0.45, 0.0, -0.01,  0.45, 0.0, 0.01,  -0.05, 0.0, 0.04,
      -0.45, 0.0, -0.01,  0.05, 0.0, -0.04,  0.05, 0.0, 0.04,  -0.45, 0.0, 0.01
    ];

    const normals = [
      0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
      0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0
    ];

    const propColor = [0.95, 0.98, 1.0];
    const colors = [];
    for (let i = 0; i < 8; i++) colors.push(...propColor);

    const indices = [
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7
    ];

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    addVBO(gl, 0, new Float32Array(positions), 3);
    addVBO(gl, 1, new Float32Array(normals), 3);
    addVBO(gl, 2, new Float32Array(colors), 3);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return {
      vao,
      indexCount: indices.length
    };
  }

  /**
   * Builds Scanning Camera Sensor Cone VAO
   */
  static createSensorConeVAO(gl) {
    const positions = [];
    const segments = 16;
    const topY = 0.0;
    const botY = -1.0;
    const botRadius = 0.65;

    for (let i = 0; i < segments; i++) {
      const theta1 = (i / segments) * Math.PI * 2;
      const theta2 = ((i + 1) / segments) * Math.PI * 2;

      const x1 = Math.cos(theta1) * botRadius;
      const z1 = Math.sin(theta1) * botRadius;
      const x2 = Math.cos(theta2) * botRadius;
      const z2 = Math.sin(theta2) * botRadius;

      positions.push(0, topY, 0, x1, botY, z1, x2, botY, z2);
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    addVBO(gl, 0, new Float32Array(positions), 3);
    gl.bindVertexArray(null);

    return {
      vao,
      vertexCount: positions.length / 3
    };
  }
}

function addVBO(gl, location, data, numComponents) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, numComponents, gl.FLOAT, false, 0, 0);
}

function normalizeVec3(v) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}
