// 名媛之塔 — 離線快取（改版時把 VERSION 加一）
const VERSION = 'tower-v1';
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tower.css',
  'js/data.js',
  'js/art.js',
  'js/state.js',
  'js/board.js',
  'js/battle.js',
  'js/app.js',
  'icons/apple-touch-icon.png',
  'icons/favicon-64.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'img/card/c00.webp',
  'img/card/c01.webp',
  'img/card/c02.webp',
  'img/card/c03.webp',
  'img/card/c04.webp',
  'img/card/c05.webp',
  'img/card/c06.webp',
  'img/card/c07.webp',
  'img/card/c08.webp',
  'img/card/c09.webp',
  'img/card/c10.webp',
  'img/card/c11.webp',
  'img/card/c12.webp',
  'img/card/c13.webp',
  'img/card/c14.webp',
  'img/card/c15.webp',
  'img/card/c16.webp',
  'img/card/c17.webp',
  'img/card/c18.webp',
  'img/card/c19.webp',
  'img/card/c20.webp',
  'img/card/c21.webp',
  'img/card/c22.webp',
  'img/card/c23.webp',
  'img/card/c24.webp',
  'img/card/c25.webp',
  'img/icon/i00.webp',
  'img/icon/i01.webp',
  'img/icon/i02.webp',
  'img/icon/i03.webp',
  'img/icon/i04.webp',
  'img/icon/i05.webp',
  'img/icon/i06.webp',
  'img/icon/i07.webp',
  'img/icon/i08.webp',
  'img/icon/i09.webp',
  'img/icon/i10.webp',
  'img/icon/i11.webp',
  'img/icon/i12.webp',
  'img/icon/i13.webp',
  'img/icon/i14.webp',
  'img/icon/i15.webp',
  'img/icon/i16.webp',
  'img/icon/i17.webp',
  'img/icon/i18.webp',
  'img/icon/i19.webp',
  'img/icon/i20.webp',
  'img/icon/i21.webp',
  'img/icon/i22.webp',
  'img/icon/i23.webp',
  'img/icon/i24.webp',
  'img/icon/i25.webp',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

// 只清自己的舊快取（同網域的 ERIKA 主遊戲有自己的 erika-* 快取）
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('tower-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
    );
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
      }))
    );
  }
});
