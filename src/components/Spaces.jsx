import { useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import SpaceTagIcon from './SpaceTagIcon.jsx'
import { fadeUp, stagger, viewport } from '../motion.js'
import { useBookingStore } from '../store/bookingStore.js'
import { useSiteStore } from '../store/siteStore.js'

export default function Spaces({ onBook }) {
  const { spaces } = useSiteStore()
  const items = spaces.items
  const [active, setActive] = useState(0)
  const tabsRef = useRef([])
  const panelRef = useRef(null)
  const innerRef = useRef(null)
  const index = items.length ? Math.min(active, items.length - 1) : 0
  const space = items[index]
  const { events } = useBookingStore()
  const bookable = space ? events[space.id]?.enabled !== false : false

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
  }, [index, space?.text, spaces.ctaLabel])

  function select(next) {
    setActive(next)
  }

  function onTabKeyDown(event, i) {
    const last = items.length - 1
    let next = null
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = i === last ? 0 : i + 1
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = i === 0 ? last : i - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    select(next)
    tabsRef.current[next]?.focus()
  }

  if (!space) return null

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
              <span>{spaces.label}</span>
            </motion.p>
            <motion.h2 variants={fadeUp}>
              {spaces.title}
              <br />
              <span className="rest">{spaces.titleRest}</span>
            </motion.h2>
            <motion.p variants={fadeUp}>{spaces.text}</motion.p>
          </motion.div>

          <motion.div
            className="spaces-copy"
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            variants={fadeUp}
          >
            <div className="spaces-index" role="tablist" aria-label="Spazi prenotabili">
              {items.map((item, i) => {
                const isActive = i === index
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
                    {spaces.ctaLabel}
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
              {items.map((item, i) => (
                <img
                  key={item.id}
                  src={item.image}
                  alt={i === index ? item.name : ''}
                  width={720}
                  height={560}
                  className={i === index ? 'is-active' : ''}
                />
              ))}
            </div>
            <div className="features-dock">
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className={`features${i === index ? ' is-active' : ''}`}
                  aria-hidden={i !== index}
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
