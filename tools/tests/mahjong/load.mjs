// 用 vm 載入 mahjong.js，取出 Core
import fs from 'node:fs';
import vm from 'node:vm';
export function loadCore() {
  const src = fs.readFileSync(REPO_ROOT + 'js/games/mahjong.js', 'utf8');
  const window = {};
  const ctx = vm.createContext({ window, console, setTimeout, clearTimeout, Promise, Math, Map, Set, Array, Object, JSON });
  vm.runInContext(src, ctx, { filename: 'mahjong.js' });
  const g = window.ErikaGames.find(x => x.id === 'mahjong');
  return g.core;
}
// 牌字串解析："123m 456p 789s 11z" → kinds；z: 1-7 = 東南西北中發白；f: 1-8 花
const REPO_ROOT = decodeURIComponent(new URL('../../../', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
export function K(str) {
  const out = [];
  for (const part of str.trim().split(/\s+/)) {
    const suit = part[part.length - 1];
    for (const ch of part.slice(0, -1)) {
      const n = +ch;
      if (suit === 'm') out.push(n - 1);
      else if (suit === 'p') out.push(9 + n - 1);
      else if (suit === 's') out.push(18 + n - 1);
      else if (suit === 'z') out.push(27 + n - 1);
      else if (suit === 'f') out.push(34 + n - 1);
    }
  }
  return out;
}
