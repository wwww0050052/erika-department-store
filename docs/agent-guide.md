# ERIKA百貨貴婦：玩法模組開發規範（給協作的開發者）

這是一款手機直式 PWA 點擊放置遊戲，主題是「百貨貴婦」，給女生玩。核心精神：
**只要一直按、不用動腦；想省腦力或省時間的地方，就用「粉鑽」（模擬儲值的代幣）換。**
所有輸贏都用遊戲內金幣／粉鑽，沒有真錢。

## 專案結構（不需要建置，純靜態檔）

- `index.html`：載入順序 `js/data.js` → `js/art.js` → `js/kingdom.js` → `js/game.js` → `js/games/*.js`（一般 `<script>`，不是 module）
- `js/game.js`：主程式（狀態 `S`、經濟、HUD、分頁、對話框、特效、音效），對外提供 **`window.ErikaAPI`**
- `css/style.css`：全站樣式與色票（`:root` 變數）
- `assets/cast/*.webp`：角色 3D 渲染立繪（見下）
- `vendor/three/…`、`vendor/three-vrm/…`：three.js r180 與 three-vrm（已有 importmap，classic script 可用 `await import('three')` 取得）
- `tools/serve.mjs`：本機靜態伺服器（`PORT=5181 node tools/serve.mjs`）
- `tools/shot.mjs`：無頭 Edge 截圖／操作工具（說明見檔頭）

## 你只能改你負責的檔案

每個玩法有固定檔名（佔位檔已存在，直接覆寫）。**不要修改其他檔案**（尤其 game.js、style.css、index.html）。
需要新增 API 時，先在自己的檔案裡做 fallback，並在最後的回報裡寫清楚需要什麼。不要 git commit。

| 玩法 | JS | CSS |
|---|---|---|
| 時尚消消樂（Candy Crush 式） | `js/games/match3.js` | `css/games/match3.css` |
| 名媛對決（傳說對決式 MOBA） | `js/games/arena.js` | `css/games/arena.css` |
| 撲克共用＋貴婦妞妞＋名媛十三支 | `js/games/cards.js`、`js/games/niuniu.js`、`js/games/poker13.js` | `css/games/cards.css` |
| 名媛吃雞大作戰（和平菁英式槍戰大逃殺） | `js/games/royale.js` | `css/games/royale.css` |
| 貴婦麻將館（明星三缺一式台灣 16 張） | `js/games/mahjong.js` | `css/games/mahjong.css` |
| 名媛王國（Kingshot 式主幹經營） | `js/kingdom.js` | `css/kingdom.css` |

## 小遊戲註冊方式

```js
'use strict';
(() => {
  // …你的程式…
  (window.ErikaGames = window.ErikaGames || []).push({
    id: 'match3', order: 1,                 // order：大廳排序
    name: '時尚消消樂', tagline: '三個一樣就消除',
    color: '#ff8fb5', color2: '#d6457a',   // 大廳卡片漸層
    badge: '新',                            // 可省略
    art: api => `<img src="${api.cast()[1].full}" alt="" style="height:96%;left:50%;bottom:-6%;transform:translateX(-50%)">`, // 大廳卡片插圖（HTML，絕對定位在卡片內）
    open(api) { /* 打開遊戲 */ },
  });
})();
```

`open(api)` 裡呼叫 `api.overlay({ id, title, onClose, beforeClose })` 取得全螢幕遊戲畫面：
`{ root, body, close(), setTitle(t) }`。上方標題列（返回鈕、金幣、粉鑽）已經做好，**你只負責 `body` 裡的內容**。
`body` 是 `position:relative; overflow:hidden; flex:1` 的容器，已經處理好 iPhone 安全區域。
關閉時（`onClose`）一定要停掉你的 requestAnimationFrame、計時器、事件監聽。

## window.ErikaAPI

