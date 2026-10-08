import React, { useEffect, useRef, useState, useCallback } from 'react';
import { sound } from '../../utils/audio';
import {
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Heart,
  Sparkles,
  Zap,
} from 'lucide-react';

interface BreakoutGameProps {
  highScore: number;
  onUpdateHighScore: (score: number) => void;
}

interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
}

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  points: number;
  health: number;
  maxHealth: number;
  alive: boolean;
}

interface Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  alpha: number;
  size: number;
}

interface PowerUp {
  x: number;
  y: number;
  dy: number;
  type: 'WIDE' | 'MULTI' | 'LASER' | 'LIFE';
  width: number;
  height: number;
}

interface LaserBullet {
  x: number;
  y: number;
  dy: number;
}

export const BreakoutGame: React.FC<BreakoutGameProps> = ({
  highScore,
  onUpdateHighScore,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const CANVAS_WIDTH = 580;
  const CANVAS_HEIGHT = 420;

  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'VICTORY'>('IDLE');
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [activePowerUp, setActivePowerUp] = useState<string | null>(null);

  // Mutable Game References
  const paddleRef = useRef({
    x: CANVAS_WIDTH / 2 - 45,
    y: CANVAS_HEIGHT - 24,
    width: 90,
    baseWidth: 90,
    height: 12,
    speed: 7,
  });

  const ballsRef = useRef<Ball[]>([]);
  const bricksRef = useRef<Brick[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const lasersRef = useRef<LaserBullet[]>([]);

  const keysRef = useRef<{ left: boolean; right: boolean; space: boolean }>({
    left: false,
    right: false,
    space: false,
  });

  const powerUpTimerRef = useRef<number | null>(null);
  const laserTimerRef = useRef<number | null>(null);
  const requestAnimRef = useRef<number | null>(null);
  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number>(3);

  // Initialize Bricks
  const initBricks = useCallback(() => {
    const rows = 5;
    const cols = 8;
    const padding = 8;
    const offsetTop = 45;
    const offsetLeft = 24;
    const brickWidth = Math.floor((CANVAS_WIDTH - offsetLeft * 2 - padding * (cols - 1)) / cols);
    const brickHeight = 18;

    const rowConfigs = [
      { color: '#f43f5e', points: 50, health: 2 }, // red (2 hits)
      { color: '#f97316', points: 40, health: 1 }, // orange
      { color: '#eab308', points: 30, health: 1 }, // yellow
      { color: '#10b981', points: 20, health: 1 }, // green
      { color: '#06b6d4', points: 10, health: 1 }, // cyan
    ];

    const newBricks: Brick[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const brickX = offsetLeft + c * (brickWidth + padding);
        const brickY = offsetTop + r * (brickHeight + padding);
        const cfg = rowConfigs[r];
        newBricks.push({
          x: brickX,
          y: brickY,
          width: brickWidth,
          height: brickHeight,
          color: cfg.color,
          points: cfg.points,
          health: cfg.health,
          maxHealth: cfg.health,
          alive: true,
        });
      }
    }
    bricksRef.current = newBricks;
  }, [CANVAS_WIDTH]);

  // Spawn explosion particles
  const spawnParticles = (x: number, y: number, color: string, count: number = 8) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3.5;
      particlesRef.current.push({
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        color,
        alpha: 1,
        size: 2 + Math.random() * 3,
      });
    }
  };

  // Maybe drop a power-up
  const maybeSpawnPowerUp = (x: number, y: number) => {
    if (Math.random() < 0.28) {
      const types: ('WIDE' | 'MULTI' | 'LASER' | 'LIFE')[] = ['WIDE', 'MULTI', 'LASER', 'LIFE'];
      const chosen = types[Math.floor(Math.random() * types.length)];
      powerUpsRef.current.push({
        x: x + 15,
        y,
        dy: 2,
        type: chosen,
        width: 22,
        height: 14,
      });
    }
  };

  // Reset ball on paddle
  const resetBall = () => {
    const paddle = paddleRef.current;
    ballsRef.current = [
      {
        x: paddle.x + paddle.width / 2,
        y: paddle.y - 8,
        dx: (Math.random() > 0.5 ? 1 : -1) * 3.5,
        dy: -4,
        radius: 6,
      },
    ];
  };

  const applyPowerUp = (type: 'WIDE' | 'MULTI' | 'LASER' | 'LIFE') => {
    sound.playPowerup();
    if (type === 'WIDE') {
      paddleRef.current.width = 135;
      setActivePowerUp('Geniş Palet');
      if (powerUpTimerRef.current) clearTimeout(powerUpTimerRef.current);
      powerUpTimerRef.current = window.setTimeout(() => {
        paddleRef.current.width = paddleRef.current.baseWidth;
        setActivePowerUp(null);
      }, 10000);
    } else if (type === 'MULTI') {
      setActivePowerUp('3x Çoklu Top');
      const base = ballsRef.current[0] || {
        x: paddleRef.current.x + paddleRef.current.width / 2,
        y: paddleRef.current.y - 10,
        dx: 3,
        dy: -3.5,
        radius: 6,
      };
      ballsRef.current.push(
        { ...base, dx: -3.2, dy: -3.8 },
        { ...base, dx: 3.2, dy: -3.8 }
      );
    } else if (type === 'LIFE') {
      setActivePowerUp('+1 Can');
      livesRef.current = Math.min(5, livesRef.current + 1);
      setLives(livesRef.current);
      setTimeout(() => setActivePowerUp(null), 3000);
    } else if (type === 'LASER') {
      setActivePowerUp('Lazer Modu');
      if (laserTimerRef.current) clearInterval(laserTimerRef.current);
      // Auto fires lasers every 400ms for 8 seconds
      const interval = window.setInterval(() => {
        const pad = paddleRef.current;
        lasersRef.current.push(
          { x: pad.x + 8, y: pad.y, dy: -6 },
          { x: pad.x + pad.width - 8, y: pad.y, dy: -6 }
        );
        sound.playLaser();
      }, 350);

      laserTimerRef.current = interval;
      setTimeout(() => {
        clearInterval(interval);
        setActivePowerUp(null);
      }, 7000);
    }
  };

  // Main Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark Arcade Arena
    ctx.fillStyle = '#080d1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid accent lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Draw Bricks
    bricksRef.current.forEach((brick) => {
      if (!brick.alive) return;

      ctx.save();
      ctx.shadowColor = brick.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = brick.color;

      // Round rectangle brick
      ctx.beginPath();
      ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 4);
      ctx.fill();

      // Inner highlight for 3D retro arcade feel
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, 3);

      // Cracked visual if 2-hit brick damaged
      if (brick.maxHealth === 2 && brick.health === 1) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(brick.x + 5, brick.y + 3);
        ctx.lineTo(brick.x + brick.width / 2, brick.y + brick.height - 3);
        ctx.lineTo(brick.x + brick.width - 6, brick.y + 5);
        ctx.stroke();
      }
      ctx.restore();
    });

    // Draw Falling Power-Ups
    powerUpsRef.current.forEach((pu) => {
      ctx.save();
      let color = '#38bdf8';
      let symbol = '★';
      if (pu.type === 'WIDE') {
        color = '#10b981';
        symbol = '↔';
      } else if (pu.type === 'MULTI') {
        color = '#a855f7';
        symbol = '3x';
      } else if (pu.type === 'LIFE') {
        color = '#f43f5e';
        symbol = '♥';
      } else if (pu.type === 'LASER') {
        color = '#f59e0b';
        symbol = '⚡';
      }

      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(pu.x, pu.y, pu.width, pu.height, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, pu.x + pu.width / 2, pu.y + pu.height / 2);
      ctx.restore();
    });

    // Draw Laser Bullets
    lasersRef.current.forEach((l) => {
      ctx.save();
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(l.x - 2, l.y, 4, 10);
      ctx.restore();
    });

    // Draw Particles
    particlesRef.current.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.restore();
    });

    // Draw Paddle
    const pad = paddleRef.current;
    ctx.save();
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(pad.x, pad.y, pad.width, pad.height, 6);
    ctx.fill();

    // Paddle Center Accent
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.roundRect(pad.x + pad.width / 2 - 8, pad.y + 2, 16, pad.height - 4, 3);
    ctx.fill();
    ctx.restore();

    // Draw Balls
    ballsRef.current.forEach((ball) => {
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }, [CANVAS_HEIGHT, CANVAS_WIDTH]);

  // Main Physics Update Loop
  const update = useCallback(() => {
    const pad = paddleRef.current;

    // Paddle Keyboard Movement
    if (keysRef.current.left) {
      pad.x = Math.max(0, pad.x - pad.speed);
    }
    if (keysRef.current.right) {
      pad.x = Math.min(CANVAS_WIDTH - pad.width, pad.x + pad.speed);
    }

    // Update Particles
    particlesRef.current.forEach((p) => {
      p.x += p.dx;
      p.y += p.dy;
      p.alpha -= 0.03;
    });
    particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0);

    // Update Power-Ups
    powerUpsRef.current.forEach((pu) => {
      pu.y += pu.dy;
      // Paddle catch detection
      if (
        pu.y + pu.height >= pad.y &&
        pu.y <= pad.y + pad.height &&
        pu.x + pu.width >= pad.x &&
        pu.x <= pad.x + pad.width
      ) {
        applyPowerUp(pu.type);
        pu.y = CANVAS_HEIGHT + 100; // consumed
      }
    });
    powerUpsRef.current = powerUpsRef.current.filter((pu) => pu.y < CANVAS_HEIGHT);

    // Update Lasers
    lasersRef.current.forEach((l) => {
      l.y += l.dy;
      // Check laser brick collision
      bricksRef.current.forEach((b) => {
        if (!b.alive) return;
        if (l.x >= b.x && l.x <= b.x + b.width && l.y >= b.y && l.y <= b.y + b.height) {
          l.y = -50; // consumed
          b.health -= 1;
          spawnParticles(b.x + b.width / 2, b.y + b.height / 2, b.color, 6);
          sound.playBrickBreak();
          if (b.health <= 0) {
            b.alive = false;
            scoreRef.current += b.points;
            setScore(scoreRef.current);
            if (scoreRef.current > highScore) onUpdateHighScore(scoreRef.current);
            maybeSpawnPowerUp(b.x, b.y);
          }
        }
      });
    });
    lasersRef.current = lasersRef.current.filter((l) => l.y > 0);

    // Update Balls
    const activeBalls = ballsRef.current;
    for (let i = 0; i < activeBalls.length; i++) {
      const b = activeBalls[i];
      b.x += b.dx;
      b.y += b.dy;

      // Left & Right Wall Collision
      if (b.x - b.radius <= 0) {
        b.x = b.radius;
        b.dx = -b.dx;
        sound.playBounce(0.8);
      } else if (b.x + b.radius >= CANVAS_WIDTH) {
        b.x = CANVAS_WIDTH - b.radius;
        b.dx = -b.dx;
        sound.playBounce(0.8);
      }

      // Top Wall Collision
      if (b.y - b.radius <= 0) {
        b.y = b.radius;
        b.dy = -b.dy;
        sound.playBounce(0.9);
      }

      // Paddle Collision
      if (
        b.y + b.radius >= pad.y &&
        b.y - b.radius <= pad.y + pad.height &&
        b.x >= pad.x - b.radius &&
        b.x <= pad.x + pad.width + b.radius &&
        b.dy > 0
      ) {
        // Calculate bounce angle depending on hit spot
        const hitOffset = (b.x - (pad.x + pad.width / 2)) / (pad.width / 2); // -1 to 1
        const maxAngle = (60 * Math.PI) / 180;
        const bounceAngle = hitOffset * maxAngle;
        const speed = Math.sqrt(b.dx * b.dx + b.dy * b.dy);
        const newSpeed = Math.min(speed + 0.1, 7.5); // slight speedup

        b.dx = newSpeed * Math.sin(bounceAngle);
        b.dy = -newSpeed * Math.cos(bounceAngle);
        b.y = pad.y - b.radius;
        sound.playBounce(1.2);
      }

      // Brick Collision
      bricksRef.current.forEach((brick) => {
        if (!brick.alive) return;
        if (
          b.x + b.radius > brick.x &&
          b.x - b.radius < brick.x + brick.width &&
          b.y + b.radius > brick.y &&
          b.y - b.radius < brick.y + brick.height
        ) {
          // Bounce ball
          const prevX = b.x - b.dx;
          const prevY = b.y - b.dy;

          if (prevX < brick.x || prevX > brick.x + brick.width) {
            b.dx = -b.dx;
          } else {
            b.dy = -b.dy;
          }

          brick.health -= 1;
          sound.playBounce(1.5);
          spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color, 7);

          if (brick.health <= 0) {
            brick.alive = false;
            sound.playBrickBreak();
            scoreRef.current += brick.points;
            setScore(scoreRef.current);
            if (scoreRef.current > highScore) onUpdateHighScore(scoreRef.current);
            maybeSpawnPowerUp(brick.x, brick.y);
          }
        }
      });
    }

    // Filter out balls that fell below bottom
    ballsRef.current = ballsRef.current.filter((b) => b.y - b.radius < CANVAS_HEIGHT);

    // Check if all balls were lost
    if (ballsRef.current.length === 0) {
      livesRef.current -= 1;
      setLives(livesRef.current);
      if (livesRef.current <= 0) {
        sound.playGameOver();
        setGameState('GAME_OVER');
        return;
      } else {
        sound.playGameOver();
        resetBall();
      }
    }

    // Check Victory (all bricks broken)
    const remainingBricks = bricksRef.current.filter((b) => b.alive).length;
    if (remainingBricks === 0) {
      sound.playBonus();
      setGameState('VICTORY');
      return;
    }

    draw();
    requestAnimRef.current = requestAnimationFrame(update);
  }, [CANVAS_HEIGHT, CANVAS_WIDTH, draw, highScore, onUpdateHighScore]);

  // Main Game Loop Controller
  useEffect(() => {
    if (gameState === 'PLAYING') {
      requestAnimRef.current = requestAnimationFrame(update);
      return () => {
        if (requestAnimRef.current) cancelAnimationFrame(requestAnimRef.current);
      };
    } else {
      if (requestAnimRef.current) cancelAnimationFrame(requestAnimRef.current);
      draw();
    }
  }, [gameState, update, draw]);

  // Init on mount
  useEffect(() => {
    initBricks();
    resetBall();
    draw();
  }, [draw, initBricks]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'p' || e.key === 'P') {
        if (gameState === 'PLAYING') setGameState('PAUSED');
        else if (gameState === 'PAUSED') setGameState('PLAYING');
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Mouse / Touch movement on Canvas
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const clientX = e.clientX - rect.left;
    const canvasX = clientX * scaleX;
    const pad = paddleRef.current;
    pad.x = Math.max(0, Math.min(CANVAS_WIDTH - pad.width, canvasX - pad.width / 2));
  };

  const startGame = () => {
    initBricks();
    paddleRef.current.width = paddleRef.current.baseWidth;
    paddleRef.current.x = CANVAS_WIDTH / 2 - paddleRef.current.baseWidth / 2;
    scoreRef.current = 0;
    livesRef.current = 3;
    setScore(0);
    setLives(3);
    setActivePowerUp(null);
    powerUpsRef.current = [];
    particlesRef.current = [];
    lasersRef.current = [];
    resetBall();
    setGameState('PLAYING');
    sound.playPowerup();
  };

  const togglePause = () => {
    if (gameState === 'PLAYING') setGameState('PAUSED');
    else if (gameState === 'PAUSED') setGameState('PLAYING');
  };

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      {/* Top HUD Bar */}
      <div className="w-full flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-t-xl px-4 py-3 shadow-inner">
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Skor</span>
            <span className="font-arcade text-amber-400 text-lg tabular-nums">{score}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400 inline" />
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Rekor</span>
            <span className="font-arcade text-amber-400 text-sm tabular-nums">{highScore}</span>
          </div>
        </div>

        {/* Lives Counter & Active Bonus */}
        <div className="flex items-center gap-3">
          {activePowerUp && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[11px] font-semibold animate-pulse">
              {activePowerUp}
            </span>
          )}
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 transition-colors ${
                  i < lives ? 'text-rose-500 fill-rose-500' : 'text-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="relative w-full aspect-58/42 bg-[#080d1a] border-x border-slate-800 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerMove={handlePointerMove}
          className="w-full h-full object-contain block cursor-crosshair touch-none"
        />

        {/* Overlay for Initial Title Screen */}
        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
              <Zap className="w-7 h-7" />
            </div>
            <h3 className="font-display text-2xl font-bold text-white mb-2 tracking-tight">
              Tuğla Kırıcı
            </h3>
            <p className="text-sm text-slate-300 max-w-sm mb-6 leading-relaxed">
              Topu sektir, blokları yok et ve düşen güçlendirmeleri toplayarak rekor puanlar elde et!
            </p>
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-lg transition-all shadow-md shadow-amber-500/20 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              Oyunu Başlat
            </button>
          </div>
        )}

        {/* Overlay for Game Over */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
            <span className="font-arcade text-xs text-rose-400 tracking-widest uppercase mb-1">
              Top Kaybedildi
            </span>
            <h3 className="font-display text-3xl font-extrabold text-white mb-2">
              Oyun Bitti!
            </h3>
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-6 py-3 my-4 flex items-center gap-6">
              <div>
                <span className="text-xs text-slate-400 block">Skorunuz</span>
                <span className="font-arcade text-xl text-amber-400 tabular-nums">{score}</span>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div>
                <span className="text-xs text-slate-400 block">En Yüksek</span>
                <span className="font-arcade text-xl text-amber-400 tabular-nums">
                  {Math.max(score, highScore)}
                </span>
              </div>
            </div>
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-lg transition-all shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              Tekrar Oyna
            </button>
          </div>
        )}

        {/* Overlay for Victory */}
        {gameState === 'VICTORY' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-display text-3xl font-extrabold text-emerald-400 mb-2">
              Tebrikler! Tüm Bloklar Kırıldı!
            </h3>
            <p className="text-sm text-slate-300 mb-4">Mükemmel bir zafer kazandınız!</p>
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-6 py-3 mb-4">
              <span className="text-xs text-slate-400 block">Nihai Skor</span>
              <span className="font-arcade text-2xl text-amber-400 tabular-nums">{score}</span>
            </div>
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-lg transition-all shadow-lg active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              Yeni Tura Başla
            </button>
          </div>
        )}

        {/* Overlay for Paused */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
            <h3 className="font-display text-2xl font-bold text-white mb-2">Duraklatıldı</h3>
            <p className="text-xs text-slate-300 mb-4">Paleti hazır tut</p>
            <button
              onClick={togglePause}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Devam Et
            </button>
          </div>
        )}
      </div>

      {/* Control Buttons & Mobile Slider */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-b-xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {gameState === 'PLAYING' && (
            <button
              onClick={togglePause}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700"
            >
              <Pause className="w-3.5 h-3.5" />
              Duraklat (P)
            </button>
          )}
          {gameState === 'PAUSED' && (
            <button
              onClick={togglePause}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Devam Et
            </button>
          )}
          {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
            <button
              onClick={startGame}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 text-xs font-medium rounded-lg transition-colors border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Sıfırla
            </button>
          )}
        </div>

        {/* Mobile touch paddle slider button guides */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onPointerDown={() => {
              keysRef.current.left = true;
            }}
            onPointerUp={() => {
              keysRef.current.left = false;
            }}
            className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 active:bg-amber-500 active:text-slate-950 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 select-none"
          >
            ← Sola Kaydır
          </button>
          <button
            onPointerDown={() => {
              keysRef.current.right = true;
            }}
            onPointerUp={() => {
              keysRef.current.right = false;
            }}
            className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 active:bg-amber-500 active:text-slate-950 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 select-none"
          >
            Sağa Kaydır →
          </button>
        </div>
      </div>
    </div>
  );
};
