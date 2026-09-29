import { NavLink, Navigate, Route, Routes, Link } from 'react-router-dom'
import { useAuth } from './lib/auth'
import AuthPage from './pages/AuthPage'
import DiscoverPage from './pages/DiscoverPage'
import EventPage from './pages/EventPage'
import EventFormPage from './pages/EventFormPage'
import MyEventsPage from './pages/MyEventsPage'
import ProfilePage from './pages/ProfilePage'

export default function App() {
  const { user, loading, logout } = useAuth()
  if (loading) return <div className="center muted">Loading…</div>

  return (
    <div className="app">
      <header className="nav">
        <Link to="/" className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} /> Falcon <span>Event Sphere</span>
        </Link>
        <nav>
          <NavLink to="/" end>Discover</NavLink>
          {user && <NavLink to="/my-events">My Events</NavLink>}
          {user?.role === 'organizer' && <NavLink to="/events/new">+ Create</NavLink>}
          {user ? (
            <>
              <NavLink to="/profile">{user.name.split(' ')[0]}</NavLink>
              <button className="link-btn" onClick={logout}>Log out</button>
            </>
          ) : (
            <NavLink to="/login" className="btn gold small">Log in</NavLink>
          )}
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<DiscoverPage />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route path="/events/new" element={user?.role === 'organizer' ? <EventFormPage /> : <Navigate to="/" replace />} />
        <Route path="/events/:id" element={<EventPage />} />
        <Route path="/events/:id/edit" element={user ? <EventFormPage /> : <Navigate to="/login" replace />} />
        <Route path="/my-events" element={user ? <MyEventsPage /> : <Navigate to="/login" replace />} />
        <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <footer className="footer muted small">Falcon Event Sphere · Find your next campus event</footer>
    </div>
  )
}
