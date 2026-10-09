// 貴婦麻將館 Core 單元測試：node core.test.mjs
import { loadCore, K } from './load.mjs';
const C = loadCore();
let pass = 0, fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('✗', msg); } }
function same(a, b, msg) { ok(eq(a, b), `${msg}\n   得到 ${JSON.stringify(a)}\n   預期 ${JSON.stringify(b)}`); }
const cnt = s => C.countsK(K(s));
const names = ks => ks.map(C.tileName).join(' ');

// ---------------- 判胡 ----------------
ok(C.isWin(cnt('123m 456m 789m 123p 456p 11z')), '基本 5 組＋1 對');
ok(C.isWin(cnt('111m 222m 333m 444m 555m 66m')), '清一色碰碰');
ok(!C.isWin(cnt('123m 456m 789m 123p 456p 12z')), '缺將不胡');
ok(!C.isWin(cnt('123m 456m 789m 124p 456p 11z')), '缺順不胡');
ok(C.isWin(cnt('22z')), '全求人只剩一對');
ok(C.isWin(cnt('111m 22m')), '5 張：1 組＋1 對');
ok(!C.isWin(cnt('11z 22z 33z 44z 55z 66z 77z 1m 1m 2m 2m 3m 3m 4m 4m 5m')), '七對子不算（16 張不合法）');
ok(!C.isWin(cnt('11m 22m 33m 44m 55m 66m 77m 88m 9m')), '17 張全對子不是 5 組 1 對');
ok(C.isWin(cnt('112233m 445566p 789s 55z')), '一般型：112233＝123+123');

// ---------------- 聽牌 ----------------
same(names(C.waits(cnt('123m 456m 789m 123p 45p 11z'))), '三筒 六筒', '兩面聽');
same(names(C.waits(cnt('123m 456m 789m 123p 46p 11z'))), '五筒', '中洞');
same(names(C.waits(cnt('123m 456m 789m 123p 12p 11z'))), '三筒', '邊張');
same(names(C.waits(cnt('123m 456m 789m 123p 456p 1z'))), '東', '單吊');
same(names(C.waits(cnt('123m 456m 789m 123p 11p 11z'))), '一筒 四筒 東', '雙碰＋11123 邊延伸');
same(names(C.waits(cnt('1112345678999m 456p'))), '一萬 二萬 三萬 四萬 五萬 六萬 七萬 八萬 九萬', '九蓮寶燈型聽 9 面');
same(names(C.waits(cnt('2345678m 123p 456p 789p'))), '二萬 五萬 八萬', '三面聽 258');
same(names(C.waits(cnt('1m'))), '一萬', '只剩 1 張');
same(names(C.waits(cnt('1111m 234p 567p 789p 23s'))), '', '1111m＋23s 是一向聽，不聽');
same(names(C.waits(cnt('1111m 2m 345p 678p 123s 99s'))), '三萬', '1111m＋2m：111＋12 聽三萬（不會聽第五張一萬）');

// ---------------- 拆牌 ----------------
const ds = C.decompositions(cnt('111222333m 456p 789p 55s'));
same(ds.length, 2, '111222333 兩種拆法（刻子／順子）');

// ---------------- 向聽數 ----------------
same(C.shanten(cnt('123m 456m 789m 123p 456p 11z')), -1, '已胡 -1');
same(C.shanten(cnt('123m 456m 789m 123p 45p 11z')), 0, '聽牌 0');
same(C.shanten(cnt('123m 456m 789m 123p 4p 8p 11z')), 1, '一向聽');
same(C.shanten(cnt('19m 19p 19s 1234567z 159m 4p 7s')), 9, '十三么形向聽 9（16 張）');
same(C.shanten(cnt('1m')), 0, '單張 = 聽');
same(C.shanten(cnt('12m')), 0, '2 張無對：打一張即單吊聽牌 → 0');

