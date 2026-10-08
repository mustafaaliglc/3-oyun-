import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { RemotePlayer, ChatMessage } from '../types/game';

interface UseMultiplayerOptions {
  room: string;
  playerName: string;
  playerColor: string;
  vehicle: string;
  onBlockPlaced?: (data: { x: number; y: number; z: number; type: string; playerId: string }) => void;
  onBlockBroken?: (data: { x: number; y: number; z: number; playerId: string }) => void;
  onWorldSync?: (data: { blocks: Array<{ x: number; y: number; z: number; type: string }> }) => void;
  onPlayerPunched?: (data: { id: string }) => void;
  onPlayerJoined?: (player: RemotePlayer) => void;
}

export interface RoomStats {
  vice_city: number;
  age_of_history: number;
  kart_racing: number;
  totalOnline: number;
}

export function useMultiplayer({
  room,
  playerName,
  playerColor,
  vehicle,
  onBlockPlaced,
  onBlockBroken,
  onWorldSync,
  onPlayerPunched,
  onPlayerJoined,
}: UseMultiplayerOptions) {
  const [connected, setConnected] = useState<boolean>(false);
  const [ping, setPing] = useState<number>(14);
  const [transport, setTransport] = useState<string>('socket.io');
  const [playerId] = useState<string>(() => {
    return 'p_' + Math.random().toString(36).substring(2, 8);
  });
  const [players, setPlayers] = useState<Map<string, RemotePlayer>>(new Map());
  const playersRef = useRef<Map<string, RemotePlayer>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [roomStats, setRoomStats] = useState<RoomStats>({
    vice_city: 1,
    age_of_history: 1,
    kart_racing: 1,
    totalOnline: 3,
  });

  const socketRef = useRef<Socket | null>(null);

  const onBlockPlacedRef = useRef(onBlockPlaced);
  const onBlockBrokenRef = useRef(onBlockBroken);
  const onWorldSyncRef = useRef(onWorldSync);
  const onPlayerPunchedRef = useRef(onPlayerPunched);
  const onPlayerJoinedRef = useRef(onPlayerJoined);

  useEffect(() => {
    onBlockPlacedRef.current = onBlockPlaced;
    onBlockBrokenRef.current = onBlockBroken;
    onWorldSyncRef.current = onWorldSync;
    onPlayerPunchedRef.current = onPlayerPunched;
    onPlayerJoinedRef.current = onPlayerJoined;
  }, [onBlockPlaced, onBlockBroken, onWorldSync, onPlayerPunched, onPlayerJoined]);

  // Ambient bots simulation to ensure lively world only for single-player arcade demos
  const botsRef = useRef<RemotePlayer[]>([]);

  useEffect(() => {
    if (room === 'minecraft') {
      botsRef.current = [];
      return;
    }

    const botColors = ['#f43f5e', '#06b6d4', '#eab308', '#a855f7'];
    const botNames = ['Tommy_V', 'Lance_Vance', 'Ken_Rosenberg', 'Sonny_F'];
    const botVehicles = ['cheetah', 'infernus', 'banshee', 'cruiser'];

    const initialBots: RemotePlayer[] = botNames.map((name, i) => ({
      id: `bot_${i}`,
      name: `${name} [BOT]`,
      color: botColors[i % botColors.length],
      vehicle: botVehicles[i % botVehicles.length],
      x: (i - 1.5) * 25,
      y: 0,
      z: -40 + i * 30,
      rotation: Math.random() * Math.PI * 2,
      speed: 10 + Math.random() * 8,
      health: 100,
      score: 120 + i * 85,
      wantedLevel: i === 0 ? 2 : 0,
      lastSeen: Date.now(),
    }));
    botsRef.current = initialBots;
  }, [room]);

  useEffect(() => {
    // Connect to Socket.io server
    const socket: Socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setTransport(socket.io.engine.transport.name || 'websocket');

      // Send join room event
      socket.emit('join_room', {
        room,
        id: playerId,
        name: playerName,
        color: playerColor,
        vehicle,
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
      });
    });

    socket.io.engine?.on('upgrade', () => {
      setTransport(socket.io.engine.transport.name);
    });

    socket.on('init', (data: { players: RemotePlayer[]; id: string }) => {
      const map = new Map<string, RemotePlayer>();
      // Add ambient bots only if any
      botsRef.current.forEach((bot) => map.set(bot.id, bot));
      // Add real connected players from server
      (data.players || []).forEach((p: RemotePlayer) => {
        if (p.id !== playerId) {
          map.set(p.id, p);
        }
      });
      playersRef.current = map;
      setPlayers(new Map(map));
    });

    socket.on('player_joined', (data: { player: RemotePlayer }) => {
      if (data.player && data.player.id !== playerId) {
        playersRef.current.set(data.player.id, data.player);
        setPlayers(new Map(playersRef.current));
        onPlayerJoinedRef.current?.(data.player);
      }
    });

    socket.on('player_moved', (data: Partial<RemotePlayer> & { id: string }) => {
      if (data.id && data.id !== playerId) {
        const existing = playersRef.current.get(data.id);
        if (existing) {
          if (data.x !== undefined) existing.x = data.x;
          if (data.y !== undefined) existing.y = data.y;
          if (data.z !== undefined) existing.z = data.z;
          if (data.rotation !== undefined) existing.rotation = data.rotation;
          if (data.speed !== undefined) existing.speed = data.speed;
          if (data.health !== undefined) existing.health = data.health;
          if (data.score !== undefined) existing.score = data.score;
          if (data.wantedLevel !== undefined) existing.wantedLevel = data.wantedLevel;
          if (data.vehicle !== undefined) existing.vehicle = data.vehicle;
          existing.lastSeen = Date.now();
        } else {
          // New player not in map yet
          playersRef.current.set(data.id, {
            id: data.id,
            name: data.name || 'Oyuncu',
            color: data.color || '#ec4899',
            vehicle: data.vehicle || 'none',
            x: data.x || 0,
            y: data.y || 0,
            z: data.z || 0,
            rotation: data.rotation || 0,
            speed: data.speed || 0,
            health: data.health || 100,
            score: data.score || 0,
            wantedLevel: data.wantedLevel || 0,
            lastSeen: Date.now(),
          });
          setPlayers(new Map(playersRef.current));
        }
      }
    });

    socket.on('player_left', (data: { id: string }) => {
      playersRef.current.delete(data.id);
      setPlayers(new Map(playersRef.current));
    });

    // Minecraft specific socket events
    socket.on('mc_block_placed', (data: { x: number; y: number; z: number; type: string; playerId: string }) => {
      onBlockPlacedRef.current?.(data);
    });

    socket.on('mc_block_broken', (data: { x: number; y: number; z: number; playerId: string }) => {
      onBlockBrokenRef.current?.(data);
    });

    socket.on('mc_world_sync', (data: { blocks: Array<{ x: number; y: number; z: number; type: string }> }) => {
      onWorldSyncRef.current?.(data);
    });

    socket.on('mc_player_punched', (data: { id: string }) => {
      onPlayerPunchedRef.current?.(data);
    });

    socket.on('chat_message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev.slice(-30), msg]);
    });

    socket.on('room_stats', (stats: RoomStats) => {
      setRoomStats(stats);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Periodic ping measurement
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        const start = Date.now();
        socket.emit('ping_check', start, () => {
          const latency = Date.now() - start;
          setPing(latency);
        });
      }
    }, 4000);

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [playerId, playerName, playerColor, room, vehicle]);

  // Ambient bots movement loop
  useEffect(() => {
    const botInterval = window.setInterval(() => {
      setPlayers((prev) => {
        const next = new Map(prev);
        botsRef.current.forEach((bot) => {
          bot.rotation += (Math.random() - 0.5) * 0.08;
          bot.x += Math.sin(bot.rotation) * 0.6;
          bot.z += Math.cos(bot.rotation) * 0.6;
          if (bot.x > 180) bot.x = -180;
          if (bot.x < -180) bot.x = 180;
          if (bot.z > 180) bot.z = -180;
          if (bot.z < -180) bot.z = 180;
          next.set(bot.id, { ...bot });
        });
        return next;
      });
    }, 100);

    return () => clearInterval(botInterval);
  }, []);

  // Send player updates to Socket.io server
  const lastUpdateSendRef = useRef<number>(0);
  const sendUpdate = useCallback(
    (data: Partial<RemotePlayer> & { action?: string }) => {
      const now = performance.now();
      if (data.action || now - lastUpdateSendRef.current > 45) {
        lastUpdateSendRef.current = now;
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('player_update', data);
        }
      }
    },
    []
  );

  // Send chat messages
  const sendChat = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('chat_message', {
          text: clean,
          name: playerName,
          color: playerColor,
        });
      } else {
        // Fallback local echo
        setChatMessages((prev) => [
          ...prev.slice(-30),
          {
            id: 'local',
            name: playerName,
            color: playerColor,
            text: clean,
            timestamp: Date.now(),
          },
        ]);
      }
    },
    [playerColor, playerName]
  );

  // Send game actions (conquer, honk, shoot, turbo)
  const sendAction = useCallback(
    (actionType: string, payload?: unknown) => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('game_action', { actionType, payload });
      }
    },
    []
  );

  // Minecraft: Send block placed by local player
  const sendBlockPlace = useCallback((x: number, y: number, z: number, type: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('mc_block_place', { x, y, z, type });
    }
  }, []);

  // Minecraft: Send block broken by local player
  const sendBlockBreak = useCallback((x: number, y: number, z: number) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('mc_block_break', { x, y, z });
    }
  }, []);

  // Minecraft: Send player arm punch
  const sendPlayerPunch = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('mc_player_punch');
    }
  }, []);

  return {
    connected,
    ping,
    transport,
    playerId,
    players,
    playersRef,
    chatMessages,
    roomStats,
    sendUpdate,
    sendChat,
    sendAction,
    sendBlockPlace,
    sendBlockBreak,
    sendPlayerPunch,
  };
}
