import { useEffect, useState } from 'react'
import { QrImage } from './Ticket.jsx'
import { cancelRegistration, eventImageUrl, eventWhen, fetchRegistration } from '../store/eventStore.js'

export default function EventTicket({ token }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' })
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const result = await fetchRegistration(token)
    setState({ loading: false, data: result.ok ? result.registration : null, error: result.ok ? '' : result.error })
  }

  useEffect(() => {
    void load()
  }, [token])

  async function onCancel() {
    setBusy(true)
    setError('')
    const result = await cancelRegistration(token)
    setBusy(false)
    setConfirming(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await load()
  }

  const data = state.data
  const event = data?.event
  const active = data?.status === 'active'
  const past = !!event?.past
  const name = [data?.first_name, data?.last_name].filter(Boolean).join(' ')

  return (
    <main className="pass">
      <div className="pass-card">
        <a className="pass-brand" href="/">
          <img src="/assets/logo-come-blue.png" alt="Spazio COME" height={36} />
        </a>

        {state.loading ? <p className="admin-hint">Caricamento…</p> : null}

        {!state.loading && !data ? (
          <>
            <h1>Iscrizione non trovata</h1>
            <p className="pass-lead">{state.error || 'Il link potrebbe essere errato.'}</p>
          </>
        ) : null}

        {data ? (
          <>
            <p className="gest-kicker">Pass evento</p>
            <h1>{event.title}</h1>
            {name ? <p className="pass-lead">{name}</p> : null}
            <span className={`pass-state ${active ? (past ? 'is-past' : 'is-on') : 'is-off'}`}>
              {active ? (past ? 'Concluso' : data.checked_in_at ? 'Presente' : 'Iscrizione confermata') : 'Annullata'}
            </span>

            {active && !past ? (
              <>
                <QrImage value={`${window.location.origin}/iscrizione/${data.token}`} />
                <p className="admin-hint">Mostra questo QR all’ingresso.</p>
              </>
            ) : null}

            <dl className="pass-info">
              <div>
                <dt>Quando</dt>
                <dd>{eventWhen(event)}</dd>
              </div>
              <div>
                <dt>Dove</dt>
                <dd>Spazio COME</dd>
              </div>
            </dl>

            {event.image_path ? (
              <a className="pass-event" href={`/eventi/${event.slug}`}>
                <img src={eventImageUrl(event.image_path)} alt="" />
                <span>Dettagli evento</span>
              </a>
            ) : null}

            {error ? <p className="book-error">{error}</p> : null}

            {data.cancellable ? (
              confirming ? (
                <div className="pass-confirm">
                  <p>Annullare l’iscrizione? Il posto tornerà disponibile.</p>
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
                  Annulla iscrizione
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
