import { Component, useEffect, useState } from 'react'
import AdminCalendar from './AdminCalendar.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import AdminEvent from './AdminEvent.jsx'
import AdminGuests from './AdminGuests.jsx'
import AdminLogin from './AdminLogin.jsx'
import AdminSite from './AdminSite.jsx'
import AdminSettings from './AdminSettings.jsx'
import AdminRequests, { OPEN_STATUSES } from './AdminRequests.jsx'
import AdminEvents from './AdminEvents.jsx'
import AdminEventEditor from './AdminEventEditor.jsx'
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

function SideIcon({ name }) {
  const paths = {
    dashboard: <path d="M3.8 10.4 12 3.6l8.2 6.8V20a1.4 1.4 0 0 1-1.4 1.4h-4.6v-6.2H9.8v6.2H5.2A1.4 1.4 0 0 1 3.8 20v-9.6z" />,
    calendar: (
      <path d="M8 2.8a1.1 1.1 0 0 1 1.1 1.1V5h5.8V3.9A1.1 1.1 0 1 1 17 3.9V5h1.3A2.2 2.2 0 0 1 20.5 7.2V19a2.2 2.2 0 0 1-2.2 2.2H5.7A2.2 2.2 0 0 1 3.5 19V7.2A2.2 2.2 0 0 1 5.7 5H7V3.9A1.1 1.1 0 0 1 8 2.8zM5.7 10.2V19h12.6v-8.8H5.7z" />
    ),
    guests: (
      <path d="M9 11.2a2.7 2.7 0 1 0-2.7-2.7 2.7 2.7 0 0 0 2.7 2.7zm6.3.5a2.2 2.2 0 1 0-2.2-2.2 2.2 2.2 0 0 0 2.2 2.2zM3.6 18.8c.4-2.8 2.5-4.2 5.4-4.2s5 1.4 5.4 4.2a1 1 0 0 1-1 .9H4.6a1 1 0 0 1-1-.9zm9.2-1.1c.1-1.6.9-2.8 2.2-3.5 1.8.2 3.2 1.3 3.7 3.6a.8.8 0 0 1-.8.8h-4.4a1.2 1.2 0 0 1-.7-.9z" />
    ),
    site: (
      <path d="M4 4.5h7.2v6.2H4V4.5zm8.8 0H20v3.4h-7.2V4.5zM12.8 9.4H20v10.1h-7.2V9.4zM4 12.2h7.2v7.3H4v-7.3z" />
    ),
    coworking: (
      <path d="M4 5.2h16a1.5 1.5 0 0 1 1.5 1.5v8.2A1.5 1.5 0 0 1 20 16.4H4a1.5 1.5 0 0 1-1.5-1.5V6.7A1.5 1.5 0 0 1 4 5.2zM9 18.2h6a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2z" />
    ),
    meeting: (
      <>
        <rect x="7" y="8.2" width="10" height="7.2" rx="1.6" />
        <rect x="9.6" y="4.4" width="4.8" height="2.5" rx="1.1" />
        <rect x="9.6" y="16.7" width="4.8" height="2.5" rx="1.1" />
        <rect x="3.2" y="10.2" width="2.5" height="3.4" rx="1.1" />
        <rect x="18.3" y="10.2" width="2.5" height="3.4" rx="1.1" />
      </>
    ),
    expo: (
      <path d="M5 4.8h14a1.6 1.6 0 0 1 1.6 1.6v11.2A1.6 1.6 0 0 1 19 19.2H5a1.6 1.6 0 0 1-1.6-1.6V6.4A1.6 1.6 0 0 1 5 4.8zm1.2 9.2 3.2-2.6 2.4 1.8 2-1.5 3.6 2.8V7.2H6.2v6.8zM8.6 9.6a1.3 1.3 0 1 0-1.3-1.3 1.3 1.3 0 0 0 1.3 1.3z" />
    ),
    siteEvents: (
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V9a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 15.5V13a2 2 0 0 0 0-4V6.5zm8 1.6-.9 1.9-2.1.3 1.5 1.4-.4 2.1 1.9-1 1.9 1-.4-2.1 1.5-1.4-2.1-.3-.9-1.9z" fillRule="evenodd" />
    ),
    requests: (
      <path d="M4.5 5h15A1.5 1.5 0 0 1 21 6.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4.2 3.3a.6.6 0 0 1-1-.5V17H4.5A1.5 1.5 0 0 1 3 15.5v-9A1.5 1.5 0 0 1 4.5 5zm3 4.2a1 1 0 0 0 0 2h9a1 1 0 0 0 0-2h-9zm0 3a1 1 0 0 0 0 2h5a1 1 0 0 0 0-2h-5z" fillRule="evenodd" />
    ),
    settings: (
      <path d="M10.3 2.8h3.4l.5 2.4a7.4 7.4 0 0 1 1.9 1.1l2.3-.8 1.7 2.9-1.8 1.6a7.6 7.6 0 0 1 0 2.2l1.8 1.6-1.7 2.9-2.3-.8a7.4 7.4 0 0 1-1.9 1.1l-.5 2.4h-3.4l-.5-2.4a7.4 7.4 0 0 1-1.9-1.1l-2.3.8-1.7-2.9 1.8-1.6a7.6 7.6 0 0 1 0-2.2L3.9 8.4l1.7-2.9 2.3.8a7.4 7.4 0 0 1 1.9-1.1l.5-2.4zM12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" fillRule="evenodd" />
    ),
    eu: (
      <path d="M3.2 6.2h6.4l1.8 2H20.6a1.5 1.5 0 0 1 1.5 1.5v10.2a1.5 1.5 0 0 1-1.5 1.5H3.2a1.5 1.5 0 0 1-1.5-1.5V7.7a1.5 1.5 0 0 1 1.5-1.5z" />
    ),
  }
  return (
    <svg className="admin-side-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] ?? paths.dashboard}
    </svg>
  )
}

