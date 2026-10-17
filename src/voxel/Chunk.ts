import * as THREE from 'three';
import {
  BlockId,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  CHUNK_VOLUME,
  WORLD_MIN_Y,
} from './VoxelConstants';
import { ChunkMesher, VoxelWorldAccessor } from './ChunkMesher';
import { TextureAtlas } from './TextureAtlas';
import { SimplexNoise } from './SimplexNoise';

export class Chunk {
  public readonly chunkX: number;
  public readonly chunkZ: number;
  public readonly worldStartX: number;
  public readonly worldStartZ: number;

  public voxels: Uint8Array;
  public mesh: THREE.Mesh | null = null;
  public isDirty = false;
  public isGenerated = false;
  public disposed = false;

  constructor(chunkX: number, chunkZ: number) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.worldStartX = chunkX * CHUNK_SIZE_X;
    this.worldStartZ = chunkZ * CHUNK_SIZE_Z;
    this.voxels = new Uint8Array(CHUNK_VOLUME);
  }

  public getIndex(lx: number, ly: number, lz: number): number {
    return lx + CHUNK_SIZE_X * (lz + CHUNK_SIZE_Z * ly);
  }

  public getVoxel(lx: number, ly: number, lz: number): BlockId {
    if (lx < 0 || lx >= CHUNK_SIZE_X || ly < 0 || ly >= CHUNK_SIZE_Y || lz < 0 || lz >= CHUNK_SIZE_Z) {
      return BlockId.AIR;
    }
    return this.voxels[this.getIndex(lx, ly, lz)];
  }

  public setVoxel(lx: number, ly: number, lz: number, id: BlockId): boolean {
    if (lx < 0 || lx >= CHUNK_SIZE_X || ly < 0 || ly >= CHUNK_SIZE_Y || lz < 0 || lz >= CHUNK_SIZE_Z) {
      return false;
    }
    const idx = this.getIndex(lx, ly, lz);
    if (this.voxels[idx] !== id) {
      this.voxels[idx] = id;
      this.isDirty = true;
      return true;
    }
    return false;
  }

  /**
   * Procedural terrain generator using multi-octave 2D Simplex Noise.
   */
  public generateTerrain(noise: SimplexNoise): void {
    if (this.isGenerated) return;

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      const wx = this.worldStartX + lx;

      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const wz = this.worldStartZ + lz;

        // Base rolling hills using fBm
        const continentalness = noise.fbm2D(wx * 0.015, wz * 0.015, 3, 0.45, 2.0);
        const detail = noise.noise2D(wx * 0.05, wz * 0.05) * 1.5;
        const rawHeight = continentalness * 6 + detail + 6;
        const surfaceWorldY = Math.max(1, Math.min(CHUNK_SIZE_Y + WORLD_MIN_Y - 6, Math.floor(rawHeight)));
        const surfaceLocalY = surfaceWorldY - WORLD_MIN_Y;

        // Bedrock layer at local y = 0
        this.voxels[this.getIndex(lx, 0, lz)] = BlockId.STONE;

        // Underground stone & diamond ores
        for (let ly = 1; ly < surfaceLocalY - 2; ly++) {
          // Ores generation using hash/noise
          const oreNoise = noise.noise2D(wx * 0.2 + ly * 0.3, wz * 0.2 - ly * 0.1);
          const isDiamond = ly < 6 && oreNoise > 0.62;
          this.voxels[this.getIndex(lx, ly, lz)] = isDiamond ? BlockId.DIAMOND : BlockId.STONE;
        }

        // Subsurface dirt layer (2-3 blocks)
        for (let ly = Math.max(1, surfaceLocalY - 2); ly < surfaceLocalY; ly++) {
          this.voxels[this.getIndex(lx, ly, lz)] = BlockId.DIRT;
        }

        // Surface grass block
        if (surfaceLocalY < CHUNK_SIZE_Y) {
          this.voxels[this.getIndex(lx, surfaceLocalY, lz)] = BlockId.GRASS;
        }

        // Procedural trees on grassy surface
        const treeNoise = (Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453) % 1;
        if (Math.abs(treeNoise) < 0.025 && lx >= 2 && lx <= CHUNK_SIZE_X - 3 && lz >= 2 && lz <= CHUNK_SIZE_Z - 3) {
          const trunkBase = surfaceLocalY + 1;
          const isBirch = (Math.sin(wx * 3.1) + Math.cos(wz * 2.7)) > 0.4;
          const woodId = isBirch ? BlockId.BIRCH : BlockId.WOOD;

          // 3-block tall trunk
          for (let ty = 0; ty < 3; ty++) {
            if (trunkBase + ty < CHUNK_SIZE_Y) {
              this.voxels[this.getIndex(lx, ty + trunkBase, lz)] = woodId;
            }
          }

          // Foliage canopy
          const leafY = trunkBase + 3;
          for (let ox = -1; ox <= 1; ox++) {
            for (let oz = -1; oz <= 1; oz++) {
              if (Math.abs(ox) + Math.abs(oz) <= 2) {
                const tx = lx + ox;
                const tz = lz + oz;
                if (tx >= 0 && tx < CHUNK_SIZE_X && tz >= 0 && tz < CHUNK_SIZE_Z && leafY < CHUNK_SIZE_Y) {
                  this.voxels[this.getIndex(tx, leafY, tz)] = BlockId.LEAVES;
                }
              }
            }
          }
          if (leafY + 1 < CHUNK_SIZE_Y) {
            this.voxels[this.getIndex(lx, leafY + 1, lz)] = BlockId.LEAVES;
          }
        }
      }
    }

    this.isGenerated = true;
    this.isDirty = true;
  }

  /**
   * Generates or updates the chunk's single THREE.Mesh using visible face culling.
   */
  public buildMesh(world: VoxelWorldAccessor, atlas: TextureAtlas): THREE.Mesh | null {
    if (this.disposed) return null;

    const meshData = ChunkMesher.buildChunkMesh(this.chunkX, this.chunkZ, this.voxels, world);
    if (!meshData) {
      if (this.mesh) {
        this.mesh.geometry.dispose();
        if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
        this.mesh = null;
      }
      this.isDirty = false;
      return null;
    }

    const geometry = ChunkMesher.createGeometry(meshData);

    if (this.mesh) {
      // Re-use existing mesh object, replace geometry and dispose previous
      this.mesh.geometry.dispose();
      this.mesh.geometry = geometry;
    } else {
      // Create new mesh with shared atlas material (1 Draw Call!)
      this.mesh = new THREE.Mesh(geometry, atlas.material);
      this.mesh.position.set(this.worldStartX, WORLD_MIN_Y, this.worldStartZ);
      this.mesh.name = `chunk_${this.chunkX}_${this.chunkZ}`;
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
    }

    this.isDirty = false;
    return this.mesh;
  }

  /**
   * Disposes of GPU geometry and removes mesh from scene to prevent memory leaks.
   */
  public dispose(scene?: THREE.Scene | null): void {
    this.disposed = true;
    if (this.mesh) {
      if (scene) {
        scene.remove(this.mesh);
      } else if (this.mesh.parent) {
        this.mesh.parent.remove(this.mesh);
      }
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
  }
}
