/* عالم المزرعة الكبير - محرك Canvas إيزومتري (المرحلة الأولى) */
(() => {
'use strict';
if (window.WorldGame) return;
const TW = 128, TH = 64, HW = 64, HH = 32;
const hash = (x, y, s = 0) => { let n = (x * 374761393 + y * 668265263 + s * 1274126177) >>> 0; n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0; n ^= n >>> 16; return (n >>> 0) / 4294967295; };
const wnoise = (x, y, s) => { const x0 = Math.floor(x), y0 = Math.floor(y); let fx = x - x0, fy = y - y0; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s); return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy; };
const wfbm = (x, y, s) => wnoise(x, y, s) * 0.6 + wnoise(x * 2.1, y * 2.1, s + 7) * 0.28 + wnoise(x * 4.3, y * 4.3, s + 13) * 0.12;
function terrRaw(x, y) {   // نفس معادلة السيرفر: 0 عشب 1 ماء 2 شجرة 3 صخرة
  const dc = Math.hypot(x - 50, y - 50), SEED = 2026;
  const rv = wnoise(x / 46, y / 46, SEED + 31) * 0.82 + wnoise(x / 15, y / 15, SEED + 37) * 0.18;
  if ((Math.abs(rv - 0.5) < 0.018 || wnoise(x / 19, y / 19, SEED + 11) > 0.84) && dc > 11) return 1;
  const tv = wfbm(x / 7, y / 7, SEED + 101);
  if (tv > 0.60 && hash(x, y, 5) < 0.72 && dc > 8.5) return 2;
  if (hash(x, y, 9) < 0.014 && dc > 3) return 3;
  if (dc <= 8.5 && hash(x, y, 11) < 0.035 && dc > 5.5) return 2;
  return 0;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let H = null;            // helpers من التطبيق: api, toast, ask, back, bear, coinSvg
let W = null;            // حالة العالم
let root, cv, cx2, hud = {}, dpr = 1, vw = 0, vh = 0;
let cam = { x: 0, y: 0, z: 0.8 };
let dirty = true, raf = 0, lastDraw = 0, open = false;
const atlas = { img: null, meta: null, S: 1.5, ok: false };
const cache = {};        // صور مرسومة بالكود
let bearImg = null, bearHat = null;
let off = 0;             // فرق وقت السيرفر
const nowS = () => (Date.now() + off) / 1000;
const corner = (X, Y) => [(X - Y) * HW, (X + Y) * HH];
const ctr = (x, y) => [(x - y) * HW, (x + y) * HH + HH];

/* ═══ الأصوات (WebAudio، بدون ملفات) ═══ */
const Snd = {
  c: null, on: (() => { try { return localStorage.getItem('wsnd') !== '0'; } catch (e) { return true; } })(), bird: 0,
  init() { if (this.c) { if (this.c.state === 'suspended') this.c.resume(); return; } try { this.c = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} },
  tone(f, d, type = 'sine', v = 0.12, at = 0, to = 0) {
    if (!this.on || !this.c) return; const c = this.c, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.05);
  },
  noise(d, v = 0.08, fq = 1800, at = 0) {
    if (!this.on || !this.c) return; const c = this.c, n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + at; s.buffer = b; f.type = 'bandpass'; f.frequency.value = fq; g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t);
  },
  play(n) {
    if (!this.on) return; this.init(); if (!this.c) return;
    switch (n) {
      case 'tap': this.tone(520, 0.05, 'triangle', 0.05); break;
      case 'step': this.tone(150 + Math.random() * 40, 0.04, 'triangle', 0.03); break;
      case 'place': this.tone(180, 0.12, 'sine', 0.2, 0, 90); this.noise(0.08, 0.1, 700); this.tone(660, 0.18, 'triangle', 0.08, 0.1); this.tone(880, 0.2, 'triangle', 0.07, 0.17); break;
      case 'plant': this.noise(0.18, 0.1, 1200); this.tone(300, 0.1, 'sine', 0.1, 0.02, 200); break;
      case 'harvest': this.noise(0.1, 0.09, 2500); [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.09, 0.05 + i * 0.07)); break;
      case 'coin': this.tone(1318, 0.1, 'square', 0.04); this.tone(1760, 0.22, 'square', 0.04, 0.08); break;
      case 'sell': this.tone(988, 0.08, 'square', 0.04); this.tone(1319, 0.08, 'square', 0.04, 0.07); this.tone(1568, 0.2, 'square', 0.04, 0.14); break;
      case 'error': this.tone(160, 0.18, 'sawtooth', 0.08, 0, 110); this.tone(130, 0.2, 'sawtooth', 0.07, 0.12, 90); break;
      case 'unlock': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.1, i * 0.09)); break;
      case 'ready': this.tone(1046, 0.25, 'sine', 0.08); this.tone(1568, 0.3, 'sine', 0.06, 0.12); break;
      case 'open': this.tone(440, 0.06, 'triangle', 0.05); this.tone(660, 0.07, 'triangle', 0.05, 0.05); break;
      case 'bird': { const b = 2400 + Math.random() * 900; this.tone(b, 0.07, 'sine', 0.025, 0, b * 1.25); this.tone(b * 1.2, 0.08, 'sine', 0.022, 0.09, b * 0.95); if (Math.random() < .6) this.tone(b * 1.1, 0.07, 'sine', 0.02, 0.2, b * 1.3); break; }
    }
  },
  ambient() { clearInterval(this.bird); this.bird = setInterval(() => { if (open && Math.random() < 0.7) this.play('bird'); }, 7000); },
  set(v) { this.on = v; try { localStorage.setItem('wsnd', v ? '1' : '0'); } catch (e) {} }
};

