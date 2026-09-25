import { useEffect, useState } from 'react'
import Time24 from './Time24.jsx'
import {
  addGuest,
  datesBetween,
  patchGuest,
  removeGuestOccurrence,
  setGuestStatus,
  splitName,
  todayISO,
  formatISO,
} from '../../store/bookingStore.js'

export function emptyGuestForm(date = todayISO()) {
  return {
    title: '',
    email: '',
    phone: '',
    dateStart: date,
    dateEnd: date,
    timeStart: '',
    timeEnd: '',
    notes: '',
  }
}

export function guestToForm(guest) {
  const dates = [...(guest.dates ?? [])].sort()
  return {
    title: [guest.firstName, guest.lastName].filter(Boolean).join(' '),
    email: guest.email ?? '',
    phone: guest.phone ?? '',
    dateStart: dates[0] ?? todayISO(),
    dateEnd: dates[dates.length - 1] ?? dates[0] ?? todayISO(),
    timeStart: guest.timeStart ?? '',
    timeEnd: guest.timeEnd ?? '',
    notes: guest.notes ?? '',
  }
}

function payloadFromForm(form) {
  const { firstName, lastName } = splitName(form.title)
  const dates = datesBetween(form.dateStart, form.dateEnd)
  return {
    firstName,
    lastName,
    email: form.email.trim(),
    phone: form.phone.trim(),
    notes: form.notes.trim(),
    dates,
    timeStart: form.timeStart,
    timeEnd: form.timeEnd,
  }
}

export default function GuestModal({ guest = null, date, onClose }) {
  const isNew = !guest
  const [form, setForm] = useState(() => (guest ? guestToForm(guest) : emptyGuestForm(date)))
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  async function save(e) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Inserisci il nome.')
      return
    }
    const dates = datesBetween(form.dateStart, form.dateEnd)
    if (!dates.length) {
      setError('Inserisci una data.')
      return
    }
    const payload = payloadFromForm(form)
    const result = isNew ? await addGuest(payload) : await patchGuest(guest.id, payload)
    if (result && result.ok === false) {
      setError(result.error)
      return
    }
    onClose?.()
  }

  return (
    <div className="edit-overlay" role="presentation">
      <button className="edit-backdrop" type="button" aria-label="Chiudi" onClick={onClose} />
      <form className="edit-modal" onSubmit={save}>
        <header>
          <h2>{isNew ? 'Nuovo ospite' : 'Modifica ospite'}</h2>
          <button type="button" className="edit-x" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </header>

        <label className="admin-field">
          <span>Nome / titolo</span>
          <input
            value={form.title}
            autoFocus
            placeholder="Es. Alice Scimone"
            onChange={(e) => setField('title', e.target.value)}
          />
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
            <input type="date" value={form.dateStart} onChange={(e) => setField('dateStart', e.target.value)} />
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
          Se lasci entrambi gli orari vuoti l’ospite viene registrato per l’intera giornata.
        </p>

        <label className="admin-field">
          <span>Note / motivo</span>
          <textarea rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
        </label>

        {error ? <p className="book-error">{error}</p> : null}

        <div className="edit-actions">
          <button className="btn-save" type="submit">
            Salva
          </button>
          <button className="btn-ghost" type="button" onClick={onClose}>
            Chiudi
          </button>
          {!isNew ? (
            <>
              <button
                className="btn-danger"
                type="button"
                onClick={async () => {
                  const result = await setGuestStatus(guest.id, guest.status === 'active' ? 'cancelled' : 'active')
                  if (result && result.ok === false) {
                    setError(result.error)
                    return
                  }
                  onClose?.()
                }}
              >
                {guest.status === 'active' ? 'Annulla attività' : 'Riattiva attività'}
              </button>
              <button
                className="btn-danger is-fill"
                type="button"
                onClick={async () => {
                  const manyDays = (guest.dates ?? []).length > 1
                  const label = date ? formatISO(date) : ''
                  const ok = window.confirm(
                    manyDays && date
                      ? `Eliminare solo l’ospite del ${label}? Le altre date restano.`
                      : 'Eliminare definitivamente questo ospite? L’azione non si può annullare.',
                  )
                  if (!ok) return
                  const result = await removeGuestOccurrence(guest.id, date)
                  if (result && result.ok === false) {
                    setError(result.error)
                    return
                  }
                  onClose?.()
                }}
              >
                Elimina
              </button>
            </>
          ) : null}
        </div>
      </form>
    </div>
  )
}
