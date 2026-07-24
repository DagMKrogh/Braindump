import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import type { LocalNote, NoteType } from '@braindump/shared'
import { getAllNotes } from '../lib/localStore'
import { getType, getAllTypes } from '../lib/noteTypeRegistry'
import { NoteListItem } from '../components/layout/NoteListItem'
import s from '../styles/layout.module.css'

function extractText(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const node = content as { text?: string; content?: unknown[] }
  const parts: string[] = []
  if (node.text) parts.push(node.text)
  if (Array.isArray(node.content)) {
    for (const child of node.content) parts.push(extractText(child))
  }
  return parts.join(' ')
}

export function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<NoteType | ''>('')
  const [tagFilter, setTagFilter] = useState('')
  const [allNotes, setAllNotes] = useState<LocalNote[]>([])

  useEffect(() => {
    getAllNotes().then(setAllNotes)
  }, [])

  const results = useMemo(() => {
    const q = query.toLowerCase().trim()
    const tag = tagFilter.toLowerCase().trim()

    return allNotes.filter((note) => {
      if (typeFilter && note.type !== typeFilter) return false
      if (tag && !note.tags.some((t) => t.includes(tag))) return false
      if (!q) return true

      const titleMatch = note.title.toLowerCase().includes(q)
      const contentText = extractText(note.content).toLowerCase()
      const contentMatch = contentText.includes(q)
      const tagMatch = note.tags.some((t) => t.includes(q))
      const metaText = JSON.stringify(note.metadata).toLowerCase()
      const metaMatch = metaText.includes(q)

      return titleMatch || contentMatch || tagMatch || metaMatch
    })
  }, [allNotes, query, typeFilter, tagFilter])

  const allTypes = getAllTypes()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%' }}>
      {/* Search header */}
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.6rem', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes by title, content, tags, or metadata…"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem 0.6rem 2rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              fontSize: '0.9375rem',
              color: 'var(--color-text)',
              outline: 'none',
            }}
          />
        </div>

        {/* Filters row */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as NoteType | '')}
            className={s.metaInput}
            style={{ maxWidth: 180 }}
          >
            <option value="">All types</option>
            {allTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <input
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="Filter by tag…"
            className={s.metaInput}
            style={{ maxWidth: 160 }}
          />
          {(query || typeFilter || tagFilter) && (
            <button
              className={`${s.btn} ${s.btnGhost}`}
              onClick={() => { setQuery(''); setTypeFilter(''); setTagFilter('') }}
            >
              Clear
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {results.length} result{results.length !== 1 ? 's' : ''}
          {(query || typeFilter || tagFilter) ? '' : ' — type to search'}
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {results.map((note) => {
          const typeDef = getType(note.type)
          const handleNav = () => navigate(`/notes/${note.id}`)
          return (
            <button
              key={note.id}
              onClick={handleNav}
              style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
            >
              <NoteListItem
                note={note}
                isActive={false}
                onClick={handleNav}
              />
              {/* Show matching content snippet */}
              {query && (
                <ContentSnippet content={note.content} query={query} typeDef={typeDef} />
              )}
            </button>
          )
        })}

        {results.length === 0 && (query || typeFilter || tagFilter) && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No notes match your search
          </div>
        )}
      </div>
    </div>
  )
}

function ContentSnippet({ content, query, typeDef }: Readonly<{
  content: unknown
  query: string
  typeDef: ReturnType<typeof getType>
}>) {
  const text = extractText(content)
  const q = query.toLowerCase()
  const idx = text.toLowerCase().indexOf(q)
  if (idx === -1) return null

  const start = Math.max(0, idx - 60)
  const end = Math.min(text.length, idx + query.length + 60)
  const snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
  const before = snippet.slice(0, snippet.toLowerCase().indexOf(q))
  const match = snippet.slice(before.length, before.length + query.length)
  const after = snippet.slice(before.length + query.length)

  return (
    <div style={{
      padding: '0 0.75rem 0.5rem 0.75rem',
      fontSize: '0.75rem',
      color: 'var(--color-text-muted)',
      lineHeight: 1.5,
    }}>
      {before}
      <mark style={{ background: `${typeDef?.color ?? '#6366f1'}33`, color: 'var(--color-text)', borderRadius: 2 }}>
        {match}
      </mark>
      {after}
    </div>
  )
}
