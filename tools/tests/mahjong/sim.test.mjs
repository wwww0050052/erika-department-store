// AI 對 AI 模擬：node sim.test.mjs [手數]
import { loadCore } from './load.mjs';
const C = loadCore();
const N = +(process.argv[2] || 2000);
let fail = 0;
const bad = (msg, extra) => { fail++; if (fail < 10) console.log('✗', msg, extra || ''); };

function check(S, ev) {
  // 張數守恆
  let n = S.wall.length + (ev.t === 'kkong' ? 1 : 0);
  for (let p = 0; p < 4; p++) n += S.hands[p].length + S.flowers[p].length + S.river[p].length + S.melds[p].reduce((a, m) => a + m.tiles.length, 0);
  if (n !== 144) bad(`張數不守恆 ${n} @${ev.t}`);
  // 不重複
  const seen = new Set();
  const all = [...(ev.t === 'kkong' ? [ev.tile] : []), ...S.wall, ...S.hands.flat(), ...S.flowers.flat(), ...S.river.flat(), ...S.melds.flat().flatMap(m => m.tiles)];
  for (const t of all) { if (seen.has(t)) { bad('牌重複 ' + t); break; } seen.add(t); }
  if (S.phase === 'play' && ev.t === 'turn') {
    for (let p = 0; p < 4; p++) {
      const need = 16 - 3 * S.melds[p].length + (p === ev.p ? 1 : 0);
      if (S.hands[p].length !== need) bad(`手牌張數錯 p${p} ${S.hands[p].length}≠${need}`);
      if (S.hands[p].some(t => C.kindOf(t) >= 34)) bad('手上有花沒補');
    }
  }
}

const stats = { win: 0, zimo: 0, draw: 0, tai: 0, maxTai: 0, items: {}, calls: { chi: 0, pon: 0, kong: 0 }, kongs: 0, rob: 0, time: 0, byLevel: [0, 0, 0, 0], seatWins: [0, 0, 0, 0] };
const net = [0, 0, 0];
const t0 = performance.now();
for (let h = 0; h < N; h++) {
  const rng = C.rngFrom(1000 + h);
  const levels = [[2, 0, 1, 0], [0, 2, 0, 1], [1, 0, 2, 0], [0, 1, 0, 2]][h % 4];
  const agents = levels.map(l => C.makeAI(l, rng));
  let events = 0;
  const hooks = {
    on: (ev, S) => {
      events++;
      check(S, ev);
      if (ev.t === 'call') stats.calls[ev.call]++;
      if (ev.t === 'kong') stats.kongs++;
    },
  };
  let out;
  try {
    out = await C.playHand({ dealer: h % 4, round: (h >> 2) % 4, streak: h % 3, rng, di: 100, unit: 20 }, agents, hooks);
  } catch (e) { bad('引擎例外 ' + e.message, e.stack); continue; }
  const { S, res } = out;
  if (events > 2000) bad('事件過多 ' + events);
  if (res.type === 'draw') { stats.draw++; if (C.live(S) > 0) bad('還有牌就流局'); continue; }
  stats.win++;
  if (res.from == null) stats.zimo++;
  if (res.ctx.robKong) stats.rob++;
  stats.seatWins[levels[res.winner]]++;
  for (const p of res.pays) { net[levels[p.to]] += p.amount; net[levels[p.from]] -= p.amount; }
  const c = C.countsOf(S.hands[res.winner]);
  if (!C.isWin(c)) bad('胡牌手不成立');
  if (S.hands[res.winner].length !== 17 - 3 * S.melds[res.winner].length) bad('胡牌張數錯');
  const t = res.score.total;
  stats.tai += t; stats.maxTai = Math.max(stats.maxTai, t);
  for (const it of res.score.items) stats.items[it.key] = (stats.items[it.key] || 0) + 1;
  if (!res.pays.length || res.pays.some(p => !(p.amount >= 100))) bad('付款錯');
  if (res.from == null && res.pays.length !== 3) bad('自摸應三家付');
}
stats.time = performance.now() - t0;
console.log(`模擬 ${N} 手：胡 ${stats.win}（自摸 ${stats.zimo}、搶槓 ${stats.rob}）、流局 ${stats.draw}`);
console.log(`平均台數 ${(stats.tai / Math.max(1, stats.win)).toFixed(2)}、最高 ${stats.maxTai}；吃 ${stats.calls.chi} 碰 ${stats.calls.pon} 明槓 ${stats.calls.kong} 槓總數 ${stats.kongs}`);
console.log('胡牌次數（輕鬆×2 / 普通 / 高手，座位輪替）：', stats.seatWins.slice(0, 3).join(' / '));
console.log('淨輸贏（輕鬆兩家合計 / 普通 / 高手）：', net.join(' / '));
console.log('台型出現次數：', Object.entries(stats.items).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
console.log(`耗時 ${(stats.time / 1000).toFixed(1)} 秒，平均每手 ${(stats.time / N).toFixed(1)} ms`);

// 一將完整流程
{
  let hands = 0;
  const sess = { dealer: 1, startDealer: 1, streak: 0, round: 0, hands: 0, mode: 'full', done: false };
  const rng = C.rngFrom(777);
  while (!sess.done && hands < 400) {
    const { res } = await C.playHand({ dealer: sess.dealer, round: sess.round, streak: sess.streak, rng }, [0, 1, 2, 3].map(() => C.makeAI(1, rng)));
    C.nextSession(sess, res); hands++;
  }
  console.log(`一將（四圈）共打 ${hands} 手，結束=${sess.done}`);
  if (!sess.done) bad('一將沒有結束');
}
// 中止（關閉遊戲）測試
{
  let n = 0;
  try {
    await C.playHand({ dealer: 0, rng: C.rngFrom(5) }, [0, 1, 2, 3].map(() => C.makeAI(1)), { on: () => { n++; }, abort: () => n > 30 });
    bad('中止沒有丟出 ABORT');
  } catch (e) { if (e !== C.ABORT) bad('中止丟出錯誤的例外 ' + e); }
}
// 換三張
{
  const rng = C.rngFrom(9);
  const { S } = await C.playHand({ dealer: 0, rng }, [0, 1, 2, 3].map(() => C.makeAI(1, rng)), {
    pregame: S => { const ids = S.hands[0].slice(0, 3); const got = C.swapTiles(S, 0, ids); if (got.length !== 3) bad('換三張數量錯'); if (ids.some(t => S.hands[0].includes(t))) bad('換掉的牌還在手上'); },
    on: (ev, S) => check(S, ev),
  });
  if (!S.result) bad('換三張後牌局沒結束');
}
console.log(fail ? `\n模擬測試失敗 ${fail} 項` : '\n模擬測試全部通過');
if (fail) process.exitCode = 1;
