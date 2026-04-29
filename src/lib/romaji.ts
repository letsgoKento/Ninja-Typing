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
  "\u3092": ["wo"],
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

export function toHiragana(value: string) {
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

type RomajiSegment = {
  nextIndex: number;
  options: string[];
};

function getSegmentOptions(source: string, index: number): RomajiSegment {
  const char = source[index];

  if (char === "\u3063") {
    const nextSegment = index + 1 < source.length ? getSegmentOptions(source, index + 1) : null;
    const doubledConsonants = nextSegment
      ? unique(nextSegment.options.map((option) => leadingConsonant(option)).filter(Boolean))
      : [];

    return {
      nextIndex: index + 1,
      options: unique([...doubledConsonants, ...KANA_ROMAJI[char]])
    };
  }

  const pair = source.slice(index, index + 2);

  if (COMBO_ROMAJI[pair]) {
    return {
      nextIndex: index + 2,
      options: COMBO_ROMAJI[pair]
    };
  }

  return {
    nextIndex: index + 1,
    options: KANA_ROMAJI[char] ?? [char]
  };
}

function createRomajiSource(reading: string) {
  return toHiragana(reading.toLowerCase());
}

function canMatchPrefix(source: string, input: string) {
  const memo = new Set<string>();

  function match(index: number, inputIndex: number): boolean {
    if (inputIndex >= input.length) {
      return true;
    }

    if (index >= source.length) {
      return inputIndex === input.length;
    }

    const key = `${index}:${inputIndex}`;

    if (memo.has(key)) {
      return false;
    }

    memo.add(key);

    const segment = getSegmentOptions(source, index);
    const remaining = input.slice(inputIndex);

    return segment.options.some((option) => {
      if (option.startsWith(remaining)) {
        return true;
      }

      if (input.startsWith(option, inputIndex)) {
        return match(segment.nextIndex, inputIndex + option.length);
      }

      return false;
    });
  }

  return match(0, 0);
}

function canMatchComplete(source: string, input: string) {
  const memo = new Set<string>();

  function match(index: number, inputIndex: number): boolean {
    if (index >= source.length) {
      return inputIndex === input.length;
    }

    const key = `${index}:${inputIndex}`;

    if (memo.has(key)) {
      return false;
    }

    memo.add(key);

    const segment = getSegmentOptions(source, index);

    return segment.options.some((option) => {
      if (!input.startsWith(option, inputIndex)) {
        return false;
      }

      return match(segment.nextIndex, inputIndex + option.length);
    });
  }

  return match(0, 0);
}

function buildCanonicalGuide(source: string, index = 0): string {
  if (index >= source.length) {
    return "";
  }

  const segment = getSegmentOptions(source, index);
  const option = segment.options[0] ?? "";

  return `${option}${buildCanonicalGuide(source, segment.nextIndex)}`;
}

function buildGuideForInput(source: string, input: string) {
  const memo = new Set<string>();

  function build(index: number, inputIndex: number): string | null {
    if (inputIndex >= input.length) {
      return buildCanonicalGuide(source, index);
    }

    if (index >= source.length) {
      return inputIndex === input.length ? "" : null;
    }

    const key = `${index}:${inputIndex}`;

    if (memo.has(key)) {
      return null;
    }

    memo.add(key);

    const segment = getSegmentOptions(source, index);
    const remaining = input.slice(inputIndex);

    for (const option of segment.options) {
      if (option.startsWith(remaining)) {
        return `${remaining}${option.slice(remaining.length)}${buildCanonicalGuide(source, segment.nextIndex)}`;
      }

      if (input.startsWith(option, inputIndex)) {
        const rest = build(segment.nextIndex, inputIndex + option.length);

        if (rest !== null) {
          return `${option}${rest}`;
        }
      }
    }

    return null;
  }

  return build(0, 0) ?? buildCanonicalGuide(source);
}

function getMaxGuideLength(source: string) {
  const memo = new Map<number, number>();

  function measure(index: number): number {
    if (index >= source.length) {
      return 0;
    }

    const cached = memo.get(index);

    if (cached !== undefined) {
      return cached;
    }

    const segment = getSegmentOptions(source, index);
    const restLength = measure(segment.nextIndex);
    const maxLength = Math.max(...segment.options.map((option) => option.length + restLength));

    memo.set(index, maxLength);
    return maxLength;
  }

  return measure(0);
}

export function getRomajiGuideForInput(reading: string, input: string) {
  return buildGuideForInput(createRomajiSource(reading), input);
}

export function getRomajiGuideLength(reading: string) {
  return getMaxGuideLength(createRomajiSource(reading));
}

export function isRomajiInputPrefix(reading: string, input: string) {
  return canMatchPrefix(createRomajiSource(reading), input);
}

export function isRomajiInputComplete(reading: string, input: string) {
  return canMatchComplete(createRomajiSource(reading), input);
}

export function buildRomajiOptions(reading: string) {
  return [getRomajiGuideForInput(reading, "")];
}

export type ReadingProgress = {
  completed: number;
  activeStart: number;
  activeEnd: number;
};

function findMatchedOption(candidate: string, start: number, options: string[]) {
  return [...options]
    .sort((first, second) => second.length - first.length)
    .find((option) => candidate.startsWith(option, start)) ?? options[0] ?? "";
}

export function getReadingProgress(reading: string, guide: string, input: string): ReadingProgress {
  const source = toHiragana(reading.toLowerCase());
  const inputLength = input.length;
  let sourceIndex = 0;
  let romanIndex = 0;

  while (sourceIndex < source.length) {
    const segmentStart = sourceIndex;
    let segmentEnd = sourceIndex + 1;
    let romanEnd = romanIndex + 1;

    if (source[sourceIndex] === "\u3063") {
      const explicitSmallTsu = findMatchedOption(guide, romanIndex, KANA_ROMAJI[source[sourceIndex]]);

      if (explicitSmallTsu && guide.startsWith(explicitSmallTsu, romanIndex)) {
        romanEnd = romanIndex + explicitSmallTsu.length;
      } else {
        romanEnd = romanIndex + 1;
      }
    } else {
      const pair = source.slice(sourceIndex, sourceIndex + 2);
      const pairOptions = COMBO_ROMAJI[pair];

      if (pairOptions) {
        const option = findMatchedOption(guide, romanIndex, pairOptions);
        segmentEnd = sourceIndex + 2;
        romanEnd = romanIndex + option.length;
      } else {
        const option = findMatchedOption(guide, romanIndex, KANA_ROMAJI[source[sourceIndex]] ?? [source[sourceIndex]]);
        romanEnd = romanIndex + option.length;
      }
    }

    if (inputLength < romanEnd) {
      return {
        completed: segmentStart,
        activeStart: segmentStart,
        activeEnd: segmentEnd
      };
    }

    sourceIndex = segmentEnd;
    romanIndex = romanEnd;
  }

  return {
    completed: source.length,
    activeStart: source.length,
    activeEnd: source.length
  };
}