/* ═══ رسم العناصر بالكود (أرض، أشجار، محاصيل) ═══ */
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function diamond(g, x, y, w = TW, h = TH) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w / 2, y + h / 2); g.lineTo(x, y + h); g.lineTo(x - w / 2, y + h / 2); g.closePath(); }
function makeGrass(v, locked) {
  const [c, g] = mk(TW + 4, TH + 4); g.translate(TW / 2 + 2, 2);
  const base = ['#84cf58', '#7fca54', '#88d25c', '#7bc650'][v % 4];
  diamond(g, 0, 0, TW + 1.5, TH + 1.5); g.fillStyle = base; g.fill();
  g.save(); diamond(g, 0, 0, TW + 1, TH + 1); g.clip();
  for (let i = 0; i < 5; i++) { const r = hash(v, i, 3), r2 = hash(v, i, 4), px = (r - .5) * TW * .7, py = 8 + r2 * (TH - 16); g.strokeStyle = i % 2 ? 'rgba(70,150,50,.32)' : 'rgba(200,245,140,.4)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px, py); g.lineTo(px - 1.5, py - 5); g.moveTo(px + 2, py); g.lineTo(px + 3.5, py - 5.5); g.stroke(); }
  if (v % 4 === 1) { g.fillStyle = '#fff'; g.beginPath(); g.arc(-22, 36, 2, 0, 7); g.fill(); g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(-22, 36, .9, 0, 7); g.fill(); }
  if (v % 4 === 3) { g.fillStyle = '#ff9fc0'; g.beginPath(); g.arc(26, 26, 2, 0, 7); g.fill(); }
  g.restore();
  if (locked) { diamond(g, 0, 0, TW + 1.5, TH + 1.5); g.fillStyle = 'rgba(12,28,30,.5)'; g.fill(); }
  return c;
}
function makeWater(f) {
  const [c, g] = mk(TW + 4, TH + 4); g.translate(TW / 2 + 2, 2);
  const gr = g.createLinearGradient(0, 0, 0, TH); gr.addColorStop(0, '#53b7ea'); gr.addColorStop(1, '#3a96d4');
  diamond(g, 0, 0, TW + 1, TH + 1); g.fillStyle = gr; g.fill(); g.save(); diamond(g, 0, 0, TW + 1, TH + 1); g.clip();
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const y = 14 + i * 16 + Math.sin(f + i) * 3, x = Math.cos(f * .8 + i * 2) * 22; g.beginPath(); g.moveTo(x - 14, y); g.quadraticCurveTo(x, y - 4, x + 14, y); g.stroke(); }
  g.restore(); return c;
}
function leafSpeck(g, cx, cy, rx, ry, n, seed, cols) { for (let i = 0; i < n; i++) { const a = hash(seed, i, 1) * 6.28, r = Math.sqrt(hash(seed, i, 2)); g.fillStyle = cols[i % cols.length]; g.beginPath(); g.ellipse(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, 4.2, 2.6, a, 0, 7); g.fill(); } }
function makeTree(v) {
  const [c, g] = mk(150, 190); const bx = 75, by = 172;
  g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(bx, by, 38, 12, 0, 0, 7); g.fill();
  if (v % 4 === 3) { // صنوبر
    g.fillStyle = '#7a4f2d'; g.fillRect(bx - 6, by - 26, 12, 26);
    [[by - 14, 46, 54, '#2a7443', '#3a9254'], [by - 44, 38, 48, '#2e7f48', '#41a05c'], [by - 74, 29, 44, '#338a4e', '#4fb06a']].forEach(([y, w, h, d, l]) => { g.fillStyle = d; g.beginPath(); g.moveTo(bx, y - h); g.lineTo(bx + w, y); g.lineTo(bx - w, y); g.closePath(); g.fill(); g.fillStyle = l; g.beginPath(); g.moveTo(bx, y - h); g.lineTo(bx - w, y); g.lineTo(bx - w * .15, y); g.closePath(); g.fill(); });
  } else {
    g.fillStyle = '#7a4f2d'; g.beginPath(); g.moveTo(bx - 8, by); g.quadraticCurveTo(bx - 4, by - 40, bx - 6, by - 66); g.lineTo(bx + 6, by - 66); g.quadraticCurveTo(bx + 4, by - 40, bx + 8, by); g.fill();
    g.fillStyle = '#5f3b20'; g.beginPath(); g.moveTo(bx + 2, by); g.quadraticCurveTo(bx + 2, by - 40, bx + 1, by - 66); g.lineTo(bx + 6, by - 66); g.quadraticCurveTo(bx + 4, by - 40, bx + 8, by); g.fill();
    const P = [['#2b8644', '#3ea352', '#62c874'], ['#34933f', '#4fb44d', '#7fd668'], ['#2a8460', '#3aa175', '#66cd99']][v % 3];
    const blobs = [[-34, -62, 26], [34, -62, 26], [0, -58, 32], [-24, -92, 28], [26, -92, 27], [0, -112, 28], [-4, -84, 34]];
    blobs.forEach(([dx, dy, r], i) => { g.fillStyle = i < 3 ? P[0] : i < 6 ? P[1] : P[0]; g.beginPath(); g.arc(bx + dx, by + dy, r, 0, 7); g.fill(); });
    blobs.slice(3, 6).forEach(([dx, dy, r]) => { g.fillStyle = P[1]; g.beginPath(); g.arc(bx + dx - 4, by + dy - 5, r * .8, 0, 7); g.fill(); });
    g.fillStyle = P[2]; [[-14, -118, 14], [14, -104, 11], [-30, -96, 10], [6, -128, 9]].forEach(([dx, dy, r]) => { g.globalAlpha = .75; g.beginPath(); g.arc(bx + dx, by + dy, r, 0, 7); g.fill(); g.globalAlpha = 1; });
  }
  return c;
}
function makeRock(v) {
  const [c, g] = mk(90, 70); g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(45, 56, 30, 9, 0, 0, 7); g.fill();
  const pts = v ? [[14, 54], [10, 34], [26, 16], [46, 12], [64, 24], [78, 44], [72, 56]] : [[12, 54], [8, 38], [22, 22], [44, 16], [66, 28], [80, 46], [70, 56]];
  g.fillStyle = '#9aa1ad'; g.beginPath(); g.moveTo(...pts[0]); pts.slice(1).forEach(p => g.lineTo(...p)); g.closePath(); g.fill();
  g.fillStyle = '#b9c0cb'; g.beginPath(); g.moveTo(pts[1][0], pts[1][1]); g.lineTo(pts[2][0], pts[2][1]); g.lineTo(pts[3][0], pts[3][1]); g.lineTo(52, 30); g.lineTo(26, 40); g.closePath(); g.fill();
  g.fillStyle = '#7c8491'; g.beginPath(); g.moveTo(pts[4][0], pts[4][1]); g.lineTo(pts[5][0], pts[5][1]); g.lineTo(pts[6][0], pts[6][1]); g.lineTo(46, 56); g.lineTo(52, 30); g.closePath(); g.fill();
  return c;
}
const CROPS = { wheat: ['#e8c44a', '#c9a02c'], potato: ['#5fb24c', '#8d6bb0'], carrot: ['#5fc04c', '#f08a24'], corn: ['#58b043', '#f2d04a'], tomato: ['#4aa83c', '#e5382f'], sunflower: ['#4fa83a', '#f6c61c'], strawberry: ['#58b84a', '#e73c5a'], watermelon: ['#3f9a3c', '#2f8a3a'] };
function makePlant(kind, st) {   // st: 0 بذرة، 1 نبتة، 2 تنمو، 3 ناضج
  const [c, g] = mk(64, 84); const bx = 32, by = 74, col = CROPS[kind] || CROPS.wheat;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.fillStyle = 'rgba(60,35,15,.55)'; g.beginPath(); g.ellipse(bx, by, 15, 6, 0, 0, 7); g.fill();
  if (st === 0) { g.fillStyle = '#6b4423'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(bx - 8 + i * 8, by - 1 + (i % 2) * 2, 3.5, 2.4, 0, 0, 7); g.fill(); } return c; }
  const leaf = (x, y, a, l, w, fill) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = fill; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(w, -l * .5, 0, -l); g.quadraticCurveTo(-w, -l * .5, 0, 0); g.fill(); g.restore(); };
  const gc = '#58b043', gd = '#3f9235';
  if (st === 1) { leaf(bx, by, -.5, 16, 5, gc); leaf(bx, by, .5, 16, 5, gd); if (kind === 'wheat') { g.strokeStyle = gc; g.lineWidth = 2; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(bx + i * 6, by); g.lineTo(bx + i * 7, by - 14); g.stroke(); } } return c; }
  const h = st === 2 ? 0.62 : 1;
  switch (kind) {
    case 'wheat': for (let i = -2; i <= 2; i++) { const x = bx + i * 6, t = by - 44 * h - (i % 2) * 3; g.strokeStyle = st === 3 ? '#cfa83a' : '#6fbf49'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, by); g.quadraticCurveTo(x + i, by - 24 * h, x + i * 1.6, t); g.stroke(); if (st === 3) { g.fillStyle = '#efc94a'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x + i * 1.6 + (k % 2 ? 2.5 : -2.5), t + k * 5, 2.4, 4.4, k % 2 ? .4 : -.4, 0, 7); g.fill(); } } else { g.fillStyle = '#8ad060'; g.beginPath(); g.ellipse(x + i * 1.6, t, 2.4, 5, 0, 0, 7); g.fill(); } } break;
    case 'corn': g.strokeStyle = '#4f9d3a'; g.lineWidth = 4; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by - 52 * h); g.stroke(); for (let i = 0; i < 4; i++) { const y = by - 12 - i * 11 * h; leaf(bx, y, -1.15, 24 * h + 6, 5, i % 2 ? gc : gd); leaf(bx, y - 4, 1.15, 24 * h + 6, 5, i % 2 ? gd : gc); } if (st === 3) { g.fillStyle = '#f4d24c'; g.beginPath(); g.ellipse(bx + 7, by - 30, 5, 11, .2, 0, 7); g.fill(); g.fillStyle = '#8fd05a'; g.beginPath(); g.ellipse(bx + 9, by - 26, 3, 10, .2, 0, 7); g.fill(); } break;
    case 'potato': for (let i = 0; i < 6; i++) leaf(bx + (i - 2.5) * 3, by - 2, (i - 2.5) * .28, 28 * h + 4, 7, i % 2 ? gc : gd); if (st === 3) { g.fillStyle = '#c9a26a'; [[-10, -2], [8, 0], [0, 3]].forEach(([x, y]) => { g.beginPath(); g.ellipse(bx + x, by + y, 5.5, 4, 0, 0, 7); g.fill(); }); g.fillStyle = '#a97fc0'; g.beginPath(); g.arc(bx - 6, by - 34, 3, 0, 7); g.arc(bx + 7, by - 30, 3, 0, 7); g.fill(); } break;
    case 'carrot': for (let i = 0; i < 7; i++) leaf(bx, by, (i - 3) * .32, 36 * h + 4, 4, i % 2 ? '#5fc04c' : '#47a63a'); if (st === 3) { g.fillStyle = '#f08a24'; g.beginPath(); g.moveTo(bx - 7, by - 4); g.lineTo(bx + 7, by - 4); g.lineTo(bx, by + 8); g.closePath(); g.fill(); } break;
    case 'tomato': g.strokeStyle = '#4a9a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by - 40 * h); g.stroke(); for (let i = 0; i < 6; i++) leaf(bx, by - 8 - i * 6 * h, (i % 2 ? 1 : -1) * 1.1, 20 * h + 4, 6, i % 2 ? gc : gd); if (st === 3) { g.fillStyle = '#e5382f'; [[-9, -22], [9, -30], [-6, -42], [8, -14]].forEach(([x, y]) => { g.beginPath(); g.arc(bx + x, by + y, 5, 0, 7); g.fill(); g.fillStyle = '#ff7a70'; g.beginPath(); g.arc(bx + x - 1.5, by + y - 1.5, 1.5, 0, 7); g.fill(); g.fillStyle = '#e5382f'; }); } break;
    case 'sunflower': g.strokeStyle = '#4f9d3a'; g.lineWidth = 4; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by - 54 * h); g.stroke(); leaf(bx, by - 12, -1.2, 22, 6, gc); leaf(bx, by - 24, 1.2, 22, 6, gd); if (st === 3) { const hy = by - 58; g.fillStyle = '#f6c61c'; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; g.beginPath(); g.ellipse(bx + Math.cos(a) * 11, hy + Math.sin(a) * 11, 6, 3.2, a, 0, 7); g.fill(); } g.fillStyle = '#6b3f1a'; g.beginPath(); g.arc(bx, hy, 7.5, 0, 7); g.fill(); } else { g.fillStyle = '#7fc84a'; g.beginPath(); g.arc(bx, by - 54 * h, 5, 0, 7); g.fill(); } break;
    case 'strawberry': for (let i = 0; i < 6; i++) leaf(bx + (i - 2.5) * 4, by - 2, (i - 2.5) * .34, 22 * h + 4, 8, i % 2 ? gc : gd); if (st === 3) { g.fillStyle = '#e73c5a'; [[-10, -2], [9, -4], [0, 2], [-4, -10]].forEach(([x, y]) => { g.beginPath(); g.moveTo(bx + x - 5, by + y - 3); g.lineTo(bx + x + 5, by + y - 3); g.lineTo(bx + x, by + y + 7); g.closePath(); g.fill(); }); g.fillStyle = '#ffe9a0'; [[-10, 0], [9, -2], [0, 4]].forEach(([x, y]) => g.fillRect(bx + x - 1, by + y - 1, 2, 2)); } break;
    case 'watermelon': for (let i = 0; i < 5; i++) leaf(bx + (i - 2) * 5, by - 2, (i - 2) * .55, 24 * h + 4, 9, i % 2 ? '#4aa63e' : '#3c8f34'); if (st === 3) { g.fillStyle = '#2f8a3a'; g.beginPath(); g.ellipse(bx, by - 8, 15, 11, 0, 0, 7); g.fill(); g.strokeStyle = '#1f6a2a'; g.lineWidth = 2; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(bx + i * 5, by - 18); g.quadraticCurveTo(bx + i * 7, by - 8, bx + i * 5, by + 2); g.stroke(); } } break;
  }
  return c;
}
function makeField() {   // أرض حراثة لخانة
  const [c, g] = mk(TW + 4, TH + 4); g.translate(TW / 2 + 2, 2);
  const gr = g.createLinearGradient(0, 0, 0, TH); gr.addColorStop(0, '#8f5d36'); gr.addColorStop(1, '#704527');
  diamond(g, 0, 0, TW, TH); g.fillStyle = gr; g.fill(); g.save(); diamond(g, 0, 0, TW, TH); g.clip();
  for (let i = 0; i < 4; i++) { const t = (i + .5) / 4, x0 = -HW * t, y0 = HH * t, x1 = HW - HW * t, y1 = HH + HH * t; g.strokeStyle = 'rgba(35,18,6,.38)'; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.strokeStyle = 'rgba(190,130,80,.28)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0 - 3); g.lineTo(x1, y1 - 3); g.stroke(); }
  g.restore(); diamond(g, 0, 0, TW, TH); g.strokeStyle = 'rgba(40,22,8,.5)'; g.lineWidth = 2; g.stroke(); return c;
}
function makeRoad() {
  const [c, g] = mk(TW + 4, TH + 4); g.translate(TW / 2 + 2, 2); diamond(g, 0, 0, TW, TH); g.fillStyle = '#d8c394'; g.fill(); g.save(); diamond(g, 0, 0, TW, TH); g.clip();
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#c4ad7c' : '#e8d8ae'; g.beginPath(); g.ellipse((hash(i, 1, 5) - .5) * 90, 8 + hash(i, 2, 5) * 46, 7 + hash(i, 3, 5) * 5, 4, 0, 0, 7); g.fill(); } g.restore();
  diamond(g, 0, 0, TW, TH); g.strokeStyle = 'rgba(120,95,50,.55)'; g.lineWidth = 2; g.stroke(); return c;
}

/* ═══ الحالة والمنطق ═══ */
const G = { sel: null, place: null, plan: 0, pops: [], busy: false };
const FOOT = k => { const it = W.items[k]; return [it.fw, it.fh]; };
const key = (x, y) => x + ',' + y;
const inb = (x, y) => x > -4000 && y > -4000 && x < 4000 && y < 4000;
const terr = (x, y) => { const B = W.blocks.get(Math.floor(x / 10) + ',' + Math.floor(y / 10)); return B ? B.t[(y - Math.floor(y / 10) * 10) * 10 + (x - Math.floor(x / 10) * 10)] : terrRaw(x, y); };
const landOpen = (x, y) => W.lands.has(Math.floor(x / 10) + ',' + Math.floor(y / 10));
const natBlocked = (x, y) => { const c = terr(x, y); return (c === 2 || c === 3) && !W.cleared.has(key(x, y)); };
function apply(r) {
  W.lands = new Set(r.lands); W.cleared = new Set(r.cleared); W.coins = r.coins; W.unlock_cost = r.unlock_cost;
  W.objs = new Map(); W.occ = new Map();
  r.objs.forEach(o => { W.objs.set(o.id, o); const [fw, fh] = FOOT(o.k); for (let i = 0; i < fw; i++) for (let j = 0; j < fh; j++) W.occ.set(key(o.x + i, o.y + j), o); });
  W.hasAnim = r.objs.some(o => W.items[o.k].cat === 'animals'); off = r.now * 1000 - Date.now(); hudCoins(); dirty = true;
}
function canPlace(k, x, y, skip) {
  const [fw, fh] = FOOT(k);
  for (let i = 0; i < fw; i++) for (let j = 0; j < fh; j++) {
    const a = x + i, b = y + j;
    if (!inb(a, b)) return 'خارج الخريطة';
    if (!landOpen(a, b)) return 'هذي الأرض مقفلة';
    if (terr(a, b) === 1) return 'ما تكدر تبني على الماء';
    if (natBlocked(a, b)) return 'امسح الشجرة أو الصخرة أول';
    const o = W.occ.get(key(a, b)); if (o && o.id !== skip) return 'المكان مشغول';
  }
  return null;
}
const cropStage = (o) => { const c = W.crops[o.c]; if (!c) return -1; const p = (nowS() - o.t) / (c.min * 60); return p >= 1 ? 3 : p < 0.12 ? 0 : p < 0.5 ? 1 : 2; };
const prodReady = (o) => { const p = W.items[o.k].prod; return !!p && nowS() >= o.t + p.min * 60 - 1; };
const isReady = (o) => o.k === 'field' ? (o.c && cropStage(o) === 3) : prodReady(o);
const left = (o) => { if (o.k === 'field') return W.crops[o.c].min * 60 - (nowS() - o.t); return W.items[o.k].prod.min * 60 - (nowS() - o.t); };
const fmt = s => s >= 3600 ? Math.floor(s / 3600) + ' س ' + Math.ceil((s % 3600) / 60) + ' د' : s >= 60 ? Math.ceil(s / 60) + ' د' : Math.max(1, Math.ceil(s)) + ' ث';

/* ═══ الرسم ═══ */
const bubbleIcon = {};
function loadAtlas() {
  return new Promise(res => {
    Promise.all([fetch('/static/atlas.json?v=3').then(r => r.json()), new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = '/static/atlas.png?v=3'; })])
      .then(([m, im]) => { atlas.meta = m.s; atlas.S = m.S; atlas.img = im; atlas.ok = true; res(true); }).catch(() => res(false));
  });
}
function getBlock(bx, by) {
  const k = bx + ',' + by; let B = W.blocks.get(k); if (B) return B; if (W.blocks.size > 700) W.blocks.clear();
  B = { t: new Uint8Array(100), water: [], nat: [], patch: [] }; const X0 = bx * 10, Y0 = by * 10;
  for (let j = 0; j < 10; j++) for (let i = 0; i < 10; i++) B.t[j * 10 + i] = terrRaw(X0 + i, Y0 + j);
  const nt = (x, y) => (x >= X0 && y >= Y0 && x < X0 + 10 && y < Y0 + 10) ? B.t[(y - Y0) * 10 + (x - X0)] : terrRaw(x, y);
  for (let j = 0; j < 10; j++) for (let i = 0; i < 10; i++) {
    const x = X0 + i, y = Y0 + j, t = B.t[j * 10 + i];
    if (t === 1) { let m = 0; if (nt(x - 1, y) !== 1) m |= 1; if (nt(x + 1, y) !== 1) m |= 2; if (nt(x, y - 1) !== 1) m |= 4; if (nt(x, y + 1) !== 1) m |= 8; B.water.push(x, y, m); }
    else if (t === 2 || t === 3) B.nat.push(x, y, t); else if (hash(x, y, 21) < 0.16) B.patch.push(x, y, hash(x, y, 22) < .5 ? 1 : 0);
  }
  W.blocks.set(k, B); return B;
}
function buildBlocks() { W.blocks = new Map(); }
function buildArt() {
  buildBlocks(); { const [c, g] = mk(256, 128); g.fillStyle = '#82cd56'; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 26; i++) { const x = 8 + hash(i, 1, 31) * 240, y = 10 + hash(i, 2, 31) * 110; g.strokeStyle = i % 2 ? 'rgba(70,150,50,.30)' : 'rgba(205,247,150,.42)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1.5, y - 5); g.moveTo(x + 2, y); g.lineTo(x + 3.6, y - 5.6); g.stroke(); }
    [[60, 90, '#fff', '#ffd84a'], [190, 40, '#ffb3cf', '#ffe36a']].forEach(([x, y, p, q]) => { g.fillStyle = p; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); g.fillStyle = q; g.beginPath(); g.arc(x, y, 1, 0, 7); g.fill(); });
    cache.gpat = cx2.createPattern(c, 'repeat'); }
  cache.water = [0, 1, 2].map(f => makeWater(f * 2.1)); cache.field = makeField(); cache.road = makeRoad(); { const rt = spriteBox('roadtex'); if (rt) { const [c, g] = mk(TW + 4, TH + 4); g.translate(TW / 2 + 2, 2); diamond(g, 0, 0, TW, TH); g.save(); g.clip(); g.drawImage(atlas.img, rt.x, rt.y, rt.w, rt.h, -HW, 0, TW, TH); g.restore(); diamond(g, 0, 0, TW, TH); g.strokeStyle = 'rgba(70,60,45,.35)'; g.lineWidth = 1.5; g.stroke(); cache.road = c; } }
  cache.tree = [0, 1, 2, 3].map(makeTree); cache.rock = [makeRock(0), makeRock(1)];
  cache.plant = {}; Object.keys(W.crops).forEach(k => { cache.plant[k] = [0, 1, 2, 3].map(s => makePlant(k, s)); });
}
function spriteBox(name) { const m = atlas.meta && atlas.meta[name]; return m; }
const SPR_Y = { barn: 0, barn2: 0, greenhouse: 0, greenhouse2: 0 };
function wanderOf(o, ts) {   // حركة الحيوان: يمشي لهدف قريب ثم يقف، ويلتفت لجهة مشيه
  const T = 5200, t = ts / T + hash(o.id, 3, 4) * 50, n = Math.floor(t), f = t - n, P = i => [(hash(o.id, i, 41) - .5) * 2.2, (hash(o.id, i, 42) - .5) * 2.2];
  const a = P(n - 1), b = P(n), k = Math.min(1, f / .38), e = k * k * (3 - 2 * k), mv = f < .38;
  return { x: a[0] + (b[0] - a[0]) * e, y: a[1] + (b[1] - a[1]) * e, mv, fl: (b[0] - b[1]) - (a[0] - a[1]) < 0, hop: mv ? Math.abs(Math.sin(f * 60)) * 5 : 0 };
}
function drawSprite(g, name, x, y, fw, fh, alpha, flip, lift) {
  const m = spriteBox(name); if (!m) return;
  const [ax, ay] = corner(x + fw / 2, y + fh / 2);
  const S = atlas.S; if (alpha !== 1) g.globalAlpha = alpha;
  if (flip) { g.save(); g.translate(ax, 0); g.scale(-1, 1); g.drawImage(atlas.img, m.x, m.y, m.w, m.h, -m.ax / S, ay - m.ay / S - (lift || 0), m.w / S, m.h / S); g.restore(); }
  else g.drawImage(atlas.img, m.x, m.y, m.w, m.h, ax - m.ax / S, ay - m.ay / S - (lift || 0), m.w / S, m.h / S); if (alpha !== 1) g.globalAlpha = 1;
}
function drawFence(g, k, x, y, alpha) {
  const m = spriteBox('fencex');
  if (m) {
    const fe = (a, b) => { const o = W.occ.get(key(a, b)); return o && o.k === 'fence'; };
    const ly = fe(x, y - 1) || fe(x, y + 1), lx = fe(x - 1, y) || fe(x + 1, y), S = atlas.S, [cx, cy] = ctr(x, y), w = m.w / S * .8, h = m.h / S * .8;
    if (alpha !== 1) g.globalAlpha = alpha;
    const one = flip => { g.save(); g.translate(cx, cy + 6); if (flip) g.scale(-1, 1); g.drawImage(atlas.img, m.x, m.y, m.w, m.h, -w / 2, -h * .88, w, h); g.restore(); };
    if (ly || !lx) one(false); if (lx) one(true);
    if (alpha !== 1) g.globalAlpha = 1; return;
  }
  const [cx, cy] = ctr(x, y); if (alpha !== 1) g.globalAlpha = alpha;
  const link = (dx, dy) => { const o = W.occ.get(key(x + dx, y + dy)); return o && o.k === 'fence'; };
  [[1, 0], [0, 1]].forEach(([dx, dy]) => { if (!link(dx, dy)) return; const [nx, ny] = ctr(x + dx, y + dy); [[-10, '#8a5a2d'], [-22, '#a8733a']].forEach(([h, c]) => { g.strokeStyle = c; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy + h + 6); g.lineTo(nx, ny + h + 6); g.stroke(); }); });
  g.fillStyle = '#6b4423'; g.fillRect(cx - 4, cy - 22, 8, 32); g.fillStyle = '#8a5a2d'; g.fillRect(cx - 4, cy - 22, 4, 32); g.fillStyle = '#b07a42'; g.beginPath(); g.moveTo(cx - 4, cy - 22); g.lineTo(cx, cy - 28); g.lineTo(cx + 4, cy - 22); g.fill();
  if (alpha !== 1) g.globalAlpha = 1;
}
function drawFieldTiles(g, o, alpha) {
  if (alpha !== 1) g.globalAlpha = alpha;
  const fd = spriteBox('fielddirt');
  if (fd) { const [ax, ay] = corner(o.x + 1, o.y + 1), S = atlas.S; g.drawImage(atlas.img, fd.x, fd.y, fd.w, fd.h, ax - fd.w / S / 2, ay - fd.h / S / 2, fd.w / S, fd.h / S); }
  else for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const [tx, ty] = corner(o.x + i, o.y + j); g.drawImage(cache.field, tx - HW - 2, ty - 2); }
  if (alpha !== 1) g.globalAlpha = 1;
  if (o.c && cache.plant[o.c]) {
    const st = Math.max(0, cropStage(o)), pic = cache.plant[o.c][st];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (const u of [0.28, 0.72]) for (const v of [0.28, 0.72]) {
      const [px, py] = corner(o.x + i + u, o.y + j + v); g.drawImage(pic, px - 27, py - 63, 54, 71);
    }
  }
}
function lineCells(p) {   // خط مستقيم من نقطة البداية إلى النهاية (باتجاه الأطول)
  const ex = p.ex === undefined ? p.x : p.ex, ey = p.ey === undefined ? p.y : p.ey, dx = ex - p.x, dy = ey - p.y, out = [];
  if (Math.abs(dx) >= Math.abs(dy)) { const s = dx < 0 ? -1 : 1, n = Math.min(80, Math.abs(dx)); for (let i = 0; i <= n; i++) out.push([p.x + i * s, p.y]); }
  else { const s = dy < 0 ? -1 : 1, n = Math.min(80, Math.abs(dy)); for (let i = 0; i <= n; i++) out.push([p.x, p.y + i * s]); }
  return out;
}
function drawItem(g, k, x, y, alpha, o) {
  if (k === 'field') drawFieldTiles(g, o || { x, y, c: '' }, alpha);
  else if (k === 'road') { const [tx, ty] = corner(x, y); if (alpha !== 1) g.globalAlpha = alpha; g.drawImage(cache.road, tx - HW - 2, ty - 2); if (alpha !== 1) g.globalAlpha = 1; }
  else if (k === 'fence') drawFence(g, k, x, y, alpha);
  else { const [fw, fh] = FOOT(k); drawSprite(g, k, x, y, fw, fh, alpha); }
}
function footPoly(g, x, y, fw, fh) { const a = corner(x, y), b = corner(x + fw, y), c = corner(x + fw, y + fh), d = corner(x, y + fh); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); }
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function coinIcon(g, x, y, r) { g.fillStyle = '#e39b14'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x, y, r * .82, 0, 7); g.fill(); g.strokeStyle = '#e39b14'; g.lineWidth = r * .16; g.beginPath(); g.arc(x, y, r * .55, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(x - r * .3, y - r * .35, r * .22, r * .12, -.6, 0, 7); g.fill(); }
function bubble(g, x, y, ts, kind) {
  const by = y + Math.sin(ts / 280) * 4; g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  g.fillStyle = '#fffdf2'; g.beginPath(); g.arc(x, by, 21, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 7, by + 17); g.lineTo(x, by + 28); g.lineTo(x + 7, by + 17); g.fill(); g.restore();
  g.strokeStyle = '#f0c040'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, by, 21, 0, 7); g.stroke();
  if (kind === 'coin') coinIcon(g, x, by, 13); else if (cache.plant[kind]) g.drawImage(cache.plant[kind][3], x - 20, by - 29, 40, 52);
}

