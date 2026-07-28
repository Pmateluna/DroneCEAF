/**
 * Shaders
 * GLSL ES 3.0 Shader Programs for Sky Dome, Volumetric Sun, Andes Mountains, Terrain, Drone, and Sensor Beam Cone.
 */

// --- Sky Dome & Glowing Sun Shader ---
export const skyVS = `#version 300 es
layout(location = 0) in vec3 aPosition;

uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vWorldPos;

void main() {
  vWorldPos = aPosition;
  mat4 staticView = mat4(mat3(uViewMatrix));
  vec4 pos = uProjectionMatrix * staticView * vec4(aPosition, 1.0);
  gl_Position = pos.xyww; // Far plane z depth
}
`;

export const skyFS = `#version 300 es
precision highp float;

in vec3 vWorldPos;

uniform vec3 uSunDirection;

out vec4 fragColor;

void main() {
  vec3 rayDir = normalize(vWorldPos);
  vec3 sunDir = normalize(uSunDirection);

  float yNorm = clamp(rayDir.y, 0.0, 1.0);
  vec3 horizonColor = vec3(0.85, 0.70, 0.52);
  vec3 zenithColor = vec3(0.12, 0.42, 0.78);
  vec3 skyColor = mix(horizonColor, zenithColor, pow(yNorm, 0.45));

  float sunDot = max(0.0, dot(rayDir, sunDir));
  float sunDisk = smoothstep(0.997, 0.9994, sunDot);
  float sunHalo = pow(sunDot, 64.0) * 0.7 + pow(sunDot, 8.0) * 0.25;

  vec3 sunColor = vec3(1.0, 0.96, 0.85);
  vec3 finalSky = skyColor + sunColor * (sunDisk * 4.5 + sunHalo);

  fragColor = vec4(finalSky, 1.0);
}
`;

// --- Andes Mountains Cordillera Shader ---
export const mountainVS = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vPositionWorld;
out vec3 vNormalWorld;
out vec3 vColor;

void main() {
  vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
  vPositionWorld = worldPos.xyz;
  vNormalWorld = mat3(uModelMatrix) * aNormal;
  vColor = aColor;
  gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
}
`;

export const mountainFS = `#version 300 es
precision highp float;

in vec3 vPositionWorld;
in vec3 vNormalWorld;
in vec3 vColor;

uniform vec3 uSunDirection;
uniform vec3 uCameraPos;
uniform vec3 uFogColor;
uniform float uFogDensity;

out vec4 fragColor;

void main() {
  vec3 normal = normalize(vNormalWorld);
  vec3 lightDir = normalize(uSunDirection);

  float diff = max(dot(normal, lightDir), 0.28);
  vec3 ambient = vec3(0.24, 0.28, 0.35);
  vec3 litColor = vColor * (diff * 0.85 + ambient);

  // Snow cap highlight on mountain peaks
  if (vPositionWorld.y > 44.0) {
    float snowT = smoothstep(44.0, 68.0, vPositionWorld.y);
    vec3 snowColor = vec3(0.96, 0.98, 1.0);
    litColor = mix(litColor, snowColor, snowT * 0.92);
  }

  // Distance Fog blending mountains seamlessly into sky horizon
  float dist = length(vPositionWorld - uCameraPos);
  float fogFactor = exp(-dist * (uFogDensity * 0.4));
  fogFactor = clamp(fogFactor, 0.0, 1.0);

  vec3 finalColor = mix(uFogColor, litColor, fogFactor);

  fragColor = vec4(finalColor, 1.0);
}
`;

// --- Terrain & 3D Orchard Tree Shader ---
export const terrainVS = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColorRGB;
layout(location = 3) in vec3 aColorNDVI;
layout(location = 4) in vec3 aColorThermal;
layout(location = 5) in vec3 aColorElevation;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform int uSensorMode;

out vec3 vPositionWorld;
out vec3 vNormalWorld;
out vec3 vColor;

void main() {
  vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
  vPositionWorld = worldPos.xyz;
  vNormalWorld = mat3(uModelMatrix) * aNormal;

  if (uSensorMode == 0) {
    vColor = aColorRGB;
  } else if (uSensorMode == 1) {
    vColor = aColorNDVI;
  } else if (uSensorMode == 2) {
    vColor = aColorThermal;
  } else {
    vColor = aColorElevation;
  }

  gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
}
`;

