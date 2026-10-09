// ERIKA 百貨貴婦 — 遊戲主程式
'use strict';
(() => {
  const { FLOORS, CATS, ITEMS, PACKS, SPECIALS, VIP, TITLES, CITIES, ACH, DAILY, FRIEND_LINES } = window.ERIKA_DATA;
  const Art = window.Art;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const now = () => Date.now();
  const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
  const SAVE_KEY = 'erika-save-v1';
  const SANDBOX = /[?&]sandbox\b/.test(location.search); // 測試用：不讀寫存檔、資源給滿
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const GEM = () => Art.gem();
  const COIN = () => Art.coin();

  // ================= 數字格式（萬、億、兆…） =================
  const UNITS = [[1e48, '極'], [1e44, '載'], [1e40, '正'], [1e36, '澗'], [1e32, '溝'], [1e28, '穰'], [1e24, '秭'], [1e20, '垓'], [1e16, '京'], [1e12, '兆'], [1e8, '億'], [1e4, '萬']];
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n);
    if (n < 1e4) return n < 100 && n % 1 ? String(Math.floor(n * 10) / 10) : Math.floor(n).toLocaleString('en-US');
    if (n >= 1e52) return n.toExponential(2).replace('e+', 'e');
    for (const [v, u] of UNITS) {
      if (n >= v) {
        const x = n / v;
        let s = x >= 1000 ? String(Math.floor(x)) : x >= 100 ? (Math.floor(x * 10) / 10).toFixed(1) : (Math.floor(x * 100) / 100).toFixed(2);
        if (s.includes('.')) s = s.replace(/\.?0+$/, '');
        return s + u;
      }
    }
    return String(n);
  }
  const ntd = n => 'NT$ ' + Number(n).toLocaleString('en-US');
  function fmtDur(ms) {
    const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
    if (h) return `${h} 小時 ${m} 分`;
    if (m) return `${m} 分 ${s % 60} 秒`;
    return `${s} 秒`;
  }
  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
  }
  const pad2 = n => String(n).padStart(2, '0');
  const dateStr = t => { const d = new Date(t); return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  // ================= 存檔 =================
  let S;
  function fresh() {
    const s = {
      v: 1, name: 'Erika', coins: 0, gems: 0, tickets: 0, tapLv: 0,
      floors: FLOORS.map(() => 0),
      items: {}, eq: { hair: 'hair_black', dress: 'dress_white', bag: null, jewel: null, head: null, shoes: 'shoes_nude', pet: null },
      st: { taps: 0, fevers: 0, friends: 0, pulls: 0, run: 0, life: 0, lvl: 1, title: 0 },
      stars: 0, branch: 0, ach: {}, boost: { auto: 0, double: 0, butler: 0 },
      fever: 0, feverUntil: 0,
      month: 0, monthLast: '', debut: false, first: {}, rech: { total: 0, count: 0, log: [] },
      daily: { last: '', streak: 0 }, pity: 0,
      set: { sound: true, vib: true }, qty: 1, hint: true,
      savedAt: 0, lastSeen: now(),
    };
    for (const it of ITEMS) if (it.free) s.items[it.id] = 1;
    return s;
  }
  function merge(base, src) {
    for (const k in src) {
      const v = src[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], v);
      else base[k] = v;
    }
    return base;
  }
  function hydrate(obj) {
    const s = merge(fresh(), obj && typeof obj === 'object' ? obj : {});
    s.floors = FLOORS.map((_, i) => Math.max(0, Math.floor(+(s.floors || [])[i] || 0)));
    for (const it of ITEMS) if (it.free) s.items[it.id] = 1;
    for (const k of ['coins', 'gems', 'tickets', 'tapLv', 'stars', 'branch', 'pity']) if (!Number.isFinite(s[k]) || s[k] < 0) s[k] = 0;
    for (const c of CATS) if (s.eq[c.id] && !s.items[s.eq[c.id]]) s.eq[c.id] = c.opt ? null : ITEMS.find(i => i.cat === c.id && i.free).id;
    if (!Array.isArray(s.rech.log)) s.rech.log = [];
    return s;
  }
  function loadLocal() { try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return JSON.parse(raw); } catch (e) { /* 無痕模式等 */ } return null; }
  let passive = false; // 同一個遊戲在別的分頁／視窗打開時，這裡暫停並停止存檔
  function save() { if (SANDBOX || passive) return; S.savedAt = now(); S.lastSeen = now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 存不了就算了 */ } }

  // ================= 經濟 =================
  const MS = [10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000];
  const msCount = l => { let c = 0; for (const m of MS) { if (l >= m) c++; else break; } return c; };
  const nextMs = l => MS.find(m => m > l) ?? null;
  const prevMs = l => { let p = 0; for (const m of MS) { if (l >= m) p = m; else break; } return p; };
  const floorInc = (i, l) => l <= 0 ? 0 : FLOORS[i].inc * l * Math.pow(2, msCount(l));
  const floorCost = (i, l, k = 1) => { const b = FLOORS[i].cost * Math.pow(1.15, l); return k === 1 ? b : b * (Math.pow(1.15, k) - 1) / 0.15; };
  const maxBuy = (i, l, c) => { const b = FLOORS[i].cost * Math.pow(1.15, l); return c < b ? 0 : Math.floor(Math.log(c * 0.15 / b + 1) / Math.log(1.15)); };
  const nextFloor = () => S.floors.findIndex(l => l === 0);
  const floorReq = i => { try { return K()?.floorUnlockReq?.(i) || 0; } catch (e) { return 0; } };
  const townLv = () => { try { return K()?.townLevel?.() ?? 99; } catch (e) { return 99; } };
  const floorOpenable = i => townLv() >= floorReq(i);
  const rawIps = () => S.floors.reduce((a, l, i) => a + floorInc(i, l), 0);
  const fashionBonus = () => { let b = 0; for (const id in S.items) if (ITEM[id]) b += ITEM[id].bonus || 0; return b; };
  const vipLv = (t = S.rech.total) => { let v = 0; VIP.forEach((x, i) => { if (t >= x) v = i + 1; }); return v; };
  const doubleOn = () => S.boost.double > now();
  const kingdomMult = () => { try { const m = K()?.incomeMult?.(); return m > 0 && isFinite(m) ? m : 1; } catch (e) { return 1; } };
  const baseMult = () => (1 + fashionBonus()) * (1 + 0.05 * vipLv()) * (1 + 0.1 * S.stars) * kingdomMult();
  const mult = () => baseMult() * (doubleOn() ? 2 : 1);
  const ips = () => rawIps() * mult();
  const tapCost = () => 20 * Math.pow(1.55, S.tapLv);
  const tapFrac = (l = S.tapLv) => Math.min(0.35, 0.03 + 0.004 * l);
  const tapValue = () => (1 + S.tapLv) * mult() + ips() * tapFrac();
  const feverOn = () => S.feverUntil > now();
  const BRANCH_MIN = 1e10;
  const starsFor = run => Math.floor(Math.cbrt(run / 1e9));
  const city = () => CITIES[Math.min(S.branch, CITIES.length - 1)];
  const level = () => Math.floor(Math.log10(S.st.life + 1) * 1.5) + 1;
  const titleIdx = () => { let t = 0; TITLES.forEach(([v], i) => { if (S.st.life >= v) t = i; }); return t; };
  const title = () => TITLES[titleIdx()][1];
  const ownedCount = () => Object.keys(S.items).filter(id => ITEM[id]).length;
  function gain(v) { if (!(v > 0)) return; S.coins += v; S.st.run += v; S.st.life += v; }

  // ================= 音效（WebAudio 合成） =================
  const Sound = (() => {
    let ctx = null, master = null, nbuf = null;
    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC(); } catch (e) { return null; }
        master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    function tone(f, t, d, type = 'sine', v = 0.15, a = 0.004) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
    }
    function noise(t, d, v = 0.06, hp = 4000) {
      if (!nbuf) { nbuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate); const ch = nbuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = nbuf; f.type = 'highpass'; f.frequency.value = hp;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d);
    }
    const P = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];
    const nf = n => 880 * Math.pow(2, n / 12);
    let step = 0;
    const play = fn => { if (!S || !S.set.sound) return; const c = ensure(); if (!c) return; try { fn(c.currentTime + 0.005); } catch (e) { /* 音效失敗不影響遊戲 */ } };
    return {
      unlock() { if (S && S.set.sound) ensure(); },
      tap(fever, vol = 1) { play(t => { const n = P[Math.min(P.length - 1, Math.floor(fever / 100 * 7) + (step++ % 3))]; const f = nf(n); tone(f, t, 0.22, 'sine', 0.11 * vol); tone(f * 2, t, 0.08, 'triangle', 0.03 * vol); }); },
      click() { play(t => tone(1500, t, 0.06, 'triangle', 0.06)); },
      buy() { play(t => { tone(1318.5, t, 0.12, 'triangle', 0.11); tone(1760, t + 0.07, 0.24, 'triangle', 0.11); noise(t, 0.08, 0.04); }); },
      cash() { play(t => { [0, 4, 7, 12, 16].forEach((n, i) => tone(nf(n + 3), t + i * 0.06, 0.32, 'triangle', 0.09)); noise(t + 0.02, 0.3, 0.05, 6000); }); },
      err() { play(t => { tone(330, t, 0.12, 'square', 0.035); tone(262, t + 0.08, 0.16, 'square', 0.035); }); },
      level() { play(t => [0, 4, 7, 12].forEach((n, i) => { tone(nf(n - 12), t + i * 0.1, 0.55, 'triangle', 0.11); tone(nf(n), t + i * 0.1, 0.4, 'sine', 0.05); })); },
      fever() { play(t => { for (let i = 0; i < 9; i++) tone(nf(P[i]), t + i * 0.045, 0.28, 'triangle', 0.08); }); },
      drum() { play(t => { for (let i = 0; i < 6; i++) noise(t + i * 0.11, 0.07, 0.07, 1200); }); },
      ssr() { play(t => { [0, 4, 7, 11, 14, 19].forEach((n, i) => tone(nf(n - 5), t + i * 0.08, 1, 'sine', 0.09)); noise(t, 1.2, 0.035, 7000); }); },
      ding() { play(t => { tone(nf(7), t, 0.4, 'sine', 0.07); tone(nf(12), t + 0.12, 0.5, 'sine', 0.07); }); },
      beep(f, d = 0.15, type = 'sine', v = 0.1, delay = 0) { play(t => tone(f, t + delay, d, type, v)); },
      hiss(d = 0.1, v = 0.05, hp = 3000, delay = 0) { play(t => noise(t + delay, d, v, hp)); },
    };
  })();
  const vib = ms => { if (S.set.vib && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try { navigator.vibrate(ms); } catch (e) { /* 不支援 */ } };

  // ================= 粒子特效（canvas） =================
  const FX = (() => {
    const cv = $('#fx'), ctx = cv.getContext('2d');
    let W = 0, H = 0, dirty = false;
    const P = [], T = [];
    const COLORS = ['#ff8fb5', '#f6d27a', '#c9a35b', '#ffffff', '#b9a2e8', '#d6457a', '#9fe0c8'];
    function resize() { const d = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
    addEventListener('resize', resize); resize();
    function sprite(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size * 2; const x = c.getContext('2d'); x.scale(2, 2); draw(x); return c; }
    const SPR = {
      coin: sprite(24, x => {
        const g = x.createRadialGradient(8, 7, 1, 12, 12, 12); g.addColorStop(0, '#fff4cf'); g.addColorStop(0.55, '#ecc56f'); g.addColorStop(1, '#b3832f');
        x.fillStyle = g; x.beginPath(); x.arc(12, 12, 10.5, 0, 7); x.fill(); x.strokeStyle = '#9a6c22'; x.lineWidth = 1; x.stroke();
        x.strokeStyle = 'rgba(255,244,207,.85)'; x.beginPath(); x.arc(12, 12, 7.4, 0, 7); x.stroke();
        x.fillStyle = '#8a5d1c'; x.font = 'italic 700 11px Georgia, serif'; x.textAlign = 'center'; x.fillText('E', 12, 16);
      }),
      heart: sprite(20, x => {
        x.fillStyle = '#ff6f9f'; x.beginPath(); x.moveTo(10, 17); x.bezierCurveTo(2, 11, 1, 5, 6, 3.5); x.bezierCurveTo(8.5, 2.8, 10, 5, 10, 6);
        x.bezierCurveTo(10, 5, 11.5, 2.8, 14, 3.5); x.bezierCurveTo(19, 5, 18, 11, 10, 17); x.fill();
        x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(6.5, 6.5, 1.8, 1.2, -0.6, 0, 7); x.fill();
      }),
      gem: sprite(24, x => {
        const g = x.createLinearGradient(0, 0, 24, 24); g.addColorStop(0, '#ffd0e6'); g.addColorStop(0.45, '#ff7fb3'); g.addColorStop(1, '#b24bd6');
        x.fillStyle = g; x.beginPath(); x.moveTo(6.5, 3.5); x.lineTo(17.5, 3.5); x.lineTo(22, 9.3); x.lineTo(12, 21); x.lineTo(2, 9.3); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(2, 9.3); x.lineTo(22, 9.3); x.moveTo(7.6, 9.3); x.lineTo(12, 21); x.lineTo(16.4, 9.3); x.stroke();
      }),
      bag: sprite(24, x => {
        x.strokeStyle = '#c9a35b'; x.lineWidth = 1.6; x.beginPath(); x.arc(12, 8, 4, Math.PI, 0); x.stroke();
        const g = x.createLinearGradient(0, 8, 0, 22); g.addColorStop(0, '#ffb3cb'); g.addColorStop(1, '#e2507f');
        x.fillStyle = g; x.beginPath(); x.moveTo(5, 8); x.lineTo(19, 8); x.lineTo(20.5, 21); x.lineTo(3.5, 21); x.closePath(); x.fill();
        x.fillStyle = '#fff4cf'; x.font = 'italic 700 9px Georgia, serif'; x.textAlign = 'center'; x.fillText('E', 12, 17.5);
      }),
    };
    const add = p => { if (P.length > 420) P.shift(); P.push(p); };
    const target = sel => { const el = $(sel); if (!el) return [W / 2, 40]; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    let bumpAt = 0;
    function arrive(p) { if (p.k === 'coin' && performance.now() - bumpAt > 120) { bumpAt = performance.now(); const el = $('#coinTxt'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }
    function star(x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill(); }
    return {
      text(x, y, text, size = 20, crit = false) { T.push({ x, y, vy: -70, t: 0, life: crit ? 1.3 : 0.95, text, size, crit }); if (T.length > 36) T.shift(); },
      tap(x, y, v, crit, manual) {
        this.text(x, y - 18, '+' + fmt(v), crit ? 30 : manual ? 21 : 16, crit);
        const [tx, ty] = target('#coinIc');
        const n = REDUCED ? 1 : manual ? 3 : 1;
        for (let i = 0; i < n; i++) add({ k: 'coin', x, y, vx: rnd(-130, 130), vy: rnd(-280, -120), t: 0, life: 1.8, fly: true, tx, ty, s: rnd(7, 9.5) });
        if (manual && !REDUCED) for (let i = 0; i < 3; i++) add({ k: Math.random() < 0.5 ? 'heart' : 'spark', x: x + rnd(-14, 14), y: y + rnd(-10, 10), vx: rnd(-70, 70), vy: rnd(-150, -50), g: 260, t: 0, life: rnd(0.5, 0.9), s: rnd(5, 9), c: pick(COLORS) });
        if (crit) this.burst(x, y, 20);
      },
      burst(x, y, n = 24, kinds = ['confetti', 'spark', 'heart']) {
        if (REDUCED) n = Math.ceil(n / 4);
        for (let i = 0; i < n; i++) add({ k: pick(kinds), x, y, vx: rnd(-300, 300), vy: rnd(-460, -120), g: 650, t: 0, life: rnd(1, 1.8), s: rnd(4, 9), c: pick(COLORS), r: rnd(0, 6), vr: rnd(-9, 9) });
      },
      rain(kind = 'confetti', n = 50, area) {
        if (REDUCED) n = Math.ceil(n / 4);
        const x0 = area ? area.left : 0, x1 = area ? area.right : W, y0 = area ? area.top : 0;
        for (let i = 0; i < n; i++) add({ k: kind, x: rnd(x0, x1), y: y0 + rnd(-H * 0.25, -8), vx: rnd(-30, 30), vy: rnd(90, 240), g: 140, t: 0, life: rnd(2.4, 3.8), s: kind === 'confetti' ? rnd(6, 10) : rnd(8, 12), c: pick(COLORS), r: rnd(0, 6), vr: rnd(-5, 5) });
      },
      fly(kind, x, y, n, sel) {
        const [tx, ty] = target(sel);
        for (let i = 0; i < n; i++) add({ k: kind, x: x + rnd(-20, 20), y: y + rnd(-20, 20), vx: rnd(-160, 160), vy: rnd(-300, -100), t: -i * 0.03, life: 2, fly: true, tx, ty, s: rnd(8, 11) });
      },
      step(dt) {
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i]; p.t += dt;
          if (p.t < 0) continue;
          if (p.t >= p.life) { P.splice(i, 1); continue; }
          if (p.fly && p.t > 0.3) {
            const k = Math.min(1, dt * 9); p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
            if (Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y) < 16) { P.splice(i, 1); arrive(p); continue; }
          } else { p.vy += (p.g ?? 720) * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.vr) p.r += p.vr * dt; }
        }
        for (let i = T.length - 1; i >= 0; i--) { const t = T[i]; t.t += dt; t.y += t.vy * dt; t.vy *= 0.96; if (t.t >= t.life) T.splice(i, 1); }
      },
      draw() {
        if (!P.length && !T.length) { if (dirty) { ctx.clearRect(0, 0, W, H); dirty = false; } return; }
        dirty = true; ctx.clearRect(0, 0, W, H);
        for (const p of P) {
          if (p.t < 0) continue;
          ctx.globalAlpha = Math.max(0, Math.min(1, (p.life - p.t) / 0.35));
          if (SPR[p.k]) { const s = p.s * 2; ctx.save(); ctx.translate(p.x, p.y); if (p.r && p.k !== 'coin') ctx.rotate(p.r * 0.3); ctx.drawImage(SPR[p.k], -s / 2, -s / 2, s, s); ctx.restore(); }
          else if (p.k === 'spark') { ctx.fillStyle = p.c === '#ffffff' ? '#fff6c8' : p.c; star(p.x, p.y, p.s * (0.6 + 0.4 * Math.sin(p.t * 20))); }
          else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
        }
        ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        for (const t of T) {
          ctx.globalAlpha = Math.max(0, Math.min(1, (t.life - t.t) * 3));
          ctx.font = `700 ${t.size}px "Bodoni Moda", Georgia, serif`;
          ctx.lineWidth = t.crit ? 5 : 4; ctx.strokeStyle = t.crit ? '#7a1f45' : 'rgba(122,31,69,.88)'; ctx.fillStyle = t.crit ? '#ffe08a' : '#fff';
          ctx.strokeText(t.text, t.x, t.y); ctx.fillText(t.text, t.x, t.y);
          if (t.crit) { ctx.font = '700 14px "Noto Serif TC", "PingFang TC", serif'; ctx.lineWidth = 4; ctx.strokeText('大手筆！×10', t.x, t.y - t.size * 0.95); ctx.fillText('大手筆！×10', t.x, t.y - t.size * 0.95); }
        }
        ctx.globalAlpha = 1;
      },
    };
  })();

  // ================= 對話框 & 提示 =================
  let modalCount = 0;
  const modalQueue = [];
  function modal(o) {
    if (o.queue && modalCount > 0) { modalQueue.push(o); return null; }
    modalCount++;
    const back = document.createElement('div');
    back.className = 'modal-back' + (o.cls ? ' ' + o.cls : '');
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${o.x === false ? '' : `<button class="x" aria-label="關閉">${Art.icon('close')}</button>`}${o.title ? `<h3>${o.title}</h3>` : ''}<div class="mbody">${o.body || ''}</div>${o.actions ? `<div class="acts">${o.actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-a="${i}">${a.label}</button>`).join('')}</div>` : ''}</div>`;
    const m = back.firstElementChild;
    const close = () => {
      if (!back.isConnected) return;
      back.remove(); modalCount--;
      if (o.onClose) o.onClose();
      if (modalCount === 0 && modalQueue.length) setTimeout(() => modal(modalQueue.shift()), 150);
    };
    back._close = close; back._dismiss = o.x !== false;
    const openedAt = performance.now();
    back.addEventListener('click', e => {
      if (performance.now() - openedAt < 350) return; // 防連點：剛打開的瞬間不接受點擊
      if (e.target === back && o.x !== false) { close(); return; }
      if (e.target.closest('.x')) { close(); return; }
      const b = e.target.closest('[data-a]');
      if (b && o.actions) { const a = o.actions[+b.dataset.a]; Sound.click(); if (a.fn) a.fn(close, m, b); else close(); }
    });
    $('#modalRoot').appendChild(back);
    if (o.onOpen) o.onOpen(m, close);
    return { m, close };
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') { const b = $('#modalRoot').lastElementChild; if (b && b._dismiss) b._close(); } });
  function toast(html, cls = '') {
    const box = $('#toasts'), el = document.createElement('div');
    el.className = 'toast ' + cls; el.innerHTML = html; box.appendChild(el);
    while (box.children.length > 3) box.firstElementChild.remove();
    setTimeout(() => el.remove(), 2700);
  }
  function shake(el) { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); }
  function centerOf(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
  // 花粉鑽的按鈕：第一下變「確認」，2.6 秒內再點一下才扣
  function twoTap(el, fn, refresh) {
    if (el.dataset.confirm) { delete el.dataset.confirm; el.classList.remove('confirm'); clearTimeout(el._t); fn(); }
    else {
      $$('[data-confirm]').forEach(x => { delete x.dataset.confirm; x.classList.remove('confirm'); });
      el.dataset.confirm = '1'; el.classList.add('confirm'); Sound.click();
      el._t = setTimeout(() => { delete el.dataset.confirm; el.classList.remove('confirm'); if (refresh) refresh(); }, 2600);
    }
    if (refresh) refresh();
  }
  function spendGems(n) { if (S.gems < n) { needGems(n); return false; } S.gems -= n; return true; }
  function needGems(n) {
    Sound.err();
    modal({ title: '粉鑽不夠囉', body: `<p class="mb">還差 ${GEM()} <b>${(n - S.gems).toLocaleString()}</b> 粉鑽。<br>去儲值中心補一點吧！</p>`, actions: [{ label: '再想想', cls: 'ghost' }, { label: '去儲值', cls: 'gemb', fn: c => { c(); go('shop'); } }] });
  }

  // ================= 分頁 =================
  const PAGES = [['home', '百貨', 'home'], ['kingdom', '王國', 'castle'], ['floors', '樓層', 'floors'], ['wardrobe', '衣櫥', 'wardrobe'], ['play', '娛樂', 'play'], ['shop', '儲值', 'gem']];
  const SUBPAGES = { gacha: 'play' }; // 子頁 → 亮起哪個分頁
  const K = () => window.ErikaKingdom; // Kingshot 式王國模組（js/kingdom.js）
  let kingdomMounted = false;
  let page = 'home';
  function go(p) {
    if (page === 'kingdom' && p !== 'kingdom') { try { K()?.hide?.(); } catch (e) { console.error(e); } }
    page = p;
    const tabOf = SUBPAGES[p] || p;
    for (const id of [...PAGES.map(x => x[0]), ...Object.keys(SUBPAGES)]) $('#pg-' + id).classList.toggle('on', id === p);
    for (const [id] of PAGES) $(`.tab[data-p="${id}"]`).classList.toggle('on', id === tabOf);
    if (p === 'kingdom') {
      try {
        if (!kingdomMounted && K()?.mount) { K().mount($('#pg-kingdom'), API); kingdomMounted = true; }
        K()?.show?.();
      } catch (e) { console.error(e); $('#pg-kingdom').innerHTML = '<div class="pane"><p class="fine">王國正在整修中，請稍後再來。</p></div>'; }
    }
    if (p === 'floors') buildFloors();
    if (p === 'wardrobe') buildWardrobe();
    if (p === 'gacha') buildGacha();
    if (p === 'play') buildPlay();
    if (p === 'shop') buildShop();
    if (p !== 'home') $('#pg-' + p).scrollTop = 0;
    attach3D();
  }

  // ================= 首頁：舞台 =================
  function eqItems(eq = S.eq) { const o = {}; for (const c of CATS) o[c.id] = eq[c.id] ? ITEM[eq[c.id]] : null; return o; }
  const E3 = () => (window.Erika3D && window.Erika3D.ready ? window.Erika3D : null);
  // 單品圖示：已經拍過 3D 縮圖就直接用，否則先用 2D（force=true 時當場拍）
  function iconHTML(it, force) {
    const e = E3();
    const url = e && (force ? e.thumb(it) : e._thumbCached && e._thumbCached(it.id));
    return url ? `<img class="iv iv3d" src="${url}" alt="">` : Art.itemIcon(it);
  }
  let thumbGen = 0;
  async function upgradeThumbs(root) {
    const e = E3();
    if (!e || !root) return;
    const gen = thumbGen;
    for (const el of root.querySelectorAll('[data-thumb]')) {
      if (el.querySelector('.iv3d')) continue;
      await new Promise(r => setTimeout(r, 16));
      if (gen !== thumbGen || !el.isConnected) return;
      const url = e.thumb(ITEM[el.dataset.thumb]);
      if (url) el.innerHTML = `<img class="iv iv3d" src="${url}" alt="">`;
    }
  }
  // 立繪 HTML：3D 版用截圖，否則用 2D 向量畫
  function portraitHTML(kind = 'full') {
    const e = E3();
    const url = e && e.snapshot(kind, kind === 'full' ? 300 : 256, kind === 'full' ? 500 : 256);
    return url ? `<img class="p3d" src="${url}" alt="">` : Art.avatar(eqItems());
  }
  function renderAvatar() {
    const eq = eqItems(), e = E3();
    if (e) {
      e.setOutfit(eq);
      $('.avatar-wrap').hidden = true;
      const url = e.snapshot('bust', 128, 128);
      $('#meAva').innerHTML = url ? `<img src="${url}" alt="">` : Art.avatar(eq, { headOnly: true, vb: '70 40 100 100' });
    } else {
      $('#avatar').innerHTML = Art.avatar(eq);
      $('#meAva').innerHTML = Art.avatar(eq, { headOnly: true, vb: '70 40 100 100' });
      const wd = $('#wdAva'); if (wd) wd.innerHTML = Art.avatar(eq);
    }
  }
  function attach3D() {
    const e = window.Erika3D;
    if (!e) return;
    e.attach(page === 'home' ? $('#stage3d') : page === 'wardrobe' ? $('#wdAva') : null);
  }
  window.addEventListener('erika3d-ready', () => { renderAvatar(); attach3D(); if (page === 'wardrobe') { const wd = $('#wdAva'); if (wd) { wd.querySelectorAll('svg').forEach(x => x.remove()); } } });
  function buildHome() {
    const c = city();
    $('#facade').innerHTML = Art.facade(c);
    $('#cityTag').innerHTML = `${Art.icon('pin')}${c.name}${S.branch ? '分店' : '本店'}${S.stars ? `<span class="stars-tag">★${S.stars}</span>` : ''}`;
    renderAvatar();
    $('#tapHint').hidden = !S.hint;
  }
  let lastSquish = 0;
  function squish() {
    const t = performance.now(); if (t - lastSquish < 70 || REDUCED) return; lastSquish = t;
    if (E3()) { E3().react('tap'); return; }
    $('#avatar').animate([{ transform: 'scale(1,1)' }, { transform: 'scale(1.035,.965)' }, { transform: 'scale(.99,1.01)' }, { transform: 'scale(1,1)' }], { duration: 200, easing: 'ease-out' });
  }

  let lastTapAt = 0, hintTaps = 0, autoFlip = false;
  function doTap(x, y, manual) {
    let v = tapValue(), crit = false;
    if (feverOn()) v *= 5;
    if (manual && Math.random() < 0.04) { crit = true; v *= 10; }
    gain(v);
    S.st.taps++;
    if (!feverOn()) { S.fever = Math.min(100, S.fever + (manual ? 2.4 : 1.1)); if (S.fever >= 100) startFever(); }
    if (manual) lastTapAt = performance.now();
    if (page === 'home' && modalCount === 0 && !overlayCount) FX.tap(x, y, v, crit, manual);
    if (manual) {
      event('tap');
      squish(); Sound.tap(S.fever); vib(crit ? 25 : 8);
      if (S.hint && ++hintTaps >= 8) { S.hint = false; $('#tapHint').hidden = true; }
    } else if (page === 'home' && modalCount === 0 && (autoFlip = !autoFlip)) Sound.tap(S.fever, 0.45);
  }
  const FEVER_DUR = 12000;
  function startFever() {
    S.feverUntil = now() + FEVER_DUR; S.fever = 100; S.st.fevers++;
    $('#stage').classList.add('fever');
    Sound.fever(); vib([20, 40, 20]);
    if (page === 'home') { FX.rain('bag', 26, $('#stage').getBoundingClientRect()); toast('購物狂熱！點擊收益 ×5', 'gold'); }
  }
  function autoTap() {
    const r = $('#stage').getBoundingClientRect();
    doTap(r.left + r.width * rnd(0.32, 0.68), r.top + r.height * rnd(0.35, 0.75), false);
  }

  // 貴婦閨蜜（隨機出現，點了有獎勵）
  let friendTimer = rnd(15, 28), friendEl = null, friendUntil = 0;
  function spawnFriend() {
    const st = $('#stage'), right = Math.random() < 0.5;
    const who = pick(CAST_DEF.slice(1));
    const el = document.createElement('button');
    el.className = 'friend' + (right ? ' right' : '');
    el.setAttribute('aria-label', '接待貴婦閨蜜');
    el.innerHTML = `<span class="f-face"><img src="assets/cast/${who.model}-joy.webp" alt=""></span><span class="f-say"><b class="f-name">${who.name}</b>${pick(FRIEND_LINES)}<small>點我接待 ♥</small></span>`;
    el.style.top = rnd(20, 44) + '%';
    el.style[right ? 'right' : 'left'] = '10px';
    el.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); greetFriend(el, e.clientX, e.clientY); });
    st.appendChild(el); friendEl = el; friendUntil = now() + 11000;
    Sound.ding();
  }
  function greetFriend(el, x, y) {
    S.st.friends++;
    event('friend');
    const r = Math.random();
    let msg;
    if (r < 0.2) { const g = Math.floor(rnd(2, 6)); S.gems += g; msg = `閨蜜送妳 ${g} 顆粉鑽！`; FX.fly('gem', x, y, g, '#gemIc'); }
    else if (r < 0.28 && !feverOn()) { startFever(); msg = '閨蜜帶動買氣！'; }
    else { const v = Math.max(ips() * 90, tapValue() * 40, 60); gain(v); msg = `閨蜜大手筆消費 ${fmt(v)} 金幣！`; FX.tap(x, y, v, true, false); }
    toast(msg, 'gold'); Sound.cash(); vib(15);
    el.remove(); friendEl = null; friendTimer = rnd(30, 65);
  }

  // 加成（花粉鑽）
  const BOOSTS = [
    { id: 'auto', name: '秘書代點', icon: 'hand', gems: 30, dur: 30 * 60e3, desc: '每秒自動點 8 下' },
    { id: 'double', name: '雙倍營收', icon: 'x2', gems: 40, dur: 30 * 60e3, desc: '所有收益 ×2' },
    { id: 'butler', name: '管家代買', icon: 'butler', gems: 30, dur: 30 * 60e3, desc: '自動升級樓層' },
    { id: 'warp', name: '時光快轉', icon: 'clock', gems: 50, desc: '立刻拿 2 小時收益' },
  ];
  function buildBoosts() {
    $('#boosts').innerHTML = BOOSTS.map(b => `<button class="boost" data-b="${b.id}" aria-label="${b.name}：${b.desc}"><span class="b-ic">${Art.icon(b.icon)}</span><b>${b.name}</b><span class="b-st"></span><i class="b-prog"></i></button>`).join('');
    updateBoosts();
  }
  function updateBoosts() {
    const t = now();
    for (const b of BOOSTS) {
      const el = $(`.boost[data-b="${b.id}"]`); if (!el) continue;
      const until = S.boost[b.id] || 0, on = !!b.dur && until > t;
      el.classList.toggle('on', on);
      const html = el.dataset.confirm ? `再點確認 ${GEM()}${b.gems}` : on ? clock(until - t) : `${GEM()}${b.gems}`;
      const st = el.querySelector('.b-st'); if (st._h !== html) { st.innerHTML = html; st._h = html; }
      el.querySelector('.b-prog').style.width = on ? Math.min(100, (until - t) / b.dur * 100) + '%' : '0';
    }
  }
  function buyBoost(b, el) {
    if (b.id === 'warp' && rawIps() <= 0) { toast('先開幕一層樓，時光快轉才有收益喔'); Sound.err(); return; }
    if (!spendGems(b.gems)) return;
    Sound.buy(); vib(15);
    if (b.id === 'warp') {
      const v = ips() * 7200;
      gain(v);
      butlerHold = now() + 8000; // 剛快轉的金幣先讓妳看清楚，管家 8 秒後才繼續花
      updateHudFast();
      const [x, y] = el ? centerOf(el) : [innerWidth / 2, innerHeight / 2];
      FX.fly('coin', x, y, 18, '#coinIc');
      const c = $('#coinTxt').getBoundingClientRect();
      FX.text(c.left + 70, c.bottom + 70, '+' + fmt(v), 30, false); // 從金幣欄下方往上飄進去
      Sound.cash();
      toast(`時光快轉！金幣 +${fmt(v)}（現在共 ${fmt(S.coins)}）`, 'gold');
    } else {
      S.boost[b.id] = Math.max(now(), S.boost[b.id] || 0) + b.dur;
      toast(`${b.name}啟動！${b.desc}，持續 30 分鐘`, 'gold');
    }
    save(); Cloud.soon(); updateBoosts();
  }

  // 管家：自動挑最划算的升級（每 15 秒回報一次花了多少）
  let butlerHold = 0, butlerLog = { n: 0, spent: 0, at: 0 };
  function butlerReport(force) {
    const t = now();
    if (!butlerLog.n || (!force && t - butlerLog.at < 15000)) return;
    toast(`管家代買：剛幫妳升級 ${butlerLog.n} 次，花了 ${fmt(butlerLog.spent)} 金幣`);
    butlerLog = { n: 0, spent: 0, at: t };
  }
  function butlerStep() {
    if (now() < butlerHold) return false;
    if (!butlerLog.at) butlerLog.at = now();
    let best = null;
    const m = mult(), nf = nextFloor();
    S.floors.forEach((l, i) => {
      if (l === 0 && (i !== nf || !floorOpenable(i))) return;
      const c = floorCost(i, l); if (c > S.coins) return;
      let score = (floorInc(i, l + 1) - floorInc(i, l)) * m / c;
      if (l === 0) score *= 3;
      if (!best || score > best.score) best = { score, fn: () => { S.coins -= c; S.floors[i]++; butlerLog.n++; butlerLog.spent += c; if (l === 0) toast(`管家幫妳開了「${FLOORS[i].name}」`, 'gold'); } };
    });
    const tc = tapCost();
    if (tc <= S.coins) {
      const rate = S.boost.auto > now() ? 8 : 3;
      const score = (m + ips() * 0.004) * rate / tc;
      if (!best || score > best.score) best = { score, fn: () => { S.coins -= tc; S.tapLv++; butlerLog.n++; butlerLog.spent += tc; } };
    }
    if (best) { best.fn(); butlerReport(); return true; }
    return false;
  }

  // ================= 樓層頁 =================
  let floorsSig = '';
  function buildFloors() {
    const pane = $('#pg-floors .pane'), nf = nextFloor();
    floorsSig = nf + '|' + S.branch;
    let h = `<div class="sec-h"><div><div class="eyebrow">Floor Directory</div><h2>樓層導覽</h2></div>
      <div class="seg" id="qtySeg" role="group" aria-label="一次升級幾級">${[1, 10, 100, 'max'].map(q => `<button data-q="${q}" class="${String(S.qty) === String(q) ? 'on' : ''}">${q === 'max' ? 'MAX' : '×' + q}</button>`).join('')}</div></div>`;
    h += `<div class="row-card tap-card"><div class="row-ic"><span class="ri">${Art.icon('hand')}</span></div>
      <div class="row-main"><div class="t"><b>櫃姐培訓</b><span class="lv">Lv.<span id="tapLv"></span></span></div><div class="inc">每次點擊 <b id="tapNow"></b></div><div class="ms"><span>點擊也會分到每秒收益的 <b id="tapPct"></b></span></div></div>
      <button class="btn" data-tapup><span>培訓</span><small>${COIN()}<span id="tapCost"></span></small></button></div>`;
    FLOORS.forEach((f, i) => {
      const lv = S.floors[i];
      if (lv > 0) {
        h += `<div class="row-card" data-row="${i}"><div class="row-ic">${Art.floorIcon(f.icon, f.tint)}<span class="fno">${i + 1}F</span></div>
          <div class="row-main"><div class="t"><b>${f.name}</b><span class="lv">Lv.<span class="lvn"></span></span></div>
          <div class="inc">每秒 <b class="incv"></b></div><div class="ms"><span class="bar"><i></i></span><span class="mst"></span></div></div>
          <button class="btn" data-buy="${i}"><span class="bl">升級</span><small>${COIN()}<span class="bc"></span></small></button></div>`;
      } else if (i === nf) {
        h += `<div class="row-card locked" data-row="${i}"><div class="row-ic">${Art.floorIcon(f.icon, f.tint)}<span class="fno">${i + 1}F</span></div>
          <div class="row-main"><div class="t"><b>${f.name}</b><em>${f.en}</em></div><div class="inc">${f.line}</div><div class="inc">開幕後每秒 <b class="incv"></b></div>${floorReq(i) > townLv() ? `<div class="ms" style="color:var(--rose-deep)">需要百貨本館 Lv.${floorReq(i)}（到王國升級）</div>` : ''}</div>
          <button class="btn goldb" data-buy="${i}"><span>開幕</span><small>${COIN()}<span class="bc"></span></small></button></div>`;
      }
    });
    if (nf >= 0 && nf < FLOORS.length - 1) h += `<div class="teaser">還有 ${FLOORS.length - nf - 1} 層樓等妳解鎖…</div>`;
    const n = starsFor(S.st.run), nc = CITIES[Math.min(S.branch + 1, CITIES.length - 1)];
    h += `<div class="branch-card"><div class="eyebrow" style="color:#ecd08a">Grand Opening</div><h3>開設海外分店：${nc.name}</h3>
      <p>本店營收達 ${fmt(BRANCH_MIN)} 就能開分店。金幣和樓層重新開始，但會拿到永久的「星光」加成，衣櫥、粉鑽、VIP 都保留。</p>
      <div class="bc-row"><span id="branchInfo" class="sub" style="color:#f2dcb0"></span><button class="btn goldb" data-branch>開分店<small id="branchBtnStars"></small></button></div></div>`;
    pane.innerHTML = h;
    updateFloors();
  }
  function qtyFor(i) {
    const lv = S.floors[i];
    if (lv === 0) return 1;
    if (S.qty === 'max') return Math.max(1, maxBuy(i, lv, S.coins));
    return S.qty;
  }
  function updateFloors() {
    if (floorsSig !== nextFloor() + '|' + S.branch) { buildFloors(); return; }
    const m = mult();
    $$('#pg-floors [data-row]').forEach(row => {
      const i = +row.dataset.row, lv = S.floors[i], k = qtyFor(i), c = floorCost(i, lv, k);
      const btn = row.querySelector('[data-buy]');
      btn.classList.toggle('off', S.coins < c);
      row.querySelector('.bc').textContent = fmt(c);
      if (lv > 0) {
        row.querySelector('.lvn').textContent = lv;
        row.querySelector('.incv').textContent = '+' + fmt(floorInc(i, lv) * m);
        row.querySelector('.bl').textContent = k > 1 ? `升級 ×${k}` : '升級';
        const nm = nextMs(lv), pm = prevMs(lv);
        row.querySelector('.bar i').style.width = nm ? ((lv - pm) / (nm - pm) * 100) + '%' : '100%';
        row.querySelector('.mst').textContent = nm ? `Lv.${nm} 收益 ×2` : '已滿里程碑';
      } else row.querySelector('.incv').textContent = '+' + fmt(FLOORS[i].inc * m);
    });
    const tl = $('#tapLv');
    if (tl) {
      tl.textContent = S.tapLv;
      $('#tapNow').textContent = '+' + fmt(tapValue());
      $('#tapPct').textContent = Math.round(tapFrac() * 1000) / 10 + '%';
      $('#tapCost').textContent = fmt(tapCost());
      $('[data-tapup]').classList.toggle('off', S.coins < tapCost());
    }
    const bi = $('#branchInfo');
    if (bi) {
      const ok = S.st.run >= BRANCH_MIN;
      bi.textContent = ok ? `可獲得 ★${starsFor(S.st.run)}（收益 +${starsFor(S.st.run) * 10}%）` : `本店營收 ${fmt(S.st.run)} / ${fmt(BRANCH_MIN)}`;
      $('[data-branch]').classList.toggle('off', !ok);
      $('#branchBtnStars').textContent = ok ? `★+${starsFor(S.st.run)}` : '未達成';
    }
  }
  function buyFloor(i, btn) {
    const lv = S.floors[i];
    if (lv === 0 && i !== nextFloor()) return;
    if (lv === 0 && !floorOpenable(i)) { shake(btn); Sound.err(); toast(`要先把「百貨本館」升到 Lv.${floorReq(i)}，到王國去蓋吧！`); return; }
    const k = qtyFor(i), c = floorCost(i, lv, k);
    if (S.coins < c) { shake(btn); Sound.err(); return; }
    S.coins -= c; S.floors[i] += k;
    event('floor_up', { n: k });
    Sound.buy(); vib(10);
    const [x, y] = centerOf(btn); FX.burst(x, y, 12, ['spark', 'confetti']);
    if (lv === 0) { toast(`${FLOORS[i].name} 盛大開幕！`, 'gold'); FX.rain('confetti', 60); buildFloors(); }
    else if (msCount(S.floors[i]) > msCount(lv)) toast(`${FLOORS[i].name} 達成 Lv.${prevMs(S.floors[i])}，收益 ×2！`, 'gold');
    updateFloors();
  }
  function buyTap(btn) {
    const c = tapCost();
    if (S.coins < c) { shake(btn); Sound.err(); return; }
    S.coins -= c; S.tapLv++; Sound.buy(); vib(10);
    const [x, y] = centerOf(btn); FX.burst(x, y, 10, ['spark', 'heart']);
    updateFloors();
  }

  // ================= 衣櫥頁 =================
  let wdCat = 'dress';
  const RANK = { R: 1, SR: 2, SSR: 3 };
  const itemOrder = (a, b) => {
    const ka = a.free ? 0 : a.cost ? 1 : a.gems ? 2 : 3, kb = b.free ? 0 : b.cost ? 1 : b.gems ? 2 : 3;
    if (ka !== kb) return ka - kb;
    return (a.cost || a.gems || RANK[a.gacha] || 0) - (b.cost || b.gems || RANK[b.gacha] || 0);
  };
  function buildWardrobe() {
    const pane = $('#pg-wardrobe .pane');
    pane.innerHTML = `<div class="wd-show"><div class="wd-spot"></div><div class="wd-ava" id="wdAva" data-frame="full">${E3() ? '' : Art.avatar(eqItems())}</div>
      <div class="wd-stat"><div class="eyebrow">Fashion Index</div><div class="big">+${Math.round(fashionBonus() * 100)}%</div>
      <div class="note">單品「買了就加成」，穿不穿都算。換裝只是為了美美的！</div><div class="cnt">收藏 ${ownedCount()} / ${ITEMS.length} 件</div></div></div>
      <div class="cats" id="cats" role="tablist">${CATS.map(c => `<button role="tab" data-c="${c.id}" class="${c.id === wdCat ? 'on' : ''}">${c.name}<span class="dot" hidden></span></button>`).join('')}</div>
      <div class="grid3" id="wdGrid"></div>`;
    buildGrid();
    attach3D();
  }
  function buildGrid() {
    const list = ITEMS.filter(i => i.cat === wdCat).sort(itemOrder);
    thumbGen++;
    $('#wdGrid').innerHTML = list.map(it => {
      const own = !!S.items[it.id], eq = S.eq[it.cat] === it.id;
      return `<button class="item ${eq ? 'eq' : ''} ${own ? '' : 'notown'} ${it.gacha && !own ? 'gacha-lock' : ''}" data-i="${it.id}">
        ${it.gacha ? `<span class="rar ${it.gacha}">${it.gacha}</span>` : ''}<span class="ii" data-thumb="${it.id}">${iconHTML(it)}</span>
        <span class="nm">${it.name}</span><span class="bn">${it.bonus ? `收益 +${Math.round(it.bonus * 100)}%` : '基本款'}</span><span class="pr"></span></button>`;
    }).join('');
    updateWardrobe();
    upgradeThumbs($('#wdGrid'));
  }
  function updateWardrobe() {
    $$('#wdGrid .item').forEach(el => {
      const it = ITEM[el.dataset.i], own = !!S.items[it.id], eq = S.eq[it.cat] === it.id, pr = el.querySelector('.pr');
      let cls = 'pr', html;
      if (own) { cls += ' own'; html = eq ? (CATS.find(c => c.id === it.cat).opt ? '穿著中・點我脫下' : '穿著中') : '換上'; }
      else if (it.gacha) { cls += ' lock'; html = '福袋限定'; }
      else if (it.gems) { cls += ' gem'; html = el.dataset.confirm ? `確認 ${GEM()}${it.gems}` : `${GEM()}${it.gems}`; }
      else { if (S.coins < it.cost) cls += ' cant'; html = `${COIN()}${fmt(it.cost)}`; }
      if (pr._h !== html || pr.className !== cls) { pr.className = cls; pr.innerHTML = html; pr._h = html; }
    });
    for (const c of CATS) { const d = $(`#cats [data-c="${c.id}"] .dot`); if (d) d.hidden = !ITEMS.some(i => i.cat === c.id && i.cost && !S.items[i.id] && S.coins >= i.cost); }
  }
  function tapItem(it, el) {
    if (S.items[it.id]) {
      const cat = CATS.find(c => c.id === it.cat);
      if (S.eq[it.cat] === it.id) { if (!cat.opt) return; S.eq[it.cat] = null; }
      else S.eq[it.cat] = it.id;
      Sound.click(); renderAvatar(); buildGrid(); save(); return;
    }
    if (it.gacha) { toast('這是福袋限定單品，去福袋碰碰運氣吧！'); Sound.err(); return; }
    if (it.gems) { twoTap(el, () => { if (spendGems(it.gems)) ownItem(it, el); }, updateWardrobe); return; }
    if (S.coins < it.cost) { shake(el); Sound.err(); toast(`還差 ${fmt(it.cost - S.coins)} 金幣`); return; }
    S.coins -= it.cost; ownItem(it, el);
  }
  function ownItem(it, el) {
    S.items[it.id] = 1; S.eq[it.cat] = it.id;
    event('item_buy');
    Sound.buy(); vib(15);
    if (E3()) setTimeout(() => E3() && E3().react('buy'), 50);
    if (el) { const [x, y] = centerOf(el); FX.burst(x, y, 24); }
    toast(`入手「${it.name}」收益 +${Math.round(it.bonus * 100)}%`, 'gold');
    renderAvatar(); if (page === 'wardrobe') buildWardrobe();
    save(); Cloud.soon();
  }

  // ================= 福袋頁 =================
  const PITY = 60;
  function buildGacha() {
    const pool = ITEMS.filter(i => i.gacha).sort((a, b) => RANK[b.gacha] - RANK[a.gacha]);
    const got = pool.filter(i => S.items[i.id]).length;
    $('#pg-gacha .pane').innerHTML = `<button class="btn ghost back-link" data-back="play">${Art.icon('back')}<span>回娛樂城</span></button><div class="gacha-hero"><div class="eyebrow">Lucky Bag</div><h2>ERIKA 精品福袋</h2>
      <div class="sub">每次必得一件時尚單品・十連抽保底 SR 以上</div>
      <div id="giftWrap">${Art.giftBox()}</div>
      <div class="pull-row"><button class="btn gemb" data-pull="1">單抽<small id="pull1Cost"></small></button><button class="btn goldb" data-pull="10">十連抽<small>${GEM()}450</small></button></div>
      <div class="rates"><span><b class="rc-SSR">SSR</b> 5%</span><span><b class="rc-SR">SR</b> 20%</span><span><b class="rc-R">R</b> 75%</span><span>再抽 ${PITY - S.pity} 次必中 SSR</span></div></div>
      <div class="sec-h"><div><div class="eyebrow">Collection</div><h2>福袋圖鑑</h2></div><div class="sub">${got} / ${pool.length}</div></div>
      <div class="coll">${pool.map(it => `<div class="c ${it.gacha} ${S.items[it.id] ? '' : 'no'}" title="${it.name}" data-thumb="${it.id}">${iconHTML(it)}</div>`).join('')}</div>
      <p class="fine">重複抽到的單品會自動換成金幣或粉鑽，不會浪費。</p>`;
    updateGacha();
    upgradeThumbs($('#pg-gacha .coll'));
  }
  function updateGacha() {
    const el = $('#pull1Cost'); if (!el) return;
    const html = S.tickets > 0 ? `${Art.ticket()} 福袋券 ×${S.tickets}` : `${GEM()}50`;
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
  }
  let pulling = false;
  function roll(min) {
    S.pity++;
    const x = Math.random();
    let rar = S.pity >= PITY ? 'SSR' : x < 0.05 ? 'SSR' : x < 0.25 ? 'SR' : 'R';
    if (min === 'SR' && rar === 'R') rar = 'SR';
    if (rar === 'SSR') S.pity = 0;
    return { it: pick(ITEMS.filter(i => i.gacha === rar)), rar };
  }
  function pull(n) {
    if (pulling) return;
    if (n === 1 && S.tickets > 0) S.tickets--;
    else if (!spendGems(n === 1 ? 50 : 450)) return;
    pulling = true;
    const res = [];
    for (let i = 0; i < n; i++) res.push(roll());
    if (n === 10 && res.every(r => r.rar === 'R')) { S.pity--; res[9] = roll('SR'); }
    const ips0 = ips();
    for (const r of res) {
      if (S.items[r.it.id]) {
        if (r.rar === 'SSR') { S.gems += 30; r.dup = `重複 → ${GEM()}30`; }
        else { const v = Math.max(r.rar === 'SR' ? 5000 : 500, ips0 * (r.rar === 'SR' ? 900 : 180)); gain(v); r.dup = `重複 → ${fmt(v)} 金幣`; if (r.rar === 'SR') { const h = pick(CAST_DEF).id; heroState(h).shards += 2; r.dup += '＋碎片×2'; } }
      } else { S.items[r.it.id] = 1; r.isNew = true; }
    }
    S.st.pulls += n;
    event('gacha', { n });
    save(); Cloud.soon();
    const box = $('#giftWrap .giftbox');
    if (box) box.classList.add('opening');
    Sound.drum(); vib([10, 60, 10, 60, 10]);
    setTimeout(() => {
      const hasSSR = res.some(r => r.rar === 'SSR');
      const [x, y] = box ? centerOf(box) : [innerWidth / 2, innerHeight / 2];
      FX.burst(x, y, 40);
      if (hasSSR) { Sound.ssr(); FX.rain('confetti', 80); } else Sound.cash();
      showResults(res, n, hasSSR);
      pulling = false;
      buildGacha();
    }, 750);
  }
  function showResults(res, n, hasSSR) {
    const cards = res.map((r, i) => `<div class="rcard ${r.rar}" style="animation-delay:${i * 0.08}s"><span class="rar ${r.rar}">${r.rar}</span>${r.isNew ? '<span class="new">NEW</span>' : ''}${iconHTML(r.it, true)}<span class="nm">${r.it.name}</span>${r.dup ? `<span class="dup">${r.dup}</span>` : `<span class="dup">收益 +${Math.round(r.it.bonus * 100)}%</span>`}</div>`).join('');
    modal({
      title: hasSSR ? '✦ 傳說級 SSR 入手 ✦' : '福袋開獎！',
      body: `<div class="result-grid ${n === 1 ? 'one' : ''}">${cards}</div>`,
      actions: [{ label: '收下', cls: 'ghost' }, { label: n === 1 ? '再抽一次' : '再十連', cls: n === 1 ? 'gemb' : 'goldb', fn: c => { c(); setTimeout(() => pull(n), 200); } }],
    });
  }

  // ================= 儲值頁（模擬，不扣款，只記錄金額） =================
  function buildShop() {
    const v = vipLv(), next = VIP[v], prev = v ? VIP[v - 1] : 0;
    const pct = next ? (S.rech.total - prev) / (next - prev) * 100 : 100;
    const log = S.rech.log.slice(0, 60);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthSum = S.rech.log.filter(r => r.t >= monthStart.getTime()).reduce((a, r) => a + r.ntd, 0);
    const pack = p => {
      const first = !S.first[p.id];
      return `<div class="pack">${first ? '<span class="first">首儲雙倍</span>' : ''}${p.tag ? `<span class="tag">${p.tag}</span>` : ''}${Art.packArt(p.art)}
        <div class="g">${GEM()}${p.gems.toLocaleString()}</div>
        <div class="bonus">${first ? `首儲再送 ${(p.gems + p.bonus).toLocaleString()}` : p.bonus ? `加贈 ${p.bonus.toLocaleString()}` : ''}</div>
        <button class="btn" data-pack="${p.id}">${ntd(p.ntd)}</button></div>`;
    };
    const special = p => {
      let state = '', label = ntd(p.ntd), cls = 'btn goldb';
      if (p.id === 'month' && S.month > now()) { state = `生效中・剩 ${Math.ceil((S.month - now()) / 86400e3)} 天`; label = '續購 ' + ntd(p.ntd); }
      if (p.id === 'debut' && S.debut) { state = '已購買'; cls = 'btn off'; label = '已購買'; }
      if (p.id === 'pass' && pass().premium) { state = `第 ${pass().season} 季已啟用`; cls = 'btn off'; label = '已啟用'; }
      return `<div class="shop-sp"><div class="sp-ic">${p.id === 'month' ? Art.gem() : Art.ticket()}</div><div style="min-width:0"><b>${p.name}</b><p>${p.desc}</p>${state ? `<div class="state">${state}</div>` : ''}</div><button class="${cls}" data-sp="${p.id}">${label}</button></div>`;
    };
    $('#pg-shop .pane').innerHTML = `
      <div class="vipcard"><div class="vip-top"><div><div class="eyebrow" style="color:#ecd08a">ERIKA Privilège</div><div class="vip-lv"><small>VIP</small>${v}</div></div>
        <div class="vip-sum">累計儲值<b>${ntd(S.rech.total)}</b>${S.rech.count} 次・本月 ${ntd(monthSum)}</div></div>
        <div class="vip-bar"><i style="width:${pct}%"></i></div>
        <div class="vip-next">${next ? `再儲值 ${ntd(next - S.rech.total)} 升級 VIP ${v + 1}` : '已達最高 VIP 等級，妳就是百貨女王！'}</div>
        <div class="vip-perks"><span>收益 +${v * 5}%</span><span>離線收益上限 ${8 + v} 小時</span><span>每日 VIP 禮 ${v * 10} 粉鑽</span></div></div>
      <div class="sec-h"><div><div class="eyebrow">Pink Diamonds</div><h2>粉鑽儲值</h2></div><div class="sub">現有 ${GEM()} ${S.gems.toLocaleString()}</div></div>
      <div class="packs">${PACKS.map(pack).join('')}</div>
      <div class="sec-h"><div><div class="eyebrow">Special Offer</div><h2>貴婦特惠</h2></div></div>
      ${SPECIALS.map(special).join('')}
      <p class="fine">※ 這是遊戲裡的「模擬儲值」：按下去不會真的扣款，<br>只會把金額記在下面的儲值紀錄裡，粉鑽免費入帳。</p>
      <div class="ledger"><div class="lh"><b>儲值紀錄</b><span>共 ${S.rech.count} 筆・${ntd(S.rech.total)}</span></div>
        ${log.length ? `<ol>${log.map(r => `<li><span class="d">${dateStr(r.t)}</span><span class="n">${esc(r.name)}・${GEM()}${r.gems.toLocaleString()}</span><span class="m">${ntd(r.ntd)}</span></li>`).join('')}</ol>` : '<div class="empty">還沒有儲值紀錄</div>'}
        ${S.rech.log.length > 60 ? `<div class="empty">只顯示最近 60 筆</div>` : ''}</div>`;
  }
  function packInfo(id) {
    const p = PACKS.find(x => x.id === id);
    if (p) { const first = !S.first[p.id]; return { p, name: `粉鑽 ${p.gems.toLocaleString()}`, gems: p.gems + p.bonus + (first ? p.gems + p.bonus : 0), first, special: false }; }
    const s = SPECIALS.find(x => x.id === id);
    return { p: s, name: s.name, gems: s.gems, first: false, special: true };
  }
  function startRecharge(id) {
    const info = packInfo(id), { p } = info;
    if (p.once && S.debut) return;
    if (p.id === 'pass' && pass().premium) return;
    modal({
      title: '確認儲值',
      body: `<div class="big-num">${info.gems ? `${GEM()} ${info.gems.toLocaleString()}` : `<span style="font-size:22px">${esc(p.name)}</span>`}</div>
        <dl class="pay-box"><dt>品項</dt><dd>${info.name}</dd><dt>金額</dt><dd>${ntd(p.ntd)}</dd>${info.first ? `<dt>首儲雙倍</dt><dd>+${(p.gems + p.bonus).toLocaleString()}</dd>` : ''}${p.tickets ? `<dt>福袋券</dt><dd>×${p.tickets}</dd>` : ''}<dt>付款方式</dt><dd>模擬付款</dd></dl>
        <div class="pay-note">模擬儲值：不會真的扣款，只會記錄金額</div>`,
      actions: [{ label: '取消', cls: 'ghost' }, { label: `確認付款 ${ntd(p.ntd)}`, fn: (close, m) => processPay(info, close, m) }],
    });
  }
  function processPay(info, close, m) {
    if (m._paying) return;
    m._paying = true;
    m.innerHTML = `<h3>付款處理中</h3><div class="spinner"></div><p class="mb">正在連線 ERIKA 金庫…</p>`;
    setTimeout(() => {
      const v0 = vipLv();
      const { p } = info;
      S.gems += info.gems;
      S.rech.total += p.ntd; S.rech.count++;
      S.rech.log.unshift({ t: now(), id: p.id, name: info.name, ntd: p.ntd, gems: info.gems });
      if (S.rech.log.length > 500) S.rech.log.length = 500;
      if (!info.special) S.first[p.id] = true;
      if (p.id === 'month') { S.month = Math.max(now(), S.month) + 30 * 86400e3; S.monthLast = dayKey(); }
      if (p.id === 'debut') { S.debut = true; S.tickets += p.tickets; S.boost.double = Math.max(now(), S.boost.double) + p.double; }
      if (p.id === 'pass') { pass().premium = true; addPassXp(PASS_XP * 5); }
      event('recharge');
      const v1 = vipLv();
      save(); Cloud.soon();
      Sound.cash(); vib([15, 30, 15]);
      const [x, y] = centerOf(m);
      FX.fly('gem', x, y, 14, '#gemIc'); FX.rain('confetti', 50);
      m.innerHTML = `<h3>儲值成功！</h3><div class="big-num">${info.gems ? `${GEM()} +${info.gems.toLocaleString()}` : '尊榮通行證已啟用'}</div>
        <p class="mb">${p.id === 'month' ? '月卡生效，明天起每天登入再領 100 粉鑽<br>' : ''}${p.id === 'debut' ? '福袋券 ×10、雙倍營收 24 小時已入帳<br>' : ''}累計儲值 <b>${ntd(S.rech.total)}</b>・VIP ${v1}</p>
        ${v1 > v0 ? `<p class="mb" style="color:var(--gold-deep);font-weight:800;margin-top:6px">升級 VIP ${v1}！收益 +${v1 * 5}%</p>` : ''}
        <div class="acts"><button class="btn goldb" id="payOk">太棒了</button></div>`;
      const okAt = performance.now();
      m.querySelector('#payOk').addEventListener('click', () => { if (performance.now() - okAt < 350) return; Sound.click(); close(); });
      if (v1 > v0) Sound.level();
      if (page === 'shop') buildShop();
    }, 1100);
  }

  // ================= 每日簽到 / 離線收益 / 成就 / 稱號 =================
  let dailyOpen = false;
  function checkDaily() {
    const t = dayKey();
    if (S.daily.last === t || dailyOpen) return;
    dailyOpen = true;
    const y = dayKey(new Date(now() - 86400e3));
    const streak = S.daily.last === y ? S.daily.streak + 1 : 1;
    const idx = (streak - 1) % 7;
    const rwHtml = r => r.gems ? `${GEM()}${r.gems}${r.tickets ? ` ${Art.ticket()}` : ''}` : r.tickets ? `${Art.ticket()}×${r.tickets}` : `${COIN()}${r.mins}分`;
    const days = DAILY.map((r, i) => `<div class="day ${i < idx ? 'done' : ''} ${i === idx ? 'today' : ''} ${i === 6 ? 'd7' : ''}"><b>DAY ${i + 1}</b><span class="rw">${rwHtml(r)}</span>${i < idx ? `<span>${Art.icon('check', 'li')}</span>` : ''}</div>`).join('');
    const extra = [];
    if (S.month > now()) extra.push(['貴婦月卡', 100]);
    if (vipLv()) extra.push([`VIP ${vipLv()} 每日禮`, vipLv() * 10]);
    modal({
      queue: true, x: false, title: '每日簽到', onClose: () => { dailyOpen = false; },
      body: `<p class="mb">連續登入第 <b>${streak}</b> 天，今天的禮物是：</p><div class="days">${days}</div>${extra.length ? `<div class="extra-lines">${extra.map(([n, g]) => `<div><span>${n}</span><span>${GEM()} +${g}</span></div>`).join('')}</div>` : ''}`,
      actions: [{
        label: '領取', cls: 'goldb', fn: (close, m) => {
          if (S.daily.last === t) { close(); return; }
          S.daily = { last: t, streak };
          const r = DAILY[idx];
          let g = r.gems || 0;
          if (r.tickets) S.tickets += r.tickets;
          if (r.mins) gain(Math.max(r.mins * 100, rawIps() * baseMult() * r.mins * 60));
          for (const [, eg] of extra) g += eg;
          S.gems += g;
          if (S.month > now()) S.monthLast = t;
          save(); Cloud.soon();
          Sound.cash();
          const [x, y] = centerOf(m);
          if (g) FX.fly('gem', x, y, Math.min(16, 4 + Math.floor(g / 10)), '#gemIc');
          if (r.mins) FX.fly('coin', x, y, 12, '#coinIc');
          close();
          toast('簽到成功！明天記得再來喔', 'gold');
        },
      }],
    });
  }
  function offlineReward(ms) {
    const cap = (8 + vipLv()) * 3600e3, t = Math.min(ms, cap);
    const v = rawIps() * baseMult() * t / 1000;
    if (!(v >= 1)) return;
    modal({
      queue: true, x: false, title: `歡迎回來，${esc(S.name)}！`,
      body: `<p class="mb">妳不在的 ${fmtDur(ms)}${ms > cap ? `（最多算 ${8 + vipLv()} 小時）` : ''}，<br>百貨公司幫妳賺進了</p><div class="big-num">${COIN()} ${fmt(v)}</div>`,
      actions: [
        { label: '收下', cls: 'ghost', fn: (close, m) => { gain(v); const [x, y] = centerOf(m); FX.fly('coin', x, y, 14, '#coinIc'); Sound.cash(); close(); } },
        { label: `${GEM()}20 領三倍`, cls: 'gemb', fn: (close, m) => { if (S.gems < 20) { needGems(20); return; } S.gems -= 20; gain(v * 3); const [x, y] = centerOf(m); FX.fly('coin', x, y, 24, '#coinIc'); Sound.cash(); close(); toast(`三倍入帳 ${fmt(v * 3)} 金幣！`, 'gold'); } },
      ],
    });
  }
  function achVal(k) {
    if (k.startsWith('ev:')) return (S.ev && S.ev[k.slice(3)]) || 0;
    switch (k) {
      case 'taps': return S.st.taps; case 'life': return S.st.life; case 'floors': return S.floors.filter(l => l > 0).length;
      case 'items': return ownedCount(); case 'fevers': return S.st.fevers; case 'friends': return S.st.friends;
      case 'pulls': return S.st.pulls; case 'rech': return S.rech.count; case 'branch': return S.branch;
    }
    return 0;
  }
  const claimable = () => ACH.filter(a => !S.ach[a.id] && achVal(a.k) >= a.n);
  function openAch() {
    const render = m => {
      const list = [...ACH].sort((a, b) => (!!S.ach[a.id] - !!S.ach[b.id]) || ((achVal(b.k) >= b.n) - (achVal(a.k) >= a.n)));
      const c = claimable();
      m.querySelector('.mbody').innerHTML = `<p class="mb">完成成就就能領粉鑽，${c.length ? `現在有 <b>${c.length}</b> 個可以領！` : '繼續加油！'}</p>
        ${c.length > 1 ? `<div class="acts" style="margin-top:10px"><button class="btn goldb" data-all>全部領取</button></div>` : ''}
        <div class="ach-list">${list.map(a => {
          const v = achVal(a.k), done = !!S.ach[a.id], ok = v >= a.n;
          return `<div class="ach ${done ? 'done' : ''}"><div><b>${a.name}</b><small>${a.desc}・${GEM()}${a.gems}</small>${!done && !ok ? `<div class="pbar"><i style="width:${Math.min(100, v / a.n * 100)}%"></i></div>` : ''}</div>
            ${done ? `<span class="sub">已領取</span>` : ok ? `<button class="btn goldb" data-ach="${a.id}">領取</button>` : `<span class="sub">${a.k === 'life' ? fmt(v) : Math.floor(v).toLocaleString()}/${a.k === 'life' ? fmt(a.n) : a.n.toLocaleString()}</span>`}</div>`;
        }).join('')}</div>`;
    };
    modal({
      title: '貴婦成就',
      onOpen: m => {
        render(m);
        m.addEventListener('click', e => {
          const claim = a => { S.ach[a.id] = 1; S.gems += a.gems; return a.gems; };
          let g = 0;
          if (e.target.closest('[data-all]')) for (const a of claimable()) g += claim(a);
          const b = e.target.closest('[data-ach]');
          if (b) { const a = ACH.find(x => x.id === b.dataset.ach); if (a && !S.ach[a.id]) g += claim(a); }
          if (g) { const [x, y] = centerOf(e.target.closest('button')); FX.fly('gem', x, y, Math.min(14, 3 + Math.floor(g / 10)), '#gemIc'); Sound.cash(); toast(`領到 ${g} 粉鑽！`, 'gold'); save(); render(m); }
        });
      },
    });
  }
  function checkLevel() {
    const lv = level();
    if (lv > S.st.lvl) {
      S.st.lvl = lv;
      const ti = titleIdx();
      if (ti > S.st.title) {
        S.st.title = ti;
        Sound.level(); FX.rain('confetti', 90);
        modal({ queue: true, title: `晉升「${TITLES[ti][1]}」`, body: `<div class="profile-ava">${portraitHTML('full')}</div><p class="mb">累計營收突破 ${fmt(TITLES[ti][0])}！<br>${esc(S.name)} 現在是 Lv.${lv} 的${TITLES[ti][1]}了</p>`, actions: [{ label: '我就是這麼美', cls: 'goldb' }] });
      } else { Sound.level(); toast(`升級！Lv.${lv} ${title()}`, 'gold'); if (page === 'home') FX.rain('confetti', 30); }
    }
  }

  // ================= 分店 =================
  function openBranch() {
    if (S.st.run < BRANCH_MIN) { toast(`本店營收達 ${fmt(BRANCH_MIN)} 才能開分店`); Sound.err(); return; }
    const n = starsFor(S.st.run), nc = CITIES[Math.min(S.branch + 1, CITIES.length - 1)];
    modal({
      title: `進軍${nc.name}！`,
      body: `<p class="mb">在 <b>${nc.name}</b> 開一家 ERIKA 分店。<br>金幣、樓層、櫃姐培訓會重新開始，<br>但妳會拿到 <b>★${n} 星光</b>，永久收益 +${n * 10}%。<br>衣櫥、粉鑽、VIP、儲值紀錄全部保留。</p>`,
      actions: [{ label: '再等等', cls: 'ghost' }, { label: '開分店！', cls: 'goldb', fn: close => { close(); doBranch(n); } }],
    });
  }
  function doBranch(n) {
    S.stars += n; S.branch++;
    S.coins = 0; S.floors = FLOORS.map(() => 0); S.tapLv = 0; S.st.run = 0; S.fever = 0; S.feverUntil = 0;
    $('#stage').classList.remove('fever');
    buildHome(); go('home');
    Sound.level(); FX.rain('confetti', 100);
    toast(`${city().name}分店開幕！星光 ★${S.stars}`, 'gold');
    save(); Cloud.soon();
  }

  // ================= 貴婦檔案 / 設定 =================
  function openProfile() {
    const m = mult(), v = vipLv();
    modal({
      title: esc(S.name),
      body: `<div class="eyebrow" style="text-align:center">Lv.${level()} · ${title()}</div><div class="profile-ava">${portraitHTML('full')}</div>
        <dl class="stat-list">
          <dt>每秒收益</dt><dd class="hl">${fmt(ips())}</dd><dt>每次點擊</dt><dd>${fmt(tapValue())}</dd>
          <dt>時尚加成（${ownedCount()} 件單品）</dt><dd>+${Math.round(fashionBonus() * 100)}%</dd>
          <dt>VIP ${v} 加成</dt><dd>+${v * 5}%</dd><dt>星光 ★${S.stars} 加成</dt><dd>+${S.stars * 10}%</dd>
          <dt>總倍率</dt><dd class="hl">×${m.toFixed(2)}</dd>
          <dt>累計營收</dt><dd>${fmt(S.st.life)}</dd><dt>總點擊</dt><dd>${S.st.taps.toLocaleString()}</dd>
          <dt>分店</dt><dd>${S.branch} 家（${city().name}）</dd><dt>累計儲值</dt><dd>${ntd(S.rech.total)}</dd>
        </dl>`,
    });
  }
  let deferredInstall = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
  function openSettings() {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    modal({
      title: '設定',
      body: `<div class="set-row"><input class="name-in" id="nameIn" maxlength="10" value="${esc(S.name)}" aria-label="貴婦名字"><button class="btn" id="nameSave" style="min-width:64px">改名</button></div>
        <div class="set-row"><span>音效</span><button class="toggle ${S.set.sound ? 'on' : ''}" data-t="sound" aria-label="音效開關"></button></div>
        <div class="set-row"><span>震動<small>Android 手機才有</small></span><button class="toggle ${S.set.vib ? 'on' : ''}" data-t="vib" aria-label="震動開關"></button></div>
        <div class="set-row"><span>儲值紀錄<small>${S.rech.count} 筆・累計 ${ntd(S.rech.total)}</small></span><button class="btn ghost" id="toShop" style="min-width:64px">查看</button></div>
        ${standalone ? '' : `<div class="set-row"><span>安裝到手機桌面<small>${deferredInstall ? '一鍵安裝，之後像 App 一樣打開' : 'iPhone：Safari 分享鍵 →「加入主畫面」<br>Android：Chrome 選單 →「安裝應用程式」'}</small></span>${deferredInstall ? '<button class="btn" id="installBtn" style="min-width:64px">安裝</button>' : ''}</div>`}
        <div class="set-row"><span class="danger">重新開始遊戲<small>儲值紀錄和 VIP 會保留</small></span><button class="btn ghost" id="resetBtn" style="min-width:64px">重來</button></div>
        <p class="fine">ERIKA 百貨貴婦・所有儲值皆為模擬，不會產生任何實際扣款。</p>`,
      onOpen: (m, close) => {
        m.querySelector('#nameSave').addEventListener('click', () => {
          const v = m.querySelector('#nameIn').value.trim().slice(0, 10);
          S.name = v || 'Erika'; save(); updateHudSlow(); toast(`以後就叫妳 ${esc(S.name)} 囉！`); Sound.click();
        });
        m.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
          const k = b.dataset.t; S.set[k] = !S.set[k]; b.classList.toggle('on', S.set[k]); save();
          if (k === 'sound' && S.set.sound) { Sound.unlock(); Sound.click(); }
          if (k === 'vib') vib(20);
        }));
        m.querySelector('#toShop').addEventListener('click', () => { close(); go('shop'); });
        const ib = m.querySelector('#installBtn');
        if (ib) ib.addEventListener('click', async () => { try { deferredInstall.prompt(); await deferredInstall.userChoice; } catch (e) { /* 使用者取消 */ } deferredInstall = null; close(); });
        m.querySelector('#resetBtn').addEventListener('click', () => {
          modal({
            title: '確定要重來嗎？', body: '<p class="mb">金幣、樓層、衣櫥、粉鑽、福袋券都會清空。<br>只保留<b>儲值紀錄</b>和 <b>VIP 等級</b>。</p>',
            actions: [{ label: '不要', cls: 'ghost' }, { label: '確定重來', fn: c2 => { c2(); close(); resetGame(); } }],
          });
        });
      },
    });
  }
  function resetGame() {
    const keep = { rech: S.rech, first: S.first, debut: S.debut, month: S.month, monthLast: S.monthLast, name: S.name, set: S.set, daily: S.daily, ach: S.ach };
    S = merge(fresh(), keep);
    S.hint = true; hintTaps = 0;
    $('#stage').classList.remove('fever');
    try { K()?.reset?.(); } catch (e) { console.error(e); }
    emit('reset');
    rebuildAll(); save(); Cloud.soon();
    toast('全新的貴婦人生開始了！', 'gold');
  }
  function rebuildAll() { buildHome(); buildBoosts(); go(page); updateHudFast(); updateHudSlow(); }

  // ================= HUD =================
  function updateHudFast() {
    $('#coinTxt').textContent = fmt(S.coins);
    const t = now();
    const extra = doubleOn() ? ' <span class="boost-on">×2</span>' : '';
    const html = `每秒 <b>+${fmt(ips())}</b>${extra}・點擊 +${fmt(tapValue() * (feverOn() ? 5 : 1))}`;
    const el = $('#ipsTxt'); if (el._h !== html) { el.innerHTML = html; el._h = html; }
    $('#feverFill').style.width = S.fever + '%';
    const lbl = feverOn() ? `購物狂熱 ×5・${Math.ceil((S.feverUntil - t) / 1000)} 秒` : '購物狂熱';
    const fl = $('#feverLbl'); if (fl.textContent !== lbl) fl.textContent = lbl;
  }
  function updateHudSlow() {
    $('#meName').textContent = S.name;
    $('#meTitle').textContent = `Lv.${level()} ${title()}`;
    const v = vipLv(), vb = $('#vipBadge');
    vb.textContent = 'VIP ' + v; vb.classList.toggle('v0', v === 0);
    $('#gemTxt').textContent = S.gems.toLocaleString();
    $('#achDot').hidden = claimable().length === 0;
    $('#misDot').hidden = !(missionsClaimable() + passClaimable());
    const nf = nextFloor();
    $('.tab[data-p="floors"] .dot').hidden = !(nf >= 0 && floorOpenable(nf) && S.coins >= floorCost(nf, 0));
    try { $('.tab[data-p="kingdom"] .dot').hidden = !K()?.badge?.(); } catch (e) { /* 王國模組還沒載入 */ }
    $('.tab[data-p="wardrobe"] .dot').hidden = !ITEMS.some(i => i.cost && !S.items[i.id] && S.coins >= i.cost);
    $('.tab[data-p="play"] .dot').hidden = !(S.tickets > 0);
    if (overlayCount) updateOverlayChips();
    const canBranch = S.st.run >= BRANCH_MIN;
    $('#branchCta').hidden = !canBranch;
    if (canBranch) $('#branchStars').textContent = `★+${starsFor(S.st.run)}`;
  }

  // ================= 雲端存檔（在 claude.ai 裡開啟時才有） =================
  const Cloud = {
    db: null, uid: null, busy: false, lastPush: 0, _t: 0,
    async init() {
      if (!window.claude || typeof window.claude.use !== 'function') return;
      try {
        const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        if (!db || !user) return;
        const uid = await user.id();
        if (!uid) return;
        this.db = db; this.uid = uid;
        const snap = await this.ref().get();
        if (snap.exists) {
          const d = snap.data();
          if (d && typeof d.state === 'string' && (d.savedAt || 0) > (S.savedAt || 0) + 3000) {
            S = hydrate(JSON.parse(d.state));
            rebuildAll(); save();
            toast('已載入雲端存檔', 'gold');
          }
        }
        this.push();
      } catch (e) { this.db = null; }
    },
    ref() { return this.db.doc('data/users/' + this.uid + '/save'); },
    async push() {
      if (!this.db || this.busy) return;
      this.busy = true;
      try { S.savedAt = now(); await this.ref().set({ savedAt: S.savedAt, state: JSON.stringify(S) }); this.lastPush = now(); }
      catch (e) { if (e && ['revoked', 'not_granted', 'invalid_argument', 'capability_disabled', 'capability_removed'].includes(e.code)) this.db = null; }
      this.busy = false;
    },
    soon() { clearTimeout(this._t); this._t = setTimeout(() => this.push(), 4000); },
  };

  // ================= 主迴圈 =================
  let lastFrame = performance.now(), hudAcc = 0, slowAcc = 0, saveAcc = 0, autoAcc = 0, butlerAcc = 0, bagAcc = 0;
  function tick(dt) {
    const t = now();
    gain(ips() * dt);
    if (S.feverUntil) {
      if (t < S.feverUntil) {
        S.fever = (S.feverUntil - t) / FEVER_DUR * 100;
        bagAcc += dt;
        if (bagAcc > 0.35 && page === 'home' && modalCount === 0) { bagAcc = 0; FX.rain('bag', 2, $('#stage').getBoundingClientRect()); }
      } else { S.feverUntil = 0; S.fever = 0; $('#stage').classList.remove('fever'); }
    } else if (performance.now() - lastTapAt > 1200) S.fever = Math.max(0, S.fever - 5 * dt);
    if (S.boost.auto > t) { autoAcc += dt * 8; while (autoAcc >= 1) { autoAcc--; autoTap(); } } else autoAcc = 0;
    if (S.boost.butler > t) { butlerAcc += dt; if (butlerAcc > 0.4) { butlerAcc = 0; for (let i = 0; i < 3 && butlerStep(); i++); } }
    if (page === 'home' && !document.hidden) {
      if (!friendEl) { friendTimer -= dt; if (friendTimer <= 0 && modalCount === 0 && !overlayCount) spawnFriend(); }
      else if (t > friendUntil) { friendEl.remove(); friendEl = null; friendTimer = rnd(25, 55); }
    }
    S.lastSeen = t;
  }
  function frame(ts) {
    if (passive) return;
    const dt = Math.min(1, Math.max(0, (ts - lastFrame) / 1000));
    lastFrame = ts;
    tick(dt);
    FX.step(dt); FX.draw();
    hudAcc += dt; slowAcc += dt; saveAcc += dt;
    if (hudAcc > 0.1) { hudAcc = 0; updateHudFast(); }
    if (slowAcc > 0.3) {
      slowAcc = 0;
      updateHudSlow(); updateBoosts(); checkLevel();
      if (page === 'floors') updateFloors();
      if (page === 'wardrobe') updateWardrobe();
      if (page === 'gacha') updateGacha();
      try { K()?.tick?.(0.3, page === 'kingdom'); } catch (e) { console.error(e); }
    }
    if (saveAcc > 5) { saveAcc = 0; save(); if (now() - Cloud.lastPush > 90e3) Cloud.push(); }
    requestAnimationFrame(frame);
  }

  // ================= 事件綁定 =================
  function bind() {
    $('#tabbar').innerHTML = PAGES.map(([id, name, ic]) => `<button class="tab ${id === page ? 'on' : ''}" data-p="${id}">${Art.icon(ic)}${name}<span class="dot" hidden></span></button>`).join('');
    $('#tabbar').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) { Sound.click(); go(b.dataset.p); } });
    $('#gemIc').innerHTML = Art.gem(); $('#coinIc').innerHTML = Art.coin();
    $('#achIc').innerHTML = Art.icon('trophy', 'li'); $('#setIc').innerHTML = Art.icon('gear', 'li');
    $('#btnGems').addEventListener('click', () => { Sound.click(); go('shop'); });
    $('#btnProfile').addEventListener('click', () => { Sound.click(); openProfile(); });
    $('#btnAch').addEventListener('click', () => { Sound.click(); openAch(); });
    $('#misIc').innerHTML = Art.icon('scroll', 'li');
    $('#btnMis').addEventListener('click', () => { Sound.click(); openMissions(); });
    $('#btnSet').addEventListener('click', () => { Sound.click(); openSettings(); });
    $('#branchCta').addEventListener('pointerdown', e => e.stopPropagation());
    $('#branchCta').addEventListener('click', openBranch);
    $('#stage').addEventListener('pointerdown', e => {
      if (e.target.closest('.friend, .branch-cta') || e.button > 0) return;
      e.preventDefault();
      doTap(e.clientX, e.clientY, true);
    });
    $('#stage').addEventListener('contextmenu', e => e.preventDefault());
    $('#boosts').addEventListener('click', e => { const el = e.target.closest('.boost'); if (!el) return; const b = BOOSTS.find(x => x.id === el.dataset.b); twoTap(el, () => buyBoost(b, el), updateBoosts); });
    $('#pg-floors').addEventListener('click', e => {
      const q = e.target.closest('[data-q]'); if (q) { S.qty = q.dataset.q === 'max' ? 'max' : +q.dataset.q; Sound.click(); buildFloors(); return; }
      const b = e.target.closest('[data-buy]'); if (b) { buyFloor(+b.dataset.buy, b); return; }
      const tu = e.target.closest('[data-tapup]'); if (tu) { buyTap(tu); return; }
      if (e.target.closest('[data-branch]')) openBranch();
    });
    $('#pg-wardrobe').addEventListener('click', e => {
      const c = e.target.closest('[data-c]'); if (c) { wdCat = c.dataset.c; Sound.click(); $$('#cats button').forEach(x => x.classList.toggle('on', x === c)); buildGrid(); return; }
      const it = e.target.closest('[data-i]'); if (it) tapItem(ITEM[it.dataset.i], it);
    });
    $('#pg-gacha').addEventListener('click', e => { if (e.target.closest('[data-back]')) { Sound.click(); go('play'); return; } const b = e.target.closest('[data-pull]'); if (b) pull(+b.dataset.pull); });
    $('#pg-play').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; const g = GAMES.find(x => x.id === b.dataset.g); if (g) openGame(g); });
    $('#pg-shop').addEventListener('click', e => { const b = e.target.closest('[data-pack], [data-sp]'); if (b && !b.classList.contains('off')) { Sound.click(); startRecharge(b.dataset.pack || b.dataset.sp); } });
    document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
    document.addEventListener('visibilitychange', () => {
      if (passive) return;
      if (document.hidden) { save(); Cloud.push(); return; }
      const gap = now() - S.lastSeen;
      lastFrame = performance.now();
      if (gap > 60e3) offlineReward(gap);
      else if (gap > 1000) gain(rawIps() * baseMult() * gap / 1000);
      S.lastSeen = now();
      checkDaily();
    });
    addEventListener('pagehide', () => { save(); Cloud.push(); });
  }

  // ================= 娛樂城：小遊戲共用介面（window.ErikaAPI） =================
  const CAST_DEF = [
    { id: 'erika', model: 'victoria', name: '', title: '百貨老闆娘', color: '#f08bb0' },
    { id: 'vivi', model: 'vivi', name: '薇薇', title: '甜點世家千金', color: '#8cc46a' },
    { id: 'vita', model: 'vita', name: '維塔', title: '科技新貴偶像', color: '#3fb6e0' },
    { id: 'chiyo', model: 'shibu', name: '千代', title: '財閥大小姐', color: '#e8613c' },
    { id: 'shino', model: 'shino', name: '詩乃', title: '書香名門千金', color: '#5a6fd6' },
    { id: 'fumi', model: 'fumiriya', name: '史利', title: '貼身管家', color: '#c9a35b' },
  ];
  const castOf = d => ({
    id: d.id, name: d.id === 'erika' ? S.name : d.name, title: d.title, color: d.color,
    face: (expr = 'neutral') => `assets/cast/${d.model}-${expr}.webp`, full: `assets/cast/${d.model}-full.webp`,
  });
  let overlayCount = 0;
  const coinTarget = () => (overlayCount ? '.g-overlay:last-of-type .g-coins' : '#coinIc');
  const gemTarget = () => (overlayCount ? '.g-overlay:last-of-type .g-gems' : '#gemIc');
  function updateOverlayChips() {
    $$('.g-coins').forEach(e => { e.textContent = fmt(S.coins); });
    $$('.g-gems').forEach(e => { e.textContent = S.gems.toLocaleString(); });
  }
  function overlay(o = {}) {
    const el = document.createElement('section');
    el.className = 'g-overlay g-' + (o.id || 'x');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', o.title || '');
    el.innerHTML = `<header class="g-head"><button class="g-back" aria-label="返回">${Art.icon('back')}</button><b class="g-title"></b><span class="g-res"><span class="g-chip">${COIN()}<b class="g-coins num"></b></span><span class="g-chip">${GEM()}<b class="g-gems num"></b></span></span></header><div class="g-body"></div>`;
    el.querySelector('.g-title').textContent = o.title || '';
    $('#app').appendChild(el);
    overlayCount++;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true; overlayCount--;
      el.classList.add('closing');
      setTimeout(() => el.remove(), 220);
      try { if (o.onClose) o.onClose(); } catch (e) { console.error(e); }
      save(); updateHudSlow();
    };
    el.querySelector('.g-back').addEventListener('click', () => { Sound.click(); if (o.beforeClose && o.beforeClose() === false) return; close(); });
    updateOverlayChips();
    return { root: el, body: el.querySelector('.g-body'), close, setTitle: t => { el.querySelector('.g-title').textContent = t; } };
  }
  const BUS = {};
  const emit = (ev, ...a) => { for (const fn of BUS[ev] || []) { try { fn(...a); } catch (e) { console.error(e); } } };
  const GAMES = (window.ErikaGames = window.ErikaGames || []);
  GAMES.push({ id: 'gacha', order: 90, name: '精品福袋', tagline: '抽 SSR 限定單品', color: '#f08bb0', color2: '#c9a35b', badge: '限定',
    art: () => `<span style="position:absolute;inset:8% 6% 22%;display:grid;place-items:center">${Art.giftBox()}</span>`, open: () => go('gacha') });
  const flyN = n => Math.min(18, 4 + Math.floor(Math.log10(n + 1)));
  const API = (window.ErikaAPI = {
    version: 1,
    get coins() { return S.coins; },
    get gems() { return S.gems; },
    get tickets() { return S.tickets; },
    get playerName() { return S.name; },
    get sandbox() { return SANDBOX; },
    get vip() { return vipLv(); },
    get monthCard() { return S.month > now(); },
    incomePerSec: () => Math.max(1, rawIps() * baseMult()),
    betUnit: () => Math.max(100, Math.round(Math.max(1, rawIps() * baseMult()) * 60)),
    spendCoins(n, el) {
      n = Math.ceil(n);
      if (!(n >= 0)) return false;
      if (S.coins < n) { if (el) shake(el); Sound.err(); toast(`金幣不足，還差 ${fmt(n - S.coins)}`); return false; }
      S.coins -= n; updateOverlayChips(); return true;
    },
    spendGems(n) { const ok = spendGems(n); updateOverlayChips(); return ok; },
    addCoins(n, x, y) { if (!(n > 0)) return; gain(n); if (x != null) FX.fly('coin', x, y, flyN(n), coinTarget()); updateOverlayChips(); },
    payout(n, x, y) { if (!(n > 0)) return; S.coins += n; if (x != null) FX.fly('coin', x, y, flyN(n), coinTarget()); updateOverlayChips(); },
    addGems(n, x, y) { if (!(n > 0)) return; S.gems += Math.floor(n); if (x != null) FX.fly('gem', x, y, Math.min(14, 3 + Math.floor(n / 10)), gemTarget()); updateOverlayChips(); },
    addTickets(n) { if (n > 0) S.tickets += Math.floor(n); },
    fmt, esc, toast, shake, twoTap, modal,
    sound: Sound, vib,
    fx: { burst: (x, y, n, k) => FX.burst(x, y, n, k), rain: (k, n, r) => FX.rain(k, n, r), text: (x, y, t, size, crit) => FX.text(x, y, t, size, crit) },
    icons: { gem: () => Art.gem(), coin: () => Art.coin(), ticket: () => Art.ticket(), line: (k, c) => Art.icon(k, c) },
    cast: () => CAST_DEF.map(castOf),
    player: () => castOf(CAST_DEF[0]),
    store(id) { S.mini = S.mini || {}; return (S.mini[id] = S.mini[id] || {}); },
    stat(k, n = 1) { S.st.mini = S.st.mini || {}; S.st.mini[k] = (S.st.mini[k] || 0) + n; },
    save: () => save(),
    overlay,
    go: p => go(p),
    on(ev, fn) { (BUS[ev] = BUS[ev] || []).push(fn); },
    off(ev, fn) { if (BUS[ev]) BUS[ev] = BUS[ev].filter(f => f !== fn); },
    get page() { return page; },
  });
  function openGame(g) {
    try { Sound.click(); g.open(API); }
    catch (e) { console.error(e); toast('這個遊戲暫時打不開，請稍後再試'); }
  }
  function buildPlay() {
    const list = [...GAMES].sort((a, b) => (a.order || 99) - (b.order || 99));
    $('#pg-play .pane').innerHTML = `<div class="sec-h"><div><div class="eyebrow">Salon de Jeux</div><h2>名媛娛樂城</h2></div><div class="sub">全部用遊戲金幣，不會花到真錢</div></div>
      <div class="play-grid">${list.map(g => `<button class="play-card" data-g="${esc(g.id)}" style="--c1:${g.color || '#e0628a'};--c2:${g.color2 || '#7d4bc4'}">
        <span class="pc-art">${typeof g.art === 'function' ? g.art(API) : ''}</span>
        <span class="pc-txt"><b>${esc(g.name)}</b><small>${esc(g.tagline || '')}</small></span>${g.badge ? `<i class="pc-badge">${esc(g.badge)}</i>` : ''}</button>`).join('')}</div>`;
  }

  // ================= 連動系統：共用英雄、統一發獎、戰績、每日任務、貴婦通行證 =================
  const RES = { silk: { name: '絲綢', color: '#f2a3bd' }, spice: { name: '香料', color: '#e38a60' }, ore: { name: '寶石原石', color: '#7aa6d6' }, leaf: { name: '金箔', color: '#d9b062' } };
  const HERO_MAX = 60, STAR_NEED = [0, 10, 20, 40, 80, 150]; // 升到下一星需要的碎片
  const castById = id => CAST_DEF.find(c => c.id === id);
  function heroState(id) { S.heroes = S.heroes || {}; return (S.heroes[id] = S.heroes[id] || { lv: 1, star: id === 'erika' ? 2 : 1, shards: 0 }); }
  const heroLvCost = lv => Math.round(300 * Math.pow(1.42, lv - 1));
  const heroPower = h => Math.round((20 + h.lv * 6) * (1 + 0.3 * (h.star - 1)));
  function heroesList() {
    return CAST_DEF.map(d => { const h = heroState(d.id); return { ...castOf(d), lv: h.lv, star: h.star, shards: h.shards, power: heroPower(h), lvCost: h.lv >= HERO_MAX ? null : heroLvCost(h.lv), starNeed: h.star >= 6 ? null : STAR_NEED[h.star] }; });
  }
  function heroLevelUp(id, el) {
    const h = heroState(id);
    if (h.lv >= HERO_MAX) { toast('已經是最高等級了'); return false; }
    if (!API.spendCoins(heroLvCost(h.lv), el)) return false;
    h.lv++; Sound.buy(); event('hero_up', { id }); save(); emit('heroes'); return true;
  }
  function heroStarUp(id, el) {
    const h = heroState(id), need = STAR_NEED[h.star];
    if (!need) { toast('已經是滿星了'); return false; }
    if (h.shards < need) { if (el) shake(el); Sound.err(); toast(`還差 ${need - h.shards} 個碎片`); return false; }
    h.shards -= need; h.star++; Sound.level(); event('hero_star', { id }); save(); emit('heroes'); return true;
  }
  const kdCall = (fn, ...a) => { try { return K()?.[fn]?.(...a); } catch (e) { console.error(e); return undefined; } };

  // 統一發獎：{ coins, gems, tickets, res:{silk,spice,ore,leaf}, shards:{vivi:2}, speedup: 分鐘, passXp }
  function grant(r = {}, x, y, quiet) {
    const parts = [];
    if (r.coins > 0) { API.addCoins(r.coins, x, y); parts.push(`${COIN()}${fmt(r.coins)}`); }
    if (r.gems > 0) { API.addGems(r.gems, x, y); parts.push(`${GEM()}${Math.floor(r.gems)}`); }
    if (r.tickets > 0) { API.addTickets(r.tickets); parts.push(`${Art.ticket()}×${Math.floor(r.tickets)}`); }
    if (r.shards) for (const [id, n] of Object.entries(r.shards)) if (n > 0 && castById(id)) { heroState(id).shards += Math.floor(n); parts.push(`${id === 'erika' ? S.name : castById(id).name}碎片×${Math.floor(n)}`); }
    const res = {};
    if (r.res) for (const [k, v] of Object.entries(r.res)) if (RES[k] && v > 0) { res[k] = Math.floor(v); parts.push(`${RES[k].name}+${fmt(v)}`); }
    if (Object.keys(res).length || r.speedup > 0) kdCall('grant', { res, speedup: r.speedup || 0 });
    if (r.speedup > 0) parts.push(`加速 ${r.speedup} 分鐘`);
    if (r.passXp > 0) { addPassXp(r.passXp); parts.push(`通行證 +${r.passXp}`); }
    save(); updateOverlayChips(); emit('heroes');
    const html = parts.join('　');
    if (!quiet && html) toast(html, 'gold');
    return html;
  }

  // ---- 戰績事件 → 每日任務、通行證、成就 ----
  const EV_XP = { m3_clear: 30, arena_play: 25, royale_match: 30, card_round: 10, mahjong_hand: 20, kd_build: 15, kd_march: 15, kd_research: 15, gacha: 10, item_buy: 10, friend: 10 };
  function event(name, data = {}) {
    const n = Math.max(1, Math.floor(data.n || 1));
    S.ev = S.ev || {};
    S.ev[name] = (S.ev[name] || 0) + n;
    if (EV_XP[name]) addPassXp(EV_XP[name] * (name === 'card_round' ? 1 : 1));
    const ms = dailyMissions();
    for (const m of ms) if (m.ev === name && !S.daily2.done[m.id]) { S.daily2.prog[m.id] = Math.min(m.n, (S.daily2.prog[m.id] || 0) + n); }
    emit('event', name, data);
  }
  const MISSION_POOL = [
    { id: 'tap', ev: 'tap', n: 300, name: '在百貨點擊 300 次', go: 'home' },
    { id: 'floor', ev: 'floor_up', n: 10, name: '升級樓層 10 次', go: 'floors' },
    { id: 'friend', ev: 'friend', n: 2, name: '接待 2 位貴婦閨蜜', go: 'home' },
    { id: 'item', ev: 'item_buy', n: 1, name: '買一件時尚單品', go: 'wardrobe' },
    { id: 'gacha', ev: 'gacha', n: 1, name: '開 1 次精品福袋', go: 'gacha' },
    { id: 'kdc', ev: 'kd_collect', n: 3, name: '在王國收成 3 次', go: 'kingdom' },
    { id: 'kdb', ev: 'kd_build', n: 1, name: '王國建造或升級 1 次', go: 'kingdom' },
    { id: 'kdm', ev: 'kd_march', n: 2, name: '派隊伍出征 2 次', go: 'kingdom' },
    { id: 'm3', ev: 'm3_clear', n: 2, name: '時尚消消樂過 2 關', game: 'match3' },
    { id: 'arena', ev: 'arena_play', n: 2, name: '名媛對決打 2 場', game: 'arena' },
    { id: 'royale', ev: 'royale_match', n: 1, name: '參加 1 場名媛吃雞', game: 'royale' },
    { id: 'kill', ev: 'royale_kill', n: 5, name: '吃雞淘汰 5 名對手', game: 'royale' },
    { id: 'card', ev: 'card_round', n: 5, name: '牌桌玩 5 局（妞妞或十三支）', game: 'niuniu' },
    { id: 'mj', ev: 'mahjong_hand', n: 2, name: '貴婦麻將打 2 局', game: 'mahjong' },
    { id: 'hero', ev: 'hero_up', n: 2, name: '英雄升級 2 次', go: 'kingdom' },
  ];
  function seeded(seed) { let x = 0; for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function dailyMissions() {
    const today = dayKey();
    if (!S.daily2 || S.daily2.day !== today) {
      const r = seeded(today + S.name);
      const pool = [...MISSION_POOL].sort(() => r() - 0.5);
      const pick = ['tap'].concat(pool.filter(m => m.id !== 'tap').slice(0, 5).map(m => m.id));
      S.daily2 = { day: today, ids: pick, prog: {}, done: {}, chest: false };
    }
    return S.daily2.ids.map(id => MISSION_POOL.find(m => m.id === id)).filter(Boolean);
  }
  const missionReward = () => ({ coins: Math.max(500, rawIps() * baseMult() * 300), passXp: 100 });
  const missionsClaimable = () => dailyMissions().filter(m => !S.daily2.done[m.id] && (S.daily2.prog[m.id] || 0) >= m.n).length + (dailyMissions().every(m => S.daily2.done[m.id]) && !S.daily2.chest ? 1 : 0);

  // ---- 貴婦通行證（30 天一季，40 階） ----
  const PASS_TIERS = 40, PASS_XP = 500, PASS_DAYS = 30;
  function pass() {
    const t = now();
    if (!S.pass || t > S.pass.start + PASS_DAYS * 86400e3) S.pass = { season: (S.pass?.season || 0) + 1, start: t, xp: 0, free: {}, prem: {}, premium: false };
    return S.pass;
  }
  function addPassXp(n) { const p = pass(); p.xp = Math.min(PASS_TIERS * PASS_XP, p.xp + n); }
  const passTier = () => Math.floor(pass().xp / PASS_XP);
  const SSR_POOL = () => ITEMS.filter(i => i.gacha === 'SSR');
  function passReward(tier, prem) {
    const heroIds = CAST_DEF.map(c => c.id);
    const hero = heroIds[tier % heroIds.length];
    const ru = Math.max(100, kdCall('resUnit') || 100);
    if (!prem) {
      switch (tier % 5) {
        case 0: return { tickets: 1, gems: 10 };
        case 1: return { coins: 'mins:' + (10 + tier) };
        case 2: return { res: { silk: ru * 2, spice: ru * 2 } };
        case 3: return { shards: { [hero]: 2 } };
        default: return { gems: 8, res: { ore: ru, leaf: ru } };
      }
    }
    if (tier === 20 || tier === 40) return { ssr: true };
    switch (tier % 4) {
      case 0: return { gems: 60, tickets: 2 };
      case 1: return { shards: { [hero]: 6 }, speedup: 60 };
      case 2: return { coins: 'mins:' + (30 + tier * 2), res: { silk: ru * 5, spice: ru * 5, ore: ru * 3, leaf: ru * 3 } };
      default: return { gems: 30, shards: { erika: 3 } };
    }
  }
  function rewardText(r) {
    if (r.ssr) return 'SSR 單品';
    const p = [];
    if (r.coins) p.push(`${COIN()}${r.coins.split(':')[1]}分`);
    if (r.gems) p.push(`${GEM()}${r.gems}`);
    if (r.tickets) p.push(`${Art.ticket()}×${r.tickets}`);
    if (r.res) p.push(Object.keys(r.res).map(k => RES[k].name).join('、'));
    if (r.shards) p.push(Object.entries(r.shards).map(([id, n]) => `${id === 'erika' ? 'Erika' : castById(id).name}碎片×${n}`).join(''));
    if (r.speedup) p.push(`加速${r.speedup}分`);
    return p.join(' ');
  }
  function claimPassReward(r, x, y) {
    if (r.ssr) {
      const left = SSR_POOL().filter(i => !S.items[i.id]);
      if (left.length) { const it = pick(left); S.items[it.id] = 1; toast(`通行證大獎：SSR「${it.name}」！`, 'gold'); Sound.ssr(); FX.rain('confetti', 80); renderAvatar(); return; }
      return grant({ gems: 300 }, x, y);
    }
    const g = { ...r };
    if (typeof g.coins === 'string') g.coins = Math.max(1000, rawIps() * baseMult() * 60 * +g.coins.split(':')[1]);
    return grant(g, x, y);
  }
  const passClaimable = () => { const p = pass(), t = passTier(); let c = 0; for (let i = 1; i <= t; i++) { if (!p.free[i]) c++; if (p.premium && !p.prem[i]) c++; } return c; };

  // ---- 任務與通行證畫面 ----
  const MODE_ICON = { home: 'home', floors: 'floors', wardrobe: 'wardrobe', gacha: 'gift', kingdom: 'castle', match3: 'play', arena: 'star', royale: 'star', niuniu: 'play', mahjong: 'play' };
  function openMissions(tab = 'daily') {
    const o = overlay({ id: 'missions', title: '任務與通行證' });
    let cur = tab;
    const render = () => {
      const ms = dailyMissions(), d = S.daily2, p = pass(), tier = passTier();
      const doneN = ms.filter(m => d.done[m.id]).length;
      const daysLeft = Math.max(0, Math.ceil((p.start + PASS_DAYS * 86400e3 - now()) / 86400e3));
      let h = `<div class="ms-tabs"><button class="${cur === 'daily' ? 'on' : ''}" data-tab="daily">每日任務${missionsClaimable() ? '<i class="dot"></i>' : ''}</button><button class="${cur === 'pass' ? 'on' : ''}" data-tab="pass">貴婦通行證${passClaimable() ? '<i class="dot"></i>' : ''}</button></div><div class="ms-scroll">`;
      if (cur === 'daily') {
        h += `<div class="ms-hero"><div><div class="eyebrow">Daily Missions</div><b>今日任務 ${doneN} / ${ms.length}</b><small>全部完成可開啟「貴婦寶箱」</small></div>
          <button class="ms-chest ${doneN === ms.length && !d.chest ? 'ready' : ''} ${d.chest ? 'opened' : ''}" data-chest>${Art.giftBox()}</button></div>`;
        h += ms.map(m => {
          const v = d.prog[m.id] || 0, ok = v >= m.n, done = d.done[m.id];
          return `<div class="ms-row ${done ? 'done' : ''}"><span class="ms-ic">${Art.icon(MODE_ICON[m.game || m.go] || 'star')}</span>
            <div class="ms-main"><b>${m.name}</b><div class="ms-bar"><i style="width:${Math.min(100, v / m.n * 100)}%"></i></div><small>${Math.min(v, m.n).toLocaleString()} / ${m.n.toLocaleString()}・通行證 +100・${COIN()}5分鐘收益</small></div>
            ${done ? '<span class="sub">已領取</span>' : ok ? `<button class="btn goldb" data-claim="${m.id}">領取</button>` : `<button class="btn ghost" data-go="${m.id}">前往</button>`}</div>`;
        }).join('');
      } else {
        h += `<div class="ps-hero"><div class="eyebrow" style="color:#ecd08a">Season ${p.season}</div><b>第 ${p.season} 季・名媛之夜</b><small>剩 ${daysLeft} 天・目前第 ${tier} 階</small>
          <div class="ps-bar"><i style="width:${tier >= PASS_TIERS ? 100 : (p.xp % PASS_XP) / PASS_XP * 100}%"></i></div><small>${tier >= PASS_TIERS ? '已滿階！' : `下一階還要 ${PASS_XP - p.xp % PASS_XP} 點`}</small>
          ${p.premium ? '<span class="ps-badge">尊榮通行證已啟用</span>' : `<button class="btn goldb" data-buypass>解鎖尊榮通行證</button>`}
          ${passClaimable() > 1 ? '<button class="btn" data-claimall>一鍵領取</button>' : ''}</div>
          <div class="ps-head"><span>階</span><span>免費獎勵</span><span>尊榮獎勵</span></div>`;
        for (let i = 1; i <= PASS_TIERS; i++) {
          const fr = passReward(i, false), pr = passReward(i, true), reached = i <= tier;
          const cell = (r, kind, claimed, locked) => `<div class="ps-cell ${kind} ${claimed ? 'claimed' : ''} ${locked ? 'locked' : ''} ${r.ssr ? 'ssr' : ''}"><span class="ps-rw">${rewardText(r)}</span>${claimed ? `<em>${Art.icon('check')}</em>` : reached && !locked ? `<button class="btn ${kind === 'prem' ? 'goldb' : ''}" data-ps="${kind}:${i}">領</button>` : ''}${locked ? `<em class="lk">${Art.icon('lock')}</em>` : ''}</div>`;
          h += `<div class="ps-row ${reached ? 'reached' : ''}"><span class="ps-n">${i}</span>${cell(fr, 'free', p.free[i])}${cell(pr, 'prem', p.prem[i], !p.premium)}</div>`;
        }
      }
      o.body.innerHTML = h + '</div>';
    };
    o.body.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const [x, y] = centerOf(b);
      if (b.dataset.tab) { cur = b.dataset.tab; Sound.click(); render(); return; }
      if (b.dataset.claim) { const d = S.daily2; d.done[b.dataset.claim] = 1; event('mission'); grant(missionReward(), x, y); Sound.cash(); render(); updateHudSlow(); return; }
      if (b.dataset.go) { const m = MISSION_POOL.find(q => q.id === b.dataset.go); o.close(); if (m.game) { const g = GAMES.find(q => q.id === m.game); if (g) setTimeout(() => openGame(g), 250); } else go(m.go); return; }
      if (b.dataset.chest !== undefined) {
        const ms = dailyMissions();
        if (S.daily2.chest || !ms.every(m => S.daily2.done[m.id])) { Sound.err(); toast('完成今天全部任務就能打開'); return; }
        S.daily2.chest = true; grant({ gems: 20, tickets: 1, passXp: 200, shards: { [pick(CAST_DEF).id]: 3 } }, x, y); Sound.ssr(); FX.burst(x, y, 40); render(); updateHudSlow(); return;
      }
      if (b.dataset.ps) { const [kind, i] = b.dataset.ps.split(':'); const p = pass(); (kind === 'free' ? p.free : p.prem)[i] = 1; claimPassReward(passReward(+i, kind === 'prem'), x, y); Sound.cash(); render(); updateHudSlow(); return; }
      if (b.dataset.claimall !== undefined) { const p = pass(), t = passTier(); for (let i = 1; i <= t; i++) { if (!p.free[i]) { p.free[i] = 1; claimPassReward(passReward(i, false)); } if (p.premium && !p.prem[i]) { p.prem[i] = 1; claimPassReward(passReward(i, true)); } } Sound.cash(); FX.burst(x, y, 40); render(); updateHudSlow(); return; }
      if (b.dataset.buypass !== undefined) { o.close(); go('shop'); setTimeout(() => startRecharge('pass'), 300); }
    });
    render();
    return o;
  }

  Object.assign(API, {
    grant: (r, x, y, quiet) => grant(r, x, y, quiet),
    event: (name, data) => event(name, data),
    heroes: () => heroesList(),
    heroLevelUp: (id, el) => heroLevelUp(id, el),
    heroStarUp: (id, el) => heroStarUp(id, el),
    fashion: () => ({ power: fashionBonus(), owned: ownedCount(), eq: { ...S.eq } }),
    perk: name => { const v = kdCall('perk', name); return typeof v === 'number' && isFinite(v) ? v : 0; },
    resUnit: () => { const v = kdCall('resUnit'); return v > 0 ? v : 100; },
    RES,
    openMissions: tab => openMissions(tab),
    openGame: id => { const g = GAMES.find(x => x.id === id); if (!g) return false; go('play'); setTimeout(() => openGame(g), 120); return true; },
  });

  // ================= 啟動 =================
  // 開場載入畫面：等 3D 人物載好（或最多 9 秒）再淡出
  const Splash = (() => {
    const el = $('#splash');
    if (!el) return { done() {} };
    const tips = ['正在為 Erika 化妝…', '香檳冰鎮中…', '紅毯鋪好了…', '櫥窗燈光調整中…', '把粉鑽擦亮一點…'];
    let i = 0, prog = 0.05, closed = false;
    const bar = $('#spBar'), tip = $('#spTip');
    const tt = setInterval(() => { i = (i + 1) % tips.length; tip.textContent = tips[i]; }, 1400);
    const set = v => { prog = Math.max(prog, v); bar.style.width = Math.round(prog * 100) + '%'; };
    set(0.08);
    const fake = setInterval(() => set(Math.min(0.9, prog + 0.015)), 120);
    addEventListener('erika3d-progress', e => set(0.1 + e.detail * 0.85));
    const done = () => {
      if (closed) return;
      closed = true; set(1); clearInterval(tt); clearInterval(fake);
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 700); }, 250);
    };
    addEventListener('erika3d-ready', done);
    addEventListener('erika3d-failed', done);
    setTimeout(done, 9000);
    return { done };
  })();
  if (SANDBOX) Splash.done();

  function guardTabs() {
    if (SANDBOX || typeof BroadcastChannel !== 'function') return;
    const id = Math.random().toString(36).slice(2);
    let bc;
    try { bc = new BroadcastChannel('erika-tabs'); } catch (e) { return; }
    bc.onmessage = e => {
      if (!e.data || e.data.type !== 'hello' || e.data.id === id || passive) return;
      passive = true;
      const el = document.createElement('div');
      el.id = 'tabGuard';
      el.innerHTML = `<div class="tg-box"><div class="tg-crown">♛</div><b>ERIKA 百貨已在另一個視窗開啟</b><p>為了保護妳的進度，這個視窗先暫停，不會存檔。</p><button class="btn goldb" id="tgResume">在這裡繼續玩</button></div>`;
      document.body.appendChild(el);
      el.querySelector('#tgResume').addEventListener('click', () => location.reload());
    };
    bc.postMessage({ type: 'hello', id });
  }

  let started = false;
  function start(hot) {
    if (started) return;
    started = true;
    Art.inject();
    const local = SANDBOX ? null : loadLocal();
    const src = SANDBOX ? null : hot && hot.v === 1 && (!local || (hot.lastSeen || 0) >= (local.lastSeen || 0)) ? hot : local;
    S = hydrate(SANDBOX ? { coins: 5e9, gems: 99999, tickets: 30, hint: false, daily: { last: dayKey(), streak: 1 }, floors: [60, 50, 40, 30, 20, 10, 5, 0, 0, 0, 0, 0], st: { life: 1e10 }, rech: { total: 3000, count: 5, log: [] } } : src);
    if (SANDBOX) { S.st.lvl = level(); S.st.title = titleIdx(); }
    guardTabs();
    bind();
    buildHome(); buildBoosts(); go('home');
    updateHudFast(); updateHudSlow();
    if (SANDBOX) {
      const g = (location.search.match(/[?&]game=([\w-]+)/) || [])[1];
      if (g) setTimeout(() => { go('play'); const gm = GAMES.find(x => x.id === g); if (gm) openGame(gm); }, 300);
    } else if (!src) {
      modal({
        queue: true, x: false, title: '歡迎光臨 ERIKA 百貨',
        body: `<div class="profile-ava">${portraitHTML('full')}</div><p class="mb">妳是 ERIKA 百貨的新任老闆娘。<br>只要<b>一直點畫面</b>就會有客人上門消費，<br>賺到的錢拿去開新樓層、買美美的衣服！</p>
          <div class="set-row" style="border:0;padding-bottom:0"><input class="name-in" id="firstName" maxlength="10" value="Erika" aria-label="妳的名字"></div>`,
        actions: [{ label: '開始營業', cls: 'goldb', fn: (close, m) => { const v = m.querySelector('#firstName').value.trim().slice(0, 10); S.name = v || 'Erika'; save(); updateHudSlow(); close(); } }],
      });
    } else {
      const gap = now() - (S.lastSeen || now());
      if (gap > 60e3) offlineReward(gap);
    }
    if (!SANDBOX) checkDaily();
    S.lastSeen = now();
    lastFrame = performance.now();
    requestAnimationFrame(frame);
    if (!SANDBOX) Cloud.init();
    if (/[?&]debug/.test(location.search)) window.ERIKA_DEBUG = { get S() { return S; }, rebuild: rebuildAll, fmt, advance(sec) { for (let i = 0; i < sec * 10; i++) { tick(0.1); FX.step(0.1); } updateHudFast(); updateHudSlow(); updateBoosts(); checkLevel(); } };
    if ('serviceWorker' in navigator && !window.claude && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const hot = window.claude && window.claude.hot;
  try { if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => JSON.parse(JSON.stringify(S))); } catch (e) { /* 不在 claude.ai 裡 */ }
  if (hot && typeof hot.ready === 'function') { try { hot.ready(d => start(d)); } catch (e) { start(null); } setTimeout(() => start(null), 1500); }
  else start(hot && hot.data);
})();