| 成員 | 說明 |
|---|---|
| `coins` / `gems` / `tickets`（唯讀） | 目前金幣、粉鑽、福袋券 |
| `playerName`、`vip`（0–10）、`monthCard`（bool）、`sandbox`（bool） | |
| `incomePerSec()` | 玩家目前每秒收益（不含暫時加成），≥1 |
| `betUnit()` | 建議的「一注」金額 = 約 1 分鐘收益（≥100）。下注、獎勵都用它的倍數，玩家前中後期都適用 |
| `spendCoins(n, el?)` → bool | 扣金幣；不夠會自動提示（並搖晃 el） |
| `spendGems(n)` → bool | 扣粉鑽；不夠會自動跳「去儲值」對話框 |
| `addCoins(n, x?, y?)` | 獎勵金幣（算進累計營收）；給 x,y 會有金幣飛到右上角的動畫 |
| `payout(n, x?, y?)` | 退回／派彩金幣（不算進累計營收）。**博弈類的派彩用這個** |
| `addGems(n, x?, y?)`、`addTickets(n)` | |
| `fmt(n)` | 數字格式（萬、億、兆…） |
| `esc(s)` | HTML 跳脫（玩家名字等使用者輸入一定要用） |
| `toast(html, cls?)` | 上方提示，`cls='gold'` 為金色 |
| `modal({ title, body, actions:[{label, cls, fn(close, m, btn)}], x, queue, onOpen(m, close), onClose })` | 置中對話框（不要用 alert/confirm） |
| `twoTap(el, fn, refresh?)` | 花粉鑽的按鈕：第一下變「確認」，2.6 秒內再按一次才執行 |
| `shake(el)` | 搖晃提示 |
| `sound.tap/click/buy/cash/err/level/fever/drum/ssr/ding()`、`sound.beep(freq, dur, type, vol, delay)`、`sound.hiss(dur, vol, highpass, delay)` | 合成音效（WebAudio，會自動遵守玩家的音效開關） |
| `vib(ms 或 [pattern])` | 震動 |
| `fx.burst(x, y, n, kinds)`、`fx.rain(kind, n, rect)`、`fx.text(x, y, text, size, crit)` | 全螢幕粒子特效（kinds 可用 'confetti','spark','heart','coin','gem','bag'） |
| `icons.gem()`、`icons.coin()`、`icons.ticket()`、`icons.line(name)` | 內嵌 SVG 圖示 HTML |
| `cast()` | 角色陣列（見下） |
| `player()` | 玩家角色（Erika，名字是玩家自訂的） |
| `store(id)` | 你的永久存檔物件（會跟主存檔一起存）。**每次使用都重新呼叫，不要長期快取**（玩家「重新開始」後會換成新物件） |
| `save()` | 立刻存檔 |
| `stat(key, n)` | 累加統計（之後給成就用） |
| `go(page)`、`page`、`on('reset', fn)` | 切換分頁、目前分頁、玩家重新開始時的通知 |

### 連動系統（各玩法互相影響）

| 成員 | 說明 |
|---|---|
| `grant({ coins, gems, tickets, res:{silk,spice,ore,leaf}, shards:{<castId>:n}, speedup, passXp }, x?, y?, quiet?)` | 統一發獎。res = 王國資源（絲綢／香料／寶石原石／金箔）、shards = 英雄碎片、speedup = 王國加速（分鐘）。會自動跳獎勵提示（quiet 不跳） |
| `resUnit()` | 王國資源的基準量（約 1 小時產量，≥100），掉落量用它的倍數 |
| `event(name, data)` | 回報戰績：m3_play、m3_clear{stars}、arena_play{win}、arena_win、card_round{game,win}、card_win、royale_match{rank,kills}、royale_kill{n}、royale_win、mahjong_hand{win,tai}、mahjong_win、kd_build、kd_train、kd_march、kd_collect、kd_research、kd_boss |
| `heroes()` | 共用英雄名冊（全遊戲唯一來源）：[{ id, name, lv 1–60, star 1–6, shards, power, lvCost, starNeed, face(), full }] |
| `heroLevelUp(id, el)`、`heroStarUp(id, el)` | 升級（花金幣）／升星（花碎片） |
| `fashion()` | { power: 衣櫥時尚加成, owned: 件數, eq: 目前穿搭 } |
| `perk(name)` | 王國研究給各玩法的加成：m3_moves、arena_atk(%)、royale_armor、cards_rebate(%)、mahjong_hint |

## 角色（`api.cast()`）

| index | id | 名字 | 身分 | 主色 |
|---|---|---|---|---|
| 0 | erika | （玩家自訂，預設 Erika） | 百貨老闆娘（金髮粉紅公主裝） | #f08bb0 |
| 1 | vivi | 薇薇 | 甜點世家千金（棕色鮑伯、綠色圍裙洋裝） | #8cc46a |
| 2 | vita | 維塔 | 科技新貴偶像（銀髮、藍色電子風） | #3fb6e0 |
| 3 | chiyo | 千代 | 財閥大小姐（黑色短髮、制服） | #e8613c |
| 4 | shino | 詩乃 | 書香名門千金（黑長髮、制服） | #5a6fd6 |
| 5 | fumi | 史利 | Erika 的貼身管家（男生、棕髮、制服） | #c9a35b |

每個角色：`face(expr)` 回傳胸像網址（`expr` = `'neutral' | 'joy' | 'angry' | 'sad'`，384×384 透明背景 webp），`full` 是全身立繪（480×840 透明背景）。
需要更多對手時，可以用 CSS `filter: hue-rotate()` 或加上不同色的外框區分，名字自己取（台灣常見的優雅女生名字）。

## 視覺要求（使用者最在意的就是「精緻」）

