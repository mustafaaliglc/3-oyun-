import { io, Socket } from 'socket.io-client';
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface NetworkPlayer {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  z: number;
  yaw?: number;
  pitch?: number;
  rotation?: number;
  isJumping?: boolean;
  selectedBlock?: string | null;
  lastSeen?: number;
  isPunching?: boolean;
}

export interface BlockEvent {
  x: number;
  y: number;
  z: number;
  type: string;
  playerId?: string;
  placedBy?: string;
  placedById?: string;
}

export class MinecraftMultiplayerManager {
  private socket: Socket | null = null;
  public roomId: string | null = null;
  public myPlayerId: string = '';
  public playerName: string = 'Steve';
  public isHost: boolean = false;
  private unsubscribePlayers: (() => void) | null = null;
  private unsubscribeBlocks: (() => void) | null = null;
  private lastFirestorePositionUpdate: number = 0;

  // Callbacks
  public onPlayerJoined?: (player: NetworkPlayer) => void;
  public onPlayerMoved?: (player: NetworkPlayer) => void;
  public onPlayerLeft?: (id: string) => void;
  public onPlayerPunched?: (id: string) => void;
  public onPlayerHit?: (hit: { attackerId: string; targetId: string; damage: number; knockX: number; knockZ: number }) => void;
  public onBlockPlaced?: (event: BlockEvent) => void;
  public onBlockBroken?: (event: BlockEvent) => void;
  public onInitialWorldBlocks?: (blocks: BlockEvent[]) => void;
  public onChatMessage?: (msg: { id: string; name: string; color: string; text: string; timestamp: number }) => void;

  constructor() {
    this.myPlayerId = 'p_' + Math.random().toString(36).substring(2, 9);
  }

