// 名媛之塔：消除盤
// 兩種玩法：swap＝三消（像 Candy Crush：交換相鄰兩顆、有特殊珠）；drag＝轉珠（像神魔之塔：拖曳 5 秒）
'use strict';

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

DT.Board = class {
  constructor(canvas, opts = {}) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.mode = opts.mode === 'drag' ? 'drag' : 'swap';
    this.cols = this.mode === 'swap' ? 7 : 6;
    this.rows = this.mode === 'swap' ? 6 : 5;
    this.grid = [];       // grid[r][c] = { t, sp(特殊：h 橫條 / v 直條 / w 包裝), ox, oy, a, s, dying }
    this.state = 'idle';  // idle | drag | resolve | locked
    this.moveTime = 5000;
    this.onResolve = opts.onResolve || (() => {});
    this.onCombo = opts.onCombo || (() => {});
    this.onMoveStart = opts.onMoveStart || (() => {});
    this.onTimer = opts.onTimer || (() => {});
    this.onSwap = opts.onSwap || (() => {});
    this.onShuffle = opts.onShuffle || (() => {});
    this.onBlast = opts.onBlast || (() => {});
    this.sel = null; this.hint = null; this.idleSince = performance.now();
    this.resize();
    this.fill();
    this.bind();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }
  destroy() { cancelAnimationFrame(this.raf); this.unbind && this.unbind(); }

  resize() {
    const w = this.cv.clientWidth || 360;
    this.cell = w / this.cols;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(this.cell * this.rows * dpr);
    this.cv.style.height = (this.cell * this.rows) + 'px';
    this.dpr = dpr;
    this.sprites = DT.makeOrbSprites(this.cell);
  }

  rand() {
    const types = DT.ORB_TYPES;
    return types[Math.floor(Math.random() * types.length)];
  }
  // 開局盤面不能自帶三連；三消模式還要保證有步可走
  fill() {
    for (let tries = 0; tries < 50; tries++) {
      for (let r = 0; r < this.rows; r++) {
        this.grid[r] = [];
        for (let c = 0; c < this.cols; c++) {
          let t;
          do { t = this.rand(); } while (
            (c >= 2 && this.grid[r][c - 1].t === t && this.grid[r][c - 2].t === t) ||
            (r >= 2 && this.grid[r - 1][c].t === t && this.grid[r - 2][c].t === t));
          this.grid[r][c] = { t, a: 1, s: 1 };
        }
      }
      if (this.mode === 'drag' || this.findMoves().length) break;
    }
  }
  refresh() {
    this.fill();
    this.each(o => { o.s = 0.2; o.a = 0; });
    this.clearHint();
  }
  // 技能：把某些珠轉色
  convert(fromList, to) {
    const from = Array.isArray(fromList) ? fromList : [fromList];
    let n = 0;
    this.each((o) => { if (from.includes(o.t)) { o.t = to; o.s = 1.5; n++; } });
    this.afterEdit();
    return n;
  }
  spawn(to, count) {
    const cand = [];
    this.each((o) => { if (o.t !== to && o.t !== 'heart' && o.t !== 'rainbow') cand.push(o); });
    shuffle(cand);
    cand.slice(0, count).forEach(o => { o.t = to; o.s = 1.5; });
    this.afterEdit();
  }
  junkify(n) {
    const cand = [];
    this.each((o) => { if (o.t !== 'junk' && o.t !== 'rainbow') cand.push(o); });
    shuffle(cand);
    cand.slice(0, n).forEach(o => { o.t = 'junk'; o.sp = null; o.s = 1.6; });
    this.afterEdit();
  }
  // 技能改了盤面之後若出現現成的三連，下一步隨便換都會一起消（交換檢查看的是整盤）
  afterEdit() { this.clearHint(); }
  each(fn) { for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) fn(this.grid[r][c], r, c); }

  // ── 輸入 ───────────────────────────────
  bind() {
    const pos = (e) => {
      const rect = this.cv.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const cellAt = (p) => {
      const c = Math.floor(p.x / this.cell), r = Math.floor(p.y / this.cell);
      return (c < 0 || c >= this.cols || r < 0 || r >= this.rows) ? null : { r, c };
    };
    const down = (e) => {
      if (this.state !== 'idle') return;
      e.preventDefault();
      const p = pos(e), at = cellAt(p);
      if (!at) return;
      this.cv.setPointerCapture && this.cv.setPointerCapture(e.pointerId);
      this.clearHint();
      if (this.mode === 'swap') { this.press = { ...at, x: p.x, y: p.y }; DT.sfx && DT.sfx('pick'); return; }
      this.state = 'drag';
      this.hold = { ...at, x: p.x, y: p.y };
      this.moved = false; this.t0 = 0;
      DT.sfx && DT.sfx('pick');
    };
    const move = (e) => {
      const p = pos(e);
      if (this.mode === 'swap') {
        // 往某個方向滑超過三分之一格 → 跟那一格交換
        if (!this.press || this.state !== 'idle') return;
        e.preventDefault();
        const dx = p.x - this.press.x, dy = p.y - this.press.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < this.cell * 0.33) return;
        const a = this.press, b = Math.abs(dx) > Math.abs(dy) ? { r: a.r, c: a.c + Math.sign(dx) } : { r: a.r + Math.sign(dy), c: a.c };
        this.press = null; this.sel = null;
        if (b.r >= 0 && b.r < this.rows && b.c >= 0 && b.c < this.cols) this.trySwap(a, b);
        return;
      }
      if (this.state !== 'drag') return;
      e.preventDefault();
      this.hold.x = Math.max(0, Math.min(this.cols * this.cell - 1, p.x));
      this.hold.y = Math.max(0, Math.min(this.rows * this.cell - 1, p.y));
      const c = Math.floor(this.hold.x / this.cell), r = Math.floor(this.hold.y / this.cell);
      if (r !== this.hold.r || c !== this.hold.c) {
        // 斜向移動也可以（像神魔之塔）；跨格太快時補走中間格
        const steps = Math.max(Math.abs(r - this.hold.r), Math.abs(c - this.hold.c));
        for (let i = 0; i < steps; i++) {
          const nr = this.hold.r + Math.sign(r - this.hold.r), nc = this.hold.c + Math.sign(c - this.hold.c);
          this.swap(this.hold.r, this.hold.c, nr, nc);
          this.hold.r = nr; this.hold.c = nc;
        }
        if (!this.moved) { this.moved = true; this.t0 = performance.now(); this.onMoveStart(); }
      }
    };
    const up = () => {
      if (this.mode === 'swap') {
        // 點一下選取、再點相鄰的一顆交換
        const a = this.press; this.press = null;
        if (!a || this.state !== 'idle') return;
        const s = this.sel;
        if (s && Math.abs(s.r - a.r) + Math.abs(s.c - a.c) === 1) { this.sel = null; this.trySwap(s, a); }
        else if (s && s.r === a.r && s.c === a.c) this.sel = null;
        else this.sel = a;
        return;
      }
      if (this.state === 'drag') this.release();
    };
    this.cv.addEventListener('pointerdown', down);
    this.cv.addEventListener('pointermove', move);
    this.cv.addEventListener('pointerup', up);
    this.cv.addEventListener('pointercancel', up);
    this.unbind = () => {
      this.cv.removeEventListener('pointerdown', down);
      this.cv.removeEventListener('pointermove', move);
      this.cv.removeEventListener('pointerup', up);
      this.cv.removeEventListener('pointercancel', up);
    };
  }
  swap(r1, c1, r2, c2, both) {
    const a = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = a;
    // 滑動動畫：轉珠時只有被換走的那顆要滑；三消時兩顆都滑
    const o = this.grid[r1][c1];
    o.ox = (c2 - c1) * this.cell; o.oy = (r2 - r1) * this.cell;
    if (both) { a.ox = (c1 - c2) * this.cell; a.oy = (r1 - r2) * this.cell; }
    this.onSwap();
  }
  release() {
    this.hold = null;
    this.onTimer(0);
    if (!this.moved) { this.state = 'idle'; return; }
    this.state = 'resolve';
    this.resolve();
  }
  // 三消：試著交換，沒有消除就換回來（不算回合）
  async trySwap(a, b) {
    if (this.state !== 'idle') return false;
    this.state = 'resolve';
    this.clearHint();
    this.swap(a.r, a.c, b.r, b.c, true);
    await wait(170);
    const oa = this.grid[a.r][a.c], ob = this.grid[b.r][b.c];
    if (oa.t !== 'rainbow' && ob.t !== 'rainbow' && !this.findGroups().length) {
      this.swap(a.r, a.c, b.r, b.c, true);
      DT.sfx && DT.sfx('block');
      await wait(170);
      this.state = 'idle'; this.idleSince = performance.now();
      return false;
    }
    this.onMoveStart();
    this.resolve([a, b]);
    return true;
  }

  // ── 找消除 ─────────────────────────────
  findGroups() {
    const R = this.rows, C = this.cols, g = this.grid;
    const hLen = Array.from({ length: R }, () => Array(C).fill(0));
    const vLen = Array.from({ length: R }, () => Array(C).fill(0));
    const ok = (o) => o.t !== 'rainbow';
    for (let r = 0; r < R; r++) {
      let run = 1;
      for (let c = 1; c <= C; c++) {
        if (c < C && ok(g[r][c]) && g[r][c].t === g[r][c - 1].t) run++;
        else { if (run >= 3) for (let k = c - run; k < c; k++) hLen[r][k] = run; run = 1; }
      }
    }
    for (let c = 0; c < C; c++) {
      let run = 1;
      for (let r = 1; r <= R; r++) {
        if (r < R && ok(g[r][c]) && g[r][c].t === g[r - 1][c].t) run++;
        else { if (run >= 3) for (let k = r - run; k < r; k++) vLen[k][c] = run; run = 1; }
      }
    }
    // 相鄰同色的標記格合成一組
    const seen = Array.from({ length: R }, () => Array(C).fill(false));
    const groups = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (!(hLen[r][c] || vLen[r][c]) || seen[r][c]) continue;
      const t = g[r][c].t, cells = [], st = [[r, c]];
      let maxH = 0, maxV = 0;
      seen[r][c] = true;
      while (st.length) {
        const [y, x] = st.pop(); cells.push([y, x]);
        maxH = Math.max(maxH, hLen[y][x]); maxV = Math.max(maxV, vLen[y][x]);
        DIRS4.forEach(([dy, dx]) => {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < R && nx >= 0 && nx < C && (hLen[ny][nx] || vLen[ny][nx]) && !seen[ny][nx] && g[ny][nx].t === t) { seen[ny][nx] = true; st.push([ny, nx]); }
        });
      }
      groups.push({ t, n: cells.length, cells, maxH, maxV });
    }
    // 由上而下、由左而右的順序消除（看起來比較自然）
    groups.sort((a, b) => Math.min(...a.cells.map(x => x[0] * 10 + x[1])) - Math.min(...b.cells.map(x => x[0] * 10 + x[1])));
    return groups;
  }
  // 三消：列出所有能消的交換（給提示、無步可走偵測、自動遊玩）
  findMoves() {
    const out = [], R = this.rows, C = this.cols, save = this.grid;
    const base = save.map(row => row.map(o => ({ t: o.t, sp: o.sp })));
    this.grid = base;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc;
        if (r2 >= R || c2 >= C) continue;
        const a = base[r][c], b = base[r2][c2];
        if (a.t === b.t && !a.sp && !b.sp) continue;
        let score = 0;
        if (a.t === 'rainbow' || b.t === 'rainbow') score = a.t === b.t ? 60 : 40;
        else {
          base[r][c] = b; base[r2][c2] = a;
          const gs = this.findGroups();
          base[r][c] = a; base[r2][c2] = b;
          if (!gs.length) continue;
          gs.forEach(gr => {
            if (gr.t === 'junk') { score += 2; return; }
            score += 10 + gr.n;
            const mx = Math.max(gr.maxH, gr.maxV);
            score += mx >= 5 ? 25 : gr.maxH >= 3 && gr.maxV >= 3 ? 16 : mx === 4 ? 10 : 0;
            gr.cells.forEach(([y, x]) => { if (base[y][x].sp) score += 12; });
          });
        }
        out.push({ a: { r, c }, b: { r: r2, c: c2 }, score });
      }
    }
    this.grid = save;
    return out;
  }

  // ── 結算（含特殊珠與連鎖） ───────────────────
  async resolve(swapCells) {
    const all = [];
    let combo = 0;
    const special = this.mode === 'swap';
    const isSwapCell = (r, c) => swapCells && swapCells.some(p => p.r === r && p.c === c);
    // 彩虹（名牌彩虹包）：跟誰交換，就清掉整盤那一色
    if (special && swapCells) {
      const [p, q] = swapCells, op = this.grid[p.r][p.c], oq = this.grid[q.r][q.c];
      if (op.t === 'rainbow' || oq.t === 'rainbow') {
        const other = op.t === 'rainbow' ? oq : op;
        const kill = new Set([`${p.r},${p.c}`, `${q.r},${q.c}`]);
        let color = other.t;
        this.each((o, r, c) => { if (other.t === 'rainbow' || o.t === other.t) kill.add(`${r},${c}`); });
        if (color === 'rainbow') color = null;
        combo++;
        const extra = this.blast(kill);
        const byType = this.countKill(kill, extra);
        Object.entries(byType).forEach(([t, cells]) => {
          if (t === 'rainbow') return;
          all.push({ t, n: cells.length, cells, combo, rainbow: true, special: t !== color });
        });
        this.onBlast('rainbow', p.r, p.c);
        this.onCombo(combo, { t: color || 'jewel', n: kill.size, cells: [] }, (p.c + 0.5) * this.cell, (p.r + 0.5) * this.cell);
        [...kill, ...extra].forEach(k => { const [r, c] = k.split(',').map(Number); this.grid[r][c].dying = 1; });
        await wait(380);
        this.gravity();
        await wait(300);
        swapCells = null;
      }
    }
    for (let wave = 0; wave < 40; wave++) {
      const groups = this.findGroups();
      if (!groups.length) break;
      const kill = new Set(), born = [];
      for (const gr of groups) {
        if (gr.t !== 'junk') combo++; // 過季貨消掉不算 Combo
        gr.combo = combo; gr.skyfall = wave > 0;
        all.push(gr);
        gr.cells.forEach(([r, c]) => kill.add(`${r},${c}`));
        // 三消：4 連變條紋、L/T 變包裝、5 連變彩虹
        if (special && gr.t !== 'junk') {
          const mx = Math.max(gr.maxH, gr.maxV);
          const sp = mx >= 5 ? 'rb' : gr.maxH >= 3 && gr.maxV >= 3 ? 'w' : mx === 4 ? (gr.maxH === 4 ? 'v' : 'h') : null;
          if (sp) {
            const at = gr.cells.find(([r, c]) => isSwapCell(r, c)) || gr.cells[Math.floor(gr.n / 2)];
            born.push({ r: at[0], c: at[1], o: { t: sp === 'rb' ? 'rainbow' : gr.t, sp: sp === 'rb' ? null : sp, a: 1, s: 1.8 } });
          }
        }
        const cx = gr.cells.reduce((s, x) => s + x[1], 0) / gr.n, cy = gr.cells.reduce((s, x) => s + x[0], 0) / gr.n;
        this.onCombo(combo, gr, (cx + 0.5) * this.cell, (cy + 0.5) * this.cell);
        await wait(special ? 110 : 170);
      }
      // 被消掉的特殊珠會爆開，炸到的珠也算傷害
      if (special) {
        const extra = this.blast(kill);
        const byType = this.countKill(extra, null);
        Object.entries(byType).forEach(([t, cells]) => { if (t !== 'rainbow') all.push({ t, n: cells.length, cells, combo, special: true }); });
        extra.forEach(k => kill.add(k));
      }
      kill.forEach(k => { const [r, c] = k.split(',').map(Number); this.grid[r][c].dying = 1; });
      born.forEach(b => { this.grid[b.r][b.c].dying = 1; });
      await wait(160);
      this.gravity(born);
      swapCells = null;
      await wait(special ? 260 : 300);
    }
    if (special && !this.findMoves().length) {
      await wait(300);
      this.refresh();
      this.onShuffle();
    }
    this.state = 'locked';
    this.onResolve(all, combo);
  }
  // 引爆清單裡的特殊珠（會連鎖）；回傳額外被炸掉的格子
  blast(kill) {
    const extra = new Set(), queue = [], done = new Set();
    kill.forEach(k => queue.push(k));
    while (queue.length) {
      const k = queue.shift();
      if (done.has(k)) continue;
      done.add(k);
      const [r, c] = k.split(',').map(Number), o = this.grid[r][c];
      if (!o.sp) continue;
      const hit = [];
      if (o.sp === 'h') for (let x = 0; x < this.cols; x++) hit.push([r, x]);
      if (o.sp === 'v') for (let y = 0; y < this.rows; y++) hit.push([y, c]);
      if (o.sp === 'w') for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (y >= 0 && y < this.rows && x >= 0 && x < this.cols) hit.push([y, x]);
      this.onBlast(o.sp, r, c);
      hit.forEach(([y, x]) => {
        const kk = `${y},${x}`;
        if (!kill.has(kk) && !extra.has(kk)) { extra.add(kk); queue.push(kk); }
      });
    }
    return extra;
  }
  countKill(set, extraSet) {
    const out = {};
    const add = k => { const [r, c] = k.split(',').map(Number), t = this.grid[r][c].t; (out[t] = out[t] || []).push([r, c]); };
    set.forEach(add);
    if (extraSet) extraSet.forEach(k => { if (!set.has(k)) add(k); });
    return out;
  }
  unlock() { this.state = 'idle'; this.idleSince = performance.now(); }
  gravity(born = []) {
    born.forEach(b => { this.grid[b.r][b.c] = b.o; });
    for (let c = 0; c < this.cols; c++) {
      const col = [];
      for (let r = this.rows - 1; r >= 0; r--) if (!this.grid[r][c].dying) col.push({ o: this.grid[r][c], from: r });
      let r = this.rows - 1;
      for (const it of col) { it.o.oy = (it.from - r) * this.cell + (it.o.oy || 0); it.o.ox = 0; this.grid[r][c] = it.o; r--; }
      let k = 1;
      for (; r >= 0; r--, k++) this.grid[r][c] = { t: this.rand(), oy: -(k + 1) * this.cell * 0.9, ox: 0, a: 1, s: 1 };
    }
  }

  // ── 提示 ──────────────────────────────
  clearHint() { this.hint = null; this.idleSince = performance.now(); }

  // ── 自動遊玩（測試與平衡模擬用） ─────────────────
  autoMove() {
    if (this.state !== 'idle') return false;
    if (this.mode === 'swap') {
      const ms = this.findMoves();
      if (!ms.length) { this.refresh(); return false; }
      // 不一定選最好的那步：模擬一般玩家（前 3 好的步隨機挑）
      ms.sort((x, y) => y.score - x.score);
      const m = ms[Math.floor(Math.random() * Math.min(3, ms.length))];
      this.trySwap(m.a, m.b);
      return true;
    }
    return this.playPath(this.aiPath(250, 14));
  }
  aiPath(iter = 400, maxLen = 14) {
    const R = this.rows, C = this.cols;
    const score = (t) => {
      const save = this.grid;
      this.grid = t.map(row => row.map(x => ({ t: x })));
      const gs = this.findGroups();
      this.grid = save;
      return gs.filter(g => g.t !== 'junk').length * 10 + gs.reduce((s, g) => s + g.n, 0) * 0.1;
    };
    let best = null, bestS = -1;
    for (let k = 0; k < iter; k++) {
      const t = this.grid.map(row => row.map(o => o.t));
      let r = Math.floor(Math.random() * R), c = Math.floor(Math.random() * C);
      const path = [[r, c]];
      let pr = -1, pc = -1;
      for (let s = 0; s < maxLen; s++) {
        const opts = DIRS4.map(([dr, dc]) => [r + dr, c + dc]).filter(([nr, nc]) => nr >= 0 && nr < R && nc >= 0 && nc < C && !(nr === pr && nc === pc));
        const [nr, nc] = opts[Math.floor(Math.random() * opts.length)];
        [t[r][c], t[nr][nc]] = [t[nr][nc], t[r][c]];
        pr = r; pc = c; r = nr; c = nc;
        path.push([r, c]);
        const sc = score(t);
        if (sc > bestS) { bestS = sc; best = path.slice(); }
      }
    }
    return best;
  }
  playPath(path) {
    if (this.state !== 'idle' || !path) return false;
    for (let i = 1; i < path.length; i++) this.swap(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
    this.state = 'drag'; this.moved = true; this.hold = null;
    this.release();
    return true;
  }

  // ── 繪製 ──────────────────────────────
  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    if (this.state === 'drag' && this.moved) {
      const left = this.moveTime - (now - this.t0);
      this.onTimer(Math.max(0, left / this.moveTime));
      if (left <= 0) { this.release(); }
    }
    // 三消：停 6 秒沒動就提示一步
    if (this.mode === 'swap' && this.state === 'idle' && !this.hint && !this.sel && now - this.idleSince > 6000) {
      const ms = this.findMoves();
      if (ms.length) { ms.sort((x, y) => y.score - x.score); this.hint = ms[0]; }
      else this.idleSince = now;
    }
    this.draw(now);
  }
  draw(now = performance.now()) {
    const g = this.g, cs = this.cell, d = this.dpr;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, this.cols * cs, this.rows * cs);
    // 棋盤格
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      g.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.12)';
      g.fillRect(c * cs, r * cs, cs, cs);
    }
    if (this.sel) {
      g.fillStyle = 'rgba(255,214,110,.32)';
      g.fillRect(this.sel.c * cs, this.sel.r * cs, cs, cs);
    }
    const holdObj = this.hold ? this.grid[this.hold.r][this.hold.c] : null;
    const hintOn = this.hint && this.state === 'idle';
    const pulse = 1 + Math.sin(now / 160) * 0.08;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const o = this.grid[r][c];
      if (o.ox) o.ox *= 0.6; if (Math.abs(o.ox || 0) < 0.5) o.ox = 0;
      if (o.oy) { o.oy *= o.oy < 0 ? 0.8 : 0.6; if (Math.abs(o.oy) < 0.5) o.oy = 0; }
      if (o.s !== 1) { o.s += (1 - o.s) * 0.18; if (Math.abs(o.s - 1) < 0.01) o.s = 1; }
      if (o.a < 1 && !o.dying) o.a = Math.min(1, o.a + 0.08);
      if (o.dying) { o.a = Math.max(0, o.a - 0.12); o.s += 0.04; }
      if (o === holdObj) {
        g.globalAlpha = 0.3;
        g.drawImage(this.sprites[o.t], c * cs, r * cs, cs, cs);
        g.globalAlpha = 1;
        continue;
      }
      const isHint = hintOn && ((this.hint.a.r === r && this.hint.a.c === c) || (this.hint.b.r === r && this.hint.b.c === c));
      const isSel = this.sel && this.sel.r === r && this.sel.c === c;
      const sz = cs * o.s * (isHint || isSel ? pulse : 1);
      const x = c * cs + (o.ox || 0) + (cs - sz) / 2, y = r * cs + (o.oy || 0) + (cs - sz) / 2;
      g.globalAlpha = o.a;
      g.drawImage(this.sprites[o.t], x, y, sz, sz);
      if (o.sp) this.drawSpecial(o.sp, x, y, sz, now);
      if (o.dying) {
        g.globalAlpha = o.a * 0.8;
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(c * cs + cs / 2, r * cs + cs / 2, sz * 0.42, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }
    if (holdObj) {
      const sz = cs * 1.15;
      g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 14;
      g.drawImage(this.sprites[holdObj.t], this.hold.x - sz / 2, this.hold.y - sz / 2 - cs * 0.2, sz, sz);
      g.restore();
    }
    // 敵人回合時盤面變暗
    if (this.state === 'locked') { g.fillStyle = 'rgba(20,8,24,.28)'; g.fillRect(0, 0, this.cols * cs, this.rows * cs); }
  }
  // 特殊珠外觀：條紋（橫／直）、包裝（金框閃光）
  drawSpecial(sp, x, y, sz, now) {
    const g = this.g, cx = x + sz / 2, cy = y + sz / 2, rad = sz * 0.45;
    g.save();
    g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.clip();
    if (sp === 'h' || sp === 'v') {
      g.fillStyle = 'rgba(255,255,255,.55)';
      const w = sz * 0.09, shift = (now / 30) % (sz * 0.3);
      for (let k = -4; k <= 4; k++) {
        const p = k * sz * 0.3 + shift;
        if (sp === 'h') g.fillRect(x, cy + p - w / 2, sz, w); else g.fillRect(cx + p - w / 2, y, w, sz);
      }
    }
    g.restore();
    if (sp === 'w') {
      g.save();
      g.strokeStyle = '#ffe08a'; g.lineWidth = sz * 0.08;
      g.shadowColor = '#fff3c4'; g.shadowBlur = 8 + Math.sin(now / 200) * 4;
      g.beginPath(); g.arc(cx, cy, rad * 0.98, 0, Math.PI * 2); g.stroke();
      // 蝴蝶結
      g.fillStyle = '#ffe08a';
      g.beginPath(); g.moveTo(cx, y + sz * 0.06); g.lineTo(cx - sz * 0.16, y - sz * 0.04); g.lineTo(cx - sz * 0.14, y + sz * 0.14); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx, y + sz * 0.06); g.lineTo(cx + sz * 0.16, y - sz * 0.04); g.lineTo(cx + sz * 0.14, y + sz * 0.14); g.closePath(); g.fill();
      g.restore();
    }
  }
};

function wait(ms) { return new Promise(r => setTimeout(r, DT.turbo ? 0 : DT.fast ? ms / 8 : ms)); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
DT.wait = wait;
DT.shuffle = shuffle;
