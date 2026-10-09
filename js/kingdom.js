// 名媛王國 — 百貨的主幹經營系統（城鎮、資源、部隊、英雄、學院、地圖、任務）
// 結構：1. 小工具 → 2. 資料表 → 3. 純函式核心（不碰 DOM，可在 node 測試）→ 4. 畫面 → 5. 對外介面
'use strict';
(() => {
  const W = typeof window !== 'undefined' ? window : globalThis;

  // ================= 1. 小工具 =================
  const SEC = 1e3, MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const nice = x => { if (!(x > 0)) return 0; if (x < 100) return Math.ceil(x); const p = Math.pow(10, Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p; };
  const tz = () => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 各兵階數量（T1–T10）
  const sum = a => a.reduce((x, y) => x + y, 0);
  // 存在存檔裡的亂數（mulberry32），讓地圖與戰鬥在離線補算時也一致
  function rnd(st) {
    const a = st.rs = (st.rs + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const seeded = seed => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  // ================= 2. 資料表 =================
  const RES = ['silk', 'spice', 'ore', 'leaf'];
  const RES_INFO = {
    silk: { name: '絲綢', c1: '#ffd0e2', c2: '#df5f8e' },
    spice: { name: '香料', c1: '#ffdcb0', c2: '#de7a34' },
    ore: { name: '寶石原石', c1: '#d8e6fb', c2: '#5f8fd6' },
    leaf: { name: '金箔', c1: '#fff1bd', c2: '#c4952c' },
  };
  const RATE_K = { silk: 1, spice: 1, ore: 0.3, leaf: 0.12 };

  // 建築：unlock = 本館幾級才能蓋；tf/rf/gf = 時間／資源／金幣係數；pos = 城鎮等角座標 [u, v, 地塊半徑]
  const BLD = {
    town: { name: '百貨本館', en: 'Grand Magasin', unlock: 1, tf: 1, rf: 1, gf: 0.8, pos: [0, 13, 4.2], desc: '王國的心臟。等級決定其他建築的上限與百貨樓層開幕，還會加成整間百貨的收益。' },
    silk: { name: '絲綢工坊', en: 'Soierie', unlock: 1, tf: 0.32, rf: 0.3, gf: 0.2, res: 'silk', pos: [-7, 44, 2.3], desc: '紡出最柔亮的絲綢，建築、訓練、英雄都用得到。' },
    spice: { name: '香料庫', en: 'Épicerie', unlock: 1, tf: 0.32, rf: 0.3, gf: 0.2, res: 'spice', pos: [7, 44, 2.3], desc: '收藏來自世界各地的香料與茶葉。' },
    ore: { name: '寶石礦場', en: 'Mine de Joyaux', unlock: 5, tf: 0.32, rf: 0.3, gf: 0.2, res: 'ore', pos: [-6.6, 52, 2.3], desc: '挖出閃亮的原石，高級建設與高階部隊必備。' },
    leaf: { name: '金箔坊', en: 'Atelier Dorure', unlock: 10, tf: 0.32, rf: 0.3, gf: 0.2, res: 'leaf', pos: [6.6, 52, 2.3], desc: '把黃金打成薄如蟬翼的金箔，頂級工程才用得到。' },
    guard: { name: '保鑣訓練所', en: 'Garde du Corps', unlock: 2, tf: 0.4, rf: 0.4, gf: 0.3, troop: 'guard', pos: [-7, 28, 2.4], desc: '訓練西裝筆挺的保鑣，專門擋下狗仔。' },
    car: { name: '名車車庫', en: 'Garage de Luxe', unlock: 4, tf: 0.4, rf: 0.4, gf: 0.3, troop: 'car', pos: [7, 28, 2.4], desc: '停滿粉紅超跑，衝鋒陷陣把保鑣甩在後頭。' },
    pap: { name: '狗仔工作室', en: 'Studio Paparazzi', unlock: 6, tf: 0.4, rf: 0.4, gf: 0.3, troop: 'pap', pos: [6.6, 36, 2.3], desc: '閃光燈一閃，名車無所遁形。' },
    hall: { name: '名媛殿堂', en: 'Salle des Héroïnes', unlock: 2, tf: 0.4, rf: 0.4, gf: 0.3, pos: [6.5, 4.5, 3], desc: '名媛們聚會的殿堂，在這裡招募與培養英雄。' },
    acad: { name: '時尚學院', en: 'Académie de Mode', unlock: 5, tf: 0.4, rf: 0.4, gf: 0.3, pos: [-6.5, 4.5, 3], desc: '研究經濟、建設、軍事與採集科技。' },
    spa: { name: 'SPA療養院', en: 'Spa & Soin', unlock: 3, tf: 0.4, rf: 0.4, gf: 0.3, pos: [-7.2, 20, 2.6], desc: '受傷的部隊在這裡做臉按摩，很快就能歸隊。' },
    guild: { name: '閨蜜會館', en: 'Club des Amies', unlock: 4, tf: 0.4, rf: 0.4, gf: 0.3, pos: [7.2, 20, 2.6], desc: '閨蜜們會自動來幫忙，縮短建設與研究時間。' },
    bank: { name: 'ERIKA銀行', en: 'Banque Erika', unlock: 7, tf: 0.4, rf: 0.4, gf: 0.3, pos: [-6.6, 36, 2.5], desc: '把金幣存進來，到期領回本金與利息粉鑽。' },
    wall: { name: '鐵門保全', en: 'Grille & Garde', unlock: 1, tf: 0.38, rf: 0.42, gf: 0.3, pos: [0, 57.5, 2], desc: '王國的大門與保全系統，提升全軍防禦。' },
  };
  const BIDS = Object.keys(BLD);
  const MAX_LV = 30;
  const FLOOR_REQ = [1, 2, 4, 6, 8, 10, 12, 15, 18, 21, 24, 27];
  // 本館升級時間（秒）：index = 目標等級
  const TT = [0, 3, 6, 12, 20, 40, 80, 120, 180, 300, 480, 960, 1320, 1800, 2400, 3000, 3600, 4500, 5400, 6300, 7200, 8400, 9600, 10800, 12600, 14400, 16800, 19200, 21600, 25200, 28800];
  // 金幣成本對齊百貨樓層的開幕價（本館 Lv.FLOOR_REQ[i] ≈ 第 i 層開幕價），讓金幣在每個階段都有用途
  const GOLD_ANCHOR = [[1, 10], [2, 120], [4, 1.4e3], [6, 1.6e4], [8, 2e5], [10, 2.6e6], [12, 3.5e7], [15, 5e8], [18, 7.5e9], [21, 1.2e11], [24, 2e12], [27, 3.5e13]];
  function goldAt(L) {
    const A = GOLD_ANCHOR;
    if (L <= 1) return A[0][1];
    for (let i = 1; i < A.length; i++) { const [l1, c1] = A[i - 1], [l2, c2] = A[i]; if (L <= l2) return c1 * Math.pow(c2 / c1, (L - l1) / (l2 - l1)); }
    const [l1, c1] = A[A.length - 2], [l2, c2] = A[A.length - 1];
    return c2 * Math.pow(Math.pow(c2 / c1, 1 / (l2 - l1)), L - l2);
  }
  const resAt = L => L <= 1 ? 40 : 48 * Math.pow(1.38, L - 2);
  const ROT = ['guard', 'hall', 'acad'];
  function townReq(L) {
    const r = {};
    if (L === 2) r.spice = 1;
    else if (L === 3) { r.wall = 2; r.guard = 1; }
    else if (L === 4) { r.wall = 3; r.hall = 1; }
    else if (L === 5) { r.wall = 4; r.spa = 1; }
    else if (L >= 6) { r.wall = L - 1; r[ROT[L % 3]] = L - 1; }
    return r;
  }

  // 部隊（保鑣克狗仔、狗仔克名車、名車克保鑣）
  const TYPES = ['guard', 'car', 'pap'];
  const TROOP = {
    guard: { name: '保鑣', b: 'guard', beats: 'pap', c: '#4f63b8', mix: { silk: 1.3, spice: 0.7 }, tag: '近身護衛' },
    car: { name: '名車', b: 'car', beats: 'guard', c: '#e0628a', mix: { silk: 0.7, spice: 1.3 }, tag: '高速衝鋒' },
    pap: { name: '狗仔', b: 'pap', beats: 'car', c: '#8a5cc8', mix: { silk: 1, spice: 1 }, tag: '遠距快門' },
  };
  const TIER_NAME = ['見習', '新秀', '菁英', '資深', '王牌', '金牌', '傳奇', '殿堂', '至尊', '女王御用'];
  const unitAtk = t => 10 * Math.pow(1.3, t - 1);
  const unitHp = t => 60 * Math.pow(1.3, t - 1);
  const unitPw = t => Math.round(3 * Math.pow(1.3, t - 1) * 10) / 10;
  const unitLoad = t => 12 * Math.pow(1.12, t - 1);
  const unitTime = t => 2.4 * Math.pow(1.16, t - 1) * SEC;
  function unitCost(k, t) {
    const m = 8 * Math.pow(1.25, t - 1), mix = TROOP[k].mix, c = { silk: m * mix.silk, spice: m * mix.spice };
    if (t >= 4) c.ore = 1.2 * Math.pow(1.25, t - 1);
    if (t >= 7) c.leaf = 0.45 * Math.pow(1.25, t - 1);
    return c;
  }
  const tierMax = lv => lv <= 0 ? 0 : Math.min(10, 1 + Math.floor((lv - 1) / 3));
  const batchCap = lv => 20 + 12 * lv;

  // 英雄：等級（1–60）、星等（1–6）、碎片都存在主程式的共用名冊 api.heroes()；這裡只定義在王國裡的能力
  // troop = 擅長兵種；g = 全域加成種類（gb 基礎、gs 每多一星、gl 每多一級）
  const HEROES = [
    { id: 'erika', idx: 0, troop: 'all', role: '王國女王', g: 'income', gb: 0.04, gs: 0.04, gl: 0.002, line: '整個王國都是我的伸展台！' },
    { id: 'vivi', idx: 1, troop: 'guard', role: '甜點世家千金', g: 'prodBasic', gb: 0.08, gs: 0.05, gl: 0.002, line: '絲綢和香料，交給薇薇吧～' },
    { id: 'vita', idx: 2, troop: 'pap', role: '科技新貴偶像', g: 'research', gb: 0.05, gs: 0.04, gl: 0.0015, line: '演算法說，這樣研究最快！' },
    { id: 'chiyo', idx: 3, troop: 'car', role: '財閥大小姐', g: 'income', gb: 0.03, gs: 0.03, gl: 0.0015, line: '錢？我們家最不缺的就是錢。' },
    { id: 'shino', idx: 4, troop: 'car', role: '書香名門千金', g: 'build', gb: 0.05, gs: 0.04, gl: 0.0015, line: '工程的進度，我已經排好了。' },
    { id: 'fumi', idx: 5, troop: 'guard', role: '貼身管家', g: 'gather', gb: 0.08, gs: 0.05, gl: 0.002, line: '採購的事，請交給在下。' },
  ];
  const HERO = Object.fromEntries(HEROES.map(h => [h.id, h]));
  const G_NAME = { income: '百貨收益', prodBasic: '絲綢／香料產量', prodRare: '寶石／金箔產量', research: '研究速度', build: '建造速度', gather: '採集速度與負重', train: '訓練速度', atk: '全軍攻擊', def: '全軍防禦', hp: '全軍血量', hospital: 'SPA 容量', load: '部隊負重', march: '行軍速度', freeMin: '免費加速時間' };
  // 共用名冊的快照（畫面層每 0.3 秒從 api.heroes() 更新；node 測試可以用 setHeroes 注入）
  let HSNAP = null;
  const HDEF = id => ({ lv: 1, star: id === 'erika' ? 2 : 1, shards: 0, power: 26, starNeed: 10 });
  const heroOf = id => (HSNAP && HSNAP[id]) || HDEF(id);
  function setHeroes(list) { if (!Array.isArray(list)) return; const o = {}; for (const h of list) if (h && h.id) o[h.id] = { lv: +h.lv || 1, star: +h.star || 1, shards: +h.shards || 0, power: +h.power || 0, starNeed: h.starNeed }; HSNAP = o; }
  let FASH = 0; // 時尚魅力（主程式 api.fashion().power），加成部隊攻擊
  const setFashion = p => { FASH = Number.isFinite(p) ? Math.max(0, p) : 0; };
  const fashAtk = () => Math.min(0.3, FASH * 0.03);
  const heroGlobalRaw = (h, s) => h.gb + h.gs * (s.star - 1) + h.gl * (s.lv - 1);
  const heroTroopBonus = (h, s) => h.troop === 'all' ? 0.005 * s.lv + 0.04 * (s.star - 1) : 0.008 * s.lv + 0.06 * (s.star - 1);

  // 時尚學院研究樹
  const BRANCH = [
    { id: 'econ', name: '經濟', en: 'Économie', c: '#d6457a' },
    { id: 'build', name: '建設', en: 'Construction', c: '#c9a35b' },
    { id: 'mil', name: '軍事', en: 'Militaire', c: '#5f6fd6' },
    { id: 'gather', name: '採集', en: 'Cueillette', c: '#2f9a72' },
    { id: 'play', name: '娛樂城', en: 'Divertissement', c: '#7d4bc4' },
  ];
  const TECH = [
    { id: 'e1', br: 'econ', name: '櫥窗美學', eff: 'income', per: 0.03, max: 10, acad: 1, row: 0, col: 1 },
    { id: 'e2', br: 'econ', name: '絲路貿易', eff: 'prodBasic', per: 0.05, max: 10, acad: 2, pre: ['e1', 2], row: 1, col: 0 },
    { id: 'e4', br: 'econ', name: 'VIP 會員制', eff: 'income', per: 0.05, max: 10, acad: 9, pre: ['e1', 5], row: 1, col: 2 },
    { id: 'e3', br: 'econ', name: '珠寶鑑定', eff: 'prodRare', per: 0.05, max: 10, acad: 7, pre: ['e2', 3], row: 2, col: 0 },
    { id: 'e5', br: 'econ', name: '名媛經濟學', eff: 'income', per: 0.08, max: 10, acad: 18, pre: ['e4', 5], row: 2, col: 2 },
    { id: 'c1', br: 'build', name: '工法精進', eff: 'build', per: 0.03, max: 10, acad: 1, row: 0, col: 1 },
    { id: 'c2', br: 'build', name: '學術風氣', eff: 'research', per: 0.03, max: 10, acad: 3, pre: ['c1', 2], row: 1, col: 0 },
    { id: 'c3', br: 'build', name: '貴賓通道', eff: 'freeMin', per: 1, max: 5, acad: 8, pre: ['c1', 5], row: 1, col: 2 },
    { id: 'c4', br: 'build', name: '速成課程', eff: 'train', per: 0.05, max: 10, acad: 6, pre: ['c2', 3], row: 2, col: 0 },
    { id: 'c5', br: 'build', name: '都市計畫', eff: 'build', per: 0.04, max: 10, acad: 16, pre: ['c3', 3], row: 2, col: 2 },
    { id: 'm1', br: 'mil', name: '防身術', eff: 'atk', per: 0.03, max: 10, acad: 1, row: 0, col: 1 },
    { id: 'm2', br: 'mil', name: '防彈訂製服', eff: 'def', per: 0.03, max: 10, acad: 3, pre: ['m1', 2], row: 1, col: 0 },
    { id: 'm3', br: 'mil', name: '體能雕塑', eff: 'hp', per: 0.03, max: 10, acad: 5, pre: ['m1', 3], row: 1, col: 2 },
    { id: 'm4', br: 'mil', name: '急救護理', eff: 'hospital', per: 0.1, max: 10, acad: 7, pre: ['m2', 2], row: 2, col: 0 },
    { id: 'm5', br: 'mil', name: '王牌戰術', eff: 'atk', per: 0.05, max: 10, acad: 15, pre: ['m3', 5], row: 2, col: 2 },
    { id: 'g1', br: 'gather', name: '採購達人', eff: 'gather', per: 0.05, max: 10, acad: 2, row: 0, col: 1 },
    { id: 'g2', br: 'gather', name: '大容量後車廂', eff: 'load', per: 0.06, max: 10, acad: 4, pre: ['g1', 2], row: 1, col: 0 },
    { id: 'g3', br: 'gather', name: '專屬司機', eff: 'march', per: 0.04, max: 10, acad: 6, pre: ['g1', 3], row: 1, col: 2 },
    { id: 'g4', br: 'gather', name: '資源情報網', eff: 'gather', per: 0.06, max: 10, acad: 13, pre: ['g2', 5], row: 2, col: 1 },
    // 娛樂城：加成各個小遊戲（主程式用 api.perk(name) 讀）
    { id: 'p1', br: 'play', name: '時尚嗅覺', eff: 'm3_moves', per: 1, max: 5, acad: 2, step: 3, row: 0, col: 0, unit: '步', desc: '時尚消消樂每關額外步數' },
    { id: 'p4', br: 'play', name: '牌桌人脈', eff: 'cards_rebate', per: 2, max: 10, acad: 4, step: 2, row: 0, col: 2, unit: '%', desc: '妞妞／十三支輸錢返水' },
    { id: 'p2', br: 'play', name: '名媛氣場', eff: 'arena_atk', per: 3, max: 10, acad: 6, step: 2, pre: ['p1', 2], row: 1, col: 1, unit: '%', desc: '名媛對決攻擊力' },
    { id: 'p3', br: 'play', name: '防彈晚禮服', eff: 'royale_armor', per: 1, max: 3, acad: 9, step: 5, pre: ['p2', 3], row: 2, col: 0, unit: '級', desc: '吃雞開局護甲等級' },
    { id: 'p5', br: 'play', name: '牌搭子心法', eff: 'mahjong_hint', per: 1, max: 5, acad: 11, step: 3, pre: ['p4', 3], row: 2, col: 2, unit: '次', desc: '貴婦麻將每局免費提示' },
  ];
  const PERKS = ['m3_moves', 'arena_atk', 'royale_armor', 'cards_rebate', 'mahjong_hint'];
  const PERK_MAX = { m3_moves: 5, arena_atk: 30, royale_armor: 3, cards_rebate: 20, mahjong_hint: 5 };
  function perk(st, name) { const t = TECH.find(x => x.eff === name); if (!t) return 0; return clamp((st.tech[t.id] || 0) * t.per, 0, PERK_MAX[name]); }
  const TECHM = Object.fromEntries(TECH.map(t => [t.id, t]));
  const techStage = (t, to) => clamp(t.acad + (to - 1) * (t.step || 1.2), 1, MAX_LV);

  // 王國地圖
  const MAP = { w: 1500, h: 1500, home: [750, 760], boss: [1095, 330] };
  const RES_NODE_AMT = [0, 900, 1800, 3200, 5500, 9000, 14000];
  const RES_NODE_RATE = [0, 2400, 3000, 3800, 4800, 6000, 7500];
  const RES_NODE_TOWN = [0, 1, 5, 10, 15, 20, 25];
  const NODE_NAME = { silk: '桑葉花園', spice: '香料市集', ore: '水晶礦脈', leaf: '金箔礦坑' };
  const marchSlots = town => 1 + (town >= 5) + (town >= 12) + (town >= 20);
  const marchCap = (town, heroLv) => 60 + 30 * town + 5 * heroLv;
  // 黃牛黨據點
  function campArmy(L) {
    const t = Math.min(10, 1 + Math.floor((L - 1) / 3)), n = Math.round(25 + 12 * L + 0.35 * L * L);
    const u = { guard: tz(), car: tz(), pap: tz() };
    u.guard[t - 1] = Math.round(n * 0.4); u.car[t - 1] = Math.round(n * 0.3); u.pap[t - 1] = n - u.guard[t - 1] - u.car[t - 1];
    return u;
  }
  const BOSS_NAME = '巨型黃牛王';
  const FRIENDS = ['小雅', '曉涵', '佩珊', '欣妤', '詠晴', '雅婷', '宜蓁', '思妤', '品妍', '郁庭', '心怡', '筱晴'];

  // 銀行方案（數量克制：一次一筆，利息粉鑽少量）
  const BANK_PLANS = [
    { id: 'b1', name: '小資活存', h: 1, rate: 0.02, gems: 1, lv: 1 },
    { id: 'b8', name: '午茶定存', h: 8, rate: 0.08, gems: 4, lv: 5 },
    { id: 'b24', name: '貴婦定存', h: 24, rate: 0.2, gems: 10, lv: 10 },
  ];
  const bankGems = (plan, lv) => plan.gems + Math.floor(lv / 5);
  const bankMaxH = lv => 2 + lv; // 最多存幾小時的收益

  // 加速道具
  // 加速道具統一成「加速時間（分鐘）」庫存，可以隨意拆著用
  const BUTLER = { gems: 50, ms: 8 * HOUR };
  const STAM = { max: 100, regen: 6 * MIN, camp: 10, gems: 20, refill: 50 }; // 精力：攻打黃牛黨據點用
  const QUEUE2_GEMS = 300;
  const FREE_MS = 5 * MIN;

  // ================= 3. 純函式核心 =================
  const lvl = (st, id) => (st.b[id] && st.b[id].lv) || 0;
  function freshState(now) {
    const st = {
      v: 1, born: now, rs: (Math.floor(now / 7) % 2147483647) >>> 0 || 12345,
      b: {}, res: { silk: 2400, spice: 2400, ore: 0, leaf: 0 },
      q: [null, null], q2: false,
      troops: { guard: tz(), car: tz(), pap: tz() }, wounded: { guard: tz(), car: tz(), pap: tz() },
      train: { guard: null, car: null, pap: null }, heal: null,
      tech: {}, rsch: null,
      items: { spd: 10 }, out: [],
      map: { nodes: [], nid: 1, maxCamp: 0 },
      marches: [], reports: [], mid: 1,
      boss: null, bank: null, butler: 0, stam: { v: STAM.max, t: now },
      stat: { collect: 0, train: 0, gather: 0, camp: 0, boss: 0, tech: 0, heal: 0, upg: 0, bank: 0, speed: 0 },
      day: { key: dayKey(now), c: {}, done: {}, chest: {} },
      qi: 0, tut: {}, seen: now, evc: {},
    };
    for (const id of BIDS) st.b[id] = { lv: 0 };
    st.b.town.lv = 1; st.b.silk.lv = 1; st.b.wall.lv = 1;
    for (const k of RES) { st.b[k].acc = 0; st.b[k].t = now; }
    st.b.silk.acc = 180; // 第一個任務「收成」可以馬上完成
    return st;
  }
  // 讀進來的存檔補齊欄位（就地修改，因為 store() 回傳的物件就是存檔本體）
  function ensure(st, now) {
    if (!st || typeof st !== 'object') return freshState(now);
    if (!st.v) { for (const k of Object.keys(st)) delete st[k]; Object.assign(st, freshState(now)); return st; }
    const f = freshState(now);
    for (const k of Object.keys(f)) if (st[k] === undefined || st[k] === null && f[k] !== null) st[k] = f[k];
    for (const id of BIDS) { if (!st.b[id]) st.b[id] = { lv: 0 }; st.b[id].lv = clamp(Math.floor(+st.b[id].lv || 0), 0, MAX_LV); }
    for (const k of RES) { const b = st.b[k]; if (!Number.isFinite(b.acc)) b.acc = 0; if (!Number.isFinite(b.t)) b.t = now; if (!Number.isFinite(st.res[k]) || st.res[k] < 0) st.res[k] = 0; }
    for (const k of TYPES) { for (const g of ['troops', 'wounded']) { if (!Array.isArray(st[g][k]) || st[g][k].length !== 10) st[g][k] = tz(); } if (st.train[k] === undefined) st.train[k] = null; }
    if (!Array.isArray(st.out)) st.out = [];
    if (!st.evc || typeof st.evc !== 'object') st.evc = {};
    for (const k of Object.keys(f.stat)) if (!Number.isFinite(st.stat[k])) st.stat[k] = 0;
    if (!st.items || typeof st.items !== 'object') st.items = {};
    for (const k of Object.keys(f.items)) if (!Number.isFinite(st.items[k])) st.items[k] = 0;
    if (!Array.isArray(st.q)) st.q = [null, null];
    while (st.q.length < 2) st.q.push(null);
    if (!Array.isArray(st.marches)) st.marches = [];
    if (!Array.isArray(st.reports)) st.reports = [];
    if (!st.map || !Array.isArray(st.map.nodes)) st.map = f.map;
    if (!st.stam || !Number.isFinite(st.stam.v)) st.stam = f.stam;
    return st;
  }

  // ---------- 加成 ----------
  // 名媛殿堂每一級讓英雄的全域加成 +1%
  const heroGlobal = (st, h) => heroGlobalRaw(h, heroOf(h.id)) * (1 + 0.01 * lvl(st, 'hall'));
  function bonus(st) {
    const b = { income: 0, prodBasic: 0, prodRare: 0, build: 0, research: 0, train: 0, atk: 0, def: 0, hp: 0, hospital: 0, gather: 0, load: 0, march: 0, freeMin: 0 };
    for (const t of TECH) { const l = st.tech[t.id] || 0; if (l && t.br !== 'play') b[t.eff] += t.per * l; }
    for (const h of HEROES) { const v = heroGlobal(st, h); b[h.g] += v; if (h.g === 'gather') b.load += v; }
    b.def += 0.01 * lvl(st, 'wall');
    return b;
  }
  const townMult = L => 1 + 0.07 * (Math.max(1, L) - 1);
  function incomeMult(st) {
    const b = bonus(st);
    return townMult(lvl(st, 'town')) * (1 + b.income);
  }
  function incomeParts(st) {
    const b = bonus(st);
    let tech = 0, hero = 0;
    for (const t of TECH) if (t.eff === 'income') tech += t.per * (st.tech[t.id] || 0);
    for (const h of HEROES) if (h.g === 'income') hero += heroGlobal(st, h);
    return { town: townMult(lvl(st, 'town')), tech, hero, total: townMult(lvl(st, 'town')) * (1 + b.income) };
  }

  // ---------- 資源生產 ----------
  function prodRate(st, k, b = bonus(st)) { // 每小時
    const l = lvl(st, k);
    if (l <= 0) return 0;
    return 500 * RATE_K[k] * Math.pow(1.16, l - 1) * (1 + (k === 'silk' || k === 'spice' ? b.prodBasic : b.prodRare));
  }
  const CAP_H = 12; // 離線生產上限 12 小時
  // 給其他玩法決定掉落量：目前每種資源約 1 小時的產量（以絲綢為基準，至少 100）
  function resUnit(st, k) {
    const b = bonus(st), base = Math.max(lvl(st, 'silk'), lvl(st, 'town') - 1, 1);
    const r = 500 * Math.pow(1.16, base - 1) * (1 + b.prodBasic) * (k ? RATE_K[k] || 1 : 1);
    return Math.max(100, nice(r));
  }
  function stored(st, k, now, b) {
    const s = st.b[k]; if (!s || !s.lv) return 0;
    const r = prodRate(st, k, b);
    return Math.min(r * CAP_H, (s.acc || 0) + r * Math.max(0, now - s.t) / HOUR);
  }
  const bubbleAt = (st, k, b) => Math.max(8, prodRate(st, k, b) * 3 / 60); // 3 分鐘產量就冒泡泡
  function settle(st, now) { const b = bonus(st); for (const k of RES) { const s = st.b[k]; if (s.lv) { s.acc = stored(st, k, now, b); s.t = now; } else s.t = now; } }
  function collect(st, k, now) {
    const s = st.b[k]; if (!s.lv) return 0;
    const v = Math.floor(stored(st, k, now));
    if (v <= 0) return 0;
    s.acc = stored(st, k, now) - v; s.t = now;
    st.res[k] += v; bump(st, 'collect', 1);
    return v;
  }
  function collectAll(st, now) { const got = {}; let any = false; for (const k of RES) { const b = bonus(st); if (stored(st, k, now, b) >= 1) { const v = collect(st, k, now); if (v) { got[k] = v; any = true; } } } return any ? got : null; }

  // ---------- 統計 & 每日 ----------
  function rollDay(st, now) { const k = dayKey(now); if (st.day.key !== k) st.day = { key: k, c: {}, done: {}, chest: {} }; }
  function bump(st, key, n) { st.stat[key] = (st.stat[key] || 0) + n; st.day.c[key] = (st.day.c[key] || 0) + n; }

  // ---------- 建築升級 ----------
  function upgCost(id, to) {
    const d = BLD[id], R = resAt(to), c = { gold: to === 1 && id !== 'town' ? 0 : Math.max(5, nice(goldAt(to) * d.gf)), silk: nice(R * d.rf), spice: nice(R * d.rf * 0.85) }; // 新建築開工不收金幣
    const jl = id === 'town' ? 6 : 8, fl = id === 'town' ? 11 : 13;
    if (to >= jl) c.ore = nice(R * d.rf * 0.3);
    if (to >= fl) c.leaf = nice(R * d.rf * 0.12);
    return c;
  }
  function upgTime(st, id, to) { return Math.max(3 * SEC, TT[to] * BLD[id].tf * SEC / (1 + bonus(st).build)); }
  function upgReqs(st, id, to) {
    const out = [];
    if (id === 'town') { for (const [b, lv] of Object.entries(townReq(to))) out.push({ b, lv, ok: lvl(st, b) >= lv }); }
    else { const need = to === 1 ? BLD[id].unlock : to; out.push({ b: 'town', lv: need, ok: lvl(st, 'town') >= need }); }
    return out;
  }
  const busyQueue = (st, id) => st.q.findIndex(j => j && j.b === id);
  const queueCount = (st, month) => 1 + (st.q2 || month ? 1 : 0);
  const freeQueue = (st, month) => { for (let i = 0; i < queueCount(st, month); i++) if (!st.q[i]) return i; return -1; };
  function missingRes(st, cost) { const m = {}; for (const k of RES) if (cost[k] && st.res[k] < cost[k]) m[k] = cost[k] - st.res[k]; return m; }
  // 回傳不能升級的理由（沒有理由 = 可以升級；金幣由畫面層用 api 檢查）
  function upgBlock(st, id, month, coins = Infinity) {
    const lv = lvl(st, id), to = lv + 1;
    if (lv >= MAX_LV) return { code: 'max' };
    if (busyQueue(st, id) >= 0) return { code: 'busy' };
    const r = upgReqs(st, id, to).filter(x => !x.ok);
    if (r.length) return { code: 'req', reqs: r };
    const c = upgCost(id, to), miss = missingRes(st, c);
    if (Object.keys(miss).length) return { code: 'res', miss };
    if (coins < c.gold) return { code: 'gold', need: c.gold - coins };
    if (freeQueue(st, month) < 0) return { code: 'queue' };
    return null;
  }
  function helpPlan(st, dur, now) {
    const g = lvl(st, 'guild');
    return { helps: 0, hmax: g ? 3 + g : 0, hper: Math.max(dur * 0.008, 20 * SEC), hnext: now + 8 * SEC };
  }
  function beginUpgrade(st, id, now, month) {
    const qi = freeQueue(st, month), to = lvl(st, id) + 1, c = upgCost(id, to);
    if (qi < 0) return null;
    settle(st, now);
    for (const k of RES) if (c[k]) st.res[k] -= c[k];
    const dur = upgTime(st, id, to);
    st.q[qi] = { b: id, to, t0: now, dur, cut: 0, ...helpPlan(st, dur, now) };
    return st.q[qi];
  }
  const jobEnd = j => j.t0 + j.dur - j.cut;
  const jobLeft = (j, now) => Math.max(0, jobEnd(j) - now);
  const freeMs = st => FREE_MS + bonus(st).freeMin * MIN;
  const gemCost = ms => Math.max(1, Math.ceil(ms / MIN));
  function cancelUpgrade(st, qi) { // 取消：退回一半資源（金幣由畫面層退）
    const j = st.q[qi]; if (!j) return null;
    const c = upgCost(j.b, j.to);
    for (const k of RES) if (c[k]) st.res[k] += Math.floor(c[k] / 2);
    st.q[qi] = null;
    return Math.floor(c.gold / 2);
  }
  // 建議升級：先湊本館條件，再升本館
  function recommend(st, month) {
    const town = lvl(st, 'town');
    if (town >= MAX_LV) {
      let best = null;
      for (const id of BIDS) { const l = lvl(st, id); if (l < MAX_LV && (!best || l < lvl(st, best))) best = id; }
      return best;
    }
    const reqs = upgReqs(st, 'town', town + 1).filter(r => !r.ok);
    if (!reqs.length) return 'town';
    reqs.sort((a, b) => lvl(st, a.b) - lvl(st, b.b));
    // 要求的建築如果本身在升級，就挑下一個
    const free = reqs.find(r => busyQueue(st, r.b) < 0);
    return (free || reqs[0]).b;
  }

  // ---------- 研究 ----------
  function techCost(t, to) {
    const s = techStage(t, to), R = resAt(s), c = { gold: Math.max(5, nice(goldAt(s) * 0.12)), silk: nice(R * 0.45), spice: nice(R * 0.45) };
    if (s >= 8) c.ore = nice(R * 0.14);
    if (s >= 13) c.leaf = nice(R * 0.05);
    return c;
  }
  const techAcadReq = (t, to) => Math.ceil(techStage(t, to));
  function techTime(st, t, to) { return Math.max(5 * SEC, TT[Math.round(techStage(t, to))] * 0.5 * SEC / (1 + bonus(st).research)); }
  function techBlock(st, id, coins = Infinity) {
    const t = TECHM[id], lv = st.tech[id] || 0, to = lv + 1;
    if (lv >= t.max) return { code: 'max' };
    if (!lvl(st, 'acad')) return { code: 'noacad' };
    if (t.pre && (st.tech[t.pre[0]] || 0) < t.pre[1]) return { code: 'pre', pre: t.pre };
    if (lvl(st, 'acad') < techAcadReq(t, to)) return { code: 'acad', need: techAcadReq(t, to) };
    if (st.rsch) return { code: 'busy' };
    const c = techCost(t, to), miss = missingRes(st, c);
    if (Object.keys(miss).length) return { code: 'res', miss };
    if (coins < c.gold) return { code: 'gold' };
    return null;
  }
  function beginResearch(st, id, now) {
    const t = TECHM[id], to = (st.tech[id] || 0) + 1, c = techCost(t, to);
    for (const k of RES) if (c[k]) st.res[k] -= c[k];
    const dur = techTime(st, t, to);
    st.rsch = { id, to, t0: now, dur, cut: 0, ...helpPlan(st, dur, now) };
    return st.rsch;
  }
  function recommendTech(st) {
    let best = null, bs = -1;
    for (const t of TECH) {
      const blk = techBlock(st, t.id);
      if (blk && blk.code !== 'res' && blk.code !== 'gold' && blk.code !== 'busy') continue;
      const lv = st.tech[t.id] || 0;
      const w = (t.eff === 'income' ? 3 : t.eff === 'build' || t.eff === 'research' ? 2 : t.br === 'play' ? 0.8 : 1) / (1 + lv * 0.3);
      if (w > bs) { bs = w; best = t.id; }
    }
    return best;
  }

  // ---------- 部隊 ----------
  const troopCount = u => TYPES.reduce((a, k) => a + sum(u[k]), 0);
  const troopPower = u => TYPES.reduce((a, k) => a + u[k].reduce((x, n, i) => x + n * unitPw(i + 1), 0), 0);
  function trainCost(k, t, n) { const c = unitCost(k, t), o = {}; for (const r of Object.keys(c)) o[r] = Math.ceil(c[r] * n); return o; }
  function trainTime(st, t, n) { return Math.max(2 * SEC, unitTime(t) * n / (1 + bonus(st).train)); }
  function maxTrain(st, k, t) {
    const c = unitCost(k, t), cap = batchCap(lvl(st, TROOP[k].b));
    let n = cap;
    for (const r of Object.keys(c)) n = Math.min(n, Math.floor(st.res[r] / c[r]));
    return Math.max(0, n);
  }
  function trainBlock(st, k, t, n) {
    const bl = lvl(st, TROOP[k].b);
    if (!bl) return { code: 'nobuild' };
    if (t > tierMax(bl)) return { code: 'tier' };
    if (st.train[k]) return { code: st.train[k].done ? 'done' : 'busy' };
    if (n <= 0) return { code: 'zero' };
    const miss = missingRes(st, trainCost(k, t, n));
    if (Object.keys(miss).length) return { code: 'res', miss };
    return null;
  }
  function beginTrain(st, k, t, n, now) {
    const c = trainCost(k, t, n);
    for (const r of RES) if (c[r]) st.res[r] -= c[r];
    st.train[k] = { tier: t, n, t0: now, dur: trainTime(st, t, n), cut: 0, done: false };
    return st.train[k];
  }
  function claimTrain(st, k) {
    const j = st.train[k]; if (!j || !j.done) return 0;
    st.troops[k][j.tier - 1] += j.n; st.train[k] = null;
    bump(st, 'train', j.n);
    return j.n;
  }
  const hospCap = st => { const l = lvl(st, 'spa'); return l ? Math.round((40 + 60 * l) * (1 + bonus(st).hospital)) : 0; };
  const woundedCount = st => troopCount(st.wounded) + (st.heal ? troopCount(st.heal.units) : 0);
  function addWounded(st, units) { // 回傳超出容量、回家休養（損失）的數量
    let room = Math.max(0, hospCap(st) - woundedCount(st)), lost = 0;
    for (let i = 9; i >= 0; i--) for (const k of TYPES) {
      const n = units[k][i]; if (!n) continue;
      const take = Math.min(n, room); st.wounded[k][i] += take; room -= take; lost += n - take;
    }
    return lost;
  }
  function healCost(st, units) { const o = {}; for (const k of TYPES) units[k].forEach((n, i) => { if (!n) return; const c = unitCost(k, i + 1); for (const r of Object.keys(c)) o[r] = (o[r] || 0) + c[r] * n * 0.25; }); for (const r of Object.keys(o)) o[r] = Math.ceil(o[r]); return o; }
  function healTime(st, units) { let ms = 0; for (const k of TYPES) units[k].forEach((n, i) => { ms += n * unitTime(i + 1) * 0.3; }); return Math.max(2 * SEC, ms / (1 + bonus(st).train)); }
  // 一鍵治療：資源夠多少就治多少（高階優先）
  function healPlan(st) {
    const units = { guard: tz(), car: tz(), pap: tz() }, left = { ...st.res };
    for (let i = 9; i >= 0; i--) for (const k of TYPES) {
      const n = st.wounded[k][i]; if (!n) continue;
      const c = unitCost(k, i + 1);
      let can = n;
      for (const r of Object.keys(c)) can = Math.min(can, Math.floor(left[r] / (c[r] * 0.25)));
      if (can > 0) { units[k][i] = can; for (const r of Object.keys(c)) left[r] -= c[r] * 0.25 * can; }
    }
    return units;
  }
  function beginHeal(st, units, now) {
    const c = healCost(st, units);
    for (const r of RES) if (c[r]) st.res[r] -= c[r];
    for (const k of TYPES) units[k].forEach((n, i) => { st.wounded[k][i] -= n; });
    st.heal = { units, t0: now, dur: healTime(st, units), cut: 0 };
    return st.heal;
  }

  // ---------- 英雄（共用名冊） ----------
  const heroPower = (st, id) => heroOf(id).power || 0;
  // 萬能碎片（王國獎勵）自動給最接近升星的英雄
  function anyTarget() {
    let best = 'erika', bn = Infinity;
    for (const h of HEROES) { const s = heroOf(h.id); if (s.starNeed == null || s.star >= 6) continue; const need = (s.starNeed || 10) - (s.shards || 0); if (need < bn) { bn = need; best = h.id; } }
    return best;
  }

  // ---------- 戰力 ----------
  function power(st) {
    let p = troopPower(st.troops);
    for (const m of st.marches) p += troopPower(m.units);
    for (const k of TYPES) if (st.train[k] && st.train[k].done) p += st.train[k].n * unitPw(st.train[k].tier);
    for (const id of BIDS) { const l = lvl(st, id); p += (id === 'town' ? 60 : 15) * l * (l + 1) / 2; }
    for (const t of TECH) p += (st.tech[t.id] || 0) * 25 * (1 + t.acad / 5);
    for (const h of HEROES) p += heroPower(st, h.id) * 3;
    return Math.round(p);
  }

  // ---------- 戰鬥（純函式） ----------
  // side = { units, atkM:{k:倍率}, hpM:{k:倍率}, def }
  function battle(A, D, rand, rounds = 8) {
    const groups = s => TYPES.map(k => {
      let n = 0, atk = 0, hp = 0;
      s.units[k].forEach((c, i) => { if (c > 0) { n += c; atk += c * unitAtk(i + 1); hp += c * unitHp(i + 1); } });
      return { k, n0: n, n, atkU: n ? atk / n : 0, hpU: n ? hp / n * (s.hpM[k] || 1) * (1 + (s.def || 0)) : 1, atkM: s.atkM[k] || 1 };
    });
    const a = groups(A), d = groups(D);
    const hpOf = gs => gs.reduce((x, g) => x + g.n * g.hpU, 0);
    const a0 = hpOf(a) || 1, d0 = hpOf(d) || 1;
    const log = [];
    const hits = (src, dst) => {
      const kills = dst.map(() => 0), dHp = dst.map(g => g.n * g.hpU), tot = sum(dHp);
      if (tot <= 0) return kills;
      for (const g of src) {
        if (g.n <= 0) continue;
        const dmg = g.n * g.atkU * g.atkM * 0.6 * (0.92 + rand() * 0.16);
        dst.forEach((h, j) => {
          if (dHp[j] <= 0) return;
          const ctr = TROOP[g.k].beats === h.k ? 1.3 : TROOP[h.k].beats === g.k ? 0.75 : 1;
          kills[j] += dmg * (dHp[j] / tot) * ctr / h.hpU;
        });
      }
      return kills;
    };
    for (let r = 0; r < rounds; r++) {
      if (hpOf(a) < 1 || hpOf(d) < 1) break;
      const ka = hits(a, d), kd = hits(d, a);
      d.forEach((g, j) => { g.n = Math.max(0, g.n - ka[j]); if (g.n < 0.5) g.n = 0; });
      a.forEach((g, j) => { g.n = Math.max(0, g.n - kd[j]); if (g.n < 0.5) g.n = 0; });
      log.push([hpOf(a) / a0, hpOf(d) / d0]);
    }
    const ar = hpOf(a) / a0, dr = hpOf(d) / d0;
    const win = dr <= 0 || (ar > 0 && ar > dr);
    const lost = s => Object.fromEntries(s.map(g => [g.k, Math.round(g.n0 - g.n)]));
    return { win, ar, dr, log, aLost: lost(a), dLost: lost(d), stars: !win ? 0 : ar >= 0.8 ? 3 : ar >= 0.5 ? 2 : 1 };
  }
  // 依兵種損失數量，從各兵階按比例扣
  function splitLoss(units, lostByType) {
    const out = { guard: tz(), car: tz(), pap: tz() };
    for (const k of TYPES) {
      let L = lostByType[k] || 0; const tot = sum(units[k]);
      if (!L || !tot) continue;
      const f = Math.min(1, L / tot);
      for (let i = 0; i < 10 && L > 0; i++) { const x = Math.min(units[k][i], Math.round(units[k][i] * f), L); out[k][i] = x; L -= x; }
      for (let i = 0; i < 10 && L > 0; i++) { const x = Math.min(units[k][i] - out[k][i], L); out[k][i] += x; L -= x; }
    }
    return out;
  }
  function attackerSide(st, units, heroId) {
    const b = bonus(st), h = HERO[heroId];
    const hb = h ? heroTroopBonus(h, heroOf(heroId)) * (1 + 0.03 * lvl(st, 'hall')) : 0;
    const atkM = {}, hpM = {};
    for (const k of TYPES) { const m = h && (h.troop === 'all' || h.troop === k) ? hb : 0; atkM[k] = (1 + b.atk + fashAtk()) * (1 + m); hpM[k] = (1 + b.hp) * (1 + m); }
    return { units, atkM, hpM, def: b.def };
  }
  const campSide = L => ({ units: campArmy(L), atkM: { guard: 1, car: 1, pap: 1 }, hpM: { guard: 1, car: 1, pap: 1 }, def: 0.02 * L });
  const campPower = L => Math.round(troopPower(campArmy(L)) * (1 + 0.02 * L));
  function marchPower(st, units, heroId) {
    const s = attackerSide(st, units, heroId);
    let p = 0;
    for (const k of TYPES) p += units[k].reduce((x, n, i) => x + n * unitPw(i + 1), 0) * Math.sqrt(s.atkM[k] * s.hpM[k] * (1 + s.def));
    return Math.round(p);
  }
  const prodAt = l => 500 * Math.pow(1.16, l - 1); // 某等級資源建築每小時產量（無加成）
  function campLoot(L, rand) {
    const P = prodAt(L);
    const l = { silk: nice(P * (0.5 + rand() * 0.3)), spice: nice(P * (0.5 + rand() * 0.3)) };
    if (L >= 4) l.ore = nice(P * 0.18);
    if (L >= 9) l.leaf = nice(P * 0.07);
    if (rand() < 0.6) { const pool = HEROES; l.shard = { [pool[Math.floor(rand() * pool.length)].id]: 1 + Math.floor(L / 10) }; }
    if (rand() < 0.45) l.spd = 5 * (1 + (L >= 8 ? 1 : 0));
    if (L >= 10 && rand() < 0.2) l.spd = (l.spd || 0) + 60;
    if (rand() < 0.04) l.gems = 1 + Math.floor(rand() * 2);
    return l;
  }
  // 黃牛王：打 6 回合，看造成多少傷害
  function bossFight(st, units, heroId, rand) {
    const A = attackerSide(st, units, heroId);
    const town = lvl(st, 'town'), bt = Math.min(10, 1 + Math.floor(town / 3));
    let dmg = 0;
    const lost = { guard: 0, car: 0, pap: 0 }, alive = {};
    for (const k of TYPES) alive[k] = sum(units[k]);
    const log = [];
    for (let r = 0; r < 6; r++) {
      let rd = 0;
      for (const k of TYPES) {
        const n = alive[k]; if (n <= 0) continue;
        const atkU = units[k].reduce((x, c, i) => x + c * unitAtk(i + 1), 0) / Math.max(1, sum(units[k]));
        rd += n * atkU * A.atkM[k] * 0.6 * (0.9 + rand() * 0.2);
        const k2 = Math.min(n, n * 0.045 * (1 + bt * 0.02) / (1 + A.def) / A.hpM[k]);
        alive[k] -= k2; lost[k] += k2;
      }
      dmg += rd; log.push(rd);
    }
    for (const k of TYPES) lost[k] = Math.round(lost[k]);
    return { dmg: Math.round(dmg), lost, log };
  }

  // ---------- 地圖 ----------
  const nodeLvMax = town => RES_NODE_TOWN.filter(x => x && town >= x).length;
  function spawnNode(st, kind) {
    const town = lvl(st, 'town'), M = st.map;
    for (let tries = 0; tries < 80; tries++) {
      const a = rnd(st) * Math.PI * 2, r = 150 + rnd(st) * 570;
      const x = Math.round(MAP.home[0] + Math.cos(a) * r), y = Math.round(MAP.home[1] + Math.sin(a) * r * 0.92);
      if (x < 80 || x > MAP.w - 80 || y < 110 || y > MAP.h - 80) continue;
      if (Math.hypot(x - MAP.boss[0], y - MAP.boss[1]) < 170) continue;
      if (M.nodes.some(n => Math.hypot(n.x - x, n.y - y) < 100)) continue;
      const n = { id: M.nid++, kind, x, y };
      if (kind === 'camp') {
        const base = Math.min(MAX_LV, M.maxCamp + 1);
        const has = M.nodes.some(o => o.kind === 'camp' && o.lv === base);
        n.lv = has ? clamp(base - Math.floor(rnd(st) * 4) + (rnd(st) < 0.25 ? 1 : 0), 1, MAX_LV) : base;
      } else {
        const r2 = rnd(st), types = town >= 10 ? ['silk', 'spice', 'silk', 'spice', 'ore', 'ore', 'leaf'] : town >= 5 ? ['silk', 'spice', 'silk', 'spice', 'ore'] : ['silk', 'spice'];
        n.type = types[Math.floor(r2 * types.length)];
        const mx = nodeLvMax(town);
        n.lv = Math.max(1, mx - Math.floor(Math.pow(rnd(st), 1.6) * mx));
        n.amt = n.left = Math.round(RES_NODE_AMT[n.lv] * RATE_K[n.type] * (0.9 + rnd(st) * 0.2));
      }
      M.nodes.push(n);
      return n;
    }
    return null;
  }
  function fillMap(st) {
    const M = st.map;
    const camps = M.nodes.filter(n => n.kind === 'camp').length, res = M.nodes.filter(n => n.kind === 'res').length;
    for (let i = camps; i < 9; i++) spawnNode(st, 'camp');
    for (let i = res; i < 11; i++) spawnNode(st, 'res');
    // 一定要有一個「下一級挑戰」的據點
    const base = Math.min(MAX_LV, M.maxCamp + 1);
    if (!M.nodes.some(n => n.kind === 'camp' && n.lv === base)) {
      const c = M.nodes.filter(n => n.kind === 'camp' && !st.marches.some(m => m.node === n.id)).sort((a, b) => a.lv - b.lv)[0];
      if (c) c.lv = base;
    }
  }
  const nodeById = (st, id) => st.map.nodes.find(n => n.id === id);
  function travelMs(st, x, y) { const d = Math.hypot(x - MAP.home[0], y - MAP.home[1]); return (6 + d * 0.05) * SEC / (1 + bonus(st).march); }
  function marchLoad(st, units) { return Math.round(TYPES.reduce((a, k) => a + units[k].reduce((x, n, i) => x + n * unitLoad(i + 1), 0), 0) * (1 + bonus(st).load)); }
  function gatherRate(st, node) { return RES_NODE_RATE[node.lv] * RATE_K[node.type] * (1 + bonus(st).gather); } // 每小時
  // 一鍵配兵：高兵階優先，各兵種平均
  function autoUnits(st, cap) {
    const u = { guard: tz(), car: tz(), pap: tz() };
    let left = cap;
    for (let i = 9; i >= 0 && left > 0; i--) {
      const avail = TYPES.map(k => st.troops[k][i]), tot = sum(avail);
      if (!tot) continue;
      const take = Math.min(tot, left);
      let used = 0;
      TYPES.forEach((k, j) => { const x = Math.min(avail[j], Math.floor(take * avail[j] / tot)); u[k][i] = x; used += x; });
      for (let j = 0; j < 3 && used < take; j++) { const k = TYPES[j], x = Math.min(avail[j] - u[k][i], take - used); u[k][i] += x; used += x; }
      left -= used;
    }
    return u;
  }
  function marchBlock(st, kind, node, units, heroId, now) {
    if (st.marches.length >= marchSlots(lvl(st, 'town'))) return { code: 'slots' };
    if (troopCount(units) <= 0) return { code: 'notroops' };
    if (heroId && st.marches.some(m => m.hero === heroId)) return { code: 'herobusy' };
    if (kind !== 'boss' && (!node || st.marches.some(m => m.node === node.id))) return { code: 'taken' };
    if (kind === 'camp' && stamNow(st, now) < STAM.camp) return { code: 'stam' };
    if (kind === 'boss') { const B = st.boss; if (!B || B.day !== dayKey(now)) return { code: 'noboss' }; if (B.hits >= 3 + B.extra) return { code: 'nohits' }; }
    return null;
  }
  function beginMarch(st, kind, node, units, heroId, now) {
    for (const k of TYPES) units[k].forEach((n, i) => { st.troops[k][i] -= n; });
    const [x, y] = kind === 'boss' ? MAP.boss : [node.x, node.y];
    const tr = travelMs(st, x, y);
    const m = { id: st.mid++, kind, node: node ? node.id : 0, x, y, hero: heroId || null, units, t0: now, t1: now + tr, t2: 0, t3: 0, st: 'go', loot: null, wnd: null, rep: 0 };
    if (kind === 'boss') st.boss.hits++;
    if (kind === 'camp') stamAdd(st, -STAM.camp, now);
    st.marches.push(m);
    return m;
  }
  function recallMarch(st, id, now) { // 召回：沿原路回家
    const m = st.marches.find(x => x.id === id); if (!m || m.st === 'back') return;
    if (m.st === 'go') { const done = now - m.t0; m.t0 = now - (m.t1 - now); m.t3 = now + done; m.st = 'back'; if (m.kind === 'boss' && st.boss) st.boss.hits = Math.max(0, st.boss.hits - 1); if (m.kind === 'camp') stamAdd(st, STAM.camp, now); }
    else if (m.st === 'work') { // 採集中途召回：按比例拿資源
      const node = nodeById(st, m.node);
      if (node && m.kind === 'gather') { const got = Math.floor(gatherRate(st, node) * (now - m.t1) / HOUR); const g = Math.min(got, m.cap, node.left); node.left -= g; m.loot = { [node.type]: g }; if (node.left <= 0) st.map.nodes = st.map.nodes.filter(n => n !== node); }
      m.st = 'back'; m.t2 = now; m.t3 = now + (m.t1 - m.t0);
    }
  }

  // ---------- 精力 ----------
  const stamNow = (st, now) => Math.min(Math.max(STAM.max, st.stam.v), st.stam.v + Math.max(0, now - st.stam.t) / STAM.regen);
  function stamAdd(st, n, now) { const v = stamNow(st, now) + n; st.stam = { v, t: now }; }
  const stamNext = (st, now) => { const v = stamNow(st, now); return v >= STAM.max ? 0 : STAM.regen - (v % 1) * STAM.regen; };

  // ---------- 黃牛王（每日） ----------
  function ensureBoss(st, now) {
    const day = dayKey(now);
    if (st.boss && st.boss.day === day) return st.boss;
    // 結算昨天的排名
    let prev = null;
    if (st.boss && st.boss.dmg > 0) { const r = bossRank(st.boss, DAY * 2 + st.boss.t0); prev = { rank: r.rank, dmg: st.boss.dmg, claimed: false }; }
    const rand = seeded(hashStr(day + ':' + st.born));
    // 每日基準 = 用目前最強隊伍打一次的預期傷害（3 次免費出擊大約拿到 3 個里程碑）
    const par = Math.max(1500, bossFight(st, autoUnits(st, marchCap(lvl(st, 'town'), heroOf('erika').lv)), 'erika', seeded(7)).dmg);
    const members = [];
    const names = [...FRIENDS].sort(() => rand() - 0.5).slice(0, 7);
    for (const nm of names) members.push({ name: nm, cap: Math.round(par * (1.2 + rand() * 3.6)), face: Math.floor(rand() * 5) + 1 });
    const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
    const hp = Math.round(sum(members.map(m => m.cap)) * 1.05 + par * 2.6);
    st.boss = { day, t0: t0.getTime(), par, hp, members, dmg: 0, hits: 0, extra: 0, ms: {}, prev: prev || (st.boss && st.boss.prev && !st.boss.prev.claimed ? st.boss.prev : null) };
    return st.boss;
  }
  // 閨蜜們的傷害隨時間累積（一天內從 8 點到 23 點打完）
  function memberDmg(B, m, now) { const f = clamp((now - B.t0 - 8 * HOUR) / (15 * HOUR), 0, 1); return Math.round(m.cap * (f * f * (3 - 2 * f))); }
  function bossRank(B, now) {
    const rows = B.members.map(m => ({ name: m.name, face: m.face, dmg: memberDmg(B, m, now), me: false }));
    rows.push({ name: '妳', dmg: B.dmg, me: true });
    rows.sort((a, b) => b.dmg - a.dmg);
    const total = sum(rows.map(r => r.dmg));
    return { rows, rank: rows.findIndex(r => r.me) + 1, total, left: Math.max(0, B.hp - total) };
  }
  const BOSS_MS = [0.8, 1.8, 2.8, 4.5]; // 個人傷害里程碑（× 每日基準）
  function bossMilestones(B) { return BOSS_MS.map((k, i) => ({ i, need: Math.round(B.par * k), rw: [{ silk: 1, spice: 1, s5: 2 }, { any: 2, s5: 2 }, { any: 3, s60: 1 }, { any: 5, gems: 5, s60: 1 }][i] })); }
  const rankReward = rank => rank === 1 ? { gems: 10, any: 5 } : rank <= 3 ? { gems: 5, any: 3 } : { gems: 2, any: 1 };

  // ---------- 主時鐘：把所有計時推進到 now（離線回來也正確） ----------
  function process(st, now) {
    const ev = [];
    rollDay(st, now);
    for (let guard = 0; guard < 4000; guard++) {
      let bt = Infinity, fn = null;
      const at = (t, f) => { if (t <= now && t < bt) { bt = t; fn = f; } };
      st.q.forEach((j, i) => {
        if (!j) return;
        const e = jobEnd(j);
        if (j.helps < j.hmax && j.hnext < e) at(j.hnext, t => { j.cut += j.hper; j.helps++; j.hnext = t + 12 * SEC; ev.push({ type: 'help', b: j.b, t }); });
        else at(e, t => { st.b[j.b].lv = j.to; st.q[i] = null; bump(st, 'upg', 1); ev.push({ type: 'built', b: j.b, lv: j.to, t }); });
      });
      if (st.rsch) {
        const j = st.rsch, e = jobEnd(j);
        if (j.helps < j.hmax && j.hnext < e) at(j.hnext, t => { j.cut += j.hper; j.helps++; j.hnext = t + 12 * SEC; });
        else at(e, t => { st.tech[j.id] = j.to; st.rsch = null; bump(st, 'tech', 1); ev.push({ type: 'tech', id: j.id, lv: j.to, t }); });
      }
      for (const k of TYPES) { const j = st.train[k]; if (j && !j.done) at(jobEnd(j), t => { j.done = true; ev.push({ type: 'trained', k, n: j.n, t }); }); }
      if (st.heal) { const j = st.heal; at(jobEnd(j), t => { let n = 0; for (const k of TYPES) j.units[k].forEach((c, i) => { st.troops[k][i] += c; n += c; }); st.heal = null; bump(st, 'heal', n); ev.push({ type: 'healed', n, t }); }); }
      for (const m of st.marches) {
        if (m.st === 'go') at(m.t1, t => arrive(st, m, t, ev));
        else if (m.st === 'work') at(m.t2, t => { finishWork(st, m, t); });
        else if (m.st === 'back') at(m.t3, t => homecoming(st, m, t, ev));
      }
      if (!fn) break;
      settle(st, bt);
      fn(bt);
    }
    fillMap(st);
    return ev;
  }
  function arrive(st, m, t, ev) {
    const node = m.kind === 'boss' ? null : nodeById(st, m.node);
    const back = () => { m.st = 'back'; m.t2 = t; m.t3 = t + (m.t1 - m.t0); };
    const rand = () => rnd(st);
    if (m.kind === 'gather') {
      if (!node) { back(); return; }
      m.cap = marchLoad(st, m.units);
      const amt = Math.min(m.cap, node.left);
      m.st = 'work'; m.t2 = t + amt / gatherRate(st, node) * HOUR; m.amt = amt;
      return;
    }
    if (m.kind === 'camp') {
      if (!node) { back(); return; }
      const before = JSON.parse(JSON.stringify(m.units));
      const r = battle(attackerSide(st, m.units, m.hero), campSide(node.lv), rand);
      const loss = splitLoss(m.units, r.aLost);
      for (const k of TYPES) loss[k].forEach((n, i) => { m.units[k][i] -= n; });
      m.wnd = loss;
      const rep = { id: st.mid++, t, kind: 'camp', lv: node.lv, win: r.win, stars: r.stars, hero: m.hero, ar: r.ar, dr: r.dr, log: r.log, before, aLost: r.aLost, dArmy: campArmy(node.lv), dLost: r.dLost, loot: null, read: false, first: false };
      if (r.win) {
        rep.loot = campLoot(node.lv, rand);
        if (node.lv > st.map.maxCamp) { rep.first = true; rep.loot.gems = (rep.loot.gems || 0) + (node.lv % 5 === 0 ? 5 : 1); st.map.maxCamp = node.lv; }
        m.loot = rep.loot;
        st.map.nodes = st.map.nodes.filter(n => n !== node);
        bump(st, 'camp', 1);
      }
      st.reports.unshift(rep); if (st.reports.length > 20) st.reports.length = 20;
      m.rep = rep.id;
      ev.push({ type: 'report', rep, t });
      back();
      return;
    }
    if (m.kind === 'boss') {
      const B = st.boss && st.boss.day === dayKey(m.t0) ? st.boss : null;
      if (!B) { back(); return; }
      const before = JSON.parse(JSON.stringify(m.units));
      const r = bossFight(st, m.units, m.hero, rand);
      const loss = splitLoss(m.units, r.lost);
      for (const k of TYPES) loss[k].forEach((n, i) => { m.units[k][i] -= n; });
      m.wnd = loss;
      B.dmg += r.dmg;
      const rk = bossRank(B, t);
      const rep = { id: st.mid++, t, kind: 'boss', win: true, stars: 0, hero: m.hero, dmg: r.dmg, total: B.dmg, rank: rk.rank, log: r.log, before, aLost: r.lost, read: false };
      st.reports.unshift(rep); if (st.reports.length > 20) st.reports.length = 20;
      m.rep = rep.id; bump(st, 'boss', 1);
      ev.push({ type: 'report', rep, t });
      back();
    }
  }
  function finishWork(st, m, t) {
    const node = nodeById(st, m.node);
    if (node && m.kind === 'gather') {
      const g = Math.min(m.amt, node.left);
      node.left -= g; m.loot = { [node.type]: Math.floor(g) };
      if (node.left <= 1) st.map.nodes = st.map.nodes.filter(n => n !== node);
    }
    m.st = 'back'; m.t3 = t + (m.t1 - m.t0);
  }
  function homecoming(st, m, t, ev) {
    for (const k of TYPES) m.units[k].forEach((n, i) => { st.troops[k][i] += n; });
    let lostHome = 0;
    if (m.wnd) lostHome = addWounded(st, m.wnd);
    if (m.loot) grant(st, m.loot, t);
    if (m.kind === 'gather' && m.loot) bump(st, 'gather', 1);
    st.marches = st.marches.filter(x => x !== m);
    ev.push({ type: 'home', kind: m.kind, loot: m.loot, lostHome, t, x: m.x, y: m.y });
  }

  // ---------- 獎勵 ----------
  // 資源、加速時間、精力直接入帳；粉鑽、英雄碎片、金幣（分鐘收益）放進 out，由畫面層交給主程式 api.grant 發放
  // 獎勵格式：{ silk, spice, ore, leaf, spd(分鐘), s5, s60(以分鐘換算), stam, gems, shard:{id:n}, any(萬能碎片), goldMin }
  function grant(st, rw, now = Date.now()) {
    for (const k of RES) if (rw[k]) st.res[k] += rw[k];
    const spd = (rw.spd || 0) + (rw.s5 || 0) * 5 + (rw.s60 || 0) * 60;
    if (spd) st.items.spd += spd;
    if (rw.stam) stamAdd(st, rw.stam, Math.max(st.stam.t, now));
    const o = {};
    if (rw.gems) o.gems = rw.gems;
    if (rw.goldMin) o.goldMin = rw.goldMin;
    const sh = { ...(rw.shard || {}) };
    if (rw.any) { const id = anyTarget(); sh[id] = (sh[id] || 0) + rw.any; }
    if (Object.keys(sh).length) o.shards = sh;
    if (Object.keys(o).length) { st.out.push(o); if (st.out.length > 60) st.out.splice(0, st.out.length - 60); }
    return o;
  }

  // ---------- 任務 ----------
  const CHAPTERS = ['新官上任', '名媛社交圈', '學院時光', '黃牛退散', '精品帝國', '華麗轉身', '國際名流', '社交女王', '時尚帝國', '傳奇貴婦', '王國之巔'];
  const heroLvGoal = L => L <= 10 ? L + 2 : Math.min(60, 2 * L - 8);
  const MAIN = (() => {
    const L = [];
    const q = (ch, t, k, n, x, rw, go) => L.push({ ch, t, k, n, ...x, rw, go });
    const B = (b, n) => ({ b, n });
    q(1, '點一下絲綢工坊上的泡泡，收成絲綢', 'collect', 1, {}, { spice: 300 }, { b: 'silk' });
    q(1, '建造香料庫', 'b', 1, { b: 'spice' }, { silk: 400 }, { b: 'spice' });
    q(1, '把百貨本館升到 Lv.2', 'b', 2, { b: 'town' }, { silk: 500, spice: 500, s5: 1 }, { b: 'town' });
    q(1, '建造保鑣訓練所', 'b', 1, { b: 'guard' }, { spice: 400 }, { b: 'guard' });
    q(1, '訓練 10 名保鑣', 'train', 10, {}, { silk: 600 }, { b: 'guard' });
    q(1, '把鐵門保全升到 Lv.2', 'b', 2, { b: 'wall' }, { silk: 300, spice: 300 }, { b: 'wall' });
    q(1, '把百貨本館升到 Lv.3', 'b', 3, { b: 'town' }, { gems: 10, s5: 2, silk: 600, spice: 600 }, { b: 'town' });
    q(2, '建造名媛殿堂', 'b', 1, { b: 'hall' }, { shard: { vivi: 5 } }, { b: 'hall' });
    q(2, '在名媛殿堂把任一英雄升到 Lv.3', 'heroLv', 3, {}, { silk: 800, spice: 800 }, { ui: 'heroes' });
    q(2, '把鐵門保全升到 Lv.3', 'b', 3, { b: 'wall' }, { silk: 500 }, { b: 'wall' });
    q(2, '把百貨本館升到 Lv.4', 'b', 4, { b: 'town' }, { spice: 800, s5: 2 }, { b: 'town' });
    q(2, '出征擊敗 Lv.1 黃牛黨據點', 'camp', 1, {}, { silk: 900, spice: 900, shard: { chiyo: 4 } }, { ui: 'camp' });
    q(2, '建造 SPA 療養院', 'b', 1, { b: 'spa' }, { silk: 700 }, { b: 'spa' });
    q(2, '到娛樂城過一關時尚消消樂', 'ev', 1, { ev: 'm3_clear' }, { spice: 900, any: 2 }, { ui: 'play', game: 'match3' });
    q(2, '把鐵門保全升到 Lv.4', 'b', 4, { b: 'wall' }, { silk: 600, spice: 600 }, { b: 'wall' });
    q(2, '把百貨本館升到 Lv.5', 'b', 5, { b: 'town' }, { gems: 15, s5: 3, ore: 300 }, { b: 'town' });
    q(3, '建造時尚學院', 'b', 1, { b: 'acad' }, { silk: 900, spice: 900 }, { b: 'acad' });
    q(3, '在時尚學院完成 1 項研究', 'tech', 1, {}, { s5: 3 }, { ui: 'acad' });
    q(3, '建造寶石礦場', 'b', 1, { b: 'ore' }, { ore: 400 }, { b: 'ore' });
    q(3, '建造名車車庫', 'b', 1, { b: 'car' }, { spice: 1000 }, { b: 'car' });
    q(3, '派部隊採集 1 次資源', 'gather', 1, {}, { silk: 1000, shard: { fumi: 5 } }, { ui: 'gather' });
    q(3, '建造閨蜜會館', 'b', 1, { b: 'guild' }, { silk: 800, spice: 800 }, { b: 'guild' });
    q(3, '擊敗 Lv.3 黃牛黨據點', 'camp', 3, {}, { ore: 300, shard: { chiyo: 6 } }, { ui: 'camp' });
    q(3, `討伐「${BOSS_NAME}」1 次`, 'boss', 1, {}, { any: 3, s5: 2 }, { ui: 'boss' });
    q(3, '到娛樂城打一場名媛對決', 'ev', 1, { ev: 'arena_play' }, { silk: 1200, any: 2 }, { ui: 'play', game: 'arena' });
    for (let lv = 6; lv <= MAX_LV; lv++) {
      const ch = Math.min(CHAPTERS.length, 4 + Math.floor((lv - 6) / 3));
      const R = resAt(lv), r = x => nice(R * x);
      const req = townReq(lv);
      for (const [b, n] of Object.entries(req)) if (b !== 'wall') q(ch, `把${BLD[b].name}升到 Lv.${n}`, 'b', n, { b }, { silk: r(0.8), spice: r(0.8) }, { b });
      // 每一級穿插一個玩法引導
      const flav = [
        () => q(ch, `累計訓練 ${50 * lv} 名部隊`, 'train', 50 * lv, {}, { silk: r(0.6), s5: 2 }, { ui: 'train' }),
        () => q(ch, `擊敗 Lv.${Math.min(MAX_LV, lv)} 黃牛黨據點`, 'camp', Math.min(MAX_LV, lv), {}, { spice: r(0.6), any: 2, stam: 30 }, { ui: 'camp' }),
        () => q(ch, `累計完成 ${Math.round(lv * 2.2)} 次研究`, 'tech', Math.round(lv * 2.2), {}, { s60: 1, silk: r(0.4) }, { ui: 'acad' }),
        () => q(ch, `戰力達到 ${nice(900 * Math.pow(1.24, lv))}`, 'power', nice(900 * Math.pow(1.24, lv)), {}, { any: 3, s5: 3 }, { ui: 'train' }),
        () => q(ch, `任一英雄升到 Lv.${heroLvGoal(lv)}`, 'heroLv', heroLvGoal(lv), {}, { spice: r(0.6) }, { ui: 'heroes' }),
        () => q(ch, `累計採集 ${Math.ceil(lv / 2)} 次資源`, 'gather', Math.ceil(lv / 2), {}, { ore: r(0.2), silk: r(0.4) }, { ui: 'gather' }),
        () => q(ch, `${Math.min(6, 1 + Math.floor(lv / 5))} 位英雄達到 Lv.${Math.floor(heroLvGoal(lv) * .6)}`, 'heroN', Math.min(6, 1 + Math.floor(lv / 5)), { lv: Math.floor(heroLvGoal(lv) * .6) }, { any: 4 }, { ui: 'heroes' }),
      ];
      flav[lv % flav.length]();
      if (lv === 7) q(ch, '建造 ERIKA 銀行', 'b', 1, { b: 'bank' }, { silk: r(0.5) }, { b: 'bank' });
      if (lv === 8) q(ch, '在 ERIKA 銀行存一筆金幣', 'bank', 1, {}, { gems: 5 }, { b: 'bank' });
      if (lv === 10) q(ch, '建造金箔坊', 'b', 1, { b: 'leaf' }, { leaf: 200 }, { b: 'leaf' });
      if (lv % 4 === 0) q(ch, `把絲綢工坊升到 Lv.${lv - 2}`, 'b', lv - 2, { b: 'silk' }, { spice: r(0.4) }, { b: 'silk' });
      if (lv % 4 === 2) q(ch, `把香料庫升到 Lv.${lv - 2}`, 'b', lv - 2, { b: 'spice' }, { silk: r(0.4) }, { b: 'spice' });
      const sq = { 10: 3, 16: 4, 22: 5, 28: 6 }[lv];
      const play = { 7: ['牌桌玩 3 局（妞妞或十三支）', 'card_round', 3, 'niuniu'], 9: ['參加 1 場名媛吃雞大作戰', 'royale_match', 1, 'royale'], 11: ['打 1 局貴婦麻將', 'mahjong_hand', 1, 'mahjong'], 13: ['研究 1 項「娛樂城」科技', 'playTech', 1, null], 15: ['時尚消消樂累計過 3 關', 'm3_clear', 3, 'match3'], 19: ['名媛對決累計打 3 場', 'arena_play', 3, 'arena'] }[lv];
      if (play) q(ch, play[0], play[1] === 'playTech' ? 'playTech' : 'ev', play[2], { ev: play[1] }, { any: 3, spice: r(0.5) }, play[3] ? { ui: 'play', game: play[3] } : { ui: 'acad', br: 'play' });
      if (sq) q(ch, `任一英雄達到 ${sq} 星`, 'star', sq, {}, { any: 5 }, { ui: 'heroes' });
      q(ch, `把鐵門保全升到 Lv.${lv - 1}`, 'b', lv - 1, { b: 'wall' }, { silk: r(0.7), spice: r(0.7) }, { b: 'wall' });
      const fl = FLOOR_REQ.indexOf(lv);
      q(ch, `把百貨本館升到 Lv.${lv}${fl >= 0 ? `（解鎖百貨 ${fl + 1}F）` : ''}`, 'b', lv, { b: 'town' }, { gems: lv % 5 === 0 ? 20 : fl >= 0 ? 10 : 3, s60: lv >= 12 ? 1 : 0, s5: 2, silk: r(1.2), spice: r(1.2), ore: lv >= 6 ? r(0.3) : 0, leaf: lv >= 11 ? r(0.12) : 0 }, { b: 'town' });
    }
    return L;
  })();
  function qVal(st, q) {
    switch (q.k) {
      case 'b': return lvl(st, q.b);
      case 'heroN': return HEROES.filter(h => heroOf(h.id).lv >= (q.lv || 1)).length;
      case 'heroLv': return Math.max(...HEROES.map(h => heroOf(h.id).lv));
      case 'star': return Math.max(...HEROES.map(h => heroOf(h.id).star));
      case 'ev': return (st.evc && st.evc[q.ev]) || 0;
      case 'playTech': return TECH.filter(t => t.br === 'play').reduce((a, t) => a + (st.tech[t.id] || 0), 0);
      case 'camp': return st.map.maxCamp;
      case 'power': return power(st);
      default: return st.stat[q.k] || 0;
    }
  }
  const curQuest = st => MAIN[st.qi] || null;
  const questDone = (st, q = curQuest(st)) => !!q && qVal(st, q) >= q.n;
  // 娛樂城任務不想玩可以略過（不給獎勵），主線不會卡住
  function skipQuest(st) { const q = curQuest(st); if (!q || (q.k !== 'ev' && q.k !== 'playTech')) return false; st.qi++; return true; }
  function claimQuest(st) { const q = curQuest(st); if (!q || !questDone(st, q)) return null; st.qi++; return { q, got: grant(st, q.rw) }; }
  const DAILY = [
    { id: 'd1', t: '收成資源 5 次', k: 'collect', n: 5, ui: 'collect' },
    { id: 'd2', t: '升級任一建築 2 次', k: 'upg', n: 2, ui: 'upgrade' },
    { id: 'd3', t: '訓練 30 名部隊', k: 'train', n: 30, ui: 'train' },
    { id: 'd4', t: '擊敗黃牛黨據點 2 次', k: 'camp', n: 2, ui: 'camp' },
    { id: 'd5', t: '採集資源 1 次', k: 'gather', n: 1, ui: 'gather' },
    { id: 'd6', t: `討伐${BOSS_NAME} 1 次`, k: 'boss', n: 1, ui: 'boss' },
    { id: 'd7', t: '完成 1 項研究', k: 'tech', n: 1, ui: 'acad' },
  ];
  const DAILY_PTS = 20;
  const DAILY_CHEST = [{ pts: 40, rw: { s5: 3, silk: 1, spice: 1 } }, { pts: 80, rw: { any: 3, s60: 1, stam: 30 } }, { pts: 120, rw: { any: 5, gems: 5 } }];
  const dailyPts = st => DAILY.filter(d => st.day.done[d.id]).length * DAILY_PTS;
  // 每日寶箱的資源以「目前本館等級」的規模給
  function scaleRw(st, rw) { const o = { ...rw }, R = resAt(lvl(st, 'town') + 1); for (const k of ['silk', 'spice', 'ore', 'leaf']) if (o[k] === 1) o[k] = nice(R * 0.6); return o; }

  const Core = {
    STAM, stamNow, stamAdd, stamNext, setHeroes, setFashion, heroOf, heroGlobal, heroGlobalRaw, perk, PERKS, PERK_MAX, resUnit, anyTarget, heroLvGoal, fashAtk,
    RES, RES_INFO, BLD, BIDS, TYPES, TROOP, TIER_NAME, HEROES, HERO, TECH, TECHM, BRANCH, MAP, MAIN, DAILY, DAILY_CHEST, DAILY_PTS, CHAPTERS, BANK_PLANS, FLOOR_REQ, TT, MAX_LV, G_NAME, BOSS_NAME, NODE_NAME, BUTLER, QUEUE2_GEMS, CAP_H, RES_NODE_TOWN,
    freshState, ensure, bonus, incomeMult, incomeParts, townMult, prodRate, stored, bubbleAt, settle, collect, collectAll, rollDay, bump,
    upgCost, upgTime, upgReqs, upgBlock, beginUpgrade, cancelUpgrade, jobEnd, jobLeft, freeMs, gemCost, recommend, queueCount, freeQueue, busyQueue, townReq, goldAt, resAt,
    techCost, techTime, techBlock, beginResearch, techAcadReq, recommendTech,
    unitAtk, unitHp, unitPw, unitLoad, unitCost, unitTime, tierMax, batchCap, trainCost, trainTime, maxTrain, trainBlock, beginTrain, claimTrain, troopCount, troopPower,
    hospCap, woundedCount, addWounded, healCost, healTime, healPlan, beginHeal,
    heroTroopBonus, heroPower, power,
    battle, splitLoss, attackerSide, campSide, campArmy, campPower, marchPower, campLoot, bossFight,
    spawnNode, fillMap, nodeById, travelMs, marchLoad, gatherRate, autoUnits, marchBlock, beginMarch, recallMarch, marchSlots, marchCap, nodeLvMax,
    ensureBoss, bossRank, memberDmg, bossMilestones, rankReward, bankGems, bankMaxH,
    process, grant, qVal, curQuest, questDone, claimQuest, skipQuest, dailyPts, scaleRw, lvl, dayKey, nice, rnd, seeded, hashStr, tz, sum,
  };

  // ================= 4. 畫面 =================
  // ---------- 4a. 城鎮美術（SVG 程式繪製，等角視角） ----------
  const TOWN = { w: 820, h: 1290, ox: 410, oy: 210 };
  const tsx = u => TOWN.ox + u * 32, tsy = v => TOWN.oy + v * 16;
  const f1 = n => Math.round(n * 10) / 10;
  const pts = a => a.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ');
  const poly = (a, fill, ex = '') => `<polygon points="${pts(a)}" fill="${fill}" ${ex}/>`;
  const OL = 'stroke="#5a2740" stroke-opacity=".22" stroke-width=".8" stroke-linejoin="round"';
  const tierOf = lv => lv <= 0 ? -1 : lv < 5 ? 0 : lv < 10 ? 1 : lv < 15 ? 2 : lv < 20 ? 3 : lv < 25 ? 4 : 5;
  const star4 = (x, y, r) => `M${f1(x)} ${f1(y - r)}Q${f1(x)} ${f1(y)} ${f1(x + r)} ${f1(y)}Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y + r)}Q${f1(x)} ${f1(y)} ${f1(x - r)} ${f1(y)}Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y - r)}Z`;

  // 各建築色票：l/r = 左右牆面，roof = [受光面, 背光面, 亮部]
  const PAL = {
    town: { l: '#fff9f3', r: '#f0dbd1', roof: ['#ee93b4', '#c95f8a', '#f9c3d6'] },
    hall: { l: '#fffaf7', r: '#eddcd8', roof: ['#f5cad8', '#d89bb1', '#fde6ee'] },
    acad: { l: '#f1eaff', r: '#d7cbf1', roof: ['#9483e2', '#6b59c0', '#bdb3f3'] },
    bank: { l: '#fffdf8', r: '#ebe2d2', roof: ['#ecd394', '#c49b48', '#f8e8bd'] },
    spa: { l: '#ebf8f2', r: '#cae8db', roof: ['#72c7ac', '#3f9a80', '#a6dfcb'] },
    guild: { l: '#fff2e9', r: '#f4d8c9', roof: ['#f4a08c', '#cf6c5a', '#fbc8bb'] },
    guard: { l: '#6572ae', r: '#4a5590', roof: ['#3d4675', '#2c335a', '#5a65a0'] },
    car: { l: '#fdfdff', r: '#e2e4ee', roof: ['#e9729a', '#bb4672', '#f6a6c2'] },
    pap: { l: '#bfa5ea', r: '#9a7fd0', roof: ['#60449c', '#46307a', '#8165c7'] },
    silk: { l: '#fff7f3', r: '#f2ddd7', roof: ['#f5a9c4', '#d8789e', '#fccce0'] },
    spice: { l: '#fff4e4', r: '#f1dabd', roof: ['#ea9660', '#c26c39', '#f6ba8b'] },
    ore: { l: '#efe9fa', r: '#d4cbeb', roof: ['#a092d6', '#7564b0', '#c4b9ea'] },
    leaf: { l: '#fff8e6', r: '#efdfbb', roof: ['#dcb65e', '#ae8733', '#f1d793'] },
    wall: { l: '#fffaf5', r: '#eadbd2', roof: ['#e6cf9a', '#b99549', '#f6e6bd'] },
  };
  const GOLDR = ['#f3d88f', '#c79a3e', '#fff0c4'];

  function defsSVG() {
    let d = `<linearGradient id="kdGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4d6"/><stop offset=".55" stop-color="#ffd7b4"/><stop offset="1" stop-color="#f3ad9f"/></linearGradient>
    <linearGradient id="kdGlassC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9f6ff"/><stop offset=".5" stop-color="#bcdcf3"/><stop offset="1" stop-color="#8fb8de"/></linearGradient>
    <linearGradient id="kdGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdeab6"/><stop offset=".5" stop-color="#e2bd6a"/><stop offset="1" stop-color="#a97b30"/></linearGradient>
    <linearGradient id="kdGoldH" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1c9"/><stop offset=".45" stop-color="#d9b062"/><stop offset=".7" stop-color="#f6dfa0"/><stop offset="1" stop-color="#a5772c"/></linearGradient>
    <linearGradient id="kdPlum" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a2a50"/><stop offset="1" stop-color="#3b1530"/></linearGradient>
    <linearGradient id="kdWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdeef2"/><stop offset="1" stop-color="#a7dbe6"/></linearGradient>
    <linearGradient id="kdPool" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9f6fb"/><stop offset=".6" stop-color="#8fd3e6"/><stop offset="1" stop-color="#6cbfd8"/></linearGradient>
    <linearGradient id="kdGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6f3cf"/><stop offset=".5" stop-color="#d6ecbd"/><stop offset="1" stop-color="#c9e5b0"/></linearGradient>
    <linearGradient id="kdCliff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1d6c2"/><stop offset=".5" stop-color="#ddb39b"/><stop offset="1" stop-color="#c49278"/></linearGradient>
    <linearGradient id="kdCyl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffaf4"/><stop offset=".35" stop-color="#fff6ee"/><stop offset="1" stop-color="#e7cfc4"/></linearGradient>
    <linearGradient id="kdDomeP" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd3e2"/><stop offset=".4" stop-color="#ee93b4"/><stop offset="1" stop-color="#b8527d"/></linearGradient>
    <linearGradient id="kdDomeG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff2c6"/><stop offset=".4" stop-color="#e2bd6a"/><stop offset="1" stop-color="#9c712a"/></linearGradient>
    <linearGradient id="kdDomeV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d6cdfb"/><stop offset=".45" stop-color="#9483e2"/><stop offset="1" stop-color="#5a48ad"/></linearGradient>
    <linearGradient id="kdTrunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a9785a"/><stop offset="1" stop-color="#7a5038"/></linearGradient>
    <radialGradient id="kdCherry" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffe3ee"/><stop offset=".55" stop-color="#f8b4cb"/><stop offset="1" stop-color="#e488a8"/></radialGradient>
    <radialGradient id="kdLeaf" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#d6f0b8"/><stop offset=".55" stop-color="#9fd18a"/><stop offset="1" stop-color="#6fae6b"/></radialGradient>
    <radialGradient id="kdLeafD" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#bfe6b0"/><stop offset=".6" stop-color="#7cbf86"/><stop offset="1" stop-color="#4f9269"/></radialGradient>
    <radialGradient id="kdGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff2b8" stop-opacity=".95"/><stop offset="1" stop-color="#fff2b8" stop-opacity="0"/></radialGradient>
    <radialGradient id="kdShade" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#5a2740" stop-opacity=".22"/><stop offset="1" stop-color="#5a2740" stop-opacity="0"/></radialGradient>
    <radialGradient id="kdCrystal" cx=".3" cy=".25" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#e2b8ff"/><stop offset="1" stop-color="#8a5cd6"/></radialGradient>
    <linearGradient id="kdSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".35"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <pattern id="kdTiles" width="32" height="16" patternUnits="userSpaceOnUse"><rect width="32" height="16" fill="#f8ecdc"/><path d="M16 0L32 8L16 16L0 8Z" fill="#fbf3e7" stroke="#e9d6c0" stroke-width=".8"/></pattern>
    <pattern id="kdTilesP" width="32" height="16" patternUnits="userSpaceOnUse"><rect width="32" height="16" fill="#f9e3e6"/><path d="M16 0L32 8L16 16L0 8Z" fill="#fff4f2" stroke="#efcfd3" stroke-width=".8"/><circle cx="16" cy="8" r="1.4" fill="#f2c1cb"/></pattern>
    <pattern id="kdPave" width="16" height="8" patternUnits="userSpaceOnUse"><rect width="16" height="8" fill="#f3e6d6"/><path d="M8 0L16 4L8 8L0 4Z" fill="#f8efe3" stroke="#e5d2bd" stroke-width=".6"/></pattern>`;
    for (const [id, p] of Object.entries(PAL)) {
      d += `<linearGradient id="kdL-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.l}"/><stop offset="1" stop-color="${shade(p.l, -0.07)}"/></linearGradient>`;
      d += `<linearGradient id="kdR-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.r}"/><stop offset="1" stop-color="${shade(p.r, -0.1)}"/></linearGradient>`;
    }
    return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${d}</defs></svg>`;
  }
  function shade(hex, k) { // k<0 變暗，k>0 變亮
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(clamp(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255)));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // ----- 立面小零件（立面座標：左上為原點，y 向下）-----
  const winA = (x, y, w, h, g = 'url(#kdGlass)') => { const r = w / 2; return `<path d="M${f1(x)} ${f1(y + h)}V${f1(y + r)}a${f1(r)} ${f1(r)} 0 0 1 ${f1(w)} 0V${f1(y + h)}Z" fill="${g}" stroke="#fff" stroke-width="1.3"/><path d="M${f1(x + r)} ${f1(y + 2)}V${f1(y + h)}M${f1(x)} ${f1(y + h * .55)}H${f1(x + w)}" stroke="#fff" stroke-width=".8" opacity=".85"/><rect x="${f1(x - 1.5)}" y="${f1(y + h)}" width="${f1(w + 3)}" height="2.2" fill="url(#kdGold)"/>`; };
  const winR = (x, y, w, h, g = 'url(#kdGlass)', fr = '#fff') => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${g}" stroke="${fr}" stroke-width="1.3"/><path d="M${f1(x + w / 2)} ${f1(y)}V${f1(y + h)}M${f1(x)} ${f1(y + h * .45)}H${f1(x + w)}" stroke="${fr}" stroke-width=".8" opacity=".85"/>`;
  const winO = (x, y, r, g = 'url(#kdGlass)') => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${g}" stroke="#fff" stroke-width="1.3"/><path d="M${f1(x - r)} ${f1(y)}H${f1(x + r)}M${f1(x)} ${f1(y - r)}V${f1(y + r)}" stroke="#fff" stroke-width=".7" opacity=".8"/>`;
  const doorA = (x, y, w, h, fr = 'url(#kdGold)') => { const r = w / 2; return `<path d="M${f1(x - 2)} ${f1(y + h)}V${f1(y + r)}a${f1(r + 2)} ${f1(r + 2)} 0 0 1 ${f1(w + 4)} 0V${f1(y + h)}Z" fill="${fr}"/><path d="M${f1(x)} ${f1(y + h)}V${f1(y + r)}a${f1(r)} ${f1(r)} 0 0 1 ${f1(w)} 0V${f1(y + h)}Z" fill="url(#kdGlass)"/><path d="M${f1(x + r)} ${f1(y + r * .4)}V${f1(y + h)}" stroke="url(#kdGold)" stroke-width="1.2"/><circle cx="${f1(x + r - 2.2)}" cy="${f1(y + h * .66)}" r="1" fill="#a97b30"/><circle cx="${f1(x + r + 2.2)}" cy="${f1(y + h * .66)}" r="1" fill="#a97b30"/>`; };
  function awn(x, y, w, d, c, c2 = '#fff') {
    const n = Math.max(3, Math.round(w / 7)), sw = w / n;
    let s = `<path d="M${f1(x)} ${f1(y)}H${f1(x + w)}L${f1(x + w + 2)} ${f1(y + d)}H${f1(x - 2)}Z" fill="${c}"/>`;
    for (let i = 1; i < n; i += 2) s += `<path d="M${f1(x + i * sw)} ${f1(y)}h${f1(sw)}l${f1(sw * 0.1)} ${f1(d)}h${f1(-sw * 1.05)}Z" fill="${c2}" opacity=".95"/>`;
    for (let i = 0; i < n; i++) s += `<path d="M${f1(x - 2 + i * (w + 4) / n)} ${f1(y + d)}a${f1((w + 4) / n / 2)} ${f1((w + 4) / n / 2.4)} 0 0 0 ${f1((w + 4) / n)} 0Z" fill="${i % 2 ? c2 : c}"/>`;
    return s + `<path d="M${f1(x)} ${f1(y)}H${f1(x + w)}" stroke="#5a2740" stroke-opacity=".18"/>`;
  }
  const plaque = (x, y, w, h, t, fs = 7, fill = 'url(#kdPlum)', tc = '#f6dc98') => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="2" fill="${fill}" stroke="url(#kdGold)" stroke-width="1.2"/><text x="${f1(x + w / 2)}" y="${f1(y + h / 2 + fs * .36)}" text-anchor="middle" font-family="Bodoni Moda, Didot, Georgia, serif" font-style="italic" font-weight="700" font-size="${fs}" letter-spacing=".6" fill="${tc}">${t}</text>`;
  const pil = (x, y, w, h, c = '#fff', cap = 'url(#kdGold)') => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${c}" opacity=".9"/><rect x="${f1(x - 1)}" y="${f1(y)}" width="${f1(w + 2)}" height="2.4" fill="${cap}"/><rect x="${f1(x - 1)}" y="${f1(y + h - 2.4)}" width="${f1(w + 2)}" height="2.4" fill="${cap}" opacity=".8"/>`;
  const col = (x, y, w, h) => `<rect x="${f1(x)}" y="${f1(y + 3)}" width="${f1(w)}" height="${f1(h - 6)}" fill="#fffdf9"/><rect x="${f1(x + w * .62)}" y="${f1(y + 3)}" width="${f1(w * .38)}" height="${f1(h - 6)}" fill="#ecdcd4"/><path d="M${f1(x + w * .3)} ${f1(y + 4)}V${f1(y + h - 4)}" stroke="#e9d9d0" stroke-width=".7"/><rect x="${f1(x - 1.5)}" y="${f1(y)}" width="${f1(w + 3)}" height="3.2" fill="url(#kdGold)"/><rect x="${f1(x - 1.5)}" y="${f1(y + h - 3)}" width="${f1(w + 3)}" height="3" fill="#f3e7df"/>`;
  const rail = (x, y, w, c = 'url(#kdGold)') => { let s = `<path d="M${f1(x)} ${f1(y)}H${f1(x + w)}M${f1(x)} ${f1(y + 5)}H${f1(x + w)}" stroke="${c}" stroke-width="1.2"/>`; for (let i = x + 2; i < x + w; i += 3) s += `<path d="M${f1(i)} ${f1(y)}V${f1(y + 5)}" stroke="${c}" stroke-width=".7"/>`; return s; };
  const fbox = (x, y, w) => { let s = `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="3.4" fill="#fff" stroke="#e8c9cf" stroke-width=".5"/>`; for (let i = x + 1.5; i < x + w; i += 3) s += `<circle cx="${f1(i)}" cy="${f1(y - .5)}" r="1.5" fill="${['#ff8fb5', '#ffd166', '#ffffff', '#f77fa5'][Math.round(i) % 4]}"/>`; return s; };

  // ----- 立體零件 -----
  function isoFaces(x, y, rx, h, id, facL = '', facR = '', top = true) {
    const ry = rx / 2, L = [x - rx, y], B = [x, y + ry], R = [x + rx, y], T = [x, y - ry], up = p => [p[0], p[1] - h];
    let s = poly([L, B, up(B), up(L)], `url(#kdL-${id})`, OL) + `<g transform="matrix(1,.5,0,1,${f1(x - rx)},${f1(y - h)})">${facL}</g>`;
    s += poly([B, R, up(R), up(B)], `url(#kdR-${id})`, OL) + `<g transform="matrix(1,-.5,0,1,${f1(x)},${f1(y + ry - h)})">${facR}</g>`;
    if (top) s += poly([up(T), up(R), up(B), up(L)], shade(PAL[id] ? PAL[id].r : '#eee', 0.25), OL);
    return s;
  }
  const onL = (x, y, rx, h, inner) => `<g transform="matrix(1,.5,0,1,${f1(x - rx)},${f1(y - h)})">${inner}</g>`;
  const onR = (x, y, rx, h, inner) => `<g transform="matrix(1,-.5,0,1,${f1(x)},${f1(y + rx / 2 - h)})">${inner}</g>`;
  function roofHip(x, y, rx, h, rh, o, c, trim) {
    const X = rx + o, Y = X / 2, cy = y - h, L = [x - X, cy], B = [x, cy + Y], R = [x + X, cy], T = [x, cy - Y], Ap = [x, cy - rh];
    let s = poly([L, T, Ap], c[2]) + poly([T, R, Ap], c[1]) + poly([L, B, Ap], c[0], OL) + poly([B, R, Ap], c[1], OL);
    s += `<path d="M${pts([L, B, R]).replace(/ /g, ' L')}" fill="none" stroke="${trim || '#fff'}" stroke-width="1.6" stroke-opacity=".85"/>`.replace('M', 'M');
    s += `<path d="M${f1(B[0])} ${f1(B[1])}L${f1(Ap[0])} ${f1(Ap[1])}" stroke="${trim || '#fff'}" stroke-width="1" stroke-opacity=".6"/>`;
    return s;
  }
  function roofMansard(x, y, rx, h, mh, inset, o, c, trim, dorm = 0) {
    const X = rx + o, Y = X / 2, cy = y - h, X2 = rx * inset, Y2 = X2 / 2, cy2 = cy - mh;
    const L = [x - X, cy], B = [x, cy + Y], R = [x + X, cy], T = [x, cy - Y];
    const L2 = [x - X2, cy2], B2 = [x, cy2 + Y2], R2 = [x + X2, cy2], T2 = [x, cy2 - Y2];
    let s = poly([L, T, T2, L2], c[2]) + poly([T, R, R2, T2], c[1]) + poly([L, B, B2, L2], c[0], OL) + poly([B, R, R2, B2], c[1], OL);
    s += poly([L2, T2, R2, B2], shade(c[2], 0.2), OL);
    s += `<path d="M${f1(L[0])} ${f1(L[1])}L${f1(B[0])} ${f1(B[1])}L${f1(R[0])} ${f1(R[1])}" fill="none" stroke="${trim}" stroke-width="2.2"/><path d="M${f1(L2[0])} ${f1(L2[1])}L${f1(B2[0])} ${f1(B2[1])}L${f1(R2[0])} ${f1(R2[1])}" fill="none" stroke="${trim}" stroke-width="1.4"/>`;
    // 老虎窗
    for (let i = 1; i <= dorm; i++) {
      const k = i / (dorm + 1);
      for (const side of [0, 1]) {
        const a = side ? [B[0] + (R[0] - B[0]) * k, B[1] + (R[1] - B[1]) * k] : [L[0] + (B[0] - L[0]) * k, L[1] + (B[1] - L[1]) * k];
        const b2 = side ? [B2[0] + (R2[0] - B2[0]) * k, B2[1] + (R2[1] - B2[1]) * k] : [L2[0] + (B2[0] - L2[0]) * k, L2[1] + (B2[1] - L2[1]) * k];
        const mx = (a[0] + b2[0]) / 2, my = (a[1] + b2[1]) / 2 + 2;
        s += `<g transform="matrix(1,${side ? -.5 : .5},0,1,${f1(mx - 4)},${f1(my - 7 + (side ? 2 : -2))})"><path d="M0 9V3.5a4 4 0 0 1 8 0V9Z" fill="${side ? '#f7ede8' : '#fffaf6'}" stroke="${trim}" stroke-width=".8"/><path d="M1.6 9V4a2.4 2.4 0 0 1 4.8 0V9Z" fill="url(#kdGlass)"/></g>`;
      }
    }
    return s;
  }
  function cyl(x, yb, r, h, fill, top) { // 圓柱（底部中心 x,yb）
    return `<path d="M${f1(x - r)} ${f1(yb - h)}V${f1(yb)}A${f1(r)} ${f1(r / 2)} 0 0 0 ${f1(x + r)} ${f1(yb)}V${f1(yb - h)}Z" fill="${fill}" ${OL}/>` + (top ? `<ellipse cx="${f1(x)}" cy="${f1(yb - h)}" rx="${f1(r)}" ry="${f1(r / 2)}" fill="${top}" ${OL}/>` : '');
  }
  function domeShape(x, yb, r, hh, fill, finial = true, gold = false) {
    let s = `<path d="M${f1(x - r)} ${f1(yb)}C${f1(x - r)} ${f1(yb - hh * .9)} ${f1(x - r * .35)} ${f1(yb - hh)} ${f1(x)} ${f1(yb - hh)}C${f1(x + r * .35)} ${f1(yb - hh)} ${f1(x + r)} ${f1(yb - hh * .9)} ${f1(x + r)} ${f1(yb)}A${f1(r)} ${f1(r / 2)} 0 0 1 ${f1(x - r)} ${f1(yb)}Z" fill="${fill}" ${OL}/>`;
    for (const k of [-.55, 0, .55]) s += `<path d="M${f1(x + k * r)} ${f1(yb + (1 - Math.abs(k)) * r * .35)}Q${f1(x + k * r * .6)} ${f1(yb - hh * .7)} ${f1(x)} ${f1(yb - hh)}" stroke="#fff" stroke-opacity=".45" stroke-width=".9" fill="none"/>`;
    s += `<ellipse cx="${f1(x - r * .35)}" cy="${f1(yb - hh * .62)}" rx="${f1(r * .18)}" ry="${f1(hh * .2)}" fill="#fff" opacity=".45"/>`;
    if (finial) s += `<path d="M${f1(x)} ${f1(yb - hh - 2)}V${f1(yb - hh - 12)}" stroke="url(#kdGold)" stroke-width="1.6"/><circle cx="${f1(x)}" cy="${f1(yb - hh - 13)}" r="${gold ? 3 : 2.2}" fill="url(#kdGold)"/>`;
    return s;
  }
  const flag = (x, y, h, c, delay = 0) => `<path d="M${f1(x)} ${f1(y)}V${f1(y - h)}" stroke="#8a6a3e" stroke-width="1.2"/><circle cx="${f1(x)}" cy="${f1(y - h - 1)}" r="1.6" fill="url(#kdGold)"/><path class="kd-flag" style="animation-delay:${delay}s" d="M${f1(x)} ${f1(y - h + 1)}l15 3.5-15 4z" fill="${c}"/><path class="kd-flag" style="animation-delay:${delay}s" d="M${f1(x)} ${f1(y - h + 1)}l15 3.5" stroke="#fff" stroke-opacity=".5" stroke-width=".8" fill="none"/>`;
  const sparkles = (x, y, w, h, n = 4) => { let s = ''; for (let i = 0; i < n; i++) { const px = x + ((i * 37) % 100) / 100 * w, py = y + ((i * 53) % 100) / 100 * h; s += `<path class="kd-tw" style="animation-delay:${(i * .45).toFixed(2)}s" d="${star4(px, py, 3.2 + (i % 3))}" fill="#fff8d0"/>`; } return s; };
  const lampPost = (x, y, h = 22, on = true) => `<path d="M${f1(x)} ${f1(y)}V${f1(y - h)}" stroke="#4a3a52" stroke-width="1.6"/><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="3" ry="1.4" fill="#4a3a52"/><path d="M${f1(x - 3)} ${f1(y - h)}h6l-1 -5h-4z" fill="#fff4c8" stroke="#4a3a52" stroke-width=".8"/><path d="M${f1(x - 3.2)} ${f1(y - h - 5)}h6.4l-3.2 -3z" fill="#4a3a52"/>${on ? `<circle class="kd-lamp" cx="${f1(x)}" cy="${f1(y - h - 2.5)}" r="7" fill="url(#kdGlow)"/>` : ''}`;
  const shadow = (x, y, rx) => `<ellipse cx="${f1(x + rx * .18)}" cy="${f1(y + rx * .12)}" rx="${f1(rx * 1.15)}" ry="${f1(rx * .58)}" fill="url(#kdShade)"/>`;

  // ----- 鷹架（升級中） -----
  function scaffold(x, y, rx, h, crane) {
    const pole = (w, hh) => { let s = ''; const n = Math.max(3, Math.round(w / 16)); for (let i = 0; i <= n; i++) { const px = f1(i * w / n); s += `<path d="M${px} -6V${f1(hh)}" stroke="#b9875a" stroke-width="1.6"/>`; } for (let yy = 6; yy < hh; yy += 16) s += `<path d="M-2 ${yy}H${f1(w + 2)}" stroke="#d6a873" stroke-width="2.2"/><path d="M-2 ${yy + 1.4}H${f1(w + 2)}" stroke="#9c6c42" stroke-width=".6"/>`; for (let yy = 6; yy + 16 < hh; yy += 32) for (let i = 0; i < n; i++) s += `<path d="M${f1(i * w / n)} ${yy}L${f1((i + 1) * w / n)} ${yy + 16}" stroke="#b9875a" stroke-width=".9"/>`; return s + `<rect x="0" y="${f1(hh * .3)}" width="${f1(w)}" height="${f1(hh * .5)}" fill="#ff9cbf" opacity=".16"/>`; };
    const R = rx + 5;
    let s = onL(x, y + 3, R, h + 4, pole(R, h + 4)) + onR(x, y + 3, R, h + 4, pole(R, h + 4));
    if (crane) {
      const cx = x + rx * .35, cy = y - h - 6;
      s += `<g class="kd-crane"><path d="M${f1(cx)} ${f1(cy)}V${f1(cy - 58)}" stroke="#f2b632" stroke-width="3"/><path d="M${f1(cx)} ${f1(cy)}V${f1(cy - 58)}" stroke="#7a5a1e" stroke-width="3" stroke-dasharray="1 4"/><path d="M${f1(cx - 18)} ${f1(cy - 56)}H${f1(cx + 44)}" stroke="#f2b632" stroke-width="3"/><rect x="${f1(cx - 24)}" y="${f1(cy - 60)}" width="9" height="8" fill="#6b6f80"/><g class="kd-hook"><path d="M${f1(cx + 34)} ${f1(cy - 55)}V${f1(cy - 28)}" stroke="#555" stroke-width=".8"/><rect x="${f1(cx + 29)}" y="${f1(cy - 28)}" width="10" height="7" fill="#ff8fb5" stroke="#b2385f" stroke-width=".6"/></g></g>`;
    }
    return s;
  }

  // ----- 地塊 -----
  function plotSVG(id, lv, st) {
    const [u, v, pr] = BLD[id].pos, x = tsx(u), y = tsy(v), X = pr * 32, Y = pr * 16, t = tierOf(lv);
    const pave = id === 'town' || id === 'hall' || id === 'bank' ? 'url(#kdTilesP)' : 'url(#kdPave)';
    let s = poly([[x - X, y], [x, y - Y], [x + X, y], [x, y + Y]], lv > 0 ? pave : '#e9f2d8', `stroke="${t >= 2 ? '#d9b062' : '#e2cdb5'}" stroke-width="${t >= 2 ? 2 : 1.2}"`);
    if (lv > 0) s += poly([[x - X + 7, y], [x, y - Y + 3.5], [x + X - 7, y], [x, y + Y - 3.5]], 'none', `stroke="#fff" stroke-opacity=".7" stroke-width="1"`);
    // 邊緣的石墩（立體感）
    s += `<path d="M${f1(x - X)} ${f1(y)}L${f1(x)} ${f1(y + Y)}L${f1(x + X)} ${f1(y)}" fill="none" stroke="${lv > 0 ? '#e0c5a8' : '#cfe0b8'}" stroke-width="3" transform="translate(0 1.6)"/>`;
    return s;
  }
  function emptyLot(id, st) {
    const [u, v, pr] = BLD[id].pos, x = tsx(u), y = tsy(v), X = pr * 32 * .78, Y = X / 2;
    const ok = lvl(st, 'town') >= BLD[id].unlock;
    let s = '';
    // 白色小柵欄
    const fence = (a, b) => { let r = `<path d="M${f1(a[0])} ${f1(a[1] - 6)}L${f1(b[0])} ${f1(b[1] - 6)}" stroke="#fff" stroke-width="1.6"/>`; const n = 7; for (let i = 0; i <= n; i++) { const px = a[0] + (b[0] - a[0]) * i / n, py = a[1] + (b[1] - a[1]) * i / n; r += `<path d="M${f1(px)} ${f1(py)}V${f1(py - 9)}" stroke="#fff" stroke-width="1.8"/><path d="M${f1(px)} ${f1(py)}V${f1(py - 9)}" stroke="#d9c3b5" stroke-width=".4"/>`; } return r; };
    const L = [x - X, y], B = [x, y + Y], R = [x + X, y], T = [x, y - Y];
    s += fence(L, T) + fence(T, R);
    s += poly([L, T, R, B], ok ? '#f3e5d1' : '#dcebc8', `stroke="${ok ? '#e2cdb5' : '#c6dbb0'}" stroke-dasharray="3 3"`);
    if (ok) { // 建材堆＋施工告示牌
      s += isoFaces(x - X * .35, y + 2, 10, 7, 'spice', '', '', true);
      s += `<path d="M${f1(x + X * .25)} ${f1(y + 4)}l8 -4 10 5 -8 4z" fill="#d6a873" stroke="#9c6c42" stroke-width=".6"/><path d="M${f1(x + X * .25)} ${f1(y + 1)}l8 -4 10 5 -8 4z" fill="#e6b989" stroke="#9c6c42" stroke-width=".6"/>`;
      s += `<path d="M${f1(x + 6)} ${f1(y - 4)}V${f1(y - 26)}" stroke="#9c6c42" stroke-width="1.6"/><rect x="${f1(x - 9)}" y="${f1(y - 40)}" width="30" height="17" rx="3" fill="#fff" stroke="url(#kdGold)" stroke-width="1.4"/><path d="M${f1(x - 3)} ${f1(y - 27)}l5 -7 2 2 5 -5" stroke="#d6457a" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="${f1(x + 13)}" cy="${f1(y - 33)}" r="2" fill="#ffd166"/>`;
    } else {
      s += `<g opacity=".85"><rect x="${f1(x - 9)}" y="${f1(y - 20)}" width="18" height="15" rx="3" fill="#b8a6b6"/><path d="M${f1(x - 5.5)} ${f1(y - 20)}v-4a5.5 5.5 0 0 1 11 0v4" stroke="#b8a6b6" stroke-width="2.6" fill="none"/><circle cx="${f1(x)}" cy="${f1(y - 13)}" r="2" fill="#fff"/></g>`;
      for (const [dx, dy] of [[-22, 4], [20, 2], [-6, 12], [10, -8]]) s += `<circle cx="${f1(x + dx)}" cy="${f1(y + dy)}" r="2" fill="${dx > 0 ? '#ffb3c9' : '#fff'}"/>`;
    }
    return s;
  }

  // ----- 各建築 -----
  function bArt(id, lv, x, y, upg) {
    const t = Math.max(0, tierOf(lv)), p = PAL[id], pr = BLD[id].pos[2];
    const gold = t >= 5, roofC = gold ? GOLDR : p.roof, trim = t >= 2 ? '#e9c879' : '#fff';
    let s = '', top = 0, rx = pr * 32 * .74;
    switch (id) {
      case 'town': {
        rx = 98;
        const fl = 2 + Math.floor((t + 1) / 2), fh = 23, h = 12 + fl * fh + 8; top = h;
        const facade = (w, side) => {
          let f = `<rect x="0" y="${h - 12}" width="${w}" height="12" fill="#f1ddd3"/><path d="M0 ${h - 12}H${w}" stroke="url(#kdGold)" stroke-width="1.6"/><rect x="0" y="0" width="${w}" height="8" fill="${t >= 3 ? 'url(#kdGold)' : '#fff'}"/><path d="M0 8H${w}" stroke="#d9b062" stroke-width="1"/>`;
          const n = 4, gap = w / n;
          for (let i = 0; i < n; i++) {
            const wx = i * gap + gap * .22, ww = gap * .56;
            for (let k = 1; k < fl; k++) { const wy = h - 12 - (k + 1) * fh + 5; f += winA(wx, wy, ww, fh - 9); if (t >= 2 && k === 1) f += rail(wx - 2, wy + fh - 10, ww + 4); if (t >= 1 && k > 1) f += fbox(wx - 1, wy + fh - 6.5, ww + 2); }
            const gy = h - 12 - fh + 3;
            f += winR(wx - 2, gy + 5, ww + 4, fh - 8, 'url(#kdGlass)', '#f6dfa0') + awn(wx - 3, gy, ww + 6, 6, side ? '#e0628a' : '#d6457a');
            if (i < n - 1) f += pil(i * gap + gap - 2, 9, 3.4, h - 22, t >= 3 ? '#f6e6c4' : '#fff');
          }
          if (!side) f += plaque(w * .18, h - 12 - fl * fh + 2, w * .64, 10, 'ERIKA', 8);
          else f += plaque(w * .2, h - 12 - fl * fh + 2, w * .6, 10, 'GRANDS MAGASINS', 5.4);
          return f;
        };
        s += shadow(x, y, rx);
        s += isoFaces(x, y, rx, h, 'town', facade(rx, 0), facade(rx, 1), false);
        s += roofMansard(x, y, rx, h, 24 + t * 2, .72, 4, roofC, trim, 2 + (t >= 3 ? 1 : 0));
        if (t >= 3) for (const d of [-1, 1]) { // 兩側角樓
          const tx = x + d * rx, th = h + 20, tr = 13;
          s += cyl(tx, y + 2, tr, th, 'url(#kdCyl)') + `<path d="M${f1(tx - tr)} ${f1(y + 2 - th + 6)}A${tr} ${tr / 2} 0 0 0 ${f1(tx + tr)} ${f1(y + 2 - th + 6)}" stroke="url(#kdGold)" stroke-width="1.6" fill="none"/>`;
          for (let k = 0; k < fl; k++) s += winA(tx - 3.5, y - 10 - (k + 1) * fh + 6, 7, fh - 10);
          s += `<path d="M${f1(tx - tr - 2)} ${f1(y + 2 - th)}Q${f1(tx)} ${f1(y + 2 - th - 4 - 30 - t * 2)} ${f1(tx + tr + 2)} ${f1(y + 2 - th)}A${tr + 2} ${(tr + 2) / 2} 0 0 1 ${f1(tx - tr - 2)} ${f1(y + 2 - th)}Z" fill="${t >= 4 ? 'url(#kdDomeG)' : 'url(#kdDomeP)'}" ${OL}/>` + flag(tx, y + 2 - th - 30 - t * 2, 16, d < 0 ? '#d6457a' : '#c9a35b', d < 0 ? 0 : .6);
        }
        // 轉角圓塔＋圓頂（入口）
        const ry = rx / 2, cx = x, cyb = y + ry, rr = 30, ch = h + 12;
        s += cyl(cx, cyb, rr, ch, 'url(#kdCyl)');
        s += `<path d="M${f1(cx - rr)} ${f1(cyb - 12)}A${rr} ${rr / 2} 0 0 0 ${f1(cx + rr)} ${f1(cyb - 12)}" stroke="url(#kdGold)" stroke-width="1.6" fill="none"/>`;
        for (let k = 0; k < fl; k++) {
          const wy = cyb - 12 - (k + 1) * fh + 5;
          for (const a of [-0.62, 0.62]) { const ww = 9 * Math.cos(a), wx = cx + Math.sin(a) * rr * .92 - ww / 2; if (k > 0) s += winA(wx, wy + Math.abs(a) * 3, ww, fh - 9); }
        }
        s += doorA(cx - 9, cyb - 12 - fh + 1, 18, fh + 2) + awn(cx - 12, cyb - 12 - fh - 4, 24, 5, '#d6457a');
        s += `<path d="M${f1(cx - rr)} ${f1(cyb - ch + 6)}A${rr} ${rr / 2} 0 0 0 ${f1(cx + rr)} ${f1(cyb - ch + 6)}" stroke="url(#kdGold)" stroke-width="3" fill="none"/>`;
        if (t >= 2) s += cyl(cx, cyb - ch, rr * .86, 10, 'url(#kdCyl)', '#f5e3da');
        const dh = t >= 2 ? 10 : 0;
        s += domeShape(cx, cyb - ch - dh, rr * (t >= 2 ? .86 : 1), 26 + t * 3, t >= 4 ? 'url(#kdDomeG)' : 'url(#kdDomeP)', true, t >= 4);
        top = Math.max(top, ch + dh + 26 + t * 3 + 14 - ry);
        if (t >= 5) s += `<path d="M${f1(cx - 9)} ${f1(cyb - ch - dh - 29 - t * 3)}l3 -9 3 6 3 -9 3 9 3 -6 3 9z" fill="url(#kdGold)" stroke="#a97b30" stroke-width=".6"/>` + sparkles(x - rx, y - h - 40, rx * 2, 60, 6);
        // 紅毯與金柱
        s += poly([[cx - 10, cyb + 3], [cx + 10, cyb + 3], [cx + 16, cyb + 30], [cx - 16, cyb + 30]], '#d03b67') + `<path d="M${f1(cx - 10)} ${f1(cyb + 3)}L${f1(cx - 16)} ${f1(cyb + 30)}M${f1(cx + 10)} ${f1(cyb + 3)}L${f1(cx + 16)} ${f1(cyb + 30)}" stroke="url(#kdGold)" stroke-width="1.4"/>`;
        if (t >= 1) for (const d of [-1, 1]) s += `<path d="M${f1(cx + d * 20)} ${f1(cyb + 26)}V${f1(cyb + 14)}" stroke="url(#kdGold)" stroke-width="2"/><circle cx="${f1(cx + d * 20)}" cy="${f1(cyb + 13)}" r="2.2" fill="url(#kdGold)"/><path d="M${f1(cx + d * 20)} ${f1(cyb + 15)}Q${f1(cx + d * 24)} ${f1(cyb + 8)} ${f1(cx + d * 22)} ${f1(cyb + 4)}" stroke="#a3214a" stroke-width="1.4" fill="none"/>`;
        break;
      }
      case 'hall': {
        rx = 70; const h = 46 + t * 7; top = h + 26;
        s += shadow(x, y, rx) + isoFaces(x, y + 6, rx + 8, 6, 'hall', '', '', true) + isoFaces(x, y + 2, rx + 4, 4, 'hall', '', '', true);
        const fac = (w, side) => { let f = `<rect x="0" y="0" width="${w}" height="${h}" fill="${side ? '#e2cfc9' : '#efe2dc'}"/>`; const n = 5; for (let i = 0; i < n; i++) { const cx2 = (i + .5) * w / n; if (t >= 1 && i < n - 1) f += `<path d="M${f1(cx2 + w / n * .25)} 8h${f1(w / n * .5)}v${f1(h * .45)}l${f1(-w / n * .25)} -4 ${f1(-w / n * .25)} 4z" fill="${['#f08bb0', '#8cc46a', '#3fb6e0', '#e8613c', '#5a6fd6'][i]}" opacity=".9"/>`; f += col(cx2 - 4, 4, 8, h - 4); } return f + `<rect x="0" y="0" width="${w}" height="5" fill="${t >= 3 ? 'url(#kdGold)' : '#fff'}"/>` + (side ? '' : doorA(w * .5 - 7, h - 24, 14, 24)); };
        s += isoFaces(x, y, rx, h, 'hall', fac(rx, 0), fac(rx, 1), false);
        s += roofHip(x, y, rx, h, 24 + t * 2, 6, roofC, trim);
        if (t >= 2) s += `<g transform="translate(${f1(x)} ${f1(y - h - 24 - t * 2)})"><path d="M0 0V-4" stroke="url(#kdGold)" stroke-width="2"/><circle cx="0" cy="-10" r="3.2" fill="url(#kdGold)"/><path d="M-5 -2L0 -8 5 -2Z" fill="url(#kdGold)"/><path d="M-4 -14l4 -5 4 5" stroke="url(#kdGold)" stroke-width="1.2" fill="none"/></g>`;
        if (t >= 3) s += flag(x - rx - 4, y - h + 2, 24, '#f08bb0', .2) + flag(x + rx + 4, y - h + 2, 24, '#7d4bc4', .7);
        if (t >= 5) s += sparkles(x - rx, y - h - 50, rx * 2, 60, 5);
        break;
      }
      case 'acad': {
        rx = 70; const h = 50 + t * 6; top = h + 70 + t * 8;
        const fac = (w, side) => { let f = `<rect x="0" y="${h - 9}" width="${w}" height="9" fill="#d9cdea"/><rect x="0" y="0" width="${w}" height="6" fill="${t >= 3 ? 'url(#kdGold)' : '#fff'}"/>`; const n = 4; for (let i = 0; i < n; i++) { const wx = i * w / n + w / n * .25, ww = w / n * .5; f += winR(wx, 12, ww, 14, 'url(#kdGlass)') + (t >= 1 ? fbox(wx - 1, 27, ww + 2) : ''); if (!(side === 0 && (i === 1 || i === 2))) f += winR(wx, h - 30, ww, 16); } if (!side) f += doorA(w / 2 - 8, h - 30, 16, 21) + plaque(w * .2, 30 - 2, w * .6, 9, 'ACADÉMIE', 6.4, '#5b48ad', '#fff1c9'); return f; };
        s += shadow(x, y, rx) + isoFaces(x, y, rx, h, 'acad', fac(rx, 0), fac(rx, 1), false);
        s += roofHip(x, y, rx, h, 30, 5, roofC, trim);
        // 鐘樓
        const tx = x, ty = y - h - 6, th = 34 + t * 8, tr = 15;
        s += isoFaces(tx, ty, tr, th, 'acad', `<circle cx="${tr / 2}" cy="${th * .32}" r="5.4" fill="#fffaf2" stroke="url(#kdGold)" stroke-width="1.4"/><path d="M${tr / 2} ${th * .32}v-3.4M${tr / 2} ${th * .32}h2.6" stroke="#5a2740" stroke-width=".9"/>${winA(tr / 2 - 3, th * .55, 6, 10)}`, winA(tr / 2 - 3, th * .3, 6, 12), false);
        s += roofHip(tx, ty, tr, th, 26 + t * 3, 3, t >= 4 ? GOLDR : roofC, trim) + `<circle cx="${f1(tx)}" cy="${f1(ty - th - 28 - t * 3)}" r="2.2" fill="url(#kdGold)"/>`;
        if (t >= 2) s += flag(tx, ty - th - 26 - t * 3, 14, '#d6457a', .3);
        if (t >= 5) s += sparkles(x - rx, y - h - 80, rx * 2, 80, 5);
        break;
      }
      case 'bank': {
        rx = 60; const h = 46 + t * 6; top = h + 30 + t * 4;
        s += shadow(x, y, rx) + isoFaces(x, y + 4, rx + 6, 4, 'bank', '', '', true);
        const fac = (w, side) => { let f = `<rect x="0" y="0" width="${w}" height="${h}" fill="${side ? '#e8dfd0' : '#f6f0e6'}"/><rect x="0" y="0" width="${w}" height="9" fill="${t >= 2 ? 'url(#kdGold)' : '#fffdf8'}"/>`; const n = 4; for (let i = 0; i < n; i++) f += col(i * w / n + w / n / 2 - 3.5, 9, 7, h - 9); if (!side) f += plaque(w * .1, 10, w * .8, 9, 'BANQUE ERIKA', 6) + doorA(w / 2 - 6, h - 20, 12, 20); else f += `<circle cx="${w / 2}" cy="${h * .5}" r="8" fill="url(#kdGold)" stroke="#a97b30" stroke-width=".8"/><text x="${w / 2}" y="${h * .5 + 3.6}" text-anchor="middle" font-family="Bodoni Moda, Georgia, serif" font-style="italic" font-weight="700" font-size="10" fill="#7a5a1e">E</text>`; return f; };
        s += isoFaces(x, y, rx, h, 'bank', fac(rx, 0), fac(rx, 1), true);
        if (t >= 1) s += cyl(x, y - h + 2, 22, 8, 'url(#kdCyl)', '#f6efe4');
        s += domeShape(x, y - h - (t >= 1 ? 6 : -2), 22, 20 + t * 2, t >= 3 ? 'url(#kdDomeG)' : 'url(#kdDomeP)', true, t >= 3);
        if (t >= 4) s += flag(x - rx + 2, y - h - 1, 20, '#c9a35b', .4);
        if (t >= 5) s += sparkles(x - rx, y - h - 60, rx * 2, 60, 5);
        break;
      }
      case 'spa': {
        rx = 62; const h = 38 + t * 7; top = h + 26;
        // 泳池
        s += `<ellipse cx="${f1(x + rx * .9)}" cy="${f1(y + rx * .38)}" rx="28" ry="13" fill="#fff" stroke="#e6d2c0"/><ellipse cx="${f1(x + rx * .9)}" cy="${f1(y + rx * .38)}" rx="24" ry="10.5" fill="url(#kdPool)"/><path d="M${f1(x + rx * .9 - 14)} ${f1(y + rx * .38)}q4 -2 8 0t8 0" stroke="#fff" stroke-width=".9" fill="none" opacity=".8"/>`;
        s += `<circle cx="${f1(x + rx * .9 + 10)}" cy="${f1(y + rx * .38 + 3)}" r="3" fill="#ffb3c9"/><circle cx="${f1(x + rx * .9 - 12)}" cy="${f1(y + rx * .38 - 2)}" r="2.4" fill="#9fdcc7"/>`;
        const fac = (w, side) => { let f = `<rect x="0" y="0" width="${w}" height="6" fill="${t >= 3 ? 'url(#kdGold)' : '#fff'}"/>`; for (let i = 0; i < 3; i++) { f += winO(w * (i + .5) / 3, h * .38, 6.5); if (t >= 2) f += winO(w * (i + .5) / 3, h * .38 - 18, 4.6); } if (!side) f += doorA(w * .5 - 7, h - 22, 14, 22, '#fff') + awn(w * .5 - 11, h - 27, 22, 5, '#3f9a80'); else f += plaque(w * .18, h - 18, w * .64, 9, 'SPA', 7, '#3f9a80', '#fff'); return f; };
        s += shadow(x, y, rx) + isoFaces(x, y, rx, h, 'spa', fac(rx, 0), fac(rx, 1), false) + roofHip(x, y, rx, h, 22 + t * 2, 6, roofC, trim);
        for (let i = 0; i < 3; i++) s += `<path class="kd-steam" style="animation-delay:${i * .8}s" d="M${f1(x + rx * .82 + i * 8)} ${f1(y + rx * .3)}q-4 -8 0 -14t0 -14" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`;
        if (t >= 3) s += flag(x, y - h - 22 - t * 2, 14, '#72c7ac', .5);
        if (t >= 5) s += sparkles(x - rx, y - h - 40, rx * 2, 50, 4);
        break;
      }
      case 'guild': {
        rx = 62; const h = 40 + t * 7; top = h + 30;
        const fac = (w, side) => { let f = `<rect x="0" y="0" width="${w}" height="6" fill="${t >= 3 ? 'url(#kdGold)' : '#fff'}"/>`; for (let i = 0; i < 3; i++) { f += winA(w * (i + .5) / 3 - 6, 11, 12, 15); if (t >= 1) f += fbox(w * (i + .5) / 3 - 7, 27, 14); f += winR(w * (i + .5) / 3 - 8, h - 19, 16, 17); } f += awn(1, h - 26, w - 2, 7, '#f4a08c', '#fff'); if (!side) f += `<path d="M${w / 2} ${h - 32}c-4 -5 -10 -1 -6 3l6 5 6 -5c4 -4 -2 -8 -6 -3z" fill="#e0628a"/>`; else f += plaque(w * .15, 30, w * .7, 8, 'CLUB DES AMIES', 4.8, '#cf6c5a', '#fff'); if (t >= 2) for (let i = 4; i < w; i += 6) f += `<circle class="kd-tw" style="animation-delay:${(i % 5) * .3}s" cx="${i}" cy="${f1(h - 30 + Math.sin(i / 6) * 1.5)}" r="1.2" fill="#fff3b0"/>`; return f; };
        s += shadow(x, y, rx) + isoFaces(x, y, rx, h, 'guild', fac(rx, 0), fac(rx, 1), false) + roofMansard(x, y, rx, h, 18 + t * 2, .7, 4, roofC, trim, 1);
        // 戶外咖啡座
        for (const [dx, dy, c] of [[-rx * .55, rx * .52, '#f4a08c'], [-rx * .15, rx * .72, '#fff']]) s += `<ellipse cx="${f1(x + dx)}" cy="${f1(y + dy)}" rx="6" ry="3" fill="#fff" stroke="#d9c3b5" stroke-width=".6"/><path d="M${f1(x + dx)} ${f1(y + dy)}V${f1(y + dy - 17)}" stroke="#8a6a3e" stroke-width="1"/><path d="M${f1(x + dx - 11)} ${f1(y + dy - 14)}Q${f1(x + dx)} ${f1(y + dy - 25)} ${f1(x + dx + 11)} ${f1(y + dy - 14)}Z" fill="${c}" stroke="#cf6c5a" stroke-width=".7"/>`;
        if (t >= 3) s += flag(x - rx - 2, y - h, 20, '#f4a08c', .2);
        if (t >= 5) s += sparkles(x - rx, y - h - 40, rx * 2, 50, 4);
        break;
      }
      case 'guard': {
        rx = 57; const h = 40 + t * 6; top = h + 16;
        const fac = (w, side) => { let f = ''; for (let yy = 8; yy < h; yy += 6) f += `<path d="M0 ${yy}H${w}" stroke="#fff" stroke-opacity=".08"/>`; f += `<rect x="0" y="0" width="${w}" height="6" fill="${t >= 3 ? 'url(#kdGold)' : '#2c335a'}"/>`; for (let i = 0; i < 3; i++) f += winR(w * (i + .5) / 3 - 6, 12, 12, 12, 'url(#kdGlassC)', '#c9d2f2'); if (!side) f += `<rect x="${w * .2}" y="${h - 22}" width="${w * .6}" height="22" fill="#2f365e"/><path d="M${w * .2} ${h - 18}H${w * .8}M${w * .2} ${h - 12}H${w * .8}M${w * .2} ${h - 6}H${w * .8}" stroke="#4f5996" stroke-width="1.2"/>`; else f += `<path d="M${w / 2 - 9} ${h - 26}h18v8c0 7-9 11-9 11s-9-4-9-11z" fill="url(#kdGold)" stroke="#a97b30" stroke-width=".7"/><path d="M${w / 2 - 4} ${h - 19}l4 3 5 -6" stroke="#2c335a" stroke-width="1.4" fill="none"/>`; return f; };
        s += shadow(x, y, rx) + isoFaces(x, y, rx, h, 'guard', fac(rx, 0), fac(rx, 1), true);
        s += isoFaces(x, y - h, rx, 5, 'guard', '', '', true);
        // 訓練假人與三角錐
        for (const [dx, dy] of [[rx * .55, rx * .6], [rx * .95, rx * .35]]) s += cyl(x + dx, y + dy, 4, 16, '#d6a873', '#e6b989') + `<circle cx="${f1(x + dx)}" cy="${f1(y + dy - 20)}" r="4" fill="#e6b989" stroke="#9c6c42" stroke-width=".6"/><path d="M${f1(x + dx - 8)} ${f1(y + dy - 12)}H${f1(x + dx + 8)}" stroke="#9c6c42" stroke-width="2"/>`;
        s += `<path d="M${f1(x - rx * .3)} ${f1(y + rx * .7)}l4 -11 4 11z" fill="#ff9a3c"/><path d="M${f1(x - rx * .3 + 1.6)} ${f1(y + rx * .7 - 5)}h4.8" stroke="#fff" stroke-width="1.4"/>`;
        if (t >= 2) s += flag(x + rx * .5, y - h - 5, 26, '#4f63b8', .1);
        if (t >= 5) s += sparkles(x - rx, y - h - 40, rx * 2, 50, 4);
        break;
      }
      case 'car': {
        rx = 57; const h = 36 + t * 6; top = h + 18;
        const fac = (w, side) => { let f = `<rect x="0" y="0" width="${w}" height="6" fill="${t >= 3 ? 'url(#kdGold)' : '#e9729a'}"/>`; if (!side) { f += `<rect x="3" y="10" width="${w - 6}" height="${h - 12}" fill="url(#kdGlassC)" stroke="#fff" stroke-width="1.5"/><path d="M${w / 3} 10V${h - 2}M${w * 2 / 3} 10V${h - 2}" stroke="#fff" stroke-width="1.2"/>`; f += `<path d="M8 ${h - 6}q2 -9 12 -9h10q8 0 12 9z" fill="#ff8fb5" opacity=".8"/><circle cx="13" cy="${h - 5}" r="3" fill="#3b1530" opacity=".7"/><circle cx="35" cy="${h - 5}" r="3" fill="#3b1530" opacity=".7"/>`; } else { f += `<rect x="4" y="${h - 26}" width="${w - 8}" height="26" fill="#ced2e2"/>`; for (let yy = h - 23; yy < h; yy += 4) f += `<path d="M4 ${yy}H${w - 4}" stroke="#aeb3c9" stroke-width="1"/>`; f += plaque(w * .15, 10, w * .7, 10, 'GARAGE', 7, '#3b1530', '#ff9cc2'); } return f; };
        s += shadow(x, y, rx) + isoFaces(x, y, rx, h, 'car', fac(rx, 0), fac(rx, 1), true);
        s += `<path d="M${f1(x - rx + 6)} ${f1(y - h - 1)}L${f1(x)} ${f1(y - h + rx / 2 - 3)}L${f1(x + rx - 6)} ${f1(y - h - 1)}" stroke="#ff9cc2" stroke-width="2" fill="none" class="kd-neon"/>`;
        // 停在門口的粉紅跑車
        const car = (cx, cy, c) => `<g transform="translate(${f1(cx)} ${f1(cy)})"><ellipse cx="0" cy="3" rx="16" ry="5" fill="url(#kdShade)"/><path d="M-15 0l3 -6 9 -4h9l8 5 4 1 1 4z" fill="${c}" stroke="#8a2f55" stroke-width=".7"/><path d="M-6 -9l3 -5h8l5 5z" fill="url(#kdGlassC)" stroke="#fff" stroke-width=".6"/><circle cx="-8" cy="1" r="3" fill="#3b1530"/><circle cx="9" cy="1" r="3" fill="#3b1530"/><circle cx="-8" cy="1" r="1.2" fill="#ddd"/><circle cx="9" cy="1" r="1.2" fill="#ddd"/><path d="M-12 -5h6" stroke="#fff" stroke-opacity=".6"/></g>`;
        s += car(x - rx * .35, y + rx * .62, t >= 4 ? '#e9c46a' : '#ff8fb5');
        if (t >= 2) s += car(x + rx * .55, y + rx * .48, '#b9a2e8');
        if (t >= 5) s += sparkles(x - rx, y - h - 30, rx * 2, 40, 4);
        break;
      }
      case 'pap': {
        rx = 54; const h = 38 + t * 6; top = h + 34;
        const fac = (w, side) => { let f = `<rect x="0" y="0" width="${w}" height="6" fill="${t >= 3 ? 'url(#kdGold)' : '#46307a'}"/>`; for (let i = 0; i < 3; i++) { f += winR(w * (i + .5) / 3 - 6, 12, 12, 13); for (let k = 0; k < 3; k++) f += `<path d="M${f1(w * (i + .5) / 3 - 6)} ${15 + k * 3.5}h12" stroke="#fff" stroke-opacity=".7" stroke-width="1"/>`; } if (!side) f += doorA(w / 2 - 6, h - 20, 12, 20, '#fff'); else f += plaque(w * .1, h - 18, w * .8, 9, 'PAPARAZZI', 5.6, '#46307a', '#ffd6ec'); return f; };
        s += shadow(x, y, rx) + isoFaces(x, y, rx, h, 'pap', fac(rx, 0), fac(rx, 1), true);
        // 屋頂巨型相機
        const cx = x, cy = y - h - 4;
        s += isoFaces(cx, cy, 20, 16, 'guard', '', `<circle cx="10" cy="8" r="7" fill="#2c2340" stroke="url(#kdGold)" stroke-width="1.6"/><circle cx="10" cy="8" r="3.6" fill="#7aa6ff"/><circle cx="8.6" cy="6.6" r="1.2" fill="#fff"/>`, true);
        s += `<rect x="${f1(cx - 8)}" y="${f1(cy - 26)}" width="9" height="5" fill="#e9729a"/><path class="kd-flash" d="${star4(cx + 14, cy - 28, 9)}" fill="#fffbe0"/>`;
        // 打光燈
        s += `<path d="M${f1(x + rx * .7)} ${f1(y + rx * .55)}l-6 -16M${f1(x + rx * .7)} ${f1(y + rx * .55)}l6 -16M${f1(x + rx * .7)} ${f1(y + rx * .55)}V${f1(y + rx * .55 - 16)}" stroke="#4a3a52" stroke-width="1"/><path d="M${f1(x + rx * .7 - 7)} ${f1(y + rx * .55 - 24)}h14l-2 8h-10z" fill="#4a3a52"/><path d="M${f1(x + rx * .7 - 5)} ${f1(y + rx * .55 - 16)}l-12 22h34l-12 -22z" fill="#fff6c8" opacity=".25"/>`;
        if (t >= 5) s += sparkles(x - rx, y - h - 40, rx * 2, 50, 4);
        break;
      }
      case 'silk': case 'spice': case 'leaf': {
        rx = 54; const h = 34 + t * 6; top = h + 30;
        const c2 = id === 'silk' ? '#df5f8e' : id === 'spice' ? '#de7a34' : '#c4952c';
        const fac = (w, side) => { let f = `<rect x="0" y="0" width="${w}" height="5" fill="${t >= 3 ? 'url(#kdGold)' : '#fff'}"/><rect x="0" y="${h - 7}" width="${w}" height="7" fill="${shade(PAL[id].r, -.08)}"/>`; for (let i = 0; i < 2; i++) { f += winA(w * (i + .5) / 2 - 6, 10, 12, 14); if (t >= 1) f += fbox(w * (i + .5) / 2 - 7, 25, 14); } if (!side) { f += id === 'leaf' ? `<rect x="${w * .3}" y="${h - 21}" width="${w * .4}" height="14" fill="#ffcf6a"/><rect x="${w * .3}" y="${h - 21}" width="${w * .4}" height="14" fill="#ff9a3c" opacity=".5" class="kd-forge"/>` : `<rect x="${w * .32}" y="${h - 22}" width="${w * .36}" height="22" fill="#a77b58"/><path d="M${w * .5} ${h - 22}V${h}" stroke="#7a5038"/>`; } else f += plaque(w * .12, h - 19, w * .76, 9, id === 'silk' ? 'SOIERIE' : id === 'spice' ? 'ÉPICES' : 'DORURE', 6, c2, '#fff'); return f; };
        s += shadow(x, y, rx) + isoFaces(x, y, rx, h, id, fac(rx, 0), fac(rx, 1), false) + roofHip(x, y, rx, h, 24 + t * 2, 6, roofC, trim);
        if (id === 'leaf') { s += isoFaces(x + rx * .45, y - h + 6, 7, 24 + t * 2, 'spice', '', '', true); for (let i = 0; i < 3; i++) s += `<circle class="kd-smoke" style="animation-delay:${i * .9}s" cx="${f1(x + rx * .45)}" cy="${f1(y - h - 22 - t * 2)}" r="5" fill="#fff" opacity=".7"/>`; }
        // 門前的貨品
        if (id === 'silk') for (let i = 0; i < 3; i++) s += cyl(x - rx * .5 + i * 9, y + rx * .62 - i * 2, 4, 12, ['#ff8fb5', '#b9a2e8', '#9fe0c8'][i], ['#ffc4d8', '#d9ccf5', '#c8f0e2'][i]);
        if (id === 'spice') for (let i = 0; i < 3; i++) s += `<path d="M${f1(x - rx * .55 + i * 11)} ${f1(y + rx * .62)}q-5 -1 -4 -9 0 -5 4 -6 4 1 4 6 1 8 -4 9z" fill="${['#e8a35f', '#d9b37a', '#c96d3d'][i]}" stroke="#8a5a32" stroke-width=".6"/><ellipse cx="${f1(x - rx * .55 + i * 11)}" cy="${f1(y + rx * .62 - 14)}" rx="3" ry="1.4" fill="${['#ffd166', '#e04f5f', '#8cc46a'][i]}"/>`;
        if (id === 'leaf') for (let i = 0; i < 3; i++) s += isoFaces(x - rx * .4 + i * 3, y + rx * .6 - i * 5, 7, 4, 'leaf', '', '', true).replace(/url\(#kdL-leaf\)/g, 'url(#kdGold)');
        if (t >= 3) s += flag(x, y - h - 24 - t * 2, 14, c2, .4);
        if (t >= 5) s += sparkles(x - rx, y - h - 40, rx * 2, 50, 4);
        break;
      }
      case 'ore': {
        rx = 54; top = 54 + t * 8;
        const hh = 40 + t * 8;
        s += shadow(x, y, rx);
        s += poly([[x - rx, y + 4], [x - rx * .6, y - hh * .55], [x - rx * .1, y - hh], [x + rx * .3, y - hh * .8], [x + rx * .8, y - hh * .35], [x + rx, y + 2], [x, y + rx * .5]], '#c9bfdc', OL);
        s += poly([[x - rx * .1, y - hh], [x + rx * .3, y - hh * .8], [x + rx * .8, y - hh * .35], [x + rx, y + 2], [x, y + rx * .5], [x - rx * .05, y - hh * .2]], '#b0a4c9', OL);
        s += poly([[x - rx * .6, y - hh * .55], [x - rx * .1, y - hh], [x - rx * .05, y - hh * .2]], '#ddd5ec');
        // 礦坑入口
        s += `<path d="M${f1(x - rx * .45)} ${f1(y + rx * .2)}v-20a12 12 0 0 1 24 0v20z" fill="#3b2a4a"/><path d="M${f1(x - rx * .45 - 2)} ${f1(y + rx * .2)}v-21a14 14 0 0 1 28 0v21" stroke="${t >= 2 ? 'url(#kdGold)' : '#a77b58'}" stroke-width="3.4" fill="none"/>`;
        const cr = (cx, cy, k) => `<path d="M${f1(cx)} ${f1(cy)}l${f1(-4 * k)} ${f1(-9 * k)} ${f1(4 * k)} ${f1(-7 * k)} ${f1(4 * k)} ${f1(7 * k)} ${f1(-4 * k)} ${f1(9 * k)}z" fill="url(#kdCrystal)" stroke="#fff" stroke-width=".6"/>`;
        s += cr(x + rx * .35, y - hh * .45, 1.4) + cr(x + rx * .55, y - hh * .2, 1) + cr(x - rx * .2, y - hh * .72, 1.1);
        if (t >= 1) s += cr(x + rx * .1, y - hh * .9, 1.2) + cr(x - rx * .7, y - hh * .25, .9);
        if (t >= 3) s += cr(x + rx * .75, y - hh * .5, 1.3) + cr(x - rx * .05, y - hh * 1.05, 1.6);
        // 礦車
        s += `<path d="M${f1(x + rx * .1)} ${f1(y + rx * .62)}l26 -13" stroke="#8a6a3e" stroke-width="1.2"/><path d="M${f1(x + rx * .1)} ${f1(y + rx * .62)}l-3 -9h16l-1 9z" fill="#6b5a72" transform="translate(6 -4)"/><g transform="translate(${f1(x + rx * .1 + 8)} ${f1(y + rx * .62 - 13)})">${cr(0, 0, .6)}${cr(5, 1, .5)}</g>`;
        if (t >= 2) s += flag(x - rx * .1, y - hh, 18, '#7a5fe0', .3);
        s += sparkles(x - rx * .6, y - hh, rx * 1.4, hh * .8, 2 + t);
        break;
      }
      case 'wall': {
        // 大門：左右門柱＋拱門，柵欄沿著島的下緣
        const gx = x, gy = y, pw = 9, ph = 40 + t * 7;
        const fenceC = t >= 2 ? '#3d3348' : '#fff';
        const fenceLine = (a, b) => { let r = `<path d="M${f1(a[0])} ${f1(a[1] - 13)}L${f1(b[0])} ${f1(b[1] - 13)}M${f1(a[0])} ${f1(a[1] - 4)}L${f1(b[0])} ${f1(b[1] - 4)}" stroke="${fenceC}" stroke-width="1.6"/>`; const n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 7); for (let i = 0; i <= n; i++) { const px = a[0] + (b[0] - a[0]) * i / n, py = a[1] + (b[1] - a[1]) * i / n; r += `<path d="M${f1(px)} ${f1(py)}V${f1(py - 17)}" stroke="${fenceC}" stroke-width="1.5"/>` + (t >= 2 ? `<circle cx="${f1(px)}" cy="${f1(py - 18)}" r="1.2" fill="url(#kdGold)"/>` : ''); } if (t >= 3) { const k = 0.5; const px = a[0] + (b[0] - a[0]) * k, py = a[1] + (b[1] - a[1]) * k; r += lampPost(px, py + 1, 22); } return r; };
        s += fenceLine([gx - 46, gy + 6], [gx - 326, gy - 134]) + fenceLine([gx + 46, gy + 6], [gx + 326, gy - 134]);
        if (t >= 1) for (const d of [-1, 1]) for (let i = 1; i < 6; i++) s += `<circle cx="${f1(gx + d * (46 + i * 26))}" cy="${f1(gy + 9 - i * 13)}" r="5" fill="url(#kdLeafD)"/><circle cx="${f1(gx + d * (46 + i * 26) - 2)}" cy="${f1(gy + 6 - i * 13)}" r="1.2" fill="#ff9cbf"/>`;
        for (const d of [-1, 1]) s += isoFaces(gx + d * 40, gy, pw, ph, 'wall', '', '', true) + `<path d="M${f1(gx + d * 40 - pw - 1)} ${f1(gy - ph)}L${f1(gx + d * 40)} ${f1(gy - ph + pw / 2 + 1)}L${f1(gx + d * 40 + pw + 1)} ${f1(gy - ph)}" stroke="url(#kdGold)" stroke-width="2.4" fill="none"/>` + (t >= 3 ? lampPost(gx + d * 40, gy - ph, 10) : `<circle cx="${f1(gx + d * 40)}" cy="${f1(gy - ph - 4)}" r="3.6" fill="url(#kdGold)"/>`);
        s += `<path d="M${f1(gx - 34)} ${f1(gy - ph + 8)}Q${f1(gx)} ${f1(gy - ph - 16)} ${f1(gx + 34)} ${f1(gy - ph + 8)}" stroke="${t >= 4 ? 'url(#kdGold)' : '#3d3348'}" stroke-width="3.4" fill="none"/>`;
        s += `<path d="M${f1(gx - 30)} ${f1(gy - ph + 12)}Q${f1(gx)} ${f1(gy - ph - 8)} ${f1(gx + 30)} ${f1(gy - ph + 12)}" stroke="${t >= 4 ? 'url(#kdGold)' : '#3d3348'}" stroke-width="1.2" fill="none"/>`;
        s += `<g transform="translate(${f1(gx)} ${f1(gy - ph - 10)})"><path d="M-9 0h18v6c0 6-9 9-9 9s-9-3-9-9z" fill="${t >= 2 ? 'url(#kdGold)' : '#fff'}" stroke="#a97b30" stroke-width=".8"/><text x="0" y="8" text-anchor="middle" font-family="Bodoni Moda, Georgia, serif" font-style="italic" font-weight="700" font-size="9" fill="#7a1f45">E</text></g>`;
        // 打開的鐵門
        for (const d of [-1, 1]) { let gd = `<path d="M${f1(gx + d * 31)} ${f1(gy - 2)}L${f1(gx + d * 47)} ${f1(gy + 10)}" stroke="#3d3348" stroke-width="1.4"/>`; for (let i = 0; i <= 4; i++) gd += `<path d="M${f1(gx + d * (31 + i * 4))} ${f1(gy - 2 + i * 3)}v-${ph * .7}" stroke="${t >= 4 ? 'url(#kdGold)' : '#3d3348'}" stroke-width="1.3"/>`; s += gd; }
        // 警衛亭
        if (t >= 1) s += isoFaces(gx + 70, gy - 10, 10, 20 + t * 2, 'wall', '', winR(3, 5, 6, 7, 'url(#kdGlassC)'), true) + roofHip(gx + 70, gy - 10, 10, 20 + t * 2, 8, 3, roofC, trim);
        if (t >= 5) s += sparkles(gx - 50, gy - ph - 30, 100, 40, 5);
        top = ph + 24;
        rx = 46;
        break;
      }
    }
    if (upg) s += scaffold(x, y, rx, Math.max(30, Math.min(top, id === 'town' ? 150 : 90)), id === 'town' || id === 'hall' || id === 'acad');
    return { svg: s, top, rx };
  }

  // ----- 地面：湖、島、步道、廣場 -----
  const ISLE = [[410, 112], [62, 286], [62, 1030], [410, 1204], [758, 1030], [758, 286]];
  const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const ROWS = [20, 28, 36, 44, 52];
  const PLAZA = [[0, 28, 3.7], [0, 44, 2.6]];
  function groundSVG() {
    let s = `<rect width="${TOWN.w}" height="${TOWN.h}" fill="url(#kdWater)"/>`;
    const rand = seeded(20261009);
    for (let i = 0; i < 46; i++) { const x = rand() * TOWN.w, y = rand() * TOWN.h; if (inPoly(x, y - 20, ISLE)) continue; s += `<path d="M${f1(x)} ${f1(y)}q6 -3 12 0t12 0" stroke="#fff" stroke-opacity="${f1(.35 + rand() * .3)}" stroke-width="1.2" fill="none"/>`; }
    for (let i = 0; i < 9; i++) { const x = rand() * TOWN.w, y = rand() * TOWN.h; if (inPoly(x, y - 30, ISLE)) continue; s += `<g transform="translate(${f1(x)} ${f1(y)})"><ellipse rx="9" ry="4" fill="#8fcf9a"/><path d="M0 0L9 -1" stroke="#cdeef2" stroke-width="1.4"/>${i % 2 ? '<circle cx="-3" cy="-2" r="2.4" fill="#ffc4d8"/>' : ''}</g>`; }
    // 天鵝
    for (const [x, y, d] of [[30, 1230, 1], [780, 210, -1], [770, 1150, -1]]) s += `<g class="kd-swan" transform="translate(${x} ${y}) scale(${d} 1)"><ellipse cx="0" cy="0" rx="10" ry="5" fill="#fff" stroke="#d9e8ee"/><path d="M6 -2q4 -4 2 -11q-1 -3 2 -4" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M10 -17l3 1" stroke="#ff9a3c" stroke-width="2" stroke-linecap="round"/><path d="M-6 -2q3 -5 8 -3" stroke="#e8f2f5" fill="none"/></g>`;
    // 懸崖厚度
    s += poly(ISLE.map(([x, y]) => [x, y + 30]), 'url(#kdCliff)') + poly(ISLE.map(([x, y]) => [x, y + 14]), '#e7c7b0');
    for (let i = 0; i < 16; i++) { const k = i / 16, x = 62 + k * 348, y = 1030 + k * 174 + 22; s += `<path d="M${f1(x)} ${f1(y)}h${f1(8 + (i % 3) * 4)}" stroke="#b98a72" stroke-opacity=".5"/><path d="M${f1(820 - x)} ${f1(y)}h-${f1(8 + (i % 4) * 3)}" stroke="#b98a72" stroke-opacity=".5"/>`; }
    s += poly(ISLE, 'url(#kdGrass)', 'stroke="#f7ead9" stroke-width="6" stroke-linejoin="round"') + poly(ISLE, 'none', 'stroke="#e6cfb6" stroke-width="1.2" transform="translate(0 3)"');
    for (let i = 0; i < 260; i++) { const x = 70 + rand() * 680, y = 120 + rand() * 1080; if (!inPoly(x, y, ISLE)) continue; const r = rand(); s += r < .5 ? `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(6 + rand() * 12)}" ry="${f1(3 + rand() * 5)}" fill="#eef8dc" opacity=".55"/>` : r < .8 ? `<path d="M${f1(x)} ${f1(y)}l-1.5 -4M${f1(x)} ${f1(y)}l1.5 -4M${f1(x)} ${f1(y)}v-5" stroke="#9bc788" stroke-width=".9"/>` : `<circle cx="${f1(x)}" cy="${f1(y)}" r="1.6" fill="${['#ff9cbf', '#fff', '#ffd166', '#c9b6f2'][Math.floor(rand() * 4)]}"/>`; }
    // 大道
    s += `<rect x="${tsx(-1.4)}" y="${tsy(16.6)}" width="${32 * 2.8}" height="${tsy(62) - tsy(16.6)}" fill="url(#kdTiles)"/><path d="M${tsx(-1.4)} ${tsy(16.6)}V${tsy(62)}M${tsx(1.4)} ${tsy(16.6)}V${tsy(62)}" stroke="#e2c9ad" stroke-width="2"/>`;
    // 橫向街道（各排建築的內側角連到大道）
    for (const v of ROWS) {
      for (const d of [-1, 1]) {
        const b = BIDS.find(id => BLD[id].pos[1] === v && Math.sign(BLD[id].pos[0]) === d);
        if (!b) continue;
        const [u0, , r] = BLD[b].pos, a = tsx(u0 - d * r + d * .2), c = tsx(d * 1.4), y0 = tsy(v);
        s += `<rect x="${f1(Math.min(a, c))}" y="${f1(y0 - 9)}" width="${f1(Math.abs(c - a))}" height="18" fill="url(#kdPave)"/><path d="M${f1(Math.min(a, c))} ${f1(y0 - 9)}h${f1(Math.abs(c - a))}M${f1(Math.min(a, c))} ${f1(y0 + 9)}h${f1(Math.abs(c - a))}" stroke="#e2c9ad" stroke-width="1.2"/>`;
      }
    }
    // 後排小徑
    s += `<rect x="${tsx(-3.4)}" y="${tsy(4.5) - 8}" width="${32 * 6.8}" height="16" fill="url(#kdPave)"/>`;
    // 廣場
    for (const [u, v, r] of PLAZA) { const x = tsx(u), y = tsy(v), X = r * 32, Y = r * 16; s += poly([[x - X, y], [x, y - Y], [x + X, y], [x, y + Y]], 'url(#kdTilesP)', 'stroke="#e9c9a8" stroke-width="2.4"') + `<ellipse cx="${x}" cy="${y}" rx="${f1(X * .62)}" ry="${f1(Y * .62)}" fill="none" stroke="#f1cfd6" stroke-width="3"/>`; }
    return s;
  }
  // 噴泉、涼亭、樹、路燈（跟建築一起依深度排序）
  function fountainSVG() {
    const x = tsx(0), y = tsy(28);
    let s = `<ellipse cx="${x}" cy="${y + 2}" rx="52" ry="26" fill="#f6ece4" stroke="#d9c3b5"/><ellipse cx="${x}" cy="${y}" rx="46" ry="22" fill="url(#kdPool)"/>`;
    s += `<path d="M${x - 52} ${y + 2}v6a52 26 0 0 0 104 0v-6" fill="#ead8cc" stroke="#d9c3b5"/>`;
    for (let i = 0; i < 6; i++) s += `<path d="M${f1(x - 30 + i * 12)} ${f1(y + 3 + Math.sin(i) * 4)}q3 -1.6 6 0" stroke="#fff" stroke-opacity=".7" fill="none"/>`;
    s += cyl(x, y, 7, 26, 'url(#kdCyl)') + `<ellipse cx="${x}" cy="${y - 26}" rx="20" ry="9" fill="#f6ece4" stroke="#d9c3b5"/><ellipse cx="${x}" cy="${y - 27}" rx="16" ry="6.5" fill="url(#kdPool)"/>`;
    s += cyl(x, y - 27, 3.5, 14, 'url(#kdGold)') + `<circle cx="${x}" cy="${y - 44}" r="4" fill="url(#kdGold)"/>`;
    for (const [dx, h] of [[-1, 1], [1, 1], [-.5, 1.3], [.5, 1.3]]) s += `<path class="kd-jet" d="M${x} ${y - 46}Q${f1(x + dx * 16)} ${f1(y - 62 * h)} ${f1(x + dx * 24)} ${f1(y - 28)}" stroke="#e8fbff" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    s += `<path class="kd-jet" d="M${x - 14} ${y - 27}Q${x - 30} ${y - 22} ${x - 36} ${y - 2}M${x + 14} ${y - 27}Q${x + 30} ${y - 22} ${x + 36} ${y - 2}" stroke="#e8fbff" stroke-width="1.6" fill="none"/>`;
    return s;
  }
  function gazeboSVG() {
    const x = tsx(0), y = tsy(44);
    let s = `<ellipse cx="${x}" cy="${y}" rx="34" ry="17" fill="#fff" stroke="#e6cfc1"/><ellipse cx="${x}" cy="${y - 3}" rx="34" ry="17" fill="#fbf2ec" stroke="#e6cfc1"/>`;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .3, cx = x + Math.cos(a) * 27, cy = y - 3 + Math.sin(a) * 13; s += `<path d="M${f1(cx)} ${f1(cy)}V${f1(cy - 34)}" stroke="#fff" stroke-width="3.2"/><path d="M${f1(cx)} ${f1(cy)}V${f1(cy - 34)}" stroke="#e8d8cf" stroke-width=".7"/>`; }
    s += `<path d="M${x - 36} ${y - 38}Q${x} ${y - 70} ${x + 36} ${y - 38}A36 14 0 0 1 ${x - 36} ${y - 38}Z" fill="url(#kdDomeP)" ${OL}/><path d="M${x - 36} ${y - 38}A36 14 0 0 0 ${x + 36} ${y - 38}" stroke="url(#kdGold)" stroke-width="2" fill="none"/><path d="M${x} ${y - 56}v-10" stroke="url(#kdGold)" stroke-width="1.6"/><circle cx="${x}" cy="${y - 67}" r="2.6" fill="url(#kdGold)"/>`;
    for (let i = -3; i <= 3; i++) s += `<path d="M${f1(x + i * 10)} ${f1(y - 38 + Math.abs(i) * -0.5 + 13 - Math.abs(i) * 1.6)}q5 4 10 0" stroke="#fff" stroke-width="1" fill="none" opacity=".8"/>`;
    return s;
  }
  function treeSVG(x, y, k, sz = 1) {
    if (k === 'cypress') return `<ellipse cx="${f1(x + 3)}" cy="${f1(y + 1)}" rx="8" ry="3.4" fill="url(#kdShade)"/><path d="M${f1(x)} ${f1(y)}V${f1(y - 6)}" stroke="#7a5038" stroke-width="2"/><path d="M${f1(x)} ${f1(y - 44 * sz)}C${f1(x + 9 * sz)} ${f1(y - 30 * sz)} ${f1(x + 9 * sz)} ${f1(y - 8)} ${f1(x)} ${f1(y - 5)}C${f1(x - 9 * sz)} ${f1(y - 8)} ${f1(x - 9 * sz)} ${f1(y - 30 * sz)} ${f1(x)} ${f1(y - 44 * sz)}Z" fill="url(#kdLeafD)" ${OL}/>`;
    const g = k === 'cherry' ? 'url(#kdCherry)' : 'url(#kdLeaf)', r = 13 * sz;
    let s = `<ellipse cx="${f1(x + 4)}" cy="${f1(y + 1)}" rx="${f1(r)}" ry="${f1(r * .45)}" fill="url(#kdShade)"/><path d="M${f1(x - 1.6)} ${f1(y)}h3.2l-.6 -${f1(14 * sz)}h-2z" fill="url(#kdTrunk)"/>`;
    s += `<circle cx="${f1(x - r * .45)}" cy="${f1(y - r * 1.2)}" r="${f1(r * .72)}" fill="${g}"/><circle cx="${f1(x + r * .5)}" cy="${f1(y - r * 1.25)}" r="${f1(r * .7)}" fill="${g}"/><circle cx="${f1(x)}" cy="${f1(y - r * 1.75)}" r="${f1(r * .82)}" fill="${g}" ${OL}/>`;
    if (k === 'cherry') s += `<circle cx="${f1(x - r * .3)}" cy="${f1(y - r * 2)}" r="1.4" fill="#fff"/><circle cx="${f1(x + r * .5)}" cy="${f1(y - r * 1.4)}" r="1.2" fill="#fff"/>`;
    else s += `<circle cx="${f1(x - r * .2)}" cy="${f1(y - r * 1.95)}" r="${f1(r * .25)}" fill="#fff" opacity=".25"/>`;
    return s;
  }
  let PROPS = null;
  function propsList() {
    if (PROPS) return PROPS;
    const out = [], rand = seeded(777);
    const blocked = (u, v) => {
      for (const id of BIDS) { const [bu, bv, r] = BLD[id].pos; const d = Math.abs(u - bu) + Math.abs(v - bv); if (d < r + .7) return true; if (v > bv && v < bv + r + 2.6 && Math.abs(u - bu) < r * .8) return true; }
      if (Math.abs(u) < 2.3 && v > 15) return true;
      for (const [pu, pv, r] of PLAZA) if (Math.abs(u - pu) + Math.abs(v - pv) < r + 1) return true;
      for (const v0 of ROWS) if (Math.abs(v - v0) < 1.6 && Math.abs(u) < 5.5) return true;
      if (Math.abs(v - 4.5) < 1.4 && Math.abs(u) < 4) return true;
      if (v > 55.5 && Math.abs(u) < 4.5) return true;
      return false;
    };
    for (let y = 130; y < 1200; y += 26) for (let x = 70; x < 760; x += 30) {
      const px = x + (rand() - .5) * 18, py = y + (rand() - .5) * 12;
      if (!inPoly(px, py - 8, ISLE) || !inPoly(px - 14, py, ISLE) || !inPoly(px + 14, py, ISLE) || !inPoly(px, py + 8, ISLE)) continue;
      const u = (px - TOWN.ox) / 32, v = (py - TOWN.oy) / 16;
      if (blocked(u, v)) continue;
      if (rand() < .56) continue;
      const edge = !inPoly(px, py + 40, ISLE) || Math.abs(u) > 9;
      out.push({ x: px, y: py, kind: 'tree', k: edge ? (rand() < .5 ? 'cypress' : 'cherry') : rand() < .45 ? 'cherry' : rand() < .5 ? 'round' : 'cypress', sz: .8 + rand() * .35 });
    }
    for (let v = 18.5; v <= 56; v += 3.4) { if (PLAZA.some(([, pv, r]) => Math.abs(v - pv) < r + .6)) continue; for (const d of [-1, 1]) out.push({ x: tsx(d * 1.7), y: tsy(v), kind: 'lamp' }); }
    for (const [u, v] of [[-2.6, 24.5], [2.6, 24.5], [-2.2, 40.6], [2.2, 40.6], [-2.6, 32.6], [2.6, 32.6]]) out.push({ x: tsx(u), y: tsy(v), kind: 'bench', d: u < 0 ? 1 : -1 });
    for (const [u, v] of [[-2.1, 16.5], [2.1, 16.5], [-1.9, 49], [1.9, 49]]) out.push({ x: tsx(u), y: tsy(v), kind: 'topi' });
    out.push({ x: tsx(0), y: tsy(28), kind: 'fountain' }, { x: tsx(0), y: tsy(44), kind: 'gazebo' });
    return (PROPS = out);
  }
  function propSVG(p) {
    switch (p.kind) {
      case 'tree': return treeSVG(p.x, p.y, p.k, p.sz);
      case 'lamp': return lampPost(p.x, p.y, 24);
      case 'bench': return `<g transform="translate(${f1(p.x)} ${f1(p.y)}) scale(${p.d} 1)"><path d="M-9 0l14 -7M-9 -5l14 -7" stroke="#fff" stroke-width="2.4"/><path d="M-9 0l14 -7" stroke="#c9a35b" stroke-width=".8" transform="translate(0 1.4)"/><path d="M-8 1v4M4 -5v4" stroke="#4a3a52" stroke-width="1.2"/></g>`;
      case 'topi': return `<ellipse cx="${f1(p.x + 2)}" cy="${f1(p.y + 1)}" rx="9" ry="3.5" fill="url(#kdShade)"/>` + cyl(p.x, p.y, 7, 8, '#fff', '#f2e6dd') + `<rect x="${f1(p.x - 7.5)}" y="${f1(p.y - 9)}" width="15" height="2" fill="url(#kdGold)"/><circle cx="${f1(p.x)}" cy="${f1(p.y - 18)}" r="9" fill="url(#kdLeafD)" ${OL}/><circle cx="${f1(p.x - 3)}" cy="${f1(p.y - 21)}" r="1.5" fill="#ff9cbf"/><circle cx="${f1(p.x + 4)}" cy="${f1(p.y - 16)}" r="1.5" fill="#fff"/>`;
      case 'fountain': return fountainSVG();
      case 'gazebo': return gazeboSVG();
    }
    return '';
  }
  // 漫步的名媛與跑車（CSS 動畫）
  function lifeSVG() {
    const lady = (c, hat) => `<g><ellipse cx="0" cy="1" rx="4" ry="1.6" fill="url(#kdShade)"/><path d="M-3.4 0l1.4 -9h4l1.4 9z" fill="${c}"/><circle cx="0" cy="-11" r="2.6" fill="#ffe4d8"/><path d="M-2.8 -12a2.8 2.8 0 0 1 5.6 0" fill="#5a2740"/>${hat ? `<path d="M-8 -16q8 -9 16 0z" fill="${hat}" opacity=".95"/><path d="M0 -16v6" stroke="#8a6a3e" stroke-width=".5"/>` : ''}</g>`;
    let s = '';
    const walkers = [['#ff8fb5', '#fff', 0], ['#b9a2e8', null, 7], ['#9fe0c8', '#ffd1e0', 14], ['#ffd166', null, 3], ['#f08bb0', '#ffe9a8', 10]];
    walkers.forEach(([c, hat, dl], i) => { const x = tsx(i % 2 ? .6 : -.6); s += `<g class="kd-walk ${i % 2 ? 'up' : 'down'}" style="animation-delay:-${dl}s;--x:${x}px">${lady(c, hat)}</g>`; });
    s += `<g class="kd-drive" style="--y:${tsy(36) + 3}px"><g transform="scale(.8)"><path d="M-15 0l3 -6 9 -4h9l8 5 4 1 1 4z" fill="#ff8fb5" stroke="#8a2f55" stroke-width=".7"/><path d="M-6 -9l3 -5h8l5 5z" fill="url(#kdGlassC)"/><circle cx="-8" cy="1" r="3" fill="#3b1530"/><circle cx="9" cy="1" r="3" fill="#3b1530"/></g></g>`;
    for (let i = 0; i < 3; i++) s += `<g class="kd-bfly" style="animation-delay:-${i * 3}s;--x:${tsx([-4, 3, -1][i])}px;--y:${tsy([12, 24, 48][i])}px"><path d="M0 0c-3 -4 -6 -2 -4 1zM0 0c3 -4 6 -2 4 1z" fill="${['#ff9cbf', '#c9b6f2', '#ffd166'][i]}"/></g>`;
    s += `<g class="kd-clouds">${[[120, 300, 1], [560, 700, .8], [300, 1040, 1.1]].map(([x, y, k], i) => `<ellipse class="kd-cloud" style="animation-delay:-${i * 14}s" cx="${x}" cy="${y}" rx="${70 * k}" ry="${26 * k}" fill="#5a2740" opacity=".05"/>`).join('')}</g>`;
    return s;
  }

  // ---------- 4b. 畫面共用 ----------
  const now = () => Date.now();
  const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let api = null, root = null, mounted = false, visible = false, view = 'town';
  const A = () => api || W.ErikaAPI || null;
  let stObj = null, hooked = false, heroAt = 0;
  // 每次使用都重新向主程式要存檔物件（玩家重來後會換新物件）
  function ks() {
    const a = A(); if (!a || typeof a.store !== 'function') return null;
    let o; try { o = a.store('kingdom'); } catch (e) { return null; }
    if (!o || typeof o !== 'object') return null;
    if (o !== stObj || !o.v) {
      const fresh = !o.v;
      ensure(o, now());
      if (fresh && a.sandbox) { Object.assign(o.res, { silk: 300000, spice: 300000, ore: 90000, leaf: 40000 }); o.items.spd = 600; }
      if (fresh) fillMap(o);
      stObj = o;
      hook();
    }
    return o;
  }
  function hook() {
    if (hooked) return;
    const a = A(); if (!a || typeof a.on !== 'function') return;
    hooked = true;
    a.on('heroes', () => { refreshHeroes(true); if (mounted) refreshOpen(); });
    a.on('event', name => { // 其他玩法的戰績 → 主線任務（娛樂城）
      if (!name || /^kd_/.test(name)) return;
      const s = ks(); if (!s) return;
      s.evc[name] = (s.evc[name] || 0) + 1;
    });
  }
  function refreshHeroes(force) {
    const t = now(); if (!force && t - heroAt < 300) return; heroAt = t;
    const a = A(); if (!a) return;
    try { if (typeof a.heroes === 'function') setHeroes(a.heroes()); } catch (e) { /* 舊版主程式 */ }
    try { if (typeof a.fashion === 'function') setFashion(a.fashion().power); } catch (e) { /* 舊版主程式 */ }
  }
  const fmt = n => { const a = A(); return a && a.fmt ? a.fmt(n) : String(Math.floor(n)); };
  // 資源列用的短格式（最多 3 位有效數字）
  const fmtS = n => { if (!(n >= 1e4)) return fmt(n); for (const [v, u] of [[1e16, '京'], [1e12, '兆'], [1e8, '億'], [1e4, '萬']]) if (n >= v) { const x = n / v, y = x >= 100 ? Math.floor(x) : x >= 10 ? Math.floor(x * 10) / 10 : Math.floor(x * 100) / 100; return String(y) + u; } return fmt(n); };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function clock(ms) { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; }
  function dur(ms) { const s = Math.max(0, Math.round(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); if (d) return `${d} 天 ${h} 小時`; if (h) return `${h} 小時${m ? ` ${m} 分` : ''}`; if (m) return `${m} 分${s % 60 ? ` ${s % 60} 秒` : ''}`; return `${s} 秒`; }
  const snd = (k, ...a) => { try { const s = A() && A().sound; if (s && s[k]) s[k](...a); } catch (e) { /* 音效失敗不影響 */ } };
  const vib = ms => { try { A() && A().vib && A().vib(ms); } catch (e) { /* 不支援 */ } };
  const toast = (h, c) => { try { A() && A().toast && A().toast(h, c); } catch (e) { /* 略 */ } };
  const report = (name, data) => { try { const a = A(); if (a && typeof a.event === 'function') a.event(name, data || {}); } catch (e) { /* 舊版主程式 */ } };
  const gemI = () => (A() && A().icons ? A().icons.gem() : '◆');
  const coinI = () => (A() && A().icons ? A().icons.coin() : '$');
  const lineI = k => (A() && A().icons ? A().icons.line(k) : '');
  const month = () => { try { return !!(A() && A().monthCard); } catch (e) { return false; } };
  const coins = () => { try { return A() ? A().coins : 0; } catch (e) { return 0; } };
  const heroInfo = id => {
    const a = A(); let list = null;
    try { list = a && typeof a.heroes === 'function' ? a.heroes() : null; } catch (e) { list = null; }
    const c = (list || (a && a.cast ? a.cast() : [])).find(x => x.id === id) || {};
    const s = heroOf(id);
    return { id, name: c.name || id, title: c.title || '', color: c.color || '#d6457a', face: c.face || (() => ''), full: c.full || '', lv: s.lv, star: s.star, shards: s.shards, power: s.power, lvCost: c.lvCost, starNeed: c.starNeed !== undefined ? c.starNeed : s.starNeed };
  };
  const $ = (q, r = root) => r ? r.querySelector(q) : null;
  const $$ = (q, r = root) => r ? [...r.querySelectorAll(q)] : [];
  const centerOf = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  // 小圖示
  const IC = {
    silk: '<path d="M6 6h12v12H6z" fill="#ff8fb5"/><path d="M6 8l12 2M6 11l12 2M6 14l12 2" stroke="#ffd3e3" stroke-width="1"/><ellipse cx="12" cy="6" rx="7" ry="2.4" fill="#f6d98a" stroke="#a97b30" stroke-width=".6"/><ellipse cx="12" cy="18" rx="7" ry="2.4" fill="#e2bd6a" stroke="#a97b30" stroke-width=".6"/><path d="M18 14q3.2 2.4 1.6 6.4" stroke="#e0628a" fill="none" stroke-width="1.2"/>',
    spice: '<path d="M7 9h10l-1 11.2H8z" fill="#fff0db" stroke="#c46f3a" stroke-width=".7"/><path d="M7.9 13h8.2l-.7 7.2H8.6z" fill="#ec8a45"/><rect x="7.4" y="5.4" width="9.2" height="3.8" rx="1.2" fill="#c46f3a"/><path d="M9.5 15.5l1.5 1M13 14.6l1 1.5M11 18l1.5-.5" stroke="#ffd166" stroke-width="1"/><path d="M9 10.5v8" stroke="#fff" stroke-opacity=".7"/>',
    ore: '<path d="M12 2.5l6.2 6.3L12 21 5.8 8.8z" fill="#9cc2f4" stroke="#3f6fb8" stroke-width=".7"/><path d="M5.8 8.8h12.4M12 2.5V21M9 8.8 12 21l3-12.2" stroke="#fff" stroke-opacity=".65" stroke-width=".7" fill="none"/><path d="M3.5 16.5l3-3.4 2.2 5.4zM20.5 16.5l-3-3.4-2.2 5.4z" fill="#c7dcf8" stroke="#3f6fb8" stroke-width=".5"/>',
    leaf: '<path d="M4.5 15.5l7.5-4.2 7.5 4.2-7.5 4.2z" fill="#b8892c"/><path d="M4.5 12.3l7.5-4.2 7.5 4.2-7.5 4.2z" fill="#e2bd6a" stroke="#a97b30" stroke-width=".5"/><path d="M4.5 9.1l7.5-4.2 7.5 4.2-7.5 4.2z" fill="#fde9b0" stroke="#a97b30" stroke-width=".5"/><path d="M8.8 8.6l3.2-1.8" stroke="#fff" stroke-width="1.1"/>',
    power: '<path d="M12 2.6l7.4 3v5.2c0 5.2-3.6 8.8-7.4 10.4-3.8-1.6-7.4-5.2-7.4-10.4V5.6z" fill="#7d4bc4" stroke="#e9c879" stroke-width="1.1"/><path d="M7.8 10.2l2.2 2 2-3.2 2 3.2 2.2-2-1 4.4H8.8z" fill="#ffe08a"/>',
    stam: '<path d="M13.4 2L5.2 13.2h6l-1.2 8.8 8.4-12h-6.2z" fill="#ff8fb5" stroke="#b2385f" stroke-width=".8" stroke-linejoin="round"/>',
    spd: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" stroke="#9c742f" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M9.6 18.6c.6-2.2 4.2-2.2 4.8 0z" fill="#ff8fb5"/>',
    hammer: '<path d="M13.6 4.4l6 6-2.2 2.2-2-2-7.8 7.8a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8-1.4-1.4z" fill="#c9a35b" stroke="#7a5a1e" stroke-width=".8" stroke-linejoin="round"/>',
    flask: '<path d="M9.5 3h5M10 3v5.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9.5V3" fill="#efe7ff" stroke="#6a58bf" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 15h10l2 3.2a2 2 0 0 1-1.8 2.8H6.8A2 2 0 0 1 5 18.2z" fill="#b39cf0"/>',
    sword: '<path d="M5 19l9.5-9.5M14.5 4.5l5 0 0 5-9 9-5-5z" fill="#e8ecf8" stroke="#4f63b8" stroke-width="1.2" stroke-linejoin="round"/><path d="M4 16l4 4M3.5 20.5l2-2" stroke="#c9a35b" stroke-width="2" stroke-linecap="round"/>',
    scroll: '<path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="#fff6e6" stroke="#c9a35b" stroke-width="1.2"/><path d="M9 8h7M9 11h7M9 14h5" stroke="#d6457a" stroke-width="1.2" stroke-linecap="round"/><path d="M4 6a2 2 0 0 1 4 0v12" stroke="#c9a35b" stroke-width="1.2" fill="#f6e2b6"/>',
    crown: '<path d="M4 17l-1-9 5 4 4-7 4 7 5-4-1 9z" fill="#ffd36b" stroke="#a97b30" stroke-width="1" stroke-linejoin="round"/><path d="M4 19.5h16" stroke="#a97b30" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="13" r="1.6" fill="#ff6f9f"/>',
    book: '<path d="M3.5 6c3-1.6 6-1.6 8.5 0 2.5-1.6 5.5-1.6 8.5 0v12c-3-1.4-6-1.4-8.5 0-2.5-1.4-5.5-1.4-8.5 0z" fill="#efe7ff" stroke="#6a58bf" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 6v12" stroke="#6a58bf" stroke-width="1.2"/><path d="M5.6 9c1.6-.6 3.2-.6 4.4 0M14 9c1.6-.6 3.2-.6 4.4 0" stroke="#b39cf0"/>',
    basket: '<path d="M4 10h16l-1.8 9H5.8z" fill="#f6c27d" stroke="#a9702c" stroke-width="1"/><path d="M8 10l3-5M16 10l-3-5" stroke="#a9702c" stroke-width="1.4" stroke-linecap="round"/><path d="M6 13h12M7 16h10" stroke="#a9702c" stroke-opacity=".5"/><circle cx="9" cy="9" r="2" fill="#ff8fb5"/><circle cx="14.5" cy="8.6" r="2.2" fill="#9cc2f4"/>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="#e8f5df" stroke="#3f8a64" stroke-width="1.2" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="#3f8a64" stroke-width="1"/><path d="M11 10l2 2M13 10l-2 2" stroke="#d6457a" stroke-width="1.6" stroke-linecap="round"/>',
    town: '<path d="M4 20V10l8-5 8 5v10z" fill="#fff6f0" stroke="#c9608a" stroke-width="1.2" stroke-linejoin="round"/><path d="M3 10.5 12 4.5l9 6" stroke="#e0628a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M10 20v-5h4v5" fill="#f6dfa0" stroke="#a97b30"/>',
    bull: '<path d="M5 7c-2-1-3-3-2-4 1 2 3 2 5 2M19 7c2-1 3-3 2-4-1 2-3 2-5 2" fill="#f2f2f2" stroke="#7a5a1e" stroke-width=".8"/><ellipse cx="12" cy="12" rx="7" ry="6.4" fill="#c88a5a"/><rect x="6.4" y="9.4" width="11.2" height="3" rx="1.4" fill="#2b2033"/><ellipse cx="12" cy="16" rx="3.8" ry="2.6" fill="#f2b8a0"/><circle cx="10.6" cy="16" r=".7"/><circle cx="13.4" cy="16" r=".7"/><path d="M8 19.6q4 2 8 0" stroke="#ffd36b" stroke-width="1.4" fill="none"/>',
    report: '<rect x="5" y="3" width="14" height="18" rx="2" fill="#fff" stroke="#7d4bc4" stroke-width="1.2"/><path d="M8 8h8M8 11.5h8M8 15h5" stroke="#b39cf0" stroke-width="1.3" stroke-linecap="round"/><circle cx="16" cy="16" r="3" fill="#ffd36b" stroke="#a97b30"/>',
    butler: '<circle cx="12" cy="7.4" r="3.4" fill="#ffe4d8" stroke="#7a5a1e" stroke-width=".8"/><path d="M8.6 6.6a3.4 3.4 0 0 1 6.8 0" fill="#6b4a2e"/><path d="M5 21c0-4.4 3.1-7.6 7-7.6s7 3.2 7 7.6z" fill="#3b3550"/><path d="M10 14l2 1.6 2-1.6-2 6z" fill="#fff"/><path d="M11 15.2h2" stroke="#d6457a" stroke-width="1.4"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5" fill="#ff8fb5" stroke="#b2385f" stroke-width=".8"/><path d="M3 9h18M12 9v11" stroke="#ffd36b" stroke-width="2"/><path d="M12 9C10 5 6.5 5 7 7.5 7.4 9 12 9 12 9zm0 0c2-4 5.5-4 5-1.5-.4 1.5-5 1.5-5 1.5z" fill="#ffd36b" stroke="#a97b30" stroke-width=".6"/>',
    heart: '<path d="M12 20s-7-4.4-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.6 12 20 12 20z" fill="#ff8fb5" stroke="#b2385f" stroke-width=".8"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2" fill="#b8a6b6"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="#b8a6b6" stroke-width="2.2" fill="none"/>',
    check: '<circle cx="12" cy="12" r="9" fill="#2f9a72"/><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    cross: '<circle cx="12" cy="12" r="9" fill="#d6457a"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.8-4.4 4.2 1.1 6.1L12 16.8l-5.5 2.9 1.1-6.1-4.4-4.2 6.1-.8z" fill="#ffd36b" stroke="#a97b30" stroke-width=".8" stroke-linejoin="round"/>',
    starO: '<path d="M12 3l2.7 5.6 6.1.8-4.4 4.2 1.1 6.1L12 16.8l-5.5 2.9 1.1-6.1-4.4-4.2 6.1-.8z" fill="#efe2e8" stroke="#cdb5c1" stroke-width=".8" stroke-linejoin="round"/>',
    guard: '<circle cx="12" cy="7" r="3.4" fill="#ffe4d8"/><path d="M8.6 6.2a3.4 3.4 0 0 1 6.8 0" fill="#2b2033"/><path d="M8.4 6.2h7.2" stroke="#2b2033" stroke-width="1.6"/><path d="M5 21c0-4.4 3-7.4 7-7.4s7 3 7 7.4z" fill="#3d4675"/><path d="M12 14l-1.4 7h2.8z" fill="#fff"/><path d="M11.4 15h1.2" stroke="#d6457a" stroke-width="1.4"/>',
    car: '<path d="M3 15l2-4.6 4.4-2.4h5.4l4.2 3 2 .6.6 3.4z" fill="#ff8fb5" stroke="#8a2f55" stroke-width=".8" stroke-linejoin="round"/><path d="M9.6 8.4l1.6-.6h3.4l2.8 2.6H8.8z" fill="#cfe6fb"/><circle cx="7.6" cy="15.6" r="2.4" fill="#3b1530"/><circle cx="17" cy="15.6" r="2.4" fill="#3b1530"/><circle cx="7.6" cy="15.6" r=".9" fill="#ddd"/><circle cx="17" cy="15.6" r=".9" fill="#ddd"/>',
    pap: '<rect x="3.5" y="8" width="17" height="11" rx="2" fill="#5b3f96"/><rect x="7" y="5.5" width="5" height="3" rx="1" fill="#5b3f96"/><circle cx="12" cy="13.5" r="4" fill="#2b2033" stroke="#e9c879" stroke-width="1.2"/><circle cx="12" cy="13.5" r="2" fill="#7aa6ff"/><circle cx="11.2" cy="12.7" r=".7" fill="#fff"/><path d="M17.5 4.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="#ffe08a"/>',
  };
  const ic = (k, cls = '') => `<svg class="kd-i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[k] || ''}</svg>`;
  const resLine = (c, have) => RES.filter(k => c[k]).map(k => `<span class="kd-cost ${have && st0().res[k] < c[k] ? 'lack' : ''}">${ic(k)}${fmt(c[k])}</span>`).join('');
  const st0 = () => ks() || freshState(now());

  // ---------- 4c. 骨架 ----------
  function skeleton() {
    return `<div class="kd" data-view="town">
      <div class="kd-top">
        <div class="kd-res">${RES.map(k => `<button class="kd-chip" data-res="${k}" aria-label="${RES_INFO[k].name}">${ic(k)}<b class="num" data-rv="${k}">0</b></button>`).join('')}</div>
        <button class="kd-chip kd-pow" data-act="power" aria-label="戰力">${ic('power')}<b class="num" data-pw>0</b></button>
      </div>
      <div class="kd-view">
        <div class="kd-pan kd-town" data-pan="town"><div class="kd-world" style="width:${TOWN.w}px;height:${TOWN.h}px"><svg class="kd-svg" viewBox="0 0 ${TOWN.w} ${TOWN.h}" width="${TOWN.w}" height="${TOWN.h}" aria-label="名媛王國城鎮"></svg><div class="kd-ovl"></div></div></div>
        <div class="kd-pan kd-map" data-pan="map" hidden><div class="kd-world" style="width:${MAP.w}px;height:${MAP.h}px"><svg class="kd-svg" viewBox="0 0 ${MAP.w} ${MAP.h}" width="${MAP.w}" height="${MAP.h}" aria-label="王國地圖"></svg><div class="kd-ovl"></div></div></div>
        <div class="kd-hudl" data-hudl></div>
        <div class="kd-hudr">
          <button class="kd-rb kd-boss-b" data-act="boss" aria-label="黃牛王討伐">${ic('bull')}<span>黃牛王</span><i class="kd-dot" hidden></i></button>
          <button class="kd-rb" data-act="daily" aria-label="每日任務">${ic('gift')}<span>每日</span><i class="kd-dot" hidden></i></button>
          <button class="kd-rb" data-act="butler" aria-label="王國管家">${ic('butler')}<span>管家</span><em class="kd-rbt" data-butler></em></button>
          <button class="kd-rb" data-act="reports" aria-label="戰報">${ic('report')}<span>戰報</span><i class="kd-dot" hidden></i></button>
        </div>
        <div class="kd-quest" data-quest></div>
      </div>
      <nav class="kd-dock">
        <button data-act="quests">${ic('scroll')}<span>任務</span><i class="kd-dot" hidden></i></button>
        <button data-act="heroes">${ic('crown')}<span>英雄</span><i class="kd-dot" hidden></i></button>
        <button data-act="army">${ic('sword')}<span>部隊</span><i class="kd-dot" hidden></i></button>
        <button data-act="acad">${ic('book')}<span>學院</span><i class="kd-dot" hidden></i></button>
        <button data-act="collect" class="kd-collect">${ic('basket')}<span>一鍵收成</span><i class="kd-dot" hidden></i></button>
        <button data-act="view" class="kd-viewb">${ic('map')}<span>地圖</span></button>
      </nav>
      <div class="kd-layer"></div>
      <div class="kd-fly" aria-hidden="true"></div>
    </div>`;
  }

  // ---------- 4d. 平移／縮放 ----------
  const PANS = {};
  function makePan(name, el, W0, H0, onTap, zr = [0.5, 1.5]) {
    const world = el.querySelector('.kd-world');
    const P = { x: 0, y: 0, z: 0.8, ptrs: new Map(), moved: 0, vx: 0, vy: 0, raf: 0, zr, W0, H0, el, world, ready: false };
    const vw = () => el.clientWidth || 390, vh = () => el.clientHeight || 600;
    const clampP = () => {
      const zmin = Math.max(P.zr[0], Math.min(vw() / W0, vh() / H0) * 0.98);
      P.z = clamp(P.z, zmin, P.zr[1]);
      const w = W0 * P.z, h = H0 * P.z, m = 40;
      P.x = w <= vw() ? (vw() - w) / 2 : clamp(P.x, vw() - w - m, m);
      P.y = h <= vh() ? (vh() - h) / 2 : clamp(P.y, vh() - h - m, m);
    };
    P.apply = () => { clampP(); world.style.transform = `translate3d(${f1(P.x)}px,${f1(P.y)}px,0) scale(${P.z.toFixed(3)})`; };
    P.center = (wx, wy, z, smooth) => {
      if (z) P.z = z;
      const tx = vw() / 2 - wx * P.z, ty = vh() * 0.46 - wy * P.z;
      if (smooth && !RM) { world.style.transition = 'transform .45s cubic-bezier(.2,.8,.3,1)'; setTimeout(() => { world.style.transition = ''; }, 480); }
      P.x = tx; P.y = ty; P.apply();
    };
    P.toScreen = (wx, wy) => { const r = el.getBoundingClientRect(); return [r.left + P.x + wx * P.z, r.top + P.y + wy * P.z]; };
    const zoomAt = (k, cx, cy) => { const r = el.getBoundingClientRect(), ox = cx - r.left, oy = cy - r.top, z0 = P.z; P.z = clamp(P.z * k, P.zr[0], P.zr[1]); const f = P.z / z0; P.x = ox - (ox - P.x) * f; P.y = oy - (oy - P.y) * f; P.apply(); };
    const stopInertia = () => { cancelAnimationFrame(P.raf); P.raf = 0; };
    let pinch = null, last = null, downT = 0, target = null;
    el.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      stopInertia();
      P.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      try { el.setPointerCapture(e.pointerId); } catch (er) { /* 略 */ }
      if (P.ptrs.size === 1) { P.moved = 0; downT = performance.now(); target = e.target; last = [e.clientX, e.clientY, performance.now()]; P.vx = P.vy = 0; }
      if (P.ptrs.size === 2) { const [a, b] = [...P.ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: P.z }; P.moved = 99; }
    });
    el.addEventListener('pointermove', e => {
      if (!P.ptrs.has(e.pointerId)) return;
      const prev = P.ptrs.get(e.pointerId);
      P.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (P.ptrs.size >= 2 && pinch) {
        const [a, b] = [...P.ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomAt(pinch.z * d / pinch.d / P.z, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        return;
      }
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      P.moved += Math.abs(dx) + Math.abs(dy);
      if (P.moved > 6) { P.x += dx; P.y += dy; P.apply(); el.classList.add('dragging'); }
      const t = performance.now();
      if (last && t - last[2] > 0) { P.vx = (e.clientX - last[0]) / (t - last[2]) * 16; P.vy = (e.clientY - last[1]) / (t - last[2]) * 16; }
      last = [e.clientX, e.clientY, t];
    });
    const up = e => {
      if (!P.ptrs.has(e.pointerId)) return;
      P.ptrs.delete(e.pointerId);
      if (P.ptrs.size < 2) pinch = null;
      if (P.ptrs.size) return;
      el.classList.remove('dragging');
      if (P.moved < 8 && performance.now() - downT < 650 && e.type === 'pointerup') { onTap(target, e); return; }
      if (!RM && (Math.abs(P.vx) > 0.6 || Math.abs(P.vy) > 0.6) && performance.now() - (last ? last[2] : 0) < 80) {
        const step = () => { P.vx *= 0.92; P.vy *= 0.92; P.x += P.vx; P.y += P.vy; P.apply(); if (Math.abs(P.vx) + Math.abs(P.vy) > 0.3) P.raf = requestAnimationFrame(step); else P.raf = 0; };
        P.raf = requestAnimationFrame(step);
      }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY); }, { passive: false });
    el.addEventListener('contextmenu', e => e.preventDefault());
    PANS[name] = P;
    return P;
  }

  // ---------- 4e. 城鎮畫面 ----------
  let townSig = '', groundCache = '';
  function townSigOf(s) { return BIDS.map(id => lvl(s, id) + (busyQueue(s, id) >= 0 ? 'u' : '') + (lvl(s, 'town') >= BLD[id].unlock ? '' : 'x')).join(',') + '|' + (RM ? 1 : 0); }
  function renderTown(force) {
    const s = ks(); if (!s || !root) return;
    const sig = townSigOf(s);
    if (sig === townSig && !force) return;
    townSig = sig;
    if (!groundCache) groundCache = groundSVG();
    const items = [];
    const plots = [];
    for (const id of BIDS) {
      const [u, v] = BLD[id].pos, x = tsx(u), y = tsy(v), lv = lvl(s, id), upg = busyQueue(s, id) >= 0;
      plots.push(`<g class="kd-plot" data-b="${id}">${plotSVG(id, lv, s)}</g>`);
      const art = lv > 0 || upg ? bArt(id, Math.max(1, lv), x, y, upg).svg : emptyLot(id, s);
      items.push({ y: id === 'wall' ? y + 40 : y, s: `<g class="kd-b ${upg ? 'upg' : ''}" data-b="${id}">${art}</g>` });
    }
    for (const p of propsList()) items.push({ y: p.y + (p.kind === 'fountain' || p.kind === 'gazebo' ? 1 : 0), s: propSVG(p) });
    items.sort((a, b) => a.y - b.y);
    $('.kd-town .kd-svg').innerHTML = groundCache + plots.join('') + items.map(i => i.s).join('') + (RM ? '' : lifeSVG());
    buildTownOverlay();
  }
  // 建築上方的名牌、泡泡、倒數（HTML 疊在同一個座標系）
  function buildTownOverlay() {
    const s = ks(), ovl = $('.kd-town .kd-ovl');
    let h = '';
    for (const id of BIDS) {
      const [u, v, pr] = BLD[id].pos, x = tsx(u), y = tsy(v), lv = lvl(s, id);
      const top = lv > 0 || busyQueue(s, id) >= 0 ? bArt(id, Math.max(1, lv), x, y, false).top : 30;
      const locked = lvl(s, 'town') < BLD[id].unlock && lv === 0;
      h += `<div class="kd-tag ${lv ? '' : locked ? 'lock' : 'empty'}" data-tag="${id}" style="left:${f1(x)}px;top:${f1(y + pr * 16 * .55)}px"><b>${BLD[id].name}</b>${lv ? `<i>${lv}</i>` : locked ? `<em>本館 Lv.${BLD[id].unlock}</em>` : '<em>可建造</em>'}</div>`;
      h += `<button class="kd-bub" data-bub="${id}" style="left:${f1(x)}px;top:${f1(y - Math.min(top, 170) - 10)}px" hidden></button>`;
      h += `<div class="kd-tmr" data-tmr="${id}" style="left:${f1(x)}px;top:${f1(y - Math.min(top, 150) * .45)}px" hidden><span data-tt></span><i><b></b></i></div>`;
    }
    ovl.innerHTML = h + '<div class="kd-fx-layer"></div>';
    updateTownOverlay();
  }
  function updateTownOverlay() {
    const s = ks(); if (!s || !root) return;
    const t = now(), b = bonus(s), fm = freeMs(s);
    for (const id of BIDS) {
      const bub = $(`[data-bub="${id}"]`), tmr = $(`[data-tmr="${id}"]`); if (!bub) continue;
      let kind = '', html = '';
      const qi = busyQueue(s, id);
      if (qi >= 0) {
        const j = s.q[qi], left = jobLeft(j, t);
        tmr.hidden = false;
        const txt = clock(left), tt = tmr.querySelector('[data-tt]'); if (tt.textContent !== txt) tt.textContent = txt;
        tmr.querySelector('b').style.width = f1(clamp(1 - left / j.dur, 0, 1) * 100) + '%';
        if (left <= fm) { kind = 'free'; html = `${ic('spd')}<span>免費</span>`; }
        else if (j.helps < j.hmax && lvl(s, 'guild')) { kind = 'help'; html = `${ic('heart')}<span>${j.helps}/${j.hmax}</span>`; }
      } else tmr.hidden = true;
      if (!kind && BLD[id].res && lvl(s, id)) { const v = stored(s, id, t, b); if (v >= bubbleAt(s, id, b)) { kind = 'res ' + (v >= prodRate(s, id, b) * CAP_H - 1 ? 'full' : ''); html = `${ic(id)}<span>${fmt(v)}</span>`; } }
      if (!kind && BLD[id].troop) { const j = s.train[id]; if (j && j.done) { kind = 'troop'; html = `${ic(id)}<span>+${j.n}</span>`; } else if (!j && lvl(s, id) && maxTrain(s, id, tierMax(lvl(s, id))) > 0 && qi < 0) { kind = 'idle'; html = `${ic('sword')}<span>閒置</span>`; } }
      if (!kind && id === 'spa' && s.heal) { kind = 'heal'; html = `${ic('heart')}<span>${clock(jobLeft(s.heal, t))}</span>`; }
      if (!kind && id === 'acad' && lvl(s, 'acad') && !s.rsch && qi < 0) { kind = 'idle'; html = `${ic('flask')}<span>閒置</span>`; }
      if (!kind && id === 'bank' && s.bank && t >= s.bank.end) { kind = 'res'; html = `${coinI()}<span>到期</span>`; }
      if (!kind && id === 'town' && !s.q.some(Boolean) && !upgBlock(s, 'town', month(), coins())) { kind = 'up'; html = `${lineI('up')}<span>可升級</span>`; }
      const cls = 'kd-bub ' + kind;
      if (bub._k !== cls + html) { bub._k = cls + html; bub.className = cls; bub.innerHTML = html; bub.hidden = !kind; }
    }
  }

  // ---------- 4f. 上方資源列、左側隊列、任務列、紅點 ----------
  function updateTop() {
    const s = ks(); if (!s || !root) return;
    for (const k of RES) { const el = $(`[data-rv="${k}"]`); const v = fmtS(s.res[k]); if (el && el.textContent !== v) el.textContent = v; }
    const pw = $('[data-pw]'), p = fmtS(power(s)); if (pw && pw.textContent !== p) pw.textContent = p;
  }
  function updateHudL() {
    const s = ks(); if (!s || !root) return;
    const t = now(), m = month(), qn = queueCount(s, m);
    let h = '';
    for (let i = 0; i < 2; i++) {
      const j = s.q[i];
      if (j) h += `<button class="kd-q busy" data-q="${i}">${ic('hammer')}<span><b>${BLD[j.b].name} Lv.${j.to}</b><em data-end="${jobEnd(j)}">${clock(jobLeft(j, t))}</em></span><i style="width:${f1(clamp(1 - jobLeft(j, t) / j.dur, 0, 1) * 100)}%"></i></button>`;
      else if (i < qn) h += `<button class="kd-q idle" data-q="${i}">${ic('hammer')}<span><b>建築隊列閒置</b><em>點我一鍵升級</em></span></button>`;
      else h += `<button class="kd-q lock" data-q="${i}">${ic('lock')}<span><b>第二隊列</b><em>${gemI()}${QUEUE2_GEMS} 永久解鎖</em></span></button>`;
    }
    if (s.rsch) { const j = s.rsch; h += `<button class="kd-q busy r" data-act="acad">${ic('flask')}<span><b>${TECHM[j.id].name} Lv.${j.to}</b><em>${clock(jobLeft(j, t))}</em></span><i style="width:${f1(clamp(1 - jobLeft(j, t) / j.dur, 0, 1) * 100)}%"></i></button>`; }
    if (s.marches.length) h += `<button class="kd-q busy m" data-act="map">${ic('map')}<span><b>出征中 ${s.marches.length}/${marchSlots(lvl(s, 'town'))}</b><em>${marchLabel(s.marches[0], t)}</em></span></button>`;
    const el = $('[data-hudl]');
    if (el._h !== h) { el._h = h; el.innerHTML = h; }
  }
  const marchLabel = (mm, t) => mm.st === 'go' ? `前往 ${clock(mm.t1 - t)}` : mm.st === 'work' ? `採集 ${clock(mm.t2 - t)}` : `返回 ${clock(mm.t3 - t)}`;
  function questBar() {
    const s = ks(); if (!s || !root) return;
    const q = curQuest(s), el = $('[data-quest]');
    let h;
    if (!q) h = `<div class="kd-qcard done"><span class="kd-qi">${ic('crown')}</span><div class="kd-qt"><small>名媛王國</small><b>主線全部完成！妳就是王國女王</b></div></div>`;
    else {
      const v = Math.min(q.n, qVal(s, q)), ok = v >= q.n;
      h = `<div class="kd-qcard ${ok ? 'ok' : ''}"><span class="kd-qi">${ic(ok ? 'gift' : 'scroll')}</span><div class="kd-qt"><small>第 ${q.ch} 章・${CHAPTERS[q.ch - 1] || ''}</small><b>${q.t}</b><span class="kd-qp"><i style="width:${f1(v / q.n * 100)}%"></i></span></div>
        <button class="btn ${ok ? 'goldb' : ''} kd-qb" data-act="${ok ? 'qclaim' : 'qgo'}">${ok ? '領取' : '前往'}</button></div>`;
    }
    if (el._h !== h) { el._h = h; el.innerHTML = h; }
  }
  function dots() {
    const s = ks(); if (!s || !root) return;
    const t = now(), b = bonus(s);
    const set = (sel, on) => { const d = $(sel); if (d) d.hidden = !on; };
    set('[data-act="quests"] .kd-dot', questDone(s) || dailyClaimable(s));
    set('[data-act="daily"] .kd-dot', dailyClaimable(s));
    set('[data-act="collect"] .kd-dot', RES.some(k => lvl(s, k) && stored(s, k, t, b) >= bubbleAt(s, k, b)) || TYPES.some(k => s.train[k] && s.train[k].done));
    set('[data-act="army"] .kd-dot', TYPES.some(k => s.train[k] && s.train[k].done || (!s.train[k] && lvl(s, k) && maxTrain(s, k, tierMax(lvl(s, k))) > 0)));
    set('[data-act="acad"] .kd-dot', lvl(s, 'acad') > 0 && !s.rsch && !!recommendTech(s) && !techBlock(s, recommendTech(s), coins()));
    set('[data-act="heroes"] .kd-dot', HEROES.some(h => { const x = heroOf(h.id); return x.starNeed && x.shards >= x.starNeed; }));
    set('[data-act="reports"] .kd-dot', s.reports.some(r => !r.read));
    const B = s.boss && s.boss.day === dayKey(t) ? s.boss : null;
    set('[data-act="boss"] .kd-dot', !B || B.hits < 3 || bossMilestones(B).some(m => B.dmg >= m.need && !B.ms[m.i]) || (B.prev && !B.prev.claimed));
    const bt = $('[data-butler]'); if (bt) { const on = s.butler > t, txt = on ? clock(s.butler - t) : ''; if (bt.textContent !== txt) bt.textContent = txt; bt.parentElement.classList.toggle('on', on); }
  }
  const dailyClaimable = s => DAILY.some(d => !s.day.done[d.id] && (s.day.c[d.k] || 0) >= d.n) || DAILY_CHEST.some(c => !s.day.chest[c.pts] && dailyPts(s) >= c.pts);

  // ---------- 4g. 特效 ----------
  function flyTo(kind, x, y, n = 6, sel) {
    if (!root) return;
    const layer = $('.kd-fly'), target = $(sel || `[data-res="${kind}"]`) || $('.kd-pow');
    if (!layer || !target) return;
    const lr = layer.getBoundingClientRect(), [tx, ty] = centerOf(target);
    n = RM ? 1 : n;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'kd-flyi';
      el.innerHTML = IC[kind] ? ic(kind) : kind;
      el.style.left = (x - lr.left) + 'px'; el.style.top = (y - lr.top) + 'px';
      layer.appendChild(el);
      const dx = (Math.random() - .5) * 90, dy = -30 - Math.random() * 60;
      const an = el.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.15)`, opacity: 1, offset: .35 }, { transform: `translate(calc(-50% + ${tx - x}px),calc(-50% + ${ty - y}px)) scale(.6)`, opacity: .9 }], { duration: 750 + i * 60, easing: 'cubic-bezier(.3,.6,.4,1)' });
      an.onfinish = () => { el.remove(); target.classList.remove('kd-bump'); void target.offsetWidth; target.classList.add('kd-bump'); };
    }
  }
  function fireworks(id) {
    const [u, v] = BLD[id].pos, x = tsx(u), y = tsy(v), s = ks();
    const top = lvl(s, id) ? bArt(id, lvl(s, id), x, y, false).top : 40;
    const layer = $('.kd-town .kd-fx-layer'); if (!layer) return;
    const cols = ['#ff8fb5', '#ffd36b', '#b9a2e8', '#9fe0c8', '#fff'];
    for (let k = 0; k < (RM ? 1 : 3); k++) {
      const fw = document.createElement('div');
      fw.className = 'kd-fw';
      fw.style.left = (x + (k - 1) * 46) + 'px'; fw.style.top = (y - top - 30 - (k % 2) * 30) + 'px';
      fw.style.animationDelay = (k * 0.25) + 's';
      let h = '';
      for (let i = 0; i < 14; i++) h += `<i style="--a:${i * 360 / 14}deg;--c:${cols[(i + k) % cols.length]};animation-delay:${k * .25}s"></i>`;
      fw.innerHTML = h;
      layer.appendChild(fw);
      setTimeout(() => fw.remove(), 1800 + k * 250);
    }
    const rib = document.createElement('div');
    rib.className = 'kd-lvup'; rib.style.left = x + 'px'; rib.style.top = (y - top * .5) + 'px';
    rib.innerHTML = `<b>LEVEL UP</b><span>${BLD[id].name} Lv.${lvl(s, id)}</span>`;
    layer.appendChild(rib); setTimeout(() => rib.remove(), 2200);
    const P = PANS.town;
    if (P && visible && view === 'town') { const [sx, sy] = P.toScreen(x, y - top); try { A().fx.burst(sx, sy, 30, ['confetti', 'spark', 'heart']); } catch (e) { /* 略 */ } }
  }
  function floatText(id, txt) {
    const [u, v] = BLD[id].pos, x = tsx(u), y = tsy(v), layer = $('.kd-town .kd-fx-layer'); if (!layer) return;
    const el = document.createElement('div'); el.className = 'kd-ftxt'; el.style.left = x + 'px'; el.style.top = (y - 60) + 'px'; el.innerHTML = txt;
    layer.appendChild(el); setTimeout(() => el.remove(), 1400);
  }

  // ---------- 4h. 底部面板與全頁面板 ----------
  let sheet = null;
  const panels = [];
  function closeSheet() { if (!sheet) return; const el = sheet.el; sheet = null; el.classList.add('out'); setTimeout(() => el.remove(), 220); }
  function openSheet(kind, render, cls = '') {
    closeSheet();
    const el = document.createElement('div');
    el.className = 'kd-sheetw ' + cls;
    el.innerHTML = `<div class="kd-scrim" data-close></div><section class="kd-sheet" role="dialog" aria-modal="true"><button class="kd-x" data-close aria-label="關閉">${lineI('close')}</button><div class="kd-sbody"></div></section>`;
    $('.kd-layer').appendChild(el);
    const S = { el, kind, render: () => { const b = el.querySelector('.kd-sbody'), y = b.scrollTop; b.innerHTML = render(); b.scrollTop = y; liveTimers(el); } };
    el.addEventListener('click', e => { if (e.target.closest('[data-close]')) { snd('click'); if (sheet === S) closeSheet(); } });
    sheet = S; S.render();
    return S;
  }
  function openPanel(kind, title, en, render) {
    const top = panels[panels.length - 1];
    if (top && top.kind === kind) { top.render(); return top; }
    const el = document.createElement('div');
    el.className = 'kd-panel';
    el.innerHTML = `<header class="kd-ph"><button class="kd-back" data-pclose aria-label="返回">${lineI('back')}</button><div><div class="eyebrow">${en}</div><h2>${title}</h2></div></header><div class="kd-pbody"></div>`;
    $('.kd-layer').appendChild(el);
    const P = { el, kind, render: () => { const b = el.querySelector('.kd-pbody'), y = b.scrollTop; b.innerHTML = render(); b.scrollTop = y; liveTimers(el); } };
    el.querySelector('[data-pclose]').addEventListener('click', () => { snd('click'); closePanel(P); });
    panels.push(P); P.render();
    return P;
  }
  function closePanel(P) { const i = panels.indexOf(P); if (i < 0) return; panels.splice(i, 1); P.el.classList.add('out'); setTimeout(() => P.el.remove(), 240); }
  function closeAll() { closeSheet(); while (panels.length) closePanel(panels[panels.length - 1]); const r = $('.kd-report'); if (r) r.remove(); }
  function refreshOpen() { if (sheet) sheet.render(); for (const p of panels) p.render(); }
  // 倒數與進度條（每 0.3 秒）
  function liveTimers(scope) {
    const t = now();
    for (const el of scope.querySelectorAll('[data-end]')) { const txt = clock(+el.dataset.end - t); if (el.textContent !== txt) el.textContent = txt; }
    for (const el of scope.querySelectorAll('[data-pg]')) { const [a, b] = el.dataset.pg.split(',').map(Number); el.style.width = f1(clamp((t - a) / Math.max(1, b - a), 0, 1) * 100) + '%'; }
  }
  // 時間到了就整個重畫（例如升級完成）
  function liveOpen() { if (!root) return; liveTimers($('.kd-layer')); }

  // 粉鑽按鈕（兩段確認）
  function gemBtn(el, n, fn) {
    const a = A();
    const label = el.innerHTML;
    if (a && a.twoTap) a.twoTap(el, () => { if (a.spendGems(n)) fn(); }, () => { if (el.dataset.confirm) { if (!el._lab) el._lab = label; el.innerHTML = `再點一下確認<small>${gemI()}${n}</small>`; } else if (el._lab) { el.innerHTML = el._lab; el._lab = null; } });
    else if (a && a.spendGems(n)) fn();
  }
  const resGems = (s, miss) => { let g = 0; const u = resUnit(s); for (const k of RES) if (miss[k]) g += miss[k] / (u * RATE_K[k] * 1.5); return Math.max(1, Math.ceil(g)); };

  // ---------- 動作 ----------
  function afterAction() { const s = ks(); if (!s) return; handleEvents(process(s, now())); renderTown(); updateTop(); updateHudL(); questBar(); dots(); updateTownOverlay(); if (view === 'map') renderMap(); refreshOpen(); }
  function collectOne(id, el) {
    const s = ks(), v = collect(s, id, now());
    if (!v) return 0;
    report('kd_collect');
    snd('ding'); vib(8);
    const [x, y] = el ? centerOf(el) : [innerWidth / 2, innerHeight / 2];
    flyTo(id, x, y, Math.min(8, 3 + Math.floor(Math.log10(v + 1))));
    floatText(id, `+${fmt(v)}`);
    return v;
  }
  function claimTroops(k, el) {
    const s = ks(), n = claimTrain(s, k); if (!n) return 0;
    report('kd_train', { n });
    snd('buy'); vib(10);
    const [x, y] = el ? centerOf(el) : [innerWidth / 2, innerHeight / 2];
    flyTo(k, x, y, 5, '.kd-pow');
    floatText(TROOP[k].b, `${TROOP[k].name} +${n}`);
    return n;
  }
  function collectEverything(el) {
    const s = ks(); let any = 0;
    const t = now(), b = bonus(s);
    for (const k of RES) if (lvl(s, k) && stored(s, k, t, b) >= 1) { const bub = $(`[data-bub="${k}"]`); any += collectOne(k, bub && !bub.hidden ? bub : el) ? 1 : 0; }
    for (const k of TYPES) if (s.train[k] && s.train[k].done) any += claimTroops(k, el) ? 1 : 0;
    if (!any) { toast('目前沒有可以收成的東西，晚點再來看看～'); snd('err'); }
    else snd('cash');
    afterAction();
  }
  function doUpgrade(id, el, instant) {
    const s = ks(), m = month(), lv = lvl(s, id), c = upgCost(id, lv + 1);
    const blk = upgBlock(s, id, m, coins());
    if (blk && !(instant && (blk.code === 'res' || blk.code === 'queue'))) {
      snd('err'); if (el) A().shake(el);
      if (blk.code === 'req') toast(`需要${blk.reqs.map(r => `${BLD[r.b].name} Lv.${r.lv}`).join('、')}`);
      else if (blk.code === 'res') toast('資源不足，可以去收成、採集或用粉鑽補足');
      else if (blk.code === 'gold') toast(`金幣不足，還差 ${fmt(blk.need)}`);
      else if (blk.code === 'queue') toast('建築隊列都在忙，先加速或解鎖第二隊列');
      return false;
    }
    if (!A().spendCoins(c.gold, el)) return false;
    if (instant) { const miss = missingRes(s, c); for (const k of Object.keys(miss)) s.res[k] += miss[k]; }
    if (instant && freeQueue(s, m) < 0) { // 隊列滿了也能用粉鑽直接蓋好
      for (const k of RES) if (c[k]) s.res[k] -= c[k];
      settle(s, now()); s.b[id].lv = lv + 1; bump(s, 'upg', 1);
      handleEvents([{ type: 'built', b: id, lv: lv + 1, t: now() }]);
    } else {
      const j = beginUpgrade(s, id, now(), m);
      if (instant && j) j.cut = j.dur;
      else { snd('beep', 520, 0.08, 'square', 0.05); snd('beep', 780, 0.1, 'square', 0.05, 0.09); toast(`${BLD[id].name}開始${lv ? '升級' : '建造'}！${dur(j.dur)}`, 'gold'); }
    }
    vib(12);
    afterAction();
    return true;
  }
  function instantCost(s, id) { const lv = lvl(s, id), c = upgCost(id, lv + 1); return gemCost(upgTime(s, id, lv + 1)) + (Object.keys(missingRes(s, c)).length ? resGems(s, missingRes(s, c)) : 0); }
  function quickUpgrade(el) {
    const s = ks(), id = recommend(s, month());
    if (!id) { toast('王國已經全部升到頂了！'); return; }
    if (!upgBlock(s, id, month(), coins())) { doUpgrade(id, el); return; }
    focusBuilding(id); openBuilding(id);
  }
  const jobRef = (s, ref) => ref.k === 'q' ? s.q[ref.i] : ref.k === 'rsch' ? s.rsch : ref.k === 'train' ? s.train[ref.t] : ref.k === 'heal' ? s.heal : null;
  function speedUp(ref, how, el) {
    const s = ks(), j = jobRef(s, ref); if (!j) return;
    const left = jobLeft(j, now());
    if (how === 'free') { if (left > freeMs(s) || ref.k === 'train' || ref.k === 'heal') return; j.cut += left; snd('ding'); }
    else if (how === 'gem') { j.cut += left; snd('cash'); }
    else { // 加速道具（分鐘）
      const want = how === 'fit' ? Math.ceil(Math.max(0, left - (ref.k === 'q' || ref.k === 'rsch' ? freeMs(s) : 0)) / MIN) : +how;
      const use = Math.min(s.items.spd, Math.max(1, want));
      if (use <= 0 || s.items.spd <= 0) { toast('加速道具用完了，打黃牛黨據點、做任務都拿得到'); snd('err'); return; }
      s.items.spd -= use; j.cut += use * MIN; bump(s, 'speed', 1); snd('ding');
      toast(`使用加速 ${use} 分鐘`, 'gold');
    }
    vib(10);
    afterAction();
  }
  // 計時中的工程卡（升級、研究、訓練、治療共用）
  function jobCard(ref, title, j) {
    const s = ks(), t = now(), left = jobLeft(j, t), free = (ref.k === 'q' || ref.k === 'rsch') && left <= freeMs(s);
    const r = JSON.stringify(ref).replace(/"/g, '&quot;');
    return `<div class="kd-job"><div class="kd-jobt"><b>${title}</b><span data-end="${jobEnd(j)}">${clock(left)}</span></div>
      <div class="kd-bar"><i data-pg="${j.t0},${jobEnd(j)}" style="width:${f1(clamp((t - j.t0) / Math.max(1, jobEnd(j) - j.t0), 0, 1) * 100)}%"></i></div>
      ${j.hmax ? `<div class="kd-help">${ic('heart')}閨蜜幫忙 ${j.helps}/${j.hmax} 次・每次 -${dur(j.hper)}</div>` : ''}
      <div class="kd-acts">${free ? `<button class="btn goldb" data-speed='${r}' data-how="free">免費完成</button>` : `<button class="btn ghost" data-speed='${r}' data-how="fit" ${s.items.spd ? '' : 'disabled'}>${ic('spd')}用加速<small>庫存 ${dur(s.items.spd * MIN)}</small></button>`}
      <button class="btn gemb" data-speedgem='${r}' data-n="${gemCost(left)}">立即完成<small>${gemI()}${gemCost(left)}</small></button></div></div>`;
  }

  // ---------- 建築面板 ----------
  function thumb(id, lv) {
    const x = 200, y = 200, a = bArt(id, Math.max(1, lv), x, y, false), rx = a.rx, top = a.top, Wd = Math.max(rx * 2.8, (top + 40) * 1.15);
    return `<svg class="kd-thumb" viewBox="${f1(x - Wd / 2)} ${f1(y - top - 26)} ${f1(Wd)} ${f1(top + 26 + rx * .7)}" aria-hidden="true">${plotSVG(id, Math.max(1, lv), ks())}${a.svg}</svg>`;
  }
  function effects(id, lv) {
    const s = ks(), rows = [], n = lv + 1, has = lv < MAX_LV;
    const row = (k, a, b) => rows.push(`<div class="kd-eff"><span>${k}</span><b>${a}</b>${has && b !== undefined && b !== a ? `<i>→</i><b class="nx">${b}</b>` : ''}</div>`);
    const bb = bonus(s);
    switch (id) {
      case 'town': row('百貨收益加成', '×' + townMult(lv).toFixed(2), '×' + townMult(n).toFixed(2)); row('可開幕的百貨樓層', FLOOR_REQ.filter(r => r <= lv).length + ' 層', FLOOR_REQ.filter(r => r <= n).length + ' 層'); row('其他建築等級上限', 'Lv.' + lv, 'Lv.' + n); row('出征隊伍', marchSlots(lv) + ' 隊', marchSlots(n) + ' 隊'); break;
      case 'silk': case 'spice': case 'ore': case 'leaf': { const pr = l => l ? 500 * RATE_K[id] * Math.pow(1.16, l - 1) * (1 + (id === 'silk' || id === 'spice' ? bb.prodBasic : bb.prodRare)) : 0; row('每小時產量', fmt(pr(lv)), fmt(pr(n))); row('倉庫上限（12 小時）', fmt(pr(lv) * CAP_H), fmt(pr(n) * CAP_H)); break; }
      case 'guard': case 'car': case 'pap': row('可訓練兵階', lv ? 'T' + tierMax(lv) : '—', 'T' + tierMax(n)); row('每批訓練人數', batchCap(lv), batchCap(n)); break;
      case 'hall': row('英雄帶兵加成', '+' + 3 * lv + '%', '+' + 3 * n + '%'); row('英雄全域加成', '+' + lv + '%', '+' + n + '%'); break;
      case 'acad': row('可研究科技等級', '學院 Lv.' + lv, '學院 Lv.' + n); break;
      case 'spa': { const c = l => l ? Math.round((40 + 60 * l) * (1 + bb.hospital)) : 0; row('傷兵容量', c(lv), c(n)); break; }
      case 'guild': row('閨蜜幫忙次數', lv ? 3 + lv : 0, 3 + n); row('每次幫忙縮短', '1% 或 20 秒'); break;
      case 'bank': row('最多可存', lv ? bankMaxH(lv) + ' 小時收益' : '—', bankMaxH(n) + ' 小時收益'); row('利息粉鑽加碼', '+' + Math.floor(lv / 5), '+' + Math.floor(n / 5)); break;
      case 'wall': row('全軍防禦', '+' + lv + '%', '+' + n + '%'); break;
    }
    return rows.join('');
  }
  function openBuilding(id) {
    snd('click');
    return openSheet('b:' + id, () => {
      const s = ks(), lv = lvl(s, id), d = BLD[id], qi = busyQueue(s, id), t = now();
      const locked = lv === 0 && lvl(s, 'town') < d.unlock;
      let h = `<div class="kd-sh-head"><div class="kd-sh-art ${lv ? '' : 'ghost'}">${thumb(id, lv)}</div><div class="kd-sh-tt"><div class="eyebrow">${d.en}</div><h3>${d.name}</h3><div class="kd-lvrow"><span class="kd-lv">Lv.${lv}<small>/${MAX_LV}</small></span>${lv ? `<span class="kd-tier">${['', '典雅', '華麗', '奢華', '璀璨', '傳奇'][tierOf(lv)] || '初建'}</span>` : ''}</div><p>${d.desc}</p></div></div>`;
      if (locked) h += `<div class="kd-note lock">${ic('lock')}百貨本館升到 Lv.${d.unlock} 才能建造</div>`;
      if (qi >= 0) h += jobCard({ k: 'q', i: qi }, `${lv ? '升級' : '建造'}中 → Lv.${s.q[qi].to}`, s.q[qi]) + `<button class="kd-link" data-cancel="${qi}">取消工程（退回一半資源）</button>`;
      if (lv) h += `<div class="kd-sec"><h4>建築效果</h4>${effects(id, lv)}</div>`;
      h += special(id, s, t);
      if (qi < 0 && !locked) h += upgradeBlock(id, s);
      return h;
    });
  }
  function upgradeBlock(id, s) {
    const lv = lvl(s, id);
    if (lv >= MAX_LV) return `<div class="kd-note gold">${ic('crown')}已經是最高等級，閃閃發光！</div>`;
    const to = lv + 1, c = upgCost(id, to), reqs = upgReqs(s, id, to), m = month(), blk = upgBlock(s, id, m, coins());
    const tm = upgTime(s, id, to);
    let h = `<div class="kd-sec"><h4>${lv ? `升級到 Lv.${to}` : '建造'}</h4>`;
    h += `<div class="kd-reqs">${reqs.map(r => `<div class="kd-req ${r.ok ? 'ok' : ''}">${ic(r.ok ? 'check' : 'cross')}<span>${BLD[r.b].name} Lv.${r.lv}</span>${r.ok ? '' : `<button class="kd-mini" data-gob="${r.b}">前往</button>`}</div>`).join('')}</div>`;
    h += `<div class="kd-costs">${c.gold ? `<span class="kd-cost ${coins() < c.gold ? 'lack' : ''}">${coinI()}${fmt(c.gold)}</span>` : ''}${resLine(c, true)}<span class="kd-cost t">${ic('spd')}${dur(tm)}</span></div>`;
    if (lv === 0 || lvl(s, 'town') > 3) h += effects(id, lv).includes('→') && lv ? '' : '';
    const ic2 = instantCost(s, id), miss = missingRes(s, c);
    const canNow = !blk;
    h += `<div class="kd-acts">`;
    if (blk && blk.code === 'queue') h += `<button class="btn ghost" data-act="queues">隊列已滿</button>`;
    else h += `<button class="btn goldb ${canNow ? '' : 'off'}" data-up="${id}">${lv ? '升級' : '建造'}<small>${dur(tm)}</small></button>`;
    if (!blk || blk.code === 'res' || blk.code === 'queue') h += `<button class="btn gemb" data-upgem="${id}" data-n="${ic2}">${Object.keys(miss).length ? '補足並完成' : '立即完成'}<small>${gemI()}${ic2}</small></button>`;
    h += `</div></div>`;
    return h;
  }
  function special(id, s, t) {
    let h = '';
    if (BLD[id].res && lvl(s, id)) {
      const b = bonus(s), v = stored(s, id, t, b), cap = prodRate(s, id, b) * CAP_H;
      h += `<div class="kd-sec"><h4>倉庫</h4><div class="kd-store"><div class="kd-bar big"><i style="width:${f1(v / cap * 100)}%"></i></div><span>${fmt(v)} / ${fmt(cap)}</span></div><div class="kd-acts"><button class="btn ${v >= 1 ? 'goldb' : 'off'}" data-col="${id}">收成 ${ic(id)}+${fmt(v)}</button><button class="btn ghost" data-act="collect">一鍵收成全部</button></div></div>`;
    }
    if (BLD[id].troop && lvl(s, id)) {
      const k = BLD[id].troop, j = s.train[k];
      h += `<div class="kd-sec"><h4>${TROOP[k].name}部隊</h4><div class="kd-tline">${ic(k)}<span>現有 <b>${fmt(sum(s.troops[k]))}</b> 名・${TROOP[k].tag}・克制${TROOP[TROOP[k].beats].name}</span></div>`;
      if (j && j.done) h += `<div class="kd-acts"><button class="btn goldb" data-claimtr="${k}">收下 ${TROOP[k].name} ×${j.n}</button></div>`;
      else if (j) h += jobCard({ k: 'train', t: k }, `訓練 T${j.tier} ${TROOP[k].name} ×${j.n}`, j);
      else h += `<div class="kd-acts"><button class="btn" data-train="${k}">訓練${TROOP[k].name}</button></div>`;
      h += '</div>';
    }
    if (id === 'hall' && lvl(s, id)) h += `<div class="kd-sec"><h4>名媛名冊</h4><div class="kd-faces">${HEROES.map(x => { const hi = heroInfo(x.id); return `<button class="kd-face" data-hero="${x.id}" style="--c:${hi.color}"><img src="${hi.face('neutral')}" alt=""><i>${hi.star}★</i></button>`; }).join('')}</div><div class="kd-acts"><button class="btn" data-act="heroes">打開英雄殿堂</button></div></div>`;
    if (id === 'acad' && lvl(s, id)) h += `<div class="kd-sec"><h4>研究</h4>${s.rsch ? jobCard({ k: 'rsch' }, `${TECHM[s.rsch.id].name} → Lv.${s.rsch.to}`, s.rsch) : '<p class="kd-p">目前沒有研究中的科技。</p>'}<div class="kd-acts"><button class="btn" data-act="acad">打開研究樹</button></div></div>`;
    if (id === 'spa' && lvl(s, id)) {
      const w = troopCount(s.wounded), cap = hospCap(s), plan = healPlan(s), pc = healCost(s, plan), pn = troopCount(plan);
      h += `<div class="kd-sec"><h4>傷兵療養</h4><div class="kd-store"><div class="kd-bar big rose"><i style="width:${f1(woundedCount(s) / Math.max(1, cap) * 100)}%"></i></div><span>${woundedCount(s)} / ${cap}</span></div>`;
      if (s.heal) h += jobCard({ k: 'heal' }, `治療中 ${troopCount(s.heal.units)} 名`, s.heal);
      else if (w) h += `<div class="kd-costs">${resLine(pc, true)}<span class="kd-cost t">${ic('spd')}${dur(healTime(s, plan))}</span></div><div class="kd-acts"><button class="btn ${pn ? 'goldb' : 'off'}" data-heal>一鍵治療 ${pn} 名</button><button class="btn gemb" data-healgem data-n="${Math.max(1, Math.ceil(gemCost(healTime(s, plan)) / 2))}">立即治療<small>${gemI()}${Math.max(1, Math.ceil(gemCost(healTime(s, plan)) / 2))}</small></button></div>`;
      else h += '<p class="kd-p">大家都很健康，正在敷面膜～</p>';
      h += '</div>';
    }
    if (id === 'guild' && lvl(s, id)) {
      const nm = FRIENDS.slice(0, Math.min(8, 3 + lvl(s, id)));
      h += `<div class="kd-sec"><h4>閨蜜們</h4><div class="kd-pals">${nm.map((n, i) => `<span class="kd-pal" style="--h:${i * 47}deg"><b>${n[0]}</b><small>${n}</small></span>`).join('')}</div><p class="kd-p">每次開始建造或研究，閨蜜們會自動來幫忙 ${3 + lvl(s, id)} 次，每次縮短 1%（至少 20 秒）。</p></div>`;
    }
    if (id === 'bank' && lvl(s, id)) h += bankBlock(s, t);
    if (id === 'wall' && lvl(s, id)) h += `<div class="kd-sec"><h4>城防</h4><div class="kd-eff"><span>精力（攻打據點）</span><b>${Math.floor(stamNow(s, t))} / ${STAM.max}</b></div><div class="kd-eff"><span>部隊總戰力</span><b>${fmt(troopPower(s.troops))}</b></div><p class="kd-p">鐵門保全是本館升級的必要條件，也會提升全軍防禦。</p></div>`;
    if (id === 'town' && lvl(s, id)) h += `<div class="kd-sec"><h4>百貨樓層開幕條件</h4><div class="kd-floors">${FLOOR_REQ.map((r, i) => `<span class="${lvl(s, 'town') >= r ? 'ok' : ''}"><b>${i + 1}F</b><small>Lv.${r}</small></span>`).join('')}</div></div>`;
    return h;
  }
  function bankBlock(s, t) {
    const lv = lvl(s, 'bank'), a = A(), ips = a ? a.incomePerSec() : 1, maxAmt = ips * 3600 * bankMaxH(lv), minAmt = Math.max(1000, ips * 600);
    let h = `<div class="kd-sec"><h4>ERIKA 定存</h4>`;
    if (s.bank) {
      const B = s.bank, plan = BANK_PLANS.find(p => p.id === B.plan), done = t >= B.end;
      h += `<div class="kd-bankc ${done ? 'done' : ''}"><b>${plan.name}</b><span>${coinI()}${fmt(B.amt)}</span><small>到期可領 ${coinI()}${fmt(B.amt * (1 + plan.rate))} ＋ ${gemI()}${B.gems}</small>${done ? '' : `<div class="kd-bar"><i data-pg="${B.t0},${B.end}"></i></div><em data-end="${B.end}">${clock(B.end - t)}</em>`}</div>`;
      h += `<div class="kd-acts">${done ? `<button class="btn goldb" data-bankclaim>領回本金與利息</button>` : `<button class="btn ghost" data-bankbreak>提前解約（只領回本金）</button>`}</div>`;
    } else {
      h += `<p class="kd-p">一次存一筆。可存 ${coinI()}${fmt(minAmt)} ～ ${coinI()}${fmt(maxAmt)}（${bankMaxH(lv)} 小時收益）。</p><div class="kd-plans">`;
      for (const p of BANK_PLANS) { const ok = lv >= p.lv; h += `<div class="kd-plan ${ok ? '' : 'lock'}"><b>${p.name}</b><span>${p.h} 小時</span><span>利息 ${Math.round(p.rate * 100)}% ＋ ${gemI()}${bankGems(p, lv)}</span>${ok ? `<div class="kd-pbtns">${[0.25, 0.5, 1].map(f => { const amt = Math.min(maxAmt, Math.max(minAmt, coins() * f)); return `<button class="kd-mini ${coins() >= amt ? '' : 'off'}" data-bank="${p.id}" data-amt="${Math.floor(amt)}">${f === 1 ? '存最多' : `存 ${f * 100}%`}<small>${fmt(amt)}</small></button>`; }).join('')}</div>` : `<em>銀行 Lv.${p.lv} 解鎖</em>`}</div>`; }
      h += '</div>';
    }
    return h + '</div>';
  }

  // ---------- 訓練 ----------
  let trainSel = {};
  function openTrain(k) {
    snd('click');
    const sel = trainSel[k] = trainSel[k] || { t: 0, f: 1 };
    return openSheet('train:' + k, () => {
      const s = ks(), bl = lvl(s, TROOP[k].b), tm = tierMax(bl), j = s.train[k];
      if (!sel.t || sel.t > tm) sel.t = tm;
      const t = sel.t, mx = maxTrain(s, k, t), cap = batchCap(bl), n = Math.max(0, Math.min(mx, Math.round(cap * sel.f)));
      const c = trainCost(k, t, Math.max(1, n));
      let h = `<div class="kd-sh-head"><div class="kd-sh-art troop" style="--c:${TROOP[k].c}">${ic(k, 'big')}</div><div class="kd-sh-tt"><div class="eyebrow">${BLD[TROOP[k].b].en}</div><h3>訓練${TROOP[k].name}</h3><p>${TROOP[k].tag}・克制<b>${TROOP[TROOP[k].beats].name}</b>・被<b>${TROOP[TYPES.find(x => TROOP[x].beats === k)].name}</b>克制</p><p class="kd-p">現有 ${fmt(sum(s.troops[k]))} 名</p></div></div>`;
      if (j && j.done) return h + `<div class="kd-acts"><button class="btn goldb" data-claimtr="${k}">收下 ${TROOP[k].name} ×${j.n}</button></div>`;
      if (j) return h + jobCard({ k: 'train', t: k }, `訓練 T${j.tier} ×${j.n}`, j);
      h += `<div class="kd-sec"><h4>選擇兵階</h4><div class="kd-tiers">${Array.from({ length: 10 }, (_, i) => i + 1).map(i => `<button class="kd-tierb ${i === t ? 'on' : ''} ${i > tm ? 'lock' : ''}" data-tier="${i}" ${i > tm ? 'disabled' : ''}><b>T${i}</b><small>${i > tm ? `Lv.${(i - 1) * 3 + 1}` : TIER_NAME[i - 1]}</small></button>`).join('')}</div>
        <div class="kd-stats"><span>攻擊 <b>${Math.round(unitAtk(t))}</b></span><span>血量 <b>${Math.round(unitHp(t))}</b></span><span>戰力 <b>${unitPw(t)}</b></span><span>負重 <b>${Math.round(unitLoad(t))}</b></span></div></div>`;
      h += `<div class="kd-sec"><h4>數量 <b class="kd-n">${n}</b> / ${cap}</h4><div class="kd-seg">${[[.25, '25%'], [.5, '50%'], [1, '最多']].map(([f, l]) => `<button data-tf="${f}" class="${sel.f === f ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="kd-costs">${resLine(c, true)}<span class="kd-cost t">${ic('spd')}${dur(trainTime(s, t, Math.max(1, n)))}</span></div>
        <div class="kd-acts"><button class="btn goldb ${n > 0 ? '' : 'off'}" data-dotrain="${k}" data-t="${t}" data-n="${n}">開始訓練</button><button class="btn gemb" data-traingem="${k}" data-t="${t}" data-nn="${cap}" data-n="${gemCost(trainTime(s, t, cap)) + resGems(s, missingRes(s, trainCost(k, t, cap)))}">立即訓練 ${cap}<small>${gemI()}${gemCost(trainTime(s, t, cap)) + resGems(s, missingRes(s, trainCost(k, t, cap)))}</small></button></div>
        ${mx < cap * sel.f ? '<p class="kd-p warn">資源只夠訓練這些，收成或採集後再來吧</p>' : ''}</div>`;
      return h;
    });
  }
  function doTrain(k, t, n, el, instant) {
    const s = ks();
    if (instant) { const miss = missingRes(s, trainCost(k, t, n)); for (const r of Object.keys(miss)) s.res[r] += miss[r]; }
    const blk = trainBlock(s, k, t, n);
    if (blk) { snd('err'); if (el) A().shake(el); toast(blk.code === 'res' ? '資源不足' : blk.code === 'busy' ? '正在訓練中' : '現在不能訓練'); return; }
    const j = beginTrain(s, k, t, n, now());
    if (instant) j.cut = j.dur;
    else { snd('beep', 660, 0.08, 'triangle', 0.08); toast(`開始訓練 ${TROOP[k].name} ×${n}`, 'gold'); }
    afterAction();
    if (instant) { claimTroops(k, el); afterAction(); }
  }

  // ---------- 英雄（共用名冊） ----------
  const stars = (n, max = 6) => `<span class="kd-stars">${Array.from({ length: max }, (_, i) => ic(i < n ? 'star' : 'starO')).join('')}</span>`;
  function heroPerkText(s, id) {
    const h = HERO[id], st2 = heroOf(id), g = heroGlobal(s, h), tb = heroTroopBonus(h, st2) * (1 + 0.03 * lvl(s, 'hall'));
    return { g: `${G_NAME[h.g]} +${f1(g * 100)}%`, t: `${h.troop === 'all' ? '全兵種' : TROOP[h.troop].name}帶兵 +${f1(tb * 100)}%` };
  }
  function openHeroes() {
    snd('click');
    return openPanel('heroes', '名媛殿堂', 'Salle des Héroïnes', () => {
      const s = ks(), a = A(), shared = a && typeof a.heroes === 'function';
      let h = `<div class="kd-hall"><div><b>殿堂 Lv.${lvl(s, 'hall')}</b><small>英雄全域加成 +${lvl(s, 'hall')}%・帶兵加成 +${3 * lvl(s, 'hall')}%</small></div><span>${ic('power')}${fmt(HEROES.reduce((x, y) => x + heroOf(y.id).power, 0))}</span></div>`;
      if (!shared) h += '<p class="kd-note">英雄名冊讀取中…</p>';
      h += `<div class="kd-hgrid">${HEROES.map(x => {
        const hi = heroInfo(x.id), pk = heroPerkText(s, x.id), ready = hi.starNeed && hi.shards >= hi.starNeed;
        return `<button class="kd-hcard" data-hero="${x.id}" style="--c:${hi.color}"><span class="kd-hart"><img src="${hi.face(ready ? 'joy' : 'neutral')}" alt="" loading="lazy"></span>${stars(hi.star)}<b>${esc(hi.name)}</b><small>${x.role}</small><span class="kd-hlv">Lv.${hi.lv}</span>
          <span class="kd-hsh"><i style="width:${hi.starNeed ? f1(Math.min(1, hi.shards / hi.starNeed) * 100) : 100}%"></i><em>${hi.starNeed ? `${hi.shards}/${hi.starNeed}` : '滿星'}</em></span><span class="kd-hpk">${pk.g}</span>${ready ? '<i class="kd-dot"></i>' : ''}</button>`;
      }).join('')}</div><p class="kd-fine">英雄是整個 ERIKA 百貨共用的，在名媛對決等玩法也會上場。碎片來源：黃牛黨據點、黃牛王、每日任務、娛樂城。</p>`;
      return h;
    });
  }
  function openHero(id) {
    snd('click');
    return openSheet('hero:' + id, () => {
      const s = ks(), hi = heroInfo(id), h = HERO[id], pk = heroPerkText(s, id), a = A();
      const next = hi.star < 6 ? { ...hi, star: hi.star + 1 } : null;
      const ng = next ? heroGlobalRaw(h, next) * (1 + 0.01 * lvl(s, 'hall')) : 0;
      let x = `<div class="kd-hdetail" style="--c:${hi.color}"><div class="kd-hfull"><img src="${hi.full}" alt=""><span class="kd-say">${h.line}</span></div>
        <div class="kd-hinfo"><div class="eyebrow">${h.role}</div><h3>${esc(hi.name)}</h3>${stars(hi.star)}<div class="kd-hlvbig">Lv.<b>${hi.lv}</b><small>/60</small></div>
        <div class="kd-eff"><span>英雄戰力</span><b>${fmt(hi.power)}</b></div><div class="kd-eff"><span>王國光環</span><b>${pk.g}</b></div>${next ? `<div class="kd-eff"><span>升星後</span><b class="nx">+${f1(ng * 100)}%</b></div>` : ''}<div class="kd-eff"><span>出征時</span><b>${pk.t}</b></div></div></div>`;
      x += `<div class="kd-sec"><h4>培養</h4><div class="kd-hsh big"><i style="width:${hi.starNeed ? f1(Math.min(1, hi.shards / hi.starNeed) * 100) : 100}%"></i><em>碎片 ${hi.starNeed ? `${hi.shards} / ${hi.starNeed}` : '已滿星'}</em></div>
        <div class="kd-acts"><button class="btn goldb ${hi.lvCost == null ? 'off' : ''}" data-hlv="${id}">${hi.lvCost == null ? '已滿級' : '升級'}<small>${hi.lvCost == null ? '' : coinI() + fmt(hi.lvCost)}</small></button><button class="btn ${hi.starNeed && hi.shards >= hi.starNeed ? '' : 'off'}" data-hstar="${id}">升星<small>${hi.starNeed ? `碎片 ${hi.starNeed}` : '滿星'}</small></button></div>
        ${a && typeof a.heroLevelUp === 'function' ? '' : '<p class="kd-p warn">主程式尚未提供英雄升級功能</p>'}</div>`;
      return x;
    });
  }

  // ---------- 時尚學院 ----------
  let acadBr = 'econ';
  const TECH_IC = { income: 'crown', prodBasic: 'silk', prodRare: 'ore', build: 'hammer', research: 'flask', freeMin: 'spd', train: 'guard', atk: 'sword', def: 'power', hp: 'heart', hospital: 'heart', gather: 'basket', load: 'car', march: 'map', m3_moves: 'star', arena_atk: 'crown', royale_armor: 'power', cards_rebate: 'gift', mahjong_hint: 'book' };
  function techEff(t, lv) { if (t.br === 'play') return `${t.desc} ${lv * t.per}${t.unit}`; if (t.eff === 'freeMin') return `免費加速 +${lv * t.per} 分鐘`; return `${G_NAME[t.eff] || t.eff} +${Math.round(lv * t.per * 100)}%`; }
  function openAcad(br) {
    snd('click');
    if (br) acadBr = br;
    return openPanel('acad', '時尚學院', 'Académie de Mode', () => {
      const s = ks(), al = lvl(s, 'acad');
      let h = '';
      if (!al) return `<div class="kd-empty">${ic('book', 'big')}<b>還沒有時尚學院</b><p>本館 Lv.5 之後就能建造學院。</p><button class="btn" data-gob="acad">前往建造</button></div>`;
      h += s.rsch ? jobCard({ k: 'rsch' }, `研究中：${TECHM[s.rsch.id].name} Lv.${s.rsch.to}`, s.rsch) : `<div class="kd-idle">${ic('flask')}<span>研究室閒置中</span><button class="btn goldb" data-techrec>一鍵研究推薦</button></div>`;
      h += `<div class="kd-brs">${BRANCH.map(b => `<button class="${b.id === acadBr ? 'on' : ''}" data-br="${b.id}" style="--c:${b.c}">${b.name}</button>`).join('')}</div>`;
      const list = TECH.filter(t => t.br === acadBr), br = BRANCH.find(b => b.id === acadBr);
      let lines = '';
      const RH = 132, y0 = r => r * RH + 8;
      for (const t of list) if (t.pre) { const p = TECHM[t.pre[0]], a = y0(p.row) + 100, b = y0(t.row) - 2, xa = p.col * 33.3 + 16.7, xb = t.col * 33.3 + 16.7; lines += `<path d="M${xa} ${a}C${xa} ${a + (b - a) * .6} ${xb} ${b - (b - a) * .6} ${xb} ${b}" stroke="${(s.tech[p.id] || 0) >= t.pre[1] ? br.c : '#e3cfd8'}" stroke-width="3" fill="none" stroke-dasharray="${(s.tech[p.id] || 0) >= t.pre[1] ? '0' : '5 5'}" vector-effect="non-scaling-stroke"/>`; }
      h += `<div class="kd-tree" style="--c:${br.c};height:${RH * 3 + 4}px"><svg class="kd-tlines" viewBox="0 0 100 ${RH * 3 + 4}" preserveAspectRatio="none">${lines}</svg>`;
      for (const t of list) {
        const lv = s.tech[t.id] || 0, blk = techBlock(s, t.id, coins()), maxed = lv >= t.max, lock = blk && ['pre', 'acad', 'noacad'].includes(blk.code), cur = s.rsch && s.rsch.id === t.id;
        h += `<button class="kd-tnode ${maxed ? 'max' : ''} ${lock ? 'lock' : ''} ${cur ? 'cur' : ''}" data-tech="${t.id}" style="left:${t.col * 33.3}%;top:${y0(t.row)}px"><span class="kd-tic">${ic(TECH_IC[t.eff] || 'flask')}</span><b>${t.name}</b><small>${lv}/${t.max}</small><span class="kd-tbar"><i style="width:${lv / t.max * 100}%"></i></span></button>`;
      }
      h += `</div><p class="kd-fine">${acadBr === 'play' ? '娛樂城科技會直接加成各個小遊戲（消消樂步數、對決攻擊、吃雞護甲、牌桌返水、麻將提示）。' : '研究越高級，需要的學院等級越高。'}</p>`;
      return h;
    });
  }
  function openTech(id) {
    snd('click');
    return openSheet('tech:' + id, () => {
      const s = ks(), t = TECHM[id], lv = s.tech[id] || 0, to = lv + 1, blk = techBlock(s, id, coins()), br = BRANCH.find(b => b.id === t.br);
      let h = `<div class="kd-sh-head"><div class="kd-sh-art troop" style="--c:${br.c}">${ic(TECH_IC[t.eff] || 'flask', 'big')}</div><div class="kd-sh-tt"><div class="eyebrow">${br.en}</div><h3>${t.name}</h3><div class="kd-lvrow"><span class="kd-lv">Lv.${lv}<small>/${t.max}</small></span></div><p>${techEff(t, Math.max(1, lv))}${lv ? '' : '（研究後）'}</p></div></div>`;
      if (lv >= t.max) return h + `<div class="kd-note gold">${ic('crown')}已經研究到頂了</div>`;
      if (s.rsch && s.rsch.id === id) return h + jobCard({ k: 'rsch' }, `研究中 → Lv.${s.rsch.to}`, s.rsch);
      const c = techCost(t, to), tm = techTime(s, t, to);
      h += `<div class="kd-sec"><h4>Lv.${to} 效果</h4><div class="kd-eff"><span>效果</span><b>${techEff(t, lv)}</b><i>→</i><b class="nx">${techEff(t, to)}</b></div></div>`;
      h += `<div class="kd-sec"><h4>研究條件</h4><div class="kd-reqs"><div class="kd-req ${lvl(s, 'acad') >= techAcadReq(t, to) ? 'ok' : ''}">${ic(lvl(s, 'acad') >= techAcadReq(t, to) ? 'check' : 'cross')}<span>時尚學院 Lv.${techAcadReq(t, to)}</span></div>${t.pre ? `<div class="kd-req ${(s.tech[t.pre[0]] || 0) >= t.pre[1] ? 'ok' : ''}">${ic((s.tech[t.pre[0]] || 0) >= t.pre[1] ? 'check' : 'cross')}<span>${TECHM[t.pre[0]].name} Lv.${t.pre[1]}</span></div>` : ''}</div>
        <div class="kd-costs"><span class="kd-cost ${coins() < c.gold ? 'lack' : ''}">${coinI()}${fmt(c.gold)}</span>${resLine(c, true)}<span class="kd-cost t">${ic('spd')}${dur(tm)}</span></div>`;
      const ok = !blk, gemN = gemCost(tm) + resGems(s, missingRes(s, c));
      h += `<div class="kd-acts">${blk && blk.code === 'busy' ? '<button class="btn ghost off">另一項研究進行中</button>' : `<button class="btn goldb ${ok ? '' : 'off'}" data-dotech="${id}">研究<small>${dur(tm)}</small></button>`}${!blk || blk.code === 'res' ? `<button class="btn gemb" data-techgem="${id}" data-n="${gemN}">立即完成<small>${gemI()}${gemN}</small></button>` : ''}</div></div>`;
      return h;
    });
  }
  function doTech(id, el, instant) {
    const s = ks(), t = TECHM[id], c = techCost(t, (s.tech[id] || 0) + 1);
    if (instant) { const miss = missingRes(s, c); for (const r of Object.keys(miss)) s.res[r] += miss[r]; }
    const blk = techBlock(s, id, coins());
    if (blk) { snd('err'); if (el) A().shake(el); toast(blk.code === 'res' ? '資源不足' : blk.code === 'gold' ? '金幣不足' : blk.code === 'busy' ? '學院正在研究別的科技' : blk.code === 'acad' ? `需要時尚學院 Lv.${blk.need}` : '還不能研究'); return; }
    if (!A().spendCoins(c.gold, el)) return;
    const j = beginResearch(s, id, now());
    if (instant) j.cut = j.dur; else { snd('beep', 880, 0.1, 'sine', 0.08); toast(`開始研究「${t.name}」`, 'gold'); }
    afterAction();
  }

  // ---------- 任務 ----------
  let questTab = 'main';
  const rwText = (s, rw) => {
    const p = [];
    for (const k of RES) if (rw[k]) p.push(`<span class="kd-rw">${ic(k)}${fmt(rw[k])}</span>`);
    const spd = (rw.spd || 0) + (rw.s5 || 0) * 5 + (rw.s60 || 0) * 60;
    if (spd) p.push(`<span class="kd-rw">${ic('spd')}${dur(spd * MIN)}</span>`);
    if (rw.gems) p.push(`<span class="kd-rw">${gemI()}${rw.gems}</span>`);
    if (rw.any) p.push(`<span class="kd-rw">${ic('star')}碎片×${rw.any}</span>`);
    if (rw.shard) for (const [id, n] of Object.entries(rw.shard)) p.push(`<span class="kd-rw">${ic('star')}${esc(heroInfo(id).name)}碎片×${n}</span>`);
    if (rw.stam) p.push(`<span class="kd-rw">${ic('stam')}精力+${rw.stam}</span>`);
    return p.join('');
  };
  function openQuests(tab) {
    snd('click');
    if (tab) questTab = tab;
    return openPanel('quests', '王國任務', 'Missions Royales', () => {
      const s = ks();
      let h = `<div class="kd-tabs2"><button class="${questTab === 'main' ? 'on' : ''}" data-qtab="main">主線章節${questDone(s) ? '<i class="kd-dot"></i>' : ''}</button><button class="${questTab === 'daily' ? 'on' : ''}" data-qtab="daily">每日任務${dailyClaimable(s) ? '<i class="kd-dot"></i>' : ''}</button></div>`;
      if (questTab === 'main') {
        const q = curQuest(s);
        if (!q) return h + `<div class="kd-empty">${ic('crown', 'big')}<b>主線全部完成！</b><p>妳已經是名媛王國的女王了。</p></div>`;
        const inCh = MAIN.filter(x => x.ch === q.ch), idx = inCh.indexOf(q);
        h += `<div class="kd-chap"><div class="eyebrow">Chapitre ${q.ch}</div><h3>第 ${q.ch} 章・${CHAPTERS[q.ch - 1] || ''}</h3><div class="kd-bar"><i style="width:${f1(idx / inCh.length * 100)}%"></i></div><small>章節進度 ${idx} / ${inCh.length}</small></div>`;
        const v = Math.min(q.n, qVal(s, q)), ok = v >= q.n;
        h += `<div class="kd-qbig ${ok ? 'ok' : ''}"><b>${q.t}</b><div class="kd-bar"><i style="width:${f1(v / q.n * 100)}%"></i></div><small>${fmt(v)} / ${fmt(q.n)}</small><div class="kd-rws">${rwText(s, q.rw)}</div>
          <div class="kd-acts">${ok ? '<button class="btn goldb" data-act="qclaim">領取獎勵</button>' : '<button class="btn" data-act="qgo">前往</button>'}${!ok && (q.k === 'ev' || q.k === 'playTech') ? '<button class="btn ghost" data-act="qskip">略過</button>' : ''}</div></div>`;
        h += `<div class="kd-qnext"><h4>接下來</h4>${MAIN.slice(s.qi + 1, s.qi + 5).map(x => `<div class="kd-qrow">${ic('scroll')}<span>${x.t}</span></div>`).join('')}</div>`;
      } else {
        const pts = dailyPts(s), maxP = DAILY.length * DAILY_PTS;
        h += `<div class="kd-dchest"><div class="kd-bar big"><i style="width:${f1(pts / maxP * 100)}%"></i></div>${DAILY_CHEST.map(c => `<button class="kd-chest ${s.day.chest[c.pts] ? 'opened' : pts >= c.pts ? 'ready' : ''}" data-chest="${c.pts}" style="left:${f1(c.pts / maxP * 100)}%">${ic('gift')}<small>${c.pts}</small></button>`).join('')}</div><p class="kd-fine">每完成一項 +${DAILY_PTS} 活躍度，集滿就能開寶箱。</p>`;
        h += DAILY.map(d => { const v = Math.min(d.n, s.day.c[d.k] || 0), done = s.day.done[d.id], ok = v >= d.n; return `<div class="kd-drow ${done ? 'done' : ''}"><div><b>${d.t}</b><div class="kd-bar"><i style="width:${f1(v / d.n * 100)}%"></i></div><small>${v}/${d.n}・活躍 +${DAILY_PTS}・${ic('spd')}5 分</small></div>${done ? '<span class="kd-done">已完成</span>' : ok ? `<button class="btn goldb" data-dclaim="${d.id}">領取</button>` : `<button class="btn ghost" data-dgo="${d.ui}">前往</button>`}</div>`; }).join('');
      }
      return h;
    });
  }
  function goQuest(go) {
    if (!go) return;
    closeAll();
    if (go.b) { setView('town'); focusBuilding(go.b); setTimeout(() => openBuilding(go.b), 260); return; }
    switch (go.ui) {
      case 'heroes': openHeroes(); break;
      case 'acad': if (lvl(ks(), 'acad')) openAcad(go.br); else { focusBuilding('acad'); openBuilding('acad'); } break;
      case 'train': case 'army': openArmy(); break;
      case 'camp': setView('map'); setTimeout(() => focusNode('camp'), 200); break;
      case 'gather': setView('map'); setTimeout(() => focusNode('res'), 200); break;
      case 'boss': openBoss(); break;
      case 'collect': collectEverything(); break;
      case 'upgrade': quickUpgrade(); break;
      case 'play': { const a = A(); if (go.game && a && typeof a.openGame === 'function') a.openGame(go.game); else if (a) a.go('play'); break; }
    }
  }

  // ---------- 部隊總覽 ----------
  function openArmy() {
    snd('click');
    return openPanel('army', '王國部隊', 'Armée Royale', () => {
      const s = ks(), t = now();
      let h = `<div class="kd-armyhead"><span>${ic('power', 'big')}</span><div><small>部隊戰力</small><b>${fmt(troopPower(s.troops))}</b></div><div><small>精力</small><b>${Math.floor(stamNow(s, t))}/${STAM.max}</b>${stamNow(s, t) < STAM.max ? `<em data-end="${t + stamNext(s, t)}">${clock(stamNext(s, t))}</em>` : ''}</div></div>`;
      for (const k of TYPES) {
        const bl = lvl(s, TROOP[k].b), j = s.train[k];
        h += `<div class="kd-tcard" style="--c:${TROOP[k].c}"><div class="kd-tc1">${ic(k, 'big')}<div><b>${TROOP[k].name}</b><small>${TROOP[k].tag}・克制${TROOP[TROOP[k].beats].name}</small></div><span class="kd-tn">${fmt(sum(s.troops[k]))}</span></div>
          <div class="kd-tiersm">${s.troops[k].map((n, i) => n ? `<span>T${i + 1} <b>${fmt(n)}</b></span>` : '').join('') || '<span class="none">還沒有部隊</span>'}</div>
          ${!bl ? `<div class="kd-acts"><button class="btn ghost" data-gob="${TROOP[k].b}">建造${BLD[TROOP[k].b].name}</button></div>` : j && j.done ? `<div class="kd-acts"><button class="btn goldb" data-claimtr="${k}">收下 ×${j.n}</button></div>` : j ? `<div class="kd-mjob"><span>訓練中 T${j.tier} ×${j.n}</span><em data-end="${jobEnd(j)}">${clock(jobLeft(j, t))}</em><div class="kd-bar"><i data-pg="${j.t0},${jobEnd(j)}"></i></div></div>` : `<div class="kd-acts"><button class="btn" data-train="${k}">訓練</button></div>`}</div>`;
      }
      h += `<div class="kd-sec"><h4>傷兵</h4><div class="kd-eff"><span>SPA 療養院</span><b>${woundedCount(s)} / ${hospCap(s)}</b></div><div class="kd-acts"><button class="btn ghost" data-gob="spa">前往治療</button></div></div>`;
      if (s.marches.length) h += `<div class="kd-sec"><h4>出征中的隊伍</h4>${s.marches.map(mm => { const hi = mm.hero ? heroInfo(mm.hero) : null; return `<div class="kd-mrow">${hi ? `<img src="${hi.face('neutral')}" alt="">` : ic('sword')}<span><b>${mm.kind === 'gather' ? '採集' : mm.kind === 'boss' ? '討伐黃牛王' : '攻打據點'}</b><small>${marchLabel(mm, t)}・${fmt(troopCount(mm.units))} 名</small></span>${mm.st !== 'back' ? `<button class="kd-mini" data-recall="${mm.id}">召回</button>` : ''}</div>`; }).join('')}</div>`;
      return h;
    });
  }

  // ---------- 黃牛王 ----------
  const bullArt = (sz = 1) => `<svg class="kd-bull" viewBox="0 0 200 180" aria-hidden="true"><defs><radialGradient id="kdBullG" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#f0b88a"/><stop offset="1" stop-color="#b8743f"/></radialGradient></defs>
    <ellipse cx="100" cy="168" rx="70" ry="10" fill="#3b1530" opacity=".18"/>
    <path d="M44 60C20 50 8 28 16 14c8 18 22 24 40 26M156 60c24-10 36-32 28-46-8 18-22 24-40 26" fill="#fff8ef" stroke="#b08a4c" stroke-width="2"/>
    <path d="M40 130c0-50 26-84 60-84s60 34 60 84c0 22-26 36-60 36s-60-14-60-36z" fill="url(#kdBullG)" stroke="#7a4a26" stroke-width="2"/>
    <path d="M34 72c-14-2-22 8-16 16 8 8 18 2 22-4M166 72c14-2 22 8 16 16-8 8-18 2-22-4" fill="#e9a878" stroke="#7a4a26" stroke-width="2"/>
    <rect x="46" y="78" width="108" height="26" rx="12" fill="#2b2033"/><rect x="52" y="82" width="42" height="18" rx="8" fill="#3d3150"/><rect x="106" y="82" width="42" height="18" rx="8" fill="#3d3150"/><path d="M58 86l14 10M112 86l14 10" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>
    <ellipse cx="100" cy="132" rx="36" ry="24" fill="#f6c3ae" stroke="#7a4a26" stroke-width="2"/><ellipse cx="88" cy="132" rx="5" ry="7" fill="#7a3a2a"/><ellipse cx="112" cy="132" rx="5" ry="7" fill="#7a3a2a"/>
    <path d="M70 154q30 18 60 0" stroke="#ffd36b" stroke-width="6" fill="none"/><circle cx="100" cy="162" r="9" fill="#ffd36b" stroke="#a97b30" stroke-width="2"/><text x="100" y="166" text-anchor="middle" font-size="10" font-weight="700" fill="#7a5a1e">$</text>
    <path d="M60 46l10-26 14 18 16-24 16 24 14-18 10 26z" fill="#ffd36b" stroke="#a97b30" stroke-width="2"/><circle cx="100" cy="28" r="4" fill="#ff6f9f"/>
    <g transform="rotate(-18 160 120)"><rect x="150" y="104" width="34" height="20" rx="3" fill="#fff" stroke="#d6457a" stroke-width="2"/><path d="M158 110h18M158 116h12" stroke="#d6457a" stroke-width="2"/></g></svg>`;
  function openBoss() {
    snd('click');
    const s0 = ks(); ensureBoss(s0, now());
    return openPanel('boss', BOSS_NAME, 'Roi des Revendeurs', () => {
      const s = ks(), t = now(), B = ensureBoss(s, t), rk = bossRank(B, t), left = 3 + B.extra - B.hits;
      const end = B.t0 + DAY;
      let h = `<div class="kd-bosshero">${bullArt()}<div class="kd-bossinfo"><div class="eyebrow" style="color:#ffe6a6">Événement du jour</div><h3>${BOSS_NAME}</h3><p>黃牛黨的老大把限量包全都搶光了！和閨蜜們一起把牠打回原形！</p><small>今天剩 <b data-end="${end}">${clock(end - t)}</b></small></div></div>`;
      h += `<div class="kd-bosshp"><div class="kd-bar big boss"><i style="width:${f1(rk.left / B.hp * 100)}%"></i></div><span>聯盟總傷害 ${fmt(rk.total)} / ${fmt(B.hp)}${rk.left <= 0 ? '・<b>已討伐！</b>' : ''}</span></div>`;
      h += `<div class="kd-bossme"><div><small>我的傷害</small><b>${fmt(B.dmg)}</b></div><div><small>排名</small><b>#${rk.rank}</b></div><div><small>今日出擊</small><b>${left}</b></div></div>`;
      h += `<div class="kd-acts"><button class="btn goldb ${left > 0 ? '' : 'off'}" data-bossgo>${ic('sword')}出擊討伐</button>${B.extra < 3 ? `<button class="btn gemb" data-bossbuy data-n="10">加買一次<small>${gemI()}10</small></button>` : ''}</div>`;
      if (B.prev && !B.prev.claimed) h += `<div class="kd-prev">${ic('gift')}<span>昨日排名 <b>#${B.prev.rank}</b>（傷害 ${fmt(B.prev.dmg)}）</span><button class="btn goldb" data-bossprev>領取</button></div>`;
      h += `<div class="kd-sec"><h4>個人傷害獎勵</h4><div class="kd-ms">${bossMilestones(B).map(m => { const ok = B.dmg >= m.need, got = B.ms[m.i]; return `<button class="kd-msb ${got ? 'got' : ok ? 'ready' : ''}" data-bossms="${m.i}">${ic('gift')}<b>${fmt(m.need)}</b><small>${got ? '已領取' : ok ? '可領取' : '傷害達標'}</small></button>`; }).join('')}</div></div>`;
      h += `<div class="kd-sec"><h4>傷害排行</h4>${rk.rows.map((r, i) => `<div class="kd-rank ${r.me ? 'me' : ''}"><span class="kd-rn">${i + 1}</span><span class="kd-ra" style="--h:${r.me ? 0 : (r.face || 1) * 55}deg">${r.me ? ic('crown') : esc(r.name[0])}</span><b>${r.me ? esc(A().playerName || '妳') : esc(r.name)}</b><span class="kd-rb2"><i style="width:${f1(r.dmg / Math.max(1, rk.rows[0].dmg) * 100)}%"></i></span><em>${fmt(r.dmg)}</em></div>`).join('')}</div>`;
      h += `<p class="kd-fine">每天 3 次免費出擊，閨蜜們整天都會陸續出手。排名獎勵隔天領取：第 1 名 ${gemI()}10、前 3 名 ${gemI()}5。</p>`;
      return h;
    });
  }

  // ---------- 戰報 ----------
  function openReports() {
    snd('click');
    return openPanel('reports', '戰報', 'Rapports', () => {
      const s = ks();
      if (!s.reports.length) return `<div class="kd-empty">${ic('report', 'big')}<b>還沒有戰報</b><p>到地圖上攻打黃牛黨據點吧！</p><button class="btn" data-act="map">打開地圖</button></div>`;
      return s.reports.map(r => { const hi = r.hero ? heroInfo(r.hero) : null; return `<button class="kd-reprow ${r.read ? '' : 'new'} ${r.kind === 'boss' ? 'boss' : r.win ? 'win' : 'lose'}" data-rep="${r.id}">${hi ? `<img src="${hi.face(r.win ? 'joy' : 'sad')}" alt="">` : ic('sword')}<span><b>${r.kind === 'boss' ? `討伐${BOSS_NAME}` : `黃牛黨據點 Lv.${r.lv}`}</b><small>${r.kind === 'boss' ? `造成 ${fmt(r.dmg)} 傷害・第 ${r.rank} 名` : r.win ? '勝利' : '撤退'}・${new Date(r.t).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</small></span>${r.kind === 'camp' && r.win ? stars(r.stars, 3) : ''}</button>`; }).join('');
    });
  }
  let repQueue = [];
  function showReport(rep) {
    if (!root) return;
    if ($('.kd-report')) { if (!repQueue.includes(rep)) repQueue.push(rep); return; }
    rep.read = true;
    const hi = rep.hero ? heroInfo(rep.hero) : heroInfo('erika'), boss = rep.kind === 'boss', win = boss || rep.win;
    const el = document.createElement('div');
    el.className = `kd-report ${win ? 'win' : 'lose'} ${boss ? 'boss' : ''}`;
    const tbl = (u0, lost) => TYPES.map(k => { const n = sum(u0[k]); return n ? `<div class="kd-rt">${ic(k)}<span>${fmt(n)}</span><em>-${fmt(lost[k] || 0)}</em></div>` : ''; }).join('');
    const loot = rep.loot ? rwText(ks(), rep.loot) : '';
    el.innerHTML = `<div class="kd-rcard"><div class="kd-rbanner"><span>${boss ? '討伐完成' : win ? '勝利' : '撤退'}</span><small>${boss ? 'COUP CRITIQUE' : win ? 'VICTOIRE' : 'RETRAITE'}</small></div>
      ${!boss && win ? `<div class="kd-rstars">${[1, 2, 3].map(i => `<i class="${i <= rep.stars ? 'on' : ''}" style="animation-delay:${.3 + i * .18}s">${ic(i <= rep.stars ? 'star' : 'starO')}</i>`).join('')}</div>` : ''}
      <div class="kd-rvs"><div class="kd-rside"><img src="${hi.face(win ? 'joy' : 'sad')}" alt=""><b>${esc(hi.name)}</b><div class="kd-bar"><i class="a" style="width:100%"></i></div>${tbl(rep.before, rep.aLost)}</div>
        <span class="kd-vs">VS</span>
        <div class="kd-rside foe">${boss ? bullArt() : `<div class="kd-camp-ic">${campIcon()}</div>`}<b>${boss ? BOSS_NAME : `黃牛黨 Lv.${rep.lv}`}</b><div class="kd-bar"><i class="d" style="width:100%"></i></div>${boss ? `<div class="kd-rt dmg">${ic('sword')}<span>${fmt(rep.dmg)}</span></div>` : tbl(rep.dArmy, rep.dLost)}</div></div>
      <p class="kd-rsay">「${boss ? `打出 ${fmt(rep.dmg)} 點傷害！目前第 ${rep.rank} 名～` : win ? (rep.first ? '第一次拿下這一級，閨蜜們都在尖叫！' : '黃牛黨退散～限量包都拿回來了！') : '對方人好多…先回去練兵再來！'}」</p>
      ${loot ? `<div class="kd-rloot"><small>${win ? '戰利品（部隊回城後入帳）' : ''}</small><div class="kd-rws">${loot}</div></div>` : ''}
      ${rep.first ? '<div class="kd-first">首次通關獎勵！</div>' : ''}
      <div class="kd-acts"><button class="btn ghost" data-rclose>確定</button>${!boss && rep.win && rep.lv < MAX_LV ? '<button class="btn goldb" data-rnext>挑戰下一級</button>' : !boss && !rep.win ? '<button class="btn" data-rarmy>去練兵</button>' : ''}</div></div>`;
    $('.kd-layer').appendChild(el);
    const ba = el.querySelector('.kd-bar i.a'), bd = el.querySelector('.kd-bar i.d');
    if (rep.log && rep.log.length && !RM) {
      let i = 0;
      const step = () => { if (!el.isConnected || i >= rep.log.length) return; const [a, d] = boss ? [1 - i * 0.04, Math.max(0, 1 - (i + 1) / rep.log.length)] : rep.log[i]; ba.style.width = f1(a * 100) + '%'; bd.style.width = f1(d * 100) + '%'; snd('beep', 300 + i * 40, 0.05, 'triangle', 0.04); i++; setTimeout(step, 180); };
      setTimeout(step, 350);
    } else if (rep.log && rep.log.length) { const l = rep.log[rep.log.length - 1]; ba.style.width = f1((boss ? 0.8 : l[0]) * 100) + '%'; bd.style.width = f1((boss ? 0 : l[1]) * 100) + '%'; }
    if (win) { snd(boss ? 'level' : 'ssr'); setTimeout(() => { try { const [x, y] = centerOf(el.querySelector('.kd-rbanner')); A().fx.burst(x, y, 36); } catch (e) { /* 略 */ } }, 300); } else snd('err');
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      snd('click');
      const close = () => { el.classList.add('out'); setTimeout(() => { el.remove(); const nx = repQueue.shift(); if (nx) showReport(nx); }, 200); };
      if (b.dataset.rclose !== undefined) close();
      if (b.dataset.rnext !== undefined) { close(); setView('map'); setTimeout(() => focusNode('camp', rep.lv + 1), 250); }
      if (b.dataset.rarmy !== undefined) { close(); openArmy(); }
    });
    dots();
  }
  const campIcon = () => `<svg viewBox="0 0 60 50" aria-hidden="true"><path d="M8 44L30 8l22 36z" fill="#6b3f96" stroke="#3b1530" stroke-width="1.4"/><path d="M30 8l-6 36M30 8l6 36" stroke="#a98ad6" stroke-width="3"/><path d="M24 44q6-12 12 0z" fill="#2b2033"/><path d="M30 8V0" stroke="#3b1530" stroke-width="1.4"/><path d="M30 1l12 3-12 4z" fill="#ffd36b"/></svg>`;

  // ---------- 管家、第二隊列、資源說明、戰力說明 ----------
  function openButler() {
    snd('click');
    return openSheet('butler', () => {
      const s = ks(), t = now(), on = s.butler > t;
      return `<div class="kd-sh-head"><div class="kd-sh-art troop" style="--c:#3b3550">${ic('butler', 'big')}</div><div class="kd-sh-tt"><div class="eyebrow">Majordome</div><h3>王國管家</h3><p>交給史利吧！管家會自動收成、收兵、升級建議建築、訓練部隊、治療傷兵，還會用掉免費加速。</p></div></div>
        ${on ? `<div class="kd-note gold">${ic('check')}管家值班中，剩 <b data-end="${s.butler}">${clock(s.butler - t)}</b></div>` : ''}
        <div class="kd-sec"><h4>托管內容</h4><div class="kd-eff"><span>自動收成資源與部隊</span><b>✓</b></div><div class="kd-eff"><span>隊列空了就升級建議建築</span><b>✓</b></div><div class="kd-eff"><span>訓練所空了就訓練部隊</span><b>✓</b></div><div class="kd-eff"><span>治療傷兵・免費加速</span><b>✓</b></div></div>
        <div class="kd-acts"><button class="btn gemb" data-butlerbuy data-n="${BUTLER.gems}">${on ? '延長' : '啟用'} 8 小時<small>${gemI()}${BUTLER.gems}</small></button></div>`;
    });
  }
  function openQueues() {
    snd('click');
    return openSheet('queues', () => {
      const s = ks(), m = month();
      return `<div class="kd-sh-head"><div class="kd-sh-art troop" style="--c:#c9a35b">${ic('hammer', 'big')}</div><div class="kd-sh-tt"><div class="eyebrow">Chantiers</div><h3>建築隊列</h3><p>同時進行兩項工程，王國長得快一倍！</p></div></div>
        <div class="kd-sec">${s.q.map((j, i) => j ? jobCard({ k: 'q', i }, `${BLD[j.b].name} → Lv.${j.to}`, j) : `<div class="kd-idle">${ic(i < queueCount(s, m) ? 'hammer' : 'lock')}<span>${i < queueCount(s, m) ? '隊列閒置' : '第二隊列未解鎖'}</span>${i < queueCount(s, m) ? '<button class="btn goldb" data-act="quickup">一鍵升級建議</button>' : ''}</div>`).join('')}</div>
        ${s.q2 ? '<div class="kd-note gold">第二隊列已永久解鎖</div>' : `<div class="kd-sec"><h4>解鎖第二隊列</h4><p class="kd-p">貴婦月卡期間免費開放${m ? '（月卡生效中！）' : ''}，或用粉鑽永久解鎖。</p><div class="kd-acts"><button class="btn gemb" data-q2 data-n="${QUEUE2_GEMS}">永久解鎖<small>${gemI()}${QUEUE2_GEMS}</small></button>${m ? '' : '<button class="btn ghost" data-shop>看看月卡</button>'}</div></div>`}`;
    });
  }
  function openResInfo(k) {
    snd('click');
    return openSheet('res:' + k, () => {
      const s = ks(), b = bonus(s), r = prodRate(s, k, b);
      return `<div class="kd-sh-head"><div class="kd-sh-art troop" style="--c:${RES_INFO[k].c2}">${ic(k, 'big')}</div><div class="kd-sh-tt"><div class="eyebrow">Ressource</div><h3>${RES_INFO[k].name}</h3><p>庫存 <b>${fmt(s.res[k])}</b>・每小時 +${fmt(r)}</p></div></div>
        <div class="kd-sec"><h4>取得方式</h4><div class="kd-eff"><span>${BLD[k].name}生產（離線最多 12 小時）</span><b>Lv.${lvl(s, k)}</b></div><div class="kd-eff"><span>地圖上的${NODE_NAME[k]}採集</span><b>${ic('map')}</b></div><div class="kd-eff"><span>擊敗黃牛黨據點、任務、其他玩法掉落</span><b>${ic('gift')}</b></div></div>
        <div class="kd-acts"><button class="btn" data-gob="${k}">前往${BLD[k].name}</button><button class="btn ghost" data-act="map">去採集</button></div>`;
    });
  }
  function openPower() {
    snd('click');
    return openSheet('power', () => {
      const s = ks(), p = incomeParts(s), b = bonus(s);
      return `<div class="kd-sh-head"><div class="kd-sh-art troop" style="--c:#7d4bc4">${ic('power', 'big')}</div><div class="kd-sh-tt"><div class="eyebrow">Puissance</div><h3>王國戰力 ${fmt(power(s))}</h3><p>王國越強，整間 ERIKA 百貨賺越多！</p></div></div>
        <div class="kd-sec"><h4>百貨收益加成 ×${p.total.toFixed(2)}</h4><div class="kd-eff"><span>百貨本館 Lv.${lvl(s, 'town')}</span><b>×${p.town.toFixed(2)}</b></div><div class="kd-eff"><span>時尚學院經濟科技</span><b>+${f1(p.tech * 100)}%</b></div><div class="kd-eff"><span>英雄光環（${HEROES.filter(h => h.g === 'income').map(h => esc(heroInfo(h.id).name)).join('、')}）</span><b>+${f1(p.hero * 100)}%</b></div></div>
        <div class="kd-sec"><h4>王國加成</h4><div class="kd-eff"><span>建造速度</span><b>+${f1(b.build * 100)}%</b></div><div class="kd-eff"><span>研究速度</span><b>+${f1(b.research * 100)}%</b></div><div class="kd-eff"><span>絲綢／香料產量</span><b>+${f1(b.prodBasic * 100)}%</b></div><div class="kd-eff"><span>全軍攻擊（含時尚魅力）</span><b>+${f1((b.atk + fashAtk()) * 100)}%</b></div><div class="kd-eff"><span>全軍防禦</span><b>+${f1(b.def * 100)}%</b></div></div>
        <div class="kd-sec"><h4>娛樂城加成</h4>${PERKS.map(k => { const t = TECH.find(x => x.eff === k); return `<div class="kd-eff"><span>${t.desc}</span><b>${perk(s, k)}${t.unit}</b></div>`; }).join('')}</div>`;
    });
  }

  // ---------- 開場與教學 ----------
  function intro() {
    const s = ks(); if (!s || s.tut.intro) return;
    s.tut.intro = 1;
    const hi = heroInfo('erika');
    const el = document.createElement('div');
    el.className = 'kd-intro';
    el.innerHTML = `<div class="kd-irays"></div><img class="kd-iart" src="${hi.full}" alt=""><div class="kd-itxt"><div class="eyebrow" style="color:#ffe6a6">Royaume des Mondaines</div><h1>名媛王國</h1><p>蓋出最華麗的城鎮、培養名媛英雄、把黃牛黨趕出王國！<br>王國越強，整間 ERIKA 百貨的收益就越高。</p>
      <div class="kd-ipts"><span>${ic('town')}升級本館・解鎖百貨樓層</span><span>${ic('crown')}英雄光環・收益加成</span><span>${ic('bull')}每日討伐黃牛王</span></div><button class="btn goldb wide" data-istart>開始建設王國</button></div>`;
    $('.kd-layer').appendChild(el);
    snd('level');
    el.querySelector('[data-istart]').addEventListener('click', () => { snd('click'); el.classList.add('out'); setTimeout(() => { el.remove(); guide(); }, 400); });
  }
  function guide() {
    const s = ks(); if (!s || s.tut.guide) return;
    s.tut.guide = 1;
    const el = document.createElement('div');
    el.className = 'kd-guide';
    el.innerHTML = `<img src="${heroInfo('fumi').face('joy')}" alt=""><div><b>${esc(heroInfo('fumi').name)}</b><p>夫人，跟著下方的<b>任務</b>一步一步做就好！點「前往」我會帶您到該去的地方。</p></div>`;
    $('.kd-view').appendChild(el);
    const off = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
    el.addEventListener('click', off); setTimeout(off, 7000);
  }

  // ---------- 4i. 王國地圖 ----------
  let mapGround = '', mapSeed = 0, mapSig = '', mapRaf = 0;
  function mapGroundSVG(seed) {
    const rand = seeded(seed), W2 = MAP.w, H2 = MAP.h, [hx, hy] = MAP.home;
    let s = `<defs><linearGradient id="kdMeadow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eaf5d6"/><stop offset=".5" stop-color="#dcefc6"/><stop offset="1" stop-color="#cfe6b8"/></linearGradient><radialGradient id="kdHill" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#e6f4d2"/><stop offset="1" stop-color="#b9d9a2"/></radialGradient><radialGradient id="kdFlowerF" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd9e6"/><stop offset="1" stop-color="#ffd9e6" stop-opacity="0"/></radialGradient></defs>`;
    s += `<rect width="${W2}" height="${H2}" fill="url(#kdMeadow)"/>`;
    for (let i = 0; i < 40; i++) { const x = rand() * W2, y = rand() * H2, r = 60 + rand() * 140; s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r)}" ry="${f1(r * .6)}" fill="${rand() < .3 ? 'url(#kdFlowerF)' : rand() < .5 ? '#eef8df' : '#cfe7b6'}" opacity="${f1(.4 + rand() * .4)}"/>`; }
    // 河流
    const rv = `M-20 ${f1(240 + rand() * 120)}C${f1(300 + rand() * 100)} ${f1(380 + rand() * 80)} ${f1(420 + rand() * 80)} ${f1(160 + rand() * 80)} ${f1(700 + rand() * 60)} ${f1(330 + rand() * 60)}S${f1(1120 + rand() * 80)} ${f1(640 + rand() * 80)} ${W2 + 20} ${f1(560 + rand() * 120)}`;
    s += `<path d="${rv}" stroke="#bfe6ee" stroke-width="54" fill="none" stroke-linecap="round"/><path d="${rv}" stroke="#a5dbe6" stroke-width="40" fill="none"/><path d="${rv}" stroke="#d9f3f7" stroke-width="5" fill="none" stroke-dasharray="14 26" class="kd-flow"/>`;
    // 湖
    const lx = 260 + rand() * 120, ly = 1150 + rand() * 120;
    s += `<ellipse cx="${f1(lx)}" cy="${f1(ly)}" rx="150" ry="80" fill="#f6ecd9"/><ellipse cx="${f1(lx)}" cy="${f1(ly)}" rx="138" ry="70" fill="url(#kdPool)"/><path d="M${f1(lx - 60)} ${f1(ly)}q12 -6 24 0t24 0M${f1(lx + 10)} ${f1(ly + 24)}q12 -6 24 0" stroke="#fff" fill="none" opacity=".7"/>`;
    // 道路
    const roads = [[MAP.boss[0], MAP.boss[1]], [80, 700], [W2 - 60, 900], [700, H2 - 60], [500, 80], [1250, 1300]];
    for (const [ex, ey] of roads) { const mx = (hx + ex) / 2 + (rand() - .5) * 180, my = (hy + ey) / 2 + (rand() - .5) * 180; const d = `M${hx} ${hy}Q${f1(mx)} ${f1(my)} ${ex} ${ey}`; s += `<path d="${d}" stroke="#efdcc2" stroke-width="22" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#f8eedd" stroke-width="16" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#e2c9ad" stroke-width="1.6" fill="none" stroke-dasharray="6 9"/>`; }
    // 丘陵
    for (let i = 0; i < 9; i++) { const x = rand() * W2, y = rand() * H2; if (Math.hypot(x - hx, y - hy) < 260) continue; const r = 70 + rand() * 70; s += `<ellipse cx="${f1(x + 10)}" cy="${f1(y + 14)}" rx="${f1(r)}" ry="${f1(r * .45)}" fill="#5a2740" opacity=".06"/><path d="M${f1(x - r)} ${f1(y + 10)}Q${f1(x - r * .3)} ${f1(y - r * .7)} ${f1(x)} ${f1(y - r * .55)}T${f1(x + r)} ${f1(y + 10)}Z" fill="url(#kdHill)"/>`; }
    // 森林
    const trees = [];
    for (let c = 0; c < 22; c++) { const cx = rand() * W2, cy = rand() * H2; if (Math.hypot(cx - hx, cy - hy) < 230 || Math.hypot(cx - MAP.boss[0], cy - MAP.boss[1]) < 160) continue; const n = 4 + Math.floor(rand() * 9), kind = rand() < .35 ? 'cherry' : rand() < .5 ? 'cypress' : 'round'; for (let i = 0; i < n; i++) trees.push([cx + (rand() - .5) * 120, cy + (rand() - .5) * 70, kind, .8 + rand() * .5]); }
    trees.sort((a, b) => a[1] - b[1]);
    for (const [x, y, k, z] of trees) s += treeSVG(x, y, k, z);
    for (let i = 0; i < 260; i++) { const x = rand() * W2, y = rand() * H2; s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(1.4 + rand() * 1.6)}" fill="${['#ff9cbf', '#fff', '#ffd166', '#c9b6f2'][Math.floor(rand() * 4)]}"/>`; }
    // 風車小屋
    for (let i = 0; i < 3; i++) { const x = 150 + rand() * 1200, y = 150 + rand() * 1200; if (Math.hypot(x - hx, y - hy) < 300) continue; s += `<g transform="translate(${f1(x)} ${f1(y)})">${isoFaces(0, 0, 12, 20, 'silk', '', winR(4, 6, 5, 6), true)}${roofHip(0, 0, 12, 20, 14, 3, PAL.silk.roof, '#fff')}<g class="kd-mill" style="transform-origin:${f1(x)}px ${f1(y - 24)}px"></g><g transform="translate(0 -26)"><g class="kd-spin"><path d="M0 0L-3 -24h6zM0 0L24 -3v6zM0 0L3 24h-6zM0 0L-24 3v-6z" fill="#fff" stroke="#c9a35b" stroke-width=".8"/></g><circle r="2.4" fill="#c9a35b"/></g></g>`; }
    return s;
  }
  function homeSVG(s) {
    const [x, y] = MAP.home, t = Math.max(0, tierOf(lvl(s, 'town')));
    let h = `<ellipse cx="${x}" cy="${y + 26}" rx="120" ry="58" fill="#f3e4d0" stroke="#e2c9ad" stroke-width="3"/><ellipse cx="${x}" cy="${y + 26}" rx="104" ry="48" fill="url(#kdTilesP)"/>`;
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; h += `<circle cx="${f1(x + Math.cos(a) * 116)}" cy="${f1(y + 26 + Math.sin(a) * 54)}" r="7" fill="url(#kdLeafD)"/>`; }
    h += `<g transform="translate(${x} ${y + 20}) scale(.62)">${bArt('town', Math.max(1, lvl(s, 'town')), 0, 0, false).svg}</g>`;
    return `<g class="kd-home" data-home>${h}</g>`;
  }
  function bossNodeSVG() {
    const [x, y] = MAP.boss;
    return `<g class="kd-bossnode" data-bossnode><ellipse cx="${x}" cy="${y + 30}" rx="96" ry="44" fill="#3b1530" opacity=".12"/>${isoFaces(x, y + 20, 78, 14, 'pap', '', '', true)}<path d="M${x - 70} ${y + 18}L${x - 90} ${y - 120}M${x + 70} ${y + 18}L${x + 90} ${y - 120}" stroke="#4a3a52" stroke-width="3"/><path d="M${x - 92} ${y - 122}l-6 -10h14z M${x + 92} ${y - 122}l-6 -10h14z" fill="#4a3a52"/><path d="M${x - 90} ${y - 116}L${x - 30} ${y + 20}L${x - 120} ${y + 20}Z" fill="#fff6c8" opacity=".18"/><path d="M${x + 90} ${y - 116}L${x + 30} ${y + 20}L${x + 120} ${y + 20}Z" fill="#fff6c8" opacity=".18"/><g transform="translate(${x - 60} ${y - 98}) scale(.6)"><g class="kd-bob">${bullArt().replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g></g></g>`;
  }
  function nodeSVG(n, busy) {
    const x = n.x, y = n.y;
    let h = `<ellipse cx="${x}" cy="${y + 6}" rx="34" ry="14" fill="#3b1530" opacity=".1"/>`;
    if (n.kind === 'camp') {
      const big = n.lv >= 15;
      h += `<ellipse cx="${x}" cy="${y + 4}" rx="30" ry="12" fill="#e7d6c8"/><path d="M${x - 24} ${y + 4}L${x} ${y - 34}l24 38z" fill="${big ? '#4a2a72' : '#6b3f96'}" stroke="#3b1530" stroke-width="1"/><path d="M${x} ${y - 34}l-7 38M${x} ${y - 34}l7 38" stroke="#a98ad6" stroke-width="3"/><path d="M${x - 6} ${y + 4}q6 -14 12 0z" fill="#2b2033"/><path d="M${x} ${y - 34}v-14" stroke="#3b1530" stroke-width="1.4"/><path class="kd-flag" d="M${x} ${y - 47}l14 3.5 -14 4z" fill="#ffd36b"/>`;
      h += `<g transform="translate(${x + 22} ${y - 6})"><rect x="-7" y="-5" width="14" height="10" rx="2" fill="#fff" stroke="#d6457a"/><path d="M-3 -1h6M-3 2h4" stroke="#d6457a" stroke-width="1.2"/></g>`;
      if (big) h += `<path d="M${x - 30} ${y + 4}L${x - 34} ${y - 14}M${x + 30} ${y + 4}l4 -18" stroke="#3b1530" stroke-width="1.4"/><path class="kd-flag" d="M${x - 34} ${y - 14}l-10 2.5 10 3z" fill="#d6457a"/>`;
    } else {
      const c = { silk: ['#f8b9d0', '#fff'], spice: ['#f0a35e', '#ffd166'], ore: ['#9cc2f4', '#e3efff'], leaf: ['#e2bd6a', '#fff3c4'] }[n.type];
      h += `<ellipse cx="${x}" cy="${y + 4}" rx="30" ry="12" fill="#e9f2d8" stroke="#cfe0b8"/>`;
      if (n.type === 'silk') for (const [dx, dy] of [[-14, 0], [12, -2], [0, 6], [-2, -8]]) h += `<circle cx="${x + dx}" cy="${y + dy - 8}" r="10" fill="url(#kdLeaf)"/><ellipse cx="${x + dx + 3}" cy="${y + dy - 10}" rx="3" ry="2" fill="#fff"/>`;
      if (n.type === 'spice') for (const [dx, dy, cc] of [[-14, 0, '#e8823e'], [0, 4, '#d9b37a'], [13, -1, '#c96d3d'], [-4, -10, '#ffd166']]) h += `<path d="M${x + dx - 7} ${y + dy}q-1 -12 7 -14 8 2 7 14z" fill="${cc}" stroke="#8a5a32" stroke-width=".8"/>`;
      if (n.type === 'ore' || n.type === 'leaf') for (const [dx, dy, k] of [[-12, 2, 1.3], [8, 0, 1.6], [0, -8, 1.1], [16, 4, .9]]) h += `<path d="M${x + dx} ${y + dy}l${-5 * k} ${-10 * k} ${5 * k} ${-8 * k} ${5 * k} ${8 * k} ${-5 * k} ${10 * k}z" fill="${c[0]}" stroke="${c[1]}" stroke-width=".8"/>`;
      h += `<path class="kd-tw" d="${star4(x + 16, y - 26, 4)}" fill="#fff"/>`;
    }
    if (busy) h += `<ellipse cx="${x}" cy="${y + 4}" rx="36" ry="15" fill="none" stroke="#ffd36b" stroke-width="2.4" stroke-dasharray="6 5" class="kd-spin2"/>`;
    return `<g class="kd-node" data-node="${n.id}">${h}<ellipse cx="${x}" cy="${y - 6}" rx="40" ry="34" fill="transparent"/></g>`;
  }
  function renderMap(force) {
    const s = ks(); if (!s || !root) return;
    if (!mapGround || mapSeed !== s.born) { mapSeed = s.born; mapGround = mapGroundSVG((s.born % 1e9) >>> 0); }
    const sig = s.map.nodes.map(n => n.id + ':' + n.lv + ':' + (n.left | 0)).join(',') + '|' + s.marches.map(m => m.id + m.st).join(',') + '|' + lvl(s, 'town');
    if (sig === mapSig && !force) { updateMap(); return; }
    mapSig = sig;
    const nodes = [...s.map.nodes].sort((a, b) => a.y - b.y);
    $('.kd-map .kd-svg').innerHTML = mapGround + bossNodeSVG() + nodes.map(n => nodeSVG(n, s.marches.some(m => m.node === n.id))).join('') + homeSVG(s) + '<g class="kd-mlines"></g>';
    let o = '';
    for (const n of nodes) o += `<div class="kd-ntag ${n.kind}" style="left:${n.x}px;top:${n.y + 16}px">${n.kind === 'camp' ? `<b>Lv.${n.lv}</b><span>黃牛黨</span>` : `<b>Lv.${n.lv}</b><span>${NODE_NAME[n.type]}</span>`}</div>`;
    o += `<div class="kd-ntag home" style="left:${MAP.home[0]}px;top:${MAP.home[1] + 70}px"><b>Lv.${lvl(s, 'town')}</b><span>${esc((A() && A().playerName) || 'Erika')}的王國</span></div>`;
    o += `<div class="kd-ntag boss" style="left:${MAP.boss[0]}px;top:${MAP.boss[1] + 46}px"><b>每日</b><span>${BOSS_NAME}</span></div>`;
    $('.kd-map .kd-ovl').innerHTML = o + '<div class="kd-marks"></div>';
    updateMap();
  }
  function marchPos(m, t) {
    const [hx, hy] = MAP.home;
    if (m.st === 'go') { const k = clamp((t - m.t0) / Math.max(1, m.t1 - m.t0), 0, 1); return [hx + (m.x - hx) * k, hy + (m.y - hy) * k]; }
    if (m.st === 'work') return [m.x, m.y];
    const k = clamp((t - m.t2) / Math.max(1, m.t3 - m.t2), 0, 1); return [m.x + (hx - m.x) * k, m.y + (hy - m.y) * k];
  }
  function updateMap() {
    const s = ks(); if (!s || !root || view !== 'map') return;
    const t = now(), g = $('.kd-map .kd-mlines'), mk = $('.kd-map .kd-marks'); if (!g || !mk) return;
    const sig = s.marches.map(m => m.id + m.st).join(',');
    if (g._sig !== sig) {
      g._sig = sig;
      g.innerHTML = s.marches.map(m => `<path d="M${MAP.home[0]} ${MAP.home[1]}L${m.x} ${m.y}" stroke="${m.kind === 'gather' ? '#2f9a72' : m.kind === 'boss' ? '#d6457a' : '#7d4bc4'}" stroke-width="3" stroke-dasharray="8 7" fill="none" class="kd-march-line ${m.st === 'back' ? 'back' : ''}" opacity=".8"/>`).join('');
      mk.innerHTML = s.marches.map(m => { const hi = m.hero ? heroInfo(m.hero) : null; return `<div class="kd-mk ${m.kind}" data-mk="${m.id}">${hi ? `<img src="${hi.face('neutral')}" alt="">` : ic('sword')}<em></em></div>`; }).join('');
    }
    for (const m of s.marches) {
      const el = mk.querySelector(`[data-mk="${m.id}"]`); if (!el) continue;
      const [x, y] = marchPos(m, t);
      el.style.transform = `translate(${f1(x)}px,${f1(y)}px)`;
      const txt = marchLabel(m, t), em = el.querySelector('em'); if (em.textContent !== txt) em.textContent = txt;
    }
  }
  function mapLoop() { mapRaf = 0; if (!visible || view !== 'map' || !root) return; updateMap(); mapRaf = requestAnimationFrame(mapLoop); }
  function setView(v) {
    if (!root) return;
    view = v; root.dataset.view = v;
    $('.kd-town').hidden = v !== 'town'; $('.kd-map').hidden = v !== 'map';
    const b = $('.kd-viewb'); if (b) b.innerHTML = v === 'map' ? `${ic('town')}<span>城鎮</span>` : `${ic('map')}<span>地圖</span>`;
    if (v === 'map') { renderMap(true); const P = PANS.map; if (P && !P.ready) { P.ready = true; P.center(MAP.home[0], MAP.home[1], 0.7); } else if (P) P.apply(); if (!mapRaf) mapRaf = requestAnimationFrame(mapLoop); }
    else { renderTown(); const P = PANS.town; if (P) P.apply(); }
  }
  function focusBuilding(id) {
    if (view !== 'town') setView('town');
    const [u, v] = BLD[id].pos, P = PANS.town; if (!P) return;
    P.center(tsx(u), tsy(v) - 40, Math.max(P.z, 0.85), true);
    const tag = $(`[data-tag="${id}"]`); if (tag) { tag.classList.remove('kd-hl'); void tag.offsetWidth; tag.classList.add('kd-hl'); setTimeout(() => tag.classList.remove('kd-hl'), 2600); }
  }
  function focusNode(kind, lvWant) {
    const s = ks(); fillMap(s);
    let n;
    if (kind === 'camp') { const cs = s.map.nodes.filter(x => x.kind === 'camp' && !s.marches.some(m => m.node === x.id)); n = cs.find(x => x.lv === lvWant) || cs.filter(x => x.lv <= s.map.maxCamp + 1).sort((a, b) => b.lv - a.lv)[0] || cs[0]; }
    else n = s.map.nodes.filter(x => x.kind === 'res' && !s.marches.some(m => m.node === x.id)).sort((a, b) => b.lv - a.lv)[0];
    if (!n) return;
    renderMap(true);
    const P = PANS.map; if (P) P.center(n.x, n.y, Math.max(P.z, 0.8), true);
    setTimeout(() => openNode(n.id), 380);
  }
  function openNode(id) {
    snd('click');
    return openSheet('node:' + id, () => {
      const s = ks(), n = nodeById(s, id);
      if (!n) return `<div class="kd-empty">${ic('map', 'big')}<b>這個地點已經消失了</b></div>`;
      const busy = s.marches.find(m => m.node === id);
      if (n.kind === 'camp') {
        const army = campArmy(n.lv), cp = campPower(n.lv), t = now();
        const best = autoUnits(s, marchCap(lvl(s, 'town'), heroOf('erika').lv)), mp = marchPower(s, best, bestHero(s, 'camp'));
        const lootP = campLoot(n.lv, seeded(n.id));
        return `<div class="kd-sh-head"><div class="kd-sh-art troop" style="--c:#6b3f96"><div class="kd-camp-ic">${campIcon()}</div></div><div class="kd-sh-tt"><div class="eyebrow">Repaire des Revendeurs</div><h3>黃牛黨據點 Lv.${n.lv}</h3><p>專門搶購限量包再高價轉賣的壞蛋！打贏可以搶回資源、英雄碎片與加速。</p></div></div>
          <div class="kd-sec"><h4>敵方部隊</h4><div class="kd-foes">${TYPES.map(k => { const i = army[k].findIndex(x => x > 0); return i >= 0 ? `<span>${ic(k)}T${i + 1}<b>${army[k][i]}</b></span>` : ''; }).join('')}</div>
          <div class="kd-pvs"><div><small>敵方戰力</small><b>${fmt(cp)}</b></div><div class="${mp >= cp * 1.15 ? 'ok' : mp >= cp ? 'mid' : 'bad'}"><small>我方最強隊伍</small><b>${fmt(mp)}</b></div></div></div>
          <div class="kd-sec"><h4>可能的戰利品</h4><div class="kd-rws">${rwText(s, { silk: lootP.silk, spice: lootP.spice, ore: lootP.ore, leaf: lootP.leaf })}<span class="kd-rw">${ic('star')}英雄碎片</span><span class="kd-rw">${ic('spd')}加速</span>${n.lv > s.map.maxCamp ? `<span class="kd-rw first">${gemI()}首勝獎勵</span>` : ''}</div></div>
          <div class="kd-acts">${busy ? '<button class="btn ghost off">已有隊伍前往</button>' : `<button class="btn goldb" data-march="camp" data-nid="${id}">${ic('sword')}出征<small>${ic('stam')}${STAM.camp} 精力（剩 ${Math.floor(stamNow(s, t))}）</small></button>`}${stamNow(s, t) < STAM.camp ? `<button class="btn gemb" data-stambuy data-n="${STAM.gems}">補精力 +${STAM.refill}<small>${gemI()}${STAM.gems}</small></button>` : ''}</div>`;
      }
      const rate = gatherRate(s, n);
      return `<div class="kd-sh-head"><div class="kd-sh-art troop" style="--c:${RES_INFO[n.type].c2}">${ic(n.type, 'big')}</div><div class="kd-sh-tt"><div class="eyebrow">Ressource</div><h3>${NODE_NAME[n.type]} Lv.${n.lv}</h3><p>派部隊來採集${RES_INFO[n.type].name}，負重越大帶回越多。</p></div></div>
        <div class="kd-sec"><div class="kd-store"><div class="kd-bar big"><i style="width:${f1(n.left / n.amt * 100)}%"></i></div><span>${fmt(n.left)} / ${fmt(n.amt)}</span></div><div class="kd-eff"><span>採集速度</span><b>${fmt(rate)} / 小時</b></div></div>
        <div class="kd-acts">${busy ? '<button class="btn ghost off">採集中</button>' : `<button class="btn goldb" data-march="gather" data-nid="${id}">${ic('basket')}派兵採集</button>`}</div>`;
    });
  }
  function bestHero(s, kind) {
    const free = HEROES.filter(h => !s.marches.some(m => m.hero === h.id));
    if (!free.length) return null;
    if (kind === 'gather' && free.some(h => h.id === 'fumi')) return 'fumi';
    return free.sort((a, b) => heroOf(b.id).power - heroOf(a.id).power)[0].id;
  }
  let marchSel = null;
  function openMarch(kind, nodeId) {
    const s0 = ks();
    marchSel = { kind, nodeId, hero: bestHero(s0, kind), f: 1 };
    snd('click');
    return openSheet('march', () => {
      const s = ks(), t = now(), node = kind === 'boss' ? null : nodeById(s, nodeId), M = marchSel;
      const cap = marchCap(lvl(s, 'town'), M.hero ? heroOf(M.hero).lv : 0), units = autoUnits(s, Math.floor(cap * M.f)), n = troopCount(units);
      const [tx, ty] = kind === 'boss' ? MAP.boss : node ? [node.x, node.y] : MAP.home;
      const mp = marchPower(s, units, M.hero), blk = marchBlock(s, kind, node, units, M.hero, t);
      let h = `<div class="kd-mhead"><h3>${kind === 'boss' ? `討伐${BOSS_NAME}` : kind === 'camp' ? `攻打黃牛黨 Lv.${node ? node.lv : ''}` : `採集 ${node ? NODE_NAME[node.type] : ''}`}</h3><small>隊伍 ${s.marches.length}/${marchSlots(lvl(s, 'town'))}・行軍 ${dur(travelMs(s, tx, ty))}</small></div>`;
      h += `<div class="kd-sec"><h4>帶隊英雄</h4><div class="kd-hpick">${HEROES.map(x => { const hi = heroInfo(x.id), busy = s.marches.some(m => m.hero === x.id); return `<button class="kd-hp ${M.hero === x.id ? 'on' : ''} ${busy ? 'busy' : ''}" data-mhero="${x.id}" ${busy ? 'disabled' : ''} style="--c:${hi.color}"><img src="${hi.face(M.hero === x.id ? 'joy' : 'neutral')}" alt=""><small>${esc(hi.name)}</small><i>${x.troop === 'all' ? '全' : TROOP[x.troop].name[0]}</i></button>`; }).join('')}</div><p class="kd-p">${M.hero ? heroPerkText(s, M.hero).t : '不帶英雄'}</p></div>`;
      h += `<div class="kd-sec"><h4>部隊 <b class="kd-n">${fmt(n)}</b> / ${fmt(cap)}</h4><div class="kd-seg">${[[.25, '25%'], [.5, '50%'], [.75, '75%'], [1, '一鍵最強']].map(([f, l]) => `<button data-mf="${f}" class="${M.f === f ? 'on' : ''}">${l}</button>`).join('')}</div><div class="kd-foes">${TYPES.map(k => sum(units[k]) ? `<span>${ic(k)}<b>${fmt(sum(units[k]))}</b></span>` : '').join('')}</div></div>`;
      if (kind === 'camp' && node) {
        const cp = campPower(node.lv), sim = battle(attackerSide(s, units, M.hero), campSide(node.lv), seeded(node.id * 7 + n));
        const tag = !n ? ['bad', '沒有部隊'] : sim.win && sim.ar >= 0.65 ? ['ok', '穩贏'] : sim.win ? ['mid', '勝算高'] : sim.ar > sim.dr * 0.7 ? ['mid', '勢均力敵'] : ['bad', '很危險'];
        h += `<div class="kd-pvs"><div><small>我方戰力</small><b>${fmt(mp)}</b></div><div class="${tag[0]}"><small>預測</small><b>${tag[1]}</b></div><div><small>敵方戰力</small><b>${fmt(cp)}</b></div></div>`;
      } else if (kind === 'gather' && node) {
        const load = marchLoad(s, units), amt = Math.min(load, node.left);
        h += `<div class="kd-pvs"><div><small>負重</small><b>${fmt(load)}</b></div><div class="ok"><small>預計帶回</small><b>${ic(node.type)}${fmt(amt)}</b></div><div><small>採集時間</small><b>${dur(amt / gatherRate(s, node) * HOUR)}</b></div></div>`;
      } else h += `<div class="kd-pvs"><div><small>我方戰力</small><b>${fmt(mp)}</b></div><div class="ok"><small>今日剩餘</small><b>${s.boss ? 3 + s.boss.extra - s.boss.hits : 3} 次</b></div></div>`;
      const msg = blk ? { slots: '出征隊伍已滿', notroops: '沒有可出征的部隊，先去訓練吧', herobusy: '英雄正在出征', taken: '已有隊伍前往', stam: '精力不足', noboss: '黃牛王還沒出現', nohits: '今天的出擊次數用完了' }[blk.code] : '';
      h += `<div class="kd-acts">${blk ? `<button class="btn off">${msg}</button>${blk.code === 'notroops' ? '<button class="btn" data-act="army">去練兵</button>' : ''}` : `<button class="btn goldb wide" data-mgo>${ic('sword')}出發！</button>`}</div>`;
      return h;
    });
  }
  function doMarch(el) {
    const s = ks(), M = marchSel, t = now(); if (!M) return;
    const node = M.kind === 'boss' ? null : nodeById(s, M.nodeId);
    if (M.kind === 'boss') ensureBoss(s, t);
    const cap = marchCap(lvl(s, 'town'), M.hero ? heroOf(M.hero).lv : 0), units = autoUnits(s, Math.floor(cap * M.f));
    const blk = marchBlock(s, M.kind, node, units, M.hero, t);
    if (blk) { snd('err'); A().shake(el); return; }
    beginMarch(s, M.kind, node, units, M.hero, t);
    report('kd_march');
    snd('fever'); vib([10, 30, 10]);
    toast(M.kind === 'gather' ? '採集隊出發！' : M.kind === 'boss' ? `出擊${BOSS_NAME}！` : '部隊出征！黃牛黨皮繃緊一點', 'gold');
    closeAll();
    setView('map');
    afterAction();
  }

  // ---------- 4j. 事件、管家、發獎 ----------
  function handleEvents(evs) {
    if (!evs || !evs.length) return;
    const s = ks();
    let built = false;
    for (const e of evs) {
      switch (e.type) {
        case 'built': {
          report('kd_build', { b: e.b, lv: e.lv }); built = true;
          if (mounted && visible) { townSig = ''; renderTown(); fireworks(e.b); snd('level'); vib([20, 40, 20]); }
          const fl = e.b === 'town' ? FLOOR_REQ.indexOf(e.lv) : -1;
          if (e.b === 'town') toast(`百貨本館升到 Lv.${e.lv}！${fl >= 0 ? `百貨 ${fl + 1}F 可以開幕了` : '收益加成提升'}`, 'gold');
          else if (mounted && visible) toast(`${BLD[e.b].name}${e.lv === 1 ? '落成' : `升到 Lv.${e.lv}`}！`, 'gold');
          break;
        }
        case 'tech': report('kd_research', { id: e.id }); if (mounted && visible) { toast(`研究完成：${TECHM[e.id].name} Lv.${e.lv}`, 'gold'); snd('level'); } break;
        case 'trained': if (mounted && visible) { toast(`${TROOP[e.k].name} ×${e.n} 訓練完成！點訓練所收下`); snd('ding'); } break;
        case 'healed': if (mounted && visible) toast(`${e.n} 名傷兵康復歸隊`, 'gold'); break;
        case 'report': if (e.rep.kind === 'boss') report('kd_boss', { dmg: e.rep.dmg }); if (mounted && visible) showReport(e.rep); break;
        case 'home': if (mounted && visible && e.loot) { const got = RES.filter(k => e.loot[k]).map(k => `${RES_INFO[k].name}+${fmt(e.loot[k])}`).join('、'); if (got) toast(`部隊回城：${got}`, 'gold'); const P = PANS[view]; for (const k of RES) if (e.loot[k]) flyTo(k, innerWidth / 2, innerHeight * .5, 4); } if (e.lostHome) toast(`SPA 客滿，${e.lostHome} 名傷兵回家休養了`); break;
        case 'help': if (mounted && visible && view === 'town') floatText(e.b, `${ic('heart')}閨蜜幫忙`); break;
      }
    }
    if (built && s) fillMap(s);
    if (mounted && evs.some(e => e.type !== 'help')) refreshOpen();
  }
  function flushOut(s, x, y) {
    if (!s.out.length) return;
    const a = A(); if (!a) return;
    const list = s.out.splice(0);
    const tot = { gems: 0, coins: 0, shards: {} };
    for (const o of list) {
      if (o.gems) tot.gems += o.gems;
      if (o.goldMin) tot.coins += Math.max(100, (a.incomePerSec ? a.incomePerSec() : 1) * 60 * o.goldMin);
      if (o.shards) for (const [id, n] of Object.entries(o.shards)) tot.shards[id] = (tot.shards[id] || 0) + n;
    }
    const r = {};
    if (tot.gems) r.gems = tot.gems;
    if (tot.coins) r.coins = tot.coins;
    if (Object.keys(tot.shards).length) r.shards = tot.shards;
    if (!Object.keys(r).length) return;
    try {
      if (typeof a.grant === 'function') a.grant(r, x, y, true);
      else { if (r.gems) a.addGems(r.gems, x, y); if (r.coins) a.addCoins(r.coins, x, y); }
    } catch (e) { console.error(e); }
    refreshHeroes(true);
  }
  function butlerStep(s) {
    const t = now(), b = bonus(s), m = month();
    for (const k of RES) if (lvl(s, k) && stored(s, k, t, b) >= bubbleAt(s, k, b) && collect(s, k, t)) report('kd_collect');
    for (const k of TYPES) if (s.train[k] && s.train[k].done) { const n = claimTrain(s, k); if (n) report('kd_train', { n }); }
    for (const j of s.q) if (j) { const l = jobLeft(j, t); if (l > 0 && l <= freeMs(s)) j.cut += l; }
    if (s.rsch) { const l = jobLeft(s.rsch, t); if (l > 0 && l <= freeMs(s)) s.rsch.cut += l; }
    if (freeQueue(s, m) >= 0) { const id = recommend(s, m); if (id && !upgBlock(s, id, m, coins())) { const c = upgCost(id, lvl(s, id) + 1); if (A().spendCoins(c.gold)) beginUpgrade(s, id, t, m); } }
    if (lvl(s, 'acad') && !s.rsch) { const id = recommendTech(s); if (id && !techBlock(s, id, coins())) { const c = techCost(TECHM[id], (s.tech[id] || 0) + 1); if (A().spendCoins(c.gold)) beginResearch(s, id, t); } }
    const next = upgCost('town', Math.min(MAX_LV, lvl(s, 'town') + 1));
    for (const k of TYPES) {
      const bl = lvl(s, TROOP[k].b); if (!bl || s.train[k]) continue;
      const tier = tierMax(bl), n = Math.min(maxTrain(s, k, tier), Math.floor(batchCap(bl) * 0.5)), c = trainCost(k, tier, Math.max(1, n));
      if (n > 0 && RES.every(r => !c[r] || s.res[r] - c[r] >= (next[r] || 0))) beginTrain(s, k, tier, n, t);
    }
    if (!s.heal && troopCount(s.wounded)) { const u = healPlan(s); if (troopCount(u)) beginHeal(s, u, t); }
  }

  // ---------- 4k. 點擊 ----------
  function townTap(target) {
    const bub = target.closest && target.closest('[data-bub]');
    const s = ks();
    if (bub && !bub.hidden) {
      const id = bub.dataset.bub, k = bub.className;
      if (k.includes('res') && BLD[id].res) { collectOne(id, bub); afterAction(); return; }
      if (k.includes('res') && id === 'bank') { openBuilding('bank'); return; }
      if (k.includes('troop')) { claimTroops(BLD[id].troop, bub); afterAction(); return; }
      if (k.includes('free')) { const qi = busyQueue(s, id); if (qi >= 0) speedUp({ k: 'q', i: qi }, 'free', bub); return; }
      if (k.includes('up')) { doUpgrade('town', bub); return; }
      if (k.includes('idle') && BLD[id].troop) { openTrain(BLD[id].troop); return; }
      if (k.includes('idle') && id === 'acad') { openAcad(); return; }
      openBuilding(id); return;
    }
    const b = target.closest && (target.closest('[data-b]') || target.closest('[data-tag]'));
    if (b) { const id = b.dataset.b || b.dataset.tag; openBuilding(id); }
  }
  function mapTap(target) {
    if (!target.closest) return;
    const n = target.closest('[data-node]'); if (n) { openNode(+n.dataset.node); return; }
    if (target.closest('[data-home]')) { setView('town'); return; }
    if (target.closest('[data-bossnode]')) { openBoss(); return; }
    const mk = target.closest('[data-mk]'); if (mk) openArmy();
  }
  function onClick(e) {
    const b = e.target.closest('button'); if (!b || !root.contains(b)) return;
    const s = ks(); if (!s) return;
    const d = b.dataset, t = now();
    if (d.act) return act(d.act, b);
    if (d.res) return openResInfo(d.res);
    if (d.q !== undefined) { const i = +d.q, j = s.q[i]; if (j) { focusBuilding(j.b); openBuilding(j.b); } else if (i < queueCount(s, month())) quickUpgrade(b); else openQueues(); return; }
    if (d.gob) { closeAll(); focusBuilding(d.gob); setTimeout(() => openBuilding(d.gob), 250); return; }
    if (d.up) return doUpgrade(d.up, b);
    if (d.upgem) return gemBtn(b, +d.n, () => doUpgrade(d.upgem, b, true));
    if (d.cancel !== undefined) { const g = cancelUpgrade(s, +d.cancel); if (g) A().payout(g); snd('click'); toast('工程取消，退回一半資源'); return afterAction(); }
    if (d.speed) return speedUp(JSON.parse(d.speed), d.how, b);
    if (d.speedgem) return gemBtn(b, +d.n, () => speedUp(JSON.parse(d.speedgem), 'gem', b));
    if (d.col) { collectOne(d.col, b); return afterAction(); }
    if (d.claimtr) { claimTroops(d.claimtr, b); return afterAction(); }
    if (d.train) return openTrain(d.train);
    if (d.tier) { const k = sheet && sheet.kind.split(':')[1]; if (k) { trainSel[k].t = +d.tier; snd('click'); sheet.render(); } return; }
    if (d.tf) { const k = sheet && sheet.kind.split(':')[1]; if (k) { trainSel[k].f = +d.tf; snd('click'); sheet.render(); } return; }
    if (d.dotrain) { if (+d.n <= 0) { snd('err'); A().shake(b); return; } return doTrain(d.dotrain, +d.t, +d.n, b); }
    if (d.traingem) return gemBtn(b, +d.n, () => doTrain(d.traingem, +d.t, +d.nn, b, true));
    if (d.heal !== undefined) { const u = healPlan(s); if (!troopCount(u)) { snd('err'); return; } beginHeal(s, u, t); snd('ding'); toast('傷兵開始做 SPA～', 'gold'); return afterAction(); }
    if (d.healgem !== undefined) return gemBtn(b, +d.n, () => { const u = healPlan(s); const all = { guard: [...s.wounded.guard], car: [...s.wounded.car], pap: [...s.wounded.pap] }; const use = troopCount(u) ? u : all; const c = healCost(s, use); for (const r of RES) if (c[r]) s.res[r] = Math.max(s.res[r], c[r]); beginHeal(s, use, t).cut = 1e15; afterAction(); });
    if (d.hero) return openHero(d.hero);
    if (d.hlv) { const a = A(); if (typeof a.heroLevelUp === 'function' && a.heroLevelUp(d.hlv, b)) { refreshHeroes(true); const [x, y] = centerOf(b); try { a.fx.burst(x, y, 14, ['spark', 'heart']); } catch (er) { /* 略 */ } } refreshOpen(); return; }
    if (d.hstar) { const a = A(); if (typeof a.heroStarUp === 'function' && a.heroStarUp(d.hstar, b)) { refreshHeroes(true); const [x, y] = centerOf(b); try { a.fx.burst(x, y, 40); a.fx.rain('confetti', 40); } catch (er) { /* 略 */ } } refreshOpen(); return; }
    if (d.br) { acadBr = d.br; snd('click'); return refreshOpen(); }
    if (d.tech) return openTech(d.tech);
    if (d.techrec !== undefined) { const id = recommendTech(s); if (!id) { toast('目前沒有可以研究的科技'); return; } if (!techBlock(s, id, coins())) return doTech(id, b); return openTech(id); }
    if (d.dotech) return doTech(d.dotech, b);
    if (d.techgem) return gemBtn(b, +d.n, () => doTech(d.techgem, b, true));
    if (d.qtab) { questTab = d.qtab; snd('click'); return refreshOpen(); }
    if (d.chest) { const c = DAILY_CHEST.find(x => x.pts === +d.chest); if (!c || s.day.chest[c.pts] || dailyPts(s) < c.pts) { snd('err'); toast('活躍度還不夠喔'); return; } s.day.chest[c.pts] = 1; grant(s, scaleRw(s, c.rw)); const [x, y] = centerOf(b); flushOut(s, x, y); snd('cash'); try { A().fx.burst(x, y, 30); } catch (er) { /* 略 */ } toast('寶箱打開了！', 'gold'); return afterAction(); }
    if (d.dclaim) { const dd = DAILY.find(x => x.id === d.dclaim); if (!dd || s.day.done[dd.id] || (s.day.c[dd.k] || 0) < dd.n) return; s.day.done[dd.id] = 1; grant(s, { spd: 5 }); snd('ding'); return afterAction(); }
    if (d.dgo) { closeAll(); return goQuest({ ui: d.dgo }); }
    if (d.recall) { recallMarch(s, +d.recall, t); snd('click'); toast('隊伍召回中'); return afterAction(); }
    if (d.bossgo !== undefined) { ensureBoss(s, t); return openMarch('boss', 0); }
    if (d.bossbuy !== undefined) return gemBtn(b, +d.n, () => { const B = ensureBoss(s, now()); B.extra = Math.min(3, B.extra + 1); snd('cash'); afterAction(); });
    if (d.bossprev !== undefined) { const B = s.boss; if (!B || !B.prev || B.prev.claimed) return; B.prev.claimed = true; grant(s, rankReward(B.prev.rank)); const [x, y] = centerOf(b); flushOut(s, x, y); snd('ssr'); toast(`昨日第 ${B.prev.rank} 名獎勵入帳！`, 'gold'); return afterAction(); }
    if (d.bossms) { const B = ensureBoss(s, t), m = bossMilestones(B)[+d.bossms]; if (!m || B.ms[m.i] || B.dmg < m.need) { snd('err'); toast('傷害還不夠，再出擊一次吧'); return; } B.ms[m.i] = 1; grant(s, scaleRw(s, m.rw)); const [x, y] = centerOf(b); flushOut(s, x, y); snd('cash'); return afterAction(); }
    if (d.rep) { const r = s.reports.find(x => x.id === +d.rep); if (r) showReport(r); return; }
    if (d.butlerbuy !== undefined) return gemBtn(b, +d.n, () => { s.butler = Math.max(now(), s.butler) + BUTLER.ms; snd('cash'); toast('管家史利開始值班 8 小時！', 'gold'); afterAction(); });
    if (d.q2 !== undefined) return gemBtn(b, +d.n, () => { s.q2 = true; snd('ssr'); toast('第二建築隊列永久解鎖！', 'gold'); afterAction(); });
    if (d.shop !== undefined) { A().go('shop'); return; }
    if (d.bank) {
      const amt = +d.amt, plan = BANK_PLANS.find(p => p.id === d.bank);
      if (s.bank || !plan) return;
      if (!A().spendCoins(amt, b)) return;
      s.bank = { plan: plan.id, amt, t0: t, end: t + plan.h * HOUR, gems: bankGems(plan, lvl(s, 'bank')) };
      bump(s, 'bank', 1); snd('cash'); toast(`存入 ${fmt(amt)} 金幣，${plan.h} 小時後連本帶利領回`, 'gold');
      return afterAction();
    }
    if (d.bankclaim !== undefined) { const B = s.bank; if (!B || t < B.end) return; const plan = BANK_PLANS.find(p => p.id === B.plan); const [x, y] = centerOf(b); A().payout(B.amt, x, y); A().addCoins(B.amt * plan.rate, x, y); s.bank = null; grant(s, { gems: B.gems }); flushOut(s, x, y); snd('cash'); toast('本金與利息入帳！', 'gold'); return afterAction(); }
    if (d.bankbreak !== undefined) { const B = s.bank; if (!B) return; A().payout(B.amt); s.bank = null; snd('click'); toast('已提前解約，本金退回'); return afterAction(); }
    if (d.march) return openMarch(d.march, +d.nid);
    if (d.mhero) { marchSel.hero = d.mhero; snd('click'); return sheet && sheet.render(); }
    if (d.mf) { marchSel.f = +d.mf; snd('click'); return sheet && sheet.render(); }
    if (d.mgo !== undefined) return doMarch(b);
    if (d.stambuy !== undefined) return gemBtn(b, +d.n, () => { stamAdd(s, STAM.refill, now()); snd('cash'); afterAction(); });
  }
  function act(a, b) {
    const s = ks();
    switch (a) {
      case 'quests': return openQuests('main');
      case 'daily': return openQuests('daily');
      case 'heroes': return openHeroes();
      case 'army': return openArmy();
      case 'acad': if (!lvl(s, 'acad')) { focusBuilding('acad'); return openBuilding('acad'); } return openAcad();
      case 'collect': return collectEverything(b);
      case 'view': snd('click'); closeAll(); return setView(view === 'town' ? 'map' : 'town');
      case 'map': closeAll(); return setView('map');
      case 'power': return openPower();
      case 'boss': return openBoss();
      case 'butler': return openButler();
      case 'reports': return openReports();
      case 'queues': return openQueues();
      case 'quickup': closeSheet(); return quickUpgrade(b);
      case 'qclaim': {
        const r = claimQuest(s); if (!r) return;
        const [x, y] = centerOf(b);
        flushOut(s, x, y);
        for (const k of RES) if (r.q.rw[k]) flyTo(k, x, y, 4);
        snd('cash'); vib(15);
        try { A().fx.burst(x, y, 24, ['confetti', 'spark']); } catch (e) { /* 略 */ }
        toast(`任務完成：${r.q.t}`, 'gold');
        return afterAction();
      }
      case 'qgo': { const q = curQuest(s); if (q) goQuest(q.go); return; }
      case 'qskip': if (skipQuest(s)) { snd('click'); toast('已略過這個任務'); afterAction(); } return;
    }
  }

  // ---------- 4l. 主迴圈（主程式每 0.3 秒呼叫） ----------
  function refreshAll() { if (!mounted || !root) return; updateTop(); updateHudL(); questBar(); dots(); if (view === 'town') { renderTown(); updateTownOverlay(); } else renderMap(); liveOpen(); }
  function tick(dt, vis) {
    const s = ks(); if (!s) return;
    refreshHeroes();
    const evs = process(s, now());
    if (s.butler > now()) butlerStep(s);
    flushOut(s);
    if (evs.length) handleEvents(evs);
    if (mounted && visible) refreshAll();
  }

  // ================= 5. 對外介面 =================
  W.ErikaKingdom = {
    _core: Core,
    mount(el, a) {
      api = a || W.ErikaAPI;
      el.innerHTML = defsSVG() + skeleton();
      root = el.querySelector('.kd');
      mounted = true;
      makePan('town', $('.kd-town'), TOWN.w, TOWN.h, townTap, [0.42, 1.6]);
      makePan('map', $('.kd-map'), MAP.w, MAP.h, mapTap, [0.38, 1.4]);
      root.addEventListener('click', onClick);
      refreshHeroes(true);
      townSig = '';
      renderTown(true);
    },
    show() {
      visible = true;
      const s = ks(); if (!s || !root) return;
      refreshHeroes(true);
      handleEvents(process(s, now()));
      const P = PANS.town;
      if (P && !P.ready) { P.ready = true; const [u, v] = BLD.town.pos; P.center(tsx(u), tsy(v) + 50, 0.8); } else if (P) P.apply();
      setView(view);
      refreshAll();
      setTimeout(intro, 300);
      const unread = s.reports.filter(r => !r.read && now() - r.t < 10 * MIN);
      if (unread.length) setTimeout(() => showReport(unread[0]), 600);
    },
    hide() { visible = false; cancelAnimationFrame(mapRaf); mapRaf = 0; },
    tick(dt, vis) { try { tick(dt, vis); } catch (e) { console.error(e); } },
    reset() {
      stObj = null; townSig = ''; mapSig = ''; mapGround = ''; repQueue = [];
      const s = ks();
      if (root) { closeAll(); renderTown(true); if (view === 'map') renderMap(true); refreshAll(); }
      return !!s;
    },
    incomeMult() { const s = ks(); if (!s) return 1; const m = incomeMult(s); return m > 0 && isFinite(m) ? m : 1; },
    townLevel() { const s = ks(); return s ? lvl(s, 'town') : 1; },
    floorUnlockReq: i => FLOOR_REQ[i] || 0,
    badge() {
      const s = ks(); if (!s) return false;
      const t = now(), b = bonus(s), m = month();
      if (RES.some(k => lvl(s, k) && stored(s, k, t, b) >= bubbleAt(s, k, b))) return true;
      if (TYPES.some(k => s.train[k] && s.train[k].done)) return true;
      if (questDone(s) || dailyClaimable(s)) return true;
      if (s.bank && t >= s.bank.end) return true;
      if (freeQueue(s, m) >= 0) { const id = recommend(s, m); if (id && !upgBlock(s, id, m, coins())) return true; }
      return false;
    },
    // 統一發獎（主程式 api.grant 轉呼叫）：res = { silk, spice, ore, leaf }，speedup = 分鐘
    grant(r = {}) {
      const s = ks(); if (!s) return false;
      if (r.res) for (const [k, v] of Object.entries(r.res)) if (RES.includes(k) && v > 0 && isFinite(v)) s.res[k] += Math.floor(v);
      if (r.speedup > 0 && isFinite(r.speedup)) s.items.spd += Math.floor(r.speedup);
      if (mounted) updateTop();
      return true;
    },
    resUnit(k) { const s = ks(); return s ? resUnit(s, k) : 100; },
    perk(name) { const s = ks(); return s ? perk(s, name) : 0; },
  };
  W.ErikaKingdom._debug = {
    get st() { return ks(); },
    setAll(lv) { const s = ks(); for (const id of BIDS) s.b[id].lv = clamp(lv, 0, MAX_LV); townSig = ''; mapSig = ''; refreshAll(); },
    set(id, lv) { const s = ks(); s.b[id].lv = lv; townSig = ''; refreshAll(); },
    advance(ms) { const s = ks(); const shift = o => { for (const k of ['t0', 't1', 't2', 't3', 'hnext', 'end']) if (o && Number.isFinite(o[k])) o[k] -= ms; }; s.q.forEach(shift); shift(s.rsch); TYPES.forEach(k => shift(s.train[k])); shift(s.heal); s.marches.forEach(shift); shift(s.bank); for (const k of RES) s.b[k].t -= ms; s.stam.t -= ms; refreshAll(); },
    open: { building: openBuilding, heroes: openHeroes, hero: openHero, acad: openAcad, tech: openTech, quests: openQuests, army: openArmy, boss: openBoss, reports: openReports, train: openTrain, march: openMarch, node: openNode, butler: openButler, power: openPower, queues: openQueues },
    showReport, setView, focusBuilding, focusNode, closeAll, fireworks, intro,
  };
})();
