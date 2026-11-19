// AI price estimate for foods nobody has reported yet. Shown separately and labelled
// "AI estimate, not verified"; it is never stored as a report or used in medians.
import { db } from './db.js';
import { askAI, aiProvider } from './ai.js';
import { norm, UNITS, validName } from './products.js';

const TTL = 7 * 86400 * 1000;
db.exec('CREATE TABLE IF NOT EXISTS estimates (key TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER NOT NULL)');

export const estimatesEnabled = () => Boolean(aiProvider());

export async function estimatePrice(q) {
  const key = norm(q).slice(0, 40);
  if (!validName(key)) return { available: false, reason: 'bad_query' };
  if (!estimatesEnabled()) return { available: false, reason: 'not_configured' };
  const hit = db.prepare('SELECT data, created_at FROM estimates WHERE key = ?').get(key);
  if (hit && Date.now() - hit.created_at < TTL) return JSON.parse(hit.data);

  const system = `You estimate typical retail prices in Dakar, Senegal markets (Sandaga, Tilène, Castors…), in XOF (CFA francs).
Return ONLY JSON: {"food": usual French name (capitalised) or null if this is not something sold in a Senegalese food market,
"unit": one of ${UNITS.join('/')}, "low": integer, "high": integer, "note": one short sentence in French about what drives the price}.
Give a realistic range, wide enough to be honest about uncertainty. If unsure what the item is, return {"food": null}.`;
  let out;
  try { out = JSON.parse((await askAI(system, String(q).slice(0, 60), 200)).match(/\{[\s\S]*\}/)[0]); }
  catch (err) { console.error('[estimate] AI call failed:', err.message); return { available: false, reason: 'ai_error' }; }

  const ok = out && typeof out.food === 'string' && UNITS.includes(out.unit) && Number.isInteger(out.low) && Number.isInteger(out.high)
    && out.low >= 5 && out.high >= out.low && out.high <= 999999;
  const result = ok
    ? { available: true, food: out.food.slice(0, 40), unit: out.unit, low: out.low, high: out.high, note: String(out.note || '').slice(0, 160), source: 'ai' }
    : { available: false, reason: 'not_a_food' };
  db.prepare('INSERT OR REPLACE INTO estimates (key, data, created_at) VALUES (?, ?, ?)').run(key, JSON.stringify(result), Date.now());
  return result;
}
