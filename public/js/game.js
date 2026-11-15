'use strict';
// ══════════════════════════ save + upgrades ══════════════════════════
const SAVE = 'bloopin.save.v2';
let S = { goo: 0, layer: 1, deep: 1, best: 0, rounds: 0, pearls: 0, read: 0, hearts: 0, intro: 0, id: '', name: '', pals: 0, boss: null, up: {}, seen: {}, sure: {} };
if (!BOT) try { const j = JSON.parse(localStorage.getItem(SAVE)); if (j && j.up) S = Object.assign(S, j); opt = Object.assign(opt, S.opt); } catch (_) {}
S.deep = Math.max(S.deep || 1, S.layer);
if (S.rounds > 0) S.intro = 1;   // anyone who has already played keeps their dive and skips the opening
const save = () => { if (BOT) return; try { S.opt = opt; localStorage.setItem(SAVE, JSON.stringify(S)); } catch (_) {} };
const lv = id => S.up[id] || 0, pal = i => (S.pals || 0) > i;   // pal(i): has grump i been woken and come along

// Every upgrade changes something you can see on the board. New ones are
// revealed as you reach new depths. cat: what it acts on (drop / pod / goo).
const pct = v => Math.round(v * 100) + '%', mulText = v => '×' + (v < 100 ? v.toFixed(2).replace(/\.?0+$/, '') : fmt(v));
const UP = [   // fx(level) is the short "what you have now" label shown on the upgrade tile
  { id: 'drops',  cat: 'drop', name: 'more drops',     desc: 'one more drop every round',              fx: l => 3 + l + ' drops',                           max: 7,  cost: 8,     grow: 2.7 },
  { id: 'power',  cat: 'pod',  name: 'punch',          desc: 'hit harder, pod numbers shrink',         fx: l => mulText(1.4 ** l) + ' hit',                 max: 99, cost: 12,    grow: 2.15 },
  { id: 'rich',   cat: 'goo',  name: 'rich goo',       desc: 'every droplet is worth more',            fx: l => mulText(1.25 ** l) + ' goo',                max: 99, cost: 15,    grow: 2.2 },
  { id: 'bounce', cat: 'drop', name: 'bouncy',         desc: 'bounce higher, last more hits',          fx: l => 5 + 2 * l + ' hits',                        max: 4,  cost: 10,    grow: 3 },
  { id: 'splash', cat: 'pod',  name: 'splash',         desc: 'popped pods hurt their neighbours',      fx: l => l ? 'reach ' + l : 'off',                   max: 5,  cost: 30,    grow: 3.4 },
  { id: 'fat',    cat: 'drop', name: 'fat drop',       desc: 'a bigger drop is harder to miss with',   fx: l => 'size ' + (l + 1),                          max: 4,  cost: 120,   grow: 3.2, depth: 2 },
  { id: 'aim',    cat: 'drop', name: 'long sight',     desc: 'see further along your shot',            fx: l => ['short', 'long', 'far'][l] || 'far',       max: 2,  cost: 90,    grow: 6,   depth: 2 },
  { id: 'twin',   cat: 'drop', name: 'twins',          desc: 'a drop splits on its first hit',         fx: l => l ? 'into ' + (l + 1) : 'off',              max: 3,  cost: 400,   grow: 6,   depth: 4 },
  { id: 'combo',  cat: 'goo',  name: 'rhythm',         desc: 'long combos turn the goo to gold',       fx: l => l ? 'up to ' + mulText(1 + .8 * l) : 'off', max: 5,  cost: 2500,  grow: 3.2, depth: 6 },
  { id: 'skip',   cat: 'drop', name: 'skipping stone', desc: 'drops skip back off the pool',           fx: l => l + (l === 1 ? ' skip' : ' skips'),         max: 3,  cost: 15000, grow: 6,   depth: 8 },
  { id: 'gold',   cat: 'goo',  name: 'gold pods',      desc: 'gold pods worth 8× appear',              fx: l => l ? pct(.03 * l) + ' gold' : 'none',        max: 5,  cost: 9e4,   grow: 3.2, depth: 10 },
  { id: 'leak',   cat: 'drop', name: 'dribble',        desc: 'oom dribbles free little drops',        fx: l => l * 3 + ' drips',                           max: 4,  cost: 1.2e6, grow: 4,   depth: 13 },
  { id: 'tad',    cat: 'pod',  name: 'tadpoles',       desc: 'popped pods can hatch a mini drop',      fx: l => pct(.06 * l) + ' hatch',                    max: 5,  cost: 1.8e7, grow: 3.5, depth: 16 },
  { id: 'bomb',   cat: 'pod',  name: 'boom pods',      desc: 'pods that blow up everything near',      fx: l => l + (l === 1 ? ' pod' : ' pods'),           max: 3,  cost: 2.5e8, grow: 5,   depth: 19 },
  { id: 'heavy',  cat: 'drop', name: 'heavy',          desc: 'plough straight through the first pods', fx: l => 'through ' + l * 2,                         max: 3,  cost: 3.5e9, grow: 6,   depth: 22 },
];
const cost = u => Math.round(u.cost * (u.id === 'power' && +params.get('pg') || u.id === 'rich' && +params.get('rg') || u.grow) ** lv(u.id));
const open = u => S.layer >= (u.depth || 1);
const dmgNow = () => 1.4 ** lv('power');
const richMul = () => 1.25 ** lv('rich') * (1 + .5 * S.pearls) * (pal(2) ? 1.3 : 1);
const HPG = +params.get('hpg') || 1.7, layerVal = L => 1.6 ** (L - 1);
// pods toughen fastest over the early depths, while new tricks are still arriving
const EX = +params.get('ex') || 1, hpBase = L => { const t = clamp((L - 2) / 12, 0, 1); return HPG ** (L - 1) * (1 + (EX - 1) * t * t * (3 - 2 * t)); };
const hits = p => Math.max(1, Math.ceil(p.hp / dmgNow() - 1e-6));
const pearlsFor = L => L < 8 ? 0 : Math.floor((L - 6) ** 1.3);

