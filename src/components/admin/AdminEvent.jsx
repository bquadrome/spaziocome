import { useState } from 'react'
import CalendarMonth from './CalendarMonth.jsx'
import Time24 from './Time24.jsx'
import CoworkingMap, { COWORKING_ID, COWORKING_SEATS, usesCoworkingMap } from '../CoworkingMap.jsx'
import {
  CUSTOM_TYPES,
  WEEKDAYS,
  makeStations,
  patchEvent,
  typeColor,
  uid,
  useBookingStore,
} from '../../store/bookingStore.js'

function Switch({ checked, onChange, children, disabled }) {
  return (
    <button
      type="button"
      className={`ev-switch${checked ? ' is-on' : ''}`}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked)
      }}
    >
      <i />
      {children}
    </button>
  )
}

function FieldToggles({ label, enabled, required, onEnabled, onRequired }) {
  return (
    <div className="ev-field-row">
      <strong>{label}</strong>
      <div className="ev-field-ops">
        <button type="button" className={`ev-chip${enabled ? ' is-on' : ''}`} onClick={() => onEnabled(!enabled)}>
          visibile
        </button>
        <button
          type="button"
          className={`ev-chip${required ? ' is-on' : ''}`}
          disabled={!enabled}
          onClick={() => enabled && onRequired(!required)}
        >
          obbligatorio
        </button>
      </div>
    </div>
  )
}

