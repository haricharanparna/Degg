// Server-side Lightning: anti-spam report deposits (via the operator's NWC wallet) and
// LNURL-pay invoice fetching so contributors with a Lightning address can be tipped.
// Tips themselves are paid from the *user's* wallet in the browser; the server never holds user funds.
import * as NT from 'nostr-tools';
import { randomBytes, createHash } from 'node:crypto';
import { createNwc } from '../public/nwc.js';
import { db } from './db.js';

export const DEPOSIT_SATS = Number(process.env.DEPOSIT_SATS || 10);
const nwc = process.env.NWC_URL ? createNwc(NT, process.env.NWC_URL) : null;
export const walletMode = nwc ? 'nwc' : 'demo';

// Demo mode issues clearly-fake invoices that settle immediately, so the flow can be shown without funds.
export async function createDeposit() {
  if (nwc) {
    const inv = await nwc.makeInvoice(DEPOSIT_SATS, 'Dëgg price report deposit');
    db.prepare('INSERT INTO deposits (payment_hash, invoice, created_at) VALUES (?, ?, ?)').run(inv.payment_hash, inv.invoice, Date.now());
    return { payment_hash: inv.payment_hash, invoice: inv.invoice, sats: DEPOSIT_SATS, mode: 'nwc' };
  }
  const payment_hash = createHash('sha256').update(randomBytes(32)).digest('hex');
  const invoice = `lnbcrt${DEPOSIT_SATS}0n1demo${payment_hash.slice(0, 40)}`;
  db.prepare('INSERT INTO deposits (payment_hash, invoice, created_at) VALUES (?, ?, ?)').run(payment_hash, invoice, Date.now());
  return { payment_hash, invoice, sats: DEPOSIT_SATS, mode: 'demo' };
}

// Returns true once the deposit is paid and not yet used; marks it used (one deposit = one report).
export async function consumeDeposit(payment_hash) {
  if (!/^[0-9a-f]{64}$/.test(payment_hash || '')) return false;
  const row = db.prepare('SELECT used FROM deposits WHERE payment_hash = ?').get(payment_hash);
  if (!row || row.used) return false;
  if (nwc) {
    const res = await nwc.lookupInvoice(payment_hash).catch(() => null);
    if (!res || !(res.settled_at || res.preimage)) return false;
  }
  return db.prepare('UPDATE deposits SET used = 1 WHERE payment_hash = ? AND used = 0').run(payment_hash).changes === 1;
}

// LNURL-pay (LUD-06/16): resolve a Lightning address into a bolt11 invoice.
export async function invoiceForAddress(lud16, sats) {
  const [name, domain] = lud16.split('@');
  if (!/^[a-z0-9._-]+$/i.test(name) || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) throw new Error('bad_address');
  const get = async url => {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!r.ok) throw new Error('lnurl_unreachable');
    return r.json();
  };
  const meta = await get(`https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`);
  const msats = sats * 1000;
  if (meta.tag !== 'payRequest' || msats < meta.minSendable || msats > meta.maxSendable) throw new Error('amount_not_accepted');
  const cb = new URL(meta.callback);
  if (cb.protocol !== 'https:') throw new Error('insecure_callback');
  cb.searchParams.set('amount', String(msats));
  const res = await get(cb.toString());
  if (!res.pr) throw new Error(res.reason || 'no_invoice');
  return res.pr;
}

// Minimal BOLT11 reader: amount in sats and payment hash, enough to verify a tip's preimage.
import { bech32 } from '@scure/base';
export function decodeBolt11(pr) {
  const { prefix, words } = bech32.decode(pr.toLowerCase(), 2000);
  const m = prefix.match(/^ln(?:bc|tb|bcrt|tbs)(\d+)?([munp])?$/);
  if (!m) throw new Error('bad_invoice');
  const mult = { m: 1e5, u: 100, n: 0.1, p: 0.0001 };
  const sats = m[1] ? Math.round(Number(m[1]) * (m[2] ? mult[m[2]] : 1e8)) : null;
  let i = 7, payment_hash = null;
  while (i < words.length - 104) {
    const type = words[i], len = words[i + 1] * 32 + words[i + 2];
    if (type === 1) payment_hash = Buffer.from(bech32.fromWords(words.slice(i + 3, i + 3 + len))).toString('hex').slice(0, 64);
    i += 3 + len;
  }
  return { sats, payment_hash };
}

export function recordTip({ report_id, invoice, preimage }) {
  const { sats, payment_hash } = decodeBolt11(invoice);
  if (!payment_hash || !/^[0-9a-f]{64}$/.test(preimage || '')) throw new Error('bad_proof');
  if (createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex') !== payment_hash) throw new Error('preimage_mismatch');
  db.prepare('INSERT OR IGNORE INTO tips (payment_hash, report_id, sats, demo, created_at) VALUES (?, ?, ?, 0, ?)').run(payment_hash, report_id, sats || 0, Date.now());
  return sats;
}
