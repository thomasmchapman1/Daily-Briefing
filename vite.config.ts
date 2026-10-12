import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { handleGoogle } from './server/google.ts'
import { IcsError, handleIcsRequest } from './server/icsEvents.ts'

// Serves /api/* during `vite dev` / `vite preview`, mirroring the Vercel functions in api/.
function localApi(): Plugin {
  const middleware = (req: any, res: any, next: () => void) => {
    const google = req.url?.match(/^\/api\/google\/([a-z]+)/)
    if (google) return void handleGoogle(google[1], req, res)
    if (!req.url?.startsWith('/api/ics')) return next()
    const send = (status: number, body: unknown) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'POST') return send(405, { error: 'Method not allowed' })
    let raw = ''
    req.on('data', (chunk: Buffer) => (raw += chunk))
    req.on('end', async () => {
      try {
        send(200, await handleIcsRequest(JSON.parse(raw || '{}')))
      } catch (err) {
        send(err instanceof IcsError ? err.status : 500, {
          error: err instanceof IcsError ? err.message : 'Calendar could not be read',
        })
      }
    })
  }
  return {
    name: 'local-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}

export default defineConfig({
  plugins: [
    react(),
    localApi(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'The Morning Briefing',
        short_name: 'The Morning Briefing',
        description: 'A personal morning briefing.',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        background_color: '#f3f2f2',
        theme_color: '#f3f2f2',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell (JS, CSS, self-hosted fonts, icons) is precached for offline opening.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
