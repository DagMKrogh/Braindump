import type { FastifyPluginAsync } from 'fastify'
import { eq, and } from 'drizzle-orm'
import puppeteer from 'puppeteer'
import { db } from '../plugins/db.js'
import { notes, shareLinks } from '../db/schema.js'

function userId(request: { user: unknown }): string {
  return (request.user as { sub: string }).sub
}

// ── Tiptap JSON → Markdown ──────────────────────────────────────────────────

interface TipNode {
  type: string
  text?: string
  content?: TipNode[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  attrs?: Record<string, unknown>
}

function tiptapToMarkdown(doc: TipNode): string {
  return (doc.content ?? []).map(blockToMd).join('\n\n')
}

function inlineToMd(node: TipNode): string {
  if (node.type === 'text') {
    let t = node.text ?? ''
    for (const m of (node.marks ?? [])) {
      if (m.type === 'bold') t = `**${t}**`
      else if (m.type === 'italic') t = `_${t}_`
      else if (m.type === 'strike') t = `~~${t}~~`
      else if (m.type === 'code') t = `\`${t}\``
      else if (m.type === 'link') t = `[${t}](${m.attrs?.href ?? ''})`
    }
    return t
  }
  if (node.type === 'hardBreak') return '  \n'
  return (node.content ?? []).map(inlineToMd).join('')
}

function blockToMd(node: TipNode): string {
  switch (node.type) {
    case 'paragraph':
      return (node.content ?? []).map(inlineToMd).join('')

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      return `${'#'.repeat(level)} ${(node.content ?? []).map(inlineToMd).join('')}`
    }

    case 'bulletList':
      return (node.content ?? []).map(li =>
        (li.content ?? []).map(p => `- ${(p.content ?? []).map(inlineToMd).join('')}`).join('\n')
      ).join('\n')

    case 'orderedList':
      return (node.content ?? []).map((li, i) =>
        (li.content ?? []).map(p => `${i + 1}. ${(p.content ?? []).map(inlineToMd).join('')}`).join('\n')
      ).join('\n')

    case 'taskList':
      return (node.content ?? []).map(li => {
        const checked = li.attrs?.checked ? 'x' : ' '
        const text = (li.content ?? []).map(p => (p.content ?? []).map(inlineToMd).join('')).join('')
        return `- [${checked}] ${text}`
      }).join('\n')

    case 'blockquote':
      return (node.content ?? []).map(blockToMd).map(l => `> ${l}`).join('\n')

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? ''
      const code = (node.content ?? []).map(n => n.text ?? '').join('')
      return `\`\`\`${lang}\n${code}\n\`\`\``
    }

    case 'horizontalRule':
      return '---'

    case 'table':
      return (node.content ?? []).map((row, ri) => {
        const cells = (row.content ?? []).map(cell =>
          (cell.content ?? []).map(blockToMd).join(' ')
        )
        const line = `| ${cells.join(' | ')} |`
        const sep = ri === 0 ? `| ${cells.map(() => '---').join(' | ')} |` : null
        return sep ? `${line}\n${sep}` : line
      }).join('\n')

    default:
      return (node.content ?? []).map(blockToMd).join('\n')
  }
}

