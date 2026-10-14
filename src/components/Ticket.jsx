import { useEffect, useState } from 'react'
import { cancelTicket, fetchTicket, formatISO, ticketUrl, todayISO } from '../store/bookingStore.js'

function slotText(slots) {
  if (!slots?.length) return 'Giornata'
  return slots.map((slot) => `${slot.start}–${slot.end}`).join(', ')
}

export function QrImage({ value }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let alive = true
    import('qrcode')
      .then((mod) => mod.toDataURL(value, { width: 560, margin: 1, errorCorrectionLevel: 'M' }))
      .then((url) => {
        if (alive) setSrc(url)
      })
      .catch((err) => console.error(err))
    return () => {
      alive = false
    }
  }, [value])

  return (
    <div className="pass-qr">
      {src ? <img src={src} alt="QR code del pass personale" width={280} height={280} /> : null}
    </div>
  )
}

export default function Ticket({ token }) {
  const [state, setState] = useState({ loading: true, ticket: null, error: '' })
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const result = await fetchTicket(token)
    setState({ loading: false, ticket: result.ok ? result.ticket : null, error: result.ok ? '' : result.error })
  }

  useEffect(() => {
    void load()
  }, [token])

  async function onCancel() {
    setBusy(true)
    setError('')
    const result = await cancelTicket(token)
    setBusy(false)
    setConfirming(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await load()
  }

  const ticket = state.ticket
  const today = todayISO()
  const dates = [...(ticket?.dates ?? [])].sort()
  const active = ticket?.status === 'active'
  const past = dates.length > 0 && dates.every((date) => date < today)
  const name = [ticket?.first_name, ticket?.last_name].filter(Boolean).join(' ')

  return (
    <main className="pass">
      <div className="pass-card">
        <a className="pass-brand" href="/">
          <img src="/assets/logo-come-blue.png" alt="Spazio COME" height={36} />
        </a>

        {state.loading ? <p className="admin-hint">Caricamento…</p> : null}

        {!state.loading && !ticket ? (
          <>
            <h1>Prenotazione non trovata</h1>
            <p className="pass-lead">{state.error || 'Il link potrebbe essere errato o scaduto.'}</p>
          </>
        ) : null}

        {ticket ? (
          <>
            <p className="gest-kicker">{ticket.has_qr ? 'Pass personale' : 'La tua prenotazione'}</p>
            <h1>{ticket.event_name}</h1>
            {name ? <p className="pass-lead">{name}</p> : null}

            <span className={`pass-state ${active ? (past ? 'is-past' : 'is-on') : 'is-off'}`}>
              {active ? (past ? 'Conclusa' : 'Confermata') : 'Annullata'}
            </span>

            {active && !past && ticket.has_qr ? (
              <>
                <QrImage value={ticketUrl(ticket.token)} />
                <p className="admin-hint">Mostra questo QR in reception all’arrivo.</p>
              </>
            ) : null}

            <dl className="pass-info">
              <div>
                <dt>{dates.length > 1 ? 'Giorni' : 'Giorno'}</dt>
                <dd>{dates.map(formatISO).join(', ')}</dd>
              </div>
              <div>
                <dt>Orario</dt>
                <dd>{slotText(ticket.slots)}</dd>
              </div>
              {ticket.station ? (
                <div>
                  <dt>Postazione</dt>
                  <dd>{ticket.station}</dd>
                </div>
              ) : null}
            </dl>

            {error ? <p className="book-error">{error}</p> : null}

            {ticket.cancellable ? (
              confirming ? (
                <div className="pass-confirm">
                  <p>Annullare la prenotazione? Lo slot tornerà disponibile.</p>
                  <div className="edit-actions">
                    <button type="button" className="btn-danger" onClick={onCancel} disabled={busy}>
                      {busy ? 'Annullamento…' : 'Sì, annulla'}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>
                      No
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn-ghost pass-cancel" onClick={() => setConfirming(true)}>
                  Annulla prenotazione
                </button>
              )
            ) : null}

            <p className="admin-hint">
              Serve aiuto? <a href="mailto:info@spaziocome.it">info@spaziocome.it</a>
            </p>
          </>
        ) : null}
      </div>
    </main>
  )
}
