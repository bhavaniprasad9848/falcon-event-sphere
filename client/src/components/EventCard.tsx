import { Link } from 'react-router-dom'
import type { EventItem } from '../types'
import { categoryColors, formatDate, formatTime } from '../lib/format'

export function Banner({ event, tall }: { event: EventItem; tall?: boolean }) {
  const [a, b] = categoryColors(event.category)
  const style = event.imageUrl
    ? { backgroundImage: `linear-gradient(to top, rgba(0,0,0,.45), transparent), url("${event.imageUrl}")` }
    : { backgroundImage: `linear-gradient(135deg, ${a}, ${b})` }
  const d = new Date(event.startsAt)
  return (
    <div className={`banner ${tall ? 'banner-tall' : ''}`} style={style}>
      <div className="date-chip">
        <span>{d.toLocaleString(undefined, { month: 'short' }).toUpperCase()}</span>
        <strong>{d.getDate()}</strong>
      </div>
      <span className="cat-badge">{event.category}</span>
    </div>
  )
}

export function SeatsInfo({ event }: { event: EventItem }) {
  if (event.cancelled) return <span className="pill pill-danger">Cancelled</span>
  if (event.capacity == null) return <span className="muted small">{event.goingCount} going</span>
  if (event.seatsLeft === 0) return <span className="pill pill-danger">Full</span>
  const low = (event.seatsLeft ?? 0) <= Math.max(3, event.capacity * 0.1)
  return <span className={low ? 'pill pill-warn' : 'muted small'}>{event.seatsLeft} of {event.capacity} spots left</span>
}

export default function EventCard({ event, reason }: { event: EventItem; reason?: string }) {
  return (
    <Link to={`/events/${event.id}`} className="event-card">
      <Banner event={event} />
      <div className="event-card-body">
        <h3>{event.title}</h3>
        <p className="muted small">
          {formatDate(event.startsAt)} · {formatTime(event.startsAt)} · {event.location.name}
        </p>
        {reason && <p className="reason">✨ {reason}</p>}
        <div className="row between">
          <SeatsInfo event={event} />
          {event.myRsvp && <span className="pill pill-ok">{event.myRsvp === 'going' ? '✓ Going' : '★ Interested'}</span>}
        </div>
      </div>
    </Link>
  )
}
