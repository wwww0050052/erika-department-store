// 撲克牌共用模組（貴婦妞妞、名媛十三支共用）
// 內容：牌組與洗牌（純函式）、精品撲克牌 SVG（象牙白牌面＋金邊、玫瑰紅／梅紫花色、程式繪製的 J/Q/K 徽章、ERIKA 金色 E 字牌背）、
//       發牌飛出／3D 翻牌／FLIP 移位動畫、籌碼與籌碼飛行、玫瑰花瓣特效、標題畫面／結算面板／對話泡泡／引導泡泡／底部面板等共用介面。
// 透過 window.ErikaCards 分享給 niuniu.js、poker13.js（本檔在它們之前載入）。
// 注意：本檔最上層不碰 DOM，方便 node 用 vm 載入做單元測試。
'use strict';
(() => {
  const W = typeof window !== 'undefined' ? window : globalThis;

  // ================= 牌組（純函式） =================
  // 一張牌 = { r, s }：r 點數 2..14（11=J、12=Q、13=K、14=A），s 花色 0..3（0 方塊 ♦、1 梅花 ♣、2 紅心 ♥、3 黑桃 ♠；數字越大花色越大）
  const RT = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const SUIT = ['♦', '♣', '♥', '♠'];
  const SUIT_ZH = ['方塊', '梅花', '紅心', '黑桃'];
  const isRed = s => s === 0 || s === 2;
  function deck() { const d = []; for (let s = 3; s >= 0; s--) for (let r = 14; r >= 2; r--) d.push({ r, s }); return d; }
  // 可重現的亂數（測試與重播用）
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(a, rnd = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const cid = c => c.r * 4 + c.s;
  const label = c => SUIT[c.s] + RT[c.r];
  const zh = c => SUIT_ZH[c.s] + RT[c.r];
  const byRank = (a, b) => b.r - a.r || b.s - a.s;
  const bySuit = (a, b) => b.s - a.s || b.r - a.r;
  // 'AS KH 10D TC 9c ♠Q' → 牌陣列（測試用）
  function parse(str) {
    return String(str).trim().split(/[\s,]+/).filter(Boolean).map(tok => {
      let t = tok.toUpperCase();
      const sm = { D: 0, C: 1, H: 2, S: 3, '♦': 0, '♣': 1, '♥': 2, '♠': 3 };
      let s, rs;
      if (sm[t[0]] != null && t.length > 1 && !/^[0-9TJQKA]/.test(t)) { s = sm[t[0]]; rs = t.slice(1); } else { s = sm[t[t.length - 1]]; rs = t.slice(0, -1); }
      const r = { A: 14, K: 13, Q: 12, J: 11, T: 10 }[rs] || +rs;
      if (s == null || !(r >= 2 && r <= 14)) throw new Error('看不懂的牌：' + tok);
      return { r, s };
    });
  }

  // ================= 精品撲克牌（SVG） =================
  const FONT = `'Bodoni Moda','Didot','Bodoni 72',Georgia,serif`;
  const TXT = `font-family="${FONT}" font-weight="700"`;
  const SUIT_SHAPE = [
    '<path d="M0-10C2.4-6.4 5.2-3.2 8 0 5.2 3.2 2.4 6.4 0 10-2.4 6.4-5.2 3.2-8 0-5.2-3.2-2.4-6.4 0-10Z"/>',
    '<circle cx="0" cy="-4.8" r="4.4"/><circle cx="-5" cy="1.6" r="4.4"/><circle cx="5" cy="1.6" r="4.4"/><circle cx="0" cy=".4" r="2.4"/><path d="M-1.6 0H1.6C1.2 4.4 2 7.6 3.8 9.8H-3.8C-2 7.6-1.2 4.4-1.6 0Z"/>',
    '<path d="M0 9.4C-1.4 7.4-9.8 2.6-9.8-3.2-9.8-6.9-7.2-9.4-4.6-9.4-2.6-9.4-.9-8.2 0-6.4.9-8.2 2.6-9.4 4.6-9.4 7.2-9.4 9.8-6.9 9.8-3.2 9.8 2.6 1.4 7.4 0 9.4Z"/>',
    '<path d="M0-9.6C-1.4-7.6-9.6-3-9.6 2.6-9.6 5.6-7.4 7.6-4.8 7.6-3 7.6-1.6 6.8-.8 5.6-.9 7.6-1.9 8.9-3.6 9.8H3.6C1.9 8.9.9 7.6.8 5.6 1.6 6.8 3 7.6 4.8 7.6 7.4 7.6 9.6 5.6 9.6 2.6 9.6-3 1.4-7.6 0-9.6Z"/>',
  ];
  const GLOSS = ['<ellipse cx="-2.6" cy="-4.6" rx="1.5" ry="3.2" fill="#fff" opacity=".35" transform="rotate(30 -2.6 -4.6)"/>',
    '<ellipse cx="-1.6" cy="-6.4" rx="2" ry="1.1" fill="#fff" opacity=".3" transform="rotate(-30 -1.6 -6.4)"/>',
    '<ellipse cx="-5.4" cy="-5.6" rx="2.4" ry="1.4" fill="#fff" opacity=".38" transform="rotate(-35 -5.4 -5.6)"/>',
    '<ellipse cx="-4.6" cy="0" rx="2.2" ry="1.3" fill="#fff" opacity=".26" transform="rotate(-50 -4.6 0)"/>'];
  const diamond = (x, y, s) => `<path d="M${x} ${y - s}L${x + s * 0.7} ${y}L${x} ${y + s}L${x - s * 0.7} ${y}Z"/>`;
  const DEFS = `<svg class="ec-defs" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>
<linearGradient id="ecg-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1c4"/><stop offset=".32" stop-color="#e6c06c"/><stop offset=".62" stop-color="#ad7f33"/><stop offset="1" stop-color="#f1d184"/></linearGradient>
<linearGradient id="ecg-goldv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3cf"/><stop offset=".5" stop-color="#e2bb66"/><stop offset="1" stop-color="#a87a2e"/></linearGradient>
<linearGradient id="ecg-ivory" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#fffdf8"/><stop offset=".6" stop-color="#fbf4e6"/><stop offset="1" stop-color="#f1e4cc"/></linearGradient>
<linearGradient id="ecg-rose" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ee6a92"/><stop offset=".55" stop-color="#cf3567"/><stop offset="1" stop-color="#99204a"/></linearGradient>
<linearGradient id="ecg-plum" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d4b93"/><stop offset=".55" stop-color="#55275f"/><stop offset="1" stop-color="#35112c"/></linearGradient>
<radialGradient id="ecg-back" cx=".5" cy=".45" r=".78"><stop offset="0" stop-color="#a23462"/><stop offset=".55" stop-color="#651a3d"/><stop offset="1" stop-color="#2d0a1e"/></radialGradient>
<radialGradient id="ecg-med" cx=".45" cy=".35" r=".8"><stop offset="0" stop-color="#7a2149"/><stop offset="1" stop-color="#2a0819"/></radialGradient>
<radialGradient id="ecg-gem" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffe0ec"/><stop offset=".5" stop-color="#f06d9c"/><stop offset="1" stop-color="#8a2d9a"/></radialGradient>
<linearGradient id="ecg-petal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd3e2"/><stop offset=".5" stop-color="#f06d9c"/><stop offset="1" stop-color="#b3265a"/></linearGradient>
<pattern id="ecp-lat" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="translate(1 1)"><path d="M6 .8 11.2 6 6 11.2.8 6Z" fill="none" stroke="#e8c97c" stroke-opacity=".38" stroke-width=".5"/><text x="6" y="8.1" text-anchor="middle" font-size="5.6" font-style="italic" ${TXT} fill="#e8c97c" fill-opacity=".55">E</text></pattern>
${SUIT_SHAPE.map((p, s) => `<symbol id="ecs${s}" viewBox="-10.5 -10.5 21 21"><g fill="url(#ecg-${isRed(s) ? 'rose' : 'plum'})">${p}</g>${GLOSS[s]}</symbol>`).join('')}
<symbol id="ecc-crown" viewBox="-20 -16 40 32"><path d="M-15 8-17.5-8.5-8 0 0-12.5 8 0 17.5-8.5 15 8Z" fill="url(#ecg-gold)" stroke="#8a6424" stroke-width=".8" stroke-linejoin="round"/><rect x="-15.8" y="7.4" width="31.6" height="5.6" rx="1.6" fill="url(#ecg-goldv)" stroke="#8a6424" stroke-width=".8"/><circle cx="0" cy="-13" r="2.3" fill="#fff6d8" stroke="#8a6424" stroke-width=".6"/><circle cx="-17.6" cy="-9" r="1.9" fill="#fff6d8" stroke="#8a6424" stroke-width=".6"/><circle cx="17.6" cy="-9" r="1.9" fill="#fff6d8" stroke="#8a6424" stroke-width=".6"/><path d="M0-4.4C2.6-1.2 2.6 2 0 3.8-2.6 2-2.6-1.2 0-4.4Z" fill="url(#ecg-gem)" stroke="#fff4cf" stroke-width=".5"/><circle cx="-8" cy="10.2" r="1.5" fill="#d6457a"/><circle cx="0" cy="10.2" r="1.8" fill="#7d4bc4"/><circle cx="8" cy="10.2" r="1.5" fill="#d6457a"/><path d="M-13 6.2H13" stroke="#fff4cf" stroke-opacity=".7" stroke-width=".6"/></symbol>
<symbol id="ecc-tiara" viewBox="-20 -16 40 32"><path d="M-17 10.5Q0 2.5 17 10.5L16 13.8Q0 6.6-16 13.8Z" fill="url(#ecg-goldv)" stroke="#8a6424" stroke-width=".7"/><path d="M-15 9Q-12.5-2-6.5 4.4Q0-15 6.5 4.4Q12.5-2 15 9" fill="none" stroke="url(#ecg-gold)" stroke-width="2.4" stroke-linecap="round"/><path d="M-15 9Q-12.5-2-6.5 4.4Q0-15 6.5 4.4Q12.5-2 15 9" fill="none" stroke="#8a6424" stroke-width=".5" stroke-opacity=".7"/><g fill="#fff8ec" stroke="#b08a48" stroke-width=".4"><circle cx="-12.4" cy="1.6" r="1.5"/><circle cx="12.4" cy="1.6" r="1.5"/><circle cx="-6.5" cy="4.2" r="1.2"/><circle cx="6.5" cy="4.2" r="1.2"/><circle cx="0" cy="-12" r="2.2"/></g><path d="M0 4.6C-1-0.2-5.6-2-5.6-5.4-5.6-7.6-3.8-8.6-2.5-8.6-1.4-8.6-.4-7.9 0-7 .4-7.9 1.4-8.6 2.5-8.6 3.8-8.6 5.6-7.6 5.6-5.4 5.6-2 1-0.2 0 4.6Z" fill="url(#ecg-gem)" stroke="#fff4cf" stroke-width=".5"/></symbol>
<symbol id="ecc-crest" viewBox="-16 -18 32 36"><path d="M-9.5-8C-15-6-16 0-13.5 6M9.5-8C15-6 16 0 13.5 6" fill="none" stroke="#5f8f5c" stroke-width="1.1"/><g fill="#6fa36a">${[[-14.2, -4, -60], [-15, 1, -80], [-13.6, 5.6, -110], [14.2, -4, 60], [15, 1, 80], [13.6, 5.6, 110]].map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="1.4" ry="2.8" transform="rotate(${a} ${x} ${y})"/>`).join('')}</g><path d="M-11-14H11V0C11 8.4 6 13 0 16-6 13-11 8.4-11 0Z" fill="#fffaf0" stroke="url(#ecg-gold)" stroke-width="2.2"/><path d="M-8.6-11.6H8.6V0C8.6 6.8 4.6 10.6 0 13-4.6 10.6-8.6 6.8-8.6 0Z" fill="none" stroke="#c9a35b" stroke-width=".6"/><path d="M-6-17.2-3.2-14.6 0-17.8 3.2-14.6 6-17.2 5-14H-5Z" fill="url(#ecg-gold)" stroke="#8a6424" stroke-width=".4"/></symbol>
<symbol id="ecb" viewBox="0 0 100 140"><rect x="1" y="1" width="98" height="138" rx="9" fill="url(#ecg-back)"/><rect x="7" y="7" width="86" height="126" rx="5" fill="url(#ecp-lat)"/><rect x="7" y="7" width="86" height="126" rx="5" fill="none" stroke="#e8c97c" stroke-width="1"/><rect x="10.5" y="10.5" width="79" height="119" rx="3" fill="none" stroke="#e8c97c" stroke-opacity=".42" stroke-width=".6"/>
<g fill="none" stroke="url(#ecg-gold)" stroke-width="1.1" stroke-linecap="round"><path d="M50 37C43 31 34 33 33 40 32.4 44 36 46 38.4 44"/><path d="M50 37C57 31 66 33 67 40 67.6 44 64 46 61.6 44"/><path d="M50 103C43 109 34 107 33 100 32.4 96 36 94 38.4 96"/><path d="M50 103C57 109 66 107 67 100 67.6 96 64 94 61.6 96"/></g>
<ellipse cx="50" cy="70" rx="22" ry="29" fill="url(#ecg-med)" stroke="url(#ecg-gold)" stroke-width="2"/><ellipse cx="50" cy="70" rx="18" ry="25" fill="none" stroke="#e8c97c" stroke-opacity=".55" stroke-width=".7" stroke-dasharray="1.2 1.8"/>
<text x="50.5" y="84.5" text-anchor="middle" font-size="42" font-style="italic" ${TXT} fill="url(#ecg-goldv)" stroke="#5a1636" stroke-width=".6">E</text>
<g fill="url(#ecg-gold)">${diamond(50, 35.5, 3)}${diamond(50, 104.5, 3)}${diamond(15, 15, 2.6)}${diamond(85, 15, 2.6)}${diamond(15, 125, 2.6)}${diamond(85, 125, 2.6)}</g>
<path d="M1 10Q1 1 10 1H90Q99 1 99 10V46C72 36 30 60 1 44Z" fill="#fff" opacity=".07"/><rect x="1" y="1" width="98" height="138" rx="9" fill="none" stroke="url(#ecg-gold)" stroke-width="2.2"/></symbol>
<symbol id="ecr" viewBox="-20 -20 40 40"><path d="M-3 9C-12 13-18 8-18.5 3-12 1.5-5.5 3.5-3 9Z" fill="#4c9a68"/><path d="M3 9C12 13 18 8 18.5 3 12 1.5 5.5 3.5 3 9Z" fill="#3f8a5c"/>${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-8.4" rx="7.4" ry="8.6" fill="#c8325f" transform="rotate(${a})"/>`).join('')}<circle r="9.6" fill="#e2557f"/><path d="M0-6.4C4.4-6.4 6.2-2.4 4.4 1 2.6 4.4-2.8 4.6-4.6 1.4-6 -1.4-4-4.4-1.2-4 1.4-3.6 2.2-1 .8.6-.4 2-2.4 1.4-2.2 0" fill="none" stroke="#8e1c43" stroke-width="1.3" stroke-linecap="round"/><ellipse cx="-3.6" cy="-5.6" rx="3" ry="1.6" fill="#fff" opacity=".25" transform="rotate(-30 -3.6 -5.6)"/></symbol>
</defs></svg>`;

  const useS = (s, x, y, size, rot) => `<use href="#ecs${s}" x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}"${rot ? ` transform="rotate(180 ${x} ${y})"` : ''}/>`;
  const FRAME = '<rect x="1" y="1" width="98" height="138" rx="9" fill="url(#ecg-ivory)"/><rect x="5.5" y="5.5" width="89" height="129" rx="5.5" fill="none" stroke="#c9a35b" stroke-opacity=".55" stroke-width=".8"/><rect x="1.1" y="1.1" width="97.8" height="137.8" rx="8.9" fill="none" stroke="url(#ecg-gold)" stroke-width="2.2"/>';
  const PIPS = {
    2: [[50, 30], [50, 110]],
    3: [[50, 30], [50, 70], [50, 110]],
    4: [[32, 30], [68, 30], [32, 110], [68, 110]],
    5: [[32, 30], [68, 30], [50, 70], [32, 110], [68, 110]],
    6: [[32, 30], [68, 30], [32, 70], [68, 70], [32, 110], [68, 110]],
    7: [[32, 30], [68, 30], [50, 50], [32, 70], [68, 70], [32, 110], [68, 110]],
    8: [[32, 30], [68, 30], [50, 50], [32, 70], [68, 70], [50, 90], [32, 110], [68, 110]],
    9: [[32, 30], [68, 30], [32, 56.7], [68, 56.7], [50, 70], [32, 83.3], [68, 83.3], [32, 110], [68, 110]],
    10: [[32, 30], [68, 30], [50, 43.3], [32, 56.7], [68, 56.7], [32, 83.3], [68, 83.3], [50, 96.7], [32, 110], [68, 110]],
  };
  const EMB = { 11: 'ecc-crest', 12: 'ecc-tiara', 13: 'ecc-crown' };
  const colOf = s => (isRed(s) ? '#b3264f' : '#46194f');
  function corner(c) {
    const R = RT[c.r], ten = R === '10', col = colOf(c.s);
    return `<text x="12.5" y="25" text-anchor="middle" font-size="${ten ? 18 : 22}"${ten ? ' letter-spacing="-2.2"' : ''} fill="${col}" ${TXT}>${R}</text>${useS(c.s, 12.5, 34.5, 12)}`;
  }
  function faceSVG(c, mini) {
    const R = RT[c.r], col = colOf(c.s), red = isRed(c.s);
    let g = FRAME;
    if (mini) {
      const ten = R === '10';
      g += `<text x="${ten ? 5 : 9}" y="38" font-size="${ten ? 31 : 38}"${ten ? ' letter-spacing="-3.5"' : ''} fill="${col}" ${TXT}>${R}</text>${useS(c.s, 19, 53, 22)}`;
      if (EMB[c.r]) g += `<use href="#${EMB[c.r]}" x="38" y="78" width="54" height="${c.r === 11 ? 54 : 43}"/>${c.r === 11 ? useS(c.s, 65, 101, 16) : ''}`;
      else g += useS(c.s, 66, 102, 46);
    } else {
      g += corner(c) + `<g transform="rotate(180 50 70)">${corner(c)}</g>`;
      if (c.r <= 10) {
        const sz = c.r >= 9 ? 18 : 20;
        for (const [x, y] of PIPS[c.r]) g += useS(c.s, x, y, sz, y > 70);
      } else if (c.r === 14) {
        g += `<circle cx="50" cy="70" r="30" fill="none" stroke="url(#ecg-gold)" stroke-width="1.6"/><circle cx="50" cy="70" r="26" fill="${red ? '#fdecf1' : '#f3ebf6'}" stroke="#c9a35b" stroke-opacity=".7" stroke-width=".6" stroke-dasharray="1.2 2.2"/><g fill="url(#ecg-gold)">${diamond(50, 40, 3.4)}${diamond(50, 100, 3.4)}${diamond(20, 70, 3)}${diamond(80, 70, 3)}</g>${useS(c.s, 50, 70, 38)}<text x="50" y="118.5" text-anchor="middle" font-size="7" letter-spacing="2.4" font-style="italic" fill="#9c742f" ${TXT}>ERIKA</text>`;
      } else {
        const j = c.r === 11;
        const half = `<use href="#${EMB[c.r]}" x="${j ? 37 : 32}" y="${j ? 18.5 : 20}" width="${j ? 26 : 36}" height="${j ? 29 : 28.8}"/>${j ? useS(c.s, 50, 32.4, 9.5) : ''}<text x="50" y="66" text-anchor="middle" font-size="22" font-style="italic" fill="${col}" ${TXT}>${R}</text>${useS(c.s, 26.5, 27, 8)}${useS(c.s, 73.5, 27, 8)}`;
        g += `<rect x="18" y="16" width="64" height="108" rx="5" fill="${red ? '#fde9ef' : '#f2e9f5'}" stroke="url(#ecg-gold)" stroke-width="1.3"/><rect x="21" y="19" width="58" height="102" rx="3.5" fill="none" stroke="${col}" stroke-opacity=".22" stroke-width=".6"/>${half}<path d="M22 70H44M56 70H78" stroke="url(#ecg-gold)" stroke-width=".9"/><path d="M50 66.4 53.6 70 50 73.6 46.4 70Z" fill="url(#ecg-gold)"/><g transform="rotate(180 50 70)">${half}</g>`;
      }
    }
    return `<svg class="ec-svg" viewBox="0 0 100 140" aria-hidden="true">${g}</svg>`;
  }
  const BACK = '<svg class="ec-svg" viewBox="0 0 100 140" aria-hidden="true"><use href="#ecb" width="100" height="140"/></svg>';
  const CHIP = [['#e0628a', '#a92b58'], ['#8f63d6', '#4f2c8f'], ['#e7c272', '#9c742f'], ['#36a07a', '#155443']];
  function chipSVG(t = 0) {
    const [a, b] = CHIP[((t % 4) + 4) % 4];
    let ins = '';
    for (let i = 0; i < 8; i++) ins += `<rect x="-2.6" y="-19" width="5.2" height="6" rx="1" transform="rotate(${i * 45})"/>`;
    return `<svg viewBox="-20 -20 40 40" aria-hidden="true"><circle r="19.4" fill="${b}"/><circle r="18" fill="${a}"/><g fill="#fff7ea">${ins}</g><circle r="12.6" fill="${b}" stroke="#f6dc9a" stroke-width="1.3"/><circle r="10.3" fill="none" stroke="#f6dc9a" stroke-opacity=".6" stroke-width=".6" stroke-dasharray="1.4 1.6"/><text y="4.8" text-anchor="middle" font-size="13.5" font-style="italic" ${TXT} fill="#fff1c4">E</text><ellipse cx="-6" cy="-9.5" rx="7" ry="3.4" fill="#fff" opacity=".22" transform="rotate(-30 -6 -9.5)"/></svg>`;
  }

  // ================= DOM 小工具 =================
  let API = null;
  const reduced = () => !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function h(html) { const t = document.createElement('template'); t.innerHTML = String(html).trim(); return t.content.firstElementChild; }
  const ctr = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const settle = a => new Promise(res => { a.onfinish = () => res(); a.oncancel = () => res(); });
  function anim(el, kf, o) { if (!el || !el.animate) return Promise.resolve(); try { return settle(el.animate(kf, o)); } catch (e) { return Promise.resolve(); } }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (API ? API.fmt(n) : Math.round(n).toLocaleString('en-US'));
  const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));

  // 流程控制：關閉遊戲後所有等待都永遠不會完成（流程自然中止），速度可調（自動玩加速）
  function runner() {
    let alive = true;
    const timers = new Set();
    const hang = new Promise(() => {});
    const R = {
      speed: 1,
      get alive() { return alive; },
      sleep(ms) {
        if (!alive) return hang;
        return new Promise(res => { const t = setTimeout(() => { timers.delete(t); if (alive) res(); }, Math.max(0, ms * R.speed)); timers.add(t); });
      },
      wait(p) { return Promise.resolve(p).then(v => (alive ? v : hang)); },
      d(ms) { return ms * R.speed * (reduced() ? 0.45 : 1); },
      kill() { alive = false; timers.forEach(clearTimeout); timers.clear(); },
    };
    return R;
  }

  // 音效（透過主程式 WebAudio，自動遵守音效開關）
  const sfx = {
    deal(i = 0) { if (API) API.sound.hiss(0.05, 0.045, 5200 + (i % 3) * 300); },
    flip() { if (API) { API.sound.hiss(0.04, 0.035, 3400); API.sound.beep(1850, 0.045, 'triangle', 0.028, 0.02); } },
    chip(i = 0) { if (API) { API.sound.beep(2700 + (i % 4) * 210, 0.05, 'triangle', 0.03); API.sound.beep(4300, 0.03, 'sine', 0.018, 0.012); } },
    shuffle() { if (API) for (let i = 0; i < 9; i++) API.sound.hiss(0.05, 0.035, 4200 + (i % 2) * 900, i * 0.055); },
    pop() { if (API) API.sound.beep(1320, 0.08, 'sine', 0.06); },
    whoosh() { if (API) API.sound.hiss(0.22, 0.04, 1800); },
    sparkle() { if (API) [0, 4, 7, 12].forEach((n, i) => API.sound.beep(1318 * Math.pow(2, n / 12), 0.22, 'sine', 0.045, i * 0.05)); },
    sad() { if (API) { API.sound.beep(392, 0.22, 'triangle', 0.05); API.sound.beep(330, 0.3, 'triangle', 0.05, 0.16); } },
  };

  // ---------- 撲克牌元素 ----------
  // size：xs / sm（小牌，用迷你牌面）、md / lg（完整牌面）
  function cardEl(c, o = {}) {
    const size = o.size || 'md';
    const el = document.createElement('div');
    el.className = `ec-card ec-${size}${o.up ? ' up' : ''}${o.cls ? ' ' + o.cls : ''}`;
    el.innerHTML = `<div class="ec-in"><div class="ec-f ec-back">${BACK}</div><div class="ec-f ec-front"></div></div>`;
    if (c && o.face !== false) setFace(el, c);
    else el._card = c || null;
    return el;
  }
  function setFace(el, c) {
    el._card = c;
    el.dataset.cid = cid(c);
    el.setAttribute('aria-label', zh(c));
    const mini = el.classList.contains('ec-xs') || el.classList.contains('ec-sm');
    el.querySelector('.ec-front').innerHTML = faceSVG(c, mini);
  }
  function flip(el, up = true) { if (!el) return; if (up && !el.querySelector('.ec-front svg') && el._card) setFace(el, el._card); el.classList.toggle('up', up); }
  // 牌從 from（螢幕座標）飛到它在版面上的位置
  function dealFly(el, from, o = {}) {
    const r = el.getBoundingClientRect();
    const dx = from.x - (r.left + r.width / 2), dy = from.y - (r.top + r.height / 2);
    const sc = o.scale != null ? o.scale : (o.fromW ? o.fromW / r.width : 0.7);
    const rot = o.rot != null ? o.rot : rnd(-28, 28);
    el.classList.add('flying');
    const dur = o.dur || 360;
    return anim(el, [
      { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(${sc})`, opacity: o.fade === false ? 1 : 0 },
      { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(${sc})`, opacity: 1, offset: 0.06 },
      { transform: `translate(${dx * 0.12}px,${dy * 0.12 - 8}px) rotate(${rot * 0.15}deg) scale(1.05)`, offset: 0.82 },
      { transform: 'none', opacity: 1 },
    ], { duration: dur, delay: o.delay || 0, easing: 'cubic-bezier(.25,.75,.3,1)', fill: 'backwards' }).then(() => el.classList.remove('flying'));
  }
  // FLIP：記錄位置 → 改版面 → 從舊位置滑到新位置
  const rects = els => new Map([...els].map(e => [e, e.getBoundingClientRect()]));
  function flipFrom(before, o = {}) {
    const ps = [];
    for (const [el, r0] of before) {
      if (!el.isConnected) continue;
      const r1 = el.getBoundingClientRect();
      const dx = r0.left - r1.left, dy = r0.top - r1.top, sx = r0.width / (r1.width || 1), sy = r0.height / (r1.height || 1);
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01) continue;
      el.classList.add('flying');
      ps.push(anim(el, [{ transformOrigin: '0 0', transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }, { transformOrigin: '0 0', transform: 'none' }],
        { duration: o.dur || 280, delay: o.stagger ? ps.length * o.stagger : 0, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' }).then(() => el.classList.remove('flying')));
    }
    return Promise.all(ps);
  }

  // ---------- 籌碼 ----------
  function chipEl(t) { const i = document.createElement('i'); i.className = 'ec-chip'; i.innerHTML = chipSVG(t); return i; }
  function pileHTML(n, t0 = 0) { let s = ''; for (let i = 0; i < n; i++) s += `<i class="ec-chip" style="--i:${i}">${chipSVG(t0 + (i % 3 === 2 ? 2 : i % 2))}</i>`; return `<span class="ec-pile">${s}</span>`; }
  // 籌碼沿拋物線從 from 飛到 to（螢幕座標），layer = 遊戲內的特效層
  function flyChips(layer, from, to, n = 6, o = {}) {
    const lr = layer.getBoundingClientRect();
    const ps = [];
    n = Math.max(1, Math.min(14, n));
    for (let i = 0; i < n; i++) {
      const ch = chipEl(o.tier != null ? o.tier : i % 4);
      const x0 = from.x - lr.left + rnd(-12, 12), y0 = from.y - lr.top + rnd(-8, 8);
      const x1 = to.x - lr.left + rnd(-9, 9), y1 = to.y - lr.top + rnd(-6, 6) - i * 1.2;
      ch.style.left = x1 + 'px'; ch.style.top = y1 + 'px';
      layer.appendChild(ch);
      const lift = Math.max(40, Math.abs(x1 - x0) * 0.25 + 40);
      const kf = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8, x = (x0 - x1) * (1 - t), y = (y0 - y1) * (1 - t) - lift * 4 * t * (1 - t);
        kf.push({ transform: `translate(${x}px,${y}px) scale(${1 + 0.25 * Math.sin(Math.PI * t)}) rotate(${(1 - t) * 160}deg)`, opacity: k === 0 ? 0 : 1 });
      }
      const dur = o.dur || 600;
      ps.push(anim(ch, kf, { duration: dur, delay: i * (o.gap || 42), easing: 'cubic-bezier(.35,.1,.45,1)', fill: 'backwards' }).then(() => {
        sfx.chip(i);
        if (o.keep) return;
        return anim(ch, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.6)' }], { duration: 220, fill: 'forwards' }).then(() => ch.remove());
      }));
    }
    return Promise.all(ps);
  }

  // ---------- 特效 ----------
  // 玫瑰花瓣爆開（打槍用，代替彈孔，不暴力）
  function petals(layer, pt, n = 22) {
    const lr = layer.getBoundingClientRect();
    if (reduced()) n = Math.ceil(n / 3);
    const ps = [];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = 'ec-petal';
      p.innerHTML = '<svg viewBox="-10 -10 20 20"><path d="M0-9C6-6 7.5 3 0 9-7.5 3-6-6 0-9Z" fill="url(#ecg-petal)"/><path d="M0-7V6" stroke="#fff" stroke-opacity=".35" stroke-width=".7"/></svg>';
      p.style.left = (pt.x - lr.left) + 'px'; p.style.top = (pt.y - lr.top) + 'px';
      layer.appendChild(p);
      const a = rnd(0, Math.PI * 2), d = rnd(40, 120), dx = Math.cos(a) * d, dy = Math.sin(a) * d * 0.8;
      const s = rnd(0.6, 1.3), r0 = rnd(0, 360);
      ps.push(anim(p, [
        { transform: `translate(0,0) rotate(${r0}deg) scale(${s * 0.3})`, opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${r0 + 220}deg) scale(${s})`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx * 1.15 + rnd(-14, 14)}px,${dy + 70}px) rotate(${r0 + 400}deg) scale(${s * 0.9})`, opacity: 0 },
      ], { duration: rnd(1100, 1600), easing: 'cubic-bezier(.15,.7,.4,1)' }).then(() => p.remove()));
    }
    return Promise.all(ps);
  }
  // 在元素上蓋一朵玫瑰印章
  function roseStamp(host, o = {}) {
    const el = h(`<i class="ec-rose${o.cls ? ' ' + o.cls : ''}"><svg viewBox="-20 -20 40 40"><use href="#ecr" x="-20" y="-20" width="40" height="40"/></svg></i>`);
    if (o.x != null) { el.style.left = o.x; el.style.top = o.y; }
    host.appendChild(el);
    return el;
  }
  // 中央大字卡（開牌、打槍、全壘打…）
  function ribbon(layer, html, o = {}) {
    const el = h(`<div class="ec-ribbon ${o.cls || ''}"><div class="ec-rb-in">${html}</div></div>`);
    layer.appendChild(el);
    const ms = o.ms || 1100;
    return new Promise(res => setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); res(); }, 320); }, ms));
  }
  // 對話泡泡
  function bubble(host, text, o = {}) {
    if (!host) return null;
    host.querySelectorAll(':scope > .ec-bub').forEach(b => b.remove());
    const b = h(`<div class="ec-bub ${o.cls || ''}"></div>`);
    b.textContent = text;
    host.appendChild(b);
    setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 300); }, o.ms || 2300);
    return b;
  }
  // 數字跳動
  function countUp(el, to, ms = 700, f = fmt, from = 0) {
    return new Promise(res => {
      if (reduced() || ms <= 0) { el.textContent = f(to); res(); return; }
      const t0 = performance.now();
      const step = t => {
        if (!el.isConnected) { res(); return; }
        const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
        el.textContent = f(from + (to - from) * e);
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }
  // 底部滑出面板（規則、選項）→ 回傳按下的按鈕 id（點背景＝null）
  function sheet(host, o = {}) {
    return new Promise(res => {
      const el = h(`<div class="ec-dim ec-sheet-wrap"><div class="ec-sheet ${o.cls || ''}" role="dialog" aria-label="${esc(o.title || '')}">
        <div class="ec-sheet-grab"></div>${o.title ? `<h3>${o.title}</h3>` : ''}<div class="ec-sheet-body">${o.html || ''}</div>
        ${o.buttons && o.buttons.length ? `<div class="ec-sheet-acts">${o.buttons.map(b => `<button class="btn ${b.cls || ''}" data-b="${esc(b.id)}">${b.label}</button>`).join('')}</div>` : ''}</div></div>`);
      host.appendChild(el);
      const openedAt = performance.now();
      const close = v => { if (el.classList.contains('out')) return; el.classList.add('out'); setTimeout(() => el.remove(), 260); res(v); };
      el.addEventListener('click', e => {
        if (performance.now() - openedAt < 300) return;
        const b = e.target.closest('[data-b]');
        if (b) { if (API) API.sound.click(); close(b.dataset.b); return; }
        if (e.target === el && o.dismiss !== false) close(null);
      });
      if (o.onOpen) o.onOpen(el.querySelector('.ec-sheet'), close);
    });
  }
  // 第一次玩的引導泡泡（指向 target）
  function guide(host, target, html, o = {}) {
    return new Promise(res => {
      const hr = host.getBoundingClientRect(), tr = target ? target.getBoundingClientRect() : { left: hr.left + hr.width / 2 - 1, top: hr.top + hr.height / 2, width: 2, height: 2, bottom: hr.top + hr.height / 2 };
      const below = (tr.top - hr.top) < hr.height * 0.45;
      const el = h(`<div class="ec-guide ${below ? 'below' : 'above'}"><div class="ec-guide-box"><div class="ec-guide-txt">${html}</div><button class="btn goldb ec-guide-ok">${o.ok || '知道了'}</button></div></div>`);
      host.appendChild(el);
      const box = el.firstElementChild;
      const cx = tr.left + tr.width / 2 - hr.left;
      const bw = Math.min(300, hr.width - 24);
      const left = Math.max(12, Math.min(hr.width - bw - 12, cx - bw / 2));
      box.style.width = bw + 'px'; box.style.left = left + 'px';
      box.style.setProperty('--ax', (cx - left) + 'px');
      if (below) box.style.top = (tr.bottom - hr.top + 12) + 'px';
      else box.style.bottom = (hr.bottom - tr.top + 12) + 'px';
      if (target) target.classList.add('ec-spot');
      const openedAt = performance.now();
      el.addEventListener('click', e => {
        if (performance.now() - openedAt < 350) return;
        if (!e.target.closest('.ec-guide-ok') && e.target.closest('.ec-guide-box')) return;
        if (API) API.sound.click();
        el.classList.add('out'); if (target) target.classList.remove('ec-spot');
        setTimeout(() => el.remove(), 250); res();
      });
    });
  }

  // ---------- 桌別 ----------
  const TIERS = [
    { name: '新手桌', en: 'Débutante', mult: 1, note: '輕鬆小玩' },
    { name: '貴婦桌', en: 'Madame', mult: 10, note: '小賭怡情' },
    { name: '名媛桌', en: 'Élite', mult: 100, note: '一擲千金' },
  ];

  // ---------- 標題畫面 ----------
  // o: { theme:'wine'|'jade', eyebrow, title, en, tagline, chars:[{src,cls}], fan:[牌], tiers:[{name,en,stake,locked,need}], tier, stats:[[標籤,值]], start, onTier(i), onStart(), onRules() }
  function titleScreen(o) {
    const spk = Array.from({ length: 16 }, (_, i) => `<i style="left:${(i * 61) % 100}%;top:${(i * 37 + 11) % 70}%;animation-delay:${(i * 0.37) % 3}s;--s:${0.6 + (i % 4) * 0.25}"></i>`).join('');
    const el = h(`<div class="ec-ttl ${o.theme || 'wine'}">
      <div class="ec-felt ${o.theme || 'wine'}"></div><div class="ec-rays"></div><div class="ec-spks">${spk}</div>
      <div class="ec-ttl-chars">${(o.chars || []).map(c => `<img class="${c.cls || ''}" src="${c.src}" alt="" draggable="false">`).join('')}</div>
      <div class="ec-ttl-fan"></div>
      <div class="ec-ttl-head"><div class="ec-eyebrow">${o.eyebrow || ''}</div><h1>${o.title}</h1><div class="ec-en">${o.en || ''}</div>${o.tagline ? `<p class="ec-tag">${o.tagline}</p>` : ''}</div>
      <div class="ec-ttl-panel">
        <div class="ec-tiers" role="radiogroup" aria-label="選擇桌別"></div>
        <div class="ec-stats">${(o.stats || []).map(([k, v]) => `<div><b class="num">${v}</b><small>${k}</small></div>`).join('')}</div>
        <div class="ec-ttl-acts"><button class="btn ghost ec-rules-btn">規則</button><button class="btn goldb ec-start">${o.start || '開始'}<small class="ec-start-sub"></small></button></div>
      </div></div>`);
    const fan = el.querySelector('.ec-ttl-fan');
    const fc = o.fan || [];
    fc.forEach((c, i) => {
      const ce = cardEl(c, { size: 'md', up: true });
      const mid = (fc.length - 1) / 2, a = (i - mid) * 9;
      ce.style.setProperty('--a', a + 'deg');
      ce.style.setProperty('--dy', Math.abs(i - mid) * Math.abs(i - mid) * 3 + 'px');
      ce.style.animationDelay = (0.25 + i * 0.08) + 's';
      fan.appendChild(ce);
    });
    const tiersEl = el.querySelector('.ec-tiers');
    let cur = o.tier || 0;
    const drawTiers = () => {
      tiersEl.innerHTML = (o.tiers || []).map((t, i) => `<button class="ec-tier${i === cur ? ' on' : ''}${t.locked ? ' locked' : ''}" role="radio" aria-checked="${i === cur}" data-t="${i}">
        <em>${t.en}</em><b>${t.name}</b><span class="num">${t.locked ? `需 ${fmt(t.need)}` : (t.stakeLabel || '底注') + ' ' + fmt(t.stake)}</span></button>`).join('');
      const t = (o.tiers || [])[cur];
      el.querySelector('.ec-start-sub').textContent = t ? `${t.name}・${t.locked ? '金幣不足' : (t.stakeLabel || '底注') + ' ' + fmt(t.stake)}` : '';
      el.querySelector('.ec-start').classList.toggle('off', !!(t && t.locked));
    };
    drawTiers();
    tiersEl.addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      const i = +b.dataset.t;
      if (o.tiers[i].locked) { if (API) { API.sound.err(); API.shake(b); API.toast(`這一桌至少要有 ${fmt(o.tiers[i].need)} 金幣才能入座`); } return; }
      cur = i; if (API) API.sound.click(); drawTiers(); if (o.onTier) o.onTier(i);
    });
    el.querySelector('.ec-rules-btn').addEventListener('click', () => { if (API) API.sound.click(); if (o.onRules) o.onRules(); });
    el.querySelector('.ec-start').addEventListener('click', e => {
      const t = (o.tiers || [])[cur];
      if (t && t.locked) { if (API) { API.sound.err(); API.shake(e.currentTarget); API.toast('金幣不足，先換一張小一點的桌子吧'); } return; }
      if (o.onStart) o.onStart(cur);
    });
    return el;
  }

  // ---------- 結算面板 ----------
  // o: { tone:'win'|'big'|'lose'|'draw', title, sub, lines:[{img,name,desc,amt}], total, totalLabel, char:{img,name,line},
  //      buttons:[{id,label,cls}], auto:{ms,id}, speed }
  // 回傳 { el, choice: Promise<id>, totalEl }
  function resultPanel(host, o) {
    const sp = o.speed || 1;
    const rays = o.tone === 'win' || o.tone === 'big' ? '<div class="ec-res-rays"></div>' : '';
    const el = h(`<div class="ec-dim ec-res-wrap tone-${o.tone || 'draw'}"><div class="ec-res" role="dialog" aria-label="${esc(o.title)}">
      ${rays}<div class="ec-res-title"><span>${esc(o.title)}</span></div>${o.sub ? `<div class="ec-res-sub">${o.sub}</div>` : ''}
      <div class="ec-res-lines">${(o.lines || []).map(l => `<div class="ec-res-line">${l.img ? `<span class="ec-ava sm"><img src="${l.img}" alt=""></span>` : ''}<span class="ec-rl-n"><b>${esc(l.name)}</b>${l.desc ? `<small>${l.desc}</small>` : ''}</span><b class="ec-rl-a num ${l.amt > 0 ? 'pos' : l.amt < 0 ? 'neg' : ''}" data-v="${l.amt}">0</b></div>`).join('')}</div>
      <div class="ec-res-total"><small>${o.totalLabel || '本局輸贏'}</small><b class="num ${o.total > 0 ? 'pos' : o.total < 0 ? 'neg' : ''}">0</b></div>
      ${o.extras && o.extras.length ? `<div class="ec-res-extra">${o.extras.map(x => `<span class="${x.cls || ''}"><small>${esc(x.k)}</small><b class="num">${esc(x.v)}</b></span>`).join('')}</div>` : ''}
      ${o.char ? `<div class="ec-res-char"><img src="${o.char.img}" alt=""><div class="ec-res-say"><b>${esc(o.char.name)}</b>${esc(o.char.line)}</div></div>` : ''}
      <div class="ec-res-acts">${(o.buttons || []).map(b => `<button class="btn ${b.cls || ''}" data-b="${esc(b.id)}">${b.label}</button>`).join('')}</div>
      ${o.auto ? '<div class="ec-res-auto"><i></i></div>' : ''}
    </div></div>`);
    host.appendChild(el);
    const totalEl = el.querySelector('.ec-res-total b');
    const lines = [...el.querySelectorAll('.ec-res-line')];
    let resolved = false, resolveFn;
    const choice = new Promise(res => { resolveFn = res; });
    const finish = id => { if (resolved) return; resolved = true; el.classList.add('out'); setTimeout(() => el.remove(), 300); resolveFn(id); };
    const openedAt = performance.now();
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-b]');
      if (!b || performance.now() - openedAt < 400) return;
      if (API) API.sound.click();
      finish(b.dataset.b);
    });
    (async () => {
      await new Promise(r => setTimeout(r, 380 * sp));
      for (const [i, ln] of lines.entries()) {
        if (!el.isConnected) return;
        ln.classList.add('in');
        const a = ln.querySelector('.ec-rl-a');
        const v = +a.dataset.v;
        sfx.pop();
        countUp(a, v, 420 * sp, signed);
        await new Promise(r => setTimeout(r, (i < 6 ? 230 : 120) * sp));
      }
      el.querySelector('.ec-res-total').classList.add('in');
      await countUp(totalEl, o.total, 800 * sp, signed);
      const ex = el.querySelector('.ec-res-extra');
      if (ex) { ex.classList.add('in'); sfx.sparkle(); }
      if (o.onTotal) o.onTotal(totalEl);
      if (o.auto && !resolved) {
        const bar = el.querySelector('.ec-res-auto i');
        bar.style.transitionDuration = o.auto.ms + 'ms';
        requestAnimationFrame(() => { bar.style.width = '100%'; });
        setTimeout(() => finish(o.auto.id), o.auto.ms);
      }
    })();
    return { el, choice, totalEl, finish };
  }

  // ---------- 連動系統（主程式有實作才會動，沒有就安靜略過） ----------
  // o: { game:'niuniu'|'poker13', net, x, y, big:bool（妞妞牛牛以上／十三支打槍或全壘打）, shardIds:[對手 cast id] }
  // 回傳結算畫面要顯示的額外獎勵 [{k, v, cls}]
  function linkage(api, o) {
    const out = [];
    const has = f => typeof api[f] === 'function';
    const f = n => (typeof api.fmt === 'function' ? api.fmt(n) : fmt(n));
    try {
      if (has('event')) { api.event('card_round', { game: o.game, win: o.net > 0 }); if (o.net > 0) api.event('card_win', { game: o.game }); }
      const g = {};
      if (o.net > 0) { const ru = has('resUnit') ? api.resUnit() : 100; const ore = Math.max(1, Math.floor((ru > 0 ? ru : 100) * 0.3)); g.res = { ore }; out.push({ k: '寶石原石', v: '+' + f(ore), cls: 'ore' }); }
      if (o.big && o.shardIds && o.shardIds.length) {
        const id = o.shardIds[Math.floor(Math.random() * o.shardIds.length)];
        const c = (api.cast ? api.cast() : []).find(x => x.id === id);
        g.shards = { [id]: 1 };
        out.push({ k: `${c ? c.name : ''}碎片`, v: '+1', cls: 'shard' });
      }
      if ((g.res || g.shards) && has('grant')) api.grant(g, o.x, o.y, true);
      else if (!has('grant')) out.length = 0;
      if (o.net < 0 && has('perk')) {
        const pct = Math.max(0, Math.min(100, +api.perk('cards_rebate') || 0));
        const back = Math.floor(-o.net * pct / 100);
        if (back > 0) { api.payout(back, o.x, o.y); out.push({ k: `貴婦返水 ${pct}%`, v: '+' + f(back), cls: 'rebate' }); }
      }
    } catch (e) { console.error(e); }
    return out;
  }

  // 角色頭像（金框）
  const ava = (src, cls = '') => `<span class="ec-ava ${cls}"><img src="${src}" alt="" draggable="false"></span>`;
  function preload(urls) { for (const u of urls) { const i = new Image(); i.src = u; } }
  // 遊戲區縮放係數（依可用高寬）：--k
  function fitScale(body, baseW = 390, baseH = 780) {
    const r = body.getBoundingClientRect();
    const k = Math.max(0.68, Math.min(1.14, Math.min(r.width / baseW, r.height / baseH)));
    body.style.setProperty('--k', k.toFixed(3));
    return k;
  }
  // 在遊戲 overlay 掛上 SVG 定義（撲克牌、籌碼、玫瑰）
  function mount(root) { if (!root.querySelector('.ec-defs')) root.insertAdjacentHTML('afterbegin', DEFS); }

  W.ErikaCards = Object.assign(W.ErikaCards || {}, {
    version: 1,
    // 純函式
    RT, SUIT, SUIT_ZH, isRed, deck, rng, shuffle, cid, label, zh, byRank, bySuit, parse,
    // 美術
    faceSVG, chipSVG, BACK, DEFS, mount,
    // 介面與動畫
    use(api) { API = api; }, h, ctr, anim, rects, flipFrom, runner, sfx, cardEl, setFace, flip, dealFly,
    chipEl, pileHTML, flyChips, petals, roseStamp, ribbon, bubble, countUp, sheet, guide, titleScreen, resultPanel,
    ava, preload, fitScale, reduced, esc, signed, TIERS, linkage,
  });
})();
