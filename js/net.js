'use strict';
// ══════════════════════════ the deep (online) ══════════════════════════
// A tiny client for the shared board. It sends a random id, the name the
// player chose, and how deep they are; it gets back where everyone else is.
// The game is fully playable without it: every call fails quietly.
const API = '/api', FAKE = params.has('fakeworld'), ONLINE = !BOT && /^https?:$/.test(location.protocol);
const NAME_A = ['sleepy', 'brave', 'tiny', 'wobbly', 'shy', 'jolly', 'salty', 'dizzy', 'lucky', 'gloopy', 'quiet', 'round'];
const NAME_B = ['drop', 'drip', 'puddle', 'bubble', 'ripple', 'splash', 'dew', 'mist'];
let world = null, lastDive = 0;

function me() {
  if (!S.id) S.id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
  if (!S.name) S.name = NAME_A[Math.random() * NAME_A.length | 0] + ' ' + NAME_B[Math.random() * NAME_B.length | 0];
  return { id: S.id, name: S.name, depth: S.layer, deep: S.deep, pearls: S.pearls };
}
async function netDive(force) {
  if (!ONLINE || S.cheat) return; const t = Date.now();   // saves that used cheat codes stay off the board if (!force && t - lastDive < 20000) return; lastDive = t;
  try { const r = await fetch(API + '/dive', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(me()) }); if (r.ok) world = await r.json(); } catch (_) {}
}
async function netWorld() {
  if (FAKE) { world = fakeWorld(); return; }
  if (!ONLINE) return;
  try { const r = await fetch(API + '/world'); if (r.ok) world = await r.json(); } catch (_) {}
}
// sample data for looking at the board without a server (?fakeworld)
function fakeWorld() {
  const depths = [], deeps = []; let divers = 0;
  for (let d = 1; d <= 34; d++) { const n = Math.round(60 * Math.exp(-d / 6) * (.6 + Math.random() * .8)) + (d % 9 === 0 ? 2 : 0); if (n) { depths.push([d, n]); deeps.push([d + 2, n]); divers += n; } }
  const top = [34, 33, 31, 31, 29, 27, 26, 26, 24, 23].map((deep, i) => ({ name: NAME_A[i] + ' ' + NAME_B[i % 8], deep, pearls: i < 3 ? 3 - i : 0 }));
  return { divers, active: 7, depths, deeps, top };
}
