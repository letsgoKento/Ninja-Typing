import type { Difficulty } from "@/data/wordBank";

const SHARE_URL = "https://twitter.com/intent/tweet";
const GAME_TITLE = "Ninja Typing";
const HASHTAGS = "#NinjaTyping #タイピングゲーム #TypingGame";

function getShareOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

function createIntentUrl(text: string, url = getShareOrigin()) {
  const query = [`text=${encodeURIComponent(text)}`];

  if (url) {
    query.push(`url=${encodeURIComponent(url)}`);
  }

  return `${SHARE_URL}?${query.join("&")}`;
}

export function createGameShareUrl() {
  const text = [
    `🥷 ${GAME_TITLE}`,
    "",
    "文字を打つたびに手裏剣が飛ぶ、爽快タイピングゲーム！",
    "あなたは何体倒せる？",
    "",
    HASHTAGS
  ].join("\n");

  return createIntentUrl(text);
}

export type ScoreShareResult = {
  score?: number;
  accuracy?: number;
  maxCombo?: number;
  difficulty?: Difficulty | string;
  rank?: string;
};

export function createScoreShareUrl(result: ScoreShareResult = {}) {
  const score = Number(result.score ?? 0).toLocaleString();
  const accuracy = Number.isFinite(result.accuracy) ? `${Number(result.accuracy).toFixed(1)}%` : "0.0%";
  const maxCombo = Number(result.maxCombo ?? 0).toLocaleString();
  const difficulty = result.difficulty ? String(result.difficulty) : "Normal";
  const rank = result.rank || "見習い";
  const text = [
    `🥷 ${GAME_TITLE} 結果`,
    "",
    `Score: ${score}`,
    `Accuracy: ${accuracy}`,
    `Max Combo: ${maxCombo}`,
    `Difficulty: ${difficulty}`,
    `Rank: ${rank}`,
    "",
    "手裏剣タイピングに挑戦！",
    "",
    HASHTAGS
  ].join("\n");

  return createIntentUrl(text);
}

export function openShareUrl(shareUrl: string) {
  if (typeof window === "undefined" || !shareUrl) {
    return;
  }

  window.open(shareUrl, "_blank", "noopener,noreferrer");
}
