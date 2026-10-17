import * as THREE from 'three';
import {
  BlockId,
  BlockName,
  BLOCK_ID_TO_NAME,
  BLOCK_NAME_TO_ID,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  WORLD_MIN_Y,
} from './VoxelConstants';
import { Chunk } from './Chunk';
import { TextureAtlas } from './TextureAtlas';
import { SimplexNoise } from './SimplexNoise';
import { VoxelWorkerPool } from './VoxelWorker';
import { VoxelWorldAccessor } from './ChunkMesher';

export interface ChunkManagerOptions {
  scene: THREE.Scene;
  renderDistance?: number;
  seed?: number;
  useWorker?: boolean;
}

export interface GroundHeightResult {
  groundY: number;
  isLoaded: boolean;
  isSolid: boolean;
}

export class ChunkManager implements VoxelWorldAccessor {
  public readonly scene: THREE.Scene;
  public renderDistance: number;
  public readonly seed: number;

  private chunks = new Map<string, Chunk>();
  private atlas: TextureAtlas;
  private noise: SimplexNoise;
  private workerPool: VoxelWorkerPool | null = null;

  private lastPlayerChunkX = NaN;
  private lastPlayerChunkZ = NaN;
  private lastLookaheadChunkX = NaN;
  private lastLookaheadChunkZ = NaN;

  // Queue of chunks awaiting terrain generation or meshing
  private meshQueue: Chunk[] = [];
  private activeMeshesList: THREE.Mesh[] = [];
  private meshesListDirty = true;

  constructor(options: ChunkManagerOptions) {
    this.scene = options.scene;
    this.renderDistance = options.renderDistance ?? 4;
    this.seed = options.seed ?? 1337;

    this.noise = new SimplexNoise(this.seed);
    this.atlas = TextureAtlas.getInstance();

    if (options.useWorker !== false) {
      this.workerPool = new VoxelWorkerPool(this.seed);
    }
  }

  public getChunkKey(chunkX: number, chunkZ: number): string {
    return `${chunkX},${chunkZ}`;
  }

  public getChunk(chunkX: number, chunkZ: number): Chunk | undefined {
    return this.chunks.get(this.getChunkKey(chunkX, chunkZ));
  }

  /**
   * Checks if a chunk at world coordinates (wx, wz) is loaded and has terrain voxels ready.
   */
  public isChunkReadyAt(wx: number, wz: number): boolean {
    const chunkX = Math.floor(wx / CHUNK_SIZE_X);
    const chunkZ = Math.floor(wz / CHUNK_SIZE_Z);
    const chunk = this.getChunk(chunkX, chunkZ);
    return chunk !== undefined && chunk.isGenerated;
  }

