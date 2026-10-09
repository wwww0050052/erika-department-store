// ERIKA 百貨貴婦 — 3D Erika（three.js + three-vrm）
// 對外：window.Erika3D = { ready, attach(el), setOutfit(eq), react(kind), snapshot(kind) }
// 載入失敗時主程式會繼續用 2D 版人物，所以這裡的錯誤都只記錄、不拋出。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const MODEL_URL = 'assets/models/victoria.vrm';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------- 換裝對照表（2D 資料裡的單品 → 3D 怎麼呈現） ----------------
// 頭髮／衣服／鞋子用「漸層重新上色」：原貼圖轉灰階後，暗部→dark、亮部→light；orig 表示用原本的顏色
const HAIR = {
  hair_black: { orig: true },
  hair_wave: { dark: '#3a2016', light: '#c48a62' },
  hair_bun: { dark: '#0e0a10', light: '#5a4656' },
  hair_gold: { dark: '#8a5a1a', light: '#ffe6a6' },
  hair_pink: { dark: '#b23a6e', light: '#ffd0e4' },
  hair_lilac: { dark: '#5a3fa0', light: '#ead8ff' },
  hair_silver: { dark: '#7d8094', light: '#ffffff' },
};
const DRESS = {
  dress_white: { orig: true },
  dress_mint: { dark: '#3f8f78', light: '#e8fff5' },
  dress_tweed: { dark: '#a0476a', light: '#ffe8ef', pat: 'tweed' },
  dress_rose: { dark: '#6e0f2c', light: '#ff7aa0' },
  dress_lbd: { dark: '#08060a', light: '#4a3a48', pat: 'sheen' },
  dress_leopard: { dark: '#7a4a1c', light: '#f3cf94', pat: 'leopard' },
  dress_lavender: { dark: '#6b52b0', light: '#f4ecff' },
  dress_fur: { dark: '#b9aaa4', light: '#ffffff' },
  dress_champagne: { dark: '#8a6a2a', light: '#fff4d2', pat: 'sequin' },
  dress_polka: { dark: '#a3173e', light: '#ff6f92', pat: 'polka' },
  dress_starry: { dark: '#0e0c2c', light: '#4a4aa8', pat: 'stars' },
  dress_mermaid: { dark: '#c2407a', light: '#ffe0ee', pat: 'sequin' },
};
const SHOES = {
  shoes_nude: { orig: true },
  shoes_red: { dark: '#0c070a', light: '#4a2a36' },
  shoes_gold: { dark: '#8a6224', light: '#fff0b8', pat: 'sheen' },
  shoes_pink: { dark: '#c24a78', light: '#ffe4ee' },
  shoes_glass: { dark: '#6fa8d8', light: '#ffffff', glow: 0.25 },
};

// ---------------- 基本設定 ----------------
const S3 = { ready: false, failed: false };
let renderer, scene, camera, vrm, clock, host = null, raf = 0, ro = null;
let mats = { hair: [], dress: [], shoes: [] };
const origMap = new Map();          // material → { map, shade, color, shadeColor }
const recolorCache = new Map();     // key → texture
const thumbCache = new Map();       // 單品 id → dataURL
const acc = { head: null, neck: null, hand: null, pet: null };
let shadowPlane;
const t0 = performance.now();
const _v = new THREE.Vector3();
const anim = { happy: 0.18, hop: 0, tilt: 0, blinkAt: 2, blink: 0, wave: 0 };

