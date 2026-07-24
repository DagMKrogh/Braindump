/**
 * NoteLink — Tiptap inline node extension for [[note linking]].
 *
 * Trigger: type `[[` to open an autocomplete popup of note titles.
 * Select a note to insert a styled `[[Title]]` node that stores the noteId.
 * Clicking a note link dispatches `braindump:navigate-note` so NotesPage
 * can handle navigation without a hard dependency here.
 *
 * Usage:
 *   createNoteLinkExtension(() => useNotesStore.getState().notes)
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { PluginKey } from 'prosemirror-state'
import Suggestion from '@tiptap/suggestion'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import type { LocalNote } from '@braindump/shared'

export const NAVIGATE_NOTE_EVENT = 'braindump:navigate-note'

// ── Popup helpers (pure DOM — no React dependency) ─────────────────────────

function buildPopup(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'note-link-popup'
  document.body.appendChild(el)
  return el
}

function positionPopup(popup: HTMLDivElement, clientRect: DOMRect) {
  const maxLeft = window.innerWidth - 340
  popup.style.top  = `${clientRect.bottom + 4}px`
  popup.style.left = `${Math.min(clientRect.left, maxLeft)}px`
}

function renderPopup(
  popup: HTMLDivElement,
  items: LocalNote[],
  selectedIdx: number,
  onSelect: (note: LocalNote) => void,
) {
  popup.innerHTML = ''
  if (items.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'note-link-item-empty'
    empty.textContent = 'No matching notes'
    popup.appendChild(empty)
    return
  }
  items.forEach((note, idx) => {
    const btn = document.createElement('button')
    btn.className = `note-link-item${idx === selectedIdx ? ' selected' : ''}`
    btn.textContent = note.title || 'Untitled'
    // mousedown prevents the editor from losing focus before click fires
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      onSelect(note)
    })
    popup.appendChild(btn)
  })
}

// ── Extension factory ──────────────────────────────────────────────────────

export function createNoteLinkExtension(getNotes: () => LocalNote[]) {
  return Node.create({
    name: 'noteLink',
    group: 'inline',
    inline: true,
    selectable: true,
    atom: true,

    addAttributes() {
      return {
        noteId: { default: null },
        title:  { default: '' },
      }
    },

    parseHTML() {
      return [{ tag: 'span[data-note-link]' }]
    },

    renderHTML({ node, HTMLAttributes }) {
      return [
        'span',
        mergeAttributes(HTMLAttributes, {
          'data-note-link': '',
          'data-note-id': node.attrs.noteId as string,
          class: 'note-link',
        }),
        `[[${node.attrs.title as string}]]`,
      ]
    },

    addNodeView() {
      return ({ node }) => {
        const span = document.createElement('span')
        span.className = 'note-link'
        span.dataset['noteId'] = node.attrs.noteId as string
        span.textContent = `[[${node.attrs.title as string}]]`
        span.addEventListener('click', () => {
          window.dispatchEvent(
            new CustomEvent(NAVIGATE_NOTE_EVENT, {
              detail: { noteId: node.attrs.noteId as string },
            }),
          )
        })
        return { dom: span }
      }
    },

    addProseMirrorPlugins() {
      return [
        Suggestion<LocalNote>({
          editor: this.editor,
          pluginKey: new PluginKey('noteLink'),
          char: '[[',
          allowSpaces: true,

          items: ({ query }: { query: string }) => {
            const q = query.toLowerCase()
            return getNotes()
              .filter((n) => !n.deletedAt && n.title.toLowerCase().includes(q))
              .slice(0, 8)
          },

          command: ({ editor, range, props: note }: {
            editor: typeof this.editor
            range: { from: number; to: number }
            props: LocalNote
          }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent([
                { type: 'noteLink', attrs: { noteId: note.id, title: note.title || 'Untitled' } },
                { type: 'text', text: ' ' },
              ])
              .run()
          },

          render: () => {
            let popup: HTMLDivElement | null = null
            let selectedIdx = 0
            let currentItems: LocalNote[] = []
            let currentCommand: ((note: LocalNote) => void) | null = null

            const select = (note: LocalNote) => currentCommand?.(note)

            return {
              onStart(props: SuggestionProps<LocalNote>) {
                selectedIdx   = 0
                currentItems  = props.items
                currentCommand = props.command as (note: LocalNote) => void
                popup = buildPopup()
                const rect = props.clientRect?.()
                if (rect) positionPopup(popup, rect)
                renderPopup(popup, currentItems, selectedIdx, select)
              },

              onUpdate(props: SuggestionProps<LocalNote>) {
                selectedIdx   = 0
                currentItems  = props.items
                currentCommand = props.command as (note: LocalNote) => void
                const rect = props.clientRect?.()
                if (rect && popup) positionPopup(popup, rect)
                if (popup) renderPopup(popup, currentItems, selectedIdx, select)
              },

              onKeyDown(props: SuggestionKeyDownProps) {
                if (!popup) return false
                const { key } = props.event
                if (key === 'ArrowDown') {
                  selectedIdx = Math.min(selectedIdx + 1, currentItems.length - 1)
                  renderPopup(popup, currentItems, selectedIdx, select)
                  return true
                }
                if (key === 'ArrowUp') {
                  selectedIdx = Math.max(selectedIdx - 1, 0)
                  renderPopup(popup, currentItems, selectedIdx, select)
                  return true
                }
                if (key === 'Enter') {
                  const note = currentItems[selectedIdx]
                  if (note) { select(note); return true }
                }
                if (key === 'Escape') {
                  popup.remove()
                  popup = null
                  return true
                }
                return false
              },

              onExit() {
                popup?.remove()
                popup = null
              },
            }
          },
        }),
      ]
    },
  })
}

// ── Helper: extract all noteLink nodeIds from a Tiptap JSON doc ────────────

interface TipNode { type?: string; attrs?: Record<string, unknown>; content?: TipNode[] }

export function extractNoteLinks(doc: object): string[] {
  const ids = new Set<string>()
  function walk(node: TipNode) {
    if (node.type === 'noteLink' && typeof node.attrs?.noteId === 'string') {
      ids.add(node.attrs.noteId)
    }
    node.content?.forEach(walk)
  }
  walk(doc as TipNode)
  return Array.from(ids)
}
