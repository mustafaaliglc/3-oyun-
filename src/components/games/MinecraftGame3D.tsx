import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useMultiplayer } from '../../utils/useMultiplayer';
import { sound } from '../../utils/audio';
import { GameInfo, GameSettings } from '../../types/game';
import { GameMenuModal } from '../GameMenuModal';
import { InviteShareModal } from '../InviteShareModal';
import {
  Box,
  Pickaxe,
  Hammer,
  Eye,
  Award,
  Sparkles,
  Users,
  Sun,
  Moon,
  Flame,
} from 'lucide-react';

interface MinecraftGameProps {
  game: GameInfo;
  highScore: number;
  onUpdateHighScore: (score: number) => void;
}

export type BlockType =
  | 'grass'
  | 'stone'
  | 'wood'
  | 'leaves'
  | 'diamond'
  | 'glass'
  | 'brick'
  | 'tnt';

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
  grass: { id: 'grass', name: 'Çimen', color: '#78350f', topColor: '#22c55e', scoreVal: 10 },
  stone: { id: 'stone', name: 'Taş', color: '#64748b', scoreVal: 15 },
  wood: { id: 'wood', name: 'Odun', color: '#854d0e', scoreVal: 20 },
  leaves: { id: 'leaves', name: 'Yaprak', color: '#15803d', scoreVal: 10 },
  diamond: { id: 'diamond', name: 'Elmas', color: '#06b6d4', scoreVal: 150 },
  glass: { id: 'glass', name: 'Cam', color: '#bae6fd', transparent: true, opacity: 0.55, scoreVal: 25 },
  brick: { id: 'brick', name: 'Tuğla', color: '#b91c1c', scoreVal: 30 },
  tnt: { id: 'tnt', name: 'TNT', color: '#ef4444', scoreVal: 50 },
};

const HOTBAR_BLOCKS: BlockType[] = ['grass', 'stone', 'wood', 'leaves', 'diamond', 'glass', 'brick', 'tnt'];

