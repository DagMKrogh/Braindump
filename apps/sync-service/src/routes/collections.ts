import type { FastifyPluginAsync } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { db } from '../plugins/db.js'
import { collections, topics } from '../db/schema.js'

function userId(request: { user: unknown }): string {
  return (request.user as { sub: string }).sub
}

export const collectionsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate)

  // ── Collections ────────────────────────────────────────────────────────

  // GET /collections — flat list (client builds tree from parentId)
  app.get('/', async (request) => {
    const uid = userId(request)
    return db.select().from(collections).where(eq(collections.userId, uid))
  })

  // POST /collections — create
  app.post('/', async (request, reply) => {
    const uid = userId(request)
    const body = request.body as { name: string; color?: string; icon?: string; parentId?: string }
    if (!body.name?.trim()) return reply.status(400).send({ error: 'name is required' })

    const [col] = await db.insert(collections).values({
      userId: uid,
      name: body.name.trim(),
      color: body.color ?? null,
      icon: body.icon ?? null,
      parentId: body.parentId ?? null,
    }).returning()

    return reply.status(201).send(col)
  })

  // PATCH /collections/:id — rename or move
  app.patch('/:id', async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }
    const body = request.body as { name?: string; color?: string; icon?: string; parentId?: string | null }

    const existing = await db.query.collections.findFirst({
      where: and(eq(collections.id, id), eq(collections.userId, uid)),
    })
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const [updated] = await db.update(collections)
      .set({
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.icon !== undefined ? { icon: body.icon } : {}),
        ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(collections.id, id), eq(collections.userId, uid)))
      .returning()

    return updated
  })

  // DELETE /collections/:id
  app.delete('/:id', async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }

    const existing = await db.query.collections.findFirst({
      where: and(eq(collections.id, id), eq(collections.userId, uid)),
    })
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    await db.delete(collections).where(and(eq(collections.id, id), eq(collections.userId, uid)))
    return reply.status(204).send()
  })

  // ── Topics ─────────────────────────────────────────────────────────────

  // GET /collections/topics
  app.get('/topics', async (request) => {
    const uid = userId(request)
    return db.select().from(topics).where(eq(topics.userId, uid))
  })

  // POST /collections/topics
  app.post('/topics', async (request, reply) => {
    const uid = userId(request)
    const body = request.body as { name: string; collectionId?: string }
    if (!body.name?.trim()) return reply.status(400).send({ error: 'name is required' })

    const [topic] = await db.insert(topics).values({
      userId: uid,
      name: body.name.trim(),
      collectionId: body.collectionId ?? null,
    }).returning()

    return reply.status(201).send(topic)
  })

  // PATCH /collections/topics/:id
  app.patch('/topics/:id', async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }
    const body = request.body as { name?: string; collectionId?: string | null }

    const existing = await db.query.topics.findFirst({
      where: and(eq(topics.id, id), eq(topics.userId, uid)),
    })
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const [updated] = await db.update(topics)
      .set({
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.collectionId !== undefined ? { collectionId: body.collectionId } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(topics.id, id), eq(topics.userId, uid)))
      .returning()

    return updated
  })

  // DELETE /collections/topics/:id
  app.delete('/topics/:id', async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }

    const existing = await db.query.topics.findFirst({
      where: and(eq(topics.id, id), eq(topics.userId, uid)),
    })
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    await db.delete(topics).where(and(eq(topics.id, id), eq(topics.userId, uid)))
    return reply.status(204).send()
  })
}