// ── the grumps ──
// Every fifth depth, a pod that has napped far too long is in the way. It is
// not popped in one round: whatever you knock off stays off. Every few drops
// it yawns, and the spot is marked a drop ahead. A drop that lands in the yawn
// counts triple and earns a big drop; a yawn nobody answers ends in a huff
// that costs Oom a drop. Wake a grump and it comes along for good, bringing
// one trick of its own.
const ring6 = [0, 1, 2, 3, 4, 5].map(i => [Math.cos(i * TAU / 6) * .84, Math.sin(i * TAU / 6) * .84, .26]);
const GRUMPS = [
  { name: 'grum',  gift: 'throws two little drops',  ring: 5, every: 2, lumps: [[-.6, -.62, .3], [.6, -.62, .3]] },
  { name: 'snorl', gift: 'drops last two more hits', ring: 7, every: 2, regrow: 1, lumps: [[0, -.85, .28], [-.85, .1, .28], [.85, .1, .28]] },
  { name: 'glug',  gift: 'all goo is richer',        ring: 5, every: 2, slurp: 1, tilt: 1, lumps: [[-.7, .25, .4], [.7, .25, .4]] },
  { name: 'hush',  gift: 'first drop is a big one',  ring: 6, every: 2, shy: 1, tilt: 1, lumps: [[0, -.9, .22], [-.32, -.82, .2], [.32, -.82, .2]] },
  { name: 'knot',  gift: 'combos hold longer',       ring: 9, every: 2, regrow: 1, shy: 1, tilt: 1, lumps: [[-.6, -.6, .28], [.6, -.6, .28], [-.6, .6, .28], [.6, .6, .28]] },
  { name: 'dooze', gift: 'one more drop',            ring: 8, every: 1, regrow: 1, slurp: 1, shy: 1, tilt: 1, lumps: ring6 },
];
const grumpAt = L => L % 5 ? null : GRUMPS[(L / 5 - 1) % GRUMPS.length];
const BHP = +params.get('bhp') || 14, RING = 42, bossPay = () => 30 * layerVal(S.layer) * richMul() * 1.6;
const dropR = big => (4 + lv('fat') * .7) * (big ? 1.5 : 1);

