import { useMemo } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, Calendar, Search, Settings, Hash, FolderOpen } from 'lucide-react'
import { SyncStatusBar } from './SyncStatusBar'
import { useCollectionsStore } from '../../stores/collectionsStore'
import { useNotesStore } from '../../stores/notesStore'
import s from '../../styles/layout.module.css'

export function Sidebar() {
  const { collections } = useCollectionsStore()
  const notes = useNotesStore(st => st.notes)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeCollectionId = searchParams.get('collection')

  // Derive top tags from loaded notes (by note count, descending)
  const topTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const note of notes) {
      for (const tag of note.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }))
  }, [notes])

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
        <NavLink to="/tags" className={({ isActive }) => `${s.navItem} ${isActive ? s.active : ''}`}>
          <Hash size={15} />
          Tags
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
              <button
                key={c.id}
                className={`${s.navItem} ${activeCollectionId === c.id ? s.active : ''}`}
                onClick={() => navigate(activeCollectionId === c.id ? '/notes' : `/notes?collection=${c.id}`)}
              >
                <FolderOpen size={13} />
                {c.name}
              </button>
            ))}
          </>
        )}

        {topTags.length > 0 && (
          <>
            <div className={s.sidebarSectionTitle} style={{ marginTop: '0.5rem' }}>Tags</div>
            {topTags.map(({ tag, count }) => (
              <button
                key={tag}
                className={s.navItem}
                onClick={() => navigate(`/tags?tag=${encodeURIComponent(tag)}`)}
                style={{ justifyContent: 'space-between' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <Hash size={13} />
                  {tag}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{count}</span>
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
