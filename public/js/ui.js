'use strict';
// ══════════════════════════ UI ══════════════════════════
const stage = $('stage');
const rebump = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let shownGoo = 0, theme = -1, lastDepth = 0, tileEls = {}, streak = 0, lastBuy = 0;

// a little burst of droplets (or hearts) flying out of an element
function burst(el, n = 9, cls = '') {
  if (BOT) return; const host = el.closest('#sheet, #menu, #title') || stage, a = el.getBoundingClientRect(), h = host.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'), ang = rnd(0, TAU), d = rnd(12, 30); s.className = 'spark ' + cls; if (cls === 'h') s.textContent = '♥';
    s.style.cssText = `left:${a.left - h.left + a.width / 2}px;top:${a.top - h.top + a.height / 2}px;--dx:calc(var(--u)*${(Math.cos(ang) * d).toFixed(1)});--dy:calc(var(--u)*${(Math.sin(ang) * d - 12).toFixed(1)})`;
    s.onanimationend = () => s.remove(); host.appendChild(s);
  }
}
function countUp(el, to, pre = '') {
  const t0 = performance.now(); const step = t => { const k = clamp((t - t0) / 650, 0, 1); el.textContent = pre + fmt(to * (1 - (1 - k) ** 3)); if (k < 1 && el.isConnected) requestAnimationFrame(step); };
  step(t0);
}

