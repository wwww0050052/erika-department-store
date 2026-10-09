// 撲克牌共用＋貴婦妞妞＋名媛十三支 規則單元測試
// 執行：node --test cards.test.cjs（用 vm 載入 js/games/cards.js、niuniu.js、poker13.js，提供假的 window）
const { test } = require('node:test');
const assert0 = require('node:assert/strict');
// vm 裡建立的陣列／物件原型不同，比較前先轉成一般 JSON
const plain = x => JSON.parse(JSON.stringify(x));
const assert = Object.assign((...a) => assert0(...a), assert0, { deepEqual: (a, b, m) => assert0.deepEqual(plain(a), plain(b), m), notDeepEqual: (a, b, m) => assert0.notDeepEqual(plain(a), plain(b), m) });
const load = require('./load.cjs');
const w = load(['cards.js', 'niuniu.js', 'poker13.js']);
const C = w.ErikaCards, NN = C.niuniu, P = C.poker13;
const H = s => C.parse(s);
const ids = cs => cs.map(C.cid).sort((a, b) => a - b).join(',');

// ================= 共用 =================
test('牌組：52 張不重複、洗牌是排列、可重現', () => {
  const d = C.deck();
  assert.equal(d.length, 52);
  assert.equal(new Set(d.map(C.cid)).size, 52);
  const a = C.shuffle(C.deck(), C.rng(42)), b = C.shuffle(C.deck(), C.rng(42)), c = C.shuffle(C.deck(), C.rng(43));
  assert.equal(ids(a), ids(d));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});
test('parse：各種寫法', () => {
  assert.deepEqual(H('AS 10H TD 2c ♠Q K♥'), [{ r: 14, s: 3 }, { r: 10, s: 2 }, { r: 10, s: 0 }, { r: 2, s: 1 }, { r: 12, s: 3 }, { r: 13, s: 2 }]);
  assert.throws(() => H('1S'));
  assert.throws(() => H('AX'));
});
test('牌面 SVG：52 張完整版與迷你版都畫得出來', () => {
  for (const c of C.deck()) for (const mini of [false, true]) {
    const s = C.faceSVG(c, mini);
    assert.match(s, /^<svg/);
    assert.doesNotMatch(s, /undefined|NaN/);
  }
  assert.match(C.DEFS, /id="ecb"/);
  for (let t = 0; t < 4; t++) assert.doesNotMatch(C.chipSVG(t), /undefined|NaN/);
});
test('遊戲註冊：niuniu order 3、poker13 order 4', () => {
  const g = Object.fromEntries(w.ErikaGames.map(x => [x.id, x]));
  assert.equal(g.niuniu.order, 3);
  assert.equal(g.poker13.order, 4);
  assert.equal(typeof g.niuniu.open, 'function');
  assert.equal(typeof g.poker13.open, 'function');
});

