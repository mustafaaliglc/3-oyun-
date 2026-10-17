/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../utils/audio';
import { GameInfo, GameSettings } from '../../types/game';
import { GameMenuModal } from '../GameMenuModal';
import { SettingsPanel } from '../SettingsPanel';
import { 
  Box,
  Pickaxe,
  Hammer,
  Eye,
  Award,
  Sparkles,
  Sun,
  Moon,
  Flame,
  Maximize,
  Minimize,
  MousePointer,
  Users,
  Copy,
  Check,
  Radio,
  MessageSquare,
  Send,
  Globe,
  Share2,
  Play,
  Plus,
} from 'lucide-react';
import {
  multiplayerManager,
  MinecraftMultiplayerManager,
  NetworkPlayer,
  BlockEvent,
} from '../../services/minecraftMultiplayer';
import { ChunkManager, VoxelRaycaster, BlockId, TextureAtlas } from '../../voxel';

// Zero-GC pre-allocated math objects for render loop
const _raycaster = new THREE.Raycaster();
const _screenCenter = new THREE.Vector2(0, 0);

interface MinecraftGameProps {
  game: GameInfo;
  highScore: number;
  onUpdateHighScore: (score: number) => void;
}

export type BlockType =
  | 'grass'
  | 'stone'
  | 'dirt'
  | 'wood'
  | 'birch'
  | 'leaves'
  | 'diamond'
  | 'glass'
  | 'brick'
  | 'tnt'
  | 'beef';

interface BlockDef {
  id: BlockType;
  name: string;
  color: string;
  topColor?: string;
  transparent?: boolean;
  opacity?: number;
  scoreVal: number;
}

const BLOCK_DEFS: Record<BlockType, BlockDef> = {
  grass: { id: 'grass', name: 'Çimenli Toprak', color: '#78350f', topColor: '#22c55e', scoreVal: 10 },
  stone: { id: 'stone', name: 'Kırıktaş', color: '#64748b', scoreVal: 15 },
  dirt: { id: 'dirt', name: 'Toprak', color: '#7c2d12', scoreVal: 10 },
  wood: { id: 'wood', name: 'Meşe Odunu', color: '#854d0e', scoreVal: 20 },
  birch: { id: 'birch', name: 'Huş Odunu', color: '#f3f4f6', scoreVal: 20 },
  leaves: { id: 'leaves', name: 'Yaprak', color: '#15803d', scoreVal: 10 },
  diamond: { id: 'diamond', name: 'Elmas', color: '#06b6d4', scoreVal: 150 },
  glass: { id: 'glass', name: 'Cam', color: '#bae6fd', transparent: true, opacity: 0.55, scoreVal: 25 },
  brick: { id: 'brick', name: 'Tuğla', color: '#b91c1c', scoreVal: 30 },
  tnt: { id: 'tnt', name: 'TNT', color: '#ef4444', scoreVal: 50 },
  beef: { id: 'beef', name: 'Çiğ Sığır Eti', color: '#f43f5e', scoreVal: 20 },
};

const INITIAL_HOTBAR: (BlockType | null)[] = [null, null, null, null, null, null, null, null];

const MinecraftHeart: React.FC<{ fill: 'full' | 'half' | 'empty' }> = ({ fill }) => {
  const fillColor = fill === 'empty' ? '#1e293b' : '#E11D48';
  return (
    <svg className="w-3.5 h-3.5 drop-shadow shrink-0 animate-pulse" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 0H3V1H4V2H5V1H6V0H8V1H9V4H8V5H7V6H6V7H5V8H4V7H3V6H2V5H1V4H0V1H1V0Z" fill="#000000" />
      {fill === 'half' ? (
        <>
          <path d="M1 1H3V2H4V3H5V6H4V6H3V5H2V4H1V1Z" fill="#E11D48" />
          <path d="M2 4H3V5H4V6H5V6V4H2Z" fill="#9F1239" />
          <path d="M5 2H6V1H8V4H7V5H6V6H5V2Z" fill="#1E293B" />
        </>
      ) : (
        <path d="M1 1H3V2H4V3H5V2H6V1H8V4H7V5H6V6H5V7H4V6H3V5H2V4H1V1Z" fill={fillColor} />
      )}
      {fill === 'full' && (
        <>
          <rect x="2" y="1" width="1" height="1" fill="#FFFFFF" />
          <rect x="1" y="2" width="1" height="1" fill="#FFFFFF" />
        </>
      )}
    </svg>
  );
};

