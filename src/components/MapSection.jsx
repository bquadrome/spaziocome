import { motion } from 'framer-motion'
import { fadeIn, fadeUp, viewport } from '../motion.js'
import { useSiteStore } from '../store/siteStore.js'

export default function MapSection() {
  const { map } = useSiteStore()

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
          {map.titleLead} <span className="accent">{map.titleAccent}</span>
        </motion.h2>
        <motion.p variants={fadeUp}>{map.text}</motion.p>
        <motion.div className="map-frame" variants={fadeIn} data-lenis-prevent>
          <iframe
            title={map.iframeTitle}
            src={map.embed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </motion.div>
      </motion.div>
    </section>
  )
}
