// 名媛王國 純函式單元測試：node kd-test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const REPO_ROOT = decodeURIComponent(new URL('../../', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');

const src = fs.readFileSync(REPO_ROOT + 'js/kingdom.js', 'utf8');
const store = {};
const fakeApi = { store: id => (store[id] = store[id] || {}), sandbox: false, coins: 1e15, monthCard: false, fmt: n => String(Math.round(n)), on() {}, heroes: () => null, incomePerSec: () => 1000 };
const win = { ErikaAPI: fakeApi };
vm.runInNewContext(src, { window: win, console, Date, Math, JSON, setTimeout, clearTimeout });
const K = win.ErikaKingdom, C = K._core;
const H = 3600e3, M = 60e3;
let pass = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('✓', name); } catch (e) { console.error('✗', name, '\n ', e.message); process.exitCode = 1; } };
const T0 = new Date(2026, 9, 9, 10, 0, 0).getTime();

test('freshState / ensure 補齊欄位、可重複呼叫', () => {
  const s = C.freshState(T0);
  assert.equal(C.lvl(s, 'town'), 1);
  const partial = { v: 1, b: { town: { lv: 3 } }, res: { silk: 5 } };
  C.ensure(partial, T0);
  assert.equal(partial.b.town.lv, 3);
  assert.ok(Array.isArray(partial.troops.guard) && partial.troops.guard.length === 10);
  assert.ok(partial.map && Array.isArray(partial.map.nodes));
  const again = JSON.stringify(C.ensure(partial, T0));
  assert.equal(JSON.stringify(C.ensure(partial, T0)), again);
});

test('資源生產：線性累積、12 小時上限、收成後歸零', () => {
  const s = C.freshState(T0); s.b.silk.acc = 0;
  const r = C.prodRate(s, 'silk');
  assert.ok(Math.abs(C.stored(s, 'silk', T0 + H) - r) < 1e-6);
  assert.ok(Math.abs(C.stored(s, 'silk', T0 + 30 * H) - r * 12) < 1e-6, '離線上限 12 小時');
  const before = s.res.silk, got = C.collect(s, 'silk', T0 + 2 * H);
  assert.equal(s.res.silk, before + got);
  assert.ok(C.stored(s, 'silk', T0 + 2 * H) < 1);
});

test('升級：條件、扣資源、時間到才完成（離線補算）', () => {
  const s = C.freshState(T0);
  assert.equal(C.upgBlock(s, 'town', false).code, 'req', '本館 Lv.2 需要香料庫');
  C.beginUpgrade(s, 'spice', T0, false);
  assert.equal(C.upgBlock(s, 'silk', false).code, 'req', '其他建築不能超過本館');
  C.process(s, T0 + 1000);
  assert.equal(C.lvl(s, 'spice'), 0, '還沒到時間');
  const ev = C.process(s, T0 + 10 * H);
  assert.equal(C.lvl(s, 'spice'), 1);
  assert.ok(ev.some(e => e.type === 'built' && e.b === 'spice'));
  const silk0 = s.res.silk, c = C.upgCost('town', 2);
  C.beginUpgrade(s, 'town', T0 + 10 * H, false);
  assert.equal(s.res.silk, silk0 - c.silk);
  assert.equal(C.freeQueue(s, false), -1, '只有一條隊列');
  assert.equal(C.freeQueue(s, true), 1, '月卡開第二條');
});

test('閨蜜會館自動幫忙縮短時間', () => {
  const s = C.freshState(T0);
  for (const id of C.BIDS) s.b[id].lv = 15;
  s.res = { silk: 1e9, spice: 1e9, ore: 1e9, leaf: 1e9 };
  const j = C.beginUpgrade(s, 'town', T0, false);
  assert.equal(j.hmax, 18);
  const end0 = C.jobEnd(j);
  C.process(s, T0 + 10 * M);
  assert.equal(j.helps, 18);
  assert.ok(C.jobEnd(j) < end0 - 18 * 20e3 + 1, '每次至少 20 秒');
});

test('研究：前置條件、學院等級、完成後 perk 生效且有上限', () => {
  const s = C.freshState(T0);
  assert.equal(C.techBlock(s, 'p1').code, 'noacad');
  for (const id of C.BIDS) s.b[id].lv = 30;
  s.res = { silk: 1e12, spice: 1e12, ore: 1e12, leaf: 1e12 };
  assert.equal(C.techBlock(s, 'p2').code, 'pre');
  C.beginResearch(s, 'p1', T0);
  C.process(s, T0 + 3 * H);
  assert.equal(s.tech.p1, 1);
  assert.equal(C.perk(s, 'm3_moves'), 1);
  for (const t of C.TECH) s.tech[t.id] = t.max;
  assert.equal(JSON.stringify(C.PERKS.map(k => C.perk(s, k))), '[5,30,3,20,5]');
});

