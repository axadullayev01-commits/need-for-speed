import { CONFIG } from './config.js';
import { getTrackProgress } from './TrackData.js';

/**
 * Creates a default car physics state
 */
export function createCarPhysicsState(spawnSlot) {
  return {
    x: spawnSlot.x,
    z: spawnSlot.z,
    y: 0,
    angle: spawnSlot.angle || 0,        // Heading yaw in radians (0 = pointing +Z)
    vx: 0,                              // World X velocity
    vz: 0,                              // World Z velocity
    speed: 0,                           // Forward longitudinal speed (m/s)
    lateralSpeed: 0,                    // Sideways sliding speed (m/s)
    steerAngle: 0,                      // Current front wheel turn angle
    angularVelocity: 0,                 // Yaw angular velocity
    isDrifting: false,
    isBraking: false,
    isOffTrack: false,
    colliding: false,
    lastProcessedInputSeq: 0
  };
}

/**
 * Normalizes an angle into [-PI, PI]
 */
export function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Clamps a number between min and max
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Linear interpolation
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Step car physics simulation for one tick (Authoritative Server Simulation)
 *
 * @param {Object} state - Current car physics state
 * @param {Object} input - Player input { throttle, steer, brake, handbrake }
 * @param {number} dt - Delta time in seconds (e.g. 1/60)
 * @returns {Object} Updated car physics state
 */
export function stepCarPhysics(state, input, dt = CONFIG.DT) {
  // Sanitize and clamp inputs to prevent client tampering
  const throttle = clamp(Number(input.throttle) || 0, -1, 1);
  const rawSteer = clamp(Number(input.steer) || 0, -1, 1);
  const brake = clamp(Number(input.brake) || 0, 0, 1);
  const handbrake = Boolean(input.handbrake);

  // Speed-sensitive steering (taper steering angle at high speed for stability)
  const absSpeed = Math.abs(state.speed);
  const steerScale = 1.0 / (1.0 + absSpeed * CONFIG.CAR.STEER_SENSITIVITY);
  const targetSteerAngle = rawSteer * CONFIG.CAR.MAX_STEER_ANGLE * steerScale;

  // Smooth steer wheel transition
  state.steerAngle = lerp(state.steerAngle, targetSteerAngle, clamp(CONFIG.CAR.STEER_SPEED * dt, 0, 1));

  // Determine current unit heading vectors
  const forwardX = Math.sin(state.angle);
  const forwardZ = Math.cos(state.angle);
  const rightX = Math.cos(state.angle);
  const rightZ = -Math.sin(state.angle);

  // Project world velocity into local car space
  let longSpeed = state.vx * forwardX + state.vz * forwardZ;
  let latSpeed = state.vx * rightX + state.vz * rightZ;

  // Track surface check (off-track gravel vs asphalt)
  const trackInfo = getTrackProgress(state.x, state.z);
  state.isOffTrack = trackInfo.isOffTrack;

  // Acceleration & Driving Forces
  let engineAccel = 0;
  if (throttle > 0) {
    // Forward acceleration with power curve tapering near max speed
    const powerRatio = Math.max(0, 1 - (longSpeed / CONFIG.CAR.MAX_SPEED));
    engineAccel = throttle * CONFIG.CAR.ACCELERATION * (0.35 + 0.65 * powerRatio);
  } else if (throttle < 0) {
    // Reverse acceleration
    if (longSpeed > 0.5) {
      // Natural braking if reversing while moving forward
      engineAccel = throttle * CONFIG.CAR.BRAKE_FORCE;
    } else {
      const revRatio = Math.max(0, 1 - (Math.abs(longSpeed) / CONFIG.CAR.MAX_REVERSE_SPEED));
      engineAccel = throttle * CONFIG.CAR.REVERSE_ACCEL * (0.5 + 0.5 * revRatio);
    }
  }

  // Active footbrake
  let brakeDecel = 0;
  if (brake > 0) {
    brakeDecel = brake * CONFIG.CAR.BRAKE_FORCE;
    state.isBraking = true;
  } else {
    state.isBraking = false;
  }

  // Handbrake forces
  if (handbrake) {
    brakeDecel += CONFIG.CAR.HANDBRAKE_FORCE;
    state.isBraking = true;
  }

  // Aerodynamic drag + Rolling resistance
  const dragForce = Math.sign(longSpeed) * (longSpeed * longSpeed) * CONFIG.CAR.DRAG_COEFFICIENT;
  let rollingResistance = Math.sign(longSpeed) * CONFIG.CAR.ROLLING_RESISTANCE;

  // Grass / gravel off-track slowdown
  if (state.isOffTrack) {
    rollingResistance *= CONFIG.CAR.OFFROAD_PENALTY;
  }

  // Apply longitudinal acceleration
  longSpeed += engineAccel * dt;

  // Apply braking and rolling drag against current direction of travel
  const totalBraking = (brakeDecel + Math.abs(rollingResistance) + Math.abs(dragForce)) * dt;
  if (Math.abs(longSpeed) <= totalBraking) {
    if (throttle === 0) longSpeed = 0;
  } else {
    longSpeed -= Math.sign(longSpeed) * totalBraking;
  }

  // Enforce speed caps
  longSpeed = clamp(longSpeed, -CONFIG.CAR.MAX_REVERSE_SPEED, CONFIG.CAR.MAX_SPEED);

  // Lateral Grip & Drift Dynamics
  const driftIntent = handbrake || (Math.abs(latSpeed) > CONFIG.CAR.DRIFT_SLIP_THRESHOLD && absSpeed > 10);
  const lateralGrip = driftIntent ? CONFIG.CAR.DRIFT_GRIP_LATERAL : CONFIG.CAR.GRIP_LATERAL;

  // Apply lateral tire friction
  latSpeed *= Math.max(0, 1.0 - lateralGrip * dt);

  state.isDrifting = driftIntent && absSpeed > 6.0;

  // Yaw Angular Dynamics (Bicycle kinematics model)
  const wheelbase = CONFIG.CAR.LENGTH * 0.6;
  let targetYawRate = 0;
  if (Math.abs(longSpeed) > 0.1) {
    targetYawRate = (longSpeed / wheelbase) * Math.sin(state.steerAngle);
  }

  // Extra slip rotation during drift
  if (state.isDrifting) {
    targetYawRate += (latSpeed / wheelbase) * 0.45;
  }

  state.angularVelocity = lerp(state.angularVelocity, targetYawRate, clamp(10.0 * dt, 0, 1));
  state.angle = normalizeAngle(state.angle + state.angularVelocity * dt);

  // Re-compute heading vectors with updated angle
  const updatedForwardX = Math.sin(state.angle);
  const updatedForwardZ = Math.cos(state.angle);
  const updatedRightX = Math.cos(state.angle);
  const updatedRightZ = -Math.sin(state.angle);

  // Reconstruct world velocities
  state.vx = longSpeed * updatedForwardX + latSpeed * updatedRightX;
  state.vz = longSpeed * updatedForwardZ + latSpeed * updatedRightZ;
  state.speed = longSpeed;
  state.lateralSpeed = latSpeed;

  // Integrate World Position
  state.x += state.vx * dt;
  state.z += state.vz * dt;

  // Track Barrier Collision Resolution
  resolveBarrierCollision(state, trackInfo);

  return state;
}

