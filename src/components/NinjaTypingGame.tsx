"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/AuthPanel";
import { Leaderboard } from "@/components/Leaderboard";
import { ScoreSubmitForm } from "@/components/ScoreSubmitForm";
import { DIFFICULTIES, type Difficulty, type TypingPrompt } from "@/data/wordBank";
import { getFallbackUsername, loadProfileUsername } from "@/lib/authHelpers";
import {
  calculateAccuracy,
  calculateCpm,
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
import {
  getReadingProgress,
  getRomajiGuideForInput,
  getRomajiGuideLength,
  isRomajiInputComplete,
  isRomajiInputPrefix,
  toHiragana,
  type ReadingProgress
} from "@/lib/romaji";
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

type FinisherEffect = {
  id: number;
  combo: number;
  left: number;
  top: number;
};

type AudioKind = "type" | "miss" | "clear" | "hit" | "start" | "tap" | "finish" | "finisher";

type EnemyConfig = {
  id: number;
  label: string;
  left: number;
  top: number;
  scale: number;
  variant: number;
  boss: boolean;
};

type PromptFontSizes = {
  kana: string;
  japanese: string;
  romaji: string;
};

type PromptLayout = "stageTop" | "promptTop";

type PlayerSettings = {
  promptLayout: PromptLayout;
  comboEffects: boolean;
  kanaProgress: boolean;
  textProgress: boolean;
  romajiAutoScroll: boolean;
  nextPromptPreview: boolean;
  screenShake: boolean;
  comboCallouts: boolean;
};

type BooleanPlayerSettingKey = Exclude<keyof PlayerSettings, "promptLayout">;

const JA_TITLE = "\u5fcd\u8005\u30bf\u30a4\u30d4\u30f3\u30b0";
const SPACE_MARK = "\u00a0";
const PLAYER_SETTINGS_KEY = "ninja-typing-player-settings";
const SOUND_SETTINGS_KEY = "ninja-typing-sound-enabled";
const GAME_VERSION = "v1.0.0";
const RESULT_SHORTCUT_GRACE_MS = 850;
const APP_DESIGN_WIDTH = 1720;
const APP_DESIGN_HEIGHTS: Record<GameStatus, number> = {
  idle: 900,
  playing: 900,
  finished: 1080,
  leaderboard: 980,
  auth: 980,
  help: 980,
  score: 980,
  controls: 980,
  settings: 980
};
const MAX_SHURIKEN_COUNT = 8;
const MAX_ACTIVE_EFFECTS = 32;
const disabledProgress: ReadingProgress = { completed: 0, activeStart: -1, activeEnd: -1 };

type AppRootStyle = CSSProperties & {
  "--app-scale": number;
  "--app-design-height": string;
};

const defaultPlayerSettings: PlayerSettings = {
  promptLayout: "stageTop",
  comboEffects: true,
  kanaProgress: true,
  textProgress: true,
  romajiAutoScroll: true,
  nextPromptPreview: true,
  screenShake: true,
  comboCallouts: true
};

const playerSettingRows: Array<{ key: BooleanPlayerSettingKey; title: string; description: string }> = [
  {
    key: "comboEffects",
    title: "コンボ演出変化",
    description: "コンボ数に応じて手裏剣数、爆発、オーラ、斬撃を強化します。"
  },
  {
    key: "kanaProgress",
    title: "ふりがなの追従表示",
    description: "いま読んでいる位置をふりがな側でも光らせます。"
  },
  {
    key: "textProgress",
    title: "お題の追従表示",
    description: "漢字やかなのお題側でも現在位置を追跡します。"
  },
  {
    key: "romajiAutoScroll",
    title: "ローマ字の自動追従",
    description: "長文で入力位置が画面外に出ないよう横方向に追いかけます。"
  },
  {
    key: "nextPromptPreview",
    title: "次のお題プレビュー",
    description: "現在のお題の右上に次のお題を小さく表示します。"
  },
  {
    key: "screenShake",
    title: "画面シェイク",
    description: "ミスや撃破時の揺れ演出を有効にします。"
  },
  {
    key: "comboCallouts",
    title: "コンボ称号",
    description: "NICE、COOL、SHINOBIなどの表示を出します。"
  }
];

const COPY = {
  countdown: "60 / 90 / 120\u79d2\u3067\u4f55\u4f53\u5012\u305b\u308b\u304b",
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
const bossEnemyNames = ["AKATSUKI", "ONI LORD", "KAGE BOSS", "CRIMSON"];
const smallKana = new Set("ゃゅょぁぃぅぇぉゎっャュョァィゥェォヮッ".split(""));

const TEXT_READING_OVERRIDES: Array<{ text: string; readings: string[] }> = [
  { text: "手裏剣", readings: ["しゅ", "り", "けん"] },
  { text: "黒装束", readings: ["くろ", "しょう", "ぞく"] },
  { text: "静寂", readings: ["せい", "じゃく"] },
  { text: "疾風", readings: ["しっ", "ぷう"] },
  { text: "隠密", readings: ["おん", "みつ"] },
  { text: "巻物", readings: ["まき", "もの"] },
  { text: "水面", readings: ["みな", "も"] },
  { text: "灯火", readings: ["ともし", "び"] },
  { text: "抜刀", readings: ["ばっ", "とう"] },
  { text: "閃光", readings: ["せん", "こう"] },
  { text: "結界", readings: ["けっ", "かい"] },
  { text: "護符", readings: ["ご", "ふ"] },
  { text: "秘伝", readings: ["ひ", "でん"] },
  { text: "合図", readings: ["あい", "ず"] },
  { text: "夜明け", readings: ["よ", "あ", "け"] },
  { text: "影分身", readings: ["かげ", "ぶん", "しん"] },
  { text: "忍術", readings: ["にん", "じゅつ"] },
  { text: "一撃", readings: ["いち", "げき"] },
  { text: "一閃", readings: ["いっ", "せん"] },
  { text: "間合い", readings: ["ま", "あ", "い"] },
  { text: "残像", readings: ["ざん", "ぞう"] },
  { text: "暗号", readings: ["あん", "ごう"] },
  { text: "宝玉", readings: ["ほう", "ぎょく"] },
  { text: "門番", readings: ["もん", "ばん"] },
  { text: "夜桜", readings: ["よ", "ざくら"] },
  { text: "石畳", readings: ["いし", "だたみ"] },
  { text: "道場", readings: ["どう", "じょう"] },
  { text: "影法師", readings: ["かげ", "ぼう", "し"] },
  { text: "忍道", readings: ["にん", "どう"] },
  { text: "密偵", readings: ["みっ", "てい"] },
  { text: "抜忍", readings: ["ぬけ", "にん"] },
  { text: "闇討ち", readings: ["やみ", "う", "ち"] },
  { text: "斥候", readings: ["せっ", "こう"] },
  { text: "跳梁", readings: ["ちょう", "りょう"] },
  { text: "暗躍", readings: ["あん", "やく"] },
  { text: "奇策", readings: ["き", "さく"] },
  { text: "機転", readings: ["き", "てん"] },
  { text: "潜伏", readings: ["せん", "ぷく"] },
  { text: "隠形", readings: ["おん", "ぎょう"] },
  { text: "疾走感", readings: ["しっ", "そう", "かん"] },
  { text: "鋭眼", readings: ["えい", "がん"] },
  { text: "刃先", readings: ["は", "さき"] },
  { text: "闘気", readings: ["とう", "き"] },
  { text: "気絶", readings: ["き", "ぜつ"] },
  { text: "夜陰", readings: ["や", "いん"] },
  { text: "隙間", readings: ["すき", "ま"] },
  { text: "壁影", readings: ["かべ", "かげ"] },
  { text: "天井裏", readings: ["てん", "じょう", "うら"] },
  { text: "床下", readings: ["ゆか", "した"] },
  { text: "抜刀術", readings: ["ばっ", "とう", "じゅつ"] },
  { text: "鎖鎌", readings: ["くさり", "がま"] },
  { text: "苦無", readings: ["く", "ない"] },
  { text: "火薬", readings: ["か", "やく"] },
  { text: "爆煙", readings: ["ばく", "えん"] },
  { text: "煙幕", readings: ["えん", "まく"] },
  { text: "閃き", readings: ["ひらめ", "き"] },
  { text: "連撃", readings: ["れん", "げき"] },
  { text: "必中", readings: ["ひっ", "ちゅう"] },
  { text: "俊敏", readings: ["しゅん", "びん"] },
  { text: "期限", readings: ["き", "げん"] },
  { text: "昨日", readings: ["き", "のう"] },
  { text: "制圧", readings: ["せい", "あつ"] },
  { text: "集中", readings: ["しゅう", "ちゅう"] },
  { text: "正確", readings: ["せい", "かく"] },
  { text: "把握", readings: ["は", "あく"] },
  { text: "敵", readings: ["てき"] },
  { text: "忍者", readings: ["にん", "じゃ"] }
].sort((first, second) => second.text.length - first.text.length);

function createEnemyConfig(id: number, targetCombo = 1): EnemyConfig {
  const boss = targetCombo > 0 && targetCombo % 5 === 0;

  return {
    id,
    label: boss ? bossEnemyNames[id % bossEnemyNames.length] : enemyNames[id % enemyNames.length],
    left: 58 + Math.random() * 30,
    top: 28 + Math.random() * 42,
    scale: (boss ? 1.08 : 0.86) + Math.random() * (boss ? 0.18 : 0.24),
    variant: id % 4,
    boss
  };
}

function getEnemySlashPosition(config: EnemyConfig, spread = 9) {
  return {
    left: Math.max(12, Math.min(88, config.left + (Math.random() - 0.5) * spread)),
    top: Math.max(12, Math.min(82, config.top + (Math.random() - 0.5) * spread * 0.9))
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
  if (length >= 21) {
    return "clamp(1.05rem, 2.28vw, 2.15rem)";
  }

  if (length >= 18) {
    return "clamp(1.18rem, 2.55vw, 2.55rem)";
  }

  if (length >= 15) {
    return "clamp(1.35rem, 2.9vw, 3rem)";
  }

  if (length >= 12) {
    return "clamp(1.55rem, 3.35vw, 3.55rem)";
  }

  if (length >= 9) {
    return "clamp(1.82rem, 3.85vw, 4.15rem)";
  }

  return "clamp(2.6rem, 5.4vw, 5.8rem)";
}

function getKanaFontSize(length: number) {
  if (length >= 30) {
    return "clamp(0.72rem, 1.05vw, 1.02rem)";
  }

  if (length >= 24) {
    return "clamp(0.82rem, 1.22vw, 1.12rem)";
  }

  if (length >= 18) {
    return "clamp(0.94rem, 1.42vw, 1.26rem)";
  }

  if (length >= 12) {
    return "clamp(1rem, 1.58vw, 1.38rem)";
  }

  return "clamp(1.08rem, 1.75vw, 1.5rem)";
}

function getPromptFontSizes(prompt: TypingPrompt): PromptFontSizes {
  const longestGuideLength = Math.max(prompt.reading.length, getRomajiGuideLength(prompt.reading));

  return {
    kana: getKanaFontSize(Array.from(prompt.reading).length),
    japanese: getJapaneseFontSize(Array.from(prompt.text).length),
    romaji: getWordFontSize(longestGuideLength)
  };
}

function getComboEffectStep(combo: number) {
  return Math.floor(Math.max(0, combo) / 2);
}

function getAttackIntensity(combo: number) {
  return Math.min(getComboEffectStep(combo) / 12, 1);
}

function getShurikenCount(combo: number) {
  return Math.min(MAX_SHURIKEN_COUNT, Math.max(1, Math.floor(Math.max(0, combo) / 3) + 1));
}

function getHitBurstCount(combo: number) {
  return 1 + Math.min(getComboEffectStep(combo), 6);
}

function getTypingExtraSlashCount(combo: number) {
  return Math.min(Math.floor(getComboEffectStep(combo) / 3), 2);
}

function normalizePlayerSettings(value: unknown): PlayerSettings {
  if (!value || typeof value !== "object") {
    return defaultPlayerSettings;
  }

  const parsed = value as Partial<Record<keyof PlayerSettings, unknown>>;
  const promptLayout =
    parsed.promptLayout === "promptTop" || parsed.promptLayout === "stageTop"
      ? parsed.promptLayout
      : defaultPlayerSettings.promptLayout;

  return {
    promptLayout,
    comboEffects: typeof parsed.comboEffects === "boolean" ? parsed.comboEffects : defaultPlayerSettings.comboEffects,
    kanaProgress: typeof parsed.kanaProgress === "boolean" ? parsed.kanaProgress : defaultPlayerSettings.kanaProgress,
    textProgress: typeof parsed.textProgress === "boolean" ? parsed.textProgress : defaultPlayerSettings.textProgress,
    romajiAutoScroll: typeof parsed.romajiAutoScroll === "boolean" ? parsed.romajiAutoScroll : defaultPlayerSettings.romajiAutoScroll,
    nextPromptPreview: typeof parsed.nextPromptPreview === "boolean" ? parsed.nextPromptPreview : defaultPlayerSettings.nextPromptPreview,
    screenShake: typeof parsed.screenShake === "boolean" ? parsed.screenShake : defaultPlayerSettings.screenShake,
    comboCallouts: typeof parsed.comboCallouts === "boolean" ? parsed.comboCallouts : defaultPlayerSettings.comboCallouts
  };
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
    (kind: AudioKind, combo = 0) => {
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

      if (kind === "finisher") {
        const tier = Math.min(4, Math.max(1, Math.floor(combo / 5)));
        const isFirstTier = tier === 1;

        oscillator.type = isFirstTier ? "sine" : "triangle";
        oscillator.frequency.setValueAtTime(isFirstTier ? 360 : 260 + tier * 34, now);
        oscillator.frequency.exponentialRampToValueAtTime(isFirstTier ? 620 : 900 + tier * 120, now + 0.1);
        oscillator.frequency.exponentialRampToValueAtTime(isFirstTier ? 420 : 360 + tier * 44, now + 0.22);
        gain.gain.setValueAtTime(isFirstTier ? 0.038 : 0.056 + tier * 0.01, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        oscillator.start(now);
        oscillator.stop(now + 0.27);

        const blade = context.createOscillator();
        const bladeGain = context.createGain();
        blade.connect(bladeGain);
        bladeGain.connect(context.destination);
        blade.type = "triangle";
        blade.frequency.setValueAtTime(isFirstTier ? 860 : 1160 + tier * 130, now + 0.04);
        blade.frequency.exponentialRampToValueAtTime(isFirstTier ? 520 : 500 + tier * 44, now + 0.2);
        bladeGain.gain.setValueAtTime(isFirstTier ? 0.032 : 0.052 + tier * 0.011, now + 0.04);
        bladeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        blade.start(now + 0.04);
        blade.stop(now + 0.26);

        const impact = context.createOscillator();
        const impactGain = context.createGain();
        impact.connect(impactGain);
        impactGain.connect(context.destination);
        impact.type = "sine";
        impact.frequency.setValueAtTime(isFirstTier ? 118 : 92 + tier * 10, now + 0.12);
        impact.frequency.exponentialRampToValueAtTime(isFirstTier ? 82 : 54 + tier * 4, now + 0.32);
        impactGain.gain.setValueAtTime(isFirstTier ? 0.032 : 0.058 + tier * 0.011, now + 0.12);
        impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
        impact.start(now + 0.12);
        impact.stop(now + 0.36);

        if (tier >= 2) {
          const spark = context.createOscillator();
          const sparkGain = context.createGain();
          spark.connect(sparkGain);
          sparkGain.connect(context.destination);
          spark.type = "sine";
          spark.frequency.setValueAtTime(780 + tier * 120, now + 0.18);
          spark.frequency.exponentialRampToValueAtTime(1380 + tier * 160, now + 0.3);
          sparkGain.gain.setValueAtTime(0.028 + tier * 0.006, now + 0.18);
          sparkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
          spark.start(now + 0.18);
          spark.stop(now + 0.37);
        }

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

function KeyboardShortcutsPanel() {
  const shortcuts = [
    { key: "Enter / Space", label: "開始" },
    { key: "← →", label: "難易度" },
    { key: "1 2 3", label: "Easy / Normal / Hard" },
    { key: "S", label: "設定" },
    { key: "L", label: "ランキング" },
    { key: "P", label: "スコア" },
    { key: "H", label: "遊び方" },
    { key: "K", label: "操作" },
    { key: "A", label: "ログイン" },
    { key: "M", label: "効果音" },
    { key: "Esc / T", label: "タイトル" },
    { key: "R", label: "リトライ" }
  ];

  return (
    <div className="shortcut-panel" aria-label="キーボードショートカット">
      <span>KEYBOARD</span>
      <div>
        {shortcuts.map((shortcut) => (
          <p key={`${shortcut.key}-${shortcut.label}`}>
            <kbd>{shortcut.key}</kbd>
            <em>{shortcut.label}</em>
          </p>
        ))}
      </div>
    </div>
  );
}

function ControlsPanel() {
  return (
    <div className="controls-panel">
      <div>
        <p className="panel-kicker">Keyboard</p>
        <h2>操作</h2>
        <p className="controls-lead">マウスなしでも、ゲーム開始からリトライ、ランキング確認まで操作できます。</p>
      </div>
      <KeyboardShortcutsPanel />
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
        <h2>遊び方</h2>
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
          <h3>コンボで演出と倍率が上がる</h3>
          <p>連続で正解するとコンボが伸び、手裏剣や爆発の演出が強くなります。</p>
        </section>
        <section>
          <span>04</span>
          <h3>ランキングは難易度ごとに1人1件</h3>
          <p>会員登録すると最高記録を保存できます。記録更新時は自動で上書きされます。</p>
        </section>
      </div>
    </div>
  );
}

function ScoreGuidePanel() {
  return (
    <div className="score-guide-panel">
      <div>
        <p className="panel-kicker">Score System</p>
        <h2>スコア計算</h2>
        <p className="score-guide-lead">長いお題を正確に打ち切り、コンボをつなぐほど大きく伸びます。ミスを減らして連撃を続けるのが高得点への近道です。</p>
      </div>

      <div className="score-formula-card">
        <span>POINT</span>
        <strong>お題の長さ + 難易度ボーナス + コンボボーナスで加点</strong>
      </div>

      <div className="score-guide-grid">
        <section>
          <span>01</span>
          <h3>基本点</h3>
          <p>読みの空白を除いた文字数が長いほど高くなります。短い単語より、長い文章の方が大きく伸びます。</p>
          <em>長いお題ほど高得点</em>
        </section>
        <section>
          <span>02</span>
          <h3>難易度倍率</h3>
          <p>NormalとHardは時間が長く、1問あたりの得点も高めです。ランキングは難易度ごとに分かれています。</p>
          <em>Easy 標準 / Normal 高め / Hard さらに高め</em>
        </section>
        <section>
          <span>03</span>
          <h3>コンボ倍率</h3>
          <p>1コンボごとに+10%。最大で+400%まで伸びます。ミスするとコンボは0に戻ります。</p>
          <em>つなぐほど一気に伸びる</em>
        </section>
        <section>
          <span>04</span>
          <h3>ランキングの並び順</h3>
          <p>スコアが高い順に表示され、同点の場合は正確率、最大コンボの順で上位になります。</p>
          <em>Score → Accuracy → Max Combo</em>
        </section>
      </div>
    </div>
  );
}

function SettingsSwitch({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`settings-switch ${checked ? "settings-switch-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span />
      <em>{checked ? "ON" : "OFF"}</em>
    </button>
  );
}

function SettingsPanel({
  settings,
  soundEnabled,
  onSettingChange,
  onPromptLayoutChange,
  onSoundChange
}: {
  settings: PlayerSettings;
  soundEnabled: boolean;
  onSettingChange: (key: BooleanPlayerSettingKey, value: boolean) => void;
  onPromptLayoutChange: (value: PromptLayout) => void;
  onSoundChange: (enabled: boolean) => void;
}) {
  return (
    <div className="settings-panel">
      <div className="settings-header">
        <span>PLAY STYLE</span>
        <h2>設定</h2>
        <p>演出の強さや入力位置の見せ方を、自分の集中しやすい形に調整できます。</p>
      </div>

      <div className="settings-featured">
        <div>
          <span>DISPLAY ORDER</span>
          <strong>お題と演出の上下</strong>
          <p>
            「演出が上」忍者と敵の動きを画面上部に見せる標準配置。「お題が上」お題とローマ字を演出より上へ移動します。
          </p>
        </div>
        <div className="layout-choice-group" role="radiogroup" aria-label="お題と演出の表示順">
          <button
            type="button"
            role="radio"
            aria-checked={settings.promptLayout === "stageTop"}
            className={settings.promptLayout === "stageTop" ? "layout-choice-active" : ""}
            onClick={() => onPromptLayoutChange("stageTop")}
          >
            <span>演出が上</span>
            <em>標準</em>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={settings.promptLayout === "promptTop"}
            className={settings.promptLayout === "promptTop" ? "layout-choice-active" : ""}
            onClick={() => onPromptLayoutChange("promptTop")}
          >
            <span>お題が上</span>
            <em>読み優先</em>
          </button>
        </div>
      </div>

      <div className="settings-list">
        <div className="settings-row">
          <div>
            <strong>効果音</strong>
            <p>タイプ音、撃破音、ボタン音などを鳴らします。</p>
          </div>
          <SettingsSwitch checked={soundEnabled} label="効果音" onChange={onSoundChange} />
        </div>

        {playerSettingRows.map((item) => (
          <div className="settings-row" key={item.key}>
            <div>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
            <SettingsSwitch checked={Boolean(settings[item.key])} label={item.title} onChange={(checked) => onSettingChange(item.key, checked)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function NinjaFigure({ combo }: { combo: number }) {
  const comboStep = getComboEffectStep(combo);
  const aura = getAttackIntensity(combo);
  const tierClass = comboStep >= 9 ? "ninja-tier-legend" : comboStep >= 5 ? "ninja-tier-hot" : comboStep >= 1 ? "ninja-tier-warm" : "";

  return (
    <motion.div
      className={`ninja-wrap ${tierClass}`}
      animate={{ y: [0, -5 - aura * 5, 0], rotate: [0, -aura * 1.6, aura * 1.6, 0] }}
      transition={{ duration: Math.max(1.45, 2.6 - aura * 0.9), repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.div
        className="ninja-aura"
        animate={{
          opacity: 0.28 + aura * 0.5,
          scale: 1 + aura * 0.28,
          rotate: 360 * aura
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
      className={`enemy-wrap ${config.boss ? "enemy-boss" : ""}`}
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
      data-romaji-index={index}
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

function getTextProgress(text: string, reading: string, readingProgress: ReadingProgress, readingParts?: string[]): ReadingProgress {
  const spans = buildTextReadingSpans(text, reading, readingParts);
  const textLength = spans.length;

  if (textLength === 0) {
    return {
      completed: 0,
      activeStart: 0,
      activeEnd: 0
    };
  }

  const activeIndex = spans.findIndex(
    (span) => readingProgress.activeStart >= span.readingStart && readingProgress.activeStart < span.readingEnd
  );

  if (activeIndex === -1) {
    return {
      completed: spans.filter((span) => span.readingEnd <= readingProgress.completed).length,
      activeStart: textLength,
      activeEnd: textLength
    };
  }

  return {
    completed: spans.filter((span) => span.readingEnd <= readingProgress.completed).length,
    activeStart: activeIndex,
    activeEnd: activeIndex + 1
  };
}

function buildTextReadingSpans(text: string, reading: string, readingParts?: string[]) {
  const textChars = Array.from(text);
  const normalizedReading = toHiragana(reading);
  const explicitSpans = buildExplicitReadingSpans(textChars, readingParts);

  if (explicitSpans) {
    return explicitSpans;
  }

  const spans: Array<{ readingStart: number; readingEnd: number }> = [];
  let textIndex = 0;
  let readingIndex = 0;

  while (textIndex < textChars.length) {
    const override = findReadingOverride(textChars, textIndex, normalizedReading, readingIndex);

    if (override) {
      for (const part of override.readings) {
        const readingStart = readingIndex;
        readingIndex += part.length;
        spans.push({ readingStart, readingEnd: readingIndex });
      }

      textIndex += override.length;
      continue;
    }

    const charReading = getLiteralReading(textChars[textIndex]);

    if (charReading && normalizedReading.startsWith(charReading, readingIndex)) {
      spans.push({ readingStart: readingIndex, readingEnd: readingIndex + charReading.length });
      readingIndex += charReading.length;
      textIndex += 1;
      continue;
    }

    const runStart = textIndex;
    const runChars: string[] = [];

    while (textIndex < textChars.length && !getLiteralReading(textChars[textIndex])) {
      runChars.push(textChars[textIndex]);
      textIndex += 1;
    }

    const nextLiteral = textIndex < textChars.length ? getLiteralReading(textChars[textIndex]) : "";
    const nextLiteralIndex = nextLiteral ? normalizedReading.indexOf(nextLiteral, readingIndex) : -1;
    const runReadingEnd = nextLiteralIndex >= readingIndex ? nextLiteralIndex : normalizedReading.length;
    const parts = distributeReading(normalizedReading.slice(readingIndex, runReadingEnd), runChars.length);

    for (let index = 0; index < runChars.length; index += 1) {
      const part = parts[index] ?? "";
      const readingStart = readingIndex;
      readingIndex += part.length;
      spans[runStart + index] = { readingStart, readingEnd: Math.max(readingStart + 1, readingIndex) };
    }
  }

  return spans.map((span) => span ?? { readingStart: normalizedReading.length, readingEnd: normalizedReading.length });
}

function buildExplicitReadingSpans(textChars: string[], readingParts?: string[]) {
  if (!readingParts || readingParts.length !== textChars.length) {
    return null;
  }

  let readingIndex = 0;

  return readingParts.map((part) => {
    const normalizedPart = toHiragana(part);
    const readingStart = readingIndex;
    readingIndex += normalizedPart.length;

    return {
      readingStart,
      readingEnd: readingIndex
    };
  });
}

function findReadingOverride(textChars: string[], textIndex: number, reading: string, readingIndex: number) {
  for (const override of TEXT_READING_OVERRIDES) {
    const overrideChars = Array.from(override.text);

    if (overrideChars.some((char, index) => textChars[textIndex + index] !== char)) {
      continue;
    }

    const normalizedParts = override.readings.map((part) => toHiragana(part));

    if (reading.startsWith(normalizedParts.join(""), readingIndex)) {
      return {
        length: overrideChars.length,
        readings: normalizedParts
      };
    }
  }

  return null;
}

function getLiteralReading(char: string) {
  if (/[\u3041-\u3096]/.test(char)) {
    return char;
  }

  if (/[\u30a1-\u30f6]/.test(char) || char === "ー") {
    return toHiragana(char);
  }

  if (char === " ") {
    return " ";
  }

  return "";
}

function splitReadingUnits(value: string) {
  const units: string[] = [];

  for (const char of Array.from(value)) {
    if ((smallKana.has(char) || char === "ー") && units.length > 0) {
      units[units.length - 1] += char;
      continue;
    }

    units.push(char);
  }

  return units;
}

function distributeReading(reading: string, textLength: number) {
  if (textLength <= 0) {
    return [];
  }

  const units = splitReadingUnits(reading);

  if (textLength === 1) {
    return [reading || " "];
  }

  const parts: string[] = [];
  let unitIndex = 0;

  for (let index = 0; index < textLength; index += 1) {
    const remainingChars = textLength - index;
    const remainingUnits = units.length - unitIndex;
    const take = index === textLength - 1 ? remainingUnits : Math.max(1, Math.floor(remainingUnits / remainingChars));
    parts.push(units.slice(unitIndex, unitIndex + take).join(""));
    unitIndex += take;
  }

  return parts;
}

function renderPromptProgress(value: string, progress: ReadingProgress, variant: "kana" | "text", isWrong: boolean) {
  return Array.from(value).map((char, index) => {
    const completed = index < progress.completed;
    const active = index === progress.activeStart;
    const displayChar = char === " " ? SPACE_MARK : char;

    return (
      <span
        key={`${variant}-${char}-${index}`}
        className={[
          "prompt-char",
          `prompt-char-${variant}`,
          completed ? "prompt-char-complete" : "",
          active && !completed ? "prompt-char-active" : "",
          active && isWrong ? "prompt-char-wrong" : ""
        ].join(" ")}
      >
        {displayChar}
      </span>
    );
  });
}

export function NinjaTypingGame() {
  const [status, setStatus] = useState<GameStatus>("idle");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [currentPrompt, setCurrentPrompt] = useState(() => pickWord("normal"));
  const [nextPrompt, setNextPrompt] = useState(() => pickWord("normal"));
  const [promptFontSizes, setPromptFontSizes] = useState(() => getPromptFontSizes(currentPrompt));
  const [input, setInput] = useState("");
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [timeLeft, setTimeLeft] = useState(DIFFICULTIES.normal.durationSeconds);
  const [bestScore, setBestScore] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>(defaultPlayerSettings);
  const [effects, setEffects] = useState<VisualEffect[]>([]);
  const [wrongIndex, setWrongIndex] = useState<number | null>(null);
  const [enemyHit, setEnemyHit] = useState(false);
  const [enemyConfig, setEnemyConfig] = useState(() => createEnemyConfig(0));
  const [attackId, setAttackId] = useState(0);
  const [attackCombo, setAttackCombo] = useState(0);
  const [finisherEffect, setFinisherEffect] = useState<FinisherEffect | null>(null);
  const [romajiOffset, setRomajiOffset] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [lastRunWasBest, setLastRunWasBest] = useState(false);
  const [leaderboardDifficulty, setLeaderboardDifficulty] = useState<Difficulty>("normal");
  const [submittedLeaderboardId, setSubmittedLeaderboardId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState("");
  const [unlockedRankIds, setUnlockedRankIds] = useState<string[]>([]);
  const [appScale, setAppScale] = useState(1);
  const endAtRef = useRef(0);
  const metricsRef = useRef(metrics);
  const statusRef = useRef(status);
  const effectIdRef = useRef(0);
  const shareLockRef = useRef(0);
  const finishedAtRef = useRef(0);
  const romajiViewportRef = useRef<HTMLDivElement | null>(null);
  const romajiTrackRef = useRef<HTMLDivElement | null>(null);
  const audio = useNinjaAudio(soundEnabled);

  const gameDurationSeconds = DIFFICULTIES[difficulty].durationSeconds;
  const accuracy = useMemo(() => calculateAccuracy(metrics.correctKeys, metrics.totalKeys), [metrics.correctKeys, metrics.totalKeys]);
  const cpm = useMemo(() => calculateCpm(metrics.totalKeys, gameDurationSeconds), [gameDurationSeconds, metrics.totalKeys]);
  const rank = useMemo(() => getRank(metrics.score), [metrics.score]);
  const romajiGuide = useMemo(() => getRomajiGuideForInput(currentPrompt.reading, input), [currentPrompt.reading, input]);
  const readingProgress = useMemo(() => getReadingProgress(currentPrompt.reading, romajiGuide, input), [currentPrompt.reading, input, romajiGuide]);
  const textProgress = useMemo(
    () => getTextProgress(currentPrompt.text, currentPrompt.reading, readingProgress, currentPrompt.readingParts),
    [currentPrompt.reading, currentPrompt.readingParts, currentPrompt.text, readingProgress]
  );
  const activeRomajiIndex = Math.min(input.length, Math.max(romajiGuide.length - 1, 0));
  const comboCallout = playerSettings.comboCallouts ? getComboCallout(metrics.combo) : "";
  const comboEffectStep = playerSettings.comboEffects ? getComboEffectStep(metrics.combo) : 0;
  const auraClass = comboEffectStep >= 9 ? "combo-legend" : comboEffectStep >= 5 ? "combo-hot" : comboEffectStep >= 1 ? "combo-warm" : "";
  const activeShurikenCount = playerSettings.comboEffects ? getShurikenCount(attackCombo) : 1;
  const attackIntensity = playerSettings.comboEffects ? getAttackIntensity(attackCombo) : 0;
  const visibleReadingProgress = playerSettings.kanaProgress ? readingProgress : disabledProgress;
  const visibleTextProgress = playerSettings.textProgress ? textProgress : disabledProgress;
  const appDesignHeight = APP_DESIGN_HEIGHTS[status];
  const appRootStyle = useMemo<AppRootStyle>(
    () => ({
      "--app-scale": appScale,
      "--app-design-height": `${appDesignHeight}px`
    }),
    [appDesignHeight, appScale]
  );

  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateAppScale = () => {
      const horizontalRoom = Math.max(1, window.innerWidth - 6);
      const verticalRoom = Math.max(1, window.innerHeight - 6);
      const fitScale = Math.min(horizontalRoom / APP_DESIGN_WIDTH, verticalRoom / APP_DESIGN_HEIGHTS[statusRef.current]);
      setAppScale(Number(Math.min(1.04, fitScale).toFixed(4)));
    };

    updateAppScale();
    window.addEventListener("resize", updateAppScale);

    return () => window.removeEventListener("resize", updateAppScale);
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const horizontalRoom = Math.max(1, window.innerWidth - 6);
    const verticalRoom = Math.max(1, window.innerHeight - 6);
    const fitScale = Math.min(horizontalRoom / APP_DESIGN_WIDTH, verticalRoom / appDesignHeight);
    setAppScale(Number(Math.min(1.04, fitScale).toFixed(4)));
  }, [appDesignHeight]);

  useEffect(() => {
    if (status !== "idle" || typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedSettings = window.localStorage.getItem(PLAYER_SETTINGS_KEY);
    const savedSound = window.localStorage.getItem(SOUND_SETTINGS_KEY);

    if (savedSettings) {
      try {
        setPlayerSettings(normalizePlayerSettings(JSON.parse(savedSettings)));
      } catch {
        setPlayerSettings(defaultPlayerSettings);
      }
    }

    if (savedSound !== null) {
      setSoundEnabled(savedSound === "true");
    }
  }, []);

  useEffect(() => {
    setPromptFontSizes(getPromptFontSizes(currentPrompt));
  }, [currentPrompt]);

  useLayoutEffect(() => {
    const viewport = romajiViewportRef.current;
    const track = romajiTrackRef.current;

    if (!playerSettings.romajiAutoScroll) {
      setRomajiOffset(0);
      return;
    }

    if (!viewport || !track) {
      return;
    }

    const updateOffset = () => {
      const viewportWidth = viewport.clientWidth;
      const trackWidth = track.scrollWidth;
      const activeChar = track.querySelector<HTMLElement>(`[data-romaji-index="${activeRomajiIndex}"]`);
      const viewportStyle = window.getComputedStyle(viewport);
      const paddingLeft = Number.parseFloat(viewportStyle.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(viewportStyle.paddingRight) || 0;

      if (!activeChar || trackWidth <= viewportWidth) {
        setRomajiOffset(0);
        return;
      }

      const endGutter = Math.max(28, paddingRight + activeChar.offsetWidth * 0.75);
      const startGutter = Math.max(12, paddingLeft * 0.5);
      const scrollableWidth = Math.max(1, viewportWidth - startGutter - endGutter);
      const activeCenter = activeChar.offsetLeft + activeChar.offsetWidth / 2;
      const targetCenter = startGutter + scrollableWidth * 0.48;
      const minOffset = viewportWidth - trackWidth - endGutter;
      const nextOffset = Math.round(Math.min(0, Math.max(minOffset, targetCenter - activeCenter)));

      setRomajiOffset(nextOffset);
    };

    updateOffset();
    window.addEventListener("resize", updateOffset);

    return () => window.removeEventListener("resize", updateOffset);
  }, [activeRomajiIndex, playerSettings.romajiAutoScroll, promptFontSizes.romaji, romajiGuide]);

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

    setEffects((previous) => [...previous.slice(-(MAX_ACTIVE_EFFECTS - 1)), effect]);
    window.setTimeout(() => {
      setEffects((previous) => previous.filter((item) => item.id !== id));
    }, type === "hit" ? 760 : 360);
  }, []);

  const triggerFinisherEffect = useCallback((combo: number, position: Pick<FinisherEffect, "left" | "top">) => {
    const id = effectIdRef.current + 1;
    effectIdRef.current = id;

    setFinisherEffect({
      id,
      combo,
      left: position.left,
      top: position.top
    });

    window.setTimeout(() => {
      setFinisherEffect((current) => (current?.id === id ? null : current));
    }, 560);
  }, []);

  const finishGame = useCallback(() => {
    if (statusRef.current !== "playing") {
      return;
    }

    statusRef.current = "finished";
    finishedAtRef.current = Date.now();
    const finalScore = metricsRef.current.score;

    setStatus("finished");
    setLeaderboardDifficulty(difficulty);
    setIsResolving(false);
    setInput("");
    setEnemyHit(false);
    setFinisherEffect(null);
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

  const savePlayerSettings = useCallback((next: PlayerSettings) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(next));
    }
  }, []);

  const updatePlayerSetting = useCallback((key: BooleanPlayerSettingKey, value: boolean) => {
    setPlayerSettings((previous) => {
      const next = { ...previous, [key]: value } as PlayerSettings;
      savePlayerSettings(next);

      return next;
    });
  }, [savePlayerSettings]);

  const updatePromptLayout = useCallback((value: PromptLayout) => {
    setPlayerSettings((previous) => {
      const next = { ...previous, promptLayout: value };
      savePlayerSettings(next);

      return next;
    });
  }, [savePlayerSettings]);

  const updateSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(SOUND_SETTINGS_KEY, String(enabled));
    }
  }, []);

  const toggleSoundEnabled = useCallback(() => {
    setSoundEnabled((previous) => {
      const next = !previous;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(SOUND_SETTINGS_KEY, String(next));
      }

      return next;
    });
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
    const durationSeconds = DIFFICULTIES[difficulty].durationSeconds;

    statusRef.current = "playing";
    finishedAtRef.current = 0;
    setStatus("playing");
    setCurrentPrompt(firstPrompt);
    setNextPrompt(queuedPrompt);
    setPromptFontSizes(getPromptFontSizes(firstPrompt));
    setInput("");
    setMetrics(initialMetrics);
    setTimeLeft(durationSeconds);
    setEffects([]);
    setWrongIndex(null);
    setEnemyHit(false);
    setEnemyConfig((value) => createEnemyConfig(value.id + 1));
    setFinisherEffect(null);
    setAttackId(0);
    setAttackCombo(0);
    setRomajiOffset(0);
    setIsResolving(false);
    setScreenShake(false);
    setLastRunWasBest(false);
    setSubmittedLeaderboardId(null);
    setLeaderboardDifficulty(difficulty);
    endAtRef.current = Date.now() + durationSeconds * 1000;
    audio.play("start");
    audio.startAmbient();
  }, [audio, currentPrompt, difficulty]);

  const returnToTitle = useCallback(() => {
    audio.stopAmbient();
    statusRef.current = "idle";
    finishedAtRef.current = 0;
    setStatus("idle");
    setTimeLeft(DIFFICULTIES[difficulty].durationSeconds);
    setInput("");
    setAttackCombo(0);
    setRomajiOffset(0);
    setIsResolving(false);
    setWrongIndex(null);
    setEnemyHit(false);
    setFinisherEffect(null);
  }, [audio, difficulty]);

  const openLeaderboard = useCallback(
    (selectedDifficulty: Difficulty = difficulty) => {
      audio.stopAmbient();
      statusRef.current = "leaderboard";
      setLeaderboardDifficulty(selectedDifficulty);
      setStatus("leaderboard");
      setInput("");
      setRomajiOffset(0);
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
    setRomajiOffset(0);
    setIsResolving(false);
    setWrongIndex(null);
    setEnemyHit(false);
  }, [audio]);

  const openHelp = useCallback(() => {
    audio.stopAmbient();
    statusRef.current = "help";
    setStatus("help");
    setInput("");
    setRomajiOffset(0);
    setIsResolving(false);
    setWrongIndex(null);
    setEnemyHit(false);
  }, [audio]);

  const openScoreGuide = useCallback(() => {
    audio.stopAmbient();
    statusRef.current = "score";
    setStatus("score");
    setInput("");
    setRomajiOffset(0);
    setIsResolving(false);
    setWrongIndex(null);
    setEnemyHit(false);
  }, [audio]);

  const openControls = useCallback(() => {
    audio.stopAmbient();
    statusRef.current = "controls";
    setStatus("controls");
    setInput("");
    setRomajiOffset(0);
    setIsResolving(false);
    setWrongIndex(null);
    setEnemyHit(false);
  }, [audio]);

  const openSettings = useCallback(() => {
    audio.stopAmbient();
    statusRef.current = "settings";
    setStatus("settings");
    setInput("");
    setRomajiOffset(0);
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
    (completedPrompt: TypingPrompt, comboValue: number) => {
      const incomingPrompt = nextPrompt.text === completedPrompt.text ? pickWord(difficulty, completedPrompt) : nextPrompt;

      setIsResolving(true);
      setScreenShake(true);
      setAttackId((value) => value + 1);
      setAttackCombo(comboValue);
      const milestoneCombo = playerSettings.comboEffects && comboValue > 0 && comboValue % 5 === 0;

      if (milestoneCombo) {
        triggerFinisherEffect(comboValue, {
          left: enemyConfig.left,
          top: enemyConfig.top
        });
        audio.play("finisher", comboValue);
      } else {
        audio.play("clear");
      }

      setCurrentPrompt(incomingPrompt);
      setNextPrompt(pickWord(difficulty, incomingPrompt));
      setPromptFontSizes(getPromptFontSizes(incomingPrompt));
      setInput("");
      setRomajiOffset(0);
      setWrongIndex(null);

      window.setTimeout(() => {
        if (statusRef.current !== "playing") {
          return;
        }

        setIsResolving(false);
      }, 40);

      window.setTimeout(() => {
        if (statusRef.current !== "playing") {
          return;
        }

        setEnemyHit(true);
        const burstCount = playerSettings.comboEffects ? getHitBurstCount(comboValue) : 1;

        for (let index = 0; index < burstCount; index += 1) {
          const spread = index - (burstCount - 1) / 2;

          addEffect("hit", {
            left: enemyConfig.left + spread * 2.4 + (Math.random() - 0.5) * 1.2,
            top: enemyConfig.top + (Math.random() - 0.5) * 7
          });
        }

        const finishSlashCount = playerSettings.comboEffects ? Math.min(getComboEffectStep(comboValue), 5) : 0;
        const totalSlashCount = finishSlashCount + (milestoneCombo ? 3 : 0);

        for (let index = 0; index < totalSlashCount; index += 1) {
          const angle = (Math.PI * 2 * index) / Math.max(1, totalSlashCount);

          addEffect("slash", {
            left: enemyConfig.left + Math.cos(angle) * (milestoneCombo ? 12 : 8),
            top: enemyConfig.top + Math.sin(angle) * (milestoneCombo ? 12 : 8)
          });
        }

        audio.play("hit");
      }, 210);

      window.setTimeout(() => {
        setScreenShake(false);
      }, 160);

      window.setTimeout(() => {
        if (statusRef.current !== "playing") {
          return;
        }

        setEnemyHit(false);
        setEnemyConfig((value) => createEnemyConfig(value.id + 1, comboValue + 1));
      }, 390);
    },
    [addEffect, audio, difficulty, enemyConfig.left, enemyConfig.top, nextPrompt, playerSettings.comboEffects, triggerFinisherEffect]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (
          status === "playing" ||
          status === "finished" ||
          status === "leaderboard" ||
          status === "auth" ||
          status === "help" ||
          status === "settings" ||
          status === "score" ||
          status === "controls"
        ) {
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

      const isNativeInteractiveTarget =
        target instanceof HTMLButtonElement ||
        target instanceof HTMLAnchorElement ||
        (target instanceof HTMLElement && Boolean(target.closest("button, a")));

      if (isNativeInteractiveTarget && (event.key === "Enter" || event.key === " ")) {
        return;
      }

      const key = event.key.toLowerCase();

      if (status !== "playing" && key === "m") {
        event.preventDefault();
        toggleSoundEnabled();
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

        if (key === "l") {
          event.preventDefault();
          openLeaderboard();
        }

        if (key === "a") {
          event.preventDefault();
          openAuth();
        }

        if (key === "h") {
          event.preventDefault();
          openHelp();
        }

        if (key === "k") {
          event.preventDefault();
          openControls();
        }

        if (key === "s") {
          event.preventDefault();
          openSettings();
        }

        if (key === "p") {
          event.preventDefault();
          openScoreGuide();
        }

        if (key === "x") {
          event.preventDefault();
          openShareOnce(createGameShareUrl());
        }

        return;
      }

      if (status === "finished") {
        if (Date.now() - finishedAtRef.current < RESULT_SHORTCUT_GRACE_MS) {
          event.preventDefault();
          return;
        }

        if (event.key === "Enter" || event.key === " " || key === "r") {
          event.preventDefault();
          startGame();
          return;
        }

        if (key === "t") {
          event.preventDefault();
          returnToTitle();
          return;
        }

        if (key === "l") {
          event.preventDefault();
          openLeaderboard(difficulty);
          return;
        }

        if (key === "h") {
          event.preventDefault();
          openHelp();
          return;
        }

        if (key === "k") {
          event.preventDefault();
          openControls();
          return;
        }

        if (key === "p") {
          event.preventDefault();
          openScoreGuide();
          return;
        }

        if (key === "s") {
          event.preventDefault();
          openSettings();
          return;
        }

        if (key === "x") {
          event.preventDefault();
          openShareOnce(
            createScoreShareUrl({
              score: metrics.score,
              accuracy,
              maxCombo: metrics.maxCombo,
              difficulty: DIFFICULTIES[difficulty].label,
              rank: rank.title
            })
          );
          return;
        }

        return;
      }

      if (status !== "playing") {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          startGame();
          return;
        }

        if (key === "t") {
          event.preventDefault();
          returnToTitle();
          return;
        }

        if (key === "l") {
          event.preventDefault();
          openLeaderboard();
          return;
        }

        if (key === "a") {
          event.preventDefault();
          openAuth();
          return;
        }

        if (key === "h") {
          event.preventDefault();
          openHelp();
          return;
        }

        if (key === "k") {
          event.preventDefault();
          openControls();
          return;
        }

        if (key === "s") {
          event.preventDefault();
          openSettings();
          return;
        }

        if (key === "p") {
          event.preventDefault();
          openScoreGuide();
          return;
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

      if (isRomajiInputPrefix(currentPrompt.reading, nextInput)) {
        setInput(nextInput);
        setWrongIndex(null);
        addEffect("slash", getEnemySlashPosition(enemyConfig, enemyConfig.boss ? 13 : 9));

        const slashLevel = playerSettings.comboEffects ? getTypingExtraSlashCount(metricsRef.current.combo) : 0;

        for (let index = 0; index < slashLevel; index += 1) {
          if ((input.length + index) % 2 === 0) {
            addEffect("slash", getEnemySlashPosition(enemyConfig, enemyConfig.boss ? 18 : 12));
          }
        }

        audio.play("type");

        if (isRomajiInputComplete(currentPrompt.reading, nextInput)) {
          const completedCombo = metricsRef.current.combo + 1;

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
          completeWord(currentPrompt, completedCombo);
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
      accuracy,
      difficulty,
      enemyConfig,
      input,
      isResolving,
      metrics.maxCombo,
      metrics.score,
      returnToTitle,
      openLeaderboard,
      openAuth,
      openHelp,
      openControls,
      openScoreGuide,
      openSettings,
      openShareOnce,
      playerSettings.comboEffects,
      rank.title,
      selectDifficultyByOffset,
      startGame,
      status,
      toggleSoundEnabled
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const progress = Math.max(0, Math.min(100, (timeLeft / gameDurationSeconds) * 100));

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
    <main
      className={`app-root status-${status} min-h-screen overflow-x-hidden bg-[#05070f] text-slate-100 ${auraClass}`}
      style={appRootStyle}
      onPointerDownCapture={handleButtonPointerDown}
    >
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

      <div className="app-fit-viewport">
      <div className="app-fit-stage">
      <div className="app-shell">
        <aside className="ad-rail ad-rail-left" aria-label="広告スペース">
          <span>AD</span>
          <strong>広告スペース</strong>
        </aside>

        <div className={`app-content ${screenShake && playerSettings.screenShake ? "screen-shake" : ""}`}>
        <header className="app-header flex items-center justify-between gap-4">
          <div className="brand-block">
            <p className="text-xs font-semibold uppercase tracking-[0.38em] text-cyan-200/80">Cyber Shinobi Drill</p>
            <h1 className="brand-title mt-2 text-2xl font-black tracking-normal text-white sm:text-3xl">Ninja Typing / {JA_TITLE}</h1>
          </div>
          <div className="header-actions">
            {status !== "playing" ? (
              <button className="icon-button wide-icon-button settings-header-button" type="button" onClick={openSettings} aria-label="プレイ設定を開く">
                設定
              </button>
            ) : null}
            {status !== "playing" ? (
              <button className="icon-button wide-icon-button" type="button" onClick={() => openLeaderboard()} aria-label="ランキングを見る">
                ランキング
              </button>
            ) : null}
            {status !== "playing" ? (
              <button className="icon-button wide-icon-button" type="button" onClick={openScoreGuide} aria-label="スコア計算を見る">
                スコア
              </button>
            ) : null}
            {status !== "playing" ? (
              <button className="icon-button wide-icon-button" type="button" onClick={openHelp} aria-label="遊び方を見る">
                遊び方
              </button>
            ) : null}
            {status !== "playing" ? (
              <button className="icon-button wide-icon-button" type="button" onClick={openControls} aria-label="キーボード操作を見る">
                操作
              </button>
            ) : null}
            {status !== "playing" ? (
              <button className="icon-button account-header-button" type="button" onClick={openAuth} aria-label="会員登録またはログイン画面を開く">
                {session ? username || getFallbackUsername(session) : "会員登録 / ログイン"}
              </button>
            ) : null}
            <button
              className="icon-button"
              type="button"
              onClick={toggleSoundEnabled}
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
                <div className="title-kicker-row">
                  <p className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 shadow-neon-cyan">
                    {COPY.countdown}
                  </p>
                  <span className="version-badge" aria-label={`現在のバージョン ${GAME_VERSION}`}>
                    Release {GAME_VERSION}
                  </span>
                  <button className="settings-pill-button" type="button" onClick={openSettings} aria-label="プレイ設定を開く">
                    設定
                  </button>
                </div>
                <h2 className="hero-title">
                  <span className="hero-word-primary">{COPY.heroLine1}</span>
                  <span className="hero-divider">/</span>
                  <span className="hero-word-secondary">{COPY.heroLine2}</span>
                </h2>
                <p className="title-intro mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{COPY.intro}</p>
                <div className="title-info-row mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-300">
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
                            <small>{item.subtitle} / {item.durationSeconds}s</small>
                          </span>
                          <em>{item.description}</em>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="title-action-grid mt-7 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-6">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">最高スコア</span>
                    <p className="mt-1 text-3xl font-black text-amber-200">{bestScore.toLocaleString()}</p>
                  </div>
                  <button className="start-button" type="button" onClick={startGame} aria-label="ゲームを開始する">
                    開始
                  </button>
                  <button className="ghost-button compact-button" type="button" onClick={() => openLeaderboard(difficulty)} aria-label="選択中の難易度のランキングを見る">
                    ランキング
                  </button>
                  <button className="ghost-button compact-button" type="button" onClick={openScoreGuide} aria-label="スコア計算を見る">
                    スコア
                  </button>
                  <button className="ghost-button compact-button" type="button" onClick={openHelp} aria-label="遊び方を見る">
                    遊び方
                  </button>
                  <button className="ghost-button compact-button" type="button" onClick={openControls} aria-label="キーボード操作を見る">
                    操作
                  </button>
                  <button className="x-share-button compact-button" type="button" onClick={() => openShareOnce(createGameShareUrl())} aria-label="Ninja TypingをXで共有する">
                    <span className="x-logo" aria-hidden="true">X</span>
                    <span className="x-label">Xでポスト</span>
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

              <div className={`arena-panel ${playerSettings.promptLayout === "promptTop" ? "arena-prompt-top" : ""}`}>
                <div className="arena-topline">
                  <span>{DIFFICULTIES[difficulty].label} mode</span>
                  <span>Accuracy {accuracy}%</span>
                </div>

                <div className="stage">
                  <NinjaFigure combo={playerSettings.comboEffects ? metrics.combo : 0} />

                  <AnimatePresence>
                    {attackId > 0 ? (
                      Array.from({ length: activeShurikenCount }).map((_, index) => {
                        const normalizedSpread = activeShurikenCount <= 1 ? 0 : (index / (activeShurikenCount - 1) - 0.5) * 2;
                        const wave = Math.sin(index * 1.7) * 0.28;
                        const lane = normalizedSpread + wave;
                        const startTop = 52 + lane * 13;
                        const middleTop = Math.max(10, Math.min(78, enemyConfig.top - 13 + lane * 18));
                        const endTop = Math.max(12, Math.min(82, enemyConfig.top + lane * 9));
                        const middleLeft = Math.max(42, enemyConfig.left - 8 - Math.abs(lane) * 2.4);
                        const endLeft = enemyConfig.left + lane * 5.6;

                        return (
                          <motion.div
                            key={`${attackId}-${index}`}
                            className="shuriken"
                            initial={{
                              left: "21%",
                              top: `${startTop}%`,
                              rotate: lane * -80,
                              opacity: 0,
                              scale: 0.66 + attackIntensity * 0.12
                            }}
                            animate={{
                              left: ["21%", `${middleLeft}%`, `${endLeft}%`],
                              top: [`${startTop}%`, `${middleTop}%`, `${endTop}%`],
                              rotate: 1080 + attackIntensity * 900 + index * 160,
                              opacity: [0, 1, 1, 0],
                              scale: [0.66 + attackIntensity * 0.12, 1.02 + attackIntensity * 0.26, 0.78 + attackIntensity * 0.08]
                            }}
                            exit={{ opacity: 0 }}
                            transition={{
                              duration: Math.max(0.24, 0.37 - attackIntensity * 0.09),
                              delay: index * Math.max(0.006, 0.026 - attackIntensity * 0.012),
                              ease: "easeOut"
                            }}
                          >
                            <span />
                          </motion.div>
                        );
                      })
                    ) : null}
                  </AnimatePresence>

                  <EnemyFigure hit={enemyHit} config={enemyConfig} />

                  <AnimatePresence>
                    {finisherEffect ? (
                      <motion.div
                        key={finisherEffect.id}
                        className={`finisher-strike finisher-tier-${Math.min(4, Math.floor(finisherEffect.combo / 5))}`}
                        style={{
                          left: `${finisherEffect.left}%`,
                          top: `${finisherEffect.top}%`
                        }}
                        initial={{ opacity: 0, x: -260, y: 76, scale: 0.76 }}
                        animate={{
                          opacity: [0, 1, 1, 0],
                          x: [-260, -24, 18, 28],
                          y: [76, 4, -4, -8],
                          scale: [0.76, 1.05, 1.08, 1.02]
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.54, ease: "easeOut" }}
                      >
                        <span className="finisher-silhouette" />
                        <span className="finisher-blade" />
                        <strong>{finisherEffect.combo} COMBO</strong>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

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
                  <div className="combo-callout-lane" aria-live="polite">
                    <AnimatePresence>
                      {comboCallout ? (
                        <motion.div
                          key={`${comboCallout}-${metrics.combo}`}
                          className="combo-callout"
                          initial={{ opacity: 0, y: 10, scale: 0.82 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8 }}
                        >
                          {comboCallout}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  <div className="prompt-row">
                    <div className="prompt-stack current-prompt-card">
                      <div className="kana-guide" style={{ fontSize: promptFontSizes.kana }}>
                        {renderPromptProgress(currentPrompt.reading, visibleReadingProgress, "kana", playerSettings.kanaProgress && wrongIndex !== null)}
                      </div>
                      <div className="japanese-prompt" style={{ fontSize: promptFontSizes.japanese }}>
                        {renderPromptProgress(currentPrompt.text, visibleTextProgress, "text", playerSettings.textProgress && wrongIndex !== null)}
                      </div>
                    </div>
                    {playerSettings.nextPromptPreview ? (
                      <div className="next-prompt-preview">
                        <span>次のお題</span>
                        <strong>{nextPrompt.text}</strong>
                        <em>{nextPrompt.reading}</em>
                      </div>
                    ) : null}
                  </div>

                  <div ref={romajiViewportRef} className="word-display" aria-label={`Type ${romajiGuide}`} style={{ fontSize: promptFontSizes.romaji }}>
                    <div ref={romajiTrackRef} className="word-track" style={{ transform: `translateX(${romajiOffset}px)` }}>
                      {romajiGuide.split("").map((char, index) => renderChar(char, index, input, wrongIndex))}
                    </div>
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
                <div className="result-score-row">
                  <div className="retry-key-hint">
                    <kbd>R</kbd>
                    <span>もう一度プレイ</span>
                  </div>
                  <div className="result-score-main">
                    <h2>最終スコア {metrics.score.toLocaleString()}</h2>
                    <p>{lastRunWasBest ? COPY.bestUpdated : `Best ${bestScore.toLocaleString()} ${COPY.bestChase}`}</p>
                  </div>
                  <button
                    className="x-share-button x-share-button-result"
                    type="button"
                    aria-label="今回のスコアをXで共有する"
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
                    <span className="x-logo" aria-hidden="true">X</span>
                    <span className="x-label">結果をXでポスト</span>
                  </button>
                </div>
              </div>

              <div className="result-grid">
                <StatTile label="Accuracy" value={`${accuracy}%`} />
                <StatTile label="Max Combo" value={`x${metrics.maxCombo}`} accent="gold" />
                <StatTile label="CPM" value={cpm} accent="cyan" />
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
                  cpm={cpm}
                  difficulty={difficulty}
                  onSubmitted={handleLeaderboardSubmitted}
                />
                <Leaderboard initialDifficulty={leaderboardDifficulty} highlightId={submittedLeaderboardId} refreshToken={submittedLeaderboardId ?? metrics.score} />
              </div>

              <div className="result-actions">
                <button className="start-button" type="button" onClick={startGame} aria-label="もう一度プレイする">
                  もう一度
                </button>
                <button className="ghost-button" type="button" onClick={() => openLeaderboard(difficulty)} aria-label="ランキングを見る">
                  ランキング
                </button>
                <button className="ghost-button" type="button" onClick={returnToTitle} aria-label="タイトル画面へ戻る">
                  タイトル
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
                <button className="start-button" type="button" onClick={startGame} aria-label="ゲームを開始する">
                  Play
                </button>
                <button className="ghost-button" type="button" onClick={returnToTitle} aria-label="タイトル画面へ戻る">
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
                <button className="start-button" type="button" onClick={startGame} aria-label="ゲームを開始する">
                  Start
                </button>
                <button className="ghost-button" type="button" onClick={returnToTitle} aria-label="タイトル画面へ戻る">
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
                <button className="start-button" type="button" onClick={startGame} aria-label="ゲームを開始する">
                  Start
                </button>
                <button className="ghost-button" type="button" onClick={returnToTitle} aria-label="タイトル画面へ戻る">
                  タイトル
                </button>
              </div>
            </motion.section>
          ) : null}

          {status === "score" ? (
            <motion.section
              key="score"
              className="score-layout"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28 }}
            >
              <ScoreGuidePanel />
              <div className="result-actions">
                <button className="start-button" type="button" onClick={startGame} aria-label="ゲームを開始する">
                  Start
                </button>
                <button className="ghost-button" type="button" onClick={openHelp} aria-label="遊び方を見る">
                  遊び方
                </button>
                <button className="ghost-button" type="button" onClick={returnToTitle} aria-label="タイトル画面へ戻る">
                  タイトル
                </button>
              </div>
            </motion.section>
          ) : null}

          {status === "controls" ? (
            <motion.section
              key="controls"
              className="controls-layout"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28 }}
            >
              <ControlsPanel />
              <div className="result-actions">
                <button className="start-button" type="button" onClick={startGame} aria-label="ゲームを開始する">
                  Start
                </button>
                <button className="ghost-button" type="button" onClick={openHelp} aria-label="遊び方を見る">
                  遊び方
                </button>
                <button className="ghost-button" type="button" onClick={returnToTitle} aria-label="タイトル画面へ戻る">
                  タイトル
                </button>
              </div>
            </motion.section>
          ) : null}

          {status === "settings" ? (
            <motion.section
              key="settings"
              className="settings-layout"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28 }}
            >
              <SettingsPanel
                settings={playerSettings}
                soundEnabled={soundEnabled}
                onSettingChange={updatePlayerSetting}
                onPromptLayoutChange={updatePromptLayout}
                onSoundChange={updateSoundEnabled}
              />
              <div className="result-actions">
                <button className="start-button" type="button" onClick={startGame} aria-label="ゲームを開始する">
                  Start
                </button>
                <button className="ghost-button" type="button" onClick={returnToTitle} aria-label="タイトル画面へ戻る">
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
      </div>
      </div>
    </main>
  );
}
