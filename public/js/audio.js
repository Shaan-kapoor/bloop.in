'use strict';
// ══════════════════════════ audio ══════════════════════════
// Everything is synthesised. Effects are pitched water-drop "bloops" on an
// A-major pentatonic scale, layered with short noise for body. The soundtrack
// is in the same key, so every pop lands in tune with it.
let ac, master, sfxBus, musBus, musLP, verb, noiseBuf, lastB = 0, lastPop = 0;
function applyOpt() {
  if (!ac) return; const t = ac.currentTime;
  sfxBus.gain.setTargetAtTime(opt.sfx ? 1 : 0, t, .05); musBus.gain.setTargetAtTime(opt.music ? .6 : 0, t, .5);
}
function initAudio() {
  if (BOT) return;
  if (ac) { if (ac.state !== 'running') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const sr = ac.sampleRate, comp = ac.createDynamicsCompressor();
    master = ac.createGain(); master.gain.value = .9; master.connect(comp); comp.connect(ac.destination);
    const ir = ac.createBuffer(2, sr * 3, sr);   // a soft synthetic hall
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length) ** 2.8; }
    verb = ac.createConvolver(); verb.buffer = ir; const wet = ac.createGain(); wet.gain.value = .55; verb.connect(wet); wet.connect(master);
    sfxBus = ac.createGain(); sfxBus.connect(master); const s1 = ac.createGain(); s1.gain.value = .2; sfxBus.connect(s1); s1.connect(verb);
    musLP = ac.createBiquadFilter(); musLP.type = 'lowpass'; musLP.frequency.value = 1300; musLP.Q.value = .3;
    musBus = ac.createGain(); musBus.gain.value = 0; musBus.connect(musLP); musLP.connect(master); const s2 = ac.createGain(); s2.gain.value = .8; musLP.connect(s2); s2.connect(verb);
    noiseBuf = ac.createBuffer(1, sr, sr); { const d = noiseBuf.getChannelData(0); for (let k = 0; k < sr; k++) d[k] = Math.random() * 2 - 1; }
    applyOpt(); musT = ac.currentTime + .2; setInterval(musSched, 90);
  } catch (_) { ac = null; }
}
const note = i => 220 * 2 ** (([0, 2, 4, 7, 9][i % 5] + 12 * Math.floor(i / 5)) / 12);
const noteC = i => note(i < 15 ? i : 10 + i % 5);   // past the top of the scale, keep dancing in the top octave
function tone(freq, dur = .16, vol = .1, o = {}) {
  if (!ac || !opt.sfx && !o.bus) return; const t = Math.max(ac.currentTime, o.t || 0) + (o.at || 0);
  const os = ac.createOscillator(), g = ac.createGain(); os.type = o.type || 'sine';
  os.frequency.setValueAtTime(freq * (o.from || 1), t);
  if (o.from) os.frequency.exponentialRampToValueAtTime(freq, t + (o.glide || .045));
  if (o.to) os.frequency.exponentialRampToValueAtTime(freq * o.to, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.att || .006)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  let outNode = g; if (o.pan && ac.createStereoPanner) { const pn = ac.createStereoPanner(); pn.pan.value = o.pan; g.connect(pn); outNode = pn; }
  os.connect(g); outNode.connect(o.bus || sfxBus); os.start(t); os.stop(t + dur + .05);
}
function noise(dur, vol, o = {}) {
  if (!ac || !opt.sfx) return; const t = ac.currentTime + (o.at || 0);
  const src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = noiseBuf;
  fl.type = o.type || 'bandpass'; fl.frequency.setValueAtTime(o.f || 1500, t); fl.Q.value = o.q || .8;
  if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(fl); fl.connect(g); g.connect(sfxBus); src.start(t, Math.random() * .5, dur + .05);
}
function bloop(freq = 440, dur = .16, vol = .12) { if (!ac) return; const t = ac.currentTime; if (t - lastB < .02) return; lastB = t; tone(freq, dur, vol, { from: .55 }); }
const arpeggio = (from, n, gap = 70) => { if (!ac) return; for (let i = 0; i < n; i++) tone(note(from + i), .34, .12, { from: .55, at: i * gap / 1000 }); };
const pan = x => clamp((x / GW - .5) * 1.4, -1, 1);
const sfx = {
  fire() { tone(300, .24, .13, { from: 1.7, glide: .13 }); noise(.14, .035, { f: 700, f2: 3200 }); },
  hit(i, x) { bloop(noteC(i), .15, .07); noise(.035, .045, { f: 2400, q: 1.5 }); },
  pop(i, x, gold) {
    const n = noteC(i), t = ac ? ac.currentTime : 0; if (t - lastPop < .012) return; lastPop = t; tone(n, .26, .1, { from: .55 });
    tone(n * 2, .14, .035, { from: .7, type: 'triangle', pan: pan(x) }); noise(.06, .05, { type: 'highpass', f: 3200 });
    if (i % 5 === 4) tone(n * 1.5, .3, .05, { type: 'triangle', at: .03 });
    if (gold) { tone(note(12), .5, .07, { type: 'triangle' }); tone(note(14), .6, .06, { type: 'triangle', at: .07 }); }
  },
  plop(k, x) { tone(note(10 + k % 5), .07, .028, { pan: pan(x) }); },
  sink(x, big) { tone(190, .32, big ? .14 : .05, { to: .45 }); tone(380, .16, big ? .05 : .02, { to: .5, type: 'triangle' }); noise(.28, big ? .08 : .03, { type: 'lowpass', f: 1400, f2: 300 }); },
  fizz() { noise(.18, .04, { type: 'highpass', f: 2500, f2: 7000 }); tone(500, .12, .03, { to: 1.6 }); },
  skip() { tone(260, .28, .13, { to: 2.2 }); noise(.2, .05, { type: 'lowpass', f: 1400, f2: 300 }); },
  split() { tone(note(7), .2, .09, { from: .5 }); tone(note(9), .2, .08, { from: .5, at: .05 }); },
  spit(x) { tone(170, .3, .12, { from: 1.7, glide: .16, pan: pan(x) }); noise(.12, .03, { f: 500, f2: 1800 }); },
  nib(x) { tone(150, .09, .05, { to: .7, pan: pan(x) }); },
  yawn() { tone(392, .7, .08, { type: 'triangle', to: .5, att: .12 }); tone(196, .7, .05, { to: .5, at: .05, att: .1 }); },
  boom() { tone(95, .55, .3, { to: .32 }); tone(240, .35, .16, { to: .3, type: 'triangle' }); noise(.45, .24, { type: 'lowpass', f: 2600, f2: 200 }); },
  buy(l) { const k = 3 + Math.min(l, 10);   // a run of purchases climbs the scale
    tone(note(k), .3, .1, { type: 'triangle' }); tone(note(k) * 1.5, .4, .08, { type: 'triangle', at: .08 }); tone(note(k) * 2, .6, .07, { type: 'triangle', at: .16 }); noise(.3, .02, { type: 'highpass', f: 6000, at: .16 }); },
  deny() { tone(230, .13, .08, { type: 'triangle', to: .75 }); },
  tap() { tone(660, .06, .05, { from: .8 }); },
  flick(on) { tone(on ? 620 : 420, .09, .06, { from: on ? .7 : 1.3 }); },
  sheet(up) { noise(.22, .035, { f: up ? 350 : 1500, f2: up ? 1700 : 300, q: .6 }); },
  tick(k) { tone(note(8 + k % 7), .06, .045); },
  type() { tone(900 + Math.random() * 500, .03, .018, { type: 'triangle' }); },
  near() { tone(note(3), .35, .08, { type: 'triangle', to: .94 }); },
  letter(i) { tone(note(i + 3), .3, .09, { from: .5 }); },
  paper() { noise(.35, .05, { f: 2600, f2: 900, q: .5 }); tone(note(9), .7, .05, { type: 'triangle', at: .1 }); tone(note(11), .9, .045, { type: 'triangle', at: .22 }); },
  heart(n) { const k = 5 + n % 10; tone(note(k), .25, .08, { from: .6 }); tone(note(k + 2), .4, .06, { type: 'triangle', at: .07 }); },
  zone() { for (let i = 0; i < 4; i++) tone(note([5, 7, 9, 12][i]), 1.4, .04, { type: 'triangle', at: i * .12, att: .03 }); },
  clear() {
    arpeggio(5, 10, 80);
    for (const m of [57, 64, 69, 73, 76]) tone(440 * 2 ** ((m - 69) / 12), 2.4, .05, { type: 'triangle', att: .05, at: .1 });
    noise(1.2, .03, { type: 'highpass', f: 5000, at: .2 });
  },
};

