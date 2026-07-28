/**
 * Braindump Local Bridge
 *
 * A lightweight HTTP + WebSocket server that acts as an event bus between
 * external tools (Claude skills, scripts, automations) and the Braindump
 * web app running in the browser.
 *
 * The browser can't be reached directly from the outside, so this bridge
 * runs locally and the web app connects to it via WebSocket. External tools
 * POST events to the bridge's HTTP API; the bridge broadcasts them to all
 * connected browser tabs.
 *
 * Event protocol (both directions):
 *   { type: string, payload: unknown }
 *
 * Current event types:
 *   note:ingest  — create a new note in the local store
 *
 * Future event types (just add a new POST route or extend /events):
 *   reminder:trigger, calendar:event, file:attach, tag:sync, ...
 *
 * Configuration (env vars):
 *   LOCAL_BRIDGE_PORT  — port to listen on (default: 3002)
 *   LOCAL_BRIDGE_KEY   — API key for HTTP endpoints (default: '' = no auth)
 */

import http from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'

const PORT = Number(process.env['LOCAL_BRIDGE_PORT'] ?? 3002)
const API_KEY = process.env['LOCAL_BRIDGE_KEY'] ?? ''

// ── Connected browser clients ──────────────────────────────────────────────

const clients = new Set<WebSocket>()

function broadcast(event: { type: string; payload: unknown }) {
  const msg = JSON.stringify(event)
  for (const client of clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(msg)
    }
  }
}

// ── Auth helper ────────────────────────────────────────────────────────────

function checkAuth(req: http.IncomingMessage): boolean {
  if (!API_KEY) return true // no key configured = open (dev mode)
  return req.headers['x-api-key'] === API_KEY
}

// ── JSON body parser ───────────────────────────────────────────────────────

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => { raw += chunk.toString() })
    req.on('end', () => {
      try { resolve(JSON.parse(raw || 'null')) }
      catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*',
  })
  res.end(json)
}

// ── Markdown → Tiptap JSON converter ──────────────────────────────────────

interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

function markdownToTiptap(md: string): { type: 'doc'; content: TiptapNode[] } {
  const lines = md.split('\n')
  const nodes: TiptapNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    // Blank line — skip
    if (line.trim() === '') { i++; continue }

    // Fenced code block
    const fenceMatch = line.match(/^```(\w*)/)
    if (fenceMatch) {
      const lang = fenceMatch[1] || null
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!)
        i++
      }
      i++ // skip closing ```
      nodes.push({
        type: 'codeBlock',
        attrs: lang ? { language: lang } : {},
        content: codeLines.length ? [{ type: 'text', text: codeLines.join('\n') }] : undefined,
      })
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      nodes.push({
        type: 'heading',
        attrs: { level: headingMatch[1]!.length },
        content: parseInline(headingMatch[2]!),
      })
      i++; continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      nodes.push({ type: 'horizontalRule' })
      i++; continue
    }

    // Unordered list
    if (/^\s*[-*+]\s/.test(line)) {
      const items: TiptapNode[] = []
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i]!)) {
        const text = lines[i]!.replace(/^\s*[-*+]\s+/, '')
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(text) }] })
        i++
      }
      nodes.push({ type: 'bulletList', content: items })
      continue
    }

    // Ordered list
    if (/^\s*\d+[.)]\s/.test(line)) {
      const items: TiptapNode[] = []
      while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i]!)) {
        const text = lines[i]!.replace(/^\s*\d+[.)]\s+/, '')
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(text) }] })
        i++
      }
      nodes.push({ type: 'orderedList', content: items })
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i]!.startsWith('> ')) {
        quoteLines.push(lines[i]!.slice(2))
        i++
      }
      nodes.push({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: parseInline(quoteLines.join(' ')) }],
      })
      continue
    }

    // Regular paragraph — collect contiguous non-blank, non-special lines
    const paraLines: string[] = []
    while (i < lines.length && lines[i]!.trim() !== '' && !/^(#{1,6}\s|```|>\s|[-*+]\s|\d+[.)]\s|---|\*{3}|_{3})/.test(lines[i]!)) {
      paraLines.push(lines[i]!)
      i++
    }
    if (paraLines.length) {
      nodes.push({ type: 'paragraph', content: parseInline(paraLines.join(' ')) })
    }
  }

  return { type: 'doc', content: nodes.length ? nodes : [{ type: 'paragraph' }] }
}

function parseInline(text: string): TiptapNode[] {
  const nodes: TiptapNode[] = []
  // Regex: bold (**), italic (*), inline code (`), or plain text
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push({ type: 'text', text: text.slice(last, m.index) })
    }
    if (m[2]) {
      // Bold
      nodes.push({ type: 'text', text: m[2], marks: [{ type: 'bold' }] })
    } else if (m[3]) {
      // Italic
      nodes.push({ type: 'text', text: m[3], marks: [{ type: 'italic' }] })
    } else if (m[4]) {
      // Inline code
      nodes.push({ type: 'text', text: m[4], marks: [{ type: 'code' }] })
    }
    last = m.index + m[0].length
  }

  if (last < text.length) {
    nodes.push({ type: 'text', text: text.slice(last) })
  }

  return nodes.length ? nodes : [{ type: 'text', text }]
}

