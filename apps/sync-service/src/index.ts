import pkg from '../package.json' with { type: 'json' }
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import { config } from './config.js'
import { authRoutes } from './routes/auth.js'
import { notesRoutes } from './routes/notes.js'
import { syncRoutes } from './routes/sync.js'
import { collectionsRoutes } from './routes/collections.js'
import { tagsRoutes } from './routes/tags.js'
import { exportRoutes } from './routes/export.js'
import { noteTypeRoutes } from './routes/noteTypes.js'
import { topicsRoutes } from './routes/topics.js'
import { ingestRoutes } from './routes/ingest.js'

const app = Fastify({ logger: true })

// Plugins
await app.register(cors, {
  origin: config.allowedOrigin,
  credentials: true,
})

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
})

await app.register(jwt, {
  secret: config.jwtSecret,
})

await app.register(websocket)

// Auth decorator
app.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Unauthorized' })
  }
})

// Health check (unauthenticated — used by sync engine polling)
app.get('/health', async () => ({ ok: true, version: pkg.version, ts: new Date().toISOString() }))

// Routes
await app.register(authRoutes, { prefix: '/auth' })
await app.register(notesRoutes, { prefix: '/notes' })
await app.register(syncRoutes, { prefix: '/sync' })
await app.register(collectionsRoutes, { prefix: '/collections' })
await app.register(tagsRoutes, { prefix: '/tags' })
await app.register(exportRoutes, { prefix: '/' })
await app.register(noteTypeRoutes, { prefix: '/note-types' })
await app.register(topicsRoutes, { prefix: '/topics' })
await app.register(ingestRoutes, { prefix: '/ingest' })

// Start
try {
  await app.listen({ port: config.port, host: config.host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
