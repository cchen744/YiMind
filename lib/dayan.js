// ============================================================================
// dayan.js — 大衍筮法 (Yarrow Stalk Method) core algorithm
// ----------------------------------------------------------------------------
// Reference:
//   繫辭上傳：「大衍之數五十，其用四十有九。分而為二以象兩，掛一以象三，
//              揲之以四以象四時，歸奇於扐以象閏，五歲再閏，故再扐而後掛。」
//
//   Per 變 (transformation):
//     1. 分而為二：split N stalks into two piles (left 左 = 天, right 右 = 地)
//     2. 掛一：take 1 stalk from the right pile, set aside
//     3. 揲之以四：count off left pile in groups of 4; remainder r_l ∈ {1,2,3,4}
//     4. 歸奇於扐：count off right pile in groups of 4; remainder r_r ∈ {1,2,3,4}
//     5. Remove 1 + r_l + r_r from the total. First 變: always 5 or 9. 2nd/3rd: 4 or 8.
//
//   After 3 變, the count of 4-stalk bundles remaining is one of 6,7,8,9:
//     6 = 老陰 (old yin,   broken, CHANGING → becomes solid in 變卦)
//     7 = 少陽 (young yang, solid,  stable)
//     8 = 少陰 (young yin,  broken, stable)
//     9 = 老陽 (old yang,  solid,  CHANGING → becomes broken in 變卦)
//
//   Repeat for 6 爻, from bottom (初) to top (上). 18 變 total.
//
// Design note for this UI:
//   The "user manually splits the pile" step is realized by having the user
//   click a position on the visualized stalk pile. We interpret the click as
//   "stalks to the LEFT of the click go into the left pile". The remaining
//   揲之以四/歸奇於扐 steps are deterministic. This preserves the spiritual
//   meaning of 分而為二 (the human hand as the source of indeterminacy) while
//   removing tedium.
// ============================================================================

/**
 * Perform one 變 (transformation). Given the current total stalks N and a
 * user-chosen split point (number of stalks in the LEFT pile, excluding 掛一).
 *
 * @param {number} N      current total stalks (49, 44/40, or 40/36/32)
 * @param {number} leftN  user's chosen left-pile size, 1..N-1
 * @returns {{
 *   leftN: number, rightN: number,
 *   guaOne: 1,                        // the 掛一 stalk
 *   leftRem: number, rightRem: number, // remainders after 揲之以四
 *   removed: number,                  // 1 + leftRem + rightRem
 *   remaining: number                 // N - removed
 * }}
 */
export function oneBian(N, leftN) {
  if (leftN < 1 || leftN > N - 1) {
    throw new Error(`leftN must be in [1, ${N - 1}], got ${leftN}`);
  }
  const rightN = N - leftN;
  // 掛一：take 1 from the right pile
  const rightAfterGua = rightN - 1;
  // 揲之以四：remainder 1..4 (if divisible by 4, remainder is 4, not 0)
  const mod4 = (n) => {
    const r = n % 4;
    return r === 0 ? 4 : r;
  };
  const leftRem = mod4(leftN);
  const rightRem = mod4(rightAfterGua);
  const removed = 1 + leftRem + rightRem;
  return {
    leftN,
    rightN,
    guaOne: 1,
    leftRem,
    rightRem,
    removed,
    remaining: N - removed,
  };
}

/**
 * Perform three 變 to produce ONE 爻. Caller provides three split points.
 * Returns the line value {6, 7, 8, 9} and the intermediate trace.
 *
 * @param {[number, number, number]} splits  user split points for 變 1/2/3
 * @returns {{ value: 6|7|8|9, trace: object[] }}
 */
export function oneYao(splits) {
  if (splits.length !== 3) throw new Error("need 3 split points for one 爻");
  const trace = [];
  let N = 49;
  for (let i = 0; i < 3; i++) {
    const step = oneBian(N, splits[i]);
    trace.push({ bianIndex: i + 1, before: N, ...step });
    N = step.remaining;
  }
  // After 3 變, N is divisible by 4. N/4 ∈ {6,7,8,9}.
  const value = N / 4;
  if (![6, 7, 8, 9].includes(value)) {
    throw new Error(`unexpected 爻 value ${value} (N=${N})`);
  }
  return { value, trace };
}

/**
 * Semantics of a 爻 value.
 *   value 6: 老陰 — broken line (⚋), CHANGING, becomes 陽 in 變卦
 *   value 7: 少陽 — solid line (⚊), stable
 *   value 8: 少陰 — broken line (⚋), stable
 *   value 9: 老陽 — solid line (⚊), CHANGING, becomes 陰 in 變卦
 */
export function yaoMeta(value) {
  const table = {
    6: { name_zh: "老陰", name_en: "Old Yin",   solid: false, changing: true  },
    7: { name_zh: "少陽", name_en: "Young Yang", solid: true,  changing: false },
    8: { name_zh: "少陰", name_en: "Young Yin",  solid: false, changing: false },
    9: { name_zh: "老陽", name_en: "Old Yang",  solid: true,  changing: true  },
  };
  return table[value];
}

/**
 * Probability distribution (theoretical) of 爻 values, for sanity testing.
 *   P(9) = 3/16, P(8) = 7/16, P(7) = 5/16, P(6) = 1/16
 * Reference: 朱熹《易學啟蒙》.
 */
export const YAO_THEORETICAL = { 9: 3 / 16, 8: 7 / 16, 7: 5 / 16, 6: 1 / 16 };

/**
 * Draw a 爻 with automatic random splits. For headless tests only.
 * (The real UI never calls this — the user supplies the splits.)
 */
export function autoYao(rand = Math.random) {
  const splits = [];
  let N = 49;
  for (let i = 0; i < 3; i++) {
    const leftN = 1 + Math.floor(rand() * (N - 1));
    splits.push(leftN);
    const step = oneBian(N, leftN);
    N = step.remaining;
  }
  return oneYao(splits);
}