export default function AdminEvent({ eventId }) {
  const { events, colors = {} } = useBookingStore()
  const event = events[eventId]
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [pick, setPick] = useState('')

  if (!event) return <p className="admin-empty">Evento non trovato.</p>

  function set(patch) {
    patchEvent(eventId, patch)
  }

  function shift(delta) {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }

  function toggleWeek(id) {
    const days = Array.isArray(event.weekdays) ? event.weekdays : []
    const has = days.includes(id)
    set({ weekdays: has ? days.filter((d) => d !== id) : [...days, id] })
  }

  function toggleBlock(iso) {
    const blocked = Array.isArray(event.blockedDates) ? event.blockedDates : []
    const has = blocked.includes(iso)
    set({
      blockedDates: has ? blocked.filter((d) => d !== iso) : [...blocked, iso].sort(),
    })
  }

  function updateSlot(id, key, value) {
    const slots = Array.isArray(event.slots) ? event.slots : []
    set({
      slots: slots.map((slot) => (slot.id === id ? { ...slot, [key]: value } : slot)),
    })
  }

  function addSlot() {
    const slots = Array.isArray(event.slots) ? event.slots : []
    const last = slots[slots.length - 1]
    set({
      slots: [...slots, { id: uid(), start: last?.end ?? '09:00', end: '18:00' }],
    })
  }

  function removeSlot(id) {
    const slots = Array.isArray(event.slots) ? event.slots : []
    set({ slots: slots.filter((slot) => slot.id !== id) })
  }

  function setField(key, patch) {
    const fields = event.fields ?? {}
    set({ fields: { ...fields, [key]: { ...(fields[key] ?? {}), ...patch } } })
  }

  function setMenu(patch) {
    set({ extraMenu: { ...event.extraMenu, ...patch } })
  }

  function setOption(i, value) {
    const options = (event.extraMenu?.options ?? []).map((item, idx) => (idx === i ? value : item))
    setMenu({ options })
  }

  function setEmail(kind, patch) {
    const emails = event.emails ?? {}
    set({ emails: { ...emails, [kind]: { ...(emails[kind] ?? {}), ...patch } } })
  }

  const slots = Array.isArray(event.slots) ? event.slots : []
  const stations = event.stations ?? []
  const isCoworking = eventId === COWORKING_ID
  const mapReady = usesCoworkingMap(eventId, stations)

  function pickSeat(id) {
    setPick(id)
    const input = document.getElementById(`station-${id}`)
    input?.focus({ preventScroll: true })
    input?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
  const options = event.extraMenu?.options ?? []
  const customFields = Array.isArray(event.customFields) ? event.customFields : []

  function setCustom(id, patch) {
    set({ customFields: customFields.map((item) => (item.id === id ? { ...item, ...patch } : item)) })
  }

  function addCustom() {
    set({
      customFields: [
        ...customFields,
        { id: uid(), label: 'Nuovo campo', type: 'text', enabled: true, required: false, options: [] },
      ],
    })
  }

  function removeCustom(id) {
    set({ customFields: customFields.filter((item) => item.id !== id) })
  }

  function moveCustom(i, delta) {
    const next = [...customFields]
    const j = i + delta
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    set({ customFields: next })
  }

  return (
    <div className="admin-event">
      <header className="ev-head">
        <span className="ev-dot" style={{ background: typeColor(colors, eventId) }} />
        <div>
          <p className="gest-kicker">Impostazioni spazio</p>
          <h1>{event.name || 'Evento'}</h1>
        </div>
      </header>

      <section className="admin-block">
        <h2>Testi e visibilità</h2>
        <Switch checked={!!event.enabled} onChange={(on) => set({ enabled: on })}>
          Prenotabile sul sito
        </Switch>
        <Switch checked={!!event.hasQr} onChange={(on) => set({ hasQr: on })}>
          Pass QR personale per la reception
        </Switch>
        <Switch checked={!!event.requestMode} onChange={(on) => set({ requestMode: on })}>
          Su richiesta con preventivo
        </Switch>
        {event.requestMode ? (
          <p className="admin-hint">
            Il sito raccoglie richieste invece di prenotazioni: le gestisci da{' '}
            <a href="/admin/richieste">Richieste</a> e blocchi tu le date dopo il pagamento.
          </p>
        ) : null}
        <label className="admin-field">
          <span>Nome</span>
          <input value={event.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="admin-field">
          <span>Testo intro form</span>
          <textarea rows={3} value={event.intro} onChange={(e) => set({ intro: e.target.value })} />
        </label>
      </section>

      <section className="admin-block">
        <h2>Turni orari</h2>
        <p className="admin-hint">Ogni riga è uno slot. Es. 10:00–12:00 e 15:00–18:00.</p>
        <div className="admin-slots">
          {slots.map((slot, i) => (
            <div className="admin-slot" key={slot.id}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <Time24 value={slot.start} onChange={(v) => updateSlot(slot.id, 'start', v)} />
              <span className="ev-dash">–</span>
              <Time24 value={slot.end} onChange={(v) => updateSlot(slot.id, 'end', v)} />
              <button type="button" className="ev-del" onClick={() => removeSlot(slot.id)} aria-label="Elimina slot">
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="gest-btn" onClick={addSlot}>
          Aggiungi slot
        </button>
      </section>

      <section className="admin-block">
        <h2>Postazioni e disponibilità</h2>
        <Switch
          checked={!!event.hasStations}
          disabled={isCoworking}
          onChange={(on) => {
            const maxCapacity = Math.max(1, event.maxCapacity || 1)
            set({
              hasStations: on,
              maxCapacity,
              stations: on ? makeStations(maxCapacity, event.stations) : event.stations,
            })
          }}
        >
          Usa postazioni
        </Switch>
        <label className="admin-field">
          <span>Disponibilità massima{event.hasStations ? ' (n. postazioni)' : ' (prenotazioni per slot)'}</span>
          <input
            type="number"
            min={1}
            max={99}
            value={isCoworking ? COWORKING_SEATS : event.maxCapacity ?? 1}
            disabled={isCoworking}
            onChange={(e) => {
              const maxCapacity = Math.max(1, Math.min(99, Number(e.target.value) || 1))
              set({
                maxCapacity,
                stations: event.hasStations ? makeStations(maxCapacity, event.stations) : event.stations,
              })
            }}
          />
        </label>
        {isCoworking ? (
          <p className="admin-hint">
            Il Coworking usa la piantina della sala: {COWORKING_SEATS} postazioni fisse, il numero sulla mappa è
            l’ordine della lista.
          </p>
        ) : null}
        {isCoworking && !mapReady ? (
          <div className="ev-warn">
            <p>
              Le postazioni salvate sono {stations.length}, la piantina ne richiede {COWORKING_SEATS}. Finché non
              coincidono il sito mostra la lista semplice al posto della mappa.
            </p>
            <button
              type="button"
              className="gest-btn"
              onClick={() =>
                set({
                  hasStations: true,
                  maxCapacity: COWORKING_SEATS,
                  stations: makeStations(COWORKING_SEATS, event.stations),
                })
              }
            >
              Allinea a {COWORKING_SEATS} postazioni
            </button>
          </div>
        ) : null}
        {event.hasStations ? (
          <div className={`admin-stations${mapReady ? ' has-map' : ''}`}>
            <p className="admin-hint">
              {mapReady
                ? 'Clicca un posto sulla piantina per modificarne il nome. Ogni postazione occupata su giorno + orario resta bloccata.'
                : 'Ogni postazione occupata su giorno + orario resta bloccata.'}
            </p>
            {mapReady ? (
              <CoworkingMap stations={stations} value={pick} onChange={pickSeat} preview />
            ) : null}
            <div className="admin-station-list">
              {stations.map((station, i) => (
                <div className={`admin-option${pick === station.id ? ' is-picked' : ''}`} key={station.id}>
                  <span className="ev-num">{String(i + 1).padStart(2, '0')}</span>
                  <input
                    id={`station-${station.id}`}
                    value={station.label}
                    onFocus={() => setPick(station.id)}
                    onChange={(e) =>
                      set({
                        stations: event.stations.map((item) =>
                          item.id === station.id ? { ...item, label: e.target.value } : item,
                        ),
                      })
                    }
                    aria-label={`Postazione ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="admin-hint">Senza postazioni: lo stesso slot accetta fino a {event.maxCapacity || 1} prenotazioni.</p>
        )}
      </section>

      <section className="admin-block">
        <h2>Giorni prenotabili</h2>
        <div className="admin-days">
          {WEEKDAYS.map((day) => {
            const on = Array.isArray(event.weekdays) ? event.weekdays.includes(day.id) : false
            return (
              <button
                key={day.id}
                type="button"
                className={`ev-chip${on ? ' is-on' : ''}`}
                onClick={() => toggleWeek(day.id)}
              >
                {day.label}
              </button>
            )
          })}
        </div>
        <div className="admin-toggles">
          <Switch
            checked={!!event.allowMultiDay}
            onChange={(on) => set({ allowMultiDay: on, maxDays: on ? event.maxDays : 1 })}
          >
            Selezione più giorni
          </Switch>
          <label className="admin-field ev-max">
            <span>Max giorni</span>
            <input
              type="number"
              min={1}
              max={30}
              disabled={!event.allowMultiDay}
              value={event.maxDays}
              onChange={(e) => set({ maxDays: Number(e.target.value) || 1 })}
            />
          </label>
          <Switch
            checked={!!event.allowMultiSlot}
            onChange={(on) => set({ allowMultiSlot: on, maxSlots: on ? event.maxSlots : 1 })}
          >
            Selezione più slot orari
          </Switch>
          <label className="admin-field ev-max">
            <span>Max slot</span>
            <input
              type="number"
              min={1}
              max={20}
              disabled={!event.allowMultiSlot}
              value={event.maxSlots}
              onChange={(e) => set({ maxSlots: Number(e.target.value) || 1 })}
            />
          </label>
        </div>
      </section>

      <section className="admin-block">
        <h2>Giorni non disponibili</h2>
        <p className="admin-hint">Clicca una data per bloccarla o sbloccarla.</p>
        <CalendarMonth
          year={cursor.y}
          month={cursor.m}
          onPrev={() => shift(-1)}
          onNext={() => shift(1)}
          onSelect={toggleBlock}
          blocked={event.blockedDates}
          mode="block"
        />
      </section>

      <section className="admin-block">
        <h2>Campi anagrafica</h2>
        {[
          ['firstName', 'Nome'],
          ['lastName', 'Cognome'],
          ['email', 'Email'],
          ['phone', 'Telefono'],
          ['notes', 'Note'],
        ].map(([key, label]) => (
          <FieldToggles
            key={key}
            label={label}
            enabled={event.fields?.[key]?.enabled ?? false}
            required={event.fields?.[key]?.required ?? false}
            onEnabled={(on) => setField(key, { enabled: on })}
            onRequired={(on) => setField(key, { required: on })}
          />
        ))}
        <label className="admin-field">
          <span>Etichetta note</span>
          <input value={event.fields?.notes?.label ?? ''} onChange={(e) => setField('notes', { label: e.target.value })} />
        </label>
        <label className="admin-field">
          <span>Testo nel campo note</span>
          <input
            value={event.fields?.notes?.placeholder ?? ''}
            onChange={(e) => setField('notes', { placeholder: e.target.value })}
          />
        </label>
      </section>

      <section className="admin-block">
        <h2>Campi personalizzati</h2>
        <p className="admin-hint">
          Domande in più nel form di prenotazione (es. età, matricola, corso di studi). Compaiono nella mail staff,
          nella scheda prenotazione e nell’export CSV.
        </p>
        {customFields.map((field, i) => (
          <div className="ev-custom" key={field.id}>
            <div className="ev-custom-head">
              <input
                value={field.label}
                placeholder="Nome del campo"
                onChange={(e) => setCustom(field.id, { label: e.target.value })}
                aria-label={`Nome campo ${i + 1}`}
              />
              <select value={field.type} onChange={(e) => setCustom(field.id, { type: e.target.value })} aria-label="Tipo">
                {CUSTOM_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
              <button type="button" className="ev-del" onClick={() => moveCustom(i, -1)} disabled={i === 0} aria-label="Sposta su">
                ↑
              </button>
              <button
                type="button"
                className="ev-del"
                onClick={() => moveCustom(i, 1)}
                disabled={i === customFields.length - 1}
                aria-label="Sposta giù"
              >
                ↓
              </button>
              <button type="button" className="ev-del" onClick={() => removeCustom(field.id)} aria-label="Elimina campo">
                ×
              </button>
            </div>
            <div className="ev-field-ops">
              <button
                type="button"
                className={`ev-chip${field.enabled !== false ? ' is-on' : ''}`}
                onClick={() => setCustom(field.id, { enabled: field.enabled === false })}
              >
                visibile
              </button>
              <button
                type="button"
                className={`ev-chip${field.required ? ' is-on' : ''}`}
                onClick={() => setCustom(field.id, { required: !field.required })}
              >
                obbligatorio
              </button>
            </div>
            {field.type === 'select' ? (
              <label className="admin-field">
                <span>Opzioni (una per riga)</span>
                <textarea
                  rows={3}
                  value={(field.options ?? []).join('\n')}
                  onChange={(e) => setCustom(field.id, { options: e.target.value.split('\n') })}
                  onBlur={(e) =>
                    setCustom(field.id, {
                      options: e.target.value
                        .split('\n')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            ) : null}
          </div>
        ))}
        <button type="button" className="gest-btn" onClick={addCustom}>
          Aggiungi campo
        </button>
      </section>

      <section className="admin-block">
        <h2>Menu a tendina extra</h2>
        <div className="ev-switch-row">
          <Switch checked={!!event.extraMenu?.enabled} onChange={(on) => setMenu({ enabled: on })}>
            Mostra nel form
          </Switch>
          <Switch
            checked={!!event.extraMenu?.required}
            disabled={!event.extraMenu?.enabled}
            onChange={(on) => setMenu({ required: on })}
          >
            Obbligatorio
          </Switch>
        </div>
        <label className="admin-field">
          <span>Nome menu</span>
          <input value={event.extraMenu?.label ?? ''} onChange={(e) => setMenu({ label: e.target.value })} />
        </label>
        {options.map((opt, i) => (
          <div className="admin-option" key={`opt-${i}`}>
            <input value={opt} onChange={(e) => setOption(i, e.target.value)} />
            <button
              type="button"
              className="ev-del"
              onClick={() => setMenu({ options: options.filter((_, idx) => idx !== i) })}
              aria-label="Elimina voce"
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="gest-btn" onClick={() => setMenu({ options: [...options, 'Nuova voce'] })}>
          Aggiungi voce
        </button>
      </section>

      <section className="admin-block">
        <h2>Mail conferma</h2>
        <p className="admin-hint">
          Segnaposto: {'{{nome}}'} {'{{spazio}}'} {'{{date}}'} {'{{slot}}'}
        </p>
        <label className="admin-field">
          <span>Oggetto</span>
          <input
            value={event.emails?.confirm?.subject ?? ''}
            onChange={(e) => setEmail('confirm', { subject: e.target.value })}
          />
        </label>
        <label className="admin-field">
          <span>Corpo</span>
          <textarea
            rows={7}
            value={event.emails?.confirm?.body ?? ''}
            onChange={(e) => setEmail('confirm', { body: e.target.value })}
          />
        </label>
      </section>

      <section className="admin-block">
        <h2>Mail annullamento</h2>
        <label className="admin-field">
          <span>Oggetto</span>
          <input
            value={event.emails?.cancel?.subject ?? ''}
            onChange={(e) => setEmail('cancel', { subject: e.target.value })}
          />
        </label>
        <label className="admin-field">
          <span>Corpo</span>
          <textarea
            rows={7}
            value={event.emails?.cancel?.body ?? ''}
            onChange={(e) => setEmail('cancel', { body: e.target.value })}
          />
        </label>
      </section>
    </div>
  )
}
