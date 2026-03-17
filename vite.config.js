import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Charger les variables d'environnement
  const env = loadEnv(mode, process.cwd(), '')
  const isDev = mode === 'development'

  return {
    plugins: [
      react(),
      // Middleware local /api/qualify — uniquement en développement (vite dev)
      // En production Vercel, c'est pages/api/qualify.js qui prend le relai
      isDev && {
        name: 'api-qualify',
        async configureServer(server) {
          // Import dynamique pour éviter tout crash lors du build Vercel
          let handleQualify
          try {
            const mod = await import('./src/server/index.js')
            handleQualify = mod.handleQualify
          } catch (e) {
            console.warn('[VITE] Impossible de charger le serveur qualify:', e.message)
            return
          }

          if (env.VITE_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
            process.env.OPENAI_API_KEY = env.VITE_OPENAI_API_KEY
          }
          if (env.OPENAI_API_KEY) {
            process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
          }

          server.middlewares.use('/api/qualify', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: true, message: 'Méthode non autorisée. Utilisez POST.' }))
              return
            }
            try {
              let body = ''
              req.on('data', chunk => { body += chunk.toString() })
              req.on('end', async () => {
                try {
                  const parsedBody = body ? JSON.parse(body) : {}
                  const requestLike = { method: req.method, json: async () => parsedBody, headers: req.headers }
                  const response = await handleQualify(requestLike)
                  res.statusCode = response.status
                  response.headers.forEach((value, key) => { res.setHeader(key, value) })
                  res.end(await response.text())
                } catch (error) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: true, message: error.message }))
                }
              })
            } catch (error) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: true, message: error.message }))
            }
          })
        }
      }
    ].filter(Boolean),
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
    }
  }
})
