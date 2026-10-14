import { useEffect, useMemo, useRef, useState } from 'react'
import Time24 from './Time24.jsx'
import GuestModal from './GuestModal.jsx'
import {
  bookingPhase,
  typeColor,
  WEEKDAYS,
  datesBetween,
  isSlotFull,
  isStationTaken,
  monthGrid,
  patchBooking,
  addBooking,
  setBookingStatus,
  removeBookingOccurrence,
  activeCustomFields,
  customValue,
  fetchReceptionKey,
  setCustomValue,
  receptionUrl,
  formatISO,
  splitName,
  todayISO,
  useBookingStore,
} from '../../store/bookingStore.js'
import { SERVICES } from '../../data/services.js'
import { CalDirIcon } from './CalendarMonth.jsx'

const PUBLIC_CALENDAR =
  'https://calendar.google.com/calendar/u/5/embed?src=9fa4d3194119c0abd601c8428459182fd4f632ed065fdf1c3f754bb1a2370aef@group.calendar.google.com&ctz=Europe/Rome&mode=AGENDA&showTitle=0&showNav=0&showPrint=0&showTabs=0&showCalendars=0&showTz=0&csspa=1'

const FILTER_IDS = new Set(['all', 'ospite', ...SERVICES.map((item) => item.id)])

function filterFromUrl() {
  const tipo = new URLSearchParams(window.location.search).get('tipo')
  return FILTER_IDS.has(tipo) ? tipo : 'all'
}

