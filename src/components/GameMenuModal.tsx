import React, { useState } from 'react';
import { GameInfo, GameSettings } from '../types/game';
import {
  Play,
  HelpCircle,
  Settings,
  ShieldAlert,
  Keyboard,
  Smartphone,
  Sparkles,
  Volume2,
  Sliders,
  Check,
  X,
  Palette,
  User,
} from 'lucide-react';

interface GameMenuModalProps {
  game: GameInfo;
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  playerColor: string;
  onPlayerColorChange: (color: string) => void;
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
  onStartGame: () => void;
}

export const GameMenuModal: React.FC<GameMenuModalProps> = ({
  game,
  isOpen,
  onClose,
  playerName,
  onPlayerNameChange,
  playerColor,
  onPlayerColorChange,
  settings,
  onSettingsChange,
  onStartGame,
}) => {
  const [activeTab, setActiveTab] = useState<'start' | 'how_to_play' | 'settings'>('start');

  if (!isOpen) return null;

  const colorOptions = [
    { name: 'Vice Pembe', hex: '#ec4899' },
    { name: 'Siber Cyan', hex: '#06b6d4' },
    { name: 'Neon Sarı', hex: '#f59e0b' },
    { name: 'Ateş Kırmızı', hex: '#ef4444' },
    { name: 'Gece Moru', hex: '#a855f7' },
    { name: 'Zümrüt Yeşil', hex: '#10b981' },
  ];

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cover Art Banner */}
        {game.coverImage && (
          <div className="relative w-full h-32 sm:h-40 bg-slate-950 overflow-hidden shrink-0">
            <img
              src={game.coverImage}
              alt={game.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center brightness-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
            <button
              onClick={onClose}
              aria-label="Kapat"
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-950/70 text-slate-300 hover:text-white hover:bg-slate-900 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-950"
                    style={{ backgroundColor: game.accentColor }}
                  >
                    {game.badge}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-slate-950/80 px-2 py-0.5 rounded border border-amber-500/40">
                    <ShieldAlert className="w-3 h-3" />
                    {game.ageRating}
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold text-white tracking-tight drop-shadow-md">
                  {game.title}
                </h2>
              </div>
            </div>
          </div>
        )}

        {/* 3 Nav Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/50 px-4">
          <button
            onClick={() => setActiveTab('start')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'start'
                ? 'border-pink-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            BAŞLA & KATIL
          </button>
          <button
            onClick={() => setActiveTab('how_to_play')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'how_to_play'
                ? 'border-pink-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            NASIL OYNANIR
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-pink-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            AYARLAR
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: BAŞLA */}
          {activeTab === 'start' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                {game.shortDescription}
              </p>

              {/* Player Name Input */}
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-pink-400" />
                  Oyuncu Adınız (Haritada Görünen İsim):
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => onPlayerNameChange(e.target.value.slice(0, 16))}
                  placeholder="İsminizi yazın..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 font-semibold"
                />
              </div>

              {/* Vehicle / Skin Color Picker */}
              <div>
                <label className="text-xs text-slate-400 font-medium mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-cyan-400" />
                  Araç Rengi:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {colorOptions.map((opt) => (
                    <button
                      key={opt.hex}
                      onClick={() => onPlayerColorChange(opt.hex)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                        playerColor === opt.hex
                          ? 'bg-slate-800 border-white shadow-md scale-105'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full shadow-inner"
                        style={{ backgroundColor: opt.hex }}
                      />
                      <span className="text-[10px] text-slate-300 font-medium truncate">
                        {opt.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Age & Safety Notice */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Yaş Aralığı: {game.ageRating}</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {game.ageDetails}
                </p>
              </div>

              {/* Launch Button */}
              <button
                onClick={() => {
                  onStartGame();
                  onClose();
                }}
                className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 active:scale-98 text-white font-black text-sm rounded-xl shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 transition-all mt-4"
              >
                <Play className="w-4 h-4 fill-current" />
                DÜNYAYA KATIL & OYNA
              </button>
            </div>
          )}

          {/* TAB 2: NASIL OYNANIR */}
          {activeTab === 'how_to_play' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-white mb-2.5">
                  <Keyboard className="w-4 h-4 text-pink-400" />
                  Klavye Kontrolleri
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {game.controls.map((ctrl, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-slate-800/60"
                    >
                      <span className="font-mono bg-slate-800 text-slate-200 px-2 py-0.5 rounded font-bold">
                        {ctrl.key}
                      </span>
                      <span className="text-slate-400 text-right">{ctrl.action}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-white mb-2">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  Dokunmatik & Mobil Kontroller
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {game.touchControls}
                </p>
              </div>

              <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-white mb-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Önemli Kurallar & İpuçları
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {game.rules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-pink-400 font-bold">✓</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: AYARLAR */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* Graphics Quality */}
              <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800">
                <label className="text-xs text-slate-400 font-bold mb-2 block">
                  Grafik Kalitesi:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['high', 'medium', 'low'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => onSettingsChange({ ...settings, graphicsQuality: q })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        settings.graphicsQuality === q
                          ? 'bg-pink-600 text-white shadow-md'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {q === 'high' ? 'Yüksek (PBR)' : q === 'medium' ? 'Dengeli' : 'Performans'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Volume */}
              <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-pink-400" />
                    Ses Düzeyi:
                  </span>
                  <span className="text-white font-mono">{settings.soundVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.soundVolume}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, soundVolume: Number(e.target.value) })
                  }
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>

              {/* Steering Sensitivity */}
              <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    Direksiyon Hassasiyeti:
                  </span>
                  <span className="text-white font-mono">
                    {settings.steeringSensitivity === 1
                      ? 'Düşük'
                      : settings.steeringSensitivity === 2
                      ? 'Normal'
                      : 'Hızlı'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((val) => (
                    <button
                      key={val}
                      onClick={() =>
                        onSettingsChange({ ...settings, steeringSensitivity: val })
                      }
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        settings.steeringSensitivity === val
                          ? 'bg-cyan-600 text-white shadow-md'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {val === 1 ? 'Düşük' : val === 2 ? 'Normal' : 'Yüksek'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors mt-2"
              >
                Ayarları Kaydet ve Kapat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
