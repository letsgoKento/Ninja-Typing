"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/AuthPanel";
import { Leaderboard } from "@/components/Leaderboard";
import { ScoreSubmitForm } from "@/components/ScoreSubmitForm";
import { DIFFICULTIES, type Difficulty, GAME_TIME_SECONDS, type TypingPrompt } from "@/data/wordBank";
import { getFallbackUsername, loadProfileUsername } from "@/lib/authHelpers";
import {
  calculateAccuracy,
  calculateWordScore,
  getBestScoreKey,
  getComboCallout,
  getRank,
  getUnlockedRanksKey,
  initialMetrics,
  RANKS,
  type GameStatus,
  type Metrics,
  type RankDefinition
} from "@/lib/game";
import { buildRomajiOptions, getRomajiGuide } from "@/lib/romaji";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { LeaderboardRecord } from "@/types/leaderboard";
import { createGameShareUrl, createScoreShareUrl, openShareUrl } from "@/utils/share";

type VisualEffect = {
  id: number;
  type: "slash" | "miss" | "hit";
  left: number;
  top: number;
  rotate: number;
};

type AudioKind = "type" | "miss" | "clear" | "hit" | "start" | "tap" | "finish";

type EnemyConfig = {
  id: number;
  label: string;
  left: number;
  top: number;
  scale: number;
  variant: number;
};

const JA_TITLE = "\u5fcd\u8005\u30bf\u30a4\u30d4\u30f3\u30b0";
const SPACE_MARK = "\u00a0";

const COPY = {
  countdown: "60\u79d2\u3067\u4f55\u4f53\u5012\u305b\u308b\u304b",
  heroLine1: "忍者!!",
  heroLine2: "タイピング",
  intro:
    "表示された読みをローマ字で斬るように入力。正確に打ち切るたび、忍者が手裏剣で敵を撃破。連撃を重ねるほどコンボ倍率と演出が研ぎ澄まされます。",
  correctGlow: "\u6b63\u3057\u3044\u6587\u5b57\u306f\u767a\u5149",
  missShake: "\u30df\u30b9\u3067\u753b\u9762\u30b7\u30a7\u30a4\u30af",
  bestSaved: "\u6700\u9ad8\u30b9\u30b3\u30a2\u4fdd\u5b58",
  bestUpdated:
    "\u6700\u9ad8\u30b9\u30b3\u30a2\u66f4\u65b0\u3002\u5207\u308c\u5473\u3001\u304b\u306a\u308a\u826f\u3044\u3067\u3059\u3002",
  bestChase: "\u307e\u3067\u3042\u3068\u5c11\u3057\u3002",
  accountHelp:
    "\u30a2\u30ab\u30a6\u30f3\u30c8\u3092\u4f5c\u308b\u3068\u3001\u30b9\u30b3\u30a2\u3092\u96e3\u6613\u5ea6\u3054\u3068\u306b1\u3064\u305a\u3064\u30e9\u30f3\u30ad\u30f3\u30b0\u306b\u767b\u9332\u3067\u304d\u307e\u3059\u3002",
  signedIn: "\u30ed\u30b0\u30a4\u30f3\u4e2d",
  signOut: "\u30ed\u30b0\u30a2\u30a6\u30c8"
};

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "normal", "hard"];
const RANK_ID_SET = new Set(RANKS.map((rank) => rank.id));
const enemyNames = ["ONI", "AKA NINJA", "KAGE ONI", "ROGUE", "SHADOW"];

function createEnemyConfig(id: number): EnemyConfig {
  return {
    id,
    label: enemyNames[id % enemyNames.length],
    left: 58 + Math.random() * 30,
    top: 28 + Math.random() * 42,
    scale: 0.86 + Math.random() * 0.24,
    variant: id % 4
  };
}

function getWordFontSize(length: number) {
  if (length >= 28) {
    return "clamp(1.05rem, 2.1vw, 2.25rem)";
  }

  if (length >= 23) {
    return "clamp(1.2rem, 2.45vw, 2.7rem)";
  }

  if (length >= 18) {
    return "clamp(1.45rem, 3.05vw, 3.25rem)";
  }

  if (length >= 14) {
    return "clamp(1.8rem, 3.7vw, 4rem)";
  }

  return "clamp(2.05rem, 4.5vw, 4.7rem)";
}

function getJapaneseFontSize(length: number) {
  if (length >= 17) {
    return "clamp(1.55rem, 3vw, 3.3rem)";
  }

  if (length >= 13) {
    return "clamp(1.85rem, 3.5vw, 3.9rem)";
  }

  if (length >= 9) {
    return "clamp(2.15rem, 4.3vw, 4.8rem)";
  }

  return "clamp(2.6rem, 5.4vw, 5.8rem)";
}

