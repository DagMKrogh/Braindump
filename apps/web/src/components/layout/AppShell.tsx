import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { SyncStatusBar } from './SyncStatusBar'
import { CommandPalette } from '../ui/CommandPalette'
import { useUIStore } from '../../stores/uiStore'
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts'
import s from '../../styles/layout.module.css'

export function AppShell() {
  const sidebarOpen = useUIStore((st) => st.sidebarOpen)
  useGlobalShortcuts()

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
