import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import EventCard from '../components/EventCard'
import type { EventItem } from '../types'

type Tab = 'going' | 'interested' | 'hosting'

export default function MyEventsPage() {
  const { user } = useAuth()
  const [data, setData] = useState<Record<Tab, EventItem[]> | null>(null)
  const [now] = useState(() => Date.now())
  const [tab, setTab] = useState<Tab>(user?.role === 'organizer' ? 'hosting' : 'going')

  useEffect(() => {
    api.myEvents().then(setData)
  }, [])

  const tabs: Tab[] = user?.role === 'organizer' ? ['hosting', 'going', 'interested'] : ['going', 'interested']
  const list = data?.[tab] ?? []
  const upcoming = list.filter((e) => new Date(e.endsAt).getTime() >= now)
  const past = list.filter((e) => new Date(e.endsAt).getTime() < now)

  return (
    <main className="page">
      <h1>My events</h1>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)} {data && <span className="count">{data[t].length}</span>}
          </button>
        ))}
      </div>
      {!data ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="muted">
          Nothing here yet. {tab === 'hosting' ? <Link to="/events/new">Create your first event</Link> : <Link to="/">Find something to do</Link>}
        </p>
      ) : (
        <>
          <div className="grid">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
          {past.length > 0 && (
            <>
              <h2 className="muted">Past</h2>
              <div className="grid faded">{past.map((e) => <EventCard key={e.id} event={e} />)}</div>
            </>
          )}
        </>
      )}
    </main>
  )
}
