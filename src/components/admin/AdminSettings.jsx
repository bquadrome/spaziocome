import { useEffect, useRef, useState } from 'react'
import { fetchReceptionKey, receptionUrl, rotateReceptionKey } from '../../store/bookingStore.js'
import { fetchEventEmails, saveEventEmails } from '../../store/eventStore.js'
import MailTags from './MailTags.jsx'

const EMPTY_EVENT_EMAILS = {
  registered: { subject: '', body: '' },
  cancelled: { subject: '', body: '' },
}

export default function AdminSettings() {
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const [mails, setMails] = useState(EMPTY_EVENT_EMAILS)
  const [mailBusy, setMailBusy] = useState(false)
  const [mailNotice, setMailNotice] = useState('')
  const [mailError, setMailError] = useState('')

  useEffect(() => {
    fetchReceptionKey().then((key) => {
      setLink(receptionUrl(key))
      setLoading(false)
    })
    fetchEventEmails().then(setMails)
  }, [])

  const mailFocus = useRef(null)

  function setMail(kind, patch) {
    setMails((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }))
    setMailNotice('')
    setMailError('')
  }

  // Inserisce {{tag}} nel campo mail attivo (o, se nessuno, in coda al corpo indicato).
  function insertMailTag(tag, fbKind, fbField = 'body') {
    const token = `{{${tag}}}`
    const f = mailFocus.current ?? { kind: fbKind, field: fbField, el: null }
    const value = mails[f.kind]?.[f.field] ?? ''
    const el = f.el
    const start = el ? el.selectionStart : value.length
    const end = el ? el.selectionEnd : value.length
    const next = value.slice(0, start) + token + value.slice(end)
    setMail(f.kind, { [f.field]: next })
    if (el) {
      requestAnimationFrame(() => {
        el.focus()
        const pos = start + token.length
        el.setSelectionRange(pos, pos)
      })
    }
  }

  const trackFocus = (kind, field) => (e) => {
    mailFocus.current = { kind, field, el: e.target }
  }

  async function saveMails() {
    setMailBusy(true)
    setMailNotice('')
    setMailError('')
    const result = await saveEventEmails(mails)
    setMailBusy(false)
    if (!result.ok) {
      setMailError(result.error)
      return
    }
    setMailNotice('Template salvati.')
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  async function rotate() {
    setBusy(true)
    setError('')
    setNotice('')
    const result = await rotateReceptionKey()
    setBusy(false)
    setConfirming(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setLink(receptionUrl(result.key))
    setNotice('Nuova chiave generata. Il link precedente non funziona più: invia quello nuovo alla reception.')
  }

  return (
    <div className="admin-event">
      <header className="ev-head">
        <div>
          <p className="gest-kicker">Pannello admin</p>
          <h1>Impostazioni</h1>
        </div>
      </header>

      <section className="admin-block">
        <h2>Pagina reception</h2>
        <p className="admin-hint">
          Chi ha questo link può aprire la pagina check-in senza login, vedere nomi e presenze del giorno e segnare
          gli arrivi. Condividilo solo con il personale della reception.
        </p>

        {loading ? <p className="admin-hint">Caricamento…</p> : null}

        {!loading ? (
          <label className="admin-field">
            <span>Link reception</span>
            <input value={link || 'Nessuna chiave attiva'} readOnly onFocus={(e) => e.target.select()} />
          </label>
        ) : null}

        {notice ? <p className="settings-notice">{notice}</p> : null}
        {error ? <p className="book-error">{error}</p> : null}

        {confirming ? (
          <div className="settings-confirm">
            <p>
              Generare una nuova chiave? Il link attuale smetterà subito di funzionare su tutti i dispositivi della
              reception.
            </p>
            <div className="edit-actions">
              <button type="button" className="btn-danger" onClick={rotate} disabled={busy}>
                {busy ? 'Generazione…' : 'Sì, cambia chiave'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <div className="edit-actions">
            {link ? (
              <>
                <a className="btn-ghost" href={link} target="_blank" rel="noopener noreferrer">
                  Apri
                </a>
                <button type="button" className="btn-ghost" onClick={copy}>
                  {copied ? 'Copiato' : 'Copia link'}
                </button>
              </>
            ) : null}
            <button type="button" className="btn-save" onClick={() => setConfirming(true)} disabled={loading}>
              {link ? 'Cambia chiave' : 'Genera chiave'}
            </button>
          </div>
        )}
      </section>

      <section className="admin-block">
        <h2>Mail iscrizione eventi</h2>
        <p className="admin-hint">
          Testo delle mail inviate a chi si iscrive o annulla l’iscrizione a un evento. Vale per tutti gli eventi.
          Lascia vuoto per usare il testo predefinito. Clicca un tag per inserirlo nel campo.
        </p>

        <h3 className="settings-subhead">Conferma iscrizione</h3>
        <label className="admin-field">
          <span>Oggetto</span>
          <input
            value={mails.registered.subject}
            placeholder="Iscrizione confermata — {{evento}}"
            onFocus={trackFocus('registered', 'subject')}
            onChange={(e) => setMail('registered', { subject: e.target.value })}
          />
        </label>
        <label className="admin-field">
          <span>Corpo</span>
          <textarea
            rows={6}
            value={mails.registered.body}
            placeholder={'Ciao {{nome}},\n\nla tua iscrizione a {{evento}} è confermata.\nQuando: {{quando}}\n\n{{link}}'}
            onFocus={trackFocus('registered', 'body')}
            onChange={(e) => setMail('registered', { body: e.target.value })}
          />
        </label>
        <MailTags
          tags={['nome', 'evento', 'quando', 'link', 'pagina']}
          onInsert={(tag) => insertMailTag(tag, 'registered')}
        />

        <h3 className="settings-subhead">Annullo iscrizione</h3>
        <label className="admin-field">
          <span>Oggetto</span>
          <input
            value={mails.cancelled.subject}
            placeholder="Iscrizione annullata — {{evento}}"
            onFocus={trackFocus('cancelled', 'subject')}
            onChange={(e) => setMail('cancelled', { subject: e.target.value })}
          />
        </label>
        <label className="admin-field">
          <span>Corpo</span>
          <textarea
            rows={6}
            value={mails.cancelled.body}
            placeholder={'Ciao {{nome}},\n\nla tua iscrizione a {{evento}} ({{quando}}) è stata annullata.\n\nPuoi iscriverti di nuovo: {{pagina}}'}
            onFocus={trackFocus('cancelled', 'body')}
            onChange={(e) => setMail('cancelled', { body: e.target.value })}
          />
        </label>
        <MailTags
          tags={['nome', 'evento', 'quando', 'pagina']}
          onInsert={(tag) => insertMailTag(tag, 'cancelled')}
        />

        {mailNotice ? <p className="settings-notice">{mailNotice}</p> : null}
        {mailError ? <p className="book-error">{mailError}</p> : null}
        <div className="edit-actions">
          <button type="button" className="btn-save" onClick={saveMails} disabled={mailBusy}>
            {mailBusy ? 'Salvataggio…' : 'Salva template'}
          </button>
        </div>
      </section>
    </div>
  )
}