// 隨機手牌：shanten 與精確判斷一致性
const rng = C.rngFrom(12345);
function randHand(n) { const w = C.shuffle(Array.from({ length: 136 }, (_, i) => i), rng); return C.countsOf(w.slice(0, n)); }
function exactLE1(c) { // 3M+1：是否一向聽以內（摸一張再打一張可以聽）
  if (C.waits(c).length) return 0;
  for (let j = 0; j < 34; j++) {
    if (c[j] >= 4) continue;
    c[j]++;
    for (let d = 0; d < 34; d++) { if (!c[d] || d === j) continue; c[d]--; const w = C.waits(c).length; c[d]++; if (w) { c[j]--; return 1; } }
    c[j]--;
  }
  return 2;
}
let mism = 0, mism4 = 0, checked = 0;
for (let it = 0; it < 4000; it++) {
  const n = [16, 13, 10, 7, 4][it % 5];
  const c = randHand(n);
  const s = C.shanten(c);
  // 有可能的話放進更接近聽牌的手：用 rng 造牌
  const e = s <= 2 ? exactLE1(c) : 2;
  const sCap = Math.min(s, 2);
  checked++;
  if (sCap !== e) { if (c.some(v => v === 4)) mism4++; else { mism++; if (mism < 5) console.log('  向聽不一致', s, e, c.join('')); } }
  // 3M+2：-1 與 isWin 一致
  const c2 = c.slice(); const extra = [...Array(34).keys()].find(k => c2[k] < 4); c2[extra]++;
  ok((C.shanten(c2) === -1) === C.isWin(c2), '3M+2 時 shanten=-1 ⇔ isWin');
}
ok(mism === 0, `隨機 ${checked} 手：向聽數與精確計算不一致 ${mism} 手（四張相同造成的特例 ${mism4} 手不計）`);
// 聽牌手：造一堆接近聽牌的手驗證 0 ⇔ waits
let tp = 0;
for (let it = 0; it < 3000; it++) {
  const w = C.shuffle(Array.from({ length: 136 }, (_, i) => i), rng);
  // 用 5 組隨機面子＋將去掉一張 → 一定聽
  const c = new Array(34).fill(0);
  let okBuild = true;
  for (let m = 0; m < 5; m++) {
    const k = Math.floor(rng() * 34);
    if (k < 27 && k % 9 <= 6 && rng() < 0.6) { c[k]++; c[k + 1]++; c[k + 2]++; } else c[k] += 3;
  }
  const pk = Math.floor(rng() * 34); c[pk] += 2;
  if (c.some(v => v > 4)) { okBuild = false; }
  if (!okBuild) continue;
  ok(C.isWin(c) && C.shanten(c) === -1, '造出來的胡牌');
  const drop = [...Array(34).keys()].filter(k => c[k])[Math.floor(rng() * 10) % [...Array(34).keys()].filter(k => c[k]).length];
  c[drop]--;
  const wt = C.waits(c);
  ok(wt.includes(drop) || c[drop] >= 4, '拿掉的那張一定在聽牌裡');
  ok(C.shanten(c) === 0, '拿掉一張必定 0 向聽');
  tp++;
}
console.log(`  造牌驗證 ${tp} 手`);

// ---------------- 台數 ----------------
function sc(hand, o = {}) {
  const x = { hand: K(hand), melds: o.melds || [], flowers: K(o.flowers || ''), win: K(o.win)[0], self: !!o.self, seat: o.seat || 0, round: o.round || 0,
    kongDraw: !!o.kongDraw, haitei: !!o.haitei, houtei: !!o.houtei, robKong: !!o.robKong, tenhou: !!o.tenhou, chihou: !!o.chihou };
  const r = C.score(x);
  return r ? r.items.map(i => `${i.name}${i.tai}`).sort() : null;
}
const S = arr => arr.slice().sort();
const M = (type, s) => ({ type, k: K(s)[0] });

