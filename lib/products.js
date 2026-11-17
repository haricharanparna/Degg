// Open product catalog: the built-in foods plus any food a community member reports.
// Custom ids are "<slug>.<unit>" (e.g. "mangue.piece") so prices in different units never mix.
import { db } from './db.js';
import { PRODUCTS, productById } from './catalog.js';

export const UNITS = ['kg', 'L', 'piece', 'bunch', 'sack'];
export const CUSTOM_BOUNDS = [5, 999999];
const ID_RE = new RegExp(`^[a-z0-9]+(?:-[a-z0-9]+)*\\.(${UNITS.join('|')})$`);

db.exec(`CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL, search TEXT NOT NULL, created_at INTEGER NOT NULL
)`);

export const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
export const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// Letters (any script), digits, spaces and a little punctuation; 2–40 chars.
export const validName = n => typeof n === 'string' && /^[\p{L}\p{N}][\p{L}\p{N} '’()-]{1,39}$/u.test(n.trim());

export function customId(name, unit) { return `${slug(name)}.${unit}`; }
export const isCustomId = id => ID_RE.test(id || '');

export function getProduct(id) {
  if (productById[id]) return productById[id];
  if (!isCustomId(id)) return null;
  const row = db.prepare('SELECT id, name, unit FROM products WHERE id = ?').get(id);
  return row ? { id: row.id, fr: row.name, en: row.name, wo: row.name, unit: row.unit, custom: true } : null;
}

export function registerProduct(id, name, unit) {
  db.prepare('INSERT OR IGNORE INTO products (id, name, unit, search, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, name.trim(), unit, norm(name), Date.now());
}

// Matches built-in foods (all languages + synonyms) and every community-added food.
export function searchProducts(q, limit = 12) {
  const n = norm(q);
  if (n.length < 1) return [];
  const names = p => [p.id, p.fr, p.en, p.wo, ...p.syn].map(norm);
  const words = n.split(' ');
  const builtIn = PRODUCTS.filter(p => names(p).some(s => s === n || words.includes(s) || s.startsWith(n) || (n.length >= 3 && (s.includes(n) || n.includes(s)))))
    .map(p => ({ id: p.id, fr: p.fr, en: p.en, wo: p.wo, unit: p.unit, custom: false }));
  const like = `%${n.replace(/[%_]/g, '')}%`;
  const custom = db.prepare(`SELECT p.id, p.name, p.unit, (SELECT COUNT(*) FROM reports r WHERE r.product = p.id) reports
    FROM products p WHERE p.search LIKE ? OR ? LIKE '%' || p.search || '%' ORDER BY reports DESC LIMIT ?`).all(like, n, limit)
    .map(r => ({ id: r.id, fr: r.name, en: r.name, wo: r.name, unit: r.unit, custom: true, reports: r.reports }));
  return [...builtIn, ...custom].slice(0, limit);
}
