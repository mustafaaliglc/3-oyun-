/**
 * Web Worker Integration for Asynchronous Procedural Voxel Generation.
 * Offloads CPU-intensive noise calculation and mesh vertex attribute generation
 * to a background Web Worker so the main render thread never drops frames.
 */

export interface WorkerJob {
  chunkX: number;
  chunkZ: number;
  seed: number;
}

export interface WorkerChunkResult {
  chunkX: number;
  chunkZ: number;
  voxels: Uint8Array;
}

// Inline worker script source
const WORKER_SCRIPT = `
// Fast seeded 2D Simplex Noise in worker
class WorkerNoise {
  constructor(seed = 1337) {
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = ((s >>> 16) & 0x7fff) % (i + 1);
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
    this.grad3 = new Float32Array([
      1,1,0, -1,1,0, 1,-1,0, -1,-1,0,
      1,0,1, -1,0,1, 1,0,-1, -1,0,-1,
      0,1,1,  0,-1,1, 0,1,-1,  0,-1,-1
    ]);
  }

  noise2D(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    let i1 = x0 > y0 ? 1 : 0;
    let j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * (this.grad3[gi0 * 3] * x0 + this.grad3[gi0 * 3 + 1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * (this.grad3[gi1 * 3] * x1 + this.grad3[gi1 * 3 + 1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * (this.grad3[gi2 * 3] * x2 + this.grad3[gi2 * 3 + 1] * y2);
    }
    return 70.0 * (n0 + n1 + n2);
  }

  fbm2D(x, y, octaves = 3, persistence = 0.45, lacunarity = 2.0) {
    let total = 0, freq = 1, amp = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * freq, y * freq) * amp;
      max += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return total / max;
  }
}

let noiseInstance = null;

self.onmessage = function(e) {
  const { chunkX, chunkZ, seed } = e.data;
  if (!noiseInstance) {
    noiseInstance = new WorkerNoise(seed);
  }

  const CHUNK_SIZE_X = 16;
  const CHUNK_SIZE_Y = 36;
  const CHUNK_SIZE_Z = 16;
  const WORLD_MIN_Y = -10;
  const volume = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
  const voxels = new Uint8Array(volume);

  const worldStartX = chunkX * CHUNK_SIZE_X;
  const worldStartZ = chunkZ * CHUNK_SIZE_Z;

  for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
    const wx = worldStartX + lx;
    for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
      const wz = worldStartZ + lz;
      const continentalness = noiseInstance.fbm2D(wx * 0.015, wz * 0.015, 3, 0.45, 2.0);
      const detail = noiseInstance.noise2D(wx * 0.05, wz * 0.05) * 1.5;
      const rawHeight = continentalness * 6 + detail + 6;
      const surfaceWorldY = Math.max(1, Math.min(CHUNK_SIZE_Y + WORLD_MIN_Y - 6, Math.floor(rawHeight)));
      const surfaceLocalY = surfaceWorldY - WORLD_MIN_Y;

      // Bedrock
      voxels[lx + CHUNK_SIZE_X * (lz + CHUNK_SIZE_Z * 0)] = 2; // STONE

      // Underground stone & ores
      for (let ly = 1; ly < surfaceLocalY - 2; ly++) {
        const oreNoise = noiseInstance.noise2D(wx * 0.2 + ly * 0.3, wz * 0.2 - ly * 0.1);
        const isDiamond = ly < 6 && oreNoise > 0.62;
        voxels[lx + CHUNK_SIZE_X * (lz + CHUNK_SIZE_Z * ly)] = isDiamond ? 7 : 2; // DIAMOND or STONE
      }

      // Dirt
      for (let ly = Math.max(1, surfaceLocalY - 2); ly < surfaceLocalY; ly++) {
        voxels[lx + CHUNK_SIZE_X * (lz + CHUNK_SIZE_Z * ly)] = 3; // DIRT
      }

      // Grass
      if (surfaceLocalY < CHUNK_SIZE_Y) {
        voxels[lx + CHUNK_SIZE_X * (lz + CHUNK_SIZE_Z * surfaceLocalY)] = 1; // GRASS
      }

      // Trees
      const treeNoise = (Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453) % 1;
      if (Math.abs(treeNoise) < 0.025 && lx >= 2 && lx <= CHUNK_SIZE_X - 3 && lz >= 2 && lz <= CHUNK_SIZE_Z - 3) {
        const trunkBase = surfaceLocalY + 1;
        const isBirch = (Math.sin(wx * 3.1) + Math.cos(wz * 2.7)) > 0.4;
        const woodId = isBirch ? 5 : 4; // BIRCH or WOOD

        for (let ty = 0; ty < 3; ty++) {
          if (trunkBase + ty < CHUNK_SIZE_Y) {
            voxels[lx + CHUNK_SIZE_X * (lz + CHUNK_SIZE_Z * (trunkBase + ty))] = woodId;
          }
        }

        const leafY = trunkBase + 3;
        for (let ox = -1; ox <= 1; ox++) {
          for (let oz = -1; oz <= 1; oz++) {
            if (Math.abs(ox) + Math.abs(oz) <= 2) {
              const tx = lx + ox;
              const tz = lz + oz;
              if (tx >= 0 && tx < CHUNK_SIZE_X && tz >= 0 && tz < CHUNK_SIZE_Z && leafY < CHUNK_SIZE_Y) {
                voxels[tx + CHUNK_SIZE_X * (tz + CHUNK_SIZE_Z * leafY)] = 6; // LEAVES
              }
            }
          }
        }
        if (leafY + 1 < CHUNK_SIZE_Y) {
          voxels[lx + CHUNK_SIZE_X * (lz + CHUNK_SIZE_Z * (leafY + 1))] = 6; // LEAVES
        }
      }
    }
  }

  // Transfer memory buffer back to main thread with ZERO COPY!
  self.postMessage({ chunkX, chunkZ, voxels }, [voxels.buffer]);
};
`;

export class VoxelWorkerPool {
  private worker: Worker | null = null;
  private pendingCallbacks = new Map<string, (result: WorkerChunkResult) => void>();
  private seed: number;

  constructor(seed = 1337) {
    this.seed = seed;
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this.worker = new Worker(workerUrl);

        this.worker.onmessage = (e: MessageEvent<WorkerChunkResult>) => {
          const { chunkX, chunkZ, voxels } = e.data;
          const key = `${chunkX},${chunkZ}`;
          const cb = this.pendingCallbacks.get(key);
          if (cb) {
            this.pendingCallbacks.delete(key);
            cb({ chunkX, chunkZ, voxels });
          }
        };

        this.worker.onerror = () => {
          // Graceful fallback to main thread if worker throws
          this.worker = null;
        };
      } catch {
        this.worker = null;
      }
    }
  }

  public isAvailable(): boolean {
    return this.worker !== null;
  }

  public requestChunk(chunkX: number, chunkZ: number, callback: (result: WorkerChunkResult) => void): boolean {
    if (!this.worker) return false;
    const key = `${chunkX},${chunkZ}`;
    this.pendingCallbacks.set(key, callback);
    this.worker.postMessage({ chunkX, chunkZ, seed: this.seed });
    return true;
  }

  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingCallbacks.clear();
  }
}
