import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../utils/audio';

interface FlappyBirdProps {
  highScore: number;
  onUpdateHighScore: (score: number) => void;
}

interface PipeData {
  mesh: THREE.Group;
  x: number;
  gapY: number;
  scored: boolean;
}

export const FlappyBird: React.FC<FlappyBirdProps> = ({ highScore, onUpdateHighScore }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'IDLE' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER'>('IDLE');
  const [countdown, setCountdown] = useState<number>(0);

  // References to keep game loop running flawlessly without state lag
  const gameStateRef = useRef<'IDLE' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER'>('IDLE');
  const scoreRef = useRef<number>(0);
  const birdYRef = useRef<number>(0);
  const birdVelocityRef = useRef<number>(0);
  const pipesRef = useRef<PipeData[]>([]);
  const cloudsRef = useRef<THREE.Group[]>([]);
  const requestRef = useRef<number>(0);
  
  // Model specific refs for animations
  const wingLeftRef = useRef<THREE.Group | undefined>(undefined);
  const wingRightRef = useRef<THREE.Group | undefined>(undefined);
  const birdGroupRef = useRef<THREE.Group | undefined>(undefined);
  const sceneRef = useRef<THREE.Scene | undefined>(undefined);
  const clockRef = useRef<THREE.Clock | undefined>(undefined);
  const flapTimerRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const flapPhaseRef = useRef<number>(0);

  const resetGame = useCallback(() => {
    birdYRef.current = 0;
    birdVelocityRef.current = 0;
    
    // Clear pipes from scene cleanly
    pipesRef.current.forEach(p => {
      sceneRef.current?.remove(p.mesh);
      p.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    });
    pipesRef.current = [];
    
    scoreRef.current = 0;
    setScore(0);
    
    // Trigger countdown
    setCountdown(3);
    setGameState('COUNTDOWN');
    gameStateRef.current = 'COUNTDOWN';
    
    // Play sweet startup sound
    sound.playPowerup();
  }, []);

  // Countdown timer logic
  useEffect(() => {
    if (gameState !== 'COUNTDOWN') return;
    if (countdown === 0) {
      setGameState('PLAYING');
      gameStateRef.current = 'PLAYING';
      spawnTimerRef.current = 1.7; // Spawn the first pipe almost immediately
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
      sound.playTone(523, 'triangle', 0.08, 0.08); // high pitch tick sound
    }, 1000);
    return () => clearTimeout(timer);
  }, [gameState, countdown]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clock
    const clock = new THREE.Clock();
    clockRef.current = clock;

    // Scene with beautiful sky blue background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8); // Sky 400 blue
    sceneRef.current = scene;

    // Fog for depth simulation
    scene.fog = new THREE.FogExp2(0x38bdf8, 0.04);

    // Camera - Orthographic for clean retro 2.5D visual aesthetic
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 400);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    
    // Lights - Studio Lighting Configuration
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(4, 7, 5);
    scene.add(dirLight);

    // Cute Ground Block at the bottom
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e, // Emerald green
      roughness: 0.65,
      metalness: 0.05,
    });
    const groundGeo = new THREE.BoxGeometry(12, 1.6, 3);
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, -4.5, 0); // Grass line is at Y = -3.7
    scene.add(groundMesh);

    // Puffy 3D Clouds Generator
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.85,
    });

    const createCloudGroup = () => {
      const group = new THREE.Group();
      const numSpheres = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < numSpheres; j++) {
        const radius = 0.35 + Math.random() * 0.35;
        const geo = new THREE.SphereGeometry(radius, 12, 12);
        const mesh = new THREE.Mesh(geo, cloudMat);
        mesh.position.set(
          (j - numSpheres / 2) * 0.45,
          Math.sin(j * 1.5) * 0.15,
          -2.5 + Math.random() * 0.5
        );
        group.add(mesh);
      }
      return group;
    };

    const cloudsArray: THREE.Group[] = [];
    for (let i = 0; i < 5; i++) {
      const cloud = createCloudGroup();
      cloud.position.set(
        Math.random() * 12 - 6,
        Math.random() * 3.2 + 1.2, // Float up in the sky
        -3
      );
      scene.add(cloud);
      cloudsArray.push(cloud);
    }
    cloudsRef.current = cloudsArray;

    // --- Bird 3D Model Group ---
    const birdGroup = new THREE.Group();
    birdGroup.position.set(-2.0, 0, 0); // Fixed X position
    scene.add(birdGroup);
    birdGroupRef.current = birdGroup;

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24, // Bright Gold Yellow
      roughness: 0.25,
      metalness: 0.1
    });
    const beakMat = new THREE.MeshStandardMaterial({
      color: 0xf97316, // Orange Beak
      roughness: 0.3,
      metalness: 0.1
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Contrast amber for wing
      roughness: 0.25,
      metalness: 0.1
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.1
    });
    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Slate-900 pupil
      roughness: 0.1,
      metalness: 0.1
    });

    // Body (egg shape scaled along X)
    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), bodyMat);
    bodyMesh.scale.set(1.3, 1.0, 1.0);
    birdGroup.add(bodyMesh);

    // Orange Cone Beak pointing forward (+X)
    const beakMesh = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 16), beakMat);
    beakMesh.rotation.z = -Math.PI / 2;
    beakMesh.position.set(0.46, -0.04, 0);
    birdGroup.add(beakMesh);

    // Left Eye White & Pupil
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), whiteMat);
    eyeL.position.set(0.24, 0.12, 0.18);
    birdGroup.add(eyeL);
    const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), pupilMat);
    pupilL.position.set(0.29, 0.12, 0.21);
    birdGroup.add(pupilL);

    // Right Eye White & Pupil
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), whiteMat);
    eyeR.position.set(0.24, 0.12, -0.18);
    birdGroup.add(eyeR);
    const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), pupilMat);
    pupilR.position.set(0.29, 0.12, -0.21);
    birdGroup.add(pupilR);

    // Left Wing (Group with joint offset for natural pivot flap)
    const wingLGroup = new THREE.Group();
    wingLGroup.position.set(-0.06, 0.05, 0.32);
    const wingLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.35), wingMat);
    wingLMesh.position.set(0, 0, 0.15); // Offset so the joint is on the side
    wingLGroup.add(wingLMesh);
    birdGroup.add(wingLGroup);
    wingLeftRef.current = wingLGroup;

    // Right Wing
    const wingRGroup = new THREE.Group();
    wingRGroup.position.set(-0.06, 0.05, -0.32);
    const wingRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.35), wingMat);
    wingRMesh.position.set(0, 0, -0.15); // Offset so the joint is on the side
    wingRGroup.add(wingRMesh);
    birdGroup.add(wingRGroup);
    wingRightRef.current = wingRGroup;

    // Tail Feathers
    const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.22), wingMat);
    tailMesh.position.set(-0.52, 0.08, 0);
    tailMesh.rotation.z = Math.PI / 6;
    birdGroup.add(tailMesh);

    // Helper to spawn elegant 3D pipes
    const spawnPipe = (targetScene: THREE.Scene) => {
      const pipeGroup = new THREE.Group();
      
      // Random gap center Y position between -1.4 and +1.4
      const gapY = Math.random() * 2.8 - 1.4;
      const gapSize = 2.3;

      // Premium glossy pipe material
      const pipeMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,      // Emerald-500
        roughness: 0.15,
        metalness: 0.1,
      });
      const capMat = new THREE.MeshStandardMaterial({
        color: 0x059669,      // Emerald-600
        roughness: 0.1,
        metalness: 0.2,
      });

      const pipeRadius = 0.5;
      const capRadius = 0.58;
      const capHeight = 0.45;

      // 1. Top Pipe (Cylinder)
      const topHeight = 8;
      const topPipeMesh = new THREE.Mesh(new THREE.CylinderGeometry(pipeRadius, pipeRadius, topHeight, 16), pipeMat);
      const topY = gapY + gapSize / 2 + topHeight / 2;
      topPipeMesh.position.y = topY;
      pipeGroup.add(topPipeMesh);

      // Top Pipe Cap
      const topCapMesh = new THREE.Mesh(new THREE.CylinderGeometry(capRadius, capRadius, capHeight, 16), capMat);
      topCapMesh.position.y = gapY + gapSize / 2 + capHeight / 2;
      pipeGroup.add(topCapMesh);

      // 2. Bottom Pipe (Cylinder)
      const bottomHeight = 8;
      const bottomPipeMesh = new THREE.Mesh(new THREE.CylinderGeometry(pipeRadius, pipeRadius, bottomHeight, 16), pipeMat);
      const bottomY = gapY - gapSize / 2 - bottomHeight / 2;
      bottomPipeMesh.position.y = bottomY;
      pipeGroup.add(bottomPipeMesh);

      // Bottom Pipe Cap
      const bottomCapMesh = new THREE.Mesh(new THREE.CylinderGeometry(capRadius, capRadius, capHeight, 16), capMat);
      bottomCapMesh.position.y = gapY - gapSize / 2 - capHeight / 2;
      pipeGroup.add(bottomCapMesh);

      // Start just beyond the right view boundary
      pipeGroup.position.set(6, 0, 0);
      targetScene.add(pipeGroup);

      pipesRef.current.push({
        mesh: pipeGroup,
        x: 6,
        gapY: gapY,
        scored: false,
      });
    };

    // Main Unified Render Loop with Delta Time
    const animate = () => {
      const dt = Math.min(clock.getDelta(), 0.1); // prevent massive jumps when losing focus
      const state = gameStateRef.current;

      // Update background clouds slowly
      cloudsRef.current.forEach(cloud => {
        cloud.position.x -= 0.65 * dt;
        if (cloud.position.x < -7) {
          cloud.position.x = 7;
          cloud.position.y = Math.random() * 3.2 + 1.2;
        }
      });

      if (state === 'PLAYING') {
        // Apply falling physics
        birdVelocityRef.current += -18.0 * dt; // Gravity acceleration
        if (birdVelocityRef.current < -10) birdVelocityRef.current = -10; // Terminal velocity
        birdYRef.current += birdVelocityRef.current * dt;

        // Sync bird mesh position & angle
        if (birdGroupRef.current) {
          birdGroupRef.current.position.y = birdYRef.current;
          // Rotate bird up/down smoothly based on velocity
          birdGroupRef.current.rotation.z = Math.max(-Math.PI / 3, Math.min(Math.PI / 6, birdVelocityRef.current * 0.08));
        }

        // Handle Spawning Pipes
        spawnTimerRef.current += dt;
        if (spawnTimerRef.current >= 1.8) {
          spawnTimerRef.current = 0;
          spawnPipe(scene);
        }

        // Move Pipes, Handle scoring and collisions
        let hasCollided = false;

        pipesRef.current.forEach(p => {
          p.x -= 3.5 * dt; // Horizontal speed
          p.mesh.position.x = p.x;

          // Check if bird passed pipe successfully (Bird is at fixed X = -2.0)
          if (!p.scored && p.x < -2.0) {
            p.scored = true;
            scoreRef.current += 1;
            setScore(scoreRef.current);
            sound.playBonus(); // Beautiful retro retro pitch sound!
          }

          // Precise collision calculation (X span check + Y bounds)
          if (Math.abs(-2.0 - p.x) < 0.8) {
            const gapSize = 2.3;
            const gapTop = p.gapY + gapSize / 2 - 0.25;
            const gapBottom = p.gapY - gapSize / 2 + 0.25;

            if (birdYRef.current > gapTop || birdYRef.current < gapBottom) {
              hasCollided = true;
            }
          }
        });

        // Crash bounds: Grass floor at Y = -3.7, sky roof at Y = 4.8
        if (birdYRef.current <= -3.35 || birdYRef.current >= 4.8) {
          hasCollided = true;
        }

        if (hasCollided) {
          setGameState('GAME_OVER');
          gameStateRef.current = 'GAME_OVER';
          sound.playExplosion();
          sound.playGameOver();
          onUpdateHighScore(scoreRef.current);
        }

        // Clean up out of boundary pipes
        pipesRef.current = pipesRef.current.filter(p => {
          if (p.x < -7) {
            scene.remove(p.mesh);
            p.mesh.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                  child.material.forEach((m) => m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            });
            return false;
          }
          return true;
        });

      } else if (state === 'GAME_OVER') {
        // Drop dead fall to the floor
        if (birdYRef.current > -3.35) {
          birdVelocityRef.current += -22.0 * dt;
          birdYRef.current = Math.max(-3.35, birdYRef.current + birdVelocityRef.current * dt);
        }
        if (birdGroupRef.current) {
          birdGroupRef.current.position.y = birdYRef.current;
          // Spin face-down as it falls
          birdGroupRef.current.rotation.z -= dt * 4.5;
        }
      } else {
        // IDLE / COUNTDOWN: Hover and float nicely
        const elapsed = clock.getElapsedTime();
        birdYRef.current = Math.sin(elapsed * 4) * 0.15;
        if (birdGroupRef.current) {
          birdGroupRef.current.position.y = birdYRef.current;
          birdGroupRef.current.rotation.z = Math.sin(elapsed * 4) * 0.05;
        }
      }

      // Dynamic wing flapping speed
      const isFlappingFast = flapTimerRef.current > 0;
      if (isFlappingFast) {
        flapTimerRef.current -= dt;
      }
      const flapFrequency = isFlappingFast ? 35 : 12;
      flapPhaseRef.current += dt * flapFrequency;

      if (wingLeftRef.current && wingRightRef.current && state !== 'GAME_OVER') {
        const flapAngle = Math.sin(flapPhaseRef.current) * 0.55;
        wingLeftRef.current.rotation.x = flapAngle;
        wingRightRef.current.rotation.x = -flapAngle;
      }

      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(requestRef.current);
      renderer.dispose();
      if (containerRef.current && containerRef.current.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [onUpdateHighScore]);

  // Handle Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        const state = gameStateRef.current;
        if (state === 'IDLE' || state === 'GAME_OVER') {
          resetGame();
        } else if (state === 'PLAYING') {
          birdVelocityRef.current = 5.2; // Jump force
          flapTimerRef.current = 0.35;    // flap quickly
          sound.playBounce(1.5);         // Play sound effect
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetGame]);

  return (
    <div className="flex flex-col items-center select-none relative">
      {/* Dynamic HUD Score Container */}
      <div className="absolute top-6 flex flex-col items-center z-10">
        <span className="text-[11px] font-arcade tracking-widest text-sky-100 opacity-80 uppercase mb-1">SKOR</span>
        <div className="text-4xl font-arcade text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] font-bold">{score}</div>
      </div>
      
      {/* 3D WebGL Canvas Container with Retro Bezel */}
      <div className="relative p-3 bg-slate-900 border-2 border-slate-700/80 rounded-2xl shadow-2xl">
        <div ref={containerRef} className="rounded-lg overflow-hidden border border-slate-950/80" />
      </div>

      <div className="mt-4 text-xs font-arcade text-slate-400">YÜKSEK SKOR: <span className="text-yellow-400 font-bold">{highScore}</span></div>
      
      {/* Controls Info Board */}
      <div className="mt-5 p-4 bg-slate-950/45 backdrop-blur-md border border-slate-800/80 rounded-xl text-center max-w-xs w-full shadow-lg">
        <h3 className="font-arcade text-[10px] text-yellow-400 mb-2 tracking-wider">KONTROLLER</h3>
        <p className="text-xs text-slate-300 font-medium leading-relaxed">
          Zıplamak veya Başlatmak için <span className="text-emerald-400 font-bold px-1.5 py-0.5 bg-slate-900/80 border border-slate-700 rounded text-[10px] font-mono">SPACE (BOŞLUK)</span> tuşuna bas!
        </p>
      </div>
      
      {/* GAME OVER Screen */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
          <div className="p-8 bg-slate-900/95 border border-slate-700 rounded-2xl text-center shadow-2xl max-w-xs w-full mx-4">
            <h2 className="text-2xl font-arcade text-red-500 mb-4 tracking-wide">OYUN BİTTİ</h2>
            <div className="bg-slate-950/50 rounded-lg py-3 px-4 mb-6 border border-slate-800/60">
              <p className="text-xs text-slate-400 font-arcade mb-1">KAZANDIĞIN SKOR</p>
              <p className="text-3xl font-arcade text-white font-bold">{score}</p>
            </div>
            <button 
              onClick={resetGame} 
              className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold text-sm tracking-wide transition-all shadow-md active:scale-95 font-arcade"
            >
              TEKRAR OYNA
            </button>
          </div>
        </div>
      )}

      {/* COUNTDOWN Screen */}
      {gameState === 'COUNTDOWN' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div key={countdown} className="text-8xl font-arcade text-yellow-400 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] animate-ping font-bold">
            {countdown}
          </div>
        </div>
      )}
      
      {/* IDLE Start Screen */}
      {gameState === 'IDLE' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] rounded-2xl">
          <button 
            onClick={resetGame} 
            className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold text-sm shadow-xl active:scale-95 transition-all font-arcade tracking-wider border border-emerald-500/30"
          >
            BAŞLAT (BOŞLUK)
          </button>
        </div>
      )}
    </div>
  );
};
