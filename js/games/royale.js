// 名媛吃雞大作戰 — 槍戰大逃殺（俯視 2.5D Canvas）
// 結構：一、純邏輯核心（地圖、武器、碰撞、毒圈、AI、對局模擬；不碰 DOM，可在 node 測試）
//       二、畫面（大廳、配對、航線跳傘、戰場繪製、HUD、結算）
'use strict';
(() => {
  // ====================================================================
  //  一、純邏輯核心
  // ====================================================================
  const TAU = Math.PI * 2;
  const MAP = 3400, CX = 1700, CY = 1700;
  const PR = 17;            // 角色半徑
  const SPEED = 168;        // 移動速度（單位／秒）
  const CELL = 160, GN = Math.ceil(MAP / CELL);   // 碰撞／查詢網格
  const NAV = 20, NN = Math.ceil(MAP / NAV);      // 尋路網格
  const CHUTE_T = 7.5;      // 跳傘時間
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const turnToward = (a, b, max) => { const d = angDiff(a, b); return Math.abs(d) <= max ? b : a + Math.sign(d) * max; };

  function makeRng(seed) {
    let a = seed >>> 0;
    const r = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.range = (x, y) => x + (y - x) * r();
    r.int = (x, y) => x + Math.floor(r() * (y - x + 1));
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.gauss = () => { let u = 0; while (!u) u = r(); return clamp(Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()), -2.6, 2.6); };
    r.wpick = list => { let s = 0; for (const it of list) s += it[1]; let x = r() * s; for (const it of list) { x -= it[1]; if (x < 0) return it[0]; } return list[list.length - 1][0]; };
    return r;
  }

  // ---------- 武器、防具、補給 ----------
  const RARITY = [
    { name: '普通', color: '#d8d0dc', glow: '#ffffff', mul: 1.00 },
    { name: '精良', color: '#5fd394', glow: '#a6f2c8', mul: 1.06 },
    { name: '稀有', color: '#4fa6ff', glow: '#a9d5ff', mul: 1.12 },
    { name: '史詩', color: '#b47cff', glow: '#dcc2ff', mul: 1.19 },
    { name: '傳說', color: '#ffc443', glow: '#fff0b0', mul: 1.27 },
  ];
  // dmg 單發傷害、rof 射擊間隔（秒）、spread 散布（弧度）、range 射程、mag 彈匣、reload 換彈秒數、spd 子彈速度、hs 爆頭率、hsMul 爆頭倍率、pel 彈丸數
  const WEAPONS = {
    pistol: { id: 'pistol', name: '珍珠手槍', type: '手槍', dmg: 21, rof: 0.21, spread: 0.055, range: 380, mag: 15, reload: 1.25, spd: 1500, hs: 0.12, hsMul: 1.8, pel: 1, score: 10, snd: 0 },
    smg: { id: 'smg', name: '蜜糖衝鋒槍', type: '衝鋒槍', dmg: 14, rof: 0.075, spread: 0.10, range: 420, mag: 30, reload: 1.7, spd: 1600, hs: 0.08, hsMul: 1.6, pel: 1, score: 30, snd: 0 },
    shotgun: { id: 'shotgun', name: '玫瑰霰彈槍', type: '霰彈槍', dmg: 12, rof: 0.82, spread: 0.24, range: 270, mag: 5, reload: 2.4, spd: 1300, hs: 0.05, hsMul: 1.5, pel: 8, score: 32, snd: 2 },
    rifle: { id: 'rifle', name: '香檳步槍', type: '步槍', dmg: 23, rof: 0.11, spread: 0.05, range: 640, mag: 30, reload: 2.1, spd: 2000, hs: 0.13, hsMul: 2.0, pel: 1, score: 46, snd: 1 },
    sniper: { id: 'sniper', name: '鑽石狙擊槍', type: '狙擊槍', dmg: 80, rof: 1.3, spread: 0.008, range: 1050, mag: 5, reload: 2.8, spd: 3200, hs: 0.3, hsMul: 2.3, pel: 1, score: 44, snd: 3 },
    crown: { id: 'crown', name: '皇冠突擊步槍', type: '步槍', dmg: 27, rof: 0.085, spread: 0.045, range: 680, mag: 40, reload: 2.2, spd: 2200, hs: 0.15, hsMul: 2.0, pel: 1, score: 80, drop: true, snd: 1 },
    queen: { id: 'queen', name: '女王狙擊槍', type: '狙擊槍', dmg: 118, rof: 1.45, spread: 0.005, range: 1200, mag: 5, reload: 3.0, spd: 3600, hs: 0.35, hsMul: 2.5, pel: 1, score: 78, drop: true, snd: 3 },
  };
  const ARMOR = [null, { red: 0.30, dur: 80 }, { red: 0.40, dur: 140 }, { red: 0.55, dur: 200 }];
  const GEAR_NAME = { armor: ['', '蕾絲防彈衣', '緞面防彈衣', '鑽石防彈衣'], helmet: ['', '銀冠頭盔', '金冠頭盔', '鑽冠頭盔'] };
  const HEALS = {
    bandage: { name: '繃帶', t: 2.5, cap: 10, val: 3 },
    medkit: { name: '急救包', t: 5, cap: 3, val: 9 },
    drink: { name: '能量飲料', t: 2, cap: 5, val: 4 },
  };
  const magOf = (w, r) => { const W = WEAPONS[w]; return W.mag + (W.mag <= 5 ? 0 : Math.round(W.mag * 0.1 * r)); };
  const reloadOf = (w, r) => WEAPONS[w].reload * (1 - 0.05 * r);
  const gunScore = g => WEAPONS[g.w].score + g.r * 5;
  // 單發傷害（霰彈槍隨距離衰減）
  function bulletDamage(w, r, dist) {
    const W = WEAPONS[w];
    let d = W.dmg * RARITY[r].mul;
    if (W.pel > 1) d *= Math.max(0.3, 1 - 0.7 * dist / W.range);
    return d;
  }
  // 套用防具，回傳實際扣血；防具會耗損
  function applyArmor(p, dmg, head) {
    const g = head ? p.helmet : p.armor;
    if (!g || g.dur <= 0) return dmg;
    const red = ARMOR[g.lv].red;
    g.dur = Math.max(0, g.dur - dmg * 0.55);
    return dmg * (1 - red);
  }
  // 理論每秒傷害（測試、說明用）
  const weaponDps = (w, r = 0) => { const W = WEAPONS[w]; return W.dmg * RARITY[r].mul * W.pel / W.rof; };

  // ---------- 島嶼與地圖 ----------
  const ISL = th => 1450 + 60 * Math.sin(3 * th + 0.7) + 35 * Math.sin(5 * th + 2.1) + 20 * Math.sin(8 * th + 4.2) + 10 * Math.sin(13 * th + 1);
  function inIsland(x, y) {
    const dx = x - CX, dy = y - CY, d2 = dx * dx + dy * dy;
    if (d2 < 1320 * 1320) return true;
    if (d2 > 1590 * 1590) return false;
    return Math.sqrt(d2) < ISL(Math.atan2(dy, dx));
  }
  const coastDist = (x, y) => { const dx = x - CX, dy = y - CY; return ISL(Math.atan2(dy, dx)) - Math.hypot(dx, dy); };
  const inRect = (r, x, y, m = 0) => x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
  function isLand(M, x, y) {
    if (x < 0 || y < 0 || x > MAP || y > MAP) return false;
    if (inIsland(x, y)) return true;
    for (const p of M.piers) if (inRect(p, x, y)) return true;
    return false;
  }

  // 可擋路的家具
  const BLOCK = { rack: 1, counter: 1, shelf: 1, sofa: 1, crate: 1, table: 1, bed: 1, pew: 1, planter: 1, column: 1, bar: 1, piano: 1, vanity: 1, altar: 1, bench: 1, kiosk: 1 };

  let MAP_CACHE = null;
  function getMap() { return MAP_CACHE || (MAP_CACHE = buildMap()); }

  function buildMap() {
    const M = { obs: [], decor: [], bld: [], roads: [], areas: [], spots: [], trees: [], piers: [], labels: [], bushes: [], flowers: [], loungers: [] };
    const rng = makeRng(20261009);
    const ob = (x, y, w, h, k, o) => { const r = Object.assign({ x, y, w, h, k, b: true, i: M.obs.length }, o); M.obs.push(r); return r; };
    const dec = (k, x, y, w, h, o) => { const r = Object.assign({ k, x, y, w, h }, o); M.decor.push(r); return r; };
    const area = (k, x, y, w, h, o) => M.areas.push(Object.assign({ k, x, y, w, h }, o));
    const road = (x, y, w, h) => M.roads.push({ x, y, w, h });
    const T = 12;
    function cut(a, b, gaps) {
      let segs = [[a, b]];
      for (const [c, w] of gaps) {
        const g0 = c - w / 2, g1 = c + w / 2, out = [];
        for (const [s, e] of segs) { if (g1 <= s || g0 >= e) out.push([s, e]); else { if (g0 - s > 4) out.push([s, g0]); if (e - g1 > 4) out.push([g1, e]); } }
        segs = out;
      }
      return segs;
    }
    function building(b) {
      b.i = M.bld.length; M.bld.push(b);
      const wc = b.wall || '#f1e6ea';
      if (!b.noWalls) {
        const D = side => (b.doors || []).filter(d => d[0] === side);
        for (const [s, e] of cut(b.x, b.x + b.w, D('n').map(d => [b.x + b.w * d[1], d[2]]))) ob(s, b.y, e - s, T, 'wall', { c: wc, bi: b.i });
        for (const [s, e] of cut(b.x, b.x + b.w, D('s').map(d => [b.x + b.w * d[1], d[2]]))) ob(s, b.y + b.h - T, e - s, T, 'wall', { c: wc, bi: b.i });
        for (const [s, e] of cut(b.y + T, b.y + b.h - T, D('w').map(d => [b.y + b.h * d[1], d[2]]))) ob(b.x, s, T, e - s, 'wall', { c: wc, bi: b.i });
        for (const [s, e] of cut(b.y + T, b.y + b.h - T, D('e').map(d => [b.y + b.h * d[1], d[2]]))) ob(b.x + b.w - T, s, T, e - s, 'wall', { c: wc, bi: b.i });
        for (const [dir, rel, from, to, gaps] of b.inner || []) {
          if (dir === 'h') for (const [s, e] of cut(b.x + from, b.x + to, (gaps || []).map(([c, w]) => [b.x + c, w]))) ob(s, b.y + rel - T / 2, e - s, T, 'wall', { c: wc, bi: b.i, inner: 1 });
          else for (const [s, e] of cut(b.y + from, b.y + to, (gaps || []).map(([c, w]) => [b.y + c, w]))) ob(b.x + rel - T / 2, s, T, e - s, 'wall', { c: wc, bi: b.i, inner: 1 });
        }
      }
      for (const [k, rx, ry, w, h, o] of b.furn || []) {
        if (BLOCK[k]) ob(b.x + rx, b.y + ry, w, h, k, Object.assign({ bi: b.i }, o));
        else dec(k, b.x + rx, b.y + ry, w, h, Object.assign({ bi: b.i }, o));
      }
      return b;
    }

    // ===== 地面區域 =====
    area('plaza', 1340, 870, 720, 500);              // 百貨前廣場
    area('plaza', 1420, 1440, 560, 400);             // 中央廣場
    area('garden', 560, 1380, 520, 540);             // 玫瑰花園
    area('asphalt', 820, 2160, 520, 380);            // 停車場
    area('boardwalk', 2110, 2240, 440, 270);         // 碼頭木棧道
    area('court', 1540, 2300, 320, 220);             // 網球場
    area('helipad', 2690, 1830, 170, 170);           // 停機坪
    area('deck', 925, 690, 330, 245);                // 沙灘俱樂部露台

    // ===== 道路 =====
    road(1660, 700, 80, 200);
    road(1660, 1340, 80, 100);
    road(1660, 1840, 80, 460);
    road(1080, 1610, 340, 80);
    road(1980, 1610, 350, 80);
    road(2330, 780, 80, 1500);
    road(1260, 780, 80, 1380);
    road(1220, 780, 1190, 70);
    road(800, 1130, 460, 80);
    road(1740, 2020, 160, 70);
    road(2410, 1150, 430, 80);
    road(2760, 1150, 80, 430);

    // ===== 建築 =====
    building({ x: 1360, y: 900, w: 680, h: 440, name: 'ERIKA 百貨', tier: 3, floor: 'marble', roof: '#f6c4d6', roof2: '#e48fb0', wall: '#f6e9ef', sign: 'ERIKA', big: 1,
      doors: [['s', 0.5, 100], ['n', 0.25, 70], ['n', 0.75, 70], ['w', 0.5, 70], ['e', 0.5, 70]],
      inner: [['v', 230, 0, 440, [[110, 70], [330, 70]]], ['v', 450, 0, 440, [[110, 70], [330, 70]]], ['h', 200, 0, 230, [[115, 70]]], ['h', 200, 450, 680, [[565, 70]]]],
      furn: [
        ['rug', 252, 60, 176, 320], ['escalator', 300, 140, 80, 160],
        ['rack', 40, 50, 64, 14], ['rack', 130, 50, 64, 14], ['rack', 40, 130, 64, 14], ['rack', 130, 130, 64, 14],
        ['counter', 30, 250, 70, 26], ['counter', 130, 250, 70, 26], ['counter', 30, 360, 70, 26], ['counter', 130, 360, 70, 26],
        ['counter', 485, 50, 70, 24], ['counter', 580, 50, 70, 24], ['counter', 485, 130, 70, 24], ['counter', 580, 130, 70, 24],
        ['shelf', 480, 250, 70, 22], ['shelf', 585, 250, 70, 22], ['shelf', 480, 350, 70, 22], ['shelf', 585, 350, 70, 22],
        ['planter', 250, 30, 34, 34], ['planter', 396, 30, 34, 34], ['planter', 250, 376, 34, 34], ['planter', 396, 376, 34, 34],
        ['mannequin', 112, 92, 16, 16], ['mannequin', 565, 92, 16, 16],
      ] });
    const SHOPS = [['Rosé', '#f7b6c8'], ['Lumière', '#f3d68c'], ['Perle', '#c9def5'], ['Camélia', '#f2bdd6'], ['Étoile', '#d6c4f4'], ['Bijou', '#b9e6d2'], ['Velours', '#ebb8a6'], ['Soleil', '#ffdf9e']];
    [1240, 1420, 1720, 1900].forEach((y, j) => {
      const [n1, c1] = SHOPS[j * 2], [n2, c2] = SHOPS[j * 2 + 1];
      building({ x: 2120, y, w: 190, h: 160, name: n1, tier: 2, floor: j % 2 ? 'wood' : 'carpet', roof: c1, wall: '#fbf2f4', sign: n1, doors: [['e', 0.5, 60]],
        furn: [['rack', 22, 24, 14, 74], ['rack', 60, 22, 74, 14], ['counter', 52, 118, 80, 22], ['mannequin', 128, 70, 16, 16]] });
      building({ x: 2430, y, w: 190, h: 160, name: n2, tier: 2, floor: j % 2 ? 'carpet' : 'wood', roof: c2, wall: '#fbf2f4', sign: n2, doors: [['w', 0.5, 60]],
        furn: [['rack', 154, 24, 14, 74], ['rack', 56, 22, 74, 14], ['counter', 58, 118, 80, 22], ['mannequin', 46, 70, 16, 16]] });
    });
    building({ x: 2050, y: 600, w: 260, h: 180, name: '海景別墅', tier: 2, floor: 'wood', roof: '#ee9d80', roof2: '#c8705a', wall: '#fff4e8', doors: [['s', 0.3, 60], ['e', 0.5, 56]],
      inner: [['v', 140, 0, 180, [[60, 56]]]], furn: [['rug', 20, 80, 100, 70], ['sofa', 24, 26, 80, 26], ['table', 52, 100, 40, 30], ['bed', 170, 110, 64, 48], ['vanity', 196, 20, 44, 18], ['plant', 22, 140, 18, 18]] });
    building({ x: 2420, y: 860, w: 240, h: 180, name: '海景別墅', tier: 2, floor: 'wood', roof: '#ee9d80', roof2: '#c8705a', wall: '#fff4e8', doors: [['w', 0.65, 56], ['s', 0.75, 60]],
      inner: [['v', 120, 0, 180, [[120, 56]]]], furn: [['rug', 136, 30, 88, 70], ['bed', 24, 24, 64, 46], ['sofa', 140, 24, 76, 26], ['table', 150, 70, 36, 28], ['plant', 30, 140, 18, 18]] });
    dec('pool', 2090, 520, 170, 58); dec('pool', 2450, 1062, 160, 62);
    building({ x: 960, y: 720, w: 260, h: 180, name: '沙灘俱樂部', tier: 2, floor: 'tile', roof: '#86d6cc', roof2: '#4fae9f', wall: '#f2fbf8', doors: [['s', 0.5, 70], ['e', 0.5, 56]],
      furn: [['bar', 28, 26, 130, 24], ['table', 50, 96, 36, 36], ['table', 150, 96, 36, 36], ['plant', 210, 30, 18, 18], ['rug', 30, 80, 190, 70]] });
    building({ x: 620, y: 1080, w: 180, h: 180, name: '白色婚禮教堂', tier: 2, floor: 'chapel', roof: '#fbf7f2', roof2: '#d9cbbd', wall: '#fffaf3', doors: [['e', 0.5, 60], ['s', 0.5, 56]],
      furn: [['rug', 40, 80, 130, 20, { c: '#c8325a' }], ['altar', 18, 70, 24, 40], ['pew', 60, 26, 46, 12], ['pew', 118, 26, 46, 12], ['pew', 60, 50, 46, 12], ['pew', 118, 50, 46, 12], ['pew', 60, 118, 46, 12], ['pew', 118, 118, 46, 12], ['pew', 60, 142, 46, 12], ['pew', 118, 142, 46, 12]] });
    building({ x: 770, y: 1600, w: 100, h: 100, name: '玫瑰涼亭', tier: 2, floor: 'stone', roof: '#ffffff', roof2: '#e8c9d4', noWalls: 1, gazebo: 1,
      furn: [['column', 4, 4, 14, 14], ['column', 82, 4, 14, 14], ['column', 4, 82, 14, 14], ['column', 82, 82, 14, 14]] });
    building({ x: 1040, y: 1960, w: 200, h: 150, name: '甜點咖啡廳', tier: 1, floor: 'tile', roof: '#ffd6a6', roof2: '#e9a868', wall: '#fff6ec', doors: [['n', 0.5, 60], ['e', 0.5, 56]],
      furn: [['counter', 120, 22, 64, 24], ['table', 28, 60, 30, 30], ['table', 92, 96, 30, 30], ['table', 28, 108, 30, 30], ['plant', 160, 120, 18, 18]] });
    building({ x: 1350, y: 2190, w: 130, h: 120, name: '代客泊車亭', tier: 1, floor: 'tile', roof: '#d7d0ea', roof2: '#a99ccb', wall: '#f8f6fc', doors: [['w', 0.5, 56], ['n', 0.5, 56]],
      furn: [['counter', 70, 74, 44, 22], ['plant', 20, 90, 16, 16]] });
    building({ x: 2160, y: 2280, w: 300, h: 180, name: '遊艇俱樂部倉庫', tier: 2, floor: 'wood', roof: '#7fa6e3', roof2: '#4f74b8', wall: '#eef4fb', doors: [['n', 0.6, 80], ['s', 0.3, 70], ['e', 0.7, 60]],
      furn: [['crate', 30, 30, 40, 40], ['crate', 76, 30, 40, 40], ['crate', 30, 76, 40, 40], ['crate', 230, 100, 44, 44], ['crate', 182, 124, 36, 36], ['rug', 120, 60, 80, 50, { c: '#9fb8dc' }]] });
    building({ x: 1620, y: 560, w: 160, h: 140, name: '海景觀景台', tier: 2, floor: 'wood', roof: '#e8c87e', roof2: '#b8913f', wall: '#fff8e8', doors: [['s', 0.5, 60]],
      furn: [['telescope', 30, 24, 16, 16], ['telescope', 112, 24, 16, 16], ['bench', 50, 70, 60, 14]] });
    building({ x: 2700, y: 1580, w: 200, h: 180, name: 'VIP 會所', tier: 3, floor: 'carpet', roof: '#5d2a4c', roof2: '#3b1530', wall: '#f4e6ee', gold: 1, doors: [['n', 0.5, 64], ['w', 0.6, 56]],
      furn: [['rug', 40, 66, 120, 64, { c: '#7a2f55' }], ['sofa', 24, 26, 50, 22], ['sofa', 126, 26, 50, 22], ['piano', 130, 110, 46, 36], ['bar', 30, 140, 60, 22]] });
    building({ x: 1900, y: 1980, w: 200, h: 160, name: 'SPA 會館', tier: 2, floor: 'tile', roof: '#bfe6db', roof2: '#7fbfae', wall: '#f3fbf8', doors: [['w', 0.5, 56], ['n', 0.3, 56]],
      furn: [['pool', 20, 92, 64, 48], ['bed', 122, 26, 58, 32], ['bed', 122, 98, 58, 32], ['plant', 24, 26, 18, 18]] });

    // ===== 戶外物件 =====
    // 中央廣場：噴水池（三個矩形拼成圓）、長椅、花台、冰淇淋車
    ob(1645, 1612, 110, 56, 'fountain', { hid: 1 }); ob(1672, 1585, 56, 110, 'fountain', { hid: 1 }); ob(1653, 1593, 94, 94, 'fountain', { hid: 1 });
    dec('fountain', 1640, 1580, 120, 120);
    for (const [x, y, w, h] of [[1500, 1500, 64, 16], [1836, 1500, 64, 16], [1500, 1776, 64, 16], [1836, 1776, 64, 16], [1452, 1540, 16, 60], [1932, 1540, 16, 60]]) ob(x, y, w, h, 'bench');
    for (const [x, y] of [[1460, 1460], [1900, 1460], [1460, 1800], [1900, 1800]]) ob(x, y, 40, 40, 'planter');
    ob(1520, 1700, 52, 30, 'kiosk');
    // 花園：外圈與內圈綠籬
    const hedgeRing = (x0, y0, x1, y1, t, gw) => {
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      for (const [s, e] of cut(x0, x1, [[mx, gw]])) { ob(s, y0, e - s, t, 'hedge'); ob(s, y1 - t, e - s, t, 'hedge'); }
      for (const [s, e] of cut(y0 + t, y1 - t, [[my, gw]])) { ob(x0, s, t, e - s, 'hedge'); ob(x1 - t, s, t, e - s, 'hedge'); }
    };
    hedgeRing(580, 1400, 1060, 1900, 22, 86);
    hedgeRing(690, 1520, 950, 1780, 20, 70);
    for (const [x, y, s] of [[612, 1432, 72], [966, 1432, 72], [612, 1796, 72], [966, 1796, 72], [712, 1542, 40], [888, 1542, 40], [712, 1718, 40], [888, 1718, 40]]) dec('roseBed', x, y, s, s);
    // 網球場圍網（子彈可穿過）
    const fence = (x, y, w, h) => ob(x, y, w, h, 'fence', { b: false });
    for (const [s, e] of cut(1540, 1860, [[1700, 70]])) { fence(s, 2300, e - s, 6); fence(s, 2514, e - s, 6); }
    for (const [s, e] of cut(2306, 2514, [[2410, 60]])) { fence(1540, s, 6, e - s); fence(1854, s, 6, e - s); }
    ob(1698, 2345, 4, 130, 'net', { b: false });
    // 停車場：三排車
    const CAR_C = ['#ffb6c9', '#ffffff', '#efd9a8', '#a8e2d0', '#a9c9f2', '#3b2a35', '#d9c3f2', '#f5f0e8'];
    [[2190, [2, 5]], [2306, [0, 4, 7]], [2420, [1, 3, 6]]].forEach(([y, skip], row) => {
      for (let i = 0; i < 8; i++) {
        dec('slot', 846 + i * 62, y - 6, 48, 86);
        if (skip.includes(i)) continue;
        ob(850 + i * 62, y, 40, 74, 'car', { c: CAR_C[(i * 3 + row * 5) % CAR_C.length], up: row === 2 });
      }
    });
    ob(880, 2500, 170, 34, 'limo', { c: '#f7a8c4' });
    // 碼頭：木棧橋（陸地延伸）與遊艇
    for (const [px, len] of [[2470, 420], [2650, 400], [2830, 360]]) {
      let y = 2200; while (y < 3300 && inIsland(px + 20, y)) y += 10;
      const pier = { x: px, y: y - 70, w: 40, h: len + 70 };
      M.piers.push(pier);
      for (const [dx, dy, w, h] of [[56, 100, 62, 176], [-80, 190, 60, 160]]) {
        const yx = px + dx, yy = y + dy;
        if (![[yx, yy], [yx + w, yy], [yx, yy + h], [yx + w, yy + h]].some(([a, b]) => inIsland(a, b))) ob(yx, yy, w, h, 'yacht', { c: (px / 10) % 2 ? '#ffffff' : '#fff1f6' });
      }
    }
    // 停機坪旁的貨櫃與零星掩體
    for (const [x, y] of [[2120, 2520], [2168, 2532], [2600, 2290], [2600, 2336], [1450, 2380], [1100, 2600], [2580, 1500], [1210, 1500], [2000, 1480], [1480, 1960], [960, 2000], [700, 2000], [2700, 2100], [2900, 1450], [2240, 1120], [1560, 760], [900, 980], [500, 1700], [1820, 2620], [2050, 2600]]) {
      if (inIsland(x, y)) ob(x, y, 38, 38, 'crate');
    }
    // 沙灘躺椅與陽傘（裝飾）
    for (let a = -2.42; a < -1.9; a += 0.07) { const r = ISL(a) - 70; M.loungers.push({ x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, a: a + Math.PI / 2 }); }
    for (let a = 0.15; a < 0.45; a += 0.075) { const r = ISL(a) - 60; M.loungers.push({ x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, a: a + Math.PI / 2 }); }

    // ===== 樹、石頭、草叢（避開建築、道路、區域） =====
    const busy = (x, y, m) => M.bld.some(b => inRect(b, x, y, m + 6)) || M.roads.some(r => inRect(r, x, y, m - 6)) || M.areas.some(r => r.k !== 'garden' && inRect(r, x, y, m - 10)) || M.obs.some(o => inRect(o, x, y, m)) || M.decor.some(o => inRect(o, x, y, m - 10));
    for (let k = 0, n = 0; k < 3000 && n < 150; k++) {
      const x = rng.range(250, 3150), y = rng.range(250, 3150);
      const cd = coastDist(x, y);
      if (cd < 30 || busy(x, y, 30) || M.trees.some(t => (t.x - x) ** 2 + (t.y - y) ** 2 < 85 * 85)) continue;
      if (x > 560 && x < 1080 && y > 1380 && y < 1920 && !(rng() < 0.15)) continue;
      const palm = cd < 260 || rng() < 0.55;
      M.trees.push({ x, y, s: rng.range(0.85, 1.2), palm, rot: rng() * TAU, v: rng.int(0, 2) });
      ob(x - 7, y - 7, 14, 14, 'trunk', { hid: 1 });
      n++;
    }
    for (let k = 0, n = 0; k < 800 && n < 26; k++) {
      const a = rng() * TAU, r = ISL(a) - rng.range(25, 75), x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r;
      if (busy(x, y, 40) || M.piers.some(p => inRect(p, x, y, 60))) continue;
      const s = rng.range(26, 46);
      ob(x - s / 2, y - s / 2, s, s * rng.range(0.7, 1), 'rock');
      n++;
    }
    for (let k = 0, n = 0; k < 2000 && n < 90; k++) {
      const x = rng.range(300, 3100), y = rng.range(300, 3100);
      if (coastDist(x, y) < 120 || busy(x, y, 24)) continue;
      M.bushes.push({ x, y, r: rng.range(14, 24), c: rng.int(0, 2) });
      n++;
    }
    for (let k = 0, n = 0; k < 2000 && n < 60; k++) {
      const x = rng.range(300, 3100), y = rng.range(300, 3100);
      if (coastDist(x, y) < 140 || busy(x, y, 30)) continue;
      M.flowers.push({ x, y, r: rng.range(26, 54), c: rng.int(0, 3), seed: rng.int(1, 1e6) });
      n++;
    }

    // ===== 物資點 =====
    const freeAt = (x, y, rad) => isLand(M, x, y) && !M.obs.some(o => inRect(o, x, y, rad));
    const addSpots = (x0, y0, w, h, n, tier, bi = -1) => {
      for (let k = 0, made = 0; k < n * 12 && made < n; k++) {
        const x = rng.range(x0, x0 + w), y = rng.range(y0, y0 + h);
        if (!freeAt(x, y, 22) || M.spots.some(s => (s.x - x) ** 2 + (s.y - y) ** 2 < 46 * 46)) continue;
        M.spots.push({ x, y, tier, b: bi }); made++;
      }
    };
    for (const b of M.bld) addSpots(b.x + 26, b.y + 26, b.w - 52, b.h - 52, Math.max(2, Math.round(b.w * b.h / 6000)), b.tier, b.i);
    addSpots(580, 1400, 480, 500, 10, 2);
    addSpots(1420, 1440, 560, 400, 6, 1);
    addSpots(820, 2160, 520, 380, 7, 1);
    addSpots(1540, 2300, 320, 220, 3, 1);
    addSpots(2110, 2240, 440, 270, 4, 2);
    addSpots(1340, 870, 720, 500, 4, 1);
    for (const p of M.piers) addSpots(p.x + 4, p.y + p.h - 120, p.w - 8, 110, 1, 2);
    for (let k = 0, n = 0; k < 4000 && n < 80; k++) {
      const x = rng.range(300, 3100), y = rng.range(300, 3100);
      if (coastDist(x, y) < 40 || busy(x, y, 20) || !freeAt(x, y, 22)) continue;
      M.spots.push({ x, y, tier: 0, b: -1 }); n++;
    }

    // ===== 地名 =====
    M.labels = [
      ['ERIKA 百貨', 1700, 1120, 1], ['中央廣場', 1700, 1500, 0], ['香榭精品街', 2370, 1580, 1], ['海景別墅區', 2330, 700, 0], ['沙灘俱樂部', 1090, 650, 0],
      ['玫瑰花園', 820, 1360, 1], ['婚禮教堂', 710, 1050, 0], ['貴賓停車場', 1080, 2580, 0], ['皇家遊艇碼頭', 2520, 2560, 1], ['網球場', 1700, 2560, 0],
      ['VIP 會所', 2800, 1810, 0], ['SPA 會館', 2000, 1950, 0], ['觀景台', 1700, 530, 0], ['甜點咖啡廳', 1140, 1935, 0],
    ];

    // ===== 網格 =====
    M.grid = Array.from({ length: GN * GN }, () => []);
    for (const o of M.obs) {
      const i0 = clamp(Math.floor(o.x / CELL), 0, GN - 1), i1 = clamp(Math.floor((o.x + o.w) / CELL), 0, GN - 1);
      const j0 = clamp(Math.floor(o.y / CELL), 0, GN - 1), j1 = clamp(Math.floor((o.y + o.h) / CELL), 0, GN - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) M.grid[j * GN + i].push(o.i);
    }
    M.bgrid = Array.from({ length: GN * GN }, () => []);
    for (const b of M.bld) {
      for (let j = Math.floor(b.y / CELL); j <= Math.floor((b.y + b.h) / CELL); j++) for (let i = Math.floor(b.x / CELL); i <= Math.floor((b.x + b.w) / CELL); i++) M.bgrid[j * GN + i].push(b.i);
    }
    M.mark = new Uint32Array(M.obs.length); M.stamp = 0;
    M.nav = buildNav(M);
    M.pather = makePather(M.nav);
    return M;
  }

  // ---------- 幾何 ----------
  function segAabb(x, y, dx, dy, o) {
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-9) { if (x < o.x || x > o.x + o.w) return -1; }
    else { let a = (o.x - x) / dx, b = (o.x + o.w - x) / dx; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return -1; }
    if (Math.abs(dy) < 1e-9) { if (y < o.y || y > o.y + o.h) return -1; }
    else { let a = (o.y - y) / dy, b = (o.y + o.h - y) / dy; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return -1; }
    return t0;
  }
  function segCircle(x, y, dx, dy, cx, cy, r) {
    const fx = x - cx, fy = y - cy, a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
    if (c <= 0) return 0;
    if (a < 1e-9) return -1;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : -1;
  }
  // 線段與障礙物（只算擋子彈的）：回傳 { t, o } 或 null
  function rayObs(M, x1, y1, x2, y2, all) {
    const dx = x2 - x1, dy = y2 - y1;
    let cx = clamp(Math.floor(x1 / CELL), 0, GN - 1), cy = clamp(Math.floor(y1 / CELL), 0, GN - 1);
    const ex = clamp(Math.floor(x2 / CELL), 0, GN - 1), ey = clamp(Math.floor(y2 / CELL), 0, GN - 1);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(CELL / dx) : Infinity, tdy = dy !== 0 ? Math.abs(CELL / dy) : Infinity;
    let tmx = dx !== 0 ? (dx > 0 ? (cx + 1) * CELL - x1 : x1 - cx * CELL) / Math.abs(dx) : Infinity;
    let tmy = dy !== 0 ? (dy > 0 ? (cy + 1) * CELL - y1 : y1 - cy * CELL) / Math.abs(dy) : Infinity;
    let best = 2, bo = null;
    const st = ++M.stamp;
    for (let n = 0; n < 80; n++) {
      for (const oi of M.grid[cy * GN + cx]) {
        if (M.mark[oi] === st) continue;
        M.mark[oi] = st;
        const o = M.obs[oi];
        if (!o.b && !all) continue;
        const t = segAabb(x1, y1, dx, dy, o);
        if (t >= 0 && t < best) { best = t; bo = o; }
      }
      if (best <= Math.min(tmx, tmy) || (cx === ex && cy === ey)) break;
      if (tmx < tmy) { tmx += tdx; cx += sx; } else { tmy += tdy; cy += sy; }
      if (cx < 0 || cy < 0 || cx >= GN || cy >= GN) break;
    }
    return best <= 1 ? { t: best, o: bo } : null;
  }
  const losClear = (M, x1, y1, x2, y2) => !rayObs(M, x1, y1, x2, y2);
  // 圓形角色推出障礙物
  function pushOut(M, p, r) {
    const i0 = clamp(Math.floor((p.x - r) / CELL), 0, GN - 1), i1 = clamp(Math.floor((p.x + r) / CELL), 0, GN - 1);
    const j0 = clamp(Math.floor((p.y - r) / CELL), 0, GN - 1), j1 = clamp(Math.floor((p.y + r) / CELL), 0, GN - 1);
    let hit = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      for (const oi of M.grid[j * GN + i]) {
        const o = M.obs[oi];
        const nx = clamp(p.x, o.x, o.x + o.w), ny = clamp(p.y, o.y, o.y + o.h);
        const dx = p.x - nx, dy = p.y - ny, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.y += dy * k; }
        else {
          const l = p.x - o.x, rr = o.x + o.w - p.x, t = p.y - o.y, b = o.y + o.h - p.y, m = Math.min(l, rr, t, b);
          if (m === l) p.x = o.x - r; else if (m === rr) p.x = o.x + o.w + r; else if (m === t) p.y = o.y - r; else p.y = o.y + o.h + r;
        }
      }
    }
    return hit;
  }
  function buildingAt(M, x, y) {
    if (x < 0 || y < 0 || x >= MAP || y >= MAP) return -1;
    for (const bi of M.bgrid[Math.floor(y / CELL) * GN + Math.floor(x / CELL)]) { const b = M.bld[bi]; if (inRect(b, x, y, -4)) return bi; }
    return -1;
  }

  // ---------- 尋路（A*，20 單位格） ----------
  function buildNav(M) {
    const blk = new Uint8Array(NN * NN);
    for (let j = 0; j < NN; j++) for (let i = 0; i < NN; i++) if (!isLand(M, (i + 0.5) * NAV, (j + 0.5) * NAV)) blk[j * NN + i] = 1;
    const m = PR - 3;
    for (const o of M.obs) {
      const i0 = Math.max(0, Math.ceil((o.x - m) / NAV - 0.5)), i1 = Math.min(NN - 1, Math.floor((o.x + o.w + m) / NAV - 0.5));
      const j0 = Math.max(0, Math.ceil((o.y - m) / NAV - 0.5)), j1 = Math.min(NN - 1, Math.floor((o.y + o.h + m) / NAV - 0.5));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blk[j * NN + i] = 1;
    }
    return blk;
  }
  const navIdx = (x, y) => clamp(Math.floor(y / NAV), 0, NN - 1) * NN + clamp(Math.floor(x / NAV), 0, NN - 1);
  const navFree = (M, x, y) => !M.nav[navIdx(x, y)];
  function navClear(M, x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.ceil(d / 8);
    for (let k = 1; k <= n; k++) { const t = k / n; if (M.nav[navIdx(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)]) return false; }
    return true;
  }
  function nearestFree(M, x, y, maxR = 8) {
    const ci = clamp(Math.floor(x / NAV), 0, NN - 1), cj = clamp(Math.floor(y / NAV), 0, NN - 1);
    if (!M.nav[cj * NN + ci]) return [x, y];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = Infinity;
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (i < 0 || j < 0 || i >= NN || j >= NN || (Math.abs(i - ci) !== r && Math.abs(j - cj) !== r) || M.nav[j * NN + i]) continue;
        const px = (i + 0.5) * NAV, py = (j + 0.5) * NAV, d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bd) { bd = d; best = [px, py]; }
      }
      if (best) return best;
    }
    return null;
  }
  function makePather(blk) {
    const N = NN * NN, g = new Float32Array(N), from = new Int32Array(N), seen = new Uint32Array(N), done = new Uint32Array(N);
    const CAP = N * 4, heap = new Int32Array(CAP), hf = new Float32Array(CAP);
    let stamp = 0, hn = 0;
    const push = (i, f) => { if (hn >= CAP) return; let k = hn++; while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= f) break; heap[k] = heap[p]; hf[k] = hf[p]; k = p; } heap[k] = i; hf[k] = f; };
    const pop = () => { const top = heap[0], li = heap[--hn], lf = hf[hn]; let k = 0; for (;;) { let c = 2 * k + 1; if (c >= hn) break; if (c + 1 < hn && hf[c + 1] < hf[c]) c++; if (hf[c] >= lf) break; heap[k] = heap[c]; hf[k] = hf[c]; k = c; } heap[k] = li; hf[k] = lf; return top; };
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1], DC = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];
    return function find(M, sx, sy, tx, ty, maxIter = 9000) {
      const s = nearestFree(M, sx, sy, 3), t = nearestFree(M, tx, ty, 6);
      if (!s || !t) return null;
      const si = navIdx(s[0], s[1]), ti = navIdx(t[0], t[1]);
      const tix = ti % NN, tiy = (ti / NN) | 0;
      stamp++; hn = 0;
      g[si] = 0; seen[si] = stamp; from[si] = -1; push(si, 0);
      let found = false, it = 0;
      while (hn > 0 && it++ < maxIter) {
        const c = pop();
        if (done[c] === stamp) continue;
        done[c] = stamp;
        if (c === ti) { found = true; break; }
        const cx = c % NN, cy = (c / NN) | 0;
        for (let k = 0; k < 8; k++) {
          const nx = cx + DX[k], ny = cy + DY[k];
          if (nx < 0 || ny < 0 || nx >= NN || ny >= NN) continue;
          const n = ny * NN + nx;
          if (blk[n] || done[n] === stamp) continue;
          if (k >= 4 && (blk[cy * NN + nx] || blk[ny * NN + cx])) continue;
          const ng = g[c] + DC[k];
          if (seen[n] === stamp && ng >= g[n]) continue;
          seen[n] = stamp; g[n] = ng; from[n] = c;
          const hx = Math.abs(nx - tix), hy = Math.abs(ny - tiy);
          push(n, ng + Math.max(hx, hy) + 0.414 * Math.min(hx, hy));
        }
      }
      if (!found) return null;
      const raw = [];
      for (let c = ti; c !== -1; c = from[c]) raw.push(c);
      raw.reverse();
      // 拉直：從目前點找最遠可直達的節點
      const pts = [];
      let cx = sx, cy = sy, k = 0;
      while (k < raw.length) {
        let j = Math.min(raw.length - 1, k + 40);
        for (; j > k; j--) { const px = (raw[j] % NN + 0.5) * NAV, py = (((raw[j] / NN) | 0) + 0.5) * NAV; if (navClear(M, cx, cy, px, py)) break; }
        const px = (raw[j] % NN + 0.5) * NAV, py = (((raw[j] / NN) | 0) + 0.5) * NAV;
        pts.push(px, py); cx = px; cy = py; k = j + 1;
      }
      pts.push(t[0], t[1]);
      return pts;
    };
  }

  // ---------- 毒圈 ----------
  const ZONES = [
    { wait: 72, shrink: 40, r: 1050, dps: 1.5 },
    { wait: 40, shrink: 32, r: 680, dps: 3 },
    { wait: 32, shrink: 28, r: 420, dps: 5 },
    { wait: 26, shrink: 22, r: 240, dps: 8 },
    { wait: 20, shrink: 18, r: 110, dps: 12 },
    { wait: 14, shrink: 16, r: 0, dps: 18 },
  ];
  const ZONE_TOTAL = ZONES.reduce((a, z) => a + z.wait + z.shrink, 0);
  // 下一個安全區：完全包在目前的圈裡，圓心落在陸地上
  function nextZone(cur, newR, rng, okFn) {
    const room = Math.max(0, cur.r - newR);
    let best = null;
    for (let k = 0; k < 60; k++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * room * (cur.first ? 0.45 : 1);
      const x = cur.x + Math.cos(a) * d, y = cur.y + Math.sin(a) * d;
      if (!okFn || okFn(x, y)) { best = { x, y }; break; }
    }
    if (!best) best = { x: cur.x, y: cur.y };
    return { x: best.x, y: best.y, r: newR };
  }
  function makeZone(m) {
    const z = { i: 0, st: 'wait', t: ZONES[0].wait, x: CX, y: CY, r: 1800, ax: CX, ay: CY, ar: 1800, dps: 0 };
    const nz = nextZone({ x: CX, y: CY, r: 1800 - 360, first: true }, ZONES[0].r, m.rng, (x, y) => inIsland(x, y) && coastDist(x, y) > 500);
    z.bx = nz.x; z.by = nz.y; z.br = nz.r;
    return z;
  }
  // 推進毒圈；回傳事件字串（或 null）
  function stepZone(z, dt, rng, okFn) {
    if (z.st === 'end') return null;
    const P = ZONES[z.i];
    const prev = z.t;
    z.t -= dt;
    let ev = null;
    if (z.st === 'wait') {
      if (prev > 30 && z.t <= 30 && P.wait > 34) ev = 'warn30';
      if (z.t <= 0) { z.st = 'shrink'; z.t += P.shrink; z.ax = z.x; z.ay = z.y; z.ar = z.r; z.dps = P.dps; ev = 'shrink'; }
    } else if (z.st === 'shrink') {
      const k = clamp(1 - z.t / P.shrink, 0, 1);
      z.x = lerp(z.ax, z.bx, k); z.y = lerp(z.ay, z.by, k); z.r = lerp(z.ar, z.br, k);
      if (z.t <= 0) {
        z.x = z.bx; z.y = z.by; z.r = z.br;
        z.i++;
        if (z.i >= ZONES.length) { z.st = 'end'; z.dps = ZONES[ZONES.length - 1].dps * 1.5; ev = 'final'; }
        else {
          z.st = 'wait'; z.t += ZONES[z.i].wait;
          const nz = nextZone({ x: z.x, y: z.y, r: z.r }, ZONES[z.i].r, rng, okFn);
          z.bx = nz.x; z.by = nz.y; z.br = nz.r;
          ev = 'next';
        }
      }
    }
    return ev;
  }
  const insideZone = (z, x, y) => (x - z.x) ** 2 + (y - z.y) ** 2 <= z.r * z.r;
  // 距離「目標安全區」縮完還剩幾秒
  const zoneTimeLeft = z => (z.st === 'wait' ? z.t + ZONES[z.i].shrink : z.st === 'shrink' ? z.t : 0);

  // ---------- 物資 ----------
  const TIER_GUN = [
    [['pistol', 45], ['smg', 30], ['shotgun', 20], ['rifle', 5]],
    [['pistol', 25], ['smg', 35], ['shotgun', 25], ['rifle', 12], ['sniper', 3]],
    [['pistol', 10], ['smg', 30], ['shotgun', 20], ['rifle', 30], ['sniper', 10]],
    [['pistol', 5], ['smg', 20], ['shotgun', 15], ['rifle', 40], ['sniper', 20]],
  ];
  const TIER_RAR = [[[0, 70], [1, 25], [2, 5]], [[0, 55], [1, 30], [2, 12], [3, 3]], [[0, 35], [1, 35], [2, 20], [3, 9], [4, 1]], [[0, 20], [1, 30], [2, 30], [3, 17], [4, 3]]];
  const TIER_LV = [[[1, 80], [2, 20]], [[1, 60], [2, 35], [3, 5]], [[1, 40], [2, 45], [3, 15]], [[1, 25], [2, 45], [3, 30]]];
  function rollItem(rng, tier) {
    const x = rng();
    if (x < 0.44) return { k: 'gun', w: rng.wpick(TIER_GUN[tier]), r: rng.wpick(TIER_RAR[tier]) };
    if (x < 0.56) { const lv = rng.wpick(TIER_LV[tier]); return { k: 'armor', lv, dur: ARMOR[lv].dur }; }
    if (x < 0.68) { const lv = rng.wpick(TIER_LV[tier]); return { k: 'helmet', lv, dur: ARMOR[lv].dur }; }
    const h = rng.wpick([['bandage', 50], ['medkit', 18 + tier * 4], ['drink', 30]]);
    return { k: 'heal', t: h, n: h === 'bandage' ? rng.int(2, 5) : h === 'drink' ? rng.int(1, 2) : 1 };
  }
  const gearVal = g => (g && g.dur > 0 ? g.lv * 100 + (g.dur / ARMOR[g.lv].dur) * 60 : 0);
  // 撿起這個東西對角色有多少好處（0 = 不需要）
  function itemValue(p, it) {
    if (it.k === 'gun') {
      const s = gunScore(it), same = p.guns.findIndex(g => g && g.w === it.w);
      if (same >= 0) return s > gunScore(p.guns[same]) + 2 ? s - gunScore(p.guns[same]) : 0;
      if (!p.guns[0] || !p.guns[1]) return s;
      const lo = gunScore(p.guns[0]) <= gunScore(p.guns[1]) ? 0 : 1;
      return s > gunScore(p.guns[lo]) + 3 ? s - gunScore(p.guns[lo]) : 0;
    }
    if (it.k === 'armor' || it.k === 'helmet') { const d = gearVal(it) - gearVal(p[it.k]); return d > 12 ? d / 6 : 0; }
    if (it.k === 'heal') { const room = HEALS[it.t].cap - p.heals[it.t]; return room > 0 ? Math.min(room, it.n) * HEALS[it.t].val : 0; }
    return 0;
  }
  // 拿取（會把換下的東西丟在地上）；回傳 true 表示這件東西已經拿完
  function takeItem(m, p, it) {
    if (it.k === 'gun') {
      const g = { w: it.w, r: it.r, ammo: it.ammo != null ? it.ammo : magOf(it.w, it.r) };
      const same = p.guns.findIndex(x => x && x.w === it.w);
      const slot = same >= 0 ? same : !p.guns[0] ? 0 : !p.guns[1] ? 1 : gunScore(p.guns[0]) <= gunScore(p.guns[1]) ? 0 : 1;
      const old = p.guns[slot];
      p.guns[slot] = g;
      if (old) dropItem(m, { k: 'gun', w: old.w, r: old.r, ammo: old.ammo }, p.x, p.y);
      const cur = p.guns[p.cur];
      if (!cur || slot === p.cur || gunScore(g) > gunScore(cur)) { p.cur = slot; p.reloadT = 0; }
      return true;
    }
    if (it.k === 'armor' || it.k === 'helmet') {
      const old = p[it.k];
      p[it.k] = { lv: it.lv, dur: it.dur };
      if (old && old.dur > 8) dropItem(m, { k: it.k, lv: old.lv, dur: old.dur }, p.x, p.y);
      return true;
    }
    if (it.k === 'heal') {
      const n = Math.min(HEALS[it.t].cap - p.heals[it.t], it.n);
      p.heals[it.t] += n; it.n -= n;
      return it.n <= 0;
    }
    return true;
  }
  function addItem(m, it, x, y) {
    it.id = m.nid++; it.x = x; it.y = y; it.born = m.t;
    it.cell = clamp(Math.floor(y / CELL), 0, GN - 1) * GN + clamp(Math.floor(x / CELL), 0, GN - 1);
    m.igrid[it.cell].push(it); m.items.push(it);
    return it;
  }
  function removeItem(m, it) {
    const c = m.igrid[it.cell], i = c.indexOf(it); if (i >= 0) c.splice(i, 1);
    const j = m.items.indexOf(it); if (j >= 0) m.items.splice(j, 1);
    it.gone = true;
  }
  function dropItem(m, it, x, y) {
    for (let k = 0; k < 8; k++) {
      const a = m.rng() * TAU, d = 26 + m.rng() * 18, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (navFree(m.map, px, py)) return addItem(m, it, px, py);
    }
    return addItem(m, it, x, y);
  }
  function spawnLoot(m) {
    for (const s of m.map.spots) {
      if (m.rng() > 0.94) continue;
      const n = m.rng() < 0.45 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const it = rollItem(m.rng, s.tier);
        const a = m.rng() * TAU, d = k ? 18 : 0;
        addItem(m, it, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d);
      }
    }
  }
  function autoPickup(m, p) {
    let got = null;
    const ci = clamp(Math.floor(p.x / CELL), 0, GN - 1), cj = clamp(Math.floor(p.y / CELL), 0, GN - 1);
    const R2 = (PR + 14) ** 2;
    for (let j = Math.max(0, cj - 1); j <= Math.min(GN - 1, cj + 1); j++) for (let i = Math.max(0, ci - 1); i <= Math.min(GN - 1, ci + 1); i++) {
      const cell = m.igrid[j * GN + i];
      for (let k = cell.length - 1; k >= 0; k--) {
        const it = cell[k];
        if (it.gone || (it.x - p.x) ** 2 + (it.y - p.y) ** 2 > R2 || m.t - it.born < 0.4) continue;
        if (itemValue(p, it) <= 0) continue;
        const done = takeItem(m, p, it);
        (got = got || []).push({ k: it.k, w: it.w, r: it.r, lv: it.lv, t: it.t, n: it.n });
        if (done) removeItem(m, it);
      }
    }
    for (const b of m.boxes) {
      if (b.alt > 0 || !b.items.length || (b.x - p.x) ** 2 + (b.y - p.y) ** 2 > (PR + 22) ** 2) continue;
      for (let k = b.items.length - 1; k >= 0; k--) {
        const it = b.items[k];
        if (itemValue(p, it) <= 0) continue;
        if (takeItem(m, p, it)) b.items.splice(k, 1);
        (got = got || []).push({ k: it.k, w: it.w, r: it.r, lv: it.lv, t: it.t, box: b.kind });
      }
      if (!b.items.length) b.empty = m.t;
    }
    if (got) m.ev.push({ e: 'pick', p: p.id, list: got });
    return got;
  }

  // ---------- 角色 ----------
  const NAMES = ['林芷涵', '陳語彤', '王詩涵', '張雅婷', '李思妤', '黃宥蓁', '吳品妍', '劉心怡', '蔡佳穎', '楊子晴', '許芯瑜', '鄭婕妤', '謝欣妍', '洪苡安', '郭宜蓁',
    '曾詠晴', '邱語恩', '廖芊妤', '賴沛晴', '周筱涵', '葉禹彤', '蘇以柔', '莊詠心', '呂巧彤', '江若曦', '何芷晴', '羅可馨', '高雨萱', '簡妍希', '范書瑤',
    '沈語蕎', '彭映彤', '潘思穎', '杜筱婷', '戴語涵', '夏苡晨', '鍾采潔', '汪芊樺', '田舒涵', '方穎蓁', '石安琪', '姚妍廷', '馮子芸', '韓詩婷', '唐語萱',
    '孫藝心', '白若綺', '程晴安', '袁妤瑄', '傅宣妤', '溫可欣', '宋芷瑜', '柯恩綺', '施語喬', '游欣霏', '翁宇彤', '康妍蓉', '余佳蓉', '馬筠婷', '凌映萱', '季苡恩', '藍語柔'];
  function makeActor(id, name) {
    return {
      id, name, human: false, look: 0, x: 0, y: 0, vx: 0, vy: 0, alive: true, state: 'plane', hp: 100, maxHp: 100, boost: 0,
      armor: null, helmet: null, guns: [null, null], cur: 0, fireCd: 0, reloadT: 0, heal: null, heals: { bandage: 0, medkit: 0, drink: 0 },
      aim: 0, kills: 0, dmg: 0, rank: 0, deathT: 0, killer: -1, lastHitBy: -1, lastHitT: -99, lastShotT: -99, flash: 0, invuln: 0, moving: false, bin: -1, pickT: 0,
      jumpU: 0.5, tx: 0, ty: 0, chute: null, landT: -1, zoneHurt: false,
      input: { mx: 0, my: 0, aim: 0, fire: false, manual: false, reload: false, sw: false, heal: null, jump: false },
      ai: null, autoTarget: -1,
    };
  }
  function aiParams(d) {
    return {
      d, aimErr: lerp(0.22, 0.075, d), react: lerp(0.8, 0.3, d), vision: lerp(320, 450, d), think: lerp(0.42, 0.24, d), notice: lerp(0.05, 0.11, d),
      turn: lerp(5, 11, d), lead: lerp(0.15, 0.9, d), cover: lerp(0.25, 0.85, d), healThr: lerp(34, 58, d),
      zoneMargin: lerp(-4, 12, d), burst: lerp(0.5, 1.5, d), loot: lerp(280, 400, d), brave: lerp(0.25, 0.7, d),
    };
  }

  // ---------- 對局 ----------
  function makePlane(rng) {
    const a = rng() * TAU, off = rng.range(-480, 480), nx = -Math.sin(a), ny = Math.cos(a);
    const cx = CX + nx * off, cy = CY + ny * off, L = 2350;
    return { x0: cx - Math.cos(a) * L, y0: cy - Math.sin(a) * L, x1: cx + Math.cos(a) * L, y1: cy + Math.sin(a) * L, a, dur: 27, u: 0, x: 0, y: 0, gone: false };
  }
  const planeAt = (pl, u) => [lerp(pl.x0, pl.x1, u), lerp(pl.y0, pl.y1, u)];
  // 給定目標點，飛機何時最接近（u 值）
  function closestU(pl, x, y) {
    const dx = pl.x1 - pl.x0, dy = pl.y1 - pl.y0;
    return clamp(((x - pl.x0) * dx + (y - pl.y0) * dy) / (dx * dx + dy * dy), 0.1, 0.9);
  }
  // 第一個在島上的 u、最後一個在島上的 u
  function planeLandSpan(pl) {
    let a = -1, b = -1;
    for (let u = 0; u <= 1; u += 0.01) { const [x, y] = planeAt(pl, u); if (inIsland(x, y)) { if (a < 0) a = u; b = u; } }
    return [Math.max(0.05, a), Math.min(0.95, b)];
  }

  function createMatch(o = {}) {
    const map = getMap();
    const n = o.n || 50;
    const rng = makeRng((o.seed >>> 0) || 1);
    const diff = clamp(o.diff == null ? 0.3 : o.diff, 0, 1);
    const m = {
      map, rng, t: 0, players: [], items: [], boxes: [], bullets: [], ev: [], shotLog: [], nid: 1, diff, over: false, winner: null,
      superAim: !!o.superAim, autoAim: o.autoAim !== false, botToHuman: lerp(0.55, 0.88, diff), botToBot: lerp(0.24, 0.16, diff), pathBudget: 0, human: null, alive: n, n,
      igrid: Array.from({ length: GN * GN }, () => []), pHead: new Int32Array(GN * GN), pNext: new Int32Array(n), drops: [{ t: 118 }, { t: 238 }], zoneDeaths: 0,
    };
    m.zone = makeZone(m);
    m.plane = makePlane(rng);
    const span = planeLandSpan(m.plane);
    m.plane.span = span;
    spawnLoot(m);
    const names = (o.names || NAMES).slice();
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    const spots = map.spots;
    for (let i = 0; i < n; i++) {
      const human = i === 0 && !!o.human;
      const p = makeActor(i, human ? (o.humanName || 'Erika') : names[i % names.length]);
      p.human = human;
      p.look = human ? -1 : rng.int(0, 29);
      if (human) { m.human = p; p.tx = NaN; }
      else {
        const d = clamp(diff + rng.gauss() * 0.13, 0, 1);
        p.ai = { P: aiParams(d), mode: 'loot', thinkT: rng() * 0.4, target: null, seenT: -99, react: 0, err: 0, errGoal: 0, errT: 0, strafe: rng() < 0.5 ? 1 : -1, strafeT: 0,
          calm: 20 + 130 * rng() ** 1.4, calmUntil: 0, passive: rng() < lerp(0.5, 0.3, d), gx: null, gy: null, path: null, pi: 0, pgx: 0, pgy: 0, directT: 0, direct: false, stuckT: 1, sx: 0, sy: 0, stuck: 0, los: false, burstT: 0, cover: null, zph: -1, zgx: 0, zgy: 0, roamT: 0, lootRef: null };
        // 降落點：偏好高級物資區，但彼此分散（少數人會刻意搶熱門點）
        let tx = CX, ty = CY;
        const hot = rng() < 0.18;
        for (let k = 0; k < 30; k++) {
          if (rng() < 0.7) { const s = spots[Math.floor(rng() * spots.length)]; const s2 = spots[Math.floor(rng() * spots.length)]; const pick = s2.tier > s.tier ? s2 : s; tx = pick.x + rng.range(-40, 40); ty = pick.y + rng.range(-40, 40); }
          else { tx = rng.range(450, 2950); ty = rng.range(450, 2950); }
          if (!inIsland(tx, ty)) continue;
          if (hot || k > 26 || !m.players.some(q => !q.human && (q.tx - tx) ** 2 + (q.ty - ty) ** 2 < 260 * 260)) break;
        }
        const f = nearestFree(map, tx, ty, 10) || [CX, CY];
        p.tx = f[0]; p.ty = f[1];
        p.jumpU = clamp(closestU(m.plane, p.tx, p.ty) + rng.range(-0.05, 0.03), span[0], span[1]);
      }
      m.players.push(p);
    }
    if (m.human) {
      const h = m.human;
      // 連動加成：英雄等級／星數提高血量、王國研究給開局防彈衣、時尚加成給頭盔
      h.maxHp = h.hp = Math.round(100 * clamp(o.hpMul || 1, 1, 3));
      const al = clamp(Math.max(o.kit ? 2 : 0, o.armorLv | 0), 0, 3), hl = clamp(Math.max(o.kit ? 2 : 0, o.helmetLv | 0), 0, 3);
      if (al) h.armor = { lv: al, dur: ARMOR[al].dur };
      if (hl) h.helmet = { lv: hl, dur: ARMOR[hl].dur };
      if (o.kit) { h.guns[0] = { w: 'rifle', r: 2, ammo: magOf('rifle', 2) }; h.heals.bandage = 4; }
    }
    return m;
  }

  function rebuildPlayerGrid(m) {
    m.pHead.fill(-1);
    for (const p of m.players) {
      if (!p.alive || p.state !== 'ground') continue;
      const c = clamp(Math.floor(p.y / CELL), 0, GN - 1) * GN + clamp(Math.floor(p.x / CELL), 0, GN - 1);
      m.pNext[p.id] = m.pHead[c]; m.pHead[c] = p.id;
    }
  }
  // 範圍內的敵人（依距離排序）
  function enemiesNear(m, p, range) {
    const out = [];
    const r2 = range * range;
    const i0 = clamp(Math.floor((p.x - range) / CELL), 0, GN - 1), i1 = clamp(Math.floor((p.x + range) / CELL), 0, GN - 1);
    const j0 = clamp(Math.floor((p.y - range) / CELL), 0, GN - 1), j1 = clamp(Math.floor((p.y + range) / CELL), 0, GN - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      for (let q = m.pHead[j * GN + i]; q >= 0; q = m.pNext[q]) {
        if (q === p.id) continue;
        const e = m.players[q], d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
        if (d2 <= r2) out.push([d2, e]);
      }
    }
    out.sort((a, b) => a[0] - b[0]);
    return out;
  }
  // 看得到的最近敵人（有視線）
  function findVisibleEnemy(m, p, range, maxChecks = 4, roofCheck = false) {
    const list = enemiesNear(m, p, range);
    for (let k = 0; k < list.length && k < maxChecks; k++) {
      const e = list[k][1];
      if (roofCheck && e.bin >= 0 && e.bin !== p.bin && !m.map.bld[e.bin].gazebo) continue;
      if (losClear(m.map, p.x, p.y, e.x, e.y)) return { e, d: Math.sqrt(list[k][0]) };
    }
    return null;
  }
  const curGun = p => p.guns[p.cur];
  const hasHeal = p => p.heals.bandage > 0 || p.heals.medkit > 0;
  function startHeal(p, kind) {
    if (p.heal) return false;
    const mh = p.maxHp;
    if (kind === 'auto') kind = p.hp < mh * 0.55 && p.heals.medkit > 0 ? 'medkit' : p.hp < mh * 0.75 && p.heals.bandage > 0 ? 'bandage' : p.heals.medkit > 0 && p.hp < mh ? 'medkit' : p.heals.drink > 0 && p.boost < 80 ? 'drink' : null;
    if (!kind || p.heals[kind] <= 0) return false;
    if (kind === 'bandage' && p.hp >= mh * 0.75) return false;
    if (kind === 'medkit' && p.hp >= mh) return false;
    if (kind === 'drink' && p.boost >= 90) return false;
    p.heal = { k: kind, t: HEALS[kind].t, total: HEALS[kind].t };
    p.reloadT = 0;
    return true;
  }
  function finishHeal(m, p) {
    const k = p.heal.k;
    p.heals[k]--;
    if (k === 'bandage') p.hp = Math.max(p.hp, Math.min(p.maxHp * 0.75, p.hp + p.maxHp * 0.15));
    else if (k === 'medkit') p.hp = p.maxHp;
    else p.boost = Math.min(100, p.boost + 40);
    p.heal = null;
    m.ev.push({ e: 'healed', p: p.id, k });
  }
  function moveActor(m, p, dx, dy) {
    const M = m.map, ox = p.x, oy = p.y;
    p.x = clamp(p.x + dx, 20, MAP - 20); p.y = clamp(p.y + dy, 20, MAP - 20);
    pushOut(M, p, PR); pushOut(M, p, PR);
    if (!isLand(M, p.x, p.y)) {
      if (isLand(M, p.x, oy)) p.y = oy; else if (isLand(M, ox, p.y)) p.x = ox; else { p.x = ox; p.y = oy; }
      pushOut(M, p, PR);
    }
    return Math.abs(p.x - ox) + Math.abs(p.y - oy);
  }
  function fire(m, p, g) {
    const W = WEAPONS[g.w];
    g.ammo--;
    p.lastShotT = m.t;
    const acc = (p.human && m.superAim ? 0.45 : 1) * (p.moving ? 1.3 : 1);
    const hs = W.hs * (p.human ? (m.superAim ? 1.7 : 1.1) : 0.6 + 0.5 * p.ai.P.d);
    const mz = PR + 10 + (W.pel > 1 ? 14 : 18);
    for (let k = 0; k < W.pel; k++) {
      const a = p.aim + (W.pel > 1 ? (m.rng() * 2 - 1) * W.spread : m.rng.gauss() * W.spread * 0.6) * acc;
      const dx = Math.cos(a), dy = Math.sin(a);
      m.bullets.push({ x: p.x, y: p.y, sx: p.x + Math.cos(p.aim) * mz, sy: p.y + Math.sin(p.aim) * mz, dx, dy, spd: W.spd, d: 0, max: W.range, o: p.id, w: g.w, r: g.r, hs, human: p.human });
    }
    m.ev.push({ e: 'shot', p: p.id, x: p.x, y: p.y, a: p.aim, w: g.w });
    m.shotLog.push({ x: p.x, y: p.y, t: m.t, p: p.id });
    if (m.shotLog.length > 48) m.shotLog.shift();
  }
  function killActor(m, p, killer, w, head) {
    if (!p.alive) return;
    p.alive = false; p.state = 'dead'; p.hp = 0; p.deathT = m.t; p.rank = m.alive; p.heal = null;
    p.killer = killer ? killer.id : -1;
    m.alive--;
    if (killer && killer !== p) { killer.kills++; if (killer.ai) { killer.ai.calmUntil = m.t + 8 + m.rng() * 18; killer.ai.target = null; } }
    else m.zoneDeaths++;
    const items = [];
    for (const g of p.guns) if (g) items.push({ k: 'gun', w: g.w, r: g.r, ammo: g.ammo });
    if (p.armor && p.armor.dur > 8) items.push({ k: 'armor', lv: p.armor.lv, dur: p.armor.dur });
    if (p.helmet && p.helmet.dur > 8) items.push({ k: 'helmet', lv: p.helmet.lv, dur: p.helmet.dur });
    for (const t in p.heals) if (p.heals[t] > 0) items.push({ k: 'heal', t, n: p.heals[t] });
    if (!items.length) items.push({ k: 'heal', t: 'bandage', n: 2 });
    let bx = p.x, by = p.y;
    if (!navFree(m.map, bx, by)) { const f = nearestFree(m.map, bx, by, 4); if (f) { bx = f[0]; by = f[1]; } }
    m.boxes.push({ id: m.nid++, kind: 'death', x: bx, y: by, items, owner: p.id, name: p.name, alt: 0, t0: m.t });
    m.ev.push({ e: 'kill', killer: killer ? killer.id : -1, victim: p.id, w: w || null, head: !!head, x: p.x, y: p.y });
    if (m.alive <= 1) {
      m.over = true;
      m.winner = m.players.find(q => q.alive) || p;
      m.winner.rank = 1;
      m.ev.push({ e: 'end', winner: m.winner.id });
    }
  }
  function revive(m, p) {
    if (p.alive) return;
    p.alive = true; p.state = 'ground'; p.hp = p.maxHp * 0.75; p.invuln = 3; p.rank = 0; p.heal = null;
    m.alive++;
    if (m.over && m.alive > 1) { m.over = false; if (m.winner) m.winner.rank = 0; m.winner = null; }
    const bi = m.boxes.findIndex(b => b.kind === 'death' && b.owner === p.id);
    if (bi >= 0) { for (const it of m.boxes[bi].items) { if (itemValue(p, it) > 0) takeItem(m, p, it); } m.boxes.splice(bi, 1); }
    if (p.guns[p.cur] && p.guns[p.cur].ammo <= 0) p.guns[p.cur].ammo = magOf(p.guns[p.cur].w, p.guns[p.cur].r);
    m.ev.push({ e: 'revive', p: p.id });
  }
  function hitActor(m, b, p, hx, hy) {
    if (p.invuln > 0) return;
    const W = WEAPONS[b.w];
    const shooter = m.players[b.o];
    const head = m.rng() < b.hs;
    let dmg = bulletDamage(b.w, b.r, b.d) * (head ? W.hsMul : 1);
    if (!b.human) dmg *= p.human ? m.botToHuman : m.botToBot;
    dmg = applyArmor(p, dmg, head);
    dmg = Math.min(dmg, p.hp);
    p.hp -= dmg; p.flash = 0.13; p.lastHitBy = b.o; p.lastHitT = m.t;
    p.hitA = Math.atan2(-b.dy, -b.dx);
    if (shooter) shooter.dmg += dmg;
    m.ev.push({ e: 'hit', src: b.o, dst: p.id, dmg, head, x: hx, y: hy, w: b.w });
    if (p.hp <= 0.01) killActor(m, p, shooter, b.w, head);
  }
  function stepBullets(m, dt) {
    const M = m.map;
    for (let i = m.bullets.length - 1; i >= 0; i--) {
      const b = m.bullets[i];
      const step = Math.min(b.spd * dt, b.max - b.d);
      const x2 = b.x + b.dx * step, y2 = b.y + b.dy * step;
      let tHit = 2, hp = null;
      const wh = rayObs(M, b.x, b.y, x2, y2);
      if (wh) tHit = wh.t;
      const i0 = clamp(Math.floor((Math.min(b.x, x2) - PR) / CELL), 0, GN - 1), i1 = clamp(Math.floor((Math.max(b.x, x2) + PR) / CELL), 0, GN - 1);
      const j0 = clamp(Math.floor((Math.min(b.y, y2) - PR) / CELL), 0, GN - 1), j1 = clamp(Math.floor((Math.max(b.y, y2) + PR) / CELL), 0, GN - 1);
      for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
        for (let q = m.pHead[j * GN + ii]; q >= 0; q = m.pNext[q]) {
          if (q === b.o) continue;
          const p = m.players[q];
          if (!p.alive) continue;
          const t = segCircle(b.x, b.y, x2 - b.x, y2 - b.y, p.x, p.y, PR);
          if (t >= 0 && t < tHit) { tHit = t; hp = p; }
        }
      }
      if (tHit <= 1) {
        const hx = b.x + (x2 - b.x) * tHit, hy = b.y + (y2 - b.y) * tHit;
        b.d += step * tHit; b.x = hx; b.y = hy;
        if (hp) hitActor(m, b, hp, hx, hy);
        else m.ev.push({ e: 'wall', x: hx, y: hy, dx: b.dx, dy: b.dy, human: b.human });
        m.bullets.splice(i, 1);
        m.ev.push({ e: 'bend', b });
        if (m.over) return;
        continue;
      }
      b.x = x2; b.y = y2; b.d += step;
      if (b.d >= b.max - 0.01) { m.bullets.splice(i, 1); m.ev.push({ e: 'bend', b }); }
    }
  }
  function autoAimTarget(m, p) {
    const g = curGun(p), range = g ? WEAPONS[g.w].range : 400;
    const v = findVisibleEnemy(m, p, Math.min(range, 760), 5, true);
    return v ? v.e : null;
  }
  // 玩家（人類）的瞄準：自動瞄準、超級自動瞄準
  function humanControl(m, p) {
    const inp = p.input, g = curGun(p);
    let fireNow = inp.fire;
    let tgt = null;
    if (m.superAim || (inp.fire && !inp.manual && m.autoAim)) tgt = autoAimTarget(m, p);
    if (tgt) {
      const W = g ? WEAPONS[g.w] : WEAPONS.pistol;
      const d = Math.hypot(tgt.x - p.x, tgt.y - p.y), lead = (m.superAim ? 1 : 0.5) * d / W.spd;
      p.aim = Math.atan2(tgt.y + tgt.vy * lead - p.y, tgt.x + tgt.vx * lead - p.x);
      if (m.superAim && g) fireNow = true;
      p.autoTarget = tgt.id;
    } else {
      p.autoTarget = -1;
      if (inp.fire || inp.manual) p.aim = inp.aim;
      else if ((inp.mx || inp.my) && m.t - p.lastShotT > 0.5) p.aim = turnToward(p.aim, Math.atan2(inp.my, inp.mx), 0.25);
    }
    p.wantFire = fireNow;
  }

  // ---------- AI ----------
  function lootTarget(m, b, radius) {
    let best = null, bs = 0;
    const ci = clamp(Math.floor(b.x / CELL), 0, GN - 1), cj = clamp(Math.floor(b.y / CELL), 0, GN - 1), rc = Math.ceil(radius / CELL);
    const r2 = radius * radius;
    for (let j = Math.max(0, cj - rc); j <= Math.min(GN - 1, cj + rc); j++) for (let i = Math.max(0, ci - rc); i <= Math.min(GN - 1, ci + rc); i++) {
      for (const it of m.igrid[j * GN + i]) {
        const d2 = (it.x - b.x) ** 2 + (it.y - b.y) ** 2;
        if (d2 > r2) continue;
        const v = itemValue(b, it);
        if (v <= 0) continue;
        const s = v / (1 + Math.sqrt(d2) / 140);
        if (s > bs) { bs = s; best = it; }
      }
    }
    for (const bx of m.boxes) {
      if (!bx.items.length) continue;
      const d2 = (bx.x - b.x) ** 2 + (bx.y - b.y) ** 2, lim = bx.kind === 'drop' ? 950 : radius;
      if (d2 > lim * lim) continue;
      let v = 0; for (const it of bx.items) v += itemValue(b, it);
      if (v <= 0) continue;
      const s = v * (bx.kind === 'drop' ? 1.6 : 1) / (1 + Math.sqrt(d2) / 140);
      if (s > bs) { bs = s; best = bx; }
    }
    return best;
  }
  function findCover(m, b, ex, ey) {
    const M = m.map, R = 190;
    let best = null, bd = Infinity;
    const st = ++M.stamp;
    const i0 = clamp(Math.floor((b.x - R) / CELL), 0, GN - 1), i1 = clamp(Math.floor((b.x + R) / CELL), 0, GN - 1);
    const j0 = clamp(Math.floor((b.y - R) / CELL), 0, GN - 1), j1 = clamp(Math.floor((b.y + R) / CELL), 0, GN - 1);
    const cand = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const oi of M.grid[j * GN + i]) { if (M.mark[oi] === st) continue; M.mark[oi] = st; const o = M.obs[oi]; if (o.b && o.w * o.h >= 500) cand.push(o); }
    for (const o of cand) {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      let ux = cx - ex, uy = cy - ey; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
      const ext = Math.abs(ux) * o.w / 2 + Math.abs(uy) * o.h / 2;
      const px = cx + ux * (ext + PR + 8), py = cy + uy * (ext + PR + 8);
      const d = (px - b.x) ** 2 + (py - b.y) ** 2;
      if (d > R * R || d >= bd || !navFree(M, px, py)) continue;
      if (!rayObs(M, ex, ey, px, py)) continue;
      bd = d; best = { x: px, y: py };
    }
    return best;
  }
  function zoneGoal(m, b) {
    const z = m.zone, ai = b.ai, key = z.i * 2 + (z.st === 'shrink' ? 1 : 0);
    if (ai.zph !== z.i) {
      ai.zph = z.i;
      for (let k = 0; k < 20; k++) {
        const a = m.rng() * TAU, d = Math.sqrt(m.rng()) * z.br * 0.6;
        const x = z.bx + Math.cos(a) * d, y = z.by + Math.sin(a) * d;
        if (navFree(m.map, x, y)) { ai.zgx = x; ai.zgy = y; return; }
      }
      const f = nearestFree(m.map, z.bx, z.by, 12) || [z.bx, z.by];
      ai.zgx = f[0]; ai.zgy = f[1];
    }
    return key;
  }
  function setGoal(b, x, y) {
    const ai = b.ai;
    if (ai.gx == null || Math.abs(ai.gx - x) + Math.abs(ai.gy - y) > 30) { ai.gx = x; ai.gy = y; ai.directT = 0; if (Math.abs(ai.pgx - x) + Math.abs(ai.pgy - y) > 60) ai.path = null; }
  }
  function bestSlot(b, d) {
    const g0 = b.guns[0], g1 = b.guns[1];
    if (!g0 || !g1) return g0 ? 0 : g1 ? 1 : b.cur;
    const sc = g => { const W = WEAPONS[g.w]; let s = gunScore(g); if (d != null) { if (d > W.range * 0.95) s -= 60; if (W.pel > 1 && d < 170) s += 30; if (W.id === 'sniper' || W.id === 'queen') s += d > 420 ? 30 : d < 220 ? -40 : 0; } if (g.ammo <= 0) s -= 25; return s; };
    return sc(g0) >= sc(g1) ? 0 : 1;
  }
  function aiThink(m, b) {
    const ai = b.ai, P = ai.P, z = m.zone;
    ai.thinkT = P.think * (0.8 + m.rng() * 0.4);
    const g = curGun(b);
    const range = g ? WEAPONS[g.w].range : 300;
    // 感知
    let vis = findVisibleEnemy(m, b, P.vision, 3);
    // 專心搜刮時不一定會注意到敵人（被打、已鎖定、或很近才一定會發現）；剛落地與個性溫和的會先避戰
    const hurt = m.t - b.lastHitT < 2;
    if (vis && vis.e !== ai.target && !hurt) {
      const calm = m.t < b.landT + ai.calm || m.t < ai.calmUntil || (ai.passive && vis.d > 120) || (vis.d > 70 && m.rng() > P.notice * (vis.e.human ? 1.2 : 1));
      if (calm) vis = null;
    }
    if (vis) {
      if (ai.target !== vis.e) { ai.target = vis.e; ai.react = P.react * (0.7 + m.rng() * 0.6); }
      ai.seenT = m.t; ai.lx = vis.e.x; ai.ly = vis.e.y; ai.td = vis.d; ai.los = true;
    } else {
      ai.los = false;
      if (ai.target && (!ai.target.alive || m.t - ai.seenT > 3)) ai.target = null;
      if (b.lastHitBy >= 0 && m.t - b.lastHitT < 1.2) { const s = m.players[b.lastHitBy]; if (s && s.alive) { ai.lx = s.x; ai.ly = s.y; ai.seenT = m.t - 1; ai.alert = m.t; } }
    }
    if (ai.target && !ai.target.alive) ai.target = null;
    // 換槍
    if (!b.heal && !(b.input.fire && g && g.ammo > 0)) {
      const s = bestSlot(b, vis ? vis.d : null);
      if (s !== b.cur && b.guns[s]) { b.cur = s; b.reloadT = 0; b.fireCd = Math.max(b.fireCd, 0.2); }
    }
    // 毒圈
    zoneGoal(m, b);
    const outCur = !insideZone(z, b.x, b.y);
    const dz = Math.hypot(b.x - z.bx, b.y - z.by);
    const needT = Math.max(0, dz - z.br * 0.75) / SPEED;
    const zoneUrgent = outCur || (dz > z.br * 0.85 && needT + P.zoneMargin + 6 > zoneTimeLeft(z));
    // 決策
    const t = ai.target;
    const lowHp = b.hp < P.healThr && hasHeal(b);
    const underFire = m.t - b.lastHitT < 1.5;
    ai.cover = null;
    if (b.heal) { ai.mode = 'heal'; if (vis && vis.d < 180 && b.hp > 30) b.heal = null; else return; }
    // 溫和型：被打又血少就逃（往安全區、背對敵人）
    if (ai.passive && t && b.hp < 65 && (!vis || vis.d > 90) && m.rng() < 0.85) {
      ai.mode = 'flee';
      const ux = b.x - t.x, uy = b.y - t.y, l = Math.hypot(ux, uy) || 1;
      let fx = b.x + ux / l * 260 + (ai.zgx - b.x) * 0.25, fy = b.y + uy / l * 260 + (ai.zgy - b.y) * 0.25;
      const f = nearestFree(m.map, fx, fy, 8); if (f) { fx = f[0]; fy = f[1]; }
      setGoal(b, fx, fy);
      if (!vis && hasHeal(b) && b.hp < 60) b.input.heal = 'auto';
      return;
    }
    if (t && vis && g && (vis.d < range * 0.85 || m.t - b.lastHitT < 1.5) && !(lowHp && vis.d > range * 0.6) && !(outCur && b.hp < 40)) {
      ai.mode = 'fight';
      if ((b.reloadT > 0 || b.hp < 45) && m.rng() < P.cover) ai.cover = findCover(m, b, t.x, t.y);
      return;
    }
    if (outCur || (zoneUrgent && !(t && vis))) { ai.mode = 'zone'; setGoal(b, ai.zgx, ai.zgy); return; }
    if (lowHp && !underFire) { ai.mode = 'heal'; b.input.heal = 'auto'; return; }
    if (!t && !b.heal && b.heals.drink > 0 && b.boost < 25 && b.hp < 90 && !underFire && m.rng() < 0.3) { b.input.heal = 'drink'; }
    if (!t && b.hp < 85 && hasHeal(b) && !underFire && m.rng() < 0.4) { b.input.heal = 'auto'; }
    if (t && !vis && g && m.t - ai.seenT < 3 && m.rng() < P.brave + 0.2) { ai.mode = 'hunt'; setGoal(b, ai.lx, ai.ly); return; }
    if (!ai.lootRef || ai.lootRef.gone || (ai.lootRef.items && !ai.lootRef.items.length) || m.rng() < 0.15) ai.lootRef = lootTarget(m, b, P.loot);
    if (ai.lootRef && itemValueAny(b, ai.lootRef) > 0) { ai.mode = 'loot'; setGoal(b, ai.lootRef.x, ai.lootRef.y); return; }
    ai.lootRef = null;
    // 聽到槍聲
    if (g && b.hp > 60 && m.rng() < P.brave * 0.25) {
      for (let k = m.shotLog.length - 1; k >= 0; k--) {
        const s = m.shotLog[k];
        if (m.t - s.t > 1.5) break;
        if (s.p !== b.id && (s.x - b.x) ** 2 + (s.y - b.y) ** 2 < 520 * 520 && insideZone(z, s.x, s.y)) { ai.mode = 'hunt'; setGoal(b, s.x, s.y); return; }
      }
    }
    // 漫遊：在附近的物資點間晃、或原地蹲點；只會慢慢往安全區靠，不會一窩蜂衝向圈心
    if (ai.mode !== 'roam') { ai.mode = 'roam'; ai.roamT = 0; }
    ai.roamT -= ai.thinkT;
    if (ai.roamT <= 0 || (ai.gx != null && Math.hypot(ai.gx - b.x, ai.gy - b.y) < 24)) {
      ai.roamT = 5 + m.rng() * 9;
      if (m.rng() < 0.35) { ai.gx = null; return; }
      const dzc = Math.hypot(b.x - z.bx, b.y - z.by), sp = m.map.spots;
      for (let k = 0; k < 16; k++) {
        const s = sp[Math.floor(m.rng() * sp.length)];
        const ds = Math.hypot(s.x - b.x, s.y - b.y);
        if (ds > 460 || ds < 60 || !insideZone(z, s.x, s.y) || Math.hypot(s.x - z.bx, s.y - z.by) > Math.max(z.br * 0.9, dzc + 40)) continue;
        setGoal(b, s.x, s.y); return;
      }
      for (let k = 0; k < 8; k++) {
        const a = m.rng() * TAU, x = b.x + Math.cos(a) * 200, y = b.y + Math.sin(a) * 200;
        if (navFree(m.map, x, y) && insideZone(z, x, y)) { setGoal(b, x, y); return; }
      }
      ai.gx = null;
    }
  }
  function itemValueAny(b, ref) { if (ref.items) { let v = 0; for (const it of ref.items) v += itemValue(b, it); return v; } return itemValue(b, ref); }
  // 依目標點走（直線或 A* 路徑）；結果寫進 out
  function steer(m, b, gx, gy, out) {
    const ai = b.ai;
    const dx = gx - b.x, dy = gy - b.y, d = Math.hypot(dx, dy);
    out[0] = 0; out[1] = 0;
    if (d < 10) return;
    ai.directT -= 1;
    if (ai.directT <= 0) { ai.direct = navClear(m.map, b.x, b.y, gx, gy); ai.directT = 12; }
    if (ai.direct) { out[0] = dx / d; out[1] = dy / d; return; }
    if (!ai.path || Math.abs(ai.pgx - gx) + Math.abs(ai.pgy - gy) > 60) {
      if (m.pathBudget > 0) { m.pathBudget--; ai.path = m.map.pather(m.map, b.x, b.y, gx, gy); ai.pi = 0; ai.pgx = gx; ai.pgy = gy; if (!ai.path) { ai.path = [gx, gy]; ai.fail = (ai.fail || 0) + 1; } }
      else { out[0] = dx / d; out[1] = dy / d; return; }
    }
    const P = ai.path;
    while (ai.pi < P.length - 2 && Math.hypot(P[ai.pi] - b.x, P[ai.pi + 1] - b.y) < 16) ai.pi += 2;
    const wx = P[ai.pi], wy = P[ai.pi + 1], wd = Math.hypot(wx - b.x, wy - b.y);
    if (wd > 1) { out[0] = (wx - b.x) / wd; out[1] = (wy - b.y) / wd; }
  }
  const STEER = [0, 0];
  function aiStep(m, b, dt) {
    const ai = b.ai, P = ai.P, inp = b.input;
    ai.thinkT -= dt;
    if (ai.thinkT <= 0) aiThink(m, b);
    ai.errT -= dt;
    if (ai.errT <= 0) { ai.errT = 0.3 + m.rng() * 0.35; ai.errGoal = m.rng.gauss() * P.aimErr; }
    ai.err += (ai.errGoal - ai.err) * Math.min(1, dt * 4);
    inp.fire = false;
    let mx = 0, my = 0;
    const t = ai.target, g = curGun(b), W = g && WEAPONS[g.w];
    const seen = t && t.alive && t.state === 'ground' && m.t - ai.seenT < 0.45 && ai.los;
    if (ai.mode === 'fight' && t && t.alive) {
      const d = Math.hypot(t.x - b.x, t.y - b.y);
      const want = W ? (W.pel > 1 ? 120 : W.id === 'sniper' || W.id === 'queen' ? 520 : W.id === 'rifle' || W.id === 'crown' ? 330 : 220) : 200;
      if (ai.cover && Math.hypot(ai.cover.x - b.x, ai.cover.y - b.y) > 8) { steer(m, b, ai.cover.x, ai.cover.y, STEER); mx = STEER[0]; my = STEER[1]; }
      else if (W && d > W.range * 0.92) { steer(m, b, t.x, t.y, STEER); mx = STEER[0]; my = STEER[1]; }
      else {
        ai.strafeT -= dt;
        if (ai.strafeT <= 0) { ai.strafeT = 0.5 + m.rng() * 1.1; if (m.rng() < 0.55) ai.strafe = -ai.strafe; }
        const ux = (t.x - b.x) / (d || 1), uy = (t.y - b.y) / (d || 1);
        const rad = clamp((d - want) / want, -1, 1) * 0.8;
        mx = -uy * ai.strafe + ux * rad; my = ux * ai.strafe + uy * rad;
        const l = Math.hypot(mx, my) || 1; mx /= l; my /= l;
        if (P.d < 0.25 && m.rng() < 0.3) { mx *= 0.4; my *= 0.4; }
        if (!navFree(m.map, b.x + mx * 30, b.y + my * 30)) { ai.strafe = -ai.strafe; mx = -mx * 0.5 + ux * rad; my = -my * 0.5 + uy * rad; }
      }
    } else if (ai.gx != null && ai.mode !== 'heal') {
      steer(m, b, ai.gx, ai.gy, STEER); mx = STEER[0]; my = STEER[1];
      if (ai.mode === 'loot' && Math.hypot(ai.gx - b.x, ai.gy - b.y) < 12) { mx = 0; my = 0; }
    } else if (ai.mode === 'heal' && t && t.alive) {
      const c = findCoverCached(m, b, t);
      if (c) { steer(m, b, c.x, c.y, STEER); mx = STEER[0] * 0.8; my = STEER[1] * 0.8; }
    }
    // 卡住偵測
    ai.stuckT -= dt;
    if (ai.stuckT <= 0) {
      const moved = Math.hypot(b.x - ai.sx, b.y - ai.sy);
      if ((mx || my) && moved < 10) { ai.stuck++; ai.path = null; ai.directT = 0; if (ai.stuck > 2) { ai.gx = null; ai.lootRef = null; ai.roamT = 0; ai.stuck = 0; ai.thinkT = 0; ai.zph = -1; } }
      else ai.stuck = 0;
      ai.sx = b.x; ai.sy = b.y; ai.stuckT = 1;
    }
    // 瞄準與開火
    if (seen && W) {
      const d = Math.hypot(t.x - b.x, t.y - b.y);
      const lt = d / W.spd * P.lead;
      const want = Math.atan2(t.y + t.vy * lt - b.y, t.x + t.vx * lt - b.x) + ai.err;
      b.aim = turnToward(b.aim, want, P.turn * dt);
      ai.react -= dt;
      ai.burstT -= dt;
      if (ai.burstT < -0.35 * (1.6 - P.d)) ai.burstT = P.burst * (0.7 + m.rng() * 0.6);
      const burstOn = W.rof > 0.3 || ai.burstT > 0;
      if (ai.react <= 0 && d < W.range && Math.abs(angDiff(b.aim, want)) < 0.22 && burstOn && !b.heal) inp.fire = true;
    } else if (t && t.alive && m.t - ai.seenT < 2) {
      b.aim = turnToward(b.aim, Math.atan2(ai.ly - b.y, ai.lx - b.x), P.turn * dt * 0.7);
    } else if (mx || my) b.aim = turnToward(b.aim, Math.atan2(my, mx), P.turn * dt * 0.5);
    if (g && !t && !b.heal && g.ammo < magOf(g.w, g.r) * 0.5 && b.reloadT <= 0) inp.reload = true;
    inp.mx = mx; inp.my = my;
    b.wantFire = inp.fire;
  }
  function findCoverCached(m, b, t) {
    const ai = b.ai;
    if (!ai.hc || m.t - ai.hcT > 1.2) { ai.hc = findCover(m, b, t.x, t.y); ai.hcT = m.t; }
    return ai.hc;
  }

  // ---------- 每一步 ----------
  function actorStep(m, p, dt) {
    const inp = p.input;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.flash > 0) p.flash -= dt;
    // 切槍
    if (inp.sw) { inp.sw = false; if (p.guns[1 - p.cur]) { p.cur = 1 - p.cur; p.reloadT = 0; p.fireCd = Math.max(p.fireCd, 0.25); m.ev.push({ e: 'switch', p: p.id }); } }
    let g = curGun(p);
    if (!g && p.guns[1 - p.cur]) { p.cur = 1 - p.cur; g = curGun(p); }
    // 換彈
    if (g) {
      if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) { p.reloadT = 0; g.ammo = magOf(g.w, g.r); m.ev.push({ e: 'reloaded', p: p.id }); } }
      else if ((g.ammo <= 0 || (inp.reload && g.ammo < magOf(g.w, g.r))) && !p.heal) { p.reloadT = reloadOf(g.w, g.r); m.ev.push({ e: 'reload', p: p.id, w: g.w }); }
    }
    inp.reload = false;
    // 補血
    if (inp.heal) { if (startHeal(p, inp.heal)) m.ev.push({ e: 'healStart', p: p.id, k: p.heal.k }); inp.heal = null; }
    if (p.heal) {
      if (p.wantFire && g && g.ammo > 0) { p.heal = null; m.ev.push({ e: 'healCancel', p: p.id }); }
      else { p.heal.t -= dt; if (p.heal.t <= 0) finishHeal(m, p); }
    }
    if (p.boost > 0) { p.hp = Math.min(p.maxHp, p.hp + 1.25 * dt); p.boost = Math.max(0, p.boost - 2.2 * dt); }
    // 移動
    let mx = inp.mx, my = inp.my;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const spd = SPEED * (p.heal ? 0.55 : 1) * (p.boost > 40 ? 1.07 : 1) * (p.wantFire && g ? 0.85 : 1);
    const ox = p.x, oy = p.y;
    if (ml > 0.05) moveActor(m, p, mx * spd * dt, my * spd * dt);
    p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt;
    p.moving = ml > 0.1;
    // 開火
    p.fireCd -= dt;
    if (p.wantFire && g && p.reloadT <= 0 && !p.heal) {
      let shots = 0;
      while (p.fireCd <= 0 && g.ammo > 0 && shots < 2) { fire(m, p, g); p.fireCd += WEAPONS[g.w].rof; shots++; }
    }
    if (p.fireCd < 0) p.fireCd = 0;
    // 毒圈傷害
    p.zoneHurt = !insideZone(m.zone, p.x, p.y);
    if (p.zoneHurt && m.zone.dps > 0) {
      p.hp -= m.zone.dps * dt;
      if (p.hp <= 0) { killActor(m, p, null, null, false); return; }
    }
    // 撿東西
    p.pickT -= dt;
    if (p.pickT <= 0) { p.pickT = 0.15; autoPickup(m, p); }
  }
  function stepPlane(m, dt) {
    const pl = m.plane;
    if (pl.gone) return;
    pl.u = Math.min(1, m.t / pl.dur);
    [pl.x, pl.y] = planeAt(pl, pl.u);
    if (pl.u >= 1) pl.gone = true;
  }
  function startChute(m, p) {
    const pl = m.plane;
    p.state = 'chute';
    p.x = pl.x; p.y = pl.y;
    p.chute = { t: 0, x0: pl.x, y0: pl.y };
    p.aim = pl.a;
    m.ev.push({ e: 'jump', p: p.id });
  }
  function chuteStep(m, p, dt) {
    const c = p.chute;
    c.t += dt;
    let vx = 0, vy = 0;
    if (p.human) {
      const inp = p.input;
      if (Math.hypot(inp.mx, inp.my) > 0.1) { vx = inp.mx * 250; vy = inp.my * 250; p.tx = NaN; }
      else if (!isNaN(p.tx)) { const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), s = Math.min(250, d / Math.max(0.3, CHUTE_T - c.t)); if (d > 2) { vx = dx / d * s; vy = dy / d * s; } }
      else { vx = Math.cos(m.plane.a) * 40; vy = Math.sin(m.plane.a) * 40; }
    } else {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), s = Math.min(260, d / Math.max(0.3, CHUTE_T - c.t));
      if (d > 2) { vx = dx / d * s; vy = dy / d * s; }
    }
    p.x = clamp(p.x + vx * dt, 40, MAP - 40); p.y = clamp(p.y + vy * dt, 40, MAP - 40);
    p.vx = vx; p.vy = vy;
    if (Math.abs(vx) + Math.abs(vy) > 5) p.aim = turnToward(p.aim, Math.atan2(vy, vx), dt * 3);
    if (c.t >= CHUTE_T) {
      p.state = 'ground'; p.chute = null; p.landT = m.t;
      if (!navFree(m.map, p.x, p.y)) { const f = nearestFree(m.map, p.x, p.y, 30) || nearestFree(m.map, CX, CY, 30); p.x = f[0]; p.y = f[1]; }
      p.vx = p.vy = 0;
      m.ev.push({ e: 'land', p: p.id });
    }
  }
  function spawnDrop(m, x, y, fall = 9, owner = -1) {
    const f = nearestFree(m.map, x, y, 14) || [x, y];
    const W = m.rng() < 0.5 ? 'queen' : 'crown';
    const box = { id: m.nid++, kind: 'drop', x: f[0], y: f[1], alt: 1, fall, items: [{ k: 'gun', w: W, r: 4 }, { k: 'armor', lv: 3, dur: ARMOR[3].dur }, { k: 'helmet', lv: 3, dur: ARMOR[3].dur }, { k: 'heal', t: 'medkit', n: 2 }, { k: 'heal', t: 'drink', n: 2 }], t0: m.t, owner };
    m.boxes.push(box);
    m.ev.push({ e: 'drop', id: box.id, x: box.x, y: box.y, owner });
    return box;
  }
  function stepDrops(m, dt) {
    for (const d of m.drops) {
      if (d.done || m.t < d.t) continue;
      d.done = true;
      const z = m.zone;
      for (let k = 0; k < 30; k++) {
        const a = m.rng() * TAU, r = Math.sqrt(m.rng()) * z.br * 0.7, x = z.bx + Math.cos(a) * r, y = z.by + Math.sin(a) * r;
        if (navFree(m.map, x, y)) { spawnDrop(m, x, y); break; }
      }
    }
    for (const b of m.boxes) if (b.alt > 0) { b.alt = Math.max(0, b.alt - dt / b.fall); if (b.alt === 0) m.ev.push({ e: 'dropLand', id: b.id, x: b.x, y: b.y }); }
  }
  // 玩家花粉鑽呼叫空投：落在身邊
  function callDrop(m, p) {
    for (let k = 0; k < 20; k++) {
      const a = m.rng() * TAU, d = 120 + m.rng() * 80, x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (navFree(m.map, x, y) && losClear(m.map, p.x, p.y, x, y)) return spawnDrop(m, x, y, 5.5, p.id);
    }
    return spawnDrop(m, p.x + 60, p.y, 5.5, p.id);
  }

  function stepMatch(m, dt) {
    if (m.over) return;
    m.t += dt;
    m.pathBudget = 5;
    stepPlane(m, dt);
    const zev = stepZone(m.zone, dt, m.rng, (x, y) => navFree(m.map, x, y) && coastDist(x, y) > 120);
    if (zev) m.ev.push({ e: 'zone', k: zev, i: m.zone.i });
    stepDrops(m, dt);
    rebuildPlayerGrid(m);
    for (const p of m.players) {
      if (!p.alive) continue;
      if (p.state === 'plane') {
        p.x = m.plane.x; p.y = m.plane.y;
        const span = m.plane.span;
        if (p.human ? (p.input.jump && m.plane.u >= span[0] - 0.02) || m.plane.u >= Math.min(0.95, span[1] + 0.02) : m.plane.u >= p.jumpU) { p.input.jump = false; startChute(m, p); }
        continue;
      }
      if (p.state === 'chute') { chuteStep(m, p, dt); continue; }
      p.bin = buildingAt(m.map, p.x, p.y);
    }
    for (const p of m.players) {
      if (!p.alive || p.state !== 'ground') continue;
      if (p.human) humanControl(m, p); else aiStep(m, p, dt);
      actorStep(m, p, dt);
      if (m.over) return;
    }
    stepBullets(m, dt);
    for (let i = m.boxes.length - 1; i >= 0; i--) { const b = m.boxes[i]; if (b.empty && m.t - b.empty > 1.2) m.boxes.splice(i, 1); }
  }

  // 全 AI 模擬一整局（測試用）
  function simulate(o = {}) {
    const m = createMatch(Object.assign({ n: 50 }, o));
    const dt = o.dt || 1 / 30, maxT = o.maxT || 900;
    let shots = 0, hits = 0, maxB = 0, kd = 0, kn = 0;
    const tl = [];
    while (!m.over && m.t < maxT) {
      stepMatch(m, dt);
      if (Math.floor(m.t / 60) !== Math.floor((m.t - dt) / 60)) tl.push(m.alive);
      for (const e of m.ev) { if (e.e === 'shot') shots++; else if (e.e === 'hit') hits++; else if (e.e === 'kill' && e.killer >= 0) { const k = m.players[e.killer]; kd += Math.hypot(k.x - e.x, k.y - e.y); kn++; } }
      m.ev.length = 0;
      if (m.bullets.length > maxB) maxB = m.bullets.length;
    }
    const bad = m.players.filter(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.hp)).length;
    return { t: m.t, tl, kd: kd / Math.max(1, kn), over: m.over, winner: m.winner && m.winner.name, alive: m.alive, kills: m.players.reduce((a, p) => a + p.kills, 0), zoneDeaths: m.zoneDeaths, shots, hits, maxB, bad, zonePhase: m.zone.i, m };
  }

  const Core = {
    MAP, CX, CY, PR, SPEED, CHUTE_T, RARITY, WEAPONS, ARMOR, HEALS, GEAR_NAME, ZONES, ZONE_TOTAL, NAMES, TAU,
    makeRng, getMap, inIsland, isLand, coastDist, segAabb, segCircle, rayObs, losClear, navFree, navClear, nearestFree, buildingAt,
    bulletDamage, applyArmor, weaponDps, magOf, reloadOf, gunScore, itemValue, takeItem, rollItem,
    nextZone, stepZone, insideZone, zoneTimeLeft, aiParams, aiThink, findCover, lootTarget, findVisibleEnemy, autoAimTarget,
    createMatch, stepMatch, startChute, callDrop, revive, simulate, makeActor, planeAt, planeLandSpan, startHeal, curGun, clamp, lerp, angDiff,
  };

  // ====================================================================
  //  二、畫面
  // ====================================================================
  const VR = 20;            // 角色 token 視覺半徑（碰撞半徑是 PR）
  const CH = 400;           // 地圖分塊大小
  const LOOK_HUES = [0, 58, 118, 178, 238, 298];
  const TIERS = [
    { name: '見習名媛', pts: 0, c: '#e3d2c2', c2: '#8d7462' },
    { name: '青銅名媛', pts: 100, c: '#eeb488', c2: '#9a5a32' },
    { name: '白銀名媛', pts: 260, c: '#eef2f8', c2: '#8b97ad' },
    { name: '黃金名媛', pts: 480, c: '#f8db8c', c2: '#b4832c' },
    { name: '鉑金名媛', pts: 760, c: '#b6f0e6', c2: '#3f9c8e' },
    { name: '鑽石名媛', pts: 1100, c: '#c8dcff', c2: '#4d73c9' },
    { name: '皇冠名媛', pts: 1500, c: '#edc6ff', c2: '#8a4cc2' },
    { name: '傳奇名媛', pts: 2000, c: '#ffc0d7', c2: '#c23a72' },
  ];
  const tierIdx = pts => { let i = 0; TIERS.forEach((t, k) => { if (pts >= t.pts) i = k; }); return i; };
  const LINES = {
    lobby: ['今晚的雞，我吃定了！', '香檳已經冰好了，就等勝利♥', '百貨老闆娘也要上戰場～', '這季的新款步槍好可愛！'],
    mm: ['今天的香檳我包了！', '誰也別想搶我的空投～', '跳百貨大樓的舉手！', '我只是來拍照的～', '決賽圈見囉！', '新做的指甲不能弄花…'],
    victim: ['嗚…我的限量包包…', '妝都花了啦！', '下次不會輸給妳！', '我的新鞋…', '怎麼會這樣～', '可惡，被看穿了！'],
    killer: ['承讓了～', '這把是我的！', '妳的包包我收下囉', '名媛的槍法，見識到了吧？', '別哭，妝會花喔～'],
    win: ['大吉大利，今晚吃雞！香檳開起來～', '全場最美的贏家就是我！', '今晚的雞腿特別好吃♥'],
    top: ['差一點點！下一局一定吃雞！', '名次不錯嘛，再來一局！', '前十名的名媛就是我～'],
    lose: ['可惡…下一局討回來！', '妝花了，補個妝再戰！', '嗚嗚，我的戰袍…'],
  };
  const GEM_COST = { kit: 15, aim: 20, drop: 25, revive: 30 };
  const IMG = new Map();
  const loadImg = src => {
    if (!IMG.has(src)) IMG.set(src, new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
    return IMG.get(src);
  };
  const mkCv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  function rr(x, X, Y, W, H, r) { r = Math.max(0, Math.min(r, W / 2, H / 2)); x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
  const hexRgb = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgbHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return rgbHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); };
  const shade = (h, k) => mix(h, k > 0 ? '#ffffff' : '#1a0612', Math.abs(k));
  const lum = h => { const [r, g, b] = hexRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };
  function hsvRot(r, g, b, rot, keepSkin, face) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
    if (dl < 0.035) return null;
    let h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4;
    h /= 6; if (h < 0) h += 1;
    const s = dl / mx, v = mx;
    let w = 1;
    if (keepSkin) {
      const hd = h > 0.5 ? h - 1 : h;
      if (hd > -0.08 && hd < 0.13 && s < 0.5 && v > 0.48) w = 1 - clamp(Math.min((hd + 0.08) / 0.04, (0.13 - hd) / 0.04, (0.5 - s) / 0.12, (v - 0.48) / 0.12), 0, 1);
      // 臉部中央的紅、粉色（嘴唇、腮紅、舌頭）一律保留
      if (face > 0 && hd > -0.12 && hd < 0.1) w *= 1 - face;
    }
    if (w <= 0) return null;
    let nh = h + rot * w; nh -= Math.floor(nh);
    const c6 = nh * 6, k = Math.floor(c6) % 6, f = c6 - Math.floor(c6), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][k];
  }
  function hueHex(hex, deg) { if (!deg) return hex; const [r, g, b] = hexRgb(hex); const o = hsvRot(r / 255, g / 255, b / 255, deg / 360, false); return o ? rgbHex(o[0] * 255, o[1] * 255, o[2] * 255) : hex; }
  // 只轉頭髮、衣服、眼睛的色相，保留膚色
  function hueShift(x, S, deg) {
    const d = x.getImageData(0, 0, S, S), a = d.data, rot = deg / 360;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] < 8) continue;
      const px = (i >> 2) % S, py = Math.floor((i >> 2) / S);
      const fd = ((px - S * 0.5) / (S * 0.24)) ** 2 + ((py - S * 0.73) / (S * 0.2)) ** 2;
      const o = hsvRot(a[i] / 255, a[i + 1] / 255, a[i + 2] / 255, rot, true, clamp((1.25 - fd) * 2, 0, 1));
      if (o) { a[i] = o[0] * 255; a[i + 1] = o[1] * 255; a[i + 2] = o[2] * 255; }
    }
    x.putImageData(d, 0, 0);
  }
  const lookOf = look => (look < 0 ? { ci: 0, hue: 0 } : { ci: 1 + (look % 5), hue: LOOK_HUES[Math.floor(look / 5) % 6] });
  const FACE = new Map(), FACEURL = new Map();
  function faceCv(api, look, expr = 'neutral') {
    const key = look + '|' + expr;
    if (!FACE.has(key)) {
      const { ci, hue } = lookOf(look);
      FACE.set(key, loadImg(api.cast()[ci].face(expr)).then(img => {
        const S = 128, c = mkCv(S, S), x = c.getContext('2d');
        if (img) { x.drawImage(img, 77, 18, 230, 230, 0, 0, S, S); if (hue) { try { hueShift(x, S, hue); } catch (e) { /* 讀不到像素就不換色 */ } } }
        else { x.fillStyle = '#f6d6e0'; x.beginPath(); x.arc(64, 60, 40, 0, TAU); x.fill(); }
        return c;
      }));
    }
    return FACE.get(key);
  }
  function faceURL(api, look, expr) {
    const key = look + '|' + expr;
    if (!FACEURL.has(key)) FACEURL.set(key, faceCv(api, look, expr).then(c => { try { return c.toDataURL('image/png'); } catch (e) { return api.cast()[lookOf(look).ci].face(expr); } }));
    return FACEURL.get(key);
  }

  // ---------- 程式繪製的小圖 ----------
  function tokenCv(face, ring, s, me) {
    const R = VR, pad = 4, S = (R + pad) * 2 * s, c = mkCv(S, S), x = c.getContext('2d');
    x.scale(s, s); x.translate(R + pad, R + pad);
    const g = x.createRadialGradient(-R * 0.4, -R * 0.5, R * 0.15, 0, 0, R);
    g.addColorStop(0, shade(ring, 0.55)); g.addColorStop(0.6, ring); g.addColorStop(1, shade(ring, -0.35));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fill();
    x.lineWidth = me ? 1.8 : 1; x.strokeStyle = me ? '#ffe7a0' : 'rgba(255,255,255,.75)'; x.stroke();
    const fr = R - 3.6;
    x.save(); x.beginPath(); x.arc(0, 0, fr, 0, TAU); x.clip();
    const bg = x.createLinearGradient(0, -fr, 0, fr); bg.addColorStop(0, '#fffafc'); bg.addColorStop(1, shade(ring, 0.7));
    x.fillStyle = bg; x.fillRect(-fr, -fr, fr * 2, fr * 2);
    x.drawImage(face, -fr * 1.04, -fr * 1.0, fr * 2.08, fr * 2.08);
    x.restore();
    x.lineWidth = 0.9; x.strokeStyle = me ? '#c9a35b' : 'rgba(80,30,60,.4)'; x.beginPath(); x.arc(0, 0, fr, 0, TAU); x.stroke();
    x.globalAlpha = 0.45; x.strokeStyle = '#fff'; x.lineWidth = 1.4; x.beginPath(); x.arc(0, 0, R - 1.6, Math.PI * 1.08, Math.PI * 1.42); x.stroke(); x.globalAlpha = 1;
    return c;
  }
  // 槍：原點在握把後方，+x 朝槍口（世界單位）
  function drawGun(x, w, rar, hands) {
    const R = RARITY[rar].color, D = '#3e2233';
    const P = (c, X, Y, W, H, r = 1.2) => { x.fillStyle = c; rr(x, X, Y, W, H, r); x.fill(); x.lineWidth = 0.7; x.strokeStyle = 'rgba(50,15,35,.65)'; x.stroke(); };
    const shine = (X, Y, W) => { x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(X, Y, W, 0.8); };
    const hand = (X, Y) => { x.fillStyle = '#ffe1d3'; x.beginPath(); x.arc(X, Y, 2.9, 0, TAU); x.fill(); x.lineWidth = 0.7; x.strokeStyle = 'rgba(120,60,60,.55)'; x.stroke(); };
    let hs = [[1.5, 3], [10, 3]];
    switch (w) {
      case 'pistol': P('#5a3247', 2, 1, 4.6, 7, 1.3); P('#fbeef4', 0, -2.6, 15, 4.8, 1.5); P(R, 3, -1.1, 8, 1.6, 0.6); P(D, 14.4, -1.5, 2.4, 2.8, 0.5); shine(1.5, -2, 11); hs = [[2.5, 3.5], [5, 4.2]]; break;
      case 'smg': P('#5a3247', 8, 2, 3.8, 7.6, 1); P('#5a3247', -4.5, -1.6, 5.4, 3.4, 1); P('#ffcfe2', 0, -3, 17, 6, 2); P(D, 16.5, -1.3, 7.5, 2.6, 0.6); P(R, 3, -1, 10, 1.8, 0.6); shine(2, -2.4, 12); hs = [[2, 2.6], [14, 2.8]]; break;
      case 'shotgun': P('#b97a55', -7, -2.6, 9, 5.2, 1.6); P('#f3c6b2', 1, -3, 11, 6, 1.6); P('#ebe2ea', 10, -1.7, 21, 3.4, 1); P('#b97a55', 15, 1.2, 8, 3.4, 1); P(R, 2.5, -1, 7, 1.8, 0.6); shine(1.5, -2.4, 9); hs = [[2, 2.6], [19, 3.4]]; break;
      case 'rifle': P('#5a3247', 9, 2.6, 4.2, 7.6, 1); P('#f2dca6', -6, -2.8, 8, 5.6, 1.6); P('#f8e6b8', 1, -3.4, 17, 6.8, 1.8); P('#e2c27f', 16, -2.6, 8, 5.2, 1.4); P(D, 23, -1.2, 10.5, 2.4, 0.6); P(D, 5, -5.8, 8, 2.6, 1); P(R, 3, -1, 11, 1.8, 0.6); shine(2, -2.7, 13); hs = [[2.5, 2.8], [19, 2.8]]; break;
      case 'sniper': P('#cddaf6', -9, -3, 10, 6, 1.8); P('#e8efff', 0, -3, 19, 6, 1.8); P(D, 18, -1.1, 25, 2.2, 0.6); P(D, 4, -6.6, 11, 3.2, 1.2); P('#8fd3ff', 13.2, -6.2, 1.8, 2.4, 0.4); P(R, 2, -1, 14, 1.8, 0.6); shine(1, -2.4, 15); hs = [[2, 2.6], [15, 2.6]]; break;
      case 'crown': P('#5a3247', 9, 2.6, 4.2, 7.6, 1); P('#f0c45a', -6, -2.8, 8, 5.6, 1.6); P('#f9d77e', 1, -3.4, 18, 6.8, 1.8); P('#e7b54d', 17, -2.6, 8, 5.2, 1.4); P('#a77a2c', 24, -1.2, 10.5, 2.4, 0.6); P(D, 5, -5.8, 8, 2.6, 1);
        x.fillStyle = '#ff6fa8'; for (const gx of [6, 11, 15]) { x.beginPath(); x.arc(gx, 0, 1.2, 0, TAU); x.fill(); } shine(2, -2.7, 14); hs = [[2.5, 2.8], [20, 2.8]]; break;
      case 'queen': P('#e79ab0', -9, -3, 10, 6, 1.8); P('#f6c3d1', 0, -3.2, 20, 6.4, 1.8); P('#c9a35b', 19, -1.2, 27, 2.4, 0.6); P('#5a2a40', 4, -7, 12, 3.4, 1.2); P('#ffd36b', 15, -6.6, 1.8, 2.6, 0.4);
        x.fillStyle = '#fff3c4'; for (const gx of [4, 9, 14]) { x.beginPath(); x.arc(gx, 0, 1.1, 0, TAU); x.fill(); } shine(1, -2.6, 16); hs = [[2, 2.6], [16, 2.8]]; break;
    }
    if (rar >= 3) { x.globalCompositeOperation = 'lighter'; x.fillStyle = rgba(RARITY[rar].glow, 0.25); rr(x, -2, -4, 20, 8, 3); x.fill(); x.globalCompositeOperation = 'source-over'; }
    if (hands) for (const [hx, hy] of hs) hand(hx, hy);
  }
  const GUN_W = 64, GUN_H = 24, GUN_OX = 12, GUN_OY = 12;
  function gunCv(w, r, s, hands) {
    const c = mkCv(GUN_W * s, GUN_H * s), x = c.getContext('2d');
    x.scale(s, s); x.translate(GUN_OX, GUN_OY); drawGun(x, w, r, hands);
    return c;
  }
  function star4(x, X, Y, r) { x.beginPath(); x.moveTo(X, Y - r); x.quadraticCurveTo(X, Y, X + r, Y); x.quadraticCurveTo(X, Y, X, Y + r); x.quadraticCurveTo(X, Y, X - r, Y); x.quadraticCurveTo(X, Y, X, Y - r); x.fill(); }
  const GEAR_C = [null, ['#ffffff', '#f4b6c9'], ['#ffe9a8', '#d6a443'], ['#e6f1ff', '#9fb8ff']];
  function drawVest(x, lv, S) {
    const [c1, c2] = GEAR_C[lv];
    const g = x.createLinearGradient(0, -S, 0, S); g.addColorStop(0, c1); g.addColorStop(1, c2);
    x.fillStyle = g; x.strokeStyle = 'rgba(70,25,50,.7)'; x.lineWidth = S * 0.08;
    x.beginPath(); x.moveTo(-S * 0.5, -S * 0.85); x.lineTo(-S * 0.18, -S * 0.85); x.quadraticCurveTo(0, -S * 0.45, S * 0.18, -S * 0.85); x.lineTo(S * 0.5, -S * 0.85); x.lineTo(S * 0.75, -S * 0.3); x.lineTo(S * 0.6, S * 0.85); x.lineTo(-S * 0.6, S * 0.85); x.lineTo(-S * 0.75, -S * 0.3); x.closePath(); x.fill(); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = S * 0.06; x.beginPath(); x.moveTo(-S * 0.4, S * 0.1); x.lineTo(S * 0.4, S * 0.1); x.moveTo(-S * 0.42, S * 0.45); x.lineTo(S * 0.42, S * 0.45); x.stroke();
    x.fillStyle = '#e0386f'; x.beginPath(); x.arc(0, -S * 0.2, S * 0.13, 0, TAU); x.fill();
  }
  function drawTiara(x, lv, S) {
    const [c1, c2] = GEAR_C[lv];
    const g = x.createLinearGradient(0, -S, 0, S * 0.6); g.addColorStop(0, c1); g.addColorStop(1, c2);
    x.fillStyle = g; x.strokeStyle = 'rgba(70,25,50,.75)'; x.lineWidth = S * 0.08; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(-S, S * 0.55); x.lineTo(-S * 0.85, -S * 0.25); x.lineTo(-S * 0.45, S * 0.12); x.lineTo(0, -S * 0.75); x.lineTo(S * 0.45, S * 0.12); x.lineTo(S * 0.85, -S * 0.25); x.lineTo(S, S * 0.55); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = lv === 3 ? '#7fd3ff' : lv === 2 ? '#ff6fa8' : '#f6c3d1';
    x.beginPath(); x.arc(0, S * 0.15, S * 0.17, 0, TAU); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, -S * 0.75, S * 0.12, 0, TAU); x.arc(-S * 0.85, -S * 0.25, S * 0.1, 0, TAU); x.arc(S * 0.85, -S * 0.25, S * 0.1, 0, TAU); x.fill();
  }
  function drawHealIcon(x, t, S) {
    x.lineWidth = S * 0.08; x.strokeStyle = 'rgba(70,25,50,.7)';
    if (t === 'medkit') {
      const g = x.createLinearGradient(0, -S, 0, S); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f2dde5');
      x.fillStyle = g; rr(x, -S * 0.8, -S * 0.55, S * 1.6, S * 1.2, S * 0.2); x.fill(); x.stroke();
      x.fillStyle = '#e0386f'; x.fillRect(-S * 0.13, -S * 0.38, S * 0.26, S * 0.86); x.fillRect(-S * 0.43, -S * 0.08, S * 0.86, S * 0.26);
      x.strokeStyle = '#c43869'; x.beginPath(); x.moveTo(-S * 0.3, -S * 0.55); x.lineTo(-S * 0.3, -S * 0.78); x.lineTo(S * 0.3, -S * 0.78); x.lineTo(S * 0.3, -S * 0.55); x.stroke();
    } else if (t === 'bandage') {
      x.fillStyle = '#fff7f2'; x.beginPath(); x.ellipse(0, 0, S * 0.75, S * 0.55, -0.4, 0, TAU); x.fill(); x.stroke();
      x.fillStyle = '#f4c2cf'; x.beginPath(); x.ellipse(-S * 0.08, -S * 0.04, S * 0.3, S * 0.22, -0.4, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(224,56,111,.5)'; x.beginPath(); x.moveTo(S * 0.2, S * 0.4); x.lineTo(S * 0.95, S * 0.75); x.stroke();
    } else {
      const g = x.createLinearGradient(-S, 0, S, 0); g.addColorStop(0, '#ff7fae'); g.addColorStop(0.5, '#ffc2d8'); g.addColorStop(1, '#d6457a');
      x.fillStyle = g; rr(x, -S * 0.42, -S * 0.82, S * 0.84, S * 1.64, S * 0.25); x.fill(); x.stroke();
      x.fillStyle = '#fff3c4'; x.beginPath(); x.moveTo(S * 0.08, -S * 0.45); x.lineTo(-S * 0.2, S * 0.08); x.lineTo(0, S * 0.08); x.lineTo(-S * 0.08, S * 0.5); x.lineTo(S * 0.22, -S * 0.05); x.lineTo(0, -S * 0.05); x.closePath(); x.fill();
      x.fillStyle = '#c9a35b'; x.fillRect(-S * 0.42, -S * 0.82, S * 0.84, S * 0.14);
    }
  }
  function itemCv(it, s) {
    const S = 40, c = mkCv(S * s, S * s), x = c.getContext('2d');
    x.scale(s, s); x.translate(S / 2, S / 2);
    const col = it.k === 'gun' ? RARITY[it.r].color : it.k === 'heal' ? '#ff9cc0' : GEAR_C[it.lv][1];
    const g = x.createRadialGradient(0, 0, 2, 0, 0, 19); g.addColorStop(0, rgba(col, 0.55)); g.addColorStop(1, rgba(col, 0));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 19, 0, TAU); x.fill();
    x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.ellipse(0, 1, 15.5, 12.5, 0, 0, TAU); x.fill();
    x.lineWidth = 1.4; x.strokeStyle = col; x.stroke();
    if (it.k === 'gun') { x.save(); x.rotate(-0.35); const L = { pistol: 17, smg: 24, shotgun: 31, rifle: 33, sniper: 43, crown: 34, queen: 46 }[it.w]; const k = 27 / (L + 8); x.scale(k, k); x.translate(-L / 2 + 2, 0); drawGun(x, it.w, it.r, false); x.restore(); }
    else if (it.k === 'armor') drawVest(x, it.lv, 10);
    else if (it.k === 'helmet') { x.translate(0, 1); drawTiara(x, it.lv, 10); }
    else drawHealIcon(x, it.t, 10);
    if (it.k === 'armor' || it.k === 'helmet') { x.fillStyle = '#3b1530'; x.font = 'italic 700 7px Georgia, serif'; x.textAlign = 'center'; x.fillText('Lv' + it.lv, 0, 15); }
    return c;
  }
  function boxCv(kind, s) {
    const S = kind === 'drop' ? 54 : 40, c = mkCv(S * s, S * s), x = c.getContext('2d');
    x.scale(s, s); x.translate(S / 2, S / 2);
    const w = kind === 'drop' ? 20 : 14;
    x.fillStyle = 'rgba(60,20,50,.22)'; x.beginPath(); x.ellipse(3, w * 0.9, w * 1.15, w * 0.45, 0, 0, TAU); x.fill();
    const g = x.createLinearGradient(-w, -w, w, w);
    if (kind === 'drop') { g.addColorStop(0, '#fff8ec'); g.addColorStop(1, '#efd7a6'); } else { g.addColorStop(0, '#ffb3cb'); g.addColorStop(1, '#d23a6c'); }
    x.fillStyle = g; rr(x, -w, -w * 0.75, w * 2, w * 1.6, 3); x.fill();
    x.lineWidth = 1; x.strokeStyle = 'rgba(70,20,45,.6)'; x.stroke();
    x.fillStyle = kind === 'drop' ? '#d6457a' : '#ffe9a8';
    x.fillRect(-w * 0.16, -w * 0.75, w * 0.32, w * 1.6); x.fillRect(-w, -w * 0.08, w * 2, w * 0.3);
    if (kind === 'drop') {
      x.strokeStyle = '#c9a35b'; x.lineWidth = 1.6; rr(x, -w + 2, -w * 0.75 + 2, w * 2 - 4, w * 1.6 - 4, 2); x.stroke();
      x.fillStyle = '#ffd36b'; x.beginPath(); x.moveTo(-6, 4); x.lineTo(-7, -4); x.lineTo(-3, 0); x.lineTo(0, -6); x.lineTo(3, 0); x.lineTo(7, -4); x.lineTo(6, 4); x.closePath(); x.fill(); x.strokeStyle = '#9c742f'; x.lineWidth = 0.8; x.stroke();
    } else {
      x.fillStyle = '#ffe9a8'; x.beginPath(); x.ellipse(-4, -w * 0.78, 4.5, 2.6, -0.5, 0, TAU); x.ellipse(4, -w * 0.78, 4.5, 2.6, 0.5, 0, TAU); x.fill();
      x.strokeStyle = '#c9a35b'; x.lineWidth = 0.7; x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(-w + 2, -w * 0.75 + 2, w * 0.7, 1.4);
    return c;
  }
  function treeCv(palm, v, s) {
    const R = palm ? 48 : 42, S = R * 2 + 10, c = mkCv(S * s, S * s), x = c.getContext('2d');
    x.scale(s, s); x.translate(S / 2, S / 2);
    const rng = makeRng(77 + v * 13 + (palm ? 1 : 0));
    if (palm) {
      const n = 8 + v;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + v * 0.4 + rng() * 0.2, L = R * (0.82 + rng() * 0.18);
        x.save(); x.rotate(a);
        const g = x.createLinearGradient(0, 0, L, 0); g.addColorStop(0, '#3d8f55'); g.addColorStop(0.6, '#5fb86c'); g.addColorStop(1, '#8fd68a');
        x.fillStyle = g; x.beginPath(); x.moveTo(2, 0); x.quadraticCurveTo(L * 0.5, -10, L, 0); x.quadraticCurveTo(L * 0.5, 9, 2, 0); x.fill();
        x.strokeStyle = 'rgba(255,255,230,.45)'; x.lineWidth = 1; x.beginPath(); x.moveTo(4, 0); x.quadraticCurveTo(L * 0.5, -1.5, L - 2, 0); x.stroke();
        x.strokeStyle = 'rgba(30,90,50,.35)'; x.lineWidth = 0.8;
        for (let k = 0.3; k < 0.95; k += 0.12) { x.beginPath(); x.moveTo(L * k, -0.5); x.lineTo(L * k + 4, -7 * (1 - k * 0.7)); x.moveTo(L * k, 0.5); x.lineTo(L * k + 4, 6 * (1 - k * 0.7)); x.stroke(); }
        x.restore();
      }
      x.fillStyle = '#8a5a32'; for (const [cx, cy] of [[-3, -2], [3, -1], [0, 3]]) { x.beginPath(); x.arc(cx, cy, 3.4, 0, TAU); x.fill(); }
      x.fillStyle = 'rgba(255,240,200,.6)'; x.beginPath(); x.arc(-4, -3, 1.2, 0, TAU); x.fill();
    } else {
      const cols = v === 2 ? ['#f2a7c1', '#f7c1d4', '#e98bb0'] : v === 1 ? ['#6fbf73', '#86cf7e', '#5aa866'] : ['#7cc47a', '#98d68a', '#64b06a'];
      for (let i = 0; i < 9; i++) { const a = rng() * TAU, d = rng() * R * 0.45, r = R * (0.35 + rng() * 0.2); x.fillStyle = cols[i % 3]; x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, TAU); x.fill(); }
      const g = x.createRadialGradient(-R * 0.35, -R * 0.4, 2, 0, 0, R); g.addColorStop(0, 'rgba(255,255,230,.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(20,60,30,.25)');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, R * 0.95, 0, TAU); x.fill();
      if (v === 2) { x.fillStyle = '#fff'; for (let i = 0; i < 18; i++) { const a = rng() * TAU, d = rng() * R * 0.8; x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, 1.3, 0, TAU); x.fill(); } }
      else { x.fillStyle = '#ffd1e0'; for (let i = 0; i < 7; i++) { const a = rng() * TAU, d = rng() * R * 0.7; x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, 1.6, 0, TAU); x.fill(); } }
    }
    return c;
  }
  function glowCv(col, s, R = 32) {
    const c = mkCv(R * 2 * s, R * 2 * s), x = c.getContext('2d');
    x.scale(s, s);
    const g = x.createRadialGradient(R, R, 0, R, R, R); g.addColorStop(0, rgba(col, 1)); g.addColorStop(0.35, rgba(col, 0.45)); g.addColorStop(1, rgba(col, 0));
    x.fillStyle = g; x.fillRect(0, 0, R * 2, R * 2);
    return c;
  }
  function flashCv(s) {
    const R = 16, c = mkCv(R * 2 * s, R * 2 * s), x = c.getContext('2d');
    x.scale(s, s); x.translate(R, R);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.3, 'rgba(255,214,120,.9)'); g.addColorStop(1, 'rgba(255,140,170,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fill();
    x.fillStyle = '#fffbe6'; star4(x, 0, 0, R * 0.9);
    return c;
  }

  // ---------- 靜態地圖繪製（分塊與總覽共用） ----------
  const ISL_PATH = new Map();
  function islandPath(off) {
    if (!ISL_PATH.has(off)) {
      const p = new Path2D();
      for (let k = 0; k <= 400; k++) { const th = k / 400 * TAU, r = ISL(th) + off; const X = CX + Math.cos(th) * r, Y = CY + Math.sin(th) * r; if (k) p.lineTo(X, Y); else p.moveTo(X, Y); }
      p.closePath(); ISL_PATH.set(off, p);
    }
    return ISL_PATH.get(off);
  }
  const FLOOR = { marble: ['#fbf5f3', '#f0e2e4'], wood: ['#ebcda6', '#dcb68c'], carpet: ['#f5d6df', '#ebc2cf'], tile: ['#eef7f5', '#dbeae7'], chapel: ['#fffbf6', '#f1e7da'], stone: ['#f1e8dc', '#e2d5c4'] };
  function drawFloor(x, b, det) {
    const F = b.gold ? ['#6e2c52', '#5d2446'] : FLOOR[b.floor] || FLOOR.tile;
    x.fillStyle = F[0]; x.fillRect(b.x, b.y, b.w, b.h);
    if (det) {
      x.save(); x.beginPath(); x.rect(b.x, b.y, b.w, b.h); x.clip();
      x.fillStyle = F[1];
      if (b.floor === 'marble' || b.floor === 'chapel') { const t = 40; for (let j = 0; j * t < b.h; j++) for (let i = 0; i * t < b.w; i++) if ((i + j) % 2) x.fillRect(b.x + i * t, b.y + j * t, t, t); x.strokeStyle = 'rgba(201,163,91,.25)'; x.lineWidth = 1; for (let i = 0; i * t < b.w; i++) { x.beginPath(); x.moveTo(b.x + i * t, b.y); x.lineTo(b.x + i * t, b.y + b.h); x.stroke(); } }
      else if (b.floor === 'wood') { const rng = makeRng(b.i * 31 + 7); for (let j = 0; j * 12 < b.h; j++) { x.fillRect(b.x, b.y + j * 12 + 11, b.w, 1); for (let k = 0; k < 3; k++) x.fillRect(b.x + rng() * b.w, b.y + j * 12, 1, 11); } }
      else if (b.floor === 'tile') { for (let i = 0; i * 24 < b.w; i++) x.fillRect(b.x + i * 24, b.y, 1, b.h); for (let j = 0; j * 24 < b.h; j++) x.fillRect(b.x, b.y + j * 24, b.w, 1); }
      else if (b.floor === 'carpet') { x.globalAlpha = 0.5; for (let j = 0; j * 26 < b.h + 26; j++) for (let i = 0; i * 26 < b.w + 26; i++) { const cx = b.x + i * 26 + (j % 2) * 13, cy = b.y + j * 26; x.beginPath(); x.moveTo(cx, cy - 5); x.lineTo(cx + 5, cy); x.lineTo(cx, cy + 5); x.lineTo(cx - 5, cy); x.fill(); } x.globalAlpha = 1; }
      else if (b.floor === 'stone') { x.strokeStyle = F[1]; x.lineWidth = 2; for (let r = 10; r < 70; r += 14) { x.beginPath(); x.arc(b.x + b.w / 2, b.y + b.h / 2, r, 0, TAU); x.stroke(); } }
      // 牆邊陰影
      x.strokeStyle = 'rgba(80,30,60,.12)'; x.lineWidth = 14; x.strokeRect(b.x, b.y, b.w, b.h);
      x.restore();
    }
  }
  function drawDecor(x, d, det) {
    const { x: X, y: Y, w: W, h: H } = d;
    switch (d.k) {
      case 'rug': { x.fillStyle = d.c || '#f3b9cb'; rr(x, X, Y, W, H, 6); x.fill(); if (det) { x.strokeStyle = 'rgba(255,240,200,.8)'; x.lineWidth = 2; rr(x, X + 5, Y + 5, W - 10, H - 10, 4); x.stroke(); } break; }
      case 'escalator': { x.fillStyle = '#d9dbe6'; x.fillRect(X, Y, W, H); x.fillStyle = '#b9bccb'; for (let j = 0; j < H; j += 10) x.fillRect(X + 6, Y + j, W - 12, 4); x.fillStyle = '#c9a35b'; x.fillRect(X, Y, 5, H); x.fillRect(X + W - 5, Y, 5, H); x.fillRect(X + W / 2 - 2, Y, 4, H); break; }
      case 'pool': { x.fillStyle = '#fff'; rr(x, X - 5, Y - 5, W + 10, H + 10, 8); x.fill(); const g = x.createLinearGradient(X, Y, X + W, Y + H); g.addColorStop(0, '#7fe0f0'); g.addColorStop(1, '#3fb2d6'); x.fillStyle = g; rr(x, X, Y, W, H, 6); x.fill(); if (det) { x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.5; for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(X + 10 + k * W / 5, Y + 12); x.quadraticCurveTo(X + 22 + k * W / 5, Y + 6, X + 34 + k * W / 5, Y + 12); x.stroke(); } } break; }
      case 'roseBed': { x.fillStyle = '#5ea866'; rr(x, X, Y, W, H, 10); x.fill(); if (det) { const rng = makeRng(Math.floor(X * 7 + Y)); for (let k = 0; k < W * H / 60; k++) { x.fillStyle = ['#ff7fa8', '#ffd1e0', '#e8456f', '#fff'][k % 4]; x.beginPath(); x.arc(X + 4 + rng() * (W - 8), Y + 4 + rng() * (H - 8), 2.2, 0, TAU); x.fill(); } } break; }
      case 'slot': { x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 2; x.beginPath(); x.moveTo(X, Y); x.lineTo(X, Y + H); x.moveTo(X + W, Y); x.lineTo(X + W, Y + H); x.stroke(); break; }
      case 'fountain': {
        const cx = X + W / 2, cy = Y + H / 2;
        x.fillStyle = '#f2e9e2'; x.beginPath(); x.arc(cx, cy, 60, 0, TAU); x.fill(); x.strokeStyle = '#d8c4b6'; x.lineWidth = 3; x.stroke();
        const g = x.createRadialGradient(cx - 15, cy - 15, 4, cx, cy, 54); g.addColorStop(0, '#b6f0f6'); g.addColorStop(1, '#4fb6d6');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 52, 0, TAU); x.fill();
        x.fillStyle = '#f7efe8'; x.beginPath(); x.arc(cx, cy, 16, 0, TAU); x.fill(); x.strokeStyle = '#c9a35b'; x.lineWidth = 2; x.stroke();
        if (det) { x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.5; for (const r of [26, 36, 46]) { x.beginPath(); x.arc(cx, cy, r, 0.3, 2.2); x.stroke(); } }
        break;
      }
      case 'mannequin': { x.fillStyle = '#f7c6d6'; x.beginPath(); x.moveTo(X + W / 2, Y); x.lineTo(X + W, Y + H); x.lineTo(X, Y + H); x.closePath(); x.fill(); x.fillStyle = '#f3e6dd'; x.beginPath(); x.arc(X + W / 2, Y + 2, 4, 0, TAU); x.fill(); break; }
      case 'plant': { x.fillStyle = '#c9a35b'; x.beginPath(); x.arc(X + W / 2, Y + H / 2, W / 2, 0, TAU); x.fill(); x.fillStyle = '#6dbb73'; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; x.beginPath(); x.ellipse(X + W / 2 + Math.cos(a) * 5, Y + H / 2 + Math.sin(a) * 5, 6, 3, a, 0, TAU); x.fill(); } break; }
      case 'telescope': { x.fillStyle = '#c9a35b'; x.beginPath(); x.arc(X + W / 2, Y + H / 2, 6, 0, TAU); x.fill(); x.fillStyle = '#5a3247'; x.save(); x.translate(X + W / 2, Y + H / 2); x.rotate(-0.8); x.fillRect(-3, -14, 6, 16); x.restore(); break; }
    }
  }
  function drawObs(x, o, det) {
    const { x: X, y: Y, w: W, h: H } = o;
    switch (o.k) {
      case 'wall': {
        const c = o.c || '#f1e6ea';
        x.fillStyle = shade(c, -0.22); x.fillRect(X, Y + H - 3, W, 8);
        x.fillStyle = c; x.fillRect(X, Y - 5, W, H + 2);
        x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(X, Y - 5, W, 1.5);
        x.strokeStyle = 'rgba(90,40,70,.28)'; x.lineWidth = 1; x.strokeRect(X + 0.5, Y - 4.5, W - 1, H + 1);
        break;
      }
      case 'counter': { x.fillStyle = '#fffaf6'; rr(x, X, Y, W, H, 3); x.fill(); x.fillStyle = 'rgba(150,215,240,.75)'; rr(x, X + 4, Y + 4, W - 8, H - 8, 2); x.fill(); x.strokeStyle = '#c9a35b'; x.lineWidth = 1.5; rr(x, X, Y, W, H, 3); x.stroke(); if (det) { x.fillStyle = '#ffd36b'; for (let k = 10; k < W - 8; k += 14) { x.beginPath(); x.arc(X + k, Y + H / 2, 2, 0, TAU); x.fill(); } } break; }
      case 'rack': { x.fillStyle = '#d8d0dc'; x.fillRect(X, Y, W, H); const cols = ['#f7a8c4', '#fff', '#c9b8f2', '#a8e2d0', '#f6d27a', '#e84c70']; const n = Math.floor(Math.max(W, H) / 7); for (let k = 0; k < n; k++) { x.fillStyle = cols[k % cols.length]; if (W > H) x.fillRect(X + 2 + k * 7, Y - 3, 5, H + 6); else x.fillRect(X - 3, Y + 2 + k * 7, W + 6, 5); } break; }
      case 'shelf': { x.fillStyle = '#c99a6e'; rr(x, X, Y, W, H, 2); x.fill(); const cols = ['#e84c70', '#2e1f27', '#f6d27a', '#fff', '#7b3b2e']; for (let k = 0; k < W / 12 - 1; k++) { x.fillStyle = cols[k % 5]; rr(x, X + 4 + k * 12, Y + 4, 8, H - 8, 2); x.fill(); } break; }
      case 'sofa': { x.fillStyle = '#e88fae'; rr(x, X, Y, W, H, 6); x.fill(); x.fillStyle = '#f7b8cd'; const n = Math.max(2, Math.round(W / 26)); for (let k = 0; k < n; k++) { rr(x, X + 4 + k * (W - 8) / n, Y + 6, (W - 8) / n - 3, H - 9, 4); x.fill(); } x.fillStyle = '#d06f93'; x.fillRect(X, Y, W, 5); break; }
      case 'table': { x.fillStyle = '#c98d6a'; x.beginPath(); x.ellipse(X + W / 2, Y + H / 2, W / 2, H / 2, 0, 0, TAU); x.fill(); x.fillStyle = '#e3b08f'; x.beginPath(); x.ellipse(X + W / 2 - 2, Y + H / 2 - 2, W / 2 - 4, H / 2 - 4, 0, 0, TAU); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(X + W / 2, Y + H / 2, 4, 0, TAU); x.fill(); break; }
      case 'bed': { x.fillStyle = '#fff'; rr(x, X, Y, W, H, 5); x.fill(); x.strokeStyle = '#e7c9d4'; x.lineWidth = 1.5; x.stroke(); x.fillStyle = '#f7b8cd'; rr(x, X + 3, Y + H * 0.45, W - 6, H * 0.5, 4); x.fill(); x.fillStyle = '#fbe3ec'; rr(x, X + 6, Y + 5, W * 0.38, H * 0.3, 4); x.fill(); rr(x, X + W * 0.54, Y + 5, W * 0.38, H * 0.3, 4); x.fill(); break; }
      case 'pew': case 'bench': { x.fillStyle = '#b07a52'; rr(x, X, Y, W, H, 3); x.fill(); x.fillStyle = '#d29d72'; for (let k = 0; k < 3; k++) { if (W > H) x.fillRect(X + 2, Y + 2 + k * (H - 4) / 3, W - 4, (H - 4) / 3 - 1); else x.fillRect(X + 2 + k * (W - 4) / 3, Y + 2, (W - 4) / 3 - 1, H - 4); } break; }
      case 'planter': { x.fillStyle = '#ece2d8'; rr(x, X, Y, W, H, 5); x.fill(); x.strokeStyle = '#cdbca9'; x.lineWidth = 1.5; x.stroke(); x.fillStyle = '#6fbf73'; x.beginPath(); x.arc(X + W / 2, Y + H / 2, W * 0.36, 0, TAU); x.fill(); x.fillStyle = '#98d68a'; x.beginPath(); x.arc(X + W / 2 - 3, Y + H / 2 - 3, W * 0.2, 0, TAU); x.fill(); x.fillStyle = '#ff8fb5'; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(X + W / 2 + Math.cos(k * 1.7) * W * 0.22, Y + H / 2 + Math.sin(k * 1.7) * W * 0.22, 2.4, 0, TAU); x.fill(); } break; }
      case 'column': { x.fillStyle = '#fffaf3'; x.beginPath(); x.arc(X + W / 2, Y + H / 2, W / 2, 0, TAU); x.fill(); x.strokeStyle = '#c9a35b'; x.lineWidth = 1.5; x.stroke(); break; }
      case 'bar': { x.fillStyle = '#6b3b2c'; rr(x, X, Y, W, H, 4); x.fill(); x.fillStyle = '#8c5640'; rr(x, X + 2, Y + 2, W - 4, H / 2 - 2, 3); x.fill(); const cols = ['#9fe0c8', '#f6d27a', '#ff8fb5', '#fff']; for (let k = 8; k < W - 6; k += 10) { x.fillStyle = cols[(k / 10 | 0) % 4]; x.beginPath(); x.arc(X + k, Y + H * 0.7, 2.6, 0, TAU); x.fill(); } break; }
      case 'piano': { x.fillStyle = '#1f1219'; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + W, Y); x.quadraticCurveTo(X + W, Y + H, X + W * 0.45, Y + H); x.lineTo(X, Y + H); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.fillRect(X + 2, Y + 2, W - 4, 6); x.fillStyle = '#1f1219'; for (let k = 4; k < W - 4; k += 4) x.fillRect(X + k, Y + 2, 1.5, 4); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(X + 6, Y + 14, W * 0.4, 2); break; }
      case 'vanity': { x.fillStyle = '#fff4ea'; rr(x, X, Y, W, H, 3); x.fill(); x.strokeStyle = '#c9a35b'; x.lineWidth = 1.5; x.stroke(); x.fillStyle = 'rgba(160,220,245,.8)'; x.beginPath(); x.ellipse(X + W / 2, Y + 4, W * 0.3, 4, 0, 0, TAU); x.fill(); break; }
      case 'altar': { x.fillStyle = '#fff'; rr(x, X, Y, W, H, 4); x.fill(); x.strokeStyle = '#c9a35b'; x.lineWidth = 2; x.stroke(); x.fillStyle = '#ff9cc0'; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(X + W / 2, Y + 6 + k * (H - 12) / 3, 3.5, 0, TAU); x.fill(); } break; }
      case 'kiosk': { x.fillStyle = '#fff'; rr(x, X, Y, W, H, 5); x.fill(); x.strokeStyle = '#e48fb0'; x.lineWidth = 2; x.stroke(); for (let k = 0; k < 5; k++) { x.fillStyle = k % 2 ? '#fff' : '#ff9cc0'; x.beginPath(); x.moveTo(X + W / 2, Y + H / 2); x.arc(X + W / 2, Y + H / 2, 22, k / 5 * TAU, (k + 1) / 5 * TAU); x.fill(); } x.fillStyle = '#ffd36b'; x.beginPath(); x.arc(X + W / 2, Y + H / 2, 3, 0, TAU); x.fill(); break; }
      case 'crate': { x.fillStyle = '#d7a777'; rr(x, X, Y, W, H, 2); x.fill(); x.strokeStyle = '#a8764a'; x.lineWidth = 2; x.strokeRect(X + 3, Y + 3, W - 6, H - 6); x.beginPath(); x.moveTo(X + 3, Y + 3); x.lineTo(X + W - 3, Y + H - 3); x.moveTo(X + W - 3, Y + 3); x.lineTo(X + 3, Y + H - 3); x.stroke(); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(X + 2, Y + 1, W - 4, 2); break; }
      case 'car': case 'limo': {
        const c = o.c || '#fff';
        x.fillStyle = c; rr(x, X, Y, W, H, 9); x.fill(); x.strokeStyle = 'rgba(60,25,45,.45)'; x.lineWidth = 1.2; x.stroke();
        const vert = H > W, up = o.up;
        x.fillStyle = 'rgba(70,90,130,.85)';
        if (vert) { const fy = up ? Y + 8 : Y + H - 26; rr(x, X + 5, fy, W - 10, 16, 4); x.fill(); rr(x, X + 6, up ? Y + H - 18 : Y + 10, W - 12, 9, 3); x.fill(); x.fillStyle = shade(c, 0.35); rr(x, X + 6, Y + 26, W - 12, H - 50, 4); x.fill(); x.fillStyle = '#fff6c4'; x.fillRect(X + 4, up ? Y + 1 : Y + H - 3, 8, 2); x.fillRect(X + W - 12, up ? Y + 1 : Y + H - 3, 8, 2); }
        else { rr(x, X + W - 30, Y + 4, 16, H - 8, 4); x.fill(); rr(x, X + 10, Y + 5, 10, H - 10, 3); x.fill(); x.fillStyle = shade(c, 0.35); rr(x, X + 24, Y + 5, W - 58, H - 10, 4); x.fill(); x.fillStyle = '#fff6c4'; x.fillRect(X + W - 3, Y + 4, 2, 6); x.fillRect(X + W - 3, Y + H - 10, 2, 6); }
        x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(X + 4, Y + 3, W * 0.35, 2);
        break;
      }
      case 'hedge': {
        x.fillStyle = '#3f9150'; rr(x, X, Y, W, H, 8); x.fill();
        if (det) { const rng = makeRng(Math.floor(X * 13 + Y * 7)); const n = Math.max(3, W * H / 70); for (let k = 0; k < n; k++) { x.fillStyle = k % 3 ? '#5fb36a' : '#77c47c'; x.beginPath(); x.arc(X + 4 + rng() * (W - 8), Y + 4 + rng() * (H - 8), 4 + rng() * 3, 0, TAU); x.fill(); } }
        x.fillStyle = 'rgba(255,255,230,.25)'; x.fillRect(X + 3, Y + 2, W - 6, 2);
        break;
      }
      case 'rock': { x.fillStyle = '#c9bba8'; x.beginPath(); x.ellipse(X + W / 2, Y + H / 2, W / 2, H / 2, 0.3, 0, TAU); x.fill(); x.fillStyle = '#e2d6c5'; x.beginPath(); x.ellipse(X + W / 2 - 3, Y + H / 2 - 3, W / 3, H / 3, 0.3, 0, TAU); x.fill(); break; }
      case 'trunk': { x.fillStyle = '#9b6a42'; x.beginPath(); x.arc(X + W / 2, Y + H / 2, 6, 0, TAU); x.fill(); break; }
      case 'yacht': {
        const c = o.c || '#fff';
        x.fillStyle = c; x.beginPath(); x.moveTo(X + W / 2, Y); x.quadraticCurveTo(X + W, Y + H * 0.2, X + W, Y + H * 0.45); x.lineTo(X + W, Y + H); x.lineTo(X, Y + H); x.lineTo(X, Y + H * 0.45); x.quadraticCurveTo(X, Y + H * 0.2, X + W / 2, Y); x.fill();
        x.strokeStyle = 'rgba(60,40,80,.35)'; x.lineWidth = 1.5; x.stroke();
        x.fillStyle = '#d9b48a'; rr(x, X + 8, Y + H * 0.5, W - 16, H * 0.42, 4); x.fill();
        x.fillStyle = '#fff'; rr(x, X + 10, Y + H * 0.28, W - 20, H * 0.24, 6); x.fill(); x.fillStyle = 'rgba(70,110,170,.8)'; rr(x, X + 13, Y + H * 0.3, W - 26, 8, 3); x.fill();
        x.fillStyle = '#d6457a'; x.fillRect(X + 2, Y + H * 0.46, W - 4, 3);
        break;
      }
      case 'fence': { x.fillStyle = 'rgba(120,110,140,.55)'; x.fillRect(X, Y, W, H); x.fillStyle = '#7a7088'; const L = Math.max(W, H); for (let k = 0; k <= L; k += 30) { if (W > H) x.fillRect(X + k - 2, Y - 1, 4, H + 2); else x.fillRect(X - 1, Y + k - 2, W + 2, 4); } break; }
      case 'net': { x.fillStyle = '#fff'; x.fillRect(X, Y, W, H); break; }
    }
  }
  function drawShadowOf(x, o) {
    if (o.hid || o.k === 'fence' || o.k === 'net' || o.k === 'trunk') return;
    x.fillStyle = o.k === 'wall' ? 'rgba(70,25,55,.2)' : 'rgba(70,25,55,.16)';
    x.fillRect(o.x + 4, o.y + 6, o.w, o.h);
  }
  function drawArea(x, a, det) {
    const { x: X, y: Y, w: W, h: H } = a;
    switch (a.k) {
      case 'plaza': {
        x.fillStyle = '#f5ede7'; rr(x, X, Y, W, H, 18); x.fill();
        if (det) { x.save(); rr(x, X, Y, W, H, 18); x.clip(); x.strokeStyle = 'rgba(205,180,168,.45)'; x.lineWidth = 1; for (let i = 40; i < W; i += 40) { x.beginPath(); x.moveTo(X + i, Y); x.lineTo(X + i, Y + H); x.stroke(); } for (let j = 40; j < H; j += 40) { x.beginPath(); x.moveTo(X, Y + j); x.lineTo(X + W, Y + j); x.stroke(); } x.fillStyle = 'rgba(240,160,190,.35)'; for (let i = 80; i < W; i += 160) for (let j = 80; j < H; j += 160) { x.beginPath(); x.moveTo(X + i, Y + j - 12); x.lineTo(X + i + 12, Y + j); x.lineTo(X + i, Y + j + 12); x.lineTo(X + i - 12, Y + j); x.fill(); } x.restore(); }
        x.strokeStyle = '#e5d2c7'; x.lineWidth = 4; rr(x, X, Y, W, H, 18); x.stroke();
        break;
      }
      case 'garden': {
        x.fillStyle = '#9fd487'; x.fillRect(X, Y, W, H);
        if (det) { x.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < W; i += 40) if ((i / 40) % 2) x.fillRect(X + i, Y, 40, H); }
        x.fillStyle = '#efe5d8'; x.fillRect(X + W / 2 - 26, Y, 52, H); x.fillRect(X, Y + H / 2 - 26, W, 52);
        x.strokeStyle = '#efe5d8'; x.lineWidth = 34; x.beginPath(); x.arc(X + W / 2, Y + H / 2, 196, 0, TAU); x.stroke();
        break;
      }
      case 'asphalt': { x.fillStyle = '#968e9b'; rr(x, X, Y, W, H, 12); x.fill(); x.strokeStyle = '#efe2e6'; x.lineWidth = 6; x.stroke(); break; }
      case 'boardwalk': case 'deck': { x.fillStyle = a.k === 'deck' ? '#e6c6a0' : '#d9b48a'; rr(x, X, Y, W, H, 10); x.fill(); if (det) { x.fillStyle = 'rgba(150,100,60,.25)'; for (let j = 12; j < H; j += 13) x.fillRect(X + 4, Y + j, W - 8, 1.5); } break; }
      case 'court': { x.fillStyle = '#86c9a6'; x.fillRect(X, Y, W, H); x.fillStyle = '#6aa4d8'; x.fillRect(X + 24, Y + 24, W - 48, H - 48); x.strokeStyle = '#fff'; x.lineWidth = 2.5; x.strokeRect(X + 24, Y + 24, W - 48, H - 48); x.beginPath(); x.moveTo(X + W / 2, Y + 24); x.lineTo(X + W / 2, Y + H - 24); x.moveTo(X + 24, Y + H / 2); x.lineTo(X + W - 24, Y + H / 2); x.stroke(); x.strokeRect(X + 60, Y + 44, W - 120, H - 88); break; }
      case 'helipad': { x.fillStyle = '#857c90'; x.beginPath(); x.arc(X + W / 2, Y + H / 2, W / 2, 0, TAU); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 4; x.beginPath(); x.arc(X + W / 2, Y + H / 2, W / 2 - 12, 0, TAU); x.stroke(); x.fillStyle = '#ff9cc0'; x.font = '700 64px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', X + W / 2, Y + H / 2 + 4); break; }
    }
  }
  function drawWorld(x, M, B, det) {
    const vis = (r, m = 0) => r.x + r.w + m > B.x0 && r.x - m < B.x1 && r.y + r.h + m > B.y0 && r.y - m < B.y1;
    x.fillStyle = '#4fb4cf'; x.fillRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
    if (det) { const rng = makeRng(Math.floor(B.x0 * 3 + B.y0 * 7) + 11); x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2; for (let k = 0; k < 26; k++) { const X = B.x0 + rng() * (B.x1 - B.x0), Y = B.y0 + rng() * (B.y1 - B.y0); x.beginPath(); x.moveTo(X, Y); x.quadraticCurveTo(X + 14, Y - 6, X + 28, Y); x.stroke(); } }
    x.fillStyle = 'rgba(110,210,222,.55)'; x.fill(islandPath(170));
    x.fillStyle = 'rgba(150,228,228,.75)'; x.fill(islandPath(80));
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 8; x.stroke(islandPath(16));
    x.fillStyle = '#f4dfb1'; x.fill(islandPath(0));
    x.strokeStyle = '#e8cd99'; x.lineWidth = 12; x.stroke(islandPath(2));
    for (const p of M.piers) if (vis(p, 10)) { x.fillStyle = '#c99a6e'; x.fillRect(p.x, p.y, p.w, p.h); if (det) { x.fillStyle = 'rgba(110,70,40,.35)'; for (let j = p.y; j < p.y + p.h; j += 10) x.fillRect(p.x, j, p.w, 1.5); x.fillStyle = '#8a5d3a'; for (let j = p.y + 20; j < p.y + p.h; j += 60) { x.beginPath(); x.arc(p.x - 2, j, 4, 0, TAU); x.arc(p.x + p.w + 2, j, 4, 0, TAU); x.fill(); } } }
    x.fillStyle = '#a6d98c'; x.fill(islandPath(-85));
    x.strokeStyle = 'rgba(220,226,165,.85)'; x.lineWidth = 18; x.stroke(islandPath(-85));
    if (det) {
      const rng = makeRng(Math.floor(B.x0 * 13 + B.y0 * 17) + 5);
      for (let k = 0; k < 340; k++) {
        const X = B.x0 + rng() * (B.x1 - B.x0), Y = B.y0 + rng() * (B.y1 - B.y0);
        if (coastDist(X, Y) < 95) continue;
        x.fillStyle = k % 3 ? 'rgba(80,150,70,.28)' : 'rgba(220,245,190,.5)';
        x.fillRect(X, Y, 2, 5);
      }
    }
    for (const f of M.flowers) if (vis({ x: f.x - f.r, y: f.y - f.r, w: f.r * 2, h: f.r * 2 })) {
      x.fillStyle = 'rgba(140,205,120,.55)'; x.beginPath(); x.arc(f.x, f.y, f.r, 0, TAU); x.fill();
      if (det) { const rng = makeRng(f.seed); const cols = [['#ff9cc0', '#fff'], ['#ffd36b', '#fff'], ['#c9b8f2', '#fff'], ['#ff7fa8', '#ffd1e0']][f.c]; for (let k = 0; k < f.r * 0.9; k++) { const a = rng() * TAU, d = Math.sqrt(rng()) * f.r * 0.9; x.fillStyle = cols[k % 2]; x.beginPath(); x.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 2.2, 0, TAU); x.fill(); } }
    }
    for (const a of M.areas) if (vis(a, 10)) drawArea(x, a, det);
    for (const r of M.roads) if (vis(r, 10)) { x.fillStyle = '#f0e4e7'; x.fillRect(r.x - 7, r.y - 7, r.w + 14, r.h + 14); }
    for (const r of M.roads) if (vis(r, 10)) { x.fillStyle = '#9e939f'; x.fillRect(r.x, r.y, r.w, r.h); }
    if (det) { x.strokeStyle = 'rgba(255,246,214,.85)'; x.lineWidth = 3; x.setLineDash([24, 18]); for (const r of M.roads) if (vis(r, 10)) { x.beginPath(); if (r.w > r.h) { x.moveTo(r.x + 8, r.y + r.h / 2); x.lineTo(r.x + r.w - 8, r.y + r.h / 2); } else { x.moveTo(r.x + r.w / 2, r.y + 8); x.lineTo(r.x + r.w / 2, r.y + r.h - 8); } x.stroke(); } x.setLineDash([]); }
    for (const d of M.decor) if (d.bi == null && vis(d, 70)) drawDecor(x, d, det);
    if (det) for (const t of M.trees) if (vis({ x: t.x - 60, y: t.y - 60, w: 120, h: 120 })) { x.fillStyle = 'rgba(40,80,50,.16)'; x.beginPath(); x.ellipse(t.x + 14, t.y + 16, 40 * t.s, 30 * t.s, 0.4, 0, TAU); x.fill(); }
    for (const b of M.bld) if (vis(b, 20)) { x.fillStyle = 'rgba(70,25,55,.18)'; x.fillRect(b.x + 6, b.y + 8, b.w, b.h); drawFloor(x, b, det); }
    for (const d of M.decor) if (d.bi != null && vis(d, 20)) drawDecor(x, d, det);
    for (const bu of M.bushes) if (vis({ x: bu.x - 30, y: bu.y - 30, w: 60, h: 60 })) { const c = ['#5fae66', '#6dbb73', '#86c97a'][bu.c]; x.fillStyle = 'rgba(40,80,50,.18)'; x.beginPath(); x.arc(bu.x + 4, bu.y + 5, bu.r, 0, TAU); x.fill(); x.fillStyle = c; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(bu.x + Math.cos(k * 1.6) * bu.r * 0.45, bu.y + Math.sin(k * 1.6) * bu.r * 0.45, bu.r * 0.62, 0, TAU); x.fill(); } x.fillStyle = 'rgba(255,255,220,.3)'; x.beginPath(); x.arc(bu.x - bu.r * 0.3, bu.y - bu.r * 0.35, bu.r * 0.3, 0, TAU); x.fill(); }
    const obs = M.obs.filter(o => vis(o, 20));
    for (const o of obs) drawShadowOf(x, o);
    for (const o of obs) drawObs(x, o, det);
    if (det) for (const l of M.loungers) if (vis({ x: l.x - 30, y: l.y - 30, w: 60, h: 60 })) {
      x.save(); x.translate(l.x, l.y); x.rotate(l.a);
      x.fillStyle = '#fff'; rr(x, -9, -20, 18, 40, 5); x.fill(); x.strokeStyle = '#7fd1c7'; x.lineWidth = 1.5; x.stroke(); x.fillStyle = '#7fd1c7'; for (let k = -14; k < 18; k += 8) x.fillRect(-8, k, 16, 3);
      x.restore();
    }
  }
  // 屋頂（之後動態疊在角色上面，玩家走進去就淡出）
  function roofCv(b, s) {
    const pad = 8, c = mkCv((b.w + pad * 2) * s, (b.h + pad * 2) * s), x = c.getContext('2d');
    x.scale(s, s); x.translate(pad, pad);
    const { w: W, h: H } = b;
    x.fillStyle = 'rgba(60,20,45,.25)'; rr(x, 5, 7, W, H, 6); x.fill();
    if (b.gazebo) {
      const g = x.createRadialGradient(W * 0.38, H * 0.35, 4, W / 2, H / 2, W * 0.62); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ecd2dc');
      x.fillStyle = g; x.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + Math.PI / 8; x.lineTo(W / 2 + Math.cos(a) * W * 0.62, H / 2 + Math.sin(a) * H * 0.62); } x.closePath(); x.fill();
      x.strokeStyle = '#c9a35b'; x.lineWidth = 2; x.stroke();
      x.strokeStyle = 'rgba(201,163,91,.6)'; x.lineWidth = 1; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + Math.PI / 8; x.beginPath(); x.moveTo(W / 2, H / 2); x.lineTo(W / 2 + Math.cos(a) * W * 0.62, H / 2 + Math.sin(a) * H * 0.62); x.stroke(); }
      x.fillStyle = '#ffd36b'; x.beginPath(); x.arc(W / 2, H / 2, 6, 0, TAU); x.fill();
      return c;
    }
    const r1 = b.roof || '#f3c6d6', r2 = b.roof2 ? mix(b.roof2, r1, 0.35) : shade(r1, -0.12);
    if (b.big) {
      const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, shade(r1, 0.35)); g.addColorStop(0.5, r1); g.addColorStop(1, r2);
      x.fillStyle = g; rr(x, -4, -4, W + 8, H + 8, 8); x.fill();
      x.strokeStyle = '#c9a35b'; x.lineWidth = 4; rr(x, -2, -2, W + 4, H + 4, 7); x.stroke();
      x.strokeStyle = '#fff3d6'; x.lineWidth = 1.2; rr(x, 8, 8, W - 16, H - 16, 5); x.stroke();
      const sg = x.createLinearGradient(0, H * 0.25, 0, H * 0.75); sg.addColorStop(0, '#d9f3ff'); sg.addColorStop(1, '#8fc9ea');
      x.fillStyle = sg; rr(x, W * 0.36, H * 0.22, W * 0.28, H * 0.56, 8); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 1.5; for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(W * 0.36 + k * W * 0.07, H * 0.22); x.lineTo(W * 0.36 + k * W * 0.07, H * 0.78); x.stroke(); } for (let k = 1; k < 5; k++) { x.beginPath(); x.moveTo(W * 0.36, H * 0.22 + k * H * 0.112); x.lineTo(W * 0.64, H * 0.22 + k * H * 0.112); x.stroke(); }
      x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.moveTo(W * 0.37, H * 0.24); x.lineTo(W * 0.45, H * 0.24); x.lineTo(W * 0.38, H * 0.5); x.closePath(); x.fill();
      x.fillStyle = '#fff6e0'; x.strokeStyle = '#9c742f'; x.lineWidth = 2.5; x.font = 'italic 700 46px "Bodoni Moda", Didot, Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.strokeText('ERIKA', W * 0.18, H * 0.5); x.fillText('ERIKA', W * 0.18, H * 0.5); x.strokeText('ERIKA', W * 0.82, H * 0.5); x.fillText('ERIKA', W * 0.82, H * 0.5);
      x.fillStyle = '#e7dbe2'; for (const [ax, ay] of [[40, 30], [W - 70, 30], [40, H - 60], [W - 70, H - 60]]) { rr(x, ax, ay, 30, 22, 3); x.fill(); x.fillStyle = '#c9bcc6'; x.beginPath(); x.arc(ax + 15, ay + 11, 7, 0, TAU); x.fill(); x.fillStyle = '#e7dbe2'; }
      return c;
    }
    // 一般斜屋頂：沿長邊有屋脊
    const horiz = W >= H;
    x.save(); rr(x, -4, -4, W + 8, H + 8, 5); x.clip();
    if (horiz) { const g1 = x.createLinearGradient(0, 0, 0, H / 2); g1.addColorStop(0, shade(r1, 0.25)); g1.addColorStop(1, r1); x.fillStyle = g1; x.fillRect(-4, -4, W + 8, H / 2 + 4); const g2 = x.createLinearGradient(0, H / 2, 0, H); g2.addColorStop(0, r2); g2.addColorStop(1, shade(r2, -0.15)); x.fillStyle = g2; x.fillRect(-4, H / 2, W + 8, H / 2 + 4); }
    else { const g1 = x.createLinearGradient(0, 0, W / 2, 0); g1.addColorStop(0, shade(r1, 0.25)); g1.addColorStop(1, r1); x.fillStyle = g1; x.fillRect(-4, -4, W / 2 + 4, H + 8); const g2 = x.createLinearGradient(W / 2, 0, W, 0); g2.addColorStop(0, r2); g2.addColorStop(1, shade(r2, -0.15)); x.fillStyle = g2; x.fillRect(W / 2, -4, W / 2 + 4, H + 8); }
    x.strokeStyle = 'rgba(60,20,45,.12)'; x.lineWidth = 1.2;
    if (horiz) for (let j = 8; j < H; j += 11) { x.beginPath(); x.moveTo(-4, j); x.lineTo(W + 4, j); x.stroke(); }
    else for (let i = 8; i < W; i += 11) { x.beginPath(); x.moveTo(i, -4); x.lineTo(i, H + 4); x.stroke(); }
    x.restore();
    x.strokeStyle = b.gold ? '#e7c57a' : 'rgba(255,255,255,.85)'; x.lineWidth = 3; x.beginPath(); if (horiz) { x.moveTo(0, H / 2); x.lineTo(W, H / 2); } else { x.moveTo(W / 2, 0); x.lineTo(W / 2, H); } x.stroke();
    x.strokeStyle = b.gold ? '#c9a35b' : 'rgba(60,20,45,.3)'; x.lineWidth = b.gold ? 3 : 1.5; rr(x, -4, -4, W + 8, H + 8, 5); x.stroke();
    if (b.sign) {
      const fs = Math.min(22, W / Math.max(4, b.sign.length) * 1.5);
      x.font = `italic 700 ${fs}px "Bodoni Moda", Didot, Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      const tw = x.measureText(b.sign).width + 18, cy = horiz ? H * 0.25 : H / 2, cx = horiz ? W / 2 : W * 0.25;
      x.fillStyle = 'rgba(59,21,48,.85)'; rr(x, cx - tw / 2, cy - fs * 0.75, tw, fs * 1.5, 6); x.fill(); x.strokeStyle = '#e7c57a'; x.lineWidth = 1.2; x.stroke();
      x.fillStyle = '#fff3d6'; x.fillText(b.sign, cx, cy + 1);
    } else if (b.name && !b.gazebo) {
      const fs = Math.min(15, W / b.name.length * 1.1);
      x.font = `700 ${fs}px "Noto Serif TC", serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      const tw = x.measureText(b.name).width + 16, cy = horiz ? H * 0.25 : H / 2, cx = horiz ? W / 2 : W * 0.25;
      x.fillStyle = 'rgba(255,250,245,.88)'; rr(x, cx - tw / 2, cy - fs * 0.8, tw, fs * 1.6, 6); x.fill(); x.strokeStyle = '#c9a35b'; x.lineWidth = 1; x.stroke();
      x.fillStyle = '#5a2740'; x.fillText(b.name, cx, cy + 1);
    }
    if (b.floor === 'chapel') { x.fillStyle = '#ffd36b'; x.fillRect(W * 0.75 - 2, H / 2 - 12, 4, 24); x.fillRect(W * 0.75 - 9, H / 2 - 5, 18, 4); }
    return c;
  }

  // ---------- SVG 小圖 ----------
  const SV = {
    heal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6.5" width="17" height="13" rx="3" fill="#fff" stroke="#b02c5c" stroke-width="1.3"/><path d="M12 9.5v7M8.5 13h7" stroke="#e0386f" stroke-width="2.6" stroke-linecap="round"/><path d="M9 6.5V4.8h6v1.7" fill="none" stroke="#b02c5c" stroke-width="1.3"/></svg>',
    drink: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3.5" width="10" height="17" rx="3" fill="#ff8fb5" stroke="#a92b58" stroke-width="1.2"/><rect x="7" y="3.5" width="10" height="2.8" rx="1.2" fill="#e2bd6a"/><path d="M12.8 8l-3.2 5.2h2.5l-1 4.3 3.3-5.6h-2.5z" fill="#fff3c4"/></svg>',
    reload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4.5H15"/></svg>',
    fire: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="12.5" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="24" cy="24" r="3.4" fill="currentColor"/><path d="M24 5v9M24 34v9M5 24h9M34 24h9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    drop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5a9 7.5 0 0 1 18 0z" fill="#ff9cc0" stroke="#a92b58" stroke-width="1.1"/><path d="M3.5 10.5l6.5 5.5M20.5 10.5 14 16M12 10.5V16" stroke="#a92b58" stroke-width="1"/><rect x="8.5" y="15" width="7" height="6" rx="1" fill="#f6d27a" stroke="#9c742f" stroke-width="1"/></svg>',
    aim: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h14l-3-3M20 16H6l3 3"/></svg>',
    plane: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12c0-.9-.8-1.5-1.7-1.5H14L9.5 3H7.6l2.2 7.5H5.2L3.6 8.3H2l1 3.7-1 3.7h1.6l1.6-2.2h4.6L7.6 21h1.9l4.5-7.5h5.3c.9 0 1.7-.6 1.7-1.5z" fill="currentColor"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z" fill="currentColor"/></svg>',
  };
  const SCENE = `<svg class="ry-scene" viewBox="0 0 390 640" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>
    <linearGradient id="rySky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0d2a"/><stop offset=".38" stop-color="#7b2d5d"/><stop offset=".66" stop-color="#ee88ad"/><stop offset=".8" stop-color="#ffd2a8"/></linearGradient>
    <linearGradient id="rySea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4a6bd"/><stop offset=".35" stop-color="#a5578d"/><stop offset="1" stop-color="#3a1438"/></linearGradient>
    <radialGradient id="rySun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6d6"/><stop offset=".5" stop-color="#ffd27e"/><stop offset="1" stop-color="#ffb37e" stop-opacity="0"/></radialGradient>
    <linearGradient id="ryIsl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b2350"/><stop offset="1" stop-color="#2c0e28"/></linearGradient></defs>
    <rect width="390" height="640" fill="url(#rySky)"/>
    <g fill="#fff" opacity=".8"><circle cx="40" cy="60" r="1"/><circle cx="120" cy="34" r="1.3"/><circle cx="210" cy="80" r=".9"/><circle cx="300" cy="40" r="1.2"/><circle cx="350" cy="110" r="1"/><circle cx="80" cy="140" r=".8"/><circle cx="260" cy="150" r=".9"/></g>
    <circle cx="250" cy="340" r="96" fill="url(#rySun)"/><circle cx="250" cy="340" r="34" fill="#fff1c9" opacity=".9"/>
    <rect y="340" width="390" height="300" fill="url(#rySea)"/>
    <g fill="#fff3d6" opacity=".7"><rect x="205" y="352" width="90" height="2.5" rx="1.2"/><rect x="220" y="364" width="60" height="2" rx="1"/><rect x="232" y="376" width="36" height="2" rx="1"/><rect x="240" y="390" width="20" height="2" rx="1"/></g>
    <path d="M-10 355 C 40 325 90 317 130 323 L 150 295 h40 v-50 h14 v-20 h40 v20 h14 v50 h20 l14 28 C 300 315 360 325 400 347 V 365 H -10z" fill="url(#ryIsl)"/>
    <g fill="#ffd27e" opacity=".85"><rect x="196" y="235" width="6" height="5"/><rect x="208" y="235" width="6" height="5"/><rect x="220" y="235" width="6" height="5"/><rect x="232" y="235" width="6" height="5"/><rect x="190" y="257" width="6" height="5"/><rect x="214" y="257" width="6" height="5"/><rect x="238" y="257" width="6" height="5"/><rect x="160" y="305" width="5" height="4"/><rect x="172" y="305" width="5" height="4"/><rect x="270" y="305" width="5" height="4"/></g>
    <g fill="#2c0e28" transform="translate(0 -115)"><path d="M60 452c2-30 4-52 1-74" stroke="#2c0e28" stroke-width="4" fill="none"/><path d="M61 380c-18-10-34-6-44 2 14-2 28 0 44-2zm0 0c-10-16-26-20-38-18 12 4 24 10 38 18zm0 0c8-18 24-22 38-20-14 4-26 10-38 20zm0 0c18-6 34 0 42 10-14-6-28-8-42-10zm0 0c-4-16 0-28 8-36-4 12-6 24-8 36z"/>
    <path d="M330 456c-2-26-1-44 4-60" stroke="#2c0e28" stroke-width="3.5" fill="none"/><path d="M334 396c-16-8-30-4-38 4 12-2 24-1 38-4zm0 0c-8-14-22-16-32-14 10 3 20 8 32 14zm0 0c8-15 22-18 34-15-12 3-23 8-34 15zm0 0c15-4 28 2 34 11-12-5-23-8-34-11z"/></g>
    <g class="ry-scn-plane"><path d="M0 0h46c6 0 10 3 10 5s-4 5-10 5H8l-6-2z" fill="#fff4f8"/><path d="M22 5 12 -10h6l14 15zM22 6 12 20h6l14-14z" fill="#f6c3d6"/><path d="M4 2 0 -7h4l6 9z" fill="#f08bb0"/><rect x="26" y="3" width="20" height="2" rx="1" fill="#c9a35b"/></g>
    <g class="ry-scn-chutes" fill="none" stroke="#fff" stroke-width=".6" opacity=".9"><g class="c1"><path d="M0 0a9 6 0 0 1 18 0z" fill="#ff9cc0"/><path d="M0 0l9 10M18 0l-9 10"/><circle cx="9" cy="11" r="2" fill="#fff"/></g><g class="c2"><path d="M0 0a8 5 0 0 1 16 0z" fill="#ffe4a0"/><path d="M0 0l8 9M16 0l-8 9"/><circle cx="8" cy="10" r="1.8" fill="#fff"/></g><g class="c3"><path d="M0 0a7 5 0 0 1 14 0z" fill="#d9c4ff"/><path d="M0 0l7 8M14 0l-7 8"/><circle cx="7" cy="9" r="1.6" fill="#fff"/></g></g>
  </svg>`;
  const HERO_GUN = `<svg viewBox="0 0 240 80" aria-hidden="true"><defs><linearGradient id="ryHg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6dc"/><stop offset=".5" stop-color="#f2d394"/><stop offset="1" stop-color="#c79a45"/></linearGradient><linearGradient id="ryHp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd6e6"/><stop offset="1" stop-color="#e0628a"/></linearGradient></defs>
    <path d="M6 30 L48 26 L52 50 L10 58 Q2 58 3 50z" fill="url(#ryHp)" stroke="#5a2740" stroke-width="2"/>
    <rect x="44" y="20" width="96" height="30" rx="8" fill="url(#ryHg)" stroke="#5a2740" stroke-width="2"/>
    <path d="M96 48 l14 0 l6 28 l-14 2z" fill="#4a2a3c" stroke="#2a1020" stroke-width="2"/>
    <rect x="136" y="25" width="44" height="20" rx="5" fill="#e8c983" stroke="#5a2740" stroke-width="2"/>
    <rect x="178" y="31" width="58" height="8" rx="3" fill="#3e2233" stroke="#2a1020" stroke-width="1.5"/>
    <rect x="66" y="8" width="44" height="12" rx="5" fill="#3e2233" stroke="#2a1020" stroke-width="1.5"/><circle cx="108" cy="14" r="4" fill="#8fd3ff"/>
    <rect x="54" y="32" width="70" height="6" rx="3" fill="#ff7fb3"/><circle cx="62" cy="35" r="2" fill="#fff"/><circle cx="74" cy="35" r="2" fill="#fff"/><circle cx="86" cy="35" r="2" fill="#fff"/>
    <rect x="50" y="23" width="80" height="3" rx="1.5" fill="#fff" opacity=".7"/></svg>`;
  const LEG = `<svg class="ry-leg" viewBox="0 0 220 180" aria-hidden="true"><defs><radialGradient id="ryMeat" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fff4c4"/><stop offset=".4" stop-color="#f6c254"/><stop offset=".8" stop-color="#c8862a"/><stop offset="1" stop-color="#9a5e18"/></radialGradient><linearGradient id="ryBone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e8dcc8"/></linearGradient></defs>
    <g transform="rotate(-28 110 90)"><rect x="118" y="78" width="66" height="22" rx="10" fill="url(#ryBone)" stroke="#a88a5a" stroke-width="2"/><circle cx="186" cy="80" r="14" fill="url(#ryBone)" stroke="#a88a5a" stroke-width="2"/><circle cx="186" cy="100" r="14" fill="url(#ryBone)" stroke="#a88a5a" stroke-width="2"/>
    <path d="M128 64 C 96 30 30 34 22 84 C 16 126 70 142 110 124 C 126 116 132 104 132 90z" fill="url(#ryMeat)" stroke="#8a5212" stroke-width="3"/>
    <path d="M44 66 C 56 52 78 48 92 54" stroke="#fff8dc" stroke-width="7" stroke-linecap="round" fill="none" opacity=".85"/><circle cx="40" cy="84" r="4" fill="#fff8dc" opacity=".8"/></g>
    <g fill="#fff6c8"><path d="M30 20c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z"/><path d="M196 150c.8 5 4 8 9 9-5 .8-8 4-9 9-.8-5-4-8-9-9 5-.8 8-4 9-9z"/><path d="M190 18c.6 4 3 6 7 7-4 .6-6 3-7 7-.6-4-3-6-7-7 4-.6 6-3 7-7z"/></g></svg>`;
  const BOTTLE = `<svg class="ry-bottle" viewBox="0 0 70 200" aria-hidden="true"><defs><linearGradient id="ryBt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1d3a2a"/><stop offset=".35" stop-color="#3f7a55"/><stop offset=".55" stop-color="#2a5a3e"/><stop offset="1" stop-color="#132a1d"/></linearGradient><linearGradient id="ryFoil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a5772c"/><stop offset=".5" stop-color="#fff1c9"/><stop offset="1" stop-color="#a5772c"/></linearGradient></defs>
    <path d="M26 10h18v52c0 10 16 20 16 40v86c0 6-4 10-10 10H20c-6 0-10-4-10-10v-86c0-20 16-30 16-40z" fill="url(#ryBt)" stroke="#0e1f15" stroke-width="2"/>
    <path d="M24 6h22v52c0 6-22 6-22 0z" fill="url(#ryFoil)"/><rect x="14" y="116" width="42" height="44" rx="4" fill="#fff6e6" stroke="#c9a35b" stroke-width="2"/>
    <text x="35" y="136" text-anchor="middle" font-family="Bodoni Moda, Georgia, serif" font-style="italic" font-weight="700" font-size="11" fill="#7a1f45">ERIKA</text><text x="35" y="150" text-anchor="middle" font-size="6.5" fill="#9c742f" font-family="Georgia, serif">CHAMPAGNE</text>
    <rect x="18" y="70" width="5" height="90" rx="2.5" fill="#fff" opacity=".25"/></svg>`;
  function badgeSVG(ti) {
    const T = TIERS[ti], id = 'ryBd' + ti;
    const wings = ti >= 3 ? `<path d="M18 40 C 4 36 0 24 2 14 C 8 24 14 28 22 30z M82 40 C 96 36 100 24 98 14 C 92 24 86 28 78 30z" fill="${T.c}" stroke="${T.c2}" stroke-width="1.5"/>` : '';
    const crown = ti >= 6 ? `<path d="M36 10 l4 -8 l6 6 l4 -8 l4 8 l6 -6 l4 8z" fill="#ffd36b" stroke="#9c742f" stroke-width="1.2"/>` : '';
    const stars = '★'.repeat(Math.min(3, (ti % 3) + 1));
    return `<svg class="ry-badge" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${T.c}"/><stop offset="1" stop-color="${T.c2}"/></linearGradient></defs>${wings}
      <path d="M50 12 L80 24 V52 C80 72 66 84 50 92 C34 84 20 72 20 52 V24z" fill="url(#${id})" stroke="#3b1530" stroke-width="2.5"/><path d="M50 20 L73 29 V52 C73 67 63 77 50 84 C37 77 27 67 27 52 V29z" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/>
      <path d="M50 34 c1.6 7 5.4 10.8 12.4 12.4 -7 1.6 -10.8 5.4 -12.4 12.4 -1.6 -7 -5.4 -10.8 -12.4 -12.4 7 -1.6 10.8 -5.4 12.4 -12.4z" fill="#fff" stroke="${T.c2}" stroke-width="1"/>
      <text x="50" y="76" text-anchor="middle" font-size="9" fill="#3b1530" font-family="Georgia, serif">${stars}</text>${crown}</svg>`;
  }
  const fmtClock = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // =================== 遊戲主控 ===================
  function openRoyale(api) {
    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const has = k => typeof api[k] === 'function';
    const esc = api.esc;
    const me = api.player();
    const store = () => {
      const s = api.store('royale');
      for (const [k, v] of Object.entries({ pts: 0, games: 0, wins: 0, kills: 0, top10: 0, best: 0, dmg: 0 })) if (!Number.isFinite(s[k])) s[k] = v;
      if (!Array.isArray(s.hist)) s.hist = [];
      return s;
    };
    let closed = false, raf = 0, scene = 'lobby';
    const timers = new Set(), offs = [];
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!closed) fn(); }, ms); timers.add(id); return id; };
    const listen = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); offs.push(() => el.removeEventListener(ev, fn, opt)); };
    const pending = { kit: false, aim: false };
    let m = null, H = null, phase = 'none';

    const o = api.overlay({
      id: 'royale', title: '名媛吃雞大作戰',
      beforeClose() {
        if (scene === 'match' && (phase === 'plane' || phase === 'chute' || phase === 'ground')) {
          api.modal({ title: '要離開戰場嗎？', body: '<p class="mb">現在離開視同淘汰，<br>這一局不會拿到獎勵喔。</p>', actions: [{ label: '繼續作戰', cls: 'ghost' }, { label: '離開', fn: c => { c(); o.close(); } }] });
          return false;
        }
        return true;
      },
      onClose() {
        closed = true;
        cancelAnimationFrame(raf);
        for (const t of timers) clearTimeout(t);
        for (const f of offs) f();
        if (window.__royale) delete window.__royale;
      },
    });
    const root = document.createElement('div');
    root.className = 'ry';
    o.body.appendChild(root);
    try { document.fonts && document.fonts.load('italic 700 20px "Bodoni Moda"'); } catch (e) { /* 沒有字型 API */ }

    // ---- 連動加成 ----
    function buffs() {
      const b = { lv: 1, star: 1, hpMul: 1, armorLv: 0, power: 0, helmet: 0, ring: me.color, dressName: '' };
      try { if (has('heroes')) { const h = api.heroes().find(x => x.id === 'erika'); if (h) { b.lv = h.lv || 1; b.star = h.star || 1; b.hpMul = 1 + b.lv * 0.01 + (b.star - 1) * 0.05; } } } catch (e) { /* 沒有英雄系統 */ }
      try { if (has('perk')) b.armorLv = clamp(Math.floor(+api.perk('royale_armor') || 0), 0, 3); } catch (e) { /* 沒有王國 */ }
      try {
        if (has('fashion')) {
          const f = api.fashion() || {};
          b.power = +f.power || 0; b.helmet = b.power >= 5 ? 1 : 0;
          const ITEMS = window.ERIKA_DATA && window.ERIKA_DATA.ITEMS, id = f.eq && f.eq.dress;
          const it = ITEMS && id && ITEMS.find(i => i.id === id);
          if (it && it.f) { b.ring = lum(it.f) > 0.86 ? mix(it.f, it.a || '#f3c3d2', 0.6) : it.f; b.dressName = it.name; }
        }
      } catch (e) { /* 沒有衣櫥 */ }
      return b;
    }

    // ================= 大廳 =================
    function showLobby() {
      scene = 'lobby'; phase = 'none';
      cancelAnimationFrame(raf); raf = 0;
      const s = store(), ti = tierIdx(s.pts), T = TIERS[ti], nx = TIERS[ti + 1];
      const pct = nx ? (s.pts - T.pts) / (nx.pts - T.pts) * 100 : 100;
      const bf = buffs(), unit = api.betUnit(), leaf = has('resUnit') ? Math.round(api.resUnit() * 2) : 0;
      const chips = [];
      chips.push(`<span class="ry-chip">Erika Lv.${bf.lv} ${'★'.repeat(bf.star)}・血量 <b>${Math.round(100 * bf.hpMul)}</b></span>`);
      if (bf.armorLv) chips.push(`<span class="ry-chip">王國研究・開局 Lv${bf.armorLv} 防彈衣</span>`);
      if (bf.helmet) chips.push(`<span class="ry-chip gold">時尚加成・開局 Lv1 頭盔</span>`);
      root.innerHTML = `<div class="ry-lobby">
        <div class="ry-sky">${SCENE}<i class="ry-ray"></i><i class="ry-ray r2"></i><span class="ry-glit"></span></div>
        <div class="ry-head"><div class="ry-eye">Royale Party · Season 1</div><h2 class="ry-logo"><span>名媛吃雞</span><b>大作戰</b></h2><p class="ry-tag">50 位名媛空降度假島　撿槍・縮圈・吃雞</p></div>
        <div class="ry-hero"><img class="ry-erika" src="${me.full}" alt=""><div class="ry-hgun">${HERO_GUN}</div><div class="ry-say">${pick(LINES.lobby)}</div></div>
        <div class="ry-rank">${badgeSVG(ti)}<b class="ry-rk-n">${T.name}</b><div class="ry-rk-bar"><i style="width:${pct.toFixed(1)}%"></i></div><div class="ry-rk-p num">${s.pts}${nx ? ' / ' + nx.pts : ''} 分</div>
          <dl class="ry-rk-st"><div><dt>場次</dt><dd class="num">${s.games}</dd></div><div><dt>吃雞</dt><dd class="num">${s.wins}</dd></div><div><dt>擊殺</dt><dd class="num">${s.kills}</dd></div><div><dt>前十</dt><dd class="num">${s.top10}</dd></div></dl></div>
        <div class="ry-panel">
          <div class="ry-chips">${chips.join('')}</div>
          <div class="ry-boosts">
            <button class="ry-boost" data-bo="kit"><span class="ry-bi">${SV.heal}</span><span class="ry-bt"><b>豪華裝備包</b><small>開局 Lv2 甲＋步槍</small></span><em></em></button>
            <button class="ry-boost" data-bo="aim"><span class="ry-bi">${SV.aim}</span><span class="ry-bt"><b>超級自動瞄準</b><small>全自動・命中提升</small></span><em></em></button>
          </div>
          <div class="ry-prize">吃雞獎勵　${api.icons.coin()}<b>${api.fmt(unit * 15)}</b>　${api.icons.gem()}<b>10</b>${leaf ? `　<i class="ry-leaf"></i>金箔 <b>${api.fmt(leaf)}</b>` : ''}</div>
          <button class="btn goldb ry-go"><span>開始配對</span><small>單人模式・50 位名媛</small></button>
          <div class="ry-links"><button data-l="hist">戰績紀錄</button><button data-l="help">玩法說明</button></div>
        </div>
      </div>`;
      const refresh = () => {
        root.querySelectorAll('[data-bo]').forEach(b => {
          const k = b.dataset.bo, on = pending[k];
          b.classList.toggle('on', on);
          b.querySelector('em').innerHTML = on ? '已啟用' : b.dataset.confirm ? `確認 ${api.icons.gem()}${GEM_COST[k]}` : `${api.icons.gem()}${GEM_COST[k]}`;
        });
      };
      refresh();
      root.querySelector('.ry-boosts').addEventListener('click', e => {
        const b = e.target.closest('[data-bo]'); if (!b) return;
        const k = b.dataset.bo;
        if (pending[k]) { api.toast('這局已經啟用囉'); return; }
        api.twoTap(b, () => { if (api.spendGems(GEM_COST[k])) { pending[k] = true; api.sound.buy(); api.toast(k === 'kit' ? '豪華裝備包已備妥，落地就穿上！' : '超級自動瞄準啟動！本局全自動開火', 'gold'); const r = b.getBoundingClientRect(); api.fx.burst(r.left + r.width / 2, r.top + r.height / 2, 18, ['spark', 'gem']); } refresh(); }, refresh);
      });
      root.querySelector('.ry-go').addEventListener('click', () => { api.sound.click(); startMatchmaking(); });
      root.querySelector('.ry-links').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (!b) return; api.sound.click(); b.dataset.l === 'hist' ? showHistory() : showHelp(); });
      if (!store().seenLobby) {
        store().seenLobby = 1; api.save();
        later(() => tipAt(root.querySelector('.ry-go'), '點這裡開始配對！跳傘、撿槍，活到最後就能吃雞', 'up'), 700);
      }
    }
    function showHistory() {
      const s = store();
      const rows = s.hist.length ? s.hist.map(h => `<li><b class="${h.rank === 1 ? 'win' : h.rank <= 10 ? 'top' : ''}">#${h.rank}</b><span>擊殺 ${h.kills}・傷害 ${h.dmg}</span><span>${fmtClock(h.t)}</span></li>`).join('') : '<li class="empty">還沒有戰績，快去跳傘吧！</li>';
      sheet('戰績紀錄', `<div class="ry-hist"><dl><div><dt>場次</dt><dd>${s.games}</dd></div><div><dt>吃雞</dt><dd>${s.wins}</dd></div><div><dt>總擊殺</dt><dd>${s.kills}</dd></div><div><dt>單場最多</dt><dd>${s.best}</dd></div></dl><ol>${rows}</ol></div>`);
    }
    function showHelp() {
      sheet('玩法說明', `<div class="ry-help">
        <p><b>跳傘</b>：飛機會飛過度假島，點地圖標記降落點，或按「跳傘」立刻跳。</p>
        <p><b>移動</b>：左下拖曳。<b>開火</b>：按住右下的準星，會自動瞄準最近的敵人；拖曳可以手動瞄準。</p>
        <p><b>物資</b>：走過去自動撿，滿了自動換更好的。槍的顏色代表稀有度：<i style="color:#8d8592">普通</i>・<i style="color:#2fa86a">精良</i>・<i style="color:#2f86e0">稀有</i>・<i style="color:#8a4fe0">史詩</i>・<i style="color:#c9901a">傳說</i>。</p>
        <p><b>毒圈</b>：安全區會分 6 次縮小，圈外會一直扣血，記得看小地圖往白圈裡跑。</p>
        <p><b>空投</b>：粉紅煙霧的箱子裡有最強的傳說武器和 Lv3 裝備。</p>
        <p><b>粉鑽</b>：豪華裝備包、超級自動瞄準、呼叫空投、原地復活，幫妳省腦力。</p></div>`);
    }
    function sheet(title, html) {
      const el = document.createElement('div');
      el.className = 'ry-sheet';
      el.innerHTML = `<div class="ry-sh-card" role="dialog" aria-label="${title}"><button class="ry-sh-x" aria-label="關閉">${api.icons.line('close')}</button><h3>${title}</h3>${html}<button class="btn goldb ry-sh-ok">我知道了</button></div>`;
      root.appendChild(el);
      const t0 = performance.now();
      el.addEventListener('click', e => {
        if (performance.now() - t0 < 300) return;
        if (e.target === el || e.target.closest('.ry-sh-x, .ry-sh-ok')) { api.sound.click(); el.classList.add('out'); later(() => el.remove(), 220); }
      });
    }
    function tipAt(el, text, dir = 'up', host = root) {
      if (!el || closed) return null;
      const t = document.createElement('div');
      t.className = 'ry-tip ' + dir;
      t.innerHTML = `${text}<small>點一下關閉</small>`;
      host.appendChild(t);
      const r = el.getBoundingClientRect(), hr = host.getBoundingClientRect();
      const cx = clamp(r.left + r.width / 2 - hr.left, 110, hr.width - 110);
      t.style.left = cx + 'px';
      t.style.setProperty('--ax', (r.left + r.width / 2 - hr.left - cx) + 'px');
      if (dir === 'up') t.style.bottom = (hr.bottom - r.top + 12) + 'px'; else t.style.top = (r.bottom - hr.top + 12) + 'px';
      const kill = () => { t.classList.add('out'); later(() => t.remove(), 260); };
      t.addEventListener('pointerdown', e => { e.stopPropagation(); kill(); });
      later(kill, 5200);
      return t;
    }

    // ================= 配對 =================
    let mmBusy = false;
    function startMatchmaking() {
      if (mmBusy) return;
      mmBusy = true; scene = 'mm';
      const n = 50, seed = (Math.random() * 1e9) >>> 0;
      const s = store(), diff = clamp(tierIdx(s.pts) / (TIERS.length - 1) * 0.85 + 0.05, 0, 1);
      const bf = buffs();
      const opts = { n, seed, diff, human: true, humanName: me.name, superAim: pending.aim, kit: pending.kit, hpMul: bf.hpMul, armorLv: bf.armorLv, helmetLv: bf.helmet };
      const mmEl = document.createElement('div');
      mmEl.className = 'ry-mm';
      mmEl.innerHTML = `<div class="ry-mm-bg"></div><div class="ry-radar"><i class="ry-sweep"></i><i class="ry-ring r1"></i><i class="ry-ring r2"></i><img class="ry-mm-me" src="${me.face('joy')}" alt=""></div>
        <div class="ry-mm-t"><b>配對中</b><span class="ry-mm-n num">1 / ${n}</span></div><div class="ry-mm-say"></div><div class="ry-mm-grid"></div><div class="ry-mm-tip">小提醒：降落時按住左下搖桿可以控制方向</div>`;
      root.appendChild(mmEl);
      requestAnimationFrame(() => mmEl.classList.add('in'));
      api.sound.drum();
      // 預先建立對局與圖片（配對動畫期間完成）
      let ready = null;
      const prep = (async () => {
        const match = createMatch(opts);
        const looks = [...new Set(match.players.map(p => p.look))];
        await Promise.all([...looks.map(l => faceCv(api, l, 'neutral')), loadImg(me.full)]);
        ready = match;
      })();
      const grid = mmEl.querySelector('.ry-mm-grid'), cnt = mmEl.querySelector('.ry-mm-n'), say = mmEl.querySelector('.ry-mm-say');
      let found = 1;
      const tick = () => {
        if (closed) return;
        found = Math.min(n, found + 2 + Math.floor(Math.random() * 4));
        cnt.textContent = `${found} / ${n}`;
        if (grid.children.length < 15) {
          const look = Math.floor(Math.random() * 30);
          faceURL(api, look, Math.random() < 0.5 ? 'joy' : 'neutral').then(u => { if (closed) return; const i = document.createElement('img'); i.src = u; i.alt = ''; grid.appendChild(i); });
          api.sound.beep(900 + found * 8, 0.05, 'triangle', 0.035);
        }
        if (found % 9 < 3) say.innerHTML = `<b>${NAMES[Math.floor(Math.random() * NAMES.length)]}</b>「${pick(LINES.mm)}」`;
        if (found < n) later(tick, 110 + Math.random() * 90);
        else prep.then(() => later(done, 350));
      };
      later(tick, 400);
      const done = () => {
        mmEl.classList.add('ok');
        mmEl.querySelector('.ry-mm-t b').textContent = '配對成功！';
        api.sound.ding(); api.vib(15);
        later(() => { pendingKitUsed = opts.kit; pending.kit = false; pending.aim = false; mmBusy = false; startMatch(ready); mmEl.classList.add('out'); later(() => mmEl.remove(), 600); }, 900);
      };
    }

    // ================= 對局 =================
    let cv, ctx, game, hud, cssW = 390, cssH = 700, baseZ = 0.72, planeZ = 0.11, sprScale = 1.6;
    const cam = { x: CX, y: CY, z: 0.11, shake: 0, jx: CX, jy: CY };
    let chunks = new Map(), ovCv = null, frameNo = 0, want = [];
    let SPR = {};
    let input = { mx: 0, my: 0, fire: false, manual: false, aim: 0, key: { x: 0, y: 0 } };
    let sticks = { move: null, fire: null };
    let autoAimOn = true, mark = null, timeScale = 1, paused = false, revived = false, dropUsed = false;
    let parts = [], texts = [], ghosts = [], dying = [], feedList = [], hitInd = [];
    let lastT = 0, hudAcc = 0, miniAcc = 0, smokeAcc = 0, killStreak = 0, streakT = 0, tutStep = 0, endShown = false;
    let SPARK = null;

    function startMatch(match) {
      m = match; H = m.human; phase = 'plane'; scene = 'match';
      timeScale = 1; paused = false; revived = false; dropUsed = false; mark = null; endShown = false;
      parts = []; texts = []; ghosts = []; dying = []; feedList = []; hitInd = []; killStreak = 0;
      input = { mx: 0, my: 0, fire: false, manual: false, aim: 0, key: { x: 0, y: 0 } };
      sticks = { move: null, fire: null };
      root.innerHTML = gameHTML();
      game = root.querySelector('.ry-game'); hud = game.querySelector('.ry-hud');
      cv = game.querySelector('.ry-cv'); ctx = cv.getContext('2d');
      bindGame();
      resize(true);
      if (!ovCv) ovCv = makeOverview();
      if (!SPARK) { SPARK = []; const r = makeRng(99); for (let k = 0; k < 420; k++) { const a = r() * TAU, d = ISL(a) + r.range(30, 420); SPARK.push([CX + Math.cos(a) * d, CY + Math.sin(a) * d, r() * TAU]); } }
      cam.x = CX; cam.y = CY + 70 / planeZ; cam.z = planeZ;
      for (const p of m.players) p._tok = null;
      game.classList.add('plane');
      setText('.ry-pl-n', m.players.filter(p => p.state === 'plane').length);
      showMsg('飛機即將飛越度假島　點地圖選擇降落點', 3200);
      lastT = performance.now();
      if (api.sandbox) exposeDebug();
      api.sound.hiss(1.4, 0.04, 400);
      loop();
    }
    function gameHTML() {
      return `<div class="ry-game">
        <canvas class="ry-cv"></canvas>
        <div class="ry-vig ry-vz"></div><div class="ry-vig ry-vh"></div><div class="ry-vig ry-vd"></div>
        <div class="ry-hud">
          <div class="ry-tl"><button class="ry-mini" aria-label="大地圖"><canvas></canvas></button><div class="ry-zone"><i></i><span>安全區</span></div>
            <div class="ry-gbs"><button class="ry-gb" data-g="drop">${SV.drop}<span>呼叫空投</span><em>${api.icons.gem()}${GEM_COST.drop}</em></button><button class="ry-gb" data-g="aim">${SV.aim}<span>超級瞄準</span><em>${api.icons.gem()}${GEM_COST.aim}</em></button></div></div>
          <div class="ry-tr"><div class="ry-cnt"><span><b class="ry-alive num">50</b><small>存活</small></span><span><b class="ry-kc num">0</b><small>擊殺</small></span></div><div class="ry-feed"></div></div>
          <div class="ry-msg"></div>
          <div class="ry-kb"></div>
          <div class="ry-pick"></div>
          <div class="ry-bottom">
            <div class="ry-hpw"><span class="ry-gear ga" title="防彈衣"></span><div class="ry-hp"><i class="ry-hpd"></i><i class="ry-hpf"></i><em class="ry-bst"></em><b class="ry-hpt num">100</b></div><span class="ry-gear gh" title="頭盔"></span></div>
            <div class="ry-weap"><button class="ry-ws" data-s="0"></button><button class="ry-ws" data-s="1"></button></div>
          </div>
          <button class="ry-btn ry-reload" aria-label="換彈">${SV.reload}<i class="ry-rl"></i></button>
          <button class="ry-btn ry-heal" data-h="auto" aria-label="補血">${SV.heal}<b class="num">0</b></button>
          <button class="ry-btn ry-drink" data-h="drink" aria-label="能量飲料">${SV.drink}<b class="num">0</b></button>
          <button class="ry-auto on" aria-label="自動瞄準開關">${SV.aim}<span>自動瞄準</span></button>
          <div class="ry-fire"><span class="ry-fb">${SV.fire}</span><i class="ry-fk"></i></div>
          <div class="ry-stick"><i class="ry-sk"></i></div>
          <div class="ry-healing"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/><circle class="p" cx="20" cy="20" r="17"/></svg><span>補血中</span></div>
          <div class="ry-plane"><div class="ry-pl-top">${SV.plane}<span>飛機上 <b class="ry-pl-n num">50</b> 人</span><span class="ry-pl-t">點地圖標記降落點</span></div><button class="btn goldb ry-jump"><span>跳傘</span><small>現在就跳</small></button></div>
        </div>
        <div class="ry-bigmap" hidden><canvas></canvas><p>點一下關閉</p></div>
        <div class="ry-death" hidden></div>
      </div>`;
    }
    const $q = s => game.querySelector(s);
    const txtCache = new Map();
    function setText(sel, v) { const el = typeof sel === 'string' ? $q(sel) : sel; if (!el) return; const s = String(v); if (txtCache.get(el) !== s) { txtCache.set(el, s); el.textContent = s; } }
    function setHTML(el, h) { if (!el) return; if (txtCache.get(el) !== h) { txtCache.set(el, h); el.innerHTML = h; } }

    function resize(force) {
      const r = game.getBoundingClientRect();
      const w = Math.max(200, r.width), h = Math.max(300, r.height);
      if (!force && w === cssW && h === cssH) return;
      cssW = w; cssH = h;
      cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      baseZ = clamp(w / 540, 0.62, 1.05);
      planeZ = Math.min(w / 3060, (h - 250) / 3060);
      const ns = Math.round(baseZ * DPR * 1.25 * 100) / 100;
      if (ns !== sprScale || force) { sprScale = ns; SPR = {}; if (m) for (const p of m.players) p._tok = null; }
      const cs = baseZ * DPR;
      if (!chunks.cs || Math.abs(chunks.cs - cs) > 0.01) { chunks = new Map(); chunks.cs = cs; }
      const mc = $q('.ry-mini canvas'); mc.width = mc.height = Math.round(96 * DPR);
    }
    function makeOverview() {
      const S = 900, k = S / MAP, c = mkCv(S, S), x = c.getContext('2d');
      x.setTransform(k, 0, 0, k, 0, 0);
      const M = getMap();
      drawWorld(x, M, { x0: 0, y0: 0, x1: MAP, y1: MAP }, 0);
      for (const b of M.bld) { x.fillStyle = b.gazebo ? '#ffffff' : b.roof; rr(x, b.x - 3, b.y - 3, b.w + 6, b.h + 6, 6); x.fill(); x.strokeStyle = b.gold || b.big ? '#c9a35b' : 'rgba(60,20,45,.35)'; x.lineWidth = 5; x.stroke(); }
      for (const t of M.trees) { x.fillStyle = t.palm ? '#4fa565' : t.v === 2 ? '#f2a7c1' : '#6fbf73'; x.beginPath(); x.arc(t.x, t.y, 30 * t.s, 0, TAU); x.fill(); }
      return c;
    }
    // ---- 圖片快取 ----
    function tokOf(p) {
      if (p._tok) return p._tok;
      const key = 'tok' + p.look;
      if (!SPR[key]) {
        SPR[key] = null;
        const ring = p.human ? buffs().ring : hueHex(api.cast()[lookOf(p.look).ci].color, lookOf(p.look).hue);
        faceCv(api, p.look, 'neutral').then(f => { SPR[key] = tokenCv(f, ring, sprScale, p.human); });
      }
      if (SPR[key]) p._tok = SPR[key];
      return SPR[key];
    }
    const sprOf = (key, make) => SPR[key] || (SPR[key] = make());
    const gunSpr = (w, r, hands = true) => sprOf(`g${w}${r}${hands ? 1 : 0}`, () => gunCv(w, r, sprScale, hands));
    const itemSpr = it => sprOf(it.k === 'gun' ? `i${it.w}${it.r}` : it.k === 'heal' ? 'i' + it.t : 'i' + it.k + it.lv, () => itemCv(it, sprScale));
    const boxSpr = k => sprOf('b' + k, () => boxCv(k, sprScale));
    const treeSpr = t => sprOf(`t${t.palm ? 1 : 0}${t.v}`, () => treeCv(t.palm, t.v, sprScale));
    const glowSpr = c => sprOf('gl' + c, () => glowCv(c, sprScale * 0.6));
    const roofSpr = b => sprOf('r' + b.i, () => roofCv(b, sprScale * 0.8));
    const iconURL = (key, draw) => sprOf('u' + key, () => { const c = mkCv(56, 56), x = c.getContext('2d'); x.translate(28, 28); draw(x); return c.toDataURL(); });

    // ---- 地圖分塊 ----
    function getChunk(i, j) {
      const k = i * 64 + j, c = chunks.get(k);
      if (c) { c.t = frameNo; return c.cv; }
      return null;
    }
    function buildChunks(maxN) {
      if (!want.length) return;
      want.sort((a, b) => a[2] - b[2]);
      const done = new Set();
      for (const [i, j] of want) {
        const k = i * 64 + j;
        if (done.has(k) || chunks.has(k)) continue;
        if (maxN-- <= 0) break;
        done.add(k);
        const s = chunks.cs, c = mkCv(CH * s, CH * s), x = c.getContext('2d');
        x.setTransform(s, 0, 0, s, -i * CH * s, -j * CH * s);
        drawWorld(x, getMap(), { x0: i * CH, y0: j * CH, x1: (i + 1) * CH, y1: (j + 1) * CH }, 1);
        chunks.set(k, { cv: c, t: frameNo });
      }
      want.length = 0;
      if (chunks.size > 44) { const arr = [...chunks.entries()].sort((a, b) => a[1].t - b[1].t); for (let k = 0; k < arr.length - 40; k++) chunks.delete(arr[k][0]); }
    }
    function prewarm(x, y, r) {
      for (let j = Math.floor((y - r) / CH); j <= Math.floor((y + r) / CH); j++) for (let i = Math.floor((x - r) / CH); i <= Math.floor((x + r) / CH); i++) {
        if (i < 0 || j < 0 || i * CH >= MAP || j * CH >= MAP) continue;
        want.push([i, j, Math.hypot((i + 0.5) * CH - x, (j + 0.5) * CH - y)]);
      }
    }

    // ---- 輸入 ----
    function bindGame() {
      const stickEl = $q('.ry-stick'), fireEl = $q('.ry-fire');
      const local = e => { const r = game.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      listen(game, 'pointerdown', e => {
        if (e.target.closest('button, .ry-tip, .ry-death, .ry-bigmap') || e.button > 0) return;
        e.preventDefault();
        const [x, y] = local(e);
        if (phase === 'plane') { setMark(x, y); return; }
        if (phase !== 'ground' && phase !== 'chute') return;
        if (x < cssW * 0.5 && y > cssH * 0.3) {
          if (sticks.move) return;
          sticks.move = { id: e.pointerId, x0: x, y0: y };
          stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; stickEl.classList.add('on');
          setKnob(stickEl.firstElementChild, 0, 0);
        } else if (x >= cssW * 0.5 && y > cssH * 0.34 && phase === 'ground') {
          if (sticks.fire) return;
          sticks.fire = { id: e.pointerId, x0: x, y0: y };
          input.fire = true; input.manual = false;
          fireEl.classList.add('on');
          const fr = fireEl.getBoundingClientRect(), gr = game.getBoundingClientRect();
          fireEl._cx = fr.left - gr.left + fr.width / 2; fireEl._cy = fr.top - gr.top + fr.height / 2;
        }
        try { game.setPointerCapture(e.pointerId); } catch (er) { /* 舊瀏覽器 */ }
      });
      listen(game, 'pointermove', e => {
        const [x, y] = local(e);
        const mv = sticks.move, fs = sticks.fire;
        if (mv && mv.id === e.pointerId) {
          let dx = x - mv.x0, dy = y - mv.y0; const d = Math.hypot(dx, dy), R = 52;
          if (d > R) { dx = dx / d * R; dy = dy / d * R; }
          input.mx = dx / R; input.my = dy / R;
          if (d < 6) { input.mx = input.my = 0; }
          setKnob(stickEl.firstElementChild, dx, dy);
        }
        if (fs && fs.id === e.pointerId) {
          const dx = x - fs.x0, dy = y - fs.y0, d = Math.hypot(dx, dy);
          if (d > 14) { input.manual = true; input.aim = Math.atan2(dy, dx); const k = Math.min(1, d / 50); setKnob(fireEl.querySelector('.ry-fk'), dx / d * 34 * k, dy / d * 34 * k); }
        }
      });
      const up = e => {
        if (sticks.move && sticks.move.id === e.pointerId) { sticks.move = null; input.mx = input.my = 0; stickEl.classList.remove('on'); stickEl.style.left = ''; stickEl.style.top = ''; setKnob(stickEl.firstElementChild, 0, 0); }
        if (sticks.fire && sticks.fire.id === e.pointerId) { sticks.fire = null; input.fire = false; input.manual = false; fireEl.classList.remove('on'); setKnob(fireEl.querySelector('.ry-fk'), 0, 0); }
      };
      listen(game, 'pointerup', up); listen(game, 'pointercancel', up);
      listen(game, 'contextmenu', e => e.preventDefault());
      // 按鈕
      $q('.ry-jump').addEventListener('click', () => { if (phase !== 'plane') return; if (m.plane.u < m.plane.span[0] - 0.02) { api.toast('飛機還沒飛到島上喔'); api.sound.err(); return; } H.input.jump = true; api.sound.click(); });
      $q('.ry-reload').addEventListener('click', () => { if (phase === 'ground') { H.input.reload = true; } });
      game.querySelectorAll('[data-h]').forEach(b => b.addEventListener('click', () => {
        if (phase !== 'ground') return;
        if (H.heal) { api.toast('正在補給中…'); return; }
        const k = b.dataset.h;
        if (k === 'drink' ? H.heals.drink <= 0 : H.heals.bandage + H.heals.medkit <= 0) { api.shake(b); api.sound.err(); api.toast(k === 'drink' ? '沒有能量飲料了' : '沒有繃帶或急救包，去撿一些吧'); return; }
        if (!startHealCheck(k)) { api.toast(k === 'drink' ? '能量已經滿了' : '血量已經很健康了'); return; }
        H.input.heal = k;
      }));
      $q('.ry-auto').addEventListener('click', e => { autoAimOn = !autoAimOn; e.currentTarget.classList.toggle('on', autoAimOn); api.sound.click(); api.toast(autoAimOn ? '自動瞄準：按住開火會鎖定最近的敵人' : '自動瞄準關閉：拖曳開火鍵手動瞄準'); });
      $q('.ry-weap').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b || phase !== 'ground') return; if (+b.dataset.s !== H.cur && H.guns[+b.dataset.s]) { H.input.sw = true; api.sound.beep(700, 0.05, 'triangle', 0.05); } });
      $q('.ry-gbs').addEventListener('click', e => {
        const b = e.target.closest('[data-g]'); if (!b) return;
        const k = b.dataset.g;
        if (phase !== 'ground') { api.toast('落地之後才能使用'); return; }
        if (k === 'drop' && dropUsed) { api.toast('這局已經呼叫過空投了'); return; }
        if (k === 'aim' && m.superAim) { api.toast('超級自動瞄準已經啟動'); return; }
        api.twoTap(b, () => {
          if (!api.spendGems(GEM_COST[k])) return;
          api.sound.buy();
          if (k === 'drop') { dropUsed = true; callDrop(m, H); showMsg('專屬空投正在降落！就在妳身邊', 2600, 'gold'); }
          else { m.superAim = true; showMsg('超級自動瞄準啟動！看到敵人就自動開火', 2600, 'gold'); }
          refreshGemBtns();
        }, refreshGemBtns);
      });
      $q('.ry-mini').addEventListener('click', () => { if (phase === 'ground' || phase === 'chute') openBigMap(); });
      $q('.ry-bigmap').addEventListener('click', () => { $q('.ry-bigmap').hidden = true; api.sound.click(); });
      listen(window, 'resize', () => resize(false));
      listen(document, 'visibilitychange', () => { if (!document.hidden && scene === 'match') { lastT = performance.now(); loop(); } });
      const KEYS = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
      const held = new Set();
      const keyVec = () => { let x = 0, y = 0; for (const k of held) { x += KEYS[k][0]; y += KEYS[k][1]; } const l = Math.hypot(x, y) || 1; input.key = { x: x / l, y: y / l }; };
      listen(window, 'keydown', e => {
        if (scene !== 'match') return;
        if (KEYS[e.code]) { held.add(e.code); keyVec(); e.preventDefault(); }
        else if (e.code === 'Space') { input.fire = true; e.preventDefault(); }
        else if (e.code === 'KeyR' && phase === 'ground') H.input.reload = true;
        else if (e.code === 'KeyQ' && phase === 'ground') H.input.sw = true;
        else if (e.code === 'KeyH' && phase === 'ground') H.input.heal = 'auto';
        else if (e.code === 'KeyF' && phase === 'plane') $q('.ry-jump').click();
      });
      listen(window, 'keyup', e => { if (KEYS[e.code]) { held.delete(e.code); keyVec(); } else if (e.code === 'Space' && !sticks.fire) input.fire = false; });
      refreshGemBtns();
    }
    function startHealCheck(k) {
      const mh = H.maxHp;
      if (k === 'drink') return H.boost < 90;
      return (H.heals.bandage > 0 && H.hp < mh * 0.75) || (H.heals.medkit > 0 && H.hp < mh);
    }
    function refreshGemBtns() {
      if (!game) return;
      game.querySelectorAll('[data-g]').forEach(b => {
        const k = b.dataset.g, used = k === 'drop' ? dropUsed : m && m.superAim;
        b.classList.toggle('used', !!used);
        b.querySelector('em').innerHTML = used ? (k === 'drop' ? '已呼叫' : '啟動中') : b.dataset.confirm ? `確認 ${api.icons.gem()}${GEM_COST[k]}` : `${api.icons.gem()}${GEM_COST[k]}`;
      });
    }
    const setKnob = (el, x, y) => { el.style.transform = `translate(${x}px, ${y}px)`; };
    function setMark(sx, sy) {
      const z = cam.z;
      const wx = cam.x + (sx - cssW / 2) / z, wy = cam.y + (sy - cssH / 2) / z;
      if (!inIsland(wx, wy)) { api.toast('請標記在島上'); return; }
      mark = { x: wx, y: wy };
      H.tx = wx; H.ty = wy;
      api.sound.beep(1300, 0.06, 'triangle', 0.06);
      const near = getMap().labels.reduce((b, l) => { const d = Math.hypot(l[1] - wx, l[2] - wy); return d < b[0] ? [d, l[0]] : b; }, [1e9, '']);
      setText('.ry-pl-t', near[0] < 400 ? `降落點：${near[1]}附近` : '已標記降落點');
      prewarm(wx, wy, 700);
    }
    function openBigMap() {
      const bm = $q('.ry-bigmap'); bm.hidden = false; api.sound.click();
      const c = bm.querySelector('canvas'), S = Math.min(cssW - 24, cssH - 120);
      c.width = c.height = Math.round(S * DPR); c.style.width = c.style.height = S + 'px';
      const x = c.getContext('2d'), k = c.width / MAP;
      x.drawImage(ovCv, 0, 0, c.width, c.height);
      drawMapMarks(x, k, 0, 0, true);
    }
    function drawMapMarks(x, k, ox, oy, labels) {
      const z = m.zone, P = (wx, wy) => [(wx - ox) * k, (wy - oy) * k];
      x.save();
      x.fillStyle = 'rgba(120,50,190,.32)'; x.beginPath(); x.rect(-10, -10, x.canvas.width + 20, x.canvas.height + 20); const [zx, zy] = P(z.x, z.y); x.arc(zx, zy, z.r * k, 0, TAU, true); x.fill();
      x.strokeStyle = '#d9a6ff'; x.lineWidth = 2 * DPR; x.beginPath(); x.arc(zx, zy, z.r * k, 0, TAU); x.stroke();
      if (z.st !== 'end') { const [bx, by] = P(z.bx, z.by); x.strokeStyle = '#fff'; x.lineWidth = 1.6 * DPR; x.setLineDash([5 * DPR, 4 * DPR]); x.beginPath(); x.arc(bx, by, z.br * k, 0, TAU); x.stroke(); x.setLineDash([]); if (!insideZone({ x: z.bx, y: z.by, r: z.br }, H.x, H.y) && H.alive) { const [hx, hy] = P(H.x, H.y); x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 1.4 * DPR; x.setLineDash([3 * DPR, 3 * DPR]); x.beginPath(); x.moveTo(hx, hy); x.lineTo(bx, by); x.stroke(); x.setLineDash([]); } }
      if (labels) { x.font = `700 ${10 * DPR}px "Noto Serif TC", serif`; x.textAlign = 'center'; x.lineJoin = 'round'; for (const [n, lx, ly, big] of getMap().labels) { const [px, py] = P(lx, ly); x.lineWidth = 3 * DPR; x.strokeStyle = 'rgba(59,21,48,.8)'; x.strokeText(n, px, py); x.fillStyle = big ? '#ffe9a8' : '#fff'; x.fillText(n, px, py); } }
      for (const b of m.boxes) if (b.kind === 'drop' && b.items.length) { const [px, py] = P(b.x, b.y); x.fillStyle = '#ff5f9a'; x.beginPath(); x.arc(px, py, 4 * DPR, 0, TAU); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 1.5 * DPR; x.stroke(); }
      if (!m.plane.gone) { const [a, b] = P(m.plane.x0, m.plane.y0), [c, d] = P(m.plane.x1, m.plane.y1); x.strokeStyle = 'rgba(255,255,255,.5)'; x.setLineDash([4 * DPR, 4 * DPR]); x.lineWidth = DPR; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); x.setLineDash([]); }
      if (H.alive) { const [hx, hy] = P(H.x, H.y); x.translate(hx, hy); x.rotate(H.aim); x.fillStyle = '#ffd36b'; x.strokeStyle = '#7a1f45'; x.lineWidth = 1.4 * DPR; x.beginPath(); x.moveTo(7 * DPR, 0); x.lineTo(-5 * DPR, -5 * DPR); x.lineTo(-2 * DPR, 0); x.lineTo(-5 * DPR, 5 * DPR); x.closePath(); x.fill(); x.stroke(); }
      x.restore();
    }

    // ---- 主迴圈 ----
    function loop() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
    function frame(ts) {
      raf = 0;
      if (closed || scene !== 'match') return;
      const dt = Math.min(0.1, Math.max(0, (ts - lastT) / 1000)); lastT = ts;
      frameNo++;
      if (!paused) {
        let rem = dt * timeScale;
        while (rem > 1e-5) {
          const d = Math.min(1 / 30, rem); rem -= d;
          feedInput();
          stepMatch(m, d);
          handleEvents();
          if (phase === 'plane') autoJump();
          if (paused) break;
        }
      }
      updateFx(dt);
      updateCam(dt);
      render(ts / 1000);
      updateHud(dt);
      buildChunks(phase === 'ground' ? 2 : 3);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    }
    function feedInput() {
      const hi = H.input;
      let mx = input.mx + input.key.x, my = input.my + input.key.y;
      const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
      hi.mx = mx; hi.my = my;
      hi.fire = input.fire; hi.manual = input.manual;
      hi.aim = input.manual ? input.aim : H.aim;
      m.autoAim = autoAimOn;
    }
    function autoJump() {
      if (H.state !== 'plane' || !mark) return;
      if (m.plane.u >= closestU(m.plane, mark.x, mark.y) - 0.01 && m.plane.u >= m.plane.span[0]) H.input.jump = true;
    }
    function updateCam(dt) {
      let tx, ty, tz, k = Math.min(1, dt * 5);
      if (phase === 'plane') { tx = CX; ty = CY + 70 / planeZ; tz = planeZ; }
      else if (phase === 'chute' && H.chute) {
        const c = clamp(H.chute.t / CHUTE_T, 0, 1), e = 1 - Math.pow(1 - c, 2.2);
        tz = planeZ * Math.pow(baseZ / planeZ, e);
        const f = clamp(c * 1.6, 0, 1);
        tx = lerp(cam.jx, H.x, f); ty = lerp(cam.jy, H.y, f); k = 1;
        cam.z = tz;
      } else {
        const g = curGun(H), snip = g && (g.w === 'sniper' || g.w === 'queen');
        tz = baseZ * (snip ? 0.82 : 1);
        const firing = H.wantFire || input.fire;
        const lead = firing ? 46 : 18;
        tx = H.x + Math.cos(H.aim) * lead; ty = H.y + Math.sin(H.aim) * lead + 40 / Math.max(0.3, cam.z) * 0.35;
      }
      cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (tz - cam.z) * Math.min(1, dt * 3);
      const hw = cssW / 2 / cam.z, hh = cssH / 2 / cam.z;
      if (hw * 2 < MAP) cam.x = clamp(cam.x, hw, MAP - hw); else cam.x = CX;
      if (phase !== 'plane') { if (hh * 2 < MAP) cam.y = clamp(cam.y, hh, MAP - hh); else cam.y = CY; }
      cam.shake = Math.max(0, cam.shake - dt * 30);
    }

    // ---- 事件 → 特效、聲音、提示 ----
    let sndAt = 0;
    function shotSound(w, d, mine) {
      const v = mine ? 1 : clamp(1 - d / 950, 0, 1) * 0.75;
      if (v < 0.06) return;
      const now = performance.now();
      if (!mine && now - sndAt < 75) return;
      if (mine && now - sndAt < 40) return;
      sndAt = now;
      const S = api.sound, k = WEAPONS[w].snd;
      if (k === 0) { S.hiss(0.05, 0.05 * v, 2400); S.beep(190, 0.05, 'square', 0.022 * v); }
      else if (k === 1) { S.hiss(0.07, 0.07 * v, 1500); S.beep(125, 0.07, 'square', 0.03 * v); }
      else if (k === 2) { S.hiss(0.16, 0.09 * v, 700); S.beep(80, 0.13, 'sawtooth', 0.04 * v); }
      else { S.hiss(0.22, 0.1 * v, 500); S.beep(58, 0.22, 'sawtooth', 0.05 * v); S.beep(980, 0.05, 'triangle', 0.025 * v, 0.03); }
    }
    const onScreen = (x, y, m2 = 60) => { const hw = cssW / 2 / cam.z + m2, hh = cssH / 2 / cam.z + m2; return Math.abs(x - cam.x) < hw && Math.abs(y - cam.y) < hh; };
    const P_COL = ['#fff6c8', '#ffd36b', '#ff9cc0', '#ffffff', '#c9b8f2'];
    function addPart(p) { if (parts.length > (REDUCED ? 120 : 420)) parts.shift(); parts.push(p); }
    function burstStars(x, y, n, spd = 160, cols = P_COL, life = 0.7) {
      if (REDUCED) n = Math.ceil(n / 3);
      for (let k = 0; k < n; k++) { const a = Math.random() * TAU, s = spd * (0.35 + Math.random()); addPart({ k: 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: life * (0.6 + Math.random() * 0.6), s: 3 + Math.random() * 4, c: cols[k % cols.length] }); }
    }
    function puff(x, y, n, col = '#ffffff', spd = 60, size = 14) {
      for (let k = 0; k < n; k++) { const a = Math.random() * TAU, s = spd * Math.random(); addPart({ k: 'puff', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.7 + Math.random() * 0.6, s: size * (0.6 + Math.random() * 0.8), c: col }); }
    }
    function dmgText(x, y, v, head, mine) {
      if (texts.length > 24) texts.shift();
      texts.push({ x: x + (Math.random() - 0.5) * 16, y: y - 18, vy: -60, t: 0, life: head ? 1.1 : 0.8, v: Math.round(v), head, mine });
    }
    function handleEvents() {
      for (const e of m.ev) {
        switch (e.e) {
          case 'shot': {
            const p = m.players[e.p];
            p._kick = 1; p._flashT = 0.06;
            if (onScreen(e.x, e.y)) {
              const W = WEAPONS[e.w], mz = VR + (W.pel > 1 ? 24 : 26);
              const mx = e.x + Math.cos(e.a) * mz, my = e.y + Math.sin(e.a) * mz;
              addPart({ k: 'flash', x: mx, y: my, t: 0, life: 0.06, s: W.pel > 1 || W.snd === 3 ? 22 : 15, a: e.a });
              if (!REDUCED) addPart({ k: 'shell', x: e.x + Math.cos(e.a + 1.6) * 8, y: e.y + Math.sin(e.a + 1.6) * 8, vx: Math.cos(e.a + 1.9) * 90 + (Math.random() - 0.5) * 30, vy: Math.sin(e.a + 1.9) * 90 + (Math.random() - 0.5) * 30, t: 0, life: 0.5, s: 3, r: Math.random() * 6, vr: 18 });
            }
            shotSound(e.w, Math.hypot(e.x - H.x, e.y - H.y), p === H);
            if (p === H) { cam.shake = Math.max(cam.shake, WEAPONS[e.w].snd === 3 ? 6 : WEAPONS[e.w].snd === 2 ? 5 : 1.4); }
            break;
          }
          case 'hit': {
            const dst = m.players[e.dst];
            if (e.src === H.id) {
              dmgText(e.x, e.y, e.dmg, e.head, true);
              dst._hitByMe = m.t;
              if (e.head) { api.sound.beep(2300, 0.06, 'triangle', 0.07); api.sound.beep(3000, 0.05, 'sine', 0.05, 0.03); } else api.sound.beep(1650, 0.035, 'triangle', 0.045);
              H._hitMark = 0.18; H._hitHead = e.head;
            }
            if (dst === H) {
              cam.shake = Math.max(cam.shake, 5); api.vib(12);
              hitInd.push({ a: H.hitA, t: 0 }); if (hitInd.length > 6) hitInd.shift();
              api.sound.beep(240, 0.07, 'sine', 0.06);
              const vh = $q('.ry-vh'); vh.classList.remove('go'); void vh.offsetWidth; vh.classList.add('go');
            }
            if (onScreen(e.x, e.y)) burstStars(e.x, e.y, e.head ? 10 : 5, e.head ? 200 : 140, e.head ? ['#ffd36b', '#fff6c8', '#ffffff'] : P_COL, 0.55);
            break;
          }
          case 'wall': if (onScreen(e.x, e.y) && !REDUCED) { for (let k = 0; k < 3; k++) { const a = Math.atan2(-e.dy, -e.dx) + (Math.random() - 0.5) * 1.6, s = 80 + Math.random() * 120; addPart({ k: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.22, s: 1.4 }); } puff(e.x, e.y, 1, '#f5ebe6', 20, 8); } break;
          case 'bend': { const b = e.b; if (onScreen(b.x, b.y, 200)) ghosts.push({ x1: b.x, y1: b.y, dx: b.dx, dy: b.dy, len: Math.min(b.d, 90), t: 0, mine: b.human }); break; }
          case 'kill': onKill(e); break;
          case 'pick': if (e.p === H.id) onPick(e.list); break;
          case 'reload': if (e.p === H.id) { api.sound.beep(520, 0.04, 'square', 0.03); api.sound.beep(820, 0.04, 'square', 0.03, 0.22); } break;
          case 'reloaded': if (e.p === H.id) api.sound.beep(1100, 0.05, 'triangle', 0.05); break;
          case 'healStart': if (e.p === H.id) api.sound.beep(880, 0.08, 'sine', 0.05); break;
          case 'healed': if (e.p === H.id) { api.sound.ding(); burstStars(H.x, H.y, 10, 90, ['#9ff0c2', '#ffffff', '#ff9cc0'], 0.8); } break;
          case 'healCancel': if (e.p === H.id) api.toast('開火會中斷補給'); break;
          case 'zone': onZone(e); break;
          case 'drop': showMsg(e.owner === H.id ? '專屬空投正在降落！' : '空投物資正在降落！看小地圖上的粉紅點', 3000, 'gold'); api.sound.beep(660, 0.25, 'triangle', 0.05); api.sound.beep(990, 0.3, 'triangle', 0.05, 0.25); break;
          case 'dropLand': if (onScreen(e.x, e.y)) { puff(e.x, e.y, 12, '#ffd1e0', 120, 22); cam.shake = Math.max(cam.shake, 4); } if (Math.hypot(e.x - H.x, e.y - H.y) < 700) api.sound.hiss(0.4, 0.06, 300); break;
          case 'jump': if (e.p === H.id) onJump(); break;
          case 'land': if (e.p === H.id) onLand(); break;
          case 'revive': if (e.p === H.id) { burstStars(H.x, H.y, 30, 220, ['#ffd36b', '#ffffff', '#ff9cc0']); api.sound.ssr(); } break;
          case 'end': onEnd(e); break;
        }
      }
      m.ev.length = 0;
    }
    function onJump() {
      phase = 'chute';
      cam.jx = cam.x; cam.jy = cam.y;
      game.classList.remove('plane'); game.classList.add('chute');
      api.sound.hiss(0.8, 0.06, 500); api.vib(10);
      showMsg('跳傘！拖曳左下搖桿可以控制方向', 2600);
      prewarm(isNaN(H.tx) ? H.x : H.tx, isNaN(H.ty) ? H.y : H.ty, 900);
    }
    function onLand() {
      phase = 'ground';
      game.classList.remove('chute'); game.classList.add('ground');
      puff(H.x, H.y, 14, '#fff6e6', 90, 16);
      cam.shake = 5; api.vib(20); api.sound.hiss(0.18, 0.08, 250);
      const bf = buffs();
      if (H.armor || H.helmet || H.guns[0]) {
        const msgs = [];
        if (H.guns[0] && pendingKitUsed) msgs.push('豪華裝備包');
        if (bf.armorLv) msgs.push(`王國研究：Lv${bf.armorLv} 防彈衣`);
        if (bf.helmet) msgs.push('時尚加成：Lv1 頭盔');
        if (msgs.length) later(() => showMsg(msgs.join('・') + ' 已裝備！', 2600, 'gold'), 600);
      }
      if (!store().tut) { store().tut = 1; api.save(); runTutorial(); }
    }
    let pendingKitUsed = false;
    function runTutorial() {
      const steps = [
        [() => $q('.ry-stick-hint') || game, '按住左下角拖曳就能移動', 'left'],
        [() => $q('.ry-fire'), '按住準星開火：會自動瞄準最近的敵人；拖曳可以手動瞄準', 'fire'],
        [() => $q('.ry-weap'), '走過物資會自動撿起來，滿了自動換更好的槍', 'weap'],
      ];
      let i = 0;
      const next = () => {
        if (closed || phase !== 'ground' || i >= steps.length) return;
        const [el, text, kind] = steps[i++];
        const t = document.createElement('div');
        t.className = 'ry-tip tut ' + kind;
        t.innerHTML = `${text}<small>${i}/${steps.length}・點一下繼續</small>`;
        hud.appendChild(t);
        const go = () => { if (!t.isConnected) return; t.classList.add('out'); later(() => t.remove(), 250); later(next, 300); };
        t.addEventListener('pointerdown', e => { e.stopPropagation(); go(); });
        later(go, 4200);
      };
      later(next, 900);
    }
    function onZone(e) {
      if (e.k === 'warn30') { showMsg('安全區將在 30 秒後縮小', 2800); api.sound.beep(660, 0.16, 'triangle', 0.05); api.sound.beep(660, 0.16, 'triangle', 0.05, 0.25); }
      else if (e.k === 'shrink') { showMsg('安全區正在縮小！', 2600, 'warn'); api.sound.beep(520, 0.3, 'sawtooth', 0.04); }
      else if (e.k === 'next') showMsg('新的安全區已出現　快往白圈移動', 2600);
      else if (e.k === 'final') showMsg('決賽圈！最後的名媛是誰？', 2800, 'warn');
    }
    function onPick(list) {
      const it = list[list.length - 1];
      let name = '', col = '#fff';
      if (it.k === 'gun') { name = `${WEAPONS[it.w].name}`; col = RARITY[it.r].color; }
      else if (it.k === 'armor' || it.k === 'helmet') { name = `${GEAR_NAME[it.k][it.lv]} Lv${it.lv}`; col = GEAR_C[it.lv][1]; }
      else name = HEALS[it.t].name;
      const el = $q('.ry-pick');
      const row = document.createElement('div');
      row.innerHTML = `<i style="background:${col}"></i>撿到 <b>${esc(name)}</b>${it.k === 'gun' ? `<small style="color:${col}">${RARITY[it.r].name}</small>` : ''}${list.length > 1 ? `<small>等 ${list.length} 件</small>` : ''}`;
      el.appendChild(row); while (el.children.length > 3) el.firstElementChild.remove();
      later(() => row.remove(), 2200);
      if (it.box === 'drop') { api.sound.ssr(); burstStars(H.x, H.y, 26, 200, ['#ffd36b', '#ffffff', '#ff9cc0']); }
      else { api.sound.beep(1200, 0.05, 'triangle', 0.05); api.sound.beep(1600, 0.06, 'triangle', 0.05, 0.05); }
    }
    function onKill(e) {
      const v = m.players[e.victim], k = e.killer >= 0 ? m.players[e.killer] : null;
      if (onScreen(e.x, e.y, 120)) {
        dying.push({ p: v, x: e.x, y: e.y, t: 0, tok: tokOf(v) });
        burstStars(e.x, e.y, 26, 240, ['#ffffff', '#ffd36b', '#ff9cc0', '#c9b8f2']);
        addPart({ k: 'ring', x: e.x, y: e.y, t: 0, life: 0.5, s: 50 });
        addPart({ k: 'glow', x: e.x, y: e.y, t: 0, life: 0.35, s: 70 });
      }
      const wn = e.w ? WEAPONS[e.w].name : '';
      const kn = k ? (k === H ? `<b class="me">${esc(k.name)}</b>` : `<b>${esc(k.name)}</b>`) : '';
      const vn = v === H ? `<b class="me">${esc(v.name)}</b>` : `<b>${esc(v.name)}</b>`;
      feed(k ? `${kn} 用 ${wn} 淘汰了 ${vn}${e.head ? '<i class="hs">爆頭</i>' : ''}` : `${vn} 在毒圈中被淘汰`, k === H || v === H);
      if (k === H && v !== H) {
        killStreak = m.t - streakT < 8 ? killStreak + 1 : 1; streakT = m.t;
        const lab = killStreak < 2 ? '' : killStreak <= 5 ? ['', '', '雙殺！', '三殺！', '四殺！', '五殺！'][killStreak] : '超神！';
        const kb = $q('.ry-kb');
        kb.innerHTML = `<div class="ry-kbi"><span class="ry-kb-ic">${SV.star}</span><div><small>${e.head ? '爆頭淘汰' : '淘汰'}</small><b>${esc(v.name)}</b></div><em>${H.kills}</em></div>${lab ? `<div class="ry-kbs">${lab}</div>` : ''}<div class="ry-kbv"><img alt=""><span>${pick(LINES.victim)}</span></div>`;
        faceURL(api, v.look, 'sad').then(u => { const im = kb.querySelector('img'); if (im) im.src = u; });
        kb.classList.remove('go'); void kb.offsetWidth; kb.classList.add('go');
        api.sound.cash(); api.vib([10, 30, 20]);
        if (killStreak >= 2) api.sound.fever();
      }
      if (v === H) onHumanDown(k, e);
    }
    function feed(html, mine) {
      const el = $q('.ry-feed');
      const row = document.createElement('div');
      row.className = mine ? 'mine' : '';
      row.innerHTML = html;
      el.prepend(row);
      while (el.children.length > 4) el.lastElementChild.remove();
      later(() => { row.classList.add('out'); later(() => row.remove(), 400); }, 5200);
    }
    let msgT = 0;
    function showMsg(text, ms = 2400, cls = '') {
      const el = $q('.ry-msg');
      if (!el) return;
      el.className = 'ry-msg ' + cls; el.textContent = text;
      void el.offsetWidth; el.classList.add('show');
      clearTimeout(msgT); msgT = later(() => el.classList.remove('show'), ms);
    }

    // ---- 倒地、復活、結束 ----
    function onHumanDown(killer, e) {
      phase = 'dead';
      timeScale = 0.25; api.vib([30, 50, 30]); api.sound.beep(330, 0.3, 'sine', 0.07); api.sound.beep(220, 0.45, 'sine', 0.07, 0.25);
      game.classList.add('down');
      later(() => {
        paused = true; timeScale = 1;
        const d = $q('.ry-death');
        d.hidden = false;
        const canRevive = !revived;
        d.innerHTML = `<div class="ry-dc"><div class="ry-dc-eye">Eliminated</div><h3>妳被淘汰了</h3>
          <p>${killer ? `<b>${esc(killer.name)}</b> 用 ${WEAPONS[e.w].name} ${e.head ? '爆頭' : ''}淘汰了妳` : '妳在毒圈中倒下了'}</p>
          ${killer ? `<div class="ry-dc-k"><img alt=""><span>「${pick(LINES.killer)}」</span></div>` : ''}
          <div class="ry-dc-rank">目前名次 <b>#${H.rank}</b> / ${m.n}</div>
          <div class="ry-dc-acts">${canRevive ? `<button class="btn gemb ry-rev"><span>原地復活</span><small>${api.icons.gem()}${GEM_COST.revive}</small></button>` : ''}<button class="btn ghost ry-res-go"><span>查看結算</span></button></div></div>`;
        if (killer) faceURL(api, killer.look, 'joy').then(u => { const im = d.querySelector('.ry-dc-k img'); if (im) im.src = u; });
        const rv = d.querySelector('.ry-rev');
        if (rv) rv.addEventListener('click', () => api.twoTap(rv, () => {
          if (!api.spendGems(GEM_COST.revive)) return;
          revived = true; revive(m, H); d.hidden = true; paused = false; phase = 'ground'; game.classList.remove('down');
          showMsg('原地復活！3 秒無敵', 2400, 'gold'); handleEvents();
        }, () => { const s = rv.querySelector('small'); if (s) s.innerHTML = rv.dataset.confirm ? `確認 ${api.icons.gem()}${GEM_COST.revive}` : `${api.icons.gem()}${GEM_COST.revive}`; }));
        d.querySelector('.ry-res-go').addEventListener('click', () => { api.sound.click(); finish(false); });
      }, 1100);
    }
    function onEnd(e) {
      if (e.winner === H.id && H.alive) {
        phase = 'over';
        timeScale = 0.3;
        showMsg('最後一位名媛就是妳！', 2200, 'gold');
        api.sound.fever();
        later(() => finish(true), 1700);
      }
    }
    function finish(win) {
      if (endShown) return;
      endShown = true;
      paused = true; phase = 'over';
      cancelAnimationFrame(raf); raf = 0;
      const rank = win ? 1 : H.rank || m.alive + 1, kills = H.kills, dmg = Math.round(H.dmg), surv = win ? m.t : H.deathT || m.t;
      const unit = api.betUnit();
      const placeMult = rank === 1 ? 15 : rank <= 3 ? 8 : rank <= 5 ? 6 : rank <= 10 ? 4 : rank <= 20 ? 2.5 : 1.2;
      const cPlace = Math.round(unit * placeMult), cKill = Math.round(unit * 1.5 * kills);
      const gems = rank === 1 ? 10 : 0;
      const leafK = rank === 1 ? 2 : rank <= 3 ? 1.5 : rank <= 5 ? 1.2 : rank <= 10 ? 0.9 : rank <= 20 ? 0.6 : 0.3;
      const leaf = has('resUnit') ? Math.round(api.resUnit() * leafK) : 0;
      let shard = null;
      if (rank <= 10) { const ids = api.cast().map(c => c.id); shard = { id: pick(ids), n: 1 + Math.floor(Math.random() * 3) }; }
      const ptsD = (rank === 1 ? 45 : rank <= 3 ? 30 : rank <= 5 ? 22 : rank <= 10 ? 14 : rank <= 20 ? 6 : -4) + Math.min(40, kills * 4);
      const s = store(), t0 = tierIdx(s.pts);
      s.games++; s.kills += kills; s.dmg += dmg; if (win) s.wins++; if (rank <= 10) s.top10++; s.best = Math.max(s.best, kills);
      s.pts = Math.max(0, s.pts + ptsD);
      s.hist.unshift({ rank, kills, dmg, t: Math.round(surv), at: Date.now() }); s.hist.length = Math.min(s.hist.length, 12);
      const t1 = tierIdx(s.pts);
      api.stat('royale_play'); if (kills) api.stat('royale_kills', kills); if (win) api.stat('royale_win');
      if (has('event')) { try { api.event('royale_match', { rank, kills }); if (kills > 0) api.event('royale_kill', { n: kills }); if (win) api.event('royale_win'); } catch (er) { console.error(er); } }
      showResult({ win, rank, kills, dmg, surv, cPlace, cKill, gems, leaf, shard, ptsD, t0, t1 });
      api.save();
    }
    function showResult(R) {
      scene = 'result';
      const el = document.createElement('div');
      el.className = 'ry-res ' + (R.win ? 'win' : R.rank <= 10 ? 'top' : 'lose');
      const expr = R.win || R.rank <= 10 ? 'joy' : 'sad';
      const line = R.win ? pick(LINES.win) : R.rank <= 10 ? pick(LINES.top) : pick(LINES.lose);
      const s = store(), T = TIERS[R.t1], nx = TIERS[R.t1 + 1];
      const pct = nx ? (s.pts - T.pts) / (nx.pts - T.pts) * 100 : 100;
      const shardName = R.shard ? (R.shard.id === 'erika' ? me.name : (api.cast().find(c => c.id === R.shard.id) || {}).name || '') : '';
      el.innerHTML = `<div class="ry-res-bg"></div>
        <div class="ry-res-top">${R.win ? `<div class="ry-feast">${BOTTLE}${LEG}<span class="ry-foam"></span></div><h2 class="ry-win-t"><span>大吉大利</span><b>今晚吃雞</b></h2>` : `<div class="ry-place num">#${R.rank}<small>/ ${m.n}</small></div><h2 class="ry-lose-t">${R.rank <= 10 ? '前十名！差一點就吃雞' : '再接再厲'}</h2>`}</div>
        <div class="ry-res-char"><img src="${me.face(expr)}" alt=""><div class="ry-res-say">${line}</div></div>
        <dl class="ry-res-st"><div><dt>名次</dt><dd class="num">#${R.rank}</dd></div><div><dt>擊殺</dt><dd class="num">${R.kills}</dd></div><div><dt>傷害</dt><dd class="num">${R.dmg}</dd></div><div><dt>存活</dt><dd class="num">${fmtClock(R.surv)}</dd></div></dl>
        <div class="ry-rw">
          <div class="ry-rw-row" style="--d:.5s"><span>名次獎勵</span><b>${api.icons.coin()}<i class="num" data-n="${R.cPlace}">0</i></b></div>
          <div class="ry-rw-row" style="--d:.8s"><span>擊殺獎勵 ×${R.kills}</span><b>${api.icons.coin()}<i class="num" data-n="${R.cKill}">0</i></b></div>
          ${R.leaf ? `<div class="ry-rw-row" style="--d:1.1s"><span>王國資源・金箔</span><b><i class="ry-leaf"></i><i class="num" data-n="${R.leaf}">0</i></b></div>` : ''}
          ${R.shard ? `<div class="ry-rw-row" style="--d:1.3s"><span>前十名禮物</span><b>${esc(shardName)}碎片 ×${R.shard.n}</b></div>` : ''}
          ${R.gems ? `<div class="ry-rw-row gem" style="--d:1.5s"><span>吃雞紅利</span><b>${api.icons.gem()}<i class="num" data-n="${R.gems}">0</i></b></div>` : ''}
          <div class="ry-rk-line" style="--d:1.7s">${badgeSVG(R.t1)}<div><b>${T.name}</b>${R.t1 > R.t0 ? '<em>段位晉升！</em>' : ''}<div class="ry-rk-bar"><i style="width:${pct.toFixed(1)}%"></i></div></div><span class="num ${R.ptsD >= 0 ? 'up' : 'dn'}">${R.ptsD >= 0 ? '+' : ''}${R.ptsD} 分</span></div>
        </div>
        <div class="ry-res-acts"><button class="btn ghost ry-home"><span>返回大廳</span></button><button class="btn goldb ry-again"><span>再來一局</span><small>立即配對</small></button></div>`;
      root.appendChild(el);
      requestAnimationFrame(() => el.classList.add('in'));
      // 發獎（先發，動畫只是演出）
      const r = el.querySelector('.ry-rw').getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 20;
      const coins = R.cPlace + R.cKill;
      if (has('grant')) {
        const g = { coins, res: R.leaf ? { leaf: R.leaf } : undefined, gems: R.gems || undefined, shards: R.shard ? { [R.shard.id]: R.shard.n } : undefined };
        try { api.grant(g, x, y, true); } catch (er) { console.error(er); api.addCoins(coins, x, y); if (R.gems) api.addGems(R.gems, x, y); }
      } else { api.addCoins(coins, x, y); if (R.gems) api.addGems(R.gems, x, y); }
      el.querySelectorAll('[data-n]').forEach((n, i) => {
        const target = +n.dataset.n, t0 = performance.now() + 500 + i * 300;
        const step = () => { if (closed || !n.isConnected) return; const k = clamp((performance.now() - t0) / 900, 0, 1); n.textContent = api.fmt(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); else { api.sound.beep(1400 + i * 120, 0.06, 'triangle', 0.05); } };
        requestAnimationFrame(step);
      });
      if (R.win) {
        api.sound.ssr(); later(() => api.sound.fever(), 500);
        const rr2 = el.getBoundingClientRect();
        api.fx.rain('confetti', 90, rr2); later(() => api.fx.rain('coin', 30, rr2), 600);
        later(() => { const f = el.querySelector('.ry-feast'); if (f) { const b = f.getBoundingClientRect(); api.fx.burst(b.left + b.width * 0.3, b.top + 10, 40, ['confetti', 'spark']); } }, 700);
        api.vib([20, 40, 20, 40, 60]);
      } else if (R.rank <= 10) { api.sound.level(); api.fx.burst(x, y, 24); }
      else api.sound.cash();
      if (R.t1 > R.t0) later(() => { api.toast(`段位晉升：${TIERS[R.t1].name}！`, 'gold'); api.sound.level(); }, 2000);
      el.querySelector('.ry-home').addEventListener('click', () => { api.sound.click(); el.classList.add('out'); later(() => showLobby(), 250); });
      el.querySelector('.ry-again').addEventListener('click', () => { api.sound.click(); el.classList.add('out'); later(() => { showLobby(); startMatchmaking(); }, 250); });
    }

    // ---- 粒子與特效更新 ----
    function updateFx(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t += dt;
        if (p.t >= p.life) { parts.splice(i, 1); continue; }
        if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; const f = p.k === 'puff' ? 0.9 : p.k === 'shell' ? 0.86 : 0.93; p.vx *= Math.pow(f, dt * 60); p.vy *= Math.pow(f, dt * 60); }
        if (p.vr) p.r += p.vr * dt;
      }
      for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.t += dt; t.y += t.vy * dt; t.vy *= Math.pow(0.92, dt * 60); if (t.t >= t.life) texts.splice(i, 1); }
      for (let i = ghosts.length - 1; i >= 0; i--) { ghosts[i].t += dt; if (ghosts[i].t > 0.09) ghosts.splice(i, 1); }
      for (let i = dying.length - 1; i >= 0; i--) { dying[i].t += dt; if (dying[i].t > 0.6) dying.splice(i, 1); }
      for (let i = hitInd.length - 1; i >= 0; i--) { hitInd[i].t += dt; if (hitInd[i].t > 1) hitInd.splice(i, 1); }
      if (H && H._hitMark > 0) H._hitMark -= dt;
      for (const p of m.players) { if (p._kick > 0) p._kick = Math.max(0, p._kick - dt * 12); if (p._flashT > 0) p._flashT -= dt; }
      // 空投粉紅煙霧
      smokeAcc += dt;
      if (smokeAcc > 0.12) {
        smokeAcc = 0;
        for (const b of m.boxes) if (b.kind === 'drop' && b.alt === 0 && b.items.length && onScreen(b.x, b.y, 300)) addPart({ k: 'smoke', x: b.x + (Math.random() - 0.5) * 10, y: b.y - 10, vx: (Math.random() - 0.5) * 14 + 10, vy: -40 - Math.random() * 30, t: 0, life: 2.6, s: 14 + Math.random() * 10 });
      }
    }

    // ---- 繪製 ----
    function render(time) {
      const W = cv.width, Hh = cv.height, z = cam.z * DPR;
      const sh = REDUCED ? 0 : cam.shake;
      const camx = cam.x + (sh ? (Math.random() - 0.5) * sh : 0), camy = cam.y + (sh ? (Math.random() - 0.5) * sh : 0);
      const ox = W / 2 - camx * z, oy = Hh / 2 - camy * z;
      const vx0 = -ox / z, vy0 = -oy / z, vx1 = vx0 + W / z, vy1 = vy0 + Hh / z;
      const M = getMap();
      const inV = (x, y, r) => x + r > vx0 && x - r < vx1 && y + r > vy0 && y - r < vy1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#4fb4cf'; ctx.fillRect(0, 0, W, Hh);
      const k = ovCv.width / MAP;
      ctx.imageSmoothingEnabled = true;
      ctx.setTransform(z / k, 0, 0, z / k, ox, oy); ctx.drawImage(ovCv, 0, 0);
      const ca = clamp((cam.z / baseZ - 0.34) / 0.18, 0, 1);
      if (ca > 0) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = ca;
        const i0 = Math.max(0, Math.floor(vx0 / CH)), i1 = Math.min(Math.ceil(MAP / CH) - 1, Math.floor(vx1 / CH));
        const j0 = Math.max(0, Math.floor(vy0 / CH)), j1 = Math.min(Math.ceil(MAP / CH) - 1, Math.floor(vy1 / CH));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const c = getChunk(i, j);
          if (!c) { want.push([i, j, Math.hypot((i + 0.5) * CH - cam.x, (j + 0.5) * CH - cam.y)]); continue; }
          const dx = Math.floor(ox + i * CH * z), dy = Math.floor(oy + j * CH * z);
          ctx.drawImage(c, dx, dy, Math.ceil(ox + (i + 1) * CH * z) - dx, Math.ceil(oy + (j + 1) * CH * z) - dy);
        }
        ctx.globalAlpha = 1;
      }
      ctx.setTransform(z, 0, 0, z, ox, oy);
      const zw = 1 / cam.z; // 一個 CSS 像素的世界長度
      // 海面閃光
      if (!REDUCED) { ctx.fillStyle = '#ffffff'; for (const [x, y, ph] of SPARK) { if (!inV(x, y, 6)) continue; const a = Math.sin(time * 2.2 + ph); if (a < 0.55) continue; ctx.globalAlpha = (a - 0.55) * 2; star4(ctx, x, y, 3 + a * 2); } ctx.globalAlpha = 1; }
      const z0 = m.zone;
      // 下一個安全區（白圈）
      if (z0.st !== 'end' && z0.br > 0) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.2 * zw; ctx.setLineDash([10 * zw, 7 * zw]); ctx.beginPath(); ctx.arc(z0.bx, z0.by, z0.br, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      const ground = cam.z > baseZ * 0.3;
      const hb = H.alive && H.state === 'ground' ? H.bin : -1;
      const hidden = bi => bi >= 0 && bi !== hb && !M.bld[bi].gazebo;
      if (ground) {
        // 地上物資
        const bob = Math.sin(time * 3) * 1.5;
        for (const it of m.items) {
          if (!inV(it.x, it.y, 30)) continue;
          if (hidden(buildingAt(M, it.x, it.y))) continue;
          if (it.k === 'gun' && it.r >= 3) { ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 4 + it.id); ctx.drawImage(glowSpr(RARITY[it.r].color), it.x - 12, it.y - 58, 24, 60); ctx.globalAlpha = 1; }
          ctx.drawImage(itemSpr(it), it.x - 24, it.y - 24 + bob, 48, 48);
        }
        for (const b of m.boxes) {
          if (b.alt > 0 || !inV(b.x, b.y, 40)) continue;
          if (b.kind === 'death' && hidden(buildingAt(M, b.x, b.y))) continue;
          const S = b.kind === 'drop' ? 54 : 40;
          ctx.globalAlpha = b.empty ? clamp(1 - (m.t - b.empty) / 1.2, 0, 1) : 1;
          ctx.drawImage(boxSpr(b.kind), b.x - S / 2, b.y - S / 2, S, S);
          if (b.items.length && !REDUCED) { ctx.fillStyle = '#fff'; ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(time * 5 + b.id); star4(ctx, b.x + 8, b.y - 12, 3.5); }
          ctx.globalAlpha = 1;
        }
        // 玩家腳下的光圈
        if (H.alive && H.state === 'ground') {
          ctx.strokeStyle = 'rgba(255,214,120,.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -time * 12;
          ctx.beginPath(); ctx.arc(H.x, H.y, VR + 7, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
          if (H.heal) { ctx.strokeStyle = 'rgba(159,240,194,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(H.x, H.y, VR + 11, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - H.heal.t / H.heal.total)); ctx.stroke(); }
        }
        // 角色
        const list = m.players.filter(p => p.alive && p.state === 'ground' && inV(p.x, p.y, 60) && !hidden(p.bin)).sort((a, b) => a.y - b.y);
        for (const p of list) drawActor(p, time);
        for (const d of dying) {
          const k2 = d.t / 0.6, s = (1 - k2) * (1 + k2 * 0.4);
          if (d.tok) { ctx.globalAlpha = 1 - k2; const S = (VR + 4) * 2 * s; ctx.drawImage(d.tok, d.x - S / 2, d.y - S / 2, S, S); ctx.globalAlpha = 1; }
        }
        // 屋頂
        for (const b of M.bld) {
          const target = b.i === hb ? 0 : 1;
          b._ra = b._ra == null ? target : b._ra + (target - b._ra) * 0.18;
          if (b._ra < 0.02 || !inV(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
          ctx.globalAlpha = b._ra;
          ctx.drawImage(roofSpr(b), b.x - 8, b.y - 8, b.w + 16, b.h + 16);
        }
        ctx.globalAlpha = 1;
        // 樹冠
        for (const t of M.trees) {
          if (!inV(t.x, t.y, 60)) continue;
          const S = ((t.palm ? 48 : 42) * 2 + 10) * t.s;
          const under = H.alive && Math.hypot(H.x - t.x, H.y - t.y - 6) < 46 * t.s;
          ctx.globalAlpha = under ? 0.45 : 1;
          ctx.drawImage(treeSpr(t), t.x - S / 2, t.y - S / 2 - 8, S, S);
        }
        ctx.globalAlpha = 1;
        // 陽傘
        for (const l of M.loungers) { if (!inV(l.x, l.y, 30)) continue; ctx.save(); ctx.translate(l.x + 18, l.y - 6); for (let q = 0; q < 8; q++) { ctx.fillStyle = q % 2 ? '#fff' : '#ff9cc0'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 20, q / 8 * TAU, (q + 1) / 8 * TAU); ctx.fill(); } ctx.restore(); }
      }
      // 子彈曳光
      ctx.lineCap = 'round';
      const trace = (mine, glow) => {
        ctx.beginPath();
        for (const b of m.bullets) { if (b.human !== mine) continue; const L = Math.min(b.d, 80); if (!inV(b.x, b.y, 90)) continue; ctx.moveTo(b.x - b.dx * L, b.y - b.dy * L); ctx.lineTo(b.x, b.y); }
        for (const g of ghosts) { if (g.mine !== mine) continue; ctx.moveTo(g.x1 - g.dx * g.len, g.y1 - g.dy * g.len); ctx.lineTo(g.x1, g.y1); }
        ctx.strokeStyle = glow ? (mine ? 'rgba(255,140,190,.35)' : 'rgba(255,214,120,.3)') : mine ? '#fff0f6' : '#fff6d6';
        ctx.lineWidth = glow ? 5.5 : 1.9; ctx.stroke();
      };
      trace(false, true); trace(true, true); trace(false, false); trace(true, false);
      // 粒子
      for (const p of parts) {
        if (!inV(p.x, p.y, 40)) continue;
        const a = 1 - p.t / p.life;
        switch (p.k) {
          case 'star': ctx.globalAlpha = Math.min(1, a * 1.6); ctx.fillStyle = p.c; star4(ctx, p.x, p.y, p.s * (0.6 + 0.4 * a)); break;
          case 'spark': ctx.globalAlpha = a; ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = p.s; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); break;
          case 'puff': ctx.globalAlpha = a * 0.55; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1.4 - a * 0.4), 0, TAU); ctx.fill(); break;
          case 'smoke': ctx.globalAlpha = a * 0.5; ctx.fillStyle = '#ff9cc0'; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1.8 - a), 0, TAU); ctx.fill(); break;
          case 'ring': ctx.globalAlpha = a; ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 3 * a + 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 - a * a), 0, TAU); ctx.stroke(); break;
          case 'glow': ctx.globalAlpha = a; ctx.drawImage(glowSpr('#fff6d6'), p.x - p.s, p.y - p.s, p.s * 2, p.s * 2); break;
          case 'flash': { ctx.globalAlpha = a; const f = sprOf('flash', () => flashCv(sprScale)); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.drawImage(f, -p.s * 0.6, -p.s / 2, p.s * 1.4, p.s); ctx.restore(); break; }
          case 'shell': ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = '#e7c06a'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillRect(-2.2, -1, 4.4, 2); ctx.restore(); break;
        }
      }
      ctx.globalAlpha = 1;
      // 空投箱降落中
      for (const b of m.boxes) {
        if (b.alt <= 0 || !inV(b.x, b.y, 200)) continue;
        const s = 1 + b.alt * 1.6, yo = -b.alt * 260;
        ctx.fillStyle = 'rgba(60,20,50,.22)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 10, 24 * (1 - b.alt * 0.5), 10 * (1 - b.alt * 0.5), 0, 0, TAU); ctx.fill();
        drawCanopy(b.x, b.y + yo - 34 * s, 34 * s, '#ff9cc0', '#ffffff', b.x, b.y + yo - 10 * s);
        ctx.drawImage(boxSpr('drop'), b.x - 27 * s, b.y + yo - 27 * s, 54 * s, 54 * s);
      }
      // 跳傘中的名媛
      for (const p of m.players) {
        if (p.state !== 'chute' || !inV(p.x, p.y, 300)) continue;
        const alt = 1 - p.chute.t / CHUTE_T, mine = p === H;
        const s = (1 + alt * 0.8) * (cam.z < baseZ * 0.5 ? Math.min(3, baseZ * 0.5 / cam.z) : 1) * (mine ? 1 : 0.8);
        const yo = -alt * 180;
        ctx.fillStyle = 'rgba(60,20,50,.2)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 14 * (1 - alt * 0.6), 6 * (1 - alt * 0.6), 0, 0, TAU); ctx.fill();
        if (p.chute.t > 0.9) drawCanopy(p.x, p.y + yo - 40 * s, 40 * s, mine ? '#ff7fae' : hueHex('#ff9cc0', (p.look * 47) % 360), '#ffffff', p.x, p.y + yo - 6 * s);
        const tk = tokOf(p);
        if (tk) { const S = (VR + 4) * 2 * s; ctx.drawImage(tk, p.x - S / 2, p.y + yo - S / 2, S, S); }
        if (mine) { ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2.4 * zw; ctx.beginPath(); ctx.arc(p.x, p.y + yo, (VR + 6) * s, 0, TAU); ctx.stroke(); }
      }
      // 毒圈（圈外的紫粉色霧）
      if (z0.r < 2600) {
        const corners = [[vx0, vy0], [vx1, vy0], [vx0, vy1], [vx1, vy1]];
        if (!corners.every(([x, y]) => (x - z0.x) ** 2 + (y - z0.y) ** 2 < z0.r * z0.r)) {
          ctx.fillStyle = `rgba(132,58,196,${0.3 + 0.04 * Math.sin(time * 2)})`;
          ctx.beginPath(); ctx.rect(vx0 - 10, vy0 - 10, vx1 - vx0 + 20, vy1 - vy0 + 20); ctx.arc(z0.x, z0.y, Math.max(1, z0.r), 0, TAU, true); ctx.fill();
          ctx.strokeStyle = 'rgba(230,170,255,.35)'; ctx.lineWidth = 16 * zw; ctx.beginPath(); ctx.arc(z0.x, z0.y, Math.max(1, z0.r), 0, TAU); ctx.stroke();
          ctx.strokeStyle = '#efc4ff'; ctx.lineWidth = 2.5 * zw; ctx.stroke();
        }
      }
      // 飛機
      if (!m.plane.gone) drawPlane(m.plane, zw);
      // 降落標記
      if (mark && (phase === 'plane' || phase === 'chute')) {
        ctx.save(); ctx.translate(mark.x, mark.y); ctx.scale(zw, zw);
        ctx.fillStyle = 'rgba(255,214,120,.35)'; ctx.beginPath(); ctx.ellipse(0, 0, 14 + 3 * Math.sin(time * 5), 6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff5f9a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-10, -12, -11, -26, 0, -27); ctx.bezierCurveTo(11, -26, 10, -12, 0, 0); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -18, 4, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // 自動瞄準的目標
      if (H.autoTarget >= 0 && phase === 'ground') { const t = m.players[H.autoTarget]; if (t && t.alive) { ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(time * 1.5); ctx.strokeStyle = m.superAim ? '#ffd36b' : '#ff6fa8'; ctx.lineWidth = 2; for (let q = 0; q < 4; q++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.arc(0, 0, VR + 9, -0.45, 0.45); ctx.stroke(); } ctx.restore(); } }
      // 手動瞄準輔助線
      if (phase === 'ground' && input.manual && input.fire) { const g = curGun(H), R = g ? WEAPONS[g.w].range : 300; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5 * zw; ctx.setLineDash([6 * zw, 6 * zw]); ctx.beginPath(); ctx.moveTo(H.x + Math.cos(H.aim) * 30, H.y + Math.sin(H.aim) * 30); ctx.lineTo(H.x + Math.cos(H.aim) * R, H.y + Math.sin(H.aim) * R); ctx.stroke(); ctx.setLineDash([]); }
      // 傷害數字
      ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      for (const t of texts) {
        const a = Math.min(1, (t.life - t.t) * 4), sc = t.t < 0.1 ? 0.6 + t.t * 4 : 1;
        ctx.globalAlpha = a;
        const fs = (t.head ? 22 : 15) * sc * zw;
        ctx.font = `700 ${fs}px "Bodoni Moda", Georgia, serif`;
        ctx.lineWidth = 3.5 * zw; ctx.strokeStyle = t.head ? '#7a1f45' : 'rgba(80,20,50,.85)'; ctx.fillStyle = t.head ? '#ffd36b' : '#ffffff';
        ctx.strokeText(t.v, t.x, t.y); ctx.fillText(t.v, t.x, t.y);
        if (t.head) { ctx.font = `700 ${11 * zw}px "Noto Serif TC", serif`; ctx.lineWidth = 3 * zw; ctx.strokeText('爆頭', t.x, t.y - fs * 0.95); ctx.fillText('爆頭', t.x, t.y - fs * 0.95); }
      }
      ctx.globalAlpha = 1;
      // 螢幕座標：地名、受擊方向
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (cam.z < baseZ * 0.42) {
        const la = clamp(1 - (cam.z / baseZ - 0.2) / 0.22, 0, 1);
        ctx.globalAlpha = la; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        for (const [n, x, y, big] of M.labels) {
          const sx = x * z + ox, sy = y * z + oy;
          ctx.font = `700 ${(big ? 12.5 : 10.5) * DPR}px "Noto Serif TC", serif`;
          ctx.lineWidth = 3.2 * DPR; ctx.strokeStyle = 'rgba(59,21,48,.82)'; ctx.strokeText(n, sx, sy); ctx.fillStyle = big ? '#ffe9a8' : '#ffffff'; ctx.fillText(n, sx, sy);
        }
        ctx.globalAlpha = 1;
      }
      if (hitInd.length && H.alive) {
        const hx = (H.x) * z + ox, hy = H.y * z + oy;
        for (const h of hitInd) { ctx.globalAlpha = 1 - h.t; ctx.strokeStyle = '#ff4f7f'; ctx.lineWidth = 5 * DPR; ctx.beginPath(); ctx.arc(hx, hy, 58 * DPR, h.a - 0.35, h.a + 0.35); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      if (H._hitMark > 0) { const g = curGun(H); const hx = (H.x + Math.cos(H.aim) * 90) * z + ox, hy = (H.y + Math.sin(H.aim) * 90) * z + oy; ctx.strokeStyle = H._hitHead ? '#ffd36b' : '#ffffff'; ctx.lineWidth = 2.2 * DPR; const r1 = 5 * DPR, r2 = 11 * DPR; ctx.beginPath(); for (let q = 0; q < 4; q++) { const a = Math.PI / 4 + q * Math.PI / 2; ctx.moveTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1); ctx.lineTo(hx + Math.cos(a) * r2, hy + Math.sin(a) * r2); } ctx.stroke(); void g; }
    }
    function drawCanopy(x, y, w, c1, c2, ax, ay) {
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x - w * 0.95, y); ctx.lineTo(ax, ay); ctx.moveTo(x + w * 0.95, y); ctx.lineTo(ax, ay); ctx.moveTo(x - w * 0.35, y + 2); ctx.lineTo(ax, ay); ctx.moveTo(x + w * 0.35, y + 2); ctx.lineTo(ax, ay); ctx.stroke();
      for (let q = 0; q < 6; q++) { ctx.fillStyle = q % 2 ? c2 : c1; ctx.beginPath(); ctx.moveTo(x, y + w * 0.1); ctx.arc(x, y + w * 0.1, w, Math.PI + q / 6 * Math.PI, Math.PI + (q + 1) / 6 * Math.PI); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = 'rgba(90,30,60,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y + w * 0.1, w, Math.PI, TAU); ctx.stroke();
    }
    function drawPlane(pl, zw) {
      const s = 1.05 * zw;
      ctx.save(); ctx.translate(pl.x, pl.y); ctx.rotate(pl.a); ctx.scale(s, s);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-34, -14); ctx.lineTo(-140, -14); ctx.moveTo(-34, 14); ctx.lineTo(-140, 14); ctx.stroke();
      ctx.fillStyle = 'rgba(40,10,40,.25)'; ctx.beginPath(); ctx.ellipse(10, 34, 40, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f6c3d6'; ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(-12, -46); ctx.lineTo(-2, -46); ctx.lineTo(18, -6); ctx.moveTo(4, 6); ctx.lineTo(-12, 46); ctx.lineTo(-2, 46); ctx.lineTo(18, 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-26, -3); ctx.lineTo(-36, -18); ctx.lineTo(-30, -18); ctx.lineTo(-18, -3); ctx.moveTo(-26, 3); ctx.lineTo(-36, 18); ctx.lineTo(-30, 18); ctx.lineTo(-18, 3); ctx.fill();
      const g = ctx.createLinearGradient(0, -9, 0, 9); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f3d6e2');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 40, 8.5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(90,30,60,.4)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#c9a35b'; ctx.fillRect(-30, -1, 58, 2);
      ctx.fillStyle = '#7fb6e0'; for (let q = -22; q < 26; q += 7) { ctx.beginPath(); ctx.arc(q, -4, 1.4, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#f08bb0'; ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(-44, -8); ctx.lineTo(-40, 0); ctx.lineTo(-44, 8); ctx.fill();
      ctx.restore();
    }
    function drawActor(p, time) {
      const tk = tokOf(p);
      const g = p.guns[p.cur];
      ctx.fillStyle = 'rgba(60,20,50,.25)'; ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + VR - 3, VR * 0.9, VR * 0.38, 0, 0, TAU); ctx.fill();
      if (p.armor && p.armor.dur > 0) { ctx.strokeStyle = GEAR_C[p.armor.lv][1]; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(p.x, p.y, VR + 2.2, 0, TAU); ctx.stroke(); }
      if (g) {
        const spr = gunSpr(g.w, g.r);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.aim);
        if (Math.cos(p.aim) < 0) ctx.scale(1, -1);
        const kick = (p._kick || 0) * (WEAPONS[g.w].snd >= 2 ? 6 : 3);
        ctx.drawImage(spr, VR - 9 - GUN_OX - kick, 4 - GUN_OY, GUN_W, GUN_H);
        ctx.restore();
      }
      if (tk) {
        const S = (VR + 4) * 2;
        if (p.invuln > 0 && Math.floor(time * 12) % 2) ctx.globalAlpha = 0.45;
        ctx.drawImage(tk, p.x - S / 2, p.y - S / 2, S, S);
        ctx.globalAlpha = 1;
      } else { ctx.fillStyle = '#f7c6d6'; ctx.beginPath(); ctx.arc(p.x, p.y, VR, 0, TAU); ctx.fill(); }
      if (p.flash > 0) { ctx.globalAlpha = clamp(p.flash / 0.13, 0, 1) * 0.85; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, VR, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      if (p.helmet && p.helmet.dur > 0) { ctx.save(); ctx.translate(p.x, p.y - VR + 1); drawTiara(ctx, p.helmet.lv, 7.5); ctx.restore(); }
      if (p !== H && (m.t - (p._hitByMe || -9) < 2.5 || p.id === H.autoTarget)) {
        const w = 34, f = clamp(p.hp / p.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(40,10,30,.7)'; rr(ctx, p.x - w / 2 - 1, p.y - VR - 15, w + 2, 6, 3); ctx.fill();
        ctx.fillStyle = f > 0.5 ? '#ffffff' : f > 0.25 ? '#ffd36b' : '#ff6f8f'; rr(ctx, p.x - w / 2, p.y - VR - 14, w * f, 4, 2); ctx.fill();
        ctx.font = '700 9px "Noto Serif TC", serif'; ctx.textAlign = 'center'; ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(40,10,30,.75)'; ctx.fillStyle = '#fff'; ctx.strokeText(p.name, p.x, p.y - VR - 18); ctx.fillText(p.name, p.x, p.y - VR - 18);
      }
      if (p.heal && p !== H) { ctx.strokeStyle = 'rgba(159,240,194,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, VR + 6, 0, TAU * (1 - p.heal.t / p.heal.total)); ctx.stroke(); }
    }

    // ---- HUD ----
    let gearKey = '', weapKey = '', zoneAcc = 0;
    function updateHud(dt) {
      hudAcc += dt; miniAcc += dt; zoneAcc += dt;
      setText('.ry-alive', m.alive);
      setText('.ry-kc', H.kills);
      if (phase === 'plane') setText('.ry-pl-n', m.players.filter(p => p.state === 'plane').length);
      const f = clamp(H.hp / H.maxHp, 0, 1);
      const hpf = $q('.ry-hpf'), hpd = $q('.ry-hpd');
      hpf.style.width = (f * 100).toFixed(1) + '%';
      hpd._v = Math.max(f, (hpd._v ?? 1) - dt * 0.35); hpd.style.width = (hpd._v * 100).toFixed(1) + '%';
      hpf.classList.toggle('low', f < 0.3);
      $q('.ry-bst').style.width = (H.boost) + '%';
      setText('.ry-hpt', Math.max(0, Math.ceil(H.hp)));
      game.classList.toggle('lowhp', f < 0.3 && H.alive);
      game.classList.toggle('inzone', !!(H.zoneHurt && H.alive && H.state === 'ground'));
      const gk = `${H.armor ? H.armor.lv + ':' + Math.ceil(H.armor.dur / ARMOR[H.armor.lv].dur * 4) : 0}|${H.helmet ? H.helmet.lv + ':' + Math.ceil(H.helmet.dur / ARMOR[H.helmet.lv].dur * 4) : 0}`;
      if (gk !== gearKey) {
        gearKey = gk;
        const gi = (k, g) => g && g.dur > 0 ? `<img src="${iconURL(k + g.lv, x => (k === 'a' ? drawVest : drawTiara)(x, g.lv, 20))}" alt=""><b>Lv${g.lv}</b><i style="width:${(g.dur / ARMOR[g.lv].dur * 100).toFixed(0)}%"></i>` : '<span class="none">—</span>';
        setHTML($q('.ry-gear.ga'), gi('a', H.armor)); setHTML($q('.ry-gear.gh'), gi('h', H.helmet));
      }
      const wk = H.guns.map(g => g ? `${g.w}${g.r}${g.ammo}` : '-').join('|') + H.cur + (H.reloadT > 0 ? 'r' : '');
      if (wk !== weapKey) {
        weapKey = wk;
        game.querySelectorAll('.ry-ws').forEach(b => {
          const i = +b.dataset.s, g = H.guns[i];
          b.classList.toggle('cur', i === H.cur); b.classList.toggle('empty', !g);
          if (!g) { setHTML(b, `<span class="ry-ws-e">空槍位</span>`); return; }
          const W = WEAPONS[g.w], R = RARITY[g.r];
          const url = sprOf('wu' + g.w + g.r, () => gunCv(g.w, g.r, 2.4, false).toDataURL());
          setHTML(b, `<i class="ry-ws-r" style="background:${R.color}"></i><img src="${url}" alt=""><span class="ry-ws-n">${W.name}</span><span class="ry-ws-a num">${i === H.cur && H.reloadT > 0 ? '換彈中' : `${g.ammo}<small>/${magOf(g.w, g.r)}</small>`}</span>`);
          b.style.setProperty('--rc', R.color);
        });
      }
      const g = curGun(H);
      const rl = $q('.ry-rl');
      if (H.reloadT > 0 && g) { rl.style.transform = `scaleX(${(1 - H.reloadT / reloadOf(g.w, g.r)).toFixed(3)})`; $q('.ry-reload').classList.add('busy'); }
      else { rl.style.transform = 'scaleX(0)'; $q('.ry-reload').classList.remove('busy'); }
      setText($q('.ry-heal b'), H.heals.bandage + H.heals.medkit);
      setText($q('.ry-drink b'), H.heals.drink);
      $q('.ry-heal').classList.toggle('off', H.heals.bandage + H.heals.medkit <= 0);
      $q('.ry-drink').classList.toggle('off', H.heals.drink <= 0);
      const hl = $q('.ry-healing');
      if (H.heal) { hl.classList.add('on'); hl.querySelector('.p').style.strokeDashoffset = (106.8 * (H.heal.t / H.heal.total)).toFixed(1); setText(hl.querySelector('span'), `${HEALS[H.heal.k].name}中…`); } else hl.classList.remove('on');
      if (zoneAcc > 0.2) {
        zoneAcc = 0;
        const z = m.zone, el = $q('.ry-zone');
        let t = '';
        if (z.st === 'wait') t = `安全區縮小 ${fmtClock(z.t)}`;
        else if (z.st === 'shrink') t = `安全區縮小中 ${fmtClock(z.t)}`;
        else t = '最終安全區';
        const dz = Math.hypot(H.x - z.bx, H.y - z.by) - z.br;
        if (H.alive && H.state === 'ground' && dz > 0 && z.st !== 'end') t += `・距離 ${Math.round(dz / 10)}m`;
        setText(el.querySelector('span'), t);
        el.classList.toggle('warn', z.st === 'shrink' || (z.st === 'wait' && z.t < 30));
      }
      if (miniAcc > 0.12 && phase !== 'plane') { miniAcc = 0; drawMini(); }
    }
    function drawMini() {
      const c = $q('.ry-mini canvas'), x = c.getContext('2d'), S = c.width;
      const span = 1500, k = S / span;
      const ox = clamp(H.x - span / 2, 0, MAP - span), oy = clamp(H.y - span / 2, 0, MAP - span);
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.fillStyle = '#4fb4cf'; x.fillRect(0, 0, S, S);
      const kk = ovCv.width / MAP;
      x.drawImage(ovCv, ox * kk, oy * kk, span * kk, span * kk, 0, 0, S, S);
      drawMapMarks(x, k, ox, oy, false);
    }

    // ---- 沙盒測試用 ----
    function exposeDebug() {
      window.__royale = {
        get m() { return m; }, get phase() { return phase; }, get scene() { return scene; },
        jumpNow() { H.input.jump = true; m.t = Math.max(m.t, m.plane.dur * (m.plane.span[0] + 0.05)); },
        skipToGround(x, y) {
          if (H.state === 'plane') startChute(m, H);
          if (x != null) { H.x = x; H.y = y; H.tx = x; H.ty = y; }
          if (H.chute) H.chute.t = CHUTE_T - 0.05;
          for (const p of m.players) if (p.state === 'plane') startChute(m, p);
          for (const p of m.players) if (p.chute && p !== H) { p.chute.t = CHUTE_T - 0.05 - Math.random() * 0.5; }
          m.plane.gone = true; m.t = Math.max(m.t, m.plane.dur);
        },
        give(w, r = 3) { H.guns[0] = { w, r, ammo: magOf(w, r) }; H.cur = 0; H.armor = { lv: 2, dur: 140 }; H.helmet = { lv: 3, dur: 200 }; H.heals = { bandage: 5, medkit: 2, drink: 2 }; },
        enemyNear(d = 180, a = -0.6) { const e = m.players.find(p => p !== H && p.alive && p.state === 'ground'); if (!e) return; const f = nearestFree(m.map, H.x + Math.cos(a) * d, H.y + Math.sin(a) * d, 10); e.x = f[0]; e.y = f[1]; e.guns[0] = { w: 'smg', r: 1, ammo: 30 }; e.cur = 0; e.ai.calm = 0; e.ai.passive = false; e.ai.target = H; e.ai.seenT = m.t; e.ai.mode = 'fight'; return e.name; },
        hold(fire, aim) { input.fire = !!fire; if (aim != null) { input.manual = true; input.aim = aim; } else input.manual = false; },
        zone(i) { const z = m.zone; z.i = i; z.st = 'shrink'; z.t = 3; z.ax = z.x; z.ay = z.y; z.ar = z.r; z.bx = H.x + 260; z.by = H.y + 160; z.br = ZONES[i].r; z.dps = ZONES[i].dps; },
        killAllBut(n = 1) { const alive = m.players.filter(p => p.alive && p !== H); for (const p of alive.slice(n)) { p.alive = false; p.state = 'dead'; m.alive--; } },
        win() { const others = m.players.filter(p => p.alive && p !== H); for (const p of others.slice(1)) { p.alive = false; p.state = 'dead'; m.alive--; } const last = m.players.find(p => p.alive && p !== H); if (last) { last.hp = 1; H.kills += 3; H.dmg += 640; const b = { o: H.id, w: 'rifle', r: 3, d: 100, hs: 1, dx: 1, dy: 0, human: true }; hitActor(m, b, last, last.x, last.y); } },
        die() { const k = m.players.find(p => p !== H && p.alive); H.hp = 1; H.invuln = 0; H.armor = null; H.helmet = null; hitActor(m, { o: k.id, w: 'rifle', r: 2, d: 200, hs: 0, dx: 1, dy: 0, human: false }, H, H.x, H.y); },
        result(win) { finish(!!win); },
        bench() {
          const t0 = performance.now(); for (let k = 0; k < 30; k++) render(performance.now() / 1000); const r = (performance.now() - t0) / 30;
          const t1 = performance.now(); for (let k = 0; k < 30; k++) { feedInput(); stepMatch(m, 1 / 60); handleEvents(); } const st = (performance.now() - t1) / 30;
          const t2 = performance.now(); const s = chunks.cs, c = mkCv(CH * s, CH * s), x = c.getContext('2d'); x.setTransform(s, 0, 0, s, -4 * CH * s, -3 * CH * s); drawWorld(x, getMap(), { x0: 4 * CH, y0: 3 * CH, x1: 5 * CH, y1: 4 * CH }, 1); const ch = performance.now() - t2;
          return { render: +r.toFixed(2), step: +st.toFixed(2), chunk: +ch.toFixed(1), chunks: chunks.size, parts: parts.length, bullets: m.bullets.length, items: m.items.length };
        },
      };
    }

    showLobby();
  }

  const GAME = {
    id: 'royale', order: 5, name: '名媛吃雞大作戰', tagline: '跳傘・撿槍・縮圈・吃雞', color: '#ff9a8b', color2: '#5b2350', badge: '槍戰',
    core: Core,
    art: api => `<img src="${api.player().full}" alt="" style="height:96%;left:44%;bottom:-6%;transform:translateX(-50%)"><span style="position:absolute;right:-4%;bottom:30%;width:74%;transform:rotate(-24deg);filter:drop-shadow(0 4px 6px rgba(40,10,30,.5))">${HERO_GUN}</span>`,
    open(api) { openRoyale(api); },
  };
  (window.ErikaGames = window.ErikaGames || []).push(GAME);
})();
