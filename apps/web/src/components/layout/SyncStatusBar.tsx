import { useSyncStore } from '../../stores/syncStore'

const modeLabel: Record<string, string> = {
  'local-only': 'Local only',
  synced: 'Synced',
  offline: 'Offline',
}

const modeColor: Record<string, string> = {
  'local-only': '#94a3b8',
  synced: '#22c55e',
  offline: '#f59e0b',
}

export function SyncStatusBar() {
  const { mode, status, lastSynced, pendingCount, error } = useSyncStore()

  const label = error
    ? 'Sync error'
    : status === 'syncing'
    ? 'Syncing…'
    : mode === 'offline' && pendingCount > 0
    ? `Offline — ${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending`
    : modeLabel[mode] ?? mode

  const color = error ? '#ef4444' : status === 'syncing' ? '#6366f1' : modeColor[mode] ?? '#94a3b8'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.4rem 1rem',
      borderTop: '1px solid var(--color-border)',
      fontSize: '0.75rem',
      color: 'var(--color-text-muted)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span>{label}</span>
      {mode === 'synced' && lastSynced && (
        <span style={{ marginLeft: 'auto' }}>
          Last synced {new Date(lastSynced).toLocaleTimeString()}
        </span>
      )}
    </div>
  )
}
