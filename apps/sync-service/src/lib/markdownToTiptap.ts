/**
 * Lightweight markdown → Tiptap JSON converter (no external deps).
 *
 * Supports: headings, paragraphs, fenced code blocks, bullet/ordered lists,
 * blockquotes, horizontal rules, bold, italic, inline code.
 */

interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

export function markdownToTiptap(md: string): { type: 'doc'; content: TiptapNode[] } {
  const lines = md.split('\n')
  const nodes: TiptapNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

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

    // Regular paragraph
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
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push({ type: 'text', text: text.slice(last, m.index) })
    }
    if (m[2]) {
      nodes.push({ type: 'text', text: m[2], marks: [{ type: 'bold' }] })
    } else if (m[3]) {
      nodes.push({ type: 'text', text: m[3], marks: [{ type: 'italic' }] })
    } else if (m[4]) {
      nodes.push({ type: 'text', text: m[4], marks: [{ type: 'code' }] })
    }
    last = m.index + m[0].length
  }

  if (last < text.length) {
    nodes.push({ type: 'text', text: text.slice(last) })
  }

  return nodes.length ? nodes : [{ type: 'text', text }]
}
