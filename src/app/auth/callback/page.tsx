"use client";

import { useEffect, useState } from "react";
import { getFallbackUsername, upsertProfile } from "@/lib/authHelpers";
import { getSupabaseClient } from "@/lib/supabaseClient";

type CallbackStatus = "loading" | "success" | "error";

const CALLBACK_TEXT = {
  loadingTitle: "\u30e1\u30fc\u30eb\u8a8d\u8a3c\u3092\u78ba\u8a8d\u4e2d",
  successTitle: "\u30e1\u30fc\u30eb\u8a8d\u8a3c\u304c\u5b8c\u4e86\u3057\u307e\u3057\u305f",
  errorTitle: "\u8a8d\u8a3c\u30ea\u30f3\u30af\u3092\u78ba\u8a8d\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f",
  loadingBody: "\u3053\u306e\u307e\u307e\u5c11\u3057\u3060\u3051\u304a\u5f85\u3061\u304f\u3060\u3055\u3044\u3002",
  successBody:
    "\u30a2\u30ab\u30a6\u30f3\u30c8\u306e\u6e96\u5099\u304c\u3067\u304d\u307e\u3057\u305f\u3002\u30b2\u30fc\u30e0\u306b\u623b\u3063\u3066\u30ed\u30b0\u30a4\u30f3\u3057\u3001\u30e9\u30f3\u30ad\u30f3\u30b0\u306b\u6311\u6226\u3057\u307e\u3057\u3087\u3046\u3002",
  errorBody:
    "\u30ea\u30f3\u30af\u306e\u6709\u52b9\u671f\u9650\u304c\u5207\u308c\u305f\u304b\u3001\u958b\u3044\u305f\u7aef\u672b\u304b\u3089\u30b5\u30a4\u30c8\u306b\u63a5\u7d9a\u3067\u304d\u3066\u3044\u307e\u305b\u3093\u3002\u3082\u3046\u4e00\u5ea6\u4f1a\u54e1\u767b\u9332\u3092\u884c\u3063\u3066\u304f\u3060\u3055\u3044\u3002",
  back: "\u30b2\u30fc\u30e0\u306b\u623b\u308b"
};

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [message, setMessage] = useState(CALLBACK_TEXT.loadingBody);

  useEffect(() => {
    async function completeAuth() {
      const supabase = getSupabaseClient();

      if (!supabase) {
        setStatus("error");
        setMessage(CALLBACK_TEXT.errorBody);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        setStatus("error");
        setMessage(error?.message ?? CALLBACK_TEXT.errorBody);
        return;
      }

      await upsertProfile(data.session, getFallbackUsername(data.session));
      window.history.replaceState(null, "", "/auth/callback");
      setStatus("success");
      setMessage(CALLBACK_TEXT.successBody);
    }

    void completeAuth();
  }, []);

  const title =
    status === "loading" ? CALLBACK_TEXT.loadingTitle : status === "success" ? CALLBACK_TEXT.successTitle : CALLBACK_TEXT.errorTitle;

  return (
    <main className="auth-callback-page">
      <div className="scene-bg">
        <div className="moon" />
        <div className="castle">
          <span />
          <span />
          <span />
        </div>
        <div className="bamboo bamboo-left" />
        <div className="bamboo bamboo-right" />
        <div className="scanline" />
      </div>

      <section className={`auth-callback-card ${status === "success" ? "auth-callback-success" : ""}`}>
        <p className="panel-kicker">Ninja Typing</p>
        <h1>{title}</h1>
        <p>{message}</p>
        <a className="start-button auth-callback-link" href="/">
          {CALLBACK_TEXT.back}
        </a>
      </section>
    </main>
  );
}
