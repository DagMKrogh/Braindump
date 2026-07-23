import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { syncEngine } from '../lib/sync'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const params = new URLSearchParams(hash)
    const token = params.get('token')
    const user = params.get('user')

    if (token && user) {
      try {
        const parsed = JSON.parse(decodeURIComponent(user))
        setAuth(parsed, token, '')
        syncEngine.start()
        navigate('/notes', { replace: true })
      } catch {
        navigate('/notes', { replace: true })
      }
    } else {
      navigate('/notes', { replace: true })
    }
  }, [navigate, setAuth])

  return <div style={{ padding: '2rem' }}>Signing in…</div>
}