function toonGradient() {
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const tx = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  tx.minFilter = tx.magFilter = THREE.NearestFilter; tx.needsUpdate = true;
  return tx;
}
let GRAD;
const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...o });
// 動漫描邊：背面放大一點畫深色
function outline(mesh, w = 0.0025, color = 0x4a2238) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normalize(normal) * ${w.toFixed(4)};`); };
  const o = new THREE.Mesh(mesh.geometry, m);
  o.raycast = () => {};
  mesh.add(o);
  return mesh;
}
const M = (geo, mat, ol = 0.0022) => outline(new THREE.Mesh(geo, mat), ol);

// ---------------- 貼圖重新上色 ----------------
function imgOf(tex) { return tex && tex.image; }
function makePattern(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 64, 64);
  if (kind === 'tweed') {
    for (let i = 0; i < 64; i += 4) { x.fillStyle = i % 8 ? 'rgba(255,255,255,.35)' : 'rgba(80,20,40,.28)'; x.fillRect(0, i, 64, 1.5); x.fillRect(i, 0, 1.5, 64); }
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '90,30,60'},.35)`; x.fillRect(Math.random() * 64, Math.random() * 64, 2, 1); }
  } else if (kind === 'leopard') {
    for (let i = 0; i < 9; i++) {
      const px = (i % 3) * 22 + (Math.floor(i / 3) % 2) * 11 + 6, py = Math.floor(i / 3) * 22 + 8;
      x.fillStyle = 'rgba(120,70,25,.55)'; x.beginPath(); x.ellipse(px, py, 6, 4.5, 0.4, 0, 7); x.fill();
      x.strokeStyle = 'rgba(40,20,10,.9)'; x.lineWidth = 2.4; x.beginPath(); x.ellipse(px, py, 7, 5.5, 0.4, 0.3, 2.6); x.stroke(); x.beginPath(); x.ellipse(px, py, 7, 5.5, 0.4, 3.4, 5.6); x.stroke();
    }
  } else if (kind === 'polka') {
    x.fillStyle = 'rgba(255,255,255,.95)';
    for (const [px, py] of [[8, 8], [40, 8], [24, 30], [56, 30], [8, 52], [40, 52]]) { x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); }
  } else if (kind === 'stars') {
    x.fillStyle = 'rgba(255,230,150,.95)';
    const star = (px, py, r) => { x.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * 0.35 : r; x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.fill(); };
    star(12, 14, 6); star(44, 40, 4); star(30, 56, 3); x.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 12; i++) x.fillRect(Math.random() * 64, Math.random() * 64, 1.4, 1.4);
  } else if (kind === 'sequin') {
    for (let yy = 0; yy < 64; yy += 6) for (let xx = (yy / 6 % 2) * 3; xx < 64; xx += 6) { x.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.55})`; x.beginPath(); x.arc(xx, yy, 2.2, 0, 7); x.fill(); }
  } else if (kind === 'sheen') {
    const g = x.createLinearGradient(0, 0, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  }
  return c;
}
function recolor(srcTex, spec, key) {
  if (!srcTex || !imgOf(srcTex)) return srcTex;
  const ck = key + '|' + srcTex.uuid;
  if (recolorCache.has(ck)) return recolorCache.get(ck);
  const img = imgOf(srcTex);
  const w = img.width, h = img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, w, h), p = d.data;
  const A = new THREE.Color(spec.dark), B = new THREE.Color(spec.light);
  A.convertLinearToSRGB(); B.convertLinearToSRGB();
  const a = [A.r * 255, A.g * 255, A.b * 255], b = [B.r * 255, B.g * 255, B.b * 255];
  for (let i = 0; i < p.length; i += 4) {
    let l = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
    l = Math.min(1, Math.max(0, (l - 0.18) / 0.8));
    l = l * l * (3 - 2 * l) * 0.85 + l * 0.15;
    p[i] = a[0] + (b[0] - a[0]) * l; p[i + 1] = a[1] + (b[1] - a[1]) * l; p[i + 2] = a[2] + (b[2] - a[2]) * l;
  }
  x.putImageData(d, 0, 0);
  if (spec.pat) {
    const pat = x.createPattern(makePattern(spec.pat), 'repeat');
    x.save(); x.globalCompositeOperation = 'source-atop'; x.fillStyle = pat; x.fillRect(0, 0, w, h); x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = srcTex.flipY; t.colorSpace = srcTex.colorSpace; t.wrapS = srcTex.wrapS; t.wrapT = srcTex.wrapT;
  t.anisotropy = 4; t.needsUpdate = true;
  recolorCache.set(ck, t);
  return t;
}
function applyRecolor(list, spec, key) {
  for (const m of list) {
    const o = origMap.get(m);
    if (!o) continue;
    if (!spec || spec.orig) {
      m.map = o.map; if ('shadeMultiplyTexture' in m) m.shadeMultiplyTexture = o.shade;
      if (o.emissive && m.emissive) m.emissive.copy(o.emissive);
    } else {
      m.map = recolor(o.map, spec, key);
      if ('shadeMultiplyTexture' in m && o.shade) m.shadeMultiplyTexture = recolor(o.shade, spec, key + 's');
      if (m.emissive) m.emissive.setScalar(spec.glow || 0);
    }
    m.needsUpdate = true;
  }
}

// ---------------- 3D 配件 ----------------
const COLORS = { gold: 0xe7c06a, goldDark: 0xa97b30, pearl: 0xfff7ee, plum: 0x2e1f27 };
function gemMat(hex) { return toon(hex, { emissive: new THREE.Color(hex).multiplyScalar(0.25), transparent: true, opacity: 0.95 }); }
function pearlArc(n, rx, rz, y, r, start = 0, end = Math.PI * 2, mat) {
  const g = new THREE.Group(), geo = new THREE.SphereGeometry(r, 14, 10);
  for (let i = 0; i < n; i++) { const t = start + (end - start) * (i / (n - (end - start >= 6.28 ? 0 : 1))); const s = M(geo, mat || toon(COLORS.pearl), 0.0012); s.position.set(Math.sin(t) * rx, y, Math.cos(t) * rz); g.add(s); }
  return g;
}
function buildHead(it) {
  const g = new THREE.Group();
  switch (it.kind) {
    case 'tiara': {
      const shape = new THREE.Shape();
      const pts = [[-0.075, 0], [-0.062, 0.03], [-0.04, 0.012], [-0.02, 0.045], [0, 0.07], [0.02, 0.045], [0.04, 0.012], [0.062, 0.03], [0.075, 0]];
      shape.moveTo(pts[0][0], pts[0][1]); for (const [px, py] of pts.slice(1)) shape.lineTo(px, py); shape.lineTo(0.075, -0.012); shape.quadraticCurveTo(0, -0.02, -0.075, -0.012);
      const crown = M(new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2 }), toon(COLORS.gold, { emissive: new THREE.Color(0x3a2a00) }), 0.0015);
      crown.position.set(0, 0, -0.004); g.add(crown);
      const gem = M(new THREE.OctahedronGeometry(0.012), gemMat(0xff8fbf), 0.001); gem.position.set(0, 0.035, 0.008); g.add(gem);
      for (const sx of [-1, 1]) { const s = M(new THREE.OctahedronGeometry(0.007), gemMat(0x8fc3ff), 0.001); s.position.set(sx * 0.04, 0.02, 0.008); g.add(s); }
      g.scale.setScalar(1.25); g.position.set(0, 0.205, 0.035); g.rotation.x = -0.3; break;
    }
    case 'sunglass': {
      const lens = toon(0x2a1622, { transparent: true, opacity: 0.92, emissive: new THREE.Color(0x200810) });
      for (const sx of [-1, 1]) {
        const l = M(new THREE.CylinderGeometry(0.026, 0.026, 0.006, 24), lens, 0.0014); l.rotation.x = Math.PI / 2; l.scale.set(1.15, 1, 0.85); l.position.set(sx * 0.034, 0, 0); g.add(l);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0028, 8, 28), toon(COLORS.gold)); rim.scale.set(1.15, 0.85, 1); rim.position.set(sx * 0.034, 0, 0.002); g.add(rim);
      }
      const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0022, 6, 12, Math.PI), toon(COLORS.gold)); bridge.position.set(0, 0.008, 0.002); g.add(bridge);
      g.scale.setScalar(1.15); g.position.set(0, 0.2, 0.07); g.rotation.x = -0.8; break;
    }
    case 'hat': {
      const col = new THREE.Color(it.f || '#f3e5d2'), band = new THREE.Color(it.a || '#2e1f27');
      const brim = M(new THREE.CylinderGeometry(0.2, 0.2, 0.006, 48), toon(col), 0.002); g.add(brim);
      const top = M(new THREE.CylinderGeometry(0.085, 0.1, 0.085, 36), toon(col), 0.002); top.position.y = 0.045; g.add(top);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.101, 0.102, 0.022, 36, 1, true), toon(band)); b.position.y = 0.013; g.add(b);
      const bow = M(new THREE.SphereGeometry(0.024, 12, 10), toon(band), 0.0015); bow.scale.set(1.6, 0.8, 0.6); bow.position.set(0.09, 0.02, 0.03); g.add(bow);
      g.scale.setScalar(0.92); g.position.set(0, 0.19, 0.0); g.rotation.set(-0.1, 0, 0.1); break;
    }
    case 'pearlband': {
      const geo = new THREE.SphereGeometry(0.0095, 14, 10), mat = toon(COLORS.pearl);
      for (let i = 0; i <= 16; i++) { const a = -1.45 + 2.9 * i / 16; const pz = M(geo, mat, 0.0012); pz.position.set(Math.sin(a) * 0.132, Math.cos(a) * 0.142, 0); g.add(pz); }
      g.position.set(0, 0.075, 0.08); g.rotation.x = -0.6; break;
    }
    case 'bow': {
      const col = toon(new THREE.Color(it.f || '#f37ca0'));
      for (const sx of [-1, 1]) { const l = M(new THREE.SphereGeometry(0.03, 16, 12), col, 0.0016); l.scale.set(1.5, 1, 0.55); l.position.set(sx * 0.04, 0, 0); l.rotation.z = sx * 0.35; g.add(l); }
      const k = M(new THREE.SphereGeometry(0.016, 12, 10), col, 0.0014); g.add(k);
      for (const sx of [-1, 1]) { const tail = M(new THREE.BoxGeometry(0.018, 0.06, 0.006), col, 0.0012); tail.position.set(sx * 0.016, -0.035, 0); tail.rotation.z = sx * 0.3; g.add(tail); }
      g.scale.setScalar(1.2); g.position.set(0.105, 0.19, -0.03); g.rotation.set(0, 0.7, -0.4); break;
    }
    case 'fascinator': {
      const col = toon(new THREE.Color(it.f || '#2e1f27'));
      const disc = M(new THREE.CylinderGeometry(0.05, 0.05, 0.008, 28), col, 0.0015); g.add(disc);
      const dome = M(new THREE.SphereGeometry(0.03, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), col, 0.0015); dome.position.y = 0.004; g.add(dome);
      const rose = M(new THREE.SphereGeometry(0.016, 12, 10), toon(new THREE.Color(it.a || '#d3365f')), 0.0012); rose.position.set(-0.03, 0.012, 0.025); g.add(rose);
      const fe = new THREE.Shape(); fe.moveTo(0, 0); fe.quadraticCurveTo(0.02, 0.05, 0.005, 0.11); fe.quadraticCurveTo(-0.012, 0.05, 0, 0);
      const feather = new THREE.Mesh(new THREE.ShapeGeometry(fe), toon(0xffffff, { side: THREE.DoubleSide })); feather.position.set(0.02, 0.005, -0.01); feather.rotation.z = -0.5; g.add(feather);
      g.scale.setScalar(1.15); g.position.set(0.08, 0.21, 0.03); g.rotation.set(-0.25, 0.3, -0.45); break;
    }
  }
  return g;
}
function buildNeck(it) {
  const g = new THREE.Group();
  const curve = t => new THREE.Vector3(0.092 * t, 0.12 * t * t - 0.045, 0.172 - 0.105 * t * t);   // t ∈ [-1, 1]，前方最低
  if (it.kind === 'pearl') {
    const geo = new THREE.SphereGeometry(0.0078, 14, 10), mat = toon(COLORS.pearl);
    for (let i = 0; i <= 22; i++) { const p = M(geo, mat, 0.0011); p.position.copy(curve(-1 + 2 * i / 22)); g.add(p); }
  } else {
    const pts = []; for (let i = 0; i <= 30; i++) pts.push(curve(-1 + 2 * i / 30));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0016, 6), toon(new THREE.Color(it.ch || '#e4c47c'))));
    const big = it.big ? 1.7 : 1.15;
    const gem = M(new THREE.OctahedronGeometry(0.012 * big), gemMat(new THREE.Color(it.g || '#eaf5ff')), 0.0012);
    gem.scale.set(1, 1.35, 0.7); gem.position.set(0, -0.07 * (it.big ? 1.12 : 1), 0.176); g.add(gem);
    const cap = M(new THREE.SphereGeometry(0.004, 8, 6), toon(COLORS.gold), 0.0008); cap.position.set(0, -0.052, 0.176); g.add(cap);
    if (it.big) { const geo = new THREE.SphereGeometry(0.0038, 8, 6), mat = toon(0xffffff); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const s2 = new THREE.Mesh(geo, mat); s2.position.set(Math.cos(a) * 0.026, -0.078 + Math.sin(a) * 0.03, 0.174); g.add(s2); } }
  }
  return g;
}
function buildBag(it) {
  const g = new THREE.Group();
  const col = new THREE.Color(it.f || '#efe2cf'), accent = new THREE.Color(it.a || '#e4c47c');
  const leather = toon(col), trim = toon(col.clone().multiplyScalar(0.82)), gold = toon(COLORS.gold, { emissive: new THREE.Color(0x2a1a00) });
  const rbox = (w, h, d, r, mat) => {   // 圓角方塊（皮件的柔和邊）
    const sh = new THREE.Shape(), x = -w / 2, y = -h / 2;
    sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 3, curveSegments: 6 });
    geo.translate(0, 0, -d / 2);
    return M(geo, mat, 0.0018);
  };
  const strap = (pts, r = 0.0035, mat = gold) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))), 30, r, 6), mat);
  switch (it.shape) {
    case 'tote': {   // 大托特：兩條長提把
      const b = rbox(0.17, 0.15, 0.055, 0.012, leather); b.position.y = -0.13; g.add(b);
      g.add(strap([[-0.05, -0.06, 0.02], [-0.04, 0.0, 0.02], [0, 0.025, 0.02], [0.04, 0.0, 0.02], [0.05, -0.06, 0.02]], 0.004, toon(accent)));
      g.add(strap([[-0.05, -0.06, -0.02], [-0.04, 0.0, -0.02], [0, 0.025, -0.02], [0.04, 0.0, -0.02], [0.05, -0.06, -0.02]], 0.004, toon(accent)));
      const logo = M(new THREE.TorusGeometry(0.018, 0.003, 6, 20), gold, 0.001); logo.position.set(0, -0.12, 0.033); g.add(logo);
      break;
    }
    case 'quilt': {  // 菱格紋鍊條包：金鍊往上掛到肩膀
      const b = rbox(0.15, 0.1, 0.05, 0.014, leather); b.position.y = -0.1; g.add(b);
      const q = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), new THREE.MeshBasicMaterial({ map: quiltTex(), transparent: true })); q.position.set(0, -0.1, 0.03); g.add(q);
      const flap = rbox(0.152, 0.05, 0.052, 0.012, trim); flap.position.set(0, -0.075, 0.003); g.add(flap);
      const clasp = M(new THREE.TorusGeometry(0.011, 0.0035, 8, 20), gold, 0.001); clasp.position.set(0, -0.098, 0.031); g.add(clasp);
      g.add(strap([[-0.07, -0.06, 0], [-0.05, 0.05, 0.01], [0.02, 0.22, 0.02], [0.07, -0.06, 0]], 0.0028));
      break;
    }
    case 'mini': {   // 迷你珍珠包：貝殼形＋珍珠提把
      const sh = new THREE.Shape(); sh.moveTo(-0.06, 0); sh.quadraticCurveTo(-0.065, 0.075, 0, 0.08); sh.quadraticCurveTo(0.065, 0.075, 0.06, 0); sh.lineTo(-0.06, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.008, bevelSegments: 4, curveSegments: 12 }); geo.translate(0, -0.12, -0.02);
      g.add(M(geo, leather, 0.0018));
      const pg = new THREE.SphereGeometry(0.0065, 12, 8), pm = toon(COLORS.pearl);
      for (let i = 0; i <= 14; i++) { const a = Math.PI * i / 14; const p = M(pg, pm, 0.001); p.position.set(Math.cos(a) * 0.05, -0.045 + Math.sin(a) * 0.05, 0); g.add(p); }
      const clasp = M(new THREE.SphereGeometry(0.008, 10, 8), gold, 0.001); clasp.position.set(0, -0.05, 0.028); g.add(clasp);
      break;
    }
    case 'box': {    // 小方包：硬殼＋短提把＋色帶
      const b = rbox(0.1, 0.085, 0.06, 0.016, leather); b.position.y = -0.095; g.add(b);
      g.add(strap([[-0.025, -0.05, 0], [-0.02, -0.015, 0], [0.02, -0.015, 0], [0.025, -0.05, 0]], 0.0045, trim));
      const band = rbox(0.102, 0.012, 0.062, 0.004, toon(accent)); band.position.y = -0.085; g.add(band);
      break;
    }
    case 'clutch': { // 水晶晚宴包：橫拿、滿滿水鑽
      const b = rbox(0.16, 0.07, 0.03, 0.02, toon(col, { emissive: new THREE.Color(0x223355) })); g.add(b);
      const q = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.07), new THREE.MeshBasicMaterial({ map: sparkleTex(), transparent: true })); q.position.z = 0.02; g.add(q);
      const gem = M(new THREE.OctahedronGeometry(0.012), gemMat(0xff8fbf), 0.001); gem.position.set(0, 0.03, 0.022); g.add(gem);
      g.position.set(0.02, -0.04, 0.03); g.rotation.set(0, 0, 0.35);
      return g;
    }
    default: {       // 手提包（鱷魚皮、鴕鳥皮）：梯形、翻蓋、金鎖
      const sh = new THREE.Shape(); sh.moveTo(-0.085, 0); sh.lineTo(0.085, 0); sh.lineTo(0.07, 0.11); sh.lineTo(-0.07, 0.11); sh.lineTo(-0.085, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 3 }); geo.translate(0, -0.17, -0.03);
      g.add(M(geo, leather, 0.0018));
      if (it.pat) { const q = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshBasicMaterial({ map: grainTex(it.pat), transparent: true })); q.position.set(0, -0.115, 0.036); g.add(q); }
      const flap = new THREE.Shape(); flap.moveTo(-0.072, 0); flap.lineTo(0.072, 0); flap.lineTo(0.066, -0.045); flap.quadraticCurveTo(0, -0.055, -0.066, -0.045); flap.lineTo(-0.072, 0);
      const fl = M(new THREE.ExtrudeGeometry(flap, { depth: 0.004, bevelEnabled: false }), trim, 0.0012); fl.position.set(0, -0.058, 0.035); g.add(fl);
      const lock = rbox(0.018, 0.022, 0.008, 0.003, gold); lock.position.set(0, -0.1, 0.041); g.add(lock);
      g.add(strap([[-0.035, -0.06, 0], [-0.03, -0.01, 0], [0.03, -0.01, 0], [0.035, -0.06, 0]], 0.005, trim));
    }
  }
  return g;
}
let _spark, _grain = {};
function sparkleTex() {
  if (_spark) return _spark;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
  for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`; const r = Math.random() * 1.8 + 0.4; x.beginPath(); x.arc(Math.random() * 128, Math.random() * 64, r, 0, 7); x.fill(); }
  _spark = new THREE.CanvasTexture(c); return _spark;
}
function grainTex(kind) {
  if (_grain[kind]) return _grain[kind];
  const c = document.createElement('canvas'); c.width = 128; c.height = 80; const x = c.getContext('2d');
  if (kind === 'croc') { x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 1.2; for (let yy = 0; yy < 80; yy += 10) for (let xx = (yy / 10 % 2) * 7; xx < 128; xx += 14) x.strokeRect(xx, yy, 12, 8); }
  else { x.fillStyle = 'rgba(120,20,60,.22)'; for (let i = 0; i < 160; i++) { x.beginPath(); x.arc(Math.random() * 128, Math.random() * 80, 1.6, 0, 7); x.fill(); } }
  _grain[kind] = new THREE.CanvasTexture(c); return _grain[kind];
}
let _quilt;
function quiltTex() {
  if (_quilt) return _quilt;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.strokeStyle = 'rgba(255,230,170,.55)'; x.lineWidth = 1.5;
  for (let i = -64; i < 128; i += 12) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); x.beginPath(); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke(); }
  _quilt = new THREE.CanvasTexture(c); return _quilt;
}
function buildPet(it) {
  const g = new THREE.Group();
  const col = new THREE.Color(it.f || '#fffaf7'), dark = toon(0x2a1420);
  const ball = (r, x, y, z, m = toon(col)) => { const s = M(new THREE.SphereGeometry(r, 18, 14), m, 0.004); s.position.set(x, y, z); g.add(s); return s; };
  if (it.kind === 'poodle') {
    ball(0.075, 0, 0.17, 0); ball(0.05, 0.07, 0.18, 0); ball(0.05, -0.07, 0.18, 0);
    for (const [x, z] of [[-0.06, 0.04], [0.06, 0.04], [-0.06, -0.04], [0.06, -0.04]]) { ball(0.025, x, 0.035, z); const leg = M(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), toon(col), 0.003); leg.position.set(x, 0.09, z); g.add(leg); }
    ball(0.034, -0.13, 0.25, 0);
    const head = ball(0.06, 0.1, 0.29, 0.02); ball(0.045, 0.1, 0.355, 0.0); ball(0.035, 0.05, 0.27, 0.04); ball(0.035, 0.15, 0.27, 0.04);
    ball(0.008, 0.08, 0.3, 0.075, dark); ball(0.008, 0.12, 0.3, 0.075, dark); ball(0.009, 0.1, 0.277, 0.08, dark);
    const bow = M(new THREE.SphereGeometry(0.018, 10, 8), toon(0xf37ca0), 0.002); bow.scale.set(1.6, 0.8, 0.6); bow.position.set(0.11, 0.395, 0.02); g.add(bow);
    head.userData.head = true;
  } else if (it.kind === 'cat') {
    const body = ball(0.09, 0, 0.11, 0); body.scale.set(1.3, 0.85, 0.9);
    ball(0.075, 0.1, 0.2, 0.03);
    for (const sx of [-1, 1]) { const ear = M(new THREE.ConeGeometry(0.025, 0.045, 10), toon(col), 0.003); ear.position.set(0.1 + sx * 0.045, 0.27, 0.02); ear.rotation.z = -sx * 0.3; g.add(ear); }
    ball(0.009, 0.075, 0.21, 0.095, toon(0x3b9d7a)); ball(0.009, 0.125, 0.21, 0.095, toon(0x3b9d7a)); ball(0.006, 0.1, 0.19, 0.103, toon(0xf08aa8));
    const tail = M(new THREE.TorusGeometry(0.07, 0.022, 10, 20, Math.PI * 1.2), toon(col), 0.003); tail.position.set(-0.12, 0.15, -0.02); tail.rotation.z = 1.2; g.add(tail);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 24), toon(0xd3365f)); collar.position.set(0.1, 0.145, 0.03); collar.rotation.x = Math.PI / 2 + 0.3; g.add(collar);
  } else {
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; ball(0.045, Math.cos(a) * 0.05, 0.12 + Math.sin(a) * 0.04, Math.sin(a) * 0.03); }
    ball(0.08, 0, 0.12, 0); ball(0.065, 0.06, 0.22, 0.03);
    for (const sx of [-1, 1]) { const ear = M(new THREE.ConeGeometry(0.018, 0.035, 8), toon(col), 0.003); ear.position.set(0.06 + sx * 0.035, 0.29, 0.03); g.add(ear); }
    ball(0.008, 0.04, 0.23, 0.09, dark); ball(0.008, 0.08, 0.23, 0.09, dark); ball(0.009, 0.06, 0.21, 0.095, dark);
    ball(0.05, -0.1, 0.19, -0.02);
  }
  g.position.set(-0.36, 0, 0.12);
  g.rotation.y = 0.5;
  g.userData.pet = true;
  return g;
}

