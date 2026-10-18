// 名媛之塔：遊戲資料（屬性、身分卡、關卡、劇情、商店）
'use strict';
window.DT = window.DT || {};

// ── 五種屬性＋美顏心 ───────────────────────────
// 相剋：包包 > 高跟鞋 > 甜點 > 包包；珠寶 ⇄ 黑卡 互剋
DT.ATTRS = {
  bag:     { name: '包包',   short: '包', color: '#e2445c', dark: '#8e1530', light: '#ffb0bf', beats: 'heel' },
  heel:    { name: '高跟鞋', short: '鞋', color: '#3f7fe0', dark: '#173d8a', light: '#b5d3ff', beats: 'dessert' },
  dessert: { name: '甜點',   short: '甜', color: '#43b874', dark: '#1d7a45', light: '#c4f3d6', beats: 'bag' },
  jewel:   { name: '珠寶',   short: '鑽', color: '#f0b93a', dark: '#a0680a', light: '#fff2be', beats: 'card' },
  card:    { name: '黑卡',   short: '卡', color: '#8a55d6', dark: '#43207a', light: '#dcc6ff', beats: 'jewel' },
};
DT.ORB_TYPES = ['bag', 'heel', 'dessert', 'jewel', 'card', 'heart'];
DT.HEART = { name: '美顏心', color: '#ff74b0', dark: '#c2307a', light: '#ffd6ea' };
DT.attrMult = (atk, def) => (DT.ATTRS[atk] && DT.ATTRS[atk].beats === def) ? 1.5 : (DT.ATTRS[def] && DT.ATTRS[def].beats === atk && atk !== 'jewel' && atk !== 'card') ? 0.5 : 1;

DT.RARITY_MAXLV = { 2: 30, 3: 50, 4: 70, 5: 90, 6: 99 };

