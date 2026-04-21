import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { Readable } from 'node:stream'

// Dynamic import to avoid bundling issues with TanStack Start's SSR output
// This wraps the handler exported by TanStack Start (GitHub issue #5476)
const serverModule = await import('./dist/server/server.js')
const handler = serverModule.default?.fetch ?? serverModule.fetch ?? serverModule.default

const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const port = Number(process.env.PORT ?? 3000)

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://umami.lab.guilhermeseckert.dev",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://umami.lab.guilhermeseckert.dev",
    "frame-ancestors 'none'",
  ].join('; '),
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)

  // Serve static assets from Vite build output
  if (url.pathname.startsWith('/assets/') || url.pathname === '/favicon.ico') {
    const filePath = join(process.cwd(), 'dist/client', url.pathname)
    if (existsSync(filePath)) {
      const stat = statSync(filePath)
      const ext = extname(filePath)
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
      })
      createReadStream(filePath).pipe(res)
      return
    }
  }

  // SSR handler for everything else
  try {
    const request = new Request(url, {
      method: req.method,
      headers: Object.fromEntries(
        Object.entries(req.headers).filter(([, v]) => v !== undefined).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v as string])
      ),
    })
    const response = await handler(request)

    const responseHeaders = Object.fromEntries(response.headers.entries())
    res.writeHead(response.status, { ...SECURITY_HEADERS, ...responseHeaders })

    if (response.body === null) {
      res.end()
      return
    }

    Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(res)
  } catch (err: unknown) {
    console.error('[ssr-handler]', err)
    if (res.headersSent) {
      res.end()
      return
    }
    res.writeHead(500, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS })
    res.end('Internal Server Error')
  }
})

server.listen(port, () => {
  console.log(`GovTrace web server running on port ${port}`)
})

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[unhandledRejection]', reason)
})

process.on('uncaughtException', (err: unknown) => {
  console.error('[uncaughtException]', err)
})
