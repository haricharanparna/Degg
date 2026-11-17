// Minimal Nostr Wallet Connect (NIP-47) client, shared by the browser and the server.
// Pass in the nostr-tools module (window.NostrTools in the browser, the npm import on the server).
export function createNwc(NT, uri) {
  const { pubkey: walletPubkey, relay: relayUrl, secret } = NT.nip47.parseConnectionString(uri);
  const sk = NT.utils.hexToBytes(secret);
  let relayP = null;
  const relay = () => (relayP ??= NT.Relay.connect(relayUrl).catch(e => { relayP = null; throw e; }));

  async function request(method, params = {}, timeoutMs = 30000) {
    const r = await relay();
    const content = await NT.nip04.encrypt(sk, walletPubkey, JSON.stringify({ method, params }));
    const ev = NT.finalizeEvent({ kind: 23194, created_at: Math.floor(Date.now() / 1000), tags: [['p', walletPubkey]], content }, sk);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { sub.close(); reject(new Error('wallet_timeout')); }, timeoutMs);
      const sub = r.subscribe([{ kinds: [23195], authors: [walletPubkey], '#e': [ev.id] }], {
        async onevent(resp) {
          clearTimeout(timer); sub.close();
          try {
            const body = JSON.parse(await NT.nip04.decrypt(sk, walletPubkey, resp.content));
            body.error ? reject(new Error(body.error.message || body.error.code)) : resolve(body.result);
          } catch (e) { reject(e); }
        },
      });
      r.publish(ev).catch(e => { clearTimeout(timer); sub.close(); reject(e); });
    });
  }

  return {
    relayUrl,
    getBalance: () => request('get_balance'),                       // { balance } in msats
    payInvoice: invoice => request('pay_invoice', { invoice }),     // { preimage }
    makeInvoice: (sats, description) => request('make_invoice', { amount: sats * 1000, description }),
    lookupInvoice: payment_hash => request('lookup_invoice', { payment_hash }),
    close: () => relayP?.then(r => r.close()).catch(() => {}),
  };
}
