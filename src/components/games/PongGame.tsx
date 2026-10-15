import React, { useEffect, useRef, useState, useCallback } from 'react';
import { sound } from '../../utils/audio';
import {
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Sparkles,
} from 'lucide-react';

interface PongGameProps {
  highScore: number;
  onUpdateHighScore: (score: number) => void;
}

export const PongGame: React.FC<PongGameProps> = ({ highScore, onUpdateHighScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>('IDLE');
  const [score, setScore] = useState<number>(0);
  
  // Game state refs
  const ballRef = useRef({ x: 200, y: 200, dx: 3, dy: 3 });
  const paddleYRef = useRef(150); // Player 1
  const paddle2YRef = useRef(150); // Player 2
  const scoreRef = useRef({ p1: 0, p2: 0 });
  const animationFrameRef = useRef<number | null>(null);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Clear
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dashed center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dashed line

    // Draw Scores inside canvas with custom color for each player
    ctx.font = "40px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // P1 Score (Green)
    ctx.fillStyle = '#10b981';
    ctx.fillText(scoreRef.current.p1.toString(), canvas.width / 4, 60);

    // P2 Score (Red)
    ctx.fillStyle = '#f43f5e';
    ctx.fillText(scoreRef.current.p2.toString(), (canvas.width / 4) * 3, 60);

    // Paddle 1 (Green)
    ctx.fillStyle = '#10b981';
    ctx.fillRect(10, paddleYRef.current, 10, 80);

    // Paddle 2 (Red)
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(canvas.width - 20, paddle2YRef.current, 10, 80);

    // Ball
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ballRef.current.x, ballRef.current.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  // Reset ball to center with realistic serve
  const resetBall = useCallback((serveDirection: number) => {
    // Random angle between -45 and 45 degrees
    const angle = (Math.random() * Math.PI / 3) - Math.PI / 6;
    const speed = 4;
    ballRef.current = {
      x: 200,
      y: 200,
      dx: serveDirection * speed * Math.cos(angle),
      dy: speed * Math.sin(angle),
    };
  }, []);

  const keysPressed = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main game loop
  useEffect(() => {
    if (gameState !== 'PLAYING') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    let isRunning = true;

    const gameLoop = () => {
      if (!isRunning) return;

      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Smooth paddle movement
      const paddleSpeed = 6;
      const paddleHeight = 80;

      // Player 1 (W / S)
      if (keysPressed.current['w']) {
        paddleYRef.current = Math.max(0, paddleYRef.current - paddleSpeed);
      }
      if (keysPressed.current['s']) {
        paddleYRef.current = Math.min(canvas.height - paddleHeight, paddleYRef.current + paddleSpeed);
      }

      // Player 2 (ArrowUp / ArrowDown)
      if (keysPressed.current['arrowup']) {
        paddle2YRef.current = Math.max(0, paddle2YRef.current - paddleSpeed);
      }
      if (keysPressed.current['arrowdown']) {
        paddle2YRef.current = Math.min(canvas.height - paddleHeight, paddle2YRef.current + paddleSpeed);
      }

      // Ball physics
      const ball = ballRef.current;
      ball.x += ball.dx;
      ball.y += ball.dy;

      const ballRadius = 8;

      // Top & Bottom wall bounce
      if (ball.y - ballRadius <= 0) {
        ball.y = ballRadius;
        ball.dy = Math.abs(ball.dy);
        sound.playTone(220, 'sine', 0.05, 0.05);
      } else if (ball.y + ballRadius >= canvas.height) {
        ball.y = canvas.height - ballRadius;
        ball.dy = -Math.abs(ball.dy);
        sound.playTone(220, 'sine', 0.05, 0.05);
      }

      // Left Paddle Collision (Paddle 1: x: 10, w: 10, span: [10, 20])
      if (ball.x - ballRadius <= 20 && ball.x + ballRadius >= 10) {
        if (ball.y >= paddleYRef.current && ball.y <= paddleYRef.current + paddleHeight) {
          if (ball.dx < 0) {
            // Hit point relative to center (-1 to 1)
            const hitOffset = (ball.y - (paddleYRef.current + paddleHeight / 2)) / (paddleHeight / 2);
            const clampedOffset = Math.max(-1, Math.min(1, hitOffset));
            const bounceAngle = clampedOffset * (Math.PI / 4); // Max 45 degrees
            const currentSpeed = Math.min(9, Math.hypot(ball.dx, ball.dy) * 1.05); // slight speedup
            ball.dx = Math.abs(currentSpeed * Math.cos(bounceAngle));
            ball.dy = currentSpeed * Math.sin(bounceAngle);
            ball.x = 20 + ballRadius;
            sound.playTone(350, 'sine', 0.08, 0.1);
          }
        }
      }

      // Right Paddle Collision (Paddle 2: x: canvas.width - 20, w: 10, span: [width-20, width-10])
      if (ball.x + ballRadius >= canvas.width - 20 && ball.x - ballRadius <= canvas.width - 10) {
        if (ball.y >= paddle2YRef.current && ball.y <= paddle2YRef.current + paddleHeight) {
          if (ball.dx > 0) {
            const hitOffset = (ball.y - (paddle2YRef.current + paddleHeight / 2)) / (paddleHeight / 2);
            const clampedOffset = Math.max(-1, Math.min(1, hitOffset));
            const bounceAngle = clampedOffset * (Math.PI / 4);
            const currentSpeed = Math.min(9, Math.hypot(ball.dx, ball.dy) * 1.05);
            ball.dx = -Math.abs(currentSpeed * Math.cos(bounceAngle));
            ball.dy = currentSpeed * Math.sin(bounceAngle);
            ball.x = canvas.width - 20 - ballRadius;
            sound.playTone(400, 'sine', 0.08, 0.1);
          }
        }
      }

      // Scoring
      let scored = false;
      if (ball.x < 0) {
        // Player 2 scored!
        scoreRef.current.p2 += 1;
        scored = true;
        sound.playTone(180, 'triangle', 0.2, 0.15);
        if (scoreRef.current.p2 >= 5) {
          isRunning = false;
          const totalScore = scoreRef.current.p1 + scoreRef.current.p2;
          setScore(totalScore);
          setGameState('GAME_OVER');
          if (totalScore > highScore) onUpdateHighScore(totalScore);
          return;
        } else {
          resetBall(1); // Serve towards P1
        }
      } else if (ball.x > canvas.width) {
        // Player 1 scored!
        scoreRef.current.p1 += 1;
        scored = true;
        sound.playTone(550, 'triangle', 0.2, 0.15);
        if (scoreRef.current.p1 >= 5) {
          isRunning = false;
          const totalScore = scoreRef.current.p1 + scoreRef.current.p2;
          setScore(totalScore);
          setGameState('GAME_OVER');
          if (totalScore > highScore) onUpdateHighScore(totalScore);
          return;
        } else {
          resetBall(-1); // Serve towards P2
        }
      }

      if (scored) {
        setScore(scoreRef.current.p1 + scoreRef.current.p2);
      }

      // Render
      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx, canvas);

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [gameState, draw, highScore, onUpdateHighScore, resetBall]);



  return (
    <div className="flex flex-col items-center relative">
      <div className="text-slate-400 font-arcade text-xs mb-2">Hedef: 5 Sayı | En Yüksek: {highScore}</div>
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        className="bg-slate-950 border border-slate-700 cursor-none rounded-lg"
      />
      {gameState === 'IDLE' && (
        <button onClick={() => { setGameState('PLAYING'); scoreRef.current = {p1:0, p2:0}; setScore(0); }} className="mt-4 px-6 py-2 bg-emerald-500 rounded font-bold">Başlat</button>
      )}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm rounded-lg">
            <div className="p-8 bg-slate-900 border border-slate-700 rounded-2xl text-center shadow-2xl">
                <h2 className="text-2xl font-arcade text-yellow-400 mb-4 animate-pulse">OYUN BİTTİ</h2>
                <p className="text-xl text-white mb-6">
                    {scoreRef.current.p1 >= 5 ? (
                        <span className="text-emerald-400 font-bold font-arcade text-xs block">1. OYUNCU (YEŞİL) KAZANDI!</span>
                    ) : (
                        <span className="text-rose-500 font-bold font-arcade text-xs block">2. OYUNCU (KIRMIZI) KAZANDI!</span>
                    )}
                </p>
                <button onClick={() => { setGameState('PLAYING'); scoreRef.current = {p1:0, p2:0}; setScore(0); ballRef.current = { x: 200, y: 200, dx: 3, dy: 3 }; }} className="px-6 py-2.5 bg-emerald-600 rounded-xl text-white font-bold text-sm hover:bg-emerald-500 transition-all font-arcade">
                    Tekrar Oyna
                </button>
            </div>
        </div>
      )}
    </div>
  );
};
