// 名媛對決 — 3v3 伸展台推塔對戰（MOBA）
// 結構：1. 純邏輯核心 Core（戰鬥模擬、AI、段位、成長、獎勵；不碰 DOM，可用 node 測試）
//       2. 畫面（大廳、選角、配對、VS、戰場 Canvas、大招特寫、結算）
'use strict';
(() => {
  /* =====================================================================
   * 1. 純邏輯核心
   * ===================================================================== */
  const Core = (() => {
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, t) => a + (b - a) * t;
    const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
    function rng(seed) {
      let a = (seed >>> 0) || 1;
      return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }

    // ---------- 地圖：直式單線伸展台，我方（team 0）在下、敵方（team 1）在上 ----------
    const MAP = { w: 340, h: 1900, l: 44, r: 296, cx: 170 };
    const FOUNT = [{ x: 170, y: 1856 }, { x: 170, y: 44 }];
    const STRUCTS = [
      { kind: 'crystal', team: 0, tier: 3, y: 1744, hp: 2700 },
      { kind: 'tower', team: 0, tier: 2, y: 1480, hp: 2300 },
      { kind: 'tower', team: 0, tier: 1, y: 1186, hp: 1800 },
      { kind: 'tower', team: 1, tier: 1, y: 714, hp: 1800 },
      { kind: 'tower', team: 1, tier: 2, y: 420, hp: 2300 },
      { kind: 'crystal', team: 1, tier: 3, y: 156, hp: 2700 },
    ];
    const fwd = t => (t === 0 ? -1 : 1); // 往敵方前進的 y 方向
    const WAVE_INT = 12;

    // ---------- 英雄 ----------
    const ROLE = { mage: '法師', support: '輔助', marksman: '射手', assassin: '刺客', control: '控場', tank: '坦克' };
    const HEROES = {
      erika: { ci: 0, role: 'mage', hp: 780, atk: 50, def: 12, range: 165, cd: 1.0, spd: 118, crit: 0, proj: 'star', back: 70, h: 78,
        rate: [2, 5, 2, 2], tag: '範圍魔法',
        skills: [
          { name: '星光爆裂', en: 'Starlight Burst', cd: 6, range: 210, icon: 'burst', desc: '在敵人最密集處引爆星光，造成範圍魔法傷害。' },
          { name: '粉晶射線', en: 'Quartz Ray', cd: 8, range: 270, icon: 'ray', desc: '射出貫穿光束，傷害並緩速一直線上的敵人。' },
          { name: '璀璨流星雨', en: 'Dazzling Starfall', ult: true, range: 260, icon: 'meteor', desc: '召喚三波流星雨轟炸大範圍區域，造成巨量魔法傷害。' },
        ] },
      vivi: { ci: 1, role: 'support', hp: 1150, atk: 64, def: 26, range: 150, cd: 1.0, spd: 118, crit: 0, proj: 'macaron', back: 82, h: 74,
        rate: [3, 2, 2, 3], tag: '治療護盾',
        skills: [
          { name: '馬卡龍治癒', en: 'Macaron Heal', cd: 6, range: 280, icon: 'heal', desc: '治療生命最低的隊友（也可以是自己）。' },
          { name: '糖霜護盾', en: 'Sugar Shield', cd: 10, range: 240, icon: 'shield', desc: '替周圍隊友套上可吸收傷害的糖霜護盾。' },
          { name: '下午茶盛宴', en: 'Grand Tea Party', ult: true, range: 440, icon: 'tea', desc: '大範圍治療全隊、解除控制，並提升攻速與移速。' },
        ] },
      vita: { ci: 2, role: 'marksman', hp: 800, atk: 53, def: 12, range: 190, cd: 0.72, spd: 118, crit: 0.18, proj: 'bolt', back: 86, h: 78,
        rate: [2, 5, 1, 3], tag: '遠程輸出',
        skills: [
          { name: '霓虹連射', en: 'Neon Barrage', cd: 7, range: 220, icon: 'barrage', desc: '瞬間連射四發電光彈，每一發都可能爆擊。' },
          { name: '電光閃步', en: 'Volt Step', cd: 9, range: 125, icon: 'dash', desc: '閃身位移一段距離，之後 3 秒攻速大幅提升。' },
          { name: '超載雷射炮', en: 'Overload Laser', ult: true, range: 560, icon: 'laser', desc: '蓄力後發射貫穿整條伸展台的雷射，無視部分防禦。' },
        ] },
      chiyo: { ci: 3, role: 'assassin', hp: 1100, atk: 86, def: 24, range: 42, cd: 0.8, spd: 128, crit: 0.15, proj: null, back: 30, h: 78,
        rate: [3, 5, 1, 5], tag: '突進爆發',
        skills: [
          { name: '影步突襲', en: 'Shadow Step', cd: 5, range: 240, icon: 'step', desc: '瞬間突進到敵人身邊斬擊，並使其緩速。' },
          { name: '千本櫻', en: 'Senbonzakura', cd: 7, range: 92, icon: 'petal', desc: '旋身揮出櫻花刃，傷害周圍所有敵人。' },
          { name: '財閥制裁', en: 'Tycoon Verdict', ult: true, range: 330, icon: 'verdict', desc: '閃現到敵方英雄背後處決，對方損失的生命越多，傷害越高。' },
        ] },
      shino: { ci: 4, role: 'control', hp: 920, atk: 56, def: 16, range: 160, cd: 1.05, spd: 116, crit: 0, proj: 'ink', back: 76, h: 80,
        rate: [2, 3, 5, 2], tag: '暈眩減速',
        skills: [
          { name: '墨韻束縛', en: 'Ink Bind', cd: 8, range: 230, icon: 'bind', desc: '擲出墨韻符咒，命中後暈眩敵人。' },
          { name: '書頁風暴', en: 'Page Storm', cd: 9, range: 210, icon: 'pages', desc: '書頁旋風造成範圍傷害，並大幅緩速敵人。' },
          { name: '千卷封印', en: 'Thousand Scrolls', ult: true, range: 240, icon: 'seal', desc: '展開封印法陣，大範圍暈眩並重創敵人。' },
        ] },
      fumi: { ci: 5, role: 'tank', hp: 1580, atk: 48, def: 34, range: 46, cd: 1.1, spd: 114, crit: 0, proj: null, back: 8, h: 84,
        rate: [5, 2, 4, 2], tag: '嘲諷吸收',
        skills: [
          { name: '管家禮儀', en: 'Butler Etiquette', cd: 9, range: 128, icon: 'bow', desc: '優雅一鞠躬，嘲諷周圍敵人，強迫他們攻擊自己。' },
          { name: '銀盤格擋', en: 'Silver Tray', cd: 10, range: 160, icon: 'tray', desc: '舉起銀盤獲得大量護盾，也替身旁隊友擋傷害。' },
          { name: '完美管家', en: 'Perfect Service', ult: true, range: 270, icon: 'charge', desc: '衝進敵陣暈眩一整片，之後 4 秒大幅減傷。' },
        ] },
    };
    const HERO_IDS = Object.keys(HEROES);
    const MINIONS = {
      fan: { name: '粉絲團', hp: 380, atk: 24, def: 8, range: 24, cd: 1.1, spd: 74, r: 10, xp: 22, siege: 1.4 },
      pap: { name: '狗仔隊', hp: 270, atk: 30, def: 4, range: 120, cd: 1.4, spd: 74, r: 10, xp: 22, siege: 1.3, proj: 'flash' },
      super: { name: '應援團長', hp: 950, atk: 46, def: 22, range: 30, cd: 1.3, spd: 70, r: 13, xp: 45, siege: 2.6 },
    };

    // ---------- 段位、成長、獎勵（純函式） ----------
    const TIERS = [
      { name: '青銅', en: 'BRONZE', stars: 3, coef: 1, c1: '#f0c39a', c2: '#9a5a32' },
      { name: '白銀', en: 'SILVER', stars: 3, coef: 1.25, c1: '#f4f7fb', c2: '#8d9ab0' },
      { name: '黃金', en: 'GOLD', stars: 4, coef: 1.5, c1: '#fff0b8', c2: '#c9962e' },
      { name: '白金', en: 'PLATINUM', stars: 4, coef: 1.9, c1: '#d8fff6', c2: '#3fa79a' },
      { name: '鑽石', en: 'DIAMOND', stars: 5, coef: 2.4, c1: '#e3f1ff', c2: '#4b7fe0' },
      { name: '星耀', en: 'STARLIGHT', stars: 5, coef: 3, c1: '#f2e3ff', c2: '#8a52d6' },
      { name: '傳說', en: 'LEGEND', stars: 5, coef: 4, c1: '#ffe3f0', c2: '#d6457a' },
    ];
    const LEGEND = TIERS.length - 1;
    // 贏 +1 星；滿星再贏晉級。輸 −1 星；0 星再輸降級（青銅不降級）。protect：MVP 保星
    function rankApply(r, win, protect) {
      let tier = clamp(Math.floor(r.tier) || 0, 0, LEGEND), stars = Math.max(0, Math.floor(r.stars) || 0);
      let promo = false, demo = false, kept = false;
      if (win) {
        stars++;
        if (tier < LEGEND && stars > TIERS[tier].stars) { tier++; stars = 1; promo = true; }
      } else if (protect) kept = true;
      else if (stars > 0) stars--;
      else if (tier > 0) { tier--; stars = TIERS[tier].stars - 1; demo = true; }
      return { tier, stars, promo, demo, kept };
    }
    const rankName = r => (r.tier >= LEGEND ? `${TIERS[LEGEND].name} ${r.stars}★` : TIERS[r.tier].name);
    const rankScore = r => { let s = 0; for (let i = 0; i < r.tier; i++) s += TIERS[i].stars + 1; return s + r.stars; };
    // 英雄等級／星等來自主程式共用名冊（lv 1–60、star 1–6）；這裡只負責換算成戰鬥倍率
    const LV_MAX = 60, STAR_MAX = 6;
    const growthMult = (lv, star) => (1 + 0.025 * (clamp(lv, 1, LV_MAX) - 1)) * (1 + 0.08 * (clamp(star, 1, STAR_MAX) - 1));
    const enemyMult = r => 1 + r.tier * 0.12 + Math.min(r.stars, 10) * 0.02;
    const enemySkill = r => clamp(0.35 + r.tier * 0.07 + Math.min(r.stars, 10) * 0.008, 0.35, 0.85);
    function rewards(o) {
      const coef = TIERS[clamp(o.tier | 0, 0, LEGEND)].coef;
      const r = o.rnd || Math.random;
      let coins = Math.round(o.bet * coef * (o.win ? 1 : 0.25) * (o.mvp ? 1.2 : 1));
      let shards = o.win ? 1 + Math.floor(r() * 3) : 1;           // 出場英雄碎片 1–3
      let ore = o.win ? Math.round((o.resUnit || 100) * 0.8) : 0; // 王國資源：寶石原石
      if (o.superMode) { coins *= 2; shards *= 2; ore *= 2; }
      return { coins, shards, ore };
    }
    const mvpScore = (h, winTeam) => h.k * 3 + h.a * 1.6 - h.d * 1.1 + h.heroDmg / 900 + h.heal / 700 + h.structDmg / 1300 + h.taken / 1600 + (h.team === winTeam ? 2 : 0);

    // ---------- 建立對局 ----------
    function makeUnit(S, o) {
      const u = Object.assign({
        id: S.nid++, alive: true, kind: 'minion', team: 0, x: 0, y: 0, r: 10, hp: 1, maxHp: 1, atk: 0, def: 0, range: 30, atkCd: 1, atkT: 0, spd: 60, crit: 0,
        shield: 0, shieldT: 0, stun: 0, slow: 0, slowT: 0, taunt: -1, tauntT: 0, untarget: 0, dr: 0, drT: 0, haste: 0, hasteT: 0, invul: false,
        tgt: -1, retarget: 0, flash: 0, face: 1, atkAnim: 0, castAnim: 0, moving: false, combatT: -99, aggroT: -99, aggroV: -1, ramp: 0, born: S.t,
      }, o);
      S.units.push(u); S.byId.set(u.id, u);
      return u;
    }
    function newMatch(o) {
      const S = {
        t: 0, rnd: rng(o.seed || 1), units: [], byId: new Map(), projs: [], zones: [], events: [], nid: 1,
        waveT: 3, wave: 0, score: [0, 0], morale: [0, 0], over: false, winner: -1, endT: 0, first: false, phase: 0, structMult: 1,
        playerId: -1, auto: !!o.auto, coach: !!o.coach, superMode: !!o.superMode, heroes: [[], []], heroList: [],
      };
      for (const sd of STRUCTS) {
        const cr = sd.kind === 'crystal';
        makeUnit(S, { kind: sd.kind, team: sd.team, tier: sd.tier, x: MAP.cx, y: sd.y, r: cr ? 30 : 22, hp: sd.hp, maxHp: sd.hp, atk: cr ? 150 : 165, def: 30, range: cr ? 175 : 182, atkCd: 1, spd: 0 });
      }
      const mk = (hid, team, slot, mult, skill, isPlayer) => {
        const H = HEROES[hid];
        const base = { hp: H.hp * mult, atk: H.atk * mult * (team === 0 ? o.allyAtk || 1 : 1), def: H.def * Math.sqrt(mult) };
        const f = FOUNT[team];
        const u = makeUnit(S, {
          kind: 'hero', hid, team, slot, x: f.x + (slot - 1) * 30, y: f.y, r: 13, base, hp: base.hp, maxHp: base.hp, atk: base.atk, def: base.def,
          range: H.range, atkCd: H.cd, spd: H.spd, crit: H.crit, proj: H.proj, face: team === 0 ? 1 : -1,
          lvl: 1, xp: 0, cds: [0, 0], energy: 20, k: 0, d: 0, a: 0, dmg: 0, heroDmg: 0, taken: 0, heal: 0, structDmg: 0, multi: 0, lastKill: -99,
          respawn: 0, revives: 0, hitBy: {}, buffBy: {}, recall: 0, dash: null, chan: null, burst: null,
          ai: { skill, th: S.rnd() * 0.3, mode: 'push', tgt: -1, pos: null }, isPlayer,
        });
        S.heroes[team].push(u); S.heroList.push(u);
        return u;
      };
      o.ally.forEach((h, i) => {
        const u = mk(h, 0, i, (o.allyMult ? o.allyMult[i] : 1) * (S.superMode ? 1.3 : 1) * (i === 0 && S.coach ? 1.12 : 1), i === 0 ? (S.coach ? 1 : 0.6) : (o.allyAI ?? 0.55), i === 0);
        if (i === 0) { S.playerId = u.id; if (S.superMode) u.revives = 1; }
      });
      o.enemy.forEach((h, i) => mk(h, 1, i, o.enemyMult ? o.enemyMult[i] : 1, o.enemyAI ?? 0.55, false));
      refreshInvul(S);
      return S;
    }
    function refreshInvul(S) {
      for (const team of [0, 1]) {
        const own = S.units.filter(u => u.team === team && (u.kind === 'tower' || u.kind === 'crystal'));
        const t1 = own.find(u => u.tier === 1), t2 = own.find(u => u.tier === 2), cr = own.find(u => u.kind === 'crystal');
        if (t2) t2.invul = !!(t1 && t1.alive);
        if (cr) cr.invul = !!((t1 && t1.alive) || (t2 && t2.alive));
      }
    }
    const player = S => S.byId.get(S.playerId);
    const isStruct = u => u.kind === 'tower' || u.kind === 'crystal';

    // ---------- 經驗與等級 ----------
    const LVL_MAX = 12;
    const xpNeed = lv => 70 + lv * 45;
    function gainXp(S, u, n) {
      if (u.lvl >= LVL_MAX) return;
      u.xp += n;
      while (u.lvl < LVL_MAX && u.xp >= xpNeed(u.lvl)) {
        u.xp -= xpNeed(u.lvl); u.lvl++;
        const m = 1 + 0.075 * (u.lvl - 1), oldMax = u.maxHp;
        u.maxHp = u.base.hp * m; u.atk = u.base.atk * m; u.def = u.base.def * (1 + 0.03 * (u.lvl - 1));
        if (u.alive) u.hp = Math.min(u.maxHp, u.hp + (u.maxHp - oldMax));
        S.events.push({ t: 'lvl', id: u.id, lvl: u.lvl });
      }
    }

    // ---------- 狀態 ----------
    function tickStatus(S, u, dt) {
      if (u.atkT > 0) u.atkT -= dt;
      if (u.stun > 0) u.stun -= dt;
      if (u.slowT > 0) { u.slowT -= dt; if (u.slowT <= 0) u.slow = 0; }
      if (u.tauntT > 0) { u.tauntT -= dt; if (u.tauntT <= 0) u.taunt = -1; }
      if (u.shieldT > 0) { u.shieldT -= dt; if (u.shieldT <= 0) u.shield = 0; }
      if (u.drT > 0) { u.drT -= dt; if (u.drT <= 0) u.dr = 0; }
      if (u.hasteT > 0) { u.hasteT -= dt; if (u.hasteT <= 0) u.haste = 0; }
      if (u.untarget > 0) u.untarget -= dt;
      if (u.flash > 0) u.flash -= dt;
      if (u.atkAnim > 0) u.atkAnim -= dt;
      if (u.castAnim > 0) u.castAnim -= dt;
      if (u.kind !== 'hero') return;
      if (u.cds[0] > 0) u.cds[0] -= dt;
      if (u.cds[1] > 0) u.cds[1] -= dt;
      u.energy = Math.min(100, u.energy + dt * 1.0);
      gainXp(S, u, dt * 3);
      const f = FOUNT[u.team];
      if (d2(u, f) < 140 * 140) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.16 * dt); u.energy = Math.min(100, u.energy + dt * 5); }
      else if (S.t - u.combatT > 5) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.012 * dt);
      const ef = FOUNT[1 - u.team];
      if (d2(u, ef) < 150 * 150) damage(S, null, u, 700 * dt, 'true', { silent: true, fountain: true });
    }
    function applyStun(S, t, s) {
      if (!t.alive || isStruct(t) || t.dash || t.untarget > 0) return;
      t.stun = Math.max(t.stun, s); t.recall = 0; t.burst = null; t.moving = false;
      S.events.push({ t: 'cc', id: t.id, k: 'stun', d: s });
    }
    function applySlow(t, s, d) { if (!t.alive || isStruct(t)) return; t.slow = Math.max(t.slow, s); t.slowT = Math.max(t.slowT, d); }

    // ---------- 傷害、治療、擊殺 ----------
    function damage(S, src, t, amt, kind, o = {}) {
      if (!t.alive || (t.untarget > 0 && !o.fountain)) return 0;
      if (t.invul) { if (src && src.kind === 'hero' && !o.silent) S.events.push({ t: 'immune', id: t.id, src: src.id }); return 0; }
      let d = amt;
      if (kind !== 'true') d *= 100 / (100 + t.def * (1 - (o.pen || 0)));
      if (t.dr > 0) d *= 1 - t.dr;
      if (isStruct(t)) d *= S.structMult * (src && src.kind === 'hero' ? 1.5 : 1);
      if (!o.fountain) d *= 0.93 + S.rnd() * 0.14;
      let ab = 0;
      if (t.shield > 0) { ab = Math.min(t.shield, d); t.shield -= ab; d -= ab; }
      t.hp -= d; t.flash = 0.14; t.combatT = S.t;
      const tot = d + ab;
      if (t.kind === 'hero') {
        t.taken += tot;
        t.energy = Math.min(100, t.energy + tot / t.maxHp * 22);
        if (t.recall > 0) { t.recall = 0; S.events.push({ t: 'recallStop', id: t.id }); }
        if (src && src.kind === 'hero') t.hitBy[src.id] = S.t;
      }
      if (src) {
        src.combatT = S.t;
        if (src.kind === 'hero') {
          src.dmg += tot;
          if (t.kind === 'hero') { src.heroDmg += tot; src.aggroT = S.t + 1.6; src.aggroV = t.id; }
          else if (isStruct(t)) src.structDmg += tot;
        }
      }
      if (!o.silent) S.events.push({ t: 'dmg', id: t.id, src: src ? src.id : 0, n: tot, crit: !!o.crit, k: kind, x: t.x, y: t.y, sk: !o.basic });
      if (t.hp <= 0) kill(S, t, src);
      return tot;
    }
    function hit(S, src, t, amt, kind, o = {}) {
      if (!t || !t.alive) return 0;
      const n = damage(S, src, t, amt, kind, o);
      if (!t.alive) return n;
      if (o.stun) applyStun(S, t, o.stun);
      if (o.slow) applySlow(t, o.slow, o.slowT || 1.5);
      if (src && src.kind === 'hero' && src.alive) src.energy = Math.min(100, src.energy + (t.kind === 'hero' ? (o.basic ? 2.4 : 1.8) : (o.basic ? 0.6 : 0.3)));
      return n;
    }
    function healUnit(S, src, a, n) {
      if (!a.alive) return;
      const v = Math.min(n, a.maxHp - a.hp);
      a.hp += v;
      if (src) { src.heal += v; if (src !== a) a.buffBy[src.id] = S.t; }
      S.events.push({ t: 'heal', id: a.id, n: v, src: src ? src.id : 0 });
    }
    function giveShield(S, src, a, n, dur) {
      if (!a.alive) return;
      a.shield = Math.max(a.shield, n); a.shieldT = Math.max(a.shieldT, dur);
      if (src) { src.heal += n * 0.5; if (src !== a) a.buffBy[src.id] = S.t; }
      S.events.push({ t: 'shield', id: a.id, n, src: src ? src.id : 0 });
    }
    function respawnTime(S, v) {
      let t = Math.min(20, 5.5 + v.lvl * 1.3);
      if (S.superMode && v.team === 0) t *= 0.5;
      if (S.t > 150) t *= S.phase >= 5 ? 1.9 : 1.4;
      return t;
    }
    function kill(S, v, src) {
      v.alive = false; v.hp = 0; v.shield = 0; v.dash = null; v.chan = null; v.burst = null; v.recall = 0; v.stun = 0; v.slow = 0;
      if (v.kind === 'minion') {
        for (const h of S.heroes[1 - v.team]) if (h.alive && d2(h, v) < 340 * 340) gainXp(S, h, v.xp);
        S.events.push({ t: 'die', id: v.id, x: v.x, y: v.y, kind: 'minion', mk: v.mk, team: v.team, src: src ? src.id : 0 });
        return;
      }
      if (isStruct(v)) {
        for (const h of S.heroes[1 - v.team]) gainXp(S, h, 80);
        S.morale[1 - v.team]++; // 推倒建築：該隊之後的粉絲團士氣大振
        refreshInvul(S);
        S.events.push({ t: 'struct', id: v.id, team: v.team, kind: v.kind, tier: v.tier, by: src ? src.id : 0, x: v.x, y: v.y });
        if (v.kind === 'crystal' && !S.over) { S.over = true; S.winner = 1 - v.team; S.endT = S.t; S.events.push({ t: 'end', winner: S.winner, why: 'crystal', id: v.id }); }
        return;
      }
      // 英雄
      v.d++;
      let killer = src && src.kind === 'hero' && src.team !== v.team ? src : null;
      const recent = [];
      for (const k in v.hitBy) { if (S.t - v.hitBy[k] < 9) { const h = S.byId.get(+k); if (h && h.team !== v.team) recent.push(h); } }
      if (!killer && recent.length) killer = recent.sort((a, b) => v.hitBy[b.id] - v.hitBy[a.id])[0];
      const assists = new Set(recent.filter(h => h !== killer));
      if (killer) for (const k in killer.buffBy) if (S.t - killer.buffBy[k] < 8) { const h = S.byId.get(+k); if (h && h !== killer && h.team === killer.team) assists.add(h); }
      v.hitBy = {};
      let multi = 0, first = false;
      S.score[1 - v.team]++;
      if (killer) {
        killer.k++;
        multi = killer.multi = S.t - killer.lastKill < 12 ? killer.multi + 1 : 1;
        killer.lastKill = S.t;
        gainXp(S, killer, 70 + 12 * v.lvl);
        killer.energy = Math.min(100, killer.energy + 10);
      }
      if (!S.first) { S.first = true; first = true; }
      for (const a of assists) { a.a++; gainXp(S, a, 40); }
      const ace = S.heroes[v.team].every(h => !h.alive);
      v.respawn = respawnTime(S, v);
      S.events.push({ t: 'kill', killer: killer ? killer.id : 0, victim: v.id, assists: [...assists].map(h => h.id), first, multi, ace, x: v.x, y: v.y, src: src ? src.id : 0, srcKind: src ? src.kind : 'fountain', team: v.team });
    }
    function respawn(S, u, inPlace) {
      const f = FOUNT[u.team];
      u.alive = true; u.hp = inPlace ? u.maxHp * 0.7 : u.maxHp; u.shield = 0; u.stun = 0; u.slow = 0; u.taunt = -1; u.respawn = 0;
      u.untarget = inPlace ? 1.2 : 0; u.dash = null; u.chan = null; u.burst = null; u.recall = 0; u.ai.mode = 'push'; u.ai.th = 0;
      if (!inPlace) { u.x = f.x + (u.slot - 1) * 30; u.y = f.y; }
      S.events.push({ t: 'respawn', id: u.id, inPlace: !!inPlace });
    }
    function revive(S, u) { if (u && !u.alive && !S.over) { respawn(S, u, true); return true; } return false; }

    // ---------- 移動 ----------
    function speedOf(S, u) {
      let s = u.spd * (1 - u.slow);
      if (u.kind === 'hero') { if (S.t - u.combatT > 3) s *= 1.45; if (u.hasteT > 0) s *= 1 + u.haste * 0.5; }
      return s;
    }
    const clampPos = u => { u.x = clamp(u.x, MAP.l, MAP.r); u.y = clamp(u.y, 20, MAP.h - 20); };
    function moveToward(S, u, tx, ty, dt, stopAt = 0) {
      const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
      if (d <= stopAt + 0.5) { u.moving = false; return true; }
      const st = Math.min(d - stopAt, speedOf(S, u) * dt);
      u.x += dx / d * st; u.y += dy / d * st; u.moving = true;
      if (Math.abs(dx) > 2) u.face = dx > 0 ? 1 : -1;
      clampPos(u);
      return false;
    }
    function moveDir(S, u, mx, my, dt) {
      const m = Math.hypot(mx, my); if (m < 0.01) { u.moving = false; return; }
      const st = speedOf(S, u) * dt * Math.min(1, m);
      u.x += mx / m * st; u.y += my / m * st; u.moving = true;
      if (Math.abs(mx) > 0.15) u.face = mx > 0 ? 1 : -1;
      clampPos(u);
    }
    function dashTo(u, tx, ty, spd, then) {
      u.dash = { tx: clamp(tx, MAP.l, MAP.r), ty: clamp(ty, 24, MAP.h - 24), spd, then, sx: u.x, sy: u.y };
      if (Math.abs(tx - u.x) > 2) u.face = tx > u.x ? 1 : -1;
      u.recall = 0; u.moving = true;
    }
    function stepDash(S, u, dt) {
      const d = u.dash, dx = d.tx - u.x, dy = d.ty - u.y, dd = Math.hypot(dx, dy), st = d.spd * dt;
      if (dd <= st) { u.x = d.tx; u.y = d.ty; u.dash = null; u.moving = false; if (d.then) d.then(); }
      else { u.x += dx / dd * st; u.y += dy / dd * st; }
    }
    function separate(S) {
      const U = S.units, n = U.length;
      for (let i = 0; i < n; i++) {
        const a = U[i]; if (!a.alive || a.dash) continue;
        const sa = isStruct(a);
        for (let j = i + 1; j < n; j++) {
          const b = U[j]; if (!b.alive || b.dash) continue;
          const sb = isStruct(b); if ((sa || sb) && (sa && sb || a.team === b.team)) continue; // 自己的建築可以穿過
          let dx = b.x - a.x, dy = b.y - a.y; const rr = (a.r + b.r) * 0.92; let dd = dx * dx + dy * dy;
          if (dd >= rr * rr) continue;
          if (dd < 0.01) { dx = (S.rnd() - 0.5); dy = (S.rnd() - 0.5); dd = dx * dx + dy * dy; }
          const d = Math.sqrt(dd), push = (rr - d) / d;
          if (sa) { b.x += dx * push; b.y += dy * push; }
          else if (sb) { a.x -= dx * push; a.y -= dy * push; }
          else {
            const wa = a.kind === 'hero' && b.kind !== 'hero' ? 0.25 : b.kind === 'hero' && a.kind !== 'hero' ? 0.75 : 0.5;
            a.x -= dx * push * wa; a.y -= dy * push * wa; b.x += dx * push * (1 - wa); b.y += dy * push * (1 - wa);
          }
        }
      }
      for (const u of U) if (u.alive && !isStruct(u)) clampPos(u);
    }

    // ---------- 普攻 ----------
    function inRange(u, t, extra = 0) { const r = u.range + t.r + u.r * 0.5 + extra; return d2(u, t) <= r * r; }
    function engage(S, u, t, dt, chase = true) {
      if (inRange(u, t)) {
        u.moving = false;
        if (Math.abs(t.x - u.x) > 2) u.face = t.x > u.x ? 1 : -1;
        if (u.atkT <= 0) basicAttack(S, u, t);
        return true;
      }
      if (chase) moveToward(S, u, t.x, t.y, dt, u.range + t.r * 0.8);
      return false;
    }
    function basicAttack(S, u, t) {
      u.atkT = u.atkCd / (1 + (u.hasteT > 0 ? u.haste : 0));
      u.atkAnim = 0.2;
      const crit = u.crit > 0 && S.rnd() < u.crit;
      let dmg = u.atk * (crit ? 1.75 : 1);
      if (u.kind === 'minion' && isStruct(t)) dmg *= u.siege || 1;
      const kind = u.kind === 'hero' && (u.hid === 'erika' || u.hid === 'vivi' || u.hid === 'shino') ? 'magic' : 'phys';
      if (u.proj) S.projs.push({ x: u.x, y: u.y, z: u.kind === 'hero' ? 40 : 18, tid: t.id, tx: t.x, ty: t.y, spd: u.kind === 'hero' ? 560 : 420, dmg, kind, src: u.id, team: u.team, fx: u.proj, crit, basic: true });
      else hit(S, u, t, dmg, kind, { crit, basic: true });
    }
    function stepProjs(S, dt) {
      for (let i = S.projs.length - 1; i >= 0; i--) {
        const p = S.projs[i], t = S.byId.get(p.tid);
        if (t && t.alive) { p.tx = t.x; p.ty = t.y; }
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), st = p.spd * dt;
        p.age = (p.age || 0) + dt;
        if (d <= st + 4) {
          S.projs.splice(i, 1);
          if (t && t.alive) hit(S, S.byId.get(p.src) || null, t, p.dmg, p.kind, p);
          S.events.push({ t: 'impact', x: p.tx, y: p.ty, fx: p.fx, team: p.team, crit: p.crit });
          continue;
        }
        p.x += dx / d * st; p.y += dy / d * st; p.ang = Math.atan2(dy, dx);
      }
    }
    function stepZones(S, dt) {
      for (let i = S.zones.length - 1; i >= 0; i--) {
        const z = S.zones[i]; z.t += dt;
        while (z.hi < z.hits.length && z.t >= z.hits[z.hi]) {
          z.hi++;
          const src = S.byId.get(z.src) || null;
          S.events.push({ t: 'zhit', fx: z.fx, x: z.x, y: z.y, r: z.r, team: z.team, n: z.hi, src: z.src });
          for (const e of S.units) if (e.alive && e.team !== z.team && d2(e, z) <= (z.r + e.r) * (z.r + e.r)) hit(S, src, e, z.dmg, z.kind, z);
        }
        if (z.hi >= z.hits.length && z.t >= (z.life || 0)) S.zones.splice(i, 1);
      }
    }
    function zone(u, x, y, r, hits, dmg, kind, fx, o = {}) {
      return Object.assign({ x: clamp(x, MAP.l, MAP.r), y, r, hits, hi: 0, t: 0, dmg, kind, fx, src: u.id, team: u.team, life: 0 }, o);
    }
    function segDist(px, py, x1, y1, x2, y2) {
      const vx = x2 - x1, vy = y2 - y1, l2 = vx * vx + vy * vy;
      const t = l2 ? clamp(((px - x1) * vx + (py - y1) * vy) / l2, 0, 1) : 0;
      return Math.hypot(px - (x1 + vx * t), py - (y1 + vy * t));
    }
    function beam(S, u, ang, len, w, dmg, kind, o) {
      const x2 = u.x + Math.cos(ang) * len, y2 = u.y + Math.sin(ang) * len;
      S.events.push({ t: 'beam', id: u.id, x1: u.x, y1: u.y, x2, y2, w, fx: o.fx, team: u.team });
      for (const e of S.units) if (e.alive && e.team !== u.team && segDist(e.x, e.y, u.x, u.y, x2, y2) <= w / 2 + e.r) hit(S, u, e, dmg, kind, o);
    }

    // ---------- 目標搜尋 ----------
    const hittable = (u, e) => e.alive && e.team !== u.team && e.untarget <= 0 && !e.invul;
    function nearest(S, u, r, kinds) { // kinds: 'hero' | 'unit'（英雄＋小兵）| 'any'
      let best = null, bd = 1e12;
      for (const e of S.units) {
        if (!hittable(u, e)) continue;
        if (kinds === 'hero' && e.kind !== 'hero') continue;
        if (kinds === 'unit' && isStruct(e)) continue;
        const dd = d2(u, e); if (dd > (r + e.r) * (r + e.r)) continue;
        const s = dd + (e.kind === 'hero' ? 0 : 900);
        if (s < bd) { bd = s; best = e; }
      }
      return best;
    }
    function lowestHero(S, u, r) {
      let best = null;
      for (const e of S.heroes[1 - u.team]) if (hittable(u, e) && d2(u, e) <= (r + e.r) * (r + e.r) && (!best || e.hp < best.hp)) best = e;
      return best;
    }
    function enemiesIn(S, u, x, y, r) {
      const out = [];
      for (const e of S.units) if (hittable(u, e) && (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) <= (r + e.r) * (r + e.r)) out.push(e);
      return out;
    }
    function alliesIn(S, u, x, y, r) { return S.heroes[u.team].filter(a => a.alive && (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y) <= r * r); }
    function cluster(S, u, range, rad) {
      let best = null;
      for (const c of S.units) {
        if (!hittable(u, c) || d2(u, c) > (range + c.r) * (range + c.r)) continue;
        let n = 0, h = 0, low = 0, sx = 0, sy = 0, sw = 0;
        for (const e of S.units) {
          if (!hittable(u, e) || d2(c, e) > (rad + e.r) * (rad + e.r)) continue;
          const w = e.kind === 'hero' ? 3 : isStruct(e) ? 0.5 : 1;
          if (e.kind === 'hero') { h++; if (e.hp < e.maxHp * 0.4) low++; } else if (e.kind === 'minion') n++;
          sx += e.x * w; sy += e.y * w; sw += w;
        }
        const score = h * 3 + n + low + (isStruct(c) ? 0.5 : 0);
        if (!best || score > best.score) best = { x: sx / sw, y: sy / sw, score, heroes: h, count: n + h, unit: c };
      }
      return best;
    }
    function enemyTowerCovering(S, team, x, y, pad = 0) {
      for (const s of S.units) if (s.alive && s.team !== team && isStruct(s) && (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) <= (s.range + pad) * (s.range + pad)) return s;
      return null;
    }
    function structSafe(S, u, s) {
      if (!s || !s.alive) return true;
      if (s.hp < s.maxHp * 0.1) return true;
      if (advantage(S, u) && u.hp > u.maxHp * 0.45) return true; // 人數優勢時可以強拆
      const t = S.byId.get(s.tgt);
      let minions = 0;
      for (const m of S.units) if (m.alive && m.kind === 'minion' && m.team === u.team && d2(m, s) < (s.range + 14) * (s.range + 14)) minions++;
      return minions >= 1 && !(t && t.id === u.id);
    }
    // 人數優勢：對方全倒，或我方活著的英雄比對方多 2 個以上
    function advantage(S, u) {
      const foes = S.heroes[1 - u.team].filter(h => h.alive).length, mine = S.heroes[u.team].filter(h => h.alive).length;
      return foes === 0 || mine - foes >= 2;
    }
    function frontEnemyStruct(S, team) {
      let best = null; const fw = fwd(team);
      for (const s of S.units) if (s.alive && s.team !== team && isStruct(s) && (!best || (best.y - s.y) * fw > 0)) best = s;
      return best;
    }

    // ---------- 技能 ----------
    const ready = (u, i) => (i === 2 ? u.energy >= 100 : u.cds[i] <= 0);
    function skillTarget(S, u, i, strict, input) {
      const H = HEROES[u.hid], R = H.skills[i].range;
      const P = e => (e ? { x: e.x, y: e.y, unit: e } : null);
      const safe = (x, y) => { const tw = enemyTowerCovering(S, u.team, x, y); return !tw || structSafe(S, u, tw) || !strict; };
      switch (u.hid + i) {
        case 'erika0': case 'shino1': {
          const c = cluster(S, u, R, u.hid === 'erika' ? 72 : 98);
          if (!c || (strict && !(c.heroes >= 1 || c.count >= 3))) return null;
          return c;
        }
        case 'erika2': case 'shino2': case 'fumi2': {
          const rad = u.hid === 'erika' ? 128 : u.hid === 'shino' ? 145 : 132;
          const c = cluster(S, u, R, rad);
          if (!c) return null;
          if (strict) {
            if (c.heroes === 0) return null;
            // 技巧低的 AI 偶爾會錯過時機；技巧高的會等敵人進到範圍中心
            if (u.ai.skill < 0.5 && c.heroes < 2 && S.rnd() < 0.5) return null;
            if (u.hid === 'fumi' && !safe(c.x, c.y) && c.heroes < 2) return null;
          }
          return c;
        }
        case 'erika1': {
          const t = nearest(S, u, R, 'hero') || (strict ? null : nearest(S, u, R, 'any'));
          if (!t) { if (!strict) return null; const c = cluster(S, u, R, 40); return c && c.count >= 3 ? c : null; }
          return P(t);
        }
        case 'vita0': {
          const t = nearest(S, u, R, 'hero') || (strict ? (() => { const s = nearest(S, u, R, 'any'); return s && isStruct(s) ? s : null; })() : nearest(S, u, R, 'any'));
          return P(t);
        }
        case 'shino0': return P(nearest(S, u, R, 'hero') || (strict ? null : nearest(S, u, R, 'unit')));
        case 'vita2': {
          const t = lowestHero(S, u, R) || (strict ? null : nearest(S, u, R, 'any'));
          if (!t) return null;
          if (strict && !(t.hp < t.maxHp * 0.8)) {
            const ang = Math.atan2(t.y - u.y, t.x - u.x), x2 = u.x + Math.cos(ang) * 600, y2 = u.y + Math.sin(ang) * 600;
            if (S.heroes[1 - u.team].filter(e => hittable(u, e) && segDist(e.x, e.y, u.x, u.y, x2, y2) < 40).length < 2) return null;
          }
          return P(t);
        }
        case 'chiyo0': {
          const t = lowestHero(S, u, R) || (strict ? null : nearest(S, u, R, 'unit'));
          if (!t) return null;
          if (strict && (!safe(t.x, t.y) && t.hp > t.maxHp * 0.3)) return null;
          if (strict && t.hp > t.maxHp * 0.75 && u.hp < u.maxHp * 0.5) return null;
          return P(t);
        }
        case 'chiyo2': {
          const t = lowestHero(S, u, R);
          if (!t) return null;
          if (strict && !(t.hp < t.maxHp * 0.55 || t.hp < 3.0 * u.atk * 1.1 + (t.maxHp - t.hp) * 0.28)) return null;
          if (strict && !safe(t.x, t.y) && t.hp > t.maxHp * 0.25) return null;
          return P(t);
        }
        case 'chiyo1': {
          const es = enemiesIn(S, u, u.x, u.y, R);
          if (strict && !(es.some(e => e.kind === 'hero') || es.filter(e => e.kind === 'minion').length >= 3)) return null;
          return { x: u.x, y: u.y };
        }
        case 'fumi0': {
          const es = enemiesIn(S, u, u.x, u.y, R);
          if (strict && !es.some(e => e.kind === 'hero')) return null;
          return { x: u.x, y: u.y };
        }
        case 'fumi1': {
          if (strict && !(u.hp < u.maxHp * 0.8 && S.t - u.combatT < 1.2)) return null;
          return { x: u.x, y: u.y };
        }
        case 'vivi0': {
          let a = null;
          for (const h of alliesIn(S, u, u.x, u.y, R)) if (!a || h.hp / h.maxHp < a.hp / a.maxHp) a = h;
          if (!a) a = u;
          if (strict && a.hp > a.maxHp * 0.7) return null;
          return P(a);
        }
        case 'vivi1': {
          if (strict) {
            const hurt = alliesIn(S, u, u.x, u.y, R).filter(a => S.t - a.combatT < 1 && a.hp < a.maxHp * 0.85);
            if (!hurt.length || !S.heroes[1 - u.team].some(e => e.alive && d2(e, u) < 360 * 360)) return null;
          }
          return { x: u.x, y: u.y };
        }
        case 'vivi2': {
          if (strict) {
            const al = alliesIn(S, u, u.x, u.y, R);
            const miss = al.reduce((s, a) => s + (1 - a.hp / a.maxHp), 0);
            if (!(miss > 0.9 || al.some(a => a.hp < a.maxHp * 0.3 && S.t - a.combatT < 2))) return null;
          }
          return { x: u.x, y: u.y };
        }
        case 'vita1': {
          let ang;
          const near = nearest(S, u, 300, 'hero');
          if (input && input.move && Math.hypot(input.move.x, input.move.y) > 0.2) ang = Math.atan2(input.move.y, input.move.x);
          else if (near && d2(u, near) < 130 * 130) ang = Math.atan2(u.y - near.y, u.x - near.x);
          else if (strict) {
            const low = lowestHero(S, u, u.range + 120);
            if (low && low.hp < low.maxHp * 0.35 && u.hp > u.maxHp * 0.5 && !inRange(u, low)) ang = Math.atan2(low.y - u.y, low.x - u.x);
            else if (u.hp < u.maxHp * 0.4 && near) ang = Math.atan2(u.y - near.y, u.x - near.x);
            else return null;
          } else ang = fwd(u.team) > 0 ? -Math.PI / 2 : Math.PI / 2;
          return { x: u.x + Math.cos(ang) * R, y: u.y + Math.sin(ang) * R, ang };
        }
      }
      return null;
    }
    function castSkill(S, u, i, tg) {
      const A = u.atk;
      if (i === 2) { u.energy = 0; S.events.push({ t: 'ult', id: u.id, team: u.team }); } else u.cds[i] = HEROES[u.hid].skills[i].cd;
      u.castAnim = 0.35; u.recall = 0; u.combatT = Math.max(u.combatT, S.t - 2);
      if (Math.abs(tg.x - u.x) > 3) u.face = tg.x > u.x ? 1 : -1;
      const ang = Math.atan2(tg.y - u.y, tg.x - u.x);
      S.events.push({ t: 'cast', id: u.id, i, x: tg.x, y: tg.y, tid: tg.unit ? tg.unit.id : 0, ang });
      switch (u.hid + i) {
        case 'erika0': S.zones.push(zone(u, tg.x, tg.y, 72, [0.28], 1.45 * A, 'magic', 'burst')); break;
        case 'erika1': beam(S, u, ang, 300, 40, 2.0 * A, 'magic', { slow: 0.3, slowT: 1.5, fx: 'quartz' }); break;
        case 'erika2': S.zones.push(zone(u, tg.x, tg.y, 128, [0.5, 0.9, 1.3], 1.25 * A, 'magic', 'meteor', { life: 1.4 })); break;
        case 'vivi0': { const a = tg.unit || u; healUnit(S, u, a, a.maxHp * 0.12 + 2.2 * A); break; }
        case 'vivi1': for (const a of alliesIn(S, u, u.x, u.y, 240)) giveShield(S, u, a, a.maxHp * 0.1 + 1.9 * A, 3.5); S.events.push({ t: 'aura', id: u.id, fx: 'sugar', r: 240 }); break;
        case 'vivi2':
          for (const a of alliesIn(S, u, u.x, u.y, 440)) { healUnit(S, u, a, a.maxHp * 0.25 + 2.6 * A); a.stun = 0; a.slow = 0; a.slowT = 0; a.taunt = -1; a.haste = 0.3; a.hasteT = 4; }
          S.events.push({ t: 'aura', id: u.id, fx: 'tea', r: 440 }); break;
        case 'vita0': u.burst = { n: 4, t: 0, tid: tg.unit.id, dmg: 0.8 * A }; break;
        case 'vita1': dashTo(u, tg.x, tg.y, 900, () => { u.haste = 0.6; u.hasteT = 3; u.atkT = 0; }); break;
        case 'vita2': u.chan = { t: 0.42, fn: () => beam(S, u, ang, 600, 56, 4.0 * u.atk, 'phys', { pen: 0.3, fx: 'laser' }) }; S.events.push({ t: 'charge', id: u.id, ang }); break;
        case 'chiyo0': {
          const t = tg.unit, a2 = Math.atan2(u.y - t.y, u.x - t.x);
          dashTo(u, t.x + Math.cos(a2) * 18, t.y + Math.sin(a2) * 18, 950, () => { if (t.alive) hit(S, u, t, 2.2 * u.atk, 'phys', { slow: 0.3, slowT: 1.2 }); S.events.push({ t: 'slash', id: u.id, x: t.x, y: t.y }); });
          break;
        }
        case 'chiyo1': S.events.push({ t: 'zhit', fx: 'petal', x: u.x, y: u.y, r: 92, team: u.team, src: u.id }); for (const e of enemiesIn(S, u, u.x, u.y, 92)) hit(S, u, e, 1.7 * A, 'phys'); break;
        case 'chiyo2': {
          const t = tg.unit, side = t.x > MAP.cx ? -1 : 1;
          u.x = clamp(t.x + side * 22, MAP.l, MAP.r); u.y = t.y + fwd(u.team) * 6; u.untarget = 0.6; u.face = t.x > u.x ? 1 : -1;
          S.events.push({ t: 'slash', id: u.id, x: t.x, y: t.y, big: true });
          hit(S, u, t, 3.0 * A + (t.maxHp - t.hp) * 0.28, 'phys', { pen: 0.2 });
          break;
        }
        case 'shino0': S.projs.push({ x: u.x, y: u.y, z: 40, tid: tg.unit.id, tx: tg.x, ty: tg.y, spd: 600, dmg: 1.4 * A, kind: 'magic', src: u.id, team: u.team, fx: 'talisman', stun: 1.1 }); break;
        case 'shino1': S.zones.push(zone(u, tg.x, tg.y, 98, [0.25], 1.5 * A, 'magic', 'pages', { slow: 0.45, slowT: 2 })); break;
        case 'shino2': S.zones.push(zone(u, tg.x, tg.y, 145, [0.55], 2.7 * A, 'magic', 'seal', { stun: 1.7, life: 1 })); break;
        case 'fumi0':
          S.events.push({ t: 'zhit', fx: 'taunt', x: u.x, y: u.y, r: 128, team: u.team, src: u.id });
          for (const e of enemiesIn(S, u, u.x, u.y, 128)) { if (isStruct(e)) continue; hit(S, u, e, 1.4 * A, 'phys'); if (e.alive && !e.dash) { e.taunt = u.id; e.tauntT = 1.5; e.tgt = u.id; e.recall = 0; } }
          u.dr = Math.max(u.dr, 0.2); u.drT = Math.max(u.drT, 2); break;
        case 'fumi1':
          giveShield(S, u, u, u.maxHp * 0.2 + A, 4);
          for (const a of alliesIn(S, u, u.x, u.y, 160)) if (a !== u) giveShield(S, u, a, a.maxHp * 0.07, 3);
          S.events.push({ t: 'aura', id: u.id, fx: 'tray', r: 160 }); break;
        case 'fumi2':
          dashTo(u, tg.x, tg.y, 760, () => {
            S.events.push({ t: 'zhit', fx: 'slam', x: u.x, y: u.y, r: 132, team: u.team, src: u.id });
            for (const e of enemiesIn(S, u, u.x, u.y, 132)) hit(S, u, e, 2.3 * u.atk, 'phys', { stun: 1.4 });
            u.dr = 0.45; u.drT = 4;
          });
          break;
      }
    }
    function tryCast(S, u, i, strict, input) {
      if (!u.alive) return false;
      if (u.stun > 0 || u.taunt >= 0 || u.dash || u.chan) { S.events.push({ t: 'castFail', id: u.id, i, why: u.stun > 0 ? 'stun' : 'busy' }); return false; }
      if (!ready(u, i)) { S.events.push({ t: 'castFail', id: u.id, i, why: 'cd' }); return false; }
      const tg = skillTarget(S, u, i, strict, input);
      if (!tg) { S.events.push({ t: 'castFail', id: u.id, i, why: 'none' }); return false; }
      castSkill(S, u, i, tg);
      return true;
    }
    function stepBurst(S, u, dt) {
      const b = u.burst; b.t -= dt;
      if (b.t > 0) return;
      const t = S.byId.get(b.tid);
      if (!t || !t.alive || b.n <= 0) { u.burst = null; return; }
      b.n--; b.t = 0.09;
      const crit = S.rnd() < u.crit + 0.1;
      S.projs.push({ x: u.x, y: u.y, z: 40, tid: t.id, tx: t.x, ty: t.y, spd: 820, dmg: b.dmg * (crit ? 1.75 : 1), crit, kind: 'phys', src: u.id, team: u.team, fx: 'neon' });
      if (Math.abs(t.x - u.x) > 2) u.face = t.x > u.x ? 1 : -1;
      if (b.n <= 0) u.burst = null;
    }

    // ---------- AI ----------
    function aiTarget(S, u) {
      const sk = u.ai.skill, acq = Math.max(250, u.range + 90), hpF = u.hp / u.maxHp;
      let best = null, bs = -1e9;
      for (const e of S.units) {
        if (!hittable(u, e)) continue;
        const dd = Math.sqrt(d2(u, e)); if (dd > acq + e.r) continue;
        let s;
        if (e.kind === 'hero') {
          s = 120 - dd * 0.25 + (1 - e.hp / e.maxHp) * 90 * (0.4 + sk);
          if (e.aggroT > S.t) s += 15;
          if (hpF < 0.45 && e.hp / e.maxHp > hpF + 0.2) s -= 60; // 打不贏就別硬上
        } else if (e.kind === 'minion') s = 70 - dd * 0.3 + (e.hp < u.atk * 1.2 ? 25 * sk : 0);
        else { if (!structSafe(S, u, e)) continue; s = 62 - dd * 0.2; }
        if (!isStruct(e)) {
          const tw = enemyTowerCovering(S, u.team, e.x, e.y, 10);
          if (tw && !structSafe(S, u, tw) && !(e.kind === 'hero' && e.hp < e.maxHp * 0.3 && hpF > 0.6 && sk > 0.5)) continue;
        }
        if (s > bs) { bs = s; best = e; }
      }
      return best;
    }
    function formation(S, u) {
      const team = u.team, fw = fwd(team), H = HEROES[u.hid];
      let front = null;
      for (const m of S.units) if (m.alive && m.kind === 'minion' && m.team === team && (front === null || (m.y - front) * fw > 0)) front = m.y;
      let anchor = null;
      for (const s of S.units) if (s.alive && s.team === team && isStruct(s) && (anchor === null || (s.y - anchor) * fw > 0)) anchor = s.y;
      anchor += fw * 60;
      let y = front !== null ? front - fw * H.back : anchor;
      const et = frontEnemyStruct(S, team);
      if (et && advantage(S, u) && u.hp > u.maxHp * 0.45) y = et.y - fw * (et.r + 30); // 趁人數優勢直接推進
      else if (et && !structSafe(S, u, et)) { const lim = et.y - fw * (et.range + 26); if ((y - lim) * fw > 0) y = lim; }
      const x = MAP.cx + (u.slot - 1) * 50 + Math.sin(S.t * 0.6 + u.id) * 10;
      return { x, y: clamp(y, 70, MAP.h - 70) };
    }
    function tryAiSkills(S, u) {
      for (const i of [2, 0, 1]) {
        if (!ready(u, i)) continue;
        if (S.rnd() > lerp(0.5, 1, u.ai.skill)) continue;
        const tg = skillTarget(S, u, i, true);
        if (tg) { castSkill(S, u, i, tg); return true; }
      }
      return false;
    }
    function startRecall(S, u) { if (u.recall > 0) return; u.recall = 3; u.moving = false; S.events.push({ t: 'recall', id: u.id }); }
    function aiDecide(S, u) {
      const ai = u.ai, sk = ai.skill, hpF = u.hp / u.maxHp, f = FOUNT[u.team];
      const nearE = S.heroes[1 - u.team].filter(e => e.alive && d2(e, u) < 330 * 330);
      const farHome = d2(u, f) > 420 * 420;
      if (ai.mode === 'home') {
        if (hpF >= 0.92) ai.mode = 'push';
        else { if (!nearE.length && farHome && sk > 0.3) startRecall(S, u); return; }
      }
      const nearA = S.heroes[u.team].filter(a => a.alive && d2(a, u) < 330 * 330).length;
      if (hpF < 0.2 || (sk > 0.7 && hpF < 0.33 && nearE.length > nearA)) {
        if (nearE.length && tryAiSkills(S, u)) return;
        ai.mode = 'home';
        if (!nearE.length && farHome) startRecall(S, u);
        return;
      }
      if (hpF < 0.35 && !nearE.length && d2(u, f) > 650 * 650) { ai.mode = 'home'; startRecall(S, u); return; }
      if (tryAiSkills(S, u)) return;
      let t = aiTarget(S, u);
      if (t && t.kind === 'hero' && S.rnd() < (1 - sk) * 0.35) { const m = nearest(S, u, u.range + 60, 'unit'); if (m && m.kind === 'minion') t = m; }
      if (t) { ai.mode = 'fight'; ai.tgt = t.id; }
      else { ai.mode = 'push'; ai.pos = formation(S, u); }
    }
    function aiHero(S, u, dt) {
      const ai = u.ai;
      ai.th -= dt;
      if (ai.th <= 0) {
        ai.th = lerp(0.4, 0.12, ai.skill) * (0.75 + S.rnd() * 0.5);
        aiDecide(S, u);
        if (!u.alive || u.dash || u.chan || u.recall > 0) return;
      }
      if (ai.mode === 'home') { const f = FOUNT[u.team]; moveToward(S, u, f.x + (u.slot - 1) * 26, f.y, dt, 8); return; }
      if (ai.mode === 'fight') {
        const t = S.byId.get(ai.tgt);
        if (!t || !hittable(u, t)) { ai.th = 0; u.moving = false; return; }
        if (u.range > 100 && ai.skill > 0.6 && u.atkT > 0.18 && u.hp < u.maxHp * 0.6) {
          for (const e of S.heroes[1 - u.team]) if (e.alive && e.range < 80 && d2(e, u) < 75 * 75) { moveToward(S, u, u.x + (u.x - e.x), u.y + (u.y - e.y), dt); return; }
        }
        engage(S, u, t, dt);
        return;
      }
      if (ai.pos) moveToward(S, u, ai.pos.x, ai.pos.y, dt, 6); else u.moving = false;
    }
    function manualTarget(S, u) {
      let best = null, bd = 1e12;
      for (const e of S.units) {
        if (!hittable(u, e)) continue;
        const r = u.range + e.r + 40, dd = d2(u, e);
        if (dd > r * r) continue;
        const s = dd + (e.kind === 'hero' ? 0 : isStruct(e) ? 6000 : 3000);
        if (s < bd) { bd = s; best = e; }
      }
      return best;
    }
    function heroThink(S, u, dt, input) {
      if (u.dash) { stepDash(S, u, dt); return; }
      if (u.chan) { u.chan.t -= dt; if (u.chan.t <= 0) { const fn = u.chan.fn; u.chan = null; fn(); } return; }
      if (u.burst) stepBurst(S, u, dt);
      if (u.stun > 0) { u.moving = false; return; }
      if (u.recall > 0) {
        u.recall -= dt; u.moving = false;
        if (u.recall <= 0) { const f = FOUNT[u.team]; u.x = f.x + (u.slot - 1) * 30; u.y = f.y; S.events.push({ t: 'recalled', id: u.id }); }
        if (!(u.id === S.playerId && input.move)) return;
        u.recall = 0; S.events.push({ t: 'recallStop', id: u.id });
      }
      if (u.taunt >= 0) { const tt = S.byId.get(u.taunt); if (tt && tt.alive) { engage(S, u, tt, dt); return; } u.taunt = -1; }
      if (u.id === S.playerId) {
        if (input.cast) for (const i of input.cast) tryCast(S, u, i, false, input);
        if (u.dash || u.chan) return;
        if (input.recall && !(u.recall > 0)) { startRecall(S, u); return; }
        if (input.move) { moveDir(S, u, input.move.x, input.move.y, dt); return; }
        if (!S.auto) { const t = manualTarget(S, u); if (t) engage(S, u, t, dt); else u.moving = false; return; }
      }
      aiHero(S, u, dt);
    }
    function minionThink(S, m, dt) {
      if (m.stun > 0) { m.moving = false; return; }
      let t = null;
      if (m.taunt >= 0) { const tt = S.byId.get(m.taunt); if (tt && tt.alive) t = tt; }
      if (!t) {
        m.retarget -= dt;
        const cur = S.byId.get(m.tgt);
        if (cur && hittable(m, cur) && d2(m, cur) < 175 * 175 && m.retarget > 0) t = cur;
        else {
          let bs = 1e9;
          for (const e of S.units) {
            if (!hittable(m, e)) continue;
            const dd = Math.sqrt(d2(m, e)); if (dd > 150 + e.r) continue;
            let s = dd * (e.kind === 'minion' ? 1 : e.kind === 'hero' ? 1.5 : 1.15);
            if (e.kind === 'hero' && e.aggroT > S.t) s *= 0.55;
            if (s < bs) { bs = s; t = e; }
          }
          m.tgt = t ? t.id : -1; m.retarget = 0.6;
        }
      }
      if (t) engage(S, m, t, dt);
      else moveToward(S, m, m.lx, m.team === 0 ? 110 : MAP.h - 110, dt);
    }
    function structThink(S, s) {
      const R = s.range;
      const ok = e => e && e.alive && e.team !== s.team && e.untarget <= 0 && d2(s, e) <= (R + e.r) * (R + e.r);
      let t = S.byId.get(s.tgt);
      if (!ok(t)) t = null;
      for (const h of S.heroes[1 - s.team]) if (ok(h) && h.aggroT > S.t) { const v = S.byId.get(h.aggroV); if (v && d2(v, s) < (R + 60) * (R + 60)) { t = h; break; } }
      if (!t) { let bd = 1e15; for (const e of S.units) if (ok(e)) { const dd = d2(s, e) + (e.kind === 'hero' ? 1e7 : 0); if (dd < bd) { bd = dd; t = e; } } }
      if (!t || t.id !== s.tgt) s.ramp = 0;
      s.tgt = t ? t.id : -1;
      if (t && s.atkT <= 0) {
        s.atkT = s.atkCd; s.atkAnim = 0.25;
        const dmg = t.kind === 'hero' ? s.atk * (1 + 0.22 * s.ramp) * (1 + S.t / 400) : t.maxHp * (t.mk === 'super' ? 0.13 : 0.2);
        if (t.kind === 'hero') s.ramp = Math.min(5, s.ramp + 1);
        S.projs.push({ x: s.x, y: s.y, z: s.kind === 'crystal' ? 86 : 96, tid: t.id, tx: t.x, ty: t.y, spd: 440, dmg, kind: t.kind === 'hero' ? 'phys' : 'true', src: s.id, team: s.team, fx: 'drop' });
      }
    }

    // ---------- 主迴圈 ----------
    function spawnWave(S) {
      S.wave++;
      for (const team of [0, 1]) {
        const g = (1 + 0.06 * (S.wave - 1) + (S.phase >= 1 ? 0.25 : 0)) * (1 + 0.45 * S.morale[team]);
        const y = team === 0 ? 1690 : 210, back = -fwd(team);
        const list = [['fan', -24, 0], ['fan', 24, 0], ['pap', 0, 1]];
        if (S.wave % 3 === 0 || S.phase >= 2) list.push(['super', 0, 2]);
        for (const [mk, ox, row] of list) {
          const M = MINIONS[mk];
          makeUnit(S, { kind: 'minion', mk, team, x: MAP.cx + ox, y: y + back * row * 24, lx: MAP.cx + ox * 0.6, r: M.r, hp: M.hp * g, maxHp: M.hp * g, atk: M.atk * g, def: M.def, range: M.range, atkCd: M.cd, spd: M.spd, proj: M.proj || null, xp: M.xp, siege: M.siege, face: team === 0 ? 1 : -1 });
        }
      }
      S.events.push({ t: 'wave', n: S.wave });
    }
    function phases(S) {
      if (S.phase < 1 && S.t >= 60) { S.phase = 1; S.structMult = 1.6; S.events.push({ t: 'phase', n: 1 }); }
      if (S.phase < 2 && S.t >= 100) { S.phase = 2; S.structMult = 2.5; S.events.push({ t: 'phase', n: 2 }); }
      if (S.phase < 3 && S.t >= 140) { S.phase = 3; S.structMult = 4; S.events.push({ t: 'phase', n: 3 }); }
      if (S.phase < 4 && S.t >= 170) { S.phase = 4; S.structMult = 7; S.events.push({ t: 'phase', n: 4 }); }
      if (S.phase < 5 && S.t >= 200) { S.phase = 5; S.structMult = 12; S.events.push({ t: 'phase', n: 5 }); }
      if (S.t >= 300 && !S.over) { // 保險：時間到判定建築血量
        const left = [0, 1].map(team => S.units.filter(u => u.team === team && isStruct(u)).reduce((a, u) => a + u.hp / u.maxHp, 0));
        S.over = true; S.winner = left[0] >= left[1] ? 0 : 1; S.endT = S.t;
        S.events.push({ t: 'end', winner: S.winner, why: 'time' });
      }
    }
    function step(S, dt, input) {
      S.events.length = 0;
      input = input || {};
      S.t += dt;
      if (S.over) { stepProjs(S, dt); return S.events; }
      phases(S);
      S.waveT -= dt;
      if (S.waveT <= 0) { S.waveT += WAVE_INT; spawnWave(S); }
      for (const u of S.units) if (u.alive) tickStatus(S, u, dt);
      for (const u of S.units) {
        if (!u.alive || S.over) continue;
        if (u.kind === 'hero') heroThink(S, u, dt, input);
        else if (u.kind === 'minion') minionThink(S, u, dt);
        else structThink(S, u);
      }
      separate(S);
      stepProjs(S, dt);
      stepZones(S, dt);
      for (let i = S.units.length - 1; i >= 0; i--) { const u = S.units[i]; if (!u.alive && u.kind === 'minion') { S.units.splice(i, 1); S.byId.delete(u.id); } }
      if (!S.over) for (const h of S.heroList) if (!h.alive) { h.respawn -= dt; if (h.respawn <= 0) respawn(S, h); }
      return S.events;
    }
    // 給測試用：整場 AI 對 AI
    function simulate(o, maxT = 400, dt = 1 / 30) {
      const S = newMatch(Object.assign({ auto: true }, o));
      const log = { kills: 0, ults: 0, skills: 0, towers: 0, firstTower: 0 };
      while (!S.over && S.t < maxT) {
        for (const e of step(S, dt, {})) {
          if (e.t === 'kill') log.kills++;
          else if (e.t === 'ult') log.ults++;
          else if (e.t === 'cast') log.skills++;
          else if (e.t === 'struct' && e.kind === 'tower') { log.towers++; if (!log.firstTower) log.firstTower = S.t; }
        }
      }
      return { winner: S.winner, t: S.endT || S.t, score: S.score.slice(), log, heroes: S.heroList.map(h => ({ hid: h.hid, team: h.team, k: h.k, d: h.d, a: h.a, lvl: h.lvl, heroDmg: Math.round(h.heroDmg), heal: Math.round(h.heal), mvp: mvpScore(h, S.winner) })) };
    }

    return {
      MAP, FOUNT, STRUCTS, HEROES, HERO_IDS, MINIONS, ROLE, TIERS, LEGEND, LV_MAX, STAR_MAX, LVL_MAX, WAVE_INT,
      rng, newMatch, step, simulate, revive, ready, player, isStruct, xpNeed,
      rankApply, rankName, rankScore, growthMult, enemyMult, enemySkill, rewards, mvpScore,
    };
  })();

  /* =====================================================================
   * 2. 畫面
   * ===================================================================== */
  const TAU = Math.PI * 2;
  const HD = Core.HEROES, MAP = Core.MAP, TIERS = Core.TIERS;
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickR = a => a[Math.floor(Math.random() * a.length)];
  const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const elx = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const mkCv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // 對手隊伍（用 hue-rotate 換色）
  const TEAMS = [
    { name: '紅寶石百貨', en: 'RUBY', hue: -42, c: '#ff4d6d', c2: '#8a1232' },
    { name: '翡翠精品', en: 'JADE', hue: 118, c: '#2fd39a', c2: '#0d6b4c' },
    { name: '藍寶石名店', en: 'SAPPHIRE', hue: 178, c: '#5b9dff', c2: '#1f3f8f' },
    { name: '紫晶沙龍', en: 'AMETHYST', hue: 236, c: '#b585ff', c2: '#4b2490' },
  ];
  const ALT = { erika: ['若曦', '安琪'], vivi: ['品妍', '欣妤'], vita: ['語彤', '凱婷'], chiyo: ['芷晴', '雅婷'], shino: ['思妤', '詩涵'], fumi: ['冠宇', '柏翰'] };
  const LINES = {
    erika: { pick: '今晚的伸展台，只屬於我！', ult: '閃耀吧，流星！', kill: '這就是百貨女王的實力～', mvp: '掌聲請給我，也給我的好姐妹們～', lose: '下一場，我會更耀眼。', low: '妝要花了啦！', back: '女王回來了～' },
    vivi: { pick: '甜點和勝利，我都要！', ult: '下午茶時間到囉～', kill: '甜甜的，但很痛喔！', mvp: '大家辛苦了，請吃馬卡龍～', lose: '嗚…下次一定贏回來。', low: '誰來救救我～', back: '補給到囉！' },
    vita: { pick: '演算法說，我們贏定了。', ult: '超載・全功率！', kill: '命中率百分之百。', mvp: '輸出全場最高，數據不會說謊。', lose: '數據……出錯了？', low: '電量不足！', back: '系統重新啟動。' },
    chiyo: { pick: '財閥的大小姐，從不手下留情。', ult: '這就是制裁。', kill: '太慢了。', mvp: '這種程度，不過是熱身。', lose: '哼，這次就讓給妳們。', low: '嘖…先撤。', back: '再來一次。' },
    shino: { pick: '書上說，勝利屬於沉著的人。', ult: '千卷・封印。', kill: '封印完成。', mvp: '一切都在預料之中。', lose: '……還需要再多讀一點書。', low: '需要支援…', back: '繼續下一章。' },
    fumi: { pick: '大小姐的安全，就交給我吧。', ult: '請容我失禮了！', kill: '失禮了。', mvp: '為各位服務，是我的榮幸。', lose: '是我保護不周，非常抱歉。', low: '我還撐得住！', back: '管家歸位。' },
  };
  const FOE_TAUNT = ['伸展台的主角是我們！', '妳們的鑽石，我們收下了。', '準備好丟臉了嗎？', '時尚圈只需要一個女王。'];
  const ROLE_IC = { mage: 'burst', support: 'heal', marksman: 'barrage', assassin: 'step', control: 'seal', tank: 'shield' };
  const ICON = {
    burst: '<path d="M12 2.5l1.8 6.2 6.2-2-4.3 4.8 4.3 4.8-6.2-2L12 21.5l-1.8-6.2-6.2 2 4.3-4.8L4 7.7l6.2 2z"/><circle cx="12" cy="12" r="2.2"/>',
    ray: '<path d="M3.5 17.5 16 5"/><path d="M7 20.5 19.5 8" opacity=".55"/><circle cx="18.5" cy="5" r="2.6"/><path d="M2.5 21.5l2-2"/>',
    meteor: '<circle cx="15.5" cy="15.5" r="4.2"/><path d="M12.4 12.4 4 4M14.6 11 8.5 3M11 14.6 3 8.5"/><path d="M15.5 13.3v4.4M13.3 15.5h4.4" opacity=".7"/>',
    heal: '<path d="M12 20s-7.2-4.5-7.2-9.8A4 4 0 0 1 12 8a4 4 0 0 1 7.2 2.2c0 5.3-7.2 9.8-7.2 9.8z"/><path d="M12 10.8v5M9.5 13.3h5"/>',
    shield: '<path d="M12 3l7 3v5.5c0 4.6-3 8-7 9.5-4-1.5-7-4.9-7-9.5V6z"/><path d="M12 8.2l1 2.3 2.5.2-1.9 1.6.6 2.5L12 13.5l-2.2 1.3.6-2.5-1.9-1.6 2.5-.2z"/>',
    tea: '<path d="M5 9.5h11v3.5a5.5 5.5 0 0 1-11 0z"/><path d="M16 10.8h1.4a2.2 2.2 0 0 1 0 4.4H15.5M3.8 20.5h13.4M9 3.5c-1 1 1 2 0 3.2M12.2 3.5c-1 1 1 2 0 3.2"/>',
    barrage: '<path d="M3.5 7h11M3.5 12h13.5M3.5 17h11M12 4.5 14.5 7 12 9.5M14.5 9.5 17 12l-2.5 2.5M12 14.5l2.5 2.5-2.5 2.5"/>',
    dash: '<path d="M13.5 2.5 6 13h5.2l-1.2 8.5L17.5 11h-5.2z"/><path d="M2.5 8.5h3M1.5 12.5h3M2.5 16.5h3" opacity=".7"/>',
    laser: '<circle cx="6" cy="12" r="3.6"/><path d="M9.6 10.4H22M9.6 13.6H22"/><path d="M6 6.4V4.4M6 19.6v-2M1.4 12h1" opacity=".7"/>',
    step: '<path d="M4 20 16 8M16 8l1.4-4.6L21 3l-.6 3.6z"/><path d="M5.5 12.5c-2 0-3 1-3 3M9.5 8.5c-2 0-3.5 1-3.5 3" opacity=".6"/>',
    petal: '<path d="M12 12c-1.6-3-1.6-6 0-8.6 1.6 2.6 1.6 5.6 0 8.6zM12 12c3-1.6 6-1.6 8.6 0-2.6 1.6-5.6 1.6-8.6 0zM12 12c1.6 3 1.6 6 0 8.6-1.6-2.6-1.6-5.6 0-8.6zM12 12c-3 1.6-6 1.6-8.6 0 2.6-1.6 5.6-1.6 8.6 0z"/><circle cx="12" cy="12" r="1.4"/>',
    verdict: '<path d="M5 19 19 5M19 19 5 5"/><path d="M3 21l3-1-2-2zM21 21l-1-3-2 2z"/><path d="M12 9.5 14.5 12 12 14.5 9.5 12z"/>',
    bind: '<rect x="7" y="2.8" width="10" height="18.4" rx="1.2"/><path d="M10 7h4M12 7v9.5M9.5 11.5h5M10 16.5h4"/>',
    pages: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13"/>',
    seal: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.8"/><path d="M12 3.4v3M12 17.6v3M3.4 12h3M17.6 12h3M6 6l2.1 2.1M15.9 15.9 18 18M18 6l-2.1 2.1M8.1 15.9 6 18"/>',
    bow: '<path d="M12 12 3.8 7.4v9.2zM12 12l8.2-4.6v9.2z"/><rect x="10.4" y="10.2" width="3.2" height="3.6" rx="1"/>',
    tray: '<path d="M3.5 16.5h17M2.5 19h19M5.5 16.5a6.5 6.5 0 0 1 13 0M12 8V6.3M10.4 6.2h3.2"/>',
    charge: '<path d="M3 12h11.5M10.5 7l5 5-5 5"/><path d="M19 4.5v15"/><path d="M1.5 8h2.5M1.5 16H4" opacity=".6"/>',
    atk: '<path d="M14.5 4.5h5v5L9 20l-5-5z"/><path d="M6 13l5 5M3 21l2.5-2.5"/>',
    recall: '<path d="M12 21s-6.5-5.6-6.5-10.8a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><path d="M12 7v4l2.5 1.5"/>',
    sword: '<path d="M14.5 4.5h5v5L9 20l-5-5z"/><path d="M6 13l5 5"/>',
  };
  const svgI = (k, cls = '') => `<svg class="ar-i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ''}</svg>`;
  const ICON_BACK = '<svg class="ar-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const ICON_X = '<svg class="ar-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  // ---------- 存檔（段位、戰績、賽季；英雄等級改用主程式共用名冊） ----------
  function store(api) {
    const s = api.store('arena');
    if (!s.v) Object.assign(s, { v: 1, rank: { tier: 0, stars: 0 }, best: { tier: 0, stars: 0 }, season: {}, hist: [], last: 'erika', auto: false, tut: {}, team: 0, pend: {}, fb: {} });
    if (!s.rank || !Number.isFinite(s.rank.tier)) s.rank = { tier: 0, stars: 0 };
    s.rank = { tier: cl(Math.floor(s.rank.tier) || 0, 0, Core.LEGEND), stars: Math.max(0, Math.floor(s.rank.stars) || 0) };
    if (!s.best || Core.rankScore(s.best) < Core.rankScore(s.rank)) s.best = { ...s.rank };
    s.season = Object.assign({ n: 1, w: 0, l: 0, mvp: 0, k: 0, d: 0, a: 0, streak: 0, bestStreak: 0 }, s.season);
    if (!Array.isArray(s.hist)) s.hist = [];
    s.tut = s.tut || {}; s.pend = s.pend || {}; s.fb = s.fb || {};
    if (!HD[s.last]) s.last = 'erika';
    return s;
  }
  // 共用英雄名冊（主程式沒有提供時的備援）
  const FB_NEED = [0, 10, 20, 40, 80, 150];
  const fbCost = lv => Math.round(300 * Math.pow(1.42, lv - 1));
  function roster(api) {
    const cast = api.cast();
    let list = null;
    if (typeof api.heroes === 'function') { try { list = api.heroes(); } catch (e) { console.error(e); } }
    if (!Array.isArray(list) || !list.length) {
      const s = store(api);
      list = cast.map(c => {
        const h = s.fb[c.id] = s.fb[c.id] || { lv: 1, star: c.id === 'erika' ? 2 : 1, shards: 0 };
        return Object.assign({}, c, { lv: h.lv, star: h.star, shards: h.shards, power: Math.round((20 + h.lv * 6) * (1 + 0.3 * (h.star - 1))), lvCost: h.lv >= 60 ? null : fbCost(h.lv), starNeed: h.star >= 6 ? null : FB_NEED[h.star] });
      });
    }
    const map = {};
    for (const c of cast) map[c.id] = Object.assign({ lv: 1, star: 1, shards: 0 }, c);
    for (const h of list) if (h && map[h.id]) map[h.id] = Object.assign(map[h.id], h);
    return map;
  }
  function heroLevelUp(api, id, el) {
    if (typeof api.heroLevelUp === 'function') return !!api.heroLevelUp(id, el);
    const h = store(api).fb[id]; if (!h || h.lv >= 60) return false;
    if (!api.spendCoins(fbCost(h.lv), el)) return false;
    h.lv++; api.sound.buy(); api.save(); return true;
  }
  function heroStarUp(api, id, el) {
    if (typeof api.heroStarUp === 'function') return !!api.heroStarUp(id, el);
    const h = store(api).fb[id], need = h && FB_NEED[h.star];
    if (!need) return false;
    if (h.shards < need) { api.shake(el); api.sound.err(); api.toast(`還差 ${need - h.shards} 個碎片`); return false; }
    h.shards -= need; h.star++; api.sound.level(); api.save(); return true;
  }
  function giveRewards(api, r, x, y) {
    if (typeof api.grant === 'function') { try { api.grant(r, x, y, true); return; } catch (e) { console.error(e); } }
    if (r.coins) api.addCoins(r.coins, x, y);
    const s = store(api);
    for (const [id, n] of Object.entries(r.shards || {})) { const h = s.fb[id] = s.fb[id] || { lv: 1, star: 1, shards: 0 }; h.shards += n; }
  }
  const fashionPct = api => { try { if (typeof api.fashion === 'function') { const p = +api.fashion().power || 0; return Math.round(Math.min(30, Math.max(0, p * 3)) * 10) / 10; } } catch (e) { /* 主程式沒有 */ } return 0; };
  const perkVal = (api, k) => { try { if (typeof api.perk === 'function') { const v = +api.perk(k); return Number.isFinite(v) ? v : 0; } } catch (e) { /* 主程式沒有 */ } return 0; };
  const report = (api, name, data) => { try { if (typeof api.event === 'function') api.event(name, data); } catch (e) { console.error(e); } };
  const heroMult = (api, R, id) => Core.growthMult(R[id].lv || 1, R[id].star || 1) * (id === 'erika' ? 1 + fashionPct(api) / 100 : 1);

  // ---------- 段位徽章、星星 ----------
  let svgUid = 0;
  function emblem(tier, size = 60) {
    const T = TIERS[cl(tier, 0, Core.LEGEND)], id = 'arE' + (++svgUid);
    const wings = tier >= 3 ? `<path d="M21 38C9 37 3 27 4 16c6 7 12 9 18 9M79 38c12-1 18-11 17-22-6 7-12 9-18 9" fill="url(#${id}w)"/><path d="M20 52C8 52 2 43 2 33c6 6 12 7 18 6M80 52c12 0 18-9 18-19-6 6-12 7-18 6" fill="url(#${id}w)" opacity=".75"/>` : '';
    const crown = tier >= 5 ? `<path d="M35 15l6 7 9-12 9 12 6-7 2 12H33z" fill="url(#${id}g)" stroke="#7a4b12" stroke-width="1"/><circle cx="50" cy="10" r="2.4" fill="#fff"/>` : '';
    return `<svg class="ar-emb" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><defs>
      <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.c1}"/><stop offset="1" stop-color="${T.c2}"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="${T.c1}"/><stop offset="1" stop-color="${T.c2}"/></linearGradient>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c9"/><stop offset="1" stop-color="#c9962e"/></linearGradient>
      <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${T.c2}"/></linearGradient></defs>
      ${wings}<path d="M50 16 79 27v23c0 19-13 32-29 40C34 82 21 69 21 50V27z" fill="url(#${id}a)" stroke="#fff" stroke-opacity=".75" stroke-width="2"/>
      <path d="M50 24 72 32v18c0 14-9 25-22 32-13-7-22-18-22-32V32z" fill="#000" fill-opacity=".16"/>
      <path d="M50 35l13 10-13 22-13-22z" fill="url(#${id}b)" stroke="#fff" stroke-width="1.2"/><path d="M37 45h26M50 35l-5 10 5 22 5-22z" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".9"/>
      ${crown}${tier >= Core.LEGEND ? `<circle cx="50" cy="52" r="46" fill="none" stroke="url(#${id}g)" stroke-width="1.6" stroke-dasharray="2 5"/>` : ''}</svg>`;
  }
  function starsHTML(r, cls = '') {
    if (r.tier >= Core.LEGEND) return `<span class="ar-stars legend ${cls}"><i class="on">★</i>× ${r.stars}</span>`;
    let h = '';
    for (let i = 0; i < TIERS[r.tier].stars; i++) h += `<i class="${i < r.stars ? 'on' : ''}">★</i>`;
    return `<span class="ar-stars ${cls}">${h}</span>`;
  }
  const starDots = (n, max = 6) => `<span class="ar-sd">${'★'.repeat(cl(n, 0, max))}<i>${'★'.repeat(Math.max(0, max - n))}</i></span>`;
  const motes = n => { let h = ''; for (let i = 0; i < n; i++) h += `<i style="left:${rnd(2, 98).toFixed(1)}%;top:${rnd(5, 95).toFixed(1)}%;--d:${rnd(0, 6).toFixed(2)}s;--s:${rnd(0.6, 1.4).toFixed(2)}"></i>`; return `<div class="ar-motes">${h}</div>`; };

  // ---------- 圖片、換色、精靈圖 ----------
  const IMG = new Map();
  function loadImg(src) {
    if (!IMG.has(src)) IMG.set(src, new Promise(res => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
    return IMG.get(src);
  }
  function hueMat(deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072];
  }
  // 和 CSS hue-rotate 一樣的換色，但保護膚色（不然臉會變綠）
  function shiftPx(p, deg) {
    const m = hueMat(deg);
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 6) continue;
      const r = p[i], g = p[i + 1], b = p[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
      let w = 0;
      if (dl > 0 && mx > 105) {
        let hh = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4;
        hh *= 60; if (hh < 0) hh += 360;
        const dh = Math.min(Math.abs(hh - 22), 360 - Math.abs(hh - 22)), sat = dl / mx;
        const wh = 1 - Math.min(1, Math.max(0, dh - 14) / 10);
        const ws = sat < 0.05 ? 0 : sat > 0.6 ? Math.max(0, 1 - (sat - 0.6) / 0.15) : 1;
        w = wh * ws * Math.min(1, (mx - 105) / 50);
      }
      const nr = m[0] * r + m[1] * g + m[2] * b, ng = m[3] * r + m[4] * g + m[5] * b, nb = m[6] * r + m[7] * g + m[8] * b;
      p[i] = nr + (r - nr) * w; p[i + 1] = ng + (g - ng) * w; p[i + 2] = nb + (b - nb) * w;
    }
  }
  const SKIN = new Map();
  function skinUrl(src, deg) {
    if (!deg) return Promise.resolve(src);
    const key = src + '|' + deg;
    if (!SKIN.has(key)) SKIN.set(key, loadImg(src).then(img => new Promise(res => {
      if (!img) { res(src); return; }
      try {
        const c = mkCv(img.naturalWidth, img.naturalHeight), x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height); shiftPx(d.data, deg); x.putImageData(d, 0, 0);
        c.toBlob(b => res(b ? URL.createObjectURL(b) : src), 'image/webp', 0.92);
      } catch (e) { res(src); }
    })));
    return SKIN.get(key);
  }
  const SPR = new Map();
  function heroSprite(img, deg) {
    const key = img.src + '|' + deg;
    if (SPR.has(key)) return SPR.get(key);
    const H = 220, W = Math.round(H * img.naturalWidth / img.naturalHeight);
    const mid = mkCv(W * 2, H * 2), mx = mid.getContext('2d');
    mx.imageSmoothingQuality = 'high'; mx.drawImage(img, 0, 0, mid.width, mid.height);
    const c = mkCv(W, H), x = c.getContext('2d', { willReadFrequently: !!deg });
    x.imageSmoothingQuality = 'high'; x.drawImage(mid, 0, 0, W, H);
    if (deg) { try { const d = x.getImageData(0, 0, W, H); shiftPx(d.data, deg); x.putImageData(d, 0, 0); } catch (e) { /* 換不了就原色 */ } }
    const s = { c, white: whiteOf(c) };
    SPR.set(key, s);
    return s;
  }
  function whiteOf(c) { const w = mkCv(c.width, c.height), x = w.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, w.width, w.height); return w; }

  // 小型光點精靈（快取）
  // #rgb → #rrggbb（之後要接透明度字尾）
  const hex6 = c => (/^#[0-9a-f]{3}$/i.test(c) ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c);
  const GLOW = new Map();
  function glowSp(color, hard = 0.35) {
    color = hex6(color);
    const k = color + hard;
    if (!GLOW.has(k)) {
      const c = mkCv(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, color); g.addColorStop(hard, color.length === 7 ? color + '88' : color); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64); GLOW.set(k, c);
    }
    return GLOW.get(k);
  }
  const SHAPE = new Map();
  function shapeSp(kind, color) {
    color = hex6(color);
    const k = kind + color;
    if (SHAPE.has(k)) return SHAPE.get(k);
    const c = mkCv(48, 48), x = c.getContext('2d');
    x.translate(24, 24);
    if (kind === 'star') {
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 22); g.addColorStop(0, color + 'aa'); g.addColorStop(1, color + '00');
      x.fillStyle = g; x.fillRect(-24, -24, 48, 48);
      x.fillStyle = '#fff';
      x.beginPath(); x.moveTo(0, -20); x.quadraticCurveTo(2, -2, 20, 0); x.quadraticCurveTo(2, 2, 0, 20); x.quadraticCurveTo(-2, 2, -20, 0); x.quadraticCurveTo(-2, -2, 0, -20); x.fill();
      x.fillStyle = color; x.beginPath(); x.arc(0, 0, 3.5, 0, TAU); x.fill();
    } else if (kind === 'heart') {
      x.fillStyle = color; x.beginPath(); x.moveTo(0, 15); x.bezierCurveTo(-18, 2, -15, -14, -4, -12); x.bezierCurveTo(-1, -11, 0, -8, 0, -7); x.bezierCurveTo(0, -8, 1, -11, 4, -12); x.bezierCurveTo(15, -14, 18, 2, 0, 15); x.fill();
      x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(-7, -5, 3.4, 2.2, -0.6, 0, TAU); x.fill();
    } else if (kind === 'coin') {
      const g = x.createRadialGradient(-5, -6, 1, 0, 0, 16); g.addColorStop(0, '#fff4cf'); g.addColorStop(0.55, '#ecc56f'); g.addColorStop(1, '#a8772a');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, 15, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,244,207,.85)'; x.lineWidth = 1.6; x.beginPath(); x.arc(0, 0, 10.5, 0, TAU); x.stroke();
      x.fillStyle = '#8a5d1c'; x.font = 'italic 700 15px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('E', 0, 1);
    } else if (kind === 'petal') {
      const g = x.createLinearGradient(-14, 0, 14, 0); g.addColorStop(0, '#fff0f6'); g.addColorStop(1, color);
      x.fillStyle = g; x.beginPath(); x.moveTo(-15, 0); x.quadraticCurveTo(0, -12, 15, -2); x.lineTo(10, 0); x.lineTo(15, 2); x.quadraticCurveTo(0, 12, -15, 0); x.fill();
    } else if (kind === 'page') {
      x.fillStyle = '#fbf6ea'; x.fillRect(-11, -14, 22, 28); x.strokeStyle = color; x.lineWidth = 1.5;
      for (let i = -8; i <= 8; i += 4) { x.beginPath(); x.moveTo(-7, i); x.lineTo(7, i); x.stroke(); }
    } else if (kind === 'gem') {
      const g = x.createLinearGradient(-14, -14, 14, 14); g.addColorStop(0, '#fff'); g.addColorStop(0.45, color); g.addColorStop(1, '#5a1b4a');
      x.fillStyle = g; x.beginPath(); x.moveTo(-9, -12); x.lineTo(9, -12); x.lineTo(16, -3); x.lineTo(0, 16); x.lineTo(-16, -3); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-16, -3); x.lineTo(16, -3); x.moveTo(-6, -3); x.lineTo(0, 16); x.lineTo(6, -3); x.stroke();
    } else if (kind === 'plus') {
      x.fillStyle = color; x.shadowColor = color; x.shadowBlur = 8; x.fillRect(-4, -13, 8, 26); x.fillRect(-13, -4, 26, 8);
    } else if (kind === 'bubble') {
      const g = x.createRadialGradient(-5, -6, 1, 0, 0, 16); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, color + '55'); g.addColorStop(1, color + 'cc');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, 14, 0, TAU); x.fill();
    }
    SHAPE.set(k, c);
    return c;
  }

  // ---------- 程式繪製：小兵、防禦塔、主堡 ----------
  const PAL = [
    { main: '#ff8fc0', dark: '#c8467f', hair: '#6b3a2a', glow: '#ffe17a', coat1: '#f6e2c2', coat2: '#c9a46c', hat: '#7a2b52', glass1: '#ffd9ea', glass2: '#ff7fb3', liquid: '#ff6fa8', cap1: '#fff6d8', cap2: '#e9b64a', gem1: '#ffffff', gem2: '#ffb3d6', gem3: '#d6457a' },
    { main: '#e5455c', dark: '#8c1631', hair: '#2b1520', glow: '#ff9db0', coat1: '#6a4252', coat2: '#2e1a26', hat: '#c22a4a', glass1: '#ffd0d8', glass2: '#e0314b', liquid: '#c3163e', cap1: '#ffe0e6', cap2: '#b0123f', gem1: '#ffe9ee', gem2: '#ff5c7a', gem3: '#7a0b26' },
  ];
  const ART = new Map();
  function minionSprite(mk, team) {
    const key = 'm' + mk + team;
    if (ART.has(key)) return ART.get(key);
    const P = PAL[team], big = mk === 'super', sc = 5, w = big ? 34 : 26, h = big ? 48 : 36;
    const c = mkCv(w * sc, h * sc), x = c.getContext('2d');
    x.scale(sc, sc); x.lineJoin = 'round'; x.lineCap = 'round';
    const cx = w / 2, hr = big ? 7.2 : 6.2, hy = h * 0.27;
    // 腿與鞋
    x.fillStyle = '#3a1d2e'; x.fillRect(cx - 3.6, h - 9, 2.6, 7); x.fillRect(cx + 1, h - 9, 2.6, 7);
    x.fillStyle = P.dark; x.beginPath(); x.ellipse(cx - 2.6, h - 2, 2.6, 1.5, 0, 0, TAU); x.ellipse(cx + 2.6, h - 2, 2.6, 1.5, 0, 0, TAU); x.fill();
    if (mk === 'pap') {
      // 風衣
      const g = x.createLinearGradient(0, h * 0.4, 0, h - 6); g.addColorStop(0, P.coat1); g.addColorStop(1, P.coat2);
      x.fillStyle = g; x.beginPath(); x.moveTo(cx - 6, h * 0.42); x.lineTo(cx + 6, h * 0.42); x.lineTo(cx + 8.5, h - 7); x.lineTo(cx - 8.5, h - 7); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(cx, h * 0.46); x.lineTo(cx, h - 7); x.moveTo(cx - 7.5, h * 0.66); x.lineTo(cx + 7.5, h * 0.66); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.moveTo(cx - 4, h * 0.42); x.lineTo(cx, h * 0.52); x.lineTo(cx + 4, h * 0.42); x.fill();
      // 相機
      x.fillStyle = '#1d1420'; x.beginPath(); x.roundRect(cx - 8, h * 0.44, 10, 6.5, 1.4); x.fill();
      x.fillStyle = '#2d2433'; x.fillRect(cx - 6, h * 0.42, 3.5, 2);
      const lg = x.createRadialGradient(cx - 3.6, h * 0.47, 0.3, cx - 3, h * 0.47 + 0.8, 3); lg.addColorStop(0, '#bfe6ff'); lg.addColorStop(0.5, '#3a5a8a'); lg.addColorStop(1, '#0a0a14');
      x.fillStyle = lg; x.beginPath(); x.arc(cx - 3, h * 0.47 + 1.2, 2.6, 0, TAU); x.fill();
      x.fillStyle = '#fff8d0'; x.fillRect(cx - 7.5, h * 0.42 - 0.6, 2.4, 1.6);
      // 頭（墨鏡＋帽子）
      skinHead(x, cx, hy, hr, P.hair, false);
      x.fillStyle = '#120a12'; x.beginPath(); x.roundRect(cx - 4.8, hy - 0.6, 9.6, 2.6, 1.2); x.fill();
      x.fillStyle = P.hat; x.beginPath(); x.ellipse(cx, hy - hr * 0.62, hr * 1.25, 1.8, 0, 0, TAU); x.fill();
      x.beginPath(); x.roundRect(cx - hr * 0.72, hy - hr * 1.32, hr * 1.44, hr * 0.78, 1.5); x.fill();
      x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(cx - hr * 0.72, hy - hr * 0.78, hr * 1.44, 1);
    } else {
      // 洋裝
      const g = x.createLinearGradient(0, h * 0.4, 0, h - 6); g.addColorStop(0, P.main); g.addColorStop(1, P.dark);
      x.fillStyle = g; x.beginPath(); x.moveTo(cx - 4.5, h * 0.42); x.lineTo(cx + 4.5, h * 0.42); x.quadraticCurveTo(cx + 6, h * 0.62, cx + 9.5, h - 8); x.lineTo(cx - 9.5, h - 8); x.quadraticCurveTo(cx - 6, h * 0.62, cx - 4.5, h * 0.42); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 0.9; x.beginPath();
      for (let i = -9; i < 9; i += 3) x.arc(cx + i + 1.5, h - 8, 1.5, 0, Math.PI); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.ellipse(cx - 2.5, h * 0.56, 1.6, 4, 0.2, 0, TAU); x.fill();
      // 手臂與應援棒
      x.strokeStyle = '#ffd9c8'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx + 4, h * 0.45); x.lineTo(cx + 8.5, h * 0.3); x.moveTo(cx - 4, h * 0.45); x.lineTo(cx - 6.5, h * 0.6); x.stroke();
      if (big) {
        x.strokeStyle = '#c9a35b'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(cx + 9, h * 0.62); x.lineTo(cx + 9, h * 0.05); x.stroke();
        const fg = x.createLinearGradient(cx + 9, 0, cx + 25, 0); fg.addColorStop(0, P.main); fg.addColorStop(1, P.dark);
        x.fillStyle = fg; x.beginPath(); x.moveTo(cx + 9, h * 0.05); x.lineTo(cx + 24, h * 0.09); x.lineTo(cx + 21, h * 0.17); x.lineTo(cx + 24, h * 0.25); x.lineTo(cx + 9, h * 0.25); x.fill();
        x.fillStyle = '#fff'; x.font = 'bold 6px serif'; x.textAlign = 'center'; x.fillText('♥', cx + 15.5, h * 0.19);
      } else {
        x.save(); x.shadowColor = P.glow; x.shadowBlur = 6; x.strokeStyle = P.glow; x.lineWidth = 2.2; x.beginPath(); x.moveTo(cx + 8.5, h * 0.3); x.lineTo(cx + 11, h * 0.08); x.stroke(); x.restore();
        x.strokeStyle = '#fff'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(cx + 8.8, h * 0.27); x.lineTo(cx + 10.8, h * 0.1); x.stroke();
      }
      skinHead(x, cx, hy, hr, P.hair, true);
      x.fillStyle = P.main; x.beginPath(); x.moveTo(cx, hy - hr * 0.7); x.bezierCurveTo(cx - 3, hy - hr * 1.2, cx - 3.5, hy - hr * 0.5, cx, hy - hr * 0.35); x.bezierCurveTo(cx + 3.5, hy - hr * 0.5, cx + 3, hy - hr * 1.2, cx, hy - hr * 0.7); x.fill();
      if (big) { x.fillStyle = '#f6d27a'; x.beginPath(); x.moveTo(cx - 5, hy - hr * 0.95); x.lineTo(cx - 5, hy - hr * 1.5); x.lineTo(cx - 2.5, hy - hr * 1.15); x.lineTo(cx, hy - hr * 1.6); x.lineTo(cx + 2.5, hy - hr * 1.15); x.lineTo(cx + 5, hy - hr * 1.5); x.lineTo(cx + 5, hy - hr * 0.95); x.fill(); }
    }
    const s = { c, white: whiteOf(c), w, h };
    ART.set(key, s);
    return s;
  }
  function skinHead(x, cx, hy, r, hair, buns) {
    x.fillStyle = hair;
    if (buns) { x.beginPath(); x.arc(cx - r * 0.95, hy - r * 0.55, r * 0.45, 0, TAU); x.arc(cx + r * 0.95, hy - r * 0.55, r * 0.45, 0, TAU); x.fill(); }
    x.beginPath(); x.arc(cx, hy, r * 1.04, 0, TAU); x.fill();
    const g = x.createRadialGradient(cx - r * 0.3, hy - r * 0.2, r * 0.2, cx, hy, r);
    g.addColorStop(0, '#fff0e6'); g.addColorStop(1, '#f6c9b4');
    x.fillStyle = g; x.beginPath(); x.ellipse(cx, hy + r * 0.12, r * 0.86, r * 0.82, 0, 0, TAU); x.fill();
    x.fillStyle = hair; x.beginPath(); x.ellipse(cx, hy - r * 0.48, r * 0.98, r * 0.5, 0, Math.PI, TAU); x.fill();
    x.fillStyle = '#3a1d2e'; x.beginPath(); x.ellipse(cx - r * 0.36, hy + r * 0.12, r * 0.12, r * 0.18, 0, 0, TAU); x.ellipse(cx + r * 0.36, hy + r * 0.12, r * 0.12, r * 0.18, 0, 0, TAU); x.fill();
    x.fillStyle = 'rgba(255,120,150,.45)'; x.beginPath(); x.ellipse(cx - r * 0.55, hy + r * 0.42, r * 0.18, r * 0.1, 0, 0, TAU); x.ellipse(cx + r * 0.55, hy + r * 0.42, r * 0.18, r * 0.1, 0, 0, TAU); x.fill();
  }
  // 防禦塔：巨型香水瓶
  function towerSprite(team) {
    const key = 't' + team;
    if (ART.has(key)) return ART.get(key);
    const P = PAL[team], sc = 4, w = 60, h = 118, cx = w / 2;
    const c = mkCv(w * sc, h * sc), x = c.getContext('2d');
    x.scale(sc, sc); x.lineJoin = 'round';
    // 金色底座
    const gb = x.createLinearGradient(cx - 22, 0, cx + 22, 0); gb.addColorStop(0, '#7a5520'); gb.addColorStop(0.35, '#f6dc9a'); gb.addColorStop(0.6, '#c9a35b'); gb.addColorStop(1, '#6b4718');
    x.fillStyle = '#4a2f12'; x.beginPath(); x.ellipse(cx, h - 7, 24, 6.5, 0, 0, TAU); x.fill();
    x.fillStyle = gb; x.fillRect(cx - 22, h - 24, 44, 17); x.beginPath(); x.ellipse(cx, h - 7, 22, 6, 0, 0, Math.PI); x.fill();
    x.fillStyle = '#fbe7b0'; x.beginPath(); x.ellipse(cx, h - 24, 22, 6, 0, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(90,50,10,.45)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(cx - 22, h - 15); x.lineTo(cx + 22, h - 15); x.stroke();
    for (let i = -16; i <= 16; i += 8) { x.fillStyle = i ? P.glass2 : '#fff'; x.beginPath(); x.moveTo(cx + i, h - 18); x.lineTo(cx + i + 2, h - 15); x.lineTo(cx + i, h - 12); x.lineTo(cx + i - 2, h - 15); x.fill(); }
    // 瓶身
    const bottle = () => { x.beginPath(); x.moveTo(cx - 18, h - 27); x.lineTo(cx - 18, h - 60); x.quadraticCurveTo(cx - 18, h - 72, cx - 7, h - 76); x.lineTo(cx - 6, h - 82); x.lineTo(cx + 6, h - 82); x.lineTo(cx + 7, h - 76); x.quadraticCurveTo(cx + 18, h - 72, cx + 18, h - 60); x.lineTo(cx + 18, h - 27); x.quadraticCurveTo(cx, h - 22, cx - 18, h - 27); x.closePath(); };
    const gg = x.createLinearGradient(cx - 18, 0, cx + 18, 0); gg.addColorStop(0, P.glass2); gg.addColorStop(0.3, P.glass1); gg.addColorStop(0.55, '#ffffff'); gg.addColorStop(0.8, P.glass1); gg.addColorStop(1, P.glass2);
    x.save(); bottle(); x.globalAlpha = 0.85; x.fillStyle = gg; x.fill(); x.globalAlpha = 1; x.clip();
    const lq = x.createLinearGradient(0, h - 58, 0, h - 24); lq.addColorStop(0, P.liquid + 'cc'); lq.addColorStop(1, P.dark);
    x.fillStyle = lq; x.fillRect(cx - 20, h - 56, 40, 34);
    x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.ellipse(cx, h - 56, 18, 2.2, 0, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 0.8;
    for (const k of [-9, 0, 9]) { x.beginPath(); x.moveTo(cx + k, h - 76); x.lineTo(cx + k * 1.4, h - 26); x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.roundRect(cx - 14, h - 70, 3.2, 36, 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.roundRect(cx + 9, h - 66, 2, 26, 1); x.fill();
    x.restore();
    bottle(); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1; x.stroke();
    // 標籤
    x.fillStyle = 'rgba(255,250,240,.92)'; x.beginPath(); x.roundRect(cx - 9, h - 50, 18, 11, 2); x.fill();
    x.strokeStyle = '#c9a35b'; x.lineWidth = 0.7; x.stroke();
    x.fillStyle = team ? '#8a1232' : '#a92b58'; x.font = 'italic 700 6.4px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(team ? 'R' : 'E', cx, h - 44.3);
    // 金頸圈與寶石瓶蓋
    x.fillStyle = gb; x.fillRect(cx - 8, h - 87, 16, 6);
    x.fillStyle = '#fbe7b0'; x.fillRect(cx - 8, h - 87, 16, 1.4);
    const cg = x.createLinearGradient(cx - 12, h - 112, cx + 12, h - 88); cg.addColorStop(0, P.cap1); cg.addColorStop(0.5, P.glass2); cg.addColorStop(1, P.cap2);
    x.fillStyle = cg; x.beginPath(); x.moveTo(cx, h - 114); x.lineTo(cx + 12, h - 100); x.lineTo(cx + 7, h - 88); x.lineTo(cx - 7, h - 88); x.lineTo(cx - 12, h - 100); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(cx - 12, h - 100); x.lineTo(cx + 12, h - 100); x.moveTo(cx, h - 114); x.lineTo(cx - 4, h - 100); x.lineTo(cx, h - 88); x.lineTo(cx + 4, h - 100); x.closePath(); x.stroke();
    const s = { c, white: whiteOf(c), w, h };
    ART.set(key, s);
    return s;
  }
  // 主堡：漂浮的巨型鑽石（底座和鑽石分開畫，鑽石會上下浮動）
  function crystalSprite(team) {
    const key = 'c' + team;
    if (ART.has(key)) return ART.get(key);
    const P = PAL[team], sc = 4;
    const bw = 92, bh = 40, base = mkCv(bw * sc, bh * sc), bx = base.getContext('2d');
    bx.scale(sc, sc);
    const gb = bx.createLinearGradient(0, 0, bw, 0); gb.addColorStop(0, '#6b4718'); gb.addColorStop(0.4, '#f6dc9a'); gb.addColorStop(0.7, '#c9a35b'); gb.addColorStop(1, '#5a3a12');
    bx.fillStyle = '#3a2410'; bx.beginPath(); bx.ellipse(bw / 2, bh - 8, 44, 10, 0, 0, TAU); bx.fill();
    bx.fillStyle = gb; bx.fillRect(4, bh - 22, bw - 8, 14); bx.beginPath(); bx.ellipse(bw / 2, bh - 8, 42, 9, 0, 0, Math.PI); bx.fill();
    bx.fillStyle = '#fbe7b0'; bx.beginPath(); bx.ellipse(bw / 2, bh - 22, 42, 9, 0, 0, TAU); bx.fill();
    bx.fillStyle = P.glass2; bx.globalAlpha = 0.55; bx.beginPath(); bx.ellipse(bw / 2, bh - 22, 32, 6.5, 0, 0, TAU); bx.fill(); bx.globalAlpha = 1;
    bx.strokeStyle = 'rgba(255,255,255,.7)'; bx.lineWidth = 0.8; bx.beginPath(); bx.ellipse(bw / 2, bh - 22, 26, 5, 0, 0, TAU); bx.stroke();
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.08 + i * 0.105); const px = bw / 2 + Math.cos(a) * 41, py = bh - 15 + Math.sin(a) * 6; bx.fillStyle = i % 2 ? '#fff' : P.glass2; bx.beginPath(); bx.arc(px, py, 1.4, 0, TAU); bx.fill(); }
    const gw = 70, gh = 92, gem = mkCv(gw * sc, gh * sc), gx = gem.getContext('2d');
    gx.scale(sc, gh * sc / gh / 1); gx.setTransform(sc, 0, 0, sc, 0, 0);
    const cx = gw / 2, gy = 26;
    const pts = { tl: [cx - 14, 6], tr: [cx + 14, 6], gl: [cx - 32, gy], gr: [cx + 32, gy], bot: [cx, gh - 4] };
    const fg = gx.createLinearGradient(0, 0, gw, gh); fg.addColorStop(0, P.gem1); fg.addColorStop(0.45, P.gem2); fg.addColorStop(1, P.gem3);
    gx.fillStyle = fg; gx.beginPath(); gx.moveTo(...pts.tl); gx.lineTo(...pts.tr); gx.lineTo(...pts.gr); gx.lineTo(...pts.bot); gx.lineTo(...pts.gl); gx.closePath(); gx.fill();
    // 刻面
    gx.fillStyle = 'rgba(255,255,255,.55)'; gx.beginPath(); gx.moveTo(...pts.tl); gx.lineTo(cx, gy); gx.lineTo(...pts.gl); gx.fill();
    gx.fillStyle = 'rgba(255,255,255,.22)'; gx.beginPath(); gx.moveTo(...pts.gl); gx.lineTo(cx - 10, gy); gx.lineTo(...pts.bot); gx.fill();
    gx.fillStyle = 'rgba(0,0,0,.18)'; gx.beginPath(); gx.moveTo(...pts.gr); gx.lineTo(cx + 10, gy); gx.lineTo(...pts.bot); gx.fill();
    gx.fillStyle = 'rgba(255,255,255,.3)'; gx.beginPath(); gx.moveTo(...pts.tl); gx.lineTo(...pts.tr); gx.lineTo(cx, gy); gx.fill();
    gx.strokeStyle = 'rgba(255,255,255,.85)'; gx.lineWidth = 0.9; gx.beginPath();
    gx.moveTo(...pts.gl); gx.lineTo(...pts.gr);
    for (const k of [-32, -10, 10, 32]) { gx.moveTo(cx + k, gy); gx.lineTo(...pts.bot); }
    gx.moveTo(...pts.tl); gx.lineTo(cx - 10, gy); gx.moveTo(...pts.tr); gx.lineTo(cx + 10, gy); gx.moveTo(...pts.tl); gx.lineTo(cx, gy); gx.lineTo(...pts.tr);
    gx.stroke();
    gx.strokeStyle = 'rgba(255,255,255,.95)'; gx.lineWidth = 1.2; gx.beginPath(); gx.moveTo(...pts.tl); gx.lineTo(...pts.tr); gx.lineTo(...pts.gr); gx.lineTo(...pts.bot); gx.lineTo(...pts.gl); gx.closePath(); gx.stroke();
    const s = { base, gem, bw, bh, gw, gh, white: whiteOf(gem) };
    ART.set(key, s);
    return s;
  }
  function rubbleSprite(team) {
    const key = 'r' + team;
    if (ART.has(key)) return ART.get(key);
    const P = PAL[team], sc = 4, w = 64, h = 34, c = mkCv(w * sc, h * sc), x = c.getContext('2d');
    x.scale(sc, sc);
    x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(w / 2, h - 9, 28, 8, 0, 0, TAU); x.fill();
    const gb = x.createLinearGradient(0, 0, w, 0); gb.addColorStop(0, '#6b4718'); gb.addColorStop(0.45, '#d9b770'); gb.addColorStop(1, '#5a3a12');
    x.fillStyle = gb; x.beginPath(); x.moveTo(12, h - 8); x.lineTo(14, h - 18); x.lineTo(22, h - 15); x.lineTo(28, h - 22); x.lineTo(36, h - 16); x.lineTo(44, h - 20); x.lineTo(52, h - 12); x.lineTo(52, h - 8); x.closePath(); x.fill();
    const r = Core.rng(team + 7);
    for (let i = 0; i < 9; i++) {
      const px = 8 + r() * (w - 16), py = h - 6 - r() * 14, s = 2 + r() * 4;
      x.fillStyle = i % 3 ? P.glass2 : '#fff'; x.globalAlpha = 0.85;
      x.beginPath(); x.moveTo(px, py - s); x.lineTo(px + s * 0.7, py); x.lineTo(px, py + s * 0.6); x.lineTo(px - s * 0.7, py); x.fill();
    }
    x.globalAlpha = 1;
    const s = { c, w, h };
    ART.set(key, s);
    return s;
  }
  function shadowSp() {
    if (ART.has('sh')) return ART.get('sh');
    const c = mkCv(64, 32), x = c.getContext('2d'), g = x.createRadialGradient(32, 16, 0, 32, 16, 32);
    g.addColorStop(0, 'rgba(10,0,12,.55)'); g.addColorStop(0.6, 'rgba(10,0,12,.25)'); g.addColorStop(1, 'rgba(10,0,12,0)');
    x.setTransform(1, 0, 0, 0.5, 0, 8); x.fillStyle = g; x.fillRect(0, -16, 64, 64);
    ART.set('sh', c);
    return c;
  }

  // ---------- 伸展台地面（預先畫成分段圖） ----------
  function groundDeco(seed) {
    const r = Core.rng(seed), crowd = [], veins = [], sticks = [];
    for (const side of [0, 1]) for (let y = 8; y < MAP.h; y += 12) {
      const cols = side ? [MAP.r + 16, MAP.r + 29] : [MAP.l - 29, MAP.l - 16];
      cols.forEach((cx, ci) => {
        const x = cx + (r() - 0.5) * 5, yy = y + (ci ? 6 : 0) + (r() - 0.5) * 3;
        crowd.push({ x, y: yy, r: 3 + r() * 0.9, c: ['#3a1a3c', '#2f1530', '#43213f', '#2a1230'][Math.floor(r() * 4)] });
        if (r() < 0.22) sticks.push({ x: x + (side ? -3 : 3), y: yy - 4, c: ['#ff8fc0', '#ffe17a', '#8fd8ff', '#c79cff', '#ff6f8f'][Math.floor(r() * 5)], ph: r() * TAU });
      });
    }
    for (let i = 0; i < 70; i++) { const y = r() * MAP.h; veins.push({ x0: MAP.l + r() * (MAP.r - MAP.l), y0: y, x1: MAP.l + r() * (MAP.r - MAP.l), y1: y + (r() - 0.5) * 160, cx: MAP.l + r() * (MAP.r - MAP.l), cy: y + (r() - 0.5) * 120, a: 0.03 + r() * 0.06 }); }
    const bulbs = [];
    for (let y = 18; y < MAP.h; y += 30) for (const x of [112, 228]) bulbs.push({ x, y, ph: r() * TAU });
    return { crowd, veins, sticks, bulbs };
  }
  function paintGround(x, y0, y1, deco, foe) {
    const L = MAP.l, R = MAP.r, W = MAP.w;
    const bg = x.createLinearGradient(0, 0, 0, MAP.h);
    bg.addColorStop(0, '#2a0b20'); bg.addColorStop(0.2, '#26102e'); bg.addColorStop(0.5, '#1b1230'); bg.addColorStop(0.8, '#271030'); bg.addColorStop(1, '#311028');
    x.fillStyle = bg; x.fillRect(0, y0, W, y1 - y0);
    // 觀眾席
    for (const side of [0, 1]) {
      const g = x.createLinearGradient(side ? W : 0, 0, side ? R : L, 0); g.addColorStop(0, '#0e0514'); g.addColorStop(1, '#1f0e28');
      x.fillStyle = g; x.fillRect(side ? R + 6 : 0, y0, side ? W - R - 6 : L - 6, y1 - y0);
    }
    for (const a of deco.crowd) if (a.y > y0 - 8 && a.y < y1 + 8) {
      x.fillStyle = a.c; x.beginPath(); x.arc(a.x, a.y, a.r, 0, TAU); x.fill();
      x.beginPath(); x.ellipse(a.x, a.y + a.r * 1.7, a.r * 1.5, a.r * 0.9, 0, Math.PI, TAU); x.fill();
    }
    // 大理石地板
    const lg = x.createLinearGradient(L, 0, R, 0); lg.addColorStop(0, '#2a1536'); lg.addColorStop(0.5, '#3b2049'); lg.addColorStop(1, '#2a1536');
    x.fillStyle = lg; x.fillRect(L - 6, y0, R - L + 12, y1 - y0);
    x.save(); x.beginPath(); x.rect(L - 6, y0, R - L + 12, y1 - y0); x.clip();
    x.strokeStyle = 'rgba(236,208,138,.075)'; x.lineWidth = 0.7;
    const s0 = Math.floor((y0 - 400) / 34) * 34;
    for (let c = s0; c < y1 + 400; c += 34) { x.beginPath(); x.moveTo(L - 6, c); x.lineTo(R + 6, c + (R - L + 12)); x.moveTo(L - 6, c + (R - L + 12)); x.lineTo(R + 6, c); x.stroke(); }
    for (const v of deco.veins) if (Math.max(v.y0, v.y1) > y0 - 120 && Math.min(v.y0, v.y1) < y1 + 120) { x.strokeStyle = `rgba(255,236,250,${v.a})`; x.lineWidth = 0.8; x.beginPath(); x.moveTo(v.x0, v.y0); x.quadraticCurveTo(v.cx, v.cy, v.x1, v.y1); x.stroke(); }
    // 雙方領地光暈
    for (const [yy, col] of [[MAP.h, 'rgba(255,143,192,.20)'], [0, foe + '33']]) {
      const g = x.createRadialGradient(MAP.cx, yy, 20, MAP.cx, yy, 520); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(L - 6, y0, R - L + 12, y1 - y0);
    }
    x.restore();
    // 伸展台紅毯
    const cg = x.createLinearGradient(112, 0, 228, 0);
    cg.addColorStop(0, '#5e1338'); cg.addColorStop(0.12, '#8e2556'); cg.addColorStop(0.5, '#ad3268'); cg.addColorStop(0.88, '#8e2556'); cg.addColorStop(1, '#5e1338');
    x.fillStyle = cg; x.fillRect(112, y0, 116, y1 - y0);
    x.fillStyle = 'rgba(255,214,231,.07)';
    for (let yy = Math.floor(y0 / 26) * 26; yy < y1 + 26; yy += 26) for (const [xx, o] of [[134, 0], [152, 13], [170, 0], [188, 13], [206, 0]]) { const py = yy + o; x.beginPath(); x.moveTo(xx, py - 5); x.lineTo(xx + 4, py); x.lineTo(xx, py + 5); x.lineTo(xx - 4, py); x.fill(); }
    const sheen = x.createLinearGradient(112, 0, 228, 0); sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.35, 'rgba(255,255,255,.06)'); sheen.addColorStop(0.42, 'rgba(255,255,255,0)');
    x.fillStyle = sheen; x.fillRect(112, y0, 116, y1 - y0);
    for (const ex of [112, 228]) {
      const tg = x.createLinearGradient(ex - 3, 0, ex + 3, 0); tg.addColorStop(0, '#7a5520'); tg.addColorStop(0.5, '#fbe7b0'); tg.addColorStop(1, '#8a6224');
      x.fillStyle = tg; x.fillRect(ex - 2.5, y0, 5, y1 - y0);
    }
    x.strokeStyle = 'rgba(246,220,154,.35)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(119, y0); x.lineTo(119, y1); x.moveTo(221, y0); x.lineTo(221, y1); x.stroke();
    for (const b of deco.bulbs) if (b.y > y0 - 4 && b.y < y1 + 4) { x.fillStyle = '#fff1c9'; x.beginPath(); x.arc(b.x, b.y, 1.5, 0, TAU); x.fill(); }
    // 中線徽章
    if (y0 < 1020 && y1 > 880) {
      x.save(); x.translate(MAP.cx, MAP.h / 2);
      x.strokeStyle = 'rgba(246,220,154,.55)'; x.lineWidth = 1.6; x.beginPath(); x.arc(0, 0, 56, 0, TAU); x.stroke();
      x.lineWidth = 0.7; x.beginPath(); x.arc(0, 0, 49, 0, TAU); x.stroke();
      x.setLineDash([3, 5]); x.beginPath(); x.moveTo(-(MAP.cx - L), 0); x.lineTo(-58, 0); x.moveTo(58, 0); x.lineTo(R - MAP.cx, 0); x.stroke(); x.setLineDash([]);
      const sg = x.createLinearGradient(0, -26, 0, 26); sg.addColorStop(0, '#fff1c9'); sg.addColorStop(1, '#c9962e');
      x.fillStyle = sg; x.globalAlpha = 0.8; x.beginPath(); x.moveTo(0, -28); x.quadraticCurveTo(3, -3, 28, 0); x.quadraticCurveTo(3, 3, 0, 28); x.quadraticCurveTo(-3, 3, -28, 0); x.quadraticCurveTo(-3, -3, 0, -28); x.fill(); x.globalAlpha = 1;
      x.fillStyle = 'rgba(246,220,154,.75)'; x.font = 'italic 600 7px "Bodoni Moda", Georgia, serif'; x.textAlign = 'center'; x.fillText('RUNWAY  LEGENDS', 0, 41);
      x.restore();
    }
    // 防禦塔與主堡平台
    for (const sd of Core.STRUCTS) {
      if (sd.y < y0 - 90 || sd.y > y1 + 90) continue;
      const col = sd.team ? foe : '#ff8fc0', r = sd.kind === 'crystal' ? 72 : 32;
      x.save(); x.translate(MAP.cx, sd.y);
      const pg = x.createRadialGradient(0, 0, 4, 0, 0, r + 8); pg.addColorStop(0, col + '55'); pg.addColorStop(1, col + '00');
      x.fillStyle = pg; x.beginPath(); x.arc(0, 0, r + 8, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(246,220,154,.6)'; x.lineWidth = 1.2; x.beginPath();
      for (let i = 0; i <= 6; i++) { const a = i / 6 * TAU + Math.PI / 6; const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.62; i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
      if (sd.kind === 'crystal') {
        x.lineWidth = 0.7; x.beginPath(); x.ellipse(0, 0, r - 12, (r - 12) * 0.62, 0, 0, TAU); x.stroke();
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.beginPath(); x.moveTo(Math.cos(a) * (r - 12), Math.sin(a) * (r - 12) * 0.62); x.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.57); x.stroke(); }
      }
      x.restore();
    }
    // 噴泉（重生點）
    for (const [team, yy] of [[0, MAP.h], [1, 0]]) {
      if (Math.abs(yy - (y0 + y1) / 2) > (y1 - y0) / 2 + 130) continue;
      const col = team ? foe : '#ff9cc8';
      const g = x.createRadialGradient(MAP.cx, yy, 10, MAP.cx, yy, 130); g.addColorStop(0, col + 'aa'); g.addColorStop(0.6, col + '30'); g.addColorStop(1, col + '00');
      x.fillStyle = g; x.beginPath(); x.arc(MAP.cx, yy, 130, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(255,240,210,.5)'; x.lineWidth = 1.2; x.beginPath(); x.arc(MAP.cx, yy, 96, 0, TAU); x.stroke();
      x.setLineDash([2, 4]); x.beginPath(); x.arc(MAP.cx, yy, 110, 0, TAU); x.stroke(); x.setLineDash([]);
    }
    // 紅龍柱繩欄
    for (const ex of [L - 3, R + 3]) {
      x.strokeStyle = '#7a1030'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(ex, y0); x.lineTo(ex, y1); x.stroke();
      x.strokeStyle = 'rgba(255,150,180,.45)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(ex - 0.6, y0); x.lineTo(ex - 0.6, y1); x.stroke();
      for (let yy = Math.floor(y0 / 64) * 64; yy < y1 + 64; yy += 64) {
        const pg = x.createRadialGradient(ex - 1, yy - 1, 0.3, ex, yy, 4); pg.addColorStop(0, '#fff6d8'); pg.addColorStop(0.5, '#e2bd6a'); pg.addColorStop(1, '#7a5520');
        x.fillStyle = pg; x.beginPath(); x.arc(ex, yy, 3.6, 0, TAU); x.fill();
      }
    }
  }

  // ---------- 外框：畫面切換、計時器、提示泡泡、面板 ----------
  let heroesHook = null, hooked = false, current = null;
  function later(A, fn, ms) { const id = setTimeout(() => { A.timers.delete(id); if (A.alive) fn(); }, ms); A.timers.add(id); return id; }
  function swap(A, node) {
    const old = A.screen;
    node.classList.add('ar-scr');
    A.root.appendChild(node); A.screen = node;
    requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('on')));
    if (old) { old.classList.remove('on'); old.classList.add('off'); setTimeout(() => old.remove(), 480); }
    A.root.querySelectorAll('.ar-tip, .ar-sheet').forEach(n => n.remove());
  }
  function safeSound(api, k, ...a) { try { api.sound[k](...a); } catch (e) { /* 音效失敗不影響遊戲 */ } }
  function tip(A, target, html, dir = 'up', onDone) {
    if (!target || !A.alive) { if (onDone) onDone(); return; }
    const box = elx(`<div class="ar-tip ${dir}" role="note"><div class="tp-in">${html}</div><button class="tp-ok">知道了</button></div>`);
    A.root.appendChild(box);
    target.classList.add('ar-hl');
    const place = () => {
      const rr = A.root.getBoundingClientRect(), tr = target.getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight;
      const cx = tr.left + tr.width / 2 - rr.left, left = cl(cx - bw / 2, 10, rr.width - bw - 10);
      box.style.left = left + 'px';
      box.style.top = (dir === 'up' ? tr.top - rr.top - bh - 14 : tr.bottom - rr.top + 14) + 'px';
      box.style.setProperty('--ax', cl(cx - left, 18, bw - 18) + 'px');
    };
    place();
    const done = () => { if (!box.isConnected) return; box.classList.add('out'); target.classList.remove('ar-hl'); setTimeout(() => box.remove(), 250); if (onDone) onDone(); };
    box.addEventListener('click', () => { safeSound(A.api, 'click'); done(); });
    return done;
  }
  function sheet(A, { title, body, actions = [], cls = '', onOpen }) {
    A.root.querySelectorAll('.ar-sheet').forEach(n => n.remove());
    const node = elx(`<div class="ar-sheet ${cls}"><div class="sh-card" role="dialog" aria-modal="true"><button class="sh-x" aria-label="關閉">${ICON_X}</button>${title ? `<h3>${title}</h3>` : ''}<div class="sh-body">${body}</div>${actions.length ? `<div class="sh-acts">${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-i="${i}">${a.label}</button>`).join('')}</div>` : ''}</div></div>`);
    const close = () => { node.classList.add('out'); setTimeout(() => node.remove(), 220); };
    node.addEventListener('click', e => {
      if (e.target === node || e.target.closest('.sh-x')) { safeSound(A.api, 'click'); close(); return; }
      const b = e.target.closest('[data-i]'); if (!b) return;
      safeSound(A.api, 'click'); const a = actions[+b.dataset.i]; if (a.fn) a.fn(close); else close();
    });
    A.root.appendChild(node);
    if (onOpen) onOpen(node, close);
    return close;
  }

  function openArena(api) {
    if (!hooked && typeof api.on === 'function') { hooked = true; api.on('heroes', () => { try { if (heroesHook) heroesHook(); } catch (e) { console.error(e); } }); }
    const A = { api, timers: new Set(), alive: true, screen: null, battle: null, sel: store(api).last };
    current = A;
    const ov = api.overlay({
      id: 'arena', title: '名媛對決',
      beforeClose: () => {
        const B = A.battle;
        if (B && !B.done && !B.S.over) { askSurrender(A); return false; }
        return true;
      },
      onClose: () => {
        A.alive = false; heroesHook = null;
        if (A.battle) A.battle.stop();
        for (const t of A.timers) clearTimeout(t);
        A.timers.clear();
        if (current === A) current = null;
      },
    });
    A.ov = ov;
    A.root = elx('<div class="ar"></div>');
    ov.body.appendChild(A.root);
    A.root.addEventListener('contextmenu', e => e.preventDefault());
    showLobby(A);
  }

  // ---------- 標題大廳 ----------
  function showLobby(A) {
    const { api } = A, s = store(api), R = roster(api), r = s.rank, T = TIERS[r.tier], se = s.season;
    heroesHook = null;
    if (A.ov) A.ov.setTitle('名媛對決');
    const main = R[s.last] || R.erika, others = Core.HERO_IDS.filter(id => id !== main.id);
    const games = se.w + se.l, wr = games ? Math.round(se.w / games * 100) : 0;
    const coins = Math.round(api.betUnit() * T.coef);
    const node = elx(`<section class="ar-lobby" style="--hc:${main.color}">
      <div class="lb-bg"><i class="sp s1"></i><i class="sp s2"></i><i class="sp s3"></i>${motes(16)}</div>
      <div class="lb-stage">
        <img class="lb-side l" src="${R[others[0]].full}" alt="">
        <img class="lb-side r" src="${R[others[2]].full}" alt="">
        <div class="lb-floor"></div>
        <img class="lb-main" src="${main.full}" alt="${api.esc(main.name)}">
      </div>
      <header class="lb-title"><div class="lb-eye">RUNWAY LEGENDS · 3 VS 3</div><h1>名媛對決</h1><div class="lb-sub">伸展台競技場・S${se.n} 賽季</div></header>
      <div class="lb-panel">
        <button class="lb-rank" data-a="record" aria-label="賽季戰績">${emblem(r.tier, 58)}<span class="lb-rk"><b>${Core.rankName(r)}</b>${starsHTML(r)}<small>${games ? `${se.w} 勝 ${se.l} 敗・勝率 ${wr}%・MVP ${se.mvp}` : '還沒有戰績，來打第一場吧！'}</small></span><span class="lb-more">戰績 ›</span></button>
        <div class="lb-reward"><span>勝利獎勵</span><b>${api.icons.coin()}${api.fmt(coins)}</b><b>英雄碎片 ×1–3</b><b>寶石原石</b></div>
        <button class="btn goldb wide lb-go" data-a="start">排位賽・開始<small>${T.name}段位・獎勵係數 ×${T.coef}</small></button>
        <div class="lb-row"><button class="ar-pill" data-a="heroes">${svgI('shield')}英雄養成</button><button class="ar-pill" data-a="record">${svgI('verdict')}賽季戰績</button><button class="ar-pill" data-a="help">${svgI('pages')}玩法說明</button></div>
      </div>
    </section>`);
    node.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      safeSound(api, 'click');
      const a = b.dataset.a;
      if (a === 'start' || a === 'heroes') showSelect(A);
      else if (a === 'record') showRecord(A);
      else if (a === 'help') showHelp(A);
    });
    swap(A, node);
    if (!s.tut.lobby) { s.tut.lobby = 1; api.save(); later(A, () => tip(A, node.querySelector('.lb-go'), '第一次來嗎？選一位名媛，<b>3 對 3</b> 推倒對方的<b>鑽石主堡</b>就贏了！', 'up'), 900); }
  }

  // ---------- 選角＋英雄養成 ----------
  function showSelect(A) {
    const { api } = A;
    if (A.ov) A.ov.setTitle('名媛對決・選角');
    const node = elx(`<section class="ar-select">
      <div class="sl-head"><button class="sl-back" aria-label="返回大廳">${ICON_BACK}</button><div class="sl-ht"><div class="ar-eye">Choose Your Lady</div><h2>選擇出戰名媛</h2></div><div class="sl-rk"></div></div>
      <div class="sl-hero"></div>
      <div class="sl-roster"></div>
      <div class="sl-skills"></div>
      <div class="sl-grow"></div>
      <div class="sl-opts"></div>
      <div class="sl-foot"><button class="btn goldb wide sl-go">確認出戰<small></small></button></div>
    </section>`);
    let skSel = 2;
    const $ = q => node.querySelector(q);
    const render = () => {
      if (!A.alive) return;
      const s = store(api), R = roster(api), id = A.sel, h = R[id], H = HD[id], fash = fashionPct(api), atkP = perkVal(api, 'arena_atk');
      const mult = heroMult(api, R, id), power = Math.round(1000 * mult * (1 + atkP / 200));
      $('.sl-rk').innerHTML = `${emblem(s.rank.tier, 30)}<span>${Core.rankName(s.rank)}</span>`;
      $('.sl-hero').style.setProperty('--hc', h.color);
      $('.sl-hero').innerHTML = `<div class="sl-glow"></div>${motes(8)}<img class="sl-full" src="${h.full}" alt="">
        <div class="sl-info">
          <span class="sl-role">${svgI(ROLE_IC[H.role])}${Core.ROLE[H.role]}・${H.tag}</span>
          <h3>${api.esc(h.name)}</h3><div class="sl-title">${api.esc(h.title || '')}</div>
          <div class="sl-lv"><b>Lv.${h.lv}</b>${starDots(h.star, 6)}</div>
          <div class="sl-pow">戰力 <b>${power.toLocaleString()}</b><small>屬性 ×${mult.toFixed(2)}</small></div>
          ${id === 'erika' ? `<div class="sl-fash">${svgI('heal')}時尚加成 <b>+${fash}%</b><small>全屬性</small></div>` : ''}
          ${atkP > 0 ? `<div class="sl-fash perk">${svgI('atk')}王國研究 <b>攻擊 +${atkP}%</b></div>` : ''}
          <div class="sl-bars">${['生存', '攻擊', '控制', '機動'].map((n, i) => `<div><span>${n}</span><i><b style="width:${H.rate[i] * 20}%"></b></i></div>`).join('')}</div>
          <p class="sl-quote">「${LINES[id].pick}」</p>
        </div>`;
      const sks = [{ name: '普通攻擊', en: 'Basic', icon: 'atk', desc: H.range > 100 ? `自動遠程攻擊（射程 ${H.range}）。` : '自動近戰攻擊，貼身輸出。' }, ...H.skills];
      $('.sl-skills').innerHTML = `<div class="sk-row">${sks.map((k, i) => `<button class="sk-t ${i - 1 === skSel ? 'on' : ''} ${k.ult ? 'ult' : ''}" data-sk="${i - 1}" aria-label="${k.name}">${svgI(k.icon)}<small>${k.ult ? '大招' : i ? '技能' + i : '普攻'}</small></button>`).join('')}</div>
        <div class="sk-desc">${(() => { const k = sks[skSel + 1]; return `<b>${k.name}</b><em>${k.en}</em>${k.ult ? '<span class="tag ult">能量滿才能放</span>' : k.cd ? `<span class="tag">冷卻 ${k.cd} 秒</span>` : ''}<p>${k.desc}</p>`; })()}</div>`;
      const lvMax = !h.lvCost, starMax = !h.starNeed;
      $('.sl-grow').innerHTML = `<div class="gr"><div class="gr-t"><span>英雄等級</span><b>Lv.${h.lv}<small>/60</small></b></div><button class="btn ${lvMax ? 'off' : ''}" data-g="lv">${lvMax ? '已滿級' : '升級'}${lvMax ? '' : `<small>${api.icons.coin()}${api.fmt(h.lvCost)}</small>`}</button></div>
        <div class="gr"><div class="gr-t"><span>星等 ${starDots(h.star, 6)}</span><span class="gr-bar"><i style="width:${starMax ? 100 : Math.min(100, h.shards / h.starNeed * 100)}%"></i></span><small>碎片 ${h.shards}${starMax ? '' : ` / ${h.starNeed}`}</small></div><button class="btn goldb ${starMax || h.shards < h.starNeed ? 'off' : ''}" data-g="star">${starMax ? '已滿星' : '升星'}</button></div>`;
      $('.sl-roster').innerHTML = Core.HERO_IDS.map(k => { const x = R[k]; return `<button class="ro ${k === id ? 'on' : ''}" data-h="${k}" style="--hc:${x.color}" aria-label="${api.esc(x.name)}"><img src="${x.face('neutral')}" alt=""><span class="ro-r">${svgI(ROLE_IC[HD[k].role])}</span><b>${api.esc(x.name)}</b><small>Lv.${x.lv} ${'★'.repeat(x.star)}</small></button>`; }).join('');
      renderOpts();
      $('.sl-go small').textContent = `${Core.ROLE[H.role]}・${h.name}`;
    };
    const OPTS = { super: ['超神模式', 30, '全隊屬性 +30%・復活加快・陣亡原地復活一次・獎勵 ×2', 'sup'], coach: ['教練代打', 15, '職業級 AI 操作整場・妳的名媛屬性 +12%', 'coach'] };
    const optLabel = (k, btn) => { const on = !!store(api).pend[k], p = OPTS[k][1]; return on ? '本局已啟用' : btn && btn.dataset.confirm ? `再按一下確認 ${api.icons.gem()}${p}` : `${api.icons.gem()}${p}`; };
    const updOpt = btn => { if (!btn || !btn.isConnected) return; const k = btn.dataset.o; btn.classList.toggle('on', !!store(api).pend[k]); btn.querySelector('.pr').innerHTML = optLabel(k, btn); };
    const renderOpts = () => {
      const s = store(api);
      $('.sl-opts').innerHTML = Object.entries(OPTS).map(([k, [name, , desc, cls]]) => `<button class="opt ${cls} ${s.pend[k] ? 'on' : ''}" data-o="${k}"><b>${name}</b><small>${desc}</small><span class="pr">${optLabel(k)}</span></button>`).join('');
    };
    heroesHook = () => { if (A.screen === node) render(); };
    node.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('.sl-back')) { safeSound(api, 'click'); showLobby(A); return; }
      const ro = t.closest('[data-h]');
      if (ro) { if (A.sel !== ro.dataset.h) { A.sel = ro.dataset.h; safeSound(api, 'beep', 1046, 0.08, 'triangle', 0.05); skSel = 2; render(); const f = node.querySelector('.sl-full'); if (f) f.classList.add('pop'); } return; }
      const sk = t.closest('[data-sk]'); if (sk) { skSel = +sk.dataset.sk; safeSound(api, 'click'); render(); return; }
      const g = t.closest('[data-g]');
      if (g) {
        if (g.classList.contains('off') && g.dataset.g === 'lv') return;
        const ok = g.dataset.g === 'lv' ? heroLevelUp(api, A.sel, g) : heroStarUp(api, A.sel, g);
        if (ok) { const r = g.getBoundingClientRect(); api.fx.burst(r.left + r.width / 2, r.top + r.height / 2, 18, g.dataset.g === 'lv' ? ['spark', 'confetti'] : ['spark', 'heart', 'gem']); render(); }
        return;
      }
      const o = t.closest('[data-o]');
      if (o) {
        const k = o.dataset.o, s = store(api);
        if (s.pend[k]) { api.toast('這個加成本局已經啟用囉'); return; }
        api.twoTap(o, () => { if (api.spendGems(OPTS[k][1])) { store(api).pend[k] = true; api.save(); safeSound(api, 'buy'); const r = o.getBoundingClientRect(); api.fx.burst(r.left + r.width / 2, r.top + r.height / 2, 24, ['spark', 'gem']); api.toast(k === 'super' ? '超神模式啟動！下一局全隊 +30%、獎勵雙倍' : '教練就位！下一局交給職業選手', 'gold'); } updOpt(o); }, () => updOpt(o));
        return;
      }
      if (t.closest('.sl-go')) { const s = store(api); s.last = A.sel; api.save(); safeSound(api, 'click'); showMatch(A); }
    });
    render();
    swap(A, node);
  }

  // ---------- 組隊設定 ----------
  function buildConfig(A) {
    const { api } = A, s = store(api), R = roster(api), me = A.sel;
    const others = shuffle(Core.HERO_IDS.filter(id => id !== me));
    const ally = [me, others[0], others[1]], enemy = [others[2], others[3], others[4]];
    const fash = fashionPct(api), atkPerk = perkVal(api, 'arena_atk');
    const em = Core.enemyMult(s.rank), team = TEAMS[(s.team || 0) % TEAMS.length];
    s.team = ((s.team || 0) + 1) % TEAMS.length;
    const alt = Math.random() < 0.5 ? 0 : 1;
    const elv = Math.round(cl(1 + (em - 1) / 0.025, 1, 60));
    return {
      seed: (Math.random() * 2147483647) | 0, ally, enemy,
      allyMult: ally.map(id => heroMult(api, R, id)), allyAtk: 1 + atkPerk / 100,
      enemyMult: enemy.map(() => em * rnd(0.97, 1.03)), enemyAI: Core.enemySkill(s.rank), allyAI: cl(0.5 + s.rank.tier * 0.03, 0.5, 0.72),
      superMode: !!s.pend.super, coach: !!s.pend.coach, auto: !!s.pend.coach || !!s.auto, team,
      names: [ally.map(id => R[id].name), enemy.map(id => ALT[id][alt])],
      lv: [ally.map(id => R[id].lv || 1), enemy.map(() => cl(elv + Math.round(rnd(-2, 2)), 1, 60))],
      star: [ally.map(id => R[id].star || 1), enemy.map(() => cl(1 + Math.floor(s.rank.tier / 1.5), 1, 6))],
      rank0: { ...s.rank }, fash, atkPerk,
    };
  }
  async function prepArt(A, cfg) {
    const R = roster(A.api);
    cfg.art = [[], []];
    const jobs = [];
    for (const team of [0, 1]) (team ? cfg.enemy : cfg.ally).forEach((id, slot) => {
      const h = R[id], deg = team ? cfg.team.hue : 0;
      jobs.push(Promise.all([skinUrl(h.full, deg), skinUrl(h.face('neutral'), deg), skinUrl(h.face('joy'), deg), skinUrl(h.face('sad'), deg), loadImg(h.full)]).then(([full, face, joy, sad, img]) => {
        cfg.art[team][slot] = { full, face, joy, sad, spr: img ? heroSprite(img, deg) : null, color: team ? cfg.team.c : h.color };
      }));
    });
    await Promise.all(jobs);
  }

  // ---------- 配對中 ----------
  function showMatch(A) {
    const { api } = A, R = roster(api), me = R[A.sel];
    if (A.ov) A.ov.setTitle('排位配對');
    const cfg = buildConfig(A);
    const faces = Core.HERO_IDS.map(id => `<img src="${R[id].face('neutral')}" alt="">`).join('');
    const node = elx(`<section class="ar-mm" style="--hc:${me.color}">
      <div class="lb-bg"><i class="sp s1"></i><i class="sp s2"></i>${motes(12)}</div>
      <div class="mm-ring"><i class="r1"></i><i class="r2"></i><i class="r3"></i><img src="${me.face('neutral')}" alt=""></div>
      <b class="mm-t">正在搜尋對手…</b><span class="mm-s">已等待 <b class="num">0:00</b>・預估 0:03</span>
      <div class="mm-roll"><div>${faces}${faces}</div></div>
      <button class="btn ghost mm-x">取消配對</button>
    </section>`);
    let canceled = false, t0 = performance.now();
    const tick = () => { if (canceled || !A.alive || A.screen !== node) return; const s = Math.floor((performance.now() - t0) / 1000); node.querySelector('.mm-s b').textContent = `0:${String(s).padStart(2, '0')}`; later(A, tick, 250); };
    tick();
    node.querySelector('.mm-x').addEventListener('click', () => { canceled = true; safeSound(api, 'click'); showSelect(A); });
    swap(A, node);
    safeSound(api, 'drum');
    const minWait = new Promise(r => later(A, r, 1900));
    Promise.all([prepArt(A, cfg).catch(e => console.error(e)), minWait]).then(() => {
      if (canceled || !A.alive || A.screen !== node) return;
      node.classList.add('found');
      node.querySelector('.mm-t').textContent = '配對成功！';
      node.querySelector('.mm-s').innerHTML = `對手：<b style="color:${cfg.team.c}">${cfg.team.name}</b>`;
      safeSound(api, 'ding'); api.vib(20);
      later(A, () => showVS(A, cfg), 800);
    });
  }

  // ---------- VS 對陣 ----------
  function showVS(A, cfg) {
    const { api } = A;
    if (A.ov) A.ov.setTitle(`ERIKA百貨 VS ${cfg.team.name}`);
    const card = (team, i) => {
      const id = (team ? cfg.enemy : cfg.ally)[i], H = HD[id], a = cfg.art[team][i];
      return `<div class="vs-card ${team ? 'e' : 'a'} ${!team && !i ? 'ar-me' : ''}" style="--i:${i}"><div class="vs-pic"><img src="${a.full}" alt=""></div><div class="vs-cap"><b>${api.esc(cfg.names[team][i])}</b><small>${Core.ROLE[H.role]}・Lv.${cfg.lv[team][i]}</small></div>${!team && !i ? '<i class="vs-me">YOU</i>' : ''}</div>`;
    };
    const node = elx(`<section class="ar-vs" style="--tc:${cfg.team.c};--tc2:${cfg.team.c2}">
      <div class="vs-bg"><i class="vs-top"></i><i class="vs-bot"></i><i class="vs-slash"></i></div>
      <div class="vs-team e"><div class="vs-name"><small>${cfg.team.en}</small><b>${cfg.team.name}</b></div><div class="vs-row">${[0, 1, 2].map(i => card(1, i)).join('')}</div><p class="vs-say e">「${pickR(FOE_TAUNT)}」</p></div>
      <div class="vs-mid"><span class="v">V</span><span class="s">S</span><i class="vs-flash"></i></div>
      <div class="vs-team a"><p class="vs-say a">「${LINES[cfg.ally[0]].pick}」</p><div class="vs-row">${[0, 1, 2].map(i => card(0, i)).join('')}</div><div class="vs-name"><small>ERIKA</small><b>ERIKA百貨</b></div></div>
      <div class="vs-load"><span class="vs-bar"><i></i></span><b>名媛就位中… <span class="num">0</span>%</b></div>
      ${cfg.superMode || cfg.coach ? `<div class="vs-tags">${cfg.superMode ? '<span class="sup">超神模式</span>' : ''}${cfg.coach ? '<span class="coach">教練代打</span>' : ''}</div>` : ''}
    </section>`);
    swap(A, node);
    safeSound(api, 'beep', 220, 0.35, 'sawtooth', 0.05, 0.55); safeSound(api, 'hiss', 0.4, 0.08, 1500, 0.55); safeSound(api, 'ssr');
    later(A, () => api.vib([30, 40, 30]), 600);
    const bar = node.querySelector('.vs-bar i'), pct = node.querySelector('.vs-load .num');
    const t0 = performance.now(), dur = reducedMotion() ? 1200 : 3000;
    const step = () => {
      if (!A.alive || A.screen !== node) return;
      const p = Math.min(1, (performance.now() - t0) / dur);
      bar.style.width = (p * 100).toFixed(1) + '%'; pct.textContent = Math.floor(p * 100);
      if (p < 1) requestAnimationFrame(step);
      else later(A, () => startBattle(A, cfg), 250);
    };
    requestAnimationFrame(step);
  }

  // ---------- 面板：戰績、說明 ----------
  function showRecord(A) {
    const { api } = A, s = store(api), se = s.season, games = se.w + se.l, R = roster(api);
    const kda = games ? `${(se.k / games).toFixed(1)} / ${(se.d / games).toFixed(1)} / ${(se.a / games).toFixed(1)}` : '—';
    const ladder = TIERS.map((t, i) => `<div class="ld ${i === s.rank.tier ? 'on' : ''} ${i < s.rank.tier ? 'past' : ''}">${emblem(i, 34)}<small>${t.name}</small></div>`).join('');
    const hist = s.hist.slice(0, 12).map(h => `<li class="${h.win ? 'w' : 'l'}"><span class="hr">${h.win ? '勝' : '敗'}</span><img src="${(R[h.hero] || R.erika).face(h.win ? 'joy' : 'sad')}" alt=""><span class="hn"><b>${api.esc((R[h.hero] || R.erika).name)}</b><small>${h.k}/${h.d}/${h.a}${h.mvp ? '<i class="mvp">MVP</i>' : ''}</small></span><span class="hd">${h.delta || ''}<small>${mmss(h.t || 0)}</small></span></li>`).join('');
    sheet(A, {
      title: `S${se.n} 賽季戰績`, cls: 'rec',
      body: `<div class="rec-top">${emblem(s.rank.tier, 76)}<div><b>${Core.rankName(s.rank)}</b>${starsHTML(s.rank)}<small>最高段位：${Core.rankName(s.best)}</small></div></div>
        <div class="rec-stats"><div><b>${games}</b><small>場次</small></div><div><b>${games ? Math.round(se.w / games * 100) : 0}%</b><small>勝率</small></div><div><b>${se.mvp}</b><small>MVP</small></div><div><b>${se.bestStreak}</b><small>最高連勝</small></div></div>
        <div class="rec-kda">平均 KDA <b>${kda}</b></div>
        <div class="rec-ladder">${ladder}</div>
        <div class="rec-h">最近對戰</div>
        ${hist ? `<ol class="rec-list">${hist}</ol>` : '<div class="rec-empty">還沒有對戰紀錄<br><small>贏一場就會出現在這裡</small></div>'}
        <p class="rec-note">贏一場 +1 星、輸一場 −1 星；集滿星星再贏就晉級。<br>輸了但表現最好（敗方 MVP）可以保星。</p>`,
    });
  }
  function showHelp(A) {
    sheet(A, {
      title: '玩法說明', cls: 'help',
      body: `<ol class="help-list">
        <li><b>目標</b>3 對 3 在伸展台上推進，依序打倒對方的 2 座香水塔，再擊碎<b>鑽石主堡</b>就獲勝。一局約 2–4 分鐘。</li>
        <li><b>操作</b>左下搖桿移動；英雄會自動普攻。右下是技能，點了會<b>自動瞄準</b>。大招要等能量條集滿。</li>
        <li><b>懶人模式</b>按左上「自動」，名媛會自己走位、放技能。花粉鑽請「教練代打」，職業級操作再加屬性 +12%。</li>
        <li><b>小兵</b>粉絲團和狗仔隊會定時出動，跟著小兵一起推塔比較安全；防禦塔會優先攻擊小兵。</li>
        <li><b>段位</b>青銅 → 白銀 → 黃金 → 白金 → 鑽石 → 星耀 → 傳說。贏 +1 星、輸 −1 星。</li>
        <li><b>成長</b>英雄等級與星等和王國的名媛殿堂共用：用金幣升級、用對戰掉落的碎片升星，數值會變強。</li>
        <li><b>超神模式</b>花粉鑽讓全隊屬性 +30%、陣亡原地復活一次、獎勵雙倍。</li>
      </ol>`,
    });
  }
  function askSurrender(A) {
    sheet(A, {
      title: '要離開對戰嗎？', cls: 'confirm',
      body: '<p class="sh-p">現在離開會判定為<b>投降</b>，<br>這一局算輸（段位 −1 星）。</p>',
      actions: [{ label: '繼續戰鬥', cls: 'ghost' }, { label: '投降離開', fn: close => { close(); const B = A.battle; if (B && !B.done) B.surrender(); } }],
    });
  }

  // ---------- 戰鬥 ----------
  const STEP = 1 / 60, MIN_SC = 1.2;
  const HERO_COL = { erika: '#ff8fc0', vivi: '#9be07a', vita: '#5fd4ff', chiyo: '#ff8a5c', shino: '#9aa6ff', fumi: '#f2cf7a' };
  const PROJ_COL = { star: '#ffb3d6', macaron: '#ffd1e3', bolt: '#7fe3ff', neon: '#7fe3ff', ink: '#8e9cff', talisman: '#ffdf8a', flash: '#ffffff', drop: '#ff8fc0' };
  const PHASE_TXT = {
    1: ['決勝時刻', 'CLIMAX', '建築受到的傷害提高了'], 2: ['應援團長全面出動', 'SUPER FANS', '每一波都有超級粉絲'], 3: ['主堡防護減弱', 'BREAKTHROUGH', '建築越來越脆弱'],
    4: ['最終決戰', 'FINAL RUNWAY', '建築一碰就碎！'], 5: ['驟死時刻', 'SUDDEN DEATH', '復活時間大幅延長'],
  };
  const MULTI = { 2: ['雙殺！', 'DOUBLE KILL'], 3: ['三殺！', 'TRIPLE KILL'], 4: ['四殺！', 'QUADRA KILL'], 5: ['五殺！', 'PENTA KILL'] };

  function startBattle(A, cfg) {
    const { api } = A, s0 = store(api);
    s0.pend = {}; api.save(); // 加成在這局用掉
    if (A.ov) A.ov.setTitle(`ERIKA百貨 VS ${cfg.team.name}`);
    const S = Core.newMatch({ seed: cfg.seed, ally: cfg.ally, enemy: cfg.enemy, allyMult: cfg.allyMult, allyAtk: cfg.allyAtk, enemyMult: cfg.enemyMult, enemyAI: cfg.enemyAI, allyAI: cfg.allyAI, superMode: cfg.superMode, coach: cfg.coach, auto: cfg.auto });
    const P = Core.player(S), PH = HD[P.hid];
    const RM = reducedMotion();
    const B = { S, cfg, P, done: false, paused: true, t: 0, slow: null, input: { move: null, cast: [], recall: false }, stop: () => {}, surrender: () => {} };
    A.battle = B;
    const colOf = u => (u.team ? cfg.team.c : HERO_COL[u.hid] || '#ffd36b');
    const artOf = u => cfg.art[u.team][u.slot] || {};
    const nameOf = u => (u.kind === 'hero' ? cfg.names[u.team][u.slot] : u.kind === 'minion' ? Core.MINIONS[u.mk].name : u.kind === 'tower' ? '香水塔' : '鑽石主堡');
    const skBtn = i => {
      const k = PH.skills[i];
      return `<button class="sk s${i} ${k.ult ? 'ult' : ''}" data-i="${i}" aria-label="${k.name}">${k.ult ? `<span class="sk-face"><img src="${artOf(P).face}" alt=""></span><span class="sk-ring"></span>` : `<span class="sk-ic">${svgI(k.icon)}</span>`}<span class="sk-cd"></span><b class="sk-n num"></b><small class="sk-l">${k.name}</small></button>`;
    };
    const node = elx(`<section class="ar-battle" style="--hc:${HERO_COL[P.hid]};--tc:${cfg.team.c}">
      <canvas class="bt-cv" aria-label="戰場"></canvas><div class="bt-vig"></div><div class="bt-low"></div>
      <div class="bt-joyz" aria-hidden="true"></div>
      <div class="bt-top">
        <button class="bt-auto" aria-pressed="false"><i>${svgI(cfg.coach ? 'verdict' : 'dash')}</i><span><b>${cfg.coach ? '教練' : '自動'}</b><small>OFF</small></span></button>
        <div class="bt-score"><div class="sc a"><small>ERIKA</small><b class="num">0</b></div><div class="tm"><b class="num">00:00</b><small>準備中</small></div><div class="sc e"><small>${cfg.team.en}</small><b class="num">0</b></div></div>
        <canvas class="bt-mini" width="96" height="300" aria-hidden="true"></canvas>
      </div>
      <div class="bt-tags">${cfg.superMode ? '<span class="sup">超神模式</span>' : ''}${cfg.coach ? '<span class="coach">教練代打</span>' : ''}</div>
      <div class="bt-feed"></div><div class="bt-ann"></div>
      <div class="bt-joy"><div class="jb"><div class="jk"></div></div></div>
      <div class="bt-sk">${skBtn(0)}${skBtn(1)}${skBtn(2)}<button class="sk rc" data-rc aria-label="回城">${svgI('recall')}<small class="sk-l">回城</small><span class="sk-cd"></span></button></div>
      <div class="bt-dead" hidden><div class="dd-in"><small>DEFEATED</small><b>名媛暫時退場</b><span class="dd-n num">0</span><span class="dd-s">秒後回到伸展台</span><button class="btn gemb dd-rv">立即復活<small>${api.icons.gem()}10</small></button></div></div>
      <div class="bt-cine"></div><div class="bt-flash"></div><div class="bt-intro"></div>
    </section>`);
    const $ = q => node.querySelector(q);
    const cv = $('.bt-cv'), g = cv.getContext('2d'), mini = $('.bt-mini'), mg = mini.getContext('2d');
    let W = 1, Hh = 1, dpr = 1, k = 1, chunks = [];
    const deco = groundDeco(cfg.seed & 0xffff);
    function buildChunks() {
      const gg = k * dpr, CH = 380; chunks = [];
      for (let y = 0; y < MAP.h; y += CH) {
        const h = Math.min(CH, MAP.h - y), c = mkCv(MAP.w * gg, h * gg), x = c.getContext('2d');
        x.setTransform(gg, 0, 0, gg, 0, -y * gg);
        paintGround(x, y, y + h, deco, cfg.team.c);
        chunks.push({ c, y, h });
      }
    }
    function resize() {
      const r = node.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const nd = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; Hh = r.height;
      cv.width = Math.round(W * nd); cv.height = Math.round(Hh * nd);
      const nk = W / MAP.w;
      if (Math.abs(nk - k) > 0.005 || nd !== dpr || !chunks.length) { k = nk; dpr = nd; buildChunks(); }
    }

    // ---- 特效 ----
    const FX = { parts: [], texts: [], rings: [], beams: [], ghosts: [], meteors: [], bubbles: [], slashes: [], pillars: [], flashes: [], charge: new Map() };
    const addPart = p => { if (FX.parts.length > (RM ? 120 : 420)) FX.parts.shift(); FX.parts.push(p); };
    function burst(x, y, z, n, shapes, colors, o = {}) {
      if (RM) n = Math.ceil(n / 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, sp = rnd(0.3, 1) * (o.spd || 90);
        addPart({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55, vz: rnd(30, 150) * (o.up || 1), g: o.g ?? 240, t: 0, life: rnd(0.55, 1.1) * (o.life || 1), s: rnd(5, 9) * (o.size || 1), shape: pickR(shapes), c: pickR(colors), rot: rnd(0, TAU), vr: rnd(-7, 7), add: o.add });
      }
    }
    const ring = (x, y, r0, r1, life, color, w = 2, o = {}) => FX.rings.push({ x, y, r0, r1, t: 0, life, color, w, fill: o.fill || 0, z: o.z || 0 });
    function text(x, y, z, txt, color, size, o = {}) {
      if (FX.texts.length > 46) FX.texts.shift();
      FX.texts.push({ x: x + rnd(-7, 7), y, z, txt, color, size, t: 0, life: o.life || 0.95, crit: !!o.crit, vz: o.vz ?? 44, stroke: o.stroke || 'rgba(40,6,24,.92)' });
    }
    const pillar = (x, y, color, life = 0.9, w = 26) => FX.pillars.push({ x, y, color, t: 0, life, w });
    function ghostOf(u, life = 0.9, tint = '#ffffff', o = {}) {
      const spr = u.kind === 'hero' ? artOf(u).spr : u.kind === 'minion' ? minionSprite(u.mk, u.team) : null;
      if (!spr) return;
      const h = u.kind === 'hero' ? HD[u.hid].h : spr.h, w = h * spr.c.width / spr.c.height;
      FX.ghosts.push({ spr, x: u.x, y: u.y, w, h, t: 0, life, face: u.face, tint, dash: !!o.dash, a0: o.a0 ?? 1 });
    }
    function say(u, txt, life = 2.4) {
      if (!u || !txt || (u.sayCd && u.sayCd > B.t)) return;
      u.sayCd = B.t + 5;
      for (let i = FX.bubbles.length - 1; i >= 0; i--) if (FX.bubbles[i].id === u.id) FX.bubbles.splice(i, 1);
      FX.bubbles.push({ id: u.id, txt, t: 0, life });
    }

    // ---- 音效（限速，避免太吵） ----
    const sndAt = {};
    const sfx = (key, gap, fn) => { if (B.t - (sndAt[key] ?? -9) < gap) return; sndAt[key] = B.t; try { fn(api.sound); } catch (e) { /* 略 */ } };

    // ---- 相機 ----
    const cam = { x: MAP.cx, y: 260, z: 1, tz: 1, shake: 0, focus: null };
    let deathY = null;
    function updCam(dt) {
      const vh = Hh / (k * cam.z);
      let ty;
      if (cam.focus) ty = cam.focus.y - 20;
      else if (P.alive) ty = P.y - vh * 0.1;
      else ty = deathY ?? P.y;
      const sp = cam.focus ? 2.4 : B.intro ? 1.3 : 6;
      cam.y += (ty - cam.y) * Math.min(1, dt * sp);
      cam.z += (cam.tz - cam.z) * Math.min(1, dt * 4);
      const vh2 = Hh / (k * cam.z), vw = W / (k * cam.z);
      cam.y = cl(cam.y, vh2 / 2 - 30, MAP.h - vh2 / 2 + 30);
      const tx = cam.z > 1.01 && P.alive ? P.x : MAP.cx;
      cam.x += (tx - cam.x) * Math.min(1, dt * 5);
      cam.x = cl(cam.x, vw / 2, MAP.w - vw / 2);
      cam.shake = Math.max(0, cam.shake - dt * 28);
    }
    const shake = n => { if (!RM) cam.shake = Math.max(cam.shake, n); };

    // ---- 公告與擊殺訊息 ----
    const annQ = [];
    let annBusy = false;
    function announce(o) { if (annQ.length > 3) annQ.shift(); annQ.push(o); if (!annBusy) nextAnn(); }
    function nextAnn() {
      const o = annQ.shift();
      if (!o || !A.alive) { annBusy = false; return; }
      annBusy = true;
      const n = elx(`<div class="ann ${o.cls || ''}">${o.faces ? `<div class="an-f"><img src="${o.faces[0]}" alt="">${o.faces[1] ? `<i>${svgI('sword')}</i><img src="${o.faces[1]}" alt="">` : ''}</div>` : ''}<div class="an-t"><small>${o.en || ''}</small><b>${o.t}</b>${o.sub ? `<span>${api.esc(o.sub)}</span>` : ''}</div></div>`);
      $('.bt-ann').appendChild(n);
      if (o.snd) o.snd();
      later(A, () => { n.classList.add('out'); later(A, () => { n.remove(); nextAnn(); }, 320); }, o.dur || 1500);
    }
    function feed(kr, v) {
      const box = $('.bt-feed');
      const n = elx(`<div class="kf ${v.team ? 'a' : 'e'}">${kr ? `<img src="${artOf(kr).face}" alt="">` : `<span class="kf-x">${svgI(v.team ? 'shield' : 'atk')}</span>`}<i>${svgI('sword')}</i><img src="${artOf(v).face}" alt=""></div>`);
      box.prepend(n);
      while (box.children.length > 4) box.lastElementChild.remove();
      later(A, () => { n.classList.add('out'); later(A, () => n.remove(), 300); }, 4800);
    }

    // ---- 大招特寫 ----
    let miniCine = 0;
    function cine(u) {
      const big = u.id === P.id, sk = HD[u.hid].skills[2];
      if (!big && B.t - miniCine < 1.2) return;
      if (!big) miniCine = B.t;
      const n = elx(`<div class="cine ${big ? 'big' : 'mini'} ${u.team ? 'foe' : 'ally'}" style="--hc:${colOf(u)}"><div class="cn-band"><i class="cn-lines"></i><span class="cn-pic"><img class="cn-img" src="${artOf(u).full}" alt=""></span></div><div class="cn-txt"><small>ULTIMATE · ${sk.en}</small><b>${sk.name}</b><span>${api.esc(nameOf(u))}</span></div><i class="cn-flash"></i></div>`);
      $('.bt-cine').appendChild(n);
      later(A, () => n.remove(), big ? 1700 : 1350);
      if (big) {
        B.slow = { t: 0, dur: RM ? 0.6 : 1.15, scale: 0.08 };
        cam.tz = 1.1; later(A, () => { cam.tz = 1; }, 900);
        sfx('ult', 0.3, s => { s.ssr(); s.hiss(0.5, 0.06, 2500); });
        api.vib([20, 30, 60]);
      } else sfx('ultm', 0.5, s => { s.beep(660, 0.18, 'triangle', 0.05); s.beep(990, 0.25, 'triangle', 0.05, 0.08); });
      say(u, LINES[u.hid].ult, 1.8);
    }

    // ---- 事件 → 畫面與聲音 ----
    let immuneHint = 0, firstWave = true;
    function onEvents(ev) {
      for (const e of ev) {
        switch (e.t) {
          case 'dmg': {
            const t = S.byId.get(e.id), src = S.byId.get(e.src);
            if (!t) break;
            const mine = src && src.id === P.id, hurt = t.id === P.id, heroHit = t.kind === 'hero' && src && src.kind === 'hero';
            const z = t.kind === 'hero' ? HD[t.hid].h * 0.7 : Core.isStruct(t) ? 60 : 22;
            if (mine || hurt || heroHit) {
              const n = Math.round(e.n);
              if (n > 0) text(t.x, t.y, z, (e.crit ? '爆擊 ' : '') + n, hurt ? '#ff6b8b' : e.crit ? '#ffd76a' : e.k === 'magic' ? '#ffc4ec' : '#ffffff', e.crit ? 15 : mine ? 12 : 10, { crit: e.crit });
            }
            if (t.kind === 'hero' || mine) burst(t.x, t.y, z, e.crit ? 7 : 2, ['star', 'heart', 'coin'], ['#ffe08a', '#ff8fc0', '#ffffff'], { spd: 70, life: 0.7, size: 0.8 });
            if (mine) sfx('hit', 0.07, s => s.beep(e.crit ? 1760 : e.k === 'magic' ? 1320 : 980 + Math.random() * 120, 0.05, 'triangle', e.crit ? 0.05 : 0.03));
            if (hurt) { sfx('hurt', 0.25, s => s.beep(180, 0.07, 'square', 0.025)); if (e.n > P.maxHp * 0.08) api.vib(15); }
            if (Core.isStruct(t) && mine) sfx('thit', 0.3, s => s.hiss(0.06, 0.03, 1800));
            break;
          }
          case 'heal': { const t = S.byId.get(e.id); if (t && e.n >= 1 && (t.team === 0)) { text(t.x, t.y, HD[t.hid].h * 0.8, '+' + Math.round(e.n), '#7dffb0', 11, { stroke: 'rgba(6,40,24,.9)' }); burst(t.x, t.y, 30, 6, ['plus'], ['#7dffb0', '#ffb3d6'], { spd: 30, up: 0.6, g: -40, life: 1 }); } break; }
          case 'shield': { const t = S.byId.get(e.id); if (t) ring(t.x, t.y - 36, 10, 34, 0.45, '#bfe4ff', 2); break; }
          case 'impact': {
            const c = e.fx === 'drop' ? (e.team ? cfg.team.c : '#ff8fc0') : PROJ_COL[e.fx] || '#fff';
            burst(e.x, e.y, 30, e.crit ? 6 : e.fx === 'drop' ? 5 : 2, ['star'], [c, '#ffffff'], { spd: 60, life: 0.5, add: true, size: 0.8 });
            if (e.fx === 'drop') ring(e.x, e.y, 4, 22, 0.35, c, 2);
            break;
          }
          case 'cast': {
            const u = S.byId.get(e.id); if (!u) break;
            const c = colOf(u);
            ring(u.x, u.y, 6, 34, 0.4, c, 2);
            if (u.id === P.id) { sfx('cast', 0.05, s => { s.beep(880, 0.1, 'sine', 0.06); s.beep(1320, 0.14, 'sine', 0.05, 0.05); }); pressFx(e.i); }
            if ((u.hid === 'vita' && e.i === 1) || (u.hid === 'chiyo' && e.i === 0) || (u.hid === 'fumi' && e.i === 2)) burst(u.x, u.y, 10, 8, ['star'], [c, '#fff'], { spd: 60, add: true });
            if (u.hid === 'erika' && e.i === 2 && u.team === 0 && u.id !== P.id) say(u, LINES.erika.ult);
            break;
          }
          case 'ult': { const u = S.byId.get(e.id); if (u) cine(u); break; }
          case 'charge': FX.charge.set(e.id, { t: 0, life: 0.42 }); break;
          case 'beam': {
            const u = S.byId.get(e.id), c = u ? colOf(u) : '#fff';
            FX.beams.push({ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, w: e.w, t: 0, life: e.fx === 'laser' ? 0.55 : 0.38, c, fx: e.fx });
            if (e.fx === 'laser') { shake(7); for (let i = 0; i < 14; i++) { const p = Math.random(); burst(e.x1 + (e.x2 - e.x1) * p, e.y1 + (e.y2 - e.y1) * p, 30, 1, ['star'], [c, '#fff'], { spd: 50, add: true }); } sfx('laser', 0.2, s => { s.hiss(0.45, 0.07, 900); s.beep(140, 0.4, 'sawtooth', 0.05); }); }
            else sfx('beam', 0.15, s => s.beep(1500, 0.2, 'sine', 0.04));
            break;
          }
          case 'zhit': onZone(e); break;
          case 'slash': {
            const u = S.byId.get(e.id), c = u ? colOf(u) : '#fff';
            FX.slashes.push({ x: e.x, y: e.y - 34, t: 0, life: e.big ? 0.5 : 0.3, c, big: !!e.big });
            burst(e.x, e.y, 34, e.big ? 22 : 8, e.big ? ['petal', 'star'] : ['star'], [c, '#ffffff', '#ffb3c8'], { spd: e.big ? 120 : 70, add: !e.big });
            if (e.big) { shake(8); flash(0.35); }
            sfx('slash', 0.1, s => s.hiss(0.12, 0.06, 4000));
            break;
          }
          case 'aura': {
            const u = S.byId.get(e.id); if (!u) break;
            const c = e.fx === 'tea' ? '#ffd36b' : e.fx === 'tray' ? '#e6ecff' : '#ffd1ea';
            ring(u.x, u.y, 10, e.r, e.fx === 'tea' ? 0.9 : 0.55, c, e.fx === 'tea' ? 4 : 2.5, { fill: 0.12 });
            for (const a of S.heroes[u.team]) if (a.alive && Math.hypot(a.x - u.x, a.y - u.y) < e.r) burst(a.x, a.y, 20, e.fx === 'tea' ? 10 : 5, e.fx === 'sugar' ? ['bubble'] : ['star', 'heart'], [c, '#ffffff'], { spd: 40, up: 0.8, g: -30, life: 1.2 });
            if (u.team === 0) sfx('aura', 0.2, s => { s.beep(1046, 0.2, 'sine', 0.05); s.beep(1568, 0.3, 'sine', 0.04, 0.08); });
            break;
          }
          case 'kill': onKill(e); break;
          case 'die': {
            const u = { x: e.x, y: e.y, kind: 'minion', mk: e.mk, team: e.team, face: 1 };
            ghostOf(u, 0.6);
            burst(e.x, e.y, 14, 6, ['star', 'heart'], ['#ffe08a', '#ff8fc0', '#fff'], { spd: 55, life: 0.8 });
            if (e.src === P.id) { burst(e.x, e.y, 18, 3, ['coin'], ['#fff'], { spd: 40, up: 1.2 }); sfx('lh', 0.08, s => s.beep(2093, 0.07, 'triangle', 0.035)); }
            break;
          }
          case 'struct': onStruct(e); break;
          case 'lvl': {
            const u = S.byId.get(e.id); if (!u) break;
            if (u.id === P.id) { ring(u.x, u.y, 10, 40, 0.7, '#ffd36b', 3); text(u.x, u.y, 96, `升級！Lv.${e.lvl}`, '#ffe9a8', 11, { life: 1.3, vz: 24 }); burst(u.x, u.y, 40, 12, ['star'], ['#ffd36b', '#fff'], { add: true, up: 1.2 }); sfx('lvl', 0.2, s => s.ding()); }
            break;
          }
          case 'respawn': {
            const u = S.byId.get(e.id); if (!u) break;
            pillar(u.x, u.y, colOf(u), 0.9);
            if (u.id === P.id) { deathY = null; $('.bt-cv').classList.remove('dead'); sfx('resp', 0.3, s => s.level()); say(u, e.inPlace ? '我還沒認輸呢！' : LINES[u.hid].back); }
            break;
          }
          case 'recall': if (e.id === P.id) sfx('rc', 0.3, s => s.beep(784, 0.3, 'sine', 0.04)); break;
          case 'recalled': { const u = S.byId.get(e.id); if (u) { pillar(u.x, u.y, colOf(u), 0.8); if (u.id === P.id) sfx('rcd', 0.3, s => s.ding()); } break; }
          case 'cc': { const t = S.byId.get(e.id); if (t && (t.id === P.id || t.kind === 'hero')) text(t.x, t.y, (t.kind === 'hero' ? HD[t.hid].h : 30) + 6, '暈眩', '#c9d3ff', 9, { life: 0.8, vz: 20 }); break; }
          case 'immune': if (e.src === P.id && B.t - immuneHint > 2.5) { immuneHint = B.t; const t = S.byId.get(e.id); if (t) text(t.x, t.y, 90, '無敵！先打倒前面的塔', '#ffe9a8', 9, { life: 1.3, vz: 18 }); } break;
          case 'castFail': if (e.id === P.id) failFx(e.i, e.why); break;
          case 'wave': if (firstWave) { firstWave = false; announce({ t: '粉絲團出動！', en: 'FANS INCOMING', sub: '跟著小兵一起推進吧', cls: 'info', dur: 1300, snd: () => safeSound(api, 'fever') }); } break;
          case 'phase': { const p = PHASE_TXT[e.n]; if (p) announce({ t: p[0], en: p[1], sub: p[2], cls: 'phase', dur: 1700, snd: () => safeSound(api, 'drum') }); break; }
          case 'end': onEnd(e); break;
        }
      }
    }
    function onZone(e) {
      const src = S.byId.get(e.src), c = src ? colOf(src) : '#fff';
      switch (e.fx) {
        case 'burst':
          ring(e.x, e.y, 8, e.r * 1.15, 0.45, c, 3, { fill: 0.18 }); FX.flashes.push({ x: e.x, y: e.y, r: e.r * 1.4, t: 0, life: 0.25, c });
          burst(e.x, e.y, 10, 24, ['star'], [c, '#fff', '#ffe08a'], { spd: 130, add: true, up: 1.3 });
          sfx('zb', 0.08, s => { s.beep(1200, 0.12, 'triangle', 0.05); s.hiss(0.2, 0.04, 3000); }); break;
        case 'meteor':
          for (let i = 0; i < 4; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * e.r * 0.8; FX.meteors.push({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r * 0.8, t: -i * 0.04, life: 0.22, c }); }
          ring(e.x, e.y, 20, e.r, 0.5, c, 3, { fill: 0.1 }); shake(5);
          sfx('met', 0.1, s => { s.hiss(0.3, 0.07, 700); s.beep(110, 0.3, 'sine', 0.06); }); break;
        case 'pages':
          for (let i = 0; i < (RM ? 6 : 16); i++) { const a = Math.random() * TAU; addPart({ x: e.x + Math.cos(a) * e.r * 0.6, y: e.y + Math.sin(a) * e.r * 0.4, z: rnd(10, 50), vx: -Math.sin(a) * 120, vy: Math.cos(a) * 60, vz: rnd(20, 80), g: 40, t: 0, life: rnd(0.7, 1.1), s: rnd(6, 9), shape: 'page', c: c, rot: rnd(0, TAU), vr: rnd(-8, 8) }); }
          ring(e.x, e.y, 10, e.r, 0.6, c, 2, { fill: 0.12 });
          sfx('pg', 0.1, s => s.hiss(0.4, 0.05, 2200)); break;
        case 'seal':
          FX.pillars.push({ x: e.x, y: e.y, color: c, t: 0, life: 0.9, w: e.r * 0.7 });
          ring(e.x, e.y, e.r, e.r * 0.2, 0.6, c, 4, { fill: 0.2 }); ring(e.x, e.y, 10, e.r * 1.1, 0.7, '#ffffff', 2);
          burst(e.x, e.y, 20, 30, ['star'], [c, '#fff'], { spd: 150, add: true }); shake(8); flash(0.25);
          sfx('seal', 0.2, s => { s.beep(330, 0.5, 'sine', 0.06); s.beep(495, 0.5, 'sine', 0.05, 0.05); s.hiss(0.5, 0.05, 1200); }); break;
        case 'petal':
          for (let i = 0; i < (RM ? 8 : 26); i++) { const a = i / 26 * TAU; addPart({ x: e.x + Math.cos(a) * 14, y: e.y + Math.sin(a) * 10, z: rnd(10, 40), vx: Math.cos(a + 1.2) * 170, vy: Math.sin(a + 1.2) * 90, vz: rnd(10, 60), g: 60, t: 0, life: rnd(0.5, 0.9), s: rnd(6, 9), shape: 'petal', c: '#ff9ec0', rot: a, vr: rnd(-10, 10) }); }
          ring(e.x, e.y, 10, e.r, 0.35, c, 3);
          sfx('pt', 0.1, s => s.hiss(0.25, 0.06, 5000)); break;
        case 'taunt':
          ring(e.x, e.y, 10, e.r, 0.5, '#ff5a7a', 4, { fill: 0.15 }); ring(e.x, e.y, 10, e.r * 0.7, 0.4, '#ffd36b', 2);
          for (const u of S.units) if (u.alive && u.taunt === e.src) text(u.x, u.y, 56, '！', '#ff5a7a', 14, { life: 0.8, vz: 10 });
          sfx('tn', 0.2, s => { s.beep(392, 0.15, 'square', 0.03); s.beep(523, 0.2, 'square', 0.03, 0.1); }); break;
        case 'slam':
          ring(e.x, e.y, 10, e.r * 1.1, 0.55, '#ffd36b', 5, { fill: 0.2 }); ring(e.x, e.y, 6, e.r * 0.6, 0.4, '#ffffff', 3);
          burst(e.x, e.y, 6, 24, ['star', 'coin'], ['#ffd36b', '#fff'], { spd: 140, up: 1.4 }); shake(10); flash(0.2);
          sfx('slam', 0.2, s => { s.hiss(0.4, 0.09, 500); s.beep(90, 0.35, 'sine', 0.08); }); break;
      }
    }
    function onKill(e) {
      const v = S.byId.get(e.victim), kr = e.killer ? S.byId.get(e.killer) : null;
      if (!v) return;
      ghostOf(v, 1);
      burst(v.x, v.y, 36, 26, ['star', 'heart', 'coin', 'gem'], ['#ffe08a', '#ff8fc0', '#ffffff', colOf(v)], { spd: 110, up: 1.4, life: 1.2 });
      pillar(v.x, v.y, colOf(v), 1, 34);
      feed(kr, v);
      const allyKill = v.team === 1, faces = [kr ? artOf(kr).face : null, artOf(v).face].filter(Boolean);
      const cls = allyKill ? 'ally' : 'foe';
      const sub = kr ? `${nameOf(kr)} 擊敗了 ${nameOf(v)}` : `${nameOf(v)} 倒下了`;
      if (e.first) announce({ t: '首殺！', en: 'FIRST BLOOD', sub, faces, cls: cls + ' big', dur: 1700, snd: () => { safeSound(api, 'fever'); } });
      if (e.multi >= 2 && kr) { const m = MULTI[Math.min(5, e.multi)]; announce({ t: m[0], en: m[1], sub: nameOf(kr), faces: [artOf(kr).face], cls: cls + ' big multi', dur: 1600, snd: () => { safeSound(api, e.multi >= 3 ? 'ssr' : 'level'); } }); }
      if (e.ace) announce({ t: '團滅！', en: 'ACE', sub: allyKill ? `${cfg.team.name}全員倒地！` : '我方全員倒地…', cls: cls + ' big ace', dur: 1800, snd: () => { safeSound(api, 'ssr'); safeSound(api, 'fever'); } });
      if (!e.first && !(e.multi >= 2) && !e.ace) {
        if (kr && kr.id === P.id) announce({ t: '擊殺！', en: 'KILL', sub, faces, cls: 'ally', dur: 1200, snd: () => safeSound(api, 'cash') });
        else if (v.id === P.id) announce({ t: '妳被擊敗了', en: 'DEFEATED', sub, faces, cls: 'foe', dur: 1300, snd: () => safeSound(api, 'err') });
        else sfx('kill', 0.3, s => s.beep(allyKill ? 1318 : 330, 0.18, 'triangle', 0.05));
      }
      if (kr && kr.kind === 'hero' && (kr.id === P.id || Math.random() < 0.5)) say(kr, LINES[kr.hid].kill);
      if (v.id === P.id) {
        deathY = v.y; $('.bt-cv').classList.add('dead'); api.vib([40, 60, 40]);
        if (S.superMode && P.revives > 0) later(A, () => { if (!P.alive && !S.over && P.revives > 0) { P.revives--; Core.revive(S, P); announce({ t: '超神復活！', en: 'REVIVE', cls: 'ally', dur: 1100, snd: () => safeSound(api, 'level') }); } }, 1300);
      } else if (v.team === 0 && v.alive === false && Math.random() < 0.4) { /* 隊友倒地 */ }
      for (const h of S.heroList) if (h.alive && h.team === v.team && h !== v && h.hp < h.maxHp * 0.25 && Math.random() < 0.3) say(h, LINES[h.hid].low);
    }
    function onStruct(e) {
      const ally = e.team === 1, c = e.team ? cfg.team.c : '#ff8fc0';
      const big = e.kind === 'crystal';
      burst(e.x, e.y, big ? 70 : 60, big ? 70 : 44, ['gem', 'star', 'coin'], [c, '#ffffff', '#ffe08a'], { spd: big ? 220 : 160, up: 2, life: 1.6 });
      ring(e.x, e.y, 10, big ? 160 : 110, 0.8, c, 5, { fill: 0.2 }); ring(e.x, e.y, 10, big ? 90 : 70, 0.6, '#ffffff', 3);
      pillar(e.x, e.y, c, 1.2, big ? 70 : 46);
      shake(big ? 16 : 11); flash(big ? 0.6 : 0.3);
      sfx('tw', 0.2, s => { s.hiss(0.8, 0.1, 400); s.beep(110, 0.6, 'sawtooth', 0.06); s.beep(82, 0.8, 'sine', 0.08, 0.1); });
      if (!big) announce({ t: ally ? '摧毀防禦塔！' : '我方防禦塔被摧毀', en: ally ? 'TOWER DESTROYED' : 'TOWER LOST', sub: ally ? '粉絲團士氣大振！' : '快回防！', cls: ally ? 'ally' : 'foe', dur: 1500, snd: () => safeSound(api, ally ? 'cash' : 'err') });
      api.vib(ally ? 30 : [30, 30, 30]);
    }
    function onEnd(e) {
      const win = e.winner === 0, cr = S.byId.get(e.id);
      cam.focus = cr || null; cam.tz = 1.08;
      B.slow = { t: 0, dur: 2.2, scale: 0.25 };
      later(A, () => { if (A.alive && !B.done) announce({ t: win ? '勝利！' : '主堡被擊碎', en: win ? 'VICTORY' : 'DEFEAT', cls: (win ? 'ally' : 'foe') + ' big end', dur: 1600, snd: () => { if (win) { safeSound(api, 'ssr'); safeSound(api, 'cash'); } else { safeSound(api, 'beep', 523, 0.3, 'triangle', 0.07); safeSound(api, 'beep', 392, 0.3, 'triangle', 0.07, 0.25); safeSound(api, 'beep', 262, 0.6, 'triangle', 0.07, 0.5); } } }); }, 500);
      later(A, () => finish(false), 3000);
    }
    const flash = a => { const f = $('.bt-flash'); f.style.transition = 'none'; f.style.opacity = String(RM ? a * 0.4 : a); requestAnimationFrame(() => { f.style.transition = 'opacity .45s ease-out'; f.style.opacity = '0'; }); };
    function pressFx(i) { const b = node.querySelector(`.sk[data-i="${i}"]`); if (b) { b.classList.remove('fire'); void b.offsetWidth; b.classList.add('fire'); } }
    function failFx(i, why) {
      const b = node.querySelector(`.sk[data-i="${i}"]`); if (!b) return;
      b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
      const msg = { cd: i === 2 ? '能量還沒滿' : '冷卻中', none: '範圍內沒有目標', stun: '被控制了！', busy: '動作中' }[why] || '';
      if (msg && why !== 'busy') text(P.x, P.y, HD[P.hid].h + 18, msg, '#ffe9a8', 9, { life: 0.9, vz: 16 });
      sfx('fail', 0.2, s => s.beep(300, 0.08, 'square', 0.025));
    }

    // ---- 每幀更新特效 ----
    function stepFx(dt) {
      for (let i = FX.parts.length - 1; i >= 0; i--) {
        const p = FX.parts[i]; p.t += dt;
        if (p.t >= p.life) { FX.parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.g * dt; p.rot += p.vr * dt;
        if (p.z < 0) { p.z = 0; p.vz *= -0.35; p.vx *= 0.7; p.vy *= 0.7; }
      }
      for (const arr of [FX.texts, FX.rings, FX.beams, FX.ghosts, FX.meteors, FX.bubbles, FX.slashes, FX.pillars, FX.flashes]) {
        for (let i = arr.length - 1; i >= 0; i--) { const o = arr[i]; o.t += dt; if (o.t >= o.life) { arr.splice(i, 1); if (o === undefined) continue; if (arr === FX.meteors) meteorHit(o); } }
      }
      for (const t of FX.texts) t.z += t.vz * dt * (1 - t.t / t.life);
      for (const [id, c] of FX.charge) { c.t += dt; if (c.t >= c.life) FX.charge.delete(id); }
    }
    function meteorHit(m) { ring(m.x, m.y, 4, 30, 0.35, m.c, 3, { fill: 0.25 }); burst(m.x, m.y, 4, 7, ['star'], [m.c, '#fff', '#ffe08a'], { spd: 90, add: true }); }

    // ---- 繪製 ----
    const SH = shadowSp();
    function drawLights(t, top, bot) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const sp = glowSp('#ffd6ec', 0.15);
      for (let i = 0; i < 3; i++) {
        const lx = MAP.cx + Math.sin(t * 0.33 + i * 2.1) * 95, ly = cam.y + Math.cos(t * 0.21 + i * 1.7) * (bot - top) * 0.3;
        g.globalAlpha = 0.11; g.drawImage(sp, lx - 120, ly - 90, 240, 180);
      }
      const bl = glowSp('#ffd9a0', 0.3);
      for (const b of deco.bulbs) if (b.y > top && b.y < bot) { g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 3 + b.ph); g.drawImage(bl, b.x - 7, b.y - 7, 14, 14); }
      for (const s of deco.sticks) if (s.y > top && s.y < bot) { g.globalAlpha = 0.45 + 0.4 * Math.sin(t * 4 + s.ph); g.drawImage(glowSp(s.c, 0.3), s.x - 5, s.y - 5, 10, 10); }
      if (!RM && Math.random() < 0.08) FX.flashes.push({ x: Math.random() < 0.5 ? rnd(6, MAP.l - 10) : rnd(MAP.r + 10, MAP.w - 6), y: rnd(top + 40, bot - 40), r: 16, t: 0, life: 0.18, c: '#ffffff', cam: true });
      g.restore();
    }
    function drawDecals(t) {
      // 技能預警圈
      for (const z of S.zones) {
        if (z.hi >= z.hits.length) continue;
        const src = S.byId.get(z.src), c = src ? colOf(src) : '#fff', p = cl(z.t / z.hits[z.hits.length - 1], 0, 1);
        g.save(); g.translate(z.x, z.y); g.scale(1, 0.62);
        g.globalAlpha = 0.18 + 0.1 * Math.sin(t * 18); g.fillStyle = c; g.beginPath(); g.arc(0, 0, z.r, 0, TAU); g.fill();
        g.globalAlpha = 0.9; g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, z.r, 0, TAU); g.stroke();
        g.lineWidth = 3; g.beginPath(); g.arc(0, 0, z.r * (1 - p * 0.85), 0, TAU); g.stroke();
        if (z.fx === 'seal' || z.fx === 'meteor') {
          g.rotate(t * (z.fx === 'seal' ? 1.5 : -2)); g.lineWidth = 1.2; g.setLineDash([6, 6]); g.beginPath(); g.arc(0, 0, z.r * 0.78, 0, TAU); g.stroke(); g.setLineDash([]);
          for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * z.r * 0.5, Math.sin(a) * z.r * 0.5); g.lineTo(Math.cos(a) * z.r * 0.78, Math.sin(a) * z.r * 0.78); g.stroke(); }
        }
        g.restore();
      }
      // 敵方防禦塔射程與鎖定警示
      if (P.alive) for (const s of S.units) {
        if (!s.alive || !Core.isStruct(s) || s.team === 0) continue;
        const d = Math.hypot(P.x - s.x, P.y - s.y);
        if (d > s.range + 110) continue;
        const locked = s.tgt === P.id;
        g.save(); g.translate(s.x, s.y); g.scale(1, 0.62);
        g.strokeStyle = locked ? 'rgba(255,70,100,.9)' : 'rgba(255,120,150,.45)'; g.lineWidth = locked ? 2.4 : 1.4;
        g.setLineDash([10, 8]); g.lineDashOffset = -t * 30; g.beginPath(); g.arc(0, 0, s.range, 0, TAU); g.stroke(); g.setLineDash([]);
        if (locked) { g.globalAlpha = 0.08 + 0.06 * Math.sin(t * 10); g.fillStyle = '#ff2050'; g.beginPath(); g.arc(0, 0, s.range, 0, TAU); g.fill(); }
        g.restore();
        if (locked) { g.save(); g.strokeStyle = `rgba(255,60,90,${0.5 + 0.4 * Math.sin(t * 14)})`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(s.x, s.y - 96); g.lineTo(P.x, P.y - 30); g.stroke(); g.restore(); }
      }
      // 回城光圈
      for (const h of S.heroList) if (h.alive && h.recall > 0) {
        g.save(); g.translate(h.x, h.y); g.scale(1, 0.55);
        g.strokeStyle = '#ffd36b'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - h.recall / 3)); g.stroke();
        g.globalAlpha = 0.25; g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill(); g.restore();
        if (Math.random() < 0.3) addPart({ x: h.x + rnd(-14, 14), y: h.y, z: 0, vx: 0, vy: 0, vz: rnd(40, 80), g: 0, t: 0, life: 0.8, s: 5, shape: 'star', c: '#ffd36b', rot: 0, vr: 0, add: true });
      }
    }
    function drawShadow(u) {
      if (u.kind === 'hero') { if (!u.alive) return; g.drawImage(SH, u.x - 20, u.y - 7, 40, 14); }
      else if (u.kind === 'minion') g.drawImage(SH, u.x - 14, u.y - 5, 28, 10);
      else if (u.alive) g.drawImage(SH, u.x - (u.kind === 'crystal' ? 50 : 32), u.y - 12, u.kind === 'crystal' ? 100 : 64, 24);
    }
    function drawUnit(u, t) {
      if (u.kind === 'hero') return drawHero(u, t);
      if (u.kind === 'minion') {
        const s = minionSprite(u.mk, u.team), sw = s.w * MIN_SC, sh = s.h * MIN_SC, bob = u.moving ? Math.abs(Math.sin(t * 10 + u.id)) * 1.6 : 0, lunge = u.atkAnim > 0 ? u.face * (u.atkAnim / 0.2) * 3 : 0;
        const x0 = u.x - sw / 2 + lunge, y0 = u.y - sh + 2 - bob;
        g.save(); if (u.face < 0) { g.translate(u.x * 2, 0); g.scale(-1, 1); }
        g.drawImage(s.c, u.face < 0 ? u.x * 2 - x0 - sw : x0, y0, sw, sh);
        if (u.flash > 0) { g.globalAlpha = Math.min(1, u.flash / 0.14) * 0.7; g.drawImage(s.white, u.face < 0 ? u.x * 2 - x0 - sw : x0, y0, sw, sh); }
        g.restore();
        if (u.mk === 'pap' && u.atkAnim > 0.12) { g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(glowSp('#ffffff', 0.4), u.x - 3 + u.face * 4 - 14, y0 + sh * 0.45 - 14, 28, 28); g.restore(); }
        if (u.stun > 0) drawStun(u.x, y0 - 3, t, 0.7);
        return;
      }
      if (u.kind === 'tower') {
        if (!u.alive) { const r = rubbleSprite(u.team); g.drawImage(r.c, u.x - r.w / 2, u.y - r.h + 8, r.w, r.h); return; }
        const s = towerSprite(u.team);
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2 + u.id); g.drawImage(glowSp(u.team ? cfg.team.c : '#ff8fc0', 0.2), u.x - 40, u.y - 128, 80, 60); g.restore();
        g.drawImage(s.c, u.x - s.w / 2, u.y - s.h + 6, s.w, s.h);
        if (u.flash > 0) { g.globalAlpha = Math.min(1, u.flash / 0.14) * 0.6; g.drawImage(s.white, u.x - s.w / 2, u.y - s.h + 6, s.w, s.h); g.globalAlpha = 1; }
        if (u.invul) drawShieldDome(u.x, u.y - 52, 40, 64, t, u.team);
        return;
      }
      // 主堡
      if (!u.alive) { const r = rubbleSprite(u.team); g.drawImage(r.c, u.x - r.w * 0.8, u.y - r.h * 1.4, r.w * 1.6, r.h * 1.6); return; }
      const s = crystalSprite(u.team), bob = Math.sin(t * 1.6 + u.team) * 4;
      g.drawImage(s.base, u.x - s.bw / 2, u.y - s.bh + 10, s.bw, s.bh);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 + 0.2 * Math.sin(t * 2.4); g.drawImage(glowSp(u.team ? cfg.team.c : '#ff9cc8', 0.15), u.x - 70, u.y - 140, 140, 120); g.restore();
      const gy = u.y - s.gh - 34 + bob;
      g.drawImage(s.gem, u.x - s.gw / 2, gy, s.gw, s.gh);
      // 旋轉的反光
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3); const st = shapeSp('star', '#ffffff'); const sx = u.x + Math.sin(t * 1.3) * 18; g.drawImage(st, sx - 9, gy + 14 - 9, 18, 18); g.restore();
      if (u.flash > 0) { g.globalAlpha = Math.min(1, u.flash / 0.14) * 0.6; g.drawImage(s.white, u.x - s.gw / 2, gy, s.gw, s.gh); g.globalAlpha = 1; }
      if (u.invul) drawShieldDome(u.x, u.y - 66, 54, 84, t, u.team);
    }
    function drawShieldDome(x, y, rx, ry, t, team) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const c = team ? cfg.team.c : '#ff8fc0';
      g.globalAlpha = 0.12; g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
      g.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3); g.strokeStyle = c; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.stroke();
      g.globalAlpha = 0.25; g.beginPath(); g.ellipse(x, y + Math.sin(t * 1.5) * ry * 0.6, rx * 0.95, 4, 0, 0, TAU); g.stroke();
      g.restore();
    }
    function drawStun(x, y, t, s = 1) {
      const sp = shapeSp('star', '#ffe08a');
      for (let i = 0; i < 3; i++) { const a = t * 6 + i * TAU / 3; g.drawImage(sp, x + Math.cos(a) * 11 * s - 6 * s, y + Math.sin(a) * 3.5 * s - 6 * s, 12 * s, 12 * s); }
    }
    function drawHero(u, t) {
      if (!u.alive) return;
      const H = HD[u.hid], a = artOf(u), spr = a.spr, h = H.h, w = spr ? h * spr.c.width / spr.c.height : 40, c = colOf(u), me = u.id === P.id;
      // 腳下光環
      g.save(); g.translate(u.x, u.y); g.scale(1, 0.4);
      g.strokeStyle = me ? '#ffd36b' : u.team ? 'rgba(255,77,109,.95)' : 'rgba(110,200,255,.95)'; g.lineWidth = me ? 3 : 2.2;
      g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.stroke();
      if (me) { g.rotate(t * 2); g.lineWidth = 3.5; g.strokeStyle = '#fff1c9'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, 25, i * TAU / 3, i * TAU / 3 + 0.6); g.stroke(); } }
      if (u.slow > 0) { g.rotate(-t * 3); g.strokeStyle = 'rgba(140,200,255,.9)'; g.lineWidth = 2; g.setLineDash([5, 5]); g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.stroke(); g.setLineDash([]); }
      g.restore();
      if (u.dash && Math.random() < 0.6) ghostOf(u, 0.25, c, { dash: true, a0: 0.45 });
      const bob = u.moving ? Math.abs(Math.sin(t * 9 + u.id)) * 2.4 : Math.sin(t * 2 + u.id) * 0.7;
      const lunge = u.atkAnim > 0 && H.range < 100 ? u.face * (u.atkAnim / 0.2) * 5 : 0;
      const x0 = u.x - w / 2 + lunge, y0 = u.y - h + 3 - bob;
      g.save();
      if (u.untarget > 0) g.globalAlpha = 0.45;
      if (u.castAnim > 0 || u.dr > 0 || FX.charge.has(u.id)) {
        g.save(); g.globalCompositeOperation = 'lighter';
        const ca = Math.max(u.castAnim / 0.35, u.dr > 0 ? 0.45 : 0, FX.charge.has(u.id) ? 0.9 : 0);
        g.globalAlpha = Math.min(1, ca); g.drawImage(glowSp(u.dr > 0 ? '#ffd36b' : c, 0.25), u.x - 44, u.y - h * 0.9, 88, h * 1.1);
        g.restore();
      }
      if (u.face < 0) { g.translate(u.x * 2, 0); g.scale(-1, 1); }
      const dx = u.face < 0 ? u.x * 2 - x0 - w : x0;
      if (spr) {
        g.drawImage(spr.c, dx, y0, w, h);
        if (u.flash > 0) { g.globalAlpha = Math.min(1, u.flash / 0.14) * 0.55 * (u.untarget > 0 ? 0.45 : 1); g.drawImage(spr.white, dx, y0, w, h); }
      }
      g.restore();
      if (FX.charge.has(u.id)) { const ch = FX.charge.get(u.id), p = ch.t / ch.life; g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(glowSp('#7fe3ff', 0.3), u.x + u.face * 12 - 8 - p * 14, u.y - h * 0.55 - 8 - p * 14, 16 + p * 28, 16 + p * 28); g.restore(); }
      if (u.shield > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.1; g.fillStyle = '#9fd4ff'; g.beginPath(); g.ellipse(u.x, u.y - h * 0.46, w * 0.72, h * 0.58, 0, 0, TAU); g.fill(); g.globalAlpha = 0.5 + 0.2 * Math.sin(t * 6); g.strokeStyle = '#cfeaff'; g.lineWidth = 1.2; g.stroke(); g.globalAlpha = 0.35; g.lineWidth = 0.8; g.beginPath(); g.ellipse(u.x - w * 0.25, u.y - h * 0.78, w * 0.18, h * 0.08, -0.5, 0, TAU); g.stroke(); g.restore(); }
      if (u.stun > 0) drawStun(u.x, y0 - 2, t);
      if (u.taunt >= 0 && u.tauntT > 0) { g.fillStyle = '#ff5a7a'; g.font = '900 13px Georgia, serif'; g.textAlign = 'center'; g.fillText('!', u.x, y0 - 4); }
      if (u.hasteT > 0 && u.moving) { g.save(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; for (let i = 0; i < 3; i++) { const yy = u.y - 12 - i * 14; g.beginPath(); g.moveTo(u.x - u.face * 14, yy); g.lineTo(u.x - u.face * 26, yy); g.stroke(); } g.restore(); }
    }
    function drawBars(u) {
      if (!u.alive) return;
      if (u.kind === 'hero') {
        const H = HD[u.hid], me = u.id === P.id, by = u.y - H.h - 9, bw = 46, bx = u.x - bw / 2 + 5;
        // 名牌
        g.font = '700 7.6px "Noto Serif TC", "PingFang TC", serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.lineWidth = 2.4; g.strokeStyle = 'rgba(20,4,16,.85)'; g.strokeText(nameOf(u), u.x + 5, by - 3); g.fillStyle = me ? '#ffe39a' : u.team ? '#ffc2cc' : '#e8f4ff'; g.fillText(nameOf(u), u.x + 5, by - 3);
        // 血條
        g.fillStyle = 'rgba(16,4,14,.82)'; g.beginPath(); g.roundRect(bx - 1, by - 1, bw + 2, 7.2, 2); g.fill();
        const f = cl(u.hp / u.maxHp, 0, 1), sh = Math.min(1 - f, u.shield / u.maxHp);
        const col = me ? ['#9dffc6', '#2fc77f'] : u.team ? ['#ff9aae', '#e3264f'] : ['#9fdcff', '#2d8fe0'];
        const gr = g.createLinearGradient(0, by, 0, by + 5.2); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
        g.fillStyle = gr; g.fillRect(bx, by, bw * f, 5.2);
        if (sh > 0) { g.fillStyle = 'rgba(235,245,255,.92)'; g.fillRect(bx + bw * f, by, bw * sh, 5.2); }
        g.fillStyle = 'rgba(16,4,14,.6)'; for (let v = 250; v < u.maxHp; v += 250) { const xx = bx + bw * v / u.maxHp; g.fillRect(xx, by, 0.6, v % 1000 ? 2.6 : 5.2); }
        g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(bx, by, bw * f, 1.2);
        // 能量條
        g.fillStyle = 'rgba(16,4,14,.75)'; g.fillRect(bx, by + 5.8, bw, 1.8);
        g.fillStyle = u.energy >= 100 ? '#ffe08a' : '#d9a937'; g.fillRect(bx, by + 5.8, bw * u.energy / 100, 1.8);
        // 等級徽章
        g.fillStyle = 'rgba(30,8,26,.95)'; g.beginPath(); g.arc(bx - 6.5, by + 3, 6.2, 0, TAU); g.fill();
        g.strokeStyle = me ? '#ffd36b' : u.team ? '#ff6f8f' : '#7cc6ff'; g.lineWidth = 1.1; g.stroke();
        g.fillStyle = '#fff'; g.font = '700 6.8px Georgia, serif'; g.textBaseline = 'middle'; g.fillText(String(u.lvl), bx - 6.5, by + 3.4); g.textBaseline = 'alphabetic';
        return;
      }
      if (u.kind === 'minion') {
        if (u.hp >= u.maxHp) return;
        const s = minionSprite(u.mk, u.team), bw = u.mk === 'super' ? 26 : 20, by = u.y - s.h * MIN_SC - 2;
        g.fillStyle = 'rgba(16,4,14,.8)'; g.fillRect(u.x - bw / 2 - 0.6, by - 0.6, bw + 1.2, 3.4);
        g.fillStyle = u.team ? '#ff5a7a' : '#6fd0ff'; g.fillRect(u.x - bw / 2, by, bw * cl(u.hp / u.maxHp, 0, 1), 2.2);
        return;
      }
      const cr = u.kind === 'crystal', bw = cr ? 74 : 56, by = u.y - (cr ? 170 : 124);
      g.fillStyle = 'rgba(16,4,14,.85)'; g.beginPath(); g.roundRect(u.x - bw / 2 - 1.2, by - 1.2, bw + 2.4, 8.4, 2.5); g.fill();
      const gr = g.createLinearGradient(0, by, 0, by + 6); const cc = u.team ? ['#ffb0c0', '#d61f4a'] : ['#ffd1e6', '#e0629a'];
      gr.addColorStop(0, cc[0]); gr.addColorStop(1, cc[1]);
      g.fillStyle = gr; g.fillRect(u.x - bw / 2, by, bw * cl(u.hp / u.maxHp, 0, 1), 6);
      g.strokeStyle = 'rgba(246,220,154,.8)'; g.lineWidth = 0.8; g.strokeRect(u.x - bw / 2 - 1.2, by - 1.2, bw + 2.4, 8.4);
      if (u.invul) { g.fillStyle = '#fff1c9'; g.font = '700 7px "Noto Serif TC", serif'; g.textAlign = 'center'; g.fillText('無敵', u.x, by - 3); }
    }
    function drawProjs(t) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const p of S.projs) {
        if (p._d0 === undefined) { p._d0 = Math.hypot(p.tx - p.x, p.ty - p.y) || 1; p._z0 = p.z || 30; p._tr = []; }
        const d = Math.hypot(p.tx - p.x, p.ty - p.y), q = 1 - cl(d / p._d0, 0, 1), z = p._z0 + (30 - p._z0) * q + Math.sin(q * Math.PI) * (p.fx === 'drop' ? 30 : 6);
        const x = p.x, y = p.y - z;
        p._tr.push(x, y); if (p._tr.length > 12) p._tr.splice(0, 2);
        const c = p.fx === 'drop' ? (p.team ? cfg.team.c : '#ff8fc0') : PROJ_COL[p.fx] || '#fff';
        const gl = glowSp(c, 0.3);
        for (let i = 0; i < p._tr.length; i += 2) { const a = (i + 2) / p._tr.length; g.globalAlpha = a * 0.5; const s = (p.fx === 'drop' ? 16 : 9) * a; g.drawImage(gl, p._tr[i] - s / 2, p._tr[i + 1] - s / 2, s, s); }
        g.globalAlpha = 1;
        if (p.fx === 'bolt' || p.fx === 'neon') {
          const an = p.ang ?? 0; g.strokeStyle = c; g.lineWidth = 4; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(an) * 18, y - Math.sin(an) * 18); g.stroke();
          g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.globalAlpha = 1; g.stroke();
        } else if (p.fx === 'talisman') {
          g.globalCompositeOperation = 'source-over'; g.save(); g.translate(x, y); g.rotate(t * 12); g.fillStyle = '#fbf3dc'; g.fillRect(-4, -6, 8, 12); g.fillStyle = '#c0283c'; g.fillRect(-1, -4, 2, 8); g.restore(); g.globalCompositeOperation = 'lighter';
          g.drawImage(gl, x - 9, y - 9, 18, 18);
        } else if (p.fx === 'macaron') {
          g.globalCompositeOperation = 'source-over'; g.fillStyle = '#ffb3cf'; g.beginPath(); g.ellipse(x, y - 1.5, 4.5, 2.4, 0, 0, TAU); g.ellipse(x, y + 1.5, 4.5, 2.4, 0, 0, TAU); g.fill(); g.fillStyle = '#fff6ea'; g.fillRect(x - 4, y - 0.6, 8, 1.2); g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 0.6; g.drawImage(gl, x - 8, y - 8, 16, 16);
        } else if (p.fx === 'star') {
          g.drawImage(shapeSp('star', c), x - 8, y - 8, 16, 16);
        } else if (p.fx === 'drop') {
          g.drawImage(gl, x - 12, y - 12, 24, 24); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x, y - 5); g.quadraticCurveTo(x + 4, y + 1, x, y + 4); g.quadraticCurveTo(x - 4, y + 1, x, y - 5); g.fill(); g.globalCompositeOperation = 'lighter';
        } else g.drawImage(gl, x - 7, y - 7, 14, 14);
      }
      g.restore();
    }
    function drawFx(t) {
      // 地面光圈
      for (const r of FX.rings) {
        const p = r.t / r.life, rr = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - p, 3));
        g.save(); g.translate(r.x, r.y - r.z); g.scale(1, 0.62); g.globalCompositeOperation = 'lighter';
        if (r.fill) { g.globalAlpha = r.fill * (1 - p); g.fillStyle = r.color; g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.fill(); }
        g.globalAlpha = 1 - p; g.strokeStyle = r.color; g.lineWidth = r.w * (1 - p * 0.5); g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.stroke();
        g.restore();
      }
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const f of FX.flashes) { const p = f.t / f.life; g.globalAlpha = (1 - p) * (f.cam ? 0.9 : 0.55); const s = f.r * 2 * (f.cam ? 1 : 0.8 + p * 0.4); g.drawImage(glowSp(f.c, 0.25), f.x - s / 2, f.y - s / 2 - (f.cam ? 0 : 20), s, s); if (f.cam) { g.strokeStyle = '#fff'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(f.x - 10, f.y); g.lineTo(f.x + 10, f.y); g.moveTo(f.x, f.y - 10); g.lineTo(f.x, f.y + 10); g.stroke(); } }
      // 光柱
      for (const pl of FX.pillars) {
        const p = pl.t / pl.life, a = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
        const gr = g.createLinearGradient(0, pl.y - 220, 0, pl.y); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, hex6(pl.color) + '99'); gr.addColorStop(1, '#ffffff');
        g.globalAlpha = a * 0.8; g.fillStyle = gr; g.fillRect(pl.x - pl.w / 2 * (1 - p * 0.5), pl.y - 220, pl.w * (1 - p * 0.5), 220);
      }
      // 光束技能
      for (const b of FX.beams) {
        const p = b.t / b.life, a = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85, z = 30;
        g.lineCap = 'round';
        g.globalAlpha = a * 0.4; g.strokeStyle = b.c; g.lineWidth = b.w * (1.1 - p * 0.4); g.beginPath(); g.moveTo(b.x1, b.y1 - z); g.lineTo(b.x2, b.y2 - z); g.stroke();
        g.globalAlpha = a * 0.85; g.lineWidth = b.w * 0.45; g.stroke();
        g.globalAlpha = a; g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(2, b.w * 0.16); g.stroke();
        if (b.fx === 'laser') { g.globalAlpha = a * 0.8; g.drawImage(glowSp(b.c, 0.3), b.x1 - 40, b.y1 - z - 40, 80, 80); }
      }
      // 流星
      for (const m of FX.meteors) {
        if (m.t < 0) continue;
        const p = m.t / m.life, sx = m.x + 70 * (1 - p), sy = m.y - 200 * (1 - p);
        g.globalAlpha = 1; g.strokeStyle = m.c; g.lineWidth = 5; g.beginPath(); g.moveTo(sx + 26, sy - 70); g.lineTo(sx, sy); g.stroke();
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
        g.drawImage(glowSp(m.c, 0.3), sx - 16, sy - 16, 32, 32);
      }
      // 斬擊
      for (const s of FX.slashes) {
        const p = s.t / s.life, L = (s.big ? 46 : 26) * Math.min(1, p * 3);
        g.globalAlpha = 1 - p; g.lineCap = 'round';
        for (const [a, col] of [[0.7, s.c], [-0.7, '#ffffff']]) {
          g.strokeStyle = col; g.lineWidth = s.big ? 5 : 3;
          g.beginPath(); g.moveTo(s.x - Math.cos(a) * L, s.y - Math.sin(a) * L); g.lineTo(s.x + Math.cos(a) * L, s.y + Math.sin(a) * L); g.stroke();
        }
      }
      g.restore();
      // 粒子
      for (const p of FX.parts) {
        const a = 1 - Math.pow(p.t / p.life, 2), sp = p.shape === 'glow' ? glowSp(p.c) : shapeSp(p.shape, p.c), s = p.s;
        g.globalAlpha = a;
        if (p.add) g.globalCompositeOperation = 'lighter';
        if (p.shape === 'petal' || p.shape === 'page' || p.shape === 'gem' || p.shape === 'heart') { g.save(); g.translate(p.x, p.y - p.z); g.rotate(p.rot); g.drawImage(sp, -s / 2, -s / 2, s, s); g.restore(); }
        else g.drawImage(sp, p.x - s / 2, p.y - p.z - s / 2, s, s);
        if (p.add) g.globalCompositeOperation = 'source-over';
      }
      g.globalAlpha = 1;
    }
    function drawGhosts() {
      for (const gh of FX.ghosts) {
        const p = gh.t / gh.life;
        g.save();
        if (gh.face < 0) { g.translate(gh.x * 2, 0); g.scale(-1, 1); }
        const rise = gh.dash ? 0 : p * 22, sc = gh.dash ? 1 : 1 + p * 0.15, w = gh.w * sc, h = gh.h * sc;
        g.globalAlpha = (1 - p) * gh.a0;
        if (gh.dash) { g.globalCompositeOperation = 'lighter'; g.drawImage(gh.spr.white, gh.x - w / 2, gh.y - h + 3, w, h); }
        else { g.drawImage(gh.spr.c, gh.x - w / 2, gh.y - h + 3 - rise, w, h); g.globalAlpha = Math.min(1, (1 - p) * 1.4); g.globalCompositeOperation = 'lighter'; g.drawImage(gh.spr.white, gh.x - w / 2, gh.y - h + 3 - rise, w, h); }
        g.restore();
        if (!gh.dash && Math.random() < 0.5) addPart({ x: gh.x + rnd(-gh.w / 3, gh.w / 3), y: gh.y, z: rnd(0, gh.h), vx: 0, vy: 0, vz: rnd(30, 70), g: 0, t: 0, life: 0.6, s: rnd(4, 7), shape: 'star', c: '#ffffff', rot: 0, vr: 0, add: true });
      }
      g.globalAlpha = 1;
    }
    function drawTexts() {
      g.textAlign = 'center'; g.lineJoin = 'round'; g.textBaseline = 'alphabetic';
      for (const tx of FX.texts) {
        const p = tx.t / tx.life, pop = tx.crit ? 1 + Math.max(0, 0.6 - p * 4) : 1 + Math.max(0, 0.3 - p * 3);
        g.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
        const isNum = /^[+\d]/.test(tx.txt) || tx.txt.startsWith('爆擊');
        g.font = isNum ? `italic 700 ${tx.size * pop}px "Bodoni Moda", Georgia, serif` : `700 ${tx.size * pop}px "Noto Serif TC", "PingFang TC", serif`;
        g.lineWidth = tx.size * 0.32; g.strokeStyle = tx.stroke; g.strokeText(tx.txt, tx.x, tx.y - tx.z);
        g.fillStyle = tx.color; g.fillText(tx.txt, tx.x, tx.y - tx.z);
      }
      g.globalAlpha = 1;
    }
    function drawBubbles() {
      g.font = '700 7.4px "Noto Serif TC", "PingFang TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const b of FX.bubbles) {
        const u = S.byId.get(b.id); if (!u || !u.alive) continue;
        const p = b.t / b.life, a = p < 0.1 ? p / 0.1 : p > 0.85 ? (1 - p) / 0.15 : 1, tw = g.measureText(b.txt).width + 10, y = u.y - HD[u.hid].h - 30;
        g.globalAlpha = a;
        g.fillStyle = 'rgba(255,250,246,.96)'; g.strokeStyle = u.team ? '#ff6f8f' : '#e9b64a'; g.lineWidth = 0.9;
        g.beginPath(); g.roundRect(u.x - tw / 2, y - 7, tw, 14, 7); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(u.x - 3, y + 6.5); g.lineTo(u.x, y + 11); g.lineTo(u.x + 3, y + 6.5); g.fill();
        g.fillStyle = '#4a1a34'; g.fillText(b.txt, u.x, y + 0.5);
      }
      g.globalAlpha = 1; g.textBaseline = 'alphabetic';
    }
    function render(t) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      const z = k * cam.z, sx = (Math.random() - 0.5) * cam.shake, sy = (Math.random() - 0.5) * cam.shake;
      const ox = W / 2 - cam.x * z + sx, oy = Hh / 2 - cam.y * z + sy;
      g.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
      const vh = Hh / z, top = cam.y - vh / 2 - 140, bot = cam.y + vh / 2 + 50;
      g.fillStyle = '#12061a'; g.fillRect(-60, top - 60, MAP.w + 120, bot - top + 120);
      for (const ch of chunks) if (ch.y + ch.h > top && ch.y < bot) g.drawImage(ch.c, 0, ch.y, MAP.w, ch.h + 0.5);
      drawLights(t, top, bot);
      drawDecals(t);
      const list = [];
      for (const u of S.units) if (u.y > top && u.y < bot + 60 && (u.alive || Core.isStruct(u))) list.push(u);
      list.sort((a, b) => a.y - b.y);
      for (const u of list) drawShadow(u);
      drawGhosts();
      for (const u of list) drawUnit(u, t);
      drawProjs(t);
      drawFx(t);
      for (const u of list) drawBars(u);
      drawBubbles();
      drawTexts();
    }
    function drawMini() {
      const w = mini.width, h = mini.height, sx = w / MAP.w, sy = h / MAP.h;
      mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, w, h);
      mg.fillStyle = 'rgba(30,10,36,.75)'; mg.beginPath(); mg.roundRect(0, 0, w, h, 14); mg.fill();
      mg.fillStyle = 'rgba(173,50,104,.55)'; mg.fillRect(112 * sx, 6, 116 * sx, h - 12);
      mg.strokeStyle = 'rgba(246,220,154,.5)'; mg.lineWidth = 1.5; mg.strokeRect(MAP.l * sx, 6, (MAP.r - MAP.l) * sx, h - 12);
      const vh = Hh / (k * cam.z);
      mg.strokeStyle = 'rgba(255,255,255,.75)'; mg.lineWidth = 2; mg.strokeRect(3, (cam.y - vh / 2) * sy, w - 6, vh * sy);
      for (const u of S.units) {
        if (Core.isStruct(u)) { const s = u.kind === 'crystal' ? 18 : 13; mg.fillStyle = !u.alive ? 'rgba(120,100,120,.6)' : u.team ? cfg.team.c : '#ff9cc8'; mg.save(); mg.translate(u.x * sx, u.y * sy); mg.rotate(Math.PI / 4); mg.fillRect(-s / 2, -s / 2, s, s); mg.restore(); continue; }
        if (!u.alive) continue;
        if (u.kind === 'minion') { mg.fillStyle = u.team ? '#ff6f8f' : '#8fd8ff'; mg.fillRect(u.x * sx - 2.5, u.y * sy - 2.5, 5, 5); continue; }
        const me = u.id === P.id;
        mg.fillStyle = me ? '#ffd36b' : u.team ? '#ff4d6d' : '#5ec8ff'; mg.beginPath(); mg.arc(u.x * sx, u.y * sy, me ? 9 : 7, 0, TAU); mg.fill();
        mg.strokeStyle = '#fff'; mg.lineWidth = me ? 2.5 : 1.5; mg.stroke();
      }
    }

    // ---- HUD ----
    const elA = $('.sc.a b'), elE = $('.sc.e b'), elT = $('.tm b'), elW = $('.tm small'), autoB = $('.bt-auto'), deadP = $('.bt-dead'), deadN = $('.dd-n');
    const skEls = [0, 1, 2].map(i => node.querySelector(`.sk[data-i="${i}"]`)), rcEl = $('.sk.rc');
    let hudAcc = 0, miniAcc = 0, lowOn = false;
    function setAuto(on) {
      S.auto = on; autoB.classList.toggle('on', on); autoB.setAttribute('aria-pressed', String(on)); autoB.querySelector('small').textContent = on ? 'ON' : 'OFF';
      if (!cfg.coach) { const s = store(api); s.auto = on; api.save(); }
    }
    setAuto(S.auto);
    function hud(dt) {
      for (let i = 0; i < 3; i++) {
        const b = skEls[i], ready = Core.ready(P, i);
        let p = 0, n = '';
        if (i < 2) { p = P.cds[i] > 0 ? P.cds[i] / PH.skills[i].cd : 0; n = P.cds[i] > 0 ? Math.ceil(P.cds[i]) : ''; }
        else { b.style.setProperty('--e', (P.energy / 100).toFixed(3)); }
        b.style.setProperty('--p', p.toFixed(3));
        const sn = b.querySelector('.sk-n'); if (sn.textContent !== String(n)) sn.textContent = n;
        b.classList.toggle('ready', ready && P.alive && P.stun <= 0);
      }
      rcEl.style.setProperty('--p', P.recall > 0 ? (1 - P.recall / 3).toFixed(3) : '0');
      rcEl.classList.toggle('on', P.recall > 0);
      hudAcc += dt;
      if (hudAcc > 0.2) {
        hudAcc = 0;
        if (elA.textContent !== String(S.score[0])) { elA.textContent = S.score[0]; elA.parentNode.classList.remove('bump'); void elA.offsetWidth; elA.parentNode.classList.add('bump'); }
        if (elE.textContent !== String(S.score[1])) { elE.textContent = S.score[1]; elE.parentNode.classList.remove('bump'); void elE.offsetWidth; elE.parentNode.classList.add('bump'); }
        elT.textContent = mmss(S.t);
        elW.textContent = B.paused && S.t === 0 ? '準備中' : S.phase >= 4 ? '最終決戰' : S.phase >= 1 ? '決勝時刻' : `第 ${Math.max(1, S.wave)} 波`;
        deadP.hidden = P.alive || S.over;
        if (!P.alive) deadN.textContent = Math.max(1, Math.ceil(P.respawn));
        const low = P.alive && P.hp < P.maxHp * 0.3;
        if (low !== lowOn) { lowOn = low; $('.bt-low').classList.toggle('on', low); }
      }
      miniAcc += dt;
      if (miniAcc > 0.1) { miniAcc = 0; drawMini(); }
    }

    // ---- 操作：搖桿、技能、鍵盤 ----
    const joy = { id: null, ox: 0, oy: 0 }, jb = $('.jb'), jk = $('.jk'), joyEl = $('.bt-joy');
    const zone = $('.bt-joyz');
    function joyMove(e) {
      const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, d = Math.hypot(dx, dy), m = Math.min(d, 52), nx = d ? dx / d : 0, ny = d ? dy / d : 0;
      jk.style.transform = `translate(${nx * m}px,${ny * m}px)`;
      B.input.move = d > 8 ? { x: nx * Math.min(1, d / 40), y: ny * Math.min(1, d / 40) } : null;
    }
    zone.addEventListener('pointerdown', e => {
      if (joy.id !== null) return;
      e.preventDefault(); joy.id = e.pointerId;
      try { zone.setPointerCapture(e.pointerId); } catch (er) { /* 舊瀏覽器 */ }
      const r = node.getBoundingClientRect();
      joy.ox = e.clientX; joy.oy = e.clientY;
      joyEl.classList.add('on'); joyEl.style.left = (e.clientX - r.left - 60) + 'px'; joyEl.style.top = (e.clientY - r.top - 60) + 'px'; joyEl.style.bottom = 'auto';
      joyMove(e);
    });
    zone.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyMove(e); });
    const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.id = null; B.input.move = null; jk.style.transform = ''; joyEl.classList.remove('on'); joyEl.style.left = ''; joyEl.style.top = ''; joyEl.style.bottom = ''; };
    zone.addEventListener('pointerup', joyEnd); zone.addEventListener('pointercancel', joyEnd);
    $('.bt-sk').addEventListener('pointerdown', e => {
      const b = e.target.closest('.sk'); if (!b) return;
      e.preventDefault();
      if (!P.alive || B.done) return;
      if (b.dataset.rc !== undefined) { if (P.recall > 0) return; B.input.recall = true; safeSound(api, 'click'); return; }
      B.input.cast.push(+b.dataset.i);
      b.classList.remove('press'); void b.offsetWidth; b.classList.add('press');
      api.vib(8);
    });
    autoB.addEventListener('click', () => { safeSound(api, 'click'); setAuto(!S.auto); text(P.x, P.y, HD[P.hid].h + 16, S.auto ? (cfg.coach ? '教練接手！' : '自動戰鬥 ON') : '手動操作', '#ffe9a8', 9, { life: 1, vz: 16 }); });
    $('.dd-rv').addEventListener('click', e => {
      const btn = e.currentTarget;
      api.twoTap(btn, () => { if (P.alive || S.over) return; if (api.spendGems(10)) { Core.revive(S, P); safeSound(api, 'level'); announce({ t: '粉鑽復活！', en: 'REVIVE', cls: 'ally', dur: 1000 }); } }, () => { btn.querySelector('small').innerHTML = btn.dataset.confirm ? `再按一下確認 ${api.icons.gem()}10` : `${api.icons.gem()}10`; });
    });
    const keys = new Set();
    const KMOVE = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
    const keyMove = () => { if (joy.id !== null) return; let x = 0, y = 0; for (const kk of keys) if (KMOVE[kk]) { x += KMOVE[kk][0]; y += KMOVE[kk][1]; } const m = Math.hypot(x, y); B.input.move = m ? { x: x / m, y: y / m } : null; };
    const onKey = e => {
      if (!A.alive || B.done || A.screen !== node || e.target.closest && e.target.closest('input, textarea')) return;
      const kk = e.key.toLowerCase();
      if (e.type === 'keydown') {
        if (KMOVE[kk]) { keys.add(kk); keyMove(); e.preventDefault(); return; }
        if (e.repeat) return;
        const m = { q: 0, j: 0, 1: 0, e: 1, k: 1, 2: 1, r: 2, l: 2, 3: 2 }[kk];
        if (m !== undefined && P.alive) { B.input.cast.push(m); pressFx(m); }
        else if (kk === 'b' && P.alive) B.input.recall = true;
        else if (kk === 't' || kk === ' ') { e.preventDefault(); autoB.click(); }
      } else if (KMOVE[kk]) { keys.delete(kk); keyMove(); }
    };
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);

    // ---- 主迴圈 ----
    let raf = 0, last = performance.now(), acc = 0, running = false;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const rdt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      let ts = 1;
      if (B.slow) { B.slow.t += rdt; const p = B.slow.t / B.slow.dur; if (p >= 1) B.slow = null; else ts = p < 0.7 ? B.slow.scale : B.slow.scale + (1 - B.slow.scale) * (p - 0.7) / 0.3; }
      if (!B.paused && !B.done) {
        acc += rdt * ts;
        let n = 0;
        while (acc >= STEP && n < 5) { acc -= STEP; n++; const ev = Core.step(S, STEP, B.input); B.input.cast.length = 0; B.input.recall = false; onEvents(ev); if (B.done || !A.alive) return; }
        if (acc > STEP * 5) acc = 0;
      }
      const fdt = rdt * (ts < 1 ? Math.max(0.3, ts) : 1);
      B.t += fdt;
      updCam(rdt); stepFx(fdt); render(B.t); hud(rdt);
    }
    const startLoop = () => { if (running || B.done || !A.alive) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); };
    const stopLoop = () => { running = false; cancelAnimationFrame(raf); };
    const onVis = () => { if (document.hidden) stopLoop(); else startLoop(); };
    document.addEventListener('visibilitychange', onVis);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
    if (ro) ro.observe(node);
    B.stop = () => { stopLoop(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); if (ro) ro.disconnect(); };
    function finish(surr) {
      if (B.done) return;
      B.done = true; B.stop();
      showResult(A, settle(A, B, surr));
    }
    B.surrender = () => finish(true);
    B.debug = { S, P, finish, cine: () => cine(P), fx: { burst, ring, text, announce } };
    if (api.sandbox) window.__arena = B.debug;

    // ---- 開場：鏡頭從敵方主堡推到我方，然後「對決開始」 ----
    swap(A, node);
    later(A, () => { resize(); startLoop(); }, 30);
    B.intro = true;
    const intro = $('.bt-intro');
    intro.innerHTML = `<div class="in-card"><small>RUNWAY ARENA</small><b>伸展台競技場</b><span>摧毀 ${cfg.team.name} 的鑽石主堡！</span></div>`;
    later(A, () => { intro.innerHTML = '<div class="in-go"><b>對決開始！</b><small>BATTLE START</small></div>'; safeSound(api, 'fever'); api.vib(25); }, RM ? 600 : 1700);
    later(A, () => {
      intro.innerHTML = ''; B.intro = false;
      const s = store(api);
      if (!s.tut.battle) {
        s.tut.battle = 1; api.save();
        tip(A, $('.bt-joy .jb'), '按住<b>左下</b>拖曳，名媛就會走過去。<br>靠近敵人會<b>自動普攻</b>。', 'up', () =>
          tip(A, skEls[2], '右下是技能，點一下會<b>自動瞄準</b>。<br>能量集滿就能放<b>大招</b>！', 'up', () =>
            tip(A, autoB, '懶得操作？按「自動」交給 AI，<br>妳只要在旁邊幫她加油～', 'down', () => { B.paused = false; })));
      } else B.paused = false;
      say(P, LINES[P.hid].pick, 2.2);
    }, RM ? 1100 : 2500);
  }

  // ---------- 結算 ----------
  const FOE_MVP = ['伸展台的主角，從來都是我們。', '下次再來挑戰吧，小姐們。', '這身行頭，妳們學不來的。'];
  function settle(A, B, surr) {
    const { api } = A, S = B.S, cfg = B.cfg, P = B.P, s = store(api);
    const win = !surr && S.winner === 0, winTeam = win ? 0 : 1;
    const best = team => S.heroes[team].slice().sort((a, b) => Core.mvpScore(b, winTeam) - Core.mvpScore(a, winTeam))[0];
    const mvp = best(winTeam), loserBest = best(1 - winTeam);
    const playerMvp = mvp === P, playerLoseMvp = !win && !surr && loserBest === P && P.k + P.a >= 3;
    const r0 = { ...s.rank }, rr = Core.rankApply(r0, win, playerLoseMvp);
    s.rank = { tier: rr.tier, stars: rr.stars };
    if (Core.rankScore(s.rank) > Core.rankScore(s.best)) s.best = { ...s.rank };
    const se = s.season;
    if (win) se.w++; else se.l++;
    se.k += P.k; se.d += P.d; se.a += P.a;
    if (playerMvp) se.mvp++;
    se.streak = win ? se.streak + 1 : 0; se.bestStreak = Math.max(se.bestStreak, se.streak);
    const rw = surr ? { coins: 0, shards: 0, ore: 0 } : Core.rewards({ win, tier: r0.tier, bet: api.betUnit(), mvp: playerMvp && win, superMode: cfg.superMode, resUnit: typeof api.resUnit === 'function' ? api.resUnit() : 100 });
    const same = rr.tier === r0.tier && rr.stars === r0.stars;
    const delta = rr.promo ? '晉級' : rr.demo ? '降級' : rr.kept ? '保星' : same ? '±0' : win ? '+1★' : '−1★';
    s.hist.unshift({ t: Math.round(S.t), win, hero: P.hid, k: P.k, d: P.d, a: P.a, mvp: playerMvp, delta, at: Date.now() });
    if (s.hist.length > 30) s.hist.length = 30;
    report(api, 'arena_play', { win });
    if (win) report(api, 'arena_win');
    try { api.stat('arena_play'); if (win) api.stat('arena_win'); if (playerMvp) api.stat('arena_mvp'); } catch (e) { /* 舊版主程式 */ }
    api.save();
    return { win, surr, S, cfg, P, mvp, loserBest, playerMvp, playerLoseMvp, r0, rr, rw, delta, same };
  }
  const fmtK = n => (n >= 10000 ? (n / 10000).toFixed(1) + '萬' : Math.round(n).toLocaleString());
  function showResult(A, R) {
    const { api } = A, { S, cfg, P, win, mvp } = R;
    A.battle = null; heroesHook = null;
    if (A.ov) A.ov.setTitle(win ? '對戰勝利' : R.surr ? '投降' : '對戰結束');
    const mArt = cfg.art[mvp.team][mvp.slot], mName = cfg.names[mvp.team][mvp.slot];
    const mLine = mvp.team === 0 ? LINES[mvp.hid].mvp : pickR(FOE_MVP);
    const pArt = cfg.art[0][0];
    const T1 = TIERS[R.rr.tier];
    // 星星變化
    let stars;
    if (R.rr.tier >= Core.LEGEND) stars = starsHTML(R.rr, R.win ? 'gain' : '');
    else if (R.rr.promo || R.rr.demo || R.same || R.rr.kept) stars = starsHTML(R.rr);
    else if (win) { stars = '<span class="ar-stars">'; for (let i = 0; i < T1.stars; i++) stars += `<i class="${i < R.rr.stars ? 'on' : ''} ${i === R.rr.stars - 1 ? 'new' : ''}">★</i>`; stars += '</span>'; }
    else { stars = '<span class="ar-stars">'; for (let i = 0; i < T1.stars; i++) stars += `<i class="${i < R.r0.stars ? 'on' : ''} ${i === R.r0.stars - 1 ? 'lose' : ''}">★</i>`; stars += '</span>'; }
    const deltaTxt = R.rr.promo ? `晉級 ${T1.name}！` : R.rr.demo ? `降到 ${T1.name}` : R.rr.kept ? '敗方 MVP・保星成功' : R.same ? '段位不變' : win ? '星星 +1' : '星星 −1';
    const row = (team, h) => {
      const tag = h === mvp ? '<i class="mvp">MVP</i>' : h === R.loserBest && h.team !== mvp.team ? '<i class="mvp s">敗方 MVP</i>' : '';
      return `<li class="${h === P ? 'ar-me' : ''}"><img src="${cfg.art[team][h.slot].face}" alt=""><span class="bn"><b>${api.esc(cfg.names[team][h.slot])}</b><small>Lv.${h.lvl}・${Core.ROLE[HD[h.hid].role]}</small></span><span class="kda num">${h.k}/${h.d}/${h.a}</span><span class="dm num">${fmtK(h.heroDmg)}</span>${tag}</li>`;
    };
    const rewards = R.surr ? '<div class="rs-none">投降不會獲得獎勵</div>' : `
      <div class="rw"><span class="rw-ic">${api.icons.coin()}</span><span class="rw-t">金幣</span><b class="num" data-n="${R.rw.coins}">0</b></div>
      <div class="rw"><span class="rw-ic"><img src="${pArt.face}" alt=""></span><span class="rw-t">${api.esc(cfg.names[0][0])}碎片</span><b class="num" data-n="${R.rw.shards}">0</b></div>
      ${R.rw.ore ? `<div class="rw"><span class="rw-ic ore">${svgI('burst')}</span><span class="rw-t">寶石原石</span><b class="num" data-n="${R.rw.ore}">0</b></div>` : ''}
      <div class="rw-tags">${cfg.superMode ? '<span class="sup">超神 ×2</span>' : ''}${R.playerMvp && win ? '<span class="mvp">MVP +20%</span>' : ''}</div>`;
    const node = elx(`<section class="ar-result ${win ? 'win' : 'lose'}" style="--tc:${cfg.team.c}">
      <div class="rs-bg"><i class="rs-rays"></i>${motes(14)}</div>
      <div class="rs-scroll">
        <header class="rs-head"><span class="rs-en">${win ? 'VICTORY' : 'DEFEAT'}</span><b class="rs-big">${win ? '勝利' : R.surr ? '投降' : '失敗'}</b><small>${mmss(S.t)}・擊殺 ${S.score[0]} : ${S.score[1]}・對手 ${cfg.team.name}</small></header>
        <div class="rs-mid">
          <div class="rs-mvp ${mvp.team ? 'foe' : ''}"><div class="mv-face"><img src="${mArt.joy}" alt=""><i class="mv-tag">MVP</i></div><div class="mv-t"><b>${api.esc(mName)}</b><small>${mvp.k} / ${mvp.d} / ${mvp.a}・輸出 ${fmtK(mvp.heroDmg)}</small><p class="mv-say">「${mLine}」</p></div></div>
          <div class="rs-rank ${R.rr.promo ? 'promo' : ''} ${R.rr.demo ? 'demo' : ''}">${emblem(R.rr.tier, 64)}<div><b>${Core.rankName(R.rr)}</b>${stars}<span class="rs-delta ${win || R.rr.kept ? 'up' : 'down'}">${deltaTxt}</span></div></div>
        </div>
        ${mvp !== P ? `<div class="rs-me"><img src="${win ? pArt.joy : pArt.sad}" alt=""><p>「${win ? LINES[P.hid].kill : LINES[P.hid].lose}」</p></div>` : ''}
        <div class="rs-rew">${rewards}</div>
        <div class="rs-board"><div class="bd a"><h4>ERIKA百貨 <span>${S.score[0]}</span></h4><ol>${S.heroes[0].map(h => row(0, h)).join('')}</ol></div><div class="bd e"><h4>${cfg.team.name} <span>${S.score[1]}</span></h4><ol>${S.heroes[1].map(h => row(1, h)).join('')}</ol></div></div>
      </div>
      <div class="rs-acts"><button class="btn ghost" data-a="lobby">返回大廳</button><button class="btn goldb" data-a="again">再來一局<small>${api.esc(cfg.names[0][0])}・排位</small></button></div>
    </section>`);
    node.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      safeSound(api, 'click');
      if (b.dataset.a === 'again') showMatch(A); else showLobby(A);
    });
    swap(A, node);
    // 獎勵立刻入帳（關掉也不會少拿），金幣從獎勵列飛到右上角
    if (!R.surr) {
      const rr = node.querySelector('.rs-rew').getBoundingClientRect();
      const grant = { coins: R.rw.coins, shards: { [P.hid]: R.rw.shards } };
      if (R.rw.ore) grant.res = { ore: R.rw.ore };
      giveRewards(api, grant, rr.left + rr.width * 0.25, rr.top + rr.height / 2);
    }
    if (win) {
      safeSound(api, 'ssr'); later(A, () => safeSound(api, 'cash'), 500);
      later(A, () => { const r = A.root.getBoundingClientRect(); api.fx.rain('confetti', 70, r); api.fx.burst(r.left + r.width / 2, r.top + r.height * 0.18, 40, ['confetti', 'spark', 'heart']); }, 250);
      api.vib([30, 50, 30]);
    } else { safeSound(api, 'beep', 523, 0.3, 'triangle', 0.06); safeSound(api, 'beep', 392, 0.4, 'triangle', 0.06, 0.25); }
    if (R.rr.promo) later(A, () => { safeSound(api, 'level'); const r = node.querySelector('.rs-rank').getBoundingClientRect(); api.fx.burst(r.left + r.width / 2, r.top + r.height / 2, 36, ['spark', 'gem', 'confetti']); }, 1200);
    // 數字跳動
    const nums = [...node.querySelectorAll('[data-n]')];
    nums.forEach((el, i) => {
      const to = +el.dataset.n, t0 = performance.now() + 500 + i * 260, dur = 900;
      const tick = now => {
        if (!A.alive || !el.isConnected) return;
        const p = cl((now - t0) / dur, 0, 1), e2 = 1 - Math.pow(1 - p, 3);
        el.textContent = api.fmt(Math.round(to * e2));
        if (p < 1) requestAnimationFrame(tick);
        else { el.parentNode.classList.add('done'); safeSound(api, 'beep', 1568 + i * 200, 0.12, 'triangle', 0.05); }
      };
      requestAnimationFrame(tick);
    });
  }

  // ---------- 註冊到娛樂城 ----------
  (window.ErikaGames = window.ErikaGames || []).push({
    id: 'arena', order: 2, name: '名媛對決', tagline: '3v3 伸展台推塔・排位賽', color: '#8a5cff', color2: '#2a0f3b', badge: '新',
    core: Core,
    art: api => {
      const c = api.cast();
      return `<img src="${c[3].full}" alt="" style="height:88%;left:-6%;bottom:-4%;filter:drop-shadow(0 6px 8px rgba(20,0,30,.45))"><img src="${c[2].full}" alt="" style="height:96%;right:-8%;bottom:-6%;filter:drop-shadow(0 6px 8px rgba(20,0,30,.45))"><span style="position:absolute;left:50%;top:28%;transform:translate(-50%,-50%) skewX(-8deg);font:italic 900 34px/1 'Bodoni Moda',Georgia,serif;color:#fff1c9;text-shadow:0 0 12px rgba(255,120,200,.9),0 2px 0 #7a1f45;letter-spacing:-.04em">VS</span>`;
    },
    open(api) { openArena(api); },
  });
})();
