import {
  Engine,
  Scene,
  Vector3,
  Quaternion,
  Matrix,
  Space,
  Color3,
  Color4,
  UniversalCamera,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  CascadedShadowGenerator,
  DefaultRenderingPipeline,
  SSAO2RenderingPipeline,
  FSR1RenderingPipeline,
  ImageProcessingConfiguration,
  ReflectionProbe,
  RenderTargetTexture,
  BoundingInfo,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Texture,
  DynamicTexture,
  VertexBuffer,
  TransformNode,
  ParticleSystem,
  GPUParticleSystem,
  PointsCloudSystem
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { Camera } from './camera.js';
import { GLBDroneLoader } from './glb-drone-loader.js';
import { GLBTreeLoader } from './glb-tree-loader.js';

/**
 * Renderer (Babylon.js 9)
 * High-performance agronomic 3D engine for CEAF DroneLab Chile:
 *  - Sky Dome & Andes Mountains Cordillera
 *  - Dynamic Multispectral Orchard Terrain (RGB, NDVI, Thermal IR, LiDAR Elevation)
 *  - Hardware Thin-Instanced Fruit Trees (390 trees in 3 draw calls) with Per-Tree Canopy Coloration
 *  - Dual 3D GLB Drones (Multispectral & Agricultural Sprayer)
 *  - Babylon 9 GPUParticleSystem 4-Nozzle Atomized Spray Mist + Rotor Downwash Soil Vortex
 *  - Multispectral Radiometric Sampling Cone
 *  - 3rd Person & FPV Drone Flight Cameras
 */
export class Renderer {
  constructor(canvasId, telemetryStore, fieldGenerator) {
    this.store = telemetryStore;
    this.field = fieldGenerator;

    this.canvas = document.getElementById(canvasId);
    this.aspectRatio = window.innerWidth / window.innerHeight;

    // Pre-allocated scratch math objects for zero-GC Thin Instance updates at 120 Hz VRR
    this._tmpTreeScale = new Vector3(1, 1, 1);
    this._tmpTreePos = new Vector3(0, 0, 0);
    this._tmpTreeQuat = new Quaternion();
    this._tmpTreeWorldMat = Matrix.Identity();
    this._tmpFinalTreeMat = Matrix.Identity();
    this._tmpCamTarget = new Vector3(0, 0, 0);

    // 1. Initialize Babylon.js 9 Engine & Scene (Uncapped 120Hz+ VRR DirectFlip on discrete GTX 1060 GPU)
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
      stencil: true,
      antialias: true
    });
    this.scene = new Scene(this.engine);
    
    // Atmospheric Horizon Color (Chilean Central Valley)
    this.horizonColor = new Color3(0.74, 0.85, 0.94);
    this.scene.clearColor = new Color4(this.horizonColor.r, this.horizonColor.g, this.horizonColor.b, 1.0);

    // Distance / Atmospheric Fog: Dissolves distant terrain and mountains into the sky horizon
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.00075;
    this.scene.fogColor = this.horizonColor;

    // 2. Camera Setup (Wrapper around smooth follow & orbit controller)
    this.camera = new Camera();
    this.babylonCamera = new UniversalCamera('droneFlightCam', new Vector3(0, 12, -18), this.scene);
    this.babylonCamera.fov = (55 * Math.PI) / 180;
    this.babylonCamera.minZ = 0.5;
    this.babylonCamera.maxZ = 4500.0;
    this.scene.activeCamera = this.babylonCamera;

    // 3. Ground Texture Map (Suelo Agrícola Franco-Arcilloso Aluvial - Región de O'Higgins)
    this.groundTexture = new Texture('/assets/orchard_ground_texture.png', this.scene);
    // Alineación 1:1 con las 20 hileras de árboles 3D (espaciadas cada 10m en los 200m del predio)
    this.groundTexture.uScale = 16;
    this.groundTexture.vScale = 10;
    this.groundTexture.vOffset = 0.25;
    this.groundTexture.anisotropicFilteringLevel = 16;
    this.groundBumpTexture = this.createSoilBumpDynamicTexture();


    // 4. Drone Root Transform Node
    this.droneGroup = new TransformNode('droneGroup', this.scene);

    // Procedural drone fallback while GLBs load
    this.proceduralDroneMesh = this.createProceduralDroneMesh();
    this.proceduralDroneMesh.parent = this.droneGroup;

    this.multispectralDroneObj = null;
    this.sprayerDroneObj = null;

    // 5. GLB Drone Loader
    this.droneLoader = new GLBDroneLoader(this.scene);

    // Load Multispectral Monitoring Drone Asset
    this._multispectralPromise = this.droneLoader.loadMultispectralDrone().then((res) => {
      this.multispectralDroneObj = res;
      res.model.parent = this.droneGroup;
      this.addShadowCasterSafe(res.model);
      this.updateDroneTypeVisibility(this.store.getDroneType());
      if (this.onAssetProgress) this.onAssetProgress('drone_multi');
      console.log('[CEAF DroneLab Chile] Babylon 3D Multispectral Drone attached to scene.');
    }).catch(err => {
      if (this.onAssetProgress) this.onAssetProgress('drone_multi');
      console.warn('[CEAF DroneLab Chile] Multispectral GLB load warning:', err);
    });

    // Load Agricultural Spray Drone Asset (drone_for_agriculture_tagged.glb)
    this._sprayerPromise = this.droneLoader.loadSprayerDrone().then((res) => {
      this.sprayerDroneObj = res;
      res.model.parent = this.droneGroup;
      this.addShadowCasterSafe(res.model);
      this.updateDroneTypeVisibility(this.store.getDroneType());
      if (this.onAssetProgress) this.onAssetProgress('drone_sprayer');
      console.log('[CEAF DroneLab Chile] Babylon 3D Agricultural Spray Drone attached to scene.');
    }).catch(err => {
      if (this.onAssetProgress) this.onAssetProgress('drone_sprayer');
      console.warn('[CEAF DroneLab Chile] Sprayer GLB load warning:', err);
    });

    this.store.on('droneTypeChange', (type) => {
      this.updateDroneTypeVisibility(type);
    });

    this.store.on('fieldRegenerated', () => {
      this.rebuildTerrainColors();
    });

    this.store.on('fsrChange', (enabled) => {
      this.setFsrEnabled(enabled);
    });

    // 6. Tree Loader
    this.treeLoader = new GLBTreeLoader(this.scene);

    // 7. Build Environment Objects
    this.buildLighting();
    if (this.proceduralDroneMesh) this.addShadowCasterSafe(this.proceduralDroneMesh);
    this.buildAtmosphereAndSky();
    this.buildSurroundingValley();
    this.buildAndesMountains();
    this.buildIBLReflectionProbe();
    this.buildTerrain();
    this.buildOrchardTrees();
    this.buildSensorCone();
    this.buildSprayParticleSystems();
    this.buildDownwashParticleSystem();
    this.buildPostProcessing();

    window.addEventListener('resize', () => this.onResize());
  }

  buildLighting() {
    // Physically balanced ambient base so directional sun shadows have deep, crisp contrast
    this.scene.ambientColor = new Color3(0.24, 0.27, 0.30);

    // Hemispheric sky-ground bounce illumination (calibrated for PBR & StandardMaterials)
    this.hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), this.scene);
    this.hemiLight.diffuse = new Color3(0.88, 0.94, 1.02);      // Clear Cachapoal valley sky dome
    this.hemiLight.groundColor = new Color3(0.54, 0.46, 0.36); // Warm alluvial loam soil bounce GI
    this.hemiLight.intensity = 0.82;

    // Direct warm Chilean Central Valley sun light (golden-hour / mid-morning oblique angle for rich 3D relief)
    this.sunLight = new DirectionalLight('sunLight', new Vector3(-0.55, -0.86, -0.44).normalize(), this.scene);
    this.sunLight.position = new Vector3(190, 300, 160);
    this.sunLight.diffuse = new Color3(1.0, 0.96, 0.88);
    this.sunLight.specular = new Color3(0.48, 0.45, 0.38);
    this.sunLight.intensity = 2.65;

    // Single-Pass High-Resolution 2048px PCF Shadow Generator (Zero multi-cascade frustum stalls)
    this.sunLight.autoUpdateExtends = false;
    this.sunLight.autoCalcShadowZBounds = false;
    this.sunLight.orthoLeft = -105;
    this.sunLight.orthoRight = 105;
    this.sunLight.orthoBottom = -105;
    this.sunLight.orthoTop = 105;
    this.sunLight.shadowMinZ = 80;
    this.sunLight.shadowMaxZ = 520;

    this.shadowGenerator = new ShadowGenerator(2048, this.sunLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    this.shadowGenerator.transparencyShadow = true;
    this.shadowGenerator.enableSoftTransparentShadow = false;
    this.shadowGenerator.bias = 0.0008;
    this.shadowGenerator.normalBias = 0.002;
    this.shadowGenerator.darkness = 0.15;
  }

  addShadowCasterSafe(target) {
    if (!this.shadowGenerator || !target) return;
    // Only add AbstractMesh nodes that possess getBoundingInfo
    if (typeof target.getBoundingInfo === 'function') {
      this.shadowGenerator.addShadowCaster(target, false);
    }
    // Traverse child meshes safely without recursively re-adding non-mesh nodes
    if (typeof target.getChildMeshes === 'function') {
      target.getChildMeshes().forEach(child => {
        if (child && typeof child.getBoundingInfo === 'function') {
          this.shadowGenerator.addShadowCaster(child, false);
        }
      });
    }
  }

  buildAtmosphereAndSky() {
    // 1. Sky Dome Sphere
    const sky = MeshBuilder.CreateSphere('skySphere', { diameter: 3600, segments: 32 }, this.scene);
    this.skyMesh = sky;
    const skyMat = new StandardMaterial('skyMat', this.scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;
    skyMat.fogEnabled = false;

    // Dynamic Gradient Texture for Sky Dome
    const skyTex = new DynamicTexture('skyGradientTex', { width: 512, height: 512 }, this.scene, false);
    const ctx = skyTex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    // V=0 is zenith, V=0.5 is horizon, V=1.0 is nadir
    grad.addColorStop(0.00, '#0a3668'); // Deep Andean cobalt zenith
    grad.addColorStop(0.20, '#1658a0'); // Rich azure blue
    grad.addColorStop(0.38, '#4692d8'); // Daylight cyan blue
    grad.addColorStop(0.48, '#9bc6ec'); // Soft horizon sky
    grad.addColorStop(0.50, '#bcd8ef'); // Atmospheric horizon haze (matches horizonColor)
    grad.addColorStop(0.54, '#9ab2c7'); // Sub-horizon blend
    grad.addColorStop(1.00, '#625648'); // Warm alluvial soil nadir bounce
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle high-altitude cirrus cloud wisps
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    for (let i = 0; i < 24; i++) {
      const cx = (i * 47) % 512;
      const cy = 130 + (i * 19) % 100;
      const rx = 60 + (i * 23) % 90;
      const ry = 4 + (i * 5) % 8;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0.05 * (i % 3 - 1), 0, Math.PI * 2);
      ctx.fill();
    }
    skyTex.update();

    skyMat.emissiveTexture = skyTex;
    sky.material = skyMat;

    // 2. Visible Glowing Sun Disc
    const sunDisc = MeshBuilder.CreateDisc('sunDisc', { radius: 82, tessellation: 32 }, this.scene);
    this.sunDiscMesh = sunDisc;
    const sunDir = new Vector3(-0.55, -0.86, -0.44).normalize();
    sunDisc.position = sunDir.scale(-1600);
    sunDisc.lookAt(Vector3.Zero());

    const sunMat = new StandardMaterial('sunMat', this.scene);
    sunMat.disableLighting = true;
    sunMat.fogEnabled = false;
    sunMat.backFaceCulling = false;

    const sunTex = new DynamicTexture('sunGlowTex', { width: 256, height: 256 }, this.scene, false);
    const sCtx = sunTex.getContext();
    const sGrad = sCtx.createRadialGradient(128, 128, 12, 128, 128, 128);
    sGrad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');
    sGrad.addColorStop(0.20, 'rgba(255, 250, 215, 0.92)');
    sGrad.addColorStop(0.50, 'rgba(255, 220, 140, 0.40)');
    sGrad.addColorStop(0.85, 'rgba(255, 190, 80, 0.10)');
    sGrad.addColorStop(1.00, 'rgba(255, 180, 50, 0.0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 256, 256);
    sunTex.update();

    sunMat.diffuseTexture = sunTex;
    sunMat.opacityTexture = sunTex;
    sunMat.emissiveTexture = sunTex;
    sunDisc.material = sunMat;
  }

  buildSurroundingValley() {
    // Extended agricultural valley (2,800m x 2,800m) with an exact 200m x 200m central cutout
    // for the active CEAF research orchard parcel.
    const north = MeshBuilder.CreateGround('valley_n', {
      width: 2800,
      height: 1300,
      subdivisionsX: 56,
      subdivisionsY: 26,
      updatable: true
    }, this.scene);
    north.position.z = 750;

    const south = MeshBuilder.CreateGround('valley_s', {
      width: 2800,
      height: 1300,
      subdivisionsX: 56,
      subdivisionsY: 26,
      updatable: true
    }, this.scene);
    south.position.z = -750;

    const east = MeshBuilder.CreateGround('valley_e', {
      width: 1300,
      height: 200,
      subdivisionsX: 26,
      subdivisionsY: 4,
      updatable: true
    }, this.scene);
    east.position.x = 750;

    const west = MeshBuilder.CreateGround('valley_w', {
      width: 1300,
      height: 200,
      subdivisionsX: 26,
      subdivisionsY: 4,
      updatable: true
    }, this.scene);
    west.position.x = -750;

    const valley = Mesh.MergeMeshes([north, south, east, west], true, true);
    if (!valley) return;

    this.valleyMesh = valley;
    valley.name = 'surroundingValley';
    valley.position.y = 0.0;

    const vPositions = valley.getVerticesData(VertexBuffer.PositionKind);
    if (vPositions) {
      const uvs = new Float32Array((vPositions.length / 3) * 2);

      for (let i = 0; i < vPositions.length; i += 3) {
        const x = vPositions[i];
        const z = vPositions[i + 2];

        // Seam transition: orchard ground has edgeFade to 0.0 at |x| or |z| = 100
        const borderDist = Math.max(Math.abs(x), Math.abs(z));
        const borderBlend = borderDist < 160 ? Math.max(0, (borderDist - 100) / 60) : 1.0;

        // Gentle agricultural valley rolling relief outside the orchard
        const rolling = (Math.sin(x * 0.005) * Math.cos(z * 0.005) * 4.5
                      + Math.sin(x * 0.012 + z * 0.008) * 2.5) * borderBlend;

        // Smoothly rise into mountain foothills at the outer perimeter
        const dist = Math.sqrt(x * x + z * z);
        const footHillSlope = dist > 700 ? Math.pow((dist - 700) / 600, 2) * 50.0 : 0.0;
        vPositions[i + 1] = rolling + footHillSlope;

        // Continuous world-space UV coordinates across all 4 segments
        const uvIdx = (i / 3) * 2;
        uvs[uvIdx] = (x + 1400) / 2800;
        uvs[uvIdx + 1] = (z + 1400) / 2800;
      }

      valley.setVerticesData(VertexBuffer.PositionKind, vPositions);
      valley.setVerticesData(VertexBuffer.UVKind, uvs);
      valley.createNormals(true);
    }

    const valleyMat = new StandardMaterial('valleyMat', this.scene);
    valleyMat.diffuseColor = new Color3(0.96, 0.94, 0.90);
    valleyMat.specularColor = new Color3(0.03, 0.03, 0.02);

    const valleyTexture = new Texture('/assets/orchard_ground_texture.png', this.scene);
    // Escala métrica continua con el predio central (2800m / 200m = 14x)
    valleyTexture.uScale = 224;
    valleyTexture.vScale = 140;
    valleyTexture.anisotropicFilteringLevel = 16;
    valleyMat.diffuseTexture = valleyTexture;
    valleyMat.roughness = 0.92;

    valley.material = valleyMat;
    valley.receiveShadows = true;
  }

  buildAndesMountains() {
    // 1. High Andes Cordillera Outer Ring (Snow-capped Majestic Peaks)
    const highAndes = MeshBuilder.CreateCylinder('highAndesRing', {
      height: 480,
      diameterTop: 2400,
      diameterBottom: 2700,
      tessellation: 96,
      subdivisions: 24
    }, this.scene);
    this.highAndesMesh = highAndes;

    const highPositions = highAndes.getVerticesData(VertexBuffer.PositionKind);
    const vertexCount = highPositions.length / 3;
    const colors = new Float32Array(vertexCount * 4);

    if (highPositions) {
      for (let i = 0; i < highPositions.length; i += 3) {
        const x = highPositions[i];
        const y = highPositions[i + 1];
        const z = highPositions[i + 2];
        const vIdx = i / 3;

        let finalY = y;
        if (y > -100) {
          // Sharp mountain ridge peaks with multi-frequency harmonics
          const peakNoise = Math.sin(x * 0.007) * Math.cos(z * 0.007) * 140
                          + Math.abs(Math.sin(x * 0.016 + 1.2)) * 95
                          + Math.cos(x * 0.032 - z * 0.028) * 45;
          finalY = y + Math.max(0, peakNoise);
          highPositions[i + 1] = finalY;
        }

        // Vertex Color shading based on elevation (Snow summits -> Granite -> Base)
        const cIdx = vIdx * 4;
        if (finalY > 210) {
          // Snow and ice caps
          colors[cIdx] = 0.94;
          colors[cIdx + 1] = 0.97;
          colors[cIdx + 2] = 1.0;
          colors[cIdx + 3] = 1.0;
        } else if (finalY > 100) {
          // Andes granite slate rock
          const t = (finalY - 100) / 110;
          colors[cIdx] = 0.38 + t * 0.40;
          colors[cIdx + 1] = 0.40 + t * 0.42;
          colors[cIdx + 2] = 0.46 + t * 0.45;
          colors[cIdx + 3] = 1.0;
        } else {
          // Lower mountain base
          colors[cIdx] = 0.28;
          colors[cIdx + 1] = 0.32;
          colors[cIdx + 2] = 0.30;
          colors[cIdx + 3] = 1.0;
        }
      }
      highAndes.setVerticesData(VertexBuffer.PositionKind, highPositions);
      highAndes.setVerticesData(VertexBuffer.ColorKind, colors);
      highAndes.createNormals(true);
    }

    const highAndesMat = new StandardMaterial('highAndesMat', this.scene);
    highAndesMat.backFaceCulling = false; // Essential: must be visible from inside the ring!
    highAndesMat.specularColor = new Color3(0.04, 0.04, 0.04);
    highAndesMat.diffuseColor = new Color3(0.95, 0.95, 0.98);
    highAndes.material = highAndesMat;
    highAndes.position.y = 120;

    // 2. Precordillera Foothills Inner Ring (Rolling Rocky Scrub Hills)
    const foothills = MeshBuilder.CreateCylinder('foothillsRing', {
      height: 220,
      diameterTop: 1650,
      diameterBottom: 1950,
      tessellation: 64,
      subdivisions: 16
    }, this.scene);
    this.foothillsMesh = foothills;

    const footPositions = foothills.getVerticesData(VertexBuffer.PositionKind);
    if (footPositions) {
      for (let i = 0; i < footPositions.length; i += 3) {
        const x = footPositions[i];
        const y = footPositions[i + 1];
        const z = footPositions[i + 2];
        if (y > -40) {
          const noise = Math.sin(x * 0.012) * Math.cos(z * 0.012) * 55
                      + Math.sin(z * 0.024 + 0.8) * 28;
          footPositions[i + 1] = y + Math.max(0, noise);
        }
      }
      foothills.setVerticesData(VertexBuffer.PositionKind, footPositions);
      foothills.createNormals(true);
    }

    const footMat = new StandardMaterial('footMat', this.scene);
    footMat.backFaceCulling = false;
    footMat.diffuseColor = new Color3(0.32, 0.38, 0.28);
    footMat.specularColor = new Color3(0.02, 0.02, 0.02);
    foothills.material = footMat;
    foothills.position.y = 50;
  }

  /**
   * Generates a real-time Image-Based Lighting (IBL) CubeTexture from the Cachapoal sky dome,
   * sun disc, Andes Cordillera, and valley floor for physically-based (PBR) reflections on drones & foliage.
   */
  buildIBLReflectionProbe() {
    try {
      this.reflectionProbe = new ReflectionProbe('cachapoalEnvProbe', 256, this.scene, true, true);
      this.reflectionProbe.position.set(0, 22, 0);
      this.reflectionProbe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
      const renderList = this.reflectionProbe.renderList;
      if (renderList) {
        if (this.skyMesh) renderList.push(this.skyMesh);
        if (this.sunDiscMesh) renderList.push(this.sunDiscMesh);
        if (this.highAndesMesh) renderList.push(this.highAndesMesh);
        if (this.foothillsMesh) renderList.push(this.foothillsMesh);
        if (this.valleyMesh) renderList.push(this.valleyMesh);
      }
      this.scene.environmentTexture = this.reflectionProbe.cubeTexture;
      this.scene.environmentIntensity = 0.85;
    } catch (err) {
      console.warn('[CEAF DroneLab Chile] ReflectionProbe IBL warning:', err);
    }
  }

  /**
   * Computes exact 3D sculpted terrain elevation at (x, z) including macro rolling relief,
   * raised planting berms (camellones +0.24m) along each tree row, and inter-row tractor ruts.
   */
  getTerrainHeightAt(x, z) {
    const maxCoord = Math.max(Math.abs(x), Math.abs(z));
    const edgeFade = maxCoord > 75 ? Math.max(0, (100 - maxCoord) / 25) : 1.0;
    const baseWave = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 1.5 * edgeFade;

    // Raised orchard planting camellón (berm) along tree rows (every 10m at z = ... -15, -5, +5, +15 ...)
    // Cleared on central cross service paths (|x| < 3.5 or |z| < 3.5)
    let berm = 0.0;
    if (Math.abs(x) > 3.8 && Math.abs(z) > 3.8 && maxCoord < 94) {
      const pathFadeX = Math.min(1.0, (Math.abs(x) - 3.8) / 2.5);
      const pathFadeZ = Math.min(1.0, (Math.abs(z) - 3.8) / 2.5);
      // Distance to nearest tree row center (rows are at z = -95 + k*10, i.e., (z - 5) mod 10 === 0)
      const rowPhase = (((z - 5) % 10) + 10) % 10; // 0..10, row center at 0 or 10, inter-row center at 5
      const distToRow = Math.min(rowPhase, 10 - rowPhase);

      if (distToRow < 1.85) {
        // Raised camellón (+0.24m smooth cosine profile under fruit trees)
        const c = Math.cos((distToRow / 1.85) * (Math.PI * 0.5));
        berm = 0.24 * (c * c) * pathFadeX * pathFadeZ * edgeFade;
      } else {
        // Tractor tire ruts at distToRow ~ 3.2m (two wheel tracks in the 10m inter-row alley)
        const rutDist = Math.abs(distToRow - 3.25);
        if (rutDist < 0.65) {
          const r = Math.cos((rutDist / 0.65) * (Math.PI * 0.5));
          berm = -0.055 * (r * r) * pathFadeX * pathFadeZ * edgeFade;
        }
      }
    }

    return baseWave + berm;
  }

  buildTerrain() {
    // High-density 160x160 mesh (1.25m vertex resolution) to sculpt 3D planting berms (camellones) and furrows
    const terrainSubdivisions = 160;
    const terrain = MeshBuilder.CreateGround('orchardGround', {
      width: 200,
      height: 200,
      subdivisions: terrainSubdivisions,
      updatable: true
    }, this.scene);

    const positions = terrain.getVerticesData(VertexBuffer.PositionKind);
    const vertexCount = positions.length / 3;
    this.terrainPositions = positions;
    this.terrainColorsDirty = true;
    this.lastSensorMode = null;

    // Babylon 9 expects 4 components (R, G, B, A) for VertexBuffer.ColorKind
    this.colorsRGB = new Float32Array(vertexCount * 4);
    this.colorsNDVI = new Float32Array(vertexCount * 4);
    this.colorsThermal = new Float32Array(vertexCount * 4);
    this.colorsElevation = new Float32Array(vertexCount * 4);

    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const z = positions[i * 3 + 2];

      const height = this.getTerrainHeightAt(x, z);
      positions[i * 3 + 1] = height;

      const cell = this.field.calculateSpectralAt(x, height, z);

      const colorIdx = i * 4;
      const tint = cell.rgbVertexTint || [1.0, 1.0, 1.0];

      this.colorsRGB[colorIdx] = tint[0];
      this.colorsRGB[colorIdx + 1] = tint[1];
      this.colorsRGB[colorIdx + 2] = tint[2];
      this.colorsRGB[colorIdx + 3] = 1.0;

      this.colorsNDVI[colorIdx] = cell.ndviColor[0];
      this.colorsNDVI[colorIdx + 1] = cell.ndviColor[1];
      this.colorsNDVI[colorIdx + 2] = cell.ndviColor[2];
      this.colorsNDVI[colorIdx + 3] = 1.0;

      this.colorsThermal[colorIdx] = cell.thermalColor[0];
      this.colorsThermal[colorIdx + 1] = cell.thermalColor[1];
      this.colorsThermal[colorIdx + 2] = cell.thermalColor[2];
      this.colorsThermal[colorIdx + 3] = 1.0;

      this.colorsElevation[colorIdx] = cell.elevationColor[0];
      this.colorsElevation[colorIdx + 1] = cell.elevationColor[1];
      this.colorsElevation[colorIdx + 2] = cell.elevationColor[2];
      this.colorsElevation[colorIdx + 3] = 1.0;
    }

    terrain.setVerticesData(VertexBuffer.PositionKind, positions);
    terrain.createNormals(true);
    terrain.setVerticesData(VertexBuffer.ColorKind, this.colorsRGB, true);

    this.terrainMaterial = new StandardMaterial('terrainMaterial', this.scene);
    this.terrainMaterial.diffuseTexture = this.groundTexture;
    this.terrainMaterial.bumpTexture = this.groundBumpTexture;
    this.terrainMaterial.diffuseColor = new Color3(1.0, 1.0, 1.0);
    this.terrainMaterial.specularColor = new Color3(0.09, 0.08, 0.06);
    this.terrainMaterial.specularPower = 36;
    this.terrainMaterial.useVertexColors = true;

    terrain.material = this.terrainMaterial;
    terrain.receiveShadows = true;

    this.terrainMesh = terrain;
  }

  /**
   * Genera un mapa de normales de alta definición (512x512) con micro-relieve de terrones aluviales,
   * huellas de neumáticos agrícolas y surcos de rastra alineados con el predio de O'Higgins.
   */
  createSoilBumpDynamicTexture() {
    const size = 512;
    const dt = new DynamicTexture('soilBumpTex', { width: size, height: size }, this.scene, true);
    const ctx = dt.getContext();
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
      const v = y / size;
      // Surcos horizontales de rastra de discos y camellones en las entre-hileras
      const furrowSlope = Math.cos(v * Math.PI * 36) * 26 + Math.sin(v * Math.PI * 10) * 14;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        // Granulometría de terrones aluviales franco-arcillosos + taco de rueda de tractor
        const hash1 = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const grain1 = (hash1 - Math.floor(hash1) - 0.5) * 32;
        const clodX = Math.cos(u * Math.PI * 32 + v * 8.0) * 14 + Math.sin(u * Math.PI * 96) * 8;

        const nx = Math.max(0, Math.min(255, Math.round(128 + grain1 + clodX)));
        const ny = Math.max(0, Math.min(255, Math.round(128 + furrowSlope + grain1 * 0.7)));
        const idx = (y * size + x) * 4;
        data[idx] = nx;
        data[idx + 1] = ny;
        data[idx + 2] = 248;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    dt.update();
    dt.uScale = 16;
    dt.vScale = 10;
    dt.vOffset = 0.25;
    dt.level = 0.65;
    dt.anisotropicFilteringLevel = 16;
    return dt;
  }

  rebuildTerrainColors() {
    if (!this.terrainPositions || !this.terrainMesh) return;
    const positions = this.terrainPositions;
    const vertexCount = positions.length / 3;

    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const height = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      const cell = this.field.calculateSpectralAt(x, height, z);
      const colorIdx = i * 4;
      const tint = cell.rgbVertexTint || [1.0, 1.0, 1.0];

      this.colorsRGB[colorIdx] = tint[0];
      this.colorsRGB[colorIdx + 1] = tint[1];
      this.colorsRGB[colorIdx + 2] = tint[2];

      this.colorsNDVI[colorIdx] = cell.ndviColor[0];
      this.colorsNDVI[colorIdx + 1] = cell.ndviColor[1];
      this.colorsNDVI[colorIdx + 2] = cell.ndviColor[2];

      this.colorsThermal[colorIdx] = cell.thermalColor[0];
      this.colorsThermal[colorIdx + 1] = cell.thermalColor[1];
      this.colorsThermal[colorIdx + 2] = cell.thermalColor[2];

      this.colorsElevation[colorIdx] = cell.elevationColor[0];
      this.colorsElevation[colorIdx + 1] = cell.elevationColor[1];
      this.colorsElevation[colorIdx + 2] = cell.elevationColor[2];
    }

    this.terrainColorsDirty = true;
    this.updateTreeStructuralScales();
    this.updateMultispectralView(this.store.getSensorMode());
    this.updateOrchardTreeColors(this.store.getSensorMode());
    this.updateLidarPointCloud();
  }

  buildOrchardTrees() {
    this.treesGroup = new TransformNode('treesGroup', this.scene);
    this.orchardTrees = [];
    this.treeInstancesData = [];
    this.thinTreeTemplates = [];

    const gridRes = this.field.gridRes;
    const treePositions = [];

    // Parallel orchard rows (rows spaced 4 units apart, trees spaced 4 units along row)
    for (let r = 2; r < gridRes; r += 4) {
      for (let c = 2; c < gridRes; c += 4) {
        const cell = this.field.grid[r][c];
        if (Math.abs(cell.x) < 3.5 || Math.abs(cell.z) < 3.5) continue;
        treePositions.push(cell);
      }
    }

    // Build 3D Airborne LiDAR Point Cloud (Babylon.js 9 PointsCloudSystem) over canopies and terrain
    this.buildLidarPointCloud(treePositions);

    // Load authentic realistic_tree.glb and register Babylon.js 9 Hardware Thin Instances
    this._treesPromise = this.treeLoader.load('/assets/realistic_tree.glb').then((templateMeshes) => {
      const count = treePositions.length;
      this.treeInstancesData = new Array(count);

      for (let i = 0; i < count; i++) {
        const cell = treePositions[i];
        // Deterministic natural orchard variation per tree
        const hash = Math.abs(Math.sin(cell.x * 12.9898 + cell.z * 78.233) * 43758.5453);
        const seed = hash - Math.floor(hash);
        const rotY = seed * Math.PI * 2;
        const baseScale = 0.92 + ((seed * 17.3) % 1.0) * 0.16;
        const sculptedY = this.getTerrainHeightAt ? (this.getTerrainHeightAt(cell.x, cell.z) - 0.04) : cell.y;

        this.treeInstancesData[i] = {
          x: cell.x,
          y: sculptedY,
          z: cell.z,
          rotY,
          baseScale,
          scaleX: baseScale,
          scaleY: baseScale,
          scaleZ: baseScale,
          seed,
          swayX: 0,
          swayZ: 0,
          ndvi: cell.ndvi ?? 0.78,
          temp: cell.temperatureC ?? cell.temperature ?? 22.0,
          canopyHeightM: cell.canopyHeightM ?? 4.25,
          trvM3Ha: cell.trvM3Ha ?? 13500
        };
      }

      // Compute initial 3D structural tree heights and crown volumes from CHM / NDVI
      this.updateTreeStructuralScales();

      this.thinTreeTemplates = templateMeshes.map((tmpl) => {
        const matrixBuffer = new Float32Array(count * 16);
        const colorBuffer = tmpl.isLeaf ? new Float32Array(count * 4) : null;

        for (let i = 0; i < count; i++) {
          const tData = this.treeInstancesData[i];
          this._tmpTreeScale.set(tData.scaleX, tData.scaleY, tData.scaleZ);
          this._tmpTreePos.set(tData.x, tData.y, tData.z);
          Quaternion.RotationYawPitchRollToRef(tData.rotY, 0, 0, this._tmpTreeQuat);
          Matrix.ComposeToRef(this._tmpTreeScale, this._tmpTreeQuat, this._tmpTreePos, this._tmpTreeWorldMat);
          tmpl.baseMatrix.multiplyToRef(this._tmpTreeWorldMat, this._tmpFinalTreeMat);
          this._tmpFinalTreeMat.copyToArray(matrixBuffer, i * 16);
        }

        const mesh = tmpl.mesh;
        mesh.setEnabled(true);
        mesh.thinInstanceSetBuffer('matrix', matrixBuffer, 16, false);
        // Set full-orchard world bounding volume so ShadowGenerator never culls instanced trees
        mesh.setBoundingInfo(new BoundingInfo(new Vector3(-110, -5, -110), new Vector3(110, 15, 110)));
        mesh.doNotSyncBoundingInfo = true;
        mesh.alwaysSelectAsActiveMesh = true;

        // Cast shadows for all 390 instanced trees in a single GPU instanced pass
        this.addShadowCasterSafe(mesh);

        const entry = {
          mesh,
          baseMatrix: tmpl.baseMatrix,
          isLeaf: tmpl.isLeaf,
          matrixBuffer,
          colorBuffer
        };

        if (tmpl.isLeaf && colorBuffer) {
          this.computeTreeCanopyColorArray(colorBuffer, this.store.getSensorMode());
          mesh.thinInstanceSetBuffer('color', colorBuffer, 4, false);
        }

        return entry;
      });

      if (this.onAssetProgress) this.onAssetProgress('trees_glb');
      console.log(`[CEAF DroneLab Chile] Hardware Thin Instances active: ${count} trees rendered in ${this.thinTreeTemplates.length} draw calls with dynamic CHM height & canopy tinting.`);
    }).catch(err => {
      if (this.onAssetProgress) this.onAssetProgress('trees_glb');
      console.warn('[CEAF DroneLab Chile] Tree GLB load error:', err);
    });
  }

  /**
   * Updates 3D structural height (scaleY) and crown width (scaleX, scaleZ) per tree
   * based on bio-physical LiDAR Canopy Height Model (CHM) and Tree Row Volume (TRV).
   */
  updateTreeStructuralScales() {
    if (!this.treeInstancesData || this.treeInstancesData.length === 0) return;
    const count = this.treeInstancesData.length;

    for (let i = 0; i < count; i++) {
      const t = this.treeInstancesData[i];
      const cell = this.field.calculateSpectralAt(t.x, t.y, t.z);
      const chm = cell.canopyHeightM || 4.25;
      t.canopyHeightM = chm;
      t.trvM3Ha = cell.trvM3Ha || 13500;
      t.ndvi = cell.ndvi ?? 0.78;
      t.temp = cell.temperatureC ?? 22.0;

      // Reference adult fruit tree height is 4.25m:
      // Stressed stunted trees (~2.5m) -> heightRatio ~0.60, High-vigor trees (~5.2m) -> heightRatio ~1.22
      const heightRatio = Math.max(0.55, Math.min(1.28, chm / 4.25));
      const widthRatio = Math.max(0.62, Math.min(1.20, 0.28 + 0.72 * heightRatio));

      t.scaleX = t.baseScale * widthRatio;
      t.scaleY = t.baseScale * heightRatio;
      t.scaleZ = t.baseScale * widthRatio;
    }
  }

  /**
   * Builds a 3D Airborne LiDAR Point Cloud (Babylon.js 9 PointsCloudSystem)
   * representing first/intermediate canopy returns and bare-earth DTM returns.
   */
  buildLidarPointCloud(treePositions) {
    this.lidarPointMeta = [];
    const pointsPerTree = 16;

    // 1. Canopy laser returns across all 390 orchard trees (hemispherical crown distribution)
    for (let i = 0; i < treePositions.length; i++) {
      const tp = treePositions[i];
      for (let p = 0; p < pointsPerTree; p++) {
        // Golden angle spiral distribution on crown dome + interior branch returns
        const t = (p + 0.5) / pointsPerTree;
        const theta = p * 2.3999632 + (i * 0.47);
        const layerRadius = Math.sqrt(1.0 - t * 0.82) * (1.25 + ((p % 3) * 0.22));
        const offsetX = Math.cos(theta) * layerRadius;
        const offsetZ = Math.sin(theta) * layerRadius;
        // Normalized height within crown (from 0.30 lower skirt up to 1.02 apex)
        const normY = 0.30 + t * 0.72;

        this.lidarPointMeta.push({
          isCanopy: true,
          x: tp.x,
          groundY: tp.y,
          z: tp.z,
          offsetX,
          offsetZ,
          normY
        });
      }
    }

    // 2. Bare-earth DTM ground scan returns along inter-rows and service paths
    for (let gx = -74; gx <= 74; gx += 4.0) {
      for (let gz = -74; gz <= 74; gz += 4.0) {
        const maxCoord = Math.max(Math.abs(gx), Math.abs(gz));
        const edgeFade = maxCoord > 75 ? Math.max(0, (100 - maxCoord) / 25) : 1.0;
        const gy = Math.sin(gx * 0.04) * Math.cos(gz * 0.04) * 1.5 * edgeFade;
        this.lidarPointMeta.push({
          isCanopy: false,
          x: gx,
          groundY: gy,
          z: gz,
          offsetX: 0,
          offsetZ: 0,
          normY: 0
        });
      }
    }

    const totalPoints = this.lidarPointMeta.length;
    this.lidarPCS = new PointsCloudSystem('lidarPointCloud', 3.8, this.scene);

    const evaluatePoint = (particle, idx) => {
      const meta = this.lidarPointMeta[idx];
      if (!meta) return;

      if (meta.isCanopy) {
        const cell = this.field.calculateSpectralAt(meta.x, meta.groundY, meta.z);
        const chm = cell.canopyHeightM || 4.25;
        const widthScale = Math.max(0.62, Math.min(1.22, 0.28 + 0.72 * (chm / 4.25)));
        const pointAGL = meta.normY * chm;

        particle.position.set(
          meta.x + meta.offsetX * widthScale,
          meta.groundY + pointAGL,
          meta.z + meta.offsetZ * widthScale
        );

        // Hypsometric LiDAR CHM color ramp by laser return elevation above ground (pointAGL)
        let r, g, b;
        if (pointAGL < 2.2) {
          // Lower skirt / stunted canopy: Cyan -> Amber
          const k = Math.max(0, Math.min(1, (pointAGL - 1.0) / 1.2));
          r = 0.12 + k * 0.84;
          g = 0.82 - k * 0.12;
          b = 0.88 - k * 0.72;
        } else if (pointAGL < 3.5) {
          // Low-to-medium canopy: Amber -> Lime Green
          const k = (pointAGL - 2.2) / 1.3;
          r = 0.96 - k * 0.65;
          g = 0.70 + k * 0.25;
          b = 0.16 + k * 0.15;
        } else if (pointAGL < 4.55) {
          // Standard adult canopy: Emerald Green -> Cyan-Green
          const k = (pointAGL - 3.5) / 1.05;
          r = 0.31 - k * 0.15;
          g = 0.95;
          b = 0.31 + k * 0.45;
        } else {
          // Dominant high-vigor crown apex (> 4.55m): Electric Violet / Laser Magenta
          const k = Math.min(1, (pointAGL - 4.55) / 0.85);
          r = 0.65 + k * 0.32;
          g = 0.42 - k * 0.15;
          b = 0.98;
        }
        particle.color = new Color4(r, g, b, 0.95);
      } else {
        // Bare-earth DTM ground return (Deep LiDAR Telemetry Blue)
        particle.position.set(meta.x, meta.groundY + 0.10, meta.z);
        particle.color = new Color4(0.14, 0.48, 0.92, 0.75);
      }
    };

    this.lidarPCS.addPoints(totalPoints, (particle, i) => {
      evaluatePoint(particle, i);
    });

    this.lidarPCS.updateParticle = (particle) => {
      evaluatePoint(particle, particle.idx);
      return particle;
    };

    this.lidarPCS.buildMeshAsync().then((mesh) => {
      this.lidarMesh = mesh;
      this.lidarMesh.alwaysSelectAsActiveMesh = true;
      this.lidarMesh.isPickable = false;
      if (this.lidarMesh.material) {
        this.lidarMesh.material.emissiveColor = new Color3(1, 1, 1);
        this.lidarMesh.material.disableLighting = true;
      }
      this.lidarMesh.setEnabled(this.store.getSensorMode() === 'elevation');
    });
  }

  updateLidarPointCloud() {
    if (this.lidarPCS && this.lidarMesh) {
      this.lidarPCS.setParticles();
    }
  }

  /**
   * Computes per-tree canopy RGBA color buffer based on active sensor mode and local agronomic vigor/stress
   */
  computeTreeCanopyColorArray(colorBuffer, sensorMode, filterCenter = null, filterRadius = Infinity) {
    if (!this.treeInstancesData || !colorBuffer) return;
    const count = this.treeInstancesData.length;

    for (let i = 0; i < count; i++) {
      const t = this.treeInstancesData[i];
      if (filterCenter) {
        if (Math.abs(t.x - filterCenter.x) > filterRadius || Math.abs(t.z - filterCenter.z) > filterRadius) {
          continue;
        }
      }

      const cell = this.field.calculateSpectralAt(t.x, t.y, t.z);
      t.ndvi = cell.ndvi ?? 0.78;
      t.temp = cell.temperatureC ?? cell.temperature ?? 22.0;

      const cIdx = i * 4;
      if (sensorMode === 'rgb') {
        const natVar = 0.94 + t.seed * 0.12;
        if (cell.ndvi < 0.46) {
          // Árbol con estrés hídrico/fitosanitario severo: clorosis foliar ámbar/ocre visible en RGB
          const stressIntensity = Math.max(0, Math.min(1, (0.48 - cell.ndvi) / 0.24));
          colorBuffer[cIdx]     = (0.98 + stressIntensity * 0.36) * natVar;
          colorBuffer[cIdx + 1] = (1.02 - stressIntensity * 0.22) * natVar;
          colorBuffer[cIdx + 2] = (0.92 - stressIntensity * 0.45) * natVar;
          colorBuffer[cIdx + 3] = 1.0;
        } else if (cell.ndvi < 0.64) {
          // Estrés moderado / transición
          const mod = (0.64 - cell.ndvi) / 0.18;
          colorBuffer[cIdx]     = (0.98 + mod * 0.12) * natVar;
          colorBuffer[cIdx + 1] = (1.03 - mod * 0.03) * natVar;
          colorBuffer[cIdx + 2] = (0.92 - mod * 0.16) * natVar;
          colorBuffer[cIdx + 3] = 1.0;
        } else {
          // Vigor óptimo: follaje verde esmeralda fresco del Valle de O'Higgins
          const vigorBoost = Math.min(1, (cell.ndvi - 0.64) / 0.28) * 0.08;
          colorBuffer[cIdx]     = (0.95 - vigorBoost * 0.05) * natVar;
          colorBuffer[cIdx + 1] = (1.03 + vigorBoost) * natVar;
          colorBuffer[cIdx + 2] = (0.92 - vigorBoost * 0.04) * natVar;
          colorBuffer[cIdx + 3] = 1.0;
        }
      } else if (sensorMode === 'ndvi') {
        colorBuffer[cIdx]     = cell.ndviColor[0] * 1.15;
        colorBuffer[cIdx + 1] = cell.ndviColor[1] * 1.15;
        colorBuffer[cIdx + 2] = cell.ndviColor[2] * 1.15;
        colorBuffer[cIdx + 3] = 1.0;
      } else if (sensorMode === 'thermal') {
        colorBuffer[cIdx]     = cell.thermalColor[0] * 1.15;
        colorBuffer[cIdx + 1] = cell.thermalColor[1] * 1.15;
        colorBuffer[cIdx + 2] = cell.thermalColor[2] * 1.15;
        colorBuffer[cIdx + 3] = 1.0;
      } else if (sensorMode === 'elevation') {
        colorBuffer[cIdx]     = cell.elevationColor[0] * 1.15;
        colorBuffer[cIdx + 1] = cell.elevationColor[1] * 1.15;
        colorBuffer[cIdx + 2] = cell.elevationColor[2] * 1.15;
        colorBuffer[cIdx + 3] = 1.0;
      }
    }
  }

  updateOrchardTreeColors(sensorMode, filterCenter = null, filterRadius = Infinity) {
    if (!this.thinTreeTemplates || this.thinTreeTemplates.length === 0) return;
    for (let i = 0; i < this.thinTreeTemplates.length; i++) {
      const tmpl = this.thinTreeTemplates[i];
      if (tmpl.isLeaf && tmpl.colorBuffer) {
        this.computeTreeCanopyColorArray(tmpl.colorBuffer, sensorMode, filterCenter, filterRadius);
        tmpl.mesh.thinInstanceBufferUpdated('color');
      }
    }
  }

  createProceduralDroneMesh() {
    const group = new TransformNode('proceduralDrone', this.scene);

    const body = MeshBuilder.CreateBox('pDroneBody', { width: 0.6, height: 0.15, depth: 0.8 }, this.scene);
    const bodyMat = new StandardMaterial('bodyMat', this.scene);
    bodyMat.diffuseColor = new Color3(0.12, 0.16, 0.23);
    body.material = bodyMat;
    body.parent = group;

    const armMat = new StandardMaterial('armMat', this.scene);
    armMat.diffuseColor = new Color3(0.20, 0.25, 0.33);

    const arm1 = MeshBuilder.CreateCylinder('arm1', { height: 1.6, diameter: 0.08 }, this.scene);
    arm1.rotation.z = Math.PI / 2;
    arm1.rotation.y = Math.PI / 4;
    arm1.material = armMat;
    arm1.parent = group;

    const arm2 = MeshBuilder.CreateCylinder('arm2', { height: 1.6, diameter: 0.08 }, this.scene);
    arm2.rotation.z = Math.PI / 2;
    arm2.rotation.y = -Math.PI / 4;
    arm2.material = armMat;
    arm2.parent = group;

    const propMat = new StandardMaterial('propMat', this.scene);
    propMat.diffuseColor = new Color3(0.06, 0.09, 0.16);

    this.proceduralProps = [];
    const positions = [
      [0.6, 0.1, 0.6],
      [-0.6, 0.1, 0.6],
      [0.6, 0.1, -0.6],
      [-0.6, 0.1, -0.6]
    ];

    positions.forEach(([x, y, z], i) => {
      const prop = MeshBuilder.CreateBox(`pProp_${i}`, { width: 0.7, height: 0.01, depth: 0.06 }, this.scene);
      prop.position.set(x, y, z);
      prop.material = propMat;
      prop.parent = group;
      this.proceduralProps.push(prop);
    });

    return group;
  }

  buildSensorCone() {
    // Unit cone pointing downward: height 1.0, apex at Y=0, base at Y=-1
    this.sensorConeMesh = MeshBuilder.CreateCylinder('sensorCone', {
      height: 1.0,
      diameterTop: 0.001,
      diameterBottom: 2.0,
      tessellation: 24
    }, this.scene);

    // Shift vertices so apex is pinned at local origin (0, 0, 0)
    this.sensorConeMesh.bakeTransformIntoVertices(Matrix.Translation(0, -0.5, 0));

    this.sensorConeMat = new StandardMaterial('sensorConeMat', this.scene);
    this.sensorConeMat.diffuseColor = new Color3(0.13, 0.77, 0.37);
    this.sensorConeMat.emissiveColor = new Color3(0.13, 0.77, 0.37);
    this.sensorConeMat.alpha = 0.35;
    this.sensorConeMat.backFaceCulling = false;

    this.sensorConeMesh.material = this.sensorConeMat;
    this.sensorConeMesh.setEnabled(false);
  }

  createSprayMistDynamicTexture() {
    const dt = new DynamicTexture('sprayTexture', { width: 64, height: 64 }, this.scene, false);
    const ctx = dt.getContext();

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.2, 'rgba(224, 242, 254, 0.85)');
    grad.addColorStop(0.5, 'rgba(186, 230, 253, 0.4)');
    grad.addColorStop(1.0, 'rgba(186, 230, 253, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    dt.update();
    return dt;
  }

  buildSprayParticleSystems() {
    this.sprayParticleSystems = [];
    this.sprayCooldown = 0;
    const mistTexture = this.createSprayMistDynamicTexture();
    const useGPU = GPUParticleSystem.IsSupported;

    // 4 physical conical spray nozzle positions matching the 3D model chassis
    const nozzleOffsets = [
      [ 0.68, 0.09,  0.40],
      [ 0.68, 0.09, -0.40],
      [-0.68, 0.09, -0.40],
      [-0.68, 0.09,  0.40]
    ];

    nozzleOffsets.forEach((pos, idx) => {
      const emitterNode = new TransformNode(`nozzleEmitter_${idx}`, this.scene);
      emitterNode.position.set(pos[0], pos[1], pos[2]);
      emitterNode.parent = this.droneGroup;

      const ps = useGPU
        ? new GPUParticleSystem(`sprayPs_${idx}`, { capacity: 3500, emitRateControl: true }, this.scene)
        : new ParticleSystem(`sprayPs_${idx}`, 2000, this.scene);

      ps.particleTexture = mistTexture;
      ps.emitter = emitterNode;

      // Conical Downwash Spray: Emitter directed strictly downward (-Y) with 26-degree cone expansion
      const coneEmitter = ps.createDirectedConeEmitter(
        0.04,
        (26 * Math.PI) / 180,
        new Vector3(-0.20, -1.0, -0.20),
        new Vector3(0.20, -1.0, 0.20)
      );
      coneEmitter.emitFromSpawnPointOnly = true;

      // Soft mist atomization colors
      ps.color1 = new Color4(0.92, 0.98, 1.0, 0.75);
      ps.color2 = new Color4(0.65, 0.88, 0.99, 0.40);
      ps.colorDead = new Color4(0.65, 0.88, 0.99, 0.0);

      // Micro-droplets atomizados a alta presión
      ps.minSize = 0.035;
      ps.maxSize = 0.12;

      // Fast transit to ground due to extreme propeller downwash speed
      ps.minLifeTime = 0.08;
      ps.maxLifeTime = 0.42;

      ps.emitRate = 0;
      ps.blendMode = ParticleSystem.BLENDMODE_ADD;

      // Extreme downward blast acceleration driven by carbon-fiber rotor downwash airflow (~180-240 km/h)
      ps.gravity = new Vector3(0, -85.0, 0);
      ps.minEmitPower = 55.0;
      ps.maxEmitPower = 88.0;
      ps.updateSpeed = 0.016;

      this.sprayParticleSystems.push(ps);
    });

    if (useGPU) {
      console.log('[CEAF DroneLab Chile] Babylon 9 GPUParticleSystem activado para las 4 boquillas de pulverización (14,000 micro-gotas GPU de alta velocidad impulsadas por downwash).');
    }

    // 3D Ground Spray Footprint Ring (shows active atomization swath on the terrain)
    this.sprayFootprintMesh = MeshBuilder.CreateDisc('sprayFootprint', {
      radius: 1.0,
      tessellation: 48
    }, this.scene);
    this.sprayFootprintMesh.rotation.x = Math.PI / 2;

    const footprintDt = new DynamicTexture('sprayFootprintTex', { width: 128, height: 128 }, this.scene, false);
    const fCtx = footprintDt.getContext();
    const fGrad = fCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
    fGrad.addColorStop(0.0, 'rgba(56, 189, 248, 0.28)');
    fGrad.addColorStop(0.55, 'rgba(16, 185, 129, 0.22)');
    fGrad.addColorStop(0.85, 'rgba(56, 189, 248, 0.55)');
    fGrad.addColorStop(0.96, 'rgba(125, 211, 252, 0.75)');
    fGrad.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
    fCtx.fillStyle = fGrad;
    fCtx.fillRect(0, 0, 128, 128);
    footprintDt.hasAlpha = true;
    footprintDt.update();

    const footprintMat = new StandardMaterial('sprayFootprintMat', this.scene);
    footprintMat.diffuseTexture = footprintDt;
    footprintMat.emissiveTexture = footprintDt;
    footprintMat.useAlphaFromDiffuseTexture = true;
    footprintMat.disableLighting = true;
    footprintMat.backFaceCulling = false;
    footprintMat.alpha = 0.75;

    this.sprayFootprintMesh.material = footprintMat;
    this.sprayFootprintMesh.setEnabled(false);
  }

  /**
   * Babylon.js 9 GPUParticleSystem for Rotor Downwash Soil Dust & Ground Vortex Ring
   * Simulates radial aerodynamic ground-effect dust when hovering/flying low (< 6.5m) over O'Higgins soil
   */
  buildDownwashParticleSystem() {
    this.downwashEmitterNode = new TransformNode('downwashEmitterNode', this.scene);
    this.downwashCooldown = 0;

    const dt = new DynamicTexture('downwashDustTex', { width: 64, height: 64 }, this.scene, false);
    const ctx = dt.getContext();
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0.0, 'rgba(214, 196, 168, 0.65)');
    grad.addColorStop(0.45, 'rgba(188, 168, 140, 0.35)');
    grad.addColorStop(0.80, 'rgba(168, 148, 120, 0.12)');
    grad.addColorStop(1.0, 'rgba(168, 148, 120, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    dt.update();

    const useGPU = GPUParticleSystem.IsSupported;
    this.downwashPS = useGPU
      ? new GPUParticleSystem('rotorDownwashGPU', { capacity: 1800, emitRateControl: true }, this.scene)
      : new ParticleSystem('rotorDownwashCPU', 900, this.scene);

    this.downwashPS.particleTexture = dt;
    this.downwashPS.emitter = this.downwashEmitterNode;

    // Flat radial ring emitter on the soil surface expanding outward
    this.downwashPS.createCylinderEmitter(1.15, 0.12, 0.35, 0.12);

    this.downwashPS.color1 = new Color4(0.82, 0.74, 0.62, 0.26);
    this.downwashPS.color2 = new Color4(0.72, 0.64, 0.52, 0.16);
    this.downwashPS.colorDead = new Color4(0.65, 0.58, 0.48, 0.0);

    this.downwashPS.minSize = 0.28;
    this.downwashPS.maxSize = 0.85;
    this.downwashPS.minLifeTime = 0.25;
    this.downwashPS.maxLifeTime = 0.65;
    this.downwashPS.emitRate = 0;
    this.downwashPS.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.downwashPS.gravity = new Vector3(0, 0.45, 0); // Slight upward curl at the outer vortex edge
    this.downwashPS.minEmitPower = 4.5;
    this.downwashPS.maxEmitPower = 11.5;
    this.downwashPS.updateSpeed = 0.016;
  }

  applyTerrainSprayEffect(px, py, pz, dt) {
    if (!this.field || !this.terrainPositions) return;

    const flowRate = this.store.getFlowRate();
    const res = this.field.applySprayAt(px, pz, py, flowRate, dt);
    this.store.updateSprayCoverage(res.treatedAreaM2, res.stressRecoveryPct);

    // Position 3D ground impact ring on terrain beneath the drone
    if (this.sprayFootprintMesh && res.swathRadius > 0) {
      const maxCoord = Math.max(Math.abs(px), Math.abs(pz));
      const edgeFade = maxCoord > 75 ? Math.max(0, (100 - maxCoord) / 25) : 1.0;
      const groundY = Math.sin(px * 0.04) * Math.cos(pz * 0.04) * 1.5 * edgeFade;

      this.sprayFootprintMesh.setEnabled(true);
      this.sprayFootprintMesh.position.set(px, groundY + 0.14, pz);
      const pulse = 1.0 + Math.sin((this.windTime || 0) * 10.0) * 0.03;
      const r = res.swathRadius * pulse;
      this.sprayFootprintMesh.scaling.set(r, r, 1.0);
    }

    if (res.modified) {
      const positions = this.terrainPositions;
      const vertexCount = positions.length / 3;
      const updateRadius = res.swathRadius + 3.0;

      for (let i = 0; i < vertexCount; i++) {
        const vx = positions[i * 3];
        const vz = positions[i * 3 + 2];

        if (Math.abs(vx - px) <= updateRadius && Math.abs(vz - pz) <= updateRadius) {
          const vy = positions[i * 3 + 1];
          const cell = this.field.calculateSpectralAt(vx, vy, vz);
          const colorIdx = i * 4;
          const tint = cell.rgbVertexTint || [1.0, 1.0, 1.0];

          this.colorsRGB[colorIdx] = tint[0];
          this.colorsRGB[colorIdx + 1] = tint[1];
          this.colorsRGB[colorIdx + 2] = tint[2];

          this.colorsNDVI[colorIdx] = cell.ndviColor[0];
          this.colorsNDVI[colorIdx + 1] = cell.ndviColor[1];
          this.colorsNDVI[colorIdx + 2] = cell.ndviColor[2];

          this.colorsThermal[colorIdx] = cell.thermalColor[0];
          this.colorsThermal[colorIdx + 1] = cell.thermalColor[1];
          this.colorsThermal[colorIdx + 2] = cell.thermalColor[2];

          this.colorsElevation[colorIdx] = cell.elevationColor[0];
          this.colorsElevation[colorIdx + 1] = cell.elevationColor[1];
          this.colorsElevation[colorIdx + 2] = cell.elevationColor[2];
        }
      }

      this.terrainColorsDirty = true;
      // Dynamically update Thin Instance canopy colors and structural recovery of trees inside the treated swath
      this.updateTreeStructuralScales();
      this.updateOrchardTreeColors(this.store.getSensorMode(), { x: px, z: pz }, updateRadius + 2.5);
      if (this.store.getSensorMode() === 'elevation') {
        this.updateLidarPointCloud();
      }
    }
  }

  updateMultispectralView(sensorMode) {
    if (!this.terrainMesh) return;

    if (this.lastSensorMode === sensorMode && !this.terrainColorsDirty) {
      return;
    }

    const modeChanged = this.lastSensorMode !== sensorMode;

    let targetColors = this.colorsNDVI;
    let coneColor = new Color3(0.13, 0.77, 0.37);

    if (sensorMode === 'rgb') {
      targetColors = this.colorsRGB;
      coneColor = new Color3(0.22, 0.74, 0.97);
      if (this.terrainMaterial) {
        this.terrainMaterial.diffuseTexture = this.groundTexture;
        this.terrainMaterial.bumpTexture = this.groundBumpTexture;
      }
    } else {
      if (this.terrainMaterial) {
        this.terrainMaterial.diffuseTexture = null;
        this.terrainMaterial.bumpTexture = null;
      }
      if (sensorMode === 'thermal') {
        targetColors = this.colorsThermal;
        coneColor = new Color3(0.96, 0.62, 0.07);
      } else if (sensorMode === 'elevation') {
        targetColors = this.colorsElevation;
        coneColor = new Color3(0.66, 0.33, 0.97);
      }
    }

    if (targetColors) {
      this.terrainMesh.updateVerticesData(VertexBuffer.ColorKind, targetColors);
    }

    if (this.sensorConeMat) {
      this.sensorConeMat.diffuseColor = coneColor;
      this.sensorConeMat.emissiveColor = coneColor;
    }

    if (this.lidarMesh) {
      this.lidarMesh.setEnabled(sensorMode === 'elevation');
    }

    if (modeChanged) {
      this.updateOrchardTreeColors(sensorMode);
      if (sensorMode === 'elevation') {
        this.updateLidarPointCloud();
      }
    }

    this.lastSensorMode = sensorMode;
    this.terrainColorsDirty = false;
  }

  updateDroneTypeVisibility(type) {
    const isSprayer = type === 'sprayer';

    if (this.sprayerDroneObj && this.sprayerDroneObj.model) {
      this.sprayerDroneObj.model.setEnabled(isSprayer);
    }
    if (this.multispectralDroneObj && this.multispectralDroneObj.model) {
      this.multispectralDroneObj.model.setEnabled(!isSprayer);
    }

    if (this.proceduralDroneMesh) {
      const hasLoaded = isSprayer ? !!this.sprayerDroneObj : !!this.multispectralDroneObj;
      this.proceduralDroneMesh.setEnabled(!hasLoaded);
    }
  }

  buildPostProcessing() {
    // 0. Native 100% Hardware Resolution for GTX 1060 6GB (crisp sub-pixel detail without downscale blur)
    this.engine.setHardwareScalingLevel(1.0);

    // 1. Babylon.js 9 Default Cinematic Rendering Pipeline (HDR + MSAA 4x + Sharpen + ACES)
    this.pipeline = new DefaultRenderingPipeline(
      'defaultPipeline',
      true, // HDR float framebuffer enabled
      this.scene,
      [this.babylonCamera]
    );

    // Anti-Aliasing (MSAA 4x + FXAA)
    this.pipeline.samples = 4;
    this.pipeline.fxaaEnabled = true;

    // Contrast-Adaptive Optical Sharpening (restores crisp bark, leaf, and soil clod micro-textures at 1080p)
    this.pipeline.sharpenEnabled = true;
    this.pipeline.sharpen.edgeAmount = 0.28;
    this.pipeline.sharpen.colorAmount = 1.0;

    // Photographic Bloom (Solar radiance, metallic drone reflections & spray mist highlights)
    this.pipeline.bloomEnabled = true;
    this.pipeline.bloomThreshold = 0.85;
    this.pipeline.bloomWeight = 0.24;
    this.pipeline.bloomKernel = 64;
    this.pipeline.bloomScale = 0.5;

    // Subtle Aerial Gimbal Lens Chromatic Aberration (peripheral radial only)
    this.pipeline.chromaticAberrationEnabled = true;
    this.pipeline.chromaticAberration.aberrationAmount = 4.0;
    this.pipeline.chromaticAberration.radialIntensity = 0.65;

    // Cinematic Tone Mapping (ACES filmic curve calibrated for rich shadow contrast & natural chlorophyll greens)
    this.pipeline.imageProcessingEnabled = true;
    this.pipeline.imageProcessing.toneMappingEnabled = true;
    this.pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.pipeline.imageProcessing.exposure = 1.16;
    this.pipeline.imageProcessing.contrast = 1.14;

    // Optical Lens Vignette
    this.pipeline.imageProcessing.vignetteEnabled = true;
    this.pipeline.imageProcessing.vignetteWeight = 0.85;
    this.pipeline.imageProcessing.vignetteStretch = 0.50;
    this.pipeline.imageProcessing.vignetteColor = new Color4(0.02, 0.04, 0.06, 0.0);

    // 3. Optional AMD FidelityFX Super Resolution 1.0 (FSR 1) toggleable from Drone Selection Modal
    this.setFsrEnabled(this.store.getFsrEnabled ? this.store.getFsrEnabled() : false);
  }

  /**
   * Dynamically enables or disables AMD FidelityFX Super Resolution 1.0 (FSR 1) upscaling
   */
  setFsrEnabled(enabled) {
    if (!this.scene || !this.babylonCamera) return;

    if (enabled) {
      try {
        if (!this.fsrPipeline) {
          this.fsrPipeline = new FSR1RenderingPipeline('fsrPipeline', this.scene, [this.babylonCamera]);
        }
        if (this.fsrPipeline.isSupported) {
          this.fsrPipeline.scaleFactor = FSR1RenderingPipeline.SCALE_QUALITY; // 1.5x upscaling (67% internal res)
          this.fsrPipeline.sharpnessStops = 0.2; // RCAS contrast-adaptive sharpening
          if (this.pipeline) {
            this.pipeline.sharpenEnabled = false; // Avoid double-sharpening with RCAS
          }
          console.log('[CEAF DroneLab Chile] AMD FidelityFX Super Resolution (FSR 1.0) ACTIVADO (Quality 1.5x).');
        }
      } catch (err) {
        console.warn('[CEAF DroneLab Chile] Error al activar FSR 1.0:', err);
      }
    } else {
      if (this.fsrPipeline) {
        try {
          this.fsrPipeline.dispose();
        } catch (e) {
          // ignore disposal warning
        }
        this.fsrPipeline = null;
      }
      this.engine.setHardwareScalingLevel(1.0);
      if (this.pipeline) {
        this.pipeline.sharpenEnabled = true;
      }
      console.log('[CEAF DroneLab Chile] Resolución Nativa 100% + MSAA 4x + CAS activa (FSR 1.0 desactivado).');
    }
  }

  onResize() {
    this.aspectRatio = window.innerWidth / window.innerHeight;
    this.engine.resize();
  }

  render(dt) {
    const droneState = this.store.getDroneState();
    const dronePos = droneState.position;
    const droneRot = droneState.rotation;
    const sensorMode = this.store.getSensorMode();
    const motorSpinPct = this.store.motorSpinPct !== undefined ? this.store.motorSpinPct : 0.0;
    const motorPower = this.store.getMotorPower();
    const droneType = this.store.getDroneType();

    // 1. Update 4-Nozzle GPU Spray Mist & Apply Real-Time Agronomic Terrain Treatment
    const flowRate = this.store.getFlowRate();
    const isSpraying = (droneType === 'sprayer' && this.store.getSprayPumpState() === 'on' && dronePos[1] > 0.3 && motorPower !== 'off' && flowRate > 0.05);
    if (isSpraying) {
      this.applyTerrainSprayEffect(dronePos[0], dronePos[1], dronePos[2], dt);
      this.sprayCooldown = 0.6;
    } else {
      if (this.sprayFootprintMesh && this.sprayFootprintMesh.isEnabled()) {
        this.sprayFootprintMesh.setEnabled(false);
      }
      if (this.sprayCooldown > 0) {
        this.sprayCooldown = Math.max(0, this.sprayCooldown - dt);
      }
    }

    if (this.sprayParticleSystems && this.sprayParticleSystems.length > 0) {
      // Scale particle density and downwash thrust dynamically with VRA flow rate and motor RPM
      const targetEmitRate = isSpraying ? Math.round(1100 + (flowRate / 2.4) * 1600) : 0;
      const downwashFactor = 0.85 + motorSpinPct * 0.45;
      const curMinPower = 55.0 * downwashFactor;
      const curMaxPower = 88.0 * downwashFactor;

      this.sprayParticleSystems.forEach(ps => {
        ps.emitRate = targetEmitRate;
        if (isSpraying) {
          ps.minEmitPower = curMinPower;
          ps.maxEmitPower = curMaxPower;
          if (!ps.isStarted() || (typeof ps.isStopped === 'function' && ps.isStopped())) {
            ps.start();
          }
        } else if (this.sprayCooldown <= 0) {
          if (ps.isStarted() && (typeof ps.isStopped !== 'function' || !ps.isStopped())) {
            ps.stop();
            if (typeof ps.reset === 'function') ps.reset();
          }
        }
      });
    }

    // 1b. Update Rotor Downwash Soil Dust & Ground Vortex Ring (GPUParticleSystem)
    if (this.downwashPS && this.downwashEmitterNode) {
      const maxCoord = Math.max(Math.abs(dronePos[0]), Math.abs(dronePos[2]));
      const edgeFade = maxCoord > 75 ? Math.max(0, (100 - maxCoord) / 25) : 1.0;
      const groundY = Math.sin(dronePos[0] * 0.04) * Math.cos(dronePos[2] * 0.04) * 1.5 * edgeFade;
      const agl = dronePos[1] - groundY;

      const isDownwashActive = (motorPower !== 'off' && motorSpinPct > 0.15 && agl > 0.02 && agl < 6.5);
      if (isDownwashActive) {
        this.downwashEmitterNode.position.set(dronePos[0], groundY + 0.10, dronePos[2]);
        const intensity = Math.max(0, Math.min(1, 1.0 - agl / 6.5)) * motorSpinPct;
        this.downwashPS.emitRate = Math.round(intensity * 950);
        this.downwashCooldown = 0.75;
        if (!this.downwashPS.isStarted() || (typeof this.downwashPS.isStopped === 'function' && this.downwashPS.isStopped())) {
          this.downwashPS.start();
        }
      } else {
        this.downwashPS.emitRate = 0;
        if (this.downwashCooldown > 0) {
          this.downwashCooldown = Math.max(0, this.downwashCooldown - dt);
        } else if (this.downwashPS.isStarted() && (typeof this.downwashPS.isStopped !== 'function' || !this.downwashPS.isStopped())) {
          this.downwashPS.stop();
          if (typeof this.downwashPS.reset === 'function') this.downwashPS.reset();
        }
      }
    }

    // 2. Update Multispectral Terrain Colors
    this.updateMultispectralView(sensorMode);

    // 3. Update Drone Group Position & Rotation
    this.droneGroup.position.set(dronePos[0], dronePos[1], dronePos[2]);
    this.droneGroup.rotation.set(droneRot[0], droneRot[1], droneRot[2]);

    // 4. Update Procedural Rotor Blades (if fallback active)
    if (this.proceduralProps && this.proceduralDroneMesh.isEnabled()) {
      this.proceduralProps.forEach((prop, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        prop.rotation.y += dt * 35.0 * motorSpinPct * dir;
      });
    }

    // 5. Update GLB Drone Animations & Rotor Blades
    const activeObj = droneType === 'sprayer' ? this.sprayerDroneObj : this.multispectralDroneObj;
    if (activeObj) {
      if (activeObj.animationGroup) {
        if (motorPower === 'off') {
          activeObj.animationGroup.pause();
        } else {
          if (!activeObj.animationGroup.isPlaying) {
            activeObj.animationGroup.play(true);
          }
          activeObj.animationGroup.speedRatio = motorSpinPct * 2.5;
        }
      }

      if (activeObj.propMeshes && activeObj.propMeshes.length > 0 && motorPower !== 'off') {
        activeObj.propMeshes.forEach((prop, i) => {
          const dir = prop.spinDir !== undefined ? prop.spinDir : (i % 2 === 0 ? 1 : -1);
          prop.rotate(Vector3.Up(), dt * 65.0 * motorSpinPct * dir, Space.LOCAL);
        });
      }
    }

    // 6. Update Sensor Cone Position & Ground Footprint
    if (dronePos[1] > 0.9 && motorPower !== 'off' && droneType === 'multispectral') {
      this.sensorConeMesh.setEnabled(true);
      // Apex pinned right under the camera belly
      this.sensorConeMesh.position.set(dronePos[0], dronePos[1] - 0.15, dronePos[2]);
      // Ground footprint reaches ground: height = dronePos[1] - 0.15
      const beamHeight = Math.max(0.1, dronePos[1] - 0.15);
      const groundRadius = beamHeight * Math.tan((22 * Math.PI) / 180);
      this.sensorConeMesh.scaling.set(groundRadius, beamHeight, groundRadius);
    } else {
      this.sensorConeMesh.setEnabled(false);
    }

    // 7. Rotor Downwash Turbulence on Thin-Instanced Orchard Trees (Zero VBO uploads when idle/high)
    this.windTime = (this.windTime || 0) + dt;
    const wTime = this.windTime;
    const isDroneLow = (dronePos[1] < 14.0 && motorPower !== 'off');

    if (this.thinTreeTemplates && this.thinTreeTemplates.length > 0 && this.treeInstancesData.length > 0) {
      if (isDroneLow || this._treesHaveDownwash) {
        const count = this.treeInstancesData.length;
        const numTmpl = this.thinTreeTemplates.length;
        let anyModified = false;
        let anyStillDisplaced = false;

        for (let i = 0; i < count; i++) {
          const tData = this.treeInstancesData[i];
          const bx = tData.x;
          const bz = tData.z;

          let swayX = 0;
          let swayZ = 0;

          if (isDroneLow) {
            const dx = bx - dronePos[0];
            const dz = bz - dronePos[2];
            const distSq = dx * dx + dz * dz;
            if (distSq < 64.0) { // Within 8 meters radius of active drone rotors
              const dist = Math.sqrt(distSq);
              const factor = (1.0 - dist / 8.0) * motorSpinPct * 0.085;
              const normX = dist > 0.1 ? dx / dist : 0;
              const normZ = dist > 0.1 ? dz / dist : 1;
              swayX = normX * factor + (Math.sin(wTime * 12.0 + i) * factor * 0.25);
              swayZ = normZ * factor + (Math.cos(wTime * 14.0 + i) * factor * 0.25);
              anyStillDisplaced = true;
            }
          }

          const prevX = tData.swayX || 0;
          const prevZ = tData.swayZ || 0;
          if (Math.abs(swayX - prevX) > 0.0005 || Math.abs(swayZ - prevZ) > 0.0005) {
            tData.swayX = swayX;
            tData.swayZ = swayZ;
            anyModified = true;

            this._tmpTreeScale.set(tData.scaleX, tData.scaleY, tData.scaleZ);
            this._tmpTreePos.set(bx, tData.y, bz);
            Quaternion.RotationYawPitchRollToRef(tData.rotY, swayX, swayZ, this._tmpTreeQuat);
            Matrix.ComposeToRef(this._tmpTreeScale, this._tmpTreeQuat, this._tmpTreePos, this._tmpTreeWorldMat);

            const offset = i * 16;
            for (let m = 0; m < numTmpl; m++) {
              const tmpl = this.thinTreeTemplates[m];
              tmpl.baseMatrix.multiplyToRef(this._tmpTreeWorldMat, this._tmpFinalTreeMat);
              this._tmpFinalTreeMat.copyToArray(tmpl.matrixBuffer, offset);
            }
          }
        }

        this._treesHaveDownwash = anyStillDisplaced;

        if (anyModified) {
          for (let m = 0; m < numTmpl; m++) {
            this.thinTreeTemplates[m].mesh.thinInstanceBufferUpdated('matrix');
          }
        }
      }
    }

    // 8. Update Camera Target & Position
    this.camera.update(dronePos, droneRot, this.aspectRatio, dt);
    this.babylonCamera.position.set(this.camera.position[0], this.camera.position[1], this.camera.position[2]);
    this._tmpCamTarget.set(this.camera.target[0], this.camera.target[1], this.camera.target[2]);
    this.babylonCamera.setTarget(this._tmpCamTarget);

    // 9. Render Babylon.js Frame (Managed by engine.runRenderLoop)
    this.scene.render();
  }
}
