const KANA_ROMAJI: Record<string, string[]> = {
  "\u3042": ["a"],
  "\u3044": ["i", "yi"],
  "\u3046": ["u", "wu"],
  "\u3048": ["e"],
  "\u304a": ["o"],
  "\u304b": ["ka", "ca"],
  "\u304d": ["ki"],
  "\u304f": ["ku", "cu", "qu"],
  "\u3051": ["ke"],
  "\u3053": ["ko", "co"],
  "\u304c": ["ga"],
  "\u304e": ["gi"],
  "\u3050": ["gu"],
  "\u3052": ["ge"],
  "\u3054": ["go"],
  "\u3055": ["sa"],
  "\u3057": ["si", "shi", "ci"],
  "\u3059": ["su"],
  "\u305b": ["se", "ce"],
  "\u305d": ["so"],
  "\u3056": ["za"],
  "\u3058": ["zi", "ji"],
  "\u305a": ["zu"],
  "\u305c": ["ze"],
  "\u305e": ["zo"],
  "\u305f": ["ta"],
  "\u3061": ["ti", "chi"],
  "\u3064": ["tu", "tsu"],
  "\u3066": ["te"],
  "\u3068": ["to"],
  "\u3060": ["da"],
  "\u3062": ["di", "ji"],
  "\u3065": ["du", "zu"],
  "\u3067": ["de"],
  "\u3069": ["do"],
  "\u306a": ["na"],
  "\u306b": ["ni"],
  "\u306c": ["nu"],
  "\u306d": ["ne"],
  "\u306e": ["no"],
  "\u306f": ["ha", "wa"],
  "\u3072": ["hi"],
  "\u3075": ["hu", "fu"],
  "\u3078": ["he", "e"],
  "\u307b": ["ho"],
  "\u3070": ["ba"],
  "\u3073": ["bi"],
  "\u3076": ["bu"],
  "\u3079": ["be"],
  "\u307c": ["bo"],
  "\u3071": ["pa"],
  "\u3074": ["pi"],
  "\u3077": ["pu"],
  "\u307a": ["pe"],
  "\u307d": ["po"],
  "\u307e": ["ma"],
  "\u307f": ["mi"],
  "\u3080": ["mu"],
  "\u3081": ["me"],
  "\u3082": ["mo"],
  "\u3084": ["ya"],
  "\u3086": ["yu"],
  "\u3088": ["yo"],
  "\u3089": ["ra"],
  "\u308a": ["ri"],
  "\u308b": ["ru"],
  "\u308c": ["re"],
  "\u308d": ["ro"],
  "\u308f": ["wa"],
  "\u3092": ["wo", "o"],
  "\u3093": ["n", "nn", "n'"],
  "\u3041": ["xa", "la"],
  "\u3043": ["xi", "li", "xyi", "lyi"],
  "\u3045": ["xu", "lu"],
  "\u3047": ["xe", "le"],
  "\u3049": ["xo", "lo"],
  "\u3083": ["xya", "lya"],
  "\u3085": ["xyu", "lyu"],
  "\u3087": ["xyo", "lyo"],
  "\u308e": ["xwa", "lwa"],
  "\u3063": ["xtu", "ltu", "xtsu"],
  "\u30fc": ["-"],
  " ": [" "]
};

