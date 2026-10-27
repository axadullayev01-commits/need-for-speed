import { CONFIG } from './config.js';
import { CHECKPOINTS, START_GRID_SLOTS, getTrackProgress, hasCrossedCheckpoint } from './TrackData.js';
import { createCarPhysicsState, stepCarPhysics, resolveCarToCarCollisions } from './PhysicsEngine.js';

export class GameRoom {
  constructor(id, hostSocket, io, options = {}) {
    this.id = id;
    this.io = io;
    this.hostId = hostSocket.id;
    this.maxPlayers = options.maxPlayers || CONFIG.MAX_PLAYERS_PER_ROOM;
    this.totalLaps = options.totalLaps || CONFIG.DEFAULT_LAPS;

    // Room Status: 'WAITING' | 'COUNTDOWN' | 'RACING' | 'FINISHED'
    this.status = 'WAITING';

    this.players = new Map();
    this.countdownTimer = null;
    this.countdownSeconds = CONFIG.COUNTDOWN_SECONDS;

    this.raceStartTime = 0;
    this.gameLoopInterval = null;
    this.snapshotInterval = null;
    this.finishCount = 0;

    // Available car color palettes
    this.colorPalette = [
      '#ff0055', // Neon Crimson
      '#00d4ff', // Electric Cyan
      '#ffe600', // Cyber Yellow
      '#39ff14', // Acid Green
      '#ff7700', // Sunset Orange
      '#b026ff', // Neon Purple
      '#ffffff', // Arctic White
      '#00ffaa'  // Mint Turquoise
    ];
  }

  /**
   * Adds a player to the room
   */
  addPlayer(socket, name = 'Racer') {
    if (this.players.size >= this.maxPlayers) {
      return { success: false, reason: 'Room is full' };
    }

    if (this.status !== 'WAITING') {
      return { success: false, reason: 'Race already in progress' };
    }

    const slotIndex = this.players.size;
    const spawnSlot = START_GRID_SLOTS[slotIndex % START_GRID_SLOTS.length];
    const assignedColor = this.colorPalette[slotIndex % this.colorPalette.length];

    const player = {
      id: socket.id,
      name: (name || `Racer ${slotIndex + 1}`).substring(0, 16),
      color: assignedColor,
      isHost: socket.id === this.hostId,
      ready: socket.id === this.hostId, // Host is ready by default
      slotIndex,
      physics: createCarPhysicsState(spawnSlot),
      inputQueue: [],
      lastProcessedInputSeq: 0,
      currentLap: 1,
      currentCheckpointIndex: 0,
      checkpointPassedCount: 0,
      lapTimes: [],
      lapStartTime: 0,
      finishRank: 0,
      finished: false,
      finishTime: 0,
      prevX: spawnSlot.x,
      prevZ: spawnSlot.z
    };

    this.players.set(socket.id, player);
    socket.join(this.id);

    this.broadcastRoomState();
    return { success: true, player };
  }

  /**
   * Removes a player on disconnect or leave
   */
  removePlayer(socketId) {
    if (!this.players.has(socketId)) return;

    this.players.delete(socketId);

    // If host leaves, assign host to next player
    if (socketId === this.hostId && this.players.size > 0) {
      const nextHostId = this.players.keys().next().value;
      this.hostId = nextHostId;
      const hostPlayer = this.players.get(nextHostId);
      if (hostPlayer) hostPlayer.isHost = true;
    }

    if (this.players.size === 0) {
      this.destroy();
    } else {
      this.broadcastRoomState();
    }
  }

  /**
   * Toggles ready status
   */
  setReady(socketId, ready) {
    const player = this.players.get(socketId);
    if (!player || this.status !== 'WAITING') return;

    player.ready = Boolean(ready);
    this.broadcastRoomState();
  }

  /**
   * Updates car color customization
   */
  setColor(socketId, color) {
    const player = this.players.get(socketId);
    if (!player || this.status !== 'WAITING') return;

    player.color = color;
    this.broadcastRoomState();
  }

  /**
   * Pushes incoming client inputs into player's input buffer
   */
  receiveInput(socketId, inputPayload) {
    const player = this.players.get(socketId);
    if (!player || this.status !== 'RACING') return;

    // Payload: { seq, throttle, steer, brake, handbrake }
    if (typeof inputPayload?.seq === 'number') {
      player.inputQueue.push(inputPayload);
      // Keep queue manageable
      if (player.inputQueue.length > 30) {
        player.inputQueue.shift();
      }
    }
  }

