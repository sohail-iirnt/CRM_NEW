import { useState } from 'react'
import { useAuth } from '../auth.jsx'

export default function Login() {
  const { login, error, firebaseConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  async function submit(e) { e.preventDefault(); setBusy(true); setLocalError(''); try { await login(email.trim(), password) } catch (err) { setLocalError(err.message) } finally { setBusy(false) } }
  return <main className="login-page"><section className="login-card"><div className="brand large"><span className="brand-mark">C</span><div><strong>CRM SAIDHARA</strong><small>Operations Platform</small></div></div><h1>Sign in</h1><p className="muted">Use your assigned account to access your operational workspace.</p>{!firebaseConfigured && <div className="notice warning">Firebase is not configured yet. Add the VITE_FIREBASE_* values from <code>.env.example</code> to your local <code>.env.local</code>.</div>}<form onSubmit={submit}><label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></label>{(error || localError) && <div className="error-box">{error || localError}</div>}<button className="primary full" disabled={busy || !firebaseConfigured}>{busy ? 'Signing in…' : 'Sign in'}</button></form></section></main>
}
