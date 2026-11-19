// Dëgg client. Keys and wallet secrets stay on this device; the server only ever sees signed events.
import { createNwc } from './nwc.js';

const NT = window.NostrTools;
const $ = id => document.getElementById(id);
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// ---------- i18n: French (default), English, Wolof (beta — falls back to French) ----------
const T = {
  fr: { tagline: 'Le vrai prix du marché', language: 'Langue', navPrices: 'Prix', navReport: 'Signaler', navWallet: 'Portefeuille',
    spark: '14 derniers jours', today: 'Marché du jour', vs14: 'sur 14 jours', allFoods: 'Tous les aliments', medianOf: 'Prix médian · {p}', reportsN: '{n} signalements', byMarket: 'Par marché', cheapestFirst: 'Le moins cher d’abord',
    reports: 'signalements', report1: '1 signalement', updated: 'mis à jour', confidence: 'Confiance', demo: 'DÉMO', flagged: 'ÉCART',
    confirm: 'Confirmer', tip: 'Récompenser', signed: 'Voir l’événement Nostr signé', noData: 'Aucun prix signalé cette semaine. Soyez le premier !',
    reportTitle: 'Signaler un prix', reportHelp: 'Écrivez ou dites ce que vous avez vu, en français ou en wolof. Ex : « sac de riz 50 kg à 22 500 à Sandaga »',
    reportPh: 'Ex : soble 600 le kilo à Tilène', speak: 'Parler', listening: 'J’écoute…', analyse: 'Analyser', check: 'Vérifiez avant de signer',
    product: 'Produit', market: 'Marché', price: 'Prix par unité', lud16: 'Adresse Lightning (facultatif, pour recevoir des récompenses)',
    publicNote: 'Votre signalement est public et signé avec votre clé Nostr. N’ajoutez pas votre nom ni votre numéro.',
    signPublish: 'Signer et publier', depositTitle: 'Petit dépôt anti-spam', depositHelp: 'Payez cette facture Lightning pour publier. Elle protège Dëgg contre les faux prix.',
    openWallet: 'Ouvrir', copy: 'Copier', copied: 'Copié', paid: 'J’ai payé', published: 'Publié et signé', flagWarn: 'Publié, mais très différent des autres prix : ',
    balance: 'Solde', nwcLabel: 'Connecter un portefeuille', connect: 'Connecter', disconnect: 'Déconnecter',
    nwcHelp: 'Collez le lien Nostr Wallet Connect de votre portefeuille (Alby, Phoenixd…). Il reste uniquement sur ce téléphone.',
    demoWallet: 'Portefeuille de démonstration — faux sats pour tester', demoPill: 'DÉMO', connected: 'Connecté via NWC', livePill: 'CONNECTÉ', identity: 'Votre identité Nostr',
    identityHelp: 'Créée sur ce téléphone. Sauvegardez votre clé secrète : sans elle, vos signalements ne peuvent plus être liés à vous.',
    exportKey: 'Afficher la clé secrète', importKey: 'Importer une clé', network: 'Le réseau Dëgg',
    st_reports: 'Signalements', st_real: 'Signalements réels', st_contrib: 'Contributeurs', st_markets: 'Marchés', st_conf: 'Confirmations', st_sats: 'Sats envoyés',
    tipAsk: 'Combien de sats envoyer ?', tipped: 'Merci ! Récompense envoyée', confirmed: 'Merci, confirmation enregistrée', noLud: 'Ce contributeur n’a pas d’adresse Lightning.',
    search: 'Chercher', searchLabel: 'Chercher un aliment', searchPh: 'Riz, mangue, steak…',
    noSpecific: 'Pas encore de prix précis signalé', estLabel: 'Prix estimé · IA', estWhy: 'Il n’existe pas de prix précis pour cet aliment sur Dëgg. Ceci est une estimation de l’IA, pas un prix vérifié du marché.',
    emptyWhy: 'Les prix de Dëgg viennent des gens au marché. Personne n’a encore signalé celui-ci — soyez le premier, ça prend 20 secondes.',
    beFirst: 'Signaler le vrai prix', emptyBack: 'Retour aux prix',
    otherFood: 'Autre aliment…', foodName: 'Nom de l’aliment', foodNamePh: 'Ex : Mangue, Gombo, Bissap', unit: 'Vendu par',
    u_kg: 'kilo', u_L: 'litre', u_piece: 'pièce', u_bunch: 'botte', u_sack: 'sac', per: 'par {u}', needName: 'Indiquez le nom de l’aliment (2 à 40 lettres).',
    needInfo: 'Il manque : ', ago: 'il y a', min: 'min', h: 'h', d: 'j', noSpeech: 'La dictée vocale n’est pas disponible sur ce navigateur.',
    err: 'Erreur : ', keyWarn: 'Ne partagez jamais cette clé :', pasteKey: 'Collez votre clé nsec…', loading: 'Chargement…', viaAI: 'IA', viaRules: 'règles' },
  en: { tagline: 'The true market price', language: 'Language', navPrices: 'Prices', navReport: 'Report', navWallet: 'Wallet',
    spark: 'Last 14 days', today: 'Today’s market', vs14: '14-day change', allFoods: 'All foods', medianOf: 'Median price · {p}', reportsN: '{n} reports', byMarket: 'By market', cheapestFirst: 'Cheapest first',
    reports: 'reports', report1: '1 report', updated: 'updated', confidence: 'Confidence', demo: 'DEMO', flagged: 'OUTLIER',
    confirm: 'Confirm', tip: 'Reward', signed: 'View signed Nostr event', noData: 'No prices reported this week. Be the first!',
    reportTitle: 'Report a price', reportHelp: 'Type or say what you saw, in French, Wolof or English. E.g. "50 kg rice sack 22,500 at Sandaga"',
    reportPh: 'E.g. onions 600 per kilo at Tilène', speak: 'Speak', listening: 'Listening…', analyse: 'Analyse', check: 'Check before signing',
    product: 'Product', market: 'Market', price: 'Price per unit', lud16: 'Lightning address (optional, to receive rewards)',
    publicNote: 'Your report is public and signed with your Nostr key. Do not add your name or phone number.',
    signPublish: 'Sign and publish', depositTitle: 'Small anti-spam deposit', depositHelp: 'Pay this Lightning invoice to publish. It protects Dëgg from fake prices.',
    openWallet: 'Open', copy: 'Copy', copied: 'Copied', paid: 'I paid', published: 'Published and signed', flagWarn: 'Published, but very different from other prices: ',
    balance: 'Balance', nwcLabel: 'Connect a wallet', connect: 'Connect', disconnect: 'Disconnect',
    nwcHelp: 'Paste your wallet’s Nostr Wallet Connect link (Alby, Phoenixd…). It stays on this phone only.',
    demoWallet: 'Demo wallet — fake sats for testing', demoPill: 'DEMO', connected: 'Connected via NWC', livePill: 'CONNECTED', identity: 'Your Nostr identity',
    identityHelp: 'Created on this phone. Back up your secret key: without it your reports can no longer be linked to you.',
    exportKey: 'Show secret key', importKey: 'Import a key', network: 'The Dëgg network',
    st_reports: 'Reports', st_real: 'Real reports', st_contrib: 'Contributors', st_markets: 'Markets', st_conf: 'Confirmations', st_sats: 'Sats sent',
    tipAsk: 'How many sats to send?', tipped: 'Thank you! Reward sent', confirmed: 'Thanks, confirmation recorded', noLud: 'This contributor has no Lightning address.',
    search: 'Search', searchLabel: 'Search for a food', searchPh: 'Rice, mango, steak…',
    noSpecific: 'No specific price reported yet', estLabel: 'Estimated price · AI', estWhy: 'There isn’t a specific price for this food on Dëgg yet. This is an AI estimate, not a verified market price.',
    emptyWhy: 'Dëgg prices come from people at the market. Nobody has reported this one yet — be the first, it takes 20 seconds.',
    beFirst: 'Report the real price', emptyBack: 'Back to prices',
    otherFood: 'Other food…', foodName: 'Food name', foodNamePh: 'E.g. Mango, Okra, Hibiscus', unit: 'Sold by',
    u_kg: 'kilo', u_L: 'litre', u_piece: 'piece', u_bunch: 'bunch', u_sack: 'sack', per: 'per {u}', needName: 'Enter the food name (2 to 40 letters).',
    needInfo: 'Missing: ', ago: '', min: 'min ago', h: 'h ago', d: 'd ago', noSpeech: 'Voice input is not available in this browser.',
    err: 'Error: ', keyWarn: 'Never share this key:', pasteKey: 'Paste your nsec key…', loading: 'Loading…', viaAI: 'AI', viaRules: 'rules' },
  // Wolof (beta): core navigation and actions. Anything missing falls back to French.
  wo: { tagline: 'Njëg gu dëgg ci marse bi', language: 'Làkk', navPrices: 'Njëg', navReport: 'Yégle', navWallet: 'Kalpe',
    byMarket: 'Ci marse yi', today: 'Marse bu tey', allFoods: 'Lekk yépp', search: 'Seet', searchLabel: 'Seet lekk', searchPh: 'Ceeb, mango, yàpp…',
    reportTitle: 'Yégle ab njëg', speak: 'Wax', listening: 'Maa ngi déglu…', analyse: 'Xool', product: 'Lekk', market: 'Marse', price: 'Njëg',
    signPublish: 'Xaatim te yégle', confirm: 'Dëggal', tip: 'Jox', balance: 'Xaalis bi', connect: 'Lëkkale', disconnect: 'Dagg',
    beFirst: 'Yégle njëg gu dëgg gi', emptyBack: 'Dellu ci njëg yi', copy: 'Duppi', paid: 'Fey naa', u_kg: 'kilo', u_piece: 'benn', u_sack: 'saaku' },
};
let lang = store.get('lang') || (navigator.language?.startsWith('en') ? 'en' : 'fr');
const t = (k, vars) => { let s = T[lang]?.[k] ?? T.fr[k] ?? k; for (const [a, b] of Object.entries(vars || {})) s = s.replace(`{${a}}`, b); return s; };
const apiLang = () => (lang === 'en' ? 'en' : 'fr');
function applyI18n() {
  document.documentElement.lang = lang;
  $('lang').value = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
}

