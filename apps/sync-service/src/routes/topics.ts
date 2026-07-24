import type { FastifyPluginAsync } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { db } from '../plugins/db.js'
import { topics } from '../db/schema.js'

function userId(request: { user: unknown }): string {
  return (request.user as { sub: string }).sub
}

export const topicsRoutes: FastifyPluginAsync = async (app) => {
  // GET /topics
  app.get('/', { onRequest: [app.authenticate] }, async (request) => {
    const uid = userId(request)
    return db.select().from(topics).where(eq(topics.userId, uid))
  })

  // POST /topics
  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const uid = userId(request)
    const { name, color } = request.body as { name: string; color?: string }
    const [row] = await db
      .insert(topics)
      .values({ userId: uid, name, color: color ?? null })
      .returning()
    return reply.status(201).send(row)
  })

  // PATCH /topics/:id
  app.patch('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }
    const body = request.body as { name?: string; color?: string }
    const [row] = await db
      .update(topics)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(topics.id, id), eq(topics.userId, uid)))
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return row
  })

  // DELETE /topics/:id
  app.delete('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }
    await db.delete(topics).where(and(eq(topics.id, id), eq(topics.userId, uid)))
    return reply.status(204).send()
  })
}