// ── Oom ──
// The oldest drop there is: one wide dome hanging from the top of the world,
// far too big to fall. Every drop you let go is a little of it. The grumps it
// has woken sit in the corners and watch.
const oom = { sag: 0, v: 0, wince: 0, joy: 0, strain: 0, sleep: false, nap: false, look: 0, lookY: 0 };
const palX = k => k % 2 ? GW - 13 - (k >> 1) * 14 : 13 + (k >> 1) * 14, palY = k => 51 + Math.sin(now * 1.7 + k) * 1;
const oomX = () => LX + Math.sin(now * 38) * oom.strain * 1.2;
function oomStep(dt) {
  oom.v += (-130 * oom.sag - 8 * oom.v) * dt; oom.sag += oom.v * dt;
  oom.wince = Math.max(0, oom.wince - dt); oom.joy = Math.max(0, oom.joy - dt); oom.strain = Math.max(0, oom.strain - dt * 1.1);
  oom.sleep = oom.nap || titleOn || R.state === 'shop';
  const tb = R.balls.find(b => !b.mini), on = aim && !aim.cancel, tx = tb ? clamp((tb.x - LX) / 40, -1, 1) : on ? Math.cos(aim.a) : 0;
  oom.look += (tx - oom.look) * Math.min(1, dt * 8); oom.lookY += (1 - oom.lookY) * Math.min(1, dt * 6);
}
function drawOom() {
  const s = oom.sag * .5, x = oomX();
  ball(x, 4 + s, 40 + Math.sin(now * 1.2) * .6); orb(x, 22 + s, 46);
  for (let k = 0; k < (S.pals || 0); k++) { const a = palX(k), b = palY(k); ball(a, b, 4.6, 1); for (const [dx, dy, q] of GRUMPS[k].lumps) ball(a + dx * 4.6, b + dy * 4.6, 4.6 * q + .5, 1); orb(a, b, 6); }
}
const px = (x, y, pts) => { for (const [a, b] of pts) ctx.fillRect(x + a, y + b, 1, 1); };
const SHUT_L = [[0, 0], [1, 1], [0, 2]], SHUT_R = [[1, 0], [0, 1], [1, 2]], GLAD = [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2]], ZED = [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]];
function zeds(x, y, c) { ctx.fillStyle = c; for (let k = 0; k < 2; k++) { const t = (now * .45 + k * .5) % 1; if (t < .85) px(Math.round(x + t * 11), Math.round(y - t * 13), ZED); } }
function oomFace() {
  const x = Math.round(oomX() + oom.look * 2), y = Math.round(30 + oom.sag * .5), ly = Math.round(oom.lookY);
  ctx.fillStyle = '#0a1a52';
  if (oom.wince > 0) { px(x - 12, y, SHUT_L); px(x + 10, y, SHUT_R); ctx.fillRect(x - 3, y + 9, 2, 1); ctx.fillRect(x - 1, y + 8, 2, 1); ctx.fillRect(x + 1, y + 9, 2, 1); }
  else if (oom.joy > 0) { px(x - 13, y, GLAD); px(x + 8, y, GLAD); ctx.fillRect(x - 3, y + 9, 6, 1); ctx.fillRect(x - 4, y + 8, 1, 1); ctx.fillRect(x + 3, y + 8, 1, 1); }
  else if (oom.sleep || now % 4.3 < .14) { ctx.fillRect(x - 13, y + 2, 5, 1); ctx.fillRect(x + 8, y + 2, 5, 1); ctx.fillRect(x - 1, y + 8, 2, 1 + (oom.sleep && Math.sin(now * 1.2) > 0 ? 1 : 0)); }
  else {
    ctx.fillRect(x - 12, y + ly, 3, 4); ctx.fillRect(x + 9, y + ly, 3, 4);
    if (aim && !aim.cancel && R.state === 'play') ctx.fillRect(x - 1, y + 8, 2, 2); else { ctx.fillRect(x - 2, y + 9, 4, 1); ctx.fillRect(x - 3, y + 8, 1, 1); ctx.fillRect(x + 2, y + 8, 1, 1); }
    ctx.fillStyle = '#b8e6ff'; ctx.fillRect(x - 12, y + ly, 1, 1); ctx.fillRect(x + 9, y + ly, 1, 1);
  }
  if (oom.sleep) zeds(LX + 22, 47, '#b8e6ff');
  ctx.fillStyle = '#1c1147'; for (let k = 0; k < (S.pals || 0); k++) { const a = Math.round(palX(k)), b = Math.round(palY(k)); ctx.fillRect(a - 2, b - 1, 1, 2); ctx.fillRect(a + 1, b - 1, 1, 2); }
}
function grumpFace(p) {
  const x = Math.round(p.x + p.ox), y = Math.round(p.y + p.oy), r = p.r, e = Math.max(4, Math.round(r * .4)), ey = y - Math.round(r * .22), my = y + Math.round(r * .4), ink = '#1c1147';
  const mx = Math.round(x + Math.sin(p.ma) * r * .62), mY = Math.round(y - Math.cos(p.ma) * r * .62);   // where it yawns: the spot a drop has to land on
  ctx.fillStyle = ink;
  if (p.phase === 2) {   // the yawn: eyes squeezed shut either side of a wide open mouth
    const w = Math.max(4, Math.round(r * .3)), h = Math.max(3, Math.round(r * .26)), cx = Math.cos(p.ma) * (w + 4), sy = Math.sin(p.ma) * (w + 4);
    for (let j = -h; j <= h; j++) { const a = Math.round(w * Math.sqrt(1 - j * j / (h * h + 1))); ctx.fillRect(mx - a, mY + j, a * 2, 1); }
    px(Math.round(mx - cx) - 1, Math.round(mY - sy) - 1, SHUT_L); px(Math.round(mx + cx) - 1, Math.round(mY + sy) - 1, SHUT_R);
    ctx.fillStyle = '#4a35b0'; ctx.fillRect(mx - w + 2, mY + h - 2, w * 2 - 4, 2);
    ctx.fillStyle = '#fff3bf'; for (let k = 0; k < 6; k++) { const a = now * 3 + k * TAU / 6; ctx.fillRect(Math.round(mx + Math.cos(a) * (w + 2)), Math.round(mY + Math.sin(a) * (h + 2)), 1, 1); }
    return;
  }
  if (p.hurt > 0) { px(x - e - 1, ey - 1, SHUT_L); px(x + e - 1, ey - 1, SHUT_R); }
  else if (!p.awake) { ctx.fillRect(x - e - 2, ey, 4, 1); ctx.fillRect(x + e - 2, ey, 4, 1); zeds(x + r * .7, y - r * .8, '#d6ceff'); ctx.fillStyle = ink; }
  else for (const sx of [-1, 1]) {   // cross little eyes under a heavy brow
    const ex = x + sx * e; ctx.fillRect(ex - 1, ey - 1, 3, 3); ctx.fillRect(ex + sx - 1, ey - 4, 3, 1); ctx.fillRect(ex - sx - 1, ey - 3, 2, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(ex + (LX < p.x - 6 ? -1 : LX > p.x + 6 ? 1 : 0), ey - 1, 1, 1); ctx.fillStyle = ink;
  }
  if (p.phase === 1) {   // a yawn is coming, and this is where
    ctx.fillRect(x - 1, my - 1, 2, 2);
    ctx.fillStyle = (now * 6 | 0) & 1 ? '#fff3bf' : '#ffc944'; for (let k = 0; k < 4; k++) { const a = now * 2 + k * TAU / 4; ctx.fillRect(Math.round(mx + Math.cos(a) * 5), Math.round(mY + Math.sin(a) * 4), 1, 1); }
  } else if (p.awake) { ctx.fillRect(x - 2, my, 4, 1); ctx.fillRect(x - 3, my + 1, 1, 1); ctx.fillRect(x + 2, my + 1, 1, 1); }
  else ctx.fillRect(x - 1, my, 2, 1);
}

// ══════════════════════════ the round ══════════════════════════
const LX = GW / 2, LY = 46, SPEED = 235, GRAV = 270, STEP = 1 / 120;
let R = null, pool = null, aim = null, aimId = null, held = false;

function makePool() {
  const n = GW / 4 + 1;
  return {
    n, h: new Float32Array(n), v: new Float32Array(n), base: 12,
    update(dt, depth) {
      const { h, v } = this; this.base += (depth - this.base) * Math.min(1, dt * 4);
      for (let i = 0; i < n; i++) { const l = i ? h[i - 1] : h[i], r = i < n - 1 ? h[i + 1] : h[i]; v[i] += (-50 * h[i] + 260 * (l + r - 2 * h[i]) - 1.8 * v[i]) * dt; }
      for (let i = 0; i < n; i++) h[i] = clamp(h[i] + v[i] * dt, -this.base + 3, 26);
    },
    top(x) { const q = clamp(x / 4, 0, n - 1.001), i = q | 0, t = q - i; return GH - this.base - (this.h[i] * (1 - t) + this.h[i + 1] * t); },
    splash(x, pow) { const c = Math.round(x / 4); for (let k = -3; k <= 3; k++) { const i = c + k; if (i >= 0 && i < n) this.v[i] -= pow * (1 - Math.abs(k) / 4); } },
    draw() { for (let x = 0; x < GW; x += 2) { const y = this.top(x + 1) + Math.sin(now * 1.6 + x * .09) * .7; slab(x, y, 2, GH - y + 1); surfArr[x] = surfArr[x + 1] = y; } },
  };
}
const podR = h => 5.4 + Math.min(h, 4) * .5;   // capped so there is always a gap to aim through
const maxDrops = () => 3 + lv('drops') + (pal(5) ? 1 : 0);
const wearMax = () => 5 + 2 * lv('bounce') + (pal(1) ? 2 : 0);   // how many knocks a drop can give before it is spent
const fieldValue = () => R.pods.reduce((a, p) => a + (p.dead ? 0 : p.rel * (p.type === 'gold' ? 16 : 1)), 0) * layerVal(S.layer) * richMul() * 1.6;
function genBoss(G) {
  const L = S.layer, top = Math.max(80, Math.round((GH - 12) / 2 - 76)), cy = top + 72, pods = [];
  const b = mkPod(GW / 2, cy, 30, L, 'boss', 0), fr = S.boss && S.boss.L === L ? S.boss.f : 1;
  const full = hpBase(L) * BHP * (L >= 30 ? .5 : L >= 20 ? .7 : 1);   // late drops get fewer knocks on one big target, so the deep grumps are a little softer
  Object.assign(b, { max: full, hp: full * fr, boss: G, r: 12 + 12 * fr, hp0: full * fr, tx: b.x, charge: G.every - 1, phase: 0, ma: 0, stun: 0, hurt: 0, awake: fr < 1 }); pods.push(b);
  for (let i = 0; i < G.ring; i++) { const p = mkPod(0, 0, .7, L, '', i); p.g = 1; p.ang = p.ta = i / G.ring * TAU + .3; pods.push(p); }
  for (const sx of [-1, 1]) for (const dy of [-46, 0, 46]) { const p = mkPod(GW / 2 + sx * 70, cy + dy, .8, L, '', 2); p.g = 1; pods.push(p); }
  placeRing(pods, 0);
  for (const p of pods) if (p.g && Math.random() < .03 * lv('gold')) toType(p, 'gold');
  return pods;
}
function placeRing(pods, dt) { const b = pods[0]; for (const p of pods) if (p.ang != null) { p.ang += (p.ta - p.ang) * Math.min(1, dt * 9); p.x = b.x + Math.cos(p.ang) * RING; p.y = b.y + Math.sin(p.ang) * RING * .92; } }
const mkPod = (x, y, rel, L, type, r) => { const hp = hpBase(L) * rel; return { x, y, hp, max: hp, rel, r: 6, type, s: 0, sv: 0, ox: 0, oy: 0, vx: 0, vy: 0, born: -(r * .035 + Math.random() * .12), ph: Math.random() * 9 }; };
function toType(p, type) { p.type = type; p.rel = .5; p.hp = p.max = .5 * hpBase(S.layer); p.sv += 16; R && R.rings.push({ x: p.x, y: p.y, r: 4, life: .35, c: '#fff3bf' }); }

// The field is always 9 rows tall whatever the phone, so every screen plays the same board.
function genField() {
  const G = grumpAt(S.layer); if (G) return genBoss(G);
  const L = S.layer, rows = 9, top = Math.max(80, Math.round((GH - 12) / 2 - 76)), bot = top + 136, cy = (top + bot) / 2, pods = [], mask = L === 1 ? 5 : (L - 2) % 5;
  for (let r = 0; r < rows; r++) for (let c = 0; c < 8; c++) {
    const x = 20 + c * 20 + (r & 1 ? 10 : 0), y = top + r * 17; if (x > GW - 14) continue;
    const nx = (x - GW / 2) / (GW / 2 - 14), ny = (y - cy) / 68, rr = Math.hypot(nx, ny);
    const keep = mask === 5 ? Math.abs(nx) + Math.abs(ny) < .66 : mask === 0 ? rr > .45 && rr < 1.02 : mask === 1 ? Math.abs(nx) + Math.abs(ny) < .95
      : mask === 2 ? Math.abs(Math.abs(nx) - Math.abs(ny)) < .34 : mask === 3 ? (r + c) % 3 !== 0 : Math.abs(nx) > .3 && Math.abs(nx) < .92 && Math.abs(ny) < .85;
    if (keep) pods.push(mkPod(x + rnd(-1, 1), y + rnd(-1, 1), .55 + Math.random() ** 2.5 * (L === 1 ? .6 : 1.1), L, '', r));
  }
  const plain = () => pods.filter(p => !p.type), pick = a => a[Math.random() * a.length | 0];
  for (const p of pods) if (Math.random() < .03 * lv('gold')) toType(p, 'gold');
  if (lv('gold') && !pods.some(p => p.type === 'gold')) toType(pick(plain()), 'gold');
  for (let k = 0; k < lv('bomb'); k++) { const p = pick(plain()); if (p) toType(p, 'bomb'); }
  return pods;
}

// A new board is laid out as soon as the last round is banked, so it sits
// behind the upgrade sheet and every purchase can show up on it straight away.
function newRound(prev) {
  R = null; const pods = genField();
  R = { state: 'play', prev, t: 0, pods, balls: [], drops: [], bits: [], rings: [], sparks: [], queue: [], total: pods.filter(p => !p.g).length, boss: pods.find(p => p.boss) || null, turn: 0, big: pal(3), huff: null, popped: 0, left: maxDrops(), haul: 0, got: 0,
        combo: 0, comboT: 0, best: 0, plops: 0, cool: .5, slow: 0, freeze: 0, endT: 0, leakT: 1.5, leaks: 0, src: null, cleared: false, chance: false, shots: 0, sinceShot: 0, mulTier: 0, pending: null, value: 1 };
  R.value = fieldValue();
  if (!pool) pool = makePool();
  aim = null; aimId = null;
  if (prev) {
    const can = UP.some(u => open(u) && lv(u.id) < u.max && cost(u) <= S.goo), news = UP.some(u => u.depth && open(u) && !S.seen[u.id]);
    if (BOT || can || news || prev.cleared || S.read < notesOpen()) R.state = 'shop'; else popup(GW / 2, GH * .42, '+' + fmt(prev.got), 'big');
  }
  ui.round(); if (R.state === 'shop') ui.shop(); else if (desk) ui.shop(true);   // on desktop the upgrade panel is always in view
}
function startPlay() {
  for (const u of UP) if (open(u)) S.seen[u.id] = 1;
  R.state = 'play'; R.cool = .3; R.left = maxDrops(); R.value = fieldValue(); save(); ui.round();
}

function addBall(x, y, vx, vy, o = {}) {
  const mini = !!o.mini, r = mini ? 2.6 : dropR(o.big);
  R.balls.push({ x, y, vx, vy, r, dmg: dmgNow() * (mini ? .5 : o.big ? 3 : 1), mini, plough: mini ? 0 : lv('heavy') * 2, lastP: null, leak: !!o.leak, wear: o.wear || (mini ? 3 : wearMax()), split: mini || !!o.split, skips: mini ? 0 : lv('skip'), hits: 0, age: 0, slowT: 0, sq: 0, trail: 0 });
}
function fire(a) {
  if (R.state !== 'play' || R.left <= 0 || R.cool > 0) return false;
  R.left--; R.shots++; R.cool = .22; R.sinceShot = 0;
  addBall(LX + Math.cos(a) * 8, LY + Math.sin(a) * 8, Math.cos(a) * SPEED, Math.sin(a) * SPEED, { big: R.big });
  oom.v -= R.big ? 120 : 60; R.big = false;
  const p = R.boss;
  if (p && !p.dead) {   // one drop of warning, then the mouth opens as the next drop leaves
    R.turn++;
    if (p.phase === 1) { p.phase = 2; sfx.near(); }
    else if (!p.phase && !p.stun && ++p.charge >= p.boss.every) { p.phase = 1; p.ma = p.boss.tilt ? [-.8, 0, .8][Math.random() * 3 | 0] : 0; popup(p.x, p.y - p.r - 9, 'a yawn is coming', 'gold'); }
    p.stun = 0;
  }
  sfx.fire(); buzz(8); ui.pips(); $('hint').classList.remove('on');
  return true;
}

function bitsBurst(x, y, n, speed, ch, up) {
  if (R.bits.length > 170) return;
  for (let i = 0; i < n; i++) {
    const a = up ? rnd(-Math.PI * .85, -Math.PI * .15) : rnd(0, TAU), v = rnd(.4, 1) * speed;
    R.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd(1.4, 2.6), ch, g: 300, shrink: 4.5 });
  }
}
function damage(p, dmg, nx = 0, ny = 0) {
  if (p.dead) return;
  if (p.boss) return hurtBoss(p, dmg, nx, ny);
  p.hp -= dmg; p.sv += 9; p.vx += nx * 60; p.vy += ny * 60;
  if (p.hp <= 0) popPod(p); else bitsBurst(p.x, p.y, 2, 50, p.type === 'gold' ? 2 : 1);
}
// A hit knocks goo off the grump: what you see fall is what it has lost, and it is yours.
function hurtBoss(p, dmg, nx, ny) {
  const u = R.src, crit = p.phase === 2 && u && !u.mini && -nx * Math.sin(p.ma) + ny * Math.cos(p.ma) > .8; if (crit) dmg *= 3;   // only a real drop, and only in the mouth
  const dealt = Math.min(p.hp, dmg), n = clamp(Math.round(dealt / p.max * 70), 1, 6), each = Math.max(1, Math.round(bossPay() * dealt / p.max / n));
  const hx = p.x - nx * p.r, hy = p.y - ny * p.r;
  p.hp -= dealt; p.sv += 5; p.vx += nx * 30; p.vy += ny * 30; p.hurt = .3; p.touched = true; p.awake = true;
  for (let i = 0; i < n; i++) R.drops.push({ x: hx + rnd(-2, 2), y: hy + rnd(-2, 2), vx: -nx * rnd(30, 90) + rnd(-30, 30), vy: -ny * rnd(30, 90) - rnd(20, 70), val: each, ch: 1, r: 2.2 });
  bitsBurst(hx, hy, 3, 70, 1);
  if (crit) {   // right in the yawn: it splutters, and Oom gets a big one ready
    p.phase = 0; p.charge = 0; p.stun = 1; R.left++; R.big = true; R.freeze = .07; oom.joy = 1.2; shake(4); buzz([10, 30, 20]);
    popup(p.x, p.y - p.r - 10, 'right in the yawn!', 'gold'); R.rings.push({ x: p.x, y: p.y, r: p.r, life: .4, c: '#fff3bf', grow: 90 }); sfx.split(); ui.pips();
  }
  if (p.hp <= p.max * 1e-6) wakeBoss(p);
  ui.bar();
}
function wakeBoss(p) {
  const G = p.boss, bonus = Math.round(bossPay() * (1 + .15 * R.left)), i = GRUMPS.indexOf(G), fresh = !pal(i);
  p.dead = true; p.hp = 0; R.popped = R.total; R.cleared = true; R.left = 0; R.big = false; R.huff = null; R.slow = 1.6; R.freeze = .14; S.boss = null; oom.joy = 3;
  for (let i = 0; i < 40; i++) { const a = rnd(0, TAU), v = rnd(40, 170), d = rnd(0, p.r); R.drops.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, val: Math.ceil(bonus / 40), ch: i % 4 ? 1 : 2, r: rnd(2, 3.2), eye: i % 3 === 0 }); }
  for (const q of R.pods) if (q.g && !q.dead) R.queue.push({ t: .15 + Math.random() * .5, x: q.x, y: q.y, rad: 1, dmg: q.hp + 1, pm: 0 });
  R.rings.push({ x: p.x, y: p.y, r: p.r, life: .5, c: '#d6ceff', grow: 120 }); bitsBurst(p.x, p.y, 14, 160, 1);
  if (fresh) S.pals = i + 1; else S.pearls++;   // a grump you already travel with leaves a pearl instead
  if (!BOT) setTimeout(() => { popup(GW / 2, GH * .44, fresh ? G.name + ' comes along' : 'a pearl from ' + G.name, 'gold'); if (fresh) popup(GW / 2, GH * .44 + 12, G.gift, ''); }, 1600);
  toast(G.name.toUpperCase() + '\nIS AWAKE'); sfx.clear(); shake(7); buzz([30, 40, 30, 40, 80]); ui.pips();
}
// Once your own drops are done the ring turns, so the aim line never lies about a shot you have not taken.
function bossTurn(p) {
  const G = p.boss, ring = R.pods.filter(q => q.ang != null), n = Math.min(R.turn, 3); R.turn = 0;
  for (const q of ring) q.ta += n * TAU / G.ring / 2;
  if (G.regrow) for (let k = 0; k < n; k++) { const q = ring.find(q => q.dead); if (q) { q.dead = false; q.hp = q.max; q.born = 0; q.s = 0; } }
  if (G.shy) p.tx = GW / 2 + [-10, 0, 10].filter(v => Math.abs(GW / 2 + v - p.tx) > 1)[Math.random() * 2 | 0];
  if (G.slurp && !p.touched && p.hp < p.hp0) {   // left alone, it sips the pool and dozes off a little, never past where this round began
    p.hp = Math.min(p.hp0, p.hp + p.max * .03); p.sv += 8; popup(p.x, p.y - p.r - 8, 'slurp', ''); sfx.sink(p.x, true); ui.bar();
    for (let i = 0; i < 8; i++) R.bits.push({ x: p.x + rnd(-20, 20), y: pool.top(p.x) - 2, vx: 0, vy: -rnd(120, 200), r: 2.4, ch: 0, shrink: 3 });
  }
  p.touched = false; if (R.left > 0) R.cool = Math.max(R.cool, .45);
}
function popPod(p) {
  p.dead = true; if (!p.g) R.popped++; R.combo++; R.comboT = pal(4) ? 2.2 : 1.4; R.best = Math.max(R.best, R.combo);
  const gold = p.type === 'gold', n = clamp(Math.round(p.rel * 2.4), 1, 4);
  const mul = 1 + Math.min(R.combo, 40) * .02 * lv('combo'), tier = Math.floor((mul - 1) / .5);
  if (tier > R.mulTier) { R.mulTier = tier; popup(GW / 2, GH * .22, 'goo ×' + (1 + tier * .5).toFixed(1), 'gold'); }
  const each = Math.max(1, Math.round(layerVal(S.layer) * richMul() * p.rel * (gold ? 16 : 1) / n * mul * 1.6));
  for (let i = 0; i < n; i++) R.drops.push({ x: p.x + rnd(-2, 2), y: p.y + rnd(-2, 2), vx: rnd(-55, 55), vy: rnd(-120, -30), val: each, big: gold, ch: gold || tier > 0 ? 2 : 0, r: gold ? 2.8 : 1.9 + Math.min(1.1, lv('rich') * .07) });
  bitsBurst(p.x, p.y, 5, 80, gold ? 2 : 1);
  for (let i = 0; i < 4; i++) { const a = rnd(0, TAU), v = rnd(40, 110); R.sparks.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: rnd(.25, .5) }); }
  R.rings.push({ x: p.x, y: p.y, r: p.r, life: .32, c: gold ? '#ffe07a' : '#d6ceff' });
  sfx.pop(R.combo, p.x, gold); buzz(5); ui.combo();
  if (R.combo > 5) { shake(Math.min(2.5, R.combo * .05)); oom.joy = Math.max(oom.joy, .8); }   // chains rumble harder the longer they run
  if (gold) popup(p.x, p.y - 8, 'gold!', 'gold');
  if (lv('splash')) R.queue.push({ t: .075, x: p.x, y: p.y, rad: 13 + lv('splash') * 4.5, dmg: dmgNow() * .6, pm: .02 * lv('splash') });
  if (p.type === 'bomb') { R.queue.push({ t: .05, x: p.x, y: p.y, rad: 40, dmg: dmgNow() * 5, pm: .5, boom: true }); R.freeze = .06; }
  if (lv('tad') && !(R.src && R.src.mini) && (S.sure.tad || Math.random() < .06 * lv('tad'))) { delete S.sure.tad; addBall(p.x, p.y, rnd(-70, 70), -rnd(90, 150), { mini: true }); }
  const rem = R.total - R.popped;
  if (rem > 0 && rem <= 2 && R.total > 6 && R.balls.length) { popup(GW / 2, GH * .3, rem + ' LEFT!', 'big'); R.slow = Math.max(R.slow, .4); }
  if (rem === 0 && !R.cleared) {   // every pod gone in one round: go deeper
    R.cleared = true; R.slow = 1.2;
    const bonus = Math.round(R.value * (.5 + .15 * R.left)); R.left = 0;
    for (let i = 0; i < 14; i++) R.drops.push({ x: rnd(10, GW - 10), y: rnd(60, GH * .5), vx: rnd(-40, 40), vy: rnd(-90, 0), val: Math.ceil(bonus / 14), ch: 2, r: 2.6 });
    oom.joy = 3; toast(`DEPTH ${S.layer}\nCLEARED`); sfx.clear(); shake(5); buzz([20, 40, 20, 40, 60]); ui.pips();
  }
  ui.bar();
}

