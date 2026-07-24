import type { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../plugins/db.js'
import { notes, users } from '../db/schema.js'
import { config } from '../config.js'

/**
 * POST /ingest
 *
 * Machine-to-machine endpoint for pushing notes without OAuth.
 * Requires X-API-Key header matching INGEST_API_KEY env var.
 *
 * Body:
 *   - title: string (required)
 *   - body: string  — plain text or markdown (required)
 *   - tags: string[] (optional, merged with ["claude", "ai-generated"])
 *   - type: string (optional, default "note")
 *   - userEmail: string (optional, defaults to first user in DB if omitted)
 *
 * Returns the created note.
 */
export const ingestRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', async (request, reply) => {
    // API key check
    const key = request.headers['x-api-key']
    if (!config.ingestApiKey || key !== config.ingestApiKey) {
      return reply.status(401).send({ error: 'Invalid or missing X-API-Key' })
    }

    const body = request.body as {
      title: string
      body: string
      tags?: string[]
      type?: string
      userEmail?: string
    }

    if (!body.title || !body.body) {
      return reply.status(400).send({ error: 'title and body are required' })
    }

    // Resolve user: by email if provided, else first user
    let userId: string
    if (body.userEmail) {
      const user = await db.query.users.findFirst({ where: eq(users.email, body.userEmail) })
      if (!user) return reply.status(404).send({ error: `No user with email ${body.userEmail}` })
      userId = user.id
    } else {
      const first = await db.query.users.findFirst()
      if (!first) return reply.status(503).send({ error: 'No users in database yet' })
      userId = first.id
    }

    // Convert plain text / markdown to minimal Tiptap doc
    const paragraphs = body.body.split('\n\n').filter(Boolean)
    const content = {
      type: 'doc',
      content: paragraphs.map((para) => ({
        type: 'paragraph',
        content: [{ type: 'text', text: para.replace(/\n/g, ' ') }],
      })),
    }

    const baseTags = ['claude', 'ai-generated']
    const extraTags = (body.tags ?? []).filter((t) => !baseTags.includes(t))
    const tags = [...baseTags, ...extraTags]

    const now = new Date()
    const [note] = await db.insert(notes).values({
      userId,
      type: body.type ?? 'note',
      title: body.title,
      content,
      metadata: { ingestedBy: 'claude-skill' },
      tags,
      linkedNoteIds: [],
      isPinned: false,
      isEncrypted: false,
      createdAt: now,
      updatedAt: now,
    }).returning()

    return reply.status(201).send(note)
  })
}
