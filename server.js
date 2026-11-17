// Dëgg server: static PWA + JSON API. Zero framework, one dependency (nostr-tools).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SimplePool } from 'nostr-tools';
import { PRODUCTS, MARKETS, productById, marketById } from './lib/catalog.js';
import { validateReportEvent, insertReport, marketPrices, listReports, validateConfirm, recentCountByPubkey } from './lib/reports.js';
import { parseReport, summarize } from './lib/ai.js';
import { createDeposit, consumeDeposit, invoiceForAddress, recordTip, walletMode, DEPOSIT_SATS } from './lib/lightning.js';
import { db } from './lib/db.js';

const PORT = Number(process.env.PORT || 8080);
const REQUIRE_DEPOSIT = process.env.REQUIRE_DEPOSIT !== '0';
const RELAYS = (process.env.RELAYS || '').split(',').map(s => s.trim()).filter(Boolean);
const pool = RELAYS.length ? new SimplePool() : null;

const STATIC = { '/': 'public/index.html', '/vendor/nostr.bundle.js': 'node_modules/nostr-tools/lib/nostr.bundle.js' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const SECURITY_HEADERS = {
  'content-security-policy': "default-src 'self'; connect-src 'self' wss: ws:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'permissions-policy': 'camera=(), geolocation=()',
};

// Simple in-memory rate limiter keyed by a coarse bucket. IPs are never logged or stored.
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(), h = hits.get(key) || { n: 0, t: now };
  if (now - h.t > windowMs) { h.n = 0; h.t = now; }
  h.n++; hits.set(key, h);
  return h.n > max;
}
setInterval(() => hits.clear(), 10 * 60 * 1000).unref();

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...SECURITY_HEADERS, ...headers });
  res.end(JSON.stringify(body));
};

async function readJson(req, max = 8192) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > max) throw Object.assign(new Error('too_large'), { status: 413 }); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('bad_json'), { status: 400 }); }
}