- 手機直式 360–430px 寬為主，不能有橫向捲動；要能單手操作；按鈕至少 44px 高。
- 色彩沿用 `:root` 色票：`--rose #d6457a`、`--rose-deep`、`--gold #c9a35b`、`--gold-soft`、`--plum #3b1530`、`--ink`、`--ink-2`、`--line`、`--card`、`--bg`。各玩法可以有自己的主題色（例如麻將桌綠絨、對決的夜空紫），但要跟整體的「粉紅＋香檳金＋梅紫」精品感協調。
- 字體：`var(--f-display)`（Bodoni Moda，數字與英文標題）、`var(--f-zh)`（Noto Serif TC，中文標題）、`var(--f-body)`（內文）。
- 共用按鈕：`.btn`（玫瑰粉）、`.btn.gemb`（紫，花粉鑽）、`.btn.goldb`（金）、`.btn.ghost`（白）、`.btn.off`（不能按的灰）、`.btn small` 放價格。其他共用：`.eyebrow`、`.sub`、`.fine`。
- **你的所有 CSS 都要包在 `.g-<id>`（王國是 `.kd`）底下**，不要寫全域選擇器。
- 美術全部用程式畫（SVG / Canvas / CSS 漸層），要有光澤、陰影、漸層、細節，不要扁平陽春的色塊。可以用 `assets/cast/` 的立繪。**不要下載任何外部素材或函式庫。**
- 動畫要流暢有回饋：點擊縮放、粒子、數字跳動、勝利慶祝。尊重 `prefers-reduced-motion`。
- 所有文字用台灣繁體中文。不要使用原作遊戲的名稱或商標（例如不要寫「和平菁英」「傳說對決」「Candy Crush」「明星三缺一」「Kingshot」）。
- 不能有血腥：被擊中冒星星、金幣、愛心，倒地變成閃光消失。

## 「質感大作」標準（使用者特別強調，驗收時最重要）

要讓人覺得是大廠手遊，不是作業或小遊戲：
- **開場**：每個玩法都有自己的標題畫面（主視覺用角色立繪＋華麗標題字＋光暈／粒子），有「開始」按鈕、模式或難度、獎勵預覽、排行或戰績。
- **轉場**：進場、開局、回合、結算之間都有動畫（淡入、縮放、光束、卡片翻轉、鏡頭推進），不能瞬間切換。
- **回饋**：每一個操作都有聲音＋視覺＋（必要時）震動；連擊／大獎有分級的慶祝演出（字卡、全螢幕特效、角色表情立繪切換成 joy）。
- **結算畫面**：大字標題（勝利／吃雞／胡牌／過關）、星等或名次、獎勵一項一項跳出來計數、角色立繪與台詞、「再來一局」「返回」。
- **介面一致**：卡片、按鈕、圖示、面板都要有精品感（金邊細線、柔和陰影、漸層、玻璃感），資訊排版清楚，數字用 tabular-nums。
- **角色有戲**：用 `cast()` 的立繪與四種表情讓對手／隊友說台詞（對話泡泡），輸贏時換表情。
- **細節**：載入中有過場、空狀態有設計、按下有按壓效果、教學提示做成精美的引導泡泡（第一次玩自動出現一次）。

## 經濟與「用粉鑽換腦力」

- 下注、獎勵用 `api.betUnit()` 的倍數，讓前期後期都有感。博弈派彩用 `api.payout()`，純獎勵用 `api.addCoins()`。
- 每個玩法都要有「用粉鑽省腦力／省時間」的選項，價格約 5–60 粉鑽，例如：提示、自動玩、最佳解、復活、加步數、加速。按鈕用 `twoTap` 防誤觸。
- 一般免費的版本也要能玩、能贏，只是比較累或比較慢。

## 效能

- 中階手機 60fps。Canvas 要處理 devicePixelRatio（上限 2）。畫面不在前景時（`document.hidden`）或遊戲關閉時停止迴圈。
- 觸控用 Pointer Events，遊戲區 `touch-action: none`，避免捲動和雙擊縮放。

## 測試方式（不要用內建瀏覽器視窗，會跟別人衝突）

1. 啟動自己的伺服器（背景執行）：`PORT=518X node tools/serve.mjs`（X 用你被分配的號碼）
2. 沙盒模式直接開你的遊戲：`http://localhost:518X/?sandbox&game=<id>`（資源給滿、不讀寫存檔、跳過所有開場對話框）
3. 截圖：`node tools/shot.mjs "<網址>" out.png --steps steps.json`，steps 可以 `eval` 執行 JS、`tap` 點擊座標、`drag` 拖曳、`wait`、`shot` 中途截圖；頁面錯誤會印在終端機。用 Read 工具看 PNG。截圖檔放在 scratchpad 或系統暫存，不要放進專案。
4. 規則邏輯（算牌、判胡、配對）請寫成純函式並用 node 做單元測試（例如用 `vm` 載入你的檔案、提供假的 `window`）。
5. 最後確認：`node --check` 通過、沙盒截圖沒有 console 錯誤、主要流程（開始→玩→結算→再玩→關閉）都走得通。

## 回報

完成後用中文簡短回報：做了哪些功能、怎麼測的（附上最後幾張截圖的路徑）、已知限制、需要主程式補什麼 API。
