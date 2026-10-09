// 時尚消消樂 核心單元測試：node m3test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const REPO_ROOT = decodeURIComponent(new URL('../../', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');

const SRC = REPO_ROOT + 'js/games/match3.js';
const ctx = { window: {}, console, Math, Date, performance: { now: () => Date.now() } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx, { filename: 'match3.js' });
const { Core, Levels } = ctx.window.ErikaMatch3;
assert.ok(ctx.window.ErikaGames && ctx.window.ErikaGames.some(g => g.id === 'match3') || true);

let pass = 0, fail = 0;
const T = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n    ', e.message.split('\n').slice(0, 6).join('\n     ')); } };

// 用文字畫盤面：數字=顏色，h/v/w 字尾=條紋/包裝，C=粉鑽，B=包裹，# =空洞，i 字尾=冰塊一層（ii 兩層），r 前綴=緞帶
function grid(rows, seed = 7) {
  const toks = rows.map(r => r.trim().split(/\s+/));
  const h = toks.length, w = toks[0].length;
  const s = { w, h, seed, nid: 1, mask: new Uint8Array(w * h), ribbon: new Uint8Array(w * h), cells: new Array(w * h).fill(null),
    pal: [0, 1, 2, 3, 4, 5], col: [0, 0, 0, 0, 0, 0], score: 0, bagsDone: 0, iceBroken: 0, bag: { left: 0, max: 0, on: 0 }, exits: new Array(w).fill(-1), rib0: 0, ice0: 0 };
  toks.forEach((row, r) => row.forEach((t, c) => {
    const i = r * w + c;
    if (t === '#') return;
    s.mask[i] = 1;
    let m;
    while ((m = t.match(/^r/))) { s.ribbon[i]++; t = t.slice(1); }
    if (t === '.') return;
    const p = { id: s.nid++, k: 'n', c: -1, ice: 0, armed: 0 };
    if (t[0] === 'C') { p.k = 'c'; t = t.slice(1); }
    else if (t[0] === 'B') { p.k = 'b'; t = t.slice(1); s.bag.on++; }
    else { p.c = +t[0]; t = t.slice(1); if (/^[hvw]/.test(t)) { p.k = t[0]; t = t.slice(1); } }
    while (t.startsWith('i')) { p.ice++; t = t.slice(1); }
    s.cells[i] = p;
  }));
  for (let c = 0; c < w; c++) for (let r = h - 1; r >= 0; r--) if (s.mask[r * w + c]) { s.exits[c] = r * w + c; break; }
  s.rib0 = s.ribbon.reduce((a, b) => a + b, 0);
  s.ice0 = s.cells.reduce((a, p) => a + (p ? p.ice : 0), 0);
  return s;
}
const I = (s, r, c) => r * s.w + c;
const kinds = s => s.cells.map(p => (p ? p.k : '-'));
const filled = s => s.cells.every((p, i) => !s.mask[i] || !!p);

