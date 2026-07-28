import { useCallback, useRef, useState } from 'react'
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Background,
  Controls,
  MiniMap,
  MarkerType,
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
import { customNodeTypes, getNodeSectionsForDiagram, getNodeTypesForDiagram, type DiagramNodeType } from './diagramNodes'
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
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const rfInstance = useRef<ReactFlowInstance | null>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  const diagramType = diagram.diagramType || 'general'
  const availableNodeTypes = getNodeTypesForDiagram(diagramType)
  const nodeSections = getNodeSectionsForDiagram(diagramType)

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  )

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({
      ...connection,
      markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#888' },
    }, eds)),
    [],
  )

  const addNode = useCallback((nodeType: DiagramNodeType) => {
    const id = String(++nextNodeId)
    const viewport = rfInstance.current?.getViewport()
    const x = viewport ? (-viewport.x + 400) / (viewport.zoom || 1) : 200
    const y = viewport ? (-viewport.y + 300) / (viewport.zoom || 1) : 200

    const typeOpt = availableNodeTypes.find((o) => o.type === nodeType)
    const typeLabel = typeOpt?.label ?? 'Node'
    const isGroup = nodeType === 'group'

    // Build default data based on node type
    let data: Record<string, unknown> = { label: `${typeLabel} ${id}` }
    if (nodeType === 'classNode') {
      data = { label: 'ClassName', properties: ['+id: string'], methods: ['+getId(): string'] }
    } else if (nodeType === 'entityNode') {
      data = { label: 'table_name', attributes: ['id: uuid PK'] }
    }

    setNodes((nds) => [
      ...nds,
      {
        id,
        type: nodeType,
        position: { x, y },
        data,
        ...(isGroup ? {
          style: { width: 300, height: 200 },
          dragHandle: `.${ds.groupLabel}`,
        } : {}),
      },
    ])
    setAddMenuOpen(false)
  }, [availableNodeTypes])

  const deleteSelected = useCallback(() => {
    if (selectedEdge) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdge))
      setSelectedEdge(null)
      return
    }
    if (!selectedNode) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode && e.target !== selectedNode))
    setSelectedNode(null)
  }, [selectedNode, selectedEdge])

  const handleSave = useCallback(() => {
    const data: DiagramData = {
      diagramId: diagram.diagramId,
      diagramType,
      label,
      nodes: nodes as object[],
      edges: edges as object[],
    }
    window.dispatchEvent(new CustomEvent(SAVE_DIAGRAM_EVENT, { detail: data }))
    onClose()
  }, [diagram.diagramId, diagramType, label, nodes, edges, onClose])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id)
    setSelectedEdge(null)
    setEditingLabel((node.data as { label: string }).label)
  }, [])

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge.id)
    setSelectedNode(null)
  }, [])

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
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

  const handleChangeNodeType = useCallback((newType: DiagramNodeType) => {
    if (!selectedNode) return
    const isGroup = newType === 'group'
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNode) return n
        // Preserve structured data when switching between compatible types
        let data = n.data as Record<string, unknown>
        if (newType === 'classNode' && !data.properties) {
          data = { ...data, properties: [], methods: [] }
        } else if (newType === 'entityNode' && !data.attributes) {
          data = { ...data, attributes: [] }
        }
        return {
          ...n,
          type: newType,
          data,
          ...(isGroup
            ? { style: { width: 300, height: 200 }, dragHandle: `.${ds.groupLabel}` }
            : { style: undefined, dragHandle: undefined }),
        }
      }),
    )
  }, [selectedNode])

  // Update structured data (properties, methods, attributes) for class/entity nodes
  const updateNodeData = useCallback((key: string, value: string[]) => {
    if (!selectedNode) return
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode ? { ...n, data: { ...n.data, [key]: value } } : n,
      ),
    )
  }, [selectedNode])

  // ── Edge property helpers ──────────────────────────────────────────────
  const updateEdge = useCallback((updater: (e: Edge) => Edge) => {
    if (!selectedEdge) return
    setEdges((eds) => eds.map((e) => e.id === selectedEdge ? updater(e) : e))
  }, [selectedEdge])

  const setEdgeDirection = useCallback((dir: 'forward' | 'back' | 'both' | 'none') => {
    const arrow = { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#888' }
    updateEdge((e) => {
      switch (dir) {
        case 'forward': return { ...e, markerEnd: arrow, markerStart: undefined }
        case 'back':    return { ...e, markerEnd: undefined, markerStart: arrow }
        case 'both':    return { ...e, markerEnd: arrow, markerStart: arrow }
        case 'none':    return { ...e, markerEnd: undefined, markerStart: undefined }
      }
    })
  }, [updateEdge])

  const selectedNodeData = selectedNode ? nodes.find((n) => n.id === selectedNode) : null
  const selectedType = selectedNodeData?.type ?? 'default'
  const selectedData = selectedNodeData?.data as Record<string, unknown> | undefined

  const selectedEdgeData = selectedEdge ? edges.find((e) => e.id === selectedEdge) : null
  const edgeDirection = selectedEdgeData
    ? (selectedEdgeData.markerStart && selectedEdgeData.markerEnd ? 'both'
      : selectedEdgeData.markerStart ? 'back'
      : selectedEdgeData.markerEnd ? 'forward'
      : 'none')
    : 'forward'

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
                {nodeSections.map((section, si) => (
                  <div key={section.heading}>
                    {si > 0 && <div className={ds.menuDivider} />}
                    <div className={ds.menuSectionHeading}>{section.heading}</div>
                    {section.items.map((opt) => (
                      <button
                        key={`${section.heading}-${opt.type}`}
                        className={s.dropdownItem}
                        onClick={() => addNode(opt.type)}
                      >
                        <span className={ds.nodeTypeLabel}>{opt.label}</span>
                        <span className={ds.nodeTypeDesc}>{opt.description}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {(selectedNode || selectedEdge) && (
            <button
              className={`${s.btn} ${s.btnGhost}`}
              onClick={deleteSelected}
              title={selectedEdge ? 'Delete selected edge' : 'Delete selected node'}
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
            value={selectedType}
            onChange={(e) => handleChangeNodeType(e.target.value as DiagramNodeType)}
          >
            {availableNodeTypes.map((opt) => (
              <option key={opt.type} value={opt.type}>{opt.label}</option>
            ))}
          </select>

          {/* Class node: properties + methods editor */}
          {selectedType === 'classNode' && selectedData && (
            <>
              <span className={ds.nodeEditorLabel}>Props:</span>
              <textarea
                className={`${s.metaInput} ${ds.structuredInput}`}
                value={((selectedData.properties as string[]) ?? []).join('\n')}
                onChange={(e) => updateNodeData('properties', e.target.value.split('\n').filter(Boolean))}
                placeholder="+name: type (one per line)"
                rows={3}
              />
              <span className={ds.nodeEditorLabel}>Methods:</span>
              <textarea
                className={`${s.metaInput} ${ds.structuredInput}`}
                value={((selectedData.methods as string[]) ?? []).join('\n')}
                onChange={(e) => updateNodeData('methods', e.target.value.split('\n').filter(Boolean))}
                placeholder="+method(): type (one per line)"
                rows={3}
              />
            </>
          )}

          {/* Entity node: attributes editor */}
          {selectedType === 'entityNode' && selectedData && (
            <>
              <span className={ds.nodeEditorLabel}>Attrs:</span>
              <textarea
                className={`${s.metaInput} ${ds.structuredInput}`}
                value={((selectedData.attributes as string[]) ?? []).join('\n')}
                onChange={(e) => updateNodeData('attributes', e.target.value.split('\n').filter(Boolean))}
                placeholder="column: type PK/FK (one per line)"
                rows={4}
              />
            </>
          )}
        </div>
      )}

      {/* Edge property editor */}
      {selectedEdgeData && (
        <div className={ds.nodeEditor}>
          <span className={ds.nodeEditorLabel}>Label:</span>
          <input
            className={s.metaInput}
            value={(selectedEdgeData.label as string) ?? ''}
            onChange={(e) => updateEdge((ed) => ({ ...ed, label: e.target.value || undefined }))}
            placeholder="Edge label"
          />
          <span className={ds.nodeEditorLabel}>Direction:</span>
          <select
            className={s.metaSelect}
            value={edgeDirection}
            onChange={(e) => setEdgeDirection(e.target.value as 'forward' | 'back' | 'both' | 'none')}
          >
            <option value="forward">Forward →</option>
            <option value="back">← Back</option>
            <option value="both">↔ Both</option>
            <option value="none">— None</option>
          </select>
          <span className={ds.nodeEditorLabel}>Style:</span>
          <select
            className={s.metaSelect}
            value={selectedEdgeData.type ?? 'default'}
            onChange={(e) => updateEdge((ed) => ({ ...ed, type: e.target.value === 'default' ? undefined : e.target.value }))}
          >
            <option value="default">Bezier</option>
            <option value="smoothstep">Smooth Step</option>
            <option value="step">Step</option>
            <option value="straight">Straight</option>
          </select>
          <label className={ds.edgeCheckbox}>
            <input
              type="checkbox"
              checked={selectedEdgeData.animated ?? false}
              onChange={(e) => updateEdge((ed) => ({ ...ed, animated: e.target.checked }))}
            />
            <span className={ds.nodeEditorLabel}>Animated</span>
          </label>
          <label className={ds.edgeCheckbox}>
            <input
              type="checkbox"
              checked={selectedEdgeData.style?.strokeDasharray === '5 5'}
              onChange={(e) => updateEdge((ed) => ({
                ...ed,
                style: e.target.checked
                  ? { ...ed.style, strokeDasharray: '5 5' }
                  : { ...ed.style, strokeDasharray: undefined },
              }))}
            />
            <span className={ds.nodeEditorLabel}>Dashed</span>
          </label>
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
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          onInit={(instance) => { rfInstance.current = instance }}
          nodeTypes={customNodeTypes}
          defaultEdgeOptions={{
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#888' },
          }}
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
