process.env.DB_PATH = ':memory:';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSecretKey, finalizeEvent } from 'nostr-tools';
// Dynamic imports so the in-memory DB path is set before lib/db.js loads.
const { ruleParse } = await import('../lib/ai.js');
const { validateReportEvent, insertReport, marketPrices, validateConfirm, median } = await import('../lib/reports.js');
const { decodeBolt11 } = await import('../lib/lightning.js');

const now = () => Math.floor(Date.now() / 1000);
const report = (sk, price, market = 'sandaga', extra = []) => finalizeEvent({ kind: 1, created_at: now(), content: '',
  tags: [['t', 'degg-price'], ['product', 'rice'], ['market', market], ['price', String(price), 'XOF'], ...extra] }, sk);

test('rule parser: sack price becomes price per kg', () => {
  const r = ruleParse('sac de riz 50 kg à 22 500 à Sandaga');
  assert.deepEqual([r.product, r.market, r.price], ['rice', 'sandaga', 450]);
});
test('rule parser: Wolof product words and per-kilo prices', () => {
  const r = ruleParse('soble 600 le kilo Tilène');
  assert.deepEqual([r.product, r.market, r.price], ['onion', 'tilene', 600]);
});
test('rule parser reports missing fields instead of guessing', () => {
  assert.deepEqual(ruleParse('ceeb bi dafa jafe').missing, ['market', 'price']);
});

test('valid signed report is accepted', () => assert.equal(validateReportEvent(report(generateSecretKey(), 450)).ok, true));
test('tampered report is rejected', () => {
  const ev = report(generateSecretKey(), 450);
  ev.tags[3][1] = '100';
  assert.equal(validateReportEvent(ev).error, 'bad_signature');
});
test('out-of-bounds and unknown values are rejected', () => {
  assert.equal(validateReportEvent(report(generateSecretKey(), 99999)).error, 'price_out_of_bounds');
  assert.equal(validateReportEvent(report(generateSecretKey(), 450, 'nowhere')).error, 'unknown_market');
  assert.equal(validateReportEvent(report(generateSecretKey(), 450, 'sandaga', [['lud16', 'not an address']])).error, 'bad_lightning_address');
});

test('outliers are flagged, aggregation ignores them, confirmations work', () => {
  const ids = [440, 450, 460, 455].map(p => { const ev = report(generateSecretKey(), p); insertReport(validateReportEvent(ev).report, ev); return ev; });
  const bad = report(generateSecretKey(), 2000);
  assert.match(insertReport(validateReportEvent(bad).report, bad), /median/);
  const data = marketPrices('rice');
  assert.equal(data.markets[0].median, median([440, 450, 460, 455]));
  const sk = generateSecretKey();
  const ok = validateConfirm(finalizeEvent({ kind: 7, created_at: now(), content: '+', tags: [['e', ids[0].id]] }, sk));
  assert.equal(ok.ok, true);
});

test('bolt11 decoding extracts amount and payment hash', () => {
  // BOLT11 spec example: "Please make a donation of any amount using payment_hash 0001020304…"
  const inv = 'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpu9qrsgquk0rl77nj30yxdy8j9vdx85fkpmdla2087ne0xh8nhedh8w27kyke0lp53ut353s06fv3qfegext0eh0ymjpf39tuven09sam30g4vgpfna3rh';
  const d = decodeBolt11(inv);
  assert.equal(d.sats, 250000);
  assert.equal(d.payment_hash, '0001020304050607080900010203040506070809000102030405060708090102');
});

test('any food can be reported with a name and unit, and becomes searchable', async () => {
  const { searchProducts } = await import('../lib/products.js');
  const ev = report(generateSecretKey(), 250, 'sandaga');
  const mk = (tags) => finalizeEvent({ kind: 1, created_at: now(), content: '', tags: [['t', 'degg-price'], ['market', 'sandaga'], ['price', '250', 'XOF'], ...tags] }, generateSecretKey());
  const good = mk([['product', 'mangue.piece'], ['name', 'Mangue'], ['unit', 'piece']]);
  const v = validateReportEvent(good);
  assert.equal(v.ok, true);
  insertReport(v.report, good);
  assert.equal(searchProducts('mang')[0].id, 'mangue.piece');
  assert.equal(marketPrices('mangue.piece').markets[0].median, 250);
  assert.equal(validateReportEvent(mk([['product', 'banane.piece'], ['name', 'Mangue'], ['unit', 'piece']])).error, 'unknown_product');
  assert.equal(validateReportEvent(mk([['product', 'mangue.box'], ['name', 'Mangue'], ['unit', 'box']])).error, 'bad_unit');
  assert.equal(validateReportEvent(mk([['product', 'x.kg'], ['name', '<script>'], ['unit', 'kg']])).error, 'bad_food_name');
  assert.ok(ev);
});

test('rule parser keeps unknown food names instead of guessing', () => {
  const r = ruleParse('gombo 1500 le kilo Tilène');
  assert.deepEqual([r.product, r.name, r.unit, r.market, r.price], [null, 'Gombo', 'kg', 'tilene', 1500]);
});
