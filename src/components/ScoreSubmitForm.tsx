"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Difficulty } from "@/data/wordBank";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  isValidLeaderboardScore,
  sanitizePlayerName,
  type LeaderboardInsert,
  type LeaderboardRecord
} from "@/types/leaderboard";

type SubmitState = "idle" | "submitting" | "success" | "error";

type ScoreSubmitFormProps = {
  score: number;
  accuracy: number;
  maxCombo: number;
  missCount: number;
  difficulty: Difficulty;
  onSubmitted: (record: LeaderboardRecord) => void;
};

const PLAYER_NAME_STORAGE_KEY = "ninja-typing-player-name";

function normalizeScorePayload(payload: LeaderboardInsert): LeaderboardInsert {
  return {
    player_name: sanitizePlayerName(payload.player_name),
    score: Math.max(0, Math.floor(payload.score)),
    accuracy: Math.min(100, Math.max(0, Number(payload.accuracy.toFixed(2)))),
    max_combo: Math.max(0, Math.floor(payload.max_combo)),
    miss_count: Math.max(0, Math.floor(payload.miss_count)),
    difficulty: payload.difficulty
  };
}

export function ScoreSubmitForm({
  score,
  accuracy,
  maxCombo,
  missCount,
  difficulty,
  onSubmitted
}: ScoreSubmitFormProps) {
  const [playerName, setPlayerName] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedName = window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY);

    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  const remainingChars = useMemo(() => 20 - Array.from(playerName).length, [playerName]);
  const isSubmitting = submitState === "submitting";
  const isSubmitted = submitState === "success";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || isSubmitted) {
      return;
    }

    const cleanName = sanitizePlayerName(playerName);

    if (!cleanName) {
      setSubmitState("error");
      setMessage("\u30d7\u30ec\u30a4\u30e4\u30fc\u540d\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      return;
    }

    if (Array.from(cleanName).length > 20) {
      setSubmitState("error");
      setMessage("\u30d7\u30ec\u30a4\u30e4\u30fc\u540d\u306f20\u6587\u5b57\u4ee5\u5185\u306b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      return;
    }

    if (score < 0 || accuracy < 0 || accuracy > 100 || maxCombo < 0 || missCount < 0) {
      setSubmitState("error");
      setMessage("\u9001\u4fe1\u3067\u304d\u306a\u3044\u30b9\u30b3\u30a2\u3067\u3059\u3002\u7d50\u679c\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      return;
    }

    const payload = normalizeScorePayload({
      player_name: cleanName,
      score,
      accuracy,
      max_combo: maxCombo,
      miss_count: missCount,
      difficulty
    });

    if (!isValidLeaderboardScore(payload)) {
      setSubmitState("error");
      setMessage("\u9001\u4fe1\u3067\u304d\u306a\u3044\u30b9\u30b3\u30a2\u3067\u3059\u3002\u7d50\u679c\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setSubmitState("error");
      setMessage("Supabase\u306e\u74b0\u5883\u5909\u6570\u304c\u672a\u8a2d\u5b9a\u3067\u3059\u3002.env.local\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      return;
    }

    setSubmitState("submitting");
    setMessage("");

    const { data, error } = await supabase
      .from("leaderboard")
      .insert({
        ...payload,
        created_at: new Date().toISOString()
      })
      .select("id, player_name, score, accuracy, max_combo, miss_count, difficulty, created_at")
      .single();

    if (error || !data) {
      setSubmitState("error");
      setMessage(error?.message ?? "\u30e9\u30f3\u30ad\u30f3\u30b0\u767b\u9332\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002");
      return;
    }

    const record = data as LeaderboardRecord;
    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, cleanName);
    setSubmitState("success");
    setMessage("\u767b\u9332\u5b8c\u4e86\uff01");
    onSubmitted(record);
  }

  return (
    <form className="score-submit-panel" onSubmit={handleSubmit}>
      <div>
        <p className="panel-kicker">Leaderboard Entry</p>
        <h3 className="panel-title">\u30e9\u30f3\u30ad\u30f3\u30b0\u767b\u9332</h3>
      </div>

      <label className="name-field">
        <span>\u30d7\u30ec\u30a4\u30e4\u30fc\u540d</span>
        <input
          type="text"
          value={playerName}
          maxLength={20}
          disabled={isSubmitting || isSubmitted}
          placeholder="SHINOBI"
          onChange={(event) => {
            setPlayerName(event.target.value);

            if (submitState === "error") {
              setSubmitState("idle");
              setMessage("");
            }
          }}
        />
      </label>

      <div className="submit-meta">
        <span>{Math.max(0, remainingChars)} / 20</span>
        <span>{score.toLocaleString()} pts</span>
      </div>

      <button className="submit-score-button" type="submit" disabled={isSubmitting || isSubmitted}>
        {isSubmitting ? "Sending..." : isSubmitted ? "Registered" : "Register Score"}
      </button>

      {message ? <p className={`submit-message ${submitState === "success" ? "submit-success" : "submit-error"}`}>{message}</p> : null}
    </form>
  );
}
