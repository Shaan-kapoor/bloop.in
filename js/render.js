'use strict';
// ══════════════════════════ screen ══════════════════════════
// Portrait-first. The game is drawn 180 logical pixels wide and as tall as
// the phone allows; all DOM UI is sized in the same logical unit (--u).
const $ = id => document.getElementById(id);
const GW = 180, W4 = GW * 4, T = 128, TAU = Math.PI * 2;
let GH = 340;
const cv = $('c'), ctx = cv.getContext('2d');
const fc = document.createElement('canvas'), f = fc.getContext('2d', { willReadFrequently: true });
let out, o32, bgBuf, bgSh, surfArr = new Float32Array(GW);

function fit() {
  const vw = innerWidth, vh = innerHeight, ratio = Math.max(1.6, Math.min(2.2, vh / vw));
  const w = Math.min(vw, vh / ratio), h = w * ratio, st = $('stage');
  st.style.width = w + 'px'; st.style.height = h + 'px';
  document.documentElement.style.setProperty('--u', w / GW + 'px');
  const gh = +new URLSearchParams(location.search).get('gh') || Math.round(GW * ratio);
  if (gh !== GH || !out) { GH = gh; cv.width = fc.width = ax.width = GW; cv.height = fc.height = ax.height = GH; out = ctx.createImageData(GW, GH); o32 = new Uint32Array(out.data.buffer); buildBg(); return true; }
}

// ══════════════════════════ goo renderer ══════════════════════════
// Goo is splatted additively into an offscreen field (one colour channel per
// goo type), then every pixel is shaded from the field's value and slope:
// outline, rim light, shade, deep core, glint, with ordered dither.
function sprite(rgb) {
  const s = document.createElement('canvas'); s.width = s.height = 64;
  const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (let i = 0; i <= 12; i++) { const t = i / 12; gr.addColorStop(t, `rgba(${rgb},${(1 - t * t) ** 2})`); }
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return s;
}
const SPR = [sprite('255,0,0'), sprite('0,255,0'), sprite('0,0,255')], SOLID = ['#f00', '#0f0', '#00f'];
// ch: 0 blue (you, droplets, pool) · 1 violet (pods) · 2 gold
function ball(x, y, r, ch = 0) { if (r <= 0) return; const R = r * 1.85; f.drawImage(SPR[ch], x - R, y - R, R * 2, R * 2); }
function slab(x, y, w, h, ch = 0) { f.fillStyle = SOLID[ch]; f.fillRect(x, y, w, h); }
const abgr = h => { const n = parseInt(h.slice(1), 16); return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; };
// tones: 0 outline, 1 shade, 2 core, 3 body, 4 light, 5 rim, 6 glint
const PAL = [
  ['#0a1a52', '#1f47c9', '#2f6cf0', '#3f8cff', '#74bcff', '#b8e6ff', '#ffffff'],
  ['#1c1147', '#4a35b0', '#5d49cf', '#7a66ea', '#a595ff', '#d6ceff', '#ffffff'],
  ['#4f2f0c', '#d98a1c', '#f2b02c', '#ffc944', '#ffe07a', '#fff3bf', '#ffffff'],
].map(p => p.map(abgr));
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
// Each depth belongs to a zone with its own water and wildlife.
// Per zone: 7 backdrop tones (dark to light), speck colour, far creature colour, near creature colour.
const ZONES = ['the shallows', 'kelp forest', 'jelly gardens', 'open blue', 'the trench', 'moss caves', 'midnight water'];
const ZONE_TINT = ['#5b5ad0', '#49b3c9', '#b877e0', '#5b93e6', '#d970a8', '#4fc9a3', '#8a8ae0'];
const THEMES = [
  ['#07081a', '#0a0b22', '#0d0e2b', '#111235', '#15153f', '#1a1949', '#201e55', '#3a3990', '#2b2a70', '#4c4bb4'],
  ['#04101a', '#061723', '#081f2d', '#0b2838', '#0e3243', '#123d4f', '#17495c', '#2f7f93', '#1c5566', '#3a93a8'],
  ['#12061a', '#190a24', '#200e2e', '#291339', '#321844', '#3c1e50', '#47255d', '#7d4aa0', '#573078', '#9560c0'],
  ['#040a1f', '#06102b', '#081637', '#0b1d44', '#0f2552', '#132e60', '#18386f', '#3766b0', '#234884', '#4a7ccc'],
  ['#1a0611', '#240a18', '#2e0e20', '#391329', '#441833', '#501e3d', '#5d2548', '#a04a78', '#6e3055', '#b85a8c'],
  ['#04130f', '#061b15', '#08241c', '#0b2e24', '#0e392d', '#124537', '#175242', '#2f9377', '#1c6350', '#3fa888'],
  ['#030308', '#05050d', '#070712', '#0a0a19', '#0d0d21', '#11112a', '#161634', '#4a4a8a', '#2a2a58', '#6c6cc0'],
].map(t => t.map(abgr));
let RAMP = THEMES[0], SPECK = THEMES[0][7];
function setTheme(i) { RAMP = THEMES[i]; SPECK = RAMP[7]; if (out) buildBg(); spawnCritters(i); }
function buildBg() {
  bgBuf = new Uint32Array(GW * GH); bgSh = new Uint32Array(GW * GH);
  const bokeh = [[30, GH * .2, 40], [150, GH * .32, 46], [90, GH * .6, 60], [165, GH * .82, 36], [20, GH * .78, 40]];
  for (let y = 0, i = 0; y < GH; y++) for (let x = 0; x < GW; x++, i++) {
    let s = 1.5 + 2.6 * y / GH;
    for (const [bx, by, br] of bokeh) { const d = Math.hypot(x - bx, y - by); if (d < br) s += 1.2 * (1 - d / br); }
    const dx = (x - GW / 2) / (GW / 2), dy = (y - GH / 2) / (GH / 2);
    s -= 1.5 * Math.max(0, dx * dx * .7 + dy * dy - .62);
    s += 1.1 * Math.max(0, Math.sin((x + y * .5) * .05 + 1.2)) ** 3 * Math.max(0, 1 - y / (GH * .7));   // slanted shafts of light from above
    const k = Math.max(0, Math.min(6, Math.floor(s + BAY[(y & 3) << 2 | (x & 3)] / 16)));
    bgBuf[i] = RAMP[k]; bgSh[i] = RAMP[Math.max(0, k - 2)];
  }
}
const specks = [...Array(26)].map(() => ({ x: Math.random() * GW, y: Math.random() * 400, s: 2 + Math.random() * 5 }));
const bubbles = [...Array(6)].map(() => ({ x: Math.random() * GW, y: Math.random() * 400, r: 2 + Math.random() * 4, s: 5 + Math.random() * 8, ph: Math.random() * 6 }));

