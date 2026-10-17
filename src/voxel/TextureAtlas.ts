import * as THREE from 'three';
import { BlockId } from './VoxelConstants';

/**
 * 4x4 Standard 16x16 Procedural Pixel Art Texture Atlas.
 * Strictly generates and slices a 16x16 pixel grid per block face into a 64x64 master atlas.
 * Configured with THREE.NearestFilter for ultra-crisp, authentic Minecraft pixel art
 * without blur, downscaling, stretching, or texture bleeding.
 */

export const ATLAS_GRID_SIZE = 4; // 4x4 tiles in the atlas
export const TILE_PIXELS = 16;     // Strictly 16x16 pixel resolution per block face
export const ATLAS_TOTAL_PIXELS = ATLAS_GRID_SIZE * TILE_PIXELS; // 64x64 pixels

// Atlas tile indices (0 to 15)
export const ATLAS_TILES = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  GRASS_BOTTOM: 2,
  DIRT: 3,
  STONE: 4,
  WOOD_SIDE: 5,
  WOOD_TOP: 6,
  BIRCH_SIDE: 7,
  BIRCH_TOP: 8,
  LEAVES: 9,
  DIAMOND: 10,
  GLASS: 11,
  BRICK: 12,
  TNT_SIDE: 13,
  TNT_TOP: 14,
  BEEF: 15,
};

export class TextureAtlas {
  private static instance: TextureAtlas | null = null;
  public readonly canvas: HTMLCanvasElement;
  public readonly texture: THREE.CanvasTexture;
  public readonly material: THREE.MeshStandardMaterial;
  public readonly transparentMaterial: THREE.MeshStandardMaterial;

