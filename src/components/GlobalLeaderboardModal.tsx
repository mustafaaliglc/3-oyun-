import React, { useState, useEffect } from 'react';
import { LeaderboardEntry } from '../server/leaderboardStore';
import {
  subscribeToLeaderboard,
  submitScoreToFirestore,
} from '../services/firebaseLeaderboard';
import {
  Trophy,
  Car,
  RotateCcw,
  X,
  Upload,
  Check,
  Globe,
  Database,
  Crosshair,
  Box,
  User,
  PlusCircle,
  AlertCircle,
} from 'lucide-react';

interface GlobalLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlayerName?: string;
  currentScores?: {
    vice_city: number;
    valorant?: number;
    minecraft?: number;
    [key: string]: number | undefined;
  };
  activeGameId?: 'vice_city' | 'valorant' | 'minecraft' | string;
}

export const GlobalLeaderboardModal: React.FC<GlobalLeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentPlayerName = 'Oyuncu',
  currentScores,
  activeGameId = 'vice_city',
}) => {
  const [filter, setFilter] = useState<'all' | 'vice_city' | 'valorant' | 'minecraft'>('all');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Player custom submission form state
  const [customName, setCustomName] = useState<string>(() => {
    try {
      return localStorage.getItem('player_custom_name') || currentPlayerName || 'Oyuncu_1';
    } catch {
      return currentPlayerName || 'Oyuncu_1';
    }
  });

  const [targetGameId, setTargetGameId] = useState<'vice_city' | 'valorant' | 'minecraft'>(
    (activeGameId as 'vice_city' | 'valorant' | 'minecraft') || 'vice_city'
  );

  const activeScore = currentScores ? currentScores[targetGameId] || 0 : 0;
  const [customScoreInput, setCustomScoreInput] = useState<string>('');

  useEffect(() => {
    if (activeScore > 0) {
      setCustomScoreInput(String(activeScore));
    }
  }, [activeScore, targetGameId]);

  // Subscribe to real-time updates from Firebase Firestore (and local server fallback)
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const unsubscribe = subscribeToLeaderboard(
      filter,
      (top10) => {
        setEntries(top10);
        setLoading(false);
      },
      (err) => {
        console.warn('Firestore fallback fetch:', err);
        fetch(`/api/leaderboard?game=${filter}`)
          .then((res) => res.json())
          .then((data) => {
            if (data?.top10) setEntries(data.top10);
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen, filter, refreshKey]);

  if (!isOpen) return null;

  // Submit score to database (Firestore + Local backend)
  const handleSubmitScore = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const trimmedName = customName.trim();
    if (!trimmedName) {
      setErrorMessage('Lütfen geçerli bir oyuncu adı girin.');
      return;
    }

    const scoreNum = parseInt(customScoreInput, 10);
    if (isNaN(scoreNum) || scoreNum <= 0) {
      setErrorMessage('Lütfen 0\'dan büyük bir skor puanı girin (veya oyunda puan kazanın).');
      return;
    }

    setSubmitting(true);
    try {
      try {
        localStorage.setItem('player_custom_name', trimmedName);
      } catch {
        // ignore
      }

      const gameTitles: Record<string, string> = {
        vice_city: 'Vice City 3D',
        valorant: 'Valorant 3D',
        minecraft: 'Minecraft 3D',
      };

      const badges: Record<string, string> = {
        vice_city: 'Şehir Canavarı',
        valorant: 'Radyant Ajan',
        minecraft: 'Usta Mimar',
      };

      const avatarColors: Record<string, string> = {
        vice_city: '#ec4899',
        valorant: '#f43f5e',
        minecraft: '#10b981',
      };

      const entryPayload = {
        playerName: trimmedName,
        gameId: targetGameId,
        gameTitle: gameTitles[targetGameId] || 'Oyun',
        score: scoreNum,
        badge: badges[targetGameId] || 'Canlı Rekortmen',
        avatarColor: avatarColors[targetGameId] || '#ec4899',
        country: 'TR',
      };

      // 1. Submit to Firestore
      await submitScoreToFirestore(entryPayload).catch(() => {});

      // 2. Submit to local server store
      await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryPayload),
      }).catch(() => {});

      setSubmitSuccess(true);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch {
      setErrorMessage('Skor kaydedilirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return <span className="flex items-center gap-1 font-black text-amber-300 text-sm">🥇 1.</span>;
    }
    if (index === 1) {
      return <span className="flex items-center gap-1 font-black text-slate-300 text-sm">🥈 2.</span>;
    }
    if (index === 2) {
      return <span className="flex items-center gap-1 font-black text-amber-600 text-sm">🥉 3.</span>;
    }
    return <span className="font-mono text-slate-500 font-bold text-xs">{index + 1}.</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-2xl bg-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                  <Database className="w-3 h-3 text-amber-400 animate-pulse" />
                  Top 10 Gerçek Oyuncu Listesi
                </span>
                <span className="text-[11px] text-slate-400 font-mono">CANLI SIRALAMA</span>
              </div>
              <h2 className="font-display text-lg sm:text-xl font-black text-white tracking-tight">
                Top 10 Sıralama Tablosu
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              title="Yenile"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800 my-3 overflow-x-auto">
          {[
            { id: 'all', label: 'Tüm Oyunlar', icon: Globe },
            { id: 'vice_city', label: 'Vice City 3D', icon: Car },
            { id: 'valorant', label: 'Valorant 3D', icon: Crosshair },
            { id: 'minecraft', label: 'Minecraft 3D', icon: Box },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Top 10 Table */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center gap-2">
              <RotateCcw className="w-6 h-6 animate-spin text-amber-400" />
              <span>Sıralama verileri yükleniyor...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-10 px-4 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-400 text-xs flex flex-col items-center gap-2">
              <Trophy className="w-8 h-8 text-amber-500/50 mb-1" />
              <p className="font-bold text-white text-sm">Henüz Bu Listeye Skor Eklenmedi</p>
              <p className="text-slate-400 max-w-sm text-center">
                Rastgele sahte sayılar kaldırıldı! Aşağıdaki formdan adınızı ve skorunuzu yazarak Top 10 listesine ilk sıradan adınızı ekleyin.
              </p>
            </div>
          ) : (
            entries.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all ${
                  idx === 0
                    ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                    : idx === 1
                    ? 'bg-slate-800/60 border-slate-700/60'
                    : idx === 2
                    ? 'bg-amber-950/20 border-amber-800/40'
                    : 'bg-slate-950/50 border-slate-800/60'
                }`}
              >
                {/* Left: Rank & Player info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 text-center shrink-0">
                    {getRankBadge(idx)}
                  </div>

                  {/* Avatar bubble */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 border"
                    style={{
                      backgroundColor: `${item.avatarColor}20`,
                      borderColor: `${item.avatarColor}50`,
                      color: item.avatarColor,
                    }}
                  >
                    {item.playerName.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-white text-xs sm:text-sm truncate">
                        {item.playerName}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                        {item.badge}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {item.gameTitle}
                      {item.nationOrVehicle ? ` · ${item.nationOrVehicle}` : ''}
                    </div>
                  </div>
                </div>

                {/* Right: Score */}
                <div className="text-right shrink-0 pl-2">
                  <div className="font-arcade text-amber-400 text-sm sm:text-base tabular-nums font-bold">
                    {item.score.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">PUAN</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Custom Submission Box ("Ekleyen eklesin oraya") */}
        <form onSubmit={handleSubmitScore} className="pt-3 mt-3 border-t border-slate-800 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5" /> Skorumu Top 10 Listesine Ekle:
            </span>
            {activeScore > 0 && (
              <span className="text-[11px] text-slate-400 font-mono">
                Oyun İçi Skorunuz: <strong className="text-emerald-400 font-bold">{activeScore}</strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Oyuncu Adınız:</label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value.slice(0, 18))}
                  placeholder="İsminiz..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Oyun:</label>
              <select
                value={targetGameId}
                onChange={(e) => setTargetGameId(e.target.value as typeof targetGameId)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="vice_city">Vice City 3D</option>
                <option value="valorant">Valorant 3D</option>
                <option value="minecraft">Minecraft 3D</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Skor Puanı:</label>
              <input
                type="number"
                min="1"
                max="999999"
                value={customScoreInput}
                onChange={(e) => setCustomScoreInput(e.target.value)}
                placeholder="Puan..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                required
              />
            </div>
          </div>

          {errorMessage && (
            <div className="text-[11px] text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md ${
                submitSuccess
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 active:scale-95 disabled:opacity-50'
              }`}
            >
              {submitSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Başarıyla Listeye Eklendi!
                </>
              ) : submitting ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" /> Ekleniyor...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" /> Top 10 Listesine Kaydet
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
