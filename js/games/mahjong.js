// 貴婦麻將館 — 台灣十六張麻將（三位名媛陪妳打）
// 結構：Core（純函式：判胡、拆牌、向聽、聽牌、台數、AI、牌局引擎；可在 node 用 vm 載入測試）＋ UI（牌桌畫面與演出）
'use strict';
(() => {
  // =====================================================================
  // Core：規則與 AI（不碰 DOM）
  // 牌的編號：id 0–135 為一般牌（kind = id>>2，每種 4 張），136–143 為花牌（kind 34–41）
  // kind：0–8 萬、9–17 筒、18–26 條、27–30 東南西北、31–33 中發白、34–37 春夏秋冬、38–41 梅蘭竹菊
  // =====================================================================
  const Core = (() => {
    const RESERVE = 16; // 海底留牌
    const NUM = '一二三四五六七八九', HON = '東南西北中發白', FLW = '春夏秋冬梅蘭竹菊', SUIT = '萬筒條';
    const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    const cnNum = n => (n <= 10 ? CN[n] : n < 20 ? '十' + CN[n - 10] : String(n));
    const kindOf = id => (id < 136 ? id >> 2 : 34 + (id - 136));
    const isFlower = k => k >= 34;
    const isHonor = k => k >= 27 && k < 34;
    const isWind = k => k >= 27 && k <= 30;
    const isDragon = k => k >= 31 && k <= 33;
    const suitOf = k => (k < 27 ? (k / 9) | 0 : 3);
    const tileName = k => (k < 27 ? NUM[k % 9] + SUIT[(k / 9) | 0] : k < 34 ? HON[k - 27] : FLW[k - 34]);
    const WIND = '東南西北';

    // ---------- 亂數 ----------
    function rngFrom(seed) {
      let a = seed >>> 0;
      return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

    // ---------- 計數 ----------
    function countsOf(ids) { const c = new Array(34).fill(0); for (const t of ids) { const k = kindOf(t); if (k < 34) c[k]++; } return c; }
    function countsK(kinds) { const c = new Array(34).fill(0); for (const k of kinds) if (k < 34) c[k]++; return c; }
    const total = c => { let n = 0; for (let i = 0; i < 34; i++) n += c[i]; return n; };

    // ---------- 判胡（張數 3M+2：M 組＋1 對） ----------
    function meldsOnly(c) { // c 會被改動
      for (let i = 0; i < 34; i++) {
        let v = c[i];
        if (!v) continue;
        if (v >= 3) v -= 3;
        if (v) {
          if (i >= 27 || i % 9 > 6 || c[i + 1] < v || c[i + 2] < v) return false;
          c[i + 1] -= v; c[i + 2] -= v;
        }
        c[i] = 0;
      }
      return true;
    }
    function isWin(c) {
      if (total(c) % 3 !== 2) return false;
      for (let i = 0; i < 34; i++) if (c[i] >= 2) { const d = c.slice(); d[i] -= 2; if (meldsOnly(d)) return true; }
      return false;
    }
    const nearK = (c, j) => {
      if (c[j]) return true;
      if (j >= 27) return false;
      const r = j % 9;
      return (r > 0 && c[j - 1] > 0) || (r > 1 && c[j - 2] > 0) || (r < 8 && c[j + 1] > 0) || (r < 7 && c[j + 2] > 0);
    };
    // 聽牌（張數 3M+1）：回傳能胡的牌種（不管牌是否還剩）
    function waits(c) {
      const out = [];
      if (total(c) % 3 !== 1) return out;
      for (let k = 0; k < 34; k++) {
        if (c[k] >= 4 || !nearK(c, k)) continue;
        c[k]++; if (isWin(c)) out.push(k); c[k]--;
      }
      return out;
    }
    // 所有拆法：{ pair, melds:[{t:'seq'|'tri', k}] }
    function decompositions(c) {
      const res = [], seen = new Set();
      for (let p = 0; p < 34; p++) {
        if (c[p] < 2) continue;
        const d = c.slice(); d[p] -= 2;
        const melds = [];
        const rec = i => {
          while (i < 34 && !d[i]) i++;
          if (i === 34) {
            const key = p + ':' + melds.map(m => m.t[0] + m.k).sort().join(',');
            if (!seen.has(key)) { seen.add(key); res.push({ pair: p, melds: melds.map(m => ({ ...m })) }); }
            return;
          }
          if (d[i] >= 3) { d[i] -= 3; melds.push({ t: 'tri', k: i }); rec(i); melds.pop(); d[i] += 3; }
          if (i < 27 && i % 9 <= 6 && d[i + 1] && d[i + 2]) { d[i]--; d[i + 1]--; d[i + 2]--; melds.push({ t: 'seq', k: i }); rec(i); melds.pop(); d[i]++; d[i + 1]++; d[i + 2]++; }
        };
        rec(0);
      }
      return res;
    }

    // ---------- 向聽數（一般型，M 組＋1 對）：-1 = 已胡、0 = 聽牌 ----------
    const memoS = new Map(), memoH = new Map();
    function pareto(list) {
      const out = [];
      for (const a of list) {
        let dom = false;
        for (let i = out.length - 1; i >= 0; i--) {
          const b = out[i];
          if (b[2] !== a[2]) continue;
          if (b[0] >= a[0] && b[1] >= a[1]) { dom = true; break; }
          if (a[0] >= b[0] && a[1] >= b[1]) out.splice(i, 1);
        }
        if (!dom) out.push(a);
      }
      return out;
    }
    function gOpts(a, seq, memo) {
      let key = 0;
      for (let i = 0; i < a.length; i++) key = key * 5 + a[i];
      let r = memo.get(key);
      if (r) return r;
      let i = 0;
      while (i < a.length && !a[i]) i++;
      if (i === a.length) { r = [[0, 0, 0]]; memo.set(key, r); return r; }
      const out = [];
      const take = (dm, dt, dj) => { for (const x of gOpts(a, seq, memo)) if (x[2] + dj <= 1) out.push([x[0] + dm, x[1] + dt, x[2] + dj]); };
      if (a[i] >= 3) { a[i] -= 3; take(1, 0, 0); a[i] += 3; }
      if (seq && i + 2 < a.length && a[i + 1] && a[i + 2]) { a[i]--; a[i + 1]--; a[i + 2]--; take(1, 0, 0); a[i]++; a[i + 1]++; a[i + 2]++; }
      if (a[i] >= 2) { a[i] -= 2; take(0, 0, 1); take(0, 1, 0); a[i] += 2; }
      if (seq && i + 1 < a.length && a[i + 1]) { a[i]--; a[i + 1]--; take(0, 1, 0); a[i]++; a[i + 1]++; }
      if (seq && i + 2 < a.length && a[i + 2]) { a[i]--; a[i + 2]--; take(0, 1, 0); a[i]++; a[i + 2]++; }
      a[i]--; take(0, 0, 0); a[i]++;
      r = pareto(out);
      memo.set(key, r);
      return r;
    }
    function shanten(c) {
      const M = Math.floor(total(c) / 3);
      let acc = [[0, 0, 0]];
      for (let g = 0; g < 4; g++) {
        const a = g < 3 ? c.slice(g * 9, g * 9 + 9) : c.slice(27, 34);
        const o = gOpts(a, g < 3, g < 3 ? memoS : memoH);
        const next = [];
        for (const x of acc) for (const y of o) if (x[2] + y[2] <= 1) next.push([x[0] + y[0], x[1] + y[1], x[2] + y[2]]);
        acc = pareto(next);
      }
      let best = 99;
      for (const [m0, t0, j] of acc) {
        const m = Math.min(m0, M), t = Math.min(t0, M - m);
        const s = 2 * M - 2 * m - t - j;
        if (s < best) best = s;
      }
      return best;
    }
    // 3M+2 張時：打掉一張後的最小向聽
    function bestDiscardShanten(c) {
      let best = 99;
      for (let k = 0; k < 34; k++) if (c[k]) { c[k]--; const s = shanten(c); c[k]++; if (s < best) best = s; }
      return best;
    }
    function ukeire(c, s, u) {
      let n = 0;
      for (let j = 0; j < 34; j++) {
        if (!u[j] || !nearK(c, j)) continue;
        c[j]++; if (shanten(c) < s) n += u[j]; c[j]--;
      }
      return n;
    }

    // ---------- 台數 ----------
    // x = { hand: [kind…]（暗手，含胡的那張）, melds: [{type:'chi'|'pon'|'mkong'|'akong'|'kkong', k}], flowers: [kind…],
    //       win: kind, self: 自摸?, seat: 門風 0–3, round: 圈風 0–3, kongDraw, haitei, houtei, robKong, tenhou, chihou }
    function placements(d, win) {
      const out = [];
      if (d.pair === win) out.push({ where: 'pair' });
      d.melds.forEach((m, i) => {
        if (m.t === 'tri' && m.k === win) out.push({ where: 'tri', i });
        if (m.t === 'seq' && win >= m.k && win <= m.k + 2) out.push({ where: 'seq', i, pos: win - m.k });
      });
      return out;
    }
    function evalHand(x, d, pl, waitCount) {
      const items = [];
      const add = (name, tai, key) => items.push({ name, tai, key: key || name });
      const all = d.melds.map((m, i) => ({ t: m.t, k: m.k, conceal: !(m.t === 'tri' && !x.self && pl.where === 'tri' && pl.i === i) }));
      for (const m of x.melds) all.push({ t: m.type === 'chi' ? 'seq' : 'tri', k: m.k, conceal: m.type === 'akong', kong: /kong/.test(m.type) });
      const menqing = x.melds.every(m => m.type === 'akong');
      const special = x.tenhou || x.chihou;
      if (x.tenhou) add('天胡', 16, 'tenhou');
      else if (x.chihou) add('地胡', 16, 'chihou');
      if (!special) {
        if (menqing && x.self) add('不求人（門清自摸）', 3, 'menzimo');
        else if (menqing) add('門清', 1, 'menqing');
        else if (x.self) add('自摸', 1, 'zimo');
      }
      const quanqiu = x.melds.length >= 5 && x.melds.every(m => m.type !== 'akong') && !x.self;
      if (quanqiu) add('全求人', 2, 'quanqiu');
      // 花色
      const kinds = x.hand.slice();
      for (const m of x.melds) { if (m.type === 'chi') kinds.push(m.k, m.k + 1, m.k + 2); else kinds.push(m.k); }
      const suits = new Set(kinds.filter(k => k < 27).map(suitOf));
      const hasHonor = kinds.some(isHonor);
      const allTri = all.every(m => m.t === 'tri');
      if (!suits.size) add('字一色', 16, 'ziyise');
      else if (suits.size === 1 && !hasHonor) add('清一色', 8, 'qingyise');
      else if (suits.size === 1) add('混一色', 4, 'hunyise');
      if (allTri && suits.size) add('碰碰胡', 4, 'pengpeng');
      // 平胡：全順子、將不是字、無花、非自摸、聽兩面
      if (all.every(m => m.t === 'seq') && !isHonor(d.pair) && !x.flowers.length && !x.self && pl.where === 'seq') {
        const r = all[pl.i].k % 9;
        if ((pl.pos === 0 && r <= 5) || (pl.pos === 2 && r >= 1)) add('平胡', 2, 'pinghu');
      }
      // 暗刻
      const an = all.filter(m => m.t === 'tri' && m.conceal).length;
      if (an >= 5) add('五暗刻', 8, 'an5'); else if (an === 4) add('四暗刻', 5, 'an4'); else if (an === 3) add('三暗刻', 2, 'an3');
      // 三元
      const dr = all.filter(m => m.t === 'tri' && isDragon(m.k));
      if (dr.length === 3) add('大三元', 8, 'dasanyuan');
      else if (dr.length === 2 && isDragon(d.pair)) add('小三元', 4, 'xiaosanyuan');
      else for (const m of dr) add(`三元牌（${tileName(m.k)}）`, 1, 'dragon');
      // 風
      const wd = all.filter(m => m.t === 'tri' && isWind(m.k));
      if (wd.length === 4) add('大四喜', 16, 'dasixi');
      else if (wd.length === 3 && isWind(d.pair)) add('小四喜', 8, 'xiaosixi');
      else for (const m of wd) {
        if (m.k - 27 === x.round) add(`圈風（${tileName(m.k)}）`, 1, 'roundwind');
        if (m.k - 27 === x.seat) add(`門風（${tileName(m.k)}）`, 1, 'seatwind');
      }
      // 花
      for (const base of [34, 38]) {
        const have = x.flowers.filter(f => f >= base && f < base + 4);
        if (have.length === 4) add(`花槓（${FLW.slice(base - 34, base - 30)}）`, 2, 'huagang');
        else for (const f of have) if ((f - 34) % 4 === x.seat) add(`正花（${tileName(f)}）`, 1, 'zhenghua');
      }
      if (x.self && x.kongDraw) add('槓上開花', 1, 'gangkai');
      if (x.self && x.haitei) add('海底撈月', 1, 'haidi');
      if (!x.self && x.houtei) add('河底撈魚', 1, 'hedi');
      if (x.robKong) add('搶槓', 1, 'qianggang');
      if (waitCount === 1 && !quanqiu) add('獨聽', 1, 'duting');
      return { items, total: items.reduce((a, b) => a + b.tai, 0), decomposition: d };
    }
    function score(x) {
      const c = countsK(x.hand);
      if (!isWin(c)) return null;
      const pre = c.slice(); pre[x.win]--;
      const waitCount = waits(pre).length;
      let best = null;
      for (const d of decompositions(c)) for (const pl of placements(d, x.win)) {
        const r = evalHand(x, d, pl, waitCount);
        if (!best || r.total > best.total) best = r;
      }
      return best;
    }
    function dealerItems(streak) {
      const it = [{ name: '莊家', tai: 1, key: 'dealer' }];
      if (streak > 0) it.push({ name: `連${cnNum(streak)}拉${cnNum(streak)}`, tai: 2 * streak, key: 'lianzhuang' });
      return it;
    }
    function payments(dealer, streak, winner, from, baseTai, di = 1, unit = 1) {
      const payers = from == null ? [0, 1, 2, 3].filter(q => q !== winner) : [from];
      return payers.map(q => {
        const extra = winner === dealer || q === dealer ? 1 + 2 * streak : 0;
        const tai = baseTai + extra;
        return { from: q, to: winner, tai, extra, amount: Math.round(di + tai * unit) };
      });
    }

    // ---------- 牌局引擎 ----------
    const ABORT = { abort: true };
    const live = S => S.wall.length - RESERVE;
    const seatWind = (S, p) => (p - S.dealer + 4) % 4;
    function chiOptions(c, k) {
      if (k >= 27) return [];
      const r = k % 9, out = [];
      if (r >= 2 && c[k - 2] && c[k - 1]) out.push([k - 2, k - 1]);
      if (r >= 1 && r <= 7 && c[k - 1] && c[k + 1]) out.push([k - 1, k + 1]);
      if (r <= 6 && c[k + 1] && c[k + 2]) out.push([k + 1, k + 2]);
      return out;
    }
    function newState(cfg) {
      const rng = cfg.rng || Math.random;
      const d = cfg.dealer || 0;
      return {
        rng, wall: shuffle(Array.from({ length: 144 }, (_, i) => i), rng), dealer: d, round: cfg.round || 0, streak: cfg.streak || 0,
        hands: [[], [], [], []], melds: [[], [], [], []], flowers: [[], [], [], []], river: [[], [], [], []],
        drawn: [null, null, null, null], first: [true, true, true, true], pass: [false, false, false, false],
        anyCall: false, turn: d, last: null, phase: 'deal', result: null, discards: 0,
      };
    }
    async function drawFor(S, p, back, emit) {
      if (live(S) <= 0) return null;
      let t = back ? S.wall.pop() : S.wall.shift();
      S.hands[p].push(t); S.drawn[p] = t;
      await emit({ t: 'draw', p, tile: t, back });
      while (kindOf(t) >= 34) {
        S.hands[p].splice(S.hands[p].indexOf(t), 1); S.flowers[p].push(t); S.drawn[p] = null;
        await emit({ t: 'flower', p, tile: t });
        if (live(S) <= 0) return null;
        t = S.wall.pop(); S.hands[p].push(t); S.drawn[p] = t;
        await emit({ t: 'draw', p, tile: t, back: true });
      }
      return t;
    }
    async function initFlowers(S, emit) {
      for (let i = 0; i < 4; i++) {
        const p = (S.dealer + i) % 4;
        for (;;) {
          const f = S.hands[p].find(t => kindOf(t) >= 34);
          if (f == null) break;
          S.hands[p].splice(S.hands[p].indexOf(f), 1); S.flowers[p].push(f);
          await emit({ t: 'flower', p, tile: f, init: true });
          if (live(S) <= 0) return false;
          const t = S.wall.pop(); S.hands[p].push(t);
          await emit({ t: 'draw', p, tile: t, back: true, init: true });
        }
      }
      return true;
    }
    // 開局換三張：把 ids 換成活牌區隨機三張
    function swapTiles(S, p, ids) {
      const got = [];
      for (const id of ids) {
        const i = S.hands[p].indexOf(id);
        if (i < 0) continue;
        const j = Math.floor(S.rng() * Math.max(1, live(S)));
        const t = S.wall[j]; S.wall[j] = id; S.hands[p][i] = t; got.push(t);
      }
      return got;
    }
    async function finishWin(S, emit, cfg, w) {
      const p = w.winner;
      const ctx = {
        hand: S.hands[p].map(kindOf), melds: S.melds[p].map(m => ({ type: m.type, k: m.k })), flowers: S.flowers[p].map(kindOf),
        win: kindOf(w.tile), self: w.from == null, seat: seatWind(S, p), round: S.round,
        kongDraw: !!w.kongDraw, haitei: !!w.haitei, houtei: !!w.houtei, robKong: !!w.robKong, tenhou: !!w.tenhou, chihou: !!w.chihou,
      };
      const sc = score(ctx);
      if (!sc) throw new Error('判胡失敗');
      const res = { type: 'win', winner: p, from: w.from, tile: w.tile, score: sc, ctx, pays: payments(S.dealer, S.streak, p, w.from, sc.total, cfg.di, cfg.unit) };
      S.result = res; S.phase = 'end';
      await emit({ t: 'win', res });
      return { S, res };
    }
    async function finishDraw(S, emit) {
      const res = { type: 'draw' };
      S.result = res; S.phase = 'end';
      await emit({ t: 'exhaust', res });
      return { S, res };
    }
    async function playHand(cfg, agents, hooks = {}) {
      const S = newState(cfg);
      const aborted = () => hooks.abort && hooks.abort();
      const emit = async ev => { if (hooks.on) await hooks.on(ev, S); if (aborted()) throw ABORT; };
      const d = S.dealer;
      for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) S.hands[(d + i) % 4].push(...S.wall.splice(0, 4));
      S.hands[d].push(S.wall.shift());
      if (cfg.rig) cfg.rig(S);
      await emit({ t: 'deal' });
      S.phase = 'flower';
      if (!(await initFlowers(S, emit))) return finishDraw(S, emit);
      if (hooks.pregame) {
        await hooks.pregame(S);
        if (aborted()) throw ABORT;
        if (!(await initFlowers(S, emit))) return finishDraw(S, emit);
      }
      S.phase = 'play';
      S.drawn[d] = S.hands[d][S.hands[d].length - 1];
      await emit({ t: 'start' });
      let p = d, mode = 'draw', kongDraw = false;
      for (let guard = 0; guard < 3000; guard++) {
        S.turn = p;
        const hand = S.hands[p];
        const c = countsOf(hand);
        const canKong = live(S) > 0 && mode === 'draw';
        const info = {
          mode, kongDraw,
          canHu: mode === 'draw' && isWin(c),
          akongs: canKong ? c.map((v, k) => (v === 4 ? k : -1)).filter(k => k >= 0) : [],
          kkongs: canKong ? S.melds[p].filter(m => m.type === 'pon' && c[m.k] > 0).map(m => m.k) : [],
        };
        await emit({ t: 'turn', p, info });
        const act = (await agents[p].turn(S, p, info)) || {};
        if (aborted()) throw ABORT;
        if (act.a === 'hu' && info.canHu) {
          const tile = S.drawn[p] != null && hand.includes(S.drawn[p]) ? S.drawn[p] : hand[hand.length - 1];
          return finishWin(S, emit, cfg, {
            winner: p, from: null, tile, kongDraw, haitei: live(S) === 0,
            tenhou: p === d && S.first[p] && !S.anyCall, chihou: p !== d && S.first[p] && !S.anyCall,
          });
        }
        if (act.a === 'akong' && info.akongs.includes(act.k)) {
          const tiles = hand.filter(t => kindOf(t) === act.k);
          for (const t of tiles) hand.splice(hand.indexOf(t), 1);
          const meld = { type: 'akong', k: act.k, tiles, from: null };
          S.melds[p].push(meld); S.anyCall = true; S.drawn[p] = null;
          await emit({ t: 'kong', p, meld });
          if ((await drawFor(S, p, true, emit)) == null) return finishDraw(S, emit);
          kongDraw = true; mode = 'draw';
          continue;
        }
        if (act.a === 'kkong' && info.kkongs.includes(act.k)) {
          const tile = hand.find(t => kindOf(t) === act.k);
          hand.splice(hand.indexOf(tile), 1); S.drawn[p] = null;
          const meld = S.melds[p].find(m => m.type === 'pon' && m.k === act.k);
          await emit({ t: 'kkong', p, tile, meld });
          for (let i = 1; i < 4; i++) {
            const q = (p + i) % 4;
            if (S.pass[q]) continue;
            const cq = countsOf(S.hands[q]); cq[act.k]++;
            if (!isWin(cq)) continue;
            const r = (await agents[q].claim(S, q, tile, p, { hu: true, rob: true })) || {};
            if (aborted()) throw ABORT;
            if (r.a === 'hu') { S.hands[q].push(tile); return finishWin(S, emit, cfg, { winner: q, from: p, tile, robKong: true }); }
            S.pass[q] = true;
          }
          meld.type = 'kkong'; meld.tiles.push(tile); S.anyCall = true;
          await emit({ t: 'kong', p, meld });
          if ((await drawFor(S, p, true, emit)) == null) return finishDraw(S, emit);
          kongDraw = true; mode = 'draw';
          continue;
        }
        // 打牌
        let tile = act.tile;
        if (act.a !== 'discard' || !hand.includes(tile) || kindOf(tile) >= 34) tile = S.drawn[p] != null && hand.includes(S.drawn[p]) ? S.drawn[p] : hand[hand.length - 1];
        hand.splice(hand.indexOf(tile), 1);
        S.river[p].push(tile); S.drawn[p] = null; S.first[p] = false; kongDraw = false; S.discards++;
        S.last = { p, tile };
        await emit({ t: 'discard', p, tile });
        const k = kindOf(tile);
        const asks = [];
        for (let i = 1; i < 4; i++) {
          const q = (p + i) % 4, cq = countsOf(S.hands[q]), o = {};
          if (!S.pass[q]) { cq[k]++; if (isWin(cq)) o.hu = true; cq[k]--; }
          if (cq[k] >= 2) o.pon = true;
          if (cq[k] >= 3 && live(S) > 0) o.kong = true;
          if (i === 1) { const ch = chiOptions(cq, k); if (ch.length) o.chi = ch; }
          if (o.hu || o.pon || o.kong || o.chi) asks.push({ q, i, o });
        }
        if (asks.length) {
          const ans = await Promise.all(asks.map(x => Promise.resolve(agents[x.q].claim(S, x.q, tile, p, x.o)).then(r => ({ ...x, r: r || { a: 'pass' } }))));
          if (aborted()) throw ABORT;
          for (const x of ans) if (x.o.hu && x.r.a !== 'hu') S.pass[x.q] = true;
          const hu = ans.filter(x => x.o.hu && x.r.a === 'hu').sort((a, b) => a.i - b.i)[0];
          if (hu) {
            S.river[p].pop(); S.hands[hu.q].push(tile);
            return finishWin(S, emit, cfg, { winner: hu.q, from: p, tile, houtei: live(S) === 0 });
          }
          const pk = ans.find(x => (x.r.a === 'pon' && x.o.pon) || (x.r.a === 'kong' && x.o.kong));
          const ch = pk ? null : ans.find(x => x.r.a === 'chi' && x.o.chi);
          const w = pk || ch;
          if (w) {
            const q = w.q, h = S.hands[q];
            S.river[p].pop(); S.anyCall = true; S.pass[q] = false;
            const takeK = kk => { const t = h.find(x => kindOf(x) === kk); h.splice(h.indexOf(t), 1); return t; };
            let meld;
            if (w.r.a === 'chi') {
              const combo = w.o.chi[Math.max(0, Math.min(w.o.chi.length - 1, w.r.i | 0))];
              const ts = [takeK(combo[0]), takeK(combo[1]), tile].sort((a, b) => kindOf(a) - kindOf(b));
              meld = { type: 'chi', k: Math.min(combo[0], combo[1], k), tiles: ts, taken: tile, from: p };
            } else if (w.r.a === 'pon') meld = { type: 'pon', k, tiles: [takeK(k), takeK(k), tile], taken: tile, from: p };
            else meld = { type: 'mkong', k, tiles: [takeK(k), takeK(k), takeK(k), tile], taken: tile, from: p };
            S.melds[q].push(meld);
            await emit({ t: 'call', p: q, from: p, meld, call: w.r.a });
            p = q;
            if (meld.type === 'mkong') {
              if ((await drawFor(S, q, true, emit)) == null) return finishDraw(S, emit);
              mode = 'draw'; kongDraw = true;
            } else mode = 'call';
            continue;
          }
        }
        if (live(S) <= 0) return finishDraw(S, emit);
        p = (p + 1) % 4; S.pass[p] = false;
        if ((await drawFor(S, p, false, emit)) == null) return finishDraw(S, emit);
        mode = 'draw';
      }
      throw new Error('牌局迴圈超過上限');
    }
    // 一將的進行：莊家胡或流局 → 連莊；否則下莊，輪回起莊家時換圈
    function nextSession(sess, res) {
      const stay = res.type === 'draw' || res.winner === sess.dealer;
      if (stay) sess.streak++;
      else {
        sess.dealer = (sess.dealer + 1) % 4; sess.streak = 0;
        if (sess.dealer === sess.startDealer) sess.round++;
      }
      sess.hands++;
      sess.done = sess.mode === 'single' || (sess.mode === 'round' && sess.round >= 1) || sess.round >= 4;
      return sess;
    }

    // ---------- AI ----------
    function unseenFor(S, p) {
      const u = new Array(34).fill(4);
      const dec = t => { const k = kindOf(t); if (k < 34 && u[k] > 0) u[k]--; };
      S.hands[p].forEach(dec);
      for (let q = 0; q < 4; q++) { S.river[q].forEach(dec); for (const m of S.melds[q]) if (m.type !== 'akong' || q === p) m.tiles.forEach(dec); }
      return u;
    }
    function keepValue(k, c, S, p) {
      if (k >= 27) {
        const val = k >= 31 || k - 27 === seatWind(S, p) || k - 27 === S.round;
        return c[k] >= 2 ? (val ? 6 : 3) : val ? 1.2 : 0;
      }
      const r = k % 9;
      return r === 0 || r === 8 ? 1 : r === 1 || r === 7 ? 2 : 3;
    }
    function threatsOf(S, p) {
      const out = [];
      for (let q = 0; q < 4; q++) {
        if (q === p) continue;
        const m = S.melds[q].length;
        if (m >= 3 || (m >= 2 && S.river[q].length >= 7) || (live(S) < 24 && m >= 1) || live(S) < 12) out.push(q);
      }
      return out;
    }
    function safety(k, threats, S, u) {
      let s = 100;
      for (const q of threats) {
        let v;
        if (k >= 27) v = u[k] === 0 ? 98 : u[k] === 1 ? 80 : 45;
        else if (S.river[q].some(t => kindOf(t) === k)) v = 62;
        else { const r = k % 9; v = r === 0 || r === 8 ? 35 : r === 1 || r === 7 ? 22 : 10; }
        s = Math.min(s, v);
      }
      return s;
    }
    // 回傳要打的牌 id；也回傳評估（給「建議」用）
    function aiDiscardEval(S, p, level, rng = Math.random) {
      const hand = S.hands[p], c = countsOf(hand), u = unseenFor(S, p);
      const kinds = [...new Set(hand.map(kindOf))].filter(k => k < 34);
      const ev = kinds.map(k => { c[k]--; const s = shanten(c); c[k]++; return { k, s }; });
      const minS = Math.min(...ev.map(e => e.s));
      let pool = ev.filter(e => e.s === minS);
      let pickK;
      if (level <= 0) {
        if (rng() < 0.3) pool = ev.filter(e => e.s <= minS + 1);
        for (const e of pool) e.v = -keepValue(e.k, c, S, p) + rng() * 2.5;
      } else {
        for (const e of pool) { c[e.k]--; e.uk = ukeire(c, e.s, u); c[e.k]++; e.v = e.uk * 10 - keepValue(e.k, c, S, p) * (level >= 2 ? 3 : 2) + rng() * 0.5; }
        if (level >= 2 && minS >= 2) {
          const th = threatsOf(S, p);
          if (th.length) {
            const pool2 = ev.filter(e => e.s <= minS + 1);
            for (const e of pool2) e.safe = safety(e.k, th, S, u) - (e.s - minS) * 30;
            pool2.sort((a, b) => b.safe - a.safe);
            if (pool2[0].safe >= 45) pickK = pool2[0].k;
          }
        }
      }
      pool.sort((a, b) => b.v - a.v);
      if (pickK == null) pickK = pool[0].k;
      const dr = S.drawn[p];
      const tile = dr != null && kindOf(dr) === pickK && hand.includes(dr) ? dr : hand.find(t => kindOf(t) === pickK);
      return { tile, k: pickK, shanten: minS, evals: ev };
    }
    const aiDiscard = (S, p, level, rng) => aiDiscardEval(S, p, level, rng).tile;
    function aiTurn(S, p, info, level, rng = Math.random) {
      if (info.canHu) return { a: 'hu' };
      const c = countsOf(S.hands[p]);
      if (info.mode === 'draw') {
        const sNow = bestDiscardShanten(c);
        for (const k of info.akongs) { const c2 = c.slice(); c2[k] -= 4; if (level <= 0 || shanten(c2) <= sNow) return { a: 'akong', k }; }
        for (const k of info.kkongs) { const c2 = c.slice(); c2[k]--; if (shanten(c2) <= sNow) return { a: 'kkong', k }; }
      }
      return { a: 'discard', tile: aiDiscard(S, p, level, rng) };
    }
    function aiClaim(S, q, tile, from, o, level, rng = Math.random) {
      if (o.hu) return { a: 'hu' };
      const k = kindOf(tile), c = countsOf(S.hands[q]);
      const s0 = shanten(c);
      const valuable = k >= 31 || (k >= 27 && (k - 27 === seatWind(S, q) || k - 27 === S.round));
      const menzen = S.melds[q].every(m => m.type === 'akong');
      let best = null;
      if (o.kong) { const c2 = c.slice(); c2[k] -= 3; const s = shanten(c2); if (s <= s0) best = { a: 'kong', s }; }
      if (o.pon) {
        const c2 = c.slice(); c2[k] -= 2;
        const s = bestDiscardShanten(c2);
        if ((s < s0 || (valuable && s <= s0)) && (!best || s < best.s)) best = { a: 'pon', s };
      }
      if (o.chi) o.chi.forEach((cb, i) => {
        const c2 = c.slice(); c2[cb[0]]--; c2[cb[1]]--;
        const s = bestDiscardShanten(c2);
        if (s < s0 && (!best || s < best.s)) best = { a: 'chi', i, s };
      });
      if (!best) return { a: 'pass' };
      if (level <= 0 && rng() < 0.25) return { a: 'pass' };
      if (level >= 2 && menzen && best.a !== 'kong' && s0 >= 4 && !valuable) return { a: 'pass' };
      if (level === 1 && menzen && best.a === 'chi' && s0 >= 4 && rng() < 0.5) return { a: 'pass' };
      return best;
    }
    function makeAI(level, rng = Math.random) {
      return {
        turn: (S, p, info) => aiTurn(S, p, info, level, rng),
        claim: (S, q, tile, from, o) => aiClaim(S, q, tile, from, o, level, rng),
      };
    }

    return {
      RESERVE, WIND, kindOf, isFlower, isHonor, isWind, isDragon, suitOf, tileName, cnNum,
      rngFrom, shuffle, countsOf, countsK, isWin, waits, decompositions, shanten, bestDiscardShanten, ukeire,
      score, dealerItems, payments, chiOptions, live, seatWind, swapTiles, playHand, nextSession, ABORT,
      unseenFor, aiDiscardEval, aiDiscard, aiTurn, aiClaim, makeAI,
    };
  })();

  // =====================================================================
  // UI：牌面美術、牌桌、演出
  // =====================================================================
  const kindOf = Core.kindOf;
  const WIND = Core.WIND;
  const FONT_ZH = '"Noto Serif TC","Songti TC","Noto Serif CJK TC","Source Han Serif TC","PMingLiU","MingLiU",serif';
  const FONT_EN = '"Bodoni Moda","Didot","Bodoni 72",Georgia,serif';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 牌面：Canvas 畫好轉成圖片，注入成 .g-mahjong 底下的 CSS ----------
  const TileArt = (() => {
    const FW = 150, FH = 200, US = FW / 100; // 邏輯座標 100 × 133.3
    const INK = ['#2d3460', '#0a0d25'], RED = ['#e5373f', '#970d17'], GRN = ['#27a466', '#0a5a31'], BLU = ['#3c74d2', '#143a88'];
    const PC = { b: BLU, g: GRN, r: RED };
    const FCOL = [GRN, RED, ['#e8a530', '#a2600a'], BLU, ['#e8578a', '#a51d4f'], ['#9d68da', '#5a2a98'], GRN, ['#e3b52f', '#9f740a']];
    let pending = null;
    const circ = (x, cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };
    function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
    function lin(x, y0, y1, c) { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); return g; }
    function rad(x, cx, cy, r, c) { const g = x.createRadialGradient(cx - r * .32, cy - r * .36, r * .08, cx, cy, r); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); return g; }
    // 刻字：先壓一道亮邊與暗影，再上漸層墨色（像刻進象牙再填色）
    function ink(x, t, cx, cy, size, col, weight = 700) {
      x.font = `${weight} ${size}px ${FONT_ZH}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = 'rgba(255,255,255,.95)'; x.fillText(t, cx + .7, cy + 1.1);
      x.fillStyle = 'rgba(90,60,20,.25)'; x.fillText(t, cx - .5, cy - .6);
      x.fillStyle = lin(x, cy - size / 2, cy + size / 2, col); x.fillText(t, cx, cy);
    }
    function dot(x, cx, cy, r, col) {
      const c = PC[col];
      x.fillStyle = 'rgba(90,60,20,.22)'; circ(x, cx + .6, cy + 1, r);
      x.fillStyle = rad(x, cx, cy, r, c); circ(x, cx, cy, r);
      x.fillStyle = '#fbf5e3'; circ(x, cx, cy, r * .76);
      x.fillStyle = rad(x, cx, cy, r * .6, c); circ(x, cx, cy, r * .6);
      x.fillStyle = '#fbf5e3';
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.beginPath(); x.ellipse(cx + Math.cos(a) * r * .38, cy + Math.sin(a) * r * .38, r * .12, r * .07, a, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = c[1]; circ(x, cx, cy, r * .17);
      x.strokeStyle = 'rgba(255,255,255,.65)'; x.lineWidth = r * .09; x.beginPath(); x.arc(cx, cy, r * .88, Math.PI * 1.1, Math.PI * 1.45); x.stroke();
    }
    function bigDot(x) {
      const cx = 50, cy = 66.7;
      x.fillStyle = 'rgba(90,60,20,.22)'; circ(x, cx + .8, cy + 1.2, 43);
      x.fillStyle = rad(x, cx, cy, 43, GRN); circ(x, cx, cy, 43);
      x.fillStyle = '#fbf5e3'; circ(x, cx, cy, 38.5);
      x.fillStyle = lin(x, cy - 36, cy + 36, RED);
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; x.beginPath(); x.ellipse(cx + Math.cos(a) * 31, cy + Math.sin(a) * 31, 6.4, 3.5, a, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = rad(x, cx, cy, 23.5, BLU); circ(x, cx, cy, 23.5);
      x.fillStyle = '#fbf5e3'; circ(x, cx, cy, 19);
      x.fillStyle = rad(x, cx, cy, 14.5, RED); circ(x, cx, cy, 14.5);
      x.fillStyle = '#fbf5e3';
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; x.beginPath(); x.ellipse(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 3.6, 2, a, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#e9c46a'; circ(x, cx, cy, 3.4);
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2.6; x.beginPath(); x.arc(cx, cy, 40.8, Math.PI * 1.08, Math.PI * 1.42); x.stroke();
    }
    const DOTS = {
      2: [19, [[50, 36, 'g'], [50, 97, 'b']]],
      3: [15, [[24, 27, 'b'], [50, 66.7, 'r'], [76, 106, 'g']]],
      4: [17, [[28, 38, 'b'], [72, 38, 'g'], [28, 95, 'g'], [72, 95, 'b']]],
      5: [15, [[26, 31, 'b'], [74, 31, 'g'], [50, 66.7, 'r'], [26, 102, 'g'], [74, 102, 'b']]],
      6: [14, [[29, 23, 'g'], [71, 23, 'g'], [29, 71, 'r'], [71, 71, 'r'], [29, 109, 'r'], [71, 109, 'r']]],
      7: [12.5, [[22, 17, 'g'], [50, 31, 'g'], [78, 45, 'g'], [29, 79, 'r'], [71, 79, 'r'], [29, 113, 'r'], [71, 113, 'r']]],
      8: [13.5, [[30, 19, 'b'], [70, 19, 'b'], [30, 51, 'b'], [70, 51, 'b'], [30, 83, 'b'], [70, 83, 'b'], [30, 115, 'b'], [70, 115, 'b']]],
      9: [13, [[20, 24, 'b'], [50, 24, 'b'], [80, 24, 'b'], [20, 66.7, 'r'], [50, 66.7, 'r'], [80, 66.7, 'r'], [20, 109, 'g'], [50, 109, 'g'], [80, 109, 'g']]],
    };
    const BC = { g: GRN, r: RED, b: BLU };
    function stick(x, cx, cy, len, col, ang = 0) {
      const w = 10.5, c = BC[col];
      x.save(); x.translate(cx, cy); x.rotate(ang);
      x.fillStyle = 'rgba(90,60,20,.2)'; rr(x, -w / 2 + .7, -len / 2 + 1, w, len, w / 2.2); x.fill();
      const g = x.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, c[1]); g.addColorStop(.38, c[0]); g.addColorStop(.62, c[0]); g.addColorStop(1, c[1]);
      x.fillStyle = g; rr(x, -w / 2, -len / 2, w, len, w / 2.2); x.fill();
      for (const yy of [-len / 2 + 4, 0, len / 2 - 4]) {
        x.fillStyle = c[1]; x.fillRect(-w / 2 - .5, yy - 1.5, w + 1, 3);
        x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(-w / 2 + 1.6, yy + 1.2, w - 3.2, .9);
      }
      x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(-1.3, -len / 2 + 6, 2.2, len - 12);
      x.restore();
    }
    const STICKS = {
      2: [48, [[50, 36, 'g'], [50, 97, 'b']]],
      3: [46, [[50, 36, 'g'], [29, 97, 'b'], [71, 97, 'b']]],
      4: [46, [[30, 36, 'b'], [70, 36, 'g'], [30, 97, 'g'], [70, 97, 'b']]],
      5: [44, [[24, 35, 'g'], [76, 35, 'b'], [50, 66.7, 'r'], [24, 98, 'b'], [76, 98, 'g']]],
      6: [46, [[22, 36, 'g'], [50, 36, 'g'], [78, 36, 'g'], [22, 97, 'b'], [50, 97, 'b'], [78, 97, 'b']]],
      9: [36, [[22, 24, 'r'], [50, 24, 'b'], [78, 24, 'g'], [22, 66.7, 'r'], [50, 66.7, 'b'], [78, 66.7, 'g'], [22, 109, 'r'], [50, 109, 'b'], [78, 109, 'g']]],
    };
    function bird(x) {
      // 孔雀：尾羽、身體、翅膀、頭冠
      const bx = 48, by = 86;
      [[-2.5, 45], [-2.15, 50], [-1.8, 48]].forEach(([a, L], i) => {
        const ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L;
        const g = x.createLinearGradient(bx, by, ex, ey); g.addColorStop(0, '#0f6a3c'); g.addColorStop(1, i === 1 ? '#2f6fd0' : '#2aa36a');
        x.strokeStyle = g; x.lineWidth = 3.4; x.lineCap = 'round';
        x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(bx + Math.cos(a + .35) * L * .55, by + Math.sin(a + .35) * L * .55, ex, ey); x.stroke();
        x.lineWidth = 1; x.strokeStyle = 'rgba(42,163,106,.55)';
        for (let t = .35; t < .95; t += .12) { const px = bx + (ex - bx) * t, py = by + (ey - by) * t; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a - 1.2) * 6, py + Math.sin(a - 1.2) * 6); x.moveTo(px, py); x.lineTo(px + Math.cos(a + 1.2) * 6, py + Math.sin(a + 1.2) * 6); x.stroke(); }
        x.fillStyle = rad(x, ex, ey, 6.6, BLU); circ(x, ex, ey, 6.6);
        x.fillStyle = '#3fbf80'; circ(x, ex, ey, 4);
        x.fillStyle = '#e5373f'; circ(x, ex, ey, 2);
      });
      x.save(); x.translate(60, 92); x.rotate(-.5);
      const gb = x.createLinearGradient(-16, -22, 16, 22); gb.addColorStop(0, '#3fc184'); gb.addColorStop(1, '#0b5c33');
      x.fillStyle = gb; x.beginPath(); x.ellipse(0, 0, 16.5, 22, 0, 0, Math.PI * 2); x.fill();
      x.restore();
      const gw = x.createLinearGradient(50, 82, 72, 108); gw.addColorStop(0, '#5b8fe0'); gw.addColorStop(1, '#2a3f9a');
      x.fillStyle = gw; x.beginPath(); x.moveTo(51, 84); x.quadraticCurveTo(74, 86, 72, 104); x.quadraticCurveTo(62, 100, 51, 84); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = .9;
      for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(55 + i * 4, 88 + i * 2); x.quadraticCurveTo(64 + i * 2, 92 + i * 2, 66 + i, 100); x.stroke(); }
      x.strokeStyle = '#1d8c55'; x.lineWidth = 8; x.lineCap = 'round';
      x.beginPath(); x.moveTo(66, 76); x.quadraticCurveTo(64, 60, 70, 50); x.stroke();
      x.fillStyle = rad(x, 71, 46, 9, ['#ff7a5a', '#c42330']); circ(x, 71, 46, 8.6);
      x.strokeStyle = '#c9a35b'; x.lineWidth = 1;
      [[64, 27], [70, 25], [76, 28]].forEach(([tx, ty]) => { x.beginPath(); x.moveTo(71, 38); x.lineTo(tx, ty); x.stroke(); x.fillStyle = '#e3b52f'; circ(x, tx, ty, 1.8); });
      x.fillStyle = '#fff'; circ(x, 74, 44.5, 2.6); x.fillStyle = '#111'; circ(x, 74.6, 44.6, 1.4);
      x.fillStyle = '#e8a530'; x.beginPath(); x.moveTo(78.5, 45); x.lineTo(89, 48.5); x.lineTo(78.5, 51); x.closePath(); x.fill();
      x.strokeStyle = '#c42330'; x.lineWidth = 1.8;
      x.beginPath(); x.moveTo(56, 111); x.lineTo(54, 123); x.lineTo(50, 125); x.moveTo(54, 123); x.lineTo(57, 126); x.moveTo(64, 111); x.lineTo(65, 123); x.lineTo(61, 125); x.moveTo(65, 123); x.lineTo(68, 126); x.stroke();
      x.strokeStyle = '#27a466'; x.lineWidth = 1.4;
      for (let i = 0; i < 7; i++) { const gx = 36 + i * 6; x.beginPath(); x.moveTo(gx, 128); x.quadraticCurveTo(gx + 2, 122, gx + (i % 2 ? 4 : -2), 118); x.stroke(); }
    }
    function blossom(x, cx, cy, r, col) {
      x.strokeStyle = '#7a5a2a'; x.lineWidth = 1.3; x.beginPath(); x.moveTo(cx - r * 2.2, cy + r * 1.9); x.quadraticCurveTo(cx - r * .6, cy + r * .8, cx, cy); x.stroke();
      x.fillStyle = '#2aa36a'; x.beginPath(); x.ellipse(cx - r * 1.3, cy + r * 1.3, r * .55, r * .25, -.7, 0, Math.PI * 2); x.fill();
      x.fillStyle = lin(x, cy - r, cy + r, col);
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; x.beginPath(); x.ellipse(cx + Math.cos(a) * r * .55, cy + Math.sin(a) * r * .55, r * .5, r * .36, a, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#f6d27a'; circ(x, cx, cy, r * .26);
    }
    function face(k) {
      const c = document.createElement('canvas'); c.width = FW; c.height = FH;
      const x = c.getContext('2d'); x.scale(US, US);
      if (k < 9) { ink(x, '一二三四五六七八九'[k], 50, 37, 50, INK); ink(x, '萬', 50, 96, 56, RED); }
      else if (k === 9) bigDot(x);
      else if (k < 18) { const [r, list] = DOTS[k - 8]; for (const [cx, cy, col] of list) dot(x, cx, cy, r, col); }
      else if (k === 18) bird(x);
      else if (k < 27) {
        const n = k - 17;
        if (n === 7) { stick(x, 50, 22, 30, 'r'); for (const [cx, cy] of [[22, 68], [50, 68], [78, 68], [22, 110], [50, 110], [78, 110]]) stick(x, cx, cy, 36, 'g'); }
        else if (n === 8) {
          const L = 46;
          stick(x, 16, 38, L, 'g'); stick(x, 39, 36, L, 'g', .42); stick(x, 61, 36, L, 'g', -.42); stick(x, 84, 38, L, 'g');
          stick(x, 16, 96, L, 'b'); stick(x, 39, 98, L, 'b', -.42); stick(x, 61, 98, L, 'b', .42); stick(x, 84, 96, L, 'b');
        } else { const [L, list] = STICKS[n]; for (const [cx, cy, col] of list) stick(x, cx, cy, L, col); }
      } else if (k < 34) {
        const i = k - 27;
        if (i === 6) {
          x.strokeStyle = '#2c5fb8'; x.lineWidth = 4.6; rr(x, 15, 17, 70, 99, 7); x.stroke();
          x.lineWidth = 1.6; rr(x, 23.5, 25.5, 53, 82, 4); x.stroke();
          x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 1; rr(x, 16.6, 18.6, 70, 99, 7); x.stroke();
        } else ink(x, '東南西北中發'[i], 50, 68, i >= 4 ? 80 : 76, i === 4 ? RED : i === 5 ? GRN : INK);
      } else {
        const i = k - 34;
        x.strokeStyle = 'rgba(201,163,91,.9)'; x.lineWidth = 1.6; rr(x, 5, 5, 90, 123.3, 9); x.stroke();
        x.strokeStyle = 'rgba(201,163,91,.45)'; x.lineWidth = .8; rr(x, 9, 9, 82, 115.3, 6); x.stroke();
        x.font = `italic 700 21px ${FONT_EN}`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillStyle = lin(x, 8, 30, RED); x.fillText(String(i % 4 + 1), 20, 22);
        blossom(x, 74, 25, 11, FCOL[i]);
        ink(x, '春夏秋冬梅蘭竹菊'[i], 50, 84, 60, FCOL[i]);
      }
      try { const u = c.toDataURL('image/webp', .92); if (u.startsWith('data:image/webp')) return u; } catch (e) { /* 改用 PNG */ }
      return c.toDataURL('image/png');
    }
    function backArt() {
      const c = document.createElement('canvas'); c.width = FW; c.height = FH;
      const x = c.getContext('2d'); x.scale(US, US);
      x.strokeStyle = 'rgba(236,208,138,.16)'; x.lineWidth = .8;
      for (let i = -140; i < 140; i += 11) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 133, 133); x.stroke(); x.beginPath(); x.moveTo(i + 133, 0); x.lineTo(i, 133); x.stroke(); }
      x.strokeStyle = 'rgba(240,214,150,.75)'; x.lineWidth = 1.5; rr(x, 8, 8, 84, 117.3, 8); x.stroke();
      x.save(); x.translate(50, 66.7); x.rotate(Math.PI / 4);
      const g = x.createLinearGradient(-16, -16, 16, 16); g.addColorStop(0, '#fff1c9'); g.addColorStop(.5, '#d9b062'); g.addColorStop(1, '#9c742f');
      x.fillStyle = g; x.fillRect(-15, -15, 30, 30);
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1; x.strokeRect(-11.5, -11.5, 23, 23);
      x.restore();
      x.font = `italic 700 22px ${FONT_EN}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#0d5a3d'; x.fillText('E', 50, 68);
      return c.toDataURL('image/png');
    }
    function inject() {
      const rules = [];
      for (let k = 0; k < 42; k++) rules.push(`.g-mahjong .mjf-${k}::after{background-image:url(${face(k)})}`);
      rules.push(`.g-mahjong .mj-back::after{background-image:url(${backArt()})}`);
      let st = document.getElementById('mj-tile-css');
      if (!st) { st = document.createElement('style'); st.id = 'mj-tile-css'; document.head.appendChild(st); }
      st.textContent = rules.join('\n');
    }
    function install() {
      if (pending) return pending;
      pending = (async () => {
        const probe = '700 60px "Noto Serif TC"', txt = '一二三四五六七八九萬東南西北中發春夏秋冬梅蘭竹菊';
        let ok = true;
        try {
          if (document.fonts && document.fonts.load) {
            await Promise.race([document.fonts.load(probe, txt), sleep(1600)]);
            ok = document.fonts.check(probe, txt);
          }
        } catch (e) { /* 字型載不到就用系統字 */ }
        inject();
        if (!ok && document.fonts) document.fonts.load(probe, txt).then(() => { if (document.fonts.check(probe, txt)) inject(); }).catch(() => {});
      })();
      return pending;
    }
    return { install };
  })();

  // ---------- 角色台詞 ----------
  const LINES = {
    vivi: {
      hi: ['今天的牌桌好香甜～請多指教！', '我帶了馬卡龍，邊吃邊打吧♪', '輸的人要請下午茶喔～'],
      dealer: ['我坐莊？那我要認真了喔～', '莊家的位置，跟主廚一樣重要！'],
      chi: ['吃～甜點就是要一口接一口♪', '吃！剛好配成一盤～'], pon: ['碰！這塊蛋糕我要了～', '碰碰～剛好缺這一味！'], kong: ['槓！奶油加倍！', '槓～多一層千層派！'],
      win: ['胡了！今天的下午茶我請客～', '耶～胡牌的滋味最甜了！'], zimo: ['自摸！比剛出爐的泡芙還香～', '自己摸到的最好吃了♪'],
      lose: ['嗚嗚…我的蛋糕塌掉了…', '放槍了…要多吃一塊壓壓驚'], other: ['唉呀，被搶先了～', '下一把我一定贏回來！'],
      idle: ['嗯…打哪張好呢？', '這張…應該很安全吧？', '肚子好餓喔～'],
      draw: ['流局了～那就再來一盤甜點吧！', '沒人胡？那我們繼續喝茶～'],
    },
    vita: {
      hi: ['數據分析完畢，開局！', '牌桌直播開始～大家好～', '今天的勝率預測：我九成。'],
      dealer: ['莊家權限，已取得。', '坐莊模式，啟動！'],
      chi: ['吃！連線成功。', '吃～順序排列完美。'], pon: ['碰！資料命中。', '碰！演算法說要這張～'], kong: ['槓！效能加倍！', '槓！超頻運轉！'],
      win: ['胡！勝率百分之百～', '完美運算，胡牌！'], zimo: ['自摸！今天手氣是滿格訊號～', '自摸！機率站在我這邊。'],
      lose: ['出現 Bug…竟然放槍了', '嗚，伺服器當機…'], other: ['可惡，被搶先一步', '重新計算中…'],
      idle: ['讓我算算機率…', '這張的危險度…百分之十二。', '網路好像有點慢…'],
      draw: ['平手…數據不足，重新取樣。', '流局，系統重開中～'],
    },
    chiyo: {
      hi: ['哼，本小姐今天心情好，陪妳們玩玩。', '輸了可別哭喔。', '錢？本小姐多的是。'],
      dealer: ['莊家當然是本小姐。', '哼，坐莊剛剛好。'],
      chi: ['吃。別擋本小姐的路。', '吃，這是理所當然的。'], pon: ['碰！這張本小姐收下了。', '碰。理所當然。'], kong: ['槓！這就是財力的差距！', '槓！全部都是本小姐的！'],
      win: ['胡了！區區小錢，收下了。', '呵呵呵～這就是實力！'], zimo: ['自摸！三家都給本小姐付錢！', '自摸！跪下來付錢吧～開玩笑的。'],
      lose: ['可、可惡…這次只是失誤！', '這點錢…本小姐才不在乎！'], other: ['哼，運氣好而已。', '下一把就換本小姐了。'],
      idle: ['快點打啦。', '這種牌也敢打？', '無聊…'],
      draw: ['哼，算妳們走運。', '流局？下一把給我等著。'],
    },
    shino: {
      hi: ['今日承蒙指教，請多關照。', '牌如棋局，靜心為上。', '願今日牌運如春風。'],
      dealer: ['坐莊了，請手下留情。', '那麼，由我開局。'],
      chi: ['吃。順水推舟。', '吃，恰好成章。'], pon: ['碰，失禮了。', '碰。恰好合韻。'], kong: ['槓。一氣呵成。', '槓，如行雲流水。'],
      win: ['胡了。承讓承讓。', '終章已至，胡牌。'], zimo: ['自摸。水到渠成呢。', '自摸，正如所料。'],
      lose: ['唉…一步錯，步步錯。', '是我讀錯牌了…'], other: ['好牌，佩服。', '這局是妳技高一籌。'],
      idle: ['嗯…', '此牌宜靜不宜動。', '容我想想。'],
      draw: ['和局，也是一種圓滿。', '山窮水盡，再開新局吧。'],
    },
  };
  const ME_WIN = ['大小姐好厲害！', '這就是老闆娘的實力～', '今天手氣長紅！'];
  const TABLES = [
    { name: '下午茶桌', sub: '輕鬆小玩', di: 1, unit: .4 },
    { name: '貴賓桌', sub: '名媛常客', di: 4, unit: 1.5 },
    { name: '頂樓包廂', sub: '一擲千金', di: 15, unit: 6 },
  ];
  const MODES = [{ id: 'single', name: '單局', sub: '打一把' }, { id: 'round', name: '一圈', sub: '東風四局' }, { id: 'full', name: '一將', sub: '東南西北' }];
  const LEVELS = [{ name: '輕鬆', sub: '牌友佛心' }, { name: '普通', sub: '認真打牌' }, { name: '高手', sub: '會防守' }];
  const COST = { hint: 5, auto: 30, swap: 20 };
  const PRE_MS = 3800;
  const nice = n => { if (n < 100) return Math.max(10, Math.round(n / 10) * 10); const p = Math.pow(10, Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p; };
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const dieHTML = n => `<i class="mj-die f${n}">${[...Array(9)].map((_, i) => `<b${PIPS[n].includes(i) ? ' class="p"' : ''}></b>`).join('')}</i>`;
  const TAI_TABLE = [
    ['莊家', '1'], ['連N拉N', '2N'], ['門清', '1'], ['自摸', '1'], ['不求人（門清自摸）', '3'], ['全求人', '2'], ['平胡', '2'], ['獨聽', '1'],
    ['三元牌', '1'], ['圈風／門風', '各 1'], ['正花', '1'], ['花槓', '2'], ['碰碰胡', '4'], ['混一色', '4'], ['清一色', '8'], ['字一色', '16'],
    ['三暗刻', '2'], ['四暗刻', '5'], ['五暗刻', '8'], ['小三元', '4'], ['大三元', '8'], ['小四喜', '8'], ['大四喜', '16'],
    ['槓上開花', '1'], ['海底撈月', '1'], ['河底撈魚', '1'], ['搶槓', '1'], ['天胡', '16'], ['地胡', '16'],
  ];

  // =====================================================================
  // 遊戲本體
  // =====================================================================
  function createGame(api, ov) {
    const root = document.createElement('div');
    root.className = 'mj';
    ov.body.appendChild(root);
    let closed = false;
    const timers = new Set(), rejects = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!closed) fn(); }, Math.max(0, ms)); timers.add(t); return t; };
    const cancel = t => { if (t) { clearTimeout(t); timers.delete(t); } };
    const wait = ms => new Promise((res, rej) => {
      rejects.add(rej);
      const go = () => { if (isHidden()) { later(go, 250); return; } rejects.delete(rej); res(); };
      later(go, ms);
    });
    const RM = reducedMotion();
    const isHidden = () => document.hidden && !(window.__mj && window.__mj.ignoreHidden);
    const U = { phase: 'load', S: null, sess: null, pend: null, pre: null, auto: false, autoPaid: false, sel: null, sug: null, newIds: null, inHand: false, exprT: [], speed: 1, hint: true, rig: null, onChoice: null, lastDelta: 0, freeHints: 0, bonus: null };
    const T = ms => (RM ? ms * .45 : ms / U.speed);
    const store = () => {
      const s = api.store('mahjong');
      s.opts = Object.assign({ table: 0, mode: 'single', level: 1, speed: 1, hint: true }, s.opts || {});
      s.st = Object.assign({ hands: 0, wins: 0, zimo: 0, deal: 0, maxTai: 0, maxName: '', net: 0, sessions: 0 }, s.st || {});
      return s;
    };
    { const o = store().opts; U.speed = o.speed === 2 ? 2 : 1; U.hint = o.hint !== false; }
    const castAll = api.cast();
    let lineup = Core.shuffle([1, 2, 3, 4], Math.random).slice(0, 3);
    const seatCast = p => (p === 0 ? api.player() : castAll[lineup[p - 1]]);
    const nameOf = p => api.esc(seatCast(p).name || 'Erika');
    const lineOf = (p, key) => { const L = LINES[seatCast(p).id]; return L && L[key] ? pick(L[key]) : ''; };
    const fmtS = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + api.fmt(Math.abs(v));
    const tileHTML = (k, cls = '') => `<i class="mj-t mjf-${k}${cls ? ' ' + cls : ''}"></i>`;
    const backHTML = (cls = '') => `<i class="mj-t mj-back${cls ? ' ' + cls : ''}"></i>`;
    const shantenText = s => (s <= 0 ? '聽牌' : `${Core.cnNum(s)}向聽<small>差 ${s} 張聽牌</small>`);
    // 連動系統（主程式有實作才呼叫）
    const evt = (name, data) => { try { if (typeof api.event === 'function') api.event(name, data); } catch (e) { console.error(e); } };
    const perk = name => { try { const v = typeof api.perk === 'function' ? api.perk(name) : 0; return Number.isFinite(v) ? v : 0; } catch (e) { return 0; } };
    const resName = k => (api.RES && api.RES[k] && api.RES[k].name) || ({ spice: '香料', silk: '絲綢', ore: '礦石', leaf: '茶葉' }[k] || k);
    const snd = api.sound;
    const sfx = {
      clack: (v = 1) => { snd.hiss(.035, .1 * v, 2400); snd.beep(2100, .03, 'square', .016 * v); snd.beep(430, .07, 'triangle', .06 * v); },
      draw: () => snd.hiss(.05, .035, 5200),
      select: () => snd.beep(1320, .05, 'sine', .05),
      call: () => { snd.beep(523, .12, 'triangle', .1); snd.beep(784, .2, 'triangle', .1, .08); snd.hiss(.12, .05, 3000); },
      kong: () => { snd.drum(); snd.beep(392, .35, 'triangle', .08); snd.beep(587, .35, 'triangle', .07, .1); },
      ping: () => { snd.beep(988, .1, 'sine', .07); snd.beep(1319, .14, 'sine', .07, .07); },
      alert: () => { snd.beep(784, .12, 'triangle', .09); snd.beep(1047, .12, 'triangle', .09, .1); snd.beep(1568, .25, 'triangle', .09, .2); },
      tick: () => snd.beep(1500, .04, 'sine', .045),
      flower: () => snd.ding(),
      dice: () => snd.drum(),
      win: () => { snd.ssr(); snd.level(); },
      otherWin: () => { snd.beep(659, .2, 'triangle', .08); snd.beep(523, .3, 'triangle', .08, .15); },
      lose: () => { snd.beep(392, .28, 'triangle', .08); snd.beep(311, .4, 'triangle', .08, .2); },
    };

    // ---------- 載入 ----------
    root.innerHTML = '<div class="mj-load"><div class="mj-load-t"><i></i><i></i><i></i></div><p>洗牌中…</p></div>';
    TileArt.install().then(() => { if (!closed) showTitle(); });

    // ---------- 點擊（事件委派） ----------
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (!b || !root.contains(b)) return;
      const a = b.dataset.a, v = b.dataset.v;
      if (a === 'table' || a === 'mode' || a === 'level') { snd.click(); const s = store(); s.opts[a] = a === 'mode' ? v : +v; api.save(); refreshTitle(); return; }
      if (a === 'go') return startSession();
      if (a === 'lineup') { snd.click(); lineup = Core.shuffle([1, 2, 3, 4], Math.random).slice(0, 3); showTitle(true); return; }
      if (a === 'rules') return showRules();
      if (a === 'howto') return showHowto();
      if (a === 'hintTog') { snd.click(); U.hint = !U.hint; const s = store(); s.opts.hint = U.hint; api.save(); refreshTools(); renderHand(); updateTing(); return; }
      if (a === 'speed') { snd.click(); U.speed = U.speed === 1 ? 2 : 1; const s = store(); s.opts.speed = U.speed; api.save(); refreshTools(); return; }
      if (a === 'suggest') return doSuggest(b);
      if (a === 'auto') return doAuto(b);
      if (a === 'act') { snd.click(); if (U.pend && U.pend.onAct) U.pend.onAct(v); return; }
      if (a === 'choice') { snd.click(); if (U.onChoice) { const f = U.onChoice; U.onChoice = null; f(+v); } return; }
      if (a === 'swap') { snd.click(); if (U.pre) U.pre.startPick(); return; }
      if (a === 'preskip') { snd.click(); if (U.pre) U.pre.finish(); return; }
      if (a === 'swapcancel') { snd.click(); if (U.pre) U.pre.cancelPick(); return; }
      if (a === 'swapok') { if (U.pre) U.pre.confirm(b); return; }
    });

    // ================= 開場畫面 =================
    function showTitle(soft) {
      U.phase = 'title'; U.S = null; U.sess = null; R = {};
      ov.setTitle('貴婦麻將館');
      const s = store(), rec = s.st;
      const opp = lineup.map(i => castAll[i]);
      const floats = [9, 31, 18, 0, 38, 27].map((k, i) => `<i class="mj-t mjf-${k} f${i}"></i>`).join('');
      root.innerHTML = `
      <section class="mj-title${soft ? ' soft' : ''}">
        <div class="mj-tbg"><i class="mj-rays"></i><i class="mj-glow"></i>${floats}<i class="mj-sparks"></i></div>
        <div class="mj-hero"><img class="c1" src="${opp[1].full}" alt=""><img class="c2" src="${opp[2].full}" alt=""><img class="c0" src="${opp[0].full}" alt=""></div>
        <div class="mj-logo"><em>Taiwan Sixteen · Salon de Mahjong</em><h1>貴婦麻將館</h1><p>今日牌友　<b>${opp.map(c => api.esc(c.name)).join('・')}</b></p></div>
        <div class="mj-panel">
          <div class="mj-tables"></div>
          <div class="mj-segs">
            <div class="mj-seg" role="group" aria-label="牌局長度">${MODES.map(m => `<button data-a="mode" data-v="${m.id}">${m.name}<small>${m.sub}</small></button>`).join('')}</div>
            <div class="mj-seg" role="group" aria-label="難度">${LEVELS.map((l, i) => `<button data-a="level" data-v="${i}">${l.name}<small>${l.sub}</small></button>`).join('')}</div>
          </div>
          <div class="mj-prize"></div>
          <button class="btn goldb wide mj-go" data-a="go">入座開打<small>自摸三家付・連莊拉莊</small></button>
          <div class="mj-rec">
            <span><b class="num">${rec.hands}</b>對局</span><span><b class="num">${rec.wins}</b>胡牌</span><span><b class="num">${rec.zimo}</b>自摸</span><span><b class="num">${rec.maxTai}</b>最高台</span><span><b class="num ${rec.net > 0 ? 'up' : rec.net < 0 ? 'dn' : ''}">${fmtS(rec.net)}</b>累計輸贏</span>
          </div>
          <div class="mj-links"><button data-a="lineup">${api.icons.line('play')}換牌友</button><button data-a="rules">${api.icons.line('trophy')}台數表</button><button data-a="howto">${api.icons.line('star')}玩法說明</button></div>
        </div>
      </section>`;
      refreshTitle();
    }
    function tableAmounts(i) { const B = api.betUnit(), t = TABLES[i]; return { di: nice(B * t.di), unit: nice(B * t.unit) }; }
    function refreshTitle() {
      const box = root.querySelector('.mj-title');
      if (!box) return;
      const o = store().opts;
      box.querySelector('.mj-tables').innerHTML = TABLES.map((t, i) => {
        const a = tableAmounts(i);
        return `<button class="mj-tcard t${i}${o.table === i ? ' on' : ''}" data-a="table" data-v="${i}"><b>${t.name}</b><small>${t.sub}</small><span>底 <em class="num">${api.fmt(a.di)}</em></span><span>每台 <em class="num">${api.fmt(a.unit)}</em></span></button>`;
      }).join('');
      box.querySelectorAll('[data-a="mode"]').forEach(b => b.classList.toggle('on', b.dataset.v === o.mode));
      box.querySelectorAll('[data-a="level"]').forEach(b => b.classList.toggle('on', +b.dataset.v === o.level));
      const a = tableAmounts(o.table);
      box.querySelector('.mj-prize').innerHTML = `<span>${api.icons.coin()}平胡放槍 <b class="num">+${api.fmt(a.di + 3 * a.unit)}</b></span><span>${api.icons.coin()}清一色自摸 <b class="num">+${api.fmt(3 * (a.di + 11 * a.unit))}</b></span>`;
    }
    function showRules() {
      snd.click();
      api.modal({
        title: '台數表',
        body: `<p class="mb">結算＝底＋台數×每台。放槍一家付，自摸三家付；莊家胡或付給莊家時，另加莊家 1 台與連莊拉莊。</p><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 10px;margin-top:10px;max-height:46vh;overflow-y:auto;text-align:left;font-size:12.5px">${TAI_TABLE.map(([n, t]) => `<div style="display:flex;justify-content:space-between;gap:6px;padding:5px 8px;border-radius:9px;background:#fff5f8;border:1px solid #f3dfe6"><span>${n}</span><b style="color:#a92b58;font-variant-numeric:tabular-nums;white-space:nowrap">${t} 台</b></div>`).join('')}</div>`,
        actions: [{ label: '知道了', cls: 'goldb' }],
      });
    }
    function showHowto() {
      snd.click();
      api.modal({
        title: '玩法說明',
        body: `<div style="text-align:left;font-size:13px;line-height:1.6;color:#865671;display:flex;flex-direction:column;gap:6px"><p style="margin:0"><b>目標</b>　湊成 5 組（順子或刻子）加 1 對，共 17 張就能胡牌。</p><p style="margin:0"><b>出牌</b>　點一下牌抬起、再點一下打出，或把牌往上滑。</p><p style="margin:0"><b>吃碰槓胡</b>　別人打出妳要的牌時會跳出按鈕；吃只能吃上家（左邊）的牌。</p><p style="margin:0"><b>花牌</b>　摸到花自動補牌，自己位置的花有台。</p><p style="margin:0"><b>聽牌提示</b>　右下角免費顯示聽哪些牌、還剩幾張；手牌標「聽」的，打掉就能聽。</p><p style="margin:0"><b>粉鑽服務</b>　建議出牌 ${COST.hint}、託管代打 ${COST.auto}（整局）、開局換三張 ${COST.swap}。</p></div>`,
        actions: [{ label: '開始打牌', cls: 'goldb' }],
      });
    }

    // ================= 牌桌 =================
    let R = {};
    function buildTable() {
      U.phase = 'table';
      root.innerHTML = `
      <section class="mj-table">
        <div class="mj-felt">
          <div class="mj-top"></div>
          <div class="mj-pin">
            <div class="mj-cn tl"></div><div class="mj-cn tr"></div><div class="mj-cn bl"></div><div class="mj-cn br"><div class="mj-ting"></div></div>
            <div class="mj-center"><i class="cw p0"></i><i class="cw p1"></i><i class="cw p2"></i><i class="cw p3"></i>
              <div class="cc"><small class="rd"></small><b class="lf num"></b><small class="lb">剩餘張數</small><em class="lz"></em></div><div class="dice"></div></div>
            <div class="mj-river r0"></div><div class="mj-river r1"></div><div class="mj-river r2"></div><div class="mj-river r3"></div>
          </div>
        </div>
        <div class="mj-mine"></div>
        <div class="mj-hand"><div class="mj-hrow"></div><div class="mj-hrow"></div></div>
        <div class="mj-tools">
          <button class="mj-tb" data-a="hintTog"><i class="ti">聽</i><span>聽牌提示</span><small class="tv"></small></button>
          <button class="mj-tb gem" data-a="suggest"><i class="ti">${api.icons.line('star')}</i><span class="tl">建議出牌</span><small class="tp">${api.icons.gem()}${COST.hint}</small></button>
          <button class="mj-tb gem" data-a="auto"><i class="ti">${api.icons.line('butler')}</i><span class="tl">託管代打</span><small class="tp">${api.icons.gem()}${COST.auto}</small></button>
          <button class="mj-tb" data-a="speed"><i class="ti spd"></i><span>出牌速度</span></button>
        </div>
        <div class="mj-acts"></div>
        <div class="mj-layer"></div>
      </section>`;
      const q = s => root.querySelector(s);
      R = {
        table: q('.mj-table'), felt: q('.mj-felt'), top: q('.mj-top'), pin: q('.mj-pin'), center: q('.mj-center'),
        lf: q('.lf'), lb: q('.lb'), rd: q('.rd'), lz: q('.lz'), dice: q('.dice'), cw: [...root.querySelectorAll('.cw')],
        cn: { tl: q('.mj-cn.tl'), tr: q('.mj-cn.tr'), bl: q('.mj-cn.bl'), br: q('.mj-cn.br') }, ting: q('.mj-ting'),
        rivers: [0, 1, 2, 3].map(i => q('.mj-river.r' + i)), mine: q('.mj-mine'), hand: q('.mj-hand'), rows: [...root.querySelectorAll('.mj-hrow')],
        tools: q('.mj-tools'), acts: q('.mj-acts'), layer: q('.mj-layer'), seat: [],
      };
      R.seat[0] = buildSeat(0, R.cn.bl); R.seat[1] = buildSeat(1, R.cn.tr); R.seat[2] = buildSeat(2, R.top); R.seat[3] = buildSeat(3, R.cn.tl);
      bindHand();
      layout();
      refreshTools();
    }
    function buildSeat(p, host) {
      const c = seatCast(p);
      host.innerHTML = `<div class="mj-seat s${p}${p === 0 ? ' me' : ''}"><div class="sa"><span class="av"><img alt="" src="${c.face('neutral')}"></span><i class="sw"></i><i class="sz">莊</i>${p ? '<b class="sc num"></b>' : ''}</div><div class="si"><b class="sn">${nameOf(p)}</b><span class="sp num">±0</span></div><div class="sf"></div>${p ? '<div class="sm"></div>' : ''}</div>`;
      const el = host.querySelector('.mj-seat'), g = s => el.querySelector(s);
      return { el, img: g('img'), sw: g('.sw'), sz: g('.sz'), sc: g('.sc'), sp: g('.sp'), sf: g('.sf'), sm: g('.sm') };
    }
    function layout() {
      if (!R.table) return;
      const W = R.table.clientWidth, H = R.table.clientHeight;
      if (!W || !H) return;
      const hw = clamp(Math.floor((W - 18) / 9.35), 26, 46), hh = Math.round(hw * 1.34), lift = Math.round(hw * .3);
      const handH = 2 * (hh + Math.round(hw * .16) + 3) + lift + 10;
      const toolsH = 56;
      const mw = clamp(Math.round(hw * .6), 17, 27), mineH = Math.round(mw * 1.5) + 14;
      const feltH = Math.max(230, H - handH - toolsH - mineH);
      const rw = clamp(Math.floor(Math.min(W - 6, feltH - 60) / 15.04 * 10) / 10, 11, 30);
      const rh = rw * 1.34, Cc = 3 * rh, Cw = 7 * rw, P = Cw + 2 * Cc;
      const topH = clamp(feltH - P - 6, 52, 118);
      const pinTop = topH + Math.max(0, (feltH - topH - P) / 2 - 3);
      const st = R.table.style;
      st.setProperty('--hw', hw + 'px'); st.setProperty('--lift', lift + 'px'); st.setProperty('--mw', mw + 'px');
      st.setProperty('--rw', rw + 'px'); st.setProperty('--sw', clamp(Math.round(Cc / 8.8), 9, 15) + 'px');
      st.setProperty('--hand-h', handH + 'px'); st.setProperty('--mine-h', mineH + 'px'); st.setProperty('--tools-h', toolsH + 'px');
      st.setProperty('--top-h', topH + 'px'); st.setProperty('--cc', Cc + 'px');
      R.felt.style.height = feltH + 'px';
      R.top.style.height = topH + 'px';
      Object.assign(R.pin.style, { width: P + 'px', height: P + 'px', left: (W - P) / 2 + 'px', top: pinTop + 'px' });
      const put = (el, l, t, w, h, rot) => Object.assign(el.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px', transform: rot ? `rotate(${rot}deg)` : '' });
      put(R.cn.tl, 0, 0, Cc, Cc); put(R.cn.tr, Cc + Cw, 0, Cc, Cc); put(R.cn.bl, 0, Cc + Cw, Cc, Cc); put(R.cn.br, Cc + Cw, Cc + Cw, Cc, Cc);
      put(R.center, Cc, Cc, Cw, Cw);
      put(R.rivers[0], Cc, Cc + Cw, Cw, Cc, 0);
      put(R.rivers[2], Cc, 0, Cw, Cc, 180);
      put(R.rivers[1], Cc + Cw + Cc / 2 - Cw / 2, Cc + Cw / 2 - Cc / 2, Cw, Cc, -90);
      put(R.rivers[3], Cc / 2 - Cw / 2, Cc + Cw / 2 - Cc / 2, Cw, Cc, 90);
      U.geo = { hw, hh, rw, rh, mw, Cc, Cw, P };
    }
    const onResize = () => { if (U.phase === 'table') { layout(); renderAll(); } };
    addEventListener('resize', onResize);

    // ---------- 繪製 ----------
    function renderAll() {
      if (!R.table) return;
      for (let p = 0; p < 4; p++) { renderSeat(p); renderRiver(p); }
      renderCenter(); renderMine(); renderHand(); updateTing();
    }
    function curDealer() { return U.S ? U.S.dealer : U.sess && U.sess.dealerKnown ? U.sess.dealer : -1; }
    function renderSeat(p) {
      const s = R.seat && R.seat[p];
      if (!s) return;
      const S = U.S, sess = U.sess, d = curDealer();
      s.sw.textContent = d >= 0 ? WIND[(p - d + 4) % 4] : '';
      s.el.classList.toggle('dealer', p === d);
      const streak = S ? S.streak : sess ? sess.streak : 0;
      s.sz.textContent = streak ? `莊${streak}` : '莊';
      s.el.classList.toggle('on', !!S && S.phase === 'play' && S.turn === p);
      if (s.sc) s.sc.textContent = S ? S.hands[p].length : '';
      const v = sess ? sess.scores[p] : 0;
      s.sp.textContent = fmtS(v); s.sp.className = 'sp num' + (v > 0 ? ' up' : v < 0 ? ' dn' : '');
      s.sf.innerHTML = S ? S.flowers[p].map(t => tileHTML(kindOf(t))).join('') : '';
      if (s.sm) s.sm.innerHTML = S ? S.melds[p].map(m => meldHTML(m, p)).join('') : '';
    }
    function meldHTML(m, p) {
      if (m.type === 'akong') {
        const mid = p === 0 ? tileHTML(m.k) : backHTML();
        return `<span class="mj-meld kong">${backHTML()}<span class="mj-stack">${mid}${backHTML('top')}</span>${backHTML()}</span>`;
      }
      if (m.type === 'mkong' || m.type === 'kkong') return `<span class="mj-meld kong">${tileHTML(m.k)}<span class="mj-stack">${tileHTML(m.k)}${tileHTML(m.k, 'top')}</span>${tileHTML(m.k)}</span>`;
      const rel = (m.from - p + 4) % 4, tk = kindOf(m.taken);
      const rest = m.tiles.map(kindOf);
      rest.splice(rest.indexOf(tk), 1);
      const parts = rest.map(k => tileHTML(k));
      const rot = `<span class="mj-rot">${tileHTML(tk)}</span>`;
      if (rel === 3) parts.unshift(rot); else if (rel === 2) parts.splice(1, 0, rot); else parts.push(rot);
      return `<span class="mj-meld">${parts.join('')}</span>`;
    }
    function renderCenter() {
      if (!R.center) return;
      const S = U.S, sess = U.sess;
      R.lf.textContent = S ? Math.max(0, Core.live(S)) : '';
      R.lb.textContent = S ? '剩餘張數' : '';
      R.rd.textContent = sess && sess.dealerKnown ? `${WIND[sess.round]}風${WIND[(sess.dealer - sess.startDealer + 4) % 4]}局` : '';
      R.lz.textContent = S && S.streak ? `連莊 ${S.streak}` : '';
      const d = curDealer();
      R.cw.forEach((el, i) => {
        el.textContent = d >= 0 ? WIND[(i - d + 4) % 4] : '';
        el.classList.toggle('on', !!S && S.phase === 'play' && S.turn === i);
        el.classList.toggle('z', i === d);
      });
    }
    function renderRiver(p, hideLast) {
      const el = R.rivers && R.rivers[p];
      if (!el) return;
      const S = U.S;
      if (!S) { el.innerHTML = ''; return; }
      const tiles = S.river[p], n = tiles.length;
      el.style.setProperty('--cols', n > 24 ? 9 : n > 21 ? 8 : 7);
      el.innerHTML = tiles.map((t, i) => {
        let cls = '';
        if (i === n - 1 && S.last && S.last.p === p && S.last.tile === t) cls += ' last';
        if (hideLast && i === n - 1) cls += ' ghost';
        return tileHTML(kindOf(t), cls.trim());
      }).join('');
    }
    function renderMine() {
      if (!R.mine) return;
      const S = U.S;
      R.mine.innerHTML = S ? S.melds[0].map(m => meldHTML(m, 0)).join('') : '';
    }
    function handOrder(S) {
      const hand = S.hands[0], d = S.drawn[0];
      const sf = (a, b) => kindOf(a) - kindOf(b) || a - b;
      if (d != null && hand.includes(d) && hand.length % 3 === 2) return [...hand.filter(t => t !== d).sort(sf), d];
      return hand.slice().sort(sf);
    }
    const canDiscard = () => !!(U.pend && U.pend.kind === 'turn' && !U.pend.done && !U.auto);
    function tenpaiDiscards(S) {
      const c = Core.countsOf(S.hands[0]), out = new Set();
      if (S.hands[0].length % 3 !== 2) return out;
      for (let k = 0; k < 34; k++) if (c[k]) { c[k]--; if (Core.waits(c).length) out.add(k); c[k]++; }
      return out;
    }
    function renderHand(o = {}) {
      if (!R.rows) return;
      const S = U.S;
      if (!S) { R.rows[0].innerHTML = R.rows[1].innerHTML = ''; R.hand.classList.remove('my'); return; }
      const ord = handOrder(S), canD = canDiscard();
      const winNow = canD && U.pend.info && U.pend.info.canHu;
      const hints = U.hint && canD && !winNow ? tenpaiDiscards(S) : null;
      const picks = U.pre && U.pre.picking ? U.pre.picks : null;
      const html = (t, i) => {
        const k = kindOf(t);
        let cls = `mj-t mjf-${k}`;
        if (U.sel === t || (picks && picks.includes(t))) cls += ' up';
        if (picks && picks.includes(t)) cls += ' pick';
        if (U.sug === t) cls += ' sug';
        if (S.drawn[0] === t && ord.length % 3 === 2 && i === ord.length - 1) cls += ' drawn';
        if (U.newIds && U.newIds.has(t)) cls += ' new';
        if (o.deal) cls += ' flipin';
        const badge = hints && hints.has(k) ? '<b class="tg">聽</b>' : '';
        return `<i class="${cls}" data-id="${t}"${o.deal ? ` style="animation-delay:${Math.round(T(i * 30))}ms"` : ''}>${badge}${U.sug === t ? '<b class="sg"></b>' : ''}</i>`;
      };
      R.rows[0].innerHTML = ord.slice(0, 9).map(html).join('');
      R.rows[1].innerHTML = ord.slice(9).map((t, i) => html(t, i + 9)).join('');
      R.hand.classList.toggle('my', canD);
      R.hand.classList.toggle('picking', !!picks);
      U.newIds = null;
    }
    function flipHand(fn) {
      const before = new Map();
      R.hand.querySelectorAll('.mj-t[data-id]').forEach(e => before.set(e.dataset.id, e.getBoundingClientRect()));
      fn();
      if (RM) return;
      R.hand.querySelectorAll('.mj-t[data-id]').forEach(e => {
        const b = before.get(e.dataset.id);
        if (!b) return;
        const a = e.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top;
        if (Math.abs(dx) + Math.abs(dy) < 1) return;
        e.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: T(260), easing: 'cubic-bezier(.3,.7,.3,1)' });
      });
    }
    function updateTing() {
      const el = R.ting;
      if (!el) return;
      const S = U.S;
      el.classList.remove('live');
      if (!S || S.phase === 'deal') { el.innerHTML = '<b class="th">聽牌提示</b><p class="te">開局後顯示</p>'; return; }
      if (!U.hint) { el.innerHTML = '<b class="th">聽牌提示</b><p class="te">已關閉<small>下方「聽」可以打開</small></p>'; return; }
      const c = Core.countsOf(S.hands[0]), n = S.hands[0].length;
      let title = '聽牌', ks = [], note = '';
      if (n % 3 === 2) {
        if (U.sel != null && S.hands[0].includes(U.sel)) { c[kindOf(U.sel)]--; ks = Core.waits(c); title = '打出後聽'; if (!ks.length) note = shantenText(Core.shanten(c)); }
        else if (Core.isWin(c)) { title = '可以胡牌'; note = '按「自摸」<small>收下這一把！</small>'; }
        else { const s = Core.bestDiscardShanten(c); if (s === 0) { title = '可以聽牌'; note = '打標「聽」的牌<small>就能聽牌</small>'; } else note = shantenText(s); }
      } else { ks = Core.waits(c); if (!ks.length) note = shantenText(Core.shanten(c)); }
      if (ks.length) {
        const u = Core.unseenFor(S, 0);
        let tot = 0;
        const items = ks.map(k => { tot += u[k]; return `<span class="${u[k] ? '' : 'none'}">${tileHTML(k)}<em class="num">${u[k]}</em></span>`; }).join('');
        el.innerHTML = `<b class="th">${title}</b><div class="tw${ks.length > 4 ? ' many' : ''}">${items}</div><small class="tn">共剩 <b class="num">${tot}</b> 張</small>`;
        el.classList.add('live');
      } else el.innerHTML = `<b class="th">${title === '聽牌' ? '聽牌提示' : title}</b><p class="te">${note || '—'}</p>`;
    }
    function refreshTools() {
      if (!R.tools) return;
      const q = a => R.tools.querySelector(`[data-a="${a}"]`);
      const h = q('hintTog'); h.classList.toggle('on', U.hint); h.querySelector('.tv').textContent = U.hint ? '開' : '關';
      const sg = q('suggest'); sg.classList.toggle('dim', !canDiscard());
      sg.querySelector('.tl').textContent = sg.dataset.confirm ? '再按確認' : '建議出牌';
      sg.querySelector('.tp').innerHTML = U.freeHints > 0 ? `免費 ×${U.freeHints}` : `${api.icons.gem()}${COST.hint}`;
      sg.classList.toggle('free', U.freeHints > 0);
      const au = q('auto'); au.classList.toggle('on', U.auto);
      au.querySelector('.tl').textContent = au.dataset.confirm ? '再按確認' : U.auto ? '取消託管' : '託管代打';
      au.querySelector('.tp').innerHTML = U.autoPaid ? '本局已付' : `${api.icons.gem()}${COST.auto}`;
      q('speed').querySelector('.spd').textContent = U.speed + '×';
    }

    // ---------- 手牌操作（點選／拖曳） ----------
    let drag = null;
    function bindHand() {
      R.hand.addEventListener('pointerdown', e => {
        const t = e.target.closest('.mj-t[data-id]');
        if (!t) return;
        drag = { id: +t.dataset.id, el: t, x: e.clientX, y: e.clientY, moved: false, pid: e.pointerId };
        try { R.hand.setPointerCapture(e.pointerId); } catch (err) { /* 略 */ }
      });
      R.hand.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.pid) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 12 && canDiscard()) { drag.moved = true; drag.el.classList.add('drag'); }
        if (drag.moved) drag.el.style.transform = `translate(${dx}px,${dy}px) scale(1.12)`;
      });
      const up = e => {
        if (!drag || e.pointerId !== drag.pid) return;
        const d = drag;
        drag = null;
        if (d.moved) {
          if (e.type === 'pointerup' && e.clientY - d.y < -(U.geo ? U.geo.hh * .75 : 40) && canDiscard()) { doDiscard(d.id); return; }
          d.el.classList.remove('drag'); d.el.style.transform = '';
          return;
        }
        if (e.type === 'pointerup') tapTile(d.id, d.el);
      };
      R.hand.addEventListener('pointerup', up);
      R.hand.addEventListener('pointercancel', up);
    }
    function tapTile(id, el) {
      const P = U.pre;
      if (P && P.picking) {
        const i = P.picks.indexOf(id);
        if (i >= 0) P.picks.splice(i, 1); else if (P.picks.length < 3) P.picks.push(id); else { api.shake(el); return; }
        sfx.select(); renderHand(); P.draw();
        return;
      }
      if (!canDiscard()) { el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-5px)' }, { transform: 'translateY(0)' }], { duration: 180 }); return; }
      if (U.sel === id) { doDiscard(id); return; }
      U.sel = id; sfx.select();
      R.hand.querySelectorAll('.mj-t.up').forEach(e => e.classList.remove('up'));
      el.classList.add('up');
      updateTing();
    }
    function doDiscard(id) {
      const P = U.pend;
      if (!P || P.kind !== 'turn' || P.done) return;
      P.resolve({ a: 'discard', tile: id });
    }

    // ---------- 動作按鈕 ----------
    let cdT = null;
    const stopCd = () => { cancel(cdT); cdT = null; };
    function hideActs() { stopCd(); U.onChoice = null; if (R.acts) { R.acts.classList.remove('on'); R.acts.innerHTML = ''; } }
    function showActs(list, o = {}) {
      stopCd();
      const want = o.tile != null ? `<span class="mj-want">${tileHTML(kindOf(o.tile))}</span>` : '';
      const ring = o.timeout ? `<i class="mj-cd"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/><circle class="fg" cx="20" cy="20" r="17" style="animation-duration:${o.timeout}ms"/></svg><b class="num">${Math.ceil(o.timeout / 1000)}</b></i>` : '';
      R.acts.innerHTML = `<div class="mj-acts-in">${want}${list.map(b => `<button class="mj-ab ${b.id}" data-a="act" data-v="${b.id}"><span>${b.label}</span></button>`).join('')}${ring}</div>`;
      R.acts.classList.add('on');
      if (o.timeout) {
        let left = o.timeout;
        const num = R.acts.querySelector('.mj-cd b');
        const tick = () => {
          if (!isHidden()) {
            left -= 250;
            const s = Math.max(0, Math.ceil(left / 1000));
            if (num && num.textContent !== String(s)) { num.textContent = s; if (s <= 3 && s > 0) sfx.tick(); }
            if (left <= 0) { cdT = null; if (U.pend && U.pend.onAct) U.pend.onAct(o.def); return; }
          }
          cdT = later(tick, 250);
        };
        cdT = later(tick, 250);
      }
    }
    function showChoices(opts, render, onPick) {
      stopCd();
      R.acts.innerHTML = `<div class="mj-acts-in choose">${opts.map((op, i) => `<button class="mj-chi" data-a="choice" data-v="${i}">${render(op)}</button>`).join('')}<button class="mj-ab pass" data-a="choice" data-v="-1"><span>返回</span></button></div>`;
      R.acts.classList.add('on');
      U.onChoice = onPick;
    }

    // ---------- 玩家代理（等使用者操作） ----------
    function mkPend(kind, resolve, reject, extra) {
      const P = Object.assign({ kind }, extra);
      rejects.add(reject);
      P.resolve = v => {
        if (P.done) return;
        P.done = true; rejects.delete(reject);
        if (U.pend === P) U.pend = null;
        hideActs(); U.sel = null; refreshTools();
        resolve(v);
      };
      return P;
    }
    function startPend(P) {
      U.pend = P;
      refreshTools();
      if (U.auto) { autoResolve(P); return; }
      P.show();
      if (P.kind === 'turn') { renderHand(); updateTing(); }
    }
    function autoResolve(P) {
      if (!P || P.done) return;
      hideActs();
      later(() => {
        if (P.done) return;
        if (!U.auto) { P.show(); renderHand(); return; }
        P.resolve(P.kind === 'turn' ? Core.aiTurn(U.S, 0, P.info, 2) : Core.aiClaim(U.S, 0, P.tile, P.from, P.o, 2));
      }, T(P.kind === 'turn' ? 560 : 320));
    }
    const human = {
      turn: (S, p, info) => new Promise((resolve, reject) => {
        const P = mkPend('turn', resolve, reject, { info });
        P.show = () => {
          const list = [];
          if (info.canHu) list.push({ id: 'hu', label: '自摸' });
          if (info.akongs.length || info.kkongs.length) list.push({ id: 'kong', label: '槓' });
          if (list.length) {
            list.push({ id: 'pass', label: '過' });
            showActs(list, { timeout: info.canHu ? 15000 : 0, def: 'hu' });
            if (info.canHu) { sfx.alert(); api.vib([20, 40, 20]); }
          } else hideActs();
        };
        P.onAct = id => {
          if (id === 'hu') return P.resolve({ a: 'hu' });
          if (id === 'kong') {
            const opts = [...info.akongs.map(k => ({ a: 'akong', k })), ...info.kkongs.map(k => ({ a: 'kkong', k }))];
            if (opts.length === 1) return P.resolve(opts[0]);
            return showChoices(opts, op => [0, 1, 2, 3].map(() => tileHTML(op.k)).join(''), i => (i < 0 ? P.show() : P.resolve(opts[i])));
          }
          hideActs();
        };
        startPend(P);
      }),
      claim: (S, q, tile, from, o) => new Promise((resolve, reject) => {
        const P = mkPend('claim', resolve, reject, { tile, from, o });
        P.show = () => {
          const list = [];
          if (o.hu) list.push({ id: 'hu', label: o.rob ? '搶槓' : '胡' });
          if (o.kong) list.push({ id: 'kong', label: '槓' });
          if (o.pon) list.push({ id: 'pon', label: '碰' });
          if (o.chi) list.push({ id: 'chi', label: '吃' });
          list.push({ id: 'pass', label: '過' });
          showActs(list, { timeout: o.hu ? 10000 : 7000, def: o.hu ? 'hu' : 'pass', tile });
        };
        P.onAct = id => {
          if (id === 'chi' && o.chi) {
            if (o.chi.length === 1) return P.resolve({ a: 'chi', i: 0 });
            const tk = kindOf(tile);
            return showChoices(o.chi, cb => [cb[0], cb[1], tk].sort((a, b) => a - b).map(k => tileHTML(k, k === tk ? 'hl' : '')).join(''), i => (i < 0 ? P.show() : P.resolve({ a: 'chi', i })));
          }
          P.resolve({ a: id });
        };
        if (!U.auto) { if (o.hu) { sfx.alert(); api.vib([30, 50, 30]); } else sfx.ping(); }
        startPend(P);
      }),
    };
    const aiAgent = lv => ({
      turn: async (S, p, info) => { await wait(T(info.mode === 'call' ? 420 : 460 + Math.random() * 460)); return Core.aiTurn(S, p, info, lv); },
      claim: (S, q, tile, from, o) => Core.aiClaim(S, q, tile, from, o, lv),
    });

    // ---------- 開局換三張 ----------
    function pregame() {
      return new Promise((resolve, reject) => {
        if (U.auto || !R.table) return resolve();
        rejects.add(reject);
        renderAll();
        const bar = document.createElement('div');
        bar.className = 'mj-pre';
        R.table.appendChild(bar);
        const P = { picks: [], picking: false, done: false };
        U.pre = P;
        let tm = null;
        P.finish = () => {
          if (P.done) return;
          P.done = true; cancel(tm); rejects.delete(reject);
          bar.classList.add('out'); later(() => bar.remove(), 300);
          U.pre = null; renderHand(); resolve();
        };
        P.draw = () => {
          if (!P.picking) bar.innerHTML = `<div class="pt"><b>開局換三張</b><small>手牌不順？花 ${api.icons.gem()}${COST.swap} 換掉三張</small></div><button class="btn gemb" data-a="swap">換三張</button><button class="btn ghost" data-a="preskip">開打</button><i class="pbar"><i style="animation-duration:${PRE_MS}ms"></i></i>`;
          else bar.innerHTML = `<div class="pt"><b>選三張要換的牌</b><small>已選 <b class="num">${P.picks.length}</b> / 3</small></div><button class="btn gemb${P.picks.length === 3 ? '' : ' off'}" data-a="swapok"><span class="tl">${P.confirming ? '再按確認' : '確定換牌'}</span><small>${api.icons.gem()}${COST.swap}</small></button><button class="btn ghost" data-a="swapcancel">取消</button>`;
        };
        P.startPick = () => { P.picking = true; cancel(tm); P.draw(); renderHand(); };
        P.cancelPick = () => { P.picking = false; P.picks = []; P.draw(); renderHand(); tm = later(() => { if (!P.picking) P.finish(); }, 2500); };
        P.confirm = btn => {
          if (P.picks.length < 3) { api.shake(btn); snd.err(); return; }
          api.twoTap(btn, async () => {
            P.confirming = false;
            if (!api.spendGems(COST.swap)) { P.draw(); return; }
            try {
            const ids = P.picks.slice();
            ids.forEach(id => { const e = R.hand.querySelector(`[data-id="${id}"]`); if (e) e.classList.add('swapout'); });
            snd.buy();
            await wait(T(420));
            const got = Core.swapTiles(U.S, 0, ids);
            P.picks = []; P.picking = false;
            U.newIds = new Set(got);
            renderHand();
            butlerSay('換好了，大小姐。祝您手氣長紅。');
            api.stat('mahjong_swap', 1);
            await wait(T(650));
            P.finish();
            } catch (e) { if (e !== Core.ABORT) console.error(e); }
          }, () => { P.confirming = !!btn.dataset.confirm; const tl = btn.querySelector('.tl'); if (tl) tl.textContent = btn.dataset.confirm ? '再按確認' : '確定換牌'; });
        };
        P.draw();
        tm = later(() => { if (!P.picking) P.finish(); }, PRE_MS);
      });
    }

    // ---------- 粉鑽服務 ----------
    function doSuggest(btn) {
      const P = U.pend;
      if (!P || P.kind !== 'turn' || U.auto) { snd.err(); api.toast('輪到妳出牌時才能用喔'); return; }
      const run = free => {
        if (!U.pend || U.pend.kind !== 'turn') return;
        if (free) U.freeHints--;
        else if (!api.spendGems(COST.hint)) return;
        refreshTools();
        const ev = Core.aiDiscardEval(U.S, 0, 2);
        U.sug = ev.tile; U.sel = ev.tile;
        renderHand(); updateTing();
        snd.ding();
        const c = Core.countsOf(U.S.hands[0]); c[ev.k]--;
        const w = Core.waits(c);
        butlerSay(`建議打「${Core.tileName(ev.k)}」${w.length ? `，打完就聽 ${w.map(Core.tileName).join('、')}` : ev.shanten === 1 ? '，這樣最快聽牌' : ''}。再點一下就能打出。`);
        api.stat('mahjong_hint', 1);
      };
      if (U.freeHints > 0) { snd.click(); run(true); return; }
      api.twoTap(btn, () => run(false), refreshTools);
    }
    function doAuto(btn) {
      if (U.autoPaid) {
        snd.click(); U.auto = !U.auto; refreshTools();
        if (U.auto) { butlerSay('交給我吧，大小姐。'); if (U.pend) autoResolve(U.pend); if (U.pre) U.pre.finish(); }
        else if (U.pend && !U.pend.done) { U.pend.show(); renderHand(); }
        return;
      }
      if (!U.inHand) { snd.err(); api.toast('牌局開始後才能託管'); return; }
      api.twoTap(btn, () => {
        if (!U.inHand) return;
        if (!api.spendGems(COST.auto)) return;
        U.autoPaid = true; U.auto = true;
        snd.buy();
        butlerSay('交給我吧，大小姐。這一局由史利代打。');
        api.stat('mahjong_auto', 1);
        refreshTools();
        if (U.pend) autoResolve(U.pend);
        if (U.pre) U.pre.finish();
      }, refreshTools);
    }

    // ---------- 演出小工具 ----------
    function tableRect() { return R.table.getBoundingClientRect(); }
    function fly(html, from, to, o = {}) {
      if (!R.layer || !from || !to) return Promise.resolve();
      const base = tableRect();
      const el = document.createElement('div');
      el.className = 'mj-fly' + (o.cls ? ' ' + o.cls : '');
      el.innerHTML = html;
      if (o.w) el.style.setProperty('--w', o.w + 'px');
      const fx = from.left + from.width / 2 - base.left, fy = from.top + from.height / 2 - base.top;
      const tx = to.left + to.width / 2 - base.left, ty = to.top + to.height / 2 - base.top;
      el.style.left = fx + 'px'; el.style.top = fy + 'px';
      R.layer.appendChild(el);
      const s0 = o.s0 ?? 1, s1 = o.s1 ?? 1, r0 = o.r0 || 0, r1 = o.r1 || 0;
      const kf = [{ transform: `translate(-50%,-50%) rotate(${r0}deg) scale(${s0})`, opacity: o.o0 ?? 1 }];
      if (o.arc) kf.push({ transform: `translate(calc(-50% + ${(tx - fx) / 2}px), calc(-50% + ${(ty - fy) / 2 - o.arc}px)) rotate(${(r0 + r1) / 2}deg) scale(${(s0 + s1) / 2 * 1.12})`, offset: .5 });
      kf.push({ transform: `translate(calc(-50% + ${tx - fx}px), calc(-50% + ${ty - fy}px)) rotate(${r1}deg) scale(${s1})`, opacity: o.o1 ?? 1 });
      const dur = Math.max(1, o.dur || 300);
      const an = el.animate(kf, { duration: dur, easing: o.ease || 'cubic-bezier(.25,.8,.3,1)', fill: 'forwards' });
      return new Promise(res => {
        let fin = false;
        const end = () => { if (fin) return; fin = true; el.remove(); res(); };
        an.onfinish = end; an.oncancel = end;
        later(end, dur + 400);
      });
    }
    function seatPoint(p) {
      if (p === 0) { const r = R.hand.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top - 6 }; }
      const r = R.seat[p].img.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    function bigText(p, text, cls = '') {
      if (!R.layer) return;
      const base = tableRect();
      let { x, y } = seatPoint(p);
      if (p === 2) y += 62; else if (p !== 0) y += 52; else y -= 26;
      x = clamp(x, base.left + 74, base.right - 74);
      const el = document.createElement('div');
      el.className = 'mj-big ' + cls;
      el.innerHTML = `<b>${text}</b>`;
      el.style.left = x - base.left + 'px'; el.style.top = y - base.top + 'px';
      R.layer.appendChild(el);
      later(() => el.remove(), 1600);
      api.fx.burst(x, y, RM ? 4 : 16, ['spark', 'confetti']);
    }
    function textAt(p, text, cls = '') {
      if (!R.layer) return;
      const base = tableRect();
      let { x, y } = seatPoint(p);
      if (p !== 0) y += 30;
      x = clamp(x, base.left + 40, base.right - 40);
      const el = document.createElement('div');
      el.className = 'mj-pop ' + cls;
      el.textContent = text;
      el.style.left = x - base.left + 'px'; el.style.top = y - base.top + 'px';
      R.layer.appendChild(el);
      later(() => el.remove(), 1100);
    }
    function setExpr(p, expr, ms) {
      const s = R.seat && R.seat[p];
      if (!s) return;
      const c = seatCast(p);
      s.img.src = c.face(expr); s.el.dataset.expr = expr;
      cancel(U.exprT[p]);
      if (ms) U.exprT[p] = later(() => { s.img.src = c.face('neutral'); s.el.dataset.expr = 'neutral'; }, ms);
    }
    function say(p, text, expr, ms = 2400) {
      if (expr) setExpr(p, expr, ms + 500);
      if (!text || !R.layer || p === 0) return;
      const old = R.layer.querySelector(`.mj-say.s${p}`);
      if (old) old.remove();
      const base = tableRect(), r = R.seat[p].img.getBoundingClientRect();
      const el = document.createElement('div');
      el.className = `mj-say s${p}`;
      el.textContent = text;
      el.style.top = r.bottom - base.top + 8 + 'px';
      if (p === 1) el.style.right = Math.max(4, base.right - r.right) + 'px';
      else el.style.left = Math.max(4, r.left - base.left) + 'px';
      R.layer.appendChild(el);
      later(() => { el.classList.add('out'); later(() => el.remove(), 300); }, ms);
    }
    function butlerSay(text) {
      if (!R.layer) return;
      const old = R.layer.querySelector('.mj-butler');
      if (old) old.remove();
      const b = castAll[5];
      const el = document.createElement('div');
      el.className = 'mj-butler';
      el.innerHTML = `<img src="${b.face('joy')}" alt=""><p><b>管家 ${api.esc(b.name)}</b>${text}</p>`;
      el.style.bottom = R.table.clientHeight - R.mine.offsetTop + 6 + 'px';
      R.layer.appendChild(el);
      later(() => { el.classList.add('out'); later(() => el.remove(), 320); }, 3600);
    }
    function flash(p) { const s = R.seat[p]; if (!s) return; s.el.classList.remove('flash'); void s.el.offsetWidth; s.el.classList.add('flash'); }
    function preload() {
      for (let p = 0; p < 4; p++) { const c = seatCast(p); for (const e of ['neutral', 'joy', 'sad', 'angry']) { const im = new Image(); im.src = c.face(e); } }
      const im = new Image(); im.src = castAll[5].face('joy');
    }

    // ================= 一場牌局 =================
    async function startSession() {
      const s = store(), o = s.opts;
      const a = tableAmounts(o.table);
      if (api.coins < a.di * 2) { snd.err(); api.shake(root.querySelector('.mj-go')); api.toast(`入座至少要有 ${api.fmt(a.di * 2)} 金幣`); return; }
      snd.buy();
      U.sess = { mode: o.mode, level: o.level, table: TABLES[o.table], di: a.di, unit: a.unit, startDealer: 0, dealer: 0, round: 0, streak: 0, hands: 0, done: false, dealerKnown: false, scores: [0, 0, 0, 0], real: 0 };
      s.st.sessions++; api.save();
      api.stat('mahjong_sessions', 1);
      preload();
      buildTable();
      R.table.classList.add('enter');
      renderAll();
      try {
        await wait(T(500));
        for (let p = 1; p < 4; p++) later(() => say(p, lineOf(p, 'hi'), 'joy', 2200), T(150 + p * 520));
        await wait(T(900));
        await diceIntro();
        for (;;) {
          await handIntro();
          const out = await playOneHand();
          Core.nextSession(U.sess, out.res);
          const act = await showResult(out);
          if (act === 'again') return startSession();
          if (act === 'quit' || U.sess.done) {
            if (U.sess.mode !== 'single' && U.sess.hands > 1) { const f = await showFinal(); if (f === 'again') return startSession(); }
            showTitle();
            return;
          }
        }
      } catch (e) {
        if (e === Core.ABORT || closed) return;
        console.error(e);
        api.toast('牌局發生錯誤，先回到大廳');
        U.inHand = false;
        showTitle();
      }
    }
    async function diceIntro() {
      const sess = U.sess;
      R.center.classList.add('rolling');
      R.rd.textContent = '擲骰定莊'; R.lf.textContent = ''; R.lb.textContent = '';
      sfx.dice();
      let f = [1, 1, 1];
      for (let i = 0; i < 14; i++) {
        f = f.map(() => 1 + Math.floor(Math.random() * 6));
        R.dice.innerHTML = f.map(dieHTML).join('');
        R.dice.querySelectorAll('.mj-die').forEach(d => { d.style.transform = `rotate(${Math.random() * 50 - 25}deg) translateY(${-Math.random() * 8}px)`; });
        await wait(T(55 + i * 7));
      }
      const fd = api.sandbox && window.__mj ? window.__mj.forceDealer : null;
      if (fd != null) { f = [1, 2, fd + 2]; R.dice.innerHTML = f.map(dieHTML).join(''); }
      R.dice.querySelectorAll('.mj-die').forEach(d => { d.style.transform = ''; d.classList.add('land'); });
      const sum = f[0] + f[1] + f[2];
      R.rd.textContent = `點數 ${sum}`;
      snd.beep(880, .12, 'triangle', .07);
      await wait(T(380));
      const d = (sum - 1) % 4, steps = d + 5;
      for (let i = 0; i < steps; i++) { flash(i % 4); snd.beep(660 + i * 28, .05, 'sine', .045); await wait(T(110 + i * 6)); }
      sess.dealer = sess.startDealer = d; sess.dealerKnown = true;
      for (let p = 0; p < 4; p++) renderSeat(p);
      renderCenter();
      bigText(d, '莊', 'zhuang');
      sfx.call();
      if (d) say(d, lineOf(d, 'dealer'), 'joy', 2000);
      await wait(T(1100));
      R.center.classList.remove('rolling');
      R.dice.innerHTML = '';
    }
    async function handIntro() {
      const sess = U.sess;
      U.S = null;
      renderAll();
      ov.setTitle(`貴婦麻將館・${WIND[sess.round]}風圈`);
      const el = document.createElement('div');
      el.className = 'mj-banner hand';
      el.innerHTML = `<em>${sess.mode === 'single' ? 'Single Hand' : `Hand ${sess.hands + 1}`}</em><b>${WIND[sess.round]}風${WIND[(sess.dealer - sess.startDealer + 4) % 4]}局</b><small>${nameOf(sess.dealer)}坐莊${sess.streak ? `・連莊 ${sess.streak}` : ''}</small>`;
      R.table.appendChild(el);
      snd.ding();
      await wait(T(1300));
      el.classList.add('out');
      await wait(280);
      el.remove();
    }
    async function playOneHand() {
      const sess = U.sess;
      U.auto = false; U.autoPaid = false; U.sel = null; U.sug = null; U.pend = null; U.inHand = true; U.leaving = false;
      U.freeHints = Math.max(0, Math.floor(perk('mahjong_hint'))); U.bonus = null;
      refreshTools();
      const cfg = { dealer: sess.dealer, round: sess.round, streak: sess.streak, di: sess.di, unit: sess.unit, rig: U.rig };
      const agents = [human, aiAgent(sess.level), aiAgent(sess.level), aiAgent(sess.level)];
      try {
        return await Core.playHand(cfg, agents, { on: onEvent, abort: () => closed, pregame });
      } finally {
        U.inHand = false; U.pend = null; U.auto = false;
        hideActs();
      }
    }
    async function onEvent(ev, S) {
      U.S = S;
      switch (ev.t) {
        case 'deal': return animDeal();
        case 'flower': return animFlower(ev);
        case 'draw': return animDraw(ev);
        case 'start': renderAll(); return startTips();
        case 'turn': markTurn(); if (ev.p !== 0 && Math.random() < .05) say(ev.p, lineOf(ev.p, 'idle'), null, 1800); return;
        case 'discard': return animDiscard(ev);
        case 'call': return animCall(ev);
        case 'kkong': textAt(ev.p, '加槓', 'call'); return wait(T(320));
        case 'kong': return animKong(ev);
        case 'win': return animWin(ev.res);
        case 'exhaust': return animExhaust();
        default: return undefined;
      }
    }
    function markTurn() {
      const S = U.S;
      for (let p = 0; p < 4; p++) R.seat[p].el.classList.toggle('on', S.phase === 'play' && S.turn === p);
      renderCenter();
      R.hand.classList.toggle('turn', S.turn === 0);
    }

    // ---------- 各事件動畫 ----------
    async function animDeal() {
      const S = U.S;
      U.S = Object.assign({}, S, { hands: [[], [], [], []] });
      renderAll();
      U.S = S;
      const c = R.center.getBoundingClientRect();
      const cnt = [0, 0, 0, 0];
      snd.hiss(.4, .05, 2500);
      for (let r = 0; r < 4; r++) {
        for (let i = 0; i < 4; i++) {
          const p = (S.dealer + i) % 4;
          const to = p === 0 ? R.hand.getBoundingClientRect() : R.seat[p].img.getBoundingClientRect();
          fly(`<span class="mj-stk">${backHTML()}${backHTML()}</span>`, c, to, { dur: T(260), s0: .6, s1: p === 0 ? 1.3 : .8, w: U.geo.rw });
          await wait(T(62));
          cnt[p] += 4;
          if (p === 0) R.rows[0].innerHTML = Array.from({ length: Math.min(9, cnt[0]) }, () => backHTML()).join(''), R.rows[1].innerHTML = Array.from({ length: Math.max(0, cnt[0] - 9) }, () => backHTML()).join('');
          else if (R.seat[p].sc) R.seat[p].sc.textContent = cnt[p];
          snd.hiss(.03, .04, 3500);
        }
      }
      await wait(T(300));
      renderSeat(S.dealer);
      renderHand({ deal: true });
      for (let p = 1; p < 4; p++) renderSeat(p);
      snd.hiss(.25, .05, 4000);
      await wait(T(820));
      updateTing();
    }
    async function animFlower(ev) {
      const p = ev.p, k = kindOf(ev.tile);
      let from;
      if (p === 0) { const el = R.hand.querySelector(`[data-id="${ev.tile}"]`); from = el ? el.getBoundingClientRect() : R.hand.getBoundingClientRect(); flipHand(() => renderHand()); }
      else from = R.seat[p].img.getBoundingClientRect();
      textAt(p, '補花', 'flower');
      sfx.flower();
      await fly(tileHTML(k), from, R.seat[p].sf.getBoundingClientRect(), { dur: T(ev.init ? 420 : 520), s0: p === 0 ? U.geo.hw / U.geo.rw : 1.15, s1: .45, arc: 40, w: U.geo.rw });
      renderSeat(p);
    }
    async function animDraw(ev) {
      const p = ev.p;
      renderCenter();
      if (p === 0) {
        U.newIds = new Set([ev.tile]);
        renderHand(); updateTing();
        if (!ev.init) sfx.draw();
        await wait(T(ev.init ? 140 : 240));
      } else {
        if (R.seat[p].sc) R.seat[p].sc.textContent = U.S.hands[p].length;
        await wait(T(ev.init ? 60 : 110));
      }
    }
    async function animDiscard(ev) {
      const p = ev.p, k = kindOf(ev.tile), g = U.geo;
      let from, s0;
      if (p === 0) {
        const el = R.hand.querySelector(`[data-id="${ev.tile}"]`);
        from = el ? el.getBoundingClientRect() : R.hand.getBoundingClientRect();
        if (el) el.style.visibility = 'hidden';
        s0 = g.hw / g.rw;
        U.sel = null; U.sug = null;
      } else { from = R.seat[p].img.getBoundingClientRect(); s0 = .7; }
      renderRiver(p, true);
      const tgt = R.rivers[p].lastElementChild;
      if (p === 0) { flipHand(() => renderHand()); updateTing(); } else if (R.seat[p].sc) R.seat[p].sc.textContent = U.S.hands[p].length;
      for (let q = 0; q < 4; q++) if (q !== p) { const l = R.rivers[q].querySelector('.last'); if (l) l.classList.remove('last'); }
      await fly(tileHTML(k), from, tgt.getBoundingClientRect(), { dur: T(p === 0 ? 230 : 290), r1: [0, -90, 180, 90][p], s0, s1: 1, w: g.rw, arc: p === 0 ? 18 : 0 });
      tgt.classList.remove('ghost');
      tgt.classList.add('land');
      sfx.clack(p === 0 ? 1 : .75);
      if (p === 0) api.vib(8);
    }
    async function animCall(ev) {
      const { p, from, meld, call } = ev;
      const src = R.rivers[from].lastElementChild;
      const fr = src ? src.getBoundingClientRect() : R.center.getBoundingClientRect();
      bigText(p, { chi: '吃', pon: '碰', kong: '槓' }[call], call);
      if (call === 'kong') sfx.kong(); else sfx.call();
      if (p === 0) api.vib(25);
      else if (Math.random() < .7) say(p, lineOf(p, call), 'joy', 2000);
      if (from !== 0 && Math.random() < .25) later(() => setExpr(from, 'angry', 1500), 300);
      renderRiver(from);
      const toEl = p === 0 ? R.mine : R.seat[p].sm;
      if (p === 0) { renderMine(); flipHand(() => renderHand()); }
      else renderSeat(p);
      const last = toEl.lastElementChild || toEl;
      await fly(tileHTML(kindOf(meld.taken)), fr, last.getBoundingClientRect(), { dur: T(380), s0: 1.2, s1: p === 0 ? g2(U.geo.mw / U.geo.rw) : .6, arc: 30, w: U.geo.rw });
      if (last.classList) { last.classList.add('pop'); }
      renderCenter();
      await wait(T(420));
    }
    const g2 = v => Math.max(.3, v);
    async function animKong(ev) {
      const { p, meld } = ev;
      bigText(p, meld.type === 'akong' ? '暗槓' : '槓', 'kong');
      sfx.kong();
      if (p === 0) { api.vib(30); renderMine(); flipHand(() => renderHand()); }
      else { renderSeat(p); if (Math.random() < .6) say(p, lineOf(p, 'kong'), 'joy', 2000); }
      await wait(T(700));
    }
    function applyMoney(res) {
      const sess = U.sess;
      let net = 0;
      for (const p of res.pays) { sess.scores[p.to] += p.amount; sess.scores[p.from] -= p.amount; if (p.to === 0) net += p.amount; if (p.from === 0) net -= p.amount; }
      let real = net;
      if (net > 0) api.payout(net);
      else if (net < 0) {
        const need = -net;
        if (api.coins >= need) api.spendCoins(need);
        else {
          const had = Math.max(0, Math.floor(api.coins));
          if (had > 0) api.spendCoins(had);
          real = -had;
          sess.scores[0] += need - had;
          later(() => api.toast('金幣不夠付，已經扣到 0 了'), 1800);
        }
      }
      sess.real += real;
      U.lastDelta = real;
      const s = store(), r = s.st;
      r.hands++; r.net += real;
      if (res.winner === 0) {
        r.wins++;
        if (res.from == null) r.zimo++;
        const tai = Math.max(...res.pays.map(x => x.tai));
        if (tai > r.maxTai) { r.maxTai = tai; r.maxName = (res.score.items.slice().sort((a, b) => b.tai - a.tai)[0] || {}).name || ''; }
        api.stat('mahjong_wins', 1);
      }
      if (res.from === 0) r.deal++;
      api.stat('mahjong_hands', 1);
      const tai = Math.max(...res.pays.map(x => x.tai));
      evt('mahjong_hand', { win: res.winner === 0, tai });
      if (res.winner === 0) {
        evt('mahjong_win', { tai });
        const g = { res: { spice: Math.round(Math.max(100, typeof api.resUnit === 'function' ? api.resUnit() : 100) * (0.3 + tai * 0.05)) } };
        let shard = null;
        if (tai >= 8) {
          const payer = res.from != null ? res.from : pick(res.pays.map(x => x.from));
          const c = seatCast(payer);
          if (c && c.id) { g.shards = { [c.id]: 1 }; shard = c; }
        }
        if (typeof api.grant === 'function') {
          try {
            const rc = R.table ? R.table.getBoundingClientRect() : null;
            api.grant(g, rc ? rc.left + rc.width / 2 : undefined, rc ? rc.top + rc.height / 2 : undefined, true);
            U.bonus = { spice: g.res.spice, shard };
          } catch (e) { console.error(e); }
        }
      }
      api.save();
    }
    async function animWin(res) {
      hideActs();
      applyMoney(res);
      for (let p = 0; p < 4; p++) renderSeat(p);
      const w = res.winner;
      if (res.from != null) {
        const src = R.rivers[res.from].lastElementChild;
        const fr = src ? src.getBoundingClientRect() : R.center.getBoundingClientRect();
        renderRiver(res.from);
        const to = w === 0 ? R.hand.getBoundingClientRect() : R.seat[w].img.getBoundingClientRect();
        bigText(w, res.ctx.robKong ? '搶槓' : '胡', 'hu');
        await fly(tileHTML(kindOf(res.tile)), fr, to, { dur: T(460), s0: 1.2, s1: 1.8, arc: 50, w: U.geo.rw, cls: 'glow' });
      } else {
        bigText(w, '自摸', 'hu');
        if (w === 0) { const el = R.hand.querySelector(`[data-id="${res.tile}"]`); if (el) el.classList.add('winning'); }
        await wait(T(500));
      }
      await winSplash(res);
    }
    function winSplash(res) {
      return new Promise(resolve => {
        const w = res.winner, x = res.ctx, meWin = w === 0, meLose = res.pays.some(p => p.from === 0);
        let word = x.self ? '自摸' : '胡牌';
        if (x.tenhou) word = '天胡'; else if (x.chihou) word = '地胡';
        const subs = [];
        const bigItem = res.score.items.filter(i => i.tai >= 4 && !/天胡|地胡/.test(i.name)).sort((a, b) => b.tai - a.tai)[0];
        if (bigItem) subs.push(bigItem.name);
        if (x.robKong) subs.push('搶槓'); if (x.kongDraw && x.self) subs.push('槓上開花'); if (x.haitei && x.self) subs.push('海底撈月'); if (x.houtei && !x.self) subs.push('河底撈魚');
        const el = document.createElement('div');
        el.className = `mj-splash${meWin ? ' win' : meLose ? ' lose' : ''}`;
        const who = w === 0 ? api.player().full : seatCast(w).full;
        el.innerHTML = `<i class="sp-bg"></i><i class="sp-rays"></i><img class="sp-who" src="${who}" alt=""><div class="sp-word"><b>${word}</b>${subs.length ? `<small>${subs.join('・')}</small>` : ''}<p>${nameOf(w)}${x.self ? '自摸' : '胡牌'}${res.from != null ? `　${nameOf(res.from)}放槍` : '　三家付'}</p></div>`;
        R.table.appendChild(el);
        const r = el.getBoundingClientRect();
        if (meWin) { sfx.win(); api.vib([40, 60, 80]); api.fx.rain('confetti', 70, r); later(() => api.fx.burst(r.left + r.width / 2, r.top + r.height * .45, 30, ['coin', 'spark', 'heart']), 350); }
        else if (meLose) { sfx.lose(); api.vib(70); }
        else sfx.otherWin();
        setExpr(w, 'joy', 6000);
        for (const p of res.pays) setExpr(p.from, Math.random() < .55 ? 'sad' : 'angry', 6000);
        if (w !== 0) later(() => say(w, lineOf(w, x.self ? 'zimo' : 'win'), 'joy', 3000), 200);
        const loser = res.from;
        if (loser != null && loser !== 0) later(() => say(loser, lineOf(loser, 'lose'), 'sad', 2600), 900);
        if (meWin && loser == null) for (let p = 1; p < 4; p++) later(() => say(p, lineOf(p, 'other'), Math.random() < .5 ? 'angry' : 'sad', 2400), 500 + p * 300);
        let fin = false;
        const end = () => { if (fin) return; fin = true; el.classList.add('out'); later(() => { el.remove(); resolve(); }, 360); };
        el.addEventListener('click', end);
        later(end, T(2400) + (meWin ? 400 : 0));
      });
    }
    async function animExhaust() {
      hideActs();
      U.lastDelta = 0;
      const s = store(); s.st.hands++; api.save();
      api.stat('mahjong_hands', 1);
      U.bonus = null;
      evt('mahjong_hand', { win: false, tai: 0 });
      const el = document.createElement('div');
      el.className = 'mj-banner draw';
      el.innerHTML = '<em>Exhaustive Draw</em><b>流局</b><small>海底撈完・無人胡牌</small>';
      R.table.appendChild(el);
      snd.beep(330, .5, 'triangle', .07); snd.beep(247, .6, 'triangle', .06, .25);
      for (let p = 1; p < 4; p++) if (Math.random() < .4) setExpr(p, 'sad', 2400);
      await wait(T(1700));
      el.classList.add('out');
      await wait(300);
      el.remove();
    }

    // ---------- 結算畫面 ----------
    function showResult({ S, res }) {
      return new Promise(resolve => {
        const sess = U.sess, delta = U.lastDelta || 0;
        const el = document.createElement('div');
        el.className = 'mj-result';
        let tone, eyebrow, title, sub, face, line, rows = [], totalTai = 0, payHTML = '', handHTML = '', formula = '';
        if (res.type === 'win') {
          const w = res.winner, meWin = w === 0, meLose = res.pays.some(p => p.from === 0);
          tone = meWin ? 'win' : meLose ? 'lose' : 'other';
          eyebrow = meWin ? (res.from == null ? 'Self-Drawn Victory' : 'Victory') : meLose ? (res.from === 0 ? 'Dealt In' : 'Paid Out') : 'Hand Complete';
          title = meWin ? (res.from == null ? '自摸！' : '胡牌！') : meLose ? (res.from === 0 ? '放槍了…' : '被自摸了…') : `${nameOf(w)} 胡牌`;
          sub = `${nameOf(w)}${res.from == null ? ' 自摸' : ` 胡 ${nameOf(res.from)}`}・${Core.tileName(kindOf(res.tile))}`;
          face = w === 0 ? api.player().face('joy') : seatCast(w).face('joy');
          line = w === 0 ? pick(ME_WIN) : lineOf(w, res.from == null ? 'zimo' : 'win');
          rows = res.score.items.map(i => ({ n: i.name, t: i.tai }));
          const dealerPaysOnly = res.from == null && w !== S.dealer;
          if (w === S.dealer || res.from === S.dealer || res.from == null) for (const i of Core.dealerItems(S.streak)) rows.push({ n: i.name, t: i.tai, d: dealerPaysOnly });
          totalTai = res.from == null ? res.score.total + (w === S.dealer ? 1 + 2 * S.streak : 0) : res.pays[0].tai;
          // 攤牌
          const hk = S.hands[w].slice(), wt = res.tile;
          hk.splice(hk.indexOf(wt), 1);
          hk.sort((a, b) => kindOf(a) - kindOf(b) || a - b);
          handHTML = `<div class="rh-tiles">${hk.map((t, i) => tileHTML(kindOf(t), 'rv" style="animation-delay:' + (i * 40) + 'ms')).join('')}${tileHTML(kindOf(wt), 'rv win" style="animation-delay:' + (hk.length * 40 + 120) + 'ms')}</div>${S.melds[w].length ? `<div class="rh-melds">${S.melds[w].map(m => meldHTML(m, 0)).join('')}</div>` : ''}${S.flowers[w].length ? `<div class="rh-fl">${S.flowers[w].map(t => tileHTML(kindOf(t))).join('')}</div>` : ''}`;
          payHTML = res.pays.map(p => `<li class="${p.from === 0 || p.to === 0 ? 'me' : ''}"><span>${nameOf(p.from)}</span><i>→</i><span>${nameOf(p.to)}</span><em class="num">${p.tai} 台</em><b class="num">${api.fmt(p.amount)}</b></li>`).join('');
          formula = `底 ${api.fmt(sess.di)} ＋ 台數 × ${api.fmt(sess.unit)}`;
        } else {
          tone = 'draw'; eyebrow = 'Exhaustive Draw'; title = '流局';
          sub = `${nameOf(S.dealer)} 連莊`;
          face = seatCast(S.dealer).face('neutral');
          line = S.dealer === 0 ? '流局了，大小姐繼續坐莊。' : lineOf(S.dealer, 'draw');
          const waitsMe = Core.waits(Core.countsOf(S.hands[0]));
          handHTML = `<p class="rh-note">${waitsMe.length ? `妳已經聽 ${waitsMe.map(Core.tileName).join('、')}，可惜沒摸到！` : '這局大家都沒胡，下一局再加油！'}</p>`;
        }
        const nextInfo = !sess.done ? `下一局　${WIND[sess.round]}風圈・${nameOf(sess.dealer)}坐莊${sess.streak ? `・連莊 ${sess.streak}` : ''}` : '';
        const standings = sess.mode !== 'single' ? `<div class="rst">${[0, 1, 2, 3].map(p => `<span class="${p === 0 ? 'me' : ''}"><img src="${seatCast(p).face('neutral')}" alt=""><b>${nameOf(p)}</b><em class="num ${sess.scores[p] > 0 ? 'up' : sess.scores[p] < 0 ? 'dn' : ''}">${fmtS(sess.scores[p])}</em></span>`).join('')}</div>` : '';
        const btns = sess.done
          ? (sess.mode === 'single' ? '<button class="btn ghost" data-r="quit">返回大廳</button><button class="btn goldb" data-r="again">再來一局</button>' : '<button class="btn goldb" data-r="quit">看總成績</button>')
          : '<button class="btn ghost" data-r="quit">離開牌桌</button><button class="btn goldb" data-r="next">下一局</button>';
        el.innerHTML = `<div class="mj-rp ${tone}">
          <div class="rhd"><em>${eyebrow}</em><h2>${title}</h2><p>${sub}</p></div>
          <div class="rwho"><img src="${face}" alt=""><p>${api.esc(line || '')}</p></div>
          <div class="rhand">${handHTML}</div>
          ${rows.length ? `<ul class="rtai">${rows.map(r => `<li${r.d ? ' class="d"' : ''}><span>${r.n}${r.d ? '<small>莊家付</small>' : ''}</span><i></i><b class="num">${r.t}</b><em>台</em></li>`).join('')}</ul>
          <div class="rtotal"><span>合計</span><b class="num" data-n="${totalTai}">0</b><span>台</span></div>
          <p class="rform">${formula}</p><ul class="rpay">${payHTML}</ul>` : ''}
          <div class="rme ${delta > 0 ? 'up' : delta < 0 ? 'dn' : ''}"><span>妳的輸贏</span><b class="num">${delta ? '0' : '±0'}</b>${api.icons.coin()}</div>
          ${res.type === 'win' && res.winner === 0 && U.bonus ? `<div class="rbonus"><span class="rb-res"><i class="spice"></i>${resName('spice')} <b class="num">+${api.fmt(U.bonus.spice)}</b></span>${U.bonus.shard ? `<span class="rb-shard"><img src="${U.bonus.shard.face('sad')}" alt="">${api.esc(U.bonus.shard.name)}碎片 <b class="num">×1</b></span>` : ''}</div>` : ''}
          ${standings}
          ${nextInfo ? `<p class="rnext">${nextInfo}</p>` : ''}
          <div class="ract">${btns}</div>
        </div>`;
        R.table.appendChild(el);
        const lis = [...el.querySelectorAll('.rtai li')];
        let i = 0, skip = false;
        const step = () => {
          if (skip || i >= lis.length) { lis.forEach(li => li.classList.add('in')); countUp(); return; }
          lis[i].classList.add('in'); snd.beep(880 + i * 60, .07, 'triangle', .06); i++;
          later(step, T(260));
        };
        let counted = false;
        const countUp = () => {
          if (counted) return;
          counted = true;
          const tb = el.querySelector('.rtotal b');
          if (tb) { tb.textContent = tb.dataset.n; tb.parentElement.classList.add('in'); }
          const mb = el.querySelector('.rme b'), rme = el.querySelector('.rme');
          rme.classList.add('in');
          const rb = el.querySelector('.rbonus');
          if (rb) later(() => { rb.classList.add('in'); snd.ding(); }, T(500));
          if (delta) {
            const t0 = performance.now(), dur = 900;
            const f = () => { if (closed) return; const k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3); mb.textContent = fmtS(Math.round(delta * e)); if (k < 1) requestAnimationFrame(f); };
            requestAnimationFrame(f);
            const rr = rme.getBoundingClientRect();
            if (delta > 0) { snd.cash(); api.fx.burst(rr.left + rr.width / 2, rr.top + rr.height / 2, 22, ['coin', 'spark']); }
          }
        };
        later(step, T(lis.length ? 650 : 300));
        el.addEventListener('click', e => {
          const b = e.target.closest('[data-r]');
          if (!b) { skip = true; return; }
          snd.click();
          el.classList.add('out');
          later(() => { el.remove(); resolve(b.dataset.r); }, 260);
        });
      });
    }
    function showFinal() {
      return new Promise(resolve => {
        const sess = U.sess;
        const order = [0, 1, 2, 3].sort((a, b) => sess.scores[b] - sess.scores[a]);
        const rank = order.indexOf(0) + 1;
        const el = document.createElement('div');
        el.className = 'mj-result final';
        el.innerHTML = `<div class="mj-rp ${rank === 1 ? 'win' : 'other'}"><div class="rhd"><em>Final Standings</em><h2>${rank === 1 ? '牌桌女王！' : `第 ${Core.cnNum(rank)} 名`}</h2><p>${sess.mode === 'full' ? '一將' : '一圈'}結束・共 ${sess.hands} 局</p></div>
          <ol class="rrank">${order.map((p, i) => `<li class="${p === 0 ? 'me' : ''}"><i class="num">${i + 1}</i><img src="${seatCast(p).face(i === 0 ? 'joy' : i === 3 ? 'sad' : 'neutral')}" alt=""><b>${nameOf(p)}</b><span class="num ${sess.scores[p] > 0 ? 'up' : sess.scores[p] < 0 ? 'dn' : ''}">${fmtS(sess.scores[p])}</span></li>`).join('')}</ol>
          <div class="rme ${sess.real > 0 ? 'up' : sess.real < 0 ? 'dn' : ''} in"><span>本場金幣</span><b class="num">${fmtS(sess.real)}</b>${api.icons.coin()}</div>
          <div class="ract"><button class="btn ghost" data-r="quit">返回大廳</button><button class="btn goldb" data-r="again">再來一${sess.mode === 'full' ? '將' : '圈'}</button></div></div>`;
        R.table.appendChild(el);
        if (rank === 1) { sfx.win(); api.fx.rain('confetti', 60, el.getBoundingClientRect()); }
        else snd.ding();
        el.addEventListener('click', e => {
          const b = e.target.closest('[data-r]');
          if (!b) return;
          snd.click();
          el.classList.add('out');
          later(() => { el.remove(); resolve(b.dataset.r); }, 260);
        });
      });
    }

    // ---------- 第一次玩的教學 ----------
    function guide(target, html) {
      return new Promise((resolve, reject) => {
        rejects.add(reject);
        const base = tableRect(), r = target.getBoundingClientRect();
        const el = document.createElement('div');
        el.className = 'mj-guide';
        el.innerHTML = `<i class="hole" style="left:${r.left - base.left - 5}px;top:${r.top - base.top - 5}px;width:${r.width + 10}px;height:${r.height + 10}px"></i><div class="gb"><img src="${castAll[5].face('joy')}" alt=""><p>${html}</p><button class="btn goldb" type="button">知道了</button></div>`;
        const gb = el.querySelector('.gb');
        if (r.top - base.top > 200) gb.style.bottom = base.bottom - r.top + 16 + 'px';
        else gb.style.top = r.bottom - base.top + 16 + 'px';
        R.table.appendChild(el);
        el.querySelector('button').addEventListener('click', () => { snd.click(); rejects.delete(reject); el.classList.add('out'); later(() => { el.remove(); resolve(); }, 240); });
      });
    }
    async function startTips() {
      if (store().tut) return;
      await guide(R.hand, '這是妳的手牌。<b>點一下</b>牌會抬起來，<b>再點一下</b>就打出去；也可以把牌<b>往上滑</b>打出。');
      await guide(R.cn.br, '這裡是<b>免費的聽牌提示</b>：會告訴妳聽哪幾張、還剩幾張。手牌上標「聽」的牌，打掉就能聽牌！');
      await guide(R.tools, '別家打出妳要的牌，會跳出<b>吃・碰・槓・胡</b>按鈕。想省腦力，也可以花粉鑽請我<b>建議出牌</b>或<b>託管代打</b>。');
      const s = store(); s.tut = true; api.save();
    }

    // ---------- 開發測試用（只有沙盒模式） ----------
    if (api.sandbox) {
      const swapIn = (arr, i, k, S, avoid) => {
        for (const src of [S.wall, ...S.hands]) {
          for (let j = 0; j < src.length; j++) {
            if (src === arr && (j === i || (avoid && avoid(j)))) continue;
            if (kindOf(src[j]) === k) { const t = src[j]; src[j] = arr[i]; arr[i] = t; return true; }
          }
        }
        return false;
      };
      window.__mj = {
        root, U, Core,
        rig(fn) { U.rig = fn; },
        rigHand(S, p, kinds) { kinds.forEach((k, i) => { if (kindOf(S.hands[p][i]) !== k) swapIn(S.hands[p], i, k, S, j => j < i); }); },
        rigWall(S, idx, k, protect = [0]) {
          if (kindOf(S.wall[idx]) === k) return;
          for (let j = idx + 1; j < S.wall.length; j++) if (kindOf(S.wall[j]) === k) { const t = S.wall[j]; S.wall[j] = S.wall[idx]; S.wall[idx] = t; return; }
          for (let q = 0; q < 4; q++) { if (protect.includes(q)) continue; const h = S.hands[q], j = h.findIndex(t => kindOf(t) === k); if (j >= 0) { const t = h[j]; h[j] = S.wall[idx]; S.wall[idx] = t; return; } }
        },
        speed(v) { U.speed = v; },
      };
    }

    return {
      destroy() {
        closed = true;
        for (const t of timers) clearTimeout(t);
        timers.clear();
        for (const r of rejects) { try { r(Core.ABORT); } catch (e) { /* 略 */ } }
        rejects.clear();
        removeEventListener('resize', onResize);
        if (window.__mj && window.__mj.root === root) delete window.__mj;
      },
      beforeClose() {
        if (U.phase === 'table' && U.inHand && !U.leaving) {
          api.modal({
            title: '要離開牌桌嗎？',
            body: '<p class="mb">這一局還沒打完，現在離開的話<b>本局不結算</b>。</p>',
            actions: [{ label: '繼續打牌', cls: 'ghost' }, { label: '離開', fn: c => { c(); U.leaving = true; ov.close(); } }],
          });
          return false;
        }
        return true;
      },
    };
  }

  // 大廳卡片上的小麻將牌（純 SVG）
  const lobbyTile = (ch, col, css) => `<svg viewBox="0 0 30 40" style="position:absolute;${css};filter:drop-shadow(0 3px 3px rgba(0,0,0,.35))"><rect x="1" y="4" width="28" height="35" rx="4" fill="#0f7a52"/><rect x="1" y="1" width="28" height="35" rx="4" fill="#fbf4e2"/><rect x="2" y="2" width="26" height="33" rx="3.4" fill="none" stroke="#fff" stroke-opacity=".8"/><text x="15" y="25" text-anchor="middle" font-size="19" font-weight="700" font-family='"Noto Serif TC",serif' fill="${col}">${ch}</text></svg>`;
  const GAME = {
    id: 'mahjong', order: 6, name: '貴婦麻將館', tagline: '台灣十六張・就等妳湊一桌', color: '#1f9e6e', color2: '#0e4a3a',
    core: Core,
    art: api => {
      const c = api.cast();
      return `<img src="${c[3].full}" alt="" style="height:88%;left:-14%;bottom:-4%;opacity:.92"><img src="${c[2].full}" alt="" style="height:92%;right:-16%;bottom:-6%;opacity:.95"><img src="${c[1].full}" alt="" style="height:100%;left:50%;bottom:-10%;transform:translateX(-50%)">`
        + lobbyTile('中', '#d0303a', 'left:8%;top:9%;width:24%;transform:rotate(-12deg)') + lobbyTile('發', '#178a50', 'right:9%;top:16%;width:21%;transform:rotate(10deg)');
    },
    open(api) {
      let g = null;
      const ov = api.overlay({ id: 'mahjong', title: '貴婦麻將館', onClose: () => { if (g) g.destroy(); }, beforeClose: () => (g ? g.beforeClose() : true) });
      g = createGame(api, ov);
    },
  };
  (window.ErikaGames = window.ErikaGames || []).push(GAME);
})();
