import { useEffect, useMemo, useState } from 'react'
import Time24 from './Time24.jsx'
import GuestModal from './GuestModal.jsx'
import {
  EVENT_COLORS,
  WEEKDAYS,
  datesBetween,
  isSlotFull,
  isStationTaken,
  monthGrid,
  patchBooking,
  addBooking,
  setBookingStatus,
  splitName,
  todayISO,
  useBookingStore,
} from '../../store/bookingStore.js'
import { SERVICES } from '../../data/services.js'
import { CalDirIcon } from './CalendarMonth.jsx'

const SHORT = {
  coworking: 'Coworking',
  meeting: 'Meeting',
  expo: 'Expo',
  eu: 'EU Lab',
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
    notes: '',
    stationId: '',
  }
}

export default function AdminCalendar() {
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState('')
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [guestModal, setGuestModal] = useState(null)
  const { bookings = [], events = {}, guests = [] } = useBookingStore()
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
      const chips = slots.length
        ? slots.map((slot) => ({
            key: `${item.id}-${slot.id}`,
            kind: 'booking',
            id: item.id,
            time: slot.start,
            text: `${slot.start} ${space} - ${who}`,
            color: EVENT_COLORS[item.eventId],
            off: item.status !== 'active',
          }))
        : [
            {
              key: item.id,
              kind: 'booking',
              id: item.id,
              time: '',
              text: `${space} - ${name}`,
              color: EVENT_COLORS[item.eventId],
              off: item.status !== 'active',
            },
          ]
      for (const date of dates) chips.forEach((chip) => push(date, chip))
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
        color: EVENT_COLORS.ospite,
        off: item.status !== 'active',
      }
      for (const date of item.dates ?? []) push(date, chip)
    }
    for (const date of Object.keys(map)) {
      map[date].sort((a, b) => String(a.time ?? '').localeCompare(String(b.time ?? '')))
    }
    return map
  }, [visible, visibleGuests, events])

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
    setError('')
    setForm(emptyForm(date || todayISO(), eventId))
  }

  function openBooking(id) {
    const item = bookings.find((b) => b.id === id)
    if (!item) return
    setOpenId(id)
    setError('')
    setForm(formFromBooking(item, events))
  }

  function closeModal() {
    setOpenId('')
    setForm(null)
    setError('')
  }

  function setField(key, value) {
    setForm((prev) => {
      if (key === 'eventId') return { ...prev, eventId: value, stationId: '', extra: '' }
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
      notes: form.notes.trim(),
    }
    const result = isNew ? await addBooking(payload) : await patchBooking(booking.id, payload)
    if (!result.ok) {
      setError(result.error)
      return
    }
    closeModal()
  }

  return (
    <div className="month">
      <div className="month-legend">
        {SERVICES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? 'is-on' : ''}
            onClick={() => setFilter((prev) => (prev === item.id ? 'all' : item.id))}
          >
            <i style={{ background: EVENT_COLORS[item.id] }} />
            {events[item.id]?.name ?? item.name}
          </button>
        ))}
        <button
          type="button"
          className={filter === 'ospite' ? 'is-on' : ''}
          onClick={() => setFilter((prev) => (prev === 'ospite' ? 'all' : 'ospite'))}
        >
          <i style={{ background: EVENT_COLORS.ospite }} />
          Ospite
        </button>
      </div>

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
        <strong>{title}</strong>
        <button type="button" className="month-add" onClick={() => openNew()}>
          Aggiungi prenotazione
        </button>
        <button type="button" className="month-add" onClick={() => setGuestModal({ type: 'new' })}>
          Aggiungi ospite
        </button>
      </div>

      <div className="month-board">
        <div className="month-weekdays">
          {WEEKDAYS.map((day) => (
            <span key={day.id}>{day.label}</span>
          ))}
        </div>
        <div className="month-grid">
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
                          if (item) setGuestModal({ type: 'edit', guest: item })
                          return
                        }
                        openBooking(chip.id)
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
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      {guestModal?.type === 'new' ? <GuestModal onClose={() => setGuestModal(null)} /> : null}
      {guestModal?.type === 'edit' ? (
        <GuestModal guest={guestModal.guest} onClose={() => setGuestModal(null)} />
      ) : null}
    </div>
  )
}
