import { GameRoom } from './GameRoom.js';
import { CONFIG } from './config.js';

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();             // roomId -> GameRoom instance
    this.playerRoomMap = new Map();     // socketId -> roomId
  }

  /**
   * Generates a readable 6-character alphanumeric room code
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars like 0, O, 1, I
    let code;
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < CONFIG.ROOM_CODE_LENGTH; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
    } while (this.rooms.has(code) && attempts < 100);

    return code;
  }

  /**
   * Creates a new game room
   */
  createRoom(socket, playerName, options = {}) {
    this.leaveCurrentRoom(socket.id);

    const roomId = this.generateRoomCode();
    const room = new GameRoom(roomId, socket, this.io, options);
    this.rooms.set(roomId, room);

    const joinResult = room.addPlayer(socket, playerName);
    if (joinResult.success) {
      this.playerRoomMap.set(socket.id, roomId);
    }

    return { roomId, success: joinResult.success, player: joinResult.player };
  }

  /**
   * Joins an existing room by code
   */
  joinRoom(socket, roomId, playerName) {
    this.leaveCurrentRoom(socket.id);

    const normalizedRoomId = (roomId || '').trim().toUpperCase();
    const room = this.rooms.get(normalizedRoomId);

    if (!room) {
      return { success: false, reason: 'Room not found. Check the code.' };
    }

    const result = room.addPlayer(socket, playerName);
    if (result.success) {
      this.playerRoomMap.set(socket.id, normalizedRoomId);
    }
    return { roomId: normalizedRoomId, ...result };
  }

  /**
   * Auto-Matchmaking: Find an open room or create one
   */
  matchmake(socket, playerName) {
    this.leaveCurrentRoom(socket.id);

    // Look for any waiting room with available slots
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.status === 'WAITING' && room.players.size < room.maxPlayers) {
        const result = room.addPlayer(socket, playerName);
        if (result.success) {
          this.playerRoomMap.set(socket.id, roomId);
          return { roomId, success: true, player: result.player };
        }
      }
    }

    // No open room found, automatically create a new one
    return this.createRoom(socket, playerName);
  }

  /**
   * Disconnects/removes player from their current room
   */
  leaveCurrentRoom(socketId) {
    const roomId = this.playerRoomMap.get(socketId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.removePlayer(socketId);
      if (room.players.size === 0) {
        room.destroy();
        this.rooms.delete(roomId);
      }
    }

    this.playerRoomMap.delete(socketId);
  }

  /**
   * Gets room by socket ID
   */
  getRoomBySocket(socketId) {
    const roomId = this.playerRoomMap.get(socketId);
    return roomId ? this.rooms.get(roomId) : null;
  }

  /**
   * Lists active public rooms for lobby browser
   */
  listRooms() {
    const list = [];
    for (const [roomId, room] of this.rooms.entries()) {
      list.push({
        id: roomId,
        playerCount: room.players.size,
        maxPlayers: room.maxPlayers,
        status: room.status,
        totalLaps: room.totalLaps
      });
    }
    return list;
  }
}
