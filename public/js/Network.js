/**
 * Network Manager: Socket.io Client Wrapper & Event Handling
 */
export class NetworkManager {
  constructor(callbacks = {}) {
    this.socket = null;
    this.callbacks = callbacks;
    this.ping = 0;
    this.pingTimer = null;
  }

  connect() {
    this.socket = io();

    this.socket.on('connect', () => {
      console.log(`[Connected to Server] Socket ID: ${this.socket.id}`);
      if (this.callbacks.onConnect) this.callbacks.onConnect(this.socket.id);
      this.startPingMeasurement();
    });

    this.socket.on('disconnect', () => {
      console.log('[Disconnected from Server]');
      if (this.callbacks.onDisconnect) this.callbacks.onDisconnect();
      this.stopPingMeasurement();
    });

    // Room and Race Events
    this.socket.on('room_state_update', (data) => {
      if (this.callbacks.onRoomStateUpdate) this.callbacks.onRoomStateUpdate(data);
    });

    this.socket.on('race_countdown', (data) => {
      if (this.callbacks.onCountdown) this.callbacks.onCountdown(data.count);
    });

    this.socket.on('race_start', (data) => {
      if (this.callbacks.onRaceStart) this.callbacks.onRaceStart(data);
    });

    this.socket.on('game_snapshot', (snapshot) => {
      if (this.callbacks.onSnapshot) this.callbacks.onSnapshot(snapshot);
    });

    this.socket.on('lap_complete', (data) => {
      if (this.callbacks.onLapComplete) this.callbacks.onLapComplete(data);
    });

    this.socket.on('player_finished', (data) => {
      if (this.callbacks.onPlayerFinished) this.callbacks.onPlayerFinished(data);
    });

    this.socket.on('race_finished', (data) => {
      if (this.callbacks.onRaceFinished) this.callbacks.onRaceFinished(data);
    });
  }

  getSocketId() {
    return this.socket?.id;
  }

  startPingMeasurement() {
    this.pingTimer = setInterval(() => {
      if (!this.socket || !this.socket.connected) return;
      const start = Date.now();
      this.socket.emit('ping_check', start, (sentTimestamp) => {
        this.ping = Date.now() - sentTimestamp;
        if (this.callbacks.onPing) this.callbacks.onPing(this.ping);
      });
    }, 2000);
  }

  stopPingMeasurement() {
    if (this.pingTimer) clearInterval(this.pingTimer);
  }

  createRoom(playerName, options, callback) {
    this.socket.emit('create_room', { playerName, ...options }, callback);
  }

  joinRoom(roomId, playerName, callback) {
    this.socket.emit('join_room', { roomId, playerName }, callback);
  }

  quickMatch(playerName, callback) {
    this.socket.emit('quick_match', { playerName }, callback);
  }

  setReady(ready) {
    this.socket.emit('player_ready', { ready });
  }

  setColor(color) {
    this.socket.emit('player_color', { color });
  }

  startRace() {
    this.socket.emit('start_race');
  }

  sendInput(payload) {
    this.socket.emit('player_input', payload);
  }

  resetCar() {
    this.socket.emit('reset_car');
  }

  leaveRoom() {
    this.socket.emit('leave_room');
  }
}