// goo flies from one element to another, e.g. from your counter into the upgrade you bought
function fly(from, to, n = 5) {
  if (BOT || !from.animate) return; const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), h = stage.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'), x0 = a.left - h.left + a.height / 2, y0 = a.top - h.top + a.height / 2;
    const dx = b.left - h.left + b.width * rnd(.25, .75) - x0, dy = b.top - h.top + b.height / 2 - y0;
    s.className = 'dot fly'; s.style.cssText = `left:${x0}px;top:${y0}px`; stage.appendChild(s);
    s.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx * .5 + rnd(-40, 40)}px,${dy * .5 - rnd(10, 60)}px) scale(1.4)`, offset: .5 }, { transform: `translate(${dx}px,${dy}px) scale(.6)` }],
      { duration: 340 + i * 50, easing: 'cubic-bezier(.4,0,.7,1)' }).onfinish = () => s.remove();
  }
}
// hold a tile to keep buying, faster and faster
function holdToBuy(el, u) {
  let t = 0, gap = 0; const stop = () => { clearTimeout(t); t = 0; };
  const again = () => { el._held = true; if (!buy(u)) return stop(); gap = Math.max(70, gap * .82); t = setTimeout(again, gap); };
  el.onpointerdown = () => { stop(); el._held = false; gap = 260; t = setTimeout(again, 420); };
  el.onpointerup = el.onpointerleave = el.onpointercancel = stop;
  el.onclick = () => { if (el._held) el._held = false; else buy(u); };
}

// ── pixel icons: 16×16, drawn in code, three tones per colour ──
const TONES = { b: ['#b8e6ff', '#3f8cff', '#1f47c9'], v: ['#d6ceff', '#7a66ea', '#4a35b0'], g: ['#fff3bf', '#ffc944', '#d98a1c'], w: ['#ffffff', '#e9f4ff', '#b8e6ff'], n: ['#0a1a52', '#0a1a52', '#0a1a52'] };
function makeIcon(paint) {
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
  const d = (x, y, r, t) => { for (let py = Math.floor(y - r); py <= y + r; py++) for (let px = Math.floor(x - r); px <= x + r; px++) { const dx = px + .5 - x, dy = py + .5 - y; if (dx * dx + dy * dy > r * r) continue; const s = (dx + dy) / r; g.fillStyle = TONES[t][s < -.55 ? 0 : s > .65 ? 2 : 1]; g.fillRect(px, py, 1, 1); } };
  const r = (x, y, w, h, t, k = 1) => { g.fillStyle = TONES[t][k]; g.fillRect(x, y, w, h); };
  paint(d, r); return c.toDataURL();
}
const ICON = {
  drops:  d => { d(8, 4.5, 3, 'b'); d(4.5, 11, 3, 'b'); d(11.5, 11, 3, 'b'); },
  power:  (d, r) => { d(6, 8, 4.5, 'b'); r(12, 7, 3, 2, 'g'); r(11, 3, 2, 2, 'g'); r(11, 11, 2, 2, 'g'); r(14, 2, 1, 1, 'g', 0); r(14, 13, 1, 1, 'g', 0); },
  rich:   (d, r) => { d(8, 8, 6, 'g'); r(5, 5, 2, 2, 'w', 0); },
  bounce: (d, r) => { d(8, 5, 3.5, 'b'); r(1, 10, 2, 1, 'w', 2); r(3, 12, 3, 1, 'w', 2); r(6, 14, 4, 1, 'w', 2); r(10, 12, 3, 1, 'w', 2); r(13, 10, 2, 1, 'w', 2); },
  splash: (d, r) => { d(8, 8, 3.5, 'v'); for (const [x, y] of [[7, 0], [7, 14], [0, 7], [14, 7]]) r(x, y, 2, 2, 'w', 2); for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) r(x, y, 1, 1, 'w', 0); },
  fat:    (d, r) => { d(8, 8, 7, 'b'); r(5, 6, 1, 3, 'n'); r(10, 6, 1, 3, 'n'); },
  aim:    (d, r) => { for (let k = 0; k < 4; k++) r(1 + k * 3, 13 - k * 3, 2, 2, 'w', k < 2 ? 2 : 0); d(13.5, 2.5, 2.2, 'b'); },
  twin:   d => { d(4.5, 8, 3.8, 'b'); d(11.5, 8, 3.8, 'b'); },
  combo:  (d, r) => { r(9, 2, 1, 9, 'g'); r(10, 2, 3, 2, 'g'); r(12, 4, 1, 2, 'g', 2); d(7, 11.5, 2.8, 'g'); },
  skip:   (d, r) => { d(8, 5, 3.2, 'b'); r(0, 11, 4, 1, 'w', 2); r(6, 12, 4, 1, 'w', 2); r(12, 11, 4, 1, 'w', 2); r(3, 14, 4, 1, 'b', 2); r(9, 14, 4, 1, 'b', 2); },
  gold:   (d, r) => { d(7, 9, 5.5, 'g'); r(13, 0, 1, 5, 'w', 0); r(11, 2, 5, 1, 'w', 0); },
  leak:   (d, r) => { r(6, 0, 4, 5, 'g'); r(6, 0, 1, 5, 'g', 0); d(8, 6.5, 3.5, 'g'); d(8, 13.5, 2, 'b'); },
  tad:    (d, r) => { d(10.5, 8, 3.8, 'b'); r(3, 8, 4, 1, 'b'); r(1, 7, 2, 1, 'b'); r(0, 6, 1, 1, 'b', 0); r(10, 7, 1, 2, 'n'); r(12, 7, 1, 2, 'n'); },
  bomb:   (d, r) => { d(7.5, 9.5, 5.5, 'v'); r(8, 2, 1, 3, 'w', 2); r(7, 0, 3, 2, 'g'); r(5, 9, 5, 1, 'w', 0); r(7, 7, 1, 5, 'w', 0); },
  heavy:  (d, r) => { d(8, 5.5, 4.5, 'b'); r(7, 10, 2, 3, 'w', 2); r(5, 12, 6, 1, 'w', 2); r(6, 13, 4, 1, 'w', 2); r(7, 14, 2, 1, 'w', 2); },
  bottle: (d, r) => { r(7, 0, 2, 2, 'g', 2); r(7, 2, 2, 3, 'w', 2); d(8, 10, 5, 'w'); r(5, 9, 6, 3, 'g', 0); r(6, 10, 4, 1, 'g', 2); },
  pearl:  (d, r) => { d(8, 8, 5.5, 'w'); r(5, 5, 2, 2, 'w', 0); },
};
const icons = {}, ico = id => icons[id] || (icons[id] = makeIcon(ICON[id]));

// ── HUD and the upgrade sheet ──
const notesOpen = () => S.moon ? NOTES.length : Math.min(NOTES.length, S.deep - 1);
function zoneBanner() {
  if (BOT || stage.classList.contains('cine')) return;
  $('zone').innerHTML = `<small>depth ${S.layer}</small>${ZONES[theme]}`; rebump($('zone'), 'on'); sfx.zone();
}
// "3 drops" and "4 drops" read better as "3 → 4 drops"
function fxPair(a, b) {
  const x = a.split(' '), y = b.split(' ');
  if (x.length === y.length && x.length > 1) {
    if (x.slice(1).join(' ') === y.slice(1).join(' ')) return [x[0], b];
    if (x.slice(0, -1).join(' ') === y.slice(0, -1).join(' ')) return [a, y[y.length - 1]];
  }
  return [a, b];
}
const ui = {
  round() {
    if (BOT) return;
    const th = (S.layer - 1) % THEMES.length; if (th !== theme) { theme = th; setTheme(th); }
    $('depth').textContent = 'depth ' + String(S.layer).padStart(2, '0') + (S.pearls ? ' · ' + S.pearls + '◦' : '');
    if (S.layer !== lastDepth) { if (lastDepth) { rebump($('depth'), 'flip'); zoneBanner(); } lastDepth = S.layer; }
    this.pips(); this.bar(); this.combo();
    if (S.rounds === 0) { $('hint').textContent = 'drag to aim, let go to drop'; $('hint').classList.add('on'); }
  },
  pips() { if (BOT) return; const n = Math.max(maxDrops(), R.left); $('pips').innerHTML = Array.from({ length: n }, (_, i) => `<i class="dot${i >= R.left ? ' used' : ''}"></i>`).join(''); },
  bar() { if (BOT) return; const rem = R.total - R.popped; $('bar').firstChild.style.width = (R.total ? R.popped / R.total * 100 : 0) + '%'; $('left').textContent = rem ? rem + (rem === 1 ? ' pod left' : ' pods left') : 'all popped!'; },
  combo() {
    if (BOT) return; const c = $('combo');
    if (R.combo >= 3) { c.innerHTML = R.combo + '<small>combo</small>'; c.classList.add('on'); rebump(c, 'bump'); }
    else c.classList.remove('on');
  },
  shop() {
    if (BOT) return; const p = R.prev, news = UP.filter(u => u.depth && open(u) && !S.seen[u.id]).map(u => u.name);
    $('resL').textContent = p ? 'this dive' : 'your goo';
    if (p) countUp($('resN'), p.got, '+'); else $('resN').textContent = fmt(S.goo);
    $('resS').innerHTML = !p ? 'spend it well' : p.cleared ? `<em>depth ${S.layer}: ${ZONES[(S.layer - 1) % ZONES.length]}</em>` + (news.length ? `<br>new: ${news.join(', ')}` : '')
      : p.left <= 3 ? `<em>${p.left} left. so close!</em><br>pop them all in one round` : `popped ${p.pct}% · best ${S.best}%<br>pop them all in one round`;
    this.tiles(); const box = $('cards'); box.scrollTop = 0; box.classList.add('enter'); setTimeout(() => box.classList.remove('enter'), 1100);
    $('combo').classList.remove('on'); $('sheet').classList.add('open'); sfx.sheet(true);
  },
  tiles() {
    const box = $('cards'); box.innerHTML = ''; tileEls = {}; let i = 0;
    const wide = (cls, icon, head, sub, extra = '') => { const el = document.createElement('button'); el.className = 'wide ' + cls; el.style.setProperty('--i', i++); el.innerHTML = (icon ? `<img class="ico" src="${ico(icon)}" alt="">` : '') + `<span class="tx"><span class="nm">${head}</span><span class="fx">${sub}</span></span>${extra}`; box.appendChild(el); return el; };
    if (S.read < notesOpen()) wide('bottle', 'bottle', 'a note washed up', `note ${S.read + 1} of ${NOTES.length}`, '<em>read</em>').onclick = () => openNote(S.read);
    const isNew = u => u.depth && !S.seen[u.id], opened = UP.filter(open), locked = UP.filter(u => !open(u));
    for (const u of [...opened.filter(isNew), ...opened.filter(u => !isNew(u))]) {
      const el = document.createElement('button'); el.style.setProperty('--i', i++); el._new = isNew(u);
      el.innerHTML = `<img class="ico" src="${ico(u.id)}" alt=""><span class="tx"><span class="nm">${u.name}${el._new ? '<i class="tag">new</i>' : ''}</span>${el._new ? `<span class="ds">${u.desc}</span>` : ''}<span class="fx"></span></span><span class="price"><i class="dot"></i><b></b></span>`;
      holdToBuy(el, u); tileEls[u.id] = el; box.appendChild(el);
    }
    if (locked.length) wide('locked', '', '? ? ?', `something new at depth ${locked[0].depth}`);
    const pe = pearlsFor(S.layer);
    if (pe > 0) wide('pearl', 'pearl', 'drain the pool', `restart with ${pe} pearl${pe > 1 ? 's' : ''} · +50% goo each`, '<em>drain</em>').onclick = () => {
      if (!confirm(`Start over from depth 1 and keep ${pe} pearl${pe > 1 ? 's' : ''}?`)) return;
      S = Object.assign(S, { goo: 0, layer: 1, best: 0, up: {}, seen: {}, sure: {}, pearls: S.pearls + pe }); save(); sfx.clear(); newRound({ got: 0, pct: 0, left: 9, cleared: true, combo: 0, total: 1 }); netDive(true);
    };
    this.refresh();
  },
  refresh(boughtId) {   // update the tiles in place, so nothing jumps
    for (const u of UP) {
      const el = tileEls[u.id]; if (!el) continue;
      const l = lv(u.id), c = cost(u), maxed = l >= u.max, can = !maxed && S.goo >= c;
      el.className = `tile ${u.cat} ${maxed ? 'maxed' : can ? 'can' : 'poor'}${el._new ? ' fresh' : ''}`;
      const [a, b] = fxPair(u.fx(l), u.fx(l + 1)); el.querySelector('.fx').innerHTML = maxed ? `<b>${u.fx(l)}</b>` : `${a}<i>→</i><b>${b}</b>`;
      el.querySelector('.price b').textContent = maxed ? 'max' : fmt(c);
      el.style.setProperty('--p', maxed ? '100%' : Math.min(100, S.goo / c * 100) + '%');
      if (u.id === boughtId) rebump(el, 'hit');
    }
  },
};
// purchases show up on the waiting board at once
function buy(u) {
  const c = cost(u);
  if (!open(u) || lv(u.id) >= u.max || S.goo < c) { sfx.deny(); buzz([6, 40, 6]); if (tileEls[u.id]) rebump(tileEls[u.id], 'no'); return false; }
  S.goo -= c; S.up[u.id] = lv(u.id) + 1;
  const plain = R.pods.filter(p => !p.dead && !p.type), pick = () => plain[Math.random() * plain.length | 0];
  if (u.id === 'power') for (const p of R.pods) p.sv += 10 + Math.random() * 6;
  if (u.id === 'gold' && plain.length) toType(pick(), 'gold');
  if (u.id === 'bomb' && plain.length) toType(pick(), 'bomb');
  if (u.id === 'tad') S.sure.tad = 1;
  if (u.id === 'drops') R.left = maxDrops();
  const t = performance.now(); streak = t - lastBuy < 2500 ? streak + 1 : 0; lastBuy = t;
  save(); sfx.buy(streak); buzz(12);
  if (!BOT) { if (tileEls[u.id]) fly($('goo'), tileEls[u.id].querySelector('.price')); ui.refresh(u.id); ui.pips(); rebump($('goo'), 'bump');
    if (lv(u.id) >= u.max && tileEls[u.id]) { arpeggio(8, 5, 60); burst(tileEls[u.id], 12); buzz([15, 30, 40]); } }   // maxing one out is an event
  return true;
}
$('go').onclick = () => { initAudio(); $('sheet').classList.remove('open'); startPlay(); sfx.tap(); sfx.sheet(false); };
$('shopBtn').onclick = () => { initAudio(); if (R.state !== 'play' || R.shots) return; R.state = 'shop'; aim = null; aimId = null; ui.shop(); };

// ── notes in bottles ──
let typing = 0, noteIdx = 0;
function openNote(i) {
  noteIdx = i; const text = NOTES[i], el = $('noteT'); let k = 0;
  const stop = () => { clearInterval(typing); el.textContent = text; el.classList.remove('typing'); };
  $('noteN').textContent = `note ${String(i + 1).padStart(2, '0')} / ${NOTES.length}`; el.textContent = ''; el.classList.add('typing'); $('note').classList.add('on'); sfx.paper();
  clearInterval(typing); typing = setInterval(() => { k++; el.textContent = text.slice(0, k); if (k % 2 === 0) sfx.type(); if (k >= text.length) stop(); }, 26);
  el.onclick = stop;
}
$('noteOk').onclick = () => {
  clearInterval(typing); $('note').classList.remove('on'); sfx.tap();
  if (noteIdx === S.read) { S.read++; save(); }
  if ($('sheet').classList.contains('open')) ui.tiles();
  if ($('menu').classList.contains('open')) renderNotes();
};
function renderNotes() {
  const n = notesOpen(), el = $('tabNotes');
  el.innerHTML = `<p class="sum"><b>${n}</b> of ${NOTES.length} bottles found</p>` + NOTES.map((t, i) => i < n
    ? `<button class="nt${i === S.read ? ' new' : i > S.read ? ' lock' : ''}" data-i="${i}"><b>${i + 1}</b><span>${i === S.read ? 'a new note. tap to read it.' : i > S.read ? 'unread' : t}</span></button>`
    : `<div class="nt lock"><b>${i + 1}</b><span>· · ·${i === n ? ' &nbsp;clear depth ' + (i + 1) : ''}</span></div>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => openNote(Math.min(+b.dataset.i, S.read)));
}

