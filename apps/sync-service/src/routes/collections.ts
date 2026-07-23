import type { FastifyPluginAsync } from 'fastify'

// GET    /collections        → list (tree)
// POST   /collections        → create
// PATCH  /collections/:id    → rename / move
// DELETE /collections/:id    → delete
// (topics follow same pattern under /topics)

export const collectionsRoutes: FastifyPluginAsync = async (_app) => {
  // TODO: implement collections + topics routes
}
