import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Link from '@tiptap/extension-link'
import { common, createLowlight } from 'lowlight'
import { useSyncStore } from '../stores/syncStore'
import s from '../styles/layout.module.css'

const lowlight = createLowlight(common)

interface SharedNote {
  title: string
  type: string
  tags: string[]
  content: object
  createdAt: string
  updatedAt: string
}

export function SharePage() {
  const { slug } = useParams<{ slug: string }>()
  const serverUrl = useSyncStore((st) => st.serverUrl)
  const [note, setNote] = useState<SharedNote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manualUrl, setManualUrl] = useState('')
  const [resolvedUrl, setResolvedUrl] = useState(serverUrl ?? '')

  useEffect(() => {
    if (!resolvedUrl || !slug) return
    const url = `${resolvedUrl}/s/${slug}`
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Share link not found or expired.' : `Server error: ${r.status}`)
        return r.json() as Promise<{ note: SharedNote }>
      })
      .then((data) => setNote(data.note))
      .catch((e: Error) => setError(e.message))
  }, [resolvedUrl, slug])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({ openOnClick: true }),
    ],
    content: note?.content ?? {},
    editable: false,
    editorProps: {
      attributes: { class: s.tiptap ?? 'tiptap' },
    },
  })

  // Update editor when note loads
  useEffect(() => {
    if (editor && note?.content) {
      editor.commands.setContent(note.content, false)
    }
  }, [editor, note])

  // No server URL configured — ask for it
  if (!resolvedUrl) {
    return (
      <div style={{ maxWidth: 560, margin: '4rem auto', padding: '0 1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Enter sync server URL</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          To view this shared note, enter the address of the Braindump sync server.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            className={s.searchInput}
            style={{ flex: 1 }}
            placeholder="http://your-server:3001"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
          />
          <button
            className={`${s.btn} ${s.btnPrimary}`}
            onClick={() => setResolvedUrl(manualUrl.replace(/\/$/, ''))}
          >
            View
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: 560, margin: '4rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>{error}</p>
      </div>
    )
  }

  if (!note) {
    return (
      <div style={{ maxWidth: 560, margin: '4rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <header style={{ marginBottom: '2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text)' }}>
          {note.title || 'Untitled'}
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Updated {new Date(note.updatedAt).toLocaleDateString()}
          </span>
          {note.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '0.7rem',
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-muted)',
                padding: '0.1rem 0.4rem',
                borderRadius: 4,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      </header>
      <EditorContent editor={editor} />
      <footer style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
        Shared via Braindump
      </footer>
    </div>
  )
}