function parseAdmin(path) {
  if (path.startsWith('/admin/evento/')) {
    return { view: 'event', id: path.slice('/admin/evento/'.length) }
  }
  if (path.startsWith('/admin/eventi/')) {
    const id = path.slice('/admin/eventi/'.length).replace(/\/$/, '')
    if (id) return { view: 'siteEvent', id }
  }
  if (path.startsWith('/admin/eventi')) return { view: 'siteEvents', id: '' }
  if (path.startsWith('/admin/calendario')) return { view: 'calendar', id: '' }
  if (path.startsWith('/admin/ospiti')) return { view: 'guests', id: '' }
  if (path.startsWith('/admin/sito')) return { view: 'site', id: '' }
  if (path.startsWith('/admin/impostazioni')) return { view: 'settings', id: '' }
  if (path.startsWith('/admin/richieste')) return { view: 'requests', id: '' }
  return { view: 'dashboard', id: '' }
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
  const { events = {}, requests = [] } = useBookingStore()
  const openRequests = requests.filter((item) => OPEN_STATUSES.includes(item.status)).length
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

  const links = [
    { href: '/admin', label: 'Dashboard', icon: 'dashboard', on: route.view === 'dashboard' },
    { href: '/admin/calendario', label: 'Calendario', icon: 'calendar', on: route.view === 'calendar' },
    { href: '/admin/eventi', label: 'Eventi', icon: 'siteEvents', on: route.view === 'siteEvents' || route.view === 'siteEvent' },
    { href: '/admin/richieste', label: 'Richieste', icon: 'requests', on: route.view === 'requests', badge: openRequests },
    { href: '/admin/sito', label: 'Sito', icon: 'site', on: route.view === 'site' },
    ...SERVICES.map((item) => ({
      href: `/admin/evento/${item.id}`,
      label: events[item.id]?.name ?? item.name,
      icon: item.id,
      on: route.view === 'event' && route.id === item.id,
    })),
    { href: '/admin/impostazioni', label: 'Impostazioni', icon: 'settings', on: route.view === 'settings' },
  ]

  return (
    <div className="admin">
      <aside className="admin-bar">
        <a className="admin-brand" href="/admin">
          <img src="/assets/logo-come-blue.png" alt="come*" />
        </a>
        <nav>
          {links.map((item) => (
            <a key={item.href} href={item.href} className={item.on ? 'is-on' : ''}>
              <SideIcon name={item.icon} />
              {item.label}
              {item.badge ? <span className="admin-side-badge">{item.badge}</span> : null}
            </a>
          ))}
        </nav>
        <div className="admin-side-actions">
          <a className="admin-go" href="/">
            Vai al sito
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 5h5v5" />
              <path d="M19 5 10.5 13.5" />
              <path d="M19 13.2V17a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4.2" />
            </svg>
          </a>
          <button className="admin-logout" type="button" onClick={() => supabase.auth.signOut()}>
            Logout
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 10 18.5V17" />
              <path d="M4 12h11" />
              <path d="m7 9-3 3 3 3" />
            </svg>
          </button>
        </div>
      </aside>
      <div className="admin-body" key={`${route.view}:${route.id}`}>
        {route.view === 'dashboard' ? (
          <AdminDashboard />
        ) : route.view === 'site' ? (
          <AdminSite />
        ) : route.view === 'siteEvents' ? (
          <AdminEvents />
        ) : route.view === 'siteEvent' ? (
          <AdminEventEditor eventId={route.id} />
        ) : route.view === 'requests' ? (
          <AdminRequests />
        ) : route.view === 'settings' ? (
          <AdminSettings />
        ) : route.view === 'guests' ? (
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
