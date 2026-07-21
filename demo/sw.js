/*
 * Latency-simulating service worker for the Web Vitals demo.
 *
 * Requests for a `*.css?delay=<ms>` file are held for that many milliseconds
 * before responding, reproducing render-blocking network latency in the
 * browser — so vitals.html works on static hosting (GitHub Pages) with no
 * server. Everything else passes through untouched.
 *
 * The `delay` param is stripped before fetching the real file, so if a
 * delaying server (demo/server.mjs) is also in front it won't double up.
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (!url.pathname.endsWith('.css') || !url.searchParams.has('delay')) return

  const delay = Math.min(Number(url.searchParams.get('delay')) || 0, 10000)
  url.searchParams.delete('delay')

  event.respondWith(
    fetch(url.toString(), { cache: 'no-store' }).then((response) =>
      delay > 0 ? new Promise((resolve) => setTimeout(() => resolve(response), delay)) : response,
    ),
  )
})
