import type { FastifyPluginAsync } from 'fastify'

// GET  /sync/delta?since=<ISO>&deviceId=<id>  → return all changes since cursor
// POST /sync/push                              → push batch of local changes
// WS   /ws                                    → real-time event stream

export const syncRoutes: FastifyPluginAsync = async (_app) => {
  // TODO: implement delta sync and WebSocket hub
}
