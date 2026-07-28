/**
 * DiagramBlock — Tiptap node extension for embedding React Flow diagrams.
 *
 * Inserts a `diagramBlock` node into the editor that stores React Flow
 * nodes/edges as JSON attributes. Renders as a clickable preview card
 * in the editor; the actual React Flow canvas lives in a separate panel.
 *
 * Clicking the block dispatches `braindump:edit-diagram` so the parent
 * page can open the diagram editor panel.
 */
import { Node, mergeAttributes } from '@tiptap/core'

export const EDIT_DIAGRAM_EVENT = 'braindump:edit-diagram'

export interface DiagramData {
  diagramId: string
  label: string
  nodes: object[]
  edges: object[]
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)
}

export const DiagramBlock = Node.create({
  name: 'diagramBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      diagramId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-diagram-id'),
      },
      label: {
        default: 'Untitled Diagram',
        parseHTML: (el) => el.getAttribute('data-diagram-label'),
      },
      nodes: {
        default: [],
        parseHTML: (el) => {
          try { return JSON.parse(el.getAttribute('data-diagram-nodes') ?? '[]') }
          catch { return [] }
        },
      },
      edges: {
        default: [],
        parseHTML: (el) => {
          try { return JSON.parse(el.getAttribute('data-diagram-edges') ?? '[]') }
          catch { return [] }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-diagram-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-diagram-block': '',
        'data-diagram-id': HTMLAttributes.diagramId as string,
        'data-diagram-label': HTMLAttributes.label as string,
        'data-diagram-nodes': JSON.stringify(HTMLAttributes.nodes),
        'data-diagram-edges': JSON.stringify(HTMLAttributes.edges),
      }),
      `[Diagram: ${HTMLAttributes.label as string}]`,
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'diagram-block-preview'

      const header = document.createElement('div')
      header.className = 'diagram-block-header'

      const icon = document.createElement('span')
      icon.className = 'diagram-block-icon'
      icon.textContent = '\u25C8' // diamond

      const label = document.createElement('span')
      label.className = 'diagram-block-label'
      label.textContent = (node.attrs.label as string) || 'Untitled Diagram'

      const nodeCount = document.createElement('span')
      nodeCount.className = 'diagram-block-count'
      const n = (node.attrs.nodes as object[]).length
      const e = (node.attrs.edges as object[]).length
      nodeCount.textContent = `${n} node${n !== 1 ? 's' : ''}, ${e} edge${e !== 1 ? 's' : ''}`

      const editHint = document.createElement('span')
      editHint.className = 'diagram-block-hint'
      editHint.textContent = 'Click to edit'

      header.appendChild(icon)
      header.appendChild(label)
      wrapper.appendChild(header)
      wrapper.appendChild(nodeCount)
      wrapper.appendChild(editHint)

      wrapper.addEventListener('click', () => {
        window.dispatchEvent(
          new CustomEvent(EDIT_DIAGRAM_EVENT, {
            detail: {
              diagramId: node.attrs.diagramId as string,
              label: node.attrs.label as string,
              nodes: node.attrs.nodes as object[],
              edges: node.attrs.edges as object[],
            } satisfies DiagramData,
          }),
        )
      })

      return { dom: wrapper }
    }
  },

  addCommands() {
    return {
      insertDiagram:
        (label?: string) =>
        ({ chain }: { chain: () => { insertContent: (content: object) => { run: () => boolean } } }) => {
          return chain()
            .insertContent({
              type: 'diagramBlock',
              attrs: {
                diagramId: generateId(),
                label: label || 'Untitled Diagram',
                nodes: [
                  {
                    id: '1',
                    type: 'default',
                    position: { x: 100, y: 100 },
                    data: { label: 'Start' },
                  },
                  {
                    id: '2',
                    type: 'default',
                    position: { x: 300, y: 200 },
                    data: { label: 'End' },
                  },
                ],
                edges: [
                  { id: 'e1-2', source: '1', target: '2', animated: true },
                ],
              },
            })
            .run()
        },
    }
  },
})

/**
 * Extract all diagram data from a Tiptap JSON document.
 */
interface TipNode { type?: string; attrs?: Record<string, unknown>; content?: TipNode[] }

export function extractDiagrams(doc: object): DiagramData[] {
  const diagrams: DiagramData[] = []
  function walk(node: TipNode) {
    if (node.type === 'diagramBlock' && node.attrs?.diagramId) {
      diagrams.push({
        diagramId: node.attrs.diagramId as string,
        label: (node.attrs.label as string) || 'Untitled Diagram',
        nodes: (node.attrs.nodes as object[]) || [],
        edges: (node.attrs.edges as object[]) || [],
      })
    }
    node.content?.forEach(walk)
  }
  walk(doc as TipNode)
  return diagrams
}
