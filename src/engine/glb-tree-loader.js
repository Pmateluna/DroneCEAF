import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * GLBTreeLoader
 * Loads single 'realistic_tree.glb' asset with authentic trunk and leaf canopy.
 * Auto-centers trunk base at (0, 0, 0) and scales to ~4.5m orchard tree height.
 * Provides instancing with randomized Y-axis rotation and scale variation for natural orchard rows.
 */
export class GLBTreeLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.baseTreeModel = null;
    this.isLoaded = false;
  }

  load(url = '/assets/realistic_tree.glb') {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const rawScene = gltf.scene;

          // Calculate bounding box of authentic realistic tree
          const box = new THREE.Box3().setFromObject(rawScene);
          const size = new THREE.Vector3();
          box.getSize(size);
          const center = new THREE.Vector3();
          box.getCenter(center);

          console.log('[GLB Tree Loader] Realistic Tree Box Size:', size, 'Center:', center);

          // Center tree geometry base at (0, 0, 0)
          rawScene.position.set(-center.x, -box.min.y, -center.z);

          this.baseTreeModel = new THREE.Group();
          this.baseTreeModel.add(rawScene);

          // Scale realistic tree to standard orchard height ~4.5 meters
          const desiredHeight = 4.5;
          const scaleFactor = size.y > 0 ? desiredHeight / size.y : 0.25;
          this.baseTreeModel.scale.set(scaleFactor, scaleFactor, scaleFactor);

          // Configure shadows & materials
          this.baseTreeModel.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.side = THREE.DoubleSide;
                child.material.roughness = 0.50;
                child.material.metalness = 0.0;
              }
            }
          });

          this.isLoaded = true;
          console.log('[CEAF DroneLab Chile] Authentic 3D realistic_tree.glb model loaded successfully!');
          resolve(this.baseTreeModel);
        },
        (xhr) => {},
        (err) => {
          console.error('[CEAF DroneLab Chile] Error loading realistic_tree.glb:', err);
          reject(err);
        }
      );
    });
  }

  createTreeInstance() {
    if (!this.baseTreeModel) return null;

    // Clone base authentic realistic tree model
    const instance = this.baseTreeModel.clone(true);

    // Apply randomized Y-axis yaw rotation (0 to 360°)
    instance.rotation.y = Math.random() * Math.PI * 2;

    // Apply subtle random scale variation (±10%)
    const randomScale = 0.90 + Math.random() * 0.20;
    instance.scale.multiplyScalar(randomScale);

    return instance;
  }
}