  /**
   * Implements VoxelWorldAccessor interface for ChunkMesher
   */
  public getVoxel(wx: number, wy: number, wz: number): BlockId {
    const ix = Math.floor(wx);
    const iy = Math.floor(wy);
    const iz = Math.floor(wz);

    const chunkX = Math.floor(ix / CHUNK_SIZE_X);
    const chunkZ = Math.floor(iz / CHUNK_SIZE_Z);
    const chunk = this.getChunk(chunkX, chunkZ);
    if (!chunk || !chunk.isGenerated) return BlockId.AIR;

    const lx = ((ix % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const ly = iy - WORLD_MIN_Y;
    const lz = ((iz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    if (ly < 0 || ly >= CHUNK_SIZE_Y) return BlockId.AIR;

    return chunk.getVoxel(lx, ly, lz);
  }

  public hasBlock(wx: number, wy: number, wz: number): boolean {
    return this.getVoxel(wx, wy, wz) !== BlockId.AIR;
  }

  public getBlockName(wx: number, wy: number, wz: number): BlockName {
    const id = this.getVoxel(wx, wy, wz);
    return BLOCK_ID_TO_NAME[id] || 'air';
  }

  /**
   * Safe Block Breaking function:
   * 1. Updates chunk voxel array (Uint8Array) to BlockId.AIR
   * 2. Marks chunk as dirty (isDirty = true)
   * 3. Triggers immediate re-meshing and safe geometry disposal
   * 4. Updates adjacent chunks if on chunk boundaries
   * 5. Invalidates active meshes cache so raycasting doesn't hit stale geometry
   */
  public breakBlock(wx: number, wy: number, wz: number): BlockName | null {
    const ix = Math.floor(wx);
    const iy = Math.floor(wy);
    const iz = Math.floor(wz);

    const chunkX = Math.floor(ix / CHUNK_SIZE_X);
    const chunkZ = Math.floor(iz / CHUNK_SIZE_Z);
    const chunk = this.getChunk(chunkX, chunkZ);
    if (!chunk || !chunk.isGenerated) return null;

    const lx = ((ix % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const ly = iy - WORLD_MIN_Y;
    const lz = ((iz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    if (ly < 0 || ly >= CHUNK_SIZE_Y) return null;

    const prevId = chunk.getVoxel(lx, ly, lz);
    if (prevId === BlockId.AIR) return null;

    const prevName = BLOCK_ID_TO_NAME[prevId] || 'stone';

    // 1. Update voxel array to AIR and flag dirty
    chunk.setVoxel(lx, ly, lz, BlockId.AIR);

    // 2. Re-mesh this chunk immediately (disposes old geometry)
    this.rebuildChunk(chunk);

    // 3. Re-mesh adjacent chunk if the broken block was touching an edge
    if (lx === 0) {
      const neighbor = this.getChunk(chunkX - 1, chunkZ);
      if (neighbor) this.rebuildChunk(neighbor);
    } else if (lx === CHUNK_SIZE_X - 1) {
      const neighbor = this.getChunk(chunkX + 1, chunkZ);
      if (neighbor) this.rebuildChunk(neighbor);
    }

    if (lz === 0) {
      const neighbor = this.getChunk(chunkX, chunkZ - 1);
      if (neighbor) this.rebuildChunk(neighbor);
    } else if (lz === CHUNK_SIZE_Z - 1) {
      const neighbor = this.getChunk(chunkX, chunkZ + 1);
      if (neighbor) this.rebuildChunk(neighbor);
    }

    this.meshesListDirty = true;
    return prevName;
  }

  /**
   * Modifies or places a block in the world.
   */
  public setBlock(wx: number, wy: number, wz: number, type: BlockName | BlockId): boolean {
    const blockId = typeof type === 'string' ? (BLOCK_NAME_TO_ID[type] ?? BlockId.AIR) : type;

    if (blockId === BlockId.AIR) {
      return this.breakBlock(wx, wy, wz) !== null;
    }

    const ix = Math.floor(wx);
    const iy = Math.floor(wy);
    const iz = Math.floor(wz);

    const chunkX = Math.floor(ix / CHUNK_SIZE_X);
    const chunkZ = Math.floor(iz / CHUNK_SIZE_Z);
    let chunk = this.getChunk(chunkX, chunkZ);

    if (!chunk) {
      chunk = new Chunk(chunkX, chunkZ);
      chunk.generateTerrain(this.noise);
      this.chunks.set(this.getChunkKey(chunkX, chunkZ), chunk);
    }

    const lx = ((ix % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const ly = iy - WORLD_MIN_Y;
    const lz = ((iz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    if (ly < 0 || ly >= CHUNK_SIZE_Y) return false;

    const changed = chunk.setVoxel(lx, ly, lz, blockId);
    if (changed) {
      this.rebuildChunk(chunk);

      if (lx === 0) {
        const neighbor = this.getChunk(chunkX - 1, chunkZ);
        if (neighbor) this.rebuildChunk(neighbor);
      } else if (lx === CHUNK_SIZE_X - 1) {
        const neighbor = this.getChunk(chunkX + 1, chunkZ);
        if (neighbor) this.rebuildChunk(neighbor);
      }

      if (lz === 0) {
        const neighbor = this.getChunk(chunkX, chunkZ - 1);
        if (neighbor) this.rebuildChunk(neighbor);
      } else if (lz === CHUNK_SIZE_Z - 1) {
        const neighbor = this.getChunk(chunkX, chunkZ + 1);
        if (neighbor) this.rebuildChunk(neighbor);
      }

      this.meshesListDirty = true;
    }

    return changed;
  }

  /**
   * Rebuilds a chunk mesh safely. Disposes of old geometry before replacing.
   */
  public rebuildChunk(chunk: Chunk): void {
    const oldMesh = chunk.mesh;
    const newMesh = chunk.buildMesh(this, this.atlas);

    if (newMesh && !oldMesh) {
      this.scene.add(newMesh);
    } else if (!newMesh && oldMesh) {
      this.scene.remove(oldMesh);
    }
    this.meshesListDirty = true;
  }

  /**
   * Main per-frame update loop.
   * Features:
   * 1. Pre-generation / Prediction: prioritizes chunks ahead of movement direction
   * 2. Immediate 3x3 footprint generation around the player
   * 3. Time-sliced meshing queue (up to 3 chunks per frame)
   */
  public update(playerX: number, playerZ: number, velX = 0, velZ = 0): void {
    const currentChunkX = Math.floor(playerX / CHUNK_SIZE_X);
    const currentChunkZ = Math.floor(playerZ / CHUNK_SIZE_Z);

    // 1. DIRECTIONAL LOOKAHEAD: Predict target chunk from player velocity
    const speed = Math.hypot(velX, velZ);
    let lookaheadChunkX = currentChunkX;
    let lookaheadChunkZ = currentChunkZ;
    if (speed > 0.05) {
      lookaheadChunkX = Math.floor((playerX + (velX / speed) * 24) / CHUNK_SIZE_X);
      lookaheadChunkZ = Math.floor((playerZ + (velZ / speed) * 24) / CHUNK_SIZE_Z);
    }

    // 2. IMMEDIATE SAFETY: Ensure the 3x3 immediate footprint (player's chunk + 8 neighbors)
    // has voxel data generated synchronously right now so the player NEVER outruns collision data!
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = currentChunkX + dx;
        const cz = currentChunkZ + dz;
        const key = this.getChunkKey(cx, cz);
        let chunk = this.chunks.get(key);
        if (!chunk) {
          chunk = new Chunk(cx, cz);
          chunk.generateTerrain(this.noise);
          this.chunks.set(key, chunk);
          this.meshQueue.unshift(chunk); // Priority queue at front
        } else if (!chunk.isGenerated) {
          chunk.generateTerrain(this.noise);
          if (!this.meshQueue.includes(chunk)) {
            this.meshQueue.unshift(chunk);
          }
        }
      }
    }

    // Also pre-generate predicted target chunk if different
    if (lookaheadChunkX !== currentChunkX || lookaheadChunkZ !== currentChunkZ) {
      const predKey = this.getChunkKey(lookaheadChunkX, lookaheadChunkZ);
      let predChunk = this.chunks.get(predKey);
      if (!predChunk) {
        predChunk = new Chunk(lookaheadChunkX, lookaheadChunkZ);
        predChunk.generateTerrain(this.noise);
        this.chunks.set(predKey, predChunk);
        this.meshQueue.unshift(predChunk);
      }
    }

    // 3. Update full grid and unload distant chunks when player or lookahead chunk changes
    const targetChanged =
      currentChunkX !== this.lastPlayerChunkX ||
      currentChunkZ !== this.lastPlayerChunkZ ||
      lookaheadChunkX !== this.lastLookaheadChunkX ||
      lookaheadChunkZ !== this.lastLookaheadChunkZ;

    if (targetChanged) {
      this.lastPlayerChunkX = currentChunkX;
      this.lastPlayerChunkZ = currentChunkZ;
      this.lastLookaheadChunkX = lookaheadChunkX;
      this.lastLookaheadChunkZ = lookaheadChunkZ;
      this.updateChunkGrid(currentChunkX, currentChunkZ, lookaheadChunkX, lookaheadChunkZ);
    }

    // Process up to 3 chunks per frame from the mesh queue
    let processedCount = 0;
    while (this.meshQueue.length > 0 && processedCount < 3) {
      const chunk = this.meshQueue.shift();
      if (chunk && !chunk.disposed && chunk.isDirty) {
        this.rebuildChunk(chunk);
        processedCount++;
      }
    }
  }

  /**
   * Dynamic chunk loading & garbage-collected unloading.
   */
  private updateChunkGrid(
    centerChunkX: number,
    centerChunkZ: number,
    lookaheadChunkX: number,
    lookaheadChunkZ: number
  ): void {
    const rd = this.renderDistance;
    const maxDistSq = rd * rd;
    const unloadDistSq = (rd + 1.8) * (rd + 1.8);

    // 1. UNLOAD & DISPOSE distant chunks (Prevents Memory Leaks)
    const toUnload: string[] = [];
    this.chunks.forEach((chunk, key) => {
      const dx = chunk.chunkX - centerChunkX;
      const dz = chunk.chunkZ - centerChunkZ;
      if (dx * dx + dz * dz > unloadDistSq) {
        toUnload.push(key);
      }
    });

    for (const key of toUnload) {
      const chunk = this.chunks.get(key);
      if (chunk) {
        chunk.dispose(this.scene);
        this.chunks.delete(key);
        this.meshesListDirty = true;
      }
    }

    // 2. LOAD chunks within renderDistance
    const newChunksToLoad: { chunk: Chunk; priority: number }[] = [];

    for (let dx = -rd; dx <= rd; dx++) {
      for (let dz = -rd; dz <= rd; dz++) {
        const distSq = dx * dx + dz * dz;
        if (distSq > maxDistSq) continue;

        const cx = centerChunkX + dx;
        const cz = centerChunkZ + dz;
        const key = this.getChunkKey(cx, cz);

        // Movement-prioritized weighting: chunks along forward direction are loaded first
        const distToPlayerSq = (cx - centerChunkX) ** 2 + (cz - centerChunkZ) ** 2;
        const distToLookaheadSq = (cx - lookaheadChunkX) ** 2 + (cz - lookaheadChunkZ) ** 2;
        const priority = Math.min(distToPlayerSq, distToLookaheadSq * 0.7);

        let chunk = this.chunks.get(key);
        if (!chunk) {
          chunk = new Chunk(cx, cz);
          this.chunks.set(key, chunk);

          const targetChunk = chunk;
          if (this.workerPool?.isAvailable()) {
            this.workerPool.requestChunk(cx, cz, (result) => {
              if (!targetChunk.disposed) {
                targetChunk.voxels = result.voxels;
                targetChunk.isGenerated = true;
                targetChunk.isDirty = true;
                this.meshQueue.push(targetChunk);
              }
            });
          } else {
            chunk.generateTerrain(this.noise);
            newChunksToLoad.push({ chunk, priority });
          }
        } else if (chunk.isDirty) {
          newChunksToLoad.push({ chunk, priority });
        }
      }
    }

    // Sort by priority (movement direction and proximity first)
    newChunksToLoad.sort((a, b) => a.priority - b.priority);
    for (const item of newChunksToLoad) {
      if (!this.meshQueue.includes(item.chunk)) {
        this.meshQueue.push(item.chunk);
      }
    }
  }

  /**
   * Fast synchronous initialization of chunks immediately around spawn.
   */
  public generateInitialArea(spawnX = 0, spawnZ = 0, radius = 3): void {
    const centerChunkX = Math.floor(spawnX / CHUNK_SIZE_X);
    const centerChunkZ = Math.floor(spawnZ / CHUNK_SIZE_Z);

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const cx = centerChunkX + dx;
        const cz = centerChunkZ + dz;
        const key = this.getChunkKey(cx, cz);

        let chunk = this.chunks.get(key);
        if (!chunk) {
          chunk = new Chunk(cx, cz);
          chunk.generateTerrain(this.noise);
          this.chunks.set(key, chunk);
        }
      }
    }

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const cx = centerChunkX + dx;
        const cz = centerChunkZ + dz;
        const chunk = this.getChunk(cx, cz);
        if (chunk && chunk.isDirty) {
          this.rebuildChunk(chunk);
        }
      }
    }

    this.meshesListDirty = true;
  }

  /**
   * Safe ground height detector with safety net support.
   * If the chunk beneath feet has not finished generating, returns isLoaded: false
   * and groundY = currentFeetY so player vertical velocity is frozen and they never fall through!
   */
  public getGroundHeightResult(x: number, z: number, currentFeetY: number): GroundHeightResult {
    const footprintRadius = 0.28;
    const samplePoints: [number, number][] = [
      [0, 0],
      [footprintRadius, 0],
      [-footprintRadius, 0],
      [0, footprintRadius],
      [0, -footprintRadius],
    ];

    let allLoaded = true;
    for (const [ox, oz] of samplePoints) {
      if (!this.isChunkReadyAt(x + ox, z + oz)) {
        allLoaded = false;
        break;
      }
    }

    // SAFETY NET: chunk not ready yet; hold player suspended safely!
    if (!allLoaded) {
      return {
        groundY: currentFeetY,
        isLoaded: false,
        isSolid: true,
      };
    }

    let maxGroundY = -30;
    const startY = Math.min(28, Math.floor(currentFeetY + 0.6));

    for (const [ox, oz] of samplePoints) {
      const sx = Math.round(x + ox);
      const sz = Math.round(z + oz);

      for (let y = startY; y >= -10; y--) {
        if (this.hasBlock(sx, y, sz)) {
          const topFaceY = y + 0.5;
          if (topFaceY > maxGroundY) {
            maxGroundY = topFaceY;
          }
          break;
        }
      }
    }

    if (maxGroundY > -30) {
      return {
        groundY: maxGroundY,
        isLoaded: true,
        isSolid: true,
      };
    }

    // Fallback baseline for open caves/void
    return {
      groundY: -9.5,
      isLoaded: true,
      isSolid: false,
    };
  }

  public getGroundHeightAt(x: number, z: number, currentFeetY: number): number {
    return this.getGroundHeightResult(x, z, currentFeetY).groundY;
  }

  /**
   * Cached list of active chunk meshes for raycasting.
   */
  public getActiveChunkMeshes(): THREE.Mesh[] {
    if (this.meshesListDirty) {
      this.activeMeshesList = [];
      this.chunks.forEach((chunk) => {
        if (chunk.mesh) {
          this.activeMeshesList.push(chunk.mesh);
        }
      });
      this.meshesListDirty = false;
    }
    return this.activeMeshesList;
  }

  public getLoadedChunksCount(): number {
    return this.chunks.size;
  }

  public getTotalMeshedChunksCount(): number {
    let count = 0;
    this.chunks.forEach((c) => {
      if (c.mesh) count++;
    });
    return count;
  }

  /**
   * Full cleanup and disposal of all GPU assets and worker threads.
   */
  public dispose(): void {
    this.chunks.forEach((chunk) => {
      chunk.dispose(this.scene);
    });
    this.chunks.clear();
    this.meshQueue = [];
    this.activeMeshesList = [];

    if (this.workerPool) {
      this.workerPool.dispose();
      this.workerPool = null;
    }
  }
}
