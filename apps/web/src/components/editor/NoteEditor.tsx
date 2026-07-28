import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import {
  Bold, Italic, Strikethrough, Code,
  Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks,
  Quote, Code2, Minus, Link as LinkIcon,
  GitFork,
} from 'lucide-react'
import StarterKit from '@tiptap/starter-kit'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { common, createLowlight } from 'lowlight'
import type { LocalNote } from '@braindump/shared'
import { getType } from '../../lib/noteTypeRegistry'
import { downloadMarkdown } from '../../lib/markdownExport'
import { createNoteLinkExtension, extractNoteLinks } from '../../lib/extensions/NoteLink'
import { DiagramBlock, SAVE_DIAGRAM_EVENT, diagramTypes, type DiagramData, type DiagramType } from '../../lib/extensions/DiagramBlock'
import { encrypt, decrypt, isEncryptedPayload } from '../../lib/crypto'
import { useSyncStore } from '../../stores/syncStore'
import { useNotesStore } from '../../stores/notesStore'
import { ShareModal } from './ShareModal'
import s from '../../styles/layout.module.css'

const lowlight = createLowlight(common)

const AUTOSAVE_DELAY = 800

// ── Formatting toolbar ─────────────────────────────────────────────────────

function ToolbarBtn({ editor, active, onClick, title, children }: Readonly<{
  editor: Editor; active: boolean; onClick: () => void; title: string; children: React.ReactNode
}>) {
  return (
    <button
      className={`${s.toolbarBtn} ${active ? s.toolbarBtnActive : ''}`}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      tabIndex={-1}
    >
      {children}
    </button>
  )
}

function DiagramInsertDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const insert = (type: DiagramType) => {
    ;(editor.commands as unknown as { insertDiagram: (type: DiagramType) => boolean }).insertDiagram(type)
    setOpen(false)
  }

  return (
    <div ref={ref} className={s.dropdownWrap} style={{ display: 'inline-flex' }}>
      <button
        className={s.toolbarBtn}
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o) }}
        title="Insert diagram"
        tabIndex={-1}
      >
        <GitFork size={14} />
      </button>
      {open && (
        <div className={s.dropdownMenu} style={{ left: 0, right: 'auto', minWidth: 220 }}>
          {diagramTypes.map((dt) => (
            <button
              key={dt.type}
              className={s.dropdownItem}
              onMouseDown={(e) => { e.preventDefault(); insert(dt.type) }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{dt.label}</span>
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{dt.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EditorToolbar({ editor }: Readonly<{ editor: Editor | null }>) {
  if (!editor) return null

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', prev ?? '')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  const tb = (active: boolean, onClick: () => void, title: string, icon: React.ReactNode) => (
    <ToolbarBtn editor={editor} active={active} onClick={onClick} title={title}>{icon}</ToolbarBtn>
  )

  return (
    <div className={s.editorToolbar}>
      {tb(editor.isActive('bold'),        () => editor.chain().focus().toggleBold().run(),        'Bold',          <Bold size={14} />)}
      {tb(editor.isActive('italic'),      () => editor.chain().focus().toggleItalic().run(),      'Italic',        <Italic size={14} />)}
      {tb(editor.isActive('strike'),      () => editor.chain().focus().toggleStrike().run(),      'Strikethrough', <Strikethrough size={14} />)}
      {tb(editor.isActive('code'),        () => editor.chain().focus().toggleCode().run(),        'Inline code',   <Code size={14} />)}
      {tb(editor.isActive('link'),        () => setLink(),                                        'Link',          <LinkIcon size={14} />)}

      <span className={s.toolbarSep} />

      {tb(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'Heading 1', <Heading1 size={14} />)}
      {tb(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Heading 2', <Heading2 size={14} />)}
      {tb(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'Heading 3', <Heading3 size={14} />)}

      <span className={s.toolbarSep} />

      {tb(editor.isActive('bulletList'),  () => editor.chain().focus().toggleBulletList().run(),  'Bullet list',   <List size={14} />)}
      {tb(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Ordered list',  <ListOrdered size={14} />)}
      {tb(editor.isActive('taskList'),    () => editor.chain().focus().toggleTaskList().run(),    'Task list',     <ListChecks size={14} />)}

      <span className={s.toolbarSep} />

      {tb(editor.isActive('blockquote'),  () => editor.chain().focus().toggleBlockquote().run(),  'Blockquote',    <Quote size={14} />)}
      {tb(editor.isActive('codeBlock'),   () => editor.chain().focus().toggleCodeBlock().run(),   'Code block',    <Code2 size={14} />)}
      {tb(false,                          () => editor.chain().focus().setHorizontalRule().run(), 'Divider',       <Minus size={14} />)}

      <span className={s.toolbarSep} />

      <DiagramInsertDropdown editor={editor} />
    </div>
  )
}

interface Props {
  note: LocalNote
  onSave: (changes: { content?: object; title?: string; linkedNoteIds?: string[] }) => void
  onDelete: () => void
}

export function NoteEditor({ note, onSave, onDelete }: Props) {
  const typeDef = getType(note.type)
  const titleRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const serverUrl = useSyncStore((st) => st.serverUrl)

  const [exportOpen, setExportOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  // ── Secret note encryption state ───────────────────────────────────────
  const isSecret = note.type === 'secret'
  const SESSION_PW_KEY = 'braindump-master-pw'
  const [masterPassword, setMasterPassword] = useState<string | null>(() =>
    isSecret ? sessionStorage.getItem(SESSION_PW_KEY) : null
  )
  const [passwordInput, setPasswordInput] = useState('')
  const [decryptError, setDecryptError] = useState('')
  const [decryptedContent, setDecryptedContent] = useState<object | null>(null)
  const locked = isSecret && masterPassword === null

  const handleUnlock = async () => {
    setDecryptError('')
    if (isEncryptedPayload(note.content)) {
      try {
        const plain = await decrypt(note.content, passwordInput)
        setDecryptedContent(JSON.parse(plain) as object)
        setMasterPassword(passwordInput)
        sessionStorage.setItem(SESSION_PW_KEY, passwordInput)
        setPasswordInput('')
      } catch {
        setDecryptError('Wrong password — try again.')
      }
    } else {
      // First time opening (no encrypted content yet) — set password
      setDecryptedContent(note.content as object)
      setMasterPassword(passwordInput)
      sessionStorage.setItem(SESSION_PW_KEY, passwordInput)
      setPasswordInput('')
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  // NoteLink extension — created once, reads latest notes via store getter
  const noteLinkExt = useMemo(
    () => createNoteLinkExtension(() => useNotesStore.getState().notes),
    [],
  )

  const debouncedSave = useCallback((content: object) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (isSecret && masterPassword) {
        const payload = await encrypt(JSON.stringify(content), masterPassword)
        onSave({ content: payload as unknown as object, linkedNoteIds: extractNoteLinks(content) })
      } else {
        onSave({ content, linkedNoteIds: extractNoteLinks(content) })
      }
    }, AUTOSAVE_DELAY)
  }, [onSave, isSecret, masterPassword])

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
      Link.configure({ openOnClick: false }),
      noteLinkExt,
      DiagramBlock,
      Placeholder.configure({
        placeholder: typeDef ? `Start writing your ${typeDef.label.toLowerCase()}…` : 'Start writing…',
      }),
    ],
    content: (isSecret ? { type: 'doc', content: [{ type: 'paragraph' }] } : note.content) as object,
    editorProps: {
      attributes: { class: s.tiptap ?? 'tiptap' },
    },
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getJSON())
    },
  })

  // When active note changes or peer updates arrive, load the new content.
  // We compare JSON to avoid clobbering the editor while the user is typing.
  useEffect(() => {
    if (!editor) return
    // Skip if a local save is pending (user is actively editing)
    if (saveTimer.current) return
    const targetContent = isSecret ? { type: 'doc', content: [{ type: 'paragraph' }] } : note.content
    const currentJson = JSON.stringify(editor.getJSON())
    if (currentJson !== JSON.stringify(targetContent)) {
      editor.commands.setContent(targetContent as object, false)
    }
  }, [note.id, note.updatedAt, editor]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-decrypt when master password is already in sessionStorage (same-session note switch)
  useEffect(() => {
    if (!isSecret || !masterPassword || decryptedContent) return
    if (isEncryptedPayload(note.content)) {
      decrypt(note.content, masterPassword)
        .then((plain) => setDecryptedContent(JSON.parse(plain) as object))
        .catch(() => {
          // Session password doesn't match this note — clear it so lock overlay shows
          setMasterPassword(null)
          sessionStorage.removeItem(SESSION_PW_KEY)
        })
    } else {
      setDecryptedContent(note.content as object)
    }
  }, [note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load decrypted content into editor once the user unlocks a secret note
  useEffect(() => {
    if (!editor || !decryptedContent) return
    editor.commands.setContent(decryptedContent, false)
  }, [decryptedContent, editor])

  // Cleanup timer on unmount
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  // Listen for diagram save events and update the ProseMirror document directly
  useEffect(() => {
    if (!editor) return
    const handler = (e: Event) => {
      const data = (e as CustomEvent<DiagramData>).detail
      ;(editor.commands as unknown as { updateDiagram: (data: DiagramData) => boolean }).updateDiagram(data)
    }
    window.addEventListener(SAVE_DIAGRAM_EVENT, handler)
    return () => window.removeEventListener(SAVE_DIAGRAM_EVENT, handler)
  }, [editor])

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportOpen])

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => onSave({ title }), AUTOSAVE_DELAY)
  }, [onSave])

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      editor?.commands.focus('start')
    }
  }

  const handleMarkdownExport = () => {
    downloadMarkdown(note.title || 'Untitled', editor?.getJSON() ?? note.content)
    setExportOpen(false)
  }

  const handleServerPdf = async () => {
    setExportOpen(false)
    const { accessToken } = (await import('../../stores/authStore')).useAuthStore.getState()
    const res = await fetch(`${serverUrl}/notes/${note.id}/export/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({}),
    })
    if (!res.ok) { alert('PDF export failed'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${note.title || 'note'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    setExportOpen(false)
    setTimeout(() => window.print(), 100)
  }

  return (
    <>
      <div className={s.editorHeader}>
        {typeDef && (
          <span
            className={s.typeBadge}
            style={{ background: `${typeDef.color}22`, color: typeDef.color }}
          >
            {typeDef.label}
          </span>
        )}
        <input
          ref={titleRef}
          className={s.editorTitleInput}
          defaultValue={note.title}
          key={note.id}
          placeholder="Untitled"
          onChange={handleTitleChange}
          onKeyDown={handleTitleKeyDown}
        />

        {/* Export dropdown */}
        <div ref={exportRef} className={s.dropdownWrap}>
          <button
            className={`${s.btn} ${s.btnGhost}`}
            onClick={() => setExportOpen((o) => !o)}
            title="Export"
          >
            Export ▾
          </button>
          {exportOpen && (
            <div className={s.dropdownMenu}>
              <button className={s.dropdownItem} onClick={handleMarkdownExport}>
                Markdown (.md)
              </button>
              {serverUrl && note.type !== 'secret' && (
                <button className={s.dropdownItem} onClick={() => { void handleServerPdf() }}>
                  Export PDF
                </button>
              )}
              <button className={s.dropdownItem} onClick={handlePrint}>
                Print / Save as PDF
              </button>
            </div>
          )}
        </div>

        {/* Share button — only when sync server is configured */}
        {serverUrl && (
          <button
            className={`${s.btn} ${s.btnGhost}`}
            onClick={() => setShareOpen(true)}
            title="Share"
          >
            Share
          </button>
        )}

        <button
          className={`${s.btn} ${s.btnGhost}`}
          onClick={onDelete}
          title="Delete note"
          style={{ color: 'var(--color-error)' }}
        >
          Delete
        </button>
      </div>

      <EditorToolbar editor={locked ? null : editor} />

      {locked ? (
        <div className={s.editorBody} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
            padding: '2rem', maxWidth: 320, width: '100%',
            background: 'var(--color-surface)', borderRadius: 'var(--radius)',
            border: '1px solid var(--color-border)',
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              🔒 Secret note — enter master password
            </span>
            <input
              type="password"
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleUnlock() }}
              placeholder="Master password"
              className={s.metaInput}
              style={{ width: '100%' }}
            />
            {decryptError && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-error)' }}>{decryptError}</span>
            )}
            <button
              className={`${s.btn} ${s.btnPrimary}`}
              onClick={() => { void handleUnlock() }}
              disabled={!passwordInput}
            >
              Unlock
            </button>
          </div>
        </div>
      ) : (
        <div className={s.editorBody}>
          <EditorContent editor={editor} />
        </div>
      )}

      {shareOpen && (
        <ShareModal noteId={note.id} onClose={() => setShareOpen(false)} />
      )}
    </>
  )
}