// One fixed physics step. The aim preview runs the very same code, so the dots tell the truth.
function stepBall(b, dt, live) {
  b.vy += GRAV * dt; b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * .8; } else if (b.x > GW - b.r) { b.x = GW - b.r; b.vx = -Math.abs(b.vx) * .8; }
  if (b.y < b.r + 22) { b.y = b.r + 22; b.vy = Math.abs(b.vy) * .6; }
  const e = .6 + .07 * lv('bounce');
  for (const p of R.pods) {
    if (p.dead || p.born < .1) continue;
    const dx = b.x - p.x, dy = b.y - p.y, rr = b.r + p.r; if (dx * dx + dy * dy >= rr * rr) continue;
    const d = Math.hypot(dx, dy) || .01, nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
    if (live && (b.plough > 0 || b.lastP === p) && p.type !== 'bomb' && !p.boss) {   // heavy: straight through, hurting as it goes
      if (b.lastP !== p) { b.lastP = p; b.plough--; hitPod(b, p, nx, ny); b.vx *= .92; b.vy *= .92; }
      continue;
    }
    b.x = p.x + nx * rr; b.y = p.y + ny * rr;
    if (vn < 0) {
      b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
      const o = b.vx * nx + b.vy * ny; if (o < 22) { b.vx += nx * (22 - o); b.vy += ny * (22 - o); }
      if (vn > -30) continue;   // a soft touch just slides off; only a real knock counts
      if (live) hitPod(b, p, nx, ny); else return true;
    }
  }
  const sp = Math.hypot(b.vx, b.vy); if (sp > 430) { b.vx *= 430 / sp; b.vy *= 430 / sp; }
}
function hitPod(b, p, nx, ny) {
  b.hits++; b.sq = 1; b.wear--;
  if (p.hp > b.dmg) { R.combo++; R.comboT = pal(4) ? 2.2 : 1.4; R.best = Math.max(R.best, R.combo); sfx.hit(R.combo, p.x); ui.combo(); }
  R.src = b; damage(p, b.dmg, -nx, -ny); R.src = null;
  if (!b.split && lv('twin')) {
    b.split = true; const sp = Math.hypot(b.vx, b.vy), a0 = Math.atan2(b.vy, b.vx);
    for (let k = 1; k <= lv('twin'); k++) { const a = a0 + (k % 2 ? 1 : -1) * .5 * Math.ceil(k / 2); addBall(b.x, b.y, Math.cos(a) * sp, Math.sin(a) * sp, { split: true, wear: Math.max(2, Math.ceil(b.wear / 2)) }); }
    R.rings.push({ x: b.x, y: b.y, r: 4, life: .3, c: '#b8e6ff' }); sfx.split();
  }
}