// ── ASCII wildlife ──
// Creatures are typed out of plain characters and stamped into the backdrop,
// behind the goo. Far ones are dimmer and slower.
const ax = document.createElement('canvas'), actx = ax.getContext('2d', { willReadFrequently: true }), CW = 5, CH = 8;
const MIRROR = { '<': '>', '>': '<', '(': ')', ')': '(', '/': '\\', '\\': '/' };
const art = lines => { const w = Math.max(...lines.map(l => l.length)); return { r: lines, l: lines.map(l => [...l.padEnd(w)].reverse().map(c => MIRROR[c] || c).join('')), w: w * CW }; };
const ART = {
  fish: art(['><>']), bass: art(['><(((">']), school: art(['><>   ><>', '   ><>']),
  whale: art([',   .-""""-.', '|\\_/      o \\', '|/ \\________/']),
  squid: art(['==:::>']), eel: art(['~~~~~~~>']), turtle: art(['~(___)o']), angler: art(['      ,*', '><(((">']),
  crab: art(['V(;,;)V']), jellyA: art([' .-. ', '(   )', ' )|( ']), jellyB: art([' .-. ', '(   )', ' (|) ']),
};
let critters = [];
function spawnCritters(z) {
  const C = critters = [], R0 = (a, b) => a + Math.random() * (b - a);
  const add = (kind, name, n, o = {}) => { for (let k = 0; k < n; k++) { const far = o.far ?? k % 2 === 1; C.push({ kind, name, far, dir: Math.random() < .5 ? 1 : -1, x: R0(0, GW), y: o.y ?? R0(64, GH - 80), v: (o.v || 9) * (far ? .55 : 1) * R0(.7, 1.3), ph: R0(0, 9) }); } };
  const dots = (kind, n) => { for (let k = 0; k < n; k++) C.push({ kind, ch: '+.*'[k % 3], far: k % 2 === 1, x: R0(4, GW - 8), y: R0(30, GH - 40), v: R0(3, 8), ph: R0(0, 9) }); };
  if (z === 0) { add('swim', 'fish', 5); add('swim', 'school', 1, { far: true }); }
  if (z === 1) { [2, 13, 25, 150, 162, 173].forEach((x, k) => C.push({ kind: 'kelp', x, h: 6 + (Math.random() * 9 | 0), far: k % 2 === 1, ph: R0(0, 9) })); add('swim', 'bass', 2); add('swim', 'fish', 2); }
  if (z === 2) { add('jelly', 'jellyA', 5); add('swim', 'fish', 1, { far: true }); }
  if (z === 3) { add('swim', 'whale', 1, { far: true, v: 5, y: GH * .42 }); add('swim', 'school', 2); add('swim', 'fish', 2); }
  if (z === 4) { add('swim', 'squid', 3); add('swim', 'eel', 1, { far: true }); add('crab', 'crab', 1, { far: false, v: 8 }); }
  if (z === 5) { add('swim', 'turtle', 2, { v: 6 }); dots('spore', 9); add('swim', 'fish', 1, { far: true }); }
  if (z === 6) { add('swim', 'angler', 2, { v: 6 }); dots('star', 12); add('swim', 'eel', 1, { far: true }); }
}
function drawCritters(dt) {
  actx.clearRect(0, 0, GW, GH); actx.font = 'bold 8px Menlo, Consolas, monospace'; actx.textBaseline = 'top';
  const put = (lines, x, y, far) => { actx.fillStyle = far ? '#000' : '#fff'; x = Math.round(x); y = Math.round(y); for (let j = 0; j < lines.length; j++) for (let k = 0, s = lines[j]; k < s.length; k++) if (s[k] !== ' ') actx.fillText(s[k], x + k * CW, y + j * CH); };
  for (const c of critters) {
    if (c.kind === 'swim') {
      const a = ART[c.name]; c.x += c.dir * c.v * dt;
      if (c.x > GW + 8) { c.x = -a.w - 8; c.y = 64 + Math.random() * (GH - 150); } else if (c.x < -a.w - 8) { c.x = GW + 8; c.y = 64 + Math.random() * (GH - 150); }
      put(c.dir > 0 ? a.r : a.l, c.x, c.y + Math.sin(now * 1.2 + c.ph) * 2, c.far);
    } else if (c.kind === 'jelly') {
      c.y -= c.v * .5 * dt; if (c.y < 14) { c.y = GH - 30; c.x = Math.random() * (GW - 24); }
      put(ART[Math.sin(now * 2 + c.ph) > 0 ? 'jellyA' : 'jellyB'].r, c.x + Math.sin(now * .7 + c.ph) * 4, c.y, c.far);
    } else if (c.kind === 'kelp') {
      for (let j = 0; j < c.h; j++) put([(j + (now * 1.4 + c.ph | 0)) % 2 ? '(' : ')'], c.x + Math.sin(now * 1.1 + j * .6 + c.ph) * 1.6, GH - 16 - j * CH, c.far);
    } else if (c.kind === 'crab') {   // rides the pool like a tiny raft
      c.x += c.dir * c.v * dt; if (c.x < 4 || c.x > GW - 40) c.dir *= -1;
      if (pool) put(ART.crab.r, c.x, pool.top(c.x + 17) - 8, false);
    } else if (c.kind === 'spore') {
      c.y -= c.v * dt; if (c.y < 20) { c.y = GH - 20; c.x = 4 + Math.random() * (GW - 12); }
      put([c.ch], c.x + Math.sin(now + c.ph) * 3, c.y, c.far);
    } else if (Math.sin(now * 1.5 + c.ph) > -.3) put([c.ch], c.x, c.y, c.far);   // stars twinkle
  }
}
let surf = false; const orbs = [];
const orb = (x, y, R) => orbs.push({ x, y, R, R2: R * R });

