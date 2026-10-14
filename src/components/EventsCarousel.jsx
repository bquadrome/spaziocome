import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { fadeUp, stagger, viewport } from '../motion.js'
import { eventImageUrl, eventWhen, fetchPublicEvents } from '../store/eventStore.js'

const AUTOPLAY_MS = 6000

function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false)
  useEffect(() => {
    const media = window.matchMedia?.(query)
    if (!media) return undefined
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function Arrow({ dir }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={dir === 'prev' ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'} />
    </svg>
  )
}

export function Track({ items }) {
  const track = useRef(null)
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [pages, setPages] = useState(1)
  const [hover, setHover] = useState(false)

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return { step: 1, visible: 1 }
    const [first, second] = el.children
    const step = second ? second.offsetLeft - first.offsetLeft : el.clientWidth
    const visible = Math.max(1, Math.round(el.clientWidth / step))
    return { step, visible }
  }, [])

  useEffect(() => {
    const el = track.current
    if (!el) return undefined
    const update = () => {
      const { visible } = measure()
      setPages(Math.max(1, items.length - visible + 1))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [items.length, measure])

  const go = useCallback(
    (target) => {
      const el = track.current
      if (!el) return
      const { step } = measure()
      const last = pages - 1
      const next = target > last ? 0 : target < 0 ? last : target
      el.scrollTo({ left: next * step, behavior: reduced ? 'auto' : 'smooth' })
    },
    [measure, pages, reduced],
  )

  const current = useCallback(() => {
    const el = track.current
    if (!el) return 0
    const { step } = measure()
    return Math.min(pages - 1, Math.round(el.scrollLeft / step))
  }, [measure, pages])

  const move = useCallback((delta) => go(current() + delta), [go, current])

  function onScroll() {
    const el = track.current
    if (!el) return
    const { step } = measure()
    setIndex(Math.min(pages - 1, Math.round(el.scrollLeft / step)))
  }

  // Pausa solo mentre il cursore (o il focus da tastiera) è su una card.
  const autoplay = !reduced && !hover && pages > 1

  useEffect(() => {
    if (!autoplay) return undefined
    const timer = window.setTimeout(() => move(1), AUTOPLAY_MS)
    return () => window.clearTimeout(timer)
  }, [autoplay, index, move])

  return (
    <div className="evc" role="region" aria-roledescription="carosello" aria-label="Prossimi eventi">
      <div className="evc-track" ref={track} onScroll={onScroll}>
        {items.map((item, i) => (
          <a
            key={item.id}
            className="evc-slide"
            href={`/eventi/${item.slug}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} di ${items.length}: ${item.title}`}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onFocus={() => setHover(true)}
            onBlur={() => setHover(false)}
          >
            <img
              src={eventImageUrl(item.image_path)}
              alt=""
              width={1080}
              height={1350}
              loading={i < 3 ? 'eager' : 'lazy'}
              draggable={false}
            />
            <span className="evc-shade" aria-hidden="true" />
            <span className="evc-text">
              <span className="evc-date">{eventWhen(item)}</span>
              <strong>{item.title}</strong>
            </span>
          </a>
        ))}
      </div>

      {pages > 1 ? (
        <div className="evc-controls">
          <div className="evc-dots" role="tablist" aria-label="Scegli slide">
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Vai alla slide ${i + 1}`}
                className={i === index ? 'is-on' : ''}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <div className="evc-buttons">
            <button type="button" className="evc-btn" onClick={() => move(-1)} aria-label="Evento precedente">
              <Arrow dir="prev" />
            </button>
            <button type="button" className="evc-btn" onClick={() => move(1)} aria-label="Evento successivo">
              <Arrow dir="next" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function EventsCarousel() {
  const [items, setItems] = useState([])

  useEffect(() => {
    let alive = true
    fetchPublicEvents().then((list) => {
      if (alive) setItems(list)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!items.length) return null

  return (
    <section className="events" id="eventi">
      <div className="container">
        <motion.div className="events-head" initial="hidden" whileInView="show" viewport={viewport} variants={stagger}>
          <motion.p className="section-label" variants={fadeUp}>
            <img src="/assets/icon-label.svg" alt="" width={24} height={24} />
            <span>EVENTI</span>
          </motion.p>
          <motion.h2 variants={fadeUp}>
            Prossimi <span className="rest">eventi.</span>
          </motion.h2>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewport}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <Track items={items} />
        </motion.div>
      </div>
    </section>
  )
}
