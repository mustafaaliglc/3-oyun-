import React, { useState, useEffect, useRef } from 'react';
import { useMultiplayer } from '../../utils/useMultiplayer';
import { sound } from '../../utils/audio';
import { GameInfo, GameSettings } from '../../types/game';
import { InviteShareModal } from '../InviteShareModal';
import {
  Crown,
  Swords,
  Coins,
  Users,
  Shield,
  Play,
  HelpCircle,
  Settings,
  ShieldAlert,
  Share2,
  Sliders,
  ChevronRight,
  Flame,
  Award,
  Scroll,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface AgeOfHistoryProps {
  game: GameInfo;
  highScore: number;
  onUpdateHighScore: (score: number) => void;
}

interface Province {
  id: string;
  name: string;
  ownerId: string; // 'ottoman' | 'rome' | 'france' | 'britain' | 'russia' | 'neutral'
  army: number;
  population: number;
  income: number;
  x: number; // Percentage on map canvas
  y: number;
  neighbors: string[];
}

interface Civilization {
  id: string;
  name: string;
  leader: string;
  color: string;
  accent: string;
  flag: string;
  trait: string;
}

const CIVILIZATIONS: Civilization[] = [
  {
    id: 'ottoman',
    name: 'Osmanlı İmparatorluğu',
    leader: 'Fatih Sultan Mehmed',
    color: '#dc2626', // Red
    accent: '#ef4444',
    flag: '🇹🇷',
    trait: '+%25 Saldırı Gücü & Kuşatma Bonusu',
  },
  {
    id: 'rome',
    name: 'Roma İmparatorluğu',
    leader: 'Julius Caesar',
    color: '#9333ea', // Purple
    accent: '#a855f7',
    flag: '🦅',
    trait: '+%20 Savunma & Lejyon Disiplini',
  },
  {
    id: 'france',
    name: 'Fransa Krallığı',
    leader: 'Napoleon Bonaparte',
    color: '#2563eb', // Blue
    accent: '#3b82f6',
    flag: '⚜️',
    trait: '+%20 Ordu Hareket Hızı',
  },
  {
    id: 'britain',
    name: 'Büyük Britanya',
    leader: 'Kraliçe Victoria',
    color: '#0284c7', // Sky / Navy
    accent: '#0ea5e9',
    flag: '🇬🇧',
    trait: '+%30 Ticaret Geliri & Donanma',
  },
  {
    id: 'russia',
    name: 'Rus Çarlığı',
    leader: 'I. Petro (Büyük Petro)',
    color: '#16a34a', // Green
    accent: '#22c55e',
    flag: '🇷🇺',
    trait: '+%35 İnsan Gücü Rezervi',
  },
];

const INITIAL_PROVINCES: Province[] = [
  // Osmanlı Toprakları
  { id: 'istanbul', name: 'Kostantiniyye', ownerId: 'ottoman', army: 5000, population: 45000, income: 120, x: 74, y: 55, neighbors: ['edirne', 'bursa', 'ankara', 'athens'] },
  { id: 'ankara', name: 'Ankara', ownerId: 'ottoman', army: 3000, population: 28000, income: 80, x: 82, y: 58, neighbors: ['istanbul', 'bursa', 'trabzon', 'damascus'] },
  { id: 'bursa', name: 'Bursa & İzmir', ownerId: 'ottoman', army: 2500, population: 32000, income: 90, x: 73, y: 64, neighbors: ['istanbul', 'ankara', 'athens'] },
  { id: 'trabzon', name: 'Trabzon', ownerId: 'ottoman', army: 2000, population: 20000, income: 65, x: 88, y: 50, neighbors: ['ankara', 'caucasus'] },

  // Balkanlar & Bizans/Yunanistan
  { id: 'athens', name: 'Atina & Mora', ownerId: 'neutral', army: 2000, population: 22000, income: 70, x: 67, y: 66, neighbors: ['istanbul', 'bursa', 'edirne'] },
  { id: 'edirne', name: 'Edirne & Selanik', ownerId: 'ottoman', army: 2800, population: 25000, income: 75, x: 68, y: 54, neighbors: ['istanbul', 'athens', 'sofia'] },
  { id: 'sofia', name: 'Sofya & Belgrad', ownerId: 'neutral', army: 2200, population: 24000, income: 70, x: 63, y: 48, neighbors: ['edirne', 'vienna', 'budapest'] },

  // İtalya & Roma
  { id: 'rome', name: 'Roma', ownerId: 'rome', army: 4500, population: 42000, income: 110, x: 50, y: 58, neighbors: ['venice', 'naples', 'milan'] },
  { id: 'naples', name: 'Napoli & Sicilya', ownerId: 'rome', army: 2400, population: 30000, income: 85, x: 52, y: 68, neighbors: ['rome'] },
  { id: 'venice', name: 'Venedik', ownerId: 'rome', army: 3000, population: 28000, income: 95, x: 48, y: 49, neighbors: ['rome', 'vienna', 'milan'] },
  { id: 'milan', name: 'Milano', ownerId: 'rome', army: 2600, population: 29000, income: 85, x: 44, y: 47, neighbors: ['rome', 'venice', 'paris', 'lyon'] },

  // Fransa
  { id: 'paris', name: 'Paris', ownerId: 'france', army: 4600, population: 44000, income: 115, x: 33, y: 40, neighbors: ['lyon', 'bordeaux', 'london', 'brussels'] },
  { id: 'lyon', name: 'Lyon & Marsilya', ownerId: 'france', army: 2800, population: 31000, income: 90, x: 36, y: 49, neighbors: ['paris', 'milan', 'barcelona'] },
  { id: 'bordeaux', name: 'Bordeaux', ownerId: 'france', army: 2200, population: 25000, income: 75, x: 28, y: 52, neighbors: ['paris', 'madrid'] },

  // İngiltere
  { id: 'london', name: 'Londra', ownerId: 'britain', army: 4800, population: 46000, income: 125, x: 28, y: 32, neighbors: ['scotland', 'paris', 'brussels'] },
  { id: 'scotland', name: 'İskoçya & İrlanda', ownerId: 'britain', army: 2600, population: 23000, income: 75, x: 25, y: 22, neighbors: ['london'] },

  // Almanya & Orta Avrupa
  { id: 'berlin', name: 'Berlin & Prusya', ownerId: 'neutral', army: 3500, population: 36000, income: 100, x: 48, y: 34, neighbors: ['vienna', 'warsaw', 'brussels'] },
  { id: 'vienna', name: 'Viyana', ownerId: 'neutral', army: 3200, population: 33000, income: 95, x: 53, y: 43, neighbors: ['berlin', 'venice', 'sofia', 'budapest'] },
  { id: 'budapest', name: 'Budapeşte', ownerId: 'neutral', army: 2400, population: 25000, income: 80, x: 58, y: 45, neighbors: ['vienna', 'sofia'] },
  { id: 'brussels', name: 'Felemenk', ownerId: 'neutral', army: 2000, population: 24000, income: 85, x: 38, y: 36, neighbors: ['paris', 'london', 'berlin'] },

  // Rusya & Doğu
  { id: 'moscow', name: 'Moskova', ownerId: 'russia', army: 5200, population: 48000, income: 110, x: 78, y: 25, neighbors: ['kiev', 'novgorod', 'warsaw'] },
  { id: 'kiev', name: 'Kiev & Kırım', ownerId: 'russia', army: 3200, population: 32000, income: 85, x: 72, y: 38, neighbors: ['moscow', 'warsaw', 'trabzon'] },
  { id: 'warsaw', name: 'Varşova', ownerId: 'neutral', army: 2500, population: 27000, income: 75, x: 62, y: 33, neighbors: ['berlin', 'moscow', 'kiev'] },

  // İspanya & Akdeniz
  { id: 'madrid', name: 'Madrid & Toledo', ownerId: 'neutral', army: 2800, population: 30000, income: 90, x: 21, y: 65, neighbors: ['bordeaux', 'barcelona', 'lisbon'] },
  { id: 'barcelona', name: 'Barselona', ownerId: 'neutral', army: 2200, population: 26000, income: 80, x: 29, y: 62, neighbors: ['madrid', 'lyon'] },

  // Orta Doğu & Mısır
  { id: 'damascus', name: 'Şam & Kudüs', ownerId: 'neutral', army: 2600, population: 28000, income: 85, x: 88, y: 72, neighbors: ['ankara', 'cairo'] },
  { id: 'cairo', name: 'Kahire & İskenderiye', ownerId: 'neutral', army: 3400, population: 38000, income: 105, x: 80, y: 84, neighbors: ['damascus'] },
];

export const AgeOfHistoryGame: React.FC<AgeOfHistoryProps> = ({
  game,
  highScore,
  onUpdateHighScore,
}) => {
  // Game State
  const [inGame, setInGame] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'play' | 'how_to' | 'settings'>('play');
  const [selectedCivId, setSelectedCivId] = useState<string>('ottoman');
  const [playerName, setPlayerName] = useState<string>('Sultan_Fatih');

  // Strategy Core Data
  const [turn, setTurn] = useState<number>(1);
  const [gold, setGold] = useState<number>(850);
  const [manpower, setManpower] = useState<number>(12000);
  const [provinces, setProvinces] = useState<Province[]>(INITIAL_PROVINCES);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>('istanbul');
  const [battleMessage, setBattleMessage] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);

  // Modals & Panels
  const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);
  const [diplomacyTarget, setDiplomacyTarget] = useState<Civilization | null>(null);

  // Settings
  const [settings, setSettings] = useState<GameSettings>({
    graphicsQuality: 'high',
    soundVolume: 80,
    cameraFov: 60,
    steeringSensitivity: 2,
  });

  // Multiplayer Hook
  const { connected, players, sendUpdate } = useMultiplayer({
    room: 'age_of_history',
    playerName,
    playerColor: '#dc2626',
    vehicle: 'flag_empire',
  });

  const selectedCiv = CIVILIZATIONS.find((c) => c.id === selectedCivId) || CIVILIZATIONS[0];
  const selectedProvince = provinces.find((p) => p.id === selectedProvinceId);

  // Owned provinces count
  const myProvinces = provinces.filter((p) => p.ownerId === selectedCivId);
  const myTotalArmy = myProvinces.reduce((sum, p) => sum + p.army, 0);

  // Start the campaign
  const handleStartCampaign = () => {
    setInGame(true);
    sound.playPowerup();
  };

  // Recruit Army in selected province
  const handleRecruit = (amount: number) => {
    if (!selectedProvince) return;
    if (selectedProvince.ownerId !== selectedCivId) {
      alert('Sadece kendi eyaletinizde asker toplayabilirsiniz!');
      return;
    }
    const cost = Math.round(amount * 0.15);
    if (gold < cost) {
      alert('Yeterli altınınız yok! Daha fazla altın toplamak için turu bitirin.');
      return;
    }
    if (manpower < amount) {
      alert('Yeterli insan gücünüz kalmadı!');
      return;
    }

    sound.playBonus();
    setGold((prev) => prev - cost);
    setManpower((prev) => prev - amount);

    setProvinces((prev) =>
      prev.map((p) => (p.id === selectedProvince.id ? { ...p, army: p.army + amount } : p))
    );
  };

  // Attack or Move troops to target province
  const handleMoveOrAttack = (target: Province) => {
    if (!selectedProvince) return;
    if (selectedProvince.id === target.id) return;

    if (!selectedProvince.neighbors.includes(target.id)) {
      alert(`${target.name} eyaleti seçili eyalete komşu değil! Yalnızca komşu sınırlara sefer düzenleyebilirsiniz.`);
      return;
    }

    if (selectedProvince.army <= 500) {
      alert('Eyaleti savunmak için en az 500 asker geride kalmalıdır!');
      return;
    }

    const attackingArmy = Math.round(selectedProvince.army * 0.7); // Send 70% of troops
    const remainingArmy = selectedProvince.army - attackingArmy;

    // Movement to friendly province
    if (target.ownerId === selectedCivId) {
      sound.playBounce(1.2);
      setProvinces((prev) =>
        prev.map((p) => {
          if (p.id === selectedProvince.id) return { ...p, army: remainingArmy };
          if (p.id === target.id) return { ...p, army: p.army + attackingArmy };
          return p;
        })
      );
      setSelectedProvinceId(target.id);
      return;
    }

    // WAR / ATTACK!
    sound.playExplosion();
    const defenderArmy = target.army;

    // Combat resolution: Attacker with Ottoman/Napoleon bonus modifiers
    let bonusMultiplier = 1.0;
    if (selectedCivId === 'ottoman') bonusMultiplier = 1.25;

    const attackerCombatPower = attackingArmy * bonusMultiplier * (0.85 + Math.random() * 0.3);
    const defenderCombatPower = defenderArmy * (0.85 + Math.random() * 0.3);

    if (attackerCombatPower > defenderCombatPower) {
      // VICTORY! Province CONQUERED!
      sound.playBonus();
      const survivingAttackers = Math.max(300, Math.round(attackingArmy - defenderArmy * 0.6));
      const gainedScore = target.income * 5;

      setProvinces((prev) =>
        prev.map((p) => {
          if (p.id === selectedProvince.id) return { ...p, army: remainingArmy };
          if (p.id === target.id) {
            return {
              ...p,
              ownerId: selectedCivId,
              army: survivingAttackers,
            };
          }
          return p;
        })
      );

      const newScore = score + gainedScore;
      setScore(newScore);
      if (newScore > highScore) onUpdateHighScore(newScore);

      setBattleMessage(`⚔️ ZAFER! ${target.name} fethedildi ve ${selectedCiv.name} topraklarına katıldı! (+${gainedScore} Puan)`);
      setSelectedProvinceId(target.id);
      setTimeout(() => setBattleMessage(null), 3500);
    } else {
      // DEFEAT / REPELLED
      sound.playGameOver();
      const survivingDefenders = Math.max(200, Math.round(defenderArmy - attackingArmy * 0.5));

      setProvinces((prev) =>
        prev.map((p) => {
          if (p.id === selectedProvince.id) return { ...p, army: remainingArmy };
          if (p.id === target.id) return { ...p, army: survivingDefenders };
          return p;
        })
      );

      setBattleMessage(`🛡️ KUŞATMA BAŞARISIZ! ${target.name} savunması ordunuzu püskürttü.`);
      setTimeout(() => setBattleMessage(null), 3000);
    }
  };

  // Turn End: Collect taxes, grow manpower, AI moves
  const handleEndTurn = () => {
    sound.playPowerup();
    const newTurn = turn + 1;
    setTurn(newTurn);

    // Calculate tax income
    const turnIncome = myProvinces.reduce((sum, p) => sum + p.income, 0);
    const armyUpkeep = Math.round(myTotalArmy * 0.02);
    const netGold = Math.max(50, turnIncome - armyUpkeep);

    setGold((prev) => prev + netGold);
    setManpower((prev) => prev + 1500);

    // AI Empire movements: Non-player empires recruit and try expansion
    setProvinces((prev) =>
      prev.map((p) => {
        if (p.ownerId !== selectedCivId && p.ownerId !== 'neutral') {
          return {
            ...p,
            army: p.army + Math.floor(200 + Math.random() * 300),
          };
        }
        return p;
      })
    );
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto select-none relative">
      {/* Real Player Share Modal */}
      <InviteShareModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onlineCount={players.size + 1}
      />

      {/* Outer Game Cabinet Screen */}
      <div className="w-full bg-slate-900/95 border border-amber-500/40 rounded-xl overflow-hidden shadow-2xl">
        {/* START SCREEN / MENU EMBEDDED DIRECTLY IN THE GAME VIEW */}
        {!inGame ? (
          <div className="relative w-full aspect-16/9 min-h-[480px] bg-[#0c0a09] flex flex-col justify-between p-6 overflow-hidden">
            {/* Background Cover Image with scrim */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity pointer-events-none scale-105"
              style={{ backgroundImage: `url(${game.coverImage})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/40 pointer-events-none" />

            {/* Top Bar of the Game Opening Screen */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider">
                  {game.badge}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {game.ageRating}
                </span>
              </div>

              {/* Share invite button */}
              <button
                onClick={() => setIsInviteOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-lg text-xs font-bold shadow-md shadow-amber-500/20 transition-all"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Arkadaşını Davet Et</span>
              </button>
            </div>

            {/* Center Opening Screen Content */}
            <div className="relative z-10 my-auto text-center max-w-xl mx-auto py-4">
              <h2 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tight mb-2 drop-shadow-md">
                Age of History 2
              </h2>
              <p className="text-amber-200/90 text-sm font-medium mb-6">
                Online Sıra Tabanlı Büyük Strateji & Dünya Fethi
              </p>

              {/* 3 Nav Tabs inside Game View (BAŞLA / NASIL OYNANIR / AYARLAR) */}
              <div className="flex items-center justify-center gap-2 p-1 bg-slate-900/90 rounded-xl border border-slate-800 mb-6 max-w-md mx-auto">
                <button
                  onClick={() => setActiveTab('play')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'play'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ▶ SEFERE BAŞLA
                </button>
                <button
                  onClick={() => setActiveTab('how_to')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'how_to'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📖 NASIL OYNANIR
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'settings'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ⚙️ AYARLAR
                </button>
              </div>

              {/* TAB 1: SEFERE BAŞLA */}
              {activeTab === 'play' && (
                <div className="space-y-4 animate-fade-in text-left bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">
                      Hükümdar Adınız:
                    </label>
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-2">
                      Medeniyetini Seç:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {CIVILIZATIONS.map((civ) => (
                        <button
                          key={civ.id}
                          onClick={() => setSelectedCivId(civ.id)}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            selectedCivId === civ.id
                              ? 'bg-amber-500/15 border-amber-400 shadow-md'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-base">{civ.flag}</span>
                            <span className="font-bold text-xs text-white truncate">
                              {civ.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-amber-300 font-medium truncate">
                            {civ.leader}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleStartCampaign}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:scale-98 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition-all mt-2"
                  >
                    <Crown className="w-4 h-4 fill-current" />
                    SEFERİ BAŞLAT & HARİTAYA GİR
                  </button>
                </div>
              )}

              {/* TAB 2: NASIL OYNANIR */}
              {activeTab === 'how_to' && (
                <div className="space-y-3 text-left bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 animate-fade-in">
                  <div className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                    <Scroll className="w-4 h-4" /> Temel Strateji Rehberi
                  </div>
                  <p>
                    <strong>1. Eyalet Seçimi:</strong> Kendi sınırınızdaki eyalete tıklayarak asker toplayabilirsiniz.
                  </p>
                  <p>
                    <strong>2. Asker Toplama:</strong> Hazine altını harcayarak ordunuzu büyütün.
                  </p>
                  <p>
                    <strong>3. Savaş & Fetih:</strong> Ordunuzu komşu eyalete yönlendirerek kuşatma başlatın. Ordunuz rakip kuvveti yendiğinde eyalet sizin renginize boyanır.
                  </p>
                  <p>
                    <strong>4. Turu Bitir:</strong> Her tur sonunda vergi gelirleri toplanır ve hazinenize aktarılır.
                  </p>
                </div>
              )}

              {/* TAB 3: AYARLAR */}
              {activeTab === 'settings' && (
                <div className="space-y-3 text-left bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 animate-fade-in">
                  <div className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                    <Sliders className="w-4 h-4" /> Oyun Ayarları
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Ses Düzeyi (%{settings.soundVolume}):</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.soundVolume}
                      onChange={(e) => setSettings({ ...settings, soundVolume: Number(e.target.value) })}
                      className="w-full accent-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Harita Detay Kalitesi:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSettings({ ...settings, graphicsQuality: 'high' })}
                        className={`p-2 rounded-lg font-bold ${
                          settings.graphicsQuality === 'high' ? 'bg-amber-500 text-slate-950' : 'bg-slate-950'
                        }`}
                      >
                        Yüksek (HD Harita)
                      </button>
                      <button
                        onClick={() => setSettings({ ...settings, graphicsQuality: 'medium' })}
                        className={`p-2 rounded-lg font-bold ${
                          settings.graphicsQuality === 'medium' ? 'bg-amber-500 text-slate-950' : 'bg-slate-950'
                        }`}
                      >
                        Dengeli
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Footer Note */}
            <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/80">
              <span>Age of History 2 · Sıra Tabanlı Strateji Motoru</span>
              <span className="text-emerald-400 font-mono">Çevrimiçi Sunucu Aktif</span>
            </div>
          </div>
        ) : (
          /* ACTIVE STRATEGY MAP VIEW */
          <div className="flex flex-col w-full">
            {/* Top Strategy HUD */}
            <div className="bg-slate-950 border-b border-amber-500/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
              {/* Leader & Empire */}
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedCiv.flag}</span>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{selectedCiv.name}</span>
                    <span className="text-[10px] text-amber-400 font-normal">({selectedCiv.leader})</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Tur: <strong className="text-amber-400 font-mono">{turn}</strong> · Eyaletler: {myProvinces.length}
                  </div>
                </div>
              </div>

              {/* Treasury & Manpower */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-xs">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-slate-400">Hazine:</span>
                  <span className="font-arcade text-amber-400 tabular-nums">{gold}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-slate-400">Nüfus:</span>
                  <span className="font-mono text-cyan-300 tabular-nums">{manpower.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Shield className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-slate-400">Toplam Ordu:</span>
                  <span className="font-mono text-white tabular-nums">{myTotalArmy.toLocaleString()}</span>
                </div>
              </div>

              {/* End Turn & Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleEndTurn}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:scale-95 text-slate-950 text-xs font-black rounded-lg shadow-md transition-all flex items-center gap-1"
                >
                  <Play className="w-3 h-3 fill-current" />
                  TURU BİTİR
                </button>
                <button
                  onClick={() => setInGame(false)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700"
                >
                  Menü
                </button>
              </div>
            </div>

            {/* Interactive Strategy Map Viewport */}
            <div className="relative w-full aspect-16/9 bg-[#0f172a] overflow-hidden border-b border-slate-800">
              {/* Battle Toast Announcement */}
              {battleMessage && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-950/95 border border-amber-500/60 text-white font-bold text-xs sm:text-sm px-5 py-2 rounded-xl shadow-2xl z-30 animate-bounce">
                  {battleMessage}
                </div>
              )}

              {/* SVG Map Connections & Provinces */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* Border connection lines */}
                {provinces.map((prov) =>
                  prov.neighbors.map((nId) => {
                    const n = provinces.find((p) => p.id === nId);
                    if (!n) return null;
                    return (
                      <line
                        key={`${prov.id}-${n.id}`}
                        x1={`${prov.x}%`}
                        y1={`${prov.y}%`}
                        x2={`${n.x}%`}
                        y2={`${n.y}%`}
                        stroke="rgba(148, 163, 184, 0.2)"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                    );
                  })
                )}
              </svg>

              {/* Interactive Province Nodes */}
              {provinces.map((prov) => {
                const isSelected = selectedProvinceId === prov.id;
                const isMine = prov.ownerId === selectedCivId;
                const ownerCiv = CIVILIZATIONS.find((c) => c.id === prov.ownerId);

                return (
                  <button
                    key={prov.id}
                    onClick={() => {
                      if (selectedProvince && selectedProvince.neighbors.includes(prov.id)) {
                        handleMoveOrAttack(prov);
                      } else {
                        setSelectedProvinceId(prov.id);
                        sound.playBounce(1.5);
                      }
                    }}
                    style={{ left: `${prov.x}%`, top: `${prov.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 p-2 rounded-xl border flex flex-col items-center shadow-lg transition-transform hover:scale-110 active:scale-95 ${
                      isSelected
                        ? 'border-white ring-2 ring-amber-400 z-20 scale-105'
                        : isMine
                        ? 'border-amber-400/60 z-10'
                        : 'border-slate-700/80 z-10'
                    }`}
                  >
                    <div
                      className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow flex items-center gap-1"
                      style={{
                        backgroundColor: ownerCiv ? ownerCiv.color : '#475569',
                      }}
                    >
                      <span>{ownerCiv ? ownerCiv.flag : '🏴'}</span>
                      <span className="truncate max-w-[80px]">{prov.name}</span>
                    </div>
                    <div className="mt-1 px-1.5 py-0.5 rounded bg-slate-950/90 text-amber-300 font-mono text-[9px] font-bold border border-slate-800">
                      ⚔️ {prov.army.toLocaleString()}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Command Bar: Selected Province & Troops Management */}
            {selectedProvince && (
              <div className="bg-slate-950 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{selectedProvince.name}</span>
                    <span className="text-slate-400 font-medium">
                      (Nüfus: {selectedProvince.population.toLocaleString()} · Vergi: +{selectedProvince.income} Altın)
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-400 font-medium">
                    Garnizon: {selectedProvince.army.toLocaleString()} Asker
                  </div>
                </div>

                {/* Troop Recruitment (if mine) */}
                {selectedProvince.ownerId === selectedCivId ? (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Askere Al:</span>
                    <button
                      onClick={() => handleRecruit(500)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-lg border border-slate-700"
                    >
                      +500 Asker (75g)
                    </button>
                    <button
                      onClick={() => handleRecruit(1500)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-lg border border-slate-700"
                    >
                      +1.500 Asker (225g)
                    </button>
                    <button
                      onClick={() => handleRecruit(5000)}
                      className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-lg"
                    >
                      +5.000 Lejyon (750g)
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                    <Swords className="w-3.5 h-3.5" />
                    Saldırmak için komşu kendi eyaletinizden bu eyalete tıklayın!
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
