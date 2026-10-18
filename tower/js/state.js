// 名媛之塔：存檔、資源、卡片養成、抽卡、模擬儲值
'use strict';

DT.SAVE_KEY = 'divaTower.v1';
DT.newState = () => ({
  v: 1, created: Date.now(),
  gems: 20, gold: 3000, stamina: 32, staminaMaxBonus: 0, staminaAt: Date.now(),
  plv: 1, pexp: 0,
  cards: [], nextUid: 1, team: [], seen: {},
  cleared: {}, // floor → 最佳評價（1~3 皇冠）
  storySeen: {},
  pulls: 0, pity: 0, tickets5: 0, tickets6: 0,
  spent: 0, purchases: {}, orders: [], monthlyUntil: 0, monthlyClaimed: '',
  lastLogin: '', loginDays: 0,
  settings: { sfx: true, fast: false },
});

DT.S = null;
DT.load = () => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(DT.SAVE_KEY) || 'null'); } catch { s = null; }
  if (!s || s.v !== 1) {
    s = DT.newState();
    DT.S = s;
    // 開場四張起始身分
    [2, 9, 3, 18].forEach(id => DT.addCard(id, true));
    s.team = s.cards.map(c => c.uid);
  } else {
    DT.S = { ...DT.newState(), ...s, settings: { ...DT.newState().settings, ...(s.settings || {}) } };
  }
  DT.tickStamina();
  return DT.S;
};
let saveTimer = 0;
DT.save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(DT.saveNow, 150);
};
DT.saveNow = () => {
  clearTimeout(saveTimer);
  try { localStorage.setItem(DT.SAVE_KEY, JSON.stringify(DT.S)); } catch { /* 私密模式存不了也能玩 */ }
};
// 另一個分頁改了存檔 → 這邊重新讀，避免互相覆蓋
window.addEventListener('storage', e => { if (e.key === DT.SAVE_KEY && e.newValue) { try { DT.S = JSON.parse(e.newValue); DT.ui && DT.ui.refresh && DT.ui.refresh(); } catch { /* 忽略 */ } } });

// ── 名媛等級與體力 ──────────────────────────
DT.vipLevel = () => { let v = 0; DT.VIP.forEach((t, i) => { if (DT.S.spent >= t) v = i; }); return v; };
DT.staminaMax = () => 30 + DT.S.plv * 2 + DT.S.staminaMaxBonus + (DT.vipLevel() >= 1 ? 5 : 0) + (DT.vipLevel() >= 3 ? 10 : 0);
DT.tickStamina = () => {
  const s = DT.S, max = DT.staminaMax(), now = Date.now();
  if (s.stamina >= max) { s.staminaAt = now; return; }
  const n = Math.floor((now - s.staminaAt) / DT.STAMINA_REGEN_MS);
  if (n > 0) { s.stamina = Math.min(max, s.stamina + n); s.staminaAt += n * DT.STAMINA_REGEN_MS; if (s.stamina >= max) s.staminaAt = now; }
};
DT.nextStaminaIn = () => DT.STAMINA_REGEN_MS - (Date.now() - DT.S.staminaAt);
DT.pexpToNext = lv => Math.round(80 * Math.pow(lv, 1.4));
DT.gainPlayerExp = n => {
  const s = DT.S; let ups = 0;
  s.pexp += n;
  while (s.pexp >= DT.pexpToNext(s.plv) && s.plv < 200) { s.pexp -= DT.pexpToNext(s.plv); s.plv++; ups++; }
  if (ups) s.stamina = Math.max(s.stamina, DT.staminaMax()); // 升級補滿體力
  return ups;
};
DT.goldMult = () => 1 + (DT.vipLevel() >= 3 ? 0.1 : 0) + (DT.vipLevel() >= 5 ? 0.25 : 0);

// ── 卡片 ──────────────────────────────
DT.addCard = (id, silent) => {
  const s = DT.S;
  const dup = s.cards.find(c => c.id === id);
  s.seen[id] = true;
  if (dup) {
    // 重複 → 突破（最多 5），滿了換成金幣
    if (dup.star < 5) { dup.star++; return { card: dup, dup: true, star: dup.star }; }
    const g = 2000 * DT.CARD[id].rarity;
    s.gold += g;
    return { card: dup, dup: true, gold: g };
  }
  const c = { uid: s.nextUid++, id, lv: 1, exp: 0, star: 0, at: Date.now() };
  s.cards.push(c);
  if (!silent && s.team.length < 5) s.team.push(c.uid);
  return { card: c, dup: false };
};
DT.cardByUid = uid => DT.S.cards.find(c => c.uid === uid);
DT.statsOf = inst => DT.cardStats(DT.CARD[inst.id], inst.lv, inst.star);
DT.skillCd = inst => Math.max(2, DT.CARD[inst.id].skill.cd - Math.floor(inst.star / 2) * 1);
DT.maxLv = inst => DT.RARITY_MAXLV[DT.CARD[inst.id].rarity];
DT.giveExp = (inst, n) => {
  const card = DT.CARD[inst.id], max = DT.maxLv(inst);
  let ups = 0;
  if (inst.lv >= max) return 0;
  inst.exp += n;
  while (inst.lv < max && inst.exp >= DT.expToNext(card, inst.lv)) { inst.exp -= DT.expToNext(card, inst.lv); inst.lv++; ups++; }
  if (inst.lv >= max) inst.exp = 0;
  return ups;
};
// 用金幣培育：花費 = 經驗 × 1
DT.trainCost = (inst, levels = 1) => {
  const card = DT.CARD[inst.id], max = DT.maxLv(inst);
  let cost = 0, lv = inst.lv, exp = inst.exp;
  for (let i = 0; i < levels && lv < max; i++) { cost += DT.expToNext(card, lv) - exp; exp = 0; lv++; }
  return Math.max(0, Math.round(cost));
};

