/**
 * TrackBuilder: Constructs the 3D racetrack, barriers, curbs, environment, and finish line in Three.js.
 */
export class TrackBuilder {
  constructor(scene) {
    this.scene = scene;
    this.roadWidth = 22;
    this.barrierOffset = 13;
  }

  /**
   * Builds the entire racetrack circuit environment
   */
  buildTrack(waypoints) {
    const trackGroup = new THREE.Group();

    // 1. Generate smooth spline points
    const splinePoints = this.generateSplinePoints(waypoints, 16);

    // 2. Build road mesh ribbon
    const roadMesh = this.createRoadMesh(splinePoints, this.roadWidth);
    trackGroup.add(roadMesh);

    // 3. Build red & white apex curbs
    const curbs = this.createCurbs(splinePoints, this.roadWidth);
    trackGroup.add(curbs);

    // 4. Build outer Armco metal barrier guardrails
    const barriers = this.createBarriers(splinePoints, this.barrierOffset);
    trackGroup.add(barriers);

    // 5. Build start/finish gantry arch
    const gantry = this.createStartGantry(waypoints[0]);
    trackGroup.add(gantry);

    // 6. Build ground terrain
    const ground = this.createTerrain();
    trackGroup.add(ground);

    // 7. Add stadium floodlight towers
    const floodlights = this.createFloodlightTowers(waypoints);
    trackGroup.add(floodlights);

    this.scene.add(trackGroup);
    return trackGroup;
  }

  /**
   * Catmull-Rom spline sampling for smooth closed loops
   */
  generateSplinePoints(waypoints, samplesPerSegment = 16) {
    const curvePoints = waypoints.map(wp => new THREE.Vector3(wp.x, 0, wp.z));
    const curve = new THREE.CatmullRomCurve3(curvePoints, true, 'catmullrom', 0.5);
    return curve.getSpacedPoints(waypoints.length * samplesPerSegment);
  }