// ── 26 張身分卡（img = tower/img/card/cNN.webp） ─────────────
// role: atk 攻擊型、hp 耐久型、rec 回復型、bal 平衡型
// skill.type: convert(from→to) | spawn(attr,n) | nuke(mult,all) | heal(pct) | delay(n) | boost(attr|all,mult,turns)
//             | guard(pct,turns) | time(sec,turns) | refresh | heartsTo(attr)
// leader.type: attr(attr,atk) | all(atk) | hpatk(attr,hp,atk) | combo(n,atk) | time(sec,atk) | heal(mult,atk)
DT.CARDS = [
  { id: 2,  name: '巷口追夢人', title: '從零開始的 Erika', attr: 'bag', rarity: 2, role: 'bal',
    quote: '總有一天，我要站在名媛之塔的頂樓。',
    skill: { name: '省錢魂', desc: '把所有美顏心轉成包包珠', type: 'heartsTo', to: 'bag', cd: 9 },
    leader: { name: '不服輸', desc: '全隊攻擊力 1.5 倍', type: 'all', atk: 1.5 } },
  { id: 9,  name: '家事女神', title: '一塵不染的雙手', attr: 'heel', rarity: 2, role: 'hp',
    quote: '地板擦得越亮，越看得見自己。',
    skill: { name: '大掃除', desc: '重新整理整個轉珠盤', type: 'refresh', cd: 6 },
    leader: { name: '勤勞', desc: '高跟鞋屬性攻擊力 2 倍', type: 'attr', attr: 'heel', atk: 2 } },
  { id: 3,  name: '溫柔人妻', title: '廚房裡的小太陽', attr: 'dessert', rarity: 2, role: 'rec',
    quote: '先吃飽，才有力氣變美。',
    skill: { name: '愛心便當', desc: '回復 35% 生命', type: 'heal', pct: 0.35, cd: 8 },
    leader: { name: '家的味道', desc: '美顏心回復力 2 倍，全隊攻擊力 1.2 倍', type: 'heal', mult: 2, atk: 1.2 } },
  { id: 18, name: '工地玫瑰', title: '安全帽下的倔強', attr: 'jewel', rarity: 2, role: 'hp',
    quote: '鋼筋水泥都扛得動，名牌包算什麼。',
    skill: { name: '鋼骨防線', desc: '2 回合內受到的傷害減少 40%', type: 'guard', pct: 0.4, turns: 2, cd: 8 },
    leader: { name: '硬底子', desc: '珠寶屬性攻擊力 2 倍', type: 'attr', attr: 'jewel', atk: 2 } },

  { id: 14, name: '甜點師', title: '烤箱前的魔法', attr: 'dessert', rarity: 3, role: 'atk',
    quote: '奶油要打到「剛剛好」，就像人生。',
    skill: { name: '現烤出爐', desc: '產生 6 粒甜點珠', type: 'spawn', attr: 'dessert', n: 6, cd: 7 },
    leader: { name: '甜蜜暴擊', desc: '甜點屬性攻擊力 2.5 倍', type: 'attr', attr: 'dessert', atk: 2.5 } },
  { id: 16, name: '主廚', title: '大火快炒的女人', attr: 'bag', rarity: 3, role: 'atk',
    quote: '火候不夠的人生，不值得端上桌。',
    skill: { name: '爆炒', desc: '把甜點珠轉成包包珠', type: 'convert', from: 'dessert', to: 'bag', cd: 7 },
    leader: { name: '主廚推薦', desc: '包包屬性攻擊力 2.5 倍', type: 'attr', attr: 'bag', atk: 2.5 } },
  { id: 6,  name: '國文老師', title: '粉筆灰裡的優雅', attr: 'heel', rarity: 3, role: 'bal',
    quote: '「腹有詩書氣自華」，同學們記好。',
    skill: { name: '下課鐘聲', desc: '所有敵人攻擊延遲 1 回合', type: 'delay', n: 1, cd: 9 },
    leader: { name: '因材施教', desc: '高跟鞋屬性攻擊力 2.5 倍', type: 'attr', attr: 'heel', atk: 2.5 } },
  { id: 24, name: '護理師', title: '白衣天使的微笑', attr: 'heel', rarity: 3, role: 'rec',
    quote: '別怕，有我在。',
    skill: { name: '細心照護', desc: '回復 50% 生命', type: 'heal', pct: 0.5, cd: 9 },
    leader: { name: '天使之手', desc: '美顏心回復力 2.5 倍，全隊攻擊力 1.3 倍', type: 'heal', mult: 2.5, atk: 1.3 } },
  { id: 23, name: '職場新鮮人', title: '第一雙上班高跟鞋', attr: 'card', rarity: 3, role: 'bal',
    quote: '第一份薪水，要先買一雙好鞋。',
    skill: { name: '加班', desc: '把高跟鞋珠轉成黑卡珠', type: 'convert', from: 'heel', to: 'card', cd: 7 },
    leader: { name: '月光族', desc: '黑卡屬性攻擊力 2.5 倍', type: 'attr', attr: 'card', atk: 2.5 } },
  { id: 1,  name: '汽車業務', title: '一台接著一台的業績', attr: 'card', rarity: 3, role: 'atk',
    quote: '這台車，跟您的氣質最配。',
    skill: { name: '成交！', desc: '對單體敵人造成 15 倍攻擊力的黑卡傷害', type: 'nuke', mult: 15, all: false, cd: 8 },
    leader: { name: '業績女王', desc: '6 Combo 以上全隊攻擊力 3 倍', type: 'combo', n: 6, atk: 3 } },

  { id: 12, name: '女警', title: '正義的制服', attr: 'heel', rarity: 4, role: 'hp',
    quote: '仿冒品，一個都別想逃。',
    skill: { name: '臨檢', desc: '所有敵人攻擊延遲 2 回合', type: 'delay', n: 2, cd: 12 },
    leader: { name: '執法如山', desc: '高跟鞋屬性生命 1.5 倍、攻擊力 3 倍', type: 'hpatk', attr: 'heel', hp: 1.5, atk: 3 } },
  { id: 5,  name: '空服員', title: '三萬英呎的微笑', attr: 'heel', rarity: 4, role: 'bal',
    quote: '各位旅客，免稅品推車即將經過。',
    skill: { name: '機上服務', desc: '3 回合內轉珠時間延長 3 秒', type: 'time', sec: 3, turns: 3, cd: 8 },
    leader: { name: '頭等艙', desc: '轉珠時間延長 2 秒，高跟鞋屬性攻擊力 3 倍', type: 'time', sec: 2, attr: 'heel', atk: 3 } },
  { id: 20, name: '游泳教練', title: '水花裡的線條', attr: 'heel', rarity: 4, role: 'atk',
    quote: '吸氣、踢水，對，就是這樣！',
    skill: { name: '浪花', desc: '把甜點珠轉成高跟鞋珠', type: 'convert', from: 'dessert', to: 'heel', cd: 6 },
    leader: { name: '人魚線', desc: '高跟鞋屬性攻擊力 3 倍', type: 'attr', attr: 'heel', atk: 3 } },
  { id: 8,  name: '醫師', title: '聽診器與口紅', attr: 'dessert', rarity: 4, role: 'rec',
    quote: '妳的問題，是太久沒寵愛自己。',
    skill: { name: '妙手回春', desc: '回復 70% 生命', type: 'heal', pct: 0.7, cd: 10 },
    leader: { name: '醫者仁心', desc: '甜點屬性生命 1.5 倍、攻擊力 3 倍', type: 'hpatk', attr: 'dessert', hp: 1.5, atk: 3 } },
  { id: 11, name: '海灘度假', title: '陽光與比基尼', attr: 'dessert', rarity: 4, role: 'atk',
    quote: '人生苦短，先度假再說。',
    skill: { name: '椰子冰沙', desc: '把包包珠轉成甜點珠', type: 'convert', from: 'bag', to: 'dessert', cd: 6 },
    leader: { name: '夏日戀曲', desc: '甜點屬性攻擊力 3 倍', type: 'attr', attr: 'dessert', atk: 3 } },
  { id: 0,  name: '研究員', title: '試管裡的閃光', attr: 'jewel', rarity: 4, role: 'bal',
    quote: '鑽石，就是壓力下的碳。我也是。',
    skill: { name: '結晶反應', desc: '把美顏心轉成珠寶珠', type: 'heartsTo', to: 'jewel', cd: 7 },
    leader: { name: '理性之光', desc: '珠寶屬性攻擊力 3 倍', type: 'attr', attr: 'jewel', atk: 3 } },
  { id: 15, name: '夜店女王', title: '香檳與霓虹', attr: 'jewel', rarity: 4, role: 'atk',
    quote: '今晚的帳，都記在我的名字。',
    skill: { name: '開香檳', desc: '產生 6 粒珠寶珠', type: 'spawn', attr: 'jewel', n: 6, cd: 7 },
    leader: { name: '派對動物', desc: '7 Combo 以上全隊攻擊力 3.5 倍', type: 'combo', n: 7, atk: 3.5 } },
  { id: 25, name: '名牌偵探', title: '真假一眼看穿', attr: 'card', rarity: 4, role: 'bal',
    quote: '車線歪了 0.5 毫米，這是 A 貨。',
    skill: { name: '鑑定', desc: '所有敵人攻擊延遲 1 回合，並把珠寶珠轉成黑卡珠', type: 'delay', n: 1, from: 'jewel', to: 'card', cd: 10 },
    leader: { name: '明察秋毫', desc: '黑卡屬性生命 1.5 倍、攻擊力 3 倍', type: 'hpatk', attr: 'card', hp: 1.5, atk: 3 } },

  { id: 21, name: '舞台舞者', title: '流蘇與節拍', attr: 'bag', rarity: 5, role: 'atk',
    quote: '燈光打下來的那一刻，我就是全世界。',
    skill: { name: '安可', desc: '3 回合內包包屬性攻擊力 1.8 倍', type: 'boost', attr: 'bag', mult: 1.8, turns: 3, cd: 10 },
    leader: { name: '舞台中央', desc: '包包屬性攻擊力 3.5 倍', type: 'attr', attr: 'bag', atk: 3.5 } },
  { id: 19, name: '酒廊名媛', title: '絲絨沙發上的祕密', attr: 'bag', rarity: 5, role: 'bal',
    quote: '想請我喝一杯？先看看你的卡。',
    skill: { name: '微醺', desc: '把高跟鞋珠與甜點珠轉成包包珠', type: 'convert', from: ['heel', 'dessert'], to: 'bag', cd: 12 },
    leader: { name: '紅唇印', desc: '包包屬性生命 1.6 倍、攻擊力 3.5 倍', type: 'hpatk', attr: 'bag', hp: 1.6, atk: 3.5 } },
  { id: 4,  name: '賽車女郎', title: '格子旗下的紅', attr: 'bag', rarity: 5, role: 'atk',
    quote: '踩下油門，誰也追不上我。',
    skill: { name: '全速衝刺', desc: '對所有敵人造成 20 倍攻擊力的包包傷害', type: 'nuke', mult: 20, all: true, cd: 10 },
    leader: { name: '極速', desc: '轉珠時間延長 3 秒，包包屬性攻擊力 3.5 倍', type: 'time', sec: 3, attr: 'bag', atk: 3.5 } },
  { id: 13, name: '時尚街拍', title: '櫥窗前的封面', attr: 'dessert', rarity: 5, role: 'atk',
    quote: '鏡頭在哪裡，我的光就在哪裡。',
    skill: { name: '快門連拍', desc: '3 回合內甜點屬性攻擊力 1.8 倍', type: 'boost', attr: 'dessert', mult: 1.8, turns: 3, cd: 10 },
    leader: { name: '封面人物', desc: '甜點屬性生命 1.6 倍、攻擊力 3.5 倍', type: 'hpatk', attr: 'dessert', hp: 1.6, atk: 3.5 } },
  { id: 7,  name: '派對 DJ', title: '掌控整個夜晚', attr: 'card', rarity: 5, role: 'atk',
    quote: 'Drop the beat——然後刷卡。',
    skill: { name: '重低音', desc: '產生 8 粒黑卡珠', type: 'spawn', attr: 'card', n: 8, cd: 9 },
    leader: { name: '全場沸騰', desc: '黑卡屬性攻擊力 3.5 倍', type: 'attr', attr: 'card', atk: 3.5 } },

  { id: 10, name: '台灣小姐', title: '后冠加冕之夜', attr: 'jewel', rarity: 6, role: 'atk',
    quote: '美麗不是天生的，是一層一層爬上來的。',
    skill: { name: '加冕', desc: '3 回合內全隊攻擊力 2 倍', type: 'boost', attr: 'all', mult: 2, turns: 3, cd: 12 },
    leader: { name: '后冠', desc: '珠寶屬性生命 1.8 倍、攻擊力 4 倍', type: 'hpatk', attr: 'jewel', hp: 1.8, atk: 4 } },
  { id: 22, name: '貂皮名媛', title: '水晶燈下的女主人', attr: 'jewel', rarity: 6, role: 'hp',
    quote: '親愛的，這只是我衣帽間的一小角。',
    skill: { name: '貴婦下午茶', desc: '回復 100% 生命，並把美顏心轉成珠寶珠', type: 'heal', pct: 1, to: 'jewel', cd: 14 },
    leader: { name: '名媛氣場', desc: '全隊生命 1.5 倍、攻擊力 3 倍', type: 'hpatk', attr: 'all', hp: 1.5, atk: 3 } },
  { id: 17, name: '女總裁', title: '頂樓辦公室的主人', attr: 'card', rarity: 6, role: 'bal',
    quote: '我不買包，我買下整間公司。',
    skill: { name: '董事會決議', desc: '把所有珠轉成黑卡珠與美顏心', type: 'convert', from: ['bag', 'heel', 'dessert', 'jewel'], to: 'card', cd: 16 },
    leader: { name: '一人之上', desc: '黑卡屬性生命 1.8 倍、攻擊力 4 倍', type: 'hpatk', attr: 'card', hp: 1.8, atk: 4 } },
];
DT.CARD = {};
DT.CARDS.forEach(c => { DT.CARD[c.id] = c; });

