export type GameId = 'minecraft' | 'flappybird' | 'pong';

export interface GameInfo {
  id: GameId;
  title: string;
  shortTitle: string;
  category: string;
  badge: string;
  accentColor: string;
  glowColor: string;
  coverImage: string;
  shortDescription: string;
  fullDescription: string;
  onlineFeature: string;
  ageRating: string;
  ageDetails: string;
  contentTags: string[];
  controls: {
    key: string;
    action: string;
  }[];
  touchControls: string;
  rules: string[];
  tips: string[];
  iconName: string;
}

export interface ScoreState {
  minecraft: number;
  flappybird: number;
  pong: number;
  vice_city?: number;
  valorant?: number;
  [key: string]: number | undefined;
}

export interface RemotePlayer {
  id: string;
  name: string;
  color: string;
  vehicle: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  speed: number;
  health: number;
  maxHealth?: number;
  score: number;
  kills?: number;
  wantedLevel: number;
  lastSeen: number;
  isDead?: boolean;
  nation?: string;
  provincesCount?: number;
  isDriving?: boolean;
  carModel?: string;
  selectedBlock?: number;
  weapon?: string;
  agent?: string;
}

export interface ChatMessage {
  id: string;
  name: string;
  color: string;
  text: string;
  timestamp: number;
}

export interface GameSettings {
  graphicsQuality: 'high' | 'medium' | 'low';
  soundVolume: number;
  cameraFov: number;
  steeringSensitivity: number;
}