function draw(ts) {
  if (!cx2 || !W) return;
  const z = cam.z, g = cx2; g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#a9bfc9'; g.fillRect(0, 0, cv.width, cv.height);
  g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - cam.x * z), dpr * (vh / 2 - cam.y * z));
  const wx0 = cam.x - vw / 2 / z, wx1 = cam.x + vw / 2 / z, wy0 = cam.y - vh / 2 / z, wy1 = cam.y + vh / 2 / z;
  const toT = (px, py) => [(py / HH + px / HW) / 2, (py / HH - px / HW) / 2];
  const cs = [toT(wx0, wy0), toT(wx1, wy0), toT(wx0, wy1), toT(wx1, wy1)];
  const x0 = Math.floor(Math.min(...cs.map(c => c[0]))) - 2, x1 = Math.ceil(Math.max(...cs.map(c => c[0]))) + 2;
  const y0 = Math.floor(Math.min(...cs.map(c => c[1]))) - 2, y1 = Math.ceil(Math.max(...cs.map(c => c[1]))) + 4;
  const wf = Math.floor(ts / 700) % 3, ents = [], pl = G.place;
  // الأرض: عشب بنمط واحد يغطي الشاشة كلها (لا حواف ولا فراغ)
  g.fillStyle = cache.gpat; g.fillRect(wx0 - 4, wy0 - 4, wx1 - wx0 + 8, wy1 - wy0 + 8);
  const bx0 = Math.floor(x0 / 10), bx1 = Math.floor(x1 / 10), by0 = Math.floor(y0 / 10), by1 = Math.floor(y1 / 10), NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  g.lineCap = 'round';
  for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
    const B = getBlock(bx, by), open_ = W.lands.has(bx + ',' + by), near = !open_ && NB.some(([a, b]) => W.lands.has((bx + a) + ',' + (by + b)));
    for (let i = 0; i < B.patch.length; i += 3) { const x = B.patch[i], y = B.patch[i + 1], [tx, ty] = corner(x, y); if (tx < wx0 - 160 || tx > wx1 + 160 || ty < wy0 - 100 || ty > wy1 + 100) continue; g.fillStyle = B.patch[i + 2] ? 'rgba(255,255,190,.05)' : 'rgba(30,110,30,.045)'; g.beginPath(); g.ellipse(tx, ty + HH, 110, 56, 0, 0, 7); g.fill(); }
    for (let i = 0; i < B.water.length; i += 3) {
      const x = B.water[i], y = B.water[i + 1], m = B.water[i + 2], [tx, ty] = corner(x, y); if (tx < wx0 - 80 || tx > wx1 + 80 || ty < wy0 - 100 || ty > wy1 + 60) continue;
      g.drawImage(cache.water[wf], tx - HW - 2, ty - 2);
      if (m) {
        const a = [tx, ty], r = [tx + HW, ty + HH], l = [tx - HW, ty + HH], bt = [tx, ty + TH], segs = [[1, a, l], [2, r, bt], [4, a, r], [8, l, bt]];
        for (const [bit, p, q] of segs) if (m & bit) { g.strokeStyle = '#f2e3b0'; g.lineWidth = 9; g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; g.stroke(); }
      }
    }
    if (open_ || cam.z >= 0.4 || near) for (let i = 0; i < B.nat.length; i += 3) { const x = B.nat[i], y = B.nat[i + 1]; if (W.cleared.has(key(x, y))) continue; const [px, py] = ctr(x, y); if (px < wx0 - 120 || px > wx1 + 120 || py < wy0 - 60 || py > wy1 + 230) continue; ents.push({ d: x + y + 2, t: B.nat[i + 2], x, y, dim: !open_ }); }
    if (!open_) { footPoly(g, bx * 10, by * 10, 10, 10); g.fillStyle = near ? 'rgba(12,28,30,.42)' : 'rgba(225,240,245,.34)'; g.fill(); }
  }
  const nowT = nowS();
  // حقول وطرق (على الأرض)
  W.objs.forEach(o => {
    if (o.k !== 'field' && o.k !== 'road') return; const [fw, fh] = FOOT(o.k); const [px, py] = ctr(o.x, o.y); if (px < wx0 - 300 || px > wx1 + 300 || py < wy0 - 300 || py > wy1 + 300) return;
    if (pl && pl.mode === 'move' && pl.id === o.id) return;
    drawItem(g, o.k, o.x, o.y, 1, o);
  });
  // حدود الأراضي المقفلة القابلة للفتح
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]], lab = [];
  for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
    if (W.lands.has(bx + ',' + by) || !nb.some(([a, b]) => W.lands.has((bx + a) + ',' + (by + b)))) continue;
    const [cx0, cy0] = ctr(bx * 10 + 5, by * 10 + 5); if (cx0 < wx0 - 700 || cx0 > wx1 + 700 || cy0 < wy0 - 500 || cy0 > wy1 + 500) continue;
    footPoly(g, bx * 10, by * 10, 10, 10); g.setLineDash([22, 14]); g.strokeStyle = 'rgba(255,224,120,.95)'; g.lineWidth = 6; g.stroke(); g.setLineDash([]); lab.push([cx0, cy0]);
  }
  // تحديد
  if (G.sel) { const s = G.sel; let fx, fy, fw = 1, fh = 1; if (s.t === 'o') { const o = W.objs.get(s.id); if (o) { fx = o.x; fy = o.y;[fw, fh] = FOOT(o.k); } } else { fx = s.x; fy = s.y; }
    if (fx !== undefined) { footPoly(g, fx, fy, fw, fh); g.fillStyle = 'rgba(255,255,255,.22)'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 4 + Math.sin(ts / 200) * 1.2; g.stroke(); } }
  // كيانات
  W.objs.forEach(o => {
    if (o.k === 'field' || o.k === 'road') return; if (pl && pl.mode === 'move' && pl.id === o.id) return;
    const [fw, fh] = FOOT(o.k); const [px, py] = ctr(o.x, o.y); if (px < wx0 - 350 || px > wx1 + 350 || py < wy0 - 350 || py > wy1 + 350) return;
    ents.push({ d: o.x + fw + o.y + fh, o });
  });
  ents.sort((a, b) => a.d - b.d);
  for (const e of ents) {
    if (e.o) { if (e.o.k && W.items[e.o.k].cat === 'animals' && atlas.ok && !(pl && pl.id === e.o.id)) { const w = wanderOf(e.o, ts); drawSprite(g, e.o.k, e.o.x + w.x, e.o.y + w.y, 1, 1, 1, w.fl, w.hop); } else drawItem(g, e.o.k, e.o.x, e.o.y, 1, e.o); }
    else { const [px, py] = ctr(e.x, e.y); if (e.dim) g.globalAlpha = .55; const nm = e.t === 2 ? (((e.x * 7 + e.y * 13) % 5) < 2 ? 'pine' : 'oak') : 'rock';
      if (atlas.ok && spriteBox(nm)) drawSprite(g, nm, e.x, e.y, 1, 1, 1);
      else { const im = e.t === 2 ? cache.tree[(e.x * 5 + e.y * 11 + ((e.x ^ e.y) & 7)) & 3] : cache.rock[(e.x + e.y) & 1]; if (e.t === 2) g.drawImage(im, px - 75, py - 166 + 14); else g.drawImage(im, px - 45, py - 54 + 16); }
      if (e.dim) g.globalAlpha = 1; }
  }
  // فقاعات الجاهز
  W.objs.forEach(o => {
    if (!isReady(o) || (pl && pl.id === o.id)) return; let [px, py] = ctr(o.x, o.y), top;
    if (o.k === 'field') { [px, py] = corner(o.x + 1, o.y + 1); top = py - 66; } else { const m = spriteBox(o.k); const [fw, fh] = FOOT(o.k); [px, py] = corner(o.x + fw / 2, o.y + fh / 2); top = py - (m ? (m.ay / atlas.S) : 90) - 30; }
    bubble(g, px, top, ts, o.k === 'field' ? o.c : 'coin');
  });
  // علامات الأراضي
  g.font = 'bold 20px Cairo, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lab.forEach(([lx, ly]) => { const w = 120; g.save(); g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 10; g.fillStyle = 'rgba(20,28,45,.88)'; roundRect(g, lx - w / 2, ly - 24, w, 48, 24); g.fill(); g.restore(); coinIcon(g, lx - 30, ly, 14); g.fillStyle = '#fff'; g.fillText(String(W.unlock_cost), lx + 14, ly + 1); g.font = 'bold 15px Cairo, system-ui, sans-serif'; g.fillStyle = '#ffe07a'; g.fillText('افتح الأرض', lx, ly - 36); g.font = 'bold 20px Cairo, system-ui, sans-serif'; });
  // شبح الوضع
  if (pl) {
    const [fw, fh] = FOOT(pl.k);
    if (pl.line) {
      const cells = lineCells(pl); let bad = null; pl.err = null;
      for (const [cx, cy] of cells) { const er = canPlace(pl.k, cx, cy); if (er) { bad = er; pl.err = er; } footPoly(g, cx, cy, 1, 1); g.fillStyle = er ? 'rgba(255,70,70,.45)' : 'rgba(70,230,110,.4)'; g.fill(); g.strokeStyle = er ? '#ff4c4c' : '#46e66e'; g.lineWidth = 3; g.stroke(); }
      for (const [cx, cy] of cells) drawItem(g, pl.k, cx, cy, 0.82, null);
      if (pl.lastN !== cells.length) { pl.lastN = cells.length; placeBar(); }
    } else {
      const err = canPlace(pl.k, pl.x, pl.y, pl.id); pl.err = err;
      footPoly(g, pl.x, pl.y, fw, fh); g.fillStyle = err ? 'rgba(255,70,70,.45)' : 'rgba(70,230,110,.4)'; g.fill(); g.strokeStyle = err ? '#ff4c4c' : '#46e66e'; g.lineWidth = 5; g.stroke();
      drawItem(g, pl.k, pl.x, pl.y, 0.82, pl.id ? W.objs.get(pl.id) : null);
    }
  }
  // نصوص عائمة
  G.pops = G.pops.filter(p => ts - p.t0 < 1300);
  g.font = 'bold 22px Cairo, system-ui, sans-serif';
  G.pops.forEach(p => { const a = (ts - p.t0) / 1300; g.globalAlpha = 1 - a * a; const y = p.y - 30 - a * 70; coinIcon(g, p.x - 24, y, 15); g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(p.txt, p.x + 12, y + 2); g.fillStyle = '#fff3b0'; g.fillText(p.txt, p.x + 12, y + 2); g.globalAlpha = 1; });
}

