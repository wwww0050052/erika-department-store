// 名媛之塔：美術（轉珠、屬性圖示、怪物 SVG）
'use strict';

// 珠子圖案（100×100 座標）：f = 填滿、s = 描邊；a = 用強調色
DT.GLYPH = {
  bag: [
    { s: 'M33 40 C33 14 67 14 67 40', w: 7 },
    { f: 'M16 40 H84 L90 82 Q90 89 83 89 H17 Q10 89 10 82 Z' },
    { f: 'M16 40 H84 L80 56 Q50 64 20 56 Z', a: 1 },
    { f: 'M44 52 H56 V64 H44 Z' },
  ],
  heel: [
    { f: 'M6 70 Q9 61 22 61 Q40 61 56 45 Q66 34 76 30 Q88 27 90 39 L88 48 Q86 53 83 57 L85 90 L78 90 L73 62 Q60 72 44 78 Q30 84 14 84 Q4 84 6 70 Z' },
    { f: 'M38 62 Q55 53 67 41 Q74 36 81 38 Q71 49 59 58 Z', a: 1 },
    { s: 'M14 84 Q30 84 44 78 Q60 72 73 62', w: 4, a: 1 },
  ],
  dessert: [
    { f: 'M22 56 H78 L69 90 H31 Z' },
    { s: 'M38 58 L41 89 M50 58 V89 M62 58 L59 89', w: 3, a: 1 },
    { f: 'M14 58 Q10 44 25 42 Q24 26 41 26 Q50 12 61 25 Q78 24 75 41 Q90 43 86 58 Z' },
    { f: 'M52 22 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0', a: 1 },
  ],
  jewel: [
    { f: 'M27 16 H73 L92 40 L50 92 L8 40 Z' },
    { s: 'M8 40 H92 M27 16 L39 40 L50 92 M73 16 L61 40 L50 92 M39 40 L50 16 L61 40', w: 3, a: 1 },
  ],
  card: [
    { f: 'M10 24 H90 Q96 24 96 30 V72 Q96 78 90 78 H10 Q4 78 4 72 V30 Q4 24 10 24 Z' },
    { f: 'M15 36 H33 V50 H15 Z', a: 1 },
    { s: 'M15 64 H40 M47 64 H60 M67 64 H80', w: 4, a: 1 },
  ],
  heart: [
    { f: 'M50 88 C20 66 7 50 7 33 C7 18 19 9 31 9 C40 9 46 14 50 21 C54 14 60 9 69 9 C81 9 93 18 93 33 C93 50 80 66 50 88 Z' },
    { f: 'M30 22 Q20 24 19 34 Q24 28 31 27 Z', a: 1 },
  ],
  junk: [
    { f: 'M16 30 H84 V86 H16 Z' },
    { f: 'M10 20 H90 V34 H10 Z', a: 1 },
    { s: 'M34 48 L66 74 M66 48 L34 74', w: 7, a: 1 },
  ],
};

DT.orbColors = t => t === 'heart' ? DT.HEART : t === 'junk' ? { color: '#9b9aa3', dark: '#55545c', light: '#e4e3ea' } : DT.ATTRS[t];

