import { useEffect, useState } from 'react'
import { fetchReceptionKey, receptionUrl, rotateReceptionKey } from '../../store/bookingStore.js'

export default function AdminSettings() {
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchReceptionKey().then((key) => {
      setLink(receptionUrl(key))
      setLoading(false)
    })
  }, [])

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
    </div>
  )
}