// ================= 貴婦妞妞 =================
const ev = s => NN.evaluate(H(s));
test('妞妞：點數 A=1、10/J/Q/K=10', () => {
  assert.deepEqual(H('AS 2H 9D 10C JS QH KD').map(NN.point), [1, 2, 9, 10, 10, 10, 10]);
});
test('妞妞：沒牛、牛一～牛九、牛牛與倍數', () => {
  assert.equal(ev('AS 2H 4D 6C 9S').level, 0);
  assert.equal(ev('AS 2H 4D 6C 9S').mult, 1);
  const n1 = ev('10S JH QD AC KS');
  assert.equal(n1.level, 1); assert.equal(n1.name, '牛一');
  const n6 = ev('3S 7H 10D 2C 4S');
  assert.equal(n6.level, 6); assert.equal(n6.mult, 1);
  const n7 = ev('3S 7H 10D 2C 5S');
  assert.equal(n7.level, 7); assert.equal(n7.mult, 2);
  const n8 = ev('3S 7H 10D 2C 6S');
  assert.equal(n8.level, 8); assert.equal(n8.mult, 2);
  assert.deepEqual(n8.group.map(i => H('3S 7H 10D 2C 6S')[i].r).sort((a, b) => a - b), [3, 7, 10]);
  const n9 = ev('3S 7H 10D 4C 5S');
  assert.equal(n9.level, 9);
  const nn = ev('KH QS JD 5C 5H');
  assert.equal(nn.level, 10); assert.equal(nn.name, '牛牛'); assert.equal(nn.mult, 3);
  assert.equal(nn.split, 3);
});
test('妞妞：有牛時剩兩張個位數由總和決定（多種組合結果一致）', () => {
  const r = C.rng(5);
  for (let t = 0; t < 2000; t++) {
    const h = C.shuffle(C.deck(), r).slice(0, 5), e = NN.evaluate(h);
    if (e.level >= 1 && e.level <= 10 && e.group) {
      const g = e.group.reduce((a, i) => a + NN.point(h[i]), 0);
      assert.equal(g % 10, 0);
      const rest = [0, 1, 2, 3, 4].filter(i => !e.group.includes(i)).reduce((a, i) => a + NN.point(h[i]), 0);
      assert.equal(rest % 10 || 10, e.level);
    }
    if (e.level === 0) for (const t3 of [[0, 1, 2], [0, 1, 3], [0, 1, 4], [0, 2, 3], [0, 2, 4], [0, 3, 4], [1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4]]) assert.notEqual(t3.reduce((a, i) => a + NN.point(h[i]), 0) % 10, 0);
    assert.equal(new Set(e.order).size, 5);
  }
});
test('妞妞：特殊牌型與優先順序', () => {
  const wh = ev('JS QH KD JC QD');
  assert.equal(wh.level, 11); assert.equal(wh.name, '五花牛'); assert.equal(wh.mult, 5);
  assert.equal(ev('10S QH KD JC QD').level, 10, '有 10 不算五花牛，是牛牛');
  const bomb = ev('7S 7H 7D 7C KS');
  assert.equal(bomb.level, 12); assert.equal(bomb.mult, 6); assert.equal(bomb.split, 4);
  assert.equal(ev('KS KH KD KC QS').level, 12, '炸彈大於五花牛');
  const small = ev('AS AH 2D 2C 4S');
  assert.equal(small.level, 13); assert.equal(small.name, '五小牛'); assert.equal(small.mult, 8);
  assert.equal(ev('AS AH AD AC 2S').level, 13, '五小牛大於炸彈');
  assert.notEqual(ev('AS 2H 3D 4C 4S').level, 13, '總和 14 > 10 不是五小牛');
  assert.notEqual(ev('AS AH AD 2C 5S').level, 13, '有 5 點不是五小牛');
});
test('妞妞：同牌型比最大單張（K 最大 A 最小，再比花色）、炸彈比四條', () => {
  const a = ev('KS 3H 7D 10C 8S'), b = ev('KH 3D 7C 10S 8H'); // 都是牛八
  assert.equal(a.level, 8); assert.equal(b.level, 8);
  assert.ok(NN.compare(a, b) > 0, '♠K > ♥K');
  assert.ok(NN.skey({ r: 14, s: 3 }) < NN.skey({ r: 2, s: 0 }), '♠A 比 ♦2 小');
  const x = ev('AS 2H 4D 6C 9S'), y = ev('2S 3H 4C 6D 9H'); // 都沒牛，最大都是 9
  assert.equal(x.level, 0); assert.equal(y.level, 0);
  assert.ok(NN.compare(x, y) > 0, '♠9 > ♥9');
  assert.ok(NN.compare(ev('5S 5H 5D 5C AS'), ev('4S 4H 4D 4C KS')) > 0, '炸彈 5 > 炸彈 4');
  assert.ok(NN.compare(ev('9S 9H 9D 9C 2S'), ev('8S 8H 8D 8C KS')) > 0, '炸彈比四條點數');
  assert.ok(NN.compare(ev('KH QS JD 5C 5H'), ev('3S 7H 10D 4C 5S')) > 0, '牛牛 > 牛九');
  assert.equal(ev('AS 3H 3C 5D KH').level, 0);
  assert.ok(NN.compare(ev('3S 7H 10D 2C AD'), ev('AS 3H 3C 5D KH')) > 0, '牛三 > 沒牛（即使沒牛有 K）');
});
test('妞妞：結算（閒家只跟莊家比、零和、倍數相乘）', () => {
  const evs = [ev('KH QS JD 5C 5H') /* 牛牛 */, ev('3S 7H 10D 2C 6S') /* 牛八 */, ev('JS QH KD JC QD') /* 五花 */, ev('AS 2H 4D 6C 9S') /* 沒牛 */, ev('3D 7C 10H 4H 5D') /* 牛九 */];
  const { net, detail } = NN.settle(evs, 0, 3, [0, 2, 1, 4, 5], 100);
  assert.equal(net.reduce((a, b) => a + b, 0), 0);
  assert.equal(net[1], -100 * 3 * 2 * 3, '閒家牛八輸莊家牛牛：照莊家 ×3');
  assert.equal(net[2], 100 * 3 * 1 * 5, '閒家五花牛贏：照閒家 ×5');
  assert.equal(net[3], -100 * 3 * 4 * 3);
  assert.equal(net[4], -100 * 3 * 5 * 3);
  assert.equal(detail.length, 4);
});
test('妞妞：AI 強度與搶莊／下注單調、換牌建議', () => {
  const strong = NN.strength(H('10S JH QD 5C')), weak = NN.strength(H('AS 2H 3D 6C'));
  assert.ok(strong > weak);
  assert.ok(strong >= 0 && strong <= 1 && weak >= 0 && weak <= 1);
  const fixed = () => 0.5;
  let pb = -1, pt = 0;
  for (let s = 0; s <= 1; s += 0.01) { const b = NN.aiBid(s, 0, fixed), t = NN.aiBet(s, 0, fixed); assert.ok(b >= pb && t >= pt); pb = b; pt = t; assert.ok(b >= 0 && b <= 4 && t >= 1 && t <= 5); }
  assert.equal(NN.bestSwap(H('KH QS JD 5C 5H')).index, -1, '牛牛不建議換');
  const bs = NN.bestSwap(H('AS 2H 4D 6C 9S'));
  assert.ok(bs.index >= 0 && bs.gain > 0);
});

