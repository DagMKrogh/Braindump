import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LocalNote, NoteType } from '@braindump/shared'
import { useUIStore } from '../stores/uiStore'
import { useNotesStore } from '../stores/notesStore'
import { upsertNote as localUpsert } from '../lib/localStore'
import { getType } from '../lib/noteTypeRegistry'
import { isTauri } from '../lib/isTauri'

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

async function createQuickNote(
  type: NoteType,
  storeUpsert: (note: LocalNote) => void,
  setActiveNoteId: (id: string) => void,
): Promise<string> {
  const typeDef = getType(type)
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const note = {
    id, userId: 'local', type,
    title: typeDef ? `New ${typeDef.label}` : 'New Note',
    content: typeDef ? typeDef.contentTemplate() : { type: 'doc', content: [{ type: 'paragraph' }] },
    metadata: typeDef ? { ...typeDef.defaultMetadata } : {},
    tags: [], collectionId: null, topicId: null,
    linkedNoteIds: [], isPinned: false, isEncrypted: false, dateRef: null,
    createdAt: now, updatedAt: now, deletedAt: null,
    syncStatus: 'pending' as const, localOnly: true,
  }
  await localUpsert(note)
  storeUpsert(note)
  setActiveNoteId(id)
  return id
}

export function useGlobalShortcuts() {
  const navigate = useNavigate()
  const { commandPaletteOpen, setCommandPaletteOpen, setQuickTaskOpen } = useUIStore()
  const { upsertNote: storeUpsert, setActiveNoteId } = useNotesStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K → open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }
      // Cmd+, / Ctrl+, → Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        navigate('/settings')
        return
      }
      // Cmd+Shift+T / Ctrl+Shift+T → new task linked to current note (works even inside editor)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        const activeNoteId = useNotesStore.getState().activeNoteId
        setQuickTaskOpen(true, activeNoteId ?? null)
        return
      }
      // Escape → close command palette
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false)
        return
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !isInputFocused()) {
        // N → new scratch note
        if (e.key === 'n') {
          e.preventDefault()
          createQuickNote('scratch', storeUpsert, setActiveNoteId)
            .then(id => navigate(`/notes/${id}`))
            .catch(console.error)
        }
        // T → open quick task modal
        if (e.key === 't') {
          e.preventDefault()
          setQuickTaskOpen(true)
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, navigate, setCommandPaletteOpen, setQuickTaskOpen, storeUpsert, setActiveNoteId])

  // Register system-wide hotkey when running inside Tauri desktop app
  useEffect(() => {
    if (!isTauri()) return
    let unregisterFn: (() => Promise<void>) | null = null

    async function registerTauriShortcuts() {
      const { register, unregisterAll } = await import('@tauri-apps/plugin-global-shortcut')
      const { getCurrentWindow } = await import('@tauri-apps/api/window')

      // Cmd/Ctrl+Shift+B → bring the window to focus from anywhere in the OS
      await register('CommandOrControl+Shift+B', async () => {
        const win = getCurrentWindow()
        await win.show()
        await win.unminimize()
        await win.setFocus()
      })

      unregisterFn = unregisterAll
    }

    registerTauriShortcuts().catch(console.error)
    return () => { unregisterFn?.().catch(console.error) }
  }, [])
}

export { createQuickNote }
