/**
 * API client — thin fetch wrapper with automatic token refresh.
 * Only used when a sync server is configured. All UI reads from local store.
 */
import { useSyncStore } from '../stores/syncStore'
import { useAuthStore } from '../stores/authStore'

let refreshPromise: Promise<boolean> | null = null

async function tryRefreshToken(): Promise<boolean> {
  const { serverUrl } = useSyncStore.getState()
  const { refreshToken, user, setAuth, clearAuth } = useAuthStore.getState()
  if (!serverUrl || !refreshToken) { clearAuth(); return false }

  try {
    const res = await fetch(`${serverUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) { clearAuth(); return false }
    const data = await res.json() as { accessToken: string; refreshToken: string }
    if (user) setAuth(user, data.accessToken, data.refreshToken)
    return true
  } catch { clearAuth(); return false }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { serverUrl } = useSyncStore.getState()
  if (!serverUrl) throw new Error('No sync server configured')

  const { accessToken } = useAuthStore.getState()
  const res = await fetch(`${serverUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    // Deduplicate concurrent refresh attempts
    if (!refreshPromise) refreshPromise = tryRefreshToken().finally(() => { refreshPromise = null })
    const refreshed = await refreshPromise
    if (!refreshed) throw new Error(`API ${method} ${path} failed: 401 (token refresh failed)`)

    // Retry with new token
    const { accessToken: newToken } = useAuthStore.getState()
    const retry = await fetch(`${serverUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!retry.ok) throw new Error(`API ${method} ${path} failed: ${retry.status}`)
    return retry.json() as Promise<T>
  }

  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed: ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

/** Unauthenticated fetch — for login/register before we have a token */
export async function apiFetch<T>(serverUrl: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${serverUrl}${path}`, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}
