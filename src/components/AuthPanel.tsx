"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { sanitizePlayerName } from "@/types/leaderboard";

type AuthPanelProps = {
  onAuthChanged: (session: Session | null, username?: string) => void;
};

const AUTH_TEXT = {
  title: "\u4f1a\u54e1\u767b\u9332 / \u30ed\u30b0\u30a4\u30f3",
  register: "\u4f1a\u54e1\u767b\u9332",
  login: "\u30ed\u30b0\u30a4\u30f3",
  username: "\u30e6\u30fc\u30b6\u30fc\u30cd\u30fc\u30e0",
  email: "\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9",
  password: "\u30d1\u30b9\u30ef\u30fc\u30c9",
  needAuth: "\u30e9\u30f3\u30ad\u30f3\u30b0\u767b\u9332\u306b\u306f\u4f1a\u54e1\u767b\u9332\u307e\u305f\u306f\u30ed\u30b0\u30a4\u30f3\u304c\u5fc5\u8981\u3067\u3059\u3002",
  confirmEmail:
    "\u767b\u9332\u30e1\u30fc\u30eb\u3092\u9001\u4fe1\u3057\u307e\u3057\u305f\u3002Supabase\u306e\u30e1\u30fc\u30eb\u78ba\u8a8d\u304cON\u306e\u5834\u5408\u306f\u3001\u78ba\u8a8d\u5f8c\u306b\u30ed\u30b0\u30a4\u30f3\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  usernameRequired: "\u30e6\u30fc\u30b6\u30fc\u30cd\u30fc\u30e0\u306f1\u301c20\u6587\u5b57\u3067\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  passwordShort: "\u30d1\u30b9\u30ef\u30fc\u30c9\u306f6\u6587\u5b57\u4ee5\u4e0a\u306b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  missingEnv: "Supabase\u306e\u74b0\u5883\u5909\u6570\u304c\u672a\u8a2d\u5b9a\u3067\u3059\u3002"
};

async function upsertProfile(session: Session, username: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return;
  }

  await supabase.from("profiles").upsert(
    {
      id: session.user.id,
      username,
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );
}

export function AuthPanel({ onAuthChanged }: AuthPanelProps) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supabase = getSupabaseClient();

    if (!supabase) {
      setIsError(true);
      setMessage(AUTH_TEXT.missingEnv);
      return;
    }

    const cleanUsername = sanitizePlayerName(username);

    if (mode === "register" && (!cleanUsername || Array.from(cleanUsername).length > 20)) {
      setIsError(true);
      setMessage(AUTH_TEXT.usernameRequired);
      return;
    }

    if (password.length < 6) {
      setIsError(true);
      setMessage(AUTH_TEXT.passwordShort);
      return;
    }

    setIsBusy(true);
    setMessage("");
    setIsError(false);

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: cleanUsername
          }
        }
      });

      if (error) {
        setIsError(true);
        setMessage(error.message);
        setIsBusy(false);
        return;
      }

      if (data.session) {
        await upsertProfile(data.session, cleanUsername);
        onAuthChanged(data.session, cleanUsername);
        setMessage("\u767b\u9332\u3057\u307e\u3057\u305f\u3002");
      } else {
        setMessage(AUTH_TEXT.confirmEmail);
      }

      setIsBusy(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.session) {
      setIsError(true);
      setMessage(error?.message ?? "\u30ed\u30b0\u30a4\u30f3\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002");
      setIsBusy(false);
      return;
    }

    const fallbackUsername = sanitizePlayerName(String(data.session.user.user_metadata?.username ?? email.split("@")[0] ?? "SHINOBI")).slice(0, 20);
    await upsertProfile(data.session, fallbackUsername);
    onAuthChanged(data.session, fallbackUsername);
    setMessage("\u30ed\u30b0\u30a4\u30f3\u3057\u307e\u3057\u305f\u3002");
    setIsBusy(false);
  }

  return (
    <div className="auth-panel">
      <div>
        <p className="panel-kicker">Account</p>
        <h3 className="panel-title">{AUTH_TEXT.title}</h3>
        <p className="auth-help">{AUTH_TEXT.needAuth}</p>
      </div>

      <div className="auth-tabs">
        <button className={mode === "register" ? "auth-tab-active" : ""} type="button" onClick={() => setMode("register")}>
          {AUTH_TEXT.register}
        </button>
        <button className={mode === "login" ? "auth-tab-active" : ""} type="button" onClick={() => setMode("login")}>
          {AUTH_TEXT.login}
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label className="name-field">
            <span>{AUTH_TEXT.username}</span>
            <input maxLength={20} value={username} disabled={isBusy} onChange={(event) => setUsername(event.target.value)} />
          </label>
        ) : null}

        <label className="name-field">
          <span>{AUTH_TEXT.email}</span>
          <input type="email" value={email} disabled={isBusy} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <label className="name-field">
          <span>{AUTH_TEXT.password}</span>
          <input type="password" value={password} disabled={isBusy} onChange={(event) => setPassword(event.target.value)} />
        </label>

        <button className="submit-score-button" type="submit" disabled={isBusy}>
          {isBusy ? "Sending..." : mode === "register" ? AUTH_TEXT.register : AUTH_TEXT.login}
        </button>
      </form>

      {message ? <p className={`submit-message ${isError ? "submit-error" : "submit-success"}`}>{message}</p> : null}
    </div>
  );
}