/* ═══ الواجهة (HUD) ═══ */
const ICON = {
  back: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  snd: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  shop: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.6 2.6 0 0 0 5.3 0 2.6 2.6 0 0 0 5.4 0 2.6 2.6 0 0 0 5.3 0"/><path d="M5.5 12v8h13v-8"/><path d="M10 20v-4.5h4V20"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
  ok: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  no: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  coin: '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="10.5" fill="#e39b14"/><circle cx="12" cy="12" r="8.6" fill="#ffd34d"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#e39b14" stroke-width="1.7"/><ellipse cx="8.6" cy="8" rx="2.2" ry="1.2" transform="rotate(-35 8.6 8)" fill="rgba(255,255,255,.6)"/></svg>',
  all: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/><path d="M3 7l3 3M11 4l2 2" opacity=".7"/></svg>'
};
const CSS = `#world{position:fixed;inset:0;z-index:9000;background:#2f7fb8;direction:rtl;font-family:'Cairo','Segoe UI',Tahoma,system-ui,sans-serif;color:#fff;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
#world canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}
#world button{font-family:inherit;color:inherit;cursor:pointer;border:0;-webkit-tap-highlight-color:transparent}
.w-top{position:absolute;top:calc(10px + env(safe-area-inset-top,0px));left:12px;right:12px;display:flex;align-items:center;gap:10px;pointer-events:none}
.w-top>*{pointer-events:auto}.w-top .grow{flex:1;pointer-events:none}
.w-btn{width:44px;height:44px;border-radius:50%;background:rgba(20,34,58,.82);display:grid;place-items:center;box-shadow:0 3px 10px rgba(0,0,0,.35);backdrop-filter:blur(6px)}
.w-city{position:absolute;left:12px;top:calc(58px + env(safe-area-inset-top,0px));max-width:62vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:rgba(20,34,58,.82);color:#fff;border:1.5px solid rgba(255,255,255,.25);border-radius:999px;padding:5px 12px;font-weight:800;font-size:12.5px;box-shadow:0 2px 8px rgba(0,0,0,.3)}.w-city.new{border-color:#e3b13a;animation:wpulse 1.4s infinite}@keyframes wpulse{50%{transform:scale(1.06)}}.w-in{width:100%;box-sizing:border-box;min-height:48px;border-radius:14px;border:2px solid #cdb98f;background:#fff;color:#3b2a14;font:700 16px Cairo,system-ui,sans-serif;padding:0 14px}.w-coins{display:flex;align-items:center;gap:8px;background:rgba(20,34,58,.86);border:2px solid #e3b13a;border-radius:999px;padding:4px 14px 4px 10px;font-weight:900;font-size:15.5px;box-shadow:0 3px 10px rgba(0,0,0,.35);direction:ltr}
.w-fabs{position:absolute;bottom:calc(16px + env(safe-area-inset-bottom,0px));right:14px;display:flex;flex-direction:column;align-items:center;gap:12px}
.w-fab{width:68px;height:68px;border-radius:50%;background:linear-gradient(#ffcf4a,#f39a1c);color:#5a3200!important;display:grid;place-items:center;box-shadow:0 5px 14px rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.5);font-weight:800}
.w-fab.sm{width:50px;height:50px;background:rgba(20,34,58,.86);color:#fff!important;box-shadow:0 3px 10px rgba(0,0,0,.4)}
.w-fab.gold{background:linear-gradient(#5be08a,#27b05c);color:#fff!important;position:relative}.w-fab[hidden]{display:none}
.w-badge{position:absolute;top:-4px;left:-4px;min-width:22px;height:22px;border-radius:11px;background:#ff4d4d;color:#fff;font-size:12px;font-weight:900;display:grid;place-items:center;padding:0 5px;border:2px solid #fff}
.w-bar{position:absolute;left:12px;right:96px;bottom:calc(16px + env(safe-area-inset-bottom,0px));background:rgba(20,34,58,.94);border-radius:20px;padding:10px 12px;box-shadow:0 6px 18px rgba(0,0,0,.45);display:none;align-items:center;gap:10px;flex-wrap:wrap}
.w-bar.on{display:flex}@media (orientation:landscape){.w-bar{right:auto;width:min(420px,60vw)}}.w-bar .t{flex:1 1 100%;font-weight:800;font-size:13px}.w-bar .s{flex:1 1 100%;font-size:11px;color:#aebbd6;margin-top:-6px}
.w-act{min-height:38px;padding:0 14px;border-radius:13px;background:#2d4a78;font-weight:800;font-size:12.5px;display:inline-flex;align-items:center;gap:6px}
.w-act.go{background:linear-gradient(#47d878,#20a553)}.w-act.bad{background:#a83a46}.w-act.gold{background:linear-gradient(#ffcf4a,#f39a1c);color:#5a3200!important}
.w-round{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;box-shadow:0 4px 12px rgba(0,0,0,.4)}
.w-round.ok{background:linear-gradient(#47d878,#20a553)}.w-round.no{background:linear-gradient(#ff6b6b,#d63a3a)}
.w-sbg{position:absolute;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;z-index:5}
.w-sheet{width:100%;max-width:560px;max-height:78%;overflow:auto;background:#f6efe0;color:#3a2a14;border-radius:24px 24px 0 0;padding:14px 14px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -6px 24px rgba(0,0,0,.4)}
.w-sheet .h{display:flex;align-items:center;justify-content:space-between;font-weight:900;font-size:16px;margin-bottom:10px}
.w-x{width:38px;height:38px;border-radius:50%;background:#e2d6bb;color:#5a4526!important;display:grid;place-items:center}
.w-tabs{display:flex;gap:8px;overflow:auto;margin-bottom:12px;padding-bottom:4px}.w-tab{flex:none;padding:7px 16px;border-radius:999px;background:#e8dcc0;color:#5a4526!important;font-weight:800;font-size:12.5px}.w-tab.on{background:#f39a1c;color:#fff!important}
.w-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.w-card{background:#fffaf0;border:2px solid #eadcb8;border-radius:18px;padding:8px 6px 10px;display:flex;flex-direction:column;align-items:center;gap:4px;color:#3a2a14!important;text-align:center;font-weight:800;font-size:12px;min-height:120px;justify-content:space-between}
.w-card:active{transform:scale(.97)}.w-card.dis{opacity:.5}.w-card .th{height:70px;display:grid;place-items:center}.w-card .th img{max-width:84px;max-height:70px}.w-card small{font-weight:600;color:#8a7650;font-size:10px;line-height:1.3}
.w-price{display:inline-flex;align-items:center;gap:4px;background:#3a2a14;color:#ffe07a;border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:900;direction:ltr}.w-price svg{width:13px;height:13px}
.w-toast{position:absolute;top:calc(66px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);background:rgba(20,34,58,.92);padding:7px 16px;border-radius:13px;font-weight:700;font-size:12.5px;opacity:0;transition:opacity .2s;pointer-events:none;max-width:86%;text-align:center;z-index:9}.w-toast.on{opacity:1}
.w-load{position:absolute;inset:0;display:grid;place-items:center;background:#2f7fb8;font-weight:800;font-size:16px;z-index:20}
.w-link{background:none!important;color:#b2641b!important;font-weight:800;text-decoration:underline;margin-top:10px;padding:6px;font-size:12px}
`;
let toastT = 0;
function wtoast(m) { const t = hud.toast; if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }
function hudCoins() { if (hud.coins) hud.coins.querySelector('b').textContent = String(W.coins); }
function setBar(html) { hud.bar.innerHTML = html || ''; hud.bar.classList.toggle('on', !!html); }
function closeSheet() { const s = root && root.querySelector('.w-sbg'); if (s) { s.remove(); H.bkDel(closeSheet); } }
function openSheet(html) { closeSheet(); const d = document.createElement('div'); d.className = 'w-sbg'; d.innerHTML = `<div class="w-sheet">${html}</div>`; d.addEventListener('pointerdown', e => { if (e.target === d) closeSheet(); }); root.appendChild(d); Snd.play('open'); H.bkAdd(closeSheet); return d; }
const priceTag = n => `<span class="w-price">${ICON.coin}${n}</span>`;
function thumb(k, box = 70) {
  const m = atlas.meta && atlas.meta[k];
  if (m) { const s = Math.min(box / m.w, box / m.h, 1.0); return `<span style="display:inline-block;width:${Math.round(m.w * s)}px;height:${Math.round(m.h * s)}px;background:url(/static/atlas.png?v=3) -${Math.round(m.x * s)}px -${Math.round(m.y * s)}px/${Math.round(atlas.img.width * s)}px ${Math.round(atlas.img.height * s)}px no-repeat"></span>`; }
  if (!cache.th) cache.th = {};
  if (!cache.th[k]) {
    const [c, g] = mk(150, 100); g.translate(75, 24);
    if (k === 'field') { for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const [tx, ty] = [(i - j) * 36, (i + j) * 18]; g.drawImage(cache.field, tx - 40, ty - 1, 80, 42); } for (const [i, j] of [[.3, .3], [.7, .3], [.3, .7], [.7, .7], [1.3, .3], [1.3, .7], [.3, 1.3], [.7, 1.3], [1.3, 1.3], [.7, .7]]) { } }
    else if (k === 'road') g.drawImage(cache.road, -40, 16, 80, 42);
    else if (k === 'fence') { g.translate(0, 28); g.scale(.8, .8); const og = W.occ; W.occ = new Map(); drawFence(g, 'fence', 0, 0, 1); W.occ = og; }
    cache.th[k] = c.toDataURL();
  }
  return `<img src="${cache.th[k]}" alt="">`;
}
/* ═══ الإجراءات ═══ */
async function act(body, quiet) {
  if (G.busy) return null; G.busy = true;
  try { const r = await H.api('/api/world_act', body); apply(r); return r; }
  catch (e) { wtoast(e.message || 'تعذّر التنفيذ'); Snd.play('error'); return null; }
  finally { G.busy = false; }
}
function popAt(x, y, txt) { G.pops.push({ x, y, txt, t0: performance.now() }); dirty = true; }
function objTop(o) { if (o.k === 'field') { const [px, py] = corner(o.x + 1, o.y + 1); return [px, py - 20]; } const [fw, fh] = FOOT(o.k); const [px, py] = fw * fh > 1 ? corner(o.x + fw, o.y + fh) : ctr(o.x, o.y); return [ctr(o.x + (fw - 1) / 2, o.y + (fh - 1) / 2)[0], py - 40]; }
async function goWork(o) {
  const field = o.k === 'field', r = await act({ action: field ? 'harvest' : 'collect', id: o.id });
  if (r) { const [px, py] = objTop(o); popAt(px, py, r.msg || ''); Snd.play(field ? 'harvest' : 'coin'); setTimeout(() => Snd.play('coin'), 120); }
  refreshBadge();
}
async function collectAll() {
  const list = [...W.objs.values()].filter(isReady); if (!list.length) return;
  closeSheet(); setBar('');
  for (const o of list) { const r = await act({ action: o.k === 'field' ? 'harvest' : 'collect', id: o.id }); if (!r) break; const [px, py] = objTop(o); popAt(px, py, r.msg || ''); Snd.play('coin'); await new Promise(r => setTimeout(r, 140)); }
  refreshBadge();
}
function refreshBadge() { const n = [...W.objs.values()].filter(isReady).length; hud.all.hidden = n === 0; hud.all.querySelector('.w-badge').textContent = String(n); if (n > (G.lastReady || 0)) Snd.play('ready'); G.lastReady = n; }

