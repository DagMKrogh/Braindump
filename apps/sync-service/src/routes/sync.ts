import type { FastifyPluginAsync } from 'fastify'
import { eq, and, gt } from 'drizzle-orm'
import { db } from '../plugins/db.js'
import { notes } from '../db/schema.js'
import { registerConnection, broadcast } from '../plugins/wsHub.js'

function userId(request: { user: unknown }): string {
  return (request.user as { sub: string }).sub
}

export const syncRoutes: FastifyPluginAsync = async (app) => {
  // GET /sync/delta?since=<ISO>
  app.get('/delta', { onRequest: [app.authenticate] }, async (request) => {
    const uid = userId(request)
    const { since } = request.query as { since?: string }
    const sinceDate = since ? new Date(since) : new Date(0)

    const changed = await db.select().from(notes)
      .where(and(eq(notes.userId, uid), gt(notes.updatedAt, sinceDate)))

    return { notes: changed, serverTime: new Date().toISOString() }
  })

  // POST /sync/push — batch upsert of client notes
  app.post('/push', { onRequest: [app.authenticate] }, async (request, reply) => {
    const uid = userId(request)
    const { notes: clientNotes } = request.body as {
      notes: Array<{
        id: string; type: string; title: string; content: object
        metadata: object; tags: string[]; collectionId?: string | null
        topicId?: string | null; linkedNoteIds?: string[]
        isPinned?: boolean; isEncrypted?: boolean; dateRef?: string | null
        createdAt: string; updatedAt: string; deletedAt?: string | null
      }>
    }

    if (!Array.isArray(clientNotes) || clientNotes.length === 0) {
      return reply.status(400).send({ error: 'notes array required' })
    }

    const results: string[] = []
    for (const n of clientNotes) {
      await db.insert(notes).values({
        id: n.id,
        userId: uid,
        type: n.type,
        title: n.title ?? '',
        content: n.content ?? {},
        metadata: n.metadata ?? {},
        tags: n.tags ?? [],
        collectionId: n.collectionId ?? null,
        topicId: n.topicId ?? null,
        linkedNoteIds: n.linkedNoteIds ?? [],
        isPinned: n.isPinned ?? false,
        isEncrypted: n.isEncrypted ?? false,
        dateRef: n.dateRef ?? null,
        createdAt: new Date(n.createdAt),
        updatedAt: new Date(n.updatedAt),
        deletedAt: n.deletedAt ? new Date(n.deletedAt) : null,
      }).onConflictDoUpdate({
        target: notes.id,
        set: {
          title: n.title ?? '',
          content: n.content ?? {},
          metadata: n.metadata ?? {},
          tags: n.tags ?? [],
          collectionId: n.collectionId ?? null,
          topicId: n.topicId ?? null,
          linkedNoteIds: n.linkedNoteIds ?? [],
          isPinned: n.isPinned ?? false,
          isEncrypted: n.isEncrypted ?? false,
          dateRef: n.dateRef ?? null,
          updatedAt: new Date(n.updatedAt),
          deletedAt: n.deletedAt ? new Date(n.deletedAt) : null,
        },
      })
      results.push(n.id)

      // Broadcast to other connected clients
      broadcast(uid, { type: 'note:updated', payload: { id: n.id } })
    }

    return { synced: results.length, ids: results }
  })

  // WS /sync/ws
  app.get('/ws', { websocket: true, onRequest: [app.authenticate] }, (socket, request) => {
    const uid = userId(request)
    registerConnection(uid, socket)
    socket.send(JSON.stringify({ type: 'connected', payload: { userId: uid } }))
  })
}