// ── soundtrack ──
// Eight slow bars in A major. The chords are voiced so that only one or two
// notes move from one bar to the next and the rest are held, and each pad
// fades out underneath the next one, so the harmony glides instead of jumping.
// No chord contains a note that clashes with the pentatonic melody or the pops.
const PROG = [
  { b: 45, v: [52, 59, 61, 64] },   // A add9
  { b: 42, v: [52, 57, 61, 64] },   // F#m7      (B falls to A)
  { b: 38, v: [54, 57, 61, 64] },   // D maj9    (E rises to F#)
  { b: 40, v: [52, 57, 59, 64] },   // E sus4
  { b: 45, v: [52, 57, 61, 66] },   // A 6
  { b: 47, v: [54, 57, 62, 66] },   // B m7
  { b: 38, v: [54, 57, 61, 66] },   // D maj7    (D falls to C#)
  { b: 40, v: [52, 59, 64, 66] },   // E add9, no third: leans back toward A
];
const PENT = [69, 71, 73, 76, 78, 81, 83, 85], RHYTHMS = ['x..x.x..x.......', 'x.x...x.x.......', '..x.x.x...x.....', 'x...x..x..x.....'];
const mtof = m => 440 * 2 ** ((m - 69) / 12), SPB = .5;   // one step is an eighth note at 60 bpm
let musT = 0, musStep = 0, musHeat = 0, phA = null, phB = null;
function pad(m, t, dur, vol, pn) {
  for (const [type, cents, k] of [['sine', 0, 1], ['triangle', 6, .45]]) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = mtof(m); o.detune.value = cents;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * k, t + 2.6); g.gain.setValueAtTime(vol * k, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 3.4);
    let n = g; if (ac.createStereoPanner) { n = ac.createStereoPanner(); n.pan.value = pn; g.connect(n); }
    o.connect(g); n.connect(musBus); o.start(t); o.stop(t + dur + 3.5);
  }
}
// a short melodic phrase: a fixed rhythm, moving by small steps, with room to breathe at the end
function phrase(start) {
  const r = RHYTHMS[Math.random() * RHYTHMS.length | 0]; let n = start;
  return [...r].map(c => c === 'x' ? (n = clamp(n + [-2, -1, -1, 0, 1, 1, 2][Math.random() * 7 | 0], 0, PENT.length - 1)) : -1);
}
function musSched() {
  if (!ac || ac.state !== 'running' || !opt.music) { if (ac) musT = Math.max(musT, ac.currentTime + .1); return; }
  const heat = R ? clamp(R.combo / 18, 0, 1) : 0; musHeat += (heat - musHeat) * .15;
  musLP.frequency.setTargetAtTime((R && R.state === 'shop' ? 800 : 1300) + 2600 * musHeat, ac.currentTime, .4);
  while (musT < ac.currentTime + .4) {
    const k = musStep % 16, bar = (musStep >> 4) % 8, ch = PROG[bar], t = musT;
    if (k === 0) {
      if (!phA || bar === 0 && Math.random() < .5) { phA = phrase(2); phB = phrase(4); }   // keep a tune around long enough to recognise it
      ch.v.forEach((m, i) => pad(m, t, SPB * 16, .026, (i - 1.5) * .3));
      tone(mtof(ch.b), 4.5, .1, { bus: musBus, t, att: .06 }); tone(mtof(ch.b + 12), 3.5, .035, { bus: musBus, t, att: .06, type: 'triangle' });
    }
    if (k === 8) tone(mtof(ch.b + 12), 3, .03, { bus: musBus, t, att: .05, type: 'triangle' });
    if (k % 4 === 2) tone(mtof(ch.v[[0, 2, 1, 3][(k - 2) >> 2]] + 12), 1.2, .014 + musHeat * .02, { bus: musBus, t, att: .01, pan: k < 8 ? -.4 : .4 });
    const n = (bar % 4 === 2 ? phB : phA)[k];   // call, call, answer, call
    if (n >= 0) tone(mtof(PENT[n]), 1.7, .032 + musHeat * .02, { bus: musBus, t, type: 'triangle', att: .008, pan: (n - 3.5) * .12 });
    musStep++; musT += SPB;
  }
}
