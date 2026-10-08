import React, { useEffect, useRef, useState, useCallback } from 'react';
import { sound } from '../../utils/audio';
import {
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Heart,
  Shield,
  Zap,
  Bomb,
  Rocket,
} from 'lucide-react';

interface SpaceGameProps {
  highScore: number;
  onUpdateHighScore: (score: number) => void;
}

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}

interface Bullet {
  x: number;
  y: number;
  dx: number;
  dy: number;
  isEnemy?: boolean;
}

interface Enemy {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'ASTEROID' | 'DRONE' | 'CRUISER';
  health: number;
  maxHealth: number;
  speed: number;
  vx: number;
  points: number;
  angle: number;
  spinSpeed: number;
  color: string;
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

interface SpaceDrop {
  x: number;
  y: number;
  type: 'SHIELD' | 'TRIPLE' | 'BOMB';
  width: number;
  height: number;
  dy: number;
}

export const SpaceDefenderGame: React.FC<SpaceGameProps> = ({
  highScore,
  onUpdateHighScore,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const CANVAS_WIDTH = 580;
  const CANVAS_HEIGHT = 440;

  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>('IDLE');
  const [score, setScore] = useState<number>(0);
  const [wave, setWave] = useState<number>(1);
  const [lives, setLives] = useState<number>(3);
  const [hasShield, setHasShield] = useState<boolean>(false);
  const [hasTripleLaser, setHasTripleLaser] = useState<boolean>(false);

  // Player ship
  const playerRef = useRef({
    x: CANVAS_WIDTH / 2 - 18,
    y: CANVAS_HEIGHT - 48,
    width: 36,
    height: 38,
    speed: 6.5,
    shield: false,
    tripleUntil: 0,
    lastShootTime: 0,
  });

  const starsRef = useRef<Star[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const dropsRef = useRef<SpaceDrop[]>([]);

  const keysRef = useRef<{ left: boolean; right: boolean; fire: boolean }>({
    left: false,
    right: false,
    fire: false,
  });

  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number>(3);
  const waveRef = useRef<number>(1);
  const spawnTimerRef = useRef<number>(0);
  const requestAnimRef = useRef<number | null>(null);

  // Initialize background starfield
  const initStars = useCallback(() => {
    const list: Star[] = [];
    for (let i = 0; i < 75; i++) {
      list.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 1.5 + 0.4,
        alpha: Math.random() * 0.7 + 0.3,
      });
    }
    starsRef.current = list;
  }, [CANVAS_HEIGHT, CANVAS_WIDTH]);

  // Particle explosion
  const spawnExplosion = (x: number, y: number, color: string, count = 12) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
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

  // Trigger screen EMP bomb
  const triggerBomb = () => {
    sound.playExplosion();
    // Award points for all on-screen enemies
    enemiesRef.current.forEach((en) => {
      scoreRef.current += en.points;
      spawnExplosion(en.x + en.width / 2, en.y + en.height / 2, '#38bdf8', 15);
    });
    enemiesRef.current = [];
    bulletsRef.current = bulletsRef.current.filter((b) => !b.isEnemy);
    setScore(scoreRef.current);
    if (scoreRef.current > highScore) onUpdateHighScore(scoreRef.current);
  };

  // Shoot laser
  const fireLaser = () => {
    const now = Date.now();
    const p = playerRef.current;
    if (now - p.lastShootTime < 180) return; // Fire rate limit
    p.lastShootTime = now;

    sound.playLaser();
    const centerX = p.x + p.width / 2;

    if (p.tripleUntil > now) {
      bulletsRef.current.push(
        { x: centerX, y: p.y - 4, dx: 0, dy: -8 },
        { x: centerX - 10, y: p.y, dx: -2, dy: -7.5 },
        { x: centerX + 10, y: p.y, dx: 2, dy: -7.5 }
      );
    } else {
      bulletsRef.current.push({ x: centerX, y: p.y - 4, dx: 0, dy: -8 });
    }
  };

  // Spawn Enemy wave
  const maybeSpawnEnemy = () => {
    spawnTimerRef.current += 1;
    const threshold = Math.max(35, 75 - waveRef.current * 4);

    if (spawnTimerRef.current >= threshold) {
      spawnTimerRef.current = 0;
      const rand = Math.random();
      const x = 20 + Math.random() * (CANVAS_WIDTH - 60);

      if (rand < 0.5) {
        // Asteroid
        const size = 26 + Math.random() * 16;
        enemiesRef.current.push({
          id: Math.random(),
          x,
          y: -40,
          width: size,
          height: size,
          type: 'ASTEROID',
          health: 1,
          maxHealth: 1,
          speed: 1.8 + Math.random() * 1.5,
          vx: (Math.random() - 0.5) * 1.2,
          points: 20,
          angle: 0,
          spinSpeed: (Math.random() - 0.5) * 0.05,
          color: '#a1a1aa',
        });
      } else if (rand < 0.8) {
        // Drone Ship
        enemiesRef.current.push({
          id: Math.random(),
          x,
          y: -40,
          width: 32,
          height: 28,
          type: 'DRONE',
          health: 2,
          maxHealth: 2,
          speed: 2.2,
          vx: (Math.random() - 0.5) * 2,
          points: 50,
          angle: 0,
          spinSpeed: 0,
          color: '#e11d48',
        });
      } else {
        // Cruiser
        enemiesRef.current.push({
          id: Math.random(),
          x,
          y: -50,
          width: 44,
          height: 38,
          type: 'CRUISER',
          health: 4,
          maxHealth: 4,
          speed: 1.2,
          vx: (Math.random() - 0.5) * 0.8,
          points: 100,
          angle: 0,
          spinSpeed: 0,
          color: '#a855f7',
        });
      }
    }
  };

  // Draw Game
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Deep space black
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Parallax Stars
    starsRef.current.forEach((st) => {
      ctx.fillStyle = `rgba(255, 255, 255, ${st.alpha})`;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Drops
    dropsRef.current.forEach((dr) => {
      ctx.save();
      let color = '#38bdf8';
      let icon = 'S';
      if (dr.type === 'TRIPLE') {
        color = '#f59e0b';
        icon = '3x';
      } else if (dr.type === 'BOMB') {
        color = '#ef4444';
        icon = '💣';
      }

      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(dr.x, dr.y, dr.width, dr.height, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, dr.x + dr.width / 2, dr.y + dr.height / 2);
      ctx.restore();
    });

    // Draw Enemies
    enemiesRef.current.forEach((en) => {
      ctx.save();
      ctx.translate(en.x + en.width / 2, en.y + en.height / 2);
      ctx.rotate(en.angle);

      if (en.type === 'ASTEROID') {
        // Jagged asteroid rock
        ctx.fillStyle = en.color;
        ctx.strokeStyle = '#71717a';
        ctx.lineWidth = 1.5;
        const rad = en.width / 2;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          const r = rad * (0.8 + Math.sin(a * 3) * 0.15);
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (en.type === 'DRONE') {
        // Red alien drone
        ctx.shadowColor = '#e11d48';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.moveTo(0, en.height / 2);
        ctx.lineTo(-en.width / 2, -en.height / 2);
        ctx.lineTo(0, -en.height / 4);
        ctx.lineTo(en.width / 2, -en.height / 2);
        ctx.closePath();
        ctx.fill();

        // Eye
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Purple Elite Cruiser
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#9333ea';
        ctx.beginPath();
        ctx.moveTo(0, en.height / 2);
        ctx.lineTo(-en.width / 2, -en.height / 4);
        ctx.lineTo(-en.width / 3, -en.height / 2);
        ctx.lineTo(en.width / 3, -en.height / 2);
        ctx.lineTo(en.width / 2, -en.height / 4);
        ctx.closePath();
        ctx.fill();

        // Health indicator bar
        if (en.health < en.maxHealth) {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(-en.width / 2, -en.height / 2 - 8, en.width, 3);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(
            -en.width / 2,
            -en.height / 2 - 8,
            (en.width * en.health) / en.maxHealth,
            3
          );
        }
      }
      ctx.restore();
    });

    // Draw Bullets
    bulletsRef.current.forEach((b) => {
      ctx.save();
      if (b.isEnemy) {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#f87171';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#7dd3fc';
        ctx.fillRect(b.x - 2, b.y - 6, 4, 12);
      }
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

    // Draw Player Ship
    const p = playerRef.current;
    ctx.save();
    // Engine flame flicker
    const flameH = 6 + Math.random() * 8;
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(p.x + p.width / 2 - 4, p.y + p.height);
    ctx.lineTo(p.x + p.width / 2 + 4, p.y + p.height);
    ctx.lineTo(p.x + p.width / 2, p.y + p.height + flameH);
    ctx.closePath();
    ctx.fill();

    // Ship Body (Futuristic Delta Wing)
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(p.x + p.width / 2, p.y);
    ctx.lineTo(p.x + p.width, p.y + p.height);
    ctx.lineTo(p.x + p.width / 2, p.y + p.height - 8);
    ctx.lineTo(p.x, p.y + p.height);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.ellipse(
      p.x + p.width / 2,
      p.y + p.height / 2 - 2,
      4,
      9,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Shield Aura
    if (p.shield) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(
        p.x + p.width / 2,
        p.y + p.height / 2,
        p.width * 0.8,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
    ctx.restore();
  }, [CANVAS_HEIGHT, CANVAS_WIDTH]);

  // Main Loop Update
  const update = useCallback(() => {
    const p = playerRef.current;

    // Move player with keyboard
    if (keysRef.current.left) {
      p.x = Math.max(8, p.x - p.speed);
    }
    if (keysRef.current.right) {
      p.x = Math.min(CANVAS_WIDTH - p.width - 8, p.x + p.speed);
    }
    if (keysRef.current.fire) {
      fireLaser();
    }

    // Update Stars
    starsRef.current.forEach((st) => {
      st.y += st.speed;
      if (st.y > CANVAS_HEIGHT) {
        st.y = 0;
        st.x = Math.random() * CANVAS_WIDTH;
      }
    });

    // Update Particles
    particlesRef.current.forEach((part) => {
      part.x += part.dx;
      part.y += part.dy;
      part.alpha -= 0.035;
    });
    particlesRef.current = particlesRef.current.filter((pt) => pt.alpha > 0);

    // Update Drops
    dropsRef.current.forEach((dr) => {
      dr.y += dr.dy;
      // Catch drop
      if (
        dr.x + dr.width >= p.x &&
        dr.x <= p.x + p.width &&
        dr.y + dr.height >= p.y &&
        dr.y <= p.y + p.height
      ) {
        sound.playPowerup();
        dr.y = CANVAS_HEIGHT + 100;
        if (dr.type === 'SHIELD') {
          p.shield = true;
          setHasShield(true);
        } else if (dr.type === 'TRIPLE') {
          p.tripleUntil = Date.now() + 9000;
          setHasTripleLaser(true);
          setTimeout(() => setHasTripleLaser(false), 9000);
        } else if (dr.type === 'BOMB') {
          triggerBomb();
        }
      }
    });
    dropsRef.current = dropsRef.current.filter((dr) => dr.y < CANVAS_HEIGHT);

    // Spawn Enemies
    maybeSpawnEnemy();

    // Update Enemies
    enemiesRef.current.forEach((en) => {
      en.y += en.speed;
      en.x += en.vx;
      en.angle += en.spinSpeed;

      // Bounce off screen edges
      if (en.x <= 0 || en.x + en.width >= CANVAS_WIDTH) {
        en.vx = -en.vx;
      }

      // Drone shoots occasionally
      if (en.type === 'DRONE' && Math.random() < 0.008) {
        bulletsRef.current.push({
          x: en.x + en.width / 2,
          y: en.y + en.height,
          dx: 0,
          dy: 4.5,
          isEnemy: true,
        });
      }

      // Check collision with player
      if (
        en.x + en.width >= p.x &&
        en.x <= p.x + p.width &&
        en.y + en.height >= p.y &&
        en.y <= p.y + p.height
      ) {
        // Collision!
        spawnExplosion(en.x + en.width / 2, en.y + en.height / 2, '#ef4444', 16);
        en.y = CANVAS_HEIGHT + 200; // destroy enemy

        if (p.shield) {
          p.shield = false;
          setHasShield(false);
          sound.playHit();
        } else {
          sound.playGameOver();
          livesRef.current -= 1;
          setLives(livesRef.current);
          if (livesRef.current <= 0) {
            setGameState('GAME_OVER');
            return;
          }
        }
      }
    });
    enemiesRef.current = enemiesRef.current.filter((en) => en.y < CANVAS_HEIGHT + 50);

    // Update Bullets
    bulletsRef.current.forEach((b) => {
      b.x += b.dx;
      b.y += b.dy;

      // Enemy bullet hits player
      if (b.isEnemy) {
        if (
          b.x >= p.x &&
          b.x <= p.x + p.width &&
          b.y >= p.y &&
          b.y <= p.y + p.height
        ) {
          b.y = CANVAS_HEIGHT + 100;
          spawnExplosion(b.x, b.y, '#ef4444', 8);
          if (p.shield) {
            p.shield = false;
            setHasShield(false);
            sound.playBounce(2);
          } else {
            livesRef.current -= 1;
            setLives(livesRef.current);
            sound.playGameOver();
            if (livesRef.current <= 0) {
              setGameState('GAME_OVER');
              return;
            }
          }
        }
      } else {
        // Player bullet hits enemy
        enemiesRef.current.forEach((en) => {
          if (
            b.x >= en.x &&
            b.x <= en.x + en.width &&
            b.y >= en.y &&
            b.y <= en.y + en.height
          ) {
            b.y = -100; // consume bullet
            en.health -= 1;
            spawnExplosion(b.x, b.y, '#38bdf8', 4);
            sound.playBounce(1.5);

            if (en.health <= 0) {
              en.y = CANVAS_HEIGHT + 200; // dead
              sound.playExplosion();
              spawnExplosion(en.x + en.width / 2, en.y + en.height / 2, en.color, 12);
              scoreRef.current += en.points;
              setScore(scoreRef.current);
              if (scoreRef.current > highScore) onUpdateHighScore(scoreRef.current);

              // Wave progression
              if (scoreRef.current >= waveRef.current * 400) {
                waveRef.current += 1;
                setWave(waveRef.current);
                sound.playPowerup();
              }

              // Drop chance
              if (Math.random() < 0.22) {
                const types: ('SHIELD' | 'TRIPLE' | 'BOMB')[] = ['SHIELD', 'TRIPLE', 'BOMB'];
                dropsRef.current.push({
                  x: en.x,
                  y: en.y,
                  type: types[Math.floor(Math.random() * types.length)],
                  width: 20,
                  height: 20,
                  dy: 2,
                });
              }
            }
          }
        });
      }
    });

    bulletsRef.current = bulletsRef.current.filter(
      (b) => b.y > -20 && b.y < CANVAS_HEIGHT + 20
    );

    draw();
    requestAnimRef.current = requestAnimationFrame(update);
  }, [CANVAS_HEIGHT, CANVAS_WIDTH, draw, fireLaser, highScore, onUpdateHighScore]);

  // Game loop controls
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
    initStars();
    draw();
  }, [draw, initStars]);

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
      if (e.key === ' ' || e.key === 'Enter') {
        keysRef.current.fire = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = false;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        keysRef.current.fire = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Touch / pointer steering on canvas
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const clientX = e.clientX - rect.left;
    const canvasX = clientX * scaleX;
    const p = playerRef.current;
    p.x = Math.max(8, Math.min(CANVAS_WIDTH - p.width - 8, canvasX - p.width / 2));
  };

  const handlePointerDown = () => {
    if (gameState === 'PLAYING') {
      fireLaser();
    }
  };

  const startGame = () => {
    playerRef.current.x = CANVAS_WIDTH / 2 - 18;
    playerRef.current.shield = false;
    playerRef.current.tripleUntil = 0;
    setHasShield(false);
    setHasTripleLaser(false);
    scoreRef.current = 0;
    livesRef.current = 3;
    waveRef.current = 1;
    setScore(0);
    setLives(3);
    setWave(1);
    enemiesRef.current = [];
    bulletsRef.current = [];
    dropsRef.current = [];
    particlesRef.current = [];
    spawnTimerRef.current = 0;
    setGameState('PLAYING');
    sound.playPowerup();
  };

  const togglePause = () => {
    if (gameState === 'PLAYING') setGameState('PAUSED');
    else if (gameState === 'PAUSED') setGameState('PLAYING');
  };

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-t-xl px-4 py-3 shadow-inner">
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Skor</span>
            <span className="font-arcade text-sky-400 text-lg tabular-nums">{score}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400 inline" />
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Rekor</span>
            <span className="font-arcade text-amber-400 text-sm tabular-nums">{highScore}</span>
          </div>
          <div className="hidden sm:flex items-baseline gap-1.5">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Dalga</span>
            <span className="font-arcade text-purple-400 text-sm tabular-nums">W-{wave}</span>
          </div>
        </div>

        {/* Lives & Active Status */}
        <div className="flex items-center gap-3">
          {hasShield && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded text-[11px] font-semibold">
              <Shield className="w-3 h-3" /> Kalkan
            </span>
          )}
          {hasTripleLaser && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[11px] font-semibold animate-pulse">
              <Zap className="w-3 h-3" /> 3x Lazer
            </span>
          )}
          <div className="flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
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
      <div className="relative w-full aspect-58/44 bg-[#050811] border-x border-slate-800 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          className="w-full h-full object-contain block cursor-crosshair touch-none"
        />

        {/* Title Screen Overlay */}
        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4 shadow-lg shadow-sky-500/10">
              <Rocket className="w-7 h-7" />
            </div>
            <h3 className="font-display text-2xl font-bold text-white mb-2 tracking-tight">
              Uzay Savunucusu
            </h3>
            <p className="text-sm text-slate-300 max-w-sm mb-6 leading-relaxed">
              Asteroitleri parçala, düşman filolarını yok et ve galaksiyi kurtar!
            </p>
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm rounded-lg transition-all shadow-md shadow-sky-500/20 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              Savaşı Başlat
            </button>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
            <span className="font-arcade text-xs text-rose-400 tracking-widest uppercase mb-1">
              Gemi İmha Edildi
            </span>
            <h3 className="font-display text-3xl font-extrabold text-white mb-2">
              Savaş Kaybedildi!
            </h3>
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-6 py-3 my-4 flex items-center gap-6">
              <div>
                <span className="text-xs text-slate-400 block">Skor</span>
                <span className="font-arcade text-xl text-sky-400 tabular-nums">{score}</span>
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
              className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm rounded-lg transition-all shadow-lg shadow-sky-500/20 active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              Yeniden Başlat
            </button>
          </div>
        )}

