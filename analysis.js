// 회차별 교정 변경률 분석 — 문자 편집 거리(Levenshtein) 기반, 조건 A/B 비교
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'data');
const read = (p) => fs.readFileSync(p, 'utf8').trim();

// Levenshtein 편집 거리 (문자 단위)
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = [...Array(n + 1).keys()], cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function changedSentences(a, b) {
  const split = (t) => t.split(/(?<=[.!?？])\s+/).map(s => s.trim()).filter(Boolean);
  const sa = split(a), sb = split(b);
  const max = Math.max(sa.length, sb.length);
  let ch = 0;
  for (let i = 0; i < max; i++) if ((sa[i] || '') !== (sb[i] || '')) ch++;
  return ch;
}

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function analyze(roundsDir, condition) {
  const rows = [];
  const perRound = { 1: [], 2: [], 3: [] };
  for (let i = 1; i <= 10; i++) {
    const s = `s${String(i).padStart(2, '0')}`;
    const inputs = [read(`${DIR}/samples/${s}.txt`)];
    for (let r = 1; r <= 3; r++) inputs.push(read(`${DIR}/${roundsDir}/${s}_r${r}.txt`));
    for (let r = 1; r <= 3; r++) {
      const inp = inputs[r - 1], out = inputs[r];
      const dist = lev(inp, out);
      const rate = +(dist / inp.length).toFixed(4);
      const sc = changedSentences(inp, out);
      const st = inp.split(/(?<=[.!?？])\s+/).filter(Boolean).length;
      rows.push([condition, s, r, inp.length, dist, rate, sc, st].join(','));
      perRound[r].push(rate);
    }
  }
  return { rows, perRound };
}

function signText(a, b) {
  let inc = 0, dec = 0, tie = 0;
  for (let i = 0; i < a.length; i++) {
    const d = b[i] - a[i];
    if (d > 0) inc++; else if (d < 0) dec++; else tie++;
  }
  return `${dec}감소/${inc}증가/${tie}동률`;
}

function report(label, perRound) {
  const line = [1, 2, 3].map(r =>
    `  ${r}차 평균 ${(avg(perRound[r]) * 100).toFixed(2)}%  (범위 ${(Math.min(...perRound[r]) * 100).toFixed(1)}~${(Math.max(...perRound[r]) * 100).toFixed(1)}%)`
  ).join('\n');
  const z3 = perRound[3].filter(v => v === 0).length;
  return `${label}\n${line}\n  전이 부호: 1→2차 ${signText(perRound[1], perRound[2])} | 2→3차 ${signText(perRound[2], perRound[3])} | 3차 변경률 0% 샘플 수: ${z3}/10`;
}

const conditions = [['rounds', 'A']];
if (fs.existsSync(`${DIR}/rounds_b`)) conditions.push(['rounds_b', 'B']);

const allRows = ['condition,sample,round,in_len,edit_dist,change_rate,sent_changed,sent_total'];
const reports = [];
for (const [dir, cond] of conditions) {
  const { rows, perRound } = analyze(dir, cond);
  allRows.push(...rows);
  reports.push(report(`=== 조건 ${cond} ===`, perRound));
}
fs.writeFileSync(`${DIR}/analysis.csv`, allRows.join('\n') + '\n', 'utf8');
console.log(reports.join('\n\n'));
