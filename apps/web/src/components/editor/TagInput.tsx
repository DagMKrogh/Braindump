import { useState, useRef, useCallback, useMemo } from 'react'
import { X } from 'lucide-react'
import { useNotesStore } from '../../stores/notesStore'

interface Props {
  readonly tags: string[]
  readonly onChange: (tags: string[]) => void
}

export function TagInput({ tags, onChange }: Props) {
  const [input, setInput] = useState('')
  const [suggIdx, setSuggIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Derive all unique tags across all notes for autocomplete
  const allNotes = useNotesStore((st) => st.notes)
  const allTags = useMemo(() => {
    const set = new Set<string>()
    allNotes.forEach((n) => n.tags.forEach((t) => set.add(t)))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [allNotes])

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase().replace(/^#+/, '')
    if (!q) return []
    return allTags.filter((t) => t.includes(q) && !tags.includes(t)).slice(0, 8)
  }, [input, allTags, tags])

  const addTag = useCallback((raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/^#+/, '')
    if (!tag || tags.includes(tag)) { setInput(''); return }
    onChange([...tags, tag])
    setInput('')
    setSuggIdx(0)
  }, [tags, onChange])

  const removeTag = useCallback((tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }, [tags, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggIdx((i) => Math.min(i + 1, suggestions.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSuggIdx((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Tab' || (e.key === 'Enter' && suggestions[suggIdx])) {
        e.preventDefault()
        addTag(suggestions[suggIdx]!)
        return
      }
    }
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (input.trim()) addTag(input)
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.at(-1)!)
    }
    if (e.key === 'Escape') { setInput(''); setSuggIdx(0) }
  }

  let inputWidth: string
  if (input) {
    inputWidth = `${input.length + 2}ch`
  } else if (tags.length === 0) {
    inputWidth = '8ch'
  } else {
    inputWidth = '1ch'
  }

  return (
    <div style={{ position: 'relative' }}>
      <label
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.35rem',
          alignItems: 'center',
          padding: '0.4rem 1.5rem',
          borderBottom: '1px solid var(--color-border)',
          minHeight: 36,
          cursor: 'text',
        }}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              padding: '0.1rem 0.4rem',
              background: 'var(--color-surface-2)',
              borderRadius: 4,
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
              userSelect: 'none',
            }}
          >
            #{tag}
            <button
              onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'inherit', display: 'flex' }}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setSuggIdx(0) }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // short delay so click on suggestion fires before blur clears it
            setTimeout(() => { if (input.trim()) addTag(input) }, 150)
          }}
          placeholder={tags.length === 0 ? 'Add tags…' : ''}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            width: inputWidth,
            minWidth: '1ch',
          }}
        />
      </label>

      {/* Autocomplete dropdown */}
      {suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '1.5rem',
            zIndex: 150,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            minWidth: 160,
            overflow: 'hidden',
          }}
        >
          {suggestions.map((tag, idx) => (
            <button
              key={tag}
              onMouseDown={(e) => { e.preventDefault(); addTag(tag) }}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.4rem 0.75rem',
                fontSize: '0.775rem',
                textAlign: 'left',
                background: idx === suggIdx ? 'var(--color-surface-2)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
