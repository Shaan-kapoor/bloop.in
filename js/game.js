'use strict';
// ══════════════════════════ save + upgrades ══════════════════════════
const SAVE = 'bloopin.save.v2';
let S = { goo: 0, layer: 1, deep: 1, best: 0, rounds: 0, pearls: 0, read: 0, hearts: 0, intro: 0, id: '', name: '', up: {}, seen: {}, sure: {} };
if (!BOT) try { const j = JSON.parse(localStorage.getItem(SAVE)); if (j && j.up) S = Object.assign(S, j); opt = Object.assign(opt, S.opt); } catch (_) {}
S.deep = Math.max(S.deep || 1, S.layer);
const save = () => { if (BOT) return; try { S.opt = opt; localStorage.setItem(SAVE, JSON.stringify(S)); } catch (_) {} };
const lv = id => S.up[id] || 0;

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
  { id: 'leak',   cat: 'drop', name: 'leaky tap',      desc: 'the tap drips free little drops',        fx: l => l * 3 + ' drips',                           max: 4,  cost: 1.2e6, grow: 4,   depth: 13 },
  { id: 'tad',    cat: 'pod',  name: 'tadpoles',       desc: 'popped pods can hatch a mini drop',      fx: l => pct(.06 * l) + ' hatch',                    max: 5,  cost: 1.8e7, grow: 3.5, depth: 16 },
  { id: 'bomb',   cat: 'pod',  name: 'boom pods',      desc: 'pods that blow up everything near',      fx: l => l + (l === 1 ? ' pod' : ' pods'),           max: 3,  cost: 2.5e8, grow: 5,   depth: 19 },
  { id: 'heavy',  cat: 'drop', name: 'heavy',          desc: 'plough straight through the first pods', fx: l => 'through ' + l * 2,                         max: 3,  cost: 3.5e9, grow: 6,   depth: 22 },
];
const cost = u => Math.round(u.cost * (u.id === 'power' && +params.get('pg') || u.id === 'rich' && +params.get('rg') || u.grow) ** lv(u.id));
const open = u => S.layer >= (u.depth || 1);
const dmgNow = () => 1.4 ** lv('power');
const richMul = () => 1.25 ** lv('rich') * (1 + .5 * S.pearls);
const HPG = +params.get('hpg') || 1.7, layerVal = L => 1.6 ** (L - 1);
// pods toughen fastest over the early depths, while new tricks are still arriving
const EX = +params.get('ex') || 1, hpBase = L => { const t = clamp((L - 2) / 12, 0, 1); return HPG ** (L - 1) * (1 + (EX - 1) * t * t * (3 - 2 * t)); };
const hits = p => Math.max(1, Math.ceil(p.hp / dmgNow() - 1e-6));
const pearlsFor = L => L < 8 ? 0 : Math.floor((L - 6) ** 1.3);

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
const maxDrops = () => 3 + lv('drops');
const wearMax = () => 5 + 2 * lv('bounce');   // how many knocks a drop can give before it is spent
const fieldValue = () => R.pods.reduce((a, p) => a + (p.dead ? 0 : p.rel * (p.type === 'gold' ? 16 : 1)), 0) * layerVal(S.layer) * richMul() * 1.6;
const mkPod = (x, y, rel, L, type, r) => { const hp = hpBase(L) * rel; return { x, y, hp, max: hp, rel, r: 6, type, s: 0, sv: 0, ox: 0, oy: 0, vx: 0, vy: 0, born: -(r * .035 + Math.random() * .12), ph: Math.random() * 9 }; };
function toType(p, type) { p.type = type; p.rel = .5; p.hp = p.max = .5 * hpBase(S.layer); p.sv += 16; R && R.rings.push({ x: p.x, y: p.y, r: 4, life: .35, c: '#fff3bf' }); }

