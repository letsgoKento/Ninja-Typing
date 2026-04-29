import { type Difficulty, DIFFICULTIES } from "@/data/wordBank";

export type GameStatus = "idle" | "playing" | "finished" | "leaderboard" | "auth" | "help" | "settings" | "score" | "controls";

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

export type RankDefinition = {
  id: string;
  title: string;
  subtitle: string;
  minScore: number;
  maxScore: number | null;
};

export const RANKS: RankDefinition[] = [
  { id: "apprentice", title: "見習い", subtitle: "忍びの入口", minScore: 0, maxScore: 999 },
  { id: "genin", title: "下忍", subtitle: "基礎を刻む者", minScore: 1000, maxScore: 2499 },
  { id: "chunin", title: "中忍", subtitle: "任務を任される腕", minScore: 2500, maxScore: 4999 },
  { id: "jonin", title: "上忍", subtitle: "戦場を読む者", minScore: 5000, maxScore: 7999 },
  { id: "kagehashiri", title: "影走", subtitle: "影より速き足", minScore: 8000, maxScore: 11999 },
  { id: "getsuei", title: "月影", subtitle: "月下に消える刃", minScore: 12000, maxScore: 16999 },
  { id: "shippu", title: "疾風迅雷", subtitle: "迷いなき連撃", minScore: 17000, maxScore: 23999 },
  { id: "hyakusen", title: "百戦錬磨", subtitle: "崩れぬ集中", minScore: 24000, maxScore: 32999 },
  { id: "musou", title: "影刃無双", subtitle: "敵影を断つ者", minScore: 33000, maxScore: 44999 },
  { id: "shinsoku", title: "神速無双", subtitle: "人域を越えた忍", minScore: 45000, maxScore: null }
];

export function calculateWordScore(word: string, difficulty: Difficulty, combo: number) {
  const cleanLength = word.replace(/\s/g, "").length;
  const base = 85 + cleanLength * 16;
  const comboMultiplier = 1 + Math.min(combo * 0.1, 4);
  return Math.round(base * comboMultiplier * DIFFICULTIES[difficulty].multiplier);
}

export function calculateAccuracy(correctKeys: number, totalKeys: number) {
  if (totalKeys === 0) {
    return 100;
  }

  return Math.round((correctKeys / totalKeys) * 100);
}

export function calculateCpm(totalKeys: number, durationSeconds: number) {
  if (totalKeys <= 0 || durationSeconds <= 0) {
    return 0;
  }

  return Math.round(totalKeys / (durationSeconds / 60));
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

export function getRank(score: number) {
  return [...RANKS].reverse().find((rank) => score >= rank.minScore) ?? RANKS[0];
}

export function getBestScoreKey(difficulty: Difficulty) {
  return `ninja-typing-best-score-${difficulty}`;
}

export function getUnlockedRanksKey() {
  return "ninja-typing-unlocked-ranks";
}
