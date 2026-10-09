// 時尚消消樂 — ERIKA百貨貴婦 三消玩法模組
// 結構：一、核心規則（純函式，node 可直接測）　二、關卡　三、美術（Canvas 畫精品）　四、畫面與流程
'use strict';
(() => {
  /* =====================================================================
   * 一、核心規則：盤面、配對、特殊元素、連鎖、重力、無解判斷、AI
   *    不碰 DOM；亂數狀態存在 s.seed，所以盤面可以複製給 AI 模擬
   * ===================================================================== */
  const Core = (() => {
    const N = 'n', H = 'h', V = 'v', W = 'w', C = 'c', B = 'b'; // 一般／橫條紋／直條紋／包裝炸彈／粉鑽／名牌包裹
    const NC = 6;

    function rand(s) {
      let t = (s.seed = (s.seed + 0x6D2B79F5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    const rint = (s, n) => Math.floor(rand(s) * n);
    const mk = (s, k, c) => ({ id: s.nid++, k, c, ice: 0, armed: 0 });
    const mcol = p => (p && p.k !== C && p.k !== B && !p.armed ? p.c : -1); // 可配對的顏色，-1 表示不能配對
    const swappable = p => !!p && !p.ice && !p.armed;
    const movable = p => !!p && !p.ice; // 冰塊鎖住的精品固定不動（其他精品會從後面穿過去）
    const isSp = p => !!p && (p.k === H || p.k === V || p.k === W || p.k === C);
    const adjacent = (s, a, b) => (Math.abs(a - b) === 1 && ((a / s.w) | 0) === ((b / s.w) | 0)) || Math.abs(a - b) === s.w;

    // ---------- 建立盤面 ----------
    // def: { w, h, pal:[顏色], mask?:[1/0], ribbon?:[層數], ice?:[層數], bags?:{n,max,init}, preset?:{格:顏色或piece} }
    function create(def, seed) {
      const w = def.w, h = def.h, n = w * h;
      const s = {
        w, h, seed: seed | 0, nid: 1,
        mask: new Uint8Array(n), ribbon: new Uint8Array(n), cells: new Array(n).fill(null),
        pal: def.pal.slice(), col: new Array(NC).fill(0), score: 0, bagsDone: 0, iceBroken: 0,
        bag: { left: 0, max: 0, on: 0 }, exits: new Array(w).fill(-1), rib0: 0, ice0: 0,
      };
      for (let i = 0; i < n; i++) {
        s.mask[i] = def.mask ? (def.mask[i] ? 1 : 0) : 1;
        if (def.ribbon && s.mask[i]) s.ribbon[i] = def.ribbon[i] | 0;
      }
      for (let c = 0; c < w; c++) for (let r = h - 1; r >= 0; r--) if (s.mask[r * w + c]) { s.exits[c] = r * w + c; break; }
      for (let i = 0; i < n; i++) {
        if (!s.mask[i]) continue;
        const pre = def.preset && def.preset[i];
        if (pre != null) { s.cells[i] = typeof pre === 'object' ? { id: s.nid++, ice: 0, armed: 0, c: -1, ...pre } : mk(s, N, pre); continue; }
        const p = mk(s, N, safeColor(s, i));
        if (def.ice && def.ice[i]) p.ice = def.ice[i];
        s.cells[i] = p;
      }
      if (def.bags) {
        s.bag.max = def.bags.max || 1; s.bag.left = def.bags.n;
        const spots = [];
        for (let r = 0; r < h && spots.length < w; r++) for (let c = 0; c < w; c++) {
          const i = r * w + c, p = s.cells[i];
          if (r < 2 && p && p.k === N && !p.ice && s.exits[c] !== i) spots.push(i);
        }
        for (let k = 0; k < (def.bags.init || 0) && spots.length && s.bag.left > 0; k++) {
          const i = spots.splice(rint(s, spots.length), 1)[0];
          s.cells[i] = mk(s, B, -1); s.bag.left--; s.bag.on++;
        }
      }
      if (findRuns(s).length || !hasMove(s)) shuffle(s);
      s.rib0 = s.ribbon.reduce((a, b) => a + b, 0);
      s.ice0 = s.cells.reduce((a, p) => a + (p ? p.ice : 0), 0);
      return s;
    }
    function safeColor(s, i) {
      const { w } = s, r = (i / w) | 0, c = i % w, bad = new Set();
      if (c >= 2) { const a = mcol(s.cells[i - 1]); if (a >= 0 && a === mcol(s.cells[i - 2])) bad.add(a); }
      if (r >= 2) { const a = mcol(s.cells[i - w]); if (a >= 0 && a === mcol(s.cells[i - 2 * w])) bad.add(a); }
      const opts = s.pal.filter(x => !bad.has(x));
      return opts.length ? opts[rint(s, opts.length)] : s.pal[rint(s, s.pal.length)];
    }
    const clone = s => ({ ...s, ribbon: s.ribbon.slice(), cells: s.cells.map(p => p && { ...p }), col: s.col.slice(), bag: { ...s.bag } });

    // ---------- 配對偵測 ----------
    function findRuns(s) {
      const { w, h, cells } = s, out = [];
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w;) {
          const col = mcol(cells[r * w + c]);
          let e = c + 1;
          if (col >= 0) while (e < w && mcol(cells[r * w + e]) === col) e++;
          if (col >= 0 && e - c >= 3) { const cs = []; for (let x = c; x < e; x++) cs.push(r * w + x); out.push({ dir: 'h', cells: cs, color: col }); }
          c = e;
        }
      }
      for (let c = 0; c < w; c++) {
        for (let r = 0; r < h;) {
          const col = mcol(cells[r * w + c]);
          let e = r + 1;
          if (col >= 0) while (e < h && mcol(cells[e * w + c]) === col) e++;
          if (col >= 0 && e - r >= 3) { const cs = []; for (let y = r; y < e; y++) cs.push(y * w + c); out.push({ dir: 'v', cells: cs, color: col }); }
          r = e;
        }
      }
      return out;
    }
    // 把相交的直線合成一組，決定要不要生成特殊元素、生成在哪一格
    function findGroups(s, swap) {
      const runs = findRuns(s);
      if (!runs.length) return [];
      const par = runs.map((_, i) => i);
      const find = x => (par[x] === x ? x : (par[x] = find(par[x])));
      const owner = new Map();
      runs.forEach((run, k) => run.cells.forEach(i => { if (owner.has(i)) par[find(k)] = find(owner.get(i)); else owner.set(i, k); }));
      const gm = new Map();
      runs.forEach((run, k) => { const g = find(k); if (!gm.has(g)) gm.set(g, []); gm.get(g).push(run); });
      const out = [];
      for (const rs of gm.values()) {
        const set = new Set();
        rs.forEach(r => r.cells.forEach(i => set.add(i)));
        const cells = [...set];
        const len = Math.max(...rs.map(r => r.cells.length));
        const hv = rs.some(r => r.dir === 'h') && rs.some(r => r.dir === 'v');
        const sw = swap && (set.has(swap.a) || set.has(swap.b)) ? swap : null;
        let kind = null;
        if (len >= 5) kind = C;
        else if (hv) kind = W;
        else if (len === 4) {
          const r4 = rs.find(r => r.cells.length === 4);
          kind = sw ? (sw.dir === 'v' ? H : V) : (r4.dir === 'h' ? H : V);
        }
        let at = -1;
        if (kind) {
          const ok = i => { const p = s.cells[i]; return !!p && p.k === N && !p.ice; };
          if (sw) for (const x of [sw.b, sw.a]) if (set.has(x) && ok(x)) { at = x; break; }
          if (at < 0 && hv) for (const i of cells) if (ok(i) && rs.filter(r => r.cells.includes(i)).length > 1) { at = i; break; }
          if (at < 0) {
            const lr = rs.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
            const mid = lr.cells[(lr.cells.length - 1) >> 1];
            at = ok(mid) ? mid : (lr.cells.find(ok) ?? cells.find(ok) ?? -1);
          }
        }
        out.push({ cells, color: rs[0].color, len, shape: hv, kind, at });
      }
      return out;
    }
    function lineAt(s, i) {
      const col = mcol(s.cells[i]);
      if (col < 0) return false;
      const { w, h, cells } = s, r = (i / w) | 0, c = i % w;
      let n = 1;
      for (let x = c - 1; x >= 0 && mcol(cells[r * w + x]) === col; x--) n++;
      for (let x = c + 1; x < w && mcol(cells[r * w + x]) === col; x++) n++;
      if (n >= 3) return true;
      n = 1;
      for (let y = r - 1; y >= 0 && mcol(cells[y * w + c]) === col; y--) n++;
      for (let y = r + 1; y < h && mcol(cells[y * w + c]) === col; y++) n++;
      return n >= 3;
    }

    // ---------- 交換 ----------
    // 特殊元素互換的組合（位置用「交換之後」的格子；at = 被拖過去的那一格）
    function comboOf(s, a, b) {
      const pa = s.cells[a], pb = s.cells[b];
      if (pa.k === C || pb.k === C) {
        if (pa.k === C && pb.k === C) return { type: 'cc', at: b, a, b };
        const bombAt = pa.k === C ? b : a, other = pa.k === C ? pb : pa, otherAt = pa.k === C ? a : b;
        if (other.k === B) return false;
        return { type: other.k === N ? 'cn' : other.k === W ? 'cw' : 'cs', at: bombAt, other: otherAt, color: other.c, a, b };
      }
      const sa = pa.k === H || pa.k === V || pa.k === W, sb = pb.k === H || pb.k === V || pb.k === W;
      if (sa && sb) { const ws = (pa.k === W) + (pb.k === W); return { type: ws === 2 ? 'ww' : ws === 1 ? 'sw' : 'ss', at: b, a, b }; }
      return null;
    }
    function checkSwap(s, a, b) {
      if (a === b || a < 0 || b < 0 || !adjacent(s, a, b)) return false;
      const pa = s.cells[a], pb = s.cells[b];
      if (!swappable(pa) || !swappable(pb)) return false;
      const cb = comboOf(s, a, b);
      if (cb === false) return false;
      if (cb) return true;
      if ((pa.k === B && b === a + s.w && pb.k !== B) || (pb.k === B && a === b + s.w && pa.k !== B)) return true; // 名牌包裹可以直接往下拖一格
      s.cells[a] = pb; s.cells[b] = pa;
      const ok = lineAt(s, a) || lineAt(s, b);
      s.cells[a] = pa; s.cells[b] = pb;
      return ok;
    }
    function applySwap(s, a, b) {
      if (!checkSwap(s, a, b)) return null;
      const combo = comboOf(s, a, b) || null;
      const pa = s.cells[a];
      s.cells[a] = s.cells[b]; s.cells[b] = pa;
      return { swap: { a, b, dir: Math.abs(a - b) === 1 ? 'h' : 'v' }, combo };
    }
    function findMoves(s, firstOnly) {
      const { w, h, cells } = s, out = [];
      for (let i = 0; i < w * h; i++) {
        if (!swappable(cells[i])) continue;
        const r = (i / w) | 0, c = i % w;
        for (const j of [c + 1 < w ? i + 1 : -1, r + 1 < h ? i + w : -1]) {
          if (j < 0 || !swappable(cells[j])) continue;
          if (checkSwap(s, i, j)) { out.push({ a: i, b: j }); if (firstOnly) return out; }
        }
      }
      return out;
    }
    const hasMove = s => findMoves(s, true).length > 0;

    // ---------- 一次消除（含特殊元素連鎖） ----------
    // ctx: { cascade, swap, combo, hammer, fire:[格] }；回傳事件給畫面播放，沒有任何變化回傳 null
    function resolve(s, ctx = {}) {
      const { w, h, cells } = s, n = w * h;
      const cas = ctx.cascade || 1, mult = Math.min(cas, 8);
      const ev = { hits: [], fx: [], made: [], ice: [], rib: [], groups: [], conv: [], score: 0, cascade: cas };
      const trig = new Set(), iceHit = new Set(), Q = [];
      const add = v => { ev.score += v * mult; };
      const rc = i => [(i / w) | 0, i % w];
      function take(i, p, cause, d, o) {
        cells[i] = null;
        ev.hits.push({ i, p, cause, d, o });
        if (p.c >= 0) s.col[p.c]++;
        if (s.ribbon[i] > 0) { s.ribbon[i]--; ev.rib.push({ i, d, o, left: s.ribbon[i] }); add(100); }
      }
      function hit(i, cause, d, o = -1) {
        if (i < 0 || i >= n || !s.mask[i]) return;
        const p = cells[i];
        if (!p || p.k === B || trig.has(p.id)) return;
        if (p.ice > 0) {
          if (iceHit.has(i)) return;
          iceHit.add(i); p.ice--; s.iceBroken++; ev.ice.push({ i, d, o, left: p.ice }); add(80);
          return;
        }
        if (cause !== 'match') add(40);
        if (p.k === N) { take(i, p, cause, d, o); return; }
        trig.add(p.id);
        if (p.k === W && !p.armed) { Q.push({ i, p, d: d + 1, first: true }); return; } // 包裝炸彈第一次爆炸後留在原地
        take(i, p, cause, d, o);
        Q.push({ i, p, d: d + 1 });
      }
      const area = (i, rad, d) => {
        const [r, c] = rc(i);
        for (let y = r - rad; y <= r + rad; y++) for (let x = c - rad; x <= c + rad; x++) if (y >= 0 && y < h && x >= 0 && x < w && y * w + x !== i) hit(y * w + x, 'blast', d, i);
      };
      const row = (r, d, o) => { if (r >= 0 && r < h) for (let x = 0; x < w; x++) hit(r * w + x, 'line', d, o); };
      const colm = (c, d, o) => { if (c >= 0 && c < w) for (let y = 0; y < h; y++) hit(y * w + c, 'line', d, o); };
      function common() {
        const cnt = new Array(NC).fill(0);
        for (const p of cells) { const k = mcol(p); if (k >= 0) cnt[k]++; }
        let best = -1, bv = 0;
        for (let k = 0; k < NC; k++) if (cnt[k] > bv || (cnt[k] === bv && bv > 0 && rand(s) < 0.5)) { bv = cnt[k]; best = k; }
        return best;
      }
      function combo(cb) {
        const at = cb.at, [r, c] = rc(at);
        const kill = i => { const p = cells[i]; if (p) { trig.add(p.id); take(i, p, 'combo', 0, at); } return p; };
        add(500);
        if (cb.type === 'cc') {
          kill(cb.a); kill(cb.b);
          ev.fx.push({ k: 'nova', i: at, c: -1, d: 0 });
          for (let i = 0; i < n; i++) { const [y, x] = rc(i); hit(i, 'nova', 1 + (Math.max(Math.abs(y - r), Math.abs(x - c)) >> 1), at); }
        } else if (cb.type === 'cn') {
          const p = kill(at);
          Q.push({ i: at, p, d: 0, color: cb.color });
        } else if (cb.type === 'cs' || cb.type === 'cw') {
          kill(at);
          const tg = [];
          for (let i = 0; i < n; i++) { const q = cells[i]; if (q && q.k === N && !q.ice && q.c === cb.color) tg.push(i); }
          for (const j of tg) { cells[j].k = cb.type === 'cs' ? (rand(s) < 0.5 ? H : V) : W; ev.conv.push({ i: j, p: cells[j] }); }
          ev.fx.push({ k: 'zap', i: at, tg: tg.concat([cb.other]), c: cb.color, d: 0 });
          hit(cb.other, 'combo', 0, at);
          for (const j of tg) hit(j, 'zap', 1, at);
        } else if (cb.type === 'ss') {
          const col = cells[cb.b].c;
          kill(cb.a); kill(cb.b);
          ev.fx.push({ k: 'line', dir: 'h', i: at, c: col, d: 0 }, { k: 'line', dir: 'v', i: at, c: col, d: 0 });
          row(r, 0, at); colm(c, 0, at);
        } else if (cb.type === 'sw') {
          const pa = cells[cb.a], pb = cells[cb.b], col = (pa.k === W ? pa : pb).c;
          kill(cb.a); kill(cb.b);
          ev.fx.push({ k: 'cross', i: at, c: col, d: 0 });
          for (let k = -1; k <= 1; k++) { row(r + k, 0, at); colm(c + k, 0, at); }
        } else if (cb.type === 'ww') {
          const keep = cells[cb.b];
          kill(cb.a); trig.add(keep.id); keep.armed = 2;
          ev.fx.push({ k: 'blast', i: at, rad: 2, c: keep.c, d: 0 });
          area(at, 2, 0);
        }
      }
      function runQ() {
        for (let guard = 0; Q.length && guard < 5000; guard++) {
          const t = Q.shift(), p = t.p, [r, c] = rc(t.i);
          if (p.k === H) { ev.fx.push({ k: 'line', dir: 'h', i: t.i, c: p.c, d: t.d }); row(r, t.d, t.i); }
          else if (p.k === V) { ev.fx.push({ k: 'line', dir: 'v', i: t.i, c: p.c, d: t.d }); colm(c, t.d, t.i); }
          else if (p.k === W) {
            const rad = t.first ? 1 : p.armed || 1;
            if (t.first) p.armed = 1;
            ev.fx.push({ k: 'blast', i: t.i, rad, c: p.c, d: t.d, second: !t.first });
            area(t.i, rad, t.d);
          } else if (p.k === C) {
            const col = t.color != null ? t.color : common(), tg = [];
            if (col >= 0) for (let i = 0; i < n; i++) { const q = cells[i]; if (q && q.c === col && q.k !== C && q.k !== B) tg.push(i); }
            ev.fx.push({ k: 'zap', i: t.i, tg, c: col, d: t.d });
            for (const j of tg) hit(j, 'zap', t.d, t.i);
          }
        }
      }

      const groups = ctx.combo ? [] : findGroups(s, ctx.swap);
      if (ctx.combo) combo(ctx.combo);
      for (let i = 0; i < n; i++) { // 上一步留下的包裝炸彈：第二次爆炸
        const p = cells[i];
        if (p && p.armed && !trig.has(p.id)) { trig.add(p.id); take(i, p, 'blast', 0, i); add(60); Q.push({ i, p, d: 0 }); }
      }
      if (ctx.hammer != null) hit(ctx.hammer, 'hammer', 0, ctx.hammer);
      if (ctx.fire) ctx.fire.forEach((i, k) => hit(i, 'fire', k, i));
      for (const g of groups) {
        ev.groups.push(g);
        add(g.kind === C ? 200 : g.shape ? 150 : g.len >= 4 ? 120 : 60);
        for (const i of g.cells) hit(i, 'match', 0, -1);
        if (g.kind) { let at = g.at; if (at < 0 || cells[at]) at = g.cells.find(i => !cells[i]) ?? -1; g.made = at; }
      }
      runQ();
      for (const g of ev.groups) {
        if (!g.kind || g.made == null || g.made < 0 || cells[g.made]) continue;
        const p = mk(s, g.kind, g.kind === C ? -1 : g.color);
        cells[g.made] = p;
        ev.made.push({ i: g.made, p, g });
        add(g.kind === C ? 300 : g.kind === W ? 200 : 120);
      }
      if (!ev.hits.length && !ev.fx.length && !ev.ice.length && !ev.made.length) return null;
      s.score += ev.score;
      return ev;
    }

    // ---------- 重力與補充 ----------
    // 冰塊鎖住的精品固定不動；其他精品（含名牌包裹）會穿過空洞與冰塊往下掉。新精品從盤面上方落下。
    function spawn(s) {
      const b = s.bag;
      if (b.left > 0 && b.on < b.max && rand(s) < (b.on ? 0.1 : 0.35)) { b.left--; b.on++; return mk(s, B, -1); }
      return mk(s, N, s.pal[rint(s, s.pal.length)]);
    }
    function gravity(s) {
      const { w, h, cells, mask } = s, moves = [];
      for (let c = 0; c < w; c++) {
        const slots = [], ps = [];
        for (let r = h - 1; r >= 0; r--) {
          const i = r * w + c;
          if (!mask[i] || (cells[i] && !movable(cells[i]))) continue;
          slots.push(i);
          if (cells[i]) ps.push([i, cells[i]]);
        }
        if (ps.length === slots.length) continue;
        for (const i of slots) cells[i] = null;
        ps.forEach(([from, p], k) => { const to = slots[k]; cells[to] = p; if (from !== to) moves.push({ p, fr: (from / w) | 0, to }); });
        let sr = -1;
        for (let k = ps.length; k < slots.length; k++) { const p = spawn(s); cells[slots[k]] = p; moves.push({ p, fr: sr--, to: slots[k], spawn: true }); }
      }
      return moves;
    }
    // 名牌包裹落到該列最底下（可移動的最低格）就算送達
    function collectBags(s) {
      const out = [], { w, h, cells, mask } = s;
      for (let c = 0; c < w; c++) {
        for (let r = h - 1; r >= 0; r--) {
          const i = r * w + c;
          if (!mask[i] || (cells[i] && !movable(cells[i]))) continue;
          const p = cells[i];
          if (p && p.k === B) { cells[i] = null; s.bag.on--; s.bagsDone++; s.score += 1000; out.push({ i, p }); }
          break;
        }
      }
      return out;
    }

    // ---------- 洗牌（盤面無解時） ----------
    function shuffle(s) {
      const slots = [], ps = [];
      s.cells.forEach((p, i) => { if (p && swappable(p) && p.k !== B) { slots.push(i); ps.push(p); } });
      const orig = new Map(slots.map((i, k) => [ps[k].id, i]));
      for (let tries = 0; tries < 400; tries++) {
        for (let k = ps.length - 1; k > 0; k--) { const j = rint(s, k + 1); [ps[k], ps[j]] = [ps[j], ps[k]]; }
        if (tries >= 30) for (const p of ps) if (p.k === N) p.c = s.pal[rint(s, s.pal.length)];
        slots.forEach((i, k) => { s.cells[i] = ps[k]; });
        if (!findRuns(s).length && hasMove(s)) break;
      }
      return slots.map(i => ({ p: s.cells[i], from: orig.get(s.cells[i].id), to: i }));
    }

    // ---------- 其他工具 ----------
    function settle(s, first = {}) { // 不播動畫，一路算到穩定（AI 與測試用）
      let ctx = { cascade: 1, swap: first.swap, combo: first.combo, hammer: first.hammer, fire: first.fire }, steps = 0;
      for (let g = 0; g < 200; g++) {
        const ev = resolve(s, ctx);
        if (ev) steps++;
        gravity(s);
        const bags = collectBags(s);
        if (bags.length) gravity(s);
        if (!ev && !bags.length) break;
        ctx = { cascade: ctx.cascade + (ev ? 1 : 0) };
      }
      return steps;
    }
    function placeSpecial(s, k) { // 開局道具：把一個一般精品換成特殊元素
      const { w, h } = s, pool = [];
      s.cells.forEach((p, i) => { const r = (i / w) | 0; if (p && p.k === N && !p.ice && r >= 2 && r < h - 1) pool.push(i); });
      if (!pool.length) return -1;
      const i = pool[rint(s, pool.length)];
      s.cells[i] = mk(s, k, k === C ? -1 : s.cells[i].c);
      return i;
    }
    function bonusConvert(s, n) { // 瘋狂購物時間：剩餘步數變成條紋精品
      const pool = [], out = [];
      s.cells.forEach((p, i) => { if (p && p.k === N && !p.ice) pool.push(i); });
      for (let k = 0; k < n && pool.length; k++) {
        const j = pool.splice(rint(s, pool.length), 1)[0];
        s.cells[j].k = rand(s) < 0.5 ? H : V; s.score += 500; out.push(j);
      }
      return out;
    }
    const specials = s => { const out = []; s.cells.forEach((p, i) => { if (isSp(p) && !p.armed) out.push(i); }); return out; };

    // ---------- 目標 ----------
    function progress(s, g) {
      if (g.t === 'score') return { have: s.score, need: g.n };
      if (g.t === 'col') return { have: Math.min(s.col[g.c], g.n), need: g.n };
      if (g.t === 'ribbon') { let left = 0; for (const v of s.ribbon) left += v; return { have: s.rib0 - left, need: s.rib0 }; }
      if (g.t === 'ice') { let left = 0; for (const p of s.cells) if (p) left += p.ice; return { have: s.ice0 - left, need: s.ice0 }; }
      if (g.t === 'bag') return { have: Math.min(s.bagsDone, g.n), need: g.n };
      return { have: 0, need: 0 };
    }
    const goalsDone = (s, goals) => goals.every(g => { const q = progress(s, g); return q.have >= q.need; });

    // ---------- AI：模擬每一步，挑對目標最有幫助的 ----------
    function metrics(s) {
      let rib = 0, ice = 0, depth = 0, sp = 0;
      for (let i = 0; i < s.cells.length; i++) {
        rib += s.ribbon[i];
        const p = s.cells[i];
        if (!p) continue;
        ice += p.ice;
        if (p.k === B) depth += (i / s.w) | 0;
        else if (p.k === H || p.k === V) sp += 3;
        else if (p.k === W) sp += 4;
        else if (p.k === C) sp += 7;
      }
      return { score: s.score, col: s.col.slice(), rib, ice, bags: s.bagsDone, depth, sp };
    }
    function evalMove(s, m, goals, salt = 0) {
      const t = clone(s);
      t.seed = (Math.imul(s.seed, 31) + 0x2545F491 + salt) | 0;
      const a = metrics(t), sw = applySwap(t, m.a, m.b);
      if (!sw) return -1e9;
      settle(t, sw);
      const b = metrics(t);
      let v = (b.score - a.score) / 300 + (b.sp - a.sp) * 1.5;
      for (const g of goals) {
        if (g.t === 'col') v += Math.min(Math.max(0, g.n - a.col[g.c]), b.col[g.c] - a.col[g.c]) * 6;
        else if (g.t === 'ribbon') v += (a.rib - b.rib) * 9;
        else if (g.t === 'ice') v += (a.ice - b.ice) * 9;
        else if (g.t === 'bag') v += (b.bags - a.bags) * 80 + (b.depth - a.depth) * 14;
        else if (g.t === 'score') v += (b.score - a.score) / 100;
      }
      return v + ((m.a * 7919 + m.b * 104729) % 97) / 9700;
    }
    function bestMove(s, goals) {
      let best = null, bv = -Infinity;
      findMoves(s).forEach((m, k) => { const v = evalMove(s, m, goals, k); if (v > bv) { bv = v; best = m; } });
      return best;
    }

    return {
      N, H, V, W, C, B, NC, rand, create, clone, findRuns, findGroups, lineAt, checkSwap, applySwap, comboOf, findMoves, hasMove,
      resolve, gravity, collectBags, shuffle, settle, placeSpecial, bonusConvert, specials, progress, goalsDone, evalMove, bestMove, adjacent, swappable, isSp,
    };
  })();

  /* =====================================================================
   * 二、關卡：60 關（6 層樓 × 10 關），形狀、緞帶格、冰塊、包裹由程式依參數生成
   * ===================================================================== */
  const Levels = (() => {
    const MASK = {
      full: { w: 8, h: 8 }, tall: { w: 8, h: 9 }, tower: { w: 7, h: 9 },
      corners: ['#......#', '........', '........', '........', '........', '........', '........', '#......#'],
      heart: ['#..##..#', '........', '........', '........', '........', '#......#', '##....##', '###..###'],
      diamond: ['##....##', '#......#', '........', '........', '........', '........', '#......#', '##....##'],
      window: ['........', '........', '........', '...##...', '...##...', '........', '........', '........'],
      pillars: ['........', '........', '.#....#.', '.#....#.', '........', '........', '.#....#.', '.#....#.', '........'],
      hourglass: ['........', '#......#', '##....##', '##....##', '##....##', '##....##', '#......#', '........', '........'],
      crown: ['#.#..#.#', '........', '........', '........', '........', '........', '........', '#......#'],
      cross: ['##....##', '##....##', '........', '........', '........', '........', '##....##', '##....##'],
    };
    // 圖樣：r,c 是格子座標，w,h 是盤面大小
    const PAT = {
      all: () => true,
      center: (r, c, w, h) => Math.abs(r - (h - 1) / 2) < 2 && Math.abs(c - (w - 1) / 2) < 2,
      core: (r, c, w, h) => Math.abs(r - (h - 1) / 2) < 1 && Math.abs(c - (w - 1) / 2) < 2,
      ring: (r, c, w, h) => r === 0 || c === 0 || r === h - 1 || c === w - 1,
      bottom: (r, c, w, h) => r >= h - 3,
      top: (r) => r < 3,
      x: (r, c, w, h) => { const k = r * (w - 1) / (h - 1); return Math.abs(c - k) < 0.75 || Math.abs(c - (w - 1 - k)) < 0.75; },
      checker: (r, c) => (r + c) % 2 === 0,
      cols: (r, c, w) => c < 2 || c >= w - 2,
      band: (r, c, w, h) => (r === (h >> 1) - 1 || r === h >> 1) && c > 0 && c < w - 1,
      corners: (r, c, w, h) => (r < 3 || r >= h - 3) && (c < 2 || c >= w - 2),
      lower: (r, c, w, h) => r >= (h >> 1) - 1,
    };
    // 目標：['s', 分數] ['c', 顏色, 數量] ['r'] 緞帶格 ['i'] 冰塊 ['b', 數量] 名牌包裹
    // 顏色：0 口紅 1 香水瓶 2 名牌包 3 高跟鞋 4 鑽戒 5 珍珠蝴蝶結
    const D = [
      // 1F 美妝沙龍
      { m: 'full', mv: 18, g: [['s', 10000]] },
      { m: 'full', mv: 18, g: [['c', 0, 35]] },
      { m: 'corners', mv: 20, g: [['s', 13000]] },
      { m: 'full', mv: 14, g: [['r']], rib: [['center', 1]] },
      { m: 'heart', mv: 18, g: [['c', 1, 25], ['c', 5, 25]] },
      { m: 'full', mv: 25, g: [['b', 1]], bag: [1, 1, 1] },
      { m: 'full', mv: 33, g: [['r']], rib: [['checker', 1]] },
      { m: 'full', mv: 16, g: [['i']], ice: [['core', 1]] },
      { m: 'heart', mv: 32, g: [['r']], rib: [['lower', 1]] },
      { m: 'diamond', mv: 21, g: [['c', 0, 35], ['c', 2, 35], ['c', 4, 35]] },
      // 2F 香氛藝廊
      { m: 'diamond', mv: 20, g: [['s', 10000]] },
      { m: 'tall', mv: 26, nc: 6, g: [['c', 1, 25]] },
      { m: 'window', mv: 38, g: [['r']], rib: [['ring', 1]] },
      { m: 'corners', mv: 33, g: [['b', 3]], bag: [3, 2, 2] },
      { m: 'full', mv: 31, g: [['i']], ice: [['x', 1]] },
      { m: 'full', mv: 16, g: [['r']], rib: [['center', 2]] },
      { m: 'hourglass', mv: 27, g: [['c', 0, 30], ['c', 4, 30]] },
      { m: 'full', mv: 39, nc: 6, g: [['i']], ice: [['band', 1]] },
      { m: 'tall', mv: 45, g: [['b', 2], ['c', 5, 15]], bag: [2, 2, 2] },
      { m: 'diamond', mv: 32, g: [['r']], rib: [['all', 1], ['center', 2]] },
      // 3F 精品皮件
      { m: 'tower', mv: 22, g: [['s', 13000]] },
      { m: 'full', mv: 24, nc: 6, g: [['c', 2, 20]] },
      { m: 'tall', mv: 31, g: [['r']], rib: [['x', 1]] },
      { m: 'corners', mv: 37, g: [['i']], ice: [['corners', 1]] },
      { m: 'full', mv: 38, g: [['b', 3]], bag: [3, 2, 2] },
      { m: 'window', mv: 43, g: [['r']], rib: [['checker', 1], ['center', 2]] },
      { m: 'full', mv: 28, nc: 6, g: [['c', 1, 20], ['c', 3, 20], ['c', 5, 20]] },
      { m: 'full', mv: 34, g: [['i'], ['c', 4, 20]], ice: [['core', 2]] },
      { m: 'tall', mv: 39, g: [['r'], ['b', 2]], rib: [['cols', 1]], bag: [2, 2, 2] },
      { m: 'hourglass', mv: 44, g: [['i'], ['r']], rib: [['center', 1]], ice: [['x', 1]] },
      // 4F 名鞋大道
      { m: 'heart', mv: 24, g: [['s', 10500]] },
      { m: 'tall', mv: 29, nc: 6, g: [['c', 3, 25]] },
      { m: 'pillars', mv: 45, g: [['r']], rib: [['lower', 1]] },
      { m: 'full', mv: 45, g: [['b', 3]], bag: [3, 2, 2] },
      { m: 'full', mv: 37, g: [['i']], ice: [['band', 1], ['core', 2]] },
      { m: 'diamond', mv: 30, nc: 6, g: [['c', 3, 25], ['c', 5, 25]] },
      { m: 'full', mv: 45, g: [['r']], rib: [['ring', 1], ['center', 2]] },
      { m: 'tall', mv: 45, g: [['i'], ['b', 2]], ice: [['core', 1]], bag: [2, 2, 2] },
      { m: 'cross', mv: 30, g: [['r']], rib: [['top', 1]] },
      { m: 'heart', mv: 41, g: [['r']], rib: [['all', 1], ['center', 2]] },
      // 5F 珠寶沙龍
      { m: 'window', mv: 25, g: [['s', 10500]] },
      { m: 'full', mv: 37, nc: 6, g: [['c', 4, 30]] },
      { m: 'full', mv: 42, g: [['i']], ice: [['ring', 1]] },
      { m: 'tall', mv: 45, g: [['b', 3]], bag: [3, 2, 2] },
      { m: 'diamond', mv: 41, g: [['r']], rib: [['x', 2]] },
      { m: 'tall', mv: 32, nc: 6, g: [['c', 0, 25], ['c', 2, 25], ['c', 4, 25]] },
      { m: 'full', mv: 35, g: [['i'], ['r']], rib: [['ring', 1]], ice: [['core', 1]] },
      { m: 'tall', mv: 45, g: [['b', 2], ['r']], rib: [['bottom', 1]], bag: [2, 2, 2] },
      { m: 'pillars', mv: 45, g: [['r']], rib: [['lower', 1]] },
      { m: 'tall', mv: 45, g: [['i'], ['r'], ['b', 2]], rib: [['center', 2]], ice: [['corners', 1]], bag: [2, 2, 2] },
      // 6F 頂樓 VIP 貴賓室
      { m: 'tower', mv: 25, g: [['s', 20500]] },
      { m: 'full', mv: 38, nc: 6, g: [['c', 0, 30], ['c', 1, 30]] },
      { m: 'crown', mv: 43, g: [['r']], rib: [['lower', 1], ['bottom', 2]] },
      { m: 'tall', mv: 45, g: [['i']], ice: [['x', 1], ['core', 2]] },
      { m: 'diamond', mv: 31, g: [['b', 3], ['c', 3, 25]], bag: [3, 2, 2] },
      { m: 'full', mv: 42, g: [['r'], ['i']], rib: [['checker', 2]], ice: [['core', 1]] },
      { m: 'tall', mv: 24, nc: 6, g: [['c', 0, 20], ['c', 1, 20], ['c', 2, 20], ['c', 3, 20]] },
      { m: 'tall', mv: 45, g: [['b', 2], ['i']], ice: [['band', 1]], bag: [2, 2, 2] },
      { m: 'heart', mv: 45, g: [['r'], ['i']], rib: [['all', 1], ['center', 2]], ice: [['corners', 1]] },
      { m: 'tall', mv: 42, g: [['r'], ['b', 2]], rib: [['lower', 1], ['center', 2]], bag: [2, 2, 2] },
    ];
    // 星等門檻 [1★, 2★, 3★]：用 AI 模擬校準過（tools 不進專案，數字直接寫在這裡）
    const STARS = [ // 單位：百分
      [100, 205, 300], [0, 200, 270], [130, 235, 330], [0, 196, 286], [0, 144, 230], [0, 244, 345], [0, 393, 497], [0, 190, 269], [0, 264, 317], [0, 203, 253],
      [100, 190, 315], [0, 177, 238], [0, 248, 363], [0, 296, 375], [0, 264, 398], [0, 240, 322], [0, 184, 251], [0, 220, 278], [0, 424, 675], [0, 373, 494],
      [130, 310, 385], [0, 128, 175], [0, 396, 510], [0, 344, 481], [0, 415, 508], [0, 378, 454], [0, 145, 201], [0, 310, 439], [0, 456, 660], [0, 320, 475],
      [105, 155, 255], [0, 180, 238], [0, 422, 528], [0, 346, 474], [0, 317, 380], [0, 135, 189], [0, 489, 676], [0, 473, 623], [0, 251, 302], [0, 377, 478],
      [105, 225, 330], [0, 188, 236], [0, 413, 513], [0, 439, 680], [0, 389, 481], [0, 194, 266], [0, 413, 524], [0, 475, 625], [0, 410, 492], [0, 554, 783],
      [205, 355, 515], [0, 194, 278], [0, 441, 549], [0, 440, 608], [0, 238, 297], [0, 528, 754], [0, 132, 209], [0, 441, 570], [0, 417, 543], [0, 615, 785],
    ].map(a => a.map(v => v * 100));
    const COUNT = D.length;

    function layer(spec, w, h, mask, minRow = 0) {
      const out = new Array(w * h).fill(0);
      if (!spec) return out;
      for (const [name, lv] of spec) {
        const f = PAT[name];
        for (let r = minRow; r < h; r++) for (let c = 0; c < w; c++) { const i = r * w + c; if (mask[i] && f(r, c, w, h)) out[i] = Math.max(out[i], lv); }
      }
      return out;
    }
    function shape(name) {
      const m = MASK[name] || MASK.full;
      if (!Array.isArray(m)) return { w: m.w, h: m.h, mask: new Array(m.w * m.h).fill(1) };
      return { w: m[0].length, h: m.length, mask: m.join('').split('').map(ch => (ch === '#' ? 0 : 1)) };
    }
    // n：0 起算的關卡序號。回傳 Core.create 用的 def ＋ 關卡資訊
    function build(n, src = D[n]) {
      const L = src, { w, h, mask } = shape(L.m);
      const goals = L.g.map(g => (g[0] === 's' ? { t: 'score', n: g[1] } : g[0] === 'c' ? { t: 'col', c: g[1], n: g[2] } : g[0] === 'r' ? { t: 'ribbon' } : g[0] === 'i' ? { t: 'ice' } : { t: 'bag', n: g[1] }));
      const need = new Set(goals.filter(g => g.t === 'col').map(g => g.c));
      let pal = [0, 1, 2, 3, 4, 5];
      if ((L.nc || 5) < 6) { const cand = pal.filter(c => !need.has(c)); pal = pal.filter(c => c !== cand[(n * 7 + 3) % cand.length]); }
      const bag = L.bag ? { n: L.bag[0], max: L.bag[1], init: L.bag[2] } : null;
      const moves = L.mv;
      const score = goals.find(g => g.t === 'score');
      const st = STARS && STARS[n] ? STARS[n].slice() : score ? [score.n, Math.round(score.n * 1.5), Math.round(score.n * 2.1)] : [500, moves * 650, moves * 1100];
      if (score) st[0] = score.n;
      return {
        n, floor: Math.min(5, Math.floor(n / 10)), boss: n % 10 === 9, moves, goals, stars: st,
        def: { w, h, mask, pal, ribbon: layer(L.rib, w, h, mask), ice: layer(L.ice, w, h, mask, 2), bags: bag },
      };
    }
    return { build, COUNT, D, MASK, PAT };
  })();

  /* =====================================================================
   * 三、美術：六種精品＋特殊元素＋冰塊／緞帶格，全部用 Canvas 畫（預先畫成小圖快取）
   * ===================================================================== */
  const ITEMS = [
    { name: '口紅', hue: '#ef2d56', light: '#ffb3c3', dark: '#99102f', edge: '#5e0a1f', glow: '#ff5c7f' },
    { name: '香水瓶', hue: '#9b5cf6', light: '#e6d6ff', dark: '#5b25b8', edge: '#36127a', glow: '#b98bff' },
    { name: '名牌包', hue: '#ff8a1f', light: '#ffd7a8', dark: '#b8560a', edge: '#6e3000', glow: '#ffaa55' },
    { name: '高跟鞋', hue: '#17c27b', light: '#b4f5d6', dark: '#0a7d4c', edge: '#044a2b', glow: '#4be3a0' },
    { name: '鑽戒', hue: '#38b6ff', light: '#e0f5ff', dark: '#0d6fb8', edge: '#083f73', glow: '#7fd2ff' },
    { name: '珍珠蝴蝶結', hue: '#ff6fbd', light: '#ffd9ef', dark: '#c42f84', edge: '#7e1552', glow: '#ff9fd6' },
  ];
  const Art3 = (() => {
    const mkc = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    const lin = (g, x0, y0, x1, y1, st) => { const q = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of st) q.addColorStop(o, c); return q; };
    const rad = (g, x0, y0, r0, x1, y1, r1, st) => { const q = g.createRadialGradient(x0, y0, r0, x1, y1, r1); for (const [o, c] of st) q.addColorStop(o, c); return q; };
    const GOLD = [[0, '#7a4a12'], [0.22, '#e3b95c'], [0.42, '#fff4c8'], [0.62, '#d4a043'], [1, '#6e420e']];
    function star4(g, x, y, r, k = 0.22) {
      g.beginPath(); g.moveTo(x, y - r);
      g.quadraticCurveTo(x + r * k, y - r * k, x + r, y); g.quadraticCurveTo(x + r * k, y + r * k, x, y + r);
      g.quadraticCurveTo(x - r * k, y + r * k, x - r, y); g.quadraticCurveTo(x - r * k, y - r * k, x, y - r); g.fill();
    }
    const tri = (g, pts, col) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) g.lineTo(pts[k], pts[k + 1]); g.closePath(); g.fillStyle = col; g.fill(); };
    function pearl(g, x, y, r) {
      g.beginPath(); g.arc(x, y, r, 0, 7);
      g.fillStyle = rad(g, x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r, [[0, '#ffffff'], [0.4, '#fff6fa'], [0.8, '#efd0e0'], [1, '#c79bb3']]); g.fill();
      g.lineWidth = Math.max(1, r * 0.14); g.strokeStyle = 'rgba(130,70,100,.7)'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.38, r * 0.3, r * 0.2, -0.6, 0, 7); g.fill();
    }

    // ---- 六種精品（100×100 座標） ----
    function lipstick(g, it) {
      g.save(); g.translate(50, 52); g.rotate(-0.3); g.translate(-50, -52);
      g.fillStyle = lin(g, 30, 0, 70, 0, GOLD); rr(g, 30, 55, 40, 38, 7); g.fill();
      g.lineWidth = 2.8; g.strokeStyle = '#5a3608'; g.stroke();
      g.fillStyle = 'rgba(255,248,220,.6)'; g.fillRect(31.5, 60.5, 37, 2.4);
      g.fillStyle = 'rgba(90,54,10,.45)'; g.fillRect(31.5, 86, 37, 2.4);
      g.fillStyle = lin(g, 34, 0, 66, 0, [[0, '#8a5a18'], [0.35, '#f6dc94'], [0.5, '#fffbe6'], [1, '#8a5a18']]); rr(g, 34.5, 43, 31, 14, 3); g.fill(); g.lineWidth = 2.2; g.stroke();
      g.beginPath(); g.moveTo(37.5, 45); g.lineTo(37.5, 25); g.quadraticCurveTo(37.5, 17, 44, 13.5); g.lineTo(57, 6.5); g.quadraticCurveTo(62.5, 4, 62.5, 10.5); g.lineTo(62.5, 45); g.closePath();
      g.fillStyle = lin(g, 37, 0, 63, 0, [[0, it.dark], [0.28, it.hue], [0.5, it.light], [0.7, it.hue], [1, it.dark]]); g.fill();
      g.lineWidth = 2.6; g.strokeStyle = it.edge; g.stroke();
      g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(44, 28, 2.6, 15, 0, 0, 7); g.fill(); g.restore();
      g.restore();
    }
    function perfume(g, it) {
      const body = () => { g.beginPath(); g.moveTo(28, 40); g.lineTo(72, 40); g.lineTo(85, 52); g.lineTo(85, 81); g.lineTo(73, 93); g.lineTo(27, 93); g.lineTo(15, 81); g.lineTo(15, 52); g.closePath(); };
      body(); g.fillStyle = lin(g, 15, 40, 85, 93, [[0, it.light], [0.45, it.hue], [1, it.dark]]); g.fill();
      g.save(); body(); g.clip();
      g.fillStyle = 'rgba(60,15,130,.32)'; g.fillRect(10, 63, 80, 40);
      g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(10, 62, 80, 2);
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(20, 53); g.lineTo(29, 45); g.lineTo(34, 45); g.lineTo(25, 87); g.lineTo(20, 81); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(66, 47, 8, 40);
      g.restore();
      body(); g.lineWidth = 2.8; g.strokeStyle = it.edge; g.stroke();
      g.fillStyle = lin(g, 38, 0, 62, 0, GOLD); rr(g, 38, 67, 24, 13, 3); g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#6e420e'; g.stroke();
      g.fillStyle = lin(g, 41, 0, 59, 0, GOLD); rr(g, 41, 29, 18, 12, 2.5); g.fill(); g.lineWidth = 2.2; g.strokeStyle = '#5a3608'; g.stroke();
      g.beginPath(); g.arc(50, 18, 13.5, 0, 7);
      g.fillStyle = rad(g, 45, 13, 2, 50, 18, 14, [[0, '#ffffff'], [0.45, it.light], [1, it.hue]]); g.fill();
      g.lineWidth = 2.6; g.strokeStyle = it.edge; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(45, 13, 4.2, 2.6, -0.6, 0, 7); g.fill();
    }
    function handbag(g, it) {
      g.lineCap = 'round';
      g.lineWidth = 9; g.strokeStyle = it.edge; g.beginPath(); g.moveTo(31, 44); g.bezierCurveTo(30, 7, 70, 7, 69, 44); g.stroke();
      g.lineWidth = 5.2; g.strokeStyle = it.dark; g.stroke();
      g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,230,200,.7)'; g.beginPath(); g.moveTo(33.5, 38); g.bezierCurveTo(33.5, 12.5, 66.5, 12.5, 66.5, 38); g.stroke();
      const body = () => { g.beginPath(); g.moveTo(18, 39); g.lineTo(82, 39); g.quadraticCurveTo(87, 39, 88, 45); g.lineTo(93, 85); g.quadraticCurveTo(94, 93, 86, 93); g.lineTo(14, 93); g.quadraticCurveTo(6, 93, 7, 85); g.lineTo(12, 45); g.quadraticCurveTo(13, 39, 18, 39); g.closePath(); };
      body(); g.fillStyle = lin(g, 0, 39, 0, 93, [[0, it.light], [0.35, it.hue], [1, it.dark]]); g.fill();
      g.lineWidth = 2.8; g.strokeStyle = it.edge; g.stroke();
      g.beginPath(); g.moveTo(12.4, 44); g.lineTo(87.6, 44); g.lineTo(86, 60); g.quadraticCurveTo(50, 73, 14, 60); g.closePath();
      g.fillStyle = lin(g, 0, 40, 0, 70, [[0, it.hue], [1, it.dark]]); g.fill(); g.lineWidth = 2; g.stroke();
      g.setLineDash([3, 3]); g.lineWidth = 1.3; g.strokeStyle = 'rgba(255,236,210,.9)'; g.beginPath(); g.moveTo(17, 57.5); g.quadraticCurveTo(50, 68.5, 83, 57.5); g.stroke(); g.setLineDash([]);
      g.fillStyle = lin(g, 42, 0, 58, 0, GOLD); rr(g, 41.5, 59, 17, 13.5, 3.5); g.fill(); g.lineWidth = 1.7; g.strokeStyle = '#5a3608'; g.stroke();
      g.fillStyle = '#5a3608'; g.beginPath(); g.arc(50, 65.8, 2.5, 0, 7); g.fill();
      g.save(); body(); g.clip(); g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(28, 80, 15, 6, -0.25, 0, 7); g.fill(); g.restore();
    }
    function heel(g, it) {
      g.beginPath(); g.moveTo(77.5, 52); g.lineTo(90, 50); g.lineTo(87, 93); g.lineTo(82, 93); g.closePath();
      g.fillStyle = lin(g, 78, 0, 90, 0, [[0, it.dark], [0.5, it.hue], [1, it.edge]]); g.fill(); g.lineWidth = 2.4; g.strokeStyle = it.edge; g.stroke();
      g.fillStyle = lin(g, 80, 0, 88, 0, GOLD); g.fillRect(81.6, 88, 5.6, 5.4);
      const body = () => {
        g.beginPath(); g.moveTo(5, 80);
        g.bezierCurveTo(5, 68, 18, 62, 32, 60); g.bezierCurveTo(44, 58, 54, 56, 60, 50);
        g.bezierCurveTo(68, 42, 73, 30, 80, 25); g.bezierCurveTo(86, 21, 93, 25, 92, 35);
        g.lineTo(91, 52); g.bezierCurveTo(80, 53, 66, 58, 53, 70); g.bezierCurveTo(45, 78, 36, 86, 24, 88);
        g.lineTo(11, 88); g.bezierCurveTo(5, 88, 4, 84, 5, 80); g.closePath();
      };
      body(); g.fillStyle = lin(g, 0, 22, 0, 88, [[0, it.light], [0.4, it.hue], [1, it.dark]]); g.fill();
      g.save(); body(); g.clip();
      g.beginPath(); g.moveTo(58, 53); g.bezierCurveTo(66, 45, 72, 35, 79, 30); g.bezierCurveTo(84, 28, 87, 31, 86.5, 38); g.lineTo(86, 49); g.bezierCurveTo(76, 51, 66, 52, 58, 53); g.closePath();
      g.fillStyle = lin(g, 60, 30, 86, 52, [[0, '#fff0e2'], [1, '#e6ab82']]); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(10, 74); g.bezierCurveTo(14, 66, 26, 62, 40, 60); g.stroke();
      g.restore();
      body(); g.lineWidth = 2.8; g.strokeStyle = it.edge; g.stroke();
      g.strokeStyle = '#d9a64a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(10, 87); g.lineTo(24, 87); g.bezierCurveTo(36, 85, 45, 77.5, 53, 69.5); g.bezierCurveTo(66, 57.5, 80, 52.5, 90.5, 51.5); g.stroke();
      g.beginPath(); g.arc(25, 66, 5, 0, 7); g.fillStyle = rad(g, 23.5, 64.5, 0.5, 25, 66, 5, [[0, '#fff'], [0.5, '#fff1c4'], [1, '#c9922e']]); g.fill(); g.lineWidth = 1.3; g.strokeStyle = '#7a4a12'; g.stroke();
    }
    function ring(g, it) {
      g.lineWidth = 12; g.strokeStyle = '#6e420e'; g.beginPath(); g.ellipse(50, 66, 27, 25, 0, 0, 7); g.stroke();
      g.lineWidth = 8.6; g.strokeStyle = lin(g, 23, 40, 77, 92, GOLD); g.stroke();
      g.lineWidth = 1.7; g.strokeStyle = 'rgba(255,250,225,.95)'; g.beginPath(); g.ellipse(50, 66, 24.5, 22.5, 0, Math.PI * 0.9, Math.PI * 1.6); g.stroke();
      g.fillStyle = lin(g, 0, 26, 0, 42, GOLD);
      for (const [x, y] of [[32, 33], [68, 33], [50, 41]]) { g.beginPath(); g.ellipse(x, y, 5, 6, 0, 0, 7); g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#5a3608'; g.stroke(); }
      const gem = () => { g.beginPath(); g.moveTo(24, 30); g.lineTo(37, 10); g.lineTo(63, 10); g.lineTo(76, 30); g.lineTo(50, 59); g.closePath(); };
      gem(); g.fillStyle = lin(g, 0, 10, 0, 59, [[0, it.light], [0.45, it.hue], [1, it.dark]]); g.fill();
      g.save(); gem(); g.clip();
      tri(g, [24, 30, 37, 10, 42, 30], 'rgba(255,255,255,.5)');
      tri(g, [42, 30, 50, 10, 58, 30], 'rgba(255,255,255,.28)');
      tri(g, [58, 30, 63, 10, 76, 30], 'rgba(0,30,80,.2)');
      tri(g, [24, 30, 42, 30, 50, 59], 'rgba(255,255,255,.32)');
      tri(g, [58, 30, 76, 30, 50, 59], 'rgba(0,30,80,.32)');
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.2; g.beginPath();
      g.moveTo(24, 30); g.lineTo(76, 30); g.moveTo(42, 30); g.lineTo(50, 59); g.lineTo(58, 30);
      g.moveTo(42, 30); g.lineTo(37, 10); g.moveTo(58, 30); g.lineTo(63, 10); g.moveTo(42, 30); g.lineTo(50, 10); g.lineTo(58, 30); g.stroke();
      g.restore();
      gem(); g.lineWidth = 2.6; g.strokeStyle = it.edge; g.stroke();
      g.fillStyle = '#fff'; star4(g, 37, 19, 7);
    }
    function bow(g, it) {
      const fill = lin(g, 0, 16, 0, 94, [[0, it.light], [0.45, it.hue], [1, it.dark]]);
      const mirror = (sx, fn) => { g.save(); if (sx < 0) { g.translate(100, 0); g.scale(-1, 1); } fn(); g.restore(); };
      for (const sx of [1, -1]) mirror(sx, () => {
        g.beginPath(); g.moveTo(45, 54); g.lineTo(29, 90); g.lineTo(37, 85.5); g.lineTo(41.5, 94); g.lineTo(55, 58); g.closePath();
        g.fillStyle = fill; g.fill(); g.lineWidth = 2.6; g.strokeStyle = it.edge; g.stroke();
      });
      for (const sx of [1, -1]) mirror(sx, () => {
        g.beginPath(); g.moveTo(50, 49); g.bezierCurveTo(42, 27, 17, 14, 8, 28); g.bezierCurveTo(1, 40, 7, 65, 28, 66); g.bezierCurveTo(38, 66.5, 46, 60, 50, 54); g.closePath();
        g.fillStyle = fill; g.fill(); g.lineWidth = 2.6; g.strokeStyle = it.edge; g.stroke();
        g.save(); g.clip();
        g.fillStyle = 'rgba(130,15,75,.3)'; g.beginPath(); g.ellipse(39, 51, 11, 9, 0.3, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(20, 31, 9, 4.5, -0.6, 0, 7); g.fill();
        g.restore();
        pearl(g, 12.5, 31, 3.6);
      });
      pearl(g, 50, 52, 12);
    }
    const DRAW = [lipstick, perfume, handbag, heel, ring, bow];

    // ---- 特殊元素 ----
    function pinkDiamond(g) {
      const gem = () => { g.beginPath(); g.moveTo(8, 36); g.lineTo(27, 11); g.lineTo(73, 11); g.lineTo(92, 36); g.lineTo(50, 94); g.closePath(); };
      gem(); g.fillStyle = lin(g, 0, 11, 0, 94, [[0, '#ffe6f3'], [0.35, '#ff82c2'], [0.7, '#e2338a'], [1, '#8f1257']]); g.fill();
      g.save(); gem(); g.clip();
      const H = ['rgba(255,214,110,.45)', 'rgba(127,227,255,.4)', 'rgba(195,155,255,.45)', 'rgba(157,255,207,.4)', 'rgba(255,255,255,.5)'];
      tri(g, [8, 36, 27, 11, 35, 36], H[4]); tri(g, [27, 11, 50, 11, 35, 36], H[0]); tri(g, [35, 36, 50, 11, 65, 36], 'rgba(255,255,255,.3)');
      tri(g, [50, 11, 73, 11, 65, 36], H[1]); tri(g, [65, 36, 73, 11, 92, 36], H[2]);
      tri(g, [8, 36, 35, 36, 50, 94], H[3]); tri(g, [35, 36, 65, 36, 50, 94], 'rgba(255,255,255,.22)'); tri(g, [65, 36, 92, 36, 50, 94], 'rgba(120,0,60,.25)');
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.3; g.beginPath();
      g.moveTo(8, 36); g.lineTo(92, 36); g.moveTo(35, 36); g.lineTo(27, 11); g.moveTo(35, 36); g.lineTo(50, 11); g.lineTo(65, 36); g.lineTo(73, 11);
      g.moveTo(35, 36); g.lineTo(50, 94); g.lineTo(65, 36); g.stroke();
      g.restore();
      gem(); g.lineWidth = 3; g.strokeStyle = '#7d0f4a'; g.stroke();
      g.fillStyle = '#fff'; star4(g, 30, 22, 9); star4(g, 70, 50, 5);
    }
    function giftWrap(g, it, inner) {
      rr(g, 11, 28, 78, 65, 12); g.fillStyle = lin(g, 0, 28, 0, 93, [[0, it.light], [0.4, it.hue], [1, it.dark]]); g.fill();
      g.lineWidth = 2.8; g.strokeStyle = it.edge; g.stroke();
      rr(g, 6, 22, 88, 18, 7); g.fillStyle = lin(g, 0, 22, 0, 40, [[0, it.light], [1, it.hue]]); g.fill(); g.stroke();
      g.fillStyle = lin(g, 43, 0, 57, 0, GOLD); g.fillRect(43.5, 22.5, 13, 70); g.lineWidth = 1.3; g.strokeStyle = 'rgba(90,54,10,.75)'; g.strokeRect(43.5, 22.5, 13, 70);
      g.fillStyle = lin(g, 0, 4, 0, 26, GOLD);
      for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(50 + sx * 11, 14, 11, 7, sx * 0.45, 0, 7); g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#6e420e'; g.stroke(); }
      g.beginPath(); g.arc(50, 18, 5.5, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.arc(50, 63, 22.5, 0, 7); g.fillStyle = rad(g, 44, 56, 2, 50, 63, 23, [[0, '#fffdf8'], [1, '#f6e2ea']]); g.fill();
      g.lineWidth = 3; g.strokeStyle = lin(g, 28, 40, 72, 86, GOLD); g.stroke();
      g.save(); g.translate(50, 63); g.scale(0.4, 0.4); g.translate(-50, -50); inner(g, it); g.restore();
    }
    function parcel(g) {
      rr(g, 13, 31, 74, 62, 9); g.fillStyle = lin(g, 0, 31, 0, 93, [[0, '#6a3556'], [0.5, '#3a1430'], [1, '#1c0817']]); g.fill();
      g.lineWidth = 3; g.strokeStyle = '#d9b062'; g.stroke();
      rr(g, 8, 23, 84, 18, 6); g.fillStyle = lin(g, 0, 23, 0, 41, [[0, '#7d4065'], [1, '#3a1430']]); g.fill(); g.stroke();
      g.fillStyle = lin(g, 43, 0, 57, 0, [[0, '#c42f6e'], [0.5, '#ff9cc4'], [1, '#c42f6e']]); g.fillRect(43.5, 23.5, 13, 69);
      for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(50 + sx * 11, 15, 11, 7, sx * 0.45, 0, 7); g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#8a1a4a'; g.stroke(); }
      g.beginPath(); g.arc(50, 19, 5.5, 0, 7); g.fill(); g.stroke();
      g.fillStyle = lin(g, 30, 0, 70, 0, GOLD); rr(g, 29, 55, 42, 23, 5); g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#5a3608'; g.stroke();
      g.fillStyle = '#4a2a08'; g.font = 'italic 700 19px "Bodoni Moda", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('E', 50, 67);
      g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(16, 44, 6, 44);
    }
    function stripes(t, size, dir, edge) {
      const g = t.getContext('2d');
      g.save(); g.globalCompositeOperation = 'source-atop'; g.scale(size / 100, size / 100);
      if (dir === 'v') { g.translate(50, 50); g.rotate(Math.PI / 2); g.translate(-50, -50); }
      for (const k of [-22, 0, 22]) {
        const y = 50 + k;
        g.fillStyle = edge; g.globalAlpha = 0.45; g.fillRect(-10, y - 7.5, 120, 15);
        g.globalAlpha = 1;
        g.fillStyle = lin(g, 0, y - 6, 0, y + 6, [[0, 'rgba(255,255,255,.35)'], [0.5, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,.35)']]); g.fillRect(-10, y - 5.5, 120, 11);
      }
      g.restore();
    }
    const arrows = dir => (g, size) => {
      g.save(); g.scale(size / 100, size / 100); g.translate(50, 50); if (dir === 'v') g.rotate(Math.PI / 2);
      g.fillStyle = lin(g, 0, -8, 0, 8, [[0, '#fff4c8'], [1, '#d4a043']]); g.strokeStyle = '#6e420e'; g.lineWidth = 1.8; g.lineJoin = 'round';
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 49, 0); g.lineTo(sx * 38, -9); g.lineTo(sx * 38, 9); g.closePath(); g.fill(); g.stroke(); }
      g.restore();
    };
    function build(size, draw, o = {}) {
      const t = mkc(size), tg = t.getContext('2d');
      tg.save(); tg.scale(size / 100, size / 100);
      const k = o.scale || 0.88; tg.translate(50, 50); tg.scale(k, k); tg.translate(-50, -50);
      draw(tg); tg.restore();
      if (o.stripe) stripes(t, size, o.stripe, o.edge || '#5a1534');
      const out = mkc(size), g = out.getContext('2d');
      if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = size * 0.14; g.drawImage(t, 0, 0); }
      g.shadowColor = 'rgba(60,8,36,.4)'; g.shadowBlur = size * 0.05; g.shadowOffsetY = size * 0.035; g.drawImage(t, 0, 0);
      g.shadowColor = 'transparent';
      if (o.after) o.after(g, size);
      return out;
    }
    function iceSprite(size, lv) {
      const c = mkc(size), g = c.getContext('2d'); g.scale(size / 100, size / 100);
      const a = lv > 1 ? 1 : 0.7;
      rr(g, 3, 3, 94, 94, 16);
      g.fillStyle = lin(g, 0, 0, 100, 100, [[0, `rgba(235,250,255,${0.62 * a})`], [0.5, `rgba(175,222,250,${0.42 * a})`], [1, `rgba(120,190,240,${0.62 * a})`]]); g.fill();
      g.lineWidth = 3.2; g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke();
      g.lineWidth = 1.6; g.strokeStyle = 'rgba(80,150,215,.85)'; rr(g, 7, 7, 86, 86, 12); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.moveTo(11, 30); g.lineTo(30, 11); g.lineTo(41, 11); g.lineTo(11, 41); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(58, 89); g.lineTo(89, 58); g.lineTo(89, 67); g.lineTo(67, 89); g.closePath(); g.fill();
      if (lv > 1) {
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.8; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(50, 7); g.lineTo(45, 28); g.lineTo(57, 42); g.lineTo(50, 60); g.moveTo(57, 42); g.lineTo(80, 38); g.moveTo(45, 28); g.lineTo(24, 34); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.85)';
        for (const [x, y] of [[16, 80], [22, 86], [84, 16], [78, 22]]) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
      }
      return c;
    }
    function ribSprite(size, lv) {
      const c = mkc(size), g = c.getContext('2d'); g.scale(size / 100, size / 100);
      rr(g, 2.5, 2.5, 95, 95, 13);
      g.fillStyle = lv > 1 ? lin(g, 0, 0, 100, 100, [[0, '#ff9cc6'], [1, '#df4f8d']]) : lin(g, 0, 0, 100, 100, [[0, '#ffe2ee'], [1, '#ffaccc']]); g.fill();
      g.save(); g.clip();
      g.fillStyle = 'rgba(255,255,255,.28)';
      for (let k = -40; k < 200; k += 30) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 11, 0); g.lineTo(k + 11 - 100, 100); g.lineTo(k - 100, 100); g.closePath(); g.fill(); }
      g.restore();
      g.lineWidth = lv > 1 ? 3.4 : 2.6; g.strokeStyle = lv > 1 ? '#f6d27a' : 'rgba(214,69,122,.7)'; rr(g, 4.5, 4.5, 91, 91, 11); g.stroke();
      if (lv > 1) { g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,244,214,.9)'; rr(g, 10, 10, 80, 80, 8); g.stroke(); }
      g.fillStyle = lv > 1 ? 'rgba(255,240,200,.75)' : 'rgba(214,69,122,.55)';
      for (const [x, y] of [[13, 13], [87, 13], [13, 87], [87, 87]]) { g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 4, y); g.lineTo(x, y + 4); g.lineTo(x - 4, y); g.closePath(); g.fill(); }
      return c;
    }
    function makeSet(size) {
      const set = { size, n: [], h: [], v: [], w: [], c: null, b: null, ice: [], rib: [] };
      ITEMS.forEach((it, i) => {
        const f = g => DRAW[i](g, it);
        set.n[i] = build(size, f);
        set.h[i] = build(size, f, { stripe: 'h', edge: it.edge, glow: it.glow, after: arrows('h') });
        set.v[i] = build(size, f, { stripe: 'v', edge: it.edge, glow: it.glow, after: arrows('v') });
        set.w[i] = build(size, g => giftWrap(g, it, DRAW[i]), { glow: it.glow, scale: 0.94 });
      });
      set.c = build(size, pinkDiamond, { glow: '#ff6fcf', scale: 0.92 });
      set.b = build(size, parcel, { scale: 0.9 });
      set.ice = [null, iceSprite(size, 1), iceSprite(size, 2)];
      set.rib = [null, ribSprite(size, 1), ribSprite(size, 2)];
      return set;
    }
    const spriteOf = (set, k, c) => (k === 'n' ? set.n[c] : k === 'h' ? set.h[c] : k === 'v' ? set.v[c] : k === 'w' ? set.w[c] : k === 'c' ? set.c : set.b);
    // 粒子小圖：每種顏色一個四芒星、一個光點
    function particles() {
      const cols = ITEMS.map(it => it.glow).concat(['#ffffff', '#ffd76e', '#ff8fc0', '#bfe8ff']);
      return cols.map(col => {
        const s = mkc(48), g = s.getContext('2d');
        g.fillStyle = rad(g, 24, 24, 0, 24, 24, 24, [[0, col], [0.35, col + '88'], [1, col + '00']]); g.fillRect(0, 0, 48, 48);
        g.fillStyle = '#fff'; star4(g, 24, 24, 20, 0.16);
        const d = mkc(32), h = d.getContext('2d');
        h.fillStyle = rad(h, 16, 16, 0, 16, 16, 16, [[0, '#ffffff'], [0.3, col], [1, col + '00']]); h.fillRect(0, 0, 32, 32);
        return { star: s, dot: d };
      });
    }
    const cache = new Map();
    function iconURL(key, px = 96) { // 給 DOM 用的小圖：c0..c5、h0、w0、bomb、bag、ice、rib
      if (cache.has(key)) return cache.get(key);
      let cv;
      const m = /^([chvw])(\d)$/.exec(key);
      if (m) { const set = { n: 'n', c: 'n', h: 'h', v: 'v', w: 'w' }[m[1]], i = +m[2], it = ITEMS[i], f = g => DRAW[i](g, it); cv = set === 'n' ? build(px, f) : set === 'w' ? build(px, g => giftWrap(g, it, DRAW[i]), { glow: it.glow, scale: 0.94 }) : build(px, f, { stripe: set, edge: it.edge, glow: it.glow, after: arrows(set) }); }
      else if (key === 'bomb') cv = build(px, pinkDiamond, { glow: '#ff6fcf', scale: 0.92 });
      else if (key === 'bag') cv = build(px, parcel, { scale: 0.9 });
      else if (key === 'ice') { cv = mkc(px); const g = cv.getContext('2d'); g.drawImage(build(px, g2 => DRAW[4](g2, ITEMS[4]), { scale: 0.8 }), 0, 0); g.drawImage(iceSprite(px, 2), 0, 0); }
      else if (key === 'rib') { cv = mkc(px); const g = cv.getContext('2d'); g.drawImage(ribSprite(px, 2), 0, 0); g.drawImage(build(px, g2 => bow(g2, ITEMS[5]), { scale: 0.62 }), 0, 0); }
      const url = cv ? cv.toDataURL() : '';
      cache.set(key, url);
      return url;
    }
    return { makeSet, spriteOf, particles, iconURL, rr, star4 };
  })();

  /* =====================================================================
   * 四、畫面與流程
   * ===================================================================== */
  const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FLOORS = [
    { name: '美妝沙龍', en: 'Beauty Salon' }, { name: '香氛藝廊', en: 'Parfum Gallery' }, { name: '精品皮件', en: 'Maison Leather' },
    { name: '名鞋大道', en: 'Shoe Avenue' }, { name: '珠寶沙龍', en: 'Jewel Salon' }, { name: '頂樓貴賓室', en: 'Penthouse VIP' },
  ];
  const PRICE = { hammer: 12, shuffle: 8, plus5: 15, bomb: 10, auto: 25, hearts: 20, revive: 15 };
  const HEART_MS = 20 * 60e3, MAXH = 5;
  const PRAISE = [[2, '漂亮！'], [3, '華麗！'], [4, '完美！'], [6, '貴婦級！']];
  const LINES = {
    title: ['今天想從哪一層逛起呢？', '三個一樣就消除，超簡單的♪', '過關有金幣，每 5 關還送粉鑽喔！', '一起把六層樓的精品都收齊吧～'],
    start: ['準備好了嗎？開始血拼囉！', '這層樓的好東西都在等妳～', '看到三個一樣就滑過去！'],
    combo: ['哇～連鎖了！', '好會買！', '這波太華麗了！', '貴婦氣場全開！'],
    win: ['完美過關！戰利品都是妳的♥', '太厲害了，下一層也交給妳！', '這就是貴婦的實力～'],
    lose: ['差一點點…再挑戰一次一定行！', '沒關係，休息一下再來～', '好可惜，下次一定可以！'],
    oom: ['步數用完了…再給妳 5 步好不好？', '只差一點點了，要不要加步數？'],
  };
  const GOAL_TIP = { ribbon: '粉紅色的「緞帶格」要在上面消除才會清掉喔！', ice: '被冰住的精品不能移動，在它身上消除就能敲碎冰塊！', bag: '把「名牌包裹」送到最底下的箭頭就算收到囉！包裹也可以直接往下拖一格。' };
  const SPECIAL_TIP = {
    h: '四個一排會做出「條紋精品」，被消除時會清掉整排！', v: '四個一排會做出「條紋精品」，被消除時會清掉整列！',
    w: '排成 L 或 T 形會變成「包裝炸彈」，會連爆兩次！', c: '五個一排出現「粉鑽」！跟任何精品交換，同色全部清光！',
  };
  const E = { out: k => 1 - Math.pow(1 - k, 3), io: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2), back: k => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2), lin: k => k };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clockStr = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.4-4.5-9.5-9.2C1 8.3 3.1 4.6 6.7 4.6c2.2 0 3.6 1.3 5.3 3.4 1.7-2.1 3.1-3.4 5.3-3.4 3.6 0 5.7 3.7 4.2 7.2C19.4 16.5 12 21 12 21z"/></svg>';
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z"/></svg>';
  const CROWN = '<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M3 20 1.5 6l8 6L16 2l6.5 10 8-6L29 20z" fill="#f2c860" stroke="#8a5a14" stroke-width="1.4" stroke-linejoin="round"/><circle cx="16" cy="14" r="2.4" fill="#ff6fbd"/><path d="M3 20h26" stroke="#8a5a14" stroke-width="2"/></svg>';
  const SILK = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 12.5c3.2 1 3.2 5.6 0 7.5" fill="none" stroke="#f2a3bd" stroke-width="1.8" stroke-linecap="round"/><rect x="6" y="5.5" width="12" height="13" fill="#f6b3c8"/><path d="M6 8.5h12M6 11.5h12M6 14.5h12" stroke="#d6457a" stroke-width=".9" opacity=".6"/><rect x="4" y="3" width="16" height="3.2" rx="1.3" fill="#d9b062" stroke="#8a5a14" stroke-width=".7"/><rect x="4" y="17.8" width="16" height="3.2" rx="1.3" fill="#d9b062" stroke="#8a5a14" stroke-width=".7"/></svg>';
  const TOOL = {
    hammer: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="14" y="13" width="4.6" height="16" rx="2.2" fill="#9a5a2c" stroke="#5a2d12" stroke-width="1.2"/><rect x="5" y="5" width="22" height="10" rx="3.2" fill="#e2b04f" stroke="#7a4a12" stroke-width="1.4"/><rect x="7" y="6.6" width="18" height="2.6" rx="1.3" fill="#fff4c8" opacity=".8"/></svg>',
    shuffle: '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="#d6457a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h5c6 0 8 12 14 12h5"/><path d="M4 22h5c2.6 0 4.3-2.2 5.8-4.8M18.6 13.4C20 11.6 21.3 10 23 10h5"/><path d="M24.5 6.5 28 10l-3.5 3.5M24.5 18.5 28 22l-3.5 3.5"/></g></svg>',
    plus5: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#8a5ad6" stroke="#4f2a92" stroke-width="1.4"/><circle cx="16" cy="16" r="10.4" fill="none" stroke="#e6d6ff" stroke-width="1" opacity=".7"/><text x="16" y="20.6" text-anchor="middle" font-size="12.5" font-weight="800" fill="#fff" font-family="Georgia,serif">+5</text></svg>',
  };

  // ---------- 音效（用主程式的 WebAudio 合成，會自動遵守音效開關） ----------
  function makeSfx(api) {
    const S = api.sound, last = {};
    const gate = (k, ms) => { const t = performance.now(); if (last[k] && t - last[k] < ms) return false; last[k] = t; return true; };
    const SC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
    const nf = n => 523.25 * Math.pow(2, n / 12);
    return {
      select: () => S.beep(1320, 0.05, 'triangle', 0.05),
      swap: () => { S.hiss(0.1, 0.03, 3500); S.beep(640, 0.07, 'sine', 0.05); S.beep(960, 0.06, 'sine', 0.035, 0.05); },
      bad: () => { S.beep(233, 0.11, 'square', 0.035); S.beep(185, 0.16, 'square', 0.035, 0.1); },
      match: n => { if (!gate('m', 50)) return; const f = nf(SC[Math.min(SC.length - 1, n - 1)]); S.beep(f, 0.24, 'triangle', 0.09); S.beep(f * 2, 0.14, 'sine', 0.035, 0.025); S.beep(f * 1.5, 0.18, 'sine', 0.03, 0.06); },
      make: () => { if (!gate('mk', 120)) return; [0, 4, 7, 12].forEach((n, i) => S.beep(nf(n + 7), 0.2, 'triangle', 0.06, i * 0.05)); },
      line: () => { if (!gate('l', 70)) return; S.beep(1760, 0.07, 'sawtooth', 0.028); S.beep(1175, 0.09, 'sawtooth', 0.028, 0.035); S.beep(784, 0.13, 'sawtooth', 0.024, 0.075); S.hiss(0.28, 0.06, 5200); },
      boom: () => { if (!gate('b', 90)) return; S.beep(120, 0.34, 'sine', 0.22); S.beep(72, 0.42, 'sine', 0.2, 0.02); S.hiss(0.36, 0.11, 500); },
      zap: () => { if (!gate('z', 200)) return; S.ssr(); S.hiss(0.5, 0.05, 6500); },
      land: () => { if (!gate('land', 110)) return; S.beep(330, 0.045, 'sine', 0.028); },
      ice: () => { if (!gate('ice', 60)) return; S.beep(2637, 0.05, 'triangle', 0.04); S.beep(3520, 0.04, 'sine', 0.025, 0.03); S.hiss(0.1, 0.05, 6500); },
      rib: () => { if (!gate('rib', 60)) return; S.beep(1568, 0.09, 'sine', 0.045); S.beep(2093, 0.08, 'sine', 0.03, 0.04); },
      bag: () => S.cash(),
      star: i => { S.beep(nf(12 + i * 5), 0.55, 'sine', 0.1); S.beep(nf(19 + i * 5), 0.4, 'triangle', 0.05, 0.05); S.hiss(0.3, 0.03, 7000, 0.02); },
      win: () => S.level(),
      lose: () => [7, 4, 0, -5].forEach((n, i) => S.beep(nf(n), 0.34, 'triangle', 0.07, i * 0.17)),
      praise: lv => (lv >= 3 ? S.fever() : S.ding()),
      tick: () => S.beep(1976, 0.035, 'triangle', 0.035),
      hammer: () => { S.beep(150, 0.16, 'square', 0.06); S.hiss(0.2, 0.09, 1400); },
      shuffle: () => { for (let i = 0; i < 7; i++) S.beep(700 + i * 130, 0.05, 'triangle', 0.03, i * 0.05); S.hiss(0.45, 0.04, 3000); },
      buy: () => S.buy(),
      click: () => S.click(),
      err: () => S.err(),
      drum: () => S.drum(),
    };
  }

  let live = null, hooked = false;
  function open(api) {
    if (live) return;
    if (!hooked) { hooked = true; try { api.on('reset', () => { if (live) live.close(); }); } catch (e) { /* 舊版主程式沒有 on */ } }
    const fmt = api.fmt, GEM = api.icons.gem(), COIN = api.icons.coin();
    const sfx = makeSfx(api);
    let vibAt = 0;
    const vib = p => { const t = performance.now(); if (t - vibAt < 140) return; vibAt = t; try { api.vib(p); } catch (e) { /* 不支援震動 */ } };
    const cast = api.cast(), vivi = cast[1], fumi = cast[5];
    const st = () => {
      const o = api.store('match3');
      if (o.v !== 1) Object.assign(o, { v: 1, lv: 0, stars: [], best: [], hearts: MAXH, heartT: Date.now(), tut: {}, clears: 0, plays: 0, combo: 0, daily: {} });
      for (const k of ['stars', 'best']) if (!Array.isArray(o[k])) o[k] = [];
      if (!o.tut || typeof o.tut !== 'object') o.tut = {};
      if (!o.daily || typeof o.daily !== 'object') o.daily = {};
      if (!Number.isFinite(o.hearts)) o.hearts = MAXH;
      if (!Number.isFinite(o.heartT)) o.heartT = Date.now();
      o.lv = Math.max(0, Math.min(Levels.COUNT, o.lv | 0));
      return o;
    };
    const totalStars = () => st().stars.reduce((a, b) => a + (b || 0), 0);
    // 連動系統（主程式有才用，沒有就略過）
    const has = k => typeof api[k] === 'function';
    const perkMoves = () => { try { return has('perk') ? Math.max(0, Math.floor(api.perk('m3_moves') || 0)) : 0; } catch (e) { return 0; } };
    const fashionOn = () => { try { return has('fashion') && (api.fashion().power || 0) >= 3; } catch (e) { return false; } };
    const resUnit = () => { try { return has('resUnit') ? api.resUnit() : 0; } catch (e) { return 0; } };
    const evt = (name, data) => { try { if (has('event')) api.event(name, data); } catch (e) { console.error(e); } };
    let pending = null; // 結算獎勵：演出結束時發放；玩家提早離開也會在離開時補發
    function claimReward(x, y) {
      if (!pending) return;
      const r = pending; pending = null;
      if (has('grant')) api.grant(r, x, y, true);
      else { if (r.coins) api.addCoins(r.coins, x, y); if (r.gems) api.addGems(r.gems, x, y); }
      api.save();
    }

    // ---------- 愛心（體力） ----------
    function hearts() {
      const o = st();
      if (o.hearts >= MAXH) { o.hearts = MAXH; o.heartT = Date.now(); return MAXH; }
      const k = Math.floor((Date.now() - o.heartT) / HEART_MS);
      if (k > 0) { o.hearts = Math.min(MAXH, o.hearts + k); o.heartT += k * HEART_MS; if (o.hearts >= MAXH) o.heartT = Date.now(); }
      return o.hearts;
    }
    const nextHeart = () => HEART_MS - ((Date.now() - st().heartT) % HEART_MS);
    function loseHeart() { const o = st(); hearts(); if (o.hearts >= MAXH) o.heartT = Date.now(); o.hearts = Math.max(0, o.hearts - 1); api.save(); }

    // ---------- 外框與 DOM ----------
    const ov = api.overlay({ id: 'match3', title: '時尚消消樂', onClose: cleanup, beforeClose: onBack });
    const root = document.createElement('div');
    root.className = 'm3-root';
    ov.body.appendChild(root);
    const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
    root.innerHTML = `
      <section class="m3-view m3-title" data-v="title" aria-label="時尚消消樂標題">
        <div class="m3-t-bg"><i class="m3-rays"></i><i class="m3-t-arch"></i></div>
        <div class="m3-glints" aria-hidden="true">${'<i></i>'.repeat(16)}</div>
        <img class="m3-t-vivi" src="${vivi.full}" alt="薇薇">
        <div class="m3-t-items" aria-hidden="true">${ITEMS.map((_, i) => `<img src="${Art3.iconURL('c' + i)}" alt="" style="--i:${i}">`).join('')}</div>
        <header class="m3-t-head">
          <div class="m3-t-eye">Fashion Match</div>
          <h1 class="m3-logo"><span>時尚</span><b>消消樂</b></h1>
          <div class="m3-t-sub">ERIKA 百貨・六層樓精品大挑戰</div>
        </header>
        <div class="m3-t-say"><b>薇薇</b><span data-tsay></span></div>
        <div class="m3-t-panel">
          <div class="m3-hearts" data-hearts></div>
          <div class="m3-seg" role="tablist" aria-label="遊戲模式">
            <button role="tab" data-mode="tour" class="on">關卡之旅</button>
            <button role="tab" data-mode="daily">每日挑戰<i class="m3-dot" hidden></i></button>
          </div>
          <button class="btn goldb wide m3-go" data-act="go"><span data-go-t>開始血拼</span><small data-go-s></small></button>
          <div class="m3-t-info">
            <div class="m3-t-box"><div class="m3-eb">過關獎勵</div><div data-rw></div></div>
            <div class="m3-t-box"><div class="m3-eb">我的戰績</div><div data-rec></div></div>
          </div>
        </div>
      </section>
      <section class="m3-view m3-map" data-v="map" aria-label="關卡地圖">
        <div class="m3-map-bar">
          <div class="m3-hearts sm" data-hearts></div>
          <div class="m3-mstars">${STAR}<b class="num" data-mstars></b></div>
        </div>
        <div class="m3-map-scroll"><div class="m3-map-in"></div></div>
      </section>
      <section class="m3-view m3-game" data-v="game" aria-label="遊戲中">
        <div class="m3-g-bg" aria-hidden="true"><b data-gfloor></b></div>
        <div class="m3-hud">
          <div class="m3-moves"><small>步數</small><b class="num" data-moves>0</b></div>
          <div class="m3-goals" data-goals></div>
          <div class="m3-score"><small data-lvname></small><b class="num" data-score>0</b>
            <div class="m3-bar"><i data-bar></i><span class="mk" data-mk="1">${STAR}</span><span class="mk" data-mk="2">${STAR}</span><span class="mk" data-mk="3">${STAR}</span></div></div>
        </div>
        <div class="m3-board"><div class="m3-fsign" hidden><b data-fs-n></b><span data-fs-t></span></div><canvas class="m3-cv" role="img" aria-label="遊戲盤面：滑動或點兩下交換相鄰的精品"></canvas></div>
        <div class="m3-dock">
          <div class="m3-host"><img alt="薇薇" data-host src="${vivi.face('neutral')}"><div class="m3-say" data-say hidden></div></div>
          <div class="m3-tools">
            <button class="m3-tool" data-tool="hammer" aria-label="錘子：敲碎一格">${TOOL.hammer}<b>錘子</b><small data-price></small></button>
            <button class="m3-tool" data-tool="shuffle" aria-label="洗牌">${TOOL.shuffle}<b>洗牌</b><small data-price></small></button>
            <button class="m3-tool" data-tool="plus5" aria-label="增加五步">${TOOL.plus5}<b>+5 步</b><small data-price></small></button>
            <button class="m3-tool" data-tool="auto" aria-label="秘書代玩五步"><img src="${fumi.face('joy')}" alt=""><b>秘書代玩</b><small data-price></small></button>
          </div>
        </div>
        <div class="m3-gfx" aria-hidden="true"></div>
        <div class="m3-auto" hidden><img src="${fumi.face('neutral')}" alt=""><span data-auto></span></div>
        <div class="m3-hammer-tip" hidden><span>點一個精品，用錘子敲碎它</span><button data-act="hammer-cancel">取消</button></div>
      </section>
      <div class="m3-layer"></div>
      <div class="m3-loader"><div class="m3-ld-gem"><img src="${Art3.iconURL('bomb')}" alt=""></div><p>薇薇正在佈置櫃位…</p></div>`;

    let view = '', mode = 'tour';
    function show(v) {
      if (view === v) return;
      view = v;
      $$('.m3-view').forEach(el => el.classList.toggle('on', el.dataset.v === v));
      ov.setTitle(v === 'game' && L ? (L.daily ? '每日挑戰' : `第 ${L.n + 1} 關`) : v === 'map' ? '關卡地圖' : '時尚消消樂');
      if (v === 'title') refreshTitle();
      if (v === 'map') buildMap();
    }

    // ---------- 時鐘、補間、計時器（跟著畫面迴圈走，切到背景會暫停） ----------
    let clock = 0, raf = 0, lastTs = 0, dead = false;
    const anims = [], timers = [];
    const tween = (dur, fn, ease = E.out) => new Promise(res => anims.push({ t0: clock, dur: Math.max(1, dur), fn, ease, res }));
    const wait = ms => new Promise(res => timers.push({ t: clock + ms, fn: res }));
    const later = (ms, fn) => timers.push({ t: clock + ms, fn });
    function tick(dt) {
      clock += dt;
      if (timers.length) {
        const due = [];
        for (let i = timers.length - 1; i >= 0; i--) if (timers[i].t <= clock) { due.push(timers[i]); timers.splice(i, 1); }
        due.sort((a, b) => a.t - b.t).forEach(t => { try { t.fn(); } catch (e) { console.error(e); } });
      }
      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i], k = Math.min(1, (clock - a.t0) / a.dur);
        try { a.fn(a.ease(k), k); } catch (e) { console.error(e); }
        if (k >= 1) { anims.splice(i, 1); a.res(); }
      }
    }
    function frame(ts) {
      raf = 0;
      if (dead || document.hidden) return;
      raf = requestAnimationFrame(frame); // 先排下一幀，任何例外都不會讓迴圈停掉
      const dt = lastTs ? Math.min(50, Math.max(0, ts - lastTs)) : 16;
      lastTs = ts;
      try {
        tick(dt);
        if (view === 'game' && S && SP) { stepWorld(dt); draw(); }
        uiTick(dt);
      } catch (e) { console.error(e); }
    }
    function onVis() {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
      else if (!raf && !dead) { lastTs = 0; raf = requestAnimationFrame(frame); }
    }
    document.addEventListener('visibilitychange', onVis);
    let uiAcc = 0;
    function uiTick(dt) {
      uiAcc += dt;
      if (uiAcc > 1000) { uiAcc = 0; if (view !== 'game') renderHearts(); }
      if (view === 'game' && S) {
        const target = S.score;
        if (shownScore !== target) {
          shownScore = Math.abs(target - shownScore) < 2 ? target : shownScore + (target - shownScore) * Math.min(1, dt / 120);
          scoreUI();
        }
        if (!busy && !over && !hammerMode && !auto && !cardOpen && !hintPair) { idle += dt; if (idle > 4000) showHint(); }
      }
    }

    // ---------- 盤面狀態 ----------
    let L = null, S = null, movesLeft = 0, used = 0, over = false, busy = false, boostBomb = false;
    let sel = -1, hintPair = null, hintT = 0, idle = 0, hammerMode = false, auto = 0, cardOpen = false;
    let shownScore = 0, starShown = 0, maxCombo = 0, lowWarned = false, ribShow = null, firstSpecial = {};
    const vis = new Map(); // piece.id → 畫面上的狀態（位置、縮放、透明度…）

    // ---------- Canvas ----------
    const cv = $('.m3-cv'), g = cv.getContext('2d');
    let VW = 300, VH = 300, DPR = 1, cs = 40, BX = 0, BY = 0, BW = 0, BH = 0, SP = null, PS = null, layerC = null, layerDirty = true, hasExits = false;
    const fxs = [], parts = [], texts = [];
    let shakeAmt = 0;
    const cx = i => BX + (i % S.w) * cs + cs / 2, cy = i => BY + ((i / S.w) | 0) * cs + cs / 2;
    const dist = (a, b) => Math.hypot((a % S.w) - (b % S.w), ((a / S.w) | 0) - ((b / S.w) | 0));
    const colOf = c => (c >= 0 && c < 6 ? ITEMS[c].glow : '#ff8fc0');
    const pIdx = c => (c >= 0 && c < 6 ? c : 8);
    function layout() {
      const box = $('.m3-board');
      VW = Math.max(120, box.clientWidth); VH = Math.max(120, box.clientHeight);
      DPR = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
      cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
      if (!S) return;
      const extra = hasExits ? 16 : 0;
      cs = Math.max(24, Math.floor(Math.min((VW - 16) / S.w, (VH - 14 - extra) / S.h, 66)));
      BW = cs * S.w; BH = cs * S.h;
      BX = Math.round((VW - BW) / 2); BY = Math.max(6, Math.round((VH - BH - extra) * 0.45));
      const sign = $('.m3-fsign');
      sign.hidden = BY < 40;
      sign.style.top = Math.max(0, BY - 36) + 'px';
      const size = Math.round(cs * DPR);
      if (!SP || SP.size !== size) SP = Art3.makeSet(size);
      if (!PS) PS = Art3.particles();
      layerDirty = true;
      for (const v of vis.values()) if (!v.mv && !v.die && S.cells[v.i] === v.p) { v.x = cx(v.i); v.y = cy(v.i); }
    }
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (view === 'game') layout(); }) : null;
    if (ro) ro.observe($('.m3-board'));
    const onResize = () => { if (view === 'game') layout(); };
    window.addEventListener('resize', onResize);

    function newVis(p, i) { return { p, i, x: cx(i), y: cy(i), s: 1, a: 1, mv: false, die: false, sq: 0, flash: 0, k: p.k, ice: p.ice, fall: null, hide: false }; }
    function sync() {
      const seen = new Set();
      S.cells.forEach((p, i) => {
        if (!p) return;
        seen.add(p.id);
        let v = vis.get(p.id);
        if (!v || v.die) { v = newVis(p, i); vis.set(p.id, v); }
        v.p = p; v.i = i;
      });
      for (const [id, v] of vis) if (!seen.has(id) && !v.die) vis.delete(id);
    }
    function renderLayer() {
      layerDirty = false;
      if (!layerC) layerC = document.createElement('canvas');
      layerC.width = cv.width; layerC.height = cv.height;
      const l = layerC.getContext('2d');
      l.setTransform(DPR, 0, 0, DPR, 0, 0);
      const cells = [];
      for (let i = 0; i < S.w * S.h; i++) if (S.mask[i]) cells.push([i, BX + (i % S.w) * cs, BY + ((i / S.w) | 0) * cs]);
      // 金色外框（先畫在暫存圖，再整片加陰影）
      const t = document.createElement('canvas'); t.width = layerC.width; t.height = layerC.height;
      const tg = t.getContext('2d'); tg.setTransform(DPR, 0, 0, DPR, 0, 0);
      const gold = tg.createLinearGradient(0, BY, 0, BY + BH); gold.addColorStop(0, '#f6dc9a'); gold.addColorStop(0.5, '#c99a45'); gold.addColorStop(1, '#f0d28a');
      tg.fillStyle = gold;
      for (const [, x, y] of cells) { Art3.rr(tg, x - 4, y - 4, cs + 8, cs + 8, 10); tg.fill(); }
      tg.globalCompositeOperation = 'destination-out';
      for (const [, x, y] of cells) { Art3.rr(tg, x - 1.5, y - 1.5, cs + 3, cs + 3, 7); tg.fill(); }
      tg.globalCompositeOperation = 'source-over';
      tg.fillStyle = 'rgba(255,251,247,.94)';
      for (const [, x, y] of cells) tg.fillRect(x - 1.5, y - 1.5, cs + 3, cs + 3);
      l.save(); l.shadowColor = 'rgba(70,15,45,.35)'; l.shadowBlur = 16; l.shadowOffsetY = 6; l.drawImage(t, 0, 0, VW, VH); l.restore();
      for (const [i, x, y] of cells) {
        const r = (i / S.w) | 0, c = i % S.w;
        l.fillStyle = (r + c) % 2 ? 'rgba(250,224,235,.95)' : 'rgba(255,246,249,.98)';
        Art3.rr(l, x + 1.5, y + 1.5, cs - 3, cs - 3, 6); l.fill();
        const rb = ribShow ? ribShow[i] : 0;
        if (rb) l.drawImage(SP.rib[Math.min(2, rb)], x, y, cs, cs);
      }
    }

    // ---------- 繪圖 ----------
    function drawPiece(v, t) {
      const p = v.p, spr = Art3.spriteOf(SP, v.k, p.c);
      if (!spr || v.hide) return;
      let sc = v.s, sx = 1, sy = 1, ox = 0, oy = 0;
      if (v.sq) { const k = (t - v.sq) / 240; if (k >= 1) v.sq = 0; else { const e = Math.sin(k * Math.PI) * (1 - k) * 0.24; sx = 1 + e; sy = 1 - e; } }
      if (sel === v.i && !v.mv && !v.die) sc *= 1.07 + Math.sin(t / 110) * 0.04;
      if (hintPair && !v.mv && (hintPair.a === v.i || hintPair.b === v.i)) {
        const o = hintPair.a === v.i ? hintPair.b : hintPair.a, k = Math.max(0, Math.sin((t - hintT) / 150)) * 0.13;
        ox = (cx(o) - v.x) * k; oy = (cy(o) - v.y) * k;
      }
      const w = cs * sc * sx, h = cs * sc * sy, x = v.x + ox, y = v.y + oy + (cs * sc - h) / 2;
      g.globalAlpha = Math.max(0, Math.min(1, v.a));
      if (v.k === 'c' && !v.die) {
        const r = cs * (0.62 + Math.sin(t / 260) * 0.05);
        const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, 'rgba(255,170,220,.55)'); q.addColorStop(1, 'rgba(255,120,200,0)');
        g.fillStyle = q; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
      if (p.armed && !v.die) {
        const r = cs * (0.7 + Math.sin(t / 70) * 0.08);
        const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, 'rgba(255,240,170,.85)'); q.addColorStop(1, 'rgba(255,150,60,0)');
        g.fillStyle = q; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
      g.drawImage(spr, x - w / 2, y - h / 2, w, h);
      if (v.flash > 0.01) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, v.a) * v.flash; g.drawImage(spr, x - w / 2, y - h / 2, w, h); g.globalCompositeOperation = 'source-over'; }
      if (v.k === 'c' && !v.die && PS) {
        g.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          const a = t / 900 + k * 2.1, tw = Math.max(0, Math.sin(t / 240 + k * 1.7));
          const s = cs * 0.34 * tw;
          g.globalAlpha = tw;
          g.drawImage(PS[9 - k % 2].star, x + Math.cos(a) * cs * 0.3 - s / 2, y + Math.sin(a) * cs * 0.24 - s / 2, s, s);
        }
        g.globalCompositeOperation = 'source-over';
      }
      if (v.ice > 0) { g.globalAlpha = Math.min(1, v.a); g.drawImage(SP.ice[Math.min(2, v.ice)], v.x - cs / 2, v.y - cs / 2, cs, cs); }
      g.globalAlpha = 1;
    }
    function draw() {
      const t = clock;
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.clearRect(0, 0, VW, VH);
      let sx = 0, sy = 0;
      if (shakeAmt > 0.3 && !REDUCED) { sx = (Math.random() - 0.5) * shakeAmt; sy = (Math.random() - 0.5) * shakeAmt; }
      g.translate(sx, sy);
      if (layerDirty) renderLayer();
      g.drawImage(layerC, 0, 0, VW, VH);
      if (hasExits) {
        const bob = Math.sin(t / 220) * 2.5;
        g.fillStyle = '#d4a043'; g.strokeStyle = '#7a4a12'; g.lineWidth = 1.2;
        S.exits.forEach(i => { if (i < 0) return; const x = cx(i), y = cy(i) + cs / 2 + 6 + bob; g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.lineTo(x, y + 7); g.closePath(); g.fill(); g.stroke(); });
      }
      if (hintPair) {
        const k = 0.45 + Math.sin((t - hintT) / 150) * 0.25;
        for (const i of [hintPair.a, hintPair.b]) { g.fillStyle = `rgba(255,236,160,${k})`; Art3.rr(g, cx(i) - cs / 2 + 2, cy(i) - cs / 2 + 2, cs - 4, cs - 4, 8); g.fill(); }
      }
      if (sel >= 0 && S.cells[sel]) {
        g.strokeStyle = '#f2c35c'; g.lineWidth = 3; Art3.rr(g, cx(sel) - cs / 2 + 2, cy(sel) - cs / 2 + 2, cs - 4, cs - 4, 9); g.stroke();
        g.fillStyle = 'rgba(255,240,190,.45)'; g.fill();
      }
      const moving = [];
      for (const v of vis.values()) { if (v.mv || v.die) moving.push(v); else drawPiece(v, t); }
      if (moving.length) {
        g.save(); g.beginPath(); g.rect(-20, BY - 2, VW + 40, VH); g.clip();
        moving.sort((a, b) => (a.die ? 1 : 0) - (b.die ? 1 : 0));
        for (const v of moving) drawPiece(v, t);
        g.restore();
      }
      drawFx(t);
      drawParts();
      drawTexts(t);
      if (hammerFx) drawHammer(t);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    function stepWorld(dt) {
      shakeAmt *= Math.pow(0.0025, dt / 1000);
      for (const v of vis.values()) {
        if (!v.fall) continue;
        const f = v.fall, k = (clock - f.t0) / f.dur;
        if (k >= 1) { v.y = f.y1; v.fall = null; v.mv = false; v.sq = clock; if (f.land) sfx.land(); }
        else if (k > 0) v.y = f.y0 + (f.y1 - f.y0) * k * k;
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i]; q.t += dt;
        if (q.t >= q.life) { parts.splice(i, 1); continue; }
        const s = dt / 1000; q.vy += (q.g || 0) * s; q.vx *= q.drag || 1; q.vy *= q.drag || 1; q.x += q.vx * s; q.y += q.vy * s; q.rot += (q.vr || 0) * s;
      }
      for (let i = fxs.length - 1; i >= 0; i--) if (clock - fxs[i].t0 > fxs[i].dur) fxs.splice(i, 1);
      for (let i = texts.length - 1; i >= 0; i--) if (clock - texts[i].t0 > texts[i].dur) texts.splice(i, 1);
    }

    // ---------- 特效 ----------
    function burst(x, y, c, n, o = {}) {
      if (REDUCED) n = Math.ceil(n / 3);
      for (let k = 0; k < n && parts.length < 480; k++) {
        const a = Math.random() * Math.PI * 2, sp = (o.speed || 160) * (0.35 + Math.random());
        const conf = Math.random() < (o.conf ?? 0.35);
        if (conf) { parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 60), g: 520, drag: 0.98, t: 0, life: (o.life || 650) * (0.7 + Math.random() * 0.6), s: cs * (0.06 + Math.random() * 0.06), col: colOf(c), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, shard: true }); continue; }
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 60), g: o.g ?? 420, drag: 0.985, t: 0, life: (o.life || 650) * (0.6 + Math.random() * 0.6), s: (o.size || 0.2) * cs * (0.5 + Math.random() * 0.7), spr: PS[pIdx(c)][Math.random() < (o.dots ?? 0.3) ? 'dot' : 'star'], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8 });
      }
    }
    function shards(x, y, n, col) {
      for (let k = 0; k < n && parts.length < 480; k++) {
        const a = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 200;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, g: 700, t: 0, life: 520 + Math.random() * 300, s: cs * (0.08 + Math.random() * 0.1), col, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, shard: true });
      }
    }
    function drawParts() {
      for (const q of parts) {
        const k = q.t / q.life, a = k < 0.2 ? 1 : 1 - (k - 0.2) / 0.8;
        g.globalAlpha = Math.max(0, a);
        if (q.shard) { g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.fillStyle = q.col; g.fillRect(-q.s, -q.s * 0.4, q.s * 2, q.s * 0.8); g.restore(); continue; }
        const s = q.s * (1 - k * 0.4);
        g.drawImage(q.spr, q.x - s, q.y - s, s * 2, s * 2);
      }
      g.globalAlpha = 1;
    }
    function floatText(x, y, str, size = 16, col = '#fff', dur = 900) { texts.push({ x, y, str, size, col, t0: clock, dur }); }
    function drawTexts(t) {
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      for (const q of texts) {
        const k = (t - q.t0) / q.dur, a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, rise = E.out(Math.min(1, k * 1.4)) * cs * 0.7;
        const sc = k < 0.15 ? 0.6 + k / 0.15 * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
        g.globalAlpha = Math.max(0, a);
        g.font = `700 ${Math.round(q.size * sc)}px "Bodoni Moda", Georgia, serif`;
        g.lineWidth = 4; g.strokeStyle = 'rgba(90,20,55,.9)'; g.strokeText(q.str, q.x, q.y - rise);
        g.fillStyle = q.col; g.fillText(q.str, q.x, q.y - rise);
      }
      g.globalAlpha = 1;
    }
    function startFx(f) {
      const x = cx(f.i), y = cy(f.i), col = colOf(f.c);
      if (f.k === 'line') { fxs.push({ k: 'beam', dir: f.dir, x, y, col, t0: clock, dur: 460, wide: 1 }); sfx.line(); shakeAmt = Math.max(shakeAmt, 5); vib(12); }
      else if (f.k === 'cross') { fxs.push({ k: 'beam', dir: 'h', x, y, col, t0: clock, dur: 560, wide: 3 }, { k: 'beam', dir: 'v', x, y, col, t0: clock, dur: 560, wide: 3 }); sfx.line(); sfx.boom(); shakeAmt = Math.max(shakeAmt, 12); vib(30); }
      else if (f.k === 'blast') { fxs.push({ k: 'blast', x, y, rad: f.rad, col, t0: clock, dur: 560 }); burst(x, y, f.c, 18 + f.rad * 8, { speed: 260, size: 0.36 }); sfx.boom(); shakeAmt = Math.max(shakeAmt, f.rad > 1 ? 14 : 8); vib(f.rad > 1 ? 40 : 20); }
      else if (f.k === 'zap') { fxs.push({ k: 'zap', x, y, tg: f.tg.map(j => [cx(j), cy(j), zapOrder(f, j)]), col, t0: clock, dur: 760 + f.tg.length * 30 }); sfx.zap(); shakeAmt = Math.max(shakeAmt, 7); vib([20, 30, 20]); }
      else if (f.k === 'nova') { fxs.push({ k: 'nova', x, y, t0: clock, dur: 1000 }); sfx.zap(); sfx.boom(); shakeAmt = 18; vib([40, 40, 60]); if (!REDUCED) api.fx.rain('confetti', 40, cv.getBoundingClientRect()); }
    }
    const zapOrder = (f, j) => Math.max(0, f.tg.indexOf(j));
    function drawFx(t) {
      for (const f of fxs) {
        const k = (t - f.t0) / f.dur;
        if (k < 0 || k > 1) continue;
        if (f.k === 'beam') {
          const grow = E.out(Math.min(1, k / 0.3)), fade = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
          const th = cs * (0.42 * f.wide + 0.25) * (1 - k * 0.4);
          g.globalAlpha = fade;
          if (f.dir === 'h') {
            const len = (VW + 40) * grow, x0 = f.x - len, x1 = f.x + len;
            const q = g.createLinearGradient(0, f.y - th, 0, f.y + th); q.addColorStop(0, 'rgba(255,255,255,0)'); q.addColorStop(0.35, f.col); q.addColorStop(0.5, '#fff'); q.addColorStop(0.65, f.col); q.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = q; g.fillRect(x0, f.y - th, x1 - x0, th * 2);
          } else {
            const len = (VH + 40) * grow, y0 = f.y - len, y1 = f.y + len;
            const q = g.createLinearGradient(f.x - th, 0, f.x + th, 0); q.addColorStop(0, 'rgba(255,255,255,0)'); q.addColorStop(0.35, f.col); q.addColorStop(0.5, '#fff'); q.addColorStop(0.65, f.col); q.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = q; g.fillRect(f.x - th, y0, th * 2, y1 - y0);
          }
          if (PS && k < 0.5) { const s = cs * 1.4 * (1 - k); g.globalAlpha = 1 - k * 2; g.drawImage(PS[9].star, f.x - s / 2, f.y - s / 2, s, s); }
        } else if (f.k === 'blast') {
          const R = cs * (f.rad + 0.6) * (0.4 + E.out(k) * 0.9), a = 1 - k;
          const q = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, R); q.addColorStop(0, `rgba(255,255,240,${a})`); q.addColorStop(0.4, f.col); q.addColorStop(1, 'rgba(255,200,120,0)');
          g.globalAlpha = a * 0.8; g.fillStyle = q; g.beginPath(); g.arc(f.x, f.y, R, 0, 7); g.fill();
          g.globalAlpha = a; g.strokeStyle = '#fff6d8'; g.lineWidth = 4 * (1 - k); g.beginPath(); g.arc(f.x, f.y, R * 1.15, 0, 7); g.stroke();
        } else if (f.k === 'zap') {
          for (const [tx, ty, n] of f.tg) {
            const k0 = (t - f.t0 - 80 - n * 30) / 420;
            if (k0 < 0 || k0 > 1) continue;
            g.globalAlpha = 1 - k0;
            g.strokeStyle = f.col; g.lineWidth = 4; g.beginPath(); g.moveTo(f.x, f.y);
            const seg = 6;
            for (let s = 1; s <= seg; s++) { const u = s / seg, j = s < seg ? (Math.random() - 0.5) * cs * 0.5 : 0; g.lineTo(f.x + (tx - f.x) * u + j, f.y + (ty - f.y) * u + j); }
            g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.stroke();
          }
          const R = cs * (0.9 + Math.sin(t / 50) * 0.15);
          const q = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, R); q.addColorStop(0, 'rgba(255,255,255,.95)'); q.addColorStop(1, 'rgba(255,120,200,0)');
          g.globalAlpha = 1 - k; g.fillStyle = q; g.beginPath(); g.arc(f.x, f.y, R, 0, 7); g.fill();
        } else if (f.k === 'nova') {
          const R = Math.max(VW, VH) * E.out(k) * 1.1;
          g.globalAlpha = (1 - k) * 0.9;
          const q = g.createRadialGradient(f.x, f.y, R * 0.6, f.x, f.y, R); q.addColorStop(0, 'rgba(255,190,230,0)'); q.addColorStop(0.8, 'rgba(255,220,240,.9)'); q.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = q; g.fillRect(0, 0, VW, VH);
          g.globalAlpha = Math.max(0, 0.6 - k * 1.5); g.fillStyle = '#fff'; g.fillRect(0, 0, VW, VH);
        } else if (f.k === 'ring') {
          g.globalAlpha = 1 - k; g.strokeStyle = f.col; g.lineWidth = 3 * (1 - k) + 0.5; g.beginPath(); g.arc(f.x, f.y, cs * (0.25 + k * 0.5), 0, 7); g.stroke();
        }
      }
      g.globalAlpha = 1;
    }
    let hammerFx = null;
    function drawHammer(t) {
      const f = hammerFx, k = Math.min(1, (t - f.t0) / 280), a = -1.2 + E.back(k) * 1.5;
      g.save(); g.translate(f.x + cs * 0.45, f.y - cs * 0.2); g.rotate(a);
      g.fillStyle = '#9a5a2c'; g.strokeStyle = '#5a2d12'; g.lineWidth = 1.5; Art3.rr(g, -3, -2, 6, cs * 0.95, 3); g.fill(); g.stroke();
      const q = g.createLinearGradient(0, -cs * 0.5, 0, -cs * 0.15); q.addColorStop(0, '#fff1c4'); q.addColorStop(1, '#c9922e');
      g.fillStyle = q; g.strokeStyle = '#7a4a12'; Art3.rr(g, -cs * 0.42, -cs * 0.42, cs * 0.84, cs * 0.36, 6); g.fill(); g.stroke();
      g.restore();
    }

    // ---------- 動畫：每一步消除 ----------
    const DT = REDUCED ? 70 : 115;
    async function playStep(ev) {
      for (const h of ev.hits) { const v = vis.get(h.p.id); if (v) v.die = true; }
      sync();
      for (const m of ev.made) { const v = vis.get(m.p.id); if (v) { v.s = 0; v.hide = true; v.k = m.p.k; } }
      const madeOf = new Map(); for (const m of ev.made) madeOf.set(m.g, m.i);
      const groupOf = new Map(); for (const gr of ev.groups) for (const i of gr.cells) groupOf.set(i, gr);
      const zapIdx = new Map(); for (const f of ev.fx) if (f.k === 'zap') f.tg.forEach((j, n) => zapIdx.set(j, n));
      const tHit = h => {
        let t = h.d * DT;
        if (h.o >= 0 && h.o !== h.i && (h.cause === 'line' || h.cause === 'blast' || h.cause === 'nova')) t += dist(h.o, h.i) * (h.cause === 'line' ? 24 : 36);
        if (h.cause === 'zap') t += 90 + (zapIdx.get(h.i) || 0) * 30;
        return t;
      };
      let end = 0;
      if (ev.groups.length) sfx.match(ev.cascade);
      for (const h of ev.hits) {
        const t = tHit(h); end = Math.max(end, t);
        const gr = h.cause === 'match' ? groupOf.get(h.i) : null;
        const to = gr && madeOf.has(gr) ? madeOf.get(gr) : -1;
        later(t, () => popPiece(h, to));
      }
      for (const f of ev.fx) { const t = f.d * DT; end = Math.max(end, t + 100); later(t, () => startFx(f)); }
      for (const ic of ev.ice) { const t = tHit({ ...ic, cause: ic.o >= 0 ? 'blast' : 'match' }); end = Math.max(end, t); later(t, () => iceCrack(ic)); }
      for (const rb of ev.rib) { const t = tHit({ ...rb, cause: 'blast' }) + 40; end = Math.max(end, t); later(t, () => ribbonClear(rb)); }
      for (const c of ev.conv) later(90 + (zapIdx.get(c.i) || 0) * 30, () => { const v = vis.get(c.p.id); if (v) { v.k = c.p.k; v.flash = 1; tween(260, k => { v.flash = 1 - k; v.s = 1 + Math.sin(k * Math.PI) * 0.25; }); burst(v.x, v.y, c.p.c, 6, { speed: 90 }); } });
      for (const gr of ev.groups) {
        const xs = gr.cells.map(cx), ys = gr.cells.map(cy), x = xs.reduce((a, b) => a + b) / xs.length, y = ys.reduce((a, b) => a + b) / ys.length;
        const base = (gr.kind === 'c' ? 200 : gr.shape ? 150 : gr.len >= 4 ? 120 : 60) * Math.min(ev.cascade, 8);
        later(60, () => floatText(x, y, '+' + base, gr.len >= 4 ? 19 : 15, ITEMS[gr.color] ? ITEMS[gr.color].light : '#fff'));
      }
      const tm = end + 200;
      if (ev.made.length) {
        later(tm, () => {
          sfx.make();
          for (const m of ev.made) {
            const v = vis.get(m.p.id); if (!v) continue;
            v.hide = false; v.flash = 1;
            tween(340, (e, k) => { v.s = E.back(k) * 1; v.flash = 1 - k; });
            burst(v.x, v.y, m.p.c, 14, { speed: 200, size: 0.4 });
            fxs.push({ k: 'ring', x: v.x, y: v.y, col: '#fff3c4', t0: clock, dur: 420 });
            if (!st().tut['sp_' + m.p.k] && SPECIAL_TIP[m.p.k]) { const o = st(); o.tut['sp_' + m.p.k] = 1; if (m.p.k === 'h') o.tut.sp_v = 1; if (m.p.k === 'v') o.tut.sp_h = 1; say(SPECIAL_TIP[m.p.k], 'joy', 4200); }
          }
        });
      }
      await wait(Math.max(tm + (ev.made.length ? 300 : 0), end + 280));
      hudUI();
    }
    function popPiece(h, to) {
      const v = vis.get(h.p.id);
      if (!v) return;
      const c = h.p.c;
      if (to >= 0 && to !== h.i && h.cause === 'match') {
        const x0 = v.x, y0 = v.y, x1 = cx(to), y1 = cy(to);
        tween(150, k => { v.x = x0 + (x1 - x0) * k; v.y = y0 + (y1 - y0) * k; v.s = 1 - 0.35 * k; v.flash = k * 0.6; }, E.io).then(() => vis.delete(h.p.id));
        return;
      }
      burst(v.x, v.y, c, h.cause === 'match' ? 7 : 5, { speed: 150 });
      fxs.push({ k: 'ring', x: v.x, y: v.y, col: colOf(c), t0: clock, dur: 340 });
      v.flash = 1;
      tween(200, k => { v.s = 1 + 0.32 * k; v.a = 1 - k; v.flash = 1 - k; }).then(() => vis.delete(h.p.id));
      goalFly(h.p, v.x, v.y);
    }
    function iceCrack(ic) {
      const p = S.cells[ic.i], v = p && vis.get(p.id);
      if (v) { v.ice = ic.left; v.flash = 0.6; tween(200, k => { v.flash = 0.6 * (1 - k); }); }
      const x = cx(ic.i), y = cy(ic.i);
      shards(x, y, 10, 'rgba(220,245,255,.95)'); burst(x, y, -2, 4, { speed: 120 });
      sfx.ice();
      if (ic.left === 0) bumpGoal('ice');
    }
    function ribbonClear(rb) {
      ribShow[rb.i] = rb.left; layerDirty = true;
      const x = cx(rb.i), y = cy(rb.i);
      shards(x, y, 8, rb.left ? '#ff7fb0' : '#ffc4dc'); sfx.rib();
      if (rb.left === 0) bumpGoal('ribbon');
    }
    async function playFall(moves) {
      if (!moves.length) return;
      sync();
      const G = 0.000235; // 格／毫秒²
      let maxT = 0;
      for (const m of moves) {
        const v = vis.get(m.p.id); if (!v) continue;
        const r1 = (m.to / S.w) | 0, y0 = BY + m.fr * cs + cs / 2, y1 = cy(m.to);
        const dur = Math.sqrt((2 * Math.max(0.35, r1 - m.fr)) / G);
        v.x = cx(m.to); v.y = y0; v.mv = true; v.fall = { y0, y1, t0: clock, dur, land: true };
        maxT = Math.max(maxT, dur);
      }
      await wait(maxT + 50);
    }
    async function playBags(list) {
      sfx.bag();
      for (const b of list) {
        const v = vis.get(b.p.id); if (!v) continue;
        v.die = true;
        burst(v.x, v.y, -3, 18, { speed: 220, size: 0.4 });
        floatText(v.x, v.y - cs * 0.3, '+1000', 18, '#ffe08a', 1100);
        const y0 = v.y;
        tween(520, k => { v.y = y0 - k * cs * 1.2; v.s = 1 + k * 0.4; v.a = 1 - k * k; }).then(() => vis.delete(b.p.id));
        goalFly(b.p, v.x, v.y);
      }
      vib(25);
      await wait(380);
      hudUI();
    }
    async function animSwap(a, b, back) {
      const pa = S.cells[a], pb = S.cells[b], va = vis.get(pa.id), vb = vis.get(pb.id);
      const ax = cx(a), ay = cy(a), bx = cx(b), by = cy(b);
      va.mv = vb.mv = true;
      await tween(back ? 130 : 160, k => { va.x = ax + (bx - ax) * k; va.y = ay + (by - ay) * k; vb.x = bx + (ax - bx) * k; vb.y = by + (ay - by) * k; va.s = 1 + Math.sin(k * Math.PI) * 0.12; }, E.io);
      if (back) {
        sfx.bad();
        await tween(150, k => { va.x = bx + (ax - bx) * k; va.y = by + (ay - by) * k; vb.x = ax + (bx - ax) * k; vb.y = ay + (by - ay) * k; }, E.io);
        await tween(160, k => { va.x = ax + Math.sin(k * Math.PI * 3) * (1 - k) * cs * 0.08; });
        va.x = ax; va.y = ay; vb.x = bx; vb.y = by;
      }
      va.mv = vb.mv = false;
    }
    async function playShuffle(map) {
      sfx.shuffle();
      const mx = BX + BW / 2, my = BY + BH / 2;
      const items = map.map(m => ({ v: vis.get(m.p.id), x0: cx(m.from), y0: cy(m.from), x1: cx(m.to), y1: cy(m.to) })).filter(o => o.v);
      items.forEach(o => { o.v.mv = true; });
      await tween(320, k => { for (const o of items) { o.v.x = o.x0 + (mx - o.x0) * k * 0.85; o.v.y = o.y0 + (my - o.y0) * k * 0.85; o.v.s = 1 - k * 0.4; } }, E.io);
      sync();
      await tween(380, k => { for (const o of items) { const sx = o.x0 + (mx - o.x0) * 0.85, sy = o.y0 + (my - o.y0) * 0.85; o.v.x = sx + (o.x1 - sx) * k; o.v.y = sy + (o.y1 - sy) * k; o.v.s = 0.6 + k * 0.4; } }, E.back);
      items.forEach(o => { o.v.mv = false; o.v.x = o.x1; o.v.y = o.y1; o.v.s = 1; });
      burst(mx, my, -3, 20, { speed: 260 });
    }

    // ---------- 一次完整的連鎖（含動畫） ----------
    async function chain(first) {
      let ctx = { cascade: 1, swap: first.swap, combo: first.combo, hammer: first.hammer, fire: first.fire }, combo = 0, praised = 0;
      if (first.combo) praise(first.combo.type === 'cc' || first.combo.type === 'cw' ? 4 : 2, true);
      for (let guard = 0; guard < 80 && !dead; guard++) {
        const ev = Core.resolve(S, ctx);
        if (ev) {
          combo = ctx.cascade;
          await playStep(ev);
          const lv = PRAISE.filter(([n]) => combo >= n).length;
          if (lv > praised) { praised = lv; praise(lv); }
        }
        const mv = Core.gravity(S);
        await playFall(mv);
        const bags = Core.collectBags(S);
        if (bags.length) { await playBags(bags); await playFall(Core.gravity(S)); }
        if (!ev && !bags.length) break;
        ctx = { cascade: ctx.cascade + (ev ? 1 : 0) };
      }
      sync();
      maxCombo = Math.max(maxCombo, combo);
      hudUI();
      return combo;
    }
    function praise(lv, special) {
      if (lv <= 0) return;
      const word = PRAISE[Math.min(PRAISE.length, lv) - 1][1];
      const el = document.createElement('div');
      el.className = 'm3-praise p' + lv;
      el.textContent = word;
      $('.m3-gfx').appendChild(el);
      setTimeout(() => el.remove(), 1300);
      sfx.praise(lv); vib(lv >= 3 ? [20, 40, 30] : 15);
      if (lv >= 3) { setHost('joy'); if (!special || lv >= 4) say(pick(LINES.combo), 'joy', 1800); }
      if (lv >= 4 && !REDUCED) api.fx.burst(innerWidth / 2, innerHeight * 0.4, 30, ['confetti', 'spark', 'heart']);
    }

    // ---------- 目標與 HUD ----------
    const goalKey = gl => (gl.t === 'col' ? 'c' + gl.c : gl.t === 'ribbon' ? 'rib' : gl.t === 'ice' ? 'ice' : gl.t === 'bag' ? 'bag' : 'score');
    function goalText(gl) {
      if (gl.t === 'col') return `收集${ITEMS[gl.c].name} ×${gl.n}`;
      if (gl.t === 'ribbon') return '清除所有緞帶格';
      if (gl.t === 'ice') return '敲碎所有冰塊';
      if (gl.t === 'bag') return `把名牌包裹送到底 ×${gl.n}`;
      return `拿到 ${fmt(gl.n)} 分`;
    }
    function goalIcon(gl) { const k = goalKey(gl); return k === 'score' ? '' : `<img src="${Art3.iconURL(k)}" alt="">`; }
    function buildGoals() {
      $('[data-goals]').innerHTML = L.goals.map((gl, k) => gl.t === 'score'
        ? `<div class="m3-goal score" data-g="${k}"><span class="m3-gs">${STAR}</span><div><small>目標分數</small><b class="num">${fmt(gl.n)}</b></div></div>`
        : `<div class="m3-goal" data-g="${k}" data-key="${goalKey(gl)}">${goalIcon(gl)}<b class="num"></b><i class="ok" aria-hidden="true"></i></div>`).join('');
      $('[data-goals]').dataset.n = L.goals.length;
    }
    function hudUI() {
      if (!S) return;
      const mvEl = $('[data-moves]');
      mvEl.textContent = movesLeft;
      $('.m3-moves').classList.toggle('low', movesLeft <= 5 && !over);
      L.goals.forEach((gl, k) => {
        if (gl.t === 'score') return;
        const q = Core.progress(S, gl), el = $(`[data-g="${k}"]`); if (!el) return;
        const left = Math.max(0, q.need - q.have), done = left <= 0;
        el.querySelector('b').textContent = done ? '' : left;
        el.classList.toggle('done', done);
      });
    }
    function scoreUI() {
      const s = Math.round(shownScore);
      $('[data-score]').textContent = fmt(s);
      const top = L.stars[2] || 1;
      $('[data-bar]').style.width = Math.min(100, (s / top) * 100) + '%';
      let k = 0; for (let j = 0; j < 3; j++) if (s >= (L.stars[j] || 0) && (j > 0 || L.stars[0] > 0)) k = j + 1;
      if (L.stars[0] === 0 && s < L.stars[1]) k = 0;
      if (k > starShown) {
        for (let j = starShown + 1; j <= k; j++) { const el = $(`[data-mk="${j}"]`); if (el) { el.classList.add('on'); sfx.star(j - 1); } }
        starShown = k;
      }
    }
    function bumpGoal(key) { const el = root.querySelector(`.m3-goal[data-key="${key}"]`); if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    let flyCount = 0;
    function goalFly(p, x, y) {
      const key = p.k === 'b' ? 'bag' : p.c >= 0 ? 'c' + p.c : null;
      if (!key) return;
      const gi = L.goals.findIndex(gl => goalKey(gl) === key);
      if (gi < 0) return;
      const el = $(`[data-g="${gi}"]`);
      if (!el) return;
      if (flyCount > 10) { bumpGoal(key); return; }
      const box = $('.m3-game').getBoundingClientRect(), cvb = cv.getBoundingClientRect(), tb = el.getBoundingClientRect();
      const fx = cvb.left - box.left + x, fy = cvb.top - box.top + y, tx = tb.left - box.left + 18, ty = tb.top - box.top + tb.height / 2;
      const img = document.createElement('img');
      img.className = 'm3-flyer'; img.src = Art3.iconURL(key); img.alt = '';
      img.style.left = fx + 'px'; img.style.top = fy + 'px'; img.style.width = img.style.height = cs + 'px';
      $('.m3-gfx').appendChild(img);
      flyCount++;
      const done = () => { img.remove(); flyCount--; bumpGoal(key); };
      if (REDUCED || !img.animate) { setTimeout(done, 50); return; }
      const dx = tx - fx, dy = ty - fy;
      const an = img.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${dx * 0.25 - 30}px), calc(-50% + ${dy * 0.25 - 40}px)) scale(1.2)`, opacity: 1, offset: 0.3 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.5)`, opacity: 0.9 }], { duration: 620, easing: 'cubic-bezier(.5,0,.6,1)' });
      an.onfinish = done; an.oncancel = done;
    }

    // ---------- 主持人薇薇 ----------
    let sayTimer = 0;
    function setHost(expr) { const img = $('[data-host]'); const src = vivi.face(expr); if (img.getAttribute('src') !== src) img.src = src; img.classList.remove('hop'); void img.offsetWidth; img.classList.add('hop'); }
    function say(text, expr = 'neutral', ms = 2600) {
      const b = $('[data-say]');
      b.textContent = text; b.hidden = false;
      b.classList.remove('in'); void b.offsetWidth; b.classList.add('in');
      setHost(expr);
      clearTimeout(sayTimer);
      sayTimer = setTimeout(() => { b.hidden = true; if (!over) setHost('neutral'); }, ms);
    }

    // ---------- 開局 ----------
    function levelOf(n, daily) {
      if (!daily) return Levels.build(n);
      const k = dayKey();
      let h = 2166136261;
      for (const ch of k) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
      h >>>= 0;
      const t = 10 + (h % (Levels.COUNT - 10));
      const Lv = Levels.build(t);
      Lv.daily = true; Lv.tpl = t; Lv.seed = h | 0;
      return Lv;
    }
    async function startLevel(n, daily) {
      closeCard();
      L = levelOf(n, daily);
      S = Core.create(L.def, daily ? L.seed : (Math.random() * 2 ** 31) | 0);
      movesLeft = L.moves + perkMoves(); used = 0; over = false; busy = true; sel = -1; hintPair = null; idle = 0; hammerMode = false; auto = 0; maxCombo = 0; lowWarned = false;
      shownScore = 0; starShown = 0; ribShow = S.ribbon.slice(); hasExits = !!L.def.bags;
      vis.clear(); fxs.length = 0; parts.length = 0; texts.length = 0;
      st().plays++;
      evt('m3_play');
      const gm = $('.m3-game');
      gm.dataset.f = L.floor;
      $('[data-gfloor]').textContent = `${L.floor + 1}F`;
      $('[data-fs-n]').textContent = `${L.floor + 1}F`;
      $('[data-fs-t]').textContent = L.daily ? `每日挑戰・${FLOORS[L.floor].name}` : `${FLOORS[L.floor].name}・${FLOORS[L.floor].en}`;
      $('[data-lvname]').textContent = L.daily ? '每日挑戰' : `第 ${L.n + 1} 關`;
      $$('.m3-bar .mk').forEach((el, j) => { el.classList.remove('on'); el.style.left = `calc(${Math.min(100, ((L.stars[j] || 0) / (L.stars[2] || 1)) * 100)}% - 9px)`; el.hidden = j === 0 && !L.stars[0]; });
      buildGoals(); toolsUI(); $('[data-auto]').parentElement.hidden = true; $('.m3-hammer-tip').hidden = true;
      show('game');
      ov.setTitle(L.daily ? '每日挑戰' : `第 ${L.n + 1} 關`);
      await wait(30);
      layout();
      sync();
      hudUI(); scoreUI();
      // 開場：精品一排一排落下
      const delay = REDUCED ? 0 : 26;
      for (const v of vis.values()) {
        const r = (v.i / S.w) | 0, c = v.i % S.w, y1 = v.y, y0 = BY - cs * (S.h - r + 1);
        v.y = y0; v.mv = true;
        const d = (S.h - r) * delay + c * 9;
        later(d, () => { v.fall = { y0, y1, t0: clock, dur: 330 + r * 22, land: r === S.h - 1 }; });
      }
      if (boostBomb) {
        boostBomb = false;
        const i = Core.placeSpecial(S, 'c');
        sync();
        if (i >= 0) later(900, () => { const v = vis.get(S.cells[i].id); if (v) { v.flash = 1; tween(400, k => { v.flash = 1 - k; v.s = 1 + Math.sin(k * Math.PI) * 0.3; }); burst(v.x, v.y, -1, 20, { speed: 220 }); sfx.make(); } });
      }
      if (fashionOn()) {
        const i = Core.placeSpecial(S, Math.random() < 0.5 ? 'h' : 'v');
        sync();
        if (i >= 0) later(1000, () => { const v = vis.get(S.cells[i].id); if (v) { v.flash = 1; tween(420, k => { v.flash = 1 - k; v.s = 1 + Math.sin(k * Math.PI) * 0.3; }); burst(v.x, v.y, S.cells[i].c, 16, { speed: 200 }); floatText(v.x, v.y - cs * 0.4, '時尚加成', 14, '#ffe08a', 1400); sfx.make(); } });
      }
      await wait(S.h * delay + 650);
      await banner(L.daily ? '每日挑戰' : `第 ${L.n + 1} 關`, L.goals.map(goalText).join('・'), 1300);
      const special = L.goals.find(gl => GOAL_TIP[gl.t] && !st().tut['g_' + gl.t]);
      if (special) { st().tut['g_' + special.t] = 1; say(GOAL_TIP[special.t], 'joy', 4800); }
      else say(pick(LINES.start), 'joy', 2400);
      busy = false; idle = 0; toolsUI();
      if (!st().tut.basic) tutorial();
      api.save();
    }

    // ---------- 教學 ----------
    let tutEl = null;
    function tutorial() {
      const m = Core.bestMove(S, L.goals);
      if (!m) return;
      const box = $('.m3-game').getBoundingClientRect(), cvb = cv.getBoundingClientRect();
      const ox = cvb.left - box.left, oy = cvb.top - box.top, up = ((m.a / S.w) | 0) >= S.h / 2;
      tutEl = document.createElement('div');
      tutEl.className = 'm3-tut';
      tutEl.innerHTML = `<div class="m3-tut-hand" style="left:${ox + cx(m.a)}px;top:${oy + cy(m.a)}px;--dx:${cx(m.b) - cx(m.a)}px;--dy:${cy(m.b) - cy(m.a)}px"><svg viewBox="0 0 40 48" aria-hidden="true"><path d="M14 22V8a3.4 3.4 0 0 1 6.8 0v11l1-.1a3.3 3.3 0 0 1 6.4.6l.2.3a3.2 3.2 0 0 1 5.4 1.6c2.3-.5 4.2 1 4.2 3.4V33c0 7-5 12-11.6 12H24c-4.4 0-7.4-2-9.5-5.4l-6.6-10.4a3.2 3.2 0 0 1 4.8-4.2z" fill="#fff" stroke="#7a1f45" stroke-width="2.2" stroke-linejoin="round"/></svg></div>
        <div class="m3-tut-tip${up ? ' above' : ''}" style="top:${oy + (up ? Math.min(cy(m.a), cy(m.b)) - cs * 0.8 : Math.max(cy(m.a), cy(m.b)) + cs * 0.8)}px"><b>新手教學</b>把精品往旁邊滑，讓三個一樣的排成一排就會消除！</div>`;
      $('.m3-gfx').appendChild(tutEl);
      hintPair = m; hintT = clock;
    }
    function endTutorial() { if (tutEl) { tutEl.remove(); tutEl = null; st().tut.basic = 1; } }

    // ---------- 輸入 ----------
    let down = null;
    const cellAt = (x, y) => { const c = Math.floor((x - BX) / cs), r = Math.floor((y - BY) / cs); if (c < 0 || r < 0 || c >= S.w || r >= S.h) return -1; const i = r * S.w + c; return S.mask[i] ? i : -1; };
    const evXY = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.addEventListener('pointerdown', e => {
      if (!S || view !== 'game') return;
      e.preventDefault();
      idle = 0; if (hintPair && !tutEl) hintPair = null;
      api.sound.click && 0;
      if (busy || over || auto || cardOpen) return;
      const [x, y] = evXY(e), i = cellAt(x, y);
      if (i < 0) { sel = -1; return; }
      if (hammerMode) { useHammer(i); return; }
      down = { i, x, y, id: e.pointerId, moved: false };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 不支援 */ }
    });
    cv.addEventListener('pointermove', e => {
      if (!down || e.pointerId !== down.id || down.moved) return;
      const [x, y] = evXY(e), dx = x - down.x, dy = y - down.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < cs * 0.32) return;
      down.moved = true;
      const a = down.i, r = (a / S.w) | 0, c = a % S.w;
      let b = -1;
      if (Math.abs(dx) > Math.abs(dy)) { const c2 = c + (dx > 0 ? 1 : -1); if (c2 >= 0 && c2 < S.w) b = a + (dx > 0 ? 1 : -1); }
      else { const r2 = r + (dy > 0 ? 1 : -1); if (r2 >= 0 && r2 < S.h) b = a + (dy > 0 ? S.w : -S.w); }
      sel = -1;
      if (b >= 0 && S.mask[b]) attemptSwap(a, b);
    });
    const up = e => {
      if (!down || e.pointerId !== down.id) return;
      const d = down; down = null;
      if (d.moved || busy || over) return;
      const i = d.i;
      if (sel < 0) { if (S.cells[i]) { sel = i; sfx.select(); } }
      else if (sel === i) sel = -1;
      else if (Core.adjacent(S, sel, i)) { const a = sel; sel = -1; attemptSwap(a, i); }
      else { sel = S.cells[i] ? i : -1; if (sel >= 0) sfx.select(); }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', () => { down = null; });
    cv.addEventListener('contextmenu', e => e.preventDefault());

    async function attemptSwap(a, b) {
      if (busy || over || !S.cells[a] || !S.cells[b]) return;
      hintPair = null; idle = 0;
      if (!Core.swappable(S.cells[a]) || !Core.swappable(S.cells[b])) {
        sfx.bad();
        const v = vis.get(S.cells[Core.swappable(S.cells[a]) ? b : a].id);
        if (v) { const x0 = v.x; tween(260, k => { v.x = x0 + Math.sin(k * Math.PI * 4) * (1 - k) * cs * 0.1; }); }
        return;
      }
      if (!Core.checkSwap(S, a, b)) { busy = true; await animSwap(a, b, true); busy = false; return; }
      await doMove(a, b);
    }
    async function doMove(a, b) {
      busy = true; endTutorial();
      sfx.swap();
      await animSwap(a, b, false);
      const sw = Core.applySwap(S, a, b);
      if (!sw) { busy = false; return; }
      sync();
      movesLeft--; used++;
      hudUI();
      vib(8);
      await chain(sw);
      busy = false;
      await afterMove();
    }
    async function afterMove() {
      if (over || dead) return;
      const early = L.goals.some(gl => gl.t !== 'score');
      if (early && Core.goalsDone(S, L.goals)) { await win(); return; }
      if (movesLeft <= 0) {
        if (!early && Core.goalsDone(S, L.goals)) { await win(); return; }
        await outOfMoves(); return;
      }
      if (!Core.hasMove(S)) {
        busy = true;
        await banner('沒有可以消的了', '幫妳重新洗牌！', 1000);
        await playShuffle(Core.shuffle(S));
        await chain({});
        busy = false;
      }
      if (movesLeft <= 5 && !lowWarned) { lowWarned = true; say(`只剩 ${movesLeft} 步了，穩住～`, 'angry', 2200); }
      toolsUI();
      idle = 0;
      if (auto > 0) autoLoop();
    }

    // ---------- 提示（停 4 秒免費閃一步） ----------
    function showHint() {
      idle = 0;
      const m = Core.bestMove(S, L.goals);
      if (!m) return;
      hintPair = m; hintT = clock;
    }

    // ---------- 粉鑽換腦力 ----------
    function toolsUI() {
      $$('.m3-tool').forEach(el => {
        const t = el.dataset.tool, p = PRICE[t];
        const sm = el.querySelector('[data-price]');
        const html = el.dataset.confirm ? '再按確認' : t === 'hammer' && hammerMode ? '取消' : `${GEM}${p}`;
        if (sm._h !== html) { sm.innerHTML = html; sm._h = html; }
        el.classList.toggle('off', !S || over || (busy && !(t === 'hammer' && hammerMode)) || auto > 0);
        el.classList.toggle('active', t === 'hammer' && hammerMode);
      });
    }
    function tool(el) {
      const t = el.dataset.tool;
      if (!S || over || auto > 0) return;
      if (t === 'hammer' && hammerMode) { setHammer(false); return; }
      if (busy) return;
      api.twoTap(el, () => {
        if (t === 'hammer') { if (api.gems < PRICE.hammer) { api.spendGems(PRICE.hammer); return; } setHammer(true); return; }
        if (!api.spendGems(PRICE[t])) return;
        sfx.buy();
        if (t === 'shuffle') { (async () => { busy = true; toolsUI(); await playShuffle(Core.shuffle(S)); await chain({}); busy = false; toolsUI(); })(); }
        else if (t === 'plus5') { movesLeft += 5; hudUI(); const el2 = $('.m3-moves'); el2.classList.remove('bump'); void el2.offsetWidth; el2.classList.add('bump'); say('多了 5 步，慢慢來～', 'joy', 1800); }
        else if (t === 'auto') { auto = 5; autoUI(); say('交給史利秘書吧！', 'joy', 1800); autoLoop(); }
        toolsUI();
      }, toolsUI);
    }
    function setHammer(on) { hammerMode = on; $('.m3-hammer-tip').hidden = !on; $('.m3-game').classList.toggle('hammer', on); sel = -1; toolsUI(); }
    async function useHammer(i) {
      const p = S.cells[i];
      if (!p) return;
      if (p.k === 'b') { api.toast('名牌包裹敲不動喔，要把它往下送'); sfx.bad(); return; }
      if (!api.spendGems(PRICE.hammer)) { setHammer(false); return; }
      setHammer(false);
      busy = true; toolsUI();
      hammerFx = { x: cx(i), y: cy(i), t0: clock };
      await wait(260);
      sfx.hammer(); shakeAmt = 10; vib(30);
      burst(cx(i), cy(i), p.c, 14, { speed: 240 });
      await wait(60);
      hammerFx = null;
      await chain({ hammer: i });
      busy = false;
      await afterMove();
    }
    function autoUI() { const el = $('.m3-auto'); el.hidden = auto <= 0; $('[data-auto]').textContent = `史利秘書代玩中…剩 ${auto} 步`; toolsUI(); }
    let autoRunning = false;
    async function autoLoop() {
      if (autoRunning) return;
      autoRunning = true;
      try {
        while (auto > 0 && !over && !dead && view === 'game') {
          await wait(320);
          if (busy) continue;
          const m = Core.bestMove(S, L.goals);
          if (!m) break;
          hintPair = m; hintT = clock;
          await wait(420);
          hintPair = null;
          auto--; autoUI();
          await doMove(m.a, m.b);
        }
      } finally { autoRunning = false; if (auto <= 0 || over) { auto = 0; autoUI(); } }
    }

    // ---------- 字卡橫幅 ----------
    function banner(title, sub, ms = 1200) {
      const el = document.createElement('div');
      el.className = 'm3-banner';
      el.innerHTML = `<div class="m3-bn-in"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
      $('.m3-gfx').appendChild(el);
      setTimeout(() => el.remove(), ms + 400);
      return wait(ms);
    }

    // ---------- 過關 / 失敗 ----------
    async function win() {
      over = true; busy = true; toolsUI(); auto = 0; autoUI(); hintPair = null;
      setHost('joy');
      sfx.win();
      if (!REDUCED) api.fx.rain('confetti', 50, $('.m3-board').getBoundingClientRect());
      await banner('目標達成！', '太會買了！', 1200);
      if (movesLeft > 0) {
        await banner('瘋狂購物時間！', `剩下 ${movesLeft} 步變成條紋精品`, 1100);
        while (movesLeft > 0 && !dead) {
          const list = Core.bonusConvert(S, 1);
          movesLeft--; hudUI();
          if (!list.length) break;
          const i = list[0], v = vis.get(S.cells[i].id);
          sfx.tick();
          if (v) { v.k = S.cells[i].k; v.flash = 1; tween(240, k => { v.flash = 1 - k; v.s = 1 + Math.sin(k * Math.PI) * 0.35; }); burst(v.x, v.y, S.cells[i].c, 8, { speed: 140 }); floatText(v.x, v.y - cs * 0.2, '+500', 14, '#ffe08a'); }
          await wait(REDUCED ? 40 : 110);
        }
        for (let k = 0; k < 6 && !dead; k++) {
          const sp = Core.specials(S);
          if (!sp.length) break;
          await chain({ fire: sp });
        }
      }
      if (dead) return;
      await wait(300);
      finish(true);
    }
    async function outOfMoves() {
      busy = true; toolsUI(); auto = 0; autoUI();
      setHost('sad');
      sfx.lose();
      openCard(`<div class="m3-card m3-oom">
        <div class="m3-ribbon"><span>步數用完了</span></div>
        <div class="m3-oom-host"><img src="${vivi.face('sad')}" alt=""><p>${pick(LINES.oom)}</p></div>
        <div class="m3-oom-goals">${L.goals.map(gl => { const q = Core.progress(S, gl); const left = Math.max(0, q.need - q.have); return `<div class="${left ? '' : 'done'}">${goalIcon(gl) || STAR}<span>${goalText(gl)}</span><b class="num">${gl.t === 'score' ? fmt(q.have) + ' / ' + fmt(q.need) : left ? '還差 ' + left : '完成'}</b></div>`; }).join('')}</div>
        <div class="m3-acts"><button class="btn ghost" data-act="giveup">放棄</button><button class="btn gemb" data-act="revive">+5 步繼續<small>${GEM}${PRICE.revive}</small></button></div>
      </div>`, { noClose: true });
    }
    function revive(btn) {
      api.twoTap(btn, () => {
        if (!api.spendGems(PRICE.revive)) return;
        sfx.buy(); closeCard();
        movesLeft += 5; lowWarned = false; busy = false; hudUI(); toolsUI(); setHost('joy'); say('再拚 5 步！加油～', 'joy', 2000);
      }, () => { const sm = btn.querySelector('small'); sm.innerHTML = btn.dataset.confirm ? '再按一次確認' : `${GEM}${PRICE.revive}`; });
    }
    function giveUp() { closeCard(); over = true; loseHeart(); finish(false); }

    function finish(won) {
      const o = st();
      over = true; busy = true;
      const n = L.n, daily = !!L.daily;
      const stars = won ? 1 + (S.score >= L.stars[1] ? 1 : 0) + (S.score >= L.stars[2] ? 1 : 0) : 0;
      o.combo = Math.max(o.combo || 0, maxCombo);
      let coins = 0, gems = 0, newBest = false, firstClear = false, silk = 0, hero = null;
      if (won) {
        o.clears++;
        api.stat('m3_clear');
        evt('m3_clear', { stars });
        const coef = daily ? 8 : 2 + 0.2 * (n + 1);
        coins = Math.round(api.betUnit() * Math.max(1, stars) * coef);
        if (daily) {
          if (o.daily.d !== dayKey()) { o.daily = { d: dayKey(), done: 1, best: S.score }; gems = 5; }
          else { o.daily.best = Math.max(o.daily.best || 0, S.score); coins = Math.round(coins * 0.3); }
        } else {
          firstClear = !(o.stars[n] > 0);
          if (S.score > (o.best[n] || 0)) { newBest = !!o.best[n]; o.best[n] = S.score; }
          o.stars[n] = Math.max(o.stars[n] || 0, stars);
          if (firstClear && (n + 1) % 5 === 0) gems = (n + 1) % 10 === 0 ? 20 : 10;
          if (firstClear && (n + 1) % 3 === 0) hero = pick(cast);
          o.lv = Math.max(o.lv, Math.min(Levels.COUNT, n + 1));
        }
        if (daily && gems) hero = pick(cast);
        const ru = resUnit();
        if (ru > 0 && has('grant')) silk = Math.round(ru * (0.5 + stars * 0.3));
        pending = { coins };
        if (gems) pending.gems = gems;
        if (silk) pending.res = { silk };
        if (hero && has('grant')) pending.shards = { [hero.id]: 1 }; else hero = null;
      }
      api.save();
      setHost(won ? 'joy' : 'sad');
      const actions = won
        ? `<button class="btn ghost" data-act="tomap">${daily ? '回大廳' : '地圖'}</button><button class="btn" data-act="retry">再玩一次</button>${!daily && n + 1 < Levels.COUNT ? '<button class="btn goldb" data-act="next">下一關</button>' : ''}`
        : `<button class="btn ghost" data-act="tomap">${daily ? '回大廳' : '地圖'}</button><button class="btn goldb" data-act="retry">再試一次<small>${HEART} ${hearts()}/${MAXH}</small></button>`;
      openCard(`<div class="m3-card m3-result ${won ? 'win' : 'lose'}">
        ${won ? '<div class="m3-res-rays" aria-hidden="true"></div>' : ''}
        <div class="m3-ribbon big"><span>${won ? (stars === 3 ? '完美過關！' : '過關！') : '差一點點…'}</span></div>
        <div class="m3-res-lv">${daily ? '每日挑戰' : `第 ${n + 1} 關・${FLOORS[L.floor].name}`}</div>
        <div class="m3-res-stars">${[1, 2, 3].map(j => `<i class="${won && j <= stars ? 'get' : ''}" style="--d:${j}">${STAR}</i>`).join('')}</div>
        <div class="m3-res-score"><small>本關分數</small><b class="num" data-rs>0</b>${newBest ? '<em>新紀錄！</em>' : ''}</div>
        ${won ? `<div class="m3-res-rows"><div class="m3-rw" data-rw="coin">${COIN}<span>${daily ? '每日挑戰獎金' : '過關獎金'}</span><b class="num" data-rc>0</b></div>${silk ? `<div class="m3-rw silk">${SILK}<span>王國絲綢</span><b class="num">+${fmt(silk)}</b></div>` : ''}${hero ? `<div class="m3-rw hero"><img src="${hero.face('joy')}" alt=""><span>${hero.name}英雄碎片</span><b class="num">×1</b></div>` : ''}${gems ? `<div class="m3-rw gem" data-rw="gem">${GEM}<span>${daily ? '今日首通粉鑽' : `${n + 1} 關紀念粉鑽`}</span><b class="num">+${gems}</b></div>` : ''}</div>`
          : `<div class="m3-res-lose">${L.goals.map(gl => { const q = Core.progress(S, gl); const left = Math.max(0, q.need - q.have); return `<span>${goalIcon(gl) || STAR}${gl.t === 'score' ? `差 ${fmt(Math.max(0, q.need - q.have))} 分` : left ? `還差 ${left}` : '完成'}</span>`; }).join('')}<p>${HEART} 扣 1 顆愛心，剩 ${hearts()} 顆</p></div>`}
        <div class="m3-res-host"><img src="${vivi.face(won ? 'joy' : 'sad')}" alt=""><p>${pick(won ? LINES.win : LINES.lose)}</p></div>
        <div class="m3-acts">${actions}</div>
      </div>`, { noClose: true });
      // 依序演出：星星落下 → 分數跳動 → 獎勵
      const card = $('.m3-result');
      if (won) {
        for (let j = 1; j <= stars; j++) later(450 + j * 380, () => { sfx.star(j - 1); vib(15); const el = card.querySelectorAll('.m3-res-stars i')[j - 1]; if (el) { const b = el.getBoundingClientRect(); api.fx.burst(b.left + b.width / 2, b.top + b.height / 2, 14, ['spark', 'confetti']); } });
      } else sfx.lose();
      const sc = S.score, rs = card.querySelector('[data-rs]');
      tween(900, k => { rs.textContent = fmt(Math.round(sc * k)); }, E.out);
      if (won) {
        const rc = card.querySelector('[data-rc]');
        later(450 + stars * 380 + 200, () => {
          sfx.drum();
          tween(800, k => { rc.textContent = '+' + fmt(Math.round(coins * k)); }).then(() => {
            const b = rc.getBoundingClientRect();
            claimReward(b.left + b.width / 2, b.top + b.height / 2);
            api.sound.cash();
            card.querySelectorAll('.m3-rw').forEach((el, k) => setTimeout(() => el.classList.add('in'), k * 120));
          });
        });
      }
    }

    // ---------- 卡片層（開局卡、結算、步數用完…） ----------
    let cardClose = null;
    function openCard(html, o = {}) {
      closeCard();
      const layer = $('.m3-layer');
      layer.innerHTML = `<div class="m3-cardwrap">${html}</div>`;
      layer.classList.add('on');
      cardOpen = true;
      cardClose = o.noClose ? null : () => closeCard();
      layer.onclick = e => { if (e.target === layer.firstElementChild && cardClose) { sfx.click(); cardClose(); } };
    }
    function closeCard() { const layer = $('.m3-layer'); layer.classList.remove('on'); layer.innerHTML = ''; cardOpen = false; cardClose = null; }

    function introCard(n, daily) {
      const Lv = levelOf(n, daily), o = st();
      const got = daily ? 0 : o.stars[n] || 0;
      const done = daily && o.daily.d === dayKey();
      openCard(`<div class="m3-card m3-intro" data-f="${Lv.floor}">
        <div class="m3-ribbon"><span>${daily ? '每日挑戰' : `第 ${n + 1} 關`}</span></div>
        <div class="m3-ic-floor">${Lv.floor + 1}F ${FLOORS[Lv.floor].name}<em>${FLOORS[Lv.floor].en}</em>${Lv.boss && !daily ? '<i class="m3-boss">VIP 關</i>' : ''}</div>
        <div class="m3-ic-stars">${[1, 2, 3].map(j => `<i class="${j <= got ? 'get' : ''}">${STAR}</i>`).join('')}</div>
        <div class="m3-ic-goals">${Lv.goals.map(gl => `<div class="m3-ic-goal">${goalIcon(gl) || `<span class="m3-gs">${STAR}</span>`}<span>${goalText(gl)}</span></div>`).join('')}</div>
        <div class="m3-ic-row"><span>步數 <b class="num">${Lv.moves + perkMoves()}</b>${perkMoves() ? `<em>含王國研究 +${perkMoves()}</em>` : ''}</span><span>${STAR}${STAR} <b class="num">${fmt(Lv.stars[1])}</b></span><span>${STAR}${STAR}${STAR} <b class="num">${fmt(Lv.stars[2])}</b></span></div>
        ${daily ? `<p class="m3-ic-tip">${done ? '今天已經領過首通獎勵囉，可以繼續挑戰高分！' : `今日首次過關送 ${GEM}5 粉鑽＋大筆獎金！`}</p>` : (o.best[n] ? `<p class="m3-ic-tip">最高分 ${fmt(o.best[n])}</p>` : '')}
        <p class="m3-ic-perk ${fashionOn() ? 'on' : ''}">${fashionOn() ? '時尚加成生效：開局送一個條紋精品' : '衣櫥時尚加成 +300% 起，開局會送條紋精品'}</p>
        <button class="m3-boost ${boostBomb ? 'on' : ''}" data-act="boostbomb"><img src="${Art3.iconURL('bomb')}" alt=""><span><b>開局帶粉鑽</b><small>盤面上直接出現一顆彩色炸彈</small></span><em data-bp>${boostBomb ? '已準備' : `${GEM}${PRICE.bomb}`}</em></button>
        <div class="m3-acts"><button class="btn ghost" data-act="cardclose">再看看</button><button class="btn goldb" data-act="play" data-n="${n}" data-daily="${daily ? 1 : 0}">開始！<small>${HEART} ${hearts()}/${MAXH}</small></button></div>
      </div>`);
    }
    function tryPlay(n, daily) {
      if (hearts() <= 0) { heartsCard(); return; }
      sfx.click();
      startLevel(n, daily);
    }
    function heartsCard() {
      openCard(`<div class="m3-card m3-hcard">
        <div class="m3-ribbon"><span>愛心用完了</span></div>
        <div class="m3-hbig">${HEART}<b class="num">0</b></div>
        <p>每 20 分鐘會回 1 顆愛心，下一顆還要 <b class="num" data-hn>${clockStr(nextHeart())}</b></p>
        <div class="m3-acts"><button class="btn ghost" data-act="cardclose">等等再來</button><button class="btn gemb" data-act="refill">補滿愛心<small>${GEM}${PRICE.hearts}</small></button></div>
      </div>`);
    }
    function refill(btn) {
      api.twoTap(btn, () => {
        if (!api.spendGems(PRICE.hearts)) return;
        const o = st(); o.hearts = MAXH; o.heartT = Date.now(); api.save();
        sfx.buy(); api.toast('愛心補滿了！', 'gold'); closeCard(); renderHearts();
      }, () => { const sm = btn.querySelector('small'); if (sm) sm.innerHTML = btn.dataset.confirm ? '再按一次確認' : `${GEM}${PRICE.hearts}`; });
    }

    // ---------- 標題畫面 ----------
    function renderHearts() {
      const h = hearts();
      const html = `<span class="m3-hrow">${Array.from({ length: MAXH }, (_, i) => `<i class="${i < h ? 'on' : ''}">${HEART}</i>`).join('')}</span><span class="m3-htime num">${h >= MAXH ? '愛心已滿' : '下一顆 ' + clockStr(nextHeart())}</span>${h < MAXH ? `<button class="m3-hbuy" data-act="refill">補滿<small>${GEM}${PRICE.hearts}</small></button>` : ''}`;
      $$('[data-hearts]').forEach(el => { if (el._h !== html && !el.querySelector('.confirm')) { el.innerHTML = html; el._h = html; } });
      const hn = root.querySelector('[data-hn]'); if (hn) hn.textContent = clockStr(nextHeart());
    }
    function refreshTitle() {
      const o = st(), cur = Math.min(o.lv, Levels.COUNT - 1), Lv = Levels.build(cur);
      renderHearts();
      $$('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
      root.querySelector('[data-mode="daily"] .m3-dot').hidden = o.daily.d === dayKey();
      if (mode === 'tour') {
        $('[data-go-t]').textContent = o.lv >= Levels.COUNT ? '再逛一次' : o.lv ? '繼續血拼' : '開始血拼';
        $('[data-go-s]').textContent = o.lv >= Levels.COUNT ? '六層樓全部制霸！' : `第 ${cur + 1} 關・${Lv.floor + 1}F ${FLOORS[Lv.floor].name}`;
      } else {
        $('[data-go-t]').textContent = '挑戰今日精選';
        $('[data-go-s]').textContent = o.daily.d === dayKey() ? '今日已完成・可以刷新高分' : `首通送 5 粉鑽`;
      }
      const coin3 = Math.round(api.betUnit() * 3 * (2 + 0.2 * (cur + 1)));
      $('[data-rw]').innerHTML = `<p>${COIN}<b class="num">${fmt(coin3)}</b><small>本關三星</small></p><p>${GEM}<b class="num">10</b><small>每 5 關贈送</small></p>${has('grant') ? `<p>${SILK}<small>絲綢＋英雄碎片</small></p>` : ''}`;
      $('[data-rec]').innerHTML = `<p>${STAR}<b class="num">${totalStars()}</b><small>/ ${Levels.COUNT * 3}</small></p><p><b class="num">${Math.min(o.lv, Levels.COUNT)}</b><small>關已通過・最高 ${o.combo || 0} 連鎖</small></p>`;
      const sayEl = $('[data-tsay]');
      sayEl.textContent = o.lv === 0 ? '歡迎來到 ERIKA 百貨！三個一樣就能消除喔♪' : pick(LINES.title);
    }

    // ---------- 關卡地圖 ----------
    function buildMap() {
      const o = st(), N = Levels.COUNT, cur = Math.min(o.lv, N - 1);
      const sc = $('.m3-map-scroll'), inner = $('.m3-map-in');
      const W = sc.clientWidth || 390;
      const GAP = 88, ZH = 130, TOP = 170, BOT = 150;
      const H = TOP + BOT + (N - 1) * GAP + 6 * ZH;
      const ys = [], xs = [];
      for (let i = 0; i < N; i++) { ys[i] = H - BOT - i * GAP - Math.floor(i / 10) * ZH; xs[i] = 50 + 27 * Math.sin(i * 0.72 + 0.5); }
      const P = i => [(xs[i] / 100) * W, ys[i]];
      const pathTo = last => { let d = `M${P(0).join(',')}`; for (let i = 0; i < last; i++) { const p0 = P(Math.max(0, i - 1)), p1 = P(i), p2 = P(i + 1), p3 = P(Math.min(N - 1, i + 2)); d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`; } return d; };
      let zones = '';
      let bottom = H;
      for (let f = 0; f < 6; f++) {
        const top = f === 5 ? 0 : ys[f * 10 + 9] - GAP * 0.5 - ZH + 30;
        const deco = [0, 1, 2, 3, 4].map(k => { const side = k % 2 ? 'right' : 'left', y = 40 + ((k * 37 + f * 13) % 80) / 100 * (bottom - top - 120); return `<img src="${Art3.iconURL('c' + ((f + k) % 6))}" alt="" style="${side}:${4 + ((k * 7 + f * 3) % 8)}%;top:${y}px;--r:${(k % 2 ? 1 : -1) * (8 + k * 5)}deg;--d:${k * 0.6}s">`; }).join('');
        zones += `<div class="m3-zone z${f}" style="top:${top}px;height:${bottom - top}px"><div class="m3-plaque"><b>${f + 1}F</b><span>${FLOORS[f].name}</span><em>${FLOORS[f].en}</em></div><div class="m3-zdeco">${deco}</div></div>`;
        bottom = top;
      }
      let nodes = '';
      for (let i = 0; i < N; i++) {
        const sN = o.stars[i] || 0, lock = i > o.lv, isCur = i === cur && o.lv < N, boss = i % 10 === 9;
        nodes += `<button class="m3-node${lock ? ' lock' : sN ? ' done' : ''}${isCur ? ' cur' : ''}${boss ? ' boss' : ''}" data-node="${i}" style="left:${xs[i]}%;top:${ys[i]}px" aria-label="第 ${i + 1} 關${lock ? '（未解鎖）' : sN ? `，${sN} 星` : ''}">
          ${boss ? `<i class="m3-crown">${CROWN}</i>` : ''}<b class="num">${i + 1}</b>${!lock ? `<span class="m3-ns">${[1, 2, 3].map(j => `<i class="${j <= sN ? 'on' : ''}">${STAR}</i>`).join('')}</span>` : ''}
          ${isCur ? `<img class="m3-me" src="${vivi.face('joy')}" alt="">` : ''}</button>`;
      }
      inner.style.height = H + 'px';
      inner.innerHTML = `${zones}<svg class="m3-path" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <path d="${pathTo(N - 1)}" class="p0"/><path d="${pathTo(N - 1)}" class="p1"/><path d="${pathTo(Math.max(0, Math.min(o.lv, N - 1)))}" class="p2"/></svg>
        <div class="m3-roof">${CROWN}<b>ERIKA 百貨・頂樓</b><small>更多樓層裝潢中，敬請期待</small></div>${nodes}`;
      $('[data-mstars]').textContent = `${totalStars()} / ${N * 3}`;
      renderHearts();
      const target = Math.max(0, ys[cur] - sc.clientHeight * 0.62);
      const from = Math.min(H, target + (REDUCED ? 0 : 420));
      sc.scrollTop = from;
      tween(REDUCED ? 1 : 900, k => { sc.scrollTop = from + (target - from) * k; }, E.io);
    }

    // ---------- 返回鍵 ----------
    function onBack() {
      if (cardOpen && cardClose) { cardClose(); return false; }
      if (view === 'game') {
        if (root.querySelector('.m3-oom')) { giveUp(); return false; }
        if (over) { closeCard(); show(L && L.daily ? 'title' : 'map'); return false; }
        if (busy) return false;
        api.modal({
          title: '要離開這一關嗎？',
          body: `<p class="mb">${used > 0 ? '現在離開會算失敗，扣 1 顆愛心喔。' : '還沒有開始走，現在離開不會扣愛心。'}</p>`,
          actions: [{ label: '繼續玩', cls: 'ghost' }, { label: '離開', fn: close => { close(); if (used > 0) loseHeart(); over = true; closeCard(); show(L && L.daily ? 'title' : 'map'); } }],
        });
        return false;
      }
      if (view === 'map') { show('title'); return false; }
      return true;
    }

    // ---------- 點擊事件 ----------
    root.addEventListener('click', e => {
      const t = e.target;
      const node = t.closest('[data-node]');
      if (node) {
        const i = +node.dataset.node;
        if (i > st().lv) { api.shake(node); sfx.err(); api.toast(`先通過第 ${i} 關才能來這裡喔`); return; }
        sfx.click(); introCard(i, false); return;
      }
      const modeBtn = t.closest('[data-mode]');
      if (modeBtn) { mode = modeBtn.dataset.mode; sfx.click(); refreshTitle(); return; }
      const toolBtn = t.closest('[data-tool]');
      if (toolBtn) { tool(toolBtn); return; }
      const a = t.closest('[data-act]');
      if (!a) return;
      const act = a.dataset.act;
      if (act === 'go') {
        sfx.click();
        if (mode === 'daily') { introCard(0, true); return; }
        show('map');
        const o = st();
        if (o.lv < Levels.COUNT) later(REDUCED ? 50 : 950, () => { if (view === 'map' && !cardOpen) introCard(o.lv, false); });
      } else if (act === 'cardclose') { sfx.click(); closeCard(); }
      else if (act === 'play') tryPlay(+a.dataset.n, a.dataset.daily === '1');
      else if (act === 'boostbomb') {
        if (boostBomb) return;
        api.twoTap(a, () => { if (!api.spendGems(PRICE.bomb)) return; boostBomb = true; sfx.buy(); a.classList.add('on'); a.querySelector('[data-bp]').textContent = '已準備'; },
          () => { const em = a.querySelector('[data-bp]'); if (!boostBomb) em.innerHTML = a.dataset.confirm ? '再按確認' : `${GEM}${PRICE.bomb}`; });
      } else if (act === 'refill') refill(a);
      else if (act === 'revive') revive(a);
      else if (act === 'giveup') { sfx.click(); giveUp(); }
      else if (act === 'retry' || act === 'next' || act === 'tomap') claimReward();
      if (act === 'retry') { if (hearts() <= 0) { heartsCard(); return; } sfx.click(); const d = !!L.daily; introCard(d ? 0 : L.n, d); }
      else if (act === 'next') { sfx.click(); introCard(Math.min(Levels.COUNT - 1, L.n + 1), false); }
      else if (act === 'tomap') { sfx.click(); closeCard(); show(L && L.daily ? 'title' : 'map'); }
      else if (act === 'hammer-cancel') { sfx.click(); setHammer(false); }
    });

    // ---------- 關閉 ----------
    function cleanup() {
      claimReward();
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      clearTimeout(sayTimer);
      anims.length = 0; timers.length = 0; vis.clear();
      live = null;
    }
    live = { close: () => ov.close() };

    // ---------- 開場 ----------
    show('title');
    raf = requestAnimationFrame(frame);
    setTimeout(() => { const ld = $('.m3-loader'); if (ld) { ld.classList.add('out'); setTimeout(() => ld.remove(), 500); } }, REDUCED ? 100 : 650);
    window.ErikaMatch3.debug = { get S() { return S; }, get L() { return L; }, get view() { return view; }, start: (n, d) => startLevel(n, !!d), introCard, show, finish, win, outOfMoves, chain: f => chain(f), place: (i, k, c) => { S.cells[i] = { id: 9e6 + i, k, c: c ?? -1, ice: 0, armed: 0 }; sync(); }, swap: (a, b) => attemptSwap(a, b), hint: showHint, cell: (r, c) => r * S.w + c, xy: i => { const b = cv.getBoundingClientRect(); return [b.left + cx(i), b.top + cy(i)]; }, get busy() { return busy || cardOpen; }, idle: () => new Promise(r => { const f = () => (busy || dead ? setTimeout(f, 80) : r(true)); f(); }), get moves() { return movesLeft; }, set moves(v) { movesLeft = v; hudUI(); } };
  }

  window.ErikaMatch3 = { Core, Levels, Art: Art3, ITEMS };
  (window.ErikaGames = window.ErikaGames || []).push({
    id: 'match3', order: 1,
    name: '時尚消消樂', tagline: '三個一樣就消除・60 關精品挑戰',
    color: '#ff8fb5', color2: '#d6457a', badge: '新',
    art: api => `<img src="${api.cast()[1].full}" alt="" style="height:96%;left:50%;bottom:-6%;transform:translateX(-50%)">`,
    open,
  });
})();
