/**
 * Converts a Tiptap ProseMirror JSON doc to Markdown.
 * Handles: headings, paragraphs, lists (bullet/ordered/task),
 * blockquote, codeBlock, table, hardBreak, horizontalRule,
 * and inline marks (bold, italic, code, strike, link).
 */

interface TipNode {
  type: string
  text?: string
  content?: TipNode[]
  marks?: TipMark[]
  attrs?: Record<string, unknown>
}

interface TipMark {
  type: string
  attrs?: Record<string, unknown>
}

function applyMarks(text: string, marks: TipMark[] = []): string {
  let out = text
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':      out = `**${out}**`; break
      case 'italic':    out = `*${out}*`;   break
      case 'strike':    out = `~~${out}~~`; break
      case 'code':      out = `\`${out}\``; break
      case 'link': {
        const href = (mark.attrs?.href as string) ?? ''
        out = `[${out}](${href})`
        break
      }
    }
  }
  return out
}

function inlineContent(nodes: TipNode[] = []): string {
  return nodes.map((n) => {
    if (n.type === 'text')      return applyMarks(n.text ?? '', n.marks)
    if (n.type === 'hardBreak') return '\\\n'
    return inlineContent(n.content)
  }).join('')
}

function serializeTable(rows: TipNode[]): string {
  if (!rows.length) return ''
  const cellText = (cell: TipNode) =>
    inlineContent(cell.content ?? []).replace(/\|/g, '\\|').replace(/\n/g, ' ')

  const allRows = rows.map((row) => (row.content ?? []).map(cellText))
  const header = allRows[0] ?? []
  const body   = allRows.slice(1)

  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n')
}

function serializeListItem(node: TipNode, depth: number, prefix: string): string {
  const indent = '  '.repeat(depth)
  const children = node.content ?? []

  // First child is the paragraph text; remaining children are nested lists
  const [first, ...rest] = children
  const text = first ? inlineContent(first.content ?? []) : ''
  const nested = rest.map((c) => serializeNode(c, depth + 1)).filter(Boolean)

  return [`${indent}${prefix} ${text}`, ...nested].join('\n')
}

function serializeNode(node: TipNode, depth = 0): string {
  const children = node.content ?? []

  switch (node.type) {
    case 'doc':
      return children.map((c) => serializeNode(c)).filter(Boolean).join('\n\n')

    case 'paragraph':
      return inlineContent(children)

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      return `${'#'.repeat(level)} ${inlineContent(children)}`
    }

    case 'blockquote':
      return children
        .map((c) => serializeNode(c))
        .join('\n')
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? ''
      const code = children.map((c) => c.text ?? '').join('')
      return `\`\`\`${lang}\n${code}\n\`\`\``
    }

    case 'bulletList':
      return children.map((c) => serializeListItem(c, depth, '-')).join('\n')

    case 'orderedList':
      return children.map((c, i) => serializeListItem(c, depth, `${i + 1}.`)).join('\n')

    case 'taskList':
      return children
        .map((c) => {
          const checked = c.attrs?.checked ? 'x' : ' '
          return serializeListItem(c, depth, `- [${checked}]`).replace(/^(\s*)- \[.\] - \[/, '$1- [')
        })
        .join('\n')

    case 'taskItem': {
      const checked = node.attrs?.checked ? 'x' : ' '
      const indent  = '  '.repeat(depth)
      const text    = inlineContent((children[0]?.content) ?? [])
      return `${indent}- [${checked}] ${text}`
    }

    case 'horizontalRule':
      return '---'

    case 'table':
      return serializeTable(children)

    default:
      return inlineContent(children)
  }
}

export function tiptapToMarkdown(doc: object): string {
  return serializeNode(doc as TipNode)
}

export function downloadMarkdown(title: string, doc: object): void {
  const md   = `# ${title}\n\n${tiptapToMarkdown(doc)}`
  const blob = new Blob([md], { type: 'text/markdown' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'note'}.md`
  a.click()
  URL.revokeObjectURL(url)
}
