import { useState, useEffect } from 'react'
import { User, Link, Palette, Puzzle, Trash2, Plus, RefreshCw, LogOut, FolderOpen, UserPlus, Users } from 'lucide-react'
import type { CustomNoteTypeRecord, Collection, Topic } from '@braindump/shared'
import { useUIStore } from '../stores/uiStore'
import { useSyncStore } from '../stores/syncStore'
import { useAuthStore } from '../stores/authStore'
import { syncEngine } from '../lib/sync'
import { initRegistry } from '../lib/noteTypeRegistry'
import { getAllCustomNoteTypes, saveCustomNoteType, deleteCustomNoteType, getAllCollections, saveCollection, deleteCollection, getAllTopics, saveTopic, deleteTopic } from '../lib/localStore'
import { useCollectionsStore } from '../stores/collectionsStore'
import { apiClient, apiFetch } from '../lib/api'
import s from '../styles/layout.module.css'

const ICON_OPTIONS = [
  'FileText', 'Star', 'Bookmark', 'Lightbulb', 'Tag', 'Bell', 'Rocket',
  'Target', 'Code', 'Globe', 'Heart', 'Shield', 'Zap', 'Coffee', 'Moon',
  'Clipboard', 'Calendar', 'Folder', 'Archive', 'Inbox', 'Flag', 'Layers',
]

type Theme = 'dark' | 'light' | 'system'