// The field is always 9 rows tall whatever the phone, so every screen plays the same board.
function genField() {
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
  R = { state: 'play', prev, t: 0, pods, balls: [], drops: [], bits: [], rings: [], sparks: [], queue: [], total: pods.length, popped: 0, left: maxDrops(), haul: 0, got: 0,
        combo: 0, comboT: 0, best: 0, plops: 0, cool: .5, slow: 0, freeze: 0, endT: 0, leakT: 1.5, leaks: 0, src: null, cleared: false, chance: false, shots: 0, sinceShot: 0, mulTier: 0, pending: null, value: 1 };
  R.value = fieldValue();
  if (!pool) pool = makePool();
  aim = null; aimId = null;
  if (prev) {
    const can = UP.some(u => open(u) && lv(u.id) < u.max && cost(u) <= S.goo), news = UP.some(u => u.depth && open(u) && !S.seen[u.id]);
    if (BOT || can || news || prev.cleared || S.read < notesOpen()) R.state = 'shop'; else popup(GW / 2, GH * .42, '+' + fmt(prev.got), 'big');
  }
  ui.round(); if (R.state === 'shop') ui.shop();
}
function startPlay() {
  for (const u of UP) if (open(u)) S.seen[u.id] = 1;
  R.state = 'play'; R.cool = .3; R.left = maxDrops(); R.value = fieldValue(); save(); ui.round();
}