function useNinjaAudio(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (!enabled || typeof window === "undefined") {
      return null;
    }

    const audioWindow = window as Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextClass = window.AudioContext ?? audioWindow.webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    if (!contextRef.current) {
      contextRef.current = new AudioContextClass();
    }

    if (contextRef.current.state === "suspended") {
      void contextRef.current.resume();
    }

    return contextRef.current;
  }, [enabled]);

  const play = useCallback(
    (kind: AudioKind) => {
      const context = getContext();

      if (!context) {
        return;
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;

      oscillator.connect(gain);
      gain.connect(context.destination);

      if (kind === "tap") {
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(520, now);
        oscillator.frequency.exponentialRampToValueAtTime(760, now + 0.06);
        gain.gain.setValueAtTime(0.026, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        oscillator.start(now);
        oscillator.stop(now + 0.09);
        return;
      }

      if (kind === "miss") {
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(170, now);
        oscillator.frequency.exponentialRampToValueAtTime(90, now + 0.16);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        oscillator.start(now);
        oscillator.stop(now + 0.19);
        return;
      }

      if (kind === "clear" || kind === "hit") {
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(kind === "clear" ? 440 : 260, now);
        oscillator.frequency.exponentialRampToValueAtTime(kind === "clear" ? 980 : 90, now + 0.22);
        gain.gain.setValueAtTime(kind === "clear" ? 0.075 : 0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        oscillator.start(now);
        oscillator.stop(now + 0.25);
        return;
      }

      if (kind === "finish") {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(740, now);
        oscillator.frequency.exponentialRampToValueAtTime(330, now + 0.34);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        oscillator.start(now);
        oscillator.stop(now + 0.44);

        const second = context.createOscillator();
        const secondGain = context.createGain();
        second.connect(secondGain);
        secondGain.connect(context.destination);
        second.type = "triangle";
        second.frequency.setValueAtTime(980, now + 0.1);
        second.frequency.exponentialRampToValueAtTime(490, now + 0.42);
        secondGain.gain.setValueAtTime(0.07, now + 0.1);
        secondGain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
        second.start(now + 0.1);
        second.stop(now + 0.48);

        const low = context.createOscillator();
        const lowGain = context.createGain();
        low.connect(lowGain);
        lowGain.connect(context.destination);
        low.type = "sine";
        low.frequency.setValueAtTime(180, now + 0.16);
        low.frequency.exponentialRampToValueAtTime(92, now + 0.6);
        lowGain.gain.setValueAtTime(0.06, now + 0.16);
        lowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.64);
        low.start(now + 0.16);
        low.stop(now + 0.66);
        return;
      }

      oscillator.type = kind === "start" ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(kind === "start" ? 220 : 640, now);
      oscillator.frequency.exponentialRampToValueAtTime(kind === "start" ? 520 : 820, now + 0.08);
      gain.gain.setValueAtTime(kind === "start" ? 0.08 : 0.022, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      oscillator.start(now);
      oscillator.stop(now + 0.11);
    },
    [getContext]
  );

  const startAmbient = useCallback(() => undefined, []);
  const stopAmbient = useCallback(() => undefined, []);

  useEffect(() => {
    if (!enabled) {
      stopAmbient();
    }
  }, [enabled, stopAmbient]);

  return useMemo(() => ({ play, startAmbient, stopAmbient }), [play, startAmbient, stopAmbient]);
}

function pickWord(difficulty: Difficulty, previousWord?: TypingPrompt) {
  const words = DIFFICULTIES[difficulty].words;
  let nextWord = words[Math.floor(Math.random() * words.length)];

  if (words.length > 1) {
    while (nextWord.text === previousWord?.text) {
      nextWord = words[Math.floor(Math.random() * words.length)];
    }
  }

  return nextWord;
}

function StatTile({
  label,
  value,
  accent
}: {
  label: string;
  value: string | number;
  accent?: "cyan" | "red" | "gold";
}) {
  const accentClass =
    accent === "red" ? "text-rose-300" : accent === "gold" ? "text-amber-200" : "text-cyan-200";

  return (
    <div className="stat-tile">
      <span>{label}</span>
      <strong className={accentClass}>{value}</strong>
    </div>
  );
}

function formatRankRange(rank: RankDefinition) {
  const min = rank.minScore.toLocaleString();

  if (rank.maxScore === null) {
    return `${min}+`;
  }

  return `${min} - ${rank.maxScore.toLocaleString()}`;
}

function RankGallery({ unlockedRankIds }: { unlockedRankIds: string[] }) {
  const unlockedSet = new Set(unlockedRankIds);
  const unlockedCount = unlockedRankIds.filter((id) => RANK_ID_SET.has(id)).length;

  return (
    <div className="rank-gallery">
      <div className="rank-gallery-header">
        <div>
          <p className="panel-kicker">Rank Archive</p>
          <h3>称号一覧</h3>
        </div>
        <span>
          {unlockedCount} / {RANKS.length}
        </span>
      </div>

      <div className="rank-gallery-list">
        {RANKS.map((rank) => {
          const unlocked = unlockedSet.has(rank.id);

          return (
            <div key={rank.id} className={`rank-gallery-item ${unlocked ? "rank-unlocked" : "rank-locked"}`}>
              <div>
                <strong>{unlocked ? rank.title : "???"}</strong>
                <em>{unlocked ? rank.subtitle : "未解除"}</em>
              </div>
              <span>{formatRankRange(rank)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccountScreen({
  session,
  username,
  onAuthChanged,
  onSignOut
}: {
  session: Session | null;
  username: string;
  onAuthChanged: (session: Session | null, username?: string) => void;
  onSignOut: () => void;
}) {
  if (!session) {
    return <AuthPanel helpText={COPY.accountHelp} onAuthChanged={onAuthChanged} />;
  }

  return (
    <div className="account-status-panel">
      <p className="panel-kicker">Account</p>
      <h2>{COPY.signedIn}</h2>
      <div className="account-identity">
        <span>{username || getFallbackUsername(session)}</span>
        <strong>{session.user.email}</strong>
      </div>
      <p>{COPY.accountHelp}</p>
      <button className="ghost-button" type="button" onClick={onSignOut}>
        {COPY.signOut}
      </button>
    </div>
  );
}

function HowToPlayPanel() {
  return (
    <div className="help-panel">
      <div>
        <p className="panel-kicker">Guide</p>
        <h2>遊び方とスコア</h2>
      </div>

      <div className="help-grid">
        <section>
          <span>01</span>
          <h3>表示された読みをローマ字で入力</h3>
          <p>しは si・shi・ci のように、一般的な打ち方は複数パターンに対応しています。</p>
        </section>
        <section>
          <span>02</span>
          <h3>正解で手裏剣、ミスでコンボリセット</h3>
          <p>一つのお題を打ち切ると敵を撃破。ミスするとコンボが0に戻ります。</p>
        </section>
        <section>
          <span>03</span>
          <h3>スコアは長さ・難易度・コンボで上昇</h3>
          <p>長いお題ほど基本点が高く、Normal・Hardでは難易度倍率がかかります。</p>
        </section>
        <section>
          <span>04</span>
          <h3>ランキングは難易度ごとに1人1件</h3>
          <p>会員登録すると最高記録を保存できます。記録更新時は自動で上書きされます。</p>
        </section>
      </div>

      <div className="help-score-strip">
        <span>Base: 85 + 読みの長さ x 16</span>
        <span>Combo: 1連ごとに +10%</span>
        <span>Difficulty: Easy x1 / Normal x1.25 / Hard x1.55</span>
      </div>
    </div>
  );
}

function NinjaFigure({ combo }: { combo: number }) {
  const aura = Math.min(combo / 30, 1);

  return (
    <motion.div className="ninja-wrap" animate={{ y: [0, -5, 0] }} transition={{ duration: 2.6, repeat: Infinity }}>
      <motion.div
        className="ninja-aura"
        animate={{
          opacity: 0.28 + aura * 0.5,
          scale: 1 + aura * 0.28
        }}
      />
      <svg className="ninja-svg" viewBox="0 0 220 220" role="img" aria-label="Cyber ninja">
        <defs>
          <linearGradient id="ninjaSuit" x1="44" x2="164" y1="26" y2="194" gradientUnits="userSpaceOnUse">
            <stop stopColor="#132036" />
            <stop offset="0.54" stopColor="#080C16" />
            <stop offset="1" stopColor="#19283F" />
          </linearGradient>
          <linearGradient id="ninjaScarf" x1="114" x2="210" y1="82" y2="70" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22D3EE" />
            <stop offset="1" stopColor="#F43F5E" />
          </linearGradient>
          <filter id="ninjaGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.10 0 0 0 0 0.85 0 0 0 0 0.95 0 0 0 0.55 0" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d="M55 189c12-39 30-59 56-59s45 20 58 59H55Z" fill="url(#ninjaSuit)" stroke="#38BDF8" strokeOpacity="0.24" strokeWidth="3" />
        <path d="M61 82c0-32 22-56 52-56s52 24 52 56c0 36-22 61-52 61S61 118 61 82Z" fill="url(#ninjaSuit)" stroke="#67E8F9" strokeOpacity="0.28" strokeWidth="4" />
        <path d="M73 86c12-14 25-21 40-21s29 7 41 21c-10 15-24 22-41 22S83 101 73 86Z" fill="#E5F7FF" />
        <path d="M83 87c10-7 20-11 30-11s21 4 30 11c-9 8-19 12-30 12S92 95 83 87Z" fill="#0A1020" />
        <path d="M95 88h38" stroke="#22D3EE" strokeWidth="5" strokeLinecap="round" filter="url(#ninjaGlow)" />
        <path d="M158 76c17-6 34-4 52 8-18 1-32 8-43 21l-16-11c5-5 7-11 7-18Z" fill="url(#ninjaScarf)" />
        <path d="M69 119c17 10 32 15 45 15s28-5 45-15" stroke="#F8FAFC" strokeOpacity="0.16" strokeWidth="5" strokeLinecap="round" />
        <path d="M78 154h72" stroke="#F59E0B" strokeOpacity="0.55" strokeWidth="6" strokeLinecap="round" />
        <path d="M84 169h58" stroke="#22D3EE" strokeOpacity="0.42" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </motion.div>
  );
}

function EnemyFigure({ hit, config }: { hit: boolean; config: EnemyConfig }) {
  return (
    <div
      key={config.id}
      className="enemy-wrap"
      style={{
        left: `${config.left}%`,
        top: `${config.top}%`,
        transform: `translate(-50%, -50%) scale(${config.scale})`
      }}
    >
      <motion.div
        key={config.id}
        className="enemy-motion"
        initial={{ opacity: 1, scale: 1, rotate: 0 }}
        animate={
          hit
            ? { scale: [1, 1.1, 0.64], opacity: [1, 1, 0], rotate: [0, -3, 7], y: [0, -2, 8] }
            : { y: [0, 5, 0], opacity: 1, scale: 1, rotate: 0 }
        }
        transition={hit ? { duration: 0.34, ease: "easeOut" } : { duration: 2.2, repeat: Infinity }}
      >
        <div className={`enemy-core enemy-variant-${config.variant}`}>
          <div className="enemy-horns">
            <span />
            <span />
          </div>
          <div className="enemy-mask">
            <span />
            <span />
          </div>
          <div className="enemy-mouth" />
          <div className="enemy-label">{config.label}</div>
        </div>
        <div className="target-ring" />
      </motion.div>
    </div>
  );
}

function renderChar(char: string, index: number, input: string, wrongIndex: number | null) {
  const typed = index < input.length;
  const isCursor = index === input.length;
  const isWrong = wrongIndex === index;
  const displayChar = char === " " ? SPACE_MARK : char;

  return (
    <span
      key={`${char}-${index}`}
      className={[
        "word-char",
        typed ? "word-char-correct" : "",
        isCursor ? "word-char-cursor" : "",
        isWrong ? "word-char-wrong" : "",
        char === " " ? "word-char-space" : ""
      ].join(" ")}
    >
      {displayChar}
    </span>
  );
}

export function NinjaTypingGame() {
  const [status, setStatus] = useState<GameStatus>("idle");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [currentPrompt, setCurrentPrompt] = useState(() => pickWord("normal"));
  const [nextPrompt, setNextPrompt] = useState(() => pickWord("normal"));
  const [input, setInput] = useState("");
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME_SECONDS);
  const [bestScore, setBestScore] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [effects, setEffects] = useState<VisualEffect[]>([]);
  const [wrongIndex, setWrongIndex] = useState<number | null>(null);
  const [enemyHit, setEnemyHit] = useState(false);
  const [enemyConfig, setEnemyConfig] = useState(() => createEnemyConfig(0));
  const [attackId, setAttackId] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [lastRunWasBest, setLastRunWasBest] = useState(false);
  const [leaderboardDifficulty, setLeaderboardDifficulty] = useState<Difficulty>("normal");
  const [submittedLeaderboardId, setSubmittedLeaderboardId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState("");
  const [unlockedRankIds, setUnlockedRankIds] = useState<string[]>([]);
  const endAtRef = useRef(0);
  const metricsRef = useRef(metrics);
  const statusRef = useRef(status);
  const effectIdRef = useRef(0);
  const shareLockRef = useRef(0);
  const audio = useNinjaAudio(soundEnabled);

  const accuracy = useMemo(() => calculateAccuracy(metrics.correctKeys, metrics.totalKeys), [metrics.correctKeys, metrics.totalKeys]);
  const rank = useMemo(() => getRank(metrics.score), [metrics.score]);
  const romajiCandidates = useMemo(() => buildRomajiOptions(currentPrompt.reading), [currentPrompt.reading]);
  const romajiGuide = useMemo(() => getRomajiGuide(romajiCandidates, input), [input, romajiCandidates]);
  const comboCallout = getComboCallout(metrics.combo);
  const auraClass = metrics.combo >= 18 ? "combo-legend" : metrics.combo >= 10 ? "combo-hot" : "";

  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const refreshAccount = useCallback(async () => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return;
    }

    const { data } = await supabase.auth.getSession();
    setSession(data.session);

    if (!data.session) {
      setUsername("");
      return;
    }

    setUsername(await loadProfileUsername(data.session));
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();

    void refreshAccount();

    if (!supabase) {
      return;
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUsername(nextSession ? getFallbackUsername(nextSession) : "");
      void refreshAccount();
    });

    return () => subscription.unsubscribe();
  }, [refreshAccount]);

  useEffect(() => {
    if (status === "playing" && soundEnabled) {
      audio.startAmbient();
    }
  }, [audio, soundEnabled, status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedScore = window.localStorage.getItem(getBestScoreKey(difficulty));
    setBestScore(savedScore ? Number(savedScore) : 0);
  }, [difficulty]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedRanks = window.localStorage.getItem(getUnlockedRanksKey());
    const bestScoreRanks = DIFFICULTY_ORDER.flatMap((item) => {
      const savedScore = window.localStorage.getItem(getBestScoreKey(item));

      if (savedScore === null) {
        return [];
      }

      const score = Number(savedScore);
      return RANKS.filter((rankItem) => score >= rankItem.minScore).map((rankItem) => rankItem.id);
    });

    if (!savedRanks) {
      const initialRanks = Array.from(new Set(bestScoreRanks));
      setUnlockedRankIds(initialRanks);
      window.localStorage.setItem(getUnlockedRanksKey(), JSON.stringify(initialRanks));
      return;
    }

    try {
      const parsed = JSON.parse(savedRanks);

      if (Array.isArray(parsed)) {
        const savedValidRanks = parsed.filter((value): value is string => typeof value === "string" && RANK_ID_SET.has(value));
        const merged = Array.from(new Set([...savedValidRanks, ...bestScoreRanks]));
        setUnlockedRankIds(merged);
        window.localStorage.setItem(getUnlockedRanksKey(), JSON.stringify(merged));
      }
    } catch {
      const fallbackRanks = Array.from(new Set(bestScoreRanks));
      setUnlockedRankIds(fallbackRanks);
      window.localStorage.setItem(getUnlockedRanksKey(), JSON.stringify(fallbackRanks));
    }
  }, []);

  const addEffect = useCallback((type: VisualEffect["type"], position?: Pick<VisualEffect, "left" | "top">) => {
    const id = effectIdRef.current + 1;
    effectIdRef.current = id;

    const effect: VisualEffect = {
      id,
      type,
      left: position?.left ?? (type === "hit" ? 78 : 42 + Math.random() * 22),
      top: position?.top ?? (type === "hit" ? 46 : 34 + Math.random() * 30),
      rotate: -36 + Math.random() * 72
    };

    setEffects((previous) => [...previous, effect]);
    window.setTimeout(() => {
      setEffects((previous) => previous.filter((item) => item.id !== id));
    }, type === "hit" ? 760 : 360);
  }, []);

  const finishGame = useCallback(() => {
    if (statusRef.current !== "playing") {
      return;
    }

    statusRef.current = "finished";
    const finalScore = metricsRef.current.score;

    setStatus("finished");
    setLeaderboardDifficulty(difficulty);
    setIsResolving(false);
    setInput("");
    setEnemyHit(false);
    setTimeLeft(0);
    audio.stopAmbient();
    audio.play("finish");

    if (typeof window !== "undefined") {
      const key = getBestScoreKey(difficulty);
      const previousBest = Number(window.localStorage.getItem(key) ?? 0);
      const nextBest = Math.max(previousBest, finalScore);
      window.localStorage.setItem(key, String(nextBest));
      setLastRunWasBest(finalScore > previousBest);
      setBestScore(nextBest);

      const newlyUnlocked = RANKS.filter((item) => finalScore >= item.minScore).map((item) => item.id);
      setUnlockedRankIds((previous) => {
        const merged = Array.from(new Set([...previous.filter((item) => RANK_ID_SET.has(item)), ...newlyUnlocked]));
        window.localStorage.setItem(getUnlockedRanksKey(), JSON.stringify(merged));
        return merged;
      });
    }
  }, [audio, difficulty]);

  const openShareOnce = useCallback((shareUrl: string) => {
    const now = Date.now();

    if (now - shareLockRef.current < 900) {
      return;
    }

    shareLockRef.current = now;
    openShareUrl(shareUrl);
  }, []);

  const selectDifficultyByOffset = useCallback((offset: number) => {
    setDifficulty((current) => {
      const index = DIFFICULTY_ORDER.indexOf(current);
      return DIFFICULTY_ORDER[(index + offset + DIFFICULTY_ORDER.length) % DIFFICULTY_ORDER.length];
    });
  }, []);

  useEffect(() => {
    if (status !== "playing") {
      return;
    }

    const timerId = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        finishGame();
      }
    }, 200);

    return () => window.clearInterval(timerId);
  }, [finishGame, status]);

  const startGame = useCallback(() => {
    const firstPrompt = pickWord(difficulty, currentPrompt);
    const queuedPrompt = pickWord(difficulty, firstPrompt);

    statusRef.current = "playing";
    setStatus("playing");
    setCurrentPrompt(firstPrompt);
    setNextPrompt(queuedPrompt);
    setInput("");
    setMetrics(initialMetrics);
    setTimeLeft(GAME_TIME_SECONDS);
    setEffects([]);
    setWrongIndex(null);
    setEnemyHit(false);
    setEnemyConfig((value) => createEnemyConfig(value.id + 1));
    setAttackId(0);
    setIsResolving(false);
    setScreenShake(false);
    setLastRunWasBest(false);
    setSubmittedLeaderboardId(null);
    setLeaderboardDifficulty(difficulty);
    endAtRef.current = Date.now() + GAME_TIME_SECONDS * 1000;
    audio.play("start");
    audio.startAmbient();
  }, [audio, currentPrompt, difficulty]);

  const returnToTitle = useCallback(() => {
    audio.stopAmbient();
    statusRef.current = "idle";
    setStatus("idle");
    setTimeLeft(GAME_TIME_SECONDS);
    setInput("");
    setIsResolving(false);
    setWrongIndex(null);
    setEnemyHit(false);
  }, [audio]);

  const openLeaderboard = useCallback(
    (selectedDifficulty: Difficulty = difficulty) => {
      audio.stopAmbient();
      statusRef.current = "leaderboard";
      setLeaderboardDifficulty(selectedDifficulty);
      setStatus("leaderboard");
      setInput("");
      setIsResolving(false);
      setWrongIndex(null);
      setEnemyHit(false);
    },
    [audio, difficulty]
  );

  const openAuth = useCallback(() => {
    audio.stopAmbient();
    statusRef.current = "auth";
    setStatus("auth");
    setInput("");
    setIsResolving(false);
    setWrongIndex(null);
    setEnemyHit(false);
  }, [audio]);

  const openHelp = useCallback(() => {
    audio.stopAmbient();
    statusRef.current = "help";
    setStatus("help");
    setInput("");
    setIsResolving(false);
    setWrongIndex(null);
    setEnemyHit(false);
  }, [audio]);

  const handleHeaderAuthChanged = useCallback(
    (nextSession: Session | null, nextUsername?: string) => {
      setSession(nextSession);
      setUsername(nextUsername ?? (nextSession ? getFallbackUsername(nextSession) : ""));
      void refreshAccount();
    },
    [refreshAccount]
  );

  const handleSignOut = useCallback(async () => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSession(null);
    setUsername("");
  }, []);

  const handleLeaderboardSubmitted = useCallback((record: LeaderboardRecord) => {
    setSubmittedLeaderboardId(record.id);
    setLeaderboardDifficulty(record.difficulty);
  }, []);

  const completeWord = useCallback(
    (completedPrompt: TypingPrompt) => {
      setIsResolving(true);
      setScreenShake(true);
      setAttackId((value) => value + 1);
      audio.play("clear");

      window.setTimeout(() => {
        if (statusRef.current !== "playing") {
          return;
        }

        setEnemyHit(true);
        addEffect("hit", { left: enemyConfig.left, top: enemyConfig.top });
        audio.play("hit");
      }, 210);

      window.setTimeout(() => {
        setScreenShake(false);
      }, 160);

      window.setTimeout(() => {
        if (statusRef.current !== "playing") {
          return;
        }

        const incomingPrompt = nextPrompt.text === completedPrompt.text ? pickWord(difficulty, completedPrompt) : nextPrompt;
        setCurrentPrompt(incomingPrompt);
        setNextPrompt(pickWord(difficulty, incomingPrompt));
        setInput("");
        setEnemyHit(false);
        setEnemyConfig((value) => createEnemyConfig(value.id + 1));
        setWrongIndex(null);
        setIsResolving(false);
      }, 570);
    },
    [addEffect, audio, difficulty, enemyConfig.left, enemyConfig.top, nextPrompt]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (status === "playing" || status === "finished" || status === "leaderboard" || status === "auth" || status === "help") {
          event.preventDefault();
          returnToTitle();
        }

        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);

      if (isEditableTarget) {
        return;
      }

      if (status === "idle") {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          startGame();
          return;
        }

        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          selectDifficultyByOffset(1);
          return;
        }

        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          selectDifficultyByOffset(-1);
          return;
        }

        if (event.key === "1" || event.key === "2" || event.key === "3") {
          event.preventDefault();
          const selectedDifficulty = DIFFICULTY_ORDER[Number(event.key) - 1];

          if (selectedDifficulty) {
            setDifficulty(selectedDifficulty);
          }
        }

        if (event.key.toLowerCase() === "l") {
          event.preventDefault();
          openLeaderboard();
        }

        if (event.key.toLowerCase() === "a") {
          event.preventDefault();
          openAuth();
        }

        if (event.key.toLowerCase() === "h") {
          event.preventDefault();
          openHelp();
        }

        return;
      }

      if (status === "finished") {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          startGame();
        }

        return;
      }

      if (status !== "playing" || isResolving) {
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        setInput((value) => value.slice(0, -1));
        setWrongIndex(null);
        return;
      }

      if (event.key.length !== 1) {
        return;
      }

      event.preventDefault();

      const typedChar = event.key.toLowerCase();
      const nextInput = input + typedChar;

      if (romajiCandidates.some((candidate) => candidate.startsWith(nextInput))) {
        setInput(nextInput);
        setWrongIndex(null);
        addEffect("slash");
        audio.play("type");

        if (romajiCandidates.includes(nextInput)) {
          setMetrics((previous) => {
            const nextCombo = previous.combo + 1;

            return {
              ...previous,
              score: previous.score + calculateWordScore(currentPrompt.reading, difficulty, nextCombo),
              combo: nextCombo,
              maxCombo: Math.max(previous.maxCombo, nextCombo),
              correctKeys: previous.correctKeys + 1,
              totalKeys: previous.totalKeys + 1,
              clearedWords: previous.clearedWords + 1
            };
          });
          completeWord(currentPrompt);
          return;
        }

        setMetrics((previous) => ({
          ...previous,
          correctKeys: previous.correctKeys + 1,
          totalKeys: previous.totalKeys + 1
        }));
        return;
      }

      setMetrics((previous) => ({
        ...previous,
        combo: 0,
        misses: previous.misses + 1,
        totalKeys: previous.totalKeys + 1
      }));
      setWrongIndex(input.length);
      setScreenShake(true);
      addEffect("miss");
      audio.play("miss");
      window.setTimeout(() => setWrongIndex(null), 210);
      window.setTimeout(() => setScreenShake(false), 180);
    },
    [
      addEffect,
      audio,
      completeWord,
      currentPrompt,
      difficulty,
      input,
      isResolving,
      returnToTitle,
      romajiCandidates,
      openLeaderboard,
      openAuth,
      openHelp,
      selectDifficultyByOffset,
      startGame,
      status
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const progress = Math.max(0, Math.min(100, (timeLeft / GAME_TIME_SECONDS) * 100));

  const handleButtonPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      const button = target.closest("button") as HTMLButtonElement | null;

      if (button && !button.disabled) {
        audio.play("tap");
      }
    },
    [audio]
  );

  return (
    <main className={`app-root status-${status} min-h-screen overflow-x-hidden bg-[#05070f] text-slate-100 ${auraClass}`} onPointerDownCapture={handleButtonPointerDown}>
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

      <div className="app-shell">
        <aside className="ad-rail ad-rail-left" aria-label="広告スペース">
          <span>AD</span>
          <strong>広告スペース</strong>
        </aside>

        <div className={`app-content ${screenShake ? "screen-shake" : ""}`}>
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.38em] text-cyan-200/80">Cyber Shinobi Drill</p>
            <h1 className="mt-2 text-2xl font-black tracking-normal text-white sm:text-3xl">Ninja Typing / {JA_TITLE}</h1>
          </div>
          <div className="header-actions">
            {status !== "playing" ? (
              <button className="icon-button wide-icon-button" type="button" onClick={() => openLeaderboard()}>
                ランキング
              </button>
            ) : null}
            {status !== "playing" ? (
              <button className="icon-button wide-icon-button" type="button" onClick={openHelp}>
                遊び方
              </button>
            ) : null}
            {status !== "playing" ? (
              <button className="icon-button account-header-button" type="button" onClick={openAuth}>
                {session ? username || getFallbackUsername(session) : "会員登録 / ログイン"}
              </button>
            ) : null}
            <button
              className="icon-button"
              type="button"
              onClick={() => setSoundEnabled((value) => !value)}
              aria-label={soundEnabled ? "効果音 ON" : "効果音 OFF"}
              title={soundEnabled ? "効果音 ON" : "効果音 OFF"}
            >
              {soundEnabled ? "効果音 ON" : "効果音 OFF"}
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {status === "idle" ? (
            <motion.section
              key="title"
              className="title-layout"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28 }}
            >
              <div className="title-copy">
                <p className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 shadow-neon-cyan">
                  {COPY.countdown}
                </p>
                <h2 className="hero-title">
                  <span className="hero-word-primary">{COPY.heroLine1}</span>
                  <span className="hero-divider">/</span>
                  <span className="hero-word-secondary">{COPY.heroLine2}</span>
                </h2>
                <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{COPY.intro}</p>
                <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  <span className="info-pill">{COPY.correctGlow}</span>
                  <span className="info-pill">{COPY.missShake}</span>
                  <span className="info-pill">{COPY.bestSaved}</span>
                </div>
                <RankGallery unlockedRankIds={unlockedRankIds} />
              </div>

              <div className="start-panel">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.28em] text-amber-200/90">難易度</p>
                  <div className="mt-4 grid gap-3">
                    {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => {
                      const item = DIFFICULTIES[key];
                      const selected = difficulty === key;

                      return (
                        <button
                          key={key}
                          className={`difficulty-button ${selected ? "difficulty-button-active" : ""}`}
                          type="button"
                          onClick={() => setDifficulty(key)}
                        >
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.subtitle}</small>
                          </span>
                          <em>{item.description}</em>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-6">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">最高スコア</span>
                    <p className="mt-1 text-3xl font-black text-amber-200">{bestScore.toLocaleString()}</p>
                  </div>
                  <button className="start-button" type="button" onClick={startGame}>
                    開始
                  </button>
                  <button className="ghost-button compact-button" type="button" onClick={() => openLeaderboard(difficulty)}>
                    ランキング
                  </button>
                  <button className="ghost-button compact-button" type="button" onClick={openHelp}>
                    遊び方
                  </button>
                  <button className="x-share-button compact-button" type="button" onClick={() => openShareOnce(createGameShareUrl())}>
                    Xでシェア
                  </button>
                </div>
              </div>
            </motion.section>
          ) : null}

          {status === "playing" ? (
            <motion.section
              key="playing"
              className="game-layout"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28 }}
            >
              <div className="hud-grid">
                <StatTile label="Time" value={`${timeLeft}s`} accent={timeLeft <= 10 ? "red" : "cyan"} />
                <StatTile label="Score" value={metrics.score.toLocaleString()} accent="gold" />
                <StatTile label="Combo" value={`x${metrics.combo}`} />
                <StatTile label="Miss" value={metrics.misses} accent="red" />
              </div>

              <div className="timer-track" aria-hidden="true">
                <motion.div className="timer-fill" animate={{ width: `${progress}%` }} transition={{ duration: 0.18 }} />
              </div>

              <div className="arena-panel">
                <div className="arena-topline">
                  <span>{DIFFICULTIES[difficulty].label} mode</span>
                  <span>Accuracy {accuracy}%</span>
                </div>

                <div className="stage">
                  <NinjaFigure combo={metrics.combo} />

                  <AnimatePresence>
                    {attackId > 0 ? (
                      <motion.div
                        key={attackId}
                        className="shuriken"
                        initial={{ left: "21%", top: "52%", rotate: 0, opacity: 0, scale: 0.72 }}
                        animate={{
                          left: ["21%", `${Math.max(44, enemyConfig.left - 8)}%`, `${enemyConfig.left}%`],
                          top: ["52%", `${Math.max(14, enemyConfig.top - 13)}%`, `${enemyConfig.top}%`],
                          rotate: 1080,
                          opacity: [0, 1, 1, 0],
                          scale: [0.72, 1, 0.82]
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.36, ease: "easeOut" }}
                      >
                        <span />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <EnemyFigure hit={enemyHit} config={enemyConfig} />

                  <div className="effect-layer">
                    <AnimatePresence>
                      {effects.map((effect) => (
                        <motion.div
                          key={effect.id}
                          className={`visual-effect ${effect.type}`}
                          style={{
                            left: `${effect.left}%`,
                            top: `${effect.top}%`,
                            rotate: `${effect.rotate}deg`
                          }}
                          initial={{ opacity: 0, scale: 0.65 }}
                          animate={{ opacity: [0, 1, 0], scale: effect.type === "hit" ? [0.6, 1.4, 2] : [0.6, 1.1, 0.85] }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: effect.type === "hit" ? 0.58 : 0.24 }}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="typing-zone">
                  <AnimatePresence>
                    {comboCallout ? (
                      <motion.div
                        key={`${comboCallout}-${metrics.combo}`}
                        className="combo-callout"
                        initial={{ opacity: 0, y: 18, scale: 0.82 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -12 }}
                      >
                        {comboCallout}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <div className="prompt-row">
                    <div className="prompt-stack current-prompt-card">
                      <div className="kana-guide">{currentPrompt.reading}</div>
                      <div className="japanese-prompt" style={{ fontSize: getJapaneseFontSize(currentPrompt.text.length) }}>
                        {currentPrompt.text}
                      </div>
                    </div>
                    <div className="next-prompt-preview">
                      <span>次のお題</span>
                      <strong>{nextPrompt.text}</strong>
                      <em>{nextPrompt.reading}</em>
                    </div>
                  </div>

                  <div className="word-display" aria-label={`Type ${romajiGuide}`} style={{ fontSize: getWordFontSize(romajiGuide.length) }}>
                    {romajiGuide.split("").map((char, index) => renderChar(char, index, input, wrongIndex))}
                  </div>
                  <div className="input-readout">
                    <span>INPUT</span>
                    <strong>{input || "start typing..."}</strong>
                  </div>
                </div>
              </div>
            </motion.section>
          ) : null}

          {status === "finished" ? (
            <motion.section
              key="finished"
              className="result-layout"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28 }}
            >
              <div className="rank-panel">
                <span className="text-sm font-bold uppercase tracking-[0.32em] text-cyan-200">任務完了</span>
                <div className="rank-letter">
                  <strong>{rank.title}</strong>
                  <span>{rank.subtitle}</span>
                  <em>{formatRankRange(rank)}</em>
                </div>
                <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">最終スコア {metrics.score.toLocaleString()}</h2>
                <p className="mt-3 text-slate-300">
                  {lastRunWasBest ? COPY.bestUpdated : `Best ${bestScore.toLocaleString()} ${COPY.bestChase}`}
                </p>
              </div>

              <div className="result-grid">
                <StatTile label="Accuracy" value={`${accuracy}%`} />
                <StatTile label="Max Combo" value={`x${metrics.maxCombo}`} accent="gold" />
                <StatTile label="Typed" value={metrics.totalKeys} />
                <StatTile label="Miss" value={metrics.misses} accent="red" />
                <StatTile label="Targets" value={metrics.clearedWords} accent="gold" />
                <StatTile label="Difficulty" value={DIFFICULTIES[difficulty].label} />
              </div>

              <div className="post-result-grid">
                <ScoreSubmitForm
                  score={metrics.score}
                  accuracy={accuracy}
                  maxCombo={metrics.maxCombo}
                  missCount={metrics.misses}
                  difficulty={difficulty}
                  onSubmitted={handleLeaderboardSubmitted}
                />
                <Leaderboard initialDifficulty={leaderboardDifficulty} highlightId={submittedLeaderboardId} refreshToken={submittedLeaderboardId ?? metrics.score} />
              </div>

              <div className="result-actions">
                <button className="start-button" type="button" onClick={startGame}>
                  もう一度
                </button>
                <button className="ghost-button" type="button" onClick={() => openLeaderboard(difficulty)}>
                  ランキング
                </button>
                <button className="ghost-button" type="button" onClick={returnToTitle}>
                  タイトル
                </button>
                <button
                  className="x-share-button"
                  type="button"
                  onClick={() =>
                    openShareOnce(
                      createScoreShareUrl({
                        score: metrics.score,
                        accuracy,
                        maxCombo: metrics.maxCombo,
                        difficulty: DIFFICULTIES[difficulty].label,
                        rank: rank.title
                      })
                    )
                  }
                >
                  スコアをXでシェア
                </button>
              </div>
            </motion.section>
          ) : null}

          {status === "leaderboard" ? (
            <motion.section
              key="leaderboard"
              className="leaderboard-layout"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28 }}
            >
              <Leaderboard initialDifficulty={leaderboardDifficulty} highlightId={submittedLeaderboardId} refreshToken={submittedLeaderboardId ?? "leaderboard"} />
              <div className="result-actions">
                <button className="start-button" type="button" onClick={startGame}>
                  Play
                </button>
                <button className="ghost-button" type="button" onClick={returnToTitle}>
                  タイトル
                </button>
              </div>
            </motion.section>
          ) : null}

          {status === "auth" ? (
            <motion.section
              key="auth"
              className="auth-layout"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28 }}
            >
              <AccountScreen
                session={session}
                username={username}
                onAuthChanged={handleHeaderAuthChanged}
                onSignOut={handleSignOut}
              />
              <div className="result-actions">
                <button className="start-button" type="button" onClick={startGame}>
                  Start
                </button>
                <button className="ghost-button" type="button" onClick={returnToTitle}>
                  タイトル
                </button>
              </div>
            </motion.section>
          ) : null}

          {status === "help" ? (
            <motion.section
              key="help"
              className="help-layout"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28 }}
            >
              <HowToPlayPanel />
              <div className="result-actions">
                <button className="start-button" type="button" onClick={startGame}>
                  Start
                </button>
                <button className="ghost-button" type="button" onClick={returnToTitle}>
                  タイトル
                </button>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
        </div>

        <aside className="ad-rail ad-rail-right" aria-label="広告スペース">
          <span>AD</span>
          <strong>広告スペース</strong>
        </aside>
      </div>
    </main>
  );
}
