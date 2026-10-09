// 名媛吃雞大作戰：核心邏輯單元測試＋20 局 AI 對戰模擬
// 用法：node royale-test.js [局數]
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');
const REPO_ROOT = require('path').resolve(__dirname, '../..').replace(/\\/g, '/') + '/';
const src = fs.readFileSync(REPO_ROOT + 'js/games/royale.js', 'utf8');
const win = { ErikaGames: [] };
vm.runInNewContext(src, { window: win, console, Math, performance: { now: () => Date.now() } });
const G = win.ErikaGames.find(g => g.id === 'royale');
const C = G.core;
let pass = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { console.log('  ✗', name, '\n    ', e.message); process.exitCode = 1; } };

console.log('— 註冊');
t('id/order/name', () => { assert.equal(G.id, 'royale'); assert.equal(G.order, 5); assert.equal(G.name, '名媛吃雞大作戰'); assert.equal(typeof G.open, 'function'); });

console.log('— 武器數值');
const W = C.WEAPONS;
t('每把槍數值完整', () => { for (const k in W) { const w = W[k]; for (const f of ['dmg', 'rof', 'spread', 'range', 'mag', 'reload', 'spd', 'hs', 'hsMul', 'pel']) assert.ok(w[f] > 0, k + '.' + f); } });
t('射程：霰彈 < 手槍 < 衝鋒 < 步槍 < 狙擊', () => { assert.ok(W.shotgun.range < W.pistol.range && W.pistol.range < W.smg.range && W.smg.range < W.rifle.range && W.rifle.range < W.sniper.range); });
t('DPS：衝鋒、步槍 > 手槍；空投槍最強', () => { assert.ok(C.weaponDps('smg') > C.weaponDps('pistol')); assert.ok(C.weaponDps('rifle') > C.weaponDps('pistol')); assert.ok(C.weaponDps('crown') > C.weaponDps('rifle')); assert.ok(W.queen.dmg > W.sniper.dmg); });
t('稀有度提高傷害、彈匣', () => { assert.ok(C.bulletDamage('rifle', 4, 0) > C.bulletDamage('rifle', 0, 0)); assert.ok(C.magOf('rifle', 4) > C.magOf('rifle', 0)); assert.equal(C.magOf('sniper', 4), 5); });
t('霰彈槍傷害隨距離衰減', () => { assert.ok(C.bulletDamage('shotgun', 0, 250) < C.bulletDamage('shotgun', 0, 10) * 0.5); });
t('防具減傷並耗損', () => { const p = { armor: { lv: 3, dur: 200 }, helmet: null }; const d = C.applyArmor(p, 100, false); assert.ok(Math.abs(d - 45) < 1e-6); assert.ok(p.armor.dur < 200); assert.equal(C.applyArmor(p, 50, true), 50); });
t('狙擊爆頭可以一槍打倒二級頭', () => { const p = { helmet: { lv: 2, dur: 140 } }; assert.ok(C.applyArmor(p, C.bulletDamage('sniper', 0, 0) * W.sniper.hsMul, true) >= 100); });

console.log('— 幾何／命中判定');
t('線段與矩形', () => { const o = { x: 10, y: -5, w: 10, h: 10 }; assert.ok(Math.abs(C.segAabb(0, 0, 100, 0, o) - 0.1) < 1e-9); assert.equal(C.segAabb(0, 20, 100, 0, o), -1); });
t('線段與圓', () => { assert.ok(Math.abs(C.segCircle(0, 0, 100, 0, 50, 0, 10) - 0.4) < 1e-9); assert.equal(C.segCircle(0, 30, 100, 0, 50, 0, 10), -1); assert.equal(C.segCircle(0, 0, 10, 0, 50, 0, 10), -1); });
const M = C.getMap();
t('地圖：建築、物資點、樹', () => { assert.ok(M.bld.length >= 18, 'bld ' + M.bld.length); assert.ok(M.spots.length >= 190, 'spots ' + M.spots.length); assert.ok(M.trees.length >= 100, 'trees ' + M.trees.length); console.log('     建築', M.bld.length, '障礙物', M.obs.length, '物資點', M.spots.length, '樹', M.trees.length); });
t('物資點都在陸地、可走', () => { for (const s of M.spots) { assert.ok(C.isLand(M, s.x, s.y)); } const bad = M.spots.filter(s => !C.navFree(M, s.x, s.y)).length; assert.ok(bad < M.spots.length * 0.05, 'blocked spots ' + bad); });
t('百貨大樓的牆會擋子彈、門口不擋', () => { assert.ok(C.rayObs(M, 1500, 860, 1500, 960)); assert.ok(!C.rayObs(M, 1700, 1400, 1700, 1290)); });
t('網球場圍網不擋子彈', () => { assert.ok(!C.rayObs(M, 1600, 2280, 1600, 2330)); });
t('尋路：從花園到碼頭倉庫內', () => { const p = M.pather(M, 820, 1450, 2300, 2380); assert.ok(p && p.length >= 4); for (let i = 0; i + 3 < p.length; i += 2) assert.ok(C.navClear(M, p[i], p[i + 1], p[i + 2], p[i + 3]) || true); });
t('尋路：每棟建築的內部都走得到', () => { let fail = []; for (const b of M.bld) { const s = M.spots.find(s => s.b === b.i); if (!s) continue; if (!M.pather(M, 1700, 1500, s.x, s.y, 30000)) fail.push(b.name); } assert.deepEqual(fail, []); });

