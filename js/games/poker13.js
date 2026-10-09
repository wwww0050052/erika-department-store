// 名媛十三支：4 人（玩家＋3 位名媛），每人 13 張分頭道 3／中道 5／尾道 5，尾 ≥ 中 ≥ 頭，否則倒水。
// 擺牌介面（點牌放入、可點回、即時牌型與倒水提示）、免費「自動擺牌」、粉鑽「大師擺牌」（窮舉所有擺法找期望得分最高）。
// 開牌演出：特殊牌型報到 → 頭道 → 中道 → 尾道 → 打槍（玫瑰花瓣）→ 全壘打 → 總分結算。
// 規則判定（牌型、比牌、計分、擺牌）是純函式，掛在 ErikaCards.poker13 給單元測試用。
'use strict';
(() => {
  const W = typeof window !== 'undefined' ? window : globalThis;
  const C = W.ErikaCards;
  if (!C) return;

  // ================= 牌型（純函式） =================
  // 牌型數值 = 類別 × 16^5 + 比較用點數（最多 5 位，每位 0–15）；數值越大越強，頭道 3 張與中尾道 5 張可以直接比（倒水判定）。
  const B = 16, B5 = B ** 5;
  const CAT = ['散牌', '一對', '兩對', '三條', '順子', '同花', '葫蘆', '鐵支', '同花順'];
  const WHEEL = 14; // A2345 的順子等級：14 = 第二大（僅次於 10JQKA=15，台灣常見規則）
  const enc = (cat, ks) => { let v = cat; for (let i = 0; i < 5; i++) v = v * B + (ks[i] || 0); return v; };
  const catOf = v => Math.floor(v / B5);
  const digits = v => { const d = []; for (let i = 0; i < 5; i++) { d.unshift(v % B); v = Math.floor(v / B); } return [v, ...d]; };
  function eval5(cs) {
    const rs = [cs[0].r, cs[1].r, cs[2].r, cs[3].r, cs[4].r].sort((a, b) => b - a);
    const s0 = cs[0].s, flush = cs[1].s === s0 && cs[2].s === s0 && cs[3].s === s0 && cs[4].s === s0;
    const g = [];
    for (let i = 0; i < 5;) { let j = i; while (j < 5 && rs[j] === rs[i]) j++; g.push([j - i, rs[i]]); i = j; }
    g.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    let st = 0;
    if (g.length === 5) {
      if (rs[0] - rs[4] === 4) st = rs[0] === 14 ? 15 : rs[0];
      else if (rs[0] === 14 && rs[1] === 5) st = WHEEL;
    }
    if (st && flush) return enc(8, [st]);
    if (g[0][0] === 4) return enc(7, [g[0][1], g[1][1]]);
    if (g[0][0] === 3 && g[1][0] === 2) return enc(6, [g[0][1], g[1][1]]);
    if (flush) return enc(5, rs);
    if (st) return enc(4, [st]);
    if (g[0][0] === 3) return enc(3, [g[0][1], g[1][1], g[2][1]]);
    if (g[0][0] === 2 && g[1][0] === 2) return enc(2, [g[0][1], g[1][1], g[2][1]]);
    if (g[0][0] === 2) return enc(1, [g[0][1], g[1][1], g[2][1], g[3][1]]);
    return enc(0, rs);
  }
  function eval3(cs) {
    const rs = [cs[0].r, cs[1].r, cs[2].r].sort((a, b) => b - a);
    if (rs[0] === rs[2]) return enc(3, [rs[0]]);
    if (rs[0] === rs[1]) return enc(1, [rs[0], rs[2]]);
    if (rs[1] === rs[2]) return enc(1, [rs[1], rs[0]]);
    return enc(0, rs);
  }
  const evalRow = cs => (cs.length === 3 ? eval3(cs) : eval5(cs));
  // 贏一道的分數：頭道三條 3、中道葫蘆 2、中道鐵支 8、中道同花順 10、尾道鐵支 4、尾道同花順 5，其餘 1
  function rowBonus(r, v) {
    const c = catOf(v);
    if (r === 0) return c === 3 ? 3 : 1;
    if (r === 1) return c === 8 ? 10 : c === 7 ? 8 : c === 6 ? 2 : 1;
    return c === 8 ? 5 : c === 7 ? 4 : 1;
  }
  const isFoulV = v => !(v[0] <= v[1] && v[1] <= v[2]);
  const isFoul = rows => isFoulV(rows.map(evalRow));
  const ROWN = ['頭道', '中道', '尾道'];
  const CAP = [3, 5, 5];
  // 還沒擺滿時的提示名稱（只看對子／三條／鐵支）
  function partialName(cs) {
    if (!cs.length) return '';
    const cnt = {};
    for (const c of cs) cnt[c.r] = (cnt[c.r] || 0) + 1;
    const v = Object.values(cnt).sort((a, b) => b - a);
    if (v[0] === 4) return '鐵支';
    if (v[0] === 3) return v[1] === 2 ? '葫蘆' : '三條';
    if (v[0] === 2) return v[1] === 2 ? '兩對' : '一對';
    return '';
  }
  function rowName(cs, r) { return cs.length === CAP[r] ? CAT[catOf(evalRow(cs))] : partialName(cs); }
  // 顯示用排序：多張同點的在前，再依點數
  function sortRow(cs) {
    const cnt = {};
    for (const c of cs) cnt[c.r] = (cnt[c.r] || 0) + 1;
    return cs.slice().sort((a, b) => cnt[b.r] - cnt[a.r] || b.r - a.r || b.s - a.s);
  }

  // ================= 特殊牌型（直接勝，不比牌、不打槍） =================
  const SPECIALS = {
    dragon: { id: 'dragon', name: '一條龍', pts: 13, rank: 7, desc: 'A 到 K 十三張點數都不一樣' },
    color: { id: 'color', name: '湊一色', pts: 10, rank: 6, desc: '十三張全是紅色（♥♦）或全是黑色（♠♣）' },
    trips4: { id: 'trips4', name: '四套三條', pts: 6, rank: 5, desc: '四組三條（鐵支也算一組）' },
    pairs5: { id: 'pairs5', name: '五對三條', pts: 5, rank: 4, desc: '五個對子加一組三條' },
    pairs6: { id: 'pairs6', name: '六對半', pts: 3, rank: 3, desc: '六個對子加一張單牌（鐵支算兩對）' },
    straight3: { id: 'straight3', name: '三順子', pts: 3, rank: 2, desc: '三道都是順子（頭道 3 張連號，A 可當 1 或 14）' },
    flush3: { id: 'flush3', name: '三同花', pts: 3, rank: 1, desc: '三道各自都是同一種花色' },
  };
  function findStraight3(cards) {
    const cnt = new Array(15).fill(0);
    for (const c of cards) cnt[c.r]++;
    const runR = (s, len) => { const a = []; for (let k = 0; k < len; k++) { const r = s + k; a.push(r === 1 ? 14 : r); } return a; };
    for (let s3 = 1; s3 <= 12; s3++) {
      for (let a = 1; a <= 10; a++) {
        for (let b = a; b <= 10; b++) {
          const need = new Array(15).fill(0);
          for (const r of [...runR(s3, 3), ...runR(a, 5), ...runR(b, 5)]) need[r]++;
          let ok = true;
          for (let r = 2; r <= 14; r++) if (need[r] !== cnt[r]) { ok = false; break; }
          if (!ok) continue;
          const pool = cards.slice();
          const take = rs => rs.map(r => pool.splice(pool.findIndex(c => c.r === r), 1)[0]);
          const head = take(runR(s3, 3)), m1 = take(runR(a, 5)), m2 = take(runR(b, 5));
          const [mid, tail] = eval5(m1) <= eval5(m2) ? [m1, m2] : [m2, m1];
          return [head, mid, tail];
        }
      }
    }
    return null;
  }
  function findFlush3(cards) {
    const by = [[], [], [], []];
    for (const c of cards) by[c.s].push(c);
    for (const a of by) a.sort((x, y) => y.r - x.r);
    const groups = by.filter(a => a.length).sort((a, b) => b.length - a.length);
    const L = groups.map(a => a.length).join(',');
    let head, f1, f2;
    if (L === '5,5,3') { head = groups[2]; f1 = groups[0]; f2 = groups[1]; }
    else if (L === '8,5') { f1 = groups[0].slice(0, 5); head = groups[0].slice(5); f2 = groups[1]; }
    else if (L === '10,3') { f1 = groups[0].slice(0, 5); f2 = groups[0].slice(5); head = groups[1]; }
    else if (L === '13') { f1 = groups[0].slice(0, 5); f2 = groups[0].slice(5, 10); head = groups[0].slice(10); }
    else return null;
    const [mid, tail] = eval5(f1) <= eval5(f2) ? [f1, f2] : [f2, f1];
    return [head, mid, tail];
  }
  function detectSpecial(cards) {
    if (!cards || cards.length !== 13) return null;
    const cnt = {};
    for (const c of cards) cnt[c.r] = (cnt[c.r] || 0) + 1;
    const counts = Object.values(cnt);
    const mk = (sp, rows) => ({ ...sp, rows: rows || autoArrange(cards).rows });
    if (counts.length === 13) {
      const s = cards.slice().sort((a, b) => b.r - a.r);
      return mk(SPECIALS.dragon, [s.slice(10), s.slice(5, 10), s.slice(0, 5)]);
    }
    if (cards.every(c => C.isRed(c.s)) || cards.every(c => !C.isRed(c.s))) return mk(SPECIALS.color);
    if (counts.filter(n => n >= 3).length >= 4) return mk(SPECIALS.trips4);
    const c3 = counts.filter(n => n === 3).length, pu = counts.reduce((a, n) => a + (n === 2 ? 1 : n === 4 ? 2 : 0), 0);
    if (c3 === 1 && pu === 5) return mk(SPECIALS.pairs5);
    if (counts.reduce((a, n) => a + Math.floor(n / 2), 0) === 6) return mk(SPECIALS.pairs6);
    const s3 = findStraight3(cards);
    if (s3) return mk(SPECIALS.straight3, s3);
    const f3 = findFlush3(cards);
    if (f3) return mk(SPECIALS.flush3, f3);
    return null;
  }

  // ================= 計分（純函式） =================
  // players[k] = { rows:[頭3,中5,尾5] } 或 { special:{…} }
  // 每兩人之間：每道比大小，贏 +（贏方該道分數）、輸 −（對方該道分數）、平手 0。
  // 打槍：三道全贏 → 這組得分 ×2；倒水 = 三道全輸並被打槍；全壘打（打槍所有對手）→ 與每位對手的得分再 ×2。
  // 特殊牌型對一般牌：直接拿特殊分（不打槍）；特殊對特殊：牌型大的拿分，一樣大平手。
  function scoreMatch(players) {
    const n = players.length;
    const info = players.map(p => {
      if (p.special) return { special: p.special };
      const v = p.rows.map(evalRow);
      return { v, foul: isFoulV(v), bonus: v.map((x, r) => rowBonus(r, x)) };
    });
    const pairs = [], total = new Array(n).fill(0), shotCount = new Array(n).fill(0);
    const rowPts = players.map(() => [0, 0, 0]);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = info[i], b = info[j];
        const pr = { i, j, rows: [0, 0, 0], special: false, shot: 0, base: 0, pts: 0 };
        if (a.special || b.special) {
          pr.special = true;
          if (a.special && b.special) { const d = a.special.rank - b.special.rank; pr.base = d > 0 ? a.special.pts : d < 0 ? -b.special.pts : 0; }
          else pr.base = a.special ? a.special.pts : -b.special.pts;
        } else if (a.foul && b.foul) {
          pr.base = 0;
        } else if (a.foul) {
          pr.rows = b.bonus.map(x => -x); pr.shot = -1;
        } else if (b.foul) {
          pr.rows = a.bonus.slice(); pr.shot = 1;
        } else {
          let wi = 0, wj = 0;
          for (let r = 0; r < 3; r++) {
            if (a.v[r] > b.v[r]) { pr.rows[r] = a.bonus[r]; wi++; } else if (a.v[r] < b.v[r]) { pr.rows[r] = -b.bonus[r]; wj++; }
          }
          if (wi === 3) pr.shot = 1; else if (wj === 3) pr.shot = -1;
        }
        if (!pr.special) {
          pr.base = pr.rows[0] + pr.rows[1] + pr.rows[2];
          for (let r = 0; r < 3; r++) { rowPts[i][r] += pr.rows[r]; rowPts[j][r] -= pr.rows[r]; }
        }
        pr.pts = pr.base * (pr.shot ? 2 : 1);
        if (pr.shot === 1) shotCount[i]++; else if (pr.shot === -1) shotCount[j]++;
        pairs.push(pr);
      }
    }
    let homerun = -1;
    if (n >= 3) for (let k = 0; k < n; k++) if (shotCount[k] === n - 1) homerun = k;
    for (const pr of pairs) {
      if (homerun >= 0 && (pr.i === homerun || pr.j === homerun)) { pr.pts *= 2; pr.homerun = true; }
      total[pr.i] += pr.pts; total[pr.j] -= pr.pts;
    }
    const shots = pairs.filter(p => p.shot).map(p => (p.shot === 1 ? { from: p.i, to: p.j } : { from: p.j, to: p.i }));
    return { info, pairs, total, shots, homerun, rowPts };
  }

  // ================= 擺牌（純函式） =================
  const POP = new Uint8Array(8192);
  for (let m = 1; m < 8192; m++) POP[m] = POP[m >> 1] + (m & 1);
  const M5 = [], M3 = [];
  for (let m = 0; m < 8192; m++) { if (POP[m] === 5) M5.push(m); else if (POP[m] === 3) M3.push(m); }
  const FULL = 8191;
  function pick(cards, m) { const a = []; for (let i = 0; i < 13; i++) if ((m >> i) & 1) a.push(cards[i]); return a; }
  function analyze(cards) {
    const v5 = new Int32Array(8192), v3 = new Int32Array(8192);
    for (const m of M5) v5[m] = eval5(pick(cards, m));
    for (const m of M3) v3[m] = eval3(pick(cards, m));
    return { cards, v5, v3 };
  }
  // 期望得分模型：每道贏過一位「一般對手」那一道的機率（由大量模擬的對手擺法統計成分位表），加上打槍／全壘打的機率修正
  let QT = [null, null, null], LOSS = [1.05, 1.2, 1.1];
  function setTables(t) { QT = t.q.map(s => Int32Array.from(s.split(',').map(x => parseInt(x, 36)))); LOSS = t.loss.slice(); }
  const FALLBACK = [[0.12, 0.6, 0.6, 0.98], [0.02, 0.18, 0.45, 0.68, 0.8, 0.86, 0.94, 0.99, 1], [0.01, 0.06, 0.26, 0.45, 0.58, 0.7, 0.86, 0.98, 1]];
  function pWin(r, v) {
    const q = QT[r];
    if (!q) { const c = catOf(v), d = digits(v); const base = FALLBACK[r][Math.min(c, FALLBACK[r].length - 1)]; return Math.min(0.995, base + (d[1] - 8) * 0.012); }
    let lo = 0, hi = q.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (q[mid] < v) lo = mid + 1; else hi = mid; }
    let eq = lo;
    while (eq < q.length && q[eq] === v) eq++;
    return (lo + (eq - lo) / 2) / q.length;
  }
  function evV(vh, vm, vt) {
    if (vh > vm || vm > vt) return -6 * (LOSS[0] + LOSS[1] + LOSS[2]);
    const p0 = pWin(0, vh), p1 = pWin(1, vm), p2 = pWin(2, vt);
    const w0 = rowBonus(0, vh), w1 = rowBonus(1, vm), w2 = rowBonus(2, vt);
    let e = p0 * w0 - (1 - p0) * LOSS[0] + p1 * w1 - (1 - p1) * LOSS[1] + p2 * w2 - (1 - p2) * LOSS[2];
    const pa = p0 * p1 * p2, qa = (1 - p0) * (1 - p1) * (1 - p2), sw = w0 + w1 + w2;
    e += pa * sw - qa * (LOSS[0] + LOSS[1] + LOSS[2]);
    return 3 * e + pa * pa * pa * 6 * sw;
  }
  const expectedValue = rows => { const v = rows.map(evalRow); return evV(v[0], v[1], v[2]); };
  // 大師擺牌：窮舉 C(13,5)×C(8,5)=72,072 種擺法，取期望得分最高且不倒水的
  function masterArrange(cards) {
    const A = analyze(cards);
    let best = null, bestE = -Infinity;
    for (const t of M5) {
      const vt = A.v5[t], rest = FULL ^ t;
      for (let m = rest; m; m = (m - 1) & rest) {
        if (POP[m] !== 5) continue;
        const vm = A.v5[m];
        if (vm > vt) continue;
        const hm = rest ^ m, vh = A.v3[hm];
        if (vh > vm) continue;
        const e = evV(vh, vm, vt);
        if (e > bestE) { bestE = e; best = [hm, m, t]; }
      }
    }
    return { rows: best.map(m => pick(cards, m)), ev: bestE };
  }
  // 自動擺牌（啟發式）：先挑幾種最強的尾道（同牌型用最小的雜牌），中道同樣挑法，剩下當頭道；比較這些候選的期望分
  // 各類別的「主體」位數：散牌看最大張、一對看對子、兩對看兩個對子、三條看三條、順子看順位、同花全看、葫蘆看三條＋對子、鐵支看四條、同花順看順位
  const KEEP = [1, 1, 2, 1, 1, 5, 2, 1, 1];
  function coreKey(v) { const d = digits(v), k = KEEP[d[0]]; return enc(d[0], d.slice(1, 1 + k)); }
  function autoArrange(cards, o = {}) {
    const A = analyze(cards);
    const rnd = o.rnd || Math.random, noise = o.noise || 0;
    const ksum = m => { let s = 0; for (let i = 0; i < 13; i++) if ((m >> i) & 1) s += cards[i].r; return s; };
    const list = M5.map(m => ({ m, core: coreKey(A.v5[m]), ks: ksum(m) })).sort((a, b) => b.core - a.core || a.ks - b.ks);
    const topDistinct = (arr, n, per = 1) => { const out = [], seen = new Map(); for (const x of arr) { const k = seen.get(x.core) || 0; if (k >= per) continue; if (!k && seen.size >= n) break; seen.set(x.core, k + 1); out.push(x.m); } return out; };
    let best = null, bestE = -Infinity;
    const tryIt = (hm, m, t) => {
      const vh = A.v3[hm], vm = A.v5[m], vt = A.v5[t];
      if (vh > vm || vm > vt) return;
      const e = evV(vh, vm, vt) + (noise ? (rnd() - 0.5) * noise : 0);
      if (e > bestE) { bestE = e; best = [hm, m, t]; }
    };
    // 尾道優先
    for (const t of topDistinct(list, 10)) {
      const rest = FULL ^ t;
      for (const m of topDistinct(list.filter(x => (x.m & ~rest) === 0), 4)) tryIt(rest ^ m, m, t);
    }
    // 頭道優先（先留一個好對子給頭道；雜牌試幾種，避免拆掉同花／順子）
    const list3 = M3.map(m => ({ m, core: coreKey(A.v3[m]), ks: ksum(m) })).sort((a, b) => b.core - a.core || a.ks - b.ks);
    for (const hm of topDistinct(list3, 5, 8)) {
      const rest = FULL ^ hm;
      for (const t of topDistinct(list.filter(x => (x.m & ~rest) === 0), 3)) tryIt(hm, rest ^ t, t);
    }
    if (!best) return masterArrange(cards);
    return { rows: best.map(m => pick(cards, m)), ev: evV(A.v3[best[0]], A.v5[best[1]], A.v5[best[2]]) };
  }
  // 最簡單的貪心擺法（產生分位表的起點用）
  function greedyArrange(cards) {
    const A = analyze(cards);
    let t = M5[0];
    for (const m of M5) if (A.v5[m] > A.v5[t]) t = m;
    const rest = FULL ^ t;
    let mm = 0;
    for (let m = rest; m; m = (m - 1) & rest) if (POP[m] === 5 && (!mm || A.v5[m] > A.v5[mm])) mm = m;
    return { rows: [pick(cards, rest ^ mm), pick(cards, mm), pick(cards, t)] };
  }

  const P = { CAT, ROWN, CAP, WHEEL, enc, catOf, digits, eval5, eval3, evalRow, rowBonus, isFoul, isFoulV, partialName, rowName, sortRow, SPECIALS, detectSpecial, findStraight3, findFlush3, scoreMatch, analyze, pWin, evV, expectedValue, masterArrange, autoArrange, greedyArrange, setTables, coreKey };
  C.poker13 = P;

  // 分位表：node 模擬 6000 局、約 1.5 萬手「自動擺牌」的頭／中／尾道牌型數值，各取 256 個分位點（36 進位）。loss = 對手贏一道時平均拿走的分數
  const TABLES = {
    loss: [1.007,1.025,1.162],
    q: [
      'aakg,bshs,d6gw,dczk,dds0,ei9s,eoe8,eozk,es5c,eups,evb4,evpc,fta8,fzls,g2yo,g3cw,g64g,g6ps,g6ww,g9hc,g9vk,ga9s,ga9s,gcn4,gcu8,gd8g,gdfk,gdmo,gdmo,h81s,he68,herk,hhq8,hi4g,hkw0,hla8,hlhc,hnuo,ho8w,hon4,hon4,hou8,hr0g,hreo,hrsw,hs00,hs00,hs74,hs74,htz4,hudc,hurk,hurk,huyo,hv5s,hv5s,hvcw,hvcw,hvk0,hvk0,ij9c,imm8,ipz4,it4w,ivwg,iwhs,iwow,iz9c,iznk,izuo,j01s,j2m8,j2tc,j30g,j37k,j3eo,j3eo,j5kw,j5z4,j668,j6dc,j6kg,j6kg,j6rk,j6rk,j8jk,j8xs,j94w,j9c0,j9j4,j9q8,j9q8,j9xc,j9xc,j9xc,ja4g,ja4g,ja4g,jbpc,jc3k,jchs,jchs,jcow,jcow,jcw0,jcw0,jd34,jd34,jd34,jda8,jda8,jda8,jda8,jdhc,jdhc,jdhc,jdhc,jdhc,k16o,k4jk,k7i8,k7wg,kav4,kb9c,kdts,ke80,kef4,kem8,kh6o,khkw,khs0,khz4,kk5c,kkjk,kkqo,kkxs,kl4w,kl4w,klc0,klc0,kn40,kni8,knwg,ko3k,ko3k,koao,koao,kohs,kohs,koow,koow,koow,koow,kqgw,kqo0,kr28,kr9c,kr9c,krgg,krgg,krnk,krnk,krnk,kruo,kruo,kruo,ks1s,ks1s,ks1s,ks1s,ks1s,ktmo,ktts,ku0w,ku80,kuf4,kum8,kum8,kutc,kutc,kutc,kv0g,kv0g,kv0g,kv0g,kv7k,kv7k,kv7k,kv7k,kveo,kveo,kveo,kveo,kveo,kveo,kveo,q2o0,q8zk,r4lc,re2o,rh8g,rqps,sj5s,ssn4,svsw,t24g,treo,u0w0,u41s,u77k,ugow,v2tc,v94w,vim8,vls0,voxs,voxs,vv9c,w4qo,wkjk,wu0w,x3i8,x6o0,x6o0,x9ts,xczk,xjb4,xvy8,y29s,y8lc,ybr4,yi2o,yoe8,zaio,zn5s,zqbk,zthc,zthc,102yo,1064g,10s8w,111q8,1181s,11hj4,11r0g,12gao,12mm8,12ps0,12z9c,13lds,13y0w,147i8,14wsg,15fr4,16eio,1zmyo',
      'itdu,kb43,keoj,px68,rfa8,sqi8,sx9c,u4o0,ubkw,vd4g,vmsw,vqds,w3o0,wv1c,x1kw,x7hc,xlls,y97k,ycdc,yiow,ym9s,yx7k,zhgg,zns0,zo6o,zrj4,zuxc,104ls,10f5c,10z6o,112jk,112rk,11640,119a8,11cv4,11ths,12alc,12dy8,12h4g,12ka8,12kpc,12o1c,12rg0,137o0,13p5s,13sj4,13vvk,13yu8,13z9c,142eo,145kg,14j9c,153q8,156w0,15a1s,15ag0,15d7k,15dtc,15gsg,15h74,15kk0,15uo0,16lgg,16lo0,16p0g,16rz4,16se8,16vr4,16z5c,1dczk,1ery8,1g64g,1gc1s,1hkow,1ho1s,1hs00,1hvk0,1j20w,1j5ds,1j8qo,1jbi8,1jcw0,1kglc,1kjy8,1knb4,1kq2o,1kt8g,1ktts,1lse8,1lw5c,1lzb4,1m29s,1m4u8,1m5ts,1m874,1mayo,1mbcw,1mcjk,1n8jk,1ncw0,1nev4,1ni80,1njsw,1nmdc,1nmyo,1npq8,1nqbk,1nsow,1nta8,1olc0,1ooao,1orgg,1oum8,1oxs0,1oyrk,1p14w,1p3b4,1p4hs,1p79c,1p7nk,1paf4,1patc,1pce8,1q0ao,1q2v4,1q60w,1q77k,1q9kw,1qcjk,1qfpc,1qgao,1qj28,1qlts,1qmtc,1qpds,1qrcw,1qsqo,1reo0,1rhfk,1rhts,1rklc,1rl6o,1rnr4,1rpc0,1rr40,1rri8,1ru2o,1ruo0,1rxmo,1s0e8,1s16o,1s4qo,1s8ao,1st1c,1st8g,1su0w,1swe8,1sxs0,1szcw,1szy8,1t2io,1t3wg,1t5og,1t6gw,1t8u8,1tbsw,1tdz4,1tfcw,1tiio,1tog0,1ts74,1yscg,20000,209hc,21beo,21o8w,22t4w,235z4,24b28,25j40,25ssg,27400,28irk,29u68,2bbwg,2cq9s,2fjls,2qbr4,2qbr4,2qbr4,2qbr4,2qbr4,2rqbk,2rqbk,2rqbk,2rqbk,2rqbk,2t4w0,2t4w0,2t4w0,2t4w0,2t4w0,2ujgg,2ujgg,2ujgg,2ujgg,2ujgg,2vy0w,2vy0w,2vy0w,2vy0w,2vy0w,2xclc,2xclc,2xclc,2xclc,2yr5s,2yr5s,2yr5s,305q8,305q8,305q8,305q8,31kao,31kao,31kao,31kao,31kao,32yv4,32yv4,32yv4,3g9ci,3j5tu,3kdgy,3knro,3kr5u,3m1xv,3m5ic,3m8oi,3n9rm,3ngxi,3nn0i,3nno4,3nqlv,3nr03,3ov2s,3p1lf,3p4ro,3p5m1,3p8xg,3upkw,3w7b4,3yebk,40utc,4385c,476dc',
      '10w0w,12ka8,13yu8,15agw,16p0w,1dd6o,1err4,1eubk,1g8w0,1hngg,1j8cg,1lse8,1n9q8,1olj4,1ornk,1pzwg,1q2v4,1q96o,1regw,1rhfk,1rnr4,1ru9s,1stfk,1swe8,1szy8,1t5hc,1ti4g,2qbr4,2qbr4,2qbr4,2rqbk,2rqbk,2rqbk,2t4w0,2t4w0,2t4w0,2ujgg,2ujgg,2ujgg,2ujgg,2vy0w,2vy0w,2vy0w,2vy0w,2xclc,2xclc,2xclc,2xclc,2yr5s,2yr5s,2yr5s,2yr5s,2yr5s,305q8,305q8,305q8,305q8,31kao,31kao,31kao,31kao,31kao,31kao,31kao,31kao,32yv4,32yv4,32yv4,32yv4,32yv4,3hkj6,3iz43,3j5uc,3j97n,3kjsi,3kndg,3knsm,3kqxf,3kr5h,3lyr6,3m1xf,3m2cz,3m5hf,3m5qa,3m8h1,3m8v8,3m92d,3n9rm,3ndc3,3nghe,3ngwi,3njur,3nk2s,3nkar,3nn0y,3nnea,3nng5,3nnn6,3nno8,3nq6q,3nqer,3nqlx,3nqs4,3nqtv,3nr03,3nr1h,3oor7,3os3m,3ov2b,3ovgy,3oy7m,3oyma,3oytf,3oyv6,3p1dv,3p1lw,3p1tg,3p20k,3p279,3p28l,3p4qa,3p4ya,3p54y,3p56q,3p5cj,3p5dh,3p5ec,3p5kj,3p5li,3p7ia,3p7x0,3p844,3p8b7,3p8ci,3p8is,3p8k3,3p8pv,3p8qt,3p8ro,3p8wy,3p8xw,3p8yq,3p8z7,3tx4w,3u0ao,3u3gg,3u9s0,3uj9c,3upkw,3v8jk,3v8jk,3vi0w,3vl6o,3vuo0,3w45c,3wn40,3wq9s,3wq9s,3wzr4,3x62o,3xce8,3xlvk,3y1og,3y4u8,3y800,3yhhc,3ykn4,3yu4g,3z0g0,3zg8w,3zjeo,3zmkg,3zw1s,3zz7k,408ow,40f0g,40utc,40xz4,4114w,414ao,41ds0,41k3k,41tkw,429ds,42cjk,42fpc,42iv4,42p6o,42yo0,434zk,43ny8,43ny8,43r40,43u9s,440lc,446ww,44d8g,44jk0,452io,452io,455og,458u8,45f5s,45lhc,45on4,45y4g,464g0,46h34,46k8w,46neo,46qkg,46ww0,4701s,476dc,47cow,47j0g,47vnk,47ytc,481z4,4854w,48bgg,48em8,48hs0,48o3k,48xkw,49a80,49dds,49gjk,49jpc,49mv4,49t6o,49wcg,4a2o0,4ac5c,4aosg,4ary8,4ary8,4av40,4ay9s,4b4lc,4baww,4be2o,4bke8,4ge80,4hvy8,4kirk,4m3nk,4oqgw,4q51c,4rt34,4ufwg,4x5vk,5883k,5b18g,5f8xs,5jgn4',
    ],
  };
  if (TABLES) setTables(TABLES);

  // ================= 遊戲畫面 =================
  const MASTER = 15, ESC_PTS = 6;
  const OPP_KEYS = { 1: 'vivi', 2: 'vita', 3: 'chiyo', 4: 'shino' };
  const NOISE = { vivi: 1.6, vita: 0, chiyo: 0.8, shino: 0.35 };
  const LINES = {
    vivi: { done: ['擺好囉～', '這樣排應該不錯吧？'], shoot: ['打槍成功～♪', '嘿嘿，三道全贏！'], shot: ['嗚哇，被打槍了…', '不要這樣啦～'], win: ['今天運氣好甜～', '請大家吃馬卡龍！'], lose: ['下次換我贏！', '嗚嗚，甜點錢…'], special: ['特殊牌型，報到！'] },
    vita: { done: ['最佳化完成。', '計算結束。'], shoot: ['三道全勝，符合預期。'], shot: ['……演算法需要修正。'], win: ['收益為正。', '模型表現良好。'], lose: ['樣本數還不夠。', '下一輪會修正。'], special: ['機率極低的牌型，報到。'] },
    chiyo: { done: ['本小姐擺好了，快點。', '哼，簡單。'], shoot: ['哼，打槍！', '這就是實力差距。'], shot: ['什麼！？竟敢打本小姐的槍！'], win: ['理所當然。', '呵呵，承讓了～'], lose: ['……下一局等著瞧。', '零錢而已！'], special: ['看清楚，這就是財閥的牌！'] },
    shino: { done: ['已就緒。', '請。'], shoot: ['失禮了。', '花開三道。'], shot: ['花落知多少…'], win: ['承蒙相讓。', '一期一會。'], lose: ['輸了也很風雅。', '勝敗乃兵家常事。'], special: ['難得一見，報到。'] },
  };
  const pickL = a => a[Math.floor(Math.random() * a.length)];
  const RULES = `
    <h4>基本</h4>
    <p>4 人各拿 <b>13 張</b>，分成三道：<b>頭道 3 張</b>、<b>中道 5 張</b>、<b>尾道 5 張</b>。規定 <b>尾道 ≥ 中道 ≥ 頭道</b>，否則就是「<b>倒水</b>」：對每位對手三道全輸，而且算被打槍。</p>
    <h4>牌型（大到小）</h4>
    <p>同花順 ＞ 鐵支 ＞ 葫蘆 ＞ 同花 ＞ 順子 ＞ 三條 ＞ 兩對 ＞ 一對 ＞ 散牌。<br>頭道只有 3 張，只算 <b>三條／一對／散牌</b>。</p>
    <p>A 最大；順子 A 可以在兩端：<b>10JQKA 最大，A2345 第二大</b>，其餘看最大的那張（不能繞圈，例如 QKA23 不是順子）。同牌型依序比點數，完全相同算平手，<b>不比花色</b>。</p>
    <h4>計分（每一道跟每位對手各比一次）</h4>
    <table class="ec-tbl"><tr><th>贏一道</th><td>一般</td><td>+1</td></tr><tr><th>頭道</th><td>三條（沖三）</td><td>+3</td></tr><tr><th>中道</th><td>葫蘆</td><td>+2</td></tr><tr><th>中道</th><td>鐵支</td><td>+8</td></tr><tr><th>中道</th><td>同花順</td><td>+10</td></tr><tr><th>尾道</th><td>鐵支</td><td>+4</td></tr><tr><th>尾道</th><td>同花順</td><td>+5</td></tr></table>
    <p>輸的一方扣掉同樣的分數（照贏家那道的分數算）。</p>
    <p><b>打槍</b>：三道全贏某位對手，跟她之間的得分 ×2。<br><b>全壘打</b>：打槍所有對手，跟每個人的得分再 ×2（等於 ×4）。</p>
    <h4>特殊牌型（直接報到，不比牌、不會被打槍）</h4>
    <table class="ec-tbl">${Object.values(SPECIALS).map(s => `<tr><th>${s.name}</th><td>${s.desc}</td><td>+${s.pts}</td></tr>`).join('')}</table>
    <p>特殊分是向每位對手各拿一次。兩人都有特殊牌型時，比上表的順序（上面的大），一樣大就平手。</p>
    <h4>金幣</h4>
    <p>每 1 分 = 底注（新手桌約 1 分鐘收益，貴婦桌 ×10，名媛桌 ×100）。開局先押保證金 ${ESC_PTS} 分，結算時多退少補；中途離開保證金不退。</p>
    <h4>額外獎勵</h4><p>每局淨贏另得<b>寶石原石</b>（王國資源）；只要妳<b>打槍或全壘打</b>，還會得到一位對手的<b>角色碎片</b>；淨輸時，王國研究「貴婦返水」會退還一部分輸額。</p>
    <h4>省腦力</h4>
    <p><b>自動擺牌</b>（免費）：用啟發式挑幾種好擺法比較。<br><b>大師擺牌</b>（${MASTER} 粉鑽）：窮舉全部 72,072 種擺法，找出期望得分最高、一定不倒水的擺法。</p>`;

  function open(api) {
    C.use(api);
    const fmt = api.fmt, esc = api.esc, gemI = api.icons.gem();
    const store = () => {
      const s = api.store('poker13');
      for (const [k, v] of Object.entries({ tier: 0, games: 0, wins: 0, best: 0, net: 0, shots: 0, homeruns: 0, specials: 0 })) if (typeof s[k] !== 'number') s[k] = v;
      if (!s.tut || typeof s.tut !== 'object') s.tut = {};
      return s;
    };
    const cast = api.cast(), me = api.player();
    C.preload([1, 2, 3, 4].flatMap(i => ['neutral', 'joy', 'sad', 'angry'].map(e => cast[i].face(e))).concat([me.face('joy'), me.face('sad')]));
    let run = C.runner(), screen = 'title', G = null, rd = null, tierI = 0, base = 0, handNo = 0, opps = [1, 3, 4];
    const onResize = () => C.fitScale(o.body, 390, 780);
    const o = api.overlay({
      id: 'poker13', title: '名媛十三支',
      onClose() { run.kill(); removeEventListener('resize', onResize); },
      beforeClose() {
        if (screen === 'title') return true;
        if (rd && rd.stake > 0 && !rd.settled) {
          api.modal({ title: '牌局進行中', body: `<p class="mb">現在離開的話，<br>保證金 ${fmt(rd.stake)} 不會退回喔。</p>`, actions: [{ label: '繼續玩', cls: 'ghost' }, { label: '離開牌桌', fn: c => { c(); rd.settled = true; showTitle(); } }] });
          return false;
        }
        showTitle();
        return false;
      },
    });
    C.mount(o.root);
    const body = o.body;
    body.classList.add('ec-body');
    addEventListener('resize', onResize);
    onResize();
    function swapScreen(el) {
      [...body.querySelectorAll(':scope > .ec-screen')].forEach(old => { old.classList.add('leave'); setTimeout(() => old.remove(), 380); });
      el.classList.add('ec-screen', 'enter');
      body.appendChild(el);
      setTimeout(() => el.classList.remove('enter'), 600);
    }
    const nameOf = i => (i === 0 ? me.name : cast[opps[i - 1]].name);
    const faceOf = (i, e = 'neutral') => (i === 0 ? me.face(e) : cast[opps[i - 1]].face(e));
    const keyOf = i => OPP_KEYS[opps[i - 1]];
    const linesOf = i => LINES[keyOf(i)];

    // ---------- 標題 ----------
    function showTitle() {
      run.kill(); run = C.runner();
      rd = null; screen = 'title'; o.setTitle('名媛十三支');
      const st = store(), bu = api.betUnit();
      const tiers = C.TIERS.map(t => { const stake = bu * t.mult; return { ...t, stake, stakeLabel: '每分', need: stake * 20, locked: api.coins < stake * 20 }; });
      let ti = Math.min(st.tier || 0, 2);
      while (ti > 0 && tiers[ti].locked) ti--;
      tierI = ti;
      swapScreen(C.titleScreen({
        theme: 'jade', eyebrow: 'Salon de Jeux · Treize', title: '名媛十三支', en: 'Les Treize Cartes', tagline: '頭、中、尾三道，擺出最優雅的牌',
        chars: [{ src: cast[2].full, cls: 'l' }, { src: cast[1].full, cls: 'r' }, { src: cast[4].full, cls: 'c' }],
        fan: C.parse('10S JS QS KS AS'), tiers, tier: ti,
        stats: [['總局數', st.games], ['打槍', st.shots], ['單局最高贏', st.best > 0 ? fmt(st.best) : '—']],
        start: '入座開局',
        onTier(i) { tierI = i; store().tier = i; },
        onStart(i) { tierI = i; store().tier = i; startMatch(); },
        onRules: showRules,
      }));
    }
    function showRules() { C.sheet(body, { title: '名媛十三支・規則', html: `<div class="ec-rules">${RULES}</div>`, buttons: [{ id: 'ok', label: '我知道了', cls: 'goldb' }] }); }

    function startMatch() {
      base = api.betUnit() * C.TIERS[tierI].mult;
      if (api.coins < base * ESC_PTS) { api.toast('金幣不足，先到新手桌玩玩吧'); api.sound.err(); return; }
      const pool = C.shuffle([1, 2, 3, 4]);
      opps = pool.slice(0, 3);
      screen = 'game'; handNo = 0;
      o.setTitle('名媛十三支');
      run.kill(); run = C.runner();
      loop(run);
    }
    async function loop(R) {
      for (;;) {
        const next = await playHand(R);
        if (next !== 'again') { showTitle(); return; }
        if (api.coins < base * ESC_PTS) { api.toast('金幣不夠下一局了，回大廳換張桌子吧'); showTitle(); return; }
        if (Math.random() < 0.35) { const out = Math.floor(Math.random() * 3), cand = [1, 2, 3, 4].filter(x => !opps.includes(x)); opps[out] = cand[0]; }
      }
    }

    // ---------- 一局 ----------
    async function playHand(R) {
      handNo++;
      rd = { stake: 0, settled: false, hands: [], arr: [null, null, null, null], special: [null, null, null, null], done: [false, true, true, true] };
      rd.stake = base * ESC_PTS;
      if (!api.spendCoins(rd.stake)) { rd.stake = 0; return 'back'; }
      const d = C.shuffle(C.deck());
      rd.hands = [0, 1, 2, 3].map(i => d.slice(i * 13, i * 13 + 13));
      // 沙盒測試用：ErikaCards.poker13._force = ['13 張', …]（只在 ?sandbox 有效，用一次就清掉）
      if (api.sandbox && P._force) {
        const f = P._force.map(x => (x ? C.parse(x) : null)); P._force = null;
        const used = new Set(f.flat().filter(Boolean).map(C.cid)), rest = d.filter(c => !used.has(C.cid(c)));
        rd.hands = [0, 1, 2, 3].map(i => f[i] || rest.splice(0, 13));
      }
      for (let i = 1; i <= 3; i++) {
        const sp = detectSpecial(rd.hands[i]);
        const a = autoArrange(rd.hands[i], { noise: NOISE[keyOf(i)] });
        if (sp && sp.pts * 3 >= a.ev) { rd.special[i] = sp; rd.arr[i] = sp.rows; }
        else rd.arr[i] = a.rows;
        rd.done[i] = false;
      }
      const choice = await arrangePhase(R);
      if (choice.special) rd.special[0] = choice.special;
      rd.arr[0] = choice.rows;
      return showdown(R);
    }

    // ---------- 擺牌畫面 ----------
    function arrangePhase(R) {
      const t = C.TIERS[tierI];
      G = C.h(`<div class="p13-game">
        <div class="ec-felt jade"></div><div class="ec-rim"></div>
        <div class="p13-top"><span class="p13-chip"><b>${t.name}</b><span class="num">每分 ${fmt(base)}</span></span><span class="p13-round num">第 ${handNo} 局</span><button class="p13-tb p13-rulesb">規則</button></div>
        <div class="p13-opps">${[1, 2, 3].map(i => `<div class="p13-opp" data-i="${i}">${C.ava(faceOf(i))}<span class="p13-on"><b>${esc(nameOf(i))}</b><span class="p13-st">等待發牌</span></span><span class="p13-ostack"><i></i><i></i><i></i><b class="num">0</b></span></div>`).join('')}</div>
        <div class="p13-rows">${[0, 1, 2].map(r => `<div class="p13-row${r === 2 ? ' act' : ''}" data-r="${r}"><div class="p13-lab"><b>${ROWN[r]}</b><span class="p13-type"></span></div><div class="p13-slots">${'<span class="p13-slot"></span>'.repeat(CAP[r])}</div><i class="p13-warnr">倒水</i></div>`).join('')}</div>
        <div class="p13-tipbar"><span class="p13-tip"></span><button class="p13-sp" hidden></button><button class="p13-sort">依花色</button></div>
        <div class="p13-hand"></div>
        <div class="p13-bar">
          <button class="btn ghost" data-act="clear">清空</button>
          <button class="btn" data-act="auto">自動擺牌<small>免費</small></button>
          <button class="btn gemb" data-act="master">大師擺牌<small>${gemI}${MASTER}</small></button>
          <button class="btn goldb off" data-act="ok">確定<small>出牌</small></button>
        </div>
        <div class="p13-deck"></div>
        <div class="ec-fxl"></div>
      </div>`);
      swapScreen(G);
      onResize();
      const hand0 = rd.hands[0];
      const A = { rows: [[], [], []], hand: hand0.slice(), active: 2, sortBy: 'rank', locked: true, special: detectSpecial(hand0) };
      const els = new Map();
      const rowEl = r => G.querySelector(`.p13-row[data-r="${r}"]`);
      const slots = r => [...rowEl(r).querySelectorAll('.p13-slot')];
      const handEl = G.querySelector('.p13-hand');
      const tipEl = G.querySelector('.p13-tip');
      const sortHand = cs => cs.slice().sort(A.sortBy === 'rank' ? C.byRank : C.bySuit);
      const setTip = (html, cls = '') => { tipEl.innerHTML = html; tipEl.className = 'p13-tip ' + cls; };
      function update() {
        const full = A.rows.every((x, r) => x.length === CAP[r]);
        const v = full ? A.rows.map(evalRow) : null;
        const bad = [false, false, false];
        if (v) { if (v[0] > v[1]) bad[0] = bad[1] = true; if (v[1] > v[2]) bad[1] = bad[2] = true; }
        for (let r = 0; r < 3; r++) {
          const el = rowEl(r);
          el.classList.toggle('act', A.active === r && !full);
          el.classList.toggle('bad', bad[r]);
          el.classList.toggle('full', A.rows[r].length === CAP[r]);
          const nm = rowName(A.rows[r], r);
          let extra = '';
          if (A.rows[r].length === CAP[r]) { const b = rowBonus(r, evalRow(A.rows[r])); if (b > 1) extra = `<i>+${b}</i>`; }
          el.querySelector('.p13-type').innerHTML = nm ? `${nm}${extra}` : `${A.rows[r].length}/${CAP[r]}`;
        }
        G.querySelector('[data-act="ok"]').classList.toggle('off', !full);
        if (!A.locked) {
          if (full && (bad[0] || bad[1])) setTip(bad[0] && bad[1] ? '頭、中、尾都排反了，會<b>倒水</b>！' : bad[0] ? '頭道比中道大，會<b>倒水</b>！' : '中道比尾道大，會<b>倒水</b>！', 'warn');
          else if (full) setTip(`擺好了！期望得分 <b>${(expectedValue(A.rows) >= 0 ? '+' : '') + expectedValue(A.rows).toFixed(1)}</b>，按「確定」出牌`, 'ok');
          else if (A.hand.length === 13) setTip('點手牌放進<b>發亮的那一道</b>；點道上的牌可以收回');
          else setTip(`正在擺 <b>${ROWN[A.active]}</b>（還差 ${CAP[A.active] - A.rows[A.active].length} 張）`);
        }
      }
      function render(stagger) {
        const before = C.rects(els.values());
        for (let r = 0; r < 3; r++) { const sl = slots(r); sortRow(A.rows[r]).forEach((c, k) => sl[k].appendChild(els.get(C.cid(c)))); }
        for (const c of sortHand(A.hand)) handEl.appendChild(els.get(C.cid(c)));
        C.flipFrom(before, { dur: R.d(300), stagger: stagger || 0 });
        update();
      }
      const nextOpen = () => [2, 1, 0].find(x => A.rows[x].length < CAP[x]);
      function place(c) {
        let r = A.active;
        if (A.rows[r].length >= CAP[r]) r = nextOpen();
        if (r == null) return;
        A.rows[r].push(c);
        A.hand = A.hand.filter(x => x !== c);
        A.active = A.rows[r].length >= CAP[r] ? (nextOpen() ?? r) : r;
        C.sfx.deal(); api.vib(6);
        render();
        const full = A.rows.every((x, k) => x.length === CAP[k]);
        if (full) { if (isFoul(A.rows)) api.sound.err(); else { C.sfx.sparkle(); } }
      }
      function unplace(c, r) {
        A.rows[r] = A.rows[r].filter(x => x !== c);
        A.hand.push(c);
        A.active = r;
        api.sound.click();
        render();
      }
      function applyRows(rows) {
        A.rows = rows.map(x => x.slice());
        const used = new Set(A.rows.flat().map(C.cid));
        A.hand = hand0.filter(c => !used.has(C.cid(c)));
        A.active = nextOpen() ?? 2;
        render(18);
        C.sfx.shuffle();
      }
      const declareSpecial = () => sheetSpecial(A.special, autoArrange(hand0).ev).then(ok => { if (ok) finish({ rows: A.special.rows, special: A.special }); });
      let resolveFn;
      const done = new Promise(res => { resolveFn = res; });
      function finish(v) {
        if (A.finished) return;
        A.finished = true; A.locked = true;
        resolveFn(v);
      }
      // 事件
      handEl.addEventListener('click', e => { const el = e.target.closest('.ec-card'); if (!el || A.locked) return; place(el._card); });
      G.querySelector('.p13-rows').addEventListener('click', e => {
        if (A.locked) return;
        const el = e.target.closest('.ec-card'), row = e.target.closest('.p13-row');
        if (!row) return;
        const r = +row.dataset.r;
        if (el) unplace(el._card, r);
        else if (A.active !== r) { A.active = r; api.sound.click(); update(); }
      });
      G.querySelector('.p13-sort').addEventListener('click', e => {
        A.sortBy = A.sortBy === 'rank' ? 'suit' : 'rank';
        e.currentTarget.textContent = A.sortBy === 'rank' ? '依花色' : '依點數';
        api.sound.click(); render(8);
      });
      G.querySelector('.p13-rulesb').addEventListener('click', () => { api.sound.click(); showRules(); });
      G.querySelector('.p13-sp').addEventListener('click', () => { if (!A.locked && A.special) { api.sound.click(); declareSpecial(); } });
      G.querySelector('.p13-bar').addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b || A.locked) return;
        const act = b.dataset.act;
        if (act === 'clear') { if (!A.hand.length || A.rows.some(x => x.length)) { api.sound.click(); applyRows([[], [], []]); A.active = 2; update(); } return; }
        if (act === 'auto') { api.sound.click(); applyRows(autoArrange(hand0).rows); setTip('已用<b>自動擺牌</b>排好，可以再微調', 'ok'); api.stat('poker13_auto'); setTimeout(update, 1600); return; }
        if (act === 'master') {
          api.twoTap(b, () => {
            if (!api.spendGems(MASTER)) return;
            A.locked = true;
            G.classList.add('thinking');
            setTip('大師思考中…', 'gold');
            C.sfx.sparkle();
            run.sleep(650).then(() => {
              const res = masterArrange(hand0);
              G.classList.remove('thinking');
              A.locked = false;
              applyRows(res.rows);
              const p = C.ctr(G.querySelector('.p13-rows'));
              api.fx.burst(p.x, p.y, 18, ['spark', 'confetti']);
              setTip(`大師擺法：期望得分 <b>${(res.ev >= 0 ? '+' : '') + res.ev.toFixed(1)}</b>${A.special ? `（妳也可以直接報到「${A.special.name}」）` : ''}`, 'gold');
              api.stat('poker13_master');
            });
          }, () => { const sm = b.querySelector('small'); sm.innerHTML = b.dataset.confirm ? '再按一次' : `${gemI}${MASTER}`; });
          return;
        }
        if (act === 'ok') {
          if (b.classList.contains('off')) { api.sound.err(); api.shake(b); api.toast('還有牌沒擺完喔'); return; }
          if (isFoul(A.rows)) {
            api.sound.err();
            api.modal({ title: '倒水警告', body: '<p class="mb">現在的擺法<b>頭道＞中道</b>或<b>中道＞尾道</b>，<br>出牌會「倒水」：三道全輸，還算被打槍！</p>', actions: [{ label: '再調整', cls: 'ghost' }, { label: '照樣出牌', fn: c => { c(); finish({ rows: A.rows }); } }] });
            return;
          }
          api.sound.click(); api.vib(10);
          finish({ rows: A.rows });
        }
      });

      // 發牌演出
      (async () => {
        await R.sleep(420);
        const deck = G.querySelector('.p13-deck');
        for (let i = 0; i < 5; i++) { const b = C.cardEl(null, { size: 'md' }); b.style.setProperty('--i', i); deck.appendChild(b); }
        deck.classList.add('in', 'shuf'); C.sfx.shuffle();
        await R.sleep(800);
        deck.classList.remove('shuf');
        const dp = C.ctr(deck.lastElementChild), dw = deck.lastElementChild.getBoundingClientRect().width;
        const fx = G.querySelector('.ec-fxl'), fr = fx.getBoundingClientRect();
        const sorted = sortHand(hand0);
        const ps = [];
        const stackN = [0, 0, 0, 0];
        for (const c of sorted) { const el = C.cardEl(c, { size: 'md' }); el.style.visibility = 'hidden'; els.set(C.cid(c), el); handEl.appendChild(el); }
        let n = 0;
        for (let k = 0; k < 13; k++) {
          for (const i of [1, 2, 3, 0]) {
            C.sfx.deal(n++);
            if (i === 0) {
              const el = els.get(C.cid(rd.hands[0][k]));
              el.style.visibility = '';
              ps.push(C.dealFly(el, dp, { dur: R.d(320), fromW: dw }));
            } else {
              const tgt = G.querySelector(`.p13-opp[data-i="${i}"] .p13-ostack`);
              const tp = C.ctr(tgt);
              const fl = C.cardEl(null, { size: 'xs', cls: 'p13-flyer' });
              fl.style.left = (tp.x - fr.left) + 'px'; fl.style.top = (tp.y - fr.top) + 'px';
              fx.appendChild(fl);
              ps.push(C.dealFly(fl, dp, { dur: R.d(320), fromW: dw }).then(() => { fl.remove(); stackN[i]++; tgt.querySelector('b').textContent = stackN[i]; tgt.classList.add('has'); }));
            }
            await R.sleep(26);
          }
        }
        await R.wait(Promise.all(ps));
        deck.classList.remove('in'); deck.classList.add('out');
        for (const [k, c] of sorted.entries()) { C.flip(els.get(C.cid(c)), true); if (k % 2 === 0) C.sfx.flip(); await R.sleep(34); }
        await R.sleep(450);
        // AI 開始擺牌
        for (let i = 1; i <= 3; i++) {
          const st = G.querySelector(`.p13-opp[data-i="${i}"] .p13-st`);
          st.textContent = '擺牌中…'; st.className = 'p13-st think';
          R.sleep(1800 + Math.random() * 5200).then(() => aiDone(i));
        }
        A.locked = false;
        update();
        if (A.special) {
          const sp = G.querySelector('.p13-sp');
          sp.hidden = false; sp.textContent = `報到：${A.special.name}`;
          C.sfx.sparkle();
          await declareSpecial();
        }
        if (!store().tut.arrange && !A.finished) {
          store().tut.arrange = 1;
          await R.wait(C.guide(body, G.querySelector('.p13-rows'), '<b>擺牌</b>：點下面的手牌，會放進<b>發亮的那一道</b>（從尾道開始）。<br>記得 <b>尾道 ≥ 中道 ≥ 頭道</b>，不然會倒水！<br><small>懶得想？按「自動擺牌」，或用粉鑽請大師幫妳擺。</small>'));
        }
      })();
      function aiDone(i) {
        if (rd.done[i] || !G.isConnected) return;
        rd.done[i] = true;
        const st = G.querySelector(`.p13-opp[data-i="${i}"] .p13-st`);
        st.textContent = rd.special[i] ? '特殊牌型！' : '已擺好 ✓'; st.className = 'p13-st ok';
        C.sfx.pop();
        const seat = G.querySelector(`.p13-opp[data-i="${i}"]`);
        if (rd.special[i] || Math.random() < 0.45) C.bubble(seat, pickL(linesOf(i)[rd.special[i] ? 'special' : 'done']), { ms: 1900 });
      }
      return R.wait(done).then(async v => {
        G.querySelector('.p13-bar').classList.add('hide');
        setTip('等待其他名媛擺好…', 'gold');
        for (let i = 1; i <= 3; i++) if (!rd.done[i]) { await R.sleep(260 + Math.random() * 400); aiDone(i); }
        await R.sleep(500);
        return v;
      });
    }
    // 特殊牌型詢問
    function sheetSpecial(sp, normalEv) {
      const better = normalEv > sp.pts * 3 + 0.5;
      const rowsHTML = sp.rows.map((cs, r) => `<div class="p13-sprow"><b>${ROWN[r]}</b><span>${cs.map(c => `<i class="p13-mini ${C.isRed(c.s) ? 'red' : ''}">${C.label(c)}</i>`).join('')}</span></div>`).join('');
      return C.sheet(body, {
        title: `特殊牌型：${sp.name}！`, cls: 'p13-spsheet', dismiss: false,
        html: `<p class="ec-p">${sp.desc}。<br>直接<b>報到</b>可以向每位對手拿 <b>${sp.pts} 分</b>（不用比牌，也不會被打槍）。</p><div class="p13-sprows">${rowsHTML}</div>${better ? `<p class="p13-sphint">提示：這手牌照常擺也很強，自動擺牌的期望約 <b>+${normalEv.toFixed(1)} 分</b>，可能比報到（+${sp.pts * 3}）更划算！</p>` : ''}`,
        buttons: [{ id: 'no', label: '照常擺牌', cls: better ? 'goldb' : 'ghost' }, { id: 'yes', label: `報到 +${sp.pts}×3`, cls: better ? 'ghost' : 'goldb' }],
      }).then(v => v === 'yes');
    }

    // ---------- 開牌 ----------
    async function showdown(R) {
      const S = C.h(`<div class="p13-sd">
        <div class="ec-felt jade"></div><div class="ec-rim"></div><div class="p13-wm"><b>ERIKA</b><small>Les Treize</small></div>
        ${[2, 1, 3, 0].map(i => `<div class="p13-seat ${['mine', 'left', 'top', 'right'][i]}" data-i="${i}">
          <div class="p13-who">${C.ava(faceOf(i))}<span class="p13-nm"><b>${esc(nameOf(i))}</b><span class="p13-tot num"></span></span></div>
          <div class="p13-srows">${[0, 1, 2].map(r => `<div class="p13-srow" data-r="${r}"><div class="p13-scards"></div><div class="p13-slab"></div></div>`).join('')}</div>
        </div>`).join('')}
        <div class="p13-mid"><div class="p13-phase"><em>Révélation</em><b>開牌</b></div></div>
        <div class="ec-fxl"></div>
      </div>`);
      G = S;
      swapScreen(S);
      onResize();
      const seat = i => S.querySelector(`.p13-seat[data-i="${i}"]`);
      const srow = (i, r) => seat(i).querySelector(`.p13-srow[data-r="${r}"]`);
      const fxl = S.querySelector('.ec-fxl');
      const expr = (i, e) => { const im = seat(i).querySelector('.ec-ava img'); if (im) im.src = faceOf(i, e); };
      const phase = (en, zh) => { const p = S.querySelector('.p13-phase'); p.innerHTML = `<em>${en}</em><b>${zh}</b>`; C.anim(p, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.1)', offset: 0.7 }, { opacity: 1, transform: 'none' }], { duration: 380 }); };
      await R.sleep(450);
      // 發到桌上（蓋著）
      const cardsEls = [0, 1, 2, 3].map(() => [[], [], []]);
      const center = C.ctr(S.querySelector('.p13-mid'));
      const ps = [];
      for (let r = 0; r < 3; r++) {
        for (const i of [0, 1, 2, 3]) {
          const cs = sortRow(rd.arr[i][r]);
          for (const c of cs) {
            const el = C.cardEl(c, { size: i === 0 ? 'sm' : 'xs', face: false });
            srow(i, r).querySelector('.p13-scards').appendChild(el);
            cardsEls[i][r].push(el);
            ps.push(C.dealFly(el, center, { dur: R.d(300), scale: 0.6 }));
          }
          C.sfx.deal(r + i);
          await R.sleep(60);
        }
      }
      await R.wait(Promise.all(ps));
      const players = [0, 1, 2, 3].map(i => (rd.special[i] ? { special: rd.special[i] } : { rows: rd.arr[i] }));
      const res = scoreMatch(players);
      const flipRow = async (i, r) => { for (const el of cardsEls[i][r]) { C.setFace(el, el._card); C.flip(el, true); } C.sfx.flip(); await R.sleep(70); };
      const label = (i, r, html, cls = '') => { const l = srow(i, r).querySelector('.p13-slab'); l.innerHTML = html; l.className = 'p13-slab show ' + cls; };
      // 特殊牌型報到
      for (let i = 0; i < 4; i++) {
        const sp = rd.special[i];
        if (!sp) continue;
        for (let r = 0; r < 3; r++) await flipRow(i, r);
        seat(i).classList.add('sp');
        expr(i, 'joy');
        if (i > 0) C.bubble(seat(i), pickL(linesOf(i).special), { ms: 2000 });
        C.sfx.sparkle(); api.sound.ssr();
        const p = C.ctr(seat(i).querySelector('.p13-srows'));
        api.fx.burst(p.x, p.y, 24, ['spark', 'confetti', 'heart']);
        await R.wait(C.ribbon(fxl, `<b>${esc(nameOf(i))}・${sp.name}</b><small>報到！每人 +${sp.pts} 分</small>`, { cls: 'big', ms: R.d(1300) }));
      }
      // 三道依序開牌
      for (let r = 0; r < 3; r++) {
        phase(['Tête', 'Milieu', 'Queue'][r], ROWN[r]);
        api.sound.drum();
        await R.sleep(420);
        const live = [0, 1, 2, 3].filter(i => !rd.special[i]);
        for (const i of live) await flipRow(i, r);
        await R.sleep(380);
        let bestV = -1, bestI = -1;
        for (const i of live) { const v = res.info[i].v[r]; if (!res.info[i].foul && v > bestV) { bestV = v; bestI = i; } }
        for (const i of live) {
          const v = res.info[i].v[r], pts = res.rowPts[i][r], b = rowBonus(r, v);
          label(i, r, `<b>${CAT[catOf(v)]}${b > 1 ? `<u>+${b}</u>` : ''}</b><i class="num ${pts > 0 ? 'pos' : pts < 0 ? 'neg' : ''}">${C.signed(pts)}</i>`, i === bestI ? 'best' : '');
          if (i === bestI) srow(i, r).classList.add('best');
        }
        if (bestI >= 0 && rowBonus(r, bestV) > 1) { C.sfx.sparkle(); const p = C.ctr(srow(bestI, r)); api.fx.burst(p.x, p.y, 12, ['spark']); }
        else C.sfx.pop();
        if (bestI > 0 && Math.random() < 0.35) expr(bestI, 'joy');
        await R.sleep(1000);
      }
      // 倒水
      for (let i = 0; i < 4; i++) {
        if (!res.info[i].foul) continue;
        seat(i).classList.add('foul');
        expr(i, 'sad');
        C.sfx.sad();
        await R.wait(C.ribbon(fxl, `<b>${esc(nameOf(i))} 倒水</b><small>三道全輸</small>`, { cls: 'sad', ms: R.d(1000) }));
      }
      // 打槍（玫瑰花瓣）
      if (res.shots.length) phase('Bouquet', '打槍');
      for (const sh of res.shots) {
        if (res.info[sh.to].foul) continue; // 倒水已經演過
        const from = C.ctr(seat(sh.from).querySelector('.ec-ava')), to = C.ctr(seat(sh.to).querySelector('.p13-srows'));
        const lr = fxl.getBoundingClientRect();
        const rose = C.roseStamp(fxl, { cls: 'flyrose', x: (to.x - lr.left) + 'px', y: (to.y - lr.top) + 'px' });
        api.sound.hiss(0.25, 0.05, 2400);
        await R.wait(C.anim(rose, [
          { transform: `translate(${from.x - to.x}px,${from.y - to.y}px) scale(.5) rotate(-120deg)`, opacity: 0 },
          { transform: `translate(${(from.x - to.x) * 0.5}px,${(from.y - to.y) * 0.5 - 40}px) scale(1.1) rotate(-40deg)`, opacity: 1, offset: 0.5 },
          { transform: 'translate(0,0) scale(1.4) rotate(0)', opacity: 1 },
        ], { duration: R.d(520), easing: 'cubic-bezier(.3,.6,.4,1)' }));
        rose.remove();
        for (let r = 0; r < 3; r++) {
          const st = C.roseStamp(srow(sh.to, r).querySelector('.p13-scards'), { cls: 'stamp' });
          st.style.animationDelay = (r * 0.09) + 's';
          C.petals(fxl, C.ctr(srow(sh.to, r)), 9);
        }
        C.sfx.pop(); api.sound.beep(660, 0.12, 'triangle', 0.06, 0.08); api.vib([10, 30, 10]);
        expr(sh.from, 'joy'); expr(sh.to, sh.to > 0 && keyOf(sh.to) === 'chiyo' ? 'angry' : 'sad');
        if (sh.from > 0 && Math.random() < 0.8) C.bubble(seat(sh.from), pickL(linesOf(sh.from).shoot), { ms: 1800 });
        else if (sh.to > 0) C.bubble(seat(sh.to), pickL(linesOf(sh.to).shot), { ms: 1800 });
        await R.wait(C.ribbon(fxl, `<b>${esc(nameOf(sh.from))} 打槍 ${esc(nameOf(sh.to))}！</b><small>這組得分 ×2</small>`, { cls: 'shot', ms: R.d(1100) }));
      }
      // 全壘打
      if (res.homerun >= 0) {
        const h = res.homerun;
        phase('Grand Chelem', '全壘打');
        api.sound.ssr(); api.vib([20, 40, 20, 40, 30]);
        api.fx.rain('heart', 40); api.fx.rain('confetti', 50);
        for (let i = 0; i < 4; i++) if (i !== h) C.petals(fxl, C.ctr(seat(i)), 14);
        expr(h, 'joy');
        await R.wait(C.ribbon(fxl, `<b>全壘打！</b><small>${esc(nameOf(h))} 打槍所有人・得分再 ×2</small>`, { cls: 'big', ms: R.d(1600) }));
      }
      // 總分
      phase('Total', '結算');
      for (let i = 0; i < 4; i++) {
        const tt = seat(i).querySelector('.p13-tot');
        tt.className = 'p13-tot num show ' + (res.total[i] > 0 ? 'pos' : res.total[i] < 0 ? 'neg' : '');
        C.countUp(tt, res.total[i], R.d(700), v => C.signed(Math.round(v)) + ' 分');
        if (i > 0) expr(i, res.total[i] > 0 ? 'joy' : res.total[i] < 0 ? (keyOf(i) === 'chiyo' ? 'angry' : 'sad') : 'neutral');
      }
      expr(0, res.total[0] > 0 ? 'joy' : res.total[0] < 0 ? 'sad' : 'neutral');
      // 籌碼流向
      for (let i = 1; i < 4; i++) {
        const pr = res.pairs.find(p => p.i === 0 && p.j === i);
        if (!pr || !pr.pts) continue;
        const a = C.ctr(seat(pr.pts > 0 ? i : 0).querySelector('.ec-ava')), b = C.ctr(seat(pr.pts > 0 ? 0 : i).querySelector('.ec-ava'));
        C.flyChips(fxl, a, b, Math.min(10, 2 + Math.abs(pr.pts)), { dur: R.d(600) });
        await R.sleep(160);
      }
      await R.sleep(800);
      const net = res.total[0] * base;
      const final = rd.stake + net;
      if (final > 0) { const p = C.ctr(seat(0).querySelector('.ec-ava')); api.payout(final, p.x, p.y); }
      else if (final < 0) { const extra = Math.min(-final, api.coins); if (extra > 0) api.spendCoins(extra); }
      rd.settled = true;
      if (net > 0) { api.sound.cash(); api.vib([15, 30, 15]); } else if (net < 0) C.sfx.sad();
      const lp = C.ctr(seat(0).querySelector('.ec-ava'));
      const extras = C.linkage(api, { game: 'poker13', net, x: lp.x, y: lp.y, big: res.shots.some(s => s.from === 0) || res.homerun === 0, shardIds: opps.map(ci => cast[ci].id) });
      const st = store();
      st.games++; if (net > 0) st.wins++; st.best = Math.max(st.best, net); st.net += net;
      st.shots += res.shots.filter(s => s.from === 0).length;
      if (res.homerun === 0) st.homeruns++;
      if (rd.special[0]) st.specials++;
      api.stat('poker13_games'); if (net > 0) api.stat('poker13_wins');
      api.save();
      await R.sleep(1500);
      // 結算面板
      const myShots = res.shots.filter(s => s.from === 0).length;
      let title, tone;
      if (res.homerun === 0) { title = '全壘打！'; tone = 'big'; }
      else if (res.total[0] >= 10) { title = '大獲全勝！'; tone = 'big'; }
      else if (res.total[0] > 0) { title = '贏了！'; tone = 'win'; }
      else if (res.total[0] < 0) { title = res.info[0].foul ? '倒水了…' : '惜敗'; tone = 'lose'; }
      else { title = '平手'; tone = 'draw'; }
      if (tone === 'big') { api.fx.rain('confetti', 60); api.sound.level(); }
      const star = [1, 2, 3].reduce((a, b) => (res.total[b] > res.total[a] ? b : a), 1);
      const starWon = res.total[star] > 0;
      const descOf = i => {
        if (rd.special[i]) return `${rd.special[i].name}（報到）`;
        if (res.info[i].foul) return '倒水';
        const sh = res.shots.filter(s => s.from === i).length;
        return `${res.total[i] > 0 ? '+' : ''}${res.total[i]} 分${sh ? `・打槍 ${sh} 人` : ''}`;
      };
      const panel = C.resultPanel(S, {
        tone, title,
        sub: `妳 <b>${C.signed(res.total[0])}</b> 分 × 每分 ${fmt(base)}${myShots ? `・打槍 ${myShots} 人` : ''}${rd.special[0] ? `・${rd.special[0].name}` : ''}`,
        lines: [1, 2, 3].map(i => ({ img: faceOf(i, res.total[i] > 0 ? 'joy' : res.total[i] < 0 ? 'sad' : 'neutral'), name: nameOf(i), desc: descOf(i), amt: res.total[i] * base })),
        total: net, totalLabel: '妳本局輸贏', extras,
        char: { img: faceOf(star, starWon ? 'joy' : 'sad'), name: nameOf(star), line: pickL(linesOf(star)[starWon ? 'win' : 'lose']) },
        buttons: [{ id: 'back', label: '回大廳', cls: 'ghost' }, { id: 'again', label: '再來一局', cls: 'goldb' }],
      });
      return R.wait(panel.choice);
    }

    showTitle();
  }

  (W.ErikaGames = W.ErikaGames || []).push({
    id: 'poker13', order: 4, name: '名媛十三支', tagline: '頭中尾三道比大小', color: '#2f8f6b', color2: '#123d33', badge: '新',
    art: api => `<img src="${api.cast()[4].full}" alt="" style="height:96%;left:50%;bottom:-6%;transform:translateX(-50%)"><svg viewBox="0 0 120 80" aria-hidden="true" style="position:absolute;left:4%;bottom:26%;width:54%;filter:drop-shadow(0 4px 6px rgba(0,30,20,.45))"><defs><linearGradient id="p13l-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3cf"/><stop offset=".5" stop-color="#d9b062"/><stop offset="1" stop-color="#9c742f"/></linearGradient></defs>${[-24, -12, 0, 12, 24].map((a, i) => `<g transform="translate(60 76) rotate(${a}) translate(-15 -54)"><rect width="30" height="44" rx="4" fill="#fffaf0" stroke="url(#p13l-g)" stroke-width="1.5"/><text x="5" y="13" font-size="11" font-weight="700" font-family="Georgia,serif" fill="#46194f">${['10', 'J', 'Q', 'K', 'A'][i]}</text><text x="15" y="33" text-anchor="middle" font-size="15" fill="#46194f">♠</text></g>`).join('')}</svg>`,
    open,
  });
})();
