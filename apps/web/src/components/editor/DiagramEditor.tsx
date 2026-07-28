import { useCallback, useRef, useState } from 'react'
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { X, Plus, Save, Trash2, ChevronDown } from 'lucide-react'
import { SAVE_DIAGRAM_EVENT, type DiagramData } from '../../lib/extensions/DiagramBlock'
import { customNodeTypes, nodeTypeOptions, type DiagramNodeType } from './diagramNodes'
import s from '../../styles/layout.module.css'
import ds from '../../styles/diagram.module.css'

interface Props {
  diagram: DiagramData
  onClose: () => void
}

let nextNodeId = 100

export function DiagramEditor({ diagram, onClose }: Props) {
  const [nodes, setNodes] = useState<Node[]>(diagram.nodes as Node[])
  const [edges, setEdges] = useState<Edge[]>(diagram.edges as Edge[])
  const [label, setLabel] = useState(diagram.label)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const rfInstance = useRef<ReactFlowInstance | null>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  )

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [],
  )

  const addNode = useCallback((nodeType: DiagramNodeType) => {
    const id = String(++nextNodeId)
    const viewport = rfInstance.current?.getViewport()
    const x = viewport ? (-viewport.x + 400) / (viewport.zoom || 1) : 200
    const y = viewport ? (-viewport.y + 300) / (viewport.zoom || 1) : 200

    const typeLabel = nodeTypeOptions.find((o) => o.type === nodeType)?.label ?? 'Node'
    const isGroup = nodeType === 'group'

    setNodes((nds) => [
      ...nds,
      {
        id,
        type: nodeType,
        position: { x, y },
        data: { label: `${typeLabel} ${id}` },
        ...(isGroup ? {
          style: { width: 300, height: 200 },
          dragHandle: `.${ds.groupLabel}`,
        } : {}),
      },
    ])
    setAddMenuOpen(false)
  }, [])

  const deleteSelected = useCallback(() => {
    if (!selectedNode) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode && e.target !== selectedNode))
    setSelectedNode(null)
  }, [selectedNode])

  const handleSave = useCallback(() => {
    const data: DiagramData = {
      diagramId: diagram.diagramId,
      label,
      nodes: nodes as object[],
      edges: edges as object[],
    }
    window.dispatchEvent(new CustomEvent(SAVE_DIAGRAM_EVENT, { detail: data }))
    onClose()
  }, [diagram.diagramId, label, nodes, edges, onClose])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id)
    setEditingLabel((node.data as { label: string }).label)
  }, [])

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null)
    setAddMenuOpen(false)
  }, [])

  const handleNodeLabelSave = useCallback(() => {
    if (!selectedNode) return
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode ? { ...n, data: { ...n.data, label: editingLabel } } : n,
      ),
    )
  }, [selectedNode, editingLabel])

  // Change type of selected node
  const handleChangeNodeType = useCallback((newType: DiagramNodeType) => {
    if (!selectedNode) return
    const isGroup = newType === 'group'
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode
          ? {
              ...n,
              type: newType,
              ...(isGroup
                ? { style: { width: 300, height: 200 }, dragHandle: `.${ds.groupLabel}` }
                : { style: undefined, dragHandle: undefined }),
            }
          : n,
      ),
    )
  }, [selectedNode])

  const selectedNodeData = selectedNode ? nodes.find((n) => n.id === selectedNode) : null

  return (
    <div className={ds.diagramPanel}>
      {/* Header */}
      <div className={ds.diagramHeader}>
        <input
          className={ds.diagramTitleInput}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Diagram name"
        />
        <div className={ds.diagramActions}>
          {/* Add node dropdown */}
          <div ref={addMenuRef} className={s.dropdownWrap}>
            <button
              className={`${s.btn} ${s.btnGhost}`}
              onClick={() => setAddMenuOpen((o) => !o)}
              title="Add node"
            >
              <Plus size={14} /> Add Node <ChevronDown size={12} />
            </button>
            {addMenuOpen && (
              <div className={`${s.dropdownMenu} ${ds.addNodeMenu}`}>
                {nodeTypeOptions.map((opt) => (
                  <button
                    key={opt.type}
                    className={s.dropdownItem}
                    onClick={() => addNode(opt.type)}
                  >
                    <span className={ds.nodeTypeLabel}>{opt.label}</span>
                    <span className={ds.nodeTypeDesc}>{opt.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedNode && (
            <button
              className={`${s.btn} ${s.btnGhost}`}
              onClick={deleteSelected}
              title="Delete selected node"
              style={{ color: 'var(--color-error)' }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={handleSave} title="Save diagram">
            <Save size={14} /> Save
          </button>
          <button className={`${s.btn} ${s.btnGhost}`} onClick={onClose} title="Close diagram editor">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Node property editor */}
      {selectedNodeData && (
        <div className={ds.nodeEditor}>
          <span className={ds.nodeEditorLabel}>Label:</span>
          <input
            className={s.metaInput}
            value={editingLabel}
            onChange={(e) => setEditingLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNodeLabelSave() }}
            onBlur={handleNodeLabelSave}
          />
          <span className={ds.nodeEditorLabel}>Type:</span>
          <select
            className={s.metaSelect}
            value={selectedNodeData.type ?? 'default'}
            onChange={(e) => handleChangeNodeType(e.target.value as DiagramNodeType)}
          >
            {nodeTypeOptions.map((opt) => (
              <option key={opt.type} value={opt.type}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* React Flow canvas */}
      <div className={ds.diagramCanvas}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onInit={(instance) => { rfInstance.current = instance }}
          nodeTypes={customNodeTypes}
          fitView
          deleteKeyCode="Backspace"
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor="var(--color-accent)"
            maskColor="rgba(0,0,0,0.2)"
            style={{ background: 'var(--color-surface)' }}
          />
        </ReactFlow>
      </div>
    </div>
  )
}
