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
export const SAVE_DIAGRAM_EVENT = 'braindump:save-diagram'

export type DiagramType = 'general' | 'flowchart' | 'class' | 'er' | 'sequence' | 'architecture'

export interface DiagramData {
  diagramId: string
  diagramType: DiagramType
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
      diagramType: {
        default: 'general' as DiagramType,
        parseHTML: (el) => (el.getAttribute('data-diagram-type') ?? 'general') as DiagramType,
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
        'data-diagram-type': HTMLAttributes.diagramType as string,
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

      const typeBadge = document.createElement('span')
      typeBadge.className = 'diagram-block-type'
      const dt = (node.attrs.diagramType as string) || 'general'
      typeBadge.textContent = dt.charAt(0).toUpperCase() + dt.slice(1)

      const editHint = document.createElement('span')
      editHint.className = 'diagram-block-hint'
      editHint.textContent = 'Click to edit'

      header.appendChild(icon)
      header.appendChild(label)
      header.appendChild(typeBadge)
      wrapper.appendChild(header)
      wrapper.appendChild(nodeCount)
      wrapper.appendChild(editHint)

      wrapper.addEventListener('click', () => {
        window.dispatchEvent(
          new CustomEvent(EDIT_DIAGRAM_EVENT, {
            detail: {
              diagramId: node.attrs.diagramId as string,
              diagramType: (node.attrs.diagramType as DiagramType) || 'general',
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

  // @ts-expect-error — custom commands with non-standard signatures
  addCommands() {
    return {
      insertDiagram:
        (diagramType?: DiagramType, label?: string) =>
        ({ chain }: { chain: () => { insertContent: (content: object) => { run: () => boolean } } }) => {
          const type = diagramType || 'general'
          const template = getDiagramTemplate(type)
          return chain()
            .insertContent({
              type: 'diagramBlock',
              attrs: {
                diagramId: generateId(),
                diagramType: type,
                label: label || template.defaultLabel,
                nodes: template.nodes,
                edges: template.edges,
              },
            })
            .run()
        },
      updateDiagram:
        (data: DiagramData) =>
        ({ tr, dispatch }: { tr: { doc: { descendants: (fn: (node: { type: { name: string }; attrs: Record<string, unknown> }, pos: number) => boolean | void) => void }; nodeSize: number }; dispatch: ((tr: unknown) => void) | undefined }) => {
          let found = false
          tr.doc.descendants((node: { type: { name: string }; attrs: Record<string, unknown> }, pos: number) => {
            if (node.type.name === 'diagramBlock' && node.attrs.diagramId === data.diagramId) {
              const attrs = { ...node.attrs, diagramType: data.diagramType, label: data.label, nodes: data.nodes, edges: data.edges }
              if (dispatch) {
                ;(tr as unknown as { setNodeMarkup: (pos: number, type: undefined, attrs: object) => unknown }).setNodeMarkup(pos, undefined, attrs)
              }
              found = true
              return false
            }
          })
          if (dispatch && found) dispatch(tr)
          return found
        },
    }
  },
})

// ── Diagram type definitions & templates ─────────────────────────────────────

export interface DiagramTypeDefinition {
  type: DiagramType
  label: string
  description: string
  defaultLabel: string
}

export const diagramTypes: DiagramTypeDefinition[] = [
  { type: 'general',      label: 'General',      description: 'All-purpose diagram with all node types', defaultLabel: 'Untitled Diagram' },
  { type: 'flowchart',    label: 'Flowchart',    description: 'Process flow with decisions and steps',   defaultLabel: 'Flowchart' },
  { type: 'class',        label: 'Class',         description: 'UML class diagram with properties and methods', defaultLabel: 'Class Diagram' },
  { type: 'er',           label: 'ER Diagram',   description: 'Entity-relationship diagram for data models',    defaultLabel: 'ER Diagram' },
  { type: 'sequence',     label: 'Sequence',     description: 'Actor interactions in sequential order',         defaultLabel: 'Sequence Diagram' },
  { type: 'architecture', label: 'Architecture', description: 'System architecture with services and layers',   defaultLabel: 'Architecture Diagram' },
]

interface DiagramTemplate { defaultLabel: string; nodes: object[]; edges: object[] }

function getDiagramTemplate(type: DiagramType): DiagramTemplate {
  switch (type) {
    case 'flowchart':
      return {
        defaultLabel: 'Flowchart',
        nodes: [
          { id: '1', type: 'input',    position: { x: 200, y: 0 },   data: { label: 'Start' } },
          { id: '2', type: 'default',  position: { x: 200, y: 100 }, data: { label: 'Process' } },
          { id: '3', type: 'decision', position: { x: 200, y: 220 }, data: { label: 'OK?' } },
          { id: '4', type: 'output',   position: { x: 200, y: 380 }, data: { label: 'End' } },
          { id: '5', type: 'default',  position: { x: 420, y: 220 }, data: { label: 'Handle Error' } },
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2' },
          { id: 'e2-3', source: '2', target: '3' },
          { id: 'e3-4', source: '3', target: '4', sourceHandle: 'yes', label: 'Yes' },
          { id: 'e3-5', source: '3', target: '5', sourceHandle: 'no', label: 'No' },
          { id: 'e5-2', source: '5', target: '2' },
        ],
      }
    case 'class':
      return {
        defaultLabel: 'Class Diagram',
        nodes: [
          { id: '1', type: 'classNode', position: { x: 50, y: 50 },  data: { label: 'User', properties: ['+id: string', '+name: string', '+email: string'], methods: ['+getName(): string', '+setEmail(e: string): void'] } },
          { id: '2', type: 'classNode', position: { x: 400, y: 50 }, data: { label: 'Order', properties: ['+id: string', '+total: number', '+status: string'], methods: ['+getTotal(): number', '+cancel(): void'] } },
          { id: '3', type: 'classNode', position: { x: 400, y: 350 }, data: { label: 'Product', properties: ['+id: string', '+name: string', '+price: number'], methods: ['+getPrice(): number'] } },
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2', label: 'places', type: 'smoothstep' },
          { id: 'e2-3', source: '2', target: '3', label: 'contains', type: 'smoothstep' },
        ],
      }
    case 'er':
      return {
        defaultLabel: 'ER Diagram',
        nodes: [
          { id: '1', type: 'entityNode', position: { x: 50, y: 50 },  data: { label: 'users', attributes: ['id: uuid PK', 'name: varchar', 'email: varchar', 'created_at: timestamp'] } },
          { id: '2', type: 'entityNode', position: { x: 400, y: 50 }, data: { label: 'orders', attributes: ['id: uuid PK', 'user_id: uuid FK', 'total: decimal', 'status: varchar'] } },
          { id: '3', type: 'entityNode', position: { x: 400, y: 320 }, data: { label: 'products', attributes: ['id: uuid PK', 'name: varchar', 'price: decimal', 'sku: varchar'] } },
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2', label: '1:N', type: 'smoothstep' },
          { id: 'e2-3', source: '2', target: '3', label: 'N:M', type: 'smoothstep' },
        ],
      }
    case 'sequence':
      return {
        defaultLabel: 'Sequence Diagram',
        nodes: [
          { id: '1', type: 'actorNode', position: { x: 50, y: 0 },   data: { label: 'Client' } },
          { id: '2', type: 'actorNode', position: { x: 300, y: 0 },  data: { label: 'API Server' } },
          { id: '3', type: 'actorNode', position: { x: 550, y: 0 },  data: { label: 'Database' } },
          { id: '4', type: 'default',   position: { x: 80, y: 120 }, data: { label: '1. Request' } },
          { id: '5', type: 'default',   position: { x: 330, y: 200 }, data: { label: '2. Query' } },
          { id: '6', type: 'default',   position: { x: 330, y: 280 }, data: { label: '3. Result' } },
          { id: '7', type: 'default',   position: { x: 80, y: 360 }, data: { label: '4. Response' } },
        ],
        edges: [
          { id: 'e4-5', source: '4', target: '5', animated: true },
          { id: 'e5-6', source: '5', target: '6', animated: true },
          { id: 'e6-7', source: '6', target: '7', animated: true },
        ],
      }
    case 'architecture':
      return {
        defaultLabel: 'Architecture Diagram',
        nodes: [
          { id: 'g1', type: 'group', position: { x: 0, y: 0 },     data: { label: 'Frontend' }, style: { width: 300, height: 180 } },
          { id: 'g2', type: 'group', position: { x: 350, y: 0 },   data: { label: 'Backend' },  style: { width: 300, height: 180 } },
          { id: 'g3', type: 'group', position: { x: 350, y: 230 }, data: { label: 'Data Layer' }, style: { width: 300, height: 140 } },
          { id: '1', type: 'default', position: { x: 30, y: 60 },  data: { label: 'Web App' }, parentNode: 'g1', extent: 'parent' },
          { id: '2', type: 'default', position: { x: 160, y: 60 }, data: { label: 'Mobile App' }, parentNode: 'g1', extent: 'parent' },
          { id: '3', type: 'default', position: { x: 30, y: 60 },  data: { label: 'API Gateway' }, parentNode: 'g2', extent: 'parent' },
          { id: '4', type: 'default', position: { x: 160, y: 60 }, data: { label: 'Auth Service' }, parentNode: 'g2', extent: 'parent' },
          { id: '5', type: 'default', position: { x: 30, y: 50 },  data: { label: 'PostgreSQL' }, parentNode: 'g3', extent: 'parent' },
          { id: '6', type: 'default', position: { x: 160, y: 50 }, data: { label: 'Redis Cache' }, parentNode: 'g3', extent: 'parent' },
        ],
        edges: [
          { id: 'e1-3', source: '1', target: '3', animated: true },
          { id: 'e2-3', source: '2', target: '3', animated: true },
          { id: 'e3-4', source: '3', target: '4' },
          { id: 'e3-5', source: '3', target: '5' },
          { id: 'e3-6', source: '3', target: '6' },
        ],
      }
    case 'general':
    default:
      return {
        defaultLabel: 'Untitled Diagram',
        nodes: [
          { id: '1', type: 'default', position: { x: 100, y: 100 }, data: { label: 'Start' } },
          { id: '2', type: 'default', position: { x: 300, y: 200 }, data: { label: 'End' } },
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2', animated: true },
        ],
      }
  }
}

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
        diagramType: (node.attrs.diagramType as DiagramType) || 'general',
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
