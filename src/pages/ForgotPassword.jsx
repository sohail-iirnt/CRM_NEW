import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function ForgotPassword() {
  const { resetPassword, firebaseConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [localError, setLocalError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setSent(false)
    setLocalError('')
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err) {
      setLocalError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return <main className="login-page"><section className="login-card recovery-card"><div className="brand large"><span className="brand-mark">C</span><div><strong>CRM SAIDHARA</strong><small>Operations Platform</small></div></div><div className="login-intro"><span className="login-eyebrow">ACCOUNT RECOVERY</span><h1>Forgot password?</h1><p className="muted">Enter your CRM email address and we'll send you a secure password reset link.</p></div>{!firebaseConfigured && <div className="notice warning">Firebase is not configured yet. Add the VITE_FIREBASE_* values from <code>.env.example</code> to your local <code>.env.local</code>.</div>}<form onSubmit={submit}><label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@company.com" /></label>{localError && <div className="error-box">{localError}</div>}{sent && <div className="success-box"><strong>Reset email sent.</strong><span>Check your inbox and follow the password reset link. If you don't see it, check your spam or junk folder.</span></div>}<button className="primary full login-submit" disabled={busy || !firebaseConfigured}>{busy ? 'Sending reset link…' : 'Send reset link'}</button></form><Link className="back-login" to="/login">← Back to sign in</Link><div className="login-footer">CRM SAIDHARA · Authorized users only</div></section></main>
}