const COMBO_ROMAJI: Record<string, string[]> = {
  "\u304d\u3083": ["kya"],
  "\u304d\u3085": ["kyu"],
  "\u304d\u3087": ["kyo"],
  "\u304e\u3083": ["gya"],
  "\u304e\u3085": ["gyu"],
  "\u304e\u3087": ["gyo"],
  "\u3057\u3083": ["sya", "sha", "sixya", "shixya", "cixya"],
  "\u3057\u3085": ["syu", "shu", "sixyu", "shixyu", "cixyu"],
  "\u3057\u3087": ["syo", "sho", "sixyo", "shixyo", "cixyo"],
  "\u3058\u3083": ["zya", "ja", "jya", "zixya", "jixya"],
  "\u3058\u3085": ["zyu", "ju", "jyu", "zixyu", "jixyu"],
  "\u3058\u3087": ["zyo", "jo", "jyo", "zixyo", "jixyo"],
  "\u3061\u3083": ["tya", "cha", "cya", "tixya", "chixya"],
  "\u3061\u3085": ["tyu", "chu", "cyu", "tixyu", "chixyu"],
  "\u3061\u3087": ["tyo", "cho", "cyo", "tixyo", "chixyo"],
  "\u3062\u3083": ["dya", "ja", "jya"],
  "\u3062\u3085": ["dyu", "ju", "jyu"],
  "\u3062\u3087": ["dyo", "jo", "jyo"],
  "\u306b\u3083": ["nya"],
  "\u306b\u3085": ["nyu"],
  "\u306b\u3087": ["nyo"],
  "\u3072\u3083": ["hya"],
  "\u3072\u3085": ["hyu"],
  "\u3072\u3087": ["hyo"],
  "\u3073\u3083": ["bya"],
  "\u3073\u3085": ["byu"],
  "\u3073\u3087": ["byo"],
  "\u3074\u3083": ["pya"],
  "\u3074\u3085": ["pyu"],
  "\u3074\u3087": ["pyo"],
  "\u307f\u3083": ["mya"],
  "\u307f\u3085": ["myu"],
  "\u307f\u3087": ["myo"],
  "\u308a\u3083": ["rya"],
  "\u308a\u3085": ["ryu"],
  "\u308a\u3087": ["ryo"],
  "\u3075\u3041": ["fa", "fwa", "huxa", "fuxa"],
  "\u3075\u3043": ["fi", "fwi", "huxi", "fuxi"],
  "\u3075\u3047": ["fe", "fwe", "huxe", "fuxe"],
  "\u3075\u3049": ["fo", "fwo", "huxo", "fuxo"],
  "\u3046\u3043": ["wi", "whi", "uxi"],
  "\u3046\u3047": ["we", "whe", "uxe"]
};

const CONSONANTS = new Set("bcdfghjklmpqrstvwxyz".split(""));

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function toHiragana(value: string) {
  return value.replace(/[\u30a1-\u30f6]/g, (char) => {
    if (char === "\u30fc") {
      return char;
    }

    return String.fromCharCode(char.charCodeAt(0) - 0x60);
  });
}

function leadingConsonant(value: string) {
  const first = value[0];

  if (!first || !CONSONANTS.has(first) || first === "n") {
    return "";
  }

  return first;
}

function combine(prefixes: string[], suffixes: string[]) {
  return prefixes.flatMap((prefix) => suffixes.map((suffix) => `${prefix}${suffix}`));
}

export function buildRomajiOptions(reading: string) {
  const source = toHiragana(reading.toLowerCase());
  const memo = new Map<number, string[]>();

  function build(index: number): string[] {
    if (index >= source.length) {
      return [""];
    }

    const cached = memo.get(index);

    if (cached) {
      return cached;
    }

    const char = source[index];

    if (char === "\u3063") {
      const suffixes = build(index + 1);
      const values = unique([
        ...combine(KANA_ROMAJI[char], suffixes),
        ...suffixes.map((suffix) => {
          const consonant = leadingConsonant(suffix);
          return consonant ? `${consonant}${suffix}` : suffix;
        })
      ]);

      memo.set(index, values);
      return values;
    }

    const pair = source.slice(index, index + 2);
    const suffixIndex = COMBO_ROMAJI[pair] ? index + 2 : index + 1;
    const prefixes = COMBO_ROMAJI[pair] ?? KANA_ROMAJI[char] ?? [char];
    const values = unique(combine(prefixes, build(suffixIndex)));
    memo.set(index, values);
    return values;
  }

  return build(0).sort((first, second) => first.length - second.length);
}

export function getRomajiGuide(candidates: string[], input: string) {
  return candidates.find((candidate) => candidate.startsWith(input)) ?? candidates[0] ?? "";
}
