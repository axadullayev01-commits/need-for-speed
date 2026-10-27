import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { RoomManager } from './RoomManager.js';
import { CIRCUIT_WAYPOINTS, CHECKPOINTS, START_GRID_SLOTS } from './TrackData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve static frontend files
app.use(express.static(path.join(rootDir, 'public')));

// Expose track metadata endpoint for client consumption
app.get('/api/track', (req, res) => {
  res.json({
    waypoints: CIRCUIT_WAYPOINTS,
    checkpoints: CHECKPOINTS,
    gridSlots: START_GRID_SLOTS,
    config: CONFIG.CAR
  });
});

const roomManager = new RoomManager(io);

// Socket.io Connection & Networking Events
io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // Create new custom room
  socket.on('create_room', (data, callback) => {
    const playerName = data?.playerName || 'Racer';
    const options = {
      totalLaps: data?.totalLaps || CONFIG.DEFAULT_LAPS,
      maxPlayers: data?.maxPlayers || CONFIG.MAX_PLAYERS_PER_ROOM
    };
    const result = roomManager.createRoom(socket, playerName, options);
    if (typeof callback === 'function') callback(result);
  });

  // Join existing room by Room Code
  socket.on('join_room', (data, callback) => {
    const { roomId, playerName } = data || {};
    const result = roomManager.joinRoom(socket, roomId, playerName);
    if (typeof callback === 'function') callback(result);
  });

  // Quick matchmaking
  socket.on('quick_match', (data, callback) => {
    const playerName = data?.playerName || 'Racer';
    const result = roomManager.matchmake(socket, playerName);
    if (typeof callback === 'function') callback(result);
  });

  // Lobby browser: list public active rooms
  socket.on('list_rooms', (callback) => {
    if (typeof callback === 'function') {
      callback(roomManager.listRooms());
    }
  });

  // Toggle ready status
  socket.on('player_ready', (data) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.setReady(socket.id, data?.ready);
    }
  });

  // Change car color
  socket.on('player_color', (data) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room && data?.color) {
      room.setColor(socket.id, data.color);
    }
  });

  // Host starts the race countdown
  socket.on('start_race', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.startCountdown(socket.id);
    }
  });

  // Receive high-frequency client physics input
  socket.on('player_input', (inputPayload) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.receiveInput(socket.id, inputPayload);
    }
  });

  // Reset/respawn car onto track
  socket.on('reset_car', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.resetCar(socket.id);
    }
  });

  // Ping check for RTT latency measurement
  socket.on('ping_check', (timestamp, callback) => {
    if (typeof callback === 'function') {
      callback(timestamp);
    }
  });

  // Leave room manually
  socket.on('leave_room', () => {
    roomManager.leaveCurrentRoom(socket.id);
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    roomManager.leaveCurrentRoom(socket.id);
  });
});

// Start Server
server.listen(CONFIG.PORT, () => {
  console.log(`
  ==============================================================
    🏎️  NEED FOR SPEED // MULTIPLAYER CAR RACING SERVER 🏎️
  ==============================================================
    Status:      ONLINE
    Port:        ${CONFIG.PORT}
    URL:         http://localhost:${CONFIG.PORT}
    Tick Rate:   ${CONFIG.TICK_RATE} Hz (Authoritative Physics)
    Broadcast:   ${CONFIG.SNAPSHOT_RATE} Hz (Snapshots)
  ==============================================================
  `);
});
