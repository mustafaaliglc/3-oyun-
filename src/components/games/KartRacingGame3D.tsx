import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useMultiplayer } from '../../utils/useMultiplayer';
import { sound } from '../../utils/audio';
import { GameInfo, GameSettings } from '../../types/game';
import { GameMenuModal } from '../GameMenuModal';
import { InviteShareModal } from '../InviteShareModal';
import {
  Users,
  Flag,
  Zap,
  RotateCcw,
  Trophy,
  Timer,
  Share2,
  Sliders,
} from 'lucide-react';

interface KartRacingProps {
  game: GameInfo;
  highScore: number;
  onUpdateHighScore: (score: number) => void;
}

export const KartRacingGame3D: React.FC<KartRacingProps> = ({
  game,
  highScore,
  onUpdateHighScore,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [playerName, setPlayerName] = useState<string>('Racer_Pro');
  const [kartColor, setKartColor] = useState<string>('#f59e0b');
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [lap, setLap] = useState<number>(1);
  const [lapTime, setLapTime] = useState<number>(0);
  const [hasBoost, setHasBoost] = useState<boolean>(false);

  // Modals (Default open on game load directly inside game screen)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(true);
  const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);

  // Settings
  const [settings, setSettings] = useState<GameSettings>({
    graphicsQuality: 'high',
    soundVolume: 80,
    cameraFov: 60,
    steeringSensitivity: 2,
  });

  // Multiplayer Hook
  const { connected, playerId, players, sendUpdate } = useMultiplayer({
    room: 'kart_racing',
    playerName,
    playerColor: kartColor,
    vehicle: 'neon_kart',
  });

  const kartRef = useRef({
    x: 0,
    y: 0.35,
    z: -80,
    rotation: 0,
    speed: 0,
    maxSpeed: 2.3,
    nitro: 100,
    lap: 1,
    lapStart: Date.now(),
    score: 0,
  });

  const keysRef = useRef<{ w: boolean; s: boolean; a: boolean; d: boolean; nitro: boolean }>({
    w: false,
    s: false,
    a: false,
    d: false,
    nitro: false,
  });

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerKartMeshRef = useRef<THREE.Group | null>(null);
  const remoteKartMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const boostPadsRef = useRef<THREE.Mesh[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

  const triggerBoost = () => {
    const k = kartRef.current;
    if (k.nitro >= 25) {
      sound.playPowerup();
      k.nitro -= 25;
      k.speed = 3.3;
      setHasBoost(true);
      setTimeout(() => setHasBoost(false), 2000);
    }
  };

  const createKartMesh = (colorHex: string) => {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.85, roughness: 0.15 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 2.9), bodyMat);
    body.position.y = 0.42;
    group.add(body);

    const spoilerMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.5 });
    const frontSpoil = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.15, 0.65), spoilerMat);
    frontSpoil.position.set(0, 0.3, 1.45);
    group.add(frontSpoil);

    const rearWing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.15, 0.55), spoilerMat);
    rearWing.position.set(0, 1.05, -1.25);
    group.add(rearWing);

    const tireMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.85 });
    const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.4, 16);
    tireGeo.rotateZ(Math.PI / 2);

    [[-0.95, 0.38, 0.95], [0.95, 0.38, 0.95], [-0.95, 0.38, -0.95], [0.95, 0.38, -0.95]].forEach(([x, y, z]) => {
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.position.set(x, y, z);
      group.add(tire);
    });

    return group;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#030712');
    scene.fog = new THREE.FogExp2('#030712', 0.007);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      settings.cameraFov,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: settings.graphicsQuality !== 'low' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    scene.add(new THREE.AmbientLight('#f59e0b', 1.1));
    const dirLight = new THREE.DirectionalLight('#ffffff', 2.2);
    dirLight.position.set(50, 90, -40);
    scene.add(dirLight);

    // 5. Track
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(550, 550),
      new THREE.MeshStandardMaterial({ color: '#030712', roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const track = new THREE.Mesh(
      new THREE.RingGeometry(62, 98, 64),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 })
    );
    track.rotation.x = -Math.PI / 2;
    track.position.y = 0.02;
    scene.add(track);

    const innerBorder = new THREE.Mesh(
      new THREE.RingGeometry(60, 62, 64),
      new THREE.MeshBasicMaterial({ color: '#f59e0b' })
    );
    innerBorder.rotation.x = -Math.PI / 2;
    innerBorder.position.y = 0.04;
    scene.add(innerBorder);

    const outerBorder = new THREE.Mesh(
      new THREE.RingGeometry(98, 100, 64),
      new THREE.MeshBasicMaterial({ color: '#06b6d4' })
    );
    outerBorder.rotation.x = -Math.PI / 2;
    outerBorder.position.y = 0.04;
    scene.add(outerBorder);

    // Finish Arch
    const arch = new THREE.Mesh(
      new THREE.BoxGeometry(38, 1.8, 4),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 })
    );
    arch.position.set(0, 8.5, -80);
    scene.add(arch);

    // Boost Pads
    const boostPads: THREE.Mesh[] = [];
    const padMat = new THREE.MeshBasicMaterial({ color: '#10b981' });
    [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4].forEach((ang) => {
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(7, 13), padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(Math.cos(ang) * 80, 0.05, Math.sin(ang) * 80);
      scene.add(pad);
      boostPads.push(pad);
    });
    boostPadsRef.current = boostPads;

    // Player Kart
    const playerKart = createKartMesh(kartColor);
    playerKart.position.set(0, 0.35, -80);
    scene.add(playerKart);
    playerKartMeshRef.current = playerKart;

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [kartColor, settings]);

  useEffect(() => {
    let lastSend = 0;

    const animate = () => {
      const k = kartRef.current;
      const keys = keysRef.current;
      const kartMesh = playerKartMeshRef.current;
      const camera = cameraRef.current;
      const scene = sceneRef.current;
      const renderer = rendererRef.current;

      if (kartMesh && camera && scene && renderer) {
        if (keys.w) {
          k.speed = Math.min(k.speed + 0.038, k.maxSpeed);
        } else if (keys.s) {
          k.speed = Math.max(k.speed - 0.05, -0.6);
        } else {
          k.speed *= 0.98;
        }

        if (keys.a) k.rotation += 0.042;
        if (keys.d) k.rotation -= 0.042;

        k.x += Math.sin(k.rotation) * k.speed;
        k.z += Math.cos(k.rotation) * k.speed;

        kartMesh.position.set(k.x, 0.35, k.z);
        kartMesh.rotation.y = k.rotation;

        const camDist = 7.8;
        camera.position.x = k.x - Math.sin(k.rotation) * camDist;
        camera.position.y = 4.0;
        camera.position.z = k.z - Math.cos(k.rotation) * camDist;
        camera.lookAt(k.x, 1.2, k.z);

        boostPadsRef.current.forEach((pad) => {
          if (Math.hypot(pad.position.x - k.x, pad.position.z - k.z) < 5.5) {
            k.speed = 3.3;
            sound.playBounce(2);
          }
        });

        const elapsedSec = ((Date.now() - k.lapStart) / 1000).toFixed(1);
        setLapTime(Number(elapsedSec));
        setSpeedKmh(Math.round(Math.abs(k.speed) * 98));

        const now = Date.now();
        if (now - lastSend > 50) {
          lastSend = now;
          sendUpdate({
            x: k.x,
            y: k.y,
            z: k.z,
            rotation: k.rotation,
            speed: k.speed,
          });
        }

        renderer.render(scene, camera);
      }

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [playerId, players, sendUpdate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') keysRef.current.w = true;
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') keysRef.current.s = true;
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keysRef.current.a = true;
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keysRef.current.d = true;
      if (e.key === ' ') triggerBoost();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') keysRef.current.w = false;
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') keysRef.current.s = false;
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keysRef.current.a = false;
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keysRef.current.d = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto select-none relative">
      {/* Game Menu Modal */}
      <GameMenuModal
        game={game}
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        playerName={playerName}
        onPlayerNameChange={setPlayerName}
        playerColor={kartColor}
        onPlayerColorChange={setKartColor}
        settings={settings}
        onSettingsChange={setSettings}
        onStartGame={() => {
          setIsMenuOpen(false);
          sound.playBonus();
        }}
      />

      {/* Share Modal */}
      <InviteShareModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onlineCount={players.size + 1}
      />

      {/* Top HUD */}
      <div className="w-full flex items-center justify-between bg-slate-900/95 border border-amber-500/40 rounded-t-xl px-4 py-3 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">HIZ:</span>
            <span className="font-arcade text-xl text-white tabular-nums">{speedKmh}</span>
            <span className="text-xs text-slate-400 font-mono">KM/H</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Timer className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono tabular-nums">{lapTime.toFixed(1)}s</span>
          </div>
        </div>

        {/* Center: Invite & Menu */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Arkadaşını Davet Et</span>
          </button>

          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold border border-slate-700 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Menü & Ayarlar</span>
          </button>
        </div>

        {/* Right: Age Rating & Lap */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded text-xs font-bold border border-amber-500/30">
            <Flag className="w-3.5 h-3.5" /> TUR 1/3
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
            {game.ageRating}
          </div>
        </div>
      </div>

      {/* 3D Viewport */}
      <div className="relative w-full aspect-16/9 bg-[#030712] border-x border-amber-500/30 overflow-hidden shadow-2xl">
        <div ref={containerRef} className="w-full h-full" />

        {hasBoost && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-black text-sm px-4 py-1.5 rounded-full shadow-lg shadow-amber-500/30 animate-pulse z-20">
            ⚡ SÜPER NİTRO TURBO!
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="w-full bg-slate-900/95 border border-amber-500/40 rounded-b-xl px-4 py-3 flex items-center justify-between gap-3">
        <button
          onClick={triggerBoost}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-95 text-slate-950 text-xs font-black rounded-lg shadow-md transition-all"
        >
          <Zap className="w-4 h-4 fill-current" />
          NİTRO TURBO (Boşluk)
        </button>

        <div className="flex items-center gap-2">
          <button
            onPointerDown={() => { keysRef.current.a = true; }}
            onPointerUp={() => { keysRef.current.a = false; }}
            className="px-3.5 py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded-lg border border-slate-700"
          >
            SOL ◀
          </button>
          <button
            onPointerDown={() => { keysRef.current.w = true; }}
            onPointerUp={() => { keysRef.current.w = false; }}
            className="px-4 py-2 bg-emerald-600 active:bg-emerald-500 text-slate-950 text-xs font-extrabold rounded-lg"
          >
            GAZ ▲
          </button>
          <button
            onPointerDown={() => { keysRef.current.d = true; }}
            onPointerUp={() => { keysRef.current.d = false; }}
            className="px-3.5 py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded-lg border border-slate-700"
          >
            ▶ SAĞ
          </button>
        </div>
      </div>
    </div>
  );
};
