"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/AuthPanel";
import type { Difficulty } from "@/data/wordBank";
import { getFallbackUsername, loadProfileUsername } from "@/lib/authHelpers";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  isValidLeaderboardScore,
  sanitizePlayerName,
  sanitizeShoutout,
  type LeaderboardInsert,
  type LeaderboardRecord
} from "@/types/leaderboard";

type SubmitState = "idle" | "submitting" | "success" | "error";

type ScoreSubmitFormProps = {
  score: number;
  accuracy: number;
  maxCombo: number;
  missCount: number;
  cpm: number;
  difficulty: Difficulty;
  onSubmitted: (record: LeaderboardRecord) => void;
};

const FORM_TEXT = {
  title: "\u30e9\u30f3\u30ad\u30f3\u30b0\u767b\u9332",
  signedIn: "\u30ed\u30b0\u30a4\u30f3\u4e2d",
  shoutout: "\u307f\u3093\u306a\u3078\u306e\u4e00\u8a00",
  shoutoutPlaceholder: "\u4eca\u65e5\u306e\u5207\u308c\u5473\u306f\u826f\u304b\u3063\u305f",
  register: "\u767b\u9332\u3059\u308b",
  registered: "\u767b\u9332\u6e08\u307f",
  sending: "\u9001\u4fe1\u4e2d...",
  signOut: "\u30ed\u30b0\u30a2\u30a6\u30c8",
  submitDone: "\u767b\u9332\u5b8c\u4e86\uff01",
  bestUpdated: "\u81ea\u5df1\u30d9\u30b9\u30c8\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f\uff01",
  bestKept: "\u73fe\u5728\u306e\u6700\u9ad8\u8a18\u9332\u3092\u7dad\u6301\u3057\u307e\u3057\u305f\u3002\u4e00\u8a00\u306f\u66f4\u65b0\u3057\u307e\u3057\u305f\u3002",
  invalidScore: "\u9001\u4fe1\u3067\u304d\u306a\u3044\u30b9\u30b3\u30a2\u3067\u3059\u3002\u7d50\u679c\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  missingEnv: "Supabase\u306e\u74b0\u5883\u5909\u6570\u304c\u672a\u8a2d\u5b9a\u3067\u3059\u3002.env.local\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  profileFailed: "\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002",
  loginRequired: "\u30e9\u30f3\u30ad\u30f3\u30b0\u306b\u767b\u9332\u3059\u308b\u306b\u306f\u30ed\u30b0\u30a4\u30f3\u3057\u3066\u304f\u3060\u3055\u3044\u3002"
};

function normalizeScorePayload(payload: LeaderboardInsert): LeaderboardInsert {
  return {
    user_id: payload.user_id,
    player_name: sanitizePlayerName(payload.player_name),
    shoutout: sanitizeShoutout(payload.shoutout).slice(0, 80),
    score: Math.max(0, Math.floor(payload.score)),
    accuracy: Math.min(100, Math.max(0, Number(payload.accuracy.toFixed(2)))),
    max_combo: Math.max(0, Math.floor(payload.max_combo)),
    miss_count: Math.max(0, Math.floor(payload.miss_count)),
    cpm: Math.max(0, Math.floor(payload.cpm)),
    difficulty: payload.difficulty
  };
}

function isNewRecordBetter(next: LeaderboardInsert, current: LeaderboardRecord) {
  if (next.score !== current.score) {
    return next.score > current.score;
  }

  if (next.accuracy !== Number(current.accuracy)) {
    return next.accuracy > Number(current.accuracy);
  }

  return next.max_combo > current.max_combo;
}

