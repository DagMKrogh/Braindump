import { memo } from 'react'
import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow'
import type { DiagramType } from '../../lib/extensions/DiagramBlock'
import ds from '../../styles/diagram.module.css'

// ── Helper: standard 4-handle node wrapper ───────────────────────────────────

function FourHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} className={ds.handle} />
      <Handle type="target" position={Position.Left} id="left-in" className={ds.handle} />
      <Handle type="source" position={Position.Bottom} className={ds.handle} />
      <Handle type="source" position={Position.Right} id="right-out" className={ds.handle} />
    </>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  BASIC SHAPES
// ═════════════════════════════════════════════════════════════════════════════

// ── Circle ───────────────────────────────────────────────────────────────────

export const CircleNode = memo(({ data, selected }: NodeProps) => (
  <div className={`${ds.customNode} ${ds.circleNode}`}>
    <NodeResizer isVisible={selected ?? false} minWidth={60} minHeight={60} />
    <FourHandles />
    <div className={ds.customNodeLabel}>{(data as { label: string }).label}</div>
  </div>
))
CircleNode.displayName = 'CircleNode'

// ── Cylinder (database / storage) ────────────────────────────────────────────

export const CylinderNode = memo(({ data, selected }: NodeProps) => (
  <div className={`${ds.customNode} ${ds.cylinderNode}`}>
    <NodeResizer isVisible={selected ?? false} minWidth={80} minHeight={60} />
    <FourHandles />
    <div className={ds.cylinderBody}>
      <div className={ds.customNodeLabel}>{(data as { label: string }).label}</div>
    </div>
  </div>
))
CylinderNode.displayName = 'CylinderNode'

// ── Hexagon ──────────────────────────────────────────────────────────────────

export const HexagonNode = memo(({ data, selected }: NodeProps) => (
  <div className={`${ds.customNode} ${ds.hexagonNode}`}>
    <NodeResizer isVisible={selected ?? false} minWidth={100} minHeight={50} />
    <FourHandles />
    <div className={ds.hexagonInner}>
      <div className={ds.customNodeLabel}>{(data as { label: string }).label}</div>
    </div>
  </div>
))
HexagonNode.displayName = 'HexagonNode'

// ── Parallelogram (I/O) ─────────────────────────────────────────────────────

export const ParallelogramNode = memo(({ data, selected }: NodeProps) => (
  <div className={`${ds.customNode} ${ds.parallelogramNode}`}>
    <NodeResizer isVisible={selected ?? false} minWidth={100} minHeight={40} />
    <FourHandles />
    <div className={ds.customNodeLabel}>{(data as { label: string }).label}</div>
  </div>
))
ParallelogramNode.displayName = 'ParallelogramNode'

// ── Text label (borderless annotation) ───────────────────────────────────────

export const TextLabelNode = memo(({ data, selected }: NodeProps) => (
  <div className={`${ds.customNode} ${ds.textLabelNode}`}>
    <NodeResizer isVisible={selected ?? false} minWidth={40} minHeight={20} />
    <Handle type="target" position={Position.Top} className={ds.handle} style={{ opacity: 0 }} />
    <Handle type="source" position={Position.Bottom} className={ds.handle} style={{ opacity: 0 }} />
    <div className={ds.customNodeLabel}>{(data as { label: string }).label}</div>
  </div>
))
TextLabelNode.displayName = 'TextLabelNode'

// ── Sticky note (annotation with folded corner) ─────────────────────────────

export const StickyNoteNode = memo(({ data, selected }: NodeProps) => (
  <div className={`${ds.customNode} ${ds.stickyNoteNode}`}>
    <NodeResizer isVisible={selected ?? false} minWidth={100} minHeight={60} />
    <Handle type="target" position={Position.Top} className={ds.handle} />
    <Handle type="source" position={Position.Bottom} className={ds.handle} />
    <div className={ds.stickyNoteFold} />
    <div className={ds.stickyNoteText}>{(data as { label: string }).label}</div>
  </div>
))
StickyNoteNode.displayName = 'StickyNoteNode'

// ── Anchor (tiny dot for creating standalone lines / arrows) ─────────────────

export const AnchorNode = memo(({ data, selected }: NodeProps) => (
  <div className={`${ds.customNode} ${ds.anchorNode}`} title={(data as { label: string }).label}>
    <NodeResizer isVisible={selected ?? false} minWidth={8} minHeight={8} />
    <FourHandles />
  </div>
))
AnchorNode.displayName = 'AnchorNode'

// ═════════════════════════════════════════════════════════════════════════════
//  FLOW NODES
// ═════════════════════════════════════════════════════════════════════════════

// ── Input node (start / trigger) ─────────────────────────────────────────────

export const InputNode = memo(({ data, selected }: NodeProps) => (
  <div className={`${ds.customNode} ${ds.inputNode}`}>
    <NodeResizer isVisible={selected ?? false} minWidth={80} minHeight={30} />
    <div className={ds.customNodeLabel}>{(data as { label: string }).label}</div>
    <Handle type="source" position={Position.Bottom} className={ds.handle} />
  </div>
))
InputNode.displayName = 'InputNode'

