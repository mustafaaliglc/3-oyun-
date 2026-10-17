import { ChunkManager, GroundHeightResult } from './ChunkManager';

export interface PlayerPosition {
  x: number;
  y: number;
  z: number;
  vy: number;
  yaw: number;
  pitch: number;
  isJumping: boolean;
}

export interface PlayerMovementResult {
  nextX: number;
  nextY: number;
  nextZ: number;
  nextVy: number;
  isJumping: boolean;
  isOnGround: boolean;
  isFloatingOnSafetyNet: boolean;
  groundHeight: number;
}

export interface PlayerPhysicsConfig {
  playerWidth: number;   // default 0.6
  playerHeight: number;  // default 1.8
  gravity: number;       // default 24
  jumpStrength: number;  // default 8.5
  stepHeight: number;    // default 0.5 (step-up stairs/slabs)
  terminalVy: number;    // default -32
}

const DEFAULT_CONFIG: PlayerPhysicsConfig = {
  playerWidth: 0.6,
  playerHeight: 1.8,
  gravity: 24,
  jumpStrength: 8.5,
  stepHeight: 0.5,
  terminalVy: -32,
};

/**
 * Robust Player Collision and Movement Resolver with Safety Net Protection.
 * Completely eliminates falling-through bugs caused by unloaded chunks.
 */
export class PlayerCollisionResolver {
  public static resolve(
    current: PlayerPosition,
    desiredStepX: number,
    desiredStepZ: number,
    dt: number,
    chunkManager: ChunkManager,
    keys: { space: boolean },
    lastSafeY: number,
    config = DEFAULT_CONFIG
  ): PlayerMovementResult {
    let nextX = current.x;
    let nextZ = current.z;
    let nextY = current.y;
    let nextVy = current.vy;
    let isJumping = current.isJumping;
    let isFloatingOnSafetyNet = false;
    let isOnGround = false;

    const halfW = config.playerWidth * 0.5;

    // 1. HORIZONTAL MOVEMENT WITH CHUNK LOADING SAFETY CHECK
    // If the destination chunk is still generating, prevent crossing the boundary into void
    const targetX = current.x + desiredStepX;
    const targetZ = current.z + desiredStepZ;

    const isTargetChunkLoaded =
      chunkManager.isChunkReadyAt(targetX - halfW, targetZ - halfW) &&
      chunkManager.isChunkReadyAt(targetX + halfW, targetZ + halfW);

    if (isTargetChunkLoaded) {
      // Check solid voxel collision along X axis
      const testX = current.x + desiredStepX;
      const collidesX = this.checkVoxelCollision(testX, current.y, current.z, config, chunkManager);
      if (!collidesX) {
        nextX = testX;
      }

      // Check solid voxel collision along Z axis
      const testZ = current.z + desiredStepZ;
      const collidesZ = this.checkVoxelCollision(nextX, current.y, testZ, config, chunkManager);
      if (!collidesZ) {
        nextZ = testZ;
      }
    } else {
      // Safety: target chunk isn't loaded yet. Try sliding along loaded axes only
      if (chunkManager.isChunkReadyAt(current.x + desiredStepX, current.z)) {
        if (!this.checkVoxelCollision(current.x + desiredStepX, current.y, current.z, config, chunkManager)) {
          nextX = current.x + desiredStepX;
        }
      }
      if (chunkManager.isChunkReadyAt(nextX, current.z + desiredStepZ)) {
        if (!this.checkVoxelCollision(nextX, current.y, current.z + desiredStepZ, config, chunkManager)) {
          nextZ = current.z + desiredStepZ;
        }
      }
    }

    // 2. VERTICAL MOVEMENT & LOADING SAFETY NET
    const groundInfo: GroundHeightResult = chunkManager.getGroundHeightResult(nextX, nextZ, current.y);
    const groundY = groundInfo.groundY;

    if (!groundInfo.isLoaded) {
      // SAFETY NET ACTIVE:
      // Chunk beneath player is not loaded or is generating.
      // Freeze downward velocity and suspend player securely at safe level!
      isFloatingOnSafetyNet = true;
      isOnGround = true;
      isJumping = false;

      // Nullify falling velocity so player doesn't build up kinetic fall energy
      if (nextVy < 0) nextVy = 0;

      // Maintain safe altitude
      nextY = Math.max(current.y, lastSafeY);
    } else {
      // Chunk is fully loaded: standard physics
      if (keys.space && !isJumping && current.y <= groundY + 0.08) {
        isJumping = true;
        nextVy = config.jumpStrength;
      }

      // Apply vertical movement & gravity
      nextY = current.y + nextVy * dt;
      nextVy -= config.gravity * dt;
      nextVy = Math.max(nextVy, config.terminalVy);

      // Solid ground contact collision
      if (nextY <= groundY) {
        nextY = groundY;
        isJumping = false;
        nextVy = 0;
        isOnGround = true;
      }
    }

    // Void fallback safety (respawn above bedrock if corrupted)
    if (nextY < -15) {
      nextX = 0;
      nextY = 10;
      nextZ = 0;
      nextVy = 0;
    }

    return {
      nextX,
      nextY,
      nextZ,
      nextVy,
      isJumping,
      isOnGround,
      isFloatingOnSafetyNet,
      groundHeight: groundY,
    };
  }

  /**
   * Tests if the player's bounding box intersects any solid block.
   */
  private static checkVoxelCollision(
    px: number,
    py: number,
    pz: number,
    config: PlayerPhysicsConfig,
    chunkManager: ChunkManager
  ): boolean {
    const halfW = config.playerWidth * 0.45;
    const minX = Math.round(px - halfW);
    const maxX = Math.round(px + halfW);
    const minZ = Math.round(pz - halfW);
    const maxZ = Math.round(pz + halfW);

    const footY = Math.round(py + 0.1);
    const bodyY = Math.round(py + 0.9);
    const headY = Math.round(py + config.playerHeight - 0.2);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (
          chunkManager.hasBlock(x, footY, z) ||
          chunkManager.hasBlock(x, bodyY, z) ||
          chunkManager.hasBlock(x, headY, z)
        ) {
          return true;
        }
      }
    }

    return false;
  }
}
