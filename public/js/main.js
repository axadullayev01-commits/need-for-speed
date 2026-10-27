import { Renderer } from './Renderer.js';
import { TrackBuilder } from './TrackBuilder.js';
import { CarModel } from './CarModel.js';
import { InputManager } from './InputManager.js';
import { AudioManager } from './AudioManager.js';
import { ClientPrediction } from './ClientPrediction.js';
import { UIManager } from './UI.js';
import { NetworkManager } from './Network.js';

class GameApp {
  constructor() {
    this.state = 'MENU'; // 'MENU' | 'LOBBY' | 'COUNTDOWN' | 'RACING' | 'FINISHED'
    this.trackData = null;
    this.localPlayerId = null;
    this.roomData = null;
    this.isReady = false;

    // Entities
    this.localCar = null;
    this.remoteCars = new Map(); // id -> CarModel

    // Time tracking
    this.raceStartTime = 0;
    this.lastFrameTime = performance.now();
    this.totalLaps = 3;

    this.init();
  }

  async init() {
    // 1. Fetch Track Geometry
    try {
      const resp = await fetch('/api/track');
      this.trackData = await resp.json();
    } catch (e) {
      console.error('Failed to load track data:', e);
      return;
    }

    // 2. Initialize Subsystems
    const canvas = document.getElementById('canvas3d');
    this.renderer = new Renderer(canvas);
    this.audio = new AudioManager();
    this.ui = new UIManager();
    this.prediction = new ClientPrediction(null);

    // 3. Build 3D Track Circuit
    this.trackBuilder = new TrackBuilder(this.renderer.scene);
    this.trackBuilder.buildTrack(this.trackData.waypoints);

    // 4. Initialize Controls
    this.input = new InputManager((action) => this.handleGameAction(action));

    // 5. Initialize Networking
    this.network = new NetworkManager({
      onConnect: (socketId) => this.onServerConnected(socketId),
      onDisconnect: () => this.onServerDisconnected(),
      onRoomStateUpdate: (data) => this.onRoomStateUpdate(data),
      onCountdown: (count) => this.onCountdown(count),
      onRaceStart: (startData) => this.onRaceStart(startData),
      onSnapshot: (snapshot) => this.onServerSnapshot(snapshot),
      onLapComplete: (data) => this.onLapComplete(data),
      onPlayerFinished: (data) => this.onPlayerFinished(data),
      onRaceFinished: (data) => this.onRaceFinished(data),
      onPing: (ms) => this.ui.updatePing(ms)
    });

    this.network.connect();
    this.bindUIEvents();

    // 6. Start Main Animation Loop
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  bindUIEvents() {
    // Quick Match
    document.getElementById('btn-quick-match').addEventListener('click', () => {
      this.audio.init();
      const name = this.ui.getPlayerName();
      this.network.quickMatch(name, (res) => {
        if (!res.success) alert(res.reason || 'Failed to matchmake');
      });
    });

    // Create Room
    document.getElementById('btn-create-room').addEventListener('click', () => {
      this.audio.init();
      const name = this.ui.getPlayerName();
      this.network.createRoom(name, { totalLaps: 3 }, (res) => {
        if (!res.success) alert(res.reason || 'Failed to create room');
      });
    });

    // Toggle Join Code Input Container
    const joinCodeContainer = document.getElementById('join-code-container');
    document.getElementById('btn-join-room-modal').addEventListener('click', () => {
      joinCodeContainer.style.display = joinCodeContainer.style.display === 'none' ? 'block' : 'none';
    });

    // Submit Join Code
    document.getElementById('btn-submit-join').addEventListener('click', () => {
      this.audio.init();
      const codeInput = document.getElementById('join-room-code-input');
      const code = (codeInput?.value || '').trim();
      if (!code) return alert('Please enter a 6-letter room code.');

      const name = this.ui.getPlayerName();
      this.network.joinRoom(code, name, (res) => {
        if (!res.success) alert(res.reason || 'Failed to join room');
      });
    });

    // Color Selector Change
    const dots = document.querySelectorAll('.color-dot');
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const color = dot.getAttribute('data-color');
        if (this.localCar) this.localCar.setColor(color);
        this.network.setColor(color);
      });
    });

    // Ready Button
    document.getElementById('btn-ready-toggle').addEventListener('click', () => {
      this.isReady = !this.isReady;
      this.network.setReady(this.isReady);
      document.getElementById('btn-ready-toggle').innerText = this.isReady ? 'Cancel Ready' : 'Ready Up';
    });

    // Host Start Race
    document.getElementById('btn-start-race').addEventListener('click', () => {
      this.network.startRace();
    });

    // Leave Room
    document.getElementById('btn-leave-room').addEventListener('click', () => {
      this.network.leaveRoom();
      this.cleanupRace();
      this.ui.showMainMenu();
    });

    // Results Return to Lobby
    document.getElementById('btn-results-return').addEventListener('click', () => {
      this.cleanupRace();
      this.ui.showMainMenu();
    });
  }

  handleGameAction(action) {
    if (action === 'reset') {
      this.network.resetCar();
    } else if (action === 'camera_toggle') {
      this.renderer.cycleCamera();
    } else if (action === 'mute_toggle') {
      const isMuted = this.audio.toggleMute();
      console.log(`Audio muted: ${isMuted}`);
    }
  }

  onServerConnected(socketId) {
    this.localPlayerId = socketId;
    this.prediction.setLocalPlayerId(socketId);
  }

  onServerDisconnected() {
    this.cleanupRace();
    this.ui.showMainMenu();
  }

  onRoomStateUpdate(roomData) {
    this.roomData = roomData;
    this.totalLaps = roomData.totalLaps || 3;

    if (roomData.status === 'WAITING') {
      this.state = 'LOBBY';
      this.ui.showRoomLobby(roomData, this.localPlayerId);
      this.syncLobbyCars(roomData.players);
    }
  }

  syncLobbyCars(players) {
    // Ensure all players have 3D car models created on the starting grid
    const activeIds = new Set(players.map(p => p.id));

    // Remove cars of players who left
    for (const [id, car] of this.remoteCars.entries()) {
      if (!activeIds.has(id)) {
        car.destroy();
        this.remoteCars.delete(id);
        this.prediction.removeRemotePlayer(id);
      }
    }

    players.forEach((p, idx) => {
      const slot = this.trackData.gridSlots[idx % this.trackData.gridSlots.length];
      if (p.id === this.localPlayerId) {
        if (!this.localCar) {
          this.localCar = new CarModel(p.color, p.name, true);
          this.renderer.scene.add(this.localCar.mesh);
        } else {
          this.localCar.setColor(p.color);
        }
        this.localCar.mesh.position.set(slot.x, 0, slot.z);
        this.localCar.mesh.rotation.y = slot.angle || 0;
        this.prediction.initLocalState({
          x: slot.x,
          z: slot.z,
          angle: slot.angle || 0,
          speed: 0,
          vx: 0,
          vz: 0,
          steerAngle: 0
        });
      } else {
        if (!this.remoteCars.has(p.id)) {
          const remoteCar = new CarModel(p.color, p.name, false);
          this.renderer.scene.add(remoteCar.mesh);
          this.remoteCars.set(p.id, remoteCar);
        } else {
          this.remoteCars.get(p.id).setColor(p.color);
        }
        const rCar = this.remoteCars.get(p.id);
        rCar.mesh.position.set(slot.x, 0, slot.z);
        rCar.mesh.rotation.y = slot.angle || 0;
      }
    });
  }

  onCountdown(count) {
    this.state = 'COUNTDOWN';
    this.ui.showGameHUD();
    this.ui.showCountdown(count);
    this.audio.playCountdownBeep(count === 'GO');
  }

  onRaceStart(startData) {
    this.state = 'RACING';
    this.raceStartTime = startData.startTime || Date.now();
    this.totalLaps = startData.totalLaps || 3;
    this.ui.showGameHUD();
    this.ui.updateLap(0, this.totalLaps);
    if (this.ui.finishBanner) {
      this.ui.finishBanner.style.display = 'none';
    }
  }

  onServerSnapshot(snapshot) {
    if (!snapshot || !snapshot.players) return;

    // 1. Reconcile local player prediction with authoritative server position
    const serverLocal = snapshot.players[this.localPlayerId];
    if (serverLocal) {
      this.prediction.reconcileServerSnapshot(serverLocal);
      if (serverLocal.colliding) {
        this.audio.playCollision();
      }
      if (serverLocal.finished && this.state !== 'FINISHED') {
        this.onPlayerFinished({
          playerId: this.localPlayerId,
          name: serverLocal.name || 'Driver',
          rank: serverLocal.finishRank || 1,
          finishTime: 0,
          leaderboard: snapshot.leaderboard
        });
      }
    }

    // 2. Buffer remote snapshots for smooth interpolation
    this.prediction.bufferRemoteSnapshot(snapshot.players);

    // 3. Update HUD Leaderboard & Positions
    if (snapshot.leaderboard) {
      this.ui.updateLeaderboard(snapshot.leaderboard, this.localPlayerId);

      const localEntry = snapshot.leaderboard.find(item => item.id === this.localPlayerId);
      if (localEntry) {
        this.ui.updatePosition(localEntry.rank, snapshot.leaderboard.length);
      }

      if (this.state === 'FINISHED' && this.ui.resultsModal.style.display === 'flex') {
        this.ui.showResultsPodium(snapshot.leaderboard, this.localPlayerId);
      }
    }
  }

  onLapComplete(data) {
    if (data.playerId === this.localPlayerId) {
      this.ui.updateLap(data.completedLaps, data.totalLaps);
    }
  }

  onPlayerFinished(data) {
    console.log(`Player ${data.name} finished at rank #${data.rank} in ${data.finishTime}s!`);
    if (data.playerId === this.localPlayerId) {
      this.state = 'FINISHED';
      this.audio.stopEngine();
      this.ui.updateLap(this.totalLaps, this.totalLaps);
      this.ui.showPlayerFinishedBanner(data.rank, data.finishTime);
      setTimeout(() => {
        this.ui.showResultsPodium(data.leaderboard, this.localPlayerId);
      }, 2500);
    } else if (this.state === 'FINISHED') {
      this.ui.showResultsPodium(data.leaderboard, this.localPlayerId);
    }
  }

  onRaceFinished(data) {
    this.state = 'FINISHED';
    this.audio.stopEngine();
    this.ui.showResultsPodium(data.leaderboard, this.localPlayerId);
  }

  cleanupRace() {
    this.state = 'MENU';
    this.audio.stopEngine();
    if (this.ui.finishBanner) {
      this.ui.finishBanner.style.display = 'none';
    }
    if (this.ui.resultsModal) {
      this.ui.resultsModal.style.display = 'none';
    }
    if (this.localCar) {
      this.localCar.destroy();
      this.localCar = null;
    }
    for (const car of this.remoteCars.values()) {
      car.destroy();
    }
    this.remoteCars.clear();
  }

  /**
   * Main 60 FPS Game Loop
   */
  gameLoop(now) {
    requestAnimationFrame((t) => this.gameLoop(t));

    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    // Handle Local Player Simulation & Prediction during active race
    if (this.state === 'RACING' && this.localCar && this.prediction.predictedState) {
      // 1. Sample inputs
      const rawInput = this.input.sampleInput();

      // 2. Client Prediction step
      const inputPayload = this.prediction.processLocalInput(rawInput, dt);

      // 3. Transmit input packet to authoritative server
      if (inputPayload) {
        this.network.sendInput(inputPayload);
      }

      // 4. Update local 3D car visuals
      this.localCar.updateVisuals(this.prediction.predictedState, dt);

      // 5. Update audio synthesizer
      this.audio.update(
        this.prediction.predictedState.speed,
        rawInput.throttle,
        this.prediction.predictedState.isDrifting
      );

      // 6. Update HUD Speedometer & Drift alert
      this.ui.updateSpeedometer(this.prediction.predictedState.speed);
      this.ui.showDrift(this.prediction.predictedState.isDrifting);

      // 7. Update Race Elapsed Time
      const elapsed = (Date.now() - this.raceStartTime) / 1000;
      this.ui.updateRaceTime(elapsed);
    } else if (this.state === 'FINISHED' && this.localCar && this.prediction.predictedState) {
      // Finished state: smoothly bring car to halt
      this.prediction.predictedState.speed = Math.max(0, (this.prediction.predictedState.speed || 0) * 0.9);
      this.localCar.updateVisuals(this.prediction.predictedState, dt);
      this.ui.updateSpeedometer(this.prediction.predictedState.speed);
    }

    // Update Remote Players via Entity Interpolation
    const allPositionsForMinimap = {};
    if (this.prediction.predictedState) {
      allPositionsForMinimap[this.localPlayerId] = {
        x: this.prediction.predictedState.x,
        z: this.prediction.predictedState.z,
        angle: this.prediction.predictedState.angle,
        color: this.localCar?.color
      };
    }

    for (const [id, car] of this.remoteCars.entries()) {
      const interpState = this.prediction.getInterpolatedRemoteState(id);
      if (interpState) {
        car.updateVisuals(interpState, dt);
        allPositionsForMinimap[id] = {
          x: interpState.x,
          z: interpState.z,
          angle: interpState.angle,
          color: car.color
        };
      }
    }

    // Render 2D Radar Minimap
    if (this.state === 'RACING' || this.state === 'COUNTDOWN') {
      this.ui.renderMinimap(this.trackData.waypoints, allPositionsForMinimap, this.localPlayerId);
    }

    // Follow Camera update
    if (this.localCar) {
      const carSpeed = this.prediction.predictedState?.speed || 0;
      this.renderer.updateCamera(this.localCar.mesh, carSpeed, dt);
    }

    // Render 3D Scene
    this.renderer.render();
  }
}

// Bootstrap Application on window load
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
