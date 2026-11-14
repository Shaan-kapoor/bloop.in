// The shared board behind "the deep": a Cloudflare Pages Function backed by D1.
//
//   GET  /api/world  -> where everyone is
//   POST /api/dive   -> report where you are, and get the world back
//
// It needs one D1 database bound as `DB`. Tables are created on first use.
// The aggregate is recomputed at most once every TTL and kept in a one-row
// cache table, so a busy game costs a single row read per request.

const TTL = 30_000;        // how stale the board may be
const MIN_GAP = 15_000;    // how often one player may write

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS divers (
     id TEXT PRIMARY KEY, name TEXT NOT NULL,
     depth INTEGER NOT NULL, deep INTEGER NOT NULL, pearls INTEGER NOT NULL DEFAULT 0,
     seen INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS divers_deep ON divers (deep DESC)`,
  `CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL)`,
];

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(Number(v)) || lo));
const cleanName = s => String(s ?? '').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'a drop';

let ready = false;
async function init(db) {
  if (ready) return;
  await db.batch(SCHEMA.map(q => db.prepare(q)));
  ready = true;
}

async function world(db) {
  const now = Date.now();
  const hit = await db.prepare('SELECT v, at FROM cache WHERE k = ?').bind('world').first();
  if (hit && now - hit.at < TTL) return JSON.parse(hit.v);

  const [depths, deeps, top, totals] = await db.batch([
    db.prepare('SELECT depth, COUNT(*) AS n FROM divers GROUP BY depth ORDER BY depth'),
    db.prepare('SELECT deep, COUNT(*) AS n FROM divers GROUP BY deep ORDER BY deep'),
    db.prepare('SELECT name, deep, pearls FROM divers ORDER BY deep DESC, pearls DESC, seen ASC LIMIT 20'),
    db.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(seen > ?), 0) AS active FROM divers').bind(now - 10 * 60_000),
  ]);
  const w = {
    at: now,
    divers: totals.results[0].total,
    active: totals.results[0].active,
    depths: depths.results.map(r => [r.depth, r.n]),   // where people are right now
    deeps: deeps.results.map(r => [r.deep, r.n]),      // the deepest each has ever been
    top: top.results,
  };
  await db.prepare('INSERT INTO cache (k, v, at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, at = excluded.at')
    .bind('world', JSON.stringify(w), now).run();
  return w;
}

async function dive(db, request) {
  if (Number(request.headers.get('content-length') || 0) > 2000) return json({ error: 'too big' }, 413);
  const b = await request.json().catch(() => null);
  if (!b || typeof b.id !== 'string' || !/^[a-z0-9-]{8,48}$/i.test(b.id)) return json({ error: 'bad request' }, 400);
  const depth = int(b.depth, 1, 9999), deep = Math.max(depth, int(b.deep, 1, 9999)), now = Date.now();
  await db.prepare(
    `INSERT INTO divers (id, name, depth, deep, pearls, seen) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, depth = excluded.depth,
       deep = MAX(divers.deep, excluded.deep), pearls = MAX(divers.pearls, excluded.pearls), seen = excluded.seen
     WHERE excluded.seen - divers.seen >= ?`
  ).bind(b.id, cleanName(b.name), depth, deep, int(b.pearls, 0, 99999), now, MIN_GAP).run();
  return json(await world(db));
}

export async function onRequest({ request, env, params }) {
  if (!env.DB) return json({ error: 'no database bound as DB' }, 503);
  const route = [].concat(params.path || []).join('/');
  try {
    await init(env.DB);
    if (route === 'world' && request.method === 'GET') return json(await world(env.DB));
    if (route === 'dive' && request.method === 'POST') return dive(env.DB, request);
    return json({ error: 'not found' }, 404);
  } catch (e) {
    return json({ error: 'the deep is having a moment' }, 500);
  }
}
