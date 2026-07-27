import type { FastifyPluginAsync } from 'fastify'
import type { Note } from '@braindump/shared'
import { eq } from 'drizzle-orm'
import { db } from '../plugins/db.js'
import { notes, users } from '../db/schema.js'
import { config } from '../config.js'
import { markdownToTiptap } from '../lib/markdownToTiptap.js'
import { broadcast } from '../plugins/wsHub.js'

/**
 * POST /ingest
 *
 * Machine-to-machine endpoint for pushing notes without OAuth.
 * Requires X-API-Key header matching INGEST_API_KEY env var.
 *
 * Body:
 *   - title: string (required)
 *   - body: string  — plain text or markdown (one of body/content required)
 *   - content: object — pre-built Tiptap JSON (one of body/content required)
 *   - format: 'markdown' | 'plain' — how to parse body (default: plain)
 *   - tags: string[] (optional, merged with ["claude", "ai-generated"])
 *   - type: string (optional, default "scratch")
 *   - metadata: object (optional, merged with base metadata)
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
      body?: string
      content?: object
      format?: string
      tags?: string[]
      type?: string
      metadata?: Record<string, unknown>
      userEmail?: string
    }

    if (!body.title) {
      return reply.status(400).send({ error: 'title is required' })
    }

    // Determine content: raw Tiptap JSON > markdown body > plain text body
    let content: unknown
    if (body.content && typeof body.content === 'object') {
      content = body.content
    } else if (typeof body.body === 'string') {
      if (body.format === 'markdown') {
        content = markdownToTiptap(body.body)
      } else {
        const paragraphs = body.body.split('\n\n').filter(Boolean)
        content = {
          type: 'doc',
          content: paragraphs.map((para) => ({
            type: 'paragraph',
            content: [{ type: 'text', text: para.replace(/\n/g, ' ') }],
          })),
        }
      }
    } else {
      return reply.status(400).send({ error: '"body" (string) or "content" (object) is required' })
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

    const baseTags = ['claude', 'ai-generated']
    const extraTags = (body.tags ?? []).filter((t) => !baseTags.includes(t))
    const tags = [...baseTags, ...extraTags]

    const metadata: Record<string, unknown> = { ingestedBy: 'claude-skill' }
    if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
      Object.assign(metadata, body.metadata)
    }

    const now = new Date()
    const [note] = await db.insert(notes).values({
      id: crypto.randomUUID(),
      userId,
      type: body.type ?? 'scratch',
      title: body.title,
      content,
      metadata,
      tags,
      linkedNoteIds: [],
      isPinned: false,
      isEncrypted: false,
      createdAt: now,
      updatedAt: now,
    }).returning()

    // Notify connected clients so they pick up the new note in real time
    if (note) broadcast(userId, { type: 'note:created', payload: note as unknown as Note })

    return reply.status(201).send(note)
  })
}
