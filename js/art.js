// ERIKA 百貨貴婦 — 全部美術（SVG 程式繪製，不需要圖檔）
'use strict';
window.Art = (() => {
  const SKIN = '#ffe4d8', SKIN2 = '#f5c6b3', INK = '#5a2740';
  const O = 'stroke="#5a2740" stroke-opacity=".36" stroke-width="1.3" stroke-linejoin="round"';
  const O2 = 'stroke="#5a2740" stroke-opacity=".28" stroke-width="1"';

  // ---------- 共用 defs（漸層、圖示 symbol），掛在文件最前面一次 ----------
  const SHARED = `
  <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe7b0"/><stop offset=".5" stop-color="#e2bd6a"/><stop offset="1" stop-color="#a97b30"/></linearGradient>
    <linearGradient id="gGoldH" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1c9"/><stop offset=".45" stop-color="#d9b062"/><stop offset=".7" stop-color="#f6dfa0"/><stop offset="1" stop-color="#a5772c"/></linearGradient>
    <linearGradient id="gGem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd0e6"/><stop offset=".45" stop-color="#ff7fb3"/><stop offset="1" stop-color="#b24bd6"/></linearGradient>
    <radialGradient id="gCoin" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff4cf"/><stop offset=".55" stop-color="#ecc56f"/><stop offset="1" stop-color="#b3832f"/></radialGradient>
    <linearGradient id="gShadeX" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a0f26" stop-opacity=".18"/><stop offset=".3" stop-color="#3a0f26" stop-opacity="0"/><stop offset=".7" stop-color="#3a0f26" stop-opacity="0"/><stop offset="1" stop-color="#3a0f26" stop-opacity=".2"/></linearGradient>
    <linearGradient id="gSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".42"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="gLens" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b3a55"/><stop offset="1" stop-color="#1d0f17"/></linearGradient>
    <linearGradient id="gGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3d6"/><stop offset="1" stop-color="#f6c9a6"/></linearGradient>
    <linearGradient id="gWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7c4"/><stop offset="1" stop-color="#f3b8b2"/></linearGradient>
    <linearGradient id="gFacade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf6"/><stop offset="1" stop-color="#f8dfe6"/></linearGradient>
    <linearGradient id="gCarpet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9284f"/><stop offset="1" stop-color="#e2486f"/></linearGradient>
    <linearGradient id="gPlum" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b2445"/><stop offset="1" stop-color="#341127"/></linearGradient>
    <linearGradient id="gBox" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9cbd"/><stop offset="1" stop-color="#d23a6c"/></linearGradient>
    <linearGradient id="gBoxLid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3cb"/><stop offset="1" stop-color="#e2507f"/></linearGradient>
    <radialGradient id="gGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".95"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>
    <symbol id="sGem" viewBox="0 0 24 24"><path d="M6.5 3.5h11l4.5 5.8L12 21 2 9.3z" fill="url(#gGem)" stroke="#8a2f68" stroke-opacity=".45" stroke-width=".8" stroke-linejoin="round"/><path d="M2 9.3h20M9 3.5 7.6 9.3 12 21l4.4-11.7L15 3.5M7.6 9.3 12 3.6l4.4 5.7" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".8" stroke-linejoin="round"/></symbol>
    <symbol id="sCoin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="url(#gCoin)" stroke="#9a6c22" stroke-width="1"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#fff4cf" stroke-opacity=".8" stroke-width=".8"/><text x="12" y="16.2" text-anchor="middle" font-family="Bodoni Moda, Didot, Georgia, serif" font-style="italic" font-weight="700" font-size="11.5" fill="#8a5d1c">E</text></symbol>
    <symbol id="sTicket" viewBox="0 0 24 24"><path d="M3 7.5a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-2a2.5 2.5 0 0 0 0-5z" fill="#ff8fb5" stroke="#b2385f" stroke-width=".9"/><path d="M9 6.5v11" stroke="#fff" stroke-dasharray="1.5 1.5"/><path d="M14.5 9.3l.8 1.7 1.8.2-1.4 1.2.4 1.8-1.6-.9-1.6.9.4-1.8-1.4-1.2 1.8-.2z" fill="#fff"/></symbol>
  </defs></svg>`;

  const gem = (cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#sGem"/></svg>`;
  const coin = (cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#sCoin"/></svg>`;
  const ticket = (cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#sTicket"/></svg>`;

  const star4 = (x, y, r) => `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

  // ---------- 布料花紋 ----------
  function pattern(pat, f, a) {
    const id = 'p' + pat + (f + (a || '')).replace(/[^0-9a-z]/gi, '');
    let b = '';
    switch (pat) {
      case 'tweed':
        b = `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="${f}"/><path d="M0 1.5h7M0 5h7" stroke="${a}" stroke-opacity=".3" stroke-width=".9"/><path d="M1.5 0v7M5 0v7" stroke="#fff" stroke-opacity=".55" stroke-width=".9"/><circle cx="3.3" cy="3.3" r=".7" fill="${a}" fill-opacity=".45"/></pattern>`; break;
      case 'leopard':
        b = `<pattern id="${id}" width="22" height="20" patternUnits="userSpaceOnUse"><rect width="22" height="20" fill="${f}"/><g fill="#9b5a25" fill-opacity=".5"><ellipse cx="6" cy="6.5" rx="2.2" ry="1.5"/><ellipse cx="16.8" cy="14.6" rx="2" ry="1.4"/></g><g fill="none" stroke="#3a2214" stroke-width="1.7" stroke-linecap="round"><path d="M3 5.5c1-3 5.5-3 6.2.2"/><path d="M14 13.3c2-2.3 5.3-1.4 5.4 1.8"/><path d="M5 15c-1.2 2 .8 4 3 3"/><path d="M15 3c2 0 3 2 2 3.3"/><path d="M19.5 7.5l1.2 1.4"/><path d="M10.5 11.5l.8 1.5"/></g></pattern>`; break;
      case 'sequin':
        b = `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${f}"/><circle cx="1.5" cy="1.5" r="1.25" fill="#fff" fill-opacity=".55"/><circle cx="4.5" cy="4.5" r="1.25" fill="${a}" fill-opacity=".6"/><circle cx="4.5" cy="1.5" r=".5" fill="#fff" fill-opacity=".8"/></pattern>`; break;
      case 'polka':
        b = `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${f}"/><circle cx="3" cy="3" r="2.2" fill="${a}"/><circle cx="9" cy="9" r="2.2" fill="${a}"/></pattern>`; break;
      case 'stars':
        b = `<pattern id="${id}" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="${f}"/><path d="${star4(5, 6, 2.6)}${star4(17, 15, 1.8)}" fill="${a}"/><g fill="#fff" fill-opacity=".7"><circle cx="12" cy="3" r=".6"/><circle cx="20" cy="22" r=".6"/><circle cx="3" cy="19" r=".7"/><circle cx="21" cy="5" r=".5"/></g></pattern>`; break;
      case 'quilt':
        b = `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="${f}"/><path d="M0 0h7M0 0v7" stroke="${a}" stroke-opacity=".55" stroke-width=".8"/></pattern>`; break;
      case 'croc':
        b = `<pattern id="${id}" width="7" height="5" patternUnits="userSpaceOnUse"><rect width="7" height="5" fill="${f}"/><rect x=".6" y=".6" width="5.8" height="3.8" rx="1.5" fill="#fff" fill-opacity=".08" stroke="#000" stroke-opacity=".28" stroke-width=".6"/></pattern>`; break;
      case 'ostrich':
        b = `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="${f}"/><circle cx="2" cy="2" r="1" fill="#7a1f45" fill-opacity=".18"/><circle cx="5.5" cy="5.5" r="1" fill="#7a1f45" fill-opacity=".18"/></pattern>`; break;
      case 'crystal':
        b = `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${f}"/><path d="M3 .6 5.4 3 3 5.4 .6 3z" fill="#fff" fill-opacity=".75"/><circle cx="3" cy="3" r=".5" fill="#a9c4ef"/></pattern>`; break;
    }
    return [id, b];
  }

  // ---------- 頭髮 ----------
  function hairBack(h, hat) {
    const c = h.c, d = h.d;
    switch (h.style) {
      case 'wave':
        return `<path d="M74 96C68 52 96 38 120 38C144 38 172 52 166 96C176 122 162 146 172 170C182 196 160 208 172 236C152 248 134 238 124 244L116 244C106 238 88 248 68 236C80 208 58 196 68 170C78 146 64 122 74 96Z" fill="${c}" ${O}/>
          <path d="M77 150C71 170 85 186 75 206M163 150C169 170 155 186 165 206" stroke="${d}" stroke-width="2" fill="none" opacity=".45"/>`;
      case 'curly': {
        let s = `<path d="M76 96C70 52 96 38 120 38C144 38 170 52 164 96C166 130 168 170 160 214C140 226 100 226 80 214C72 170 74 130 76 96Z" fill="${c}" ${O}/>`;
        for (const [x, y] of [[74, 124], [69, 150], [72, 176], [79, 201], [94, 220]]) {
          for (const X of [x, 240 - x]) s += `<circle cx="${X}" cy="${y}" r="13" fill="${c}" ${O}/><path d="M${X - 5} ${y}a5 5 0 1 1 5 5" stroke="${d}" stroke-width="1.6" fill="none" opacity=".55"/>`;
        }
        return s;
      }
      case 'bob':
        return `<path d="M76 96C70 52 96 38 120 38C144 38 170 52 164 96C166 120 170 140 166 150C154 158 142 152 136 148L104 148C98 152 86 158 74 150C70 140 74 120 76 96Z" fill="${c}" ${O}/>`;
      case 'bun':
        return (hat ? '' : `<circle cx="120" cy="34" r="19" fill="${c}" ${O}/><path d="M108 32c4-9 18-9 22 0M110 41c6 4 14 4 20 0" stroke="${d}" stroke-width="1.6" fill="none" opacity=".55"/>
          <g fill="#fff" ${O2}><circle cx="104" cy="30" r="2.6"/><circle cx="102" cy="38" r="2.2"/><circle cx="106" cy="23" r="2"/></g>`) + `
          <path d="M78 96C74 54 98 42 120 42C142 42 166 54 162 96C162 106 160 114 156 118L84 118C80 114 78 106 78 96Z" fill="${c}" ${O}/>`;
      default: // straight
        return `<path d="M74 96C70 52 96 38 120 38C144 38 170 52 166 96C168 140 174 190 170 232C150 242 90 242 70 232C66 190 72 140 74 96Z" fill="${c}" ${O}/>
          <path d="M80 140C78 170 80 200 78 226M160 140C162 170 160 200 162 226" stroke="${d}" stroke-width="1.6" fill="none" opacity=".4"/>`;
    }
  }

  function hairFront(h) {
    const c = h.c, d = h.d;
    const shine = `<path d="M94 60Q118 49 146 58" stroke="#fff" stroke-opacity=".38" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    switch (h.style) {
      case 'bob':
        return `<path d="M80 100C76 60 98 46 120 46C142 46 164 60 160 100C158 92 152 88 146 88L94 88C88 88 82 92 80 100Z" fill="${c}" ${O}/>
          <path d="M80 94C75 116 76 136 80 149L93 146C88 130 88 112 91 94Z" fill="${c}" ${O}/><path d="M160 94C165 116 164 136 160 149L147 146C152 130 152 112 149 94Z" fill="${c}" ${O}/>
          <path d="M100 88v-8M112 88v-10M128 88v-10M140 88v-8" stroke="${d}" stroke-width="1.2" opacity=".35"/>${shine}`;
      case 'bun':
        return `<path d="M80 100C76 62 98 48 122 48C146 48 166 64 160 100C152 80 140 70 126 68C112 72 96 82 80 100Z" fill="${c}" ${O}/>
          <path d="M82 100q-5 14 2 27M158 100q5 14-2 27" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/>${shine}`;
      default: {
        let s = `<path d="M79 100C76 62 98 46 122 46C148 46 166 64 161 102C156 86 148 76 138 70C128 84 106 92 84 94C81 96 80 98 79 100Z" fill="${c}" ${O}/>
          <path d="M80 96C74 116 74 138 84 154C86 134 86 114 88 98Z" fill="${c}" ${O}/><path d="M160 96C166 116 166 138 156 154C154 134 154 114 152 98Z" fill="${c}" ${O}/>
          <path d="M136 72C128 82 112 88 96 90" stroke="${d}" stroke-width="1.4" fill="none" opacity=".4"/>${shine}`;
        if (h.style === 'curly') s += `<circle cx="84" cy="152" r="6" fill="${c}" ${O}/><circle cx="156" cy="152" r="6" fill="${c}" ${O}/>`;
        return s;
      }
    }
  }

  // ---------- 臉 ----------
  function head() {
    return `<ellipse cx="80" cy="103" rx="5" ry="8" fill="${SKIN}" ${O}/><ellipse cx="160" cy="103" rx="5" ry="8" fill="${SKIN}" ${O}/>
      <path d="M79 92C79 62 98 52 120 52C142 52 161 62 161 92C161 118 146 138 120 140C94 138 79 118 79 92Z" fill="${SKIN}" ${O}/>`;
  }
  function face() {
    const eye = (x, flip) => {
      const k = flip ? -1 : 1;
      return `<ellipse cx="${x}" cy="101" rx="6.3" ry="7.7" fill="#4a1f35"/><ellipse cx="${x}" cy="103.5" rx="4.2" ry="4.6" fill="#93466e"/>
        <circle cx="${x - 2 * k}" cy="98" r="2.3" fill="#fff"/><circle cx="${x + 2.2 * k}" cy="104.6" r="1" fill="#fff"/>
        <path d="M${x - 8 * k} 96Q${x} 90 ${x + 8 * k} 95" stroke="#2a1420" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M${x - 7.6 * k} 96.2l-3.6 -2.6" stroke="#2a1420" stroke-width="1.8" stroke-linecap="round"/>`;
    };
    return `<g class="eyes">${eye(104, false)}${eye(136, true)}</g>
      <path d="M96 86Q103 82 110 85M130 85Q137 82 144 86" stroke="#6a3a4e" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <ellipse cx="97" cy="114" rx="7" ry="3.8" fill="#ff9db8" opacity=".5"/><ellipse cx="143" cy="114" rx="7" ry="3.8" fill="#ff9db8" opacity=".5"/>
      <path d="M120 108q-1.6 3 1 3.6" stroke="${SKIN2}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M114.5 119.5Q117 117 120 118.6Q123 117 125.5 119.5Q120 124.8 114.5 119.5Z" fill="#d94b72"/><ellipse cx="121.5" cy="121.2" rx="1.6" ry=".7" fill="#fff" opacity=".55"/>
      <circle cx="139.5" cy="121" r=".9" fill="#5a2740"/>`;
  }
  const neck = () => `<path d="M111 126V151H129V126Z" fill="${SKIN}"/><path d="M111 132Q120 141 129 132V139Q120 146 111 139Z" fill="${SKIN2}" opacity=".6"/>`;
  const chest = () => `<path d="M93 157Q95 148 111 147H129Q145 148 147 157L147 178H93Z" fill="${SKIN}" ${O}/>`;

  // ---------- 身體 / 服裝 ----------
  const LEGS = `<path d="M108 296C107 328 108 350 110 371H117C118 350 119 328 119 296Z" fill="${SKIN}" ${O}/><path d="M121 296C121 328 122 350 123 371H130C132 350 133 328 132 296Z" fill="${SKIN}" ${O}/>`;

  function arms() {
    const a = (d, hx, hy) => `<path d="${d}" stroke="#5a2740" stroke-opacity=".36" stroke-width="12.6" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${SKIN}" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="${hx}" cy="${hy}" r="6.2" fill="${SKIN}" ${O}/>`;
    return a('M97 160C89 184 85 212 86 244', 86, 247) + a('M143 160C151 184 156 208 158 238', 158, 241);
  }
  function longSleeves(fill) {
    const s = d => `<path d="${d}" stroke="#5a2740" stroke-opacity=".36" stroke-width="15" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${fill}" stroke-width="12.4" fill="none" stroke-linecap="round"/>`;
    return s('M97 160C90 182 86 206 86 230') + s('M143 160C150 182 155 204 157 226');
  }

  const SKIRTS = {
    aline: 'M104 204H136C150 236 166 270 172 300C150 311 90 311 68 300C74 270 90 236 104 204Z',
    gown: 'M104 204H136C156 250 180 330 188 386C160 398 80 398 52 386C60 330 84 250 104 204Z',
    mermaid: 'M104 204H136C142 240 142 280 138 318C150 348 168 372 178 390C150 400 90 400 62 390C72 372 90 348 102 318C98 280 98 240 104 204Z',
  };
  const BODICE = 'M95 154C103 160 111 166 120 167C129 166 137 160 145 154C147 172 143 192 137 206H103C97 192 93 172 95 154Z';

  function dress(d, F) {
    const fill = F(d);
    let s = '';
    if (d.shape === 'suit') {
      s += `<path d="M100 228H140L142 300H98Z" fill="${fill}" ${O}/><path d="M100 228H140L142 300H98Z" fill="url(#gShadeX)"/>`;
      s += `<path d="M93 152C100 158 110 162 114 162L120 196 126 162C130 162 140 158 147 152C150 176 150 204 146 232H94C90 204 90 176 93 152Z" fill="${fill}" ${O}/>`;
      s += `<path d="M114 162L120 196 126 162Z" fill="#fff"/><path d="M93 152C100 158 110 162 114 162L120 196 126 162C130 162 140 158 147 152M94 232H146" stroke="${d.a}" stroke-width="2.4" fill="none"/>`;
      s += `<g fill="url(#gGold)" ${O2}><circle cx="115" cy="208" r="2.4"/><circle cx="115" cy="220" r="2.4"/><circle cx="125" cy="208" r="2.4"/><circle cx="125" cy="220" r="2.4"/></g>`;
      s += `<path d="M98 214h10M132 214h10" stroke="${d.a}" stroke-width="2"/>`;
      return { body: s, sleeves: longSleeves(fill), trim: '' };
    }
    if (d.shape === 'coat') {
      s += `<path d="M92 154C86 200 80 262 74 320H166C160 262 154 200 148 154C140 160 130 164 120 164C110 164 100 160 92 154Z" fill="${fill}" ${O}/><path d="M92 154C86 200 80 262 74 320H166C160 262 154 200 148 154Z" fill="url(#gShadeX)"/>`;
      s += `<path d="M120 168V320" stroke="#3a0f26" stroke-opacity=".22" stroke-width="1.5"/><rect x="95" y="208" width="50" height="8" rx="3" fill="${d.a}" ${O2}/><rect x="114" y="206" width="12" height="12" rx="2" fill="none" stroke="url(#gGold)" stroke-width="2.4"/>`;
      let fur = '';
      for (const [x, y, r] of [[92, 166, 8], [98, 156, 9], [106, 163, 9], [114, 168, 8], [126, 168, 8], [134, 163, 9], [142, 156, 9], [148, 166, 8], [90, 176, 7], [150, 176, 7]]) fur += `<circle cx="${x}" cy="${y}" r="${r}" fill="${d.fur}" ${O2}/>`;
      return { body: s, sleeves: longSleeves(fill), trim: fur };
    }
    const sk = SKIRTS[d.shape] || SKIRTS.aline;
    s += `<path d="${sk}" fill="${fill}" ${O}/><path d="${sk}" fill="url(#gShadeX)"/>`;
    if (d.tulle) s += `<path d="${sk}" transform="translate(120 204) scale(1.06 1) translate(-120 -204)" fill="#fff" fill-opacity=".28" ${O2}/>`;
    if (d.pat === 'sequin') s += `<path d="${sk}" fill="url(#gSheen)"/>`;
    if (d.shape === 'aline') s += `<path d="M112 210Q106 258 94 304M128 210Q134 258 146 304M120 210V308" stroke="#3a0f26" stroke-opacity=".1" stroke-width="2" fill="none"/>`;
    if (d.shape === 'aline' && d.a === '#ffffff' && !d.pat) {
      let lace = ''; for (let x = 72; x <= 168; x += 8) lace += `<circle cx="${x}" cy="${303 + Math.abs(x - 120) * -0.02}" r="4.2" fill="#fff" ${O2}/>`;
      s += lace;
    }
    s += `<path d="${BODICE}" fill="${fill}" ${O}/><path d="${BODICE}" fill="url(#gShadeX)"/>`;
    s += `<rect x="102" y="199" width="36" height="8" rx="4" fill="${d.a}" ${O2}/>`;
    if (d.shape !== 'aline') s += `<path d="M133 199l9-6 1 9zM133 207l9 6 1-9z" fill="${d.a}" ${O2}/>`;
    let sleeves = '';
    if (d.sl === 'puff') sleeves = `<ellipse cx="95" cy="160" rx="11" ry="9" transform="rotate(-24 95 160)" fill="${fill}" ${O}/><ellipse cx="145" cy="160" rx="11" ry="9" transform="rotate(24 145 160)" fill="${fill}" ${O}/>`;
    return { body: s, sleeves, trim: '' };
  }

  function shoes(sh, long) {
    const dy = long ? 22 : 0;
    const shp = (d) => `<path d="${d}" fill="${sh.glass ? 'rgba(214,236,255,.85)' : sh.f}" ${O}/>`;
    let s = `<g transform="translate(0 ${dy})">` + shp('M105 369H119.5L120.5 378.5Q112.5 382.8 104.4 378.6Z') + shp('M121 369H135.5L136.4 378.6Q128.3 382.8 120.3 378.5Z');
    if (sh.sole) s += `<path d="M104.6 378.8Q112.5 383 120.5 378.8M120.4 378.8Q128.3 383 136.3 378.8" stroke="${sh.sole}" stroke-width="2" fill="none"/>`;
    if (sh.glass) s += `<path d="M108 371l4 4M124 371l4 4" stroke="#fff" stroke-width="1.4"/><path d="${star4(117, 372, 3)}${star4(133, 372, 2.4)}" fill="#fff"/>`;
    else s += `<path d="M108 371.5h6M124 371.5h6" stroke="#fff" stroke-opacity=".5" stroke-width="1.2" stroke-linecap="round"/>`;
    return s + '</g>';
  }

  // ---------- 包包（握在右手 158,241） ----------
  function bag(b, F) {
    const fill = F(b);
    switch (b.shape) {
      case 'tote':
        return `<path d="M150 250C150 232 166 232 166 250" stroke="${b.a}" stroke-width="2.6" fill="none"/><path d="M141 248H175L179 288H137Z" fill="${fill}" ${O}/>
          <text x="158" y="273" text-anchor="middle" font-family="Bodoni Moda, Didot, Georgia, serif" font-style="italic" font-weight="700" font-size="15" fill="${b.a}">E</text>`;
      case 'quilt':
        return `<path d="M143 156C160 190 172 222 170 240" stroke="url(#gGold)" stroke-width="2" stroke-dasharray="3 1.6" fill="none"/><rect x="150" y="238" width="36" height="28" rx="5" fill="${fill}" ${O}/>
          <path d="M150 241H186V250Q168 259 150 250Z" fill="${b.f}" ${O}/><circle cx="168" cy="252.5" r="3.4" fill="url(#gGold)" ${O2}/>`;
      case 'handbag':
        return `<path d="M148 252C148 232 168 232 168 252" stroke="${b.f}" stroke-width="3.6" fill="none"/><path d="M139 251H177L181 287H135Z" fill="${fill}" ${O}/>
          <path d="M139 251H177L175 264H141Z" fill="${b.f}" ${O}/><rect x="154.5" y="260" width="7" height="8" rx="1.2" fill="url(#gGold)" ${O2}/><path d="M139 287h42" stroke="#000" stroke-opacity=".15" stroke-width="2"/>`;
      case 'mini': {
        let p = ''; for (let i = 0; i <= 10; i++) { const t = i / 10, x = 147 + 22 * t, y = (1 - t) * (1 - t) * 252 + 2 * (1 - t) * t * 226 + t * t * 252; p += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="#fff" ${O2}/>`; }
        return p + `<path d="M145 251Q158 245 171 251L173 270Q158 278 143 270Z" fill="${fill}" ${O}/><path d="M145 256Q158 251 171 256" stroke="${b.a}" stroke-width="2.4" fill="none"/><circle cx="158" cy="258" r="2.6" fill="url(#gGold)"/>`;
      }
      case 'box':
        return `<path d="M151 249C151 236 165 236 165 249" stroke="${b.f}" stroke-width="3" fill="none"/><rect x="144" y="247" width="28" height="23" rx="5" fill="${fill}" ${O}/><path d="M144 254h28" stroke="#fff" stroke-width="2"/><circle cx="158" cy="254" r="2.4" fill="url(#gGold)"/>`;
      case 'clutch':
        return `<g transform="rotate(-14 158 244)"><rect x="140" y="234" width="42" height="20" rx="6" fill="${fill}" ${O}/><path d="M140 240Q161 250 182 240" stroke="#9bb5df" stroke-width="1.2" fill="none"/><path d="M161 242l3.5 3.5-3.5 3.5-3.5-3.5z" fill="#ff8fbf" ${O2}/></g>`;
    }
    return '';
  }

  // ---------- 珠寶 ----------
  function jewel(j) {
    if (j.kind === 'pearl') {
      let s = '';
      for (let i = 0; i <= 12; i++) { const t = i / 12, x = (1 - t) * (1 - t) * 103 + 2 * (1 - t) * t * 120 + t * t * 137, y = (1 - t) * (1 - t) * 151 + 2 * (1 - t) * t * 177 + t * t * 151; s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="#fffaf3" ${O2}/>`; }
      return s + `<circle cx="80" cy="114" r="2.8" fill="#fffaf3" ${O2}/><circle cx="160" cy="114" r="2.8" fill="#fffaf3" ${O2}/>`;
    }
    const big = j.big ? 1.7 : 1;
    let s = `<path d="M106 148Q120 172 134 148" stroke="${j.ch}" stroke-width="1.2" fill="none"/>`;
    s += `<g transform="translate(120 162) scale(${big})"><path d="M0-5 5 0 0 7-5 0Z" fill="${j.g}" ${O2}/><path d="M-5 0h10M0-5v12" stroke="#fff" stroke-opacity=".6" stroke-width=".7"/></g>`;
    if (j.big) { for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; s += `<circle cx="${(120 + Math.cos(a) * 12.5).toFixed(1)}" cy="${(163 + Math.sin(a) * 13).toFixed(1)}" r="1.4" fill="#fff" ${O2}/>`; } }
    s += `<path d="M78 112l2-3 2 3-2 3z" fill="${j.g}" ${O2}/><path d="M158 112l2-3 2 3-2 3z" fill="${j.g}" ${O2}/>`;
    return s;
  }

  // ---------- 頭飾 ----------
  function headwear(t) {
    switch (t.kind) {
      case 'sunglass':
        return `<g transform="rotate(-4 120 58)"><ellipse cx="105" cy="58" rx="12.5" ry="8.5" fill="url(#gLens)" stroke="url(#gGold)" stroke-width="1.6"/><ellipse cx="135" cy="58" rx="12.5" ry="8.5" fill="url(#gLens)" stroke="url(#gGold)" stroke-width="1.6"/>
          <path d="M117.5 57Q120 54.5 122.5 57" stroke="url(#gGold)" stroke-width="1.6" fill="none"/><path d="M98 55l6-3M128 55l6-3" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/></g>`;
      case 'hat':
        return `<g transform="rotate(-7 120 60)"><ellipse cx="120" cy="61" rx="76" ry="15" fill="${t.f}" ${O}/><path d="M90 61C88 26 152 26 150 61Z" fill="${t.f}" ${O}/>
          <path d="M89.6 52C100 56 140 56 150.4 52L150.8 61C140 64 100 64 89.2 61Z" fill="${t.a}"/><path d="M144 55c8-8 14-4 10 3-4 6-10 2-10-3zM144 57c6 7 2 13-3 9" fill="${t.a}"/>
          <ellipse cx="120" cy="61" rx="76" ry="15" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1" stroke-dasharray="2 3"/></g>`;
      case 'pearlband': {
        let s = ''; for (let i = 0; i <= 14; i++) { const u = i / 14, x = (1 - u) * (1 - u) * 82 + 2 * (1 - u) * u * 120 + u * u * 158, y = (1 - u) * (1 - u) * 88 + 2 * (1 - u) * u * 26 + u * u * 88; s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i % 2 ? 2.8 : 3.6}" fill="#fffaf3" ${O2}/>`; }
        return s;
      }
      case 'fascinator':
        return `<path d="M150 50C156 26 170 18 180 16C170 24 162 34 156 50" fill="#fff" ${O2}/><path d="M128 66l30-22M134 72l30-22M128 54l30 22" stroke="${t.f}" stroke-opacity=".35" stroke-width=".8"/>
          <ellipse cx="148" cy="54" rx="17" ry="6.5" transform="rotate(-18 148 54)" fill="${t.f}" ${O}/><ellipse cx="148" cy="49" rx="9" ry="5" transform="rotate(-18 148 49)" fill="${t.f}" ${O}/>
          <circle cx="139" cy="54" r="4.6" fill="${t.a}" ${O2}/><circle cx="139" cy="54" r="1.6" fill="#fff" opacity=".6"/>`;
      case 'bow':
        return `<g transform="rotate(14 150 58)"><path d="M150 58C140 44 128 46 130 58 132 70 142 70 150 58Z" fill="${t.f}" ${O}/><path d="M150 58C160 44 172 46 170 58 168 70 158 70 150 58Z" fill="${t.f}" ${O}/>
          <path d="M147 60l-6 16 6-3M153 60l6 16-6-3" fill="${t.f}" ${O2}/><circle cx="150" cy="58" r="4.6" fill="${t.f}" ${O}/><path d="M136 54c3-3 7-3 9 0" stroke="#fff" stroke-opacity=".6" stroke-width="1.4" fill="none"/></g>`;
      case 'tiara':
        return `<path d="M90 64L97 48 105 57 112 42 120 28 128 42 135 57 143 48 150 64Q120 55 90 64Z" fill="url(#gGoldH)" ${O}/>
          <circle cx="120" cy="45" r="4.4" fill="#ff8fbf" ${O2}/><circle cx="111.5" cy="52" r="2.6" fill="#8fc3ff" ${O2}/><circle cx="128.5" cy="52" r="2.6" fill="#8fc3ff" ${O2}/>
          <g fill="#fff"><circle cx="120" cy="28" r="2"/><circle cx="97" cy="48" r="1.6"/><circle cx="143" cy="48" r="1.6"/><circle cx="112" cy="42" r="1.3"/><circle cx="128" cy="42" r="1.3"/></g>
          <path d="M92 62Q120 54 148 62" stroke="#fff" stroke-opacity=".7" stroke-width="1" fill="none" stroke-dasharray="1.5 2.5"/>`;
    }
    return '';
  }

  // ---------- 寵物（左下角） ----------
  function pet(p) {
    const f = p.f;
    const eyes = (x1, x2, y) => `<circle cx="${x1}" cy="${y}" r="1.8" fill="#2a1420"/><circle cx="${x2}" cy="${y}" r="1.8" fill="#2a1420"/><circle cx="${x1 + .6}" cy="${y - .6}" r=".6" fill="#fff"/><circle cx="${x2 + .6}" cy="${y - .6}" r=".6" fill="#fff"/>`;
    if (p.kind === 'poodle') {
      return `<g class="pet"><circle cx="88" cy="356" r="7" fill="${f}" ${O}/><rect x="80" y="358" width="4" height="10" fill="${f}"/>
        <ellipse cx="66" cy="369" rx="21" ry="13" fill="${f}" ${O}/>
        <g fill="${f}" ${O}><rect x="52" y="374" width="4.5" height="14"/><rect x="62" y="376" width="4.5" height="13"/><rect x="72" y="376" width="4.5" height="13"/><rect x="80" y="374" width="4.5" height="14"/>
        <circle cx="54" cy="390" r="5.6"/><circle cx="64" cy="391" r="5.6"/><circle cx="74" cy="391" r="5.6"/><circle cx="82.5" cy="390" r="5.6"/></g>
        <circle cx="47" cy="365" r="10" fill="${f}" ${O}/>
        <ellipse cx="30" cy="352" rx="6.4" ry="10.5" fill="${f}" ${O}/><ellipse cx="54" cy="352" rx="6.4" ry="10.5" fill="${f}" ${O}/>
        <circle cx="42" cy="345" r="12.5" fill="${f}" ${O}/><circle cx="42" cy="331" r="9" fill="${f}" ${O}/>
        ${eyes(37.5, 46.5, 345)}<ellipse cx="42" cy="350.5" rx="2.2" ry="1.7" fill="#2a1420"/><ellipse cx="34" cy="350" rx="2.6" ry="1.4" fill="#ff9db8" opacity=".6"/><ellipse cx="50" cy="350" rx="2.6" ry="1.4" fill="#ff9db8" opacity=".6"/>
        <path d="M48 327c5-6 10-3 7 2-3 4-7 1-7-2zM48 327c-6-5-10-1-7 3 3 3 7 1 7-3z" fill="#f37ca0" ${O2}/></g>`;
    }
    if (p.kind === 'cat') {
      return `<g class="pet"><path d="M84 380C98 378 102 360 92 350C88 346 84 352 88 356C94 362 88 372 80 372Z" fill="${f}" ${O}/>
        <ellipse cx="64" cy="374" rx="24" ry="16" fill="${f}" ${O}/><g fill="${f}" ${O}><ellipse cx="52" cy="389" rx="6" ry="4"/><ellipse cx="68" cy="390" rx="6" ry="4"/></g>
        <path d="M30 344L33 326 44 336ZM58 344L55 326 44 336Z" fill="${f}" ${O}/><path d="M33.5 331l2.5 6M54.5 331l-2.5 6" stroke="#f6a9c0" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="44" cy="350" r="15.5" fill="${f}" ${O}/><path d="M34 360q10 7 20 0" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/>
        <ellipse cx="38.5" cy="348" rx="2.6" ry="3" fill="#3b9d7a"/><ellipse cx="49.5" cy="348" rx="2.6" ry="3" fill="#3b9d7a"/><ellipse cx="38.5" cy="348" rx=".9" ry="2.4" fill="#1a1a1a"/><ellipse cx="49.5" cy="348" rx=".9" ry="2.4" fill="#1a1a1a"/>
        <path d="M42.4 353.5h3.2L44 355.5Z" fill="#f08aa8"/><path d="M44 355.5v2M44 357.5q-2.5 1.5-4 0M44 357.5q2.5 1.5 4 0" stroke="#7a4a5a" stroke-width=".9" fill="none"/>
        <path d="M36 364q8 4 16 0" stroke="#d3365f" stroke-width="3" fill="none"/><circle cx="44" cy="367" r="2.6" fill="url(#gGold)" ${O2}/></g>`;
    }
    // pom 博美
    let fluff = '';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; fluff += `<circle cx="${(44 + Math.cos(a) * 14).toFixed(1)}" cy="${(350 + Math.sin(a) * 13).toFixed(1)}" r="6" fill="${f}"/>`; }
    return `<g class="pet"><path d="M80 356C96 340 100 362 86 370Z" fill="${f}" ${O}/><ellipse cx="66" cy="372" rx="20" ry="15" fill="${f}" ${O}/>
      <g fill="${f}" ${O}><ellipse cx="54" cy="388" rx="5" ry="4.4"/><ellipse cx="74" cy="388" rx="5" ry="4.4"/></g>
      <g ${O}>${fluff}</g><path d="M34 338l2-12 9 9ZM54 338l-2-12-9 9Z" fill="${f}" ${O}/>
      <circle cx="44" cy="350" r="13" fill="${f}"/><path d="M36 352q8 12 16 0q-8 4-16 0" fill="#fff6ea"/>
      ${eyes(39, 49, 347)}<ellipse cx="44" cy="353.5" rx="2.2" ry="1.6" fill="#2a1420"/><path d="M42 357q2 2 4 0" stroke="#2a1420" stroke-width=".9" fill="none"/></g>`;
  }

  // ---------- 角色組合 ----------
  function avatar(eq, o = {}) {
    const defs = [];
    const F = it => { if (it.pat) { const [id, b] = pattern(it.pat, it.f, it.a); defs.push(b); return `url(#${id})`; } return it.f; };
    const H = eq.hair, Dr = eq.dress, B = eq.bag, J = eq.jewel, T = eq.head, Sh = eq.shoes, P = eq.pet;
    let g = '';
    if (o.headOnly) {
      g = hairBack(H, T && T.kind === 'hat') + neck() + head() + face() + hairFront(H) + (T ? headwear(T) : '');
      return wrap(o.vb || '62 18 116 132', g, defs, o.cls || 'av');
    }
    const long = Dr.shape === 'gown' || Dr.shape === 'mermaid';
    const d = dress(Dr, F);
    g += hairBack(H, T && T.kind === 'hat') + neck() + chest();
    if (!long) g += LEGS;
    g += shoes(Sh, long);
    g += d.body + arms() + d.sleeves + d.trim;
    g += head() + face() + hairFront(H);
    if (J) g += jewel(J);
    if (T) g += headwear(T);
    if (B) g += bag(B, F);
    if (P) g += pet(P);
    return wrap(o.vb || '0 10 240 400', `<g class="body">${g}</g>`, defs, o.cls || 'av');
  }
  const wrap = (vb, g, defs, cls) => `<svg class="${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${defs.join('')}</defs>${g}</svg>`;

  // 衣櫥縮圖：只畫單品本身
  function itemIcon(it) {
    const defs = [];
    const F = x => { if (x.pat) { const [id, b] = pattern(x.pat, x.f, x.a); defs.push(b); return `url(#${id})`; } return x.f; };
    const BASE_HAIR = { style: 'bun', c: '#3b2630', d: '#1e1219' };
    let g = '', vb = '0 0 240 410';
    switch (it.cat) {
      case 'hair': g = hairBack(it) + neck() + head() + face() + hairFront(it); vb = it.style === 'bun' ? '60 12 120 138' : '60 26 120 132'; break;
      case 'dress': {
        const d = dress(it, F);
        g = `<path d="M111 136V151H129V136Z" fill="#e9d6cf"/>` + d.body + d.sleeves + d.trim;
        vb = (it.shape === 'gown' || it.shape === 'mermaid') ? '36 136 168 268' : '50 140 140 190';
        break;
      }
      case 'bag': g = bag(it, F); vb = it.shape === 'quilt' ? '138 150 70 124' : '128 222 64 72'; if (it.shape === 'quilt') vb = '134 200 64 72'; break;
      case 'jewel': g = `<path d="M100 120H140V150Q150 150 156 160V190H84V160Q90 150 100 150Z" fill="${SKIN}" ${O}/>` + jewel(it); vb = '86 134 68 52'; break;
      case 'head': g = hairBack(BASE_HAIR, it.kind === 'hat') + head() + face() + hairFront(BASE_HAIR) + headwear(it); vb = it.kind === 'fascinator' ? '70 10 120 110' : it.kind === 'hat' ? '38 18 164 100' : '66 16 108 110'; break;
      case 'shoes': {
        const body = 'M5 31C12 31 20 28 26 20L31 13C33 11 37 12 37 15L38 34H34L32.5 24C28 29 22 35 14 36H6C4 36 3.5 31 5 31Z';
        g = `<path d="${body}" fill="${it.glass ? 'rgba(214,236,255,.9)' : it.f}" ${O}/>`;
        g += `<path d="M6 36h8M34 34h4" stroke="${it.sole || '#5a2740'}" stroke-opacity="${it.sole ? 1 : .45}" stroke-width="2.4" stroke-linecap="round"/>`;
        g += `<path d="M9 30c6-1 12-4 17-10" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
        if (it.glass) g += `<path d="${star4(30, 9, 4)}${star4(12, 25, 2.6)}" fill="#fff"/><path d="M28 18l3-4" stroke="#fff" stroke-width="1.6"/>`;
        if (it.id === 'shoes_pink') g += `<path d="M10 30c-3-4 1-6 3-2 2-4 6-2 3 2z" fill="#fff" fill-opacity=".85"/>`;
        vb = '0 6 42 36'; break;
      }
      case 'pet': g = pet(it); vb = '16 316 84 82'; break;
    }
    return wrap(vb, g, defs, 'iv');
  }

  // ---------- 百貨公司門面（舞台背景） ----------
  function facade(city) {
    let s = `<rect width="400" height="470" fill="url(#gSkyStage)"/>`;
    // 天空光點
    for (const [x, y, r, o] of [[30, 30, 14, .35], [370, 50, 18, .3], [60, 120, 8, .4], [345, 140, 10, .35], [16, 210, 10, .3], [388, 250, 12, .25]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`;
    // 建築
    s += `<rect x="28" y="20" width="344" height="352" fill="url(#gFacade)" ${O}/>`;
    s += `<path d="M150 20L200 -4 250 20Z" fill="url(#gFacade)" ${O}/><path d="M188 8l12-14 12 14z" fill="url(#gGold)"/>`;
    s += `<rect x="20" y="14" width="360" height="10" rx="3" fill="url(#gGold)"/>`;
    for (let x = 30; x < 372; x += 12) s += `<rect x="${x}" y="25" width="6" height="4" fill="#e6cc96" opacity=".7"/>`;
    // 招牌
    s += `<rect x="100" y="36" width="200" height="60" rx="10" fill="url(#gPlum)" stroke="url(#gGold)" stroke-width="2.4"/>`;
    s += `<text x="200" y="74" text-anchor="middle" font-family="Bodoni Moda, Didot, Georgia, serif" font-style="italic" font-weight="700" font-size="38" letter-spacing="4" fill="url(#gGoldH)">ERIKA</text>`;
    s += `<text x="200" y="88" text-anchor="middle" font-family="Bodoni Moda, Didot, Georgia, serif" font-size="7.5" letter-spacing="3" fill="#ecd08a">GRANDS MAGASINS · ${city.en}</text>`;
    let k = 0;
    for (let x = 108; x <= 292; x += 13) { s += `<circle class="bulb" style="animation-delay:${(k++ % 4) * .4}s" cx="${x}" cy="31" r="2.6" fill="#fff3c4"/><circle class="bulb" style="animation-delay:${(k % 4) * .4}s" cx="${x}" cy="101" r="2.6" fill="#fff3c4"/>`; }
    // 二樓拱窗
    for (const x of [44, 112, 180, 248, 316]) {
      s += `<path d="M${x} 168V132a20 20 0 0 1 40 0V168Z" fill="url(#gWin)" ${O}/><path d="M${x + 20} 112V168M${x} 142H${x + 40}" stroke="#fff" stroke-width="2"/>`;
      s += `<path d="M${x - 4} 168H${x + 44}" stroke="url(#gGold)" stroke-width="3"/><path d="M${x} 174V168M${x + 10} 174V168M${x + 20} 174V168M${x + 30} 174V168M${x + 40} 174V168M${x - 2} 175H${x + 42}" stroke="url(#gGold)" stroke-width="1.4"/>`;
      s += `<path d="M${x + 14} 124h12l-6 8z" fill="#f6d27f" opacity=".85"/><circle cx="${x + 20}" cy="134" r="2" fill="#fff6d0"/>`;
    }
    // 遮陽棚
    s += `<path d="M24 186H376L370 206H30Z" fill="${city.awn}" ${O}/>`;
    for (let i = 0; i < 22; i++) { const x = 30 + i * 15.5; if (i % 2) s += `<path d="M${x} 186H${x + 15.5}L${x + 15.2} 206H${x + .3}Z" fill="#fff" opacity=".92"/>`; }
    for (let i = 0; i < 22; i++) { const x = 30 + i * 15.5; s += `<path d="M${x} 206a7.75 7.75 0 0 0 15.5 0Z" fill="${i % 2 ? '#fff' : city.awn}" ${O2}/>`; }
    // 一樓：櫥窗 + 大門
    const shopWin = (x, dc) => `<rect x="${x}" y="230" width="108" height="94" rx="4" fill="url(#gGlass)" stroke="url(#gGold)" stroke-width="3"/>
      <path d="M${x + 30} 230L${x + 54} 324H${x + 6}Z" fill="#fff" opacity=".35"/>
      <rect x="${x + 4}" y="314" width="100" height="8" fill="#f1d3b9"/>
      <circle cx="${x + 54}" cy="252" r="6.5" fill="${SKIN}" ${O2}/><path d="M${x + 54} 258v6" stroke="${SKIN}" stroke-width="4"/>
      <path d="M${x + 44} 264H${x + 64}L${x + 74} 312H${x + 34}Z" fill="${dc}" ${O2}/><path d="M${x + 54} 312v4" stroke="#b08a4c" stroke-width="2"/>
      <path d="M${x + 82} 300h16l2 14h-20z" fill="#e0628a" ${O2}/><path d="M${x + 86} 300q4-8 8 0" stroke="#7b3b2e" fill="none" stroke-width="1.6"/>
      <path d="M${x + 10} 304l6-8 6 8z" fill="#9a7ad9" ${O2}/>`;
    s += shopWin(40, '#d3365f') + shopWin(252, '#2a265c');
    s += `<rect x="150" y="226" width="16" height="130" fill="#fffaf6" ${O}/><rect x="234" y="226" width="16" height="130" fill="#fffaf6" ${O}/>`;
    s += `<rect x="147" y="222" width="22" height="7" fill="url(#gGold)"/><rect x="231" y="222" width="22" height="7" fill="url(#gGold)"/>`;
    s += `<path d="M168 356V262a32 32 0 0 1 64 0V356Z" fill="url(#gGlass)" stroke="url(#gGold)" stroke-width="3.4"/>`;
    s += `<path d="M200 230V356M168 290H232" stroke="url(#gGold)" stroke-width="1.6" opacity=".8"/><circle cx="194" cy="318" r="2.4" fill="url(#gGold)"/><circle cx="206" cy="318" r="2.4" fill="url(#gGold)"/>`;
    s += `<text x="200" y="262" text-anchor="middle" font-family="Bodoni Moda, Didot, Georgia, serif" font-style="italic" font-weight="700" font-size="18" fill="#c9a35b" opacity=".75">E</text>`;
    s += `<path d="M176 234Q200 214 224 234" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none"/>`;
    // 台階與廣場
    s += `<rect x="0" y="356" width="400" height="114" fill="#f6e8e6"/>`;
    for (let x = -120; x < 420; x += 34) s += `<path d="M${x} 470L${x + 110} 356" stroke="#e6cfd2" stroke-width="1"/>`;
    s += `<rect x="140" y="356" width="120" height="8" fill="#fffaf6" ${O2}/><rect x="130" y="364" width="140" height="8" fill="#fbefee" ${O2}/>`;
    s += `<path d="M176 356H224L292 470H108Z" fill="url(#gCarpet)"/><path d="M176 356L108 470M224 356L292 470" stroke="url(#gGold)" stroke-width="2.4"/>`;
    // 紅龍柱
    const post = (x, y, h) => `<rect x="${x - 2.2}" y="${y - h}" width="4.4" height="${h}" fill="url(#gGold)"/><circle cx="${x}" cy="${y - h}" r="3.6" fill="url(#gGold)"/><ellipse cx="${x}" cy="${y}" rx="7" ry="2.4" fill="url(#gGold)"/>`;
    s += post(146, 400, 30) + post(112, 450, 34) + post(254, 400, 30) + post(288, 450, 34);
    s += `<path d="M146 374Q124 400 112 420M254 374Q276 400 288 420" stroke="#9e1f3f" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    // 盆栽
    const topi = x => `<path d="M${x - 14} 356h28l-4 22h-20z" fill="#fffaf6" ${O}/><rect x="${x - 15}" y="352" width="30" height="5" fill="url(#gGold)"/><path d="M${x} 352v-10" stroke="#6b4a2e" stroke-width="2.4"/>
      <circle cx="${x}" cy="330" r="17" fill="#79b38b" ${O}/><circle cx="${x - 6}" cy="324" r="6" fill="#95c9a3" opacity=".8"/><g fill="#ffb3c9"><circle cx="${x + 7}" cy="326" r="2"/><circle cx="${x - 8}" cy="336" r="2"/><circle cx="${x + 4}" cy="338" r="1.6"/></g>`;
    s += topi(20) + topi(380);
    return `<svg viewBox="0 0 400 470" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="gSkyStage" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${city.sky[0]}"/><stop offset="1" stop-color="${city.sky[1]}"/></linearGradient></defs>${s}</svg>`;
  }

  // ---------- 樓層圖示 ----------
  function floorIcon(key, tint) {
    let g = '';
    switch (key) {
      case 'lipstick': g = `<rect x="18" y="26" width="12" height="14" rx="1.5" fill="url(#gGold)" ${O2}/><rect x="19.5" y="19" width="9" height="8" fill="#e8c27a" ${O2}/><path d="M19.5 19V12L28.5 8V19Z" fill="#d3365f" ${O2}/><path d="M21.5 18v-5" stroke="#fff" stroke-opacity=".6" stroke-width="1.4"/>`; break;
      case 'perfume': g = `<rect x="21" y="9" width="6" height="7" rx="1" fill="url(#gGold)" ${O2}/><rect x="13" y="16" width="22" height="22" rx="6" fill="#e9b6e8" fill-opacity=".9" ${O2}/><rect x="17" y="21" width="14" height="10" rx="2" fill="#fff" fill-opacity=".55"/><path d="M27 12h6l3-2" stroke="#b07fb0" stroke-width="1.4" fill="none"/><circle cx="37.5" cy="9.5" r="2.6" fill="#d3365f"/>`; break;
      case 'handbag': g = `<path d="M18 20c0-9 12-9 12 0" stroke="#7b3b2e" stroke-width="2.6" fill="none"/><path d="M11 19h26l3 20H8z" fill="#e0628a" ${O2}/><path d="M11 19h26l-1.2 7H12.2z" fill="#c24873"/><rect x="21.5" y="24" width="5" height="5" rx="1" fill="url(#gGold)"/>`; break;
      case 'heel': g = `<path d="M7 33C14 33 22 30 28 22L33 15C35 13 39 14 39 17L40 36H36L34.5 26C30 31 24 37 16 38H8C6 38 5.5 33 7 33Z" fill="#26171f" ${O2}/><path d="M8 38h8M36 36h4" stroke="#d71e3c" stroke-width="2"/><path d="M30 20l4-4" stroke="#fff" stroke-opacity=".5" stroke-width="1.4"/>`; break;
      case 'diamond': g = `<path d="M15 12h18l7 9-16 18L8 21z" fill="#cfe6fb" ${O2}/><path d="M8 21h32M19 12l-3 9 8 18 8-18-3-9M16 21l8-9 8 9" stroke="#7aa6d6" stroke-width="1" fill="none"/><path d="${star4(37, 10, 3.4)}" fill="#fff"/>`; break;
      case 'gown': g = `<path d="M24 6v4M18 12q6-6 12 0" stroke="#b08a4c" stroke-width="1.6" fill="none"/><path d="M19 13h10l-1 9 9 18H11l9-18z" fill="#d3365f" ${O2}/><path d="M19 22h10" stroke="#f6b3c5" stroke-width="2"/>`; break;
      case 'watch': g = `<rect x="19" y="6" width="10" height="36" rx="3" fill="#7b3b2e"/><circle cx="24" cy="24" r="11" fill="url(#gGold)" ${O2}/><circle cx="24" cy="24" r="8" fill="#fffaf3"/><path d="M24 18.5V24l3.6 2.2" stroke="#2e1f27" stroke-width="1.4" stroke-linecap="round" fill="none"/>`; break;
      case 'cake': g = `<ellipse cx="24" cy="15" rx="10" ry="5" fill="#f7a8c6" ${O2}/><rect x="14" y="15" width="20" height="3" fill="#fff6e8"/><ellipse cx="24" cy="21" rx="10" ry="5" fill="#f7a8c6" ${O2}/><ellipse cx="24" cy="29" rx="10" ry="5" fill="#bfe8d7" ${O2}/><rect x="14" y="29" width="20" height="3" fill="#fff6e8"/><ellipse cx="24" cy="35" rx="10" ry="5" fill="#bfe8d7" ${O2}/>`; break;
      case 'lotus': g = `<path d="M24 12c6 6 6 16 0 24-6-8-6-18 0-24z" fill="#f7a8c6" ${O2}/><path d="M24 36C16 34 10 28 10 20c7 1 12 7 14 16zM24 36c8-2 14-8 14-16-7 1-12 7-14 16z" fill="#fbc4d6" ${O2}/><path d="M10 38h28" stroke="#79b38b" stroke-width="2.4" stroke-linecap="round"/>`; break;
      case 'ring': g = `<circle cx="24" cy="29" r="10" fill="none" stroke="url(#gGold)" stroke-width="3.4"/><path d="M19 15h10l3 4-8 7-8-7z" fill="#eaf5ff" ${O2}/><path d="${star4(36, 12, 3)}" fill="#fff"/>`; break;
      case 'champagne': g = `<path d="M14 8h9l-1 12c0 3-3 5-4 5s-4-2-4-5z" fill="#f3d98f" ${O2} transform="rotate(-12 18 20)"/><path d="M25 8h9l-1 12c0 3-3 5-4 5s-4-2-4-5z" fill="#f3d98f" ${O2} transform="rotate(12 30 20)"/><path d="M16 26v12M32 26v12M12 39h9M28 39h9" stroke="#b08a4c" stroke-width="1.6"/><path d="${star4(24, 7, 3)}" fill="#fff"/>`; break;
      case 'jet': g = `<path d="M6 26l30-4c4-.6 7 1 7 2s-3 2.6-7 2l-30 2z" fill="#fffaf6" ${O2}/><path d="M20 23l-6-12h4l10 11zM20 28l-6 11h4l10-11zM8 24l-3-6h3l4 6z" fill="#d6dcf2" ${O2}/><path d="M36 23.4h3" stroke="#5b7ec6" stroke-width="1.6"/>`; break;
    }
    return `<svg class="fi" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="${tint}"/><circle cx="24" cy="24" r="23" fill="none" stroke="#c9a35b" stroke-opacity=".55"/>${g}</svg>`;
  }

  // ---------- 福袋禮盒 ----------
  function giftBox() {
    return `<svg class="giftbox" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="112" r="92" fill="url(#gGlow)"/>
      <g class="box-body"><rect x="40" y="92" width="120" height="82" rx="6" fill="url(#gBox)" ${O}/><rect x="92" y="92" width="16" height="82" fill="url(#gGold)"/><path d="M40 108h120" stroke="#fff" stroke-opacity=".25" stroke-width="4"/></g>
      <g class="box-lid"><rect x="32" y="72" width="136" height="26" rx="6" fill="url(#gBoxLid)" ${O}/><rect x="92" y="72" width="16" height="26" fill="url(#gGold)"/>
        <path d="M100 72C84 46 58 50 66 64 72 74 92 74 100 72Z" fill="url(#gGold)" ${O}/><path d="M100 72C116 46 142 50 134 64 128 74 108 74 100 72Z" fill="url(#gGold)" ${O}/><circle cx="100" cy="70" r="8" fill="url(#gGoldH)" ${O}/></g>
      <path d="M150 120l14 18-8 2z" fill="url(#gGold)"/><rect x="146" y="136" width="30" height="20" rx="3" transform="rotate(12 161 146)" fill="#fffaf6" ${O2}/><text x="161" y="150" transform="rotate(12 161 146)" text-anchor="middle" font-family="Bodoni Moda, Didot, Georgia, serif" font-style="italic" font-weight="700" font-size="10" fill="#c23767">ERIKA</text>
      <g fill="#fff"><path class="tw" d="${star4(30, 50, 7)}"/><path class="tw" style="animation-delay:.6s" d="${star4(172, 40, 6)}"/><path class="tw" style="animation-delay:1.1s" d="${star4(178, 100, 4)}"/><path class="tw" style="animation-delay:.3s" d="${star4(22, 120, 4)}"/></g>
    </svg>`;
  }

  // ---------- 儲值方案圖（粉鑽堆） ----------
  function packArt(n) {
    const sets = {
      1: [[50, 56, 34]],
      2: [[38, 60, 30], [62, 56, 32]],
      3: [[30, 64, 26], [70, 64, 26], [50, 50, 32]],
      4: [[26, 68, 24], [74, 68, 24], [40, 50, 28], [62, 48, 30]],
      5: [[20, 70, 22], [80, 70, 22], [36, 56, 26], [64, 56, 26], [50, 40, 30]],
      6: [[18, 70, 22], [82, 70, 22], [34, 58, 24], [66, 58, 24], [50, 66, 26], [50, 38, 32]],
    }[n];
    let g = '';
    if (n >= 5) g += `<ellipse cx="50" cy="84" rx="44" ry="9" fill="url(#gGold)" ${O2}/>`;
    else g += `<ellipse cx="50" cy="86" rx="34" ry="6" fill="#d9a7bd" opacity=".35"/>`;
    for (const [x, y, s] of sets) g += `<use href="#sGem" x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}"/>`;
    if (n >= 3) g += `<path d="${star4(84, 22, 5)}" fill="#fff"/>`;
    if (n >= 6) g += `<path d="${star4(14, 30, 4)}" fill="#fff"/>`;
    return `<svg class="pk" viewBox="0 0 100 96" aria-hidden="true">${g}</svg>`;
  }

  // ---------- 小圖示（線條） ----------
  const ICONS = {
    home: '<path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M9.5 20v-5h5v5M3 10.5h18"/>',
    floors: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 8h14M5 13h14M9 21v-3h6v3"/>',
    wardrobe: '<path d="M12 4.5a2 2 0 1 1 2 2c-1.2 0-2 .8-2 2l8.5 6.2a1.3 1.3 0 0 1-.8 2.3H4.3a1.3 1.3 0 0 1-.8-2.3L12 8.5"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9C10 5 6.5 5 7 7.5 7.4 9 12 9 12 9zm0 0c2-4 5.5-4 5-1.5-.4 1.5-5 1.5-5 1.5z"/>',
    gem: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M10 4 8.5 9 12 20l3.5-11L14 4"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7l-1-3h-5z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    pin: '<path d="M12 21s-6-5.6-6-10.5A6 6 0 0 1 18 10.5C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
    hand: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5c0 3.6-2.4 6.5-6 6.5-2.4 0-3.8-1.2-5-3l-2.4-3.8a1.4 1.4 0 0 1 2.3-1.6L9 14"/><path d="M4 4l1.5 1.5M7.5 2.5V4.5M2.5 7.5h2"/>',
    x2: '<circle cx="12" cy="12" r="9"/><path d="M7.5 9.5l4 5M11.5 9.5l-4 5M13.5 10.2a1.8 1.8 0 1 1 3.3 1c-.7 1-3.3 3.3-3.3 3.3h3.6"/>',
    butler: '<circle cx="12" cy="7" r="3.2"/><path d="M5 21c0-4.4 3.1-7.5 7-7.5s7 3.1 7 7.5M9.5 15.5 12 17l2.5-1.5L12 14z"/>',
    clock: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    scroll: '<path d="M7 4h11a2 2 0 0 1 2 2v1H9V6a2 2 0 0 0-2-2zm0 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M9 11h7M9 14.5h7M9 18h4"/>',
    castle: '<path d="M4 21V9l2.5-1.5L9 9v3h6V9l2.5-1.5L20 9v12z"/><path d="M10 21v-4.5a2 2 0 0 1 4 0V21M4 9V5.5M20 9V5.5M12 12V4l3 1.5-3 1.5"/>',
    play: '<rect x="3.5" y="6.5" width="9.5" height="13.5" rx="1.6" transform="rotate(-12 8 13)"/><rect x="10.5" y="3.5" width="9.5" height="13.5" rx="1.6" transform="rotate(8 15 10)"/><path d="M15.2 7.6l1 2 2.1.3-1.5 1.5.4 2.1-2-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z"/>',
    plane: '<path d="M3 13.5l7-1.5 4-8h2l-1.5 8 5 .5 1.5-2H22l-1 4.5-1 4.5h-1l-1.5-2-5 .5L14 26"/>',
  };
  const icon = (k, cls = 'li') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ''}</svg>`;

  function inject() { if (!document.getElementById('gGem')) document.body.insertAdjacentHTML('afterbegin', SHARED); }

  return { inject, avatar, itemIcon, facade, floorIcon, giftBox, packArt, gem, coin, ticket, icon, star4 };
})();
