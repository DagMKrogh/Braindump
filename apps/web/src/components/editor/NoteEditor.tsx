import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import {
  Bold, Italic, Strikethrough, Code,
  Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks,
  Quote, Code2, Minus, Link as LinkIcon,
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

  // NoteLink extension — created once, reads latest notes via store getter
  const noteLinkExt = useMemo(
    () => createNoteLinkExtension(() => useNotesStore.getState().notes),
    [],
  )

  const debouncedSave = useCallback((content: object) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onSave({ content, linkedNoteIds: extractNoteLinks(content) })
    }, AUTOSAVE_DELAY)
  }, [onSave])

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
      Placeholder.configure({
        placeholder: typeDef ? `Start writing your ${typeDef.label.toLowerCase()}…` : 'Start writing…',
      }),
    ],
    content: note.content as object,
    editorProps: {
      attributes: { class: s.tiptap ?? 'tiptap' },
    },
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getJSON())
    },
  })

  // When active note changes, load its content
  useEffect(() => {
    if (!editor) return
    const currentJson = JSON.stringify(editor.getJSON())
    const noteJson = JSON.stringify(note.content)
    if (currentJson !== noteJson) {
      editor.commands.setContent(note.content as object, false)
    }
  }, [note.id, editor]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timer on unmount
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

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
              <button className={s.dropdownItem} onClick={handlePrint}>
                Print / PDF
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

      <EditorToolbar editor={editor} />

      <div className={s.editorBody}>
        <EditorContent editor={editor} />
      </div>

      {shareOpen && (
        <ShareModal noteId={note.id} onClose={() => setShareOpen(false)} />
      )}
    </>
  )
}
