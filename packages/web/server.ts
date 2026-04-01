import { createServer } from 'node:http'
import { createApp, toNodeHandler } from 'srvx'
import { serveStatic } from 'srvx/static'

// Dynamic import to avoid bundling issues with TanStack Start's SSR output
// This wraps the handler exported by TanStack Start (GitHub issue #5476)
const { default: handler } = await import('./dist/server/server.js')

const app = createApp({
  fetch(req) {
    return handler(req)
  },
})

// Serve static assets from the Vite build output
app.use('/assets', serveStatic({ dir: 'dist/client/assets' }))
app.use('/favicon.ico', serveStatic({ dir: 'dist/client' }))

const port = Number(process.env.PORT ?? 3000)

const server = createServer(toNodeHandler(app))
server.listen(port, () => {
  console.log(`GovTrace web server running on port ${port}`)
})