// ---------------- 姿勢與動畫 ----------------
const hb = n => vrm.humanoid.getNormalizedBoneNode(n);
function pose(t) {
  const s = Math.sin(t * 1.5), c = Math.cos(t * 0.75);
  const sway = REDUCED ? 0 : 1;
  hb('hips').rotation.set(0, 0.18 + 0.03 * c * sway, 0.012 * s * sway);
  const hips = hb('hips');
  if (hips.userData.restY == null) hips.userData.restY = hips.position.y;
  hips.position.y = hips.userData.restY + anim.hop * 0.04;
  hb('spine').rotation.set(0.015 * s * sway, 0, -0.01 * s * sway);
  hb('chest') && hb('chest').rotation.set(0.012 * Math.sin(t * 1.9) * sway, 0, 0);
  hb('neck').rotation.set(0, 0, 0.03);
  hb('head').rotation.set(0.05 + 0.02 * Math.sin(t * 0.9) * sway, -0.08 + 0.06 * Math.sin(t * 0.43) * sway, 0.07 + anim.tilt);
  hb('leftUpperArm').rotation.set(0, 0, 1.18 + 0.03 * s * sway); hb('rightUpperArm').rotation.set(0, 0, -1.22 - 0.03 * s * sway);
  hb('leftLowerArm').rotation.set(0, -0.25, 0.1); hb('rightLowerArm').rotation.set(0, 0.3 + anim.wave * 0.9, -0.12 - anim.wave * 1.4);
  hb('rightUpperArm').rotation.z += anim.wave * 0.9;
  hb('leftHand').rotation.set(0, 0, 0.15); hb('rightHand').rotation.set(0, 0, -0.15 + anim.wave * 0.3 * Math.sin(t * 14));
  hb('leftUpperLeg').rotation.set(0, 0, 0.03); hb('rightUpperLeg').rotation.set(0, 0.12, -0.05); hb('rightLowerLeg').rotation.set(0.12, 0, 0);
}
function frame() {
  raf = 0;
  if (!host || document.hidden) return;
  const dt = Math.min(0.05, clock.getDelta()), t = (performance.now() - t0) / 1000;
  anim.hop = Math.max(0, anim.hop - dt * 6);
  anim.tilt *= Math.pow(0.02, dt);
  anim.wave = Math.max(0, anim.wave - dt * 0.8);
  anim.happy += (0.18 - anim.happy) * Math.min(1, dt * 2.5);
  anim.blinkAt -= dt;
  if (anim.blinkAt <= 0) { anim.blink = 1; anim.blinkAt = 2 + Math.random() * 3.5; }
  anim.blink = Math.max(0, anim.blink - dt * 7);
  pose(t);
  const em = vrm.expressionManager;
  if (em) { em.setValue('happy', Math.min(1, anim.happy)); em.setValue('blink', anim.happy > 0.6 ? 0 : Math.sin(anim.blink * Math.PI)); }
  vrm.update(dt);
  if (acc.hand) { acc.handBone.getWorldPosition(_v); acc.hand.position.set(_v.x - 0.005, _v.y - 0.01, _v.z + 0.035); acc.hand.rotation.set(0, 0.2, 0.06 * Math.sin(t * 1.5)); }
  if (acc.pet) { acc.pet.position.y = Math.max(0, Math.sin(t * 3.2)) * 0.03; acc.pet.rotation.y = 0.5 + Math.sin(t * 0.8) * 0.15; }
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
}
function start() { if (!raf && host && S3.ready) { clock.getDelta(); raf = requestAnimationFrame(frame); } }
function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

