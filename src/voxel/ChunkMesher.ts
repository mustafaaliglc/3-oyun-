import * as THREE from 'three';
import {
  BlockId,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  IS_TRANSPARENT_BLOCK,
  VOXEL_FACES,
} from './VoxelConstants';
import { TextureAtlas } from './TextureAtlas';

export interface ChunkMeshResult {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

export interface VoxelWorldAccessor {
  getVoxel(wx: number, wy: number, wz: number): BlockId;
}

/**
 * High-Performance Visible Face Culling Chunk Mesher.
 * Eliminates all internal/hidden block faces.
 * Emits vertex attributes for a single BufferGeometry (1 draw call per chunk).
 */
export class ChunkMesher {
  public static buildChunkMesh(
    chunkX: number,
    chunkZ: number,
    voxels: Uint8Array,
    world: VoxelWorldAccessor
  ): ChunkMeshResult | null {
    const worldStartX = chunkX * CHUNK_SIZE_X;
    const worldStartZ = chunkZ * CHUNK_SIZE_Z;

    // Dynamic arrays preallocated with initial capacity
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    let vertexCount = 0;

    const getVoxelInternal = (lx: number, ly: number, lz: number): BlockId => {
      if (lx < 0 || lx >= CHUNK_SIZE_X || ly < 0 || ly >= CHUNK_SIZE_Y || lz < 0 || lz >= CHUNK_SIZE_Z) {
        return world.getVoxel(worldStartX + lx, ly, worldStartZ + lz);
      }
      return voxels[lx + CHUNK_SIZE_X * (lz + CHUNK_SIZE_Z * ly)];
    };

    // Iterate through all voxels in the chunk
    for (let ly = 0; ly < CHUNK_SIZE_Y; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
          const blockId = voxels[lx + CHUNK_SIZE_X * (lz + CHUNK_SIZE_Z * ly)];
          if (blockId === BlockId.AIR) continue;

          const isCurrentTransparent = IS_TRANSPARENT_BLOCK[blockId] === 1;

          // Check each of the 6 faces for visibility (CULLING)
          for (let f = 0; f < VOXEL_FACES.length; f++) {
            const face = VOXEL_FACES[f];
            const [dx, dy, dz] = face.dir;
            const nx = lx + dx;
            const ny = ly + dy;
            const nz = lz + dz;

            const neighborBlock = getVoxelInternal(nx, ny, nz);

            // CULLING CONDITION:
            // Render face ONLY IF neighbor is AIR or transparent (or translucent leaves/glass against solid)
            let isFaceVisible = false;
            if (neighborBlock === BlockId.AIR) {
              isFaceVisible = true;
            } else {
              const isNeighborTransparent = IS_TRANSPARENT_BLOCK[neighborBlock] === 1;
              if (isNeighborTransparent && neighborBlock !== blockId) {
                isFaceVisible = true;
              }
            }

            if (!isFaceVisible) continue; // Culled! Saves GPU cycles and polygons

            // Face is visible: Emit Quad (4 vertices, 6 indices)
            const [uMin, vMin, uMax, vMax] = TextureAtlas.getTileUV(blockId, face.name);
            const corners = face.corners;
            const normal = face.normal;

            // Directional ambient shade for voxel depth
            let faceShade = 1.0;
            if (face.name === 'top') faceShade = 1.0;
            else if (face.name === 'bottom') faceShade = 0.55;
            else if (face.name === 'front' || face.name === 'back') faceShade = 0.82;
            else faceShade = 0.72;

            // 4 Vertices
            for (let i = 0; i < 4; i++) {
              const c = corners[i];
              positions.push(lx + c[0], ly + c[1], lz + c[2]);
              normals.push(normal[0], normal[1], normal[2]);
              colors.push(faceShade, faceShade, faceShade);
            }

            // UV mapping for the 4 corners of the quad
            uvs.push(uMin, vMin);
            uvs.push(uMax, vMin);
            uvs.push(uMax, vMax);
            uvs.push(uMin, vMax);

            // Two triangles (indices)
            indices.push(
              vertexCount,
              vertexCount + 1,
              vertexCount + 2,
              vertexCount,
              vertexCount + 2,
              vertexCount + 3
            );

            vertexCount += 4;
          }
        }
      }
    }

    if (positions.length === 0) return null;

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      colors: new Float32Array(colors),
      indices: new Uint32Array(indices),
    };
  }

  /**
   * Converts raw vertex attribute arrays into an optimized THREE.BufferGeometry.
   */
  public static createGeometry(data: ChunkMeshResult): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}