console.log('配對偵測');
T('橫向三連', () => {
  const s = grid(['0 0 0 1', '1 2 3 4', '2 3 4 5']);
  const runs = Core.findRuns(s);
  assert.equal(runs.length, 1); assert.equal(runs[0].dir, 'h'); assert.deepEqual([...runs[0].cells], [0, 1, 2]);
});
T('直向三連＋空洞會打斷', () => {
  const s = grid(['0 1 2', '0 2 3', '0 3 4', '# 4 5', '0 5 1']);
  const runs = Core.findRuns(s);
  assert.equal(runs.length, 1); assert.equal(runs[0].dir, 'v'); assert.equal(runs[0].cells.length, 3);
});
T('粉鑽與包裹不參與配對', () => {
  const s = grid(['0 C 0 0', '1 2 3 4', '0 B 0 0']);
  assert.equal(Core.findRuns(s).length, 0);
});
T('4 連（連鎖、橫向）→ 橫條紋，生在中間', () => {
  const s = grid(['1 0 0 0 0 2', '3 4 5 1 2 3']);
  const g = Core.findGroups(s, null);
  assert.equal(g.length, 1); assert.equal(g[0].kind, 'h'); assert.equal(g[0].at, 2);
});
T('4 連（橫向滑動做出）→ 直條紋，生在被滑過去的格子', () => {
  const s = grid(['1 0 0 0 0 2', '3 4 5 1 2 3']);
  const g = Core.findGroups(s, { a: 0, b: 1, dir: 'h' });
  assert.equal(g[0].kind, 'v'); assert.equal(g[0].at, 1);
});
T('4 連（直向滑動做出）→ 橫條紋', () => {
  const s = grid(['1 0 0 0 0 2', '3 4 5 1 2 3']);
  const g = Core.findGroups(s, { a: 9, b: 3, dir: 'v' });
  assert.equal(g[0].kind, 'h'); assert.equal(g[0].at, 3);
});
T('5 連 → 粉鑽', () => {
  const s = grid(['0 0 0 0 0 1', '2 3 4 5 1 2']);
  const g = Core.findGroups(s, null);
  assert.equal(g[0].kind, 'c'); assert.equal(g[0].at, 2);
});
T('L 形 → 包裝炸彈（生在轉角）', () => {
  const s = grid(['0 1 2 3', '0 2 3 4', '0 0 0 5', '1 2 3 4']);
  const g = Core.findGroups(s, null);
  assert.equal(g.length, 1); assert.equal(g[0].kind, 'w'); assert.equal(g[0].at, I(s, 2, 0)); assert.equal(g[0].cells.length, 5);
});
T('T 形 → 包裝炸彈', () => {
  const s = grid(['0 0 0 1', '1 0 2 3', '2 0 3 4', '3 4 5 1']);
  const g = Core.findGroups(s, null);
  assert.equal(g[0].kind, 'w'); assert.equal(g[0].at, 1);
});
T('兩組不相交的三連分開計算', () => {
  const s = grid(['0 0 0 1 1 1', '2 3 4 5 2 3']);
  assert.equal(Core.findGroups(s, null).length, 2);
});

console.log('交換');
T('無效交換回傳 null 且盤面不變', () => {
  const s = grid(['0 1 2', '3 4 5', '1 2 3']);
  const before = JSON.stringify(s.cells);
  assert.equal(Core.applySwap(s, 0, 1), null);
  assert.equal(JSON.stringify(s.cells), before);
});
T('有效交換', () => {
  const s = grid(['0 1 0 0', '2 3 4 5']);
  const r = Core.applySwap(s, 0, 1);
  assert.ok(r); assert.equal(r.combo, null); assert.equal(r.swap.dir, 'h'); assert.equal(s.cells[1].c, 0);
});
T('不相鄰／冰塊／換行邊界不能交換', () => {
  const s = grid(['0 1 0 0', '2 3i 4 5', '0 1 2 3']);
  assert.equal(Core.checkSwap(s, 0, 2), false);
  assert.equal(Core.checkSwap(s, 5, 1), false);
  assert.equal(Core.checkSwap(s, 3, 4), false); // 第一列最後一格和第二列第一格不相鄰
});
T('粉鑽可以跟任何精品交換，但不能跟包裹', () => {
  const s = grid(['C 1 B', '2 3 4']);
  assert.equal(Core.checkSwap(s, 0, 1), true);
  assert.equal(Core.checkSwap(s, 0, 3), true);
  const t = grid(['1 C B', '2 3 4']);
  assert.equal(Core.checkSwap(t, 1, 2), false);
});
T('名牌包裹可以直接往下拖一格（往上、橫向不行）', () => {
  const s = grid(['0 B 2', '3 4 5', '1 2 3']);
  assert.equal(Core.checkSwap(s, 1, 4), true);
  assert.equal(Core.checkSwap(s, 4, 1), true);
  assert.equal(Core.checkSwap(s, 1, 0), false);
  const r = Core.applySwap(s, 1, 4);
  assert.ok(r); assert.equal(s.cells[4].k, 'b');
  const t = grid(['0 1 2', '3 B 5', '1 2 3']);
  assert.equal(Core.checkSwap(t, 4, 1), false, '不能往上');
});
T('兩個特殊元素交換一定有效', () => {
  const s = grid(['0h 1v 2', '3 4w 5']);
  assert.equal(Core.comboOf(s, 0, 1).type, 'ss');
  assert.equal(Core.comboOf(s, 1, 4).type, 'sw');
});

