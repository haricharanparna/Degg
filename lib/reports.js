// Validation, storage and aggregation of signed Nostr price reports.
import { verifyEvent } from 'nostr-tools';
import { db } from './db.js';
import { productById, marketById, BOUNDS, MARKETS } from './catalog.js';

export const REPORT_KIND = 1; // plain note, readable in any Nostr client
export const TAG = 'degg-price';
const DAY = 86400;
const WINDOW = 7 * DAY;

const tag = (ev, name) => ev.tags.find(t => t[0] === name)?.[1];

// Returns { ok, error, report }. Never trusts client data without a valid signature.
export function validateReportEvent(ev, now = Math.floor(Date.now() / 1000)) {
  if (!ev || typeof ev !== 'object' || !Array.isArray(ev.tags)) return { ok: false, error: 'bad_event' };
  if (ev.kind !== REPORT_KIND || !ev.tags.some(t => t[0] === 't' && t[1] === TAG)) return { ok: false, error: 'not_a_price_report' };
  if (JSON.stringify(ev).length > 4000) return { ok: false, error: 'too_large' };
  // Verify a plain copy: nostr-tools caches a 'verified' symbol on objects it signed itself.
  if (!verifyEvent(JSON.parse(JSON.stringify(ev)))) return { ok: false, error: 'bad_signature' };
  if (ev.created_at > now + 600 || ev.created_at < now - WINDOW) return { ok: false, error: 'bad_timestamp' };
  const product = tag(ev, 'product'), market = tag(ev, 'market');
  const priceTag = ev.tags.find(t => t[0] === 'price');
  if (!productById[product]) return { ok: false, error: 'unknown_product' };
  if (!marketById[market]) return { ok: false, error: 'unknown_market' };
  if (!priceTag || priceTag[2] !== 'XOF' || !/^\d{2,6}$/.test(priceTag[1])) return { ok: false, error: 'bad_price' };
  const price = Number(priceTag[1]);
  const [lo, hi] = BOUNDS[product];
  if (price < lo || price > hi) return { ok: false, error: 'price_out_of_bounds' };
  let lud16 = tag(ev, 'lud16') || null;
  if (lud16 && !/^[a-z0-9._-]{1,64}@[a-z0-9.-]{3,253}$/i.test(lud16)) return { ok: false, error: 'bad_lightning_address' };
  return { ok: true, report: { id: ev.id, pubkey: ev.pubkey, created_at: ev.created_at, product, market, price,
    note: String(ev.content || '').slice(0, 280), lud16, demo: tag(ev, 'demo') === '1' ? 1 : 0 } };
}

export const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

// AI does not decide truth; this flags reports that deviate strongly from what others observed.
export function flagFor(product, price, since) {
  const rows = db.prepare('SELECT price FROM reports WHERE product = ? AND created_at >= ?').all(product, since);
  if (rows.length < 3) return null;
  const med = median(rows.map(r => r.price));
  const dev = (price - med) / med;
  return Math.abs(dev) > 0.5 ? `${dev > 0 ? '+' : ''}${Math.round(dev * 100)}% vs median ${med} XOF` : null;
}

