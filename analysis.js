// 회차별 교정 변경률 분석 — 문자 편집 거리(Levenshtein) 기반
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

// 문장 단위 변경 개수 (종결 기준으로 나누고 문자열이 다른 문장 수)
function changedSentences(a, b) {
  const split = (t) => t.split(/(?<=[.!?？])\s+/).map(s => s.trim()).filter(Boolean);
  const sa = split(a), sb = split(b);
  const max = Math.max(sa.length, sb.length);
  let ch = 0;
  for (let i = 0; i < max; i++) if ((sa[i] || '') !== (sb[i] || '')) ch++;
  return ch;
}

const rows = [['sample', 'round', 'in_len', 'edit_dist', 'change_rate', 'sent_changed', 'sent_total']];
const perRound = { 1: [], 2: [], 3: [] };

for (let i = 1; i <= 10; i++) {
  const s = `s${String(i).padStart(2, '0')}`;
  const inputs = [read(`${DIR}/samples/${s}.txt`)];
  for (let r = 1; r <= 3; r++) inputs.push(read(`${DIR}/rounds/${s}_r${r}.txt`));
  for (let r = 1; r <= 3; r++) {
    const inp = inputs[r - 1], out = inputs[r];
    const dist = lev(inp, out);
    const rate = +(dist / inp.length).toFixed(4);
    const sc = changedSentences(inp, out);
    const st = inp.split(/(?<=[.!?？])\s+/).filter(Boolean).length;
    rows.push([s, r, inp.length, dist, rate, sc, st].join(','));
    perRound[r].push(rate);
  }
}

fs.writeFileSync(`${DIR}/analysis.csv`, rows.join('\n') + '\n', 'utf8');

const avg = (xs) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(4);
const line = [1, 2, 3].map(r =>
  `${r}차 평균 변경률: ${(avg(perRound[r]) * 100).toFixed(2)}%  (범위 ${Math.min(...perRound[r]).toFixed(3)}~${Math.max(...perRound[r]).toFixed(3)})`
).join('\n');
const dec = [1, 2].map(r => ` ${avg(perRound[r])} → ${avg(perRound[r + 1])}`).join('\n');
console.log('=== 회차별 평균 변경률 ===\n' + line + '\n\n회차 간 감소:' + dec +
  `\n\n감소 여부: ${avg(perRound[2]) < avg(perRound[1]) && avg(perRound[3]) < avg(perRound[2]) ? '가설 지지 (매 회차 감소)' : '부분적/기각'}`);
