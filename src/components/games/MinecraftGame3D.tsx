import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../utils/audio';
import { GameInfo, GameSettings } from '../../types/game';
import { GameMenuModal } from '../GameMenuModal';
import { SettingsPanel } from '../SettingsPanel';
import {  Box,
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

const BLOCK_BREAK_TIMES: Record<BlockType, number> = {
  grass: 0.5,
  stone: 1.2,
  dirt: 0.4,
  wood: 0.8,
  birch: 0.8,
  leaves: 0.25,
  diamond: 1.8,
  glass: 0.3,
  brick: 1.0,
  tnt: 0.4,
  beef: 0.1,
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

const generateMinecraftTexture = (type: BlockType, face?: 'top' | 'side' | 'bottom') => {
  const size = 8;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  // Create a 16x16 pixel art
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const setPixel = (x: number, y: number, r: number, g: number, b: number) => {
    const idx = (y * size + x) * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = 255;
  };

  if (type === 'stone') {
    // Cobblestone (Kırıktaş) - Gray cobbles with dark borders (Matching uploaded image 1)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isBorder = (y === 0 || y === 4 || x === 0 || x === 4 || (y < 4 && x === 2) || (y >= 4 && x === 6));
        const rFactor = Math.sin(x * 12.3) * Math.cos(y * 7.7) * 6 + Math.random() * 4;
        if (isBorder) {
          setPixel(x, y, 78 + rFactor, 78 + rFactor, 78 + rFactor); // Dark gray mortar/joint outlines
        } else {
          setPixel(x, y, 126 + rFactor, 126 + rFactor, 126 + rFactor); // Cobble rock center
        }
      }
    }
  } else if (type === 'grass') {
    if (face === 'top') {
      // Grass Top - Lush vibrant green (Matching uploaded image 2)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const rFactor = Math.sin(x * 14.2) * Math.cos(y * 9.1) * 7 + Math.random() * 5;
          setPixel(x, y, 76 + rFactor, 180 + rFactor * 0.8, 55 + rFactor * 0.5);
        }
      }
    } else if (face === 'bottom') {
      // Dirt (Bottom) - Rich brown soil (Matching uploaded image 3)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const rFactor = Math.sin(x * 9.4) * Math.cos(y * 12.1) * 7.5 + Math.random() * 5;
          setPixel(x, y, 98 + rFactor, 66 + rFactor, 43 + rFactor);
        }
      }
    } else {
      // Grass Side - Green hanging grass on brown dirt (Matching uploaded image 2 side)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const baseGrassDepth = 4;
          const isGrass = y < 2 || 
            (y === 2 && (x % 2 === 0)) || 
            (y === 3 && (x === 1 || x === 5 || x === 7));
          const rFactor = Math.sin(x * 9.4) * Math.cos(y * 12.1) * 6 + Math.random() * 4;
          if (isGrass) {
            setPixel(x, y, 76 + rFactor, 180 + rFactor * 0.8, 55 + rFactor * 0.5); // Green grass
          } else {
            setPixel(x, y, 98 + rFactor, 66 + rFactor, 43 + rFactor); // Brown dirt
          }
        }
      }
    }
  } else if (type === 'dirt') {
    // Dirt (Toprak) - Brown earthy pixels with occasional pebble stones (Matching uploaded image 3)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const rFactor = Math.sin(x * 11.2) * Math.cos(y * 13.4) * 7.5 + Math.random() * 6;
        const isPebble = (x === 1 && y === 2) || (x === 5 && y === 6) || (x === 3 && y === 1);
        if (isPebble) {
          setPixel(x, y, 125 + rFactor * 0.4, 125 + rFactor * 0.4, 125 + rFactor * 0.4); // Pebble gray
        } else {
          setPixel(x, y, 98 + rFactor, 66 + rFactor, 43 + rFactor); // Dirt body
        }
      }
    }
  } else if (type === 'wood') {
    // Oak Log (Meşe Odunu) (Matching uploaded image 4)
    if (face === 'top' || face === 'bottom') {
      // Tree rings (inner wood cross-section)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - 7.5;
          const dy = y - 7.5;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const isRing = Math.floor(dist) % 1 === 0;
          if (isRing) {
            setPixel(x, y, 192, 154, 114); // Inner cream body
          } else {
            setPixel(x, y, 142, 102, 64);  // Wood ring border
          }
        }
      }
    } else {
      // Wood Side: Vertical dark bark strips
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const isDarkStrip = (x === 2 || x === 6 || x === 10 || x === 14);
          const rFactor = Math.sin(y * 5.4) * 8 + Math.random() * 8;
          if (isDarkStrip) {
            setPixel(x, y, 62 + rFactor, 42 + rFactor, 28 + rFactor); // Vertical dark grooves
          } else {
            setPixel(x, y, 103 + rFactor, 76 + rFactor, 48 + rFactor); // Brown bark
          }
        }
      }
    }
  } else if (type === 'birch') {
    // Birch Log (Huş Odunu) (Matching uploaded image 5)
    if (face === 'top' || face === 'bottom') {
      // Birch rings (light cream cross section)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - 7.5;
          const dy = y - 7.5;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const isRing = Math.floor(dist) % 2 === 0;
          if (isRing) {
            setPixel(x, y, 225, 210, 185); // Cream ring
          } else {
            setPixel(x, y, 198, 178, 148); // Sandy beige ring
          }
        }
      }
    } else {
      // Wood Side: White birch bark with black horizontal notches
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const isNotch = (y === 1 && x >= 1 && x <= 3) || 
            (y === 5 && x >= 5 && x <= 7) || 
            (y === 3 && (x <= 1 || x >= 6)) ||
            (y === 7 && x >= 2 && x <= 4);
          const rFactor = Math.random() * 10;
          if (isNotch) {
            setPixel(x, y, 36 + rFactor, 36 + rFactor, 36 + rFactor); // Black notch
          } else {
            setPixel(x, y, 226 + rFactor, 222 + rFactor, 206 + rFactor); // White birch bark
          }
        }
      }
    }
  } else if (type === 'diamond') {
    // Glowing diamond ores
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const rFactor = Math.sin(x * 12.3) * Math.cos(y * 8.8) * 15 + Math.random() * 10;
        const isGlow = (x === 1 && y === 1) || (x === 2 && y === 1) || (x === 5 && y === 5) || (x === 6 && y === 4);
        if (isGlow) {
          setPixel(x, y, 255, 255, 255);
        } else {
          setPixel(x, y, 34 + rFactor * 0.5, 197 + rFactor * 0.8, 218 + rFactor);
        }
      }
    }
  } else if (type === 'glass') {
    // Beautiful transparent glass textures
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isBorder = (x === 0 || y === 0 || x === 15 || y === 15);
        const isHighlight = (x === y && x >= 1 && x <= 3) || (x === y - 2 && x >= 4 && x <= 5);
        const idx = (y * size + x) * 4;
        if (isBorder) {
          data[idx] = 186; data[idx + 1] = 230; data[idx + 2] = 253; data[idx + 3] = 180;
        } else if (isHighlight) {
          data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255; data[idx + 3] = 255;
        } else {
          data[idx] = 224; data[idx + 1] = 242; data[idx + 2] = 254; data[idx + 3] = 30; // transparent air
        }
      }
    }
  } else if (type === 'brick') {
    // Red clay bricks
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isMortar = (y % 2 === 0) || (y < 2 && x === 2) || (y >= 2 && y < 4 && x === 6) || (y >= 4 && y < 6 && x === 2) || (y >= 6 && x === 6);
        const rFactor = Math.random() * 15;
        if (isMortar) {
          setPixel(x, y, 212, 212, 212); // Gray mortar
        } else {
          setPixel(x, y, 172 + rFactor, 52 + rFactor, 42 + rFactor); // Red brick body
        }
      }
    }
  } else if (type === 'tnt') {
    // TNT explosives with red blocks and white stripe containing black TNT letters
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isWhiteStripe = (y >= 2 && y <= 4);
        const isT1 = (y === 3 && x >= 1 && x <= 2) || (x === 1 && y >= 3 && y <= 4);
        const isN = (x === 3 && y >= 3 && y <= 4) || (x === 4 && y >= 3 && y <= 4) || (x === 3 && y === 3);
        const isT2 = (y === 3 && x >= 5 && x <= 6) || (x === 5 && y >= 3 && y <= 4);
        const isText = isWhiteStripe && (isT1 || isN || isT2);

        const rFactor = Math.random() * 12;
        if (isText) {
          setPixel(x, y, 0, 0, 0); // Black "TNT" lettering
        } else if (isWhiteStripe) {
          setPixel(x, y, 240 + rFactor, 240 + rFactor, 240 + rFactor); // White central band
        } else {
          setPixel(x, y, 220 + rFactor, 40 + rFactor, 40 + rFactor); // Red dynamite sticks
        }
      }
    }
  } else if (type === 'beef') {
    // Raw Beef (Et) - Diagonal red ribeye meat with bone tips (Matching uploaded image 2)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Pixel-art diagonal raw steak
        const isBone = (x === y && (x <= 1 || x >= 6)) || (x === y + 1 && (x <= 1 || x >= 6)) || (x === y - 1 && (x <= 1 || x >= 6));
        const isMeat = !isBone && (x + y >= 4 && x + y <= 11 && Math.abs(x - y) <= 2);
        const rFactor = Math.random() * 15;
        const idx = (y * size + x) * 4;
        
        if (isBone) {
          // White bone tips
          setPixel(x, y, 245 + rFactor, 245 + rFactor, 245 + rFactor);
        } else if (isMeat) {
          // Rich red/pink raw meat
          setPixel(x, y, 230 + rFactor, 60 + rFactor, 70 + rFactor);
        } else {
          // Transparent empty space
          data[idx] = 0; data[idx+1] = 0; data[idx+2] = 0; data[idx+3] = 0;
        }
      }
    }
  } else {
    // Leaves (Green with transparent spaces)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isHole = Math.random() < 0.12;
        if (isHole) {
          const idx = (y * size + x) * 4;
          data[idx] = 16; data[idx + 1] = 90; data[idx + 2] = 24; data[idx + 3] = 40;
        } else {
          const g = 110 + Math.floor(Math.random() * 35);
          setPixel(x, y, Math.floor(g * 0.15), g, Math.floor(g * 0.15));
        }
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

    // Retrieve the canvas image generated by our actual texture generator
    const getFaceImage = (faceType: BlockType, faceName?: 'top' | 'side' | 'bottom') => {
      const tex = generateMinecraftTexture(faceType, faceName);
      return tex.image as HTMLCanvasElement;
    };

    const topCanvas = getFaceImage(type, 'top');
    const sideCanvas = getFaceImage(type, 'side');

    if (!topCanvas || !sideCanvas) return;

    ctx.imageSmoothingEnabled = false;

    if (type === 'beef') {
      // Beef is flat, just draw it flat in the slot center
      ctx.drawImage(topCanvas, size * 0.1, size * 0.1, size * 0.8, size * 0.8);
    } else {
      // Draw 3D cube isometric outline
      const hw = size / 2;
      const hh = size / 2;

      // Draw Top Face (Rhombus shape)
      ctx.save();
      ctx.translate(hw, hh - size * 0.18);
      ctx.scale(1, 0.5);
      ctx.rotate(-Math.PI / 4);
      ctx.drawImage(topCanvas, -hw * 0.65, -hh * 0.65, hw * 1.3, hh * 1.3);
      ctx.restore();

      // Draw Left Face (skewed)
      ctx.save();
      ctx.translate(hw - size * 0.22, hh + size * 0.15);
      ctx.transform(1, 0.5, 0, 1, 0, 0); // skew vertical
      ctx.scale(0.5, 0.65);
      ctx.drawImage(sideCanvas, -hw, -hh, size, size);
      ctx.restore();

      // Draw Right Face (skewed with shadow)
      ctx.save();
      ctx.translate(hw + size * 0.22, hh + size * 0.15);
      ctx.transform(1, -0.5, 0, 1, 0, 0); // skew vertical
      ctx.scale(0.5, 0.65);
      ctx.drawImage(sideCanvas, -hw, -hh, size, size);
      
      // Shadow overlay for right face
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(-hw, -hh, size, size);
      ctx.restore();
    }
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

const generateCowTexture = (part: 'body' | 'head' | 'leg') => {
  const size = 8;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;
  
  const setPixel = (x: number, y: number, r: number, g: number, b: number) => {
    const idx = (y * size + x) * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const isWhitePatch = (Math.sin(x * 0.85) * Math.cos(y * 0.85) > 0.08) || (x % 7 === 0 && y % 5 === 0);
      if (part === 'head' && y >= 11 && x >= 4 && x <= 11) {
        // Pink snout (muzzle)
        setPixel(x, y, 244, 143, 177);
      } else if (isWhitePatch) {
        // White patches (cow spots)
        setPixel(x, y, 226, 220, 213);
      } else {
        // Cow brown fur (Matching uploaded image 1)
        setPixel(x, y, 92, 64, 51);
      }
    }
  }
  
  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
};