// 依容器大小擺鏡頭：全身入鏡，腳底在下方留一點空間
function frameCamera() {
  if (!host) return;
  const w = host.clientWidth || 1, h = host.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const kind = host.dataset.frame || 'full';
  if (kind === 'bust') {
    camera.fov = 22;
    const head = hb('head').getWorldPosition(new THREE.Vector3());
    camera.position.set(0.02, head.y + 0.06, 1.25); camera.lookAt(0, head.y + 0.05, 0);
  } else if (['torso', 'feet', 'hand', 'dress', 'chest', 'pet'].includes(kind)) {
    // 單品縮圖用的特寫：上半身／腳／手
    const target = { torso: [0, 1.2, 0, 1.75, 26], feet: [0, 0.1, 0.05, 1.05, 24], hand: [-0.2, 0.86, 0.1, 1.0, 28], dress: [0, 1.0, 0, 2.55, 28], chest: [0, 1.3, 0.05, 0.95, 24], pet: [-0.36, 0.2, 0.12, 1.15, 26] }[kind];
    camera.fov = target[4];
    camera.position.set(target[0] * 0.4, target[1] + 0.05, target[3]); camera.lookAt(target[0], target[1], target[2]);
  } else if (kind === 'stage') {
    // 首頁舞台：人物約佔畫面高度 72%，腳底離底部 4%
    camera.fov = 22;
    const span = 1.68 / 0.72, bottom = -0.04 * span, mid = bottom + span / 2;
    camera.position.set(0, mid, (span / 2) / Math.tan(THREE.MathUtils.degToRad(11)));
    camera.lookAt(0, mid, 0);
  } else {
    camera.fov = 22;
    const span = 1.9, bottom = -0.06, mid = bottom + span / 2;
    camera.position.set(0, mid, (span / 2) / Math.tan(THREE.MathUtils.degToRad(11)));
    camera.lookAt(0, mid, 0);
  }
  camera.updateProjectionMatrix();
}

