import type { Difficulty } from "@/data/wordBank";

export type LeaderboardRecord = {
  id: string;
  user_id: string | null;
  player_name: string;
  shoutout: string;
  score: number;
  accuracy: number;
  max_combo: number;
  miss_count: number;
  difficulty: Difficulty;
  created_at: string;
};

export type LeaderboardInsert = Omit<LeaderboardRecord, "id" | "created_at">;

export const LEADERBOARD_DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

export function isLeaderboardDifficulty(value: string): value is Difficulty {
  return LEADERBOARD_DIFFICULTIES.includes(value as Difficulty);
}

export function sanitizePlayerName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function sanitizeShoutout(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidLeaderboardScore(entry: LeaderboardInsert) {
  return (
    Boolean(entry.user_id) &&
    sanitizePlayerName(entry.player_name).length > 0 &&
    Array.from(sanitizePlayerName(entry.player_name)).length <= 20 &&
    Array.from(sanitizeShoutout(entry.shoutout)).length <= 80 &&
    Number.isInteger(entry.score) &&
    entry.score >= 0 &&
    Number.isFinite(entry.accuracy) &&
    entry.accuracy >= 0 &&
    entry.accuracy <= 100 &&
    Number.isInteger(entry.max_combo) &&
    entry.max_combo >= 0 &&
    Number.isInteger(entry.miss_count) &&
    entry.miss_count >= 0 &&
    isLeaderboardDifficulty(entry.difficulty)
  );
}
