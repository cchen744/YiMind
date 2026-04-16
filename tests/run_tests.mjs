import { oneBian, oneYao, yaoMeta, autoYao, YAO_THEORETICAL } from "../lib/dayan.js";
import { deriveHexagrams, hexagramNumber, KW_TO_KEY, KEY_TO_KW, hexagramSymbol } from "../lib/hexagram.js";

let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log("  ✓", msg); }
  else { console.log("  ✗", msg); failed++; }
}
function section(name) { console.log("\n==", name); }

section("一變 invariants");
let first = {}, second = {};
for (let i = 0; i < 5000; i++) {
  const leftN = 1 + Math.floor(Math.random() * 48);
  const r = oneBian(49, leftN);
  first[r.removed] = (first[r.removed] || 0) + 1;
  const r2 = oneBian(r.remaining, 1 + Math.floor(Math.random() * (r.remaining - 1)));
  second[r2.removed] = (second[r2.removed] || 0) + 1;
}
assert(Object.keys(first).every(k => k === "5" || k === "9"), `1st 變 removed ∈ {5, 9}`);
assert(Object.keys(second).every(k => k === "4" || k === "8"), `2nd 變 removed ∈ {4, 8}`);
console.log("  distribution 1st:", first, " 2nd:", second);

section("爻 value distribution (N=40000)");
const N = 40000;
const counts = { 6: 0, 7: 0, 8: 0, 9: 0 };
for (let i = 0; i < N; i++) counts[autoYao().value]++;
let maxErr = 0;
for (const v of [9, 8, 7, 6]) {
  const t = YAO_THEORETICAL[v], a = counts[v] / N, e = Math.abs(a - t);
  maxErr = Math.max(maxErr, e);
  console.log(`  ${v} (${yaoMeta(v).name_zh}): theory=${(t*100).toFixed(2)}% actual=${(a*100).toFixed(2)}% err=${(e*100).toFixed(2)}%`);
}
// Zhu Xi's ideal probabilities 3/16,7/16,5/16,1/16 assume each 變's outcomes
// are equally likely (1/2 each on 2nd/3rd 變). Under uniformly-random splits
// (which is what we simulate here, and what a user clicking randomly would
// produce) there's a small systematic bias (~1%) toward the "small removal"
// outcomes: so 9s and 8s are slightly over-represented. This is not a bug —
// it's the actual distribution of the algorithm under uniform user input.
assert(maxErr < 0.02, `max error < 2% (uniform-split bias is expected)`);

section("King Wen table");
const kwNums = Object.keys(KW_TO_KEY).map(Number).sort((a,b)=>a-b);
assert(kwNums.length === 64 && kwNums[0] === 1 && kwNums[63] === 64, `KW_TO_KEY has 64 entries 1..64`);
const keys = new Set(Object.values(KW_TO_KEY));
assert(keys.size === 64, `all 64 keys distinct`);
for (const {kw, key, name} of [
  { kw: 1, key: "111111", name: "乾" },
  { kw: 2, key: "000000", name: "坤" },
  { kw: 11, key: "000111", name: "泰" },
  { kw: 12, key: "111000", name: "否" },
  { kw: 63, key: "010101", name: "既濟" },
  { kw: 64, key: "101010", name: "未濟" },
]) assert(KW_TO_KEY[kw] === key, `KW ${kw} ${name} → ${key}`);

section("互卦 formula");
{
  const h = deriveHexagrams([7,7,7,7,7,7]);
  assert(h.hu.kw === 1, `互(乾為天) = 乾為天`);
}
{
  const h = deriveHexagrams([8,8,8,8,8,8]);
  assert(h.hu.kw === 2, `互(坤為地) = 坤為地`);
}
{
  const h = deriveHexagrams([7,7,7,8,8,8]);
  const expected = [1,1,0,1,0,0];
  assert(JSON.stringify(h.hu.lines) === JSON.stringify(expected), `互(地天泰).lines = ${expected} got ${h.hu.lines}`);
  assert(h.hu.kw === 18, `互(地天泰) = 山風蠱 (KW 18) got ${h.hu.kw}`);
}

section("端到端抽卦 sample");
const yaos = [];
for (let i = 0; i < 6; i++) yaos.push(autoYao().value);
const h = deriveHexagrams(yaos);
console.log(`  yaos: ${yaos.join(" ")}`);
console.log(`  本 ${hexagramSymbol(h.ben.kw)} KW${h.ben.kw}  變 ${hexagramSymbol(h.bian.kw)} KW${h.bian.kw}  互 ${hexagramSymbol(h.hu.kw)} KW${h.hu.kw}`);
console.log(`  changing: ${JSON.stringify(h.changingLines)}`);

console.log(failed === 0 ? "\n ALL PASS " : `\n ${failed} FAILED `);
process.exit(failed === 0 ? 0 : 1);
