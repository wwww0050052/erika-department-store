// 名媛之塔：畫面（主頁、攀塔、衣帽間、福袋、儲值、劇情）
'use strict';

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = DT.esc, pad = DT.pad;
  const ui = DT.ui = {};
  let tab = 'home', battle = null, chapterOpen = 0;

  // ── 音效（WebAudio 合成，不用音檔） ─────────────
  let ac = null;
  DT.sfx = (name, n = 1) => {
    if (!DT.S || !DT.S.settings.sfx) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime;
      const tone = (f, d, type = 'sine', v = 0.12, at = 0, f2) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t + at);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + at + d);
        g.gain.setValueAtTime(v, t + at); g.gain.exponentialRampToValueAtTime(0.001, t + at + d);
        o.connect(g); g.connect(ac.destination); o.start(t + at); o.stop(t + at + d + 0.02);
      };
      const S = {
        pick: () => tone(660, 0.06, 'triangle', 0.06), swap: () => tone(900, 0.03, 'sine', 0.03), tap: () => tone(740, 0.05, 'triangle', 0.07),
        match: () => { const f = 520 * Math.pow(1.0595, Math.min(24, n * 2)); tone(f, 0.18, 'triangle', 0.1); tone(f * 1.5, 0.12, 'sine', 0.05, 0.03); },
        hit: () => tone(240, 0.09, 'square', 0.04, 0, 120), block: () => tone(180, 0.12, 'sawtooth', 0.04), kill: () => { tone(880, 0.1, 'triangle', 0.08); tone(1320, 0.18, 'triangle', 0.07, 0.08); },
        heal: () => { tone(660, 0.2, 'sine', 0.07); tone(990, 0.25, 'sine', 0.06, 0.1); }, ouch: () => tone(160, 0.25, 'sawtooth', 0.08, 0, 70),
        skill: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.07, i * 0.06)); },
        win: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.08, i * 0.1)); },
        lose: () => { [392, 330, 262].forEach((f, i) => tone(f, 0.35, 'sine', 0.08, i * 0.18)); },
        revive: () => { [262, 392, 523, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.08, i * 0.07)); },
        coin: () => { tone(1318, 0.08, 'square', 0.04); tone(1760, 0.16, 'square', 0.04, 0.07); },
        gacha: () => { for (let i = 0; i < 8; i++) tone(400 + i * 90, 0.08, 'triangle', 0.05, i * 0.06); },
        rare: () => { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.4, 'sine', 0.07, i * 0.08)); },
      };
      S[name] && S[name]();
    } catch { /* 沒有音效也沒關係 */ }
  };

  // ── 小工具：提示、對話框 ──────────────────────
  ui.toast = (msg) => {
    const box = $('#toasts');
    const d = document.createElement('div');
    d.className = 'toast'; d.textContent = msg;
    box.appendChild(d);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => d.classList.add('out'), 2300);
    setTimeout(() => d.remove(), 2800);
  };
  ui.modal = (html, buttons = [{ text: '好' }], opts = {}) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal ${opts.cls || ''}" role="dialog" aria-modal="true">${html}<div class="modal-btns">${buttons.map((b, i) => `<button class="btn ${b.primary ? 'primary' : ''} ${b.danger ? 'danger' : ''}" data-i="${i}">${b.text}</button>`).join('')}</div></div>`;
    const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 180); };
    wrap.querySelectorAll('.modal-btns .btn').forEach(btn => btn.onclick = () => { const b = buttons[+btn.dataset.i]; close(); b.fn && b.fn(); });
    if (!opts.noClose) wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    $('#modals').appendChild(wrap);
    if (opts.onMount) opts.onMount(wrap, close);
    return close;
  };

  // ── 上方資源列 ───────────────────────────
  ui.refreshBar = () => {
    const s = DT.S;
    DT.tickStamina();
    const max = DT.staminaMax();
    $('#bar').innerHTML = `
      <button class="r-lv" data-go="settings" aria-label="設定"><img src="img/icon/i${pad(leaderInst().id)}.webp" alt=""><span><b>Lv.${s.plv}</b><small>VIP ${DT.vipLevel()}</small></span></button>
      <div class="r-st"><span class="r-ic">⚡</span><div><b>${s.stamina}/${max}</b><i style="--f:${Math.min(1, s.stamina / max)}"></i></div><small class="r-tm">${s.stamina >= max ? '' : mmss(DT.nextStaminaIn())}</small></div>
      <div class="r-gold"><span class="r-ic coin">◉</span><b>${DT.fmt(s.gold)}</b></div>
      <button class="r-gem" data-go="shop"><span class="r-ic gem">◆</span><b>${s.gems.toLocaleString()}</b><em>＋</em></button>`;
    $('#bar').querySelectorAll('[data-go]').forEach(b => b.onclick = () => b.dataset.go === 'settings' ? settings() : go(b.dataset.go));
  };
  ui.refresh = () => { ui.refreshBar(); if (!battle) render(); };
  const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  setInterval(() => { if (DT.S && !battle) { const before = DT.S.stamina; DT.tickStamina(); if (DT.S.stamina !== before) DT.save(); ui.refreshBar(); } }, 1000);

  const leaderInst = () => DT.cardByUid(DT.S.team[0]) || DT.S.cards[0];
  const teamInsts = () => DT.S.team.map(DT.cardByUid).filter(Boolean);

  // ── 分頁 ────────────────────────────────
  function go(t) { tab = t; if (t !== 'tower') chapterOpen = 0; render(); DT.sfx('tap'); }
  function render() {
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const v = $('#view');
    v.scrollTop = 0;
    ({ home, tower, closet, gacha, shop }[tab] || home)(v);
    ui.refreshBar();
  }

  // ── 主頁 ────────────────────────────────
  function home(v) {
    const L = leaderInst(), c = DT.CARD[L.id];
    const next = Math.min(100, DT.highestCleared() + 1);
    const st = DT.STAGES[next - 1], ch = DT.CHAPTERS[st.chapter - 1];
    const done = DT.highestCleared() >= 100;
    v.innerHTML = `
      <div class="home">
        <div class="home-art"><img src="img/card/c${pad(c.id)}.webp" alt="${esc(c.name)}"><div class="home-fade"></div>
          <div class="home-quote">「${esc(c.quote)}」<small>— ${esc(c.name)}</small></div></div>
        <div class="home-logo"><small>TOWER OF DIVAS</small>名媛之塔</div>
        <div class="home-card">
          <div class="hc-ch">${esc(ch.sub)}</div>
          <div class="hc-t">${done ? '已登頂！重溫任一層吧' : `${next}F｜${esc(st.name)}`}</div>
          <div class="tower-bar"><i style="width:${DT.highestCleared()}%"></i><span>${DT.highestCleared()} / 100 層</span></div>
          <button class="btn primary big" id="goNext">${done ? '前往名媛之塔' : '繼續攀塔'} <small>⚡${st.stamina}</small></button>
        </div>
        <div class="home-grid">
          <button data-go="gacha"><span class="hg-ic">👜</span>名牌福袋<small>${DT.S.tickets6 + DT.S.tickets5 ? '有確定券！' : '★6 機率 3%'}</small></button>
          <button data-go="closet"><span class="hg-ic">👠</span>衣帽間<small>${DT.S.cards.length}/${DT.CARDS.length} 種身分</small></button>
          <button data-go="shop"><span class="hg-ic">💎</span>儲值<small>${Object.keys(DT.S.purchases).length ? 'VIP ' + DT.vipLevel() : '首儲雙倍'}</small></button>
          <button id="story"><span class="hg-ic">📖</span>回憶錄<small>重看劇情</small></button>
        </div>
      </div>`;
    $('#goNext').onclick = () => done ? go('tower') : prepareStage(next);
    v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    $('#story').onclick = storyMenu;
  }

  // ── 攀塔（章節＋樓層） ──────────────────────
  function tower(v) {
    if (chapterOpen) return chapterView(v, chapterOpen);
    const hi = DT.highestCleared();
    v.innerHTML = `<h2 class="sec-t">名媛之塔<small>${hi}/100 層</small></h2><div class="chapters">${DT.CHAPTERS.map(ch => {
      const first = (ch.no - 1) * 10 + 1;
      const unlocked = DT.isUnlocked(first);
      let n = 0; for (let f = first; f < first + 10; f++) if (DT.S.cleared[f]) n++;
      return `<button class="chap${unlocked ? '' : ' locked'}${n === 10 ? ' done' : ''}" data-ch="${ch.no}" ${unlocked ? '' : 'disabled'}>
        <img src="img/card/c${pad(ch.img)}.webp" alt="" loading="lazy">
        <div class="chap-in"><small>${esc(ch.sub)}</small><b>${esc(ch.title)}</b><span>${first}F – ${first + 9}F</span></div>
        <div class="chap-p">${unlocked ? `${n}/10` : '🔒'}</div>
        <div class="chap-boss">${DT.monsterSVG({ ...ch.boss, boss: true })}</div>
      </button>`;
    }).reverse().join('')}</div>`;
    v.querySelectorAll('.chap').forEach(b => b.onclick = () => { chapterOpen = +b.dataset.ch; render(); });
  }
  function chapterView(v, no) {
    const ch = DT.CHAPTERS[no - 1];
    const first = (no - 1) * 10 + 1;
    v.innerHTML = `
      <div class="chv-head" style="--img:url(${DT.absImg(ch.img)})"><button class="back" id="back">‹ 章節</button>
        <div><small>${esc(ch.sub)}</small><h2>${esc(ch.title)}</h2><button class="btn tiny" id="replay">📖 章節劇情</button></div></div>
      <div class="floors">${DT.STAGES.slice(first - 1, first + 9).map(st => {
        const un = DT.isUnlocked(st.floor), cl = DT.S.cleared[st.floor];
        const foes = []; st.waves.forEach(w => w.forEach(f => { if (!foes.find(x => x.kind === f.kind && x.attr === f.attr)) foes.push(f); }));
        return `<button class="floor${un ? '' : ' locked'}${st.k === 10 ? ' boss' : st.k === 5 ? ' elite' : ''}" data-f="${st.floor}" ${un ? '' : 'disabled'}>
          <div class="fl-no">${st.floor}<small>F</small></div>
          <div class="fl-info"><b>${esc(st.name)}</b><span>${st.waves.length} 波・⚡${st.stamina}${!cl && st.gems ? `・首通 <em class="gem">◆${st.gems}</em>` : ''}${st.k === 10 && !cl ? '・身分卡' : ''}</span>
            <div class="fl-foes">${foes.slice(0, 5).map(f => DT.attrIcon(f.attr, 16)).join('')}</div></div>
          <div class="fl-r">${cl ? '<span class="crowns">' + '♛'.repeat(cl) + '<i>' + '♛'.repeat(3 - cl) + '</i></span>' : un ? '<span class="new">NEW</span>' : '🔒'}</div>
        </button>`;
      }).join('')}</div>`;
    $('#back').onclick = () => { chapterOpen = 0; render(); };
    $('#replay').onclick = () => playStory(ch.intro, ch, () => {});
    v.querySelectorAll('.floor').forEach(b => b.onclick = () => prepareStage(+b.dataset.f));
  }

  // ── 出戰準備：選閨蜜 ────────────────────────
  function makeFriends(floor) {
    const out = [];
    const used = new Set();
    const names = DT.shuffle(DT.FRIENDS.slice());
    for (let i = 0; i < 3; i++) {
      const rMax = Math.min(6, 3 + Math.floor(floor / 18) + (i === 0 ? 1 : 0));
      const rMin = Math.max(3, rMax - 2);
      const pool = DT.CARDS.filter(c => c.rarity >= rMin && c.rarity <= rMax && !used.has(c.id));
      const c = pool[Math.floor(Math.random() * pool.length)];
      used.add(c.id);
      const maxLv = DT.RARITY_MAXLV[c.rarity];
      const lv = Math.max(1, Math.min(maxLv, Math.round(maxLv * Math.min(1, 0.25 + floor / 110) * (0.85 + Math.random() * 0.15))));
      out.push({ id: c.id, lv, star: Math.min(5, Math.floor(floor / 25)), friend: names[i] });
    }
    return out;
  }
  function prepareStage(floor) {
    const st = DT.STAGES[floor - 1];
    if (!DT.isUnlocked(floor)) return ui.toast('請先通過上一層');
    if (!teamInsts().length) return ui.toast('隊伍裡至少要有一張卡');
    const ch = DT.CHAPTERS[st.chapter - 1];
    // 劇情：章節開頭、第 5 層、魔王前（只在第一次）
    const key = st.k === 1 ? 'intro' : st.k === 5 ? 'mid' : st.k === 10 ? 'pre' : null;
    const sid = `${st.chapter}-${key}`;
    if (key && !DT.S.storySeen[sid] && !DT.S.cleared[floor]) {
      DT.S.storySeen[sid] = 1; DT.save();
      return playStory(ch[key], ch, () => prepareStage(floor));
    }
    const friends = makeFriends(floor);
    const team = teamInsts();
    let pick = 0;
    const foes = [].concat(...st.waves);
    ui.modal(`
      <div class="prep-h"><small>${esc(ch.sub)}</small><h3>${floor}F｜${esc(st.name)}</h3></div>
      <div class="prep-foes">${foes.filter((f, i, a) => a.findIndex(x => x.name === f.name) === i).slice(0, 4).map(f => `<div class="pf">${DT.monsterSVG(f)}<span>${DT.attrIcon(f.attr, 14)}${esc(f.name)}</span>${f.ability ? `<em>${esc(DT.ABILITY_TEXT[f.ability.type](f.ability))}</em>` : ''}</div>`).join('')}</div>
      <div class="prep-team">${team.map((t, i) => `<div class="pt attr-${DT.CARD[t.id].attr}"><img src="img/icon/i${pad(t.id)}.webp" alt=""><small>Lv${t.lv}</small>${i === 0 ? '<b>隊長</b>' : ''}</div>`).join('')}</div>
      <p class="muted">選一位閨蜜助戰（她的隊長技也會生效）</p>
      <div class="friends">${friends.map((f, i) => { const c = DT.CARD[f.id]; return `<button class="friend${i === 0 ? ' on' : ''}" data-i="${i}">
        <img src="img/icon/i${pad(f.id)}.webp" alt=""><div><b>${f.friend.name}</b><small>${f.friend.tagline}</small>
        <span>${DT.attrIcon(c.attr, 14)} ${esc(c.name)} ${DT.stars(c.rarity)} Lv${f.lv}</span><em>${esc(c.leader.desc)}</em></div></button>`; }).join('')}</div>`,
      [{ text: `出發！ <small>⚡${st.stamina}</small>`, primary: true, fn: () => startBattle(floor, friends[pick]) }, { text: '再想想' }],
      { cls: 'prep', onMount: (w) => { w.querySelectorAll('.friend').forEach(b => b.onclick = () => { pick = +b.dataset.i; w.querySelectorAll('.friend').forEach(x => x.classList.toggle('on', x === b)); }); } });
  }
  function startBattle(floor, helper) {
    const st = DT.STAGES[floor - 1];
    DT.tickStamina();
    if (DT.S.stamina < st.stamina) {
      return ui.modal(`<h3>體力不足</h3><p>需要 ⚡${st.stamina}，目前 ⚡${DT.S.stamina}。</p><p>花 <b class="gem">3 粉鑽</b> 補滿體力嗎？</p>`,
        [{ text: '補滿體力（3 粉鑽）', primary: true, fn: () => { if (refillStamina()) startBattle(floor, helper); } }, { text: '取消' }]);
    }
    DT.S.stamina -= st.stamina; DT.save();
    document.body.classList.add('in-battle');
    const root = $('#battle');
    root.hidden = false;
    battle = new DT.Battle(root, st, teamInsts(), helper, res => endBattle(floor, res));
  }
  function refillStamina() {
    if (DT.S.gems < 3) { ui.toast('粉鑽不夠，先去儲值吧'); go('shop'); return false; }
    DT.S.gems -= 3; DT.S.stamina = Math.max(DT.S.stamina, DT.staminaMax()); DT.save(); ui.refreshBar(); ui.toast('體力補滿了！'); return true;
  }
  function endBattle(floor, res) {
    const st = DT.STAGES[floor - 1], ch = DT.CHAPTERS[st.chapter - 1];
    battle = null;
    const root = $('#battle'); root.hidden = true; root.innerHTML = '';
    document.body.classList.remove('in-battle');
    if (!res.win) { ui.toast(res.quit ? '已放棄挑戰' : '下次會更好的！先去培育卡片吧'); render(); return; }
    const s = DT.S, first = !s.cleared[floor];
    s.cleared[floor] = Math.max(s.cleared[floor] || 0, res.rank);
    const gold = Math.round(st.gold * DT.goldMult() * (first ? 2 : 1));
    const expMul = DT.vipLevel() >= 5 ? 1.1 : 1;
    s.gold += gold;
    const pUps = DT.gainPlayerExp(Math.round(st.exp * 0.6 * expMul));
    const ups = teamInsts().map(t => ({ t, n: DT.giveExp(t, Math.round(st.exp * expMul)) }));
    let gems = 0, reward = null;
    if (first) {
      gems = st.gems; s.gems += gems;
      if (st.k === 10) reward = DT.addCard(ch.reward, true);
    }
    DT.saveNow();
    DT.sfx('coin');
    const show = () => ui.modal(`
      <div class="win-h">VICTORY<small>${floor}F 通關</small></div>
      <div class="crowns big">${'♛'.repeat(res.rank)}<i>${'♛'.repeat(3 - res.rank)}</i></div>
      <div class="win-rw"><span><i class="r-ic coin">◉</i> ${gold.toLocaleString()}${first ? ' <small>首通 ×2</small>' : ''}</span>${gems ? `<span><i class="r-ic gem">◆</i> ${gems}</span>` : ''}<span>EXP ${Math.round(st.exp * expMul)}</span></div>
      ${pUps ? `<p class="lvup">名媛等級提升到 Lv.${s.plv}！體力補滿</p>` : ''}
      <div class="win-team">${ups.map(u => `<div class="pt attr-${DT.CARD[u.t.id].attr}"><img src="img/icon/i${pad(u.t.id)}.webp" alt=""><small>Lv${u.t.lv}</small>${u.n ? '<b class="up">UP</b>' : ''}</div>`).join('')}</div>`,
      floor < 100 ? [{ text: `下一層 ${floor + 1}F`, primary: true, fn: () => { render(); prepareStage(floor + 1); } }, { text: '回到樓層', fn: () => { tab = 'tower'; chapterOpen = st.chapter; render(); } }] : [{ text: '太好了', primary: true, fn: render }],
      { cls: 'win', noClose: true });
    const afterStory = () => {
      if (reward) cardReveal([reward], () => { if (floor === 100) ending(); else show(); }, '章節獎勵：新身分解鎖');
      else show();
    };
    if (first && st.k === 10) { s.storySeen[`${st.chapter}-outro`] = 1; playStory(ch.outro, ch, afterStory); }
    else afterStory();
    render();
  }
  function ending() {
    ui.modal(`<div class="ending"><img src="img/card/c17.webp" alt=""><h3>全 100 層制霸</h3><p>從巷口到頂樓，每一個身分都是妳。</p><p class="muted">恭喜登頂名媛之塔！可以回頭把每一層都拿到三皇冠，或繼續收集所有身分卡。</p></div>`,
      [{ text: '謝謝妳，Erika', primary: true, fn: render }], { cls: 'win' });
  }

  // ── 劇情 ────────────────────────────────
  function playStory(lines, ch, done) {
    const ov = $('#story-ov');
    let i = 0, typing = null;
    ov.hidden = false;
    ov.innerHTML = `<div class="st-bg" style="background-image:url(img/card/c${pad(ch.img)}.webp)"></div><div class="st-shade"></div>
      <div class="st-title"><small>${esc(ch.sub)}</small>${esc(ch.title)}</div>
      <div class="st-boss"></div>
      <div class="st-box"><div class="st-name"></div><div class="st-text"></div><div class="st-next">▼</div></div>
      <button class="st-skip">跳過 ›</button>`;
    const showLine = () => {
      const [who, text] = lines[i];
      const isBoss = who === ch.boss.name;
      $('.st-name', ov).textContent = who === '旁白' ? '' : who;
      $('.st-name', ov).className = 'st-name' + (who === 'Erika' ? ' erika' : isBoss ? ' boss' : '');
      $('.st-boss', ov).innerHTML = isBoss ? DT.monsterSVG({ ...ch.boss, boss: true }) : '';
      $('.st-boss', ov).classList.toggle('on', isBoss);
      $('.st-bg', ov).classList.toggle('dim', isBoss);
      const el = $('.st-text', ov);
      el.classList.toggle('narr', who === '旁白');
      let k = 0; clearInterval(typing);
      typing = setInterval(() => { k++; el.textContent = text.slice(0, k); if (k >= text.length) { clearInterval(typing); typing = null; } }, 32);
    };
    const finish = () => { clearInterval(typing); ov.onclick = null; ov.hidden = true; ov.innerHTML = ''; done && done(); };
    ov.onclick = (e) => {
      if (e.target.classList.contains('st-skip')) return finish();
      if (typing) { clearInterval(typing); typing = null; $('.st-text', ov).textContent = lines[i][1]; return; }
      i++; DT.sfx('tap');
      if (i >= lines.length) finish(); else showLine();
    };
    showLine();
  }
  function storyMenu() {
    const items = [];
    DT.CHAPTERS.forEach(ch => ['intro', 'mid', 'pre', 'outro'].forEach(k => { if (DT.S.storySeen[`${ch.no}-${k}`]) items.push({ ch, k }); }));
    const label = { intro: '序幕', mid: '途中', pre: '魔王', outro: '終幕' };
    ui.modal(`<h3>回憶錄</h3>${items.length ? `<div class="mem-list">${items.map((it, i) => `<button class="btn" data-i="${i}">第 ${it.ch.no} 章 ${esc(it.ch.title)}・${label[it.k]}</button>`).join('')}</div>` : '<p class="muted">還沒有看過任何劇情，先去攀塔吧！</p>'}`,
      [{ text: '關閉' }], { onMount: (w, close) => w.querySelectorAll('.mem-list .btn').forEach(b => b.onclick = () => { close(); const it = items[+b.dataset.i]; playStory(it.ch[it.k], it.ch, () => {}); }) });
  }

  // ── 衣帽間（隊伍與卡片） ─────────────────────
  let closetSort = 'rarity';
  function closet(v) {
    const s = DT.S, team = teamInsts();
    const cards = s.cards.slice().sort(closetSort === 'rarity'
      ? (a, b) => DT.CARD[b.id].rarity - DT.CARD[a.id].rarity || b.lv - a.lv
      : closetSort === 'attr' ? (a, b) => Object.keys(DT.ATTRS).indexOf(DT.CARD[a.id].attr) - Object.keys(DT.ATTRS).indexOf(DT.CARD[b.id].attr) || DT.CARD[b.id].rarity - DT.CARD[a.id].rarity
        : (a, b) => b.lv - a.lv);
    const L = team[0] && DT.CARD[team[0].id].leader;
    const tHp = team.reduce((a, t) => a + DT.statsOf(t).hp, 0);
    v.innerHTML = `
      <h2 class="sec-t">衣帽間<small>${s.cards.length}/${DT.CARDS.length} 種身分</small></h2>
      <div class="team-box">
        <div class="team-slots">${[0, 1, 2, 3, 4].map(i => { const t = team[i]; return t
          ? `<button class="slot attr-${DT.CARD[t.id].attr}" data-s="${i}"><img src="img/icon/i${pad(t.id)}.webp" alt=""><small>Lv${t.lv}</small>${i === 0 ? '<b>隊長</b>' : ''}</button>`
          : `<button class="slot empty" data-s="${i}">＋</button>`; }).join('')}</div>
        <div class="team-info">${L ? `<b>隊長技｜${esc(L.name)}</b>${esc(L.desc)}` : ''}<span>隊伍生命 ${tHp.toLocaleString()}（未含隊長技）</span></div>
      </div>
      <div class="sortbar">排序：${[['rarity', '稀有度'], ['attr', '屬性'], ['lv', '等級']].map(([k, t]) => `<button class="${closetSort === k ? 'on' : ''}" data-sort="${k}">${t}</button>`).join('')}</div>
      <div class="card-grid">${cards.map(c => cardTile(c)).join('')}
        ${DT.CARDS.filter(c => !s.cards.find(x => x.id === c.id)).sort((a, b) => a.rarity - b.rarity).map(c => `<div class="tile unknown"><div class="t-img">?</div><span>${DT.stars(c.rarity)}</span></div>`).join('')}</div>`;
    v.querySelectorAll('.slot').forEach(b => b.onclick = () => pickForSlot(+b.dataset.s));
    v.querySelectorAll('.tile[data-uid]').forEach(b => b.onclick = () => cardDetail(+b.dataset.uid));
    v.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { closetSort = b.dataset.sort; render(); });
  }
  function cardTile(c, extra = '') {
    const card = DT.CARD[c.id], inTeam = DT.S.team.indexOf(c.uid);
    return `<button class="tile attr-${card.attr} r${card.rarity}" data-uid="${c.uid}" ${extra}>
      <div class="t-img"><img src="img/icon/i${pad(c.id)}.webp" alt="" loading="lazy">${DT.attrIcon(card.attr, 18)}${inTeam >= 0 ? `<b class="t-team">${inTeam === 0 ? '隊長' : '隊伍'}</b>` : ''}${c.star ? `<b class="t-star">+${c.star}</b>` : ''}</div>
      <span>${DT.stars(card.rarity)}</span><small>${esc(card.name)}</small><small class="t-lv">Lv.${c.lv}</small></button>`;
  }
  function pickForSlot(slot) {
    const s = DT.S;
    const cur = s.team[slot];
    const cards = s.cards.slice().sort((a, b) => DT.CARD[b.id].rarity - DT.CARD[a.id].rarity || b.lv - a.lv);
    ui.modal(`<h3>${slot === 0 ? '選擇隊長' : `第 ${slot + 1} 位隊員`}</h3><div class="card-grid pick">${cards.map(c => cardTile(c)).join('')}</div>`,
      cur && slot !== 0 ? [{ text: '移出隊伍', danger: true, fn: () => { s.team.splice(slot, 1); DT.save(); render(); } }, { text: '取消' }] : [{ text: '取消' }],
      { cls: 'wide', onMount: (w, close) => w.querySelectorAll('.tile').forEach(b => b.onclick = () => {
        const uid = +b.dataset.uid, at = s.team.indexOf(uid);
        if (at >= 0 && cur) { s.team[at] = cur; s.team[slot] = uid; }       // 對調
        else if (at >= 0) { s.team.splice(at, 1); s.team.push(uid); }       // 移到最後
        else if (slot < s.team.length) s.team[slot] = uid;
        else s.team.push(uid);
        s.team = s.team.filter(Boolean).slice(0, 5);
        DT.save(); close(); render();
      }) });
  }
  function cardDetail(uid) {
    const s = DT.S, inst = DT.cardByUid(uid), card = DT.CARD[inst.id];
    const st = DT.statsOf(inst), max = DT.maxLv(inst);
    const c1 = DT.trainCost(inst, 1), c10 = DT.trainCost(inst, 10), cMax = DT.trainCost(inst, 999);
    const att = DT.ATTRS[card.attr];
    const close = ui.modal(`
      <div class="cd-art attr-${card.attr}"><img src="img/card/c${pad(card.id)}.webp" alt="${esc(card.name)}">
        <div class="cd-top">${DT.attrIcon(card.attr, 26)}<div><b>${esc(card.name)}</b><small>${esc(card.title)}</small></div></div>
        <div class="cd-bot">${DT.stars(card.rarity)}${inst.star ? `<em>突破 +${inst.star}</em>` : ''}</div></div>
      <div class="cd-q">「${esc(card.quote)}」</div>
      <div class="cd-stats"><div><small>等級</small><b>${inst.lv}<i>/${max}</i></b></div><div><small>生命</small><b>${st.hp.toLocaleString()}</b></div><div><small>攻擊</small><b>${st.atk.toLocaleString()}</b></div><div><small>回復</small><b>${st.rec.toLocaleString()}</b></div></div>
      ${inst.lv < max ? `<div class="cd-exp"><i style="width:${inst.exp / DT.expToNext(card, inst.lv) * 100}%"></i></div>` : ''}
      <div class="sk-box"><b>主動技｜${esc(card.skill.name)}</b><p>${esc(card.skill.desc)}</p><small>冷卻 ${DT.skillCd(inst)} 回合${inst.star >= 2 ? `（突破已縮短 ${card.skill.cd - DT.skillCd(inst)}）` : ''}</small></div>
      <div class="sk-box lead"><b>隊長技｜${esc(card.leader.name)}</b><p>${esc(card.leader.desc)}</p></div>
      <p class="muted small">屬性：${att.name}（剋 ${DT.ATTRS[att.beats].name}）・重複抽到可突破，最多 +5（全能力 +8%／級，每 2 級技能冷卻 −1）</p>
      ${inst.lv < max ? `<div class="train"><button class="btn" data-n="1" ${s.gold < c1 ? 'disabled' : ''}>培育 +1<small>◉${DT.fmt(c1)}</small></button><button class="btn" data-n="10" ${s.gold < c10 ? 'disabled' : ''}>+10<small>◉${DT.fmt(c10)}</small></button><button class="btn" data-n="999" ${s.gold < cMax ? 'disabled' : ''}>到滿級<small>◉${DT.fmt(cMax)}</small></button></div>` : '<p class="maxed">已達最高等級 ✦</p>'}`,
      [s.team[0] !== uid ? { text: '設為隊長', primary: true, fn: () => { s.team = [uid, ...s.team.filter(x => x !== uid)].slice(0, 5); DT.save(); render(); ui.toast(`${card.name} 成為隊長`); } } : { text: '隊長中', primary: true }, { text: '關閉' }],
      { cls: 'card-detail', onMount: (w, cl) => w.querySelectorAll('.train .btn').forEach(b => b.onclick = () => {
        const n = +b.dataset.n, cost = DT.trainCost(inst, n);
        if (s.gold < cost) return ui.toast('金幣不夠');
        s.gold -= cost;
        const ups = DT.giveExp(inst, cost);
        DT.save(); DT.sfx('coin'); ui.toast(`${card.name} 升了 ${ups} 級！`);
        cl(); setTimeout(() => cardDetail(uid), 200); render();
      }) });
    return close;
  }

  // ── 名牌福袋 ────────────────────────────
  function gacha(v) {
    const s = DT.S, G = DT.GACHA;
    v.innerHTML = `
      <div class="gacha">
        <div class="ga-banner"><div class="ga-imgs">${[10, 22, 17].map((id, i) => `<img src="img/card/c${pad(id)}.webp" alt="" class="g${i}">`).join('')}</div>
          <div class="ga-title"><small>LIMITED ・ MAISON ERIKA</small>名牌福袋<span>★6「台灣小姐」「貂皮名媛」「女總裁」登場中</span></div></div>
        <div class="ga-pity">再 <b>${G.pity - s.pity}</b> 抽內必出 ★6・十連保底 ★5</div>
        <div class="ga-btns">
          <button class="btn gbtn" id="g1"><b>單抽</b><span><i class="r-ic gem">◆</i>${G.single}</span></button>
          <button class="btn gbtn primary" id="g10"><b>十連抽</b><span><i class="r-ic gem">◆</i>${G.ten}</span><em>9 折＋保底</em></button>
        </div>
        ${s.tickets5 || s.tickets6 ? `<div class="ga-btns">${s.tickets6 ? `<button class="btn gbtn gold" id="t6"><b>★6 確定券</b><span>×${s.tickets6}</span></button>` : ''}${s.tickets5 ? `<button class="btn gbtn gold" id="t5"><b>★5 確定券</b><span>×${s.tickets5}</span></button>` : ''}</div>` : ''}
        <div class="ga-rates"><b>出現機率</b>${G.rates.map(r => `<span>${DT.stars(r.r)} ${(r.p * 100).toFixed(0)}%</span>`).join('')}<small>重複抽到會「突破」，突破滿了換成金幣。已抽 ${s.pulls} 次。</small></div>
        <div class="ga-pool">${DT.CARDS.filter(c => c.rarity >= 5).sort((a, b) => b.rarity - a.rarity).map(c => `<div class="gp${s.seen[c.id] ? '' : ' unseen'}"><img src="img/icon/i${pad(c.id)}.webp" alt=""><span>${DT.stars(c.rarity)}</span></div>`).join('')}</div>
      </div>`;
    $('#g1').onclick = () => doPull(1);
    $('#g10').onclick = () => doPull(10);
    $('#t5') && ($('#t5').onclick = () => { s.tickets5--; cardReveal(DT.pull(1, { ticket: 5 }), render); });
    $('#t6') && ($('#t6').onclick = () => { s.tickets6--; cardReveal(DT.pull(1, { ticket: 6 }), render); });
  }
  function doPull(n) {
    const s = DT.S, cost = n === 10 ? DT.GACHA.ten : DT.GACHA.single;
    if (s.gems < cost) {
      return ui.modal(`<h3>粉鑽不足</h3><p>${n === 10 ? '十連抽' : '單抽'}需要 <b class="gem">◆${cost}</b>，目前只有 ◆${s.gems}。</p>`, [{ text: '前往儲值', primary: true, fn: () => go('shop') }, { text: '取消' }]);
    }
    s.gems -= cost;
    const res = DT.pull(n);
    ui.refreshBar();
    cardReveal(res, render);
  }
  // 抽卡／獲得卡片的開箱動畫
  function cardReveal(res, done, title) {
    const best = Math.max(...res.map(r => DT.CARD[r.card.id].rarity));
    const ov = document.createElement('div');
    ov.className = 'reveal r' + best;
    ov.innerHTML = `<div class="rv-bag"><svg viewBox="0 0 200 220" aria-hidden="true"><defs><linearGradient id="rvb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd7e6"/><stop offset=".5" stop-color="#f08bb4"/><stop offset="1" stop-color="#b83e78"/></linearGradient></defs><path d="M68 70 Q68 18 100 18 Q132 18 132 70" fill="none" stroke="#7a2350" stroke-width="10" stroke-linecap="round"/><path d="M30 66 H170 L184 200 Q184 210 174 210 H26 Q16 210 16 200 Z" fill="url(#rvb)"/><path d="M30 66 H170 L166 86 H34 Z" fill="#7a2350" opacity=".5"/><text x="100" y="150" text-anchor="middle" font-family="Bodoni Moda,serif" font-size="30" font-weight="900" fill="#fff">ERIKA</text><text x="100" y="176" text-anchor="middle" font-size="12" fill="#fff" letter-spacing="4">MAISON</text></svg></div>
      <div class="rv-title">${title || ''}</div><div class="rv-cards"></div><button class="btn primary rv-ok" hidden>收下</button>`;
    document.body.appendChild(ov);
    DT.sfx('gacha');
    const skip = () => { clearTimeout(t); show(); };
    ov.addEventListener('click', skip, { once: true });
    const t = setTimeout(show, 1500);
    let shown = false;
    function show() {
      if (shown) return; shown = true;
      ov.classList.add('open');
      if (best >= 5) DT.sfx('rare');
      const box = $('.rv-cards', ov);
      box.className = 'rv-cards n' + (res.length > 1 ? 'm' : '1');
      box.innerHTML = res.map((r, i) => {
        const c = DT.CARD[r.card.id];
        const tag = !r.dup ? '<em class="new">NEW</em>' : r.star ? `<em>突破 +${r.star}</em>` : `<em>◉${DT.fmt(r.gold)}</em>`;
        return res.length > 1
          ? `<div class="rv-c attr-${c.attr} r${c.rarity}" style="animation-delay:${i * 0.08}s"><img src="img/icon/i${pad(c.id)}.webp" alt=""><span>${DT.stars(c.rarity)}</span><small>${esc(c.name)}</small>${tag}</div>`
          : `<div class="rv-big attr-${c.attr} r${c.rarity}"><img src="img/card/c${pad(c.id)}.webp" alt=""><div class="rv-info">${DT.attrIcon(c.attr, 22)}<b>${esc(c.name)}</b><span>${DT.stars(c.rarity)}</span>${tag}<small>「${esc(c.quote)}」</small></div></div>`;
      }).join('');
      const ok = $('.rv-ok', ov);
      setTimeout(() => { ok.hidden = false; }, 400);
      ok.onclick = (e) => { e.stopPropagation(); ov.remove(); ui.refreshBar(); done && done(); };
    }
  }

  // ── 儲值（模擬） ──────────────────────────
  function shop(v) {
    const s = DT.S, vip = DT.vipLevel(), nextT = DT.VIP[vip + 1];
    v.innerHTML = `
      <h2 class="sec-t">粉鑽商城<small>模擬儲值・不會真的扣款</small></h2>
      <div class="vip"><div class="vip-l">VIP<b>${vip}</b></div><div class="vip-r"><span>累積儲值 NT$${s.spent.toLocaleString()}${nextT ? `・再 NT$${(nextT - s.spent).toLocaleString()} 升 VIP ${vip + 1}` : '・已達最高 VIP'}</span>
        <div class="vip-bar"><i style="width:${nextT ? Math.min(100, (s.spent - DT.VIP[vip]) / (nextT - DT.VIP[vip]) * 100) : 100}%"></i></div>
        <small>${nextT ? `下一級：${DT.VIP_PERK[vip + 1]}` : DT.VIP_PERK[vip]}</small></div></div>
      <div class="packs">${DT.PACKS.map(p => {
        const sold = p.once && s.purchases[p.id];
        const active = p.id === 'monthly' && s.monthlyUntil > Date.now();
        return `<button class="pack${sold ? ' sold' : ''}" data-pack="${p.id}" ${sold ? 'disabled' : ''}><b>${esc(p.name)}</b><small>${esc(p.desc)}</small><span>${sold ? '已購買' : active ? `續約 NT$${p.ntd}` : `NT$${p.ntd}`}</span>${p.once && !sold ? '<em>限購 1 次</em>' : ''}${active ? `<em class="on">剩 ${Math.ceil((s.monthlyUntil - Date.now()) / 86400000)} 天</em>` : ''}</button>`;
      }).join('')}</div>
      <div class="gems">${DT.SHOP.map((p, i) => {
        const first = !s.purchases[p.id];
        return `<button class="gemp" data-gem="${p.id}">${first ? '<em class="dbl">首儲雙倍</em>' : p.tag ? `<em>${p.tag}</em>` : ''}
          <div class="gem-art">${'<i class="r-ic gem">◆</i>'.repeat(Math.min(5, i + 1))}</div>
          <b>◆ ${(p.gems + p.bonus + (first ? p.gems : 0)).toLocaleString()}</b><small>${p.bonus ? `含加贈 ${p.bonus}` : esc(p.name)}</small><span>NT$${p.ntd.toLocaleString()}</span></button>`;
      }).join('')}</div>
      <h3 class="sec-s">用粉鑽兌換</h3>
      <div class="ex">
        <button class="btn" id="ex-st">⚡ 體力補滿<small>◆3</small></button>
        <button class="btn" id="ex-gold">◉ 金幣 ×30,000<small>◆5</small></button>
      </div>
      ${s.orders.length ? `<h3 class="sec-s">購買紀錄</h3><div class="orders">${s.orders.slice(0, 8).map(o => `<div><span>${new Date(o.at).toLocaleString('zh-TW', { hour12: false })}</span><b>${esc(o.name)}</b><em>NT$${o.ntd}</em></div>`).join('')}</div>` : ''}
      <p class="muted small center">這是遊戲展示用的模擬商城：不會連到任何金流，也不會向你收費。</p>`;
    v.querySelectorAll('[data-gem]').forEach(b => b.onclick = () => checkout(DT.SHOP.find(p => p.id === b.dataset.gem)));
    v.querySelectorAll('[data-pack]').forEach(b => b.onclick = () => checkout(DT.PACKS.find(p => p.id === b.dataset.pack)));
    $('#ex-st').onclick = () => { if (refillStamina()) render(); };
    $('#ex-gold').onclick = () => { if (s.gems < 5) return ui.toast('粉鑽不夠'); s.gems -= 5; s.gold += 30000; DT.save(); DT.sfx('coin'); ui.toast('獲得 30,000 金幣'); render(); };
  }
  function checkout(item, after) {
    const first = item.bonus !== undefined && !DT.S.purchases[item.id];
    const gemsTxt = item.bonus !== undefined ? `◆ ${item.gems + item.bonus + (first ? item.gems : 0)}` : esc(item.desc);
    let method = 'card';
    ui.modal(`
      <div class="pay-h"><small>模擬結帳</small><h3>${esc(item.name)}</h3><div class="pay-amt">NT$ ${item.ntd.toLocaleString()}</div><p>${gemsTxt}</p></div>
      <div class="pay-m">${[['card', '💳', '信用卡'], ['apple', '', 'Apple Pay'], ['line', '🟩', 'LINE Pay'], ['jko', '🅹', '街口支付']].map(([k, ic, t], i) => `<button class="pm${i === 0 ? ' on' : ''}" data-m="${k}"><span>${ic}</span>${t}</button>`).join('')}</div>
      <p class="pay-note">⚠ 這是模擬儲值：按下付款不會連到任何金流、不會扣款，也不需要輸入任何卡號。</p>`,
      [{ text: `模擬付款 NT$${item.ntd.toLocaleString()}`, primary: true, fn: () => paying(item, method, after) }, { text: '取消' }],
      { cls: 'pay', onMount: w => w.querySelectorAll('.pm').forEach(b => b.onclick = () => { method = b.dataset.m; w.querySelectorAll('.pm').forEach(x => x.classList.toggle('on', x === b)); }) });
  }
  function paying(item, method, after) {
    const close = ui.modal(`<div class="paying"><div class="spin"></div><p>付款處理中…</p><small>（模擬）</small></div>`, [], { noClose: true });
    setTimeout(() => {
      close();
      const { got, order } = DT.buy(item);
      DT.sfx('rare');
      ui.refreshBar();
      ui.modal(`<div class="paid"><div class="ok">✓</div><h3>儲值成功</h3><p class="muted">訂單 ${order.no}・${{ card: '信用卡', apple: 'Apple Pay', line: 'LINE Pay', jko: '街口支付' }[method]}（模擬）</p><ul>${got.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>`,
        [{ text: '太棒了', primary: true, fn: () => { if (after) after(); else render(); } }]);
    }, 1300);
  }
  // 戰鬥中想復活卻沒粉鑽：開一個小商城
  ui.openShop = (after) => {
    ui.modal(`<h3>粉鑽不足</h3><p>補妝復活需要 ◆${DT.REVIVE_COST}</p><div class="gems mini">${DT.SHOP.slice(0, 3).map(p => `<button class="gemp" data-gem="${p.id}"><b>◆ ${p.gems + p.bonus + (!DT.S.purchases[p.id] ? p.gems : 0)}</b><span>NT$${p.ntd}</span></button>`).join('')}</div>`,
      [{ text: '不用了', fn: after }], { noClose: true, onMount: (w, close) => w.querySelectorAll('[data-gem]').forEach(b => b.onclick = () => { close(); checkout(DT.SHOP.find(p => p.id === b.dataset.gem), after); }) });
  };

  // ── 設定 ────────────────────────────────
  function settings() {
    const s = DT.S;
    ui.modal(`<h3>設定</h3>
      <div class="set-row"><span>名媛等級 Lv.${s.plv}</span><div class="cd-exp"><i style="width:${s.pexp / DT.pexpToNext(s.plv) * 100}%"></i></div></div>
      <label class="set-row"><span>音效</span><input type="checkbox" id="setSfx" ${s.settings.sfx ? 'checked' : ''}></label>
      <label class="set-row"><span>戰鬥動畫加速</span><input type="checkbox" id="setFast" ${s.settings.fast ? 'checked' : ''}></label>
      <div class="set-row"><span>屬性相剋</span><span class="attrs-chart">${DT.attrIcon('bag', 18)}›${DT.attrIcon('heel', 18)}›${DT.attrIcon('dessert', 18)}›${DT.attrIcon('bag', 18)}　${DT.attrIcon('jewel', 18)}⇄${DT.attrIcon('card', 18)}</span></div>
      <p class="muted small">轉珠：按住一顆珠拖曳，經過的珠會互換；放手或時間到就結算。同色 3 顆以上連成一線就消除，一次消 5 顆以上會攻擊全體敵人。點敵人可以鎖定目標，點頭像看技能。</p>
      <button class="btn danger small" id="reset">刪除存檔重新開始</button>`,
      [{ text: '完成', primary: true }],
      { onMount: (w, close) => {
        $('#setSfx', w).onchange = e => { s.settings.sfx = e.target.checked; DT.save(); };
        $('#setFast', w).onchange = e => { s.settings.fast = e.target.checked; DT.fast = e.target.checked; DT.save(); };
        $('#reset', w).onclick = () => { close(); ui.modal('<h3>確定刪除存檔？</h3><p>所有卡片、進度與粉鑽都會消失，無法復原。</p>', [{ text: '刪除', danger: true, fn: () => { localStorage.removeItem(DT.SAVE_KEY); location.reload(); } }, { text: '取消' }]); };
      } });
  }

  // ── 啟動 ────────────────────────────────
  function boot() {
    DT.load();
    DT.fast = DT.S.settings.fast;
    document.querySelectorAll('#nav button').forEach(b => b.onclick = () => go(b.dataset.tab));
    const title = $('#title');
    title.onclick = () => {
      title.classList.add('out');
      setTimeout(() => title.remove(), 500);
      DT.sfx('tap');
      const msgs = DT.dailyLogin();
      render();
      msgs.forEach((m, i) => setTimeout(() => ui.toast(m), 300 + i * 600));
      // 第一次玩：直接看序幕
      if (!DT.S.storySeen['1-intro']) { DT.S.storySeen['1-intro'] = 1; DT.save(); playStory(DT.CHAPTERS[0].intro, DT.CHAPTERS[0], () => ui.toast('點「繼續攀塔」開始第一層！')); }
    };
    render();
    // 開發測試用：?debug 開放 DT 測試介面
    if (/[?&]debug/.test(location.search)) window.DT_DEBUG = { go, prepareStage, startBattle: (f) => startBattle(f, makeFriends(f)[0]), get battle() { return battle; }, cardReveal, sim };
  }
  // 平衡模擬：用自動轉珠打一關，回傳勝負與回合數（不動存檔）
  function sim(floor, team, helper, maxTurns = 60) {
    return new Promise(resolve => {
      DT.turbo = true; DT.S.settings.sfx = false;
      const root = $('#battle'); root.hidden = false;
      let minHp = 1, done = false;
      const b = new DT.Battle(root, DT.STAGES[floor - 1], team, helper, res => { done = true; root.hidden = true; resolve({ floor, win: res.win, turns: b.turn, minHp: +minHp.toFixed(2), revives: b.revives }); });
      // 測試時復活直接判輸
      b.defeat = () => { if (!done) { done = true; b.destroy(); root.hidden = true; resolve({ floor, win: false, turns: b.turn, wave: b.wave, foeHp: b.foes.map(f => Math.max(0, f.hp / f.maxHp).toFixed(2)) }); } };
      const tick = () => {
        if (done) return;
        minHp = Math.min(minHp, b.hp / b.maxHp);
        if (b.turn >= maxTurns) { done = true; b.destroy(); resolve({ floor, win: false, timeout: true, turns: b.turn }); return; }
        if (!b.busy && b.board.state === 'idle') {
          // 有技能就放（回血技只在血少時放）
          const i = b.members.findIndex(m => m.cdLeft <= 0 && (m.card.skill.type !== 'heal' || b.hp < b.maxHp * 0.5) && m.card.skill.type !== 'refresh');
          if (i >= 0) b.useSkill(i);
          else b.board.playPath(b.board.aiPath(250, 14));
        }
        setTimeout(tick, 30);
      };
      setTimeout(tick, 50);
    });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && DT.S) DT.saveNow(); });
  window.addEventListener('DOMContentLoaded', boot);
})();
