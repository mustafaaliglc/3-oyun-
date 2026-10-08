import React from 'react';
import { GameInfo } from '../types/game';
import {
  HelpCircle,
  Award,
  Sparkles,
  Smartphone,
  Keyboard,
  RotateCcw,
  Wifi,
  ShieldAlert,
  Tag,
} from 'lucide-react';

interface GameDetailsProps {
  game: GameInfo;
  highScore: number;
  onResetScore: () => void;
}

export const GameDetails: React.FC<GameDetailsProps> = ({
  game,
  highScore,
  onResetScore,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto mt-6 space-y-4">
      {/* Short Description Feature Box (Kısa Açıklama) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 relative overflow-hidden backdrop-blur-xs">
        <div
          className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ backgroundColor: game.accentColor }}
        />

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                Oyun Açıklaması
              </span>
              <span className="text-slate-600">·</span>
              <span
                className="text-xs font-semibold"
                style={{ color: game.accentColor }}
              >
                {game.category}
              </span>
              <span className="text-slate-600">·</span>
              {/* Prominent Age Rating Badge */}
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                <ShieldAlert className="w-3.5 h-3.5" />
                {game.ageRating}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <Wifi className="w-3 h-3" /> Canlı Çok Oyunculu
              </span>
            </div>

            {/* Prominent short description */}
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed font-normal mb-3">
              {game.shortDescription}
            </p>

            {/* Content Tags */}
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mr-1">
                <Tag className="w-3 h-3" /> Etiketler:
              </span>
              {game.contentTags.map((tag, i) => (
                <span
                  key={i}
                  className="text-[11px] text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Online multiplayer highlighted feature */}
            <div className="text-xs text-slate-400 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{game.onlineFeature}</span>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end shrink-0 pl-3 border-l border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Bu Oyundaki Rekor</span>
            <span
              className="font-arcade text-lg tabular-nums mt-0.5"
              style={{ color: game.accentColor }}
            >
              {highScore}
            </span>
            {highScore > 0 && (
              <button
                onClick={onResetScore}
                className="text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-1 mt-1 transition-colors"
                title="Skoru sıfırla"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Sıfırla
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Controls and Rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Controls Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
            <Keyboard className="w-4 h-4 text-slate-400" />
            <span>Kontroller & Sürüş Rehberi</span>
          </div>

          <div className="space-y-2 mb-3">
            {game.controls.map((ctrl, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-1 border-b border-slate-800/50 last:border-0"
              >
                <span className="font-mono bg-slate-800 text-slate-200 px-2 py-0.5 rounded border border-slate-700/80 font-medium">
                  {ctrl.key}
                </span>
                <span className="text-slate-400 text-right">{ctrl.action}</span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-start gap-2 text-[11px] text-slate-400">
            <Smartphone className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            <span>{game.touchControls}</span>
          </div>
        </div>

        {/* Rules & Points Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Oyun Kuralları & Mekanikleri</span>
          </div>

          <ul className="space-y-2">
            {game.rules.map((rule, idx) => (
              <li
                key={idx}
                className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed"
              >
                <span className="text-pink-500 font-bold shrink-0">·</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Pro Tips / İpuçları */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2.5">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Usta Tavsiyeleri & Taktikler</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {game.tips.map((tip, idx) => (
            <div
              key={idx}
              className="bg-slate-950/60 border border-slate-800/50 rounded-lg p-2.5 text-xs text-slate-400 leading-relaxed"
            >
              <span className="font-semibold text-slate-300 block mb-1">
                Tavsiye #{idx + 1}
              </span>
              {tip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
