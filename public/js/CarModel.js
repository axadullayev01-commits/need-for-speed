/**
 * Procedural 3D Sports Car Model in Three.js
 * Features rotating wheels, steering pivot, dynamic brake lights, headlights, and floating player nameplates.
 */
export class CarModel {
  constructor(color = '#ff0055', playerName = 'Driver', isLocal = false) {
    this.color = color;
    this.playerName = playerName;
    this.isLocal = isLocal;

    this.mesh = new THREE.Group();
    this.frontWheels = [];
    this.allWheels = [];
    this.brakeLights = [];
    this.headlights = [];
    this.nameplate = null;

    this.buildCar();
    this.createNameplate();
  }

  buildCar() {
    // 1. Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.color),
      roughness: 0.35,
      metalness: 0.75
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x111625,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.85
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c22,
      roughness: 0.7,
      metalness: 0.2
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xdde3ed,
      roughness: 0.2,
      metalness: 0.9
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x1b1c20,
      roughness: 0.9
    });

    // 2. Main Lower Chassis (Width: 2.1, Length: 4.4, Height: 0.6)
    const chassisGeo = new THREE.BoxGeometry(2.1, 0.6, 4.4);
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = 0.55;
    chassis.castShadow = true;
    this.mesh.add(chassis);

    // Front wedge hood slope
    const hoodGeo = new THREE.BoxGeometry(1.95, 0.35, 1.8);
    const hood = new THREE.Mesh(hoodGeo, bodyMat);
    hood.position.set(0, 0.58, 1.1);
    hood.rotation.x = 0.08;
    this.mesh.add(hood);

    // Front Splitter / Bumper
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.15, 0.6), carbonMat);
    splitter.position.set(0, 0.32, 2.2);
    this.mesh.add(splitter);

    // 3. Cockpit / Windshield Cabin
    const cabinGeo = new THREE.BoxGeometry(1.6, 0.55, 2.0);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 0.98, -0.2);
    this.mesh.add(cabin);

    // Cabin Roof
    const roofGeo = new THREE.BoxGeometry(1.45, 0.1, 1.6);
    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.set(0, 1.28, -0.25);
    this.mesh.add(roof);

    // 4. GT Rear Wing / Spoiler
    const wingSupportLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.2), carbonMat);
    wingSupportLeft.position.set(-0.7, 0.95, -2.0);
    this.mesh.add(wingSupportLeft);

    const wingSupportRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.2), carbonMat);
    wingSupportRight.position.set(0.7, 0.95, -2.0);
    this.mesh.add(wingSupportRight);

    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.45), carbonMat);
    wingBlade.position.set(0, 1.22, -2.0);
    wingBlade.rotation.x = -0.08;
    this.mesh.add(wingBlade);

    // 5. Headlights (Front +Z)
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headlightMat);
    hlLeft.position.set(-0.75, 0.65, 2.21);
    this.mesh.add(hlLeft);

    const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headlightMat);
    hlRight.position.set(0.75, 0.65, 2.21);
    this.mesh.add(hlRight);

    // 6. Brake / Tail Lights (Rear -Z)
    this.brakeMat = new THREE.MeshStandardMaterial({
      color: 0x550000,
      emissive: 0x330000,
      emissiveIntensity: 0.4
    });

    const tailLeft = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.1), this.brakeMat);
    tailLeft.position.set(-0.75, 0.65, -2.21);
    this.mesh.add(tailLeft);
    this.brakeLights.push(tailLeft);

    const tailRight = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.1), this.brakeMat);
    tailRight.position.set(0.75, 0.65, -2.21);
    this.mesh.add(tailRight);
    this.brakeLights.push(tailRight);

    // 7. Wheels Construction
    const wheelRadius = 0.42;
    const wheelWidth = 0.32;
    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, wheelWidth + 0.02, 12);
    rimGeo.rotateZ(Math.PI / 2);

    const wheelPositions = [
      { x: -1.05, z: 1.35, isFront: true },  // Front Left
      { x: 1.05,  z: 1.35, isFront: true },  // Front Right
      { x: -1.05, z: -1.35, isFront: false }, // Rear Left
      { x: 1.05,  z: -1.35, isFront: false }  // Rear Right
    ];

    wheelPositions.forEach(pos => {
      // Pivot group for steering
      const pivot = new THREE.Group();
      pivot.position.set(pos.x, 0.42, pos.z);

      // Rotating wheel hub
      const wheelHub = new THREE.Group();
      const tireMesh = new THREE.Mesh(wheelGeo, tireMat);
      tireMesh.castShadow = true;
      wheelHub.add(tireMesh);

      const rimMesh = new THREE.Mesh(rimGeo, chromeMat);
      wheelHub.add(rimMesh);

      pivot.add(wheelHub);
      this.mesh.add(pivot);

      this.allWheels.push(wheelHub);
      if (pos.isFront) {
        this.frontWheels.push(pivot);
      }
    });
  }

  /**
   * Floating Billboard 2D Nameplate above car
   */
  createNameplate() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Background pill
    ctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
    ctx.roundRect ? ctx.roundRect(10, 10, 236, 44, 10) : ctx.fillRect(10, 10, 236, 44);
    ctx.fill();

    // Border with player color
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.playerName, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    this.nameplate = new THREE.Sprite(spriteMat);
    this.nameplate.scale.set(3.5, 0.88, 1);
    this.nameplate.position.set(0, 2.4, 0);
    this.mesh.add(this.nameplate);
  }

  /**
   * Updates car visuals according to physics state
   */
  updateVisuals(physicsState, dt) {
    if (!physicsState) return;

    // 1. Position & Yaw Heading
    if (this.isLocal) {
      this.mesh.position.set(physicsState.x, 0, physicsState.z);
      this.mesh.rotation.y = physicsState.angle;
    } else {
      // Smooth remote entity positioning to eliminate all packet jitter
      const smoothFactor = Math.min(1, 24 * (dt || 0.016));
      this.mesh.position.x += (physicsState.x - this.mesh.position.x) * smoothFactor;
      this.mesh.position.z += (physicsState.z - this.mesh.position.z) * smoothFactor;

      let angleDiff = physicsState.angle - this.mesh.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      this.mesh.rotation.y += angleDiff * smoothFactor;
    }

    // Body roll / tilt during hard turns and drifts
    const steerRoll = (physicsState.steerAngle || 0) * (physicsState.speed / 50) * -0.06;
    const driftRoll = (physicsState.lateralSpeed || 0) * 0.008;
    this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, steerRoll + driftRoll, 0.2);

    // 2. Steer front wheels
    const steerAngle = physicsState.steerAngle || 0;
    this.frontWheels.forEach(pivot => {
      pivot.rotation.y = steerAngle;
    });

    // 3. Spin all wheels based on forward travel
    const wheelCircumference = 2 * Math.PI * 0.42;
    const spinDelta = (physicsState.speed * dt) / wheelCircumference * (2 * Math.PI);
    this.allWheels.forEach(wheel => {
      wheel.rotation.x += spinDelta;
    });

    // 4. Dynamic Brake Lights
    const isBraking = physicsState.isBraking;
    if (this.brakeMat) {
      if (isBraking) {
        this.brakeMat.emissive.setHex(0xff0022);
        this.brakeMat.emissiveIntensity = 2.0;
      } else {
        this.brakeMat.emissive.setHex(0x330000);
        this.brakeMat.emissiveIntensity = 0.3;
      }
    }
  }

  /**
   * Updates paint color dynamically
   */
  setColor(hexColor) {
    this.color = hexColor;
    this.mesh.traverse(child => {
      if (child.isMesh && child.material && child.material.metalness === 0.75) {
        child.material.color.set(new THREE.Color(hexColor));
      }
    });
  }

  destroy() {
    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}
