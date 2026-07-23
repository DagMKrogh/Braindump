import { NavLink } from 'react-router-dom'

export function Sidebar() {
  return (
    <aside style={{
      width: 240,
      background: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1rem',
      gap: '0.5rem',
    }}>
      <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' }}>Braindump</div>
      <NavLink to="/notes">Notes</NavLink>
      <NavLink to="/calendar">Calendar</NavLink>
      <NavLink to="/search">Search</NavLink>
      <NavLink to="/settings">Settings</NavLink>
    </aside>
  )
}
