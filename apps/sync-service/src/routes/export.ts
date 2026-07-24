import type { FastifyPluginAsync } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { db } from '../plugins/db.js'
import { notes, shareLinks } from '../db/schema.js'

export const exportRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /s/:slug
   * Public shared note viewer — no auth required.
   * Returns note content if the share link is active and not expired.
   */
  app.get('/s/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const link = await db.query.shareLinks.findFirst({
      where: and(eq(shareLinks.slug, slug), eq(shareLinks.isActive, true)),
    })

    if (!link) return reply.status(404).send({ error: 'Share link not found' })
    if (link.expiresAt && link.expiresAt < new Date()) {
      return reply.status(410).send({ error: 'Share link has expired' })
    }

    const note = await db.query.notes.findFirst({
      where: eq(notes.id, link.noteId),
    })

    if (!note || note.deletedAt) return reply.status(404).send({ error: 'Note not found' })

    // Return only safe public fields — no userId or internal metadata
    return {
      note: {
        title: note.title,
        type: note.type,
        tags: note.tags,
        content: note.content,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      },
      link: {
        slug: link.slug,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
      },
    }
  })
}
