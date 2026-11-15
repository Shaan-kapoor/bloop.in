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
const richMul = () => 1.25 ** lv('rich') * (1 + .5 * S.pearls);
const HPG = +params.get('hpg') || 1.7, layerVal = L => 1.6 ** (L - 1);
// pods toughen fastest over the early depths, while new tricks are still arriving
const EX = +params.get('ex') || 1, hpBase = L => { const t = clamp((L - 2) / 12, 0, 1); return HPG ** (L - 1) * (1 + (EX - 1) * t * t * (3 - 2 * t)); };
const hits = p => Math.max(1, Math.ceil(p.hp / dmgNow() - 1e-6));
const pearlsFor = L => L < 8 ? 0 : Math.floor((L - 6) ** 1.3);

// ── the grumps ──
// Every fifth depth a pod that has napped far too long has sunk into the pool,
// and it plays your own game back at you, upside down. A wall of pods hangs
// between the two of you: it is in your way, and it is also your shield.
//   · every drop you let go it answers, often with your own shot mirrored
//   · its drops float up, and each one that reaches Oom is a yawn: the grump
//     dozes back a little, the dive's goo is worth less, and three end the dive
//   · a fresh drop of yours turns one of its drops into one of yours
//   · after each handful it has to yawn, and a drop in the yawn counts triple
//   · at the very end it gives one last long yawn: land the last drop in it
// Wake it and it comes along for good, with a trick of its own, and from then
// on it catches one drop a dive from every grump you meet.
//   clip: throws in a handful · gap: seconds between throws · pace: how fast its drops float
//   wit: how often it finds its best shot instead of copying yours · twin, fat, shy, regrow, tilt: its tricks
const ring6 = [0, 1, 2, 3, 4, 5].map(i => [Math.cos(i * TAU / 6) * .84, Math.sin(i * TAU / 6) * .84, .26]);
const GRUMPS = [
  { name: 'grum',  gift: 'throws two little drops',    clip: 2, gap: 1.5, pace: .36, wit: .35, lumps: [[-.6, -.62, .3], [.6, -.62, .3]] },
  { name: 'snorl', gift: 'first drop goes out as two', clip: 2, gap: 1.5, pace: .37, wit: .45, twin: 1, lumps: [[0, -.85, .28], [-.85, .1, .28], [.85, .1, .28]] },
  { name: 'glug',  gift: 'first drop is a big one',    clip: 2, gap: 1.6, pace: .34, wit: .55, fat: 1, tilt: 1, lumps: [[-.7, .25, .4], [.7, .25, .4]] },
  { name: 'hush',  gift: 'a gold pod every dive',      clip: 3, gap: 1.3, pace: .40, wit: .65, shy: 1, tilt: 1, lumps: [[0, -.9, .22], [-.32, -.82, .2], [.32, -.82, .2]] },
  { name: 'knot',  gift: 'last drop is a big one',     clip: 3, gap: 1.4, pace: .38, wit: .75, twin: 1, regrow: 1, tilt: 1, lumps: [[-.6, -.6, .28], [.6, -.6, .28], [-.6, .6, .28], [.6, .6, .28]] },
  { name: 'dooze', gift: 'one more drop',              clip: 4, gap: 1.2, pace: .42, wit: .9,  fat: 1, shy: 1, regrow: 1, tilt: 1, lumps: ring6 },
];
// the wall between you, one shape for each grump: (row 0-4, how far from the middle -1..1, column)
const WALLS = [
  (r, nx) => (r === 1 || r === 2 || r === 3 && Math.abs(nx) < .45) && Math.abs(nx) > .2,   // grum: a blanket with a lane straight down the middle
  (r, nx) => { const k = r - Math.abs(nx) * 2.6; return k > -.2 && k < 2.1; },               // snorl: an arch
  (r, nx) => { const k = r - (1 - Math.abs(nx)) * 2.6; return k > -.2 && k < 2.1; },         // glug: a bowl
  (r, nx, c) => r < 4 && (r + c) % 2 === 0,                                                // hush: a net
  r => r < 4,                                                                              // knot: four rows thick
  (r, nx, c) => (c + r * 2) % 5 !== 0,                                                     // dooze: five rows cut by slanting lanes
];
const grumpAt = L => L % 5 ? null : GRUMPS[(L / 5 - 1) % GRUMPS.length];
const BHP = +params.get('bhp') || 10, bossPay = () => 30 * layerVal(S.layer) * richMul() * 1.6;
const STAKE = [2, 1.5, 1.25, 1], stake = () => R.boss && !R.staked ? STAKE[R.doze] : 1;   // the dive's goo counts double while Oom has not yawned
const dropR = big => (4 + lv('fat') * .7) * (big ? 1.5 : 1);