// ---------------- 公開介面 ----------------
async function init() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'erika3d';
    GRAD = toonGradient();
    scene = new THREE.Scene();
    const key = new THREE.DirectionalLight(0xfff4ee, 2.3); key.position.set(-0.8, 1.8, 2.2); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffd6e6, 1.1); rim.position.set(1.2, 1.4, -1.5); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    camera = new THREE.PerspectiveCamera(22, 0.6, 0.05, 30);
    clock = new THREE.Clock();
    // 腳下的柔和陰影
    const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sx = sc.getContext('2d');
    const gr = sx.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(60,15,40,.45)'); gr.addColorStop(1, 'rgba(60,15,40,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 128, 128);
    shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.set(-0.05, 0.002, 0.05); scene.add(shadowPlane);

    const loader = new GLTFLoader();
    loader.register(p => new VRMLoaderPlugin(p));
    const gltf = await loader.loadAsync(MODEL_URL, ev => { if (ev.total) window.dispatchEvent(new CustomEvent('erika3d-progress', { detail: ev.loaded / ev.total })); });
    vrm = gltf.userData.vrm;
    VRMUtils.removeUnnecessaryVertices?.(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    scene.add(vrm.scene);
    // 找出可換色的材質
    vrm.scene.traverse(o => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const n = m.name || '';
        const bucket = /HAIR/.test(n) ? 'hair' : /Onepice|Tops|Bottoms|CLOTH/.test(n) && !/Shoes/.test(n) ? 'dress' : /Shoes/.test(n) ? 'shoes' : null;
        if (!bucket || mats[bucket].includes(m)) continue;
        mats[bucket].push(m);
        origMap.set(m, { map: m.map, shade: m.shadeMultiplyTexture, emissive: m.emissive ? m.emissive.clone() : null });
      }
    });
    // 骨架上的配件掛點
    const raw = n => vrm.humanoid.getRawBoneNode(n);
    acc.headBone = raw('head'); acc.neckBone = raw('upperChest') || raw('chest'); acc.handBone = raw('rightHand');
    pose(0); vrm.update(1 / 60); vrm.springBoneManager?.reset();
    for (let i = 0; i < 90; i++) vrm.update(1 / 60);
    S3.ready = true;
    if (Erika3D._pending) Erika3D.setOutfit(Erika3D._pending);
    window.dispatchEvent(new Event('erika3d-ready'));
    if (host) { host.appendChild(renderer.domElement); frameCamera(); start(); }
  } catch (e) {
    console.warn('3D 人物載入失敗，改用 2D 版', e);
    S3.failed = true;
    window.dispatchEvent(new Event('erika3d-failed'));
  }
}