// ── the deep: where everyone else is ──
function renderDeep() {
  const el = $('tabDeep'), msg = (a, b) => `<div class="msg"><b>${a}</b>${b}</div>`;
  if (!ONLINE && !FAKE) { el.innerHTML = msg('the deep is quiet', 'other drops show up here once the game is online.'); return; }
  if (!world) {
    el.innerHTML = msg('listening…', 'counting drops in the dark.');
    netWorld().then(() => { if (world) renderDeep(); else el.innerHTML = msg("can't reach the deep", 'your dive is still safe on this device. try again in a bit.'); });
    return;
  }
  const w = world, mine = S.layer, counts = new Map(w.depths), maxD = Math.max(mine, ...w.depths.map(d => d[0]));
  const rank = 1 + w.deeps.reduce((a, [d, n]) => a + (d > S.deep ? n : 0), 0);
  let rows = '', gap = false, k = 0;
  for (let d = 1; d <= maxD; d++) {
    const n = counts.get(d) || 0; if (!n && d !== mine) { if (!gap) rows += '<div class="gap">· · ·</div>'; gap = true; continue; }
    gap = false; const shown = Math.min(Math.max(n, d === mine ? 1 : 0), 14);
    rows += `<div class="lv2${d === mine ? ' me' : ''}" style="--z:${ZONE_TINT[(d - 1) % ZONE_TINT.length]}"><b>${d}</b><span>${Array.from({ length: shown }, () => `<i style="--i:${k++}"></i>`).join('')}${n > shown ? `<em>+${n - shown}</em>` : ''}</span>${d === mine ? '<u>you</u>' : ''}</div>`;
  }
  el.innerHTML = `<p class="sum"><b>${fmt(w.divers)}</b> drops have dived · <b>${fmt(w.active)}</b> diving now<br>you are the <b>#${fmt(rank)}</b> deepest</p>${rows}
    <h4>deepest drops</h4>${w.top.map((t, i) => `<div class="tp"><b>${i + 1}</b><span>${esc(t.name)}</span><em>depth ${t.deep}${t.pearls ? ' · ' + t.pearls + '◦' : ''}</em></div>`).join('')}`;
}

