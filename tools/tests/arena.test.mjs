// 名媛對決：純邏輯單元測試 + 100 場 AI 對 AI 模擬
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const REPO_ROOT = decodeURIComponent(new URL('../../', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');

const src = fs.readFileSync(REPO_ROOT + 'js/games/arena.js', 'utf8');
const win = {};
vm.runInNewContext(src, { window: win, console, Math, Map, Set, Object, Array, JSON, Promise, setTimeout, clearTimeout });
const game = win.ErikaGames.find(g => g.id === 'arena');
const C = game.core;
let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log('  ✓', name); };

console.log('== 段位 ==');
ok('青銅 0 星輸了不降級', () => { const r = C.rankApply({ tier: 0, stars: 0 }, false); assert.equal(r.tier, 0); assert.equal(r.stars, 0); });
ok('贏 +1 星', () => { const r = C.rankApply({ tier: 1, stars: 1 }, true); assert.deepEqual([r.tier, r.stars, r.promo], [1, 2, false]); });
ok('滿星再贏晉級', () => { const r = C.rankApply({ tier: 0, stars: 3 }, true); assert.deepEqual([r.tier, r.stars, r.promo], [1, 1, true]); });
ok('0 星輸了降級到上一段次高星', () => { const r = C.rankApply({ tier: 2, stars: 0 }, false); assert.deepEqual([r.tier, r.stars, r.demo], [1, 2, true]); });
ok('MVP 保星', () => { const r = C.rankApply({ tier: 3, stars: 2 }, false, true); assert.deepEqual([r.tier, r.stars, r.kept], [3, 2, true]); });
ok('傳說無上限', () => { let r = { tier: 6, stars: 9 }; r = C.rankApply(r, true); assert.deepEqual([r.tier, r.stars], [6, 10]); });
ok('每段 3–5 星', () => { for (const t of C.TIERS) assert.ok(t.stars >= 3 && t.stars <= 5); });
ok('段位名稱', () => { assert.equal(C.rankName({ tier: 2, stars: 0 }), '黃金'); assert.equal(C.rankName({ tier: 6, stars: 3 }), '傳說 3★'); });
ok('rankScore 單調遞增', () => { let r = { tier: 0, stars: 0 }, last = -1; for (let i = 0; i < 40; i++) { const s = C.rankScore(r); assert.ok(s > last); last = s; r = C.rankApply(r, true); } });

console.log('== 成長與獎勵 ==');
ok('成長倍率（共用名冊 lv1–60、star1–6）', () => { assert.equal(C.growthMult(1, 1), 1); assert.ok(Math.abs(C.growthMult(60, 6) - 2.475 * 1.4) < 1e-9); assert.equal(C.growthMult(99, 9), C.growthMult(60, 6)); });
ok('勝利獎勵 = 一注 × 段位係數＋碎片 1–3＋原石', () => { const r = C.rewards({ win: true, tier: 4, bet: 1000, rnd: () => 0, resUnit: 500 }); assert.equal(r.coins, 2400); assert.equal(r.shards, 1); assert.equal(r.ore, 400); assert.equal(C.rewards({ win: true, tier: 0, bet: 1, rnd: () => 0.99 }).shards, 3); });
ok('超神模式雙倍', () => { const a = C.rewards({ win: true, tier: 0, bet: 1000, rnd: () => 0.5 }), b = C.rewards({ win: true, tier: 0, bet: 1000, rnd: () => 0.5, superMode: true }); assert.equal(b.coins, a.coins * 2); assert.equal(b.shards, a.shards * 2); assert.equal(b.ore, a.ore * 2); });
ok('輸了也有安慰獎', () => { const r = C.rewards({ win: false, tier: 0, bet: 1000, rnd: () => 0 }); assert.equal(r.coins, 250); assert.equal(r.shards, 1); assert.equal(r.ore, 0); });

console.log('== 戰鬥 ==');
ok('建立對局', () => {
  const S = C.newMatch({ seed: 7, ally: ['erika', 'vivi', 'fumi'], enemy: ['vita', 'chiyo', 'shino'] });
  assert.equal(S.heroList.length, 6); assert.equal(S.units.filter(u => u.kind === 'tower').length, 4); assert.equal(S.units.filter(u => u.kind === 'crystal').length, 2);
  const inner = S.units.find(u => u.kind === 'tower' && u.tier === 2 && u.team === 1); assert.ok(inner.invul, '內塔一開始無敵');
  assert.ok(S.units.find(u => u.kind === 'crystal' && u.team === 1).invul, '主堡一開始無敵');
});
ok('王國研究攻擊加成只作用在我方（allyAtk）', () => {
  const a = C.newMatch({ seed: 1, ally: ['erika', 'vivi', 'fumi'], enemy: ['erika', 'vita', 'shino'] });
  const b = C.newMatch({ seed: 1, ally: ['erika', 'vivi', 'fumi'], enemy: ['erika', 'vita', 'shino'], allyAtk: 1.2 });
  assert.ok(Math.abs(C.player(b).atk / C.player(a).atk - 1.2) < 1e-9); assert.equal(C.player(b).maxHp, C.player(a).maxHp);
  assert.equal(b.heroes[1][0].atk, a.heroes[1][0].atk);
});
ok('共用名冊成長倍率（含時尚加成）會反映在血量與攻擊', () => {
  const m = C.growthMult(10, 3) * 1.09, a = C.newMatch({ seed: 2, ally: ['erika', 'vivi', 'fumi'], enemy: ['chiyo', 'vita', 'shino'], allyMult: [m, 1, 1] });
  assert.ok(Math.abs(C.player(a).maxHp - C.HEROES.erika.hp * m) < 1e-6); assert.ok(Math.abs(C.player(a).atk - C.HEROES.erika.atk * m) < 1e-6);
});
ok('玩家技能：沒有目標時不會浪費冷卻', () => {
  const S = C.newMatch({ seed: 3, ally: ['shino', 'vivi', 'fumi'], enemy: ['vita', 'chiyo', 'erika'] });
  const p = C.player(S); const ev = C.step(S, 1 / 60, { cast: [0] });
  assert.ok(ev.some(e => e.t === 'castFail' && e.why === 'none')); assert.equal(p.cds[0], 0);
});
ok('玩家技能：自身範圍技能隨時可放', () => {
  const S = C.newMatch({ seed: 3, ally: ['fumi', 'vivi', 'shino'], enemy: ['vita', 'chiyo', 'erika'] });
  const p = C.player(S); C.step(S, 1 / 60, { cast: [1] }); assert.ok(p.cds[1] > 9 && p.shield > 0);
});
ok('大招需要滿能量', () => {
  const S = C.newMatch({ seed: 3, ally: ['vivi', 'erika', 'shino'], enemy: ['vita', 'chiyo', 'fumi'] });
  const p = C.player(S); p.energy = 50; let ev = C.step(S, 1 / 60, { cast: [2] });
  assert.ok(ev.some(e => e.t === 'castFail' && e.why === 'cd')); p.energy = 100; p.hp = p.maxHp * 0.5; ev = C.step(S, 1 / 60, { cast: [2] });
  assert.ok(ev.some(e => e.t === 'ult')); assert.ok(p.energy < 5); assert.ok(p.hp > p.maxHp * 0.5);
});
ok('搖桿移動', () => {
  const S = C.newMatch({ seed: 3, ally: ['vita', 'erika', 'shino'], enemy: ['vivi', 'chiyo', 'fumi'] });
  const p = C.player(S), y0 = p.y; for (let i = 0; i < 60; i++) C.step(S, 1 / 60, { move: { x: 0, y: -1 } }); assert.ok(y0 - p.y > 100);
});
ok('防禦塔打英雄、擊殺會記分與廣播', () => {
  const S = C.newMatch({ seed: 5, ally: ['erika', 'vivi', 'fumi'], enemy: ['vita', 'chiyo', 'shino'] });
  const p = C.player(S); p.x = 170; p.y = 700; p.hp = 50; let kill = null;
  for (let i = 0; i < 300 && !kill; i++) for (const e of C.step(S, 1 / 60, {})) if (e.t === 'kill') kill = e;
  assert.ok(kill && kill.victim === p.id && kill.first); assert.equal(S.score[1], 1); assert.ok(p.respawn > 0);
});
ok('復活', () => { const S = C.newMatch({ seed: 5, ally: ['erika', 'vivi', 'fumi'], enemy: ['vita', 'chiyo', 'shino'] }); const p = C.player(S); p.alive = false; assert.ok(C.revive(S, p)); assert.ok(p.alive && p.hp > 0); });
ok('同種子結果相同（可重現）', () => {
  const o = { seed: 99, ally: ['erika', 'vivi', 'fumi'], enemy: ['vita', 'chiyo', 'shino'] };
  const a = C.simulate(o), b = C.simulate(o); assert.equal(a.t, b.t); assert.deepEqual(a.score, b.score);
});

console.log('== 100 場 AI 對 AI ==');
const ids = C.HERO_IDS;
function comp(r) { const pool = [...ids]; const out = []; while (out.length < 6) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); return out; }
function batch(n, mk) {
  const r = C.rng(12345); const res = [];
  for (let i = 0; i < n; i++) { const c = comp(r), o = Object.assign({ seed: 1000 + i, ally: c.slice(0, 3), enemy: c.slice(3) }, mk ? mk(i) : {}); res.push(C.simulate(o)); }
  return res;
}
function report(name, res) {
  const T = res.map(r => r.t).sort((a, b) => a - b), w0 = res.filter(r => r.winner === 0).length;
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  const inWin = T.filter(t => t >= 120 && t <= 240).length;
  console.log(`  ${name}：我方勝率 ${(w0 / res.length * 100).toFixed(0)}%｜時長 平均 ${avg(T).toFixed(0)}s 中位 ${T[T.length >> 1].toFixed(0)}s 最短 ${T[0].toFixed(0)}s 最長 ${T[T.length - 1].toFixed(0)}s｜2–4 分鐘內 ${inWin}/${res.length}｜擊殺/場 ${avg(res.map(r => r.log.kills)).toFixed(1)}｜大招/場 ${avg(res.map(r => r.log.ults)).toFixed(1)}｜技能/場 ${avg(res.map(r => r.log.skills)).toFixed(0)}｜時間判定 ${res.filter(r => r.t >= 300).length}｜首塔 ${avg(res.map(r => r.log.firstTower)).toFixed(0)}s 塔/場 ${avg(res.map(r => r.log.towers)).toFixed(1)}`);
  return { w0: w0 / res.length, inWin: inWin / res.length, T };
}
const t0 = Date.now();
const even = report('勢均力敵', batch(100));
console.log(`  （100 場耗時 ${((Date.now() - t0) / 1000).toFixed(1)} 秒）`);
const hero = {}; for (const r of batch(100)) for (const h of r.heroes) { const s = hero[h.hid] = hero[h.hid] || { g: 0, w: 0, k: 0, d: 0, a: 0, dmg: 0, heal: 0 }; s.g++; s.w += (h.team === r.winner); s.k += h.k; s.d += h.d; s.a += h.a; s.dmg += h.heroDmg; s.heal += h.heal; }
for (const [id, s] of Object.entries(hero)) console.log(`    ${id.padEnd(6)} 勝率 ${(s.w / s.g * 100).toFixed(0).padStart(3)}%  KDA ${(s.k / s.g).toFixed(1)}/${(s.d / s.g).toFixed(1)}/${(s.a / s.g).toFixed(1)}  英雄傷害 ${(s.dmg / s.g).toFixed(0)}  治療護盾 ${(s.heal / s.g).toFixed(0)}`);
if (process.env.QUICK) process.exit(0);
const strong = report('我方成長 ×1.35', batch(60, () => ({ allyMult: [1.35, 1.35, 1.35] })));
const legend = report('傳說段敵人（敵 ×1.72、AI 0.77）vs 我方 ×1.72', batch(60, () => ({ allyMult: [1.72, 1.72, 1.72], enemyMult: [1.72, 1.72, 1.72], enemyAI: C.enemySkill({ tier: 6, stars: 0 }), allyAI: 0.68 })));
const superM = report('超神模式（全隊 +30%）', batch(60, () => ({ superMode: true })));
const coach = report('教練代打', batch(60, () => ({ coach: true })));
const bronze = report('青銅新手（敵 AI 0.35）', batch(60, () => ({ enemyAI: C.enemySkill({ tier: 0, stars: 0 }) })));

assert.ok(even.w0 > 0.35 && even.w0 < 0.65, '勢均力敵時勝率應接近 50%');
assert.ok(even.inWin >= 0.8, '至少 80% 對局落在 2–4 分鐘');
assert.ok(strong.w0 > even.w0, '成長有感');
assert.ok(superM.w0 > 0.7, '超神模式明顯有利');
assert.ok(coach.w0 >= even.w0 - 0.05, '教練代打不能比自動差');
assert.ok(bronze.w0 > even.w0, '青銅段的對手 AI 比較弱');
assert.ok(legend.w0 < 0.6, '傳說段的對手 AI 比較強');
console.log(`\n全部通過（${pass} 項單元測試 + 模擬檢查）`);
