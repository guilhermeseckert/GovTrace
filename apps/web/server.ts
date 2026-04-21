import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { Readable } from 'node:stream'
import { createGzip, createBrotliCompress } from 'node:zlib'

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

const PUBLIC_CACHEABLE_PATHS = new Set([
  '/',
  '/dashboard',
  '/how-it-works',
  '/about',
  '/privacy',
  '/news',
  '/regulations',
  '/patterns',
])
const PUBLIC_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=600'

const COMPRESSIBLE_PREFIXES = ['text/'] as const
const COMPRESSIBLE_EXACT = new Set([
  'application/javascript',
  'application/json',
  'image/svg+xml',
])
const MIN_COMPRESS_BYTES = 1024

function pickEncoding(acceptEncoding: string | undefined): 'br' | 'gzip' | null {
  if (!acceptEncoding) return null
  const header = acceptEncoding.toLowerCase()
  if (header.includes('br')) return 'br'
  if (header.includes('gzip')) return 'gzip'
  return null
}

function isCompressibleType(contentType: string): boolean {
  if (COMPRESSIBLE_PREFIXES.some((prefix) => contentType.startsWith(prefix))) {
    return true
  }
  const base = contentType.split(';')[0].trim()
  return COMPRESSIBLE_EXACT.has(base)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)

  // Health check — no DB, no SSR, no security headers needed (internal only)
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{"ok":true}')
    return
  }

  // Serve static assets from Vite build output
  if (url.pathname.startsWith('/assets/') || url.pathname === '/favicon.ico') {
    const filePath = join(process.cwd(), 'dist/client', url.pathname)
    if (existsSync(filePath)) {
      const stat = statSync(filePath)
      const ext = extname(filePath)
      const mime = MIME_TYPES[ext] ?? 'application/octet-stream'
      const acceptEncodingStatic =
        typeof req.headers['accept-encoding'] === 'string'
          ? req.headers['accept-encoding']
          : undefined
      const encodingStatic =
        isCompressibleType(mime) && stat.size >= MIN_COMPRESS_BYTES
          ? pickEncoding(acceptEncodingStatic)
          : null

      const staticHeaders: Record<string, string | number> = {
        ...SECURITY_HEADERS,
        'Content-Type': mime,
        'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
      }
      if (encodingStatic) {
        staticHeaders['Content-Encoding'] = encodingStatic
        staticHeaders['Vary'] = 'Accept-Encoding'
        // Content-Length invalid after compression — omit it.
      } else {
        staticHeaders['Content-Length'] = stat.size
      }

      res.writeHead(200, staticHeaders)
      const fileStream = createReadStream(filePath)
      if (encodingStatic === 'br') {
        fileStream.pipe(createBrotliCompress()).pipe(res)
      } else if (encodingStatic === 'gzip') {
        fileStream.pipe(createGzip()).pipe(res)
      } else {
        fileStream.pipe(res)
      }
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
    const contentType = responseHeaders['content-type'] ?? ''
    const existingCacheControl = responseHeaders['cache-control']

    const shouldCache =
      req.method === 'GET' &&
      response.status === 200 &&
      contentType.startsWith('text/html') &&
      PUBLIC_CACHEABLE_PATHS.has(url.pathname) &&
      !existingCacheControl
    // Future: add `&& !req.headers.cookie` (or a more specific auth-cookie check)
    // once auth ships. Single `if` extension point.

    const finalHeaders: Record<string, string | number> = {
      ...SECURITY_HEADERS,
      ...responseHeaders,
    }
    if (shouldCache) {
      finalHeaders['Cache-Control'] = PUBLIC_CACHE_CONTROL
    }

    // req.headers['accept-encoding'] is typed as string | undefined by @types/node
    const acceptEncoding = req.headers['accept-encoding']
    const encoding = isCompressibleType(contentType) ? pickEncoding(acceptEncoding) : null

    if (encoding) {
      finalHeaders['Content-Encoding'] = encoding
      finalHeaders['Vary'] = finalHeaders['Vary']
        ? `${finalHeaders['Vary']}, Accept-Encoding`
        : 'Accept-Encoding'
      delete finalHeaders['content-length']
      delete finalHeaders['Content-Length']
    }

    res.writeHead(response.status, finalHeaders)

    if (response.body === null) {
      res.end()
      return
    }

    const nodeStream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)
    if (encoding === 'br') {
      nodeStream.pipe(createBrotliCompress()).pipe(res)
    } else if (encoding === 'gzip') {
      nodeStream.pipe(createGzip()).pipe(res)
    } else {
      nodeStream.pipe(res)
    }
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