const MinecraftHunger: React.FC<{ fill: 'full' | 'half' | 'empty' }> = ({ fill }) => {
  const fillColor = fill === 'empty' ? '#1e293b' : '#B45309';
  return (
    <svg className="w-3.5 h-3.5 drop-shadow shrink-0" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 0H5V1H6V2H7V3H8V5H7V6H6V7H5V8H4V9H3V7H2V6H1V5H0V3H1V2H2V1H3V0Z" fill="#000000" />
      {fill === 'half' ? (
        <>
          <path d="M3 1H5V2H6V3H5V7H4V8H3V7H2V6H1V5H2V3H3V1Z" fill="#B45309" />
          <path d="M3 6H4V7H5V6H5V4H3V6Z" fill="#78350F" />
          <path d="M5 3H7V5H6V6H5V3Z" fill="#1E293B" />
        </>
      ) : (
        <path d="M3 1H5V2H6V3H7V5H6V6H5V7H4V8H3V7H2V6H1V5H2V3H3V1Z" fill={fillColor} />
      )}
      {fill !== 'empty' && <path d="M1 5H2V6H1V5ZM0 6H1V7H0V6Z" fill="#E2E8F0" />}
    </svg>
  );
};

// True 16x16 pixel art texture generator with nearest filter settings
const generateMinecraftTexture = (type: BlockType, face?: 'top' | 'side' | 'bottom') => {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const setPixel = (x: number, y: number, r: number, g: number, b: number, a: number = 255) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    data[idx] = Math.min(255, Math.max(0, r));
    data[idx + 1] = Math.min(255, Math.max(0, g));
    data[idx + 2] = Math.min(255, Math.max(0, b));
    data[idx + 3] = Math.min(255, Math.max(0, a));
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rFactor = (Math.sin(x * 12.3) * Math.cos(y * 7.7) * 8) + (Math.random() * 6);
      if (type === 'stone') {
        const isBorder = (y === 0 || y === 8 || x === 0 || x === 8 || (y < 8 && x === 4) || (y >= 8 && x === 12));
        if (isBorder) setPixel(x, y, 70 + rFactor, 70 + rFactor, 70 + rFactor);
        else setPixel(x, y, 120 + rFactor, 120 + rFactor, 120 + rFactor);
      } else if (type === 'grass') {
        if (face === 'top') {
          setPixel(x, y, 76 + rFactor, 180 + rFactor * 0.8, 55 + rFactor * 0.5);
        } else if (face === 'bottom') {
          setPixel(x, y, 98 + rFactor, 66 + rFactor, 43 + rFactor);
        } else {
          if (y < 4 || (y === 4 && x % 2 === 0)) {
            setPixel(x, y, 76 + rFactor, 180 + rFactor * 0.8, 55 + rFactor * 0.5);
          } else {
            setPixel(x, y, 98 + rFactor, 66 + rFactor, 43 + rFactor);
          }
        }
      } else if (type === 'dirt') {
        setPixel(x, y, 98 + rFactor, 66 + rFactor, 43 + rFactor);
      } else if (type === 'wood') {
        if (face === 'top' || face === 'bottom') {
          const dx = x - 7.5; const dy = y - 7.5;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (Math.floor(dist) % 2 === 0) setPixel(x, y, 192, 154, 114);
          else setPixel(x, y, 142, 102, 64);
        } else {
          if (x === 3 || x === 11) setPixel(x, y, 62, 42, 28);
          else setPixel(x, y, 103 + rFactor, 76 + rFactor, 48 + rFactor);
        }
      } else if (type === 'birch') {
        if (face === 'top' || face === 'bottom') {
          setPixel(x, y, 225, 210, 185);
        } else {
          if (y === 3 && x > 2 && x < 6) setPixel(x, y, 36, 36, 36);
          else setPixel(x, y, 226 + rFactor, 222 + rFactor, 206 + rFactor);
        }
      } else if (type === 'diamond') {
        const isGlow = (x === 3 && y === 3) || (x === 11 && y === 10);
        if (isGlow) setPixel(x, y, 255, 255, 255);
        else setPixel(x, y, 34 + rFactor, 197 + rFactor, 218 + rFactor);
      } else if (type === 'glass') {
        const isBorder = (x === 0 || y === 0 || x === 15 || y === 15);
        if (isBorder) setPixel(x, y, 186, 230, 253, 200);
        else setPixel(x, y, 224, 242, 254, 30);
      } else if (type === 'brick') {
        const isMortar = (y % 4 === 0);
        if (isMortar) setPixel(x, y, 212, 212, 212);
        else setPixel(x, y, 172 + rFactor, 52 + rFactor, 42 + rFactor);
      } else if (type === 'tnt') {
        const isStripe = (y >= 6 && y <= 9);
        if (isStripe) setPixel(x, y, 240, 240, 240);
        else setPixel(x, y, 220 + rFactor, 40, 40);
      } else if (type === 'beef') {
        const isMeat = (x > 2 && x < 13 && y > 2 && y < 13);
        if (isMeat) setPixel(x, y, 230 + rFactor, 60, 70);
        else setPixel(x, y, 0, 0, 0, 0);
      } else {
        const isHole = Math.random() < 0.15;
        if (isHole) setPixel(x, y, 16, 90, 24, 60);
        else setPixel(x, y, 34, 139, 34);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

const MinecraftBlockIcon: React.FC<{ type: BlockType; size?: number }> = ({ type, size = 24 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);
    const topCanvas = generateMinecraftTexture(type, 'top').image as HTMLCanvasElement;
    const sideCanvas = generateMinecraftTexture(type, 'side').image as HTMLCanvasElement;
    if (!topCanvas || !sideCanvas) return;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sideCanvas, 0, 0, size, size);
  }, [type, size]);

  return (
    <canvas 
      ref={canvasRef} 
      width={size} 
      height={size} 
      style={{ imageRendering: 'pixelated' }}
      className="shrink-0 select-none pointer-events-none" 
    />
  );
};

