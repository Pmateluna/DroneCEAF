import { SceneLoader, TransformNode, Vector3, Color3, VertexBuffer } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

/**
 * GLBTreeLoader (Babylon.js 9)
 * Loads 'realistic_tree.glb' asset with authentic trunk, branches, and leaf canopy.
 * Normalizes trunk base at (0, 0, 0) and scales to ~4.5m orchard tree height.
 * Prepares hardware-instanced Thin Instance template meshes (3 draw calls for the entire orchard)
 * with dynamic per-tree canopy coloration (RGB stress chlorosis, NDVI, Thermal IR, LiDAR DSM).
 */
export class GLBTreeLoader {
  constructor(scene) {
    this.scene = scene;
    this.baseTreeModel = null;
    this.isLoaded = false;
    this.rootMesh = null;
    this.templateMeshes = [];
  }

  async load(url = '/assets/realistic_tree.glb') {
    try {
      const lastSlash = url.lastIndexOf('/');
      const rootUrl = lastSlash !== -1 ? url.substring(0, lastSlash + 1) : '';
      const filename = lastSlash !== -1 ? url.substring(lastSlash + 1) : url;

      const result = await SceneLoader.ImportMeshAsync('', rootUrl, filename, this.scene);
      const rootMesh = result.meshes[0];
      this.rootMesh = rootMesh;

      const bounds = rootMesh.getHierarchyBoundingVectors(true);
      const size = bounds.max.subtract(bounds.min);
      const center = bounds.min.add(bounds.max).scale(0.5);

      const wrapper = new TransformNode('base-tree-wrapper', this.scene);
      rootMesh.parent = wrapper;
      rootMesh.position.set(-center.x, -bounds.min.y, -center.z);

      const desiredHeight = 4.5;
      const scaleFactor = size.y > 0 ? desiredHeight / size.y : 0.25;
      wrapper.scaling.setAll(scaleFactor);
      wrapper.computeWorldMatrix(true);

      this.templateMeshes = [];

      result.meshes.forEach(m => {
        if (!m || typeof m.getTotalVertices !== 'function' || m.getTotalVertices() === 0) {
          return;
        }

        // Compute normalized world matrix relative to the 4.5m centered wrapper
        m.computeWorldMatrix(true);
        const baseMatrix = m.getWorldMatrix().clone();

        // Permitir que el tronco y las ramas bajas reciban sombras proyectadas por la copa y árboles vecinos
        m.receiveShadows = true;

        let isLeaf = false;

        if (m.material) {
          const mat = m.material;
          const matName = (mat.name || '').toLowerCase();
          const meshName = (m.name || '').toLowerCase();
          isLeaf = matName.includes('leaf') || matName.includes('leaves') || meshName.includes('crown');

          // En glTF 2.0, metallicRoughnessTexture empaqueta Oclusión (R), Rugosidad (G) y Metalicidad (B).
          // Desactivamos únicamente la lectura del canal metálico (la corteza y hojas son 100% dieléctricas, metallic = 0),
          // preservando los mapas originales de Rugosidad y Oclusión Ambiental (AO) para dar volumen 3D profundo a la copa.
          if ('metallic' in mat) mat.metallic = 0.0;
          if ('useMetallnessFromMetallicTextureBlue' in mat) {
            mat.useMetallnessFromMetallicTextureBlue = false;
            mat.useRoughnessFromMetallicTextureGreen = true;
            mat.useRoughnessFromMetallicTextureAlpha = false;
            mat.useAmbientOcclusionFromMetallicTextureRed = true;
          }
          if (mat.ambientTexture) {
            mat.ambientTextureStrength = 0.65;
          }

          // Evitar inversión de caras por determinante negativo del nodo __root__ glTF en Thin Instances
          mat.backFaceCulling = false;

          if (mat.bumpTexture) {
            mat.bumpTexture.level = 0.75;
            mat.bumpTexture.anisotropicFilteringLevel = 16;
          }
          if (mat.albedoTexture) {
            mat.albedoTexture.anisotropicFilteringLevel = 16;
          }

          if (isLeaf) {
            // Recorte alfa de alta precisión con escritura en Depth Buffer y sombras proyectadas por hoja
            if ('twoSidedLighting' in mat) mat.twoSidedLighting = true;
            if ('transparencyMode' in mat) mat.transparencyMode = 1; // PBRMATERIAL_ALPHATEST
            if ('alphaCutOff' in mat) mat.alphaCutOff = 0.38;
            if ('useAlphaFromAlbedoTexture' in mat) mat.useAlphaFromAlbedoTexture = true;

            if ('roughness' in mat) mat.roughness = 0.62;
            if ('specularIntensity' in mat) mat.specularIntensity = 0.32;
            if ('directIntensity' in mat) mat.directIntensity = 1.15;
            if ('environmentIntensity' in mat) mat.environmentIntensity = 0.85;

            // Color base foliar calibrado (verde frutal profundo realista, sin sobreexponer a verde neón)
            if (mat.ambientColor) {
              mat.ambientColor = new Color3(0.18, 0.24, 0.14);
            }
            if (mat.albedoColor) {
              mat.albedoColor = new Color3(0.72, 0.82, 0.62);
            }
            if (mat.diffuseColor) {
              mat.diffuseColor = new Color3(0.72, 0.82, 0.62);
            }
            if (mat.emissiveColor) {
              mat.emissiveColor = new Color3(0.01, 0.02, 0.01);
            }

            // Babylon.js 9 PBR Subsurface Translucency: dispersión de luz solar a través de las hojas
            if (mat.subSurface) {
              mat.subSurface.isTranslucencyEnabled = true;
              mat.subSurface.translucencyIntensity = 0.42;
              mat.subSurface.tintColor = new Color3(0.52, 0.78, 0.22);
            }

            // Limpiar colores de vértice estáticos si existieran para usar el buffer 'color' de Thin Instances
            if (m.isVerticesDataPresent(VertexBuffer.ColorKind)) {
              m.removeVerticesData(VertexBuffer.ColorKind);
            }
          } else {
            // Tronco y ramas: corteza leñosa natural con micro-relieve y sombreado PBR profundo
            if ('roughness' in mat) mat.roughness = 0.88;
            if ('specularIntensity' in mat) mat.specularIntensity = 0.14;
            if ('directIntensity' in mat) mat.directIntensity = 1.10;
            if ('environmentIntensity' in mat) mat.environmentIntensity = 0.70;

            if (mat.ambientColor) {
              mat.ambientColor = new Color3(0.22, 0.18, 0.15);
            }
            if (mat.albedoColor) {
              mat.albedoColor = new Color3(0.88, 0.76, 0.64);
            }
            if (mat.diffuseColor) {
              mat.diffuseColor = new Color3(0.88, 0.76, 0.64);
            }
            if (mat.emissiveColor) {
              mat.emissiveColor = new Color3(0.0, 0.0, 0.0);
            }
          }
        }

        // Desacoplar la malla plantilla a la raíz con transformación identidad para que
        // finalWorld = Identity * thinInstanceMatrix = baseMatrix * treeWorldMatrix
        m.parent = null;
        m.position.setAll(0);
        m.rotationQuaternion = null;
        m.rotation.setAll(0);
        m.scaling.setAll(1);
        m.computeWorldMatrix(true);
        m.setEnabled(false); // Se activará al registrar el buffer de Thin Instances

        this.templateMeshes.push({
          mesh: m,
          baseMatrix,
          isLeaf
        });
      });

      wrapper.setEnabled(false);
      this.baseTreeModel = wrapper;
      this.isLoaded = true;
      console.log(`[CEAF DroneLab Chile] Loaded Babylon 9 realistic_tree.glb Thin Instance templates (${this.templateMeshes.length} primitives).`);
      return this.templateMeshes;
    } catch (err) {
      console.error('[CEAF DroneLab Chile] Error loading realistic_tree.glb in Babylon:', err);
      throw err;
    }
  }
}