  // Generate unique room code like MC-7294
  public static generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'MC-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // 1. Host Game: Create a new room in Firebase Firestore & Connect
  public async hostGame(roomId: string, hostName: string, initialSpawn: { x: number; y: number; z: number }): Promise<void> {
    this.roomId = roomId.toUpperCase().trim();
    this.playerName = hostName.trim() || 'Steve_Host';
    this.isHost = true;

    const roomPath = `rooms/${this.roomId}`;
    try {
      await setDoc(doc(db, 'rooms', this.roomId), {
        roomId: this.roomId,
        hostName: this.playerName,
        gameType: 'minecraft',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastActive: Date.now(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, roomPath);
    }

    await this.initNetwork(initialSpawn);
  }

  // 2. Join Game: Validate and Connect to existing room
  public async joinGame(roomId: string, playerName: string, initialSpawn: { x: number; y: number; z: number }): Promise<boolean> {
    const cleanId = roomId.toUpperCase().trim();
    const roomPath = `rooms/${cleanId}`;

    let roomSnap;
    try {
      roomSnap = await getDoc(doc(db, 'rooms', cleanId));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, roomPath);
    }

    if (!roomSnap || !roomSnap.exists()) {
      return false;
    }

    const roomData = roomSnap.data();
    if (roomData.status !== 'active') {
      return false;
    }

    this.roomId = cleanId;
    this.playerName = playerName.trim() || 'Steve_Guest';
    this.isHost = false;

    await this.initNetwork(initialSpawn);
    return true;
  }

  // 3. Initialize Dual Network Layer (Socket.io + Firebase Realtime Snapshot)
  private async initNetwork(spawn: { x: number; y: number; z: number }): Promise<void> {
    if (!this.roomId) return;
    const socketRoom = `room_${this.roomId}`;

    // Establish Socket.io connection for ultra fast ~20-30Hz real-time sync
    try {
      this.socket = io({
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        this.socket?.emit('join_room', {
          room: socketRoom,
          id: this.myPlayerId,
          name: this.playerName,
          color: '#10b981',
          x: spawn.x,
          y: spawn.y,
          z: spawn.z,
          yaw: 0,
          pitch: 0,
        });
      });

      this.socket.on('init', (data: { players: NetworkPlayer[] }) => {
        if (data.players && Array.isArray(data.players)) {
          data.players.forEach((p) => {
            if (p.id !== this.myPlayerId && this.onPlayerJoined) {
              this.onPlayerJoined(p);
            }
          });
        }
      });

      this.socket.on('mc_world_sync', (data: { blocks: BlockEvent[] }) => {
        if (data && data.blocks && this.onInitialWorldBlocks) {
          this.onInitialWorldBlocks(data.blocks);
        }
      });

      this.socket.on('player_joined', (data: { player: NetworkPlayer }) => {
        if (data && data.player && data.player.id !== this.myPlayerId && this.onPlayerJoined) {
          this.onPlayerJoined(data.player);
        }
      });

      this.socket.on('player_moved', (data: NetworkPlayer) => {
        if (data && data.id !== this.myPlayerId && this.onPlayerMoved) {
          this.onPlayerMoved(data);
        }
      });

      this.socket.on('oyuncuHareketi', (data: NetworkPlayer) => {
        if (data && data.id !== this.myPlayerId && this.onPlayerMoved) {
          this.onPlayerMoved(data);
        }
      });

      this.socket.on('player_left', (data: { id: string }) => {
        if (data && data.id && this.onPlayerLeft) {
          this.onPlayerLeft(data.id);
        }
      });

      this.socket.on('mc_block_placed', (data: BlockEvent) => {
        if (data && this.onBlockPlaced) {
          this.onBlockPlaced(data);
        }
      });

      this.socket.on('mc_block_broken', (data: BlockEvent) => {
        if (data && this.onBlockBroken) {
          this.onBlockBroken(data);
        }
      });

      this.socket.on('blokDegisti', (data: BlockEvent & { action?: string }) => {
        if (!data || data.playerId === this.myPlayerId) return;
        if (data.type === 'air' || data.action === 'break') {
          this.onBlockBroken?.(data);
        } else {
          this.onBlockPlaced?.(data);
        }
      });

      this.socket.on('mc_player_punched', (data: { id: string }) => {
        if (data && data.id && data.id !== this.myPlayerId && this.onPlayerPunched) {
          this.onPlayerPunched(data.id);
        }
      });

      this.socket.on('playerHit', (data: { attackerId: string; targetId: string; damage: number; knockX: number; knockZ: number }) => {
        if (data && this.onPlayerHit) {
          this.onPlayerHit(data);
        }
      });

      this.socket.on('chat_message', (msg) => {
        if (msg && this.onChatMessage) {
          this.onChatMessage(msg);
        }
      });
    } catch (e) {
      console.warn('Socket.io connection initialization notice:', e);
    }

    // Also register player in Firestore for persistence & multi-device sync
    const playerDocPath = `rooms/${this.roomId}/players/${this.myPlayerId}`;
    try {
      await setDoc(doc(db, 'rooms', this.roomId, 'players', this.myPlayerId), {
        id: this.myPlayerId,
        name: this.playerName,
        x: spawn.x,
        y: spawn.y,
        z: spawn.z,
        yaw: 0,
        pitch: 0,
        isJumping: false,
        selectedBlock: null,
        color: '#10b981',
        lastSeen: Date.now(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, playerDocPath);
    }

    // Load existing modified blocks from Firestore if joining an ongoing game
    try {
      const blocksCol = collection(db, 'rooms', this.roomId, 'blocks');
      const snap = await getDocs(blocksCol);
      const blocks: BlockEvent[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        blocks.push({
          x: d.x,
          y: d.y,
          z: d.z,
          type: d.type,
          placedBy: d.placedBy,
        });
      });
      if (blocks.length > 0 && this.onInitialWorldBlocks) {
        this.onInitialWorldBlocks(blocks);
      }
    } catch (err) {
      console.warn('Initial blocks fetch notice:', err);
    }

    // Subscribe to Firestore player changes (handles any client using pure Firestore or recovering)
    try {
      const playersCol = collection(db, 'rooms', this.roomId, 'players');
      this.unsubscribePlayers = onSnapshot(playersCol, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const p = change.doc.data() as NetworkPlayer;
          if (p.id === this.myPlayerId) return;

          if (change.type === 'added') {
            this.onPlayerJoined?.(p);
          } else if (change.type === 'modified') {
            this.onPlayerMoved?.(p);
          } else if (change.type === 'removed') {
            this.onPlayerLeft?.(p.id);
          }
        });
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `rooms/${this.roomId}/players`);
      });
    } catch (err) {
      console.warn('Players snapshot subscription error:', err);
    }

    // Subscribe to Firestore blocks changes
    try {
      const blocksCol = collection(db, 'rooms', this.roomId, 'blocks');
      this.unsubscribeBlocks = onSnapshot(blocksCol, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const b = change.doc.data() as BlockEvent;
          if (b.playerId === this.myPlayerId || b.placedById === this.myPlayerId) return; // Ignore own echoes safely
          if (b.type === 'air') {
            this.onBlockBroken?.(b);
          } else {
            this.onBlockPlaced?.(b);
          }
        });
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `rooms/${this.roomId}/blocks`);
      });
    } catch (err) {
      console.warn('Blocks snapshot subscription error:', err);
    }
  }

  // 4. Send Player Coordinates (sends ~20-30 times/sec over Socket.io, throttled to Firestore)
  public sendPlayerPosition(x: number, y: number, z: number, yaw: number, pitch: number, isJumping: boolean, selectedBlock: string | null): void {
    if (!this.roomId) return;

    // Fast path: Socket.io broadcast to all peers in the room
    if (this.socket?.connected) {
      const payload = {
        id: this.myPlayerId,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        z: Math.round(z * 100) / 100,
        yaw: Math.round(yaw * 100) / 100,
        pitch: Math.round(pitch * 100) / 100,
        isJumping,
        selectedBlock,
      };
      this.socket.emit('player_update', payload);
      this.socket.emit('oyuncuHareketi', payload);
    }

    // Throttled Firestore update every 2.5 seconds to conserve quota while maintaining state
    const now = Date.now();
    if (now - this.lastFirestorePositionUpdate > 2500) {
      this.lastFirestorePositionUpdate = now;
      const playerPath = `rooms/${this.roomId}/players/${this.myPlayerId}`;
      setDoc(doc(db, 'rooms', this.roomId, 'players', this.myPlayerId), {
        id: this.myPlayerId,
        name: this.playerName,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        z: Math.round(z * 100) / 100,
        yaw: Math.round(yaw * 100) / 100,
        pitch: Math.round(pitch * 100) / 100,
        isJumping,
        selectedBlock,
        color: '#10b981',
        lastSeen: now,
      }).catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, playerPath);
      });
    }
  }

  // 5. Send Block Placement (Instant Socket.io + Persistent Firestore)
  public async placeBlock(x: number, y: number, z: number, type: string): Promise<void> {
    if (!this.roomId) return;
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rz = Math.round(z);

    // 1. Instant Socket.io emission
    this.socket?.emit('mc_block_place', { x: rx, y: ry, z: rz, type, playerId: this.myPlayerId });
    this.socket?.emit('blokDegisti', { x: rx, y: ry, z: rz, type, action: 'place', playerId: this.myPlayerId });

    // 2. Persistent Firestore write
    const blockDocId = `${rx}_${ry}_${rz}`;
    const blockPath = `rooms/${this.roomId}/blocks/${blockDocId}`;
    try {
      await setDoc(doc(db, 'rooms', this.roomId, 'blocks', blockDocId), {
        x: rx,
        y: ry,
        z: rz,
        type,
        placedBy: this.playerName,
        placedById: this.myPlayerId,
        playerId: this.myPlayerId,
        timestamp: Date.now(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, blockPath);
    }
  }

  // 6. Send Block Break (Instant Socket.io + Persistent Firestore)
  public async breakBlock(x: number, y: number, z: number): Promise<void> {
    if (!this.roomId) return;
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rz = Math.round(z);

    // 1. Instant Socket.io emission
    this.socket?.emit('mc_block_break', { x: rx, y: ry, z: rz, playerId: this.myPlayerId });
    this.socket?.emit('blokDegisti', { x: rx, y: ry, z: rz, type: 'air', action: 'break', playerId: this.myPlayerId });

    // 2. Persistent Firestore write
    const blockDocId = `${rx}_${ry}_${rz}`;
    const blockPath = `rooms/${this.roomId}/blocks/${blockDocId}`;
    try {
      await setDoc(doc(db, 'rooms', this.roomId, 'blocks', blockDocId), {
        x: rx,
        y: ry,
        z: rz,
        type: 'air',
        placedBy: this.playerName,
        placedById: this.myPlayerId,
        playerId: this.myPlayerId,
        timestamp: Date.now(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, blockPath);
    }
  }

  // 7. Player Punch / Swing animation
  public sendPunch(): void {
    if (this.socket?.connected) {
      this.socket.emit('mc_player_punch');
    }
  }

  // 8. PVP Hit Player
  public sendHitPlayer(targetId: string, damage = 4, knockX = 0, knockZ = 0): void {
    if (this.socket?.connected) {
      this.socket.emit('playerHit', {
        targetId,
        damage,
        knockX,
        knockZ,
      });
    }
  }

  // 8. Chat Message
  public sendChat(text: string): void {
    if (this.socket?.connected && text.trim()) {
      this.socket.emit('chat_message', {
        text: text.trim().slice(0, 150),
        name: this.playerName,
        color: '#10b981',
      });
    }
  }

  // 9. Leave & Cleanup
  public async leaveRoom(): Promise<void> {
    if (!this.roomId) return;

    if (this.unsubscribePlayers) {
      this.unsubscribePlayers();
      this.unsubscribePlayers = null;
    }
    if (this.unsubscribeBlocks) {
      this.unsubscribeBlocks();
      this.unsubscribeBlocks = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    try {
      await deleteDoc(doc(db, 'rooms', this.roomId, 'players', this.myPlayerId));
    } catch {
      // ignore on disconnect
    }

    this.roomId = null;
  }
}

export const multiplayerManager = new MinecraftMultiplayerManager();
