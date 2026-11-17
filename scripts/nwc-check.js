import * as NT from 'nostr-tools';
import { readFileSync } from 'node:fs';
import { createNwc } from '../public/nwc.js';
import { invoiceForAddress, decodeBolt11 } from '../lib/lightning.js';
// Usage: node scripts/nwc-check.js <dir with operator.txt, tipper.txt, reporter.txt NWC links>
const dir = process.argv[2] || '../wallets';
const uri = n => readFileSync(`${dir}/${n}.txt`, 'utf8').trim();
const op = createNwc(NT, uri('operator')), tip = createNwc(NT, uri('tipper'));
console.log('relay parsed:', op.relayUrl);
console.log('operator balance:', (await op.getBalance()).balance / 1000);
const inv = await op.makeInvoice(10, 'deposit test');
console.log('deposit invoice hash:', inv.payment_hash.slice(0, 12), 'decoded:', decodeBolt11(inv.invoice));
console.log('before pay lookup settled:', Boolean((await op.lookupInvoice(inv.payment_hash)).settled_at));
console.log('tipper pays:', Boolean((await tip.payInvoice(inv.invoice)).preimage));
console.log('after pay lookup settled:', Boolean((await op.lookupInvoice(inv.payment_hash)).settled_at));
const lud = uri('reporter').match(/lud16=([^&]+)/)[1];
const pr = await invoiceForAddress(lud, 21);
console.log('LNURL invoice for reporter:', decodeBolt11(pr).sats, 'sats');
op.close(); tip.close(); setTimeout(() => process.exit(0), 300);
