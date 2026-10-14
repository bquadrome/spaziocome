import { useEffect, useMemo, useState } from 'react'
import { REQUEST_STATUS, formatISO, sendQuote, setRequestStatus, useBookingStore } from '../../store/bookingStore.js'

export const OPEN_STATUSES = ['new', 'revision', 'accepted']

const FILTERS = [
  { id: 'open', label: 'Da gestire', match: (status) => OPEN_STATUSES.includes(status) },
  { id: 'quoted', label: 'In attesa cliente', match: (status) => status === 'quoted' },
  { id: 'paid', label: 'Pagate', match: (status) => status === 'paid' },
  { id: 'archived', label: 'Archiviate', match: (status) => status === 'archived' },
  { id: 'all', label: 'Tutte', match: () => true },
]

const HISTORY_LABEL = {
  request: 'Richiesta ricevuta',
  quoted: 'Preventivo inviato',
  accepted: 'Preventivo accettato dal cliente',
  revision: 'Il cliente ha chiesto un nuovo preventivo',
  paid: 'Pagamento confermato',
  archived: 'Archiviata',
  new: 'Riaperta',
}

const DEFAULT_SUBJECT = 'Preventivo {{spazio}} — Spazio COME'
const DEFAULT_BODY = `Ciao {{nome}},

grazie per la tua richiesta per {{spazio}} ({{date}}, {{slot}}).

Ecco il nostro preventivo:
…

Per confermare clicca su «Accetta il preventivo» qui sotto. Se vuoi modificare qualcosa, clicca su «Richiedi nuovo preventivo».`