function render(dt) {
  const d = f.getImageData(0, 0, GW, GH).data, W = GW, H = GH;
  o32.set(bgBuf);
  for (const s of specks) { s.y -= s.s * dt; if (s.y < 0) { s.y = H - 1; s.x = Math.random() * W; } if (s.y < H) o32[(s.y | 0) * W + (s.x | 0)] = SPECK; }
  for (const b of bubbles) {   // slow bubbles drifting up behind everything
    b.y -= b.s * dt; if (b.y < -8) { b.y = H + 8; b.x = Math.random() * W; }
    const bx = b.x + Math.sin(now * .8 + b.ph) * 3, n = 8 + (b.r * 2 | 0);
    for (let k = 0; k < n; k++) { const a = k / n * TAU, px = bx + Math.cos(a) * b.r | 0, py = b.y + Math.sin(a) * b.r | 0; if (px >= 0 && px < W && py >= 0 && py < H) o32[py * W + px] = SPECK; }
  }
  if (critters.length) {
    drawCritters(dt); const a = actx.getImageData(0, 0, W, H).data, near = RAMP[9], far = RAMP[8];
    for (let i = 0, n = W * H; i < n; i++) if (a[i * 4 + 3] > 84) o32[i] = a[i * 4] > 128 ? near : far;
  }
  const sh = (3 * W + 2) * 4;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const p = i << 2; let c = -1, m = T - 1;
    if (d[p] > m) { c = 0; m = d[p]; }
    if (d[p + 1] > m) { c = 1; m = d[p + 1]; }
    if (d[p + 2] > m) { c = 2; }
    if (c < 0) {
      let o = -1, q;
      if (x > 0) { q = p - 4; if (d[q] >= T) o = 0; else if (d[q + 1] >= T) o = 1; else if (d[q + 2] >= T) o = 2; }
      if (o < 0 && x < W - 1) { q = p + 4; if (d[q] >= T) o = 0; else if (d[q + 1] >= T) o = 1; else if (d[q + 2] >= T) o = 2; }
      if (o < 0 && y > 0) { q = p - W4; if (d[q] >= T) o = 0; else if (d[q + 1] >= T) o = 1; else if (d[q + 2] >= T) o = 2; }
      if (o < 0 && y < H - 1) { q = p + W4; if (d[q] >= T) o = 0; else if (d[q + 1] >= T) o = 1; else if (d[q + 2] >= T) o = 2; }
      if (o >= 0) o32[i] = PAL[o][0];
      else if (x >= 2 && y >= 3) { q = p - sh; if (d[q] >= T || d[q + 1] >= T || d[q + 2] >= T) o32[i] = bgSh[i]; }
      continue;
    }
    const pc = p + c, v = d[pc], P = PAL[c], dz = BAY[(y & 3) << 2 | (x & 3)] / 16 - .5;
    const gx = (x < W - 2 ? d[pc + 8] : v) - (x > 1 ? d[pc - 8] : v);
    const gy = (y < H - 2 ? d[pc + 2 * W4] : v) - (y > 1 ? d[pc - 2 * W4] : v);
    const b = (.6 * gx + .8 * gy) / (Math.sqrt(gx * gx + gy * gy) + 20) + dz * .28;
    let t = 3;
    if (b > .5) t = v < T + 40 ? 5 : v < T + 105 ? 4 : 3;
    else if (b > .12) t = v < T + 55 ? 4 : 3;
    else if (b < -.45) t = v < T + 80 ? 1 : 3;
    else if (b < -.1 && v < T + 30) t = 1;
    if (t === 3 && v >= 253) t = 2;
    if (b > .74 && v > T + 52 && v < T + 92) t = 6;
    if (t === 3 || t === 2) {
      if (c === 0 && surf && y - surfArr[x] > 2) { const dd = y - surfArr[x] + dz * 7; t = dd < 7 ? 4 : dd < 17 ? 3 : dd < 36 ? 2 : 1; }
      else for (const o of orbs) {
        const dx = x - o.x, dy = y - o.y;
        if (dx * dx + dy * dy < o.R2) {
          const nd = (-.6 * dx - .8 * dy) / o.R + dz * .3;
          t = nd > .52 ? 4 : nd > .02 ? 3 : nd > -.5 ? 2 : 1;
          const hx = dx + .36 * o.R, hy = dy + .42 * o.R, hr = .2 * o.R;
          if (hx * hx + hy * hy * 1.6 < hr * hr) t = 6;
          break;
        }
      }
    }
    o32[i] = P[t];
  }
  ctx.putImageData(out, 0, 0);
}

