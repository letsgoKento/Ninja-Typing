import { type Difficulty, DIFFICULTIES } from "@/data/wordBank";

export type GameStatus = "idle" | "playing" | "finished";

export type Metrics = {
  score: number;
  combo: number;
  maxCombo: number;
  misses: number;
  correctKeys: number;
  totalKeys: number;
  clearedWords: number;
};

export const initialMetrics: Metrics = {
  score: 0,
  combo: 0,
  maxCombo: 0,
  misses: 0,
  correctKeys: 0,
  totalKeys: 0,
  clearedWords: 0
};

export function calculateWordScore(word: string, difficulty: Difficulty, combo: number) {
  const cleanLength = word.replace(/\s/g, "").length;
  const base = 85 + cleanLength * 16;
  const comboMultiplier = 1 + Math.min(Math.floor(combo / 5) * 0.18, 1.8);
  return Math.round(base * comboMultiplier * DIFFICULTIES[difficulty].multiplier);
}

export function calculateAccuracy(correctKeys: number, totalKeys: number) {
  if (totalKeys === 0) {
    return 100;
  }

  return Math.round((correctKeys / totalKeys) * 100);
}

export function getComboCallout(combo: number) {
  if (combo >= 30) {
    return "LEGEND";
  }

  if (combo >= 18) {
    return "SHINOBI";
  }

  if (combo >= 10) {
    return "COOL";
  }

  if (combo >= 5) {
    return "NICE";
  }

  return "";
}

export function getRank(score: number, accuracy: number, maxCombo: number) {
  const rankScore = score + maxCombo * 90 + accuracy * 20;

  if (rankScore >= 9800 && accuracy >= 94) {
    return "S";
  }

  if (rankScore >= 6800 && accuracy >= 88) {
    return "A";
  }

  if (rankScore >= 4200 && accuracy >= 78) {
    return "B";
  }

  return "C";
}

export function getBestScoreKey(difficulty: Difficulty) {
  return `ninja-typing-best-score-${difficulty}`;
}
