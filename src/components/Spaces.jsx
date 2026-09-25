import { useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import SpaceTagIcon from './SpaceTagIcon.jsx'
import { fadeUp, stagger, viewport } from '../motion.js'
import { useBookingStore } from '../store/bookingStore.js'

const SPACES = [
  {
    id: 'coworking',
    name: 'Coworking e Studio',
    text: 'Postazioni dedicate a chi vuole lavorare, studiare, seguire lezioni online, sviluppare un progetto o concentrarsi sulle proprie attività in un ambiente accogliente, luminoso e connesso.',
    image: '/assets/area-coworking.png',
    features: [
      { icon: 'starlink', title: 'Connessione', subtitle: 'ultra veloce' },
      { icon: 'desk', title: 'Postazioni', subtitle: 'ergonomiche' },
      { icon: 'people', title: 'Community', subtitle: 'e networking' },
    ],
  },
  {
    id: 'meeting',
    name: 'Meeting Room',
    text: 'Sala attrezzata e versatile per riunioni, workshop, corsi di formazione, presentazioni e videoconferenze. Spazio professionale, moderno e dinamico.',
    image: '/assets/area-meeting.png',
    features: [
      { icon: 'av', title: 'Dotazioni audio-video', subtitle: 'per conferenze' },
      { icon: 'calendar', title: 'Spazio dinamico', subtitle: 'e multifunzionale' },
      { icon: 'access', title: 'Accesso smart', subtitle: 'e prenotazione rapida' },
    ],
  },
  {
    id: 'expo',
    name: 'Expo Space',
    text: 'Area espositiva modulabile dedicata a mostre, installazioni, presentazioni, pop-up, attività culturali, promozionali e valorizzazione di progetti, idee e brand.',
    image: '/assets/area-expo.png',
    features: [
      { icon: 'layout', title: 'Allestimento', subtitle: 'modulabile' },
      { icon: 'audience', title: 'Eventi', subtitle: 'e inaugurazioni' },
      { icon: 'visibility', title: 'Visibilità', subtitle: 'e networking' },
    ],
  },
  {
    id: 'eu',
    name: 'EU Project Lab',
    text: 'Il servizio di Spazio COME dedicato alle opportunità e alla progettazione europea. Offre consulenza specialistica a giovani, associazioni, enti e imprese nella ricerca di bandi e finanziamenti, nella progettazione e nella comunicazione e valorizzazione dei progetti.',
    image: '/assets/area-eu.png',
    features: [
      { icon: 'grant', title: 'Consulenza', subtitle: 'bandi UE' },
      { icon: 'codesign', title: 'Co-progettazione', subtitle: 'europea' },
      { icon: 'training', title: 'Formazione', subtitle: 'e networking' },
    ],
  },
]

export default function Spaces({ onBook }) {
  const [active, setActive] = useState(0)
  const tabsRef = useRef([])
  const panelRef = useRef(null)
  const innerRef = useRef(null)
  const space = SPACES[active]
  const { events } = useBookingStore()
  const bookable = events[space.id]?.enabled !== false

  useLayoutEffect(() => {
    const panel = panelRef.current
    const inner = innerRef.current
    if (!panel || !inner) return

    const measure = () => Math.ceil(inner.getBoundingClientRect().height)

    const apply = (animate) => {
      const height = measure()
      if (!animate) {
        panel.style.transition = 'none'
        panel.style.height = `${height}px`
        void panel.offsetHeight
        panel.style.transition = ''
        return
      }
      panel.style.height = `${height}px`
    }

    const ready = panel.dataset.ready === 'true'
    let frame = 0
    if (ready) {
      frame = requestAnimationFrame(() => apply(true))
    } else {
      apply(false)
      panel.dataset.ready = 'true'
    }

    const observer = new ResizeObserver(() => apply(true))
    observer.observe(inner)

    const fonts = document.fonts
    if (fonts?.ready) {
      fonts.ready.then(() => apply(true))
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [active])

  function select(index) {
    setActive(index)
  }

  function onTabKeyDown(event, index) {
    const last = SPACES.length - 1
    let next = null
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    select(next)
    tabsRef.current[next]?.focus()
  }

  return (
    <section className="spaces" id="spazi">
      <div className="container">
        <div className="spaces-layout">
          <motion.div
            className="spaces-head"
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            variants={stagger}
          >
            <motion.p className="section-label" variants={fadeUp}>
              <img src="/assets/icon-label.svg" alt="" width={24} height={24} />
              <span>GLI SPAZI</span>
            </motion.p>
            <motion.h2 variants={fadeUp}>
              Prenota il tuo
              <br />
              <span className="rest">spazio.</span>
            </motion.h2>
            <motion.p variants={fadeUp}>
              Quattro ambienti da vivere nel cuore di Messina. Scegli quello che fa per te e
              prenota.
            </motion.p>
          </motion.div>

          <motion.div
            className="spaces-copy"
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            variants={fadeUp}
          >
            <div className="spaces-index" role="tablist" aria-label="Spazi prenotabili">
              {SPACES.map((item, i) => {
                const isActive = i === active
                return (
                  <button
                    key={item.id}
                    className={`space-tab${isActive ? ' is-active' : ''}`}
                    type="button"
                    role="tab"
                    id={`space-tab-${item.id}`}
                    aria-selected={isActive}
                    aria-controls="space-panel"
                    tabIndex={isActive ? 0 : -1}
                    ref={(node) => {
                      tabsRef.current[i] = node
                    }}
                    onClick={() => select(i)}
                    onKeyDown={(event) => onTabKeyDown(event, i)}
                  >
                    <span className="space-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="space-name">{item.name}</span>
                  </button>
                )
              })}
            </div>

            <div
              className="space-panel"
              id="space-panel"
              role="tabpanel"
              aria-labelledby={`space-tab-${space.id}`}
              ref={panelRef}
            >
              <div className="space-panel-inner" key={space.id} ref={innerRef}>
                <p>{space.text}</p>
                {bookable ? (
                  <button className="btn" type="button" onClick={() => onBook?.(space.id)}>
                    <img src="/assets/icon-explore.svg" alt="" width={18} height={18} />
                    Prenota
                  </button>
                ) : (
                  <p className="space-closed">Prenotazioni chiuse</p>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="spaces-visual"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewport}
            transition={{ duration: 0.85, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="spaces-photo">
              {SPACES.map((item, i) => (
                <img
                  key={item.id}
                  src={item.image}
                  alt={i === active ? item.name : ''}
                  width={720}
                  height={560}
                  className={i === active ? 'is-active' : ''}
                />
              ))}
            </div>
            <div className="features-dock">
              {SPACES.map((item, i) => (
                <div
                  key={item.id}
                  className={`features${i === active ? ' is-active' : ''}`}
                  aria-hidden={i !== active}
                >
                  {item.features.map((feat) => (
                    <div className="feature" key={feat.title}>
                      <SpaceTagIcon name={feat.icon} />
                      <strong>{feat.title}</strong>
                      {feat.subtitle ? <span>{feat.subtitle}</span> : null}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