// ── HTML template for PDF rendering ────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inlineMdToHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inCode = false
  let codeLang = ''
  let codeLines: string[] = []

  for (const raw of lines) {
    if (raw.startsWith('```')) {
      if (!inCode) { inCode = true; codeLang = raw.slice(3).trim(); codeLines = [] }
      else {
        out.push(`<pre><code class="language-${escHtml(codeLang)}">${escHtml(codeLines.join('\n'))}</code></pre>`)
        inCode = false
      }
      continue
    }
    if (inCode) { codeLines.push(raw); continue }

    const hm = raw.match(/^(#{1,6}) (.+)/)
    if (hm) { out.push(`<h${hm[1]!.length}>${inlineMdToHtml(hm[2]!)}</h${hm[1]!.length}>`); continue }
    if (raw.startsWith('> ')) { out.push(`<blockquote><p>${inlineMdToHtml(raw.slice(2))}</p></blockquote>`); continue }
    if (raw.startsWith('- [x] ')) { out.push(`<p><input type="checkbox" checked disabled> ${inlineMdToHtml(raw.slice(6))}</p>`); continue }
    if (raw.startsWith('- [ ] ')) { out.push(`<p><input type="checkbox" disabled> ${inlineMdToHtml(raw.slice(6))}</p>`); continue }
    if (raw.startsWith('- ')) { out.push(`<ul><li>${inlineMdToHtml(raw.slice(2))}</li></ul>`); continue }
    if (/^\d+\. /.test(raw)) { out.push(`<ol><li>${inlineMdToHtml(raw.replace(/^\d+\. /, ''))}</li></ol>`); continue }
    if (raw === '---') { out.push('<hr>'); continue }
    if (!raw.trim()) { out.push(''); continue }
    out.push(`<p>${inlineMdToHtml(raw)}</p>`)
  }
  return out.join('\n')
}

function noteToHtml(title: string, type: string, tags: string[], createdAt: Date, mdContent: string): string {
  const dateStr = createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const tagHtml = tags.map(t => `<span class="tag">#${escHtml(t)}</span>`).join('')

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#1a1a1a;padding:48px 64px;max-width:820px;margin:0 auto}
  .header{border-bottom:2px solid #e5e7eb;padding-bottom:16px;margin-bottom:28px}
  .header h1{font-size:26px;font-weight:700;margin-bottom:6px}
  .meta{font-size:12px;color:#6b7280;display:flex;gap:16px;flex-wrap:wrap}
  .tag{background:#f3f4f6;border-radius:12px;padding:2px 8px}
  h1{font-size:22px;margin:24px 0 8px}h2{font-size:18px;margin:20px 0 6px}h3{font-size:15px;margin:16px 0 4px}
  p{margin:8px 0}
  ul,ol{margin:8px 0 8px 24px}li{margin:2px 0}
  blockquote{border-left:3px solid #d1d5db;padding-left:12px;color:#6b7280;margin:12px 0}
  pre{background:#1e1e2e;color:#cdd6f4;border-radius:6px;padding:16px;font-family:Menlo,Monaco,monospace;font-size:12.5px;margin:12px 0;white-space:pre-wrap}
  code{background:#f3f4f6;border-radius:3px;padding:1px 5px;font-family:monospace;font-size:12.5px}
  pre code{background:transparent;padding:0}
  table{border-collapse:collapse;width:100%;margin:12px 0}
  th,td{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}
  th{background:#f9fafb;font-weight:600}
  hr{border:none;border-top:1px solid #e5e7eb;margin:20px 0}
  a{color:#6366f1}strong{font-weight:600}em{font-style:italic}del{text-decoration:line-through}
</style>
</head><body>
<div class="header">
  <h1>${escHtml(title || 'Untitled')}</h1>
  <div class="meta"><span>${escHtml(type)}</span><span>${dateStr}</span>${tagHtml}</div>
</div>
${markdownToHtml(mdContent)}
</body></html>`
}

// ── Routes ──────────────────────────────────────────────────────────────────

export const exportRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /s/:slug — public shared note viewer (no auth required).
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

    const note = await db.query.notes.findFirst({ where: eq(notes.id, link.noteId) })
    if (!note || note.deletedAt) return reply.status(404).send({ error: 'Note not found' })

    return {
      note: {
        title: note.title, type: note.type, tags: note.tags,
        content: note.content, createdAt: note.createdAt, updatedAt: note.updatedAt,
      },
      link: { slug: link.slug, expiresAt: link.expiresAt, createdAt: link.createdAt },
    }
  })

  /**
   * POST /notes/:id/export/markdown — download note as a .md file.
   */
  app.post('/notes/:id/export/markdown', { onRequest: [app.authenticate] }, async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }

    const note = await db.query.notes.findFirst({
      where: and(eq(notes.id, id), eq(notes.userId, uid)),
    })
    if (!note || note.deletedAt) return reply.status(404).send({ error: 'Not found' })

    const md = tiptapToMarkdown(note.content as TipNode)
    const filename = `${(note.title || 'note').replace(/[^a-z0-9]/gi, '-')}.md`

    return reply
      .header('Content-Type', 'text/markdown; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(md)
  })

  /**
   * POST /notes/:id/export/pdf — render note as PDF using Puppeteer.
   */
  app.post('/notes/:id/export/pdf', { onRequest: [app.authenticate] }, async (request, reply) => {
    const uid = userId(request)
    const { id } = request.params as { id: string }

    const note = await db.query.notes.findFirst({
      where: and(eq(notes.id, id), eq(notes.userId, uid)),
    })
    if (!note || note.deletedAt) return reply.status(404).send({ error: 'Not found' })
    if (note.type === 'secret') return reply.status(403).send({ error: 'Secret notes cannot be exported' })

    const md = tiptapToMarkdown(note.content as TipNode)
    const html = noteToHtml(note.title, note.type, note.tags as string[], note.createdAt, md)

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
        printBackground: true,
      })
      const filename = `${(note.title || 'note').replace(/[^a-z0-9]/gi, '-')}.pdf`
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(Buffer.from(pdf))
    } finally {
      await browser.close()
    }
  })
}