// ── menu and settings ──
const TABS = { Notes: renderNotes, Deep: renderDeep, Set: renderSet };
const menu = {
  open(tab = S.read < notesOpen() ? 'Notes' : 'Set') { initAudio(); $('menu').classList.add('open'); this.tab(tab); sfx.sheet(true); },
  close() { $('menu').classList.remove('open'); sfx.sheet(false); },
  tab(name) {
    const names = Object.keys(TABS), i = names.indexOf(name);
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    names.forEach(n => $('tab' + n).classList.toggle('on', n === name));
    $('tabInk').style.translate = i * 100 + '% 0'; TABS[name]();
  },
};
$('menuBtn').onclick = () => menu.open();
$('menuX').onclick = () => menu.close();
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { sfx.tap(); menu.tab(b.dataset.tab); });

function renderSet() {
  document.querySelectorAll('.sw').forEach(b => b.classList.toggle('on', !!opt[b.dataset.opt]));
  $('buzzNote').textContent = navigator.vibrate ? '' : "this device can't vibrate from a web page";
  if (document.activeElement !== $('nameIn')) $('nameIn').value = me().name;
  $('hearts').textContent = S.hearts ? heartLine(S.hearts) : 'tap the heart';
}
document.querySelectorAll('.sw').forEach(b => b.onclick = () => {
  const k = b.dataset.opt; opt[k] = !opt[k]; b.classList.toggle('on', opt[k]); initAudio(); applyOpt(); save();
  sfx.flick(opt[k]); if (k === 'buzz' && opt.buzz) buzz(30);
});
document.querySelectorAll('.row').forEach(r => { const sw = r.querySelector('.sw'); if (sw) r.onclick = e => { if (e.target !== sw) sw.click(); }; });   // the whole row is the switch
$('nameIn').onchange = () => { S.name = $('nameIn').value.replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 14); $('nameIn').value = me().name; save(); world = null; netDive(true); };

