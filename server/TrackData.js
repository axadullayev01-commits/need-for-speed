/**
 * Track Data and Circuit Geometry
 * Defines track spline waypoints, checkpoints, collision boundaries, and starting grid slots.
 */

// Key circuit spline points defining an exciting Grand Prix style circuit
export const CIRCUIT_WAYPOINTS = [
  { x: 0,    z: 0 },       // Start / Finish straightaway
  { x: 0,    z: 140 },     // High speed straight
  { x: 30,   z: 220 },     // Turn 1 entry (sweeping right)
  { x: 100,  z: 270 },     // Turn 1 apex
  { x: 190,  z: 260 },     // Turn 1 exit
  { x: 250,  z: 180 },     // S-Chicane entry
  { x: 230,  z: 110 },     // S-Chicane mid
  { x: 280,  z: 40 },      // S-Chicane exit
  { x: 300,  z: -60 },     // Back straight
  { x: 270,  z: -170 },    // Hairpin entry
  { x: 180,  z: -230 },    // Hairpin apex
  { x: 90,   z: -210 },    // Hairpin exit
  { x: 20,   z: -140 },    // Final sweeping left entry
  { x: -50,  z: -70 }      // Final turn into main straight
];

/**
 * Catmull-Rom Spline Interpolation for closed 2D curves
 */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    z: 0.5 * ((2 * p1.z) +
      (-p0.z + p2.z) * t +
      (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
      (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
  };
}

/**
 * Generates smooth centerline track points
 */
export function generateTrackCenterline(samplesPerSegment = 16) {
  const points = [];
  const n = CIRCUIT_WAYPOINTS.length;

  for (let i = 0; i < n; i++) {
    const p0 = CIRCUIT_WAYPOINTS[(i - 1 + n) % n];
    const p1 = CIRCUIT_WAYPOINTS[i];
    const p2 = CIRCUIT_WAYPOINTS[(i + 1) % n];
    const p3 = CIRCUIT_WAYPOINTS[(i + 2) % n];

    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      points.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
  return points;
}

// Pre-sampled centerline points (224 smooth points)
export const TRACK_POINTS = generateTrackCenterline(16);

/**
 * Checkpoints along the track for lap validation and anti-cheat.
 * Each checkpoint has position, tangent/normal direction, and radius.
 */
export const CHECKPOINTS = CIRCUIT_WAYPOINTS.map((wp, index) => {
  const nextWp = CIRCUIT_WAYPOINTS[(index + 1) % CIRCUIT_WAYPOINTS.length];
  const dx = nextWp.x - wp.x;
  const dz = nextWp.z - wp.z;
  const len = Math.hypot(dx, dz) || 1;
  const dirX = dx / len;
  const dirZ = dz / len;

  return {
    index,
    x: wp.x,
    z: wp.z,
    dirX,
    dirZ,
    // Perpendicular vector for gate width
    normalX: -dirZ,
    normalZ: dirX,
    width: 26,
    radius: 22
  };
});

/**
 * Staggered Starting Grid Slots (just behind Checkpoint 0)
 */
export const START_GRID_SLOTS = [
  { x: -4,  z: -25, angle: 0 },   // Pole position (P1)
  { x: 4,   z: -35, angle: 0 },   // P2
  { x: -4,  z: -45, angle: 0 },   // P3
  { x: 4,   z: -55, angle: 0 },   // P4
  { x: -4,  z: -65, angle: 0 },   // P5
  { x: 4,   z: -75, angle: 0 },   // P6
  { x: -4,  z: -85, angle: 0 },   // P7
  { x: 4,   z: -95, angle: 0 },   // P8
];

/**
 * Finds the closest point on the track centerline to determine:
 * - Distance from track center
 * - Off-track status
 * - Race progress percentage (0.0 to 1.0)
 */
export function getTrackProgress(x, z) {
  let minDistanceSq = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < TRACK_POINTS.length; i++) {
    const pt = TRACK_POINTS[i];
    const dx = x - pt.x;
    const dz = z - pt.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closestIndex = i;
    }
  }

  const distanceToCenter = Math.sqrt(minDistanceSq);
  const progressRatio = closestIndex / TRACK_POINTS.length;

  return {
    closestIndex,
    closestPoint: TRACK_POINTS[closestIndex],
    distanceToCenter,
    isOffTrack: distanceToCenter > 11.0, // road half-width is 11
    isHitBarrier: distanceToCenter > 13.0, // barrier wall at 13 units
    progressRatio
  };
}

/**
 * Checks if a car has crossed a given checkpoint gate in the forward direction.
 */
export function hasCrossedCheckpoint(prevX, prevZ, currX, currZ, checkpoint) {
  const cp = checkpoint;
  
  // Vector from checkpoint to current position
  const toCurrX = currX - cp.x;
  const toCurrZ = currZ - cp.z;
  const distSq = toCurrX * toCurrX + toCurrZ * toCurrZ;

  if (distSq > cp.radius * cp.radius) {
    return false;
  }

  // Dot product with checkpoint direction to see if car stepped from behind to ahead
  const toPrevX = prevX - cp.x;
  const toPrevZ = prevZ - cp.z;

  const dotPrev = toPrevX * cp.dirX + toPrevZ * cp.dirZ;
  const dotCurr = toCurrX * cp.dirX + toCurrZ * cp.dirZ;

  // Passed through plane from negative (behind) to positive (ahead)
  return dotPrev <= 0 && dotCurr > 0;
}
