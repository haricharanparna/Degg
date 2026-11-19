// Offline shell for patchy connections: cache static assets, last price responses fall back from cache.
const CACHE = 'degg-v4';
const SHELL = ['/', '/style.css', '/app.js', '/nwc.js', '/vendor/nostr.bundle.js', '/icon.svg', '/manifest.webmanifest'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const cacheable = SHELL.includes(url.pathname) || url.pathname === '/api/prices' || url.pathname === '/api/config';
  if (!cacheable) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
    .catch(() => caches.match(e.request)));
});
