// Seeds clearly-labelled DEMO data: every event carries ["demo","1"] and the UI shows a DEMO badge.
// Prices are illustrative placeholders, NOT real market observations.
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { db } from './db.js';
import { PRODUCTS, MARKETS } from './catalog.js';
import { insertReport } from './reports.js';
import { customId, registerProduct } from './products.js';

const BASE = { rice: 450, onion: 550, oil: 1300, sugar: 700, potato: 500, tomato: 900, millet: 400, fish: 1200, bread: 150 };
const MARKET_FACTOR = { sandaga: 1.0, tilene: 0.95, castors: 1.05, hlm: 1.0, thiaroye: 0.9 };

// Extra everyday foods so the demo covers most searches: [name, unit, placeholder XOF per unit, search aliases].
export const DEMO_FOODS = [
  ['Mangue', 'piece', 250, ['mango']], ['Gombo', 'kg', 1200, ['okra', 'kanja']], ['Bissap', 'kg', 2000, ['hibiscus', 'oseille']],
  ['Banane', 'piece', 150, ['banana']], ['Banane plantain', 'kg', 800, ['plantain']], ['Poulet', 'piece', 3500, ['chicken', 'ganaar']],
  ['Viande de bœuf', 'kg', 4500, ['beef', 'boeuf', 'yapp nag', 'meat']], ['Viande de mouton', 'kg', 5000, ['mutton', 'lamb', 'xar']],
  ['Œufs', 'piece', 100, ['eggs', 'oeufs', 'oeuf', 'nen']], ['Lait caillé', 'L', 1000, ['sow', 'curdled milk', 'lait caille']],
  ['Lait en poudre', 'kg', 4000, ['milk powder', 'lait']], ['Niébé', 'kg', 900, ['cowpea', 'beans', 'niebe', 'haricot']],
  ['Arachide', 'kg', 1000, ['peanut', 'groundnut', 'gerte']], ['Pâte d’arachide', 'kg', 1800, ['peanut butter', 'tigadege']],
  ['Maïs', 'kg', 300, ['corn', 'maize', 'mboq']], ['Fonio', 'kg', 1500, []], ['Thiéré', 'kg', 800, ['couscous de mil', 'cere', 'thiere']],
  ['Manioc', 'kg', 400, ['cassava', 'nambi']], ['Patate douce', 'kg', 500, ['sweet potato']], ['Igname', 'kg', 800, ['yam']],
  ['Carotte', 'kg', 600, ['carrot']], ['Chou', 'kg', 400, ['cabbage', 'sux']], ['Aubergine', 'kg', 600, ['eggplant', 'batanse', 'jaxatu']],
  ['Piment', 'kg', 1500, ['chili', 'pepper', 'kaani']], ['Ail', 'kg', 2000, ['garlic', 'laaj']], ['Poivron', 'kg', 1200, ['bell pepper']],
  ['Concombre', 'kg', 500, ['cucumber']], ['Laitue', 'piece', 300, ['lettuce', 'salade']], ['Citron', 'kg', 800, ['lemon', 'lime', 'limon']],
  ['Orange', 'kg', 700, ['sorons']], ['Pastèque', 'piece', 1500, ['watermelon', 'xaal']], ['Pain de singe', 'kg', 1500, ['baobab', 'bouye', 'buy']],
  ['Ditax', 'kg', 1500, ['detarium']], ['Café Touba', 'kg', 3000, ['coffee', 'cafe']], ['Thé vert', 'piece', 250, ['green tea', 'attaya', 'the']],
  ['Sel', 'kg', 200, ['salt', 'xorom']], ['Farine de blé', 'kg', 600, ['flour', 'farine']], ['Pâtes', 'kg', 900, ['pasta', 'macaroni', 'spaghetti']],
  ['Lait concentré', 'piece', 500, ['condensed milk']], ['Bouillon cube', 'piece', 25, ['maggi', 'jumbo', 'stock cube']],
  ['Crevettes', 'kg', 4000, ['shrimp', 'prawns']], ['Thiof', 'kg', 4000, ['grouper', 'merou']], ['Guedj', 'kg', 2500, ['dried fish', 'poisson sec']],
  ['Huile de palme', 'L', 1500, ['palm oil', 'diwtiir']], ['Eau en bouteille', 'piece', 400, ['water', 'eau']],
];