// ── Oom ──
// The oldest drop there is: one wide dome hanging from the top of the world,
// far too big to fall. Every drop you let go is a little of it. The grumps it
// has woken sit in the corners and watch.
const oom = { sag: 0, v: 0, wince: 0, joy: 0, yawn: 0, strain: 0, sleep: false, nap: false, look: 0, lookY: 0 };
const palHome = k => [k % 2 ? GW - 13 - (k >> 1) * 14 : 13 + (k >> 1) * 14, 55 + Math.sin(now * 1.7 + k)];
function palXY(k) {   // a companion hops out to catch one of a grump's drops, then hops home
  const [x, y] = palHome(k), h = R && R.hops.find(h => h.k === k); if (!h) return [x, y];
  const s = Math.sin(Math.min(1, h.t) * Math.PI); return [x + (h.x - x) * s, y + (h.y - y) * s];
}
const oomX = () => LX + Math.sin(now * 38) * oom.strain * 1.2;
function oomStep(dt) {
  oom.v += (-130 * oom.sag - 8 * oom.v) * dt; oom.sag += oom.v * dt;
  oom.wince = Math.max(0, oom.wince - dt); oom.joy = Math.max(0, oom.joy - dt); oom.yawn = Math.max(0, oom.yawn - dt); oom.strain = Math.max(0, oom.strain - dt * 1.1);
  oom.sleep = oom.nap || titleOn || R.state === 'shop' || !!R.out && !R.cleared;
  const tb = R.balls.find(b => !b.mini) || R.foes[0], on = aim && !aim.cancel, tx = tb ? clamp((tb.x - LX) / 40, -1, 1) : on ? Math.cos(aim.a) : 0;
  oom.look += (tx - oom.look) * Math.min(1, dt * 8); oom.lookY += (1 - oom.lookY) * Math.min(1, dt * 6);
}
function drawOom() {
  const s = oom.sag * .5, x = oomX();
  ball(x, 4 + s, 40 + Math.sin(now * 1.2) * .6); orb(x, 22 + s, 46);
  for (let k = 0; k < (S.pals || 0); k++) { const [a, b] = palXY(k); ball(a, b, 4.6, 1); for (const [dx, dy, q] of GRUMPS[k].lumps) ball(a + dx * 4.6, b + dy * 4.6, 4.6 * q + .5, 1); orb(a, b, 6); }
}
const px = (x, y, pts) => { for (const [a, b] of pts) ctx.fillRect(x + a, y + b, 1, 1); };
const SHUT_L = [[0, 0], [1, 1], [0, 2]], SHUT_R = [[1, 0], [0, 1], [1, 2]], GLAD = [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2]], ZED = [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]];
function zeds(x, y, c) { ctx.fillStyle = c; for (let k = 0; k < 2; k++) { const t = (now * .45 + k * .5) % 1; if (t < .85) px(Math.round(x + t * 11), Math.round(y - t * 13), ZED); } }
function oomFace() {
  const x = Math.round(oomX() + oom.look * 2), y = Math.round(30 + oom.sag * .5), ly = Math.round(oom.lookY), lid = oom.sleep ? 0 : R.doze;
  ctx.fillStyle = '#0a1a52';
  if (oom.yawn > 0 && !oom.sleep) { px(x - 12, y, SHUT_L); px(x + 10, y, SHUT_R); ctx.fillRect(x - 2, y + 6, 4, 6); ctx.fillRect(x - 3, y + 7, 6, 4); }   // a yawn it could not help
  else if (oom.wince > 0) { px(x - 12, y, SHUT_L); px(x + 10, y, SHUT_R); ctx.fillRect(x - 3, y + 9, 2, 1); ctx.fillRect(x - 1, y + 8, 2, 1); ctx.fillRect(x + 1, y + 9, 2, 1); }
  else if (oom.joy > 0) { px(x - 13, y, GLAD); px(x + 8, y, GLAD); ctx.fillRect(x - 3, y + 9, 6, 1); ctx.fillRect(x - 4, y + 8, 1, 1); ctx.fillRect(x + 3, y + 8, 1, 1); }
  else if (oom.sleep || now % 4.3 < .14) { ctx.fillRect(x - 13, y + 2, 5, 1); ctx.fillRect(x + 8, y + 2, 5, 1); ctx.fillRect(x - 1, y + 8, 2, 1 + (oom.sleep && Math.sin(now * 1.2) > 0 ? 1 : 0)); }
  else {   // every yawn it catches lowers its eyelids a little
    ctx.fillRect(x - 12, y + ly + lid, 3, 4 - lid); ctx.fillRect(x + 9, y + ly + lid, 3, 4 - lid);
    if (lid) { ctx.fillRect(x - 13, y + ly + lid - 1, 5, 1); ctx.fillRect(x + 8, y + ly + lid - 1, 5, 1); }
    if (aim && !aim.cancel && R.state === 'play') ctx.fillRect(x - 1, y + 8, 2, 2); else { ctx.fillRect(x - 2, y + 9, 4, 1); ctx.fillRect(x - 3, y + 8, 1, 1); ctx.fillRect(x + 2, y + 8, 1, 1); }
    if (!lid) { ctx.fillStyle = '#b8e6ff'; ctx.fillRect(x - 12, y + ly, 1, 1); ctx.fillRect(x + 9, y + ly, 1, 1); }
  }
  if (oom.sleep) zeds(LX + 22, 47, '#b8e6ff');

  ctx.fillStyle = '#1c1147'; for (let k = 0; k < (S.pals || 0); k++) { const [a, b] = palXY(k).map(Math.round); ctx.fillRect(a - 2, b - 1, 1, 2); ctx.fillRect(a + 1, b - 1, 1, 2); }
}
function grumpFace(p) {
  const x = Math.round(p.x + p.ox), y = Math.round(p.y + p.oy), r = p.r, e = Math.max(4, Math.round(r * .4)), ey = y - Math.round(r * .3), my = y + Math.round(r * .22), ink = '#1c1147';
  const mx = Math.round(x + Math.sin(p.ma) * r * .62), mY = Math.round(y - Math.cos(p.ma) * r * .62);   // where it yawns: the spot a drop has to land on
  ctx.fillStyle = ink;
  if (p.st === 'yawn') {   // the yawn: eyes squeezed shut either side of a wide open mouth
    const w = Math.max(4, Math.round(r * .3)), h = Math.max(3, Math.round(r * .26)), cx = Math.cos(p.ma) * (w + 4), sy = Math.sin(p.ma) * (w + 4);
    for (let j = -h; j <= h; j++) { const a = Math.round(w * Math.sqrt(1 - j * j / (h * h + 1))); ctx.fillRect(mx - a, mY + j, a * 2, 1); }
    px(Math.round(mx - cx) - 1, Math.round(mY - sy) - 1, SHUT_L); px(Math.round(mx + cx) - 1, Math.round(mY + sy) - 1, SHUT_R);
    ctx.fillStyle = '#4a35b0'; ctx.fillRect(mx - w + 2, mY + h - 2, w * 2 - 4, 2);
    ctx.fillStyle = '#fff3bf'; for (let k = 0; k < 6; k++) { const a = now * 3 + k * TAU / 6; ctx.fillRect(Math.round(mx + Math.cos(a) * (w + 2)), Math.round(mY + Math.sin(a) * (h + 2)), 1, 1); }
    return;
  }
  if (p.st === 'stun') for (const sx of [-1, 1]) { const ex = x + sx * e; for (let k = -1; k <= 1; k++) { ctx.fillRect(ex + k, ey + k, 1, 1); ctx.fillRect(ex + k, ey - k, 1, 1); } }   // seeing stars
  else if (p.hurt > 0) { px(x - e - 1, ey - 1, SHUT_L); px(x + e - 1, ey - 1, SHUT_R); }
  else if (p.smug > 0) { px(x - e - 2, ey - 1, GLAD); px(x + e - 2, ey - 1, GLAD); }
  else if (!p.awake) { ctx.fillRect(x - e - 2, ey, 4, 1); ctx.fillRect(x + e - 2, ey, 4, 1); zeds(x + r * .7, y - r * .8, '#d6ceff'); ctx.fillStyle = ink; }
  else for (const sx of [-1, 1]) {   // cross little eyes under a heavy brow, watching where it means to throw
    const ex = x + sx * e, look = p.st === 'aim' ? clamp(Math.round(p.aimNow * 2), -1, 1) : 0; ctx.fillRect(ex - 1, ey - 1, 3, 3); ctx.fillRect(ex + sx - 1, ey - 4, 3, 1); ctx.fillRect(ex - sx - 1, ey - 3, 2, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(ex + look, ey - 1, 1, 1); ctx.fillStyle = ink;
  }
  if (p.st === 'tired') {   // a yawn is coming, and this is where
    ctx.fillRect(x - 1, my - 1, 2, 2);
    ctx.fillStyle = (now * 6 | 0) & 1 ? '#fff3bf' : '#ffc944'; for (let k = 0; k < 4; k++) { const a = now * 2 + k * TAU / 4; ctx.fillRect(Math.round(mx + Math.cos(a) * 5), Math.round(mY + Math.sin(a) * 4), 1, 1); }
  } else if (p.smug > 0) { ctx.fillRect(x - 3, my + 1, 6, 1); ctx.fillRect(x - 4, my, 1, 1); ctx.fillRect(x + 3, my, 1, 1); }
  else if (p.st === 'aim') ctx.fillRect(x - 1, my - 1, 3, 3);
  else if (p.awake) { ctx.fillRect(x - 2, my, 4, 1); ctx.fillRect(x - 3, my + 1, 1, 1); ctx.fillRect(x + 2, my + 1, 1, 1); }
  else ctx.fillRect(x - 1, my, 2, 1);
  const have = p.st === 'wait' ? maxDrops() : p.fin || R.out ? 0 : R.left + p.owe, n = Math.max(have, p.n), x0 = x - Math.round((Math.min(n, 6) * 5 - 2) / 2);   // its drops: as many as you hold, plus the answers it owes you
  for (let k = 0; k < n; k++) { ctx.fillStyle = k < have ? '#ff9fdc' : '#5a2a66'; ctx.fillRect(x0 + k % 6 * 5, Math.round(y - r * 1.3) - 7 - (k / 6 | 0) * 5, 3, 3); }
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
const wearMax = () => 5 + 2 * lv('bounce');   // how many knocks a drop can give before it is spent
const fieldValue = () => R.pods.reduce((a, p) => a + (p.dead || p.boss ? 0 : p.rel * (p.type === 'gold' ? 16 : 1)), 0) * layerVal(S.layer) * richMul() * 1.6 + (R.boss ? bossPay() : 0);
function genBoss(G) {
  const L = S.layer, top = Math.max(80, Math.round((GH - 12) / 2 - 76)), pods = [];
  const b = mkPod(GW / 2, GH - 26, 30, L, 'boss', 0), fr = S.boss && S.boss.L === L ? S.boss.f : 1, full = hpBase(L) * BHP, fin = fr < 1e-5;
  Object.assign(b, { max: full, hp: full * fr, hp0: full * fr, boss: G, r: 12 + 12 * fr, tx: b.x, clip: G.clip, owe: 0, n: 0, echo: [], idle: 0, fat: false, fin, flinch: false, st: fin ? 'yawn' : 'wait', t: 0, aimA: 0, aimNow: 0, ma: 0, hurt: 0, smug: 0, awake: fr < 1 }); pods.push(b);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) {
    const x = 20 + c * 20 + (r & 1 ? 10 : 0); if (x > GW - 14 || !WALLS[GRUMPS.indexOf(G)](r, (x - GW / 2) / 70, c)) continue;
    const p = mkPod(x + rnd(-1, 1), top + 40 + r * 17 + rnd(-1, 1), .6 + Math.random() * .3, L, '', r); p.g = 1; pods.push(p);
  }
  const w = S.boss && S.boss.L === L && S.boss.w, wall = pods.slice(1), up = () => wall.filter(p => !p.dead);   // the holes both of you chewed are still there next dive, bar a few pods that grow back
  if (w) { wall.forEach((p, i) => { p.dead = w[i] === '0'; }); for (let k = 0; k < 3; k++) { const d = wall.filter(p => p.dead), p = d[Math.random() * d.length | 0]; if (p) p.dead = false; } }
  for (const p of up()) if (Math.random() < .03 * lv('gold')) toType(p, 'gold');
  if (pal(3) && up().length && !up().some(p => p.type === 'gold')) toType(up()[Math.random() * up().length | 0], 'gold');
  return pods;
}
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
  if ((lv('gold') || pal(3)) && !pods.some(p => p.type === 'gold')) toType(pick(plain()), 'gold');   // hush always finds one
  for (let k = 0; k < lv('bomb'); k++) { const p = pick(plain()); if (p) toType(p, 'bomb'); }
  return pods;
}

