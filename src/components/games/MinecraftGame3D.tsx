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
  Maximize,
  Minimize,
} from 'lucide-react';

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

const generateMinecraftTexture = (type: BlockType, face?: 'top' | 'side' | 'bottom') => {
  const size = 16;
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
        const isBorder = (y === 0 || y === 8 || x === 0 || x === 8 || (y < 8 && x === 4) || (y >= 8 && x === 12));
        const rFactor = Math.sin(x * 12.3) * Math.cos(y * 7.7) * 12 + Math.random() * 8;
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
          const rFactor = Math.sin(x * 14.2) * Math.cos(y * 9.1) * 14 + Math.random() * 10;
          setPixel(x, y, 76 + rFactor, 180 + rFactor * 0.8, 55 + rFactor * 0.5);
        }
      }
    } else if (face === 'bottom') {
      // Dirt (Bottom) - Rich brown soil (Matching uploaded image 3)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const rFactor = Math.sin(x * 9.4) * Math.cos(y * 12.1) * 15 + Math.random() * 10;
          setPixel(x, y, 98 + rFactor, 66 + rFactor, 43 + rFactor);
        }
      }
    } else {
      // Grass Side - Green hanging grass on brown dirt (Matching uploaded image 2 side)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const baseGrassDepth = 4;
          const isGrass = y < baseGrassDepth || 
            (y === 4 && (x % 3 === 0 || x % 5 === 1)) || 
            (y === 5 && (x === 3 || x === 10 || x === 14));
          const rFactor = Math.sin(x * 9.4) * Math.cos(y * 12.1) * 12 + Math.random() * 8;
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
        const rFactor = Math.sin(x * 11.2) * Math.cos(y * 13.4) * 15 + Math.random() * 12;
        const isPebble = (x === 3 && y === 4) || (x === 11 && y === 12) || (x === 7 && y === 2);
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
          const isRing = Math.floor(dist) % 2 === 0;
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
          const isRing = Math.floor(dist) % 3 === 0;
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
          const isNotch = (y === 3 && x >= 2 && x <= 6) || 
            (y === 11 && x >= 10 && x <= 14) || 
            (y === 7 && (x <= 2 || x >= 13)) ||
            (y === 14 && x >= 5 && x <= 9);
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
        const isGlow = (x === 3 && y === 3) || (x === 4 && y === 2) || (x === 11 && y === 10) || (x === 12 && y === 9);
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
        const isHighlight = (x === y && x >= 3 && x <= 6) || (x === y - 5 && x >= 8 && x <= 10);
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
        const isMortar = (y % 4 === 0) || (y < 4 && x === 4) || (y >= 4 && y < 8 && x === 12) || (y >= 8 && y < 12 && x === 4) || (y >= 12 && x === 12);
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
        const isWhiteStripe = (y >= 5 && y <= 9);
        const isT1 = (y === 6 && x >= 2 && x <= 4) || (x === 3 && y >= 6 && y <= 8);
        const isN = (x === 5 && y >= 6 && y <= 8) || (x === 7 && y >= 6 && y <= 8) || (x === 6 && y === 7);
        const isT2 = (y === 6 && x >= 8 && x <= 10) || (x === 9 && y >= 6 && y <= 8);
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
        const isBone = (x === y && (x <= 3 || x >= 12)) || (x === y + 1 && (x <= 3 || x >= 12)) || (x === y - 1 && (x <= 3 || x >= 12));
        const isMeat = !isBone && (x + y >= 8 && x + y <= 22 && Math.abs(x - y) <= 5);
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
  const size = 16;
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

  // Modals & Multiplayer UI states
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);
  const [isMultiplayerMode, setIsMultiplayerMode] = useState<boolean>(true);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatInputText, setChatInputText] = useState<string>('');
  const [showPlayerList, setShowPlayerList] = useState<boolean>(false);
  const isChatOpenRef = useRef<boolean>(false);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  // Stable references for block operations
  const addBlockRef = useRef<(x: number, y: number, z: number, type: BlockType) => void>(() => {});
  const removeBlockRef = useRef<(x: number, y: number, z: number) => void>(() => {});

  // Remote Steves 3D tracking
  interface RemoteSteveInstance {
    group: THREE.Group;
    armR: THREE.Mesh;
    armL: THREE.Mesh;
    legL: THREE.Mesh;
    legR: THREE.Mesh;
    labelSprite: THREE.Sprite;
    chatSprite: THREE.Sprite | null;
    heldItemMesh: THREE.Mesh | null;
    currentHeldType: string | null;
    punchTime: number;
    chatExpiry: number;
  }
  const remoteStevesRef = useRef<Map<string, RemoteSteveInstance>>(new Map());

  // Multiplayer Hook
  const {
    connected,
    ping,
    playerId,
    players,
    sendUpdate,
    sendChat,
    sendBlockPlace,
    sendBlockBreak,
    sendPlayerPunch,
    chatMessages,
  } = useMultiplayer({
    room: 'minecraft',
    playerName,
    playerColor: playerColor || '#10b981',
    vehicle: selectedBlock || 'none',
    onBlockPlaced: (data) => {
      if (data.playerId === playerId) return;
      addBlockRef.current(data.x, data.y, data.z, data.type as BlockType);
      sound.playTone(450, 'triangle', 0.05, 0.15);
    },
    onBlockBroken: (data) => {
      if (data.playerId === playerId) return;
      removeBlockRef.current(data.x, data.y, data.z);
      sound.playTone(320, 'sine', 0.05, 0.15);
    },
    onWorldSync: (data) => {
      if (!data?.blocks) return;
      data.blocks.forEach((b) => {
        if (b.type === 'air') {
          removeBlockRef.current(b.x, b.y, b.z);
        } else {
          addBlockRef.current(b.x, b.y, b.z, b.type as BlockType);
        }
      });
    },
    onPlayerPunched: (data) => {
      const inst = remoteStevesRef.current.get(data.id);
      if (inst) inst.punchTime = performance.now();
    },
  });

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const worldBlocksRef = useRef<Map<string, { mesh: THREE.Mesh; type: BlockType }>>(new Map());
  const highlightMeshRef = useRef<THREE.LineSegments | null>(null);
  const steveMeshRef = useRef<THREE.Group | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

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

  // 3D Canvas Nameplate Sprite
  const createNameplateSprite = useCallback((name: string, color = '#22c55e') => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.roundRect(8, 8, 240, 48, 8);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name.slice(0, 16), 128, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.2, 0.55, 1);
    sprite.position.y = 3.3; // Above Steve's head
    return sprite;
  }, []);

  // 3D Speech Bubble Sprite
  const createChatBubbleSprite = useCallback((text: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(10, 10, 492, 108, 16);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`💬 ${text.slice(0, 24)}`, 256, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.2, 0.8, 1);
    sprite.position.y = 4.3; // Above nameplate
    return sprite;
  }, []);

  // Remote Steve 3D Model Builder (for other online players)
  const createRemoteSteveMesh = useCallback((name: string, colorHex = '#0ea5e9'): RemoteSteveInstance => {
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

    // Torso with player's color
    const torsoMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.5), torsoMat);
    torso.position.y = 1.4;
    steve.add(torso);

    // Left Arm
    const armMat = new THREE.MeshStandardMaterial({ color: '#fcd34d', roughness: 0.8 });
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.2, 0.35), armMat);
    armL.position.set(-0.65, 1.4, 0);
    steve.add(armL);

    // Right Arm (pivot at shoulder)
    const armRGeo = new THREE.BoxGeometry(0.35, 1.2, 0.35);
    armRGeo.translate(0, -0.4, 0);
    const armR = new THREE.Mesh(armRGeo, armMat);
    armR.position.set(0.65, 1.8, 0);
    steve.add(armR);

    // Legs
    const pantsMat = new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.8 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), pantsMat);
    legL.position.set(-0.25, 0.5, 0);
    steve.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), pantsMat);
    legR.position.set(0.25, 0.5, 0);
    steve.add(legR);

    // Nameplate
    const labelSprite = createNameplateSprite(name, colorHex);
    steve.add(labelSprite);

    return {
      group: steve,
      armR,
      armL,
      legL,
      legR,
      labelSprite,
      chatSprite: null,
      heldItemMesh: null,
      currentHeldType: null,
      punchTime: 0,
      chatExpiry: 0,
    };
  }, [createNameplateSprite]);

  // Steve 3D Model Builder (for 3rd person local player)
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

    // Left Arm
    const armMat = new THREE.MeshStandardMaterial({ color: '#fcd34d', roughness: 0.8 });
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.2, 0.35), armMat);
    armL.position.set(-0.65, 1.4, 0);
    steve.add(armL);

    // Right Arm (Unique mesh with translated shoulder pivot)
    const armRGeo = new THREE.BoxGeometry(0.35, 1.2, 0.35);
    armRGeo.translate(0, -0.4, 0); // Translate geometry down to move pivot to shoulder
    const armR = new THREE.Mesh(armRGeo, armMat);
    armR.position.set(0.65, 1.8, 0); // Position at shoulder height
    steve.add(armR);
    rightArmRef.current = armR; // Save ref for held item attachment

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

  // Keep stable refs updated
  useEffect(() => {
    addBlockRef.current = addBlock;
    removeBlockRef.current = removeBlock;
  }, [addBlock, removeBlock]);

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
            sendBlockBreak(x, y, z);
          }
        }
      }
    }
  }, [removeBlock, sendBlockBreak]);

  // Display floating speech bubble above remote player when chat message is received
  useEffect(() => {
    if (chatMessages.length === 0) return;
    const latest = chatMessages[chatMessages.length - 1];
    if (!latest || latest.id === playerId) return;

    const inst = remoteStevesRef.current.get(latest.id);
    if (inst) {
      if (inst.chatSprite) {
        inst.group.remove(inst.chatSprite);
        inst.chatSprite.material.dispose();
      }
      const bubble = createChatBubbleSprite(latest.text);
      inst.group.add(bubble);
      inst.chatSprite = bubble;
      inst.chatExpiry = performance.now() + 5000;
    }
  }, [chatMessages, playerId, createChatBubbleSprite]);

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
        const key = `${rx},${y},${rz}`;
        if (worldBlocksRef.current.has(key)) {
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

  // Terrain Generator with Deep Underground Layers
  const generateWorld = useCallback((worldSize: number) => {
    const minY = -6; // Deep bottom bedrock floor layer

    for (let x = -worldSize; x <= worldSize; x++) {
      for (let z = -worldSize; z <= worldSize; z++) {
        // Height formula: wavy rolling hills on surface
        const hill = Math.floor(Math.sin(x * 0.28) * Math.cos(z * 0.28) * 2.2 + 4);
        const surfaceY = Math.max(2, hill);

        // 1. Bottom Bedrock Floor Layer (y = minY)
        addBlock(x, minY, z, 'stone');

        // 2. Deep Stone & Diamond Veins Layer (y from minY + 1 to 0)
        for (let y = minY + 1; y <= 0; y++) {
          const isDiamond = Math.random() < 0.055; // 5.5% diamond rate deep underground
          addBlock(x, y, z, isDiamond ? 'diamond' : 'stone');
        }

        // 3. Upper Stone Layer (y from 1 to surfaceY - 3)
        for (let y = 1; y < surfaceY - 2; y++) {
          const isDiamond = Math.random() < 0.018 && y <= 2;
          addBlock(x, y, z, isDiamond ? 'diamond' : 'stone');
        }

        // 4. Subsurface Dirt Layers (y from surfaceY - 2 to surfaceY - 1)
        for (let y = Math.max(1, surfaceY - 2); y < surfaceY; y++) {
          addBlock(x, y, z, 'dirt');
        }

        // 5. Surface Grass Block (y = surfaceY)
        addBlock(x, surfaceY, z, 'grass');

        // 6. Spawn occasional Trees on surface
        if (Math.random() < 0.032 && Math.abs(x) > 2 && Math.abs(z) > 2) {
          const trunkBase = surfaceY + 1;
          const isBirch = Math.random() < 0.45;
          const woodType = isBirch ? 'birch' : 'wood';

          for (let ty = 0; ty < 4; ty++) {
            addBlock(x, trunkBase + ty, z, woodType);
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
  }, [addBlock]);

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

    // 7. Steve 3D mesh
    const steve = createSteveMesh();
    scene.add(steve);
    steveMeshRef.current = steve;

    // Resize
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [handleResize]); // Run only once, but depend on handleResize

  // Trigger world generation when game starts
  useEffect(() => {
    if (gameStarted) {
      generateWorld(18); // Deep layered world
      spawnCows(8); // Spawn 8 cute cow mobs!

      // Position Steve right on top of the surface grass at (0, 0)
      let spawnY = 8;
      for (let y = 20; y >= -10; y--) {
        if (worldBlocksRef.current.has(`0,${y},0`)) {
          spawnY = y + 1.5;
          break;
        }
      }
      playerPosRef.current.x = 0;
      playerPosRef.current.y = spawnY;
      playerPosRef.current.z = 0;
      playerPosRef.current.vy = 0;

      handleResize(); // Ensure renderer is resized when it becomes visible
    }
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
      if (document.pointerLockElement !== containerRef.current && gameStarted) {
        setIsPaused(true);
      } else if (document.pointerLockElement === containerRef.current && gameStarted) {
        setIsPaused(false);
      }
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [gameStarted]);

  const resumeGame = useCallback(() => {
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

      const blockMeshes: THREE.Mesh[] = [];
      worldBlocksRef.current.forEach((val) => blockMeshes.push(val.mesh));

      const cowGroups = mobsRef.current.map((mob) => mob.mesh);

      // Raycast against both blocks and cows
      const intersectsBlocks = raycaster.intersectObjects(blockMeshes, false);
      const intersectsCows = raycaster.intersectObjects(cowGroups, true);

      const hitBlock = intersectsBlocks.length > 0 ? intersectsBlocks[0] : null;
      const hitCow = intersectsCows.length > 0 ? intersectsCows[0] : null;

      // ATTACK COW MOB IF CLOSER THAN THE NEAREST BLOCK
      if (hitCow && (!hitBlock || hitCow.distance < hitBlock.distance)) {
        if (e.button === 0) {
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

      // BLOCKS INTERACTIONS (ONLY IF WE ARE NOT INTERACTING WITH A COW)
      if (!hitBlock) return;

      const hit = hitBlock;
      const hitPos = hit.point.clone().sub(hit.face!.normal.clone().multiplyScalar(0.1));
      const bx = Math.round(hitPos.x);
      const by = Math.round(hitPos.y);
      const bz = Math.round(hitPos.z);

      if (e.button === 0) {
        // LEFT CLICK: MINE / BREAK BLOCK
        sendPlayerPunch();
        const minedType = removeBlock(bx, by, bz);
        if (minedType) {
          sendBlockBreak(bx, by, bz);
          addToInventory(minedType); // Add to inventory
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
        if (removeFromInventory(selectedBlock)) { // Remove from inventory
          const placePos = hit.point.clone().add(hit.face!.normal.clone().multiplyScalar(0.4));
          const px = Math.round(placePos.x);
          const py = Math.round(placePos.y);
          const pz = Math.round(placePos.z);

          // Don't place inside player
          const player = playerPosRef.current;
          if (Math.hypot(px - player.x, pz - player.z) > 0.6 || Math.abs(py - player.y) > 1.8) {
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
          } else if (selectedBlock) {
            addToInventory(selectedBlock); // Refund if unable to place
          }
        } else {
          sound.playTone(200, 'sawtooth', 0.1, 0.1); // No block sound
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
  }, [toggleFullscreen]);

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
        const cx = Math.round(mob.x);
        const cz = Math.round(mob.z);
        let groundHeight = -10;
        for (let y = 20; y >= -10; y--) {
          const key = `${cx},${y},${cz}`;
          if (worldBlocksRef.current.has(key)) {
            groundHeight = y + 1.0;
            break;
          }
        }
        mob.y = THREE.MathUtils.lerp(mob.y, groundHeight, 0.2); // smooth vertical leveling
        mob.mesh.position.set(mob.x, mob.y - 0.5, mob.z);

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

      // 3. Update Remote Online Players in 3D Scene
      if (sceneInstance) {
        const activeRemoteIds = new Set<string>();

        players.forEach((rp, id) => {
          if (id === playerId) return;
          activeRemoteIds.add(id);

          let inst = remoteStevesRef.current.get(id);
          if (!inst) {
            inst = createRemoteSteveMesh(rp.name, rp.color || '#0ea5e9');
            sceneInstance.add(inst.group);
            remoteStevesRef.current.set(id, inst);
          }

          // Smooth interpolation towards network position
          inst.group.position.x += (rp.x - inst.group.position.x) * 0.3;
          inst.group.position.y += (rp.y - inst.group.position.y) * 0.3;
          inst.group.position.z += (rp.z - inst.group.position.z) * 0.3;
          inst.group.rotation.y = rp.rotation;

          // Leg & arm walking swing
          const spd = rp.speed || 0;
          if (spd > 0.1) {
            const walk = Math.sin(now * 0.012) * 0.6;
            inst.legL.rotation.x = walk;
            inst.legR.rotation.x = -walk;
            inst.armL.rotation.x = -walk;
            if (now - inst.punchTime > 400) {
              inst.armR.rotation.x = walk;
            }
          } else {
            inst.legL.rotation.x = 0;
            inst.legR.rotation.x = 0;
            inst.armL.rotation.x = 0;
            if (now - inst.punchTime > 400) {
              inst.armR.rotation.x = 0;
            }
          }

          // Punch animation
          if (now - inst.punchTime <= 400) {
            const punchP = (now - inst.punchTime) / 400;
            inst.armR.rotation.x = -Math.PI / 2.5 - Math.sin(punchP * Math.PI) * 0.8;
          }

          // Held Item Synchronization (vehicle field holds the block type)
          const heldType = rp.vehicle;
          if (heldType && heldType !== 'none' && heldType !== inst.currentHeldType) {
            if (inst.heldItemMesh) {
              inst.armR.remove(inst.heldItemMesh);
              inst.heldItemMesh.geometry.dispose();
            }
            try {
              const itemGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
              const itemMat = getBlockMaterial(heldType as BlockType);
              const itemMesh = new THREE.Mesh(itemGeo, itemMat);
              itemMesh.position.set(0, -0.7, 0.3);
              inst.armR.add(itemMesh);
              inst.heldItemMesh = itemMesh;
              inst.currentHeldType = heldType;
            } catch {
              // ignore
            }
          } else if ((!heldType || heldType === 'none') && inst.heldItemMesh) {
            inst.armR.remove(inst.heldItemMesh);
            inst.heldItemMesh.geometry.dispose();
            inst.heldItemMesh = null;
            inst.currentHeldType = null;
          }

          // Speech bubble expiry
          if (inst.chatSprite && now > inst.chatExpiry) {
            inst.group.remove(inst.chatSprite);
            inst.chatSprite.material.dispose();
            inst.chatSprite = null;
          }
        });

        // Cleanup disconnected players
        remoteStevesRef.current.forEach((inst, id) => {
          if (!activeRemoteIds.has(id)) {
            sceneInstance.remove(inst.group);
            if (inst.heldItemMesh) inst.heldItemMesh.geometry.dispose();
            if (inst.chatSprite) inst.chatSprite.material.dispose();
            inst.labelSprite.material.dispose();
            remoteStevesRef.current.delete(id);
          }
        });
      }

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

        // Check if a block at a coordinate is solid/exists
        const isSolid = (x: number, y: number, z: number) => {
          const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
          return worldBlocksRef.current.has(key);
        };

        // Check collision at player's foot and head height
        const feetY = Math.round(pos.y - 1);
        const headY = Math.round(pos.y);

        const collidesX = isSolid(nextX, feetY, pos.z) || isSolid(nextX, headY, pos.z);
        const collidesZ = isSolid(pos.x, feetY, nextZ) || isSolid(pos.x, headY, nextZ);

        if (!collidesX) pos.x = nextX;
        if (!collidesZ) pos.z = nextZ;
      }

      // Voxel Ground Collision & Gravity
      const footBlockX = Math.round(pos.x);
      const footBlockZ = Math.round(pos.z);
      let groundY = -30;

      // Find highest block below player feet (supports deep underground layers)
      for (let y = Math.floor(pos.y - 1.0); y >= -15; y--) {
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

      // Void protection (respawn on surface if fallen into void)
      if (pos.y < -20) {
        pos.x = 0;
        pos.y = 12;
        pos.z = 0;
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

      if (steve && cameraView === 'third' && rightArmRef.current) {
        if (punchAnimRef.current > 0) {
          punchAnimRef.current = Math.max(0, punchAnimRef.current - dt * 6.5);
        }
        // Walk swing vs punching swing in third person
        const isWalking = dx !== 0 || dz !== 0;
        const swing = Math.sin(punchAnimRef.current * Math.PI);
        
        if (punchAnimRef.current > 0) {
          rightArmRef.current.rotation.x = -Math.PI / 3.5 - swing * 1.2;
        } else if (isWalking) {
          rightArmRef.current.rotation.x = -Math.PI / 3.5 + Math.sin(now * 0.015) * 0.15;
        } else {
          rightArmRef.current.rotation.x = -Math.PI / 3.5;
        }
      }

      // Camera view toggle can now also update held items
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
        vehicle: selectedBlock || undefined,
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
  }, [gameStarted, cameraView, selectedBlock, score, sendUpdate, isPaused]);

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
      <div ref={containerRef} className={`w-full h-full cursor-crosshair ${gameStarted ? '' : 'hidden'}`} />

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

      {/* Start Screen */}
      {!gameStarted && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-950/80 via-slate-950 to-slate-950 flex flex-col items-center justify-center z-50 p-4 border border-purple-500/20 rounded-2xl overflow-hidden shadow-2xl">
          {/* Animated Background overlay to give that dark crystal cave/dirt feeling */}
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] pointer-events-none" />
          
          {/* Minecraft Title block */}
          <div className="relative mb-8 text-center select-none scale-90 sm:scale-100 z-10">
            <h1 className="font-arcade text-5xl md:text-6xl text-slate-300 drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] tracking-wider">
              MINECRAFT
            </h1>
            <div className="font-arcade text-[10px] text-slate-400 mt-2 tracking-widest uppercase">
              JAVA EDITION
            </div>
            {/* Pulsing Splash Text */}
            <div className="absolute -bottom-3 -right-6 rotate-[-15deg] font-arcade text-xs text-yellow-400 drop-shadow-[0_2px_0_rgba(0,0,0,1)] animate-bounce select-none">
              Hi r/minecraft!!!
            </div>
          </div>

          {/* Blocky Buttons Stack */}
          <div className="flex flex-col gap-2.5 items-center w-full max-w-sm px-4 z-10">
            <button
              onClick={() => {
                setIsMultiplayerMode(false);
                setGameStarted(true);
                sound.playBonus();
              }}
              className="w-full py-2.5 bg-[#4a4a4a] hover:bg-[#5a5a5a] text-[#e0e0e0] hover:text-[#ffffa0] border-2 border-t-[#8a8a8a] border-l-[#8a8a8a] border-b-[#2a2a2a] border-r-[#2a2a2a] active:border-t-[#2a2a2a] active:border-l-[#2a2a2a] active:border-b-[#8a8a8a] active:border-r-[#8a8a8a] font-arcade text-xs tracking-wide shadow-md transition-all rounded-none cursor-pointer"
            >
              Singleplayer (Tek Oyunculu)
            </button>

            <button
              onClick={() => {
                setIsMultiplayerMode(true);
                setGameStarted(true);
                sound.playBonus();
              }}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold border-2 border-t-emerald-400 border-l-emerald-400 border-b-emerald-950 border-r-emerald-950 font-arcade text-xs tracking-wide shadow-lg transition-all rounded-none cursor-pointer flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4 text-emerald-300" />
              <span>Multiplayer (Canlı Çevrimiçi Sunucu)</span>
              <span className="px-1.5 py-0.5 bg-emerald-950/80 rounded text-[9px] text-emerald-300 font-mono">
                {players.size + 1} Çevrimiçi
              </span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="w-full py-2 bg-[#3a3a3a] hover:bg-[#4a4a4a] text-[#ffffa0] border-2 border-t-[#777777] border-l-[#777777] border-b-[#222222] border-r-[#222222] font-arcade text-xs tracking-wide shadow-md rounded-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-amber-400" /> : <Maximize className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isFullscreen ? 'Normal Ekran' : 'Tam Ekran Modu'}</span>
            </button>

            <button
              disabled
              className="w-full py-2 bg-[#3a3a3a] text-slate-500 border-2 border-t-slate-600 border-l-slate-600 border-b-slate-800 border-r-slate-800 font-arcade text-xs tracking-wide cursor-not-allowed opacity-50 rounded-none"
            >
              Minecraft Realms
            </button>

            <div className="flex gap-2 w-full mt-1">
              <button
                onClick={() => setIsMenuOpen(true)}
                className="flex-1 py-2.5 bg-[#4a4a4a] hover:bg-[#5a5a5a] text-[#e0e0e0] hover:text-[#ffffa0] border-2 border-t-[#8a8a8a] border-l-[#8a8a8a] border-b-[#2a2a2a] border-r-[#2a2a2a] font-arcade text-xs tracking-wide shadow-md rounded-none"
              >
                Options...
              </button>
              <button
                onClick={() => {
                  if (confirm("Oyundan çıkmak istiyor musunuz?")) {
                    window.location.reload();
                  }
                }}
                className="flex-1 py-2.5 bg-[#4a4a4a] hover:bg-[#5a5a5a] text-[#e0e0e0] hover:text-[#ffffa0] border-2 border-t-[#8a8a8a] border-l-[#8a8a8a] border-b-[#2a2a2a] border-r-[#2a2a2a] font-arcade text-xs tracking-wide shadow-md rounded-none"
              >
                Quit Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game UI - Only show when game is started */}
      {gameStarted && (
        <>
          {/* Top-Left Online Multiplayer Status & Quick Controls */}
          <div className="absolute top-3 left-3 z-30 flex flex-wrap items-center gap-2 pointer-events-auto select-none">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/85 backdrop-blur-md rounded-lg border border-slate-700/80 text-xs shadow-lg font-arcade">
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </span>
              <span className="text-white font-bold tracking-wider">
                {connected ? 'ONLINE SUNUCU' : 'BAĞLANIYOR...'}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-emerald-400 font-bold">{players.size + 1} Oyuncu</span>
              <span className="text-slate-500">|</span>
              <span className="text-amber-400">{ping}ms</span>
            </div>

            <button
              onClick={() => setShowPlayerList((p) => !p)}
              className="px-2.5 py-1.5 bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700/80 text-xs font-arcade shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Oyuncular Listesi [TAB]"
            >
              [TAB] Oyuncular
            </button>

            <button
              onClick={() => {
                setIsChatOpen((c) => !c);
                if (document.pointerLockElement) document.exitPointerLock();
              }}
              className="px-2.5 py-1.5 bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700/80 text-xs font-arcade shadow-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
              title="Sunucu Sohbeti [T]"
            >
              <span>[T] Sohbet</span>
            </button>

            <button
              onClick={() => setIsInviteOpen(true)}
              className="px-2.5 py-1.5 bg-purple-900/80 hover:bg-purple-800 text-purple-200 hover:text-white rounded-lg border border-purple-600/80 text-xs font-arcade shadow-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
              title="Arkadaşını Çağır"
            >
              <Users className="w-3.5 h-3.5 text-purple-300" />
              <span>Davet Et</span>
            </button>
          </div>
          {/* Crosshair (Minecraft Classic Cross) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-4 h-4 flex items-center justify-center">
              <div className="w-3.5 h-0.5 bg-white/90 drop-shadow" />
              <div className="h-3.5 w-0.5 bg-white/90 absolute drop-shadow" />
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
              <div className="bg-[#c6c6c6] border-4 border-t-white border-l-white border-b-[#555] border-r-[#555] p-5 w-full max-w-[440px] shadow-2xl rounded-none text-slate-800 select-none flex flex-col gap-4 relative font-mono text-xs">
                
                {/* Close Button x */}
                <button 
                  onClick={() => setShowCrafting(false)}
                  className="absolute top-2 right-2 font-arcade text-xs text-slate-600 hover:text-black hover:bg-slate-300 px-1.5 py-0.5 border border-slate-400"
                >
                  X
                </button>

                {/* Top Section: Armor, Preview, Crafting 2x2 */}
                <div className="flex gap-4 items-start justify-between">
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

                  {/* Center: Steve 2D Preview (black rectangle) */}
                  <div className="flex-1 max-w-[120px] h-[152px] bg-black border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white flex items-center justify-center relative overflow-hidden">
                    {/* Retro Steve Pixel representation */}
                    <div className="flex flex-col items-center gap-1 scale-110">
                      {/* Head */}
                      <div className="w-7 h-7 bg-[#fcd34d] border border-[#b45309]" />
                      {/* Body (shirt) */}
                      <div className="w-10 h-10 bg-[#0ea5e9] border border-[#0369a1] flex justify-between px-1">
                        <div className="w-1.5 h-6 bg-[#fcd34d]" />
                        <div className="w-1.5 h-6 bg-[#fcd34d]" />
                      </div>
                      {/* Pants */}
                      <div className="w-9 h-10 bg-[#1e3a8a] border border-[#172554] flex justify-between px-2">
                        <div className="w-2.5 h-full bg-[#1e3a8a]" />
                        <div className="w-2.5 h-full bg-[#1e3a8a]" />
                      </div>
                    </div>
                  </div>

                  {/* Right: Crafting 2x2 grid */}
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-arcade text-slate-700 mb-1 mr-4">Crafting</span>
                    <div className="flex items-center gap-3">
                      {/* 2x2 slots */}
                      <div className="grid grid-cols-2 gap-1 bg-[#8b8b8b] p-1 border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div 
                            key={i} 
                            className="w-9 h-9 bg-[#8b8b8b] border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white hover:bg-slate-300 cursor-pointer"
                          />
                        ))}
                      </div>
                      
                      {/* Crafting Arrow */}
                      <div className="text-slate-600 font-bold text-lg select-none">➡</div>

                      {/* Result Output slot */}
                      <div className="w-11 h-11 bg-[#8b8b8b] border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white flex items-center justify-center hover:bg-slate-300 cursor-pointer">
                        <div className="w-7 h-7 bg-amber-400 border border-amber-600" title="Output slot" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Middle line separator */}
                <div className="border-t-2 border-slate-400 my-1" />

                {/* Bottom Section: Inventory Grid 3x9 */}
                <div>
                  <span className="text-[10px] font-arcade text-slate-700 mb-1 block">Inventory (Kuşanmak İçin Sürükleyin)</span>
                  <div className="grid grid-cols-9 gap-1 bg-[#8b8b8b] p-1.5 border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white">
                    {Array.from({ length: 27 }).map((_, i) => {
                      const itemEntries = Object.entries(inventory).filter(([_, count]) => count > 0);
                      const hasItem = itemEntries[i];
                      
                      return (
                        <div 
                          key={i} 
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
                              {/* Beautiful 3D Isometric Textured Icon */}
                              <MinecraftBlockIcon type={hasItem[0] as BlockType} size={24} />
                              <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold text-white bg-slate-900/60 px-0.5 rounded pointer-events-none">
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
                <div className="mt-1">
                  <span className="text-[10px] font-arcade text-slate-700 mb-1 block">Hotbar (Hızlı Erişim - Drop Slotu)</span>
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
                            isSelected ? 'bg-amber-400/20 border-amber-400' : ''
                          }`}
                        >
                          {blk ? (
                            <>
                              <MinecraftBlockIcon type={blk} size={20} />
                              <span className="absolute bottom-0.5 right-0.5 text-[7px] font-bold text-white bg-slate-900/60 px-0.5 rounded">
                                {inventory[blk] || 0}
                              </span>
                            </>
                          ) : null}
                          <span className="absolute top-0.5 left-0.5 text-[7px] font-bold text-slate-400">
                            {idx + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Crafting Action Shortcuts at bottom */}
                <div className="flex gap-2 justify-between mt-2 pt-2 border-t border-slate-400">
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
                    onClick={() => setIsMenuOpen(true)}
                    className="py-2 bg-[#9333ea] hover:bg-[#a855f7] text-[#f3e8ff] hover:text-[#ffffa0] border-2 border-t-[#d8b4fe] border-l-[#d8b4fe] border-b-[#581c87] border-r-[#581c87] font-arcade text-[10px] tracking-wide shadow-md rounded-none"
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
                  [E] Envanter · [C / F5] Bakış Açısı · [F / F11] Tam Ekran
                </div>

                <button
                  onClick={() => {
                    if (confirm("Lobiye geri dönmek istiyor musunuz? İlerlemeniz kaydedilecektir.")) {
                      setGameStarted(false);
                      setIsPaused(false);
                    }
                  }}
                  className="w-full py-2.5 bg-[#9333ea] hover:bg-[#a855f7] text-[#f3e8ff] hover:text-[#ffffa0] border-2 border-t-[#d8b4fe] border-l-[#d8b4fe] border-b-[#581c87] border-r-[#581c87] font-arcade text-xs tracking-wider shadow-md rounded-none"
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

          {/* In-Game Minecraft Chat Overlay & Input */}
          <div className="absolute bottom-20 left-4 z-40 max-w-sm w-full pointer-events-auto flex flex-col gap-1.5 select-none font-mono text-xs">
            {/* Recent chat log */}
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pointer-events-none p-1">
              {chatMessages.slice(-6).map((msg, i) => (
                <div
                  key={i}
                  className="bg-black/65 text-white px-2.5 py-1 rounded border border-white/10 backdrop-blur-sm animate-fade-in inline-block shadow-md"
                >
                  <span style={{ color: msg.color || '#38bdf8' }} className="font-bold mr-1.5">
                    &lt;{msg.name}&gt;
                  </span>
                  <span className="text-slate-100">{msg.text}</span>
                </div>
              ))}
            </div>

            {/* Active Chat Input Bar */}
            {isChatOpen && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatInputText.trim()) {
                    sendChat(chatInputText.trim());
                    setChatInputText('');
                  }
                  setIsChatOpen(false);
                  containerRef.current?.requestPointerLock?.();
                }}
                className="flex items-center gap-1.5 bg-slate-950/90 border-2 border-amber-400 p-1.5 rounded-lg shadow-2xl backdrop-blur-md"
              >
                <span className="text-amber-400 font-arcade text-[10px] pl-1 font-bold">[Sohbet]:</span>
                <input
                  type="text"
                  value={chatInputText}
                  onChange={(e) => setChatInputText(e.target.value)}
                  placeholder="Mesajınızı yazın ve Enter'a basın..."
                  autoFocus
                  maxLength={120}
                  className="flex-1 bg-transparent text-white px-2 py-1 text-xs focus:outline-none font-sans"
                />
                <button
                  type="submit"
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs active:scale-95 cursor-pointer"
                >
                  Gönder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsChatOpen(false);
                    containerRef.current?.requestPointerLock?.();
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded text-xs cursor-pointer"
                >
                  ✕
                </button>
              </form>
            )}
          </div>

          {/* TAB Menu: Online Connected Players Overlay */}
          {showPlayerList && (
            <div className="absolute inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#1e1b4b]/95 border-4 border-[#818cf8] p-5 max-w-md w-full shadow-2xl rounded-none text-white font-mono text-xs select-none">
                <div className="flex justify-between items-center mb-4 border-b border-indigo-500/40 pb-2">
                  <div>
                    <h3 className="font-arcade text-sm text-yellow-300">MINECRAFT ONLINE ARENA</h3>
                    <p className="text-[10px] text-indigo-300">Sunucudaki Aktif Oyuncular ({players.size + 1})</p>
                  </div>
                  <button
                    onClick={() => setShowPlayerList(false)}
                    className="px-2 py-1 bg-indigo-900 hover:bg-indigo-800 text-white rounded font-arcade text-xs border border-indigo-400 cursor-pointer"
                  >
                    Kapat [TAB]
                  </button>
                </div>

                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                  {/* Local Player */}
                  <div className="flex items-center justify-between p-2.5 bg-emerald-950/60 border border-emerald-500/50 rounded">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-4 h-4 rounded-full border border-white"
                        style={{ backgroundColor: playerColor }}
                      />
                      <span className="font-bold text-emerald-300">{playerName} (Sen)</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-yellow-400 font-arcade">{score} Puan</span>
                      <span className="text-emerald-400">{ping}ms</span>
                    </div>
                  </div>

                  {/* Remote Connected Players */}
                  {Array.from(players.values()).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 bg-slate-900/80 border border-slate-700 rounded hover:border-indigo-400"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-4 h-4 rounded-full border border-white/60"
                          style={{ backgroundColor: p.color || '#38bdf8' }}
                        />
                        <span className="font-semibold text-slate-200">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-yellow-400 font-arcade">{p.score || 0} Puan</span>
                        <span className="text-emerald-400">Canlı</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-indigo-500/30 flex justify-between items-center text-[10px] text-indigo-300">
                  <span>⚡ Socket.io Gerçek Zamanlı Blok & Oyuncu Senkronizasyonu</span>
                  <span className="text-emerald-400 font-bold">● Canlı</span>
                </div>
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
