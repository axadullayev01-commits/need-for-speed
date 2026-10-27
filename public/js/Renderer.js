/**
 * Three.js 3D Scene, Lighting, Dynamic Follow Camera, and Rendering Engine.
 */
export class Renderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Camera modes: 0: Chase, 1: Close, 2: Hood/Bumper, 3: Aerial
    this.cameraMode = 0;
    this.cameraModesCount = 4;

    this.initScene();
    this.initCamera();
    this.initRenderer();
    this.initLighting();

    window.addEventListener('resize', () => this.onResize());
  }

  initScene() {
    this.scene = new THREE.Scene();
    // Night race atmosphere with dense horizon fog
    this.scene.background = new THREE.Color(0x0a0c14);
    this.scene.fog = new THREE.FogExp2(0x0a0c14, 0.0022);
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(65, this.width / this.height, 0.5, 1000);
    this.camera.position.set(0, 8, -15);
    this.targetCameraPos = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
  }

  initLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x2a334d, 1.2);
    this.scene.add(ambientLight);

    // Moonlight / Directional light with shadows
    const dirLight = new THREE.DirectionalLight(0xa5c2f0, 1.8);
    dirLight.position.set(100, 160, 80);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 400;
    const shadowD = 160;
    dirLight.shadow.camera.left = -shadowD;
    dirLight.shadow.camera.right = shadowD;
    dirLight.shadow.camera.top = shadowD;
    dirLight.shadow.camera.bottom = -shadowD;
    this.scene.add(dirLight);

    // Warm accent light
    const hemiLight = new THREE.HemisphereLight(0x1e293b, 0x09140c, 0.8);
    this.scene.add(hemiLight);
  }

  cycleCamera() {
    this.cameraMode = (this.cameraMode + 1) % this.cameraModesCount;
    return this.cameraMode;
  }

  /**
   * Updates camera position smoothly trailing the target car
   */
  updateCamera(carMesh, carSpeed, dt) {
    if (!carMesh) return;

    const carPos = carMesh.position;
    const carAngle = carMesh.rotation.y;
    const absSpeed = Math.abs(carSpeed || 0);

    // Forward and Right vectors from car yaw
    const forwardX = Math.sin(carAngle);
    const forwardZ = Math.cos(carAngle);

    let desiredPos = new THREE.Vector3();
    let desiredLook = new THREE.Vector3();
    let lerpFactor = 0.12;

    switch (this.cameraMode) {
      case 0: // Dynamic Chase Cam (NFS style)
        {
          const distBehind = 7.5 + (absSpeed / 65.0) * 2.0;
          const height = 3.2 + (absSpeed / 65.0) * 0.8;
          desiredPos.set(
            carPos.x - forwardX * distBehind,
            carPos.y + height,
            carPos.z - forwardZ * distBehind
          );
          desiredLook.set(
            carPos.x + forwardX * 6.0,
            carPos.y + 1.2,
            carPos.z + forwardZ * 6.0
          );
          // Speed-based dynamic FOV expansion
          this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 65 + (absSpeed / 65) * 18, 0.08);
          this.camera.updateProjectionMatrix();
        }
        break;

      case 1: // Close Chase Cam
        {
          desiredPos.set(
            carPos.x - forwardX * 5.0,
            carPos.y + 2.2,
            carPos.z - forwardZ * 5.0
          );
          desiredLook.set(
            carPos.x + forwardX * 5.0,
            carPos.y + 0.9,
            carPos.z + forwardZ * 5.0
          );
          lerpFactor = 0.2;
        }
        break;

      case 2: // Hood / Bumper Cam
        {
          desiredPos.set(
            carPos.x + forwardX * 0.8,
            carPos.y + 1.1,
            carPos.z + forwardZ * 0.8
          );
          desiredLook.set(
            carPos.x + forwardX * 25.0,
            carPos.y + 0.9,
            carPos.z + forwardZ * 25.0
          );
          lerpFactor = 0.35;
        }
        break;

      case 3: // Top-Down / Helicopter Cam
        {
          desiredPos.set(carPos.x, carPos.y + 35, carPos.z - 5);
          desiredLook.set(carPos.x, carPos.y, carPos.z);
          lerpFactor = 0.1;
        }
        break;
    }

    // Smooth camera trailing
    this.camera.position.lerp(desiredPos, lerpFactor);
    this.targetLookAt.lerp(desiredLook, lerpFactor);
    this.camera.lookAt(this.targetLookAt);
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
