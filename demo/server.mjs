/*
 * Tiny static server for the demo that can simulate network latency.
 *
 * Any request with a `?delay=<ms>` query is held for that many milliseconds
 * before responding — used by vitals.html / bench.mjs to make render-blocking
 * CSS behave like it would over a real connection (localhost is otherwise
 * instant).
 *
 * Run:  npm run demo:serve   →  http://127.0.0.1:8124/
 */
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

/** Create the demo HTTP server (not yet listening). */
export function createDemoServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === '/' || pathname.endsWith('/')) pathname += 'index.html'

    const filePath = normalize(join(here, pathname))
    if (!filePath.startsWith(here)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Forbidden')
      return
    }

    let body
    try {
      body = await readFile(filePath)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
      return
    }

    // Latency is simulated for the (render-blocking) CSS only — never for the
    // HTML document itself, otherwise every variant's navigation would be
    // delayed equally and the comparison would be meaningless.
    const ext = extname(filePath)
    const delay = ext === '.css' ? Math.min(Number(url.searchParams.get('delay')) || 0, 10000) : 0
    const send = () => {
      res.writeHead(200, {
        'Content-Type': TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      res.end(body)
    }
    if (delay > 0) setTimeout(send, delay)
    else send()
  })
}

/** Start listening; resolves with { server, port, origin }. */
export function startDemoServer(port = 0) {
  return new Promise((resolve) => {
    const server = createDemoServer()
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port
      resolve({ server, port: actual, origin: `http://127.0.0.1:${actual}` })
    })
  })
}

// Run directly (`node demo/server.mjs`) → serve on a fixed port.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8124
  const { origin } = await startDemoServer(port)
  console.log(`postcss-spine demo running at ${origin}/`)
  console.log('Open /vitals.html for the Core Web Vitals comparison. Ctrl+C to stop.')
}