// 屬性數值：等級 1 的基礎值，滿級是 3 倍
DT.cardStats = (card, lv, star = 0) => {
  const r = card.rarity, maxLv = DT.RARITY_MAXLV[r];
  const g = 1 + 2 * (lv - 1) / (maxLv - 1);
  const role = { atk: [0.9, 1.2, 0.8], hp: [1.25, 0.9, 0.9], rec: [1, 0.85, 1.6], bal: [1, 1, 1] }[card.role];
  const brk = 1 + 0.08 * star; // 重複抽到的「突破」加成
  return {
    hp: Math.round(160 * Math.pow(r, 1.3) * g * role[0] * brk),
    atk: Math.round(30 * Math.pow(r, 1.3) * g * role[1] * brk),
    rec: Math.round(14 * Math.pow(r, 1.2) * g * role[2] * brk),
  };
};
DT.expToNext = (card, lv) => Math.round(8 * Math.pow(lv, 1.5) * (1 + card.rarity * 0.1));

// ── 敵人圖鑑：外型 kind 對應 art.js 的怪物 ─────────────
// ability: combo(n) 需 n Combo 才有傷害 | junk(n) 攻擊時產生過季珠 | enrage 殘血狂暴 | regen 攻擊時回血 | first 先手攻擊
DT.CHAPTERS = [
  { no: 1, title: '巷口灰姑娘', sub: 'CHAPTER I ・ THE ALLEY', img: 2, reward: 14,
    foes: [
      { name: '刷爆收據', kind: 'receipt', attr: 'card' }, { name: '過季帆布包', kind: 'tote', attr: 'bag' },
      { name: '壓扁的泡芙', kind: 'puff', attr: 'dessert' }, { name: '斷跟涼鞋', kind: 'sandal', attr: 'heel' },
      { name: '玻璃假鑽', kind: 'gem', attr: 'jewel' }],
    boss: { name: '包租婆的鱷魚皮包', kind: 'kelly', attr: 'bag', crown: true, ability: { type: 'regen' } },
    intro: [
      ['旁白', '城市的正中央，矗立著一座一百層的玻璃高塔——「名媛之塔」。'],
      ['旁白', '傳說站上頂樓的女人，能得到那只全世界只有一個的包：Le Grand Sac。'],
      ['Erika', '……而我，住在塔影子照得到的最後一條巷子裡。'],
      ['Erika', '房租欠了兩個月，鞋跟斷了一隻，錢包裡只剩一張刷爆的收據。'],
      ['Erika', '可是啊——沒有人規定巷口的女孩不能抬頭看。'],
      ['旁白', '這一天，Erika 把頭髮紮好，推開了名媛之塔一樓的旋轉門。'],
    ],
    mid: [['Erika', '原來這座塔裡的東西都會「活過來」……連收據都會咬人！'], ['Erika', '沒關係，轉一轉、排一排，三個連成一線就能打倒它們。']],
    pre: [['包租婆的鱷魚皮包', '小姑娘，房租呢？沒錢還想上樓？'], ['Erika', '房租我會付——用我自己的方式！']],
    outro: [['Erika', '呼……第一個十層，過了。'], ['旁白', '包租婆的皮包裡掉出一張名片：「貝兒法式甜點 誠徵學徒」。'], ['Erika', '甜點店……？好，就從這裡開始。']] },
  { no: 2, title: '甜點夢工廠', sub: 'CHAPTER II ・ PÂTISSERIE', img: 14, reward: 23,
    foes: [
      { name: '馬卡龍三姊妹', kind: 'macaron', attr: 'dessert' }, { name: '草莓千層精', kind: 'cake', attr: 'dessert' },
      { name: '可頌小惡魔', kind: 'puff', attr: 'bag' }, { name: '糖霜甜甜圈', kind: 'donut', attr: 'jewel' },
      { name: '焦糖布丁', kind: 'pudding', attr: 'heel' }],
    boss: { name: '千層蛋糕魔王', kind: 'cake', attr: 'dessert', crown: true, ability: { type: 'junk', n: 4 } },
    intro: [
      ['旁白', '十一樓飄著奶油與焦糖的香氣——塔裡的甜點工坊。'],
      ['Erika', '凌晨四點起床揉麵團，手臂痠到抬不起來。'],
      ['Erika', '可是當客人咬下我做的馬卡龍、眼睛亮起來的那一刻……'],
      ['Erika', '我第一次覺得，我也能讓別人變得幸福。'],
    ],
    mid: [['Erika', '這些甜點怎麼全都跑出烤箱了啦！'], ['Erika', '記住，甜點怕包包——用包包珠砸它們！']],
    pre: [['千層蛋糕魔王', '一層、兩層、一千層！妳的努力，壓得過我的厚度嗎？'], ['Erika', '我每天揉的麵團，比你還厚！']],
    outro: [['旁白', '一位常客留下了訂單：「下週起，請來我們公司上班吧。」'], ['Erika', '上班族……要穿高跟鞋的那種嗎？']] },
  { no: 3, title: '職場新鮮人', sub: 'CHAPTER III ・ OFFICE', img: 23, reward: 12,
    foes: [
      { name: '鉚釘細跟鞋', kind: 'stiletto', attr: 'heel' }, { name: '無限加班單', kind: 'receipt', attr: 'card' },
      { name: '公文包怪', kind: 'tote', attr: 'bag' }, { name: '咖啡凍', kind: 'pudding', attr: 'dessert' },
      { name: '員工識別鑽', kind: 'gem', attr: 'jewel' }],
    boss: { name: '女主管的紅底戰靴', kind: 'boot', attr: 'heel', crown: true, ability: { type: 'combo', n: 4 } },
    intro: [
      ['旁白', '二十一樓，玻璃帷幕的開放式辦公室。'],
      ['Erika', '第一份薪水入帳的那天，我在櫥窗前站了二十分鐘。'],
      ['Erika', '最後只買了一雙打折的黑色高跟鞋。但我穿著它，走路都有風。'],
    ],
    mid: [['Erika', '主管說：「報告要在 5 秒內轉完。」……這是在說轉珠吧？']],
    pre: [['女主管的紅底戰靴', '新人？先撐過我的連續技再說——少於 4 Combo 對我沒用！'], ['Erika', '那我就連給妳看！']],
    outro: [['旁白', 'Erika 的提案拿下年度大獎，也讓她注意到一件事——'], ['Erika', '樓上的名牌櫃，最近冒出好多「假貨」……']] },
  { no: 4, title: '仿冒品大搜查', sub: 'CHAPTER IV ・ COUNTERFEIT', img: 12, reward: 5,
    foes: [
      { name: 'A 貨鏈條包', kind: 'chain', attr: 'bag' }, { name: '山寨紅底鞋', kind: 'stiletto', attr: 'heel' },
      { name: '假鑽戒', kind: 'ring', attr: 'jewel' }, { name: '人頭信用卡', kind: 'blackcard', attr: 'card' },
      { name: '色素蛋糕', kind: 'cake', attr: 'dessert' }],
    boss: { name: 'A 貨集團首腦', kind: 'chain', attr: 'card', crown: true, ability: { type: 'enrage' } },
    intro: [
      ['旁白', '三十一樓，名牌鑑定局。這裡的制服比任何高訂都更有份量。'],
      ['Erika', '真正的名牌，是一針一線的堅持。'],
      ['Erika', '仿冒品偷走的不只是品牌，還有每一個存錢買包的女孩的心意。'],
    ],
    mid: [['Erika', '車線歪了、五金太輕、皮料有味道——全是假的！']],
    pre: [['A 貨集團首腦', '真的假的有差嗎？反正大家只看 logo！'], ['Erika', '有差。差在良心。']],
    outro: [['旁白', '集團落網。Erika 被派去調查一條走私路線——國際航班。'], ['Erika', '要換上空服員的制服了呢。']] },
  { no: 5, title: '三萬英呎', sub: 'CHAPTER V ・ FIRST CLASS', img: 5, reward: 15,
    foes: [
      { name: '免稅香水瓶', kind: 'gem', attr: 'jewel' }, { name: '頭等艙拖鞋', kind: 'sandal', attr: 'heel' },
      { name: '機上甜點車', kind: 'macaron', attr: 'dessert' }, { name: '登機箱怪', kind: 'tote', attr: 'bag' },
      { name: '外幣兌換卡', kind: 'blackcard', attr: 'card' }],
    boss: { name: '免稅店香水女王', kind: 'perfume', attr: 'jewel', crown: true, ability: { type: 'combo', n: 5 } },
    intro: [
      ['旁白', '四十一樓之上，是雲。'],
      ['Erika', '東京、巴黎、米蘭——我在每個城市的櫥窗前都停留過。'],
      ['Erika', '原來名媛不是一種身分，而是一種「見過世界」的眼神。'],
    ],
    mid: [['Erika', '各位旅客請繫好安全帶——要開始轉珠了。']],
    pre: [['免稅店香水女王', '前調是嫉妒、中調是虛榮、後調……是妳的失敗！'], ['Erika', '抱歉，我只擦自己的味道。']],
    outro: [['旁白', '落地後，一位頭等艙乘客遞來一張燙金邀請函——'], ['Erika', '「今晚，頂樓夜店，VIP 包廂。」']] },
  { no: 6, title: '夜色女王', sub: 'CHAPTER VI ・ AFTER DARK', img: 15, reward: 11,
    foes: [
      { name: '香檳塔精', kind: 'perfume', attr: 'jewel' }, { name: '亮片小包', kind: 'chain', attr: 'bag' },
      { name: '霓虹細跟', kind: 'stiletto', attr: 'heel' }, { name: '調酒果凍', kind: 'pudding', attr: 'dessert' },
      { name: 'VIP 黑卡', kind: 'blackcard', attr: 'card' }],
    boss: { name: '開瓶費帳單巨獸', kind: 'receipt', attr: 'card', crown: true, ability: { type: 'junk', n: 5 } },
    intro: [
      ['旁白', '五十一樓，音樂震動整層地板。'],
      ['Erika', '燈光、香檳、陌生人的讚美……好像全世界都在對我笑。'],
      ['Erika', '但我知道，真正屬於我的，只有我自己掙來的東西。'],
    ],
    mid: [['Erika', '不能被這種氣氛沖昏頭——Combo 要穩！']],
    pre: [['開瓶費帳單巨獸', '今晚的帳單，一共是……妳一輩子都付不起的數字！'], ['Erika', '那就讓我把它撕了！']],
    outro: [['Erika', '天亮了。好想去海邊吹吹風。'], ['旁白', '於是她訂了一張機票，飛往有椰子樹的地方。']] },
  { no: 7, title: '陽光假期', sub: 'CHAPTER VII ・ RIVIERA', img: 11, reward: 4,
    foes: [
      { name: '芒果冰山', kind: 'parfait', attr: 'dessert' }, { name: '草編沙灘包', kind: 'tote', attr: 'bag' },
      { name: '人字拖精', kind: 'sandal', attr: 'heel' }, { name: '珍珠貝殼', kind: 'ring', attr: 'jewel' },
      { name: '泳池派對卡', kind: 'blackcard', attr: 'card' }],
    boss: { name: '巨型芒果聖代', kind: 'parfait', attr: 'dessert', crown: true, ability: { type: 'regen' } },
    intro: [
      ['旁白', '六十一樓，整面落地窗外是一片人造的蔚藍海岸。'],
      ['Erika', '放假的時候，就要用力放假。'],
      ['Erika', '但連度假都有人想跟我比——比防曬、比泳衣、比誰的冰淇淋比較貴。'],
    ],
    mid: [['Erika', '游泳教練說：換氣要穩，轉珠也是。']],
    pre: [['巨型芒果聖代', '融化吧——在我的甜蜜裡融化吧！'], ['Erika', '我只融化在自己的努力裡。']],
    outro: [['旁白', '沙灘上停著一台鮮紅色的超跑，車門上寫著：「誠徵賽道女神」。'], ['Erika', '速度，我也想試試看。']] },
  { no: 8, title: '格子旗', sub: 'CHAPTER VIII ・ GRAND PRIX', img: 4, reward: 10,
    foes: [
      { name: '漆皮過膝靴', kind: 'boot', attr: 'heel' }, { name: '賽車手套包', kind: 'kelly', attr: 'bag' },
      { name: '獎盃鑽', kind: 'gem', attr: 'jewel' }, { name: '贊助商黑卡', kind: 'blackcard', attr: 'card' },
      { name: '能量甜甜圈', kind: 'donut', attr: 'dessert' }],
    boss: { name: '紅底戰靴・極速型', kind: 'boot', attr: 'bag', crown: true, ability: { type: 'first' } },
    intro: [
      ['旁白', '七十一樓，是一整條環狀賽道。'],
      ['Erika', '撐著傘站在格子旗下，引擎聲像心跳一樣。'],
      ['Erika', '原來女人也能站在速度的正中央。'],
    ],
    mid: [['Erika', '這一層的敵人會「先手攻擊」，開場就要穩住血量！']],
    pre: [['紅底戰靴・極速型', '起跑線上就分勝負了，妳還沒準備好吧？'], ['Erika', '我從巷口一路跑到這裡，早就熱身完了。']],
    outro: [['旁白', '頒獎台上，一位星探遞來報名表：「台灣小姐選拔」。'], ['Erika', '……我？']] },
  { no: 9, title: '后冠之夜', sub: 'CHAPTER IX ・ THE CROWN', img: 10, reward: 22,
    foes: [
      { name: '水晶后冠', kind: 'tiara', attr: 'jewel' }, { name: '綵帶高跟', kind: 'stiletto', attr: 'heel' },
      { name: '舞台手拿包', kind: 'chain', attr: 'bag' }, { name: '評審黑卡', kind: 'blackcard', attr: 'card' },
      { name: '慶功馬卡龍', kind: 'macaron', attr: 'dessert' }],
    boss: { name: '前任后冠', kind: 'tiara', attr: 'jewel', crown: true, ability: { type: 'combo', n: 5 } },
    intro: [
      ['旁白', '八十一樓，伸展台兩側亮起成千上萬顆燈泡。'],
      ['Erika', '站上去之前，我想起巷子口那個連鏡子都不敢照的自己。'],
      ['Erika', '謝謝妳沒有放棄。這一次，換我帶妳走上去。'],
    ],
    mid: [['Erika', '笑容要對著鏡頭，Combo 要對著敵人！']],
    pre: [['前任后冠', '后冠只能有一個主人。想要？就從我頭上拿走。'], ['Erika', '我不搶——我用實力戴上它。']],
    outro: [['旁白', '「本屆台灣小姐——Erika！」'], ['Erika', '終於……只剩最後十層了。'], ['旁白', '電梯門打開，頂樓的水晶燈光灑了下來。']] },
  { no: 10, title: '名媛之巔', sub: 'CHAPTER X ・ THE SUMMIT', img: 22, reward: 17,
    foes: [
      { name: '鑽石鉑金包', kind: 'kelly', attr: 'jewel' }, { name: '水晶玻璃鞋', kind: 'stiletto', attr: 'heel' },
      { name: '金箔千層', kind: 'cake', attr: 'dessert' }, { name: '無限額度黑卡', kind: 'blackcard', attr: 'card' },
      { name: '貂皮手拿包', kind: 'chain', attr: 'bag' }],
    boss: { name: '傳說之包 Le Grand Sac', kind: 'kelly', attr: 'card', crown: true, ability: { type: 'enrage' }, final: true },
    intro: [
      ['旁白', '九十一樓，名媛之塔的頂層沙龍。'],
      ['Erika', '貂皮披肩、絲絨長裙、水晶燈……我曾經以為這些就是「名媛」。'],
      ['Erika', '現在我懂了。名媛不是穿上什麼，而是成為什麼。'],
      ['Erika', '工地的安全帽、甜點店的圍裙、空姐的絲巾——每一個我，都是我。'],
    ],
    mid: [['Erika', '這裡的每一個包，都比我以前的房租還貴……但我不怕。']],
    pre: [['傳說之包 Le Grand Sac', '一百層了，女孩。妳想要的，到底是我，還是妳自己？'], ['Erika', '我想要的——是證明我配得上任何東西。']],
    outro: [
      ['旁白', 'Le Grand Sac 緩緩落進 Erika 的手中，輕得不可思議。'],
      ['Erika', '原來……它是空的。'],
      ['Erika', '要裝什麼，從來都是我自己決定。'],
      ['旁白', '隔年，名媛之塔換了新主人。頂樓辦公室的門牌上寫著：Erika，執行長。'],
      ['Erika', '巷口的女孩們——塔門永遠為妳們開著。'],
    ] },
];

