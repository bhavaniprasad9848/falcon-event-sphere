import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useMeta } from '../lib/useMeta'
import InterestPicker from '../components/InterestPicker'

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const meta = useMeta()
  const [name, setName] = useState(user!.name)
  const [department, setDepartment] = useState(user!.department)
  const [interests, setInterests] = useState(user!.interests)
  const [msg, setMsg] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    try {
      const { user: u } = await api.updateProfile({ name, department, interests })
      setUser(u)
      setMsg('Saved! Your recommendations will update.')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not save')
    }
  }

  return (
    <main className="page narrow">
      <form className="card form" onSubmit={save}>
        <h1>Your profile</h1>
        <p className="muted">{user!.email} · {user!.role === 'organizer' ? 'Organizer' : 'Student'}</p>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Department<input value={department} onChange={(e) => setDepartment(e.target.value)} /></label>
        <div className="field">
          <span className="label">Interests</span>
          <p className="muted small">These drive your recommendations on the Discover page.</p>
          <InterestPicker value={interests} onChange={setInterests} suggestions={meta?.interestSuggestions ?? []} />
        </div>
        {msg && <p className="small">{msg}</p>}
        <button className="btn primary">Save</button>
      </form>
    </main>
  )
}