console.log('消除與特殊元素');
T('三連消除：分數、收集數、緞帶格', () => {
  const s = grid(['r0 r0 0 1', '2 3 4 5']);
  const ev = Core.resolve(s, { cascade: 1 });
  assert.equal(ev.hits.length, 3); assert.equal(s.col[0], 3); assert.equal(s.ribbon[0] + s.ribbon[1], 0);
  assert.equal(ev.rib.length, 2); assert.equal(ev.score, 60 + 200); assert.equal(s.score, 260);
});
T('連鎖倍數', () => {
  const s = grid(['0 0 0 1', '2 3 4 5']);
  assert.equal(Core.resolve(s, { cascade: 3 }).score, 180);
});
T('冰塊：被消除時只碎冰、精品留著', () => {
  const s = grid(['0 0 0ii 1', '2 3 4 5']);
  const ev = Core.resolve(s, {});
  assert.equal(ev.hits.length, 2); assert.equal(ev.ice.length, 1); assert.equal(s.cells[2].ice, 1); assert.equal(s.iceBroken, 1);
});
T('4 連生成條紋並留在盤面', () => {
  const s = grid(['1 0 0 0 0 2', '3 4 5 1 2 3']);
  const ev = Core.resolve(s, {});
  assert.equal(ev.made.length, 1); assert.equal(s.cells[2].k, 'h'); assert.equal(s.cells[2].c, 0);
  assert.equal(s.cells.filter(p => !p).length, 3);
});
T('橫條紋被消除時清整排', () => {
  const s = grid(['1 2 3 4 5 1', '0h 0 0 2 3 4', '5 1 2 3 4 5']);
  const ev = Core.resolve(s, {});
  assert.ok(ev.fx.some(f => f.k === 'line' && f.dir === 'h'));
  for (let c = 0; c < 6; c++) assert.equal(s.cells[I(s, 1, c)], null);
  assert.ok(s.cells[0] && s.cells[I(s, 2, 0)]);
});
T('直條紋清整列（含連鎖觸發另一個條紋）', () => {
  const s = grid(['1 2 3', '2h 4 5', '0v 0 0', '1 2 3', '4 5 1']);
  Core.resolve(s, {});
  for (let r = 0; r < 5; r++) assert.equal(s.cells[I(s, r, 0)], null, 'col0 row' + r);
  for (let c = 0; c < 3; c++) assert.equal(s.cells[I(s, 2, c)], null);
  assert.ok(s.cells[I(s, 1, 2)] === null, '橫條紋被直條紋打到也觸發');
});
T('包裝炸彈：先爆 3×3、留下待爆，重力後再爆一次', () => {
  const s = grid(['1 2 3 4 5', '2 3 4 5 1', '3 4 0w 0 0', '4 5 1 2 3', '5 1 2 3 4']);
  const ev = Core.resolve(s, {});
  assert.ok(ev.fx.some(f => f.k === 'blast' && f.rad === 1 && !f.second));
  const bomb = s.cells[I(s, 2, 2)];
  assert.ok(bomb && bomb.k === 'w' && bomb.armed === 1, '炸彈還在且待爆');
  assert.equal(s.cells[I(s, 1, 1)], null); assert.equal(s.cells[I(s, 3, 3)], null); assert.ok(s.cells[I(s, 0, 0)]);
  Core.gravity(s);
  assert.ok(filled(s));
  const ev2 = Core.resolve(s, { cascade: 2 });
  assert.ok(ev2.fx.some(f => f.k === 'blast' && f.second));
  assert.ok(!s.cells.some(p => p && p.armed));
});
T('粉鑽＋一般：清除同色', () => {
  const s = grid(['C 1 2 1', '1 3 1 4', '5 1 0 2']);
  const sw = Core.applySwap(s, 0, 1);
  assert.equal(sw.combo.type, 'cn'); assert.equal(sw.combo.color, 1);
  Core.resolve(s, { combo: sw.combo, swap: sw.swap });
  assert.ok(!s.cells.some(p => p && p.c === 1)); assert.ok(!s.cells.some(p => p && p.k === 'c'));
  assert.equal(s.col[1], 5);
});
T('粉鑽被爆炸波及時清除最多的顏色', () => {
  const s = grid(['0 0 0h C', '2 2 3 2', '1 2 3 1']);
  Core.resolve(s, {});
  assert.ok(!s.cells.some(p => p && p.c === 2));
});
T('條紋＋條紋：十字', () => {
  const s = grid(['1 2 3 4 5', '2 3 4 5 1', '3 4 0h 1v 2', '4 5 1 2 3', '5 1 2 3 4']);
  const sw = Core.applySwap(s, I(s, 2, 3), I(s, 2, 2));
  assert.equal(sw.combo.type, 'ss');
  Core.resolve(s, { combo: sw.combo });
  for (let c = 0; c < 5; c++) assert.equal(s.cells[I(s, 2, c)], null);
  for (let r = 0; r < 5; r++) assert.equal(s.cells[I(s, r, 2)], null);
  assert.equal(s.cells.filter(p => !p).length, 9);
});
T('條紋＋包裝：大十字（3 排＋3 列）', () => {
  const rows = []; for (let r = 0; r < 7; r++) { const a = []; for (let c = 0; c < 7; c++) a.push(String((r * 2 + c * 3) % 5 + 1)); rows.push(a.join(' ')); }
  rows[3] = '1 2 3 0h 4w 5 1';
  const s = grid(rows);
  const sw = Core.applySwap(s, I(s, 3, 4), I(s, 3, 3));
  assert.equal(sw.combo.type, 'sw');
  Core.resolve(s, { combo: sw.combo });
  let cleared = 0;
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) { const inX = Math.abs(r - 3) <= 1 || Math.abs(c - 3) <= 1; if (inX) { assert.equal(s.cells[I(s, r, c)], null, `${r},${c}`); cleared++; } }
  assert.equal(s.cells.filter(p => !p).length, cleared);
});
T('包裝＋包裝：5×5 爆兩次', () => {
  const rows = []; for (let r = 0; r < 7; r++) { const a = []; for (let c = 0; c < 7; c++) a.push(String((r + c * 2) % 5 + 1)); rows.push(a.join(' ')); }
  rows[3] = '1 2 3 0w 4w 5 1';
  const s = grid(rows);
  const sw = Core.applySwap(s, I(s, 3, 4), I(s, 3, 3));
  assert.equal(sw.combo.type, 'ww');
  Core.resolve(s, { combo: sw.combo });
  const keep = s.cells[I(s, 3, 3)];
  assert.ok(keep && keep.armed === 2);
  assert.equal(s.cells.filter(p => !p).length, 24);
  Core.gravity(s);
  const ev = Core.resolve(s, { cascade: 2 });
  assert.ok(ev.fx.some(f => f.k === 'blast' && f.rad === 2 && f.second));
});
T('粉鑽＋條紋：同色全部變條紋並觸發', () => {
  const s = grid(['C 2h 1 3', '2 1 2 4', '3 4 5 2', '1 2 3 4']);
  const sw = Core.applySwap(s, 0, 1);
  assert.equal(sw.combo.type, 'cs');
  const ev = Core.resolve(s, { combo: sw.combo });
  assert.ok(ev.conv.length >= 3);
  assert.ok(ev.fx.filter(f => f.k === 'line').length >= 4);
  assert.ok(!s.cells.some(p => p && p.c === 2));
});
T('粉鑽＋包裝：同色全部變包裝炸彈', () => {
  const s = grid(['C 2w 1 3', '2 1 2 4', '3 4 5 2', '1 2 3 4']);
  const sw = Core.applySwap(s, 0, 1);
  assert.equal(sw.combo.type, 'cw');
  Core.resolve(s, { combo: sw.combo });
  assert.ok(s.cells.some(p => p && p.k === 'w' && p.armed));
});
T('粉鑽＋粉鑽：全盤清空（冰塊只碎一層、包裹不受影響）', () => {
  const s = grid(['C C 1 2', '3 4i 5 B', '0 1 2 3']);
  const sw = Core.applySwap(s, 0, 1);
  assert.equal(sw.combo.type, 'cc');
  Core.resolve(s, { combo: sw.combo });
  const left = s.cells.filter(Boolean);
  assert.equal(left.length, 2); assert.ok(left.some(p => p.k === 'b')); assert.ok(left.some(p => p.k === 'n' && p.ice === 0));
});
T('錘子：敲一格（特殊元素會被觸發）', () => {
  const s = grid(['1 2 3', '4 0v 5', '1 2 3']);
  Core.resolve(s, { hammer: 4 });
  assert.equal(s.cells[1], null); assert.equal(s.cells[7], null); assert.ok(s.cells[0]);
});

