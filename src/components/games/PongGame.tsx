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

  const update = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ball = ballRef.current;
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall bounce
    if (ball.y <= 0 || ball.y >= canvas.height) ball.dy *= -1;

    // Paddle hit
    if ((ball.x <= 20 && ball.y >= paddleYRef.current && ball.y <= paddleYRef.current + 80) ||
        (ball.x >= canvas.width - 20 && ball.y >= paddle2YRef.current && ball.y <= paddle2YRef.current + 80)) {
      ball.dx *= -1;
      sound.playTone(300, 'sine', 0.1, 0.1);
    }

    // Goal & End Game logic (First to 5 wins)
    let isGameOver = false;
    if (ball.x < 0) {
      scoreRef.current.p2 += 1;
      const totalScore = scoreRef.current.p1 + scoreRef.current.p2;
      setScore(totalScore);
      if (scoreRef.current.p2 >= 5) {
        setGameState('GAME_OVER');
        isGameOver = true;
        if (totalScore > highScore) onUpdateHighScore(totalScore);
      } else {
        ballRef.current = { x: 200, y: 200, dx: 3, dy: 3 };
      }
    } else if (ball.x > canvas.width) {
      scoreRef.current.p1 += 1;
      const totalScore = scoreRef.current.p1 + scoreRef.current.p2;
      setScore(totalScore);
      if (scoreRef.current.p1 >= 5) {
        setGameState('GAME_OVER');
        isGameOver = true;
        if (totalScore > highScore) onUpdateHighScore(totalScore);
      } else {
        ballRef.current = { x: 200, y: 200, dx: -3, dy: 3 };
      }
    }

    const ctx = canvas.getContext('2d');
    if (ctx) draw(ctx, canvas);
    
    if (!isGameOver) {
      animationFrameRef.current = requestAnimationFrame(update);
    }
  }, [gameState, draw, highScore, onUpdateHighScore]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      animationFrameRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState, update]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canvasRef.current) return;
      const speed = 30;
      // Player 1 (W/S)
      if (e.key === 'w' || e.key === 'W') paddleYRef.current = Math.max(0, paddleYRef.current - speed);
      if (e.key === 's' || e.key === 'S') paddleYRef.current = Math.min(canvasRef.current.height - 80, paddleYRef.current + speed);
      // Player 2 (Up/Down)
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        paddle2YRef.current = Math.max(0, paddle2YRef.current - speed);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        paddle2YRef.current = Math.min(canvasRef.current.height - 80, paddle2YRef.current + speed);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
