// Dëgg client. Keys and wallet secrets stay on this device; the server only ever sees signed events.
import { createNwc } from './nwc.js';

const NT = window.NostrTools;
const $ = id => document.getElementById(id);
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

// ---------- i18n ----------
const T = {
  fr: { tagline: 'Le vrai prix du marché', navPrices: 'Prix', navReport: 'Signaler', navWallet: 'Portefeuille',
    spark: 'Prix médian, 14 derniers jours', close: 'Fermer', reports: 'signalements', updated: 'mis à jour',
    confidence: 'confiance', demo: 'DÉMO', flagged: 'ÉCART', confirm: '✓ Confirmer', tip: '⚡ Récompenser', signed: 'Voir l’événement Nostr signé',
    noData: 'Aucun prix signalé cette semaine. Soyez le premier !',
    reportTitle: 'Signaler un prix', reportHelp: 'Écrivez ou dites ce que vous avez vu, en français ou en wolof. Ex : « sac de riz 50 kg à 22 500 à Sandaga »',
    reportPh: 'Ex : soble 600 le kilo à Tilène', speak: '🎤 Parler', listening: '● J’écoute…', analyse: 'Analyser', check: 'Vérifiez avant de signer',
    product: 'Produit', market: 'Marché', price: 'Prix (XOF par unité)', lud16: 'Votre adresse Lightning (facultatif, pour recevoir des récompenses)',
    publicNote: 'Votre signalement est public et signé avec votre clé Nostr. N’ajoutez pas votre nom ni votre numéro.',
    signPublish: 'Signer et publier', depositTitle: 'Petit dépôt anti-spam', depositHelp: 'Payez cette facture Lightning pour publier. Elle protège Dëgg contre les faux prix.',
    openWallet: 'Ouvrir le portefeuille', copy: 'Copier', paid: 'J’ai payé', published: 'Publié et signé ✓', flagWarn: 'Publié, mais très différent des autres prix : ',
    wallet: 'Portefeuille Lightning', nwcLabel: 'Connexion Nostr Wallet Connect', connect: 'Connecter', disconnect: 'Déconnecter',
    nwcHelp: 'Collez le lien NWC de votre portefeuille (Alby, Mutiny, Phoenixd…). Il reste uniquement sur ce téléphone.',
    demoWallet: 'Portefeuille DÉMO (faux sats, pour tester)', connected: 'Connecté via NWC', identity: 'Votre identité Nostr',
    identityHelp: 'Créée sur ce téléphone. Sauvegardez votre clé secrète : sans elle, vos signalements ne peuvent plus être liés à vous.',
    exportKey: 'Afficher la clé secrète', importKey: 'Importer une clé', network: 'Le réseau Dëgg',
    st_reports: 'Signalements', st_real: 'dont réels (non démo)', st_contrib: 'Contributeurs', st_markets: 'Marchés couverts', st_conf: 'Confirmations', st_sats: 'Sats envoyés aux contributeurs',
    tipAsk: 'Combien de sats envoyer ?', tipped: 'Merci ! Récompense envoyée ⚡', confirmed: 'Merci, confirmation enregistrée', noLud: 'Ce contributeur n’a pas d’adresse Lightning.',
    search: 'Chercher', searchLabel: 'Chercher un aliment', searchPh: 'N’importe quel aliment : riz, mangue, gombo…', noneYet: 'Personne n’a encore signalé le prix de « {q} ».', beFirst: 'Signaler son prix', otherFood: '➕ Autre aliment…', foodName: 'Nom de l’aliment', foodNamePh: 'Ex : Mangue, Gombo, Bissap', unit: 'Vendu par', u_kg: 'kilo', u_L: 'litre', u_piece: 'pièce', u_bunch: 'botte / tas', u_sack: 'sac', needName: 'Indiquez le nom de l’aliment (2 à 40 lettres).',
    needInfo: 'Il manque : ', ago: 'il y a', min: 'min', h: 'h', d: 'j', noSpeech: 'La dictée vocale n’est pas disponible sur ce navigateur.',
    err: 'Erreur : ', keyWarn: 'Ne partagez jamais cette clé :', pasteKey: 'Collez votre clé nsec…' },
  en: { tagline: 'The true market price', navPrices: 'Prices', navReport: 'Report', navWallet: 'Wallet',
    spark: 'Median price, last 14 days', close: 'Close', reports: 'reports', updated: 'updated',
    confidence: 'confidence', demo: 'DEMO', flagged: 'OUTLIER', confirm: '✓ Confirm', tip: '⚡ Reward', signed: 'View signed Nostr event',
    noData: 'No prices reported this week. Be the first!',
    reportTitle: 'Report a price', reportHelp: 'Type or say what you saw, in French, Wolof or English. E.g. "50 kg rice sack 22,500 at Sandaga"',
    reportPh: 'E.g. onions 600 per kilo at Tilène', speak: '🎤 Speak', listening: '● Listening…', analyse: 'Analyse', check: 'Check before signing',
    product: 'Product', market: 'Market', price: 'Price (XOF per unit)', lud16: 'Your Lightning address (optional, to receive rewards)',
    publicNote: 'Your report is public and signed with your Nostr key. Do not add your name or phone number.',
    signPublish: 'Sign and publish', depositTitle: 'Small anti-spam deposit', depositHelp: 'Pay this Lightning invoice to publish. It protects Dëgg from fake prices.',
    openWallet: 'Open wallet', copy: 'Copy', paid: 'I paid', published: 'Published and signed ✓', flagWarn: 'Published, but very different from other prices: ',
    wallet: 'Lightning wallet', nwcLabel: 'Nostr Wallet Connect link', connect: 'Connect', disconnect: 'Disconnect',
    nwcHelp: 'Paste your wallet’s NWC link (Alby, Mutiny, Phoenixd…). It stays on this phone only.',
    demoWallet: 'DEMO wallet (fake sats, for testing)', connected: 'Connected via NWC', identity: 'Your Nostr identity',
    identityHelp: 'Created on this phone. Back up your secret key: without it your reports can no longer be linked to you.',
    exportKey: 'Show secret key', importKey: 'Import a key', network: 'The Dëgg network',
    st_reports: 'Reports', st_real: 'of which real (not demo)', st_contrib: 'Contributors', st_markets: 'Markets covered', st_conf: 'Confirmations', st_sats: 'Sats sent to contributors',
    tipAsk: 'How many sats to send?', tipped: 'Thank you! Reward sent ⚡', confirmed: 'Thanks, confirmation recorded', noLud: 'This contributor has no Lightning address.',
    search: 'Search', searchLabel: 'Search for a food', searchPh: 'Any food: rice, mango, okra…', noneYet: 'Nobody has reported a price for “{q}” yet.', beFirst: 'Report its price', otherFood: '➕ Other food…', foodName: 'Food name', foodNamePh: 'E.g. Mango, Okra, Hibiscus', unit: 'Sold by', u_kg: 'kilo', u_L: 'litre', u_piece: 'piece', u_bunch: 'bunch', u_sack: 'sack', needName: 'Enter the food name (2 to 40 letters).',
    needInfo: 'Missing: ', ago: '', min: 'min ago', h: 'h ago', d: 'd ago', noSpeech: 'Voice input is not available in this browser.',
    err: 'Error: ', keyWarn: 'Never share this key:', pasteKey: 'Paste your nsec key…' },
};
let lang = store.get('lang') || (navigator.language?.startsWith('en') ? 'en' : 'fr');
const t = k => T[lang][k] ?? k;
function applyI18n() {
  document.documentElement.lang = lang;
  $('lang').textContent = lang === 'fr' ? 'EN' : 'FR';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
}

