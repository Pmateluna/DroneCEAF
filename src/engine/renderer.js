import * as THREE from 'three';
import { Camera } from './camera.js';
import { GLBDroneLoader } from './glb-drone-loader.js';
import { GLBTreeLoader } from './glb-tree-loader.js';

/**
 * Renderer
 * Renders Sky Dome, Andes Mountains Cordillera, Textured Terrain Grid, Authentic 3D Realistic Trees in Orchard Rows, 3D GLB Animated Quadcopter Drone, and Scanning Sensor Cone.
 */
export class Renderer {
  constructor(canvasId, telemetryStore, fieldGenerator) {
    this.store = telemetryStore;
    this.field = fieldGenerator;

    this.canvas = document.getElementById(canvasId);
    this.aspectRatio = window.innerWidth / window.innerHeight;

    // Three.js WebGL2 Renderer
    this.threeRenderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.threeRenderer.setSize(window.innerWidth, window.innerHeight);
    this.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.threeRenderer.shadowMap.enabled = true;
    this.threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Three.js Scene
    this.scene = new THREE.Scene();

    // Camera setup wrapper
    this.camera = new Camera();
    this.threeCamera = new THREE.PerspectiveCamera(55, this.aspectRatio, 0.5, 2500.0);

    // Texture Loader for Ground Texture Map
    this.textureLoader = new THREE.TextureLoader();
    this.groundTexture = this.textureLoader.load('/assets/orchard_ground_texture.png');
    this.groundTexture.wrapS = THREE.RepeatWrapping;
    this.groundTexture.wrapT = THREE.RepeatWrapping;
    this.groundTexture.repeat.set(24, 24);

    // GLB Drone Group & Loader
    this.droneGroup = new THREE.Group();
    this.scene.add(this.droneGroup);

    this.proceduralDroneMesh = this.createProceduralDroneMesh();
    this.droneGroup.add(this.proceduralDroneMesh);

    this.droneLoader = new GLBDroneLoader();
    this.droneLoader.load('/assets/animated_drone_with_camera_free.glb').then((droneModel) => {
      this.proceduralDroneMesh.visible = false;
      this.droneGroup.add(droneModel);
      console.log('[CEAF DroneLab Chile] 3D GLB Drone model attached to scene.');
    }).catch(err => {
      console.warn('[CEAF DroneLab Chile] GLB drone load error, using procedural drone:', err);
    });

    // GLB Tree Loader for realistic_tree.glb
    this.treeLoader = new GLBTreeLoader();

    // Build 3D Environment Objects
    this.buildLighting();
    this.buildSkyAndMountains();
    this.buildTerrain();
    this.buildOrchardTrees();
    this.buildSensorCone();

    window.addEventListener('resize', () => this.onResize());
  }

