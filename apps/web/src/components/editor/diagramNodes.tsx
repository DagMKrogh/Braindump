import { memo } from 'react'
import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow'
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

// ── Node type registry for React Flow ────────────────────────────────────────

export const customNodeTypes = {
  input: InputNode,
  output: OutputNode,
  decision: DecisionNode,
  group: GroupNode,
}

export type DiagramNodeType = 'default' | 'input' | 'output' | 'decision' | 'group'

export const nodeTypeOptions: { type: DiagramNodeType; label: string; description: string }[] = [
  { type: 'default',  label: 'Default',  description: 'Standard process node' },
  { type: 'input',    label: 'Input',    description: 'Start / trigger point' },
  { type: 'output',   label: 'Output',   description: 'End / result point' },
  { type: 'decision', label: 'Decision', description: 'Conditional branching' },
  { type: 'group',    label: 'Group',    description: 'Container area for grouping nodes' },
]