        {/* Paused Screen */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
            <h3 className="font-display text-2xl font-bold text-white mb-2">Duraklatıldı</h3>
            <p className="text-xs text-slate-300 mb-4">Mola verildi</p>
            <button
              onClick={togglePause}
              className="flex items-center gap-2 px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Devam Et
            </button>
          </div>
        )}
      </div>

      {/* Controls Bar & Touch Pad */}
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg transition-colors"
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

        {/* Mobile touch steering & shoot buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onPointerDown={() => {
              keysRef.current.left = true;
            }}
            onPointerUp={() => {
              keysRef.current.left = false;
            }}
            className="flex-1 sm:flex-none px-3 py-2 bg-slate-800 active:bg-sky-500 active:text-slate-950 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 select-none"
          >
            ← Sol
          </button>
          <button
            onPointerDown={() => {
              keysRef.current.right = true;
            }}
            onPointerUp={() => {
              keysRef.current.right = false;
            }}
            className="flex-1 sm:flex-none px-3 py-2 bg-slate-800 active:bg-sky-500 active:text-slate-950 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 select-none"
          >
            Sağ →
          </button>
          <button
            onClick={fireLaser}
            className="flex-1 sm:flex-none px-4 py-2 bg-sky-500 active:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg shadow-md select-none"
          >
            🔥 ATEŞ
          </button>
        </div>
      </div>
    </div>
  );
};
