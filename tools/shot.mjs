// 無頭 Edge 截圖／操作工具（開發用）
// 用法：node tools/shot.mjs <網址> <輸出.png> [--w 390] [--h 844] [--wait 1500] [--steps steps.json]
// steps.json 是陣列，每一步可以是：
//   {"wait": 毫秒} | {"eval": "JS 程式（可 await，回傳值會印出）"} | {"tap": [x, y]} | {"drag": [x1, y1, x2, y2]} | {"shot": "另一張.png"}
// 頁面的 console 錯誤與例外會印在終端機上。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const url = args[0], out = args[1];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('w', 390), H = +opt('h', 844), WAIT = +opt('wait', 1500);
const steps = opt('steps') ? JSON.parse(fs.readFileSync(opt('steps'), 'utf8')) : [];
if (!url || !out) { console.error('用法：node tools/shot.mjs <網址> <輸出.png> [--steps steps.json]'); process.exit(1); }

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
const port = 9300 + Math.floor(Math.random() * 600);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'erika-shot-'));
const proc = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, seq = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); target = list.find(t => t.type === 'page'); } catch { /* 還沒好 */ }
  }
  if (!target) throw new Error('瀏覽器沒有啟動');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') console.log('[頁面例外]', m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
    else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) console.log(`[console.${m.params.type}]`, m.params.args.map(a => a.value ?? a.description).join(' '));
    else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') console.log('[載入錯誤]', m.params.entry.text, m.params.entry.url || '');
  });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  try { await send('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch { /* 舊版瀏覽器沒有 */ }
  await send('Page.navigate', { url });
  await sleep(WAIT);
  const shot = async file => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); console.log('截圖', file); };
  const mouse = async (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, pointerType: 'mouse' });
  for (const s of steps) {
    if (s.wait) await sleep(s.wait);
    if (s.eval) { const r = await send('Runtime.evaluate', { expression: `(async()=>{${s.eval}})()`, awaitPromise: true, returnByValue: true }); console.log('eval →', JSON.stringify(r.result?.value ?? r.exceptionDetails?.exception?.description)); }
    if (s.tap) { await mouse('mouseMoved', ...s.tap); await mouse('mousePressed', ...s.tap); await sleep(40); await mouse('mouseReleased', ...s.tap); }
    if (s.drag) { const [x1, y1, x2, y2] = s.drag; await mouse('mousePressed', x1, y1); for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', x1 + (x2 - x1) * i / 8, y1 + (y2 - y1) * i / 8); await sleep(16); } await mouse('mouseReleased', x2, y2); }
    if (s.shot) await shot(s.shot);
  }
  await shot(out);
} catch (e) { console.error('失敗：', e.message); process.exitCode = 1; }
finally { try { ws && ws.close(); } catch { /* 略 */ } proc.kill(); await sleep(300); try { fs.rmSync(prof, { recursive: true, force: true }); } catch { /* 略 */ } }