function selectObj(o) {
  G.sel = { t: 'o', id: o.id }; dirty = true; const it = W.items[o.k], refund = it.price >> 1; let status = '', main = '';
  if (o.k === 'field') { if (o.c) { const c = W.crops[o.c]; status = isReady(o) ? `${c.name}: جاهز للحصاد` : `${c.name}: ينضج بعد ${fmt(left(o))}`; if (isReady(o)) main = `<button class="w-act go" data-w="work">حصاد</button>`; } else main = `<button class="w-act gold" data-w="crops">زرع</button>`; }
  else if (it.prod) { status = isReady(o) ? 'جاهز للجمع' : `يجهز بعد ${fmt(left(o))}`; if (isReady(o)) main = `<button class="w-act go" data-w="work">جمع +${it.prod.coins}</button>`; }
  setBar(`<div class="t">${esc(it.name)}</div>${status ? `<div class="s">${status}</div>` : ''}${main}<button class="w-act" data-w="move">نقل</button><button class="w-act bad" data-w="sell">بيع ${refund}</button><button class="w-act" data-w="x">${ICON.no}</button>`);
  H.bkAdd(deselect);
}
function selectNat(x, y) {
  G.sel = { t: 'n', x, y }; dirty = true; const t = terr(x, y), cost = t === 2 ? 12 : 25;
  setBar(`<div class="t">${t === 2 ? 'شجرة' : 'صخرة'}</div><div class="s">امسحها حتى تبني مكانها</div><button class="w-act gold" data-w="clear">مسح ${priceTag(cost)}</button><button class="w-act" data-w="x">${ICON.no}</button>`);
  H.bkAdd(deselect);
}
function deselect() { const had = G.sel; G.sel = null; if (!G.place) setBar(''); dirty = true; if (had) H.bkDel(deselect); }
function startPlace(mode, k, id, x, y) {
  closeSheet(); deselect(); const [fw, fh] = FOOT(k);
  if (x === undefined) { const [wx, wy] = [cam.x, cam.y], tx = Math.floor((wy / HH + wx / HW) / 2), ty = Math.floor((wy / HH - wx / HW) / 2); x = tx; y = ty; let best = null;
    for (let r = 0; r < 9 && !best; r++) for (let dx = -r; dx <= r && !best; dx++) for (let dy = -r; dy <= r; dy++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (!canPlace(k, tx + dx, ty + dy, id)) { best = [tx + dx, ty + dy]; break; } }
    if (best) [x, y] = best; }
  G.place = { mode, k, id, x, y, err: null, line: mode === 'new' && ['fence', 'wall', 'road'].includes(k) }; placeBar(); dirty = true; H.bkAdd(cancelPlace);
}
function placeBar() {
  const p = G.place, it = W.items[p.k], n = p.line ? lineCells(p).length : 1;
  const sub = p.line ? (n > 1 ? n + ' قطعة · المجموع ' + priceTag(it.price * n) : 'اضغط ثم اسحب من القطعة للطول أو العرض') : 'اسحب القطعة أو اضغط المكان اللي تريده';
  setBar(`<div class="t">${p.mode === 'new' ? esc(it.name) + (n > 1 ? '' : ' ' + priceTag(it.price)) : 'انقل ' + esc(it.name)}</div><div class="s">${sub}</div><button class="w-round no" data-w="pcancel" aria-label="إلغاء">${ICON.no}</button><button class="w-round ok" data-w="pok" aria-label="تأكيد">${ICON.ok}</button>`);
}
async function confirmPlace() {
  const p = G.place; if (!p) return;
  if (p.line) {
    const cells = lineCells(p); let err = null; for (const [cx, cy] of cells) { err = canPlace(p.k, cx, cy); if (err) break; }
    if (err) { wtoast(err); Snd.play('error'); return; }
    if (W.coins < W.items[p.k].price * cells.length) { wtoast('كوينزاتك لا تكفي'); Snd.play('error'); return; }
    const r = await act({ action: 'placeline', k: p.k, cells }); if (!r) return; Snd.play('place');
    const last = cells[cells.length - 1]; p.x = last[0]; p.y = last[1]; p.ex = p.ey = undefined; p.lastN = 0; dirty = true; placeBar(); wtoast('تمت الإضافة'); refreshBadge(); return;
  }
  const err = canPlace(p.k, p.x, p.y, p.id); if (err) { wtoast(err); Snd.play('error'); return; }
  const r = await act(p.mode === 'new' ? { action: 'place', k: p.k, x: p.x, y: p.y } : { action: 'move', id: p.id, x: p.x, y: p.y });
  if (!r) return; Snd.play('place');
  const keep = p.mode === 'new' && ['field', 'fence', 'road'].includes(p.k) && W.coins >= W.items[p.k].price;
  if (keep) { p.x += 0; dirty = true; wtoast('تمت الإضافة'); } else cancelPlace();
  refreshBadge();
}
function cancelPlace() { G.place = null; setBar(''); dirty = true; H.bkDel(cancelPlace); }
function shopSheet(cat) {
  cat = cat || G.cat || W.cats[0].key; G.cat = cat;
  const items = W.itemList.filter(i => i.cat === cat);
  const tabs = W.cats.map(c => `<button class="w-tab ${c.key === cat ? 'on' : ''}" data-w="cat" data-k="${c.key}">${esc(c.name)}</button>`).join('');
  const cards = items.map(i => `<button class="w-card ${W.coins < i.price ? 'dis' : ''}" data-w="buy" data-k="${i.key}"><span class="th">${thumb(i.key)}</span>${esc(i.name)}<small>${i.fw}×${i.fh}${i.prod ? ' · +' + i.prod.coins + ' كل ' + i.prod.min + 'د' : ''}</small>${priceTag(i.price)}</button>`).join('');
  const s = openSheet(`<div class="h"><span>المتجر</span><button class="w-x" data-w="close">${ICON.no}</button></div><div class="w-tabs">${tabs}</div><div class="w-grid">${cards}</div>`);
  const t = s.querySelector('.w-tab.on'); if (t) t.scrollIntoView({ inline: 'center', block: 'nearest' });
}
function setCrop(k) { G.lastCrop = k; try { localStorage.setItem('wcrop', k); } catch (e) { } refreshCrop(); }
function refreshCrop() { const b = document.getElementById('w-crop'); if (!b || !cache.plantURL) return; const k = G.lastCrop || 'wheat'; b.innerHTML = cache.plantURL[k] ? `<img src="${cache.plantURL[k]}" alt="" style="height:36px">` : ICON.all; b.title = W.crops[k].name; }
function cropSheet(fid) {
  const cards = W.cropList.map(c => `<button class="w-card ${W.coins < c.cost ? 'dis' : ''}" data-w="plant" data-k="${c.key}" data-f="${fid}"><span class="th"><img src="${cache.plantURL[c.key]}" alt="" style="max-height:70px"></span>${esc(c.name)}<small>${fmt(c.min * 60)} · ربح ${c.reward - c.cost}</small>${priceTag(c.cost)}</button>`).join('');
  openSheet(`<div class="h"><span>${fid ? 'شنو تزرع؟' : 'المحصول الافتراضي (يتزرع بلمسة)'}</span><button class="w-x" data-w="close">${ICON.no}</button></div><div class="w-grid">${cards}</div><div style="text-align:center"><button class="w-link" data-w="plantall" data-f="${fid}">ازرع النوع المختار بكل الحقول الفارغة</button></div>`);
}
async function plantOne(fid, crop) {
  const r = await act({ action: 'plant', id: +fid, crop }); if (r) { Snd.play('plant'); const o = W.objs.get(+fid); if (o) { const [px, py] = objTop(o); popAt(px, py, '-' + W.crops[crop].cost); } } return r;
}
function unlockSheet(bx, by) {
  openSheet(`<div class="h"><span>فتح أرض جديدة</span><button class="w-x" data-w="close">${ICON.no}</button></div><p style="margin:0 0 14px;font-weight:600">تتوسع مزرعتك بقطعة 10×10 مربع جديدة (فيها غابات وبحيرات لتكتشفها).</p><div style="display:flex;justify-content:center"><button class="w-act gold" style="min-height:52px;font-size:17px" data-w="unlock" data-bx="${bx}" data-by="${by}">فتح ${priceTag(W.unlock_cost)}</button></div>`);
}
function refreshCity() { const b = document.getElementById('w-city'); if (!b) return; b.textContent = W.city ? W.city : 'سمّ مدينتك'; b.classList.toggle('new', !W.city); }
function citySheet() {
  openSheet(`<div class="h"><span>${W.city ? 'غيّر اسم مدينتك' : 'سمّ مدينتك'}</span><button class="w-x" data-w="close">${ICON.no}</button></div><p style="margin:0 0 10px;font-weight:600">اسم فريد ما يتكرر عند أي طالب. من 3 إلى 20 حرف، تكدر تغيّره 3 مرات.</p><input id="w-cityin" class="w-in" maxlength="20" value="${esc(W.city || '')}" placeholder="مثال: مدينة الأوائل" dir="auto"><div id="w-cityerr" style="color:#ff9a9a;min-height:22px;font-weight:700;margin:8px 0"></div><div style="display:flex;justify-content:center"><button class="w-act gold" style="min-height:50px;font-size:16px" data-w="citysave">حفظ الاسم</button></div>`);
  setTimeout(() => { const i = document.getElementById('w-cityin'); if (i) i.focus(); }, 250);
}
async function citySave() {
  const i = document.getElementById('w-cityin'), er = document.getElementById('w-cityerr'); if (!i) return;
  try { const r = await H.api('/api/city', { name: i.value }); W.city = r.name; refreshCity(); closeSheet(); Snd.play('place'); wtoast('مدينة ' + r.name + ' 🌟'); }
  catch (e) { if (er) er.textContent = e.message || 'تعذّر الحفظ'; Snd.play('error'); }
}
function onRootClick(e) {
  const b = e.target.closest('[data-w]'); if (!b) return; const a = b.dataset.w; Snd.play('tap');
  const sel = G.sel && G.sel.t === 'o' ? W.objs.get(G.sel.id) : null;
  switch (a) {
    case 'close': closeSheet(); break;
    case 'cat': shopSheet(b.dataset.k); break;
    case 'buy': { const i = W.items[b.dataset.k]; if (W.coins < i.price) { wtoast('كوينزاتك لا تكفي'); Snd.play('error'); return; } startPlace('new', i.key); break; }
    case 'x': deselect(); break;
    case 'move': if (sel) startPlace('move', sel.k, sel.id, sel.x, sel.y); break;
    case 'sell': if (sel) { const it = W.items[sel.k]; H.ask(`تبيع ${it.name} بـ ${it.price >> 1} كوينز؟`).then(async ok => { if (!ok) return; const r = await act({ action: 'sell', id: sel.id }); if (r) { Snd.play('sell'); deselect(); } }); } break;
    case 'work': if (sel) { deselect(); goWork(sel); } break;
    case 'crops': if (sel) cropSheet(sel.id); break;
    case 'plant': { closeSheet(); setCrop(b.dataset.k); if (b.dataset.f) plantOne(b.dataset.f, b.dataset.k).then(() => deselect()); else wtoast('تم اختيار ' + W.crops[b.dataset.k].name); break; }
    case 'cropdef': cropSheet(''); break;
    case 'city': citySheet(); break;
    case 'citysave': citySave(); break;
    case 'plantall': { const crop = G.lastCrop || 'wheat'; setCrop(crop); closeSheet(); (async () => { for (const o of [...W.objs.values()].filter(o => o.k === 'field' && !o.c)) { if (W.coins < W.crops[crop].cost) { wtoast('خلصت الكوينز'); break; } if (!(await plantOne(o.id, crop))) break; await new Promise(r => setTimeout(r, 90)); } deselect(); })(); break; }
    case 'clear': if (G.sel && G.sel.t === 'n') { const s = G.sel; act({ action: 'clear', x: s.x, y: s.y }).then(r => { if (r) { Snd.play('place'); deselect(); } }); } break;
    case 'unlock': closeSheet(); act({ action: 'unlock', bx: +b.dataset.bx, by: +b.dataset.by }).then(r => { if (r) { Snd.play('unlock'); wtoast('انفتحت أرض جديدة'); } }); break;
    case 'pok': confirmPlace(); break;
    case 'pcancel': cancelPlace(); break;
  }
}

