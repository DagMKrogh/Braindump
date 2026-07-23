import { create } from 'zustand'
import type { LocalNote } from '@braindump/shared'

interface NotesState {
  notes: LocalNote[]
  activeNoteId: string | null
  loading: boolean
  error: string | null
  setNotes: (notes: LocalNote[]) => void
  upsertNote: (note: LocalNote) => void
  removeNote: (id: string) => void
  setActiveNoteId: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: [],
  activeNoteId: null,
  loading: false,
  error: null,
  setNotes: (notes) => set({ notes }),
  upsertNote: (note) =>
    set((state) => {
      const index = state.notes.findIndex((n) => n.id === note.id)
      if (index >= 0) {
        const updated = [...state.notes]
        updated[index] = note
        return { notes: updated }
      }
      return { notes: [note, ...state.notes] }
    }),
  removeNote: (id) =>
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),
  setActiveNoteId: (id) => set({ activeNoteId: id }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