same(sc('123m 456m 789m 234p 678p 55s', { win: '9m' }), S(['門清1', '平胡2']), '平胡＋門清（兩面聽 9 萬）');
same(sc('123m 456m 789m 234p 678p 55s', { win: '8m' }), S(['門清1', '獨聽1']), '中洞 8 萬：非平胡、獨聽');
same(sc('123m 456m 789m 234p 678p 55s', { win: '9m', self: true }), S(['不求人（門清自摸）3']), '門清自摸＝不求人 3');
same(sc('123m 456m 789m 234p 678p 55s', { win: '9m', flowers: '1f' }), S(['門清1', '正花（春）1']), '有花不算平胡；正花');
same(sc('123m 456m 789m 234p 678p 55s', { win: '9m', flowers: '2f', seat: 0 }), S(['門清1']), '非本位花不算台');
same(sc('456m 789m 234p 678p 55s', { win: '9m', melds: [M('chi', '1m')] }), S(['平胡2']), '吃牌也能平胡');
same(sc('456m 789m 234p 678p 55s', { win: '9m', melds: [M('chi', '1m')], self: true }), S(['自摸1']), '有吃＋自摸＝自摸 1');
same(sc('123m 456m 789m 234p 678p 55z', { win: '9m' }), S(['門清1']), '將是字牌不算平胡');
same(sc('999s 777p 222z 33m', { win: '3m', melds: [M('pon', '1m'), M('pon', '5p')], seat: 1 }), S(['碰碰胡4', '三暗刻2', '門風（南）1', '獨聽1']), '碰碰胡＋三暗刻＋門風＋獨聽');
same(sc('111m 999m 444p 777s 222z 55z', { win: '2z', self: true, seat: 1 }), S(['不求人（門清自摸）3', '碰碰胡4', '五暗刻8', '門風（南）1']), '五暗刻（自摸）');
same(sc('111m 999m 444p 777s 222z 55z', { win: '2z', seat: 1 }), S(['門清1', '碰碰胡4', '四暗刻5', '門風（南）1']), '放槍那組不算暗刻 → 四暗刻');
same(sc('111m 444p 777s 234m 567p 99s', { win: '3m' }), S(['門清1', '三暗刻2', '獨聽1']), '三暗刻（嵌三萬獨聽）');
same(sc('123m 345m 567m 789m 999m 11m', { win: '1m', self: true }).includes('清一色8'), true, '清一色');
same(sc('123m 456m 789m 111z 555z 22z', { win: '2z', seat: 0, round: 0 }), S(['門清1', '混一色4', '三元牌（中）1', '圈風（東）1', '門風（東）1', '獨聽1']), '混一色＋三元牌＋圈風門風');
same(sc('111z 222z 333z 555z 666z 77z', { win: '7z', seat: 2, round: 1 }), S(['門清1', '字一色16', '五暗刻8', '小三元4', '圈風（南）1', '門風（西）1', '獨聽1']), '字一色＋小三元＋五暗刻');
same(sc('555z 666z 777z 123m 456m 99p', { win: '9p' }), S(['門清1', '大三元8', '三暗刻2', '獨聽1']), '大三元');
same(sc('111z 222z 333z 44z 123m 456m', { win: '4z', seat: 3 }), S(['門清1', '小四喜8', '三暗刻2', '混一色4', '獨聽1']), '小四喜（不另計風）');
same(sc('111z 222z 333z 444z 123m 55p', { win: '5p' }), S(['門清1', '大四喜16', '四暗刻5', '獨聽1']), '大四喜');
same(sc('55s', { win: '5s', melds: [M('chi', '1m'), M('pon', '9p'), M('chi', '3s'), M('pon', '7z'), M('mkong', '2m')] }), S(['全求人2', '三元牌（白）1']), '全求人（不另計獨聽）');
same(sc('55s', { win: '5s', self: true, melds: [M('chi', '1m'), M('pon', '9p'), M('chi', '3s'), M('pon', '7z'), M('mkong', '2m')] }), S(['自摸1', '三元牌（白）1', '獨聽1']), '自摸不算全求人');
same(sc('123m 456m 789m 234p 678p 55s', { win: '9m', flowers: '1234f' }).filter(x => /花/.test(x)), ['花槓（春夏秋冬）2'], '花槓');
same(sc('123m 456m 789m 234p 678p 55s', { win: '9m', flowers: '1234f 5f', seat: 0 }).filter(x => /花/.test(x)).sort(), S(['花槓（春夏秋冬）2', '正花（梅）1']), '花槓＋正花');
same(sc('123m 456m 789m 234p 678p 55s', { win: '9m', self: true, kongDraw: true }), S(['不求人（門清自摸）3', '槓上開花1']), '槓上開花');
same(sc('123m 456m 789m 234p 678p 55s', { win: '9m', self: true, haitei: true }), S(['不求人（門清自摸）3', '海底撈月1']), '海底撈月');
same(sc('123m 456m 789m 234p 678p 55s', { win: '9m', houtei: true }), S(['門清1', '平胡2', '河底撈魚1']), '河底撈魚');
same(sc('123m 456m 789m 234p 678p 55s', { win: '9m', robKong: true }), S(['門清1', '平胡2', '搶槓1']), '搶槓');
same(sc('123m 456m 789m 234p 678p 55s', { win: '9m', self: true, tenhou: true }), S(['天胡16']), '天胡');
same(sc('123m 456m 789m 234p 678p 55s', { win: '9m', self: true, chihou: true }), S(['地胡16']), '地胡');
same(sc('123m 456m 789m 234p 678p 55s', { win: '9m', melds: [] , self: false }).length, 2, '基本');
same(sc('123m 456m 789m 234p 678p 56s', { win: '9m' }), null, '沒胡回傳 null');
// 暗槓不破門清
same(sc('456m 789m 234p 678p 55s', { win: '9m', melds: [M('akong', '1z')], seat: 0 }), S(['門清1', '圈風（東）1', '門風（東）1']), '暗槓仍算門清，風刻計台');
// 加槓
same(sc('456m 789m 234p 678p 55s', { win: '9m', melds: [M('kkong', '5z')] }), S(['三元牌（中）1']), '加槓中＝三元牌');
// 112233 取最大拆法
same(sc('112233m 456p 789p 99s 111z', { win: '9s', self: true, seat: 0 }).length >= 1, true, '一盃口型可胡');

