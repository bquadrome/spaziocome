import { useMemo, useState } from 'react'
import GuestModal from './GuestModal.jsx'
import { EVENT_COLORS, formatISO, useBookingStore } from '../../store/bookingStore.js'

function guestName(item) {
  return [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Ospite'
}

function guestWhen(item) {
  const days = (item.dates ?? []).map(formatISO).join(' · ')
  const time =
    item.timeStart || item.timeEnd ? `${item.timeStart || '—'}–${item.timeEnd || '—'}` : 'Giornata intera'
  return `${days || '—'} · ${time}`
}

export default function AdminGuests() {
  const { guests = [] } = useBookingStore()
  const [modal, setModal] = useState(null)

  const list = useMemo(() => {
    return [...guests].sort((a, b) => {
      const da = a.dates?.[0] ?? ''
      const db = b.dates?.[0] ?? ''
      if (da !== db) return db.localeCompare(da)
      return (b.timeStart ?? '').localeCompare(a.timeStart ?? '')
    })
  }, [guests])

  return (
    <div className="admin-event guest-page">
      <section className="admin-block">
        <div className="guest-head">
          <div>
            <h2>Ospiti</h2>
            <p className="admin-hint">Solo da admin. Poi si collega a Supabase.</p>
          </div>
          <button className="btn-save" type="button" onClick={() => setModal({ type: 'new' })}>
            Aggiungi ospite
          </button>
        </div>

        {list.length === 0 ? <p className="admin-empty">Nessun ospite.</p> : null}

        <div className="guest-list">
          {list.map((item) => (
            <article className={`admin-card${item.status !== 'active' ? ' is-off' : ''}`} key={item.id}>
              <header>
                <b style={{ color: EVENT_COLORS.ospite }}>{guestName(item)}</b>
                <span>{item.status === 'active' ? 'Attivo' : 'Annullato'}</span>
              </header>
              <p>{guestWhen(item)}</p>
              {item.email || item.phone ? (
                <p>
                  {item.email}
                  {item.email && item.phone ? ' · ' : ''}
                  {item.phone}
                </p>
              ) : null}
              {item.notes ? <p className="admin-notes">{item.notes}</p> : null}
              <button type="button" className="btn" onClick={() => setModal({ type: 'edit', guest: item })}>
                Modifica
              </button>
            </article>
          ))}
        </div>
      </section>

      {modal?.type === 'new' ? <GuestModal onClose={() => setModal(null)} /> : null}
      {modal?.type === 'edit' ? (
        <GuestModal guest={modal.guest} onClose={() => setModal(null)} />
      ) : null}
    </div>
  )
}
