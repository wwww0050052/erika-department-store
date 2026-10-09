// 一次跑完所有玩法的單元測試：node tools/tests/run-all.mjs
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const suites = [
  ['時尚消消樂', ['match3.test.mjs']],
  ['名媛王國', ['kingdom.test.mjs']],
  ['名媛對決', ['arena.test.mjs']],
  ['貴婦妞妞＋名媛十三支', ['--test', 'cards.test.cjs']],
  ['名媛吃雞大作戰', ['royale.test.cjs']],
  ['貴婦麻將館（規則）', ['mahjong/core.test.mjs']],
  ['貴婦麻將館（對打模擬）', ['mahjong/sim.test.mjs']],
];
let failed = 0;
for (const [name, args] of suites) {
  const t = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}（${((Date.now() - t) / 1000).toFixed(1)} 秒）`);
  if (!ok) console.log((r.stdout + r.stderr).split('\n').slice(-15).join('\n'));
}
console.log(failed ? `\n${failed} 組失敗` : '\n全部通過');
process.exit(failed ? 1 : 0);