// 莊家／連莊
same(C.dealerItems(0).map(i => i.name + i.tai), ['莊家1'], '莊家 1 台');
same(C.dealerItems(2).map(i => i.name + i.tai), ['莊家1', '連二拉二4'], '連二拉二');
// 付款
const pz = C.payments(0, 1, 2, null, 5, 100, 20);
same(pz.map(x => [x.from, x.tai, x.amount]), [[0, 8, 260], [1, 5, 200], [3, 5, 200]], '閒家自摸：莊家多付 1+2×連莊');
const pd = C.payments(0, 0, 0, null, 3, 100, 20);
same(pd.map(x => [x.from, x.tai]), [[1, 4], [2, 4], [3, 4]], '莊家自摸：三家都加莊');
const pr = C.payments(0, 0, 1, 2, 3, 100, 20);
same(pr.map(x => [x.from, x.tai, x.amount]), [[2, 3, 160]], '閒家放槍給閒家：不加莊');
const pr2 = C.payments(1, 2, 3, 1, 3, 100, 20);
same(pr2.map(x => [x.from, x.tai]), [[1, 8]], '莊家放槍：加 1+2×2');

// 吃牌選項
same(C.chiOptions(cnt('12m 4m 5m'), K('3m')[0]).map(names), ['一萬 二萬', '二萬 四萬', '四萬 五萬'], '吃三種組合');
same(C.chiOptions(cnt('89m'), K('1p')[0]), [], '不跨花色');
same(C.chiOptions(cnt('11z 22z'), K('1z')[0]), [], '字牌不能吃');

// 一將流程
{
  const s = { dealer: 2, startDealer: 2, streak: 0, round: 0, hands: 0, mode: 'full', done: false };
  C.nextSession(s, { type: 'win', winner: 2 }); same([s.dealer, s.streak, s.round], [2, 1, 0], '莊家胡連莊');
  C.nextSession(s, { type: 'draw' }); same([s.dealer, s.streak], [2, 2], '流局連莊');
  C.nextSession(s, { type: 'win', winner: 0 }); same([s.dealer, s.streak, s.round], [3, 0, 0], '下莊');
  C.nextSession(s, { type: 'win', winner: 0 }); C.nextSession(s, { type: 'win', winner: 1 }); C.nextSession(s, { type: 'win', winner: 0 });
  same([s.dealer, s.round, s.done], [2, 1, false], '一圈後換南風圈');
  const r = { dealer: 0, startDealer: 0, streak: 0, round: 0, hands: 0, mode: 'round', done: false };
  for (let i = 0; i < 4; i++) C.nextSession(r, { type: 'win', winner: (r.dealer + 1) % 4 });
  ok(r.done, '一圈模式打完東風圈結束');
}

console.log(`\n單元測試：通過 ${pass}，失敗 ${fail}`);
if (fail) process.exitCode = 1;
