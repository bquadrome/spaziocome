import { useEffect, useState } from 'react'
import { acceptQuote, fetchQuote, formatISO, requestNewQuote } from '../store/bookingStore.js'

function slotText(slots) {
  if (!slots?.length) return 'Giornata'
  return slots.map((slot) => `${slot.start}–${slot.end}`).join(', ')
}

function euro(value) {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : ''
}

function fill(text, quote) {
  const vars = {
    nome: [quote.first_name, quote.last_name].filter(Boolean).join(' '),
    spazio: quote.event_name ?? '',
    date: (quote.dates ?? []).map(formatISO).join(', '),
    slot: slotText(quote.slots),
    importo: euro(quote.quote_amount),
  }
  return String(text ?? '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

function initialChoice() {
  const value = new URLSearchParams(window.location.search).get('scelta')
  return value === 'accetta' || value === 'modifica' ? value : ''
}

export default function Quote({ token }) {
  const [state, setState] = useState({ loading: true, quote: null, error: '' })
  const [choice, setChoice] = useState(initialChoice)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [form, setForm] = useState({ name: '', email: '', message: '' })

  async function load() {
    const result = await fetchQuote(token)
    setState({ loading: false, quote: result.ok ? result.quote : null, error: result.ok ? '' : result.error })
  }

  useEffect(() => {
    void load()
  }, [token])

  async function onAccept() {
    setBusy(true)
    setError('')
    const result = await acceptQuote(token)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDone('accepted')
    await load()
  }

  async function onRevision(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const result = await requestNewQuote(token, form)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDone('revision')
    await load()
  }

  const quote = state.quote
  const status = quote?.status
  const amount = euro(quote?.quote_amount)

  return (
    <main className="pass">
      <div className="pass-card quote-card">
        <a className="pass-brand" href="/">
          <img src="/assets/logo-come-blue.png" alt="Spazio COME" height={36} />
        </a>

        {state.loading ? <p className="admin-hint">Caricamento…</p> : null}

        {!state.loading && !quote ? (
          <>
            <h1>Preventivo non trovato</h1>
            <p className="pass-lead">{state.error || 'Il link potrebbe essere errato.'}</p>
          </>
        ) : null}

        {quote ? (
          <>
            <p className="gest-kicker">Preventivo</p>
            <h1>{quote.event_name}</h1>
            <p className="pass-lead">{[quote.first_name, quote.last_name].filter(Boolean).join(' ')}</p>

            <dl className="pass-info">
              <div>
                <dt>{quote.dates?.length > 1 ? 'Giorni' : 'Giorno'}</dt>
                <dd>{(quote.dates ?? []).map(formatISO).join(', ')}</dd>
              </div>
              <div>
                <dt>Orario</dt>
                <dd>{slotText(quote.slots)}</dd>
              </div>
              {amount && status !== 'new' ? (
                <div>
                  <dt>Importo</dt>
                  <dd>{amount}</dd>
                </div>
              ) : null}
            </dl>

            {status === 'new' ? (
              <p className="quote-msg">Stiamo preparando il tuo preventivo: lo riceverai via mail.</p>
            ) : null}

            {status === 'quoted' && quote.quote_body ? (
              <div className="quote-body">
                {quote.quote_subject ? <strong>{fill(quote.quote_subject, quote)}</strong> : null}
                <p>{fill(quote.quote_body, quote)}</p>
              </div>
            ) : null}

            {error ? <p className="book-error">{error}</p> : null}

            {status === 'quoted' && choice !== 'modifica' ? (
              <div className="quote-actions">
                {choice === 'accetta' ? (
                  <p className="quote-msg">Confermi di accettare il preventivo{amount ? ` di ${amount}` : ''}?</p>
                ) : null}
                <div className="edit-actions">
                  <button type="button" className="btn-save" onClick={onAccept} disabled={busy}>
                    {busy ? 'Invio…' : 'Accetta il preventivo'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setChoice('modifica')} disabled={busy}>
                    Richiedi nuovo preventivo
                  </button>
                </div>
              </div>
            ) : null}

            {status === 'quoted' && choice === 'modifica' ? (
              <form className="quote-form" onSubmit={onRevision} noValidate>
                <p className="quote-msg">Raccontaci cosa vorresti cambiare: ti invieremo un nuovo preventivo.</p>
                <label className="admin-field">
                  <span>Nome e cognome</span>
                  <input
                    value={form.name}
                    autoComplete="name"
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </label>
                <label className="admin-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    autoComplete="email"
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </label>
                <label className="admin-field">
                  <span>Messaggio</span>
                  <textarea
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                  />
                </label>
                <div className="edit-actions">
                  <button type="submit" className="btn-save" disabled={busy}>
                    {busy ? 'Invio…' : 'Invia richiesta'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setChoice('')} disabled={busy}>
                    Indietro
                  </button>
                </div>
              </form>
            ) : null}

            {status === 'accepted' || status === 'paid' ? (
              <p className="quote-msg is-ok">
                {done === 'accepted' ? 'Grazie! ' : ''}Preventivo accettato. Ti invieremo via mail gli estremi per il
                pagamento: la data sarà confermata dopo il pagamento.
              </p>
            ) : null}

            {status === 'revision' ? (
              <p className="quote-msg is-ok">
                {done === 'revision' ? 'Messaggio inviato. ' : ''}Abbiamo ricevuto la tua richiesta di un nuovo
                preventivo: ti risponderemo a breve.
              </p>
            ) : null}

            {status === 'archived' ? <p className="quote-msg">Questa richiesta è stata chiusa.</p> : null}

            <p className="admin-hint">
              Serve aiuto? <a href="mailto:info@spaziocome.it">info@spaziocome.it</a>
            </p>
          </>
        ) : null}
      </div>
    </main>
  )
}
