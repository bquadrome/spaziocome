import { Component, useEffect, useState } from 'react'
import AdminCalendar from './AdminCalendar.jsx'
import AdminEvent from './AdminEvent.jsx'
import AdminGuests from './AdminGuests.jsx'
import AdminLogin from './AdminLogin.jsx'
import { SERVICES } from '../../data/services.js'
import { useBookingStore } from '../../store/bookingStore.js'
import { supabase } from '../../lib/supabase.js'

class AdminCrash extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      const err = this.state.error
      return (
        <div className="admin" style={{ padding: 32 }}>
          <h1>Errore admin</h1>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#b00020', fontSize: 13 }}>
            {String(err?.stack || err?.message || err)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

function parseAdmin(path) {
  if (path.startsWith('/admin/evento/')) {
    return { view: 'event', id: path.slice('/admin/evento/'.length) }
  }
  if (path.startsWith('/admin/ospiti')) {
    return { view: 'guests', id: '' }
  }
  return { view: 'calendar', id: '' }
}

export default function AdminApp({ path }) {
  return (
    <AdminCrash>
      <AdminShell path={path} />
    </AdminCrash>
  )
}

function AdminShell({ path }) {
  const [session, setSession] = useState(undefined)
  const { events = {} } = useBookingStore()
  const route = parseAdmin(path || window.location.pathname)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const eventOk = SERVICES.some((item) => item.id === route.id)

  if (session === undefined) {
    return (
      <div className="admin">
        <p className="admin-empty">Caricamento…</p>
      </div>
    )
  }

  if (!session) return <AdminLogin />

  return (
    <div className="admin">
      <header className="admin-bar">
        <a className="admin-logo" href="/admin">
          COME admin
        </a>
        <nav>
          <a href="/admin" className={route.view === 'calendar' ? 'is-on' : ''}>
            Calendario
          </a>
          <a href="/admin/ospiti" className={route.view === 'guests' ? 'is-on' : ''}>
            Ospiti
          </a>
          {SERVICES.map((item) => (
            <a
              key={item.id}
              href={`/admin/evento/${item.id}`}
              className={route.view === 'event' && route.id === item.id ? 'is-on' : ''}
            >
              {events[item.id]?.name ?? item.name}
            </a>
          ))}
        </nav>
        <button
          className="btn"
          type="button"
          onClick={() => supabase.auth.signOut()}
        >
          Esci
        </button>
        <a className="btn" href="/">
          Sito
        </a>
      </header>
      <div className="admin-body">
        {route.view === 'guests' ? (
          <AdminGuests />
        ) : route.view === 'event' && eventOk ? (
          <AdminEvent eventId={route.id} />
        ) : (
          <AdminCalendar />
        )}
      </div>
    </div>
  )
}
