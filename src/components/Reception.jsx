import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import AdminLogin from './admin/AdminLogin.jsx'
import { supabase } from '../lib/supabase.js'
import {
  fetchReceptionDay,
  fetchReceptionEvents,
  formatISO,
  receptionCheckin,
  todayISO,
  tokenFromText,
} from '../store/bookingStore.js'
import { eventImageUrl } from '../store/eventStore.js'

const KEY_STORE = 'reception-key'

function readKey() {
  const fromUrl = new URLSearchParams(window.location.search).get('k')
  if (fromUrl) {
    try {
      localStorage.setItem(KEY_STORE, fromUrl)
    } catch {
      /* storage non disponibile */
    }
    window.history.replaceState(null, '', window.location.pathname)
    return fromUrl
  }
  try {
    return localStorage.getItem(KEY_STORE) ?? ''
  } catch {
    return ''
  }
}

function timeOf(value) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function fullName(item) {
  return [item?.first_name, item?.last_name].filter(Boolean).join(' ') || 'Senza nome'
}

function slotText(slots) {
  if (!slots?.length) return 'Giornata'
  return `${slots[0].start}–${slots[slots.length - 1].end}`
}

function Scanner({ onCode }) {
  const video = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stream = null
    let timer = 0
    let alive = true
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    async function start() {
      try {
        const { default: jsQR } = await import('jsqr')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (!alive) return
        video.current.srcObject = stream
        await video.current.play()
        const tick = () => {
          if (!alive) return
          const el = video.current
          if (el && el.readyState >= 2 && el.videoWidth) {
            const scale = Math.min(1, 640 / el.videoWidth)
            canvas.width = Math.round(el.videoWidth * scale)
            canvas.height = Math.round(el.videoHeight * scale)
            ctx.drawImage(el, 0, 0, canvas.width, canvas.height)
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const hit = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })
            if (hit?.data) onCode(hit.data)
          }
          timer = window.setTimeout(tick, 180)
        }
        tick()
      } catch (err) {
        console.error(err)
        setError('Fotocamera non disponibile. Consenti l’accesso o usa la lista qui sotto.')
      }
    }

    void start()
    return () => {
      alive = false
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [onCode])

  return (
    <div className="rec-scan">
      {error ? <p className="book-error">{error}</p> : <video ref={video} muted playsInline />}
    </div>
  )
}

export default function Reception() {
  const [key] = useState(readKey)
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!key && session === undefined) {
    return (
      <div className="admin">
        <p className="admin-empty">Caricamento…</p>
      </div>
    )
  }
  if (!key && !session) return <AdminLogin />
  return <ReceptionDesk receptionKey={key} />
}

function PersonRow({ item, date, busy, onMark, showWhere = true }) {
  const at = item.checkins?.[date]
  return (
    <li className={at ? 'is-present' : ''}>
      <div className="rec-who">
        <strong>{fullName(item)}</strong>
        {showWhere ? (
          <span>
            {item.event_name} · {slotText(item.slots)}
            {item.station ? ` · ${item.station}` : ''}
          </span>
        ) : null}
      </div>
      {at ? (
        <div className="rec-act">
          <span className="rec-time">Presente · {timeOf(at)}</span>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => onMark(item, false)}>
            Togli presenza
          </button>
        </div>
      ) : (
        <div className="rec-act">
          <button type="button" className="btn-save" disabled={busy} onClick={() => onMark(item, true)}>
            Presente
          </button>
        </div>
      )}
    </li>
  )
}

