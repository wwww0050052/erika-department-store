// 把 index.html 轉成 claude.ai Artifact 用的頁面（Artifact 會自己包 <html><head><body>，所以只取內容）
// 用法：node tools/build-artifact.mjs <輸出檔路徑>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(root, 'dist', 'artifact.html');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const between = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); if (i < 0 || j < 0) throw new Error('找不到標記 ' + a); return html.slice(i + a.length, j).trim(); };
const title = html.match(/<title>([^<]*)<\/title>/)[1];

const page = [
  `<title>${title}</title>`,
  between('<!--HEAD-->', '<!--/HEAD-->'),
  // Artifact 外框已經幫 :root 加了安全區域留白，這裡就不要再加一次
  '<style>:root{--sat:0px;--sab:0px}</style>',
  between('<!--BODY-->', '<!--/BODY-->'),
].join('\n');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page + '\n');
console.log('已輸出', out, page.length, 'bytes');