// Adds DEMO reports for any built-in or demo food that has none yet, so redeploys pick up new foods.
export function seed({ reset = false } = {}) {
  if (reset) db.exec('DELETE FROM reports; DELETE FROM confirms; DELETE FROM tips; DELETE FROM deposits; DELETE FROM products;');
  let rnd = 42; const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647; // deterministic
  const keys = Array.from({ length: 8 }, () => generateSecretKey());
  const now = Math.floor(Date.now() / 1000);
  const has = id => db.prepare('SELECT 1 FROM reports WHERE product = ? AND demo = 1 LIMIT 1').get(id);
  const foods = [
    ...PRODUCTS.map(p => ({ id: p.id, unit: p.unit, base: BASE[p.id], markets: MARKETS, perMarket: [2, 4] })),
    ...DEMO_FOODS.map(([name, unit, base, aliases]) => ({ id: customId(name, unit), name, unit, base, aliases,
      markets: MARKETS.filter(() => rand() < 0.7), perMarket: [1, 2] })),
  ].filter(f => !has(f.id));
  const rows = [];
  for (const f of foods) {
    if (f.name) registerProduct(f.id, f.name, f.unit, f.aliases);
    for (const m of f.markets.length ? f.markets : MARKETS.slice(0, 2)) {
      const n = f.perMarket[0] + Math.floor(rand() * (f.perMarket[1] - f.perMarket[0] + 1));
      for (let i = 0; i < n; i++) {
        const age = Math.floor(rand() * 13 * 86400) + 600;
        const drift = 1 + 0.06 * (1 - age / (13 * 86400)); // gentle upward trend over two weeks
        const step = f.base >= 100 ? 5 : 1;
        const price = Math.max(5, Math.round((f.base * MARKET_FACTOR[m.id] * drift * (0.94 + rand() * 0.12)) / step) * step);
        rows.push({ f, m, price, created_at: now - age, sk: keys[Math.floor(rand() * keys.length)] });
      }
    }
  }
  // One deliberate outlier so the inconsistency detector is visible in the demo.
  if (foods.some(f => f.id === 'onion')) rows.push({ f: foods.find(f => f.id === 'onion'), m: MARKETS[2], price: 1400, created_at: now - 1800, sk: keys[0] });
  rows.sort((a, b) => a.created_at - b.created_at);
  for (const r of rows) {
    const tags = [['t', 'degg-price'], ['product', r.f.id], ['market', r.m.id], ['price', String(r.price), 'XOF'], ['unit', r.f.unit], ['demo', '1']];
    if (r.f.name) tags.push(['name', r.f.name]);
    const ev = finalizeEvent({ kind: 1, created_at: r.created_at, content: 'Démo / demo data', tags }, r.sk);
    insertReport({ id: ev.id, pubkey: ev.pubkey, created_at: ev.created_at, product: r.f.id, market: r.m.id, price: r.price,
      note: ev.content, lud16: null, name: null, unit: r.f.unit, demo: 1 }, ev);
  }
  // A few cross-confirmations between demo keys.
  const ids = db.prepare('SELECT id, pubkey FROM reports WHERE demo = 1 ORDER BY created_at DESC LIMIT 120').all();
  for (const r of ids) for (const sk of keys.slice(0, 1 + Math.floor(rand() * 3))) {
    if (getPublicKey(sk) !== r.pubkey) db.prepare('INSERT OR IGNORE INTO confirms VALUES (?, ?, ?)').run(r.id, getPublicKey(sk), now);
  }
  return rows.length;
}

if (process.argv[1]?.endsWith('seed.js')) {
  const n = seed({ reset: process.argv.includes('--reset') });
  console.log(n ? `Seeded ${n} DEMO reports.` : 'All foods already have demo data; use --reset to rebuild.');
}