  /**
   * Creates asphalt road surface geometry
   */
  createRoadMesh(points, width) {
    const halfWidth = width / 2;
    const vertexCount = points.length * 2;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const nextP = points[(i + 1) % points.length];

      // Forward tangent
      const tx = nextP.x - p.x;
      const tz = nextP.z - p.z;
      const len = Math.hypot(tx, tz) || 1;
      const dirX = tx / len;
      const dirZ = tz / len;

      // Perpendicular normal vector
      const nx = -dirZ;
      const nz = dirX;

      const leftIdx = i * 2;
      const rightIdx = i * 2 + 1;

      // Left edge vertex
      positions[leftIdx * 3 + 0] = p.x - nx * halfWidth;
      positions[leftIdx * 3 + 1] = 0.05; // Slightly above ground
      positions[leftIdx * 3 + 2] = p.z - nz * halfWidth;

      // Right edge vertex
      positions[rightIdx * 3 + 0] = p.x + nx * halfWidth;
      positions[rightIdx * 3 + 1] = 0.05;
      positions[rightIdx * 3 + 2] = p.z + nz * halfWidth;

      // UV coordinates
      const v = (i / points.length) * 40;
      uvs[leftIdx * 2 + 0] = 0;
      uvs[leftIdx * 2 + 1] = v;
      uvs[rightIdx * 2 + 0] = 1;
      uvs[rightIdx * 2 + 1] = v;

      // Triangles
      const nextLeft = ((i + 1) % points.length) * 2;
      const nextRight = ((i + 1) % points.length) * 2 + 1;

      indices.push(leftIdx, nextLeft, rightIdx);
      indices.push(rightIdx, nextLeft, nextRight);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Dark asphalt shader/material
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x181a1f,
      roughness: 0.85,
      metalness: 0.1
    });

    const mesh = new THREE.Mesh(geometry, roadMat);
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * Creates alternating red and white rumble curbs on track edges
   */
  createCurbs(points, roadWidth) {
    const curbGroup = new THREE.Group();
    const halfWidth = roadWidth / 2;
    const curbWidth = 1.6;

    const redMat = new THREE.MeshStandardMaterial({ color: 0xdd1122, roughness: 0.6 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 });

    const step = 2;
    for (let i = 0; i < points.length; i += step) {
      const p = points[i];
      const nextP = points[(i + 1) % points.length];
      const tx = nextP.x - p.x;
      const tz = nextP.z - p.z;
      const len = Math.hypot(tx, tz) || 1;
      const nx = -tz / len;
      const nz = tx / len;

      const mat = (Math.floor(i / 4) % 2 === 0) ? redMat : whiteMat;
      const boxGeo = new THREE.BoxGeometry(curbWidth, 0.14, len * step);

      // Left curb
      const leftCurb = new THREE.Mesh(boxGeo, mat);
      leftCurb.position.set(p.x - nx * (halfWidth + curbWidth / 2), 0.07, p.z - nz * (halfWidth + curbWidth / 2));
      leftCurb.rotation.y = Math.atan2(tx, tz);
      curbGroup.add(leftCurb);

      // Right curb
      const rightCurb = new THREE.Mesh(boxGeo, mat);
      rightCurb.position.set(p.x + nx * (halfWidth + curbWidth / 2), 0.07, p.z + nz * (halfWidth + curbWidth / 2));
      rightCurb.rotation.y = Math.atan2(tx, tz);
      curbGroup.add(rightCurb);
    }

    return curbGroup;
  }

  /**
   * Creates continuous metal Armco guardrails along track perimeter
   */
  createBarriers(points, offset) {
    const barrierGroup = new THREE.Group();
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.8,
      roughness: 0.3
    });

    const step = 3;
    for (let i = 0; i < points.length; i += step) {
      const p = points[i];
      const nextP = points[(i + 1) % points.length];
      const tx = nextP.x - p.x;
      const tz = nextP.z - p.z;
      const len = Math.hypot(tx, tz) || 1;
      const nx = -tz / len;
      const nz = tx / len;

      const rotY = Math.atan2(tx, tz);
      const railGeo = new THREE.BoxGeometry(0.4, 0.9, len * step);

      // Inner barrier
      const innerRail = new THREE.Mesh(railGeo, barrierMat);
      innerRail.position.set(p.x - nx * offset, 0.45, p.z - nz * offset);
      innerRail.rotation.y = rotY;
      barrierGroup.add(innerRail);

      // Outer barrier
      const outerRail = new THREE.Mesh(railGeo, barrierMat);
      outerRail.position.set(p.x + nx * offset, 0.45, p.z + nz * offset);
      outerRail.rotation.y = rotY;
      barrierGroup.add(outerRail);
    }

    return barrierGroup;
  }

  /**
   * Overhead Start/Finish line truss gantry
   */
  createStartGantry(startPoint) {
    const gantry = new THREE.Group();
    gantry.position.set(startPoint.x, 0, startPoint.z);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x050811,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.3
    });

    // Left pillar
    const leftPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 8, 8), metalMat);
    leftPillar.position.set(-14, 4, 0);
    gantry.add(leftPillar);

    // Right pillar
    const rightPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 8, 8), metalMat);
    rightPillar.position.set(14, 4, 0);
    gantry.add(rightPillar);

    // Overhead beam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(29, 1.2, 1.2), metalMat);
    beam.position.set(0, 7.5, 0);
    gantry.add(beam);

    // Finish banner display
    const banner = new THREE.Mesh(new THREE.BoxGeometry(22, 1.8, 0.2), signMat);
    banner.position.set(0, 6.2, 0);
    gantry.add(banner);

    // Checkered line on road
    const checkerCanvas = document.createElement('canvas');
    checkerCanvas.width = 128;
    checkerCanvas.height = 32;
    const ctx = checkerCanvas.getContext('2d');
    const cols = 8;
    const rows = 2;
    const cellW = 128 / cols;
    const cellH = 32 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111111';
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
      }
    }
    const checkerTex = new THREE.CanvasTexture(checkerCanvas);
    const lineMat = new THREE.MeshBasicMaterial({ map: checkerTex });
    const lineMesh = new THREE.Mesh(new THREE.PlaneGeometry(22, 2.5), lineMat);
    lineMesh.rotation.x = -Math.PI / 2;
    lineMesh.position.set(0, 0.08, 0);
    gantry.add(lineMesh);

    return gantry;
  }

  /**
   * Ground terrain
   */
  createTerrain() {
    const geo = new THREE.PlaneGeometry(1200, 1200, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x09140c,
      roughness: 0.95,
      metalness: 0.05
    });
    const terrain = new THREE.Mesh(geo, mat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = 0;
    terrain.receiveShadow = true;
    return terrain;
  }

  /**
   * Floodlight towers placed around track
   */
  createFloodlightTowers(waypoints) {
    const group = new THREE.Group();
    const towerPoints = [waypoints[1], waypoints[4], waypoints[8], waypoints[11]];

    towerPoints.forEach(p => {
      if (!p) return;
      const tower = new THREE.Group();
      tower.position.set(p.x + 24, 0, p.z + 24);

      // Tower pylon
      const pylonMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 22, 6), pylonMat);
      pylon.position.y = 11;
      tower.add(pylon);

      // Spotlight head
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 2), lampMat);
      lamp.position.y = 22;
      tower.add(lamp);

      // Light source
      const light = new THREE.SpotLight(0xfff5e6, 1.2, 180, Math.PI / 3, 0.5);
      light.position.set(0, 22, 0);
      light.target.position.set(-24, 0, -24);
      tower.add(light);
      tower.add(light.target);

      group.add(tower);
    });

    return group;
  }
}
