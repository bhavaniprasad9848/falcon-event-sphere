import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useMeta } from '../lib/useMeta'
import InterestPicker from '../components/InterestPicker'
import type { Role } from '../types'

export default function AuthPage() {
  const { login, register } = useAuth()
  const meta = useMeta()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '', role: 'student' as Role })
  const [interests, setInterests] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') await login(form.email, form.password)
      else await register({ ...form, interests })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>{mode === 'login' ? 'Welcome back' : 'Join Falcon Event Sphere'}</h1>
        <p className="muted">{mode === 'login' ? 'Log in to RSVP and get picks made for you.' : 'Tell us what you like and we’ll find events for you.'}</p>

        {mode === 'register' && (
          <>
            <label>Full name<input value={form.name} onChange={set('name')} required /></label>
            <div className="role-toggle">
              {(['student', 'organizer'] as Role[]).map((r) => (
                <button type="button" key={r} className={form.role === r ? 'on' : ''} onClick={() => setForm({ ...form, role: r })}>
                  {r === 'student' ? '🎓 Student' : '📣 Organizer'}
                </button>
              ))}
            </div>
          </>
        )}
        <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
        <label>Password<input type="password" value={form.password} onChange={set('password')} minLength={mode === 'register' ? 8 : undefined} required /></label>
        {mode === 'register' && (
          <>
            <label>Department <span className="muted">(optional)</span><input value={form.department} onChange={set('department')} placeholder="e.g. Computer Science" /></label>
            <div className="field">
              <span className="label">Your interests</span>
              <InterestPicker value={interests} onChange={setInterests} suggestions={meta?.interestSuggestions ?? []} />
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
        <button type="button" className="link-btn center-text" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
        </button>
        {mode === 'login' && (
          <p className="muted small center-text">Demo: student@falcon.dev or organizer@falcon.dev · password123</p>
        )}
      </form>
    </main>
  )
}
