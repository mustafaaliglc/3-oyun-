import React from 'react';
import { GameId, GameInfo, ScoreState } from '../types/game';
import {
  Box,
  Gamepad2,
  Feather,
  Trophy,
  X,
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
  isOpenMobile,
  onCloseMobile,
  onOpenLeaderboard,
}) => {
  const getIcon = (name: string, color: string) => {
    const props = { className: 'w-5 h-5', style: { color } };
    if (name === 'Box') return <Box {...props} />;
    if (name === 'Bird') return <Feather {...props} />;
    return <Gamepad2 {...props} />;
  };

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
          <h2 className="font-display text-base font-bold text-white tracking-tight">
            Oyunlar
          </h2>
          <button
            onClick={onCloseMobile}
            aria-label="Kapat"
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Games List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {games.map((game) => {
            const isActive = game.id === activeGameId;

            return (
              <button
                key={game.id}
                onClick={() => {
                  onSelectGame(game.id);
                  onCloseMobile();
                }}
                className={`w-full text-left rounded-xl p-3 transition-all relative group border flex items-center gap-3 ${
                  isActive
                    ? 'bg-slate-900 border-slate-700 shadow-xl'
                    : 'bg-slate-950/60 hover:bg-slate-900/60 border-slate-800/60 hover:border-slate-700/60'
                }`}
                style={
                  isActive
                    ? {
                        boxShadow: `0 4px 20px -2px ${game.glowColor}`,
                        borderColor: game.accentColor,
                      }
                    : undefined
                }
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <div
                    className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r"
                    style={{ backgroundColor: game.accentColor }}
                  />
                )}

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

                {/* Game Title */}
                <div className="flex-1 min-w-0">
                  <span className="font-display font-semibold text-sm text-white truncate block">
                    {game.shortTitle}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/70">
          <button
            onClick={() => {
              onOpenLeaderboard();
              onCloseMobile();
            }}
            className="w-full py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Liderlik Tablosu</span>
          </button>
        </div>
      </aside>
    </>
  );
};
