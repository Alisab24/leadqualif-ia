import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handleQualify } from './src/server/index.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Charger les variables d'environnement
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      react(),
      {
        name: 'api-qualify',
        configureServer(server) {
          // Injecter les variables d'environnement dans process.env pour le middleware
          // Vite charge les variables .env mais seulement pour VITE_* côté client
          // On doit les exposer aussi dans process.env pour le middleware serveur
          if (env.VITE_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
            process.env.OPENAI_API_KEY = env.VITE_OPENAI_API_KEY
            console.log('[VITE] Variable VITE_OPENAI_API_KEY chargée dans process.env')
          }
          if (env.OPENAI_API_KEY) {
            process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
            console.log('[VITE] Variable OPENAI_API_KEY chargée depuis .env')
          }

          server.middlewares.use('/api/qualify', async (req, res, next) => {
          // Ne traiter que les requêtes POST
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              error: true,
              message: 'Méthode non autorisée. Utilisez POST.'
            }))
            return
          }

          try {
            // Lire le body de la requête
            let body = ''
            req.on('data', chunk => {
              body += chunk.toString()
            })

            req.on('end', async () => {
              try {
                // Parser le body JSON
                let parsedBody = {}
                if (body) {
                  try {
                    parsedBody = JSON.parse(body)
                  } catch (parseError) {
                    res.statusCode = 400
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({
                      error: true,
                      message: 'Corps de la requête invalide (JSON attendu)'
                    }))
                    return
                  }
                }

                // Créer un objet Request-like pour notre handler
                const requestLike = {
                  method: req.method,
                  json: async () => parsedBody,
                  headers: req.headers
                }

                // Appeler notre handler
                const response = await handleQualify(requestLike)

                // Envoyer la réponse
                res.statusCode = response.status
                response.headers.forEach((value, key) => {
                  res.setHeader(key, value)
                })
                const text = await response.text()
                res.end(text)
              } catch (error) {
                console.error('[VITE MIDDLEWARE] Erreur dans le middleware API:', error)
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                // NE PAS retourner de fallback - laisser l'erreur remonter
                res.end(JSON.stringify({
                  error: true,
                  message: `Erreur technique: ${error.message || 'Erreur inconnue'}`,
                  details: error.stack
                }))
              }
            })
          } catch (error) {
            console.error('[VITE MIDDLEWARE] Erreur critique:', error)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            // NE PAS retourner de fallback - laisser l'erreur remonter
            res.end(JSON.stringify({
              error: true,
              message: `Erreur technique: ${error.message || 'Erreur inconnue'}`,
              details: error.stack
            }))
          }
        })
        }
      }
    ],
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
