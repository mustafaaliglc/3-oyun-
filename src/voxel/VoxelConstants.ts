/**
 * Voxel Engine Core Constants and Data Enums.
 */

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Y = 36; // -12 to 24 world height coverage
export const CHUNK_SIZE_Z = 16;
export const CHUNK_VOLUME = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
export const WORLD_MIN_Y = -10;

export enum BlockId {
  AIR = 0,
  GRASS = 1,
  STONE = 2,
  DIRT = 3,
  WOOD = 4,
  BIRCH = 5,
  LEAVES = 6,
  DIAMOND = 7,
  GLASS = 8,
  BRICK = 9,
  TNT = 10,
  BEEF = 11,
  BEDROCK = 12,
}

export type BlockName =
  | 'air'
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
  | 'beef'
  | 'bedrock';

export const BLOCK_NAME_TO_ID: Record<string, BlockId> = {
  air: BlockId.AIR,
  grass: BlockId.GRASS,
  stone: BlockId.STONE,
  dirt: BlockId.DIRT,
  wood: BlockId.WOOD,
  birch: BlockId.BIRCH,
  leaves: BlockId.LEAVES,
  diamond: BlockId.DIAMOND,
  glass: BlockId.GLASS,
  brick: BlockId.BRICK,
  tnt: BlockId.TNT,
  beef: BlockId.BEEF,
  bedrock: BlockId.BEDROCK,
};

export const BLOCK_ID_TO_NAME: Record<BlockId, BlockName> = {
  [BlockId.AIR]: 'air',
  [BlockId.GRASS]: 'grass',
  [BlockId.STONE]: 'stone',
  [BlockId.DIRT]: 'dirt',
  [BlockId.WOOD]: 'wood',
  [BlockId.BIRCH]: 'birch',
  [BlockId.LEAVES]: 'leaves',
  [BlockId.DIAMOND]: 'diamond',
  [BlockId.GLASS]: 'glass',
  [BlockId.BRICK]: 'brick',
  [BlockId.TNT]: 'tnt',
  [BlockId.BEEF]: 'beef',
  [BlockId.BEDROCK]: 'bedrock',
};

// Transparency table: faces are rendered against transparent blocks
export const IS_TRANSPARENT_BLOCK = new Uint8Array([
  1, // AIR
  0, // GRASS
  0, // STONE
  0, // DIRT
  0, // WOOD
  0, // BIRCH
  1, // LEAVES (translucent)
  0, // DIAMOND
  1, // GLASS (transparent)
  0, // BRICK
  0, // TNT
  1, // BEEF (has alpha corners)
  0, // BEDROCK
]);

// 6 Directional Cube Faces
export interface VoxelFace {
  dir: [number, number, number];
  name: 'right' | 'left' | 'top' | 'bottom' | 'front' | 'back';
  normal: [number, number, number];
  corners: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
}

export const VOXEL_FACES: VoxelFace[] = [
  // Right (+X)
  {
    dir: [1, 0, 0],
    name: 'right',
    normal: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
  },
  // Left (-X)
  {
    dir: [-1, 0, 0],
    name: 'left',
    normal: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
  },
  // Top (+Y)
  {
    dir: [0, 1, 0],
    name: 'top',
    normal: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  // Bottom (-Y)
  {
    dir: [0, -1, 0],
    name: 'bottom',
    normal: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  // Front (+Z)
  {
    dir: [0, 0, 1],
    name: 'front',
    normal: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },
  // Back (-Z)
  {
    dir: [0, 0, -1],
    name: 'back',
    normal: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  },
];