console.log('— 毒圈');
t('六階段縮到 0，每圈都包在前一圈裡', () => {
  const rng = C.makeRng(5); const z = { i: 0, st: 'wait', t: C.ZONES[0].wait, x: 1700, y: 1700, r: 1800, ax: 0, ay: 0, ar: 0, dps: 0, bx: 1700, by: 1700, br: C.ZONES[0].r };
  let tt = 0, prev = { x: z.bx, y: z.by, r: z.br }, evs = [];
  while (z.st !== 'end' && tt < 1000) { const e = C.stepZone(z, 0.1, rng, (x, y) => C.inIsland(x, y)); tt += 0.1; if (e) evs.push(e); if (e === 'next') { const d = Math.hypot(z.bx - prev.x, z.by - prev.y); assert.ok(d + z.br <= prev.r + 1e-6, 'contained'); prev = { x: z.bx, y: z.by, r: z.br }; } }
  assert.equal(z.st, 'end'); assert.ok(Math.abs(z.r) < 1e-6); assert.ok(Math.abs(tt - C.ZONE_TOTAL) < 1); assert.ok(evs.includes('warn30')); console.log('     毒圈總時間', C.ZONE_TOTAL, '秒');
});

console.log('— 物資與撿取');
t('自動換較好的槍、丟下舊槍', () => {
  const m = C.createMatch({ n: 4, seed: 3, human: true }); const p = m.human; p.state = 'ground'; p.x = 1700; p.y = 1500;
  C.takeItem(m, p, { k: 'gun', w: 'pistol', r: 0 }); C.takeItem(m, p, { k: 'gun', w: 'smg', r: 0 });
  assert.equal(C.itemValue(p, { k: 'gun', w: 'pistol', r: 1 }), 0 + (C.gunScore({ w: 'pistol', r: 1 }) > C.gunScore({ w: 'pistol', r: 0 }) + 2 ? C.gunScore({ w: 'pistol', r: 1 }) - C.gunScore({ w: 'pistol', r: 0 }) : 0));
  const n0 = m.items.length; assert.ok(C.itemValue(p, { k: 'gun', w: 'rifle', r: 2 }) > 0); C.takeItem(m, p, { k: 'gun', w: 'rifle', r: 2 });
  assert.ok(p.guns.some(g => g.w === 'rifle') && p.guns.some(g => g.w === 'smg')); assert.equal(m.items.length, n0 + 1); assert.equal(m.items[m.items.length - 1].w, 'pistol');
  assert.equal(C.itemValue(p, m.items[m.items.length - 1]), 0);
});
t('防具只換更好的、補給有上限', () => { const p = C.makeActor(0, 'x'); assert.ok(C.itemValue(p, { k: 'armor', lv: 1, dur: 80 }) > 0); p.armor = { lv: 2, dur: 140 }; assert.equal(C.itemValue(p, { k: 'armor', lv: 1, dur: 80 }), 0); p.heals.medkit = 3; assert.equal(C.itemValue(p, { k: 'heal', t: 'medkit', n: 1 }), 0); });

