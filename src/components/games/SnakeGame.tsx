import React, { useEffect, useRef, useState, useCallback } from 'react';
import { sound } from '../../utils/audio';
import {
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Zap,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface SnakeGameProps {
  highScore: number;
  onUpdateHighScore: (score: number) => void;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type SpeedMode = 'slow' | 'normal' | 'fast';

interface Point {
  x: number;
  y: number;
}

interface BonusItem extends Point {
  timer: number; // frames left
}

export const SnakeGame: React.FC<SnakeGameProps> = ({ highScore, onUpdateHighScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const GRID_SIZE = 22;
  const CELL_COUNT = 22;

  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>('IDLE');
  const [score, setScore] = useState<number>(0);
  const [speedMode, setSpeedMode] = useState<SpeedMode>('normal');
  const [eatenCount, setEatenCount] = useState<number>(0);

  // References for game loop mutable state to prevent stale closures
  const snakeRef = useRef<Point[]>([
    { x: 10, y: 10 },
    { x: 10, y: 11 },
    { x: 10, y: 12 },
  ]);
  const dirRef = useRef<Direction>('UP');
  const nextDirRef = useRef<Direction>('UP');
  const foodRef = useRef<Point>({ x: 5, y: 5 });
  const bonusRef = useRef<BonusItem | null>(null);
  const scoreRef = useRef<number>(0);
  const gameLoopTimerRef = useRef<number | null>(null);

  const getSpeedMs = useCallback(() => {
    switch (speedMode) {
      case 'slow':
        return 130;
      case 'fast':
        return 70;
      default:
        return 95;
    }
  }, [speedMode]);

  const spawnFood = useCallback((snake: Point[]): Point => {
    let newFood: Point;
    let collision: boolean;
    let tries = 0;
    do {
      newFood = {
        x: Math.floor(Math.random() * CELL_COUNT),
        y: Math.floor(Math.random() * CELL_COUNT),
      };
      collision = snake.some((seg) => seg.x === newFood.x && seg.y === newFood.y);
      tries++;
    } while (collision && tries < 100);
    return newFood;
  }, [CELL_COUNT]);

  const spawnBonus = useCallback((snake: Point[], food: Point): BonusItem => {
    let pt: Point;
    let collision: boolean;
    let tries = 0;
    do {
      pt = {
        x: Math.floor(Math.random() * CELL_COUNT),
        y: Math.floor(Math.random() * CELL_COUNT),
      };
      collision =
        (pt.x === food.x && pt.y === food.y) ||
        snake.some((seg) => seg.x === pt.x && seg.y === pt.y);
      tries++;
    } while (collision && tries < 100);
    return { ...pt, timer: 70 };
  }, [CELL_COUNT]);

  // Render Canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cellSize = width / CELL_COUNT;

    // Dark sleek background
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, width, height);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= CELL_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(width, i * cellSize);
      ctx.stroke();
    }

    // Draw Bonus Star if active
    if (bonusRef.current) {
      const b = bonusRef.current;
      const bx = b.x * cellSize + cellSize / 2;
      const by = b.y * cellSize + cellSize / 2;
      const pulse = 0.8 + Math.sin(Date.now() / 100) * 0.2;

      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(bx, by, (cellSize / 2 - 2) * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Inner golden star shine
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(bx, by, cellSize / 4 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Regular Food (Apple)
    const food = foodRef.current;
    const fx = food.x * cellSize + cellSize / 2;
    const fy = food.y * cellSize + cellSize / 2;

    ctx.save();
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(fx, fy, cellSize / 2 - 3, 0, Math.PI * 2);
    ctx.fill();

    // Apple highlight & leaf
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(fx - 2, fy - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#22c55e';
    ctx.fillRect(fx - 1, fy - cellSize / 2 - 1, 2, 4);
    ctx.restore();

    // Draw Snake
    const snake = snakeRef.current;
    snake.forEach((seg, index) => {
      const sx = seg.x * cellSize;
      const sy = seg.y * cellSize;
      const isHead = index === 0;

      ctx.save();
      if (isHead) {
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.roundRect(sx + 1, sy + 1, cellSize - 2, cellSize - 2, 6);
        ctx.fill();

        // Eyes on the head
        ctx.fillStyle = '#022c22';
        const eyeSize = 2.5;
        const offset = 5;
        let eye1 = { x: sx + offset, y: sy + offset };
        let eye2 = { x: sx + cellSize - offset, y: sy + offset };

        if (dirRef.current === 'DOWN') {
          eye1 = { x: sx + offset, y: sy + cellSize - offset };
          eye2 = { x: sx + cellSize - offset, y: sy + cellSize - offset };
        } else if (dirRef.current === 'LEFT') {
          eye1 = { x: sx + offset, y: sy + offset };
          eye2 = { x: sx + offset, y: sy + cellSize - offset };
        } else if (dirRef.current === 'RIGHT') {
          eye1 = { x: sx + cellSize - offset, y: sy + offset };
          eye2 = { x: sx + cellSize - offset, y: sy + cellSize - offset };
        }

        ctx.beginPath();
        ctx.arc(eye1.x, eye1.y, eyeSize, 0, Math.PI * 2);
        ctx.arc(eye2.x, eye2.y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Body gradient effect from head to tail
        const ratio = 1 - index / (snake.length + 5);
        ctx.fillStyle = `rgba(16, 185, 129, ${Math.max(0.4, ratio * 0.95)})`;
        ctx.beginPath();
        ctx.roundRect(sx + 2, sy + 2, cellSize - 4, cellSize - 4, 4);
        ctx.fill();
      }
      ctx.restore();
    });
  }, [CELL_COUNT]);

  const tick = useCallback(() => {
    dirRef.current = nextDirRef.current;
    const currentDir = dirRef.current;
    const snake = [...snakeRef.current];
    const head = { ...snake[0] };

    switch (currentDir) {
      case 'UP':
        head.y -= 1;
        break;
      case 'DOWN':
        head.y += 1;
        break;
      case 'LEFT':
        head.x -= 1;
        break;
      case 'RIGHT':
        head.x += 1;
        break;
    }

    // Check Wall Collisions
    if (head.x < 0 || head.x >= CELL_COUNT || head.y < 0 || head.y >= CELL_COUNT) {
      sound.playGameOver();
      setGameState('GAME_OVER');
      if (scoreRef.current > highScore) {
        onUpdateHighScore(scoreRef.current);
      }
      return;
    }

    // Check Self Collision
    if (snake.some((seg) => seg.x === head.x && seg.y === head.y)) {
      sound.playGameOver();
      setGameState('GAME_OVER');
      if (scoreRef.current > highScore) {
        onUpdateHighScore(scoreRef.current);
      }
      return;
    }

    // Add new head
    snake.unshift(head);

    let hasEatenFood = false;
    let hasEatenBonus = false;

    // Check Apple
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      hasEatenFood = true;
      scoreRef.current += 10;
      setScore(scoreRef.current);
      if (scoreRef.current > highScore) {
        onUpdateHighScore(scoreRef.current);
      }
      sound.playEat();
      foodRef.current = spawnFood(snake);

      setEatenCount((prev) => {
        const next = prev + 1;
        if (next % 5 === 0 && !bonusRef.current) {
          bonusRef.current = spawnBonus(snake, foodRef.current);
        }
        return next;
      });
    }

    // Check Bonus Star
    if (
      bonusRef.current &&
      head.x === bonusRef.current.x &&
      head.y === bonusRef.current.y
    ) {
      hasEatenBonus = true;
      scoreRef.current += 50;
      setScore(scoreRef.current);
      if (scoreRef.current > highScore) {
        onUpdateHighScore(scoreRef.current);
      }
      sound.playBonus();
      bonusRef.current = null;
    }

    // Decrement bonus timer
    if (bonusRef.current) {
      bonusRef.current.timer -= 1;
      if (bonusRef.current.timer <= 0) {
        bonusRef.current = null;
      }
    }

    // Tail management
    if (!hasEatenFood && !hasEatenBonus) {
      snake.pop();
    }

    snakeRef.current = snake;
    draw();
  }, [CELL_COUNT, draw, highScore, onUpdateHighScore, spawnBonus, spawnFood]);

  // Game loop interval
  useEffect(() => {
    if (gameState === 'PLAYING') {
      const interval = window.setInterval(tick, getSpeedMs());
      gameLoopTimerRef.current = interval;
      return () => {
        clearInterval(interval);
      };
    } else {
      if (gameLoopTimerRef.current) {
        clearInterval(gameLoopTimerRef.current);
      }
    }
  }, [gameState, tick, getSpeedMs]);

  // Initial draw on mount
  useEffect(() => {
    draw();
  }, [draw]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent page scrolling on arrow keys and space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        if (gameState === 'PLAYING') {
          setGameState('PAUSED');
        } else if (gameState === 'PAUSED') {
          setGameState('PLAYING');
        }
        return;
      }

      if (gameState !== 'PLAYING') return;

      const cur = dirRef.current;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (cur !== 'DOWN') nextDirRef.current = 'UP';
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (cur !== 'UP') nextDirRef.current = 'DOWN';
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (cur !== 'RIGHT') nextDirRef.current = 'LEFT';
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (cur !== 'LEFT') nextDirRef.current = 'RIGHT';
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const changeDirection = (dir: Direction) => {
    if (gameState !== 'PLAYING') return;
    const cur = dirRef.current;
    if (dir === 'UP' && cur !== 'DOWN') nextDirRef.current = 'UP';
    if (dir === 'DOWN' && cur !== 'UP') nextDirRef.current = 'DOWN';
    if (dir === 'LEFT' && cur !== 'RIGHT') nextDirRef.current = 'LEFT';
    if (dir === 'RIGHT' && cur !== 'LEFT') nextDirRef.current = 'RIGHT';
  };

  const startGame = () => {
    snakeRef.current = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 },
    ];
    dirRef.current = 'UP';
    nextDirRef.current = 'UP';
    scoreRef.current = 0;
    setScore(0);
    setEatenCount(0);
    foodRef.current = { x: 5, y: 5 };
    bonusRef.current = null;
    setGameState('PLAYING');
    sound.playEat();
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
            <span className="font-arcade text-emerald-400 text-lg tabular-nums">{score}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400 inline" />
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Rekor</span>
            <span className="font-arcade text-amber-400 text-sm tabular-nums">{highScore}</span>
          </div>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {(['slow', 'normal', 'fast'] as SpeedMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSpeedMode(mode)}
              disabled={gameState === 'PLAYING'}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all whitespace-nowrap ${
                speedMode === mode
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 disabled:opacity-50'
              }`}
            >
              {mode === 'slow' ? 'Kolay' : mode === 'normal' ? 'Normal' : 'Hızlı'}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas Screen */}
      <div className="relative w-full aspect-square bg-[#070b14] border-x border-slate-800 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={484}
          height={484}
          className="w-full h-full object-contain block"
        />

        {/* Overlay for Initial Title Screen */}
        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="font-display text-2xl font-bold text-white mb-2 tracking-tight">
              Neon Yılan Arenası
            </h3>
            <p className="text-sm text-slate-300 max-w-sm mb-6 leading-relaxed">
              Elmaları yakala, boyunu uzat ve altın bonus yıldızları topla. Duvarlara ve kendine çarpma!
            </p>
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-lg transition-all shadow-md shadow-emerald-500/20 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              Oyunu Başlat
            </button>
          </div>
        )}

        {/* Overlay for Game Over */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10 animate-fade-in">
            <span className="font-arcade text-xs text-rose-400 tracking-widest uppercase mb-1">
              Oyun Bitti
            </span>
            <h3 className="font-display text-3xl font-extrabold text-white mb-2">
              Kaza Yaptınız!
            </h3>
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-6 py-3 my-4 flex items-center gap-6">
              <div>
                <span className="text-xs text-slate-400 block">Skorunuz</span>
                <span className="font-arcade text-xl text-emerald-400 tabular-nums">{score}</span>
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
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-lg transition-all shadow-lg shadow-emerald-500/20 active:scale-95 mt-2"
            >
              <RotateCcw className="w-4 h-4" />
              Tekrar Oyna
            </button>
          </div>
        )}

        {/* Overlay for Paused */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
            <h3 className="font-display text-2xl font-bold text-white mb-2">Oyun Duraklatıldı</h3>
            <p className="text-xs text-slate-300 mb-4">Hazır olduğunda devam et</p>
            <button
              onClick={togglePause}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Devam Et
            </button>
          </div>
        )}
      </div>

      {/* Control Buttons & On-Screen D-Pad Bar */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-b-xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Play / Pause / Reset Actions */}
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
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
              Yeniden Başlat
            </button>
          )}
        </div>

        {/* Mobile / Touch Responsive D-Pad */}
        <div className="flex flex-col items-center">
          <div className="text-[10px] text-slate-400 mb-1 font-mono sm:hidden">
            Dokunmatik Kontrol
          </div>
          <div className="grid grid-cols-3 gap-1 w-32">
            <div />
            <button
              type="button"
              onClick={() => changeDirection('UP')}
              aria-label="Yukarı"
              className="p-2 bg-slate-800 active:bg-emerald-500 active:text-slate-950 text-slate-200 rounded flex items-center justify-center transition-colors border border-slate-700"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <div />
            <button
              type="button"
              onClick={() => changeDirection('LEFT')}
              aria-label="Sola"
              className="p-2 bg-slate-800 active:bg-emerald-500 active:text-slate-950 text-slate-200 rounded flex items-center justify-center transition-colors border border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => changeDirection('DOWN')}
              aria-label="Aşağı"
              className="p-2 bg-slate-800 active:bg-emerald-500 active:text-slate-950 text-slate-200 rounded flex items-center justify-center transition-colors border border-slate-700"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => changeDirection('RIGHT')}
              aria-label="Sağa"
              className="p-2 bg-slate-800 active:bg-emerald-500 active:text-slate-950 text-slate-200 rounded flex items-center justify-center transition-colors border border-slate-700"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