function fullName(item) {
  return [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Senza nome'
}

function slotText(event, slotIds) {
  const slots = (event?.slots ?? [])
    .filter((slot) => (slotIds ?? []).includes(slot.id))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
  if (!slots.length) return 'Giornata'
  return slots.map((slot) => `${slot.start}–${slot.end}`).join(', ')
}

function when(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function euro(value) {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : ''
}

function StatusBadge({ status }) {
  const info = REQUEST_STATUS[status] ?? REQUEST_STATUS.new
  return <span className={`req-badge is-${info.tone}`}>{info.label}</span>
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function textHtml(text) {
  return escapeHtml(text)
    .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`)
    .replace(/\n/g, '<br>')
}

function mailDate(dates) {
  return (dates ?? [])
    .map((iso) => {
      const [y, m, d] = String(iso).split('-')
      return `${d}/${m}/${y}`
    })
    .join(', ')
}

function fillVars(text, vars) {
  return String(text ?? '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

function amountValue(amount) {
  const value = String(amount ?? '').trim().replace(',', '.')
  if (!value) return ''
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? euro(n) : ''
}

// Stesso HTML della mail inviata da send-quote-email.
function quoteEmailHtml({ body, importo, spazio, date, slot }) {
  const button = (label, solid) =>
    `<a href="#" onclick="return false" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 20px;border-radius:10px;font-weight:700;text-decoration:none;${
      solid ? 'background:#0047f8;color:#fff;border:2px solid #0047f8' : 'background:#fff;color:#0047f8;border:2px solid #0047f8'
    }">${escapeHtml(label)}</a>`
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#fff}</style></head><body>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">${textHtml(body.trim())}${
    importo ? `<p style="margin:18px 0 0;font-size:17px"><strong>Importo: ${escapeHtml(importo)}</strong></p>` : ''
  }<p style="margin:14px 0 4px;color:#555">Richiesta: ${escapeHtml(spazio)} · ${escapeHtml(date)} · ${escapeHtml(slot)}</p><p style="margin:22px 0 8px">${button(
    'Accetta il preventivo',
    true,
  )}${button('Richiedi nuovo preventivo', false)}</p><p style="margin:18px 0 0">Spazio COME</p></div></body></html>`
}

function MailPreview({ request, event, subject, body, amount }) {
  const importo = amountValue(amount)
  const vars = {
    nome: fullName(request),
    spazio: event?.name ?? request.eventId,
    date: mailDate(request.dates),
    slot: slotText(event, request.slotIds),
    importo,
  }
  const finalSubject = fillVars(subject, vars).trim() || `Preventivo ${vars.spazio} — Spazio COME`
  const html = quoteEmailHtml({ ...vars, body: fillVars(body, vars) })
  return (
    <div className="mail-preview">
      <p className="gest-kicker">Anteprima mail</p>
      <dl className="mail-preview-head">
        <div>
          <dt>Da</dt>
          <dd>Spazio COME</dd>
        </div>
        <div>
          <dt>A</dt>
          <dd>{request.email}</dd>
        </div>
        <div>
          <dt>Oggetto</dt>
          <dd>{finalSubject}</dd>
        </div>
      </dl>
      <iframe className="mail-preview-frame" title="Anteprima mail preventivo" srcDoc={html} sandbox="" />
      <p className="admin-hint">
        I pulsanti nella mail aprono la pagina del preventivo, dove il cliente conferma o chiede modifiche.
      </p>
    </div>
  )
}

function Composer({ request, event, onDone }) {
  const [subject, setSubject] = useState(request.quoteSubject || DEFAULT_SUBJECT)
  const [body, setBody] = useState(request.quoteBody || DEFAULT_BODY)
  const [amount, setAmount] = useState(request.quoteAmount ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirming, setConfirming] = useState(false)

  async function send() {
    setBusy(true)
    setError('')
    setNotice('')
    const result = await sendQuote(request.id, { subject, body, amount })
    setBusy(false)
    setConfirming(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setNotice(result.warning ?? `Preventivo inviato a ${request.email}.`)
    onDone?.()
  }

  const again = request.status === 'quoted' || request.status === 'revision'

  return (
    <section className="req-section">
      <h3>{again ? 'Invia un nuovo preventivo' : 'Prepara il preventivo'}</h3>
      <p className="admin-hint">
        Segnaposto: {'{{nome}}'} {'{{spazio}}'} {'{{date}}'} {'{{slot}}'} {'{{importo}}'}. Nella mail compariranno i
        pulsanti «Accetta il preventivo» e «Richiedi nuovo preventivo».
      </p>
      <label className="admin-field">
        <span>Oggetto</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="admin-field">
        <span>Testo</span>
        <textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <label className="admin-field req-amount">
        <span>Importo (€, facoltativo)</span>
        <input inputMode="decimal" value={amount ?? ''} placeholder="es. 250" onChange={(e) => setAmount(e.target.value)} />
      </label>
      <MailPreview request={request} event={event} subject={subject} body={body} amount={amount} />
      {error ? <p className="book-error">{error}</p> : null}
      {notice ? <p className="settings-notice">{notice}</p> : null}
      {confirming ? (
        <div className="settings-confirm">
          <p>
            Inviare il preventivo a <strong>{request.email}</strong>?
          </p>
          <div className="edit-actions">
            <button type="button" className="btn-save" onClick={send} disabled={busy}>
              {busy ? 'Invio…' : 'Sì, invia'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <div className="edit-actions">
          <button type="button" className="btn-save" onClick={() => setConfirming(true)} disabled={!body.trim()}>
            {again ? 'Invia nuovo preventivo' : 'Invia preventivo'}
          </button>
        </div>
      )}
    </section>
  )
}

function Detail({ request, event, onStatus }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function change(status) {
    setBusy(status)
    setError('')
    const result = await onStatus(request.id, status)
    setBusy('')
    if (!result.ok) setError(result.error)
  }

  const canQuote = ['new', 'quoted', 'revision'].includes(request.status)

  return (
    <article className="req-detail">
      <header className="req-detail-head">
        <div>
          <p className="gest-kicker">{event?.name ?? request.eventId}</p>
          <h2>{fullName(request)}</h2>
        </div>
        <StatusBadge status={request.status} />
      </header>

      <dl className="req-info">
        <div>
          <dt>Date</dt>
          <dd>{request.dates.map(formatISO).join(', ')}</dd>
        </div>
        <div>
          <dt>Orari</dt>
          <dd>{slotText(event, request.slotIds)}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>
            <a href={`mailto:${request.email}`}>{request.email}</a>
          </dd>
        </div>
        {request.phone ? (
          <div>
            <dt>Telefono</dt>
            <dd>
              <a href={`tel:${request.phone}`}>{request.phone}</a>
            </dd>
          </div>
        ) : null}
        {request.custom.map((item) => (
          <div key={item.id}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
        {request.notes ? (
          <div className="is-wide">
            <dt>Note</dt>
            <dd>{request.notes}</dd>
          </div>
        ) : null}
        {request.quoteAmount !== null && request.quoteAmount !== undefined && request.status !== 'new' ? (
          <div>
            <dt>Importo preventivo</dt>
            <dd>{euro(request.quoteAmount)}</dd>
          </div>
        ) : null}
      </dl>

      {request.revisionMessage ? (
        <section className={`req-section req-revision${request.status === 'revision' ? ' is-open' : ''}`}>
          <h3>Richiesta di nuovo preventivo</h3>
          <p className="admin-hint">
            {request.revisionName} · <a href={`mailto:${request.revisionEmail}`}>{request.revisionEmail}</a> ·{' '}
            {when(request.revisionAt)}
          </p>
          <p className="req-message">{request.revisionMessage}</p>
        </section>
      ) : null}

      {request.status === 'accepted' ? (
        <section className="req-section req-next">
          <h3>Preventivo accettato</h3>
          <p className="admin-hint">
            Invia al cliente gli estremi di pagamento via mail. Quando arriva il pagamento, segnalalo qui.
          </p>
          <div className="edit-actions">
            <button type="button" className="btn-save" onClick={() => change('paid')} disabled={!!busy}>
              {busy === 'paid' ? 'Salvataggio…' : 'Segna pagamento confermato'}
            </button>
          </div>
        </section>
      ) : null}

      {request.status === 'paid' ? (
        <section className="req-section req-next">
          <h3>Pagamento confermato</h3>
          <p className="admin-hint">
            Pagato il {when(request.paidAt)}. Ricordati di bloccare le date in{' '}
            <a href={`/admin/calendario?tipo=${request.eventId}`}>Calendario</a>.
          </p>
        </section>
      ) : null}

      {canQuote ? <Composer key={request.id} request={request} event={event} /> : null}

      {error ? <p className="book-error">{error}</p> : null}

      <section className="req-section">
        <h3>Storico</h3>
        <ol className="req-history">
          {[...request.history].reverse().map((item, i) => (
            <li key={`${item.at}-${i}`}>
              <span>{when(item.at)}</span>
              {HISTORY_LABEL[item.type] ?? item.type}
              {item.amount !== undefined && item.amount !== null ? ` · ${euro(item.amount)}` : ''}
            </li>
          ))}
        </ol>
      </section>

      <div className="edit-actions">
        {request.status === 'archived' ? (
          <button type="button" className="btn-ghost" onClick={() => change('new')} disabled={!!busy}>
            Riapri richiesta
          </button>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => change('archived')} disabled={!!busy}>
            Archivia
          </button>
        )}
      </div>
    </article>
  )
}

export default function AdminRequests() {
  const { requests = [], events = {} } = useBookingStore()
  const [filter, setFilter] = useState('open')
  const [openId, setOpenId] = useState(() => new URLSearchParams(window.location.search).get('id') ?? '')

  const shown = useMemo(() => {
    const rule = FILTERS.find((item) => item.id === filter) ?? FILTERS[0]
    return requests.filter((item) => rule.match(item.status))
  }, [requests, filter])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (openId) url.searchParams.set('id', openId)
    else url.searchParams.delete('id')
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }, [openId])

  const current = requests.find((item) => item.id === openId)

  return (
    <div className="req">
      <header className="ev-head">
        <div>
          <p className="gest-kicker">Preventivi</p>
          <h1>Richieste</h1>
        </div>
      </header>

      <div className="req-filters" role="tablist" aria-label="Filtra richieste">
        {FILTERS.map((item) => {
          const count = requests.filter((req) => item.match(req.status)).length
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={`ev-chip${filter === item.id ? ' is-on' : ''}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label} <b>{count}</b>
            </button>
          )
        })}
      </div>

      <div className={`req-layout${current ? ' has-detail' : ''}`}>
        <ul className="req-list">
          {shown.length === 0 ? <li className="admin-hint">Nessuna richiesta.</li> : null}
          {shown.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`req-row${item.id === openId ? ' is-on' : ''}`}
                onClick={() => setOpenId(item.id === openId ? '' : item.id)}
              >
                <span className="req-row-main">
                  <strong>{fullName(item)}</strong>
                  <span>
                    {events[item.eventId]?.name ?? item.eventId} · {item.dates.map(formatISO).join(', ')}
                  </span>
                </span>
                <span className="req-row-side">
                  <StatusBadge status={item.status} />
                  <small>{when(item.createdAt)}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {current ? (
          <Detail request={current} event={events[current.eventId]} onStatus={setRequestStatus} />
        ) : null}
      </div>
    </div>
  )
}