// ================= 名媛十三支 =================
const v5 = s => P.eval5(H(s)), v3 = s => P.eval3(H(s));
const cat = v => P.CAT[P.catOf(v)];
test('十三支：9 種牌型判定', () => {
  assert.equal(cat(v5('9S 10S JS QS KS')), '同花順');
  assert.equal(cat(v5('9S 9H 9D 9C 2S')), '鐵支');
  assert.equal(cat(v5('9S 9H 9D 2C 2S')), '葫蘆');
  assert.equal(cat(v5('2S 7S 9S JS KS')), '同花');
  assert.equal(cat(v5('5D 6S 7H 8C 9S')), '順子');
  assert.equal(cat(v5('9S 9H 9D 2C 3S')), '三條');
  assert.equal(cat(v5('9S 9H 2D 2C 3S')), '兩對');
  assert.equal(cat(v5('9S 9H 2D 4C 3S')), '一對');
  assert.equal(cat(v5('9S JH 2D 4C 3S')), '散牌');
  const order = ['9S 10S JS QS KS', '9S 9H 9D 9C 2S', '9S 9H 9D 2C 2S', '2S 7S 9S JS KS', '5D 6S 7H 8C 9S', '9S 9H 9D 2C 3S', '9S 9H 2D 2C 3S', '9S 9H 2D 4C 3S', '9S JH 2D 4C 3S'].map(v5);
  for (let i = 1; i < order.length; i++) assert.ok(order[i - 1] > order[i]);
});
test('十三支：A 在順子兩端（10JQKA 最大、A2345 第二大）、不能繞圈', () => {
  const top = v5('10S JH QD KC AS'), wheel = v5('AS 2H 3D 4C 5S'), k9 = v5('9S 10H JD QC KS'), low = v5('2S 3H 4D 5C 6S');
  assert.equal(cat(top), '順子'); assert.equal(cat(wheel), '順子');
  assert.ok(top > wheel && wheel > k9 && k9 > low);
  assert.equal(cat(v5('QS KH AD 2C 3S')), '散牌', 'QKA23 不是順子');
  assert.equal(cat(v5('JS QH KD AC 2S')), '散牌', 'JQKA2 不是順子');
  const sfTop = v5('10H JH QH KH AH'), sfWheel = v5('AS 2S 3S 4S 5S'), sfK = v5('9D 10D JD QD KD');
  assert.ok(sfTop > sfWheel && sfWheel > sfK);
  assert.ok(v5('2S 3S 4S 5S 6S') > v5('9S 9H 9D 9C AS'), '最小的同花順也大於鐵支');
});
test('十三支：同牌型比大小', () => {
  assert.ok(v5('2S 4S 6S 8S AS') > v5('9H JH QH KH 7H'), '同花比最大張：A 高');
  assert.ok(v5('2S 4S 6S 9S KS') > v5('2H 4H 6H 8H KH'), '同花依序比');
  assert.ok(v5('3S 3H 3D 2C 2S') > v5('2S 2H 2D AC AS'), '葫蘆比三條');
  assert.ok(v5('KS KH 3D 3C 2S') > v5('QS QH JD JC AS'), '兩對先比大對');
  assert.ok(v5('KS KH 4D 4C 2S') > v5('KD KC 3S 3H AS'), '兩對再比小對');
  assert.ok(v5('KS KH 4D 4C 5S') > v5('KD KC 4S 4H 3S'), '兩對最後比單張');
  assert.ok(v5('9S 9H AD 4C 3S') > v5('9D 9C KD QC JS'), '一對比雜牌');
  assert.ok(v5('8S 8H 8D AC 2S') > v5('7S 7H 7C KC QS'));
  assert.ok(v5('5S 5H 5D 5C 3S') > v5('4S 4H 4D 4C AS'), '鐵支比四條');
  assert.equal(v5('10S JH QD KC AS'), v5('10H JD QC KS AD'), '同樣順子平手（不比花色）');
});
test('十三支：頭道 3 張（只有三條／一對／散牌）', () => {
  assert.equal(cat(v3('AS AH AD')), '三條');
  assert.equal(cat(v3('AS AH 2D')), '一對');
  assert.equal(cat(v3('2S AH 2D')), '一對');
  assert.equal(cat(v3('AS KS QS')), '散牌', '頭道沒有順子與同花');
  assert.ok(v3('2S 2H 2D') > v3('AS AH KD'));
  assert.ok(v3('5S 5H 3D') > v3('5D 5C 2H'), '一對比單張');
  assert.ok(v3('AS KH 3D') > v3('AH QH JD'));
});
test('十三支：倒水判定（含頭中同牌型比較）', () => {
  assert.equal(P.isFoul([H('2S 3H 5D'), H('9S 9H 4D 6C 7S'), H('KS KH KD 8C 8S')]), false);
  assert.equal(P.isFoul([H('QS QH 5D'), H('9S 9H 4D 6C 7S'), H('KS KH KD 8C 8S')]), true, '頭道對 Q 大於中道對 9');
  assert.equal(P.isFoul([H('2S 3H 5D'), H('9S 9H 9D 9C 7S'), H('KS KH KD 8C 8S')]), true, '中道鐵支大於尾道葫蘆');
  assert.equal(P.isFoul([H('5S 5H KD'), H('5D 5C AS 3C 2H'), H('KS KH KC 8C 8S')]), false, '頭對5帶K < 中對5帶A');
  assert.equal(P.isFoul([H('5S 5H AD'), H('5D 5C KS QC JH'), H('KS KH KC 8C 8S')]), true, '頭對5帶A > 中對5帶K');
  assert.equal(P.isFoul([H('7S 7H 7D'), H('9S 9H 4D 4C 2S'), H('KS KH KC 8C 8S')]), true, '頭三條 > 中兩對');
  assert.equal(P.isFoul([H('AS KH 3D'), H('AD KS 3C 2H 4H'), H('QS QH QC 8C 8S')]), false, '頭散牌 AK3 < 中散牌 AK432');
  assert.equal(P.isFoul([H('AS KH 9D'), H('AD KS 8C 7H 5H'), H('QS QH QC 8D 8S')]), true, '頭 AK9 > 中 AK875');
});
test('十三支：每道分數', () => {
  assert.equal(P.rowBonus(0, v3('7S 7H 7D')), 3);
  assert.equal(P.rowBonus(0, v3('7S 7H 2D')), 1);
  assert.equal(P.rowBonus(1, v5('9S 9H 9D 2C 2S')), 2);
  assert.equal(P.rowBonus(1, v5('9S 9H 9D 9C 2S')), 8);
  assert.equal(P.rowBonus(1, v5('9S 10S JS QS KS')), 10);
  assert.equal(P.rowBonus(1, v5('2S 7S 9S JS KS')), 1);
  assert.equal(P.rowBonus(2, v5('9S 9H 9D 9C 2S')), 4);
  assert.equal(P.rowBonus(2, v5('9S 10S JS QS KS')), 5);
  assert.equal(P.rowBonus(2, v5('9S 9H 9D 2C 2S')), 1);
});
const A = { rows: [H('2S 3H 5D'), H('9S 9H 4D 6C 7S'), H('KS KH KD 8C 8S')] };     // 散 / 一對 / 葫蘆
const Bp = { rows: [H('QS QH 6D'), H('JS JH 4H 4C 2D'), H('AS AH AD 2C 3C')] };     // 一對 / 兩對 / 三條
test('十三支計分：兩人逐道比、打槍 ×2、輸方照贏家那道分數扣', () => {
  let r = P.scoreMatch([A, Bp]);
  assert.deepEqual(r.pairs[0].rows, [-1, -1, 1]);
  assert.deepEqual(r.total, [-1, 1]);
  assert.equal(r.shots.length, 0);
  const big = { rows: [H('7S 7H 7D'), H('10H 10S 10D 3S 3H'), H('2H 2D 2C 2S AC')] }; // 沖三 / 中道葫蘆 / 尾道鐵支
  r = P.scoreMatch([big, A]);
  assert.deepEqual(r.pairs[0].rows, [3, 2, 4]);
  assert.equal(r.pairs[0].shot, 1);
  assert.deepEqual(r.total, [18, -18], '(3+2+4)×2');
  assert.deepEqual(r.shots, [{ from: 0, to: 1 }]);
  r = P.scoreMatch([A, big]);
  assert.deepEqual(r.total, [-18, 18], '輸家照贏家的道分扣');
  const sf = { rows: [H('AS AH 2C'), H('5D 6D 7D 8D 9D'), H('10C JC QC KC AC')] };
  r = P.scoreMatch([sf, A]);
  assert.deepEqual(r.pairs[0].rows, [1, 10, 5]);
  assert.deepEqual(r.total, [32, -32]);
});
test('十三支計分：平手不加分也不算打槍', () => {
  const x = { rows: [H('KS QH 2D'), H('9S 9H 4D 6C 7S'), H('AS AH AD 8C 8S')] };
  const y = { rows: [H('KH QD 2C'), H('5S 5H 3D 6D 7D'), H('2S 2H 2D 3C 3S')] };
  const r = P.scoreMatch([x, y]);
  assert.deepEqual(r.pairs[0].rows, [0, 1, 1]);
  assert.equal(r.pairs[0].shot, 0);
  assert.deepEqual(r.total, [2, -2]);
});
test('十三支計分：倒水 = 三道全輸並被打槍；兩人都倒水 0 分', () => {
  const foul = { rows: [H('QS QH 5D'), H('9S 9H 4D 6C 7S'), H('KS KH KD 8C 8S')] };
  assert.equal(P.isFoul(foul.rows), true);
  let r = P.scoreMatch([foul, A]);
  assert.deepEqual(r.pairs[0].rows, [-1, -1, -1]);
  assert.equal(r.pairs[0].shot, -1);
  assert.deepEqual(r.total, [-6, 6]);
  r = P.scoreMatch([foul, { rows: foul.rows }]);
  assert.deepEqual(r.total, [0, 0]);
  const strongFoulVictim = { rows: [H('7S 7H 7D'), H('10H 10S 10D 3S 3H'), H('2H 2D 2C 2S AC')] };
  r = P.scoreMatch([strongFoulVictim, foul]);
  assert.deepEqual(r.total, [18, -18], '倒水者照對手道分全賠 ×2');
});
test('十三支計分：全壘打（打槍所有人）再 ×2、四人零和', () => {
  const top = { rows: [H('AS AH AD'), H('KS KH KD KC 2S'), H('8C 9C 10C JC QC')] };
  // 三位對手都弱
  const o1 = { rows: [H('2S 3H 5D'), H('6S 6H 4D 8C 7S'), H('QS QH 9D 8D 8S')] };
  const o2 = { rows: [H('2H 4H 6D'), H('7S 7H 4C 8H 3S'), H('JS JH 9H 3D 3C')] };
  const o3 = { rows: [H('3D 4D 7D'), H('5S 5H 2D 9S 10S'), H('10H 10D 6C 6D 4S')] };
  const r = P.scoreMatch([top, o1, o2, o3]);
  assert.equal(r.homerun, 0);
  assert.equal(r.shots.filter(s => s.from === 0).length, 3);
  for (const pr of r.pairs.filter(p => p.i === 0)) { assert.equal(pr.base, 3 + 8 + 5); assert.equal(pr.pts, (3 + 8 + 5) * 4); }
  assert.equal(r.total[0], 16 * 4 * 3);
  assert.equal(r.total.reduce((a, b) => a + b, 0), 0);
});
test('十三支計分：特殊牌型直接拿分、互比牌型大小、不能被打槍', () => {
  const sp6 = P.SPECIALS.pairs6, drag = P.SPECIALS.dragon;
  let r = P.scoreMatch([{ special: sp6 }, A, Bp]);
  assert.equal(r.total[0], 6);
  assert.equal(r.pairs.find(p => p.i === 0 && p.j === 1).shot, 0);
  r = P.scoreMatch([{ special: sp6 }, { special: drag }]);
  assert.deepEqual(r.total, [-13, 13]);
  r = P.scoreMatch([{ special: sp6 }, { special: P.SPECIALS.straight3 }]);
  assert.deepEqual(r.total, [3, -3], '六對半排在三順子前面');
  r = P.scoreMatch([{ special: sp6 }, { special: sp6 }]);
  assert.deepEqual(r.total, [0, 0]);
  // 有人報到時，其他人無法全壘打
  const top = { rows: [H('AS AH AD'), H('KS KH KD KC 2S'), H('9C 10C JC QC KC')] };
  r = P.scoreMatch([top, A, Bp, { special: sp6 }]);
  assert.equal(r.homerun, -1);
  assert.equal(r.total.reduce((a, b) => a + b, 0), 0);
});
const partition = (rows, hand) => { assert.equal(rows[0].length, 3); assert.equal(rows[1].length, 5); assert.equal(rows[2].length, 5); assert.equal(ids(rows.flat()), ids(hand)); };
test('十三支特殊牌型判定', () => {
  let h = H('AS 2H 3D 4C 5S 6H 7D 8C 9S 10H JD QC KS');
  let s = P.detectSpecial(h);
  assert.equal(s.id, 'dragon'); partition(s.rows, h);
  h = H('AH 2D 3H 4D 5H 6D 7H 8D 9H 10D JH QD KH');
  assert.equal(P.detectSpecial(h).id, 'dragon', '同時也全紅，一條龍優先');
  h = H('AH AD 3H 4D 5H 6D 7H 8D 9H 10D JH QD KH');
  assert.equal(P.detectSpecial(h).id, 'color');
  h = H('2S 2H 2D 5C 5S 5H 9D 9C 9S KH KD KC 3S');
  s = P.detectSpecial(h); assert.equal(s.id, 'trips4'); partition(s.rows, h);
  h = H('2S 2H 2D 2C 5S 5H 5D 9C 9S 9H KD KC KS');
  assert.equal(P.detectSpecial(h).id, 'trips4', '鐵支算一組三條');
  h = H('2S 2H 5D 5C 7S 7H 9D 9C JS JH KD KC KS');
  assert.equal(P.detectSpecial(h).id, 'pairs5');
  h = H('2S 2H 5D 5C 7S 7H 9D 9C JS JH KD KC 3S');
  s = P.detectSpecial(h); assert.equal(s.id, 'pairs6'); partition(s.rows, h);
  h = H('2S 2H 2D 2C 7S 7H 9D 9C JS JH KD KC 3S');
  assert.equal(P.detectSpecial(h).id, 'pairs6', '鐵支算兩對');
  h = H('AS 2H 3D 10C JS QH KD AC 4S 5H 6D 7C 8S');
  s = P.detectSpecial(h);
  assert.equal(s.id, 'straight3', 'A23 / 45678 / 10JQKA：A 同時在兩端');
  partition(s.rows, h);
  assert.equal(P.CAT[P.catOf(P.eval5(s.rows[2]))], '順子');
  h = H('QS KH AD 2C 3S 4H 5D 6C 7S 8H 9D 10C JS');
  s = P.detectSpecial(h);
  assert.ok(s.id === 'dragon', '十三種點數是一條龍');
  h = H('2S 5S 9S 3H 6H 8H JH KH 3D 7D 10D QD AD');
  s = P.detectSpecial(h); assert.equal(s.id, 'flush3'); partition(s.rows, h);
  for (const row of s.rows) assert.equal(new Set(row.map(c => c.s)).size, 1);
  h = H('2S 5S 9S 3S 6S 8S JS KS 4D 7D 10D QD KD');
  s = P.detectSpecial(h); assert.equal(s.id, 'flush3', '8+5 花色分配'); partition(s.rows, h);
  h = H('2S 5S 9S 3S 6S 8S JS KS 10S 7D 4D QD KD');
  assert.equal(P.detectSpecial(h), null, '9+4 不能湊三同花');
  h = H('2S 5H 9S 3H 6S 8H JS KH 4D 7C 10D QC KC');
  assert.equal(P.detectSpecial(h), null);
});
test('十三支擺牌：自動與大師都不會倒水、剛好分完 13 張、大師期望分 ≥ 自動', () => {
  const r = C.rng(2024);
  for (let t = 0; t < 120; t++) {
    const h = C.shuffle(C.deck(), r).slice(0, 13);
    const a = P.autoArrange(h), m = P.masterArrange(h);
    partition(a.rows, h); partition(m.rows, h);
    assert.equal(P.isFoul(a.rows), false);
    assert.equal(P.isFoul(m.rows), false);
    assert.ok(m.ev >= a.ev - 1e-9, `大師 ${m.ev} < 自動 ${a.ev}`);
    assert.ok(Math.abs(P.expectedValue(m.rows) - m.ev) < 1e-9);
    const g = P.greedyArrange(h);
    partition(g.rows, h);
  }
});
test('十三支大師擺牌：比隨機合法擺法都好（窮舉最佳）', () => {
  const r = C.rng(77);
  for (let t = 0; t < 12; t++) {
    const h = C.shuffle(C.deck(), r).slice(0, 13);
    const m = P.masterArrange(h);
    for (let k = 0; k < 400; k++) {
      const s = C.shuffle(h.slice(), r), rows = [s.slice(0, 3), s.slice(3, 8), s.slice(8)];
      if (P.isFoul(rows)) continue;
      assert.ok(P.expectedValue(rows) <= m.ev + 1e-9);
    }
  }
});
test('十三支：擺牌中的提示名稱', () => {
  assert.equal(P.partialName(H('9S 9H')), '一對');
  assert.equal(P.partialName(H('9S 9H 9D')), '三條');
  assert.equal(P.partialName(H('9S 9H 2D 2C')), '兩對');
  assert.equal(P.partialName(H('9S 9H 9D 9C')), '鐵支');
  assert.equal(P.partialName(H('9S 3H')), '');
  assert.equal(P.rowName(H('9S 10S JS QS KS'), 2), '同花順');
  assert.equal(P.rowName(H('AS KS QS'), 0), '散牌');
  assert.deepEqual(P.sortRow(H('2S KH 2D')).map(c => c.r), [2, 2, 13]);
});