// save codes: the whole save as one line of text
const packSave = () => 'bloop1.' + btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(S))));
function unpackSave(code) {
  const j = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(code.trim().replace(/^bloop1\./, '')), c => c.charCodeAt(0))));
  if (!j || typeof j.up !== 'object' || !(j.layer >= 1) || !(j.goo >= 0)) throw new Error('not a save');
  return j;
}
const flash = (b, text) => { const old = b.dataset.t || (b.dataset.t = b.textContent); b.textContent = text; setTimeout(() => b.textContent = old, 1600); };
$('expBtn').onclick = async () => {
  save(); const code = packSave(), box = $('saveBox'); box.value = code;
  try { await navigator.clipboard.writeText(code); flash($('expBtn'), 'copied!'); burst($('expBtn'), 7); sfx.buy(2); }
  catch (_) { box.focus(); box.select(); flash($('expBtn'), 'copy it from the box'); }
};
$('impBtn').onclick = () => {
  const code = $('saveBox').value; if (!code.trim()) { $('saveBox').focus(); flash($('impBtn'), 'paste a code first'); sfx.deny(); return; }
  let j; try { j = unpackSave(code); } catch (_) { flash($('impBtn'), "that code doesn't work"); rebump($('impBtn'), 'no'); sfx.deny(); return; }
  if (!confirm(`Load this save (depth ${j.layer}) over your current dive?`)) return;
  try { localStorage.setItem(SAVE, JSON.stringify(j)); } catch (_) {} location.reload();
};
$('introBtn').onclick = () => { S.intro = 0; save(); location.reload(); };
$('wipeBtn').onclick = () => { if (confirm('Erase all progress? This cannot be undone.')) { try { localStorage.removeItem(SAVE); } catch (_) {} location.reload(); } };
const heartLine = n => `${n} ♥ sent` + (n >= 100 ? '. the moon noticed.' : n >= 50 ? ". that's a lot of love." : n >= 10 ? '. bloop feels it.' : '');
$('heart').onclick = () => { S.hearts++; save(); rebump($('heart'), 'hit'); burst($('heart'), 5, 'h'); sfx.heart(S.hearts); buzz(10); $('hearts').textContent = heartLine(S.hearts); };