// ---------- helpers ----------
const fmt = n => n == null ? '–' : Number(n).toLocaleString('fr-FR');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function ago(ts) {
  const s = Date.now() / 1000 - ts;
  const [v, u] = s < 3600 ? [Math.max(1, Math.round(s / 60)), 'min'] : s < 86400 ? [Math.round(s / 3600), 'h'] : [Math.round(s / 86400), 'd'];
  return lang === 'fr' ? `${t('ago')} ${v} ${t(u)}` : `${v} ${t(u)}`;
}
function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4000); }
async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.status), { status: res.status });
  return data;
}
const pName = p => lang === 'en' ? p.en : `${p.fr} · ${p.wo}`;

// ---------- identity (NIP-07 extension if present, else a key generated on this device) ----------
function localKey() {
  let hex = store.get('nostr_sk');
  if (!hex) { hex = NT.utils.bytesToHex(NT.generateSecretKey()); store.set('nostr_sk', hex); }
  return NT.utils.hexToBytes(hex);
}
async function sign(template) {
  if (window.nostr?.signEvent) return window.nostr.signEvent(template);
  return NT.finalizeEvent(template, localKey());
}
async function myPubkey() { return window.nostr?.getPublicKey ? window.nostr.getPublicKey() : NT.getPublicKey(localKey()); }

