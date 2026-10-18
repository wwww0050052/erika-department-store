// 名媛之塔：6×5 轉珠盤（拖曳換珠、消除、天降、連鎖）
'use strict';

DT.Board = class {
  constructor(canvas, opts = {}) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.cols = 6; this.rows = 5;
    this.grid = [];       // grid[r][c] = { t, y(繪製位移), a(透明), s(縮放) }
    this.state = 'idle';  // idle | drag | resolve | locked
    this.moveTime = 5000;
    this.onResolve = opts.onResolve || (() => {});
    this.onCombo = opts.onCombo || (() => {});
    this.onMoveStart = opts.onMoveStart || (() => {});
    this.onTimer = opts.onTimer || (() => {});
    this.onSwap = opts.onSwap || (() => {});
    this.weights = null;
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
  // 開局盤面不能自帶三連
  fill() {
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        let t;
        do { t = this.rand(); } while (
          (c >= 2 && this.grid[r][c - 1].t === t && this.grid[r][c - 2].t === t) ||
          (r >= 2 && this.grid[r - 1][c].t === t && this.grid[r - 2][c].t === t));
        this.grid[r][c] = { t, y: 0, a: 1, s: 1 };
      }
    }
  }
  refresh() {
    this.fill();
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) { const o = this.grid[r][c]; o.s = 0.2; o.a = 0; }
  }
  // 技能：把某些珠轉色
  convert(fromList, to) {
    const from = Array.isArray(fromList) ? fromList : [fromList];
    let n = 0;
    this.each((o) => { if (from.includes(o.t)) { o.t = to; o.s = 1.5; n++; } });
    return n;
  }
  spawn(to, count) {
    const cand = [];
    this.each((o) => { if (o.t !== to && o.t !== 'heart') cand.push(o); });
    shuffle(cand);
    cand.slice(0, count).forEach(o => { o.t = to; o.s = 1.5; });
  }
  junkify(n) {
    const cand = [];
    this.each((o) => { if (o.t !== 'junk') cand.push(o); });
    shuffle(cand);
    cand.slice(0, n).forEach(o => { o.t = 'junk'; o.s = 1.6; });
  }
  each(fn) { for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) fn(this.grid[r][c], r, c); }

  // ── 拖曳 ───────────────────────────────
  bind() {
    const pos = (e) => {
      const rect = this.cv.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const down = (e) => {
      if (this.state !== 'idle') return;
      e.preventDefault();
      const p = pos(e);
      const c = Math.floor(p.x / this.cell), r = Math.floor(p.y / this.cell);
      if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
      this.cv.setPointerCapture && this.cv.setPointerCapture(e.pointerId);
      this.state = 'drag';
      this.hold = { r, c, x: p.x, y: p.y };
      this.moved = false; this.t0 = 0;
      DT.sfx && DT.sfx('pick');
    };
    const move = (e) => {
      if (this.state !== 'drag') return;
      e.preventDefault();
      const p = pos(e);
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
    const up = () => { if (this.state === 'drag') this.release(); };
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
  swap(r1, c1, r2, c2) {
    const a = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = a;
    // 被換走的珠子做一點滑動動畫
    const o = this.grid[r1][c1];
    o.ox = (c2 - c1) * this.cell; o.oy = (r2 - r1) * this.cell;
    this.onSwap();
  }
  release() {
    this.hold = null;
    this.onTimer(0);
    if (!this.moved) { this.state = 'idle'; return; }
    this.state = 'resolve';
    this.resolve();
  }

  // ── 消除 ───────────────────────────────
  findGroups() {
    const R = this.rows, C = this.cols, g = this.grid;
    const mark = Array.from({ length: R }, () => Array(C).fill(false));
    for (let r = 0; r < R; r++) {
      let run = 1;
      for (let c = 1; c <= C; c++) {
        if (c < C && g[r][c].t === g[r][c - 1].t) run++;
        else { if (run >= 3) for (let k = c - run; k < c; k++) mark[r][k] = true; run = 1; }
      }
    }
    for (let c = 0; c < C; c++) {
      let run = 1;
      for (let r = 1; r <= R; r++) {
        if (r < R && g[r][c].t === g[r - 1][c].t) run++;
        else { if (run >= 3) for (let k = r - run; k < r; k++) mark[k][c] = true; run = 1; }
      }
    }
    // 相鄰同色的標記格合成一組
    const seen = Array.from({ length: R }, () => Array(C).fill(false));
    const groups = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (!mark[r][c] || seen[r][c]) continue;
      const t = g[r][c].t, cells = [], st = [[r, c]];
      seen[r][c] = true;
      while (st.length) {
        const [y, x] = st.pop(); cells.push([y, x]);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dy, dx]) => {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < R && nx >= 0 && nx < C && mark[ny][nx] && !seen[ny][nx] && g[ny][nx].t === t) { seen[ny][nx] = true; st.push([ny, nx]); }
        });
      }
      groups.push({ t, n: cells.length, cells });
    }
    // 由上而下、由左而右的順序消除（看起來比較自然）
    groups.sort((a, b) => Math.min(...a.cells.map(x => x[0] * 10 + x[1])) - Math.min(...b.cells.map(x => x[0] * 10 + x[1])));
    return groups;
  }
  async resolve() {
    const all = [];
    let combo = 0;
    for (let wave = 0; wave < 30; wave++) {
      const groups = this.findGroups();
      if (!groups.length) break;
      for (const gr of groups) {
        if (gr.t !== 'junk') combo++; // 過季貨消掉不算 Combo
        gr.combo = combo; gr.skyfall = wave > 0;
        all.push(gr);
        gr.cells.forEach(([r, c]) => { this.grid[r][c].dying = 1; });
        const cx = gr.cells.reduce((s, x) => s + x[1], 0) / gr.n, cy = gr.cells.reduce((s, x) => s + x[0], 0) / gr.n;
        this.onCombo(combo, gr, (cx + 0.5) * this.cell, (cy + 0.5) * this.cell);
        await wait(170);
      }
      await wait(160);
      this.gravity();
      await wait(300);
    }
    this.state = 'locked';
    this.onResolve(all, combo);
  }
  unlock() { this.state = 'idle'; }
  gravity() {
    for (let c = 0; c < this.cols; c++) {
      const col = [];
      for (let r = this.rows - 1; r >= 0; r--) if (!this.grid[r][c].dying) col.push({ o: this.grid[r][c], from: r });
      let r = this.rows - 1;
      for (const it of col) { it.o.oy = (it.from - r) * this.cell; it.o.ox = 0; this.grid[r][c] = it.o; r--; }
      let k = 1;
      for (; r >= 0; r--, k++) this.grid[r][c] = { t: this.rand(), oy: -(k + 1) * this.cell * 0.9, ox: 0, a: 1, s: 1 };
    }
  }

  // ── 自動轉珠（測試與平衡模擬用）：隨機走步找 Combo 最多的路徑 ──
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
        const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dr, dc]) => [r + dr, c + dc]).filter(([nr, nc]) => nr >= 0 && nr < R && nc >= 0 && nc < C && !(nr === pr && nc === pc));
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
    this.draw();
  }
  draw() {
    const g = this.g, cs = this.cell, d = this.dpr;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, this.cols * cs, this.rows * cs);
    // 棋盤格
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      g.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.12)';
      g.fillRect(c * cs, r * cs, cs, cs);
    }
    const holdObj = this.hold ? this.grid[this.hold.r][this.hold.c] : null;
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
      const sz = cs * o.s;
      g.globalAlpha = o.a;
      g.drawImage(this.sprites[o.t], c * cs + (o.ox || 0) + (cs - sz) / 2, r * cs + (o.oy || 0) + (cs - sz) / 2, sz, sz);
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
    if (this.state === 'locked' || this.state === 'resolve') {
      // 敵人回合時盤面變暗
      if (this.state === 'locked') { g.fillStyle = 'rgba(20,8,24,.28)'; g.fillRect(0, 0, this.cols * cs, this.rows * cs); }
    }
  }
};

function wait(ms) { return new Promise(r => setTimeout(r, DT.turbo ? 0 : DT.fast ? ms / 8 : ms)); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
DT.wait = wait;
DT.shuffle = shuffle;
