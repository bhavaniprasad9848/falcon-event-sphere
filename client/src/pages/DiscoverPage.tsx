import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type EventQuery } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useMeta } from '../lib/useMeta'
import EventCard from '../components/EventCard'
import type { EventItem, Recommendation } from '../types'

const SOURCE_LABEL = {
  ai: '✨ AI picks for you',
  personalized: '🎯 Picked for you',
  popular: '🔥 Popular this week',
} as const

export default function DiscoverPage() {
  const { user } = useAuth()
  const meta = useMeta()
  const [recs, setRecs] = useState<{ source: keyof typeof SOURCE_LABEL; items: Recommendation[] } | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [pages, setPages] = useState(1)
  const [query, setQuery] = useState<EventQuery>({ q: '', category: '', sort: 'soonest', page: 1 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) api.recommendations().then(setRecs).catch(() => setRecs(null))
  }, [user])

  // Wait until the user stops typing for 300ms before searching
  useEffect(() => {
    const t = setTimeout(() => setQuery((q) => (q.q === search ? q : { ...q, q: search, page: 1 })), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let stale = false
    api
      .listEvents(query)
      .then((r) => {
        if (stale) return
        setEvents((prev) => (query.page === 1 ? r.events : [...prev, ...r.events]))
        setPages(r.pages)
      })
      .finally(() => !stale && setLoading(false))
    return () => {
      stale = true
    }
  }, [query])

  const update = (patch: Partial<EventQuery>) => setQuery((q) => ({ ...q, ...patch, page: 1 }))

  return (
    <main className="page">
      <section className="hero">
        <h1>What’s happening on campus</h1>
        <p>Workshops, games, career fairs and more, with picks made for you.</p>
        <input className="search" placeholder="Search events, topics or places…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </section>

      {user && recs && recs.items.length > 0 && (
        <section>
          <div className="row between">
            <h2>{SOURCE_LABEL[recs.source]}</h2>
            {recs.source === 'popular' && <Link to="/profile" className="small">Add interests to personalize →</Link>}
          </div>
          <div className="scroller">
            {recs.items.map((r) => <EventCard key={r.event.id} event={r.event} reason={r.reason} />)}
          </div>
        </section>
      )}
      {!user && (
        <div className="callout">
          <strong>Get personal recommendations.</strong> <Link to="/login">Create a free account</Link> and tell us your interests.
        </div>
      )}

      <section>
        <div className="row between wrap">
          <h2>All upcoming events</h2>
          <select value={query.sort} onChange={(e) => update({ sort: e.target.value as EventQuery['sort'] })}>
            <option value="soonest">Soonest first</option>
            <option value="popular">Most popular</option>
          </select>
        </div>
        <div className="chips">
          {['', ...(meta?.categories ?? [])].map((c) => (
            <button key={c || 'all'} className={`chip ${query.category === c ? 'chip-on' : ''}`} onClick={() => update({ category: c })}>
              {c || 'All'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="muted">Loading events…</p>
        ) : events.length === 0 ? (
          <p className="muted">No events match. Try another search or category.</p>
        ) : (
          <div className="grid">
            {events.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}
        {(query.page ?? 1) < pages && (
          <div className="center-text">
            <button className="btn" onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}>Load more</button>
          </div>
        )}
      </section>
    </main>
  )
}
