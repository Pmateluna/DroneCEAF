import { SceneLoader, TransformNode, Vector3 } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

/**
 * GLBDroneLoader (Babylon.js 9)
 * Asynchronously loads 3D GLB drone assets:
 * - Multispectral Monitoring Drone ('/assets/animated_drone_with_camera_free.glb')
 * - Agricultural Spray Drone ('/assets/drone_for_agriculture_tagged.glb')
 * Auto-centers bounding box, scales to realistic wingspans, and manages propeller animations.
 */
export class GLBDroneLoader {
  constructor(scene) {
    this.scene = scene;
  }

  async loadModel(url, targetWingspan = 1.6) {
    try {
      const lastSlash = url.lastIndexOf('/');
      const rootUrl = lastSlash !== -1 ? url.substring(0, lastSlash + 1) : '';
      const filename = lastSlash !== -1 ? url.substring(lastSlash + 1) : url;

      const result = await SceneLoader.ImportMeshAsync('', rootUrl, filename, this.scene);
      const rootMesh = result.meshes[0];

      // Configurar AnimationGroup ('hover') antes de medir bounding box:
      // IMPORTANTE: No llamar .reset() en 'exploded_view' ni 'step_by_step', ya que el fotograma 0 de 'step_by_step'
      // desarma todas las piezas del dron en el suelo.
      let hoverGroup = null;
      if (result.animationGroups && result.animationGroups.length > 0) {
        result.animationGroups.forEach((ag) => {
          if (ag.name.toLowerCase().includes('hover')) {
            hoverGroup = ag;
          } else {
            ag.stop();
          }
        });
        if (!hoverGroup) {
          hoverGroup = result.animationGroups[0];
        }

        if (hoverGroup) {
          // En 'hover', el hueso raíz 'Center.3_3' tiene una pista de traslación que salta de Y=5.0 (reposo)
          // a Y=16.596 al iniciar la animación, causando que el dron se teletransporte hacia arriba al encender motores.
          // Fijamos todas las claves de posición de 'Center' en su pose de reposo (0, 5, 0) para eliminar el salto.
          if (hoverGroup.targetedAnimations) {
            hoverGroup.targetedAnimations.forEach((ta) => {
              const targetName = (ta.target && ta.target.name) ? ta.target.name.toLowerCase() : '';
              const prop = ta.animation ? ta.animation.targetProperty : '';
              if (targetName.includes('center') && prop === 'position') {
                const restPos = ta.target.position ? ta.target.position.clone() : new Vector3(0, 5, 0);
                const keys = ta.animation.getKeys();
                if (keys) {
                  for (let i = 0; i < keys.length; i++) {
                    keys[i].value.copyFrom(restPos);
                  }
                }
              }
            });
          }

          hoverGroup.start(true, 1.0);
          hoverGroup.pause();
        }
      }

      rootMesh.computeWorldMatrix(true);

      // Calculate hierarchy bounding vectors
      const hierarchyBounding = rootMesh.getHierarchyBoundingVectors(true);
      const min = hierarchyBounding.min;
      const max = hierarchyBounding.max;
      const size = max.subtract(min);
      const center = min.add(max).scale(0.5);

      console.log(`[Babylon GLB Drone Loader] Asset "${url}" Size:`, size, 'Center:', center);

      // Create wrapper node to center and scale the drone
      const wrapper = new TransformNode(`drone-wrapper-${filename}`, this.scene);
      rootMesh.parent = wrapper;
      rootMesh.position.set(-center.x, -min.y, -center.z);

      const maxDim = Math.max(size.x, size.z);
      const desiredScale = maxDim > 0 ? targetWingspan / maxDim : 0.03;
      wrapper.scaling.setAll(desiredScale);

      // Collect rotor blade meshes (for drones without skeletal hoverGroup, e.g., sprayer drone)
      const propMeshes = [];
      const checkProp = (node) => {
        const name = (node.name || '').toLowerCase();
        if (name.includes('blade') || name.includes('rotor')) {
          node.spinDir = propMeshes.length % 2 === 0 ? 1 : -1;
          propMeshes.push(node);
        }
      };

      result.meshes.forEach((mesh) => {
        mesh.receiveShadows = true;
        checkProp(mesh);
      });
      if (result.transformNodes) {
        result.transformNodes.forEach(checkProp);
      }

      console.log(`[CEAF DroneLab Chile] Loaded Babylon GLB asset "${url}" successfully.`);
      return {
        model: wrapper,
        rootMesh,
        meshes: result.meshes,
        animationGroup: hoverGroup,
        propMeshes
      };
    } catch (err) {
      console.error(`[CEAF DroneLab Chile] Error loading GLB asset "${url}":`, err);
      throw err;
    }
  }

  loadMultispectralDrone(url = '/assets/animated_drone_with_camera_free.glb') {
    return this.loadModel(url, 1.6);
  }

  loadSprayerDrone(url = '/assets/drone_for_agriculture_tagged.glb') {
    return this.loadModel(url, 1.85);
  }
}
