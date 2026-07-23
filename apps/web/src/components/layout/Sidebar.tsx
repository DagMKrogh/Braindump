import { NavLink } from 'react-router-dom'
import { FileText, Calendar, Search, Settings, Hash, FolderOpen } from 'lucide-react'
import { SyncStatusBar } from './SyncStatusBar'
import { useCollectionsStore } from '../../stores/collectionsStore'
import s from '../../styles/layout.module.css'

export function Sidebar() {
  const { collections, tags } = useCollectionsStore()

  return (
    <aside className={s.sidebar}>
      <div className={s.sidebarHeader}>
        <span className={s.sidebarLogo}>Braindump</span>
      </div>

      <nav className={s.sidebarNav}>
        <NavLink to="/notes" className={({ isActive }) => `${s.navItem} ${isActive ? s.active : ''}`}>
          <FileText size={15} />
          Notes
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => `${s.navItem} ${isActive ? s.active : ''}`}>
          <Calendar size={15} />
          Calendar
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => `${s.navItem} ${isActive ? s.active : ''}`}>
          <Search size={15} />
          Search
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `${s.navItem} ${isActive ? s.active : ''}`}>
          <Settings size={15} />
          Settings
        </NavLink>
      </nav>

      <div className={s.sidebarSection}>
        {collections.length > 0 && (
          <>
            <div className={s.sidebarSectionTitle}>Collections</div>
            {collections.map((c) => (
              <button key={c.id} className={s.navItem}>
                <FolderOpen size={13} />
                {c.name}
              </button>
            ))}
          </>
        )}

        {tags.length > 0 && (
          <>
            <div className={s.sidebarSectionTitle} style={{ marginTop: '0.5rem' }}>Tags</div>
            {tags.slice(0, 20).map((t) => (
              <button key={t.id} className={s.navItem}>
                <Hash size={13} />
                {t.name}
              </button>
            ))}
          </>
        )}
      </div>

      <div className={s.sidebarFooter}>
        <SyncStatusBar />
      </div>
    </aside>
  )
}
