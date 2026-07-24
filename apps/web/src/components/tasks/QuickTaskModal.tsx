import { useEffect, useRef, useState, useMemo } from 'react'
import { X, User } from 'lucide-react'
import { useNotesStore } from '../../stores/notesStore'
import { upsertNote } from '../../lib/localStore'
import type { LocalNote } from '@braindump/shared'
import s from '../../styles/quickTask.module.css'

interface Props {
  /** If set, the created task will be linked to this note */
  linkedNoteId?: string | null
  onClose: () => void
  onCreated?: (task: LocalNote) => void
}

export function QuickTaskModal({ linkedNoteId, onClose, onCreated }: Props) {
  const allNotes = useNotesStore((st) => st.notes)
  const storeUpsert = useNotesStore((st) => st.upsertNote)

  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [assigneeQuery, setAssigneeQuery] = useState('')
  const [selectedAssignee, setSelectedAssignee] = useState<LocalNote | null>(null)
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [assigneeIdx, setAssigneeIdx] = useState(-1)
  const [saving, setSaving] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  // Focus trap — Tab cycles within the modal
  useEffect(() => {
    const modal = modalRef.current
    if (!modal) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Contacts from the notes store
  const contacts = useMemo(() =>
    allNotes.filter((n) => !n.deletedAt && n.type === 'contact'),
  [allNotes])

  const filteredContacts = useMemo(() => {
    const q = assigneeQuery.toLowerCase()
    return q ? contacts.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 8) : contacts.slice(0, 8)
  }, [contacts, assigneeQuery])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleCreate = async () => {
    const trimmed = title.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const id = crypto.randomUUID()
      const task: LocalNote = {
        id,
        userId: 'local',
        type: 'task',
        title: trimmed,
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        metadata: {
          status: 'open',
          priority,
          ...(dueDate ? { dueDate } : {}),
          ...(selectedAssignee ? { assigneeId: selectedAssignee.id, assigneeName: selectedAssignee.title } : {}),
        },
        tags: [],
        collectionId: null,
        topicId: null,
        linkedNoteIds: linkedNoteId ? [linkedNoteId] : [],
        isPinned: false,
        isEncrypted: false,
        dateRef: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending',
        localOnly: true,
      }
      await upsertNote(task)
      storeUpsert(task)
      onCreated?.(task)
      onClose()
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreate() }
  }

  return (
    <div className={s.overlay}>
      <div ref={modalRef} className={s.modal} role="dialog" aria-label="New task">
        {/* Header */}
        <div className={s.modalHeader}>
          <span className={s.modalTitle}>New Task</span>
          {linkedNoteId && (
            <span className={s.linkedBadge}>Linked to current note</span>
          )}
          <button className={s.closeBtn} onClick={onClose}><X size={14} /></button>
        </div>

        {/* Title */}
        <div className={s.field}>
          <input
            ref={titleRef}
            className={s.titleInput}
            placeholder="Task title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Row: priority + due date */}
        <div className={s.row}>
          <div className={s.field}>
            <label className={s.label}>Priority</label>
            <div className={s.priorityGroup}>
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  className={`${s.priorityBtn} ${priority === p ? s.priorityBtnActive : ''} ${s[`prio_${p}`]}`}
                  onClick={() => setPriority(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className={s.field}>
            <label className={s.label}>Due date</label>
            <input
              type="date"
              className={s.dateInput}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        {/* Assignee */}
        <div className={s.field} style={{ position: 'relative' }}>
          <label className={s.label}>Assignee</label>
          {selectedAssignee ? (
            <div className={s.assigneeChip}>
              <User size={11} />
              <span>{selectedAssignee.title}</span>
              <button className={s.chipRemove} onClick={() => { setSelectedAssignee(null); setAssigneeQuery('') }}>
                <X size={10} />
              </button>
            </div>
          ) : (
            <input
              className={s.assigneeInput}
              placeholder="Search contacts…"
              value={assigneeQuery}
              onChange={(e) => { setAssigneeQuery(e.target.value); setAssigneeOpen(true); setAssigneeIdx(-1) }}
              onFocus={() => setAssigneeOpen(true)}
              onKeyDown={(e) => {
                if (!assigneeOpen || filteredContacts.length === 0) return
                if (e.key === 'ArrowDown') { e.preventDefault(); setAssigneeIdx(i => Math.min(i + 1, filteredContacts.length - 1)) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setAssigneeIdx(i => Math.max(i - 1, -1)) }
                else if (e.key === 'Enter' && assigneeIdx >= 0) {
                  e.preventDefault()
                  const c = filteredContacts[assigneeIdx]
                  if (c) { setSelectedAssignee(c); setAssigneeOpen(false); setAssigneeQuery(''); setAssigneeIdx(-1) }
                }
                else if (e.key === 'Escape') { setAssigneeOpen(false); setAssigneeIdx(-1) }
              }}
            />
          )}
          {assigneeOpen && !selectedAssignee && filteredContacts.length > 0 && (
            <div className={s.assigneeDropdown}>
              {filteredContacts.map((c, i) => (
                <button
                  key={c.id}
                  className={`${s.assigneeOption} ${i === assigneeIdx ? s.assigneeOptionActive : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); setSelectedAssignee(c); setAssigneeOpen(false); setAssigneeQuery(''); setAssigneeIdx(-1) }}
                >
                  <User size={11} />
                  {c.title}
                  {c.metadata.org && <span className={s.assigneeOrg}>{c.metadata.org as string}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={s.modalFooter}>
          <button className={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={s.createBtn}
            onClick={handleCreate}
            disabled={!title.trim() || saving}
          >
            {saving ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