// ================= 連動系統 =================
function fakeApi(o = {}) {
  const log = [];
  const api = {
    fmt: n => String(Math.round(n)),
    cast: () => [{ id: 'erika', name: 'Erika' }, { id: 'vivi', name: '薇薇' }, { id: 'vita', name: '維塔' }, { id: 'chiyo', name: '千代' }, { id: 'shino', name: '詩乃' }],
    payout: (n, x, y) => log.push(['payout', n, x, y]),
    event: (name, data) => log.push(['event', name, data]),
    grant: (r, x, y, quiet) => log.push(['grant', r, x, y, quiet]),
    resUnit: () => 1000,
    perk: name => { log.push(['perk', name]); return o.perk ?? 0; },
  };
  for (const k of o.drop || []) delete api[k];
  return { api, log };
}
test('連動：淨贏回報 card_round + card_win、送寶石原石（resUnit×0.3，quiet）', () => {
  const { api, log } = fakeApi();
  const ex = C.linkage(api, { game: 'niuniu', net: 5000, x: 10, y: 20, big: false, shardIds: ['vivi'] });
  assert.deepEqual(log.filter(l => l[0] === 'event'), [['event', 'card_round', { game: 'niuniu', win: true }], ['event', 'card_win', { game: 'niuniu' }]]);
  const g = log.find(l => l[0] === 'grant');
  assert.deepEqual(g, ['grant', { res: { ore: 300 } }, 10, 20, true]);
  assert.deepEqual(ex.map(e => e.k), ['寶石原石']);
  assert.equal(log.filter(l => l[0] === 'payout').length, 0, '贏的時候不返水');
});
test('連動：大牌（牛牛以上／打槍）送一位對手碎片；淨輸不送原石、不報 card_win', () => {
  const { api, log } = fakeApi();
  const ex = C.linkage(api, { game: 'poker13', net: -100, x: 0, y: 0, big: true, shardIds: ['chiyo'] });
  assert.deepEqual(log.filter(l => l[0] === 'event').map(l => l[1]), ['card_round']);
  assert.equal(log.find(l => l[0] === 'event')[2].win, false);
  assert.deepEqual(log.find(l => l[0] === 'grant')[1], { shards: { chiyo: 1 } });
  assert.ok(ex.some(e => e.k === '千代碎片'));
});
test('連動：貴婦返水＝輸額 × perk%（用 payout），perk 0 不返', () => {
  let { api, log } = fakeApi({ perk: 15 });
  let ex = C.linkage(api, { game: 'niuniu', net: -10000, x: 1, y: 2, big: false, shardIds: [] });
  assert.ok(log.some(l => l[0] === 'perk' && l[1] === 'cards_rebate'));
  assert.deepEqual(log.find(l => l[0] === 'payout'), ['payout', 1500, 1, 2]);
  assert.equal(ex.find(e => e.cls === 'rebate').v, '+1500');
  ({ api, log } = fakeApi({ perk: 0 }));
  ex = C.linkage(api, { game: 'niuniu', net: -10000, x: 1, y: 2 });
  assert.equal(log.filter(l => l[0] === 'payout').length, 0);
  assert.equal(ex.length, 0);
  ({ api, log } = fakeApi({ perk: 250 }));
  C.linkage(api, { game: 'niuniu', net: -10000 });
  assert.deepEqual(log.find(l => l[0] === 'payout').slice(0, 2), ['payout', 10000], '返水最多 100%');
});
test('連動：主程式沒有這些接口時安靜略過、不丟例外', () => {
  const { api, log } = fakeApi({ drop: ['event', 'grant', 'resUnit', 'perk'] });
  const ex = C.linkage(api, { game: 'niuniu', net: 999, big: true, shardIds: ['vivi'] });
  assert.equal(ex.length, 0);
  assert.equal(log.length, 0);
});
