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
  socket.on('player_update', (data: Partial<PlayerState> & { action?: string }) => {
    if (!joinedRoom || !rooms[joinedRoom]) return;
    const room = rooms[joinedRoom];
    const player = room.players.get(assignedPlayerId);

    if (player) {
      if (data.x !== undefined) player.x = data.x;
      if (data.y !== undefined) player.y = data.y;
      if (data.z !== undefined) player.z = data.z;
      if (data.rotation !== undefined) player.rotation = data.rotation;
      if (data.speed !== undefined) player.speed = data.speed;
      if (data.health !== undefined) player.health = data.health;
      if (data.score !== undefined) player.score = data.score;
      if (data.wantedLevel !== undefined) player.wantedLevel = data.wantedLevel;
      if (data.vehicle !== undefined) player.vehicle = data.vehicle;
      player.lastSeen = Date.now();

      socket.to(joinedRoom).emit('player_moved', {
        id: assignedPlayerId,
        x: player.x,
        y: player.y,
        z: player.z,
        rotation: player.rotation,
        speed: player.speed,
        health: player.health,
        score: player.score,
        wantedLevel: player.wantedLevel,
        vehicle: player.vehicle,
        action: data.action,
        timestamp: player.lastSeen,
      });
    }
  });

  // 3. Minecraft Real-time Block Placement
  socket.on('mc_block_place', (data: { x: number; y: number; z: number; type: string }) => {
    if (joinedRoom !== 'minecraft') return;
    const rx = Math.round(data.x);
    const ry = Math.round(data.y);
    const rz = Math.round(data.z);
    const key = `${rx},${ry},${rz}`;
    minecraftWorldBlocks.set(key, data.type);

    socket.to('minecraft').emit('mc_block_placed', {
      x: rx,
      y: ry,
      z: rz,
      type: data.type,
      playerId: assignedPlayerId,
    });
  });

  // 4. Minecraft Real-time Block Destruction / Mining
  socket.on('mc_block_break', (data: { x: number; y: number; z: number }) => {
    if (joinedRoom !== 'minecraft') return;
    const rx = Math.round(data.x);
    const ry = Math.round(data.y);
    const rz = Math.round(data.z);
    const key = `${rx},${ry},${rz}`;
    minecraftWorldBlocks.set(key, 'air');

    socket.to('minecraft').emit('mc_block_broken', {
      x: rx,
      y: ry,
      z: rz,
      playerId: assignedPlayerId,
    });
  });

  // 5. Minecraft Real-time Player Punch / Arm Swing
  socket.on('mc_player_punch', () => {
    if (joinedRoom !== 'minecraft') return;
    socket.to('minecraft').emit('mc_player_punched', {
      id: assignedPlayerId,
    });
  });

  // 6. Chat Messages
  socket.on('chat_message', (data: { text: string; name?: string; color?: string }) => {
    if (!joinedRoom || !rooms[joinedRoom]) return;
    const player = rooms[joinedRoom].players.get(assignedPlayerId);
    const message = {
      id: assignedPlayerId,
      name: player?.name || data.name || 'Oyuncu',
      color: player?.color || data.color || '#ec4899',
      text: String(data.text || '').slice(0, 150),
      timestamp: Date.now(),
    };
    io.to(joinedRoom).emit('chat_message', message);
  });

  // 4. In-Game Actions (Horn, Turbo, Attack, Territory Conquer)
  socket.on('game_action', (data: { actionType: string; payload: unknown }) => {
    if (!joinedRoom || !rooms[joinedRoom]) return;
    socket.to(joinedRoom).emit('game_action', {
      id: assignedPlayerId,
      actionType: data.actionType,
      payload: data.payload,
      timestamp: Date.now(),
    });
  });

  // 5. Ping / Pong Latency Check
  socket.on('ping_check', (clientTimestamp: number, callback: (ack: { clientTimestamp: number; serverTimestamp: number }) => void) => {
    if (typeof callback === 'function') {
      callback({
        clientTimestamp,
        serverTimestamp: Date.now(),
      });
    }
  });

  // 6. Disconnect
  socket.on('disconnect', () => {
    if (joinedRoom && rooms[joinedRoom] && assignedPlayerId) {
      rooms[joinedRoom].players.delete(assignedPlayerId);
      socket.to(joinedRoom).emit('player_left', { id: assignedPlayerId });
      io.emit('room_stats', getRoomStats());
    }
  });
});