export const terrainFS = `#version 300 es
precision highp float;

in vec3 vPositionWorld;
in vec3 vNormalWorld;
in vec3 vColor;

uniform vec3 uSunDirection;
uniform vec3 uDronePos;
uniform vec3 uCameraPos;
uniform vec3 uFogColor;
uniform float uFogDensity;

out vec4 fragColor;

void main() {
  vec3 normal = normalize(vNormalWorld);
  vec3 lightDir = normalize(uSunDirection);
  vec3 viewDir = normalize(uCameraPos - vPositionWorld);

  float diff = max(dot(normal, lightDir), 0.28);

  vec3 halfVector = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfVector), 0.0), 12.0);

  vec3 ambient = vec3(0.22, 0.26, 0.32);
  vec3 litColor = vColor * (diff * 0.82 + ambient) + vec3(0.35) * spec * 0.15;

  if (vPositionWorld.y < 1.0) {
    vec2 gridUV = fract(vPositionWorld.xz * 0.4);
    float gridLine = smoothstep(0.02, 0.05, gridUV.x) * smoothstep(0.02, 0.05, gridUV.y);
    litColor *= mix(0.88, 1.0, gridLine);
  }

  float dist = length(vPositionWorld - uCameraPos);
  float fogFactor = exp(-dist * uFogDensity);
  fogFactor = clamp(fogFactor, 0.0, 1.0);

  vec3 finalColor = mix(uFogColor, litColor, fogFactor);

  fragColor = vec4(finalColor, 1.0);
}
`;

// --- Drone 3D Shader ---
export const droneVS = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vPositionWorld;
out vec3 vNormalWorld;
out vec3 vColor;

void main() {
  vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
  vPositionWorld = worldPos.xyz;
  vNormalWorld = mat3(uModelMatrix) * aNormal;
  vColor = aColor;
  gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
}
`;

export const droneFS = `#version 300 es
precision highp float;

in vec3 vPositionWorld;
in vec3 vNormalWorld;
in vec3 vColor;

uniform vec3 uSunDirection;
uniform vec3 uCameraPos;

out vec4 fragColor;

void main() {
  vec3 normal = normalize(vNormalWorld);
  vec3 lightDir = normalize(uSunDirection);
  vec3 viewDir = normalize(uCameraPos - vPositionWorld);

  float diff = max(dot(normal, lightDir), 0.3);

  vec3 halfVector = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfVector), 0.0), 32.0);

  vec3 ambient = vec3(0.35);
  vec3 color = vColor * (diff + ambient) + vec3(0.8) * spec * 0.5;

  fragColor = vec4(color, 1.0);
}
`;

// --- Sensor Camera Beam Cone Shader ---
export const sensorConeVS = `#version 300 es
layout(location = 0) in vec3 aPosition;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vPositionLocal;

void main() {
  vPositionLocal = aPosition;
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
}
`;

export const sensorConeFS = `#version 300 es
precision highp float;

in vec3 vPositionLocal;

uniform vec4 uConeColor;

out vec4 fragColor;

void main() {
  float alphaGrad = smoothstep(0.0, -1.0, vPositionLocal.y) * 0.45;
  fragColor = vec4(uConeColor.rgb, uConeColor.a * alphaGrad);
}
`;

export function createShaderProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Shader Link Error: ${info}`);
  }

  return program;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader Compile Error (${type === gl.VERTEX_SHADER ? 'VS' : 'FS'}): ${info}`);
  }

  return shader;
}