// ── 100 關生成 ───────────────────────────────
// 每章 10 層：第 5 層小頭目、第 10 層章節魔王
DT.STAGES = [];
(function buildStages() {
  for (let f = 1; f <= 100; f++) {
    const ch = DT.CHAPTERS[Math.floor((f - 1) / 10)];
    const k = (f - 1) % 10 + 1;
    const hpBase = 360 * Math.pow(1.057, f - 1);
    const atkBase = 130 * Math.pow(1.042, f - 1) * (f > 85 ? 0.85 : 1);
    const waves = [];
    const nWaves = k === 10 ? 3 : k >= 5 ? 3 : 2;
    let seed = f * 9973;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let w = 0; w < nWaves; w++) {
      const last = w === nWaves - 1;
      const wave = [];
      if (last && k === 10) {
        wave.push(mkFoe(ch.boss, hpBase * (f === 100 ? 16 : 9), atkBase * 1.7, 3, true, f));
      } else if (last && k === 5) {
        const b = ch.foes[Math.floor(rnd() * ch.foes.length)];
        const ab = f >= 15 ? [{ type: 'combo', n: 3 + Math.min(2, Math.floor(f / 30)) }, { type: 'junk', n: 3 }, { type: 'regen' }, { type: 'enrage' }][Math.floor(rnd() * 4)] : null;
        wave.push(mkFoe({ ...b, name: '精英・' + b.name, crown: false, elite: true, ability: ab }, hpBase * 4.2, atkBase * 1.4, 3, false, f));
        wave.push(mkFoe(ch.foes[Math.floor(rnd() * ch.foes.length)], hpBase * 0.8, atkBase * 0.8, 2, false, f));
      } else {
        const n = 1 + Math.min(2, Math.floor(rnd() * 3 + (f > 3 ? 0.6 : 0)));
        for (let i = 0; i < n; i++) {
          const b = ch.foes[Math.floor(rnd() * ch.foes.length)];
          wave.push(mkFoe(b, hpBase * (n === 1 ? 1.7 : 1) * (0.9 + rnd() * 0.25), atkBase * (n === 1 ? 1.2 : n === 2 ? 0.9 : 0.75), 1 + Math.floor(rnd() * 3), false, f));
        }
      }
      waves.push(wave);
    }
    DT.STAGES.push({
      floor: f, chapter: ch.no, k, waves,
      name: k === 10 ? ch.boss.name : k === 5 ? '精英關卡' : `${ch.title} ${k}F`,
      stamina: 4 + Math.floor(f / 12),
      gold: Math.round(100 * Math.pow(1.055, f - 1)),
      exp: Math.round(120 * Math.pow(1.06, f - 1)),
      gems: k === 10 ? 5 : k === 5 ? 2 : 1, // 首次通關給粉鑽
    });
  }
  function mkFoe(base, hp, atk, cd, boss, f) {
    const def = Math.round(atk * (boss ? 0.35 : 0.15) * (f > 30 ? 1.3 : 1));
    return { name: base.name, kind: base.kind, attr: base.attr, hp: Math.round(hp), atk: Math.round(atk), def, cd, boss: !!boss, elite: !!base.elite, crown: !!base.crown || boss, ability: base.ability || null, final: !!base.final };
  }
})();