function update(rdt) {
  now += rdt; if (titleOn) logoT += rdt;
  if (!R) return;
  oomStep(rdt);
  if (R.freeze > 0) { R.freeze -= rdt; return; }
  let dt = rdt; if (R.slow > 0) { R.slow -= rdt; dt *= .3; }
  R.t += dt; R.cool -= dt; R.sinceShot += dt;
  if ((R.comboT -= dt) <= 0 && R.combo) { R.combo = 0; ui.combo(); }
  if (R.pending != null && R.cool <= 0) { fire(R.pending); R.pending = null; }

  for (const p of R.pods) {
    p.born += dt; p.sv += (-260 * p.s - 9 * p.sv) * dt; p.s += p.sv * dt * .1;
    p.vx += (-300 * p.ox - 10 * p.vx) * dt; p.vy += (-300 * p.oy - 10 * p.vy) * dt; p.ox += p.vx * dt; p.oy += p.vy * dt;
    p.r += ((p.boss ? 12 + 12 * p.hp / p.max : podR(hits(p)) + (p.type === 'bomb' ? 1 : 0)) - p.r) * Math.min(1, dt * 12);
  }
  if (R.boss && !R.boss.dead) {
    const p = R.boss, busy = R.balls.some(b => !b.mini); p.hurt -= dt; p.x += (p.tx - p.x) * Math.min(1, dt * 9); placeRing(R.pods, dt);
    if (p.phase === 2 && !busy && R.sinceShot > .3) { p.phase = 0; p.charge = 0; p.sv += 14; R.huff = { x: p.x + Math.sin(p.ma) * p.r, y: p.y - Math.cos(p.ma) * p.r, t: 0 }; sfx.fizz(); }   // nobody answered the yawn
    if (R.turn && !busy && !R.queue.length && R.sinceShot > .3 && R.state === 'play') bossTurn(p);
    if (R.huff) {   // the huff drifts up and knocks a drop out of Oom
      const h = R.huff; h.t += dt / .7; h.x += (LX - h.x) * Math.min(1, dt * 5); h.y += (46 - h.y) * Math.min(1, dt * 5);
      if (h.t >= 1) { R.huff = null; oom.wince = .9; oom.v = -150; shake(4); sfx.sink(LX, true); buzz(25); bitsBurst(LX, 46, 6, 90, 1); if (R.left > 0) { R.left--; popup(LX, 64, '−1 drop', ''); ui.pips(); } }
    }
  }
  for (const q of R.queue) if ((q.t -= dt) <= 0) {
    q.done = true; R.rings.push({ x: q.x, y: q.y, r: q.rad * .5, life: .25, c: q.boom ? '#fff3bf' : '#74bcff', grow: q.rad * 2.4 });
    if (q.boom) { shake(6); sfx.boom(); buzz(30); bitsBurst(q.x, q.y, 12, 150, 2); }
    for (const p of R.pods) if (!p.dead) { const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy); if (d < q.rad + p.r * .5) damage(p, q.dmg + (p.boss ? 0 : p.max * q.pm), dx / (d || 1), dy / (d || 1)); }
  }
  R.queue = R.queue.filter(q => !q.done);

  // once the round is under way grum throws its two little drops, and then Oom dribbles a few more
  if (R.state === 'play' && R.shots > 0 && R.popped < R.total && R.leaks < lv('leak') * 3 + (pal(0) ? 2 : 0) && (R.leakT -= dt) <= 0) {
    const k = R.leaks++; R.leakT = .9; sfx.plop(R.leaks, LX);
    if (pal(0) && k < 2) addBall(palX(0), palY(0) + 4, rnd(20, 70), -40, { mini: true, leak: true }); else addBall(LX, LY + 6, rnd(-80, 80), 30, { mini: true, leak: true });
  }

  for (const b of R.balls) {
    b.age += dt; b.sq = Math.max(0, b.sq - dt * 6);
    for (let k = Math.max(1, Math.round(dt / STEP)); k > 0; k--) stepBall(b, STEP, true);
    if ((b.trail -= dt) <= 0 && R.bits.length < 170) { b.trail = .03; R.bits.push({ x: b.x, y: b.y, vx: 0, vy: 0, r: b.r * .6, ch: 0, shrink: 9 }); }
    b.slowT = Math.hypot(b.vx, b.vy) < 45 ? b.slowT + dt : 0;
    if (b.slowT > 1.1 || b.age > 14 || b.wear <= 0) { b.dead = true; bitsBurst(b.x, b.y, 5, 70, 0); sfx.fizz(); continue; }   // a drop that settles melts away
    if (b.y > pool.top(b.x) - b.r * .3 && b.vy > 0) {
      if (b.skips > 0) {
        b.skips--; b.wear = Math.max(b.wear, Math.ceil(wearMax() / 2)); b.vy = -Math.max(200, b.vy * .9); pool.splash(b.x, 120); bitsBurst(b.x, pool.top(b.x), 6, 110, 0, true);
        R.rings.push({ x: b.x, y: pool.top(b.x), r: 5, life: .3, c: '#b8e6ff' }); sfx.skip(); buzz(10);
      } else { b.dead = true; pool.splash(b.x, 90); bitsBurst(b.x, pool.top(b.x), b.mini ? 2 : 5, 90, 0, true); sfx.sink(b.x, !b.mini); }
    }
  }
  for (const b of R.balls) if (b.dead && !b.mini && !b.split && !b.hits) oom.wince = .7;   // Oom feels a miss
  R.balls = R.balls.filter(b => !b.dead);

  for (const d of R.drops) {
    d.vy += 300 * dt; d.vx *= 1 - dt; d.x += d.vx * dt; d.y += d.vy * dt;
    if (d.x < 2) { d.x = 2; d.vx = Math.abs(d.vx); } else if (d.x > GW - 2) { d.x = GW - 2; d.vx = -Math.abs(d.vx); }
    if (d.y > pool.top(d.x) && d.vy > 0) {
      d.dead = true; R.haul += d.val; R.got += d.val; pool.splash(d.x, 16);
      if (!d.mute) sfx.plop(R.plops++, d.x);
      if (d.big) popup(d.x, pool.top(d.x) - 8, '+' + fmt(d.val), 'gold');
    }
  }
  R.drops = R.drops.filter(d => !d.dead);
  for (const b of R.bits) { if (b.g) b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.r -= dt * b.shrink; if (b.vy > 0 && b.y > pool.top(clamp(b.x, 0, GW - 1)) + 2) b.r = 0; }
  R.bits = R.bits.filter(b => b.r > .4);
  for (const s of R.sparks) { s.life -= dt; s.vy += 160 * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
  R.sparks = R.sparks.filter(s => s.life > 0);
  for (const r of R.rings) { r.life -= dt; r.r += (r.grow || 40) * dt; }
  R.rings = R.rings.filter(r => r.life > 0);
  pool.update(dt, 12 + 54 * (1 - Math.exp(-1.6 * R.haul / Math.max(1, R.value))));

  if (R.state === 'play') {
    const idle = !R.balls.length && !R.drops.length && !R.queue.length && !R.huff;
    if (R.left === 0 && idle && R.pending == null) {
      if ((R.endT += dt) > .4) {
        if (!R.cleared && !R.chance && (R.boss ? 1 - R.boss.hp / R.boss.max : R.popped / R.total) >= .9) {   // so close: one more drop, once
          R.chance = true; R.left = 1; R.cool = .35; R.endT = 0; toast('LAST\nCHANCE'); sfx.near(); buzz([15, 30, 15]); ui.pips();
        } else { R.state = 'tally'; R.rate = Math.max(1, R.haul) / .8; R.tick = 0; }
      }
    } else R.endT = 0;
  } else if (R.state === 'tally') {
    const amt = Math.min(R.haul, R.rate * dt); R.haul -= amt; S.goo += amt;
    if ((R.tick -= dt) <= 0 && amt > 0) { R.tick = .05; sfx.tick(R.plops++); }
    if (R.haul <= .001) {
      S.goo = Math.round(S.goo); S.rounds++;
      const bf = R.boss && !R.boss.dead ? R.boss.hp / R.boss.max : 0;
      const prev = { got: R.got, pct: Math.round((R.boss ? 1 - bf : R.popped / R.total) * 100), left: R.total - R.popped, cleared: R.cleared, combo: R.best, total: R.total, boss: R.boss && R.boss.boss.name };
      if (R.cleared) { S.layer++; S.best = 0; S.deep = Math.max(S.deep, S.layer); netDive(); } else { S.best = Math.max(S.best, prev.pct); if (R.boss) S.boss = { L: S.layer, f: bf }; }
      save(); newRound(prev);
    }
  }
}

