import { useState } from 'react'
import CalendarMonth from './CalendarMonth.jsx'
import Time24 from './Time24.jsx'
import { WEEKDAYS, makeStations, patchEvent, uid, useBookingStore } from '../../store/bookingStore.js'

export default function AdminEvent({ eventId }) {
  const { events } = useBookingStore()
  const event = events[eventId]
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })

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

  return (
    <div className="admin-event">
      <section className="admin-block">
        <h2>Testi e visibilità</h2>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={event.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
          Evento prenotabile sul sito
        </label>
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
        <p className="admin-hint">Ogni riga è uno slot. Es. 10:00–12:00 e 15:00–18:00, oppure ore spezzate.</p>
        <div className="admin-slots">
          {(Array.isArray(event.slots) ? event.slots : []).map((slot, i) => (
            <div className="admin-slot" key={slot.id}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <Time24 value={slot.start} onChange={(v) => updateSlot(slot.id, 'start', v)} />
              <span>–</span>
              <Time24 value={slot.end} onChange={(v) => updateSlot(slot.id, 'end', v)} />
              <button type="button" onClick={() => removeSlot(slot.id)} aria-label="Elimina slot">
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn" onClick={addSlot}>
          Aggiungi slot
        </button>
      </section>

      <section className="admin-block">
        <h2>Postazioni e disponibilità</h2>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={!!event.hasStations}
            onChange={(e) => {
              const on = e.target.checked
              const maxCapacity = Math.max(1, event.maxCapacity || 1)
              set({
                hasStations: on,
                maxCapacity,
                stations: on ? makeStations(maxCapacity, event.stations) : event.stations,
              })
            }}
          />
          Usa postazioni
        </label>
        <label className="admin-field">
          <span>Disponibilità massima{event.hasStations ? ' (n. postazioni)' : ' (prenotazioni per slot)'}</span>
          <input
            type="number"
            min={1}
            max={99}
            value={event.maxCapacity ?? 1}
            onChange={(e) => {
              const maxCapacity = Math.max(1, Math.min(99, Number(e.target.value) || 1))
              set({
                maxCapacity,
                stations: event.hasStations ? makeStations(maxCapacity, event.stations) : event.stations,
              })
            }}
          />
        </label>
        {event.hasStations ? (
          <div className="admin-stations">
            <p className="admin-hint">Ogni postazione occupata su giorno + orario resta bloccata.</p>
            {(event.stations ?? []).map((station, i) => (
              <div className="admin-option" key={station.id}>
                <input
                  value={station.label}
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
        ) : (
          <p className="admin-hint">Senza postazioni: lo stesso slot accetta fino a {event.maxCapacity || 1} prenotazioni.</p>
        )}
      </section>

      <section className="admin-block">
        <h2>Giorni prenotabili</h2>
        <div className="admin-days">
          {WEEKDAYS.map((day) => (
            <label key={day.id}>
              <input
                type="checkbox"
                checked={Array.isArray(event.weekdays) ? event.weekdays.includes(day.id) : false}
                onChange={() => toggleWeek(day.id)}
              />
              {day.label}
            </label>
          ))}
        </div>
        <div className="admin-toggles">
          <label className="admin-check">
            <input
              type="checkbox"
              checked={event.allowMultiDay}
              onChange={(e) => set({ allowMultiDay: e.target.checked, maxDays: e.target.checked ? event.maxDays : 1 })}
            />
            Selezione più giorni
          </label>
          <label className="admin-field">
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
          <label className="admin-check">
            <input
              type="checkbox"
              checked={event.allowMultiSlot}
              onChange={(e) =>
                set({ allowMultiSlot: e.target.checked, maxSlots: e.target.checked ? event.maxSlots : 1 })
              }
            />
            Selezione più slot orari
          </label>
          <label className="admin-field">
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
        ].map(([key, label]) => (
          <div className="admin-field-row" key={key}>
            <strong>{label}</strong>
            <label>
              <input
                type="checkbox"
                checked={event.fields?.[key]?.enabled ?? false}
                onChange={(e) => setField(key, { enabled: e.target.checked })}
              />
              visibile
            </label>
            <label>
              <input
                type="checkbox"
                checked={event.fields?.[key]?.required ?? false}
                disabled={!event.fields?.[key]?.enabled}
                onChange={(e) => setField(key, { required: e.target.checked })}
              />
              obbligatorio
            </label>
          </div>
        ))}
        <div className="admin-field-row">
          <strong>Note</strong>
          <label>
            <input
              type="checkbox"
              checked={event.fields?.notes?.enabled ?? false}
              onChange={(e) => setField('notes', { enabled: e.target.checked })}
            />
            visibile
          </label>
          <label>
            <input
              type="checkbox"
              checked={event.fields?.notes?.required ?? false}
              disabled={!event.fields?.notes?.enabled}
              onChange={(e) => setField('notes', { required: e.target.checked })}
            />
            obbligatorio
          </label>
        </div>
        <label className="admin-field">
          <span>Etichetta note</span>
          <input
            value={event.fields?.notes?.label ?? ''}
            onChange={(e) => setField('notes', { label: e.target.value })}
          />
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
        <h2>Menu a tendina extra</h2>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={!!event.extraMenu?.enabled}
            onChange={(e) => setMenu({ enabled: e.target.checked })}
          />
          Mostra nel form
        </label>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={!!event.extraMenu?.required}
            disabled={!event.extraMenu?.enabled}
            onChange={(e) => setMenu({ required: e.target.checked })}
          />
          Obbligatorio
        </label>
        <label className="admin-field">
          <span>Nome menu</span>
          <input value={event.extraMenu?.label ?? ''} onChange={(e) => setMenu({ label: e.target.value })} />
        </label>
        {(event.extraMenu?.options ?? []).map((opt, i) => (
          <div className="admin-option" key={`opt-${i}`}>
            <input value={opt} onChange={(e) => setOption(i, e.target.value)} />
            <button
              type="button"
              onClick={() => setMenu({ options: (event.extraMenu?.options ?? []).filter((_, idx) => idx !== i) })}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn"
          onClick={() => setMenu({ options: [...(event.extraMenu?.options ?? []), 'Nuova voce'] })}
        >
          Aggiungi voce
        </button>
      </section>

      <section className="admin-block">
        <h2>Mail conferma</h2>
        <p className="admin-hint">Segnaposto: {'{{nome}}'} {'{{spazio}}'} {'{{date}}'} {'{{slot}}'}</p>
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
