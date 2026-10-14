import { motion } from 'framer-motion'
import DecoArrow from './DecoArrow.jsx'
import { fadeUp, stagger, viewport } from '../motion.js'
import { useSiteStore } from '../store/siteStore.js'

function AreaCard({ area }) {
  return (
    <motion.article
      className={`area-card${area.wide ? ' wide' : ''}`}
      variants={fadeUp}
    >
      <img src={area.image} alt={area.title} width={577} height={300} />
      <h3>{area.title}</h3>
      <p>{area.text}</p>
    </motion.article>
  )
}

export default function Offriamo() {
  const { offriamo } = useSiteStore()
  const cards = offriamo.cards
  const mid = Math.ceil(cards.length / 2)
  const rowOne = cards.slice(0, mid)
  const rowTwo = cards.slice(mid)

  return (
    <section className="offriamo" id="offriamo">
      <div className="container">
        <DecoArrow src="/assets/arrow.svg" />
        <motion.div
          className="offriamo-head"
          initial="hidden"
          whileInView="show"
          viewport={viewport}
          variants={stagger}
        >
          <motion.p className="section-label" variants={fadeUp}>
            <img src="/assets/icon-label.svg" alt="" width={24} height={24} />
            <span>{offriamo.label}</span>
          </motion.p>
          <motion.h2 variants={fadeUp}>
            {offriamo.title}
            <br />
            <span className="rest">{offriamo.titleRest}</span>
          </motion.h2>
          <motion.p variants={fadeUp}>{offriamo.text}</motion.p>
        </motion.div>
        <div className="area-grid" data-lenis-prevent-touch>
          <motion.div
            className="area-row area-row-1"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            {rowOne.map((area) => (
              <AreaCard area={area} key={area.title} />
            ))}
          </motion.div>
          <motion.div
            className="area-row area-row-2"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            {rowTwo.map((area) => (
              <AreaCard area={area} key={area.title} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
