import { motion } from 'framer-motion'
import DecoArrow from './DecoArrow.jsx'
import { fadeUp, stagger, viewport } from '../motion.js'

export default function Progetto() {
  return (
    <section className="progetto" id="progetto">
      <div className="container">
        <motion.div
          className="progetto-copy"
          initial="hidden"
          whileInView="show"
          viewport={viewport}
          variants={stagger}
        >
          <motion.p className="section-label" variants={fadeUp}>
            <img src="/assets/icon-label.svg" alt="" width={24} height={24} />
            <span>IL PROGETTO</span>
          </motion.p>
          <motion.h2 variants={fadeUp}>
            Co.Me.
            <span className="rest"> è il progetto di innovazione </span>
            numero 1 in Sicilia
          </motion.h2>
          <motion.p variants={fadeUp}>
            Da qui nasce Spazio COME un coworking 2.0 dove professionisti, startup, studenti e
            associazioni si incontrano, collaborano e fanno crescere nuove idee.
          </motion.p>
          <motion.p variants={fadeUp}>Dove le connessioni diventano opportunità.</motion.p>
          <motion.a className="btn" href="#spazi" variants={fadeUp}>
            <img src="/assets/icon-explore.svg" alt="" width={18} height={18} />
            Esplora lo spazio
          </motion.a>
        </motion.div>
        <motion.div
          className="progetto-media"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewport}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <DecoArrow src="/assets/arrow.svg" />
          <div className="progetto-photo">
            <img
              src="/assets/progetto.png"
              alt="Open space coworking di Spazio COME a Messina"
              width={616}
              height={463}
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