// ── HTTP server ────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    })
    res.end()
    return
  }

  // Health check — no auth required
  if (req.method === 'GET' && url.pathname === '/health') {
    send(res, 200, { ok: true, clients: clients.size, ts: new Date().toISOString() })
    return
  }

  // All other endpoints require auth
  if (!checkAuth(req)) {
    send(res, 401, { error: 'Invalid or missing X-API-Key' })
    return
  }

  // POST /ingest — push a note into the browser's local store
  if (req.method === 'POST' && url.pathname === '/ingest') {
    let body: unknown
    try { body = await readJson(req) } catch {
      send(res, 400, { error: 'Invalid JSON body' })
      return
    }

    const { title, body: text, tags, type, content: rawContent, format, metadata: extraMeta } = body as Record<string, unknown>
    if (typeof title !== 'string') {
      send(res, 400, { error: '"title" is a required string' })
      return
    }

    // Determine content: raw Tiptap JSON > markdown body > plain text body
    let content: unknown
    if (rawContent && typeof rawContent === 'object') {
      // Pre-built Tiptap JSON passed directly
      content = rawContent
    } else if (typeof text === 'string') {
      if (format === 'markdown') {
        content = markdownToTiptap(text)
      } else {
        // Plain text fallback
        const paragraphs = text.split('\n\n').filter(Boolean)
        content = {
          type: 'doc',
          content: paragraphs.map((para) => ({
            type: 'paragraph',
            content: [{ type: 'text', text: para.replace(/\n/g, ' ') }],
          })),
        }
      }
    } else {
      send(res, 400, { error: '"body" (string) or "content" (object) is required' })
      return
    }

    const baseTags = ['claude', 'ai-generated']
    const extraTags = Array.isArray(tags) ? (tags as string[]).filter((t) => !baseTags.includes(t)) : []

    const metadata: Record<string, unknown> = { ingestedBy: 'local-bridge' }
    if (extraMeta && typeof extraMeta === 'object' && !Array.isArray(extraMeta)) {
      Object.assign(metadata, extraMeta)
    }

    const payload = {
      id: crypto.randomUUID(),
      userId: 'local',
      type: typeof type === 'string' ? type : 'scratch',
      title,
      content,
      metadata,
      tags: [...baseTags, ...extraTags],
      collectionId: null,
      topicId: null,
      linkedNoteIds: [],
      isPinned: false,
      isEncrypted: false,
      dateRef: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      syncStatus: 'pending' as const,
      localOnly: true,
    }

    broadcast({ type: 'note:ingest', payload })
    send(res, 201, { ok: true, id: payload.id, title: payload.title, clients: clients.size })
    return
  }

  // POST /events — generic event broadcast (for future integrations)
  if (req.method === 'POST' && url.pathname === '/events') {
    let body: unknown
    try { body = await readJson(req) } catch {
      send(res, 400, { error: 'Invalid JSON body' })
      return
    }

    const event = body as { type?: string; payload?: unknown }
    if (typeof event.type !== 'string') {
      send(res, 400, { error: '"type" is required' })
      return
    }

    broadcast({ type: event.type, payload: event.payload ?? null })
    send(res, 200, { ok: true, type: event.type, clients: clients.size })
    return
  }

  send(res, 404, { error: 'Not found' })
})

// ── WebSocket server ───────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  clients.add(ws)
  console.log(`[bridge] client connected (${clients.size} total)`)

  // Send a welcome event so the client knows the bridge is live
  ws.send(JSON.stringify({ type: 'bridge:connected', payload: { port: PORT } }))

  // Relay client messages to all other clients (peer sync)
  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString()) as { type?: string; payload?: unknown }
      if (typeof msg.type !== 'string') return
      const relay = JSON.stringify(msg)
      for (const peer of clients) {
        if (peer !== ws && peer.readyState === 1) peer.send(relay)
      }
    } catch { /* ignore invalid messages */ }
  })

  ws.on('close', () => {
    clients.delete(ws)
    console.log(`[bridge] client disconnected (${clients.size} total)`)
  })

  ws.on('error', (err) => {
    console.error('[bridge] ws error:', err.message)
    clients.delete(ws)
  })
})

// ── Start ──────────────────────────────────────────────────────────────────

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[bridge] listening on http://127.0.0.1:${PORT}`)
  console.log(`[bridge] WebSocket at ws://127.0.0.1:${PORT}/ws`)
  if (!API_KEY) {
    console.warn('[bridge] WARNING: LOCAL_BRIDGE_KEY not set — running without auth (dev mode)')
  }
})
