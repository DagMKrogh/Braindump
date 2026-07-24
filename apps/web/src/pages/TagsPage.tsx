import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, ChevronDown, Hash, FileText } from 'lucide-react'
import type { LocalNote } from '@braindump/shared'
import { getAllNotes } from '../lib/localStore'
import { getType } from '../lib/noteTypeRegistry'
import s from '../styles/layout.module.css'

interface TagGroup {
  tag: string
  notes: LocalNote[]
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function TagsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusTag = searchParams.get('tag')

  const [allNotes, setAllNotes] = useState<LocalNote[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const tagRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => { getAllNotes().then(setAllNotes) }, [])

  // Group notes by tag, sorted alphabetically
  const tagGroups = useMemo<TagGroup[]>(() => {
    const map = new Map<string, LocalNote[]>()
    for (const note of allNotes) {
      for (const tag of note.tags) {
        if (!map.has(tag)) map.set(tag, [])
        map.get(tag)!.push(note)
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, notes]) => ({ tag, notes: notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }))
  }, [allNotes])

  const untagged = useMemo(() => allNotes.filter(n => n.tags.length === 0), [allNotes])

  // Auto-expand focused tag and scroll to it
  useEffect(() => {
    if (!focusTag) return
    setExpanded(prev => new Set([...prev, focusTag]))
    // Wait for render
    requestAnimationFrame(() => {
      tagRefs.current.get(focusTag)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [focusTag])

  function toggle(tag: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function toggleAll(open: boolean) {
    if (open) setExpanded(new Set(tagGroups.map(g => g.tag).concat(untagged.length > 0 ? ['__untagged__'] : [])))
    else setExpanded(new Set())
  }

  const totalNotes = allNotes.length
  const allExpanded = tagGroups.every(g => expanded.has(g.tag))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--color-border)',
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <Hash size={16} style={{ color: 'var(--color-text-muted)' }} />
        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Tags</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {tagGroups.length} tag{tagGroups.length !== 1 ? 's' : ''} · {totalNotes} note{totalNotes !== 1 ? 's' : ''}
        </span>
        <button
          className={`${s.btn} ${s.btnGhost}`}
          style={{ marginLeft: 'auto', fontSize: '0.75rem' }}
          onClick={() => toggleAll(!allExpanded)}
        >
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* Tag tree */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tagGroups.length === 0 && untagged.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            No tags yet. Add tags to your notes to see them here.
          </div>
        )}

        {tagGroups.map(({ tag, notes }) => (
          <TagSection
            key={tag}
            tag={tag}
            notes={notes}
            isExpanded={expanded.has(tag)}
            isFocused={focusTag === tag}
            onToggle={() => toggle(tag)}
            onNoteClick={id => navigate(`/notes/${id}`)}
            sectionRef={el => { if (el) tagRefs.current.set(tag, el); else tagRefs.current.delete(tag) }}
          />
        ))}

        {untagged.length > 0 && (
          <TagSection
            tag="__untagged__"
            label="Untagged"
            notes={untagged}
            isExpanded={expanded.has('__untagged__')}
            isFocused={false}
            onToggle={() => toggle('__untagged__')}
            onNoteClick={id => navigate(`/notes/${id}`)}
            sectionRef={el => { if (el) tagRefs.current.set('__untagged__', el); else tagRefs.current.delete('__untagged__') }}
          />
        )}
      </div>
    </div>
  )
}

interface TagSectionProps {
  tag: string
  label?: string
  notes: LocalNote[]
  isExpanded: boolean
  isFocused: boolean
  onToggle: () => void
  onNoteClick: (id: string) => void
  sectionRef: React.RefCallback<HTMLDivElement>
}

function TagSection({ tag, label, notes, isExpanded, isFocused, onToggle, onNoteClick, sectionRef }: Readonly<TagSectionProps>) {
  const displayLabel = label ?? `#${tag}`
  const isSpecial = tag === '__untagged__'

  return (
    <div ref={sectionRef}>
      {/* Tag header row */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          width: '100%', padding: '0.5rem 1rem',
          background: isFocused ? 'var(--color-surface-2)' : 'transparent',
          border: 'none', borderBottom: '1px solid var(--color-border)',
          cursor: 'pointer', textAlign: 'left',
          color: 'var(--color-text)',
        }}
      >
        {isExpanded
          ? <ChevronDown size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          : <ChevronRight size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        }
        {!isSpecial && <Hash size={13} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />}
        {isSpecial && <FileText size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
        <span style={{ fontSize: '0.875rem', fontWeight: 500, flex: 1 }}>{displayLabel}</span>
        <span style={{
          fontSize: '0.65rem', fontWeight: 600,
          background: 'var(--color-surface-2)', color: 'var(--color-text-muted)',
          borderRadius: 10, padding: '0.1rem 0.45rem',
        }}>
          {notes.length}
        </span>
      </button>

      {/* Notes under this tag */}
      {isExpanded && (
        <div style={{ borderBottom: '1px solid var(--color-border)' }}>
          {notes.map(note => (
            <NoteRow key={note.id} note={note} onClick={() => onNoteClick(note.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function NoteRow({ note, onClick }: Readonly<{ note: LocalNote; onClick: () => void }>) {
  const typeDef = getType(note.type)
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.625rem',
        width: '100%', padding: '0.45rem 1rem 0.45rem 2.5rem',
        background: 'transparent', border: 'none',
        borderBottom: '1px solid var(--color-border)',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      {/* Type color dot */}
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: typeDef?.color ?? '#6366f1', flexShrink: 0 }} />

      <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {note.title || 'Untitled'}
      </span>

      {note.tags.length > 1 && (
        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
          +{note.tags.length - 1} tag{note.tags.length - 1 !== 1 ? 's' : ''}
        </span>
      )}

      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
        {formatRelativeDate(note.updatedAt)}
      </span>
    </button>
  )
}
