import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { SyncStatusBar } from './SyncStatusBar'
import { CommandPalette } from '../ui/CommandPalette'
import { QuickTaskModal } from '../tasks/QuickTaskModal'
import { useUIStore } from '../../stores/uiStore'
import { useSyncStore } from '../../stores/syncStore'
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts'
import { syncEngine } from '../../lib/sync'
import { localBridge } from '../../lib/localBridge'
import { initRegistry } from '../../lib/noteTypeRegistry'
import { getAllCustomNoteTypes, getAllCollections, getAllTopics } from '../../lib/localStore'
import { useCollectionsStore } from '../../stores/collectionsStore'
import s from '../../styles/layout.module.css'

export function AppShell() {
  const sidebarOpen = useUIStore((st) => st.sidebarOpen)
  const theme = useUIStore((st) => st.theme)
  const quickTaskOpen = useUIStore((st) => st.quickTaskOpen)
  const quickTaskLinkedNoteId = useUIStore((st) => st.quickTaskLinkedNoteId)
  const setQuickTaskOpen = useUIStore((st) => st.setQuickTaskOpen)

  const serverUrl = useSyncStore((st) => st.serverUrl)
  useGlobalShortcuts()

  // Apply theme to document root
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset['theme']
    else document.documentElement.dataset['theme'] = theme
  }, [theme])

  // Load custom note types and initialise registry on mount
  useEffect(() => {
    getAllCustomNoteTypes().then(types => initRegistry(types)).catch(console.error)
  }, [])

  // Hydrate collections/topics from IndexedDB (populated by sync; needed for local-only users too)
  useEffect(() => {
    Promise.all([getAllCollections(), getAllTopics()]).then(([cols, tops]) => {
      useCollectionsStore.getState().setCollections(cols)
      useCollectionsStore.getState().setTopics(tops)
    }).catch(console.error)
  }, [])

  // Start/stop sync engine when server URL changes
  useEffect(() => {
    if (serverUrl) syncEngine.start()
    else syncEngine.stop()
    return () => syncEngine.stop()
  }, [serverUrl])

  // Local bridge — always try to connect; silently retries if bridge isn't running
  useEffect(() => {
    localBridge.start()
    return () => localBridge.stop()
  }, [])

  return (
    <div className={s.appShell}>
      {sidebarOpen && <Sidebar />}
      <div className={s.mainArea}>
        <div className={s.contentArea}>
          <Outlet />
        </div>
        <SyncStatusBar />
      </div>
      <CommandPalette />
      {quickTaskOpen && <QuickTaskModal linkedNoteId={quickTaskLinkedNoteId} onClose={() => setQuickTaskOpen(false)} />}
    </div>
  )
}
