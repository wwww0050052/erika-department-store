// 貴婦妞妞（牛牛）：5 人桌（玩家＋薇薇、維塔、千代、詩乃），荷官史利發牌。
// 流程：發 4 張 → 搶莊（不搶／×1–×4）→ 閒家下注（×1–×5）→ 發第 5 張 → 亮牌比牌 → 結算。
// 粉鑽：偷看第 5 張、換一張牌（每局一次）。免費：自動算牛、自動玩 N 局。
// 規則判定（evaluate / settle / AI）是純函式，掛在 ErikaCards.niuniu 給單元測試用。
'use strict';
(() => {
  const W = typeof window !== 'undefined' ? window : globalThis;
  const C = W.ErikaCards;
  if (!C) return;

  // ================= 規則（純函式） =================
  // 點數：A=1、2–9 照點數、10/J/Q/K=10
  const point = c => (c.r === 14 ? 1 : c.r >= 10 ? 10 : c.r);
  // 單張大小：K＞Q＞J＞10＞…＞2＞A，同點比花色 ♠＞♥＞♣＞♦
  const srank = c => (c.r === 14 ? 1 : c.r);
  const skey = c => srank(c) * 4 + c.s;
  // level：0 沒牛、1–9 牛一～牛九、10 牛牛、11 五花牛、12 炸彈、13 五小牛
  const NAMES = ['沒牛', '牛一', '牛二', '牛三', '牛四', '牛五', '牛六', '牛七', '牛八', '牛九', '牛牛', '五花牛', '炸彈', '五小牛'];
  const MULT = [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 5, 6, 8];
  const TRI = [[0, 1, 2], [0, 1, 3], [0, 1, 4], [0, 2, 3], [0, 2, 4], [0, 3, 4], [1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4]];
  function evaluate(cards) {
    if (!cards || cards.length !== 5) throw new Error('牛牛需要 5 張牌');
    const pts = cards.map(point), total = pts.reduce((a, b) => a + b, 0);
    let maxI = 0;
    for (let i = 1; i < 5; i++) if (skey(cards[i]) > skey(cards[maxI])) maxI = i;
    const cnt = {};
    for (const c of cards) cnt[c.r] = (cnt[c.r] || 0) + 1;
    const quadR = +(Object.keys(cnt).find(r => cnt[r] === 4) || 0);
    let group = null;
    for (const t of TRI) if ((pts[t[0]] + pts[t[1]] + pts[t[2]]) % 10 === 0) { group = t; break; }
    let level;
    if (cards.every(c => point(c) < 5) && total <= 10) level = 13;
    else if (quadR) level = 12;
    else if (cards.every(c => c.r >= 11 && c.r <= 13)) level = 11;
    else if (group) level = total % 10 || 10;
    else level = 0;
    // 顯示順序：有牛 = 牛的三張＋兩張；炸彈 = 四條＋一張；其他 = 由大到小
    const desc = [0, 1, 2, 3, 4].sort((a, b) => skey(cards[b]) - skey(cards[a]));
    let order = desc, split = 0;
    if (level === 12) { order = [...desc.filter(i => cards[i].r === quadR), ...desc.filter(i => cards[i].r !== quadR)]; split = 4; }
    else if (group && level !== 13) {
      const g = [...group].sort((a, b) => skey(cards[b]) - skey(cards[a]));
      order = [...g, ...desc.filter(i => !group.includes(i))]; split = 3;
    }
    const tie = level === 12 ? srank({ r: quadR }) * 4 + 3 : skey(cards[maxI]);
    return { level, name: NAMES[level], mult: MULT[level], key: level * 100 + tie, group: level >= 1 && level <= 11 ? group : null, niu: level >= 1 && level <= 10 ? level : 0, total, max: cards[maxI], order, split };
  }
  const compare = (a, b) => a.key - b.key;
  // 結算：閒家只跟莊家比。金額 = 底注 × 搶莊倍數 × 閒家下注倍數 × 贏家牌型倍數
  function settle(evs, banker, bm, bets, base) {
    const net = evs.map(() => 0), detail = [];
    evs.forEach((ev, i) => {
      if (i === banker) return;
      const win = compare(ev, evs[banker]) > 0;
      const mult = win ? ev.mult : evs[banker].mult;
      const amt = base * bm * bets[i] * mult;
      net[i] += win ? amt : -amt;
      net[banker] += win ? -amt : amt;
      detail.push({ i, win, mult, amt });
    });
    return { net, detail };
  }
  // AI 用的手牌強度：看 4 張時，把所有可能的第 5 張平均起來
  const VAL = [0, 0.12, 0.18, 0.25, 0.32, 0.4, 0.48, 0.62, 0.72, 0.82, 0.95, 1, 1, 1];
  function unknownFor(own) { const ids = new Set(own.map(C.cid)); return C.deck().filter(c => !ids.has(C.cid(c))); }
  function strength(four, unknown = unknownFor(four)) {
    let s = 0;
    for (const u of unknown) s += VAL[evaluate([four[0], four[1], four[2], four[3], u]).level];
    return s / unknown.length;
  }
  const clampN = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  function aiBid(s, bias = 0, r = Math.random) {
    const x = s + bias + (r() - 0.5) * 0.06;
    return x > 0.56 ? 4 : x > 0.5 ? 3 : x > 0.44 ? 2 : x > 0.34 ? 1 : 0;
  }
  function aiBet(s, bias = 0, r = Math.random) {
    const x = s + bias + (r() - 0.5) * 0.06;
    return x > 0.56 ? 5 : x > 0.5 ? 4 : x > 0.44 ? 3 : x > 0.36 ? 2 : 1;
  }
  // 換一張牌：試算換掉每一張後的期望強度，挑最划算的
  function bestSwap(five, unknown = unknownFor(five)) {
    const cur = VAL[evaluate(five).level];
    let best = { index: -1, expect: cur, gain: 0, cur };
    for (let i = 0; i < 5; i++) {
      let s = 0;
      for (const u of unknown) { const h = five.slice(); h[i] = u; s += VAL[evaluate(h).level]; }
      s /= unknown.length;
      if (s - cur > best.gain + 1e-9) best = { index: i, expect: s, gain: s - cur, cur };
    }
    return best;
  }
  const NN = { point, srank, skey, evaluate, compare, settle, strength, unknownFor, aiBid, aiBet, bestSwap, NAMES, MULT, VAL };
  C.niuniu = NN;

  // ================= 遊戲畫面 =================
  const PEEK = 10, SWAP = 20;
  const SEATS = [null, { ci: 1, key: 'vivi', bias: -0.035 }, { ci: 2, key: 'vita', bias: 0 }, { ci: 3, key: 'chiyo', bias: 0.06 }, { ci: 4, key: 'shino', bias: -0.015 }];
  const DEAL_ORDER = [3, 1, 2, 4, 0]; // 從玩家左手邊順時針
  const LINES = {
    vivi: { hi: ['這把我想當莊家～', '甜點錢全押上！'], no: ['我先看看就好～', '嗯…再想想'], bet: ['小小跟一下～', '就這樣吧♪'], big: ['哇！好漂亮的牌！', '今天手氣好甜～'], none: ['嗚…沒牛…', '這把要餓肚子了…'], win: ['下午茶有著落了♪', '謝謝招待～'], lose: ['蛋糕錢飛走了…', '下一把一定贏回來！'] },
    vita: { hi: ['勝率計算完成，搶莊。', '數據顯示：該搶。'], no: ['期望值不足，不搶。', '先觀察數據。'], bet: ['期望值為正，加注。', '照模型下注。'], big: ['完美的演算結果。', '和預測完全一致。'], none: ['……在誤差範圍內。', '需要重新校正。'], win: ['一切都在預測之中。', '收益已入帳。'], lose: ['需要更新模型了。', '這是可接受的回撤。'] },
    chiyo: { hi: ['莊家當然是本小姐！', '全部讓開，我來坐莊！'], no: ['今天先讓妳們一把。', '哼，這把不屑搶。'], bet: ['這點小錢，全押！', '本小姐跟了。'], big: ['哼，這就是實力。', '看清楚了嗎？'], none: ['……這副牌有問題吧？', '哼，暖身而已。'], win: ['呵呵，承讓了～', '零錢我就收下囉。'], lose: ['零錢而已，本小姐不在乎！', '下一把加倍奉還！'] },
    shino: { hi: ['此局，由我坐莊。', '時機正好。'], no: ['靜觀其變。', '這把，先賞花吧。'], bet: ['適可而止，也是優雅。', '就這樣吧。'], big: ['花開正好。', '月圓之時。'], none: ['落花無意…', '無妨。'], win: ['承蒙各位相讓。', '一期一會。'], lose: ['勝敗乃兵家常事。', '下回再請教。'] },
  };
  const pickL = a => a[Math.floor(Math.random() * a.length)];
  const ICON = {
    auto: '<svg class="li" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6"/><path d="M18 3v4h-4M6 21v-4h4"/></svg>',
    rules: '<svg class="li" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h10l4 4v12H5z"/><path d="M14 4v5h5M8.5 13h7M8.5 16.5h5"/></svg>',
  };
  const RULES = `
    <h4>流程</h4>
    <ol><li>每人先發 <b>4 張</b>牌。</li><li><b>搶莊</b>：不搶／×1～×4，倍數最高的人當莊家（同倍數隨機抽一位；都不搶就隨機一位以 ×1 坐莊）。</li><li><b>閒家下注</b> ×1～×5。</li><li>發<b>第 5 張</b>，亮牌比牌。<b>閒家只跟莊家比</b>，閒家之間不比。</li></ol>
    <h4>算牛</h4>
    <p>A 算 1 點，2～9 照點數，10、J、Q、K 都算 10 點。任三張加起來是 10 的倍數就「有牛」，剩下兩張相加的個位數就是「牛幾」（個位數是 0 就是<b>牛牛</b>）。湊不出來就是「沒牛」。<br>系統會<b>自動幫妳算牛、排好</b>：左邊三張是「牛」，右邊兩張決定牛幾。</p>
    <h4>牌型與倍數（大到小）</h4>
    <table class="ec-tbl"><tr><th>五小牛</th><td>五張都小於 5 點，總和 ≤ 10</td><td>×8</td></tr><tr><th>炸彈</th><td>四張同點數</td><td>×6</td></tr><tr><th>五花牛</th><td>五張都是 J、Q、K</td><td>×5</td></tr><tr><th>牛牛</th><td>有牛，兩張和個位數為 0</td><td>×3</td></tr><tr><th>牛七～牛九</th><td></td><td>×2</td></tr><tr><th>沒牛～牛六</th><td></td><td>×1</td></tr></table>
    <h4>比大小</h4>
    <p>先比牌型；牌型相同就比各自<b>最大的一張</b>：K＞Q＞J＞10＞9＞…＞2＞A，點數也相同再比花色 ♠＞♥＞♣＞♦（所以不會平手）。兩副炸彈比四條的點數。</p>
    <h4>輸贏金額</h4>
    <p>底注 × 搶莊倍數 × 閒家下注倍數 × <b>贏家</b>牌型倍數。<br>新手桌底注 = 約 1 分鐘收益，貴婦桌 ×10，名媛桌 ×100。</p>
    <h4>粉鑽服務</h4>
    <p><b>偷看第 5 張</b>（${PEEK} 粉鑽）：搶莊或下注前就先知道第 5 張。<br><b>換一張牌</b>（${SWAP} 粉鑽，每局一次）：亮牌前換掉一張；沒選牌的話，系統會自動挑最划算的那張。</p>
    <h4>自動玩</h4><p>免費。系統依手牌強弱幫妳搶莊、下注（保守打法），連續玩 5／10／20 局。</p>
    <h4>額外獎勵</h4><p>每局淨贏另得<b>寶石原石</b>（王國資源）；拿到<b>牛牛以上</b>時，還會得到一位對手的<b>角色碎片</b>；淨輸時，王國研究「貴婦返水」會退還一部分輸額。</p>
    <p class="ec-fine">閒家下注時先扣下注金額；當莊家時先押保證金（底注 × 搶莊倍數 × 5），結算時多退少補。牌局中途離開，已押的金額不會退回。全部使用遊戲金幣。</p>`;

  function open(api) {
    C.use(api);
    const fmt = api.fmt, esc = api.esc, gemI = api.icons.gem();
    const store = () => {
      const s = api.store('niuniu');
      for (const [k, v] of Object.entries({ tier: 0, games: 0, wins: 0, best: 0, net: 0, niuniu: 0, banker: 0 })) if (typeof s[k] !== 'number') s[k] = v;
      if (!s.tut || typeof s.tut !== 'object') s.tut = {};
      return s;
    };
    const cast = api.cast(), me = api.player();
    C.preload([1, 2, 3, 4].flatMap(i => ['neutral', 'joy', 'sad', 'angry'].map(e => cast[i].face(e))).concat([me.face('joy'), me.face('sad'), cast[5].face('neutral'), cast[5].face('joy')]));
    let run = C.runner(), screen = 'title', G = null, rd = null, tierI = 0, base = 0, roundNo = 0, pending = null;
    const auto = { left: 0, total: 0, done: 0 };
    const onResize = () => C.fitScale(o.body, 390, 760);
    const o = api.overlay({
      id: 'niuniu', title: '貴婦妞妞',
      onClose() { run.kill(); removeEventListener('resize', onResize); },
      beforeClose() {
        if (screen === 'title') return true;
        if (rd && rd.stake > 0 && !rd.settled) {
          api.modal({ title: '牌局進行中', body: '<p class="mb">現在離開的話，<br>已經押下去的金幣不會退回喔。</p>', actions: [{ label: '繼續玩', cls: 'ghost' }, { label: '離開牌桌', fn: c => { c(); rd.settled = true; showTitle(); } }] });
          return false;
        }
        showTitle();
        return false;
      },
    });
    C.mount(o.root);
    const body = o.body;
    body.classList.add('ec-body');
    addEventListener('resize', onResize);
    onResize();

    function swapScreen(el) {
      [...body.querySelectorAll(':scope > .ec-screen')].forEach(old => { old.classList.add('leave'); setTimeout(() => old.remove(), 380); });
      el.classList.add('ec-screen', 'enter');
      body.appendChild(el);
      setTimeout(() => el.classList.remove('enter'), 600);
    }

    // ---------- 標題畫面 ----------
    function showTitle() {
      run.kill(); run = C.runner();
      auto.left = 0; rd = null; pending = null;
      screen = 'title'; o.setTitle('貴婦妞妞');
      const st = store(), bu = api.betUnit();
      const tiers = C.TIERS.map(t => { const stake = bu * t.mult; return { ...t, stake, need: stake * 8, locked: api.coins < stake * 8 }; });
      let ti = Math.min(st.tier || 0, 2);
      while (ti > 0 && tiers[ti].locked) ti--;
      tierI = ti;
      const el = C.titleScreen({
        theme: 'wine', eyebrow: 'Salon de Jeux · Niu-Niu', title: '貴婦妞妞', en: 'Madame Niu-Niu', tagline: '湊出十的倍數，比誰的牛最大',
        chars: [{ src: cast[1].full, cls: 'l' }, { src: cast[4].full, cls: 'r' }, { src: cast[3].full, cls: 'c' }],
        fan: C.parse('AS 9H KD QS JH'), tiers, tier: ti,
        stats: [['總局數', st.games], ['勝率', st.games ? Math.round(st.wins / st.games * 100) + '%' : '—'], ['單局最高贏', st.best > 0 ? fmt(st.best) : '—']],
        start: '入座開局',
        onTier(i) { tierI = i; store().tier = i; },
        onStart(i) { tierI = i; store().tier = i; startGame(); },
        onRules: showRules,
      });
      swapScreen(el);
    }
    function showRules() { C.sheet(body, { title: '貴婦妞妞・規則', html: `<div class="ec-rules">${RULES}</div>`, buttons: [{ id: 'ok', label: '我知道了', cls: 'goldb' }] }); }

    // ---------- 牌桌 ----------
    const seatEl = i => G.querySelector(`.nn-seat[data-i="${i}"]`);
    const slotsOf = i => [...seatEl(i).querySelectorAll('.nn-slot')];
    const avaEl = i => seatEl(i).querySelector('.ec-ava');
    const nameOf = i => (i === 0 ? me.name : cast[SEATS[i].ci].name);
    const faceOf = (i, e = 'neutral') => (i === 0 ? me.face(e) : cast[SEATS[i].ci].face(e));
    const linesOf = i => LINES[SEATS[i].key];
    const expr = (i, e) => { const img = avaEl(i).querySelector('img'); if (img) img.src = faceOf(i, e); };
    function tag(i, text, cls = '') {
      const t = seatEl(i).querySelector('.nn-tag');
      t.textContent = text; t.className = 'nn-tag ' + cls;
      C.anim(t, [{ transform: 'scale(.5)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 260 });
    }
    const say = (i, text, e) => { C.bubble(seatEl(i), text, { ms: 1900 }); if (e) expr(i, e); };
    function msg(html, cls = '') {
      const m = G.querySelector('.nn-msg');
      m.innerHTML = `<span class="${cls}">${html}</span>`;
      C.anim(m.firstElementChild, [{ opacity: 0, transform: 'translateY(6px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
    }
    const seatHTML = i => {
      const c = cast[SEATS[i].ci];
      return `<div class="nn-seat s${i}${i % 2 === 0 ? ' r' : ''}" data-i="${i}">
        <div class="nn-head">${C.ava(c.face(), 'nn-av')}<span class="nn-id"><b>${esc(c.name)}</b><span class="nn-tag"></span></span><i class="nn-crown" aria-label="莊家">莊</i></div>
        <div class="nn-cards">${'<span class="nn-slot"></span>'.repeat(5)}</div>
        <div class="nn-res"></div><div class="nn-bet"></div><div class="nn-delta num"></div></div>`;
    };
    function buildGame() {
      const t = C.TIERS[tierI];
      G = C.h(`<div class="nn-game">
        <div class="ec-felt wine"></div><div class="ec-rim"></div>
        <div class="nn-wm"><b>ERIKA</b><small>Salon de Niu-Niu</small></div>
        <div class="nn-top">
          <span class="nn-tierchip"><b>${t.name}</b><span class="num">底注 ${fmt(base)}</span></span>
          <span class="nn-round num"></span>
          <button class="nn-tb nn-autob" aria-label="自動玩">${ICON.auto}<span>自動</span></button>
          <button class="nn-tb nn-rulesb" aria-label="規則">${ICON.rules}<span>規則</span></button>
        </div>
        <div class="nn-seats">${[1, 2, 3, 4].map(seatHTML).join('')}</div>
        <div class="nn-center">
          <div class="nn-deck"></div>
          <div class="nn-dealer">${C.ava(cast[5].face(), 'nn-dav')}<div class="nn-msg"></div></div>
        </div>
        <div class="nn-seat nn-me" data-i="0">
          <div class="nn-head">${C.ava(me.face(), 'nn-av')}<span class="nn-id"><b>${esc(me.name)}</b><span class="nn-tag"></span></span><i class="nn-crown" aria-label="莊家">莊</i><div class="nn-bet"></div></div>
          <div class="nn-cards">${'<span class="nn-slot"></span>'.repeat(5)}</div>
          <div class="nn-res"></div><div class="nn-delta num"></div>
        </div>
        <div class="nn-bar"><div class="nn-aux"></div><div class="nn-main"></div></div>
        <div class="ec-fxl"></div>
      </div>`);
      const deck = G.querySelector('.nn-deck');
      for (let i = 0; i < 4; i++) { const b = C.cardEl(null, { size: 'md' }); b.style.setProperty('--i', i); deck.appendChild(b); }
      G.querySelector('.nn-autob').addEventListener('click', autoSheet);
      G.querySelector('.nn-rulesb').addEventListener('click', () => { api.sound.click(); showRules(); });
      G.querySelector('.nn-aux').addEventListener('click', onAux);
      G.querySelector('.nn-me .nn-cards').addEventListener('click', onMyCard);
      return G;
    }
    const fxl = () => G.querySelector('.ec-fxl');
    const deckPt = () => C.ctr(G.querySelector('.nn-deck .ec-card:last-child'));

    function startGame() {
      const bu = api.betUnit();
      base = bu * C.TIERS[tierI].mult;
      if (api.coins < base * 2) { api.toast('金幣不足，先到新手桌玩玩吧'); api.sound.err(); return; }
      screen = 'game'; roundNo = 0;
      o.setTitle('貴婦妞妞');
      run.kill(); run = C.runner();
      swapScreen(buildGame());
      onResize();
      loop(run);
    }
    async function loop(R) {
      await R.sleep(450);
      for (;;) {
        const next = await playRound(R);
        if (next !== 'again') { showTitle(); return; }
        if (api.coins < base * 2) { api.toast('金幣不夠下一局了，回大廳換張桌子吧'); auto.left = 0; showTitle(); return; }
      }
    }

    // ---------- 動作列 ----------
    function choose(defs, autoV) {
      const main = G.querySelector('.nn-main');
      return new Promise(res => {
        main.innerHTML = defs.map((d, i) => `<button class="btn ${d.cls || ''}${d.disabled ? ' off' : ''}" data-v="${i}">${d.label}${d.sub ? `<small>${d.sub}</small>` : ''}</button>`).join('');
        main.classList.remove('hide');
        C.anim(main, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
        let done = false;
        const pick = i => {
          if (done) return;
          done = true; pending = null; main.onclick = null;
          const gk = body.querySelector('.ec-guide .ec-guide-ok');
          if (gk) setTimeout(() => gk.click(), 400); // 玩家已經做了選擇，引導泡泡自動收起
          const b = main.children[i];
          if (b) b.classList.add('chosen');
          setTimeout(() => { main.classList.add('hide'); }, 180);
          res(defs[i].v);
        };
        main.onclick = e => {
          const b = e.target.closest('[data-v]'); if (!b) return;
          const d = defs[+b.dataset.v];
          if (d.disabled) { api.sound.err(); api.shake(b); if (d.why) api.toast(d.why); return; }
          api.sound.click(); api.vib(8);
          pick(+b.dataset.v);
        };
        pending = { autoPick: () => { const i = defs.findIndex(d => d.v === autoV); if (i >= 0) pick(i); } };
        if (auto.left > 0 && autoV != null) run.sleep(380).then(() => pending && pending.autoPick());
      });
    }
    function setAux(items) {
      const aux = G.querySelector('.nn-aux');
      aux.innerHTML = items.map(it => `<button class="btn gemb${it.off ? ' off' : ''}" data-a="${it.id}" data-p="${it.price}">${it.off ? it.used : it.label}<small>${it.off ? '本局已使用' : gemI + it.price}</small></button>`).join('');
    }
    function onAux(e) {
      const b = e.target.closest('[data-a]'); if (!b || !rd) return;
      if (b.classList.contains('off')) { api.sound.err(); api.shake(b); return; }
      const id = b.dataset.a, price = b.dataset.p;
      api.twoTap(b, () => (id === 'peek' ? doPeek(b) : doSwap(b)), () => { const sm = b.querySelector('small'); if (sm) sm.innerHTML = b.dataset.confirm ? '再按一次確認' : `${gemI}${price}`; });
    }

    // ---------- 牌的呈現 ----------
    function badge(i, ev, ghost) {
      const r = seatEl(i).querySelector('.nn-res');
      const tc = ev.level === 0 ? 't0' : ev.level <= 6 ? 't1' : ev.level <= 9 ? 't2' : ev.level === 10 ? 't3' : 't4';
      r.innerHTML = `<span class="nn-badge ${tc}${ghost ? ' ghost' : ''}">${ghost ? '<em>預測</em>' : ''}<b>${ev.name}</b>${ev.mult > 1 ? `<i>×${ev.mult}</i>` : ''}</span>`;
      C.anim(r.firstElementChild, [{ transform: 'scale(.3) rotate(-8deg)', opacity: 0 }, { transform: 'scale(1.18)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,1.3,.4,1)' });
    }
    async function arrange(i, ev) {
      const sl = slotsOf(i), els = rd.els[i];
      const before = C.rects(els);
      ev.order.forEach((k, pos) => sl[pos].appendChild(els[k]));
      sl.forEach((s, pos) => s.classList.toggle('gap', ev.split > 0 && pos === ev.split));
      await C.flipFrom(before, { dur: run.d(340) });
    }
    function resetTable() {
      for (let i = 0; i < 5; i++) {
        const s = seatEl(i);
        s.classList.remove('banker', 'win', 'lose', 'cand', 'hl');
        s.querySelectorAll('.nn-slot').forEach(x => { x.innerHTML = ''; x.classList.remove('gap'); });
        s.querySelector('.nn-res').innerHTML = '';
        s.querySelector('.nn-bet').innerHTML = '';
        const d = s.querySelector('.nn-delta'); d.textContent = ''; d.className = 'nn-delta num';
        s.querySelector('.nn-tag').textContent = ''; s.querySelector('.nn-tag').className = 'nn-tag';
        expr(i, 'neutral');
      }
      setAux([]);
      G.querySelector('.nn-main').innerHTML = '';
      G.querySelector('.nn-round').textContent = auto.left > 0 ? `自動 ${auto.done + 1}/${auto.total}` : `第 ${roundNo} 局`;
      G.querySelector('.nn-autob').classList.toggle('on', auto.left > 0);
      G.querySelector('.nn-autob span').textContent = auto.left > 0 ? '停止' : '自動';
    }
    async function dealCards(R, from, to) {
      const dp = deckPt(), dw = G.querySelector('.nn-deck .ec-card').getBoundingClientRect().width;
      const ps = [];
      let n = 0;
      for (let k = from; k < to; k++) {
        for (const i of DEAL_ORDER) {
          if (i === 0 && k === 4 && rd.peeked) continue;
          const el = C.cardEl(rd.hands[i][k], { size: i === 0 ? 'lg' : 'sm', face: i === 0 });
          slotsOf(i)[k].appendChild(el);
          rd.els[i][k] = el;
          C.sfx.deal(n++);
          ps.push(C.dealFly(el, dp, { dur: R.d(360), fromW: dw }));
          await R.sleep(62);
        }
      }
      await R.wait(Promise.all(ps));
    }
    function showBet(i, k, amount) {
      const b = seatEl(i).querySelector('.nn-bet');
      b.innerHTML = `${C.pileHTML(Math.min(5, k + 1), i)}<b class="num">×${k}</b>`;
      if (amount) b.title = fmt(amount);
      C.flyChips(fxl(), C.ctr(avaEl(i)), C.ctr(b), Math.min(6, k + 1), { dur: run.d(460) });
      C.anim(b, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: run.d(420), delay: run.d(260), fill: 'backwards' });
    }

    // ---------- 一局 ----------
    async function playRound(R) {
      roundNo++;
      rd = { stake: 0, settled: false, banker: -1, bm: 1, bids: [0, 0, 0, 0, 0], bets: [0, 0, 0, 0, 0], str: [0, 0, 0, 0, 0], hands: [], els: [[], [], [], [], []], evs: [], peeked: false, swapped: false, sel: -1, phase: 'deal', busy: false, deck: [] };
      R.speed = auto.left > 0 ? 0.42 : 1;
      resetTable();
      const d = C.shuffle(C.deck());
      rd.hands = [0, 1, 2, 3, 4].map(() => d.splice(0, 5));
      rd.deck = d;
      // 沙盒測試用：ErikaCards.niuniu._force = ['5 張', …]（只在 ?sandbox 有效，用一次就清掉）
      if (api.sandbox && NN._force) {
        const f = NN._force.map(x => (x ? C.parse(x) : null)); NN._force = null;
        const used = new Set(f.flat().filter(Boolean).map(C.cid)), rest = C.shuffle(C.deck().filter(c => !used.has(C.cid(c))));
        rd.hands = [0, 1, 2, 3, 4].map(i => f[i] || rest.splice(0, 5));
        rd.deck = rest;
      }
      // 洗牌＋發 4 張
      msg('各位小姐，發牌了。');
      const deck = G.querySelector('.nn-deck');
      deck.classList.add('shuf'); C.sfx.shuffle();
      await R.sleep(760);
      deck.classList.remove('shuf');
      await dealCards(R, 0, 4);
      for (const el of rd.els[0].slice(0, 4)) { C.flip(el, true); C.sfx.flip(); await R.sleep(95); }
      await R.sleep(380);

      // 搶莊
      rd.phase = 'bid';
      const unk = [0, 1, 2, 3, 4].map(i => NN.unknownFor(rd.hands[i].slice(0, 4)));
      for (let i = 0; i < 5; i++) rd.str[i] = NN.strength(rd.hands[i].slice(0, 4), unk[i]);
      const aiBids = Promise.all([1, 2, 3, 4].map(async i => {
        tag(i, '思考中…', 'think');
        await R.sleep(600 + Math.random() * 1500);
        const b = NN.aiBid(rd.str[i], SEATS[i].bias);
        rd.bids[i] = b;
        tag(i, b ? `搶×${b}` : '不搶', b ? 'hot' : 'cold');
        C.sfx.pop();
        if (b >= 3 && Math.random() < 0.65) say(i, pickL(linesOf(i).hi), 'joy');
        else if (b === 0 && Math.random() < 0.3) say(i, pickL(linesOf(i).no));
      }));
      msg('請選擇<b>搶莊</b>倍數');
      setAux([{ id: 'peek', label: '偷看第5張', used: '已偷看', price: PEEK, off: rd.peeked }]);
      const autoBid = Math.min(2, NN.aiBid(rd.str[0], -0.04));
      const bidP = choose([0, 1, 2, 3, 4].map(m => {
        const need = base * m * 5;
        return { v: m, label: m ? `×${m}` : '不搶', sub: m ? '搶莊' : '', cls: m ? (m >= 3 ? 'goldb' : '') : 'ghost', disabled: m > 0 && api.coins < need, why: `當莊家要先押保證金 ${fmt(need)}，金幣不足` };
      }), api.coins >= base * autoBid * 5 ? autoBid : 0);
      if (!store().tut.bid && auto.left <= 0) {
        store().tut.bid = 1;
        await R.wait(C.guide(body, G.querySelector('.nn-bar'), '<b>搶莊</b>：覺得牌好就搶！倍數越高，輸贏都跟著變大。<br>沒把握就按「不搶」，當閒家下注就好。<br><small>粉鑽可以先「偷看第 5 張」再決定喔！</small>'));
      }
      const myBid = await R.wait(bidP);
      rd.bids[0] = myBid;
      tag(0, myBid ? `搶×${myBid}` : '不搶', myBid ? 'hot' : 'cold');
      msg('等待大家搶莊…');
      await R.wait(aiBids);
      await R.sleep(300);

      // 定莊
      const mx = Math.max(...rd.bids);
      const cands = [0, 1, 2, 3, 4].filter(i => rd.bids[i] === mx);
      const banker = cands[Math.floor(Math.random() * cands.length)];
      rd.banker = banker; rd.bm = Math.max(1, mx);
      if (cands.length > 1) {
        msg(mx ? `${cands.length} 位同時搶×${mx}，隨機定莊！` : '大家都不搶，隨機定莊！');
        const steps = 10 + cands.indexOf(banker) + cands.length * 2;
        for (let s = 0; s <= steps; s++) {
          const cur = cands[s % cands.length];
          for (const i of cands) seatEl(i).classList.toggle('hl', i === cur);
          api.sound.beep(900 + (s % cands.length) * 140, 0.05, 'triangle', 0.04);
          await R.sleep(70 + s * s * 1.6);
        }
        for (const i of cands) seatEl(i).classList.remove('hl');
      }
      seatEl(banker).classList.add('banker');
      api.sound.ding(); api.vib(15);
      const bp = C.ctr(avaEl(banker));
      api.fx.burst(bp.x, bp.y, 14, ['spark', 'confetti']);
      msg(`<b>${esc(nameOf(banker))}</b> 坐莊・×${rd.bm}`, 'gold');
      if (banker !== 0 && Math.random() < 0.8) say(banker, pickL(linesOf(banker).hi), 'joy');
      if (banker === 0) {
        rd.stake = base * rd.bm * 5;
        if (!api.spendCoins(rd.stake)) { rd.stake = Math.min(api.coins, rd.stake); api.spendCoins(rd.stake); }
        tag(0, `莊家 ×${rd.bm}`, 'gold');
        showBet(0, rd.bm, rd.stake);
        expr(0, 'joy');
      }
      await R.sleep(700);

      // 閒家下注
      rd.phase = 'bet';
      const aiBets = Promise.all([1, 2, 3, 4].filter(i => i !== banker).map(async i => {
        tag(i, '下注中…', 'think');
        await R.sleep(500 + Math.random() * 1200);
        const k = NN.aiBet(rd.str[i], SEATS[i].bias);
        rd.bets[i] = k;
        tag(i, `下注×${k}`, k >= 4 ? 'hot' : '');
        showBet(i, k);
        if (k >= 4 && Math.random() < 0.5) say(i, pickL(linesOf(i).bet));
      }));
      if (banker !== 0) {
        msg('閒家請<b>下注</b>');
        const autoBet = Math.max(1, Math.min(3, NN.aiBet(rd.str[0], -0.03)));
        const betP = choose([1, 2, 3, 4, 5].map(m => {
          const need = base * rd.bm * m;
          return { v: m, label: `×${m}`, sub: fmt(need), cls: m >= 4 ? 'goldb' : '', disabled: m > 1 && api.coins < need, why: `下注 ×${m} 需要 ${fmt(need)} 金幣` };
        }), api.coins >= base * rd.bm * autoBet ? autoBet : 1);
        if (!store().tut.bet && auto.left <= 0) {
          store().tut.bet = 1;
          await R.wait(C.guide(body, G.querySelector('.nn-bar'), '<b>下注</b>：閒家只跟莊家比牌。<br>贏了照<b>妳的牌型倍數</b>拿錢，輸了照<b>莊家的牌型倍數</b>賠。'));
        }
        const k = await R.wait(betP);
        rd.bets[0] = k;
        rd.stake = base * rd.bm * k;
        if (!api.spendCoins(rd.stake)) { rd.stake = Math.min(api.coins, rd.stake); api.spendCoins(rd.stake); }
        tag(0, `下注×${k}`, k >= 4 ? 'hot' : '');
        showBet(0, k, rd.stake);
        msg('等待其他閒家…');
      } else msg('等待閒家下注…');
      await R.wait(aiBets);
      setAux([]);
      await R.sleep(420);

      // 第 5 張
      rd.phase = 'deal5';
      msg('發第五張牌');
      await dealCards(R, 4, 5);
      const mine = rd.els[0][4];
      if (rd.peeked) { mine.classList.remove('peek'); C.anim(mine, [{ filter: 'brightness(1.6)' }, { filter: 'none' }], { duration: 500 }); }
      else { C.flip(mine, true); C.sfx.flip(); }
      await R.sleep(460);
      rd.evs[0] = NN.evaluate(rd.hands[0]);
      await R.wait(arrange(0, rd.evs[0]));
      badge(0, rd.evs[0]);
      if (rd.evs[0].level >= 10) C.sfx.sparkle();

      // 看牌（可換一張）
      if (auto.left <= 0) {
        rd.phase = 'look';
        msg(`妳的牌：<b>${rd.evs[0].name}</b>`, rd.evs[0].level >= 7 ? 'gold' : '');
        setAux([{ id: 'swap', label: '換一張牌', used: '已換牌', price: SWAP, off: rd.swapped }]);
        const showP = choose([{ v: 'show', label: '亮牌', sub: '比牌！', cls: 'goldb' }]);
        if (!store().tut.look) {
          store().tut.look = 1;
          await R.wait(C.guide(body, G.querySelector('.nn-me .nn-cards'), '系統已經<b>自動幫妳算牛</b>：左邊三張湊成 10 的倍數，右邊兩張相加的個位數就是牛幾。<br><small>不滿意？點一張牌再用粉鑽「換一張」。</small>'));
        }
        await R.wait(showP);
        while (rd.busy) await R.sleep(120);
        rd.els[0].forEach(x => x.classList.remove('sel'));
        setAux([]);
      }
      rd.phase = 'reveal';

      // 亮牌
      msg('開牌！', 'gold');
      api.sound.drum();
      await R.wait(C.ribbon(fxl(), '<b>開牌</b><small>Révélez</small>', { ms: R.d(700) }));
      for (let i = 1; i < 5; i++) rd.evs[i] = NN.evaluate(rd.hands[i]);
      const order = [];
      const ring = [0, 3, 1, 2, 4];
      const bi = ring.indexOf(banker);
      for (let k = 1; k <= 5; k++) order.push(ring[(bi + k) % 5]);
      for (const i of order) {
        if (i === 0) {
          seatEl(0).classList.add('focus');
          badge(0, rd.evs[0]);
          if (rd.evs[0].level >= 10) {
            C.sfx.sparkle(); api.sound.ssr(); api.vib([20, 40, 20]);
            const p = C.ctr(seatEl(0).querySelector('.nn-cards'));
            api.fx.burst(p.x, p.y, 30);
            await R.wait(C.ribbon(fxl(), `<b>${rd.evs[0].name}！</b><small>×${rd.evs[0].mult}</small>`, { cls: 'big', ms: R.d(900) }));
          }
          await R.sleep(420);
          seatEl(0).classList.remove('focus');
          continue;
        }
        seatEl(i).classList.add('focus');
        for (const el of rd.els[i]) { C.setFace(el, el._card); C.flip(el, true); C.sfx.flip(); await R.sleep(70); }
        await R.sleep(360);
        await R.wait(arrange(i, rd.evs[i]));
        badge(i, rd.evs[i]);
        const lv = rd.evs[i].level;
        if (lv >= 10) { say(i, pickL(linesOf(i).big), 'joy'); C.sfx.sparkle(); const p = C.ctr(seatEl(i).querySelector('.nn-cards')); api.fx.burst(p.x, p.y, 16, ['spark', 'confetti']); }
        else if (lv >= 7) { expr(i, 'joy'); C.sfx.pop(); }
        else if (lv === 0) { if (Math.random() < 0.6) say(i, pickL(linesOf(i).none), i === 3 ? 'angry' : 'sad'); else expr(i, 'sad'); }
        await R.sleep(i === banker ? 600 : 380);
        seatEl(i).classList.remove('focus');
      }

      // 比牌、結算
      rd.phase = 'settle';
      const { net, detail } = NN.settle(rd.evs, banker, rd.bm, rd.bets, base);
      msg('結算');
      for (const dd of detail) {
        const s = seatEl(dd.i);
        s.classList.add(dd.win ? 'win' : 'lose');
        const from = dd.win ? banker : dd.i, to = dd.win ? dd.i : banker;
        C.flyChips(fxl(), C.ctr(avaEl(from)), C.ctr(avaEl(to)), 3 + dd.mult, { dur: R.d(560) });
        await R.sleep(200);
      }
      await R.sleep(700);
      for (let i = 0; i < 5; i++) {
        const dl = seatEl(i).querySelector('.nn-delta');
        dl.classList.add(net[i] > 0 ? 'pos' : net[i] < 0 ? 'neg' : 'zero', 'show');
        C.countUp(dl, net[i], R.d(600), C.signed);
        if (i > 0) {
          if (net[i] > 0) expr(i, 'joy'); else if (net[i] < 0) expr(i, i === 3 ? 'angry' : 'sad');
        }
      }
      expr(0, net[0] > 0 ? 'joy' : net[0] < 0 ? 'sad' : 'neutral');
      if (net[0] > 0) { api.sound.cash(); api.vib([15, 30, 15]); } else if (net[0] < 0) C.sfx.sad();
      // 金幣：先扣的押金＋輸贏，多退少補
      const final = rd.stake + net[0];
      if (final > 0) { const p = C.ctr(avaEl(0)); api.payout(final, p.x, p.y); }
      else if (final < 0) { const extra = Math.min(-final, api.coins); if (extra > 0) api.spendCoins(extra); }
      rd.settled = true;
      const lp = C.ctr(avaEl(0));
      const extras = C.linkage(api, { game: 'niuniu', net: net[0], x: lp.x, y: lp.y, big: rd.evs[0].level >= 10, shardIds: [1, 2, 3, 4].map(i => cast[SEATS[i].ci].id) });
      const st = store();
      st.games++; if (net[0] > 0) st.wins++; st.best = Math.max(st.best, net[0]); st.net += net[0];
      if (rd.evs[0].level >= 10) st.niuniu++;
      if (banker === 0) st.banker++;
      api.stat('niuniu_games'); if (net[0] > 0) api.stat('niuniu_wins');
      api.save();
      await R.sleep(1000);

      // 結算面板
      const others = [1, 2, 3, 4];
      let title, tone;
      if (banker === 0 && detail.every(x => !x.win)) { title = '通殺！'; tone = 'big'; }
      else if (banker === 0 && detail.every(x => x.win)) { title = '通賠…'; tone = 'lose'; }
      else if (net[0] > 0 && rd.evs[0].level >= 10) { title = '牛氣沖天！'; tone = 'big'; }
      else if (net[0] > 0) { title = '贏了！'; tone = 'win'; }
      else if (net[0] < 0) { title = '惜敗'; tone = 'lose'; }
      else { title = '平手'; tone = 'draw'; }
      if (tone === 'big') { api.fx.rain('confetti', 60); api.sound.level(); }
      const star = banker !== 0 ? banker : others.reduce((a, b) => (Math.abs(net[b]) > Math.abs(net[a]) ? b : a), 1);
      const starWon = net[star] > 0;
      const roleTxt = banker === 0 ? `妳坐莊 ×${rd.bm}` : `閒家下注 ×${rd.bets[0]}・莊家 ×${rd.bm}`;
      const autoOn = auto.left > 0;
      if (autoOn) { auto.done++; auto.left--; }
      const autoMore = auto.left > 0;
      const panel = C.resultPanel(G, {
        tone, title, speed: R.speed,
        sub: `妳的牌 <b>${rd.evs[0].name}</b>${rd.evs[0].mult > 1 ? ` ×${rd.evs[0].mult}` : ''}・${roleTxt}`,
        lines: others.map(i => ({ img: faceOf(i, net[i] > 0 ? 'joy' : net[i] < 0 ? 'sad' : 'neutral'), name: nameOf(i) + (i === banker ? '（莊）' : ''), desc: rd.evs[i].name + (rd.evs[i].mult > 1 ? ` ×${rd.evs[i].mult}` : ''), amt: net[i] })),
        total: net[0], totalLabel: '妳本局輸贏', extras,
        char: { img: faceOf(star, starWon ? 'joy' : star === 3 ? 'angry' : 'sad'), name: nameOf(star), line: pickL(linesOf(star)[starWon ? 'win' : 'lose']) },
        buttons: autoMore ? [{ id: 'stop', label: '停止自動', cls: 'ghost' }, { id: 'again', label: '下一局', cls: 'goldb' }] : [{ id: 'back', label: '回大廳', cls: 'ghost' }, { id: 'again', label: '再來一局', cls: 'goldb' }],
        auto: autoMore ? { ms: 1200, id: 'again' } : null,
      });
      let ch = await R.wait(panel.choice);
      if (ch === 'stop') { auto.left = 0; ch = 'again'; api.toast('已停止自動玩'); }
      if (autoOn && !autoMore) api.toast(`自動玩 ${auto.total} 局結束`, 'gold');
      return ch;
    }

    // ---------- 粉鑽：偷看第 5 張 ----------
    function doPeek(btn) {
      if (!rd || rd.peeked || !(rd.phase === 'bid' || rd.phase === 'bet')) return;
      if (!api.spendGems(PEEK)) return;
      rd.peeked = true;
      setAux([{ id: 'peek', label: '偷看第5張', used: '已偷看', price: PEEK, off: true }]);
      const c = rd.hands[0][4];
      const el = C.cardEl(c, { size: 'lg', up: true, cls: 'peek' });
      slotsOf(0)[4].appendChild(el);
      rd.els[0][4] = el;
      C.anim(el, [{ transform: 'translateY(-40px) rotateY(90deg) scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 480, easing: 'cubic-bezier(.2,1.2,.4,1)' });
      C.sfx.sparkle(); api.vib(10);
      const ev = NN.evaluate(rd.hands[0]);
      badge(0, ev, true);
      api.toast(`第 5 張是 ${C.label(c)}，湊起來是「${ev.name}」`, 'gold');
      api.stat('niuniu_peek');
    }
    // ---------- 粉鑽：換一張牌 ----------
    async function doSwap(btn) {
      if (!rd || rd.phase !== 'look' || rd.swapped || rd.busy) return;
      const hand = rd.hands[0];
      let idx = rd.sel;
      if (idx < 0) {
        const bs = NN.bestSwap(hand);
        if (bs.index < 0 || bs.gain <= 0.004) { api.toast('這手牌已經很漂亮了，建議直接亮牌 ♥'); api.sound.ding(); return; }
        idx = bs.index;
      }
      if (!api.spendGems(SWAP)) return;
      rd.swapped = true; rd.busy = true;
      setAux([{ id: 'swap', label: '換一張牌', used: '已換牌', price: SWAP, off: true }]);
      const R = run;
      const oldEl = rd.els[0][idx];
      const slot = oldEl.parentElement;
      oldEl.classList.remove('sel');
      await R.wait(C.anim(oldEl, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-130px) rotate(28deg) scale(.6)', opacity: 0 }], { duration: 380, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' }));
      oldEl.remove();
      const before = rd.evs[0];
      const nc = rd.deck.shift();
      hand[idx] = nc;
      const ne = C.cardEl(nc, { size: 'lg' });
      slot.appendChild(ne);
      rd.els[0][idx] = ne;
      C.sfx.deal();
      await R.wait(C.dealFly(ne, deckPt(), { dur: 360 }));
      C.flip(ne, true); C.sfx.flip();
      await R.sleep(460);
      const ev = NN.evaluate(hand);
      rd.evs[0] = ev; rd.sel = -1;
      await R.wait(arrange(0, ev));
      badge(0, ev);
      if (ev.key > before.key) { C.sfx.sparkle(); const p = C.ctr(ne); api.fx.burst(p.x, p.y, 14, ['spark', 'heart']); msg(`換到了！<b>${ev.name}</b>`, 'gold'); }
      else msg(`妳的牌：<b>${ev.name}</b>`);
      api.stat('niuniu_swap');
      rd.busy = false;
    }
    function onMyCard(e) {
      if (!rd || rd.phase !== 'look' || rd.swapped || rd.busy) return;
      const el = e.target.closest('.ec-card'); if (!el) return;
      const idx = rd.els[0].indexOf(el); if (idx < 0) return;
      rd.sel = rd.sel === idx ? -1 : idx;
      rd.els[0].forEach((x, k) => x.classList.toggle('sel', k === rd.sel));
      api.sound.click(); api.vib(6);
      const b = G.querySelector('.nn-aux [data-a="swap"]');
      if (b && !b.dataset.confirm) b.firstChild.textContent = rd.sel >= 0 ? '換這張' : '換一張牌';
    }

    // ---------- 自動玩 ----------
    async function autoSheet() {
      api.sound.click();
      if (auto.left > 0) {
        auto.left = 0; run.speed = 1;
        G.querySelector('.nn-autob').classList.remove('on');
        G.querySelector('.nn-autob span').textContent = '自動';
        api.toast('自動玩會在這局結束後停止');
        return;
      }
      const v = await C.sheet(body, {
        title: '自動玩', cls: 'nn-autosheet',
        html: '<p class="ec-p">系統會依手牌強弱，幫妳<b>搶莊、下注、亮牌</b>（保守打法，不會花粉鑽），連續玩好幾局。<br>隨時可以按右上角「停止」。</p>',
        buttons: [{ id: '5', label: '5 局', cls: 'ghost' }, { id: '10', label: '10 局' }, { id: '20', label: '20 局', cls: 'goldb' }],
      });
      if (!v || screen !== 'game') return;
      auto.left = auto.total = +v; auto.done = 0;
      run.speed = 0.42;
      G.querySelector('.nn-autob').classList.add('on');
      G.querySelector('.nn-autob span').textContent = '停止';
      G.querySelector('.nn-round').textContent = `自動 1/${auto.total}`;
      api.toast(`自動玩 ${auto.total} 局開始！`, 'gold');
      if (pending) pending.autoPick();
    }

    showTitle();
  }

  (W.ErikaGames = W.ErikaGames || []).push({
    id: 'niuniu', order: 3, name: '貴婦妞妞', tagline: '比牛牛・搶莊下注', color: '#c23767', color2: '#4b1430', badge: '新',
    art: api => `<img src="${api.cast()[3].full}" alt="" style="height:96%;left:50%;bottom:-6%;transform:translateX(-50%)"><svg viewBox="0 0 120 80" aria-hidden="true" style="position:absolute;left:4%;bottom:26%;width:52%;filter:drop-shadow(0 4px 6px rgba(40,0,20,.45))"><defs><linearGradient id="nnl-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3cf"/><stop offset=".5" stop-color="#d9b062"/><stop offset="1" stop-color="#9c742f"/></linearGradient></defs>${[-18, -6, 6, 18].map((a, i) => `<g transform="translate(60 74) rotate(${a}) translate(-17 -56)"><rect width="34" height="48" rx="4" fill="#fffaf0" stroke="url(#nnl-g)" stroke-width="1.6"/><text x="6" y="15" font-size="12" font-weight="700" font-family="Georgia,serif" fill="${i % 2 ? '#46194f' : '#b3264f'}">${['K', 'Q', 'J', 'A'][i]}</text><text x="17" y="36" text-anchor="middle" font-size="16" fill="${i % 2 ? '#46194f' : '#b3264f'}">${['♥', '♠', '♦', '♣'][i]}</text></g>`).join('')}</svg>`,
    open,
  });
})();
