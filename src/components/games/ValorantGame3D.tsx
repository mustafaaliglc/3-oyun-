import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useMultiplayer } from '../../utils/useMultiplayer';
import { sound } from '../../utils/audio';
import { GameInfo, GameSettings } from '../../types/game';
import { GameMenuModal } from '../GameMenuModal';
import { InviteShareModal } from '../InviteShareModal';
import {
  Crosshair,
  Shield,
  Zap,
  Target,
  Clock,
  Award,
  Play,
  RotateCcw,
  Sparkles,
  Bomb,
  Wind,
  Sun,
  Users,
  Eye,
} from 'lucide-react';

interface ValorantGameProps {
  game: GameInfo;
  highScore: number;
  onUpdateHighScore: (score: number) => void;
}

type WeaponType = 'vandal' | 'phantom' | 'operator';

interface TargetBot {
  id: string;
  group: THREE.Group;
  headMesh: THREE.Mesh;
  bodyMesh: THREE.Mesh;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  isDead: boolean;
  respawnTime: number;
}

export const ValorantGame3D: React.FC<ValorantGameProps> = ({
  game,
  highScore,
  onUpdateHighScore,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Player state
  const [playerName, setPlayerName] = useState<string>('Jett_Agent');
  const [score, setScore] = useState<number>(0);
  const [kills, setKills] = useState<number>(0);
  const [headshots, setHeadshots] = useState<number>(0);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>('vandal');
  const [ammo, setAmmo] = useState<{ current: number; max: number }>({ current: 25, max: 25 });
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [isAds, setIsAds] = useState<boolean>(false);
  const [spikePlanted, setSpikePlanted] = useState<boolean>(true);
  const [spikeTimeLeft, setSpikeTimeLeft] = useState<number>(45);
  const [isDefusing, setIsDefusing] = useState<boolean>(false);
  const [defuseProgress, setDefuseProgress] = useState<number>(0);
  const [dashCooldown, setDashCooldown] = useState<number>(0);
  const [flashCooldown, setFlashCooldown] = useState<number>(0);
  const [lastHitNotice, setLastHitNotice] = useState<{ text: string; color: string } | null>(null);
  const [aceBanner, setAceBanner] = useState<string | null>(null);
  const [nearSpike, setNearSpike] = useState<boolean>(false);
  const [playerColor, setPlayerColor] = useState<string>('#f43f5e');
  const [settings, setSettings] = useState<GameSettings>({
    graphicsQuality: 'high',
    soundVolume: 80,
    cameraFov: 65,
    steeringSensitivity: 2,
  });

  // Modals
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(true);
  const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);

  // Multiplayer Hook
  const { connected, playerId, players, sendUpdate, sendChat, chatMessages } = useMultiplayer({
    room: 'valorant',
    playerName,
    playerColor: '#f43f5e',
    vehicle: currentWeapon,
  });

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const weaponMeshRef = useRef<THREE.Group | null>(null);
  const botsRef = useRef<TargetBot[]>([]);
  const spikeMeshRef = useRef<THREE.Group | null>(null);
  const bulletsRef = useRef<{ mesh: THREE.Mesh; dir: THREE.Vector3; life: number }[]>([]);
  const flashOverlayRef = useRef<number>(0); // 0 to 1
  const animationFrameIdRef = useRef<number | null>(null);

  // Player physics
  const playerPosRef = useRef({
    x: 0,
    y: 1.7,
    z: 18,
    vx: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    isJumping: false,
    vy: 0,
  });

  const keysRef = useRef<{ w: boolean; s: boolean; a: boolean; d: boolean; space: boolean }>({
    w: false,
    s: false,
    a: false,
    d: false,
    space: false,
  });

  const isMouseDownRef = useRef(false);
  const lastShotTimeRef = useRef(0);

  // Weapon specs
  const WEAPON_CONFIG = {
    vandal: { name: 'VANDAL', mag: 25, fireRate: 110, dmgHead: 160, dmgBody: 40, auto: true },
    phantom: { name: 'PHANTOM', mag: 30, fireRate: 95, dmgHead: 140, dmgBody: 35, auto: true },
    operator: { name: 'OPERATOR', mag: 5, fireRate: 1100, dmgHead: 255, dmgBody: 150, auto: false },
  };

  // Switch weapon
  const handleSelectWeapon = (w: WeaponType) => {
    setCurrentWeapon(w);
    setAmmo({ current: WEAPON_CONFIG[w].mag, max: WEAPON_CONFIG[w].mag });
    sound.playBonus();
  };

  // Reload
  const handleReload = useCallback(() => {
    if (isReloading || ammo.current === ammo.max) return;
    setIsReloading(true);
    sound.playTone(320, 'sine', 0.12, 0.2);
    setTimeout(() => {
      sound.playTone(540, 'triangle', 0.15, 0.25);
      setAmmo({ current: WEAPON_CONFIG[currentWeapon].mag, max: WEAPON_CONFIG[currentWeapon].mag });
      setIsReloading(false);
    }, 1200);
  }, [isReloading, ammo, currentWeapon]);

  // Jett Dash Ability
  const handleDash = useCallback(() => {
    if (dashCooldown > 0) return;
    setDashCooldown(6);

    const pos = playerPosRef.current;
    const forwardX = -Math.sin(pos.yaw);
    const forwardZ = -Math.cos(pos.yaw);
    pos.x += forwardX * 12;
    pos.z += forwardZ * 12;

    sound.playTone(600, 'sawtooth', 0.2, 0.3);
    setLastHitNotice({ text: '💨 JETT TAILWIND DASH!', color: '#38bdf8' });
    setTimeout(() => setLastHitNotice(null), 1500);
  }, [dashCooldown]);

  // Flash Ability
  const handleFlash = useCallback(() => {
    if (flashCooldown > 0) return;
    setFlashCooldown(8);
    flashOverlayRef.current = 1.0;
    sound.playTone(850, 'square', 0.18, 0.25);
    setLastHitNotice({ text: '✨ PARLAMA / FLAŞ ETKİN!', color: '#facc15' });
    setTimeout(() => setLastHitNotice(null), 1200);
  }, [flashCooldown]);

  // Ability Cooldown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDashCooldown((c) => (c > 0 ? c - 1 : 0));
      setFlashCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Spike Bomb Timer (45s)
  useEffect(() => {
    if (!spikePlanted || isMenuOpen) return;
    const interval = setInterval(() => {
      setSpikeTimeLeft((prev) => {
        if (prev <= 1) {
          // Spike detonated
          sound.playExplosion();
          setAceBanner('💥 SPİKE PATLADI! RAUND KAYBEDİLDİ');
          setTimeout(() => {
            setSpikeTimeLeft(45);
            setAceBanner(null);
          }, 4000);
          return 45;
        }
        // Accelerating beep
        if (prev % 2 === 0 || prev < 10) {
          sound.playTone(750 + (45 - prev) * 15, 'square', 0.08, 0.1);
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [spikePlanted, isMenuOpen]);

  // Build Target Bot Model
  const createBotMesh = (x: number, y: number, z: number, id: string): TargetBot => {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Torso armor
    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      metalness: 0.6,
      roughness: 0.3,
    });
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.1, 0.45), bodyMat);
    bodyMesh.position.y = 1.1;
    group.add(bodyMesh);

    // Red core chest glowing light
    const coreMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.1),
      new THREE.MeshBasicMaterial({ color: '#f43f5e' })
    );
    coreMesh.position.set(0, 1.15, 0.25);
    group.add(coreMesh);

    // Head
    const headMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      metalness: 0.8,
      roughness: 0.2,
    });
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), headMat);
    headMesh.position.y = 1.95;
    group.add(headMesh);

    // Visor
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.12, 0.15),
      new THREE.MeshBasicMaterial({ color: '#06b6d4' })
    );
    visor.position.set(0, 1.95, 0.24);
    group.add(visor);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b' });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), legMat);
    legL.position.set(-0.25, 0.4, 0);
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.25;
    group.add(legR);

    return {
      id,
      group,
      headMesh,
      bodyMesh,
      hp: 100,
      maxHp: 100,
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * 0.04,
      vz: (Math.random() - 0.5) * 0.04,
      isDead: false,
      respawnTime: 0,
    };
  };

  // Build First-Person Gun Model
  const createWeaponMesh = (type: WeaponType) => {
    const gun = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({ color: '#18181b', metalness: 0.8, roughness: 0.2 });
    const redAccent = new THREE.MeshStandardMaterial({ color: '#f43f5e', roughness: 0.4 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: '#27272a', metalness: 0.9 });

    if (type === 'vandal') {
      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.85), darkMat);
      gun.add(body);
      // Angular shroud
      const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.4), redAccent);
      shroud.position.set(0, 0.05, -0.1);
      gun.add(shroud);
      // Long barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 12), barrelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.04, -0.7);
      gun.add(barrel);
      // Curved Magazine
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.14), redAccent);
      mag.position.set(0, -0.2, 0.05);
      mag.rotation.x = 0.25;
      gun.add(mag);
    } else if (type === 'phantom') {
      // Sleek silenced body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.75), darkMat);
      gun.add(body);
      // Big silencer barrel
      const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 16), darkMat);
      silencer.rotation.x = Math.PI / 2;
      silencer.position.set(0, 0.02, -0.65);
      gun.add(silencer);
      const glowStripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.4), new THREE.MeshBasicMaterial({ color: '#38bdf8' }));
      glowStripe.position.set(0, 0.08, -0.05);
      gun.add(glowStripe);
    } else {
      // Operator heavy sniper
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.22, 1.1), darkMat);
      gun.add(body);
      // Sniper scope
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 12), redAccent);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.16, -0.1);
      gun.add(scope);
      // Massive barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 12), barrelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.04, -1.05);
      gun.add(barrel);
    }

    gun.position.set(0.38, -0.32, -0.75);
    return gun;
  };

  // Initialize Three.js Tactical Arena
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#0c1222');
    scene.fog = new THREE.FogExp2('#0c1222', 0.012);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 400);
    cameraRef.current = camera;
    camera.position.set(0, 1.7, 18);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambLight = new THREE.AmbientLight('#94a3b8', 1.2);
    scene.add(ambLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 1.8);
    dirLight.position.set(25, 45, 20);
    scene.add(dirLight);

    const cyanAccent = new THREE.PointLight('#06b6d4', 3.5, 45);
    cyanAccent.position.set(0, 10, 0);
    scene.add(cyanAccent);

    // 5. Training Site Floor & Radianite Boxes
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Boundary walls
    const wallMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(80, 14, 2), wallMat);
    wallN.position.set(0, 7, -40);
    scene.add(wallN);

    const wallS = new THREE.Mesh(new THREE.BoxGeometry(80, 14, 2), wallMat);
    wallS.position.set(0, 7, 40);
    scene.add(wallS);

    const wallE = new THREE.Mesh(new THREE.BoxGeometry(2, 14, 80), wallMat);
    wallE.position.set(40, 7, 0);
    scene.add(wallE);

    const wallW = new THREE.Mesh(new THREE.BoxGeometry(2, 14, 80), wallMat);
    wallW.position.set(-40, 7, 0);
    scene.add(wallW);

    // Radianite glowing green cubes
    const radianiteMat = new THREE.MeshStandardMaterial({
      color: '#10b981',
      emissive: '#059669',
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });

    const boxPositions = [
      [-12, 1.5, 4],
      [-12, 4.5, 4],
      [-9, 1.5, 4],
      [14, 1.5, -6],
      [14, 1.5, -3],
      [-6, 1.5, -18],
      [8, 1.5, -22],
    ];

    boxPositions.forEach(([bx, by, bz]) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), radianiteMat);
      box.position.set(bx, by, bz);
      scene.add(box);
    });

    // Elevated Catwalk / Heaven
    const catwalkMat = new THREE.MeshStandardMaterial({ color: '#334155' });
    const catwalk = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 8), catwalkMat);
    catwalk.position.set(0, 5, -32);
    scene.add(catwalk);

    // Pillars supporting catwalk
    const pillarMat = new THREE.MeshStandardMaterial({ color: '#1e293b' });
    [-10, 10].forEach((px) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 5, 8), pillarMat);
      p.position.set(px, 2.5, -32);
      scene.add(p);
    });

    // Plant Site Glowing Ring (Spike Zone)
    const ringGeo = new THREE.RingGeometry(5.5, 5.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#f43f5e', side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.05, 0);
    scene.add(ring);

    // The Spike 3D Device
    const spikeGroup = new THREE.Group();
    spikeGroup.position.set(0, 0.6, 0);

    const spikeBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, 0.7, 6),
      new THREE.MeshStandardMaterial({ color: '#090d16', metalness: 0.9 })
    );
    spikeGroup.add(spikeBase);

    const spikeCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28),
      new THREE.MeshBasicMaterial({ color: '#f43f5e' })
    );
    spikeCore.position.y = 0.65;
    spikeGroup.add(spikeCore);

    scene.add(spikeGroup);
    spikeMeshRef.current = spikeGroup;

    // First Person Weapon
    const gun = createWeaponMesh(currentWeapon);
    camera.add(gun);
    scene.add(camera);
    weaponMeshRef.current = gun;

    // Spawn 5 Target Practice Bots
    const bots: TargetBot[] = [];
    const botCoords = [
      [0, 0, -12],
      [-10, 0, -6],
      [11, 0, -10],
      [-5, 5, -32],
      [6, 5, -32],
    ];

    botCoords.forEach(([bx, by, bz], i) => {
      const b = createBotMesh(bx, by, bz, `bot_${i}`);
      scene.add(b.group);
      bots.push(b);
    });
    botsRef.current = bots;

    // Resize
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
  }, [currentWeapon]);

  // Shooting Action
  const shoot = useCallback(() => {
    if (ammo.current <= 0) {
      sound.playTone(200, 'square', 0.05, 0.1);
      handleReload();
      return;
    }

    const now = performance.now();
    const config = WEAPON_CONFIG[currentWeapon];
    if (now - lastShotTimeRef.current < config.fireRate) return;
    lastShotTimeRef.current = now;

    // Deduct ammo
    setAmmo((prev) => ({ ...prev, current: prev.current - 1 }));

    // Sound effect
    if (currentWeapon === 'operator') {
      sound.playTone(180, 'sawtooth', 0.35, 0.4);
    } else if (currentWeapon === 'phantom') {
      sound.playTone(520, 'sine', 0.08, 0.2);
    } else {
      sound.playTone(380, 'square', 0.1, 0.28);
    }

    // Gun Recoil Kick
    if (weaponMeshRef.current) {
      weaponMeshRef.current.position.z = -0.65;
      weaponMeshRef.current.rotation.x = 0.12;
      setTimeout(() => {
        if (weaponMeshRef.current) {
          weaponMeshRef.current.position.z = -0.75;
          weaponMeshRef.current.rotation.x = 0;
        }
      }, 70);
    }

    // Raycast hit detection from camera center
    const camera = cameraRef.current;
    if (!camera) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const hitTargets: { distance: number; bot: TargetBot; isHead: boolean }[] = [];

    botsRef.current.forEach((bot) => {
      if (bot.isDead) return;

      const headHits = raycaster.intersectObject(bot.headMesh, false);
      if (headHits.length > 0) {
        hitTargets.push({ distance: headHits[0].distance, bot, isHead: true });
        return;
      }

      const bodyHits = raycaster.intersectObject(bot.bodyMesh, false);
      if (bodyHits.length > 0) {
        hitTargets.push({ distance: bodyHits[0].distance, bot, isHead: false });
      }
    });

    if (hitTargets.length > 0) {
      hitTargets.sort((a, b) => a.distance - b.distance);
      const hit = hitTargets[0];
      const bot = hit.bot;
      const damage = hit.isHead ? config.dmgHead : config.dmgBody;

      bot.hp -= damage;

      if (hit.isHead) {
        // Crisp Valorant "TINK!" Headshot sound
        sound.playTone(1200, 'triangle', 0.15, 0.3);
        setHeadshots((h) => h + 1);
        setLastHitNotice({ text: `🎯 KAFA VURUŞU! -${damage} HP (160)`, color: '#facc15' });
      } else {
        sound.playTone(480, 'sine', 0.08, 0.2);
        setLastHitNotice({ text: `GÖVDE VURUŞU -${damage} HP`, color: '#f8fafc' });
      }
      setTimeout(() => setLastHitNotice(null), 1000);

      // Bot killed
      if (bot.hp <= 0 && !bot.isDead) {
        bot.isDead = true;
        bot.group.visible = false;
        bot.respawnTime = performance.now() + 2500;

        sound.playBonus();
        setKills((k) => {
          const next = k + 1;
          const killScore = (hit.isHead ? 250 : 100);
          setScore((s) => {
            const newScore = s + killScore;
            onUpdateHighScore(newScore);
            return newScore;
          });
          if (next % 5 === 0) {
            setAceBanner('💥 ACE! 5 DÜŞMAN ARKA ARKAYA TEMİZLENDİ');
            setTimeout(() => setAceBanner(null), 3500);
          }
          return next;
        });
      }
    }
  }, [ammo, currentWeapon, handleReload, onUpdateHighScore]);

  // Pointer lock / Mouse look
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== container) return;
      const sensitivity = isAds ? 0.0012 : 0.0024;
      playerPosRef.current.yaw -= e.movementX * sensitivity;
      playerPosRef.current.pitch -= e.movementY * sensitivity;
      playerPosRef.current.pitch = Math.max(-1.4, Math.min(1.4, playerPosRef.current.pitch));
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDownRef.current = true;
        shoot();
      } else if (e.button === 2) {
        // Toggle ADS zoom
        e.preventDefault();
        setIsAds((prev) => !prev);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isMouseDownRef.current = false;
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    const handleClick = () => {
      if (document.pointerLockElement !== container) {
        container.requestPointerLock?.();
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('click', handleClick);
    };
  }, [isAds, shoot]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysRef.current.w = true;
      if (k === 's' || e.key === 'ArrowDown') keysRef.current.s = true;
      if (k === 'a' || e.key === 'ArrowLeft') keysRef.current.a = true;
      if (k === 'd' || e.key === 'ArrowRight') keysRef.current.d = true;
      if (e.code === 'Space') keysRef.current.space = true;

      if (k === '1') handleSelectWeapon('vandal');
      if (k === '2') handleSelectWeapon('phantom');
      if (k === '3') handleSelectWeapon('operator');
      if (k === 'r') handleReload();
      if (k === 'e') handleDash();
      if (k === 'q') handleFlash();

      // Spike defuse key: 4
      if (k === '4') {
        setIsDefusing(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysRef.current.w = false;
      if (k === 's' || e.key === 'ArrowDown') keysRef.current.s = false;
      if (k === 'a' || e.key === 'ArrowLeft') keysRef.current.a = false;
      if (k === 'd' || e.key === 'ArrowRight') keysRef.current.d = false;
      if (e.code === 'Space') keysRef.current.space = false;
      if (k === '4') setIsDefusing(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleReload, handleDash, handleFlash]);

  // Main Game Loop
  useEffect(() => {
    let lastTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const pos = playerPosRef.current;
      const keys = keysRef.current;
      const camera = cameraRef.current;
      const scene = sceneRef.current;
      const renderer = rendererRef.current;
      const spike = spikeMeshRef.current;

      // Check distance to Spike (Center 0, 0, 0)
      const distToSpike = Math.hypot(pos.x, pos.z);
      setNearSpike(distToSpike < 6.5);

      // Handle defusing Spike
      if (isDefusing && distToSpike < 6.5) {
        setDefuseProgress((p) => {
          const next = p + dt * 25; // 4 seconds to defuse
          if (next >= 100) {
            sound.playBonus();
            setAceBanner('🏆 RAUND KAZANILDI! SPİKE BAŞARIYLA İMHA EDİLDİ!');
            setScore((s) => {
              const newS = s + 1000;
              onUpdateHighScore(newS);
              return newS;
            });
            setTimeout(() => {
              setSpikeTimeLeft(45);
              setAceBanner(null);
            }, 4000);
            return 0;
          }
          return next;
        });
      } else if (!isDefusing) {
        setDefuseProgress(0);
      }

      // Continuous automatic fire if mouse held down
      if (isMouseDownRef.current && WEAPON_CONFIG[currentWeapon].auto) {
        shoot();
      }

      // Player Movement Physics
      const moveSpeed = isAds ? 5 : 9;
      let dx = 0;
      let dz = 0;

      if (keys.w) dz -= 1;
      if (keys.s) dz += 1;
      if (keys.a) dx -= 1;
      if (keys.d) dx += 1;

      if (dx !== 0 || dz !== 0) {
        const len = Math.hypot(dx, dz);
        dx /= len;
        dz /= len;

        const sinYaw = Math.sin(pos.yaw);
        const cosYaw = Math.cos(pos.yaw);

        pos.x += (dx * cosYaw + dz * sinYaw) * moveSpeed * dt;
        pos.z += (dz * cosYaw - dx * sinYaw) * moveSpeed * dt;

        // Boundaries
        pos.x = Math.max(-36, Math.min(36, pos.x));
        pos.z = Math.max(-36, Math.min(36, pos.z));
      }

      // Jump
      if (keys.space && !pos.isJumping) {
        pos.isJumping = true;
        pos.vy = 6.2;
        sound.playTone(340, 'triangle', 0.08, 0.15);
      }

      if (pos.isJumping) {
        pos.y += pos.vy * dt;
        pos.vy -= 18 * dt; // gravity
        if (pos.y <= 1.7) {
          pos.y = 1.7;
          pos.isJumping = false;
          pos.vy = 0;
        }
      }

      // Update Camera Orientation
      if (camera) {
        camera.position.set(pos.x, pos.y, pos.z);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = pos.yaw;
        camera.rotation.x = pos.pitch;

        // ADS FOV Zoom
        const targetFov = isAds ? (currentWeapon === 'operator' ? 24 : 45) : 65;
        camera.fov += (targetFov - camera.fov) * 0.2;
        camera.updateProjectionMatrix();
      }

      // Rotate glowing Spike core
      if (spike) {
        spike.rotation.y += 0.025;
      }

      // Animate Target Bots & Respawn
      botsRef.current.forEach((bot) => {
        if (bot.isDead) {
          if (now > bot.respawnTime) {
            bot.isDead = false;
            bot.hp = 100;
            bot.group.visible = true;
            bot.group.position.set((Math.random() - 0.5) * 28, bot.y, -10 - Math.random() * 20);
          }
        } else {
          // Gentle patrol strafe
          bot.group.position.x += bot.vx;
          if (bot.group.position.x > 18 || bot.group.position.x < -18) bot.vx *= -1;
        }
      });

      // Send multiplayer update
      sendUpdate({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        rotation: pos.yaw,
        speed: moveSpeed,
        score,
        kills,
        weapon: currentWeapon,
      });

      // Render Three.js
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [currentWeapon, isAds, isDefusing, onUpdateHighScore, score, kills, shoot, sendUpdate]);

  return (
    <div className="relative w-full aspect-16/10 sm:aspect-16/9 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl select-none">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-crosshair" />

      {/* Crosshair (Valorant Minimalist Dynamic) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="relative w-8 h-8 flex items-center justify-center">
          {/* Center dot */}
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          {/* Crosshair ticks */}
          {!isAds && (
            <>
              <div className="absolute top-0 w-0.5 h-2 bg-emerald-400" />
              <div className="absolute bottom-0 w-0.5 h-2 bg-emerald-400" />
              <div className="absolute left-0 h-0.5 w-2 bg-emerald-400" />
              <div className="absolute right-0 h-0.5 w-2 bg-emerald-400" />
            </>
          )}
          {/* ADS Sniper scope cross overlay */}
          {isAds && currentWeapon === 'operator' && (
            <div className="absolute w-screen h-screen border-[80px] border-slate-950/90 rounded-full flex items-center justify-center">
              <div className="w-full h-[1px] bg-red-500/80" />
              <div className="h-full w-[1px] bg-red-500/80 absolute" />
            </div>
          )}
        </div>
      </div>

      {/* Top HUD: Spike Timer & Round Header */}
      <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-rose-500/30 shadow-lg">
          <Bomb className="w-4 h-4 text-rose-500 animate-pulse" />
          <span className="text-xs font-mono font-bold text-rose-400 uppercase">SPİKE SÜRESİ</span>
          <span className={`text-base font-black font-mono ${spikeTimeLeft < 10 ? 'text-red-500 animate-bounce' : 'text-white'}`}>
            00:{spikeTimeLeft < 10 ? `0${spikeTimeLeft}` : spikeTimeLeft}
          </span>
        </div>

        {/* Score & Kills */}
        <div className="flex items-center gap-3 bg-slate-950/85 backdrop-blur-md px-4 py-1.5 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <Award className="w-4 h-4" />
            <span>{score.toLocaleString()} SKOR</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
            <Target className="w-4 h-4" />
            <span>{kills} LEŞ ({headshots} HS)</span>
          </div>
        </div>
      </div>

      {/* Hit Notice / Kill Banner */}
      {lastHitNotice && (
        <div className="absolute top-20 inset-x-0 flex justify-center pointer-events-none animate-bounce">
          <span
            className="px-4 py-1 rounded-full text-xs font-black tracking-wider shadow-lg backdrop-blur-md"
            style={{ backgroundColor: `${lastHitNotice.color}25`, color: lastHitNotice.color, borderColor: lastHitNotice.color }}
          >
            {lastHitNotice.text}
          </span>
        </div>
      )}

      {/* ACE / Round Banner */}
      {aceBanner && (
        <div className="absolute top-1/3 inset-x-0 flex justify-center pointer-events-none z-30">
          <div className="bg-rose-600/90 text-white font-black text-lg sm:text-2xl px-6 py-3 rounded-2xl shadow-2xl border-2 border-rose-300 animate-pulse tracking-wider">
            {aceBanner}
          </div>
        </div>
      )}

      {/* Near Spike Prompt / Defuse Button */}
      {nearSpike && (
        <div className="absolute bottom-28 inset-x-0 flex flex-col items-center pointer-events-auto gap-2">
          <div className="bg-slate-900/90 text-rose-400 text-xs font-bold px-4 py-1.5 rounded-xl border border-rose-500/40 shadow-xl flex items-center gap-2">
            <Bomb className="w-4 h-4 text-rose-500" />
            <span>[4] TUŞUNA BASILI TUT VEYA BUTONA DOKUN: SPİKE İMHA ET</span>
          </div>

          <button
            onMouseDown={() => setIsDefusing(true)}
            onMouseUp={() => setIsDefusing(false)}
            onTouchStart={() => setIsDefusing(true)}
            onTouchEnd={() => setIsDefusing(false)}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-sm rounded-xl shadow-lg border border-rose-400 active:scale-95 transition-all"
          >
            {isDefusing ? `İMHA EDİLİYOR %${Math.floor(defuseProgress)}...` : 'SPİKE İMHA ET (HOLD)'}
          </button>

          {isDefusing && (
            <div className="w-48 bg-slate-800 h-2 rounded-full overflow-hidden border border-rose-500/40">
              <div className="bg-rose-500 h-full transition-all" style={{ width: `${defuseProgress}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Bottom HUD: Ammo, Weapon Switcher, Abilities */}
      <div className="absolute bottom-3 inset-x-3 flex items-end justify-between pointer-events-none">
        {/* Left: Weapon Selection & Abilities */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Abilities: Dash (E) and Flash (Q) */}
          <button
            onClick={handleDash}
            disabled={dashCooldown > 0}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl border font-bold text-[10px] transition-all shadow-lg ${
              dashCooldown > 0
                ? 'bg-slate-900/60 border-slate-800 text-slate-500'
                : 'bg-sky-500/20 border-sky-400/50 text-sky-300 hover:bg-sky-500/30'
            }`}
          >
            <Wind className="w-4 h-4 mb-0.5" />
            <span>{dashCooldown > 0 ? `${dashCooldown}s` : 'E - DASH'}</span>
          </button>

          <button
            onClick={handleFlash}
            disabled={flashCooldown > 0}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl border font-bold text-[10px] transition-all shadow-lg ${
              flashCooldown > 0
                ? 'bg-slate-900/60 border-slate-800 text-slate-500'
                : 'bg-amber-500/20 border-amber-400/50 text-amber-300 hover:bg-amber-500/30'
            }`}
          >
            <Sun className="w-4 h-4 mb-0.5" />
            <span>{flashCooldown > 0 ? `${flashCooldown}s` : 'Q - FLAŞ'}</span>
          </button>

          {/* Weapon slots: 1 Vandal, 2 Phantom, 3 Operator */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {(['vandal', 'phantom', 'operator'] as WeaponType[]).map((w, idx) => (
              <button
                key={w}
                onClick={() => handleSelectWeapon(w)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentWeapon === w
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {idx + 1}. {w.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Ammo Counter & Reload */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleReload}
            disabled={isReloading}
            className="px-3 py-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 shadow-lg"
          >
            [R] YENİLE
          </button>

          <div className="bg-slate-950/85 backdrop-blur-md px-4 py-2 rounded-xl border border-rose-500/40 shadow-xl flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-white">
              {isReloading ? '--' : ammo.current}
            </span>
            <span className="text-xs font-mono text-slate-500">/{ammo.max}</span>
            <span className="text-[10px] font-bold text-rose-400 uppercase ml-1">
              {WEAPON_CONFIG[currentWeapon].name}
            </span>
          </div>
        </div>
      </div>

      {/* Online Players indicator */}
      <div className="absolute top-14 left-3 pointer-events-none">
        <div className="bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          <span>{players.size + 1} Ajan Çevrimiçi</span>
        </div>
      </div>

      {/* Game Menu Modal (How to play & Start) */}
      <GameMenuModal
        game={game}
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        playerName={playerName}
        onPlayerNameChange={setPlayerName}
        playerColor={playerColor}
        onPlayerColorChange={setPlayerColor}
        settings={settings}
        onSettingsChange={setSettings}
        onStartGame={() => {
          setIsMenuOpen(false);
          sound.playBonus();
        }}
      />

      {/* Invite Modal */}
      <InviteShareModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onlineCount={players.size + 1}
      />
    </div>
  );
};
