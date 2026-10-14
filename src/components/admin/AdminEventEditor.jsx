import { useEffect, useMemo, useRef, useState } from 'react'
import Time24 from './Time24.jsx'
import ImageCropper from './ImageCropper.jsx'
import { eventState, navigateAdmin } from './AdminEvents.jsx'
import { todayISO, useBookingStore } from '../../store/bookingStore.js'
import {
  deleteSiteEvent,
  eventImageUrl,
  eventWhen,
  removeEventImage,
  saveSiteEvent,
  setRegistrationPresence,
  setRegistrationStatus,
  uploadEventImage,
  useSiteEvents,
} from '../../store/eventStore.js'

function Switch({ checked, onChange, children }) {
  return (
    <button type="button" className={`ev-switch${checked ? ' is-on' : ''}`} aria-pressed={checked} onClick={() => onChange(!checked)}>
      <i />
      {children}
    </button>
  )
}

function emptyDraft() {
  const date = new URLSearchParams(window.location.search).get('data')
  return {
    id: '',
    title: '',
    summary: '',
    description: '',
    onDate: /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date : todayISO(),
    timeStart: '18:00',
    timeEnd: '20:00',
    imagePath: '',
    published: true,
    registrationOpen: true,
    capacity: '',
  }
}

function draftFrom(event) {
  return {
    id: event.id,
    title: event.title,
    summary: event.summary,
    description: event.description,
    onDate: event.onDate,
    timeStart: event.timeStart,
    timeEnd: event.timeEnd,
    imagePath: event.imagePath,
    published: event.published,
    registrationOpen: event.registrationOpen,
    capacity: event.capacity === null || event.capacity === undefined ? '' : String(event.capacity),
  }
}