// ── the wordmark, made of goo ──
// Each letter is a few strokes laid down as a row of small balls, so the name
// shades, merges and sways like everything else. The dot is Bloop.
let titleOn = !BOT, logoT = 0;
const LOGO = (() => {
  const pts = [], k = 1.15, cx = 59.5;
  const line = (g, x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1.4); for (let i = 0; i <= n; i++) pts.push({ g, x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }); };
  const arc = (g, x, y, r, a0, a1) => { const n = Math.ceil(Math.abs(a1 - a0) * r / 1.4); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push({ g, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r }); } };
  line(0, 0, -22, 0, 0); arc(0, 6, -6, 6, 0, TAU);                                          // b
  line(1, 20, -22, 20, 0);                                                                  // l
  arc(2, 34, -6, 6, 0, TAU);                                                                // o
  arc(3, 54, -6, 6, 0, TAU);                                                                // o
  line(4, 68, -12, 68, 9); arc(4, 74, -6, 6, 0, TAU);                                       // p
  line(6, 101, -12, 101, 0); pts.push({ g: 6, x: 101, y: -18.5, r: 2.8 });                  // i
  line(7, 109, -12, 109, 0); arc(7, 114, -7, 5, Math.PI, TAU); line(7, 119, -7, 119, 0);    // n
  for (const p of pts) { p.x = (p.x - cx) * k; p.y *= k; }
  return { pts, dot: { g: 5, x: (90.5 - cx) * k, y: -3.6 * k } };
})();
// where a ball of the wordmark is right now: letters drop in one after another, then sway
function logoXY(p) {
  const t = logoT - .3 - p.g * .09, fall = t < 0 ? 1 : Math.max(0, 1 - t / .45) ** 2;
  return [GW / 2 + p.x, GH * .43 + p.y - fall * GH * .55 + Math.sin(now * 2 + p.x * .07) * .8];
}
function bloopXY() { const [x, y] = logoXY(LOGO.dot), h = now % 3.4; return [x, y - (h < .45 ? Math.sin(h / .45 * Math.PI) * 10 : 0)]; }   // Bloop can't sit still
function drawLogo() {
  for (const p of LOGO.pts) { const [x, y] = logoXY(p); if (y > -4) ball(x, y, p.r || 2.1); }
  const [x, y] = bloopXY(); if (y > -6) { ball(x, y, 4.4); orb(x, y, 5.6); }
}
function logoPost() { const [x, y] = bloopXY(); if (y > 0) eyes(x, y - .5, 1, 0, 0, now % 3.6 < .13); }
// the name lets go and rains into the pool; Bloop jumps in after it
function dropLogo() {
  if (!titleOn) return;
  for (const p of LOGO.pts) { const [x, y] = logoXY(p); R.drops.push({ x, y, vx: rnd(-16, 16), vy: rnd(-60, 0) - p.g * 7, val: 0, ch: 0, r: 2, mute: Math.random() < .75 }); }
  const [x, y] = bloopXY(); addBall(x, y, rnd(-15, 15), -130);
  for (const p of R.pods) p.born = -(1.1 + Math.random() * .6);
  titleOn = false;
}

