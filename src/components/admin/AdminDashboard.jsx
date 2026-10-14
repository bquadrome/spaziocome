import { useState } from 'react'
import { SERVICES } from '../../data/services.js'
import { bookingPhase, monthGrid, parseISO, setTypeColor, todayISO, typeColor, useBookingStore } from '../../store/bookingStore.js'

const WEEK = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function personName(item) {
  return [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Senza nome'
}

function slotLabel(event, slotIds) {
  const slots = (event?.slots ?? [])
    .filter((slot) => (slotIds ?? []).includes(slot.id))
    .sort((a, b) => String(a.start ?? '').localeCompare(String(b.start ?? '')))
  if (!slots.length) return ''
  return `${slots[0].start}–${slots[slots.length - 1].end}`
}

function Pin({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === 'meeting' ? (
        <>
          <rect x="7" y="8.2" width="10" height="7.2" rx="1.6" />
          <rect x="9.6" y="4.4" width="4.8" height="2.5" rx="1.1" />
          <rect x="9.6" y="16.7" width="4.8" height="2.5" rx="1.1" />
          <rect x="3.2" y="10.2" width="2.5" height="3.4" rx="1.1" />
          <rect x="18.3" y="10.2" width="2.5" height="3.4" rx="1.1" />
        </>
      ) : name === 'expo' ? (
        <path d="M5 4.8h14a1.6 1.6 0 0 1 1.6 1.6v11.2A1.6 1.6 0 0 1 19 19.2H5a1.6 1.6 0 0 1-1.6-1.6V6.4A1.6 1.6 0 0 1 5 4.8zm1.2 9.2 3.2-2.6 2.4 1.8 2-1.5 3.6 2.8V7.2H6.2v6.8zM8.6 9.6a1.3 1.3 0 1 0-1.3-1.3 1.3 1.3 0 0 0 1.3 1.3z" />
      ) : name === 'eu' ? (
        <path d="M3.2 6.2h6.4l1.8 2H20.6a1.5 1.5 0 0 1 1.5 1.5v10.2a1.5 1.5 0 0 1-1.5 1.5H3.2a1.5 1.5 0 0 1-1.5-1.5V7.7a1.5 1.5 0 0 1 1.5-1.5z" />
      ) : (
        <path d="M4 5.2h16a1.5 1.5 0 0 1 1.5 1.5v8.2A1.5 1.5 0 0 1 20 16.4H4a1.5 1.5 0 0 1-1.5-1.5V6.7A1.5 1.5 0 0 1 4 5.2zM9 18.2h6a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2z" />
      )}
    </svg>
  )
}

function Clock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5a9.5 9.5 0 1 0 9.5 9.5A9.5 9.5 0 0 0 12 2.5zm.8 4.2v5.1l3.4 2a.9.9 0 1 1-.9 1.5l-3.9-2.4a.9.9 0 0 1-.4-.7V6.7a.9.9 0 0 1 1.8 0z" />
    </svg>
  )
}

function Place() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.4a6.4 6.4 0 0 0-6.4 6.4c0 4.7 6.4 12.8 6.4 12.8s6.4-8.1 6.4-12.8A6.4 6.4 0 0 0 12 2.4zm0 8.6a2.2 2.2 0 1 1 2.2-2.2A2.2 2.2 0 0 1 12 11z" />
    </svg>
  )
}

