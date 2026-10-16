import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { easeOut } from '../motion.js'
import CalendarMonth from './admin/CalendarMonth.jsx'
import CoworkingMap, { usesCoworkingMap } from './CoworkingMap.jsx'
import {
  activeCustomFields,
  addBooking,
  bookingConflict,
  submitQuoteRequest,
  customError,
  customValue,
  dateHasFreeSlot,
  formatISO,
  isDateBookable,
  isSlotFull,
  isStationTaken,
  setCustomValue,
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
    slotsByDay: {},
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
    extra: '',
    custom: [],
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

  const sortedDates = form.dates.slice().sort()
  const daySlots = (iso) => form.slotsByDay[iso] ?? []
  const anySlot = form.dates.some((iso) => daySlots(iso).length > 0)
  const slotLabel = (id) => {
    const slot = (config?.slots ?? []).find((s) => s.id === id)
    return slot ? `${slot.start}–${slot.end}` : ''
  }
  const selectedStation = (config?.stations ?? []).find((item) => item.id === form.stationId)
  const customFields = activeCustomFields(config)
  const isRequest = !!config?.requestMode
  const emailRequired = isRequest || !!config?.fields?.email?.required

  const canNext = useMemo(() => {
    if (!config) return false
    if (step === 2) {
      if (!form.dates.length) return false
      if (!form.dates.every((iso) => daySlots(iso).length > 0)) return false
      if (config.hasStations && !form.stationId) return false
      return true
    }
    if (step === 3) {
      const { fields, extraMenu } = config
      if (fields.firstName.enabled && fields.firstName.required && !form.firstName.trim()) return false
      if (fields.lastName.enabled && fields.lastName.required && !form.lastName.trim()) return false
      if ((fields.email.enabled || isRequest) && emailRequired && !form.email.trim()) return false
      if (fields.phone.enabled && fields.phone.required && !form.phone.trim()) return false
      if (fields.notes.enabled && fields.notes.required && !form.notes.trim()) return false
      if (extraMenu.enabled && extraMenu.required && !form.extra) return false
      if (customFields.some((field) => field.required && !customValue(form.custom, field.id).trim())) return false
      if (!form.privacy) return false
      return true
    }
    return true
  }, [step, form, config])

  function setCustom(field, value) {
    setForm((prev) => ({ ...prev, custom: setCustomValue(prev.custom, field, value) }))
    setErrors((prev) => ({ ...prev, [`custom-${field.id}`]: '' }))
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  function toggleDate(iso) {
    if (!config || !isDateBookable(config, iso) || !dateHasFreeSlot(initialId, iso)) return
    setForm((prev) => {
      const has = prev.dates.includes(iso)
      let dates
      let slotsByDay = { ...prev.slotsByDay }
      if (has) {
        dates = prev.dates.filter((d) => d !== iso)
        delete slotsByDay[iso]
      } else if (!config.allowMultiDay) {
        dates = [iso]
        slotsByDay = { [iso]: prev.slotsByDay[iso] ?? [] }
      } else if (prev.dates.length >= config.maxDays) {
        return prev
      } else {
        dates = [...prev.dates, iso]
        if (!slotsByDay[iso]) slotsByDay[iso] = []
      }
      const stationId =
        config.hasStations && prev.stationId && stationFree(dates, slotsByDay, prev.stationId)
          ? prev.stationId
          : ''
      return { ...prev, dates, slotsByDay, stationId }
    })
    setErrors((prev) => ({ ...prev, dates: '', slots: '', stationId: '' }))
  }

  function toggleSlot(iso, id) {
    if (!config) return
    setForm((prev) => {
      const cur = prev.slotsByDay[iso] ?? []
      const has = cur.includes(id)
      let next
      if (has) next = cur.filter((s) => s !== id)
      else if (!config.allowMultiSlot) next = [id]
      else if (cur.length >= config.maxSlots) next = cur
      else next = [...cur, id]
      const slotsByDay = { ...prev.slotsByDay, [iso]: next }
      const stationId =
        config.hasStations && prev.stationId && stationFree(prev.dates, slotsByDay, prev.stationId)
          ? prev.stationId
          : ''
      return { ...prev, slotsByDay, stationId }
    })
    setErrors((prev) => ({ ...prev, slots: '', stationId: '' }))
  }

  function stationFree(dates, slotsByDay, stationId) {
    if (!stationId || !dates.length) return true
    return !dates.some((date) =>
      (slotsByDay[date] ?? []).some((id) => isStationTaken(initialId, date, id, stationId)),
    )
  }

  function stationBusy(stationId) {
    return !stationFree(form.dates, form.slotsByDay, stationId)
  }

  function validate() {
    const next = {}
    if (step === 2) {
      if (!form.dates.length) next.dates = 'Scegli almeno un giorno.'
      if (form.dates.some((iso) => daySlots(iso).length === 0)) {
        next.slots = 'Scegli un orario per ogni giorno.'
      } else {
        const clash = form.dates.some((iso) => daySlots(iso).some((id) => isSlotFull(initialId, iso, id)))
        if (clash) next.slots = 'Uno slot scelto non è più disponibile.'
      }
      if (config?.hasStations) {
        if (!form.stationId) next.stationId = 'Scegli una postazione.'
        else if (!stationFree(form.dates, form.slotsByDay, form.stationId)) {
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
      if ((fields.email.enabled || isRequest) && emailRequired) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Mail non valida.'
      } else if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        next.email = 'Mail non valida.'
      }
      if (fields.phone.enabled && fields.phone.required && !form.phone.trim()) next.phone = 'Obbligatorio.'
      if (fields.notes.enabled && fields.notes.required && !form.notes.trim()) next.notes = 'Obbligatorio.'
      if (extraMenu.enabled && extraMenu.required && !form.extra) next.extra = 'Seleziona una voce.'
      for (const field of customFields) {
        const message = customError(field, customValue(form.custom, field.id))
        if (message) next[`custom-${field.id}`] = message
      }
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
    if (step < 4) {
      if (canNext) goNext()
      return
    }
    if (!form.privacy) {
      setErrors({ privacy: 'Serve il consenso al trattamento dei dati.' })
      setStep(3)
      return
    }
    if (!validate()) return
    const base = {
      stationId: form.stationId,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      notes: form.notes.trim(),
      extra: form.extra,
      custom: form.custom
        .map((item) => ({ ...item, value: String(item.value).trim() }))
        .filter((item) => item.value),
    }
    const days = sortedDates.filter((day) => daySlots(day).length > 0)

    if (isRequest) {
      // Spazi su richiesta: UNA sola richiesta di preventivo per tutta la selezione.
      const unionSlots = [...new Set(days.flatMap((day) => daySlots(day)))]
      const varies = days.some(
        (day) => daySlots(day).slice().sort().join('|') !== daySlots(days[0]).slice().sort().join('|'),
      )
      const breakdown = days
        .map((day) => `${formatISO(day)}: ${daySlots(day).map(slotLabel).join(', ')}`)
        .join(' | ')
      const notes =
        varies && breakdown ? [base.notes, `Orari per giorno: ${breakdown}`].filter(Boolean).join('\n') : base.notes
      const result = await submitQuoteRequest({ eventId: initialId, dates: days, slotIds: unionSlots, ...base, notes })
      if (!result.ok) {
        setErrors({ slots: result.error })
        setStep(2)
        return
      }
      setSent(true)
      return
    }

    // Prenotazioni dirette: valida i conflitti, poi raggruppa i giorni con gli stessi orari in un'unica prenotazione.
    for (const day of days) {
      const conflict = bookingConflict(
        { eventId: initialId, dates: [day], slotIds: daySlots(day), stationId: form.stationId },
        '',
      )
      if (conflict) {
        setErrors({ slots: conflict })
        setStep(2)
        return
      }
    }
    const groups = new Map()
    for (const day of days) {
      const ids = daySlots(day)
      const key = ids.slice().sort().join('|')
      if (!groups.has(key)) groups.set(key, { slotIds: ids, days: [] })
      groups.get(key).days.push(day)
    }
    let firstErr = null
    for (const group of groups.values()) {
      const result = await addBooking({ eventId: initialId, dates: group.days, slotIds: group.slotIds, ...base })
      if (!result.ok) {
        firstErr = result.error
        break
      }
    }
    if (firstErr) {
      setErrors({ slots: firstErr })
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

  const bookingLines = sortedDates.map((iso) => ({
    iso,
    slots: daySlots(iso).map(slotLabel).filter(Boolean),
  }))

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
        <span>{isRequest ? 'RICHIESTA' : 'PRENOTAZIONE'}</span>
      </p>
      <h1 id="book-title">
        Richiesta
        <br />
        <span className="rest">inviata.</span>
      </h1>
      {isRequest ? (
        <p>
          Grazie {form.firstName || ''}. Abbiamo ricevuto la tua richiesta per <strong>{config.name}</strong>:{' '}
          {bookingLines.map((row) => `${formatISO(row.iso)} (${row.slots.join(', ')})`).join(' · ')}. Ti invieremo un
          preventivo a <strong>{form.email}</strong>: la data sarà confermata dopo l’accettazione e il pagamento.
        </p>
      ) : (
        <p>
          Grazie {form.firstName || ''}. Prenotazione per <strong>{config.name}</strong>:{' '}
          {bookingLines.map((row) => `${formatISO(row.iso)} (${row.slots.join(', ')})`).join(' · ')}
          {selectedStation ? ` · ${selectedStation.label}` : ''}. Ti invieremo una mail a <strong>{form.email}</strong>{' '}
          con il riepilogo
          {config.hasQr ? ', il pass QR per la reception' : ''} e il link per annullare.
        </p>
      )}
      <button className="btn btn-solid" type="button" onClick={onClose}>
        Chiudi
      </button>
    </div>
  ) : (
    <>
      <header className="booking-head">
        <p className="section-label">
          <img src="/assets/icon-label.svg" alt="" width={24} height={24} />
          <span>{isRequest ? 'RICHIEDI UN PREVENTIVO' : 'PRENOTA'}</span>
        </p>
        <h1 id="book-title">
          {config.name}
          <br />
          <span className="rest">{isRequest ? 'richiedi.' : 'prenota.'}</span>
        </h1>
        {isRequest ? (
          <p className="book-request-note">
            Scegli una o più date e orari: riceverai un preventivo via mail. La data è confermata solo dopo
            accettazione e pagamento.
          </p>
        ) : null}
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
                    ) : form.dates.length === 0 ? (
                      <p className="book-hint">Scegli uno o più giorni dal calendario.</p>
                    ) : (
                      <div className="book-byday">
                        {sortedDates.map((iso) => (
                          <div className="book-byday-row" key={iso}>
                            <div className="book-byday-head">
                              <span className="book-byday-day">{formatISO(iso)}</span>
                              {config.allowMultiSlot ? (
                                <span className="book-byday-mini">orari di questo giorno</span>
                              ) : null}
                            </div>
                            <div className="book-slots">
                              {config.slots.map((slot) => {
                                const busy = isSlotFull(initialId, iso, slot.id)
                                const on = daySlots(iso).includes(slot.id)
                                return (
                                  <button
                                    key={slot.id}
                                    type="button"
                                    className={`book-slot${on ? ' is-on' : ''}${busy ? ' is-full' : ''}`}
                                    disabled={busy}
                                    onClick={() => toggleSlot(iso, slot.id)}
                                  >
                                    {slot.start} – {slot.end}
                                    {busy ? ' (pieno)' : ''}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {errors.slots ? <p className="book-error">{errors.slots}</p> : null}
                    {config.hasStations ? (
                      <div className="book-stations">
                        <p className="book-hint">Scegli una postazione.</p>
                        {usesCoworkingMap(initialId, config.stations) ? (
                          <CoworkingMap
                            stations={config.stations}
                            value={form.stationId}
                            onChange={(id) => setField('stationId', id)}
                            isBusy={stationBusy}
                            ready={form.dates.length > 0 && anySlot}
                          />
                        ) : (
                          <div className="book-slots">
                            {(config.stations ?? []).map((station) => {
                              const busy = form.dates.length > 0 && anySlot && stationBusy(station.id)
                              const on = form.stationId === station.id
                              return (
                                <button
                                  key={station.id}
                                  type="button"
                                  className={`book-slot${on ? ' is-on' : ''}${busy ? ' is-full' : ''}`}
                                  disabled={!form.dates.length || !anySlot || busy}
                                  onClick={() => setField('stationId', on ? '' : station.id)}
                                >
                                  {station.label}
                                  {busy ? ' (occupata)' : ''}
                                </button>
                              )
                            })}
                          </div>
                        )}
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
                      {config.fields.email.enabled || isRequest ? (
                        <label className="book-field">
                          <span>Email{emailRequired ? '' : ' (opzionale)'}</span>
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
                      {customFields.map((field) => {
                        const value = customValue(form.custom, field.id)
                        const message = errors[`custom-${field.id}`]
                        const label = `${field.label}${field.required ? '' : ' (opzionale)'}`
                        return (
                          <label className="book-field" key={field.id}>
                            <span>{label}</span>
                            {field.type === 'select' ? (
                              <select value={value} onChange={(e) => setCustom(field, e.target.value)}>
                                <option value="">Seleziona</option>
                                {(field.options ?? []).filter(Boolean).map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                inputMode={field.type === 'number' ? 'decimal' : undefined}
                                value={value}
                                onChange={(e) => setCustom(field, e.target.value)}
                              />
                            )}
                            {message ? <small>{message}</small> : null}
                          </label>
                        )
                      })}
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
                        <dt>Giorni e orari</dt>
                        <dd>
                          {bookingLines.map((row) => (
                            <div key={row.iso}>
                              <strong>{formatISO(row.iso)}</strong>: {row.slots.join(', ') || '—'}
                            </div>
                          ))}
                        </dd>
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
                      {customFields.map((field) => {
                        const value = customValue(form.custom, field.id).trim()
                        return value ? (
                          <div key={field.id}>
                            <dt>{field.label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ) : null
                      })}
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
                <button key="next" className="btn btn-solid" type="button" onClick={goNext} disabled={!canNext}>
                  Avanti
                </button>
              ) : (
                <button key="submit" className="btn btn-solid" type="submit">
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