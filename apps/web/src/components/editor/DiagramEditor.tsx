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
    (connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
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
    if (!selectedNode) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode && e.target !== selectedNode))
    setSelectedNode(null)
  }, [selectedNode])

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

  const selectedNodeData = selectedNode ? nodes.find((n) => n.id === selectedNode) : null
  const selectedType = selectedNodeData?.type ?? 'default'
  const selectedData = selectedNodeData?.data as Record<string, unknown> | undefined

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
