import React, { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, List, LayoutGrid, CheckSquare, Circle, User,
  CalendarDays, Flag, ChevronRight, ArrowUpDown,
} from 'lucide-react'
import { useNotesStore } from '../stores/notesStore'
import { upsertNote } from '../lib/localStore'
import { QuickTaskModal } from '../components/tasks/QuickTaskModal'
import type { LocalNote } from '@braindump/shared'
import s from '../styles/tasks.module.css'

// ── Helpers ─────────────────────────────────────────────────────────────────

type Status = 'open' | 'in-progress' | 'done' | 'cancelled'
type Priority = 'low' | 'medium' | 'high'
type ViewMode = 'list' | 'kanban'

const STATUS_LABEL: Record<Status, string> = {
  'open': 'Open',
  'in-progress': 'In Progress',
  'done': 'Done',
  'cancelled': 'Cancelled',
}

const PRIO_COLOR: Record<Priority, string> = {
  low: '#94a3b8',
  medium: '#f59e0b',
  high: '#ef4444',
}

function formatDueDate(dateStr: string): { label: string; overdue: boolean } {
  const due = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86400000)

  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true }
  if (diff === 0) return { label: 'Today', overdue: false }
  if (diff === 1) return { label: 'Tomorrow', overdue: false }
  if (diff <= 7) return { label: `In ${diff}d`, overdue: false }
  return {
    label: due.toLocaleDateString([], { month: 'short', day: 'numeric' }),
    overdue: false,
  }
}

// ── Status toggle button ─────────────────────────────────────────────────────

function StatusToggle({ task, onChange }: { task: LocalNote; onChange: (t: LocalNote) => void }) {
  const status = task.metadata.status as Status
  const cycle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next: Status = status === 'open' ? 'in-progress' : status === 'in-progress' ? 'done' : 'open'
    onChange({ ...task, metadata: { ...task.metadata, status: next }, updatedAt: new Date().toISOString(), syncStatus: 'pending' })
  }
  return (
    <button className={s.statusToggle} onClick={cycle} title={`${STATUS_LABEL[status]} — click to advance`}>
      {status === 'done'
        ? <CheckSquare size={15} style={{ color: 'var(--color-success)' }} />
        : status === 'in-progress'
        ? <Circle size={15} style={{ color: 'var(--color-warning)', fill: 'var(--color-warning)' }} />
        : <Circle size={15} style={{ color: 'var(--color-text-muted)' }} />}
    </button>
  )
}

// ── Task row (list view) ─────────────────────────────────────────────────────

function TaskRow({
  task,
  allNotes,
  onOpen,
  onToggle,
}: {
  task: LocalNote
  allNotes: LocalNote[]
  onOpen: (id: string) => void
  onToggle: (t: LocalNote) => void
}) {
  const status = task.metadata.status as Status
  const priority = task.metadata.priority as Priority | undefined
  const dueDate = task.metadata.dueDate as string | undefined
  const assigneeName = task.metadata.assigneeName as string | undefined
  const linkedCount = task.linkedNoteIds.length
  const isDone = status === 'done'

  const due = dueDate ? formatDueDate(dueDate) : null

  return (
    <div className={`${s.taskRow} ${isDone ? s.taskRowDone : ''}`} onClick={() => onOpen(task.id)}>
      <StatusToggle task={task} onChange={onToggle} />

      {priority && (
        <span className={s.prioDot} style={{ background: PRIO_COLOR[priority] }} title={priority} />
      )}

      <span className={`${s.taskTitle} ${isDone ? s.taskTitleDone : ''}`}>
        {task.title || 'Untitled'}
      </span>

      <span className={s.taskMeta}>
        {assigneeName && (
          <span className={s.assigneeChip}>
            <User size={10} />
            {assigneeName}
          </span>
        )}
        {due && (
          <span className={`${s.dueChip} ${due.overdue ? s.dueOverdue : ''}`}>
            <CalendarDays size={10} />
            {due.label}
          </span>
        )}
        {linkedCount > 0 && (
          <span className={s.linkedChip}>
            <ChevronRight size={10} />
            {linkedCount} linked
          </span>
        )}
      </span>
    </div>
  )
}

// ── Kanban card ──────────────────────────────────────────────────────────────

