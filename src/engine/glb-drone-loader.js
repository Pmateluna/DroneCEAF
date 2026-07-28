import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * GLTFMaterialsPbrSpecularGlossinessExtension
 * Custom Three.js GLTFLoader extension plugin to parse KHR_materials_pbrSpecularGlossiness.
 * Converts diffuseTexture, diffuseFactor, and glossiness into standard MeshStandardMaterial maps.
 */
class GLTFMaterialsPbrSpecularGlossinessExtension {
  constructor(parser) {
    this.name = 'KHR_materials_pbrSpecularGlossiness';
    this.parser = parser;
  }

  getMaterialType(materialIndex) {
    return THREE.MeshStandardMaterial;
  }

  extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];

    if (!materialDef.extensions || !materialDef.extensions[this.name]) {
      return Promise.resolve();
    }

    const specGloss = materialDef.extensions[this.name];
    const pending = [];

    if (specGloss.diffuseTexture) {
      pending.push(parser.assignTexture(materialParams, 'map', specGloss.diffuseTexture));
    }

    if (specGloss.diffuseFactor) {
      materialParams.color = new THREE.Color().fromArray(specGloss.diffuseFactor);
      materialParams.opacity = specGloss.diffuseFactor[3];
      if (specGloss.diffuseFactor[3] < 1.0) {
        materialParams.transparent = true;
      }
    }

    if (specGloss.glossinessFactor !== undefined) {
      materialParams.roughness = 1.0 - specGloss.glossinessFactor;
    } else {
      materialParams.roughness = 0.35;
    }
    materialParams.metalness = 0.25;

    return Promise.all(pending);
  }
}

/**
 * GLBDroneLoader
 * Asynchronously loads the 3D GLB drone asset ('animated_drone_with_camera_free.glb').
 * Auto-centers bounding box, scales to 1.6m wingspan, maps PBR textures, and manages GLTF AnimationMixer for propeller rotor blade rotation.
 */
export class GLBDroneLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new GLTFMaterialsPbrSpecularGlossinessExtension(parser));
    this.model = null;
    this.mixer = null;
    this.hoverAction = null;
    this.isLoaded = false;
  }

  load(url = '/assets/animated_drone_with_camera_free.glb') {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const rawScene = gltf.scene;

          // Compute exact bounding box of loaded GLB model
          const box = new THREE.Box3().setFromObject(rawScene);
          const size = new THREE.Vector3();
          box.getSize(size);
          const center = new THREE.Vector3();
          box.getCenter(center);

          console.log('[GLB Drone Loader] Original Box Size:', size, 'Center:', center);

          // Create wrapper container
          this.model = new THREE.Group();
          
          // Center rawScene geometry so center is at (0, 0, 0) and bottom is at Y = 0
          rawScene.position.set(-center.x, -box.min.y, -center.z);
          this.model.add(rawScene);

          // Target wingspan scale ~1.6m
          const maxDim = Math.max(size.x, size.z);
          const desiredScale = maxDim > 0 ? 1.6 / maxDim : 0.03;
          this.model.scale.set(desiredScale, desiredScale, desiredScale);

          console.log(`[GLB Drone Loader] Applied Scale: ${desiredScale.toFixed(4)}`);

          // Ensure all mesh materials have proper shadow settings and texture rendering
          this.model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.side = THREE.DoubleSide;
                child.material.depthWrite = true;
                child.material.depthTest = true;
                if (child.material.map) {
                  child.material.map.needsUpdate = true;
                }
              }
            }
          });

          // Setup Animation Mixer
          if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(rawScene);

            // Find 'hover' animation clip or fallback to first clip
            const hoverClip = gltf.animations.find(a => a.name.toLowerCase().includes('hover')) || gltf.animations[0];
            if (hoverClip) {
              this.hoverAction = this.mixer.clipAction(hoverClip);
              this.hoverAction.setEffectiveTimeScale(1.0);
              this.hoverAction.play();
              // Initially paused when drone is powered OFF
              this.hoverAction.paused = true;
            }
          }

          this.isLoaded = true;
          console.log('[CEAF DroneLab Chile] 3D GLB Drone loaded with textures successfully!');
          resolve(this.model);
        },
        (xhr) => {
          if (xhr.lengthComputable) {
            const percent = (xhr.loaded / xhr.total) * 100;
          }
        },
        (err) => {
          console.error('[CEAF DroneLab Chile] Error loading GLB drone model:', err);
          reject(err);
        }
      );
    });
  }

  update(dt, motorSpinPct = 0.0, motorPower = 'off') {
    if (this.mixer) {
      if (motorPower === 'off') {
        if (this.hoverAction) this.hoverAction.paused = true;
      } else {
        if (this.hoverAction) {
          this.hoverAction.paused = false;
          // Scale propeller animation speed dynamically with motorSpinPct (0.0 to 1.0)
          this.hoverAction.setEffectiveTimeScale(motorSpinPct * 2.5);
        }
        this.mixer.update(dt);
      }
    }
  }
}
