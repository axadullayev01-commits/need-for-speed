/**
 * Client Prediction, Server Reconciliation, and Entity Interpolation System
 */

// Helper to normalize angle difference into [-PI, PI]
function shortestAngleDiff(from, to) {
  let diff = to - from;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

// Lerp angle along shortest path
function lerpAngle(from, to, t) {
  return from + shortestAngleDiff(from, to) * t;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class ClientPrediction {
  constructor(localPlayerId) {
    this.localPlayerId = localPlayerId;
    this.inputSeq = 0;
    this.pendingInputs = []; // [{ seq, input, state }]

    // Local predicted state
    this.predictedState = null;

    // Buffer for remote entities interpolation
    // remoteSnapshots: Map<playerId, [{ timestamp, state }, ...]>
    this.remoteSnapshots = new Map();
    this.interpolationDelayMs = 70; // 70ms buffer for smooth interpolation
  }

  setLocalPlayerId(id) {
    this.localPlayerId = id;
  }

  initLocalState(initialState) {
    this.predictedState = { ...initialState };
    this.pendingInputs = [];
  }

  /**
   * Records a local input, advances local simulation immediately, and queues for reconciliation.
   */
  processLocalInput(input, dt) {
    if (!this.predictedState) return null;

    this.inputSeq++;
    const payload = {
      seq: this.inputSeq,
      throttle: input.throttle,
      steer: input.steer,
      brake: input.brake,
      handbrake: input.handbrake
    };

    // Client-side local prediction
    this.stepLocalPhysics(this.predictedState, payload, dt);

    // Save snapshot of state after input
    this.pendingInputs.push({
      seq: this.inputSeq,
      input: payload,
      state: { ...this.predictedState }
    });

    // Keep pending buffer bounded
    if (this.pendingInputs.length > 120) {
      this.pendingInputs.shift();
    }

    return payload;
  }

  /**
   * Lightweight client-side kinematics model mirroring server physics
   */
  stepLocalPhysics(state, input, dt) {
    const throttle = input.throttle;
    const steer = input.steer;
    const brake = input.brake;
    const handbrake = input.handbrake;

    // Steering
    const absSpeed = Math.abs(state.speed || 0);
    const steerScale = 1.0 / (1.0 + absSpeed * 0.022);
    const targetSteerAngle = steer * 0.65 * steerScale;
    state.steerAngle = lerp(state.steerAngle || 0, targetSteerAngle, Math.min(1, 4.5 * dt));

    // Direction vectors
    const forwardX = Math.sin(state.angle || 0);
    const forwardZ = Math.cos(state.angle || 0);
    const rightX = Math.cos(state.angle || 0);
    const rightZ = -Math.sin(state.angle || 0);

    let longSpeed = (state.vx || 0) * forwardX + (state.vz || 0) * forwardZ;
    let latSpeed = (state.vx || 0) * rightX + (state.vz || 0) * rightZ;

    // Engine forces
    let accel = 0;
    if (throttle > 0) {
      accel = throttle * 28.0 * (0.35 + 0.65 * Math.max(0, 1 - (longSpeed / 65.0)));
    } else if (throttle < 0) {
      accel = throttle * 14.0;
    }

    // Brake forces
    let decel = 0;
    if (brake > 0) decel += brake * 42.0;
    if (handbrake) decel += 25.0;

    // Drag & rolling
    const drag = Math.sign(longSpeed) * (longSpeed * longSpeed) * 0.0018;
    const roll = Math.sign(longSpeed) * 1.8;

    longSpeed += accel * dt;
    const totalDecel = (decel + Math.abs(roll) + Math.abs(drag)) * dt;

    if (Math.abs(longSpeed) <= totalDecel) {
      if (throttle === 0) longSpeed = 0;
    } else {
      longSpeed -= Math.sign(longSpeed) * totalDecel;
    }

    // Drift / lateral grip
    const isDrifting = handbrake || (Math.abs(latSpeed) > 12.0 && absSpeed > 10);
    const lateralGrip = isDrifting ? 5.5 : 18.0;
    latSpeed *= Math.max(0, 1.0 - lateralGrip * dt);

    state.isDrifting = isDrifting && absSpeed > 6.0;
    state.isBraking = brake > 0 || handbrake;

    // Yaw kinematics
    const wheelbase = 2.64;
    let targetYawRate = 0;
    if (Math.abs(longSpeed) > 0.1) {
      targetYawRate = (longSpeed / wheelbase) * Math.sin(state.steerAngle);
    }
    if (state.isDrifting) {
      targetYawRate += (latSpeed / wheelbase) * 0.45;
    }

    state.angularVelocity = lerp(state.angularVelocity || 0, targetYawRate, Math.min(1, 10.0 * dt));
    state.angle = (state.angle || 0) + (state.angularVelocity || 0) * dt;

    const fX = Math.sin(state.angle);
    const fZ = Math.cos(state.angle);
    const rX = Math.cos(state.angle);
    const rZ = -Math.sin(state.angle);

    state.vx = longSpeed * fX + latSpeed * rX;
    state.vz = longSpeed * fZ + latSpeed * rZ;
    state.speed = longSpeed;
    state.lateralSpeed = latSpeed;

    state.x = (state.x || 0) + state.vx * dt;
    state.z = (state.z || 0) + state.vz * dt;
  }

  /**
   * Reconciles local predicted state with authoritative server state
   */
  reconcileServerSnapshot(serverPlayer) {
    if (!this.predictedState || !serverPlayer) return;

    const lastAckSeq = serverPlayer.lastProcessedInputSeq;

    // Remove inputs acknowledged by server
    this.pendingInputs = this.pendingInputs.filter(item => item.seq > lastAckSeq);

    // Check discrepancy with server authoritative state
    const dx = this.predictedState.x - serverPlayer.x;
    const dz = this.predictedState.z - serverPlayer.z;
    const errorDist = Math.hypot(dx, dz);

    // If drift error exceeds 0.2 units, perform reconciliation replay
    if (errorDist > 0.2) {
      // Reset state to server's confirmed state
      this.predictedState.x = serverPlayer.x;
      this.predictedState.z = serverPlayer.z;
      this.predictedState.angle = serverPlayer.angle;
      this.predictedState.speed = serverPlayer.speed;
      this.predictedState.steerAngle = serverPlayer.steerAngle;

      // Replay all pending unacknowledged inputs
      const dt = 1 / 60;
      for (let i = 0; i < this.pendingInputs.length; i++) {
        this.stepLocalPhysics(this.predictedState, this.pendingInputs[i].input, dt);
        this.pendingInputs[i].state = { ...this.predictedState };
      }
    } else {
      // Soft-correct tiny discrepancies smoothly
      this.predictedState.speed = lerp(this.predictedState.speed, serverPlayer.speed, 0.2);
    }

    // Keep flags synced
    this.predictedState.isDrifting = serverPlayer.isDrifting;
    this.predictedState.isBraking = serverPlayer.isBraking;
    this.predictedState.isOffTrack = serverPlayer.isOffTrack;
  }

  /**
   * Buffers remote player states received from server snapshots
   */
  bufferRemoteSnapshot(players, timestamp) {
    for (const [id, player] of Object.entries(players)) {
      if (id === this.localPlayerId) continue;

      if (!this.remoteSnapshots.has(id)) {
        this.remoteSnapshots.set(id, []);
      }

      const buffer = this.remoteSnapshots.get(id);
      buffer.push({ timestamp, state: player });

      // Keep recent 1.5 seconds of history
      const cutoff = timestamp - 1500;
      while (buffer.length > 2 && buffer[0].timestamp < cutoff) {
        buffer.shift();
      }
    }
  }

  /**
   * Interpolates a remote player between recorded snapshots for butter-smooth 60fps rendering
   */
  getInterpolatedRemoteState(playerId) {
    const buffer = this.remoteSnapshots.get(playerId);
    if (!buffer || buffer.length === 0) return null;

    const renderTime = Date.now() - this.interpolationDelayMs;

    // If renderTime is older than our oldest snapshot, return oldest
    if (renderTime <= buffer[0].timestamp) {
      return buffer[0].state;
    }

    // If renderTime is newer than newest snapshot, return newest
    if (renderTime >= buffer[buffer.length - 1].timestamp) {
      return buffer[buffer.length - 1].state;
    }

    // Find surrounding snapshots [s0, s1]
    let s0 = buffer[0];
    let s1 = buffer[1];
    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i].timestamp <= renderTime && renderTime <= buffer[i + 1].timestamp) {
        s0 = buffer[i];
        s1 = buffer[i + 1];
        break;
      }
    }

    const duration = s1.timestamp - s0.timestamp || 1;
    const t = Math.max(0, Math.min(1, (renderTime - s0.timestamp) / duration));

    // Spherical / linear interpolation
    return {
      id: playerId,
      x: lerp(s0.state.x, s1.state.x, t),
      z: lerp(s0.state.z, s1.state.z, t),
      angle: lerpAngle(s0.state.angle, s1.state.angle, t),
      speed: lerp(s0.state.speed, s1.state.speed, t),
      steerAngle: lerp(s0.state.steerAngle || 0, s1.state.steerAngle || 0, t),
      isDrifting: s1.state.isDrifting,
      isBraking: s1.state.isBraking,
      isOffTrack: s1.state.isOffTrack
    };
  }

  removeRemotePlayer(playerId) {
    this.remoteSnapshots.delete(playerId);
  }
}