// 預先把每種珠子畫成點陣（cell 像素）
DT.makeOrbSprites = (cell) => {
  const out = {};
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  ['bag', 'heel', 'dessert', 'jewel', 'card', 'heart', 'junk'].forEach(t => {
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(cell * dpr);
    const g = c.getContext('2d');
    g.scale(c.width / 100, c.height / 100);
    const col = DT.orbColors(t);
    // 寶石底
    g.save();
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 5; g.shadowOffsetY = 3;
    const grd = g.createRadialGradient(36, 30, 4, 50, 52, 50);
    grd.addColorStop(0, col.light); grd.addColorStop(0.45, col.color); grd.addColorStop(1, col.dark);
    g.fillStyle = grd;
    g.beginPath(); g.arc(50, 50, 45, 0, Math.PI * 2); g.fill();
    g.restore();
    g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.55)';
    g.beginPath(); g.arc(50, 50, 43.5, 0, Math.PI * 2); g.stroke();
    // 圖案
    g.save();
    g.translate(22, 21); g.scale(0.56, 0.56);
    g.shadowColor = col.dark; g.shadowBlur = 6;
    DT.GLYPH[t].forEach(p => {
      const path = new Path2D(p.f || p.s);
      const color = p.a ? col.color : '#fffaf7';
      if (p.f) { g.fillStyle = color; g.fill(path); } else { g.strokeStyle = color; g.lineWidth = p.w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(path); }
    });
    g.restore();
    // 高光
    const hl = g.createLinearGradient(0, 8, 0, 42);
    hl.addColorStop(0, 'rgba(255,255,255,.75)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl;
    g.beginPath(); g.ellipse(44, 24, 26, 14, -0.35, 0, Math.PI * 2); g.fill();
    out[t] = c;
  });
  // 名牌彩虹包（5 連做出來的特殊珠）：七彩球＋星芒
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(cell * dpr);
  const g = c.getContext('2d');
  g.scale(c.width / 100, c.height / 100);
  g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 5; g.shadowOffsetY = 3;
  const cg = g.createConicGradient ? g.createConicGradient(0, 50, 50) : null;
  if (cg) { ['#e2445c', '#f0b93a', '#43b874', '#3f7fe0', '#8a55d6', '#ff74b0', '#e2445c'].forEach((col, i, arr) => cg.addColorStop(i / (arr.length - 1), col)); g.fillStyle = cg; }
  else g.fillStyle = '#ff74b0';
  g.beginPath(); g.arc(50, 50, 45, 0, Math.PI * 2); g.fill();
  g.restore();
  const sh = g.createRadialGradient(40, 34, 2, 50, 50, 46);
  sh.addColorStop(0, 'rgba(255,255,255,.95)'); sh.addColorStop(0.35, 'rgba(255,255,255,.25)'); sh.addColorStop(1, 'rgba(60,0,60,.35)');
  g.fillStyle = sh; g.beginPath(); g.arc(50, 50, 45, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8;
  g.beginPath();
  for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? 11 : 30; g.lineTo(50 + Math.cos(ang) * rr, 50 + Math.sin(ang) * rr); }
  g.closePath(); g.fill();
  out.rainbow = c;
  return out;
};

