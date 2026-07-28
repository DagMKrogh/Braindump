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
import { X, Plus, Save, Trash2 } from 'lucide-react'
import type { DiagramData } from '../../lib/extensions/DiagramBlock'
import s from '../../styles/layout.module.css'
import ds from '../../styles/diagram.module.css'

interface Props {
  diagram: DiagramData
  onSave: (data: DiagramData) => void
  onClose: () => void
}

let nextNodeId = 100

export function DiagramEditor({ diagram, onSave, onClose }: Props) {
  const [nodes, setNodes] = useState<Node[]>(diagram.nodes as Node[])
  const [edges, setEdges] = useState<Edge[]>(diagram.edges as Edge[])
  const [label, setLabel] = useState(diagram.label)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const rfInstance = useRef<ReactFlowInstance | null>(null)

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

  const addNode = useCallback(() => {
    const id = String(++nextNodeId)
    const viewport = rfInstance.current?.getViewport()
    const x = viewport ? (-viewport.x + 400) / (viewport.zoom || 1) : 200
    const y = viewport ? (-viewport.y + 300) / (viewport.zoom || 1) : 200
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'default',
        position: { x, y },
        data: { label: `Node ${id}` },
      },
    ])
  }, [])

  const deleteSelected = useCallback(() => {
    if (!selectedNode) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode && e.target !== selectedNode))
    setSelectedNode(null)
  }, [selectedNode])

  const handleSave = useCallback(() => {
    onSave({
      diagramId: diagram.diagramId,
      label,
      nodes: nodes as object[],
      edges: edges as object[],
    })
  }, [diagram.diagramId, label, nodes, edges, onSave])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id)
    setEditingLabel((node.data as { label: string }).label)
  }, [])

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const handleNodeLabelSave = useCallback(() => {
    if (!selectedNode) return
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode ? { ...n, data: { ...n.data, label: editingLabel } } : n,
      ),
    )
  }, [selectedNode, editingLabel])

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
          <button className={`${s.btn} ${s.btnGhost}`} onClick={addNode} title="Add node">
            <Plus size={14} /> Add Node
          </button>
          {selectedNode && (
            <button className={`${s.btn} ${s.btnGhost}`} onClick={deleteSelected} title="Delete selected node" style={{ color: 'var(--color-error)' }}>
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

      {/* Node label editor */}
      {selectedNode && (
        <div className={ds.nodeEditor}>
          <span className={ds.nodeEditorLabel}>Node label:</span>
          <input
            className={s.metaInput}
            value={editingLabel}
            onChange={(e) => setEditingLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNodeLabelSave() }}
            onBlur={handleNodeLabelSave}
          />
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
