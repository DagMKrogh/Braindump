import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SyncMode } from '@braindump/shared'

interface SyncState {
  mode: SyncMode
  status: 'idle' | 'syncing' | 'error'
  lastSynced: string | null // ISO 8601
  pendingCount: number
  serverUrl: string | null
  error: string | null
  setMode: (mode: SyncMode) => void
  setStatus: (status: SyncState['status']) => void
  setLastSynced: (ts: string) => void
  setPendingCount: (count: number) => void
  setServerUrl: (url: string | null) => void
  setError: (error: string | null) => void
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      mode: 'local-only' as SyncMode,
      status: 'idle' as const,
      lastSynced: null,
      pendingCount: 0,
      serverUrl: null,
      error: null,
      setMode: (mode: SyncMode) => set({ mode }),
      setStatus: (status: SyncState['status']) => set({ status }),
      setLastSynced: (ts: string) => set({ lastSynced: ts }),
      setPendingCount: (count: number) => set({ pendingCount: count }),
      setServerUrl: (url: string | null) =>
        set({ serverUrl: url, mode: url ? ('offline' as SyncMode) : 'local-only' }),
      setError: (error: string | null) => set({ error }),
    }),
    {
      name: 'braindump-sync',
      partialize: (state: SyncState) => ({ serverUrl: state.serverUrl, lastSynced: state.lastSynced }),
    }
  )
)
