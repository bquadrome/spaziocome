import { motion } from 'framer-motion'
import DecoArrow from './DecoArrow.jsx'
import { fadeUp, stagger, viewport } from '../motion.js'

const ROW_ONE = [
  {
    title: 'Co-working Area',
    text: 'Postazioni flessibili ed ergonomiche con connettività Starlink. Il tuo ufficio dinamico, prenotabile online.',
    src: '/assets/area-coworking.png',
    wide: true,
  },
  {
    title: 'Meeting room',
    text: 'Sala multimediale per riunioni e videoconferenze professionali, con accesso diretto al terrazzo.',
    src: '/assets/area-meeting.png',
  },
  {
    title: 'Digital lab',
    text: 'Studio di ultima generazione per produzione audio/video, web radio, podcast e creatività digitale.',
    src: '/assets/area-digital.png',
  },
]

const ROW_TWO = [
  {
    title: 'Rooftop',
    text: 'Spazio esclusivo vista centro storico di Messina. Perfetto per eventi all’aperto e networking.',
    src: '/assets/area-rooftop.png',
  },
  {
    title: 'Expo space',
    text: 'Spazio fluido e modulare per mostre, workshop ed eventi. Il posto dove ogni idea prende vita.',
    src: '/assets/area-expo.png',
  },
  {
    title: 'EU project lab',
    text: 'Hub strategico dedicato alla progettazione europea. Dove le idee diventano progetti finanziati.',
    src: '/assets/area-eu.png',
    wide: true,
  },
]

function AreaCard({ area }) {
  return (
    <motion.article
      className={`area-card${area.wide ? ' wide' : ''}`}
      variants={fadeUp}
    >
      <img src={area.src} alt={area.title} width={577} height={300} />
      <h3>{area.title}</h3>
      <p>{area.text}</p>
    </motion.article>
  )
}

export default function Offriamo() {
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
            <span>COSA OFFRIAMO</span>
          </motion.p>
          <motion.h2 variants={fadeUp}>
            Uno spazio
            <br />
            <span className="rest">per ogni esigenza.</span>
          </motion.h2>
          <motion.p variants={fadeUp}>
            Sei aree uniche pensate per connettere talenti, amplificare la creatività e dare forma ai
            tuoi progetti nel cuore di Messina.
          </motion.p>
        </motion.div>
        <div className="area-grid" data-lenis-prevent-touch>
          <motion.div
            className="area-row area-row-1"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            {ROW_ONE.map((area) => (
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
            {ROW_TWO.map((area) => (
              <AreaCard area={area} key={area.title} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