/**
 * Resolves car collision with track barriers / walls
 */
function resolveBarrierCollision(state, trackInfo) {
  if (!trackInfo.isHitBarrier) {
    state.colliding = false;
    return;
  }

  state.colliding = true;
  const cp = trackInfo.closestPoint;

  // Vector from closest track point to car
  const dx = state.x - cp.x;
  const dz = state.z - cp.z;
  const dist = Math.hypot(dx, dz) || 1;

  // Normal vector pointing inward toward the racetrack center
  const inwardNormX = -dx / dist;
  const inwardNormZ = -dz / dist;

  // Constrain car position to barrier perimeter
  const maxAllowedDist = 12.8;
  state.x = cp.x + (dx / dist) * maxAllowedDist;
  state.z = cp.z + (dz / dist) * maxAllowedDist;

  // Velocity dot product against inward normal
  const velDotNormal = state.vx * inwardNormX + state.vz * inwardNormZ;

  // If car is traveling into the wall (velDotNormal < 0)
  if (velDotNormal < 0) {
    const restitution = 0.35; // Wall bounce factor
    const friction = 0.70;    // Wall scrape slowdown

    // Velocity components normal and tangential to wall
    const vNormX = inwardNormX * velDotNormal;
    const vNormZ = inwardNormZ * velDotNormal;

    const vTangX = state.vx - vNormX;
    const vTangZ = state.vz - vNormZ;

    // Apply bounce and friction
    state.vx = (vTangX * friction) - (vNormX * restitution);
    state.vz = (vTangZ * friction) - (vNormZ * restitution);

    // Update speed
    const forwardX = Math.sin(state.angle);
    const forwardZ = Math.cos(state.angle);
    state.speed = (state.vx * forwardX + state.vz * forwardZ) * 0.8;
  }
}

/**
 * Resolves collisions between all pairs of cars (Car-to-Car Collision)
 */
export function resolveCarToCarCollisions(cars) {
  const carIds = Object.keys(cars);
  const radius = CONFIG.CAR.COLLISION_RADIUS;
  const minDistance = radius * 2;
  const minDistanceSq = minDistance * minDistance;

  for (let i = 0; i < carIds.length; i++) {
    const carA = cars[carIds[i]];
    if (!carA || !carA.physics) continue;

    for (let j = i + 1; j < carIds.length; j++) {
      const carB = cars[carIds[j]];
      if (!carB || !carB.physics) continue;

      const pA = carA.physics;
      const pB = carB.physics;

      const dx = pB.x - pA.x;
      const dz = pB.z - pA.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < minDistanceSq && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = minDistance - dist;

        // Normal from A to B
        const nx = dx / dist;
        const nz = dz / dist;

        // Separate positions equally
        const separation = overlap * 0.5;
        pA.x -= nx * separation;
        pA.z -= nz * separation;
        pB.x += nx * separation;
        pB.z += nz * separation;

        // Relative velocity
        const relVx = pB.vx - pA.vx;
        const relVz = pB.vz - pA.vz;

        // Velocity along collision normal
        const velAlongNormal = relVx * nx + relVz * nz;

        // Only apply impulse if objects are approaching
        if (velAlongNormal < 0) {
          const restitution = 0.5; // Bumper elasticity
          const impulseMag = -(1 + restitution) * velAlongNormal * 0.5;

          const impulseX = impulseMag * nx;
          const impulseZ = impulseMag * nz;

          pA.vx -= impulseX;
          pA.vz -= impulseZ;
          pB.vx += impulseX;
          pB.vz += impulseZ;

          // Slight rotational nudge
          pA.angularVelocity += (Math.random() - 0.5) * 1.5;
          pB.angularVelocity += (Math.random() - 0.5) * 1.5;

          pA.colliding = true;
          pB.colliding = true;
        }
      }
    }
  }
}