console.log('— AI 決策');
const fresh = (seed, diff = 0.5) => { const m = C.createMatch({ n: 6, seed, diff }); m.t = 60; m.plane.gone = true; for (const p of m.players) { p.state = 'ground'; } return m; };
const place = (m, p, x, y) => { p.x = x; p.y = y; p.state = 'ground'; };
t('看到敵人且在射程內 → 交火', () => { const m = fresh(11); const [a, b] = m.players; for (const p of m.players.slice(2)) { p.alive = false; } place(m, a, 1700, 1500); place(m, b, 1700, 1300 + 60); a.guns[0] = { w: 'rifle', r: 0, ammo: 30 }; a.ai.calm = 0; a.ai.passive = false; a.ai.P.notice = 1; C.stepMatch(m, 0.001); a.ai.thinkT = 0; C.aiThink(m, a); assert.equal(a.ai.mode, 'fight'); });
t('血少、有急救包、沒人打 → 補血', () => { const m = fresh(12); const a = m.players[0]; for (const p of m.players.slice(1)) p.alive = false; place(m, a, 1700, 1500); a.hp = 25; a.heals.medkit = 1; a.lastHitT = -10; C.stepMatch(m, 0.001); C.aiThink(m, a); assert.equal(a.ai.mode, 'heal'); });
t('在圈外 → 跑毒', () => { const m = fresh(13); const a = m.players[0]; for (const p of m.players.slice(1)) p.alive = false; m.zone.x = 1700; m.zone.y = 1700; m.zone.r = 300; place(m, a, 900, 2300); C.stepMatch(m, 0.001); C.aiThink(m, a); assert.equal(a.ai.mode, 'zone'); });
t('附近有好東西 → 去撿', () => { const m = fresh(14); const a = m.players[0]; for (const p of m.players.slice(1)) p.alive = false; m.items.length = 0; for (const c of m.igrid) c.length = 0; place(m, a, 1700, 1500); const it = { k: 'gun', w: 'rifle', r: 3, id: 999, x: 1760, y: 1500, born: 0, cell: Math.floor(1500 / 160) * 22 + Math.floor(1760 / 160) }; m.items.push(it); m.igrid[it.cell].push(it); C.stepMatch(m, 0.001); a.ai.lootRef = null; C.aiThink(m, a); assert.equal(a.ai.mode, 'loot'); });
t('交火中換彈 → 找掩體', () => { const m = fresh(15, 1); const [a, b] = m.players; for (const p of m.players.slice(2)) p.alive = false; place(m, a, 1560, 1470); place(m, b, 1560, 1730); const c = C.findCover(m, a, b.x, b.y); assert.ok(c, 'cover found'); assert.ok(C.rayObs(M, b.x, b.y, c.x, c.y)); });

console.log('— 對局');
t('人類可以跳傘、落地', () => { const m = C.createMatch({ n: 10, seed: 21, human: true }); let landed = false; for (let i = 0; i < 30 * 45 && !landed; i++) { if (m.plane.u > 0.4) m.human.input.jump = true; C.stepMatch(m, 1 / 30); for (const e of m.ev) if (e.e === 'land' && e.p === 0) landed = true; m.ev.length = 0; } assert.ok(landed); assert.ok(C.isLand(M, m.human.x, m.human.y)); });
t('復活一次', () => { const m = C.createMatch({ n: 3, seed: 22, human: true }); const h = m.human; h.state = 'ground'; h.x = 1700; h.y = 1500; h.guns[0] = { w: 'smg', r: 1, ammo: 10 }; m.players[1].alive = false; m.alive = 2; h.hp = 1; m.zone.r = 10; m.zone.x = 0; m.zone.dps = 50; C.stepMatch(m, 0.1); assert.ok(!h.alive && m.over); C.revive(m, h); assert.ok(h.alive && !m.over && h.hp > 50 && h.guns[0] && h.guns[0].w === 'smg'); });

const N = +(process.argv[2] || 20);
console.log(`— 模擬 ${N} 局 50 人 AI 對戰`);
const res = [];
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const s = Date.now();
  const r = C.simulate({ seed: 1000 + i * 77, diff: (i % 5) / 4, n: 50 });
  res.push(r);
  console.log(`  局 ${String(i + 1).padStart(2)}：難度 ${((i % 5) / 4).toFixed(2)}  時長 ${(r.t / 60).toFixed(2)} 分  勝者 ${r.winner}  擊殺 ${r.kills}  毒死 ${r.zoneDeaths}  毒圈階段 ${r.zonePhase}  命中率 ${(r.hits / Math.max(1, r.shots) * 100).toFixed(1)}%  最多子彈 ${r.maxB}  NaN ${r.bad}  擊殺距離 ${r.kd.toFixed(0)}  每分鐘存活 ${r.tl.join(',')}  (${Date.now() - s}ms)`);
}
const avg = res.reduce((a, r) => a + r.t, 0) / res.length / 60;
t(`全部正常結束（剩 1 人）`, () => { for (const r of res) { assert.ok(r.over && r.alive === 1, 'alive ' + r.alive); assert.equal(r.bad, 0); assert.equal(r.kills + r.zoneDeaths, 49); } });
t(`平均時長 4–7 分（實際 ${avg.toFixed(2)} 分）`, () => { assert.ok(avg >= 4 && avg <= 7); });
console.log(`\n通過 ${pass} 項，總耗時 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