// A new board is laid out as soon as the last round is banked, so it sits
// behind the upgrade sheet and every purchase can show up on it straight away.
function newRound(prev) {
  R = null; const pods = genField();
  R = { state: 'play', prev, t: 0, pods, balls: [], drops: [], bits: [], rings: [], sparks: [], queue: [], total: pods.filter(p => !p.g).length, boss: pods.find(p => p.boss) || null, foes: [], doze: 0, pops: 0, thrown: 0, fizzled: 0, wide: 0, out: false, staked: false, won: null, hops: [], caught: 0, critted: false, knot: false, big: pal(2), popped: 0, left: maxDrops(), haul: 0, got: 0,
        combo: 0, comboT: 0, best: 0, plops: 0, cool: .5, slow: 0, freeze: 0, endT: 0, leakT: 1.5, leaks: 0, src: null, cleared: false, chance: false, shots: 0, sinceShot: 0, mulTier: 0, pending: null, value: 1 };
  R.value = fieldValue(); if (R.boss && R.boss.fin) R.big = true;
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
  if (pal(1) && R.shots === 1) addBall(LX + Math.cos(a + .2) * 8, LY + Math.sin(a + .2) * 8, Math.cos(a + .2) * SPEED, Math.sin(a + .2) * SPEED, { split: true });   // snorl: the first drop goes out as two
  if (pal(4) && R.left === 1 && !R.knot) R.knot = R.big = true;   // knot: the last drop is a big one
  const gr = R.boss; if (gr && !gr.dead && !gr.fin && R.left > 0) { gr.owe++; gr.echo.push(Math.PI / 2 - a); }   // every drop you let go the grump answers, except your last: the last word is yours
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
const mouthArc = p => p.fin ? .7 : p.boss.tilt ? .8 : .88;
function hurtBoss(p, dmg, nx, ny) {
  const u = R.src, inMouth = -nx * Math.sin(p.ma) + ny * Math.cos(p.ma) > mouthArc(p);
  if (p.fin) { if (u && !u.mini && !u.old) wakeBoss(p, inMouth); else p.sv += 4; return; }   // the last yawn: only a drop let go after it began can end it
  const crit = p.st === 'yawn' && u && !u.mini && inMouth; if (crit) dmg *= u.r > dropR(false) + .5 ? 1.5 : 3;   // only a real drop, and only in the mouth
  const dealt = Math.min(p.hp, dmg), n = clamp(Math.round(dealt / p.max * 70), 1, 6), each = Math.max(1, Math.round(bossPay() * dealt / p.max / n));
  const hx = p.x - nx * p.r, hy = p.y - ny * p.r;
  p.hp -= dealt; p.sv += 5; p.vx += nx * 30; p.vy += ny * 30; p.hurt = .3; p.awake = true;
  if (p.st === 'aim' && !p.flinch) { p.flinch = true; p.t += .35; }   // a knock puts it off its throw, once
  for (let i = 0; i < n; i++) R.drops.push({ x: hx + rnd(-2, 2), y: hy + rnd(-2, 2), vx: -nx * rnd(30, 90) + rnd(-30, 30), vy: -ny * rnd(30, 90) - rnd(20, 70), val: each, ch: 1, r: 2.2 });
  bitsBurst(hx, hy, 3, 70, 1);
  if (crit) {   // right in the yawn: it splutters, Oom perks up and gets a big one ready
    p.st = 'stun'; p.t = 1.2; p.clip = p.boss.clip; R.big = true; R.freeze = .07; oom.joy = 1.2; shake(4); buzz([10, 30, 20]);
    if (!R.critted) { R.critted = true; R.left++; }   // the first one each dive gives the drop back
    if (R.doze > 0) { R.doze--; popup(LX, 66, 'oom perks up · goo ×' + STAKE[R.doze], 'gold'); }
    popup(p.x, p.y - p.r - 16, 'right in the yawn!', 'gold'); R.rings.push({ x: p.x, y: p.y, r: p.r, life: .4, c: '#fff3bf', grow: 90 }); sfx.split(); ui.pips();
  }
  if (p.hp <= p.max * 1e-6) lastYawn(p);
  ui.bar();
}
function lastYawn(p) {   // nothing left to knock off: one long yawn, and one big drop to end it with
  p.fin = true; p.hp = 0; p.st = 'yawn'; p.ma = 0; p.owe = 0; p.echo = []; p.awake = true; p.sv += 14;
  for (const f of R.foes) bitsBurst(f.x, f.y, 5, 70, 1); R.foes = [];
  for (const b of R.balls) b.old = true;
  R.left++; R.big = true; R.cool = Math.max(R.cool, .5); R.slow = .7; oom.joy = 1.5; shake(3); sfx.yawn(); sfx.near(); buzz([15, 30, 15]);
  popup(p.x, p.y - p.r - 20, 'one last yawn!', 'gold'); R.rings.push({ x: p.x, y: p.y, r: p.r, life: .5, c: '#fff3bf', grow: 70 }); ui.pips();
}
function wakeBoss(p, crit) {
  const G = p.boss, i = GRUMPS.indexOf(G), fresh = !pal(i), pearls = i + 1, bonus = Math.round(bossPay() * (4 + R.left) * (crit ? 2 : 1)), dives = (S.boss && S.boss.L === S.layer ? S.boss.n || 0 : 0) + 1;
  p.dead = true; p.hp = 0; R.popped = R.total; R.cleared = true; R.left = 0; R.big = false; R.slow = 1.6; R.freeze = .14; S.boss = null; oom.joy = 3; oom.yawn = 0;
  for (const f of R.foes) bitsBurst(f.x, f.y, 5, 70, 1); R.foes = [];
  for (let i = 0; i < 40; i++) { const a = rnd(0, TAU), v = rnd(40, 170), d = rnd(0, p.r); R.drops.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 150, val: Math.ceil(bonus / 40), ch: crit || i % 4 === 0 ? 2 : 1, r: rnd(2, 3.2), eye: i % 3 === 0 }); }
  for (const q of R.pods) if (q.g && !q.dead) R.queue.push({ t: .15 + Math.random() * .5, x: q.x, y: q.y, rad: 1, dmg: q.hp + 1, pm: 0 });
  R.rings.push({ x: p.x, y: p.y, r: p.r, life: .5, c: '#d6ceff', grow: 120 }); bitsBurst(p.x, p.y, 14, 160, crit ? 2 : 1);
  S.pearls += pearls; if (fresh) S.pals = i + 1;   // the deeper the grump, the more pearls it was sleeping on; the first time it comes along too
  R.won = { name: G.name, gift: fresh ? G.gift : '', dives, pearls };
  if (crit) popup(p.x, p.y - p.r - 18, 'right in the yawn! ×2', 'gold');
  if (!BOT) setTimeout(() => { popup(GW / 2, GH * .4, 'jackpot +' + fmt(bonus), 'big'); popup(GW / 2, GH * .4 + 14, '+' + pearls + (pearls > 1 ? ' pearls' : ' pearl') + (fresh ? ' · ' + G.name + ' comes along' : ''), 'gold'); }, 900);
  toast(G.name.toUpperCase() + '\nIS AWAKE'); sfx.clear(); shake(7); buzz([30, 40, 30, 40, 80]); ui.pips();
}

