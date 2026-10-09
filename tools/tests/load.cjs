// 用 vm 載入遊戲檔（假的 window）
const vm = require('vm'), fs = require('fs'), path = require('path');
const REPO_ROOT = require('path').resolve(__dirname, '../..').replace(/\\/g, '/') + '/';
const ROOT = REPO_ROOT + 'js/games/';
module.exports = function load(files = ['cards.js', 'niuniu.js', 'poker13.js']) {
  const win = { ErikaGames: [] };
  const ctx = vm.createContext({ window: win, console, Math, Date, Set, Map, Array, Object, JSON, Number, String, Error, Promise, setTimeout, clearTimeout, Int32Array, Float64Array, Uint8Array, Uint16Array, Int8Array });
  for (const f of files) { const p = ROOT + f; if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  return win;
};