function writeFilterUrl(tipo) {
  const url = new URL(window.location.href)
  if (!tipo || tipo === 'all') url.searchParams.delete('tipo')
  else url.searchParams.set('tipo', tipo)
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

const SHORT = {
  coworking: 'Coworking',
  meeting: 'Meeting',
  expo: 'Expo',
  eu: 'EU Lab',
}

const MONTH_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const MONTH_UP = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC']
export function TypeMenu({ value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const current = options.find((item) => item.id === value) ?? options[0]
  const wheel = options.filter((item) => item.color).map((item) => item.color)
  const wheelStyle = wheel.length ? { background: `conic-gradient(${wheel.join(',')})` } : undefined

  useEffect(() => {
    if (!open) return undefined
    function onPointer(event) {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`cal-type${open ? ' is-open' : ''}`} ref={root}>
      <button
        type="button"
        className="cal-type-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {current?.color ? <i style={{ background: current.color }} /> : <i className="is-all" style={wheelStyle} />}
        <strong>{current?.label ?? 'Tutti'}</strong>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10.2 12 15l5-4.8" />
        </svg>
      </button>
      {open ? (
        <ul className="cal-type-menu" role="listbox">
          {options.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={item.id === value}
                className={item.id === value ? 'is-on' : ''}
                onClick={() => {
                  onChange(item.id)
                  setOpen(false)
                }}
              >
                {item.color ? <i style={{ background: item.color }} /> : <i className="is-all" style={wheelStyle} />}
                <span>{item.label}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.5 12.5 10 16l7.5-8" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function MonthMenu({ value, onChange }) {
  const now = new Date()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => (value ? Number(value.slice(0, 4)) : now.getFullYear()))
  const root = useRef(null)
  const picked = value
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1).toLocaleDateString('it-IT', {
        month: 'long',
        year: 'numeric',
      })
    : ''
  const label = picked ? picked.charAt(0).toUpperCase() + picked.slice(1) : 'Tutti i mesi'

  useEffect(() => {
    if (!open) return undefined
    function onPointer(event) {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`cal-type${open ? ' is-open' : ''}`} ref={root}>
      <button
        type="button"
        className="cal-type-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open && value) setYear(Number(value.slice(0, 4)))
          setOpen((prev) => !prev)
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3.5v3M16 3.5v3M4 10h16" />
        </svg>
        <strong>{label}</strong>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10.2 12 15l5-4.8" />
        </svg>
      </button>
      {open ? (
        <div className="cal-month-menu" role="dialog" aria-label="Filtra per mese">
          <div className="cal-month-year">
            <button type="button" onClick={() => setYear((prev) => prev - 1)} aria-label="Anno precedente">
              ‹
            </button>
            <strong>{year}</strong>
            <button type="button" onClick={() => setYear((prev) => prev + 1)} aria-label="Anno successivo">
              ›
            </button>
          </div>
          <button
            type="button"
            className={`cal-month-all${!value ? ' is-on' : ''}`}
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
          >
            Tutti i mesi
          </button>
          <div className="cal-month-grid">
            {MONTH_SHORT.map((name, index) => {
              const id = `${year}-${String(index + 1).padStart(2, '0')}`
              return (
                <button
                  key={id}
                  type="button"
                  className={value === id ? 'is-on' : ''}
                  onClick={() => {
                    onChange(id)
                    setOpen(false)
                  }}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function dateParts(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return { y, m, d }
}

function formatRange(dates) {
  const sorted = [...dates].filter(Boolean).sort()
  if (!sorted.length) return ''
  const a = dateParts(sorted[0])
  const b = dateParts(sorted[sorted.length - 1])
  if (sorted[0] === sorted[sorted.length - 1]) return `${a.d} ${MONTH_SHORT[a.m - 1]} ${a.y}`
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTH_SHORT[a.m - 1]} ${a.y}`
  if (a.y === b.y) return `${a.d} ${MONTH_SHORT[a.m - 1]} – ${b.d} ${MONTH_SHORT[b.m - 1]} ${a.y}`
  return `${a.d} ${MONTH_SHORT[a.m - 1]} ${a.y} – ${b.d} ${MONTH_SHORT[b.m - 1]} ${b.y}`
}

function bookingSlots(event, booking) {
  const slots = Array.isArray(event?.slots) ? event.slots : []
  return slots
    .filter((slot) => (booking.slotIds ?? []).includes(slot.id))
    .sort((a, b) => String(a.start ?? '').localeCompare(String(b.start ?? '')))
}

function matchSlots(event, timeStart, timeEnd) {
  const slots = event?.slots ?? []
  if (!timeStart && !timeEnd) return slots.map((slot) => slot.id)
  const start = timeStart || '00:00'
  const end = timeEnd || '23:59'
  const hit = slots.filter((slot) => slot.start < end && slot.end > start)
  return hit.map((slot) => slot.id)
}

function formFromBooking(booking, events) {
  const event = events[booking.eventId]
  const slots = bookingSlots(event, booking)
  const dates = [...(Array.isArray(booking.dates) ? booking.dates : [])].sort()
  return {
    eventId: booking.eventId,
    title: [booking.firstName, booking.lastName].filter(Boolean).join(' '),
    email: booking.email ?? '',
    phone: booking.phone ?? '',
    dateStart: dates[0] ?? '',
    dateEnd: dates[dates.length - 1] ?? dates[0] ?? '',
    timeStart: slots[0]?.start ?? '',
    timeEnd: slots[slots.length - 1]?.end ?? '',
    extra: booking.extra ?? '',
    custom: Array.isArray(booking.custom) ? booking.custom : [],
    notes: booking.notes ?? '',
    stationId: booking.stationId ?? '',
  }
}

function emptyForm(date, eventId) {
  const day = date || todayISO()
  return {
    eventId: eventId || 'coworking',
    title: '',
    email: '',
    phone: '',
    dateStart: day,
    dateEnd: day,
    timeStart: '',
    timeEnd: '',
    extra: '',
    custom: [],
    notes: '',
    stationId: '',
  }
}

export default function AdminCalendar() {
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [filter, setFilter] = useState(filterFromUrl)
  const [openId, setOpenId] = useState('')
  const [focusDate, setFocusDate] = useState('')
  const [focusSlotId, setFocusSlotId] = useState('')
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [guestModal, setGuestModal] = useState(null)
  const [copied, setCopied] = useState(false)
  const [receptionLink, setReceptionLink] = useState('')
  const [copiedDesk, setCopiedDesk] = useState(false)

  useEffect(() => {
    fetchReceptionKey().then((key) => {
      setReceptionLink(receptionUrl(key))
    })
  }, [])
  const [view, setView] = useState('list')
  const [query, setQuery] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [monthFilter, setMonthFilter] = useState('')
  const { bookings = [], events = {}, guests = [], colors = {} } = useBookingStore()
  const today = todayISO()

  const visible = useMemo(() => {
    if (filter === 'ospite') return []
    return (Array.isArray(bookings) ? bookings : []).filter((item) =>
      filter === 'all' ? true : item.eventId === filter,
    )
  }, [bookings, filter])

  const visibleGuests = useMemo(() => {
    if (filter !== 'all' && filter !== 'ospite') return []
    return guests
  }, [guests, filter])

  const byDay = useMemo(() => {
    const map = {}
    function push(date, chip) {
      if (!map[date]) map[date] = []
      map[date].push(chip)
    }
    for (const item of visible) {
      const event = events[item.eventId]
      const slots = bookingSlots(event, item)
      const name = [item.firstName, item.lastName].filter(Boolean).join(' ')
      const space = SHORT[item.eventId] ?? event?.name ?? item.eventId
      const desk = (Array.isArray(event?.stations) ? event.stations : []).find((s) => s.id === item.stationId)?.label
      const who = desk ? `${name} (${desk})` : name
      const dates = Array.isArray(item.dates) ? item.dates : []
      for (const date of dates) {
        if (slots.length) {
          for (const slot of slots) {
            push(date, {
              key: `${item.id}-${slot.id}-${date}`,
              kind: 'booking',
              id: item.id,
              slotId: slot.id,
              time: slot.start,
              text: `${slot.start} ${space} - ${who}`,
              color: typeColor(colors, item.eventId),
              off: item.status !== 'active',
            })
          }
        } else {
          push(date, {
            key: `${item.id}-${date}`,
            kind: 'booking',
            id: item.id,
            slotId: '',
            time: '',
            text: `${space} - ${name}`,
            color: typeColor(colors, item.eventId),
            off: item.status !== 'active',
          })
        }
      }
    }
    for (const item of visibleGuests) {
      const name = [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Ospite'
      const time = item.timeStart || ''
      const chip = {
        key: item.id,
        kind: 'guest',
        id: item.id,
        time,
        text: time ? `${time} Ospite - ${name}` : `Ospite - ${name}`,
        color: typeColor(colors, 'ospite'),
        off: item.status !== 'active',
      }
      for (const date of item.dates ?? []) push(date, chip)
    }
    for (const date of Object.keys(map)) {
      map[date].sort((a, b) => String(a.time ?? '').localeCompare(String(b.time ?? '')))
    }
    return map
  }, [visible, visibleGuests, events, colors])

  const cards = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = []
    for (const item of visible) {
      const phase = bookingPhase(item, today)
      if (activeOnly && phase !== 'active') continue
      const event = events[item.eventId]
      const dates = [...(item.dates ?? [])].filter(Boolean).sort()
      const name = [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Senza nome'
      const slots = bookingSlots(event, item)
      const time = slots.length ? `${slots[0].start}–${slots[slots.length - 1].end}` : ''
      const desk = (event?.stations ?? []).find((station) => station.id === item.stationId)?.label
      const kind = events[item.eventId]?.name ?? SHORT[item.eventId] ?? 'Prenotazione'
      const when = [time, desk].filter(Boolean).join(' · ') || 'Orario non indicato'
      const blob = `${name} ${kind} ${when} ${item.email ?? ''} ${item.notes ?? ''}`.toLowerCase()
      if (needle && !blob.includes(needle)) continue
      const focus = monthFilter ? dates.filter((date) => date.slice(0, 7) === monthFilter) : dates
      if (!focus.length) continue
      const hero = focus[0]
      rows.push({
        key: `b-${item.id}`,
        kind: 'booking',
        id: item.id,
        color: typeColor(colors, item.eventId),
        month: MONTH_UP[dateParts(hero).m - 1],
        day: dateParts(hero).d,
        range: formatRange(dates),
        title: name,
        tag: kind,
        when,
        phase,
        sort: hero,
      })
    }
    for (const item of visibleGuests) {
      const phase = bookingPhase(item, today)
      if (activeOnly && phase !== 'active') continue
      const dates = [...(item.dates ?? [])].filter(Boolean).sort()
      const name = [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Ospite'
      const when = [item.timeStart, item.timeEnd].filter(Boolean).join('–') || 'Orario non indicato'
      const blob = `${name} ospite ${when} ${item.email ?? ''} ${item.notes ?? ''}`.toLowerCase()
      if (needle && !blob.includes(needle)) continue
      const focus = monthFilter ? dates.filter((date) => date.slice(0, 7) === monthFilter) : dates
      if (!focus.length) continue
      const hero = focus[0]
      rows.push({
        key: `g-${item.id}`,
        kind: 'guest',
        id: item.id,
        color: typeColor(colors, 'ospite'),
        month: MONTH_UP[dateParts(hero).m - 1],
        day: dateParts(hero).d,
        range: formatRange(dates),
        title: name,
        tag: 'Ospite',
        when,
        phase,
        sort: hero,
      })
    }
    rows.sort((a, b) => a.sort.localeCompare(b.sort) || a.when.localeCompare(b.when) || a.title.localeCompare(b.title))
    return rows
  }, [visible, visibleGuests, events, colors, query, activeOnly, monthFilter, today])

  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor])
  const title = new Date(cursor.y, cursor.m, 1).toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  })
  const booking = openId && openId !== 'new' ? (Array.isArray(bookings) ? bookings : []).find((item) => item.id === openId) ?? null : null
  const isNew = openId === 'new'
  const event = form ? events[form.eventId] : null

  useEffect(() => {
    if (!openId) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId])

  function pickFilter(next) {
    const tipo = typeof next === 'function' ? next(filter) : next
    setFilter(tipo)
    writeFilterUrl(tipo)
  }

  function shift(delta) {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }

  function goToday() {
    const d = new Date()
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }

  function openNew(date) {
    const eventId = SERVICES.some((item) => item.id === filter) ? filter : 'coworking'
    setGuestModal(null)
    setOpenId('new')
    setFocusDate(date || todayISO())
    setFocusSlotId('')
    setError('')
    setForm(emptyForm(date || todayISO(), eventId))
  }

  // /admin/calendario?nuova=1 apre subito il form nuova prenotazione.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.get('nuova')) return
    openNew()
    url.searchParams.delete('nuova')
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }, [])

  function openBooking(id, date, slotId) {
    const item = bookings.find((b) => b.id === id)
    if (!item) return
    setOpenId(id)
    setFocusDate(date || '')
    setFocusSlotId(slotId || '')
    setError('')
    setForm(formFromBooking(item, events))
  }

  function closeModal() {
    setOpenId('')
    setFocusDate('')
    setFocusSlotId('')
    setForm(null)
    setError('')
  }

  function setField(key, value) {
    setForm((prev) => {
      if (key === 'eventId') return { ...prev, eventId: value, stationId: '', extra: '', custom: [] }
      return { ...prev, [key]: value }
    })
    setError('')
  }

  async function save(e) {
    e.preventDefault()
    if (!form) return
    if (isNew && !form.title.trim()) {
      setError('Inserisci il nome.')
      return
    }
    const nextEvent = events[form.eventId]
    if (!nextEvent) return
    const dates = datesBetween(form.dateStart, form.dateEnd)
    if (!dates.length) {
      setError('Inserisci una data.')
      return
    }
    const slotIds = matchSlots(nextEvent, form.timeStart, form.timeEnd)
    if ((form.timeStart || form.timeEnd) && slotIds.length === 0) {
      setError('Nessuno slot in questo orario.')
      return
    }
    const ignoreId = isNew ? '' : booking?.id
    const clash = dates.some((date) =>
      slotIds.some((id) => isSlotFull(form.eventId, date, id, ignoreId)),
    )
    if (clash) {
      setError('Uno slot in queste date è già occupato.')
      return
    }
    if (nextEvent.hasStations) {
      if (!form.stationId) {
        setError('Scegli una postazione.')
        return
      }
      const deskBusy = dates.some((date) =>
        slotIds.some((id) => isStationTaken(form.eventId, date, id, form.stationId, ignoreId)),
      )
      if (deskBusy) {
        setError('Postazione già occupata in questo orario.')
        return
      }
    }
    const { firstName, lastName } = splitName(form.title)
    const payload = {
      eventId: form.eventId,
      dates,
      slotIds,
      stationId: nextEvent.hasStations ? form.stationId : '',
      firstName,
      lastName,
      email: form.email.trim(),
      phone: form.phone.trim(),
      extra: form.extra,
      custom: (form.custom ?? []).map((item) => ({ ...item, value: String(item.value).trim() })).filter((item) => item.value),
      notes: form.notes.trim(),
    }
    const result = isNew ? await addBooking(payload) : await patchBooking(booking.id, payload)
    if (!result.ok) {
      setError(result.error)
      return
    }
    closeModal()
  }

  function exportCsv() {
    const customLabels = [...new Set(bookings.flatMap((item) => (item.custom ?? []).map((entry) => entry.label)))]
    const header = ['Nome', 'Email', 'Telefono', 'Spazio', 'Date', 'Orario', 'Postazione', 'Stato', 'Extra', ...customLabels, 'Note', 'Creata il']
    const rows = [...bookings].sort((a, b) => {
      const first = (item) => [...(item.dates ?? [])].filter(Boolean).sort()[0] ?? ''
      return first(a).localeCompare(first(b)) || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))
    })
    const lines = [
      header,
      ...rows.map((item) => {
        const event = events[item.eventId]
        const slots = bookingSlots(event, item)
        const desk = (event?.stations ?? []).find((station) => station.id === item.stationId)?.label ?? ''
        const created = item.createdAt ? new Date(item.createdAt).toLocaleString('it-IT') : ''
        return [
          [item.firstName, item.lastName].filter(Boolean).join(' '),
          item.email ?? '',
          item.phone ?? '',
          event?.name ?? SHORT[item.eventId] ?? item.eventId,
          [...(item.dates ?? [])].filter(Boolean).sort().join(', '),
          slots.length ? `${slots[0].start}–${slots[slots.length - 1].end}` : '',
          desk,
          bookingPhase(item, today) === 'past' ? 'Passata' : item.status === 'active' ? 'Attiva' : 'Annullata',
          item.extra ?? '',
          ...customLabels.map((label) => (item.custom ?? []).find((entry) => entry.label === label)?.value ?? ''),
          item.notes ?? '',
          created,
        ]
      }),
    ]
    const csv = lines
      .map((cells) => cells.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
    const file = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `prenotazioni-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function copyReception() {
    try {
      await navigator.clipboard.writeText(receptionLink)
      setCopiedDesk(true)
      window.setTimeout(() => setCopiedDesk(false), 1600)
    } catch {
      setCopiedDesk(false)
    }
  }

  async function copyCalendar() {
    try {
      await navigator.clipboard.writeText(PUBLIC_CALENDAR)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="month">
      <section className="gest-head">
        <div className="gest-head-top">
          <div>
            <p className="gest-kicker">Spazio COME</p>
            <h1>Calendario</h1>
          </div>
          <div className="gest-head-actions">
            <button type="button" className="gest-btn" onClick={() => openNew()}>
              Aggiungi prenotazione
            </button>
            <button type="button" className="gest-btn" onClick={() => setGuestModal({ type: 'new' })}>
              Aggiungi ospite
            </button>
          </div>
        </div>
        <div className="gest-links">
          {receptionLink ? (
            <>
              <a className="gest-link-btn" href={receptionLink} target="_blank" rel="noopener noreferrer">
                Apri reception
              </a>
              <button type="button" className="gest-link-btn" onClick={copyReception}>
                {copiedDesk ? 'Link copiato' : 'Copia link reception'}
              </button>
            </>
          ) : null}
          <a className="gest-link-btn" href={PUBLIC_CALENDAR} target="_blank" rel="noopener noreferrer">
            Apri Calendario Google
          </a>
          <button type="button" className="gest-link-btn" onClick={copyCalendar}>
            {copied ? 'Link copiato' : 'Copia link Calendario Google'}
          </button>
        </div>
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
              onChange={pickFilter}
              options={[
                { id: 'all', label: 'Tutti' },
                ...SERVICES.map((item) => ({
                  id: item.id,
                  label: events[item.id]?.name ?? item.name,
                  color: typeColor(colors, item.id),
                })),
                { id: 'ospite', label: 'Ospite', color: typeColor(colors, 'ospite') },
              ]}
            />
            <MonthMenu value={monthFilter} onChange={setMonthFilter} />
            <label className="cal-search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16.5 20 20.5" />
              </svg>
              <input
                type="search"
                value={query}
                placeholder="Cerca nome o note"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="cal-tools-end">
              <button
                type="button"
                className={`cal-switch${activeOnly ? ' is-on' : ''}`}
                aria-pressed={activeOnly}
                onClick={() => setActiveOnly((on) => !on)}
              >
                <i />
                Solo attive
              </button>
              <button type="button" className="cal-export" onClick={exportCsv}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4.5v9" />
                  <path d="m8 10 4 4 4-4" />
                  <path d="M5.5 18.5h13" />
                </svg>
                Esporta CSV
              </button>
            </div>
          </div>
          {cards.length ? (
            <div className="cal-cards">
              {cards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  className={`cal-card${card.phase === 'cancelled' ? ' is-off' : ''}${card.phase === 'past' ? ' is-past' : ''}`}
                  style={{ '--type': card.color }}
                  onClick={() => {
                    if (card.kind === 'guest') {
                      const item = guests.find((guest) => guest.id === card.id)
                      if (item) setGuestModal({ type: 'edit', guest: item, date: card.sort })
                      return
                    }
                    openBooking(card.id, card.sort, '')
                  }}
                >
                  <span className="cal-card-date">
                    <span>{card.month}</span>
                    <b>{card.day}</b>
                    <small>{card.range}</small>
                  </span>
                  <span className="cal-card-body">
                    <strong>{card.title}</strong>
                    <span className="cal-card-tags">
                      <span className="cal-card-tag">{card.tag}</span>
                      {card.phase === 'past' ? <span className="cal-card-state">Passata</span> : null}
                      {card.phase === 'cancelled' ? <span className="cal-card-state is-cancel">Annullata</span> : null}
                    </span>
                    <span className="cal-card-meta">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 2.6a6.2 6.2 0 0 0-6.2 6.2c0 4.6 6.2 12.4 6.2 12.4s6.2-7.8 6.2-12.4A6.2 6.2 0 0 0 12 2.6zm0 8.4a2.2 2.2 0 1 1 2.2-2.2A2.2 2.2 0 0 1 12 11z" />
                      </svg>
                      {card.when}
                    </span>
                    <span className="cal-card-open" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M10 6H6.5A1.5 1.5 0 0 0 5 7.5v10A1.5 1.5 0 0 0 6.5 19h10a1.5 1.5 0 0 0 1.5-1.5V14" />
                        <path d="M13 5h6v6" />
                        <path d="M19 5 10.5 13.5" />
                      </svg>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="dash-empty">Nessuna prenotazione con questi filtri.</p>
          )}
        </>
      ) : null}

      {view === 'month' ? (
      <div className="month-legend">
        {SERVICES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? 'is-on' : ''}
            onClick={() => pickFilter((prev) => (prev === item.id ? 'all' : item.id))}
          >
            <i style={{ background: typeColor(colors, item.id) }} />
            {events[item.id]?.name ?? item.name}
          </button>
        ))}
        <button
          type="button"
          className={filter === 'ospite' ? 'is-on' : ''}
          onClick={() => pickFilter((prev) => (prev === 'ospite' ? 'all' : 'ospite'))}
        >
          <i style={{ background: typeColor(colors, 'ospite') }} />
          Ospite
        </button>
      </div>
      ) : null}

      {view === 'month' ? (
      <>
      <div className="month-toolbar">
        <button type="button" className="cal-dir" onClick={() => shift(-1)} aria-label="Mese precedente">
          <CalDirIcon dir="prev" />
        </button>
        <button type="button" onClick={goToday}>
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
          {cells.map((cell) => {
            const chips = byDay[cell.iso] ?? []
            return (
              <div
                key={cell.iso}
                className={`month-day${cell.inMonth ? '' : ' is-out'}${cell.iso === today ? ' is-today' : ''}`}
                onClick={() => openNew(cell.iso)}
              >
                <span className="month-num">{Number(cell.iso.slice(8))}</span>
                <div className="month-chips">
                  {chips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      className={`month-chip${chip.off ? ' is-off' : ''}`}
                      style={{ '--chip': chip.color }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (chip.kind === 'guest') {
                          const item = guests.find((g) => g.id === chip.id)
                          if (item) setGuestModal({ type: 'edit', guest: item, date: cell.iso })
                          return
                        }
                        openBooking(chip.id, cell.iso, chip.slotId)
                      }}
                    >
                      {chip.text}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      </>
      ) : null}

      {form ? (
        <div className="edit-overlay" role="presentation">
          <button className="edit-backdrop" type="button" aria-label="Chiudi" onClick={closeModal} />
          <form className="edit-modal" onSubmit={save}>
            <header>
              <h2>{isNew ? 'Nuova prenotazione' : 'Modifica attività'}</h2>
              <button type="button" className="edit-x" onClick={closeModal} aria-label="Chiudi">
                ×
              </button>
            </header>

            <label className="admin-field">
              <span>Risorsa</span>
              <select value={form.eventId} onChange={(e) => setField('eventId', e.target.value)}>
                {SERVICES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {events[item.id]?.name ?? item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-field">
              <span>Nome / titolo</span>
              <input value={form.title} onChange={(e) => setField('title', e.target.value)} />
            </label>

            <div className="edit-row">
              <label className="admin-field">
                <span>Email</span>
                <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
              </label>
              <label className="admin-field">
                <span>Telefono</span>
                <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
              </label>
            </div>

            <div className="edit-row">
              <label className="admin-field">
                <span>Data inizio</span>
                <input
                  type="date"
                  value={form.dateStart}
                  onChange={(e) => setField('dateStart', e.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>Data fine</span>
                <input type="date" value={form.dateEnd} onChange={(e) => setField('dateEnd', e.target.value)} />
              </label>
            </div>

            <div className="edit-row">
              <label className="admin-field">
                <span>Orario inizio</span>
                <Time24
                  label="Orario inizio"
                  placeholder="09:00"
                  value={form.timeStart}
                  onChange={(v) => setField('timeStart', v)}
                />
              </label>
              <label className="admin-field">
                <span>Orario fine</span>
                <Time24
                  label="Orario fine"
                  placeholder="18:00"
                  value={form.timeEnd}
                  onChange={(v) => setField('timeEnd', v)}
                />
              </label>
            </div>
            <p className="edit-hint">
              Se lasci entrambi gli orari vuoti l’attività viene registrata per l’intera giornata.
            </p>

            {event?.hasStations ? (
              <label className="admin-field">
                <span>Postazione</span>
                <select value={form.stationId} onChange={(e) => setField('stationId', e.target.value)}>
                  <option value="">Seleziona</option>
                  {(event.stations ?? []).map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {event?.extraMenu?.enabled ? (
              <label className="admin-field">
                <span>{event.extraMenu.label}</span>
                <select value={form.extra} onChange={(e) => setField('extra', e.target.value)}>
                  <option value="">Seleziona</option>
                  {event.extraMenu.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {activeCustomFields(event).map((field) => {
              const value = customValue(form.custom, field.id)
              const change = (next) => setField('custom', setCustomValue(form.custom, field, next))
              return (
                <label className="admin-field" key={field.id}>
                  <span>{field.label}</span>
                  {field.type === 'select' ? (
                    <select value={value} onChange={(e) => change(e.target.value)}>
                      <option value="">Seleziona</option>
                      {(field.options ?? []).filter(Boolean).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={value}
                      inputMode={field.type === 'number' ? 'decimal' : undefined}
                      onChange={(e) => change(e.target.value)}
                    />
                  )}
                </label>
              )
            })}

            <label className="admin-field">
              <span>Note / motivo</span>
              <textarea rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </label>

            {error ? <p className="book-error">{error}</p> : null}

            <div className="edit-actions">
              <button className="btn-save" type="submit">
                {isNew ? 'Crea' : 'Salva'}
              </button>
              <button className="btn-ghost" type="button" onClick={closeModal}>
                Chiudi
              </button>
              {!isNew && booking ? (
                <>
                  <button
                    className="btn-danger"
                    type="button"
                    onClick={async () => {
                      const result = await setBookingStatus(
                        booking.id,
                        booking.status === 'active' ? 'cancelled' : 'active',
                      )
                      if (!result.ok) {
                        setError(result.error)
                        return
                      }
                      closeModal()
                    }}
                  >
                    {booking.status === 'active' ? 'Annulla attività' : 'Riattiva attività'}
                  </button>
                  <button
                    className="btn-danger is-fill"
                    type="button"
                    onClick={async () => {
                      const manyDays = (booking.dates ?? []).length > 1
                      const label = focusDate ? formatISO(focusDate) : ''
                      const ok = window.confirm(
                        manyDays && focusDate
                          ? `Eliminare solo l’attività del ${label}? Le altre date restano.`
                          : 'Eliminare definitivamente questa prenotazione? L’azione non si può annullare.',
                      )
                      if (!ok) return
                      const result = await removeBookingOccurrence(booking.id, focusDate, focusSlotId)
                      if (!result.ok) {
                        setError(result.error)
                        return
                      }
                      closeModal()
                    }}
                  >
                    Elimina
                  </button>
                </>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      {guestModal?.type === 'new' ? <GuestModal onClose={() => setGuestModal(null)} /> : null}
      {guestModal?.type === 'edit' ? (
        <GuestModal guest={guestModal.guest} date={guestModal.date} onClose={() => setGuestModal(null)} />
      ) : null}
    </div>
  )
}