// ==========================================
// 🔌 LEGACY WEBSOCKET HANDLER (PATH /ws)
// ==========================================
wss.on('connection', (ws: WebSocket) => {
  let playerId = '';
  let currentRoom = '';

  ws.on('message', (messageRaw: string) => {
    try {
      const data = JSON.parse(messageRaw.toString());

      if (data.type === 'join') {
        currentRoom = data.room || 'vice_city';
        playerId = data.id || `ws_${Math.random().toString(36).substring(2, 9)}`;

        if (!rooms[currentRoom]) {
          rooms[currentRoom] = { players: new Map(), wsClients: new Map() };
        }

        const room = rooms[currentRoom];
        room.wsClients.set(playerId, ws);

        const newPlayer: PlayerState = {
          id: playerId,
          name: data.name || 'Oyuncu',
          color: data.color || '#ec4899',
          vehicle: data.vehicle || 'infernus',
          x: data.x || 0,
          y: data.y || 0,
          z: data.z || 0,
          rotation: data.rotation || 0,
          speed: 0,
          health: 100,
          score: 0,
          wantedLevel: 0,
          lastSeen: Date.now(),
        };

        room.players.set(playerId, newPlayer);

        ws.send(
          JSON.stringify({
            type: 'init',
            id: playerId,
            players: Array.from(room.players.values()),
          })
        );

        const joinMsg = JSON.stringify({ type: 'player_joined', player: newPlayer });
        room.wsClients.forEach((client, id) => {
          if (id !== playerId && client.readyState === WebSocket.OPEN) {
            client.send(joinMsg);
          }
        });
      } else if (data.type === 'update') {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        const player = room.players.get(playerId);

        if (player) {
          player.x = data.x ?? player.x;
          player.y = data.y ?? player.y;
          player.z = data.z ?? player.z;
          player.rotation = data.rotation ?? player.rotation;
          player.speed = data.speed ?? player.speed;
          player.health = data.health ?? player.health;
          player.score = data.score ?? player.score;
          player.wantedLevel = data.wantedLevel ?? player.wantedLevel;
          player.lastSeen = Date.now();

          const updateMsg = JSON.stringify({
            type: 'player_moved',
            id: playerId,
            x: player.x,
            y: player.y,
            z: player.z,
            rotation: player.rotation,
            speed: player.speed,
            health: player.health,
            score: player.score,
            wantedLevel: player.wantedLevel,
            action: data.action,
          });

          room.wsClients.forEach((client, id) => {
            if (id !== playerId && client.readyState === WebSocket.OPEN) {
              client.send(updateMsg);
            }
          });
        }
      } else if (data.type === 'chat') {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        const player = room.players.get(playerId);
        const chatMsg = JSON.stringify({
          type: 'chat',
          id: playerId,
          name: player?.name || 'Oyuncu',
          color: player?.color || '#ec4899',
          text: data.text,
          timestamp: Date.now(),
        });
        room.wsClients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(chatMsg);
          }
        });
      }
    } catch {
      // ignore
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms[currentRoom] && playerId) {
      const room = rooms[currentRoom];
      room.players.delete(playerId);
      room.wsClients.delete(playerId);

      const leaveMsg = JSON.stringify({ type: 'player_left', id: playerId });
      room.wsClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(leaveMsg);
        }
      });
    }
  });
});

// Mount Vite or serve static files
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const PORT = process.env.PORT || 3000;

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT} with Socket.io & WebSocket support`);
  });
}

startServer();
