import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { leaderboardDb } from './src/server/leaderboardStore';

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  vehicle: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  speed: number;
  health: number;
  score: number;
  wantedLevel: number;
  lastSeen: number;
  socketId?: string;
}

interface RoomData {
  players: Map<string, PlayerState>;
  wsClients: Map<string, WebSocket>;
}

const app = express();
const server = createServer(app);

// Socket.io Server Setup
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 25000,
  pingInterval: 10000,
});

// Legacy raw WebSocket server on path /ws to avoid conflict with Socket.io
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms: Record<string, RoomData> = {
  vice_city: { players: new Map(), wsClients: new Map() },
  valorant: { players: new Map(), wsClients: new Map() },
  minecraft: { players: new Map(), wsClients: new Map() },
  age_of_history: { players: new Map(), wsClients: new Map() },
  kart_racing: { players: new Map(), wsClients: new Map() },
};

// In-Memory Shared Minecraft Voxel World State
const minecraftWorldBlocks = new Map<string, string>();

app.use(express.json());

function getRoomStats() {
  return {
    vice_city: rooms.vice_city?.players.size || 0,
    valorant: rooms.valorant?.players.size || 0,
    minecraft: rooms.minecraft?.players.size || 0,
    totalOnline:
      (rooms.vice_city?.players.size || 0) +
      (rooms.valorant?.players.size || 0) +
      (rooms.minecraft?.players.size || 0),
  };
}

// API Health & Stats
app.get('/api/stats', (req, res) => {
  res.json(getRoomStats());
});

// Socket.io Info Endpoint
app.get('/api/socket-info', (req, res) => {
  res.json({
    engine: 'Socket.io',
    version: '4.8.1',
    status: 'online',
    activeRooms: Object.keys(rooms),
    stats: getRoomStats(),
    timestamp: Date.now(),
  });
});

// Global Leaderboard API
app.get('/api/leaderboard', (req, res) => {
  const gameFilter = req.query.game as string | undefined;
  const top10 = leaderboardDb.getTop10(gameFilter);
  res.json({
    success: true,
    filter: gameFilter || 'all',
    top10,
    count: top10.length,
  });
});

app.post('/api/leaderboard', (req, res) => {
  try {
    const { playerName, gameId, gameTitle, score, badge, nationOrVehicle, avatarColor, country } = req.body;
    if (!playerName || !gameId || typeof score !== 'number') {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const saved = leaderboardDb.addScore({
      playerName: String(playerName).trim().slice(0, 20),
      gameId: gameId,
      gameTitle: gameTitle || 'Oyun',
      score: Math.max(0, Math.floor(score)),
      badge: badge || 'Oyuncu',
      nationOrVehicle: nationOrVehicle || '',
      avatarColor: avatarColor || '#ec4899',
      country: country || 'TR',
    });

    res.json({ success: true, entry: saved });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to save score' });
  }
});

// ==========================================
// 🚀 SOCKET.IO SERVER IMPLEMENTATION
// ==========================================
io.on('connection', (socket: Socket) => {
  let joinedRoom = '';
  let assignedPlayerId = '';

  // 1. Join Room
  socket.on('join_room', (data: {
    room: string;
    id?: string;
    name?: string;
    color?: string;
    vehicle?: string;
    x?: number;
    y?: number;
    z?: number;
    rotation?: number;
  }) => {
    const roomName = data.room || 'vice_city';
    const playerId = data.id || `p_${socket.id.substring(0, 8)}`;
    joinedRoom = roomName;
    assignedPlayerId = playerId;

    socket.join(roomName);

    if (!rooms[roomName]) {
      rooms[roomName] = { players: new Map(), wsClients: new Map() };
    }

    const player: PlayerState = {
      id: playerId,
      name: data.name || 'Oyuncu',
      color: data.color || '#ec4899',
      vehicle: data.vehicle || 'cheetah',
      x: data.x || 0,
      y: data.y || 0,
      z: data.z || 0,
      rotation: data.rotation || 0,
      speed: 0,
      health: 100,
      score: 0,
      wantedLevel: 0,
      lastSeen: Date.now(),
      socketId: socket.id,
    };

    rooms[roomName].players.set(playerId, player);

    // Send init packet with existing players
    socket.emit('init', {
      id: playerId,
      room: roomName,
      players: Array.from(rooms[roomName].players.values()),
      serverTime: Date.now(),
      engine: 'Socket.io Server',
    });

    // If joining Minecraft room, also send the current synchronized world blocks
    if (roomName === 'minecraft') {
      const blockEntries = Array.from(minecraftWorldBlocks.entries()).map(([k, type]) => {
        const [x, y, z] = k.split(',').map(Number);
        return { x, y, z, type };
      });
      socket.emit('mc_world_sync', { blocks: blockEntries });
    }

    // Broadcast to others in the room
    socket.to(roomName).emit('player_joined', { player });

    // Broadcast updated global stats
    io.emit('room_stats', getRoomStats());
  });

  // 2. Real-time Player Movement / State Update
  socket.on('player_update', (data:
