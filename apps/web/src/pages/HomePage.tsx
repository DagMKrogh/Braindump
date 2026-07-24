import React, { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckSquare, Pin, Clock, CalendarDays, TrendingUp,
  Eye, EyeOff, Plus, ChevronRight, Circle,
} from 'lucide-react'
import { useNotesStore } from '../stores/notesStore'
import { upsertNote } from '../lib/localStore'
import { getType } from '../lib/noteTypeRegistry'
import type { LocalNote } from '@braindump/shared'
import s from '../styles/home.module.css'

// ── Date helpers ────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function diffDays(target: Date, from: Date): number {
  return Math.round((startOfDay(target).getTime() - startOfDay(from).getTime()) / 86400000)
}

function getEventDate(note: LocalNote): Date | null {
  const type = getType(note.type)
  if (!type) return null
  const fieldKey = type.startTimeField ?? type.calendarDateField
  if (fieldKey) {
    const val = note.metadata[fieldKey]
    if (val) return new Date(val as string)
  }
  return null
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatRelativeDay(daysAhead: number): string {
  if (daysAhead === 1) return 'Tomorrow'
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatUpdatedAt(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  if (diff < 10080) return `${Math.floor(diff / 1440)}d ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ── Widget config ───────────────────────────────────────────────────────────

type WidgetId = 'today' | 'upcoming' | 'tasks' | 'pinned' | 'recent'

const ALL_WIDGETS: { id: WidgetId; label: string }[] = [
  { id: 'today',    label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'tasks',    label: 'Tasks' },
  { id: 'pinned',   label: 'Pinned' },
  { id: 'recent',   label: 'Recent' },
]

const STORAGE_KEY = 'braindump-home-widgets'
const DEFAULT_WIDGETS: WidgetId[] = ['today', 'upcoming', 'tasks', 'pinned', 'recent']

function loadWidgetPrefs(): WidgetId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as WidgetId[]
  } catch { /* ignore */ }
  return DEFAULT_WIDGETS
}

// ── Priority badge ──────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority || priority === 'medium') return null
  const color = priority === 'high' ? 'var(--color-error)' : 'var(--color-text-muted)'
  return (
    <span style={{ fontSize: '0.65rem', color, fontWeight: 600, textTransform: 'uppercase' }}>
      {priority}
    </span>
  )
}

// ── Note row ────────────────────────────────────────────────────────────────

function NoteRow({
  note,
  onClick,
  meta,
  action,
}: {
  note: LocalNote
  onClick: () => void
  meta?: React.ReactNode
  action?: React.ReactNode
}) {
  const type = getType(note.type)
  return (
    <div className={s.noteRow} onClick={onClick}>
      <span className={s.noteRowDot} style={{ background: type?.color ?? 'var(--color-text-muted)' }} />
      <span className={s.noteRowTitle}>{note.title || 'Untitled'}</span>
      {meta && <span className={s.noteRowMeta}>{meta}</span>}
      {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
      <ChevronRight size={12} className={s.noteRowChevron} />
    </div>
  )
}

// ── Widget shell ────────────────────────────────────────────────────────────

function Widget({
  icon,
  title,
  count,
  children,
  empty,
}: {
  icon: React.ReactNode
  title: string
  count?: number
  children: React.ReactNode
  empty?: string
}) {
  const hasContent = React.Children.count(children) > 0 && count !== 0
  return (
    <div className={s.widget}>
      <div className={s.widgetHeader}>
        <span className={s.widgetIcon}>{icon}</span>
        <span className={s.widgetTitle}>{title}</span>
        {count !== undefined && count > 0 && <span className={s.widgetCount}>{count}</span>}
      </div>
      <div className={s.widgetBody}>
        {hasContent ? children : <p className={s.widgetEmpty}>{empty ?? 'Nothing here'}</p>}
      </div>
    </div>
  )
}

// ── Today widget ────────────────────────────────────────────────────────────

function TodayWidget({ notes, onOpen }: { notes: LocalNote[]; onOpen: (id: string) => void }) {
  const sorted = useMemo(() =>
    [...notes].sort((a, b) => (getEventDate(a)?.getTime() ?? 0) - (getEventDate(b)?.getTime() ?? 0)),
  [notes])

  return (
    <Widget icon={<CalendarDays size={14} />} title="Today" count={notes.length} empty="Nothing scheduled for today">
      {sorted.map((note) => {
        const type = getType(note.type)
        const dateField = type?.startTimeField ?? type?.calendarDateField
        const dateVal = dateField ? note.metadata[dateField] as string | undefined : undefined
        return (
          <NoteRow
            key={note.id}
            note={note}
            onClick={() => onOpen(note.id)}
            meta={dateVal && type?.startTimeField ? formatTime(dateVal) : undefined}
          />
        )
      })}
    </Widget>
  )
}

// ── Upcoming widget ─────────────────────────────────────────────────────────

function UpcomingWidget({
  groups,
  onOpen,
}: {
  groups: { daysAhead: number; notes: LocalNote[] }[]
  onOpen: (id: string) => void
}) {
  const total = groups.reduce((n, g) => n + g.notes.length, 0)
  return (
    <Widget icon={<TrendingUp size={14} />} title="Upcoming (7 days)" count={total} empty="Nothing coming up this week">
      {groups.map(({ daysAhead, notes }) => (
        <div key={daysAhead} className={s.upcomingDay}>
          <div className={s.upcomingDayLabel}>{formatRelativeDay(daysAhead)}</div>
          {notes.map((note) => <NoteRow key={note.id} note={note} onClick={() => onOpen(note.id)} />)}
        </div>
      ))}
    </Widget>
  )
}

// ── Task status toggle ──────────────────────────────────────────────────────

function TaskStatusButton({ note, onChange }: { note: LocalNote; onChange: (n: LocalNote) => void }) {
  const status = note.metadata.status as string | undefined
  const cycle = () => {
    const next = status === 'open' ? 'in-progress' : status === 'in-progress' ? 'done' : 'open'
    onChange({ ...note, metadata: { ...note.metadata, status: next }, updatedAt: new Date().toISOString(), syncStatus: 'pending' })
  }
  return (
    <button className={s.taskToggle} onClick={cycle} title={`Status: ${status} — click to advance`}>
      {status === 'done'
        ? <CheckSquare size={14} style={{ color: 'var(--color-success)' }} />
        : status === 'in-progress'
        ? <Circle size={14} style={{ color: 'var(--color-warning)', fill: 'var(--color-warning)' }} />
        : <Circle size={14} style={{ color: 'var(--color-text-muted)' }} />}
    </button>
  )
}

// ── Tasks widget ────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<string, number> = { 'in-progress': 0, open: 1 }
const PRIO_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

function TasksWidget({
  notes,
  onOpen,
  onToggle,
}: {
  notes: LocalNote[]
  onOpen: (id: string) => void
  onToggle: (note: LocalNote) => void
}) {
  const sorted = useMemo(() =>
    [...notes].sort((a, b) => {
      const sd = (STATUS_ORDER[a.metadata.status as string] ?? 2) - (STATUS_ORDER[b.metadata.status as string] ?? 2)
      if (sd !== 0) return sd
      const pd = (PRIO_ORDER[a.metadata.priority as string] ?? 1) - (PRIO_ORDER[b.metadata.priority as string] ?? 1)
      if (pd !== 0) return pd
      const da = a.metadata.dueDate ? new Date(a.metadata.dueDate as string).getTime() : Infinity
      const db = b.metadata.dueDate ? new Date(b.metadata.dueDate as string).getTime() : Infinity
      return da - db
    }), [notes])

  return (
    <Widget icon={<CheckSquare size={14} />} title="Open Tasks" count={notes.length} empty="No open tasks">
      {sorted.map((note) => (
        <NoteRow
          key={note.id}
          note={note}
          onClick={() => onOpen(note.id)}
          meta={<PriorityBadge priority={note.metadata.priority as string} />}
          action={<TaskStatusButton note={note} onChange={onToggle} />}
        />
      ))}
    </Widget>
  )
}

// ── Pinned widget ───────────────────────────────────────────────────────────

function PinnedWidget({ notes, onOpen }: { notes: LocalNote[]; onOpen: (id: string) => void }) {
  return (
    <Widget icon={<Pin size={14} />} title="Pinned" count={notes.length} empty="No pinned notes">
      {notes.map((note) => (
        <NoteRow key={note.id} note={note} onClick={() => onOpen(note.id)} meta={formatUpdatedAt(note.updatedAt)} />
      ))}
    </Widget>
  )
}

// ── Recent widget ───────────────────────────────────────────────────────────

function RecentWidget({ notes, onOpen }: { notes: LocalNote[]; onOpen: (id: string) => void }) {
  return (
    <Widget icon={<Clock size={14} />} title="Recently Updated" count={notes.length} empty="No notes yet">
      {notes.map((note) => (
        <NoteRow key={note.id} note={note} onClick={() => onOpen(note.id)} meta={formatUpdatedAt(note.updatedAt)} />
      ))}
    </Widget>
  )
}

// ── Widget toggle bar ───────────────────────────────────────────────────────

function WidgetToggleBar({ enabled, onChange }: { enabled: WidgetId[]; onChange: (ids: WidgetId[]) => void }) {
  const toggle = (id: WidgetId) => {
    const next = enabled.includes(id) ? enabled.filter((w) => w !== id) : [...enabled, id]
    onChange(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  return (
    <div className={s.toggleBar}>
      {ALL_WIDGETS.map(({ id, label }) => {
        const on = enabled.includes(id)
        return (
          <button key={id} className={`${s.toggleBtn} ${on ? s.toggleBtnOn : ''}`} onClick={() => toggle(id)}>
            {on ? <Eye size={11} /> : <EyeOff size={11} />}
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── HomePage ────────────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate()
  const allNotes = useNotesStore((st) => st.notes)
  const storeUpsert = useNotesStore((st) => st.upsertNote)
  const [enabledWidgets, setEnabledWidgets] = useState<WidgetId[]>(loadWidgetPrefs)

  const today = useMemo(() => new Date(), [])
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateLabel = today.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  const notes = useMemo(() => allNotes.filter((n) => !n.deletedAt), [allNotes])

  const todayNotes = useMemo(() =>
    notes.filter((n) => {
      const d = getEventDate(n)
      return d !== null && diffDays(d, today) === 0
    }), [notes, today])

  const upcomingGroups = useMemo(() => {
    const byDay = new Map<number, LocalNote[]>()
    for (const note of notes) {
      const d = getEventDate(note)
      if (!d) continue
      const diff = diffDays(d, today)
      if (diff < 1 || diff > 7) continue
      if (!byDay.has(diff)) byDay.set(diff, [])
      byDay.get(diff)!.push(note)
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([daysAhead, ns]) => ({
        daysAhead,
        notes: [...ns].sort((a, b) => (getEventDate(a)?.getTime() ?? 0) - (getEventDate(b)?.getTime() ?? 0)),
      }))
  }, [notes, today])

  const pendingTasks = useMemo(() =>
    notes.filter((n) => n.type === 'task' && n.metadata.status !== 'done' && n.metadata.status !== 'cancelled'),
  [notes])

  const pinnedNotes = useMemo(() => notes.filter((n) => n.isPinned), [notes])

  const recentNotes = useMemo(() =>
    [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8),
  [notes])

  const handleOpen = useCallback((id: string) => navigate(`/notes/${id}`), [navigate])

  const handleToggleTask = useCallback(async (updated: LocalNote) => {
    await upsertNote(updated)
    storeUpsert(updated)
  }, [storeUpsert])

  const show = (id: WidgetId) => enabledWidgets.includes(id)

  const handleQuickCapture = async () => {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const note: LocalNote = {
      id, userId: 'local', type: 'scratch',
      title: '', content: { type: 'doc', content: [{ type: 'paragraph' }] },
      metadata: {}, tags: [], collectionId: null, topicId: null,
      linkedNoteIds: [], isPinned: false, isEncrypted: false, dateRef: null,
      createdAt: now, updatedAt: now, deletedAt: null,
      syncStatus: 'pending', localOnly: true,
    }
    try {
      await upsertNote(note)
      storeUpsert(note)
      navigate(`/notes/${id}`)
    } catch (err) {
      console.error('Quick capture failed:', err)
    }
  }

  const weekTotal = upcomingGroups.reduce((n, g) => n + g.notes.length, 0)

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.header}>
        <div>
          <h1 className={s.greeting}>{greeting}</h1>
          <p className={s.dateLabel}>{dateLabel}</p>
        </div>
        <div className={s.headerRight}>
          <WidgetToggleBar enabled={enabledWidgets} onChange={setEnabledWidgets} />
          <button className={s.captureBtn} onClick={handleQuickCapture}>
            <Plus size={14} />
            Quick Note
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className={s.statsRow}>
        {[
          { value: notes.length, label: 'Notes' },
          { value: pendingTasks.length, label: 'Open tasks' },
          { value: todayNotes.length, label: 'Today' },
          { value: weekTotal, label: 'This week' },
          { value: pinnedNotes.length, label: 'Pinned' },
        ].map(({ value, label }) => (
          <div key={label} className={s.stat}>
            <span className={s.statValue}>{value}</span>
            <span className={s.statLabel}>{label}</span>
          </div>
        ))}
      </div>

      {/* Widgets */}
      <div className={s.grid}>
        {show('today') && (
          <div className={s.spanFull}>
            <TodayWidget notes={todayNotes} onOpen={handleOpen} />
          </div>
        )}
        {show('upcoming') && <UpcomingWidget groups={upcomingGroups} onOpen={handleOpen} />}
        {show('tasks') && <TasksWidget notes={pendingTasks} onOpen={handleOpen} onToggle={handleToggleTask} />}
        {show('pinned') && <PinnedWidget notes={pinnedNotes} onOpen={handleOpen} />}
        {show('recent') && <RecentWidget notes={recentNotes} onOpen={handleOpen} />}
      </div>
    </div>
  )
}