export function ScoreSubmitForm({
  score,
  accuracy,
  maxCombo,
  missCount,
  cpm,
  difficulty,
  onSubmitted
}: ScoreSubmitFormProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState("");
  const [shoutout, setShoutout] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  const loadSession = useCallback(async () => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setMessage(FORM_TEXT.missingEnv);
      setSubmitState("error");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const nextSession = data.session;
    setSession(nextSession);

    if (!nextSession) {
      setUsername("");
      return;
    }

    const nextUsername = await loadProfileUsername(nextSession);
    setUsername(nextUsername);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();

    void loadSession();

    if (!supabase) {
      return;
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUsername(getFallbackUsername(nextSession));
      setSubmitState("idle");
      setMessage("");
      void loadSession();
    });

    return () => subscription.unsubscribe();
  }, [loadSession]);

  const remainingChars = useMemo(() => 80 - Array.from(shoutout).length, [shoutout]);
  const isSubmitting = submitState === "submitting";
  const isSubmitted = submitState === "success";

  async function handleSignOut() {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSession(null);
    setUsername("");
    setSubmitState("idle");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || isSubmitted) {
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setSubmitState("error");
      setMessage(FORM_TEXT.missingEnv);
      return;
    }

    if (!session) {
      setSubmitState("error");
      setMessage(FORM_TEXT.loginRequired);
      return;
    }

    if (score < 0 || accuracy < 0 || accuracy > 100 || maxCombo < 0 || missCount < 0 || cpm < 0) {
      setSubmitState("error");
      setMessage(FORM_TEXT.invalidScore);
      return;
    }

    const cleanUsername = sanitizePlayerName(username || getFallbackUsername(session));

    if (!cleanUsername) {
      setSubmitState("error");
      setMessage(FORM_TEXT.profileFailed);
      return;
    }

    const payload = normalizeScorePayload({
      user_id: session.user.id,
      player_name: cleanUsername,
      shoutout,
      score,
      accuracy,
      max_combo: maxCombo,
      miss_count: missCount,
      cpm,
      difficulty
    });

    if (!isValidLeaderboardScore(payload)) {
      setSubmitState("error");
      setMessage(FORM_TEXT.invalidScore);
      return;
    }

    setSubmitState("submitting");
    setMessage("");

    const { data: existing, error: existingError } = await supabase
      .from("leaderboard")
      .select("id, user_id, player_name, shoutout, score, accuracy, max_combo, miss_count, cpm, difficulty, created_at")
      .eq("user_id", session.user.id)
      .eq("difficulty", difficulty)
      .maybeSingle();

    if (existingError) {
      setSubmitState("error");
      setMessage(existingError.message);
      return;
    }

    if (existing) {
      const current = existing as LeaderboardRecord;
      const shouldReplaceScore = isNewRecordBetter(payload, current);
      const updatePayload = shouldReplaceScore
        ? {
            player_name: payload.player_name,
            shoutout: payload.shoutout,
            score: payload.score,
            accuracy: payload.accuracy,
            max_combo: payload.max_combo,
            miss_count: payload.miss_count,
            cpm: payload.cpm,
            created_at: new Date().toISOString()
          }
        : {
            player_name: payload.player_name,
            shoutout: payload.shoutout
          };

      const { data, error } = await supabase
        .from("leaderboard")
        .update(updatePayload)
        .eq("id", current.id)
        .eq("user_id", session.user.id)
        .select("id, user_id, player_name, shoutout, score, accuracy, max_combo, miss_count, cpm, difficulty, created_at")
        .single();

      if (error || !data) {
        setSubmitState("error");
        setMessage(error?.message ?? "\u30e9\u30f3\u30ad\u30f3\u30b0\u66f4\u65b0\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002");
        return;
      }

      setSubmitState("success");
      setMessage(shouldReplaceScore ? FORM_TEXT.bestUpdated : FORM_TEXT.bestKept);
      onSubmitted(data as LeaderboardRecord);
      return;
    }

    const { data, error } = await supabase
      .from("leaderboard")
      .insert({
        ...payload,
        created_at: new Date().toISOString()
      })
      .select("id, user_id, player_name, shoutout, score, accuracy, max_combo, miss_count, cpm, difficulty, created_at")
      .single();

    if (error || !data) {
      setSubmitState("error");
      setMessage(error?.message ?? "\u30e9\u30f3\u30ad\u30f3\u30b0\u767b\u9332\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002");
      return;
    }

    setSubmitState("success");
    setMessage(FORM_TEXT.submitDone);
    onSubmitted(data as LeaderboardRecord);
  }

  if (!session) {
    return (
      <div className="score-submit-panel">
        <AuthPanel
          onAuthChanged={(nextSession, nextUsername) => {
            setSession(nextSession);
            setUsername(nextUsername ?? getFallbackUsername(nextSession));
            setSubmitState("idle");
            setMessage("");
            void loadSession();
          }}
        />
      </div>
    );
  }

  return (
    <form className="score-submit-panel" onSubmit={handleSubmit}>
      <div>
        <p className="panel-kicker">ランキング登録</p>
        <h3 className="panel-title">{FORM_TEXT.title}</h3>
      </div>

      <div className="account-chip">
        <span>{FORM_TEXT.signedIn}</span>
        <strong>{username}</strong>
        <button type="button" onClick={handleSignOut}>
          {FORM_TEXT.signOut}
        </button>
      </div>

      <label className="name-field">
        <span>{FORM_TEXT.shoutout}</span>
        <textarea
          value={shoutout}
          maxLength={80}
          disabled={isSubmitting || isSubmitted}
          placeholder={FORM_TEXT.shoutoutPlaceholder}
          onChange={(event) => {
            setShoutout(event.target.value);

            if (submitState === "error") {
              setSubmitState("idle");
              setMessage("");
            }
          }}
        />
      </label>

      <div className="submit-meta">
        <span>{Math.max(0, remainingChars)} / 80</span>
        <span>CPM {cpm}</span>
        <span>{score.toLocaleString()} pts</span>
      </div>

      <button className="submit-score-button" type="submit" disabled={isSubmitting || isSubmitted}>
        {isSubmitting ? FORM_TEXT.sending : isSubmitted ? FORM_TEXT.registered : FORM_TEXT.register}
      </button>

      {message ? <p className={`submit-message ${submitState === "success" ? "submit-success" : "submit-error"}`}>{message}</p> : null}
    </form>
  );
}