function Section({ title, icon, children }: Readonly<{ title: string; icon: React.ReactNode; children: React.ReactNode }>) {
  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ color: 'var(--color-accent)' }}>{icon}</span>
        <h2 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Row({ label, hint, children }: Readonly<{ label: string; hint?: string; children: React.ReactNode }>) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '0.875rem', marginBottom: '0.875rem', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text)' }}>{label}</div>
        {hint && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

// ---- Appearance ----
function AppearanceSection() {
  const { theme, setTheme } = useUIStore()
  const themes: { value: Theme; label: string }[] = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'System' },
  ]

  return (
    <Section title="Appearance" icon={<Palette size={15} />}>
      <Row label="Theme" hint="Controls the app color scheme">
        <div style={{ display: 'flex', gap: 2, background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: 2 }}>
          {themes.map(({ value, label }) => (
            <button
              key={value}
              className={s.btn}
              style={{
                background: theme === value ? 'var(--color-surface-2)' : 'transparent',
                color: theme === value ? 'var(--color-text)' : 'var(--color-text-muted)',
                padding: '0.3rem 0.75rem', fontSize: '0.8rem',
              }}
              onClick={() => setTheme(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </Row>
    </Section>
  )
}

interface ServerUser { id: string; name: string; email: string; avatarUrl: string | null; createdAt?: string }
interface AuthResponse { accessToken: string; refreshToken: string; user: ServerUser }
type AuthPanel = 'pick' | 'login' | 'register'

// ---- Sync & Account ----
function SyncSection() {
  const { serverUrl, setServerUrl, lastSynced, mode, status } = useSyncStore()
  const { user, isAuthenticated, setAuth, clearAuth } = useAuthStore()
  const [urlInput, setUrlInput] = useState(serverUrl ?? '')
  const [syncing, setSyncing] = useState(false)
  const [panel, setPanel] = useState<AuthPanel>('pick')
  const [serverUsers, setServerUsers] = useState<ServerUser[]>([])
  const [selectedUser, setSelectedUser] = useState<ServerUser | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [serverVersion, setServerVersion] = useState<string | null>(null)

  useEffect(() => {
    if (!serverUrl) { setServerVersion(null); return }
    apiFetch<{ version: string }>(serverUrl, '/health').then(r => setServerVersion(r.version)).catch(() => setServerVersion(null))
  }, [serverUrl])

  useEffect(() => {
    if (!serverUrl || isAuthenticated) return
    apiFetch<ServerUser[]>(serverUrl, '/auth/users').then(setServerUsers).catch(() => setServerUsers([]))
  }, [serverUrl, isAuthenticated])

  const statusLabel = status === 'syncing' ? 'Syncing…'
    : mode === 'synced' ? 'Synced'
    : mode === 'offline' ? 'Offline'
    : 'Local only'
  const statusColor = mode === 'synced' ? 'var(--color-success)'
    : mode === 'offline' ? 'var(--color-warning)'
    : 'var(--color-text-muted)'

  function handleSaveUrl() {
    const trimmed = urlInput.trim().replace(/\/$/, '')
    setServerUrl(trimmed || null)
    if (!trimmed) syncEngine.stop()
  }

  async function handleSyncNow() {
    setSyncing(true)
    syncEngine.stop()
    syncEngine.start()
    await new Promise<void>(r => setTimeout(r, 1500))
    setSyncing(false)
  }

  function handleSignOut() {
    clearAuth()
    syncEngine.stop()
    setServerUsers([])
    setPassword('')
    setAuthError('')
    setPanel('pick')
  }

  function handlePickUser(u: ServerUser) {
    setSelectedUser(u)
    setEmail(u.email)
    setName('')
    setPassword('')
    setAuthError('')
    setPanel('login')
  }

  async function handleLogin() {
    if (!serverUrl) return
    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await apiFetch<AuthResponse>(serverUrl, '/auth/login', { email, password })
      setAuth({ id: res.user.id, email: res.user.email, name: res.user.name, avatarUrl: res.user.avatarUrl ?? null, createdAt: res.user.createdAt ?? new Date().toISOString() }, res.accessToken, res.refreshToken)
      setPassword('')
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleRegister() {
    if (!serverUrl) return
    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await apiFetch<AuthResponse>(serverUrl, '/auth/register', { email, name, password })
      setAuth({ id: res.user.id, email: res.user.email, name: res.user.name, avatarUrl: res.user.avatarUrl ?? null, createdAt: res.user.createdAt ?? new Date().toISOString() }, res.accessToken, res.refreshToken)
      setPassword('')
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const inputStyle = { ...({} as React.CSSProperties), width: '100%' }

  return (
    <Section title="Sync & Account" icon={<Link size={15} />}>
      <Row label="Server URL" hint="Your Braindump sync service endpoint (optional)">
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveUrl()}
            placeholder="http://192.168.1.x:3001"
            className={s.metaInput}
            style={{ width: 280 }}
          />
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={handleSaveUrl}>Save</button>
          {serverUrl && (
            <button className={`${s.btn} ${s.btnGhost}`} onClick={() => { setUrlInput(''); setServerUrl(null) }}>Clear</button>
          )}
        </div>
      </Row>

      {serverUrl && (
        <>
          <Row label="Status">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', color: statusColor }}>{statusLabel}</span>
              {lastSynced && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  · {new Date(lastSynced).toLocaleString()}
                </span>
              )}
              {serverVersion && (
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--color-surface)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                  v{serverVersion}
                </span>
              )}
              <button
                className={`${s.btn} ${s.btnGhost} ${s.btnIcon}`}
                onClick={() => { void handleSyncNow() }}
                disabled={syncing}
                title="Sync now"
              >
                <RefreshCw size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : undefined }} />
              </button>
            </div>
          </Row>

          {isAuthenticated && user ? (
            <Row label="Account">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{user.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{user.email}</span>
                <button className={`${s.btn} ${s.btnGhost}`} onClick={handleSignOut} style={{ fontSize: '0.8rem' }}>
                  <LogOut size={12} /> Sign out
                </button>
              </div>
            </Row>
          ) : (
            <div style={{ marginBottom: '0.875rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text)', marginBottom: '0.75rem' }}>Account</div>

              {/* Profile picker */}
              {panel === 'pick' && (
                <div>
                  {serverUsers.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>
                        <Users size={11} style={{ display: 'inline', marginRight: 4 }} />Profiles on this server
                      </div>
                      {serverUsers.map(u => (
                        <button
                          key={u.id}
                          className={`${s.btn} ${s.btnGhost}`}
                          onClick={() => handlePickUser(u)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'flex-start', marginBottom: '0.3rem', padding: '0.4rem 0.6rem' }}
                        >
                          <User size={13} />
                          <span style={{ fontWeight: 500 }}>{u.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {serverUsers.length === 0 && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', alignSelf: 'center', marginRight: '0.25rem' }}>No profiles yet.</span>
                    )}
                    <button className={`${s.btn} ${s.btnGhost}`} onClick={() => { setEmail(''); setName(''); setPassword(''); setAuthError(''); setPanel('register') }}>
                      <UserPlus size={13} /> New profile
                    </button>
                    {serverUsers.length > 0 && (
                      <button className={`${s.btn} ${s.btnGhost}`} onClick={() => { setSelectedUser(null); setEmail(''); setPassword(''); setAuthError(''); setPanel('login') }}>
                        <User size={13} /> Sign in
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Login form */}
              {panel === 'login' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: 320 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {selectedUser ? `Signing in as ${selectedUser.name}` : 'Sign in'}
                  </div>
                  {!selectedUser && (
                    <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className={s.metaInput} style={inputStyle} />
                  )}
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && void handleLogin()} placeholder="Password" className={s.metaInput} style={inputStyle} autoFocus />
                  {authError && <span style={{ fontSize: '0.75rem', color: 'var(--color-error)' }}>{authError}</span>}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => { void handleLogin() }} disabled={authLoading || !password}>
                      {authLoading ? 'Signing in…' : 'Sign in'}
                    </button>
                    <button className={`${s.btn} ${s.btnGhost}`} onClick={() => { setPanel('pick'); setAuthError('') }}>Back</button>
                  </div>
                </div>
              )}

              {/* Register form */}
              {panel === 'register' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: 320 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Create a new profile</div>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className={s.metaInput} style={inputStyle} autoFocus />
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className={s.metaInput} style={inputStyle} />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && void handleRegister()} placeholder="Password" className={s.metaInput} style={inputStyle} />
                  {authError && <span style={{ fontSize: '0.75rem', color: 'var(--color-error)' }}>{authError}</span>}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => { void handleRegister() }} disabled={authLoading || !name || !email || !password}>
                      {authLoading ? 'Creating…' : 'Create profile'}
                    </button>
                    <button className={`${s.btn} ${s.btnGhost}`} onClick={() => { setPanel('pick'); setAuthError('') }}>Back</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Section>
  )
}

// ---- Custom Note Types ----
interface NewTypeForm {
  label: string
  color: string
  icon: string
}

const EMPTY_FORM: NewTypeForm = { label: '', color: '#6366f1', icon: 'FileText' }

function CustomTypesSection() {
  const [customTypes, setCustomTypes] = useState<CustomNoteTypeRecord[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewTypeForm>(EMPTY_FORM)
  const { serverUrl } = useSyncStore()

  useEffect(() => {
    getAllCustomNoteTypes().then(setCustomTypes).catch(console.error)
  }, [])

  async function handleCreate() {
    if (!form.label.trim()) return
    const now = new Date().toISOString()
    const definition = {
      label: form.label.trim(),
      color: form.color,
      icon: form.icon,
      metadataFields: [],
      defaultMetadata: {},
      contentTemplate: { type: 'doc', content: [{ type: 'paragraph' }] },
      calendarDateField: null,
      searchableMetadataFields: [],
      isCalendarEvent: false,
      startTimeField: null,
      endTimeField: null,
      allDayDefault: false,
    }
    let record: CustomNoteTypeRecord
    if (serverUrl) {
      try {
        record = await apiClient.post<CustomNoteTypeRecord>('/note-types/custom', definition)
      } catch {
        record = { id: crypto.randomUUID(), userId: 'local', ...definition, createdAt: now, updatedAt: now }
      }
    } else {
      record = { id: crypto.randomUUID(), userId: 'local', ...definition, createdAt: now, updatedAt: now }
    }
    await saveCustomNoteType(record)
    const updated = await getAllCustomNoteTypes()
    setCustomTypes(updated)
    initRegistry(updated)
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    if (serverUrl) {
      try { await apiClient.delete(`/note-types/custom/${id}`) } catch { /* ignore */ }
    }
    await deleteCustomNoteType(id)
    const updated = await getAllCustomNoteTypes()
    setCustomTypes(updated)
    initRegistry(updated)
  }

  return (
    <Section title="Custom Note Types" icon={<Puzzle size={15} />}>
      {customTypes.length === 0 && !showForm && (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          No custom types yet. Create one to extend the note type picker.
        </p>
      )}

      {customTypes.map(t => (
        <div
          key={t.id}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.5rem 0.75rem', marginBottom: '0.4rem',
            background: 'var(--color-surface)', borderRadius: 'var(--radius)',
            border: '1px solid var(--color-border)',
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{t.label}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{t.icon}</span>
          <button
            className={`${s.btn} ${s.btnGhost} ${s.btnIcon}`}
            onClick={() => { void handleDelete(t.id) }}
            title="Delete"
            style={{ color: 'var(--color-error)' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {showForm ? (
        <div style={{ padding: '1rem', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <div className={s.metaLabel} style={{ marginBottom: '0.3rem' }}>Name</div>
              <input
                autoFocus
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') void handleCreate() }}
                placeholder="e.g. Book Note"
                className={s.metaInput}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div>
                <div className={s.metaLabel} style={{ marginBottom: '0.3rem' }}>Color</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    style={{ width: 36, height: 32, borderRadius: 4, border: '1px solid var(--color-border)', cursor: 'pointer', padding: 2 }}
                  />
                  <code style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{form.color}</code>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div className={s.metaLabel} style={{ marginBottom: '0.3rem' }}>Icon</div>
                <select
                  value={form.icon}
                  onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                  className={s.metaInput}
                  style={{ width: '100%' }}
                >
                  {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
              <button className={`${s.btn} ${s.btnGhost}`} onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>Cancel</button>
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => { void handleCreate() }} disabled={!form.label.trim()}>Create</button>
            </div>
          </div>
        </div>
      ) : (
        <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setShowForm(true)} style={{ marginTop: '0.25rem' }}>
          <Plus size={13} /> New custom type
        </button>
      )}
    </Section>
  )
}

// ---- Collections ----
function CollectionsSection() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [newName, setNewName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const { serverUrl } = useSyncStore()

  useEffect(() => {
    getAllCollections().then(setCollections).catch(console.error)
  }, [])

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    if (serverUrl) {
      try {
        const created = await apiClient.post<Collection>('/collections', { name })
        await saveCollection(created)
        const updated = await getAllCollections()
        setCollections(updated)
        useCollectionsStore.getState().setCollections(updated)
      } catch {
        const col: Collection = { id, userId: 'local', name, topicId: null, parentId: null, createdAt: now }
        await saveCollection(col)
        const updated = await getAllCollections()
        setCollections(updated)
        useCollectionsStore.getState().setCollections(updated)
      }
    } else {
      const col: Collection = { id, userId: 'local', name, topicId: null, parentId: null, createdAt: now }
      await saveCollection(col)
      const updated = await getAllCollections()
      setCollections(updated)
      useCollectionsStore.getState().setCollections(updated)
    }
    setNewName('')
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    if (serverUrl) {
      try { await apiClient.delete(`/collections/${id}`) } catch { /* ignore */ }
    }
    await deleteCollection(id)
    const updated = await getAllCollections()
    setCollections(updated)
    useCollectionsStore.getState().setCollections(updated)
  }

  return (
    <Section title="Collections" icon={<FolderOpen size={15} />}>
      {collections.length === 0 && !showForm && (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          No collections yet. Create one to organise your notes.
        </p>
      )}

      {collections.map((c) => (
        <div
          key={c.id}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.5rem 0.75rem', marginBottom: '0.4rem',
            background: 'var(--color-surface)', borderRadius: 'var(--radius)',
            border: '1px solid var(--color-border)',
          }}
        >
          <FolderOpen size={13} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{c.name}</span>
          <button
            className={`${s.btn} ${s.btnGhost} ${s.btnIcon}`}
            onClick={() => { void handleDelete(c.id) }}
            title="Delete collection"
            style={{ color: 'var(--color-error)' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {showForm ? (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); if (e.key === 'Escape') { setShowForm(false); setNewName('') } }}
            placeholder="Collection name"
            className={s.metaInput}
            style={{ flex: 1 }}
          />
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => { void handleCreate() }} disabled={!newName.trim()}>Create</button>
          <button className={`${s.btn} ${s.btnGhost}`} onClick={() => { setShowForm(false); setNewName('') }}>Cancel</button>
        </div>
      ) : (
        <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setShowForm(true)} style={{ marginTop: '0.25rem' }}>
          <Plus size={13} /> New collection
        </button>
      )}
    </Section>
  )
}

// ---- Topics ----
function TopicsSection() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [showForm, setShowForm] = useState(false)
  const { serverUrl } = useSyncStore()

  useEffect(() => {
    getAllTopics().then(setTopics).catch(console.error)
  }, [])

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    let topic: Topic
    if (serverUrl) {
      try {
        topic = await apiClient.post<Topic>('/topics', { name, color: newColor })
      } catch {
        topic = { id, userId: 'local', name, color: newColor, createdAt: now }
      }
    } else {
      topic = { id, userId: 'local', name, color: newColor, createdAt: now }
    }
    await saveTopic(topic)
    const updated = await getAllTopics()
    setTopics(updated)
    useCollectionsStore.getState().setTopics(updated)
    setNewName('')
    setNewColor('#6366f1')
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    if (serverUrl) {
      try { await apiClient.delete(`/topics/${id}`) } catch { /* ignore */ }
    }
    await deleteTopic(id)
    const updated = await getAllTopics()
    setTopics(updated)
    useCollectionsStore.getState().setTopics(updated)
  }

  return (
    <Section title="Topics" icon={<Palette size={15} />}>
      {topics.length === 0 && !showForm && (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          No topics yet. Topics are high-level groupings above collections.
        </p>
      )}

      {topics.map((t) => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.5rem 0.75rem', marginBottom: '0.4rem',
          background: 'var(--color-surface)', borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border)',
        }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color ?? '#6366f1', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{t.name}</span>
          <button
            className={`${s.btn} ${s.btnGhost} ${s.btnIcon}`}
            onClick={() => { void handleDelete(t.id) }}
            title="Delete topic"
            style={{ color: 'var(--color-error)' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {showForm ? (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); if (e.key === 'Escape') { setShowForm(false); setNewName('') } }}
            placeholder="Topic name"
            className={s.metaInput}
            style={{ flex: 1 }}
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            style={{ width: 36, height: 32, borderRadius: 4, border: '1px solid var(--color-border)', cursor: 'pointer', padding: 2 }}
          />
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => { void handleCreate() }} disabled={!newName.trim()}>Create</button>
          <button className={`${s.btn} ${s.btnGhost}`} onClick={() => { setShowForm(false); setNewName('') }}>Cancel</button>
        </div>
      ) : (
        <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setShowForm(true)} style={{ marginTop: '0.25rem' }}>
          <Plus size={13} /> New topic
        </button>
      )}
    </Section>
  )
}

// ---- Main ----
export function SettingsPage() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem', maxWidth: 700 }}>
      <h1 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '2rem' }}>Settings</h1>
      <AppearanceSection />
      <SyncSection />
      <TopicsSection />
      <CollectionsSection />
      <CustomTypesSection />
    </div>
  )
}