export const MinecraftGame3D: React.FC<MinecraftGameProps> = ({
  game,
  highScore,
  onUpdateHighScore,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [hotbarSlots, setHotbarSlots] = useState<(BlockType | null)[]>(INITIAL_HOTBAR);
  const hotbarSlotsRef = useRef<(BlockType | null)[]>(INITIAL_HOTBAR);

  useEffect(() => {
    hotbarSlotsRef.current = hotbarSlots;
  }, [hotbarSlots]);

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>('Steve_Builder');
  const [selectedBlock, setSelectedBlock] = useState<BlockType | null>('grass');
  const selectedBlockRef = useRef<BlockType | null>(selectedBlock);

  useEffect(() => {
    selectedBlockRef.current = selectedBlock;
  }, [selectedBlock]);

  const [health, setHealth] = useState<number>(20);
  const [hunger, setHunger] = useState<number>(20);

  const inventoryRef = useRef<Record<BlockType, number>>({
    grass: 10, stone: 10, dirt: 10, wood: 10, birch: 10, leaves: 10, diamond: 5, glass: 10, brick: 10, tnt: 5, beef: 5
  });
  const [inventory, setInventory] = useState<Record<BlockType, number>>(inventoryRef.current);
  const [showCrafting, setShowCrafting] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [blocksMined, setBlocksMined] = useState<number>(0);
  const [blocksPlaced, setBlocksPlaced] = useState<number>(0);

  // Multiplayer & Chat States
  const [roomMode, setRoomMode] = useState<'menu' | 'host' | 'join'>('menu');
  const [roomId, setRoomId] = useState<string>('');
  const [generatedRoomCode, setGeneratedRoomCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectedPlayers, setConnectedPlayers] = useState<NetworkPlayer[]>([]);
  const [isMultiplayerActive, setIsMultiplayerActive] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; name: string; color: string; text: string; timestamp: number }>>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const chunkManagerRef = useRef<ChunkManager | null>(null);
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 20, 0));
  const playerVelocityRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef<boolean>(false);

  const keysPressedRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressedRef.current[e.code] = true;
      if (e.key === 'Escape') {
        setIsPaused(prev => !prev);
      }
      if (e.key === 'e' || e.key === 'E') {
        setShowCrafting(prev => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main Three.js Initialization & Render Loop with Raycaster Block Breaking
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);

    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    const chunkManager = new ChunkManager(scene);
    chunkManagerRef.current = chunkManager;

    let yaw = 0;
    let pitch = 0;
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== container) return;
      const sensitivity = 0.002;
      yaw -= e.movementX * sensitivity;
      pitch -= e.movementY * sensitivity;
      pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    };

    const handleCanvasClick = () => {
      if (document.pointerLockElement !== container) {
        container.requestPointerLock();
        setGameStarted(true);
      }
    };

    container.addEventListener('click', handleCanvasClick);
    document.addEventListener('mousemove', handleMouseMove);

    // Mouse Down - Safe Raycaster Breaking & Placing Blocks
    const handleMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== container || isPaused) return;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(_screenCenter, camera);

      const intersects: THREE.Intersection[] = [];
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh && obj !== camera) {
          const hits = raycaster.intersectObject(obj, false);
          if (hits.length > 0) intersects.push(...hits);
        }
      });

      intersects.sort((a, b) => a.distance - b.distance);

      if (intersects.length > 0) {
        const hit = intersects[0];
        if (hit.distance < 6 && hit.point && hit.face) {
          if (e.button === 0) {
            // LEFT CLICK: Break Block
            const position = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(-0.5));
            const wx = Math.floor(position.x);
            const wy = Math.floor(position.y);
            const wz = Math.floor(position.z);

            if (chunkManager) {
              const blockName = chunkManager.getBlockName(wx, wy, wz);
              if (blockName && blockName !== 'air') {
                chunkManager.setBlock(wx, wy, wz, 'air');
                sound.playExplosion();
                setBlocksMined(p => p + 1);
                setScore(s => s + 15);
              }
            }
          } else if (e.button === 2 && selectedBlockRef.current) {
            // RIGHT CLICK: Place Block
            const position = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(0.5));
            const wx = Math.floor(position.x);
            const wy = Math.floor(position.y);
            const wz = Math.floor(position.z);

            if (chunkManager) {
              chunkManager.setBlock(wx, wy, wz, selectedBlockRef.current);
              sound.playBonus();
              setBlocksPlaced(p => p + 1);
            }
          }
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('contextmenu', handleContextMenu);

    let lastTime = performance.now();
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      const time = performance.now();
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      if (!isPaused && document.pointerLockElement === container) {
        const speed = 5.0 * delta;
        const keys = keysPressedRef.current;

        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const sideways = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

        const moveDir = new THREE.Vector3();
        if (keys['KeyW'] || keys['ArrowUp']) moveDir.add(forward);
        if (keys['KeyS'] || keys['ArrowDown']) moveDir.sub(forward);
        if (keys['KeyD'] || keys['ArrowRight']) moveDir.add(sideways);
        if (keys['KeyA'] || keys['ArrowLeft']) moveDir.sub(sideways);
        moveDir.normalize();

        playerPosRef.current.x += moveDir.x * speed;
        playerPosRef.current.z += moveDir.z * speed;

        playerVelocityRef.current.y -= 20 * delta;
        playerPosRef.current.y += playerVelocityRef.current.y * delta;

        if (keys['Space'] && isGroundedRef.current) {
          playerVelocityRef.current.y = 8.0;
          isGroundedRef.current = false;
        }

        if (playerPosRef.current.y < 2) {
          playerPosRef.current.y = 2;
          playerVelocityRef.current.y = 0;
          isGroundedRef.current = true;
        }

        camera.position.copy(playerPosRef.current);
        camera.rotation.set(0, 0, 0);
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;

        const pChunkX = Math.floor(playerPosRef.current.x / 16);
        const pChunkZ = Math.floor(playerPosRef.current.z / 16);
        chunkManager.updateChunks(pChunkX, pChunkZ);
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('click', handleCanvasClick);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
    };
  }, [isPaused]);

  const animationFrameIdRef = useRef<number | null>(null);

  return (
    <div className="relative w-full max-w-4xl h-[550px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col select-none">
      <div ref={containerRef} className="relative w-full h-full cursor-crosshair">
        {!gameStarted && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
            <h2 className="text-3xl font-black text-white mb-3 tracking-wider">MINECRAFT 3D Voxel</h2>
            <p className="text-slate-400 mb-6 text-sm">Oynamak için ekrana tıklayın ve imleci kilitleyin (WASD / Boşluk / Mouse)</p>
            <button 
              onClick={() => {
                containerRef.current?.requestPointerLock();
                setGameStarted(true);
              }}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition transform hover:scale-105 flex items-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" /> Oyuna Başla
            </button>
          </div>
        )}

        {gameStarted && !isPaused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-1.5 h-1.5 bg-white/80 rounded-full border border-black/50" />
          </div>
        )}

        {gameStarted && (
          <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10 bg-slate-950/60 p-2.5 rounded-xl backdrop-blur-md border border-slate-800">
            <div className="flex gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <MinecraftHeart key={i} fill={i * 2 < health ? 'full' : 'empty'} />
              ))}
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <MinecraftHunger key={i} fill={i * 2 < hunger ? 'full' : 'empty'} />
              ))}
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 bg-slate-950/80 p-2 rounded-2xl border border-slate-700 backdrop-blur-md z-10">
          {(['grass', 'stone', 'dirt', 'wood', 'brick', 'glass', 'diamond', 'tnt'] as BlockType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedBlock(type)}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition border ${
                selectedBlock === type ? 'border-emerald-400 bg-slate-800 scale-105' : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
              }`}
            >
              <MinecraftBlockIcon type={type} size={28} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
