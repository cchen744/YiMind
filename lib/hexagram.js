// ============================================================================
// hexagram.js — 本卦 / 變卦 / 互卦 derivation + 64-hexagram lookup
// ----------------------------------------------------------------------------
// A hexagram is 6 爻 drawn bottom-up. We encode it as an array of 6 numbers,
// index 0 = 初爻 (bottom), index 5 = 上爻 (top), values 6/7/8/9.
//
//   本卦 (běn guà) — the original hexagram: solid/broken from the 6 爻 values.
//     6 → broken (0), 7 → solid (1), 8 → broken (0), 9 → solid (1)
//
//   變卦 (biàn guà) — the transformed hexagram: flip every CHANGING line.
//     6 (老陰) → solid (1);  9 (老陽) → broken (0);  7/8 unchanged.
//
//   互卦 (hù guà) — the nuclear hexagram, derived from the middle four 爻:
//     lower trigram = 本卦's lines 2,3,4 (indices 1,2,3)
//     upper trigram = 本卦's lines 3,4,5 (indices 2,3,4)
//     i.e. new = [本[1], 本[2], 本[3], 本[2], 本[3], 本[4]]
// ============================================================================

import { yaoMeta } from "./dayan.js";

// ---------------- Trigram codes (MSB = top line of the trigram) ----------------
// 乾 ☰ 111   兌 ☱ 110   離 ☲ 101   震 ☳ 100
// 巽 ☴ 011   坎 ☵ 010   艮 ☶ 001   坤 ☷ 000
const TRIGRAM = {
  乾: "111", 兌: "110", 離: "101", 震: "100",
  巽: "011", 坎: "010", 艮: "001", 坤: "000",
};

// Canonical King Wen pairs [upper, lower]. Used to build lookup tables.
const KW_PAIRS = {
   1: ["乾","乾"],  2: ["坤","坤"],  3: ["坎","震"],  4: ["艮","坎"],
   5: ["坎","乾"],  6: ["乾","坎"],  7: ["坤","坎"],  8: ["坎","坤"],
   9: ["巽","乾"], 10: ["乾","兌"], 11: ["坤","乾"], 12: ["乾","坤"],
  13: ["乾","離"], 14: ["離","乾"], 15: ["坤","艮"], 16: ["震","坤"],
  17: ["兌","震"], 18: ["艮","巽"], 19: ["坤","兌"], 20: ["巽","坤"],
  21: ["離","震"], 22: ["艮","離"], 23: ["艮","坤"], 24: ["坤","震"],
  25: ["乾","震"], 26: ["艮","乾"], 27: ["艮","震"], 28: ["兌","巽"],
  29: ["坎","坎"], 30: ["離","離"], 31: ["兌","艮"], 32: ["震","巽"],
  33: ["乾","艮"], 34: ["震","乾"], 35: ["離","坤"], 36: ["坤","離"],
  37: ["巽","離"], 38: ["離","兌"], 39: ["坎","艮"], 40: ["震","坎"],
  41: ["艮","兌"], 42: ["巽","震"], 43: ["兌","乾"], 44: ["乾","巽"],
  45: ["兌","坤"], 46: ["坤","巽"], 47: ["兌","坎"], 48: ["坎","巽"],
  49: ["兌","離"], 50: ["離","巽"], 51: ["震","震"], 52: ["艮","艮"],
  53: ["巽","艮"], 54: ["震","兌"], 55: ["震","離"], 56: ["離","艮"],
  57: ["巽","巽"], 58: ["兌","兌"], 59: ["巽","坎"], 60: ["坎","兌"],
  61: ["巽","兌"], 62: ["震","艮"], 63: ["坎","離"], 64: ["離","坎"],
};

// Key format: upper(top,mid,bot) + lower(top,mid,bot), each MSB = top line.
// So for a 6-line array lines[0..5] (bottom→top):
//   lower trigram chars = lines[2] lines[1] lines[0]  (top→bot of lower)
//   upper trigram chars = lines[5] lines[4] lines[3]  (top→bot of upper)
//   key = upper + lower
function linesToKey(lines) {
  const lower = `${lines[2]}${lines[1]}${lines[0]}`;
  const upper = `${lines[5]}${lines[4]}${lines[3]}`;
  return upper + lower;
}

// Build lookup tables once at module load.
export const KW_TO_KEY = {};
export const KEY_TO_KW = {};
for (const [n, [u, l]] of Object.entries(KW_PAIRS)) {
  const key = TRIGRAM[u] + TRIGRAM[l];
  KW_TO_KEY[n] = key;
  KEY_TO_KW[key] = Number(n);
}

/** Convert a 爻 value array (6/7/8/9) to a 0/1 line array (0=broken, 1=solid). */
function toLines(yaoValues) {
  return yaoValues.map((v) => (yaoMeta(v).solid ? 1 : 0));
}

/** Look up the King Wen sequence number (1..64) of a 6-line array. */
export function hexagramNumber(lines) {
  if (lines.length !== 6) throw new Error("need 6 lines");
  const key = linesToKey(lines);
  const n = KEY_TO_KW[key];
  if (!n) throw new Error(`unknown hexagram key ${key}`);
  return n;
}

/**
 * Derive the three hexagrams (本, 變, 互) from the raw 爻 values.
 *
 * @param {number[]} yaoValues  6 values from {6,7,8,9}, bottom→top
 * @returns {{
 *   ben:  { lines: number[], kw: number },
 *   bian: { lines: number[], kw: number },
 *   hu:   { lines: number[], kw: number },
 *   hasChanging: boolean,
 *   changingLines: number[],
 *   yaoValues: number[]
 * }}
 */
export function deriveHexagrams(yaoValues) {
  if (yaoValues.length !== 6) throw new Error("need 6 爻");
  const benLines = toLines(yaoValues);
  const changingLines = yaoValues
    .map((v, i) => (yaoMeta(v).changing ? i : -1))
    .filter((i) => i !== -1);
  const bianLines = yaoValues.map((v) => {
    const m = yaoMeta(v);
    if (!m.changing) return m.solid ? 1 : 0;
    return m.solid ? 0 : 1; // flip
  });
  // 互卦: positions [1,2,3,2,3,4] of 本卦
  const huLines = [
    benLines[1], benLines[2], benLines[3],
    benLines[2], benLines[3], benLines[4],
  ];
  return {
    ben:  { lines: benLines,  kw: hexagramNumber(benLines)  },
    bian: { lines: bianLines, kw: hexagramNumber(bianLines) },
    hu:   { lines: huLines,   kw: hexagramNumber(huLines)   },
    hasChanging: changingLines.length > 0,
    changingLines,
    yaoValues: [...yaoValues],
  };
}

/**
 * Unicode hexagram symbol (䷀..䷿) for a King Wen number 1..64.
 * Note: the Unicode block U+4DC0..U+4DFF is ordered by King Wen sequence.
 */
export function hexagramSymbol(kw) {
  return String.fromCodePoint(0x4dc0 + (kw - 1));
}