  /**
   * Resets car safely to track centerline if user presses reset or flips
   */
  resetCar(socketId) {
    const player = this.players.get(socketId);
    if (!player || this.status !== 'RACING') return;

    const cp = CHECKPOINTS[player.currentCheckpointIndex];
    player.physics.x = cp.x;
    player.physics.z = cp.z;
    player.physics.vx = 0;
    player.physics.vz = 0;
    player.physics.speed = 0;
    player.physics.lateralSpeed = 0;
    player.physics.angularVelocity = 0;
    // Align with checkpoint forward tangent
    player.physics.angle = Math.atan2(cp.dirX, cp.dirZ);
  }

  /**
   * Starts race countdown (Host only)
   */
  startCountdown(socketId) {
    if (socketId !== this.hostId || this.status !== 'WAITING') return;

    // Check if at least 1 player is in room
    if (this.players.size === 0) return;

    this.status = 'COUNTDOWN';
    this.countdownSeconds = CONFIG.COUNTDOWN_SECONDS;
    this.finishCount = 0;

    // Reset all player states onto grid
    let slot = 0;
    for (const player of this.players.values()) {
      const spawnSlot = START_GRID_SLOTS[slot % START_GRID_SLOTS.length];
      player.physics = createCarPhysicsState(spawnSlot);
      player.currentLap = 1;
      player.currentCheckpointIndex = 0;
      player.checkpointPassedCount = 0;
      player.lapTimes = [];
      player.finishRank = 0;
      player.finished = false;
      player.finishTime = 0;
      player.prevX = spawnSlot.x;
      player.prevZ = spawnSlot.z;
      player.inputQueue = [];
      slot++;
    }

    this.io.to(this.id).emit('race_countdown', { count: this.countdownSeconds });

    this.countdownTimer = setInterval(() => {
      this.countdownSeconds--;
      if (this.countdownSeconds > 0) {
        this.io.to(this.id).emit('race_countdown', { count: this.countdownSeconds });
      } else if (this.countdownSeconds === 0) {
        this.io.to(this.id).emit('race_countdown', { count: 'GO' });
        clearInterval(this.countdownTimer);
        this.startRaceLoop();
      }
    }, 1000);
  }

  /**
   * Begins authoritative 60 FPS physics loop
   */
  startRaceLoop() {
    this.status = 'RACING';
    this.raceStartTime = Date.now();

    for (const player of this.players.values()) {
      player.lapStartTime = this.raceStartTime;
    }

    this.io.to(this.id).emit('race_start', {
      startTime: this.raceStartTime,
      totalLaps: this.totalLaps
    });

    const dt = CONFIG.DT;

    // Fixed 60 FPS physics simulation
    this.gameLoopInterval = setInterval(() => {
      this.updatePhysicsTick(dt);
    }, 1000 / CONFIG.TICK_RATE);

    // 30 FPS state snapshot broadcast to clients
    this.snapshotInterval = setInterval(() => {
      this.broadcastSnapshot();
    }, 1000 / CONFIG.SNAPSHOT_RATE);
  }

