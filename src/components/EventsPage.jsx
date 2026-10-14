import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Header from './Header.jsx'
import Footer from './Footer.jsx'
import { Track } from './EventsCarousel.jsx'
import { fadeUp, stagger, viewport } from '../motion.js'
import { eventDay, eventImageUrl, fetchPastEvents, fetchPublicEvents } from '../store/eventStore.js'

export default function EventsPage() {
  const [upcoming, setUpcoming] = useState(null)
  const [past, setPast] = useState([])

  useEffect(() => {
    let alive = true
    fetchPublicEvents().then((list) => {
      if (alive) setUpcoming(list)
    })
    fetchPastEvents().then((list) => {
      if (alive) setPast(list)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="page">
      <Header />
      <main className="evl">
        <div className="container">
          <motion.header className="evl-head" initial="hidden" animate="show" variants={stagger}>
            <motion.p className="section-label" variants={fadeUp}>
              <img src="/assets/icon-label.svg" alt="" width={24} height={24} />
              <span>EVENTI</span>
            </motion.p>
            <motion.h1 variants={fadeUp}>
              Cosa succede <span className="rest">a Spazio COME.</span>
            </motion.h1>
            <motion.p className="evl-lead" variants={fadeUp}>
              Talk, workshop e incontri aperti a tutti. Scegli un evento e prenota il tuo posto.
            </motion.p>
          </motion.header>

          <section className="evl-section" aria-labelledby="evl-next">
            <h2 id="evl-next">Prossimi eventi</h2>
            {upcoming === null ? <p className="evl-empty">Caricamento…</p> : null}
            {upcoming && !upcoming.length ? (
              <p className="evl-empty">Nessun evento in programma al momento. Torna a trovarci presto.</p>
            ) : null}
            {upcoming?.length ? <Track items={upcoming} /> : null}
          </section>

          {past.length ? (
            <motion.section
              className="evl-section"
              aria-labelledby="evl-past"
              initial="hidden"
              whileInView="show"
              viewport={viewport}
              variants={stagger}
            >
              <motion.h2 id="evl-past" variants={fadeUp}>
                Eventi passati
              </motion.h2>
              <div className="evl-past">
                {past.map((item) => (
                  <motion.a key={item.id} className="evl-past-card" href={`/eventi/${item.slug}`} variants={fadeUp}>
                    <span className="evl-past-img">
                      <img src={eventImageUrl(item.image_path)} alt="" width={1080} height={1350} loading="lazy" />
                    </span>
                    <span className="evl-past-date">
                      {eventDay(item.on_date, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <strong>{item.title}</strong>
                  </motion.a>
                ))}
              </div>
            </motion.section>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  )
}
