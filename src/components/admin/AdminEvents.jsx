import { useMemo, useState } from 'react'
import { WEEKDAYS, monthGrid, todayISO, typeColor, useBookingStore } from '../../store/bookingStore.js'
import { eventImageUrl, parseDay, useSiteEvents } from '../../store/eventStore.js'
import { CalDirIcon } from './CalendarMonth.jsx'
import { MonthMenu, TypeMenu } from './AdminCalendar.jsx'

const MONTH_UP = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC']

const FILTERS = [
  { id: 'next', label: 'Prossimi' },
  { id: 'past', label: 'Passati' },
  { id: 'all', label: 'Tutti' },
]

export function navigateAdmin(path) {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function eventState(event, today = todayISO()) {
  if (event.onDate < today) return { id: 'past', label: 'Passato' }
  if (!event.imagePath) return { id: 'noimage', label: 'Senza locandina' }
  if (!event.published) return { id: 'draft', label: 'Non pubblicato' }
  return { id: 'public', label: 'Sul sito' }
}

function exportEvents(rows, counts) {
  const header = ['Titolo', 'Data', 'Inizio', 'Fine', 'Iscritti', 'Posti', 'Stato']
  const lines = [
    header,
    ...rows.map((item) => [
      item.title,
      item.onDate.split('-').reverse().join('/'),
      item.timeStart,
      item.timeEnd,
      counts[item.id] ?? 0,
      item.capacity ?? '',
      eventState(item).label,
    ]),
  ]
  const csv = lines.map((cells) => cells.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `eventi-${todayISO()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function AdminEvents() {
  const { events = [], registrations = [], loaded } = useSiteEvents()
  const { colors = {} } = useBookingStore()
  const color = typeColor(colors, 'meeting')
  const today = todayISO()
  const now = new Date()
  const [view, setView] = useState('list')
  const [filter, setFilter] = useState('next')
  const [query, setQuery] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })

  const counts = useMemo(() => {
    const map = {}
    for (const reg of registrations) {
      if (reg.status !== 'active') continue
      map[reg.eventId] = (map[reg.eventId] ?? 0) + 1
    }
    return map
  }, [registrations])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = events.filter((item) => {
      if (filter === 'next' && item.onDate < today) return false
      if (filter === 'past' && item.onDate >= today) return false
      if (monthFilter && item.onDate.slice(0, 7) !== monthFilter) return false
      if (needle && !`${item.title} ${item.summary}`.toLowerCase().includes(needle)) return false
      return true
    })
    return filter === 'past' ? [...list].reverse() : list
  }, [events, filter, query, today, monthFilter])

  const byDay = useMemo(() => {
    const map = {}
    for (const item of events) {
      if (!map[item.onDate]) map[item.onDate] = []
      map[item.onDate].push(item)
    }
    return map
  }, [events])

  const cells = monthGrid(cursor.y, cursor.m)
  const title = new Date(cursor.y, cursor.m, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  function shift(delta) {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }

  function open(id) {
    navigateAdmin(`/admin/eventi/${id}`)
  }

  function create(date) {
    navigateAdmin(`/admin/eventi/nuovo${date ? `?data=${date}` : ''}`)
  }

  return (
    <div className="month">
      <section className="gest-head">
        <p className="gest-kicker">Spazio COME</p>
        <h1>Eventi</h1>
        <p className="gest-lead">
          Eventi organizzati in sede. Ogni evento blocca la Meeting Room nel suo orario; compare in home e ha la sua
          pagina solo se ha la locandina ed è pubblicato.
        </p>
      </section>

      <div className="cal-views" role="tablist" aria-label="Visualizzazione">
        <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}>
          Elenco
        </button>
        <button type="button" role="tab" aria-selected={view === 'month'} className={view === 'month' ? 'is-on' : ''} onClick={() => setView('month')}>
          Calendario
        </button>
      </div>

      {view === 'list' ? (
        <>
          <div className="cal-tools">
            <TypeMenu
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((item) => ({ ...item, color: item.id === 'next' ? color : item.id === 'past' ? '#a1a4b8' : '' }))}
            />
            <MonthMenu value={monthFilter} onChange={setMonthFilter} />
            <label className="cal-search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16.5 20 20.5" />
              </svg>
              <input type="search" value={query} placeholder="Cerca evento" onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="cal-tools-end">
              <button type="button" className="cal-export" onClick={() => exportEvents(shown, counts)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4.5v9" />
                  <path d="m8 10 4 4 4-4" />
                  <path d="M5.5 18.5h13" />
                </svg>
                Esporta CSV
              </button>
              <button type="button" className="gest-btn" onClick={() => create('')}>
                Nuovo evento
              </button>
            </div>
          </div>

          {!loaded ? <p className="dash-empty">Caricamento…</p> : null}
          {loaded && !shown.length ? (
            <p className="dash-empty">
              {filter === 'next' ? 'Nessun evento in programma.' : 'Nessun evento con questi filtri.'}
            </p>
          ) : null}

          <div className="adm-ev-cards">
            {shown.map((item) => {
              const day = parseDay(item.onDate)
              const state = eventState(item, today)
              const taken = counts[item.id] ?? 0
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`adm-ev-card${state.id === 'past' ? ' is-past' : ''}`}
                  style={{ '--type': color }}
                  onClick={() => open(item.id)}
                >
                  <span className="adm-ev-thumb">
                    {item.imagePath ? <img src={eventImageUrl(item.imagePath)} alt="" loading="lazy" /> : <i>Nessuna locandina</i>}
                  </span>
                  <span className="adm-ev-body">
                    <span className="adm-ev-date">
                      {MONTH_UP[day.getMonth()]} <b>{day.getDate()}</b> {day.getFullYear()}
                    </span>
                    <strong>{item.title}</strong>
                    <span className="adm-ev-meta">
                      {item.timeStart}–{item.timeEnd} · {taken}
                      {item.capacity ? `/${item.capacity}` : ''} iscritti
                    </span>
                    <span className={`adm-ev-state is-${state.id}`}>{state.label}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      ) : null}

      {view === 'month' ? (
        <>
          <div className="month-toolbar">
            <button type="button" className="cal-dir" onClick={() => shift(-1)} aria-label="Mese precedente">
              <CalDirIcon dir="prev" />
            </button>
            <button type="button" onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>
              Oggi
            </button>
            <button type="button" className="cal-dir" onClick={() => shift(1)} aria-label="Mese successivo">
              <CalDirIcon dir="next" />
            </button>
            <strong key={title}>{title}</strong>
          </div>
          <div className="month-board">
            <div className="month-weekdays">
              {WEEKDAYS.map((day) => (
                <span key={day.id}>{day.label}</span>
              ))}
            </div>
            <div className="month-grid" key={`${cursor.y}-${cursor.m}`}>
              {cells.map((cell) => (
                <div
                  key={cell.iso}
                  className={`month-day${cell.inMonth ? '' : ' is-out'}${cell.iso === today ? ' is-today' : ''}`}
                  onClick={() => create(cell.iso)}
                >
                  <span className="month-num">{Number(cell.iso.slice(8))}</span>
                  <div className="month-chips">
                    {(byDay[cell.iso] ?? []).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`month-chip${cell.iso < today ? ' is-off' : ''}`}
                        style={{ '--chip': color }}
                        onClick={(e) => {
                          e.stopPropagation()
                          open(item.id)
                        }}
                      >
                        {item.timeStart} {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
