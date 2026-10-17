/**
 * High-Performance Simplex Noise Generator for Procedural Voxel Terrains.
 * Deterministic, seedable, zero-allocation during sampling.
 */

// Permutation table initialized from seed
export class SimplexNoise {
  private perm: Uint8Array;
  private permMod12: Uint8Array;

  // Skewing and unskewing factors for 2D
  private static readonly F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  private static readonly G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

  // 12 2D gradient directions
  private static readonly grad3 = new Float32Array([
    1, 1, 0,  -1, 1, 0,  1, -1, 0,  -1, -1, 0,
    1, 0, 1,  -1, 0, 1,  1, 0, -1,  -1, 0, -1,
    0, 1, 1,   0, -1, 1,  0, 1, -1,   0, -1, -1,
  ]);

  constructor(seed = 1337) {
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);

    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Seeded shuffle (LCG)
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = ((s >>> 16) & 0x7fff) % (i + 1);
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  /**
   * 2D Simplex Noise, returns value in range [-1, 1]
   */
  public noise2D(xin: number, yin: number): number {
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    // Skew the input space to determine which simplex cell we're in
    const s = (xin + yin) * SimplexNoise.F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * SimplexNoise.G2;
    const X0 = i - t; // Unskew cell origin back to (x, y)
    const Y0 = j - t;
    const x0 = xin - X0; // The x, y distances from cell origin
    const y0 = yin - Y0;

    // For 2D, simplex shape is an equilateral triangle
    // Determine which simplex we are in: (0,0)->(1,0)->(1,1) or (0,0)->(0,1)->(1,1)
    let i1 = 0;
    let j1 = 0;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    // Offsets for middle corner in (x, y) unskewed coords
    const x1 = x0 - i1 + SimplexNoise.G2;
    const y1 = y0 - j1 + SimplexNoise.G2;
    // Offsets for last corner in (x, y) unskewed coords
    const x2 = x0 - 1.0 + 2.0 * SimplexNoise.G2;
    const y2 = y0 - 1.0 + 2.0 * SimplexNoise.G2;

    // Work out the hashed gradient indices of the three simplex corners
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

    // Calculate the contribution from the three corners
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      const g0x = SimplexNoise.grad3[gi0 * 3];
      const g0y = SimplexNoise.grad3[gi0 * 3 + 1];
      n0 = t0 * t0 * (g0x * x0 + g0y * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      const g1x = SimplexNoise.grad3[gi1 * 3];
      const g1y = SimplexNoise.grad3[gi1 * 3 + 1];
      n1 = t1 * t1 * (g1x * x1 + g1y * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      const g2x = SimplexNoise.grad3[gi2 * 3];
      const g2y = SimplexNoise.grad3[gi2 * 3 + 1];
      n2 = t2 * t2 * (g2x * x2 + g2y * y2);
    }

    // Add contributions from each corner to get final noise value.
    // Result is scaled to return values in the interval [-1, 1].
    return 70.0 * (n0 + n1 + n2);
  }

  /**
   * Fractal Brownian Motion (Multi-octave noise)
   */
  public fbm2D(
    x: number,
    y: number,
    octaves = 4,
    persistence = 0.5,
    lacunarity = 2.0
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }
}
