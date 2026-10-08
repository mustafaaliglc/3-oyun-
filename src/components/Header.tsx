import React from 'react';
import { Volume2, VolumeX, Menu, Gamepad2, Trophy, RotateCcw, Database } from 'lucide-react';
import { GameId } from '../types/game';

interface HeaderProps {
  activeGameTitle: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenMobileSidebar: () => void;
  onOpenLeaderboard: () => void;
  totalScore: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeGameTitle,
  soundEnabled,
  onToggleSound,
  onOpenMobileSidebar,
  onOpenLeaderboard,
  totalScore,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3.5 flex items-center justify-between">
      {/* Zone 1: Wordmark Brand Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          aria-label="Oyun Menüsünü Aç"
          className="lg:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <a href="#" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-lg sm:text-xl text-white tracking-tight group-hover:text-emerald-400 transition-colors">
            Retro Oyun Merkezi
          </span>
        </a>
      </div>

      {/* Zone 2: Navigation / Active Status (Text with separators) */}
      <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
        <span>Aktif Oyun: <strong className="text-white font-medium">{activeGameTitle}</strong></span>
        <span aria-hidden="true">·</span>
        <span>3 Oyun Odası</span>
        <span aria-hidden="true">·</span>
        <span className="flex items-center gap-1 text-amber-400 font-medium">
          <Trophy className="w-3.5 h-3.5" />
          Toplam Rekor: {totalScore}
        </span>
      </div>

      {/* Zone 3: Actions (Socket.io Status, Leaderboard & Sound) */}
      <div className="flex items-center gap-2">
        {/* Socket.io Live Server Status Badge */}
        <div
          title="Socket.io Gerçek Zamanlı Sunucu Aktif (Node.js & Socket.io)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline font-mono">Socket.io v4 Aktif</span>
          <span className="sm:hidden font-mono">Socket.io</span>
        </div>

        <button
          onClick={onOpenLeaderboard}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all shadow-sm active:scale-95"
        >
          <Database className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Liderlik Tablosu (Firebase)</span>
          <span className="sm:hidden">TOP 10</span>
        </button>

        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            soundEnabled
              ? 'bg-slate-900 border-slate-700/80 text-emerald-400 hover:bg-slate-800'
              : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
        >
          {soundEnabled ? (
            <>
              <Volume2 className="w-4 h-4" />
              <span className="hidden sm:inline">Ses Açık</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4" />
              <span className="hidden sm:inline">Sessiz</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