// ── Output node (end / result) ───────────────────────────────────────────────

export const OutputNode = memo(({ data, selected }: NodeProps) => (
  <div className={`${ds.customNode} ${ds.outputNode}`}>
    <NodeResizer isVisible={selected ?? false} minWidth={80} minHeight={30} />
    <Handle type="target" position={Position.Top} className={ds.handle} />
    <div className={ds.customNodeLabel}>{(data as { label: string }).label}</div>
  </div>
))
OutputNode.displayName = 'OutputNode'

// ── Decision node (diamond / conditional) ────────────────────────────────────

export const DecisionNode = memo(({ data, selected }: NodeProps) => (
  <div className={`${ds.customNode} ${ds.decisionNode}`}>
    <NodeResizer isVisible={selected ?? false} minWidth={80} minHeight={80} />
    <Handle type="target" position={Position.Top} className={ds.handle} />
    <div className={ds.decisionDiamond}>
      <div className={ds.customNodeLabel}>{(data as { label: string }).label}</div>
    </div>
    <Handle type="source" position={Position.Bottom} id="yes" className={ds.handle} />
    <Handle type="source" position={Position.Right} id="no" className={ds.handle} />
  </div>
))
DecisionNode.displayName = 'DecisionNode'

// ═════════════════════════════════════════════════════════════════════════════
//  CONTAINERS
// ═════════════════════════════════════════════════════════════════════════════

export const GroupNode = memo(({ data, selected }: NodeProps) => (
  <div className={`${ds.customNode} ${ds.groupNode}`}>
    <NodeResizer isVisible={selected ?? false} minWidth={200} minHeight={150} />
    <div className={ds.groupLabel}>{(data as { label: string }).label}</div>
  </div>
))
GroupNode.displayName = 'GroupNode'

// ═════════════════════════════════════════════════════════════════════════════
//  SPECIALIZED (UML / ER / Sequence)
// ═════════════════════════════════════════════════════════════════════════════

interface ClassData { label: string; properties?: string[]; methods?: string[] }

