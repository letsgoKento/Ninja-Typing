"use client";

import { useEffect, useState } from "react";
import { DIFFICULTIES, type Difficulty } from "@/data/wordBank";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { LEADERBOARD_DIFFICULTIES, type LeaderboardRecord } from "@/types/leaderboard";

type LeaderboardProps = {
  initialDifficulty?: Difficulty;
  highlightId?: string | null;
  refreshToken?: string | number;
};

const LEADERBOARD_TEXT = {
  empty: "\u307e\u3060\u8a18\u9332\u304c\u3042\u308a\u307e\u305b\u3093",
  missingEnv: "Supabase\u306e\u74b0\u5883\u5909\u6570\u304c\u672a\u8a2d\u5b9a\u3067\u3059\u3002"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function Leaderboard({ initialDifficulty = "normal", highlightId, refreshToken }: LeaderboardProps) {
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty>(initialDifficulty);
  const [records, setRecords] = useState<LeaderboardRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setActiveDifficulty(initialDifficulty);
  }, [initialDifficulty]);

  useEffect(() => {
    let cancelled = false;

    async function fetchLeaderboard() {
      const supabase = getSupabaseClient();

      if (!supabase) {
        setErrorMessage(LEADERBOARD_TEXT.missingEnv);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("leaderboard")
        .select("id, user_id, player_name, shoutout, score, accuracy, max_combo, miss_count, cpm, difficulty, created_at")
        .eq("difficulty", activeDifficulty)
        .not("user_id", "is", null)
        .order("score", { ascending: false })
        .order("accuracy", { ascending: false })
        .order("max_combo", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(50);

      if (cancelled) {
        return;
      }

      if (error) {
        setErrorMessage(error.message);
        setRecords([]);
      } else {
        setRecords((data ?? []) as LeaderboardRecord[]);
      }

      setIsLoading(false);
    }

    void fetchLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [activeDifficulty, refreshToken]);

  return (
    <section className="leaderboard-panel">
      <div className="leaderboard-header">
        <div>
          <p className="panel-kicker">Top 50</p>
          <h2 className="panel-title">Leaderboard</h2>
        </div>
        <div className="leaderboard-tabs" role="tablist" aria-label="Difficulty leaderboard">
          {LEADERBOARD_DIFFICULTIES.map((difficulty) => (
            <button
              key={difficulty}
              className={activeDifficulty === difficulty ? "leaderboard-tab-active" : ""}
              type="button"
              onClick={() => setActiveDifficulty(difficulty)}
            >
              {DIFFICULTIES[difficulty].label}
            </button>
          ))}
        </div>
      </div>

      {errorMessage ? <div className="leaderboard-error">{errorMessage}</div> : null}

      {isLoading ? (
        <div className="leaderboard-skeleton" aria-label="Loading leaderboard">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      ) : null}

      {!isLoading && !errorMessage && records.length === 0 ? (
        <div className="leaderboard-empty">{LEADERBOARD_TEXT.empty}</div>
      ) : null}

      {!isLoading && records.length > 0 ? (
        <div className="leaderboard-list">
          {records.map((record, index) => {
            const rank = index + 1;
            const highlighted = record.id === highlightId;
            const podiumClass = rank <= 3 ? `podium-rank podium-rank-${rank}` : "";

            return (
              <div key={record.id} className={`leaderboard-row ${podiumClass} ${highlighted ? "leaderboard-row-highlight" : ""}`}>
                <div className="rank-badge">{rank}</div>
                <div className="leaderboard-player">
                  <strong>{record.player_name}</strong>
                  {record.shoutout ? <em>{record.shoutout}</em> : null}
                  <span>{formatDate(record.created_at)}</span>
                </div>
                <div className="leaderboard-score">
                  <strong>{record.score.toLocaleString()}</strong>
                  <span>
                    {Number(record.accuracy).toFixed(0)}% / CPM {record.cpm} / x{record.max_combo} / miss {record.miss_count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