// ── cheat codes ──
const CHEATS = {
  gloop: () => { S.goo = Math.round(S.goo * 10 + 1000); return 'goo. lots of it.'; },
  deeper: () => jump(1, 'one depth down.'),
  abyss: () => jump(10, 'ten depths down.'),
  pearl: () => { S.pearls++; return 'a pearl rolls in.'; },
  rain: () => { if (R.state !== 'play') return 'that one only works mid-round.'; R.left += 5; return 'five more drops this round.'; },
  moon: () => { S.moon = 1; return 'every note washes up at once.'; },
};
function jump(n, text) {
  S.layer += n; S.deep = Math.max(S.deep, S.layer); S.best = 0;
  setTimeout(() => { menu.close(); newRound({ got: 0, pct: 0, left: 9, cleared: true, combo: 0, total: 1 }); }, 600);
  return text;
}
function cheat() {
  const box = $('cheatIn'), fn = CHEATS[box.value.trim().toLowerCase()], msg = $('cheatMsg');
  if (!fn) { msg.textContent = box.value.trim() ? 'nothing happens.' : ''; rebump($('cheatBtn'), 'no'); sfx.deny(); return; }
  msg.textContent = fn(); S.cheat = 1; box.value = ''; save(); sfx.buy(8); buzz(20); burst($('cheatBtn'), 6);
  ui.round(); if ($('sheet').classList.contains('open')) ui.refresh();
}
$('cheatBtn').onclick = cheat; $('cheatIn').onkeydown = e => { if (e.key === 'Enter') cheat(); };

