import type { FastifyPluginAsync } from 'fastify'

// TODO: implement Google OAuth flow
// POST /auth/google       → redirect to Google consent
// GET  /auth/google/callback → exchange code, upsert user, issue JWT
// POST /auth/refresh      → refresh access token
// GET  /auth/me           → return current user

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', { onRequest: [(app as unknown as { authenticate: (req: unknown, rep: unknown) => void }).authenticate] }, async (request) => {
    return (request as unknown as { user: unknown }).user
  })
}