// ---------- helpers ----------
const fmt = n => n == null ? '–' : Number(n).toLocaleString('fr-FR');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function ago(ts) {
  const s = Date.now() / 1000 - ts;
  const [v, u] = s < 3600 ? [Math.max(1, Math.round(s / 60)), 'min'] : s < 86400 ? [Math.round(s / 3600), 'h'] : [Math.round(s / 86400), 'd'];
  return lang === 'en' ? `${v} ${t(u)}` : `${t('ago')} ${v} ${t(u)}`;
}
function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4000); }
async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.status), { status: res.status });
  return data;
}
const pShort = p => lang === 'en' ? p.en : lang === 'wo' ? p.wo : p.fr;
const pName = p => (p.custom || lang === 'en' ? pShort(p) : `${p.fr} · ${p.wo}`);
const unitName = u => t('u_' + u);
const trendPill = (v, cls = '') => v == null ? '' : v > 0 ? `<span class="pill up ${cls}">${icon('up')}${v}%</span>`
  : v < 0 ? `<span class="pill down ${cls}">${icon('down')}${-v}%</span>` : `<span class="pill flat ${cls}">${icon('flat')}0%</span>`;

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
const slugify = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// ---------- watchlist: key staples at a glance ----------
function miniSpark(history, cls) {
  const v = history.map((x, i) => [i, x]).filter(([, x]) => x != null);
  if (v.length < 2) return '';
  const ys = v.map(p => p[1]), lo = Math.min(...ys), span = Math.max(...ys) - lo || 1;
  const d = v.map(([i, y], k) => `${k ? 'L' : 'M'}${(i / 13 * 52 + 1).toFixed(1)},${(20 - (y - lo) / span * 18).toFixed(1)}`).join(' ');
  return `<svg class="w-spark ${cls}" viewBox="0 0 54 22" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
}
let overview = null;
async function loadWatch() {
  if (!overview) $('watch').innerHTML = '<div class="w-card skel"></div>'.repeat(4);
  try { overview = (await api('/api/overview')).items; } catch { if (!overview) { $('watch-wrap').hidden = true; return; } }
  $('watch').innerHTML = overview.map(i => {
    const p = prod(i.product), cls = i.change > 0 ? 'up' : i.change < 0 ? 'down' : 'flat';
    return `<button class="w-card" data-p="${i.product}" aria-pressed="${i.product === product}">
      <div class="w-name">${esc(pShort(p))}</div>
      <div class="w-price">${fmt(i.overall)}<small>/${esc(unitName(p.unit))}</small></div>
      <div class="w-foot">${trendPill(i.change)}${miniSpark(i.history, cls)}</div>
    </button>`;
  }).join('');
}

// ---------- prices tab ----------
function renderChips() {
  const cur = prod(product), list = cur?.custom ? [cur, ...cfg.products] : cfg.products;
  $('chips').innerHTML = list.map(p => `<button class="chip" role="tab" data-p="${esc(p.id)}" aria-selected="${p.id === product}">${esc(pShort(p))}</button>`).join('');
}
function spark(history) {
  const pts = history.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (pts.length < 2) { $('spark').innerHTML = ''; return; }
  const vs = pts.map(p => p[1]), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const xy = pts.map(([i, v]) => [(i / 13) * 296 + 2, 58 - ((v - lo) / span) * 50]);
  const line = xy.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${xy.at(-1)[0].toFixed(1)},64 L${xy[0][0].toFixed(1)},64 Z`;
  $('spark').innerHTML = `<defs><linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ff0c4" stop-opacity=".35"/><stop offset="1" stop-color="#8ff0c4" stop-opacity="0"/></linearGradient></defs>
    <path class="area" d="${area}"/><path class="line" d="${line}"/>`;
}
async function loadPrices() {
  const p = prod(product);
  $('markets').innerHTML = '<div class="row-skel"></div>'.repeat(3);
  $('hero-label').textContent = t('medianOf', { p: pShort(p) });
  try {
    const data = await api(`/api/prices?product=${encodeURIComponent(product)}&lang=${apiLang()}`);
    const total = data.markets.reduce((n, m) => n + m.reports, 0);
    $('summary').textContent = data.summary;
    $('overall').textContent = data.overall ? fmt(data.overall) : '–';
    $('overall-unit').textContent = `XOF / ${unitName(p.unit)}`;
    $('hero-count').textContent = total === 1 ? t('report1') : t('reportsN', { n: total });
    const recent = data.history.filter(v => v != null);
    const tr = recent.length >= 2 ? Math.round(((recent.at(-1) - recent[0]) / recent[0]) * 100) : null;
    $('hero-trend').hidden = tr == null;
    $('hero-trend').innerHTML = tr == null ? '' : `${icon(tr > 0 ? 'up' : tr < 0 ? 'down' : 'flat')}${tr > 0 ? '+' : ''}${tr}%`;
    spark(data.history);
    $('markets').innerHTML = data.markets.length ? data.markets.map(m => `
      <button class="row-item" data-m="${m.market}" aria-label="${esc(m.name)}">
        <span class="avatar">${icon('store')}</span>
        <span class="row-name">${esc(m.name)}${m.demo ? `<span class="badge">${t('demo')}</span>` : ''}</span>
        <span class="row-right"><span class="row-price">${fmt(m.median)}</span>${trendPill(m.trend)}</span>
        <span class="row-meta">${m.reports === 1 ? t('report1') : `${m.reports} ${t('reports')}`} · ${ago(m.last)}${m.min !== m.max ? ` · ${fmt(m.min)}–${fmt(m.max)}` : ''}</span>
        <span class="conf"><span class="bar"><i style="width:${m.confidence}%"></i></span>${t('confidence')} ${m.confidence}%</span>
      </button>`).join('') : `<div class="empty-row">${t('noData')}</div>`;
  } catch (e) { $('markets').innerHTML = `<div class="empty-row">${t('err')}${esc(e.message)}</div>`; }
}
async function openDetail(market) {
  openMarket = market;
  const m = cfg.markets.find(x => x.id === market), p = prod(product);
  $('detail-title').textContent = m.name;
  $('detail-sub').textContent = `${pName(p)} · XOF / ${unitName(p.unit)}`;
  $('detail').hidden = false;
  $('reports').innerHTML = `<li class="loading">${t('loading')}</li>`;
  const { reports } = await api(`/api/reports?product=${encodeURIComponent(product)}&market=${market}`);
  const me = await myPubkey();
  $('reports').innerHTML = reports.map(r => {
    const npub = NT.nip19.npubEncode(r.pubkey);
    return `<li>
      <div class="rep-top">
        <span class="avatar alt">${esc(npub.slice(5, 7).toUpperCase())}</span>
        <div><div class="mono-short small">${esc(npub.slice(0, 14))}…${r.demo ? `<span class="badge">${t('demo')}</span>` : ''}${r.flag ? `<span class="badge flag" title="${esc(r.flag)}">${t('flagged')}</span>` : ''}</div>
          <div class="muted small">${ago(r.created_at)}</div></div>
        <span class="row-price">${fmt(r.price)}</span>
      </div>
      ${r.note ? `<p class="rep-note">“${esc(r.note)}”</p>` : ''}
      ${r.flag ? `<p class="rep-note muted small">${esc(r.flag)}</p>` : ''}
      <div class="rep-stats"><span>${icon('check')}${r.confirms}</span><span>${icon('zap')}${fmt(r.tipped)} sats</span></div>
      <div class="btn-row">
        ${r.pubkey !== me ? `<button class="btn secondary small" data-confirm="${r.id}">${icon('check')}${t('confirm')}</button>` : ''}
        <button class="btn secondary small" data-tip="${r.id}" data-lud="${r.lud16 ? 1 : 0}">${icon('zap', 'accent')}${t('tip')}</button>
      </div>
      <details><summary>${t('signed')}</summary><pre>${esc(JSON.stringify(r.event, null, 1))}</pre></details>
    </li>`;
  }).join('') || `<li class="empty-row">${t('noData')}</li>`;
  $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  $('f-product').innerHTML = cfg.products.map(p => `<option value="${p.id}">${esc(pName(p))} (${unitName(p.unit)})</option>`).join('') + `<option value="__new">${t('otherFood')}</option>`;
  $('f-unit').innerHTML = cfg.units.map(u => `<option value="${u}">${unitName(u)}</option>`).join('');
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
    const miss = r.missing?.length ? `${t('needInfo')}${r.missing.map(k => t(k)).join(', ')}. ` : '';
    $('ai-note').textContent = `${miss}${r.explanation || ''} (${r.source === 'ai' ? t('viaAI') : t('viaRules')})`;
    $('confirm-form').hidden = false; $('deposit').hidden = true; $('report-status').hidden = true;
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
    const st = $('report-status');
    st.className = r.flag ? 'status warn' : 'status';
    st.innerHTML = r.flag ? `${icon('alert')}<span>${esc(t('flagWarn') + r.flag)}</span>` : `${icon('check')}<span>${t('published')}</span>`;
    st.hidden = false;
    $('confirm-form').hidden = true; $('deposit').hidden = true; $('free').value = '';
    product = pendingEvent.tags.find(x => x[0] === 'product')[1];
    const nm = pendingEvent.tags.find(x => x[0] === 'name')?.[1];
    if (nm) remember({ id: product, fr: nm, en: nm, wo: nm, unit: pendingEvent.tags.find(x => x[0] === 'unit')[1], custom: true });
    store.set('product', product);
    loadPrices(); renderChips(); overview = null; loadWatch();
  } catch (e) { toast(t('err') + e.message); }
}
function setupMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  $('mic').onclick = () => {
    if (!SR) return toast(t('noSpeech'));
    const rec = new SR();
    rec.lang = lang === 'en' ? 'en-US' : 'fr-SN';
    rec.interimResults = false;
    $('mic').classList.add('recording'); $('mic-label').textContent = t('listening');
    rec.onresult = e => { $('free').value = [$('free').value, e.results[0][0].transcript].filter(Boolean).join(' '); };
    rec.onend = () => { $('mic').classList.remove('recording'); $('mic-label').textContent = t('speak'); };
    rec.onerror = () => rec.onend();
    rec.start();
  };
}