  createProceduralDroneMesh() {
    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(0.6, 0.15, 0.8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.8 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    const camGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const camMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.9 });
    const cam = new THREE.Mesh(camGeo, camMat);
    cam.position.set(0, -0.1, 0.35);
    group.add(cam);

    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8);
    armGeo.rotateZ(Math.PI / 2);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });

    const arm1 = new THREE.Mesh(armGeo, armMat);
    arm1.rotation.y = Math.PI / 4;
    group.add(arm1);

    const arm2 = new THREE.Mesh(armGeo, armMat);
    arm2.rotation.y = -Math.PI / 4;
    group.add(arm2);

    const propGeo = new THREE.BoxGeometry(0.7, 0.01, 0.06);
    const propMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });

    this.proceduralProps = [];
    const positions = [
      [0.6, 0.1, 0.6],
      [-0.6, 0.1, 0.6],
      [0.6, 0.1, -0.6],
      [-0.6, 0.1, -0.6]
    ];

    positions.forEach(([x, y, z]) => {
      const prop = new THREE.Mesh(propGeo, propMat);
      prop.position.set(x, y, z);
      group.add(prop);
      this.proceduralProps.push(prop);
    });

    return group;
  }

  buildLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x4ade80, 0.9);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
    this.sunLight.position.set(140, 200, 160);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 400;
    const d = 120;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);
  }

  buildSkyAndMountains() {
    const skyGeo = new THREE.SphereGeometry(1800, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.BackSide
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);

    const mountainGeo = new THREE.CylinderGeometry(850, 950, 220, 64, 16, true);
    const posAttr = mountainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      if (y > 0) {
        const noise = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 45 + Math.sin(x * 0.05) * 20;
        posAttr.setY(i, y + Math.max(0, noise));
      }
    }
    mountainGeo.computeVertexNormals();

    const mountainMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true
    });
    const mountainsMesh = new THREE.Mesh(mountainGeo, mountainMat);
    mountainsMesh.position.y = 80;
    this.scene.add(mountainsMesh);
  }

  buildTerrain() {
    const gridRes = this.field.gridRes;
    const terrainGeo = new THREE.PlaneGeometry(200, 200, gridRes, gridRes);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const colorsRGB = new Float32Array(pos.count * 3);
    const colorsNDVI = new Float32Array(pos.count * 3);
    const colorsThermal = new Float32Array(pos.count * 3);
    const colorsElevation = new Float32Array(pos.count * 3);

    for (let r = 0; r <= gridRes; r++) {
      for (let c = 0; c <= gridRes; c++) {
        const idx = r * (gridRes + 1) + c;
        const cell = this.field.grid[r][c];

        pos.setY(idx, cell.y);

        colorsRGB[idx * 3] = cell.rgbColor[0];
        colorsRGB[idx * 3 + 1] = cell.rgbColor[1];
        colorsRGB[idx * 3 + 2] = cell.rgbColor[2];

        colorsNDVI[idx * 3] = cell.ndviColor[0];
        colorsNDVI[idx * 3 + 1] = cell.ndviColor[1];
        colorsNDVI[idx * 3 + 2] = cell.ndviColor[2];

        colorsThermal[idx * 3] = cell.thermalColor[0];
        colorsThermal[idx * 3 + 1] = cell.thermalColor[1];
        colorsThermal[idx * 3 + 2] = cell.thermalColor[2];

        colorsElevation[idx * 3] = cell.elevationColor[0];
        colorsElevation[idx * 3 + 1] = cell.elevationColor[1];
        colorsElevation[idx * 3 + 2] = cell.elevationColor[2];
      }
    }

    terrainGeo.setAttribute('colorRGB', new THREE.BufferAttribute(colorsRGB, 3));
    terrainGeo.setAttribute('colorNDVI', new THREE.BufferAttribute(colorsNDVI, 3));
    terrainGeo.setAttribute('colorThermal', new THREE.BufferAttribute(colorsThermal, 3));
    terrainGeo.setAttribute('colorElevation', new THREE.BufferAttribute(colorsElevation, 3));

    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colorsNDVI, 3));
    terrainGeo.computeVertexNormals();

    this.terrainMaterial = new THREE.MeshStandardMaterial({
      map: this.groundTexture,
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.05
    });

    this.terrainMesh = new THREE.Mesh(terrainGeo, this.terrainMaterial);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
  }

  buildOrchardTrees() {
    this.treesGroup = new THREE.Group();
    this.scene.add(this.treesGroup);

    this.placeholderTreesGroup = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.8, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const foliageGeo = new THREE.SphereGeometry(1.6, 12, 10);

    const gridRes = this.field.gridRes;
    const treePositions = [];

    // Parallel orchard rows (rows spaced 4 units apart, trees spaced 4 units along row)
    for (let r = 2; r < gridRes; r += 4) {
      for (let c = 2; c < gridRes; c += 4) {
        const cell = this.field.grid[r][c];
        if (Math.abs(cell.x) < 3.5 || Math.abs(cell.z) < 3.5) continue;

        treePositions.push(cell);

        const treeMesh = new THREE.Group();
        treeMesh.position.set(cell.x, cell.y, cell.z);

        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.9;
        trunk.castShadow = true;
        treeMesh.add(trunk);

        const foliageMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(cell.ndviColor[0], cell.ndviColor[1], cell.ndviColor[2]),
          roughness: 0.6
        });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 2.4;
        foliage.scale.set(1.1, 0.9, 1.1);
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        treeMesh.add(foliage);

        this.placeholderTreesGroup.add(treeMesh);
      }
    }
    this.treesGroup.add(this.placeholderTreesGroup);

    // Load realistic_tree.glb single 3D tree asset
    this.treeLoader.load('/assets/realistic_tree.glb').then(() => {
      this.placeholderTreesGroup.visible = false;

      treePositions.forEach((cell) => {
        const glbTree = this.treeLoader.createTreeInstance();
        if (glbTree) {
          glbTree.position.set(cell.x, cell.y, cell.z);

          glbTree.traverse((child) => {
            if (child.isMesh && child.material) {
              child.castShadow = true;
              child.receiveShadow = true;
              const matName = child.material.name ? child.material.name.toLowerCase() : '';
              const nodeName = child.name ? child.name.toLowerCase() : '';

              // Trunk meshes keep authentic bark texture/color
              if (matName.includes('trunk') || nodeName.includes('trunk')) {
                // Keep authentic bark
              } else {
                // Leaf canopy meshes get multispectral color data
                child.userData.originalColor = child.material.color.clone();
                child.userData.ndviColor = new THREE.Color(cell.ndviColor[0], cell.ndviColor[1], cell.ndviColor[2]);
                child.userData.thermalColor = new THREE.Color(cell.thermalColor[0], cell.thermalColor[1], cell.thermalColor[2]);
                child.userData.elevationColor = new THREE.Color(cell.elevationColor[0], cell.elevationColor[1], cell.elevationColor[2]);
              }
            }
          });

          this.treesGroup.add(glbTree);
        }
      });
      console.log(`[CEAF DroneLab Chile] Populated ${treePositions.length} straight orchard rows using authentic realistic_tree.glb.`);
    }).catch(err => {
      console.warn('[CEAF DroneLab Chile] Tree GLB load error, using procedural trees:', err);
    });
  }

  buildSensorCone() {
    const coneGeo = new THREE.ConeGeometry(8, 12, 16, 1, true);
    coneGeo.translate(0, -6, 0);

    this.sensorConeMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });

    this.sensorConeMesh = new THREE.Mesh(coneGeo, this.sensorConeMat);
    this.scene.add(this.sensorConeMesh);
  }

  updateMultispectralView(sensorMode) {
    const geo = this.terrainMesh.geometry;
    let attrName = 'colorNDVI';
    let coneColor = 0x22c55e;

    if (sensorMode === 'rgb') {
      attrName = 'colorRGB';
      coneColor = 0x38bdf8;
      this.terrainMaterial.map = this.groundTexture;
    } else {
      this.terrainMaterial.map = null;
      if (sensorMode === 'thermal') {
        attrName = 'colorThermal';
        coneColor = 0xf59e0b;
      } else if (sensorMode === 'elevation') {
        attrName = 'colorElevation';
        coneColor = 0xa855f7;
      }
    }
    this.terrainMaterial.needsUpdate = true;

    const targetAttr = geo.getAttribute(attrName);
    if (targetAttr) {
      geo.setAttribute('color', targetAttr);
      geo.attributes.color.needsUpdate = true;
    }
    this.sensorConeMat.color.setHex(coneColor);

    if (this.treesGroup) {
      this.treesGroup.traverse((child) => {
        if (child.isMesh && child.userData && child.userData.ndviColor) {
          if (sensorMode === 'rgb') {
            child.material.color.copy(child.userData.originalColor || child.userData.ndviColor);
          } else if (sensorMode === 'ndvi') {
            child.material.color.copy(child.userData.ndviColor);
          } else if (sensorMode === 'thermal') {
            child.material.color.copy(child.userData.thermalColor);
          } else if (sensorMode === 'elevation') {
            child.material.color.copy(child.userData.elevationColor);
          }
        }
      });
    }
  }

  onResize() {
    this.aspectRatio = window.innerWidth / window.innerHeight;
    this.threeRenderer.setSize(window.innerWidth, window.innerHeight);
    this.threeCamera.aspect = this.aspectRatio;
    this.threeCamera.updateProjectionMatrix();
  }

  render(dt) {
    const droneState = this.store.getDroneState();
    const dronePos = droneState.position;
    const droneRot = droneState.rotation;
    const sensorMode = this.store.getSensorMode();
    const motorSpinPct = this.store.motorSpinPct !== undefined ? this.store.motorSpinPct : 0.0;
    const motorPower = this.store.getMotorPower();

    // Update multispectral terrain colors
    this.updateMultispectralView(sensorMode);

    // Update Drone position & rotation
    this.droneGroup.position.set(dronePos[0], dronePos[1], dronePos[2]);
    this.droneGroup.rotation.set(droneRot[0], droneRot[1], droneRot[2], 'YXZ');

    // Update procedural props if fallback is active
    if (this.proceduralDroneMesh.visible && this.proceduralProps) {
      this.proceduralProps.forEach((prop, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        prop.rotation.y += dt * 35.0 * motorSpinPct * dir;
      });
    }

    // Update GLB Drone animation mixer
    this.droneLoader.update(dt, motorSpinPct, motorPower);

    // Update Sensor Cone Beam position
    if (dronePos[1] > 0.9 && motorPower !== 'off') {
      this.sensorConeMesh.visible = true;
      this.sensorConeMesh.position.set(dronePos[0], dronePos[1] - 0.2, dronePos[2]);
      this.sensorConeMesh.scale.set(dronePos[1] * 0.15, dronePos[1] * 0.1, dronePos[1] * 0.15);
    } else {
      this.sensorConeMesh.visible = false;
    }

    // Update Camera
    this.camera.update(dronePos, droneRot, this.aspectRatio, dt);
    this.threeCamera.position.set(this.camera.position[0], this.camera.position[1], this.camera.position[2]);
    this.threeCamera.lookAt(this.camera.target[0], this.camera.target[1], this.camera.target[2]);

    // Render frame
    this.threeRenderer.render(this.scene, this.threeCamera);
  }
}