// ── the duel ──
// The grump's drops are yours turned upside down and slowed: the same bounces,
// floating up instead of falling. They wear out in two knocks, so the wall is
// your shield, and every lane you dig toward the grump is a lane for it.
const foeBall = (p, a, fat) => ({ x: p.x + Math.sin(a) * (p.r + 3), y: p.y - Math.cos(a) * (p.r + 3), vx: Math.sin(a) * SPEED, vy: -Math.cos(a) * SPEED, r: fat ? 7.5 : 5, hp: fat ? 2 : 1, foe: true, k: p.boss.pace, dmg: hpBase(S.layer) * .5, wear: 2, hits: 0, age: 0, slowT: 0, sq: 0, trail: 0, last: null, by: null });
const oomHit = f => Math.hypot(f.x - LX, f.y - 4) < 37 + f.r * .5;
const tell = t => { if (!BOT && !pal(0)) { $('hint').textContent = t; $('hint').classList.add('on'); } };   // the first grump explains itself, a line at a time
// It tries a fan of shots in its head, the way the aim line does for you, and keeps the best.
function foeAim(p, fat) {
  let best = 0, top = -1e9;
  for (let i = 0; i < 11; i++) {
    const a = -1.05 + i * .21 + rnd(-.08, .08); let sc = Math.random();
    for (const o of p.boss.twin ? [-.2, .2] : [0]) {
      const g = foeBall(p, a + o, fat); let n = 0;
      for (let k = 0; k < 420; k++) { if (stepBall(g, STEP, false) && ++n >= g.wear) break; if (oomHit(g)) { sc += 100; break; } if (g.y < 26) { sc -= 5; break; } }
      sc += n;
    }
    if (sc > top) { top = sc; best = a; }
  }
  return best;
}
function grumpStep(p, dt) {
  const G = p.boss, can = R.state === 'play' && !R.out, on = can && (R.left > 0 || R.balls.some(b => !b.mini)), hot = p.hp < p.max * .35 ? .7 : 1;   // it speeds up once it is nearly awake
  p.hurt -= dt; p.smug -= dt; p.x += (p.tx - p.x) * Math.min(1, dt * 1.6); p.y = pool.top(p.x) - p.r * .55 + Math.sin(now * 1.4) * 1.2;
  p.aimNow += (p.aimA - p.aimNow) * Math.min(1, dt * 7);
  if (p.fin) return;
  if (p.st === 'wait') { if (R.shots > 0) { p.st = 'rest'; p.t = .35; p.awake = true; } return; }
  p.n = Math.max(p.n, R.left + p.owe);
  if (!on && p.t > .3 && (p.st === 'tired' || p.st === 'yawn')) p.t = .3;   // nobody left to yawn at
  if ((p.t -= dt) > 0) return;
  if (p.st === 'rest') {
    if (!can) return;
    if (!p.owe && R.left > 0 && (p.idle += dt) > 2.5) p.owe = 1;   // hold still too long and it throws anyway
    if (!p.owe) return;
    const e = p.echo.shift(); p.st = 'aim'; p.t = (on ? .9 : .45) * hot; p.flinch = false; p.idle = 0; p.fat = !!G.fat && p.clip === 1;
    p.aimNow = p.aimA + rnd(-.5, .5); p.aimA = e != null && Math.random() > G.wit ? clamp(e, -1.05, 1.05) : foeAim(p, p.fat); sfx.near();   // your own shot, mirrored, or the best it can find
  }
  else if (p.st === 'aim') {
    for (const o of G.twin ? [-.2, .2] : [0]) R.foes.push(foeBall(p, p.aimA + o, p.fat));
    p.sv += 12; p.clip--; p.owe = Math.max(0, p.owe - 1); R.thrown += G.twin ? 2 : 1; sfx.spit(p.x); buzz(6);
    if (!R.told) { R.told = 1; tell('its pink drops make oom yawn'); }
    if (p.clip > 0 || R.left === 0) { if (p.clip <= 0) p.clip = G.clip; p.st = 'rest'; p.t = R.left > 0 ? G.gap * hot : .35; }   // with nothing left to answer it, the volley comes fast
    else { p.st = 'tired'; p.t = .8; p.ma = G.tilt ? [-.7, 0, .7][Math.random() * 3 | 0] : 0; if (R.told < 2) { R.told = 2; tell('throw one in its yawn'); } }
  }
  else if (p.st === 'tired') { p.st = 'yawn'; p.t = 1.8; sfx.yawn(); if (!pal(0) && !R.slowed) { R.slowed = true; R.slow = .8; } }
  else {   // the yawn is over, or the splutter: it gathers a fresh handful
    p.st = 'rest'; p.t = G.gap * hot * .6; p.clip = G.clip;
    if (G.shy) p.tx = [GW / 2 - 38, GW / 2, GW / 2 + 38].filter(v => Math.abs(v - p.tx) > 1)[Math.random() * 2 | 0];
    if (G.regrow) for (let k = 0; k < 2; k++) { const dead = R.pods.filter(q => q.g && q.dead && !R.balls.concat(R.foes).some(b => Math.hypot(b.x - q.x, b.y - q.y) < 16)), q = dead[Math.random() * dead.length | 0]; if (q) { q.dead = false; q.hp = q.max; q.born = 0; q.s = 0; } }
  }
}
function foeHit(b, p, nx, ny) {   // its drops chew at the wall from below, and what they pop is lost to you
  b.hits++; b.sq = 1; b.wear--; p.hp -= b.dmg; p.sv += 9; p.vx -= nx * 60; p.vy -= ny * 60; sfx.nib(p.x);
  if (p.hp > 0) return bitsBurst(p.x, p.y, 2, 50, 1);
  p.dead = true; bitsBurst(p.x, p.y, 6, 90, 1); R.rings.push({ x: p.x, y: p.y, r: p.r, life: .3, c: '#8f8cd0' });
}
// One of your drops meets one of its drops. Thick beats thin: a fresh drop
// turns the grump's drop blue and it falls as yours; a worn-out one just bursts.
function clash(f, b) {
  const big = b.r > dropR(false) + .5;
  f.last = b; f.sq = 1; b.hits++;
  if (!big && b.wear < 3) { b.dead = true; bitsBurst(b.x, b.y, 6, 90, 0); popup(b.x, b.y - 8, 'too thin', ''); sfx.fizz(); return; }
  R.combo++; R.comboT = 1.4; R.best = Math.max(R.best, R.combo); ui.combo();
  if (!big) { b.wear -= 2; if (--f.hp > 0) { f.r = 5; bitsBurst(f.x, f.y, 5, 80, 1); sfx.hit(R.combo, f.x); return; } }   // a fat one takes two
  f.dead = true; R.pops++; R.freeze = .05; oom.joy = Math.max(oom.joy, .9); if (R.boss) R.boss.hurt = .35;
  addBall(f.x, f.y, b.vx * .4 + rnd(-25, 25), 50, { split: true, wear: 3 });
  const each = Math.max(1, Math.round(bossPay() * .012));
  for (let i = 0; i < 3; i++) R.drops.push({ x: f.x, y: f.y, vx: rnd(-60, 60), vy: rnd(-110, -30), val: each, ch: 2, r: 2.4 });
  bitsBurst(f.x, f.y, 8, 110, 0); R.rings.push({ x: f.x, y: f.y, r: f.r, life: .35, c: '#b8e6ff', grow: 70 });
  popup(f.x, f.y - 9, 'turned!', 'gold'); sfx.pop(R.combo, f.x, true); buzz(12);
}
function oomYawn(f) {   // one got through: yawns are catching, and the grump settles back a little, though never past where this dive began
  f.dead = true; bitsBurst(f.x, f.y, 6, 80, 1); if (R.cleared || R.out) return;
  const b = R.boss; R.doze++; oom.yawn = 1.4; oom.v = -110; shake(3); buzz(25); sfx.yawn();
  if (b && !b.dead && !b.fin) { b.smug = 1.6; if (b.hp < b.hp0) { b.hp = Math.min(b.hp0, b.hp + b.max * .03); popup(b.x, b.y - b.r - 16, b.boss.name + ' dozes off a little', ''); } }
  ui.bar();
  if (R.doze < 3) return popup(LX, 66, (R.doze === 1 ? 'oom yawns' : 'one more and oom nods off') + ' · goo ×' + STAKE[R.doze], '');
  R.out = true; R.left = 0; R.big = false; R.pending = null; aim = null; R.slow = .9; toast('OOM\nNODS OFF'); sfx.sink(LX, true); ui.pips();
  for (const g of R.foes) if (!g.dead) { g.dead = true; bitsBurst(g.x, g.y, 4, 60, 1); }
}
function foesStep(dt) {
  const rush = R.left === 0 && !R.balls.some(b => !b.mini) ? 2.5 : 1;   // nothing left to answer with: get it over
  for (const f of R.foes) {
    const h = dt * f.k * rush, n = Math.max(1, Math.ceil(h / STEP)); f.age += h; f.sq = Math.max(0, f.sq - dt * 6);
    for (let k = 0; k < n; k++) stepBall(f, h / n, true);
    if (f.y > pool.top(f.x) - f.r) { f.y = pool.top(f.x) - f.r; f.vy = -Math.abs(f.vy) * .5; }
    if ((f.trail -= dt) <= 0 && R.bits.length < 170) { f.trail = .08; R.bits.push({ x: f.x, y: f.y, vx: 0, vy: 0, r: f.r * .5, ch: 1, shrink: 6 }); }
    f.slowT = Math.hypot(f.vx, f.vy) < 45 ? f.slowT + h : 0;
    if (f.slowT > 1.1 || f.age > 9 || f.wear <= 0) { f.dead = true; R.fizzled++; bitsBurst(f.x, f.y, 5, 70, 1); sfx.fizz(); continue; }
    if (f.by != null) continue;   // a companion is already on its way to this one
    for (const b of R.balls) if (!b.dead && !b.mini && !b.split && f.last !== b && Math.hypot(b.x - f.x, b.y - f.y) < b.r + f.r + 3) { clash(f, b); break; }   // only a drop you aimed can meet it
    if (f.dead) continue;
    if (f.y < 92 && !R.out) {   // each companion catches one a dive
      let k = -1; for (let j = 0; j < (S.pals || 0); j++) if (!(R.caught >> j & 1) && (k < 0 || Math.abs(palHome(j)[0] - f.x) < Math.abs(palHome(k)[0] - f.x))) k = j;
      if (k >= 0) { R.caught |= 1 << k; f.by = k; R.hops.push({ k, f, x: f.x, y: f.y, t: 0 }); continue; }
    }
    if (oomHit(f)) oomYawn(f);
    else if (f.y < 26) { f.dead = true; R.wide++; bitsBurst(f.x, f.y, 5, 70, 1); sfx.fizz(); popup(f.x, 42, 'missed', ''); }
  }
  R.foes = R.foes.filter(f => !f.dead); R.balls = R.balls.filter(b => !b.dead);
}
function hopsStep(dt) {
  for (const h of R.hops) {
    h.t += dt / .5; if (h.done) continue; h.x = h.f.x; h.y = h.f.y;
    if (h.t >= .5) { h.done = true; if (!h.f.dead) { h.f.dead = true; R.pops++; bitsBurst(h.x, h.y, 8, 100, 1); R.rings.push({ x: h.x, y: h.y, r: 5, life: .35, c: '#d6ceff', grow: 60 }); popup(h.x, h.y - 10, GRUMPS[h.k].name + ' caught it', 'gold'); sfx.split(); buzz(10); } }
  }
  R.hops = R.hops.filter(h => h.t < 1); R.foes = R.foes.filter(f => !f.dead);
}
function popPod(p) {
  p.dead = true; if (!p.g) R.popped++; R.combo++; R.comboT = 1.4; R.best = Math.max(R.best, R.combo);
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
  b.vy += (b.foe ? -GRAV : GRAV) * dt; b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * .8; } else if (b.x > GW - b.r) { b.x = GW - b.r; b.vx = -Math.abs(b.vx) * .8; }
  if (!b.foe && b.y < b.r + 22) { b.y = b.r + 22; b.vy = Math.abs(b.vy) * .6; }
  const e = .6 + .07 * lv('bounce');
  for (const p of R.pods) {
    if (p.dead || p.born < .1 || b.foe && p.boss) continue;
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
      if (live) (b.foe ? foeHit : hitPod)(b, p, nx, ny); else return true;
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
  oomStep(rdt);
  if (R.freeze > 0) { R.freeze -= rdt; return; }
  let dt = rdt; if (R.slow > 0) { R.slow -= rdt; dt *= .3; }
  R.t += dt; R.cool -= dt; R.sinceShot += dt;
  if ((R.comboT -= dt) <= 0 && R.combo) { R.combo = 0; ui.combo(); }
  if (R.pending != null && R.cool <= 0) { fire(R.pending); R.pending = null; }

  for (const p of R.pods) {
    p.born += dt; p.sv += (-260 * p.s - 9 * p.sv) * dt; p.s += p.sv * dt * .1;
    p.vx += (-300 * p.ox - 10 * p.vx) * dt; p.vy += (-300 * p.oy - 10 * p.vy) * dt; p.ox += p.vx * dt; p.oy += p.vy * dt;
    p.r += ((p.boss ? p.fin ? 20 : 12 + 12 * p.hp / p.max : podR(hits(p)) + (p.type === 'bomb' ? 1 : 0)) - p.r) * Math.min(1, dt * 12);
  }
  if (R.boss && !R.boss.dead) grumpStep(R.boss, dt);
  for (const q of R.queue) if ((q.t -= dt) <= 0) {
    q.done = true; R.rings.push({ x: q.x, y: q.y, r: q.rad * .5, life: .25, c: q.boom ? '#fff3bf' : '#74bcff', grow: q.rad * 2.4 });
    if (q.boom) { shake(6); sfx.boom(); buzz(30); bitsBurst(q.x, q.y, 12, 150, 2); }
    for (const p of R.pods) if (!p.dead) { const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy); if (d < q.rad + p.r * .5) damage(p, q.dmg + (p.boss ? 0 : p.max * q.pm), dx / (d || 1), dy / (d || 1)); }
  }
  R.queue = R.queue.filter(q => !q.done);

  // once the round is under way grum throws its two little drops, and then Oom dribbles a few more
  if (R.state === 'play' && R.shots > 0 && R.popped < R.total && R.leaks < lv('leak') * 3 + (pal(0) ? 2 : 0) && (R.leakT -= dt) <= 0) {
    const k = R.leaks++; R.leakT = .9; sfx.plop(R.leaks, LX);
    if (pal(0) && k < 2) { const [x, y] = palXY(0); addBall(x, y + 4, rnd(20, 70), -40, { mini: true, leak: true }); } else addBall(LX, LY + 6, rnd(-80, 80), 30, { mini: true, leak: true });
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
  if (R.foes.length) foesStep(dt);
  if (R.hops.length) hopsStep(dt);

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
  pool.update(dt, (R.boss ? 24 : 12) + 54 * (1 - Math.exp(-1.6 * R.haul / Math.max(1, R.value))));

  if (R.state === 'play') {
    const idle = !R.balls.length && !R.drops.length && !R.queue.length && !R.foes.length && !(R.boss && !R.boss.dead && !R.out && R.boss.owe > 0);   // the grump still gets its answers
    if (R.left === 0 && idle && R.pending == null) {
      if ((R.endT += dt) > .4) {
        if (!R.cleared && !R.chance && !R.out && (R.boss ? 1 - R.boss.hp / R.boss.max : R.popped / R.total) >= .9) {   // so close: one more drop, once
          R.chance = true; R.left = 1; R.cool = .35; R.endT = 0; toast('LAST\nCHANCE'); sfx.near(); buzz([15, 30, 15]); ui.pips();
        } else {
          const m = stake(); R.staked = true;   // a dive that ends with Oom still awake pays more
          if (m > 1 && R.haul > 0) { R.haul *= m; R.got *= m; popup(GW / 2, GH * .52, (R.doze ? 'still awake' : 'wide awake') + ' · goo ×' + m, 'gold'); arpeggio(7, 4, 60); }
          R.state = 'tally'; R.rate = Math.max(1, R.haul) / .8; R.tick = 0;
        }
      }
    } else R.endT = 0;
  } else if (R.state === 'tally') {
    const amt = Math.min(R.haul, R.rate * dt); R.haul -= amt; S.goo += amt;
    if ((R.tick -= dt) <= 0 && amt > 0) { R.tick = .05; sfx.tick(R.plops++); }
    if (R.haul <= .001) {
      S.goo = Math.round(S.goo); S.rounds++;
      const bf = R.boss && !R.boss.dead ? R.boss.hp / R.boss.max : 0;
      const prev = { got: R.got, pct: Math.round((R.boss ? 1 - bf : R.popped / R.total) * 100), left: R.total - R.popped, cleared: R.cleared, combo: R.best, total: R.total, boss: R.boss && R.boss.boss.name, out: R.out, won: R.won, fin: !!R.boss && R.boss.fin };
      if (R.cleared) { S.layer++; S.best = 0; S.deep = Math.max(S.deep, S.layer); netDive(); } else { S.best = Math.max(S.best, prev.pct); if (R.boss) S.boss = { L: S.layer, f: bf, n: (S.boss && S.boss.L === S.layer ? S.boss.n || 0 : 0) + 1, w: R.pods.filter(p => p.g).map(p => p.dead ? 0 : 1).join('') }; }
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
    const pulse = p.type === 'bomb' ? Math.sin(now * 7) * .6 : p.fin ? 2.5 + Math.sin(now * 5) * 1.6 : p.st === 'yawn' ? 1.6 + Math.sin(now * 8) * .8 : p.st === 'tired' || p.st === 'aim' ? Math.sin(now * 10) * .7 : 0;
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
  for (const f of R.foes) { ball(f.x, f.y, f.r + f.sq * .8, 1); ball(f.x - f.vx * .012, f.y - f.vy * .012, f.r * .7, 1); orb(f.x, f.y, f.r + 1.5); tint(f.x, f.y, f.r + 3.5); }   // pink is the grump's
  drawOom();   // the next drop buds from its chin
  if (R.left > 0 && R.state !== 'tally' && !titleOn) {
    const on = aim && !aim.cancel, grow = clamp(1 - R.cool / .22, .2, 1), a = on ? aim.a : Math.PI / 2, st = on ? 3 : 1 + Math.sin(now * 3) * .8;
    const r = dropR(R.big) * grow, hy = LY + 2 + oom.sag;
    ball(LX + Math.cos(a) * st, hy + Math.sin(a) * st, r); ball(LX, hy - 3, r * .7);
    orb(LX + Math.cos(a) * st, hy + Math.sin(a) * st, r + 1.5);
  }
}
function yawnShot(a) {   // would this shot land in the grump's open mouth?
  const p = R.boss; if (!p || p.dead || p.st !== 'tired' && p.st !== 'yawn') return false;
  const g = { x: LX + Math.cos(a) * 8, y: LY + Math.sin(a) * 8, vx: Math.cos(a) * SPEED, vy: Math.sin(a) * SPEED, r: dropR(R.big), plough: 0 };
  for (let i = 0; i < 420; i++) {
    if (stepBall(g, STEP, false)) { const dx = g.x - p.x, dy = g.y - p.y, d = Math.hypot(dx, dy); return d < g.r + p.r + 2 && (dx * Math.sin(p.ma) - dy * Math.cos(p.ma)) / d > mouthArc(p); }
    if (g.y > pool.top(g.x)) return false;
  }
  return false;
}
function preview(a, bright) {   // dotted path of a shot at angle a
  const gold = bright && yawnShot(a);
  const g = { x: LX + Math.cos(a) * 8, y: LY + Math.sin(a) * 8, vx: Math.cos(a) * SPEED, vy: Math.sin(a) * SPEED, r: dropR(R.big), plough: 0 };
  let after = -1; const steps = 90 + lv('aim') * 60, extra = 8 + lv('aim') * 26;
  for (let i = 0; i < steps; i++) {
    if (stepBall(g, STEP, false) && after < 0) after = i;
    if (after >= 0 && i - after > extra) break;
    if (g.y > pool.top(g.x)) break;
    if (i % 5 === (now * 24 | 0) % 5) { const big = i < 30 && after < 0 ? 2 : 1; ctx.fillStyle = gold ? '#ffc944' : after >= 0 ? '#74bcff' : bright ? '#ffffff' : '#8f8cd0'; ctx.fillRect(g.x | 0, g.y | 0, big, big); }
  }
}
function foeLine(p) {   // where the grump means to throw: you get to see it coming
  for (const o of p.boss.twin ? [-.2, .2] : [0]) {
    const g = foeBall(p, p.aimNow + o, p.fat); let after = -1;
    for (let i = 0; i < 160; i++) {
      if (stepBall(g, STEP, false) && after < 0) after = i;
      if (after >= 0 && i - after > 10 || g.y < 44) break;
      if (i % 5 === (now * 24 | 0) % 5) { ctx.fillStyle = after >= 0 ? '#b0508c' : '#ff9fdc'; ctx.fillRect(g.x | 0, g.y | 0, i < 30 && after < 0 ? 2 : 1, i < 30 && after < 0 ? 2 : 1); }
    }
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
    if (p.boss) { grumpFace(p); if (p.st === 'aim') foeLine(p); continue; }
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
  for (const f of R.foes) ring(f.x, f.y, f.r + 3 + Math.sin(now * 9 + f.x) * .6, '#ffd3ee');
  for (const s of R.sparks) { ctx.fillStyle = s.life > .2 ? '#ffffff' : '#b8e6ff'; ctx.fillRect(s.x | 0, s.y | 0, 1, 1); if (s.life > .3) { ctx.fillRect(s.x - 1 | 0, s.y | 0, 3, 1); ctx.fillRect(s.x | 0, s.y - 1 | 0, 1, 3); } }
  for (const b of R.balls) if (!b.mini) eyes(b.x, b.y - .5, 1, clamp(b.vx * .01, -1, 1), clamp(b.vy * .006, -1, 1), false);
  ctx.fillStyle = '#4a1238'; for (const f of R.foes) { const x = Math.round(f.x), y = Math.round(f.y); ctx.fillRect(x - 3, y - 1, 2, 1); ctx.fillRect(x + 1, y - 1, 2, 1); if (f.hp > 1) ctx.fillRect(x - 1, y + 2, 2, 1); }   // half-shut eyes: its drops are sleepy too
  if (R.left > 0 && R.state !== 'tally' && !titleOn) {
    const on = aim && !aim.cancel, a = on ? aim.a : Math.PI / 2; eyes(LX + Math.cos(a) * 2, LY + 1.5 + oom.sag + Math.sin(a) * 2, 1, 0, 0, now % 3.6 < .13, on);
    if (R.state === 'play') {
      if (on) preview(aim.a, true);
      else if (!aim && S.rounds === 0 && R.shots === 0) preview(Math.PI / 2 + Math.sin(now * 1.3) * .75, false);   // show a newcomer what aiming does
    }
  }
}