/* ═══ الإدخال (سحب، تكبير، لمس) والحلقة ═══ */
const ptr = new Map(); let gest = null, vel = { x: 0, y: 0 }, zt = 0.8, zAnchor = null, lastMove = 0;
function setSize() { vw = innerWidth; vh = innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); dirty = true; }
const toTile = (sx, sy) => { const px = (sx - vw / 2) / cam.z + cam.x, py = (sy - vh / 2) / cam.z + cam.y; return [(py / HH + px / HW) / 2, (py / HH - px / HW) / 2]; };
const clampCam = () => { cam.x = clamp(cam.x, -500000, 500000); cam.y = clamp(cam.y, -500000, 500000); };
function zoomAt(sx, sy, nz) { zt = clamp(nz, 0.32, 1.7); zAnchor = { sx, sy, wx: (sx - vw / 2) / cam.z + cam.x, wy: (sy - vh / 2) / cam.z + cam.y }; }
function ghostHit(sx, sy) { const p = G.place; if (!p) return null; if (p.line) { const [X, Y] = toTile(sx, sy), ex = p.ex === undefined ? p.x : p.ex, ey = p.ey === undefined ? p.y : p.ey; return ((X >= p.x - .3 && X < p.x + 1.3 && Y >= p.y - .3 && Y < p.y + 1.3) || (X >= ex - .3 && X < ex + 1.3 && Y >= ey - .3 && Y < ey + 1.3)) ? [0, 0] : null; } const [X, Y] = toTile(sx, sy), [fw, fh] = FOOT(p.k); return (X >= p.x - .2 && X < p.x + fw + .2 && Y >= p.y - .2 && Y < p.y + fh + .2) ? [X - p.x, Y - p.y] : null; }
function onDown(e) {
  Snd.init(); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); vel.x = vel.y = 0;
  if (ptr.size === 2) { const [a, b] = [...ptr.values()]; gest = { m: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: cam.z }; zAnchor = null; return; }
  const gh = ghostHit(e.clientX, e.clientY);
  gest = { m: gh ? 'ghost' : 'pan', sx: e.clientX, sy: e.clientY, t0: performance.now(), moved: false, off: gh, lx: e.clientX, ly: e.clientY };
}
function onMove(e) {
  const p = ptr.get(e.pointerId); if (!p) return; const px = p.x, py = p.y; p.x = e.clientX; p.y = e.clientY;
  if (!gest) return;
  if (gest.m === 'pinch' && ptr.size === 2) {
    const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (!gest.wp) gest.wp = [(mx - vw / 2) / cam.z + cam.x, (my - vh / 2) / cam.z + cam.y];
    cam.z = zt = clamp(gest.z0 * d / gest.d0, 0.32, 1.7); cam.x = gest.wp[0] - (mx - vw / 2) / cam.z; cam.y = gest.wp[1] - (my - vh / 2) / cam.z; clampCam(); dirty = true; return;
  }
  if (ptr.size > 1) return;
  const dx = e.clientX - gest.sx, dy = e.clientY - gest.sy;
  if (!gest.moved && Math.hypot(dx, dy) > 7) gest.moved = true;
  if (gest.m === 'ghost' && gest.moved && G.place && G.place.line) {
    const pl = G.place, [X, Y] = toTile(e.clientX, e.clientY), nx = Math.floor(X), ny = Math.floor(Y); if (nx !== pl.ex || ny !== pl.ey) { pl.ex = nx; pl.ey = ny; dirty = true; }
  } else if (gest.m === 'ghost' && gest.moved) {
    const pl = G.place, [X, Y] = toTile(e.clientX, e.clientY), [fw, fh] = FOOT(pl.k), nx = Math.floor(X - gest.off[0] + .5), ny = Math.floor(Y - gest.off[1] + .5);
    if (nx !== pl.x || ny !== pl.y) { pl.x = nx; pl.y = ny; dirty = true; }
  } else if (gest.m === 'pan' && gest.moved) {
    const ddx = (e.clientX - px) / cam.z, ddy = (e.clientY - py) / cam.z, now = performance.now(), dt = Math.max(1, now - lastMove); lastMove = now;
    cam.x -= ddx; cam.y -= ddy; clampCam(); vel.x = vel.x * .6 + (ddx / dt) * .4; vel.y = vel.y * .6 + (ddy / dt) * .4; dirty = true;
  }
}
function onUp(e) {
  ptr.delete(e.pointerId); if (!gest) return;
  if (gest.m === 'pinch') { if (ptr.size < 2) { gest = null; vel.x = vel.y = 0; } return; }
  const g = gest; gest = null;
  if (!g.moved && performance.now() - g.t0 < 500) { onTap(e.clientX, e.clientY); return; }
  if (g.m === 'pan' && performance.now() - lastMove > 90) vel.x = vel.y = 0;
}
function onTap(sx, sy) {
  const [X, Y] = toTile(sx, sy), tx = Math.floor(X), ty = Math.floor(Y);
  if (G.place && G.place.line) { G.place.x = tx; G.place.y = ty; G.place.ex = G.place.ey = undefined; G.place.lastN = 0; placeBar(); dirty = true; Snd.play('tap'); return; }
  if (G.place) { const [fw, fh] = FOOT(G.place.k); G.place.x = tx - ((fw - 1) >> 1); G.place.y = ty - ((fh - 1) >> 1); dirty = true; Snd.play('tap'); return; }
  if (!inb(tx, ty)) { deselect(); return; }
  const bx = Math.floor(tx / 10), by = Math.floor(ty / 10);
  if (!W.lands.has(bx + ',' + by)) {
    deselect(); if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => W.lands.has((bx + a) + ',' + (by + b)))) { Snd.play('tap'); unlockSheet(bx, by); } else wtoast('افتح الأراضي المجاورة أول');
    return;
  }
  const o = W.occ.get(key(tx, ty)); Snd.play('tap');
  if (o) {
    if (o.k === 'field' && !o.c) { const k = G.lastCrop; if (k && W.crops[k] && W.coins >= W.crops[k].cost) { deselect(); plantOne(o.id, k); } else { selectObj(o); cropSheet(o.id); } return; }
    if (isReady(o)) { deselect(); goWork(o); return; }
    selectObj(o); return;
  }
  if (natBlocked(tx, ty)) { selectNat(tx, ty); return; }
  deselect();
}
function onWheel(e) { e.preventDefault(); zoomAt(e.clientX, e.clientY, zt * Math.exp(-e.deltaY * 0.0015)); }
let lastTs = 0, secT = 0;
function loop(ts) {
  raf = requestAnimationFrame(loop); if (!open || !W) return;
  const dt = Math.min(50, ts - (lastTs || ts)); lastTs = ts; let moving = false;
  if (zAnchor && Math.abs(zt - cam.z) > 0.0008) { cam.z += (zt - cam.z) * (1 - Math.exp(-dt / 70)); cam.x = zAnchor.wx - (zAnchor.sx - vw / 2) / cam.z; cam.y = zAnchor.wy - (zAnchor.sy - vh / 2) / cam.z; clampCam(); moving = true; }
  else if (zAnchor) { cam.z = zt; zAnchor = null; }
  if (!gest && (Math.abs(vel.x) > 0.004 || Math.abs(vel.y) > 0.004)) { cam.x -= vel.x * dt; cam.y -= vel.y * dt; clampCam(); const f = Math.exp(-dt / 260); vel.x *= f; vel.y *= f; moving = true; }
  secT += dt; if (secT > 1000) { secT = 0; refreshBadge(); if (G.sel && G.sel.t === 'o') { const o = W.objs.get(G.sel.id); if (o && !G.place) selectObj(o); } }
  const anyReady = (hud.all && !hud.all.hidden) || W.hasAnim;
  if (dirty || moving || G.pops.length || ts - lastDraw > (anyReady ? 34 : 120)) { draw(ts); lastDraw = ts; dirty = false; }
}