test('訓練：完成後要收下才入營', () => {
  const s = C.freshState(T0); s.b.guard.lv = 1; s.b.town.lv = 2;
  assert.equal(C.trainBlock(s, 'guard', 2, 10).code, 'tier');
  C.beginTrain(s, 'guard', 1, 10, T0);
  C.process(s, T0 + H);
  assert.equal(s.troops.guard[0], 0);
  assert.equal(C.claimTrain(s, 'guard'), 10);
  assert.equal(s.troops.guard[0], 10);
});

test('戰鬥：同樣亂數結果一樣；兵多的贏；克制有效', () => {
  const side = (u, m = 1) => ({ units: u, atkM: { guard: m, car: m, pap: m }, hpM: { guard: 1, car: 1, pap: 1 }, def: 0 });
  const U = (g, c, p) => ({ guard: [g, 0, 0, 0, 0, 0, 0, 0, 0, 0], car: [c, 0, 0, 0, 0, 0, 0, 0, 0, 0], pap: [p, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
  const a = C.battle(side(U(100, 100, 100)), side(U(50, 50, 50)), C.seeded(1));
  const b = C.battle(side(U(100, 100, 100)), side(U(50, 50, 50)), C.seeded(1));
  assert.deepEqual(a, b);
  assert.ok(a.win && a.stars >= 2);
  const g = C.battle(side(U(100, 0, 0)), side(U(0, 0, 100)), C.seeded(2)); // 保鑣克狗仔
  const p = C.battle(side(U(0, 0, 100)), side(U(100, 0, 0)), C.seeded(2));
  assert.ok(g.ar > p.ar, '克制方剩下比較多');
});

test('出征據點：抵達戰鬥→戰報→回城入帳；碎片與粉鑽進 out 交給主程式', () => {
  const s = C.freshState(T0);
  for (const id of C.BIDS) s.b[id].lv = 10;
  s.troops.guard[3] = 400; s.troops.car[3] = 400; s.troops.pap[3] = 400;
  C.fillMap(s);
  const node = s.map.nodes.find(n => n.kind === 'camp' && n.lv === 1);
  const units = C.autoUnits(s, C.marchCap(10, 1));
  assert.equal(C.marchBlock(s, 'camp', node, units, 'erika', T0), null);
  const stam0 = C.stamNow(s, T0);
  C.beginMarch(s, 'camp', node, units, 'erika', T0);
  assert.equal(Math.round(C.stamNow(s, T0)), Math.round(stam0 - 10));
  const silk0 = s.res.silk;
  const ev = C.process(s, T0 + H);
  const rep = ev.find(e => e.type === 'report').rep;
  assert.ok(rep.win);
  assert.ok(ev.some(e => e.type === 'home'));
  assert.equal(s.marches.length, 0);
  assert.ok(s.res.silk > silk0, '戰利品入帳');
  assert.equal(s.map.maxCamp, 1);
  assert.ok(s.out.some(o => o.gems), '首勝粉鑽進 out');
});

test('採集：負重與剩餘量限制、回城入帳', () => {
  const s = C.freshState(T0);
  for (const id of C.BIDS) s.b[id].lv = 6;
  s.troops.guard[0] = 300;
  C.fillMap(s);
  const node = s.map.nodes.find(n => n.kind === 'res' && n.type === 'silk');
  const left0 = node.left, silk0 = s.res.silk;
  C.beginMarch(s, 'gather', node, C.autoUnits(s, 300), 'fumi', T0);
  C.process(s, T0 + 6 * H);
  const got = s.res.silk - silk0;
  assert.ok(got > 0 && got <= left0);
});

test('黃牛王：每天 3 次、傷害累積、排行', () => {
  const s = C.freshState(T0);
  for (const id of C.BIDS) s.b[id].lv = 8;
  s.troops.guard[2] = 500;
  const B = C.ensureBoss(s, T0);
  for (let i = 0; i < 3; i++) { const t = T0 + i * H, u = C.autoUnits(s, 100); assert.equal(C.marchBlock(s, 'boss', null, u, null, t), null); C.beginMarch(s, 'boss', null, u, null, t); C.process(s, t + H - 1); }
  assert.equal(C.marchBlock(s, 'boss', null, C.autoUnits(s, 100), null, T0 + 3 * H).code, 'nohits');
  C.process(s, T0 + H);
  assert.ok(B.dmg > 0);
  const r = C.bossRank(B, T0 + H);
  assert.equal(r.rows.length, 8);
  assert.ok(C.bossMilestones(B)[0].need <= B.dmg, '3 次出擊至少拿到第一個里程碑');
});

test('主線任務：領取、娛樂城任務可略過', () => {
  const s = C.freshState(T0);
  assert.ok(!C.questDone(s));
  assert.ok(C.collect(s, 'silk', T0) > 0, '一開始就有絲綢可以收');
  assert.ok(C.questDone(s));
  const r = C.claimQuest(s);
  assert.ok(r && s.qi === 1);
  const i = C.MAIN.findIndex(q => q.k === 'ev');
  s.qi = i;
  assert.equal(C.qVal(s, C.MAIN[i]), 0);
  s.evc[C.MAIN[i].ev] = 1;
  assert.ok(C.questDone(s));
  s.qi = i; s.evc = {};
  assert.ok(C.skipQuest(s));
  assert.equal(C.MAIN.length > 100, true);
});

test('每日任務隔天重置', () => {
  const s = C.freshState(T0);
  C.bump(s, 'collect', 5);
  assert.equal(s.day.c.collect, 5);
  C.process(s, T0 + 24 * H);
  assert.equal(s.day.c.collect, undefined);
});

test('精力：6 分鐘回 1 點、上限 100', () => {
  const s = C.freshState(T0);
  C.stamAdd(s, -50, T0);
  assert.equal(Math.round(C.stamNow(s, T0 + 60 * M)), 60);
  assert.equal(C.stamNow(s, T0 + 100 * H), 100);
});

test('incomeMult：前期約 1.1、全滿落在 8–15', () => {
  const s = C.freshState(T0);
  const m0 = C.incomeMult(s);
  assert.ok(m0 >= 1 && m0 < 1.2, m0);
  for (const id of C.BIDS) s.b[id].lv = 30;
  for (const t of C.TECH) s.tech[t.id] = t.max;
  C.setHeroes(C.HEROES.map(h => ({ id: h.id, lv: 60, star: 6, shards: 0, power: 500 })));
  const m = C.incomeMult(s);
  console.log('   全滿 incomeMult =', m.toFixed(2));
  assert.ok(m >= 8 && m <= 15, m);
  C.setHeroes(C.HEROES.map(h => ({ id: h.id, lv: 1, star: h.id === 'erika' ? 2 : 1 })));
});

test('對外介面：grant / resUnit / perk / townLevel / floorUnlockReq / reset', () => {
  const st = fakeApi.store('kingdom');
  assert.equal(K.townLevel(), 1);
  assert.ok(st.v === 1, '第一次讀取就建立存檔');
  const silk0 = st.res.silk;
  assert.ok(K.grant({ res: { silk: 500, ore: 20, bogus: 9 }, speedup: 30 }));
  assert.equal(st.res.silk, silk0 + 500);
  assert.equal(st.res.ore, 20);
  assert.equal(st.items.spd, 10 + 30);
  assert.ok(K.resUnit() >= 100);
  st.b.silk.lv = 20; st.b.town.lv = 21;
  assert.ok(K.resUnit() > 5000);
  assert.ok(K.resUnit('leaf') < K.resUnit('silk'));
  assert.equal(K.perk('m3_moves'), 0);
  assert.equal(K.perk('nope'), 0);
  assert.deepEqual([0, 3, 11].map(i => K.floorUnlockReq(i)), [1, 6, 27]);
  assert.ok(K.incomeMult() >= 1);
  delete store.kingdom;
  K.reset();
  assert.equal(K.townLevel(), 1);
});

test('長時間離線（3 天）一次補算不出錯', () => {
  const s = C.freshState(T0);
  for (const id of C.BIDS) s.b[id].lv = 12;
  s.res = { silk: 1e7, spice: 1e7, ore: 1e7, leaf: 1e7 };
  s.troops.guard[3] = 500;
  C.fillMap(s);
  C.beginUpgrade(s, 'town', T0, true); C.beginUpgrade(s, 'wall', T0, true);
  C.beginResearch(s, 'e1', T0);
  C.beginTrain(s, 'guard', 4, 50, T0);
  const node = s.map.nodes.find(n => n.kind === 'res');
  C.beginMarch(s, 'gather', node, C.autoUnits(s, 200), 'fumi', T0);
  const ev = C.process(s, T0 + 72 * H);
  assert.equal(s.q.filter(Boolean).length, 0);
  assert.equal(s.rsch, null);
  assert.ok(s.train.guard.done);
  assert.equal(s.marches.length, 0);
  assert.ok(ev.length >= 5);
});

console.log(`\n${pass} 個測試通過`);
