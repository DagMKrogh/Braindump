import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, CalendarDays, Search, Settings, Plus, CheckSquare, LayoutDashboard } from 'lucide-react'
import type { LocalNote, NoteType } from '@braindump/shared'
import { useUIStore } from '../../stores/uiStore'
import { useNotesStore } from '../../stores/notesStore'
import { getAllTypes } from '../../lib/noteTypeRegistry'
import { createQuickNote } from '../../hooks/useGlobalShortcuts'

type PaletteItem =
  | { kind: 'nav'; id: string; label: string; icon: React.ReactNode; path: string }
  | { kind: 'action'; id: string; label: string; icon: React.ReactNode; actionKey: string }
  | { kind: 'create'; id: string; label: string; type: NoteType; color: string }
  | { kind: 'note'; id: string; label: string; note: LocalNote; color: string }

const NAV_ITEMS: PaletteItem[] = [
  { kind: 'nav', id: 'nav-home', label: 'Go to Home', icon: <LayoutDashboard size={14} />, path: '/home' },
  { kind: 'nav', id: 'nav-tasks', label: 'Go to Tasks', icon: <CheckSquare size={14} />, path: '/tasks' },
  { kind: 'nav', id: 'nav-notes', label: 'Go to Notes', icon: <FileText size={14} />, path: '/notes' },
  { kind: 'nav', id: 'nav-calendar', label: 'Go to Calendar', icon: <CalendarDays size={14} />, path: '/calendar' },
  { kind: 'nav', id: 'nav-search', label: 'Go to Search', icon: <Search size={14} />, path: '/search' },
  { kind: 'nav', id: 'nav-settings', label: 'Go to Settings', icon: <Settings size={14} />, path: '/settings' },
]

const BASE_ACTION_ITEMS: PaletteItem[] = [
  { kind: 'action', id: 'action-new-task', label: 'New Task…', icon: <CheckSquare size={14} />, actionKey: 'new-task' },
]

function buildItems(query: string, notes: LocalNote[], activeNoteId: string | null): PaletteItem[] {
  const q = query.toLowerCase().trim()
  const allTypes = getAllTypes()
  const nonCalendarTypes = allTypes.filter(t => !t.isCalendarEvent)
  const typeColorMap = new Map(allTypes.map(t => [t.id, t.color]))

  const allActions: PaletteItem[] = activeNoteId
    ? [
        ...BASE_ACTION_ITEMS,
        { kind: 'action', id: 'action-new-linked-task', label: 'New Linked Task…', icon: <CheckSquare size={14} />, actionKey: 'new-linked-task' },
      ]
    : BASE_ACTION_ITEMS
  const actionItems = allActions.filter(it => !q || it.label.toLowerCase().includes(q))
  const createItems: PaletteItem[] = nonCalendarTypes
    .filter(t => t.id !== 'task' && (!q || `new ${t.label}`.toLowerCase().includes(q)))
    .map(t => ({ kind: 'create', id: `create-${t.id}`, label: `New ${t.label}`, type: t.id as NoteType, color: t.color }))
  const noteItems: PaletteItem[] = notes
    .filter(n => !q || n.title.toLowerCase().includes(q))
    .slice(0, 20)
    .map(n => ({ kind: 'note', id: `note-${n.id}`, label: n.title || 'Untitled', note: n, color: typeColorMap.get(n.type) ?? '#6366f1' }))

  const navItems = NAV_ITEMS.filter(it => !q || it.label.toLowerCase().includes(q))

  return [...navItems, ...actionItems, ...createItems, ...noteItems]
}

export function CommandPalette() {
  const navigate = useNavigate()
  const { commandPaletteOpen, setCommandPaletteOpen, setQuickTaskOpen } = useUIStore()
  const notes = useNotesStore(st => st.notes)
  const activeNoteId = useNotesStore(st => st.activeNoteId)
  const { upsertNote: storeUpsert, setActiveNoteId } = useNotesStore()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => buildItems(query, notes, activeNoteId), [query, notes, activeNoteId])

  // Reset when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [commandPaletteOpen])

  // Keep selection in bounds when items change
  useEffect(() => {
    setSelectedIdx(idx => Math.min(idx, Math.max(0, items.length - 1)))
  }, [items.length])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  if (!commandPaletteOpen) return null

  function close() { setCommandPaletteOpen(false) }

  function execute(item: PaletteItem) {
    close()
    if (item.kind === 'nav') {
      navigate(item.path)
    } else if (item.kind === 'action') {
      if (item.actionKey === 'new-task') setQuickTaskOpen(true)
      else if (item.actionKey === 'new-linked-task') setQuickTaskOpen(true, activeNoteId)
    } else if (item.kind === 'create') {
      createQuickNote(item.type, storeUpsert, setActiveNoteId)
        .then(id => navigate(`/notes/${id}`))
        .catch(console.error)
    } else {
      setActiveNoteId(item.note.id)
      navigate(`/notes/${item.note.id}`)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const item = items[selectedIdx]; if (item) execute(item) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
  }

  // Group items for section labels
  let lastKind: string | null = null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
      }}
      onClick={close}
    >
      <div
        style={{
          width: '100%', maxWidth: 580,
          background: 'var(--color-surface)', borderRadius: 8,
          border: '1px solid var(--color-border)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          maxHeight: '65vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', gap: '0.5rem' }}>
          <Search size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search notes, actions, or create..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: '0.9375rem', color: 'var(--color-text)',
            }}
          />
          <kbd style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '0.1rem 0.4rem' }}>
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
          {items.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No results
            </div>
          )}
          {items.map((item, idx) => {
            const showSection = item.kind !== lastKind
            lastKind = item.kind
            const isSelected = idx === selectedIdx
            const SECTION_LABELS: Record<string, string> = { nav: 'Navigate', action: 'Actions', create: 'Create', note: 'Open note' }
            const sectionLabel = SECTION_LABELS[item.kind] ?? item.kind

            return (
              <div key={item.id}>
                {showSection && (
                  <div style={{ padding: '0.5rem 1rem 0.25rem', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
                    {sectionLabel}
                  </div>
                )}
                <button
                  data-idx={idx}
                  onClick={() => execute(item)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.625rem',
                    width: '100%', padding: '0.5rem 1rem',
                    background: isSelected ? 'var(--color-surface-2)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    color: 'var(--color-text)', fontSize: '0.875rem',
                  }}
                >
                  {(item.kind === 'nav' || item.kind === 'action') && (
                    <span style={{ color: 'var(--color-text-muted)' }}>{item.icon}</span>
                  )}
                  {item.kind === 'create' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-text-muted)' }}>
                      <Plus size={12} />
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                    </span>
                  )}
                  {item.kind === 'note' && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  )}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '0.4rem 1rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '1rem', fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
          <span><kbd style={{ fontFamily: 'inherit' }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ fontFamily: 'inherit' }}>↵</kbd> select</span>
          <span><kbd style={{ fontFamily: 'inherit' }}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