/* ═══ فتح وإغلاق ═══ */
async function openWorld(h) {
  if (open) return; H = h; open = true;
  if (!document.getElementById('w-style')) { const st = document.createElement('style'); st.id = 'w-style'; st.textContent = CSS; document.head.appendChild(st); }
  root = document.createElement('div'); root.id = 'world';
  root.innerHTML = `<canvas id="wcv"></canvas><div class="w-top"><button class="w-btn" data-w="back" aria-label="رجوع">${ICON.back}</button><button class="w-btn" id="w-snd" data-w="snd" aria-label="الصوت">${Snd.on ? ICON.snd : ICON.mute}</button><span class="grow"></span><div class="w-coins" id="w-coins">${ICON.coin}<b>0</b></div></div>
  <div class="w-fabs"><button class="w-fab gold sm" id="w-all" hidden aria-label="اجمع الكل" data-w="all">${ICON.all}<span class="w-badge">0</span></button><button class="w-fab sm" id="w-crop" data-w="cropdef" aria-label="المحصول"></button><button class="w-fab sm" data-w="center" aria-label="مركز">${ICON.home}</button><button class="w-fab" data-w="shop" aria-label="المتجر">${ICON.shop}</button></div>
  <button class="w-city" id="w-city" data-w="city"></button><div class="w-bar" id="w-bar"></div><div class="w-toast" id="w-toast"></div><div class="w-load" id="w-load">جاري تحميل العالم…</div>`;
  document.body.appendChild(root);
  cv = root.querySelector('canvas'); cx2 = cv.getContext('2d', { alpha: false });
  hud = { coins: root.querySelector('#w-coins'), bar: root.querySelector('#w-bar'), toast: root.querySelector('#w-toast'), all: root.querySelector('#w-all') };
  setSize(); window.addEventListener('resize', setSize);
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp); cv.addEventListener('wheel', onWheel, { passive: false });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-w]'); if (!b) return; const a = b.dataset.w;
    if (a === 'back') { Snd.play('tap'); H.back(); return; }
    if (a === 'snd') { Snd.set(!Snd.on); b.innerHTML = Snd.on ? ICON.snd : ICON.mute; if (Snd.on) Snd.play('tap'); return; }
    if (a === 'center') { Snd.play('tap'); cam.x = 0; cam.y = 50 * HH * 2 * 0.5 + 0; const c = ctr(50, 50); cam.x = c[0] - 130; cam.y = c[1] - 90; zoomAt(vw / 2, vh / 2, Math.min(0.6, Math.max(0.42, vw / 700))); dirty = true; return; }
    if (a === 'shop') { Snd.play('tap'); shopSheet(); return; }
    if (a === 'all') { Snd.play('tap'); collectAll(); return; }
    onRootClick(e);
  });
  try {
    const [d, ok] = await Promise.all([H.api('/api/world'), loadAtlas()]);
    if (!open) return;
    W = { n: d.n, blocks: new Map(), items: {}, crops: {}, cats: d.catalog.cats, itemList: d.catalog.items, cropList: d.catalog.crops };
    d.catalog.items.forEach(i => W.items[i.key] = i); d.catalog.crops.forEach(c => W.crops[c.key] = c);
    apply(d); W.city = d.city || ''; buildArt(); try { G.lastCrop = localStorage.getItem('wcrop') || ''; } catch (e) { G.lastCrop = ''; } if (!atlas.ok || !spriteBox('fielddirt')) setTimeout(() => { const t = hud.toast; if (t) { t.textContent = 'ملفات الرسم ناقصة: ارفع atlas.png و atlas.json'; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 7000); } }, 1500); cache.plantURL = {}; Object.keys(W.crops).forEach(k => cache.plantURL[k] = cache.plant[k][3].toDataURL()); refreshCrop(); refreshCity(); if (!W.city) setTimeout(() => { if (open && !W.city) citySheet(); }, 900);
    const c = ctr(50, 50); cam.x = c[0] - 130; cam.y = c[1] - 90; cam.z = zt = Math.min(0.6, Math.max(0.42, vw / 700)); G.lastReady = 0; refreshBadge();
    root.querySelector('#w-load').remove(); Snd.ambient(); lastTs = 0; raf = requestAnimationFrame(loop);
  } catch (e) { if (H) H.toast(e.message || 'تعذّر تحميل العالم'); H.back(); }
}
function closeWorld() {
  if (!open) return; open = false; cancelAnimationFrame(raf); clearInterval(Snd.bird); window.removeEventListener('resize', setSize);
  if (root) root.remove(); root = null; W = null; G.sel = null; G.place = null; G.pops = []; ptr.clear(); gest = null; hud = {};
}
window.WorldGame = { open: openWorld, close: closeWorld, isOpen: () => open, _bench: n => { const t = performance.now(); for (let i = 0; i < n; i++) draw(i * 16); return (performance.now() - t) / n; }, _s: () => ({ W, G, cam }) };
})();
