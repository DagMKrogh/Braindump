import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { SyncStatusBar } from './SyncStatusBar'
import { useUIStore } from '../../stores/uiStore'

export function AppShell() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {sidebarOpen && <Sidebar />}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </div>
        <SyncStatusBar />
      </main>
    </div>
  )
}
