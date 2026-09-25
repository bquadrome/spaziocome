import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { easeOut } from '../motion.js'
import CalendarMonth from './admin/CalendarMonth.jsx'
import {
  addBooking,
  dateHasFreeSlot,
  formatISO,
  isDateBookable,
  isSlotFull,
  isStationTaken,
  slotCapacity,
  slotOccupancy,
  useBookingStore,
} from '../store/bookingStore.js'

const STEPS = [
  { id: 2, label: 'Quando' },
  { id: 3, label: 'Dati' },
  { id: 4, label: 'Riepilogo' },
]

export default function Booking({ initialId = '', onClose }) {
  const store = useBookingStore()
  const config = store.events[initialId]
  const [step, setStep] = useState(2)
  const [sent, setSent] = useState(false)
  const [errors, setErrors] = useState({})
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [form, setForm] = useState({
    dates: [],
    slotIds: [],
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
    extra: '',
    stationId: '',
    privacy: false,
  })

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const disabledDates = useMemo(() => {
    if (!config) return []
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const off = []
    for (let d = 1; d <= days; d += 1) {
      const iso = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (!isDateBookable(config, iso) || !dateHasFreeSlot(initialId, iso)) off.push(iso)
    }
    return off
  }, [config, cursor, initialId, store.bookings])

  const selectedSlots = (config?.slots ?? []).filter((slot) => form.slotIds.includes(slot.id))
  const selectedStation = (config?.stations ?? []).find((item) => item.id === form.stationId)
  const cap = slotCapacity(config)

  const canNext = useMemo(() => {
    if (!config) return false
    if (step === 2) {
      if (!form.dates.length || !form.slotIds.length) return false
      if (config.hasStations && !form.stationId) return false
      return true
    }
    if (step === 3) {
      const { fields, extraMenu } = config
      if (fields.firstName.enabled && fields.firstName.required && !form.firstName.trim()) return false
      if (fields.lastName.enabled && fields.lastName.required && !form.lastName.trim()) return false
      if (fields.email.enabled && fields.email.required && !form.email.trim()) return false
      if (fields.phone.enabled && fields.phone.required && !form.phone.trim()) return false
      if (fields.notes.enabled && fields.notes.required && !form.notes.trim()) return false
      if (extraMenu.enabled && extraMenu.required && !form.extra) return false
      if (!form.privacy) return false
      return true
    }
    return true
  }, [step, form, config])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  function toggleDate(iso) {
    if (!config || !isDateBookable(config, iso) || !dateHasFreeSlot(initialId, iso)) return
    setForm((prev) => {
      const has = prev.dates.includes(iso)
      let dates
      if (has) dates = prev.dates.filter((d) => d !== iso)
      else if (!config.allowMultiDay) dates = [iso]
      else if (prev.dates.length >= config.maxDays) dates = prev.dates
      else dates = [...prev.dates, iso].sort()
      const slotIds = prev.slotIds.filter((id) => !dates.some((d) => isSlotFull(initialId, d, id)))
      const stationId =
        config.hasStations && prev.stationId && stationFree(dates, slotIds, prev.stationId)
          ? prev.stationId
          : ''
      return { ...prev, dates, slotIds, stationId }
    })
    setErrors((prev) => ({ ...prev, dates: '', slots: '', stationId: '' }))
  }

  function toggleSlot(id) {
    if (!config) return
    setForm((prev) => {
      const has = prev.slotIds.includes(id)
      let slotIds
      if (has) slotIds = prev.slotIds.filter((s) => s !== id)
      else if (!config.allowMultiSlot) slotIds = [id]
      else if (prev.slotIds.length >= config.maxSlots) slotIds = prev.slotIds
      else slotIds = [...prev.slotIds, id]
      const stationId =
        config.hasStations && prev.stationId && stationFree(prev.dates, slotIds, prev.stationId)
          ? prev.stationId
          : ''
      return { ...prev, slotIds, stationId }
    })
    setErrors((prev) => ({ ...prev, slots: '', stationId: '' }))
  }

  function stationFree(dates, slotIds, stationId) {
    if (!stationId || !dates.length || !slotIds.length) return true
    return !dates.some((date) => slotIds.some((id) => isStationTaken(initialId, date, id, stationId)))
  }

  function slotBusy(slotId) {
    return form.dates.some((date) => isSlotFull(initialId, date, slotId))
  }

  function slotLeft(slotId) {
    if (!form.dates.length) return cap
    return Math.min(...form.dates.map((date) => cap - slotOccupancy(initialId, date, slotId)))
  }

  function stationBusy(stationId) {
    return !stationFree(form.dates, form.slotIds, stationId)
  }

  function validate() {
    const next = {}
    if (step === 2) {
      if (!form.dates.length) next.dates = 'Scegli almeno un giorno.'
      if (!form.slotIds.length) next.slots = 'Scegli almeno uno slot.'
      const clash = form.dates.some((date) => form.slotIds.some((id) => isSlotFull(initialId, date, id)))
      if (clash) next.slots = 'Uno slot scelto non è più disponibile.'
      if (config?.hasStations) {
        if (!form.stationId) next.stationId = 'Scegli una postazione.'
        else if (!stationFree(form.dates, form.slotIds, form.stationId)) {
          next.stationId = 'Postazione già occupata.'
        }
      }
    }
    if (step === 3 && config) {
      const { fields, extraMenu } = config
      if (fields.firstName.enabled && fields.firstName.required && !form.firstName.trim()) {
        next.firstName = 'Obbligatorio.'
      }
      if (fields.lastName.enabled && fields.lastName.required && !form.lastName.trim()) {
        next.lastName = 'Obbligatorio.'
      }
      if (fields.email.enabled && fields.email.required) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Mail non valida.'
      } else if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        next.email = 'Mail non valida.'
      }
      if (fields.phone.enabled && fields.phone.required && !form.phone.trim()) next.phone = 'Obbligatorio.'
      if (fields.notes.enabled && fields.notes.required && !form.notes.trim()) next.notes = 'Obbligatorio.'
      if (extraMenu.enabled && extraMenu.required && !form.extra) next.extra = 'Seleziona una voce.'
      if (!form.privacy) next.privacy = 'Serve il consenso al trattamento dei dati.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function goNext() {
    if (!validate()) return
    setStep((s) => Math.min(4, s + 1))
  }

  function goBack() {
    setStep((s) => Math.max(2, s - 1))
  }

  async function onSubmit(event) {
    event.preventDefault()
    if (!form.privacy) {
      setErrors({ privacy: 'Serve il consenso al trattamento dei dati.' })
      setStep(3)
      return
    }
    if (!validate()) return
    const result = await addBooking({
      eventId: initialId,
      dates: form.dates,
      slotIds: form.slotIds,
      stationId: form.stationId,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      notes: form.notes.trim(),
      extra: form.extra,
    })
    if (!result.ok) {
      setErrors({ slots: result.error })
      setStep(2)
      return
    }
    setSent(true)
  }

  function shift(delta) {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }

  if (!config) return null

  const closeBtn = (
    <button className="book-close" type="button" onClick={onClose} aria-label="Chiudi">
      <span />
      <span />
    </button>
  )

  const panel = sent ? (
    <div className="booking-done">
      <p className="section-label">
        <img src="/assets/icon-label.svg" alt="" width={24} height={24} />
        <span>PRENOTAZIONE</span>
      </p>
      <h1 id="book-title">
        Richiesta
        <br />
        <span className="rest">inviata.</span>
      </h1>
      <p>
        Grazie {form.firstName || ''}. Prenotazione per <strong>{config.name}</strong>:{' '}
        {form.dates.map(formatISO).join(', ')} ·{' '}
        {selectedSlots.map((slot) => `${slot.start}–${slot.end}`).join(', ')}
        {selectedStation ? ` · ${selectedStation.label}` : ''}. Ti invieremo una mail
        a <strong>{form.email}</strong>.
      </p>
      <button className="btn btn-solid" type="button" onClick={onClose}>
        Chiudi
      </button>
    </div>
  ) : (
    <>
      <header className="booking-head">
        <p className="section-label">
          <img src="/assets/icon-label.svg" alt="" width={24} height={24} />
          <span>PRENOTA</span>
        </p>
        <h1 id="book-title">
          {config.name}
          <br />
          <span className="rest">prenota.</span>
        </h1>
      </header>

      {!config.enabled ? (
        <p className="book-error">Questo spazio non è al momento prenotabile.</p>
      ) : (
        <>
          <ol className="book-steps" aria-label="Passaggi prenotazione">
            {STEPS.map((item, i) => (
              <li
                key={item.id}
                className={`book-step${step === item.id ? ' is-active' : ''}${step > item.id ? ' is-done' : ''}`}
              >
                <span className="book-step-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="book-step-label">{item.label}</span>
              </li>
            ))}
          </ol>

          <form className="book-form" onSubmit={onSubmit} noValidate>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: easeOut }}
              >
                {step === 2 ? (
                  <fieldset className="book-fieldset" aria-label="Giorno e orario">
                    <CalendarMonth
                      year={cursor.y}
                      month={cursor.m}
                      onPrev={() => shift(-1)}
                      onNext={() => shift(1)}
                      onSelect={toggleDate}
                      selected={form.dates}
                      blocked={config.blockedDates}
                      disabled={disabledDates}
                      mode="select"
                    />
                    {errors.dates ? <p className="book-error">{errors.dates}</p> : null}
                    {config.slots.length === 0 ? (
                      <p className="book-error">Nessuno slot orario disponibile.</p>
                    ) : (
                      <div className="book-slots">
                        {config.slots.map((slot) => {
                          const busy = form.dates.length > 0 && slotBusy(slot.id)
                          const on = form.slotIds.includes(slot.id)
                          const left = form.dates.length ? slotLeft(slot.id) : cap
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              className={`book-slot${on ? ' is-on' : ''}${busy ? ' is-full' : ''}`}
                              disabled={!form.dates.length || busy}
                              onClick={() => toggleSlot(slot.id)}
                            >
                              {slot.start} – {slot.end}
                              {busy ? ' (pieno)' : cap > 1 ? ` · ${left}` : ''}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {errors.slots ? <p className="book-error">{errors.slots}</p> : null}
                    {config.hasStations ? (
                      <div className="book-stations">
                        <p className="book-hint">Scegli una postazione.</p>
                        <div className="book-slots">
                          {(config.stations ?? []).map((station) => {
                            const busy =
                              form.dates.length > 0 && form.slotIds.length > 0 && stationBusy(station.id)
                            const on = form.stationId === station.id
                            return (
                              <button
                                key={station.id}
                                type="button"
                                className={`book-slot${on ? ' is-on' : ''}${busy ? ' is-full' : ''}`}
                                disabled={!form.dates.length || !form.slotIds.length || busy}
                                onClick={() => setField('stationId', on ? '' : station.id)}
                              >
                                {station.label}
                                {busy ? ' (occupata)' : ''}
                              </button>
                            )
                          })}
                        </div>
                        {errors.stationId ? <p className="book-error">{errors.stationId}</p> : null}
                      </div>
                    ) : null}
                  </fieldset>
                ) : null}

                {step === 3 ? (
                  <fieldset className="book-fieldset">
                    <legend>I tuoi dati</legend>
                    <div className="book-grid">
                      {config.fields.firstName.enabled ? (
                        <label className="book-field">
                          <span>
                            Nome{config.fields.firstName.required ? '' : ' (opzionale)'}
                          </span>
                          <input
                            value={form.firstName}
                            autoComplete="given-name"
                            onChange={(e) => setField('firstName', e.target.value)}
                          />
                          {errors.firstName ? <small>{errors.firstName}</small> : null}
                        </label>
                      ) : null}
                      {config.fields.lastName.enabled ? (
                        <label className="book-field">
                          <span>
                            Cognome{config.fields.lastName.required ? '' : ' (opzionale)'}
                          </span>
                          <input
                            value={form.lastName}
                            autoComplete="family-name"
                            onChange={(e) => setField('lastName', e.target.value)}
                          />
                          {errors.lastName ? <small>{errors.lastName}</small> : null}
                        </label>
                      ) : null}
                      {config.fields.email.enabled ? (
                        <label className="book-field">
                          <span>Email{config.fields.email.required ? '' : ' (opzionale)'}</span>
                          <input
                            type="email"
                            value={form.email}
                            autoComplete="email"
                            onChange={(e) => setField('email', e.target.value)}
                          />
                          {errors.email ? <small>{errors.email}</small> : null}
                        </label>
                      ) : null}
                      {config.fields.phone.enabled ? (
                        <label className="book-field">
                          <span>
                            Telefono{config.fields.phone.required ? '' : ' (opzionale)'}
                          </span>
                          <input
                            type="tel"
                            value={form.phone}
                            autoComplete="tel"
                            onChange={(e) => setField('phone', e.target.value)}
                          />
                          {errors.phone ? <small>{errors.phone}</small> : null}
                        </label>
                      ) : null}
                      {config.extraMenu.enabled ? (
                        <label className="book-field book-field-wide">
                          <span>
                            {config.extraMenu.label}
                            {config.extraMenu.required ? '' : ' (opzionale)'}
                          </span>
                          <select value={form.extra} onChange={(e) => setField('extra', e.target.value)}>
                            <option value="">Seleziona</option>
                            {config.extraMenu.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          {errors.extra ? <small>{errors.extra}</small> : null}
                        </label>
                      ) : null}
                      {config.fields.notes.enabled ? (
                        <label className="book-field book-field-wide">
                          <span>
                            {config.fields.notes.label}
                            {config.fields.notes.required ? '' : ' (opzionale)'}
                          </span>
                          <textarea
                            rows={4}
                            value={form.notes}
                            placeholder={config.fields.notes.placeholder}
                            onChange={(e) => setField('notes', e.target.value)}
                          />
                          {errors.notes ? <small>{errors.notes}</small> : null}
                        </label>
                      ) : null}
                      <label className="book-privacy">
                        <input
                          type="checkbox"
                          checked={form.privacy}
                          onChange={(e) => setField('privacy', e.target.checked)}
                        />
                        <span>
                          Acconsento al trattamento dei dati personali per gestire la prenotazione,
                          secondo il Regolamento UE 2016/679 (GDPR).
                        </span>
                      </label>
                      {errors.privacy ? <p className="book-error">{errors.privacy}</p> : null}
                    </div>
                  </fieldset>
                ) : null}

                {step === 4 ? (
                  <fieldset className="book-fieldset">
                    <legend>Controlla e conferma</legend>
                    <dl className="book-summary">
                      <div>
                        <dt>Spazio</dt>
                        <dd>{config.name}</dd>
                      </div>
                      <div>
                        <dt>Giorni</dt>
                        <dd>{form.dates.map(formatISO).join(', ')}</dd>
                      </div>
                      <div>
                        <dt>Orari</dt>
                        <dd>{selectedSlots.map((slot) => `${slot.start}–${slot.end}`).join(', ')}</dd>
                      </div>
                      {selectedStation ? (
                        <div>
                          <dt>Postazione</dt>
                          <dd>{selectedStation.label}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>Contatto</dt>
                        <dd>
                          {[form.firstName, form.lastName].filter(Boolean).join(' ')}
                          {form.email ? (
                            <>
                              <br />
                              {form.email}
                            </>
                          ) : null}
                          {form.phone ? (
                            <>
                              <br />
                              {form.phone}
                            </>
                          ) : null}
                        </dd>
                      </div>
                      {form.extra ? (
                        <div>
                          <dt>{config.extraMenu.label}</dt>
                          <dd>{form.extra}</dd>
                        </div>
                      ) : null}
                      {form.notes ? (
                        <div>
                          <dt>{config.fields.notes.label}</dt>
                          <dd>{form.notes}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </fieldset>
                ) : null}
              </motion.div>
            </AnimatePresence>

            <div className="book-actions">
              {step > 2 ? (
                <button className="btn" type="button" onClick={goBack}>
                  Indietro
                </button>
              ) : (
                <button className="btn" type="button" onClick={onClose}>
                  Cambia spazio
                </button>
              )}
              {step < 4 ? (
                <button className="btn btn-solid" type="button" onClick={goNext} disabled={!canNext}>
                  Avanti
                </button>
              ) : (
                <button className="btn btn-solid" type="submit">
                  Invia richiesta
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </>
  )

  return (
    <motion.div
      className="book-overlay"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button className="book-backdrop" type="button" aria-label="Chiudi" onClick={onClose} />
      <motion.div
        className="book-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-title"
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 32, opacity: 0 }}
        transition={{ duration: 0.35, ease: easeOut }}
        data-lenis-prevent
      >
        {closeBtn}
        <div className="booking">{panel}</div>
      </motion.div>
    </motion.div>
  )
}
