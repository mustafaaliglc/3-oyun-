import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { LeaderboardEntry } from '../server/leaderboardStore';

const LEADERBOARD_COLLECTION = 'leaderboard';

const INITIAL_ENTRIES: Omit<LeaderboardEntry, 'id'>[] = [];

// No longer auto-seeding dummy entries - only actual player submissions are stored
export async function seedInitialLeaderboardIfEmpty(): Promise<void> {
  // Real player submissions only
  return Promise.resolve();
}

// Subscribe to real-time leaderboard updates from Firestore
export function subscribeToLeaderboard(
  gameFilter: string,
  onUpdate: (entries: LeaderboardEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  const colRef = collection(db, LEADERBOARD_COLLECTION);
  const q = gameFilter && gameFilter !== 'all'
    ? query(colRef, where('gameId', '==', gameFilter))
    : colRef;

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const results: LeaderboardEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const playerName = data.playerName || 'Oyuncu';
        const pLower = playerName.toLowerCase();
        if (pLower.includes('tommy') || pLower.includes('jett')) return;
        results.push({
          id: docSnap.id,
          playerName,
          gameId: data.gameId,
          gameTitle: data.gameTitle || 'Oyun',
          score: Number(data.score) || 0,
          badge: data.badge || 'Oyuncu',
          nationOrVehicle: data.nationOrVehicle || '',
          avatarColor: data.avatarColor || '#ec4899',
          country: data.country || 'TR',
          createdAt: data.createdAt || new Date().toISOString(),
          timestamp: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
        });
      });

      // Sort client-side by score descending and take top 10
      results.sort((a, b) => b.score - a.score);
      const top10 = results.slice(0, 10);
      onUpdate(top10);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, LEADERBOARD_COLLECTION);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

// Submit a new score to Firebase Firestore
export async function submitScoreToFirestore(entry: {
  playerName: string;
  gameId: LeaderboardEntry['gameId'] | string;
  gameTitle?: string;
  score: number;
  badge?: string;
  nationOrVehicle?: string;
  avatarColor?: string;
  country?: string;
}): Promise<void> {
  const sanitizedName = entry.playerName.trim().slice(0, 30) || 'Oyuncu';
  const sLower = sanitizedName.toLowerCase();
  if (sLower.includes('tommy') || sLower.includes('jett')) {
    return;
  }
  // Standard alphanumeric ID for Firestore document
  const safeDocId = `score_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const payload = {
    playerName: sanitizedName,
    gameId: entry.gameId,
    gameTitle: (entry.gameTitle || 'Oyun').slice(0, 50),
    score: Math.max(0, Math.min(1000000, Math.floor(entry.score))),
    badge: (entry.badge || 'Şampiyon').slice(0, 50),
    nationOrVehicle: (entry.nationOrVehicle || '').slice(0, 50),
    avatarColor: (entry.avatarColor || '#ec4899').slice(0, 20),
    country: (entry.country || 'TR').slice(0, 10),
    timestamp: Date.now(),
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, LEADERBOARD_COLLECTION, safeDocId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${LEADERBOARD_COLLECTION}/${safeDocId}`);
  }
}
