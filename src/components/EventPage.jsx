import { useEffect, useState } from 'react'
import Header from './Header.jsx'
import Footer from './Footer.jsx'
import { useSiteStore } from '../store/siteStore.js'
import { eventDay, eventImageUrl, eventWhen, fetchPublicEvent, registerForEvent, seatsInfo } from '../store/eventStore.js'

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', privacy: false }

const ICONS = {
  add: 'M12 8v8M8 12h8M5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11A1.5 1.5 0 0 1 5.5 5z',
  share: 'M12 15V3.5M7.5 8 12 3.5 16.5 8M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13',
}

function Icon({ name }) {
  return (
    <svg className="evp-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

function Paragraphs({ text }) {
  const blocks = String(text ?? '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
  return blocks.map((block, i) => (
    <p key={i}>
      {block.split('\n').map((line, j) => (
        <span key={j}>
          {j ? <br /> : null}
          {line}
        </span>
      ))}
    </p>
  ))
}

function setMeta(name, content) {
  let el = document.head.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function icsText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/[,;]/g, (char) => `\\${char}`)
    .replace(/\r?\n/g, '\\n')
}

function downloadIcs(event, place) {
  const day = String(event.on_date).replace(/-/g, '')
  const hhmm = (value) => String(value ?? '').replace(':', '')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const url = window.location.href.split('?')[0]
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Spazio COME//Eventi//IT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@spaziocome.it`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Rome:${day}T${hhmm(event.time_start)}00`,
    `DTEND;TZID=Europe/Rome:${day}T${hhmm(event.time_end)}00`,
    `SUMMARY:${icsText(event.title)}`,
    `LOCATION:${icsText(place)}`,
    `DESCRIPTION:${icsText([event.summary, url].filter(Boolean).join('\n\n'))}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }))
  link.download = `${event.slug || 'evento'}.ics`
  link.click()
  URL.revokeObjectURL(link.href)
}

function RegistrationForm({ event, onDone, onCancel }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  async function submit(e) {
    e.preventDefault()
    const next = {}
    if (!form.firstName.trim()) next.firstName = 'Obbligatorio.'
    if (!form.lastName.trim()) next.lastName = 'Obbligatorio.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Mail non valida.'
    if (!form.privacy) next.privacy = 'Serve il consenso al trattamento dei dati.'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    setError('')
    const result = await registerForEvent(event.id, {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onDone({ token: result.token, email: form.email.trim() })
  }

  return (
    <form className="evp-form" onSubmit={submit} noValidate>
      <div className="book-grid">
        <label className="book-field">
          <span>Nome</span>
          <input value={form.firstName} autoComplete="given-name" onChange={(e) => set('firstName', e.target.value)} />
          {errors.firstName ? <small>{errors.firstName}</small> : null}
        </label>
        <label className="book-field">
          <span>Cognome</span>
          <input value={form.lastName} autoComplete="family-name" onChange={(e) => set('lastName', e.target.value)} />
          {errors.lastName ? <small>{errors.lastName}</small> : null}
        </label>
        <label className="book-field">
          <span>Email</span>
          <input type="email" value={form.email} autoComplete="email" onChange={(e) => set('email', e.target.value)} />
          {errors.email ? <small>{errors.email}</small> : null}
        </label>
        <label className="book-field">
          <span>Telefono (opzionale)</span>
          <input type="tel" value={form.phone} autoComplete="tel" onChange={(e) => set('phone', e.target.value)} />
        </label>
      </div>
      <label className="book-privacy">
        <input type="checkbox" checked={form.privacy} onChange={(e) => set('privacy', e.target.checked)} />
        <span>
          Acconsento al trattamento dei dati personali per gestire l’iscrizione, secondo il Regolamento UE 2016/679
          (GDPR).
        </span>
      </label>
      {errors.privacy ? <p className="book-error">{errors.privacy}</p> : null}
      {error ? <p className="book-error">{error}</p> : null}
      <div className="evp-form-actions">
        <button className="btn btn-solid" type="submit" disabled={busy}>
          {busy ? 'Invio…' : 'Conferma'}
        </button>
        <button className="evp-link" type="button" onClick={onCancel} disabled={busy}>
          Annulla
        </button>
      </div>
    </form>
  )
}

export default function EventPage({ slug }) {
  const { footer } = useSiteStore()
  const [state, setState] = useState({ loading: true, event: null, error: '' })
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(null)
  const [shared, setShared] = useState('')

  useEffect(() => {
    let alive = true
    setState({ loading: true, event: null, error: '' })
    fetchPublicEvent(slug).then((result) => {
      if (!alive) return
      setState({ loading: false, event: result.ok ? result.event : null, error: result.ok ? '' : result.error })
    })
    return () => {
      alive = false
    }
  }, [slug])

  const event = state.event

  useEffect(() => {
    if (!event) return
    document.title = `${event.title} | Spazio COME`
    setMeta('description', event.summary || `${event.title} — ${eventWhen(event)} a Spazio COME, Messina.`)
    setMeta('robots', 'index, follow')
  }, [event])

  const seats = seatsInfo(event)
  const place = ['Spazio COME', footer.address1, footer.address3].filter(Boolean).join(', ')
  const closed = event?.past
    ? 'Evento concluso.'
    : event && !event.registration_open
      ? 'Iscrizioni chiuse.'
      : seats.full
        ? 'Posti esauriti.'
        : ''

  async function share() {
    const url = window.location.href.split('?')[0]
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, text: event.summary || event.title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShared('Link copiato')
      window.setTimeout(() => setShared(''), 1800)
    } catch {
      /* condivisione annullata */
    }
  }

  return (
    <div className="page">
      <Header />
      <main className="evp">
        <div className="container">
          {state.loading ? <p className="evp-status">Caricamento…</p> : null}

          {!state.loading && !event ? (
            <div className="evp-missing">
              <h1>Evento non trovato</h1>
              <p>{state.error || 'Il link potrebbe essere errato o l’evento non è più disponibile.'}</p>
              <a className="btn btn-solid" href="/">
                Torna alla home
              </a>
            </div>
          ) : null}

          {event ? (
            <article className="evp-grid">
              <div className="evp-media">
                <img src={eventImageUrl(event.image_path)} alt={`Locandina: ${event.title}`} width={1080} height={1350} />
              </div>

              <div className="evp-copy">
                <h1>{event.title}</h1>
                <p className="evp-meta">
                  {eventDay(event.on_date, { weekday: 'long', day: 'numeric', month: 'long' })} · {event.time_start}–
                  {event.time_end} · Spazio COME
                </p>
                {event.summary ? <p className="evp-summary">{event.summary}</p> : null}

                <div className="evp-action">
                  {done ? (
                    <p className="evp-done">
                      Iscrizione confermata. Ti abbiamo inviato il pass a {done.email}.{' '}
                      <a href={`/iscrizione/${done.token}`}>Apri il pass</a>
                    </p>
                  ) : closed ? (
                    <p className="evp-closed">{closed}</p>
                  ) : open ? (
                    <RegistrationForm event={event} onDone={setDone} onCancel={() => setOpen(false)} />
                  ) : (
                    <div className="evp-book">
                      <button type="button" className="btn btn-solid" onClick={() => setOpen(true)}>
                        Prenota
                      </button>
                      {seats.left !== null ? <span>{seats.left === 1 ? '1 posto disponibile' : `${seats.left} posti disponibili`}</span> : null}
                    </div>
                  )}
                </div>

                <div className="evp-tools">
                  {!event.past ? (
                    <button type="button" className="evp-tool" onClick={() => downloadIcs(event, place)}>
                      <Icon name="add" />
                      Aggiungi al calendario
                    </button>
                  ) : null}
                  <button type="button" className="evp-tool" onClick={share}>
                    <Icon name="share" />
                    {shared || 'Condividi'}
                  </button>
                </div>

                {event.description ? (
                  <div className="evp-desc">
                    <Paragraphs text={event.description} />
                  </div>
                ) : null}
              </div>
            </article>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  )
}
