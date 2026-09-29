import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useMeta } from '../lib/useMeta'
import { toLocalInput } from '../lib/format'
import type { EventInput } from '../types'

const blank = { title: '', description: '', category: 'Tech', tags: '', place: '', address: '', startsAt: '', endsAt: '', capacity: '', imageUrl: '' }

export default function EventFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const meta = useMeta()
  const navigate = useNavigate()
  const [f, setF] = useState(blank)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  useEffect(() => {
    if (!id) return
    api.getEvent(id).then(({ event: e }) =>
      setF({
        title: e.title, description: e.description, category: e.category, tags: e.tags.join(', '),
        place: e.location.name, address: e.location.address,
        startsAt: toLocalInput(e.startsAt), endsAt: toLocalInput(e.endsAt),
        capacity: e.capacity == null ? '' : String(e.capacity), imageUrl: e.imageUrl,
      }),
    )
  }, [id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const body: EventInput = {
      title: f.title,
      description: f.description,
      category: f.category,
      tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
      location: { name: f.place, address: f.address },
      startsAt: new Date(f.startsAt).toISOString(),
      endsAt: new Date(f.endsAt).toISOString(),
      capacity: f.capacity ? Number(f.capacity) : null,
      imageUrl: f.imageUrl.trim(),
    }
    try {
      const { event } = id ? await api.updateEvent(id, body) : await api.createEvent(body)
      navigate(`/events/${event.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page narrow">
      <form className="card form" onSubmit={submit}>
        <h1>{editing ? 'Edit event' : 'Create an event'}</h1>
        <label>Title<input value={f.title} onChange={set('title')} required minLength={3} /></label>
        <label>Description<textarea rows={5} value={f.description} onChange={set('description')} required minLength={10} /></label>
        <div className="two">
          <label>Category
            <select value={f.category} onChange={set('category')}>
              {(meta?.categories ?? []).map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Tags <span className="muted">(comma separated)</span><input value={f.tags} onChange={set('tags')} placeholder="AI, Python, Beginner" /></label>
        </div>
        <div className="two">
          <label>Place<input value={f.place} onChange={set('place')} required placeholder="Library Room 204" /></label>
          <label>Address <span className="muted">(optional)</span><input value={f.address} onChange={set('address')} /></label>
        </div>
        <div className="two">
          <label>Starts<input type="datetime-local" value={f.startsAt} onChange={set('startsAt')} required /></label>
          <label>Ends<input type="datetime-local" value={f.endsAt} onChange={set('endsAt')} required /></label>
        </div>
        <div className="two">
          <label>Capacity <span className="muted">(blank = unlimited)</span><input type="number" min={1} value={f.capacity} onChange={set('capacity')} /></label>
          <label>Image URL <span className="muted">(optional)</span><input type="url" value={f.imageUrl} onChange={set('imageUrl')} placeholder="https://…" /></label>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Publish event'}</button>
          <button type="button" className="btn" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </main>
  )
}
