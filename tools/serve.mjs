// 本機測試用的小型靜態伺服器：node tools/serve.mjs  → http://localhost:5180
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 5180;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

http.createServer((req, res) => {
  // 開發用：渲染工具把圖片 PUT 到 /__save/assets/cast/xxx.webp（只允許寫進 assets/）
  if (req.method === 'PUT' && req.url.startsWith('/__save/')) {
    const rel = decodeURIComponent(req.url.slice('/__save/'.length).split('?')[0]);
    const dest = path.join(root, rel);
    if (!/^assets[\\/][\w\-\\/]+\.(webp|png|json|vrm)$/.test(rel) || !dest.startsWith(path.join(root, 'assets') + path.sep)) { res.writeHead(403); return res.end(); }
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.concat(chunks));
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(port, () => console.log(`ERIKA 百貨貴婦：http://localhost:${port}`));
