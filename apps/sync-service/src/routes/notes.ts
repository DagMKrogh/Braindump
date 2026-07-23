import type { FastifyPluginAsync } from 'fastify'
import { eq, and, isNull, gt, like, sql } from 'drizzle-orm'
import { db } from '../plugins/db.js'
import { notes, shareLinks } from '../db/schema.js'

function userId(request: { user: unknown }): string {
  return (request.user as { sub: string }).sub
}

export const notesRoutes: FastifyPluginAsync = async (app) => {
  // All routes require auth
  app.addHook('onRequest', app.authenticate)

  // GET /notes
  app.get('/', async (request) => {
    const uid = userId(request)
    const { type, q, collectionId } = request.query as Record<string, string>

    const conditions = [eq(notes.userId, uid), isNull(notes.deletedAt)]
    if (type) conditions.push(eq(notes.type, type))
    if (collectionId) conditions.push(eq(notes.collectionId, collectionId))

    let rows = await db.select().from(notes).where(and(...conditions))
      .orderBy(sql`${notes.updatedAt} DESC`)

    if (q) {
      const ql = q.toLowerCase()
      rows = rows.filter(n => n.title.toLowerCase().includes(ql))
    }

    return rows
  })

  // POST /notes
  app.post('/', async (request, reply) => {
    const uid = userId(request)
    const body = request.body as {
      id: string; type: string; title: string; content: object
      metadata: object; tags: string[]; collectionId?: string; topicId?: string
      linkedNoteIds?: string[]; isPinned?: boolean; isEncrypted?: boolean
      dateRef?: string; createdAt: string; updatedAt: string
    }

    const [note] = await db.insert(notes).values({
      id: body.id ?? undefined,
      userId: uid,
      type: body.type,
      title: body.title ?? '',
      content: body.content ?? {},
      metadata: body.metadata ?? {},
      tags: body.tags ?? [],
      collectionId: body.collectionId ?? null,
      topicId: body.topicId ?? null,
      linkedNoteIds: body.linkedNoteIds ?? [],
      isPinned: body.isPinned ?? false,
      isEncrypted: body.isEncrypted ?? false,
      dateRef: body.dateRef ?? null,
      createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
      updatedAt: body.updatedAt ? new Date(body.updatedAt) : new Date(),
    }).returning()

    return reply.status(201).send(note)
  })

  // GET /notes/:id
  app.get('/:id', async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }
    const note = await db.query.notes.findFirst({ where: and(eq(notes.id, id), eq(notes.userId, uid)) })
    if (!note) return reply.status(404).send({ error: 'Not found' })
    return note
  })

  // PATCH /notes/:id
  app.patch('/:id', async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{
      title: string; content: object; metadata: object; tags: string[]
      collectionId: string | null; topicId: string | null; linkedNoteIds: string[]
      isPinned: boolean; dateRef: string | null; updatedAt: string
    }>

    const existing = await db.query.notes.findFirst({ where: and(eq(notes.id, id), eq(notes.userId, uid)) })
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const [updated] = await db.update(notes)
      .set({
        ...body,
        updatedAt: body.updatedAt ? new Date(body.updatedAt) : new Date(),
      })
      .where(and(eq(notes.id, id), eq(notes.userId, uid)))
      .returning()

    return updated
  })

  // DELETE /notes/:id (soft delete)
  app.delete('/:id', async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }
    const existing = await db.query.notes.findFirst({ where: and(eq(notes.id, id), eq(notes.userId, uid)) })
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    await db.update(notes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(notes.id, id), eq(notes.userId, uid)))

    return reply.status(204).send()
  })

  // POST /notes/:id/share
  app.post('/:id/share', async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }
    const { passwordHash, expiresAt } = request.body as { passwordHash?: string; expiresAt?: string }

    const note = await db.query.notes.findFirst({ where: and(eq(notes.id, id), eq(notes.userId, uid)) })
    if (!note) return reply.status(404).send({ error: 'Not found' })

    const slug = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    const [link] = await db.insert(shareLinks).values({
      noteId: id, userId: uid, slug,
      passwordHash: passwordHash ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning()

    return reply.status(201).send(link)
  })

  // GET /notes/:id/share
  app.get('/:id/share', async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }
    const links = await db.select().from(shareLinks)
      .where(and(eq(shareLinks.noteId, id), eq(shareLinks.userId, uid), eq(shareLinks.isActive, true)))
    return links
  })

  // DELETE /notes/:id/share
  app.delete('/:id/share/:shareId', async (request, reply) => {
    const uid = userId(request)
    const { shareId } = request.params as { id: string; shareId: string }
    await db.update(shareLinks)
      .set({ isActive: false })
      .where(and(eq(shareLinks.id, shareId), eq(shareLinks.userId, uid)))
    return reply.status(204).send()
  })
}