function time(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function exportCsv(event, rows) {
  const header = ['Nome', 'Cognome', 'Email', 'Telefono', 'Stato', 'Iscritto il', 'Presente alle']
  const lines = [
    header,
    ...rows.map((item) => [
      item.firstName,
      item.lastName,
      item.email,
      item.phone,
      item.status === 'active' ? 'Iscritto' : 'Annullato',
      item.createdAt ? new Date(item.createdAt).toLocaleString('it-IT') : '',
      item.checkedInAt ? new Date(item.checkedInAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '',
    ]),
  ]
  const csv = lines.map((cells) => cells.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `iscritti-${event.slug || 'evento'}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function Registrations({ event, rows }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState('')
  const active = rows.filter((item) => item.status === 'active')
  const present = active.filter((item) => item.checkedInAt).length

  async function run(id, task) {
    setBusy(id)
    setError('')
    const result = await task()
    setBusy('')
    setConfirmId('')
    if (!result.ok) setError(result.error)
  }

  return (
    <section className="admin-block">
      <div className="adm-reg-head">
        <h2>Iscritti</h2>
        <span className="admin-hint">
          {active.length}
          {event.capacity ? `/${event.capacity}` : ''} iscritti · {present} presenti
        </span>
        {rows.length ? (
          <button type="button" className="cal-export" onClick={() => exportCsv(event, rows)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4.5v9" />
              <path d="m8 10 4 4 4-4" />
              <path d="M5.5 18.5h13" />
            </svg>
            Esporta CSV
          </button>
        ) : null}
      </div>
      {error ? <p className="book-error">{error}</p> : null}
      {!rows.length ? <p className="admin-hint">Ancora nessun iscritto.</p> : null}
      <ul className="adm-reg-list">
        {rows.map((item) => (
          <li key={item.id} className={item.status !== 'active' ? 'is-off' : item.checkedInAt ? 'is-present' : ''}>
            <div className="adm-reg-who">
              <strong>
                {item.firstName} {item.lastName}
              </strong>
              <span>
                <a href={`mailto:${item.email}`}>{item.email}</a>
                {item.phone ? ` · ${item.phone}` : ''} · iscritto {time(item.createdAt)}
              </span>
            </div>
            <div className="adm-reg-act">
              {item.status !== 'active' ? (
                <span className="adm-ev-state is-past">Annullato</span>
              ) : confirmId === item.id ? (
                <>
                  <button type="button" className="btn-danger" disabled={busy === item.id} onClick={() => run(item.id, () => setRegistrationStatus(item.id, 'cancelled'))}>
                    Sì, annulla
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setConfirmId('')}>
                    No
                  </button>
                </>
              ) : (
                <>
                  {item.checkedInAt ? (
                    <>
                      <span className="rec-time">Presente · {time(item.checkedInAt).split(', ').pop()}</span>
                      <button type="button" className="btn-ghost" disabled={busy === item.id} onClick={() => run(item.id, () => setRegistrationPresence(item, event.onDate, false))}>
                        Togli presenza
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn-ghost" disabled={busy === item.id} onClick={() => run(item.id, () => setRegistrationPresence(item, event.onDate, true))}>
                      Presente
                    </button>
                  )}
                  <button type="button" className="btn-ghost" onClick={() => setConfirmId(item.id)}>
                    Annulla iscrizione
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function AdminEventEditor({ eventId }) {
  const isNew = eventId === 'nuovo'
  const { events = [], registrations = [], loaded } = useSiteEvents()
  const { events: spaces = {} } = useBookingStore()
  const current = events.find((item) => item.id === eventId)
  const [draft, setDraft] = useState(() => (isNew ? emptyDraft() : null))
  const [file, setFile] = useState(null)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const input = useRef(null)

  useEffect(() => {
    if (!isNew && current && !draft) setDraft(draftFrom(current))
  }, [isNew, current, draft])

  useEffect(() => () => pending?.url && URL.revokeObjectURL(pending.url), [pending])

  const rows = useMemo(
    () => registrations.filter((item) => item.eventId === eventId).sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [registrations, eventId],
  )

  const blocked = useMemo(() => {
    if (!draft) return []
    return (spaces.meeting?.slots ?? [])
      .filter((slot) => draft.timeStart && draft.timeEnd && slot.start < draft.timeEnd && slot.end > draft.timeStart)
      .sort((a, b) => a.start.localeCompare(b.start))
  }, [spaces, draft])

  if (!isNew && !loaded) return <p className="admin-empty">Caricamento…</p>
  if (!isNew && !current) {
    return (
      <div className="admin-event">
        <a className="gest-back" href="/admin/eventi">
          ← Eventi
        </a>
        <p className="admin-empty">Evento non trovato.</p>
      </div>
    )
  }
  if (!draft) return null

  function set(patch) {
    setDraft((prev) => ({ ...prev, ...patch }))
    setNotice('')
    setError('')
  }

  const imageUrl = pending?.url || (draft.imagePath ? eventImageUrl(draft.imagePath) : '')
  const preview = { ...(current ?? {}), ...draft, imagePath: pending ? 'pending' : draft.imagePath }
  const state = eventState(preview)

  function pickFile(event) {
    const next = event.target.files?.[0]
    event.target.value = ''
    if (!next) return
    if (!next.type.startsWith('image/')) {
      setError('Scegli un file immagine (JPG, PNG o WebP).')
      return
    }
    if (next.size > 20 * 1024 * 1024) {
      setError('Immagine troppo pesante (max 20 MB).')
      return
    }
    setFile(next)
  }

  async function save() {
    setBusy(true)
    setError('')
    setNotice('')
    let imagePath = draft.imagePath
    let uploaded = ''
    if (pending) {
      const up = await uploadEventImage(pending.blob)
      if (!up.ok) {
        setBusy(false)
        setError(`Caricamento immagine non riuscito: ${up.error}`)
        return
      }
      uploaded = up.path
      imagePath = up.path
    }
    const result = await saveSiteEvent({ ...draft, imagePath, id: isNew ? '' : eventId })
    setBusy(false)
    if (!result.ok) {
      if (uploaded) await removeEventImage(uploaded)
      setError(result.error)
      return
    }
    const old = current?.imagePath
    if (old && old !== imagePath) await removeEventImage(old)
    setPending(null)
    setDraft((prev) => ({ ...prev, imagePath, id: result.id }))
    if (isNew) {
      navigateAdmin(`/admin/eventi/${result.id}`)
      return
    }
    setNotice('Evento salvato.')
  }

  async function remove() {
    setBusy(true)
    const result = await deleteSiteEvent(eventId)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      setConfirmDelete(false)
      return
    }
    navigateAdmin('/admin/eventi')
  }

  const activeCount = rows.filter((item) => item.status === 'active').length
  const publicUrl = current?.slug ? `/eventi/${current.slug}` : ''

  return (
    <div className="admin-event adm-ev-editor">
      <a className="gest-back" href="/admin/eventi">
        ← Eventi
      </a>
      <header className="ev-head">
        <div>
          <p className="gest-kicker">{isNew ? 'Nuovo evento' : eventWhen(draft)}</p>
          <h1>{draft.title || 'Senza titolo'}</h1>
        </div>
        <button type="button" className="btn-save" onClick={save} disabled={busy || !!file}>
          {busy ? 'Salvataggio…' : isNew ? 'Crea evento' : 'Salva modifiche'}
        </button>
      </header>

      {error ? <p className="book-error">{error}</p> : null}
      {notice ? <p className="settings-notice">{notice}</p> : null}

      <div className="adm-ev-grid">
        <section className="admin-block adm-ev-photo">
          <h2>Locandina</h2>
          {file ? (
            <ImageCropper
              file={file}
              onCancel={() => setFile(null)}
              onDone={(blob) => {
                setPending({ blob, url: URL.createObjectURL(blob) })
                setFile(null)
                setNotice('')
              }}
            />
          ) : (
            <>
              <div className="adm-ev-poster">
                {imageUrl ? <img src={imageUrl} alt="" /> : <span>Nessuna locandina: l’evento non compare sul sito.</span>}
              </div>
              <input ref={input} type="file" accept="image/*" hidden onChange={pickFile} />
              <div className="edit-actions">
                <button type="button" className="btn-ghost" onClick={() => input.current?.click()}>
                  {imageUrl ? 'Sostituisci' : 'Carica locandina'}
                </button>
                {imageUrl ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setPending(null)
                      set({ imagePath: '' })
                    }}
                  >
                    Rimuovi
                  </button>
                ) : null}
              </div>
              {pending ? <p className="admin-hint">Nuova locandina pronta: verrà caricata al salvataggio.</p> : null}
            </>
          )}
        </section>

        <div className="adm-ev-fields">
          <section className="admin-block">
            <h2>Dettagli</h2>
            <label className="admin-field">
              <span>Titolo</span>
              <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Es. Aperitivo di networking" />
            </label>
            <div className="adm-ev-when">
              <label className="admin-field">
                <span>Data</span>
                <input type="date" value={draft.onDate} onChange={(e) => set({ onDate: e.target.value })} />
              </label>
              <label className="admin-field">
                <span>Inizio</span>
                <Time24 value={draft.timeStart} onChange={(v) => set({ timeStart: v })} label="Ora di inizio" />
              </label>
              <label className="admin-field">
                <span>Fine</span>
                <Time24 value={draft.timeEnd} onChange={(v) => set({ timeEnd: v })} label="Ora di fine" placeholder="20:00" />
              </label>
            </div>
            <p className="admin-hint adm-ev-room">
              {blocked.length
                ? `Blocca la Meeting Room: ${blocked.map((slot) => `${slot.start}–${slot.end}`).join(', ')}.`
                : 'Orario fuori dagli slot della Meeting Room: nessuno slot bloccato.'}
            </p>
            <label className="admin-field">
              <span>Breve descrizione</span>
              <textarea rows={2} value={draft.summary} onChange={(e) => set({ summary: e.target.value })} placeholder="Una o due frasi, sotto il titolo nella pagina evento." />
            </label>
            <label className="admin-field">
              <span>Descrizione</span>
              <textarea rows={8} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Programma, ospiti, cosa portare…" />
            </label>
          </section>

          <section className="admin-block">
            <h2>Iscrizioni e visibilità</h2>
            <Switch checked={draft.registrationOpen} onChange={(on) => set({ registrationOpen: on })}>
              Iscrizioni aperte
            </Switch>
            <Switch checked={draft.published} onChange={(on) => set({ published: on })}>
              Pubblica sul sito
            </Switch>
            <label className="admin-field adm-ev-cap">
              <span>Posti disponibili (vuoto = senza limite)</span>
              <input inputMode="numeric" value={draft.capacity} onChange={(e) => set({ capacity: e.target.value.replace(/\D/g, '') })} placeholder="Es. 40" />
            </label>
            <p className="admin-hint">
              In home e con la sua pagina solo se è pubblicato <strong>e</strong> ha la locandina. Gli iscritti ricevono
              una mail con il QR da mostrare in reception.
            </p>
            {publicUrl && state.id === 'public' ? (
              <p className="admin-hint">
                Pagina pubblica:{' '}
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  {publicUrl}
                </a>
              </p>
            ) : null}
          </section>
        </div>
      </div>

      {!isNew ? (
        <div className="adm-ev-save">
          {confirmDelete ? (
            <div className="settings-confirm">
              <p>
                Eliminare l’evento{activeCount ? ` e ${activeCount} iscrizioni` : ''}? Lo slot della Meeting Room torna
                libero. L’azione non si può annullare.
              </p>
              <div className="edit-actions">
                <button type="button" className="btn-danger" onClick={remove} disabled={busy}>
                  Sì, elimina
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
                  Annulla
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
              Elimina evento
            </button>
          )}
        </div>
      ) : null}

      {!isNew && current ? <Registrations event={current} rows={rows} /> : null}
    </div>
  )
}
