import React from 'react';
import { GameId, GameInfo, ScoreState } from '../types/game';
import {
  Car,
  Crosshair,
  Flag,
  Crown,
  Box,
  Trophy,
  X,
  Radio,
  Wifi,
  Users,
} from 'lucide-react';

interface SidebarProps {
  games: GameInfo[];
  activeGameId: GameId;
  onSelectGame: (id: GameId) => void;
  scores: ScoreState;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenLeaderboard: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  games,
  activeGameId,
  onSelectGame,
  scores,
  isOpenMobile,
  onCloseMobile,
  onOpenLeaderboard,
}) => {
  const getIcon = (name: string, color: string) => {
    const props = { className: 'w-5 h-5', style: { color } };
    if (name === 'Car') return <Car {...props} />;
    if (name === 'Crosshair') return <Crosshair {...props} />;
    if (name === 'Box') return <Box {...props} />;
    if (name === 'Crown') return <Crown {...props} />;
    if (name === 'Flag') return <Flag {...props} />;
    return <Car {...props} />;
  };

  const totalHighScore =
    (scores.vice_city || 0) + (scores.valorant || 0) + (scores.minecraft || 0);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 lg:static lg:z-auto w-72 sm:w-80 bg-slate-950 border-r border-slate-800/80 flex flex-col transition-transform duration-200 ease-in-out shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-emerald-400 uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>Canlı Online Sunucu</span>
            </div>
            <h2 className="font-display text-base font-bold text-white tracking-tight">
              3D Oyun Odaları (3)
            </h2>
          </div>
          <button
            onClick={onCloseMobile}
            aria-label="Kapat"
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Games List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          <div className="px-2 pt-1 pb-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Seçilebilir 3D Oyunlar</span>
            <span className="flex items-center gap-1 text-slate-400 font-mono text-[10px]">
              <Wifi className="w-3 h-3 text-emerald-400" /> WebSocket Aktif
            </span>
          </div>

          {games.map((game, index) => {
            const isActive = game.id === activeGameId;
            const currentScore = scores[game.id] || 0;

            return (
              <button
                key={game.id}
                onClick={() => {
                  onSelectGame(game.id);
                  onCloseMobile();
                }}
                className={`w-full text-left rounded-xl p-3.5 transition-all relative group border ${
                  isActive
                    ? 'bg-slate-900 border-slate-700 shadow-xl'
                    : 'bg-slate-950/60 hover:bg-slate-900/60 border-slate-800/60 hover:border-slate-700/60'
                }`}
                style={
                  isActive
                    ? {
                        boxShadow: `0 4px 24px -2px ${game.glowColor}`,
                        borderColor: game.accentColor,
                      }
                    : undefined
                }
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <div
                    className="absolute left-0 top-3 bottom-3 w-1 rounded-r"
                    style={{ backgroundColor: game.accentColor }}
                  />
                )}

                <div className="flex items-start gap-3">
                  {/* Game Icon Box */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: `${game.accentColor}15`,
                      borderColor: `${game.accentColor}40`,
                    }}
                  >
                    {getIcon(game.iconName, game.accentColor)}
                  </div>

                  {/* Title & Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-display font-bold text-sm text-white truncate">
                        {game.shortTitle}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        0{index + 1}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2.5">
                      {game.shortDescription}
                    </div>

                    {/* Metadata line (Clean unboxed metadata) */}
                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/60">
                      <span className="text-slate-500 font-medium truncate max-w-[130px]">
                        {game.badge}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Trophy className="w-3 h-3 text-amber-400" />
                        <span className="font-arcade text-[10px] text-amber-400 tabular-nums">
                          {currentScore}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer Stats */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/70">
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Toplam Rekor Puanı</span>
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="font-arcade text-lg text-amber-400 tabular-nums">
              {totalHighScore}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              3D Vice City, Age of History 2 ve Karting online rekorları.
            </div>
            <button
              onClick={() => {
                onOpenLeaderboard();
                onCloseMobile();
              }}
              className="w-full mt-3 py-2 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Liderlik Tablosu (TOP 10)</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