function setAcc(slot, bone, obj) {
  if (acc[slot]) { acc[slot].parent?.remove(acc[slot]); acc[slot] = null; }
  if (!obj) return;
  acc[slot] = obj;
  (bone || scene).add(obj);
}
// 3D 配件掛在 VRM0 的骨頭上：模型原本面向 -Z，rotateVRM0 只轉了根節點，所以骨頭本地座標的「前方」是 -Z
function faceFront(obj) { const w = new THREE.Group(); w.rotation.y = Math.PI; w.add(obj); return w; }

const Erika3D = {
  get ready() { return S3.ready; },
  get failed() { return S3.failed; },
  attach(el) {
    if (host === el) { if (el) frameCamera(); return; }
    stop();
    if (ro) { ro.disconnect(); ro = null; }
    host = el || null;
    if (!host || !renderer) return;
    host.appendChild(renderer.domElement);
    ro = new ResizeObserver(() => { frameCamera(); if (!raf && S3.ready) renderer.render(scene, camera); });
    ro.observe(host);
    if (S3.ready) { frameCamera(); start(); }
  },
  setOutfit(eq, temp) {
    if (!S3.ready) { Erika3D._pending = eq; return; }
    if (!temp) Erika3D._current = eq;
    const hair = eq.hair && HAIR[eq.hair.id], dress = eq.dress && DRESS[eq.dress.id], shoes = eq.shoes && SHOES[eq.shoes.id];
    applyRecolor(mats.hair, hair, 'h:' + (eq.hair?.id || ''));
    applyRecolor(mats.dress, dress, 'd:' + (eq.dress?.id || ''));
    applyRecolor(mats.shoes, shoes, 's:' + (eq.shoes?.id || ''));
    setAcc('head', acc.headBone, eq.head ? faceFront(buildHead(eq.head)) : null);
    setAcc('neck', acc.neckBone, eq.jewel ? faceFront(buildNeck(eq.jewel)) : null);
    setAcc('hand', null, eq.bag ? buildBag(eq.bag) : null);
    setAcc('pet', null, eq.pet ? buildPet(eq.pet) : null);
    if (!raf && host) renderer.render(scene, camera);
  },
  react(kind = 'tap') {
    if (!S3.ready) return;
    if (kind === 'tap') { anim.happy = Math.min(1, anim.happy + 0.35); anim.hop = Math.min(1, anim.hop + 0.5); anim.tilt = (Math.random() - 0.5) * 0.12; }
    else if (kind === 'wave' || kind === 'buy') { anim.happy = 1; anim.wave = 1.2; anim.hop = 1; }
  },
  _thumbCached: id => thumbCache.get(id) || null,
  // 單品縮圖：以素顏造型穿上這件單品後特寫一張（有快取）
  thumb(item, size = 220) {
    if (!S3.ready || !item) return null;
    if (thumbCache.has(item.id)) return thumbCache.get(item.id);
    const I = window.ERIKA_DATA && Object.fromEntries(window.ERIKA_DATA.ITEMS.map(i => [i.id, i]));
    if (!I) return null;
    const base = { hair: I.hair_black, dress: I.dress_white, shoes: I.shoes_nude, bag: null, jewel: null, head: null, pet: null };
    const keep = Erika3D._current;
    Erika3D.setOutfit({ ...base, [item.cat]: item }, true);
    if (acc.hand) { acc.handBone.getWorldPosition(_v); acc.hand.position.set(_v.x - 0.005, _v.y - 0.01, _v.z + 0.035); acc.hand.rotation.set(0, 0.2, 0); }
    const frame = { hair: 'bust', head: 'bust', dress: 'dress', shoes: 'feet', jewel: 'chest', bag: 'hand', pet: 'pet' }[item.cat] || 'bust';
    const url = Erika3D.snapshot(frame, size, size);
    if (keep) Erika3D.setOutfit(keep, true);
    thumbCache.set(item.id, url);
    return url;
  },
  // 截圖（給頭像、晉升對話框用）：kind = 'bust' | 'full'
  snapshot(kind = 'bust', w = 256, h = 256) {
    if (!S3.ready) return null;
    const prev = host, keepSize = renderer.getSize(new THREE.Vector2());
    const fake = { clientWidth: w, clientHeight: h, dataset: { frame: kind } };
    host = fake; frameCamera();
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    host = prev;
    renderer.setSize(keepSize.x, keepSize.y, false);
    if (prev) { frameCamera(); renderer.render(scene, camera); }
    return url;
  },
};
window.Erika3D = Erika3D;
if (/[?&]debug/.test(location.search)) Erika3D._dbg = { get scene() { return scene; }, get vrm() { return vrm; }, acc, THREE };
document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
init();
