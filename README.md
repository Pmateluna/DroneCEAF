# CEAF DroneLab Chile - Simulador de Dron Agrícola Multiespectral

**CEAF DroneLab Chile** es una plataforma educativa e interactiva en 3D para la simulación de vuelo con dron quadcopter y captura de datos multiespectrales aplicados a la fruticultura. Desarrollado en Three.js, WebGL2 y JavaScript ESM para la investigación y enseñanza agronómica del **Centro de Estudios Avanzados en Fruticultura (CEAF)**.

---

## 🌟 Características Principales

- **🎮 Simulación Física 3D**:
  - Encendido y apagado progresivo de motores con secuencia de aceleración/desaceleración de hélices.
  - Vuelo manual realista (Cabeceo, Alabeo, Guiñada, Altitud) e integración de mandos en pantalla (pantalla táctil / teclado).
  - Modos de cámara intercambiables: **3ª Persona Seguimiento Cercano** y **1ª Persona FPV Cabina Gimbal**.

- **🤖 Autopiloto y Seguridad RTH**:
  - **Misión Cuadrícula (Tecla `M`)**: Escaneo autónomo del huerto frutal en patrón lawnmower.
  - **Retorno RTH (Tecla `H`)**: Retorno automático a la base con fases de ascenso, transito y aterrizaje seguro.
  - **Failsafe de Batería**: Disparo automático de retorno a base cuando la batería alcanza el 20%.

- **📊 Sensores Multiespectrales**:
  - **RGB Natural (Tecla `1`)**: Visión fotográfica real con mapas de textura de suelo agrícola.
  - **Salud (NDVI) (Tecla `2`)**: Falso color de vigor vegetal (verde saludable, amarillo moderado, rojo estrés).
  - **Térmico IR (Tecla `3`)**: Temperatura física diferencial (suelo agrícola 39°C–46°C vs dosel frutal 21°C–24.5°C).
  - **LiDAR Dosel (Tecla `4`)**: Mapa topográfico y elevación de copas frutícolas.

- **🌲 Huerto Frutícola y Cordillera**:
  - Árboles 3D realistas (`realistic_tree.glb`) alineados en hileras agrícolas paralelas con rotación aleatoria de 360° para mayor realismo visual.
  - Fondo tridimensional continuo de la **Cordillera de los Andes**.

---

## 🚀 Instalación y Ejecución Local

### Prerrequisitos
- Node.js (v18 o superior)
- npm / yarn / pnpm

### Pasos
```bash
# 1. Clonar el repositorio
git clone https://github.com/Pmateluna/DroneCEAF.git
cd DroneCEAF

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo
npm run dev
```

Abre tu navegador en `http://localhost:5173/`.

### Compilación para Producción
```bash
npm run build
```

---

## 🕹️ Guía de Controles

| Tecla | Acción |
| :--- | :--- |
| **`W` / `S`** | Cabeceo (Avanzar / Retroceder) |
| **`A` / `D`** | Alabeo (Inclinación Izquierda / Derecha) |
| **`↑` / `↓`** | Altitud (Ascenso / Descenso) |
| **`←` / `→`** | Guiñada (Giro Izquierda / Derecha) |
| **`E`** | Encender / Apagar Motores |
| **`C`** | Cambiar Cámara (FPV 1ª Persona / 3ª Persona) |
| **`M`** | Iniciar Misión Cuadrícula Autónoma |
| **`H`** | Activar Retorno Automático a Base (RTH) |
| **`1` - `4`** | Alternar Sensores (RGB, NDVI, Térmico, LiDAR) |
| **`T`** | Abrir / Cerrar Panel de Telemetría |

---

## 🏫 Créditos e Institución
Desarrollado para el **Centro de Estudios Avanzados en Fruticultura (CEAF)**, Chile.