// tiny pixel helpers drawn on top of the goo
function eyes(x, y, s, lx = 0, ly = 0, blink = false, wide = false) {
  const w = Math.max(1, Math.round(s)), h = blink ? 1 : Math.max(2, Math.round(s * (wide ? 2.1 : 1.6))), gap = Math.max(2, Math.round(s * 2.4));
  const ex = Math.round(x + lx), ey = Math.round(y + ly - h / 2);
  ctx.fillStyle = '#0a1a52';
  ctx.fillRect(ex - gap / 2 - w | 0, ey, w, h); ctx.fillRect(ex + gap / 2 | 0, ey, w, h);
}
const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
function num(x, y, n, color) {
  const s = String(n), w = s.length * 4 - 1; let ox = Math.round(x - w / 2); const oy = Math.round(y - 2.5);
  ctx.fillStyle = color;
  for (const ch of s) { const g = DIG[+ch]; for (let k = 0; k < 15; k++) if (g[k] === '1') ctx.fillRect(ox + k % 3, oy + (k / 3 | 0), 1, 1); ox += 4; }
}
function ring(x, y, r, color) {
  ctx.fillStyle = color; const n = Math.max(10, r * 1.5 | 0);
  for (let i = 0; i < n; i += 2) { const a = i / n * TAU; ctx.fillRect(x + Math.cos(a) * r | 0, y + Math.sin(a) * r | 0, 1, 1); }
}