function addBall(x, y, vx, vy, o = {}) {
  const mini = !!o.mini, r = mini ? 2.6 : 4 + lv('fat') * .7;
  R.balls.push({ x, y, vx, vy, r, dmg: dmgNow() * (mini ? .5 : 1), mini, plough: mini ? 0 : lv('heavy') * 2, lastP: null, leak: !!o.leak, wear: o.wear || (mini ? 3 : wearMax()), split: mini || !!o.split, skips: mini ? 0 : lv('skip'), hits: 0, age: 0, slowT: 0, sq: 0, trail: 0 });
}
function fire(a) {
  if (R.state !== 'play' || R.left <= 0 || R.cool > 0) return false;
  R.left--; R.shots++; R.cool = .22; R.sinceShot = 0;
  addBall(LX + Math.cos(a) * 8, LY + Math.sin(a) * 8, Math.cos(a) * SPEED, Math.sin(a) * SPEED);
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
  p.hp -= dmg; p.sv += 9; p.vx += nx * 60; p.vy += ny * 60;
  if (p.hp <= 0) popPod(p); else bitsBurst(p.x, p.y, 2, 50, p.type === 'gold' ? 2 : 1);
}
function popPod(p) {
  p.dead = true; R.popped++; R.combo++; R.comboT = 1.4; R.best = Math.max(R.best, R.combo);
  const gold = p.type === 'gold', n = clamp(Math.round(p.rel * 2.4), 1, 4);
  const mul = 1 + Math.min(R.combo, 40) * .02 * lv('combo'), tier = Math.floor((mul - 1) / .5);
  if (tier > R.mulTier) { R.mulTier = tier; popup(GW / 2, GH * .22, 'goo ×' + (1 + tier * .5).toFixed(1), 'gold'); }
  const each = Math.max(1, Math.round(layerVal(S.layer) * richMul() * p.rel * (gold ? 16 : 1) / n * mul * 1.6));
  for (let i = 0; i < n; i++) R.drops.push({ x: p.x + rnd(-2, 2), y: p.y + rnd(-2, 2), vx: rnd(-55, 55), vy: rnd(-120, -30), val: each, big: gold, ch: gold || tier > 0 ? 2 : 0, r: gold ? 2.8 : 1.9 + Math.min(1.1, lv('rich') * .07) });
  bitsBurst(p.x, p.y, 5, 80, gold ? 2 : 1);
  for (let i = 0; i < 4; i++) { const a = rnd(0, TAU), v = rnd(40, 110); R.sparks.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: rnd(.25, .5) }); }
  R.rings.push({ x: p.x, y: p.y, r: p.r, life: .32, c: gold ? '#ffe07a' : '#d6ceff' });
  sfx.pop(R.combo, p.x, gold); buzz(5); ui.combo();
  if (R.combo > 5) shake(Math.min(2.5, R.combo * .05));   // chains rumble harder the longer they run
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
    toast(`DEPTH ${S.layer}\nCLEARED`); sfx.clear(); shake(5); buzz([20, 40, 20, 40, 60]); ui.pips();
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
    if (live && (b.plough > 0 || b.lastP === p) && p.type !== 'bomb') {   // heavy: straight through, hurting as it goes
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
  if (p.hp > b.dmg) { R.combo++; R.comboT = 1.4; R.best = Math.max(R.best, R.combo); sfx.hit(R.combo, p.x); ui.combo(); }
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
  if (R.freeze > 0) { R.freeze -= rdt; return; }
  let dt = rdt; if (R.slow > 0) { R.slow -= rdt; dt *= .3; }
  R.t += dt; R.cool -= dt; R.sinceShot += dt;
  if ((R.comboT -= dt) <= 0 && R.combo) { R.combo = 0; ui.combo(); }
  if (R.pending != null && R.cool <= 0) { fire(R.pending); R.pending = null; }

  for (const p of R.pods) {
    p.born += dt; p.sv += (-260 * p.s - 9 * p.sv) * dt; p.s += p.sv * dt * .1;
    p.vx += (-300 * p.ox - 10 * p.vx) * dt; p.vy += (-300 * p.oy - 10 * p.vy) * dt; p.ox += p.vx * dt; p.oy += p.vy * dt;
    p.r += (podR(hits(p)) + (p.type === 'bomb' ? 1 : 0) - p.r) * Math.min(1, dt * 12);
  }
  for (const q of R.queue) if ((q.t -= dt) <= 0) {
    q.done = true; R.rings.push({ x: q.x, y: q.y, r: q.rad * .5, life: .25, c: q.boom ? '#fff3bf' : '#74bcff', grow: q.rad * 2.4 });
    if (q.boom) { shake(6); sfx.boom(); buzz(30); bitsBurst(q.x, q.y, 12, 150, 2); }
    for (const p of R.pods) if (!p.dead) { const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy); if (d < q.rad + p.r * .5) damage(p, q.dmg + p.max * q.pm, dx / (d || 1), dy / (d || 1)); }
  }
  R.queue = R.queue.filter(q => !q.done);

  // leaky tap: a few free mini drops dribble out of the tap once the round is under way
  if (R.state === 'play' && lv('leak') && R.shots > 0 && R.popped < R.total && R.leaks < lv('leak') * 3 && (R.leakT -= dt) <= 0) {
    R.leaks++; R.leakT = .9; addBall(LX, LY + 6, rnd(-80, 80), 30, { mini: true, leak: true }); sfx.plop(R.leaks, LX);
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
    const idle = !R.balls.length && !R.drops.length && !R.queue.length;
    if (R.left === 0 && idle && R.pending == null) {
      if ((R.endT += dt) > .4) {
        if (!R.cleared && !R.chance && R.popped / R.total >= .9) {   // so close: one more drop, once
          R.chance = true; R.left = 1; R.cool = .35; R.endT = 0; toast('LAST\nCHANCE'); sfx.near(); buzz([15, 30, 15]); ui.pips();
        } else { R.state = 'tally'; R.rate = Math.max(1, R.haul) / .8; R.tick = 0; }
      }
    } else R.endT = 0;
  } else if (R.state === 'tally') {
    const amt = Math.min(R.haul, R.rate * dt); R.haul -= amt; S.goo += amt;
    if ((R.tick -= dt) <= 0 && amt > 0) { R.tick = .05; sfx.tick(R.plops++); }
    if (R.haul <= .001) {
      S.goo = Math.round(S.goo); S.rounds++;
      const prev = { got: R.got, pct: Math.round(R.popped / R.total * 100), left: R.total - R.popped, cleared: R.cleared, combo: R.best, total: R.total };
      if (R.cleared) { S.layer++; S.best = 0; S.deep = Math.max(S.deep, S.layer); netDive(); } else S.best = Math.max(S.best, prev.pct);
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
    const pulse = p.type === 'bomb' ? Math.sin(now * 7) * .6 : 0;
    ball(p.x + p.ox, p.y + p.oy, r + pulse, p.type === 'gold' ? 2 : 1);
    if (r > 5) orb(p.x + p.ox, p.y + p.oy, r + 1.5);
  }
  for (const d of R.drops) { ball(d.x, d.y, d.r, d.ch); ball(d.x - d.vx * .02, d.y - d.vy * .02, d.r * .6, d.ch); }
  for (const b of R.bits) ball(b.x, b.y, b.r, b.ch);
  for (const b of R.balls) {
    const r = b.r * (b.mini ? 1 : .62 + .38 * Math.min(1, b.wear / wearMax()));   // a drop thins as it spends itself
    ball(b.x, b.y, r + b.sq * .8); ball(b.x - b.vx * .012, b.y - b.vy * .012, r * .75);
    if (r > 3.2) orb(b.x, b.y, r + 1.5);
  }
  // the tap: a gold pipe coming down from the top, with the next drop hanging from it
  slab(LX - 3, 0, 6, LY - 14, 2); ball(LX, LY - 11, 9, 2); ball(LX, LY - 4, 5, 2); orb(LX, LY - 11, 10);
  if (R.left > 0 && R.state !== 'tally' && !titleOn) {
    const on = aim && !aim.cancel, grow = clamp(1 - R.cool / .22, .2, 1), a = on ? aim.a : Math.PI / 2, st = on ? 3 : 1 + Math.sin(now * 3) * .8;
    const r = (4 + lv('fat') * .7) * grow;
    ball(LX + Math.cos(a) * st, LY + 2 + Math.sin(a) * st, r); ball(LX, LY - 1, r * .7);
    orb(LX + Math.cos(a) * st, LY + 2 + Math.sin(a) * st, r + 1.5);
  }
}
function preview(a, bright) {   // dotted path of a shot at angle a
  const g = { x: LX + Math.cos(a) * 8, y: LY + Math.sin(a) * 8, vx: Math.cos(a) * SPEED, vy: Math.sin(a) * SPEED, r: 4 + lv('fat') * .7, plough: 0 };
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
    if (p.type === 'bomb') { ctx.fillStyle = (now * 4 | 0) & 1 ? '#fff' : '#ffc944'; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 1, y - 1, 3, 3); continue; }
    const h = hits(p);
    if (h > 1) num(x + .5, y + .5, Math.min(99, h), p.type === 'gold' ? '#4f2f0c' : '#1c1147');
    else {   // one-hit pods get a sleepy little face that watches the drop
      const lx = tb ? clamp((tb.x - x) / 30, -1, 1) | 0 : 0, sq = Math.abs(p.sv) > 3 || (now + p.ph) % 4.2 < .13;
      ctx.fillStyle = p.type === 'gold' ? '#4f2f0c' : '#1c1147';
      ctx.fillRect(x - 2 + lx, y - (sq ? 0 : 1), 1, sq ? 1 : 2); ctx.fillRect(x + 1 + lx, y - (sq ? 0 : 1), 1, sq ? 1 : 2);
    }
  }
  if (titleOn) logoPost();
  for (const r of R.rings) ring(r.x, r.y, r.r, r.c);
  for (const s of R.sparks) { ctx.fillStyle = s.life > .2 ? '#ffffff' : '#b8e6ff'; ctx.fillRect(s.x | 0, s.y | 0, 1, 1); if (s.life > .3) { ctx.fillRect(s.x - 1 | 0, s.y | 0, 3, 1); ctx.fillRect(s.x | 0, s.y - 1 | 0, 1, 3); } }
  for (const b of R.balls) if (!b.mini) eyes(b.x, b.y - .5, 1, clamp(b.vx * .01, -1, 1), clamp(b.vy * .006, -1, 1), false);
  if (R.left > 0 && R.state !== 'tally' && !titleOn) {
    const on = aim && !aim.cancel, a = on ? aim.a : Math.PI / 2; eyes(LX + Math.cos(a) * 2, LY + 1.5 + Math.sin(a) * 2, 1, 0, 0, now % 3.6 < .13, on);
    if (R.state === 'play') {
      if (on) preview(aim.a, true);
      else if (!aim && S.rounds === 0 && R.shots === 0) preview(Math.PI / 2 + Math.sin(now * 1.3) * .75, false);   // show a newcomer what aiming does
    }
  }
}

