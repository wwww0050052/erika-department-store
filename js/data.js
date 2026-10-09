// ERIKA 百貨貴婦 — 遊戲資料表
'use strict';
window.ERIKA_DATA = (() => {
  // 百貨樓層：cost = 開幕價，inc = 每級每秒收益
  const FLOORS = [
    { id: 'cosme',  name: '美妝專櫃', en: 'BEAUTY',        icon: 'lipstick',  cost: 10,     inc: 0.4,   tint: '#f9d0dc', line: '口紅粉餅保養品，貴婦天天都要補貨' },
    { id: 'scent',  name: '香氛沙龍', en: 'PARFUM',        icon: 'perfume',   cost: 120,    inc: 3,     tint: '#ead6f5', line: '一噴就是名媛的味道' },
    { id: 'bag',    name: '名品包包', en: 'MAROQUINERIE',  icon: 'handbag',   cost: 1.4e3,  inc: 18,    tint: '#f5dfc6', line: '包包永遠少一個' },
    { id: 'shoe',   name: '精品鞋履', en: 'SOULIERS',      icon: 'heel',      cost: 1.6e4,  inc: 100,   tint: '#f9d3d3', line: '紅底高跟鞋，走路都有風' },
    { id: 'jewel',  name: '珠寶鑽飾', en: 'JOAILLERIE',    icon: 'diamond',   cost: 2e5,    inc: 600,   tint: '#d4e8f6', line: '鑽石是女人最好的朋友' },
    { id: 'gown',   name: '晚宴禮服', en: 'COUTURE',       icon: 'gown',      cost: 2.6e6,  inc: 3.5e3, tint: '#f6cfe0', line: '今晚的慈善晚宴穿哪一件？' },
    { id: 'watch',  name: '瑞士名錶', en: 'HORLOGERIE',    icon: 'watch',     cost: 3.5e7,  inc: 2e4,   tint: '#ece4d2', line: '時間就是貴婦的金錢' },
    { id: 'sweet',  name: '法式甜點', en: 'PÂTISSERIE',    icon: 'cake',      cost: 5e8,    inc: 1.2e5, tint: '#fbe3cc', line: '逛累了，來份馬卡龍下午茶' },
    { id: 'spa',    name: '貴婦SPA',  en: 'SPA & SOIN',    icon: 'lotus',     cost: 7.5e9,  inc: 7.5e5, tint: '#d6f0e5', line: '做臉按摩，凍齡祕方都在這' },
    { id: 'bridal', name: '婚紗殿堂', en: 'BRIDAL',        icon: 'ring',      cost: 1.2e11, inc: 5e6,   tint: '#efeaf8', line: '名媛的夢幻婚禮從這裡開始' },
    { id: 'lounge', name: '香檳酒廊', en: 'CHAMPAGNE',     icon: 'champagne', cost: 2e12,   inc: 3.5e7, tint: '#f6e8bd', line: '頂樓夜景配香檳，乾杯！' },
    { id: 'jet',    name: '私人機場', en: 'PRIVATE JET',   icon: 'jet',       cost: 3.5e13, inc: 2.5e8, tint: '#dfe5f7', line: '週末飛巴黎喝下午茶' },
  ];

  // 衣櫥分類（opt = 可以不穿）
  const CATS = [
    { id: 'dress', name: '服裝' },
    { id: 'hair',  name: '髮色' },
    { id: 'bag',   name: '包包', opt: true },
    { id: 'jewel', name: '珠寶', opt: true },
    { id: 'head',  name: '頭飾', opt: true },
    { id: 'shoes', name: '鞋子' },
    { id: 'pet',   name: '寵物', opt: true },
  ];

  // 時尚單品：cost = 金幣價、gems = 粉鑽價、gacha = 福袋限定稀有度；bonus = 擁有就加的收益倍率
  const ITEMS = [
    // 髮型
    { id: 'hair_black',  cat: 'hair', name: '蜜桃金漸層',       style: 'straight', c: '#2e1f27', d: '#120a0f', free: true, bonus: 0 },
    { id: 'hair_wave',   cat: 'hair', name: '栗子棕',   style: 'wave',     c: '#7d4b33', d: '#4a2a1b', cost: 300,   bonus: .05 },
    { id: 'hair_bun',    cat: 'hair', name: '經典黑',     style: 'bun',      c: '#3b2630', d: '#1e1219', cost: 2e4,   bonus: .08 },
    { id: 'hair_gold',   cat: 'hair', name: '蜜糖金',   style: 'curly',    c: '#e9bb68', d: '#b5813a', cost: 2e6,   bonus: .12 },
    { id: 'hair_pink',   cat: 'hair', name: '粉紅公主',   style: 'curly',    c: '#f59ab9', d: '#cf5f8a', gems: 120,   bonus: .4 },
    { id: 'hair_lilac',  cat: 'hair', name: '薰衣草紫', style: 'wave',     c: '#bba4e8', d: '#8668c2', gacha: 'SR', bonus: .4 },
    { id: 'hair_silver', cat: 'hair', name: '白金銀', style: 'bob',      c: '#f1ebe7', d: '#b9aca8', gacha: 'SSR', bonus: 1 },

    // 服裝
    { id: 'dress_white',     cat: 'dress', name: '粉櫻公主裝',   shape: 'aline',   f: '#ffffff', a: '#f3c3d2', sl: 'puff', free: true, bonus: 0 },
    { id: 'dress_mint',      cat: 'dress', name: '薄荷蓬蓬裙',   shape: 'aline',   f: '#bfe8d7', a: '#ffffff', sl: 'puff', cost: 800,   bonus: .05 },
    { id: 'dress_tweed',     cat: 'dress', name: '粗花呢洋裝', shape: 'suit',  f: '#f7d3de', a: '#2e1f27', pat: 'tweed', cost: 8e3, bonus: .08 },
    { id: 'dress_rose',      cat: 'dress', name: '玫瑰紅禮服', shape: 'gown',    f: '#d3365f', a: '#f6b3c5', sl: 'none', cost: 1.5e5, bonus: .12 },
    { id: 'dress_lbd',       cat: 'dress', name: '黑色小禮服',   shape: 'aline',   f: '#26171f', a: '#e4c47c', sl: 'none', cost: 3e6,   bonus: .15 },
    { id: 'dress_leopard',   cat: 'dress', name: '豹紋貴婦洋裝', shape: 'coat',    f: '#dba566', a: '#3a2214', fur: '#f7efe7', pat: 'leopard', cost: 6e7, bonus: .2 },
    { id: 'dress_lavender',  cat: 'dress', name: '薰衣草紗裙',   shape: 'gown',    f: '#cfbaf0', a: '#ffffff', sl: 'puff', tulle: true, cost: 1.2e9, bonus: .25 },
    { id: 'dress_fur',       cat: 'dress', name: '白貂皇后裝', shape: 'coat',    f: '#fbf5f1', a: '#c9a35b', fur: '#ffffff', cost: 3e11, bonus: .35 },
    { id: 'dress_champagne', cat: 'dress', name: '香檳亮片禮服', shape: 'mermaid', f: '#e8cd93', a: '#fff5d6', pat: 'sequin', sl: 'none', gems: 300, bonus: .6 },
    { id: 'dress_polka',     cat: 'dress', name: '復古波卡洋裝', shape: 'aline',   f: '#e84c70', a: '#ffffff', pat: 'polka', sl: 'puff', gacha: 'R', bonus: .15 },
    { id: 'dress_starry',    cat: 'dress', name: '星空晚宴服',   shape: 'gown',    f: '#2a265c', a: '#ecd08a', pat: 'stars', sl: 'none', gacha: 'SR', bonus: .4 },
    { id: 'dress_mermaid',   cat: 'dress', name: '粉鑽亮片禮服', shape: 'mermaid', f: '#f7a8c6', a: '#ffffff', pat: 'sequin', sl: 'none', gacha: 'SSR', bonus: 1.2 },

    // 包包
    { id: 'bag_tote',    cat: 'bag', name: '帆布托特包',   shape: 'tote',    f: '#efe2cf', a: '#c9a35b', cost: 150,   bonus: .03 },
    { id: 'bag_quilt',   cat: 'bag', name: '菱格紋鍊條包', shape: 'quilt',   f: '#2e1f27', a: '#e4c47c', pat: 'quilt', cost: 4e4, bonus: .08 },
    { id: 'bag_croc',    cat: 'bag', name: '鱷魚皮手提包', shape: 'handbag', f: '#7b3b2e', a: '#e4c47c', pat: 'croc', cost: 8e6, bonus: .15 },
    { id: 'bag_pearl',   cat: 'bag', name: '迷你珍珠包',   shape: 'mini',    f: '#fff7f0', a: '#efe0cf', cost: 2e9,   bonus: .25 },
    { id: 'bag_ostrich', cat: 'bag', name: '粉紅鴕鳥皮包', shape: 'handbag', f: '#f2a3bd', a: '#e4c47c', pat: 'ostrich', gems: 200, bonus: .5 },
    { id: 'bag_mint',    cat: 'bag', name: '薄荷小方包',   shape: 'box',     f: '#a9e0cb', a: '#ffffff', gacha: 'R', bonus: .15 },
    { id: 'bag_crystal', cat: 'bag', name: '水晶晚宴包',   shape: 'clutch',  f: '#dfe9f7', a: '#ffffff', pat: 'crystal', gacha: 'SSR', bonus: 1 },

    // 珠寶
    { id: 'jewel_pearl',    cat: 'jewel', name: '珍珠項鍊',     kind: 'pearl',   cost: 2e3,   bonus: .05 },
    { id: 'jewel_diamond',  cat: 'jewel', name: '鑽石項鍊',     kind: 'pendant', g: '#eaf5ff', ch: '#d8dde6', cost: 5e5, bonus: .12 },
    { id: 'jewel_ruby',     cat: 'jewel', name: '紅寶石項鍊',   kind: 'pendant', g: '#d3204a', ch: '#e4c47c', cost: 4e8, bonus: .2 },
    { id: 'jewel_emerald',  cat: 'jewel', name: '祖母綠項鍊',   kind: 'pendant', g: '#1f9e6e', ch: '#e4c47c', gems: 250, bonus: .55 },
    { id: 'jewel_sapphire', cat: 'jewel', name: '藍寶石項鍊',   kind: 'pendant', g: '#2f56c9', ch: '#d8dde6', gacha: 'SR', bonus: .4 },
    { id: 'jewel_pinkdia',  cat: 'jewel', name: '傳奇粉鑽項鍊', kind: 'pendant', g: '#ff8fbf', ch: '#eef1f6', big: true, gacha: 'SSR', bonus: 1.5 },

    // 頭飾
    { id: 'head_sunglass',   cat: 'head', name: '名媛墨鏡',   kind: 'sunglass',   cost: 5e3,   bonus: .05 },
    { id: 'head_hat',        cat: 'head', name: '寬簷淑女帽', kind: 'hat',        f: '#f3e5d2', a: '#2e1f27', cost: 1e6, bonus: .12 },
    { id: 'head_pearlband',  cat: 'head', name: '珍珠髮箍',   kind: 'pearlband',  cost: 1.5e8, bonus: .18 },
    { id: 'head_fascinator', cat: 'head', name: '名媛小禮帽', kind: 'fascinator', f: '#2e1f27', a: '#d3365f', gems: 180, bonus: .45 },
    { id: 'head_bow',        cat: 'head', name: '蝴蝶結髮飾', kind: 'bow',        f: '#f37ca0', gacha: 'R', bonus: .15 },
    { id: 'head_tiara',      cat: 'head', name: '鑽石皇冠',   kind: 'tiara',      gacha: 'SSR', bonus: 1.5 },

    // 鞋子
    { id: 'shoes_nude',  cat: 'shoes', name: '粉櫻高跟鞋', f: '#e7c0aa', free: true, bonus: 0 },
    { id: 'shoes_red',   cat: 'shoes', name: '漆黑高跟鞋', f: '#26171f', sole: '#d71e3c', cost: 1.2e4, bonus: .06 },
    { id: 'shoes_gold',  cat: 'shoes', name: '金色細跟鞋', f: '#e4c47c', cost: 2.5e7, bonus: .18 },
    { id: 'shoes_pink',  cat: 'shoes', name: '粉紅緞面鞋', f: '#f7b7ca', gacha: 'R', bonus: .15 },
    { id: 'shoes_glass', cat: 'shoes', name: '水晶玻璃鞋', f: '#dff1ff', glass: true, gacha: 'SSR', bonus: 1 },

    // 寵物
    { id: 'pet_poodle', cat: 'pet', name: '白色貴賓狗', kind: 'poodle', f: '#fffaf7', cost: 6e4,  bonus: .1 },
    { id: 'pet_toy',    cat: 'pet', name: '茶杯貴賓',   kind: 'poodle', f: '#eab48b', cost: 5e10, bonus: .3 },
    { id: 'pet_cat',    cat: 'pet', name: '波斯貓',     kind: 'cat',    f: '#f2ede9', gems: 400, bonus: .7 },
    { id: 'pet_pom',    cat: 'pet', name: '博美犬',     kind: 'pom',    f: '#f0a95b', gacha: 'SR', bonus: .4 },
  ];

  // 儲值方案（模擬，不扣款）
  const PACKS = [
    { id: 'p30',   ntd: 30,   gems: 60,   bonus: 0,    art: 1 },
    { id: 'p150',  ntd: 150,  gems: 300,  bonus: 30,   art: 2 },
    { id: 'p390',  ntd: 390,  gems: 780,  bonus: 100,  art: 3, tag: '人氣' },
    { id: 'p790',  ntd: 790,  gems: 1580, bonus: 260,  art: 4 },
    { id: 'p1490', ntd: 1490, gems: 2980, bonus: 600,  art: 5, tag: '超值' },
    { id: 'p3290', ntd: 3290, gems: 6580, bonus: 1600, art: 6, tag: '貴婦首選' },
  ];
  const SPECIALS = [
    { id: 'month', ntd: 170, name: '貴婦月卡', desc: '立即得 300 粉鑽，之後 30 天每天登入再領 100 粉鑽', gems: 300 },
    { id: 'pass', ntd: 300, name: '貴婦尊榮通行證', desc: '本季通行證的尊榮獎勵全部開放（含兩件 SSR），立刻升 5 階', gems: 0 },
    { id: 'debut', ntd: 990, name: '名媛出道禮包', desc: '1,200 粉鑽＋福袋券 10 張＋雙倍營收 24 小時（限購一次）', gems: 1200, tickets: 10, double: 24 * 3600e3, once: true },
  ];

  // 累計儲值（NT$）達標的 VIP 等級
  const VIP = [30, 300, 1000, 3000, 6000, 12000, 25000, 50000, 100000, 200000];

  // 按累計收益升等的貴婦稱號
  const TITLES = [
    [0, '小資女孩'], [1e4, '精緻OL'], [1e6, '輕熟女'], [1e8, '小名媛'], [1e10, '名媛'],
    [1e12, '社交名媛'], [1e14, '貴婦'], [1e16, '頂級貴婦'], [1e18, '豪門貴婦'],
    [1e21, '百貨女王'], [1e25, '時尚女帝'], [1e30, '宇宙第一貴婦'],
  ];

  // 分店城市：天空顏色、遮陽棚顏色
  const CITIES = [
    { name: '台北',   en: 'TAIPEI',    sky: ['#ffd3e0', '#fff4f1'], awn: '#e0628a' },
    { name: '東京',   en: 'TOKYO',     sky: ['#ffd5e9', '#fff1f7'], awn: '#e6779f' },
    { name: '首爾',   en: 'SEOUL',     sky: ['#e2dafc', '#fbf5ff'], awn: '#9a7ad9' },
    { name: '新加坡', en: 'SINGAPORE', sky: ['#ffdcc4', '#fff6ec'], awn: '#e38a60' },
    { name: '巴黎',   en: 'PARIS',     sky: ['#e3d6f6', '#fbf5ff'], awn: '#8c69c5' },
    { name: '米蘭',   en: 'MILANO',    sky: ['#f6e0c4', '#fff8ef'], awn: '#c38d45' },
    { name: '倫敦',   en: 'LONDON',    sky: ['#d6e3f1', '#f6f9fc'], awn: '#587aa9' },
    { name: '紐約',   en: 'NEW YORK',  sky: ['#f1d4c7', '#fff4ee'], awn: '#b54d58' },
    { name: '杜拜',   en: 'DUBAI',     sky: ['#f6dfb2', '#fff8e6'], awn: '#bf963b' },
    { name: '摩納哥', en: 'MONACO',    sky: ['#cbe6ee', '#f2fbfd'], awn: '#2e8c97' },
  ];

  const ACH = [
    { id: 'tap1',  name: '第一百次心動',   desc: '點擊 100 次',         gems: 5,   k: 'taps',   n: 100 },
    { id: 'tap2',  name: '血拼停不下來',   desc: '點擊 1,000 次',       gems: 10,  k: 'taps',   n: 1000 },
    { id: 'tap3',  name: '手指練成金手指', desc: '點擊 10,000 次',      gems: 30,  k: 'taps',   n: 1e4 },
    { id: 'tap4',  name: '傳說中的刷卡手', desc: '點擊 100,000 次',     gems: 80,  k: 'taps',   n: 1e5 },
    { id: 'earn1', name: '第一桶金',       desc: '累計賺進 1萬',        gems: 5,   k: 'life',   n: 1e4 },
    { id: 'earn2', name: '百萬名媛',       desc: '累計賺進 100萬',      gems: 10,  k: 'life',   n: 1e6 },
    { id: 'earn3', name: '億萬貴婦',       desc: '累計賺進 1億',        gems: 20,  k: 'life',   n: 1e8 },
    { id: 'earn4', name: '兆元俱樂部',     desc: '累計賺進 1兆',        gems: 50,  k: 'life',   n: 1e12 },
    { id: 'earn5', name: '富可敵國',       desc: '累計賺進 1京',        gems: 100, k: 'life',   n: 1e16 },
    { id: 'fl1',   name: '開張大吉',       desc: '開幕 3 層樓',         gems: 5,   k: 'floors', n: 3 },
    { id: 'fl2',   name: '半座百貨',       desc: '開幕 6 層樓',         gems: 15,  k: 'floors', n: 6 },
    { id: 'fl3',   name: '全館滿樓',       desc: '12 層樓全部開幕',     gems: 60,  k: 'floors', n: 12 },
    { id: 'it1',   name: '衣櫥小有收藏',   desc: '擁有 8 件單品',       gems: 10,  k: 'items',  n: 8 },
    { id: 'it2',   name: '更衣間不夠放',   desc: '擁有 20 件單品',      gems: 30,  k: 'items',  n: 20 },
    { id: 'it3',   name: '時尚博物館',     desc: '擁有 35 件單品',      gems: 80,  k: 'items',  n: 35 },
    { id: 'fv1',   name: '購物狂熱',       desc: '觸發 10 次購物狂熱',  gems: 10,  k: 'fevers', n: 10 },
    { id: 'fr1',   name: '閨蜜一籮筐',     desc: '接待 10 位貴婦閨蜜',  gems: 15,  k: 'friends', n: 10 },
    { id: 'gc1',   name: '福袋手氣王',     desc: '開 10 次福袋',        gems: 20,  k: 'pulls',  n: 10 },
    { id: 'vip1',  name: '尊榮 VIP',       desc: '第一次儲值',          gems: 20,  k: 'rech',   n: 1 },
    { id: 'm3a',   name: '消除達人',       desc: '時尚消消樂過 20 關',  gems: 20,  k: 'ev:m3_clear', n: 20 },
    { id: 'ara',   name: '對決新星',       desc: '名媛對決贏 10 場',    gems: 20,  k: 'ev:arena_win', n: 10 },
    { id: 'roa',   name: '今晚吃雞',       desc: '名媛吃雞拿下第 1 名', gems: 30,  k: 'ev:royale_win', n: 1 },
    { id: 'rob',   name: '神槍名媛',       desc: '吃雞累計淘汰 50 人',  gems: 30,  k: 'ev:royale_kill', n: 50 },
    { id: 'cda',   name: '牌桌女王',       desc: '牌桌贏 30 局',        gems: 20,  k: 'ev:card_win', n: 30 },
    { id: 'mja',   name: '自摸高手',       desc: '麻將胡牌 10 次',      gems: 20,  k: 'ev:mahjong_win', n: 10 },
    { id: 'kda',   name: '王國建築師',     desc: '王國建造升級 30 次',  gems: 20,  k: 'ev:kd_build', n: 30 },
    { id: 'hra',   name: '名媛養成',       desc: '英雄升級 30 次',      gems: 20,  k: 'ev:hero_up', n: 30 },
    { id: 'msa',   name: '任務達人',       desc: '完成 30 個每日任務',  gems: 30,  k: 'ev:mission', n: 30 },
    { id: 'br1',   name: '進軍國際',       desc: '開設第一家海外分店',  gems: 50,  k: 'branch', n: 1 },
  ];

  // 七日登入獎勵
  const DAILY = [
    { gems: 10 }, { mins: 10 }, { gems: 20 }, { tickets: 1 }, { gems: 30 }, { mins: 60 }, { gems: 80, tickets: 1 },
  ];

  const FRIEND_LINES = [
    '親愛的～這季新款我全包了！', 'Darling，今晚晚宴就靠妳了～', '這顏色好襯我，刷卡！',
    '幫我包起來，全部！', '我老公說隨便刷～', '聽說妳們進了限量款？', '下午茶順便逛一下～',
    '這個我要三個顏色！', '妳的包包好美，哪裡買的？', '我的 VIP 卡在這裡～',
  ];

  return { FLOORS, CATS, ITEMS, PACKS, SPECIALS, VIP, TITLES, CITIES, ACH, DAILY, FRIEND_LINES };
})();