function EventCard({ event, people, shown, open, onToggle, date, busyId, onMark, searching }) {
  const present = people.filter((item) => item.checkins?.[date]).length
  const panelId = `rec-ev-${event.id}`
  return (
    <section className={`rec-event${open ? ' is-open' : ''}`}>
      <button type="button" className="rec-event-head" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="rec-event-thumb">
          {event.image_path ? <img src={eventImageUrl(event.image_path)} alt="" /> : <i aria-hidden="true" />}
        </span>
        <span className="rec-event-info">
          <span className="rec-event-kicker">
            Evento · {event.time_start}–{event.time_end}
          </span>
          <strong>{event.title}</strong>
          <span className="rec-event-count">
            <b>{present}</b>/{people.length} presenti
            {event.capacity ? ` · ${people.length}/${event.capacity} posti occupati` : ''}
          </span>
        </span>
        <svg className="rec-event-chev" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10.2 12 15l5-4.8" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="rec-event-panel"
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.32, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }}
          >
            <div className="rec-event-body">
              {shown.length ? (
                <ul className="rec-list">
                  {shown.map((item) => (
                    <PersonRow key={item.id} item={item} date={date} busy={busyId === item.id} onMark={onMark} showWhere={false} />
                  ))}
                </ul>
              ) : (
                <p className="admin-hint">{searching ? 'Nessun partecipante con questo nome.' : 'Ancora nessun iscritto.'}</p>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

function ReceptionDesk({ receptionKey }) {
  const [date, setDate] = useState(todayISO)
  const [items, setItems] = useState([])
  const [events, setEvents] = useState([])
  const [openEvents, setOpenEvents] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [scanning, setScanning] = useState(false)
  const [notice, setNotice] = useState(null)
  const [busyId, setBusyId] = useState('')
  const lock = useRef(false)

  async function load() {
    const [result, eventResult] = await Promise.all([
      fetchReceptionDay(receptionKey, date),
      fetchReceptionEvents(receptionKey, date),
    ])
    setLoading(false)
    if (!result.ok) {
      if (result.error === 'Non autorizzato') {
        try {
          localStorage.removeItem(KEY_STORE)
        } catch {
          /* storage non disponibile */
        }
        setError('Link reception non più valido. Chiedi all’amministrazione il nuovo link.')
      } else {
        setError(result.error)
      }
      return
    }
    setError('')
    setItems(result.items)
    setEvents(eventResult.ok ? eventResult.items : [])
  }

  useEffect(() => {
    setLoading(true)
    setOpenEvents(new Set())
    void load()
    const timer = window.setInterval(load, 30000)
    return () => window.clearInterval(timer)
  }, [date])

  function upsert(booking) {
    if (!booking?.id) return
    setItems((prev) => prev.map((item) => (item.id === booking.id ? booking : item)))
  }

  function toggleEvent(id) {
    setOpenEvents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function mark(item, present) {
    setBusyId(item.id)
    const result = await receptionCheckin(receptionKey, { bookingId: item.id, date, present })
    setBusyId('')
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error })
      return
    }
    upsert(result.booking)
  }

  async function onCode(text) {
    if (lock.current) return
    const token = tokenFromText(text)
    if (!token) return
    lock.current = true
    const result = await receptionCheckin(receptionKey, { token, date, present: true })
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error })
    } else {
      upsert(result.booking)
      if (result.booking?.kind === 'event') {
        setOpenEvents((prev) => new Set(prev).add(result.booking.event_id))
      }
      const who = `${fullName(result.booking)} — ${result.booking?.event_name ?? ''}`
      setNotice(
        result.result === 'already'
          ? { tone: 'warn', text: `Già presente dalle ${timeOf(result.booking?.checkins?.[date])}: ${who}` }
          : { tone: 'ok', text: `Presente: ${who}` },
      )
    }
    window.setTimeout(() => {
      lock.current = false
    }, 2200)
  }

  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode
  const stableOnCode = useMemo(() => (text) => onCodeRef.current(text), [])

  const needle = query.trim().toLowerCase()
  const match = (item) => !needle || fullName(item).toLowerCase().includes(needle)
  const eventIds = new Set(events.map((event) => event.id))
  const inCard = (item) => item.kind === 'event' && eventIds.has(item.event_id)
  const shownBookings = items.filter((item) => !inCard(item) && match(item))
  const cards = events
    .map((event) => {
      const people = items.filter((item) => inCard(item) && item.event_id === event.id)
      const titleHit = !!needle && event.title.toLowerCase().includes(needle)
      const hits = people.filter(match)
      return {
        event,
        people,
        shown: titleHit ? people : hits,
        visible: !needle || titleHit || hits.length > 0,
        forced: !!needle && hits.length > 0,
      }
    })
    .filter((card) => card.visible)
  const present = items.filter((item) => item.checkins?.[date]).length
  const nothing = !cards.length && !shownBookings.length

  return (
    <main className="rec">
      <header className="rec-head">
        <div>
          <p className="gest-kicker">Spazio COME</p>
          <h1>Reception</h1>
          <p className="admin-hint">
            {formatISO(date)} · {present}/{items.length} presenti
          </p>
        </div>
        <div className="rec-tools">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button type="button" className="gest-btn" onClick={() => setScanning((on) => !on)}>
            {scanning ? 'Chiudi scanner' : 'Scansiona QR'}
          </button>
        </div>
      </header>

      {notice ? (
        <button type="button" className={`rec-notice is-${notice.tone}`} onClick={() => setNotice(null)}>
          {notice.text}
        </button>
      ) : null}

      {scanning ? <Scanner onCode={stableOnCode} /> : null}

      <label className="admin-field rec-search">
        <span>Cerca</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome o cognome" />
      </label>

      {error ? <p className="book-error">{error}</p> : null}
      {loading ? <p className="admin-hint">Caricamento…</p> : null}
      {!loading && !error && nothing ? (
        <p className="admin-hint">{needle ? 'Nessun risultato.' : 'Nessuna prenotazione per questa data.'}</p>
      ) : null}

      {cards.length ? (
        <div className="rec-events">
          {cards.map((card) => (
            <EventCard
              key={card.event.id}
              event={card.event}
              people={card.people}
              shown={card.shown}
              open={card.forced || openEvents.has(card.event.id)}
              onToggle={() => toggleEvent(card.event.id)}
              date={date}
              busyId={busyId}
              onMark={mark}
              searching={!!needle}
            />
          ))}
        </div>
      ) : null}

      {cards.length && shownBookings.length ? <h2 className="rec-section">Prenotazioni</h2> : null}

      <ul className="rec-list">
        {shownBookings.map((item) => (
          <PersonRow key={item.id} item={item} date={date} busy={busyId === item.id} onMark={mark} />
        ))}
      </ul>
    </main>
  )
}