export function insertReport(r, ev) {
  const flag = flagFor(r.product, r.price, r.created_at - WINDOW);
  db.prepare(`INSERT OR IGNORE INTO reports (id, pubkey, created_at, product, market, price, note, lud16, demo, flag, event)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(r.id, r.pubkey, r.created_at, r.product, r.market, r.price, r.note, r.lud16, r.demo, flag, JSON.stringify(ev));
  return flag;
}

export function recentCountByPubkey(pubkey, seconds) {
  return db.prepare('SELECT COUNT(*) n FROM reports WHERE pubkey = ? AND created_at >= ?').get(pubkey, Math.floor(Date.now() / 1000) - seconds).n;
}

// Confidence 0–100: distinct reporters, community confirmations and freshness; flagged reports count less.
function confidence(rows, confirms, now) {
  if (!rows.length) return 0;
  const reporters = new Set(rows.map(r => r.pubkey)).size;
  const fresh = Math.max(0, 1 - (now - Math.max(...rows.map(r => r.created_at))) / (3 * DAY));
  const flaggedShare = rows.filter(r => r.flag).length / rows.length;
  const score = 35 * Math.min(reporters / 4, 1) + 25 * Math.min(confirms / 5, 1) + 40 * fresh;
  return Math.round(score * (1 - 0.5 * flaggedShare));
}

export function marketPrices(product, now = Math.floor(Date.now() / 1000)) {
  const since = now - WINDOW;
  const rows = db.prepare('SELECT * FROM reports WHERE product = ? AND created_at >= ?').all(product, since);
  const confirms = db.prepare(`SELECT r.market, COUNT(c.pubkey) n FROM confirms c JOIN reports r ON r.id = c.report_id
    WHERE r.product = ? AND r.created_at >= ? GROUP BY r.market`).all(product, since);
  const confirmBy = Object.fromEntries(confirms.map(c => [c.market, c.n]));
  const markets = MARKETS.map(m => {
    const mr = rows.filter(r => r.market === m.id);
    const clean = mr.filter(r => !r.flag).map(r => r.price);
    const prices = clean.length ? clean : mr.map(r => r.price);
    const recent = mr.filter(r => r.created_at >= now - 3 * DAY).map(r => r.price);
    const older = mr.filter(r => r.created_at < now - 3 * DAY).map(r => r.price);
    const trend = recent.length && older.length ? Math.round(((median(recent) - median(older)) / median(older)) * 100) : null;
    return { market: m.id, name: m.name, reports: mr.length, median: median(prices),
      min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null,
      last: mr.length ? Math.max(...mr.map(r => r.created_at)) : null, trend,
      confidence: confidence(mr, confirmBy[m.id] || 0, now), demo: mr.length > 0 && mr.every(r => r.demo) };
  }).filter(m => m.reports > 0).sort((a, b) => a.median - b.median);
  const all = rows.filter(r => !r.flag).map(r => r.price);
  return { product, unit: productById[product].unit, overall: median(all), markets, history: history(product, now) };
}

// Daily median for the last 14 days (sparkline).
export function history(product, now) {
  const rows = db.prepare('SELECT price, created_at FROM reports WHERE product = ? AND created_at >= ? AND flag IS NULL').all(product, now - 14 * DAY);
  const out = [];
  for (let d = 13; d >= 0; d--) {
    const start = now - (d + 1) * DAY, end = now - d * DAY;
    out.push(median(rows.filter(r => r.created_at >= start && r.created_at < end).map(r => r.price)));
  }
  return out;
}

export function listReports(product, market, limit = 30) {
  return db.prepare(`SELECT r.id, r.pubkey, r.created_at, r.market, r.price, r.note, r.lud16, r.demo, r.flag, r.event,
      (SELECT COUNT(*) FROM confirms c WHERE c.report_id = r.id) confirms,
      (SELECT COALESCE(SUM(sats),0) FROM tips t WHERE t.report_id = r.id) tipped
    FROM reports r WHERE r.product = ? AND (? IS NULL OR r.market = ?) ORDER BY r.created_at DESC LIMIT ?`)
    .all(product, market ?? null, market ?? null, limit).map(r => ({ ...r, event: JSON.parse(r.event) }));
}

// A confirmation is a signed NIP-25 reaction (kind 7, "+") referencing the report.
export function validateConfirm(ev) {
  if (!ev || ev.kind !== 7 || ev.content !== '+' || !Array.isArray(ev.tags) || !verifyEvent(JSON.parse(JSON.stringify(ev)))) return { ok: false, error: 'bad_confirmation' };
  const reportId = tag(ev, 'e');
  const rep = reportId && db.prepare('SELECT pubkey FROM reports WHERE id = ?').get(reportId);
  if (!rep) return { ok: false, error: 'unknown_report' };
  if (rep.pubkey === ev.pubkey) return { ok: false, error: 'cannot_confirm_own_report' };
  db.prepare('INSERT OR IGNORE INTO confirms (report_id, pubkey, created_at) VALUES (?, ?, ?)').run(reportId, ev.pubkey, ev.created_at);
  return { ok: true };
}
