import type { FastifyPluginAsync } from 'fastify'

// GET    /note-types/custom       → list user's custom note types
// POST   /note-types/custom       → create custom note type
// PATCH  /note-types/custom/:id   → update
// DELETE /note-types/custom/:id   → delete

export const noteTypeRoutes: FastifyPluginAsync = async (_app) => {
  // TODO: implement custom note type CRUD
}
