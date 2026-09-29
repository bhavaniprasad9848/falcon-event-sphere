import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatRange, mapsUrl } from '../lib/format'
import { Banner, SeatsInfo } from '../components/EventCard'
import type { Attendee, EventItem, RsvpStatus } from '../types'

export default function EventPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [event, setEvent] = useState<EventItem | null>(null)
  const [attendees, setAttendees] = useState<Attendee[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    api.getEvent(id).then((r) => setEvent(r.event)).catch(() => setError('Event not found'))
  }, [id, user])

  const isOwner = Boolean(user && event && event.organizer.id === user.id)
  useEffect(() => {
    if (isOwner) api.attendees(id).then((r) => setAttendees(r.attendees))
  }, [id, isOwner, event?.goingCount])

  async function act(fn: () => Promise<{ event: EventItem }>) {
    setError('')
    setBusy(true)
    try {
      setEvent((await fn()).event)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const rsvp = (status: RsvpStatus) => {
    if (!user) return navigate('/login')
    act(() => api.rsvp(id, status))
  }

  async function remove() {
    if (!confirm('Delete this event permanently? Everyone’s RSVPs will be removed.')) return
    await api.deleteEvent(id)
    navigate('/my-events')
  }

  if (error && !event) return <main className="page"><p className="error">{error}</p><Link to="/">← Back to events</Link></main>
  if (!event) return <main className="page muted">Loading…</main>

  const ended = new Date(event.endsAt).getTime() < now
  const full = event.seatsLeft === 0 && event.myRsvp !== 'going'
  const closed = event.cancelled || ended

  return (
    <main className="page narrow">
      <Link to="/" className="small">← All events</Link>
      <Banner event={event} tall />
      <div className="detail">
        <div className="detail-main">
          <h1>{event.title}</h1>
          <p className="muted">Hosted by {event.organizer.name}</p>
          {event.cancelled && <div className="callout danger">This event has been cancelled.</div>}
          <p className="description">{event.description}</p>
          {event.tags.length > 0 && (
            <div className="chips">{event.tags.map((t) => <span key={t} className="chip static">#{t}</span>)}</div>
          )}
        </div>

        <aside className="card detail-side">
          <div>
            <div className="label">When</div>
            <div>{formatRange(event.startsAt, event.endsAt)}</div>
            <a href={api.calendarUrl(event.id)} className="small">📅 Add to calendar</a>
          </div>
          <div>
            <div className="label">Where</div>
            <div>{event.location.name}</div>
            {event.location.address && <div className="muted small">{event.location.address}</div>}
            <a href={mapsUrl(event.location.name, event.location.address)} target="_blank" rel="noreferrer" className="small">🗺️ Open in Google Maps</a>
          </div>
          <div>
            <div className="label">Attendance</div>
            <SeatsInfo event={event} />
            {event.capacity != null && (
              <div className="bar"><div style={{ width: `${Math.min(100, (event.goingCount / event.capacity) * 100)}%` }} /></div>
            )}
            <div className="muted small">{event.goingCount} going · {event.interestedCount} interested</div>
          </div>

          {!isOwner && !closed && (
            <div className="rsvp">
              <button className={`btn ${event.myRsvp === 'going' ? 'primary' : ''}`} disabled={busy || full} onClick={() => rsvp('going')}>
                {event.myRsvp === 'going' ? '✓ Going' : full ? 'Full' : 'I’m going'}
              </button>
              <button className={`btn ${event.myRsvp === 'interested' ? 'gold' : ''}`} disabled={busy} onClick={() => rsvp('interested')}>
                {event.myRsvp === 'interested' ? '★ Interested' : 'Interested'}
              </button>
              {event.myRsvp && (
                <button className="link-btn small" disabled={busy} onClick={() => act(() => api.cancelRsvp(id))}>Remove my RSVP</button>
              )}
            </div>
          )}
          {ended && <p className="muted small">This event has ended.</p>}
          {error && <p className="error">{error}</p>}

          {isOwner && (
            <div className="rsvp">
              <Link to={`/events/${event.id}/edit`} className="btn">Edit event</Link>
              {!event.cancelled ? (
                <button className="btn" onClick={() => confirm('Cancel this event? Attendees will see it as cancelled.') && act(() => api.updateEvent(id, { cancelled: true }))}>
                  Cancel event
                </button>
              ) : (
                <button className="btn" onClick={() => act(() => api.updateEvent(id, { cancelled: false }))}>Restore event</button>
              )}
              <button className="link-btn small danger-text" onClick={remove}>Delete permanently</button>
            </div>
          )}
        </aside>
      </div>

      {isOwner && attendees && (
        <section className="card">
          <h2>Attendees ({attendees.length})</h2>
          {attendees.length === 0 ? (
            <p className="muted">No RSVPs yet.</p>
          ) : (
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Status</th></tr></thead>
              <tbody>
                {attendees.map((a) => (
                  <tr key={a.email}><td>{a.name}</td><td>{a.email}</td><td>{a.department || '—'}</td><td>{a.status}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  )
}