// ---------- wallet tab ----------
async function renderWallet() {
  $('npub').textContent = NT.nip19.npubEncode(await myPubkey());
  if (nwc) {
    $('wallet-state').textContent = `${t('connected')} · ${new URL(nwc.relayUrl).host}`;
    $('wallet-pill').textContent = t('livePill');
    $('balance').textContent = '…';
    nwc.getBalance().then(b => { $('balance').textContent = fmt(Math.floor(b.balance / 1000)); })
      .catch(e => { $('balance').textContent = '–'; toast(t('err') + e.message); });
  } else {
    $('wallet-state').textContent = t('demoWallet');
    $('wallet-pill').textContent = t('demoPill');
    $('balance').textContent = fmt(demoBal());
  }
  const s = await api('/api/stats');
  $('stats').innerHTML = [['file', 'st_reports', s.reports], ['shield', 'st_real', s.real_reports], ['users', 'st_contrib', s.contributors],
    ['store', 'st_markets', s.markets], ['check', 'st_conf', s.confirmations], ['zap', 'st_sats', s.sats_tipped]]
    .map(([i, k, v]) => `<div class="tile">${icon(i)}<b>${fmt(v)}</b><span>${t(k)}</span></div>`).join('');
}

// ---------- search: any food; unreported foods show an AI estimate, clearly labelled ----------
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function showEmpty(q) {
  $('tab-prices').classList.toggle('no-results', Boolean(q));
  $('empty').hidden = !q;
  if (!q) return;
  $('empty-title').textContent = cap(q);
  $('empty-report-label').textContent = t('beFirst');
  $('empty-report').dataset.newfood = q; delete $('empty-report').dataset.unit;
  $('estimate').hidden = true; $('no-estimate').hidden = true;
  if (cfg.estimates) loadEstimate(q); else $('no-estimate').hidden = false;
}
async function loadEstimate(q) {
  $('estimate').hidden = false;
  $('est-range').innerHTML = '<span class="skeleton"></span>'; $('est-unit').textContent = ''; $('est-note').textContent = '';
  try {
    const e = await api(`/api/estimate?q=${encodeURIComponent(q)}&lang=${apiLang()}`);
    if ($('empty-report').dataset.newfood !== q || $('empty').hidden) return; // user moved on
    if (!e.available) { $('estimate').hidden = true; $('no-estimate').hidden = false; return; }
    $('empty-title').textContent = e.food;
    $('est-range').textContent = `${fmt(e.low)} – ${fmt(e.high)} XOF`;
    $('est-unit').textContent = t('per', { u: unitName(e.unit) });
    $('est-note').textContent = e.note;
    $('empty-report').dataset.newfood = e.report_name || e.food; $('empty-report').dataset.unit = e.unit;
    $('empty-report').dataset.query = q;
  } catch { $('estimate').hidden = true; $('no-estimate').hidden = false; }
}
function selectProduct(id) {
  showEmpty(null);
  product = id; store.set('product', id); $('detail').hidden = true;
  renderChips(); loadPrices();
  document.querySelectorAll('.w-card').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.p === id)));
  document.querySelector(`.chip[data-p="${CSS.escape(id)}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
}
let searchSeq = 0;
async function runSearch(auto = false) {
  const q = $('q').value.trim(), msg = $('search-msg'), seq = ++searchSeq;
  if (!q) { msg.hidden = true; showEmpty(null); return; }
  let hits;
  try { hits = (await api(`/api/search?q=${encodeURIComponent(q)}`)).results; }
  catch { hits = cfg.products.filter(p => [p.fr, p.en, p.wo, ...p.syn].some(s => norm(s).includes(norm(q)))); } // offline
  if (seq !== searchSeq) return; // a newer search is running
  hits.forEach(remember);
  if (hits.length) {
    msg.hidden = hits.length === 1;
    msg.innerHTML = hits.map(p => `<button type="button" class="chip" data-p="${esc(p.id)}">${esc(pName(p))} · ${unitName(p.unit)}</button>`).join('');
    if (hits.length === 1 || !auto) selectProduct(hits[0].id);
    const market = cfg.markets.find(m => norm(q).includes(norm(m.name)));
    if (market && !auto) setTimeout(() => openDetail(market.id), 600);
  } else if (!auto) {
    msg.hidden = true;
    showEmpty(q);
  }
}
function reportNewFood(name, unit = 'kg') {
  showTab('report'); fillSelects(); newFood(cap(name), unit);
  $('f-lud16').value = store.get('lud16') || ''; $('ai-note').textContent = '';
  $('confirm-form').hidden = false; $('deposit').hidden = true; $('report-status').hidden = true; $('f-price').focus();
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
  else if (el.dataset.newfood) reportNewFood(el.dataset.newfood, el.dataset.unit);
  else if (el.dataset.m) openDetail(el.dataset.m);
  else if (el.dataset.confirm) confirmReport(el.dataset.confirm);
  else if (el.dataset.tip) tipReport(el.dataset.tip, el.dataset.lud === '1');
});
$('empty-back').onclick = () => { $('q').value = ''; showEmpty(null); $('search-msg').hidden = true; };
$('detail-close').onclick = () => { $('detail').hidden = true; };
$('lang').onchange = () => {
  lang = $('lang').value; store.set('lang', lang); applyI18n(); renderChips(); fillSelects(); loadPrices(); loadWatch();
  if (!$('empty').hidden) showEmpty($('empty-report').dataset.query || $('empty-report').dataset.newfood);
  if ($('tab-wallet').classList.contains('active')) renderWallet();
};
$('parse').onclick = parseFree;
$('search').onsubmit = e => { e.preventDefault(); runSearch(); $('q').blur(); };
$('q').oninput = () => { clearTimeout(runSearch.t); if ($('q').value.trim().length >= 3) runSearch.t = setTimeout(() => runSearch(true), 300); else { $('search-msg').hidden = true; showEmpty(null); } };
$('f-product').onchange = () => { if ($('f-product').value === '__new') newFood(); else $('new-food').hidden = true; };
$('confirm-form').onsubmit = submitReport;
$('deposit-copy').onclick = () => navigator.clipboard?.writeText($('deposit-invoice').textContent).then(() => toast(t('copied')));
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
  if (!T[lang]) lang = 'fr';
  applyI18n(); setupMic();
  cfg = await api('/api/config');
  if (!prod(product)) product = cfg.products[0].id;
  renderChips(); fillSelects(); loadPrices(); loadWatch();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
