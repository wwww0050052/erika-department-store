// 名媛之塔：戰鬥（隊長技、傷害、敵人回合、技能、復活）
'use strict';

DT.Battle = class {
  constructor(root, stage, teamInsts, helper, cb) {
    this.root = root; this.stage = stage; this.cb = cb;
    this.wave = 0; this.turn = 0; this.revives = 0;
    this.boosts = []; this.guard = null; this.timeBuff = null;
    this.target = -1; this.busy = false; this.over = false;
    const ch = DT.CHAPTERS[stage.chapter - 1];
    this.ch = ch;
    // 隊員（隊長＝第一位，最後一位是閨蜜助戰）
    const all = teamInsts.map(i => ({ inst: i, helper: false }));
    if (helper) all.push({ inst: helper, helper: true });
    this.leaders = [DT.CARD[teamInsts[0].id].leader];
    if (helper) this.leaders.push(DT.CARD[helper.id].leader);
    this.members = all.map(m => {
      const card = DT.CARD[m.inst.id], st = DT.cardStats(card, m.inst.lv, m.inst.star || 0);
      const hp = Math.round(st.hp * this.hpMult(card));
      return { ...m, card, atk: st.atk, rec: st.rec, hp, cd: DT.skillCd(m.inst), cdLeft: DT.skillCd(m.inst) };
    });
    this.maxHp = Math.round(this.members.reduce((s, m) => s + m.hp, 0) * (DT.vipLevel() >= 6 ? 1.05 : 1));
    this.hp = this.maxHp;
    this.render();
    this.board = new DT.Board(this.$('.b-board'), {
      onResolve: (groups, combo) => this.afterMove(groups, combo),
      onCombo: (n, gr, x, y) => this.showCombo(n, gr, x, y),
      onMoveStart: () => { this.$('.b-timer').classList.add('on'); },
      onTimer: f => { this.$('.b-timer i').style.transform = `scaleX(${f})`; if (!f) this.$('.b-timer').classList.remove('on'); },
      onSwap: () => DT.sfx('swap'),
      onShuffle: () => DT.ui.toast('沒有可以消的珠了，重新洗牌'),
      onBlast: (sp) => { DT.sfx('blast'); this.flash(sp); },
      mode: DT.mode(),
    });
    if (DT.mode() === 'swap' && !DT.S.settings.tutSwap) {
      DT.S.settings.tutSwap = 1; DT.save();
      setTimeout(() => !this.over && DT.ui.modal(`<h3>三消玩法</h3><p>按住一顆珠往旁邊<b>滑</b>（或先點一顆、再點隔壁那顆），交換後連成 3 顆就消除，掉下來的珠還能連鎖。</p>
        <p>✦ 4 連 → <b>條紋珠</b>（清整排）<br>✦ L／T 形 → <b>包裝珠</b>（炸周圍 3×3）<br>✦ 5 連 → <b>名牌彩虹</b>（跟誰交換就清掉整盤那一色）</p>
        <p class="muted small">特殊珠炸開的傷害會打全體敵人。停太久會提示可以走的步。設定裡可以換回神魔之塔的轉珠玩法。</p>`, [{ text: '開始！', primary: true }]), 1500);
    }
    this.applyMoveTime();
    this.startWave();
  }
  $(s) { return this.root.querySelector(s); }
  destroy() { this.over = true; this.board && this.board.destroy(); }

  // ── 隊長技 ──────────────────────────────
  hpMult(card) {
    let m = 1;
    this.leaders.forEach(L => { if (L.type === 'hpatk' && (L.attr === 'all' || L.attr === card.attr)) m *= L.hp; });
    return m;
  }
  atkMult(card, combo) {
    let m = 1;
    this.leaders.forEach(L => {
      if (L.type === 'all' || L.type === 'heal') m *= L.atk;
      else if (L.type === 'attr' || L.type === 'time') { if (L.attr === card.attr) m *= L.atk; }
      else if (L.type === 'hpatk') { if (L.attr === 'all' || L.attr === card.attr) m *= L.atk; }
      else if (L.type === 'combo') { if (combo >= DT.comboNeed(L.n)) m *= L.atk; }
    });
    this.boosts.forEach(b => { if (b.attr === 'all' || b.attr === card.attr) m *= b.mult; });
    return m;
  }
  healMult() { let m = 1; this.leaders.forEach(L => { if (L.type === 'heal') m *= L.mult; }); return m; }
  flash(sp) {
    const f = this.$('.b-boardwrap');
    f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash');
  }
  applyMoveTime() {
    let t = 5;
    this.leaders.forEach(L => { if (L.type === 'time') t += L.sec; });
    if (this.timeBuff) t += this.timeBuff.sec;
    this.board.moveTime = t * 1000;
  }

  // ── 畫面 ────────────────────────────────
  render() {
    const st = this.stage;
    this.root.innerHTML = `
      <div class="b-top">
        <button class="b-quit" aria-label="暫停">❚❚</button>
        <div class="b-title"><b>${st.floor}F</b> ${esc(st.name)}</div>
        <div class="b-wave">第 <b>1</b>/${st.waves.length} 波</div>
      </div>
      <div class="b-field" style="--img:url(${DT.absImg(this.ch.img)})">
        <div class="b-foes"></div>
        <div class="b-combo"></div>
        <div class="b-banner"></div>
      </div>
      <div class="b-team">${this.members.map((m, i) => `
        <button class="b-mem attr-${m.card.attr}${m.helper ? ' helper' : ''}" data-i="${i}" aria-label="${esc(m.card.name)} 技能">
          <img src="img/icon/i${pad(m.card.id)}.webp" alt="">
          <span class="b-cd"></span><span class="b-dmg"></span>
          ${i === 0 ? '<span class="b-lead">隊長</span>' : m.helper ? '<span class="b-lead f">閨蜜</span>' : ''}
        </button>`).join('')}</div>
      <div class="b-hp"><i></i><span></span></div>
      <div class="b-buffs"></div>
      <div class="b-boardwrap"><div class="b-timer"><i></i></div><canvas class="b-board"></canvas></div>`;
    this.$('.b-quit').onclick = () => this.pauseMenu();
    this.root.querySelectorAll('.b-mem').forEach(b => b.onclick = () => this.trySkill(+b.dataset.i));
    this.updateTeam();
  }
  updateTeam() {
    this.members.forEach((m, i) => {
      const el = this.root.querySelector(`.b-mem[data-i="${i}"]`);
      el.classList.toggle('ready', m.cdLeft <= 0);
      el.querySelector('.b-cd').textContent = m.cdLeft > 0 ? m.cdLeft : '';
    });
    const f = Math.max(0, this.hp / this.maxHp);
    this.$('.b-hp i').style.transform = `scaleX(${f})`;
    this.$('.b-hp').classList.toggle('low', f < 0.3);
    this.$('.b-hp span').textContent = `${Math.max(0, Math.round(this.hp)).toLocaleString()} / ${this.maxHp.toLocaleString()}`;
    const buffs = [];
    this.boosts.forEach(b => buffs.push(`${b.attr === 'all' ? '全隊' : DT.ATTRS[b.attr].name} ×${b.mult}（${b.turns}）`));
    if (this.guard) buffs.push(`減傷 ${Math.round(this.guard.pct * 100)}%（${this.guard.turns}）`);
    if (this.timeBuff) buffs.push(`轉珠 +${this.timeBuff.sec} 秒（${this.timeBuff.turns}）`);
    this.$('.b-buffs').innerHTML = buffs.map(b => `<span>${b}</span>`).join('');
  }
  startWave() {
    const st = this.stage;
    this.foes = st.waves[this.wave].map(f => ({ ...f, maxHp: f.hp, cdLeft: f.cd, enraged: false }));
    this.target = -1;
    this.$('.b-wave b').textContent = this.wave + 1;
    const box = this.$('.b-foes');
    box.className = 'b-foes n' + this.foes.length;
    box.innerHTML = this.foes.map((f, i) => `
      <div class="foe${f.boss ? ' boss' : ''}${f.elite ? ' elite' : ''}" data-i="${i}">
        <div class="foe-cd">${DT.attrIcon(f.attr, 18)}<b>${f.cdLeft}</b></div>
        <div class="foe-art">${DT.monsterSVG(f)}</div>
        <div class="foe-name">${esc(f.name)}</div>
        <div class="foe-hp"><i></i></div>
        ${f.ability ? `<div class="foe-ab" title="${esc(DT.ABILITY_TEXT[f.ability.type](f.ability))}">${abilityBadge(f.ability)}</div>` : ''}
        <div class="foe-tgt">◎</div>
      </div>`).join('');
    box.querySelectorAll('.foe').forEach(el => el.onclick = () => this.pickTarget(+el.dataset.i));
    const isBossWave = this.foes.some(f => f.boss);
    if (isBossWave) this.banner(this.foes[0].final ? 'FINAL BOSS' : 'BOSS', 'boss');
    else this.banner(`WAVE ${this.wave + 1}`);
    this.foes.forEach((f, i) => {
      if (f.ability) setTimeout(() => !this.over && DT.ui.toast(`${f.name}｜${DT.ABILITY_TEXT[f.ability.type](f.ability)}`), 500 + i * 400);
    });
    // 先手攻擊
    const firsts = this.foes.filter(f => f.ability && f.ability.type === 'first');
    if (firsts.length) {
      this.busy = true; this.board.state = 'locked';
      setTimeout(async () => { for (const f of firsts) await this.foeAttack(f); this.busy = false; if (this.hp > 0) this.board.unlock(); else this.defeat(); }, 900);
    }
  }
  banner(text, cls = '') {
    const b = this.$('.b-banner');
    b.className = 'b-banner show ' + cls;
    b.textContent = text;
    setTimeout(() => { b.className = 'b-banner'; }, 1300);
  }
  pickTarget(i) {
    if (this.foes[i].hp <= 0) return;
    this.target = this.target === i ? -1 : i;
    this.root.querySelectorAll('.foe').forEach((el, k) => el.classList.toggle('targeted', k === this.target));
    DT.sfx('tap');
  }
  foeEl(i) { return this.root.querySelector(`.foe[data-i="${i}"]`); }
  updateFoes() {
    this.foes.forEach((f, i) => {
      const el = this.foeEl(i);
      if (!el) return;
      el.querySelector('.foe-hp i').style.transform = `scaleX(${Math.max(0, f.hp / f.maxHp)})`;
      el.querySelector('.foe-cd b').textContent = f.cdLeft;
      el.querySelector('.foe-cd').classList.toggle('soon', f.cdLeft <= 1);
      el.classList.toggle('enraged', f.enraged);
      if (f.hp <= 0 && !el.classList.contains('dead')) { el.classList.add('dead'); DT.sfx('kill'); if (this.target === i) this.target = -1; }
    });
  }
  showCombo(n, gr, x, y) {
    if (gr.t === 'junk') { this.floatAt(this.$('.b-boardwrap'), x, y, '過季…', 'junk'); return; }
    DT.sfx('match', n);
    const el = this.$('.b-combo');
    el.innerHTML = `<b>${n}</b><small>COMBO</small>`;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    this.floatAt(this.$('.b-boardwrap'), x, y, gr.n >= 5 ? `${gr.n}連！` : '', 'orb');
  }
  floatAt(parent, x, y, text, cls) {
    if (!text) return;
    const d = document.createElement('div');
    d.className = 'floater ' + cls;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    d.textContent = text;
    parent.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  // ── 玩家回合結算 ──────────────────────────
  async afterMove(groups, combo) {
    this.busy = true;
    this.turn++;
    const comboMult = 1 + (combo - 1) * 0.25;
    // 每位隊員累計傷害
    const plans = this.members.map(m => {
      const mine = groups.filter(g => g.t === m.card.attr);
      if (!mine.length) return null;
      const factor = mine.reduce((s, g) => s + groupFactor(g), 0);
      return { m, base: m.atk * factor * comboMult * this.atkMult(m.card, combo) * DT.modeMult(), all: mine.some(g => g.n >= 5 || g.special || g.rainbow) };
    });
    const hearts = groups.filter(g => g.t === 'heart');
    const heal = hearts.length ? this.members.reduce((s, m) => s + m.rec, 0) * hearts.reduce((s, g) => s + groupFactor(g), 0) * comboMult * this.healMult() * DT.modeMult() : 0;
    // 先在頭像上亮出數字
    plans.forEach((p, i) => {
      if (!p) return;
      const el = this.root.querySelector(`.b-mem[data-i="${i}"] .b-dmg`);
      el.textContent = fmt(p.base); el.classList.add('on');
    });
    await DT.wait(combo ? 380 : 120);
    if (heal > 0) {
      this.hp = Math.min(this.maxHp, this.hp + heal);
      this.floatAt(this.$('.b-hp'), this.$('.b-hp').clientWidth / 2, 0, '+' + fmt(heal), 'heal');
      DT.sfx('heal');
      this.updateTeam();
    }
    for (let i = 0; i < plans.length; i++) {
      const p = plans[i];
      if (!p) continue;
      const alive = this.foes.map((f, k) => k).filter(k => this.foes[k].hp > 0);
      if (!alive.length) break;
      const targets = p.all ? alive : [this.target >= 0 && this.foes[this.target].hp > 0 ? this.target : alive[0]];
      this.root.querySelector(`.b-mem[data-i="${i}"]`).classList.add('fire');
      targets.forEach(k => this.hit(k, p.m, p.base, combo, i));
      await DT.wait(200);
      const dmgEl = this.root.querySelector(`.b-mem[data-i="${i}"] .b-dmg`);
      dmgEl.classList.remove('on');
      this.root.querySelector(`.b-mem[data-i="${i}"]`).classList.remove('fire');
    }
    this.root.querySelectorAll('.b-dmg').forEach(e => e.classList.remove('on'));
    await DT.wait(350);
    this.endOfPlayerTurn();
    if (this.foes.every(f => f.hp <= 0)) return this.waveCleared();
    await this.enemyPhase();
  }
  // 傷害（含屬性相剋、防禦、連擊護盾）
  hit(k, m, base, combo, fromIdx, opts = {}) {
    const f = this.foes[k];
    if (f.hp <= 0) return;
    const el = this.foeEl(k);
    let dmg;
    const shield = f.ability && f.ability.type === 'combo' && !opts.skill && combo < DT.comboNeed(f.ability.n);
    if (shield) dmg = 0;
    else dmg = Math.max(1, Math.round(base * DT.attrMult(m.card.attr, f.attr) - (opts.skill ? 0 : f.def)));
    // 數值立刻扣（下一位隊員才會換目標），畫面晚一點跟上
    f.hp -= dmg;
    if (f.ability && f.ability.type === 'enrage' && !f.enraged && f.hp > 0 && f.hp < f.maxHp * 0.35) {
      f.enraged = true; DT.ui.toast(`${f.name} 狂暴了！攻擊力翻倍`);
    }
    this.projectile(fromIdx, k, m.card.attr);
    setTimeout(() => {
      if (!this.root.isConnected) return;
      const mult = DT.attrMult(m.card.attr, f.attr);
      const r = el.getBoundingClientRect(), pr = this.$('.b-field').getBoundingClientRect();
      this.floatAt(this.$('.b-field'), r.left - pr.left + r.width / 2 + (Math.random() * 30 - 15), r.top - pr.top + r.height * 0.35,
        shield ? `需 ${DT.comboNeed(f.ability.n)} Combo` : fmt(dmg), 'dmg attr-' + m.card.attr + (mult > 1 ? ' weak' : mult < 1 ? ' resist' : '') + (shield ? ' miss' : ''));
      el.classList.remove('hurt'); void el.offsetWidth; el.classList.add('hurt');
      DT.sfx(shield ? 'block' : 'hit');
      this.updateFoes();
    }, 220);
  }
  projectile(fromIdx, k, attr) {
    const from = this.root.querySelector(`.b-mem[data-i="${fromIdx}"]`), to = this.foeEl(k);
    if (!from || !to) return;
    const rr = this.root.getBoundingClientRect(), a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const p = document.createElement('div');
    p.className = 'proj'; p.innerHTML = DT.attrIcon(attr, 26);
    p.style.left = (a.left - rr.left + a.width / 2 - 13) + 'px'; p.style.top = (a.top - rr.top + a.height / 2 - 13) + 'px';
    this.root.appendChild(p);
    requestAnimationFrame(() => {
      p.style.transform = `translate(${b.left - a.left + (b.width - a.width) / 2}px, ${b.top - a.top + b.height * 0.4 - a.height / 2}px) scale(1.3)`;
      p.style.opacity = '0.2';
    });
    setTimeout(() => p.remove(), 260);
  }
  endOfPlayerTurn() {
    this.members.forEach(m => { if (m.cdLeft > 0) m.cdLeft--; });
    this.boosts.forEach(b => b.turns--); this.boosts = this.boosts.filter(b => b.turns > 0);
    if (this.timeBuff && --this.timeBuff.turns <= 0) this.timeBuff = null;
    this.applyMoveTime();
    this.updateTeam();
  }
  async enemyPhase() {
    for (const f of this.foes) {
      if (f.hp <= 0 || this.over) continue;
      f.cdLeft--;
      if (f.cdLeft <= 0) { await this.foeAttack(f); f.cdLeft = f.cd; }
      this.updateFoes();
      if (this.hp <= 0) break;
    }
    if (this.guard && --this.guard.turns <= 0) this.guard = null;
    this.updateFoes(); this.updateTeam();
    if (this.hp <= 0) return this.defeat();
    this.busy = false;
    this.board.unlock();
  }
  async foeAttack(f) {
    const i = this.foes.indexOf(f), el = this.foeEl(i);
    el.classList.remove('attack'); void el.offsetWidth; el.classList.add('attack');
    await DT.wait(300);
    let dmg = f.atk * (f.enraged ? 2 : 1) * DT.MODE_FOE_ATK[DT.mode()];
    if (this.guard) dmg *= 1 - this.guard.pct;
    dmg = Math.round(dmg * (0.92 + Math.random() * 0.16));
    this.hp -= dmg;
    DT.sfx('ouch');
    this.root.classList.remove('shake'); void this.root.offsetWidth; this.root.classList.add('shake');
    this.floatAt(this.$('.b-hp'), this.$('.b-hp').clientWidth / 2, 0, '-' + fmt(dmg), 'ouch');
    if (f.ability) {
      if (f.ability.type === 'junk') { this.board.junkify(f.ability.n); DT.ui.toast(`${f.name} 塞了 ${f.ability.n} 個過季貨到盤面！`); }
      if (f.ability.type === 'regen') { f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.15); DT.ui.toast(`${f.name} 做了保養，回復生命`); }
    }
    this.updateTeam(); this.updateFoes();
    await DT.wait(450);
  }
  async waveCleared() {
    await DT.wait(500);
    if (this.wave < this.stage.waves.length - 1) {
      this.wave++;
      this.startWave();
      if (!this.foes.some(f => f.ability && f.ability.type === 'first')) { this.busy = false; this.board.unlock(); }
    } else this.victory();
  }

  // ── 技能 ────────────────────────────────
  trySkill(i) {
    const m = this.members[i];
    const sk = m.card.skill;
    const ready = m.cdLeft <= 0 && !this.busy && this.board.state === 'idle';
    DT.ui.modal(`
      <div class="sk-head"><img src="img/icon/i${pad(m.card.id)}.webp" alt=""><div><div class="sk-name">${DT.attrIcon(m.card.attr, 18)} ${esc(m.card.name)} ${DT.stars(m.card.rarity)}</div>
      <div class="sk-sub">Lv.${m.inst.lv}${m.helper ? '・閨蜜助戰' : ''}</div></div></div>
      <div class="sk-box"><b>主動技｜${esc(sk.name)}</b><p>${esc(DT.skillDesc(m.card))}</p><small>冷卻 ${m.cd} 回合${m.cdLeft > 0 ? `・還要 ${m.cdLeft} 回合` : '・已就緒'}</small></div>
      ${i === 0 || m.helper ? `<div class="sk-box lead"><b>隊長技｜${esc(m.card.leader.name)}</b><p>${esc(DT.leaderDesc(m.card))}</p></div>` : ''}`,
      ready ? [{ text: '發動技能', primary: true, fn: () => this.useSkill(i) }, { text: '取消' }] : [{ text: '知道了' }]);
  }
  async useSkill(i) {
    const m = this.members[i], sk = m.card.skill;
    if (m.cdLeft > 0 || this.busy || this.board.state !== 'idle') return;
    m.cdLeft = m.cd;
    DT.sfx('skill');
    this.banner(sk.name, 'skill attr-' + m.card.attr);
    const el = this.root.querySelector(`.b-mem[data-i="${i}"]`);
    el.classList.add('cast'); setTimeout(() => el.classList.remove('cast'), 700);
    const b = this.board;
    switch (sk.type) {
      case 'heartsTo': b.convert('heart', sk.to); break;
      case 'refresh': b.refresh(); break;
      case 'heal': this.hp = Math.min(this.maxHp, this.hp + this.maxHp * sk.pct); if (sk.to) b.convert('heart', sk.to); DT.sfx('heal'); break;
      case 'guard': this.guard = { pct: sk.pct, turns: sk.turns }; break;
      case 'spawn': b.spawn(sk.attr, sk.n); break;
      case 'convert': b.convert(sk.from, sk.to); break;
      case 'delay': this.foes.forEach(f => { if (f.hp > 0) f.cdLeft += sk.n; }); if (sk.from) b.convert(sk.from, sk.to); this.updateFoes(); break;
      case 'boost': this.boosts.push({ attr: sk.attr, mult: sk.mult, turns: sk.turns + 1 }); break; // +1：本回合結算後才開始扣
      case 'time':
        if (DT.mode() === 'swap') this.boosts.push({ attr: 'all', mult: 1.5, turns: sk.turns + 1 }); // 三消沒有計時：改成全隊攻擊 1.5 倍
        else { this.timeBuff = { sec: sk.sec, turns: sk.turns + 1 }; this.applyMoveTime(); }
        break;
      case 'nuke': {
        const alive = this.foes.map((f, k) => k).filter(k => this.foes[k].hp > 0);
        const targets = sk.all ? alive : [this.target >= 0 && this.foes[this.target].hp > 0 ? this.target : alive[0]];
        this.busy = true;
        targets.forEach(k => this.hit(k, m, m.atk * sk.mult * this.atkMult(m.card, 0), 99, i, { skill: true }));
        await DT.wait(700);
        this.busy = false;
        if (this.foes.every(f => f.hp <= 0)) { this.busy = true; this.board.state = 'locked'; this.waveCleared(); }
        break;
      }
    }
    this.updateTeam();
  }

  // ── 勝敗 ────────────────────────────────
  pauseMenu() {
    if (this.over) return;
    DT.ui.modal(`<h3>暫停</h3><p class="muted">${this.stage.floor}F｜${esc(this.stage.name)}</p><p>放棄的話，這一關消耗的體力不會退還。</p>`,
      [{ text: '繼續戰鬥', primary: true }, { text: '放棄挑戰', danger: true, fn: () => { this.destroy(); this.cb({ win: false, quit: true }); } }]);
  }
  defeat() {
    if (this.over) return;
    this.board.state = 'locked';
    DT.sfx('lose');
    const s = DT.S, cost = DT.REVIVE_COST;
    DT.ui.modal(`<div class="lose-art">${DT.attrIcon('heart', 64)}</div><h3>妝花了……</h3><p>花 <b class="gem">${cost} 粉鑽</b> 補妝復活：生命全滿、所有技能立即就緒。</p><p class="muted">目前持有 ${s.gems} 粉鑽</p>`,
      s.gems >= cost
        ? [{ text: `補妝復活（${cost} 粉鑽）`, primary: true, fn: () => this.revive() }, { text: '放棄', fn: () => this.finishLose() }]
        : [{ text: '去儲值粉鑽', primary: true, fn: () => DT.ui.openShop(() => this.defeatAgain()) }, { text: '放棄', fn: () => this.finishLose() }],
      { noClose: true });
  }
  defeatAgain() { this.over = false; this.defeat(); }
  revive() {
    DT.S.gems -= DT.REVIVE_COST; DT.save();
    this.revives++;
    this.hp = this.maxHp;
    this.members.forEach(m => m.cdLeft = 0);
    this.updateTeam();
    this.banner('補妝完成！', 'skill');
    DT.sfx('revive');
    this.busy = false; this.board.unlock();
    DT.ui.refreshBar && DT.ui.refreshBar();
  }
  finishLose() { this.destroy(); this.cb({ win: false }); }
  victory() {
    if (this.over) return;
    this.over = true;
    this.board.state = 'locked';
    DT.sfx('win');
    const rank = this.revives ? 1 : this.hp >= this.maxHp * 0.5 ? 3 : 2;
    setTimeout(() => { this.destroy(); this.cb({ win: true, rank, turns: this.turn }); }, 900);
  }
};

function groupFactor(g) { return g.special ? g.n * 0.3 : 1 + (g.n - 3) * 0.25; }
function abilityBadge(a) {
  return { combo: `🛡${DT.comboNeed(a.n)}`, junk: '♻', enrage: '🔥', regen: '✚', first: '⚡' }[a.type] || '!';
}
function fmt(n) { n = Math.round(n); return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'K' : n.toLocaleString(); }
function pad(n) { return String(n).padStart(2, '0'); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
DT.fmt = fmt; DT.pad = pad; DT.esc = esc;
