import { motion } from 'framer-motion'
import { fadeIn, fadeUp, viewport } from '../motion.js'

const MAP =
  'https://maps.google.com/maps?q=Via%20I%20Settembre%2015%2C%2098122%20Messina&z=17&output=embed'

export default function MapSection() {
  return (
    <section className="map-section" id="dove">
      <motion.div
        className="container"
        initial="hidden"
        whileInView="show"
        viewport={viewport}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.1 } },
        }}
      >
        <motion.h2 variants={fadeUp}>
          Co.Me. <span className="accent">trovarci!</span>
        </motion.h2>
        <motion.p variants={fadeUp}>
          Ci trovi nel cuore di Messina, a pochi passi dai principali collegamenti. Le porte sono
          aperte: passa a trovarci per scoprire lo spazio e conoscere la community.
        </motion.p>
        <motion.div className="map-frame" variants={fadeIn} data-lenis-prevent>
          <iframe
            title="Ex Hotel Liberty (4° piano) - Via I Settembre n. 15 – Messina"
            src={MAP}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </motion.div>
      </motion.div>
    </section>
  )
}