// 玩法：swap＝三消（預設），drag＝轉珠。三消一步的 Combo 比較少，所以 Combo 門檻減半、傷害另外乘倍率
DT.mode = () => (DT.S && DT.S.settings.mode) || 'swap';
DT.MODE_MULT = { swap: 3, drag: 1 };
DT.MODE_FOE_ATK = { swap: 0.8, drag: 1 }; // 三消比較悠閒：敵人攻擊也輕一點
DT.modeMult = () => DT.MODE_MULT[DT.mode()];
DT.comboNeed = n => DT.mode() === 'swap' ? Math.max(2, Math.round(n / 2)) : n;
DT.skillDesc = card => (DT.mode() === 'swap' && card.skill.type === 'time') ? `${card.skill.turns} 回合內全隊攻擊力 1.5 倍` : card.skill.desc;
DT.leaderDesc = card => {
  const L = card.leader;
  if (DT.mode() !== 'swap') return L.desc;
  if (L.type === 'time') return L.desc.replace(/轉珠時間延長 \d+ 秒，/, '');
  if (L.type === 'combo') return L.desc.replace(/\d+ Combo/, DT.comboNeed(L.n) + ' Combo');
  return L.desc;
};
DT.ABILITY_TEXT = {
  combo: a => `連擊護盾：少於 ${DT.comboNeed(a.n)} Combo 傷害無效`,
  junk: a => `過季攻勢：攻擊時把 ${a.n} 粒珠變成過季貨`,
  enrage: () => '殘血狂暴：生命低於 35% 攻擊力翻倍',
  regen: () => '貴婦保養：攻擊時回復 15% 生命',
  first: () => '先手：開場立刻攻擊',
};

