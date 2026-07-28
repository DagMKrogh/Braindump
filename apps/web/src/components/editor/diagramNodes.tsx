import { memo } from 'react'
import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow'
import type { DiagramType } from '../../lib/extensions/DiagramBlock'
import ds from '../../styles/diagram.module.css'

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

// ── Group / container node ───────────────────────────────────────────────────

export const GroupNode = memo(({ data, selected }: NodeProps) => (
  <div className={`${ds.customNode} ${ds.groupNode}`}>
    <NodeResizer isVisible={selected ?? false} minWidth={200} minHeight={150} />
    <div className={ds.groupLabel}>{(data as { label: string }).label}</div>
  </div>
))
GroupNode.displayName = 'GroupNode'

// ── Class node (UML class with properties + methods) ─────────────────────────

interface ClassData {
  label: string
  properties?: string[]
  methods?: string[]
}

export const ClassNode = memo(({ data, selected }: NodeProps) => {
  const d = data as ClassData
  return (
    <div className={`${ds.customNode} ${ds.classNode}`}>
      <NodeResizer isVisible={selected ?? false} minWidth={160} minHeight={80} />
      <Handle type="target" position={Position.Top} className={ds.handle} />
      <div className={ds.classHeader}>{d.label}</div>
      {d.properties && d.properties.length > 0 && (
        <div className={ds.classSection}>
          {d.properties.map((p, i) => (
            <div key={i} className={ds.classMember}>{p}</div>
          ))}
        </div>
      )}
      {d.methods && d.methods.length > 0 && (
        <div className={ds.classSection}>
          {d.methods.map((m, i) => (
            <div key={i} className={ds.classMember}>{m}</div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className={ds.handle} />
    </div>
  )
})
ClassNode.displayName = 'ClassNode'

// ── Entity node (ER diagram entity with attributes) ──────────────────────────

interface EntityData {
  label: string
  attributes?: string[]
}

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

// ── Actor node (sequence diagram participant) ────────────────────────────────

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

// ── Node type registry for React Flow ────────────────────────────────────────

export const customNodeTypes = {
  input: InputNode,
  output: OutputNode,
  decision: DecisionNode,
  group: GroupNode,
  classNode: ClassNode,
  entityNode: EntityNode,
  actorNode: ActorNode,
}

export type DiagramNodeType = 'default' | 'input' | 'output' | 'decision' | 'group' | 'classNode' | 'entityNode' | 'actorNode'

interface NodeTypeOption {
  type: DiagramNodeType
  label: string
  description: string
}

const generalNodeTypes: NodeTypeOption[] = [
  { type: 'default',    label: 'Default',    description: 'Standard process node' },
  { type: 'input',      label: 'Input',      description: 'Start / trigger point' },
  { type: 'output',     label: 'Output',     description: 'End / result point' },
  { type: 'decision',   label: 'Decision',   description: 'Conditional branching' },
  { type: 'group',      label: 'Group',      description: 'Container area for grouping' },
  { type: 'classNode',  label: 'Class',      description: 'UML class with properties/methods' },
  { type: 'entityNode', label: 'Entity',     description: 'ER entity with attributes' },
  { type: 'actorNode',  label: 'Actor',      description: 'Participant / actor' },
]

const flowchartNodeTypes: NodeTypeOption[] = [
  { type: 'input',    label: 'Start',    description: 'Start point' },
  { type: 'default',  label: 'Process',  description: 'Process step' },
  { type: 'decision', label: 'Decision', description: 'Conditional branching' },
  { type: 'output',   label: 'End',      description: 'End point' },
  { type: 'group',    label: 'Group',    description: 'Container area' },
]

const classNodeTypes: NodeTypeOption[] = [
  { type: 'classNode', label: 'Class',     description: 'Class with properties and methods' },
  { type: 'group',     label: 'Package',   description: 'Package / namespace container' },
  { type: 'default',   label: 'Note',      description: 'Annotation note' },
]

const erNodeTypes: NodeTypeOption[] = [
  { type: 'entityNode', label: 'Entity',   description: 'Table / entity with attributes' },
  { type: 'group',      label: 'Schema',   description: 'Schema / namespace container' },
  { type: 'default',    label: 'Note',     description: 'Annotation note' },
]

const sequenceNodeTypes: NodeTypeOption[] = [
  { type: 'actorNode', label: 'Actor',     description: 'Participant / service' },
  { type: 'default',   label: 'Message',   description: 'Interaction / message' },
  { type: 'group',     label: 'Fragment',  description: 'Loop / alt fragment' },
]

const architectureNodeTypes: NodeTypeOption[] = [
  { type: 'default',  label: 'Service',    description: 'Service / component' },
  { type: 'group',    label: 'Layer',      description: 'Layer / boundary' },
  { type: 'input',    label: 'Client',     description: 'External client / entry' },
  { type: 'output',   label: 'External',   description: 'External system / output' },
]

export function getNodeTypesForDiagram(diagramType: DiagramType): NodeTypeOption[] {
  switch (diagramType) {
    case 'flowchart':    return flowchartNodeTypes
    case 'class':        return classNodeTypes
    case 'er':           return erNodeTypes
    case 'sequence':     return sequenceNodeTypes
    case 'architecture': return architectureNodeTypes
    case 'general':
    default:             return generalNodeTypes
  }
}

// Keep legacy export for backwards compat
export const nodeTypeOptions = generalNodeTypes
