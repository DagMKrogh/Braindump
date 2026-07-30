import { useMemo, useState } from 'react'
import { CheckSquare, Plus, Circle, ExternalLink, X } from 'lucide-react'
import { useNotesStore } from '../../stores/notesStore'
import { upsertNote } from '../../lib/localStore'
import { QuickTaskModal } from './QuickTaskModal'
import type { LocalNote } from '@braindump/shared'

interface Props {
  noteId: string
  onNavigate: (id: string) => void
}

type Status = 'open' | 'in-progress' | 'done' | 'cancelled'

const PRIO_COLOR: Record<string, string> = {
  high: 'var(--color-error)',
  medium: 'var(--color-warning)',
  low: 'var(--color-text-muted)',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'done') return <CheckSquare size={12} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
  if (status === 'in-progress') return <Circle size={12} style={{ color: 'var(--color-warning)', fill: 'var(--color-warning)', flexShrink: 0 }} />
  return <Circle size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
}

export function LinkedTasksPanel({ noteId, onNavigate }: Props) {
  const allNotes = useNotesStore((st) => st.notes)
  const storeUpsert = useNotesStore((st) => st.upsertNote)
  const [showModal, setShowModal] = useState(false)
  const [justCreated, setJustCreated] = useState<LocalNote | null>(null)

  const linkedTasks = useMemo(() =>
    allNotes.filter(
      (n) => !n.deletedAt && n.type === 'task' && n.linkedNoteIds.includes(noteId)
    ).sort((a, b) => {
      const order: Record<string, number> = { 'in-progress': 0, open: 1, done: 2, cancelled: 3 }
      return (order[a.metadata.status as string] ?? 4) - (order[b.metadata.status as string] ?? 4)
    }),
  [allNotes, noteId])

  const handleToggle = async (task: LocalNote) => {
    const next: Status = task.metadata.status === 'open'
      ? 'in-progress' : task.metadata.status === 'in-progress'
      ? 'done' : 'open'
    const updated = { ...task, metadata: { ...task.metadata, status: next }, updatedAt: new Date().toISOString(), syncStatus: 'pending' as const }
    await upsertNote(updated)
    storeUpsert(updated)
  }

  const containerStyle: React.CSSProperties = {
    flexShrink: 0,
    borderTop: '1px solid var(--color-border)',
    padding: '0.4rem 1.5rem',
    overflowY: 'auto',
    maxHeight: 220,
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem',
  }

  const addBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.2rem',
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '0.68rem', color: 'var(--color-accent)', padding: '0.15rem 0.35rem',
    borderRadius: 'var(--radius)',
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <CheckSquare size={11} style={{ color: 'var(--color-text-muted)' }} />
        <span style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', flex: 1 }}>
          Linked tasks{linkedTasks.length > 0 ? ` (${linkedTasks.length})` : ''}
        </span>
        <button style={addBtnStyle} onClick={() => setShowModal(true)}>
          <Plus size={10} /> Add
        </button>
      </div>

      {/* Just-created toast */}
      {justCreated && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'color-mix(in srgb, var(--color-success) 12%, var(--color-surface))',
          border: '1px solid color-mix(in srgb, var(--color-success) 30%, var(--color-border))',
          borderRadius: 'var(--radius)', padding: '0.3rem 0.6rem',
          marginBottom: '0.3rem', fontSize: '0.75rem',
        }}>
          <CheckSquare size={11} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
          <span style={{ flex: 1, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            "{justCreated.title || 'Untitled'}" created
          </span>
          <button
            onClick={() => onNavigate(justCreated.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontSize: '0.72rem', fontWeight: 600, flexShrink: 0 }}
          >
            <ExternalLink size={10} /> Open
          </button>
          <button
            onClick={() => setJustCreated(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}
          >
            <X size={11} />
          </button>
        </div>
      )}

      {linkedTasks.length === 0 && !justCreated && (
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0.2rem 0' }}>No linked tasks</p>
      )}

      {linkedTasks.map((task) => {
        const status = task.metadata.status as string
        const priority = task.metadata.priority as string | undefined
        const isDone = status === 'done'
        return (
          <div
            key={task.id}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', opacity: isDone ? 0.55 : 1 }}
          >
            <button
              onClick={() => handleToggle(task)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
            >
              <StatusIcon status={status} />
            </button>
            {priority && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIO_COLOR[priority] ?? 'transparent', flexShrink: 0 }} />
            )}
            <button
              onClick={() => onNavigate(task.id)}
              style={{
                flex: 1, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer',
                fontSize: '0.8rem', color: 'var(--color-text)',
                textDecoration: isDone ? 'line-through' : 'none',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {task.title || 'Untitled'}
            </button>
            {!!task.metadata.assigneeName && (
              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                {String(task.metadata.assigneeName)}
              </span>
            )}
          </div>
        )
      })}

      {showModal && (
        <QuickTaskModal
          linkedNoteId={noteId}
          onClose={() => setShowModal(false)}
          onCreated={(task) => { setJustCreated(task); setShowModal(false) }}
        />
      )}
    </div>
  )
}