export const MinecraftGame3D: React.FC<MinecraftGameProps> = ({
  game,
  highScore,
  onUpdateHighScore,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Player state
  const [playerName, setPlayerName] = useState<string>('Steve_Builder');
  const [selectedBlock, setSelectedBlock] = useState<BlockType>('grass');
  const [score, setScore] = useState<number>(0);
  const [blocksMined, setBlocksMined] = useState<number>(0);
  const [blocksPlaced, setBlocksPlaced] = useState<number>(0);
  const [diamondsFound, setDiamondsFound] = useState<number>(0);
  const [cameraView, setCameraView] = useState<'first' | 'third'>('first');
  const [isDayTime, setIsDayTime] = useState<boolean>(true);
  const [tntNotice, setTntNotice] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<string>('#10b981');
  const [settings, setSettings] = useState<GameSettings>({
    graphicsQuality: 'high',
    soundVolume: 80,
    cameraFov: 70,
    steeringSensitivity: 2,
  });

  // Modals
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(true);
  const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);

  // Multiplayer Hook
  const { connected, playerId, players, sendUpdate, sendChat, chatMessages } = useMultiplayer({
    room: 'minecraft',
    playerName,
    playerColor: '#10b981',
    vehicle: selectedBlock,
  });

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const worldBlocksRef = useRef<Map<string, { mesh: THREE.Mesh; type: BlockType }>>(new Map());
  const highlightMeshRef = useRef<THREE.LineSegments | null>(null);
  const steveMeshRef = useRef<THREE.Group | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Player physics
  const playerPosRef = useRef({
    x: 0,
    y: 8,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    isJumping: false,
    armSwing: 0,
  });

  const keysRef = useRef<{ w: boolean; s: boolean; a: boolean; d: boolean; space: boolean }>({
    w: false,
    s: false,
    a: false,
    d: false,
    space: false,
  });

  // Voxel materials cache
  const materialsCacheRef = useRef<Map<BlockType, THREE.Material | THREE.Material[]>>(new Map());

  const getBlockMaterial = useCallback((type: BlockType) => {
    if (materialsCacheRef.current.has(type)) {
      return materialsCacheRef.current.get(type)!;
    }

    const def = BLOCK_DEFS[type];
    if (type === 'grass') {
      const topMat = new THREE.MeshStandardMaterial({ color: def.topColor, roughness: 0.85 });
      const sideMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.9 });
      const bottomMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.9 });
      const mats = [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat];
      materialsCacheRef.current.set(type, mats);
      return mats;
    }

    if (type === 'glass') {
      const mat = new THREE.MeshPhysicalMaterial({
        color: def.color,
        transmission: 0.7,
        opacity: def.opacity,
        transparent: true,
        roughness: 0.1,
      });
      materialsCacheRef.current.set(type, mat);
      return mat;
    }

    if (type === 'diamond') {
      const mat = new THREE.MeshStandardMaterial({
        color: def.color,
        roughness: 0.3,
        metalness: 0.4,
        emissive: '#0891b2',
        emissiveIntensity: 0.3,
      });
      materialsCacheRef.current.set(type, mat);
      return mat;
    }

    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: 0.8,
    });
    materialsCacheRef.current.set(type, mat);
    return mat;
  }, []);

  // Steve 3D Model Builder (for 3rd person and remote players)
  const createSteveMesh = (colorHex = '#0ea5e9') => {
    const steve = new THREE.Group();

    // Head
    const headMat = new THREE.MeshStandardMaterial({ color: '#fcd34d', roughness: 0.8 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), headMat);
    head.position.y = 2.4;
    steve.add(head);

    // Hair
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.25, 0.85), new THREE.MeshStandardMaterial({ color: '#451a03' }));
    hair.position.set(0, 2.72, 0);
    steve.add(hair);

    // Torso (Cyan shirt)
    const torsoMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.5), torsoMat);
    torso.position.y = 1.4;
    steve.add(torso);

    // Left & Right Arms
    const armMat = new THREE.MeshStandardMaterial({ color: '#fcd34d', roughness: 0.8 });
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.2, 0.35), armMat);
    armL.position.set(-0.65, 1.4, 0);
    steve.add(armL);

    const armR = armL.clone();
    armR.position.x = 0.65;
    steve.add(armR);

    // Blue Pants & Legs
    const pantsMat = new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.8 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), pantsMat);
    legL.position.set(-0.25, 0.5, 0);
    steve.add(legL);

    const legR = legL.clone();
    legR.position.x = 0.25;
    steve.add(legR);

    return steve;
  };

  // Add a block to world
  const addBlock = useCallback((x: number, y: number, z: number, type: BlockType) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    if (worldBlocksRef.current.has(key)) return;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = getBlockMaterial(type);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(Math.round(x), Math.round(y), Math.round(z));

    scene.add(mesh);
    worldBlocksRef.current.set(key, { mesh, type });
  }, [getBlockMaterial]);

  // Remove block from world
  const removeBlock = useCallback((x: number, y: number, z: number) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    const record = worldBlocksRef.current.get(key);
    if (!record) return;

    scene.remove(record.mesh);
    record.mesh.geometry.dispose();
    worldBlocksRef.current.delete(key);
    return record.type;
  }, []);

  // TNT explosion
  const explodeTnt = useCallback((cx: number, cy: number, cz: number) => {
    sound.playExplosion();
    setTntNotice('💥 TNT PATLADI! ÇEVRE BLOKLAR PARÇALANDI');
    setTimeout(() => setTntNotice(null), 2500);

    const radius = 3;
    for (let x = cx - radius; x <= cx + radius; x++) {
      for (let y = cy - radius; y <= cy + radius; y++) {
        for (let z = cz - radius; z <= cz + radius; z++) {
          if (Math.hypot(x - cx, y - cy, z - cz) <= radius) {
            removeBlock(x, y, z);
          }
        }
      }
    }
  }, [removeBlock]);

  // Initialize Three.js Voxel Terrain
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#38bdf8'); // Daylight sky
    scene.fog = new THREE.FogExp2('#38bdf8', 0.012);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 500);
    cameraRef.current = camera;
    camera.position.set(0, 8, 0);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Sun & Ambient Light
    const amb = new THREE.AmbientLight('#ffffff', 1.3);
    scene.add(amb);

    const sun = new THREE.DirectionalLight('#fffbeb', 2.0);
    sun.position.set(40, 60, 30);
    scene.add(sun);

    // 5. Build Procedural Voxel Terrain (28 x 28 area with hills and trees)
    const worldSize = 14;
    for (let x = -worldSize; x <= worldSize; x++) {
      for (let z = -worldSize; z <= worldSize; z++) {
        // Height formula: wavy rolling hills
        const dist = Math.hypot(x, z);
        const hill = Math.floor(Math.sin(x * 0.28) * Math.cos(z * 0.28) * 2.5 + 2);
        const surfaceY = Math.max(0, hill);

        // Bedrock & Stone layer
        for (let y = 0; y < surfaceY; y++) {
          const isDiamond = Math.random() < 0.04 && y <= 1;
          addBlock(x, y, z, isDiamond ? 'diamond' : 'stone');
        }

        // Top Grass Block
        addBlock(x, surfaceY, z, 'grass');

        // Spawn occasional Trees
        if (Math.random() < 0.035 && Math.abs(x) > 2 && Math.abs(z) > 2) {
          const trunkBase = surfaceY + 1;
          for (let ty = 0; ty < 4; ty++) {
            addBlock(x, trunkBase + ty, z, 'wood');
          }
          // Leaves canopy
          const leafY = trunkBase + 4;
          for (let lx = -1; lx <= 1; lx++) {
            for (let lz = -1; lz <= 1; lz++) {
              for (let ly = 0; ly <= 1; ly++) {
                if (!(lx === 0 && lz === 0 && ly === 0)) {
                  addBlock(x + lx, leafY + ly, z + lz, 'leaves');
                }
              }
            }
          }
        }
      }
    }

    // 6. Highlight Selection Box (Wireframe for targeted voxel face)
    const wireGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    const wireEdges = new THREE.EdgesGeometry(wireGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: '#000000', linewidth: 2 });
    const highlightBox = new THREE.LineSegments(wireEdges, wireMat);
    highlightBox.visible = false;
    scene.add(highlightBox);
    highlightMeshRef.current = highlightBox;

    // 7. Steve 3D mesh (For third person view)
    const steve = createSteveMesh();
    scene.add(steve);
    steveMeshRef.current = steve;

    // Resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [addBlock]);

  // Pointer lock & Mouse click interactions (Left click mine, Right click place)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== container) return;
      playerPosRef.current.yaw -= e.movementX * 0.0028;
      playerPosRef.current.pitch -= e.movementY * 0.0028;
      playerPosRef.current.pitch = Math.max(-1.45, Math.min(1.45, playerPosRef.current.pitch));
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== container) return;

      const camera = cameraRef.current;
      const scene = sceneRef.current;
      if (!camera || !scene) return;

      // Raycast 6 blocks forward
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      raycaster.far = 7;

      const blockMeshes: THREE.Mesh[] = [];
      worldBlocksRef.current.forEach((val) => blockMeshes.push(val.mesh));

      const intersects = raycaster.intersectObjects(blockMeshes, false);
      if (intersects.length === 0) return;

      const hit = intersects[0];
      const hitPos = hit.point.clone().sub(hit.face!.normal.clone().multiplyScalar(0.1));
      const bx = Math.round(hitPos.x);
      const by = Math.round(hitPos.y);
      const bz = Math.round(hitPos.z);

      if (e.button === 0) {
        // LEFT CLICK: MINE / BREAK BLOCK
        const minedType = removeBlock(bx, by, bz);
        if (minedType) {
          if (minedType === 'tnt') {
            explodeTnt(bx, by, bz);
          } else {
            sound.playTone(320, 'sine', 0.06, 0.2);
            setBlocksMined((b) => b + 1);
            if (minedType === 'diamond') {
              sound.playBonus();
              setDiamondsFound((d) => d + 1);
            }
            const pts = BLOCK_DEFS[minedType].scoreVal;
            setScore((s) => {
              const newScore = s + pts;
              onUpdateHighScore(newScore);
              return newScore;
            });
          }
        }
      } else if (e.button === 2) {
        // RIGHT CLICK: PLACE SELECTED BLOCK ON FACE
        e.preventDefault();
        const placePos = hit.point.clone().add(hit.face!.normal.clone().multiplyScalar(0.4));
        const px = Math.round(placePos.x);
        const py = Math.round(placePos.y);
        const pz = Math.round(placePos.z);

        // Don't place inside player
        const player = playerPosRef.current;
        if (Math.hypot(px - player.x, pz - player.z) > 0.6 || Math.abs(py - player.y) > 1.8) {
          addBlock(px, py, pz, selectedBlock);
          sound.playTone(450, 'triangle', 0.07, 0.2);
          setBlocksPlaced((p) => p + 1);
          setScore((s) => {
            const newScore = s + 5;
            onUpdateHighScore(newScore);
            return newScore;
          });
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    const handleClick = () => {
      if (document.pointerLockElement !== container) {
        container.requestPointerLock?.();
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('click', handleClick);
    };
  }, [addBlock, removeBlock, explodeTnt, selectedBlock, onUpdateHighScore]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysRef.current.w = true;
      if (k === 's' || e.key === 'ArrowDown') keysRef.current.s = true;
      if (k === 'a' || e.key === 'ArrowLeft') keysRef.current.a = true;
      if (k === 'd' || e.key === 'ArrowRight') keysRef.current.d = true;
      if (e.code === 'Space') keysRef.current.space = true;

      // Hotbar selection keys 1 - 8
      const num = parseInt(k, 10);
      if (num >= 1 && num <= 8) {
        setSelectedBlock(HOTBAR_BLOCKS[num - 1]);
        sound.playTone(520, 'sine', 0.05, 0.15);
      }

      // Camera view toggle
      if (k === 'c' || e.key === 'F5') {
        e.preventDefault();
        setCameraView((v) => (v === 'first' ? 'third' : 'first'));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysRef.current.w = false;
      if (k === 's' || e.key === 'ArrowDown') keysRef.current.s = false;
      if (k === 'a' || e.key === 'ArrowLeft') keysRef.current.a = false;
      if (k === 'd' || e.key === 'ArrowRight') keysRef.current.d = false;
      if (e.code === 'Space') keysRef.current.space = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main Minecraft Game Loop & Voxel Physics
  useEffect(() => {
    let lastTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const pos = playerPosRef.current;
      const keys = keysRef.current;
      const camera = cameraRef.current;
      const scene = sceneRef.current;
      const renderer = rendererRef.current;
      const steve = steveMeshRef.current;
      const highlight = highlightMeshRef.current;

      // WASD Movement
      const moveSpeed = 6.5;
      let dx = 0;
      let dz = 0;

      if (keys.w) dz -= 1;
      if (keys.s) dz += 1;
      if (keys.a) dx -= 1;
      if (keys.d) dx += 1;

      if (dx !== 0 || dz !== 0) {
        const len = Math.hypot(dx, dz);
        dx /= len;
        dz /= len;

        const sinYaw = Math.sin(pos.yaw);
        const cosYaw = Math.cos(pos.yaw);

        pos.x += (dx * cosYaw + dz * sinYaw) * moveSpeed * dt;
        pos.z += (dz * cosYaw - dx * sinYaw) * moveSpeed * dt;
      }

      // Voxel Ground Collision & Gravity
      const footBlockX = Math.round(pos.x);
      const footBlockZ = Math.round(pos.z);
      let groundY = 0;

      // Find highest block below player feet
      for (let y = Math.floor(pos.y + 1); y >= 0; y--) {
        const key = `${footBlockX},${y},${footBlockZ}`;
        if (worldBlocksRef.current.has(key)) {
          groundY = y + 1.5; // stand on top of block
          break;
        }
      }

      // Jump
      if (keys.space && !pos.isJumping && pos.y <= groundY + 0.1) {
        pos.isJumping = true;
        pos.vy = 8.5;
        sound.playTone(400, 'triangle', 0.08, 0.15);
      }

      // Apply vertical velocity & gravity
      pos.y += pos.vy * dt;
      pos.vy -= 22 * dt; // gravity

      if (pos.y <= groundY) {
        pos.y = groundY;
        pos.isJumping = false;
        pos.vy = 0;
      }

      // Update Highlight Selection Box
      if (camera && highlight) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        raycaster.far = 7;

        const blockMeshes: THREE.Mesh[] = [];
        worldBlocksRef.current.forEach((val) => blockMeshes.push(val.mesh));

        const intersects = raycaster.intersectObjects(blockMeshes, false);
        if (intersects.length > 0) {
          const hit = intersects[0];
          const hitPos = hit.point.clone().sub(hit.face!.normal.clone().multiplyScalar(0.1));
          highlight.position.set(Math.round(hitPos.x), Math.round(hitPos.y), Math.round(hitPos.z));
          highlight.visible = true;
        } else {
          highlight.visible = false;
        }
      }

      // Update Steve Model (visible in third person)
      if (steve) {
        steve.position.set(pos.x, pos.y - 1.5, pos.z);
        steve.rotation.y = pos.yaw;
        steve.visible = cameraView === 'third';
      }

      // Update Camera Position
      if (camera) {
        camera.rotation.order = 'YXZ';
        camera.rotation.y = pos.yaw;
        camera.rotation.x = pos.pitch;

        if (cameraView === 'first') {
          camera.position.set(pos.x, pos.y + 0.2, pos.z);
        } else {
          // Third-person chase camera behind Steve
          const dist = 3.8;
          const camX = pos.x + Math.sin(pos.yaw) * dist;
          const camZ = pos.z + Math.cos(pos.yaw) * dist;
          camera.position.set(camX, pos.y + 1.2, camZ);
        }
      }

      // Multiplayer update
      sendUpdate({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        rotation: pos.yaw,
        speed: moveSpeed,
        score,
        vehicle: selectedBlock,
      });

      // Render
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [cameraView, selectedBlock, score, sendUpdate]);

  return (
    <div className="relative w-full aspect-16/10 sm:aspect-16/9 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl select-none">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-crosshair" />

      {/* Crosshair (Minecraft Classic Cross) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="relative w-4 h-4 flex items-center justify-center">
          <div className="w-3.5 h-0.5 bg-white/90 drop-shadow" />
          <div className="h-3.5 w-0.5 bg-white/90 absolute drop-shadow" />
        </div>
      </div>

      {/* Top HUD: Score & Mining Stats */}
      <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-500/30 shadow-lg">
          <Box className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-white uppercase">MINECRAFT 3D VOXEL</span>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/85 backdrop-blur-md px-4 py-1.5 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <Award className="w-4 h-4" />
            <span>{score.toLocaleString()} PUAN</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1 text-xs font-bold text-cyan-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{diamondsFound} Elmas</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1 text-xs font-bold text-slate-300">
            <Pickaxe className="w-3.5 h-3.5 text-amber-400" />
            <span>{blocksMined} Kırıldı</span>
          </div>
        </div>
      </div>

      {/* TNT Banner */}
      {tntNotice && (
        <div className="absolute top-16 inset-x-0 flex justify-center pointer-events-none animate-bounce z-20">
          <span className="px-5 py-1.5 rounded-xl text-xs font-black bg-rose-600/90 text-white shadow-xl border border-rose-300">
            {tntNotice}
          </span>
        </div>
      )}

      {/* Minecraft Hotbar (Slots 1 - 8) */}
      <div className="absolute bottom-3 inset-x-0 flex flex-col items-center pointer-events-auto gap-2">
        <div className="flex items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-2xl border-2 border-slate-700 shadow-2xl">
          {HOTBAR_BLOCKS.map((blk, idx) => {
            const def = BLOCK_DEFS[blk];
            const isSelected = selectedBlock === blk;
            return (
              <button
                key={blk}
                onClick={() => {
                  setSelectedBlock(blk);
                  sound.playTone(500, 'sine', 0.05, 0.15);
                }}
                className={`relative w-10 sm:w-12 h-10 sm:h-12 rounded-xl flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'border-2 border-amber-400 bg-amber-500/20 scale-105 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                    : 'border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:scale-100'
                }`}
              >
                {/* 3D Mini Cube Icon */}
                <div
                  className="w-5 h-5 rounded-xs shadow-inner border border-black/30"
                  style={{ backgroundColor: def.topColor || def.color }}
                />
                <span className="absolute bottom-0.5 right-1 text-[9px] font-mono font-bold text-slate-400">
                  {idx + 1}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Block Info & Camera Switch */}
        <div className="flex items-center gap-3 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-800 text-xs">
          <span className="text-emerald-400 font-bold">
            Seçili: {BLOCK_DEFS[selectedBlock].name}
          </span>
          <span className="text-slate-600">·</span>
          <button
            onClick={() => setCameraView((v) => (v === 'first' ? 'third' : 'first'))}
            className="flex items-center gap-1 text-slate-300 hover:text-white"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>[C] {cameraView === 'first' ? '3. Şahıs (Steve)' : '1. Şahıs'}</span>
          </button>
        </div>
      </div>

      {/* Online Players indicator */}
      <div className="absolute top-14 left-3 pointer-events-none">
        <div className="bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          <span>{players.size + 1} Mimar Çevrimiçi</span>
        </div>
      </div>

      {/* Game Menu Modal */}
      <GameMenuModal
        game={game}
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        playerName={playerName}
        onPlayerNameChange={setPlayerName}
        playerColor={playerColor}
        onPlayerColorChange={setPlayerColor}
        settings={settings}
        onSettingsChange={setSettings}
        onStartGame={() => {
          setIsMenuOpen(false);
          sound.playBonus();
        }}
      />

      {/* Invite Modal */}
      <InviteShareModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onlineCount={players.size + 1}
      />
    </div>
  );
};
