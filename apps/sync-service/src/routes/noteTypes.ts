import type { FastifyPluginAsync } from 'fastify'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../plugins/db.js'
import { customNoteTypes } from '../db/schema.js'

function userId(request: { user: unknown }): string {
  return (request.user as { sub: string }).sub
}

export const noteTypeRoutes: FastifyPluginAsync = async (app) => {
  // GET /note-types/custom → list user's custom note types
  app.get('/', { onRequest: [app.authenticate] }, async (request) => {
    const uid = userId(request)
    const rows = await db
      .select()
      .from(customNoteTypes)
      .where(and(eq(customNoteTypes.userId, uid), isNull(customNoteTypes.deletedAt)))
    return rows.map((r) => ({ id: r.id, userId: r.userId, ...(r.definition as object), createdAt: r.createdAt, updatedAt: r.updatedAt }))
  })

  // POST /note-types/custom → create a custom note type
  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const uid = userId(request)
    const body = request.body as Record<string, unknown>
    const now = new Date()
    const [row] = await db
      .insert(customNoteTypes)
      .values({ userId: uid, definition: body, createdAt: now, updatedAt: now })
      .returning()
    return reply.status(201).send({
      id: row!.id,
      userId: uid,
      ...(row!.definition as object),
      createdAt: row!.createdAt,
      updatedAt: row!.updatedAt,
    })
  })

  // PATCH /note-types/custom/:id → update definition fields
  app.patch('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }
    const body = request.body as Record<string, unknown>

    const [existing] = await db
      .select()
      .from(customNoteTypes)
      .where(and(eq(customNoteTypes.id, id), eq(customNoteTypes.userId, uid), isNull(customNoteTypes.deletedAt)))
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const merged = { ...(existing.definition as object), ...body }
    const [row] = await db
      .update(customNoteTypes)
      .set({ definition: merged, updatedAt: new Date() })
      .where(eq(customNoteTypes.id, id))
      .returning()
    return { id: row!.id, userId: uid, ...(row!.definition as object), createdAt: row!.createdAt, updatedAt: row!.updatedAt }
  })

  // DELETE /note-types/custom/:id → soft delete
  app.delete('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }
    await db
      .update(customNoteTypes)
      .set({ deletedAt: new Date() })
      .where(and(eq(customNoteTypes.id, id), eq(customNoteTypes.userId, uid)))
    return reply.status(204).send()
  })
}
