import fs from 'fs';
import path from 'path';

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  gameId: 'vice_city' | 'valorant' | 'minecraft' | 'age_of_history' | 'kart_racing';
  gameTitle: string;
  score: number;
  badge: string;
  nationOrVehicle: string;
  avatarColor: string;
  country: string;
  timestamp: number;
  createdAt?: string;
}

const DB_FILE = path.resolve('data/leaderboard.json');

const INITIAL_ENTRIES: LeaderboardEntry[] = [];

class LeaderboardDatabase {
  private entries: LeaderboardEntry[] = [];

  constructor() {
    this.initDatabase();
  }

  private initDatabase() {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.entries = JSON.parse(raw);
      } else {
        this.entries = [...INITIAL_ENTRIES];
        this.saveToFile();
      }
    } catch {
      this.entries = [...INITIAL_ENTRIES];
    }
  }

  private saveToFile() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.entries, null, 2), 'utf-8');
    } catch {
      // Memory fallback if read-only
    }
  }

  public getTop10(gameFilter?: string): LeaderboardEntry[] {
    let filtered = this.entries.filter(
      (e) => {
        const name = e.playerName.toLowerCase();
        return !name.includes('tommy') && !name.includes('jett');
      }
    );
    if (gameFilter && gameFilter !== 'all') {
      filtered = filtered.filter((e) => e.gameId === gameFilter);
    }
    return filtered
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  public addScore(entry: Omit<LeaderboardEntry, 'id' | 'timestamp'>): LeaderboardEntry {
    const pName = entry.playerName.toLowerCase();
    if (pName.includes('tommy') || pName.includes('jett')) {
      throw new Error('Player not allowed');
    }
    // If player already exists for this game, update their score if higher
    const existingIndex = this.entries.findIndex(
      (e) => e.playerName.toLowerCase() === entry.playerName.toLowerCase() && e.gameId === entry.gameId
    );

    let savedEntry: LeaderboardEntry;

    if (existingIndex >= 0) {
      if (entry.score > this.entries[existingIndex].score) {
        this.entries[existingIndex].score = entry.score;
        this.entries[existingIndex].timestamp = Date.now();
        if (entry.badge) this.entries[existingIndex].badge = entry.badge;
      }
      savedEntry = this.entries[existingIndex];
    } else {
      savedEntry = {
        ...entry,
        id: 'lb_' + Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
      };
      this.entries.push(savedEntry);
    }

    this.saveToFile();
    return savedEntry;
  }
}

export const leaderboardDb = new LeaderboardDatabase();
