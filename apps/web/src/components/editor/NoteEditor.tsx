import { useEffect, useRef, useCallback } from 'react'
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
import Placeholder from '@tiptap/extension-placeholder'
import { common, createLowlight } from 'lowlight'
import type { LocalNote } from '@braindump/shared'
import { getType } from '../../lib/noteTypeRegistry'
import s from '../../styles/layout.module.css'

const lowlight = createLowlight(common)

const AUTOSAVE_DELAY = 800

interface Props {
  note: LocalNote
  onSave: (changes: { content?: object; title?: string }) => void
  onDelete: () => void
}

export function NoteEditor({ note, onSave, onDelete }: Props) {
  const typeDef = getType(note.type)
  const titleRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedSave = useCallback((content: object) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => onSave({ content }), AUTOSAVE_DELAY)
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
        <button
          className={`${s.btn} ${s.btnGhost}`}
          onClick={onDelete}
          title="Delete note"
          style={{ color: 'var(--color-error)', marginLeft: 'auto' }}
        >
          Delete
        </button>
      </div>
      <div className={s.editorBody}>
        <EditorContent editor={editor} />
      </div>
    </>
  )
}