const routes = {
  'GET /api/config': () => ({ products: PRODUCTS, markets: MARKETS, wallet: walletMode,
    depositSats: REQUIRE_DEPOSIT ? DEPOSIT_SATS : 0, ai: Boolean(process.env.ANTHROPIC_API_KEY), relays: RELAYS }),

  'GET /api/prices': async (q) => {
    if (!productById[q.product]) throw Object.assign(new Error('unknown_product'), { status: 400 });
    const data = marketPrices(q.product);
    return { ...data, summary: await summarize(q.lang === 'en' ? 'en' : 'fr', data) };
  },

  'GET /api/reports': (q) => {
    if (!productById[q.product]) throw Object.assign(new Error('unknown_product'), { status: 400 });
    if (q.market && !marketById[q.market]) throw Object.assign(new Error('unknown_market'), { status: 400 });
    return { reports: listReports(q.product, q.market || null) };
  },

  'POST /api/parse': async (q, body, ctx) => {
    if (limited(`parse:${ctx.bucket}`, 30, 60_000)) throw Object.assign(new Error('slow_down'), { status: 429 });
    return parseReport(body.text);
  },

  'POST /api/deposit': async (q, body, ctx) => {
    if (limited(`dep:${ctx.bucket}`, 10, 60_000)) throw Object.assign(new Error('slow_down'), { status: 429 });
    return createDeposit();
  },

  'POST /api/reports': async (q, body) => {
    const v = validateReportEvent(body.event);
    if (!v.ok) throw Object.assign(new Error(v.error), { status: 400 });
    if (v.report.demo) throw Object.assign(new Error('demo_reports_only_via_seed'), { status: 400 });
    if (recentCountByPubkey(v.report.pubkey, 3600) >= 20) throw Object.assign(new Error('slow_down'), { status: 429 });
    if (REQUIRE_DEPOSIT && !(await consumeDeposit(body.payment_hash))) throw Object.assign(new Error('deposit_required'), { status: 402 });
    const flag = insertReport(v.report, body.event);
    pool?.publish(RELAYS, body.event); // best effort: mirror to public relays
    return { ok: true, id: v.report.id, flag };
  },

  'POST /api/confirm': (q, body) => {
    const v = validateConfirm(body.event);
    if (!v.ok) throw Object.assign(new Error(v.error), { status: 400 });
    pool?.publish(RELAYS, body.event);
    return { ok: true };
  },

  'POST /api/tip-invoice': async (q, body) => {
    const sats = Number(body.sats);
    if (!Number.isInteger(sats) || sats < 1 || sats > 10000) throw Object.assign(new Error('bad_amount'), { status: 400 });
    const rep = db.prepare('SELECT lud16 FROM reports WHERE id = ?').get(String(body.report_id || ''));
    if (!rep) throw Object.assign(new Error('unknown_report'), { status: 404 });
    if (!rep.lud16) throw Object.assign(new Error('contributor_has_no_lightning_address'), { status: 409 });
    return { invoice: await invoiceForAddress(rep.lud16, sats) };
  },

  'POST /api/tips': (q, body) => {
    const rep = db.prepare('SELECT id FROM reports WHERE id = ?').get(String(body.report_id || ''));
    if (!rep) throw Object.assign(new Error('unknown_report'), { status: 404 });
    if (body.demo) {
      const sats = Number(body.sats);
      if (!Number.isInteger(sats) || sats < 1 || sats > 1000) throw Object.assign(new Error('bad_amount'), { status: 400 });
      db.prepare('INSERT INTO tips (payment_hash, report_id, sats, demo, created_at) VALUES (?, ?, ?, 1, ?)').run(`demo-${randomUUID()}`, rep.id, sats, Date.now());
      return { ok: true, demo: true };
    }
    return { ok: true, sats: recordTip(body) };
  },

  'GET /api/stats': () => db.prepare(`SELECT
      (SELECT COUNT(*) FROM reports) reports, (SELECT COUNT(*) FROM reports WHERE demo = 0) real_reports,
      (SELECT COUNT(DISTINCT pubkey) FROM reports) contributors, (SELECT COUNT(DISTINCT market) FROM reports) markets,
      (SELECT COUNT(*) FROM confirms) confirmations, (SELECT COALESCE(SUM(sats),0) FROM tips WHERE demo = 0) sats_tipped`).get(),
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const route = routes[`${req.method} ${url.pathname}`];
  try {
    if (route) {
      // Coarse, non-identifying bucket for rate limiting; the raw address is discarded.
      const bucket = String(req.socket.remoteAddress || '').split(/[.:]/).slice(0, 3).join('.');
      const body = req.method === 'POST' ? await readJson(req) : {};
      return send(res, 200, await route(Object.fromEntries(url.searchParams), body, { bucket }));
    }
    if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
    const rel = STATIC[url.pathname] || normalize(join('public', url.pathname)).replace(/\\/g, '/');
    if (!rel.startsWith('public/') && !Object.values(STATIC).includes(rel)) return send(res, 404, { error: 'not_found' });
    const file = await readFile(join(import.meta.dirname, rel));
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] || 'application/octet-stream', 'cache-control': 'public, max-age=300', ...SECURITY_HEADERS });
    res.end(file);
  } catch (e) {
    if (e.code === 'ENOENT') return send(res, 404, { error: 'not_found' });
    const status = e.status || 502;
    if (status >= 500) console.error(`[${req.method} ${url.pathname}]`, e.message); // no request bodies or IPs in logs
    send(res, status, { error: e.message || 'error' });
  }
});

server.listen(PORT, () => console.log(`Dëgg running on http://localhost:${PORT}  (wallet: ${walletMode}, AI: ${process.env.ANTHROPIC_API_KEY ? 'claude' : 'rules'}, deposits: ${REQUIRE_DEPOSIT ? DEPOSIT_SATS + ' sats' : 'off'})`));
