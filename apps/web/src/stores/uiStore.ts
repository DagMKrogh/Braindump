import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light' | 'system'
type EditorMode = 'split' | 'editor' | 'preview'

interface UIState {
  sidebarOpen: boolean
  theme: Theme
  editorMode: EditorMode
  commandPaletteOpen: boolean
  quickTaskOpen: boolean
  quickTaskLinkedNoteId: string | null
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setTheme: (theme: Theme) => void
  setEditorMode: (mode: EditorMode) => void
  setCommandPaletteOpen: (open: boolean) => void
  toggleCommandPalette: () => void
  setQuickTaskOpen: (open: boolean, linkedNoteId?: string | null) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'system' as Theme,
      editorMode: 'split' as EditorMode,
      commandPaletteOpen: false,
      quickTaskOpen: false,
      quickTaskLinkedNoteId: null,
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme: Theme) => set({ theme }),
      setEditorMode: (mode: EditorMode) => set({ editorMode: mode }),
      setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setQuickTaskOpen: (open, linkedNoteId = null) => set({ quickTaskOpen: open, quickTaskLinkedNoteId: open ? linkedNoteId ?? null : null }),
    }),
    {
      name: 'braindump-ui',
      partialize: (s: UIState) => ({ theme: s.theme, editorMode: s.editorMode }),
    }
  )
)
