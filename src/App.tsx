/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GAMES } from './data/games';
import { GameId, ScoreState } from './types/game';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { GameDetails } from './components/GameDetails';
import { ViceCityGame3D } from './components/games/ViceCityGame3D';
import { ValorantGame3D } from './components/games/ValorantGame3D';
import { MinecraftGame3D } from './components/games/MinecraftGame3D';
import { GlobalLeaderboardModal } from './components/GlobalLeaderboardModal';
import { submitScoreToFirestore } from './services/firebaseLeaderboard';
import { sound } from './utils/audio';

const STORAGE_KEY = 'retro_arcade_3d_scores_v4';

export default function App() {
  const [activeGameId, setActiveGameId] = useState<GameId>('vice_city');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Persistent High Scores
  const [scores, setScores] = useState<ScoreState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return { vice_city: 0, valorant: 0, minecraft: 0 };
  });

  // Save scores to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch {
      // ignore
    }
  }, [scores]);

  const activeGame = GAMES.find((g) => g.id === activeGameId) || GAMES[0];

  const handleUpdateHighScore = (gameId: GameId, newScore: number) => {
    setScores((prev) => {
      const cur = prev[gameId] || 0;
      if (newScore > cur) {
        const playerName =
          'Oyuncu_' +
          (gameId === 'vice_city'
            ? 'Tommy'
            : gameId === 'valorant'
            ? 'Jett'
            : 'Steve');

        // Submit directly to Firebase Firestore database
        submitScoreToFirestore({
          playerName,
          gameId,
          gameTitle: activeGame.title,
          score: newScore,
          badge: 'Canlı Rekortmen',
          avatarColor: activeGame.accentColor,
          country: 'TR',
        }).catch(() => {});

        // Also silently submit to backend leaderboard store
        fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerName,
            gameId,
            gameTitle: activeGame.title,
            score: newScore,
            badge: 'Canlı Rekortmen',
            avatarColor: activeGame.accentColor,
            country: 'TR',
          }),
        }).catch(() => {});

        return { ...prev, [gameId]: newScore };
      }
      return prev;
    });
  };

  const handleResetGameScore = (gameId: GameId) => {
    setScores((prev) => ({ ...prev, [gameId]: 0 }));
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.enabled = next;
    if (next) {
      sound.playBonus();
    }
  };

  const totalScore =
    (scores.vice_city || 0) + (scores.valorant || 0) + (scores.minecraft || 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Global Leaderboard Modal (TOP 10 Database) */}
      <GlobalLeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentPlayerName="Siz (Şampiyon)"
        currentScores={scores}
        activeGameId={activeGameId}
      />

      {/* Top Header Bar */}
      <Header
        activeGameTitle={activeGame.title}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        totalScore={totalScore}
      />

      {/* Main Container: Left Sidebar + Center Game Display */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          games={GAMES}
          activeGameId={activeGameId}
          onSelectGame={(id) => {
            setActiveGameId(id);
            sound.playTone(440, 'triangle', 0.05);
          }}
          scores={scores}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        />

        {/* Center Main Stage */}
        <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-5">
          <div className="max-w-4xl mx-auto flex flex-col items-center">
            {/* Game Screen Title Kicker */}
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                <span className="text-emerald-400 font-bold">● ONLINE LOBİ</span>
                <span aria-hidden="true">·</span>
                <span style={{ color: activeGame.accentColor }}>{activeGame.category}</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {activeGame.title}
              </h1>
            </div>

            {/* Render Selected 3D Game */}
            <div className="w-full flex justify-center">
              {activeGameId === 'vice_city' && (
                <ViceCityGame3D
                  game={activeGame}
                  highScore={scores.vice_city || 0}
                  onUpdateHighScore={(val) => handleUpdateHighScore('vice_city', val)}
                />
              )}

              {activeGameId === 'valorant' && (
                <ValorantGame3D
                  game={activeGame}
                  highScore={scores.valorant || 0}
                  onUpdateHighScore={(val) => handleUpdateHighScore('valorant', val)}
                />
              )}

              {activeGameId === 'minecraft' && (
                <MinecraftGame3D
                  game={activeGame}
                  highScore={scores.minecraft || 0}
                  onUpdateHighScore={(val) => handleUpdateHighScore('minecraft', val)}
                />
              )}
            </div>

            {/* Game Explanations & Details Underneath */}
            <GameDetails
              game={activeGame}
              highScore={scores[activeGameId] || 0}
              onResetScore={() => handleResetGameScore(activeGameId)}
            />

            {/* Footer */}
            <footer className="w-full max-w-4xl text-center py-8 mt-6 border-t border-slate-900 text-xs text-slate-500">
              <p>
                Vice City 3D, Valorant 3D & Minecraft 3D Online Oyun Arenası · Gerçek zamanlı Socket.io sunucusu ve Three.js 3D grafikleriyle donatılmıştır.
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
