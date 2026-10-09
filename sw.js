// ERIKA 百貨貴婦 — 離線快取（改版時把 VERSION 加一）
const VERSION = 'erika-v3';
const CORE = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css', 'css/kingdom.css', 'css/games/match3.css', 'css/games/arena.css', 'css/games/cards.css', 'css/games/royale.css', 'css/games/mahjong.css',
  'js/data.js', 'js/art.js', 'js/kingdom.js', 'js/game.js', 'js/avatar3d.js',
  'js/games/match3.js', 'js/games/arena.js', 'js/games/cards.js', 'js/games/niuniu.js', 'js/games/poker13.js', 'js/games/royale.js', 'js/games/mahjong.js',
  'vendor/three/three.module.min.js', 'vendor/three/three.core.min.js', 'vendor/three/addons/loaders/GLTFLoader.js', 'vendor/three/addons/utils/BufferGeometryUtils.js', 'vendor/three-vrm/three-vrm.module.min.js',
  'assets/models/victoria.vrm',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// 自己的檔案：先用網路（拿最新版），失敗再用快取；Google 字型：快取優先
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
    );
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
      }))
    );
  }
});
