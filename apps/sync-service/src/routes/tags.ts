import type { FastifyPluginAsync } from 'fastify'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../plugins/db.js'
import { notes } from '../db/schema.js'

function userId(request: { user: unknown }): string {
  return (request.user as { sub: string }).sub
}

export const tagsRoutes: FastifyPluginAsync = async (app) => {
  // GET /tags — list all unique tags across user's non-deleted notes with note counts
  app.get('/', { onRequest: [app.authenticate] }, async (request) => {
    const uid = userId(request)
    const rows = await db.select({ tags: notes.tags }).from(notes)
      .where(and(eq(notes.userId, uid), isNull(notes.deletedAt)))

    const counts = new Map<string, number>()
    for (const row of rows) {
      if (Array.isArray(row.tags)) {
        for (const t of row.tags as string[]) {
          counts.set(t, (counts.get(t) ?? 0) + 1)
        }
      }
    }

    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, noteCount]) => ({ id: name, userId: uid, name, noteCount }))
  })

  // DELETE /tags/:id — remove tag from all notes (id is the tag name)
  app.delete('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const uid = userId(request)
    const tagName = (request.params as { id: string }).id

    const rows = await db
      .select({ id: notes.id, tags: notes.tags })
      .from(notes)
      .where(and(eq(notes.userId, uid), isNull(notes.deletedAt)))

    for (const row of rows) {
      if (Array.isArray(row.tags) && (row.tags as string[]).includes(tagName)) {
        await db.update(notes)
          .set({ tags: (row.tags as string[]).filter((t) => t !== tagName), updatedAt: new Date() })
          .where(eq(notes.id, row.id))
      }
    }

    return reply.status(204).send()
  })
}
