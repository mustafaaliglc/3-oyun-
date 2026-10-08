import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useMultiplayer } from '../../utils/useMultiplayer';
import { sound } from '../../utils/audio';
import { GameInfo, GameSettings } from '../../types/game';
import { GameMenuModal } from '../GameMenuModal';
import { InviteShareModal } from '../InviteShareModal';
import {
  Radio,
  Users,
  Compass,
  Play,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Share2,
  Sliders,
  Flame,
  Car,
  User,
  Zap,
  Volume2,
} from 'lucide-react';

interface ViceCityGameProps {
  game: GameInfo;
  highScore: number;
  onUpdateHighScore: (score: number) => void;
}

const RADIO_STATIONS = ['Wave 103 (Synthwave)', 'Flash FM (Pop 80s)', 'V-Rock (Rock)', 'Radyo Kapalı'];

interface CityCar {
  id: string;
  name: string;
  color: string;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  rotation: number;
  speed: number;
  maxSpeed: number;
  turnSpeed: number;
  isPolice?: boolean;
}

interface CashPickup {
  mesh: THREE.Group;
  x: number;
  z: number;
  collected: boolean;
}

export const ViceCityGame3D: React.FC<ViceCityGameProps> = ({
  game,
  highScore,
  onUpdateHighScore,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const miniMapRef = useRef<HTMLCanvasElement | null>(null);

  const [playerName, setPlayerName] = useState<string>('Tommy_Vercetti');
  const [isDriving, setIsDriving] = useState<boolean>(false);
  const [activeCarName, setActiveCarName] = useState<string | null>(null);
  const [speedMph, setSpeedMph] = useState<number>(0);
  const [wantedLevel, setWantedLevel] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [cashCollected, setCashCollected] = useState<number>(0);
  const [radioName, setRadioName] = useState<string>(RADIO_STATIONS[0]);
  const [showRadioNotification, setShowRadioNotification] = useState<boolean>(false);
  const [nearbyCarPrompt, setNearbyCarPrompt] = useState<{ id: string; name: string } | null>(null);
  const [stuntNotice, setStuntNotice] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<string>('#ec4899');

  // Modals
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(true);
  const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);

  // Settings
  const [settings, setSettings] = useState<GameSettings>({
    graphicsQuality: 'high',
    soundVolume: 80,
    cameraFov: 60,
    steeringSensitivity: 2,
  });

  // Online Multiplayer Hook
  const { connected, playerId, players, sendUpdate, sendChat, chatMessages } = useMultiplayer({
    room: 'vice_city',
    playerName,
    playerColor: '#ec4899',
    vehicle: isDriving ? activeCarName || 'cheetah' : 'on_foot',
  });

  // Player On-Foot Physics State
  const tommyStateRef = useRef({
    x: 0,
    y: 0,
    z: 20,
    rotation: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    isJumping: false,
    stride: 0,
  });

  // Current Driven Car Physics State
  const drivenCarRef = useRef<CityCar | null>(null);
  const carPhysicsRef = useRef({
    speed: 0,
    accel: 0.045,
    decel: 0.016,
    brake: 0.06,
    turnSpeed: 0.045,
    drift: false,
  });

  // City cars storage
  const cityCarsRef = useRef<CityCar[]>([]);
  const pickupsRef = useRef<CashPickup[]>([]);
  const policeCarsRef = useRef<{ mesh: THREE.Group; x: number; z: number; vx: number; vz: number; rot: number }[]>([]);

  // Input keys
  const keysRef = useRef<{ w: boolean; s: boolean; a: boolean; d: boolean; space: boolean; shift: boolean }>({
    w: false,
    s: false,
    a: false,
    d: false,
    space: false,
    shift: false,
  });

  // Three.js instance refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const tommyMeshRef = useRef<THREE.Group | null>(null);
  const tommyLimbsRef = useRef<{ legL: THREE.Mesh; legR: THREE.Mesh; armL: THREE.Mesh; armR: THREE.Mesh } | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Honk Horn
  const handleHonk = useCallback(() => {
    sound.playTone(360, 'square', 0.18, 0.15);
    setTimeout(() => sound.playTone(450, 'square', 0.22, 0.15), 50);
  }, []);

  // Radio switch
  const nextRadio = useCallback(() => {
    const idx = RADIO_STATIONS.indexOf(radioName);
    const nextIdx = (idx + 1) % RADIO_STATIONS.length;
    setRadioName(RADIO_STATIONS[nextIdx]);
    setShowRadioNotification(true);
    setTimeout(() => setShowRadioNotification(false), 2200);
    if (nextIdx !== 3) sound.playBonus();
  }, [radioName]);

  // Create Tommy Vercetti 3D Stylized Humanoid Model
  const createTommyMesh = () => {
    const tommy = new THREE.Group();

    // Head
    const headMat = new THREE.MeshStandardMaterial({ color: '#fcd34d', roughness: 0.8 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), headMat);
    head.position.y = 2.05;
    tommy.add(head);

    // 80s Dark Hair
    const hairMat = new THREE.MeshStandardMaterial({ color: '#1c1917', roughness: 0.9 });
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.24, 0.6), hairMat);
    hair.position.set(0, 2.26, -0.02);
    tommy.add(hair);

    // Aviator Sunglasses
    const glassesMat = new THREE.MeshStandardMaterial({ color: '#09090b', metalness: 0.9, roughness: 0.1 });
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.15), glassesMat);
    glasses.position.set(0, 2.06, 0.25);
    tommy.add(glasses);

    // Torso: Hawaiian Turquoise Floral Shirt
    const shirtMat = new THREE.MeshStandardMaterial({ color: '#06b6d4', roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.85, 0.45), shirtMat);
    torso.position.y = 1.35;
    tommy.add(torso);

    // White Undershirt V-Neck
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.8 });
    const vneck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.35, 0.08), whiteMat);
    vneck.position.set(0, 1.5, 0.22);
    tommy.add(vneck);

    // Left & Right Arms (Hawaiian rolled sleeves & skin)
    const armMat = new THREE.MeshStandardMaterial({ color: '#fcd34d', roughness: 0.8 });
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), armMat);
    armL.position.set(-0.48, 1.3, 0);
    tommy.add(armL);

    const armR = armL.clone();
    armR.position.x = 0.48;
    tommy.add(armR);

    // Blue Jeans & Legs
    const jeansMat = new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.85 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, 0.28), jeansMat);
    legL.position.set(-0.2, 0.45, 0);
    tommy.add(legL);

    const legR = legL.clone();
    legR.position.x = 0.2;
    tommy.add(legR);

    // White Retro Sneakers
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.4), whiteMat);
    shoeL.position.set(-0.2, 0.08, 0.06);
    tommy.add(shoeL);

    const shoeR = shoeL.clone();
    shoeR.position.x = 0.2;
    tommy.add(shoeR);

    tommyLimbsRef.current = { legL, legR, armL, armR };
    return tommy;
  };

  // High-fidelity Sports Car Builder
  const createDetailedCarMesh = (colorHex: string, isPolice = false, isTaxi = false) => {
    const carGroup = new THREE.Group();

    // Body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      metalness: 0.85,
      roughness: 0.18,
    });
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 4.4), bodyMat);
    bodyMesh.position.y = 0.5;
    carGroup.add(bodyMesh);

    // Slanted Hood
    const noseMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 1.3), bodyMat);
    noseMesh.position.set(0, 0.45, 1.85);
    carGroup.add(noseMesh);

    // Cabin
    const cabinMat = new THREE.MeshStandardMaterial({
      color: isPolice ? '#0f172a' : '#1e1b4b',
      roughness: 0.1,
      metalness: 0.8,
    });
    const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 2.2), cabinMat);
    cabinMesh.position.set(0, 0.95, -0.2);
    carGroup.add(cabinMesh);

    // Windshield
    const windshield = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.6),
      new THREE.MeshPhysicalMaterial({ color: '#38bdf8', transmission: 0.6, transparent: true, opacity: 0.9 })
    );
    windshield.position.set(0, 0.95, 0.92);
    windshield.rotation.x = -0.45;
    carGroup.add(windshield);

    // Rear Spoiler
    const spoilerMat = new THREE.MeshStandardMaterial({ color: '#090d16', metalness: 0.5 });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.45), spoilerMat);
    wing.position.set(0, 1.1, -1.95);
    carGroup.add(wing);

    // Wheels
    const tireMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.9, roughness: 0.1 });
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.36, 12);
    rimGeo.rotateZ(Math.PI / 2);

    [[-1.1, 0.42, 1.35], [1.1, 0.42, 1.35], [-1.1, 0.42, -1.35], [1.1, 0.42, -1.35]].forEach(([x, y, z]) => {
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.position.set(x, y, z);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      tire.add(rim);
      carGroup.add(tire);
    });

    // Xenon Glowing Headlights
    const hlMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), hlMat);
    hlL.position.set(-0.8, 0.52, 2.22);
    carGroup.add(hlL);
    const hlR = hlL.clone();
    hlR.position.x = 0.8;
    carGroup.add(hlR);

    // Taillights
    const tlMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });
    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.1), tlMat);
    tlL.position.set(-0.75, 0.55, -2.22);
    carGroup.add(tlL);
    const tlR = tlL.clone();
    tlR.position.x = 0.75;
    carGroup.add(tlR);

    // Taxi Roof Sign
    if (isTaxi) {
      const taxiSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.25, 0.4),
        new THREE.MeshBasicMaterial({ color: '#facc15' })
      );
      taxiSign.position.set(0, 1.35, -0.2);
      carGroup.add(taxiSign);
    }

    // Police Flashing Lightbar
    if (isPolice) {
      const redLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.18, 0.2),
        new THREE.MeshBasicMaterial({ color: '#ef4444' })
      );
      redLight.position.set(-0.4, 1.32, -0.2);
      carGroup.add(redLight);

      const blueLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.18, 0.2),
        new THREE.MeshBasicMaterial({ color: '#3b82f6' })
      );
      blueLight.position.set(0.4, 1.32, -0.2);
      carGroup.add(blueLight);
    }

    return carGroup;
  };

  // Palm Tree
  const createPalmTree = (x: number, z: number) => {
    const palm = new THREE.Group();
    palm.position.set(x, 0, z);

    const trunkMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.45, 8, 8), trunkMat);
    trunk.position.y = 4;
    palm.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.5 });
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4.2, 5), leafMat);
      leaf.position.set(0, 7.8, 0);
      leaf.rotation.x = 1.15;
      leaf.rotation.y = (i * Math.PI) / 3.5;
      palm.add(leaf);
    }
    return palm;
  };

  // Skyscraper with Neon Trim
  const createBuilding = (x: number, z: number, w: number, h: number, d: number, neonColor: string, label?: string) => {
    const bldg = new THREE.Group();
    bldg.position.set(x, 0, z);

    const bldgMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.7 });
    const bldgMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldgMat);
    bldgMesh.position.y = h / 2;
    bldg.add(bldgMesh);

    // Glowing Neon Trim
    const neonTrim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.9, d + 0.6),
      new THREE.MeshBasicMaterial({ color: neonColor })
    );
    neonTrim.position.y = h;
    bldg.add(neonTrim);

    return bldg;
  };

  // Cash Pickup Briefcase
  const createCashPickup = (x: number, z: number): CashPickup => {
    const group = new THREE.Group();
    group.position.set(x, 1.2, z);

    const caseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.6, 0.3),
      new THREE.MeshStandardMaterial({ color: '#10b981', metalness: 0.3, roughness: 0.2, emissive: '#059669', emissiveIntensity: 0.4 })
    );
    group.add(caseMesh);

    return { mesh: group, x, z, collected: false };
  };

  // Toggle Enter / Exit Vehicle (The famous GTA "F" Key!)
  const handleToggleVehicle = useCallback(() => {
    if (isDriving) {
      // EXIT CURRENT VEHICLE
      const car = drivenCarRef.current;
      if (!car) return;

      sound.playTone(340, 'triangle', 0.12, 0.2);
      setIsDriving(false);
      setActiveCarName(null);

      // Place Tommy standing on the driver's side (offset by 2.2 units left)
      const exitAngle = car.rotation;
      const tommy = tommyStateRef.current;
      tommy.x = car.x - Math.cos(exitAngle) * 2.2;
      tommy.z = car.z + Math.sin(exitAngle) * 2.2;
      tommy.y = 0;
      tommy.rotation = car.rotation;

      if (tommyMeshRef.current) {
        tommyMeshRef.current.position.set(tommy.x, 0, tommy.z);
        tommyMeshRef.current.visible = true;
      }

      drivenCarRef.current = null;
      setStuntNotice('🚶 ARABADAN İNDİNİZ (YAYA MODU)');
      setTimeout(() => setStuntNotice(null), 2000);
    } else {
      // ENTER NEARBY CAR
      const tommy = tommyStateRef.current;
      let closestCar: CityCar | null = null;
      let minDist = 5.0; // within 5m radius

      cityCarsRef.current.forEach((car) => {
        const dist = Math.hypot(car.x - tommy.x, car.z - tommy.z);
        if (dist < minDist) {
          minDist = dist;
          closestCar = car;
        }
      });

      if (closestCar) {
        sound.playBonus(); // Car ignition sound!
        drivenCarRef.current = closestCar;
        setIsDriving(true);
        setActiveCarName((closestCar as CityCar).name);

        // Hide Tommy mesh
        if (tommyMeshRef.current) {
          tommyMeshRef.current.visible = false;
        }

        setStuntNotice(`🚗 ${((closestCar as CityCar).name).toUpperCase()} ARACINA BİNDİNİZ! [F] İLE İNEBİLİRSİNİZ`);
        setTimeout(() => setStuntNotice(null), 2500);
      }
    }
  }, [isDriving]);

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysRef.current.w = true;
      if (k === 's' || e.key === 'ArrowDown') keysRef.current.s = true;
      if (k === 'a' || e.key === 'ArrowLeft') keysRef.current.a = true;
      if (k === 'd' || e.key === 'ArrowRight') keysRef.current.d = true;
      if (e.code === 'Space') keysRef.current.space = true;
      if (e.shiftKey) keysRef.current.shift = true;

      // ENTER / EXIT VEHICLE: [F] KEY
      if (k === 'f') {
        handleToggleVehicle();
      }

      // Horn: [H]
      if (k === 'h') {
        handleHonk();
      }

      // Radio: [R]
      if (k === 'r') {
        nextRadio();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysRef.current.w = false;
      if (k === 's' || e.key === 'ArrowDown') keysRef.current.s = false;
      if (k === 'a' || e.key === 'ArrowLeft') keysRef.current.a = false;
      if (k === 'd' || e.key === 'ArrowRight') keysRef.current.d = false;
      if (e.code === 'Space') keysRef.current.space = false;
      if (!e.shiftKey) keysRef.current.shift = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleToggleVehicle, handleHonk, nextRadio]);

  // Initialize Enormous Vice City 3D Map (1000m x 1000m)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#19092b'); // Iconic Vice City sunset purple
    scene.fog = new THREE.FogExp2('#19092b', 0.0055);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(settings.cameraFov, container.clientWidth / container.clientHeight, 0.1, 1200);
    cameraRef.current = camera;
    camera.position.set(0, 5, 30);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: settings.graphicsQuality !== 'low' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const amb = new THREE.AmbientLight('#c084fc', 1.4);
    scene.add(amb);

    const sun = new THREE.DirectionalLight('#fb923c', 2.2);
    sun.position.set(80, 80, -150);
    scene.add(sun);

    const cyanRim = new THREE.DirectionalLight('#06b6d4', 1.4);
    cyanRim.position.set(-80, 50, 100);
    scene.add(cyanRim);

    // Retro Neon Sun at Horizon
    const retroSun = new THREE.Mesh(
      new THREE.CircleGeometry(75, 32),
      new THREE.MeshBasicMaterial({ color: '#f43f5e' })
    );
    retroSun.position.set(0, 45, -450);
    scene.add(retroSun);

    // 5. Vast City Ground & Ocean
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 1200),
      new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.1, metalness: 0.9 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(-350, -0.2, 0);
    scene.add(ocean);

    // Beach Sand
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 1200),
      new THREE.MeshStandardMaterial({ color: '#fde047', roughness: 0.9 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(-65, 0.01, 0);
    scene.add(sand);

    // City Asphalt
    const cityGround = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1200),
      new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.9 })
    );
    cityGround.rotation.x = -Math.PI / 2;
    cityGround.position.set(450, 0, 0);
    scene.add(cityGround);

    // Main Ocean Drive Avenue (Wide 32m 4-lane Boulevard)
    const oceanDrive = new THREE.Mesh(
      new THREE.PlaneGeometry(32, 1200),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 })
    );
    oceanDrive.rotation.x = -Math.PI / 2;
    oceanDrive.position.set(0, 0.02, 0);
    scene.add(oceanDrive);

    // Center Double Yellow Lines
    const yellowMat = new THREE.MeshBasicMaterial({ color: '#facc15' });
    for (let lz = -560; lz <= 560; lz += 10) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 6), yellowMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.03, lz);
      scene.add(line);
    }

    // 5 Major Cross Boulevards
    for (let rz = -450; rz <= 450; rz += 225) {
      const crossRoad = new THREE.Mesh(
        new THREE.PlaneGeometry(800, 24),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 })
      );
      crossRoad.rotation.x = -Math.PI / 2;
      crossRoad.position.set(200, 0.02, rz);
      scene.add(crossRoad);
    }

    // Palm Trees Lined Along Ocean Drive
    for (let pz = -540; pz <= 540; pz += 30) {
      scene.add(createPalmTree(-18, pz));
      scene.add(createPalmTree(18, pz));
    }

    // Iconic Skyscrapers & Hotels
    const neonCols = ['#ec4899', '#06b6d4', '#f59e0b', '#a855f7', '#10b981'];
    for (let bz = -500; bz <= 500; bz += 60) {
      for (let bx = 40; bx <= 280; bx += 55) {
        const h = 35 + Math.random() * 85;
        const col = neonCols[Math.floor(Math.random() * neonCols.length)];
        scene.add(createBuilding(bx, bz, 36, h, 36, col));
      }
    }

    // Stunt Ramps
    const rampMat = new THREE.MeshStandardMaterial({ color: '#ec4899', roughness: 0.3 });
    [[-4, 1.4, -90, 0.3], [6, 1.4, 160, -0.3], [120, 1.4, 0, 0.35]].forEach(([rx, ry, rz, rotX]) => {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 10), rampMat);
      ramp.position.set(rx, ry, rz);
      ramp.rotation.x = rotX;
      scene.add(ramp);
    });

    // 6. Spawn Tommy Vercetti Model
    const tommy = createTommyMesh();
    tommy.position.set(0, 0, 20);
    scene.add(tommy);
    tommyMeshRef.current = tommy;

    // 7. Spawn Multiple Driveable City Cars Across the Map!
    const carsConfig = [
      { id: 'cheetah_1', name: 'Cheetah GT', color: '#ec4899', x: 8, z: 12, rot: 0, maxSpeed: 2.2 },
      { id: 'infernus_1', name: 'Infernus Sport', color: '#06b6d4', x: -8, z: -40, rot: Math.PI, maxSpeed: 2.35 },
      { id: 'stallion_1', name: 'Stallion Muscle', color: '#f97316', x: 8, z: 80, rot: 0, maxSpeed: 1.95 },
      { id: 'taxi_1', name: 'Vice Cab Taxi', color: '#eab308', x: -8, z: 140, rot: Math.PI, maxSpeed: 1.85, isTaxi: true },
      { id: 'banshee_1', name: 'Banshee V8', color: '#84cc16', x: 8, z: -160, rot: 0, maxSpeed: 2.15 },
      { id: 'police_1', name: 'Polis Kruvazörü', color: '#ffffff', x: -8, z: -250, rot: Math.PI, maxSpeed: 2.1, isPolice: true },
      { id: 'hermes_1', name: 'Hermes Klasik', color: '#a855f7', x: 75, z: 0, rot: Math.PI / 2, maxSpeed: 1.8 },
      { id: 'comet_1', name: 'Comet Turbo', color: '#f43f5e', x: 140, z: -80, rot: 0, maxSpeed: 2.25 },
    ];

    const cityCars: CityCar[] = [];
    carsConfig.forEach((cfg) => {
      const mesh = createDetailedCarMesh(cfg.color, cfg.isPolice, cfg.isTaxi);
      mesh.position.set(cfg.x, 0.4, cfg.z);
      mesh.rotation.y = cfg.rot;
      scene.add(mesh);

      cityCars.push({
        id: cfg.id,
        name: cfg.name,
        color: cfg.color,
        mesh,
        x: cfg.x,
        y: 0.4,
        z: cfg.z,
        rotation: cfg.rot,
        speed: 0,
        maxSpeed: cfg.maxSpeed,
        turnSpeed: 0.042,
        isPolice: cfg.isPolice,
      });
    });
    cityCarsRef.current = cityCars;

    // 8. Cash Pickups Scattered in the City
    const pickups: CashPickup[] = [];
    [
      [0, -70],
      [0, 180],
      [-10, 30],
      [10, -120],
      [60, -45],
      [100, 30],
    ].forEach(([cx, cz]) => {
      const p = createCashPickup(cx, cz);
      scene.add(p.mesh);
      pickups.push(p);
    });
    pickupsRef.current = pickups;

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
  }, [settings]);

  // Main Vice City 3D Game Loop (Character Walking vs Car Driving)
  useEffect(() => {
    let lastNetworkSend = 0;

    const animate = () => {
      const now = performance.now();
      const keys = keysRef.current;
      const camera = cameraRef.current;
      const scene = sceneRef.current;
      const renderer = rendererRef.current;
      const tommy = tommyStateRef.current;
      const tommyMesh = tommyMeshRef.current;
      const limbs = tommyLimbsRef.current;
      const drivenCar = drivenCarRef.current;

      // Rotate Cash Pickups & Check Collision
      pickupsRef.current.forEach((pickup) => {
        if (!pickup.collected) {
          pickup.mesh.rotation.y += 0.035;
          const targetX = isDriving && drivenCar ? drivenCar.x : tommy.x;
          const targetZ = isDriving && drivenCar ? drivenCar.z : tommy.z;
          if (Math.hypot(pickup.x - targetX, pickup.z - targetZ) < 3.2) {
            pickup.collected = true;
            pickup.mesh.visible = false;
            sound.playBonus();
            setCashCollected((c) => c + 500);
            setScore((s) => {
              const newScore = s + 500;
              onUpdateHighScore(newScore);
              return newScore;
            });
            setStuntNotice('💵 $500 NAKİT PARA TOPLANDI!');
            setTimeout(() => setStuntNotice(null), 1800);
          }
        }
      });

      if (!isDriving) {
        // ==========================================
        // 1. ON-FOOT MODE (TOMMY VERCETTI)
        // ==========================================
        const walkSpeed = keys.shift ? 0.38 : 0.22;
        let moving = false;
        let moveX = 0;
        let moveZ = 0;

        if (keys.w) {
          moveZ -= 1;
          moving = true;
        }
        if (keys.s) {
          moveZ += 1;
          moving = true;
        }
        if (keys.a) {
          moveX -= 1;
          moving = true;
        }
        if (keys.d) {
          moveX += 1;
          moving = true;
        }

        if (moving) {
          const targetRot = Math.atan2(moveX, moveZ);
          tommy.rotation += (targetRot - tommy.rotation) * 0.2;

          tommy.x += Math.sin(tommy.rotation) * walkSpeed;
          tommy.z += Math.cos(tommy.rotation) * walkSpeed;

          // Stride Limb Animation
          tommy.stride += walkSpeed * 4;
          if (limbs) {
            limbs.legL.rotation.x = Math.sin(tommy.stride) * 0.7;
            limbs.legR.rotation.x = -Math.sin(tommy.stride) * 0.7;
            limbs.armL.rotation.x = -Math.sin(tommy.stride) * 0.7;
            limbs.armR.rotation.x = Math.sin(tommy.stride) * 0.7;
          }
        } else if (limbs) {
          // Idle pose
          limbs.legL.rotation.x *= 0.8;
          limbs.legR.rotation.x *= 0.8;
          limbs.armL.rotation.x *= 0.8;
          limbs.armR.rotation.x *= 0.8;
        }

        // Jump
        if (keys.space && !tommy.isJumping) {
          tommy.isJumping = true;
          tommy.vy = 0.32;
          sound.playTone(420, 'triangle', 0.08, 0.15);
        }

        if (tommy.isJumping) {
          tommy.y += tommy.vy;
          tommy.vy -= 0.018; // gravity
          if (tommy.y <= 0) {
            tommy.y = 0;
            tommy.isJumping = false;
            tommy.vy = 0;
          }
        }

        // Update Tommy 3D Mesh
        if (tommyMesh) {
          tommyMesh.position.set(tommy.x, tommy.y, tommy.z);
          tommyMesh.rotation.y = tommy.rotation;
        }

        // Check if near ANY driveable car
        let foundNearby: { id: string; name: string } | null = null;
        cityCarsRef.current.forEach((car) => {
          const dist = Math.hypot(car.x - tommy.x, car.z - tommy.z);
          if (dist < 4.8) {
            foundNearby = { id: car.id, name: car.name };
          }
        });
        setNearbyCarPrompt(foundNearby);
        setSpeedMph(Math.round(moving ? (keys.shift ? 16 : 8) : 0));

        // 3rd Person Follow Camera behind Tommy
        if (camera) {
          const camDist = 7.5;
          const camHeight = 3.6;
          const targetCamX = tommy.x - Math.sin(tommy.rotation) * camDist;
          const targetCamZ = tommy.z - Math.cos(tommy.rotation) * camDist;
          camera.position.x += (targetCamX - camera.position.x) * 0.1;
          camera.position.y += (tommy.y + camHeight - camera.position.y) * 0.1;
          camera.position.z += (targetCamZ - camera.position.z) * 0.1;
          camera.lookAt(tommy.x, tommy.y + 1.6, tommy.z);
        }
      } else if (drivenCar) {
        // ==========================================
        // 2. DRIVING MODE (DRIVING THE SELECTED CAR)
        // ==========================================
        setNearbyCarPrompt(null);
        const phys = carPhysicsRef.current;

        // Acceleration & Braking
        if (keys.w) {
          drivenCar.speed = Math.min(drivenCar.speed + phys.accel, drivenCar.maxSpeed);
        } else if (keys.s) {
          drivenCar.speed = Math.max(drivenCar.speed - phys.brake, -0.6);
        } else {
          // Deceleration
          if (drivenCar.speed > 0) drivenCar.speed = Math.max(0, drivenCar.speed - phys.decel);
          if (drivenCar.speed < 0) drivenCar.speed = Math.min(0, drivenCar.speed + phys.decel);
        }

        // Steering
        const turnFactor = drivenCar.turnSpeed * (keys.space ? 1.6 : 1.0);
        if (Math.abs(drivenCar.speed) > 0.05) {
          const dir = drivenCar.speed > 0 ? 1 : -1;
          if (keys.a) drivenCar.rotation += turnFactor * dir;
          if (keys.d) drivenCar.rotation -= turnFactor * dir;
        }

        // Apply car velocity
        drivenCar.x += Math.sin(drivenCar.rotation) * drivenCar.speed;
        drivenCar.z += Math.cos(drivenCar.rotation) * drivenCar.speed;

        // Update Car Mesh
        drivenCar.mesh.position.set(drivenCar.x, drivenCar.y, drivenCar.z);
        drivenCar.mesh.rotation.y = drivenCar.rotation;

        // Speed in MPH
        const mph = Math.round(Math.abs(drivenCar.speed) * 65);
        setSpeedMph(mph);

        // Drift bonus
        if (keys.space && mph > 40) {
          setScore((s) => {
            const next = s + 5;
            onUpdateHighScore(next);
            return next;
          });
        }

        // Smooth Chase Camera behind Driven Car
        if (camera) {
          const camDist = 12.5;
          const camHeight = 4.8;
          const targetCamX = drivenCar.x - Math.sin(drivenCar.rotation) * camDist;
          const targetCamZ = drivenCar.z - Math.cos(drivenCar.rotation) * camDist;
          camera.position.x += (targetCamX - camera.position.x) * 0.14;
          camera.position.y += (camHeight - camera.position.y) * 0.14;
          camera.position.z += (targetCamZ - camera.position.z) * 0.14;
          camera.lookAt(drivenCar.x, drivenCar.y + 1.2, drivenCar.z);
        }
      }

      // Render 2D Mini-Map Radar
      const miniMap = miniMapRef.current;
      if (miniMap) {
        const ctx = miniMap.getContext('2d');
        if (ctx) {
          const w = miniMap.width;
          const h = miniMap.height;
          const cx = w / 2;
          const cy = h / 2;
          const scale = 0.22;

          ctx.clearRect(0, 0, w, h);

          // Radar circle background
          ctx.fillStyle = '#090d16cc';
          ctx.beginPath();
          ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 2;
          ctx.stroke();

          const playerX = isDriving && drivenCar ? drivenCar.x : tommy.x;
          const playerZ = isDriving && drivenCar ? drivenCar.z : tommy.z;

          // Draw Cars on Radar
          cityCarsRef.current.forEach((car) => {
            const relX = cx + (car.x - playerX) * scale;
            const relY = cy + (car.z - playerZ) * scale;
            if (relX > 4 && relX < w - 4 && relY > 4 && relY < h - 4) {
              ctx.fillStyle = car.color;
              ctx.beginPath();
              ctx.arc(relX, relY, 3.5, 0, Math.PI * 2);
              ctx.fill();
            }
          });

          // Draw Cash Pickups on Radar
          pickupsRef.current.forEach((p) => {
            if (!p.collected) {
              const relX = cx + (p.x - playerX) * scale;
              const relY = cy + (p.z - playerZ) * scale;
              ctx.fillStyle = '#10b981';
              ctx.beginPath();
              ctx.arc(relX, relY, 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
          });

          // Draw Player Icon (Center)
          ctx.fillStyle = isDriving ? '#ec4899' : '#38bdf8';
          ctx.beginPath();
          ctx.arc(cx, cy, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        }
      }

      // Sync with Multiplayer Server
      if (now - lastNetworkSend > 80) {
        lastNetworkSend = now;
        const curX = isDriving && drivenCar ? drivenCar.x : tommy.x;
        const curY = isDriving && drivenCar ? drivenCar.y : tommy.y;
        const curZ = isDriving && drivenCar ? drivenCar.z : tommy.z;
        const curRot = isDriving && drivenCar ? drivenCar.rotation : tommy.rotation;

        sendUpdate({
          x: curX,
          y: curY,
          z: curZ,
          rotation: curRot,
          speed: speedMph,
          score,
          vehicle: isDriving ? activeCarName || 'cheetah' : 'on_foot',
        });
      }

      // Render Three.js Scene
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [isDriving, speedMph, score, onUpdateHighScore, sendUpdate, activeCarName]);

  return (
    <div className="relative w-full aspect-16/10 sm:aspect-16/9 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl select-none">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top HUD: Speedometer, Wanted Level, Score, Radio */}
      <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
        {/* Left: Speedometer & Mode */}
        <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-pink-500/30 shadow-lg">
          {isDriving ? (
            <Car className="w-5 h-5 text-pink-400 animate-pulse" />
          ) : (
            <User className="w-5 h-5 text-sky-400" />
          )}
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-white">{speedMph}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">MPH</span>
            </div>
            <div className="text-[10px] font-bold text-pink-400 uppercase tracking-wider">
              {isDriving ? activeCarName : 'TOMMY (YAYA)'}
            </div>
          </div>
        </div>

        {/* Center: Radio & Wanted Stars */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-amber-500/30">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`text-sm ${star <= wantedLevel ? 'text-amber-400 animate-pulse' : 'text-slate-700'}`}
              >
                ★
              </span>
            ))}
          </div>

          {/* Radio button */}
          <button
            onClick={nextRadio}
            className="pointer-events-auto flex items-center gap-1.5 bg-slate-950/85 hover:bg-slate-900 border border-slate-700 px-3 py-1 rounded-xl text-xs font-bold text-slate-300 shadow-lg transition-all"
          >
            <Radio className="w-3.5 h-3.5 text-pink-400" />
            <span>[R] {radioName}</span>
          </button>
        </div>

        {/* Right: Score & Cash */}
        <div className="flex items-center gap-3 bg-slate-950/85 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800 shadow-lg">
          <div className="text-right">
            <div className="text-xs font-mono font-bold text-emerald-400">
              ${cashCollected.toLocaleString()} NAKİT
            </div>
            <div className="text-sm font-black font-mono text-amber-400">
              {score.toLocaleString()} PUAN
            </div>
          </div>
        </div>
      </div>

      {/* Center Prompt: [F] ARACA BİN / İN (The requested feature!) */}
      {nearbyCarPrompt && !isDriving && (
        <div className="absolute top-1/2 inset-x-0 flex flex-col items-center pointer-events-auto gap-2 -translate-y-1/2 animate-bounce z-20">
          <button
            onClick={handleToggleVehicle}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white font-black text-sm sm:text-base rounded-2xl shadow-[0_0_25px_rgba(236,72,153,0.7)] border-2 border-white/60 flex items-center gap-2.5 active:scale-95 transition-all"
          >
            <Car className="w-5 h-5 text-white animate-spin" />
            <span>[F] TUŞUNA BAS: {nearbyCarPrompt.name.toUpperCase()} ARACINA BİN</span>
          </button>
        </div>
      )}

      {/* In-Car Exit Button Prompt */}
      {isDriving && (
        <div className="absolute top-20 right-4 pointer-events-auto z-20">
          <button
            onClick={handleToggleVehicle}
            className="px-4 py-2 bg-slate-900/90 hover:bg-rose-600 text-white text-xs font-black rounded-xl border border-rose-500 shadow-xl flex items-center gap-2 active:scale-95 transition-all"
          >
            <User className="w-4 h-4 text-sky-400" />
            <span>[F] ARABADAN İN</span>
          </button>
        </div>
      )}

      {/* Stunt Banner Notice */}
      {stuntNotice && (
        <div className="absolute top-24 inset-x-0 flex justify-center pointer-events-none z-20 animate-pulse">
          <span className="px-5 py-1.5 rounded-full text-xs font-black bg-pink-500/90 text-white shadow-xl border border-pink-300">
            {stuntNotice}
          </span>
        </div>
      )}

      {/* Bottom-Left: Circular Radar Mini-Map */}
      <div className="absolute bottom-3 left-3 pointer-events-none flex items-center gap-2">
        <canvas
          ref={miniMapRef}
          width={110}
          height={110}
          className="rounded-full shadow-2xl border-2 border-pink-500/60"
        />
        <div className="hidden sm:flex flex-col text-[10px] font-bold text-slate-400 bg-slate-950/80 px-2 py-1.5 rounded-lg border border-slate-800">
          <span className="text-pink-400">● Arabalar</span>
          <span className="text-emerald-400">● Nakit Para</span>
          <span className="text-sky-400">● Tommy</span>
        </div>
      </div>

      {/* Bottom Controls Help */}
      <div className="absolute bottom-3 right-3 pointer-events-auto flex items-center gap-2">
        {/* Mobile / Quick Action: F Tuşu Butonu */}
        <button
          onClick={handleToggleVehicle}
          className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-black text-xs rounded-xl shadow-lg border border-pink-400 active:scale-95 transition-all flex items-center gap-1.5"
        >
          <Car className="w-4 h-4" />
          <span>{isDriving ? 'İN (F)' : 'BİN (F)'}</span>
        </button>

        {isDriving && (
          <button
            onClick={handleHonk}
            className="p-2.5 bg-slate-900/80 hover:bg-slate-800 text-amber-400 rounded-xl border border-slate-700 shadow-lg text-xs font-bold"
            title="Korna (H)"
          >
            [H] KORNA
          </button>
        )}
      </div>

      {/* Online Players indicator */}
      <div className="absolute top-14 left-3 pointer-events-none">
        <div className="bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          <span>{players.size + 1} Oyuncu Şehirde</span>
        </div>
      </div>

      {/* Game Menu Modal */}
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
