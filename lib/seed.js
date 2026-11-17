// Seeds clearly-labelled DEMO data: every event carries ["demo","1"] and the UI shows a DEMO badge.
// Prices are illustrative placeholders, NOT real market observations.
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { db } from './db.js';
import { PRODUCTS, MARKETS } from './catalog.js';
import { insertReport } from './reports.js';

const BASE = { rice: 450, onion: 550, oil: 1300, sugar: 700, potato: 500, tomato: 900, millet: 400, fish: 1200, bread: 150 };
const MARKET_FACTOR = { sandaga: 1.0, tilene: 0.95, castors: 1.05, hlm: 1.0, thiaroye: 0.9 };

export function seed({ reset = false } = {}) {
  if (reset) db.exec('DELETE FROM reports; DELETE FROM confirms; DELETE FROM tips; DELETE FROM deposits;');
  if (db.prepare('SELECT COUNT(*) n FROM reports').get().n > 0) return 0;
  let rnd = 42; const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647; // deterministic
  const keys = Array.from({ length: 8 }, () => generateSecretKey());
  const now = Math.floor(Date.now() / 1000);
  const rows = [];
  for (const p of PRODUCTS) for (const m of MARKETS) {
    const n = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const age = Math.floor(rand() * 13 * 86400) + 600;
      const drift = 1 + 0.06 * (1 - age / (13 * 86400)); // gentle upward trend over two weeks
      const price = Math.round((BASE[p.id] * MARKET_FACTOR[m.id] * drift * (0.94 + rand() * 0.12)) / 5) * 5;
      rows.push({ p, m, price, created_at: now - age, sk: keys[Math.floor(rand() * keys.length)] });
    }
  }
  // One deliberate outlier so the inconsistency detector is visible in the demo.
  rows.push({ p: PRODUCTS[1], m: MARKETS[2], price: 1400, created_at: now - 1800, sk: keys[0] });
  rows.sort((a, b) => a.created_at - b.created_at);
  for (const r of rows) {
    const ev = finalizeEvent({ kind: 1, created_at: r.created_at, content: 'Démo / demo data',
      tags: [['t', 'degg-price'], ['product', r.p.id], ['market', r.m.id], ['price', String(r.price), 'XOF'], ['unit', r.p.unit], ['demo', '1']] }, r.sk);
    insertReport({ id: ev.id, pubkey: ev.pubkey, created_at: ev.created_at, product: r.p.id, market: r.m.id, price: r.price, note: ev.content, lud16: null, demo: 1 }, ev);
  }
  // A few cross-confirmations between demo keys.
  const ids = db.prepare('SELECT id, pubkey FROM reports ORDER BY created_at DESC LIMIT 60').all();
  for (const r of ids) for (const sk of keys.slice(0, 1 + Math.floor(rand() * 3))) {
    if (getPublicKey(sk) !== r.pubkey) db.prepare('INSERT OR IGNORE INTO confirms VALUES (?, ?, ?)').run(r.id, getPublicKey(sk), now);
  }
  return rows.length;
}

if (process.argv[1]?.endsWith('seed.js')) {
  const n = seed({ reset: process.argv.includes('--reset') });
  console.log(n ? `Seeded ${n} DEMO reports.` : 'Database already has reports; use --reset to replace them.');
}