  private constructor() {
    const totalPixels = ATLAS_TOTAL_PIXELS; // 64x64
    const canvas = document.createElement('canvas');
    canvas.width = totalPixels;
    canvas.height = totalPixels;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(totalPixels, totalPixels);
    const data = imgData.data;

    const setPixel = (tx: number, ty: number, lx: number, ly: number, r: number, g: number, b: number, a = 255) => {
      const gx = tx * TILE_PIXELS + lx;
      const gy = ty * TILE_PIXELS + ly;
      const idx = (gy * totalPixels + gx) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[idx + 3] = a;
    };

    // Paint all 16 tiles using authentic 16x16 procedural pixel art rules
    for (let slot = 0; slot < 16; slot++) {
      const tx = slot % ATLAS_GRID_SIZE;
      const ty = Math.floor(slot / ATLAS_GRID_SIZE);

      for (let ly = 0; ly < TILE_PIXELS; ly++) {
        for (let lx = 0; lx < TILE_PIXELS; lx++) {
          switch (slot) {
            case ATLAS_TILES.GRASS_TOP: {
              // 16x16 Lush grass surface with natural blade shading
              const noise = Math.sin(lx * 4.7) * Math.cos(ly * 3.3) * 10 + ((lx * 7 + ly * 11) % 9);
              const isHighlight = (lx + ly * 3) % 7 === 0;
              const isShadow = (lx * 3 + ly) % 6 === 0;
              const gVal = isHighlight ? 190 : isShadow ? 150 : 172;
              setPixel(tx, ty, lx, ly, 70 + noise, gVal + noise * 0.8, 50 + noise * 0.5);
              break;
            }
            case ATLAS_TILES.GRASS_SIDE: {
              // 16x16 Side of grass block: hanging green blades over rich brown dirt
              const bladeLength = 3 + ((lx * 3 + 2) % 3);
              const isGreen = ly < bladeLength || (ly === bladeLength && lx % 2 === 0);
              const rFactor = Math.sin(lx * 5.1) * Math.cos(ly * 6.3) * 8 + ((lx * 5 + ly * 7) % 8);

              if (isGreen) {
                setPixel(tx, ty, lx, ly, 74 + rFactor, 178 + rFactor * 0.8, 52 + rFactor * 0.5);
              } else {
                // Dirt base with shaded pebbles
                const isPebble = (lx === 4 && ly === 9) || (lx === 11 && ly === 13) || (lx === 8 && ly === 6);
                if (isPebble) {
                  setPixel(tx, ty, lx, ly, 120 + rFactor * 0.4, 90 + rFactor * 0.4, 70 + rFactor * 0.4);
                } else {
                  setPixel(tx, ty, lx, ly, 96 + rFactor, 64 + rFactor, 42 + rFactor);
                }
              }
              break;
            }
            case ATLAS_TILES.GRASS_BOTTOM:
            case ATLAS_TILES.DIRT: {
              // 16x16 Rich earthy dirt with scattered gravel particles
              const rFactor = Math.sin(lx * 5.6) * Math.cos(ly * 6.7) * 8 + ((lx * 5 + ly * 7) % 8);
              const isPebble =
                (lx === 2 && ly === 4) ||
                (lx === 10 && ly === 12) ||
                (lx === 6 && ly === 2) ||
                (lx === 13 && ly === 7) ||
                (lx === 3 && ly === 14);
              if (isPebble) {
                setPixel(tx, ty, lx, ly, 128 + rFactor * 0.4, 110 + rFactor * 0.4, 95 + rFactor * 0.4);
              } else {
                setPixel(tx, ty, lx, ly, 96 + rFactor, 64 + rFactor, 42 + rFactor);
              }
              break;
            }
            case ATLAS_TILES.STONE: {
              // 16x16 Cobblestone with authentic mortar lines and stone bricks
              const isMortar =
                ly === 0 || ly === 8 || lx === 0 || lx === 8 ||
                (ly < 8 && (lx === 4 || lx === 12)) ||
                (ly >= 8 && (lx === 4 || lx === 12 || ly === 12));
              const rFactor = Math.sin(lx * 6.1) * Math.cos(ly * 3.8) * 8 + ((lx * 9) % 7);
              if (isMortar) {
                setPixel(tx, ty, lx, ly, 70 + rFactor * 0.5, 70 + rFactor * 0.5, 70 + rFactor * 0.5);
              } else {
                setPixel(tx, ty, lx, ly, 124 + rFactor, 124 + rFactor, 124 + rFactor);
              }
              break;
            }
            case ATLAS_TILES.WOOD_SIDE: {
              // 16x16 Oak log bark with distinct vertical bark grooves
              const isBarkGroove = lx === 3 || lx === 7 || lx === 11 || lx === 15;
              const rFactor = Math.sin(ly * 2.7) * 8 + ((lx * 4) % 6);
              if (isBarkGroove) {
                setPixel(tx, ty, lx, ly, 58 + rFactor, 40 + rFactor, 26 + rFactor);
              } else {
                setPixel(tx, ty, lx, ly, 104 + rFactor, 74 + rFactor, 46 + rFactor);
              }
              break;
            }
            case ATLAS_TILES.WOOD_TOP: {
              // 16x16 Tree rings cross section
              const dx = lx - 7.5;
              const dy = ly - 7.5;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const isRing = Math.floor(dist) % 2 === 0;
              if (dist >= 7) {
                setPixel(tx, ty, lx, ly, 58, 40, 26); // Bark border
              } else if (isRing) {
                setPixel(tx, ty, lx, ly, 190, 152, 112);
              } else {
                setPixel(tx, ty, lx, ly, 140, 100, 62);
              }
              break;
            }
            case ATLAS_TILES.BIRCH_SIDE: {
              // 16x16 Birch bark: creamy white background with black horizontal lenticels
              const isNotch =
                (ly === 2 && lx >= 2 && lx <= 6) ||
                (ly === 10 && lx >= 8 && lx <= 13) ||
                (ly === 6 && (lx <= 3 || lx >= 12)) ||
                (ly === 14 && lx >= 4 && lx <= 8);
              if (isNotch) {
                setPixel(tx, ty, lx, ly, 36, 36, 36);
              } else {
                const rFactor = ((lx * 3 + ly * 5) % 8);
                setPixel(tx, ty, lx, ly, 224 + rFactor, 220 + rFactor, 206 + rFactor);
              }
              break;
            }
            case ATLAS_TILES.BIRCH_TOP: {
              // 16x16 Birch log top rings
              const dx = lx - 7.5;
              const dy = ly - 7.5;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const isRing = Math.floor(dist) % 3 === 0;
              if (dist >= 7) {
                setPixel(tx, ty, lx, ly, 200, 196, 185);
              } else if (isRing) {
                setPixel(tx, ty, lx, ly, 228, 212, 186);
              } else {
                setPixel(tx, ty, lx, ly, 196, 176, 146);
              }
              break;
            }
            case ATLAS_TILES.LEAVES: {
              // 16x16 Foliage with see-through transparency cutouts
              const isHole =
                (lx === 3 && ly === 3) ||
                (lx === 12 && ly === 4) ||
                (lx === 7 && ly === 9) ||
                (lx === 2 && ly === 13) ||
                (lx === 14 && ly === 12);
              if (isHole) {
                setPixel(tx, ty, lx, ly, 0, 0, 0, 0); // Transparent leaf cutout
              } else {
                const rFactor = Math.sin(lx * 4.3) * Math.cos(ly * 5.1) * 12 + ((lx * 7 + ly * 3) % 10);
                const isHighlight = (lx + ly) % 4 === 0;
                setPixel(
                  tx,
                  ty,
                  lx,
                  ly,
                  isHighlight ? 48 + rFactor : 34 + rFactor,
                  isHighlight ? 154 + rFactor : 118 + rFactor,
                  isHighlight ? 34 + rFactor : 24 + rFactor,
                  255
                );
              }
              break;
            }
            case ATLAS_TILES.DIAMOND: {
              // 16x16 Stone block with vibrant cyan gem clusters
              const isGem =
                (lx >= 3 && lx <= 5 && ly >= 3 && ly <= 5) ||
                (lx >= 10 && lx <= 12 && ly >= 4 && ly <= 6) ||
                (lx >= 5 && lx <= 8 && ly >= 10 && ly <= 12) ||
                (lx >= 11 && lx <= 13 && ly >= 11 && ly <= 13);
              const isGemCore =
                (lx === 4 && ly === 4) ||
                (lx === 11 && ly === 5) ||
                (lx === 6 && ly === 11) ||
                (lx === 12 && ly === 12);

              if (isGemCore) {
                setPixel(tx, ty, lx, ly, 185, 255, 255); // Sparkling white highlight
              } else if (isGem) {
                setPixel(tx, ty, lx, ly, 45, 225, 235); // Brilliant turquoise
              } else {
                const rFactor = Math.sin(lx * 6.1) * Math.cos(ly * 3.8) * 8 + ((lx * 9) % 7);
                setPixel(tx, ty, lx, ly, 118 + rFactor, 118 + rFactor, 118 + rFactor);
              }
              break;
            }
            case ATLAS_TILES.GLASS: {
              // 16x16 Translucent glass with border and diagonal glare streaks
              const isBorder = lx === 0 || lx === 15 || ly === 0 || ly === 15;
              const isGlare =
                (lx === ly && lx >= 2 && lx <= 5) ||
                (lx === ly - 6 && lx >= 3 && lx <= 5) ||
                (lx === ly + 6 && lx >= 8 && lx <= 10);

              if (isBorder) {
                setPixel(tx, ty, lx, ly, 230, 245, 255, 220);
              } else if (isGlare) {
                setPixel(tx, ty, lx, ly, 255, 255, 255, 180);
              } else {
                setPixel(tx, ty, lx, ly, 215, 235, 250, 45); // Glass transparency
              }
              break;
            }
            case ATLAS_TILES.BRICK: {
              // 16x16 Running bond red clay brick with mortar seams
              const isMortar =
                ly === 0 || ly === 4 || ly === 8 || ly === 12 ||
                ((ly < 4 || (ly >= 8 && ly < 12)) && (lx === 0 || lx === 8)) ||
                (((ly >= 4 && ly < 8) || ly >= 12) && (lx === 4 || lx === 12));

              if (isMortar) {
                setPixel(tx, ty, lx, ly, 216, 216, 216);
              } else {
                const rFactor = (lx * 5 + ly * 9) % 18;
                setPixel(tx, ty, lx, ly, 172 + rFactor, 54 + rFactor, 42 + rFactor);
              }
              break;
            }
            case ATLAS_TILES.TNT_SIDE: {
              // 16x16 Red TNT sticks with white banner and bold black 'TNT' lettering
              const isWhiteStripe = ly >= 5 && ly <= 10;
              const isText =
                isWhiteStripe &&
                (
                  // 'T'
                  ((ly === 6) && lx >= 2 && lx <= 4) || (lx === 3 && ly >= 7 && ly <= 9) ||
                  // 'N'
                  ((lx === 6 || lx === 9) && ly >= 6 && ly <= 9) || (lx === 7 && ly === 7) || (lx === 8 && ly === 8) ||
                  // 'T'
                  ((ly === 6) && lx >= 11 && lx <= 13) || (lx === 12 && ly >= 7 && ly <= 9)
                );

              if (isText) {
                setPixel(tx, ty, lx, ly, 0, 0, 0);
              } else if (isWhiteStripe) {
                setPixel(tx, ty, lx, ly, 245, 245, 245);
              } else {
                const rFactor = (lx * 7) % 15;
                setPixel(tx, ty, lx, ly, 218 + rFactor, 38 + rFactor, 38 + rFactor);
              }
              break;
            }
            case ATLAS_TILES.TNT_TOP: {
              // 16x16 TNT top explosive pack with central fuse
              const isFuse = (lx === 7 && ly === 7) || (lx === 8 && ly === 7) || (lx === 8 && ly === 8);
              if (isFuse) {
                setPixel(tx, ty, lx, ly, 255, 255, 255);
              } else {
                const rFactor = (lx * 5 + ly * 3) % 12;
                setPixel(tx, ty, lx, ly, 205 + rFactor, 40 + rFactor, 40 + rFactor);
              }
              break;
            }
            case ATLAS_TILES.BEEF: {
              // 16x16 Raw beef item
              const isBone = (lx === ly && (lx <= 3 || lx >= 12));
              const isMeat = !isBone && Math.abs(lx - ly) <= 4 && lx + ly >= 6 && lx + ly <= 24;
              if (isBone) {
                setPixel(tx, ty, lx, ly, 245, 245, 245);
              } else if (isMeat) {
                setPixel(tx, ty, lx, ly, 228, 58, 68);
              } else {
                setPixel(tx, ty, lx, ly, 0, 0, 0, 0);
              }
              break;
            }
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    this.canvas = canvas;

    // Strict nearest neighbor filtering for authentic, crisp 16x16 pixel art
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;

    this.texture = tex;

    this.material = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 0.9,
      metalness: 0.05,
      alphaTest: 0.1,
    });

    this.transparentMaterial = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
  }

  public static getInstance(): TextureAtlas {
    if (!TextureAtlas.instance) {
      TextureAtlas.instance = new TextureAtlas();
    }
    return TextureAtlas.instance;
  }

  /**
   * Strictly slices a 16x16 pixel grid for each face.
   * Returns [uMin, vMin, uMax, vMax] UV bounds on the 64x64 master atlas.
   * Uses sub-texel precision offset (1e-4) to prevent any boundary bleeding or stretching.
   */
  public static getTileUV(blockId: BlockId, faceName: string): [number, number, number, number] {
    let tileIndex = ATLAS_TILES.STONE;

    switch (blockId) {
      case BlockId.GRASS:
        if (faceName === 'top') tileIndex = ATLAS_TILES.GRASS_TOP;
        else if (faceName === 'bottom') tileIndex = ATLAS_TILES.GRASS_BOTTOM;
        else tileIndex = ATLAS_TILES.GRASS_SIDE;
        break;
      case BlockId.DIRT:
        tileIndex = ATLAS_TILES.DIRT;
        break;
      case BlockId.STONE:
      case BlockId.BEDROCK:
        tileIndex = ATLAS_TILES.STONE;
        break;
      case BlockId.WOOD:
        if (faceName === 'top' || faceName === 'bottom') tileIndex = ATLAS_TILES.WOOD_TOP;
        else tileIndex = ATLAS_TILES.WOOD_SIDE;
        break;
      case BlockId.BIRCH:
        if (faceName === 'top' || faceName === 'bottom') tileIndex = ATLAS_TILES.BIRCH_TOP;
        else tileIndex = ATLAS_TILES.BIRCH_SIDE;
        break;
      case BlockId.LEAVES:
        tileIndex = ATLAS_TILES.LEAVES;
        break;
      case BlockId.DIAMOND:
        tileIndex = ATLAS_TILES.DIAMOND;
        break;
      case BlockId.GLASS:
        tileIndex = ATLAS_TILES.GLASS;
        break;
      case BlockId.BRICK:
        tileIndex = ATLAS_TILES.BRICK;
        break;
      case BlockId.TNT:
        if (faceName === 'top' || faceName === 'bottom') tileIndex = ATLAS_TILES.TNT_TOP;
        else tileIndex = ATLAS_TILES.TNT_SIDE;
        break;
      case BlockId.BEEF:
        tileIndex = ATLAS_TILES.BEEF;
        break;
      default:
        tileIndex = ATLAS_TILES.STONE;
    }

    const tx = tileIndex % ATLAS_GRID_SIZE;
    const ty = Math.floor(tileIndex / ATLAS_GRID_SIZE);

    const total = ATLAS_TOTAL_PIXELS; // 64
    const eps = 1e-4; // Sub-texel clamp: avoids sampling adjacent tile borders

    const uMin = (tx * TILE_PIXELS + eps) / total;
    const uMax = ((tx + 1) * TILE_PIXELS - eps) / total;

    // WebGL V coordinates (0 at bottom, 1 at top; canvas row 0 is top)
    const vMax = 1.0 - (ty * TILE_PIXELS + eps) / total;
    const vMin = 1.0 - ((ty + 1) * TILE_PIXELS - eps) / total;

    return [uMin, vMin, uMax, vMax];
  }

  /**
   * Extracts an isolated 16x16 canvas element for a specific block face.
   * Useful for HUD icons, hand items, and fallback textures.
   */
  public static getTileCanvas(blockId: BlockId, faceName = 'side'): HTMLCanvasElement {
    const atlas = TextureAtlas.getInstance();
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = TILE_PIXELS;
    tileCanvas.height = TILE_PIXELS;
    const ctx = tileCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const [uMin, _vMin, _uMax, vMax] = TextureAtlas.getTileUV(blockId, faceName);
    const total = ATLAS_TOTAL_PIXELS;
    const sx = Math.floor(uMin * total);
    const sy = Math.floor((1.0 - vMax) * total);

    ctx.drawImage(atlas.canvas, sx, sy, TILE_PIXELS, TILE_PIXELS, 0, 0, TILE_PIXELS, TILE_PIXELS);
    return tileCanvas;
  }

  /**
   * Returns a standalone 16x16 THREE.CanvasTexture with NearestFilter.
   */
  public static getTileTexture(blockId: BlockId, faceName = 'side'): THREE.CanvasTexture {
    const canvas = this.getTileCanvas(blockId, faceName);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }
}

