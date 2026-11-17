// Turns a free-text price report (French / Wolof / English) into structured data.
// Uses Claude when ANTHROPIC_API_KEY is set; otherwise a deterministic rule-based parser.
// Either way the user reviews the result before signing — the AI never publishes on its own.
import { PRODUCTS, MARKETS, productById, marketById } from './catalog.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function ruleParse(text) {
  const t = norm(text);
  const product = PRODUCTS.find(p => p.syn.some(s => t.includes(norm(s))))?.id || null;
  const market = MARKETS.find(m => t.includes(norm(m.name)))?.id || null;

  // Sack sizes: "sac de 50 kg", "sac 25kg"
  const sack = t.match(/sacs?\s*(?:de\s*)?(\d+)\s*k/);
  // Explicit quantity with unit: "3 kg", "2 litres", "5 l"
  const qtyUnit = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|l\b|litres?)/);
  const count = t.match(/(\d+)\s*(sacs?|bidons?|pains?|baguettes?|tas)/);
  const perUnit = /(le|par|\/)\s*(kg|kilo|litre|l\b|piece|un)|chacun|l'unite|benn/.test(t);

  // Price = largest number that looks like money (written with or without spaces/dots).
  const nums = [...t.matchAll(/\d{1,3}(?:[ . ]\d{3})+|\d+/g)].map(m => Number(m[0].replace(/[ . ]/g, '')));
  const used = new Set([sack?.[1], qtyUnit?.[1], count?.[1]].filter(Boolean).map(Number));
  const money = nums.filter(n => !used.has(n) && n >= 25);
  let price = money.length ? Math.max(...money) : null;

  let qty = 1;
  if (sack) qty = Number(sack[1]) * (count ? Number(count[1]) : 1);
  else if (qtyUnit) qty = Number(qtyUnit[1].replace(',', '.'));
  else if (count && !perUnit) qty = Number(count[1]);
  if (price && qty > 0 && !perUnit) price = Math.round(price / qty);

  const missing = ['product', 'market', 'price'].filter(k => !({ product, market, price })[k]);
  return { product, market, price, unit: product ? productById[product].unit : null, source: 'rules', missing,
    explanation: qty !== 1 && !perUnit ? `Total divided by ${qty} ${product ? productById[product].unit : 'units'}` : null };
}

async function claude(system, user, maxTokens = 300) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    return data.content.map(c => c.text || '').join('');
  } finally { clearTimeout(timer); }
}

export async function parseReport(text) {
  text = String(text || '').slice(0, 500);
  const fallback = ruleParse(text);
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  const catalog = PRODUCTS.map(p => `${p.id} (${p.fr} / ${p.wo}, unit ${p.unit})`).join('; ');
  const system = `You extract market price reports from Senegal, written in French, Wolof or English.
Products: ${catalog}. Markets: ${MARKETS.map(m => m.id).join(', ')}.
Return ONLY JSON: {"product": id|null, "market": id|null, "price": integer XOF per product unit|null, "explanation": short string in French}.
Convert sacks, bundles or totals into price per unit (e.g. "sac de 50 kg à 22 500" => 450 per kg). Never invent a value that is not in the text: use null.`;
  try {
    const out = JSON.parse((await claude(system, text)).match(/\{[\s\S]*\}/)[0]);
    const product = productById[out.product] ? out.product : fallback.product;
    const market = marketById[out.market] ? out.market : fallback.market;
    const price = Number.isInteger(out.price) && out.price > 0 ? out.price : fallback.price;
    const missing = ['product', 'market', 'price'].filter(k => !({ product, market, price })[k]);
    return { product, market, price, unit: product ? productById[product].unit : null, source: 'ai', missing, explanation: String(out.explanation || '').slice(0, 200) || null };
  } catch {
    return fallback;
  }
}

// Plain-language summary of current prices. Template by default, Claude when configured.
export async function summarize(lang, data) {
  const p = productById[data.product];
  const name = lang === 'en' ? p.en : p.fr;
  if (!data.markets.length) return lang === 'en' ? `No reports for ${name} this week yet.` : `Aucun prix signalé pour ${name} cette semaine.`;
  const cheap = data.markets[0], dear = data.markets[data.markets.length - 1];
  const fmt = n => n.toLocaleString('fr-FR');
  const base = lang === 'en'
    ? `${name}: typical price ${fmt(data.overall)} XOF/${p.unit}. Cheapest reported at ${cheap.name} (${fmt(cheap.median)}), highest at ${dear.name} (${fmt(dear.median)}).`
    : `${name} : prix habituel ${fmt(data.overall)} XOF/${p.unit}. Le moins cher signalé à ${cheap.name} (${fmt(cheap.median)}), le plus cher à ${dear.name} (${fmt(dear.median)}).`;
  if (!process.env.ANTHROPIC_API_KEY) return base;
  try {
    const txt = await claude(`You write a 2-sentence market price summary for shoppers in Dakar, in ${lang === 'en' ? 'English' : 'French'}. Use only the numbers given. Mention data freshness and that prices are community reports, not guarantees. No markdown.`,
      JSON.stringify({ product: name, unit: p.unit, overall: data.overall, markets: data.markets.map(({ name, median, reports, trend, confidence }) => ({ name, median, reports, trend, confidence })) }), 200);
    return txt.trim() || base;
  } catch { return base; }
}
