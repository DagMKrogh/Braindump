import type { FastifyPluginAsync } from 'fastify'
import type { Note } from '@braindump/shared'
import { eq, and, gt, isNull } from 'drizzle-orm'
import { db } from '../plugins/db.js'
import { notes, collections, topics, customNoteTypes } from '../db/schema.js'
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

    const [changedNotes, allCollections, allTopics, tagRows, customTypes] = await Promise.all([
      db.select().from(notes).where(and(eq(notes.userId, uid), gt(notes.updatedAt, sinceDate))),
      db.select().from(collections).where(eq(collections.userId, uid)),
      db.select().from(topics).where(eq(topics.userId, uid)),
      db.select({ tags: notes.tags }).from(notes)
        .where(and(eq(notes.userId, uid), isNull(notes.deletedAt))),
      db.select().from(customNoteTypes)
        .where(and(eq(customNoteTypes.userId, uid), isNull(customNoteTypes.deletedAt))),
    ])

    // Tags are stored inline in notes (no separate table) — aggregate unique names
    const tagCounts = new Map<string, number>()
    for (const row of tagRows) {
      if (Array.isArray(row.tags)) {
        for (const t of row.tags as string[]) {
          tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
        }
      }
    }
    const tagList = Array.from(tagCounts.entries()).map(([name, noteCount]) => ({
      id: name,
      userId: uid,
      name,
      noteCount,
    }))

    const customNoteTypeList = customTypes.map((r) => ({
      id: r.id,
      userId: r.userId,
      ...(r.definition as object),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))

    return {
      notes: changedNotes,
      collections: allCollections,
      topics: allTopics,
      tags: tagList,
      customNoteTypes: customNoteTypeList,
      cursor: new Date().toISOString(),
    }
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

      // Broadcast full note to other connected clients
      broadcast(uid, { type: 'note:updated', payload: n as unknown as Note })
    }

    return { synced: results.length, ids: results }
  })

  // WS /sync/ws — accepts JWT via ?token= query param (WS can't send headers)
  app.get('/ws', { websocket: true }, (socket, request) => {
    const { token } = request.query as { token?: string }
    let uid: string
    try {
      if (token) {
        const payload = app.jwt.verify<{ sub: string }>(token)
        uid = payload.sub
      } else {
        // Fallback: standard Bearer header (e.g. testing with curl)
        const payload = app.jwt.verify<{ sub: string }>(
          (request.headers.authorization ?? '').replace('Bearer ', '')
        )
        uid = payload.sub
      }
    } catch {
      socket.close(1008, 'Unauthorized')
      return
    }
    registerConnection(uid, socket)
    socket.send(JSON.stringify({ type: 'connected', payload: { userId: uid } }))
  })
}