  /**
   * Single physics simulation tick (60 Hz)
   */
  updatePhysicsTick(dt) {
    const now = Date.now();

    // 1. Process inputs and step physics for each player
    for (const player of this.players.values()) {
      player.prevX = player.physics.x;
      player.prevZ = player.physics.z;

      // Drain queued inputs
      if (player.inputQueue.length > 0) {
        while (player.inputQueue.length > 0) {
          const input = player.inputQueue.shift();
          stepCarPhysics(player.physics, input, dt);
          player.lastProcessedInputSeq = input.seq;
        }
      } else {
        // If no new input was received in this tick, simulate with neutral idle inputs
        stepCarPhysics(player.physics, { throttle: 0, steer: 0, brake: 0, handbrake: false }, dt);
      }

      // 2. Checkpoint and Lap Verification
      if (!player.finished) {
        const nextCp = CHECKPOINTS[player.currentCheckpointIndex];
        const crossed = hasCrossedCheckpoint(
          player.prevX,
          player.prevZ,
          player.physics.x,
          player.physics.z,
          nextCp
        );

        if (crossed) {
          player.checkpointPassedCount++;
          player.currentCheckpointIndex = (player.currentCheckpointIndex + 1) % CHECKPOINTS.length;

          // If crossed start/finish line (Checkpoint 0)
          if (player.currentCheckpointIndex === 0) {
            const lapTime = (now - player.lapStartTime) / 1000;
            player.lapTimes.push(lapTime);
            player.lapStartTime = now;

            if (player.currentLap >= this.totalLaps) {
              // Player finished race!
              this.finishCount++;
              player.finished = true;
              player.finishRank = this.finishCount;
              player.finishTime = (now - this.raceStartTime) / 1000;

              this.io.to(this.id).emit('player_finished', {
                playerId: player.id,
                name: player.name,
                rank: player.finishRank,
                finishTime: player.finishTime,
                lapTimes: player.lapTimes
              });

              // If all players have finished, end race
              if (this.finishCount >= this.players.size) {
                this.finishRace();
              }
            } else {
              player.currentLap++;
              this.io.to(player.id).emit('lap_complete', {
                lap: player.currentLap,
                totalLaps: this.totalLaps,
                lapTime
              });
            }
          }
        }
      }
    }

    // 3. Resolve Car-to-Car Collisions
    const playersObj = {};
    for (const [id, player] of this.players.entries()) {
      playersObj[id] = player;
    }
    resolveCarToCarCollisions(playersObj);
  }

  /**
   * Broadcasts high-frequency world snapshot to room
   */
  broadcastSnapshot() {
    const now = Date.now();
    const leaderboard = this.calculateLeaderboard();

    const snapshot = {
      timestamp: now,
      leaderboard,
      players: {}
    };

    for (const [id, player] of this.players.entries()) {
      snapshot.players[id] = {
        id: player.id,
        x: Number(player.physics.x.toFixed(3)),
        z: Number(player.physics.z.toFixed(3)),
        angle: Number(player.physics.angle.toFixed(4)),
        speed: Number(player.physics.speed.toFixed(2)),
        lateralSpeed: Number(player.physics.lateralSpeed.toFixed(2)),
        steerAngle: Number(player.physics.steerAngle.toFixed(3)),
        isDrifting: player.physics.isDrifting,
        isBraking: player.physics.isBraking,
        isOffTrack: player.physics.isOffTrack,
        colliding: player.physics.colliding,
        lastProcessedInputSeq: player.lastProcessedInputSeq,
        currentLap: player.currentLap,
        finished: player.finished,
        finishRank: player.finishRank
      };
    }

    this.io.to(this.id).emit('game_snapshot', snapshot);
  }

  /**
   * Calculates live race standings
   */
  calculateLeaderboard() {
    const list = Array.from(this.players.values()).map(p => {
      const progress = getTrackProgress(p.physics.x, p.physics.z);
      // Continuous race score for ordering
      const score = p.finished
        ? 1000000 - p.finishRank
        : (p.currentLap * 10000) + (p.checkpointPassedCount * 100) + progress.progressRatio;

      return {
        id: p.id,
        name: p.name,
        color: p.color,
        lap: p.currentLap,
        score,
        finished: p.finished,
        finishRank: p.finishRank,
        finishTime: p.finishTime
      };
    });

    list.sort((a, b) => b.score - a.score);

    return list.map((item, index) => ({
      rank: index + 1,
      id: item.id,
      name: item.name,
      color: item.color,
      lap: Math.min(item.lap, this.totalLaps),
      finished: item.finished,
      finishRank: item.finishRank,
      finishTime: item.finishTime
    }));
  }

  /**
   * Ends race and presents podium results
   */
  finishRace() {
    this.status = 'FINISHED';
    clearInterval(this.gameLoopInterval);
    clearInterval(this.snapshotInterval);

    const finalLeaderboard = this.calculateLeaderboard();
    this.io.to(this.id).emit('race_finished', {
      leaderboard: finalLeaderboard
    });
  }

  /**
   * Broadcasts room state (lobby, player list, ready flags)
   */
  broadcastRoomState() {
    const playerList = Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      isHost: p.isHost,
      ready: p.ready
    }));

    this.io.to(this.id).emit('room_state_update', {
      roomId: this.id,
      hostId: this.hostId,
      status: this.status,
      maxPlayers: this.maxPlayers,
      totalLaps: this.totalLaps,
      players: playerList
    });
  }

  /**
   * Cleans up room intervals and memory
   */
  destroy() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    if (this.snapshotInterval) clearInterval(this.snapshotInterval);
  }
}
