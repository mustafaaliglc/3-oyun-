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
import { MinecraftGame3D } from './components/games/MinecraftGame3D';
import { FlappyBird } from './components/games/FlappyBird';
import { PongGame } from './components/games/PongGame';
import { GlobalLeaderboardModal } from './components/GlobalLeaderboardModal';
import { submitScoreToFirestore } from './services/firebaseLeaderboard';
import { sound } from './utils/audio';

const STORAGE_KEY = 'retro_arcade_3d_scores_v5';

export default function App() {
  const [activeGameId, setActiveGameId] = useState<GameId>('minecraft');
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
    return { minecraft: 0, flappybird: 0, pong: 0, vice_city: 0, valorant: 0 };
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
        // Submit directly to Firebase Firestore database
        submitScoreToFirestore({
          playerName: 'Oyuncu',
          gameId,
          gameTitle: activeGame.title,
          score: newScore,
          badge: 'Canlı Rekortmen',
          avatarColor: activeGame.accentColor,
          country: 'TR',
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
    (scores.minecraft || 0) + (scores.flappybird || 0) + (scores.pong || 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <GlobalLeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentPlayerName="Siz (Şampiyon)"
        currentScores={scores}
        activeGameId={activeGameId}
      />

      <Header
        activeGameTitle={activeGame.title}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        totalScore={totalScore}
      />

      <div className="flex-1 flex overflow-hidden">
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

        <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-5 flex flex-col justify-center pt-24 sm:pt-28">
          <div className="max-w-4xl mx-auto w-full flex flex-col items-center">
            <div className="text-center mb-6">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-6 sm:mt-8">
                {activeGame.title}
              </h1>
            </div>

            <div className="w-full flex justify-center mt-6">
              {activeGameId === 'minecraft' && (
                <MinecraftGame3D
                  game={activeGame}
                  highScore={scores.minecraft || 0}
                  onUpdateHighScore={(val) => handleUpdateHighScore('minecraft', val)}
                />
              )}
              {activeGameId === 'flappybird' && (
                <FlappyBird
                  highScore={scores.flappybird || 0}
                  onUpdateHighScore={(val) => handleUpdateHighScore('flappybird', val)}
                />
              )}
              {activeGameId === 'pong' && (
                <PongGame
                  highScore={scores.pong || 0}
                  onUpdateHighScore={(val) => handleUpdateHighScore('pong', val)}
                />
              )}
            </div>

            <GameDetails
              game={activeGame}
              highScore={scores[activeGameId] || 0}
              onResetScore={() => handleResetGameScore(activeGameId)}
            />

            <footer className="w-full max-w-4xl text-center py-8 mt-6 border-t border-slate-900 text-xs text-slate-500">
              <p>Minecraft 3D, Flappy Bird & Pong Online Oyun Arenası</p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
