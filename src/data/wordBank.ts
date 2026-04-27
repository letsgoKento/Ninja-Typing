export type Difficulty = "easy" | "normal" | "hard";

export type DifficultyConfig = {
  label: string;
  subtitle: string;
  description: string;
  multiplier: number;
  words: string[];
};

export const GAME_TIME_SECONDS = 60;

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: "Easy",
    subtitle: "\u77ed\u3044\u82f1\u5358\u8a9e",
    description: "\u30ea\u30ba\u30e0\u91cd\u8996\u3002\u30a6\u30a9\u30fc\u30e0\u30a2\u30c3\u30d7\u3084\u521d\u56de\u30d7\u30ec\u30a4\u5411\u3051\u3002",
    multiplier: 1,
    words: [
      "ninja",
      "moon",
      "dash",
      "slash",
      "smoke",
      "blade",
      "focus",
      "swift",
      "shadow",
      "strike",
      "silent",
      "castle",
      "bamboo",
      "kunai",
      "stealth",
      "shuriken",
      "spark",
      "guard",
      "storm",
      "honor"
    ]
  },
  normal: {
    label: "Normal",
    subtitle: "\u9577\u3081\u306e\u5358\u8a9e",
    description: "\u30b9\u30d4\u30fc\u30c9\u3068\u6b63\u78ba\u3055\u306e\u30d0\u30e9\u30f3\u30b9\u3092\u8a66\u3059\u6a19\u6e96\u30e2\u30fc\u30c9\u3002",
    multiplier: 1.25,
    words: [
      "midnight blade",
      "silent mission",
      "neon fortress",
      "rapid shuriken",
      "hidden passage",
      "crimson signal",
      "shadow training",
      "electric katana",
      "bamboo skyline",
      "smoke vanish",
      "perfect ambush",
      "moonlit rooftop",
      "cyber dojo",
      "stealth protocol",
      "victory stance",
      "focus breathing",
      "thunder step",
      "secret scroll"
    ]
  },
  hard: {
    label: "Hard",
    subtitle: "\u77ed\u6587\u30fb\u8a18\u53f7\u3042\u308a",
    description: "\u53e5\u8aad\u70b9\u3084\u8a18\u53f7\u307e\u3067\u542b\u3081\u305f\u3001\u96c6\u4e2d\u529b\u304c\u554f\u308f\u308c\u308b\u4e0a\u7d1a\u30e2\u30fc\u30c9\u3002",
    multiplier: 1.55,
    words: [
      "strike fast, fade faster.",
      "no noise. no mercy.",
      "hold shift + keep calm",
      "mission-04: rooftop entry",
      "combo x3? keep going!",
      "type clean; move unseen.",
      "silent code // sharp blade",
      "target locked: east gate",
      "dash, slash, vanish.",
      "never miss the final key.",
      "smoke out -> reset position",
      "shinobi.exe is online",
      "watch the cursor, then cut.",
      "accuracy beats panic.",
      "legend rank requires focus.",
      "moon gate opens at 00:00"
    ]
  }
};