// ── 名牌福袋（抽卡） ───────────────────────
DT.rollRarity = (minR = 3) => {
  const s = DT.S;
  s.pity++;
  if (s.pity >= DT.GACHA.pity) return 6;
  let x = Math.random(), r = 3;
  for (const t of DT.GACHA.rates) { if (x < t.p) { r = t.r; break; } x -= t.p; }
  return Math.max(r, minR);
};
DT.pickCardOfRarity = r => {
  const pool = DT.CARDS.filter(c => c.rarity === r);
  return pool[Math.floor(Math.random() * pool.length)].id;
};
DT.pull = (n, opts = {}) => {
  const s = DT.S, res = [];
  for (let i = 0; i < n; i++) {
    let minR = 3;
    if (opts.ticket === 5) minR = 5;
    if (opts.ticket === 6) minR = 6;
    if (n === 10 && i === 9 && !res.some(x => DT.CARD[x.card.id].rarity >= 5)) minR = 5; // 十連保底 ★5
    const r = DT.rollRarity(minR);
    if (r === 6) s.pity = 0;
    s.pulls++;
    res.push(DT.addCard(DT.pickCardOfRarity(r)));
  }
  DT.save();
  return res;
};

// ── 模擬儲值 ─────────────────────────────
DT.today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
DT.buy = (item) => {
  const s = DT.S;
  const first = !s.purchases[item.id];
  s.purchases[item.id] = (s.purchases[item.id] || 0) + 1;
  s.spent += item.ntd;
  const got = [];
  if (item.gems !== undefined && !item.monthly) {
    const g = item.gems + (item.bonus || 0) + (first && item.bonus !== undefined ? item.gems : 0); // 首儲雙倍
    s.gems += g; got.push(`粉鑽 ×${g}${first && item.bonus !== undefined ? '（首儲雙倍）' : ''}`);
  }
  if (item.monthly) {
    s.gems += item.gems; got.push(`粉鑽 ×${item.gems}`);
    const base = Math.max(Date.now(), s.monthlyUntil);
    s.monthlyUntil = base + item.monthly * 86400000;
    s.monthlyClaimed = DT.today();
    got.push(`月卡生效至 ${new Date(s.monthlyUntil).toLocaleDateString('zh-TW')}`);
  }
  if (item.gold) { s.gold += item.gold; got.push(`金幣 ×${item.gold.toLocaleString()}`); }
  if (item.ticket5) { s.tickets5 += item.ticket5; got.push('★5 確定福袋券 ×1'); }
  if (item.ticket6) { s.tickets6 += item.ticket6; got.push('★6 確定福袋券 ×1'); }
  if (item.staminaMax) { s.staminaMaxBonus += item.staminaMax; got.push(`體力上限 +${item.staminaMax}`); }
  if (item.refill) { s.stamina = Math.max(s.stamina, DT.staminaMax()); got.push('體力全滿'); }
  const order = { no: 'DT' + Date.now().toString(36).toUpperCase(), at: Date.now(), name: item.name, ntd: item.ntd };
  s.orders.unshift(order); s.orders = s.orders.slice(0, 30);
  DT.saveNow();
  return { got, order };
};

// ── 每日登入 ─────────────────────────────
DT.dailyLogin = () => {
  const s = DT.S, t = DT.today(), out = [];
  if (s.lastLogin !== t) {
    s.lastLogin = t; s.loginDays++;
    const v = DT.vipLevel();
    const gems = 1 + (v >= 2 ? 1 : 0) + (v >= 4 ? 2 : 0) + (v >= 6 ? 5 : 0) + (s.loginDays % 7 === 0 ? 5 : 0);
    const gold = 1000 + s.plv * 50;
    s.gems += gems; s.gold += gold;
    s.stamina = Math.max(s.stamina, DT.staminaMax());
    out.push(`第 ${s.loginDays} 天簽到：粉鑽 ×${gems}、金幣 ×${gold.toLocaleString()}、體力補滿`);
  }
  if (s.monthlyUntil > Date.now() && s.monthlyClaimed !== t) {
    s.monthlyClaimed = t; s.gems += 5; out.push('名媛月卡：粉鑽 ×5');
  }
  if (out.length) DT.save();
  return out;
};

DT.highestCleared = () => { let m = 0; for (const f in DT.S.cleared) m = Math.max(m, +f); return m; };
DT.isUnlocked = floor => floor === 1 || !!DT.S.cleared[floor - 1];
