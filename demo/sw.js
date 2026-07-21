/*
 * Connection-simulating service worker for the Web Vitals demo.
 *
 * Requests for a `*.css` with `?rtt=<ms>` and/or `?bw=<bytes-per-second>` are
 * held to reproduce a real connection in the browser:
 *
 *     delay = rtt + (fileBytes / bw) * 1000
 *
 * so a *smaller* stylesheet arrives sooner. The render-blocking `<link>` still
 * blocks the first paint while it waits, so this works on static hosting
 * (GitHub Pages) with no server. Everything else passes through untouched.
 *
 * The throttling params are stripped before fetching the real file, so a
 * throttling server (demo/server.mjs) in front won't double up.
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const throttled =
    url.pathname.endsWith('.css') && (url.searchParams.has('rtt') || url.searchParams.has('bw'))
  if (!throttled) return

  const rtt = Math.min(Number(url.searchParams.get('rtt')) || 0, 10000)
  const bw = Number(url.searchParams.get('bw')) || 0 // bytes/sec, 0 = unthrottled
  url.searchParams.delete('rtt')
  url.searchParams.delete('bw')

  event.respondWith(
    (async () => {
      const response = await fetch(url.toString(), { cache: 'no-store' })
      const body = await response.arrayBuffer()
      const transfer = bw > 0 ? (body.byteLength / bw) * 1000 : 0
      const delay = Math.min(rtt + transfer, 20000)
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
      return new Response(body, { status: response.status, headers: response.headers })
    })(),
  )
})