function KanbanCard({
  task,
  onOpen,
  onToggle,
  onDragStart,
}: {
  task: LocalNote
  onOpen: (id: string) => void
  onToggle: (t: LocalNote) => void
  onDragStart: (id: string) => void
}) {
  const priority = task.metadata.priority as Priority | undefined
  const dueDate = task.metadata.dueDate as string | undefined
  const assigneeName = task.metadata.assigneeName as string | undefined
  const due = dueDate ? formatDueDate(dueDate) : null

  return (
    <div
      className={s.kanbanCard}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', task.id)
        onDragStart(task.id)
      }}
    >
      <div className={s.kanbanCardTop}>
        <StatusToggle task={task} onChange={onToggle} />
        {priority && priority !== 'medium' && (
          <Flag size={11} style={{ color: PRIO_COLOR[priority], flexShrink: 0 }} />
        )}
        <button className={s.kanbanTitleBtn} onClick={() => onOpen(task.id)}>
          {task.title || 'Untitled'}
        </button>
      </div>
      {(assigneeName || due) && (
        <div className={s.kanbanCardMeta}>
          {assigneeName && <span className={s.assigneeChip}><User size={9} />{assigneeName}</span>}
          {due && <span className={`${s.dueChip} ${due.overdue ? s.dueOverdue : ''}`}><CalendarDays size={9} />{due.label}</span>}
        </div>
      )}
    </div>
  )
}

// ── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  tasks,
  onOpen,
  onToggle,
  onAdd,
  onDrop,
  onDragStart,
}: {
  status: Status
  tasks: LocalNote[]
  onOpen: (id: string) => void
  onToggle: (t: LocalNote) => void
  onAdd: (status: Status) => void
  onDrop: (taskId: string, toStatus: Status) => void
  onDragStart: (id: string) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={`${s.kanbanCol} ${dragOver ? s.kanbanColDragOver : ''}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const taskId = e.dataTransfer.getData('text/plain')
        if (taskId) onDrop(taskId, status)
      }}
    >
      <div className={s.kanbanColHeader}>
        <span className={s.kanbanColTitle}>{STATUS_LABEL[status]}</span>
        <span className={s.kanbanColCount}>{tasks.length}</span>
        {status !== 'cancelled' && (
          <button className={s.kanbanAddBtn} onClick={() => onAdd(status)} title="Add task">
            <Plus size={12} />
          </button>
        )}
      </div>
      <div className={s.kanbanCards}>
        {tasks.map((t) => (
          <KanbanCard key={t.id} task={t} onOpen={onOpen} onToggle={onToggle} onDragStart={onDragStart} />
        ))}
        {tasks.length === 0 && (
          <p className={`${s.kanbanEmpty} ${dragOver ? s.kanbanEmptyDragOver : ''}`}>
            {dragOver ? 'Drop here' : 'No tasks'}
          </p>
        )}
      </div>
    </div>
  )
}

// ── TasksPage ────────────────────────────────────────────────────────────────

type SortKey = 'priority' | 'dueDate' | 'updatedAt' | 'title'

const PRIO_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, undefined: 3 }
const STATUS_ORDER: Record<string, number> = { 'in-progress': 0, open: 1, done: 2, cancelled: 3 }

export function TasksPage() {
  const navigate = useNavigate()
  const allNotes = useNotesStore((st) => st.notes)
  const storeUpsert = useNotesStore((st) => st.upsertNote)

  const [view, setView] = useState<ViewMode>('list')
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('priority')
  const [showModal, setShowModal] = useState(false)
  const [modalStatus, setModalStatus] = useState<Status>('open')
  const [query, setQuery] = useState('')

  const tasks = useMemo(() =>
    allNotes.filter((n) => !n.deletedAt && n.type === 'task'),
  [allNotes])

  const assignees = useMemo(() => {
    const seen = new Map<string, string>()
    for (const t of tasks) {
      const id = t.metadata.assigneeId as string | undefined
      const name = t.metadata.assigneeName as string | undefined
      if (id && name) seen.set(id, name)
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [tasks])

  const filtered = useMemo(() => {
    let result = tasks
    if (filterStatus !== 'all') result = result.filter((t) => t.metadata.status === filterStatus)
    if (filterPriority !== 'all') result = result.filter((t) => t.metadata.priority === filterPriority)
    if (filterAssignee !== 'all') result = result.filter((t) => t.metadata.assigneeId === filterAssignee)
    if (query) {
      const q = query.toLowerCase()
      result = result.filter((t) => t.title.toLowerCase().includes(q))
    }
    return [...result].sort((a, b) => {
      if (sortKey === 'priority') {
        const pd = (PRIO_ORDER[a.metadata.priority as string] ?? 3) - (PRIO_ORDER[b.metadata.priority as string] ?? 3)
        if (pd !== 0) return pd
        return (STATUS_ORDER[a.metadata.status as string] ?? 4) - (STATUS_ORDER[b.metadata.status as string] ?? 4)
      }
      if (sortKey === 'dueDate') {
        const da = a.metadata.dueDate ? new Date(a.metadata.dueDate as string).getTime() : Infinity
        const db = b.metadata.dueDate ? new Date(b.metadata.dueDate as string).getTime() : Infinity
        return da - db
      }
      if (sortKey === 'updatedAt') return b.updatedAt.localeCompare(a.updatedAt)
      return a.title.localeCompare(b.title)
    })
  }, [tasks, filterStatus, filterPriority, filterAssignee, query, sortKey])

  const kanbanGroups = useMemo(() => {
    const cols: Status[] = ['open', 'in-progress', 'done', 'cancelled']
    return cols.map((status) => ({
      status,
      tasks: filtered.filter((t) => t.metadata.status === status),
    }))
  }, [filtered])

  const handleToggle = useCallback(async (updated: LocalNote) => {
    await upsertNote(updated)
    storeUpsert(updated)
  }, [storeUpsert])

  const handleOpen = useCallback((id: string) => navigate(`/notes/${id}`), [navigate])

  const handleAddForStatus = (status: Status) => {
    setModalStatus(status)
    setShowModal(true)
  }

  const handleDrop = useCallback(async (taskId: string, toStatus: Status) => {
    const task = allNotes.find((n) => n.id === taskId)
    if (!task || task.metadata.status === toStatus) return
    const updated: LocalNote = {
      ...task,
      metadata: { ...task.metadata, status: toStatus },
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    }
    await upsertNote(updated)
    storeUpsert(updated)
  }, [allNotes, storeUpsert])

  const handleDragStart = useCallback((_id: string) => {}, [])

  const stats = useMemo(() => ({
    open: tasks.filter((t) => t.metadata.status === 'open').length,
    inProgress: tasks.filter((t) => t.metadata.status === 'in-progress').length,
    done: tasks.filter((t) => t.metadata.status === 'done').length,
  }), [tasks])

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Tasks</h1>
          <div className={s.statsRow}>
            <span className={s.stat}><Circle size={10} style={{ color: 'var(--color-text-muted)' }} />{stats.open} open</span>
            <span className={s.stat}><Circle size={10} style={{ color: 'var(--color-warning)', fill: 'var(--color-warning)' }} />{stats.inProgress} in progress</span>
            <span className={s.stat}><CheckSquare size={10} style={{ color: 'var(--color-success)' }} />{stats.done} done</span>
          </div>
        </div>
        <div className={s.headerActions}>
          <button className={s.viewBtn} onClick={() => setView('list')} data-active={view === 'list'} title="List view">
            <List size={14} />
          </button>
          <button className={s.viewBtn} onClick={() => setView('kanban')} data-active={view === 'kanban'} title="Kanban view">
            <LayoutGrid size={14} />
          </button>
          <button className={s.addBtn} onClick={() => { setModalStatus('open'); setShowModal(true) }}>
            <Plus size={14} />
            New Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={s.filters}>
        <input
          className={s.searchInput}
          placeholder="Search tasks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className={s.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as Status | 'all')}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className={s.select} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value as Priority | 'all')}>
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {assignees.length > 0 && (
          <select className={s.select} value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
            <option value="all">All assignees</option>
            {assignees.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        <button
          className={s.sortBtn}
          onClick={() => setSortKey((k) => {
            const cycle: SortKey[] = ['priority', 'dueDate', 'updatedAt', 'title']
            return cycle[(cycle.indexOf(k) + 1) % cycle.length]
          })}
          title={`Sort: ${sortKey}`}
        >
          <ArrowUpDown size={13} />
          {sortKey === 'priority' ? 'Priority' : sortKey === 'dueDate' ? 'Due date' : sortKey === 'updatedAt' ? 'Updated' : 'Title'}
        </button>
      </div>

      {/* Content */}
      {view === 'list' ? (
        <div className={s.listContainer}>
          {filtered.length === 0 ? (
            <div className={s.empty}>
              <CheckSquare size={36} strokeWidth={1} style={{ opacity: 0.3 }} />
              <span>No tasks found</span>
            </div>
          ) : (
            filtered.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                allNotes={allNotes}
                onOpen={handleOpen}
                onToggle={handleToggle}
              />
            ))
          )}
        </div>
      ) : (
        <div className={s.kanbanBoard}>
          {kanbanGroups.map(({ status, tasks: colTasks }) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={colTasks}
              onOpen={handleOpen}
              onToggle={handleToggle}
              onAdd={handleAddForStatus}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
            />
          ))}
        </div>
      )}

      {showModal && (
        <QuickTaskModal
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