// ── wordmark: the dot hops when you poke it ──
function logoInto(el) {
  el.innerHTML = 'bloop<i></i>in'; let n = 0;
  el.onpointerdown = e => { e.stopPropagation(); initAudio(); rebump(el, 'hop'); sfx.letter(n++ % 8); buzz(6); };
}
['logoSm', 'logoCr'].forEach(id => logoInto($(id)));

// ── title and intro ──
function enterGame() {
  titleOn = false;
  stage.classList.remove('cine', 'story'); $('story').classList.remove('on');
  ui.round(); zoneBanner(); netDive(true);
}
function showTitle() {
  $('where').textContent = S.rounds ? `depth ${S.layer}` + (S.pearls ? ` · ${S.pearls} pearl${S.pearls > 1 ? 's' : ''}` : '') : '';
  $('diveBtn').textContent = S.rounds ? 'tap to continue' : 'tap to begin';
  let gone = false;
  $('title').onclick = () => {
    if (gone) return; gone = true; initAudio();
    dropLogo(); sfx.fire(); $('title').classList.add('off');   // the name rains into the pool
    setTimeout(() => S.intro ? enterGame() : runIntro(), 1400);
  };
}
// The opening: a drip wakes up at the tap. It ends by handing the first round to the player.
function runIntro() {
  const pods = R.pods; let i = -1, timer = 0, drip = 0, done = false;
  R.pods = []; R.left = 0; R.state = 'intro'; stage.classList.add('cine', 'story'); $('story').classList.add('on');
  const say = (text, big) => { const c = $('cap'); let k = 0; c.className = big ? 'big' : ''; c.innerHTML = text.split('\n').map(l => l.split(' ').map(w => `<span style="--i:${k++}">${w}</span>`).join(' ')).join('<br>'); };
  const steps = [
    { t: 'far above everything,\nan old tap drips.', d: 3600, on() { drip = setInterval(() => { if (R.state === 'intro') addBall(LX, LY + 6, rnd(-10, 10), 20, { mini: true }); }, 650); } },
    { t: 'one day, a drip woke up\nand looked down.', d: 3600, on() { clearInterval(drip); R.left = 1; R.cool = .22; sfx.letter(2); } },
    { t: 'this is bloop.', big: true, d: 2800, on() { arpeggio(5, 4, 110); } },
    { t: "they say there's a sea down there.\nfar, far down.", d: 3800, on() { for (let x = 10; x < GW; x += 20) pool.splash(x, 60); sfx.sink(GW / 2, true); } },
    { t: 'the way is full of sleepy pods.', d: 3400, on() { R.pods = pods; for (const p of pods) p.born = -(.1 + Math.random() * .9); arpeggio(0, 8, 120); } },
    { t: 'wake them up.\nthey love to come along.', d: 3200 },
  ];
  const next = () => { clearTimeout(timer); if (done) return; if (++i >= steps.length) return end(); const s = steps[i]; say(s.t, s.big); s.on && s.on(); timer = setTimeout(next, s.d); };
  const end = () => {
    if (done) return; done = true; clearTimeout(timer); clearInterval(drip); if (!R.pods.length) R.pods = pods;
    S.intro = 1; save(); R.state = 'play'; R.left = maxDrops(); R.cool = .4; R.shots = 0; $('story').onclick = null; enterGame();
  };
  $('story').onclick = e => { sfx.tap(); e.target.id === 'skip' ? end() : next(); };
  next();
}