function draw() {
  surf = true; pool.draw();
  if (titleOn) drawLogo();
  for (const p of titleOn ? [] : R.pods) {
    if (p.dead) continue;
    const k = clamp(p.born / .18, 0, 1), r = p.r * (1 + p.s) * (k < 1 ? k * (1.3 - .3 * k) : 1); if (r <= 0) continue;
    const pulse = p.type === 'bomb' ? Math.sin(now * 7) * .6 : p.phase === 2 ? 1.6 + Math.sin(now * 8) * .8 : p.phase === 1 ? Math.sin(now * 10) * .7 : 0;
    ball(p.x + p.ox, p.y + p.oy, r + pulse, p.type === 'gold' ? 2 : 1);
    if (p.boss) for (const [dx, dy, s] of p.boss.lumps) ball(p.x + p.ox + dx * r, p.y + p.oy + dy * r, r * s, 1);
    if (r > 5) orb(p.x + p.ox, p.y + p.oy, p.boss ? r * 1.25 : r + 1.5, !!p.boss);
  }
  for (const d of R.drops) { ball(d.x, d.y, d.r, d.ch); ball(d.x - d.vx * .02, d.y - d.vy * .02, d.r * .6, d.ch); }
  for (const b of R.bits) ball(b.x, b.y, b.r, b.ch);
  for (const b of R.balls) {
    const r = b.r * (b.mini ? 1 : .62 + .38 * Math.min(1, b.wear / wearMax()));   // a drop thins as it spends itself
    ball(b.x, b.y, r + b.sq * .8); ball(b.x - b.vx * .012, b.y - b.vy * .012, r * .75);
    if (r > 3.2) orb(b.x, b.y, r + 1.5);
  }
  if (R.huff) { ball(R.huff.x, R.huff.y, 4.5, 1); ball(R.huff.x, R.huff.y + 5, 2.5, 1); }
  drawOom();   // the next drop buds from its chin
  if (R.left > 0 && R.state !== 'tally' && !titleOn) {
    const on = aim && !aim.cancel, grow = clamp(1 - R.cool / .22, .2, 1), a = on ? aim.a : Math.PI / 2, st = on ? 3 : 1 + Math.sin(now * 3) * .8;
    const r = dropR(R.big) * grow, hy = LY + 2 + oom.sag;
    ball(LX + Math.cos(a) * st, hy + Math.sin(a) * st, r); ball(LX, hy - 3, r * .7);
    orb(LX + Math.cos(a) * st, hy + Math.sin(a) * st, r + 1.5);
  }
}
function preview(a, bright) {   // dotted path of a shot at angle a
  const g = { x: LX + Math.cos(a) * 8, y: LY + Math.sin(a) * 8, vx: Math.cos(a) * SPEED, vy: Math.sin(a) * SPEED, r: dropR(R.big), plough: 0 };
  let after = -1; const steps = 90 + lv('aim') * 60, extra = 8 + lv('aim') * 26;
  for (let i = 0; i < steps; i++) {
    if (stepBall(g, STEP, false) && after < 0) after = i;
    if (after >= 0 && i - after > extra) break;
    if (g.y > pool.top(g.x)) break;
    if (i % 5 === (now * 24 | 0) % 5) { const big = i < 30 && after < 0 ? 2 : 1; ctx.fillStyle = after >= 0 ? '#74bcff' : bright ? '#ffffff' : '#8f8cd0'; ctx.fillRect(g.x | 0, g.y | 0, big, big); }
  }
}
function post() {
  const tb = R.balls[0];
  {   // the moon, resting on the water
    const mx = GW * .74, my = pool.top(mx) + 6; ctx.fillStyle = '#eef6ff'; ctx.globalAlpha = .55;
    for (let j = -3; j <= 3; j++) { const w = Math.sqrt(12 - j * j) * 1.5, o = Math.sin(now * 1.7 + j * 1.4) * 1.3; ctx.fillRect(Math.round(mx - w + o), Math.round(my + j), Math.round(w * 2), 1); }
    ctx.globalAlpha = 1;
  }
  for (const p of R.pods) {
    if (titleOn || p.dead || p.born < .18) continue; const x = Math.round(p.x + p.ox), y = Math.round(p.y + p.oy);
    if (p.boss) { grumpFace(p); continue; }
    if (p.type === 'bomb') { ctx.fillStyle = (now * 4 | 0) & 1 ? '#fff' : '#ffc944'; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 1, y - 1, 3, 3); continue; }
    const h = hits(p);
    if (h > 1) num(x + .5, y + .5, Math.min(99, h), p.type === 'gold' ? '#4f2f0c' : '#1c1147');
    else {   // one-hit pods get a sleepy little face that watches the drop
      const lx = tb ? clamp((tb.x - x) / 30, -1, 1) | 0 : 0, sq = Math.abs(p.sv) > 3 || (now + p.ph) % 4.2 < .13;
      ctx.fillStyle = p.type === 'gold' ? '#4f2f0c' : '#1c1147';
      ctx.fillRect(x - 2 + lx, y - (sq ? 0 : 1), 1, sq ? 1 : 2); ctx.fillRect(x + 1 + lx, y - (sq ? 0 : 1), 1, sq ? 1 : 2);
    }
  }
  ctx.fillStyle = '#1c1147'; for (const d of R.drops) if (d.eye) { ctx.fillRect(d.x - 2 | 0, d.y - 1 | 0, 1, 2); ctx.fillRect(d.x + 1 | 0, d.y - 1 | 0, 1, 2); }
  oomFace();
  if (titleOn) logoPost();
  for (const r of R.rings) ring(r.x, r.y, r.r, r.c);
  for (const s of R.sparks) { ctx.fillStyle = s.life > .2 ? '#ffffff' : '#b8e6ff'; ctx.fillRect(s.x | 0, s.y | 0, 1, 1); if (s.life > .3) { ctx.fillRect(s.x - 1 | 0, s.y | 0, 3, 1); ctx.fillRect(s.x | 0, s.y - 1 | 0, 1, 3); } }
  for (const b of R.balls) if (!b.mini) eyes(b.x, b.y - .5, 1, clamp(b.vx * .01, -1, 1), clamp(b.vy * .006, -1, 1), false);
  if (R.left > 0 && R.state !== 'tally' && !titleOn) {
    const on = aim && !aim.cancel, a = on ? aim.a : Math.PI / 2; eyes(LX + Math.cos(a) * 2, LY + 1.5 + oom.sag + Math.sin(a) * 2, 1, 0, 0, now % 3.6 < .13, on);
    if (R.state === 'play') {
      if (on) preview(aim.a, true);
      else if (!aim && S.rounds === 0 && R.shots === 0) preview(Math.PI / 2 + Math.sin(now * 1.3) * .75, false);   // show a newcomer what aiming does
    }
  }
}

