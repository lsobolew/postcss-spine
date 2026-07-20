/*
 * Tiny static server for the demo that can simulate network latency.
 *
 * Any request with a `?delay=<ms>` query is held for that many milliseconds
 * before responding — used by vitals.html to make render-blocking CSS behave
 * like it would over a real connection (localhost is otherwise instant).
 *
 * Run:  npm run demo:serve   →  http://127.0.0.1:8124/
 */
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 8124

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

const server = createServer(async (req, res) => {
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

  const delay = Math.min(Number(url.searchParams.get('delay')) || 0, 10000)
  const send = () => {
    res.writeHead(200, {
      'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    res.end(body)
  }
  if (delay > 0) setTimeout(send, delay)
  else send()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`postcss-spine demo running at http://127.0.0.1:${PORT}/`)
  console.log('Open /vitals.html for the Core Web Vitals comparison. Ctrl+C to stop.')
})