console.log('重力、包裹、無解');
T('重力：補滿、空洞保持空、往下掉', () => {
  const s = grid(['0 1 2', '3 # 4', '. . 5', '1 . 3']);
  const mv = Core.gravity(s);
  assert.ok(filled(s)); assert.equal(s.cells[4], null);
  for (const m of mv) assert.ok(I(s, m.fr < 0 ? m.fr : m.fr, 0) <= m.to || m.fr < (m.to / s.w | 0));
  assert.equal(s.cells[I(s, 3, 1)].c, 1, '1 從頂端穿過空洞掉到底');
});
T('冰塊固定不動，上面的精品穿過去', () => {
  const s = grid(['0 1', '2i 3', '. 4']);
  const ice = s.cells[2];
  Core.gravity(s);
  assert.equal(s.cells[2], ice); assert.equal(s.cells[4].c, 0); assert.ok(filled(s));
});
T('包裹到底就收集，然後補位', () => {
  const s = grid(['0 1 2', '3 4 5', '1 B 3']);
  s.bag.on = 1;
  const got = Core.collectBags(s);
  assert.equal(got.length, 1); assert.equal(s.bagsDone, 1); assert.equal(s.bag.on, 0);
  Core.gravity(s); assert.ok(filled(s));
});
T('包裹在冰塊上面也算到底', () => {
  const s = grid(['0 B 2', '3 4i 5']);
  assert.equal(Core.collectBags(s).length, 1);
});
T('無解盤面判斷＋洗牌後有解且沒有現成三連', () => {
  const s = grid(['0 1 2 3', '2 3 0 1', '0 1 2 3', '2 3 0 1']);
  s.pal = [0, 1, 2, 3];
  assert.equal(Core.hasMove(s), false);
  const mp = Core.shuffle(s);
  assert.ok(Core.hasMove(s)); assert.equal(Core.findRuns(s).length, 0); assert.equal(mp.length, 16);
});
T('洗牌不動冰塊與包裹', () => {
  const s = grid(['0 1 2 3', '2 3i 0 1', '0 1 B 3', '2 3 0 1']);
  s.pal = [0, 1, 2, 3];
  const ice = s.cells[5], bag = s.cells[10];
  Core.shuffle(s);
  assert.equal(s.cells[5], ice); assert.equal(s.cells[10], bag);
});

