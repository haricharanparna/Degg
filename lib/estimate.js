// AI price estimate for foods nobody has reported yet. Shown separately and labelled
// "AI estimate, not verified"; it is never stored as a report or used in medians.
import { db } from './db.js';
import { askAI, aiProvider } from './ai.js';
import { norm, UNITS, validName } from './products.js';

const TTL = 7 * 86400 * 1000;
db.exec('CREATE TABLE IF NOT EXISTS estimates (key TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER NOT NULL)');

export const estimatesEnabled = () => Boolean(aiProvider());

// Asks once for French and English text, caches both, and returns the requested language
// (Wolof falls back to French).
export async function estimatePrice(q, lang = 'fr') {
  const key = norm(q).slice(0, 40);
  if (!validName(key)) return { available: false, reason: 'bad_query' };
  if (!estimatesEnabled()) return { available: false, reason: 'not_configured' };
  const hit = db.prepare('SELECT data, created_at FROM estimates WHERE key = ?').get(key);
  let result = hit && Date.now() - hit.created_at < TTL ? JSON.parse(hit.data) : null;
  if (result?.available && !result.food_en) result = null; // cached before bilingual answers
  if (result) return localize(result, lang);

  const system = `You estimate typical retail prices in Dakar, Senegal markets (Sandaga, Tilène, Castors…), in XOF (CFA francs).
Return ONLY JSON: {"food_fr": usual French name (capitalised) or null if this is not something sold in a Senegalese food market,
"food_en": usual English name (capitalised), "unit": one of ${UNITS.join('/')}, "low": integer, "high": integer,
"note_fr": one short sentence in French about what drives the price, "note_en": the same sentence in English}.
Give a realistic range, wide enough to be honest about uncertainty. If unsure what the item is, return {"food_fr": null}.`;
  let out;
  try { out = JSON.parse((await askAI(system, String(q).slice(0, 60), 200)).match(/\{[\s\S]*\}/)[0]); }
  catch (err) { console.error('[estimate] AI call failed:', err.message); return { available: false, reason: 'ai_error' }; }

  const ok = out && typeof out.food_fr === 'string' && UNITS.includes(out.unit) && Number.isInteger(out.low) && Number.isInteger(out.high)
    && out.low >= 5 && out.high >= out.low && out.high <= 999999;
  result = ok
    ? { available: true, food_fr: out.food_fr.slice(0, 40), food_en: String(out.food_en || out.food_fr).slice(0, 40), unit: out.unit, low: out.low, high: out.high,
        note_fr: String(out.note_fr || '').slice(0, 160), note_en: String(out.note_en || out.note_fr || '').slice(0, 160), source: 'ai' }
    : { available: false, reason: 'not_a_food' };
  db.prepare('INSERT OR REPLACE INTO estimates (key, data, created_at) VALUES (?, ?, ?)').run(key, JSON.stringify(result), Date.now());
  return localize(result, lang);
}

function localize(r, lang) {
  if (!r.available) return r;
  const en = lang === 'en';
  // report_name is the French name, so the first real report joins the same catalog entry whatever language it came from.
  return { available: true, food: en ? r.food_en : r.food_fr, report_name: r.food_fr, unit: r.unit, low: r.low, high: r.high,
    note: en ? r.note_en : r.note_fr, source: r.source };
}
