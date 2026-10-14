import { useState } from 'react'
import { SECTION_LABELS } from '../../data/siteDefaults.js'
import {
  patchSite,
  saveSite,
  uploadSiteImage,
  useSiteStatus,
  useSiteStore,
} from '../../store/siteStore.js'

function Field({ label, value, onChange, multiline, rows = 3, hint }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {multiline ? (
        <textarea rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint ? <em className="admin-hint">{hint}</em> : null}
    </label>
  )
}

function ImageField({ label, value, onChange }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setErr('')
    const result = await uploadSiteImage(file)
    setBusy(false)
    if (!result.ok) {
      setErr(result.error)
      return
    }
    onChange(result.url)
  }

  return (
    <div className="admin-field">
      <span>{label}</span>
      {value ? <img className="site-thumb" src={value} alt="" /> : null}
      <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      <input type="file" accept="image/*" onChange={onFile} disabled={busy} />
      {busy ? <em className="admin-hint">Caricamento…</em> : null}
      {err ? <em className="admin-hint">{err}</em> : null}
    </div>
  )
}

function Block({ title, children }) {
  return (
    <details className="admin-block site-block" open>
      <summary>{title}</summary>
      {children}
    </details>
  )
}

export default function AdminSite() {
  const site = useSiteStore()
  const status = useSiteStatus()

  function set(mutator) {
    patchSite(mutator)
  }

  function moveSection(index, dir) {
    const next = index + dir
    if (next < 0 || next >= site.sectionOrder.length) return
    const order = [...site.sectionOrder]
    ;[order[index], order[next]] = [order[next], order[index]]
    set((s) => ({ ...s, sectionOrder: order }))
  }

  function toggleHidden(id) {
    set((s) => {
      const hidden = s.hidden.includes(id) ? s.hidden.filter((x) => x !== id) : [...s.hidden, id]
      return { ...s, hidden }
    })
  }

  const statusLabel =
    status === 'dirty'
      ? 'Modifiche non salvate'
      : status === 'saving'
        ? 'Salvataggio…'
        : status === 'saved'
          ? 'Salvato'
          : status === 'error'
            ? 'Errore di salvataggio'
            : ''

  return (
    <div className="site-editor">
      <div className="site-editor-head">
        <div>
          <h1>Sito</h1>
          <p className="admin-hint">
            Testi, foto, pulsanti e ordine delle sezioni in home. Header e footer restano sempre visibili.
          </p>
        </div>
        <div className="site-editor-actions">
          {statusLabel ? <p className={`site-status is-${status}`}>{statusLabel}</p> : null}
          <button
            className="gest-btn"
            type="button"
            onClick={() => saveSite()}
            disabled={status === 'saving' || status === 'idle' || status === 'saved'}
          >
            Salva
          </button>
        </div>
      </div>

      <Block title="Ordine sezioni">
        <div className="site-order">
          {site.sectionOrder.map((id, i) => (
            <div className="site-order-row" key={id}>
              <strong>{SECTION_LABELS[id] ?? id}</strong>
              <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} aria-label="Su">
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveSection(i, 1)}
                disabled={i === site.sectionOrder.length - 1}
                aria-label="Giù"
              >
                ↓
              </button>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={!site.hidden.includes(id)}
                  onChange={() => toggleHidden(id)}
                />
                visibile
              </label>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Header">
        <Field
          label="Prenota — testo"
          value={site.header.bookLabel}
          onChange={(v) => set((s) => ({ ...s, header: { ...s.header, bookLabel: v } }))}
        />
        <Field
          label="Prenota — link"
          value={site.header.bookHref}
          onChange={(v) => set((s) => ({ ...s, header: { ...s.header, bookHref: v } }))}
        />
        <Field
          label="Area riservata — testo"
          value={site.header.areaLabel}
          onChange={(v) => set((s) => ({ ...s, header: { ...s.header, areaLabel: v } }))}
        />
        <Field
          label="Area riservata — link"
          value={site.header.areaHref}
          onChange={(v) => set((s) => ({ ...s, header: { ...s.header, areaHref: v } }))}
        />
        <Field
          label="Credit — testo"
          value={site.header.biosLabel}
          onChange={(v) => set((s) => ({ ...s, header: { ...s.header, biosLabel: v } }))}
        />
        <Field
          label="Credit — link"
          value={site.header.biosHref}
          onChange={(v) => set((s) => ({ ...s, header: { ...s.header, biosHref: v } }))}
        />
        <h3>Link menu mobile</h3>
        {site.header.links.map((link, i) => (
          <div className="admin-field-row" key={i}>
            <input
              value={link.label}
              onChange={(e) =>
                set((s) => ({
                  ...s,
                  header: {
                    ...s.header,
                    links: s.header.links.map((item, n) =>
                      n === i ? { ...item, label: e.target.value } : item,
                    ),
                  },
                }))
              }
            />
            <input
              value={link.href}
              onChange={(e) =>
                set((s) => ({
                  ...s,
                  header: {
                    ...s.header,
                    links: s.header.links.map((item, n) =>
                      n === i ? { ...item, href: e.target.value } : item,
                    ),
                  },
                }))
              }
            />
          </div>
        ))}
      </Block>

      <Block title="Hero">
        <Field
          label="Titolo"
          value={site.hero.title}
          onChange={(v) => set((s) => ({ ...s, hero: { ...s.hero, title: v } }))}
          multiline
          rows={2}
          hint="Usa Invio per andare a capo."
        />
        <Field
          label="Testo"
          value={site.hero.text}
          onChange={(v) => set((s) => ({ ...s, hero: { ...s.hero, text: v } }))}
          multiline
        />
        <Field
          label="Pulsante — testo"
          value={site.hero.ctaLabel}
          onChange={(v) => set((s) => ({ ...s, hero: { ...s.hero, ctaLabel: v } }))}
        />
        <Field
          label="Pulsante — link"
          value={site.hero.ctaHref}
          onChange={(v) => set((s) => ({ ...s, hero: { ...s.hero, ctaHref: v } }))}
        />
        <ImageField
          label="Foto sfondo"
          value={site.hero.image}
          onChange={(v) => set((s) => ({ ...s, hero: { ...s.hero, image: v } }))}
        />
      </Block>

      <Block title="Il progetto">
        <Field
          label="Etichetta"
          value={site.progetto.label}
          onChange={(v) => set((s) => ({ ...s, progetto: { ...s.progetto, label: v } }))}
        />
        <Field
          label="Titolo — inizio"
          value={site.progetto.titleLead}
          onChange={(v) => set((s) => ({ ...s, progetto: { ...s.progetto, titleLead: v } }))}
        />
        <Field
          label="Titolo — parte chiara"
          value={site.progetto.titleMid}
          onChange={(v) => set((s) => ({ ...s, progetto: { ...s.progetto, titleMid: v } }))}
        />
        <Field
          label="Titolo — fine"
          value={site.progetto.titleTail}
          onChange={(v) => set((s) => ({ ...s, progetto: { ...s.progetto, titleTail: v } }))}
        />
        <Field
          label="Paragrafo 1"
          value={site.progetto.text1}
          onChange={(v) => set((s) => ({ ...s, progetto: { ...s.progetto, text1: v } }))}
          multiline
        />
        <Field
          label="Paragrafo 2"
          value={site.progetto.text2}
          onChange={(v) => set((s) => ({ ...s, progetto: { ...s.progetto, text2: v } }))}
          multiline
        />
        <Field
          label="Pulsante — testo"
          value={site.progetto.ctaLabel}
          onChange={(v) => set((s) => ({ ...s, progetto: { ...s.progetto, ctaLabel: v } }))}
        />
        <Field
          label="Pulsante — link"
          value={site.progetto.ctaHref}
          onChange={(v) => set((s) => ({ ...s, progetto: { ...s.progetto, ctaHref: v } }))}
        />
        <ImageField
          label="Foto"
          value={site.progetto.image}
          onChange={(v) => set((s) => ({ ...s, progetto: { ...s.progetto, image: v } }))}
        />
      </Block>

      <Block title="Cosa offriamo">
        <Field
          label="Etichetta"
          value={site.offriamo.label}
          onChange={(v) => set((s) => ({ ...s, offriamo: { ...s.offriamo, label: v } }))}
        />
        <Field
          label="Titolo"
          value={site.offriamo.title}
          onChange={(v) => set((s) => ({ ...s, offriamo: { ...s.offriamo, title: v } }))}
        />
        <Field
          label="Titolo — seconda riga"
          value={site.offriamo.titleRest}
          onChange={(v) => set((s) => ({ ...s, offriamo: { ...s.offriamo, titleRest: v } }))}
        />
        <Field
          label="Testo"
          value={site.offriamo.text}
          onChange={(v) => set((s) => ({ ...s, offriamo: { ...s.offriamo, text: v } }))}
          multiline
        />
        {site.offriamo.cards.map((card, i) => (
          <div className="site-card-edit" key={i}>
            <h3>Card {i + 1}</h3>
            <Field
              label="Titolo"
              value={card.title}
              onChange={(v) =>
                set((s) => ({
                  ...s,
                  offriamo: {
                    ...s.offriamo,
                    cards: s.offriamo.cards.map((item, n) => (n === i ? { ...item, title: v } : item)),
                  },
                }))
              }
            />
            <Field
              label="Testo"
              value={card.text}
              onChange={(v) =>
                set((s) => ({
                  ...s,
                  offriamo: {
                    ...s.offriamo,
                    cards: s.offriamo.cards.map((item, n) => (n === i ? { ...item, text: v } : item)),
                  },
                }))
              }
              multiline
            />
            <ImageField
              label="Foto"
              value={card.image}
              onChange={(v) =>
                set((s) => ({
                  ...s,
                  offriamo: {
                    ...s.offriamo,
                    cards: s.offriamo.cards.map((item, n) => (n === i ? { ...item, image: v } : item)),
                  },
                }))
              }
            />
          </div>
        ))}
      </Block>

      <Block title="Per chi è pensato">
        <Field
          label="Etichetta"
          value={site.audience.label}
          onChange={(v) => set((s) => ({ ...s, audience: { ...s.audience, label: v } }))}
        />
        <Field
          label="Titolo — inizio"
          value={site.audience.titleLead}
          onChange={(v) => set((s) => ({ ...s, audience: { ...s.audience, titleLead: v } }))}
        />
        <Field
          label="Titolo — parte chiara"
          value={site.audience.titleRest}
          onChange={(v) => set((s) => ({ ...s, audience: { ...s.audience, titleRest: v } }))}
        />
        <Field
          label="Testo"
          value={site.audience.text}
          onChange={(v) => set((s) => ({ ...s, audience: { ...s.audience, text: v } }))}
          multiline
        />
        {site.audience.cards.map((card, i) => (
          <div className="site-card-edit" key={i}>
            <h3>Card {i + 1}</h3>
            <Field
              label="Titolo"
              value={card.title}
              onChange={(v) =>
                set((s) => ({
                  ...s,
                  audience: {
                    ...s.audience,
                    cards: s.audience.cards.map((item, n) => (n === i ? { ...item, title: v } : item)),
                  },
                }))
              }
            />
            <Field
              label="Testo"
              value={card.text}
              onChange={(v) =>
                set((s) => ({
                  ...s,
                  audience: {
                    ...s.audience,
                    cards: s.audience.cards.map((item, n) => (n === i ? { ...item, text: v } : item)),
                  },
                }))
              }
              multiline
            />
            <ImageField
              label="Icona"
              value={card.icon}
              onChange={(v) =>
                set((s) => ({
                  ...s,
                  audience: {
                    ...s.audience,
                    cards: s.audience.cards.map((item, n) => (n === i ? { ...item, icon: v } : item)),
                  },
                }))
              }
            />
          </div>
        ))}
      </Block>

      <Block title="Gli spazi">
        <Field
          label="Etichetta"
          value={site.spaces.label}
          onChange={(v) => set((s) => ({ ...s, spaces: { ...s.spaces, label: v } }))}
        />
        <Field
          label="Titolo"
          value={site.spaces.title}
          onChange={(v) => set((s) => ({ ...s, spaces: { ...s.spaces, title: v } }))}
        />
        <Field
          label="Titolo — seconda riga"
          value={site.spaces.titleRest}
          onChange={(v) => set((s) => ({ ...s, spaces: { ...s.spaces, titleRest: v } }))}
        />
        <Field
          label="Testo"
          value={site.spaces.text}
          onChange={(v) => set((s) => ({ ...s, spaces: { ...s.spaces, text: v } }))}
          multiline
        />
        <Field
          label="Pulsante prenota"
          value={site.spaces.ctaLabel}
          onChange={(v) => set((s) => ({ ...s, spaces: { ...s.spaces, ctaLabel: v } }))}
        />
        {site.spaces.items.map((item, i) => (
          <div className="site-card-edit" key={item.id}>
            <h3>{item.name}</h3>
            <Field
              label="Nome"
              value={item.name}
              onChange={(v) =>
                set((s) => ({
                  ...s,
                  spaces: {
                    ...s.spaces,
                    items: s.spaces.items.map((space, n) => (n === i ? { ...space, name: v } : space)),
                  },
                }))
              }
            />
            <Field
              label="Testo"
              value={item.text}
              onChange={(v) =>
                set((s) => ({
                  ...s,
                  spaces: {
                    ...s.spaces,
                    items: s.spaces.items.map((space, n) => (n === i ? { ...space, text: v } : space)),
                  },
                }))
              }
              multiline
              rows={4}
            />
            <ImageField
              label="Foto"
              value={item.image}
              onChange={(v) =>
                set((s) => ({
                  ...s,
                  spaces: {
                    ...s.spaces,
                    items: s.spaces.items.map((space, n) => (n === i ? { ...space, image: v } : space)),
                  },
                }))
              }
            />
            {item.features.map((feat, fi) => (
              <div className="admin-field-row" key={fi}>
                <input
                  value={feat.title}
                  onChange={(e) =>
                    set((s) => ({
                      ...s,
                      spaces: {
                        ...s.spaces,
                        items: s.spaces.items.map((space, n) =>
                          n === i
                            ? {
                                ...space,
                                features: space.features.map((f, fn) =>
                                  fn === fi ? { ...f, title: e.target.value } : f,
                                ),
                              }
                            : space,
                        ),
                      },
                    }))
                  }
                />
                <input
                  value={feat.subtitle}
                  onChange={(e) =>
                    set((s) => ({
                      ...s,
                      spaces: {
                        ...s.spaces,
                        items: s.spaces.items.map((space, n) =>
                          n === i
                            ? {
                                ...space,
                                features: space.features.map((f, fn) =>
                                  fn === fi ? { ...f, subtitle: e.target.value } : f,
                                ),
                              }
                            : space,
                        ),
                      },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        ))}
      </Block>

      <Block title="Mappa">
        <Field
          label="Titolo — inizio"
          value={site.map.titleLead}
          onChange={(v) => set((s) => ({ ...s, map: { ...s.map, titleLead: v } }))}
        />
        <Field
          label="Titolo — accento"
          value={site.map.titleAccent}
          onChange={(v) => set((s) => ({ ...s, map: { ...s.map, titleAccent: v } }))}
        />
        <Field
          label="Testo"
          value={site.map.text}
          onChange={(v) => set((s) => ({ ...s, map: { ...s.map, text: v } }))}
          multiline
        />
        <Field
          label="Embed Google Maps"
          value={site.map.embed}
          onChange={(v) => set((s) => ({ ...s, map: { ...s.map, embed: v } }))}
          multiline
          rows={2}
        />
      </Block>

      <Block title="Footer">
        <Field
          label="Indirizzo 1"
          value={site.footer.address1}
          onChange={(v) => set((s) => ({ ...s, footer: { ...s.footer, address1: v } }))}
        />
        <Field
          label="Indirizzo 2"
          value={site.footer.address2}
          onChange={(v) => set((s) => ({ ...s, footer: { ...s.footer, address2: v } }))}
        />
        <Field
          label="Indirizzo 3"
          value={site.footer.address3}
          onChange={(v) => set((s) => ({ ...s, footer: { ...s.footer, address3: v } }))}
        />
        <Field
          label="Email"
          value={site.footer.email}
          onChange={(v) => set((s) => ({ ...s, footer: { ...s.footer, email: v } }))}
        />
        {site.footer.socials.map((social, i) => (
          <div className="site-card-edit" key={i}>
            <h3>{social.label || `Social ${i + 1}`}</h3>
            <Field
              label="Nome"
              value={social.label}
              onChange={(v) =>
                set((s) => ({
                  ...s,
                  footer: {
                    ...s.footer,
                    socials: s.footer.socials.map((item, n) => (n === i ? { ...item, label: v } : item)),
                  },
                }))
              }
            />
            <Field
              label="Link"
              value={social.href}
              onChange={(v) =>
                set((s) => ({
                  ...s,
                  footer: {
                    ...s.footer,
                    socials: s.footer.socials.map((item, n) => (n === i ? { ...item, href: v } : item)),
                  },
                }))
              }
            />
          </div>
        ))}
      </Block>
    </div>
  )
}