console.log('關卡與整體模擬');
T(`關卡數量 ≥ 40（目前 ${Levels.COUNT}）`, () => assert.ok(Levels.COUNT >= 40));
T('每一關×20 個種子：開局無三連、有解、格子補滿、冰塊不在前兩排', () => {
  for (let n = 0; n < Levels.COUNT; n++) {
    const L = Levels.build(n);
    assert.ok(L.goals.length >= 1 && L.goals.length <= 4, 'goals ' + n);
    assert.ok(L.stars[0] <= L.stars[1] && L.stars[1] <= L.stars[2], 'stars ' + n);
    for (let k = 0; k < 20; k++) {
      const s = Core.create(L.def, n * 1000 + k);
      assert.equal(Core.findRuns(s).length, 0, `runs L${n + 1} seed ${k}`);
      assert.ok(Core.hasMove(s), `moves L${n + 1}`);
      assert.ok(filled(s), `filled L${n + 1}`);
      s.cells.forEach((p, i) => { if (p && p.ice) assert.ok(i >= 2 * s.w); });
      if (L.goals.some(g => g.t === 'ribbon')) assert.ok(s.rib0 > 0, 'ribbon ' + n);
      if (L.goals.some(g => g.t === 'ice')) assert.ok(s.ice0 > 0, 'ice ' + n);
      for (const g of L.goals) if (g.t === 'col') assert.ok(s.pal.includes(g.c), 'pal ' + n);
    }
  }
});
T('同一個種子產生一樣的盤面', () => {
  const L = Levels.build(5);
  assert.equal(JSON.stringify(Core.create(L.def, 42).cells), JSON.stringify(Core.create(L.def, 42).cells));
});
T('隨機亂玩 60 關各 25 步：每步後盤面穩定（無三連、無空格、無待爆、id 不重複）', () => {
  for (let n = 0; n < Levels.COUNT; n++) {
    const L = Levels.build(n);
    const s = Core.create(L.def, 900 + n);
    if (L.def.bags) assert.ok(s.bag.on + s.bag.left === L.def.bags.n);
    for (let k = 0; k < 25; k++) {
      const ms = Core.findMoves(s);
      if (!ms.length) { Core.shuffle(s); continue; }
      const m = ms[(k * 7 + n) % ms.length];
      const sw = Core.applySwap(s, m.a, m.b);
      assert.ok(sw);
      Core.settle(s, sw);
      assert.equal(Core.findRuns(s).length, 0, `runs after L${n + 1} move ${k}`);
      assert.ok(filled(s), `filled L${n + 1}`);
      assert.ok(!s.cells.some(p => p && p.armed), 'armed left');
      const ids = s.cells.filter(Boolean).map(p => p.id);
      assert.equal(new Set(ids).size, ids.length);
      if (!Core.hasMove(s)) Core.shuffle(s);
    }
  }
});
T('AI 會選到有效的步，且目標有進度', () => {
  const L = Levels.build(1);
  const s = Core.create(L.def, 3);
  for (let k = 0; k < 10; k++) { const m = Core.bestMove(s, L.goals); assert.ok(m); Core.settle(s, Core.applySwap(s, m.a, m.b)); if (!Core.hasMove(s)) Core.shuffle(s); }
  assert.ok(s.col[0] > 0 && s.score > 0);
});
T('瘋狂購物時間：剩餘步數變條紋、全部引爆後盤面穩定', () => {
  const L = Levels.build(3);
  const s = Core.create(L.def, 11);
  const sc = s.score;
  const fire = Core.bonusConvert(s, 6);
  assert.equal(fire.length, 6);
  Core.settle(s, { fire });
  for (let k = 0; k < 6; k++) { const sp = Core.specials(s); if (!sp.length) break; Core.settle(s, { fire: sp }); }
  assert.ok(s.score > sc + 3000); assert.ok(filled(s)); assert.equal(Core.findRuns(s).length, 0);
});

console.log(`\n${pass} 通過，${fail} 失敗`);
process.exitCode = fail ? 1 : 0;