// ---------- wallet: user's own NWC, or a clearly-labelled demo wallet ----------
let nwc = store.get('nwc') ? createNwc(NT, store.get('nwc')) : null;
const demoBal = () => Number(store.get('demo_sats') ?? 1000);
async function pay(invoice) {
  if (nwc) return nwc.payInvoice(invoice);
  throw new Error('no_wallet');
}

// ---------- state ----------
let cfg, product = store.get('product') || 'rice', openMarket = null;
const extra = new Map(JSON.parse(store.get('extra_products') || '[]'));   // community foods seen on this device
const prod = id => cfg.products.find(p => p.id === id) || extra.get(id);
function remember(p) { if (p?.custom) { extra.set(p.id, p); store.set('extra_products', JSON.stringify([...extra].slice(-30))); } }
const slugify = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// ---------- prices tab ----------
function renderChips() {
  const cur = prod(product), list = cur?.custom ? [cur, ...cfg.products] : cfg.products;
  $('chips').innerHTML = list.map(p => `<button class="chip" role="tab" data-p="${p.id}" aria-selected="${p.id === product}">${esc(lang === 'en' ? p.en : p.wo)}</button>`).join('');
}
function spark(history) {
  const pts = history.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (pts.length < 2) { $('spark').innerHTML = ''; return; }
  const vs = pts.map(p => p[1]), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${(i / 13 * 136 + 2).toFixed(1)},${(34 - (v - lo) / span * 30).toFixed(1)}`).join(' ');
  $('spark').innerHTML = `<path d="${d}"/>`;
}
async function loadPrices() {
  const p = prod(product);
  $('markets').innerHTML = '<p class="empty">…</p>';
  try {
    const data = await api(`/api/prices?product=${product}&lang=${lang}`);
    $('summary').textContent = data.summary;
    $('overall').textContent = data.overall ? `${fmt(data.overall)} XOF/${p.unit}` : '–';
    spark(data.history);
    $('markets').innerHTML = data.markets.length ? data.markets.map(m => `
      <button class="card market" data-m="${m.market}" aria-label="${esc(m.name)}">
        <span class="name">${esc(m.name)}${m.demo ? `<span class="badge">${t('demo')}</span>` : ''}</span>
        <span class="price">${fmt(m.median)}</span>
        <span class="meta">${m.reports} ${t('reports')} · ${t('updated')} ${ago(m.last)}</span>
        <span class="meta" style="text-align:right">${m.min !== m.max ? `${fmt(m.min)}–${fmt(m.max)}` : ''}
          ${m.trend == null ? '' : m.trend > 0 ? `<b class="up">▲ ${m.trend}%</b>` : m.trend < 0 ? `<b class="down">▼ ${-m.trend}%</b>` : '＝'}</span>
        <span class="conf" title="${t('confidence')} ${m.confidence}%"><i style="width:${m.confidence}%"></i></span>
        <span class="meta">${t('confidence')} ${m.confidence}%</span>
      </button>`).join('') : `<p class="empty">${t('noData')}</p>`;
  } catch (e) { $('markets').innerHTML = `<p class="empty">${t('err')}${esc(e.message)}</p>`; }
}
async function openDetail(market) {
  openMarket = market;
  const m = cfg.markets.find(x => x.id === market), p = prod(product);
  $('detail-title').textContent = `${pName(p)} — ${m.name}`;
  $('detail').hidden = false;
  const { reports } = await api(`/api/reports?product=${product}&market=${market}`);
  const me = await myPubkey();
  $('reports').innerHTML = reports.map(r => `
    <li>
      <div class="row"><strong>${fmt(r.price)} XOF/${p.unit}</strong><span class="muted small">${ago(r.created_at)}</span></div>
      <div class="small muted mono">${esc(NT.nip19.npubEncode(r.pubkey).slice(0, 20))}…
        ${r.demo ? `<span class="badge">${t('demo')}</span>` : ''}${r.flag ? `<span class="badge flag" title="${esc(r.flag)}">${t('flagged')}</span>` : ''}</div>
      ${r.note ? `<div class="small">“${esc(r.note)}”</div>` : ''}
      ${r.flag ? `<div class="small muted">${esc(r.flag)}</div>` : ''}
      <div class="small muted">✓ ${r.confirms} · ⚡ ${fmt(r.tipped)} sats</div>
      <div class="actions">
        ${r.pubkey !== me ? `<button class="secondary small-btn" data-confirm="${r.id}">${t('confirm')}</button>` : ''}
        <button class="secondary small-btn" data-tip="${r.id}" data-lud="${r.lud16 ? 1 : 0}">${t('tip')}</button>
      </div>
      <details><summary class="small">${t('signed')}</summary><pre>${esc(JSON.stringify(r.event, null, 1))}</pre></details>
    </li>`).join('') || `<li class="empty">${t('noData')}</li>`;
  $('detail').scrollIntoView({ behavior: 'smooth' });
}
async function confirmReport(id) {
  try {
    const event = await sign({ kind: 7, created_at: Math.floor(Date.now() / 1000), tags: [['e', id], ['t', 'degg-price']], content: '+' });
    await api('/api/confirm', { event });
    toast(t('confirmed')); openDetail(openMarket); loadPrices();
  } catch (e) { toast(t('err') + e.message); }
}
async function tipReport(id, hasLud) {
  const sats = Number(prompt(t('tipAsk'), '21'));
  if (!Number.isInteger(sats) || sats < 1) return;
  try {
    if (!nwc) {
      // Demo wallet: deducts fake sats locally, recorded server-side as a demo tip.
      if (sats > demoBal()) throw new Error('demo_balance_too_low');
      await api('/api/tips', { report_id: id, sats, demo: true });
      store.set('demo_sats', String(demoBal() - sats));
    } else {
      if (!hasLud) throw new Error(t('noLud'));
      const { invoice } = await api('/api/tip-invoice', { report_id: id, sats });
      const { preimage } = await pay(invoice);
      await api('/api/tips', { report_id: id, invoice, preimage });
    }
    toast(t('tipped')); openDetail(openMarket); renderWallet();
  } catch (e) { toast(t('err') + e.message); }
}

// ---------- report tab ----------
function fillSelects() {
  $('f-product').innerHTML = cfg.products.map(p => `<option value="${p.id}">${esc(pName(p))} (${p.unit})</option>`).join('') + `<option value="__new">${t('otherFood')}</option>`;
  $('f-unit').innerHTML = cfg.units.map(u => `<option value="${u}">${t('u_' + u)}</option>`).join('');
  $('new-food').hidden = true;
  $('f-market').innerHTML = cfg.markets.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
}
async function parseFree() {
  const text = $('free').value.trim();
  if (!text) return $('free').focus();
  $('parse').disabled = true;
  try {
    const r = await api('/api/parse', { text });
    fillSelects();
    if (r.product) $('f-product').value = r.product;
    else if (r.name) newFood(r.name, r.unit);
    if (r.market) $('f-market').value = r.market;
    $('f-price').value = r.price || '';
    $('f-lud16').value = store.get('lud16') || '';
    const miss = r.missing?.length ? `${t('needInfo')}${r.missing.map(t).join(', ')}. ` : '';
    $('ai-note').textContent = `${miss}${r.explanation || ''} (${r.source === 'ai' ? 'AI' : 'rules'})`;
    $('confirm-form').hidden = false; $('deposit').hidden = true;
    $('confirm-form').scrollIntoView({ behavior: 'smooth' });
  } catch (e) { toast(t('err') + e.message); }
  finally { $('parse').disabled = false; }
}
function newFood(name = '', unit = 'kg') {
  $('f-product').value = '__new'; $('new-food').hidden = false;
  $('f-name').value = name; $('f-unit').value = cfg.units.includes(unit) ? unit : 'kg';
}
let pendingEvent = null;
async function submitReport(ev) {
  ev.preventDefault();
  const lud16 = $('f-lud16').value.trim();
  store.set('lud16', lud16 || null);
  let id = $('f-product').value, unit, name = null;
  if (id === '__new') {
    name = $('f-name').value.trim(); unit = $('f-unit').value;
    if (name.length < 2 || !slugify(name)) { toast(t('needName')); return $('f-name').focus(); }
    id = `${slugify(name)}.${unit}`;
  } else unit = prod(id).unit;
  const tags = [['t', 'degg-price'], ['product', id], ['market', $('f-market').value],
    ['price', String(Math.round(Number($('f-price').value))), 'XOF'], ['unit', unit]];
  if (name) tags.push(['name', name]);
  if (lud16) tags.push(['lud16', lud16]);
  try {
    pendingEvent = await sign({ kind: 1, created_at: Math.floor(Date.now() / 1000), tags, content: $('free').value.trim().slice(0, 280) });
    if (!cfg.depositSats) return publish(null);
    const dep = await api('/api/deposit', {});
    if (dep.mode === 'demo') return publish(dep.payment_hash);               // demo server: auto-settled
    if (nwc) { await pay(dep.invoice); return publish(dep.payment_hash); }    // pay from the user's wallet
    $('deposit-invoice').textContent = dep.invoice;                           // otherwise pay from any wallet app
    $('deposit-open').href = `lightning:${dep.invoice}`;
    $('deposit-done').onclick = () => publish(dep.payment_hash);
    $('deposit').hidden = false; $('confirm-form').hidden = true;
  } catch (e) { toast(t('err') + e.message); }
}
async function publish(payment_hash) {
  try {
    const r = await api('/api/reports', { event: pendingEvent, payment_hash });
    $('report-status').textContent = r.flag ? t('flagWarn') + r.flag : t('published');
    $('confirm-form').hidden = true; $('deposit').hidden = true; $('free').value = '';
    product = pendingEvent.tags.find(x => x[0] === 'product')[1];
    const nm = pendingEvent.tags.find(x => x[0] === 'name')?.[1];
    if (nm) remember({ id: product, fr: nm, en: nm, wo: nm, unit: pendingEvent.tags.find(x => x[0] === 'unit')[1], custom: true });
    store.set('product', product);
    loadPrices(); renderChips();
  } catch (e) { toast(t('err') + e.message); }
}
function setupMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  $('mic').onclick = () => {
    if (!SR) return toast(t('noSpeech'));
    const rec = new SR();
    rec.lang = lang === 'en' ? 'en-US' : 'fr-SN';
    rec.interimResults = false;
    $('mic').classList.add('recording'); $('mic').textContent = t('listening');
    rec.onresult = e => { $('free').value = [$('free').value, e.results[0][0].transcript].filter(Boolean).join(' '); };
    rec.onend = () => { $('mic').classList.remove('recording'); $('mic').textContent = t('speak'); };
    rec.onerror = () => rec.onend();
    rec.start();
  };
}

// ---------- wallet tab ----------
async function renderWallet() {
  $('npub').textContent = NT.nip19.npubEncode(await myPubkey());
  if (nwc) {
    $('wallet-state').textContent = `${t('connected')} (${new URL(nwc.relayUrl).host})`;
    $('balance').textContent = '…';
    nwc.getBalance().then(b => { $('balance').textContent = `${fmt(Math.floor(b.balance / 1000))} sats`; })
      .catch(e => { $('balance').textContent = t('err') + e.message; });
  } else {
    $('wallet-state').textContent = t('demoWallet');
    $('balance').textContent = `${fmt(demoBal())} sats`;
  }
  const s = await api('/api/stats');
  $('stats').innerHTML = [['st_reports', s.reports], ['st_real', s.real_reports], ['st_contrib', s.contributors], ['st_markets', s.markets],
    ['st_conf', s.confirmations], ['st_sats', s.sats_tipped]].map(([k, v]) => `<dt>${t(k)}</dt><dd>${fmt(v)}</dd>`).join('');
}

// ---------- search: any food, built-in or added by the community ----------
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
function selectProduct(id) {
  product = id; store.set('product', id); $('detail').hidden = true;
  renderChips(); loadPrices();
  document.querySelector(`[data-p="${CSS.escape(id)}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
}
let searchSeq = 0;
async function runSearch(auto = false) {
  const q = $('q').value.trim(), msg = $('search-msg'), seq = ++searchSeq;
  if (!q) { msg.hidden = true; return; }
  let hits;
  try { hits = (await api(`/api/search?q=${encodeURIComponent(q)}`)).results; }
  catch { hits = cfg.products.filter(p => [p.fr, p.en, p.wo, ...p.syn].some(s => norm(s).includes(norm(q)))); } // offline
  if (seq !== searchSeq) return; // a newer search is running
  hits.forEach(remember);
  if (hits.length) {
    msg.hidden = hits.length === 1;
    msg.innerHTML = hits.map(p => `<button type="button" class="chip" data-p="${esc(p.id)}">${esc(pName(p))} · ${t('u_' + p.unit)}</button>`).join(' ');
    if (hits.length === 1 || !auto) selectProduct(hits[0].id);
    const market = cfg.markets.find(m => norm(q).includes(norm(m.name)));
    if (market && !auto) setTimeout(() => openDetail(market.id), 600);
  } else if (!auto) {
    msg.hidden = false;
    msg.innerHTML = `${esc(t('noneYet').replace('{q}', q))} <button type="button" class="primary small-btn" data-newfood="${esc(q)}">${t('beFirst')}</button>`;
  }
}
function reportNewFood(name) {
  showTab('report'); fillSelects(); newFood(name.charAt(0).toUpperCase() + name.slice(1), 'kg');
  $('f-lud16').value = store.get('lud16') || ''; $('ai-note').textContent = '';
  $('confirm-form').hidden = false; $('deposit').hidden = true; $('f-price').focus();
}

// ---------- wiring ----------
function showTab(name) {
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('active', s.id === `tab-${name}`));
  document.querySelectorAll('.bottom button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'wallet') renderWallet();
  window.scrollTo(0, 0);
}
document.addEventListener('click', e => {
  const el = e.target.closest('button'); if (!el) return;
  if (el.dataset.tab) showTab(el.dataset.tab);
  else if (el.dataset.p) selectProduct(el.dataset.p);
  else if (el.dataset.newfood) reportNewFood(el.dataset.newfood);
  else if (el.dataset.m) openDetail(el.dataset.m);
  else if (el.dataset.confirm) confirmReport(el.dataset.confirm);
  else if (el.dataset.tip) tipReport(el.dataset.tip, el.dataset.lud === '1');
});
$('detail-close').onclick = () => { $('detail').hidden = true; };
$('lang').onclick = () => { lang = lang === 'fr' ? 'en' : 'fr'; store.set('lang', lang); applyI18n(); renderChips(); fillSelects(); loadPrices(); };
$('parse').onclick = parseFree;
$('search').onsubmit = e => { e.preventDefault(); runSearch(); $('q').blur(); };
$('q').oninput = () => { clearTimeout(runSearch.t); if ($('q').value.trim().length >= 3) runSearch.t = setTimeout(() => runSearch(true), 300); else $('search-msg').hidden = true; };
$('f-product').onchange = () => { if ($('f-product').value === '__new') newFood(); else $('new-food').hidden = true; };
$('confirm-form').onsubmit = submitReport;
$('deposit-copy').onclick = () => navigator.clipboard?.writeText($('deposit-invoice').textContent).then(() => toast('✓'));
$('nwc-save').onclick = async () => {
  const uri = $('nwc').value.trim();
  try { const c = createNwc(NT, uri); await c.getBalance(); nwc = c; store.set('nwc', uri); $('nwc').value = ''; renderWallet(); }
  catch (e) { toast(t('err') + e.message); }
};
$('nwc-forget').onclick = () => { nwc?.close(); nwc = null; store.set('nwc', null); renderWallet(); };
$('key-export').onclick = () => {
  if (window.nostr) return toast('NIP-07');
  alert(`${t('keyWarn')}\n\n${NT.nip19.nsecEncode(localKey())}`);
};
$('key-import').onclick = () => {
  const v = prompt(t('pasteKey'));
  if (!v) return;
  try { const d = NT.nip19.decode(v.trim()); if (d.type !== 'nsec') throw new Error('not_nsec'); store.set('nostr_sk', NT.utils.bytesToHex(d.data)); renderWallet(); }
  catch (e) { toast(t('err') + e.message); }
};

(async function init() {
  applyI18n(); setupMic();
  cfg = await api('/api/config');
  if (!prod(product)) product = cfg.products[0].id;
  renderChips(); fillSelects(); loadPrices();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
