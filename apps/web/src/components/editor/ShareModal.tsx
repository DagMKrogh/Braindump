import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../../lib/api'
import { useSyncStore } from '../../stores/syncStore'
import s from '../../styles/layout.module.css'

interface ShareLink {
  id: string
  slug: string
  expiresAt: string | null
  createdAt: string
  isActive: boolean
}

interface Props {
  noteId: string
  onClose: () => void
}

export function ShareModal({ noteId, onClose }: Props) {
  const serverUrl = useSyncStore((st) => st.serverUrl)
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const shareUrl = (slug: string) =>
    `${window.location.origin}/share/${slug}`

  const fetchLinks = useCallback(async () => {
    try {
      const data = await apiClient.get<ShareLink[]>(`/notes/${noteId}/share`)
      setLinks(data.filter((l) => l.isActive))
    } catch {
      // ignore — server may not be configured
    } finally {
      setLoading(false)
    }
  }, [noteId])

  useEffect(() => { void fetchLinks() }, [fetchLinks])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const link = await apiClient.post<ShareLink>(`/notes/${noteId}/share`, {})
      setLinks((prev) => [link, ...prev])
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string, slug: string) => {
    await apiClient.delete(`/notes/${noteId}/share/${id}`)
    setLinks((prev) => prev.filter((l) => l.slug !== slug))
  }

  const handleCopy = async (slug: string) => {
    await navigator.clipboard.writeText(shareUrl(slug))
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className={s.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={s.modalBox}>
        <div className={s.modalHeader}>
          <span className={s.modalTitle}>Share note</span>
          <button className={`${s.btn} ${s.btnGhost} ${s.btnIcon}`} onClick={onClose}>✕</button>
        </div>

        <div className={s.modalBody}>
          {!serverUrl && (
            <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>
              Share links require the sync service to be configured in Settings.
            </p>
          )}

          {serverUrl && (
            <>
              <button
                className={`${s.btn} ${s.btnPrimary}`}
                onClick={handleCreate}
                disabled={creating}
                style={{ alignSelf: 'flex-start' }}
              >
                {creating ? 'Creating…' : '+ Create share link'}
              </button>

              {loading && (
                <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>Loading…</p>
              )}

              {!loading && links.length === 0 && (
                <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>
                  No active share links. Create one to share this note.
                </p>
              )}

              {links.map((link) => (
                <div key={link.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className={s.shareLinkRow}>
                    <span className={s.shareLinkUrl}>{shareUrl(link.slug)}</span>
                    <button
                      className={`${s.btn} ${s.btnGhost}`}
                      style={{ flexShrink: 0, fontSize: '0.75rem' }}
                      onClick={() => handleCopy(link.slug)}
                    >
                      {copied === link.slug ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={s.shareLinkMeta}>
                      Created {new Date(link.createdAt).toLocaleDateString()}
                      {link.expiresAt && ` · Expires ${new Date(link.expiresAt).toLocaleDateString()}`}
                    </span>
                    <button
                      className={`${s.btn} ${s.btnGhost}`}
                      style={{ fontSize: '0.75rem', color: 'var(--color-error)' }}
                      onClick={() => handleRevoke(link.id, link.slug)}
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
