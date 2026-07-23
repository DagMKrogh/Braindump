import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { SyncStatusBar } from './SyncStatusBar'
import { CommandPalette } from '../ui/CommandPalette'
import { useUIStore } from '../../stores/uiStore'
import { useSyncStore } from '../../stores/syncStore'
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts'
import { syncEngine } from '../../lib/sync'
import { initRegistry } from '../../lib/noteTypeRegistry'
import { getAllCustomNoteTypes } from '../../lib/localStore'
import s from '../../styles/layout.module.css'

export function AppShell() {
  const sidebarOpen = useUIStore((st) => st.sidebarOpen)
  const theme = useUIStore((st) => st.theme)
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

  // Start/stop sync engine when server URL changes
  useEffect(() => {
    if (serverUrl) syncEngine.start()
    else syncEngine.stop()
    return () => syncEngine.stop()
  }, [serverUrl])

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
    </div>
  )
}
