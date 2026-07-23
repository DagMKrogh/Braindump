import type { FastifyPluginAsync } from 'fastify'

// GET    /notes           → list notes (filter: type, tags, collectionId, topicId, q, dateFrom, dateTo)
// POST   /notes           → create note
// GET    /notes/:id       → get note
// PATCH  /notes/:id       → update note
// DELETE /notes/:id       → soft delete
// POST   /notes/:id/share → create share link
// GET    /notes/:id/share → get share settings
// PATCH  /notes/:id/share → update share
// DELETE /notes/:id/share → revoke share

export const notesRoutes: FastifyPluginAsync = async (_app) => {
  // TODO: implement note CRUD routes
}
