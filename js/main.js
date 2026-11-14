'use strict';
// ══════════════════════════ input ══════════════════════════
// Touch anywhere and the shot points from the tap toward your finger.
// Slide up past the tap to cancel. Only the first finger aims.
function aimAt(e) {
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * GW, y = (e.clientY - r.top) / r.height * GH;
  aim = { a: clamp(Math.atan2(Math.max(LY + 6, y) - LY, x - LX), .09 * Math.PI, .91 * Math.PI), cancel: y < LY - 8 };
}
cv.addEventListener('pointerdown', e => {
  initAudio(); held = true; if (R.state !== 'play' || aimId !== null) return;
  aimId = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch (_) {} aimAt(e);
});
cv.addEventListener('pointermove', e => { if (e.pointerId === aimId) aimAt(e); });
cv.addEventListener('pointerup', e => {
  held = false; if (e.pointerId !== aimId) return; aimId = null; aimAt(e);
  if (!aim.cancel && R.state === 'play' && R.left > 0 && !fire(aim.a)) R.pending = aim.a;   // a tap that lands a moment early still counts
  aim = null;
});
cv.addEventListener('pointercancel', () => { aim = null; aimId = null; held = false; });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { last = performance.now(); if (ac) document.hidden ? ac.suspend() : ac.resume(); });

// ══════════════════════════ loop ══════════════════════════
let last = performance.now(), uiT = 0, gooSeen = 0;
function frame(t) {
  const dt = Math.min(1 / 30, (t - last) / 1000); last = t;
  if (AUTO) autoFire();
  const waiting = R.state === 'play' && R.left === 0 && R.balls.length > 0;
  for (let k = held && waiting ? 3 : 1; k > 0; k--) update(dt);   // hold a finger down to hurry the last drops along
  f.globalCompositeOperation = 'source-over'; f.fillStyle = '#000'; f.fillRect(0, 0, GW, GH);
  f.globalCompositeOperation = 'lighter'; orbs.length = 0;
  draw(); render(dt); post();
  shakeAmt *= Math.pow(.0005, dt);
  cv.style.transform = shakeAmt > .3 ? `translate(${rnd(-1, 1) * shakeAmt}px,${rnd(-1, 1) * shakeAmt}px)` : '';
  const target = S.goo; shownGoo += (target - shownGoo) * Math.min(1, dt * 14); if (Math.abs(target - shownGoo) < .6) shownGoo = target;
  $('goo').textContent = fmt(Math.round(shownGoo));
  if ((uiT -= dt) <= 0) {
    uiT = .1;
    if (Math.round(shownGoo) > gooSeen) rebump($('goo'), 'bump'); gooSeen = Math.round(shownGoo);
    $('haul').textContent = R.got > 0 && R.state !== 'shop' ? '+' + fmt(R.got) : '';
    $('shopBtn').classList.toggle('on', R.state === 'play' && R.shots === 0 && S.rounds > 0);
    $('ff').classList.toggle('on', waiting && R.sinceShot > 3.5);
  }
  requestAnimationFrame(frame);
}

function autoFire() { if (R.state === 'play' && R.left > 0 && R.cool <= 0 && R.t > .8) { fire(rnd(.3, .7) * Math.PI); aim = R.left > 0 ? { a: 1.1 } : null; } }
// headless balance bot: plays N rounds with rough aim and buys the cheapest thing
function runBot(n) {
  const log = []; let secs = 0; newRound();
  for (let k = 0; k < n; k++) {
    const me = R, h0 = (R.pods.reduce((a, p) => a + hits(p), 0) / R.total).toFixed(1), L = S.layer; let steps = 0;
    R.state = 'play'; R.left = maxDrops(); R.value = fieldValue();
    while (R === me && steps++ < 60 * 120) {
      if (R.state === 'play' && R.left > 0 && R.cool <= 0 && R.t > .7) { const live = R.pods.filter(p => !p.dead), p = live[Math.random() * live.length | 0]; fire(clamp((p ? Math.atan2(p.y - LY, p.x - LX) : 1.57) + rnd(-.12, .12), .3, 2.84)); }
      update(1 / 60);
    }
    if (R === me) { log.push(`r${k + 1} STUCK ${R.state} left=${R.left} balls=${R.balls.length} drops=${R.drops.length}`); newRound({ got: 0, pct: 0, left: 9 }); }
    secs += steps / 60 + 5;
    const p = R.prev, bought = [];
    for (;;) { const c = UP.filter(u => open(u) && lv(u.id) < u.max && cost(u) <= S.goo).sort((a, b) => cost(a) - cost(b))[0]; if (!c) break; buy(c); bought.push(c.id); }
    log.push(`r${k + 1} h=${h0} t=${(secs / 60).toFixed(1)}m L${L}${p.cleared ? '*' : ''} pods=${me.total} pop=${p.pct}% combo=${p.combo} got=${p.got} goo=${S.goo} buy=${bought.join(',')}`);
  }
  $('botlog').textContent = log.join('\n');
}

// ══════════════════════════ boot ══════════════════════════
// Developer switches: ?bot=N (balance run), ?auto=N (pre-roll N seconds for a
// screenshot), ?deep=N (start at depth N), ?show=title|intro|Notes|Deep|Set|note|shop.
fit(); addEventListener('resize', () => { if (fit() && R) { pool = makePool(); if (!R.shots && R.state !== 'intro') newRound(R.prev); } });
if (+params.get('deep')) S.layer = S.deep = +params.get('deep');
if (BOT) runBot(BOT);
else {
  newRound(); shownGoo = S.goo; showTitle();
  if (AUTO) {
    const show = params.get('show'), me = R;
    document.documentElement.classList.add('still');
    for (let i = 0; i < 60 * (+params.get('auto') || 3) && R === me; i++) { autoFire(); update(1 / 60); }
    if (R !== me) for (let i = 0; i < 40; i++) update(1 / 60);
    if (show !== 'title') { $('title').classList.add('off'); if (show === 'intro') runIntro(); else enterGame(); }
    if (show === 'shop' && R.state === 'play') { if (!R.prev) R.prev = { got: 1284, pct: 92, left: 2, cleared: false }; S.goo += 60; R.state = 'shop'; ui.shop(); }
    if (show === 'note') openNote(0);
    if (TABS[show]) menu.open(show);
  }
  requestAnimationFrame(frame);
}
