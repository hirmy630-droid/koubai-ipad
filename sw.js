'use strict';
const APP_BASE = new URL('./', self.location.href);
const CACHE_PREFIX = `slope-calc:${APP_BASE.pathname}:`;
const CACHE_NAME = `${CACHE_PREFIX}20261004-enter-v3`;
const INDEX_URL = new URL('index.html', APP_BASE).href;
const CORE_ASSETS = ['index.html', 'manifest.json'].map(path => new URL(path, APP_BASE).href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
async function networkFirst(request, navigation) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);
  const appPage = navigation && (url.pathname === APP_BASE.pathname || url.pathname === new URL(INDEX_URL).pathname);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      try {
        await cache.put(request, response.clone());
        if (appPage) await cache.put(INDEX_URL, response.clone());
      } catch (_) { /* 記憶容量不足でもオンライン表示を継続 */ }
      return response;
    }
    if (response.status < 500) return response;
    const cached = await cache.match(request) || (appPage ? await cache.match(INDEX_URL) : undefined);
    return cached || response;
  } catch (_) {
    const cached = await cache.match(request) || (appPage ? await cache.match(INDEX_URL) : undefined);
    return cached || new Response('オフラインではこのファイルを取得できません', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== APP_BASE.origin || !url.pathname.startsWith(APP_BASE.pathname)) return;
  if (url.pathname === new URL('sw.js', APP_BASE).pathname) return;
  event.respondWith(networkFirst(request, request.mode === 'navigate'));
});