export const ClassNode = memo(({ data, selected }: NodeProps) => {
  const d = data as ClassData
  return (
    <div className={`${ds.customNode} ${ds.classNode}`}>
      <NodeResizer isVisible={selected ?? false} minWidth={160} minHeight={80} />
      <Handle type="target" position={Position.Top} className={ds.handle} />
      <div className={ds.classHeader}>{d.label}</div>
      {d.properties && d.properties.length > 0 && (
        <div className={ds.classSection}>
          {d.properties.map((p, i) => <div key={i} className={ds.classMember}>{p}</div>)}
        </div>
      )}
      {d.methods && d.methods.length > 0 && (
        <div className={ds.classSection}>
          {d.methods.map((m, i) => <div key={i} className={ds.classMember}>{m}</div>)}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className={ds.handle} />
    </div>
  )
})
ClassNode.displayName = 'ClassNode'

interface EntityData { label: string; attributes?: string[] }

export const EntityNode = memo(({ data, selected }: NodeProps) => {
  const d = data as EntityData
  return (
    <div className={`${ds.customNode} ${ds.entityNode}`}>
      <NodeResizer isVisible={selected ?? false} minWidth={160} minHeight={60} />
      <Handle type="target" position={Position.Top} className={ds.handle} />
      <Handle type="target" position={Position.Left} id="left" className={ds.handle} />
      <div className={ds.entityHeader}>{d.label}</div>
      {d.attributes && d.attributes.length > 0 && (
        <div className={ds.entityAttributes}>
          {d.attributes.map((a, i) => {
            const isPk = a.includes('PK')
            const isFk = a.includes('FK')
            return (
              <div key={i} className={`${ds.entityAttr} ${isPk ? ds.entityPk : ''} ${isFk ? ds.entityFk : ''}`}>
                {a}
              </div>
            )
          })}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className={ds.handle} />
      <Handle type="source" position={Position.Right} id="right" className={ds.handle} />
    </div>
  )
})
EntityNode.displayName = 'EntityNode'

export const ActorNode = memo(({ data, selected }: NodeProps) => (
  <div className={`${ds.customNode} ${ds.actorNode}`}>
    <NodeResizer isVisible={selected ?? false} minWidth={80} minHeight={40} />
    <Handle type="target" position={Position.Left} className={ds.handle} />
    <div className={ds.actorIcon}>&#x1F464;</div>
    <div className={ds.customNodeLabel}>{(data as { label: string }).label}</div>
    <Handle type="source" position={Position.Right} className={ds.handle} />
    <Handle type="source" position={Position.Bottom} id="down" className={ds.handle} />
  </div>
))
ActorNode.displayName = 'ActorNode'

// ═════════════════════════════════════════════════════════════════════════════
//  REGISTRY
// ═════════════════════════════════════════════════════════════════════════════

export const customNodeTypes = {
  input: InputNode,
  output: OutputNode,
  decision: DecisionNode,
  group: GroupNode,
  classNode: ClassNode,
  entityNode: EntityNode,
  actorNode: ActorNode,
  circle: CircleNode,
  cylinder: CylinderNode,
  hexagon: HexagonNode,
  parallelogram: ParallelogramNode,
  textLabel: TextLabelNode,
  stickyNote: StickyNoteNode,
  anchor: AnchorNode,
}

export type DiagramNodeType = keyof typeof customNodeTypes | 'default'

// ── Categorized node type options ────────────────────────────────────────────

interface NodeTypeOption {
  type: DiagramNodeType
  label: string
  description: string
}

export interface NodeTypeSection {
  heading: string
  items: NodeTypeOption[]
}

const shapesSection: NodeTypeSection = {
  heading: 'Shapes',
  items: [
    { type: 'default',       label: 'Rectangle',     description: 'Standard box node' },
    { type: 'circle',        label: 'Circle',         description: 'Circle / state node' },
    { type: 'decision',      label: 'Diamond',        description: 'Diamond / decision' },
    { type: 'hexagon',       label: 'Hexagon',        description: 'Preparation / process' },
    { type: 'parallelogram', label: 'Parallelogram',  description: 'Input / output data' },
    { type: 'cylinder',      label: 'Cylinder',       description: 'Database / storage' },
  ],
}

const flowSection: NodeTypeSection = {
  heading: 'Flow',
  items: [
    { type: 'input',    label: 'Start',    description: 'Start / trigger point' },
    { type: 'output',   label: 'End',      description: 'End / result point' },
  ],
}

const annotationsSection: NodeTypeSection = {
  heading: 'Annotations',
  items: [
    { type: 'textLabel',  label: 'Text Label',  description: 'Borderless text annotation' },
    { type: 'stickyNote', label: 'Note',         description: 'Sticky note with comment' },
    { type: 'anchor',     label: 'Anchor',       description: 'Dot for standalone lines / arrows' },
  ],
}

const containersSection: NodeTypeSection = {
  heading: 'Containers',
  items: [
    { type: 'group', label: 'Group', description: 'Container area for grouping nodes' },
  ],
}

const specializedSection: NodeTypeSection = {
  heading: 'Specialized',
  items: [
    { type: 'classNode',  label: 'Class',  description: 'UML class with properties/methods' },
    { type: 'entityNode', label: 'Entity', description: 'ER entity with attributes' },
    { type: 'actorNode',  label: 'Actor',  description: 'Participant / actor' },
  ],
}

// ── Per-diagram-type section lists ───────────────────────────────────────────

const generalSections: NodeTypeSection[] = [
  shapesSection,
  flowSection,
  annotationsSection,
  containersSection,
  specializedSection,
]

const flowchartSections: NodeTypeSection[] = [
  flowSection,
  shapesSection,
  annotationsSection,
  containersSection,
]

const classSections: NodeTypeSection[] = [
  { heading: 'Class Diagram', items: [
    { type: 'classNode', label: 'Class',   description: 'Class with properties and methods' },
    { type: 'group',     label: 'Package', description: 'Package / namespace container' },
  ]},
  shapesSection,
  annotationsSection,
]

const erSections: NodeTypeSection[] = [
  { heading: 'ER Diagram', items: [
    { type: 'entityNode', label: 'Entity', description: 'Table / entity with attributes' },
    { type: 'group',      label: 'Schema', description: 'Schema / namespace container' },
  ]},
  shapesSection,
  annotationsSection,
]

const sequenceSections: NodeTypeSection[] = [
  { heading: 'Sequence', items: [
    { type: 'actorNode', label: 'Actor',   description: 'Participant / service' },
    { type: 'default',   label: 'Message', description: 'Interaction / message' },
    { type: 'group',     label: 'Fragment', description: 'Loop / alt fragment' },
  ]},
  shapesSection,
  annotationsSection,
]

const architectureSections: NodeTypeSection[] = [
  { heading: 'Architecture', items: [
    { type: 'default',   label: 'Service',  description: 'Service / component' },
    { type: 'cylinder',  label: 'Database', description: 'Database / data store' },
    { type: 'group',     label: 'Layer',    description: 'Layer / boundary' },
    { type: 'input',     label: 'Client',   description: 'External client / entry' },
    { type: 'output',    label: 'External', description: 'External system / output' },
  ]},
  shapesSection,
  annotationsSection,
]

export function getNodeSectionsForDiagram(diagramType: DiagramType): NodeTypeSection[] {
  switch (diagramType) {
    case 'flowchart':    return flowchartSections
    case 'class':        return classSections
    case 'er':           return erSections
    case 'sequence':     return sequenceSections
    case 'architecture': return architectureSections
    case 'general':
    default:             return generalSections
  }
}

// Flat list for type selector dropdown
export function getNodeTypesForDiagram(diagramType: DiagramType): NodeTypeOption[] {
  return getNodeSectionsForDiagram(diagramType).flatMap((s) => s.items)
}