export default function AdminDashboard() {
  const { bookings = [], guests = [], requests = [], events = {}, colors = {} } = useBookingStore()
  const openRequests = requests.filter((item) => ['new', 'revision', 'accepted'].includes(item.status))
  const today = todayISO()
  const now = parseISO(today)
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const activeBookings = bookings.filter((item) => bookingPhase(item, today) === 'active')
  const activeGuests = guests.filter((item) => bookingPhase(item, today) === 'active')

  const dots = {}
  for (const item of activeBookings) {
    for (const date of item.dates ?? []) {
      if (!dots[date]) dots[date] = []
      if (!dots[date].includes(item.eventId)) dots[date].push(item.eventId)
    }
  }

  const cells = monthGrid(cursor.year, cursor.month)
  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  })

  function shift(dir) {
    const next = new Date(cursor.year, cursor.month + dir, 1)
    setCursor({ year: next.getFullYear(), month: next.getMonth() })
  }

  const upcoming = [
    ...activeBookings.flatMap((item) =>
      (item.dates ?? [])
        .filter((date) => date >= today)
        .map((date) => ({
          key: `b-${item.id}-${date}`,
          date,
          kind: events[item.eventId]?.name ?? 'Prenotazione',
          who: personName(item),
          when: slotLabel(events[item.eventId], item.slotIds),
          href: '/admin/calendario',
        })),
    ),
    ...activeGuests.flatMap((item) =>
      (item.dates ?? [])
        .filter((date) => date >= today)
        .map((date) => ({
          key: `g-${item.id}-${date}`,
          date,
          kind: 'Ospite',
          who: personName(item),
          when: [item.timeStart, item.timeEnd].filter(Boolean).join('–'),
          href: '/admin/ospiti',
        })),
    ),
  ]
    .sort((a, b) => a.date.localeCompare(b.date) || a.who.localeCompare(b.who))
    .slice(0, 3)

  return (
    <div className="dash">
      <h1 className="dash-title">Dashboard</h1>
      {openRequests.length ? (
        <a className="dash-requests" href="/admin/richieste">
          <b>{openRequests.length}</b>
          <span>
            {openRequests.length === 1 ? 'richiesta di preventivo da gestire' : 'richieste di preventivo da gestire'}
          </span>
          <em>Apri</em>
        </a>
      ) : null}
      <div className="dash-bar">
        <div className="dash-colors">
          {[...SERVICES.map((item) => ({ id: item.id, name: events[item.id]?.name ?? item.name })), { id: 'ospite', name: 'Ospite' }].map(
            (item) => (
              <label className="dash-swatch" key={item.id}>
                <input
                  type="color"
                  value={typeColor(colors, item.id)}
                  aria-label={`Colore ${item.name}`}
                  onChange={(event) => setTypeColor(item.id, event.target.value)}
                />
                <span className="dash-swatch-dot" style={{ background: typeColor(colors, item.id) }} />
                <span>{item.name}</span>
              </label>
            ),
          )}
        </div>
        <div className="dash-quick">
          <a className="gest-btn" href="/admin/calendario?nuova=1">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7.5 3v3M16.5 3v3M4 9.5h16M5.5 5.5h13A1.5 1.5 0 0 1 20 7v11.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V7a1.5 1.5 0 0 1 1.5-1.5zM12 12.5v5M9.5 15h5" />
            </svg>
            Nuova prenotazione
          </a>
          <a className="gest-btn" href="/admin/eventi/nuovo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7v2.2a2.3 2.3 0 0 0 0 4.6V16a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16v-2.2a2.3 2.3 0 0 0 0-4.6V7zM12 8.6l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3 1-2z" />
            </svg>
            Nuovo evento
          </a>
        </div>
      </div>
      <div className="dash-top">
        <div className="dash-boxes">
          {SERVICES.map((space) => (
            <a className="space-box" href={`/admin/calendario?tipo=${space.id}`} key={space.id}>
              <div className="space-copy">
                <b>{activeBookings.filter((item) => item.eventId === space.id).length}</b>
                <span>{events[space.id]?.name ?? space.name}</span>
              </div>
              <span className="space-pin" style={{ '--type': typeColor(colors, space.id) }}>
                <Pin name={space.id} />
              </span>
            </a>
          ))}
        </div>
        <section className="dash-cal" aria-label="Calendario">
          <div className="dash-cal-head">
            <button type="button" onClick={() => shift(-1)} aria-label="Mese precedente">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.5 5.5 8 12l6.5 6.5" />
              </svg>
            </button>
            <strong key={title}>{title}</strong>
            <button type="button" onClick={() => shift(1)} aria-label="Mese successivo">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9.5 5.5 16 12l-6.5 6.5" />
              </svg>
            </button>
          </div>
          <div className="dash-cal-week">
            {WEEK.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="dash-cal-grid" key={`${cursor.year}-${cursor.month}`}>
            {cells.map((cell) => (
              <div
                className={`mini-day${cell.inMonth ? '' : ' is-out'}${cell.iso === today ? ' is-today' : ''}`}
                key={cell.iso}
              >
                <span className="mini-num">{Number(cell.iso.slice(8))}</span>
                <span className="mini-dots">
                  {(dots[cell.iso] ?? []).slice(0, 4).map((id) => (
                    <i key={id} style={{ '--dot': typeColor(colors, id) }} />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="dash-soon">
        <div className="dash-soon-head">
          <h2>Prossimi eventi o ospiti</h2>
          <a href="/admin/calendario">Vedi tutti</a>
        </div>
        {upcoming.length === 0 ? <p className="dash-empty">Nessun impegno da oggi in poi.</p> : null}
        <div className="dash-cards">
          {upcoming.map((item) => {
            const date = parseISO(item.date)
            const month = date.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')
            return (
              <a className="soon-card" href={item.href} key={item.key}>
                <div className="soon-date">
                  <b>{date.getDate()}</b>
                  <span>{month}</span>
                </div>
                <h3>{item.who}</h3>
                {item.when ? (
                  <p>
                    <Clock />
                    {item.when}
                  </p>
                ) : null}
                <p>
                  <Place />
                  {item.kind}
                </p>
              </a>
            )
          })}
        </div>
      </section>
    </div>
  )
}
