'use strict';
// ══════════════════════════ juice ══════════════════════════
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const fmt = n => { n = Math.floor(n); if (n < 1e4) return n.toLocaleString(); const u = ['k', 'M', 'B', 'T', 'q', 'Q']; let i = -1; while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; } return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : n.toFixed(0)) + u[i]; };
const params = new URLSearchParams(location.search), BOT = +params.get('bot') || 0, AUTO = params.has('auto');
let now = 0, shakeAmt = 0;
const shake = a => { shakeAmt = Math.min(7, Math.max(shakeAmt, a)); };
let opt = { music: true, sfx: true, buzz: true };   // player settings
const buzz = ms => { if (BOT || !opt.buzz) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} };
function popup(x, y, text, cls) {
  if (BOT) return; const st = $('stage'); if (st.querySelectorAll('.pop').length > 16) return;
  const e = document.createElement('div'); e.className = 'pop ' + (cls || ''); e.textContent = text;
  e.style.left = x / GW * 100 + '%'; e.style.top = y / GH * 100 + '%';
  e.onanimationend = () => e.remove(); st.appendChild(e);
}
function toast(text) { if (BOT) return; const t = $('toast'); t.textContent = text; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); }