// ── 名牌福袋（抽卡） ───────────────────────────
DT.GACHA = {
  single: 5, ten: 45, // 粉鑽
  rates: [{ r: 6, p: 0.03 }, { r: 5, p: 0.12 }, { r: 4, p: 0.35 }, { r: 3, p: 0.50 }],
  pity: 60, // 60 抽內必出 ★6
};

// ── 儲值（模擬） ────────────────────────────
DT.SHOP = [
  { id: 'g6',    ntd: 30,   gems: 6,   bonus: 0,   name: '一小把粉鑽' },
  { id: 'g32',   ntd: 150,  gems: 30,  bonus: 2,   name: '一袋粉鑽' },
  { id: 'g72',   ntd: 330,  gems: 66,  bonus: 6,   name: '一盒粉鑽', tag: '熱銷' },
  { id: 'g225',  ntd: 990,  gems: 198, bonus: 27,  name: '粉鑽首飾盒' },
  { id: 'g480',  ntd: 1990, gems: 398, bonus: 82,  name: '粉鑽保險箱', tag: '超值' },
  { id: 'g830',  ntd: 3290, gems: 658, bonus: 172, name: '粉鑽金庫' },
];
DT.PACKS = [
  { id: 'starter', ntd: 90,  name: '新手名媛禮包', desc: '30 粉鑽＋★5 確定福袋券＋5 萬金幣', once: true, gems: 30, gold: 50000, ticket5: 1 },
  { id: 'monthly', ntd: 150, name: '名媛月卡', desc: '立即 30 粉鑽，之後 30 天每天登入再領 5 粉鑽', gems: 30, monthly: 30 },
  { id: 'stamina', ntd: 60,  name: '補妝體力包', desc: '體力全滿＋上限永久 +10', once: true, staminaMax: 10, refill: true },
  { id: 'vip6',    ntd: 1490, name: '貂皮名媛限定組', desc: '200 粉鑽＋★6 確定福袋券', once: true, gems: 200, ticket6: 1 },
];
DT.VIP = [0, 300, 1000, 3000, 8000, 20000, 50000]; // 累積 NT$ 門檻
DT.VIP_PERK = ['', '體力上限 +5', '每日簽到粉鑽 +1', '體力上限 +10、金幣 +10%', '每日簽到粉鑽 +2', '金幣 +25%、經驗 +10%', '每日簽到粉鑽 +5、全隊生命 +5%'];

// 戰鬥時的「閨蜜」助戰（NPC）
DT.FRIENDS = [
  { name: 'Coco', tagline: '下午茶永遠我請' }, { name: 'Vivian', tagline: '衣櫃比房間大' },
  { name: 'Mia', tagline: '專櫃 VVIP' }, { name: 'Bella', tagline: '只穿 12 公分' },
  { name: 'Chloe', tagline: '甜點部落客' }, { name: 'Ivy', tagline: '收藏三百顆鑽' },
];

DT.STAMINA_REGEN_MS = 3 * 60 * 1000;
DT.REVIVE_COST = 5;