export const MinecraftGame3D: React.FC<MinecraftGameProps> = ({
  game,
  highScore,
  onUpdateHighScore,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Game state
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [hotbarSlots, setHotbarSlots] = useState<(BlockType | null)[]>(INITIAL_HOTBAR);
  const hotbarSlotsRef = useRef<(BlockType | null)[]>(INITIAL_HOTBAR);

  useEffect(() => {
    hotbarSlotsRef.current = hotbarSlots;
  }, [hotbarSlots]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>('Steve_Builder');
  const [selectedBlock, setSelectedBlock] = useState<BlockType | null>(null);
  
  // Survival States: Health (Hearts) & Hunger (Shanks)
  const [health, setHealth] = useState<number>(20); // Max 20 (10 hearts)
  const [hunger, setHunger] = useState<number>(20); // Max 20 (10 shanks)
  const hungerTimerRef = useRef<number>(0);
  
  // Real-time synchronous inventory to prevent race conditions or negative counts
  const inventoryRef = useRef<Record<BlockType, number>>({
    grass: 0, stone: 0, dirt: 0, wood: 0, birch: 0, leaves: 0, diamond: 0, glass: 0, brick: 0, tnt: 0, beef: 0
  });
  const [inventory, setInventory] = useState<Record<BlockType, number>>(inventoryRef.current);
  const [draggedItem, setDraggedItem] = useState<BlockType | null>(null);
  const [showCrafting, setShowCrafting] = useState<boolean>(false);
  const [craftingGrid, setCraftingGrid] = useState<(BlockType | null)[]>([null, null, null, null]);
  const [score, setScore] = useState<number>(0);
  const [blocksMined, setBlocksMined] = useState<number>(0);
  const [blocksPlaced, setBlocksPlaced] = useState<number>(0);
  const [diamondsFound, setDiamondsFound] = useState<number>(0);
  const [cameraView, setCameraView] = useState<'first' | 'third'>('first');
  const [isDayTime, setIsDayTime] = useState<boolean>(true);
  const [tntNotice, setTntNotice] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<string>('#10b981');
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settings, setSettings] = useState<GameSettings>({
    renderDistance: 8,
    mouseSensitivity: 1.0,
    soundVolume: 80,
    graphicsStyle: 'fancy',
    allowCracked: false,
    graphicsQuality: 'high',
    cameraFov: 70,
    steeringSensitivity: 2,
  });

  const [miningProgress, setMiningProgress] = useState<number>(0);
  const isMouseDownLeftRef = useRef<boolean>(false);
  const miningBlockRef = useRef<{ x: number; y: number; z: number; type: BlockType; progress: number; totalTime: number } | null>(null);
  const lastMineSoundTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSettingsModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Multiplayer room & connection state
  const [roomMode, setRoomMode] = useState<'menu' | 'host' | 'join'>('menu');
  const [roomId, setRoomId] = useState<string>('');
  const [generatedRoomCode, setGeneratedRoomCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectedPlayers, setConnectedPlayers] = useState<NetworkPlayer[]>([]);
  const [isMultiplayerActive, setIsMultiplayerActive] = useState<boolean>(false);

  // In-Game Chat
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; name: string; color: string; text: string; timestamp: number }>>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const isChatOpenRef = useRef<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [showPlayerList, setShowPlayerList] = useState<boolean>(false);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  interface RemotePlayerObject {
    id: string;
    name: string;
    color: string;
    group: THREE.Group;
    collider: THREE.Mesh;
    head: THREE.Mesh;
    torso: THREE.Mesh;
    armL: THREE.Mesh;
    armR: THREE.Mesh;
    legL: THREE.Mesh;
    legR: THREE.Mesh;
    handSlot: THREE.Group;
    currentHeldBlock: string | null;
    targetX: number;
    targetY: number;
    targetZ: number;
    targetYaw: number;
    targetPitch: number;
    walkTime: number;
    punchTime: number;
    damageFlashTimer: number;
    origColors: { head: string; torso: string; arms: string; legs: string };
  }

  const [damageVignette, setDamageVignette] = useState<boolean>(false);
  const remotePlayersRef = useRef<Map<string, RemotePlayerObject>>(new Map());
  const steveArmLRef = useRef<THREE.Mesh | null>(null);
  const steveLegLRef = useRef<THREE.Mesh | null>(null);
  const steveLegRRef = useRef<THREE.Mesh | null>(null);
  const lastNetworkSendRef = useRef<number>(0);
  const isJumpingRef = useRef<boolean>(false);
  const selectedBlockRef = useRef<BlockType | null>(selectedBlock);
  const crackMeshRef = useRef<THREE.LineSegments | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    selectedBlockRef.current = selectedBlock;
  }, [selectedBlock]);

  // Online network actions
  const sendPlayerPunch = useCallback(() => {
    multiplayerManager.sendPunch();
  }, []);

  const sendBlockBreak = useCallback((x: number, y: number, z: number) => {
    multiplayerManager.breakBlock(x, y, z);
  }, []);

  const sendBlockPlace = useCallback((x: number, y: number, z: number, t: string) => {
    multiplayerManager.placeBlock(x, y, z, t);
  }, []);

  // Handle pointer lock release and pause when inventory is opened
  useEffect(() => {
    if (showCrafting) {
      if (document.pointerLockElement === containerRef.current) {
        document.exitPointerLock();
      }
      setIsPaused(true);
    } else {
      setIsPaused(false);
    }
  }, [showCrafting]);

  // Synchronous Inventory Action Handlers
  const addToInventory = useCallback((type: BlockType) => {
    const current = inventoryRef.current[type] || 0;
    inventoryRef.current[type] = current + 1;
    setInventory({ ...inventoryRef.current });

    // Auto-populate into the first empty hotbar slot if not present
    setHotbarSlots((prev) => {
      if (prev.includes(type)) return prev;
      const emptyIdx = prev.findIndex((slot) => slot === null);
      if (emptyIdx !== -1) {
        const updated = [...prev];
        updated[emptyIdx] = type;
        return updated;
      }
      return prev;
    });

    // Auto-select as hand-held block if nothing is currently selected
    setSelectedBlock((prev) => (prev === null ? type : prev));
  }, []);

  const removeFromInventory = useCallback((type: BlockType | null): boolean => {
    if (!type) return false;
    const current = inventoryRef.current[type] || 0;
    if (current > 0) {
      const newCount = current - 1;
      inventoryRef.current[type] = newCount;
      setInventory({ ...inventoryRef.current });

      if (newCount === 0) {
        // Clear from hotbar if count drops to 0
        setHotbarSlots((prev) => prev.map((slot) => (slot === type ? null : slot)));
        setSelectedBlock((prev) => (prev === type ? null : prev));
      }
      return true;
    }
    inventoryRef.current[type] = 0;
    setInventory({ ...inventoryRef.current });
    return false;
  }, []);

  const craftBlock = useCallback((from: BlockType, to: BlockType, cost: number) => {
    const currentFrom = inventoryRef.current[from] || 0;
    if (currentFrom >= cost) {
      inventoryRef.current[from] = currentFrom - cost;
      inventoryRef.current[to] = (inventoryRef.current[to] || 0) + 1;
      setInventory({ ...inventoryRef.current });
      sound.playBonus();
    }
  }, []);

  const getCraftingResult = useCallback((): { result: BlockType; count: number } | null => {
    const counts: Partial<Record<BlockType, number>> = {};
    let totalItems = 0;
    for (const item of craftingGrid) {
      if (item) {
        counts[item] = (counts[item] || 0) + 1;
        totalItems++;
      }
    }
    if (counts['wood'] === 4) return { result: 'tnt', count: 1 };
    if (counts['stone'] === 2 && totalItems === 2) return { result: 'brick', count: 1 };
    if (counts['wood'] === 2 && totalItems === 2) return { result: 'glass', count: 1 };
    if (counts['dirt'] === 2 && totalItems === 2) return { result: 'grass', count: 1 };
    if (counts['diamond'] === 1 && counts['stone'] === 2 && totalItems === 3) return { result: 'diamond', count: 2 };
    if (counts['birch'] === 2 && totalItems === 2) return { result: 'wood', count: 1 };
    return null;
  }, [craftingGrid]);

  const executeCrafting = useCallback(() => {
    const recipe = getCraftingResult();
    if (!recipe) return;

    for (const item of craftingGrid) {
      if (item) {
        removeFromInventory(item);
      }
    }
    setCraftingGrid([null, null, null, null]);

    for (let i = 0; i < recipe.count; i++) {
      addToInventory(recipe.result);
    }
    sound.playBonus();
  }, [craftingGrid, getCraftingResult, removeFromInventory, addToInventory]);

  const eatBeef = useCallback(() => {
    const beefCount = inventoryRef.current['beef'] || 0;
    if (beefCount > 0 && (hunger < 20 || health < 20)) {
      removeFromInventory('beef');
      setHunger((prev) => Math.min(20, prev + 6));
      setHealth((prev) => Math.min(20, prev + 4));
      sound.playBonus();
    }
  }, [hunger, health, removeFromInventory]);

  // Real-time Hunger & Starvation loop
  useEffect(() => {
    if (!gameStarted || isPaused) return;

    const interval = setInterval(() => {
      setHunger((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          // Take starvation damage if hungry
          setHealth((h) => {
            const nextHealth = Math.max(0, h - 2);
            if (nextHealth === 0) {
              sound.playExplosion();
              alert("❌ AÇLIKTAN ÖLDÜNÜZ! Steve lobi noktasında yeniden doğuyor...");
              // Respawn
              setHunger(20);
              setScore(0);
              playerPosRef.current.x = 0;
              playerPosRef.current.y = 12;
              playerPosRef.current.z = 0;
              return 20; // Full health on respawn
            } else {
              sound.playTone(150, 'sawtooth', 0.15, 0.15); // Hunger damage ouch sound
            }
            return nextHealth;
          });
        }
        return next;
      });
    }, 8000); // Lose 1 hunger point every 8 seconds

    return () => clearInterval(interval);
  }, [gameStarted, isPaused]);

  // Modals UI state
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [menuInitialTab, setMenuInitialTab] = useState<'start' | 'how_to_play' | 'settings'>('start');

  const showCraftingRef = useRef<boolean>(false);
  useEffect(() => {
    showCraftingRef.current = showCrafting;
  }, [showCrafting]);

  // Alt-key Free Cursor Mode state & ref
  const [isCursorFree, setIsCursorFree] = useState<boolean>(false);
  const altCursorActiveRef = useRef<boolean>(false);

  // Stable references for block operations
  const addBlockRef = useRef<(x: number, y: number, z: number, type: BlockType) => void>(() => {});
  const removeBlockRef = useRef<(x: number, y: number, z: number) => void>(() => {});

  // Shared geometry for world blocks to maximize performance on large worlds
  const sharedBoxGeoRef = useRef<THREE.BoxGeometry>(new THREE.BoxGeometry(1, 1, 1));

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const chunkManagerRef = useRef<ChunkManager | null>(null);
  const worldBlocksRef = useRef({
    has: (key: string) => {
      const [x, y, z] = key.split(',').map(Number);
      return chunkManagerRef.current?.hasBlock(x, y, z) ?? false;
    },
    get: (key: string) => {
      const [x, y, z] = key.split(',').map(Number);
      const name = chunkManagerRef.current?.getBlockName(x, y, z);
      if (!name || name === 'air') return undefined;
      return { type: name as BlockType, mesh: null as any };
    },
    forEach: (_callback: (val: { mesh: THREE.Mesh; type: BlockType }, key: string) => void) => {
      // Compatibility stub for any legacy iteration
    },
    set: () => {},
    delete: () => {},
  } as any);

  const highlightMeshRef = useRef<THREE.LineSegments | null>(null);
  const steveMeshRef = useRef<THREE.Group | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const worldGeneratedRef = useRef<boolean>(false);

  // References for in-hand item rendering & animations
  const firstPersonHeldRef = useRef<THREE.Mesh | null>(null);
  const thirdPersonHeldRef = useRef<THREE.Mesh | null>(null);
  const rightArmRef = useRef<THREE.Mesh | null>(null);
  const punchAnimRef = useRef<number>(0); // 0 to 1 for punching chop animation

  // Mobs and Items trackers
  interface CowMob {
    id: string;
    mesh: THREE.Group;
    x: number;
    y: number;
    z: number;
    targetX: number;
    targetZ: number;
    idleTimer: number;
    health: number;
    legFL: THREE.Mesh;
    legFR: THREE.Mesh;
    legBL: THREE.Mesh;
    legBR: THREE.Mesh;
    flashTimer: number;
  }

  interface DropItem {
    id: string;
    mesh: THREE.Group;
    x: number;
    y: number;
    z: number;
    type: 'beef';
  }

  const mobsRef = useRef<CowMob[]>([]);
  const dropsRef = useRef<DropItem[]>([]);

  // Resize handler
  const handleResize = useCallback(() => {
    const container = containerRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!container || !renderer || !camera) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }, []);

  // Fullscreen and Full-Viewport Mode State & Handlers
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = useCallback(async () => {
    try {
      const isCurrentlyFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );

      if (!isCurrentlyFs) {
        if (wrapperRef.current?.requestFullscreen) {
          await wrapperRef.current.requestFullscreen();
        } else if ((wrapperRef.current as any)?.webkitRequestFullscreen) {
          await (wrapperRef.current as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any)?.webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch {
      // In case browser or iframe security sandbox blocks native requestFullscreen, toggle CSS full viewport mode
      setIsFullscreen((prev) => !prev);
    }
    setTimeout(handleResize, 60);
    setTimeout(handleResize, 200);
  }, [handleResize]);

  // Sync with browser native fullscreenchange events
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );
      setIsFullscreen(isFs);
      setTimeout(handleResize, 60);
      setTimeout(handleResize, 250);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [handleResize]);

  // Toggle cursor free mode with Alt key
  const toggleCursorLock = useCallback(() => {
    if (document.pointerLockElement === containerRef.current) {
      altCursorActiveRef.current = true;
      setIsCursorFree(true);
      document.exitPointerLock?.();
      sound.playTone(440, 'sine', 0.04, 0.1);
    } else {
      altCursorActiveRef.current = false;
      setIsCursorFree(false);
      containerRef.current?.requestPointerLock?.();
      sound.playTone(550, 'sine', 0.04, 0.1);
    }
  }, []);

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
  const lastSafeYRef = useRef<number>(8);
  const lastPosXRef = useRef<number>(0);
  const lastPosZRef = useRef<number>(0);

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

    if (type === 'grass') {
      const topTex = generateMinecraftTexture('grass', 'top');
      const bottomTex = generateMinecraftTexture('grass', 'bottom');
      const sideTex = generateMinecraftTexture('grass', 'side');

      const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.95 });
      const bottomMat = new THREE.MeshStandardMaterial({ map: bottomTex, roughness: 0.9 });
      const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.9 });

      // Order of faces: Right, Left, Top, Bottom, Front, Back
      const mats = [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat];
      materialsCacheRef.current.set(type, mats);
      return mats;
    }

    if (type === 'wood' || type === 'birch') {
      const topTex = generateMinecraftTexture(type, 'top');
      const sideTex = generateMinecraftTexture(type, 'side');

      const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.9 });
      const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.9 });

      const mats = [sideMat, sideMat, topMat, topMat, sideMat, sideMat];
      materialsCacheRef.current.set(type, mats);
      return mats;
    }

    // Default single-texture blocks (Kırıktaş, Toprak, Yaprak, Elmas, Cam, Tuğla, TNT)
    const tex = generateMinecraftTexture(type);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: type === 'glass' ? 0.1 : 0.85,
      metalness: type === 'diamond' ? 0.35 : 0.05,
      transparent: type === 'glass' || type === 'leaves',
      opacity: type === 'glass' ? 0.65 : 1.0,
    });
    materialsCacheRef.current.set(type, mat);
    return mat;
  }, []);


  // Steve 3D Model Builder (feet positioned squarely at local y = 0.0)
  const createSteveMesh = () => {
    const steve = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ 
      map: skinTextureRef.current || new THREE.Texture(), 
      color: skinTextureRef.current ? 0xffffff : 0xcccccc,
    });
    const texW = 64; const texH = 32;

    // 1. Head
    const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    applyFaceUVs(headGeo, 4, 8, 8, 8, 8, texW, texH);
    applyFaceUVs(headGeo, 5, 24, 8, 8, 8, texW, texH);
    applyFaceUVs(headGeo, 0, 16, 8, 8, 8, texW, texH);
    applyFaceUVs(headGeo, 1, 0, 8, 8, 8, texW, texH);
    applyFaceUVs(headGeo, 2, 8, 0, 8, 8, texW, texH);
    applyFaceUVs(headGeo, 3, 16, 0, 8, 8, texW, texH);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.set(0, 2.8, 0); steve.add(head);

    // 2. Torso
    const torsoGeo = new THREE.BoxGeometry(0.8, 1.2, 0.4);
    applyFaceUVs(torsoGeo, 4, 20, 20, 8, 12, texW, texH);
    applyFaceUVs(torsoGeo, 5, 32, 20, 8, 12, texW, texH);
    applyFaceUVs(torsoGeo, 0, 28, 20, 4, 12, texW, texH);
    applyFaceUVs(torsoGeo, 1, 16, 20, 4, 12, texW, texH);
    applyFaceUVs(torsoGeo, 2, 20, 16, 8, 4, texW, texH);
    applyFaceUVs(torsoGeo, 3, 28, 16, 8, 4, texW, texH);
    const torso = new THREE.Mesh(torsoGeo, mat);
    torso.position.set(0, 1.8, 0); steve.add(torso);

    // 3. Arms/Legs
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), mat);
    armL.position.set(-0.6, 1.8, 0); steve.add(armL); steveArmLRef.current = armL;
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), mat);
    armR.position.set(0.6, 1.8, 0); steve.add(armR); rightArmRef.current = armR;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), mat);
    legL.position.set(-0.2, 0.6, 0); steve.add(legL); steveLegLRef.current = legL;
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), mat);
    legR.position.set(0.2, 0.6, 0); steve.add(legR); steveLegRRef.current = legR;

    return steve;
  };



  // Add a block to world using optimized ChunkManager
  const addBlock = useCallback((x: number, y: number, z: number, type: BlockType) => {
    chunkManagerRef.current?.setBlock(Math.round(x), Math.round(y), Math.round(z), type);
  }, []);

  // Remove/break block from world using optimized ChunkManager breakBlock
  const removeBlock = useCallback((x: number, y: number, z: number): BlockType | null => {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rz = Math.round(z);
    const broken = chunkManagerRef.current?.breakBlock(rx, ry, rz);
    if (!broken || broken === 'air') return null;
    return broken as BlockType;
  }, []);

  // Precision ground height detector: measures the exact top face of solid blocks using voxel data
  const getGroundHeightAt = useCallback((x: number, z: number, currentFeetY: number): number => {
    if (chunkManagerRef.current) {
      return chunkManagerRef.current.getGroundHeightAt(x, z, currentFeetY);
    }
    return -5.5;
  }, []);

  // Keep stable refs updated
  useEffect(() => {
    addBlockRef.current = addBlock;
    removeBlockRef.current = removeBlock;
  }, [addBlock, removeBlock]);


  const skinTextureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load('/textures/skin.png', (texture) => {
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      skinTextureRef.current = texture;
      console.log('Skin texture loaded and configured');
    });
  }, []);

  const applyFaceUVs = (geometry: THREE.BoxGeometry, faceIndex: number, x: number, y: number, w: number, h: number, texW: number, texH: number) => {
    const uvs = geometry.attributes.uv;
    const u0 = x / texW;
    const u1 = (x + w) / texW;
    const v0 = (texH - y - h) / texH;
    const v1 = (texH - y) / texH;
    
    // Each face has 4 vertices. Order: [0,0], [1,0], [0,1], [1,1]
    const base = faceIndex * 4;
    uvs.setXY(base, u0, v1);
    uvs.setXY(base + 1, u1, v1);
    uvs.setXY(base + 2, u0, v0);
    uvs.setXY(base + 3, u1, v0);
    uvs.needsUpdate = true;
  };


  // 3D Character Mesh Generator for remote players in the world
  const createNetworkPlayerMesh = useCallback((name: string, color: string, isHost: boolean) => {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ map: skinTextureRef.current || new THREE.Texture() });

    const texW = 64;
    const texH = 32;

    // 1. Head
    const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    applyFaceUVs(headGeo, 4, 8, 8, 8, 8, texW, texH); // Front
    applyFaceUVs(headGeo, 5, 24, 8, 8, 8, texW, texH); // Back
    applyFaceUVs(headGeo, 0, 16, 8, 8, 8, texW, texH); // Right
    applyFaceUVs(headGeo, 1, 0, 8, 8, 8, texW, texH);  // Left
    applyFaceUVs(headGeo, 2, 8, 0, 8, 8, texW, texH);  // Top
    applyFaceUVs(headGeo, 3, 16, 0, 8, 8, texW, texH); // Bottom
    const head = new THREE.Mesh(headGeo, mat);
    head.position.set(0, 2.8, 0);
    group.add(head);

    // 2. Torso
    const torsoGeo = new THREE.BoxGeometry(0.8, 1.2, 0.4);
    applyFaceUVs(torsoGeo, 4, 20, 20, 8, 12, texW, texH); // Front
    applyFaceUVs(torsoGeo, 5, 32, 20, 8, 12, texW, texH); // Back
    applyFaceUVs(torsoGeo, 0, 28, 20, 4, 12, texW, texH); // Right
    applyFaceUVs(torsoGeo, 1, 16, 20, 4, 12, texW, texH); // Left
    applyFaceUVs(torsoGeo, 2, 20, 16, 8, 4, texW, texH);  // Top
    applyFaceUVs(torsoGeo, 3, 28, 16, 8, 4, texW, texH); // Bottom
    const torso = new THREE.Mesh(torsoGeo, mat);
    torso.position.set(0, 1.8, 0);
    group.add(torso);

    // 3. Arms/Legs (simplified UVs)
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), mat);
    armL.position.set(-0.6, 1.8, 0);
    group.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), mat);
    armR.position.set(0.6, 1.8, 0);
    group.add(armR);

    const handSlot = new THREE.Group();
    handSlot.position.set(0, -0.5, 0.4);
    armR.add(handSlot);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), mat);
    legL.position.set(-0.2, 0.6, 0);
    group.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), mat);
    legR.position.set(0.2, 0.6, 0);
    group.add(legR);

    // 4. Name Tag & Collider
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.beginPath(); ctx.roundRect(8, 8, 240, 48, 8); ctx.fill();
      ctx.fillStyle = isHost ? '#fef08a' : '#ffffff';
      ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText((isHost ? '👑 ' : '') + name.slice(0, 15), 128, 32);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
    sprite.scale.set(2.4, 0.6, 1); sprite.position.set(0, 3.6, 0);
    group.add(sprite);

    const collider = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.8, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
    collider.position.set(0, 1.4, 0);
    group.add(collider);

    const origColors = { head: color, torso: color, arms: color, legs: color };

    return { group, collider, head, torso, armL, armR, legL, legR, handSlot, origColors };
  }, []);

  // Add or update remote player in scene
  const upsertRemotePlayer = useCallback((netPlayer: NetworkPlayer) => {
    const scene = sceneRef.current;
    if (!scene || netPlayer.id === multiplayerManager.myPlayerId) return;

    let rp = remotePlayersRef.current.get(netPlayer.id);
    if (!rp) {
      const isHostPlayer = !multiplayerManager.isHost;
      const meshData = createNetworkPlayerMesh(netPlayer.name, netPlayer.color, isHostPlayer);
      meshData.collider.userData = { isPlayerCollider: true, playerId: netPlayer.id, name: netPlayer.name };
      meshData.group.position.set(netPlayer.x, netPlayer.y, netPlayer.z);
      scene.add(meshData.group);

      rp = {
        id: netPlayer.id,
        name: netPlayer.name,
        color: netPlayer.color,
        group: meshData.group,
        collider: meshData.collider,
        head: meshData.head,
        torso: meshData.torso,
        armL: meshData.armL,
        armR: meshData.armR,
        legL: meshData.legL,
        legR: meshData.legR,
        handSlot: meshData.handSlot,
        currentHeldBlock: null,
        targetX: netPlayer.x,
        targetY: netPlayer.y,
        targetZ: netPlayer.z,
        targetYaw: netPlayer.yaw || 0,
        targetPitch: netPlayer.pitch || 0,
        walkTime: 0,
        punchTime: 0,
        damageFlashTimer: 0,
        origColors: meshData.origColors,
      };
      remotePlayersRef.current.set(netPlayer.id, rp);
    } else {
      rp.targetX = netPlayer.x;
      rp.targetY = netPlayer.y;
      rp.targetZ = netPlayer.z;
      if (netPlayer.yaw !== undefined) rp.targetYaw = netPlayer.yaw;
      if (netPlayer.pitch !== undefined) rp.targetPitch = netPlayer.pitch;
    }

    // Update held item if changed
    if (rp && rp.currentHeldBlock !== netPlayer.selectedBlock) {
      rp.currentHeldBlock = netPlayer.selectedBlock || null;
      while (rp.handSlot.children.length > 0) {
        rp.handSlot.remove(rp.handSlot.children[0]);
      }
      if (netPlayer.selectedBlock && netPlayer.selectedBlock in BLOCK_DEFS) {
        const mat = getBlockMaterial(netPlayer.selectedBlock as BlockType);
        const geo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
        const mesh = new THREE.Mesh(geo, mat);
        rp.handSlot.add(mesh);
      }
    }

    setConnectedPlayers((prev) => {
      const exists = prev.some((p) => p.id === netPlayer.id);
      if (exists) {
        return prev.map((p) => (p.id === netPlayer.id ? netPlayer : p));
      }
      return [...prev, netPlayer];
    });
  }, [createNetworkPlayerMesh, getBlockMaterial]);

  const removeRemotePlayer = useCallback((playerId: string) => {
    const scene = sceneRef.current;
    const rp = remotePlayersRef.current.get(playerId);
    if (rp && scene) {
      scene.remove(rp.group);
      remotePlayersRef.current.delete(playerId);
    }
    setConnectedPlayers((prev) => prev.filter((p) => p.id !== playerId));
  }, []);

  // Wire up real-time multiplayer network listeners
  useEffect(() => {
    multiplayerManager.onPlayerJoined = (player) => {
      upsertRemotePlayer(player);
      sound.playBonus();
    };

    multiplayerManager.onPlayerMoved = (player) => {
      upsertRemotePlayer(player);
    };

    multiplayerManager.onPlayerLeft = (id) => {
      removeRemotePlayer(id);
    };

    multiplayerManager.onPlayerPunched = (id) => {
      const rp = remotePlayersRef.current.get(id);
      if (rp) {
        rp.punchTime = 1.0;
        sound.playTone(280, 'sine', 0.05, 0.1);
      }
    };

    multiplayerManager.onPlayerHit = (hit) => {
      if (hit.targetId === multiplayerManager.myPlayerId) {
        // We got hit by another player!
        setHealth((h) => Math.max(0, h - hit.damage));
        setDamageVignette(true);
        setTimeout(() => setDamageVignette(false), 350);
        sound.playTone(160, 'sawtooth', 0.12, 0.35);

        // Apply knockback to local player
        playerPosRef.current.x += hit.knockX;
        playerPosRef.current.z += hit.knockZ;
        playerPosRef.current.vy = 0.28;
      } else {
        // Another player got hit!
        const rp = remotePlayersRef.current.get(hit.targetId);
        if (rp) {
          rp.damageFlashTimer = 0.5;
          rp.targetX += hit.knockX;
          rp.targetZ += hit.knockZ;
          sound.playTone(200, 'sawtooth', 0.08, 0.2);
        }
      }
    };

    multiplayerManager.onBlockPlaced = (event) => {
      addBlock(event.x, event.y, event.z, event.type as BlockType);
      sound.playTone(450, 'triangle', 0.06, 0.15);
    };

    multiplayerManager.onBlockBroken = (event) => {
      removeBlock(event.x, event.y, event.z);
      sound.playTone(320, 'sine', 0.06, 0.15);
    };

    multiplayerManager.onInitialWorldBlocks = (blocks) => {
      blocks.forEach((b) => {
        if (b.type === 'air') {
          removeBlock(b.x, b.y, b.z);
        } else if (b.type in BLOCK_DEFS) {
          addBlock(b.x, b.y, b.z, b.type as BlockType);
        }
      });
    };

    multiplayerManager.onChatMessage = (msg) => {
      setChatMessages((prev) => [...prev.slice(-30), msg]);
    };

    return () => {
      multiplayerManager.leaveRoom();
    };
  }, [upsertRemotePlayer, removeRemotePlayer, addBlock, removeBlock]);

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

  const breakBlockAt = useCallback((bx: number, by: number, bz: number) => {
    const minedType = removeBlock(bx, by, bz);
    if (minedType && minedType in BLOCK_DEFS) {
      sendBlockBreak(bx, by, bz);
      addToInventory(minedType);
      if (minedType === 'tnt') {
        explodeTnt(bx, by, bz);
      } else {
        sound.playTone(380, 'sine', 0.08, 0.2);
        setBlocksMined((b) => b + 1);
        if (minedType === 'diamond') {
          sound.playBonus();
          setDiamondsFound((d) => d + 1);
        }
        const pts = BLOCK_DEFS[minedType]?.scoreVal || 10;
        setScore((s) => {
          const newScore = s + pts;
          onUpdateHighScore(newScore);
          return newScore;
        });
      }
    }
  }, [removeBlock, sendBlockBreak, addToInventory, explodeTnt, onUpdateHighScore]);

  // Host a new online world
  const handleHostGame = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    const code = MinecraftMultiplayerManager.generateRoomCode();
    setGeneratedRoomCode(code);
    setRoomId(code);

    try {
      await multiplayerManager.hostGame(code, playerName, { x: 0, y: 8, z: 0 });
      setIsMultiplayerActive(true);
      setGameStarted(true);
      setIsConnecting(false);
      altCursorActiveRef.current = false;
      setIsCursorFree(false);
      containerRef.current?.requestPointerLock?.();
      sound.playBonus();
    } catch (err) {
      console.error(err);
      setConnectionError('Dünya kurulamadı. Lütfen tekrar deneyin.');
      setIsConnecting(false);
    }
  };

  // Join an existing online world
  const handleJoinGame = async (codeToJoin?: string) => {
    const code = (codeToJoin || joinCodeInput).trim().toUpperCase();
    if (!code) {
      setConnectionError('Lütfen geçerli bir Oda Kodu girin.');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      const ok = await multiplayerManager.joinGame(code, playerName, { x: 0, y: 8, z: 0 });
      if (!ok) {
        setConnectionError('Oda bulunamadı veya kapatılmış. Oda kodunu kontrol edin.');
        setIsConnecting(false);
        return;
      }
      setRoomId(code);
      setIsMultiplayerActive(true);
      setGameStarted(true);
      setIsConnecting(false);
      altCursorActiveRef.current = false;
      setIsCursorFree(false);
      containerRef.current?.requestPointerLock?.();
      sound.playBonus();
    } catch (err) {
      console.error(err);
      setConnectionError('Dünyaya bağlanırken hata oluştu.');
      setIsConnecting(false);
    }
  };

  const handleStartSoloGame = () => {
    setIsMultiplayerActive(false);
    setGameStarted(true);
    altCursorActiveRef.current = false;
    setIsCursorFree(false);
    containerRef.current?.requestPointerLock?.();
    sound.playBonus();
  };


  // Cow 3D Mesh Generator
  const createCowMesh = useCallback(() => {
    const cow = new THREE.Group();

    // Body
    const bodyTex = generateCowTexture('body');
    const bodyMat = new THREE.MeshStandardMaterial({ map: bodyTex, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 1.3), bodyMat);
    body.position.y = 0.85;
    cow.add(body);

    // Head
    const headTex = generateCowTexture('head');
    const headMat = new THREE.MeshStandardMaterial({ map: headTex, roughness: 0.8 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
    head.position.set(0, 1.25, -0.7);
    cow.add(head);

    // Snout
    const snoutMat = new THREE.MeshStandardMaterial({ color: '#f48fb1', roughness: 0.8 });
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.15), snoutMat);
    snout.position.set(0, 1.1, -0.95);
    cow.add(snout);

    // Horns
    const hornMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
    const hornL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), hornMat);
    hornL.position.set(-0.3, 1.55, -0.7);
    cow.add(hornL);

    const hornR = hornL.clone();
    hornR.position.x = 0.3;
    cow.add(hornR);

    // Legs
    const legTex = generateCowTexture('leg');
    const legMat = new THREE.MeshStandardMaterial({ map: legTex, roughness: 0.8 });
    
    const legFL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.24), legMat);
    legFL.position.set(-0.33, 0.3, -0.45);
    cow.add(legFL);

    const legFR = legFL.clone();
    legFR.position.x = 0.33;
    cow.add(legFR);

    const legBL = legFL.clone();
    legBL.position.z = 0.45;
    cow.add(legBL);

    const legBR = legFR.clone();
    legBR.position.z = 0.45;
    cow.add(legBR);

    return {
      group: cow,
      legFL,
      legFR,
      legBL,
      legBR,
    };
  }, []);

  // Spawn Cows across the world on the surface
  const spawnCows = useCallback((count: number) => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear existing
    mobsRef.current.forEach((mob) => scene.remove(mob.mesh));
    mobsRef.current = [];

    for (let i = 0; i < count; i++) {
      const rx = Math.floor(Math.random() * 28) - 14;
      const rz = Math.floor(Math.random() * 28) - 14;
      
      let ry = 8;
      for (let y = 20; y >= -10; y--) {
        if (chunkManagerRef.current?.hasBlock(rx, y, rz)) {
          ry = y + 1.0;
          break;
        }
      }

      const cowData = createCowMesh();
      cowData.group.position.set(rx, ry, rz);
      
      const mobId = `cow_${Math.random().toString(36).substr(2, 9)}`;
      cowData.group.name = mobId;
      scene.add(cowData.group);

      mobsRef.current.push({
        id: mobId,
        mesh: cowData.group,
        x: rx,
        y: ry,
        z: rz,
        targetX: rx + (Math.random() * 10 - 5),
        targetZ: rz + (Math.random() * 10 - 5),
        idleTimer: Math.random() * 6 + 2,
        health: 4,
        legFL: cowData.legFL,
        legFR: cowData.legFR,
        legBL: cowData.legBL,
        legBR: cowData.legBR,
        flashTimer: 0,
      });
    }
  }, [createCowMesh]);

  const spawnAdditionalCows = useCallback((count: number) => {
    const scene = sceneRef.current;
    if (!scene) return;

    for (let i = 0; i < count; i++) {
      const rx = Math.floor(Math.random() * 28) - 14;
      const rz = Math.floor(Math.random() * 28) - 14;
      
      let ry = 8;
      for (let y = 20; y >= -10; y--) {
        if (chunkManagerRef.current?.hasBlock(rx, y, rz)) {
          ry = y + 1.0;
          break;
        }
      }

      const cowData = createCowMesh();
      cowData.group.position.set(rx, ry, rz);
      
      const mobId = `cow_${Math.random().toString(36).substr(2, 9)}`;
      cowData.group.name = mobId;
      scene.add(cowData.group);

      mobsRef.current.push({
        id: mobId,
        mesh: cowData.group,
        x: rx,
        y: ry,
        z: rz,
        targetX: rx + (Math.random() * 10 - 5),
        targetZ: rz + (Math.random() * 10 - 5),
        idleTimer: Math.random() * 6 + 2,
        health: 4,
        legFL: cowData.legFL,
        legFR: cowData.legFR,
        legBL: cowData.legBL,
        legBR: cowData.legBR,
        flashTimer: 0,
      });
    }
  }, [createCowMesh]);

  // High-Performance Dynamic Procedural Voxel World Generator
  const generateWorld = useCallback((_worldSize?: number) => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (!chunkManagerRef.current) {
      chunkManagerRef.current = new ChunkManager({
        scene,
        renderDistance: settings.renderDistance,
        seed: 42,
        useWorker: true,
      });
    }

    // Pre-generate spawn region chunks immediately around (0, 0)
    chunkManagerRef.current.generateInitialArea(0, 0, Math.min(settings.renderDistance, 3));
  }, [settings.renderDistance]);

  // Initialize Three.js Scene, Camera, Renderer
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

    // 6. Highlight Selection Box
    const wireGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    const wireEdges = new THREE.EdgesGeometry(wireGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: '#000000', linewidth: 2 });
    const highlightBox = new THREE.LineSegments(wireEdges, wireMat);
    highlightBox.visible = false;
    scene.add(highlightBox);
    highlightMeshRef.current = highlightBox;

    // 6.5. Block Breaking Crack Animation Overlay Box
    const crackGeo = new THREE.BoxGeometry(1.04, 1.04, 1.04);
    const crackEdges = new THREE.EdgesGeometry(crackGeo);
    const crackMat = new THREE.LineBasicMaterial({ color: '#facc15', linewidth: 3, transparent: true, opacity: 0.9 });
    const crackBox = new THREE.LineSegments(crackEdges, crackMat);
    crackBox.visible = false;
    scene.add(crackBox);
    crackMeshRef.current = crackBox;

    // 7. Steve 3D mesh
    const steve = createSteveMesh();
    scene.add(steve);
    steveMeshRef.current = steve;

    // Resize
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (chunkManagerRef.current) {
        chunkManagerRef.current.dispose();
        chunkManagerRef.current = null;
      }
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [handleResize]); // Run only once, but depend on handleResize

  // Sync render distance dynamically when settings change
  useEffect(() => {
    if (chunkManagerRef.current) {
      chunkManagerRef.current.renderDistance = settings.renderDistance;
    }
  }, [settings.renderDistance]);

  // Trigger world generation when game starts (Optimized Smooth World)
  useEffect(() => {
    if (gameStarted && !worldGeneratedRef.current) {
      worldGeneratedRef.current = true;
      generateWorld(60); // Increased world size
      spawnCows(0); // No initial cows!
      
      // Spawn cows every 5 minutes
      const spawnInterval = setInterval(() => {
        spawnAdditionalCows(5);
      }, 5 * 60 * 1000);
      intervalRef.current = spawnInterval;

      // Position Steve right on top of the surface grass at (0, 0)
      let spawnY = 8;
      for (let y = 20; y >= -10; y--) {
        if (chunkManagerRef.current?.hasBlock(0, y, 0)) {
          spawnY = y + 0.5; // Exactly at the top surface of the grass block
          break;
        }
      }
      playerPosRef.current.x = 0;
      playerPosRef.current.y = spawnY;
      playerPosRef.current.z = 0;
      playerPosRef.current.vy = 0;

      // spawn update removed

      handleResize(); // Ensure renderer is resized when it becomes visible
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [gameStarted, generateWorld, spawnCows, handleResize]);

  // Update Held Block items in Player's Hand (First Person and Third Person)
  const updateHeldItems = useCallback(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene) return;

    // 1. First-Person View Held Block (attached directly to camera for movement sync)
    if (firstPersonHeldRef.current) {
      if (firstPersonHeldRef.current.parent) {
        firstPersonHeldRef.current.parent.remove(firstPersonHeldRef.current);
      }
      firstPersonHeldRef.current.geometry.dispose();
      firstPersonHeldRef.current = null;
    }

    if (camera && cameraView === 'first' && gameStarted && selectedBlock) {
      const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
      const mat = getBlockMaterial(selectedBlock);
      const mesh = new THREE.Mesh(geo, mat);
      
      // Position at bottom-right corner of camera
      mesh.position.set(0.26, -0.22, -0.42);
      mesh.rotation.set(0.18, -0.35, 0.08); // beautiful isometric hand holding angle
      camera.add(mesh);
      firstPersonHeldRef.current = mesh;
    }

    // 2. Third-Person View Held Block (attached to Steve's right hand armR)
    if (thirdPersonHeldRef.current) {
      if (thirdPersonHeldRef.current.parent) {
        thirdPersonHeldRef.current.parent.remove(thirdPersonHeldRef.current);
      }
      thirdPersonHeldRef.current.geometry.dispose();
      thirdPersonHeldRef.current = null;
    }

    if (rightArmRef.current && gameStarted) {
      if (selectedBlock) {
        const geo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
        const mat = getBlockMaterial(selectedBlock);
        const mesh = new THREE.Mesh(geo, mat);
        
        // Position at the very end of right hand
        mesh.position.set(0, -0.65, -0.15);
        rightArmRef.current.add(mesh);
        thirdPersonHeldRef.current = mesh;

        // Raise right arm forward to point / hold the block
        rightArmRef.current.rotation.x = -Math.PI / 3.5;
      } else {
        // Arm rests down naturally if holding nothing
        rightArmRef.current.rotation.x = 0;
      }
    }
  }, [selectedBlock, cameraView, gameStarted, getBlockMaterial]);

  // Synchronize held items on state change
  useEffect(() => {
    updateHeldItems();
  }, [selectedBlock, cameraView, gameStarted, updateHeldItems]);

  // Handle pointer lock changes for pause menu
  useEffect(() => {
    const handlePointerLockChange = () => {
      const isLocked = document.pointerLockElement === containerRef.current;
      if (!isLocked) {
        if (altCursorActiveRef.current) {
          // Intentionally unlocked via Alt key: free the cursor without pausing the game!
          setIsCursorFree(true);
        } else if (!isChatOpenRef.current && !showCraftingRef.current && gameStarted) {
          setIsPaused(true);
        }
      } else {
        altCursorActiveRef.current = false;
        setIsCursorFree(false);
        setIsPaused(false);
      }
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [gameStarted]);

  const resumeGame = useCallback(() => {
    altCursorActiveRef.current = false;
    setIsCursorFree(false);
    setIsPaused(false);
    containerRef.current?.requestPointerLock?.();
  }, []);

  // Pointer lock & Mouse click interactions (Left click mine, Right click place)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !gameStarted) return; // Only enable if game started

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

      // Trigger punch/swing animation on Left-Click
      if (e.button === 0) {
        punchAnimRef.current = 1.0;
      }

      // Handle eating raw beef on Right-Click at any time
      if (e.button === 2 && selectedBlock === 'beef') {
        e.preventDefault();
        const beefCount = inventoryRef.current['beef'] || 0;
        if (beefCount > 0) {
          removeFromInventory('beef');
          
          // Crunchy eating sounds
          sound.playTone(180, 'triangle', 0.05, 0.06);
          setTimeout(() => sound.playTone(140, 'triangle', 0.05, 0.06), 100);
          setTimeout(() => sound.playTone(160, 'triangle', 0.05, 0.06), 200);
          setTimeout(() => sound.playTone(220, 'sine', 0.08, 0.12), 300); // swallowing tone

          setHunger((h) => Math.min(20, h + 6)); // Restore 3 hunger shanks
          setHealth((h) => Math.min(20, h + 4)); // Restore 2 hearts (4 HP)
        } else {
          sound.playTone(200, 'sawtooth', 0.1, 0.1);
        }
        return;
      }

      // Raycast 7 blocks forward
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      raycaster.far = 7;

      const chunkMeshes = chunkManagerRef.current?.getActiveChunkMeshes() || [];

      const cowGroups = mobsRef.current.map((mob) => mob.mesh);

      const playerColliders: THREE.Mesh[] = [];
      remotePlayersRef.current.forEach((rp) => {
        if (rp.collider) playerColliders.push(rp.collider);
      });

      // Raycast against other players (PVP), mobs (cows), and world chunk meshes
      const intersectsPlayers = raycaster.intersectObjects(playerColliders, false);
      const intersectsCows = raycaster.intersectObjects(cowGroups, true);
      const intersectsBlocks = raycaster.intersectObjects(chunkMeshes, false);

      const hitPlayer = intersectsPlayers.length > 0 ? intersectsPlayers[0] : null;
      const hitCow = intersectsCows.length > 0 ? intersectsCows[0] : null;
      const hitBlock = intersectsBlocks.length > 0 ? intersectsBlocks[0] : null;

      // 1. PVP ATTACK ON OTHER PLAYERS (LEFT CLICK)
      if (hitPlayer && (!hitBlock || hitPlayer.distance < hitBlock.distance) && (!hitCow || hitPlayer.distance < hitCow.distance)) {
        if (e.button === 0) {
          punchAnimRef.current = 1.0;
          sendPlayerPunch();

          const targetPlayerId = hitPlayer.object.userData.playerId;
          const targetRp = remotePlayersRef.current.get(targetPlayerId);

          if (targetRp) {
            // Directional knockback away from attacker
            const angle = playerPosRef.current.yaw;
            const knockX = -Math.sin(angle) * 1.5;
            const knockZ = -Math.cos(angle) * 1.5;

            // Transmit PVP hit across network (Socket.io playerHit)
            multiplayerManager.sendHitPlayer(targetPlayerId, 4, knockX, knockZ);

            // Immediate responsive feedback on local client
            targetRp.damageFlashTimer = 0.5;
            targetRp.targetX += knockX;
            targetRp.targetZ += knockZ;
            sound.playTone(160, 'sawtooth', 0.1, 0.35);

            setScore((s) => {
              const newScore = s + 10;
              onUpdateHighScore(newScore);
              return newScore;
            });
          }
        }
        return;
      }

      // 2. ATTACK COW MOB IF CLOSER THAN THE NEAREST BLOCK
      if (hitCow && (!hitBlock || hitCow.distance < hitBlock.distance)) {
        if (e.button === 0) {
          punchAnimRef.current = 1.0;
          sendPlayerPunch();

          const hitSubmesh = hitCow.object;
          let parentGroup: THREE.Object3D | null = hitSubmesh;
          while (parentGroup && !parentGroup.name.startsWith('cow_') && parentGroup.parent !== scene) {
            parentGroup = parentGroup.parent;
          }

          const cowMob = mobsRef.current.find((mob) => mob.mesh === parentGroup || mob.id === parentGroup?.name);
          if (cowMob) {
            // Damage cow
            cowMob.health -= 1;
            cowMob.flashTimer = 0.45; // flash red
            sound.playTone(180, 'sawtooth', 0.12, 0.2); // Cow hurt sound

            // Knockback effect
            const pushForce = 0.8;
            const angle = camera.rotation.y;
            cowMob.targetX -= Math.sin(angle) * pushForce;
            cowMob.targetZ -= Math.cos(angle) * pushForce;

            // Check if cow died
            if (cowMob.health <= 0) {
              sound.playTone(120, 'sine', 0.25, 0.4); // Cow death sound

              // Spawn spinning raw beef drop item
              const beefGroup = new THREE.Group();
              const beefMat = getBlockMaterial('beef');
              const beefMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.1), beefMat);
              beefGroup.add(beefMesh);
              beefGroup.position.set(cowMob.x, cowMob.y, cowMob.z);
              scene.add(beefGroup);

              dropsRef.current.push({
                id: `drop_${Math.random().toString(36).substr(2, 9)}`,
                mesh: beefGroup,
                x: cowMob.x,
                y: cowMob.y,
                z: cowMob.z,
                type: 'beef',
              });

              // Clean up cow mesh
              scene.remove(cowMob.mesh);
              mobsRef.current = mobsRef.current.filter((mob) => mob.id !== cowMob.id);

              setScore((s) => {
                const newScore = s + 50; // Kill reward
                onUpdateHighScore(newScore);
                return newScore;
              });
            }
          }
        }
        return;
      }

      // 3. BLOCKS INTERACTIONS (ONLY IF WE ARE NOT INTERACTING WITH A PLAYER OR COW)
      if (!hitBlock || !hitBlock.face) return;

      const hitNormal = hitBlock.face.normal;
      const inward = hitBlock.point.clone().sub(hitNormal.clone().multiplyScalar(0.4));
      const bx = Math.round(inward.x);
      const by = Math.round(inward.y);
      const bz = Math.round(inward.z);

      if (e.button === 0) {
        // LEFT CLICK: START HOLD-TO-MINE SURVIVAL BLOCK
        punchAnimRef.current = 1.0;
        sendPlayerPunch();

        const blockType = (chunkManagerRef.current?.getBlockName(bx, by, bz) as BlockType) || 'dirt';

        isMouseDownLeftRef.current = true;
        miningBlockRef.current = {
          x: bx,
          y: by,
          z: bz,
          type: blockType,
          progress: 0,
          totalTime: BLOCK_BREAK_TIMES[blockType] || 0.8,
        };
        setMiningProgress(0.01);
      } else if (e.button === 2) {
        // RIGHT CLICK: PLACE SELECTED BLOCK ON FACE
        e.preventDefault();
        punchAnimRef.current = 1.0;

        const normal = hitBlock.face ? hitBlock.face.normal : new THREE.Vector3(0, 1, 0);
        const px = bx + Math.round(normal.x);
        const py = by + Math.round(normal.y);
        const pz = bz + Math.round(normal.z);

        // Physics check: prevent blocks from floating in mid-air (must connect to an existing block or ground)
        const cm = chunkManagerRef.current;
        const hasSupport = py <= -6 ||
          (cm?.hasBlock(px, py - 1, pz) ?? false) ||
          (cm?.hasBlock(px, py + 1, pz) ?? false) ||
          (cm?.hasBlock(px + 1, py, pz) ?? false) ||
          (cm?.hasBlock(px - 1, py, pz) ?? false) ||
          (cm?.hasBlock(px, py, pz + 1) ?? false) ||
          (cm?.hasBlock(px, py, pz - 1) ?? false);

        if (!hasSupport) {
          sound.playTone(180, 'sawtooth', 0.08, 0.1);
          return;
        }

        // Don't place inside player
        const player = playerPosRef.current;
        if (Math.hypot(px - player.x, pz - player.z) <= 0.6 && Math.abs(py - player.y) <= 1.8) {
          return;
        }

        if (removeFromInventory(selectedBlock)) { // Remove from inventory
          addBlock(px, py, pz, selectedBlock!);
          sendBlockPlace(px, py, pz, selectedBlock!);
          sendPlayerPunch();
          sound.playTone(450, 'triangle', 0.07, 0.2);
          setBlocksPlaced((p) => p + 1);
          setScore((s) => {
            const newScore = s + 5;
            onUpdateHighScore(newScore);
            return newScore;
          });
        } else {
          sound.playTone(200, 'sawtooth', 0.1, 0.1); // No block sound
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDownLeftRef.current = false;
        miningBlockRef.current = null;
        setMiningProgress(0);
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    const handleClick = () => {
      if (document.pointerLockElement !== container) {
        altCursorActiveRef.current = false;
        setIsCursorFree(false);
        container.requestPointerLock?.();
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('click', handleClick);
    };
  }, [gameStarted, addBlock, removeBlock, explodeTnt, selectedBlock, onUpdateHighScore, sendBlockBreak, sendBlockPlace, sendPlayerPunch]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If chat is open, allow typing and only handle Escape
      if (isChatOpenRef.current) {
        if (e.key === 'Escape') {
          setIsChatOpen(false);
          containerRef.current?.requestPointerLock?.();
        }
        return;
      }

      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysRef.current.w = true;
      if (k === 's' || e.key === 'ArrowDown') keysRef.current.s = true;
      if (k === 'a' || e.key === 'ArrowLeft') keysRef.current.a = true;
      if (k === 'd' || e.key === 'ArrowRight') keysRef.current.d = true;
      if (e.code === 'Space') {
        e.preventDefault();
        keysRef.current.space = true;
      }

      // Hotbar selection keys 1 - 8
      const num = parseInt(k, 10);
      if (num >= 1 && num <= 8) {
        setSelectedBlock(hotbarSlotsRef.current[num - 1]);
        sound.playTone(520, 'sine', 0.05, 0.15);
      }

      // Camera view toggle
      if (k === 'c' || e.key === 'F5') {
        e.preventDefault();
        setCameraView((v) => (v === 'first' ? 'third' : 'first'));
      }
      // Crafting menu toggle
      if (k === 'e') {
        e.preventDefault();
        setShowCrafting((prev) => !prev);
      }
      // Fullscreen mode toggle
      if (k === 'f' || e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
      // Chat toggle [T] or [Enter]
      if ((k === 't' || e.key === 'Enter') && !showCrafting && !isPaused) {
        e.preventDefault();
        setIsChatOpen(true);
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
      // Player list toggle [TAB]
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowPlayerList((prev) => !prev);
      }
      // Alt key cursor release/lock toggle [Alt]
      if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight' || e.key === 'AltGraph') {
        e.preventDefault();
        toggleCursorLock();
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
  }, [toggleFullscreen, toggleCursorLock]);

  // Main Minecraft Game Loop & Voxel Physics
  useEffect(() => {
    if (!gameStarted) return;
    let lastTime = performance.now();

    const animate = () => {
      const camera = cameraRef.current;
      const scene = sceneRef.current;
      const renderer = rendererRef.current;

      if (isPaused) {
        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
        animationFrameIdRef.current = requestAnimationFrame(animate);
        return;
      }

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      
      // Optimization: Dynamic Chunk Manager update (streaming, prediction & disposal)
      if (chunkManagerRef.current) {
        const p = playerPosRef.current;
        const vx = (p.x - lastPosXRef.current) / Math.max(dt, 0.001);
        const vz = (p.z - lastPosZRef.current) / Math.max(dt, 0.001);
        lastPosXRef.current = p.x;
        lastPosZRef.current = p.z;
        chunkManagerRef.current.update(p.x, p.z, vx, vz);
      }

      const crack = crackMeshRef.current;

      // Block mining continuous progress update
      if (isMouseDownLeftRef.current && miningBlockRef.current && camera) {
        _raycaster.setFromCamera(_screenCenter, camera);
        _raycaster.far = 7;

        const chunkMeshes = chunkManagerRef.current?.getActiveChunkMeshes() || [];
        const intersectsBlocks = _raycaster.intersectObjects(chunkMeshes, false);
        const hitBlock = intersectsBlocks.length > 0 ? intersectsBlocks[0] : null;

        if (hitBlock && hitBlock.face) {
          const hitNormal = hitBlock.face.normal;
          const inward = hitBlock.point.clone().sub(hitNormal.clone().multiplyScalar(0.4));
          const bx = Math.round(inward.x);
          const by = Math.round(inward.y);
          const bz = Math.round(inward.z);

          const mb = miningBlockRef.current;
          if (bx === mb.x && by === mb.y && bz === mb.z) {
            mb.progress += dt;
            setMiningProgress(mb.progress / mb.totalTime);

            // Update crack animation overlay wireframe on the block being mined
            if (crack) {
              crack.position.set(bx, by, bz);
              crack.visible = true;
              const ratio = mb.progress / mb.totalTime;
              const mat = crack.material as THREE.LineBasicMaterial;
              if (mat) {
                if (ratio > 0.75) {
                  mat.color.set('#ef4444'); // Red / about to break
                } else if (ratio > 0.4) {
                  mat.color.set('#f97316'); // Orange / cracking
                } else {
                  mat.color.set('#facc15'); // Yellow / starting crack
                }
                const wobble = 1.04 + Math.sin(now * 0.04) * 0.04 * ratio;
                crack.scale.set(wobble, wobble, wobble);
              }
            }

            if (now - lastMineSoundTimeRef.current > 250) {
              lastMineSoundTimeRef.current = now;
              sound.playTone(280 + Math.random() * 60, 'sawtooth', 0.04, 0.05);
            }

            if (mb.progress >= mb.totalTime) {
              if (crack) crack.visible = false;
              breakBlockAt(bx, by, bz);
              miningBlockRef.current = null;
              setMiningProgress(0);
            }
          } else {
            if (crack) crack.visible = false;
            miningBlockRef.current = null;
            setMiningProgress(0);
          }
        } else {
          if (crack) crack.visible = false;
          miningBlockRef.current = null;
          setMiningProgress(0);
        }
      } else {
        if (crack) crack.visible = false;
        if (miningProgress > 0) {
          setMiningProgress(0);
        }
      }

      // 1. Update Cow Mobs AI and legs animations
      const mobs = mobsRef.current;
      const sceneInstance = sceneRef.current;
      const time = now * 0.003; // For swing animations

      mobs.forEach((mob) => {
        // AI Pathfinding & Movement
        mob.idleTimer -= dt;
        if (mob.idleTimer <= 0) {
          // Select new random walk target within bounds
          mob.targetX = mob.x + (Math.random() * 12 - 6);
          mob.targetZ = mob.z + (Math.random() * 12 - 6);
          mob.idleTimer = Math.random() * 6 + 3;
        }

        // Damage flash timer
        if (mob.flashTimer > 0) {
          mob.flashTimer -= dt;
          // Set to reddish color
          mob.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const mat = child.material;
              if (mat) {
                if (Array.isArray(mat)) {
                  mat.forEach((m: any) => m.color?.setHex(0xff3333));
                } else {
                  (mat as any).color?.setHex(0xff3333);
                }
              }
            }
          });
        } else {
          // Reset material colors to white
          mob.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const mat = child.material;
              if (mat) {
                if (Array.isArray(mat)) {
                  mat.forEach((m: any) => m.color?.setHex(0xffffff));
                } else {
                  (mat as any).color?.setHex(0xffffff);
                }
              }
            }
          });
        }

        // Movement step towards target
        const dx = mob.targetX - mob.x;
        const dz = mob.targetZ - mob.z;
        const dist = Math.hypot(dx, dz);

        let isWalking = false;
        if (dist > 0.2) {
          isWalking = true;
          const speed = 1.2; // slow cute cow pace
          const moveStepX = (dx / dist) * speed * dt;
          const moveStepZ = (dz / dist) * speed * dt;
          
          mob.x += moveStepX;
          mob.z += moveStepZ;

          // Align rotation with direction of walk
          const angle = Math.atan2(dx, dz);
          mob.mesh.rotation.y = angle + Math.PI;
        }

        // Snap cow perfectly on top of physical terrain
        const cowGround = getGroundHeightAt(mob.x, mob.z, mob.y);
        mob.y = THREE.MathUtils.lerp(mob.y, cowGround, 0.25);
        mob.mesh.position.set(mob.x, mob.y, mob.z);

        // swing legs
        if (isWalking) {
          const swing = Math.sin(time * 4) * 0.45;
          mob.legFL.rotation.x = swing;
          mob.legFR.rotation.x = -swing;
          mob.legBL.rotation.x = -swing;
          mob.legBR.rotation.x = swing;
        } else {
          mob.legFL.rotation.x = 0;
          mob.legFR.rotation.x = 0;
          mob.legBL.rotation.x = 0;
          mob.legBR.rotation.x = 0;
        }
      });

      // 2. Update Spinning/Bobbing Beef drops
      const drops = dropsRef.current;
      const playerPos = playerPosRef.current;

      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        
        drop.mesh.rotation.y += 1.8 * dt;
        drop.mesh.position.y = drop.y + Math.sin(now * 0.005) * 0.08;

        const distToPlayer = Math.hypot(drop.x - playerPos.x, drop.z - playerPos.z);
        const verticalDist = Math.abs(drop.y - playerPos.y);

        if (distToPlayer < 1.1 && verticalDist < 1.8) {
          // Pickup drop!
          addToInventory('beef');
          sound.playTone(600, 'sine', 0.05, 0.1);
          
          if (sceneInstance) {
            sceneInstance.remove(drop.mesh);
          }
          drops.splice(i, 1);
        }
      }

      // Singleplayer mode

      const pos = playerPosRef.current;
      const keys = keysRef.current;
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

        const stepX = (dx * cosYaw + dz * sinYaw) * moveSpeed * dt;
        const stepZ = (dz * cosYaw - dx * sinYaw) * moveSpeed * dt;

        const nextX = pos.x + stepX;
        const nextZ = pos.z + stepZ;

        const cm = chunkManagerRef.current;
        // Check if destination chunk is ready before crossing
        const isTargetLoaded = cm ? (cm.isChunkReadyAt(nextX, pos.z) && cm.isChunkReadyAt(pos.x, nextZ)) : true;

        if (isTargetLoaded) {
          const isSolid = (x: number, y: number, z: number) => {
            return cm?.hasBlock(Math.round(x), Math.round(y), Math.round(z)) ?? false;
          };

          const feetBlockY = Math.round(pos.y);
          const headBlockY = Math.round(pos.y + 1.5);

          const collidesX = isSolid(nextX, feetBlockY, pos.z) || isSolid(nextX, headBlockY, pos.z);
          const collidesZ = isSolid(pos.x, feetBlockY, nextZ) || isSolid(pos.x, headBlockY, nextZ);

          if (!collidesX) pos.x = nextX;
          if (!collidesZ) pos.z = nextZ;
        } else {
          // Destination chunk is generating: slide only along loaded boundaries
          if (cm?.isChunkReadyAt(nextX, pos.z)) {
            const feetBlockY = Math.round(pos.y);
            const headBlockY = Math.round(pos.y + 1.5);
            if (!cm.hasBlock(Math.round(nextX), feetBlockY, Math.round(pos.z)) &&
                !cm.hasBlock(Math.round(nextX), headBlockY, Math.round(pos.z))) {
              pos.x = nextX;
            }
          }
          if (cm?.isChunkReadyAt(pos.x, nextZ)) {
            const feetBlockY = Math.round(pos.y);
            const headBlockY = Math.round(pos.y + 1.5);
            if (!cm.hasBlock(Math.round(pos.x), feetBlockY, Math.round(nextZ)) &&
                !cm.hasBlock(Math.round(pos.x), headBlockY, Math.round(nextZ))) {
              pos.z = nextZ;
            }
          }
        }
      }

      // Voxel Ground Collision & Loading Safety Net Check
      const groundInfo = chunkManagerRef.current
        ? chunkManagerRef.current.getGroundHeightResult(pos.x, pos.z, pos.y)
        : { groundY: -5.5, isLoaded: true, isSolid: false };

      const groundY = groundInfo.groundY;

      // SAFETY NET: If the chunk beneath player is loading or not ready:
      if (!groundInfo.isLoaded) {
        // Freeze downward vertical velocity to eliminate falling through
        if (pos.vy < 0) pos.vy = 0;
        pos.isJumping = false;
        // Hold player safely suspended at safe height until chunk is ready
        pos.y = Math.max(pos.y, lastSafeYRef.current);
      } else {
        // Chunk is loaded: update last safe solid ground
        if (groundInfo.isSolid) {
          lastSafeYRef.current = groundY;
        }

        // Jump (only allow if standing firmly on ground)
        if (keys.space && !pos.isJumping && pos.y <= groundY + 0.08) {
          pos.isJumping = true;
          pos.vy = 8.5;
          sound.playTone(400, 'triangle', 0.08, 0.15);
        }

        // Apply vertical velocity & gravity
        pos.y += pos.vy * dt;
        pos.vy -= 24 * dt; // gravity
        pos.vy = Math.max(pos.vy, -32); // Terminal velocity clamp

        // Solid ground contact collision: prevent falling below ground
        if (pos.y <= groundY) {
          pos.y = groundY;
          pos.isJumping = false;
          pos.vy = 0;
        }
      }

      // Void protection (respawn on surface if fallen into void)
      if (pos.y < -20) {
        pos.x = 0;
        pos.y = 12;
        pos.z = 0;
        pos.vy = 0;
      }

      // Update Highlight Selection Box
      if (camera && highlight) {
        _raycaster.setFromCamera(_screenCenter, camera);
        _raycaster.far = 7;

        const chunkMeshes = chunkManagerRef.current?.getActiveChunkMeshes() || [];
        const intersects = _raycaster.intersectObjects(chunkMeshes, false);
        if (intersects.length > 0 && intersects[0].face) {
          const hit = intersects[0];
          const hitNormal = hit.face!.normal;
          const inward = hit.point.clone().sub(hitNormal.clone().multiplyScalar(0.4));
          highlight.position.set(Math.round(inward.x), Math.round(inward.y), Math.round(inward.z));
          highlight.visible = true;
        } else {
          highlight.visible = false;
        }
      }

      // Update Steve Model (visible in third person, feet rest squarely at pos.y)
      if (steve) {
        steve.position.set(pos.x, pos.y, pos.z);
        steve.rotation.y = pos.yaw;
        steve.visible = cameraView === 'third';
      }

      // 3. Animate Hand-Held Items & Swinging
      if (firstPersonHeldRef.current && cameraView === 'first') {
        if (punchAnimRef.current > 0) {
          punchAnimRef.current = Math.max(0, punchAnimRef.current - dt * 6.5);
        }
        
        // Walk bobbing effect (slight sinusoidal wobble of the hand)
        const isWalking = dx !== 0 || dz !== 0;
        const bobX = isWalking ? Math.sin(now * 0.012) * 0.015 : 0;
        const bobY = isWalking ? Math.cos(now * 0.024) * 0.012 : 0;

        // Click swing offset math
        const swing = Math.sin(punchAnimRef.current * Math.PI) * 0.45;

        // Position holding offsets (right-bottom corner + walk bobbing + strike swing)
        firstPersonHeldRef.current.position.set(
          0.26 + bobX - swing * 0.18, 
          -0.22 + bobY - swing * 0.18, 
          -0.42 + swing * 0.1
        );

        // Rotation angles: tilt isometric + rapid strike downward rotation
        firstPersonHeldRef.current.rotation.set(
          0.18 + swing * 1.3, 
          -0.35 - swing * 0.5, 
          0.08 - swing * 0.8
        );
      }

      if (steve && cameraView === 'third') {
        const isWalking = dx !== 0 || dz !== 0;
        if (isWalking) {
          const legSwing = Math.sin(now * 0.012) * 0.65;
          if (steveLegLRef.current) steveLegLRef.current.rotation.x = legSwing;
          if (steveLegRRef.current) steveLegRRef.current.rotation.x = -legSwing;
          if (steveArmLRef.current) steveArmLRef.current.rotation.x = -legSwing;
        } else {
          if (steveLegLRef.current) steveLegLRef.current.rotation.x = 0;
          if (steveLegRRef.current) steveLegRRef.current.rotation.x = 0;
          if (steveArmLRef.current) steveArmLRef.current.rotation.x = 0;
        }

        if (rightArmRef.current) {
          if (punchAnimRef.current > 0) {
            punchAnimRef.current = Math.max(0, punchAnimRef.current - dt * 6.5);
            const swing = Math.sin(punchAnimRef.current * Math.PI);
            rightArmRef.current.rotation.x = -Math.PI / 3.5 - swing * 1.2;
          } else if (isWalking) {
            rightArmRef.current.rotation.x = -Math.PI / 3.5 + Math.sin(now * 0.012) * 0.15;
          } else {
            rightArmRef.current.rotation.x = -Math.PI / 3.5;
          }
        }
      }

      // Camera view toggle can now also update held items
      // Update Camera Position
      if (camera) {
        camera.rotation.order = 'YXZ';
        camera.rotation.y = pos.yaw;
        camera.rotation.x = pos.pitch;

        if (cameraView === 'first') {
          // Eye level is 1.62 blocks above the feet
          camera.position.set(pos.x, pos.y + 1.62, pos.z);
        } else {
          // Third-person chase camera behind Steve
          const dist = 3.8;
          const camX = pos.x + Math.sin(pos.yaw) * dist;
          const camZ = pos.z + Math.cos(pos.yaw) * dist;
          camera.position.set(camX, pos.y + 1.8, camZ);
        }
      }

      // 8. Remote multiplayer players lerp interpolation and animation
      remotePlayersRef.current.forEach((rp) => {
        // 1. Smooth horizontal position lerp
        rp.group.position.x += (rp.targetX - rp.group.position.x) * 0.28;
        rp.group.position.z += (rp.targetZ - rp.group.position.z) * 0.28;

        // 2. Continuous Gravity & Ground Collision for Remote Players
        // Measure the solid ground height right beneath the remote player's current X, Z coordinates
        const rpGroundY = getGroundHeightAt(
          rp.group.position.x,
          rp.group.position.z,
          Math.max(rp.group.position.y, rp.targetY)
        );

        // Detect if remote player is actively in mid-air (jumping or free-falling)
        const isAirborne = rp.targetY > rpGroundY + 0.12;

        if (isAirborne) {
          // Smoothly interpolate vertical position during jumps/falls
          rp.group.position.y += (rp.targetY - rp.group.position.y) * 0.32;
          // Physics clamp: cannot fall through solid ground below them
          if (rp.group.position.y < rpGroundY) {
            rp.group.position.y = rpGroundY;
          }
        } else {
          // Grounded: smoothly snap feet directly to the top face of the ground blocks
          // This ensures characters stand firmly on the ground with ZERO hovering!
          rp.group.position.y = THREE.MathUtils.lerp(rp.group.position.y, rpGroundY, 0.35);
          if (Math.abs(rp.group.position.y - rpGroundY) < 0.015) {
            rp.group.position.y = rpGroundY;
          }
        }

        // Smooth rotation lerp
        let diffYaw = rp.targetYaw - rp.group.rotation.y;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        rp.group.rotation.y += diffYaw * 0.25;

        // Head pitch look
        rp.head.rotation.x = rp.targetPitch || 0;

        // Damage Flash Effect on remote players
        if (rp.damageFlashTimer > 0) {
          rp.damageFlashTimer -= dt;
          const flashColor = 0xff3333;
          (rp.head.material as THREE.MeshStandardMaterial).color.setHex(flashColor);
          (rp.torso.material as THREE.MeshStandardMaterial).color.setHex(flashColor);
          (rp.armL.material as THREE.MeshStandardMaterial).color.setHex(flashColor);
          (rp.armR.material as THREE.MeshStandardMaterial).color.setHex(flashColor);
          (rp.legL.material as THREE.MeshStandardMaterial).color.setHex(flashColor);
          (rp.legR.material as THREE.MeshStandardMaterial).color.setHex(flashColor);
        } else {
          (rp.head.material as THREE.MeshStandardMaterial).color.set(rp.origColors.head);
          (rp.torso.material as THREE.MeshStandardMaterial).color.set(rp.origColors.torso);
          (rp.armL.material as THREE.MeshStandardMaterial).color.set(rp.origColors.arms);
          (rp.armR.material as THREE.MeshStandardMaterial).color.set(rp.origColors.arms);
          (rp.legL.material as THREE.MeshStandardMaterial).color.set(rp.origColors.legs);
          (rp.legR.material as THREE.MeshStandardMaterial).color.set(rp.origColors.legs);
        }

        // Walk swing animation
        const isMoving = Math.hypot(rp.targetX - rp.group.position.x, rp.targetZ - rp.group.position.z) > 0.01;
        if (isMoving) {
          rp.walkTime += dt * 8;
          const legSwing = Math.sin(rp.walkTime) * 0.55;
          rp.legL.rotation.x = legSwing;
          rp.legR.rotation.x = -legSwing;
          rp.armL.rotation.x = -legSwing;
          if (rp.punchTime <= 0) {
            rp.armR.rotation.x = legSwing;
          }
        } else {
          rp.legL.rotation.x = 0;
          rp.legR.rotation.x = 0;
          rp.armL.rotation.x = 0;
          if (rp.punchTime <= 0) {
            rp.armR.rotation.x = 0;
          }
        }

        // Punch swing animation
        if (rp.punchTime > 0) {
          rp.punchTime = Math.max(0, rp.punchTime - dt * 6.5);
          const swing = Math.sin(rp.punchTime * Math.PI);
          rp.armR.rotation.x = -Math.PI / 3 - swing * 1.2;
        }
      });

      // Periodic broadcast of our local player state (25 times per second)
      if (isMultiplayerActive && now - lastNetworkSendRef.current > 40) {
        lastNetworkSendRef.current = now;
        multiplayerManager.sendPlayerPosition(
          pos.x,
          pos.y,
          pos.z,
          pos.yaw,
          pos.pitch,
          pos.vy !== 0,
          selectedBlockRef.current
        );
      }

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
  }, [gameStarted, cameraView, selectedBlock, score, isPaused, isMultiplayerActive]);

  return (
    <div
      ref={wrapperRef}
      className={`select-none transition-all duration-200 ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen bg-slate-950 overflow-hidden rounded-none border-none shadow-none'
          : 'relative w-full aspect-16/10 sm:aspect-16/9 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl'
      }`}
    >
      {/* 3D WebGL Canvas */}
      <div
        ref={containerRef}
        className={`w-full h-full ${isCursorFree ? 'cursor-default' : 'cursor-crosshair'} ${gameStarted ? '' : 'hidden'}`}
      />

      {/* Red Hurt Damage Screen Flash Vignette */}
      {damageVignette && (
        <div className="absolute inset-0 bg-rose-600/35 pointer-events-none z-30 animate-pulse transition-opacity duration-150 ring-inset ring-8 ring-rose-500/80" />
      )}

      {/* Floating Tam Ekran / Full Mod Button */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Tam Ekrandan Çık (F / Esc)' : 'Tam Ekran Modu (F / F11)'}
        className="absolute top-3 right-3 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg border border-slate-700/80 shadow-lg backdrop-blur-md font-sans text-xs transition-all active:scale-95 cursor-pointer pointer-events-auto"
      >
        {isFullscreen ? (
          <>
            <Minimize className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">Normal Ekran</span>
          </>
        ) : (
          <>
            <Maximize className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">Tam Ekran</span>
          </>
        )}
      </button>

      {/* Start Screen with Multiplayer Room System */}
      {!gameStarted && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-950/90 via-slate-950 to-slate-950 flex flex-col items-center justify-center z-50 p-4 border border-purple-500/20 rounded-2xl overflow-y-auto shadow-2xl">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] pointer-events-none" />

          {/* Minecraft Title block */}
          <div className="relative mb-5 text-center select-none scale-90 sm:scale-100 z-10">
            <h1 className="font-arcade text-4xl sm:text-5xl md:text-6xl text-slate-200 drop-shadow-[0_4px_0_rgba(0,0,0,0.85)] tracking-wider">
              MINECRAFT
            </h1>
            <div className="font-arcade text-[10px] text-emerald-400 mt-1 tracking-widest uppercase flex items-center justify-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              ONLINE ÇOK OYUNCULU SÜRÜM
            </div>
            {/* Pulsing Splash Text */}
            <div className="absolute -bottom-2 -right-4 rotate-[-12deg] font-arcade text-[11px] text-yellow-300 drop-shadow-[0_2px_0_rgba(0,0,0,1)] animate-bounce select-none">
              Online Multiplayer!
            </div>
          </div>

          {/* Main Card */}
          <div className="w-full max-w-md bg-slate-900/90 border-2 border-t-[#8a8a8a] border-l-[#8a8a8a] border-b-[#2a2a2a] border-r-[#2a2a2a] p-5 shadow-2xl z-10 flex flex-col items-center">
            {/* Player Name Input */}
            <div className="w-full mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-arcade text-slate-300">OYUNCU KULLANICI ADI:</span>
                <span className="text-[9px] font-mono text-emerald-400">● Çevrimiçi</span>
              </div>
              <input
                type="text"
                maxLength={20}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Steve..."
                className="w-full px-3 py-2 bg-slate-950 border-2 border-t-slate-700 border-l-slate-700 border-b-slate-500 border-r-slate-500 text-amber-300 font-arcade text-xs tracking-wider outline-none text-center focus:border-amber-400"
              />
            </div>

            {/* Error Notification */}
            {connectionError && (
              <div className="w-full mb-3 p-2 bg-rose-950/80 border border-rose-500/60 text-rose-200 text-[10px] font-mono text-center rounded">
                {connectionError}
              </div>
            )}

            {/* MODE 1: MAIN MENU SELECTION */}
            {roomMode === 'menu' && (
              <div className="flex flex-col gap-2.5 w-full">
                {/* 1. Host Game Button */}
                <button
                  onClick={() => {
                    const code = MinecraftMultiplayerManager.generateRoomCode();
                    setGeneratedRoomCode(code);
                    setRoomId(code);
                    setRoomMode('host');
                    sound.playBonus();
                  }}
                  className="w-full py-3 bg-[#15803d] hover:bg-[#16a34a] text-white hover:text-[#ffffa0] border-2 border-t-[#4ade80] border-l-[#4ade80] border-b-[#14532d] border-r-[#14532d] active:border-t-[#14532d] active:border-l-[#14532d] active:border-b-[#4ade80] active:border-r-[#4ade80] font-arcade text-xs tracking-wide shadow-md transition-all rounded-none cursor-pointer flex items-center justify-center gap-2 group"
                >
                  <Plus className="w-4 h-4 text-emerald-200 group-hover:scale-110 transition-transform" />
                  <span>DÜNYA KUR (HOST GAME)</span>
                </button>

                {/* 2. Join Game Button */}
                <button
                  onClick={() => {
                    setRoomMode('join');
                    setConnectionError(null);
                    sound.playTone(440, 'triangle', 0.05);
                  }}
                  className="w-full py-3 bg-[#0369a1] hover:bg-[#0284c7] text-white hover:text-[#ffffa0] border-2 border-t-[#38bdf8] border-l-[#38bdf8] border-b-[#0c4a6e] border-r-[#0c4a6e] active:border-t-[#0c4a6e] active:border-l-[#0c4a6e] active:border-b-[#38bdf8] active:border-r-[#38bdf8] font-arcade text-xs tracking-wide shadow-md transition-all rounded-none cursor-pointer flex items-center justify-center gap-2 group"
                >
                  <Users className="w-4 h-4 text-sky-200 group-hover:scale-110 transition-transform" />
                  <span>DÜNYAYA KATIL (JOIN GAME)</span>
                </button>

                {/* 3. Solo Game Button */}
                <button
                  onClick={handleStartSoloGame}
                  className="w-full py-2.5 bg-[#4a4a4a] hover:bg-[#5a5a5a] text-[#e0e0e0] hover:text-[#ffffa0] border-2 border-t-[#8a8a8a] border-l-[#8a8a8a] border-b-[#2a2a2a] border-r-[#2a2a2a] font-arcade text-xs tracking-wide shadow-md transition-all rounded-none cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 text-amber-300" />
                  <span>Tek Oyunculu (Solo Çevrimdışı)</span>
                </button>

                <div className="flex gap-2 w-full mt-1">
                  <button
                    onClick={toggleFullscreen}
                    className="flex-1 py-2 bg-[#333333] hover:bg-[#444444] text-[#ffffa0] border-2 border-t-[#666666] border-l-[#666666] border-b-[#111111] border-r-[#111111] font-arcade text-[10px] tracking-wide shadow-md rounded-none flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isFullscreen ? <Minimize className="w-3 h-3 text-amber-400" /> : <Maximize className="w-3 h-3 text-amber-400" />}
                    <span>{isFullscreen ? 'Normal' : 'Tam Ekran'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setMenuInitialTab('settings');
                      setIsMenuOpen(true);
                    }}
                    className="flex-1 py-2 bg-[#333333] hover:bg-[#444444] text-[#e0e0e0] hover:text-white border-2 border-t-[#666666] border-l-[#666666] border-b-[#111111] border-r-[#111111] font-arcade text-[10px] tracking-wide shadow-md rounded-none cursor-pointer"
                  >
                    Seçenekler
                  </button>
                </div>
              </div>
            )}

            {/* MODE 2: HOST GAME VIEW */}
            {roomMode === 'host' && (
              <div className="flex flex-col gap-3 w-full">
                <div className="text-center">
                  <h3 className="font-arcade text-emerald-400 text-xs mb-1">DÜNYA ODA KODUNUZ (MATCH ID)</h3>
                  <p className="text-[10px] font-mono text-slate-300">Arkadaşın bu kodu girerek dünyana anında bağlanabilir:</p>
                </div>

                {/* Big Room Code Box with Copy Button */}
                <div className="flex items-center gap-2 bg-slate-950 p-2.5 border-2 border-dashed border-emerald-500/80 rounded">
                  <div className="flex-1 font-arcade text-lg sm:text-xl text-center text-amber-300 tracking-widest select-all">
                    {generatedRoomCode}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedRoomCode);
                      setIsCopied(true);
                      sound.playTone(600, 'triangle', 0.05);
                      setTimeout(() => setIsCopied(false), 2500);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-arcade text-[10px] flex items-center gap-1 rounded transition-colors cursor-pointer"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-white" />}
                    <span>{isCopied ? 'KOPYALANDI!' : 'KOPYALA'}</span>
                  </button>
                </div>

                <button
                  onClick={handleHostGame}
                  disabled={isConnecting}
                  className="w-full py-3 bg-[#15803d] hover:bg-[#16a34a] text-white hover:text-[#ffffa0] border-2 border-t-[#4ade80] border-l-[#4ade80] border-b-[#14532d] border-r-[#14532d] font-arcade text-xs tracking-wider shadow-lg rounded-none cursor-pointer flex items-center justify-center gap-2"
                >
                  {isConnecting ? (
                    <span className="animate-pulse">DÜNYA KURULUYOR...</span>
                  ) : (
                    <>
                      <Play className="w-4 h-4 text-emerald-200" />
                      <span>DÜNYAYI BAŞLAT & OYNA</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setRoomMode('menu');
                    setConnectionError(null);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 font-arcade text-[10px] tracking-wide rounded-none cursor-pointer"
                >
                  ← Geri Dön
                </button>
              </div>
            )}

            {/* MODE 3: JOIN GAME VIEW */}
            {roomMode === 'join' && (
              <div className="flex flex-col gap-3 w-full">
                <div className="text-center">
                  <h3 className="font-arcade text-sky-400 text-xs mb-1">DÜNYAYA KATIL (JOIN GAME)</h3>
                  <p className="text-[10px] font-mono text-slate-300">Arkadaşından aldığın Oda Kodunu (Match ID) gir:</p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={10}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="ÖRN: MC-8492"
                    className="flex-1 px-3 py-2 bg-slate-950 border-2 border-sky-600 text-amber-300 font-arcade text-xs tracking-widest text-center uppercase outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) setJoinCodeInput(text.trim().toUpperCase());
                      } catch {
                        // ignore
                      }
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-arcade text-[10px] border border-slate-600 rounded-none cursor-pointer"
                  >
                    YAPIŞTIR
                  </button>
                </div>

                <button
                  onClick={() => handleJoinGame()}
                  disabled={isConnecting}
                  className="w-full py-3 bg-[#0369a1] hover:bg-[#0284c7] text-white hover:text-[#ffffa0] border-2 border-t-[#38bdf8] border-l-[#38bdf8] border-b-[#0c4a6e] border-r-[#0c4a6e] font-arcade text-xs tracking-wider shadow-lg rounded-none cursor-pointer flex items-center justify-center gap-2"
                >
                  {isConnecting ? (
                    <span className="animate-pulse">DÜNYAYA BAĞLANILIYOR...</span>
                  ) : (
                    <>
                      <Users className="w-4 h-4 text-sky-200" />
                      <span>DÜNYAYA BAĞLAN & OYNA</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setRoomMode('menu');
                    setConnectionError(null);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 font-arcade text-[10px] tracking-wide rounded-none cursor-pointer"
                >
                  ← Geri Dön
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game UI - Only show when game is started */}
      {gameStarted && (
        <>
           {/* Top-Left Quick Controls */}
           <div className="absolute top-3 left-3 z-30 flex flex-wrap items-center gap-2 pointer-events-auto select-none">
            <button
              onClick={toggleCursorLock}
              className={`px-3 py-2 rounded-lg border text-xs font-arcade shadow-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                isCursorFree
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-amber-300 ring-2 ring-amber-400/50'
                  : 'bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/80'
              }`}
              title="İmleç Serbest [Alt]"
            >
              <MousePointer className="w-4 h-4" />
              <span>[Alt] {isCursorFree ? 'İmleç Açık' : 'İmleç'}</span>
            </button>

            {/* Multiplayer Room Badge & Info */}
            {isMultiplayerActive && (
              <>
                <button
                  onClick={() => {
                    if (roomId) {
                      navigator.clipboard.writeText(roomId);
                      setIsCopied(true);
                      sound.playTone(600, 'triangle', 0.05);
                      setTimeout(() => setIsCopied(false), 2000);
                    }
                  }}
                  title="Oda Kodunu Kopyala"
                  className="px-3 py-2 bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/70 rounded-lg text-xs font-arcade shadow-lg flex items-center gap-1.5 cursor-pointer text-emerald-400"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
                  <span>Oda: <strong className="text-amber-300">{roomId}</strong></span>
                  {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                </button>

                <div className="px-2.5 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-xs font-arcade text-slate-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span>{connectedPlayers.length + 1} Oyuncu</span>
                </div>

                <button
                  onClick={() => {
                    setIsChatOpen((prev) => !prev);
                    if (!isChatOpen && document.pointerLockElement) {
                      document.exitPointerLock();
                    }
                  }}
                  className={`px-3 py-2 border rounded-lg text-xs font-arcade shadow-lg flex items-center gap-1.5 cursor-pointer transition-all ${
                    isChatOpen
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-300'
                      : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                  title="Sohbet [T]"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>[T] Sohbet</span>
                </button>
              </>
            )}
          </div>

          {/* Alt key free cursor notification banner */}
          {isCursorFree && !isPaused && !showCrafting && !isChatOpen && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-slate-950/90 border border-amber-400/80 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 pointer-events-none select-none animate-fade-in">
              <MousePointer className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
              <span className="text-amber-300 text-xs font-arcade">İmleç Serbest</span>
              <span className="text-slate-400 text-[11px] font-mono">· Kilitlemek için ekrana tıkla veya [Alt] bas</span>
            </div>
          )}

          {/* Crosshair (Minecraft Classic Cross) - Hidden when cursor is free */}
          {!isCursorFree && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-4 h-4 flex items-center justify-center">
                <div className="w-3.5 h-0.5 bg-white/90 drop-shadow" />
                <div className="h-3.5 w-0.5 bg-white/90 absolute drop-shadow" />
              </div>
            </div>
          )}

          {/* Block Breaking Progress Bar */}
          {miningProgress > 0 && (
            <div className="absolute top-[56%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none flex flex-col items-center">
              <div className="w-20 h-2 bg-black/80 border border-slate-600 rounded-none p-0.5">
                <div 
                  className="h-full bg-amber-400 transition-all duration-75 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                  style={{ width: `${Math.min(100, miningProgress * 100)}%` }}
                />
              </div>
            </div>
          )}

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
            
            {/* Survival HUD: Hearts, Hunger, and XP Bar */}
            <div className="flex flex-col items-center w-full max-w-[360px] select-none mb-0.5">
              {/* Hearts (left) and Hunger (right) */}
              <div className="flex justify-between w-full px-1.5 mb-1">
                {/* 10 Hearts (Pixel-Art SVGs with dynamic health filling) */}
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const heartVal = health - i * 2;
                    const fillType = heartVal >= 2 ? 'full' : heartVal === 1 ? 'half' : 'empty';
                    return <MinecraftHeart key={i} fill={fillType} />;
                  })}
                </div>

                {/* 10 Hunger Shanks (Pixel-Art SVGs with dynamic hunger emptying) */}
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const hungerVal = hunger - i * 2;
                    const fillType = hungerVal >= 2 ? 'full' : hungerVal === 1 ? 'half' : 'empty';
                    return <MinecraftHunger key={i} fill={fillType} />;
                  })}
                </div>
              </div>

              {/* Lime Green Experience (XP) Bar */}
              <div className="relative w-full h-1.5 bg-slate-950 border border-slate-700 rounded-none overflow-hidden flex items-center justify-center">
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-[#3c0] shadow-[0_0_6px_rgba(51,204,0,0.8)]"
                  style={{ width: `${Math.min(100, (score % 100) || 20)}%` }}
                />
                {/* Level number centered above the bar */}
                <span className="absolute text-[8px] font-arcade text-[#3c0] drop-shadow-[0_1px_1px_rgba(0,0,0,1)] z-10 bottom-0">
                  {Math.floor(score / 100) + 1}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-2xl border-2 border-slate-700 shadow-2xl">
              {hotbarSlots.map((blk, idx) => {
                const isSelected = selectedBlock === blk && blk !== null;
                return (
                  <button
                    key={idx}
                    draggable={blk !== null}
                    onDragStart={(e) => {
                      if (blk) {
                        setDraggedItem(blk);
                        e.dataTransfer.effectAllowed = 'move';
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedItem) {
                        const newSlots = [...hotbarSlots];
                        newSlots[idx] = draggedItem;
                        setHotbarSlots(newSlots);
                        setSelectedBlock(draggedItem);
                        setDraggedItem(null);
                        sound.playTone(500, 'sine', 0.05, 0.15);
                      }
                    }}
                    onClick={() => {
                      if (blk) {
                        setSelectedBlock(blk);
                        sound.playTone(500, 'sine', 0.05, 0.15);
                      }
                    }}
                    className={`relative w-10 sm:w-12 h-10 sm:h-12 rounded-xl flex flex-col items-center justify-center transition-all ${
                      isSelected
                        ? 'border-2 border-amber-400 bg-amber-500/20 scale-105 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                        : 'border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:scale-100'
                    }`}
                  >
                    {blk ? (
                      <>
                        <MinecraftBlockIcon type={blk} size={28} />
                        <span className="absolute bottom-0.5 right-1 text-[9px] font-mono font-bold text-slate-400">
                          {idx + 1}
                        </span>
                        <span className="absolute top-0.5 left-1 text-[9px] font-mono font-bold text-white">
                          {inventory[blk]}
                        </span>
                      </>
                    ) : (
                      <span className="text-[9px] font-mono font-bold text-slate-600">
                        {idx + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Classic Minecraft Survival Inventory & Crafting Panel */}
          {showCrafting && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#c6c6c6] border-4 border-t-white border-l-white border-b-[#555] border-r-[#555] p-5 w-full max-w-[460px] shadow-2xl rounded-none text-slate-800 select-none flex flex-col gap-3 relative font-mono text-xs">
                
                {/* Close Button x */}
                <button 
                  onClick={() => setShowCrafting(false)}
                  className="absolute top-2 right-2 font-arcade text-xs text-slate-600 hover:text-black hover:bg-slate-300 px-1.5 py-0.5 border border-slate-400"
                >
                  X
                </button>

                <div className="flex justify-between items-center border-b border-slate-400 pb-1">
                  <span className="font-arcade text-xs text-slate-800 font-bold">ÜRETİM & ENVANTER (CRAFTING)</span>
                  {inventory['beef'] > 0 && (
                    <button
                      onClick={eatBeef}
                      className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white font-arcade text-[8px] border border-amber-800 shadow cursor-pointer flex items-center gap-1"
                    >
                      🥩 ET YE ({inventory['beef']}) (+6 Açlık)
                    </button>
                  )}
                </div>

                {/* Top Section: Armor, Preview, Crafting 2x2 */}
                <div className="flex gap-4 items-center justify-between">
                  {/* Left: Armor slots (4 square vertical slots) */}
                  <div className="flex flex-col gap-1.5">
                    {['helmet', 'chestplate', 'leggings', 'boots'].map((slot) => (
                      <div 
                        key={slot} 
                        className="w-9 h-9 bg-[#8b8b8b] border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white flex items-center justify-center text-[10px] text-slate-500 font-bold uppercase font-mono"
                      >
                        {slot.slice(0, 2)}
                      </div>
                    ))}
                  </div>

                  {/* Center: Steve 2D Preview */}
                  <div className="flex-1 max-w-[100px] h-[140px] bg-black border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white flex items-center justify-center relative overflow-hidden">
                    <div className="flex flex-col items-center gap-1 scale-100">
                      <div className="w-6 h-6 bg-[#fcd34d] border border-[#b45309]" />
                      <div className="w-9 h-9 bg-[#0ea5e9] border border-[#0369a1] flex justify-between px-1">
                        <div className="w-1.5 h-5 bg-[#fcd34d]" />
                        <div className="w-1.5 h-5 bg-[#fcd34d]" />
                      </div>
                      <div className="w-8 h-9 bg-[#1e3a8a] border border-[#172554] flex justify-between px-2">
                        <div className="w-2 h-full bg-[#1e3a8a]" />
                        <div className="w-2 h-full bg-[#1e3a8a]" />
                      </div>
                    </div>
                  </div>

                  {/* Right: Crafting 2x2 grid */}
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-arcade text-slate-700 mb-1 mr-2">Üretim Alanı (2x2)</span>
                    <div className="flex items-center gap-2.5">
                      {/* 2x2 slots */}
                      <div className="grid grid-cols-2 gap-1 bg-[#8b8b8b] p-1 border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white">
                        {craftingGrid.map((blk, i) => (
                          <div 
                            key={i}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggedItem) {
                                const newGrid = [...craftingGrid];
                                newGrid[i] = draggedItem;
                                setCraftingGrid(newGrid);
                                sound.playTone(450, 'sine', 0.03, 0.1);
                              }
                            }}
                            onClick={() => {
                              if (draggedItem) {
                                const newGrid = [...craftingGrid];
                                newGrid[i] = draggedItem;
                                setCraftingGrid(newGrid);
                                sound.playTone(450, 'sine', 0.03, 0.1);
                              } else if (blk) {
                                const newGrid = [...craftingGrid];
                                newGrid[i] = null;
                                setCraftingGrid(newGrid);
                                sound.playTone(350, 'sine', 0.03, 0.1);
                              }
                            }}
                            className="w-9 h-9 bg-[#8b8b8b] border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white hover:bg-slate-300 cursor-pointer flex items-center justify-center relative"
                          >
                            {blk && <MinecraftBlockIcon type={blk} size={24} />}
                          </div>
                        ))}
                      </div>
                      
                      {/* Crafting Arrow */}
                      <div className="text-slate-600 font-bold text-lg select-none">➡</div>

                      {/* Result Output slot */}
                      {(() => {
                        const recipe = getCraftingResult();
                        return (
                          <div 
                            onClick={executeCrafting}
                            className={`w-11 h-11 border-2 flex items-center justify-center cursor-pointer transition-all ${
                              recipe 
                                ? 'bg-amber-300 border-t-white border-l-white border-b-amber-700 border-r-amber-700 hover:scale-105 shadow-[0_0_10px_rgba(251,191,36,0.8)]' 
                                : 'bg-[#8b8b8b] border-t-[#373737] border-l-[#373737] border-b-white border-r-white'
                            }`}
                            title={recipe ? `${recipe.result} üretmek için tıklayın!` : 'Eşleşen tarif yok'}
                          >
                            {recipe && <MinecraftBlockIcon type={recipe.result} size={28} />}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Recipe Guide bar */}
                <div className="bg-slate-900/10 p-1.5 border border-slate-400 text-[9px] font-mono text-slate-700 flex flex-wrap gap-2 justify-center">
                  <span>💡 <b>Tarifler:</b> 4x Odun = TNT</span>
                  <span>• 2x Taş = Tuğla</span>
                  <span>• 2x Odun = Cam</span>
                  <span>• 2x Toprak = Çimen</span>
                </div>

                {/* Middle line separator */}
                <div className="border-t-2 border-slate-400 my-0.5" />

                {/* Bottom Section: Inventory Grid 3x9 */}
                <div>
                  <span className="text-[10px] font-arcade text-slate-700 mb-1 block">Envanter (Eşya Sürükleyin veya Tıklayın)</span>
                  <div className="grid grid-cols-9 gap-1 bg-[#8b8b8b] p-1.5 border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white">
                    {Array.from({ length: 27 }).map((_, i) => {
                      const itemEntries = Object.entries(inventory).filter(([_, count]) => count > 0);
                      const hasItem = itemEntries[i];
                      
                      return (
                        <div 
                          key={i} 
                          onClick={() => {
                            if (hasItem) {
                              setDraggedItem(hasItem[0] as BlockType);
                              sound.playTone(600, 'sine', 0.02, 0.08);
                            }
                          }}
                          className="w-9 h-9 bg-[#8b8b8b] border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white flex items-center justify-center hover:bg-slate-300 cursor-pointer relative"
                        >
                          {hasItem && (
                            <div
                              draggable
                              onDragStart={(e) => {
                                setDraggedItem(hasItem[0] as BlockType);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                            >
                              <MinecraftBlockIcon type={hasItem[0] as BlockType} size={24} />
                              <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold text-white bg-slate-900/70 px-0.5 rounded pointer-events-none">
                                {hasItem[1]}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Hotbar Section in Inventory Grid 1x8 (Sync with Live Slots) */}
                <div className="mt-0.5">
                  <span className="text-[10px] font-arcade text-slate-700 mb-1 block">Hotbar (Hızlı Erişim Slotları)</span>
                  <div className="grid grid-cols-8 gap-1 bg-[#8b8b8b] p-1.5 border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white">
                    {hotbarSlots.map((blk, idx) => {
                      const isSelected = selectedBlock === blk && blk !== null;
                      return (
                        <div 
                          key={idx} 
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedItem) {
                              const newSlots = [...hotbarSlots];
                              newSlots[idx] = draggedItem;
                              setHotbarSlots(newSlots);
                              setSelectedBlock(draggedItem);
                              setDraggedItem(null);
                              sound.playTone(500, 'sine', 0.05, 0.15);
                            }
                          }}
                          onClick={() => {
                            if (blk) {
                              setSelectedBlock(blk);
                              sound.playTone(520, 'sine', 0.05, 0.12);
                            }
                          }}
                          className={`w-9 h-9 bg-[#8b8b8b] border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white flex flex-col items-center justify-center hover:bg-slate-300 cursor-pointer relative ${
                            isSelected ? 'bg-amber-400/30 border-amber-400' : ''
                          }`}
                        >
                          {blk ? (
                            <>
                              <MinecraftBlockIcon type={blk} size={20} />
                              <span className="absolute bottom-0.5 right-0.5 text-[7px] font-bold text-white bg-slate-900/70 px-0.5 rounded">
                                {inventory[blk] || 0}
                              </span>
                            </>
                          ) : null}
                          <span className="absolute top-0.5 left-0.5 text-[7px] font-bold text-slate-600">
                            {idx + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Crafting Action Shortcuts at bottom */}
                <div className="flex gap-2 justify-between mt-1 pt-1.5 border-t border-slate-400">
                  <button 
                    onClick={() => craftBlock('stone', 'brick', 2)} 
                    className="flex-1 py-1.5 bg-[#4a4a4a] hover:bg-[#5a5a5a] text-[#e0e0e0] hover:text-[#ffffa0] border-2 border-t-[#8a8a8a] border-l-[#8a8a8a] border-b-[#2a2a2a] border-r-[#2a2a2a] font-arcade text-[8px] tracking-tight rounded-none"
                  >
                    Taş ➡ Tuğla (2 Taş)
                  </button>
                  <button 
                    onClick={() => craftBlock('wood', 'tnt', 4)} 
                    className="flex-1 py-1.5 bg-[#4a4a4a] hover:bg-[#5a5a5a] text-[#e0e0e0] hover:text-[#ffffa0] border-2 border-t-[#8a8a8a] border-l-[#8a8a8a] border-b-[#2a2a2a] border-r-[#2a2a2a] font-arcade text-[8px] tracking-tight rounded-none"
                  >
                    Odun ➡ TNT (4 Odun)
                  </button>
                  <button 
                    onClick={() => craftBlock('wood', 'glass', 2)} 
                    className="flex-1 py-1.5 bg-[#4a4a4a] hover:bg-[#5a5a5a] text-[#e0e0e0] hover:text-[#ffffa0] border-2 border-t-[#8a8a8a] border-l-[#8a8a8a] border-b-[#2a2a2a] border-r-[#2a2a2a] font-arcade text-[8px] tracking-tight rounded-none"
                  >
                    Odun ➡ Cam (2 Odun)
                  </button>
                </div>
              </div>
            </div>
          )}



          {/* ESC / Pause Menu Overlay (only if inventory is closed) */}
          {isPaused && !showCrafting && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#7e22ce]/20 border-4 border-t-[#c084fc] border-l-[#c084fc] border-b-[#581c87] border-r-[#581c87] p-6 max-w-sm w-full shadow-2xl rounded-none text-center select-none flex flex-col gap-3 relative animate-fade-in">
                <h3 className="font-arcade text-white text-base tracking-wider mb-2">OYUN DURAKLATILDI</h3>
                
                <button
                  onClick={resumeGame}
                  className="w-full py-2.5 bg-[#9333ea] hover:bg-[#a855f7] text-[#f3e8ff] hover:text-[#ffffa0] border-2 border-t-[#d8b4fe] border-l-[#d8b4fe] border-b-[#581c87] border-r-[#581c87] active:border-t-[#581c87] active:border-l-[#581c87] active:border-b-[#d8b4fe] active:border-r-[#d8b4fe] font-arcade text-xs tracking-wider shadow-md transition-all rounded-none cursor-pointer"
                >
                  Oyuna Geri Dön
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => alert("Gelişimler: " + score + " Puan Kazandın!")}
                    className="py-2 bg-[#9333ea] hover:bg-[#a855f7] text-[#f3e8ff] hover:text-[#ffffa0] border-2 border-t-[#d8b4fe] border-l-[#d8b4fe] border-b-[#581c87] border-r-[#581c87] font-arcade text-[10px] tracking-wide shadow-md rounded-none"
                  >
                    Gelişimler
                  </button>
                  <button
                    onClick={() => alert(`İstatistikler:\nSkor: ${score}\nKırılan: ${blocksMined}\nYerleştirilen: ${blocksPlaced}\nElmaslar: ${diamondsFound}`)}
                    className="py-2 bg-[#9333ea] hover:bg-[#a855f7] text-[#f3e8ff] hover:text-[#ffffa0] border-2 border-t-[#d8b4fe] border-l-[#d8b4fe] border-b-[#581c87] border-r-[#581c87] font-arcade text-[10px] tracking-wide shadow-md rounded-none"
                  >
                    İstatistikler
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setMenuInitialTab('settings');
                      setIsMenuOpen(true);
                    }}
                    className="py-2 bg-[#9333ea] hover:bg-[#a855f7] text-[#f3e8ff] hover:text-[#ffffa0] border-2 border-t-[#d8b4fe] border-l-[#d8b4fe] border-b-[#581c87] border-r-[#581c87] font-arcade text-[10px] tracking-wide shadow-md rounded-none cursor-pointer"
                  >
                    Seçenekler
                  </button>
                  <button
                    onClick={() => alert("Geri bildiriminiz başarıyla sunucuya iletildi!")}
                    className="py-2 bg-[#9333ea] hover:bg-[#a855f7] text-[#f3e8ff] hover:text-[#ffffa0] border-2 border-t-[#d8b4fe] border-l-[#d8b4fe] border-b-[#581c87] border-r-[#581c87] font-arcade text-[10px] tracking-wide shadow-md rounded-none"
                  >
                    Geri Bildirim
                  </button>
                </div>

                <button
                  onClick={toggleFullscreen}
                  className="w-full py-2 bg-[#9333ea] hover:bg-[#a855f7] text-[#ffffa0] border-2 border-t-[#d8b4fe] border-l-[#d8b4fe] border-b-[#581c87] border-r-[#581c87] font-arcade text-xs tracking-wider shadow-md rounded-none flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-amber-300" /> : <Maximize className="w-3.5 h-3.5 text-amber-300" />}
                  <span>{isFullscreen ? 'Normal Ekrana Dön' : 'Tam Ekran Modu'}</span>
                </button>

                <div className="text-[9px] font-mono text-purple-200/90 bg-purple-950/60 py-1.5 px-2 border border-purple-500/30">
                  [Alt] İmleç · [E] Envanter · [C / F5] Bakış Açısı · [F / F11] Tam Ekran
                </div>

                <button
                  onClick={() => {
                    if (confirm("Ana ekrana dönmek istiyor musunuz? Sunucu bağlantısı sonlandırılacaktır.")) {
                      multiplayerManager.leaveRoom();
                      setIsMultiplayerActive(false);
                      setGameStarted(false);
                      setIsPaused(false);
                      setRoomMode('menu');
                    }
                  }}
                  className="w-full py-2.5 bg-[#9333ea] hover:bg-[#a855f7] text-[#f3e8ff] hover:text-[#ffffa0] border-2 border-t-[#d8b4fe] border-l-[#d8b4fe] border-b-[#581c87] border-r-[#581c87] font-arcade text-xs tracking-wider shadow-md rounded-none cursor-pointer"
                >
                  Sunucudan Ayrıl
                </button>

                {/* Bottom welcoming box matching the image */}
                <div className="mt-4 p-3 bg-[#581c87]/65 border-2 border-[#a855f7] rounded-none text-center">
                  <h4 className="font-arcade text-[10px] text-yellow-400 mb-1">MİMAR LOBİSİ</h4>
                  <p className="text-[9px] text-[#f3e8ff] font-arcade leading-relaxed">
                    Usta bir mimar ol, yeni dünyalar yarat ve en yüksek skora ulaş!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* In-Game Chat Box */}
          {isChatOpen && isMultiplayerActive && (
            <div className="absolute bottom-20 left-4 z-40 w-80 max-w-[90vw] bg-slate-950/90 border-2 border-t-slate-600 border-l-slate-600 border-b-slate-800 border-r-slate-800 shadow-2xl backdrop-blur-md p-3 select-auto flex flex-col gap-2 rounded">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-700/80">
                <div className="flex items-center gap-1.5 font-arcade text-xs text-amber-300">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>DÜNYA SOHBETİ</span>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-slate-400 hover:text-white text-xs font-mono px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Chat Message History */}
              <div className="h-36 overflow-y-auto flex flex-col gap-1 pr-1 font-mono text-xs">
                {chatMessages.length === 0 ? (
                  <div className="text-slate-500 text-[11px] italic my-auto text-center">
                    Henüz mesaj yok. Arkadaşlarına merhaba de!
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className="leading-snug break-words">
                      <span className="font-bold text-emerald-400">&lt;{msg.name}&gt; </span>
                      <span className="text-slate-200">{msg.text}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatInput.trim()) {
                    multiplayerManager.sendChat(chatInput);
                    setChatMessages((prev) => [
                      ...prev.slice(-30),
                      {
                        id: multiplayerManager.myPlayerId,
                        name: playerName,
                        color: '#10b981',
                        text: chatInput.trim(),
                        timestamp: Date.now(),
                      },
                    ]);
                    setChatInput('');
                  }
                }}
                className="flex gap-1.5 mt-1"
              >
                <input
                  type="text"
                  maxLength={120}
                  autoFocus
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Mesajınızı yazın... [Enter]"
                  className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-white font-mono text-xs outline-none focus:border-amber-400 rounded-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-arcade text-[10px] font-bold rounded-none cursor-pointer flex items-center justify-center"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </div>
          )}

          {/* Quick Chat Overlay when chat is closed (shows last 3 messages fading) */}
          {!isChatOpen && isMultiplayerActive && chatMessages.length > 0 && (
            <div className="absolute bottom-20 left-4 z-20 max-w-sm flex flex-col gap-1 pointer-events-none select-none font-mono text-xs">
              {chatMessages.slice(-3).map((msg, i) => (
                <div key={i} className="bg-slate-950/70 px-2.5 py-1 rounded border border-slate-800/80 backdrop-blur-sm text-slate-200">
                  <span className="font-bold text-emerald-400">&lt;{msg.name}&gt; </span>
                  <span>{msg.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Player List Overlay (Tab Key) */}
          {showPlayerList && isMultiplayerActive && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-slate-950/95 border-2 border-emerald-500 p-4 shadow-2xl backdrop-blur-md rounded w-72 max-w-[90vw]">
              <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-700">
                <span className="font-arcade text-xs text-amber-300">OYUNCULAR ({connectedPlayers.length + 1})</span>
                <span className="font-mono text-[10px] text-emerald-400">Oda: {roomId}</span>
              </div>
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between px-2 py-1 bg-slate-900 border border-emerald-500/30 rounded text-xs">
                  <span className="font-arcade text-emerald-300 flex items-center gap-1">
                    👑 {playerName} (Siz)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">Ev Sahibi</span>
                </div>
                {connectedPlayers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-2 py-1 bg-slate-900/60 border border-slate-800 rounded text-xs">
                    <span className="font-arcade text-slate-200">{p.name}</span>
                    <span className="text-[10px] font-mono text-sky-400">Bağlı</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

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
        initialTab={menuInitialTab}
        onStartGame={() => {
          setIsMenuOpen(false);
          sound.playBonus();
        }}
      />

      {/* In-game Settings Panel */}
      {showSettingsModal && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={setSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Invite Modal removed */}

    </div>
  );
};