// 小圖示（HTML 用）
DT.attrIcon = (t, size = 20) => {
  const col = DT.orbColors(t);
  const id = 'ai' + Math.random().toString(36).slice(2, 8);
  const parts = DT.GLYPH[t].map(p => p.f
    ? `<path d="${p.f}" fill="${p.a ? col.color : '#fffaf7'}"/>`
    : `<path d="${p.s}" fill="none" stroke="${p.a ? col.color : '#fffaf7'}" stroke-width="${p.w}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<svg class="ai" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${id}" cx=".36" cy=".3" r=".7"><stop offset="0" stop-color="${col.light}"/><stop offset=".5" stop-color="${col.color}"/><stop offset="1" stop-color="${col.dark}"/></radialGradient></defs><circle cx="50" cy="50" r="46" fill="url(#${id})"/><g transform="translate(22 21) scale(.56)">${parts}</g></svg>`;
};

DT.stars = n => '<span class="stars">' + '★'.repeat(n) + '</span>';

// ── 怪物 ─────────────────────────────────
(function () {
  const face = (x, y, s, o = {}) => {
    const gap = (o.gap || 22) * s, ey = y, r = 9 * s;
    const brow = o.angry
      ? `<path d="M${x - gap - r} ${ey - r * 1.7} L${x - gap + r * 1.1} ${ey - r * 1.05} M${x + gap + r} ${ey - r * 1.7} L${x + gap - r * 1.1} ${ey - r * 1.05}" stroke="#2a1420" stroke-width="${3.4 * s}" stroke-linecap="round"/>`
      : `<path d="M${x - gap - r} ${ey - r * 1.5} Q${x - gap} ${ey - r * 2} ${x - gap + r} ${ey - r * 1.5} M${x + gap - r} ${ey - r * 1.5} Q${x + gap} ${ey - r * 2} ${x + gap + r} ${ey - r * 1.5}" stroke="#2a1420" stroke-width="${2.6 * s}" fill="none" stroke-linecap="round"/>`;
    const eye = (cx, flip) => `<ellipse cx="${cx}" cy="${ey}" rx="${r}" ry="${r * 1.15}" fill="#fff"/><ellipse cx="${cx + (flip ? -1 : 1) * r * 0.15}" cy="${ey + r * 0.15}" rx="${r * 0.62}" ry="${r * 0.75}" fill="#2a1420"/><circle cx="${cx - r * 0.2}" cy="${ey - r * 0.25}" r="${r * 0.25}" fill="#fff"/>` +
      `<path d="M${cx - r * 1.1} ${ey - r * 0.6} Q${cx} ${ey - r * 1.55} ${cx + r * 1.1} ${ey - r * 0.6}" stroke="#2a1420" stroke-width="${2.4 * s}" fill="none"/><path d="M${cx + (flip ? -1 : 1) * r * 0.9} ${ey - r * 0.85} l${(flip ? -1 : 1) * r * 0.6} ${-r * 0.5}" stroke="#2a1420" stroke-width="${2 * s}" stroke-linecap="round"/>`;
    const mouth = o.angry
      ? `<path d="M${x - 9 * s} ${y + 19 * s} Q${x} ${y + 13 * s} ${x + 11 * s} ${y + 18 * s}" stroke="#2a1420" stroke-width="${3 * s}" fill="none" stroke-linecap="round"/>`
      : `<path d="M${x - 9 * s} ${y + 15 * s} Q${x} ${y + 24 * s} ${x + 10 * s} ${y + 14 * s}" stroke="#2a1420" stroke-width="${3 * s}" fill="#e2445c" stroke-linecap="round"/>`;
    return `<g class="face">${brow}${eye(x - gap, false)}${eye(x + gap, true)}<ellipse cx="${x - gap - 6 * s}" cy="${y + 15 * s}" rx="${8 * s}" ry="${4.5 * s}" fill="#ff7aa8" opacity=".55"/><ellipse cx="${x + gap + 6 * s}" cy="${y + 15 * s}" rx="${8 * s}" ry="${4.5 * s}" fill="#ff7aa8" opacity=".55"/>${mouth}</g>`;
  };
  const B = 'url(#mb)', D = 'var(--md)', L = 'var(--ml)', GOLD = 'url(#mg)';
  const KINDS = {
    tote: { top: 30, body: `<path d="M65 84 Q65 30 100 30 Q135 30 135 84" fill="none" stroke="${D}" stroke-width="10" stroke-linecap="round"/><path d="M38 82 H162 L174 174 Q174 184 164 184 H36 Q26 184 26 174 Z" fill="${B}"/><path d="M44 96 H156" stroke="${L}" stroke-width="3" stroke-dasharray="6 6" opacity=".7"/>`, face: [100, 135, 1] },
    kelly: { top: 40, body: `<path d="M72 88 Q72 40 100 40 Q128 40 128 88" fill="none" stroke="${D}" stroke-width="10" stroke-linecap="round"/><path d="M26 86 H174 L182 176 Q182 186 172 186 H28 Q18 186 18 176 Z" fill="${B}"/><path d="M26 86 H174 L164 126 Q100 142 36 126 Z" fill="${D}" opacity=".55"/><path d="M90 116 h20 v22 h-20 z" fill="${GOLD}"/><path d="M94 116 v-8 a6 6 0 0 1 12 0 v8" fill="none" stroke="${GOLD}" stroke-width="4"/>`, face: [100, 160, 0.75] },
    chain: { top: 26, body: `<path d="M44 100 Q50 26 100 26 Q150 26 156 100" fill="none" stroke="${GOLD}" stroke-width="7" stroke-dasharray="9 5" stroke-linecap="round"/><rect x="26" y="92" width="148" height="90" rx="20" fill="${B}"/><path d="M26 112 L80 182 M60 92 L150 182 M110 92 L174 156 M174 112 L120 182 M140 92 L50 182 M90 92 L26 156" stroke="${D}" stroke-width="2" opacity=".35"/><circle cx="100" cy="110" r="10" fill="none" stroke="${GOLD}" stroke-width="5"/>`, face: [100, 146, 0.95] },
    receipt: { top: 18, body: `<path d="M48 18 H152 V172 L141 184 L130 172 L119 184 L108 172 L97 184 L86 172 L75 184 L64 172 L48 184 Z" fill="${L}" stroke="${D}" stroke-width="3"/><path d="M62 44 H138 M62 128 H112 M62 142 H138 M62 156 H100" stroke="${D}" stroke-width="4" opacity=".5"/><text x="138" y="160" text-anchor="end" font-size="15" font-weight="900" fill="${D}" font-family="sans-serif">$$$</text>`, face: [100, 86, 1] },
    blackcard: { top: 52, body: `<rect x="16" y="52" width="168" height="106" rx="14" fill="${B}"/><rect x="16" y="52" width="168" height="106" rx="14" fill="#140a1e" opacity=".45"/><rect x="30" y="68" width="30" height="22" rx="4" fill="${GOLD}"/><path d="M30 140 H74 M84 140 H110 M120 140 H146" stroke="${L}" stroke-width="5" opacity=".7"/><path d="M150 66 q10 10 0 20 M160 62 q14 14 0 28" stroke="${L}" stroke-width="3" fill="none" opacity=".7"/>`, face: [108, 104, 0.95] },
    gem: { top: 38, body: `<path d="M55 38 H145 L182 84 L100 184 L18 84 Z" fill="${B}"/><path d="M18 84 H182 M55 38 L78 84 L100 184 M145 38 L122 84 L100 184 M78 84 L100 38 L122 84" stroke="${L}" stroke-width="3" fill="none" opacity=".8"/>`, face: [100, 106, 0.9] },
    ring: { top: 24, body: `<ellipse cx="100" cy="146" rx="56" ry="40" fill="none" stroke="${GOLD}" stroke-width="16"/><path d="M62 24 H138 L164 58 L100 124 L36 58 Z" fill="${B}"/><path d="M36 58 H164 M62 24 L82 58 L100 124 M138 24 L118 58 L100 124" stroke="${L}" stroke-width="2.5" fill="none" opacity=".8"/>`, face: [100, 70, 0.7] },
    tiara: { top: 52, body: `<path d="M22 150 L40 92 L62 136 L82 62 L100 128 L118 62 L138 136 L160 92 L178 150 Z" fill="${GOLD}"/><path d="M18 148 Q100 122 182 148 L176 174 Q100 150 24 174 Z" fill="${B}"/><circle cx="82" cy="62" r="10" fill="${B}" stroke="#fff" stroke-width="2"/><circle cx="118" cy="62" r="10" fill="${B}" stroke="#fff" stroke-width="2"/><circle cx="40" cy="92" r="7" fill="${L}"/><circle cx="160" cy="92" r="7" fill="${L}"/><path d="M100 90 l12 18 -12 18 -12 -18 z" fill="${L}"/>`, face: [100, 150, 0.62, { gap: 30 }] },
    perfume: { top: 22, body: `<rect x="74" y="22" width="52" height="34" rx="8" fill="${D}"/><rect x="86" y="54" width="28" height="22" fill="${GOLD}"/><rect x="40" y="74" width="120" height="110" rx="26" fill="${B}" opacity=".92"/><rect x="40" y="120" width="120" height="64" rx="26" fill="${D}" opacity=".3"/><path d="M54 90 Q58 84 66 84" stroke="#fff" stroke-width="5" fill="none" opacity=".8" stroke-linecap="round"/>`, face: [100, 128, 1] },
    macaron: { top: 44, body: `<ellipse cx="100" cy="146" rx="76" ry="34" fill="${B}"/><rect x="30" y="106" width="140" height="26" rx="12" fill="#fff6ee"/><path d="M30 130 q8 6 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" stroke="${D}" stroke-width="3" fill="none" opacity=".4"/><ellipse cx="100" cy="88" rx="76" ry="44" fill="${B}"/><ellipse cx="78" cy="70" rx="26" ry="10" fill="#fff" opacity=".35"/>`, face: [100, 90, 0.95] },
    cake: { top: 40, body: `<path d="M30 92 V170 Q100 190 170 170 V92 Z" fill="${B}"/><path d="M30 118 Q100 134 170 118 M30 146 Q100 162 170 146" stroke="#fff6ee" stroke-width="8" fill="none"/><ellipse cx="100" cy="92" rx="70" ry="20" fill="#fff6ee"/><path d="M30 92 q10 14 20 0 q10 14 20 0 q10 14 20 0 q10 14 20 0 q10 14 20 0 q10 14 20 0 q10 14 20 0" fill="#fff6ee"/><circle cx="72" cy="72" r="12" fill="#e2445c"/><circle cx="100" cy="64" r="13" fill="#e2445c"/><circle cx="128" cy="72" r="12" fill="#e2445c"/><path d="M100 52 l4 -8 M72 61 l3 -7 M128 61 l3 -7" stroke="#2c8a4a" stroke-width="4" stroke-linecap="round"/>`, face: [100, 136, 0.9] },
    donut: { top: 30, body: `<path fill-rule="evenodd" d="M100 30 a74 74 0 1 1 0 148 a74 74 0 1 1 0 -148 Z M100 86 a20 20 0 1 0 0 40 a20 20 0 1 0 0 -40 Z" fill="#d9a066"/><path fill-rule="evenodd" d="M100 40 q20 -2 34 10 q18 4 22 22 q14 16 6 34 q4 22 -16 32 q-10 18 -30 14 q-18 12 -36 0 q-22 2 -30 -18 q-18 -12 -10 -32 q-6 -22 12 -32 q8 -20 28 -18 q10 -12 20 -12 Z M100 82 a24 24 0 1 0 0 48 a24 24 0 1 0 0 -48 Z" fill="${B}"/><path d="M60 70 l8 4 M140 74 l-6 6 M58 140 l9 -2 M136 142 l6 6 M100 52 l2 9 M150 110 l8 2" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`, face: [100, 104, 0.8, { gap: 46 }] },
    pudding: { top: 56, body: `<ellipse cx="100" cy="180" rx="86" ry="12" fill="#fff" opacity=".8"/><path d="M48 70 Q100 54 152 70 L174 172 Q100 192 26 172 Z" fill="${L}"/><path d="M48 70 Q100 54 152 70 L148 94 Q120 112 100 100 Q80 114 52 94 Z" fill="${B}"/><circle cx="100" cy="56" r="12" fill="#e2445c"/>`, face: [100, 134, 1] },
    puff: { top: 36, body: `<path d="M34 128 Q100 146 166 128 Q172 170 100 178 Q28 170 34 128 Z" fill="#e6b277"/><path d="M28 120 q12 14 24 4 q12 14 24 4 q12 14 24 4 q12 14 24 4 q12 14 24 4 q12 14 24 4 L172 132 Q100 150 28 132 Z" fill="#fff6ee"/><path d="M30 122 Q22 72 66 62 Q100 30 134 62 Q178 72 170 122 Q100 138 30 122 Z" fill="${B}"/><path d="M60 64 Q80 74 76 96 M126 62 Q118 78 128 96" stroke="${D}" stroke-width="3" fill="none" opacity=".4"/>`, face: [100, 96, 0.9] },
    parfait: { top: 28, body: `<rect x="92" y="150" width="16" height="22" fill="${L}" opacity=".9"/><ellipse cx="100" cy="178" rx="40" ry="9" fill="${L}"/><circle cx="74" cy="64" r="26" fill="#fff6ee"/><circle cx="126" cy="64" r="26" fill="${B}"/><circle cx="100" cy="48" r="26" fill="${B}"/><circle cx="100" cy="24" r="10" fill="#e2445c"/><path d="M44 72 H156 L134 152 H66 Z" fill="#ffffff" opacity=".55" stroke="#fff" stroke-width="3"/><path d="M50 94 H150 L145 112 H55 Z" fill="${B}" opacity=".85"/><path d="M57 120 H143 L139 136 H61 Z" fill="#fff6ee" opacity=".9"/>`, face: [100, 104, 0.8] },
    stiletto: { top: 60, body: `<path d="M16 148 Q20 132 44 132 Q80 132 112 100 Q132 76 152 68 Q174 62 178 84 L174 100 Q170 108 166 116 L170 182 L156 182 L148 124 Q120 144 88 156 Q60 168 28 168 Q10 168 16 148 Z" fill="${B}"/><path d="M76 132 Q108 114 132 90 Q146 80 162 84 Q142 104 120 122 Z" fill="${D}" opacity=".7"/><path d="M28 168 Q60 168 88 156 Q120 144 148 124" stroke="#c8102e" stroke-width="7" fill="none" stroke-linecap="round"/>`, face: [96, 138, 0.62] },
    boot: { top: 18, body: `<path d="M68 18 H134 L132 132 L138 186 H124 L118 152 Q90 178 40 184 Q20 186 22 170 Q24 156 50 150 Q66 146 70 130 Z" fill="${B}"/><rect x="64" y="18" width="74" height="16" rx="5" fill="${D}"/><path d="M40 184 Q90 178 118 152" stroke="#c8102e" stroke-width="6" fill="none"/><path d="M128 40 V120" stroke="${GOLD}" stroke-width="3" stroke-dasharray="3 6"/>`, face: [101, 78, 0.85] },
    sandal: { top: 80, body: `<path d="M18 164 Q18 148 44 148 H162 Q182 148 182 164 Q182 178 162 178 H40 Q18 178 18 164 Z" fill="${D}"/><path d="M44 150 Q52 84 100 80 Q148 84 156 150 Z" fill="${B}"/><path d="M60 150 Q66 108 100 104 Q134 108 140 150" stroke="${L}" stroke-width="4" fill="none" opacity=".7"/><circle cx="100" cy="86" r="8" fill="${GOLD}"/>`, face: [100, 124, 0.85] },
  };
  const crown = (y) => `<g transform="translate(100 ${y - 4})"><path d="M-30 0 L-34 -30 L-16 -14 L0 -36 L16 -14 L34 -30 L30 0 Z" fill="url(#mg)" stroke="#8a5a00" stroke-width="2"/><circle cx="0" cy="-36" r="4.5" fill="#ff5d8f"/><circle cx="-34" cy="-30" r="3.5" fill="#7fd1ff"/><circle cx="34" cy="-30" r="3.5" fill="#7fd1ff"/><rect x="-30" y="-6" width="60" height="7" fill="#c9900e"/></g>`;

  DT.monsterSVG = (foe) => {
    const k = KINDS[foe.kind] || KINDS.gem;
    const col = DT.ATTRS[foe.attr];
    const [fx, fy, fs, fo] = k.face;
    const id = 'm' + Math.random().toString(36).slice(2, 8);
    let svg = `<svg class="mon" viewBox="0 -30 200 230" style="--md:${col.dark};--ml:${col.light}" aria-hidden="true">
      <defs><linearGradient id="${id}b" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${col.light}"/><stop offset=".45" stop-color="${col.color}"/><stop offset="1" stop-color="${col.dark}"/></linearGradient>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#f3c040"/><stop offset="1" stop-color="#b7800c"/></linearGradient></defs>
      <ellipse cx="100" cy="192" rx="70" ry="9" fill="#000" opacity=".22"/>
      <g class="mbody">${k.body.replace(/url\(#mb\)/g, `url(#${id}b)`).replace(/url\(#mg\)/g, `url(#${id}g)`)}${face(fx, fy, fs, { ...(fo || {}), angry: foe.boss || foe.elite })}
      ${foe.crown ? crown(k.top).replace(/url\(#mg\)/g, `url(#${id}g)`) : ''}</g></svg>`;
    return svg;
  };
  DT.MONSTER_KINDS = Object.keys(KINDS);
})();

// CSS 變數裡的相對網址會以樣式表位置解析，所以給絕對網址
DT.absImg = id => new URL(`img/card/c${String(id).padStart(2, '0')}.webp`, location.href).href;
